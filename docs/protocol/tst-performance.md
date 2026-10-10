# TST performance baseline

Executed local sample: Windows/amd64, Go standard runtime, Intel Core i5-12500H,
16 logical benchmark workers. Command:

```text
go test ./internal/securelink -run '^$' -bench 'Benchmark(PlainTCP|TSTMutualTLS|TSTStream)$' -benchmem -benchtime 500ms -count 3
```

Each operation transfers a 16 KiB payload. Plain TCP and TST/mTLS use real loopback
sockets; TSTStream isolates framing/flow control with net.Pipe. The TLS benchmark
sets up one authenticated carrier outside the timed payload loop; it does not
measure certificate issuance or per-connection handshake throughput.

| Benchmark | Three MB/s samples | Allocation per operation |
| --- | --- | --- |
| PlainTCP | 654.50, 766.51, 1026.15 | 0 bytes, 0 allocations |
| TSTMutualTLS | 274.25, 230.99, 245.32 | 35,305–35,415 bytes, 28 allocations |
| TSTStream | 676.93, 670.64, 637.45 | 34,683–34,700 bytes, 31 allocations |

These short host samples show encryption/framing overhead versus a local baseline;
they are not production capacity, WAN latency, handshake DoS or an old-protocol
comparison. Variance is substantial. Repeat on the intended Linux host with
fixed CPU/resources, concurrent rules, representative TCP/UDP packet sizes,
sustained runs, p95/p99 latency, resident memory and failure/reconnect workloads
before publishing a capacity claim.

Parser fuzz smoke completed 960,760 executions in 15 seconds with 24 additional
interesting corpus inputs and no failure on this host. This is bounded fuzz
evidence, not proof of security or a substitute for ongoing fuzzing.
