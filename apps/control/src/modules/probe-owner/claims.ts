import { parseProbeClaim, nativeJsonEncode, nativeProbeClaimAck, nativeWallClockSource } from '../../compatibility/public.ts';
import type { ProbeClaimRequest, ProbeClaimResponse } from '../../compatibility/public.ts';
import { ControlError } from '../../framework/public.ts';
import type { ProbePermitOwner } from './owner-contracts.ts';
import type { ProbeClaimApi } from './machine-api.ts';

/** Closed machine adapter. Authentication comes from the actual mTLS connection, not its body. */
export class ProbeClaims<Tx> implements ProbeClaimApi {
    private readonly permits: Pick<ProbePermitOwner<Tx>, 'consume'>;
    constructor(permits: Pick<ProbePermitOwner<Tx>, 'consume'>) { this.permits = permits; }
    async handle(node: string, fingerprint: string, epoch: number, input: ProbeClaimRequest): Promise<ProbeClaimResponse> {
        const request = parseProbeClaim('Request', nativeJsonEncode(input));
        if (request.nodeId !== node || request.sessionEpoch !== epoch)
            throw new ControlError('SESSION_SUPERSEDED', 409, 'Probe claim Node/session differs');
        const result = await this.permits.consume(node, fingerprint, epoch, { permitId: request.permitId,
            bootId: request.bootId, instanceId: request.instanceId, instanceGeneration: request.instanceGeneration });
        // The owner has committed before an acknowledgement is constructed. Lost/late replies stay spent.
        const now = nativeWallClockSource()();
        if (result.id !== request.permitId || result.instanceId !== request.instanceId ||
            result.instanceGeneration !== request.instanceGeneration || result.binding.nodeId !== node ||
            result.binding.bootId !== request.bootId || result.binding.sessionEpoch !== epoch ||
            result.state !== 'consumed' || result.closedAt === null || now < result.closedAt || now >= result.expiresAt)
            throw new ControlError('PROBE_PERMIT_UNAVAILABLE', 409, 'Probe claim receipt no longer fresh');
        return nativeProbeClaimAck(request,result,now);
    }
}
