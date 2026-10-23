import type { CommandResponse, StationPolicyRecord, StationPolicyAuditRecord, StationEventRecord,
    StationStorageEventQuery, StationStorageLosses, StationAlertStorage, StationOperationFactRecord,
    StationReportFactRecord, StationForwardFactRecord, StationNodeFactRecord, StationFactsStorage } from '../../framework/public.ts';
import type { ProbePathObservation } from '../probe-history-owner/public.ts';

export type StationAlertRule = 'forward-operation-failed' | 'node-report-stale' | 'node-credential-expiring' |
    'shared-usage-high' | 'shared-period-ending' | 'recent-path-probe-degraded';
export type StationAlertConfig = {
    schemaVersion: 1; rule: 'forward-operation-failed'|'node-report-stale'|'node-credential-expiring';
    target: { kind: 'forward' | 'node'; id: string }; enabled: boolean; thresholdSeconds: number;
}|{
    schemaVersion:2;rule:'shared-usage-high'|'shared-period-ending';target:{kind:'node';id:string};
    enabled:boolean;thresholdSeconds:number;subjectActorId:string;thresholdPercent:number|null;
}|{
    schemaVersion:3;rule:'recent-path-probe-degraded';target:{kind:'forward';id:string};enabled:boolean;thresholdSeconds:0;
    measurement:'tcp-path-echo-v1'|'udp-path-echo-v1';maxSampleAgeSeconds:number;maxElapsedMs:number;
};
export interface StationOperationEvidence extends StationOperationFactRecord {}
export interface StationReportEvidence extends StationReportFactRecord {}
export interface StationCredentialEvidence { kind: 'node-credential'; targetId: string; credentialUntil: number }
export interface StationUnavailableEvidence { kind: 'unavailable'; targetId: string }
export interface StationResourceEvidence {
    kind:'resource-limit';targetId:string;actorId:string;bucketId:string;policyRevision:number;
    startsAt:number;endsAt:number;byteLimit:string|null;usedBytes:string|null;receivedAt:number|null;
    usageStatus:'unknown'|'stale'|'policy-outdated'|'fresh';
}
export interface StationPathEvidence extends ProbePathObservation {kind:'path-probe'}
export type StationAlertEvidence = StationOperationEvidence | StationReportEvidence | StationCredentialEvidence | StationUnavailableEvidence | StationResourceEvidence | StationPathEvidence;
export type StationAlertReason = 'operation-failed' | 'deployment-succeeded' | 'deployment-succeeded-after-failure' | 'operation-in-progress' | 'administrative-state' |
    'target-unavailable' | 'recovery-suspended' | 'evidence-unavailable' | 'evidence-invalid' | 'clock-regression' | 'clock-uncertain' |
    'report-stale' | 'report-fresh' | 'fresh-baseline-required' | 'instance-changed' | 'credential-expiring' | 'credential-expired' |
    'credential-valid' | 'credential-renewed' | 'recovery-not-proven' | 'usage-high' | 'usage-below-threshold' |
    'usage-unknown' | 'period-ending' | 'period-ended' | 'period-valid' | 'period-changed' |
    'path-sample-failed' | 'path-sample-slow' | 'path-sample-within-threshold' | 'path-sample-stale' | 'path-binding-changed';
export interface StationAlertEvaluation {
    status: 'clear' | 'firing' | 'unknown'; reason: StationAlertReason; instanceKey: string | null; evidence: StationAlertEvidence;
}
export interface StationAlertState {
    condition: 'unknown' | 'clear' | 'firing'; episode: number; instanceKey: string | null; armed: boolean;
    openedAt: number | null; opening: StationAlertEvidence | null; lastFiring: StationAlertEvidence | null;
    last: StationAlertEvaluation | null; evaluatedAt: number | null;
}
export interface StationAlertPolicy extends StationPolicyRecord<StationAlertConfig,StationAlertState,'none'|'recovery'|'actor-not-authorized'> {}
export interface StationAlertPolicyAudit extends StationPolicyAuditRecord<'publish'|'silence'|'acknowledge'> {}
export interface StationAlertEvent extends StationEventRecord<StationAlertConfig,'firing'|'recovered'|'invalidated',StationAlertReason,StationAlertEvidence> {}
export interface StationAlertForwardFact extends StationForwardFactRecord {pathSample?:StationPathEvidence|null}
export interface StationAlertNodeFact extends StationNodeFactRecord {resource?:StationResourceEvidence|null}
export type StationAlertFact = StationAlertForwardFact | StationAlertNodeFact;
export interface StationAlertFacts<Tx> extends StationFactsStorage<Tx,StationAlertConfig> {
    read(tx:Tx,scope:string,config:StationAlertConfig,actor?:string):Promise<StationAlertFact|null>;
}
export interface StationEventQuery extends StationStorageEventQuery<StationAlertRule,StationAlertEvent['kind']> {}
export interface StationAlertLosses extends StationStorageLosses {}
export interface StationAlertStore<Tx> extends StationAlertStorage<Tx,StationAlertPolicy,StationAlertPolicyAudit,StationAlertEvent> {}
export type StationAlertCommandResponse = CommandResponse & { body: { policyId?: string; eventId?: string; revision: number; changed: boolean } };
