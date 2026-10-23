import type { Forward } from '@tunex/core';
import { ControlError, invalid } from '../../framework/public.ts';
import type { NodeAuthorityStore, RuntimePortUsageStore, RuntimePortReservationPolicy, RuntimeSlotKey } from '../../framework/public.ts';
import { nodeResourceClaim } from './resource-policy.ts';
import type { NodePortUsageView } from './contracts.ts';

export interface NodeGrantPortLimits {
    readonly allowedPorts:readonly number[]|null;
    readonly maxBindings:number|null;
}

export function nodeGrantPortLimits(input:unknown):NodeGrantPortLimits|null {
    if(input===null)return null;
    if(!input||typeof input!=='object'||Array.isArray(input))invalid('Node grant port limits must be null or an object');
    const value=input as Record<string,unknown>;
    if(Object.keys(value).length!==2||!Object.hasOwn(value,'allowedPorts')||!Object.hasOwn(value,'maxBindings'))
        invalid('Node grant port limits require only allowedPorts and maxBindings');
    const ports=value.allowedPorts,count=value.maxBindings;
    if(ports!==null&&(!Array.isArray(ports)||ports.length===0||ports.length>65535||
        ports.some(port=>!Number.isSafeInteger(port)||port<1||port>65535)||new Set(ports).size!==ports.length))
        invalid('Grant allowedPorts must be null or a nonempty distinct port subset');
    if(count!==null&&(!Number.isSafeInteger(count)||(count as number)<0))invalid('Grant maxBindings must be null or a nonnegative safe integer');
    return Object.freeze({allowedPorts:ports===null?null:Object.freeze([...(ports as number[])].sort((a,b)=>a-b)),maxBindings:count as number|null});
}

const key=(slot:RuntimeSlotKey)=>`${slot.nodeId}/${slot.protocol}/${slot.port}`;

/** Product limits reduce use of the one original Runtime physical-port ledger. */
export class NodePortLimitPolicy<Tx> implements RuntimePortReservationPolicy<Tx> {
    private readonly nodes:NodeAuthorityStore<Tx>;
    private readonly usage:RuntimePortUsageStore<Tx>;
    constructor(nodes:NodeAuthorityStore<Tx>,usage:RuntimePortUsageStore<Tx>) {
        this.nodes=nodes;this.usage=usage;
    }

