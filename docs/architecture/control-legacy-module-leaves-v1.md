# Control Legacy Module Leaves v1

Follow-up: control-runtime-legacy-leaves-v1.md records the34 nested Runtime leaves
separately, with eight construction/callable bindings, one retained interface and
25 forwarders. Its five public type-forwarding and three Policy type-import source
changes retain the same declarations; readiness203-205 is planned/unexecuted.
This extends the bounded source map, not full nested-owner/caller acceptance.

Date: 2026-10-19 (Asia/Shanghai). Complete source bodies read for the59 current
top-level files in apps/control/src/modules, excluding its subdirectories.
Six are existing construction/static bindings;53 are type/value forwarding
entries. This bounded inventory is not an import-graph check, proof that callers
are unused, full Control classification or current-source acceptance.

## Existing Construction Bindings

Paths below are relative to apps/control/src/modules. These six original
entries bind providers for existing owners; their placement in the legacy
directory does not make them pure L1 or a recipe for a new product module.

| Old leaf | Actual owner/providers and original defaults | Identified production composition consumers |
| --- | --- | --- |
| identity.ts | Identity extends IdentityService<Transaction>; MySqlIdentityStore and account lookup(db), nativeNodeSecrets/nativeIdentityCodec, dynamic ()=>Date.now() | server.ts and bootstrap.ts; scripts/ops/recovery.ts constructs on original callback invocation |
| nodes.ts | Nodes extends NodeService<Transaction>; original signer/identity, overlap120/relayCredential86400, default createMySqlRuntimeResources(), authority store/machine lookup, native secrets/codec; now:Date.now captured at construction; static quarantine calls original store with supplied Tx | server.ts and ControlApplication's existing Nodes parameter/type; scripts/ops/recovery.ts static binding |
| forwarding.ts | Zero-argument Forwarding extends ForwardStateService<Transaction>; binds MySqlForwardIntentStore and nativeStoredValues, no new pool/Tx owner | ControlApplication original field initializer; scripts/ops/recovery.ts original quarantine callback |
| idempotency.ts | Zero-argument Idempotency extends IdempotencyHost<Transaction,Accepted>; same MySqlIdempotencyStore/nativeStoredValues; RequestIdentity and Accepted old names retained | ControlApplication original field initializer/Accepted type; scripts/ops/recovery.ts original quarantine callback |
| transport.ts | Transport extends TransportService<Transaction>; required db/identity/idempotency/forwarding, MySqlTransportProfileStore/native codec, dynamic ()=>Date.now(), captured imported randomUUID function; static quarantine retains original supplied Tx | ControlApplication existing constructor assembly; scripts/ops/recovery.ts static binding |
| relay-endpoints.ts | RelayEndpoints extends RelayEndpointService<Transaction>; required db/identity/nodes/idempotency/forwarding, original MySqlRelayEndpointStore/native codec and dynamic ()=>Date.now(); old parse/type reexports retained | ControlApplication original constructor assembly |

The distinction between a clock closure and a captured Date.now function is
observable under replacement/instrumented environments and existing fixtures.
Keep the source expressions and their construction/call positions. Similarly,
do not make lazy Recovery callbacks eagerly construct owners, turn an optional
resource default into a second ledger, change parameter defaults or manufacture
a transaction merely to make a wrapper look independent.

## Exact Forwarding Leaves

Every row describes the current full body, not a new module implementation or
permission to import its destination privately from another owner. Legacy
forwarders can intentionally retain an exact original leaf binding. New product
consumers use the canonical owner's public.ts (or existing declared L1/L2 public
contract). A value reexport and a type-only reexport have different initialization
effects; do not rewrite value forwarders to broader barrels without acceptance.

