# PathPublication Owner And Storage Boundary v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2, original durable manual publication and conditional compensation.

## Public Rules And Lower Storage

The Path public entry exposes the original publication input/plan/state parsers,
hash predicate, limits and rejection Set. publication-values.ts owns one shared
implementation; modules/path-publication-contract.ts directly aliases it. Existing
Forward and Ingress application/value consumers use the public owner. Closed
fields/prototypes, bounded distinct items, exact source/provenance/digest rules and
path-only replacement remain. Plan UTF-8 byte counting uses the existing L2 helper
with the same JSON encoding. Limits and the rejection Set retain their original
identity and mutability; no stricter parser, new refusal or copied Set is added.

L1 defines stored head, parameterized Plan/Outcome records, operation metadata and
transactional storage ports. Public product records specialize the same shapes;
nullable reads, optional locks, mutable fields, status unions and old store methods
retain their meanings. The lower storage does not interpret a product plan/outcome.

L2 infrastructure/mysql-publication-store.ts contains the original SQL in
MySqlPathPublicationStore. Raw JSON and Boolean mapping, Scope count/lock, bounded
list/attempt/operation reads, arguments and CAS remain. read keeps FOR SHARE by
default and FOR UPDATE when requested, holding the head until attempts are read
on the same transaction. create rechecks the original 64-batch quota; append and
cancel retain revision<24, recovery isolation, conditional cancelled predicates,
affected-row refusals and event order. No pool, nested transaction or retry is added.

## Savepoint And Business Refusals

The synchronous L3 pathPublicationStorageValues supplies the original classifier:
same ControlError identity, non-retryable, the same mutable rejection Set and the
original five status values. It performs no I/O, clock, transaction or state read.
isRefusal executes before rollback; refusal projects code/status only after
ROLLBACK TO and RELEASE, retaining the original late projection point.

The adapter retains SAVEPOINT path_publication_forward before the action. Success
releases it; a known business refusal rolls back to it and releases it before
returning the durable refusal. Unknown or retryable errors escape unchanged. A
savepoint creation/rollback/release failure escapes to the outer UnitOfWork; it is
not converted to an item rejection or retried. The original idempotency claim lies
outside this savepoint. No second authority or competing publication ledger exists.

## Complete Original Owner Chains

- Preview -> manager authorization -> sorted Forward preview calls -> original
  locked Forward/current provenance, Group and selected Path/reference owners ->
  immutable plan in original item order. These calls can take existing row locks;
  preview is not a lock-free health check or execution authorization.
- Create -> manager authorization/idempotency -> Scope lock/count -> rebuild the
  original plan and compare its preview digest -> original ID/time sampling ->
  lower quota recheck/insert/event -> idempotent response. Creating the batch does
  not execute any Forward or reserve execution resources.
- List/get -> Scope authorization -> lower metadata/shared-head/attempt reads ->
  original product head/plan/result/history validation -> bounded operation metadata
  with exact Forward/revision association. Persisted observations remain health
  unknown, read-committed and non-global-snapshot evidence.
- Act -> manager authorization -> locked batch read/validation -> original creator
  and recovery checks before idempotency replay -> CAS/item/attempt/cancel/compensate
  checks -> savepoint -> original Forward apply/compensate plus checkedResult ->
  savepoint result -> original attempt time -> head CAS/attempt/event -> response.
  Failure of durable attempt/event/response work rolls back the outer transaction,
  including accepted Forward work; an item refusal does not undo prior transactions.
- Forward apply -> exact locked current/source/provenance -> Group/Path resolve and
  current reference authorization -> original pure decision, safety preparation,
  replacement/Runtime plan/Operation/capacity -> Path then Group accept -> current
  publication state. Forward remains the only execution intent owner.
- Compensation -> exact accepted current state and provenance guard -> current
  restoration authorization -> original source Group/Path resolution and digest
  comparison -> conditional original Forward change. Only current metadata may
  detach where originally required; immutable history stays. Changed source, grants,
  receipt, CAS or topology can refuse compensation; this is not unconditional undo.
- Cancel -> original creator/recovery checks before idempotency, then batch CAS and
  original changed/no-op handling. It cancels pending apply actions, not accepted
  Forward work, and does not clear attempts or protected recovery history.

The coordinator retains private product validation and original clock/request/ID/
digest/ISO evaluation points over public L1/L2 helpers. Responses keep reserved:false,
executionAuthorized:false and atomicAcrossForwards:false. There is no automatic
batch advancement, global atomic promise, new feature gate or protocol change.

## Precise Legacy Entries And Remaining Work

MySqlPathPublications retains zero-argument construction, public async prototype
methods, optional lock default and its private event method. Trusted optional lower
count/event hooks preserve old dynamic list/create/count and create/append/cancel
event dispatch; SQL has one implementation. Hooks are compatibility binding only,
not serialized policy, an authorization bypass or a substitute for caller locks.
Control explicitly binds the lower store with original public product values.
Remove aliases only after caller inventory and accepted frozen-source compatibility.

Readiness item 58 is planned only. Historical source-string tooling moves only in
the later authorized verification phase; functional/MySQL/Agent evidence belongs
in Actions on the same frozen source. Current source is dirty and uncommitted, not
a tested source revision. Ingress SQL still consumes the original rejection alias
and remains explicit migration debt, not a new L2-to-L3 exception. Other Ingress/
Transit, A1 residuals, Agent/native/Runner and full classification remain open.
No checks/tests/builds/experiments/CI/commits/pushes or delegation ran. This is not
A2/foundation acceptance or an open upper-module gate.
