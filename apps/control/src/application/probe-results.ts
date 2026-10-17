import { parseProbeResult, checkProbeResult, probeResultDigest } from '@tunex/contracts';
import type { ProbeResultRequest, ProbeResultResponse } from '@tunex/contracts';
import { ControlError } from './errors.ts';
import type { ProbePermits } from './probe-permits.ts';

/** mTLS result adapter. The existing owner commits ingestion before any acknowledgement. */
export class ProbeResults<Tx> {
    private readonly permits: Pick<ProbePermits<Tx>, 'receiveResult'>;
    private readonly clock: () => number;
    constructor(permits: Pick<ProbePermits<Tx>, 'receiveResult'>, clock: () => number = Date.now) {
        this.permits = permits; this.clock = clock;
    }
    async handle(node: string, fingerprint: string, epoch: number, input: ProbeResultRequest): Promise<ProbeResultResponse> {
        const request = parseProbeResult('Request', JSON.stringify(input));
        if (request.nodeId !== node || request.sessionEpoch !== epoch)
            throw new ControlError('SESSION_SUPERSEDED', 409, 'Probe result Node/session differs');
        const result = await this.permits.receiveResult(node, fingerprint, epoch, request);
        const now = this.clock();
        if (!Number.isSafeInteger(now) || !Number.isSafeInteger(result.acceptedAt) || !Number.isSafeInteger(result.checkedAt) ||
            result.acceptedAt < 0 || result.checkedAt < result.acceptedAt || now < result.checkedAt || now - result.checkedAt > 250 ||
            now >= Date.parse(request.validUntil) || result.resultDigest !== probeResultDigest(request) ||
            typeof result.duplicate !== 'boolean')
            throw new ControlError('PROBE_PERMIT_UNAVAILABLE', 409, 'Probe result acknowledgement no longer fresh');
        const response = parseProbeResult('Response', JSON.stringify({ protocolVersion: 3, probeVersion: 1, kind: 'probe-result-ack',
            nodeId: request.nodeId, bootId: request.bootId, sessionEpoch: request.sessionEpoch, instanceId: request.instanceId,
            instanceGeneration: request.instanceGeneration, permitId: request.permitId, requestId: request.requestId,
            resultDigest: result.resultDigest, acceptedAt: new Date(result.acceptedAt).toISOString(), serverTime: new Date(now).toISOString(),
            duplicate: result.duplicate, health: 'unknown', executionEnabled: false }));
        checkProbeResult(request, response);
        return response;
    }
}
