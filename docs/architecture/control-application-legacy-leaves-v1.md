# Control Application Legacy Leaves v1

Date: 2026-10-19 (Asia/Shanghai). Manual reading of all99 current files in
apps/control/src/application, including the full ControlApplication body.
This source map distinguishes the existing composition, callable wrapper,
versioned aggregate and96 forwarding leaves. It records intended source
compatibility and consumers, not a successful import/type/boundary check or
behavioral acceptance. The integrated working tree remains the candidate;
HEAD alone does not identify its additions, edits and deletions.

## Three Entries With Local Declarations

| Entry | Actual responsibility and compatibility |
| --- | --- |
| control.ts | Existing ControlApplication composition plus its original command delegates and execution callbacks. See the exact construction/policy sequence below. This is an existing named mixed composition, not a new L1 service or an exemption for another business module. |
| command-request.ts | Original requestIdentity named function/signature delegates to nativeCommandRequest through public L2; RequestIdentity is the L1 public type. Keep the function wrapper rather than substituting a direct alias with a different function identity/name. |
| management-read-models.ts | MANAGEMENT_READ_MODEL_INTERFACE_VERSION remains its own constant1, with exact ConsoleReadModels/TransportReferenceReadModels/TunnelReadModels aliases from their original owner leaves. The three-owner aggregate loading graph remains intentional compatibility. |

ControlApplication's field initializers create the existing Forwarding and
Idempotency stores before its constructor body. Its constructor retains these
ordered groups and every existing argument/default:

1. Save db/Identity/Nodes, bind Console raw reads/projection, Transit negotiation
   and preview, Native catalog and Tunnel reads. Build observationPolicy from
   the supplied policy or the original shared DEFAULT_POLICY object; keep Node
   observations' freshness/skew scaling and separate native reader binding.
2. Bind ObservationService lookup, Forward Probe plans, negotiation and instances,
   instance registry, one qualification store used by both type registries, the
   permit-specific intent reader/forced read mode, permit/history/clock providers,
   and the original claim/delivery/result/type/service views and issuance flags.
3. Create one assignment registry with the deferred Relay callback before the
   Relay field is initialized. Create the original ledger with the supplied
   resource provider, then Transport, reference query, endpoint, Path stores,
   references/templates/bindings/groups, the same Relay and Relay preview owner.
   Do not invoke the deferred collection during construction or create a ledger
   just to obtain a resource helper.
4. Create the original execution callback object, Forward commands/executor and
   Path restoration callbacks. Retain same-Tx current Path then group reads,
   original detach and restoration authorization refusal; keep the exact
   async Relay acceptPlan adapter returning void at its existing position.
5. Bind public Path publication and Ingress group/deployment/migration services
   to their raw stores and existing synchronous value providers. The origin
   resolver keeps its deployment-versus-migration selection and deferred self
   call. NativeTunnel delegates to the same Path and Forward commands.
6. Bind Profile grants, Access and Node management reconcilers using that execution
   callback object, then public Control details with the original runtime status
   store/codec/policy, same ledger/Relay and actual feature flag values.

The four private execution methods retain their original L3 collaboration
decisions: path chooses Relay authorization and plan transition; Direct chooses
Node authorization and same-Forward ledger transition; locking always delegates
to Relay lockNodes; capacity enumerates Relay nodeIDs and sequentially resolves
each Node cleanup fact before ledger capacity. These callbacks consume public
owner operations within the original transaction; they neither write another
owner's table nor create another authority. Source classification does not
certify their ordering or behavior. Existing concrete Nodes/RuntimeLedger/Relay
constructor/property types remain compatibility promises of this original root.

The public methods planRelay/create/update/remove/retry/changeNode/changeMember/
changeNodeGrant retain their original delegates, argument order and response
types. No new root, queue, retry, transaction or product feature is introduced.

## Complete Forwarding Leaf Map

Paths below are relative to application. Destinations are relative to modules
unless explicitly marked framework or compatibility. A row specifies every
current filename; grouped names are not a whole-directory exemption. Value
forwarding remains on the original exact leaf, including native-bearing entries.
Type-star aliases retain their original narrow leaf export set instead of being
widened to all types from an owner public barrel.

