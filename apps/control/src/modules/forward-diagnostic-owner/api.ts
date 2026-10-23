import type { ProbeResultRequest, ProbeTypesResultRequest, ProbeServicesResultRequest, ProbeServiceSelection,
    ProbeServicesTLSResult } from '../../compatibility/public.ts';
import type { DiagnosticRetirement, DiagnosticSlot } from './contracts.ts';
import type { FORWARD_DIAGNOSTIC_LIMITS } from './policy.ts';

export const FORWARD_DIAGNOSTIC_API_INTERFACE_VERSION=2 as const;

export interface DiagnosticBindingView {nodeId:string;assignmentId:string;deploymentGeneration:number;bindingFence:number}
export interface DiagnosticEndpointView {host:string;port:number}
export interface DiagnosticOperationView {
    id:string;forwardId:string;targetRevision:number;kind:string;status:string;createdAt:string;updatedAt:string;executionDeadline:string;
    cleanupPending:boolean;recoveryInvalidated:boolean;sourceOperationId:string|null;
    error:{code:string;retryable:boolean|null;nextStep:string}|null;
}
export interface DiagnosticReportView {
    observedAt:string;receivedAt:string;reportSequence:number;sessionEpoch:number;snapshotGeneration:number;matchesNodeEvidence:boolean;
}
export interface DiagnosticDrainView extends DiagnosticReportView {
    startedAt:string;deadline:string;remainingConnections:number;condition:string;source:string;
}
export interface DiagnosticObservationView {
    readonly status:'fresh'|'stale'|'unknown';readonly reason:string;readonly expiresAt:string|null;readonly reportAgeMs:number|null;
}
export interface DiagnosticNodeView {
    readonly nodeId:string;readonly revoked:boolean;readonly credentialUntil:string|null;readonly credentialWindowOpen:boolean;
    readonly bootId:string|null;readonly sessionEpoch:number;readonly snapshotGeneration:number;readonly reportSequence:number;readonly receivedAt:string|null;
    readonly snapshot:Readonly<{nodeId:string;sessionEpoch:number;generation:number;issuedAt:string;validUntil:string;digest:string}>|null;
    readonly report:Readonly<{nodeId:string;bootId:string;sessionEpoch:number;sequence:number;snapshotGeneration:number;observedAt:string}>|null;
    readonly observation:DiagnosticObservationView;readonly sessionCurrent:boolean;readonly snapshotCurrent:boolean;
    readonly source:'persisted-node-and-agent-report';readonly health:'unknown';
}
export interface DiagnosticListenerView extends Readonly<DiagnosticBindingView> {
    readonly sessionEpoch:number;readonly snapshotGeneration:number;readonly forwardRevision:number;readonly role:string;
    readonly protocol:'tcp'|'udp';readonly phase:string;readonly driverId:string;readonly configDigest:string;
    readonly resource:Readonly<{address:string;port:number;protocol:'tcp'|'udp'}>;
    readonly target:DiagnosticEndpointView|null;readonly peerEndpoint:DiagnosticEndpointView|null;
    readonly linkKind:'none'|'relay-binding'|'hop-path';readonly linkDigest:string|null;
    readonly relation:'current-intent'|'historical-intent';readonly nodeEvidenceMatches:boolean;readonly reportFresh:boolean;
    readonly observation:Readonly<DiagnosticReportView&{phase:string;condition:string;errorCode:string|null;retryable:boolean;nextStep:string|null;
        phaseMatches:boolean;source:'agent-reported'}>|null;
    readonly drain:DiagnosticDrainView|null;
    readonly reservation:'not-present-in-bounded-owned-slots'|'owned-exact-tuple'|'owned-different-tuple';
    readonly listeningSocket:'not-independently-verified';readonly health:'unknown';
}
export interface DiagnosticDeploymentView {
    readonly generation:number;readonly targetRevision:number;readonly stage:string;readonly createdAt:string;readonly updatedAt:string;
    readonly authorizationUntil:string;readonly planDigest:string;readonly matchesIntent:boolean;
    readonly source:'persisted-relay-deployment';readonly trafficVerified:false;
}
export interface DiagnosticLeaseView extends Readonly<DiagnosticBindingView> {
    readonly sessionEpoch:number;readonly validUntil:string;readonly windowOpen:boolean;
    readonly source:'historical-issued-lease';readonly currentAuthorization:'not-rechecked';
}
type DiagnosticWireResult=ProbeResultRequest|ProbeTypesResultRequest|ProbeServicesResultRequest;
export interface DiagnosticProbeResultView {
    status:DiagnosticWireResult['status'];code:DiagnosticWireResult['code'];measuredAt:string;validUntil:string;acceptedAt:string;elapsedMs:number;
    point:DiagnosticWireResult['point'];source:DiagnosticWireResult['source'];applicationHealth:DiagnosticWireResult['applicationHealth'];
    applicationPayloadBytes:DiagnosticWireResult['applicationPayloadBytes'];tls:ProbeServicesTLSResult|null;windowOpen:boolean;
}
export interface DiagnosticProbeView {
    readonly permitId:string;readonly measurement:string;readonly point:'agent-direct-egress'|'agent-local-direct-ingress';readonly service:ProbeServiceSelection|null;
    readonly binding:Readonly<DiagnosticBindingView&{bootId:string;sessionEpoch:number;snapshotGeneration:number;forwardRevision:number;configDigest:string;egressPolicyRevision:number}>;
    readonly state:string;readonly issuedAt:string;readonly expiresAt:string;readonly closedAt:string|null;readonly withdrawnAt:string|null;
    readonly bindingMatchesCurrent:boolean;readonly result:DiagnosticProbeResultView|null;readonly health:'unknown';readonly executionAuthorized:false;
}
export interface DiagnosticBoundedView<T> {limit:number;truncated:boolean;items:T[]}
export interface DiagnosticEvidenceFlags {
    source:'persisted-control-and-agent-state';readOnly:true;networkCheck:'not-performed';executionAuthorized:false;
    health:'unknown';consistency:'read-committed-not-global-snapshot';snapshotDigestVerification:'projected-not-recomputed';
}
export interface ForwardDiagnosticData extends DiagnosticEvidenceFlags {
    diagnosticVersion:number;scopeId:string;capturedAt:string;limits:typeof FORWARD_DIAGNOSTIC_LIMITS;
    intent:{forwardId:string;revision:number;specDigest:string;enabled:boolean;deleting:boolean;recoverySuspended:boolean;protocols:('tcp'|'udp')[];
        mode:string;path:string[];listen:{address:string;port:number};transport:{profileId:string;configRevision:number}|null};
    operations:DiagnosticBoundedView<DiagnosticOperationView>;deployment:DiagnosticDeploymentView|null;
    nodes:{position:number;role:string;nodeId:string;evidence:DiagnosticNodeView|null}[];
    listeners:DiagnosticBoundedView<DiagnosticListenerView>;
    adjacentSegments:{position:number;fromNodeId:string;toNodeId:string;carrier:string;source:string;connectivity:string;
        protocols:{protocol:'tcp'|'udp';fromAssignmentId:string|null;toAssignmentId:string|null;identityCorrelated:boolean;peerEndpoint:DiagnosticEndpointView|null}[]}[];
    target:{nodeId:string;endpoint:DiagnosticEndpointView;protocols:('tcp'|'udp')[];source:string;connectivity:string;applicationHealth:string;
        configurations:{assignmentId:string;protocol:'tcp'|'udp';forwardRevision:number;matchesIntent:boolean}[]};
    probe:{support:string;source:string;historyComplete:boolean;retention:string;limit:number;truncated:boolean;items:DiagnosticProbeView[]};
    cleanup:{complete:boolean;source:string;slots:DiagnosticBoundedView<DiagnosticSlot>;
        retirements:DiagnosticBoundedView<DiagnosticRetirement>;leases:DiagnosticBoundedView<DiagnosticLeaseView>};
}

