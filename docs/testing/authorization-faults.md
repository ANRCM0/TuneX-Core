# Authorization clock and fault evidence

This slice closes the direct-runtime gap between periodic expiry cleanup and
actual data-plane IO. It does not complete the entire Phase 2/release matrix.

## Guard and execution tickets

The Agent samples wall time together with a suspend-aware uptime counter:
Linux `CLOCK_BOOTTIME`, Windows `QueryInterruptTimePrecise`. Unsupported platforms
fail instead of silently substituting a clock that omits suspend.

`authorization.Guard` retains one clock history for the process/session. A wall
jump, rollback, backward uptime or clock read failure beyond policy latches the
guard closed. A later healthy sample does not resurrect authorization. Hello's
server timestamp is checked against the configured skew, with no dynamic relaxation.
Verifiable OS time-sync status remains an outstanding operational gate; server
timestamp comparison and synthetic clock tests are not a replacement for it.

Update: the OS provider and protected proof implementation now exists. See
[System time](../operations/system-time.md) for current verified Linux evidence, Windows refusal
behavior and remaining platform/release scope.

Each accepted snapshot obtains an immutable ticket containing wall and uptime
cutoffs. Validity is conservatively shortened by the allowed skew and certificate
expiry. Repeated equal-generation snapshots reuse the ticket. New generations can
renew current execution, while retired drain tickets retain their original cutoff.
Any drain deadline is clipped to both its duration and the retired authorization.
Once current authority has expired, a later snapshot cannot revive the same
Guard/session; online Hello and a fresh process/session are required.

TCP checks the ticket before accepting, dialing, reading and writing payload.
The wrapper checks again after a blocked read returns, before forwarding bytes.
UDP checks before admitting/processing associations and before target/client
writes. Bind and listener ownership transfer are checked around their transition.
Periodic cleanup still closes idle sockets and reclaims resources; data-plane
checks prevent renewed processing from waiting for the next cleanup tick.

## Test policy

Runtime now consumes one validated policy for Hello, snapshot assembly, capacity
acceptance, observation freshness and drain duration. The default remains ADP/2's
300-second lease and 5-second skew. Runtime rejects policy that weakens those
maximum boundaries. A trusted server setup can select shorter values for tests.

The fault harness uses poll=1s, lease=18s, renewal lead=8s and skew=5s. This obeys
the same protocol constraints and avoids a five-minute wait per fault. It is not
permission to bypass expiry or a claim that default-duration outage rehearsal ran.

## Evidence

```sh
npm run check
node scripts/run-go.mjs vet ./...
node scripts/run-go.mjs test -race ./...
npm run test:faults
```

The real MySQL/HTTPS/independent-Agent harness proves:

- Control loss preserves known running TCP/UDP only within existing authority.
- Hard expiry closes a held TCP connection, drops new UDP payload and frees listen.
- Offline restart loads high-water state but does not restore any business socket.
- Online restart establishes a new session and higher snapshot generation, then
  resumes exact TCP/UDP payloads without resetting counters.
- A disable drain with live streams cannot outlive its original authorization.
- Corrupt persisted state is rejected before Hello or listener restoration.

Go tests inject wall rollback, jumps, suspend elapsed time and failed clock reads;
they also exercise real blocked TCP/UDP IO against a withdrawn authorization gate.
These simulated clock faults do not change the host clock or affect other services.
The existing lifecycle and credential suites remain regression gates.

Evidence files are ignored `.artifacts/faults/run-*/evidence.json`, recording
commit/dirty state, Agent hash, policy, observed generations, environment and checks.
CI runs the same suite in its Linux/MySQL job and retains only redacted evidence.

An isolated local WSL Docker daemon was tested without changing system network
rules or existing services. Docker Hub and the trusted Google cache were unreachable,
so pinned-version Linux container integration was not run locally. Native Linux Go
race/socket tests did run successfully. Existing WSL Node/MariaDB versions differ
from the locked Node 24/MySQL 8.4 baseline and are not silently counted as parity.

Remaining gates include OS time-sync proof, real suspend/clock injection where
appropriate, Linux independent-process/MySQL baseline integration, capacity and
backup/restore rehearsal. Relay contracts, Web and production release work remain.