| Leaf | Current source role and exact destination |
| --- | --- |
| access-command-contract.ts | ACCESS_COMMAND_INTERFACE_VERSION value at identity-owner/command-api; three named response/API types from Identity public |
| access-commands.ts | AccessCommands at identity-owner/commands; two named response types from Identity public |
| audit-api.ts | AUDIT_API_INTERFACE_VERSION at audit-owner/api; AuditHistory/AuditEventsApi types from Audit public |
| audit-events.ts | AuditEvents/AUDIT_LIMITS/AUDIT_COVERAGE at audit-owner/service |
| audit-read-models.ts | AuditReadModels/auditStoragePolicy at audit-owner/read-models |
| background-tasks.ts | compatibility/public NativeBackgroundTasks as BackgroundTasks; framework/public BackgroundTask type, not a new task owner |
| console-queries.ts | ConsoleQueries at console-query-owner/service; eight named page/node/Forward/Operation/candidate/overview/diagnostic/read types from Console public |
| console-query-contract.ts | CONSOLE_QUERY_INTERFACE_VERSION and narrow type star at console-query-owner/contracts |
| console-query.ts | consoleFilterNames/validateConsoleFilters/consolePage at console-query-owner/rules; ConsoleListKind/ConsoleFilters/ConsolePaging types from Console public |
| control-queries.ts | ControlQueries at control-query-owner/service; ExecutionCapabilities type from Control query public |
| control-query-contract.ts | CONTROL_DETAIL_INTERFACE_VERSION and narrow type star at control-query-owner/contracts |
| errors.ts | ControlError/invalid/notFound from framework/public |
| forward-command-contract.ts | FORWARD_COMMAND_INTERFACE_VERSION and narrow type star at forward-owner/command-api |
| forward-commands.ts | ForwardCommands at forward-owner/commands; ForwardAccepted type from Forward public |
| forward-diagnostic-api.ts | FORWARD_DIAGNOSTIC_API_INTERFACE_VERSION and narrow type star at forward-diagnostic-owner/api |
| forward-diagnostics.ts | ForwardDiagnostics/FORWARD_DIAGNOSTIC_LIMITS at forward-diagnostic-owner/service |
| forward-probe-api.ts | FORWARD_PROBE_API_INTERFACE_VERSION and narrow type star at probe-owner/command-api |
| forward-probe-plans.ts | ForwardProbePlans at probe-owner/forward-plans |
| forward-probes.ts | ForwardProbes at probe-owner/forward-commands; four named acceptance types from Probe public |
| forward-telemetry.ts | ForwardTelemetry/FORWARD_TELEMETRY_LIMITS at telemetry-owner/forward |
| host-telemetry.ts | HostTelemetry/HOST_TELEMETRY_LIMITS at telemetry-owner/host |
| ingress-deployment-api.ts | INGRESS_DEPLOYMENT_API_INTERFACE_VERSION and narrow type star at ingress-owner/deployment-api |
| ingress-deployments.ts | IngressDeployments at ingress-owner/deployments |
| ingress-group-api.ts | INGRESS_GROUP_API_INTERFACE_VERSION and narrow type star at ingress-owner/group-api |
| ingress-groups.ts | IngressGroups at ingress-owner/groups |
| ingress-migration-api.ts | INGRESS_MIGRATION_API_INTERFACE_VERSION and narrow type star at ingress-owner/migration-api |
| ingress-migrations.ts | IngressMigrations at ingress-owner/migrations |
| native-driver-contract.ts | NATIVE_DRIVER_QUERY_INTERFACE_VERSION and narrow type star at native-driver-owner/contracts |
| native-drivers.ts | NativeDrivers at native-driver-owner/service |
| native-tunnel-api.ts | NATIVE_TUNNEL_API_INTERFACE_VERSION and narrow type star at native-tunnel-owner/contracts |
| native-tunnels.ts | NativeTunnels/NATIVE_TUNNEL_MANAGEMENT at native-tunnel-owner/service |
| node-command-contract.ts | NODE_MANAGEMENT_INTERFACE_VERSION at node-owner/command-api; NodeChangeResponse/NodeManagementApi types from Node public |
| node-management.ts | NodeManagementCommands at node-owner/commands; NodeChangeResponse type from Node public |
| node-observation-contract.ts | NODE_OBSERVATION_API_INTERFACE_VERSION and narrow type star at node-observation-owner/api |
| node-observations.ts | NodeObservations/NODE_OBSERVATION_LIMITS at node-observation-owner/service |
| node-telemetry.ts | NodeTelemetry/NODE_TELEMETRY_LIMITS at telemetry-owner/node |
| notification-api.ts | NOTIFICATION_API_INTERFACE_VERSION and narrow type star at notification-owner/api |
| notification-deliveries.ts | NotificationDeliveries at notification-owner/deliveries |
| notification-delivery-values.ts | Exact original value/type star at notification-owner/delivery-values, not the whole owner barrel |
| notification-destination.ts | parseNotificationDestinationUrl from compatibility/public; native URL parser remains L2 |
| notification-endpoint-storage-values.ts | notificationEndpointStorageValues at notification-owner/endpoint-storage-values |
| notification-endpoint-values.ts | Exact original value/type star at notification-owner/endpoint-values |
| notification-endpoints.ts | NotificationEndpoints at notification-owner/endpoints |
| notification-outbox-storage-values.ts | notificationOutboxStorageValues at notification-owner/outbox-storage-values |
| observation-service-api.ts | OBSERVATION_SERVICE_API_INTERFACE_VERSION at observation-service-owner/api; five named trust/envelope/list/detail/API types from ObservationService public |
| observation-service-storage-values.ts | observationServiceStorageValues at observation-service-owner/storage-values |
| observation-service-values.ts | Thirteen exact named value/parse aliases from observation-service-owner/public |
| observation-services.ts | ObservationServices at observation-service-owner/service |
| path-binding-api.ts | PATH_BINDING_API_INTERFACE_VERSION and narrow type star at path-owner/binding-api |
| path-bindings.ts | PathBindings at path-owner/bindings |
| path-group-api.ts | PATH_GROUP_API_INTERFACE_VERSION and narrow type star at path-owner/group-api |
| path-groups.ts | PathGroups at path-owner/groups |
| path-publication-api.ts | PATH_PUBLICATION_API_INTERFACE_VERSION and narrow type star at path-owner/publication-api |
| path-publications.ts | PathPublications at path-owner/publications |
| path-template-api.ts | PATH_TEMPLATE_API_INTERFACE_VERSION and narrow type star at path-owner/template-api |
| path-templates.ts | PathTemplateQueries/PathTemplateCommands at path-owner/templates and original PATH_TEMPLATE_LIMITS/validateTemplateHead/validateTemplateRevision at template-state |
| ports.ts | Six exact transaction/authorization/identity/response/idempotency types from framework/public |
| probe-claims.ts | ProbeClaims at probe-owner/claims |
| probe-delivery.ts | ProbeDelivery at probe-owner/delivery |
| probe-history-api.ts | PROBE_HISTORY_API_INTERFACE_VERSION at probe-history-owner/api plus its narrow type star and original separate type star at probe-plan-owner/api |
| probe-instance-registry.ts | ProbeInstanceRegistry at probe-owner/instance-registry |
| probe-instance-storage-values.ts | probeInstanceStorageValues from probe-owner/public |
| probe-instances.ts | ProbeInstances at probe-owner/instances; ProbeInstanceCommand/Registration/Inspection types from Probe public |
| probe-machine-api.ts | PROBE_MACHINE_API_INTERFACE_VERSION at probe-owner/machine-api; nine named machine API types from Probe public |
| probe-machine-authorization.ts | requireProbeMachine from probe-owner/public |
| probe-negotiation.ts | ProbeNegotiator at probe-owner/negotiation |
| probe-observation-services.ts | ProbeObservationServices at probe-owner/observation-services plus original parseProbeServiceReference at observation-service-owner/reference |
| probe-permit-storage-values.ts | probePermitStorageValues from probe-owner/public |
| probe-permits.ts | ProbePermits at probe-owner/permits |
| probe-plan-storage-values.ts | probePlanStorageValues at probe-plan-owner/storage-values |
| probe-plan-values.ts | Exact original value/type star at probe-plan-owner/values |
| probe-plans.ts | ProbePlans at probe-plan-owner/service; ProbePlanReceipt type from plan public |
| probe-qualification-storage-values.ts | probeQualificationStorageValues from probe-owner/public |
| probe-results.ts | ProbeResults at probe-owner/results |
| probe-run-storage-values.ts | probeRunStorageValues at probe-history-owner/storage-values |
| probe-run-values.ts | Exact original value/type star at probe-history-owner/values |
| probe-runs.ts | ProbeRunHistoryRecorder/ProbeRuns at probe-history-owner/service |
| probe-services.ts | ProbeServices at probe-owner/services |
| probe-telemetry.ts | ProbeTelemetry/PROBE_TELEMETRY_LIMITS at telemetry-owner/probe |
| probe-type-qualifications.ts | ProbeServiceRegistry/ProbeTypeRegistry at probe-owner/qualifications plus original requireProbeTypeQualification at qualification-policy |
| probe-types.ts | ProbeTypes at probe-owner/types |
| relay-query-contract.ts | RELAY_QUERY_INTERFACE_VERSION and narrow type star at relay-plan-owner/contracts |
| request-lifecycle.ts | RequestLifecycle from framework/public |
| station-alert-api.ts | STATION_ALERT_API_INTERFACE_VERSION and narrow type star at station-alert-owner/api |
| station-alert-storage-values.ts | stationAlertStorageValues/stationAlertFactValues at station-alert-owner/storage-values |
| station-alert-values.ts | Exact original value/type star at station-alert-owner/values |
| station-alerts.ts | StationAlerts at station-alert-owner/service |
| telemetry-api.ts | TELEMETRY_API_INTERFACE_VERSION and narrow type star at telemetry-owner/api |
| telemetry-rollup-storage-values.ts | telemetryRollupStorageValues at telemetry-owner/rollup-storage-values |
| telemetry-rollups.ts | TelemetryRollups at telemetry-owner/rollups; TelemetryRollupQuery type from Telemetry public |
| transport-grant-contract.ts | TRANSPORT_GRANT_INTERFACE_VERSION at transport-owner/grant-api; TransportGrantResponse/TransportGrantApi types from Transport public |
| transport-grants.ts | TransportGrantCommands at transport-owner/grant-commands; TransportGrantResponse type from Transport public |
| transport-queries.ts | TransportQueries at transport-owner/queries; ProfileReferenceQuery/ProfileReference/TransportReferenceReader types from Transport public |
| transport-query-contract.ts | TRANSPORT_QUERY_INTERFACE_VERSION and narrow type star at transport-owner/query-contracts |
| tunnel-queries.ts | TunnelQueries at tunnel-query-owner/service; five named Node/peer/reference/paging/read types from Tunnel public |
| tunnel-query-contract.ts | TUNNEL_QUERY_INTERFACE_VERSION and narrow type star at tunnel-query-owner/contracts |

