# Transit Staging And Exact Reservation Release v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2 fourteenth source slice, the original offline stage/abort chain.

## Public Owner And Providers

TransitStagingService is the single original product coordinator. Its required
TransitStagingOptions providers are the caller transaction boundary, raw staging
storage, existing L1 Node authorization/credential facts, public Forward locking
and authorizer, public Transport/Endpoint resolvers, public TransitReservations,
and RuntimeReservationReleaseAccess. Pick types select independent public owner
contracts, never concrete-class implementations. No L0 interface changes.

The original compilePathTopology, retained-stage verifier, preparation compiler,
resource-set validator, exclusive reservation mode and native value helpers are
reused. Public L2 supplies the original dynamic wall clock, supplied-time ISO,
JSON encoding and lazy stored-value decoding. No clock is captured at construction.
Public staging exposes the original stage/abort signatures, with no live HTTP
route or production registration added.

MySqlTransitStagingStore consumes only lower raw contracts. It contains the
original stage SQL and read-only coordination/runtime_nodes/port_slots/leases/
snapshots observations. These cross-owner reads are explicit original evidence,
not authority to write those owners' state. Its only writes insert or abort the
original transit_deployments row. It adds no pool, transaction, retry, parser,
clock, authorization, resource allocator or protected-history cleanup.

## Stage Order

The revision guard runs before acquiring the transaction. Inside it, lock Forward,
compare revision, resolve original authorizer, then compile/check topology and
locked Transport reference. Forward locking serializes even first writers with
no existing stage. Read the latest generation using the original descending
LIMIT 1 FOR UPDATE, refuse newer revision/reserved stage, then derive and check
generation without extra retained-data validation.

Lock sorted path Node sessions before resolving Profile. Sample time once after
Profile resolution; each sorted Node retains authorizedRelayNode, facts, current
credentials, descending-validity/fingerprint selection and the >now+10000 checks.
Resolve Endpoints in hop order. Keep allowed-port iteration, per-Endpoint seen set,
unlocked literal-TCP candidate projection, complete resource compilation and
unlocked physical-owner observations in their original order.

TransitReservations validates the set and delegates exclusive reservation in the
same transaction. That mode still rejects any owner, including the same Forward,
and retains original sorted locks/capacity timing. Compile preparation using the
sampled ISO time, original pins and min(Profile limit,4096), cap stage expiry at
five minutes, require more than ten seconds and encode the plan only at insertion.
The returned preparation remains non-executable. Any later refusal rolls back
earlier reservations together with the stage write.

## Abort And Resource Ownership

Validate generation before the transaction, lock the scoped stage, check original
actor, verify retained plan, and return false for already-aborted state. That
idempotent return must not consult unused Node/Forward/Profile/Endpoint providers.
Any coordination row, including a terminal one, refuses abort before further
Runtime/history access; compensation alone does not authorize releasing its Fence.

Lock sorted distinct assignment Nodes using the original row-count===1 guard.
Only then sample time once. Retain the raw nullable maximum Forward lease and
five-second margin, per-Node Snapshot query with valid_until>now-5000, lazy JSON
decoding and original malformed/matching-assignment refusal. Do not replace this
proof with a current-only observation or reinterpret historical data.

The original exact slot algorithm is extracted into RuntimeReservationRelease,
another mode of the same Runtime resource owner. Its lower structural identity
contains only nodeId, bindingFence and physical protocol/port; it has no Transit
or product dependency. First lock and verify ALL assignments in retained order,
checking owner, Fence and generation. Only after the complete set passes, execute
each original owner/Fence/generation-predicated release and require one affected
row. Existing MySqlRuntimeResourceStore supplies the same lockSlot query plus
the original exact update; broad releaseForwardSlots is not used.

After all releases, the original reserved-to-aborted stage CAS must affect one
row. A slot race, partial release failure or stage CAS failure aborts the caller
transaction. No Fence increment, generation reset, resource deletion, lease or
Snapshot write, journal/high-water clearing, execution proof or second ledger is
introduced. RuntimeReservationRelease does not itself prove safe historical
cleanup: callers remain responsible for the original transaction and evidence.

## Compatibility And Evidence

The old modules/runtime/transit-staging.ts retains its five-argument constructor,
db/Node/Forward/Transport/Endpoint fields, own async stage/abort methods, stage-row
type and direct verifyTransitStage alias. It binds the one public service to
original MySQL/default providers. Lazy callbacks preserve collaborator field
reads at call time, including abort fixtures passing null for unused providers.
Construction opens no connection and does not invoke those providers. The existing
offline-only status and feature defaults remain unchanged.

Remove the bridge only after consumer inventory, public compatibility approval
and same-frozen-source acceptance. Existing tests include direct old verifier/type
imports and a null-collaborator abort fixture; they have only been read here.
Readiness item 67 records old/new initialization, refusal, SQL/lock, transaction,
time/digest, precise release and rollback cases. It remains entirely unexecuted.
No test/type/syntax/static/boundary check, formatter/generator/build, experiment,
CI, commit/push or delegation ran. Boundary declarations do not prove compliance.

The seven named Transit legacy paths now have source implementations or precise
bridges. This is not whole A2 closure: other mixed application owners, A1 residuals,
Agent Probe/native, Runner and complete source/type classification remain open.
The foundation, upper-module and later phase gates remain closed.
