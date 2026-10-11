#!/usr/bin/env python3
"""TuneX V5-WP3 —— 性能基线（TCP / TLS / WS）。

本文件最初只测 TCP（DIRECT / RELAY，文件名与产物名沿用至今）。V5.1a 增加
`tls` / `ws` 两个前端协议后，这里按同一条流水线补上两个场景：§5.4 要求
「每个协议各有自己的场景」，而三种协议共用同一个 stream 运行时
（DEVELOPMENT.md §6.1），所以场景之间只有「入口 listener 的形态」不同：

  · `direct` / `relay`  TCP（拓扑仍是原生转发参照，采样顺序写入 workload）；
  · `tls`             入口是 TLS listener（自签证书临时生成），握手后同一条路径；
  · `ws`              入口是 WebSocket listener（RFC 6455 握手 + 分帧），
                      解帧后的字节流走同一条路径。

设计约束（DEVELOPMENT.md §5.4）：

  · **可重复**：同一命令跑两次得到可比较的数字，不需要任何外部服务；
  · **可机器读取**：输出 JSON（权威）+ CSV（便于画趋势）；
  · **区分 DIRECT / RELAY**：RELAY 真的经过两台 Agent 进程（ingress + egress），
    不是在同一条隧道的两种配置里换名字；
  · **不需要生产凭据**：完全在回环上跑，admin token 每次随机生成、只存在于
    进程环境里，不写进任何产物；README 说明这一点；
  · **不设绝对阈值**：本脚本只**测量**，从不判定"变慢了"。共享 CI Runner 上
    毫秒级硬门槛只会制造随机红灯（§5.4「不要一开始用脆弱绝对阈值阻断 CI」）。

测量项（§5.4「至少测量」）与实现方式：

  DIRECT throughput            回环 echo 目标 + 一次 apply DIRECT
  RELAY throughput             两台 Agent（ingress/egress）+ apply RELAY
  connection setup latency     TCP 入口握手完成；不代表下游已建立或收到首字节
  concurrent connections       同时保持 N 条连接并各跑一次往返
  CPU                          /proc/<pid>/stat 的 utime+stime 增量
  RSS                          /proc/<pid>/status 的 VmRSS
  goroutine count              Agent 的 GET /debug/runtime（/proc 没有这个数）
  hot reload latency           apply 同一隧道、换 target、revision+1
  restart/reconnect convergence 重启 Agent 进程到端口重新可用
  graceful drain duration      SIGTERM 到进程退出（有界排空）

TLS / WS 场景复用上面除「生命周期」以外的全部测量项（生命周期路径是三种协议
共用的 stream 运行时，已在 `direct` 上测一次）：

  TLS throughput              建连 + TLS 握手 + 一次完整回环传输
  TLS connect latency         建连到 **TLS 握手完成**（这是 TLS 相对 TCP 多出来的
                              那部分建立成本，所以口径必须包含握手）
  WS throughput               建连 + RFC 6455 握手 + 一帧 masked 二进制消息 + 读回解帧字节
  WS connect latency          建连到 **101 + Sec-WebSocket-Accept 校验通过**

本模块只用 Python 标准库：基线脚本本身不该引入需要安装的依赖，否则"可重复"
就变成了"在一台装过东西的机器上可重复"。
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import json
import math
import os
import platform
import random
import shutil
import signal
import socket
import ssl
import http.server
import socketserver
import statistics
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Callable, Iterable, Sequence

SCHEMA_VERSION = 2
STREAM_PHASE_ORDER = ["throughput", "concurrency", "connection_setup"]
LEGACY_STREAM_PHASE_ORDER = ["throughput", "connection_setup", "concurrency"]

# ── 默认工作量 ──
#
# 刻意偏小：基线要能在几分钟内跑完，否则没人会在改代码后重跑它，而没有重跑的
# 基线等于没有基线。`--profile full` 放大到"接近真实链路"的量级，用于发布前的
# 人工对比，不用于每次提交。
PROFILES = {
    "quick": {"payload_kib": 64, "transfers": 40, "conn_timeouts": 30,
              "concurrency": 16, "conn_rounds": 20, "setups": 50, "hot_reload_samples": 100},
    "full": {"payload_kib": 1024, "transfers": 120, "conn_timeouts": 120,
             "concurrency": 128, "conn_rounds": 40, "setups": 400, "hot_reload_samples": 200},
}

# All pprof files are opt-in; ordinary /debug/runtime gauges remain available
# without the profile flag. Profile artifacts are separate from timed metrics.
PROFILE_CAPTURE_NAMES = ("allocs", "block", "goroutine", "heap", "mutex", "threadcreate")


# ======================================================================
# 统计工具（纯函数：可离线单测）
# ======================================================================

def percentile(values: Sequence[float], pct: float) -> float | None:
    """线性插值分位数（numpy 之外的标准做法，与统计教材一致）。

    空输入返回 None 而不是 0.0：0.0 会被下游当成"测到了 0 毫秒"，
    把"没测到"伪装成"极快"，是性能报告里最坏的失败模式。
    """
    if not values:
        return None
    if len(values) == 1:
        return float(values[0])
    ordered = sorted(float(v) for v in values)
    if pct <= 0:
        return ordered[0]
    if pct >= 100:
        return ordered[-1]
    rank = (pct / 100.0) * (len(ordered) - 1)
    low = int(rank)
    high = min(low + 1, len(ordered) - 1)
    frac = rank - low
    return ordered[low] + (ordered[high] - ordered[low]) * frac


@dataclass
class Summary:
    """一组样本的摘要。median / p95 是 §5.4 明确要求的两个口径。"""

    count: int
    median: float | None
    p95: float | None
    p99: float | None
    min: float | None
    max: float | None
    mean: float | None
    unit: str = ""
    samples: list[float] = field(default_factory=list)

    @staticmethod
    def of(values: Sequence[float], unit: str = "") -> "Summary":
        if not values:
            return Summary(0, None, None, None, None, None, None, unit)
        return Summary(
            count=len(values),
            median=percentile(values, 50),
            p95=percentile(values, 95),
            p99=percentile(values, 99),
            min=float(min(values)),
            max=float(max(values)),
            mean=float(statistics.fmean(values)),
            unit=unit,
            samples=[float(value) for value in values],
        )

    def to_json(self) -> dict:
        return asdict(self)


def throughput_mib_s(total_bytes: int, elapsed_s: float) -> float:
    """MiB/s。elapsed <= 0 视为无效（返回 0 而不是 inf，避免污染中位数）。"""
    if elapsed_s <= 0:
        return 0.0
    return (total_bytes / (1024 * 1024)) / elapsed_s


def summarize_throughput(samples: Iterable[tuple[int, float]], unit: str = "MiB/s") -> Summary:
    """(字节数, 秒) 样本 → 吞吐摘要。"""
    return Summary.of([throughput_mib_s(b, s) for b, s in samples], unit)


# ======================================================================
# 回环 echo 目标
# ======================================================================

class EchoTarget:
    """回环上的 echo 服务：把收到的字节原样写回，直到对端关闭。

    用纯 socket 而不是 http.server：HTTP 的 framing 会让"吞吐"里混进协议解析
    成本，而基线的对象是 TCP 数据面本身。
    """

    def __init__(self) -> None:
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind(("127.0.0.1", 0))
        self._sock.listen(128)
        # Closing a listening socket in another thread need not interrupt its
        # blocked accept on every host. Bound the wait and join owned workers.
        self._sock.settimeout(0.1)
        self.host, self.port = self._sock.getsockname()
        self._stop = threading.Event()
        self.accepted = threading.Event()
        self._lock = threading.Lock()
        self._connections: set[socket.socket] = set()
        self._workers: set[threading.Thread] = set()
        self._thread = threading.Thread(target=self._serve, daemon=True)
        self._thread.start()

    def _serve(self) -> None:
        while not self._stop.is_set():
            try:
                conn, _ = self._sock.accept()
            except socket.timeout:
                continue
            except OSError:
                return
            with self._lock:
                if self._stop.is_set():
                    conn.close()
                    return
                worker = threading.Thread(target=self._handle, args=(conn,), daemon=True)
                self._connections.add(conn)
                self._workers.add(worker)
                try:
                    worker.start()
                except BaseException:
                    self._connections.discard(conn)
                    self._workers.discard(worker)
                    conn.close()
                    raise
                self.accepted.set()

    def _handle(self, conn: socket.socket) -> None:
        try:
            with conn:
                while True:
                    chunk = conn.recv(65536)
                    if not chunk:
                        return
                    conn.sendall(chunk)
        except OSError:
            return
        finally:
            with self._lock:
                self._connections.discard(conn)
                self._workers.discard(threading.current_thread())

    def close(self) -> None:
        self._stop.set()
        try:
            self._sock.close()
        except OSError:
            pass
        with self._lock:
            connections, workers = list(self._connections), list(self._workers)
        for conn in connections:
            try:
                conn.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            conn.close()
        deadline = time.monotonic() + 2
        for worker in [self._thread, *workers]:
            worker.join(timeout=max(0, deadline - time.monotonic()))
            if worker.is_alive():
                raise RuntimeError("echo target worker did not stop")


# ======================================================================
# Agent 进程控制
# ======================================================================

# ======================================================================
# 假面板（本地、无生产凭据）
# ======================================================================
#
# 为什么要一个假面板，而不是只用 admin API：
#
#   · 真实 Agent 的期望状态是**面板下发**的。只用 admin API 就只能造出
#     "手工塞进去的隧道"，restore / LKG / 重启收敛这几条路径根本没有被走到；
#   · EGRESS 的 target pool 也必须由面板那份 desired 快照建立（restore.Apply
#     在构造 forwarder 之前先把池建好），admin API 没有"创建第一个池"的入口。
#
# 凭据是每次随机生成的本地字符串，只在该进程与 Agent 之间使用，不写入任何产物。
# 面板本身只回三种东西：desired 快照、状态上报 200、其余 404 —— 它不实现任何
# 授权语义，因此也**不能**被误当成"测过面板权限"的证据。

class FakePanel:
    """本地最小面板：按凭据返回该节点的 desired 快照。"""

    def __init__(self) -> None:
        self.desired: dict[str, list[dict]] = {}
        self.version = "perf-1"
        self.state_posts: list[str] = []
        self.port = _free_port()
        self._server: socketserver.ThreadingTCPServer | None = None
        self._thread: threading.Thread | None = None

    # -- lifecycle --
    def start(self) -> None:
        panel = self

        class Handler(http.server.BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *_args) -> None:  # 静音：基线输出要可机读
                return

            def _json(self, code: int, payload: dict) -> None:
                body = json.dumps(payload).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self) -> None:  # noqa: N802 —— BaseHTTPRequestHandler 的约定
                cred = self.headers.get("Authorization", "").removeprefix("Bearer ").strip()
                if self.path == "/api/internal/node/desired":
                    tunnels = panel.desired.get(cred)
                    if tunnels is None:
                        self._json(401, {"error": "unknown credential"})
                        return
                    self._json(200, {"data": {"snapshot": {
                        "version": panel.version, "tunnels": tunnels}}})
                    return
                self._json(404, {"error": "not found"})

            def do_POST(self) -> None:  # noqa: N802
                length = int(self.headers.get("Content-Length") or 0)
                if length:
                    self.rfile.read(length)
                # 只认**真实存在**的端点：`/api/internal/heartbeat` 是 Agent 侧的历史死代码
                # （后端从来没有这个路由，真机计数 80 条/10 分钟），已在 Agent 侧删除。
                # 这里若继续把它算作"可接受路径"，就会让基线记录的 404 计数与真实部署不一致——
                # 而且正是"假面板替真后端撒谎"的那一类。
                if self.path == "/api/internal/node/state":
                    panel.state_posts.append(self.path)
                    self._json(200, {"ok": True})
                    return
                self._json(404, {"error": "not found"})

        class Server(socketserver.ThreadingTCPServer):
            allow_reuse_address = True
            daemon_threads = True

            def handle_error(self, request, client_address) -> None:
                # Killing an Agent mid-request is normal here (that is how the
                # restart scenarios work). The resulting reset is not an error
                # worth printing: it would bury the machine-readable output.
                exc = sys.exc_info()[1]
                if isinstance(exc, (ConnectionResetError, BrokenPipeError)):
                    return
                super().handle_error(request, client_address)

        self._server = Server(("127.0.0.1", self.port), Handler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        if self._server is not None:
            self._server.shutdown()
            self._server.server_close()
            self._server = None
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def set_desired(self, credential: str, tunnels: list[dict], version: str | None = None) -> None:
        self.desired[credential] = tunnels
        if version:
            self.version = version

class AgentProcess:
    """一个跑在本机回环上的 Agent 进程（无面板、无凭据、无外部依赖）。

    admin token 随机生成：基线脚本不应该要求、也不应该留下任何长期有效的
    凭据（§5.4 DoD「不需要生产凭据」「不记录 secrets」）。
    """

    def __init__(self, binary: Path, state_dir: Path, role: str,
                 listen_ip: str = "127.0.0.1", label: str = "agent",
                 panel: "FakePanel | None" = None,
                 profile_enabled: bool = False) -> None:
        self.binary = binary
        self.state_dir = state_dir
        self.role = role
        self.listen_ip = listen_ip
        self.label = label
        # admin token 与面板凭据都是随机的本地字符串：基线脚本不应该要求、
        # 也不应该留下任何长期有效的凭据（§5.4 DoD）。
        self.token = "perf-" + "".join(random.choices("0123456789abcdef", k=24))
        self.credential = "perfcred-" + "".join(random.choices("0123456789abcdef", k=24))
        self.panel = panel
        self.profile_enabled = profile_enabled
        self.agent_id = "".join(random.choices("0123456789abcdef", k=32))
        self.port = _free_port()
        self.proc: subprocess.Popen | None = None
        self.stdout_path = state_dir / f"{label}.log"

    def admin_url(self, path: str) -> str:
        return f"http://127.0.0.1:{self.port}{path}"

    def start(self, wait: bool = True) -> None:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        log = open(self.stdout_path, "ab", buffering=0)
        argv = [
            str(self.binary),
            "--agent-admin-port", str(self.port),
            "--agent-admin-token", self.token,
            "--state-dir", str(self.state_dir),
            "--listen-ip", self.listen_ip,
            "--role", self.role,
            "--node-id", self.label,
            "--agent-id", self.agent_id,
            "--profile=true" if self.profile_enabled else "--profile=false",
        ]
        if self.panel is not None:
            # 面板驱动的期望状态：这才让 restore / LKG / 重启收敛这些路径真的
            # 被走到（只用 admin API 只会造出"手工塞进去的隧道"）。
            argv += [
                "--panel-http-url", self.panel.url,
                "--node-credential", self.credential,
            ]
        self.proc = subprocess.Popen(argv, stdout=log, stderr=subprocess.STDOUT)
        if wait:
            self.wait_admin()

    def wait_admin(self, timeout: float = 20.0) -> None:
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.proc is not None and self.proc.poll() is not None:
                raise RuntimeError(f"{self.label} exited early (see {self.stdout_path})")
            try:
                self.request("GET", "/health")
                return
            except OSError:
                time.sleep(0.05)
        raise TimeoutError(f"{self.label} admin plane did not come up within {timeout}s")

    def request(self, method: str, path: str, body: dict | None = None) -> dict:
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(self.admin_url(path), data=data, method=method)
        req.add_header("Authorization", f"Bearer {self.token}")
        if data is not None:
            req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=20) as res:
            raw = res.read().decode() or "{}"
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"raw": raw}

    def request_bytes(self, path: str) -> bytes:
        req = urllib.request.Request(self.admin_url(path), method="GET")
        req.add_header("Authorization", f"Bearer {self.token}")
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.read()

    def apply_tunnel(self, config: dict) -> dict:
        return self.request("POST", "/tunnel", config)

    def remove_tunnel(self, tunnel_id: str) -> dict:
        return self.request("DELETE", f"/tunnel?id={urllib.parse.quote(tunnel_id)}")

    def runtime_stats(self) -> dict:
        try:
            return self.request("GET", "/debug/runtime")
        except OSError:
            return {}

    def gauge(self) -> dict:
        """CPU / RSS / goroutines 的当前读数。"""
        out = {"goroutines": None, "rss_bytes": None, "cpu_seconds": None, "cpu_ticks": None}
        stats = self.runtime_stats()
        if isinstance(stats.get("goroutines"), int):
            out["goroutines"] = stats["goroutines"]
        try:
            status = Path(f"/proc/{self.proc.pid}/status").read_text()
            for line in status.splitlines():
                if line.startswith("VmRSS:"):
                    out["rss_bytes"] = int(line.split()[1]) * 1024
        except (OSError, IndexError, ValueError):
            pass
        out["cpu_ticks"] = _cpu_ticks(self.proc.pid)
        out["cpu_seconds"] = _cpu_seconds(self.proc.pid)
        return out

    def stop(self, sig: int = signal.SIGTERM, timeout: float = 30.0) -> float:
        """发送信号并等待退出，返回观察到的退出耗时（秒）。"""
        if self.proc is None or self.proc.poll() is not None:
            return 0.0
        started = time.perf_counter()
        self.proc.send_signal(sig)
        try:
            self.proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            self.proc.wait(timeout=10)
        return time.perf_counter() - started

    def kill(self) -> None:
        if self.proc is not None and self.proc.poll() is None:
            self.proc.kill()
            try:
                self.proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                pass


def cpu_hz() -> float:
    """每秒多少个调度 tick（Linux 常见 100，即 10ms 分辨率）。"""
    try:
        return float(os.sysconf("SC_CLK_TCK"))
    except (AttributeError, OSError, ValueError):
        return 100.0


def _cpu_ticks(pid: int) -> int | None:
    """进程累计 CPU（utime + stime），单位是**调度 tick**。

    保留 tick 而不是只给秒：Linux 的 tick 是 10ms 量级，短负载的 CPU 增量会
    不足一个 tick —— 那时"0.0 秒"的真实含义是"低于分辨率"，不是"没测到"。
    产物里同时给出两者，读的人就不会把分辨率限制当成结果。
    """
    try:
        raw = Path(f"/proc/{pid}/stat").read_text()
    except OSError:
        return None
    # comm 字段可能含空格与括号，所以从最后一个 ')' 之后开始切。
    # 切完之后的 index 0 是 **state（字段 3）**，所以字段 N 落在 index N-3：
    #   utime = 字段 14 → index 11
    #   stime = 字段 15 → index 12
    # 写成 13/14 会读到 cutime/cstime（已回收子进程的累计值），对刚启动的进程恒为
    # 0 —— 症状是"CPU 永远是 0.0"，看起来像负载太轻，其实是读了另一列。
    tail = raw[raw.rfind(")") + 2:].split()
    try:
        return int(tail[11]) + int(tail[12])
    except (IndexError, ValueError):
        return None


def _cpu_seconds(pid: int) -> float | None:
    ticks = _cpu_ticks(pid)
    return None if ticks is None else ticks / cpu_hz()


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


# ======================================================================
# 负载生成
# ======================================================================

def transfer_once(host: str, port: int, payload: bytes, timeout: float = 30.0) -> tuple[int, float]:
    """建连 → 写 payload → 读回同样字节 → 关闭。返回 (字节数, 秒)。

    计时从 connect() **之前**开始：§5.4 要的 throughput 是"一次完整业务的
    成本"，把建连排除在外会让重连风暴在数字上消失。
    """
    started = time.perf_counter()
    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.settimeout(timeout)
        sock.sendall(payload)
        received = 0
        want = len(payload)
        while received < want:
            chunk = sock.recv(65536)
            if not chunk:
                break
            received += len(chunk)
    return received, time.perf_counter() - started


def setup_latency_once(host: str, port: int, timeout: float = 10.0) -> float:
    """建连耗时（connect → 连接可用）。"""
    started = time.perf_counter()
    with socket.create_connection((host, port), timeout=timeout):
        return time.perf_counter() - started


def concurrent_round(host: str, port: int, concurrency: int, payload: bytes,
                     timeout: float = 60.0) -> tuple[int, float, list[float]]:
    """同时保持 concurrency 条连接并各跑一次往返。

    返回 (总往返次数, 墙钟秒, 每条连接的往返耗时)。墙钟时间取整轮的，而不是
    单条之和：后者永远只反映"单条有多快"，把并发退化完全藏起来。
    """
    errors: list[Exception] = []
    latencies: list[float] = []
    lock = threading.Lock()
    barrier = threading.Barrier(concurrency)

    def worker() -> None:
        try:
            with socket.create_connection((host, port), timeout=timeout) as sock:
                sock.settimeout(timeout)
                barrier.wait(timeout=timeout)
                started = time.perf_counter()
                sock.sendall(payload)
                received = 0
                while received < len(payload):
                    chunk = sock.recv(65536)
                    if not chunk:
                        break
                    received += len(chunk)
                elapsed = time.perf_counter() - started
                if received != len(payload):
                    raise RuntimeError("concurrent TCP transfer returned a partial payload")
                with lock:
                    latencies.append(elapsed)
        except Exception as exc:  # noqa: BLE001 —— 基线要把失败记成失败，而不是崩掉整轮
            with lock:
                errors.append(exc)

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(concurrency)]
    started = time.perf_counter()
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=timeout + 10)
    wall = time.perf_counter() - started
    if errors:
        raise RuntimeError(f"{len(errors)}/{concurrency} concurrent connections failed: {errors[0]!r}")
    if len(latencies) != concurrency:
        raise RuntimeError("concurrent TCP workload did not finish every connection")
    return len(latencies), wall, latencies


def read_echo(sock: socket.socket, want: int) -> int:
    """从 socket 读满 want 字节（对端提前关闭就返回实际读到的字节数）。"""
    received = 0
    while received < want:
        chunk = sock.recv(65536)
        if not chunk:
            break
        received += len(chunk)
    return received


# ======================================================================
# TLS 前端
# ======================================================================
#
# §6.1：TLS 在**入口 listener** 终止（Go crypto/tls，标准库），握手之后的明文
# 流与今天的 TCP 隧道走完全相同的转发路径；出口节点与跨节点跳不做二次加密。
# 所以这里的客户端只要真的握手、真的传输，测到的就是"客户端多付的那一层成本"。

def openssl_missing_message() -> str:
    """缺 openssl 时的可行动报错（纯字符串：可离线断言）。"""
    return (
        "the tls scenario needs openssl to generate a throwaway self-signed certificate; "
        "no certificate is committed on purpose (a committed one would expire and silently "
        "rot the scenario). Install openssl, or run the scenarios that do not need it: "
        "--scenarios direct relay ws (the default is 'direct relay')."
    )


def certificate_command(openssl: str, cert_path: Path, key_path: Path,
                        cn: str = "tunex-perf-local") -> list[str]:
    """自签证书的命令行。纯函数：形状可离线断言，不触碰机器状态。

    用 EC P-256 而不是 RSA：握手成本低一个数量级，而基线要测的是**入口那一层
    的固定开销**，不是故意把 CPU 烧在 RSA 上（`--profile full` 也不该为了握手等
    几百毫秒）。SAN 写上 127.0.0.1，是为了让手工 `openssl s_client` 复核时不必
    关校验。
    """
    return [
        openssl, "req", "-x509", "-newkey", "ec",
        "-pkeyopt", "ec_paramgen_curve:prime256v1",
        "-nodes", "-keyout", str(key_path), "-out", str(cert_path),
        "-days", "2", "-subj", f"/CN={cn}",
        "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost",
    ]


def generate_self_signed(cert_path: Path, key_path: Path,
                         cn: str = "tunex-perf-local") -> None:
    """生成一对临时自签证书。失败就抛错 —— 绝不"跳过 tls 场景"。"""
    exe = shutil.which("openssl")
    if not exe:
        raise RuntimeError(openssl_missing_message())
    cert_path.parent.mkdir(parents=True, exist_ok=True)
    proc = subprocess.run(certificate_command(exe, cert_path, key_path, cn),
                          capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(
            "openssl failed to generate a self-signed certificate "
            f"(exit {proc.returncode}): {(proc.stderr or proc.stdout).strip()}")
    if not cert_path.exists() or not key_path.exists():
        raise RuntimeError(
            f"openssl reported success but {cert_path} / {key_path} are missing")


def tls_client_context() -> ssl.SSLContext:
    """回环自签证书 → 不校验链与主机名。**只用于本地基线**。

    刻意不做校验：这里量的是数据面成本，不是证书信任链。把临时证书装进系统
    信任库会让"同一命令跑两次可比较"依赖机器状态（§5.4 DoD「不需要生产凭据」）。
    """
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2   # 与 Agent 的 MinVersion 对齐
    return ctx


def tls_transfer_once(host: str, port: int, payload: bytes, timeout: float = 30.0) -> tuple[int, float]:
    """建连 + TLS 握手 → 写 payload → 读回同样字节。返回 (字节数, 秒)。

    计时从 connect() 之前开始，与 TCP 的 `transfer_once` 同口径：TLS 多出来的
    握手成本必须出现在吞吐里，否则"入口换成 TLS 之后吞吐掉了多少"看不见。
    """
    started = time.perf_counter()
    ctx = tls_client_context()
    with socket.create_connection((host, port), timeout=timeout) as raw:
        with ctx.wrap_socket(raw, server_hostname=host) as sock:
            sock.settimeout(timeout)
            sock.sendall(payload)
            received = read_echo(sock, len(payload))
    return received, time.perf_counter() - started


def tls_setup_latency_once(host: str, port: int, timeout: float = 10.0) -> float:
    """建连 + **TLS 握手完成**的耗时。

    TCP 场景的 connect 只量 TCP 建连，所以两者的差就是 TLS 引入的建立成本 ——
    这正是"多一个协议"最该被量到的数字。
    """
    ctx = tls_client_context()
    started = time.perf_counter()
    with socket.create_connection((host, port), timeout=timeout) as raw:
        with ctx.wrap_socket(raw, server_hostname=host):
            pass
    return time.perf_counter() - started


def open_tls_session(host: str, port: int, timeout: float = 60.0) -> socket.socket:
    """并发轮里用的 opener：返回一个握手完成的 TLS socket。"""
    ctx = tls_client_context()
    raw = socket.create_connection((host, port), timeout=timeout)
    try:
        tls = ctx.wrap_socket(raw, server_hostname=host)
    except Exception:
        raw.close()
        raise
    tls.settimeout(timeout)
    return tls


# ======================================================================
# WebSocket 前端（RFC 6455，只用标准库）
# ======================================================================
#
# §6.1：ws 是**客户端流量**的分帧协议。客户端把 payload 装进 masked 帧，Agent
# 解帧后把字节流转给 target；回程字节流由 Agent 重新分帧（服务端帧不掩码）。
# 基线要测的正是"握手 + 分帧/解帧 + 转发"这条完整链路，所以客户端必须真的说
# RFC 6455，而不是事后拿一个封装库把协议成本藏起来。
#
# 为什么手写不装依赖：与采集器本身的约束一致（"可重复" = 在干净机器上可重复），
# 而且服务端那份实现本身就是手写的（agent/internal/forwarder/websocket.go）。
# 协议回归使用相同的 RFC 6455 握手与帧校验语义。

WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
WS_OP_CONTINUATION = 0x0
WS_OP_TEXT = 0x1
WS_OP_BINARY = 0x2
WS_OP_CLOSE = 0x8
WS_OP_PING = 0x9
WS_OP_PONG = 0xA
# 与服务端 wsMaxHandshakeBytes 同量级：握手响应不可能有这么大，超过就是伪装的客户端。
WS_MAX_HANDSHAKE_BYTES = 16 << 10
# 内容校验的探针大小：64 KiB，跨过 126/127 长度前缀分界（65536 用 8 字节长度）。
WS_INTEGRITY_PROBE_BYTES = 1 << 16


def ws_accept_value(key: str) -> str:
    """RFC 6455 §4.2.2 的 Sec-WebSocket-Accept（纯函数，有公开测试向量）。"""
    return base64.b64encode(hashlib.sha1((key + WS_MAGIC).encode()).digest()).decode()


def ws_handshake_request(key: str, host: str = "127.0.0.1", path: str = "/") -> bytes:
    """客户端握手请求（纯函数）。"""
    return (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "\r\n"
    ).encode()


def ws_handshake_ok(head: bytes, key: str) -> tuple[bool, str]:
    """校验握手响应（纯函数）：必须是 101，且 accept 值对得上。

    只看「升级成功」不够：accept 算错的实现对端也会回 101，然后分帧语义对不上，
    症状会变成"吞吐为 0"而不是"握手失败"——把协议错误伪装成性能问题。
    """
    lines = head.decode("latin-1", "replace").split("\r\n")
    status = lines[0] if lines else ""
    if not status.startswith("HTTP/") or " 101" not in status:
        return False, f"no 101 upgrade: {status!r}"
    accepts = [ln.split(":", 1)[1].strip() for ln in lines[1:]
               if ln.lower().startswith("sec-websocket-accept:")]
    if not accepts:
        return False, "response has no Sec-WebSocket-Accept"
    if accepts[0] != ws_accept_value(key):
        return False, f"Sec-WebSocket-Accept mismatch: {accepts[0]!r}"
    return True, "101 + accept ok"


def xor_mask(data: bytes, mask: bytes) -> bytes:
    """按 RFC 6455 §5.3 用 4 字节掩码循环异或（纯函数）。

    用大整数异或而不是逐字节的 Python 循环：逐字节版本处理 64 KiB payload 要
    十几毫秒，会盖过被测系统本身，把"基线"变成"Python 掩码有多慢"。按 4 字节
    对齐后交给 C 层的大整数运算，采集器自身的成本就被压到噪声量级。
    """
    if not data:
        return b""
    if len(mask) != 4:
        raise ValueError("websocket mask must be exactly 4 bytes")
    n = len(data)
    padded = n + (-n) % 4
    chunk = int.from_bytes(data + b"\x00" * (padded - n), "big")
    key = int.from_bytes(mask * (padded // 4), "big")
    return (chunk ^ key).to_bytes(padded, "big")[:n]


def encode_ws_frame(opcode: int, payload: bytes, mask: bytes | None = None,
                    fin: bool = True) -> bytes:
    """编码一帧。`mask=None` = 服务端方向（不掩码）；否则按 RFC 掩码。

    掩码是客户端帧的**强制**要求（RFC 6455 §5.1），漏掉会被 Agent 直接拒连
    （readFrame 里显式拒绝未掩码的客户端帧）——所以在客户端这一侧它不是可选项。
    """
    header = bytearray()
    header.append((0x80 if fin else 0x00) | (opcode & 0x0F))
    length = len(payload)
    masked_bit = 0x80 if mask is not None else 0x00
    if length < 126:
        header.append(masked_bit | length)
    elif length < (1 << 16):
        header.append(masked_bit | 126)
        header += length.to_bytes(2, "big")
    else:
        header.append(masked_bit | 127)
        header += length.to_bytes(8, "big")
    if mask is None:
        return bytes(header) + payload
    return bytes(header) + mask + xor_mask(payload, mask)


def decode_ws_frames(buf: bytes) -> tuple[list[dict], bytes]:
    """解析 buf 前部的完整帧，返回 (frames, 未消费的剩余字节)。

    frames 每项 {fin, opcode, payload, masked}。不足一帧就把尾部原样留下：分帧
    是流式的，一次 recv 很少刚好落在帧边界上，「半帧」是常态而不是错误 ——
    把它当错误处理，会在真实链路（写侧按 32 KiB 切块）上随机失败。
    """
    frames: list[dict] = []
    offset, total = 0, len(buf)
    while total - offset >= 2:
        b0, b1 = buf[offset], buf[offset + 1]
        mask_flag = bool(b1 & 0x80)
        length = b1 & 0x7F
        cursor = offset + 2
        if length == 126:
            if total - cursor < 2:
                break
            length = int.from_bytes(buf[cursor:cursor + 2], "big")
            cursor += 2
        elif length == 127:
            if total - cursor < 8:
                break
            length = int.from_bytes(buf[cursor:cursor + 8], "big")
            cursor += 8
        mask = None
        if mask_flag:
            if total - cursor < 4:
                break
            mask = buf[cursor:cursor + 4]
            cursor += 4
        if total - cursor < length:
            break
        payload = buf[cursor:cursor + length]
        if mask is not None:
            payload = xor_mask(payload, mask)
        frames.append({"fin": bool(b0 & 0x80), "opcode": b0 & 0x0F,
                       "payload": bytes(payload), "masked": mask_flag})
        offset = cursor + length
    return frames, buf[offset:]


class WSClient:
    """一个已握手的 WS 客户端，对调用方暴露**字节流**语义（sendall / recv）。

    Agent 的那一侧也是这样做的（wsConn 实现 net.Conn，上层 pipe 看不见帧），
    所以客户端也只把"解帧后的字节"露出去：这样并发的测量函数可以直接复用
    TCP 的写法，不会为了 WS 再写一套形状略异的统计。

    读侧必须能处理三件真事：握手响应与首个数据帧同段到达、服务端把一份 payload
    切成多帧、以及 ping/close 控制帧（不处理会把"对端在探活"变成"读超时"）。
    """

    def __init__(self, host: str, port: int, timeout: float = 30.0,
                 sock: socket.socket | None = None) -> None:
        self._sock = sock or socket.create_connection((host, port), timeout=timeout)
        self._sock.settimeout(timeout)
        self._wire = b""    # 已收到、未解析的原始字节
        self._plain = b""   # 已解帧、还没交给调用方的业务字节
        self.handshake_ms = 0.0
        self._handshake(host)

    def _recv(self) -> bytes:
        chunk = self._sock.recv(65536)
        if not chunk:
            raise RuntimeError("websocket peer closed the connection")
        return chunk

    def _handshake(self, host: str) -> None:
        started = time.perf_counter()
        key = base64.b64encode(os.urandom(16)).decode()
        self._sock.sendall(ws_handshake_request(key, host))
        head = b""
        while b"\r\n\r\n" not in head:
            head += self._recv()
            if len(head) > WS_MAX_HANDSHAKE_BYTES:
                raise RuntimeError(
                    f"websocket handshake: response head exceeds {WS_MAX_HANDSHAKE_BYTES} bytes")
        raw_head, rest = head.split(b"\r\n\r\n", 1)
        self._wire = rest
        ok, detail = ws_handshake_ok(raw_head + b"\r\n\r\n", key)
        if not ok:
            raise RuntimeError(f"websocket handshake failed: {detail}")
        self.handshake_ms = (time.perf_counter() - started) * 1000

    def _pump(self) -> None:
        """解出至少一帧（必要时再 recv），数据帧进 _plain，控制帧就地处理。"""
        while True:
            frames, self._wire = decode_ws_frames(self._wire)
            if frames:
                for frame in frames:
                    opcode = frame["opcode"]
                    if opcode in (WS_OP_BINARY, WS_OP_TEXT, WS_OP_CONTINUATION):
                        self._plain += frame["payload"]
                    elif opcode == WS_OP_PING:
                        self._sock.sendall(encode_ws_frame(
                            WS_OP_PONG, frame["payload"], mask=os.urandom(4)))
                    elif opcode == WS_OP_CLOSE:
                        raise RuntimeError(
                            "websocket peer sent close before the transfer completed")
                    # pong：探活是对方的事，不回答（与 Agent 的 readFrame 一致）
                return
            chunk = self._sock.recv(65536)
            if not chunk:
                return          # 对端关闭：让 recv() 返回 b""，与 TCP 语义一致
            self._wire += chunk

    def sendall(self, data: bytes) -> None:
        """把整块数据作为**一帧**二进制消息发出（长度前缀由 encode_ws_frame 处理）。"""
        self._sock.sendall(encode_ws_frame(WS_OP_BINARY, data, mask=os.urandom(4)))

    def recv(self, size: int) -> bytes:
        while not self._plain:
            self._pump()
            if not self._plain:
                return b""
        out, self._plain = self._plain[:size], self._plain[size:]
        return out

    def close(self) -> None:
        try:
            self._sock.close()
        except OSError:
            pass

    def __enter__(self) -> "WSClient":
        return self

    def __exit__(self, *_exc) -> None:
        self.close()


def ws_transfer_once(host: str, port: int, payload: bytes, timeout: float = 30.0) -> tuple[int, float]:
    """建连 + WS 握手 → 一帧 masked 消息 → 读回同样多的解帧字节。返回 (字节数, 秒)。

    与 TCP 的 `transfer_once` 同口径（计时含建连）：握手与分帧成本必须出现在
    吞吐数字里，否则"入口换成 WS 之后吞吐掉了多少"看不见。
    """
    started = time.perf_counter()
    with WSClient(host, port, timeout=timeout) as client:
        client.sendall(payload)
        received = read_echo(client, len(payload))  # type: ignore[arg-type]
    return received, time.perf_counter() - started


def ws_setup_latency_once(host: str, port: int, timeout: float = 10.0) -> float:
    """建连 + WS 握手（101 + accept 校验通过）的耗时。"""
    started = time.perf_counter()
    with WSClient(host, port, timeout=timeout):
        pass
    return time.perf_counter() - started


def ws_echo_matches(host: str, port: int, payload: bytes, timeout: float = 30.0) -> bool:
    """把 payload 走一遍隧道，比较**内容**是否逐字节相同。

    吞吐只数字节数：一个把 payload 解错了（例如忘了解掩码）的隧道同样会"回满
    N 字节"，数字看起来完全健康。所以 WS 场景在采集吞吐之前先做一次内容校验，
    不通过就直接失败——在错误的字节流上量出来的吞吐比没有数字更坏。
    """
    try:
        with WSClient(host, port, timeout=timeout) as client:
            client.sendall(payload)
            got = b""
            while len(got) < len(payload):
                chunk = client.recv(65536)
                if not chunk:
                    break
                got += chunk
    except Exception:  # noqa: BLE001 —— 校验失败就是 False，调用方负责报错
        return False
    return got == payload


def measure_ws_integrity(topology: dict) -> dict:
    """WS 场景的**前置**校验（每次真实采集都会跑）。

    用 64 KiB 作为探针：它正好跨过 RFC 6455 的 126/127 长度前缀分界（65536 需要
    8 字节长度），所以这一次往返同时证明了扩展长度字段的实现是对的。
    """
    if not ws_echo_matches("127.0.0.1", topology["listen_port"], os.urandom(WS_INTEGRITY_PROBE_BYTES)):
        raise RuntimeError(
            "ws scenario: the bytes echoed through the tunnel do not match what was sent; "
            "refusing to measure throughput over a corrupted stream")
    return {"ws_echo_integrity": True}


def open_ws_session(host: str, port: int, timeout: float = 60.0) -> WSClient:
    """并发轮里用的 opener：返回一个握手完成的 WSClient。"""
    return WSClient(host, port, timeout=timeout)


def concurrent_session_round(host: str, port: int, concurrency: int, payload: bytes,
                             opener: Callable[[str, int, float], object],
                             timeout: float = 60.0) -> tuple[int, float, list[float]]:
    """`concurrent_round` 的会话版本：每条连接用自己的 opener 建立（TLS/WS 握手）。

    与 TCP 版本保持同样的口径：墙钟取**整轮**（含握手），单连接往返从"发送前"
    开始计。这样并发下的退化不会被平均掉。opener 返回已可读写 socket 或 WSClient
    （两者都提供 sendall/recv 的字节流语义）。
    """
    errors: list[Exception] = []
    latencies: list[float] = []
    lock = threading.Lock()
    barrier = threading.Barrier(concurrency)

    def worker() -> None:
        try:
            session = opener(host, port, timeout)
            try:
                barrier.wait(timeout=timeout)
                started = time.perf_counter()
                session.sendall(payload)                     # type: ignore[attr-defined]
                received = 0
                while received < len(payload):
                    chunk = session.recv(65536)              # type: ignore[attr-defined]
                    if not chunk:
                        break
                    received += len(chunk)
                elapsed = time.perf_counter() - started
                with lock:
                    latencies.append(elapsed)
            finally:
                close = getattr(session, "close", None)
                if callable(close):
                    close()
        except Exception as exc:  # noqa: BLE001 —— 失败要记成失败，不是崩掉整轮
            with lock:
                errors.append(exc)

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(concurrency)]
    started = time.perf_counter()
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=timeout + 10)
    wall = time.perf_counter() - started
    if errors:
        raise RuntimeError(
            f"{len(errors)}/{concurrency} concurrent sessions failed: {errors[0]!r}")
    return len(latencies), wall, latencies


# ======================================================================
# 场景
# ======================================================================

def direct_topology(binary: Path, root: Path, profile_enabled: bool = False) -> dict:
    """DIRECT：client → ingress agent → echo target（面板驱动的期望状态）。"""
    target = EchoTarget()
    panel = FakePanel()
    panel.start()
    ingress = AgentProcess(binary, root / "ingress", role="INGRESS", label="ingress", panel=panel,
                           profile_enabled=profile_enabled)
    listen_port = _free_port()
    panel.set_desired(ingress.credential, [{
        "id": "perf-direct",
        "mode": "DIRECT",
        "protocol": "tcp",
        "ingress_port": listen_port,
        "remote_host": target.host,
        "remote_port": target.port,
        "revision": 1,
    }])
    try:
        ingress.start()
        wait_listener("127.0.0.1", listen_port)
    except Exception:
        _teardown({"agents": [ingress], "target": target, "panel": panel})
        raise
    return {"target": target, "panel": panel, "ingress": ingress,
            "listen_port": listen_port, "agents": [ingress], "probe_port": listen_port}


def relay_topology(binary: Path, root: Path, profile_enabled: bool = False) -> dict:
    """RELAY：client → ingress → egress agent → echo target。

    两台**独立进程**：同进程里跑 RELAY+EGRESS 会把两端 CPU 混成一份读数，也让
    "入口进程重启"这类测量失去意义。回环上的两台进程虽然不是跨机网络，但它真实地
    走完 RELAY 的两跳与两个 listener，且 EGRESS 的 target pool 由面板那份 desired
    快照建立（restore.Apply 在构造 forwarder 之前先建池）。
    """
    target = EchoTarget()
    panel = FakePanel()
    panel.start()
    ingress = AgentProcess(binary, root / "ingress", role="INGRESS", label="ingress", panel=panel,
                           profile_enabled=profile_enabled)
    egress = AgentProcess(binary, root / "egress", role="EGRESS", label="egress", panel=panel,
                          profile_enabled=profile_enabled)

    egress_port = _free_port()
    # 出口先起（§1.3 铁律一），入口再指向它。
    panel.set_desired(egress.credential, [{
        "id": "perf-egress",
        "mode": "EGRESS",
        "protocol": "tcp",
        "egress_port": egress_port,
        "targets": [{"host": target.host, "port": target.port}],
        "lb_strategy": "ROUND_ROBIN",
        "revision": 1,
    }])
    listen_port = _free_port()
    panel.set_desired(ingress.credential, [{
        "id": "perf-relay",
        "mode": "RELAY",
        "protocol": "tcp",
        "ingress_port": listen_port,
        "next_hop": f"127.0.0.1:{egress_port}",
        "targets": [{"host": "127.0.0.1", "port": egress_port}],
        "revision": 1,
    }])
    try:
        egress.start()
        ingress.start()
        wait_listener("127.0.0.1", listen_port)
    except Exception:
        _teardown({"agents": [ingress, egress], "target": target, "panel": panel})
        raise
    return {"target": target, "panel": panel, "ingress": ingress, "egress": egress,
            "listen_port": listen_port, "agents": [ingress, egress], "probe_port": listen_port}


def stream_topology(binary: Path, root: Path, tunnel: dict, profile_enabled: bool = False) -> dict:
    """DIRECT 形态的通用拓扑：入口 Agent + 回环 echo target，配置由面板下发。

    与 `direct_topology` 的步骤逐条一致，只是隧道配置由调用方给出（TLS 需要证书
    路径、WS 只是换一个协议名）。**没有**改写 `direct_topology`：那条路径是已冻结
    的 TCP 参照，保持它逐字节不变比消除这点重复更重要。
    """
    target = EchoTarget()
    panel = FakePanel()
    panel.start()
    ingress = AgentProcess(binary, root / "ingress", role="INGRESS", label="ingress", panel=panel,
                           profile_enabled=profile_enabled)
    listen_port = _free_port()
    config = dict(tunnel, ingress_port=listen_port,
                  remote_host=target.host, remote_port=target.port)
    panel.set_desired(ingress.credential, [config])
    try:
        ingress.start()
        wait_listener("127.0.0.1", listen_port)
    except Exception:
        _teardown({"agents": [ingress], "target": target, "panel": panel})
        raise
    return {"target": target, "panel": panel, "ingress": ingress,
            "listen_port": listen_port, "agents": [ingress],
            "probe_port": listen_port, "config": config}


def tls_topology(binary: Path, root: Path, profile_enabled: bool = False) -> dict:
    """TLS 场景拓扑：入口 listener 是一个 TLS server，证书是临时自签的。"""
    cert_path = root / "certs" / "perf.crt"
    key_path = root / "certs" / "perf.key"
    generate_self_signed(cert_path, key_path)
    return stream_topology(binary, root / "topology", {
        "id": "perf-tls",
        "mode": "DIRECT",
        "protocol": "tls",
        "tls_cert_path": str(cert_path),
        "tls_key_path": str(key_path),
        "revision": 1,
    }, profile_enabled=profile_enabled)


def ws_topology(binary: Path, root: Path, profile_enabled: bool = False) -> dict:
    """WS 场景拓扑：入口 listener 是一个 RFC 6455 server，握手后转发解帧字节。"""
    return stream_topology(binary, root / "topology", {
        "id": "perf-ws",
        "mode": "DIRECT",
        "protocol": "ws",
        "revision": 1,
    }, profile_enabled=profile_enabled)


def wait_listener(host: str, port: int, timeout: float = 30.0) -> float:
    """等到端口真的能建连为止，返回耗时（秒）。

    不能只看 admin API 起来了：admin 监听与数据面 bind 是两件事，前者先可用。
    """
    started = time.perf_counter()
    deadline = started + timeout
    last: Exception | None = None
    while time.perf_counter() < deadline:
        try:
            with socket.create_connection((host, port), timeout=2):
                return time.perf_counter() - started
        except OSError as exc:
            last = exc
            time.sleep(0.02)
    raise TimeoutError(f"listener {host}:{port} never accepted a connection: {last!r}")


def measure_throughput(topology: dict, workers_profile: dict, prefix: str,
                       transfer: Callable[[str, int, bytes], tuple[int, float]] = transfer_once) -> dict:
    """`transfer` 默认是 TCP；tls / ws 场景传入各自的那一个（口径相同：计时含建连）。"""
    payload = os.urandom(workers_profile["payload_kib"] * 1024)
    samples = [
        transfer("127.0.0.1", topology["listen_port"], payload)
        for _ in range(workers_profile["transfers"])
    ]
    if any(received != len(payload) for received, _ in samples):
        raise RuntimeError("throughput workload returned a partial payload")
    summary = summarize_throughput(samples)
    return {f"{prefix}_throughput": summary.to_json()}


def measure_connection_setup(topology: dict, profile: dict, prefix: str,
                             setup: Callable[[str, int], float] = setup_latency_once) -> dict:
    """`setup` 默认只量 TCP 建连；tls / ws 传入"建连 + 各自握手"的那一个。"""
    samples = [
        setup("127.0.0.1", topology["listen_port"])
        for _ in range(profile["setups"])
    ]
    summary = Summary.of([s * 1000 for s in samples], "ms")
    return {f"{prefix}_connect_ms": summary.to_json()}


def measure_concurrency(topology: dict, profile: dict, prefix: str,
                        round_fn: Callable[..., tuple[int, float, list[float]]] = concurrent_round,
                        opener: Callable[[str, int, float], object] | None = None) -> dict:
    """`round_fn` 默认是 TCP 的 `concurrent_round`；tls / ws 用带 opener 的会话版本。"""
    payload = os.urandom(4096)
    rounds, latencies = [], []
    for _ in range(profile["conn_rounds"]):
        if opener is None:
            count, wall, per_conn = round_fn(
                "127.0.0.1", topology["listen_port"], profile["concurrency"], payload)
        else:
            count, wall, per_conn = round_fn(
                "127.0.0.1", topology["listen_port"], profile["concurrency"], payload, opener)
        if count != profile["concurrency"] or len(per_conn) != count:
            raise RuntimeError("concurrent workload did not finish every connection")
        rounds.append((count * len(payload), wall))
        latencies.extend(per_conn)
    return {
        f"{prefix}_concurrent_throughput": summarize_throughput(rounds).to_json(),
        f"{prefix}_concurrent_rtt_ms": Summary.of([s * 1000 for s in latencies], "ms").to_json(),
        f"{prefix}_concurrency": profile["concurrency"],
    }


def measure_gauges(topology: dict, baseline_gauges: dict | None = None,
                   current_gauges: dict | None = None) -> dict:
    """CPU / RSS / goroutines 的**结束读数**，以及整轮负载的 CPU 增量。

    两次读数（负载前 / 负载后）之差才是有意义的 CPU 数字：单次读数只是一个累计值，
    和本轮测试无关。`or None` 那种写法在这里是陷阱——CPU 增量恰好为 0.0 会被当成
    "没测到"，所以这里显式判断 None。
    """
    out: dict = {}
    total_cpu: float | None = None
    for agent in topology["agents"]:
        current = agent.gauge() if current_gauges is None else current_gauges[agent.label]
        out[f"{agent.label}_gauges"] = current
        before = (baseline_gauges or {}).get(agent.label, {})
        after_seconds, before_seconds = current.get("cpu_seconds"), before.get("cpu_seconds")
        after_ticks, before_ticks = current.get("cpu_ticks"), before.get("cpu_ticks")
        if before_seconds is not None and after_seconds is not None:
            delta = after_seconds - before_seconds
            out[f"{agent.label}_cpu_seconds_used"] = delta
            total_cpu = delta if total_cpu is None else total_cpu + delta
        if before_ticks is not None and after_ticks is not None:
            out[f"{agent.label}_cpu_ticks_used"] = after_ticks - before_ticks
    out["agents_cpu_seconds_used_total"] = total_cpu
    if total_cpu is not None:
        out["cpu_resolution_note"] = (
            "CPU 分辨率是一个调度 tick（%.1f ms）；读数为 0 表示本次负载的 CPU 时间"
            "低于该分辨率，而不是没有测到。需要可读的 CPU 数字时用 --profile full。"
            % (1000.0 / cpu_hz())
            if total_cpu == 0.0
            else "ok"
        )
    return out


def collect_gauges(topology: dict) -> dict:
    """负载开始前的读数（供 measure_gauges 做差）。"""
    return {agent.label: agent.gauge() for agent in topology["agents"]}


def await_stream_quiescence(topology: dict, before: dict, timeout: float = 15.0,
                            quiet_seconds: float = 1.0) -> tuple[dict, dict]:
    """Wait for workload workers to return to the pre-load goroutine counts.

    A setup call only establishes the ingress socket; downstream workers can
    still be starting or exiting after the client closes. Sampling immediately
    counts this transient work. Sustained excess workers instead fail closed;
    the harness never substitutes a minimum or zero for an observed gauge.
    """
    ceilings = {agent.label: before[agent.label].get("goroutines") for agent in topology["agents"]}
    if any(not isinstance(n, int) or isinstance(n, bool) or n <= 0 for n in ceilings.values()):
        raise RuntimeError("pre-load goroutine gauges are unavailable")
    started = time.perf_counter()
    quiet_since = None
    polls = 0
    while True:
        current = collect_gauges(topology)
        polls += 1
        now = time.perf_counter()
        counts = {label: gauge.get("goroutines") for label, gauge in current.items()}
        if any(not isinstance(n, int) or isinstance(n, bool) or n <= 0 for n in counts.values()):
            raise RuntimeError("post-load goroutine gauges are unavailable")
        if all(counts[label] <= ceiling for label, ceiling in ceilings.items()):
            if quiet_since is None:
                quiet_since = now
            if now - quiet_since >= quiet_seconds:
                return current, {"elapsed_seconds": now - started, "polls": polls,
                                 "before_goroutines": ceilings, "after_goroutines": counts}
        else:
            quiet_since = None
        if now - started >= timeout:
            raise RuntimeError("stream workload did not return to pre-load goroutine counts")
        time.sleep(0.05)


def capture_profiles(topology: dict, out_dir: Path, scenario: str,
                     seconds: int = 1, workload: Callable[[], None] | None = None) -> dict:
    """Capture profiles in a separate load phase; retain failed receipts too.

    CPU and trace must see real payload work, not the idle interval after the
    benchmark. One worker keeps that workload running throughout captures.
    Files have a unique directory per call so older receipts stay readable.
    """
    if not 1 <= seconds <= 20:
        raise ValueError("profile seconds must be between 1 and 20")
    out_dir.mkdir(parents=True, exist_ok=True)
    capture_root = Path(tempfile.mkdtemp(prefix="profiles-", dir=out_dir)) / scenario
    stop, ready = threading.Event(), threading.Event()
    stats = {"phase": "separate_profile_load" if workload else "snapshot_only",
             "transfers": 0, "errors": 0}

    def load() -> None:
        while not stop.is_set():
            try:
                assert workload is not None
                workload()
                stats["transfers"] += 1
            except Exception as exc:
                stats["errors"] += 1
                stats["error_type"] = type(exc).__name__
                ready.set()
                return
            ready.set()

    agents = topology["agents"]
    captured = {agent.label: {} for agent in agents}

    def capture(agent: AgentProcess, name: str, endpoint: str, suffix: str) -> None:
        path = capture_root / agent.label / (name + suffix)
        path.parent.mkdir(parents=True, exist_ok=True)
        entry: dict = {}
        if name in ("cpu", "trace"):
            entry["seconds"] = seconds
        try:
            payload = agent.request_bytes(endpoint)
            if not payload:
                raise RuntimeError("empty profile")
            path.write_bytes(payload)
            entry.update(path=str(path), bytes=len(payload))
        except (OSError, RuntimeError, urllib.error.URLError) as exc:
            # Raw errors can contain URLs/headers. Receipts keep bounded facts.
            entry["error_type"] = type(exc).__name__
            if isinstance(exc, urllib.error.HTTPError):
                entry["http_status"] = exc.code
                exc.close()
        captured[agent.label][name] = entry

    worker = threading.Thread(target=load, daemon=True) if workload else None
    if worker:
        worker.start()
    try:
        if worker and not ready.wait(timeout=10):
            stats["errors"] += 1
            stats["error_type"] = "LoadStartTimeout"
        # Every measured Agent observes the same CPU/trace interval.
        with ThreadPoolExecutor(max_workers=max(1, len(agents))) as executor:
            for name, endpoint, suffix in (
                ("cpu", f"/debug/pprof/profile?seconds={seconds}", ".pprof"),
                ("trace", f"/debug/pprof/trace?seconds={seconds}", ".trace"),
                *((name, f"/debug/pprof/{name}?debug=0", ".pprof")
                  for name in PROFILE_CAPTURE_NAMES),
            ):
                futures = [executor.submit(capture, agent, name, endpoint, suffix)
                           for agent in agents]
                for future in futures:
                    future.result()
    finally:
        stop.set()
        if worker:
            worker.join(timeout=10)
            if worker.is_alive():
                stats["errors"] += 1
                stats["error_type"] = "LoadStopTimeout"
    passed = bool(agents) and stats["errors"] == 0 and all(
        "error_type" not in entry for profiles in captured.values() for entry in profiles.values())
    return {"passed": passed, "load": stats, "agents": captured}


def profile_workload(topology: dict, scenario: str, profile: dict) -> Callable[[], None]:
    payload = os.urandom(profile["payload_kib"] * 1024)
    transfer = PROTOCOL_TRANSFER[SCENARIO_PROTOCOL[scenario]]

    def run_transfer() -> None:
        received, _ = transfer("127.0.0.1", topology["listen_port"], payload, timeout=5)
        if received != len(payload):
            raise RuntimeError("profile workload returned a partial payload")

    return run_transfer


# ── 场景注册表 ──
#
# 场景名既是 JSON 的 key，也是所有指标的前缀，所以它必须能区分协议：
# direct / relay 是 TCP，tls 与 ws 各自一个场景（§5.4「每个协议各有自己的场景」）。

SCENARIO_PROTOCOL = {
    "direct": "tcp",
    "relay": "tcp",
    "tls": "tls",
    "ws": "ws",
}

PROTOCOL_TRANSFER: dict[str, Callable[[str, int, bytes], tuple[int, float]]] = {
    "tcp": transfer_once,
    "tls": tls_transfer_once,
    "ws": ws_transfer_once,
}

PROTOCOL_SETUP: dict[str, Callable[[str, int], float]] = {
    "tcp": setup_latency_once,
    "tls": tls_setup_latency_once,
    "ws": ws_setup_latency_once,
}

# 只有需要"会话建立"的协议才用并发 opener：TCP 的并发轮保持原样（已冻结的参照）。
PROTOCOL_OPENER: dict[str, Callable[[str, int, float], object]] = {
    "tls": open_tls_session,
    "ws": open_ws_session,
}


def scenario_factory(scenario: str) -> Callable[[Path, Path], dict]:
    """场景名 → 拓扑构造函数。新增场景必须在这里显式登记。"""
    factories: dict[str, Callable[[Path, Path], dict]] = {
        "direct": direct_topology,
        "relay": relay_topology,
        "tls": tls_topology,
        "ws": ws_topology,
    }
    try:
        factory = factories[scenario]
    except KeyError:
        raise ValueError(f"unknown scenario {scenario!r}") from None

    def build(binary: Path, root: Path, profile_enabled: bool = False) -> dict:
        # 只有显式 --capture-profiles 时拓扑才带 --profile 启动；默认基线
        # 保持生产形态的 Agent（无 profiling 端点）。
        return factory(binary, root, profile_enabled=profile_enabled)

    return build


def measure_stream_scenario(scenario: str, topology: dict, profile: dict) -> dict:
    """三种协议共用的一条流水线：吞吐 / 并发 / 建连。

    差异全部收敛到"用哪个 transfer / setup / opener"，统计口径与产物形状完全一致
    —— 这样 tls 与 direct 的数字才有可比性，而"可比"正是基线存在的意义。
    """
    protocol = SCENARIO_PROTOCOL[scenario]
    out: dict = {f"{scenario}_error_count": 0}
    if protocol == "ws":
        # 先证明字节流是**对的**，再谈它有多快（见 measure_ws_integrity）。
        out.update(measure_ws_integrity(topology))
    out.update(measure_throughput(topology, profile, scenario, PROTOCOL_TRANSFER[protocol]))
    if protocol == "tcp":
        out.update(measure_concurrency(topology, profile, scenario))
    else:
        out.update(measure_concurrency(topology, profile, scenario,
                                       concurrent_session_round, PROTOCOL_OPENER[protocol]))
    # TCP setup only waits for the ingress handshake. Hundreds of immediately
    # closed clients can leave downstream dials/accepts in progress; measuring
    # payload afterwards would mix that backlog into its RTT distribution.
    out.update(measure_connection_setup(topology, profile, scenario, PROTOCOL_SETUP[protocol]))
    return out


def measure_hot_reload(topology: dict, profile: dict, prefix: str) -> dict:
    """同一隧道换 target（revision+1）→ 新 target 生效的耗时。

    这是 §13.3.4「Target Host / Port 无影响变更」的**性能**侧面：热替换不重建
    listener，所以它必须显著快于一次完整重建。脚本只记录耗时，不判定阈值。
    """
    agent: AgentProcess = topology["ingress"]
    samples = []
    for i in range(profile["hot_reload_samples"]):
        alt = EchoTarget()
        try:
            cfg = {
                "id": "perf-direct",
                "mode": "DIRECT",
                "protocol": "tcp",
                "ingress_port": topology["listen_port"],
                "remote_host": alt.host,
                "remote_port": alt.port,
                "revision": 100 + i,
            }
            started = time.perf_counter()
            agent.apply_tunnel(cfg)
            applied = time.perf_counter() - started
            # 新目标真的要能用：只在 apply 返回后就宣布成功，会把"没生效"测成
            # "很快"。这里必须等一次真实往返穿过新 upstream。
            payload = b"hot-reload"
            received, _ = transfer_once("127.0.0.1", topology["listen_port"], payload)
            if received != len(payload) or not alt.accepted.is_set():
                raise RuntimeError("hot reload did not reach the new echo target")
            effective = time.perf_counter() - started
            samples.append((applied, effective))
        finally:
            alt.close()
    return {
        f"{prefix}_hot_reload_apply_ms": Summary.of([s[0] * 1000 for s in samples], "ms").to_json(),
        f"{prefix}_hot_reload_effective_ms": Summary.of([s[1] * 1000 for s in samples], "ms").to_json(),
    }


def measure_restart_convergence(binary: Path, root: Path, factory: Callable[[Path, Path], dict],
                                prefix: str, rounds: int = 3) -> dict:
    """重启 Agent → 端口重新可用的耗时，分两条路径分别测（§5.4）。

    · `panel` 变体：重启期间面板可达 → 期望状态来自面板（正常重连路径）；
    · `lkg`   变体：重启期间面板不可达 → 走本地 last-known-good 快照（§1.6
      耐久性路径）。

    两者必须分开测：合成一个数字就看不出"面板回来时能收敛"和"面板不在时还能不能
    自己站起来"哪一条退化了 —— 而这恰好是 durability 的两个不同承诺。

    计时从**进程创建**开始，而不是等 admin API 起来之后再计时：启动顺序是
    管理器 → restore → admin API，等 admin 就等于等 restore 已经做完，测到的会是
    接近 0 毫秒的假数字。这里量的就是"从拉起进程到数据面重新收连接"。
    """
    out: dict = {}
    for variant in ("panel", "lkg"):
        samples: list[float] = []
        sources: list[str] = []
        for i in range(rounds):
            topology = factory(binary, root / f"restart-{variant}-{i}")
            try:
                agent: AgentProcess = topology["ingress"]
                panel: FakePanel = topology["panel"]
                agent.kill()
                if variant == "lkg":
                    # 制造真实的"面板不可达"（连接被拒 = FetchUnreachable），
                    # 而不是让 Agent 去连一个不存在的地址：那是另一种故障。
                    panel.stop()
                marker = count_restore_lines(agent)
                agent.start(wait=False)
                samples.append(wait_listener("127.0.0.1", topology["listen_port"]))
                # 监听器在 restore 内部就 bind 好了，而 "v3 restore done" 这行日志
                # 是 restore 返回之后才写的 —— 直接读会读到**上一次**启动的行，把
                # LKG 归因成 panel。这里等本次启动的那一行出现再取。
                sources.append(wait_restore_source(agent, marker))
            finally:
                _teardown(topology)
                shutil.rmtree(root / f"restart-{variant}-{i}", ignore_errors=True)
        if samples:
            out[f"{prefix}_restart_{variant}_ms"] = Summary.of([s * 1000 for s in samples], "ms").to_json()
            out[f"{prefix}_restart_{variant}_sources"] = sorted(set(s for s in sources if s))
    return out


def count_restore_lines(agent: AgentProcess) -> int:
    """本次启动前，日志里已经有多少行 "v3 restore done"。"""
    try:
        text = agent.stdout_path.read_text()
    except OSError:
        return 0
    return sum(1 for line in text.splitlines() if "v3 restore done" in line)


def wait_restore_source(agent: AgentProcess, previous: int, timeout: float = 10.0) -> str:
    """等待并读出**本次**启动的期望状态来源（panel / lkg）。

    来源归因是"耐久性路径真的被走到了"的证据，所以不能靠猜：必须等到本次启动
    新写的那一行。读不到就返回空串（产物里表现为缺失），而不是沿用上一次的值。
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            lines = [ln for ln in agent.stdout_path.read_text().splitlines() if "v3 restore done" in ln]
        except OSError:
            lines = []
        if len(lines) > previous:
            # 取**最后**一行：前面那些是本轮更早一次启动留下的（第一次启动走的是
            # 面板，重启走的才是 LKG）。取第一行会把 LKG 归因成 panel，
            # 于是"耐久性路径真的被走到了"这条证据就变成了假证据。
            for line in reversed(lines):
                if "source=" in line:
                    source = line.rsplit("source=", 1)[1].strip()
                    if source:
                        return source
            return ""
        time.sleep(0.05)
    return ""


