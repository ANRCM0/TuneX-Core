# ADR-0027: Independent Node Process Telemetry and Bounded Raw History

Date: 2026-10-18 (Asia/Shanghai). Status: accepted for incremental implementation.
Implementation is local and unverified. Tests/checks and fixes follow source freeze.

## Decision

D2 starts with the existing measurable Agent process resources and local execution
gauges, connected end to end through a separate telemetry-v1 envelope, mTLS intake,
bounded MySQL read model and Console history. This is one part of D2, not a
replacement for planned host metrics, ingress payload counters or longer rollups.

The strict ADP/3 Hello/Report/Snapshot/lease formats do not change. The optional
`POST /agent/v3/telemetry` endpoint has its own version, sample epoch and sequence.
Neither successful intake nor freshness can authorize execution or prove health.
The default-off Control and Agent switches are independent. No new listener,
enrollment credential, Probe grant, Core entity or Journal format is introduced.

## Execution and Storage Isolation

The Agent runs one independent ten-second sampler with one in-flight HTTP request,
a cloned transport and a two-second timeout. Failed or unacknowledged exports are
counted and discarded, not queued or retried by the execution loop. A new exporter
gets a random epoch; ADP sequence and protected state are never reused for metrics.
Only execution references are copied under the Runner lock. OS sampling, stream
gauge reads and export occur outside that lock. No final-tail delivery is promised.

Machine admission caps the route before authentication. For both telemetry machine
routes the middleware verifies TLS and certificate fingerprint but skips the main-pool
`Nodes.machine` query. The strictly parsed Node claim is authenticated by the unchanged
`Nodes.credential(tx,node,fingerprint)` owner on the observation connection; this is
not an unverified Node-label bypass. History admission also caps requests before
Bearer authentication; `Identity.authenticateIn(tx,header)` uses the original token
hash/query semantics in a short authentication transaction on the observation pool.
That transaction ends before history opens its separate Scope-authorization/projection
transaction on the same observation pool; authentication and history are not one
atomic transaction. Normal API authentication remains unchanged.
The intake transaction reuses `Nodes.credential` through its supplied transaction,
then reads current Node boot/session without taking a Runtime row lock. It may
only lock/write the telemetry checkpoint and points. Two dedicated nonqueuing
MySQL pool slots and short connection/transaction deadlines isolate telemetry
work from the Runtime pool; no retry loop or await is added to Runtime renewals.
The two slots are shared with independent Forward telemetry, not duplicated per route.
Normal non-telemetry authentication paths are unchanged. Database hardware and brief
owner Scope/credential `FOR SHARE` locks remain shared; capacity and
contention behavior still require concentrated verification.

One checkpoint per existing Node serializes accepted samples across Control
processes. A same-sequence/same-digest replay returns its original receipt;
sequence regression or changed-body reuse rejects. A different exporter epoch
within the same Node session rejects. A new authenticated Node session establishes
a baseline, not a cross-session delta. Persistent receive-time admission allows
at most one new point per nine seconds even across process replicas.

Migration `0020-node-telemetry.sql` adds only operational `telemetry_heads` and
`telemetry_points`. The hard point cap is 8640 per Node. Queries exclude points
older than 24 hours; expired physical rows are deleted in pages of at most 256
by intake and an independent retention worker. Cleanup can lag or pause during
maintenance; there is no exact TTL-deletion-time or cluster capacity guarantee.
Checkpoint metadata is not a retained process sample. No minute/hour aggregates
or unbounded per-payload labels are created.

## Reading and Interpretation

Scope authorization and exact Node-in-Scope validation precede history reads.
Windows are at most 24 hours, returned pages at most 512 points, and per-actor
cooldown/admission are bounded. UTC receipt time selects and orders history;
Agent capture time remains distinct. Read-committed pages are not global
snapshots. Latest may be outside the requested subwindow, but within raw retention.

The API labels `baseline`, `continuous`, `gap`, `counter-reset` or `historical`.
CPU deltas use exact integer arithmetic only for consecutive same-epoch samples
with advancing monotonic uptime and no newly reported export failures. Null,
missing, truncated or old data is never synthesized into zero or healthy state.
An unacknowledged export may actually have committed; its failure counter records
export uncertainty, not an exact count of absent database points or packet loss.

## Upgrade and Recovery

The reviewed Control-only profile is `adp3-node-telemetry-v1`, Schema ceiling 0020.
Old ADP/3 Agents remain compatible with the runtime protocol but do not provide
these samples. Older Control schema ceilings remain blocked by upgrade assessment,
even with collection disabled. New template flags require matching Agent images.

The existing offline recovery owner deletes telemetry checkpoints and marks
restored points `recovery_suspended=true` after quarantining Node credentials.
History remains available as historical evidence; fresh authenticated sessions
must establish new baselines. Authority, Journal, Fence/high-water and original
Runtime/recovery ownership are not changed.

## Pending Concentrated Verification

No tests, static checks, browser/database/network checks, Compose validation,
generators or CI were run for this slice, and no test scaffolding was added.
Cross-language strict vectors, duplicate/sequence/restart/clock cases, credential
and session races, pool saturation/cancellation, hard bounds/cleanup/recovery,
and real desktop/mobile operation remain pending. This is not a green acceptance
or production-readiness claim. The full development goal remains open.