    private async grantAccess(tx:Tx,actor:string,scopeId:string,nodeId:string):Promise<{source:'private'|'admin-shared';limits:NodeGrantPortLimits|null}> {
        const access=await this.nodes.resourceAccess(tx,nodeId,scopeId,actor);
        if(!access||access.id!==nodeId||access.scope_id!==scopeId)throw new ControlError('AUTHORIZATION_DENIED',403,'Node port use is not authorized');
        nodeResourceClaim(access);
        if(access.resource_source==='private'&&access.owner_actor_id===actor)return {source:'private',limits:null};
        if(access.resource_source!=='admin-shared'||access.grant_actor_id!==actor)
            throw new ControlError('AUTHORIZATION_DENIED',403,'Shared Node port grant required');
        return {source:'admin-shared',limits:nodeGrantPortLimits(access.port_limits)};
    }
    private async limits(tx:Tx,actor:string,scopeId:string,nodeId:string):Promise<NodeGrantPortLimits|null> {
        return (await this.grantAccess(tx,actor,scopeId,nodeId)).limits;
    }
    async portUsage(tx:Tx,actor:string,scopeId:string,nodeId:string):Promise<Omit<NodePortUsageView,'observedAt'>> {
        const access=await this.grantAccess(tx,actor,scopeId,nodeId);
        const occupied=await this.usage.actorPortSlots(tx,nodeId,actor);
        const occupiedBindings=new Set(occupied.map(key)).size,limits=access.limits;
        const maximum=limits?.maxBindings??null;
        return {
            nodeId,scopeId,actorId:actor,resourceSource:access.source,portLimits:limits,
            occupiedBindings,remainingBindings:maximum===null?null:Math.max(0,maximum-occupiedBindings),
            overLimit:maximum!==null&&occupiedBindings>maximum,
            outOfRangeBindings:limits?.allowedPorts?new Set(occupied.filter(slot=>!limits.allowedPorts!.includes(slot.port)).map(key)).size:0,
            limitApplicability:access.source==='private'?'not-applicable':'shared-grant',
            counting:{unit:'protocol+port',tcpUdp:'separate',includesInternal:true,includesDraining:true},
            source:'runtime-port-slots',executionAuthorized:false,
        };
    }
    async reservationPorts(tx:Tx,actor:string,scopeId:string,nodeId:string,ports:readonly number[]):Promise<readonly number[]> {
        const limits=await this.limits(tx,actor,scopeId,nodeId);
        return limits?.allowedPorts?ports.filter(port=>limits.allowedPorts!.includes(port)):[...ports];
    }
    private async owner(tx:Tx,forward:Pick<Forward,'id'|'scopeId'>,creatingOwnerActorId?:string):Promise<string> {
        const claim=await this.usage.forwardPortOwner(tx,forward.id);
        if(claim){
            if(claim.scopeId!==forward.scopeId||!claim.ownerActorId||creatingOwnerActorId!==undefined&&creatingOwnerActorId!==claim.ownerActorId)
                throw new ControlError('AUTHORIZATION_DENIED',403,'Immutable Forward port owner required');
            return claim.ownerActorId;
        }
        if(!creatingOwnerActorId)throw new ControlError('AUTHORIZATION_DENIED',403,'Creating Forward owner required before reservation');
        return creatingOwnerActorId;
    }
    async assertReservation(tx:Tx,forward:Pick<Forward,'id'|'scopeId'>,slots:readonly RuntimeSlotKey[],creatingOwnerActorId?:string):Promise<void> {
        const actor=await this.owner(tx,forward,creatingOwnerActorId);
        for(const nodeId of [...new Set(slots.map(slot=>slot.nodeId))].sort()){
            const limits=await this.limits(tx,actor,forward.scopeId,nodeId);
            if(!limits)continue;
            const occupied=await this.usage.actorPortSlots(tx,nodeId,actor,forward.id);
            const requested=slots.filter(slot=>slot.nodeId===nodeId);
            const own=occupied.filter(slot=>slot.forwardId===forward.id);
            if(limits.allowedPorts&&[...own,...requested].some(slot=>!limits.allowedPorts!.includes(slot.port)))
                throw new ControlError('AUTHORIZATION_DENIED',403,'Physical port is outside the shared Node grant range');
            const union=new Set([...occupied,...requested].map(key));
            if(limits.maxBindings!==null&&union.size>limits.maxBindings)
                throw new ControlError('RESOURCE_LIMIT',429,'Shared Node binding limit exceeded');
        }
    }
    async allowed(tx:Tx,actor:string,scopeId:string,nodeId:string,forward?:Forward):Promise<boolean> {
        try{
            if(forward&&await this.owner(tx,forward,actor)!==actor)return false;
            const limits=await this.limits(tx,actor,scopeId,nodeId);
            if(!limits)return true;
            const occupied=await this.usage.actorPortSlots(tx,nodeId,actor,forward?.id);
            if(limits.maxBindings!==null&&occupied.length>limits.maxBindings)return false;
            if(!forward)return true;
            const requested:RuntimeSlotKey[]=nodeId===forward.spec.ingress.nodeId?
                forward.spec.protocols.map(protocol=>({nodeId,protocol,port:forward.spec.ingress.listen.port})):[];
            await this.assertReservation(tx,forward,[...occupied.filter(slot=>slot.forwardId===forward.id),...requested],actor);
            return true;
        }catch(error){
            if(error instanceof ControlError&&[403,404,429].includes(error.status))return false;
            throw error;
        }
    }
}
