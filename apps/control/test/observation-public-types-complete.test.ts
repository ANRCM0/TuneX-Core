import type * as F from '../src/framework/public.ts';
import type * as N from '../src/compatibility/public.ts';
import type * as Notification from '../src/modules/notification-owner/public.ts';
import type * as Runs from '../src/modules/probe-history-owner/public.ts';
import type * as Plans from '../src/modules/probe-plan-owner/public.ts';
import type * as Audit from '../src/modules/audit-owner/public.ts';
import type * as Services from '../src/modules/observation-service-owner/public.ts';
import type * as Diagnostics from '../src/modules/forward-diagnostic-owner/public.ts';
import type * as Station from '../src/modules/station-alert-owner/public.ts';
import type * as Telemetry from '../src/modules/telemetry-owner/public.ts';
import type * as Probe from '../src/modules/probe-owner/public.ts';
import type * as OldInstances from '../src/modules/probe-instance-ports.ts';
import type { TargetEndpoint } from '@tunex/core';
import type { RuntimeSnapshot } from '@tunex/contracts/runtime';
import type { RuntimeSnapshotFor } from '@tunex/contracts/execution-values';

// These compile-time assertions deliberately do not replace native storage,
// parser, clock, transaction, constructor or module-initialization evidence.
type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Same<T extends true> = T;
type Flat<T> = {[K in keyof T]:T[K]};
type Optional<T> = {[K in keyof T]-?:{} extends Pick<T,K>?K:never}[keyof T];
type Mutable<T> = {[K in keyof T]-?:Equal<Pick<T,K>,{-readonly [P in keyof Pick<T,K>]:Pick<T,K>[P]}> extends true?K:never}[keyof T];
type Tx = {readonly observationContractTransaction:unique symbol};
type Endpoint<C={enabled:boolean},S=string> = {endpointId:string;revision:number;credentialRevision:number;config:C;configDigest:string;managedBy:string;createdAt:number;updatedAt:number;suspended:S;authorityDigest:string;credentialRef:string};
type EndpointAudit<K=string> = {id:string;endpointId:string;revision:number;kind:K;actorId:string;createdAt:number};
type Outbox<P={scopeId:string},S=string,C=string,O=string> = {
    id:string;eventId:string;policyId:string;endpointId:string;policyConfigRevision:number;endpointRevision:number;credentialRevision:number;
    policyManagedBy:string;endpointManagedBy:string;authorityDigest:string;payload:P;payloadDigest:string;revision:number;status:S;
    attemptCount:number;fence:number;claimedAt:number|null;claimUntil:number|null;createdAt:number;updatedAt:number;nextAttemptAt:number;
    expiresAt:number;lastCode:C|null;lastOutcome:O;lastStatusCode:number|null;recoverySuspended:boolean;
};
type Attempt<C=string,O=string> = {id:string;deliveryId:string;ordinal:number;fence:number;startedAt:number;finishedAt:number|null;outcome:O;code:C|null;statusCode:number|null};
type OutboxHeader = {scopeId:string;id:string;revision:number};
type OutboxLosses = {queueRejected:number;routingRejected:number;silenceSuppressed:number;disabledSuppressed:number;rowsExpired:number;rowsEvicted:number;attemptsEvicted:number};
type OutboxQuery<S=string> = {from:number;to:number;limit:number;before:{createdAt:number;id:string}|null;endpointId?:string;eventId?:string;status?:S};
type EndpointStore<E,A> = {
    lockScope(tx:Tx,scope:string):Promise<void>;count(tx:Tx,scope:string):Promise<number>;list(tx:Tx,scope:string):Promise<E[]>;
    get(tx:Tx,scope:string,id:string,lock?:boolean):Promise<E|null>;put(tx:Tx,scope:string,value:E):Promise<void>;
    audit(tx:Tx,scope:string,value:A):Promise<void>;audits(tx:Tx,scope:string,id:string):Promise<A[]>;auditLosses(tx:Tx,scope:string):Promise<number>;
};
type OutboxStore<D extends {status:string},A> = {
    lockScope(tx:Tx,scope:string):Promise<void>;losses(tx:Tx,scope:string):Promise<OutboxLosses>;
    loss(tx:Tx,scope:string,kind:'routingRejected'|'silenceSuppressed'|'disabledSuppressed',count:number):Promise<void>;
    insert(tx:Tx,scope:string,value:D,now:number):Promise<'inserted'|'duplicate'|'full'>;
    due(tx:Tx,now:number):Promise<OutboxHeader|null>;defer(tx:Tx,header:OutboxHeader,cutoff:number,retryAt:number):Promise<void>;
    get(tx:Tx,scope:string,id:string,lock?:boolean|'share'):Promise<D|null>;put(tx:Tx,scope:string,value:D):Promise<void>;
    activeCount(tx:Tx,scope:string,now:number):Promise<number>;reserveRate(tx:Tx,scope:string,endpointId:string,now:number,intervalMs:number):Promise<number>;
    appendAttempt(tx:Tx,scope:string,value:A):Promise<void>;finishAttempt(tx:Tx,scope:string,deliveryId:string,value:A):Promise<void>;
    attempts(tx:Tx,scope:string,id:string):Promise<A[]>;history(tx:Tx,scope:string,query:OutboxQuery<D['status']>):Promise<D[]>;
};
export type NotificationCompleteDeclarations35 = [
    Same<Equal<Notification.NotificationEndpointConfig,{schemaVersion:1;enabled:boolean;policyIds:string[];kinds:('firing'|'recovered'|'invalidated')[];minimumIntervalSeconds:number}>>,
    Same<Equal<Notification.NotificationPayload,{
        notificationVersion:1;deliveryId:string;scopeId:string;event:{id:string;policyId:string;configRevision:number;episode:number;kind:'firing'|'recovered'|'invalidated';rule:Station.StationAlertRule;target:{kind:'forward'|'node';id:string};reason:Station.StationAlertReason;occurredAt:number};
    }>>,
    Same<Equal<Notification.NotificationDeliveryStatus,'queued'|'claimed'|'retry-wait'|'delivered'|'dead-letter'|'cancelled'>>,
    Same<Equal<Notification.NotificationSendCode,'HTTP_ACCEPTED'|'HTTP_REJECTED'|'DESTINATION_DENIED'|'DNS_DENIED'|'DNS_FAILED'|'DNS_TIMEOUT'|'CAPACITY_UNAVAILABLE'|'REQUEST_INVALID'|'ABORTED'|'DEADLINE'|'RESPONSE_LIMIT'|'NETWORK_UNKNOWN'|'DISPATCH_DENIED'|'GUARD_FAILED'>>,
    Same<Equal<Notification.NotificationDeliveryCode,Notification.NotificationSendCode|'CREDENTIAL_UNAVAILABLE'|'ATTEMPT_EXPIRED'|'EVENT_TOO_OLD'|'POLICY_CHANGED'|'ENDPOINT_CHANGED'|'AUTHORIZATION_REVOKED'|'CURRENT_SILENCE'|'RECOVERY_SUSPENDED'|'RATE_WAIT'|'CAPACITY_WAIT'>>,
    Same<Equal<Notification.NotificationDeliveryLoss,'routingRejected'|'silenceSuppressed'|'disabledSuppressed'>>,
    Same<Equal<Notification.NotificationDeliveryLosses,OutboxLosses>>,Same<Equal<Notification.NotificationDeliveryHeader,OutboxHeader>>,
    Same<Equal<F.NotificationEndpointRecord,Endpoint>>,Same<Equal<F.NotificationEndpointAuditRecord,EndpointAudit>>,
    Same<Equal<F.NotificationOutboxRecord,Outbox>>,Same<Equal<F.NotificationAttemptRecord,Attempt>>,
    Same<Equal<F.NotificationOutboxHeader,OutboxHeader>>,Same<Equal<F.NotificationOutboxLosses,OutboxLosses>>,
    Same<Equal<F.NotificationOutboxQuery,OutboxQuery>>,Same<Equal<Optional<F.NotificationOutboxQuery>,'endpointId'|'eventId'|'status'>>,
    Same<Equal<Mutable<F.NotificationOutboxRecord>,keyof Outbox>>,Same<Equal<Optional<F.NotificationOutboxRecord>,never>>,
    Same<Equal<Notification.NotificationEndpoint,Endpoint<Notification.NotificationEndpointConfig,'none'|'recovery'>>>,
    Same<Equal<Notification.NotificationEndpointAudit,EndpointAudit<'publish'|'disable'>>>,
    Same<Equal<Notification.NotificationDelivery,Outbox<Notification.NotificationPayload,Notification.NotificationDeliveryStatus,Notification.NotificationDeliveryCode,'none'|'delivered'|'rejected'|'unknown'>>>,
    Same<Equal<Notification.NotificationDeliveryAttempt,Attempt<Notification.NotificationDeliveryCode,'pending'|'delivered'|'rejected'|'unknown'>>>,
    Same<Equal<Notification.NotificationDeliveryQuery,OutboxQuery<Notification.NotificationDeliveryStatus>>>,
    Same<Equal<Notification.NotificationEndpointStore<Tx>,EndpointStore<Notification.NotificationEndpoint,Notification.NotificationEndpointAudit>>>,
    Same<Equal<Notification.NotificationDeliveryStore<Tx>,OutboxStore<Notification.NotificationDelivery,Notification.NotificationDeliveryAttempt>>>,
    Same<Equal<F.NotificationEndpointStorage<Tx,Endpoint,EndpointAudit>,EndpointStore<Endpoint,EndpointAudit>>>,
    Same<Equal<F.NotificationOutboxStorage<Tx,Outbox,Attempt>,OutboxStore<Outbox,Attempt>>>,
    Same<Equal<F.NotificationEndpointValues<Endpoint,EndpointAudit>,{readonly endpoint:(input:unknown)=>Endpoint;readonly audit:(input:unknown)=>EndpointAudit}>>,
    Same<Equal<F.NotificationOutboxValues<Outbox,Attempt>,{readonly delivery:(input:unknown)=>Outbox;readonly attempt:(input:unknown)=>Attempt}>>,
];

