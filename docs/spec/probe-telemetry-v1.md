# Probe Attempt Counters And History v1

Scope clarification after [typed Direct ingress](direct-ingress-probes-v1.md):
this unchanged v1 identity/counter/history family remains egress-only. New ingress
dials are deliberately excluded, not merged with the same binding's old series.
Absence here is not evidence of zero ingress attempts or ingress health.

Date: 2026-10-18 (Asia/Shanghai). Status: local implementation, unverified.
[ADR-0030](../decisions/0030-independent-probe-telemetry.md) and
[wire contract](../protocol/probe-telemetry-v1.md) define D2-D.

## Meaning And Ownership

Agent counts actual authorized Direct TCP dial attempts, valid connected successes,
valid unreachable failures, unknown completions and current inFlight. Permit issuance,
consumption, result storage and chart-point counts are not attempt denominators.
Authority loss after dial can produce unknown even if a socket connected; unknown
is not a valid target failure. Numeric invocation registration is not an attempt.
Close marks existing inFlight unknown once; an already registered call that reaches
dial after Close adds attempted+unknown. Freeze occurs only when all registered calls
leave, not at the beginning of Close; late completions do not duplicate outcomes.
Metrics never authorize another Probe, clear replay
state or add historical writes to the existing permit/claim/result owner path.

Identity includes the complete immutable eleven-field Probe binding, instance ID/
generation and counter epoch. Runtime SELECT-only mapping verifies complete historical
published Snapshots (at most two/4 MiB each), exact active Direct TCP assignment,
driver/config/egress-policy and trusted Forward Scope. Published provenance remains
valid as historical evidence after Snapshot expiry, not execution authority.
Optional current registered-instance annotation is exact when available; old-instance
tails are not rejected just because original registration/permit/results have expired.
The annotation requires the exact instance/session/fingerprint, no revocation and
registeredAt <= observedAt < expiresAt <= registeredAt + 30000 milliseconds. Missing,
old or malformed instance slots conservatively remain not-rechecked.
No claim that arbitrary historical permits were independently validated.

## Export And Storage

Control `TUNEX_PROBE_TELEMETRY=1` and Agent `--probe-telemetry=true` are independent
default-off switches; they do not enable the original Probe workflow. Ten-second
sample loop, two-second cloned mTLS transport, independent sample epoch/sequence,
no queue/retry/final-tail promise. Limits: 32 points, two Snapshot generations,
64 KiB batch, 4 KiB point, 2 KiB exporter metadata, 4 KiB ACK. Partial rejects and
missing ACK produce exporter uncertainty; data might already be committed.
Local terminal retention is 128 items/600 seconds, lossy and process-local.
Additionally the collector keeps at most eight pure numeric CounterSet readers,
at most 256 bindings each, 600-second TTL with point-counted eviction/expiry. They
retain no Gate, context, Runner, credentials or authorization callbacks; pending
readers report state current, not premature terminal, and Close never waits for them.
Frozen sources move to value tails. Current 256 + tails 128 + retiring 8*256 permits
up to 2432 scanned points, so 32-point output/128 tails is not total processing or
memory cost. Coverage includes retiringSourceLimit 8/retiringSources and caps
available at 384+retiringSources*256; two Snapshot generations still bound wire output.

0023 `probe_telemetry_heads` / `probe_telemetry_points` is a read model independent
of the original Probe tables. It shares the existing two-connection observation pool
with process/Forward/Host telemetry, service admission two, pre-auth four, history
actor cooldown one second and database hard deadline 1.5 seconds. Four-family cleanup
runs serially each 30 seconds, at most 256 expired points per family/transaction,
continuing after failures. No queue/retry or new Runtime pool.

Per Node at most 4096 points including restored history, logical TTL 24 hours,
maximum 24 MiB logical JSON (4+2 KiB each). Capacity can evict before 24 hours;
physical rows/indexes/SQL/JSON representation/logs/backups are extra and unmeasured.
Queries return at most 512, not an assertion all original attempts were observed.

## History And Console

```text
GET /api/v1/scopes/{scope}/forwards/{id}/probe-telemetry?from=<canonical-UTC-ms>&to=<canonical-UTC-ms>&limit=128
```

Unknown/duplicate query keys reject. Canonical UTC millisecond from/to, at most
24-hour receipt-time window and limit 1..512 apply; default last 15 minutes/128.

Scope-authorized Forward history uses receipt-time bounded windows, canonical UTC
times, explicit source/identity/coverage and no automatic polling. Bearer authentication
uses a short observation-pool transaction; a later separate Scope/projection
transaction uses the same pool, not an atomic authentication/read transaction.
Existing owner semantics and normal API authentication remain unchanged. Brief
Scope/credential shared locks and database hardware still require capacity evidence.

Latest describes one exact binding/instance/counter epoch, not a whole-Forward aggregate.
Current binding is not rechecked; published Snapshot/current optional registration is
provenance, not readiness, completed Probe authorization or application health.
Missing/unavailable/terminal/recovered/session-mismatch states are explicit, never
zero-attempt samples. Deltas need same exact identity/epoch, adjacent exporter sequence,
increasing uptime, no drop/tail-loss/truncation or overflow and no cumulative reset.
inFlight is a gauge, not a cumulative difference denominator. Unknown attempts are
separate from valid completed counts; a valid TCP failure ratio is not network packet
loss, and no success ratio is reconstructed from sparse latency/result points.
Delta API contains only status, elapsedMs, attempted, succeeded, failed, unknown and
inFlightBefore, not a ratio field. Console uses exact BigInt arithmetic for an explicitly
labeled valid-outcome subset failure share for this single instance, not all-attempt
health, packet loss or a complete Forward success probability.

## Compatibility And Acceptance

Control-only `adp3-probe-telemetry-v1` recognizes Schema 0023; old Control ceilings
reject even with metrics disabled. Agent ADP/Journal profiles unchanged. New flags
require matching binaries; false unknown flags do not make an old Agent compatible.
Recovery after existing credential quarantine clears only telemetry heads and marks
old telemetry points recovery-suspended. Original Probe claim/result, Runtime,
Authority, Journal and Fence/Generation history are not cleared or rewritten.

Local code/wiring/Schema/Console remain unverified. No tests/checks/generators/new
fixtures, browser/Compose/MySQL or CI; no commit/push. D2 still needs aggregate
histories, capacity and final-source frozen concentrated acceptance. Financial
settlement, execution permission and independent health are not provided.
