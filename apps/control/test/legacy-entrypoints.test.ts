import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import type * as AccessContract from '../src/application/access-command-contract.ts';
import type * as AccessCommands from '../src/application/access-commands.ts';
import type * as Audit from '../src/application/audit-api.ts';
import type * as ConsoleQueries from '../src/application/console-queries.ts';
import type * as ConsoleRules from '../src/application/console-query.ts';
import type * as Control from '../src/application/control-queries.ts';
import type * as ForwardCommands from '../src/application/forward-commands.ts';
import type * as ForwardProbes from '../src/application/forward-probes.ts';
import type * as NodeContract from '../src/application/node-command-contract.ts';
import type * as NodeCommands from '../src/application/node-management.ts';
import type * as Observation from '../src/application/observation-service-api.ts';
import type * as Instances from '../src/application/probe-instances.ts';
import type * as Machine from '../src/application/probe-machine-api.ts';
import type * as Plans from '../src/application/probe-plans.ts';
import type * as Rollups from '../src/application/telemetry-rollups.ts';
import type * as GrantContract from '../src/application/transport-grant-contract.ts';
import type * as Grants from '../src/application/transport-grants.ts';
import type * as TransportQueries from '../src/application/transport-queries.ts';
import type * as TunnelQueries from '../src/application/tunnel-queries.ts';
import type * as IdentityOwner from '../src/modules/identity-owner/public.ts';
import type * as AuditOwner from '../src/modules/audit-owner/public.ts';
import type * as ConsoleOwner from '../src/modules/console-query-owner/public.ts';
import type * as ControlOwner from '../src/modules/control-query-owner/public.ts';
import type * as ForwardOwner from '../src/modules/forward-owner/public.ts';
import type * as NodeOwner from '../src/modules/node-owner/public.ts';
import type * as ObservationOwner from '../src/modules/observation-service-owner/public.ts';
import type * as ProbeOwner from '../src/modules/probe-owner/public.ts';
import type * as PlanOwner from '../src/modules/probe-plan-owner/public.ts';
import type * as TelemetryOwner from '../src/modules/telemetry-owner/public.ts';
import type * as TransportOwner from '../src/modules/transport-owner/public.ts';
import type * as TunnelOwner from '../src/modules/tunnel-query-owner/public.ts';
import type { Accepted } from '../src/modules/idempotency.ts';
import type { ProfileForwardReferences, RelayForwardReferences } from '../src/modules/forwarding-ports.ts';
import type { MemberChangeInput } from '../src/modules/identity-ports.ts';
import type { ForwardNodeAuthorization, RelayNodeAuthority } from '../src/modules/node-execution-ports.ts';
import type { Policy as CommonPolicy } from '@tunex/contracts/policy';
import type { Policy as LegacyPolicy } from '@tunex/contracts/shared';
import type { AccessChangeEffects } from '../src/modules/runtime/access-ports.ts';
import type { ForwardAuthorizationExecution, AccessExecution, NodeManagementExecution } from '../src/modules/runtime/authorization-ports.ts';
import type { ForwardExecutionAdapter } from '../src/modules/runtime/execution-adapter-ports.ts';
import type { ForwardCommandPreparation } from '../src/modules/runtime/forward-command-ports.ts';
import type { NodeManagementEffects } from '../src/modules/runtime/node-change-ports.ts';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Same<T extends true> = T;
type Tx = { readonly source: 'legacy-compatibility-transaction' };
// Compile-only acceptance of nineteen application type-source changes and the
// public generic port aliases. Exporting a type keeps this out of runtime tests.
export type LegacyDeclarationCompatibility = [
  Same<Equal<AccessContract.AccessCommandApi, IdentityOwner.AccessCommandApi>>,
  Same<Equal<AccessCommands.MemberChangeResponse, IdentityOwner.MemberChangeResponse>>,
  Same<Equal<Audit.AuditHistory, AuditOwner.AuditHistory>>,
  Same<Equal<ConsoleQueries.ConsolePage<unknown>, ConsoleOwner.ConsolePage<unknown>>>,
  Same<Equal<ConsoleRules.ConsoleFilters, ConsoleOwner.ConsoleFilters>>,
  Same<Equal<Control.ExecutionCapabilities, ControlOwner.ExecutionCapabilities>>,
  Same<Equal<ForwardCommands.ForwardAccepted, ForwardOwner.ForwardAccepted>>,
  Same<Equal<ForwardProbes.AnyProbeAcceptance, ProbeOwner.AnyProbeAcceptance>>,
  Same<Equal<NodeContract.NodeManagementApi, NodeOwner.NodeManagementApi>>,
  Same<Equal<NodeCommands.NodeChangeResponse, NodeOwner.NodeChangeResponse>>,
  Same<Equal<Observation.ObservationServiceEnvelope, ObservationOwner.ObservationServiceEnvelope>>,
  Same<Equal<Instances.ProbeInstanceInspection, ProbeOwner.ProbeInstanceInspection>>,
  Same<Equal<Machine.ProbeServicesApi, ProbeOwner.ProbeServicesApi>>,
  Same<Equal<Plans.ProbePlanReceipt, PlanOwner.ProbePlanReceipt>>,
  Same<Equal<Rollups.TelemetryRollupQuery, TelemetryOwner.TelemetryRollupQuery>>,
  Same<Equal<GrantContract.TransportGrantApi, TransportOwner.TransportGrantApi>>,
  Same<Equal<Grants.TransportGrantResponse, TransportOwner.TransportGrantResponse>>,
  Same<Equal<TransportQueries.TransportReferenceReader<Tx>, TransportOwner.TransportReferenceReader<Tx>>>,
  Same<Equal<TunnelQueries.TunnelReadPort<Tx>, TunnelOwner.TunnelReadPort<Tx>>>,
  Same<Equal<Accepted, ForwardOwner.ForwardAccepted>>,
  Same<Equal<ProfileForwardReferences<Tx>, ForwardOwner.ProfileForwardReferences<Tx>>>,
  Same<Equal<RelayForwardReferences<Tx>, ForwardOwner.RelayForwardReferences<Tx>>>,
  Same<Equal<MemberChangeInput, IdentityOwner.MemberChangeInput>>,
  Same<Equal<ForwardNodeAuthorization<Tx>, NodeOwner.ForwardNodeAuthorization<Tx>>>,
  Same<Equal<RelayNodeAuthority<Tx>, NodeOwner.RelayNodeAuthority<Tx>>>,
  Same<Equal<AccessChangeEffects<Tx>, IdentityOwner.AccessChangeEffects<Tx>>>,
  Same<Equal<ForwardAuthorizationExecution<Tx>, ForwardOwner.ForwardAuthorizationExecution<Tx>>>,
  Same<Equal<AccessExecution<Tx>, IdentityOwner.AccessExecution<Tx>>>,
  Same<Equal<NodeManagementExecution<Tx>, NodeOwner.NodeManagementExecution<Tx>>>,
  Same<Equal<ForwardExecutionAdapter<Tx>, ForwardOwner.ForwardExecutionAdapter<Tx>>>,
  Same<Equal<ForwardCommandPreparation<Tx>, ForwardOwner.ForwardCommandPreparation<Tx>>>,
  Same<Equal<NodeManagementEffects<Tx>, NodeOwner.NodeManagementEffects<Tx>>>,
  Same<Equal<CommonPolicy, LegacyPolicy>>,
];

