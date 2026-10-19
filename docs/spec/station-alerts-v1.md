# Bounded Station Alerts v1

Date: 2026-10-18 (Asia/Shanghai). D3-B first slice: local implementation,
unverified. Decision: [ADR-0038](../decisions/0038-bounded-station-alerts.md).

## Fixed Policy

Config is the exact object `schemaVersion`, `rule`, `target`, `enabled`,
`thresholdSeconds`. `schemaVersion` is1; target is exactly `{kind,id}` with a valid
original ID; enabled is boolean. Unknown keys/rules/types are rejected.

| Rule | Target | Threshold seconds |
| --- | --- | --- |
| `forward-operation-failed` | `forward` | exactly0 |
| `node-report-stale` | `node` | integer30..3600 |
| `node-credential-expiring` | `node` | integer60..604800 |

There is no free expression, SQL, arbitrary endpoint or automatic action. Policy
contains revision/configRevision, config digest, managedBy, created/updated times,
silencedUntil, suspension, next evaluation and persisted state. Silence updates
revision without resetting state. Publishing/adopting/rearming config resets state
and advances configRevision when config, manager or suspension actually changes;
same config, same manager and no suspension is a no-op, not an unconditional rearm.
Current manager authorization and original Idempotency share
the command transaction. Suspended managedBy cannot continue evaluating policies.
Disabling a previously authorized policy for the same target does not require
reading broken current fact content. This safe metadata stop creates no new target
association and still checks current manager permission, CAS and original request.

## Evidence And Current-State Meaning

All times are numeric UTC epoch milliseconds, safe integers0..253402300799999,
including public DTOs. Closed evidence variants are `operation`, `node-report`,
`node-credential` and `unavailable`. Only allowlisted audit error codes survive;
unknown source codes map to OTHER_ERROR. Raw errors/configuration are not returned.

Operation evidence retains targetId, Forward/target revision, Operation identity,
kind/status/sourceOperationId, createdAt/updatedAt, sanitized error code and recovery
invalidation. Eligible kinds are create/update/enable/retry only; evidence must be
the latest Operation at exact current Forward revision, with enabled, nondeleting,
non-recovery-suspended Forward. Failed fires. Accepted/running/superseded, disabled,
deleting and administrative Operations do not prove healthy or recovered.

Recover an existing Operation incident only with a DIFFERENT succeeded Operation,
createdAt not earlier than the last failure, and either greater targetRevision or
sourceOperationId equal to that failure's Operation ID. Same-Operation mutation
does not recover. `deployment-succeeded-after-failure` describes deployment state,
not target/network/application health. No immutable transition log is inferred.

Report evidence must already match current Node/boot/session/report sequence and
Snapshot generation at the reader. It includes observedAt, receivedAt and matching
credentialUntil. Missing/invalid evidence, revoked Node or expired credentials is
unknown, not target failure. Timestamps beyond allowed future clock skew are unknown.
The reader validates persisted scalar headers and identities; it does not recompute
the full Snapshot/config digest or attest a real network listener or target path.
Freshness uses `now-min(observedAt,receivedAt) <= thresholdSeconds*1000`.
An exact process/session must first produce a fresh baseline to arm stale detection;
first-seen stale returns `fresh-baseline-required`, not firing. Instance key derives
from policy target, bootId and sessionEpoch, not current mutable topology.

Credential evidence contains only targetId and credentialUntil. Null is unavailable;
revocation is administrative. Expiration fires, as does remaining time at or below
threshold. Existing firing recovers only after credentialUntil increases beyond
the last failing value AND remaining time exceeds the threshold. Clock reversal
is never credential renewal.

No telemetry point, missing counter, gap, disabled exporter, unknown Probe outcome
or unavailable host capacity is silently converted into target failure or recovery.
No DNS/socket/HTTP/Probe execution accompanies fact reading.

## State And Station Events

State has condition unknown/clear/firing, episode, instanceKey, armed, openedAt,
opening, lastFiring, last evaluation and evaluatedAt. First clear emits no event;
first firing opens one episode at evaluation time (not source failure start time).
Repeated firing updates lastFiring without another firing event. Unknown preserves
existing firing/opening and cannot prove recovery. Backwards evaluated time yields
clock-regression unknown and keeps the prior time fence.

New valid report boot/session invalidates the old firing episode with
`instance-changed`, not recovered. Reset its baseline; fresh new-instance evidence
may arm it, while stale new-instance evidence remains unknown. Events are only
firing/recovered/invalidated and retain reason, evidence, opening, episode, policy
and config revision/digest, occurrence time, silence and acknowledgement metadata.
Detection time is not a reconstructed historical transition or completeness proof.

Silence is at most7 days and marks generated events while retaining state/events.
It does not clear firing, halt evidence accounting or send a catch-up burst after
expiration. Acknowledgement only records that a manager saw an event. It is not
repair, incident resolution, Probe success or deployment authorization.

## Admission, Storage And Observer

Policy audit `publish`/`silence` revision refers to policy CAS and has null eventId.
`acknowledge` audit instead uses the acknowledged event's new CAS revision and
non-null eventId; configRevision/configDigest come from that event's original
policy snapshot, not today's policy. Event revision starts at1 and increments on
first acknowledgement; subsequent acknowledgement with a new key returns changed
false. Acknowledgement revision need not be greater than configRevision.

A succeeded Operation without prior firing is only `deployment-succeeded`
baseline, not `deployment-succeeded-after-failure` recovery.

