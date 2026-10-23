import type { IdentityQueries, AccountCredentialApi } from '../modules/identity-owner/public.ts';
import type { NodeApi } from '../modules/node-owner/public.ts';
import type { TransportApi } from '../modules/transport-owner/public.ts';
import type { RelayEndpointApi } from '../modules/relay-endpoint-owner/public.ts';
import type { RelayPlanApi } from '../modules/relay-plan-owner/public.ts';
import type { TransitNegotiationApi, TransitDeliveryApi } from '../modules/transit-owner/public.ts';
import type { NodeObservationApi } from '../modules/node-observation-owner/public.ts';
import type { NativeRuntimeMachinePort as RuntimeMachinePort } from '../compatibility/public.ts';
import type { ForwardCommandApi, ForwardBindingApi } from '../modules/forward-owner/public.ts';
import type { ControlDetailApi } from '../modules/control-query-owner/public.ts';
import type { ConsoleQueryApi } from '../modules/console-query-owner/public.ts';
import type { AccessCommandApi } from '../modules/identity-owner/public.ts';
import type { NodeManagementApi } from '../modules/node-owner/public.ts';
import type { TransportGrantApi } from '../modules/transport-owner/public.ts';
import type { NativeDriverApi } from '../modules/native-driver-owner/public.ts';
import type { TransportQueryApi } from '../modules/transport-owner/public.ts';
import type { TunnelQueryApi } from '../modules/tunnel-query-owner/public.ts';
import type { PathTemplateCommandApi, PathTemplateQueryApi } from '../modules/path-owner/public.ts';
import type { PathBindingApi } from '../modules/path-owner/public.ts';
import type { NativeTunnelApi } from '../modules/native-tunnel-owner/public.ts';
import type { PathGroupApi, PathPublicationApi } from '../modules/path-owner/public.ts';
import type { IngressGroupApi, IngressDeploymentApi, IngressMigrationApi } from '../modules/ingress-owner/public.ts';
import type { ForwardProbePlanApi, ForwardProbeApi, ForwardProbeCapabilitiesApi } from '../modules/probe-owner/public.ts';
import type { ProbeNegotiationApi, ProbeInstanceApi, ProbeClaimApi, ProbeDeliveryApi, ProbeResultApi,
    ProbeTypeRegistryApi, ProbeServiceRegistryApi, ProbeTypesApi, ProbeServicesApi } from '../modules/probe-owner/public.ts';
import type { NodeTelemetryApi, ForwardTelemetryApi, HostTelemetryApi, ProbeTelemetryApi, TelemetryRollupApi } from '../modules/telemetry-owner/public.ts';
import type { ForwardDiagnosticsApi } from '../modules/forward-diagnostic-owner/public.ts';
import type { AuditEventsApi } from '../modules/audit-owner/public.ts';
import type { StationAlertsApi } from '../modules/station-alert-owner/public.ts';
import type { NotificationEndpointsApi, NotificationDeliveriesApi } from '../modules/notification-owner/public.ts';
import type { ProbeRunsApi } from '../modules/probe-history-owner/public.ts';
import type { ProbePlansApi } from '../modules/probe-plan-owner/public.ts';
import type { ObservationServicesApi } from '../modules/observation-service-owner/public.ts';
import type { RequestLifecycle } from '../framework/public.ts';
import type { SharedResourceLimitApi, ResourceUsageApi } from '../modules/resource-limit-owner/public.ts';
import type { ProbeEchoApi, ProbeEchoRegistryApi } from '../modules/probe-owner/public.ts';

/** Business services are consumed through explicit owner contracts, not implementation class views. */
export interface ControlApi extends ForwardCommandApi,RelayPlanApi {
    readonly changeMember:AccessCommandApi['changeMember'];
    readonly changeNodeGrant:AccessCommandApi['changeNodeGrant'];
    readonly changeNode:NodeManagementApi['change'];
    readonly identity:IdentityQueries;
    readonly accountCredentials:AccountCredentialApi;
    readonly nodes:NodeApi;
    readonly resourceLimits:SharedResourceLimitApi;
    readonly resourceUsage:ResourceUsageApi;
    readonly transport:TransportApi;
    readonly relayEndpoints:RelayEndpointApi;
    readonly details:ControlDetailApi;
    readonly queries:ConsoleQueryApi;
    readonly nativeDrivers:NativeDriverApi;
    readonly transportQueries:TransportQueryApi;
    readonly tunnelQueries:TunnelQueryApi;
    readonly pathTemplates:PathTemplateCommandApi;
    readonly pathTemplateQueries:PathTemplateQueryApi;
    readonly pathBindings:PathBindingApi;
    readonly forwards:ForwardBindingApi;
    readonly tunnels:NativeTunnelApi;
    readonly pathGroups:PathGroupApi;
    readonly pathPublications:PathPublicationApi;
    readonly ingressGroups:IngressGroupApi;
    readonly ingressDeployments:IngressDeploymentApi;
    readonly ingressMigrations:IngressMigrationApi;
    readonly observations:NodeObservationApi;
    readonly profileGrants:TransportGrantApi;
    readonly probePlans:ForwardProbePlanApi;
    readonly probeCapabilities:ForwardProbeCapabilitiesApi;
    readonly probes:ForwardProbeApi;
    readonly probeNegotiation:ProbeNegotiationApi;
    readonly probeRegistry:ProbeInstanceApi;
    readonly probeClaims:ProbeClaimApi;
    readonly probeDelivery:ProbeDeliveryApi;
    readonly probeResults:ProbeResultApi;
    readonly probeTypeRegistry:ProbeTypeRegistryApi;
    readonly probeTypes:ProbeTypesApi;
    readonly probeServiceRegistry:ProbeServiceRegistryApi;
    readonly probeServices:ProbeServicesApi;
    readonly probeEcho:ProbeEchoApi;
    readonly probeEchoRegistry:ProbeEchoRegistryApi;
    readonly transitNegotiation:TransitNegotiationApi;
    readonly transitDelivery:TransitDeliveryApi;
}

export interface AuthorityAdmission {
    allow():Promise<void>;
    read():Promise<{maintenance:boolean}>;
}

/** Named optional services avoid changing every caller when another read module is installed. */
export interface ControlHttpServices {
    telemetry?:NodeTelemetryApi|undefined;
    forwardTelemetry?:ForwardTelemetryApi|undefined;
    authenticateObservation?:((header:string|undefined)=>Promise<string>)|undefined;
    hostTelemetry?:HostTelemetryApi|undefined;
    probeTelemetry?:ProbeTelemetryApi|undefined;
    telemetryRollups?:TelemetryRollupApi|undefined;
    diagnostics?:ForwardDiagnosticsApi|undefined;
    audit?:AuditEventsApi|undefined;
    stationAlerts?:StationAlertsApi|undefined;
    notificationEndpoints?:NotificationEndpointsApi|undefined;
    notificationDeliveries?:NotificationDeliveriesApi|undefined;
    probeRuns?:ProbeRunsApi|undefined;
    probePlans?:ProbePlansApi|undefined;
    observationServices?:ObservationServicesApi|undefined;
}
export interface ControlHttpOptions {
    control:ControlApi;runtime:RuntimeMachinePort;authority:AuthorityAdmission;services?:ControlHttpServices;
    requests?:Pick<RequestLifecycle,'run'>;
}
