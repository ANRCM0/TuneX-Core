# Control Runtime Legacy Leaves v1

Date: 2026-10-19 (Asia/Shanghai). All34 current source bodies in
apps/control/src/modules/runtime were read for this bounded inventory. Eight
entries assemble providers or retain a callable construction binding, one declares
an interface, and25 forward existing values/types. This records source roles and
observed callers; it is not a dependency check, full caller audit, frozen revision
or accepted foundation. Earlier policy/Transit extraction remains in its original
owners; this slice does not repeat those moves.

## Existing Construction And Callable Bindings

Paths in this table are relative to apps/control/src/modules/runtime. These
entries are existing native/legacy compositions, not reusable pure L1 services
or permission to add another business composition root.

| Leaf | Source responsibility and exact binding to retain | Observed callers |
| --- | --- | --- |
| controller.ts | RuntimeController extends RuntimeHost<Transaction,NativeRuntimeFamily>; original db/Nodes/Forward/Ledger/policy/Authority/optional Relay arguments. Binds MySqlRuntimeStateStore(db), MySqlRuntimeStatusStore, RuntimeStatusQueries and original runtime/status codecs/nativeWallClockNow. Ledger callbacks keep the original forwarding argument and member-call receiver. | server.ts; RuntimeController type consumers in Console/Probe/Path/Transport/Tunnel tests and value construction in multihop-runtime.test.ts |
| ledger.ts | RuntimeLedger extends the one RuntimeLedgerHost; creates selectedPolicy from policy or the original DEFAULT_POLICY, then uses supplied resources or createMySqlRuntimeResources(selectedPolicy.maxAssignmentsPerNode). Binds original store/compiler and captured Date.now/randomUUID functions. Authorization and assignment collector retain their supplied values. | application/control.ts; scripts/ops/recovery.ts lazy quarantine callback; snapshot-assignment-ports.test.ts and multihop-coordinator.test.ts |
| relay-coordinator.ts | RelayCoordinator extends the one RuntimeRelayHost; public Node/Forward/Transport/endpoint providers join the supplied ledger. Default policy is a fresh spread and multihopEnabled defaults false. Original deployment/observation stores, native compiler and captured Date.now remain. Static quarantine creates the original store and samples Date.now on invocation with the caller Tx. | application/control.ts; scripts/ops/recovery.ts static quarantine callback; multihop-coordinator.test.ts |
| transit-coordination.ts | TransitCoordinationJournal holds one db and one TransitCoordinationService with the original transaction closure and MySqlTransitCoordinationStore. begin/peek/confirm/fail/quarantineRecovery delegate to that held service. offlineTransitStep and five original type names retain public aliases. | transit-delivery.ts; transit-coordination.test.ts |
| transit-delivery.ts | TransitDeliveryService holds its original db and one TransitCoordinationJournal; each method calls service(), constructing TransitPreviewDelivery/store/transaction closure at the original call position. Its planner exposes only the original peek callback; receipts do not confirm offline coordination. | transit-coordination.test.ts; actual application/control.ts uses public owners directly instead of this old constructor |
| transit-negotiation.ts | TransitNegotiator holds db; hello constructs the original TransitNegotiationService and MySqlTransitMachineReader per invocation, with the original transaction closure and arguments. | transit-negotiation.test.ts; actual application/control.ts binds the public owner directly |
| transit-reservations.ts | Module-time TransitReservations(createMySqlExclusiveReservations()) is retained once. reserveTransitResources forwards the exact supplied Tx/Forward/resource array/generation; validateTransitReservationSet is the original public alias. This file has a module initialization effect, not just exports. | transit-mysql-acceptance.test.ts, transit-reservations-db.test.ts and transit-preparation.test.ts |
| transit-staging.ts | TransitStagingCoordinator retains its five constructor arguments, one held TransitStagingService and original Node/Forward/Transport/endpoint member-call callbacks. The same exclusive reservation/release provider owners and MySqlTransitStagingStore remain. stage/abort delegate; verifyTransitStage is a public alias. TransitStageRow remains an interface extending the lower stored row. | transit-coordination.test.ts and transit-staging.test.ts |

