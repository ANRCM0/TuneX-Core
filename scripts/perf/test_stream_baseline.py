#!/usr/bin/env python3
"""V5-WP3 基线采集器的自检（标准库 unittest，不需要任何外部服务）。

    python3 scripts/perf/test_v5_tcp_baseline.py

只测**纯函数**：统计口径、产物形状，以及 V5.1a 新增的 TLS/WS 客户端里那些
可离线断言的部分（RFC 6455 的 accept 值、帧编解码、握手响应校验、场景注册表）。
唯一的例外是 `WSClientLoopbackTest`：它用一个 20 行的本地回显服务端验证
WSClient 的读侧缓冲（握手响应与首个数据帧同段到达时不能吞帧）。真实拓扑的
采集仍然由 `stream-baseline.py` 自己跑 —— 把易波动的端到端测量塞进单测，只会
得到一条随机器负载变红的测试。
"""

from __future__ import annotations

import csv
import importlib.util
import json
import socket
import ssl
import sys
import tempfile
import threading
import unittest
import urllib.error
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("stream-baseline.py")
spec = importlib.util.spec_from_file_location("stream_baseline", MODULE_PATH)
baseline = importlib.util.module_from_spec(spec)
assert spec.loader is not None
# dataclasses resolves annotations through sys.modules[cls.__module__], so the
# module must be registered before exec_module — otherwise every @dataclass in
# the harness fails with a confusing AttributeError.
sys.modules["stream_baseline"] = baseline
spec.loader.exec_module(baseline)


class PercentileTest(unittest.TestCase):
    def test_empty_is_none_not_zero(self):
        # 0.0 会被下游读成"测到了 0 毫秒"，把"没测到"伪装成"极快"。
        self.assertIsNone(baseline.percentile([], 50))

    def test_single_sample(self):
        self.assertEqual(baseline.percentile([7.0], 95), 7.0)

    def test_median_of_even_count(self):
        self.assertAlmostEqual(baseline.percentile([1, 2, 3, 4], 50), 2.5)

    def test_p95_of_known_series(self):
        values = list(range(1, 101))
        self.assertAlmostEqual(baseline.percentile(values, 95), 95.05, places=2)

    def test_extremes(self):
        values = [5, 1, 9]
        self.assertEqual(baseline.percentile(values, 0), 1)
        self.assertEqual(baseline.percentile(values, 100), 9)


class ThroughputTest(unittest.TestCase):
    def test_mib_per_second(self):
        # 1 MiB in 1s = 1 MiB/s
        self.assertAlmostEqual(baseline.throughput_mib_s(1024 * 1024, 1.0), 1.0)

    def test_zero_elapsed_does_not_produce_infinity(self):
        # inf 会把整组中位数污染成 inf，整份基线就废了。
        self.assertEqual(baseline.throughput_mib_s(1024, 0.0), 0.0)
        self.assertEqual(baseline.throughput_mib_s(1024, -1.0), 0.0)

    def test_summary_shape(self):
        summary = baseline.summarize_throughput([(1024 * 1024, 1.0), (2 * 1024 * 1024, 1.0)])
        self.assertEqual(summary.count, 2)
        self.assertEqual(summary.unit, "MiB/s")
        self.assertAlmostEqual(summary.median, 1.5)
        self.assertAlmostEqual(summary.max, 2.0)


class SummaryTest(unittest.TestCase):
    def test_empty_summary_serialises_null_not_zero(self):
        payload = baseline.Summary.of([], "ms").to_json()
        for key in ("median", "p95", "p99", "min", "max", "mean"):
            self.assertIsNone(payload[key], key)
        self.assertEqual(payload["count"], 0)

    def test_p95_is_never_below_median(self):
        summary = baseline.Summary.of([1, 2, 3, 100], "ms")
        self.assertGreaterEqual(summary.p95, summary.median)
        self.assertGreaterEqual(summary.p99, summary.p95)


class FlattenTest(unittest.TestCase):
    RESULT = {
        "schema_version": baseline.SCHEMA_VERSION,
        "scenarios": {
            "direct": {
                "direct_throughput": {"count": 2, "median": 10.0, "p95": 12.0, "p99": 12.0,
                                      "min": 9.0, "max": 12.0, "mean": 10.5, "unit": "MiB/s"},
                "direct_concurrency": 16,
            }
        },
    }

    def test_csv_rows_cover_every_statistic(self):
        rows = dict((f"{scenario}.{name}", value) for scenario, name, value in baseline.flatten_metrics(self.RESULT))
        self.assertEqual(rows["direct.direct_throughput.median"], 10.0)
        self.assertEqual(rows["direct.direct_throughput.p95"], 12.0)
        self.assertEqual(rows["direct.direct_throughput.p99"], 12.0)
        self.assertEqual(rows["direct.direct_concurrency"], 16)

    def test_artifacts_are_machine_readable(self):
        with tempfile.TemporaryDirectory() as tmp:
            json_path, csv_path = baseline.write_outputs(self.RESULT, Path(tmp))
            reloaded = json.loads(json_path.read_text())
            self.assertEqual(reloaded["scenarios"]["direct"]["direct_concurrency"], 16)
            with csv_path.open() as fh:
                rows = list(csv.reader(fh))
            self.assertEqual(rows[0], ["scenario", "metric", "value"])
            self.assertIn(["direct", "direct_throughput.median", "10.0"], rows)


