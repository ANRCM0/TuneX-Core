import type { RuntimeSlotKey, RuntimeSlotState } from './runtime-resource-ports.ts';

export const RUNTIME_RESERVATION_RELEASE_INTERFACE_VERSION=1 as const;

export interface RuntimeReservationIdentity {
    readonly nodeId:string;
    readonly bindingFence:number;
    readonly resource:{readonly physicalProtocol:'tcp'|'udp';readonly port:number};
}
export interface RuntimeReservationReleaseStore<Tx> {
    lockSlot(tx:Tx,key:RuntimeSlotKey):Promise<RuntimeSlotState|undefined>;
    releaseExactSlot(tx:Tx,key:RuntimeSlotKey,forwardId:string,fence:number,generation:number):Promise<number>;
}
/** Caller supplies the original transaction after its retained-history checks. */
export interface RuntimeReservationReleaseAccess<Tx> {
    release(tx:Tx,forwardId:string,generation:number,assignments:readonly RuntimeReservationIdentity[]):Promise<void>;
}
