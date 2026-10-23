import { NodeAuthorityHost, ControlError, invalid, notFound } from '../../framework/public.ts';
import type { AuthorizedNodeFacts, NodeAuthorityRecord as NodeRecord } from '../../framework/public.ts';
import type { NodePolicy, NodeManagementCommand, NodeManagementChange, NodeManagementWriter } from './management-contracts.ts';
import type { NodeGrantWriter } from './grant-contracts.ts';
import type { RelayEndpointNodeAccess, NodeApi, NodePortUsageQueries, NodePortUsageView } from './contracts.ts';
import type { NodeAuthorityOptions, NodeResourceClaim, NodeUseRole } from '../../framework/public.ts';
import { NodeResourcePolicy, nodeGrantRoles, nodeResourceClaim } from './resource-policy.ts';
import { nodeGrantPortLimits, NodePortLimitPolicy } from './port-limits.ts';
import type { NodeGrantPortLimits } from './port-limits.ts';
import type { NodeUseAuthorization } from '../../framework/public.ts';
import { snapshotNodeCommand } from './policy.ts';
import type { NodeView } from './contracts.ts';

/** Product policy/grant commands remain owned by the Node module, not generic L1. */
export class NodeService<Tx> extends NodeAuthorityHost<Tx> implements NodeGrantWriter<Tx>, NodeManagementWriter<Tx>, RelayEndpointNodeAccess<Tx>, NodeApi, NodePortUsageQueries {
    private readonly portLimits:NodePortLimitPolicy<Tx>;
    constructor(options:Omit<NodeAuthorityOptions<Tx>,'useAuthorization'>&{portLimits:NodePortLimitPolicy<Tx>;additionalUseAuthorization?:NodeUseAuthorization<Tx>}) {
        if(!options.portLimits)throw new Error('Node port-limit policy is required');
        super({...options,useAuthorization:new NodeResourcePolicy(options.store,options.portLimits,options.additionalUseAuthorization)});
        this.portLimits=options.portLimits;
    }
    reservationPorts(tx:Tx,actor:string,scopeId:string,nodeId:string,ports:readonly number[]):Promise<readonly number[]> {
        return this.portLimits.reservationPorts(tx,actor,scopeId,nodeId,ports);
    }
    async portUsage(actorId:string,scopeId:string,nodeId:string):Promise<NodePortUsageView> {
        if(![actorId,scopeId,nodeId].every(value=>this.codec.isId(value)))invalid('Valid personal Node port usage identity required');
        return this.db.transaction(async tx=>{
            await this.identity.scope(tx,actorId,scopeId);
            const usage=await this.portLimits.portUsage(tx,actorId,scopeId,nodeId);
            return {...usage,observedAt:this.codec.formatTime(this.now())};
        });
    }
    async provision(actor: string, scope: string, policy: NodePolicy): Promise<{
        nodeId: string;
        enrollmentToken: string;
        expiresAt: string;
    }> {
        return this.provisionResource(actor,scope,policy,'private');
    }
    async provisionShared(actor:string,scope:string,policy:NodePolicy) {
        return this.provisionResource(actor,scope,policy,'admin-shared');
    }
    private async provisionResource(actor:string,scope:string,policy:NodePolicy,source:'private'|'admin-shared') {
        this.codec.validateNetworkPolicy(policy);
        const nodeId = this.secrets.newID(), token = this.secrets.newToken(), until = this.now() + 600000;
        await this.db.transaction(async (tx) => {
            await this.identity.scope(tx, actor, scope, true);
            if(source==='admin-shared')await this.identity.owner(tx,actor,scope);
            const facts: AuthorizedNodeFacts = { ...policy, nodeId, scopeId: scope, capabilities: [] };
            await this.store.create(tx,nodeId,scope,actor,this.secrets.tokenHash(token),until,facts,
                {resource_source:source,owner_actor_id:source==='private'?actor:null,resource_revision:1});
            if(source==='private')await this.store.insertGrant(tx,nodeId,actor,null,null);
            await this.runtime.initializeNode(tx, nodeId);
        });
        return { nodeId, enrollmentToken: token, expiresAt: this.codec.formatTime(until) };
    }
    async changeGrant(tx: Tx, owner: string, scopeId: string, nodeId: string, subject: string, expectedRevision: number, allowed: boolean,allowedRoles:readonly NodeUseRole[]|null=null,portLimits?:NodeGrantPortLimits|null): Promise<{
        nodeId: string;
        actorId: string;
        revision: number;
        allowed: boolean;
        changed: boolean;
        allowedRoles:readonly NodeUseRole[]|null;
        portLimits:NodeGrantPortLimits|null;
    }> {
        if (!this.codec.isId(subject) || !this.codec.isCounter(expectedRevision) || typeof allowed !== 'boolean')
            invalid('Valid grant subject, revision and allowed flag required');
        await this.identity.owner(tx, owner, scopeId);
        const node = await this.management(tx, owner, scopeId, nodeId);
        const resource=nodeResourceClaim(node),roles=nodeGrantRoles(allowedRoles);
        if(resource.resource_source!=='admin-shared')throw new ControlError('AUTHORIZATION_DENIED',403,'Only explicitly shared administrator Nodes accept grants');
        if(!allowed&&(roles!==null||portLimits!==undefined&&portLimits!==null))invalid('A withdrawn grant cannot declare purposes or port limits');
        const suppliedLimits=portLimits===undefined?undefined:nodeGrantPortLimits(portLimits);
        const current = (await this.store.grantRevisionForUpdate(tx,nodeId))!;
        if (current.grant_revision !== expectedRevision)
            throw new ControlError('REVISION_CONFLICT', 409, 'Node grants revision conflict');
        if (allowed) {
            if (node.revoked)
                throw new ControlError('AUTHORIZATION_DENIED', 403, 'Cannot grant a revoked Node');
            await this.identity.scope(tx, subject, scopeId, true);
        }
        const previous = await this.hasGrant(tx, nodeId, subject);
        const previousGrant=(await this.store.grantActors(tx,nodeId)).find(grant=>grant.actor_id===subject);
        if(previous&&!previousGrant)throw new ControlError('INTEGRITY_FAILURE',409,'Node grant projection differs from current authority');
        const limits=allowed?(suppliedLimits===undefined?(previousGrant?nodeGrantPortLimits(previousGrant.port_limits):null):suppliedLimits):null;
        const changed = previous !== allowed || allowed&&previous&&(JSON.stringify(nodeGrantRoles(previousGrant!.allowed_roles))!==JSON.stringify(roles)||JSON.stringify(nodeGrantPortLimits(previousGrant!.port_limits))!==JSON.stringify(limits));
        const revision = current.grant_revision + (changed ? 1 : 0);
        if (revision > Number.MAX_SAFE_INTEGER)
            throw new ControlError('REVISION_EXHAUSTED', 409, 'Node grant revision exhausted');
        if (changed) {
            if (allowed){
                if(previous)await this.store.setGrantRoles(tx,nodeId,subject,roles,limits);
                else await this.store.insertGrant(tx,nodeId,subject,roles,limits);
            } else
                await this.store.deleteGrant(tx,nodeId,subject);
            await this.store.setGrantRevision(tx,nodeId,revision);
            await this.identity.audit(tx, scopeId, owner, subject, 'node_grant_change', revision, { nodeId, allowed, allowedRoles:roles,portLimits:limits });
        }
        return { nodeId, actorId: subject, revision, allowed, changed,allowedRoles:roles,portLimits:limits };
    }
    async listGrants(actor:string,scopeId:string,nodeId:string) { return this.db.transaction(async tx=>{await this.identity.owner(tx,actor,scopeId);const resource=await this.store.scopedNode(tx,nodeId,scopeId,false);if(!resource)notFound();if(nodeResourceClaim(resource).resource_source!=='admin-shared')throw new ControlError('AUTHORIZATION_DENIED',403,'Private and unclassified Nodes cannot be delegated');const node=await this.store.grantRevision(tx,nodeId,scopeId);if(!node)notFound();const grants=await this.store.grantActors(tx,nodeId);return {nodeId,revision:node.grant_revision,actorIds:grants.map(g=>g.actor_id),grants:grants.map(g=>({actorId:g.actor_id,allowedRoles:nodeGrantRoles(g.allowed_roles),portLimits:nodeGrantPortLimits(g.port_limits)}))};}); }
    async management(tx: Tx, actor: string, scope: string, nodeId: string): Promise<NodeRecord> {
        await this.identity.scope(tx, actor, scope, true);
        const visible = await this.store.visible(tx,nodeId,scope);
        if (!visible)
            notFound();
        await this.runtime.lockNode(tx, nodeId);
        const record = await this.store.scopedNode(tx,nodeId,scope,true);
        if (!record)
            notFound();
        const resource=nodeResourceClaim(record);
        if(resource.resource_source!=='private'||resource.owner_actor_id!==actor)await this.identity.owner(tx,actor,scope);
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
        input: NodeManagementCommand): Promise<NodeManagementChange> {
        const command=snapshotNodeCommand(input);
        if (!this.codec.isId(nodeId) || !command || !['policy', 'revoke','classify'].includes(command.kind))
            invalid('Valid Node management command required');
        const node = await this.management(tx, actor, scopeId, nodeId);
        let facts = this.codec.readValue<AuthorizedNodeFacts>(node.facts);
        if (command.kind === 'policy') facts = await this.storePolicy(tx, nodeId, command.policy, command.expectedRevision);
        else if(command.kind==='revoke')await this.markRevoked(tx, nodeId);
        else {
            await this.identity.owner(tx,actor,scopeId);
            const current=nodeResourceClaim(node);
            if(current.resource_source!=='legacy-unclassified')throw new ControlError('AUTHORIZATION_DENIED',403,'Only legacy Nodes can be classified');
            if(current.resource_revision!==command.expectedRevision)throw new ControlError('REVISION_CONFLICT',409,'Node resource revision conflict');
            if(command.source==='private')await this.identity.scope(tx,command.ownerActorId!,scopeId,true);
            const before=await this.store.grantActors(tx,nodeId);
            const resource:NodeResourceClaim={resource_source:command.source,owner_actor_id:command.ownerActorId,resource_revision:current.resource_revision+1};
            nodeResourceClaim(resource);
            if(!await this.store.classify(tx,nodeId,current.resource_revision,resource))throw new ControlError('REVISION_CONFLICT',409,'Node resource revision conflict');
            if(command.legacyGrants==='discard')await this.store.clearGrants(tx,nodeId);
            if(command.source==='private')await this.store.insertGrant(tx,nodeId,command.ownerActorId!,null,null);
            const grant=(await this.store.grantRevisionForUpdate(tx,nodeId))!;
            if(!this.codec.isCounter(grant.grant_revision+1))throw new ControlError('REVISION_EXHAUSTED',409,'Node grant revision exhausted');
            await this.store.setGrantRevision(tx,nodeId,grant.grant_revision+1);
            await this.audit(tx,nodeId,actor,'resource_classification',{resource,legacyGrants:command.legacyGrants,previousGrants:before});
            return {nodeId,kind:command.kind,facts,resource};
        }
        return { nodeId, kind: command.kind, facts };
    }
    markRevoked(tx:Tx,nodeId:string):Promise<void> { return this.store.markRevoked(tx,nodeId); }
    async view(actor: string, scope: string, nodeId: string):Promise<NodeView> {
        return this.db.transaction(async (tx) => {
            await this.identity.scope(tx, actor, scope);
            const record = await this.store.scopedNode(tx,nodeId,scope,false);
            if (!record)
                notFound();
            const resource=nodeResourceClaim(record);
            if(resource.resource_source!=='private'||resource.owner_actor_id!==actor){
                try { await this.identity.owner(tx,actor,scope); }
                catch(error){
                    if(!(error instanceof ControlError)||error.code!=='AUTHORIZATION_DENIED')throw error;
                    const access=await this.store.resourceAccess(tx,nodeId,scope,actor);
                    if(!access||resource.resource_source!=='admin-shared'||access.grant_actor_id!==actor)notFound();
                    const roles=nodeGrantRoles(access.allowed_roles);
                    return {detail:'basic',nodeId,scopeId:scope,resourceSource:resource.resource_source,resourceRevision:resource.resource_revision,
                        revoked:Boolean(record.revoked),capabilities:[...this.codec.readValue<AuthorizedNodeFacts>(record.facts).capabilities],allowedRoles:roles,portLimits:nodeGrantPortLimits(access.port_limits)};
                }
            }
            const until = await this.runtime.maximumAuthorization(tx, nodeId);
            const credentials = await this.store.credentials(tx,nodeId);
            return { detail:'full',nodeId, scopeId: scope,resourceSource:resource.resource_source,ownerActorId:resource.owner_actor_id,resourceRevision:resource.resource_revision, policy: this.codec.readValue(record.facts), revoked: Boolean(record.revoked), pendingRevocation: Boolean(record.revoked && until && until + 5000 > this.now()), latestAuthorizationUntil: until ? this.codec.formatTime(until + 5000) : null, credentials: credentials.map(c => ({ fingerprint: c.fingerprint, validUntil: this.codec.formatTime(c.valid_until), retireAfter: c.retire_after ? this.codec.formatTime(c.retire_after) : null, revoked: Boolean(c.revoked) })) };
        });
    }
}