def measure_graceful_drain(binary: Path, root: Path, prefix: str, rounds: int = 3) -> dict:
    """SIGTERM → 进程退出的耗时，分「空载」与「有在途连接」两种（§5.4）。

    两者都要测：空载退出量的是进程收尾开销，**有在途连接**退出量的是有界排空本身。
    只测空载会把排空完全漏掉（数字看起来永远很漂亮），只测有在途连接则看不出
    排空上限是否被写死成了兜底值。有界排空的天花板是 10s，所以"有在途连接"的
    中位数接近 10s 是**预期**结果，不是退化。
    """
    out: dict = {}
    idle: list[float] = []
    held: list[float] = []
    for i in range(rounds):
        topology = direct_topology(binary, root / f"drain-{i}")
        try:
            idle.append(topology["ingress"].stop(signal.SIGTERM, timeout=30))
        finally:
            _teardown(topology)

        topology = direct_topology(binary, root / f"drain-held-{i}")
        try:
            holder = socket.create_connection(("127.0.0.1", topology["listen_port"]), timeout=10)
            try:
                holder.sendall(b"hold")
                holder.recv(4)
                held.append(topology["ingress"].stop(signal.SIGTERM, timeout=30))
            finally:
                holder.close()
        finally:
            _teardown(topology)
    out[f"{prefix}_graceful_drain_idle_ms"] = Summary.of([s * 1000 for s in idle], "ms").to_json()
    out[f"{prefix}_graceful_drain_held_ms"] = Summary.of([s * 1000 for s in held], "ms").to_json()
    return out


