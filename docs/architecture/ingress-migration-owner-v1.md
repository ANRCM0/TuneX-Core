# IngressMigration Owner And Storage Boundary v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2, original explicit migration and historical lineage, not a new feature.

## Lower Contracts And One SQL Owner

L1 parameterizes Plan, Outcome and Failure over the original transactional storage
port. The lower plan index carries only source/target group ID/revision facts used
by the original insert. Head, attempt and Operation metadata reuse the existing
lower shapes; product contracts retain their original fields, optional locks,
nullability, mutability and status meanings through specialization. No required
product method is added and no product validator moves into the lower port.

L2 mysql-ingress-migration-store.ts owns the original SQL/savepoint body, separate
from deployment and publication storage. Scope locking, raw JSON/Boolean mapping,
group-filtered direct COUNT followed by bounded page, default FOR SHARE/requested
FOR UPDATE and same-transaction attempt projection remain. The original attempt
LIMIT 16, Operation-ID bound 16, quota 64 and revision<20 remain distinct from
PathPublication. create rejects different source/target group identities BEFORE
the lazy quota query, then persists source/target revision indexes, plan and event.
append/cancel preserve exact CAS, recovery/cancel predicates and write/event order.

Ingress's public refusal provider directly aliases the existing Path provider.
There is one mutable rejection Set and the same ControlError/non-retryable/status
rules, not a second classifier. SAVEPOINT ingress_migration_forward is created
before the action catch; known refusals are classified before ROLLBACK TO/RELEASE
and projected only after release. Success releases. Unknown/retryable/database
errors and savepoint failures escape to the original outer transaction. The lower
store does not open a pool, transaction, retry, authority or route pointer.

## Complete Original Owner Chains

- Preview -> manager authorization -> sorted exact origin reads -> original
  current-state inspection sorted by Forward ID -> source definition and active
  target definition reads -> sorted complete member diff -> input-order actions
  and original Forward previews -> parsed immutable migration plan. Historical
  lineage alone is not current authorization, reservation or membership authority.
- Create -> original identity/input/hash/request framing -> manager/idempotency ->
  Scope lock/quota -> rebuild and compare exact preview digest -> ID/time -> lower
  group-coherence/quota/insert/event -> durable response, all in the original Tx.
  A new batch record does not execute any Forward.
- Act -> manager -> locked and validated batch -> creator/recovery refusal before
  idempotency -> exact revision/item/duplicate/cancel/compensation checks -> named
  savepoint -> original action and checkedResult -> time/head CAS/attempt/event ->
  response in the same outer transaction. Decision/response failure rolls back
  accepted Forward effects here, not separately committed items.
- Apply add re-resolves the exact active target member/template and calls original
  Forward creation. Update first checks unchanged source lineage/current state,
  resolves target member/template and calls original guarded Forward update.
  Remove checks exact lineage/current state and calls original safe removal,
  without resolving a target member or pretending removal is reversible.
- Compensation of accepted add conditionally removes the created Forward.
  Compensation of accepted update calls original publication restoration with
  both accepted and source states. Remove has no compensation. Result validation
  remains inside the savepoint, including receipt/revision/Operation/path/group
  provenance rules; no silent rebase or automatic reverse action is added.
- Cancel retains creator/recovery-before-replay, exact CAS and no-op time behavior.
  It cancels future applies, not previously accepted effects or eligible
  compensation; history remains intact.
- List/get retain Scope checks, private immutable head/plan/result/attempt
  validation, exact Operation/Forward/revision association, bounded reads and
  non-global-snapshot/unknown-health/non-authorizing/non-atomic flags.
- originIn accepts migration origins only, checks Scope/recovery and an eligible
  accepted non-remove apply. An accepted compensation invalidates apply lineage;
  only an accepted UPDATE restoration can be a compensating live-state origin.
  It returns the original source lineage with the exact restoration receipt.
  Failed compensation and cancellation do not silently change that eligibility.

Control explicitly binds this lower store, the original refusal provider, existing
IngressGroups, original Forward methods and deployment/migration origin resolver.
All collaborators receive the original Tx. The coordinator consumes public
Ingress/Path contracts and L1/L2 paging/digest/request/ID/clock/ISO helpers at the
original call points. Private business validation and sole execution ownership
stay with the original owners; L0, Runtime ledger and Agent authority/Journal are
not changed. Existing parsers remain the single implementation described by the
preceding deployment slice.

## Precise Legacy Entry And Remaining Work

MySqlIngressMigrations keeps zero-argument construction, public async prototype/
subclass methods, optional lock default and private event. Trusted callbacks keep
create -> this.count and create/append/cancel -> this.event lazy and preserve their
original errors/evaluation order. Filtered list retains direct COUNT, not a count
override hook. The wrapper contains no copied SQL. Old product ports/API types
retain original names; public exports bind the one provider. Alias removal needs
caller inventory and accepted evidence on the same frozen revision.

Readiness item 61 is planned only. Source-string tooling adaptation waits for
verification authorization; functional/MySQL/Agent evidence belongs in Actions
on the same frozen source. Transit, A1 residuals, Agent/native, Runner and whole-
source classification remain open. No checks/tests/builds/experiments/CI/commits/
pushes/delegation ran. This is neither A2/foundation acceptance nor an open upper-
module gate, frozen/tested revision, release or production-readiness claim.
