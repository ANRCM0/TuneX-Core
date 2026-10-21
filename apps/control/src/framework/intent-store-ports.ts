import type { Forward } from '@tunex/core';
import type { CommandResponse, IdempotentRequests, RequestIdentity } from './application-ports.ts';

export const INTENT_STORAGE_INTERFACE_VERSION=2 as const;
export type ForwardValue=Forward;
export interface StoredValues { read<T>(value:unknown):T;encode(value:unknown):string }

export interface StoredForwardIntent {id:string;scope_id:string;owner_actor_id:string|null;revision:number;spec:unknown}
export interface StoredForwardState extends StoredForwardIntent {deleting:number;recovery_suspended:number}
export interface ForwardIntentStore<Tx> {
    revisions(tx:Tx,forwardId:string):Promise<{revision:number;spec:unknown}[]>;
    quarantine(tx:Tx):Promise<void>;
    liveProfileCount(tx:Tx,profileId:string):Promise<number>;
    liveNodeCount(tx:Tx,nodeId:string):Promise<number>;
    forNode(tx:Tx,nodeId:string):Promise<StoredForwardIntent[]>;
    forReferencedNode(tx:Tx,nodeId:string):Promise<StoredForwardIntent[]>;
    forProfileActor(tx:Tx,actor:string,profileId:string):Promise<StoredForwardIntent[]>;
    insertCurrent(tx:Tx,id:string,scopeId:string,revision:number,encoded:string,actor:string):Promise<void>;
    insertRevision(tx:Tx,id:string,revision:number,encoded:string):Promise<void>;
    /** One-time legacy claim, without changing desired configuration or execution authority. */
    classifyOwner(tx:Tx,id:string,scopeId:string,expectedRevision:number,ownerActorId:string):Promise<number>;
    auditOwnership(tx:Tx,eventId:string,id:string,scopeId:string,revision:number,actor:string,ownerActorId:string,at:number):Promise<void>;
    authorizer(tx:Tx,id:string):Promise<{authorization_actor:string|null}|undefined>;
    setAuthorizer(tx:Tx,actor:string,id:string):Promise<void>;
    forActor(tx:Tx,scopeId:string,actor:string):Promise<StoredForwardIntent[]>;
    get(tx:Tx,id:string,scopeId:string):Promise<StoredForwardIntent|undefined>;
    currentForUpdate(tx:Tx,id:string,scopeId:string):Promise<StoredForwardIntent|undefined>;
    record(tx:Tx,id:string,scopeId:string,lock?:boolean):Promise<StoredForwardState|undefined>;
    replaceCurrent(tx:Tx,revision:number,encoded:string,id:string,expectedRevision:number):Promise<number>;
    markDeleting(tx:Tx,revision:number,id:string,expectedRevision:number):Promise<number>;
}

export interface IdempotencyKey {readonly scopeId:string;readonly actorId:string;readonly key:string}
export interface StoredIdempotency {
    request_digest:string;http_status:number|null;response:unknown;recovery_invalidated:number;
}
export interface IdempotencyStore<Tx> {
    quarantine(tx:Tx):Promise<void>;
    ensure(tx:Tx,key:IdempotencyKey,digest:string):Promise<void>;
    currentForUpdate(tx:Tx,key:IdempotencyKey):Promise<StoredIdempotency|undefined>;
    respond(tx:Tx,status:CommandResponse['status'],encoded:string,key:IdempotencyKey):Promise<void>;
}

export interface IdempotencyService<Tx,DefaultResponse extends CommandResponse=CommandResponse> extends IdempotentRequests<Tx> {
    claim<R extends CommandResponse=DefaultResponse>(tx:Tx,request:RequestIdentity):Promise<R|undefined>;
    quarantineRecovery(tx:Tx):Promise<void>;
}
