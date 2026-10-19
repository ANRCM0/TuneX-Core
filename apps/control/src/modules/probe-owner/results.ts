import { parseProbeResult, nativeProbeResultAck, probeResultDigest, nativeJsonEncode, nativeParseTime, nativeWallClockSource } from '../../compatibility/public.ts';
import type { ProbeResultRequest, ProbeResultResponse } from '../../compatibility/public.ts';
import { ControlError } from '../../framework/public.ts';
import type { ProbePermitOwner } from './owner-contracts.ts';
import type { ProbeResultApi } from './machine-api.ts';

/** mTLS result adapter. The existing owner commits ingestion before any acknowledgement. */
export class ProbeResults<Tx> implements ProbeResultApi {
    private readonly permits: Pick<ProbePermitOwner<Tx>, 'receiveResult'>;
    private readonly clock: () => number;
    constructor(permits: Pick<ProbePermitOwner<Tx>, 'receiveResult'>, clock: () => number = nativeWallClockSource()) {
        this.permits = permits; this.clock = clock;
    }
    async handle(node: string, fingerprint: string, epoch: number, input: ProbeResultRequest): Promise<ProbeResultResponse> {
        const request = parseProbeResult('Request', nativeJsonEncode(input));
        if (request.nodeId !== node || request.sessionEpoch !== epoch)
            throw new ControlError('SESSION_SUPERSEDED', 409, 'Probe result Node/session differs');
        const result = await this.permits.receiveResult(node, fingerprint, epoch, request);
        const now = this.clock();
        if (!Number.isSafeInteger(now) || !Number.isSafeInteger(result.acceptedAt) || !Number.isSafeInteger(result.checkedAt) ||
            result.acceptedAt < 0 || result.checkedAt < result.acceptedAt || now < result.checkedAt || now - result.checkedAt > 250 ||
            now >= nativeParseTime(request.validUntil) || result.resultDigest !== probeResultDigest(request) ||
            typeof result.duplicate !== 'boolean')
            throw new ControlError('PROBE_PERMIT_UNAVAILABLE', 409, 'Probe result acknowledgement no longer fresh');
        return nativeProbeResultAck(request,result,now);
    }
}
