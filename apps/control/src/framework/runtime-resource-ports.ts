import type { Forward } from '@tunex/core';

export const RUNTIME_RESOURCE_INTERFACE_VERSION=2 as const;

export interface RuntimeSlotKey {
    nodeId:string;
    protocol:'tcp'|'udp';
    port:number;
}
export interface RuntimeSlotState {
    owner_id:string|null;
    fence:number;
    deployment_generation:number;
}
export interface ReservedSlot extends RuntimeSlotKey {
    readonly nodeId:string;
    readonly protocol:'tcp'|'udp';
    readonly port:number;
    readonly forwardId:string;
    readonly bindingFence:number;
    readonly deploymentGeneration:number;
}
export interface RelayResource {
    nodeId:string;
    role:'ingress'|'transit'|'egress';
    forwardProtocol:'tcp'|'udp';
    physicalProtocol:'tcp'|'udp';
    address:string;
    port:number;
}
export interface ReservedRelayResource extends RelayResource {
    forwardId:string;
    deploymentGeneration:number;
    bindingFence:number;
}

/** Every operation uses the supplied transaction; providers do not acquire one. */
export interface RuntimeResourceStore<Tx> {
    initializeNode(tx:Tx,nodeId:string):Promise<void>;
    lockNode(tx:Tx,nodeId:string):Promise<{session_epoch:number}|undefined>;
    maximumAuthorization(tx:Tx,nodeId:string):Promise<number|null>;
    ensureSlot(tx:Tx,key:RuntimeSlotKey):Promise<void>;
    lockSlot(tx:Tx,key:RuntimeSlotKey):Promise<RuntimeSlotState>;
    lockOwnedSlots(tx:Tx,nodeId:string,forwardId:string):Promise<RuntimeSlotState[]>;
    assignSlot(tx:Tx,key:RuntimeSlotKey,forwardId:string,generation:number):Promise<void>;
    countOwnedSlots(tx:Tx,nodeId:string):Promise<number>;
    ownedSlots(tx:Tx,forwardId:string):Promise<RuntimeSlotKey[]>;
    releaseSlot(tx:Tx,key:RuntimeSlotKey,forwardId:string):Promise<void>;
    releaseForwardSlots(tx:Tx,forwardId:string):Promise<void>;
}
export interface RuntimeNodeResources<Tx> {
    initializeNode(tx:Tx,nodeId:string):Promise<void>;
    lockNode(tx:Tx,nodeId:string,epoch?:number):Promise<void>;
    maximumAuthorization(tx:Tx,nodeId:string):Promise<number|null>;
}
export interface RuntimeResourceAccess<Tx> extends RuntimeNodeResources<Tx> {
    /** Caller holds the original Forward row lock; serialize changes to counted ownership. */
    lockOwnership(tx:Tx,forward:Forward):Promise<void>;
    reserve(tx:Tx,forward:Forward,creatingOwnerActorId?:string):Promise<ReservedSlot[]>;
    reserveRelay(tx:Tx,forward:Forward,resources:readonly RelayResource[],generation:number,creatingOwnerActorId?:string):Promise<ReservedRelayResource[]>;
    transition(tx:Tx,current:Forward,next:Forward):Promise<ReservedSlot[]>;
    releaseForwardSlots(tx:Tx,forwardId:string):Promise<void>;
    releaseObsoleteSlots(tx:Tx,forward:Forward):Promise<void>;
    retainSlots(tx:Tx,forwardId:string,desired:readonly RuntimeSlotKey[]):Promise<void>;
}