def _teardown(topology: dict) -> None:
    for agent in topology.get("agents", []):
        agent.kill()
    target = topology.get("target")
    if target is not None:
        target.close()
    panel = topology.get("panel")
    if panel is not None:
        panel.stop()


# ======================================================================
# 环境信息（可复现性的一半在这个字段里）
# ======================================================================

def environment(binary: Path | None) -> dict:
    env = {
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "machine": platform.machine(),
        "cpu_count": os.cpu_count(),
        "kernel": platform.uname().release,
        "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "cpu_tick_seconds": 1.0 / cpu_hz(),
    }
    try:
        env["loadavg"] = list(os.getloadavg())
    except (AttributeError, OSError):
        env["loadavg"] = None
    try:
        env["cpu_model"] = next(
            line.split(":", 1)[1].strip()
            for line in Path("/proc/cpuinfo").read_text().splitlines()
            if line.startswith("model name")
        )
    except (OSError, StopIteration):
        env["cpu_model"] = None
    # 容器里跑基线时 CPU 配额才是真正的核数：不记录它，跨机器比较就没有意义。
    for quota_path, label in (
        ("/sys/fs/cgroup/cpu.max", "cgroup_cpu_max"),
        ("/sys/fs/cgroup/memory.max", "cgroup_memory_max"),
    ):
        try:
            env[label] = Path(quota_path).read_text().strip()
        except OSError:
            env[label] = None
    if binary is not None:
        env["agent_version"] = _cmd([str(binary), "--version"])
        env["go_version"] = _cmd(["go", "version"]) or None
        # The installed Go executable may target a different architecture from
        # the measured binary (e.g. a 386 tool building amd64 on Windows).
        build_info = _cmd(["go", "version", "-m", str(binary)])
        lines = build_info.splitlines()
        env["agent_go_version"] = lines[0].rsplit(": ", 1)[-1] if lines else None
        env["agent_build_settings"] = {}
        for line in lines[1:]:
            fields = line.split()
            if len(fields) == 2 and fields[0] == "build" and "=" in fields[1]:
                key, value = fields[1].split("=", 1)
                if key in ("GOARCH", "GOOS", "GOAMD64", "GOARM64", "CGO_ENABLED"):
                    env["agent_build_settings"][key] = value
        env["agent_binary_sha256"] = hashlib.sha256(binary.read_bytes()).hexdigest()
    env["git_rev"] = _cmd(["git", "rev-parse", "HEAD"])
    env["git_dirty"] = bool(_cmd(["git", "status", "--porcelain"]))
    # TLS 场景的证书是 openssl 现场生成的，所以它的版本是这条场景可复现性的一部分。
    env["openssl_version"] = _cmd(["openssl", "version"]) or None
    return env


