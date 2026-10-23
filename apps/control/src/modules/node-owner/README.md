# Node Owner Module

Source-candidate public interface 3 (FR-0028/FR-0030), unverified. Entry: `public.ts`.

`NodeService<Tx>` owns product provision, policy, grant, revoke and view commands.
Existing NodeManagementCommand/Change/Writer and NodeGrantState/Writer contracts
stay with this owner. Credential and runtime execution authorization coordination
is inherited from the public L1 NodeAuthorityHost, not copied here.

Composition supplies NodeAuthorityOptions: the original transaction boundary and
Scope/access authority, Node store, machine lookup, resource locks, PKI signer,
secret generator/hash, native codec and clock. In live Control, the old Nodes
constructor binds the existing providers; callers need not migrate constructors
to use this source split. Providers do not add a parallel ledger or trust root.

Commands with a Tx argument join the caller's original transaction. Provision and
view/list operations retain their existing transaction entrypoints. Management
visibility, Runtime Node lock and scoped Node lock remain ordered; grant access
audit still calls the original Identity owner in that same transaction. Machine
TLS lookup retains its explicit pool-backed provider, never used as a replacement
for transaction-bound command authorization. Do not call storage directly from
another module or bypass the public command/authorization contracts.

There is no platform branch, SQL, raw signing process or crypto implementation in
this module. The native network-policy validator is a public L2 adapter, while
the product management-command shape/snapshot stays here. No automatic retry or
new credential/protocol/policy semantics are part of this extraction.

This module is unverified. Concentrated acceptance cases are in the foundation
readiness record, item 12; tests/checks/builds/PKI experiments have not been run for
this source. The foundation and parallel-development gates remain closed.

NodeApi and its response DTOs are the independent HTTP-facing contract, covering
the existing user and online machine calls without exposing NodeService, Nodes or
transaction methods. NodeService implements the contract through its own product
methods and inherited lower credential owner; L1 does not import this L3 API.
NodeView.policy intentionally remains unknown, matching the old untyped stored
projection rather than asserting a newly validated policy. Existing mutable
response shapes, nullable cutoffs and credential fields are unchanged in source
intent. Item 23 records old/new API and HTTP substitution acceptance, unexecuted.

## Shared Node Port Limits

FR-0028 separates product claims from grant effects. Raw authority store `create`
persists claim/enrollment only. NodeService creates the private owner's initial
grant in the original transaction; shared provision gives the administrator no
implicit use grant. Original grant commands then assign shared use explicitly.
Node authority5 and the source-only compatibility work are recorded in
`PRODUCT-INTEGRATION.md`; prior frozen acceptance does not certify this successor.

`NodeGrantPortLimits` contains `allowedPorts: readonly number[] | null` and
`maxBindings: number | null`. The port subset must be nonempty, unique and within
1..65535; maximum binding count is a nonnegative safe integer. Null removes that
extra restriction, never a Node network/purpose restriction. A private Node is
exempt from shared-grant limits. Neither Scope governance nor a grant creates
ownership of another person's private Node.

The `NodeService.changeGrant` and Identity `changeNodeGrant` final optional
`portLimits` argument has three states: omitted preserves current limits, null
clears them, and a validated object replaces them. The command digest preserves
omitted versus explicit null. Grant CAS, audit and original access-change effects
run in their original transaction; narrowing enters the existing whole-route
eligibility and revoke/cleanup chain. Grant list and basic Node view return the
caller's limits through the Node-owned DTO.

`NodePortLimitPolicy` implements public L1 `RuntimePortReservationPolicy`, using
`NodeAuthorityStore` and the injected original `RuntimePortUsageStore`. Runtime
resource and exclusive hosts require a policy and check it while holding the
original ordered Runtime Node locks, before assigning original `port_slots`.
No second occupation table, counter, allocator or authority is introduced.

Each occupied physical `protocol+port` slot is one binding, including internal
Relay TLS listeners and old/draining slots until original release. TCP and UDP
are separate rows even for the same number. A Forward reusing its same slot adds
no count; Transit exclusive reservation still rejects any occupied slot. Count
uses immutable `forwards.owner_actor_id`, never the mutable authorization actor,
creator, Scope owner or current grant holder. The exact current Forward's slots
are also included before insertion when its explicit creating owner is supplied.

New use, retry, snapshot renewal and recovery pass the Forward through the
Node-use policy so its retained physical slots obey the current range and the
subject's entire current count. Narrowing below existing occupancy prevents more
execution rather than inventing an eviction order or prematurely releasing old
fences. Exact stop/removal and original cleanup still work after grant loss or
narrowing; accepted leases remain governed by original safety/drain cutoffs.

`NodeService.reservationPorts(tx, actor, scopeId, nodeId, candidates)` filters the
original automatic Relay/Transit candidate set before selection, so an early
denied candidate cannot hide later legal ports. The final full-set reservation
check remains authoritative for count and retained-slot range.

Minimal composition (all providers still join the original transaction):

```ts
const usage = new MySqlRuntimeResourceStore();
const nodeStore = new MySqlNodeAuthorityStore();
const portLimits = new NodePortLimitPolicy(nodeStore, usage);
const resources = new RuntimeResources(usage, maxAssignments, portLimits);
const nodes = new NodeService({ ...originalOptions, store: nodeStore,
    resources, portLimits, additionalUseAuthorization });
// Creation precedes its Forward row, so supply the explicit product owner.
await resources.reserve(tx, forward, creatingActorId);
```

`additionalUseAuthorization` is optional and conjunctive: it can refuse a Node
use that passed ownership, grant purposes and port limits, and cannot widen any
of those. Live composition can bind the separate byte-budget owner here.

Root integration must export the new L1 ports, bind every production/compatibility
factory, preserve Forward/owner context in Runtime delegates, add nullable
`node_grants.port_limits` JSON and update schema catalogs and HTTP DTOs. Existing
NodeAuthorityStore fakes need `port_limits` in resource/grant projections and
the new grant writer value; direct NodeService/Runtime constructors need explicit
policies; Relay/Transit node fakes need `reservationPorts`. Runtime API versions
are recorded in FR-0030. The new contract-case file is authored only; no tests,
static/type/syntax/boundary checks, generators, builds or CI have been executed.
