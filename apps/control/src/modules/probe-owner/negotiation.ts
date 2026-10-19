import { isCounter, isId } from '@tunex/core';
import { parseProbeNegotiation, nativeJsonEncode, nativeProbeNegotiationAck, nativeWallClockSource } from '../../compatibility/public.ts';
import type { ProbeNegotiationRequest, ProbeNegotiationResponse } from '../../compatibility/public.ts';
import { ControlError, invalid } from '../../framework/public.ts';
import type { TransactionBoundary } from '../../framework/public.ts';
import type { ProbeMachineReader } from './machine-contracts.ts';
import { requireProbeMachine } from './machine-policy.ts';
import type { ProbeNegotiationApi } from './machine-api.ts';

/** The separate machine handshake is read-only and cannot grant Probe execution. */
export class ProbeNegotiator<Tx> implements ProbeNegotiationApi {
    private readonly db: TransactionBoundary<Tx>;
    private readonly reader: ProbeMachineReader<Tx>;
    constructor(db: TransactionBoundary<Tx>, reader: ProbeMachineReader<Tx>) {
        this.db = db; this.reader = reader;
    }
    async hello(nodeId: string, fingerprint: string, epoch: number,
        input: ProbeNegotiationRequest): Promise<ProbeNegotiationResponse> {
        const request = parseProbeNegotiation('Request', nativeJsonEncode(input));
        if (!isId(nodeId) || !isCounter(epoch) || request.nodeId !== nodeId || request.sessionEpoch !== epoch)
            throw new ControlError('SESSION_SUPERSEDED', 409, 'Probe Node/session differs');
        if (!/^[0-9a-f]{64}$/.test(fingerprint) || fingerprint.length !== 64)
            invalid('Machine certificate fingerprint required');
        return this.db.transaction(async tx => {
            const current = await this.reader.read(tx, nodeId, fingerprint), now = nativeWallClockSource()();
            requireProbeMachine(current, nodeId, request.bootId, epoch, now);
            return nativeProbeNegotiationAck(request,now);
        });
    }
}
