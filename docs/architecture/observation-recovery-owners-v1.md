# Observation Recovery Owners V1

Date: 2026-10-19. Source-only implementation under FR-0017; unverified, not
accepted, frozen, merged or released. The complete FR proposal preceded these
source edits. This slice covers only original Telemetry, Station and Notification
quarantine operations inside the existing restored-database transaction.

Main integration follow-up: framework/public exports, all three original owner
callbacks and the old operator composition now bind this source through the complete
RecoveryQuarantine/Workflow chain. Readiness161 and163 are planned/unexecuted;
recovery-owner-workflow-v1.md describes the full integration and external failure
boundaries. The transaction/native extraction is authored, not accepted recovery.

## Public Contracts And Source Ownership

L1 `framework/observation-recovery-storage-ports.ts` adds
OBSERVATION_RECOVERY_STORAGE_INTERFACE_VERSION=1 and three native-neutral ports:

| Contract | Exact required method |
| --- | --- |
| TelemetryRecoveryStore<Tx> | quarantineRecovery(tx:Tx):Promise<void> |
| StationAlertRecoveryStore<Tx> | quarantineRecovery(tx:Tx,state:string):Promise<void> |
| NotificationRecoveryStore<Tx> | suspendEndpoints(tx:Tx):Promise<void>; quarantineDeliveries(tx:Tx,at:number):Promise<void> |

The ports carry the original caller transaction and primitive encoded state/time.
They have no SQL, database connection, clock, JSON encoder, product class, pool,
authority, execution identity or transaction factory. Existing L1 methods and L0
interfaces are unchanged. Main integrates their public framework export.

Each existing L3 owner now exports one class and its version1 constant through
its existing public.ts. Existing module/API version constants stay unchanged:

| Owner public export | Constructor and public method |
| --- | --- |
| TELEMETRY_RECOVERY_INTERFACE_VERSION, TelemetryRecovery<Tx> | new TelemetryRecovery(store); quarantineRecovery(tx) |
| STATION_ALERT_RECOVERY_INTERFACE_VERSION, StationAlertRecovery<Tx> | new StationAlertRecovery(store,encode:(state:StationAlertState)=>string); quarantineRecovery(tx) |
| NOTIFICATION_RECOVERY_INTERFACE_VERSION, NotificationRecovery<Tx> | new NotificationRecovery(store,now:()=>number); quarantineRecovery(tx) |

All providers are explicit; there is no default clock/encoder/store or fallback.
The classes hold only their required collaborators, not a second recovery ledger,
authority, sample registry, scheduler or mutable recovery state. They never start
a transaction, request a pool connection, sign/rebind authority or execute a task.

One new L2 store per owner holds the actual original SQL bodies:
`mysql-telemetry-recovery-store.ts` / MySqlTelemetryRecoveryStore,
`mysql-station-alert-recovery-store.ts` / MySqlStationAlertRecoveryStore,
`mysql-notification-recovery-store.ts` / MySqlNotificationRecoveryStore.
All have zero-argument constructors and implement their L1 port specialized to
the existing native Transaction. Imports are only public L1 types, the same mysql
write helper and its native Transaction type; no L3 implementation or product
value parser is imported by a store.

## Exact Original Call And Write Order

Main integrates the existing restore workflow with the public owners at the
original sites. The intended source chain is original Recovery supplied Tx ->
original public owner operation -> its L1 port -> same native MySQL write helper
and supplied Tx. No independent owner transaction or event replaces atomicity.

TelemetryRecovery -> MySqlTelemetryRecoveryStore.quarantineRecovery performs the
same ten awaited statements, without a clock or format step:

1. DELETE telemetry_heads; suspend telemetry_points where not already suspended.
2. DELETE telemetry_rollup_cursors; suspend telemetry_rollup_buckets where not
   already suspended.
3. DELETE probe_telemetry_heads; suspend probe_telemetry_points.
4. DELETE host_telemetry_heads; suspend host_telemetry_points.
5. DELETE forward_telemetry_heads; suspend forward_telemetry_points.

The last three suspension predicates remain recovery_suspended=FALSE. Only the
original operational ingestion cursors/heads are deleted. Samples/buckets and
their historical provenance remain; this permission does not extend to any
execution lease, permit budget, binding/fence/retirement or immutable history.

StationAlertRecovery constructs a fresh mutable literal in the original property
order: condition:'unknown', episode:0, instanceKey:null, armed:false, openedAt:null,
opening:null, lastFiring:null, last:null, evaluatedAt:null. It calls the explicit
encoder and passes the resulting string to its store. It deliberately does not
reuse emptyStationAlertState, whose deepFreeze would introduce a different step.
The intended native binding is existing nativeJsonEncode, which is exactly the
old JSON.stringify; this slice adds no replacement encoder implementation.