def _cmd(args: Sequence[str], cwd: Path | None = None) -> str:
    try:
        out = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.SubprocessError):
        return ""
    return out.stdout.strip()


# ======================================================================
# 入口
# ======================================================================

def run(args: argparse.Namespace) -> dict:
    binary = Path(args.agent_binary).resolve()
    if not binary.exists():
        raise SystemExit(f"agent binary not found: {binary} (build it first, or pass --agent-binary)")

    profile = dict(PROFILES[args.profile])
    profile["stream_phase_order"] = list(STREAM_PHASE_ORDER)
    profile["resource_phase"] = "after_stream_quiescence"
    profile["hot_reload_verification"] = "target_accept_and_complete_payload"
    if args.payload_kib is not None:
        profile["payload_kib"] = args.payload_kib
    if args.setups is not None:
        profile["setups"] = args.setups
    result: dict = {
        "schema_version": SCHEMA_VERSION,
        "kind": "stream-baseline",
        "profile": args.profile,
        "workload": profile,
        "dimensions": {
            "message_size_bytes": profile["payload_kib"] * 1024,
            "connection_count": profile["concurrency"],
            "rtt_ms": args.rtt_ms,
            "packet_loss_percent": args.packet_loss_percent,
            "network_shaping": False,
        },
        "environment": environment(binary),
        "profiles_enabled": bool(args.capture_profiles),
        "scenarios": {},
        "profiling": {},
        "quiescence": {},
    }

    root = Path(tempfile.mkdtemp(prefix="tunex-perf-"))
    try:
        for scenario in args.scenarios:
            topology = scenario_factory(scenario)(binary, root / scenario,
                                                  profile_enabled=args.capture_profiles)
            try:
                key = scenario
                result["scenarios"][key] = {}
                before = collect_gauges(topology)
                result["scenarios"][key].update(
                    measure_stream_scenario(scenario, topology, profile))
                # The resource delta covers the timed stream workload, excluding
                # profiling and lifecycle operations which have separate phases.
                after, result["quiescence"][key] = await_stream_quiescence(topology, before)
                result["scenarios"][key].update(measure_gauges(topology, before, after))
                if args.capture_profiles:
                    result["profiling"][key] = capture_profiles(
                        topology, Path(args.out), key, args.profile_seconds,
                        profile_workload(topology, key, profile))
                if scenario == "direct":
                    # 热重载与重启收敛只跑 DIRECT：它们的对象是"单节点上的
                    # 生命周期"，在 RELAY 上重跑只是把同一个数字测两遍。
                    result["scenarios"][key].update(measure_hot_reload(topology, profile, scenario))
            finally:
                _teardown(topology)

        # 热重载 / 重启收敛 / 排空是**三种协议共用**的 stream 运行时路径，只在
        # tcp 的 direct 场景上测一次。守卫 is-not-None 是必要的：`--scenarios tls ws`
        # 时 scenarios 里根本没有 direct 这个 key（旧代码在这种情况下会 KeyError）。
        if "direct" in result["scenarios"]:
            result["scenarios"]["direct"].update(
                measure_restart_convergence(binary, root, direct_topology, "direct"))
            result["scenarios"]["direct"].update(
                measure_graceful_drain(binary, root, "direct"))
    finally:
        shutil.rmtree(root, ignore_errors=True)

    return result


