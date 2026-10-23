# Forward Intent State Owner

Public state interface 2, source candidate and unverified. Import public.ts for
ForwardStateOwner, existing read/write/reference contracts and ForwardStateService.
Old Forwarding() and forwarding-ports/forward-query-ports exports remain native
provider/type bridges to this one owner. This is the original intent state owner,
not a new Forward command API, compiler, execution ledger or authorization issuer.
The existing ForwardCommands and Runtime application coordination remain in place.

Composition supplies ForwardIntentStore and StoredValues. L3 retains explicit
Profile-before-Node reference selection, missing intent errors, affected-row
revision conflicts, flag projection and ordered current/revision writes. L2 owns
original MySQL predicates/locks/argument order and JSON representation. Every
operation uses the supplied transaction, with no pool, nested transaction, retry,
clock/ID read or authority fallback. Persisted owner claims are validated before
projection: explicit null is legacy; a missing/malformed owner is an integrity
failure rather than a legacy default.

Keep forActor's original inclusion of recovery-suspended intents distinct from
forNode/forReferencedNode/forProfileActor filtering. record includes deleted and
recovery state; get/currentForUpdate exclude deleted rows. revisions returns the
original raw stored spec values, newest first and limited to 25. Intent reads use
the old lazy decoder, not a newly introduced closed Forward parser or clone.

insert/replace/markDeleting keep current-row write -> revision-row write, including
separate encoding at each original point. Replace clears deleting/recovery flags;
deletion only changes its original fields. Quarantine sets the original flag and
never clears protected Runtime/Agent history. Existing higher commands keep
authorization, idempotency and Runtime reconciliation in the same transaction.
Required default/injected/SQL/codec/rollback/alias traces are in readiness item 22;
none have been executed.

## N Stage Ownership Integration

FR-0028 changes the command constructor to
`ForwardCommands(db, identity, access, idempotency, forwarding, operations,
execution, newId, paths?, groups?, publicationProvenance?, clock?)`. `access` is the
required public ResourceReadAccess port, injected at composition. There is no
Scope-manager fallback. Existing application/native Runtime aliases resolve this
same class and require the same argument. The command API version is 2.

The original intent row owns immutable `owner_actor_id`; only insert writes the
creating actor to it. `get` and `record` return explicit nullable `ownerActorId`.
`authorization_actor` remains independent execution authorization, and historical
revision authorship is never used to infer business ownership. Null denies
ordinary changes until the separate audited classification owner assigns it.

Replacement, retry, path/group binding and publication/Ingress transaction
entrypoints require business ownership. Governance may delete, or disable an
enabled Forward only when the entire business spec is otherwise identical and no
binding selection is supplied. Governance disable preserves authorization_actor.
Direct exact-disable preparation keeps original Runtime locks/reservations and
does not require the governing actor to gain private Node use rights. Relay exact
disable likewise skips new execution authorization; every other Relay change,
including editing a disabled desired spec, checks whole-path eligibility. Every
Relay retry checks that whole path. Role checks use original path positions even
when locks are acquired in Node-id order.

Every idempotent response rechecks current Forward visibility before returning
its receipt. Replay does not renew authority or reapply a command. Existing
internal read/reference/recovery methods retain their original intent and
execution-authorizer selection; product visibility is applied at caller-aware
entrypoints, never inside Runtime cleanup/provenance reads.

Source acceptance cases are authored in
`test/product-rule-ownership-contract.test.ts`: foreign/legacy replacement and
retry refusal, exact governance stop and authorizer preservation, governance
removal, replay visibility, Relay role order, SQL count/page predicates and
immutable ownership insertion. They have not been executed. Existing constructor
fakes and old version/exact-trace assertions require migration to the new frozen
candidate before later authorized Actions acceptance. Root integration owns
ResourceReadAccess composition, module version exports, schema migration/catalog
and legacy-classification HTTP integration. No checks, tests, builds, CI or commits ran in
this source slice.

## Explicit Legacy Classification

`classifyOwner(actor, scope, id, key, expectedRevision, ownerActorId)` is a distinct
original command, not a configuration replacement. Its identity port requires
both ScopeAuthorization and ScopeOwnerAuthorization. It requires current Scope
ownership for the caller and a currently active managing membership for the new
business owner, using the original Identity shared locks and supplied transaction.
It claims the original idempotency key, locks the original Forward row (including
deleted/recovery-suspended legacy rows), checks the existing desired revision and
explicit null owner, and performs a one-time `owner_actor_id IS NULL` CAS.

The response is HTTP 200 with unchanged `revision`, explicit `ownerActorId`,
`classified: true` and `operationId: null`. Classification changes only the owner
claim and writes an audit record. It never changes desired spec/revision,
authorization_actor, deleting/recovery flags, grants, resources, Operations,
leases, snapshots or protected history. No additional resource-revision column is
required. A second request with a different key conflicts even when proposing the
same owner. Original-key replay rechecks current Scope ownership, target managing
membership and resource visibility, then returns its saved receipt without a new
CAS, audit or execution. Missing idempotency keys are rejected by the normal
native request owner. Audit/response failures roll back the original transaction.

L1 ForwardIntentStore adds `classifyOwner` and `auditOwnership`; `record` accepts
the optional original row-lock selector. ForwardStateService retains the raw
row-lock/CAS/audit order. L2 writes `forward_ownership_events`, with one immutable
event per Forward: event id, Scope id, Forward id, initiating Scope owner,
assigned owner, unchanged desired revision and timestamp. Root must install its
additive schema and expose the new governance audit source `forward-ownership`
with kind `classify-owner`; it must not project this as a configuration publish
or an execution attempt. The assigned actor is the audit subject.

`test/product-owner-classification-contract.test.ts` contains authored cases for
the three original owners: Scope-owner/target-membership refusal, legacy-only
CAS, same-owner reclassification conflict, preserved configuration/authority/
history, original-key replay, changed-key collision, and CAS/audit/response
rollback. These cases have not been executed. The version remains the single
FR-0028 candidate version 2, not a separately accepted successor.


## N3 Shared Node Port Limits

FR-0030 adds optional explicit creating-owner context to ForwardResourceHost.reserve.
Native Direct prepareCreate passes its authenticated product actor before inserting
the Forward row. Existing reservations resolve immutable business ownership; mutable
authorization_actor remains original execution authority and never determines quota.
Node authorization receives the full Forward on direct/path use; Runtime Relay and
Transit keep that context through retry, renewal and recovery eligibility.

Original Runtime Node locks and port_slots own range/count enforcement. Exact stop
retains only its existing slots and bypasses new-use quota checks; other changes
require current limits. Removal and cleanup stay with their existing owners.
Automatic Relay TLS candidates are filtered by the Node owner before selection.
No L0 Forward fields or Agent wire values are added. Root integrates public exports,
Runtime ledger delegates, composition and HTTP/schema. Authored port contract cases
are not executed evidence; source acceptance remains outstanding.
