# Station And Notification Owners v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2 seventeenth/eighteenth source slices. No new execution capability.

## Public Ownership And Complete Call Chains

| Entry | Rules and coordination | Required providers | Original state owner |
| --- | --- | --- | --- |
| station-alert-owner/public.ts | StationAlerts, policy/event/state validators, evaluator/transitions, API and limits | L1 transaction/Scope/idempotency/storage/facts; public Audit vocabulary; public L2 native values; optional StationEventHandoff | Existing station policy/audit/event/loss tables, original observation facts |
| notification-owner/public.ts | NotificationEndpoints, NotificationDeliveries, endpoint/payload/delivery/attempt rules, APIs and storage values | L1 transaction/Scope/idempotency/endpoint/outbox storage, Vault/Sender; public Station policies/events/reasons; public L2 native values | Existing endpoint/outbox/attempt/rate/loss tables and existing protected vault |
| framework/public.ts / notification-effects-ports.ts | Original external-effects declarations only, candidate interface 1 | Original secret-binding/destination/lease/vault and sender inputs/results | No new state or implementation |
| infrastructure/notification-secrets.ts and notification-https.ts | Existing native vault and controlled HTTPS implementations | Public L1 effects and existing Core/L2 format helpers | Same native files, key/lease state and physical sender lifetime |

The actual service/rule/contract/API/storage-value implementations move into the
two L3 owner directories, not just new barrels. Existing lower SQL sources are
unchanged. Native Vault/Sender now import their exact original interfaces from
L1, removing the former L2-to-L3 type dependency. No required argument, optional/
null field, result vocabulary, schema or behavior is changed by moving declarations.
Notification product contracts re-export those same lower names for compatibility.

StationEventHandoff is the producer-owned public output port. It keeps the exact
original policy/event/now arguments and supplied transaction, while the original
notification-delivery port route re-exports it. Station no longer depends on the
consumer's product interface. Notification still validates and enqueues the same
event through that port; there is no new event bus, copy of source state or
asynchronous replacement for the original atomic transaction.

## Station Commands, Evaluation And Event Handoff

The original per-instance admission/cooldown/ticking state remains in StationAlerts.
Constructor defaults, policy clock/skew guards, Scope authorization distinctions,
closed query/receipt validation, idempotency framing/replay and quota/CAS order
remain in their original source positions. Publish retains the known-target
disable shortcut, fact validation, config digest/change determination, clock check,
independent config revision, state reset, audit and response order. Silence checks
a new deadline after replay; acknowledgement uses event revision, not a current
policy revision. GET/history do not run the evaluator or dispatch work.

Evaluation remains derived evidence. Original rule/threshold/target restrictions,
unknown/firing/clear precedence, administrative and recovery states, operation
successor proof, Node freshness baseline, process/session instance invalidation,
credential-renewal proof, episode counters and clock-regression behavior remain
in the single original evaluator/transition implementation. Unknown is not clear,
a new Node instance is not recovery and an observed condition is not execution
permission or an independent end-to-end health conclusion.

Tick still selects due without taking its ownership locks, reads/validates the
candidate, checks the original manager, then locks Scope/policy and rechecks
revision/manager/enabled/suspension/deadline before facts/evaluation. When an event
exists, append it, call optional enqueueIn with the SAME Tx, then update policy
state/next evaluation. Any handoff failure rolls back those writes together.
Failure deferral remains a separate guarded transaction using the attempted
revision/cutoff, with the original five-minute delay and ticking-finally cleanup.

Storage projections remain the original L3 assertions, not earlier full business
validation inside SQL. The fact error-code Set still uses the original Audit
vocabulary, null/OTHER_ERROR behavior and initialization. Existing MySQL wrappers
retain their original policyCount override, zero-argument construction and methods.

## Notification Endpoint And Protected Material

Endpoint commands retain original config/destination validation, manager auth,
idempotency replay before secrets availability, Scope lock/current revision/quota,
selected Station policy validation, clock and Authority-binding read. Vault stage
still precedes SQL endpoint publication and audit/receipt, with the same immutable
credential revision/reference and rollback-orphan behavior. Disable changes only
the original enabled/config/revision fields and does not read/test a destination.
Read projections continue excluding authority digests, credential references, raw
destinations and signing keys, including the same configured/not-read-on-get flags.

The original Vault/Sender implementations change only their type-import source.
Their platform/security behavior is not widened. Vault open retains its explicit
Linux/getuid/absolute-canonical-path refusal and protected storage/locking rules;
it remains separate from Authority material and SQL backups. Sender retains its
original native destination/DNS/dispatch/lifetime behavior. This source move is
not evidence of cross-platform support, delivery success or native acceptance.

## Notification Handoff, Claim And Dispatch

enqueueIn still verifies policy/event identity and time before endpoint Scope/
route reads, maps only route integrity failures into routingRejected, filters
the same enabled/subscribed routes and records disabled/silence suppression before
creating original deterministic payloads/outbox rows. It shares the Station Tx;
no resource/Runtime/Probe command or separate transaction is introduced.

Claim retains header observation, unlocked candidate read, sorted distinct manager
authorization then Station Scope/policy, endpoint Scope/head and outbox Scope/head
locks/revision check. Original denial precedence, active/rate capacity, expired
claimed attempt accounting, event lifetime, attempt/fence/revision increments and
claim/attempt writes remain unchanged in source. Preflight reacquires those owners
and enforces status/Fence/time/expiry plus the original five-second dispatch margin.

Sending remains outside the claim transaction. Acquire the original bound Vault
lease, parse its destination, create temporary hex key bytes, supply beforeDispatch
to the same Sender, then finish with the original claim revision/Fence/time guard,
attempt result, retry codes/backoff/lifetime and terminal state. Key bytes are
zeroed in the inner finally. Sender idle is awaited in the outer finally BEFORE
releasing the Vault lease, even on errors or a timeout result; logical completion
does not stand in for physical DNS/guard/socket completion. Failure deferral and
close/stopping/running semantics stay in their original positions.

History/detail keep manager authorization, retained fixed windows/canonical cursor,
share-locked detail head and bounded attempt tail, filters/order/uniqueness/loss
checks, original response bytes/freezing and safe public projections. No GET sends,
reenqueues, tests credentials or promotes an event into authorization or health.

## Compatibility, Evidence And Remaining Work

Old application classes/APIs/values/storage-value files, flat ports and selected
observation-policy exports directly alias their canonical leaves. They retain the
original export surfaces and single implementations; constants-only/type-only
paths do not import a whole new service root. New consumers use public owner roots.
Existing server composition keeps the same station/endpoint/outbox/vault/sender
instances and handoff; no new root, pool, worker or protected-history clearing.
Legacy SQL wrappers retain count/get overrides at their original callback points.
Remove these aliases only after consumer inventory, matching-source compatibility
acceptance and separately confirmed removal, never as an implicit source cleanup.

Readiness 70-72 are planned only: Station rule/command/transaction compatibility,
lower effects/native and endpoint compatibility, and outbox/dispatch/worker/read
compatibility. No tests/type/syntax/static/boundary checks, formatter/generator/
build, native/network/MySQL/browser/container experiment, CI, commit/push or
delegation ran. Later functional evidence belongs in authorized GitHub Actions
on the same frozen source; physical-host gates remain separate.

Probe history/plan, telemetry and other application/HTTP/private dependencies,
A1 residuals, Agent Probe/native, Runner and full source/type/default/bridge
classification remain open. These source slices do not establish A2/foundation
acceptance, native compatibility, release readiness or an upper-module gate.
