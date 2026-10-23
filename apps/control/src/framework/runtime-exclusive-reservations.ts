import { MAX_COUNTER } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { ControlError } from './errors.ts';
import type { RelayResource, ReservedRelayResource } from './runtime-resource-ports.ts';
import type { RuntimeExclusiveReservationStore, RuntimeExclusiveReservationAccess } from './runtime-exclusive-reservation-ports.ts';
import type { RuntimePortReservationPolicy } from './runtime-port-policy-ports.ts';

/** Original exclusive reservation mode of the same Runtime resource owner. */
export class RuntimeExclusiveReservations<Tx> implements RuntimeExclusiveReservationAccess<Tx> {
    private readonly store:RuntimeExclusiveReservationStore<Tx>;
    private readonly capacity:()=>number;
    private readonly portPolicy:RuntimePortReservationPolicy<Tx>;
    constructor(store:RuntimeExclusiveReservationStore<Tx>,capacity:()=>number,portPolicy:RuntimePortReservationPolicy<Tx>) {
        this.portPolicy=portPolicy;

        if(typeof portPolicy?.assertReservation!=='function')throw new Error('Runtime port reservation policy is required');
        this.store=store;this.capacity=capacity;
    }

    async reserve(tx:Tx,forward:Pick<Forward,'id'|'scopeId'>,resources:readonly RelayResource[],generation:number,creatingOwnerActorId?:string):Promise<readonly ReservedRelayResource[]> {
        const uniqueNodes = new Set(resources.map(r => r.nodeId));
        const ordered = [...resources].sort((a,b) =>
            a.nodeId.localeCompare(b.nodeId) ||
            a.physicalProtocol.localeCompare(b.physicalProtocol) || a.port-b.port);
        for (const nodeId of [...uniqueNodes].sort()) {
            const state = await this.store.lockedNodes(tx,nodeId);
            if (state.length !== 1)
                throw new ControlError('SESSION_SUPERSEDED',409,'Current Node session required');
        }
        await this.portPolicy.assertReservation(tx,forward,resources.map(resource=>({nodeId:resource.nodeId,protocol:resource.physicalProtocol,port:resource.port})),creatingOwnerActorId);
        const reservations:ReservedRelayResource[]=[];
        for (const resource of ordered) {
            const key={nodeId:resource.nodeId,protocol:resource.physicalProtocol,port:resource.port};
            await this.store.ensureSlot(tx,key);
            const row=await this.store.exclusiveSlot(tx,key);
            if(!row || row.owner_id!==null)
                throw new ControlError('PORT_RESERVED',409,'Physical port owned by another Forward');
            if(!Number.isSafeInteger(row.fence) || row.fence<0 || row.fence>=MAX_COUNTER)
                throw new ControlError('RESOURCE_LIMIT',429,'Fencing counter exhausted');
            await this.store.assignSlot(tx,key,forward.id,generation);
            reservations.push({...resource,forwardId:forward.id,deploymentGeneration:generation,bindingFence:row.fence+1});
        }
        for (const nodeId of [...uniqueNodes].sort()) {
            const count=await this.store.ownedSlotCount(tx,nodeId);
            if(Number(count?.n)>this.capacity())
                throw new ControlError('RESOURCE_LIMIT',429,'Node capacity exceeded');
        }
        return reservations;
    }
}
