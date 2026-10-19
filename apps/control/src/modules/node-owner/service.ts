import { NodeAuthorityHost, ControlError, invalid, notFound } from '../../framework/public.ts';
import type { AuthorizedNodeFacts, NodeAuthorityRecord as NodeRecord } from '../../framework/public.ts';
import type { NodePolicy, NodeManagementCommand, NodeManagementChange, NodeManagementWriter } from './management-contracts.ts';
import type { NodeGrantWriter } from './grant-contracts.ts';
import type { RelayEndpointNodeAccess, NodeApi } from './contracts.ts';

/** Product policy/grant commands remain owned by the Node module, not generic L1. */
export class NodeService<Tx> extends NodeAuthorityHost<Tx> implements NodeGrantWriter<Tx>, NodeManagementWriter<Tx>, RelayEndpointNodeAccess<Tx>, NodeApi {
    async provision(actor: string, scope: string, policy: NodePolicy): Promise<{
        nodeId: string;
        enrollmentToken: string;
        expiresAt: string;
    }> {
        this.codec.validateNetworkPolicy(policy);
        const nodeId = this.secrets.newID(), token = this.secrets.newToken(), until = this.now() + 600000;
        await this.db.transaction(async (tx) => {
            await this.identity.scope(tx, actor, scope, true);
            const facts: AuthorizedNodeFacts = { ...policy, nodeId, scopeId: scope, capabilities: [] };
            await this.store.create(tx,nodeId,scope,actor,this.secrets.tokenHash(token),until,facts);
            await this.runtime.initializeNode(tx, nodeId);
        });
        return { nodeId, enrollmentToken: token, expiresAt: this.codec.formatTime(until) };
    }
    async changeGrant(tx: Tx, owner: string, scopeId: string, nodeId: string, subject: string, expectedRevision: number, allowed: boolean): Promise<{
        nodeId: string;
        actorId: string;
        revision: number;
        allowed: boolean;
        changed: boolean;
    }> {
        if (!this.codec.isId(subject) || !this.codec.isCounter(expectedRevision) || typeof allowed !== 'boolean')
            invalid('Valid grant subject, revision and allowed flag required');
        await this.identity.owner(tx, owner, scopeId);
        const node = await this.management(tx, owner, scopeId, nodeId);
        const current = (await this.store.grantRevisionForUpdate(tx,nodeId))!;
        if (current.grant_revision !== expectedRevision)
            throw new ControlError('REVISION_CONFLICT', 409, 'Node grants revision conflict');
        if (allowed) {
            if (node.revoked)
                throw new ControlError('AUTHORIZATION_DENIED', 403, 'Cannot grant a revoked Node');
            await this.identity.scope(tx, subject, scopeId, true);
        }
        const previous = await this.hasGrant(tx, nodeId, subject);
        const changed = previous !== allowed;
        const revision = current.grant_revision + (changed ? 1 : 0);
        if (revision > Number.MAX_SAFE_INTEGER)
            throw new ControlError('REVISION_EXHAUSTED', 409, 'Node grant revision exhausted');
        if (changed) {
            if (allowed)
                await this.store.insertGrant(tx,nodeId,subject);
            else
                await this.store.deleteGrant(tx,nodeId,subject);
            await this.store.setGrantRevision(tx,nodeId,revision);
            await this.identity.audit(tx, scopeId, owner, subject, 'node_grant_change', revision, { nodeId, allowed });
        }
        return { nodeId, actorId: subject, revision, allowed, changed };
    }
    async listGrants(actor:string,scopeId:string,nodeId:string) { return this.db.transaction(async tx=>{await this.identity.owner(tx,actor,scopeId);const node=await this.store.grantRevision(tx,nodeId,scopeId);if(!node)notFound();const grants=await this.store.grantActors(tx,nodeId);return {nodeId,revision:node.grant_revision,actorIds:grants.map(g=>g.actor_id)};}); }
    async management(tx: Tx, actor: string, scope: string, nodeId: string): Promise<NodeRecord> {
        await this.identity.scope(tx, actor, scope, true);
        const visible = await this.store.visible(tx,nodeId,scope);
        if (!visible)
            notFound();
        await this.runtime.lockNode(tx, nodeId);
        const record = await this.store.scopedNode(tx,nodeId,scope,true);
        if (!record)
            notFound();
        return record;
    }
    async storePolicy(tx: Tx, nodeId: string, policy: NodePolicy, expectedRevision: number): Promise<AuthorizedNodeFacts> {
        const current = await this.facts(tx, nodeId);
        if (current.facts.egressPolicyRevision !== expectedRevision)
            throw new ControlError('REVISION_CONFLICT', 409, 'Node policy revision conflict');
        this.codec.validateNetworkPolicy(policy);
        if (policy.egressPolicyRevision !== expectedRevision + 1 || !this.codec.isCounter(policy.egressPolicyRevision))
            invalid('Policy revision must increment exactly once');
        const facts = { ...policy, nodeId, scopeId: current.facts.scopeId, capabilities: current.facts.capabilities };
        await this.store.setFacts(tx,nodeId,facts);
        return facts;
    }
    async applyManagement(tx: Tx, actor: string, scopeId: string, nodeId: string,
        command: NodeManagementCommand): Promise<NodeManagementChange> {
        if (!this.codec.isId(nodeId) || !command || !['policy', 'revoke'].includes(command.kind))
            invalid('Valid Node management command required');
        const node = await this.management(tx, actor, scopeId, nodeId);
        let facts = this.codec.readValue<AuthorizedNodeFacts>(node.facts);
        if (command.kind === 'policy') facts = await this.storePolicy(tx, nodeId, command.policy, command.expectedRevision);
        else await this.markRevoked(tx, nodeId);
        return { nodeId, kind: command.kind, facts };
    }
    markRevoked(tx:Tx,nodeId:string):Promise<void> { return this.store.markRevoked(tx,nodeId); }
    async view(actor: string, scope: string, nodeId: string) {
        return this.db.transaction(async (tx) => {
            await this.identity.scope(tx, actor, scope);
            const record = await this.store.scopedNode(tx,nodeId,scope,false);
            if (!record)
                notFound();
            const until = await this.runtime.maximumAuthorization(tx, nodeId);
            const credentials = await this.store.credentials(tx,nodeId);
            return { nodeId, scopeId: scope, policy: this.codec.readValue(record.facts), revoked: Boolean(record.revoked), pendingRevocation: Boolean(record.revoked && until && until + 5000 > this.now()), latestAuthorizationUntil: until ? this.codec.formatTime(until + 5000) : null, credentials: credentials.map(c => ({ fingerprint: c.fingerprint, validUntil: this.codec.formatTime(c.valid_until), retireAfter: c.retire_after ? this.codec.formatTime(c.retire_after) : null, revoked: Boolean(c.revoked) })) };
        });
    }
}
