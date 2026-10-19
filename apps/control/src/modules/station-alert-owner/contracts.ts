import type { CommandResponse, StationPolicyRecord, StationPolicyAuditRecord, StationEventRecord,
    StationStorageEventQuery, StationStorageLosses, StationAlertStorage, StationOperationFactRecord,
    StationReportFactRecord, StationForwardFactRecord, StationNodeFactRecord, StationFactsStorage } from '../../framework/public.ts';

export type StationAlertRule = 'forward-operation-failed' | 'node-report-stale' | 'node-credential-expiring';
export interface StationAlertConfig {
    schemaVersion: 1; rule: StationAlertRule; target: { kind: 'forward' | 'node'; id: string }; enabled: boolean; thresholdSeconds: number;
}
export interface StationOperationEvidence extends StationOperationFactRecord {}
export interface StationReportEvidence extends StationReportFactRecord {}
export interface StationCredentialEvidence { kind: 'node-credential'; targetId: string; credentialUntil: number }
export interface StationUnavailableEvidence { kind: 'unavailable'; targetId: string }
export type StationAlertEvidence = StationOperationEvidence | StationReportEvidence | StationCredentialEvidence | StationUnavailableEvidence;
export type StationAlertReason = 'operation-failed' | 'deployment-succeeded' | 'deployment-succeeded-after-failure' | 'operation-in-progress' | 'administrative-state' |
    'target-unavailable' | 'recovery-suspended' | 'evidence-unavailable' | 'evidence-invalid' | 'clock-regression' | 'clock-uncertain' |
    'report-stale' | 'report-fresh' | 'fresh-baseline-required' | 'instance-changed' | 'credential-expiring' | 'credential-expired' |
    'credential-valid' | 'credential-renewed' | 'recovery-not-proven';
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
export interface StationAlertForwardFact extends StationForwardFactRecord {}
export interface StationAlertNodeFact extends StationNodeFactRecord {}
export type StationAlertFact = StationAlertForwardFact | StationAlertNodeFact;
export interface StationAlertFacts<Tx> extends StationFactsStorage<Tx,StationAlertConfig> {}
export interface StationEventQuery extends StationStorageEventQuery<StationAlertRule,StationAlertEvent['kind']> {}
export interface StationAlertLosses extends StationStorageLosses {}
export interface StationAlertStore<Tx> extends StationAlertStorage<Tx,StationAlertPolicy,StationAlertPolicyAudit,StationAlertEvent> {}
export type StationAlertCommandResponse = CommandResponse & { body: { policyId?: string; eventId?: string; revision: number; changed: boolean } };
