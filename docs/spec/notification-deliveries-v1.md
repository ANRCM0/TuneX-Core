# Bounded Notification Deliveries v1

Date: 2026-10-18 (Asia/Shanghai). D3-B2 second slice: locally implemented,
unverified. [ADR-0040](../decisions/0040-bounded-notification-delivery.md).
This follows the previously unconnected [endpoint slice](notification-endpoints-v1.md).

## Source Handoff, Suppression And Losses

Only NEW station events invoke `StationEventHandoff.enqueueIn` in their own
event/state SQL transaction. No GET evaluation, retained-history scan or catch-up.
At most16 enabled endpoint configs select explicit policy IDs/event kinds.
Global flag off counts disabledSuppressed recipient decisions with no queue;
silenced event counts silenceSuppressed with no queue. Recognized route integrity
failure counts routingRejected for the source event, not inferred recipient count.
Unknown SQL/storage failure rolls back source event/state/handoff together. A full
outbox counts queueRejected recipients while retaining the source station event.
No original deployment outcome is changed by these derived notification decisions.

Loss counters are queueRejected, routingRejected, silenceSuppressed,
disabledSuppressed, rowsExpired, rowsEvicted and attemptsEvicted. They distinguish
intentional suppression, malformed routing and finite retention, not guaranteed
discovery of all historic station events or successful remote notification.

## Immutable Delivery Snapshot And Wire Payload

Delivery ID derives deterministically from Scope/event/endpoint; retained SQL
uniqueness prevents duplicate rows for that combination. Freeze endpointRevision,
credentialRevision, policyConfigRevision, policyManagedBy, endpointManagedBy and
Authority digest. DO NOT put URL, signing key or credentialRef in queued rows or
public DTO. Rotation/configuration or authorization changes invalidate stale work.

Payload is exactly notificationVersion1, deliveryId, scopeId and event summary:
id, policyId, configRevision, episode, kind, rule, target{kind,id}, reason, occurredAt.
Times are numeric UTC epoch milliseconds. No raw evidence/opening/config, network
addresses, secrets, request keys, free-text errors or support export. Payload cap
4096 UTF-8 bytes; config/payload digests cover only nonsecret summaries.

`notificationWireBody` reconstructs fixed version1 property order before JSON
serialization; do not serialize arbitrary SQL JSON property order on retry.
Signature stays `v1=` + HMAC-SHA256 hex(deliveryId + newline + exact UTF-8 body)
with fixed delivery ID header and no timestamp. Receivers MUST deduplicate IDs.
HTTP 2xx is remote HTTP acceptance only, not completion of downstream business work.

## Lifecycle And Persisted Admission

Statuses: queued, claimed, retry-wait, delivered, dead-letter, cancelled.
Each delivery expires createdAt+3600000ms and permits at most6 attempts. Claim
increments attemptCount and fence together; fence always equals attemptCount.
ClaimedAt/claimUntil identify a30000ms lease. Attempt ID derives from deliveryId/fence;
ordinal equals fence. Attempt detail is pending until closed delivered/rejected/
unknown result; detail retention cannot reset head attemptCount or create new budget.

Claim transaction checks exact current endpoint/policy snapshot, both managing
actors' CURRENT Scope manager authority, Authority binding, enabled/non-suspended
state, subscription and silence. Reserve persisted endpoint rate using its
minimumIntervalSeconds (at least10 seconds) and no more than2 active claims/Scope.
Waiting for rate/capacity is explicit; it is not permission to bypass owner checks.
One host worker is non-reentrant; SQL fencing/rate state is not an exactly-once
guarantee across processes, hosts, crashes or remote processing.

After an expired claim, first close its attempt as unknown/ATTEMPT_EXPIRED, then
schedule bounded backoff/dead-letter. Never turn lease expiration directly into
an immediate second send. Retry starts at30 seconds and caps at5 minutes within
attempt/lifetime limits. Uncertain acceptance can produce duplicate remote effects;
bounded attempts may also result in no accepted delivery. No ordering guarantee.

