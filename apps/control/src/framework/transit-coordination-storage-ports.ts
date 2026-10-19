import type { TransitStoredStage } from './transit-delivery-storage-ports.ts';

export const TRANSIT_COORDINATION_STORAGE_INTERFACE_VERSION=1 as const;

export interface TransitStoredCoordination<Phase extends string=string> {
    forward_id:string; generation:number; plan_digest:string; phase:Phase;
    position:number; revision:number; receipt_highwater:unknown; journal_digest:string;
    created_at:number; updated_at:number;
}
export interface TransitCoordinationInsert<Phase extends string=string> {
    forward_id:string; generation:number; plan_digest:string; phase:Phase;
    position:number; revision:number; receipt_highwater:string; journal_digest:string;
    created_at:number; updated_at:number;
}
export interface TransitCoordinationUpdate<Phase extends string=string> {
    phase:Phase; position:number; revision:number; receipt_highwater:string;
    journal_digest:string; updated_at:number; forward_id:string; generation:number;
    previous_revision:number; previous_journal_digest:string;
}

/** Raw locked evidence and writes in the caller's existing transaction. */
export interface TransitCoordinationStorage<Tx,Phase extends string=string> {
    stage(tx:Tx,scope:string,forward:string,generation:number):Promise<TransitStoredStage|undefined>;
    recoveryStage(tx:Tx,forward:string,generation:number):Promise<TransitStoredStage|undefined>;
    session(tx:Tx,node:string):Promise<{session_epoch:number}|undefined>;
    slot(tx:Tx,node:string,protocol:'tcp'|'udp',port:number):Promise<{owner_id:string|null;fence:number;deployment_generation:number}|undefined>;
    journal(tx:Tx,forward:string,generation:number):Promise<TransitStoredCoordination<Phase>|undefined>;
    recovering(tx:Tx):Promise<TransitStoredCoordination<Phase>[]>;
    insert(tx:Tx,row:TransitCoordinationInsert<Phase>):Promise<void>;
    update(tx:Tx,row:TransitCoordinationUpdate<Phase>):Promise<number>;
}