## Type Reference Edits And Preserved Public Contracts

Nineteen named type-export leaves in the table now use their existing canonical
owner public entrypoints: access-command-contract, access-commands, audit-api,
console-queries, console-query, control-queries, forward-commands, forward-probes,
node-command-contract, node-management, observation-service-api, probe-instances,
probe-machine-api, probe-plans, telemetry-rollups, transport-grant-contract,
transport-grants, transport-queries and tunnel-queries. Each keeps its prior exact
export names; the owner entry reexports the same declaration. No wildcard expands.

ControlApplication now consumes Policy directly from contracts/policy and imports
ForwardAccepted as its existing local Accepted name from Forward public. The old
shared -> types -> policy and idempotency -> Forward aliases already denote those
same declarations. DEFAULT_POLICY and Idempotency value imports remain unchanged,
including field initializer order, module loading and object identity promises.

No interface declarations, signatures, method bodies, version constants, value
imports, error text or feature defaults are edited here. No FR/public version
change is needed for references to the same existing declarations. Type erasure,
structural substitution and generic/declaration emission are planned acceptance,
not inferred compilation success.

## Actual Consumers And Compatibility Removal

Current production source reads locate server.ts consuming ControlApplication;
the old mysql-console-read.ts consumes management-read-models and console-query;
mysql-transport-read.ts and mysql-tunnel-read.ts consume management-read-models.
Those three MySQL entries are precise legacy construction/projection bindings,
not lower SQL adapters allowed to import application policy. Their aggregate
loading and default/prototype/override behavior must remain until migration and
acceptance. Current lower raw stores have separate public L1 providers.

Support consumers include existing scripts/phase*/manual/ops entrypoints and
Control tests for the command, query, telemetry, observation, Probe/history/plan,
notification/station/diagnostic and Path/Ingress families. The detailed support
consumer and distribution record is foundation-assets-consumers-closure-v1.md.
Their source presence is not execution evidence. A production-only search cannot
authorize removal of a test/fixture/tool-facing alias.

Every table row inherits these removal conditions: migrate all actual value/type
imports and source-extraction fixtures for that leaf; preserve exported names,
narrow wildcard sets, object/class/function identity, native specialization,
constructor/default/receiver behavior and same-Tx decisions; then obtain matching
frozen-source acceptance. Keep command-request's callable identity and management
aggregate's constant/loading promises separately. No old file is deleted here.

Concentrated acceptance must cover all99 leaf exports/types/loading, Control
field/constructor/deferred callback ordering, optional flag/resource defaults,
restoration/read/capacity failures, original transaction rollback and private
consumer/fixture contracts. This source inventory does not open A5 acceptance,
the foundation/parallel gate, or physical/release gates. No checks/tests/tooling
expansion/format/generator/build/CI/experiments/Git writes ran in this slice.
