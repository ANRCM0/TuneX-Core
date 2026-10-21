import { nativeReadProjectionValues } from '../../compatibility/public.ts';
import { deepFreeze, isCounter, isId, parseForwardSpec } from '@tunex/core';
import { consolePage } from '../console-query-owner/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { ScopeAuthorization, TransactionBoundary, ResourceReadAccess } from '../../framework/public.ts';
import type { TransportProfileResolver } from './contracts.ts';

import type { ProfileReferenceQuery, TransportReferenceReader, TransportQueryApi } from './query-contracts.ts';
export type { ProfileReferenceQuery, ProfileReference, TransportReferenceReader } from './query-contracts.ts';

/** Read-only configuration impact, NOT a deployment plan or a grant to update these rules. */
export class TransportQueries<Tx> implements TransportQueryApi {
    private readonly db: TransactionBoundary<Tx>;
    private readonly identity: ScopeAuthorization<Tx>;
    private readonly access: ResourceReadAccess<Tx>;
    private readonly read: TransportReferenceReader<Tx>;
    private readonly resolver: TransportProfileResolver<Tx>;
    constructor(db: TransactionBoundary<Tx>, identity: ScopeAuthorization<Tx>, read: TransportReferenceReader<Tx>, resolver: TransportProfileResolver<Tx>, access: ResourceReadAccess<Tx>) {
        this.db = db; this.identity = identity; this.access = access; this.read = read; this.resolver = resolver;
    }
    async references(actor: string, scope: string, profile: string, input: ProfileReferenceQuery = {}) {
        if (![actor, scope, profile].every(isId) || !input || typeof input !== 'object' || Array.isArray(input) ||
            ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
            Object.keys(input).some(k => !['page', 'limit', 'revision', 'targetRevision'].includes(k)) ||
            input.page !== undefined && typeof input.page !== 'string' || input.limit !== undefined && typeof input.limit !== 'string' ||
            input.revision !== undefined && !isCounter(input.revision) || input.targetRevision !== undefined && !isCounter(input.targetRevision))
            invalid('Bounded Profile reference query required');
        const query = Object.freeze({ ...input }), paging = Object.freeze(consolePage(query.page, query.limit));
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actor, scope, query.targetRevision !== undefined);
            const principal = await this.access.principal(tx, actor, scope);
            const metadata = await this.read.profile(tx, scope, profile);
            if (!metadata) notFound();
            if (!isCounter(metadata.currentRevision)) throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid current Profile revision');
            const target = query.targetRevision === undefined ? null : await this.resolver.resolve(tx, actor, scope, profile, query.targetRevision);
            if (target && (target.profileId !== profile || target.revision !== query.targetRevision))
                throw new ControlError('INTEGRITY_FAILURE', 409, 'Profile resolution differs from requested immutable revision');
            const result = await this.read.references(tx, scope, principal, profile, paging, query.revision);
            if (!Number.isSafeInteger(result.total) || result.total < 0 || result.items.length > paging.limit ||
                new Set(result.items.map(item => item.forwardId)).size !== result.items.length)
                throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid Profile reference page');
            const items = result.items.map(item => {
                const parsed = parseForwardSpec(item.spec);
                if (!isId(item.forwardId) || !isCounter(item.revision) || !isCounter(item.configRevision) ||
                    !parsed.ok || !parsed.value.path || parsed.value.transport?.profileId !== profile ||
                    parsed.value.transport.configRevision !== item.configRevision || query.revision !== undefined && item.configRevision !== query.revision ||
                    typeof item.recoverySuspended !== 'boolean')
                    throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid persisted Profile reference');
                const proposedSpec = target ? { ...parsed.value, transport: { profileId: profile, configRevision: target.revision } } : null;
                return { forwardId: item.forwardId, revision: item.revision, configRevision: item.configRevision,
                    recoverySuspended: item.recoverySuspended, spec: parsed.value, expectedRevision: item.revision, proposedSpec,
                    changed: target ? item.configRevision !== target.revision : null };
            });
            return deepFreeze({ profileId: profile, currentRevision: metadata.currentRevision, page: paging.page, limit: paging.limit,
                total: result.total, items, target: target ? { revision: target.revision, configDigest: target.configDigest } : null,
                referenceRevision: query.revision ?? null, source: 'persisted-control-state', previewOnly: true, reserved: false,
                fullPlanAuthorization: false, observedAt: nativeReadProjectionValues.currentIso(), consistency: 'read-committed-page-not-global-snapshot' });
        });
    }
}