type HistoryPermit<B={forwardId:string;nodeId:string},S=string,M=string,V=unknown,C=unknown> = {
    measurement?:M;service?:V;echoChallenge?:C;probeId:string;scopeId:string;actorId:string;binding:B;instanceId:string;
    instanceGeneration:number;timeoutMs:number;issuedAt:number;expiresAt:number;state:S;closedAt:number|null;
};
type HistoryResult<S=string,C=string,T=unknown,P=unknown> = {status:S;code:C;tls?:T|null;echo?:P|null;requestBytes?:number;responseBytes?:number;elapsedMs:number;measuredAt:number;validUntil:number;acceptedAt:number;resultDigest:string};
type HistoryMetadata<R=HistoryResult> = {revision:number;updatedAt:number;withdrawnAt:number|null;result:R|null;recoverySuspended:boolean};
type HistoryQuery<S=string,R=string> = {from:number;to:number;limit:number;before:{issuedAt:number;probeId:string}|null;forwardId?:string;nodeId?:string;probeId?:string;state?:S;resultStatus?:R|'missing'};
type HistoryStore<R extends {state:string;result:{status:string}|null}> = {
    lockScope(tx:Tx,scope:string):Promise<void>;losses(tx:Tx,scope:string):Promise<{rowsExpired:number;rowsEvicted:number;updatesWithoutHead:number}>;
    missingUpdate(tx:Tx,scope:string):Promise<void>;insert(tx:Tx,value:R,now:number):Promise<void>;
    get(tx:Tx,scope:string,id:string,lock?:boolean):Promise<R|null>;put(tx:Tx,value:R):Promise<void>;
    history(tx:Tx,scope:string,principal:F.ReadPrincipal,query:HistoryQuery<R['state'],NonNullable<R['result']>['status']>):Promise<R[]>;
};
type PlanHead<C={forwardId:string;mode:string;expiresAt:number},B=unknown,S=string,K=string> = {
    id:string;scopeId:string;createdBy:string;createdAt:number;config:C;configDigest:string;originBinding:B;revision:number;state:S;
    decisionCount:number;acceptedCount:number;nextRunAt:number;updatedAt:number;cancelledBy:string|null;cancelledAt:number|null;lastCode:K|null;recoverySuspended:boolean;
};
type Decision<S=string,O=unknown> = {position:number;actorId:string;source:S;decidedAt:number;outcome:O};
type PlanQuery<S=string,M=string> = {from:number;to:number;limit:number;before:{createdAt:number;id:string}|null;forwardId?:string;mode?:M;state?:S};
type PlanStore<H extends {state:string;config:{mode:string}},D,E> = {
    lockScope(tx:Tx,scope:string):Promise<void>;losses(tx:Tx,scope:string):Promise<{rowsExpired:number;rowsEvicted:number;decisionsEvicted:number}>;
    create(tx:Tx,head:H,now:number):Promise<void>;get(tx:Tx,scope:string,id:string,lock?:boolean|'share'):Promise<H|null>;
    put(tx:Tx,head:H):Promise<void>;append(tx:Tx,scope:string,id:string,decision:D):Promise<void>;decisions(tx:Tx,scope:string,id:string):Promise<D[]>;
    history(tx:Tx,scope:string,principal:F.ReadPrincipal,query:PlanQuery<H['state'],H['config']['mode']>):Promise<H[]>;due(tx:Tx,now:number):Promise<OutboxHeader|null>;
    defer(tx:Tx,header:OutboxHeader,cutoff:number,retryAt:number):Promise<void>;
    isolate<T>(tx:Tx,action:()=>Promise<T>):Promise<{accepted:true;value:T}|{accepted:false;error:E}>;
};
export type HistoryPlanCompleteDeclarations36 = [
    Same<Equal<Plans.ProbePlanConfig,{version:1;kind:'tcp-connect'|'tcp-ingress-connect'|'tcp-ingress-tls';forwardId:string;expectedForwardRevision:number;timeoutMs:number;service?:Probe.ProbeServiceReference;mode:'manual'|'scheduled';intervalSeconds:number|null;maxRuns:number;expiresAt:number}>>,
    Same<Equal<Optional<Plans.ProbePlanConfig>,'service'>>,
    Same<Equal<Plans.ProbePlanState,'active'|'completed'|'cancelled'|'expired'|'suspended'>>,
    Same<Equal<Plans.ProbePlanCode,'PERMIT_ACCEPTED'|'PLAN_CANCELLED'|'PLAN_EXPIRED'|'AUTHORIZATION_REVOKED'|'RECOVERY_SUSPENDED'|'PROBE_DISABLED'|'PROBE_UNAVAILABLE'|'PROBE_PERMIT_UNAVAILABLE'|'PROBE_PERMIT_LIMIT'|'AUTHORIZATION_DENIED'|'NOT_FOUND'|'REVISION_CONFLICT'|'UNSUPPORTED_CAPABILITY'|'SESSION_SUPERSEDED'>>,
    Same<Equal<F.ProbeHistoryPermit,HistoryPermit>>,Same<Equal<F.ProbeHistoryResult,HistoryResult>>,
    Same<Equal<F.ProbeHistoryMetadata,HistoryMetadata>>,Same<Equal<Flat<F.ProbeHistoryRecord>,Flat<HistoryPermit&HistoryMetadata>>>,
    Same<Equal<F.ProbeHistoryQuery,HistoryQuery>>,Same<Equal<Optional<F.ProbeHistoryPermit>,'measurement'|'service'|'echoChallenge'>>,
    Same<Equal<Optional<F.ProbeHistoryResult>,'tls'|'echo'|'requestBytes'|'responseBytes'>>,
    Same<Equal<Mutable<F.ProbeHistoryResult>,keyof HistoryResult>>,
    Same<Equal<Runs.ProbeRunPermit,HistoryPermit<Probe.ProbeBinding,Runs.ProbeRunState,'tcp-ingress-connect-v1'|'tcp-ingress-tls-v1'|'tcp-ingress-echo-v1'|'udp-ingress-echo-v1'|'tcp-path-echo-v1'|'udp-path-echo-v1',N.ProbeServiceSelection,N.ProbeEchoChallenge>>>,
    Same<Equal<Runs.ProbeRunResult,HistoryResult<'connected'|'unreachable'|'verified'|'unverified'|'echoed','tcp-connected'|'tcp-connect-failed'|'tls-handshake-verified'|'tls-handshake-failed'|'nonce-echo-verified'|'nonce-echo-rejected',{version:'TLSv1.3';alpn:'tunex-observation/1';leafFingerprint:string;verified:true},N.ProbeEchoProof>>>,
    Same<Equal<Flat<Runs.ProbeRunRecord>,Flat<Runs.ProbeRunPermit&HistoryMetadata<Runs.ProbeRunResult>>>>,
    Same<Equal<Runs.ProbeRunStore<Tx>,HistoryStore<Runs.ProbeRunRecord>>>,
    Same<Equal<Runs.ProbeRunLosses,{rowsExpired:number;rowsEvicted:number;updatesWithoutHead:number}>>,
    Same<Equal<Runs.ProbeRunQuery,HistoryQuery<Runs.ProbeRunState,Runs.ProbeRunResult['status']>>>,
    Same<Equal<Runs.ProbeRunCapture,{kind:'issued'|'consumed'|'revoked'|'withdrawn'|'result';permit:Runs.ProbeRunPermit;at:number;result:Runs.ProbeRunResult|null}>>,
    Same<Equal<Runs.ProbeRunRecorder<Tx>,{recordIn(tx:Tx,capture:Runs.ProbeRunCapture):Promise<void>}>>,
    Same<Equal<F.ProbeHistoryStorage<Tx,F.ProbeHistoryRecord>,HistoryStore<F.ProbeHistoryRecord>>>,
    Same<Equal<F.ProbeHistoryValues<Runs.ProbeRunRecord>,{readonly read:(input:unknown)=>Runs.ProbeRunRecord;readonly immutable:(input:Runs.ProbeRunRecord)=>string}>>,
    Same<Equal<F.ProbePlanStoredHead,PlanHead>>,Same<Equal<F.ProbePlanStoredDecision,Decision>>,
    Same<Equal<F.ProbePlanStoredFailure,{code:string;status:number}>>,Same<Equal<F.ProbePlanStoredHeader,OutboxHeader>>,
    Same<Equal<F.ProbePlanStoredQuery,PlanQuery>>,Same<Equal<Plans.ProbePlanHead,PlanHead<Plans.ProbePlanConfig,Probe.ProbeBinding,Plans.ProbePlanState,Plans.ProbePlanCode>>>,
    Same<Equal<Plans.ProbePlanDecision,Decision<'manual'|'scheduled',{accepted:true;receipt:Probe.AnyProbeAcceptance}|{accepted:false;error:Plans.ProbePlanFailure}>>>,
    Same<Equal<Plans.ProbePlanFailure,{code:Plans.ProbePlanCode;status:403|404|409|422|429}>>,
    Same<Equal<Plans.ProbePlanHeader,OutboxHeader>>,Same<Equal<Plans.ProbePlanLosses,{rowsExpired:number;rowsEvicted:number;decisionsEvicted:number}>>,
    Same<Equal<Plans.ProbePlanQuery,PlanQuery<Plans.ProbePlanState,'manual'|'scheduled'>>>,
    Same<Equal<Plans.ProbePlanIssuer<Tx>,{previewIn(tx:Tx,actor:string,scope:string,config:Plans.ProbePlanConfig):Promise<Probe.ForwardProbePlan>;issueIn(tx:Tx,actor:string,scope:string,config:Plans.ProbePlanConfig):Promise<Probe.AnyProbeAcceptance>}>>,
    Same<Equal<Plans.ProbePlanStore<Tx>,PlanStore<Plans.ProbePlanHead,Plans.ProbePlanDecision,Plans.ProbePlanFailure>>>,
    Same<Equal<F.ProbePlanStorage<Tx,F.ProbePlanStoredHead,F.ProbePlanStoredDecision,F.ProbePlanStoredFailure>,PlanStore<F.ProbePlanStoredHead,F.ProbePlanStoredDecision,F.ProbePlanStoredFailure>>>,
    Same<Equal<F.ProbePlanStorageValues<Plans.ProbePlanHead,Plans.ProbePlanDecision,Plans.ProbePlanFailure>,{
        readonly head:(input:unknown)=>Plans.ProbePlanHead;readonly decision:(input:unknown,config?:Plans.ProbePlanConfig)=>Plans.ProbePlanDecision;
        readonly immutable:(input:Plans.ProbePlanHead)=>string;readonly expired:(head:Plans.ProbePlanHead,now:number)=>Plans.ProbePlanHead|null;
        readonly failure:(error:unknown)=>Plans.ProbePlanFailure|null;
    }>>,
];