Exact result classification in the current worker:
- delivered/HTTP_ACCEPTED becomes delivered (remote HTTP receipt only).
- DISPATCH_DENIED becomes cancelled, not retry-wait.
- DNS_FAILED, DNS_TIMEOUT, GUARD_FAILED, CAPACITY_UNAVAILABLE, ABORTED, DEADLINE,
  RESPONSE_LIMIT and NETWORK_UNKNOWN may retry within count/lifetime limits.
- HTTP_REJECTED may retry only for408,429 or5xx. Redirects and other4xx do not retry.
- Other results, including DESTINATION_DENIED, DNS_DENIED, REQUEST_INVALID and
  CREDENTIAL_UNAVAILABLE, dead-letter rather than silently retry forever.

Backoff is min(300000,30000*2^(attemptCount-1)) milliseconds. Retry requires
attemptCount<6 AND next backoff strictly before expiresAt. Rate/capacity wait does
not consume an attempt. An expired sixth claim is dead-letter; earlier expired
claims first retain unknown and backoff, with event age checked before any new send.
After credential acquisition failure, current preflight is checked again: changed
config/permission produces DISPATCH_DENIED cancellation, not misattributed credential
failure. Dependency failure is not proof of endpoint health or absence of delivery.

## Post-DNS Guard And Actual Completion

Every attempt obtains current vault material through acquire and pins its reference.
All DNS/HTTPS work occurs OUTSIDE SQL transactions. Sender revalidates URL and ALL
DNS answers (at most8), then invokes required async beforeDispatch guard BEFORE
creating a request. Guard uses one short transaction to recheck current endpoint/
credential revision, policy/config/owners/silence, Authority digest and exact claim
fence with at least5 seconds of claim budget remaining. False is DISPATCH_DENIED;
guard exception is GUARD_FAILED; neither dispatches. Old work is cancelled when
ownership/config/silence changes, not held for a later catch-up after re-enable.

Guard may finish late: monotonic overall5-second sender deadline, abort/closed and
settled checks prevent late DNS/guard completion from initiating HTTPS. TLS1.3,
all-public answer validation, pinned IP/original Host+SNI/cert checks, no redirect/
proxy/automatic retry and bounded request/response rules remain as specified in
the endpoint contract.5 seconds bounds the sender, not remote business processing
or zero-latency revocation. Request already dispatched after the final guard cannot
be retracted by subsequent administrative change.

`send` may return deadline/abort before an actual OS lookup/guard/socket finishes.
Worker MUST await sender.idle before releasing vault lease or processing ownership.
Sender holds active slots until actual DNS+guard+request/socket completion;
close stops new sends, aborts active attempts and waits real drain. Vault pins are
process-local, at most2, GC-excluded and idempotently released only after drain.
Noncancelable lookup/guard can hold those bounded slots/worker/shutdown indefinitely;
operator process termination is not a fabricated successful drain or completed send.

Persisted timestamps/leases use UTC wall clock; network admission uses monotonic
time. Trusted synchronized operator clocks remain an assumption. Clock regressions
must not manufacture new authority or imply earlier completion. No distributed
transaction spans SQL, filesystem and remote HTTP.

## Retention, History And Recovery

Scope cap1024 delivery heads includes all statuses. Insert may prune up to16
terminal rows older than604800000ms (7 days), then one oldest terminal row if full.
NEVER evict queued/claimed/retry-wait work for capacity. If no terminal slot exists,
reject that recipient and count loss, not the source event. This is bounded lazy
retention, not guaranteed physical erasure exactly at7 days or full history.

Attempt detail cap256/Scope may evict ANY oldest detail, including pending; expose
attemptsEvicted. Head attemptCount/fence and terminal result remain, so missing
detail is not no-attempt evidence. History page max50, attempt detail page16,
response cap262144 bytes; request admission2/128 actor keys/1000ms cooldown.
Output caps do not prove SQL execution cost, filesystem/network capacity or global
cross-page snapshot consistency.

