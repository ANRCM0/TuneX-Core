# Control Application Contracts v1

Date: 2026-10-18 (Asia/Shanghai). Source candidate, not accepted or verified.

These are L3/application or owner contracts, not generic L1 business DTOs. HTTP
imports declarations directly, rather than deriving them from concrete classes,
their private fields or an artificial `never` transaction specialization. Existing
implementations explicitly implement the interfaces; constructor and method bodies
remain unchanged. Interface substitution still needs exact-source acceptance.

| Surface | Public contract entry | Existing implementation |
| --- | --- | --- |
| Node user/machine calls | modules/node-owner/public.ts: NodeApi and response DTOs | NodeService/old Nodes bridge and inherited credential owner |
| Forward user commands/path bindings | application/forward-command-contract.ts: ForwardCommandApi, ForwardBindingApi, ForwardAccepted | ForwardCommands and ControlApplication delegation |
| Member/Node grants | application/access-command-contract.ts: AccessCommandApi and responses | AccessCommands |
| Node policy/revocation | application/node-command-contract.ts: NodeManagementApi, NodeChangeResponse | NodeManagementCommands |
| Profile grants | application/transport-grant-contract.ts: TransportGrantApi, TransportGrantResponse | TransportGrantCommands |
| Scoped management details | application/control-query-contract.ts: ControlDetailApi and views | ControlQueries |
| Console paging/projections | application/console-query-contract.ts: ConsoleQueryApi, paging/filter/read contracts and views | ConsoleQueries and old console-query helpers |
| Declared native driver catalog | application/native-driver-contract.ts: NativeDriverApi and catalog view | NativeDrivers |
| Profile reference metadata | application/transport-query-contract.ts: TransportQueryApi and projection/read contracts | TransportQueries |
| Tunnel status/reference metadata | application/tunnel-query-contract.ts: TunnelQueryApi and projection/read contracts | TunnelQueries |
| Relay resource preview | application/relay-query-contract.ts: RelayPlanApi and RelayPreview | ControlApplication delegates to the existing RuntimeRelayHost |
| Experimental Transit HTTP | modules/runtime/transit-api-contract.ts: TransitNegotiationApi, TransitDeliveryApi | TransitNegotiator and TransitDeliveryService |
| Passive Node report observation | application/node-observation-contract.ts: NodeObservationApi | NodeObservations |
| Path group definitions/provenance | application/path-group-api.ts: PathGroupApi and explicit views | PathGroups |
| Manual path publication batches | application/path-publication-api.ts: PathPublicationApi and explicit responses/views | PathPublications |
| Ingress group definitions | application/ingress-group-api.ts: IngressGroupApi | IngressGroups |
| Independent ingress creation batches | application/ingress-deployment-api.ts: IngressDeploymentApi | IngressDeployments |
| Selected-origin ingress migrations | application/ingress-migration-api.ts: IngressMigrationApi | IngressMigrations |
| Forward Probe preflight/management | application/forward-probe-api.ts: ForwardProbePlanApi, ForwardProbeApi and acceptance DTOs | ForwardProbePlans and ForwardProbes |
| Probe machine HTTP v1/v2/v3 | application/probe-machine-api.ts: nine explicit machine APIs | Existing negotiation, instance, qualification, claim, delivery and result adapters |
| Optional raw telemetry and aggregates | application/telemetry-api.ts: Node/Forward/Host/ProbeTelemetryApi and TelemetryRollupApi | Existing four telemetry owners and TelemetryRollups |

Paths in this table are relative to apps/control/src. Application/runtime-owner
contract files declare separate source-candidate interface version 1; Node uses module interface
1. The old response/ExecutionCapabilities exports remain aliases from their old
implementation files. This introduces no new REST/ADP version or accepted schema.

Preserve optional Forward binding/source-operation fields, readonly member fields,
mutable concrete response fields, literal Node-change status 202, nullable
credential/recovery/cutoff values, raw revision specs and unknown error/policy
values. In particular NodeView.policy remains unknown; a type-only extraction does
not validate retained data or silently strengthen a business contract.

The API seam contains no transaction methods or executable host internals. Actual
commands still perform their original validation/authorization/idempotency/owner
effects/audit/response sequence inside their existing transaction. Moving a response
declaration is not permission to bypass that coordination or build a second owner.

