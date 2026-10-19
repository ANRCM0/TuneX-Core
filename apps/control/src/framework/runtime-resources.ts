import { MAX_COUNTER, isCounter } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { ControlError } from './errors.ts';
import type { RelayResource, ReservedRelayResource, ReservedSlot, RuntimeResourceAccess, RuntimeResourceStore, RuntimeSlotKey } from './runtime-resource-ports.ts';

/** Coordinates the existing resource ledger; holds no independent authority/state. */
export class RuntimeResources<Tx> implements RuntimeResourceAccess<Tx> {
    private readonly store:RuntimeResourceStore<Tx>;
    private readonly maxAssignmentsPerNode:number;
    constructor(store:RuntimeResourceStore<Tx>,maxAssignmentsPerNode:number) {this.store=store;this.maxAssignmentsPerNode=maxAssignmentsPerNode;}

    initializeNode(tx:Tx,nodeId:string):Promise<void> { return this.store.initializeNode(tx,nodeId); }
    async lockNode(tx:Tx,nodeId:string,epoch?:number):Promise<void> {
        const state=await this.store.lockNode(tx,nodeId);
        if(!state||epoch!==undefined&&(!isCounter(epoch)||state.session_epoch!==epoch))
            throw new ControlError('SESSION_SUPERSEDED',409,'Current Node session required');
    }
    maximumAuthorization(tx:Tx,nodeId:string):Promise<number|null> { return this.store.maximumAuthorization(tx,nodeId); }

    async reserve(tx:Tx,forward:Forward):Promise<ReservedSlot[]> {
        const slots:ReservedSlot[]=[];
        for(const protocol of [...forward.spec.protocols].sort()) {
            const key={nodeId:forward.spec.ingress.nodeId,protocol,port:forward.spec.ingress.listen.port};
            await this.store.ensureSlot(tx,key);
            const slot=await this.store.lockSlot(tx,key);
            if(slot.owner_id!==null)throw new ControlError('PORT_RESERVED',409,'Listener port is reserved');
            if(slot.fence>=MAX_COUNTER)throw new ControlError('RESOURCE_LIMIT',429,'Resource counter exhausted');
            await this.store.assignSlot(tx,key,forward.id,1);
            slots.push({...key,forwardId:forward.id,bindingFence:slot.fence+1,deploymentGeneration:1});
        }
        if(await this.store.countOwnedSlots(tx,forward.spec.ingress.nodeId)>this.maxAssignmentsPerNode)
            throw new ControlError('RESOURCE_LIMIT',429,'Node assignment capacity exceeded');
        return slots;
    }
    async reserveRelay(tx:Tx,forward:Forward,resources:readonly RelayResource[],generation:number):Promise<ReservedRelayResource[]> {
        if(!isCounter(generation))throw new ControlError('RESOURCE_LIMIT',429,'Relay generation exhausted');
        const reserved:ReservedRelayResource[]=[];
        for(const resource of [...resources].sort((a,b)=>a.nodeId.localeCompare(b.nodeId)||a.physicalProtocol.localeCompare(b.physicalProtocol)||a.port-b.port)) {
            const key={nodeId:resource.nodeId,protocol:resource.physicalProtocol,port:resource.port};
            await this.store.ensureSlot(tx,key);
            const slot=await this.store.lockSlot(tx,key);
            if(slot.owner_id!==null&&slot.owner_id!==forward.id)throw new ControlError('PORT_RESERVED',409,'Relay physical resource is reserved');
            if(slot.fence>=MAX_COUNTER)throw new ControlError('RESOURCE_LIMIT',429,'Relay fence exhausted');
            await this.store.assignSlot(tx,key,forward.id,generation);
            reserved.push({...resource,forwardId:forward.id,deploymentGeneration:generation,bindingFence:slot.fence+1});
        }
        for(const nodeId of new Set(resources.map(resource=>resource.nodeId)))
            if(await this.store.countOwnedSlots(tx,nodeId)>this.maxAssignmentsPerNode)
                throw new ControlError('RESOURCE_LIMIT',429,'Relay Node capacity exceeded');
        return reserved;
    }
    async transition(tx:Tx,current:Forward,next:Forward):Promise<ReservedSlot[]> {
        const currentRows=await this.store.lockOwnedSlots(tx,current.spec.ingress.nodeId,current.id);
        const result:ReservedSlot[]=[];
        for(const protocol of [...next.spec.protocols].sort()) {
            const key={nodeId:next.spec.ingress.nodeId,protocol,port:next.spec.ingress.listen.port};
            await this.store.ensureSlot(tx,key);
            const slot=await this.store.lockSlot(tx,key);
            if(slot.owner_id!==null&&slot.owner_id!==current.id)throw new ControlError('PORT_RESERVED',409,'Listener port is reserved');
            if(slot.fence>=MAX_COUNTER)throw new ControlError('RESOURCE_LIMIT',429,'Resource counter exhausted');
            const generation=Math.max(next.revision,slot.deployment_generation+1,...currentRows.map(slot=>slot.deployment_generation+1));
            if(generation>MAX_COUNTER)throw new ControlError('RESOURCE_LIMIT',429,'Deployment counter exhausted');
            await this.store.assignSlot(tx,key,next.id,generation);
            result.push({...key,forwardId:next.id,bindingFence:slot.fence+1,deploymentGeneration:generation});
        }
        // Keep previous slots owned throughout the existing drain safety window.
        return result;
    }
    releaseForwardSlots(tx:Tx,forwardId:string):Promise<void> { return this.store.releaseForwardSlots(tx,forwardId); }
    async releaseObsoleteSlots(tx:Tx,forward:Forward):Promise<void> {
        for(const slot of await this.store.ownedSlots(tx,forward.id))
            if(slot.nodeId!==forward.spec.ingress.nodeId||slot.port!==forward.spec.ingress.listen.port||!forward.spec.protocols.includes(slot.protocol))
                await this.store.releaseSlot(tx,slot,forward.id);
    }
    async retainSlots(tx:Tx,forwardId:string,desired:readonly RuntimeSlotKey[]):Promise<void> {
        const keys=new Set(desired.map(slot=>`${slot.nodeId}/${slot.protocol}/${slot.port}`));
        for(const slot of await this.store.ownedSlots(tx,forwardId))
            if(!keys.has(`${slot.nodeId}/${slot.protocol}/${slot.port}`))await this.store.releaseSlot(tx,slot,forwardId);
    }
}
