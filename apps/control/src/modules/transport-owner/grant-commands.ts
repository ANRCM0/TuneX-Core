import { isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest } from '../../compatibility/public.ts';
import { invalid } from '../../framework/public.ts';
import type { IdempotentRequests, ScopeOwnerAuthorization, TransactionBoundary } from '../../framework/public.ts';
import type { TransportGrantCommand, TransportGrantEffects, TransportGrantWriter } from './contracts.ts';

import type { TransportGrantResponse, TransportGrantApi } from './grant-api.ts';
export type { TransportGrantResponse } from './grant-api.ts';

/** One acceptance transaction, with writes and execution effects kept in their owners. */
export class TransportGrantCommands<Tx> implements TransportGrantApi {
    private readonly db: TransactionBoundary<Tx>;
    private readonly identity: ScopeOwnerAuthorization<Tx>;
    private readonly idempotency: IdempotentRequests<Tx>;
    private readonly transport: TransportGrantWriter<Tx>;
    private readonly effects: TransportGrantEffects<Tx>;

    constructor(db: TransactionBoundary<Tx>, identity: ScopeOwnerAuthorization<Tx>, idempotency: IdempotentRequests<Tx>,
        transport: TransportGrantWriter<Tx>, effects: TransportGrantEffects<Tx>) {
        if (!effects || typeof effects.reconcile !== 'function') throw new Error('Profile grant execution effects are required');
        this.db = db; this.identity = identity; this.idempotency = idempotency;
        this.transport = transport; this.effects = effects;
    }

    async change(actorId: string, scopeId: string, profileId: string, subject: string, key: string | undefined,
        expectedRevision: number, allowed: boolean): Promise<TransportGrantResponse> {
        if (!isId(actorId) || !isId(scopeId) || !isId(profileId) || !isId(subject) || !isCounter(expectedRevision) ||
            typeof allowed !== 'boolean' || !key || !/^[\x21-\x7e]{1,128}$/.test(key)) invalid('Valid Profile grant command required');
        const command: TransportGrantCommand = Object.freeze({ actorId, scopeId, profileId, subject, expectedRevision, allowed });
        const request = Object.freeze({ actorId, scopeId, key, digest: digest({
            method: 'PUT', path: `/api/v1/scopes/${scopeId}/transport-profiles/${profileId}/grants/${subject}`,
            expectedRevision, allowed,
        }) });
        return this.db.transaction(async tx => {
            await this.identity.owner(tx, actorId, scopeId);
            const replay = await this.idempotency.claim<TransportGrantResponse>(tx, request);
            if (replay) return replay;
            const grant = await this.transport.applyGrant(tx, command);
            const operationIds = grant.changed ? await this.effects.reconcile(tx, request, grant) : [];
            const response: TransportGrantResponse = { status: grant.changed ? 202 : 200, body: { ...grant, operationIds } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
}
