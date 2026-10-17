import { parseProbeClaim } from '@tunex/contracts';
import type { ProbeClaimRequest, ProbeClaimResponse } from '@tunex/contracts';
import { ControlError } from './errors.ts';
import type { ProbePermits } from './probe-permits.ts';

/** Closed machine adapter. Authentication comes from the actual mTLS connection, not its body. */
export class ProbeClaims<Tx> {
    private readonly permits: Pick<ProbePermits<Tx>, 'consume'>;
    constructor(permits: Pick<ProbePermits<Tx>, 'consume'>) { this.permits = permits; }
    async handle(node: string, fingerprint: string, epoch: number, input: ProbeClaimRequest): Promise<ProbeClaimResponse> {
        const request = parseProbeClaim('Request', JSON.stringify(input));
        if (request.nodeId !== node || request.sessionEpoch !== epoch)
            throw new ControlError('SESSION_SUPERSEDED', 409, 'Probe claim Node/session differs');
        const result = await this.permits.consume(node, fingerprint, epoch, { permitId: request.permitId,
            bootId: request.bootId, instanceId: request.instanceId, instanceGeneration: request.instanceGeneration });
        // The owner has committed before an acknowledgement is constructed. Lost/late replies stay spent.
        const now = Date.now();
        if (result.id !== request.permitId || result.instanceId !== request.instanceId ||
            result.instanceGeneration !== request.instanceGeneration || result.binding.nodeId !== node ||
            result.binding.bootId !== request.bootId || result.binding.sessionEpoch !== epoch ||
            result.state !== 'consumed' || result.closedAt === null || now < result.closedAt || now >= result.expiresAt)
            throw new ControlError('PROBE_PERMIT_UNAVAILABLE', 409, 'Probe claim receipt no longer fresh');
        return parseProbeClaim('Response', JSON.stringify({ ...request, kind: 'probe-claim-ack',
            binding: result.binding, timeoutMs: result.timeoutMs, issuedAt: new Date(result.issuedAt).toISOString(),
            expiresAt: new Date(result.expiresAt).toISOString(), consumedAt: new Date(result.closedAt).toISOString(),
            serverTime: new Date(now).toISOString(), state: 'consumed', executionEnabled: false }));
    }
}