Console and metadata query interfaces preserve the original paging/filter inputs,
literal Console provenance flags, raw/unknown projection fields, optional query
values and null metadata. Existing deepFreeze returns its input type, not a new
deep-readonly type: descriptor spreads retain mutable outer fields and original
nested readonly declaration values, and other inferred payload fields are not
silently strengthened into new literal promises. Profile proposed specs preserve
their original mutable outer spread and explicit transport reference. Runtime
freezing remains unchanged and unexecuted.

NativeDriverDescriptor is consumed through the public native compatibility type
entry, not an implementation class or a copied catalog schema. Catalog flags and
persisted Console/Profile/Tunnel data confer no authority, live-health/physical
compatibility or network-verification evidence.

The three Console/Profile/Tunnel SQL readers now have a separate raw L1/L2 store
and L3 projection slice, described in management-read-models-v1.md. Product DTOs
stay here; lower contracts expose raw rows and a synchronous projection callback,
not user response schemas. SQL stores no longer import application aliases or
filter helpers: composition injects existing validation/time providers. The old
MySQL reader paths remain precise stateless compatibility bindings, not accepted
L2 modules or whole-file exemptions. Item 28 records unexecuted SQL/projection/
order/legacy acceptance; other mixed adapters still need classification/separation.

RelayPreview retains the existing single-endpoint versus multihop union, absent
branch fields, readonly resource array, mutable resource values and original
broader inferred booleans. Preview authorization and resource calculation remain
in the original caller transaction; a resource proposal is not a reservation,
execution authorization or traffic evidence. No lower host contract changes here.

Transit HTTP consumes the existing experimental wire types directly and exposes
only hello, poll and report. Internal enqueuePreview and coordinator/executor
methods are absent. Null poll, contract-only handshake, received-only ACK, current
machine/session/boot checks and protected history remain implementation semantics,
not new execution capability. Transit negotiation/delivery still combine native
validation, clock, SQL and coordination; their independent API declarations do
not classify those mixed implementations as compliant L3 or storage adapters.

NodeObservationApi reuses the original observation owner DTO, optional AbortSignal
and unknown request input. Source/version validation, admission/cooldown, timeout,
cancellation, retained late-reader slots and error mapping remain owner behavior.
Persisted report observation still claims neither independent probing nor health.

Path/ingress interfaces retain explicit paging/default inputs, original status
unions, ISO timestamp views, attempt outcome unions, optional/undefined binding
results and nested immutable template values. Fields spread from const provenance
flags retain their literal types; ordinary inferred topology/state/impact strings
and booleans remain broad. Do not infer deep readonly from the original deepFreeze
return type, strengthen PathPublication status/changed types to its current fresh
response, or replace create-versus-apply attempt names with a generic batch action.

IngressGroupMember and IngressGroupResolver are owner declarations in ingress-ports.
Deployments consume resolveIn only; migrations consume describeIn and resolveIn.
Both use their caller's transaction, exact group/config identity and existing Scope
authorization/locks. No new transaction, automatic selection, global membership,
forward/Runtime writer, compensation or event owner is introduced. These internal
ports are deliberately absent from the HTTP API.

PathTemplateConfig and PathGroupConfig/Selection now have one declaration in their
existing public ports, with legacy parser-path type exports retained. The six path/
ingress ports import the public paging declaration, not executable console helpers,
and domain values through existing framework type aliases. path-operation-limits
holds the original four objects; legacy exports refer to those same objects. Keep
the three existing const-asserted readonly/literal shapes and migration's original
runtime freeze with mutable/broad numeric type. Moving initialization/import
location is unverified and belongs in concentrated acceptance.

These declaration changes do not certify the existing native format parsers or
application coordination. Their direct Core/native validation, random-ID/clock and
cross-owner helper dependencies remain classified mixed debt. No whole-file
exceptions or generic L1 business model claims follow from public type exports.

Probe HTTP now imports declarations instead of eleven class/never-Tx views.
Machine APIs consume existing v1/v2/v3 wire types without a copied schema or new
version. Preflight and current management acceptance remain distinct: existing
staged plan variants do not add echo to the three-kind management command or
machine HTTP contract. Internal authorize/issueCurrentIn/consume/store methods
are not exposed through these HTTP interfaces.

