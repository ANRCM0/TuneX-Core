# Node Product Ownership Source Candidate

FR-0028, source phase only. No tests, static checks, builds, experiments or Actions
were executed for this candidate. It does not carry the frozen foundation's old
acceptance evidence forward.

## Public Contracts And Construction

`NodeService<Tx>` still extends the original `NodeAuthorityHost<Tx>`. Its constructor
accepts `Omit<NodeAuthorityOptions<Tx>, 'useAuthorization'>` plus the required
`portLimits: NodePortLimitPolicy<Tx>` provider, and always installs
`NodeResourcePolicy` against that same store. The legacy `Nodes` provider assembly
therefore cannot accidentally instantiate the product service without its policy.
The L1 Host receives `NodeUseAuthorization<Tx>`; it has no private/shared product
branches or imports from L3.

Node authority interface 5 adds `NodeUseRole`, `NodeResourceSource`,
`NodeResourceClaim`, `NodeResourceAccess`, `NodeUseAuthorization` and raw store
methods and shared-grant port policy. Runtime Relay interface advances to 7;
Node module advances to 3, Node management to 2 and Identity access commands to 3.
Personal Node port usage has its own interface 1. FR-0030 supplies port policy
and original-ledger admission; these version declarations have not been verified.

`authorizedRelayNode(tx, actor, scope, node, role)` requires ingress, transit or
egress. Missing roles fail closed even from old JavaScript callers. Direct
`authorized` and `canExecute` require ingress. Policy only permits supported
execution after the existing Scope, grant, credential and network checks also
pass; an actor's Node grant does not grant membership or capabilities.

Ordinary `provision(actor, scope, policy)` creates private ownership. The explicit
`provisionShared(actor, scope, policy)` requires Scope ownership. The original raw
store `create` now writes claim/enrollment only. NodeService explicitly inserts the
private owner's initial grant in the same transaction; shared provision creates no
implicit creator grant and requires subsequent explicit administrative assignment.
Both retain enrollment token, signer and resource initialization. A grant is
additional authority, not evidence from which ownership is derived.

`changeNodeGrant(..., expectedRevision, allowed, allowedRoles = null)` adds purposes
to the existing command. Null means no additional purpose restriction; a nonempty
distinct subset is normalized to ingress/transit/egress order. Withdrawn grants
must carry null. Invalid arrays never mean unrestricted. A purpose change advances
the existing grant revision and is included in the original idempotency digest,
response and audit. Private and unclassified Nodes reject grants and grant lists.

`NodeView` is now a discriminated union: personal owner or Scope governance sees
`detail: 'full'`; an authorized shared user sees `detail: 'basic'`, capabilities,
source/revision, revoked state and purpose restriction. The latter has no policy,
credential, authorization cutoff or other tenants' usage. Ordinary Node management
requires ownership of that private resource; Scope ownership permits governance.
Governance never grants private data-plane use.

## Explicit Legacy Classification

Use original `NodeManagementCommands.change` with:

```ts
{ kind: 'classify', expectedRevision: 1, source: 'private',
  ownerActorId: 'explicit-owner', legacyGrants: 'discard' }
```

The administrator must explicitly choose private plus owner, or admin-shared plus
null owner, and retain/discard old grants. Private requires discard, then inserts
exactly the owner's grant. Retain is only permitted for admin-shared and is an
explicit administrator decision, never an automatic migration default. Classified
resources cannot be transferred or reclassified through this command. The command
uses the original transaction, Runtime Node lock, Node row lock, resource CAS,
grant revision, idempotent receipt, audit and Node change reconciliation. A failed
effect rolls the classification back in that same transaction. No credential,
Snapshot, execution lease, protected Journal or audit history is deleted.

Migration 0039 must add `nodes.resource_source` (legacy-unclassified default for all
old rows), `owner_actor_id`, `resource_revision` (initial 1), and nullable JSON
`node_grants.allowed_roles`. New create explicitly supplies metadata. No migration
infers owners from old grants or Scope ownership. Current grant rows may be deleted
only by the explicit discard choice; their old contents are in the transaction's
resource_classification audit. New use and renewal of legacy Nodes fail closed;
existing execution is bounded by original leases and cleanup rather than an
unrecorded immediate-stop claim.

## Complete Owner Chain And Integration Work

HTTP Node provision -> NodeService -> original Identity Scope check -> explicit
resource claim + private-only explicit initial grant -> original Runtime initialize -> original enroll
and credential exchange. Machine rotation and relay credential issuance remain
in NodeAuthorityHost with original epoch lock, replay and overlapping credentials.

Forward/Probe command -> Direct authorized/canExecute -> injected resource policy
for ingress -> original resource/Operation/Snapshot chain. Relay/Multihop/Path/
Transit callers must derive each Node's purpose before sorting locks and pass it
to authorizedRelayNode. RuntimeRelayHost must use this for initial acceptance,
retry, renewal, recovery and reconciliation; facts/cleanup readers remain raw
internal integrity and cleanup ports.

Grant HTTP -> original AccessCommands transaction/owner/idempotency -> NodeService
grant CAS + purposes -> AccessChangeReconciler -> whole-path execution.allowed ->
original Runtime lock/transition or revoke/Operation -> authorization cutoff.
`allowed: true` alone never permits transition after narrowing. Node classification
and policy/revoke -> NodeManagementCommands -> original NodeChangeReconciler ->
all referenced Forwards -> same Runtime/Operation/lease cleanup chain.

Root source integration supplies framework public exports, schema/catalog, HTTP
and composition. HTTP grant DTO accepts optional allowedRoles; Node management
HTTP exposes classify through the original command API; new admin provision calls
provisionShared explicitly. Preserve existing plain provision's private default.
Node detail clients must discriminate basic/full before reading policy/credentials.
Named Direct/Relay/Transit/Path consumers and their fixtures have authored role
migrations. Full consumer closure and execution acceptance remain pending.

## Planned Acceptance

`test/node-resource-ownership.test.ts` authors product owner/access, purpose
narrowing, explicit classification, safe detail projection and original whole-path
revocation cases. They are unexecuted. Existing store fakes, NodeApi substitutes,
interface-version assertions and raw NodeAuthorityHost constructors require the
new data/port explicitly. Exact-source contract/MySQL/HTTP/Agent convergence,
classification replay/rollback, concurrent grants/classification and physical
host behavior remain acceptance work after source freeze.
