import type { LockedMachineSession } from './machine-session-lock-ports.ts';

export const TRANSIT_DELIVERY_STORAGE_INTERFACE_VERSION=1 as const;

export interface TransitDeliveryMachineRow extends LockedMachineSession {}
export interface TransitStoredStage {
    forward_id:string; generation:number; target_revision:number;
    scope_id:string; created_by:string; state:'reserved'|'aborted';
    expires_at:number; plan_digest:string; body:unknown; created_at:number; updated_at:number;
}
export interface TransitDeliveryOutboxRow {
    envelope_digest:string; forward_id:string; generation:number; coordination_revision:number;
    node_id:string; session_epoch:number; command_digest:string; body:unknown;
    state:'pending'|'acknowledged'; created_at:number; acknowledged_at:number|null;
}
export interface TransitDeliveryJournalRow {
    revision:number; phase:string; position:number; plan_digest:string;
    receipt_highwater:unknown; journal_digest:string;
}
export interface TransitDeliveryReceiptRow { request_digest:string }
export interface TransitDeliveryJournalStatus { revision:number; phase:string }
export interface TransitDeliveryStorage<Tx> {
    machine(tx:Tx,node:string,fingerprint:string):Promise<TransitDeliveryMachineRow|undefined>;
    stage(tx:Tx,scope:string,forward:string,generation:number):Promise<TransitStoredStage|undefined>;
    runtime(tx:Tx,node:string):Promise<{session_epoch:number;boot_id:string|null}|undefined>;
    slot(tx:Tx,node:string,protocol:'tcp'|'udp',port:number):Promise<{owner_id:string|null;fence:number;deployment_generation:number}|undefined>;
    pending(tx:Tx,node:string,epoch:number):Promise<TransitDeliveryOutboxRow[]>;
    journal(tx:Tx,forward:string,generation:number):Promise<TransitDeliveryJournalRow|undefined>;
    status(tx:Tx,forward:string,generation:number,lock?:boolean):Promise<TransitDeliveryJournalStatus|undefined>;
    outbox(tx:Tx,forward:string,generation:number,revision:number,node:string):Promise<TransitDeliveryOutboxRow|undefined>;
    envelope(tx:Tx,digest:string):Promise<TransitDeliveryOutboxRow|undefined>;
    previousReceipt(tx:Tx,node:string,epoch:number,sequence:number):Promise<TransitDeliveryReceiptRow|undefined>;
    highwater(tx:Tx,node:string,epoch:number):Promise<{last_sequence:number|null}|undefined>;
    insertOutbox(tx:Tx,row:{ envelopeDigest:string; forward:string; generation:number; revision:number; node:string; epoch:number; commandDigest:string; body:unknown; createdAt:number }):Promise<void>;
    insertReceipt(tx:Tx,row:{node:string;epoch:number;sequence:number;envelopeDigest:string;requestDigest:string;receivedAt:number}):Promise<void>;
    acknowledge(tx:Tx,envelopeDigest:string,at:number):Promise<number>;
}