type MetadataHead = {serviceId:string;revision:number;configRevision:number;archived:boolean;recoverySuspended:boolean};
type MetadataRevision<C> = {configRevision:number;config:C;configDigest:string;createdBy:string;createdAt:number};
type MetadataAudit<K=string> = {id:string;serviceId:string;revision:number;configRevision:number;kind:K;actorId:string;createdAt:number};
type MetadataStore<C,K> = {
    lockScope(tx:Tx,scope:string):Promise<void>;count(tx:Tx,scope:string):Promise<number>;list(tx:Tx,scope:string):Promise<MetadataHead[]>;
    head(tx:Tx,scope:string,id:string,lock?:boolean):Promise<MetadataHead|null>;revision(tx:Tx,scope:string,id:string,revision:number):Promise<MetadataRevision<C>|null>;
    insertRevision(tx:Tx,scope:string,id:string,value:MetadataRevision<C>):Promise<void>;putHead(tx:Tx,scope:string,value:MetadataHead):Promise<void>;
    audit(tx:Tx,scope:string,value:MetadataAudit<K>):Promise<void>;audits(tx:Tx,scope:string,id:string):Promise<MetadataAudit<K>[]>;auditLosses(tx:Tx,scope:string):Promise<number>;
};
type AuditSources = 'access'|'node-security'|'forward-ownership'|'resource-limits'|'transport'|'path-template'|'path-binding'|'path-group'|'path-group-binding'|'path-publication'|'path-publication-attempt'|'ingress-group'|'ingress-deployment'|'ingress-deployment-attempt'|'ingress-migration'|'ingress-migration-attempt'|'operation';
type AuditErrors = 'AUTHORIZATION_DENIED'|'EXECUTION_DEADLINE'|'INTEGRITY_FAILURE'|'INVALID_CONFIG'|'UNSUPPORTED_CAPABILITY'|'RESOURCE_CONFLICT'|'RESOURCE_LIMIT'|'PORT_RESERVED'|'FENCING_REJECTED'|'LEASE_EXPIRED'|'SESSION_SUPERSEDED'|'LISTEN_FAILED'|'BIND_FAILED'|'TARGET_DENIED'|'CONNECT_FAILED'|'DIAL_FAILED'|'PEER_UNAVAILABLE'|'TLS_FAILED'|'RELAY_HANDSHAKE_FAILED'|'DRAIN_TIMEOUT'|'INTERNAL_ERROR'|'CLOCK_UNCERTAIN'|'CONFIG_DIGEST_MISMATCH'|'AUTHENTICATION_FAILED'|'TARGET_REJECTED'|'DOWNSTREAM_NOT_ACTIVE'|'DOWNSTREAM_UNAVAILABLE'|'TARGET_UNAVAILABLE'|'PORT_IN_USE'|'REVISION_CONFLICT'|'GROUP_ARCHIVED'|'TEMPLATE_ARCHIVED'|'REVISION_EXHAUSTED'|'PUBLICATION_STATE_CHANGED'|'NOT_FOUND'|'OTHER_ERROR';
type RawAudit = {occurredAt:number|null;source:unknown;key:unknown;kind:unknown;recordType:unknown;timeMeaning:unknown;actorId:unknown;actorAttribution:unknown;subjectId:unknown;entityKind:unknown;entityId:unknown;revision:number|null;revisionKind:unknown;sequence:number|null;position:number|null;nodeId:unknown;nodeAssociation:unknown;forwardId:unknown;operationId:unknown;outcome:unknown;errorCode:unknown;retryable:boolean|null;recoveryInvalidated:boolean|null};
type AuditFilters<S=string,E=string> = {actorId?:string;nodeId?:string;forwardId?:string;operationId?:string;errorCode?:E;source?:S};
type AuditPosition<S=string> = {occurredAt:number;source:S;key:string};
type AuditQuery<S=string,E=string> = {from:number;to:number;limit:number;filters:Readonly<AuditFilters<S,E>>;before:AuditPosition<S>|null};
type AuditRecord = AuditPosition<AuditSources>&{
    kind:string;recordType:'owner-event'|'immutable-provenance'|'owner-attempt'|'latest-operation-state';timeMeaning:'recorded-at'|'latest-operation-update';
    actorId:string|null;actorAttribution:'initiator'|'unattributed'|'unattributed-recovery'|'requester-not-status-actor';subjectId:string|null;
    entityKind:'scope-access'|'node'|'transport-profile'|'path-template'|'forward'|'path-group'|'path-publication'|'ingress-group'|'ingress-deployment'|'ingress-migration';
    entityId:string;revision:number|null;revisionKind:'access'|'grant'|'config'|'forward'|'batch'|'resource'|null;sequence:number|null;position:number|null;
    nodeId:string|null;nodeAssociation:'explicit-node'|'immutable-forward-spec'|'immutable-template-config'|'immutable-group-definition'|'none';
    forwardId:string|null;operationId:string|null;outcome:'recorded'|'accepted'|'rejected'|'running'|'succeeded'|'failed'|'superseded';errorCode:AuditErrors|null;retryable:boolean|null;recoveryInvalidated:boolean|null;
};
export type MetadataAuditCompleteDeclarations37 = [
    Same<Equal<typeof Audit.AUDIT_SOURCES,readonly ['access','node-security','forward-ownership','resource-limits','transport','path-template','path-binding','path-group','path-group-binding','path-publication','path-publication-attempt','ingress-group','ingress-deployment','ingress-deployment-attempt','ingress-migration','ingress-migration-attempt','operation']>>,
    Same<Equal<typeof Audit.AUDIT_KINDS,Readonly<Record<AuditSources,readonly string[]>>>>,
    Same<Equal<Services.ObservationTLSServiceConfig,{
        readonly version:1;readonly purpose:'direct-ingress-tls-handshake';readonly endpoint:{readonly address:string;readonly port:number};
        readonly trust:{readonly mode:'pinned-leaf-v1';readonly serverName:string;readonly certificateDer:string};readonly validFrom:number;readonly validUntil:number;
    }>>,
    Same<Equal<Services.ObservationEchoServiceConfig,{
        readonly version:2;readonly purpose:'controlled-nonce-echo';readonly endpoint:{readonly address:string;readonly port:number;readonly protocols:readonly ('tcp'|'udp')[]};
        readonly trust:{readonly mode:'ed25519-echo-v1';readonly publicKey:string};readonly validFrom:number;readonly validUntil:number;
    }>>,
    Same<Equal<Services.ObservationServiceConfig,Services.ObservationTLSServiceConfig|Services.ObservationEchoServiceConfig>>,
    Same<Equal<Mutable<Services.ObservationTLSServiceConfig>,never>>,Same<Equal<Mutable<Services.ObservationEchoServiceConfig>,never>>,
    Same<Equal<Services.ObservationServiceReadPort<Tx>,Pick<MetadataStore<Services.ObservationServiceConfig,'publish'|'archive'>,'head'|'revision'>>>,
    Same<Equal<F.ObservationMetadataHead,MetadataHead>>,Same<Equal<F.ObservationMetadataAudit,MetadataAudit>>,
    Same<Equal<Services.ObservationServiceHead,MetadataHead>>,Same<Equal<Services.ObservationServiceRevision,MetadataRevision<Services.ObservationServiceConfig>>>,
    Same<Equal<Services.ObservationServiceAudit,MetadataAudit<'publish'|'archive'>>>,
    Same<Equal<Services.ObservationServiceStore<Tx>,MetadataStore<Services.ObservationServiceConfig,'publish'|'archive'>>>,
    Same<Equal<F.ObservationMetadataValues<Services.ObservationServiceConfig,'publish'|'archive'>,{readonly config:(input:unknown)=>Services.ObservationServiceConfig;readonly auditKind:(input:unknown)=>input is 'publish'|'archive'}>>,
    Same<Equal<F.AuditStorageRow,RawAudit>>,Same<Equal<Optional<F.AuditStorageRow>,never>>,Same<Equal<Mutable<F.AuditStorageRow>,keyof RawAudit>>,
    Same<Equal<F.AuditStorageFilters,AuditFilters>>,Same<Equal<F.AuditStoragePosition,AuditPosition>>,Same<Equal<F.AuditStorageQuery,AuditQuery>>,
    Same<Equal<F.AuditStoragePolicy,{readonly sources:readonly string[];readonly errorCodes:readonly string[]}>>,
    Same<Equal<F.AuditStorage<Tx>,{source<R>(tx:Tx,scope:string,source:string,query:AuditQuery,project:(row:RawAudit)=>R):Promise<R[]>}>>,
    Same<Equal<Audit.AuditSource,AuditSources>>,Same<Equal<Audit.AuditErrorCode,AuditErrors>>,
    Same<Equal<Audit.AuditFilters,AuditFilters<AuditSources,AuditErrors>>>,Same<Equal<Audit.AuditReadQuery,AuditQuery<AuditSources,AuditErrors>>>,
    Same<Equal<Flat<Audit.AuditRecord>,Flat<AuditRecord>>>,Same<Equal<Optional<Audit.AuditRecord>,never>>,
    Same<Equal<Mutable<Audit.AuditRecord>,keyof AuditRecord>>,
    Same<Equal<Audit.AuditReadPort<Tx>,{source(tx:Tx,scope:string,source:AuditSources,query:AuditQuery<AuditSources,AuditErrors>):Promise<Audit.AuditRecord[]>}>>,
];