class EnvironmentTest(unittest.TestCase):
    def test_environment_reports_machine_facts(self):
        env = baseline.environment(None)
        for key in ("python", "platform", "kernel", "cpu_count", "timestamp_utc", "loadavg"):
            self.assertIn(key, env)
        # 容器里跑时 CPU 配额才是真正的核数；缺它会让跨机器比较失去意义。
        self.assertIn("cgroup_cpu_max", env)


class ProfileTest(unittest.TestCase):
    def test_profiles_exist_and_scale_up(self):
        self.assertIn("quick", baseline.PROFILES)
        self.assertIn("full", baseline.PROFILES)
        quick, full = baseline.PROFILES["quick"], baseline.PROFILES["full"]
        for key in ("transfers", "setups", "concurrency", "conn_rounds"):
            self.assertGreater(full[key], quick[key], key)


class EchoTargetLifecycleTest(unittest.TestCase):
    def test_target_identity_is_visible_even_when_echo_finishes_before_start_returns(self):
        from unittest.mock import patch
        original_start = threading.Thread.start
        release_accept = threading.Event()
        worker_started = threading.Event()

        def delay_accept_bookkeeping(worker):
            original_start(worker)
            if getattr(worker._target, "__name__", "") == "_handle":
                worker_started.set()
                release_accept.wait(timeout=2)

        target = baseline.EchoTarget()
        try:
            with patch.object(threading.Thread, "start", delay_accept_bookkeeping):
                received, _ = baseline.transfer_once(target.host, target.port, b"identity", timeout=2)
                self.assertTrue(worker_started.wait(timeout=2))
                self.assertEqual(received, len(b"identity"))
                self.assertTrue(target.accepted.is_set())
        finally:
            release_accept.set()
            target.close()

    def test_close_releases_connected_clients_and_listener(self):
        target = baseline.EchoTarget()
        self.addCleanup(target.close)
        clients = []
        for _ in range(2):
            client = socket.create_connection((target.host, target.port), timeout=2)
            self.addCleanup(client.close)
            client.settimeout(2)
            client.sendall(b"still-connected")
            self.assertEqual(client.recv(64), b"still-connected")
            clients.append(client)
        # Keep the clients open: fixture shutdown must stop its own readers.
        target.close()
        for client in clients:
            self.assertEqual(client.recv(1), b"")
        self.assertFalse(target._thread.is_alive())
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as reclaimed:
            reclaimed.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            reclaimed.bind((target.host, target.port))
            reclaimed.listen(1)

    def test_repeated_idle_targets_join_their_accept_workers(self):
        for _ in range(20):
            target = baseline.EchoTarget()
            target.close()
            self.assertFalse(target._thread.is_alive())


class HotReloadMeasurementTest(unittest.TestCase):
    def test_declared_sample_count_reaches_each_new_target(self):
        from unittest.mock import Mock, patch
        configs = []
        agent = Mock()
        agent.apply_tunnel.side_effect = configs.append
        original = baseline.transfer_once

        def transfer(host, port, payload):
            cfg = configs[-1]
            return original(cfg["remote_host"], cfg["remote_port"], payload, timeout=2)

        with patch.object(baseline, "transfer_once", side_effect=transfer):
            metrics = baseline.measure_hot_reload({"ingress": agent, "listen_port": 1},
                                                  {"hot_reload_samples": 3}, "direct")
        self.assertEqual([cfg["revision"] for cfg in configs], [100, 101, 102])
        self.assertTrue(all(metric["count"] == 3 for metric in metrics.values()))
        self.assertTrue(all(len(metric["samples"]) == 3 for metric in metrics.values()))

    def test_partial_payload_or_another_target_cannot_be_effective(self):
        from unittest.mock import Mock, patch
        for received in (0, len(b"hot-reload")):
            with self.subTest(received=received), patch.object(
                    baseline, "transfer_once", return_value=(received, 0)):
                # No connection reaches the newly allocated target, even when
                # a different endpoint returns the expected number of bytes.
                with self.assertRaisesRegex(RuntimeError, "new echo target"):
                    baseline.measure_hot_reload({"ingress": Mock(), "listen_port": 1},
                                                {"hot_reload_samples": 1}, "direct")


class CpuAccountingTest(unittest.TestCase):
    def test_own_process_cpu_is_measurable(self):
        # 采样器必须能读到自己（基线里读的是被测 Agent 进程）。
        import os
        if baseline._cpu_ticks(os.getpid()) is None:
            self.skipTest("/proc process accounting is unavailable on this platform")
        value = baseline._cpu_seconds(os.getpid())
        self.assertIsNotNone(value)
        self.assertGreaterEqual(value, 0.0)

    def test_cpu_of_a_child_that_burns_cpu_is_nonzero(self):
        """回归：/proc/<pid>/stat 的 utime 是**字段 14**，切掉 comm 之后落在
        index 11。曾经写成 13/14，读到的是 cutime/cstime（已回收子进程的累计
        值）—— 对刚启动的进程恒为 0，症状是"CPU 永远是 0.0"，看起来像负载太轻。
        真实跑一段 CPU 的子进程必须能被测到大于 0。"""
        import subprocess
        import os
        import sys
        import time

        if baseline._cpu_ticks(os.getpid()) is None:
            self.skipTest("/proc process accounting is unavailable on this platform")

        child = subprocess.Popen(
            [sys.executable, "-c", "x=0\nfor i in range(40_000_000): x += i"]
        )
        try:
            deadline = time.time() + 10
            ticks = 0
            while time.time() < deadline:
                time.sleep(0.2)
                ticks = baseline._cpu_ticks(child.pid) or 0
                if ticks > 0:
                    break
            self.assertGreater(ticks, 0, "a CPU-burning child must not report 0 ticks")
            self.assertGreater(baseline._cpu_seconds(child.pid), 0.0)
        finally:
            child.kill()
            child.wait()


