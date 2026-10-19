# Control Execution Policy Owners

Later A5 source inventory: control-runtime-legacy-leaves-v1.md records all34 old
Runtime leaf bodies and the held/per-call/module-time native bindings. The five
type-only port forwarders now use existing owner public declarations; their value
aliases and execution bodies remain exact original leaf bindings. Three Policy
type imports use the lower policy entry without changing shared DEFAULT_POLICY
value imports. Readiness203-205 remains planned/unexecuted; no whole Runtime or
cross-repository consumer acceptance is implied.

Date: 2026-10-19. Original source moved; no checks or acceptance executed.
Readiness115-118 are planned only. The original L1 Runtime hosts, ledger stores,
Agent authority/Journal and all existing transaction providers remain in place.

## Ownership And Public Calls

| Original entry | Canonical owner and implementation | Existing collaborators |
| --- | --- | --- |
| Runtime ForwardCommandExecutor | Forward public, execution.ts | Public Node authorization, local execution/resource/Relay contracts, original selected adapters and shared execution callbacks |
| Runtime ForwardExecutionRegistry/nativeDriverFor | Forward public, execution-registry.ts | Public Core parseForward and public L2 original native catalog/descriptor |
| Runtime nativeForwardAdapters | Forward public, native-adapters.ts | Public Node, local resources/Relay/execution contracts, public L2 compileDirect and L1 facts |
| Runtime ProfileGrantReconciler | Transport public, grant-reconciler.ts | Public Forward references/authorization execution and local grant contracts |
| Runtime AccessChangeReconciler | Identity public, access-reconciler.ts | Public Forward references, local membership/effect/execution contracts and public Node grant facts |
| Runtime NodeChangeReconciler | Node public, change-reconciler.ts | Public Forward references/execution, local management/effect contracts and public Identity result shape |

All six original Runtime entry files now directly alias their canonical leaves.
Execution adapter version/types, Forward resource/Relay contracts and the original
three authorization interfaces are also precise aliases. Forward authorization
belongs to Forward; AccessExecution and NodeManagementExecution extend it in their
own owners, retaining the original signatures and supplied Tx. They are product
collaboration types, not a new owner-independent L1 policy or another Runtime host.

Original Node management/grant declarations are canonical local leaves. Node
service, command, policy, API and effect types consume those local contracts; old
flat paths preserve all exports, including the original L1 AuthorizedNodeFacts
alias and NodeManagementAudit. Public Node exposes its original management/grant
types and audit declaration. No field, readonly/mutable property, command union,
writer argument, audit vocabulary or inheritance semantics was normalized.

## Registry And Native Command Coordination

The original native driver selection parses the Forward, then maps the original
via count to direct/relay/multihop. Registry construction still requires the full
native catalog length, validates descriptor/version/duplicate/six methods in the
same order, binds each original receiver, freezes the same method objects and
retains the map. Descriptor/select error strings and original business-protocol
checks remain. No dynamic driver registration or caller-selected driver appears.

ForwardCommandExecutor's fifth argument still defaults to nativeForwardAdapters
at constructor evaluation. The factory returns the original frozen three-adapter
array in the same direct/relay/multihop order. Selected private classes and methods
are original bodies, not copied framework code or new native engines.

Direct create: Node authorization -> lock Node -> forced-enabled fake-slot compiler
validation -> reserve -> real-slot compile. Update: authorization -> execution lock
-> validation -> same-revision early return, otherwise transition -> compile. Both
plan methods remain no-ops. Removal locks the original ingress Node; retry retains
the original Node authorization. compileDirect is now consumed through public L2,
not a private Runtime planner alias, with the same values and error behavior.

Path create retains path/Profile refusal, sorted authorization-plus-lock for every
Node, then its original plan accept method. Update locks Relay Nodes before the
enabled/canExecute refusal; plan update accepts only when enabled. Removal and
retry retain their original Relay lock/ingress authorization differences. Executor
Node-change handling still reads the old Node state before recovery/revoked refusal
and sorted old/new locks, then selects the next adapter. Retry still authorizes,
locks and conditionally transitions; capacity remains the original explicit call.