type Instance<S=string> = {readonly nodeId:string;readonly bootId:string;readonly sessionEpoch:number;readonly fingerprint:string;readonly instanceId:string;readonly generation:number;readonly state:S;readonly registeredAt:number;readonly expiresAt:number;readonly revokedAt:number|null};
type Qualification<S=string,V=number,E=number> = {servicesVersion?:V;echoVersion?:E;nodeId:string;bootId:string;sessionEpoch:number;fingerprint:string;instanceId:string;instanceGeneration:number;state:S;qualifiedAt:number;expiresAt:number};
type InstanceStore<R> = {readCurrent(tx:Tx,nodeId:string):Promise<R|undefined>;read(tx:Tx,nodeId:string):Promise<R|undefined>;lock(tx:Tx,nodeId:string):Promise<R|undefined>;replace(tx:Tx,expectedGeneration:number,next:R):Promise<void>};
type QualificationStore<R> = {get(tx:Tx,node:string,lock?:boolean):Promise<R|null>;put(tx:Tx,value:R):Promise<void>};
export type RegistrationCompleteDeclarations48And51 = [
    Same<Equal<Probe.ProbeMeasurement,'tcp-connect-v1'|'tcp-ingress-connect-v1'|'tcp-ingress-tls-v1'|'tcp-ingress-echo-v1'|'udp-ingress-echo-v1'|'tcp-path-echo-v1'|'udp-path-echo-v1'>>,
    Same<Equal<Probe.ProbeMeasurementDescription,
        {measurement:'tcp-connect-v1';taskKind:'tcp-connect';point:'agent-direct-egress';capability:'probe.tcp-connect.v1'}|
        {measurement:'tcp-ingress-connect-v1';taskKind:'tcp-ingress-connect';point:'agent-local-direct-ingress';capability:'probe.tcp-ingress-connect.v1'}|
        {measurement:'tcp-ingress-tls-v1';taskKind:'tcp-ingress-tls';point:'agent-local-direct-ingress';capability:'probe.tcp-ingress-tls.v1'}|
        {measurement:'tcp-ingress-echo-v1'|'udp-ingress-echo-v1';taskKind:'tcp-ingress-echo'|'udp-ingress-echo';point:'agent-local-direct-ingress';capability:'probe.tcp-ingress-echo.v1'|'probe.udp-ingress-echo.v1'}|
        {measurement:'tcp-path-echo-v1'|'udp-path-echo-v1';taskKind:'tcp-path-echo'|'udp-path-echo';point:'agent-local-forward-ingress';capability:'probe.tcp-path-echo.v1'|'probe.udp-path-echo.v1'}
    >>,
    Same<Equal<Probe.ProbeServiceReference,{readonly serviceId:string;readonly revision:number;readonly configRevision:number;readonly configDigest:string}>>,
    Same<Equal<Probe.ProbeServiceReference,Services.ObservationServiceReference>>,
    Same<Equal<Probe.ProbeServiceResolver<Tx>,{resolve(tx:Tx,actor:string,scope:string,reference:Probe.ProbeServiceReference):Promise<N.ProbeServiceContext>}>>,
    Same<Equal<Probe.ProbeEchoServiceResolver<Tx>,{resolveEcho(tx:Tx,actor:string,scope:string,reference:Probe.ProbeServiceReference,protocol:'tcp'|'udp'):Promise<N.ProbeEchoServiceContext>}>>,
    Same<Equal<Probe.ProbeInstanceCommand,{readonly bootId:string;readonly instanceId:string;readonly expectedGeneration:number}>>,
    Same<Equal<Probe.ProbeInstanceInspection,{readonly generation:number;readonly state:'absent'|'registered'|'revoked'|'quarantined'|'stale';readonly instance:Probe.ProbeInstanceRegistration|null;readonly executionEnabled:false}>>,
    Same<Equal<Probe.ProbeInstanceOwner,{
        register(nodeId:string,fingerprint:string,epoch:number,input:Probe.ProbeInstanceCommand):Promise<Probe.ProbeInstanceRegistration>;
        revoke(nodeId:string,fingerprint:string,epoch:number,input:Probe.ProbeInstanceCommand):Promise<Probe.ProbeInstanceRegistration>;
        inspect(nodeId:string,fingerprint:string,epoch:number,bootId:string):Promise<Probe.ProbeInstanceInspection>;
    }>>,
    Same<Equal<F.ProbeInstanceStoredRecord,Instance>>,Same<Equal<F.ProbeQualificationStoredRecord,Qualification>>,
    Same<Equal<Probe.ProbeInstanceRecord,Instance<'registered'|'revoked'|'quarantined'>>>,
    Same<Equal<Probe.ProbeTypeQualification,Qualification<'qualified'|'revoked'|'quarantined',1,1>>>,
    Same<Equal<Optional<Probe.ProbeTypeQualification>,'servicesVersion'|'echoVersion'>>,
    Same<Equal<Mutable<Probe.ProbeTypeQualification>,keyof Qualification>>,
    Same<Equal<Mutable<Probe.ProbeInstanceRecord>,never>>,Same<Equal<Optional<Probe.ProbeInstanceRecord>,never>>,
    Same<Equal<F.ProbeInstanceStorage<Tx,Probe.ProbeInstanceRecord>,InstanceStore<Probe.ProbeInstanceRecord>>>,
    Same<Equal<Probe.ProbeInstanceStore<Tx>,Omit<InstanceStore<Probe.ProbeInstanceRecord>,'readCurrent'>>>,
    Same<Equal<Probe.CurrentProbeInstances<Tx>,Pick<InstanceStore<Probe.ProbeInstanceRecord>,'readCurrent'>>>,
    Same<Equal<Probe.ProbeTypeQualifications<Tx>,QualificationStore<Probe.ProbeTypeQualification>>>,
    Same<Equal<F.ProbeQualificationStorage<Tx,Probe.ProbeTypeQualification>,QualificationStore<Probe.ProbeTypeQualification>>>,
    Same<Equal<F.ProbeInstanceStorageValues<Probe.ProbeInstanceRecord>,{readonly read:(input:F.ProbeInstanceStoredRecord,nodeId:string)=>Probe.ProbeInstanceRecord;readonly closing:(expectedGeneration:number,next:Probe.ProbeInstanceRecord)=>boolean}>>,
    Same<Equal<F.ProbeQualificationStorageValues<Probe.ProbeTypeQualification>,{readonly read:(input:F.ProbeQualificationStoredRecord)=>Probe.ProbeTypeQualification}>>,
    Same<Equal<OldInstances.ProbeInstanceRecord,Probe.ProbeInstanceRecord>>,Same<Equal<OldInstances.ProbeInstanceStore<Tx>,Probe.ProbeInstanceStore<Tx>>>,
    Same<Equal<Flat<Probe.ProbeInstanceRegistration>,Flat<Instance<'registered'|'revoked'|'quarantined'>&{readonly executionEnabled:false}>>>,
];

