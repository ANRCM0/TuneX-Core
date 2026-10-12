"""Adversarial checks that prevent incomplete/misclassified evidence passing."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("runtime_matrix", Path(__file__).with_name("runtime-matrix.py"))
matrix = importlib.util.module_from_spec(spec)
spec.loader.exec_module(matrix)


def fixture():
    case = {"kind": "tst_tcp", "bytes": 64, "connections": 1, "rounds": 2,
            "duration_seconds": 0, "rtt_ms": 0, "loss_percent": 0, "output": "fixture.json"}
    gauge = {"elapsed_seconds": 0, "goroutines": 2, "heap_alloc_bytes": 100,
             "heap_objects": 10, "rss_bytes": 1000, "fd_count": 4, "cpu_ticks": 0}
    receipt = {"kind": "tunex-runtime-performance", "schema_version": 1, "case": case,
               "passed": True, "platform": "linux/amd64", "elapsed_seconds": 1,
               "latency_sampling": "uniform_reservoir_10000_per_protocol_pcg_1_2_3_4",
               "corrupt": {}, "errors": {}, "durable_accounting": True,
               "accounted_bytes": {"101": {"in": 128, "out": 128}},
               "metrics": {"tcp": {"completed": 2, "errors": 0, "corrupt": 0,
                                   "roundtrip_mib_s": 256 / (1 << 20),
                                   "rtt_ms": {"count": 2, "median": 1.5, "p95": 1.95,
                                              "p99": 1.99, "samples": [1, 2]}}},
               "netem": {"mode": "unshaped"}, "initial": copy.deepcopy(gauge),
               "resources": [copy.deepcopy(gauge), copy.deepcopy(gauge)],
               "after_cleanup": copy.deepcopy(gauge)}
    return receipt, case


def shaped_fixture():
    receipt, case = fixture()
    case["rtt_ms"], case["loss_percent"] = 20, 1
    receipt["metrics"]["tcp"]["rtt_ms"] = {"count": 2, "median": 21.5, "p95": 21.95,
                                           "p99": 21.99, "samples": [21, 22]}
    receipt["netem"] = {"mode": "netem", "cleanup": "qdisc_deleted", "rtt_ms": 20,
                        "loss_percent": 1, "protocol": "tcp", "interface": "lo",
                        "netns": "net:[1234]", "carrier_port": 5000,
                        "filter_stats": "dst_port 5000", "commands": [["netem", "delay", "10.000ms", "loss", "1.000%"]],
                        "qdisc_stats": [{"kind": "netem", "handle": "30:", "packets": 100, "drops": 1}]}
    return receipt, case


class RuntimeReceiptTests(unittest.TestCase):
    def test_valid_and_raw_quantiles_recomputed(self):
        receipt, case = fixture()
        self.assertTrue(matrix.audit(receipt, case)["quantiles_recomputed"])

    def test_reject_fabricated_p99(self):
        receipt, case = fixture()
        receipt["metrics"]["tcp"]["rtt_ms"]["p99"] = 1
        with self.assertRaisesRegex(ValueError, "quantile"):
            matrix.audit(receipt, case)

    def test_reject_missing_population_and_accounting(self):
        for field in ("completed", "accounted"):
            receipt, case = fixture()
            if field == "completed":
                case["rounds"] = 3
            else:
                receipt["accounted_bytes"]["101"]["in"] = 127
            with self.assertRaises(ValueError):
                matrix.audit(receipt, case)

    def test_reject_missing_linux_resource_and_leaks(self):
        for key, value in (("fd_count", None), ("goroutines", 4)):
            receipt, case = fixture()
            receipt["after_cleanup"][key] = value
            with self.assertRaises(ValueError):
                matrix.audit(receipt, case)

    def test_reject_nonfinite_and_corruption(self):
        receipt, case = fixture()
        receipt["metrics"]["tcp"]["rtt_ms"]["samples"][0] = float("nan")
        with self.assertRaises(ValueError):
            matrix.audit(receipt, case)
        receipt, case = fixture()
        receipt["corrupt"] = {"tcp": 1}
        with self.assertRaisesRegex(ValueError, "corruption"):
            matrix.audit(receipt, case)

    def test_zero_clock_observations_retained(self):
        receipt, case = fixture()
        receipt["metrics"]["tcp"]["rtt_ms"] = {"count": 2, "median": 0, "p95": 0,
                                              "p99": 0, "samples": [0, 0]}
        matrix.audit(receipt, case)

    def test_soak_requires_declared_duration_and_samples(self):
        receipt, case = fixture()
        case["duration_seconds"] = 60
        with self.assertRaisesRegex(ValueError, "shorter"):
            matrix.audit(receipt, case)
        receipt["elapsed_seconds"] = 60
        receipt["metrics"]["tcp"]["roundtrip_mib_s"] /= 60
        with self.assertRaisesRegex(ValueError, "periodic"):
            matrix.audit(receipt, case)

    def test_actual_shaping_required(self):
        receipt, case = shaped_fixture()
        self.assertEqual(matrix.audit(receipt, case)["shaped_packets"], 100)
        receipt["netem"]["qdisc_stats"][0]["packets"] = 0
        with self.assertRaises(ValueError):
            matrix.audit(receipt, case)

    def test_tst_udp_must_shape_tcp_carrier(self):
        receipt, case = shaped_fixture()
        case["kind"] = "tst_udp"
        receipt["metrics"] = {"udp": receipt["metrics"]["tcp"]}
        receipt["accounted_bytes"] = {"102": {"in": 128, "out": 128}}
        matrix.audit(receipt, case)
        receipt["netem"]["protocol"] = "udp"
        with self.assertRaisesRegex(ValueError, "carrier"):
            matrix.audit(receipt, case)

    def test_impossible_latency_rejects_metadata_only_shaping(self):
        receipt, case = shaped_fixture()
        receipt["metrics"]["tcp"]["rtt_ms"] = {"count": 2, "median": 1.5, "p95": 1.95,
                                              "p99": 1.99, "samples": [1, 2]}
        with self.assertRaisesRegex(ValueError, "delay"):
            matrix.audit(receipt, case)

    def test_reject_wrong_shaping_configuration(self):
        receipt, case = shaped_fixture()
        receipt["netem"]["commands"][0][2] = "1.000ms"
        with self.assertRaisesRegex(ValueError, "configuration"):
            matrix.audit(receipt, case)

    def test_mixed_population(self):
        class Args:
            condition = "clean"
            kinds = list(matrix.KINDS)
            mode = "matrix"
        population = matrix.cases(Args(), Path("fixture"))
        self.assertEqual(len(population), 36)
        self.assertTrue(all(c["connections"] >= 2 for c in population if c["kind"] == "tst_mixed"))


if __name__ == "__main__":
    unittest.main()