`TUNEX_STATION_ALERTS=1` enables the default-off observer. Independent5-second,
non-reentrant ticks select at most one due policy. Each policy interval is30 seconds;
failure backoff is30 seconds..5 minutes. No overlapping evaluator or GET evaluation.
One failing policy is conditionally deferred for five minutes in a separate short
transaction after its failed evaluation rolls back. Revision/due guards prevent
overwriting newer management or committed evaluation. This changes only due time,
not condition/history, so a bad oldest policy need not monopolize other due work.
If storage also rejects deferral, preserve the original state and apply host backoff.
Current managedBy Scope manager permission is checked in the evaluation transaction;
otherwise policy suspends as actor-not-authorized. No fallback into Runtime commands.

Limits:64 policies/Scope,1024 retained events/Scope,256 retained policy audits/Scope,
audit page16, event page50, event retention2592000000ms, evaluation interval30000ms,
silence maximum604800000ms, response262144 bytes,2 active requests,128 actor keys,
1000ms actor cooldown. Expose event eviction/expiration and audit eviction counters.
These are bounded metadata budgets, not physical capacity or complete history.

Viewer may GET station events. Manager may GET policies, PUT policy publication,
POST silence and POST event acknowledgement. Mutations use CAS and original
Idempotency; read does not evaluate. No raw fact bodies, secrets, free-text errors,
arbitrary actions or raw owner configuration are returned.

Original recovery quarantine suspends policies as recovery, resets state, and marks
old events recoverySuspended without replay. Explicit current-manager rearm/adoption
is required; no automatic restart of old incidents. Never clear protected Journal,
physical high-water, original authorization or recovery state.

No webhook/outbox, external notification, auto-retry or auto-failover in this slice.
Those require separate bounded delivery ownership, rate/retry controls and SSRF
protection; sending failure cannot alter Forward/Operation success. No tests,
static/type/syntax checks, formatting, fixtures, CI, commit or push performed.
D3 and the project remain incomplete and locally unverified.

## HTTP And Console

All endpoints are under `/api/v1/scopes/:scope` with original Bearer authentication.
Identity lookup uses the bounded observation pool before the supplied authorization/
projection or command transaction. There is no fallback to the Runtime pool.

| Method and resource | Permission | Meaning |
| --- | --- | --- |
| `GET /alert-policies` | manager | Up to64 policy heads; no automatic evaluation |
| `GET /alert-policies/:id` | manager | Exact current policy/state and latest16 audit rows plus truncation |
| `PUT /alert-policies/:id` | manager | `{expectedRevision,config}`; expectedRevision0 creates, otherwise exact CAS |
| `POST /alert-policies/:id/silence` | manager | `{expectedRevision,until}`; numeric future deadline within7 days or null |
| `GET /station-events` | viewer | Fixed-window filtered keyset history |
| `GET /station-events/:id` | viewer | Persisted single event, not a new observation |
| `POST /station-events/:id/acknowledge` | manager | `{expectedRevision}` event CAS; no condition change |

Commands require original `Idempotency-Key`, reject queries and closed/duplicate JSON
violations, and reply200/202 with exactly `{policyId,revision,changed}` or
`{eventId,revision,changed}`. Current manager permission is checked before same-key
replay. Unknown submission is not rejection; explicit identical replay uses the
original method/URL/body/key. Newly accepted silence deadlines are checked after
replay, so an old accepted deadline can still return its original receipt.
Publication config plus body is at most2048 bytes; silence/ack body at most1024.

Only history accepts query parameters: `from`, `to`, `limit`, `cursor`, `policyId`,
`targetId`, `rule`, `kind`, `acknowledged`. Unknown/duplicate parameters are rejected.
`from/to` input is canonical UTC `.sssZ`, `[from,to)`; default is24 hours, maximum
30 days, with from no earlier than current retention horizon and to no later than
the accepted clock-skew bound. `limit` defaults25/max50; identities/rule/kind are
exact conjunctive filters, acknowledged is exactly true/false. Every filter and
cursor predicate precedes LIMIT. The unsigned <=1024 base64url cursor binds Scope,
fixed window/filters/limit and DESC(occurredAt,id); continuation must resend the
original explicit window. It is neither authorization nor cross-page snapshot.
Acknowledgement, retention and recovery can change later pages; no totals are given.

Every read includes stationAlertsVersion1, scopeId, capturedAt (epochms), observerEnabled,
limits, source persisted-station-alerts, readOnly true, executionAuthorized false,
health unknown, networkCheck not-performed and consistency read-committed-not-global-snapshot.
List policies uses items of head metadata plus condition/evaluatedAt/lastReason;
single policy uses policy and audit `{items,truncated}`; single event uses event.
History adds numeric window `{from,to}`, normalized filters, limit/items/hasMore/
nextCursor and losses `{eventsEvicted,eventsExpired,auditEvicted}`. Config/state/event
fields are precisely the closed version1 port types. General policy revision is
CAS for management; configRevision partitions condition episodes across changes,
adoption and recovery rearm. Event revision is separate acknowledgement CAS.

The Console separates viewer event reads from manager commands without inventing
a cached browser role. All loads and continuation are manual, numeric times render
in UTC and Asia/Shanghai, input/auth changes abort and clear old results. Five-second
local cancellation does not cancel a committed command. An uncertain write locks
other panel actions until explicit identical replay or warned local discard;
successful commands require a manual reread before further action. No navigation
auto-fetch, polling, event export, implicit evaluation or external channel is added.
Retention is bounded row-count plus incremental expiry, not immediate physical
deletion on the thirtieth day, a complete event log or a delivery guarantee.