Native effects, SQL, default provider bodies, owner authorization and clock calls
are not moved or edited by this slice. The concrete Nodes/RuntimeLedger/Relay/
Authority types at the old constructor boundaries remain their existing source
contracts. A narrower structural replacement would need its own impact review;
it is not inferred from a consumer's current subset of calls.

## Retained Interface Declaration

relay-ledger-ports.ts declares RelayExecutionLedger<Tx> extending the public
NativeRuntimeRelayLedger<Tx> specialization. ledger.ts implements it and
relay-coordinator.ts consumes it. The declaration is retained, rather than
silently changed into a type alias or a second independent ledger contract.
Its native family and supplied transaction remain explicit. Generic/structural
compatibility and declaration behavior still require acceptance.

## Forwarding Leaves

The25 rows describe full source bodies. Exact value aliases continue to reference
their existing leaves to preserve the current loading graph. A public entry being
available does not justify widening a value import in a compatibility forwarder.
New product consumers use the declared owner public entrypoint.

| Leaf | Exact original source role and destination |
| --- | --- |
| access-changes.ts | AccessChangeReconciler value alias, identity-owner/access-reconciler.ts |
| access-ports.ts | AccessExecutionResult/AccessChangeEffects type aliases, identity-owner/public.ts |
| authorization-ports.ts | ForwardAuthorizationExecution/AccessExecution/NodeManagementExecution type aliases, respective Forward/Identity/Node public entries |
| execution-adapter-ports.ts | EXECUTION_HOST_VERSION value stays at forward-owner/execution-contracts.ts; NativeDriverId/ForwardExecutionAdapter types use forward-owner/public.ts |
| execution-adapters.ts | ForwardExecutionRegistry/nativeDriverFor value aliases, forward-owner/execution-registry.ts |
| forward-command-ports.ts | Four operation/preparation and two resource/Relay types from forward-owner/public.ts |
| forward-commands.ts | ForwardCommandExecutor value alias, forward-owner/execution.ts |
| forward-telemetry-ports.ts | ForwardTelemetryMapping/ForwardTelemetryMappingPort types from telemetry-owner/public.ts |
| multihop-plan.ts | compileMultihopResources/compileMultihopPlan values and NativeRuntimeMultihopInput as MultihopPlanInput from compatibility/public.ts |
| native-forward-adapters.ts | nativeForwardAdapters value alias, forward-owner/native-adapters.ts; this is a native binding, not an independent L1 adapter registry |
| node-change-ports.ts | NodeManagementEffects type alias from node-owner/public.ts |
| node-changes.ts | NodeChangeReconciler value alias, node-owner/change-reconciler.ts |
| operation-contract.ts | RuntimeOperation as Operation type alias from framework/public.ts |
| path-topology.ts | Three topology values and PathRole/PathNode/PathHop/PathTopology types from compatibility/public.ts |
| planner.ts | compileDirect/compileSnapshot and native DirectRuntimeAssignment/SnapshotInput from compatibility/public.ts; AuthorizedNodeFacts/ReservedSlot types from framework/public.ts |
| probe-telemetry-ports.ts | ProbeTelemetryMapping/ProbeTelemetryMappingPort types from telemetry-owner/public.ts |
| profile-grants.ts | ProfileGrantReconciler value alias, transport-owner/grant-reconciler.ts |
| query-ports.ts | Seven existing common read/status types from framework/public.ts; RuntimeMachinePort explicitly aliases NativeRuntimeMachinePort from compatibility/public.ts |
| relay-assignment-source.ts | RelayAssignmentSource value alias, forward-owner/relay-assignment-source.ts |
| relay-plan.ts | compileRelayPlan/relayPeerPinsChanged and native prepared-plan type from compatibility/public.ts; reserved-resource/Node-facts types from framework/public.ts |
| relay-planner.ts | compileRelayResources value from compatibility/public.ts and RelayResource type from framework/public.ts |
| snapshot-assignment-ports.ts | SnapshotAssignmentContext type from framework/public.ts; five exact native contribution/declaration/source/collector/Relay-reader aliases from compatibility/public.ts |
| snapshot-assignments.ts | SnapshotAssignmentRegistry value alias, forward-owner/snapshot-assignments.ts |
| transit-api-contract.ts | TRANSIT_API_INTERFACE_VERSION value and negotiation/delivery API type aliases from transit-owner/public.ts |
| transit-preparation.ts | Two existing compilation functions and seven preparation/resource/input type aliases from transit-owner/public.ts |

