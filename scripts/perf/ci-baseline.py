#!/usr/bin/env python3
"""Compare two committed Agent builds on one runner, using one measurement harness."""
from __future__ import annotations

import argparse
import importlib.util
import io
import json
import math
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tempfile
import zipfile

spec = importlib.util.spec_from_file_location("stream_baseline_ci", Path(__file__).with_name("stream-baseline.py"))
baseline = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = baseline
spec.loader.exec_module(baseline)

BENCHMARKS = {
    "securelink": ("PlainTCP", "TSTMutualTLS", "TSTStream"),
    "tstruntime": ("PlainUDP", "TSTLoopbackTCP", "TSTLoopbackUDP"),
}
UNITS = {"ns/op": "latency_ns", "MB/s": "throughput_mb_s",
         "B/op": "allocated_bytes", "allocs/op": "allocation_count"}


def benchmark_metrics(raw: str, count: int) -> dict:
    samples: dict[str, dict[str, list[float]]] = {}
    for line in raw.splitlines():
        fields = line.split()
        if not fields or not fields[0].startswith("Benchmark"):
            continue
        match = re.fullmatch(r"Benchmark([A-Za-z0-9]+)-[0-9]+", fields[0])
        if not match or len(fields) < 4 or (len(fields) - 2) % 2:
            raise ValueError("malformed Go benchmark sample")
        name = match.group(1)
        for index in range(2, len(fields), 2):
            value, unit = float(fields[index]), fields[index + 1]
            if not math.isfinite(value) or value < 0 or unit not in UNITS:
                raise ValueError("invalid Go benchmark measurement")
            samples.setdefault(name, {}).setdefault(unit, []).append(value)
    if set(samples) != {name for names in BENCHMARKS.values() for name in names}:
        raise ValueError("missing or unexpected Go benchmark")
    metrics = {}
    for name, values in samples.items():
        if set(values) != set(UNITS) or any(len(items) != count for items in values.values()):
            raise ValueError("incomplete Go benchmark sample count or units")
        for unit, items in values.items():
            metrics[f"{name}_{UNITS[unit]}"] = baseline.Summary.of(items, unit).to_json()
    return metrics


def command(argv: list[str], cwd: Path, env: dict) -> str:
    result = subprocess.run(argv, cwd=cwd, env=env, capture_output=True, text=True, timeout=600)
    if result.returncode:
        # No raw process errors/Agent configuration in published receipts.
        raise RuntimeError(f"{Path(argv[0]).name} failed with exit code {result.returncode}")
    return result.stdout


def export_agent(repo: Path, sha: str, dest: Path) -> Path:
    archived = subprocess.run(["git", "archive", "--format=zip", sha, "agent"],
                              cwd=repo, capture_output=True, check=True).stdout
    with zipfile.ZipFile(io.BytesIO(archived)) as archive:
        for member in archive.infolist():
            path = PurePosixPath(member.filename)
            if path.is_absolute() or ".." in path.parts or not path.parts or path.parts[0] != "agent":
                raise ValueError("archive path outside Agent export")
        archive.extractall(dest)
    return dest / "agent"


def measure(repo: Path, sha: str, root: Path, out: Path, env: dict, args) -> dict:
    agent = export_agent(repo, sha, root)
    binary = root / ("tunex-agent.exe" if os.name == "nt" else "tunex-agent")
    command(["go", "build", "-buildvcs=false", "-o", str(binary), "."], agent, env)
    stream_args = baseline.parse_args(["--agent-binary", str(binary), "--out", str(out),
                                       "--profile", args.profile, "--scenarios", *args.scenarios])
    artifact = baseline.run(stream_args)
    artifact["environment"]["source_sha"] = sha
    raw = []
    for package, names in BENCHMARKS.items():
        raw.append(command(["go", "test", f"./internal/{package}", "-run", "^$",
                            "-bench", "^Benchmark(" + "|".join(names) + ")$", "-benchmem",
                            "-benchtime", args.benchtime, "-count", str(args.count)], agent, env))
    benchmark_raw = "\n".join(raw)
    out.mkdir(parents=True, exist_ok=True)
    (out / "go-benchmarks.txt").write_text(benchmark_raw, encoding="utf-8")
    artifact["scenarios"]["go_transport"] = benchmark_metrics(benchmark_raw, args.count)
    baseline.write_outputs(artifact, out)
    return artifact


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="exact baseline commit SHA")
    parser.add_argument("--head", required=True, help="exact candidate commit SHA")
    parser.add_argument("--out", default="scripts/perf/results/ci")
    parser.add_argument("--profile", choices=baseline.PROFILES, default="quick")
    parser.add_argument("--scenarios", nargs="+", choices=["direct", "relay"], default=["direct", "relay"])
    parser.add_argument("--count", type=int, default=5)
    parser.add_argument("--benchtime", default="500ms")
    parser.add_argument("--max-regression", type=float, default=0.35)
    args = parser.parse_args(argv)
    if not all(re.fullmatch(r"[0-9a-fA-F]{40}", sha) for sha in (args.base, args.head)):
        parser.error("--base and --head must be full commit SHAs")
    if args.count < 3 or not 0 <= args.max_regression < 1:
        parser.error("at least three benchmark samples and a threshold in [0, 1) are required")
    repo = Path(__file__).resolve().parents[2]
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, GOPROXY="off")
    scratch = repo / "scripts/perf/.bin"
    scratch.mkdir(parents=True, exist_ok=True)
    receipt = {"kind": "same-runner-performance-gate", "base_sha": args.base,
               "head_sha": args.head, "passed": False}
    try:
        # Separate exports and output directories preserve both sides. Both are
        # measured sequentially with the candidate harness on this exact host.
        root = Path(tempfile.mkdtemp(prefix="ci-pair-", dir=scratch))
        artifacts = [measure(repo, sha, root / side, out / side, env, args)
                     for side, sha in (("anchor", args.base), ("candidate", args.head))]
        receipt["comparison"] = baseline.compare_results(artifacts[1], artifacts[0], args.max_regression)
        receipt["passed"] = receipt["comparison"]["passed"]
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        receipt["error_type"] = type(exc).__name__
        print(f"performance capture failed: {type(exc).__name__}", file=sys.stderr)
    finally:
        path = out / "comparison.json"
        path.write_text(json.dumps(receipt, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")
        print(f"performance receipt: {path}")
    return 0 if receipt["passed"] else 3


if __name__ == "__main__":
    sys.exit(main())