| Old leaf | Full-body responsibility and canonical destination |
| --- | --- |
| audit-ports.ts | AUDIT_SOURCES/KINDS/ERROR_CODES and Audit types, audit-owner/contracts.ts |
| forward-diagnostic-ports.ts | Type star, forward-diagnostic-owner/contracts.ts |
| forward-query-ports.ts | ForwardReadPort type, forward-owner/public.ts |
| forward-telemetry-ports.ts | Type star, telemetry-owner/forward-contracts.ts |
| forwarding-ports.ts | ForwardRuntimeReader/ProfileForwardReferences/RelayForwardReferences/ActorForwardReferences/NodeForwardReferences/ForwardWriter types, forward-owner/public.ts |
| host-telemetry-ports.ts | Type star, telemetry-owner/host-contracts.ts |
| identity-credentials.ts | tokenHash/validBearerToken native function aliases, infrastructure/identity-secrets.ts; explicit old native entry |
| identity-ports.ts | MemberChangeInput/State/Writer types, identity-owner/public.ts |
| ingress-contract.ts | INGRESS_LIMITS and four original group/selection/input/plan parsers, ingress-owner/public.ts |
| ingress-migration-contract.ts | Migration limits and origin/lineage/input/plan parsers, ingress-owner/public.ts |
| ingress-migration-ports.ts | Type star, ingress-owner/migration-contracts.ts |
| ingress-ports.ts | Type star, ingress-owner/contracts.ts |
| native-path-references.ts | Exact NativePathReferences class alias, path-owner/references.ts |
| node-execution-ports.ts | ForwardNodeAuthorization/RelayNodeAuthority types, node-owner/execution-contracts.ts |
| node-grant-ports.ts | NodeGrantState/Writer types, node-owner/grant-contracts.ts |
| node-management-ports.ts | Original authorized facts/policy/command/change/audit/writer types, node-owner/management-contracts.ts |
| node-policy.ts | validatePolicy/snapshotNodeCommand functions, node-owner/public.ts |
| node-report-observation.ts | Exact observeNodeReport function, node-observation-owner/rules.ts |
| notification-delivery-ports.ts | Type star, notification-owner/delivery-contracts.ts |
| notification-ports.ts | Type star, notification-owner/endpoint-contracts.ts |
| observation-policy.ts | Exact original diagnostic/audit/station/notification/history/plan policy exports, their named owner policy.ts files |
| observation-ports.ts | Four original report/context/provenance types from framework/node-report-read-ports.ts and type star from node-observation-owner/contracts.ts |
| observation-service-ports.ts | OBSERVATION_SERVICE_LIMITS/ALPN and original service/config/receipt/store types, observation-service-owner/contracts.ts |
| path-binding-contract.ts | parsePathSelection/expandPath functions, path-owner/public.ts |
| path-binding-ports.ts | Type star, path-owner/binding-contracts.ts |
| path-group-contract.ts | Group parser/selection/limits and config/selection types, path-owner/public.ts |
| path-group-ports.ts | Type star, path-owner/group-contracts.ts |
| path-operation-limits.ts | Exact Path group/publication objects from path-owner/limits.ts and Ingress/migration objects from ingress-owner/limits.ts |
| path-publication-contract.ts | Original limits/rejections/hash/input/state/plan/checked-plan functions, path-owner/public.ts |
| path-publication-ports.ts | Type star, path-owner/publication-contracts.ts |
| path-template-contract.ts | parsePathTemplate/pathRequirements and PathTemplateConfig, path-owner/public.ts |
| path-template-ports.ts | Type star, path-owner/template-contracts.ts |
| probe-instance-ports.ts | Original instance record/command/registration/inspection/owner/store types, probe-owner/instance-contracts.ts |
| probe-measurement-ports.ts | Measurement constants/arrays and qualification/description types, probe-owner/measurement-contracts.ts |
| probe-measurements.ts | Same original constants/types plus isEchoMeasurement/probeMeasurement/probeEchoMeasurement functions, probe-owner/public.ts |
| probe-negotiation-ports.ts | ProbeMachineEvidence/Reader types, probe-owner/machine-contracts.ts |
| probe-owner-ports.ts | PROBE_OWNER_INTERFACE_VERSION and original permit/result/offer/inspection/owner types, probe-owner/owner-contracts.ts |
| probe-permit-ports.ts | Permit record/plans/store types from probe-owner/permit-contracts.ts, CurrentProbeInstances from instance-contracts.ts |
| probe-permit-state.ts | validProbeBinding/sameProbeBinding/validProbePermit functions, probe-owner/public.ts |
| probe-plan-ports.ts | Type star, probe-plan-owner/contracts.ts |
| probe-ports.ts | Original intents/nodes/published-reader/binding/plan types, probe-owner/plan-contracts.ts |
| probe-result-ports.ts | ProbeResultRecord/Store types, probe-owner/result-contracts.ts |
| probe-run-ports.ts | Type star, probe-history-owner/contracts.ts |
| probe-service-ports.ts | ProbeServiceReference/Resolver/EchoServiceResolver types, probe-owner/service-contracts.ts |
| probe-telemetry-ports.ts | Type star, telemetry-owner/probe-contracts.ts |
| relay-endpoint-contract.ts | RelayEndpoint/ResolvedEndpoint/Resolver types from relay-endpoint-owner/public.ts; parseRelayEndpoint function from compatibility/public.ts |
| station-alert-ports.ts | Type star, station-alert-owner/contracts.ts |
| target-policy.ts | Exact targetAllowed native function alias, compatibility/public.ts |
| telemetry-policy.ts | Five original distinct frozen policy objects, telemetry-owner/policy.ts |
| telemetry-ports.ts | Type star, telemetry-owner/node-contracts.ts |
| telemetry-rollup-ports.ts | Type star, telemetry-owner/rollup-contracts.ts |
| telemetry-rollup-values.ts | Full original value/type export star, telemetry-owner/rollup-values.ts |
| transport-ports.ts | Original resolved Profile/resolver and grant command/state/writer/effects types, transport-owner/public.ts |