def write_outputs(result: dict, out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    json_path = out_dir / f"stream-baseline-{stamp}.json"
    csv_path = out_dir / f"stream-baseline-{stamp}.csv"
    json_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")

    rows = list(flatten_metrics(result))
    with csv_path.open("w", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["scenario", "metric", "value"])
        writer.writerows(rows)
    return json_path, csv_path


def flatten_metrics(result: dict) -> Iterable[tuple[str, str, object]]:
    """把嵌套结果摊平成 (scenario, metric, value) —— JSON 仍是权威格式。"""
    for scenario, metrics in result.get("scenarios", {}).items():
        for name, value in sorted(metrics.items()):
            if isinstance(value, dict) and "median" in value:
                for stat in ("median", "p95", "p99", "min", "max", "mean", "count"):
                    if value.get(stat) is not None:
                        yield scenario, f"{name}.{stat}", value[stat]
            else:
                yield scenario, name, value


# These are deliberately relative checks.  Shared CI runners do not provide a
# stable absolute throughput or latency floor, while a fixed anchor still
# catches an accidental order-of-magnitude regression.  A caller can tighten
# the default with --max-regression for a pinned host.
def _is_higher_better(metric: str) -> bool:
    return "throughput" in metric


def _scalar_metrics(metrics: dict) -> Iterable[tuple[str, float]]:
    """Yield scalar resource/error gauges while Summary fields are handled separately."""
    def walk(prefix: str, value: object) -> Iterable[tuple[str, float]]:
        if isinstance(value, dict):
            if "median" in value:
                return
            for key, child in value.items():
                child_name = f"{prefix}.{key}" if prefix else key
                yield from walk(child_name, child)
        elif isinstance(value, (int, float)):
            # Preserve malformed bool gauges so validation can reject them;
            # coercing True to 1.0 would fabricate an observed measurement.
            yield prefix, value if isinstance(value, bool) else float(value)

    for name, value in metrics.items():
        if name.endswith("_profiles"):
            continue
        if isinstance(value, dict) and "median" in value:
            continue
        yield from walk(name, value)


def compare_results(candidate: dict, anchor: dict, max_regression: float = 0.20) -> dict:
    """Compare shared numeric summary fields and return a machine-readable gate.

    The anchor is allowed to use schema v1 so the checked-in TCP artifact can
    be reused after this schema adds p99.  Missing metrics are reported rather
    than silently treated as zero; this keeps a partial scenario from passing.
    """
    if not 0 <= max_regression < 1:
        raise ValueError("max_regression must be in [0, 1)")
    for artifact in (candidate, anchor):
        if not isinstance(artifact, dict) or artifact.get("schema_version") not in (1, SCHEMA_VERSION):
            raise ValueError("unsupported artifact schema")
        if artifact.get("profile") not in PROFILES:
            raise ValueError("artifact profile is required")
        for key in ("workload", "scenarios"):
            if not isinstance(artifact.get(key), dict):
                raise ValueError(f"artifact {key} must be an object")
        if "stream_phase_order" in artifact["workload"] and artifact["workload"]["stream_phase_order"] not in (
                STREAM_PHASE_ORDER, LEGACY_STREAM_PHASE_ORDER):
            raise ValueError("unknown stream measurement phase order")
        if "resource_phase" in artifact["workload"] and artifact["workload"]["resource_phase"] not in (
                "end_of_workload", "after_stream_quiescence"):
            raise ValueError("unknown resource measurement phase")
        if artifact.get("go_sample_order", "batched") not in ("batched", "alternating_process_pairs"):
            raise ValueError("unknown Go benchmark sample order")
        count = artifact["workload"].get("hot_reload_samples")
        if "hot_reload_samples" in artifact["workload"] and (type(count) is not int or not 1 <= count <= 1000):
            raise ValueError("hot reload sample count must be an integer in [1, 1000]")
        if artifact["workload"].get("hot_reload_verification", "echo_without_target_check") not in (
                "echo_without_target_check", "target_accept_and_complete_payload"):
            raise ValueError("unknown hot reload verification mode")
        for key in ("environment", "dimensions"):
            if key in artifact and not isinstance(artifact[key], dict):
                raise ValueError(f"artifact {key} must be an object")
    if candidate.get("kind") != "stream-baseline" or anchor.get("kind") != "stream-baseline":
        raise ValueError("both artifacts must have kind=stream-baseline")
    if candidate.get("profile") != anchor.get("profile"):
        raise ValueError("candidate and anchor profiles must match")

    workload_mismatch = []
    for key in ("payload_kib", "concurrency", "conn_rounds", "conn_timeouts", "transfers", "setups"):
        if key not in candidate["workload"] or key not in anchor["workload"] or candidate["workload"][key] != anchor["workload"][key]:
            workload_mismatch.append(key)
    if candidate["workload"].get("stream_phase_order", LEGACY_STREAM_PHASE_ORDER) != anchor["workload"].get(
            "stream_phase_order", LEGACY_STREAM_PHASE_ORDER):
        workload_mismatch.append("stream_phase_order")
    if candidate["workload"].get("resource_phase", "end_of_workload") != anchor["workload"].get(
            "resource_phase", "end_of_workload"):
        workload_mismatch.append("resource_phase")
    # Legacy quick/full collected only 8/20 samples per native round. Never
    # compare their tails with a new workload's larger lifecycle population.
    def hot_reload_count(artifact: dict) -> int:
        workload = artifact["workload"]
        if "hot_reload_samples" in workload:
            return workload["hot_reload_samples"]
        legacy = workload.get("conn_timeouts")
        return min(legacy // 4 + 1, 20) if type(legacy) is int and legacy > 0 else 0

    if hot_reload_count(candidate) != hot_reload_count(anchor):
        workload_mismatch.append("hot_reload_samples")
    if candidate["workload"].get("hot_reload_verification", "echo_without_target_check") != anchor["workload"].get(
            "hot_reload_verification", "echo_without_target_check"):
        workload_mismatch.append("hot_reload_verification")
    if candidate.get("go_sample_order", "batched") != anchor.get("go_sample_order", "batched"):
        workload_mismatch.append("go_sample_order")
    if bool(candidate.get("profiles_enabled", False)) != bool(anchor.get("profiles_enabled", False)):
        workload_mismatch.append("profiles_enabled")
    if candidate.get("native_rounds", 1) != anchor.get("native_rounds", 1):
        workload_mismatch.append("native_rounds")
    for key, value in anchor.get("dimensions", {}).items():
        if candidate.get("dimensions", {}).get(key) != value:
            workload_mismatch.append(f"dimensions.{key}")
    environment_mismatch = []
    for key in ("platform", "machine", "cpu_count", "cpu_model", "go_version",
                "agent_go_version", "agent_build_settings", "cgroup_cpu_max", "cgroup_memory_max"):
        value = anchor.get("environment", {}).get(key)
        if value is not None and candidate.get("environment", {}).get(key) != value:
            environment_mismatch.append(key)

    checks: list[dict] = []
    missing: list[str] = []
    invalid: list[str] = []

    def numeric(value: object) -> bool:
        return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)

    def check(name: str, before: object, after: object, enforced: bool = True) -> None:
        if not numeric(before):
            invalid.append(f"anchor.{name}")
            return
        if not numeric(after):
            missing.append(name)
            return
        before, after = float(before), float(after)
        change = (after - before) / abs(before) if before else None
        higher = _is_higher_better(name)
        if before == 0:
            regressed = after < 0 if higher else after > 0
        else:
            regressed = change < -max_regression if higher else change > max_regression
        checks.append({"metric": name, "anchor": before, "candidate": after,
                       "relative_change": change, "regressed": regressed, "enforced": enforced})

    for scenario, anchor_metrics in anchor.get("scenarios", {}).items():
        if not isinstance(anchor_metrics, dict):
            invalid.append(f"anchor.{scenario}")
            continue
        candidate_metrics = candidate.get("scenarios", {}).get(scenario)
        if not isinstance(candidate_metrics, dict):
            missing.append(f"{scenario}.*")
            continue
        for name, anchor_value in anchor_metrics.items():
            if not isinstance(anchor_value, dict) or "median" not in anchor_value:
                continue
            candidate_value = candidate_metrics.get(name)
            if not isinstance(candidate_value, dict) or "median" not in candidate_value:
                missing.append(f"{scenario}.{name}")
                continue
            if anchor_value.get("unit") != candidate_value.get("unit"):
                workload_mismatch.append(f"{scenario}.{name}.unit")
            for side, value in (("anchor", anchor_value), ("candidate", candidate_value)):
                if not numeric(value.get("count")) or value["count"] <= 0:
                    invalid.append(f"{side}.{scenario}.{name}.count")
                artifact = anchor if side == "anchor" else candidate
                if name.endswith(("_hot_reload_apply_ms", "_hot_reload_effective_ms")) and value.get("count") != (
                        hot_reload_count(artifact) * artifact.get("native_rounds", 1)):
                    invalid.append(f"{side}.{scenario}.{name}.count")
            if anchor_value.get("count") != candidate_value.get("count"):
                workload_mismatch.append(f"{scenario}.{name}.count")
            for stat in ("median", "p95", "p99"):
                # Schema v1 has no p99; absent anchor fields cannot define a gate.
                if stat not in anchor_value:
                    if stat != "p99" or anchor["schema_version"] != 1:
                        invalid.append(f"anchor.{scenario}.{name}.{stat}")
                    continue
                # Go ns/op is a whole-run average, not a per-operation latency
                # sample. Its five-run tails are reported, while median is gated.
                check(f"{scenario}.{name}.{stat}", anchor_value[stat], candidate_value.get(stat),
                      enforced=scenario != "go_transport" or stat == "median")
        candidate_scalars = dict(_scalar_metrics(candidate_metrics))
        for name, before in _scalar_metrics(anchor_metrics):
            check(f"{scenario}.{name}", before, candidate_scalars.get(name))

    if not checks:
        invalid.append("no_comparable_metrics")

    regressions = [item for item in checks if item["regressed"] and item["enforced"]]
    return {
        "kind": "stream-baseline-comparison",
        "schema_version": SCHEMA_VERSION,
        "profile": candidate.get("profile"),
        "max_regression": max_regression,
        "workload_mismatch": workload_mismatch,
        "environment_mismatch": environment_mismatch,
        "invalid": invalid,
        "passed": not regressions and not missing and not workload_mismatch and not environment_mismatch and not invalid,
        "regressions": regressions,
        "run_distribution_variations": [item for item in checks if item["regressed"] and not item["enforced"]],
        "missing": missing,
        "checks": checks,
    }


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="TuneX stream performance baseline (tcp/tls/ws)")
    parser.add_argument("--agent-binary", default="agent/tunex-agent",
                        help="path to the built tunex-agent binary")
    parser.add_argument("--setups", type=int, default=None,
                        help="override the connection setup sample count")
    parser.add_argument("--out", default="scripts/perf/results",
                        help="output directory for the JSON/CSV artifacts")
    parser.add_argument("--profile", choices=sorted(PROFILES), default="quick")
    parser.add_argument("--payload-kib", type=int, default=None,
                        help="override the message size recorded and measured (positive KiB)")
    parser.add_argument("--capture-profiles", action="store_true",
                        help="start the measured Agents with --profile and save pprof "
                             "artifacts (CPU/trace/heap/allocs/goroutine/mutex/block/threadcreate) "
                             "next to the JSON artifact")
    parser.add_argument("--profile-seconds", type=int, default=1,
                        help="duration for CPU/trace profiles when --capture-profiles is set")
    parser.add_argument("--rtt-ms", type=float, default=None,
                        help="record an externally injected RTT; this harness does not shape it")
    parser.add_argument("--packet-loss-percent", type=float, default=None,
                        help="record externally observed/injected loss; this harness does not shape it")
    parser.add_argument("--compare", type=Path, default=None,
                        help="compare the result with a JSON anchor and fail on regressions")
    parser.add_argument("--max-regression", type=float, default=0.20,
                        help="relative regression tolerated by --compare (default: 0.20)")
    parser.add_argument("--scenarios", nargs="+", choices=["direct", "relay", "tls", "ws"],
                        default=["direct", "relay"],
                        help="direct/relay are TCP; tls and ws are stream fronts "
                             "(tls needs openssl)")
    parser.add_argument("--json", action="store_true", help="also print the JSON artifact to stdout")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    if args.setups is not None and args.setups <= 0:
        print("error: --setups must be positive", file=sys.stderr)
        return 2
    if args.payload_kib is not None and args.payload_kib <= 0:
        print("error: --payload-kib must be positive", file=sys.stderr)
        return 2
    if not 1 <= args.profile_seconds <= 20:
        print("error: --profile-seconds must be between 1 and 20", file=sys.stderr)
        return 2
    if args.rtt_ms is not None and args.rtt_ms < 0:
        print("error: --rtt-ms must be non-negative", file=sys.stderr)
        return 2
    if args.packet_loss_percent is not None and not 0 <= args.packet_loss_percent <= 100:
        print("error: --packet-loss-percent must be between 0 and 100", file=sys.stderr)
        return 2
    if not 0 <= args.max_regression < 1:
        print("error: --max-regression must be in [0, 1)", file=sys.stderr)
        return 2
    try:
        result = run(args)
    except RuntimeError as exc:
        # 已知的、可行动的环境/配置失败（例如缺 openssl）：给一条干净的错误，
        # 而不是让读的人在一堆 traceback 的最后一行里找原因。退出码非 0，
        # 所以脚本化调用不会把"没测成"当成"测过了"。
        print(f"error: {exc}", file=sys.stderr)
        return 2
    json_path, csv_path = write_outputs(result, Path(args.out))
    if any(not receipt["passed"] for receipt in result.get("profiling", {}).values()):
        print(f"error: profiling or its workload failed (receipt: {json_path})", file=sys.stderr)
        return 4
    if args.compare is not None:
        try:
            anchor = json.loads(args.compare.read_text(encoding="utf-8"))
            comparison = compare_results(result, anchor, args.max_regression)
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            print(f"error: unable to compare baseline: {exc}", file=sys.stderr)
            return 2
        comparison_path = json_path.with_name(json_path.stem + "-comparison.json")
        comparison_path.write_text(json.dumps(comparison, indent=2, sort_keys=True) + "\n")
        print(f"baseline comparison: {comparison_path}")
        if not comparison["passed"]:
            print("error: performance baseline regression or missing metric", file=sys.stderr)
            return 3
    if args.json:
        print(json.dumps(result, indent=2, sort_keys=True))
    print(f"baseline JSON: {json_path}")
    print(f"baseline CSV:  {csv_path}")
    for scenario, metrics in result["scenarios"].items():
        tput = metrics.get(f"{scenario}_throughput", {})
        median = tput.get("median")
        print(f"  {scenario}: throughput median={median if median is None else round(median, 2)} MiB/s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
