# TST Agent runtime verification evidence

Executed on 2026-10-11 in the shared V2 working tree. Host: Windows, Intel Core
i5-12500H, `go1.26.3 windows/386`. The Agent has only Go standard-library
dependencies. This record covers the in-process Agent runtime and control/reporting
integration; real Panel/Worker/database/browser evidence is recorded separately.

## Executed checks

Commands are run from `agent/` in PowerShell. Environment overrides are local to
the corresponding command process.

| Check | Command | Observed result |
| --- | --- | --- |
| Full Agent regression after report contract fixes | `go test ./... -p=2 -count=1 -timeout=120s` | All packages passed; control 22.219s, manager 23.021s, forwarder 32.287s, reporter 2.088s, securelink 2.554s, tstruntime 13.063s |
| Lease reorder fix regression | `go test ./internal/tstruntime ./internal/control ./internal/reporter -p=2 -count=1 -timeout=90s` | Passed after final lease no-op change; tstruntime 13.272s, control 17.635s, reporter 1.378s |
| Static analysis | `go vet ./...` | Passed |
| Windows amd64 runtime | `$env:GOARCH='amd64'; go test ./internal/tstruntime -count=1 -timeout=90s` | Passed after report fix in 12.175s; lease-specific later change covered by Windows/386 affected-package tests |
| Linux amd64 compilation | `$env:GOOS='linux'; $env:GOARCH='amd64'; go build ./...` | Passed; compilation only |
| Failed-target fixture regression | `go test ./internal/manager -run 'TestRelayChainTargetFailureObservableAndDropsConn\|TestRelayChainRecoversWhenTargetComesBack' -count=3 -timeout=40s` | Passed three runs after reserving the dead-target port through relay listener construction |

The final full run was taken after authorized diagnosis, Windows ACL protection,
bidirectional UDP idle handling, the handshake-rate budget and live report
contract fixes were implemented. Package parallelism was limited to two while
the isolated clean builds ran on the same host.
An earlier full run exposed a fixture race: the released dead-target port was
reused for that same fixture's egress listener, causing self-dials. Keeping the
reservation until both listeners exist removes that fixture error; the final
full run above passed.

## Isolated offline source/build verification

Copied current `agent/` source into a new temporary directory outside the
repository, excluding executable/test/output/log artifacts, build directories,
vendor, node_modules and version-control files. The copy contained 166 files,
including 163 Go files. Builds below used this isolated copy and fresh separate
`GOCACHE` directories for the two target architectures. The source was refreshed
after the live report contract and lease-reordering fixes before the final builds.

`go list -m all` reported exactly one module, `github.com/tunex/agent`.
`go list -deps -test` reported 208 standard-library packages, 58 own module/test
packages and **zero external nonstandard packages** for Linux amd64. The inventory
includes tests rather than checking only `go.mod`. There is no external runner,
module download or vendor input in this copy.

Both builds ran with `CGO_ENABLED=0`, `GOPROXY=off`, `GOSUMDB=off` and
`GOTOOLCHAIN=local`, with the target's `GOOS=linux` and `GOARCH`:

```text
go build -p=2 -mod=readonly ./...
go build -p=2 -mod=readonly -o ../tunex-agent-linux-TARGET .
```

| Target | Result | Executable bytes | ELF machine |
| --- | --- | --- | --- |
| Linux amd64 | Passed offline from refreshed isolated source | 12,472,179 | 62, x86-64 |
| Linux arm64 | Passed offline from refreshed isolated source | 11,589,510 | 183, AArch64 |

Both generated files begin with ELF magic `7f454c46`. SHA-256 of the locally
generated, unstripped evidence binaries:

```text
amd64 f55af2b94286f1471fec60f4967aed4ec75df3ad298c8634ad9b7b099324e9aa
arm64 df973694ed77340e3690977a085f278e514438b27bb5894f334eafd719505018
```

These are cross-compilation artifacts, not executed Linux installation or
runtime evidence. Temporary source, dependency inventory and executables were
kept under `tunex-agent-clean-446a61a5a21443739faa5f88af2636f0` in the host temp
directory; they are not release artifacts in the repository.

## Behavior verified with real loopback sockets

The tests generate short-lived ECDSA test identities and an isolated CA. Real
TCP/UDP listeners, a real TLS handshake and the independent TST session code are
used. Native forwarding is instantiated when checking shared port ownership.