The two original statements update policies to suspended='recovery',
next_evaluate_at=0,state=? and then mark nonsuspended station_alert_events. No
new policy revision, resolve event, replay, evaluation, deadline or callback is
added. Encoder failure occurs before either Station write, with its exact error
propagated to the enclosing original transaction.

NotificationRecovery deliberately separates the endpoint and delivery operations:

1. await store.suspendEndpoints(tx): the original UPDATE notification_endpoints
   SET suspended='recovery'.
2. const at=now(): one explicit clock sample, only after endpoint suspension
   succeeds. It is not sampled in the constructor or before awaiting the write.
3. await store.quarantineDeliveries(tx,at): first mark delivery history recovery
   suspended; then cancel queued/claimed/retry-wait; then finish pending attempts.

These are exactly four SQL statements and one clock operation. The pending
delivery statement retains its original assignment order: claimed status first
maps last_status_code to NULL and last_outcome to unknown before setting status
cancelled, incrementing revision, setting RECOVERY_SUSPENDED, clearing next retry/
claim fields and applying updated_at=GREATEST(updated_at,at). Existing terminal
rows are excluded from cancellation and retain terminal HTTP evidence. Pending
attempts use finished_at=GREATEST(started_at,at), outcome unknown, same code and
NULL status_code. Both parameterized statements receive the same sampled value.

No endpoint rate bounds, terminal attempts, opaque credential references or
protected notification secrets are deleted. No queued task is resumed, caught up,
resent or classified as definitely delivered/rejected because recovery ran.

## Errors, Transactions And Outer Failure Limits

All awaits retain serial original statement order and propagate original errors.
If a Telemetry or Station statement fails, later statements are not attempted.
If endpoint suspension fails, Notification never invokes now or delivery writes.
If now fails, endpoint write has occurred in the caller transaction but delivery
writes have not. If a delivery step fails, later native steps do not run. The
original UnitOfWork owns rollback, limited transient retries, commit and release;
these owners do not catch, compensate, retry or clear failure history.

This is not a global recovery atomicity promise. Fresh database creation, mysql
restore and implicit DDL precede the application quarantine transaction. Its
commit precedes durable credential output and the same protected Authority rebind.
Partial target, unknown commit, credential-file and rebind failures retain their
existing distinct handling. A failed external operation does not authorize clearing
protected state, retrying authority publication or silently releasing maintenance.

The source compatibility surface is additive: new version1 public operations
replace the original inline owner writes when main integrates them. Existing
Telemetry/Station/Notification commands, ordinary stores, read models and native
schema/public interfaces are not changed. Old Recovery exported functions and
other owner static/constructor bindings remain main's integration scope.

## Planned Acceptance And Remaining Integration

No cases below have run. Later authorized evidence must identify the exact full
frozen source and use Actions for actual MySQL/native/functional behavior:

- Compare every original SQL string, predicate, argument and order for ten
  Telemetry, two Station and four Notification statements. Observe the exact
  supplied Tx and no secondary pool/transaction/event side channel.
- Verify original mutable nine-field Station literal/property order, one native
  encoding at the call stage, encoder error before writes and exact stored state;
  no deepFreeze, canonicalization or extra object normalization.
- Record Notification endpoint completion before exactly one clock callback,
  history flag before cancellation before pending attempt completion, same at
  value and original error-stop behavior at every stage.
- Cover queued/claimed/retry-wait, terminal delivered/dead-letter/cancelled rows,
  pending/terminal attempts, claimed unknown/null transition and GREATEST bounds.
  Preserve terminal HTTP evidence, rate limits and opaque references.
- Preserve historical samples/buckets/events, suspended/archived/terminal rows,
  Node/Forward/Probe/Runtime ownership, same transaction rollback/retry and native
  clock regeneration behavior. Do not confuse operational checkpoint deletion
  with permission to erase protected execution or issuance history.
- Integrate original Recovery entry and explicit native provider binding, then
  verify original owner ordering through subsequent Probe, Path/Ingress,
  Forward/Runtime/Idempotency/event stages and postcommit credential/Authority
  failure boundaries. These classes alone do not establish that full chain.

Main must export the three new L1 port types/version from framework/public, bind
the three lower stores and explicit native encoder/clock at the existing Recovery
composition, and replace only the corresponding original inline statements in
their original order. Classification/readiness/FR/source candidate integration is
main-owned. This slice does not edit the script, Path/Ingress/Identity/Node/Runtime
owners, shared root documents, CI or tests, and does not close remaining native
Recovery/source/type/private/default/consumer work or foundation acceptance.
