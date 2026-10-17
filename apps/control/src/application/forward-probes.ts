import { deepFreeze, isCounter, isId } from '@tunex/core';
import { ControlError, invalid } from './errors.ts';
import { requestIdentity } from './command-request.ts';
import type { IdempotentRequests, ScopeAuthorization, TransactionBoundary } from './ports.ts';
import type { ProbePermits } from './probe-permits.ts';

export interface ProbeAcceptance {
    status: 202;
    body: { probeId: string; forwardId: string; issuedAt: string; expiresAt: string;
        dispatch: 'agent-poll'; executionEnabled: false };
}

/** Explicit manager command; retries replay acceptance, never recreate or extend a task. */
export class ForwardProbes<Tx> {
    private readonly db: TransactionBoundary<Tx>;
    private readonly identity: ScopeAuthorization<Tx>;
    private readonly requests: IdempotentRequests<Tx>;
    private readonly permits: Pick<ProbePermits<Tx>, 'issueCurrentIn' | 'inspect' | 'revoke'>;
    readonly enabled: boolean;
    constructor(db: TransactionBoundary<Tx>, identity: ScopeAuthorization<Tx>, requests: IdempotentRequests<Tx>,
        permits: Pick<ProbePermits<Tx>, 'issueCurrentIn' | 'inspect' | 'revoke'>, enabled = false) {
        this.db = db; this.identity = identity; this.requests = requests; this.permits = permits; this.enabled = enabled;
    }

    async create(actor: string, scope: string, forward: string, key: string | undefined, input: unknown): Promise<ProbeAcceptance> {
        if (!isId(forward) || !input || typeof input !== 'object' || Array.isArray(input) ||
            ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
            Object.keys(input).some(k => !['version', 'kind', 'expectedRevision', 'timeoutMs'].includes(k)))
            invalid('Closed Forward Probe request required');
        const raw = input as Record<string, unknown>, timeoutMs = raw.timeoutMs === undefined ? 1000 : raw.timeoutMs;
        if (raw.version !== 1 || raw.kind !== 'tcp-connect' || !isCounter(raw.expectedRevision) ||
            typeof timeoutMs !== 'number' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 2000)
            invalid('Supported Probe request and bounded timeout required');
        const command = Object.freeze({ version: 1, kind: 'tcp-connect', expectedRevision: raw.expectedRevision, timeoutMs });
        const request = requestIdentity(actor, scope, key, 'POST', `/api/v1/scopes/${scope}/forwards/${forward}/probes`, command);
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actor, scope, true);
            const replay = await this.requests.claim<ProbeAcceptance>(tx, request);
            if (replay) return deepFreeze(replay);
            if (!this.enabled) throw new ControlError('PROBE_DISABLED', 409, 'Probe execution issuance is disabled');
            const permit = await this.permits.issueCurrentIn(tx, actor, scope, forward, command);
            const response: ProbeAcceptance = { status: 202, body: { probeId: permit.id, forwardId: forward,
                issuedAt: new Date(permit.issuedAt).toISOString(), expiresAt: new Date(permit.expiresAt).toISOString(),
                dispatch: 'agent-poll', executionEnabled: false } };
            await this.requests.respond(tx, request, response);
            return deepFreeze(response);
        });
    }
    inspect(actor: string, scope: string, id: string) { return this.permits.inspect(actor, scope, id); }
    revoke(actor: string, scope: string, id: string) { return this.permits.revoke(actor, scope, id); }
}
