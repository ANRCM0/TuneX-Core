import importlib.util
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("ci_baseline_test", Path(__file__).with_name("ci-baseline.py"))
gate = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = gate
spec.loader.exec_module(gate)


class BenchmarkReceiptTest(unittest.TestCase):
    def samples(self):
        return "\n".join(f"Benchmark{name}-4 100 1000 ns/op 120 MB/s 64 B/op 2 allocs/op"
                         for names in gate.BENCHMARKS.values() for name in names for _ in range(3))

    def test_all_transport_samples_include_distributions_and_allocations(self):
        metrics = gate.benchmark_metrics(self.samples(), 3)
        self.assertEqual(len(metrics), 24)
        self.assertEqual(metrics["TSTStream_throughput_mb_s"]["p99"], 120)
        self.assertEqual(metrics["TSTLoopbackUDP_allocated_bytes"]["count"], 3)

    def test_missing_invalid_or_partial_benchmarks_cannot_pass(self):
        for raw in ("", self.samples().split("\n", 1)[1],
                    self.samples().replace("1000 ns/op", "nan ns/op", 1),
                    self.samples().replace("64 B/op", "-64 B/op", 1),
                    self.samples().replace("2 allocs/op", "2 unknown", 1)):
            with self.subTest(raw=raw[:100]), self.assertRaises(ValueError):
                gate.benchmark_metrics(raw, 3)

    def test_native_pair_is_not_interleaved_with_heavy_transport_load(self):
        events = []

        def build(repo, sha, root, env):
            events.append(("build", sha))
            return root, root / "agent"

        def native(binary, sha, out, args):
            events.append(("native", sha))
            out.mkdir(parents=True)
            return {"scenarios": {}, "environment": {}}

        def transport(argv, cwd, env):
            events.append(("transport", cwd.name))
            return "samples"

        args = SimpleNamespace(base="base", head="head", benchtime="500ms", count=3, native_rounds=3)
        with tempfile.TemporaryDirectory() as tmp, patch.object(gate, "build_agent", side_effect=build), \
                patch.object(gate, "measure_native", side_effect=native), \
                patch.object(gate, "command", side_effect=transport), \
                patch.object(gate, "benchmark_metrics", return_value={}), \
                patch.object(gate.baseline, "write_outputs"):
            root = Path(tmp)
            gate.measure_pair(root, root / "builds", root / "out", {}, args)
        self.assertEqual(events[:8], [("build", "base"), ("build", "head"),
                                     ("native", "base"), ("native", "head"),
                                     ("native", "head"), ("native", "base"),
                                     ("native", "base"), ("native", "head")])
        self.assertEqual(events[8:], [("transport", "anchor"), ("transport", "candidate")] * 2)

    def test_tail_is_computed_from_combined_raw_samples(self):
        # Averaging per-round quantiles gives a different, invalid tail.
        values = [gate.baseline.Summary.of([1, 1, 1], "ms").to_json(),
                  gate.baseline.Summary.of([2, 2, 100], "ms").to_json()]
        result = gate.combine_metrics(values)
        self.assertEqual(result["count"], 6)
        self.assertEqual(result["p99"], gate.baseline.percentile([1, 1, 1, 2, 2, 100], 99))
        self.assertNotEqual(result["p99"], sum(value["p99"] for value in values) / 2)
        self.assertEqual(gate.combine_metrics([{"direct_error_count": 0}, {"direct_error_count": 1}]),
                         {"direct_error_count": 1})

    def test_incomplete_repeated_samples_or_resources_fail_closed(self):
        first = {"latency": gate.baseline.Summary.of([1, 2], "ms").to_json(), "cpu": 1.0}
        for broken in ({"latency": first["latency"]}, dict(first, cpu=None),
                       dict(first, latency=dict(first["latency"], samples=[1])),
                       dict(first, latency=dict(first["latency"], samples=[1, float("nan")]))):
            with self.subTest(broken=broken), self.assertRaises(ValueError):
                gate.combine_metrics([first, broken])


if __name__ == "__main__":
    unittest.main()