// This function is typechecked but deliberately never called. Literal response
// statuses and readonly optional member inputs remain actual consumer promises.
export function compileOnlyLegacyConsumer(member: MemberChangeInput, response: Accepted): ForwardOwner.ForwardAccepted {
  const role: 'manager' | 'viewer' | 'removed' = member.role;
  const status: 200 | 202 = response.status;
  void role; void status;
  // @ts-expect-error MemberChangeInput has a readonly revision contract.
  member.expectedRevision = 2;
  return response;
}

// Expectations come from the three published leaf maps, not from parsing the
// implementation's re-export statements. '-' is a deliberately erased entry;
// '*' promises the complete runtime export set of the exact canonical leaf.
const moduleLeaves = `
audit-ports audit-owner/contracts AUDIT_SOURCES,AUDIT_KINDS,AUDIT_ERROR_CODES
forward-diagnostic-ports forward-diagnostic-owner/contracts -
forward-query-ports forward-owner/public -
forward-telemetry-ports telemetry-owner/forward-contracts -
forwarding-ports forward-owner/public -
host-telemetry-ports telemetry-owner/host-contracts -
identity-credentials ../infrastructure/identity-secrets tokenHash,validBearerToken
identity-ports identity-owner/public -
ingress-contract ingress-owner/public INGRESS_LIMITS,parseIngressGroup,parseIngressSelection,parseIngressInput,parseIngressPlan
ingress-migration-contract ingress-owner/public INGRESS_MIGRATION_LIMITS,parseIngressOriginRef,parseIngressLineage,parseIngressMigrationInput,parseIngressMigrationPlan
ingress-migration-ports ingress-owner/migration-contracts -
ingress-ports ingress-owner/contracts -
native-path-references path-owner/references NativePathReferences
node-execution-ports node-owner/execution-contracts -
node-grant-ports node-owner/grant-contracts -
node-management-ports node-owner/management-contracts -
node-policy node-owner/public validatePolicy,snapshotNodeCommand
node-report-observation node-observation-owner/rules observeNodeReport
notification-delivery-ports notification-owner/delivery-contracts -
notification-ports notification-owner/endpoint-contracts -
observation-policy forward-diagnostic-owner/policy FORWARD_DIAGNOSTIC_LIMITS
observation-policy audit-owner/policy AUDIT_LIMITS,AUDIT_COVERAGE
observation-policy station-alert-owner/policy STATION_ALERT_LIMITS
observation-policy notification-owner/policy NOTIFICATION_ENDPOINT_LIMITS,NOTIFICATION_DELIVERY_LIMITS
observation-policy probe-history-owner/policy PROBE_RUN_LIMITS
observation-policy probe-plan-owner/policy PROBE_PLAN_LIMITS
observation-ports node-observation-owner/contracts -
observation-service-ports observation-service-owner/contracts OBSERVATION_SERVICE_LIMITS,OBSERVATION_SERVICE_ALPN
path-binding-contract path-owner/public parsePathSelection,expandPath
path-binding-ports path-owner/binding-contracts -
path-group-contract path-owner/public PATH_GROUP_LIMITS,parsePathGroupConfig,parsePathGroupSelection
path-group-ports path-owner/group-contracts -
path-operation-limits path-owner/limits PATH_GROUP_LIMITS,PATH_PUBLICATION_LIMITS
path-operation-limits ingress-owner/limits INGRESS_LIMITS,INGRESS_MIGRATION_LIMITS
path-publication-contract path-owner/public PATH_PUBLICATION_LIMITS,PATH_PUBLICATION_REJECTIONS,publicationHash,parsePathPublicationInput,parsePublicationState,parsePathPublicationPlan,checkedPublicationPlan
path-publication-ports path-owner/publication-contracts -
path-template-contract path-owner/public parsePathTemplate,pathRequirements
path-template-ports path-owner/template-contracts -
probe-instance-ports probe-owner/instance-contracts -
probe-measurement-ports probe-owner/measurement-contracts PROBE_EGRESS_MEASUREMENT,PROBE_INGRESS_MEASUREMENT,PROBE_SERVICE_MEASUREMENT,PROBE_TCP_ECHO_MEASUREMENT,PROBE_UDP_ECHO_MEASUREMENT,PROBE_TYPED_MEASUREMENTS,PROBE_SERVICE_MEASUREMENTS,PROBE_ECHO_MEASUREMENTS
probe-measurements probe-owner/public PROBE_EGRESS_MEASUREMENT,PROBE_INGRESS_MEASUREMENT,PROBE_SERVICE_MEASUREMENT,PROBE_TCP_ECHO_MEASUREMENT,PROBE_UDP_ECHO_MEASUREMENT,PROBE_TYPED_MEASUREMENTS,PROBE_SERVICE_MEASUREMENTS,PROBE_ECHO_MEASUREMENTS,isEchoMeasurement,probeMeasurement,probeEchoMeasurement
probe-negotiation-ports probe-owner/machine-contracts -
probe-owner-ports probe-owner/owner-contracts PROBE_OWNER_INTERFACE_VERSION
probe-permit-ports probe-owner/permit-contracts -
probe-permit-state probe-owner/public validProbeBinding,sameProbeBinding,validProbePermit
probe-plan-ports probe-plan-owner/contracts -
probe-ports probe-owner/plan-contracts -
probe-result-ports probe-owner/result-contracts -
probe-run-ports probe-history-owner/contracts -
probe-service-ports probe-owner/service-contracts -
probe-telemetry-ports telemetry-owner/probe-contracts -
relay-endpoint-contract ../compatibility/public parseRelayEndpoint
station-alert-ports station-alert-owner/contracts -
target-policy ../compatibility/public targetAllowed
telemetry-policy telemetry-owner/policy NODE_TELEMETRY_LIMITS,FORWARD_TELEMETRY_LIMITS,HOST_TELEMETRY_LIMITS,PROBE_TELEMETRY_LIMITS,TELEMETRY_ROLLUP_LIMITS
telemetry-ports telemetry-owner/node-contracts -
telemetry-rollup-ports telemetry-owner/rollup-contracts -
telemetry-rollup-values telemetry-owner/rollup-values *
transport-ports transport-owner/public -
`;
const runtimeLeaves = `
access-changes identity-owner/access-reconciler AccessChangeReconciler
access-ports identity-owner/public -
authorization-ports forward-owner/public -
execution-adapter-ports forward-owner/execution-contracts EXECUTION_HOST_VERSION
execution-adapters forward-owner/execution-registry ForwardExecutionRegistry,nativeDriverFor
forward-command-ports forward-owner/public -
forward-commands forward-owner/execution ForwardCommandExecutor
forward-telemetry-ports telemetry-owner/public -
multihop-plan ../compatibility/public compileMultihopResources,compileMultihopPlan
native-forward-adapters forward-owner/native-adapters nativeForwardAdapters
node-change-ports node-owner/public -
node-changes node-owner/change-reconciler NodeChangeReconciler
operation-contract ../framework/public -
path-topology ../compatibility/public MAX_PLANNED_PATH_NODES,compilePathTopology,requireTwoNodeRelayTopology
planner ../compatibility/public compileDirect,compileSnapshot
probe-telemetry-ports telemetry-owner/public -
profile-grants transport-owner/grant-reconciler ProfileGrantReconciler
query-ports ../framework/public -
relay-assignment-source forward-owner/relay-assignment-source RelayAssignmentSource
relay-plan ../compatibility/public compileRelayPlan,relayPeerPinsChanged
relay-planner ../compatibility/public compileRelayResources
snapshot-assignment-ports ../compatibility/public -
snapshot-assignments forward-owner/snapshot-assignments SnapshotAssignmentRegistry
transit-api-contract transit-owner/public TRANSIT_API_INTERFACE_VERSION
transit-preparation transit-owner/public compileTransitResources,compileTransitPreparation
`;
const applicationLeaves = `
access-command-contract identity-owner/command-api ACCESS_COMMAND_INTERFACE_VERSION
access-commands identity-owner/commands AccessCommands
audit-api audit-owner/api AUDIT_API_INTERFACE_VERSION
audit-events audit-owner/service AuditEvents,AUDIT_LIMITS,AUDIT_COVERAGE
audit-read-models audit-owner/read-models AuditReadModels,auditStoragePolicy
background-tasks ../compatibility/public BackgroundTasks=NativeBackgroundTasks
console-queries console-query-owner/service ConsoleQueries
console-query-contract console-query-owner/contracts *
console-query console-query-owner/rules consoleFilterNames,validateConsoleFilters,consolePage
control-queries control-query-owner/service ControlQueries
control-query-contract control-query-owner/contracts *
errors ../framework/public ControlError,invalid,notFound
forward-command-contract forward-owner/command-api *
forward-commands forward-owner/commands ForwardCommands
forward-diagnostic-api forward-diagnostic-owner/api *
forward-diagnostics forward-diagnostic-owner/service ForwardDiagnostics,FORWARD_DIAGNOSTIC_LIMITS
forward-probe-api probe-owner/command-api *
forward-probe-plans probe-owner/forward-plans ForwardProbePlans
forward-probes probe-owner/forward-commands ForwardProbes
forward-telemetry telemetry-owner/forward ForwardTelemetry,FORWARD_TELEMETRY_LIMITS
host-telemetry telemetry-owner/host HostTelemetry,HOST_TELEMETRY_LIMITS
ingress-deployment-api ingress-owner/deployment-api *
ingress-deployments ingress-owner/deployments IngressDeployments
ingress-group-api ingress-owner/group-api *
ingress-groups ingress-owner/groups IngressGroups
ingress-migration-api ingress-owner/migration-api *
ingress-migrations ingress-owner/migrations IngressMigrations
native-driver-contract native-driver-owner/contracts *
native-drivers native-driver-owner/service NativeDrivers
native-tunnel-api native-tunnel-owner/contracts *
native-tunnels native-tunnel-owner/service NativeTunnels,NATIVE_TUNNEL_MANAGEMENT
node-command-contract node-owner/command-api NODE_MANAGEMENT_INTERFACE_VERSION
node-management node-owner/commands NodeManagementCommands
node-observation-contract node-observation-owner/api *
node-observations node-observation-owner/service NodeObservations,NODE_OBSERVATION_LIMITS
node-telemetry telemetry-owner/node NodeTelemetry,NODE_TELEMETRY_LIMITS
notification-api notification-owner/api *
notification-deliveries notification-owner/deliveries NotificationDeliveries
notification-delivery-values notification-owner/delivery-values *
notification-destination ../compatibility/public parseNotificationDestinationUrl
notification-endpoint-storage-values notification-owner/endpoint-storage-values notificationEndpointStorageValues
notification-endpoint-values notification-owner/endpoint-values *
notification-endpoints notification-owner/endpoints NotificationEndpoints
notification-outbox-storage-values notification-owner/outbox-storage-values notificationOutboxStorageValues
observation-service-api observation-service-owner/api OBSERVATION_SERVICE_API_INTERFACE_VERSION
observation-service-storage-values observation-service-owner/storage-values observationServiceStorageValues
observation-service-values observation-service-owner/public observationObject,observationServerName,observationAddress,observationServiceId,observationTime,observationHash,observationServiceIdentity,observationTrust,parseObservationServiceConfig,parseObservationServiceHead,parseObservationServiceRevision,parseObservationServiceAudit,parseObservationServiceReceipt
observation-services observation-service-owner/service ObservationServices
path-binding-api path-owner/binding-api *
path-bindings path-owner/bindings PathBindings
path-group-api path-owner/group-api *
path-groups path-owner/groups PathGroups
path-publication-api path-owner/publication-api *
path-publications path-owner/publications PathPublications
path-template-api path-owner/template-api *
path-templates path-owner/templates PathTemplateQueries,PathTemplateCommands
path-templates path-owner/template-state PATH_TEMPLATE_LIMITS,validateTemplateHead,validateTemplateRevision
ports ../framework/public -
probe-claims probe-owner/claims ProbeClaims
probe-delivery probe-owner/delivery ProbeDelivery
probe-history-api probe-history-owner/api *
probe-instance-registry probe-owner/instance-registry ProbeInstanceRegistry
probe-instance-storage-values probe-owner/public probeInstanceStorageValues
probe-instances probe-owner/instances ProbeInstances
probe-machine-api probe-owner/machine-api PROBE_MACHINE_API_INTERFACE_VERSION
probe-machine-authorization probe-owner/public requireProbeMachine
probe-negotiation probe-owner/negotiation ProbeNegotiator
probe-observation-services probe-owner/observation-services ProbeObservationServices
probe-observation-services observation-service-owner/reference parseProbeServiceReference
probe-permit-storage-values probe-owner/public probePermitStorageValues
probe-permits probe-owner/permits ProbePermits
probe-plan-storage-values probe-plan-owner/storage-values probePlanStorageValues
probe-plan-values probe-plan-owner/values *
probe-plans probe-plan-owner/service ProbePlans
probe-qualification-storage-values probe-owner/public probeQualificationStorageValues
probe-results probe-owner/results ProbeResults
probe-run-storage-values probe-history-owner/storage-values probeRunStorageValues
probe-run-values probe-history-owner/values *
probe-runs probe-history-owner/service ProbeRunHistoryRecorder,ProbeRuns
probe-services probe-owner/services ProbeServices
probe-telemetry telemetry-owner/probe ProbeTelemetry,PROBE_TELEMETRY_LIMITS
probe-type-qualifications probe-owner/qualifications ProbeServiceRegistry,ProbeTypeRegistry
probe-type-qualifications probe-owner/qualification-policy requireProbeTypeQualification
probe-types probe-owner/types ProbeTypes
relay-query-contract relay-plan-owner/contracts *
request-lifecycle ../framework/public RequestLifecycle
station-alert-api station-alert-owner/api *
station-alert-storage-values station-alert-owner/storage-values stationAlertStorageValues,stationAlertFactValues
station-alert-values station-alert-owner/values *
station-alerts station-alert-owner/service StationAlerts
telemetry-api telemetry-owner/api *
telemetry-rollup-storage-values telemetry-owner/rollup-storage-values telemetryRollupStorageValues
telemetry-rollups telemetry-owner/rollups TelemetryRollups
transport-grant-contract transport-owner/grant-api TRANSPORT_GRANT_INTERFACE_VERSION
transport-grants transport-owner/grant-commands TransportGrantCommands
transport-queries transport-owner/queries TransportQueries
transport-query-contract transport-owner/query-contracts *
tunnel-queries tunnel-query-owner/service TunnelQueries
tunnel-query-contract tunnel-query-owner/contracts *
`;

