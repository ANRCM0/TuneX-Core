import type { ForwardValue as Forward } from '../../framework/public.ts';
import type { AuthorizedNodeFacts, RuntimeForwards } from '../../framework/public.ts';
import type { NativePublishedRuntimeEvidence as PublishedRuntimeEvidence, NativePublishedRuntimeReader as PublishedRuntimeReader } from '../../compatibility/public.ts';
import type { ProbeServiceContext } from '../../compatibility/public.ts';
import type { ProbeEchoServiceContext } from '../../compatibility/public.ts';

export interface ProbeIntents<Tx> extends RuntimeForwards<Tx> {}
export interface ProbeNodes<Tx> {
    authorized(tx: Tx, actor: string, forward: Forward): Promise<AuthorizedNodeFacts>;
}
export interface PublishedProbeSnapshot extends PublishedRuntimeEvidence {}
/** Deliberate read projection, never a Snapshot publisher or execution authority issuer. */
export interface PublishedProbeReader<Tx> extends PublishedRuntimeReader<Tx,PublishedProbeSnapshot> {}
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
interface ForwardProbePlanFacts {
    readonly version: 1;
    readonly executable: false;
    readonly dispatch: 'not-implemented';
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
export type ForwardProbePlan = ForwardProbePlanFacts & (
    {readonly kind:'tcp-connect';readonly point:'agent-direct-egress'} |
    {readonly kind:'tcp-ingress-connect';readonly point:'agent-local-direct-ingress';readonly measurement:'tcp-ingress-connect-v1';readonly capability:'probe.tcp-ingress-connect.v1'} |
    {readonly kind:'tcp-ingress-tls';readonly point:'agent-local-direct-ingress';readonly measurement:'tcp-ingress-tls-v1';
        readonly capability:'probe.tcp-ingress-tls.v1';readonly serviceContext:ProbeServiceContext} |
    {readonly kind:'tcp-ingress-echo'|'udp-ingress-echo';readonly point:'agent-local-direct-ingress';
        readonly measurement:'tcp-ingress-echo-v1'|'udp-ingress-echo-v1';readonly capability:'probe.tcp-ingress-echo.v1'|'probe.udp-ingress-echo.v1';
        readonly businessProtocol:'tcp'|'udp';readonly serviceContext:ProbeEchoServiceContext}
);