## Type Source Changes In This Slice

The five access/authorization/execution-adapter/forward-command/node-change port
leaves now export types through the existing owner public entrypoints. Each public
entry reexports the same canonical declaration; no copy, field change, new API,
version change or runtime wrapper is introduced. execution-adapter-ports.ts keeps
its version value on the original leaf, separately from its erased type exports.

controller.ts, ledger.ts and relay-coordinator.ts now import type Policy directly
from @tunex/contracts/policy. The old shared -> types -> policy chain already
reexports this exact declaration. Ledger and Relay keep their original value
imports of DEFAULT_POLICY from shared; no eager native module initialization is
removed or broadened by changing that value import.

These eight files change only type import/export sources. This is ordinary source
reference cleanup under the existing contract, not a new frozen interface or
semantic change requiring a new FR. Module emission/loading, type alias identity,
source/default compatibility and prior FR acceptance remain unverified.

## Support Consumers And Removal Conditions

Observed direct compatibility consumers include these existing source groups:

| Entry family | Identified support source consumers |
| --- | --- |
| Access/Node/Profile/Forward collaboration | access-command-ports, node-management-ports, transport-grant-ports, forward-command-ports and path-binding-ports tests; both erased port imports and value aliases matter |
| Direct/Snapshot/Relay/multihop compilation | scripts/phase1/acceptance.ts and scripts/build-multihop-fixtures.mjs; planner, relay-plan, relay-planner, path-topology, multihop-plan, multihop-coordinator/runtime, forward-probe, Probe negotiation/permit and fixtures/multihop test sources |
| Assignment collection | scripts/ops/recovery.ts imports SnapshotAssignmentRegistry from the old leaf; snapshot-assignment-ports.test.ts imports the old collector context/declarations, Registry and Relay source |
| Runtime construction/status | server.ts, application/control.ts and the constructor/type test callers named in the first table |
| Transit contract/offline behavior | coordination/negotiation/preparation/staging/reservations-db/MySQL test sources named in the first table |
| Source boundary tooling | scripts/check-boundaries.mjs still contains older Runtime path allowlists and body assumptions; these are later adaptation inputs, not current passing evidence or production import consumers |

The support/test files were located by source navigation; no test, fixture
generator, boundary tool or phase script was executed or edited. The bounded
34-file reading does not prove a complete per-symbol caller map outside this
directory or absence of another direct/private/dynamic consumer. Top-level59
module roles remain in control-legacy-module-leaves-v1.md.

Before removal, account for every actual value/type import, old export name,
generic/native specialization, constructor/default/receiver, module-time versus
per-call construction and static/lazy Recovery promise. Migrate actual callers
and demonstrate same-frozen-source acceptance. Current old forwarders and
constructors remain necessary compatibility entries; this inventory authorizes
neither deletion nor a directory exemption.

Readiness203-205 records the bounded map, type sources and lifecycle/consumer
cases, all planned/unexecuted. Full application/nested owner/Agent/Web/private/
default/fixture/asset/consumer closure and the saved candidate remain open.
No checks, tests, formatters, generators, builds, CI, network/MySQL/browser/native
experiments, commits, pushes or subagent delegation occurred in this slice.