type Machine = {readonly nodeId:string;readonly bootId:string|null;readonly sessionEpoch:number;readonly revoked:boolean;readonly credentialRevoked:boolean;readonly nodeCredentialUntil:number;readonly credentialUntil:number;readonly retireAfter:number|null;readonly capabilities:readonly string[]};
type Published = {readonly bootId:string|null;readonly sessionEpoch:number;readonly credentialUntil:number;readonly snapshot:RuntimeSnapshotFor<N.NativeRuntimeFamily>};
type SnapshotShape<S extends {assignments:readonly unknown[]}> = Flat<Omit<S,'assignments'>&{assignments:Flat<S['assignments'][number]>[]}>;
export type EvidenceCompleteDeclarations49 = [
    Same<Equal<Probe.ProbeBinding,{
        readonly nodeId:string;readonly bootId:string;readonly sessionEpoch:number;readonly snapshotGeneration:number;readonly assignmentId:string;
        readonly forwardId:string;readonly forwardRevision:number;readonly deploymentGeneration:number;readonly bindingFence:number;readonly configDigest:string;readonly egressPolicyRevision:number;
    }>>,
    Same<Equal<F.MachineSessionEvidence,Machine>>,Same<Equal<Probe.ProbeMachineEvidence,Machine>>,
    Same<Equal<Mutable<Probe.ProbeMachineEvidence>,never>>,Same<Equal<Optional<Probe.ProbeMachineEvidence>,never>>,
    Same<Equal<F.MachineSessionReader<Tx>,{read(tx:Tx,nodeId:string,fingerprint:string):Promise<Machine|undefined>}>>,
    Same<Equal<Probe.ProbeMachineReader<Tx>,{read(tx:Tx,nodeId:string,fingerprint:string):Promise<Probe.ProbeMachineEvidence|undefined>}>>,
    Same<Equal<Probe.PublishedProbeSnapshot,Published>>,
    Same<Equal<SnapshotShape<Probe.PublishedProbeSnapshot['snapshot']>,SnapshotShape<RuntimeSnapshot>>>,
    Same<Equal<Probe.PublishedProbeReader<Tx>,{read(tx:Tx,scopeId:string,nodeId:string):Promise<Probe.PublishedProbeSnapshot|undefined>}>>,
    Same<Equal<Probe.ProbeIntents<Tx>,F.RuntimeForwards<Tx>>>,
    Same<Equal<Probe.ProbeNodes<Tx>,{authorized(tx:Tx,actor:string,forward:F.ForwardValue):Promise<F.AuthorizedNodeFacts>}>>,
];

type Permit<M=string,S=unknown,C=unknown,B=unknown> = {
    readonly measurement?:M;readonly serviceContext?:S;readonly echoChallenge?:C;readonly id:string;readonly actorId:string;readonly scopeId:string;
    readonly binding:B;readonly instanceId:string;readonly instanceGeneration:number;readonly fingerprint:string;readonly timeoutMs:number;
    readonly issuedAt:number;readonly expiresAt:number;readonly state:'issued'|'consumed'|'revoked'|'quarantined';readonly closedAt:number|null;
};
type Result<B={readonly permitId:string}> = {readonly body:B;readonly resultDigest:string;readonly acceptedAt:number};
type PermitStore<P,R> = {
    lock(tx:Tx):Promise<{observedAt:number;records:readonly P[];withdrawals:readonly {permitId:string;withdrawnAt:number}[]}>;
    clock(tx:Tx,now:number):Promise<void>;prune(tx:Tx,expiredBefore:number):Promise<void>;insert(tx:Tx,permit:P):Promise<void>;
    close(tx:Tx,id:string,state:'consumed'|'revoked',at:number):Promise<void>;withdraw(tx:Tx,id:string,at:number):Promise<void>;
    result(tx:Tx,permitId:string):Promise<R|undefined>;recordResult(tx:Tx,record:R):Promise<void>;
};
export type PermitCompleteDeclarations50 = [
    Same<Equal<F.ProbePermitStoredInput,{
        readonly measurement:string;readonly tlsContext:unknown;readonly echoChallenge:unknown;readonly id:string;readonly actorId:string;readonly scopeId:string;
        readonly binding:unknown;readonly instanceId:string;readonly instanceGeneration:number;readonly fingerprint:string;readonly timeoutMs:number;
        readonly issuedAt:number;readonly expiresAt:number;readonly state:string;readonly closedAt:number|null;
    }>>,
    Same<Equal<F.ProbePermitStoredRecord,Permit>>,Same<Equal<F.ProbePermitResultInput,Result<unknown>>>,Same<Equal<F.ProbePermitStoredResult,Result>>,
    Same<Equal<Probe.ProbePermitRecord,Permit<'tcp-ingress-connect-v1'|'tcp-ingress-tls-v1'|'tcp-ingress-echo-v1'|'udp-ingress-echo-v1'|'tcp-path-echo-v1'|'udp-path-echo-v1',N.ProbeServiceContext|N.ProbeEchoServiceContext,N.ProbeEchoChallenge,Probe.ProbeBinding>>>,
    Same<Equal<Probe.ProbeResultRecord,Result<N.ProbeResultBody|N.ProbeTypesResultBody|N.ProbeServicesResultBody|N.ProbeEchoResultBody>>>,
    Same<Equal<Mutable<Probe.ProbePermitRecord>,never>>,Same<Equal<Optional<Probe.ProbePermitRecord>,'measurement'|'serviceContext'|'echoChallenge'>>,
    Same<Equal<Mutable<Probe.ProbeResultRecord>,never>>,Same<Equal<Optional<Probe.ProbeResultRecord>,never>>,
    Same<Equal<Probe.ProbePermitStore<Tx>,PermitStore<Probe.ProbePermitRecord,Probe.ProbeResultRecord>>>,
    Same<Equal<F.ProbePermitStorage<Tx,F.ProbePermitStoredRecord,F.ProbePermitStoredResult>,PermitStore<F.ProbePermitStoredRecord,F.ProbePermitStoredResult>>>,
    Same<Equal<Probe.ProbeResultStore<Tx>,Pick<PermitStore<Probe.ProbePermitRecord,Probe.ProbeResultRecord>,'result'|'recordResult'>>>,
    Same<Equal<Probe.ProbePermitPlans<Tx>,{authorize(tx:Tx,actor:string,scope:string,forward:string,input:unknown):Promise<Probe.ForwardProbePlan>}>>,
    Same<Equal<F.ProbePermitStorageValues<Probe.ProbePermitRecord,Probe.ProbeResultRecord>,{
        readonly readPermit:(input:F.ProbePermitStoredInput,decode:(value:unknown)=>unknown)=>Probe.ProbePermitRecord;
        readonly validPermit:(value:unknown)=>value is Probe.ProbePermitRecord;readonly readResult:(input:F.ProbePermitResultInput)=>Probe.ProbeResultRecord;readonly checkResult:(record:Probe.ProbeResultRecord)=>void;
    }>>,
];