Recovery cancels queued/claimed/retry-wait rows, clears claim state and marks sticky
recoverySuspended history. Already terminal rows remain historical. No old queue
auto-resumes; republishing/rearming endpoint/policy does not replay old station
events. No Journal/high-water clearing, original Runtime status mutation or new
execution authority. Schema0031 owns notification delivery metadata only.

## Activation And Evidence

Manager-only Bearer reads:
- `GET /api/v1/scopes/:scope/notification-deliveries`
- `GET /api/v1/scopes/:scope/notification-deliveries/:id` (no query)

List has closed unique parameters from/to, limit, endpointId, eventId, status and
cursor. Bounds are strict canonical UTC ISO milliseconds in HTTP input: default
24 hours, maximum7 days, from at/after now-retention and to no later than now+skew.
Half-open `[from,to)` filters createdAt. Limit defaults25, maximum50. Exact ID/status
filters and descending createdAt/id keyset apply before LIMIT. Cursor is at most
1024 base64url characters bound to Scope/fixed window/filters/limit; continuation
explicitly retains that window. Unsigned position is not authorization or snapshot.

List envelope contains notificationDeliveriesVersion1, scopeId, numeric epoch
capturedAt, deliveryEnabled and workerState configured-not-liveness-proof/disabled,
source:persisted-notification-deliveries, readOnly:true, executionAuthorized:false,
health:unknown, networkCheck:not-performed-by-read,
consistency:read-committed-not-global-snapshot, limits, numeric epoch window{from,to},
normalized filters{endpointId,eventId,status} with null absent values, limit, items,
hasMore, nextCursor and seven loss counters. GET by ID shares base flags and
losses, returning delivery and attempts{items,truncated}; attempts order descending
ordinal and contain at most16 retained details. Neither read evaluates nor sends.
Detail GET holds a shared lock on this notification head while reading its own
attempt tail, avoiding a concurrent new claim being mistaken for corrupt history.
It holds no Runtime/resource lock and remains read-committed, not a global snapshot.

Public delivery has IDs, policyConfigRevision, endpointRevision, credentialRevision,
payloadDigest, revision/status, attemptCount/fence, claim/creation/update/next-attempt/
expiry times, closed last code/outcome/status, recoverySuspended and closed event
summary{kind,rule,target,episode,occurredAt,reason}. No managing-actor snapshot,
Authority digest, complete payload, URL/key/reference or raw errors leave this DTO.
Attempt detail contains id/deliveryId/ordinal/fence, start/finish times and closed
outcome/code/status; pending has null completion/result fields. Evicted details
do not reset head attemptCount. Dead-letter/unknown may already have reached the
remote recipient; they do not prove no delivery.

Console uses independent explicit manual history read/detail/next-page actions,
not background polling, delivery initiation or secret replay. There are NO manual
send/test/retry/redrive writes in this API.

`TUNEX_WEBHOOK_DELIVERY=1` is default off and requires configured independent
TUNEX_NOTIFICATION_SECRETS vault; enabling without it rejects server startup.
worker:false prevents automatic worker timer, so an enabled flag is NOT liveness
or delivery proof. No manual send/test/retry route bypasses the persisted workflow.
The automatic host timer is1000ms, skips reentry and backs off storage failures
30 seconds..5 minutes; this is distinct from per-delivery retry and endpoint rate.
Shutdown stops the worker/sender and awaits actual idle before closing the vault.

All concentrated acceptance remains UNVERIFIED: no tests/static/type/syntax checks,
formatters/scripts/generated fixtures, feature network calls, CI, commit or push
in this source-only slice. SSRF/rebinding/TLS, uncertain acceptance, multi-worker
claims, revocation races, rate/capacity, vault pin/GC, recovery and real recipient
dedupe need corresponding later evidence. D3/project/production readiness not complete.
