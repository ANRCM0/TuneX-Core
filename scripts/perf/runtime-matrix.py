#!/usr/bin/env python3
"""Real runtime payload matrix/soak, with isolated Linux netem and receipt audit."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import subprocess
import sys
import time

KINDS = ("plain_tcp", "plain_udp", "native_relay", "tst_tcp", "tst_udp", "tst_mixed")
SIZES = (64, 1400, 16384)
CONDITIONS = {"clean": (0, 0), "delay": (20, 0), "loss": (20, 1)}
ROOT = Path(__file__).resolve().parents[2]


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def run(argv: list[str], *, cwd: Path = ROOT, env: dict | None = None, timeout=300):
    return subprocess.run(argv, cwd=cwd, env=env, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=timeout)


def command(argv: list[str], **kwargs) -> str:
    result = run(argv, **kwargs)
    if result.returncode:
        raise RuntimeError(f"{Path(argv[0]).name} exited {result.returncode}")
    return result.stdout


def quantile(values: list[float], p: float) -> float:
    ordered = sorted(values)
    rank = (len(ordered) - 1) * p
    lo, hi = math.floor(rank), math.ceil(rank)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (rank - lo)


def number(value, *, integer=False, positive=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("missing/nonfinite numeric measurement")
    if value < 0 or positive and value <= 0 or integer and not isinstance(value, int):
        raise ValueError("invalid numeric measurement")
    return value


def audit(receipt: dict, case: dict) -> dict:
    if receipt.get("kind") != "tunex-runtime-performance" or receipt.get("schema_version") != 1:
        raise ValueError("unexpected runtime receipt schema")
    if receipt.get("case") != case or receipt.get("passed") is not True:
        raise ValueError("failed or mismatched workload")
    if receipt.get("latency_sampling") != "uniform_reservoir_10000_per_protocol_pcg_1_2_3_4":
        raise ValueError("unrecognized latency sampling")
    elapsed = number(receipt["elapsed_seconds"], positive=True)
    if case["duration_seconds"] and elapsed < case["duration_seconds"]:
        raise ValueError("soak shorter than declared duration")
    kind = case["kind"]
    protocols = {"tcp", "udp"} if kind == "tst_mixed" else {"udp" if kind.endswith("udp") else "tcp"}
    metrics = receipt["metrics"]
    if set(metrics) != protocols:
        raise ValueError("missing protocol population")
    if any(number(v, integer=True) for v in receipt["corrupt"].values()):
        raise ValueError("payload corruption")
    total, failures = 0, 0
    for protocol, metric in metrics.items():
        count = number(metric["completed"], integer=True, positive=True)
        errors = number(metric["errors"], integer=True)
        if errors != receipt["errors"].get(protocol, 0) or metric["corrupt"] != 0:
            raise ValueError("inconsistent error count")
        if errors and not (kind == "plain_udp" and case["loss_percent"] > 0):
            raise ValueError("unexpected runtime errors")
        total += count
        failures += errors
        if not case["duration_seconds"]:
            connections = case["connections"]
            if kind == "tst_mixed":
                connections = (connections + 1) // 2 if protocol == "tcp" else connections // 2
            if count + errors != connections * case["rounds"]:
                raise ValueError("incomplete protocol exchange population")
        latency = metric["rtt_ms"]
        samples = latency["samples"]
        if latency["count"] != len(samples) or len(samples) != min(10000, count):
            raise ValueError("incomplete latency samples")
        for value in samples:
            # Windows clocks can quantize fast loopback exchanges to zero;
            # retain that raw observation rather than manufacturing precision.
            number(value)
        for key, p in (("median", .5), ("p95", .95), ("p99", .99)):
            if not math.isclose(number(latency[key]), quantile(samples, p), rel_tol=1e-9, abs_tol=1e-9):
                raise ValueError("latency quantile does not match raw samples")
        expected = count * case["bytes"] * 2 / (1 << 20) / elapsed
        if not math.isclose(number(metric["roundtrip_mib_s"]), expected, rel_tol=1e-9):
            raise ValueError("throughput does not match payload population")
        if kind.startswith("tst_"):
            accounted = receipt["accounted_bytes"].get("101" if protocol == "tcp" else "102", {})
            if any(number(accounted.get(key), integer=True) < count * case["bytes"] for key in ("in", "out")):
                raise ValueError("durable accounting omitted completed bytes")
    if not case["duration_seconds"] and total + failures != case["connections"] * case["rounds"]:
        raise ValueError("incomplete exchange population")
    if kind.startswith("tst_") and receipt["durable_accounting"] is not True:
        raise ValueError("missing durable accounting")
    resources = receipt["resources"]
    if len(resources) < 2 or len(resources) < case["duration_seconds"] - 1:
        raise ValueError("incomplete periodic resource observations")
    previous = -1
    linux = receipt["platform"] == "linux/amd64"
    for gauge in [receipt["initial"], *resources, receipt["after_cleanup"]]:
        stamp = number(gauge["elapsed_seconds"])
        if stamp < previous:
            raise ValueError("unordered resource observations")
        previous = stamp
        for key in ("goroutines", "heap_alloc_bytes", "heap_objects"):
            number(gauge[key], integer=True)
        for key in ("rss_bytes", "fd_count", "cpu_ticks"):
            if gauge[key] is not None or linux:
                number(gauge[key])
    initial, after = receipt["initial"], receipt["after_cleanup"]
    if after["goroutines"] > initial["goroutines"] + 1:
        raise ValueError("goroutines did not quiesce")
    if initial["fd_count"] is not None and after["fd_count"] > initial["fd_count"] + 1:
        raise ValueError("FDs did not quiesce")
    shaped = case["rtt_ms"] > 0 or case["loss_percent"] > 0
    shape = receipt["netem"]
    packets, drops = 0, 0
    if shaped:
        if not linux or shape.get("mode") != "netem" or shape.get("cleanup") != "qdisc_deleted":
            raise ValueError("missing actual isolated netem")
        if shape["rtt_ms"] != case["rtt_ms"] or shape["loss_percent"] != case["loss_percent"]:
            raise ValueError("shaping differs from requested condition")
        carrier = "udp" if kind == "plain_udp" else "tcp"
        if shape["protocol"] != carrier or shape["interface"] != "lo" or not shape["netns"].startswith("net:["):
            raise ValueError("wrong shaped carrier")
        qdisc = [entry for entry in shape["qdisc_stats"] if entry.get("kind") == "netem" and entry.get("handle") == "30:"]
        if len(qdisc) != 1:
            raise ValueError("missing netem qdisc statistics")
        packets = number(qdisc[0]["packets"], integer=True, positive=True)
        drops = number(qdisc[0]["drops"], integer=True)
        netem = next((cmd for cmd in shape["commands"] if "netem" in cmd), None)
        if netem is None or netem[netem.index("delay") + 1] != f'{case["rtt_ms"] / 2:.3f}ms' or netem[netem.index("loss") + 1] != f'{case["loss_percent"]:.3f}%':
            raise ValueError("incorrect netem configuration")
        if str(shape["carrier_port"]) not in shape["filter_stats"]:
            raise ValueError("carrier classifier absent")
        if case["rtt_ms"] and any(m["rtt_ms"]["median"] < case["rtt_ms"] * .8 for m in metrics.values()):
            raise ValueError("measured latency did not traverse the configured delay")
    elif shape.get("mode") != "unshaped":
        raise ValueError("unexpected shaping")
    return {"completed": total, "errors": failures, "error_rate": failures / (total + failures),
            "shaped_packets": packets, "netem_drops": drops, "quantiles_recomputed": True,
            "payload_accounting_checked": kind.startswith("tst_"), "resources_quiescent": True}


def namespace_case(binary: Path, case_path: Path) -> int:
    """Called only by unshare; never change host interfaces/qdiscs."""
    if sys.platform != "linux":
        raise ValueError("network namespaces require Linux")
    own = os.readlink("/proc/self/ns/net")
    if own == os.readlink("/proc/1/ns/net"):
        raise ValueError("refusing host network namespace")
    command(["ip", "link", "set", "lo", "up"])
    case = json.loads(case_path.read_text(encoding="utf-8"))
    env = dict(os.environ, TUNEX_PERF_NETNS=own, TUNEX_PERF_CASE=str(case_path), GOMAXPROCS="4")
    return subprocess.call([str(binary), "-test.run=^TestPerformanceCase$", "-test.count=1",
                            f'-test.timeout={case["duration_seconds"] + 240}s'], env=env)


def cases(args, out: Path) -> list[dict]:
    rtt, loss = CONDITIONS[args.condition]
    population = [(kind, size, max(connections, 2) if kind == "tst_mixed" else connections)
                  for kind in args.kinds for size in (SIZES if args.mode == "matrix" else (1400,))
                  for connections in ((1, 8) if args.mode == "matrix" else (8,))]
    return [{"kind": kind, "bytes": size, "connections": connections,
             "rounds": 32 if args.condition == "clean" else 16,
             "duration_seconds": args.duration if args.mode == "soak" else 0,
             "rtt_ms": rtt, "loss_percent": loss,
             "output": str(out / f"{kind}-{size}-{connections}.json")}
            for kind, size, connections in population]


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--mode", choices=("matrix", "soak"), default="matrix")
    p.add_argument("--condition", choices=CONDITIONS, default="clean")
    p.add_argument("--kinds", choices=KINDS, nargs="+", default=list(KINDS))
    p.add_argument("--duration", type=int, default=600, help="soak seconds, 2..1800")
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--binary", type=Path, help="reuse an already compiled test binary")
    p.add_argument("--netns-case", type=Path, help=argparse.SUPPRESS)
    args = p.parse_args(argv)
    if args.netns_case:
        return namespace_case(args.binary.resolve(), args.netns_case.resolve())
    if not 2 <= args.duration <= 1800 or len(set(args.kinds)) != len(args.kinds):
        p.error("invalid duration or duplicate topology")
    if args.condition != "clean" and sys.platform != "linux":
        p.error("actual shaping requires Linux; no metadata-only fallback")
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    binary = args.binary.resolve() if args.binary else out / ("runtime.test.exe" if os.name == "nt" else "runtime.test")
    env = dict(os.environ, GOARCH="amd64", GOMAXPROCS="4", CGO_ENABLED="0", GOTOOLCHAIN="local")
    receipt = {"kind": "tunex-runtime-matrix", "schema_version": 1, "mode": args.mode,
               "condition": args.condition, "platform": platform.platform(), "cases": [], "passed": False,
               "scope": "isolated in-process production runtimes, not multi-host deployment"}
    host_before = None
    started = time.monotonic()
    try:
        receipt["source_sha"] = command(["git", "rev-parse", "HEAD"]).strip()
        receipt["source_dirty"] = bool(command(["git", "status", "--porcelain", "--", "agent", "scripts/perf", ".github/workflows/performance.yml"]).strip())
        receipt["source_hashes"] = {str(path.relative_to(ROOT)).replace("\\", "/"): hashlib.sha256(path.read_bytes()).hexdigest()
                                  for path in sorted((ROOT / "agent").rglob("*.go"))}
        if not args.binary:
            command(["go", "test", "-c", "-trimpath", "-buildvcs=false", "-o", str(binary), "./internal/tstruntime"], cwd=ROOT / "agent", env=env)
        receipt["binary_sha256"] = hashlib.sha256(binary.read_bytes()).hexdigest()
        receipt["binary_source_verification"] = "external_binary_hash_only" if args.binary else "built_from_recorded_worktree"
        receipt["go_version"] = command(["go", "version"]).strip()
        if sys.platform == "linux":
            host_before = json.loads(command(["tc", "-j", "qdisc", "show", "dev", "lo"]))
            receipt["host_qdisc_before"] = host_before
        for case in cases(args, out):
            case_path = Path(case["output"]).with_suffix(".case.json")
            write_json(case_path, case)
            if sys.platform == "linux":
                cmd = ["unshare", "--net", sys.executable, str(Path(__file__).resolve()), "--out", str(out),
                       "--binary", str(binary), "--netns-case", str(case_path)]
                if os.geteuid() != 0:
                    cmd = ["sudo", "-n", *cmd]
            else:
                cmd = [str(binary), "-test.run=^TestPerformanceCase$", "-test.count=1",
                       f'-test.timeout={case["duration_seconds"] + 240}s']
            result = run(cmd, env=dict(env, TUNEX_PERF_CASE=str(case_path)), timeout=case["duration_seconds"] + 260)
            Path(case["output"]).with_suffix(".stdout.txt").write_text(result.stdout + result.stderr, encoding="utf-8")
            item = {"case": case, "exit_code": result.returncode, "passed": False}
            receipt["cases"].append(item)
            try:
                raw_path = Path(case["output"])
                item["audit"] = audit(json.loads(raw_path.read_text(encoding="utf-8")), case)
                item["receipt_sha256"] = hashlib.sha256(raw_path.read_bytes()).hexdigest()
                item["passed"] = result.returncode == 0
            except (ValueError, OSError, KeyError, TypeError) as exc:
                item["error_type"] = type(exc).__name__
                item["error"] = str(exc) if isinstance(exc, ValueError) else "receipt unavailable or invalid"
            write_json(out / "matrix.json", receipt)
            print(f'{case["kind"]} bytes={case["bytes"]} connections={case["connections"]}: {"PASS" if item["passed"] else "FAIL"}', flush=True)
        if args.condition == "loss" and not any(item.get("audit", {}).get("netem_drops", 0) > 0 for item in receipt["cases"]):
            raise ValueError("loss matrix recorded no actual netem drops")
        receipt["passed"] = all(item["passed"] for item in receipt["cases"])
    except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired) as exc:
        receipt["error_type"] = type(exc).__name__
        receipt["error"] = str(exc) if isinstance(exc, (ValueError, RuntimeError)) else "build or measurement failed"
    finally:
        if host_before is not None:
            try:
                after = json.loads(command(["tc", "-j", "qdisc", "show", "dev", "lo"]))
                receipt["host_qdisc_after"] = after
                receipt["host_qdisc_unchanged"] = after == host_before
                receipt["passed"] = receipt["passed"] and after == host_before
            except Exception:
                receipt["host_qdisc_unchanged"] = False
                receipt["passed"] = False
        receipt["elapsed_seconds"] = time.monotonic() - started
        write_json(out / "matrix.json", receipt)
    return 0 if receipt["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
