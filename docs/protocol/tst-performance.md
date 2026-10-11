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

Build the Agent and collect a quick artifact:

```text
(cd agent && go build -o ../scripts/perf/.bin/tunex-agent .)
python3 scripts/perf/stream-baseline.py \
  --agent-binary scripts/perf/.bin/tunex-agent \
  --out scripts/perf/results \
  --scenarios direct relay
```

Use `--compare` with an earlier artifact from the same host and workload. The
checked-in historical Linux anchor is usable only when its recorded environment
matches. The relative threshold defaults to 20%; it does not eliminate shared
runner noise. Missing/nonfinite metrics, new errors from a zero baseline, changed
sample counts/units, profiling modes, network labels or measured environments
fail closed in the `*-comparison.json` receipt. Schema v1 anchors without p99
can still compare the fields they actually measured. Empty comparisons fail.

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
Captures run under a separate continuous payload load before lifecycle tests
close the target. Resource deltas are sampled before that capture phase. Each
capture has a unique directory, so subsequent runs preserve earlier profile
receipts. Durations are bounded to 1–20 seconds per CPU/trace endpoint to fit
within the admin listener's write timeout. Capture/load failure preserves the
receipt and exits 4. Profile sizes are not performance metrics. The harness
explicitly passes `--profile=false` in ordinary runs, even if its parent shell
enabled profiling. Files remain local diagnostic evidence, not a capacity claim.

The [same-runner workflow](../../.github/workflows/performance.yml) exports two
exact commits, builds both offline, and measures them sequentially using the
same harness and resources. It includes direct/relay native metrics and all six
Go transport benchmarks, five samples each. Native workloads are measured in
three alternating pairs, with 500 connection setup samples per round; business
quantiles are recomputed from combined raw samples. Go benchmark run averages
are gated by median, with run-tail variation reported separately; those values
are not individual-operation tail latencies. Both raw samples and comparison
receipts are archived even on failure. The shared CI threshold is 35%; fixed-host
operators can tighten it. A failed capture or comparison fails the workflow.
This does not establish WAN behavior or replace long-running capacity tests.

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

The receive loop now lazily holds one 16 KiB DATA scratch buffer per active TCP
Link, sharing the same bounded idle cache. DATA is copied into the stream's
receive buffer before scratch reuse. UDP and control payloads own independent
storage; the public ReadFrame API also retains caller ownership. Only reader
exit returns and erases scratch, after carrier I/O ends, including failures.
This adds up to 16 KiB of active storage per Link receiving TCP DATA, in exchange
for avoiding a payload and header allocation on every DATA frame.

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

Receive optimization A/B against `d534143`, on the same Windows/amd64 host,
Go 1.26.3, GOMAXPROCS=4, CGO_ENABLED=0, 16 KiB frames, five 500ms runs:

| Benchmark | MB/s samples | Allocation per operation |
| --- | --- | --- |
| TSTStream (before receive reuse) | 846.58, 736.36, 729.06, 796.28, 720.10 | 18,274–18,306 bytes, 29–30 allocations |
| TSTStream (receive reuse) | 865.46, 805.13, 672.33, 876.83, 990.12 | 1,759–1,794 bytes, 25 allocations |
| TSTMutualTLS (before receive reuse) | 187.01, 247.36, 219.98, 248.25, 167.82 | 18,089–18,169 bytes, 25–27 allocations |
| TSTMutualTLS (receive reuse) | 204.94, 231.37, 258.64, 302.42, 258.92 | 1,516–1,584 bytes, 23 allocations |

Median allocated bytes decreased 90.3% and 91.5% respectively. Raw output,
commands, baseline SHA and candidate Go file hashes remain under
`scripts/perf/results/receive-pool/`. These are sequential local samples;
throughput variation does not establish a production capacity gain. The current
candidate still requires Linux CI/race and the same-runner performance gate.

These short host samples show encryption/framing overhead versus a local baseline;
they are not production capacity, WAN latency, handshake DoS or an old-protocol
comparison. Variance is substantial. Repeat on the intended Linux host with
fixed CPU/resources, concurrent rules, representative TCP/UDP packet sizes,
sustained runs, p95/p99 latency, resident memory and failure/reconnect workloads
before publishing a capacity claim.

Parser fuzz smoke completed 960,760 executions in 15 seconds with 24 additional
interesting corpus inputs and no failure on this host. This is bounded fuzz
evidence, not proof of security or a substitute for ongoing fuzzing.
