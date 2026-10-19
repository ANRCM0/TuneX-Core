# Node Process Telemetry History v1

Status: implemented, unverified. Scope is D2 process sampling and bounded raw
history only. [ADR-0027](../decisions/0027-independent-node-telemetry.md) and
[wire contract](../protocol/telemetry-v1.md) define ownership and intake.

## 1. Query

```text
GET /api/v1/scopes/{scope}/nodes/{node}/telemetry?from=<UTC-ISO>&to=<UTC-ISO>&limit=128
```

Bearer identity and Scope membership are required; the exact Node must belong
to that Scope. This read does not require a Node use grant and grants no use,
execution, Probe or management permission. Unknown/duplicate query parameters
reject. `from`/`to` are canonical millisecond UTC ISO strings; default window is
the last 15 minutes. Window length is at most 24 hours, within current raw
retention with a five-minute query clock allowance. `limit` is a canonical
positive integer at most 512, default 128.

Selection/order use server receipt time inclusively, not untrusted Agent capture
time. Oldest-first rows use one extra bounded row to report `truncated`; this is
not an assertion of complete coverage. Logical retention excludes rows older
than 24 hours even when physical cleanup is behind. Latest is read independently
and may fall outside the selected subwindow. READ COMMITTED reads are not a
globally consistent snapshot or a continuous current-session guarantee.

## 2. Response

Response fields are exactly:

- `telemetryVersion:1`, requested `nodeId`, Control collection `enabled` boolean.
- `source:agent-reported`, `health:unknown`, `executionAuthorized:false`.
- Server query `observedAt`; `currentSession:{sessionEpoch,bootId}` or null;
  persisted `nodeRevoked`.
- `window:{from,to,limit,truncated}` and
  `retention:{rawSeconds:86400,maxPointsPerNode:8640}`.
- `latest` point or null; `items` of at most the requested limit.

Each point contains the validated closed wire `sample`, server `receivedAt`,
`recoverySuspended`, `sessionCurrent`, `freshness` and `delta`.
Persisted body identity, immutable numeric fields and digest are checked before
display; malformed history fails closed instead of inventing a measurement.

`sessionCurrent` requires collection enabled, nonrevoked/nonexpired Node metadata,
the same recorded boot/session and no recovery suspension. This labels a recorded
session, not a fresh credential attestation or an execution lease. `freshness`
is `historical` outside it, otherwise `fresh` for server receipt age 0..30 seconds,
or `stale`. No freshness value establishes traffic health.

`delta` has exactly `status`, `elapsedMs`, `cpuTimeNanos` and
`exportDroppedSamples`. Its statuses are:

| Status | Meaning |
| --- | --- |
| `baseline` | first selected point or new session/exporter epoch; no cross-boundary delta |
| `continuous` | same epoch, consecutive sequence, advancing uptime and no added reported export failures |
| `gap` | sequence discontinuity or new export uncertainty; no CPU/elapsed derivation |
| `counter-reset` | cumulative CPU/export count or sequence/uptime regressed; no derived CPU interval |
| `historical` | prior/recovered/disabled/revoked session observation; no current delta |

Only continuous intervals expose elapsed milliseconds and supported CPU-nanosecond
difference. Integer strings remain exact through BigInt arithmetic. CPU percentage
is process CPU-time delta / monotonic elapsed time, may exceed 100% across cores,
and is not host load. Missing/null data is never zero, healthy, p95 or packet loss.
Reported export failures may correspond to committed-but-unacknowledged samples.

## 3. Bounds, Recovery and Console

Two service slots, one-second per-actor read cooldown, at most 128 cooldown keys,
four pre-auth request slots and a separate two-connection nonqueuing
telemetry pool bound admission. Connection acquisition is limited to one second;
an owned connection is hard-stopped after 1.5 seconds with a one-second SQL lock
wait. No per-request retry or unbounded queue is added. Runtime SQL pool and ADP
execution acceptance remain separate; shared database capacity still needs
validation under representative load.

Both process and Forward telemetry machine routes verify TLS and fingerprint before
using the strictly parsed Node claim with the existing `Nodes.credential` owner in
the observation transaction. They skip only the redundant main-pool `Nodes.machine`
lookup, not machine authorization. History is admission-capped before Bearer lookup;
`Identity.authenticateIn` performs the unchanged token-hash/lookup semantics inside
a short authentication transaction on the observation pool. It completes before
the history service opens a separate transaction for Scope authorization and projection
on that same pool; the two stages are not one atomic transaction.
Normal APIs keep their original authentication
path. The two observation connections are shared by both telemetry families.
Scope and credential authorization still take brief owner `FOR SHARE` locks on
shared database hardware; isolation does not mean zero contention or proven capacity.

The hard point bound is 8640 per Node, including retained recovery history.
Per-intake expiry cleanup and the independent 30-second worker delete at most
256 expired rows per transaction. Maintenance, saturation or `worker:false`
can defer cleanup; physical TTL deletion is eventual, while queries retain the
logical 24-hour bound. Head checkpoint metadata remains separate from raw sample
retention. No 7-day minute or 30-day hourly rollups exist in this slice.

The existing recovery owner clears checkpoints and flags restored raw points
historical; new authenticated sessions establish baselines. It does not reset
Authority/Journal/Fence. Reviewed Schema/profile compatibility is documented in
[upgrade assessment](../operations/upgrade-assessment.md).

Node rows open a dedicated read-only Console dialog with explicit reload,
15-minute/1-hour/24-hour windows and 128/256/512-point bounds. It displays process
heap/runtime/peak RSS, CPU where derivable, local execution gauges, time, source,
session continuity, missing/unsupported values and truncation. Time labels use
Asia/Shanghai alongside original UTC. Closing/changing Node/range or disconnecting
aborts reads and discards stale responses; no polling or credentials are persisted.

## 4. Remaining Development and Verification

D2-B1/B2 subsequently implemented the independent [per-Forward ingress counters and
remote history](forward-telemetry-v1.md), including execution epochs/tail coverage;
that local implementation is unverified, not a completed acceptance result.
Subsequent local, unverified [Host](host-telemetry-v1.md) and
[Probe cumulative telemetry](probe-telemetry-v1.md) slices cover those source paths;
D2 still needs minute/hour rollups, capacity budgets and concentrated acceptance.
These are not inferred from this Node-local gauge sum. No business usage or
financial settlement capability is delivered here.

No tests, syntax/type/contract/boundary checks, browser/MySQL/network/Compose
checks or CI were run. No new test fixtures or CI wiring were authored. At source
freeze add/run strict TS/Go/schema vectors, dedup/epoch/ordering/clock cases,
authorization/session/credential races, timeout/pool/backpressure and raw cap/
cleanup/recovery cases, then real desktop/mobile and Agent/Control integration.
All outcomes remain unverified; existing release and physical-host gates stand.