## Permission Change Policies

Profile reconciliation enumerates the original references, checks scope, locks,
short-circuits grant.allowed before execution.allowed, conditionally transitions,
accepts policy/revoke and conditionally checks capacity. It retains result order.
The caller's changed-only decision is unchanged; the reconciler adds no new guard.

Membership changes retain candidate scope check -> execution lock -> Forward
reread -> scope check -> deleting/authorizer skip. Only manager retains the
execution.allowed check; transition requires enabled. Accept is followed by
capacity even for an allowed disabled intent, then original path/direct cutoff
selection. Unchanged membership returns original empty result without enumeration.

Node grants retain their original scope/reference filter, execution lock and path
node collection before transition/accept/capacity. They do not acquire an extra
allowed callback. validateNode still runs when changed is false; the original
affected-node insertion order and maximumAuthorization iteration remain.

Node management first validates owner facts/scope, then enumerates references,
locks, collects path Nodes, reads source authorizer and applies the policy-only
allowed short circuit. Transition/accept/operation order remains; a denied policy
calls denyIntent after accept. Whole-Node capacity is checked for policy only;
revocation can still commit when removal Snapshots do not fit. Original cutoff
aggregation follows and no protected history or Runtime authority is cleared.

## Composition, Consumers And Compatibility

Control imports all four coordination classes and the authorization contract from
their public owners. Its existing execution callback object, same RuntimeLedger,
RelayCoordinator, constructor arguments and required provider receivers remain.
RuntimeLedger and RelayCoordinator now reference canonical public product types;
their constructor/default assembly and original L1 host implementations are not
moved. No composition root is added to exempt a business implementation.

Direct old-path consumers observed during source reading include
forward-command-ports, access-command-ports, transport-grant-ports,
node-management-ports and path-binding-ports test source. Original flat Node facts
also remain referenced by Probe/MySQL/Multihop test source. Those files were not
changed or run. This is a current slice inventory, not whole-repository consumer
closure; A5 still must account for all compatibility users and source/type/default
entries. Remove a bridge only after every actual consumer migrates and the same
frozen source proves contract/default/error/transaction equivalence.

The L1 RuntimeHost time debt identified here was handled separately by FR-0002,
explicitly confirmed and now source-authored: host interface2 requires clock and
time codec, with native implementations bound in the old RuntimeController. The
human subsequently granted standing authorization to choose and implement similar
foundation source proposals after recording the FR, without repeated confirmation.
Other L1/L2/root/native/type/default classification and the full A5 freeze candidate
remain open; no whole Runtime compliance is declared.

## Original Snapshot Assignment Sources

SnapshotAssignmentRegistry and RelayAssignmentSource now have canonical original
class bodies under Forward public; old Runtime files directly alias their leaves.
They consume original public L1 assignment contracts. The lower wire assignment
type and native catalog use L2 public aliases; nativeCloneSnapshotAssignments owns
the actual dynamic structuredClone operation, without a new storage/wire decoder.
Control still constructs one registry containing the original deferred Relay source
before Relay assembly, and its callback still reads the same Relay after assembly.

Registry construction retains module-time native role extraction, source array
validation, ID before driver checks, role ownership keys, bound collect receiver,
frozen source declarations, source-ID sorting and frozen registry. Merge validates
and freezes the same minimal context; direct assignments are cloned/deep-frozen
before awaiting any source. Each contribution is checked, cloned/deep-frozen and
appended before requesting the next source. Original assignment/logical/physical
duplicate checks, role/schema ownership and final assignment-ID sort remain.
Full ADP/config/session/fence validation remains in the original compiler.

Relay source keeps its original frozen declaration order, requires the original
reader method, captures its bound receiver and freezes itself. collect supplies
the original tx/node/includeAccepted and returns the same owner contribution. No
new source/default, second collector, resource sharing or execution authority is
added. Native clone remains a dynamic lookup on each original clone call, including
its existing failure behavior; the parent does not cache a clone across awaits.

