import importlib.util
from pathlib import Path
import sys
import unittest

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


if __name__ == "__main__":
    unittest.main()
