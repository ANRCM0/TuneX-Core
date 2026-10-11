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
import statistics
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


def capture_error_stack(exc: Exception) -> list[dict]:
    """Publish harness call locations without exception text, source or locals."""
    root = Path(__file__).resolve().parent
    frames = []
    tb = exc.__traceback__
    while tb is not None:
        path = Path(tb.tb_frame.f_code.co_filename).resolve()
        if path.parent == root:
            frames.append({"file": path.name, "function": tb.tb_frame.f_code.co_name,
                           "line": tb.tb_lineno})
        tb = tb.tb_next
    return frames[-12:]


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


def build_agent(repo: Path, sha: str, root: Path, env: dict) -> tuple[Path, Path]:
    agent = export_agent(repo, sha, root)
    binary = root / ("tunex-agent.exe" if os.name == "nt" else "tunex-agent")
    command(["go", "build", "-trimpath", "-buildvcs=false", "-o", str(binary), "."], agent, env)
    return agent, binary


def measure_native(binary: Path, sha: str, out: Path, args) -> dict:
    stream_args = baseline.parse_args(["--agent-binary", str(binary), "--out", str(out),
                                       "--profile", args.profile, "--scenarios", *args.scenarios])
    stream_args.setups = args.setup_samples
    artifact = baseline.run(stream_args)
    artifact["environment"]["source_sha"] = sha
    out.mkdir(parents=True, exist_ok=True)
    (out / "native-phase.json").write_text(json.dumps(artifact, indent=2, sort_keys=True,
                                                     allow_nan=False) + "\n", encoding="utf-8")
    return artifact


def combine_metrics(values: list, name: str = ""):
    first = values[0]
    if isinstance(first, dict):
        if any(not isinstance(value, dict) or set(value) != set(first) for value in values):
            raise ValueError("incomplete repeated measurement")
        if "median" in first:
            samples = []
            for value in values:
                raw = value.get("samples")
                if not isinstance(raw, list) or not raw or len(raw) != value["count"] or value["unit"] != first["unit"]:
                    raise ValueError("missing repeated raw samples or mismatched units")
                if any(not isinstance(item, (int, float)) or isinstance(item, bool) or not math.isfinite(item) for item in raw):
                    raise ValueError("invalid repeated raw samples")
                samples.extend(raw)
            return baseline.Summary.of(samples, first["unit"]).to_json()
        return {key: combine_metrics([value[key] for value in values], key) for key in first}
    if isinstance(first, (int, float)) and not isinstance(first, bool):
        if any(not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) for value in values):
            raise ValueError("missing repeated resource gauge")
        return sum(values) if name.endswith("_error_count") else statistics.median(values)
    if any(value is None for value in values) and any(value is not None for value in values):
        raise ValueError("inconsistent resource measurement availability")
    return first


def measure_pair(repo: Path, root: Path, out: Path, env: dict, args) -> list[dict]:
    sides = (("anchor", args.base), ("candidate", args.head))
    # Build both before measuring either. Native latency must not follow a heavy
    # transport benchmark on only one side; keep matching workload phases adjacent.
    builds = [build_agent(repo, sha, root / side, env) for side, sha in sides]
    runs: list[list[dict]] = [[], []]
    for round_index in range(args.native_rounds):
        order = (0, 1) if round_index % 2 == 0 else (1, 0)
        for index in order:
            side, sha = sides[index]
            runs[index].append(measure_native(builds[index][1], sha,
                                              out / side / f"round-{round_index + 1}", args))
    artifacts = [dict(items[0], scenarios=combine_metrics([item["scenarios"] for item in items]),
                      native_rounds=args.native_rounds, repeated_environments=[item["environment"] for item in items])
                 for items in runs]
    raw: list[list[str]] = [[], []]
    for package, names in BENCHMARKS.items():
        # Runtime benchmarks include synchronous durable traffic accounting.
        # Alternate independent processes so one build's five samples do not
        # all precede the other's filesystem/scheduler conditions.
        for sample in range(args.count):
            order = (0, 1) if sample % 2 == 0 else (1, 0)
            for index in order:
                agent, _ = builds[index]
                raw[index].append(command(["go", "test", f"./internal/{package}", "-run", "^$",
                                           "-bench", "^Benchmark(" + "|".join(names) + ")$", "-benchmem",
                                           "-benchtime", args.benchtime, "-count", "1"], agent, env))
    for index, (side, _) in enumerate(sides):
        benchmark_raw = "\n".join(raw[index])
        (out / side / "go-benchmarks.txt").write_text(benchmark_raw, encoding="utf-8")
        artifacts[index]["scenarios"]["go_transport"] = benchmark_metrics(benchmark_raw, args.count)
        artifacts[index]["measurement_order"] = "build_both-alternating_native_pairs-alternating_go_process_pairs"
        artifacts[index]["go_sample_order"] = "alternating_process_pairs"
        baseline.write_outputs(artifacts[index], out / side)
    return artifacts


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="exact baseline commit SHA")
    parser.add_argument("--head", required=True, help="exact candidate commit SHA")
    parser.add_argument("--out", default="scripts/perf/results/ci")
    parser.add_argument("--profile", choices=baseline.PROFILES, default="quick")
    parser.add_argument("--scenarios", nargs="+", choices=["direct", "relay"], default=["direct", "relay"])
    parser.add_argument("--count", type=int, default=5)
    parser.add_argument("--native-rounds", type=int, default=3)
    parser.add_argument("--setup-samples", type=int, default=500)
    parser.add_argument("--benchtime", default="500ms")
    parser.add_argument("--max-regression", type=float, default=0.35)
    args = parser.parse_args(argv)
    if not all(re.fullmatch(r"[0-9a-fA-F]{40}", sha) for sha in (args.base, args.head)):
        parser.error("--base and --head must be full commit SHAs")
    if args.count < 3 or args.native_rounds < 1 or args.setup_samples < 100 or not 0 <= args.max_regression < 1:
        parser.error("at least three Go samples, one native round, 100 setup samples and a threshold in [0, 1) are required")
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
        artifacts = measure_pair(repo, root, out, env, args)
        receipt["comparison"] = baseline.compare_results(artifacts[1], artifacts[0], args.max_regression)
        receipt["passed"] = receipt["comparison"]["passed"]
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        receipt["error_type"] = type(exc).__name__
        receipt["error_stack"] = capture_error_stack(exc)
        print(f"performance capture failed: {type(exc).__name__}", file=sys.stderr)
        print(f"harness call locations: {json.dumps(receipt['error_stack'], sort_keys=True)}", file=sys.stderr)
    finally:
        path = out / "comparison.json"
        path.write_text(json.dumps(receipt, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")
        print(f"performance receipt: {path}")
    return 0 if receipt["passed"] else 3


if __name__ == "__main__":
    sys.exit(main())
