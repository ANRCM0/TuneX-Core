import type { Forward } from '@tunex/core';
import type { RelayResource, ReservedRelayResource, RuntimeSlotKey } from './runtime-resource-ports.ts';

export const RUNTIME_EXCLUSIVE_RESERVATION_INTERFACE_VERSION=2 as const;

/** Additional raw projections of the existing resource ledger, never a new ledger. */
export interface RuntimeExclusiveReservationStore<Tx> {
    lockedNodes(tx:Tx,nodeId:string):Promise<{node_id:string}[]>;
    ensureSlot(tx:Tx,key:RuntimeSlotKey):Promise<void>;
    exclusiveSlot(tx:Tx,key:RuntimeSlotKey):Promise<{owner_id:string|null;fence:number}|undefined>;
    assignSlot(tx:Tx,key:RuntimeSlotKey,forwardId:string,generation:number):Promise<void>;
    ownedSlotCount(tx:Tx,nodeId:string):Promise<{n:number}|undefined>;
}
export interface RuntimeExclusiveReservationAccess<Tx> {
    reserve(tx:Tx,forward:Pick<Forward,'id'|'scopeId'>,resources:readonly RelayResource[],generation:number,creatingOwnerActorId?:string):Promise<readonly ReservedRelayResource[]>;
}