type ReportContext = {nodeId:string;bootId:string;sessionEpoch:number;sequence:number;snapshotGeneration:number;observedAt:string;receivedAt:number};
type DiagnosticForward = {id:string;scopeId:string;revision:number;spec:unknown;deleting:boolean;recoverySuspended:boolean};
type DiagnosticOperation = {id:string;forwardId:string;targetRevision:number;kind:string;status:string;createdAt:number;updatedAt:number;executionDeadline:number;cleanupPending:boolean;recoveryInvalidated:boolean;sourceOperationId:string|null;errorCode:string|null;errorRetryable:boolean|null};
type DiagnosticNode = {
    nodeId:string;scopeId:string;revoked:boolean;credentialUntil:number|null;bootId:string|null;sessionEpoch:number;snapshotGeneration:number;lastReportSequence:number;receivedAt:number|null;
    snapshot:{nodeId:string;sessionEpoch:number;generation:number;issuedAt:string;validUntil:string;digest:string}|null;
    report:{nodeId:string;bootId:string;sessionEpoch:number;sequence:number;snapshotGeneration:number;observedAt:string}|null;invalidSnapshot:boolean;invalidReport:boolean;
};
type DiagnosticObservation = {phase:string;condition:string;errorCode:string|null;retryable:boolean;report:ReportContext};
type DiagnosticDrain = {startedAt:string;deadline:string;remainingConnections:number;condition:string;report:ReportContext};
type DiagnosticAssignment = {
    nodeId:string;sessionEpoch:number;snapshotGeneration:number;assignmentId:string;forwardId:string;forwardRevision:number;deploymentGeneration:number;bindingFence:number;
    role:string;protocol:'tcp'|'udp';phase:string;resource:{address:string;port:number;protocol:'tcp'|'udp'};
    driverId:string;driverSchemaVersion:number;configDigest:string;target:TargetEndpoint|null;peerEndpoint:TargetEndpoint|null;
    linkDigest:string|null;linkKind:'none'|'relay-binding'|'hop-path';observation:DiagnosticObservation|null;drain:DiagnosticDrain|null;
};
type DiagnosticDeployment = {forwardId:string;generation:number;targetRevision:number;stage:string;createdAt:number;updatedAt:number;authorizationUntil:number;planDigest:string};
type DiagnosticSlot = {nodeId:string;protocol:'tcp'|'udp';port:number;fence:number;deploymentGeneration:number};
type DiagnosticRetirement = {nodeId:string;assignmentId:string;deploymentGeneration:number;bindingFence:number;operationId:string;removedEpoch:number|null;retirementGeneration:number|null;safe:boolean};
type DiagnosticLease = {nodeId:string;assignmentId:string;deploymentGeneration:number;bindingFence:number;sessionEpoch:number;validUntil:number};
type DiagnosticProbe = {measurement:string;serviceContext:unknown|null;permitId:string;binding:unknown;state:string;issuedAt:number;expiresAt:number;closedAt:number|null;withdrawnAt:number|null;result:{body:unknown;digest:string;acceptedAt:number}|null};
type Page<T> = {items:T[];truncated:boolean};
type DiagnosticStore = {
    forward(tx:Tx,scope:string,id:string):Promise<DiagnosticForward|null>;operations(tx:Tx,scope:string,id:string):Promise<Page<DiagnosticOperation>>;
    nodes(tx:Tx,scope:string,nodeIds:string[]):Promise<DiagnosticNode[]>;assignments(tx:Tx,scope:string,id:string,nodeIds:string[]):Promise<Page<DiagnosticAssignment>>;
    deployment(tx:Tx,scope:string,id:string):Promise<DiagnosticDeployment|null>;slots(tx:Tx,scope:string,id:string):Promise<Page<DiagnosticSlot>>;
    retirements(tx:Tx,scope:string,id:string):Promise<Page<DiagnosticRetirement>>;leases(tx:Tx,scope:string,id:string):Promise<Page<DiagnosticLease>>;probes(tx:Tx,scope:string,id:string):Promise<Page<DiagnosticProbe>>;
};
type StationConfig = {enabled:boolean;rule:string;target:{id:string}};
type StationPolicy<C=StationConfig,S=unknown,U=string> = {policyId:string;revision:number;configRevision:number;config:C;configDigest:string;managedBy:string;createdAt:number;updatedAt:number;silencedUntil:number|null;suspended:U;nextEvaluateAt:number;state:S};
type StationAudit<K=string> = {id:string;policyId:string;revision:number;configRevision:number;configDigest:string;kind:K;actorId:string;createdAt:number;eventId:string|null};
type StationEvent<C=StationConfig,K=string,R=string,E=unknown> = {id:string;policyId:string;policyRevision:number;configRevision:number;config:C;configDigest:string;episode:number;kind:K;reason:R;occurredAt:number;evidence:E;opening:E|null;silenced:boolean;silencedUntil:number|null;revision:number;acknowledgedAt:number|null;recoverySuspended:boolean};
type StationQuery<R=string,K=string> = {from:number;to:number;limit:number;before:{occurredAt:number;id:string}|null;policyId?:string;targetId?:string;rule?:R;kind?:K;acknowledged?:boolean};
type StationLosses = {eventsEvicted:number;eventsExpired:number;auditEvicted:number};
type StationStore<P,A,E> = {
    lockScope(tx:Tx,scope:string):Promise<void>;losses(tx:Tx,scope:string):Promise<StationLosses>;policyCount(tx:Tx,scope:string):Promise<number>;
    policies(tx:Tx,scope:string):Promise<P[]>;policy(tx:Tx,scope:string,id:string,lock?:boolean):Promise<P|null>;putPolicy(tx:Tx,scope:string,value:P):Promise<void>;
    audit(tx:Tx,scope:string,value:A):Promise<void>;audits(tx:Tx,scope:string,id:string):Promise<A[]>;due(tx:Tx,now:number):Promise<{scopeId:string;policyId:string;revision:number}|null>;
    defer(tx:Tx,scope:string,id:string,expectedRevision:number,cutoff:number,retryAt:number):Promise<void>;
    event(tx:Tx,scope:string,id:string,lock?:boolean):Promise<E|null>;events(tx:Tx,scope:string,query:StationQuery):Promise<E[]>;
    appendEvent(tx:Tx,scope:string,value:E,now:number):Promise<void>;acknowledge(tx:Tx,scope:string,id:string,expectedRevision:number,at:number):Promise<void>;
};
type OperationFact = {kind:'operation';targetId:string;forwardRevision:number;operationId:string;targetRevision:number;operationKind:string;status:'accepted'|'running'|'succeeded'|'failed'|'superseded';sourceOperationId:string|null;createdAt:number;updatedAt:number;errorCode:string|null;recoveryInvalidated:boolean};
type ReportFact = {kind:'node-report';targetId:string;bootId:string;sessionEpoch:number;reportSequence:number;snapshotGeneration:number;observedAt:number;receivedAt:number;credentialUntil:number};
type ForwardFact = {kind:'forward';id:string;revision:number;enabled:boolean;deleting:boolean;recoverySuspended:boolean;operation:OperationFact|null};
type NodeFact = {kind:'node';id:string;revoked:boolean;credentialUntil:number|null;report:ReportFact|null;invalidReport:boolean};
type ResourceEvidence = {kind:'resource-limit';targetId:string;actorId:string;bucketId:string;policyRevision:number;
    startsAt:number;endsAt:number;byteLimit:string|null;usedBytes:string|null;receivedAt:number|null;usageStatus:'unknown'|'stale'|'policy-outdated'|'fresh'};
type PathEvidence = {kind:'path-probe';targetId:string;forwardRevision:number;bindingDigest:string;probeId:string;
    measurement:'tcp-path-echo-v1'|'udp-path-echo-v1';status:'echoed'|'unverified'|'unreachable';elapsedMs:number;measuredAt:number;acceptedAt:number;validUntil:number};