class WSAcceptKeyTest(unittest.TestCase):
    def test_rfc6455_published_test_vector(self):
        # RFC 6455 §1.3 的示例：客户端 key → 服务端必须回的 accept 值。
        self.assertEqual(baseline.ws_accept_value("dGhlIHNhbXBsZSBub25jZQ=="),
                         "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=")


class WSHandshakeTest(unittest.TestCase):
    KEY = "dGhlIHNhbXBsZSBub25jZQ=="

    def _response(self, status: str = "HTTP/1.1 101 Switching Protocols",
                  accept: str | None = None) -> bytes:
        value = baseline.ws_accept_value(self.KEY) if accept is None else accept
        return (f"{status}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                f"Sec-WebSocket-Accept: {value}\r\n\r\n").encode()

    def test_request_carries_the_required_upgrade_headers(self):
        req = baseline.ws_handshake_request(self.KEY).decode()
        for token in ("GET / HTTP/1.1", "Upgrade: websocket", "Connection: Upgrade",
                      f"Sec-WebSocket-Key: {self.KEY}", "Sec-WebSocket-Version: 13"):
            self.assertIn(token, req, token)
        self.assertTrue(req.endswith("\r\n\r\n"))

    def test_valid_101_is_accepted(self):
        ok, _detail = baseline.ws_handshake_ok(self._response(), self.KEY)
        self.assertTrue(ok)

    def test_wrong_accept_is_rejected(self):
        # 只检查 101 会把"对端算错握手"伪装成后面的"吞吐为 0"。
        ok, detail = baseline.ws_handshake_ok(self._response(accept="bm90IHRoZSBrZXk="), self.KEY)
        self.assertFalse(ok)
        self.assertIn("mismatch", detail)

    def test_non_upgrade_response_is_rejected(self):
        ok, detail = baseline.ws_handshake_ok(self._response("HTTP/1.1 200 OK"), self.KEY)
        self.assertFalse(ok)
        self.assertIn("no 101", detail)

    def test_missing_accept_header_is_rejected(self):
        ok, detail = baseline.ws_handshake_ok(b"HTTP/1.1 101 Switching Protocols\r\n\r\n", self.KEY)
        self.assertFalse(ok)
        self.assertIn("Sec-WebSocket-Accept", detail)


class XorMaskTest(unittest.TestCase):
    def test_matches_the_naive_rfc6455_definition_at_every_alignment(self):
        mask = b"\x11\x22\x33\x44"
        for size in (0, 1, 2, 3, 4, 5, 7, 8, 300, 65536):
            payload = bytes((i * 7 + 3) % 256 for i in range(size))
            naive = bytes(payload[i] ^ mask[i % 4] for i in range(size))
            self.assertEqual(baseline.xor_mask(payload, mask), naive, size)

    def test_mask_is_its_own_inverse(self):
        payload = b"round trip"
        mask = b"\xde\xad\xbe\xef"
        once = baseline.xor_mask(payload, mask)
        self.assertEqual(baseline.xor_mask(once, mask), payload)

    def test_rejects_a_mask_that_is_not_four_bytes(self):
        with self.assertRaises(ValueError):
            baseline.xor_mask(b"abc", b"\x00\x00\x00")


class WSFrameCodecTest(unittest.TestCase):
    MASK = b"\x01\x02\x03\x04"

    def test_masked_client_frame_roundtrips(self):
        payload = b"tunex-ws"
        raw = baseline.encode_ws_frame(baseline.WS_OP_BINARY, payload, mask=self.MASK)
        self.assertTrue(raw[1] & 0x80, "client frames MUST set the MASK bit")
        frames, rest = baseline.decode_ws_frames(raw)
        self.assertEqual(rest, b"")
        self.assertEqual(len(frames), 1)
        self.assertEqual(frames[0]["opcode"], baseline.WS_OP_BINARY)
        self.assertEqual(frames[0]["payload"], payload)
        self.assertTrue(frames[0]["masked"])

    def test_server_frame_is_unmasked_with_16bit_length(self):
        raw = baseline.encode_ws_frame(baseline.WS_OP_BINARY, b"x" * 300)
        self.assertEqual(raw[1] & 0x80, 0)
        self.assertEqual(raw[1] & 0x7F, 126)
        frames, _ = baseline.decode_ws_frames(raw)
        self.assertEqual(frames[0]["payload"], b"x" * 300)
        self.assertFalse(frames[0]["masked"])

    def test_64k_payload_uses_the_64bit_length_form(self):
        # --profile full 的 payload_kib=1024 会走到这里；长度前缀写错会在真实
        # 链路（大 payload）上才炸，而不是在 quick 档。
        payload = b"y" * (1 << 16)
        raw = baseline.encode_ws_frame(baseline.WS_OP_BINARY, payload, mask=b"\x00\x00\x00\x00")
        self.assertEqual(raw[1] & 0x7F, 127)
        frames, _ = baseline.decode_ws_frames(raw)
        self.assertEqual(frames[0]["payload"], payload)

    def test_partial_frame_stays_in_the_remainder(self):
        raw = baseline.encode_ws_frame(baseline.WS_OP_BINARY, b"abcdef", mask=self.MASK)
        frames, rest = baseline.decode_ws_frames(raw[:6])
        self.assertEqual(frames, [])
        self.assertEqual(rest, raw[:6])
        frames, rest = baseline.decode_ws_frames(rest + raw[6:])
        self.assertEqual(frames[0]["payload"], b"abcdef")
        self.assertEqual(rest, b"")

    def test_two_frames_arriving_in_one_chunk(self):
        one = baseline.encode_ws_frame(baseline.WS_OP_BINARY, b"a", mask=b"\x00\x00\x00\x00")
        two = baseline.encode_ws_frame(baseline.WS_OP_CONTINUATION, b"b", mask=b"\x00\x00\x00\x00")
        frames, rest = baseline.decode_ws_frames(one + two)
        self.assertEqual([f["payload"] for f in frames], [b"a", b"b"])
        self.assertEqual(rest, b"")

    def test_fragmented_message_flags_survive_decoding(self):
        raw = baseline.encode_ws_frame(baseline.WS_OP_BINARY, b"head", mask=self.MASK, fin=False)
        frames, _ = baseline.decode_ws_frames(raw)
        self.assertFalse(frames[0]["fin"])

    def test_ping_control_frame_is_decodable(self):
        raw = baseline.encode_ws_frame(baseline.WS_OP_PING, b"hb", mask=self.MASK)
        frames, _ = baseline.decode_ws_frames(raw)
        self.assertEqual(frames[0]["opcode"], baseline.WS_OP_PING)
        self.assertEqual(frames[0]["payload"], b"hb")

    def test_empty_payload_frame_is_valid(self):
        raw = baseline.encode_ws_frame(baseline.WS_OP_BINARY, b"", mask=self.MASK)
        frames, rest = baseline.decode_ws_frames(raw)
        self.assertEqual(rest, b"")
        self.assertEqual(frames[0]["payload"], b"")


class TLSClientTest(unittest.TestCase):
    def test_context_verifies_nothing_on_loopback_self_signed(self):
        # 基线的临时证书不进信任库：这里量的是数据面成本，不是信任链。
        ctx = baseline.tls_client_context()
        self.assertEqual(ctx.verify_mode, ssl.CERT_NONE)
        self.assertFalse(ctx.check_hostname)
        self.assertGreaterEqual(ctx.minimum_version, ssl.TLSVersion.TLSv1_2)

    def test_certificate_command_shape(self):
        argv = baseline.certificate_command("openssl", Path("/tmp/perf.crt"), Path("/tmp/perf.key"))
        self.assertEqual(argv[0], "openssl")
        for flag in ("-x509", "-keyout", "-out", "-nodes", "-addext", "-subj"):
            self.assertIn(flag, argv, flag)
        self.assertIn(str(Path("/tmp/perf.crt")), argv)
        self.assertIn(str(Path("/tmp/perf.key")), argv)
        san = argv[argv.index("-addext") + 1]
        self.assertIn("IP:127.0.0.1", san)

    def test_missing_openssl_message_is_actionable(self):
        msg = baseline.openssl_missing_message()
        self.assertIn("openssl", msg)
        # 必须指出"不测 tls 时该跑什么"，否则读的人只会看到一条红。
        self.assertIn("--scenarios", msg)
        self.assertIn("direct", msg)


class ScenarioRegistryTest(unittest.TestCase):
    def test_default_scenarios_are_the_frozen_tcp_ones(self):
        self.assertEqual(baseline.parse_args([]).scenarios, ["direct", "relay"])

    def test_tls_and_ws_are_selectable(self):
        args = baseline.parse_args(["--scenarios", "direct", "relay", "tls", "ws"])
        self.assertEqual(args.scenarios, ["direct", "relay", "tls", "ws"])

    def test_protocol_mapping_distinguishes_all_three_protocols(self):
        self.assertEqual(baseline.SCENARIO_PROTOCOL["direct"], "tcp")
        self.assertEqual(baseline.SCENARIO_PROTOCOL["relay"], "tcp")
        self.assertEqual(baseline.SCENARIO_PROTOCOL["tls"], "tls")
        self.assertEqual(baseline.SCENARIO_PROTOCOL["ws"], "ws")

    def test_every_scenario_has_a_factory_and_a_transfer(self):
        for scenario, protocol in baseline.SCENARIO_PROTOCOL.items():
            self.assertTrue(callable(baseline.scenario_factory(scenario)), scenario)
            self.assertIn(protocol, baseline.PROTOCOL_TRANSFER, scenario)
            self.assertIn(protocol, baseline.PROTOCOL_SETUP, scenario)
        # 只有需要会话建立的协议才有 opener；TCP 的并发轮保持原样。
        self.assertEqual(sorted(baseline.PROTOCOL_OPENER), ["tls", "ws"])

    def test_unknown_scenario_fails_loudly(self):
        with self.assertRaises(ValueError):
            baseline.scenario_factory("quic")


class ProfileCaptureTest(unittest.TestCase):
    def test_capture_is_opt_in(self):
        self.assertFalse(baseline.parse_args([]).capture_profiles)
        self.assertTrue(baseline.parse_args(["--capture-profiles"]).capture_profiles)
        self.assertEqual(baseline.parse_args(["--profile-seconds", "3"]).profile_seconds, 3)

    def test_profile_flag_reaches_the_measured_agents(self):
        # 采集开关必须一路传到拓扑构造函数，否则工件会声称有 profile 而磁盘上
        # 什么都没有（pprof 默认关闭，这是刻意的安全默认值）。
        seen: list[bool] = []
        original = baseline.direct_topology
        try:
            baseline.direct_topology = lambda binary, root, profile_enabled=False: (
                seen.append(profile_enabled) or {"agents": []})
            build = baseline.scenario_factory("direct")
            build(Path("agent"), Path("root"), profile_enabled=True)
            build(Path("agent"), Path("root"))
        finally:
            baseline.direct_topology = original
        self.assertEqual(seen, [True, False])

    def test_capture_records_paths_and_never_inlines_profile_bytes(self):
        class FakeAgent:
            label = "ingress"

            def request_bytes(self, path: str) -> bytes:
                return b"profile-bytes"

        with tempfile.TemporaryDirectory() as tmp:
            captured = baseline.capture_profiles(
                {"agents": [FakeAgent()]}, Path(tmp) / "profiles", "direct")
            first = Path(captured["agents"]["ingress"]["heap"]["path"])
            self.assertEqual(first.read_bytes(), b"profile-bytes")
            second = baseline.capture_profiles(
                {"agents": [FakeAgent()]}, Path(tmp) / "profiles", "direct")
            self.assertNotEqual(first, Path(second["agents"]["ingress"]["heap"]["path"]))
            self.assertEqual(first.read_bytes(), b"profile-bytes")
        entry = captured["agents"]["ingress"]["heap"]
        self.assertNotIn("data", entry)
        self.assertEqual(entry["bytes"], len(b"profile-bytes"))
        self.assertEqual(captured["agents"]["ingress"]["cpu"]["seconds"], 1)
        self.assertTrue(captured["passed"])

    def test_cpu_and_trace_are_captured_while_payload_load_runs(self):
        active = threading.Event()
        tested = []

        def workload():
            active.set()
            threading.Event().wait(0.001)

        class FakeAgent:
            label = "ingress"

            def request_bytes(self, path):
                tested.append(active.is_set())
                return b"profile-bytes"

        with tempfile.TemporaryDirectory() as tmp:
            captured = baseline.capture_profiles(
                {"agents": [FakeAgent()]}, Path(tmp), "direct", workload=workload)
        self.assertEqual(tested, [True] * 8)
        self.assertGreater(captured["load"]["transfers"], 0)
        self.assertEqual(captured["load"]["errors"], 0)
        self.assertTrue(captured["passed"])

    def test_failed_capture_and_workload_fail_closed_without_secret_errors(self):
        def workload():
            raise OSError("secret-node-credential")

        class FakeAgent:
            label = "ingress"

            def request_bytes(self, path):
                raise urllib.error.HTTPError("http://secret-token", 401, "secret-token", {}, None)

        with tempfile.TemporaryDirectory() as tmp:
            captured = baseline.capture_profiles(
                {"agents": [FakeAgent()]}, Path(tmp), "relay", workload=workload)
        self.assertFalse(captured["passed"])
        self.assertEqual(captured["load"]["errors"], 1)
        self.assertEqual(captured["agents"]["ingress"]["cpu"]["http_status"], 401)
        self.assertNotIn("secret", json.dumps(captured))

    def test_empty_profile_fails_and_duration_is_bounded(self):
        class FakeAgent:
            label = "ingress"

            def request_bytes(self, path):
                return b""

        with tempfile.TemporaryDirectory() as tmp:
            captured = baseline.capture_profiles({"agents": [FakeAgent()]}, Path(tmp), "direct")
            self.assertFalse(captured["passed"])
            for seconds in (0, 21):
                with self.assertRaises(ValueError):
                    baseline.capture_profiles({"agents": [FakeAgent()]}, Path(tmp), "direct", seconds)

    def test_partial_profile_workload_is_an_error(self):
        from unittest.mock import patch
        with patch.dict(baseline.PROTOCOL_TRANSFER, tcp=lambda *args, **kwargs: (0, 0.001)):
            with self.assertRaises(RuntimeError):
                baseline.profile_workload({"listen_port": 1}, "direct", {"payload_kib": 1})()

    def test_failed_profile_receipt_returns_nonzero_and_is_preserved(self):
        from unittest.mock import patch
        result = {"kind": "stream-baseline", "scenarios": {},
                  "profiling": {"relay": {"passed": False}}}
        with tempfile.TemporaryDirectory() as tmp, patch.object(baseline, "run", return_value=result):
            self.assertEqual(baseline.main(["--out", tmp, "--capture-profiles"]), 4)
            receipts = list(Path(tmp).glob("stream-baseline-*.json"))
            self.assertEqual(len(receipts), 1)
            self.assertFalse(json.loads(receipts[0].read_text())["profiling"]["relay"]["passed"])


class ComparisonTest(unittest.TestCase):
    def _artifact(self, throughput: float, latency: float) -> dict:
        summary = lambda median, p95, p99: {
            "count": 3, "median": median, "p95": p95, "p99": p99,
            "min": median, "max": p99, "mean": median, "unit": "MiB/s",
        }
        return {
            "kind": "stream-baseline", "schema_version": baseline.SCHEMA_VERSION,
            "profile": "quick", "workload": dict(baseline.PROFILES["quick"]), "scenarios": {
                "direct": {
                    "direct_throughput": summary(throughput, throughput, throughput),
                    "direct_connect_ms": summary(latency, latency, latency),
                }
            },
        }

    def test_relative_gate_distinguishes_throughput_and_latency(self):
        result = baseline.compare_results(self._artifact(80, 12), self._artifact(100, 10), 0.15)
        self.assertFalse(result["passed"])
        names = {item["metric"] for item in result["regressions"]}
        self.assertIn("direct.direct_throughput.median", names)
        self.assertIn("direct.direct_connect_ms.median", names)

    def test_missing_metrics_fail_closed(self):
        candidate = self._artifact(100, 10)
        del candidate["scenarios"]["direct"]["direct_connect_ms"]
        result = baseline.compare_results(candidate, self._artifact(100, 10))
        self.assertFalse(result["passed"])
        self.assertIn("direct.direct_connect_ms", result["missing"])

    def test_schema_v1_anchor_remains_compatible(self):
        anchor = self._artifact(100, 10)
        anchor["schema_version"] = 1
        for summary in anchor["scenarios"]["direct"].values():
            summary.pop("p99")
        result = baseline.compare_results(self._artifact(100, 10), anchor)
        self.assertTrue(result["passed"])

    def test_null_nonfinite_and_boolean_summary_values_fail_closed(self):
        for value in (None, float("nan"), float("inf"), True):
            with self.subTest(value=value):
                candidate = self._artifact(100, 10)
                candidate["scenarios"]["direct"]["direct_connect_ms"]["p99"] = value
                result = baseline.compare_results(candidate, self._artifact(100, 10))
                self.assertFalse(result["passed"])
                self.assertIn("direct.direct_connect_ms.p99", result["missing"])
                json.dumps(result, allow_nan=False)

    def test_missing_nested_resource_metric_fails_closed(self):
        anchor = self._artifact(100, 10)
        anchor["scenarios"]["direct"]["ingress_gauges"] = {"rss_bytes": 1024}
        result = baseline.compare_results(self._artifact(100, 10), anchor)
        self.assertFalse(result["passed"])
        self.assertIn("direct.ingress_gauges.rss_bytes", result["missing"])

    def test_new_errors_regress_from_zero_baseline(self):
        anchor, candidate = self._artifact(100, 10), self._artifact(100, 10)
        anchor["scenarios"]["direct"]["direct_error_count"] = 0
        candidate["scenarios"]["direct"]["direct_error_count"] = 1
        result = baseline.compare_results(candidate, anchor)
        self.assertFalse(result["passed"])
        self.assertEqual(result["regressions"][0]["metric"], "direct.direct_error_count")
        self.assertIsNone(result["regressions"][0]["relative_change"])

    def test_boolean_resource_or_error_counter_is_not_numeric(self):
        anchor, candidate = self._artifact(100, 10), self._artifact(100, 10)
        anchor["scenarios"]["direct"]["direct_error_count"] = False
        candidate["scenarios"]["direct"]["direct_error_count"] = 0
        self.assertFalse(baseline.compare_results(candidate, anchor)["passed"])

    def test_sampling_and_environment_mismatch_fail_closed(self):
        anchor, candidate = self._artifact(100, 10), self._artifact(100, 10)
        anchor["dimensions"] = {"rtt_ms": 10}
        candidate["dimensions"] = {"rtt_ms": 20}
        anchor["environment"] = {"machine": "x86_64", "go_version": "go1.26.3"}
        candidate["environment"] = {"machine": "arm64", "go_version": "go1.26.4"}
        candidate["profiles_enabled"] = True
        candidate["scenarios"]["direct"]["direct_connect_ms"]["unit"] = "seconds"
        result = baseline.compare_results(candidate, anchor)
        self.assertFalse(result["passed"])
        self.assertEqual(set(result["environment_mismatch"]), {"machine", "go_version"})
        self.assertEqual(set(result["workload_mismatch"]), {
            "profiles_enabled", "dimensions.rtt_ms", "direct.direct_connect_ms.unit"})

    def test_empty_or_invalid_anchor_cannot_pass(self):
        for metrics in ({}, {"direct": {}}, {"direct": {"direct_error_count": float("nan")}}):
            anchor = self._artifact(100, 10)
            anchor["scenarios"] = metrics
            result = baseline.compare_results(self._artifact(100, 10), anchor)
            self.assertFalse(result["passed"])
            self.assertTrue(result["invalid"])

    def test_empty_or_changed_sample_count_cannot_pass(self):
        for count in (0, 1, None):
            candidate = self._artifact(100, 10)
            candidate["scenarios"]["direct"]["direct_connect_ms"]["count"] = count
            self.assertFalse(baseline.compare_results(candidate, self._artifact(100, 10))["passed"])

    def test_legacy_profile_sizes_are_not_performance_gauges(self):
        anchor, candidate = self._artifact(100, 10), self._artifact(100, 10)
        anchor["scenarios"]["direct"]["ingress_profiles"] = {"heap": {"bytes": 1024}}
        self.assertTrue(baseline.compare_results(candidate, anchor)["passed"])

    def test_schema_v2_requires_tail_fields_and_workload(self):
        anchor = self._artifact(100, 10)
        del anchor["scenarios"]["direct"]["direct_connect_ms"]["p99"]
        self.assertFalse(baseline.compare_results(self._artifact(100, 10), anchor)["passed"])
        candidate = self._artifact(100, 10)
        del candidate["workload"]["payload_kib"]
        self.assertFalse(baseline.compare_results(candidate, self._artifact(100, 10))["passed"])

    def test_malformed_artifact_shape_cannot_be_compared(self):
        for field, value in (("schema_version", 99), ("profile", None),
                             ("workload", []), ("scenarios", None), ("environment", [])):
            artifact = self._artifact(100, 10)
            artifact[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                baseline.compare_results(artifact, self._artifact(100, 10))

    def test_go_run_average_tail_is_reported_but_median_cost_is_gated(self):
        anchor, candidate = self._artifact(100, 10), self._artifact(100, 10)
        for artifact in (anchor, candidate):
            artifact["scenarios"]["go_transport"] = {
                "PlainTCP_latency_ns": dict(artifact["scenarios"]["direct"]["direct_connect_ms"])}
        candidate["scenarios"]["go_transport"]["PlainTCP_latency_ns"]["p99"] = 100
        result = baseline.compare_results(candidate, anchor)
        self.assertTrue(result["passed"])
        self.assertEqual(len(result["run_distribution_variations"]), 1)
        candidate["scenarios"]["go_transport"]["PlainTCP_latency_ns"]["median"] = 20
        self.assertFalse(baseline.compare_results(candidate, anchor)["passed"])

    def test_repeated_round_count_and_setup_override_are_explicit(self):
        candidate = self._artifact(100, 10)
        candidate["native_rounds"] = 3
        self.assertIn("native_rounds", baseline.compare_results(candidate, self._artifact(100, 10))["workload_mismatch"])
        self.assertEqual(baseline.parse_args(["--setups", "500"]).setups, 500)

    def test_setup_phase_order_cannot_be_compared_to_a_legacy_anchor(self):
        anchor, candidate = self._artifact(100, 10), self._artifact(100, 10)
        candidate["workload"]["stream_phase_order"] = list(baseline.STREAM_PHASE_ORDER)
        result = baseline.compare_results(candidate, anchor)
        self.assertFalse(result["passed"])
        self.assertIn("stream_phase_order", result["workload_mismatch"])
        anchor["workload"]["stream_phase_order"] = list(baseline.STREAM_PHASE_ORDER)
        self.assertTrue(baseline.compare_results(candidate, anchor)["passed"])
        candidate["workload"]["stream_phase_order"] = ["unknown"]
        with self.assertRaises(ValueError):
            baseline.compare_results(candidate, anchor)

    def test_resource_and_go_sample_phases_must_match(self):
        for marker in ("resource_phase", "go_sample_order"):
            anchor, candidate = self._artifact(100, 10), self._artifact(100, 10)
            target = candidate["workload"] if marker == "resource_phase" else candidate
            target[marker] = "after_stream_quiescence" if marker == "resource_phase" else "alternating_process_pairs"
            result = baseline.compare_results(candidate, anchor)
            self.assertFalse(result["passed"])
            self.assertIn(marker, result["workload_mismatch"])
            target[marker] = "unknown"
            with self.assertRaises(ValueError):
                baseline.compare_results(candidate, anchor)

    def test_legacy_and_larger_hot_reload_populations_cannot_mix(self):
        anchor, candidate = self._artifact(100, 10), self._artifact(100, 10)
        del anchor["workload"]["hot_reload_samples"]
        result = baseline.compare_results(candidate, anchor)
        self.assertFalse(result["passed"])
        self.assertIn("hot_reload_samples", result["workload_mismatch"])

    def test_hot_reload_count_must_match_all_native_rounds(self):
        anchor, candidate = self._artifact(100, 10), self._artifact(100, 10)
        for artifact in (anchor, candidate):
            artifact["native_rounds"] = 3
            artifact["workload"]["hot_reload_samples"] = 5
            for metric in ("direct_hot_reload_apply_ms", "direct_hot_reload_effective_ms"):
                artifact["scenarios"]["direct"][metric] = baseline.Summary.of([1] * 15, "ms").to_json()
        self.assertTrue(baseline.compare_results(candidate, anchor)["passed"])
        candidate["scenarios"]["direct"]["direct_hot_reload_apply_ms"] = baseline.Summary.of([1] * 14, "ms").to_json()
        result = baseline.compare_results(candidate, anchor)
        self.assertFalse(result["passed"])
        self.assertIn("candidate.direct.direct_hot_reload_apply_ms.count", result["invalid"])

    def test_malformed_hot_reload_workload_is_rejected(self):
        for count in (True, None, 0, 1001, "100"):
            candidate = self._artifact(100, 10)
            candidate["workload"]["hot_reload_samples"] = count
            with self.subTest(count=count), self.assertRaises(ValueError):
                baseline.compare_results(candidate, self._artifact(100, 10))

    def test_hot_reload_target_verification_modes_must_match(self):
        anchor, candidate = self._artifact(100, 10), self._artifact(100, 10)
        candidate["workload"]["hot_reload_verification"] = "target_accept_and_complete_payload"
        result = baseline.compare_results(candidate, anchor)
        self.assertFalse(result["passed"])
        self.assertIn("hot_reload_verification", result["workload_mismatch"])
        anchor["workload"]["hot_reload_verification"] = "target_accept_and_complete_payload"
        self.assertTrue(baseline.compare_results(candidate, anchor)["passed"])
        candidate["workload"]["hot_reload_verification"] = "unknown"
        with self.assertRaises(ValueError):
            baseline.compare_results(candidate, anchor)


class CompleteWorkloadTest(unittest.TestCase):
    def test_setup_burst_cannot_contaminate_payload_or_concurrent_rtt(self):
        from unittest.mock import patch
        for scenario in baseline.SCENARIO_PROTOCOL:
            with self.subTest(scenario=scenario):
                setup_pending = False
                measured = []

                def payload(*args, **kwargs):
                    self.assertFalse(setup_pending, "downstream setup backlog entered payload measurement")
                    measured.append("payload")
                    return {}

                def setup(*args, **kwargs):
                    nonlocal setup_pending
                    setup_pending = True
                    return {}

                with patch.object(baseline, "measure_throughput", side_effect=payload), \
                        patch.object(baseline, "measure_concurrency", side_effect=payload), \
                        patch.object(baseline, "measure_connection_setup", side_effect=setup), \
                        patch.object(baseline, "measure_ws_integrity", return_value={}):
                    result = baseline.measure_stream_scenario(scenario, {}, {})
                self.assertEqual(len(measured), 2)
                self.assertTrue(setup_pending)
                self.assertEqual(result[f"{scenario}_error_count"], 0)

    def test_partial_throughput_cannot_be_a_successful_measurement(self):
        with self.assertRaises(RuntimeError):
            baseline.measure_throughput({"listen_port": 1}, {"payload_kib": 1, "transfers": 1},
                                        "direct", transfer=lambda *args: (1, 0.01))

    def test_missing_concurrent_connection_cannot_be_a_successful_measurement(self):
        with self.assertRaises(RuntimeError):
            baseline.measure_concurrency({"listen_port": 1}, {"concurrency": 2, "conn_rounds": 1},
                                         "direct", round_fn=lambda *args: (1, 0.01, [0.01]))


class QuiescenceTest(unittest.TestCase):
    def topology(self):
        from types import SimpleNamespace
        return {"agents": [SimpleNamespace(label="ingress")]}

    def test_workers_rebounding_reset_the_quiet_window(self):
        from unittest.mock import patch
        values = [{"ingress": {"goroutines": n}} for n in (20, 10, 20, 10, 10, 10)]
        with patch.object(baseline, "collect_gauges", side_effect=values), \
                patch.object(baseline.time, "perf_counter", side_effect=[0, 0.1, 0.2, 0.6, 0.7, 1.1, 1.3]), \
                patch.object(baseline.time, "sleep"):
            gauges, receipt = baseline.await_stream_quiescence(
                self.topology(), {"ingress": {"goroutines": 10}}, quiet_seconds=0.5)
        self.assertEqual(gauges["ingress"]["goroutines"], 10)
        self.assertEqual(receipt["polls"], 6)
        self.assertEqual(receipt["elapsed_seconds"], 1.3)

    def test_sustained_excess_workers_or_missing_gauges_cannot_pass(self):
        from unittest.mock import patch
        for count in (11, None, True):
            with self.subTest(count=count), \
                    patch.object(baseline, "collect_gauges", return_value={"ingress": {"goroutines": count}}), \
                    patch.object(baseline.time, "perf_counter", side_effect=[0, 0.1, 0.6, 1.1]), \
                    patch.object(baseline.time, "sleep"), self.assertRaises(RuntimeError):
                baseline.await_stream_quiescence(self.topology(), {"ingress": {"goroutines": 10}}, timeout=1)

    def test_resource_delta_uses_the_observed_quiet_snapshot(self):
        from types import SimpleNamespace
        from unittest.mock import Mock, patch
        agent = SimpleNamespace(label="ingress", gauge=Mock(side_effect=AssertionError("resampled busy process")))
        with patch.object(baseline, "cpu_hz", return_value=100):
            result = baseline.measure_gauges({"agents": [agent]},
                {"ingress": {"cpu_ticks": 10, "cpu_seconds": 0.1}},
                {"ingress": {"cpu_ticks": 20, "cpu_seconds": 0.2, "goroutines": 10}})
        self.assertAlmostEqual(result["agents_cpu_seconds_used_total"], 0.1)
        self.assertEqual(result["ingress_gauges"]["goroutines"], 10)
        agent.gauge.assert_not_called()


class WSClientLoopbackTest(unittest.TestCase):
    """WSClient 读侧缓冲的回归：握手响应与首个数据帧同段到达时不能吞帧。

    这是真实链路上会发生的事（服务端先写 101、紧接着写第一帧），而"读到
    \\r\\n\\r\\n 就把尾巴丢掉"的实现会静默少一个 payload —— 症状是吞吐偏低，
    不是报错，正好是基线最不该有的失败模式。
    """

    def test_coalesced_handshake_and_first_frame_are_not_swallowed(self):
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind(("127.0.0.1", 0))
        server.listen(1)
        host, port = server.getsockname()
        first = b"coalesced"

        def serve() -> None:
            conn, _ = server.accept()
            try:
                head = b""
                while b"\r\n\r\n" not in head:
                    head += conn.recv(1024)
                key = [ln.split(":", 1)[1].strip() for ln in head.decode().split("\r\n")
                       if ln.lower().startswith("sec-websocket-key:")][0]
                response = ("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n"
                            "Connection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n"
                            % baseline.ws_accept_value(key)).encode()
                # 一帧数据与握手响应在**同一次** write 里发出。
                conn.sendall(response + baseline.encode_ws_frame(baseline.WS_OP_BINARY, first))
                buf = b""
                while True:
                    chunk = conn.recv(4096)
                    if not chunk:
                        return  # 客户端关闭：recv 会一直返回 b""，必须在这里收手
                    buf += chunk
                    frames, buf = baseline.decode_ws_frames(buf)
                    if frames:
                        return  # 客户端发来的 masked 帧解得出来即可
            finally:
                conn.close()
                server.close()

        thread = threading.Thread(target=serve, daemon=True)
        thread.start()
        try:
            with baseline.WSClient(host, port, timeout=5) as client:
                self.assertGreater(client.handshake_ms, 0.0)
                got = b""
                while len(got) < len(first):
                    chunk = client.recv(1024)
                    if not chunk:
                        break
                    got += chunk
            self.assertEqual(got, first)
        finally:
            thread.join(timeout=5)


if __name__ == "__main__":
    sys.exit(0 if unittest.main(exit=False).result.wasSuccessful() else 1)
