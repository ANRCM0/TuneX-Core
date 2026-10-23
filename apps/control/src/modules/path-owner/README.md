# Path Product Ownership

N-stage source candidate under FR-0028; unverified. Path authoring and user reads
consume the required public ResourceReadAccess port in their original supplied
transaction. Template, group, binding and publication API versions are 2; their
L1 storage versions are 2. L0 Core and Agent history are unchanged.

All constructors insert `access` immediately after `db, auth`:

- `PathTemplateQueries(db, auth, access, read)`.
- `PathTemplateCommands(db, auth, access, requests, store, references, clock?)`.
- `PathBindings(db, auth, access, templates, references, store, forwards, clock?)`.
- `PathGroups(db, auth, access, requests, store, templates, references, bindings,
  forwards, paths, originalPaths, clock?)`.
- `PathPublications(db, auth, access, requests, store, forwards, clock?, newId?)`.

PathTemplateCommands and PathGroups require their existing `auth` argument to
implement ScopeOwnerAuthorization as well as ScopeAuthorization for the explicit
legacy classification command. Queries and the other owners retain their
documented authorization ports.

Composition passes its one original ResourceReadAccess instance; legacy imports
resolve these same owners. No constructor accepts a missing-policy fallback.
For example, the original composition can construct
`new PathTemplateQueries(db, identity, resourceAccess, pathTemplateStore)`.
This public source example is not execution/contract-acceptance evidence.

## Business Commands

Template and group first publication persists the first revision's actor as the
immutable head owner. Later revision `createdBy` fields are audit authorship and
never change that head owner. Publication batches retain their original immutable
createdBy as the identity of the coordination record itself; this is not ownership
of a referenced template, group or Forward. They add no owner column or legacy
classification command. Missing/malformed fields fail integrity validation.
Existing CAS, Scope/head locks, quotas, audit/idempotency, current
pointers and immutable history stay in their original owners and transaction.

Template/group publish and new use require the business owner; governance can
archive. Binding resolve/accept/preview requires the Forward owner and selected
template/group owner, plus current Node-purpose/Profile authorization. Group
authoring validates every candidate's owned template and current references.
Template Node roles derive from original ordered positions before sorting lock
order. Publication preview/create enters original Forward preview ownership;
apply/compensate requires the batch owner and original Forward commands recheck
all use permissions. Governance can cancel pending publication work but cannot
advance/apply/compensate it. Batch attempts still require their original creating
actor; no old attempt or plan is rewritten. Recovery-invalidated work remains
suspended.

## Caller Reads And SQL

Template/group heads expose explicit nullable `ownerActorId`. Their ordinary
list/count filters use that column. Publication list/count uses immutable
`created_by`; governance reads retain Scope bounds. The mandatory signatures are:

- Template/group `list(tx, scope, principal, paging, prefix)`.
- Path/group binding `references(tx, scope, principal, id, paging, revision?)`.
- Publication `list(tx, scope, principal, paging)`.

Each MySQL COUNT and SELECT shares the exact same predicate and arguments before
ordering/pagination. Reference predicates restrict referenced Forward owners,
even when the actor owns the template/group. Legacy zero-argument MySQL facades
forward the required principal and do not discard it. Publication list no longer
uses an unfiltered legacy count hook; mutation quotas retain original dynamic
count hooks. Detail/history/binding reads require current parent visibility;
publication detail also checks every referenced Forward before exposing frozen
plans or operations. Replay rechecks current parent visibility.

Actor-free `checked`, `currentIn`, original history/sequence readers, preserve,
detach and recovery remain internal integrity/cleanup ports. Their historical
reads deliberately do not reacquire product-use grants or infer new ownership.
They continue to validate protected provenance after permission changes.

## Remaining Integration And Acceptance

Root owns public module version exports, ResourceReadAccess implementation and
composition, schema/catalog migrations, DTO/API adapters and legacy-classification
HTTP integration. Storage leaves now require the FR-0028 owner columns; there is
no compatibility fallback for an old schema. Existing constructor and storage
fakes, public examples, version and exact SQL/trace expectations must be migrated
before later concentrated verification.

Meaningful authored cases in `test/product-rule-ownership-contract.test.ts` cover
Forward use/governance/replay, immutable insert and shared SQL count/page
predicates. Additional authorized Actions cases must exercise private Node roles,
revocation/renewal, template/group foreign-use refusal, CAS/replay/rollback,
reference count isolation, original immutable batch identity and all compatibility
entrypoints on one exact frozen source revision. No tests, static/type/syntax/
boundary checks, formatters, builds, generators, network experiments, Actions,
commits or pushes were executed for this slice. Source closure is not acceptance.

## Explicit Legacy Classification

PathTemplateCommands and PathGroups each expose
`classifyOwner(actor, scope, id, key, expectedRevision, ownerActorId)`. Only the
current Scope owner can call it; the assigned owner must be a current active
managing member of this Scope. Classification joins the original idempotency
transaction and Scope/head lock order, then checks the current configuration
revision plus explicit null business ownership. The SQL CAS sets only the owner;
no configuration revision is added, and current revision, digest, archived flag,
revision authorship, binding history, grants and Runtime authority are preserved.
Archived legacy heads may be classified without becoming usable for new binding.

Each original owner writes its existing audit table with kind `classify-owner`,
the initiating actor, assigned `owner_actor_id`, unchanged configuration revision
and timestamp. Audit/response failure rolls back the entire transaction. Normal
publish/archive events keep a null audit owner subject. New-key reclassification
conflicts even when the same owner is requested. Original-key replay rechecks the
current Scope owner, target managing membership and resource visibility; it does
not repeat CAS/audit or execute a path. The response is HTTP 200 with its original
templateId/groupId, unchanged revision, assigned owner and `classified: true`.

No additional resource-revision column is needed for one-time null-to-owner CAS.
Root installs the additive existing-event kind/subject columns and governance
audit projection. Authoring and archived-state use rules still apply after
classification; assigning a business owner never grants Node/Profile use or
automatically reactivates old execution.

The authored `test/product-owner-classification-contract.test.ts` cases cover
these owner commands alongside Forward classification and their exact lower SQL
effects. No cases have been executed in this source phase.
