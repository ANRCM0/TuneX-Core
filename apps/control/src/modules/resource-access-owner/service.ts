import { isId } from '@tunex/core';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { NodeReadDetail, OwnedResourceKind, ReadPrincipal, ResourceAccessStore,
    ResourceOwnershipRecord, ResourceReadAccess, ScopeAuthorization } from '../../framework/public.ts';

const corrupt = (): never => { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid resource ownership'); };

/** Product read policy over the original owners' claims, in the caller's transaction. */
export class ResourceAccess<Tx> implements ResourceReadAccess<Tx> {
    private readonly identity: ScopeAuthorization<Tx>;
    private readonly store: ResourceAccessStore<Tx>;
    constructor(identity: ScopeAuthorization<Tx>, store: ResourceAccessStore<Tx>) {
        this.identity = identity; this.store = store;
    }

    async principal(tx: Tx, actorId: string, scopeId: string): Promise<ReadPrincipal> {
        if (!isId(actorId) || !isId(scopeId)) invalid('Valid scoped resource identity required');
        await this.identity.scope(tx, actorId, scopeId);
        const scope = await this.store.scopeOwner(tx, scopeId);
        if (!scope) notFound();
        if (!isId(scope.ownerActorId)) corrupt();
        if (scope.ownerActorId === actorId) await this.identity.scope(tx, actorId, scopeId, true);
        return Object.freeze({ actorId, governance: scope.ownerActorId === actorId });
    }

    private owner(record: ResourceOwnershipRecord): string | null {
        if (record.ownerActorId !== null && !isId(record.ownerActorId)) corrupt();
        return record.ownerActorId;
    }

    async owned(tx: Tx, actorId: string, scopeId: string, kind: OwnedResourceKind, id: string,
        allowGovernance = false): Promise<void> {
        if (!isId(id)) invalid('Valid resource identifier required');
        const principal = await this.principal(tx, actorId, scopeId);
        const record = await this.store.ownership(tx, scopeId, kind, id);
        if (!record) notFound();
        const owner = this.owner(record);
        if (owner !== actorId && !(allowGovernance && principal.governance)) notFound();
    }

    async forward(tx: Tx, actorId: string, scopeId: string, id: string): Promise<void> {
        return this.owned(tx, actorId, scopeId, 'forward', id, true);
    }

    async node(tx: Tx, actorId: string, scopeId: string, nodeId: string, detail: NodeReadDetail): Promise<'full' | 'shared'> {
        if (!isId(nodeId) || !['basic', 'host', 'diagnostics'].includes(detail)) invalid('Valid Node read required');
        const principal = await this.principal(tx, actorId, scopeId);
        const record = await this.store.node(tx, actorId, scopeId, nodeId);
        if (!record) notFound();
        const owner = this.owner(record);
        if (!['legacy-unclassified', 'private', 'admin-shared'].includes(record.source) || typeof record.granted !== 'boolean' ||
            (record.source === 'private' ? owner === null : owner !== null)) corrupt();
        if (principal.governance || record.source === 'private' && owner === actorId) return 'full';
        if (detail === 'basic' && record.source === 'admin-shared' && record.granted) return 'shared';
        return notFound();
    }
}
