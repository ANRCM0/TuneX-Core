import type { Forward } from '@tunex/core';
import type { RuntimeExclusiveReservationAccess } from '../../framework/public.ts';
import type { TransitResource, ReservedTransitResource } from './preparation-contracts.ts';
import { validateTransitReservationSet } from './reservation-values.ts';

/** Product topology validation before the existing Runtime exclusive resource mode. */
export class TransitReservations<Tx> {
    private readonly resources:RuntimeExclusiveReservationAccess<Tx>;
    constructor(resources:RuntimeExclusiveReservationAccess<Tx>) {this.resources=resources;}
    async reserve(tx:Tx,forward:Forward,resources:readonly TransitResource[],generation:number):Promise<readonly ReservedTransitResource[]> {
        validateTransitReservationSet(forward,resources,generation);
        return this.resources.reserve(tx,forward,resources,generation);
    }
}
