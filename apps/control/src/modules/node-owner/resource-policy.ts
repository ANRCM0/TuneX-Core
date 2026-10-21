import type { Forward } from '@tunex/core';
import type { NodePortLimitPolicy } from './port-limits.ts';
import { ControlError, invalid } from '../../framework/public.ts';
import { nativeNodeCodec } from '../../compatibility/public.ts';
import type { NodeAuthorityStore, NodeResourceClaim, NodeUseAuthorization, NodeUseRole } from '../../framework/public.ts';

const roles:readonly NodeUseRole[]=['ingress','transit','egress'];

export function nodeGrantRoles(input:unknown):readonly NodeUseRole[]|null {
    if(input===null)return null;
    if(!Array.isArray(input)||input.length===0||input.length>3||input.some(value=>!roles.includes(value))||new Set(input).size!==input.length)
        invalid('Node grant roles must be null or a nonempty distinct purpose subset');
    return Object.freeze(roles.filter(role=>input.includes(role)));
}

export function nodeResourceClaim(resource:NodeResourceClaim):NodeResourceClaim {
    if(!resource||!Number.isSafeInteger(resource.resource_revision)||resource.resource_revision<1||
        !['legacy-unclassified','private','admin-shared'].includes(resource.resource_source)||
        (resource.resource_source==='private' ? !nativeNodeCodec.isId(resource.owner_actor_id) : resource.owner_actor_id!==null))
        throw new ControlError('INTEGRITY_FAILURE',409,'Node resource ownership is unclassified or malformed');
    return resource;
}

/** The same Node store supplies claims and grants; possession of a grant never creates ownership. */
export class NodeResourcePolicy<Tx> implements NodeUseAuthorization<Tx> {
    private readonly store:NodeAuthorityStore<Tx>;
    private readonly portLimits:NodePortLimitPolicy<Tx>;
    private readonly additional:NodeUseAuthorization<Tx>|undefined;
    constructor(store:NodeAuthorityStore<Tx>,portLimits:NodePortLimitPolicy<Tx>,additional?:NodeUseAuthorization<Tx>) {
        this.portLimits=portLimits;this.additional=additional;
 this.store=store; }
    async allowed(tx:Tx,actor:string,scopeId:string,nodeId:string,role:NodeUseRole,forward?:Forward):Promise<boolean> {
        if(!roles.includes(role))return false;
        const access=await this.store.resourceAccess(tx,nodeId,scopeId,actor);
        if(!access)return false;
        nodeResourceClaim(access);
        if(access.id!==nodeId||access.scope_id!==scopeId||access.grant_actor_id!==actor)return false;
        if(access.resource_source==='legacy-unclassified')return false;
        if(access.resource_source==='private'&&access.owner_actor_id!==actor)return false;
        const allowed=nodeGrantRoles(access.allowed_roles);
        if(access.resource_source==='admin-shared'&&allowed!==null&&!allowed.includes(role))return false;
        return await this.portLimits.allowed(tx,actor,scopeId,nodeId,forward)&&
            (!this.additional||await this.additional.allowed(tx,actor,scopeId,nodeId,role,forward));
    }
}
