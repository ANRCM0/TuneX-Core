# IngressDeployment Owner And Storage Boundary v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2, original durable ingress creation, conditional deletion and lineage.

## Lower Storage And Public Values

L1 parameterizes the original Plan/Outcome records and transactional storage port.
The plan index contains only the group ID/revision needed by the original insert;
it is not a product validator. Head and Operation metadata reuse existing lower
shapes. Product IngressDeploymentHead/Attempt/Record/Store keep their original
fields, nullability, optional locks and status meanings through specialization.

L2 mysql-ingress-deployment-store.ts owns the one original SQL implementation.
Raw JSON/Boolean mapping, bound group filtering and count-before-page remain.
The filtered list still uses its original direct COUNT, not virtual count().
read retains FOR SHARE by default or FOR UPDATE when requested, then LIMIT 16
attempt projection on the same transaction. Operation reads retain their separate
sixteen-ID bound and Scope filter; they do not join a global health snapshot.

Creation retains the 64-batch quota recheck, group-index fields from the plan and
insert-before-event order. append/cancel retain revision<20, recovery isolation,
create-only cancellation refusal, affected-row checks and attempt/event order.
No pool, nested transaction, retry, route pointer or competing authority is added.

The Ingress public ingressDeploymentStorageValues directly aliases the original
Path owner provider. The same ControlError identity, mutable refusal Set, statuses
and non-retryable requirement apply; neither policy nor Set is copied. The lower
adapter retains SAVEPOINT ingress_deployment_forward. Classification precedes
rollback; failure projection follows ROLLBACK TO and RELEASE. Success releases the
savepoint. Unknown/retryable errors and savepoint failures escape to the original
outer transaction rather than becoming recorded item refusals.

## Complete Original Owner Chains

- Preview -> manager check -> exact active IngressGroup resolution -> input-order
  expansion -> original Forward preview/selected Path reference authorization ->
  parsed immutable plan. Preview does not reserve or accept execution.
- Create -> original identity/input/hash/request framing -> manager/idempotency ->
  Scope lock/quota -> rebuild and compare preview digest -> original ID/time ->
  lower quota/insert/event -> idempotent response. A batch record creates no Forward.
- Act -> manager -> locked batch/product validation -> creator/recovery refusal
  before idempotency -> CAS/item/duplicate/cancel/compensation checks -> savepoint.
  Create re-resolves the selected member, compares the exact template and calls
  original Forward createIngressIn; checkedResult remains inside that savepoint.
  After release, original time/head CAS/attempt/event/response work completes the
  same outer transaction. A durable-decision failure rolls back accepted Forward
  work in that transaction; it does not undo other committed item transactions.
- Forward creation retains original preparation, insert, Runtime plan, Operation,
  capacity and Path provenance acceptance. It alone owns the execution intent.
- Compensation targets only a previously accepted creation. Original Forward
  identity/revision/current-provenance guards precede the existing safe removal
  path and new Operation. checkedResult requires deleting:true, the next revision,
  unchanged spec/provenance and a different Operation ID. This is conditional
  deletion, not PathPublication restoration or unconditional batch undo.
- Cancel keeps creator/recovery checks before replay, exact CAS and no-op timing.
  It cancels pending creation, not accepted Forward work, and clears no history.
- List/get retain Scope checks, original head/plan/result/attempt validation and
  exact Operation/Forward/revision association. All health, reservation, execution,
  physical-sharing and cross-Forward atomicity flags retain their original values.
- originIn accepts only deployment/apply references, checks Scope and the original
  retained receipt, refuses recovery-invalidated or successfully compensated
  origins, then returns historical lineage. It does not inspect current Forward
  state or grant authority. Failed compensation and cancellation retain their
  original eligibility behavior; downstream migration owns current-state checks.

The coordinator retains private product validators and original request/digest/ID/
clock/ISO evaluation points over public L1/L2 helpers. No automatic advancement,
shared listener, cross-Forward transaction or protocol/feature change is introduced.

## Shared Origin And Migration Rules

Deployment's original origin parser shared private helpers with the other migration
parsers. The complete original rule implementation now lives in Ingress owner
migration-values.ts; the old ingress-migration-contract.ts directly aliases it.
Deployment and migration consume that public entry, not copied helpers.

Closed fields, bounded distinct origins/actions, exact different revisions of one
group, complete sorted definition diff, source lineage, add/update/remove rules,
explicit false intent, same-ingress path-only updates, explicit replacement removal
and final UTF-8 plan bound remain original. Frozen migration limits retain their
original identity and broad numeric types, unlike the mutable ingress limit object.
This relocates existing rules; migration SQL/coordination acceptance remains open.

## Legacy Entry And Remaining Work

MySqlIngressDeployments retains zero-argument construction, public async prototype/
subclass methods and private event. Trusted callbacks preserve create/count and
create/append/cancel event dispatch; filtered list does not acquire a count hook.
Control binds the lower store and original public values explicitly. No SQL is
copied into the wrapper. Remove aliases only after caller inventory and accepted
compatibility evidence on the same frozen revision.

Readiness item 60 is planned only. Source-string tooling moves only after later
verification authorization; functional/MySQL/Agent evidence belongs in Actions on
the same frozen source. This is a dirty uncommitted source candidate, not a tested
revision or A2/foundation acceptance. Migration SQL/native coordination, Transit,
A1 residuals, Agent/Runner and full classification remain open. No checks/tests/
builds/experiments/CI/commits/pushes/delegation ran; upper-module gates stay closed.
