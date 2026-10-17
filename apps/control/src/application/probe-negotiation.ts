import { deepFreeze, isCounter, isId } from '@tunex/core';
import { parseProbeNegotiation } from '@tunex/contracts';
import type { ProbeNegotiationRequest, ProbeNegotiationResponse } from '@tunex/contracts';
import { ControlError, invalid } from './errors.ts';
import type { TransactionBoundary } from './ports.ts';
import type { ProbeMachineReader } from '../modules/probe-negotiation-ports.ts';
import { requireProbeMachine } from './probe-machine-authorization.ts';

/** The separate machine handshake is read-only and cannot grant Probe execution. */
export class ProbeNegotiator<Tx> {
    private readonly db: TransactionBoundary<Tx>;
    private readonly reader: ProbeMachineReader<Tx>;
    constructor(db: TransactionBoundary<Tx>, reader: ProbeMachineReader<Tx>) {
        this.db = db; this.reader = reader;
    }
    async hello(nodeId: string, fingerprint: string, epoch: number,
        input: ProbeNegotiationRequest): Promise<ProbeNegotiationResponse> {
        const request = parseProbeNegotiation('Request', JSON.stringify(input));
        if (!isId(nodeId) || !isCounter(epoch) || request.nodeId !== nodeId || request.sessionEpoch !== epoch)
            throw new ControlError('SESSION_SUPERSEDED', 409, 'Probe Node/session differs');
        if (!/^[0-9a-f]{64}$/.test(fingerprint) || fingerprint.length !== 64)
            invalid('Machine certificate fingerprint required');
        return this.db.transaction(async tx => {
            const current = await this.reader.read(tx, nodeId, fingerprint), now = Date.now();
            requireProbeMachine(current, nodeId, request.bootId, epoch, now);
            return deepFreeze({ ...request, kind: 'probe-hello-ack', serverTime: new Date(now).toISOString(),
                state: 'contract-only', executionEnabled: false });
        });
    }
}
