# ADR-0038: Bounded Station Alerts

Date: 2026-10-18 (Asia/Shanghai). Status: D3-B first slice, locally implemented,
unverified. See [contract](../spec/station-alerts-v1.md).

## Decision And Ownership

Add a station-alert owner with version1 fixed policies, persisted condition state,
station events, bounded policy audit and acknowledgement. Three rules only:
`forward-operation-failed`, `node-report-stale`, `node-credential-expiring`.
No arbitrary expressions, SQL, target addresses or dynamic evaluator plugins.
Pure parsing/evaluation/reduction lives in `application/station-alert-values.ts`;
narrow fact/read and alert-store ports keep original execution owners unchanged.

The alert owner writes its own policy/state/event metadata, not Forward, Operation,
Snapshot, Probe, credentials, Journal or physical high-water. Policy commands use
original manager authorization and Idempotency in one transaction. Observer checks
the current manager status of `managedBy` before evaluation; loss of authority
suspends policy, never grants observer execution power. Scope viewer may read
station events; policy read/publish/silence and event acknowledgement require manager.

Default-off `TUNEX_STATION_ALERTS=1` enables the independent non-reentrant5-second
observer, at most one due policy per tick and at least30 seconds per policy.
Failures back off30 seconds to5 minutes. GET never evaluates or sends. No network,
Runtime command, active Probe, auto-retry, automatic switching or webhook sender.

## Honest Conditions And Recovery

An event is detection at evaluation time, not reconstructed historical transition.
Initial firing records a currently observed condition; initial clear emits nothing.
Repeat firing updates the same episode without one event per tick. Unknown facts
do not recover or clear a firing incident. Backwards evaluation time is unknown.

Operation rule requires exact current Forward revision and latest eligible
create/update/enable/retry Operation, with enabled, nondeleting, nonsuspended intent.
Recovery requires a different succeeded Operation, no earlier creation time, and
either a newer target revision or direct retry source matching the last failure.
Same-Operation failed-to-succeeded is not proof. The recovery reason is deployment
success after failure, never end-to-end target health. Administrative/in-progress
states and invalidated recovery records do not establish recovery.

Report rule uses only exact current Node/boot/session/sequence/Snapshot report
identity, observed/received time and credential validity. A valid fresh baseline
arms one process/session before stale may fire; first-seen stale is unknown.
Boot/session replacement invalidates an old incident rather than recovering it;
only fresh new-instance evidence can rearm. Missing/invalid/revoked/expired evidence
and excessive future clock timestamps are unknown, not target failures.

Credential rule includes expiring and expired windows. Null is unavailable;
revocation is administrative. Recovery requires a later credentialUntil greater
than the last failure and outside the threshold. Clock reversal cannot recover it.

## Silence, Bounds And Recovery Quarantine

Silence marks new events while continuing condition evaluation and durable events;
it neither clears incidents nor replays silenced events later. Acknowledgement means
seen, not recovered. Config publication/adoption/rearm resets state/configRevision;
silence changes policy revision without resetting condition state.

Per Scope bounds:64 policies,1024 events,256 policy audit entries. Events retain at
most30 days with visible eviction/expiration counters. Requests cap events50,
audits16 and response256KiB; admission2 active/128 actor keys/1-second cooldown.
Silence at most7 days. Bounded output/retention is not SQL-cost, physical capacity,
complete historical discovery or global event delivery proof.

Original recovery quarantine suspends policies, empties evaluation state and marks
old events recoverySuspended without redelivery. No automatic resume; protected
Journal/high-water remains untouched. Restored metadata never grants execution.

This source-only slice has no tests, static/type/syntax checks, formatters, generated
fixtures, CI, commit or push. Alert delivery/outbox, SSRF-safe webhook, notification
retry/dedupe/rate control and further channels remain separate work. Notification
failure must never change original deployment success. D3/project not complete.
