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
candidate `9edcd863e458d5375b25a078ee2d8508dab94082` has passed
[Linux CI/race and shared-Link integration](https://github.com/PaiMonCai/TuneX/actions/runs/38112786502).
The [first same-runner gate](https://github.com/PaiMonCai/TuneX/actions/runs/38112786534)
failed the native relay concurrent RTT p95 check, despite passing the TST
allocation checks. Native connection setup bursts preceded payload measurement;
the revised harness measures payload first and records phase order explicitly.
It retains the RTT timing, sample counts and 35% threshold. Both builds must be
remeasured with the revised harness; old receipts retain their failure status.

The [revised-order run](https://github.com/PaiMonCai/TuneX/actions/runs/38113810872)
also failed: the end-of-workload goroutine snapshot, relay setup p95, and full
TST TCP runtime mean operation cost exceeded the gate. Allocation reductions
repeated. Further measurements wait for workload goroutines to return to their
pre-load count for one second (15-second timeout, missing gauges fail), and
alternate independent Go benchmark processes for each of the five samples.
The full runtime includes synchronous durable traffic accounting; it remains
enabled and gated. Resource and Go sampling markers prevent comparing the
new method to old receipts.

The final [same-runner gate](https://github.com/PaiMonCai/TuneX/actions/runs/38114919742)
passed at `46b0a96670443c329d3c11f988115580c412b7bb`, against `d534143`:
138 comparisons, 90 enforced checks, no regression, invalid or missing data,
and no sampling/environment mismatch. The 35% threshold remains unchanged.
Each side has 1,500 setups and 960 concurrent RTT samples per native topology,
zero workload errors, and five samples for all 24 Go metric distributions.
All native resources returned to 12 goroutines per Agent before capture.
Both earlier failed runs remain recorded.

| Linux/amd64 median | Before receive reuse | After receive reuse |
| --- | --- | --- |
| TSTStream B/op | 18,287 | 1,774 |
| TSTMutualTLS B/op | 18,027 | 1,451 |
| Full TST TCP runtime B/op | 254,582 | 122,274 |
| Full TST TCP runtime ns/op | 5,367,024 | 5,412,397 |

Host: AMD EPYC 7763, Go 1.26.8, GOMAXPROCS=4, CGO_ENABLED=0. Agent source
matches the race/integration-tested `9edcd86`. The full runtime preserves
synchronous traffic persistence. Artifact:
`performance-46b0a96670443c329d3c11f988115580c412b7bb-1`, also retained locally
under `scripts/perf/results/ci-46b0a96/`. These results support allocation
improvement under this workload; WAN and sustained capacity remain unverified.

These short host samples show encryption/framing overhead versus a local baseline;
they are not production capacity, WAN latency, handshake DoS or an old-protocol
comparison. Variance is substantial. Repeat on the intended Linux host with
fixed CPU/resources, concurrent rules, representative TCP/UDP packet sizes,
sustained runs, p95/p99 latency, resident memory and failure/reconnect workloads
before publishing a capacity claim.

Parser fuzz smoke completed 960,760 executions in 15 seconds with 24 additional
interesting corpus inputs and no failure on this host. This is bounded fuzz
evidence, not proof of security or a substitute for ongoing fuzzing.

## On-demand notification measurements (266eb44)

State-change channels are now allocated only when an operation needs to wait.
The condition check and subscription hold the same Session mutex; broadcasting
closes that generation even before a subscriber enters select. All subscribers
wake, later subscribers use a fresh channel, and the carrier writer still gets
its bounded wake signal when there are no subscribers. Cancellation leaves at
most one pending channel per Session until the next state change.

Notification regressions passed 100 repetitions on Windows/amd64, plus complete
Agent tests and vet. Five alternating independent processes per transport,
against `690fc1d`, reduced TSTStream/mTLS median B/op by 51.8%/58.1% on that host.
The fixed-source profile's allocation share is 25.99% for `subscribeLocked`,
19.31% for `send`, and 14.85% for `queueControlLocked`. Cumulative profile totals
have different durations and iteration counts; they are not a speedup ratio.

[Linux CI](https://github.com/PaiMonCai/TuneX/actions/runs/38116729290) and the
[same-runner performance gate](https://github.com/PaiMonCai/TuneX/actions/runs/38116729325)
passed for `266eb445a14fdc8317ec16abbdbbb37dee04d6d8`, against
`690fc1dba983c1e5d3076bd88d25df9f94cb7ddf`. Protocol/runtime race, fuzz, other
runtime ownership races and real shared-Link acceptance passed. TST acceptance
reports 24 PASS/0 FAIL; native both reports 37 PASS/0 FAIL.

| Linux/amd64 median | Before notification change | After notification change |
| --- | --- | --- |
| TSTStream B/op; allocs/op | 1,776; 25 | 783; 16 |
| TSTMutualTLS B/op; allocs/op | 1,459; 19 | 584; 12 |
| Full TST TCP runtime B/op; allocs/op | 122,495; 518 | 115,314; 464 |
| Full TST UDP runtime B/op; allocs/op | 36,548; 148 | 35,031; 135 |
| Full TST TCP runtime ns/op | 5,485,181 | 5,497,931 |

Host: Ubuntu 24.04/amd64, AMD EPYC 7763, Go 1.26.8, GOMAXPROCS=4,
CGO_ENABLED=0. Both binaries differ. Each side has 1,500 connection setups and
960 concurrent RTT samples per native topology, zero errors and five samples
per Go metric. All native rounds returned to 12 goroutines per Agent before
resource capture. All 138 comparisons, including 90 enforced checks, passed;
the 35% threshold and harness remain unchanged. Recomputing the downloaded
measurements reproduces every check by metric identity. The full TCP runtime
retains synchronous traffic persistence; its median ns/op increased by 0.23%.
Artifact: `performance-266eb445a14fdc8317ec16abbdbbb37dee04d6d8-1`, also retained
under `scripts/perf/results/ci-266eb44/`. Fixed-host multi-stream, WAN and long-run
capacity remain unverified; the internal change alters no wire or API contract.

## Reusable control queue (08a480d)

Source: `08a480def4ef73bc33d0d628886640bc431e9fbf`. Control requests now use a
Session-owned FIFO ring instead of advancing a slice and repeatedly allocating
storage. It starts at eight slots on demand, grows to the existing 1,024-frame
limit and reuses storage after draining. Popping clears payload/completion
references, while the writer owns the copied request until I/O completes.
Cancellation, slot reuse and Session failure do not erase an in-flight payload.
Failure clears queued requests and drops the ring storage. On amd64 retained
slots cost 512 bytes to 64 KiB per used Session, excluding payloads/channels;
this is a retention tradeoff, not a process-wide memory bound.

Window-update merging, stream/connection credit ceilings, FIFO, queue
backpressure, ordered OPEN admission and the eight-control-frame budget before
data polling retain their existing contracts. Queue regressions passed 100
repetitions, the complete securelink suite passed ten repetitions, and all Agent
tests/vet passed on Windows/amd64. Fifty additional repetitions passed for
eight-stream TCP transfers/digests/half-close/flow control, blocked siblings,
UDP boundaries, cancelled OPEN and packet-quota isolation.

Five alternating independent processes per transport against `472c0bc`, using
Go 1.26.3, GOMAXPROCS=4, CGO_ENABLED=0 and 500 ms/count=1, reduced median
TSTStream/mTLS B/op from 845/641 to 707/513. Full TCP runtime B/op went from
126,677 to 122,032; synchronous durable traffic accounting remains enabled.
All 24 metric distributions have five valid samples. Raw output, order,
commands, candidate file hashes and distributions are retained under
`scripts/perf/results/control-queue/`. Host latency varies; these values do not
establish production throughput or WAN latency.

[Linux CI](https://github.com/PaiMonCai/TuneX/actions/runs/38118781281) passed
for this exact source, including race, fuzz, runtime ownership and real shared-Link
acceptance. TST reports 24 PASS/0 FAIL and native both reports 37 PASS/0 FAIL.
Parser fuzz completed 195,557 executions in 15 seconds without failure. The
fixed-source five-profile analysis is documented in the
[hotspot report](tst-hotspots.md); the control queue is no longer among the
top ten allocation sources in that mTLS sample. Waiting subscriptions and send
completion notifications still allocate.

The first [performance gate](https://github.com/PaiMonCai/TuneX/actions/runs/38118781289)
against `472c0bc` failed after 11m35s. Recomputing all 138 checks reproduces
the receipt: only native DIRECT hot-reload apply p99 exceeded the unchanged
35% threshold, from 0.710 to 1.311 ms (+84.5%). There were 24 hot-reload samples,
including one candidate observation of 1.447 ms. The failure is retained under
`scripts/perf/results/ci-08a480d/`; its cause has not been established.
TSTStream/mTLS median B/op still decreased from 780/562 to 657/462, and full
TCP runtime B/op from 116,676 to 115,249. These improvements do not override
the failing lifecycle tail.

The next measurement uses 100 hot reloads per quick native round, 300 raw
samples per side, retaining all metrics, timing boundaries and the 35% gate.
The workload declares sample count and target verification; legacy receipts
cannot mix with this population. Each replacement target must receive the
connection and return the complete payload; its accept and client workers
are shut down and joined. Eight additional harness contracts pass locally
(86 total; two Linux `/proc` checks skipped on Windows). An explicit comparison
against the original `472c0bc` baseline remains required; a same-Agent-source
control run cannot establish the optimization's performance.
