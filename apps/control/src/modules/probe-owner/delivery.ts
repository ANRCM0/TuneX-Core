import { parseProbeDelivery, nativeJsonEncode, nativeProbePollAck, nativeProbeStatusAck, nativeWallClockSource } from '../../compatibility/public.ts';
import type { ProbePollRequest, ProbePollResponse, ProbeStatusRequest, ProbeStatusResponse } from '../../compatibility/public.ts';
import { ControlError } from '../../framework/public.ts';
import type { ProbePermitOwner } from './owner-contracts.ts';
import type { ProbeDeliveryApi } from './machine-api.ts';

/** Closed read-only machine adapter. Only the existing permit owner decides current authority. */
export class ProbeDelivery<Tx> implements ProbeDeliveryApi {
    private readonly permits: Pick<ProbePermitOwner<Tx>, 'offer' | 'check'>;
    private readonly clock: () => number;
    constructor(permits: Pick<ProbePermitOwner<Tx>, 'offer' | 'check'>, clock: () => number = nativeWallClockSource()) {
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
        const request = parseProbeDelivery('PollRequest', nativeJsonEncode(input));
        this.identity(node, epoch, request);
        const result = await this.permits.offer(node, fingerprint, epoch, { bootId: request.bootId,
            instanceId: request.instanceId, instanceGeneration: request.instanceGeneration });
        const now = this.fresh(result.observedAt), offer = result.offer;
        if (result.executionEnabled !== false || offer !== null && (typeof offer !== 'object' || Array.isArray(offer) ||
            offer.instanceId !== request.instanceId || offer.instanceGeneration !== request.instanceGeneration || offer.expiresAt <= now))
            throw new ControlError('PROBE_PERMIT_UNAVAILABLE', 409, 'Probe offer differs or expired');
        return nativeProbePollAck(request,result.observedAt,now,offer);
    }
    async status(node: string, fingerprint: string, epoch: number, input: ProbeStatusRequest): Promise<ProbeStatusResponse> {
        const request = parseProbeDelivery('StatusRequest', nativeJsonEncode(input));
        this.identity(node, epoch, request);
        const result = await this.permits.check(node, fingerprint, epoch, { permitId: request.permitId, bootId: request.bootId,
            instanceId: request.instanceId, instanceGeneration: request.instanceGeneration });
        const now = this.fresh(result.checkedAt);
        if (result.id !== request.permitId || result.instanceId !== request.instanceId || result.instanceGeneration !== request.instanceGeneration ||
            result.executionEnabled !== false || result.state !== 'consumed' || result.closedAt === null || result.expiresAt <= now)
            throw new ControlError('PROBE_PERMIT_UNAVAILABLE', 409, 'Probe status differs or expired');
        // Owner transaction has committed. This observation cannot authorize continued work after that transaction.
        return nativeProbeStatusAck(request,result,now);
    }
}
