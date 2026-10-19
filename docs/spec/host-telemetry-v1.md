# Agent-Visible Host Telemetry History v1

Date: 2026-10-18 (Asia/Shanghai). Status: implemented locally, unverified.
[ADR-0029](../decisions/0029-independent-host-telemetry.md) and
[wire contract](../protocol/host-telemetry-v1.md) describe D2-C's independent version.

## Source And Limits

Linux reads bounded `/proc/stat`, `/proc/meminfo`, `/proc/loadavg`, `/proc/net/dev`
and `statfs('/')`. CPU ticks/count, memory availability, scaled OS load, root filesystem
space and raw interface bytes describe only the Agent-visible OS/namespaces.
Containers can see OS totals inconsistent with their own cgroup quota: this slice
does not collect cgroup limits or promise physical-host capacity/ownership. Other
platforms are unsupported; source failures are unavailable/null, not zero load.
Network inventory returns at most 16 of at most 128 known interfaces with explicit
coverage; counters are raw, not per-Forward traffic or interface-rate estimates.
Source reads are capped at 1 MiB (`stat`), 64 KiB (`meminfo`), 4 KiB (`loadavg`)
and 128 KiB (`net/dev`). The network scan limit counts loopback too, but returned
inventory excludes `lo`; exceeding the scan limit makes that source unavailable.
Memory `kB` is converted as 1024 bytes. No host mounts, shell commands or extra
capabilities are required by the sampler. Sources are read sequentially, not as
an atomic OS snapshot; the capture timestamp follows successful collection.

Control and Agent Host telemetry switches are independently default off, separate
from process/Forward telemetry. Ten-second sampling, independent epoch/sequence,
cloned mTLS transport, two-second deadline, 8 KiB samples and 4 KiB ACKs bound export.
OS sampling separately has a 500-millisecond budget and at most one non-authoritative
worker per exporter. A timed-out proc/statfs call cannot accumulate workers or publish
late values; cancellation does not wait for uncancellable OS I/O. Two seconds is the
network deadline, not an allowance for unbounded sampling waits.
No queue, retry, guaranteed tail or re-enrollment. Observation never grants execution,
alters ADP/Journal or writes Runtime/Operation state.

## History

```text
GET /api/v1/scopes/{scope}/nodes/{node}/host-telemetry?from=<canonical-UTC-ms>&to=<canonical-UTC-ms>&limit=128
```

Bearer authentication is admission-capped and performed in a short transaction on
the shared observation pool; a later separate transaction checks Scope/Node ownership
and reads projection data on that same pool. These are not one atomic transaction.
Existing credential/identity owners preserve normal semantics; non-telemetry APIs
remain unchanged. Brief Scope/credential shared locks and hardware remain shared.

Unknown/duplicate query parameters reject. Canonical UTC millisecond `from`/`to`
select a receipt-time window of at most 24 hours; default is 15 minutes, default limit
128, maximum 512. Missing latest/history is not zero resource use. Freshness is only
observation recency/current machine-session classification, not host or traffic health.
Restored, revoked, disabled or foreign-session observations remain historical.

The closed response contains `hostTelemetryVersion`, `nodeId`, `enabled`, `source`,
`health`, `executionAuthorized`, `observedAt`, `currentSession`, `nodeRevoked`,
`window`, `retention`, `latest` and `items`. Each point contains `sample`,
`receivedAt`, `recoverySuspended`, `sessionCurrent`, `freshness` and `delta`.
The closed delta contains `status`, `elapsedMs`, `cpuTotalTicks`, `cpuIdleTicks`,
`cpuIoWaitTicks` and `exportDroppedSamples`. Only `continuous` has an elapsed
interval; baseline/historical have no export delta. Latest is independent of the
selected subwindow and can use its own retained predecessor. READ COMMITTED
queries are not a global snapshot or a guarantee the current session stays current.

CPU derivation uses exact integer tick differences and ratios only across adjacent
sequence, same epoch/session, increasing uptime, same CPU count, available samples,
no exporter loss and no counter regression. Exact CPU delta fields are
`cpuTotalTicks`, `cpuIdleTicks`, `cpuIoWaitTicks`; total must advance and idle+iowait
differences must be valid before deriving the ratio. Generic `continuous` may expose
only elapsed time with null CPU deltas when CPU sources/count are unsuitable.
Show baseline/gap/counter-reset/historical
or unavailable states when conditions fail; do not interpolate zero values. Network
has no rate because interface names can be reused. Raw load is not utilization or p95.
Console is manual bounded history with visible source/scope, UTC/timezone, missing
data and continuity; no polling or automatic operational decisions.

## Storage, Recovery And Evidence

0022 `host_telemetry_heads` / `host_telemetry_points` is an independent read model,
not a financial or execution authority. It shares the existing two observation pool
connections with process/Forward telemetry, no waiting queue/retries, four pre-auth
admissions, two active service requests, one-second actor cooldown and 1.5-second
database hard deadline. Saturation rejects monitoring; it does not justify a zero-
impact claim without capacity acceptance.

Logical raw TTL is 24 hours and maximum 8640 points per Node including restored rows.
Expired cleanup is at most 256 rows per transaction; query at most 512 points.
At 8 KiB per body, the logical JSON cap is 67.5 MiB per Node, not physical disk capacity.
The 30-second retention worker processes process/Forward/Host families serially,
one batch of at most 256 each; one failure does not skip the remaining families.
Physical deletion can lag and capacity may discard history; database/index/log/backup
overheads are additional, not a proved physical storage budget. No rollups are included.

Control-only profile `adp3-host-telemetry-v1` has Schema ceiling 0022; older profiles
reject after migration even with feature off. Agent ADP/Journal profiles are unchanged.
Original maintenance/credential quarantine precedes clearing Host ingestion heads
and marking restored points recovery-suspended. Keep raw points and protected
Authority/Journal/Fence/Generation history. New authenticated sessions establish new
baselines; old samples do not resume authorizations or current measurement continuity.

No tests, static checks, generator, browser/Compose/MySQL validation or Actions were
run; no commit/push. Source and Console wiring are unverified, not acceptance.
The subsequent [Probe counter slice](probe-telemetry-v1.md) is also implemented locally
and unverified. Aggregates, physical capacity and concentrated final
exact-SHA acceptance remain open; D2 and project completion are not claimed.