| Requirement | Test evidence |
| --- | --- |
| TCP, UDP and both | `TestRealTCPUDPAndBoth` transfers payloads through ingress, authenticated carrier, egress and target; accounting belongs to the ingress Forward |
| Compiler/runtime scope contract | `TestCompilerShapedWildcardPlacement` applies compiler-shaped wildcard placements and transfers TCP; mismatched declared listener scopes and revision zero are rejected |
| Shared Link updates | `TestHotReloadPreservesSiblingTCPAndUDP` holds sibling TCP connections and UDP mappings while updating/removing another rule |
| Local target authority | `TestNativePortGuardAndUnauthorizedRule` rejects an unknown Forward and a stale rule revision; native and TST listeners cannot own an overlapping port |
| QoS/connection quota | `TestRealQoSCeilingAndConnectionQuota` exercises directional rate ceilings and connection admission with actual traffic |
| UDP association lifetime | `TestUDPBidirectionalActivityAndIdleCleanup` separately sends requests without responses and responses without new requests; the same association survives active traffic, inactivity releases both ends' stream/connection quota, and a new request reopens it |
| Leases and fences | `TestLeaseStopsActualSocketsAndReleasesPort`, `TestLeasesFencesCacheAndDurableAccounting` and `TestFailedHigherGenerationKeepsSiblingAndNeverRestoresOlderConfig` cover socket release, durable tombstones, lease regression and failed higher-generation recovery |
| Same-generation lease reordering | `TestReorderedSameGenerationLeaseKeepsAppliedLongerLease` sends snapshot renewal before the queued older lease on both roles; the late valid duplicate returns the longer observation without writing cache/restarting flows, while expired/conflicting/removed input is rejected |
| Half-close/reconnect | `TestHalfCloseReturnsTargetResponseAndCarrierReconnects` returns the target's response after client write-close and reestablishes a broken carrier |
| Cache integrity/ownership | `TestPrivateCacheTamperAndSingleOwnerFailClosed` and `TestClosedOwnerCannotOverwriteReopenedCache` exercise tampering, exclusive OS ownership and refusal to write after releasing that ownership |
| Certificate lifetimes | `TestLocalCertificateExpiresIndependentOfLeaseAndCacheCanRecover` closes local placements at certificate expiry; `TestPeerCertificateExpiryClosesSessionWithoutRemoteShutdown` closes an already-authenticated carrier at peer expiry |
| Authorized diagnosis | `TestDiagnosisUsesOnlyLiveEgressAuthorizationAndDoesNotBill` requires live egress placement generation, Forward and exact revision; unknown/removed rules are denied, UDP reachability is reported unsupported, and probes do not enter business accounting |
| Closed report contract | `TestCompilerShapedWildcardPlacement` and the failed-generation regression verify ready/closed/rollback state projections; `TestTargetReportEncodesClosedNullableContract` verifies explicit nullable target fields in serialized reports |
| TLS admission rate | `TestHandshakeBudgetBoundsAndRefills` checks burst/refill/clock behavior; `TestActualTLSAcceptPathEnforcesHandshakeBudget` verifies that an exhausted pre-TLS budget closes the real accepted socket and legitimate mTLS works after admission recovers |

The UDP idle regression injects a one-second lifetime into the private test constructor
to exercise expiry without a one-minute test delay. Production lifetime is 60s
of inactivity in either direction. The ingress client queue holds at most four
packets per association; excess queued packets are dropped. Session datagram
queues are bounded separately.

## Admission, persistence and privacy

Each egress placement permits at most eight concurrent TLS handshakes, a burst
of eight attempted handshakes, refill of four attempts per second, a five-second
handshake deadline, four authenticated carriers and 256 admitted business flows
across its rules. Every socket consumes handshake budget before TLS, including
authentication failures. Rule connection/IP quotas can impose lower limits.

The private cache uses AES-GCM, synced atomic file replacement, node/Agent identity
binding and persistent generations/deletion tombstones. Unix uses exclusive flock,
private directory mode and 0600 files. Windows uses an OS-held `LockFileEx` lock and
protected directory/file DACLs granting owner, SYSTEM and Administrators access.
Closed managers cannot overwrite a newly opened owner's cache or acknowledgments.
This is local persistence protection, not protection against a host administrator.

Usage samples have stable producer/rule/day identity, cumulative counters and
exact acknowledgment checkpoints. Failed acknowledgments retain the sample for
retry. A crash can lose bytes that have not been recorded; these checks do not
establish exact financial billing under every host/storage failure.

