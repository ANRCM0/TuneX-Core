import type { ForwardProbePlan, ProbeBinding } from '../probe-owner/public.ts';
import type { AnyProbeAcceptance } from '../probe-owner/public.ts';
import type { ProbeServiceReference } from '../probe-owner/public.ts';
import type { ProbePlanStoredHead, ProbePlanStoredDecision, ProbePlanStoredFailure, ProbePlanStoredHeader,
    ProbePlanStoredLosses, ProbePlanStoredQuery, ProbePlanStorage } from '../../framework/public.ts';

export interface ProbePlanConfig {
    version: 1; kind: 'tcp-connect' | 'tcp-ingress-connect' | 'tcp-ingress-tls'; forwardId: string; expectedForwardRevision: number; timeoutMs: number;
    /** Present only for TLS; every run must resolve this exact current metadata/config revision again. */
    service?: ProbeServiceReference;
    mode: 'manual' | 'scheduled'; intervalSeconds: number | null; maxRuns: number; expiresAt: number;
}
export type ProbePlanState = 'active' | 'completed' | 'cancelled' | 'expired' | 'suspended';
export type ProbePlanCode = 'PERMIT_ACCEPTED' | 'PLAN_CANCELLED' | 'PLAN_EXPIRED' | 'AUTHORIZATION_REVOKED' | 'RECOVERY_SUSPENDED' |
    'PROBE_DISABLED' | 'PROBE_UNAVAILABLE' | 'PROBE_PERMIT_UNAVAILABLE' | 'PROBE_PERMIT_LIMIT' | 'AUTHORIZATION_DENIED' |
    'NOT_FOUND' | 'REVISION_CONFLICT' | 'UNSUPPORTED_CAPABILITY' | 'SESSION_SUPERSEDED';
export interface ProbePlanHead extends ProbePlanStoredHead<ProbePlanConfig,ProbeBinding,ProbePlanState,ProbePlanCode> {}
export interface ProbePlanFailure extends ProbePlanStoredFailure<ProbePlanCode,403|404|409|422|429> {}
export interface ProbePlanDecision extends ProbePlanStoredDecision<'manual'|'scheduled',{accepted:true;receipt:AnyProbeAcceptance}|{accepted:false;error:ProbePlanFailure}> {}
export interface ProbePlanHeader extends ProbePlanStoredHeader {}
export interface ProbePlanLosses extends ProbePlanStoredLosses {}
export interface ProbePlanQuery extends ProbePlanStoredQuery<ProbePlanState,ProbePlanConfig['mode']> {}
/** Original preflight/issuance owners, on the supplied transaction; no child idempotency or network. */
export interface ProbePlanIssuer<Tx> {
    previewIn(tx: Tx, actor: string, scope: string, config: ProbePlanConfig): Promise<ForwardProbePlan>;
    issueIn(tx: Tx, actor: string, scope: string, config: ProbePlanConfig): Promise<AnyProbeAcceptance>;
}
export interface ProbePlanStore<Tx> extends ProbePlanStorage<Tx,ProbePlanHead,ProbePlanDecision,ProbePlanFailure> {}
