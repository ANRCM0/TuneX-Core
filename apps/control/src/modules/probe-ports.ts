import type { Forward } from '@tunex/core';
import type { RuntimeSnapshot } from '@tunex/contracts';
import type { AuthorizedNodeFacts } from './node-management-ports.ts';

export interface ProbeIntents<Tx> {
    record(tx: Tx, scopeId: string, id: string): Promise<Forward & { deleting: boolean; recoverySuspended: boolean }>;
}
export interface ProbeNodes<Tx> {
    authorized(tx: Tx, actor: string, forward: Forward): Promise<AuthorizedNodeFacts>;
}
export interface PublishedProbeSnapshot {
    readonly bootId: string | null;
    readonly sessionEpoch: number;
    readonly credentialUntil: number;
    readonly snapshot: RuntimeSnapshot;
}
/** Deliberate read projection, never a Snapshot publisher or execution authority issuer. */
export interface PublishedProbeReader<Tx> {
    read(tx: Tx, scopeId: string, nodeId: string): Promise<PublishedProbeSnapshot | undefined>;
}
export interface ProbeBinding {
    readonly nodeId: string;
    readonly bootId: string;
    readonly sessionEpoch: number;
    readonly snapshotGeneration: number;
    readonly assignmentId: string;
    readonly forwardId: string;
    readonly forwardRevision: number;
    readonly deploymentGeneration: number;
    readonly bindingFence: number;
    readonly configDigest: string;
    readonly egressPolicyRevision: number;
}
export interface ForwardProbePlan {
    readonly version: 1;
    readonly kind: 'tcp-connect';
    readonly executable: false;
    readonly dispatch: 'not-implemented';
    readonly point: 'agent-direct-egress';
    readonly independentProbe: false;
    readonly health: 'unknown';
    readonly scopeId: string;
    readonly binding: ProbeBinding;
    readonly timeoutMs: number;
    readonly maxAttempts: 1;
    readonly applicationPayloadBytes: 0;
    readonly plannedAt: string;
    readonly expiresAt: string;
}