These entries create no copied rule bodies, store tables, default objects,
measurements, permit state, background workers or authority. Exact function/class/
object identity remains intended by direct aliases, with runtime/type/loading
acceptance still pending. Native source destinations remain native, regardless
of a legacy path ending in policy/contract/ports.

## Public Type Consumer Source Changes

The following source imports now reach their existing owner public contract
directly. They are all import type or export type changes; declarations, old
export names, constructor signatures, method bodies and version counters stay.
No new FR is needed because these references identify the same existing public
types rather than changing a frozen interface or its semantics.

| Consumer | Earlier intermediate source | Current public source and exact declaration |
| --- | --- | --- |
| modules/idempotency.ts Accepted import and old export | application/forward-commands.ts | modules/forward-owner/public.ts -> command-api.ts ForwardAccepted |
| modules/transport-owner/contracts.ts ProfileForwardReferences | modules/forwarding-ports.ts | modules/forward-owner/public.ts -> contracts.ts ProfileForwardReferences |
| modules/relay-endpoint-owner/contracts.ts RelayForwardReferences | modules/forwarding-ports.ts | modules/forward-owner/public.ts -> contracts.ts RelayForwardReferences |
| modules/nodes.ts ForwardNodeAuthorization/RelayNodeAuthority | modules/node-execution-ports.ts | modules/node-owner/public.ts -> execution-contracts.ts |
| application/control.ts MemberChangeInput | modules/identity-ports.ts | modules/identity-owner/public.ts -> contracts.ts MemberChangeInput |

Value imports, six constructor/static bodies, original same-Tx owner calls,
native loading sites and old forwarding files are preserved. In particular,
relay-endpoints.ts keeps its existing value/type binding through the old
relay-endpoint-contract.ts; broadening that value import is not needed for the
type consumer fix. Type erasure/import-cycle/structural substitution still needs
acceptance on the exact frozen source, not an unexecuted inference of compilation.

## Real Compatibility Consumers And Removal Conditions

The identified production assembly includes server.ts, bootstrap.ts,
application/control.ts and scripts/ops/recovery.ts as listed above. Existing
Recovery calls public owner methods with the original supplied Tx through lazy
bindings; retaining legacy constructors is distinct from allowing Recovery to
write another owner's tables. Its full owner/order/native chain remains in
recovery-owner-workflow-v1.md and recovery-native-effects-v1.md.

Additional source consumers include phase1/acceptance and phase2 acceptance,
access/access-migration, capacity, faults, linux-agent, multihop, Probe, Recovery,
Relay/capacity/isolation, security and Transport scripts. Identified test consumers
include identity-input, console/forward-probe/node-observation/path-binding/path-
template/Probe-instance/negotiation/permit/Transport-query/Tunnel-query MySQL
acceptance, multihop-coordinator/runtime, relay-planner and target-policy tests.
These are actual source imports found by navigation; no script/test body was run
or accepted and this is not a complete per-symbol cross-repository caller audit.

Removal requires migration of each actual import and every required construction,
type/default/value/object identity/reflection/serializer compatibility promise,
plus matching-source acceptance. A type consumer moving to public.ts does not
make its old forwarder safe to delete. Do not replace preserved function aliases
with wrappers/copies, merge equal frozen policy objects or erase old exports on
the basis of a narrower production-only search.

Readiness200-202 maps these59 leaf roles, six binding/default families, the five
type-consumer changes and remaining old callers/removal conditions. All planned
and unexecuted. No tests, type/syntax/static/boundary checks, formatter, generator,
build, CI, network/MySQL/browser experiment, commit/push or delegation occurred.
Complete nested owner/application/Runtime/Agent/Web/private/type/default/fixture/
asset source closure, saved revision and all acceptance gates remain open.