type ProductForwardFact = ForwardFact & {pathSample?:PathEvidence|null};
type ProductNodeFact = NodeFact & {resource?:ResourceEvidence|null};
export type DiagnosticStationCompleteDeclarations38 = [
    Same<Equal<Station.StationAlertRule,'forward-operation-failed'|'node-report-stale'|'node-credential-expiring'|'shared-usage-high'|'shared-period-ending'|'recent-path-probe-degraded'>>,
    Same<Equal<Station.StationAlertConfig,{schemaVersion:1;rule:'forward-operation-failed'|'node-report-stale'|'node-credential-expiring';target:{kind:'forward'|'node';id:string};enabled:boolean;thresholdSeconds:number}|
        {schemaVersion:2;rule:'shared-usage-high'|'shared-period-ending';target:{kind:'node';id:string};enabled:boolean;thresholdSeconds:number;subjectActorId:string;thresholdPercent:number|null}|
        {schemaVersion:3;rule:'recent-path-probe-degraded';target:{kind:'forward';id:string};enabled:boolean;thresholdSeconds:0;measurement:'tcp-path-echo-v1'|'udp-path-echo-v1';maxSampleAgeSeconds:number;maxElapsedMs:number}>>,
    Same<Equal<Station.StationAlertReason,'operation-failed'|'deployment-succeeded'|'deployment-succeeded-after-failure'|'operation-in-progress'|'administrative-state'|'target-unavailable'|'recovery-suspended'|'evidence-unavailable'|'evidence-invalid'|'clock-regression'|'clock-uncertain'|'report-stale'|'report-fresh'|'fresh-baseline-required'|'instance-changed'|'credential-expiring'|'credential-expired'|'credential-valid'|'credential-renewed'|'recovery-not-proven'|
        'usage-high'|'usage-below-threshold'|'usage-unknown'|'period-ending'|'period-ended'|'period-valid'|'period-changed'|
        'path-sample-failed'|'path-sample-slow'|'path-sample-within-threshold'|'path-sample-stale'|'path-binding-changed'>>,
    Same<Equal<Station.StationCredentialEvidence,{kind:'node-credential';targetId:string;credentialUntil:number}>>,
    Same<Equal<Station.StationUnavailableEvidence,{kind:'unavailable';targetId:string}>>,
    Same<Equal<Station.StationAlertEvidence,OperationFact|ReportFact|{kind:'node-credential';targetId:string;credentialUntil:number}|{kind:'unavailable';targetId:string}|ResourceEvidence|PathEvidence>>,
    Same<Equal<Station.StationAlertEvaluation,{status:'clear'|'firing'|'unknown';reason:Station.StationAlertReason;instanceKey:string|null;evidence:Station.StationAlertEvidence}>>,
    Same<Equal<Station.StationAlertState,{
        condition:'unknown'|'clear'|'firing';episode:number;instanceKey:string|null;armed:boolean;openedAt:number|null;
        opening:Station.StationAlertEvidence|null;lastFiring:Station.StationAlertEvidence|null;last:Station.StationAlertEvaluation|null;evaluatedAt:number|null;
    }>>,
    Same<Equal<F.DiagnosticStoragePage<number>,Page<number>>>,Same<Equal<Diagnostics.DiagnosticPage<string>,Page<string>>>,
    Same<Equal<F.DiagnosticStorageForward,DiagnosticForward>>,Same<Equal<Diagnostics.DiagnosticForward,DiagnosticForward>>,
    Same<Equal<F.DiagnosticStorageOperation,DiagnosticOperation>>,Same<Equal<Diagnostics.DiagnosticOperation,DiagnosticOperation>>,
    Same<Equal<F.DiagnosticStorageNode,DiagnosticNode>>,Same<Equal<Diagnostics.DiagnosticNode,DiagnosticNode>>,
    Same<Equal<F.DiagnosticStorageReportContext,ReportContext>>,Same<Equal<Diagnostics.DiagnosticReportContext,ReportContext>>,
    Same<Equal<F.DiagnosticStorageObservation,DiagnosticObservation>>,Same<Equal<Diagnostics.DiagnosticObservation,DiagnosticObservation>>,
    Same<Equal<F.DiagnosticStorageDrain,DiagnosticDrain>>,Same<Equal<Diagnostics.DiagnosticDrain,DiagnosticDrain>>,
    Same<Equal<F.DiagnosticStorageAssignment,DiagnosticAssignment>>,Same<Equal<Diagnostics.DiagnosticAssignment,DiagnosticAssignment>>,
    Same<Equal<F.DiagnosticStorageDeployment,DiagnosticDeployment>>,Same<Equal<Diagnostics.DiagnosticDeployment,DiagnosticDeployment>>,
    Same<Equal<F.DiagnosticStorageSlot,DiagnosticSlot>>,Same<Equal<Diagnostics.DiagnosticSlot,DiagnosticSlot>>,
    Same<Equal<F.DiagnosticStorageRetirement,DiagnosticRetirement>>,Same<Equal<Diagnostics.DiagnosticRetirement,DiagnosticRetirement>>,
    Same<Equal<F.DiagnosticStorageLease,DiagnosticLease>>,Same<Equal<Diagnostics.DiagnosticLease,DiagnosticLease>>,
    Same<Equal<F.DiagnosticStorageProbe,DiagnosticProbe>>,Same<Equal<Diagnostics.DiagnosticProbe,DiagnosticProbe>>,
    Same<Equal<F.ForwardDiagnosticStorage<Tx>,DiagnosticStore>>,Same<Equal<Diagnostics.ForwardDiagnosticReadPort<Tx>,DiagnosticStore>>,
    Same<Equal<Mutable<TargetEndpoint>,never>>,Same<Equal<Mutable<Diagnostics.DiagnosticAssignment>,keyof DiagnosticAssignment>>,
    Same<Equal<F.StationStorageConfig,StationConfig>>,Same<Equal<F.StationPolicyRecord,StationPolicy>>,
    Same<Equal<F.StationPolicyAuditRecord,StationAudit>>,Same<Equal<F.StationEventRecord,StationEvent>>,
    Same<Equal<F.StationStorageEventQuery,StationQuery>>,Same<Equal<F.StationStorageLosses,StationLosses>>,
    Same<Equal<Station.StationAlertPolicy,StationPolicy<Station.StationAlertConfig,Station.StationAlertState,'none'|'recovery'|'actor-not-authorized'>>>,
    Same<Equal<Station.StationAlertPolicyAudit,StationAudit<'publish'|'silence'|'acknowledge'>>>,
    Same<Equal<Station.StationAlertEvent,StationEvent<Station.StationAlertConfig,'firing'|'recovered'|'invalidated',Station.StationAlertReason,Station.StationAlertEvidence>>>,
    Same<Equal<Station.StationEventQuery,StationQuery<Station.StationAlertRule,'firing'|'recovered'|'invalidated'>>>,
    Same<Equal<Station.StationAlertStore<Tx>,StationStore<Station.StationAlertPolicy,Station.StationAlertPolicyAudit,Station.StationAlertEvent>>>,
    Same<Equal<F.StationAlertStorage<Tx,F.StationPolicyRecord,F.StationPolicyAuditRecord,F.StationEventRecord>,StationStore<F.StationPolicyRecord,F.StationPolicyAuditRecord,F.StationEventRecord>>>,
    Same<Equal<F.StationOperationFactRecord,OperationFact>>,Same<Equal<Station.StationOperationEvidence,OperationFact>>,
    Same<Equal<F.StationReportFactRecord,ReportFact>>,Same<Equal<Station.StationReportEvidence,ReportFact>>,
    Same<Equal<F.StationForwardFactRecord,ForwardFact>>,Same<Equal<Flat<Station.StationAlertForwardFact>,Flat<ProductForwardFact>>>,
    Same<Equal<F.StationNodeFactRecord,NodeFact>>,Same<Equal<Flat<Station.StationAlertNodeFact>,Flat<ProductNodeFact>>>,
    Same<Equal<F.StationFactRecord,ForwardFact|NodeFact>>,Same<Equal<Flat<Station.StationAlertFact>,Flat<ProductForwardFact|ProductNodeFact>>>,
    Same<Equal<Station.StationAlertFacts<Tx>,{read(tx:Tx,scope:string,config:Station.StationAlertConfig,actor?:string):Promise<Station.StationAlertFact|null>}>>,
    Same<Equal<F.StationStorageValues<Station.StationAlertPolicy,Station.StationAlertPolicyAudit,Station.StationAlertEvent>,{
        readonly policy:(input:F.StationPolicyRecord)=>Station.StationAlertPolicy;readonly audit:(input:F.StationPolicyAuditRecord)=>Station.StationAlertPolicyAudit;readonly event:(input:F.StationEventRecord)=>Station.StationAlertEvent;
    }>>,
];