Public observations contain bounded machine errors, resource IDs and target
health facts without certificates, private keys or raw target configuration.
Diagnosis receives resource IDs only; it resolves the endpoint from the currently
authorized local egress rule. `TUNEX_TST_ENABLED` defaults to false. Capability
`forward.link.tst.v1` is reported only when this native runtime is enabled.

## Local runtime benchmark

Executed Windows/386 sample on the host above, with durable ingress accounting
enabled. One held TCP connection transfers 64KiB in each direction per operation.
Connection/certificate setup is outside the timed loop.

```text
go test ./internal/tstruntime -run '^$' -bench BenchmarkTSTLoopbackTCP -benchtime=1s -count=1 -timeout=60s
```

| Iterations | ns/op | Bidirectional MB/s | B/op | allocs/op |
| --- | --- | --- | --- | --- |
| 43 | 25,068,374 | 5.23 | 416,605 | 547 |

This short loopback sample includes the cost of synchronous durable accounting.
It does not measure WAN capacity, multiple Agents/rules, UDP latency, long-run
resident memory or handshake throughput. No ForwardX performance comparison was
run. Transport-only baseline and parser fuzz evidence are in
[`tst-performance.md`](../protocol/tst-performance.md).

## Limits of the evidence

- Linux was cross-compiled; no Linux runtime, service install/upgrade or production
  deployment was executed for this Agent evidence. No WSL distribution was available.
- A clean-source Windows amd64 race run was attempted with `CGO_ENABLED=1`:
  `go test -race ./internal/securelink ./internal/tstruntime -count=1 -timeout=120s`.
  It failed before tests ran: `cgo: C compiler "gcc" not found`. PATH and existing
  Visual Studio, LLVM, Git, MSYS/MinGW and user package-manager directories were
  checked for GCC/Clang/MSVC binaries; none were available. No compiler was
  installed and no toolchain was downloaded. No local `-race` pass is claimed.
- Loopback tests do not establish behavior under WAN loss, packet corruption,
  distributed denial of service or prolonged network partitions.
- The focused review recorded below is an internal implementation peer review.
  Independent external security approval remains a release gate.
- All checks concern the working tree, not a merged, published or production release.

## Internal transport/runtime boundary review

Reviewed `securelink/frame.go`, `tls.go`, `session.go`, `stream.go` and their
production runtime call sites. Scope: preallocation length bounds, TLS chain/URI/
ALPN enforcement, OPEN authorization, credit/resource limits, cancellation,
certificate expiry and shared-Forward isolation.

The review identified and fixed the following concrete issues:

1. A UDP packet-count limit could fail the entire carrier while byte credit still
   permitted the packets. The transport now resets only the overflowing
   association and returns Link credit. `TestDatagramPacketQuotaPreservesSiblingTCP`
   sends 65 empty UDP packets while holding a sibling TCP stream and verifies
   that TCP continues. Late empty datagrams crossing RESET are covered by
   `TestLateEmptyDatagramPreservesSiblingCarrier`.
2. Independent ingress/egress read deadlines expired legitimate one-way active UDP
   flows. A shared per-association activity deadline now cancels reads, writes
   and rate waits only after bidirectional inactivity; the real-network regression
   verifies both one-way traffic patterns, cleanup and subsequent reuse.
3. Concurrent TLS caps alone did not cap rapid repeated failed handshakes. The
   pre-TLS rate budget bounds this CPU admission cost on each placement and is
   verified by budget/refill and actual accept-path tests.
4. The live Panel harness exposed two Agent report contract mismatches: the
   internal `running` state leaked into a closed public enum, and nil target
   selection/time fields were omitted instead of explicit null. The runtime now
   projects ready/updating/rolled_back/cached/closed states and the reporter uses
   a dedicated target DTO. These fixes preserve the closed backend schema.
5. Snapshot refresh could renew a lease before an older same-generation command
   reached the Agent, turning the legitimate late duplicate into `invalid_payload`.
   A matching still-valid duplicate now returns the already applied longer lease
   without mutation. This applies only to the same full fingerprint and active
   applied generation; expired, conflicting, deleted or failed newer-generation
   inputs continue to fail closed. The exact ordering regression holds live TCP
   through both deliveries and verifies the encrypted cache bytes remain unchanged.

No additional authentication bypass, arbitrary egress target selection,
preallocation overflow or implicit plaintext fallback was found within this
focused inspection. This statement is scoped to the reviewed code and executed
tests. It is not a security proof. External reviewers should still cover issuer
and Controller fencing, filesystem TOCTOU, concurrency/race execution, sustained
malicious frames, distributed admission, Linux deployment and failure recovery.
