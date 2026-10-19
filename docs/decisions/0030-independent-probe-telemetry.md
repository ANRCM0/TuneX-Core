# ADR-0030: Independent Probe Attempt Telemetry

Date: 2026-10-18 (Asia/Shanghai). Status: implemented locally, unverified.

## Context And Decision

Consumed permits and accepted result rows are not a complete attempt denominator:
short-lived permit/result storage, authority expiry, cancellation, lost ACK and no
result retry can lose outcomes. Do not add metrics-history writes to Probe authority
paths or infer attempts from graph points, consumed permits or only successful results.

The independent [Probe telemetry wire](../protocol/probe-telemetry-v1.md) and
[history contract](../spec/probe-telemetry-v1.md) count actual Direct TCP dial attempts
at the Agent, with per-binding/Probe-instance cumulative attempted/succeeded/failed/
unknown and an inFlight gauge. Close accounts existing pending work as unknown once;
registered calls that reach dial after Close still add attempt+unknown. Only after
all numeric invocation registrations leave is the source frozen terminal. This cannot authorize another attempt,
clear replay state or change the original Gate/permit/result lifecycle.

Full identity includes the immutable eleven-field Probe binding, Probe instance ID/
generation and counter epoch. Runtime owns a supplied-transaction SELECT-only mapping:
current Node/session/optional registered instance, at most two complete historical
Snapshots and a trusted Forward Scope batch. Parse and compare full bindings against
active Direct TCP assignments, config digest and egress-policy revision. Expired
published Snapshots can prove historical provenance, not current execution authority.
Current Probe instance matching is optional annotation; old instance tails remain
reportable as `not-rechecked`. Never claim each historical permit was independently
verified by this mapping. At most two 4 MiB Snapshots per batch is bounded work but
still needs representative capacity/impact evidence.

Default-off Control/Agent switches, separate sample epoch/sequence, ten-second loop,
two-second cloned mTLS client, no queue/retry/final-tail guarantee. Maximum batch 32
points/64 KiB, at most two Snapshot generations, 4 KiB point, 2 KiB metadata and 4 KiB
ACK. Partial rejects or missing ACK increase exporter uncertainty. Original ADP,
Journal, Probe permits/claims/results, Runtime ledger and health are not rewritten.

Retiring collection can keep eight pure numeric sources with up to 256 bindings each,
600-second TTL, no Gate/context/Runner/credential/callback references. Pending points
remain current until safe freeze; then values enter at most 128 terminal tails. Current
256 + value tails 128 + retiring 8*256 gives at most 2432 scanned points, exposed by
retiringSourceLimit/retiringSources coverage. Page/tail bounds are not total memory
or processing cost; source/point eviction can lose observations. Close does not wait.

Migration 0023 owns independent `probe_telemetry_heads` / `probe_telemetry_points`.
All four telemetry families share the original two observation pool connections,
1.5-second database deadline, bounded pre-auth/service admission and no queue/retry.
Thirty-second cleanup visits each family serially, at most 256 expired rows each,
continuing after a family's failure. Raw logical TTL 24 hours, at most 4096 points
per Node including restored history, query at most 512. Capacity can evict early.
24 MiB logical JSON per Node excludes row/index/SQL/log/backup physical overhead.

Control-only `adp3-probe-telemetry-v1` has Schema ceiling 0023; Agent profiles unchanged.
Recovery after original credential quarantine clears only telemetry heads and marks
old telemetry points recovery-suspended, retaining original Probe/Runtime/protected
history. Feature-off does not permit an older Control schema reader.

## Evidence And Remaining Work

Implementations and Console are local and unverified. No tests, checks, generators,
browser/Compose/CI or new fixtures; no commit or push. Ratios require explicit valid
completed counts and continuity; unknown/inFlight are not failures, and TCP failure
rate is not network packet loss. No health or settlement authority. D2 still needs
aggregate histories/capacity and concentrated final-source acceptance.
