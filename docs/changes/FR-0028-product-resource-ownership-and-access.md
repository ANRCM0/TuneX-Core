# FR-0028: Product Resource Ownership And Purpose-Aware Access

Date: 2026-10-21 (Asia/Shanghai).
Status: authorized-under-standing-source-scope; recorded before implementation.
Owners and authorization: original L3 Identity/Node/Forward/Path/read owners, L1
injected authorization/storage ports, and L2 MySQL adapters. The human's explicit
2026-10-21 new-stage instruction authorizes these named parallel source tasks;
the 2026-10-19 standing foundation source authorization covers the required
foundation proposal. Neither authorizes execution of verification, commit/push,
merge or release for this source candidate.

## Task Proposal

1. Layers: L3 ownership/use/governance/read policy, L2 persisted ownership and read
   predicates, minimal L1 owner-independent ports. L0 Core and Agent wire stay.
2. Consumed interfaces: existing ScopeAuthorization/ScopeOwnerAuthorization,
   NodeAuthorityHost/Store, ForwardIntentStore, Path storage, original Runtime
   resources, transactions, Operation, access-change effects and telemetry readers.
3. Foundation impact: additive raw ownership/purpose data and injected access
   ports; changed authorization semantics, storage/query call signatures and
   explicit interface-version updates. Persisted schema advances additively.
4. Contracts: immutable business ownership distinct from execution authorizer;
   private/admin-shared/legacy-unclassified Node sources; actor-specific purpose
   restrictions; caller-aware read projections and explicit legacy classification.
   Missing ownership never grants access. Existing alias entrypoints participate.
5. Acceptance: PA-01–12 in the product baseline, especially transactions/CAS,
   replay, rejection, revocation/renewal and full query isolation. Meaningful
   contract cases may be authored; no tests/checks/builds/Actions are executed in
   this source phase. Exact-source, physical-host and release evidence stay separate.
6. Parallel impact: Node, business ownership and read isolation are isolated named
   worktrees from 01b264509a0aa50a261b8cb2cf0b866c282f9818. Shared ports/exports,
   migration catalog and composition are assigned explicitly and integrated by root.

## Why Current Extensions Are Insufficient

Current grants are boolean, Node rows have no explicit personal resource owner,
and most management reads are scoped rather than caller-owned. The mutable
authorization_actor is an execution authorization reference, not immutable product
ownership. Revision createdBy is authorship, not a template/group ownership rule.
Reusing those fields would silently transfer rights and make ownership dependent
on later execution or configuration changes.

Existing Node/network/protocol capabilities describe executable behavior, not
whether a particular user may use the Node as ingress, transit or egress. A UI
filter or grant DTO extension does not enforce original runtime renewal, retry,
recovery and revocation effects. Authoritative changes must stay on those paths.

## Chosen Source Design

Keep the existing Scope as the platform resource namespace. Scope owner is the
administrator within that Scope; canManage permits self-service only alongside
the applicable product ownership/use rules. This does not add cross-Scope sharing
or a global administrator. Preserve every Runtime/Agent scope invariant.

Node sources are exactly legacy-unclassified, private and admin-shared. Private
requires an explicit owner_actor_id; other sources have no private owner. New
ordinary provision is private to the actor; admin-shared provision is explicit
and requires Scope ownership. Per-actor grant role restrictions are null for no
extra restriction, or a nonempty ingress/transit/egress subset; absence of a grant
is always denial. Source/ownership and roles are validated, never inferred.

Provisioning's initial grant decision belongs to NodeService in the original
transaction. The raw Node store creates only the Node claim and enrollment data.
Private provisioning explicitly inserts its owner's initial grant; admin-shared
provisioning inserts none, including for the creator. Shared use begins with an
explicit ordinary grant command. This corrects the previous native adapter's
unconditional creator grant under the same standing source authorization; shared
governance/provisioning alone does not confer use. Public store call shapes stay
the same while this successor's initial-grant semantics and store fakes must migrate.
Planned acceptance must check both entrypoints, failed grant/runtime initialization
rolling back the full transaction and no implicit shared use by its administrator.

Product use policy belongs to Node L3. The L1 host receives a role-aware access
port or equivalent injected policy, and applies it on the original authorization
paths without importing product implementations. Raw L1 storage contracts may
describe resource claims; they do not become a second product policy owner.
Direct uses ingress permission; Relay/Multihop and Path authoring derive each
Node's purpose from its position. An omitted role cannot bypass restrictions.
Grant narrowing recomputes actual whole-path execution eligibility in the original
AccessChangeReconciler before deciding policy/revoke and cleanup obligations.

Forward, template and group business owner is immutable and independent of
authorization_actor / createdBy. Old rows with no owner remain unclassified.
New user modifications require ownership and current execution permissions;
governance can stop/remove according to explicit rules but cannot change targets,
enable, retry or apply a path to acquire private resource use rights. Original
transaction/CAS/idempotency/resource/Operation order stays owned.

Introduce caller-aware read access as an injected public port, backed by original
Identity/Node/Forward state. COUNT, filters, pagination and SELECT share the same
visibility predicate. Ordinary user rule queries are owner-limited; shared Node
use grants return only the basic permitted machine/capability data, never full
mixed-tenant Agent reports, host counters or private Forward references. Full
machine observations require personal ownership or the explicitly documented
governance view. Advanced Scope-wide audit/notification/administration surfaces
remain governance-only until a separate per-user contract exists.

