import type { ProbeBinding, ForwardProbePlan } from './plan-contracts.ts';
export type { CurrentProbeInstances } from './instance-contracts.ts';
import type { ProbeResultRecord } from './result-contracts.ts';
import type { ProbePermitStorage } from '../../framework/public.ts';
import type { ProbeServiceContext } from '../../compatibility/public.ts';
import type { ProbeEchoServiceContext, ProbeEchoChallenge } from '../../compatibility/public.ts';

export interface ProbePermitRecord {
    /** Absence is the unchanged legacy egress measurement. */
    readonly measurement?: 'tcp-ingress-connect-v1' | 'tcp-ingress-tls-v1' | 'tcp-ingress-echo-v1' | 'udp-ingress-echo-v1';
    readonly serviceContext?: ProbeServiceContext | ProbeEchoServiceContext;
    readonly echoChallenge?: ProbeEchoChallenge;
    readonly id: string;
    readonly actorId: string;
    readonly scopeId: string;
    readonly binding: ProbeBinding;
    readonly instanceId: string;
    readonly instanceGeneration: number;
    readonly fingerprint: string;
    readonly timeoutMs: number;
    readonly issuedAt: number;
    readonly expiresAt: number;
    readonly state: 'issued' | 'consumed' | 'revoked' | 'quarantined';
    readonly closedAt: number | null;
}
export interface ProbePermitPlans<Tx> {
    /** Current authorization and intent/session/Snapshot facts must stay locked in this same transaction. */
    authorize(tx: Tx, actor: string, scope: string, forward: string, input: unknown): Promise<ForwardProbePlan>;
}
/** Every mutation uses one caller-owned transaction and the shared budget lock first. */
export interface ProbePermitStore<Tx> extends ProbePermitStorage<Tx,ProbePermitRecord,ProbeResultRecord> {}
