import { parseProbeDelivery } from '@tunex/contracts';
import type { ProbePollRequest, ProbePollResponse, ProbeStatusRequest, ProbeStatusResponse } from '@tunex/contracts';
import { ControlError } from './errors.ts';
import type { ProbePermits } from './probe-permits.ts';

/** Closed read-only machine adapter. Only the existing permit owner decides current authority. */
export class ProbeDelivery<Tx> {
    private readonly permits: Pick<ProbePermits<Tx>, 'offer' | 'check'>;
    private readonly clock: () => number;
    constructor(permits: Pick<ProbePermits<Tx>, 'offer' | 'check'>, clock: () => number = Date.now) {
        this.permits = permits; this.clock = clock;
    }
    private identity(node: string, epoch: number, request: ProbePollRequest | ProbeStatusRequest): void {
        if (request.nodeId !== node || request.sessionEpoch !== epoch)
            throw new ControlError('SESSION_SUPERSEDED', 409, 'Probe delivery Node/session differs');
    }
    private fresh(observed: number): number {
        const now = this.clock();
        if (!Number.isSafeInteger(observed) || !Number.isSafeInteger(now) || observed < 0 || now < observed ||
            now - observed > 250 || now > 8640000000000000)
            throw new ControlError('PROBE_PERMIT_UNAVAILABLE', 409, 'Probe observation no longer fresh');
        return now;
    }
    async poll(node: string, fingerprint: string, epoch: number, input: ProbePollRequest): Promise<ProbePollResponse> {
        const request = parseProbeDelivery('PollRequest', JSON.stringify(input));
        this.identity(node, epoch, request);
        const result = await this.permits.offer(node, fingerprint, epoch, { bootId: request.bootId,
            instanceId: request.instanceId, instanceGeneration: request.instanceGeneration });
        const now = this.fresh(result.observedAt), offer = result.offer;
        if (result.executionEnabled !== false || offer !== null && (typeof offer !== 'object' || Array.isArray(offer) ||
            offer.instanceId !== request.instanceId || offer.instanceGeneration !== request.instanceGeneration || offer.expiresAt <= now))
            throw new ControlError('PROBE_PERMIT_UNAVAILABLE', 409, 'Probe offer differs or expired');
        return parseProbeDelivery('PollResponse', JSON.stringify({ ...request, kind: 'probe-poll-ack',
            observedAt: new Date(result.observedAt).toISOString(), serverTime: new Date(now).toISOString(), executionEnabled: false,
            offer: offer ? { permitId: offer.permitId, binding: offer.binding, timeoutMs: offer.timeoutMs,
                issuedAt: new Date(offer.issuedAt).toISOString(), expiresAt: new Date(offer.expiresAt).toISOString() } : null }));
    }
    async status(node: string, fingerprint: string, epoch: number, input: ProbeStatusRequest): Promise<ProbeStatusResponse> {
        const request = parseProbeDelivery('StatusRequest', JSON.stringify(input));
        this.identity(node, epoch, request);
        const result = await this.permits.check(node, fingerprint, epoch, { permitId: request.permitId, bootId: request.bootId,
            instanceId: request.instanceId, instanceGeneration: request.instanceGeneration });
        const now = this.fresh(result.checkedAt);
        if (result.id !== request.permitId || result.instanceId !== request.instanceId || result.instanceGeneration !== request.instanceGeneration ||
            result.executionEnabled !== false || result.state !== 'consumed' || result.closedAt === null || result.expiresAt <= now)
            throw new ControlError('PROBE_PERMIT_UNAVAILABLE', 409, 'Probe status differs or expired');
        // Owner transaction has committed. This observation cannot authorize continued work after that transaction.
        return parseProbeDelivery('StatusResponse', JSON.stringify({ ...request, kind: 'probe-status-ack', binding: result.binding,
            timeoutMs: result.timeoutMs, issuedAt: new Date(result.issuedAt).toISOString(), expiresAt: new Date(result.expiresAt).toISOString(),
            consumedAt: new Date(result.closedAt).toISOString(), checkedAt: new Date(result.checkedAt).toISOString(),
            serverTime: new Date(now).toISOString(), state: 'consumed', executionEnabled: false }));
    }
}
