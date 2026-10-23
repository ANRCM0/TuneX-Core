import type { Forward } from '@tunex/core';
import type { RuntimeSlotKey } from './runtime-resource-ports.ts';

export const RUNTIME_PORT_POLICY_INTERFACE_VERSION=1 as const;

/** Projections of the original ledger and immutable product owner, not a ledger. */
export interface RuntimePortUsageStore<Tx> {
    forwardPortOwner(tx:Tx,forwardId:string):Promise<{scopeId:string;ownerActorId:string|null}|undefined>;
    actorPortSlots(tx:Tx,nodeId:string,ownerActorId:string,ownedForwardId?:string):Promise<readonly (RuntimeSlotKey&{forwardId:string})[]>;
}

/** Called while the original Runtime Node locks and transaction are held. */
export interface RuntimePortReservationPolicy<Tx> {
    assertReservation(tx:Tx,forward:Pick<Forward,'id'|'scopeId'>,slots:readonly RuntimeSlotKey[],creatingOwnerActorId?:string):Promise<void>;
}
