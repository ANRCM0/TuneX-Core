import type { ProbeBinding, ForwardProbePlan } from './probe-ports.ts';
import type { ProbeInstanceRecord } from './probe-instance-ports.ts';
import type { ProbeResultStore } from './probe-result-ports.ts';

export interface ProbePermitRecord {
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
/** Must lock the existing slot against replacement/revocation until transaction end. */
export interface CurrentProbeInstances<Tx> {
    readCurrent(tx: Tx, nodeId: string): Promise<ProbeInstanceRecord | undefined>;
}
/** Every mutation uses one caller-owned transaction and the shared budget lock first. */
export interface ProbePermitStore<Tx> extends ProbeResultStore<Tx> {
    lock(tx: Tx): Promise<{ observedAt: number; records: readonly ProbePermitRecord[];
        withdrawals: readonly { permitId: string; withdrawnAt: number }[] }>;
    clock(tx: Tx, now: number): Promise<void>;
    prune(tx: Tx, expiredBefore: number): Promise<void>;
    insert(tx: Tx, permit: ProbePermitRecord): Promise<void>;
    close(tx: Tx, id: string, state: 'consumed' | 'revoked', at: number): Promise<void>;
    withdraw(tx: Tx, id: string, at: number): Promise<void>;
}