type TelemetryNode = {nodeId:string;scopeId:string;revoked:boolean;credentialUntil:number;sessionEpoch:number;bootId:string|null};
type TelemetryHead = {nodeId:string;scopeId:string;sessionEpoch:number;bootId:string;sampleEpoch:string;lastSequence:number;lastUptimeMs:number;lastDigest:string|null;lastReceivedAt:number;lastCapturedAt:number;droppedSamples:string};
type TelemetryPoint = {nodeId:string;scopeId:string;sessionEpoch:number;bootId:string;sampleEpoch:string;sequence:number;capturedAt:number;receivedAt:number;uptimeMs:number;body:unknown;digest:string;recoverySuspended:boolean};
type MappedHead = Flat<TelemetryHead&{acceptedPoints:number;rejectedPoints:number}>;
type TelemetryForward = {forwardId:string;scopeId:string;revision:number;deleting:boolean;recoverySuspended:boolean};
type PublishedMapping<I,S> = {identity:I;scopeId:string;source:S;publishedUntil:number;forwardRecoverySuspended:boolean};
type ProbeMapping<I> = Flat<PublishedMapping<I,'published-snapshot'>&{probeInstance:'current-registered'|'not-rechecked';instanceUntil:number|null}>;
type Accepted<P,M> = {index:number;point:P;mapping:M};
type MappedRecord<S> = {
    nodeId:string;scopeId:string;forwardId:string;sessionEpoch:number;bootId:string;sampleEpoch:string;sequence:number;itemIndex:number;
    receivedAt:number;capturedAt:number;sampleCapturedAt:number;uptimeMs:number;identityDigest:string;counterEpoch:string|null;
    point:unknown;exporter:unknown;digest:string;mappingSource:S;publishedUntil:number;recoverySuspended:boolean;
};
type RawStore<S> = {
    node(tx:Tx,nodeId:string):Promise<TelemetryNode|null>;lockHead(tx:Tx,scopeId:string,sample:S):Promise<TelemetryHead>;
    append(tx:Tx,scopeId:string,sample:S,hash:string,receivedAt:number):Promise<void>;
    history(tx:Tx,scopeId:string,nodeId:string,from:number,to:number,limit:number):Promise<TelemetryPoint[]>;
    latest(tx:Tx,scopeId:string,nodeId:string,from:number):Promise<TelemetryPoint[]>;prune(tx:Tx,before:number):Promise<number>;
};
type MappedStore<S,A,R> = {
    node(tx:Tx,nodeId:string):Promise<TelemetryNode|null>;nodes(tx:Tx,nodeIds:readonly string[]):Promise<TelemetryNode[]>;
    forward(tx:Tx,scopeId:string,forwardId:string):Promise<TelemetryForward|null>;lockHead(tx:Tx,scopeId:string,sample:S):Promise<F.TelemetryStoredMappedHead>;
    append(tx:Tx,scopeId:string,sample:S,accepted:readonly A[],hash:string,receivedAt:number):Promise<void>;
    history(tx:Tx,scopeId:string,forwardId:string,from:number,to:number,limit:number):Promise<R[]>;
    latest(tx:Tx,scopeId:string,forwardId:string,from:number):Promise<R[]>;prune(tx:Tx,before:number):Promise<number>;
};
type Family = 'process'|'host'|'forward'|'probe';
type Resolution = 'minute'|'hour';
type RollupObservation = {scopeId:string;nodeId:string;forwardId:string|null;family:Family;seriesKey:string;receivedAt:number};
type RollupBucket = {scopeId:string;nodeId:string;forwardId:string|null;family:Family;resolution:Resolution;start:number;seriesKey:string};
type RollupAfter = {start:number;nodeId:string;seriesKey:string};
type RollupWindow = {scopeId:string;family:Family;resolution:Resolution;kind:'node'|'forward';targetId:string;from:number;to:number;limit:number;seriesKey:string|null;after:RollupAfter|null};
type RollupLosses = {minuteEvicted:string;hourEvicted:string;cursorEvicted:string;cursorExpired:string};
type RollupCounts = {minuteRows:number;hourRows:number;cursorRows:number;nodeFamilies:number};
type RollupLimits = {
    readonly minuteSeconds:number;readonly hourSeconds:number;readonly cursorSeconds:number;readonly maxMinuteRowsPerNodeFamily:number;
    readonly maxHourRowsPerNodeFamily:number;readonly maxCursorRowsPerNodeFamily:number;readonly maxMinuteRowsPerScope:number;
    readonly maxHourRowsPerScope:number;readonly maxCursorRowsPerScope:number;readonly maxNodeFamiliesPerScope:number;
    readonly maxBucketBytes:number;readonly maxCursorBytes:number;readonly maxQueryPoints:number;
};
type RollupStore<O,B> = {
    append(tx:Tx,observations:readonly O[]):Promise<void>;history(tx:Tx,window:RollupWindow):Promise<{body:B;recoverySuspended:boolean}[]>;
    losses(tx:Tx,scopeId:string,family:Family,nodeId:string|null):Promise<RollupLosses>;capacity(tx:Tx,scopeId:string):Promise<RollupCounts>;prune(tx:Tx,now:number):Promise<number>;
};
type Stats = {count:number;sum:string;min:string;max:string;elapsedMs:number};
type Cumulative = {count:number;first:string;last:string;min:string;max:string};
type Series = {family:Family;nodeId:string;bootId:string;sessionEpoch:number;sampleEpoch:string;counterEpoch:string|null;execution:N.ForwardTelemetryPoint['identity']|N.ProbeTelemetryIdentity|null};
type Observation = RollupObservation & {
    series:Series;sequence:number;uptimeMs:number;capturedAt:number;state:'current'|'draining'|'terminal';available:boolean;overflowed:boolean;
    counterContext:string;droppedSamples:string;tailsEvicted:string;tailsExpired:string;truncated:boolean;gauges:Record<string,string>;counters:Record<string,string>;
};
type Bucket = RollupBucket & {
    telemetryAggregateVersion:1;series:Series;end:number;sampleCount:number;receivedFrom:number;receivedTo:number;capturedFrom:number;capturedTo:number;
    quality:{baseline:number;continuous:number;gap:number;counterReset:number;unavailable:number;overflowed:number;terminal:number;truncated:number;exporterDropsMax:string;tailsEvictedMax:string;tailsExpiredMax:string;historyComplete:false};
    coverage:{intervalCount:number;elapsedMs:number;from:number|null;to:number|null;boundaryIntervals:number;attribution:'receipt-interval-end'};
    gauges:Record<string,Stats>;cumulative:Record<string,Cumulative>;increments:Record<string,Stats>;
};
export type TelemetryCompleteDeclarations39 = [
    Same<Equal<Telemetry.TelemetryFamily,Family>>,Same<Equal<Telemetry.TelemetryResolution,Resolution>>,
    Same<Equal<Telemetry.TelemetryRollupAfter,RollupAfter>>,Same<Equal<Telemetry.TelemetryRollupWindow,RollupWindow>>,
    Same<Equal<Telemetry.TelemetryRollupLosses,RollupLosses>>,Same<Equal<Telemetry.TelemetryRollupCounts,RollupCounts>>,
    Same<Equal<Telemetry.TelemetryRollupRecorder<Tx>,{append(tx:Tx,observations:readonly Telemetry.TelemetryObservation[]):Promise<void>}>>,
    Same<Equal<Telemetry.ForwardTelemetryExport,Pick<N.ForwardTelemetrySample,'sampleEpoch'|'sequence'|'capturedAt'|'uptimeMs'|'snapshotGeneration'|'droppedSamples'|'coverage'>>>,
    Same<Equal<Telemetry.ProbeTelemetryExport,Pick<N.ProbeTelemetrySample,'sampleEpoch'|'sequence'|'capturedAt'|'uptimeMs'|'droppedSamples'|'coverage'>>>,
    Same<Equal<F.TelemetryStoredNode,TelemetryNode>>,Same<Equal<Telemetry.TelemetryNode,TelemetryNode>>,
    Same<Equal<F.TelemetryStoredHead,TelemetryHead>>,Same<Equal<Telemetry.TelemetryHead,TelemetryHead>>,
    Same<Equal<F.TelemetryStoredPoint,TelemetryPoint>>,Same<Equal<Telemetry.TelemetryPoint,TelemetryPoint>>,
    Same<Equal<Flat<F.TelemetryStoredMappedHead>,MappedHead>>,Same<Equal<Flat<Telemetry.ForwardTelemetryHead>,MappedHead>>,
    Same<Equal<Flat<Telemetry.ProbeTelemetryHead>,MappedHead>>,Same<Equal<F.TelemetryStoredForward,TelemetryForward>>,
    Same<Equal<Telemetry.ForwardTelemetryForward,TelemetryForward>>,Same<Equal<Telemetry.ProbeTelemetryForward,TelemetryForward>>,
    Same<Equal<F.TelemetryStorage<Tx,{readonly family:'custom'}>,RawStore<{readonly family:'custom'}>>>,
    Same<Equal<Telemetry.TelemetryStore<Tx>,RawStore<N.NodeTelemetrySample>>>,Same<Equal<Telemetry.HostTelemetryStore<Tx>,RawStore<N.HostTelemetrySample>>>,
    Same<Equal<Telemetry.ForwardTelemetryMapping,PublishedMapping<N.ForwardTelemetryPoint['identity'],'current-published'|'retired-published'>>>,
    Same<Equal<Flat<Telemetry.ProbeTelemetryMapping>,ProbeMapping<N.ProbeTelemetryPoint['identity']>>>,
    Same<Equal<Telemetry.ForwardTelemetryAccepted,Accepted<N.ForwardTelemetryPoint,Telemetry.ForwardTelemetryMapping>>>,
    Same<Equal<Telemetry.ProbeTelemetryAccepted,Accepted<N.ProbeTelemetryPoint,Telemetry.ProbeTelemetryMapping>>>,
    Same<Equal<Telemetry.ForwardTelemetryRecord,MappedRecord<'current-published'|'retired-published'>>>,
    Same<Equal<Flat<Telemetry.ProbeTelemetryRecord>,Flat<MappedRecord<'published-snapshot'>&{probeInstance:'current-registered'|'not-rechecked';instanceUntil:number|null}>>>,
    Same<Equal<Telemetry.ForwardTelemetryStore<Tx>,MappedStore<N.ForwardTelemetrySample,Telemetry.ForwardTelemetryAccepted,Telemetry.ForwardTelemetryRecord>>>,
    Same<Equal<Telemetry.ProbeTelemetryStore<Tx>,MappedStore<N.ProbeTelemetrySample,Telemetry.ProbeTelemetryAccepted,Telemetry.ProbeTelemetryRecord>>>,
    Same<Equal<Telemetry.ForwardTelemetryMappingPort<Tx>,{resolve(tx:Tx,node:{nodeId:string;bootId:string;sessionEpoch:number},points:readonly N.ForwardTelemetryPoint[]):Promise<readonly (Telemetry.ForwardTelemetryMapping|null)[]>}>>,
    Same<Equal<Telemetry.ProbeTelemetryMappingPort<Tx>,{resolve(tx:Tx,node:{nodeId:string;bootId:string;sessionEpoch:number;fingerprint:string},points:readonly N.ProbeTelemetryPoint[],observedAt:number):Promise<readonly (Telemetry.ProbeTelemetryMapping|null)[]>}>>,
    Same<Equal<F.TelemetryRollupStorageFamily,Family>>,Same<Equal<F.TelemetryRollupStorageResolution,Resolution>>,
    Same<Equal<F.TelemetryRollupObservationRecord,RollupObservation>>,Same<Equal<F.TelemetryRollupBucketRecord,RollupBucket>>,
    Same<Equal<F.TelemetryRollupStorageAfter,RollupAfter>>,Same<Equal<F.TelemetryRollupStorageWindow,RollupWindow>>,
    Same<Equal<F.TelemetryRollupStorageLosses,RollupLosses>>,Same<Equal<F.TelemetryRollupStorageCounts,RollupCounts>>,
    Same<Equal<F.TelemetryRollupStorageLimits,RollupLimits>>,Same<Equal<Mutable<F.TelemetryRollupStorageLimits>,never>>,
    Same<Equal<Telemetry.TelemetrySeries,Series>>,Same<Equal<Flat<Telemetry.TelemetryObservation>,Flat<Observation>>>,
    Same<Equal<Telemetry.TelemetryMetricStats,Stats>>,Same<Equal<Telemetry.TelemetryCumulativeStats,Cumulative>>,
    Same<Equal<Flat<Telemetry.TelemetryRollupBucket>,Flat<Bucket>>>,
    Same<Equal<Telemetry.TelemetryRollupRecord,{body:Telemetry.TelemetryRollupBucket;recoverySuspended:boolean}>>,
    Same<Equal<Telemetry.TelemetryRollupStore<Tx>,RollupStore<Telemetry.TelemetryObservation,Telemetry.TelemetryRollupBucket>>>,
    Same<Equal<F.TelemetryRollupStorage<Tx,{readonly family:'custom-observation'},{readonly family:'custom-bucket'}>,RollupStore<{readonly family:'custom-observation'},{readonly family:'custom-bucket'}>>>,
    Same<Equal<F.TelemetryRollupStorageValues<Telemetry.TelemetryObservation,Telemetry.TelemetryRollupBucket>,{
        readonly limits:RollupLimits;readonly observation:(input:unknown)=>Telemetry.TelemetryObservation;readonly bucket:(input:unknown)=>Telemetry.TelemetryRollupBucket;
        readonly fold:(bucket:Telemetry.TelemetryRollupBucket|null,before:Telemetry.TelemetryObservation|null,value:Telemetry.TelemetryObservation,resolution:Resolution)=>Telemetry.TelemetryRollupBucket;
    }>>,
    Same<Equal<Mutable<Telemetry.TelemetryObservation>,keyof Observation>>,Same<Equal<Optional<Telemetry.TelemetryObservation>,never>>,
];