## Runtime Directory Manual Source Classification Slice

These current files were read as source, without an import/boundary tool or
acceptance check. Each row declares actual implementation or compatibility purpose;
the rows do not exempt its dependencies or claim a complete repository inventory.

| Current runtime file(s) | Actual classification and remaining responsibility |
| --- | --- |
| forward-commands.ts, execution-adapters.ts, native-forward-adapters.ts | Exact original Forward public implementation aliases from this slice |
| execution-adapter-ports.ts, forward-command-ports.ts | Exact original canonical Forward version/types/resource/Relay/command aliases |
| authorization-ports.ts | Precise Forward/Identity/Node type aliases, no combined policy implementation |
| access-changes.ts, profile-grants.ts, node-changes.ts | Exact original Identity/Transport/Node reconciler aliases |
| access-ports.ts, node-change-ports.ts | Exact original product effect type aliases |
| snapshot-assignments.ts, relay-assignment-source.ts | Exact canonical original Forward registry/source aliases from this slice |
| snapshot-assignment-ports.ts | Exact original public L1 assignment contracts |
| ledger.ts | Legacy constructor binding original L1 ledger, stores/resources/native compiler/clock/ID; no ledger body here |
| relay-coordinator.ts | Legacy constructor binding original L1 Relay host/store/observations/compiler and static recovery; original native defaults remain explicit |
| controller.ts | Legacy constructor binding original RuntimeHost/state/observation stores and same ledger callback receiver; concrete historical constructor/types need full consumer/default record |
| relay-ledger-ports.ts | Existing empty extension of public L1 RuntimeRelayLedger; consumers/removal need final inventory |
| planner.ts, relay-planner.ts, relay-plan.ts, multihop-plan.ts, path-topology.ts | Existing public L2 compiler/type and L1 fact/resource aliases, no compiler body |
| query-ports.ts | Seven original common read/status types through framework public; original machine type explicitly selects NativeRuntimeMachinePort under FR-0008; full consumer/removal classification still needed |
| operation-contract.ts | Exact original public L1 RuntimeOperation alias |
| forward-telemetry-ports.ts, probe-telemetry-ports.ts | Original mapping/port pairs explicitly re-exported through Telemetry public; full consumer/removal inventory remains |
| transit-preparation.ts, transit-api-contract.ts | Existing Transit public compile/API/type aliases |
| transit-staging.ts | Legacy five-argument construction and original delegating methods; same staging store/exclusive reservation/release/Node/Forward collaborators, Transport type now public |
| transit-reservations.ts | Legacy function over one module-local original reservation service/native MySQL provider; no resource authority copied |
| transit-negotiation.ts | Legacy one-argument wrapper creates original public service/reader per call, preserving timing |
| transit-delivery.ts | Legacy one-argument wrapper preserves coordination instance and per-call service/store creation; original preview-only APIs |
| transit-coordination.ts | Legacy original coordinator instance/store and delegating methods/recovery over same offline journal |

Exact legacy default capture, receiver/prototype/static APIs, native state ownership,
all type references and actual consumers/removal gates still need A5-wide records.
The original L1/L2 implementations behind these aliases were not certified by this
directory source reading. Source files outside this directory remain in scope.

## Runtime Provider And Default Capture Inventory

The following are source observations, not executed default/compatibility evidence.
All existing wrapper signatures and service lifetime differences are retained.

