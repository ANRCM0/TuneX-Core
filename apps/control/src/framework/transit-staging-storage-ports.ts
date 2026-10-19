import type { TransitStoredStage } from './transit-delivery-storage-ports.ts';

export const TRANSIT_STAGING_STORAGE_INTERFACE_VERSION=1 as const;

export interface TransitStageInsert {
    forward_id:string;generation:number;target_revision:number;scope_id:string;
    created_by:string;state:'reserved';expires_at:number;plan_digest:string;
    body:string;created_at:number;updated_at:number;
}
/** Raw staging state and read-only original Runtime evidence in the supplied Tx. */
export interface TransitStagingStorage<Tx> {
    latest(tx:Tx,forward:string):Promise<TransitStoredStage|undefined>;
    stage(tx:Tx,scope:string,forward:string,generation:number):Promise<TransitStoredStage|undefined>;
    session(tx:Tx,node:string):Promise<{session_epoch:number}|undefined>;
    lockedNodes(tx:Tx,node:string):Promise<{node_id:string}[]>;
    candidateOwner(tx:Tx,node:string,port:number):Promise<{owner_id:string|null}|undefined>;
    physicalOwner(tx:Tx,node:string,protocol:'tcp'|'udp',port:number):Promise<{owner_id:string|null}|undefined>;
    coordination(tx:Tx,forward:string,generation:number):Promise<{generation:number}[]>;
    maximumLease(tx:Tx,forward:string):Promise<{until:number|null}|undefined>;
    snapshots(tx:Tx,node:string,after:number):Promise<{body:unknown}[]>;
    insert(tx:Tx,row:TransitStageInsert):Promise<void>;
    abort(tx:Tx,forward:string,generation:number,now:number):Promise<number>;
}