export interface DiagnosticSupportBinding {node:string|null;assignment:string|null;deploymentGeneration:number;bindingFence:number}
type MutableProjection<T>={-readonly [K in keyof T]:T[K]};
export interface ForwardDiagnosticSupport extends DiagnosticEvidenceFlags {
    supportVersion:number;redacted:boolean;scope:string;forward:string;capturedAt:string;exclusions:string[];
    intent:{revision:number;enabled:boolean;deleting:boolean;recoverySuspended:boolean;mode:string;protocols:string[];nodes:(string|null)[]};
    operations:DiagnosticBoundedView<Omit<DiagnosticOperationView,'id'|'forwardId'|'sourceOperationId'>&{operation:string|null;sourceOperation:string|null}>;
    deployment:(MutableProjection<Omit<DiagnosticDeploymentView,'planDigest'|'source'|'trafficVerified'>>&{trafficVerified:boolean})|null;
    nodes:{node:string|null;position:number;role:string;evidence:MutableProjection<Pick<DiagnosticNodeView,'revoked'|'credentialWindowOpen'|'sessionEpoch'|
        'snapshotGeneration'|'reportSequence'|'receivedAt'|'observation'|'sessionCurrent'|'snapshotCurrent'>>|null}[];
    listeners:DiagnosticBoundedView<DiagnosticSupportBinding&MutableProjection<Pick<DiagnosticListenerView,'sessionEpoch'|'snapshotGeneration'|'forwardRevision'|'role'|
        'protocol'|'phase'|'driverId'|'relation'|'nodeEvidenceMatches'|'reportFresh'|'observation'|'drain'|'reservation'>>&{
            physicalProtocol:'tcp'|'udp';listeningSocket:string}>;
    adjacentSegments:{position:number;fromNode:string|null;toNode:string|null;carrier:string;connectivity:string;
        protocols:{protocol:string;identityCorrelated:boolean}[]}[];
    target:{node:string|null;protocols:string[];connectivity:string;applicationHealth:string;
        configurations:{assignment:string|null;protocol:string;forwardRevision:number;matchesIntent:boolean}[]};
    probe:{support:string;limit:number;truncated:boolean;historyComplete:boolean;items:(DiagnosticSupportBinding&{
        permit:string|null;sessionEpoch:number;snapshotGeneration:number;forwardRevision:number;state:string;
        issuedAt:string;expiresAt:string;closedAt:string|null;withdrawnAt:string|null;measurement:string;point:DiagnosticProbeView['point'];
        bindingMatchesCurrent:boolean;result:(Omit<DiagnosticProbeResultView,'tls'>&{tls:MutableProjection<Pick<ProbeServicesTLSResult,'version'|'alpn'|'verified'>>|null})|null;
        health:string;executionAuthorized:boolean})[]};
    cleanup:{complete:boolean;
        slots:DiagnosticBoundedView<{node:string|null;protocol:'tcp'|'udp';fence:number;deploymentGeneration:number}>;
        retirements:DiagnosticBoundedView<DiagnosticSupportBinding&{operation:string|null;removedEpoch:number|null;retirementGeneration:number|null;safe:boolean}>;
        leases:DiagnosticBoundedView<DiagnosticSupportBinding&MutableProjection<Pick<DiagnosticLeaseView,'sessionEpoch'|'validUntil'|'windowOpen'|'source'|'currentAuthorization'>>>};
}
export interface ForwardDiagnosticView extends ForwardDiagnosticData {
    support:{redacted:boolean;sameRead:boolean;bytes:number;digest:string;bundle:ForwardDiagnosticSupport};
}
export interface ForwardDiagnosticsApi {
    admitReadRequest<T>(action:()=>Promise<T>):Promise<T>;
    get(actor:string,scope:string,id:string):Promise<ForwardDiagnosticView>;
}