| Existing entry | Provider/default capture point | Direct consumers observed and removal condition |
| --- | --- | --- |
| RuntimeController | At construction creates original state/observation stores and same ledger callback object; interface2 now binds nativeWallClockNow, whose Date.now lookup occurs on each sample; optional policy/authority/Relay and positional API remain | server.ts plus RuntimeController fixture/type users in Console/Path/Probe/Transport/Tunnel/NodeObservation and multihop tests; keep until all actual users migrate to explicit public host providers and exact-source acceptance |
| RuntimeLedger | At construction spreads supplied/default policy, supplies resources or original capacity-bound factory, creates one original store, captures Date.now and randomUUID references and original native compiler; supplied collector stays original | Control root, snapshot-assignment-ports/multihop-coordinator test source and ops recovery; preserve policy copy/resource fallback/clock capture/prototype before removal |
| RelayCoordinator | Constructor's default policy spread remains at call evaluation, original store/observation/compiler and captured Date.now; static recovery constructs original store and dynamically calls Date.now at invocation | Control root, multihop-coordinator test source and ops recovery; retain static API and original ledger/Tx/default until public-provider migration accepted |
| TransitStagingCoordinator | Wrapper construction retains five original collaborators, one staging service/store and reservation/release services; supplied Tx forwarding and native clock calls remain inside original service rules | transit-coordination and staging test sources; keep class/prototype/stage/abort/row exports until explicit staging-provider integration accepted |
| reserveTransitResources | One module-local original TransitReservations over native exclusive resources; underlying limit callback reads DEFAULT_POLICY.maxAssignmentsPerNode per use instead of a copied global limit | transit-reservations-db, transit-mysql-acceptance and transit-preparation source users; preserve singleton/provider callback and original resource authority |
| TransitNegotiator | Wrapper keeps db; each hello call constructs the original negotiation service and machine reader, whose clock is nativeWallClockNow at original rule point | transit-negotiation test source; no cached service/clock substitution during migration |
| TransitDeliveryService | Constructor retains one coordination wrapper; each API call constructs its original preview service/store and callback to that coordination | transit-coordination test source; preserve per-call construction and retained coordinator, no ACK-to-confirm hop |
| TransitCoordinationJournal | Constructor retains one public coordination service and native store; begin/peek/confirm/fail/recovery delegate with original arguments and supplied verifier | transit-coordination test source and delivery wrapper; preserve verifier requirement/offline journal history and receiver/lifetime before removal |
| query/telemetry type bridges | No provider/default/clock; explicit original names now target framework/Telemetry public entries | Bounded source/type consumer search is recorded separately; no removal merely because a bridge has no runtime body |

Current inspected Runtime query names are AppliedObservation, ForwardRuntimeStatus,
RuntimeObservationReader, OperationReadRecord, OperationReader, RelayDeploymentStatus,
DeploymentReader and RuntimeMachinePort. Telemetry bridges retain the original
ForwardTelemetryMapping/ForwardTelemetryMappingPort and ProbeTelemetryMapping/
ProbeTelemetryMappingPort pairs. Their declaration bodies were read before replacing
wildcards, not inferred from a checker. Public generic/type/alias equivalence and
unlisted alias/import consumers still require A5 and later acceptance.

## Planned Acceptance

Later authorized same-frozen-source Actions must compare class/function/version/
type aliases, constructor defaults and module initialization, catalog identity,
invalid/duplicate/missing methods and first errors, bound receivers, all topology/
protocol/disabled/recovery/revoked combinations, fake/real compile arguments and
same-Tx lock/reserve/transition/plan/capacity sequence. Preserve old error identity.

Compare changed/unchanged membership/grant, scope mismatch before lock/reread,
deleting/authorizer skip, all allowed short circuits, disabled capacity differences,
path Node/cutoff order, sourceActor null, policy denial after acceptance, whole-Node
revocation without capacity refusal, maximum cutoff and exact operation/result
ordering. Mid-callback/store failures must roll back the original caller Tx.

Compare registry source sorting/duplicate/error precedence, bound receiver, clone
before next await, native clone errors, direct-versus-owner role/physical conflicts,
invalid contribution and final sort. Compare original deferred Relay construction,
same ledger collector, frozen declarations/context and no new provider fallback.

Compare all Node declaration/readonly/union/audit shapes and public/legacy identity,
existing constructors and defaults. These cases are unexecuted. No tests, type/
syntax/static/boundary/import checks, formatting/generation/builds, CI, native/
network/MySQL/browser/container experiments, commits, pushes or agents this turn.
