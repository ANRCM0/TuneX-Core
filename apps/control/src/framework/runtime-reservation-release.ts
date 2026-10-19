import { ControlError } from './errors.ts';
import type { RuntimeReservationIdentity, RuntimeReservationReleaseStore, RuntimeReservationReleaseAccess } from './runtime-reservation-release-ports.ts';

function integrity(message:string):never {throw new ControlError('INTEGRITY_FAILURE',409,message);}

/** Exact release mode of the original Runtime resource owner. */
export class RuntimeReservationRelease<Tx> implements RuntimeReservationReleaseAccess<Tx> {
    private readonly store:RuntimeReservationReleaseStore<Tx>;
    constructor(store:RuntimeReservationReleaseStore<Tx>) {this.store=store;}

    async release(tx:Tx,forwardId:string,generation:number,assignments:readonly RuntimeReservationIdentity[]):Promise<void> {
        // Verify the entire set before releasing any physical reservation.
        for(const a of assignments){
            const slot=await this.store.lockSlot(tx,{nodeId:a.nodeId,protocol:a.resource.physicalProtocol,port:a.resource.port});
            if(!slot || slot.owner_id!==forwardId || slot.fence!==a.bindingFence ||
                slot.deployment_generation!==generation)integrity('Reservation ownership or Fence changed');
        }
        for(const a of assignments){
            const updated=await this.store.releaseExactSlot(tx,
                {nodeId:a.nodeId,protocol:a.resource.physicalProtocol,port:a.resource.port},forwardId,a.bindingFence,generation);
            if(updated!==1)integrity('Reservation release race');
        }
    }
}