type Namespace = Record<string, unknown>;
const modulesRoot = new URL('../src/modules/', import.meta.url);
const load = async (url: URL): Promise<Namespace> => import(url.href);
const parsed = (table: string) => table.trim().split('\n').map(line => line.trim().split(/\s+/) as [string, string, string]);
for (const [family, table, count] of [
  ['modules', moduleLeaves, 53],
  ['runtime', runtimeLeaves, 25],
  ['application', applicationLeaves, 96],
] as const) {
  test(`${family} pure legacy entries load their exact mapped canonical values and preserve erased runtime surfaces`, async () => {
    const expectations = new Map<string, Namespace>();
    for (const [leaf, destination, symbols] of parsed(table)) {
      const expected = expectations.get(leaf) ?? {};
      const canonical = await load(new URL(destination + '.ts', modulesRoot));
      if (symbols === '*') Object.assign(expected, canonical);
      else if (symbols !== '-') for (const binding of symbols.split(',')) {
        const [oldName, name = oldName] = binding.split('=') as [string, string?];
        assert.ok(Object.hasOwn(canonical, name), destination + ':' + name);
        expected[oldName] = canonical[name];
      }
      expectations.set(leaf, expected);
    }
    assert.equal(expectations.size, count);
    const inventory = JSON.parse(await readFile(new URL('../../../scripts/config/entrypoint-inventory-v1.json', import.meta.url), 'utf8'));
    for (const leaf of expectations.keys()) assert.ok(inventory.legacy[family].includes(leaf + '.ts'), leaf);
    for (const [leaf, expected] of expectations) {
      const relative = family === 'modules' ? leaf : family === 'runtime' ? 'runtime/' + leaf : '../application/' + leaf;
      const actual = await load(new URL(relative + '.ts', modulesRoot));
      assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), family + ':' + leaf);
      for (const [name, value] of Object.entries(expected)) assert.equal(actual[name], value, family + ':' + leaf + ':' + name);
    }
  });
}

test('legacy aggregate retains its own version and three exact reader constructors while frozen policies stay distinct', async () => {
  const aggregate = await load(new URL('../application/management-read-models.ts', modulesRoot));
  assert.deepEqual(Object.keys(aggregate).sort(), ['ConsoleReadModels','MANAGEMENT_READ_MODEL_INTERFACE_VERSION','TransportReferenceReadModels','TunnelReadModels'].sort());
  assert.equal(aggregate.MANAGEMENT_READ_MODEL_INTERFACE_VERSION, 1);
  for (const [name, destination] of [
    ['ConsoleReadModels','console-query-owner/read-models'], ['TransportReferenceReadModels','transport-owner/query-read-models'],
    ['TunnelReadModels','tunnel-query-owner/read-models'],
  ]) assert.equal(aggregate[name!], (await load(new URL(destination + '.ts', modulesRoot)))[name!]);
  const policies = await load(new URL('telemetry-policy.ts', modulesRoot));
  assert.equal(new Set(Object.values(policies)).size, 5);
  for (const value of Object.values(policies)) assert.ok(Object.isFrozen(value));
});
