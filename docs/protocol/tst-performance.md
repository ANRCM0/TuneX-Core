# TST performance baseline

## V2.2 baseline contract

The repository now has two complementary baseline layers. The Go benchmarks
measure transport and runtime paths without a Panel, while
`scripts/perf/stream-baseline.py` measures real native direct/relay Agent
topologies and emits a versioned JSON artifact plus a CSV projection.

The artifact records message size, concurrency, platform, optional externally
measured RTT/loss labels, median/p95/p99, throughput, CPU, RSS, goroutines and
connection/setup metrics. RTT and packet loss are metadata unless an external
runner shapes the network; the loopback harness does not pretend to emulate a
WAN. Empty or unavailable values stay `null`.

Run the pure harness checks with:

```text
python3 -B -m unittest discover -s scripts/perf -p 'test_*.py'
```

Build the Agent, collect a quick artifact, and compare it with the checked-in
same-host anchor:

```text
(cd agent && go build -o ../scripts/perf/.bin/tunex-agent .)
python3 scripts/perf/stream-baseline.py \
  --agent-binary scripts/perf/.bin/tunex-agent \
  --out scripts/perf/results \
  --scenarios direct relay \
  --compare scripts/perf/baseline/tcp-stream-anchor.json
```

The comparison is a relative gate (20% by default) so shared runners do not
turn millisecond noise into a false failure. Use `--max-regression` for a
pinned host. A missing scenario or metric fails closed and is written to the
`*-comparison.json` receipt. The anchor is a same-host reference, not a release
capacity claim.

For a profiling run, opt in explicitly. The Agent then exposes pprof only on
the authenticated admin listener and the harness stores CPU, trace, heap,
allocation, goroutine, block, mutex and thread-create artifacts beside the
baseline JSON:

```text
python3 scripts/perf/stream-baseline.py \
  --agent-binary scripts/perf/.bin/tunex-agent \
  --out scripts/perf/results-profile \
  --scenarios direct relay \
  --capture-profiles --profile-seconds 3
```

Profiling is disabled by default (`TUNEX_AGENT_PROFILE=false`). The profile
endpoints are never mounted on a separate unauthenticated port, and profile
bytes are kept out of the JSON/CSV so the machine-readable result stays small.
The files are diagnostic evidence, not a capacity claim; compare them on a
fixed host with the same workload and candidate SHA.

The transport benchmark matrix includes plain TCP, plain UDP, TST TCP and TST
UDP. UDP uses a 1200-byte datagram to stay below common loopback/MTU limits;
the full runtime tests separately cover larger packet rejection and bounded
association queues.

Executed local sample: Windows/amd64, Go standard runtime, Intel Core i5-12500H,
16 logical benchmark workers. Command:

```text
go test ./internal/securelink -run '^$' -bench 'Benchmark(PlainTCP|TSTMutualTLS|TSTStream)$' -benchmem -benchtime 500ms -count 3
go test ./internal/tstruntime -run '^$' -bench 'Benchmark(PlainUDP|TSTLoopback(UDP|TCP))$' -benchmem -benchtime 500ms -count 3
```

The securelink operations transfer a 16 KiB payload; the UDP runtime benchmarks
use a 1200-byte datagram. Plain TCP and TST/mTLS use real loopback sockets;
TSTStream isolates framing/flow control with net.Pipe. The TLS benchmark
sets up one authenticated carrier outside the timed payload loop; it does not
measure certificate issuance or per-connection handshake throughput.

The TST TCP write path reuses fixed 16 KiB buffers. The cache retains at most
256 idle buffers (4 MiB per process); this is not a bound on total Agent memory.
The caller's bytes are still copied into owned storage. A queued payload is
returned only after the writer completes or the queue discards it. Timeout and
cancellation do not reclaim memory still referenced by carrier I/O. Returned
buffers are cleared in full before another Link or Workspace can reuse them.

Windows/amd64 A/B was repeated after adding plaintext erasure, on the same
i5-12500H host with Go 1.26.3, 16 workers, 16 KiB frames and
`-benchtime 500ms -count 5`. The baseline is an export of `1e7bd43`; the candidate
is the pool implementation plus erasure and ownership regression tests.
Raw samples and a source-diff digest are stored locally under
`scripts/perf/results/p3/`. These local microbenchmarks establish allocation
improvement; they do not establish production capacity or WAN behavior.

| Benchmark | MB/s samples | Allocation per operation |
| --- | --- | --- |
| PlainTCP | 654.50, 766.51, 1026.15 | 0 bytes, 0 allocations |
| TSTMutualTLS | 274.25, 230.99, 245.32 | 35,305–35,415 bytes, 28 allocations |
| TSTStream (pre-pool, amd64 A/B) | 456.00, 533.95, 452.41, 445.69, 526.09 | 34,726–34,761 bytes, 31–32 allocations |
| TSTStream (pooled + erasure, amd64 A/B) | 497.30, 542.08, 495.75, 603.72, 592.40 | 18,309–18,375 bytes, 30 allocations |

These short host samples show encryption/framing overhead versus a local baseline;
they are not production capacity, WAN latency, handshake DoS or an old-protocol
comparison. Variance is substantial. Repeat on the intended Linux host with
fixed CPU/resources, concurrent rules, representative TCP/UDP packet sizes,
sustained runs, p95/p99 latency, resident memory and failure/reconnect workloads
before publishing a capacity claim.

Parser fuzz smoke completed 960,760 executions in 15 seconds with 24 additional
interesting corpus inputs and no failure on this host. This is bounded fuzz
evidence, not proof of security or a substitute for ongoing fuzzing.