## Impact And Compatibility

This intentionally changes the old meaning of Scope manager: it no longer implies
unrestricted management/read of another user's business resources. Existing
source consumers, store fakes, adapter constructors, HTTP DTOs, public examples,
read projections and alias paths need explicit adaptation to the new versions.
Old execution and metadata history readers without an actor remain internal owner
ports for integrity/cleanup; do not force user visibility filters into historical
provenance validation or Runtime maintenance.

No schema of Forward intent, Snapshot, Report or Agent Journal changes merely to
add Control-side ownership. Runtime fences, protected authority, hard deadlines,
credential rotation and original error/cleanup authority remain. A query is never
an execution grant; permission replay never renews a lease or reissues a command.

## Migration And Version Plan

Append migrations after immutable 0038. Explicit source/owner/revision columns and
grant-purpose data preserve all existing rows, credentials, grants and history.
Legacy resources remain unclassified and require an audited CAS classification
command with an explicit owner/source and old-grant handling choice; never derive
ownership from grants or automatically reactivate old permissions. New use/renewal
of unclassified resources fails closed while original leases/cleanup bound old
execution. Record this breaking behavior in integration instructions.

Classification and governance join original Node/resource locks and transactions.
Old public aliases forward into the same rule; missing or malformed ownership is
denied or reported as integrity failure rather than silently treated as legacy.
Update exact schema catalog/profile ceilings only for reviewed successor targets;
preserve historical ceilings, migration receipts and failure-on-unknown behavior.
No rollback is promised by clearing owner data, grants, Journal or authority.

## Acceptance And Known Limits

Planned: private grant rejection (including Scope owner), purpose defaults and
narrowing, full-path renew/retry/recovery, explicit legacy migration/CAS/replay,
original resource atomicity, owner-filtered list/count/detail/telemetry/history/
references/aggregates, no cross-user leakage, and governance-only advanced reads.
Track actual authoring/integration separately in the N stage ledger.

## Integrated Successor Details

The single version-2 source successor also adds Console Node resourceSource,
ownerActorId, allowedRoles, canUse and readDetail projections. These describe the
current actor's resource claim and grant; canUse is a dated prerequisite summary,
not command authorization or a reservation. Node filters resourceSource and
ownership=mine|available, and Forward ownership filters, run before count/page.
Governance lists may include other owners; explicit personal lists still select
the current actor. Missing shared machine reports remain withheld, not offline.
Candidate role filtering preserves ingress/transit/egress and applies listener
address/port requirements only to ingress candidates. Original preparation still
checks the whole route, exact profile/endpoint revisions and runtime resources.

Telemetry aggregate loss counters scoped to a whole Scope/family are withheld
from ordinary Forward readers. The successor DTO uses a discriminated
`withheld-scope-family` branch with null counters, never fabricated zeroes. Node
readers with full host visibility and Scope governance retain their authorized
string counters. Existing clients must handle this nullable branch explicitly.

ConsoleModel Direct eligibility now requires the server's explicit canUse and
allowedRoles projection; old responses missing these fields cannot enable the
self-service Direct command. PathTemplates initialization adds loadDraft for the
same-origin line builder while preserving the original preview/command/receipt
flow. Account context, line builder and exact template reference helpers are
served through the original bounded console asset adapter and headers.

POST forwards/path-templates/path-groups/ingress-groups/:id/classify-owner is the
explicit HTTP classification surface under the original scoped prefix. It accepts
only expectedRevision and ownerActorId plus the original idempotency header.
Existing configuration revision and null owner form a one-time CAS. The original
owner records the audit and response in the same transaction; no extra resource
revision, configuration rewrite, authorizer update or Operation is introduced.
Forward uses a dedicated forward_ownership_events table; original Path/Ingress
event streams add classify-owner and a constrained owner actor column. Node
classification remains the separate source/owner/grant-choice contract.

This FR does not decide payment, billing, automatic failover or arbitrary runtime
extensions. Later quota/Agent execution changes require their concrete proposal.
Load/long-run, independent hosts, image publication and release remain unverified.

## Immutable Coordination Record Integration

Path publication batches retain their own immutable created_by identity, as do
the original deployment/request record owners. They are not template/group heads:
the ResourceAccess claim and publication COUNT/page predicates use created_by,
with no inferred owner_actor_id column, new classification API or audit rewrite.
The supplied principal and access checks still gate personal reads and mutations;
every referenced Forward is independently checked. Original attempt.actorId must
equal the batch creator. Governance may inspect or cancel under the explicit
policy but cannot apply/compensate as that creator. Path publication storage v2
therefore changes only the caller-aware list contract, not its head identity.
This source correction preserves the existing immutable schema and protected
history; exact SQL/owner/attempt cases remain authored and unexecuted.

## Verification Repair: Disabled Path Changes

The second N Actions candidate exposed an unintended online-readiness requirement
when attaching or replacing a disabled Forward's path binding. The native L3 Path
adapter now checks every selected Node's product use, purpose and port policy in
the original transaction with the actual Forward context. It does not call the
online Relay execution check or publish a plan for a disabled edit. Enabled
changes retain the full execution check; a pure disable retains the existing
stop-only path. This restores offline authoring while preserving N resource
authorization, the original Runtime ledger and protected history. Existing real
MySQL path-binding acceptance and added adapter failure-order regressions must
pass on the repaired saved revision; no public interface changes are introduced.