ProbeInstanceOwner lives with the original instance record/store declarations.
The moved command/registration/inspection types retain readonly fields and old
application exports. ProbeInstanceRegistry retains its generic arity as _Tx for
old callers, but no longer derives methods from a transaction-specialized class.
ProbePermitOwner declares original supplied-transaction issuance, machine actions
and manager inspection/revocation. Adapters consume only their needed methods;
the same original owner still locks the budget, persists, consumes, withdraws and
captures history. New declarations are not a second grant/permit authority.

Permit views preserve fingerprint omission, shallow mutable spreads, original
readonly nested values, optional measurement/service fields and retained staged
record/result shapes. Manager inspection projects service selection, ISO receipt
times and historical/expired result flags; manager revocation's optional withdrawal
remains a numeric timestamp. Machine observation timestamps remain numbers until
the existing wire adapters project them. Preserve owner dispatch not-implemented
and management dispatch agent-poll as distinct original fields, not new guarantees.

probe-measurement-ports holds one copy of original measurement constants/arrays,
qualification declarations and the explicit metadata helper return shape. Existing
probe-measurements exports remain aliases; its pure calculations are unchanged.
Echo metadata keeps the original paired union, not a newly strengthened protocol
correlation. Finite-plan receipt types now use the public acceptance declaration,
not ForwardProbes. Measurement SQL type consumption uses the declaration entry,
but this alone does not certify the adapter or broader dependency graph.

Original native parsers, crypto/randomness/clock, current authorization and staged
echo coupling inside Probe applications remain mixed debt. No new protocol,
network effect, registration, retry, reservation, budget refund, permit renewal,
execution or health capability is added. Source contract/type/runtime equivalence
has not been established.

The five optional telemetry APIs declare generic read/machine admission, original
wire ACKs and explicit history/capacity views. Query/default/undefined inputs,
nullable latest/session/cursor fields, readonly nested wire values, mutable outer
views, string counters and delta status unions remain distinct. Node/Host point
freshness keeps its original literal union; Forward/Probe point freshness and
ordinary inferred outer flags/version numbers remain broad. No deep-readonly or
stronger authority/health/history-completeness promise is introduced.

TelemetryRollupQuery and private delta declarations have one public API source;
the old query export remains an alias. telemetry-policy owns five original frozen
objects, with old exports retained and broad numeric types unchanged. Equal Node/
Host and Forward/Probe policies remain separate objects, not merged admission
state. Initialization/import relocation and substitution remain unverified.

Collection-disabled versus absent-adapter behavior, independent observation pool,
original admission counters/cooldown, credential/session/sequence/mapping checks,
raw retention, rollup arithmetic/cursors and logical-not-physical capacity remain
owner behavior. No SQL, route, worker or ingest/history/aggregate method body is
changed. Native parser/time/Buffer and storage-to-product-type/helper dependencies
remain explicit mixed debt, not accepted L2/L3 compliance from API extraction.

Remaining class-derived HTTP views include diagnostics/audit, station alerts,
notifications, Probe history/finite plans and observation services. They are migration work,
not accepted generic exceptions. This document does not classify all application
implementations as L3-compliant, certify the HTTP dependency graph, or open the
parallel gate. Foundation readiness item 23 records planned substitution, old alias,
payload/error/order and route checks; item 24 adds Console/catalog/reference/tunnel
substitution, type/provenance and paging/authorization cases. No checks/tests/CI
have been run here. Item 25 adds Relay preview, Transit machine HTTP and passive
Node observation substitution, response/order/authority/cancellation cases.
Item 26 adds path/ingress API and resolver substitution, old aliases/shared limit
identity, partial-acceptance/compensation/CAS/replay and restored-state cases.
Item 27 adds Probe API/owner substitution, old aliases/generic arity, shape and
one-use/revocation/budget/ACK/transaction/staged-refusal cases.
Item 28 adds real management raw-store/SQL/projection/format/provider separation,
callback ordering, old reader structural compatibility and helper/import cases.
Item 30 adds optional telemetry API substitution, policy identity/freeze/import,
admission/isolation, wire/type/precision/history/rollup/capacity cases.
