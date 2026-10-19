import type { TransitDeliveryStorage, TransitDeliveryMachineRow, TransitDeliveryOutboxRow, TransitDeliveryJournalRow, TransitDeliveryReceiptRow, TransitStoredStage, TransitDeliveryJournalStatus } from '../framework/public.ts';
import { rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

/** One SQL owner for preview outbox/receipt persistence; coordinator decisions stay above it. */
export class MySqlTransitDeliveryStore implements TransitDeliveryStorage<Transaction> {
    async machine(tx:Transaction,node:string,fingerprint:string):Promise<TransitDeliveryMachineRow|undefined> {
        return (await rows<TransitDeliveryMachineRow>(tx,`SELECT r.session_epoch,r.boot_id,n.revoked node_revoked,n.credential_until,n.facts,
          c.revoked credential_revoked,c.valid_until,c.retire_after
         FROM runtime_nodes r JOIN nodes n ON n.id=r.node_id
         LEFT JOIN node_credentials c ON c.node_id=r.node_id AND c.fingerprint=?
         WHERE r.node_id=? FOR UPDATE`,[fingerprint,node]))[0];
    }
    async pending(tx:Transaction,node:string,epoch:number):Promise<TransitDeliveryOutboxRow[]> {
        return rows<TransitDeliveryOutboxRow>(tx,"SELECT * FROM transit_delivery_outbox WHERE node_id=? AND session_epoch=? AND state='pending' ORDER BY created_at,envelope_digest LIMIT 16 FOR UPDATE",[node,epoch]);
    }
    async stage(tx:Transaction,scope:string,forward:string,generation:number):Promise<TransitStoredStage|undefined> {
        return (await rows<TransitStoredStage>(tx,'SELECT * FROM transit_deployments WHERE forward_id=? AND generation=? AND scope_id=? FOR UPDATE',[forward,generation,scope]))[0];
    }
    async runtime(tx:Transaction,node:string) {
        return (await rows<{session_epoch:number;boot_id:string|null}>(tx,'SELECT session_epoch,boot_id FROM runtime_nodes WHERE node_id=? FOR UPDATE',[node]))[0];
    }
    async slot(tx:Transaction,node:string,protocol:'tcp'|'udp',port:number) {
        return (await rows<{owner_id:string|null;fence:number;deployment_generation:number}>(tx,'SELECT owner_id,fence,deployment_generation FROM port_slots WHERE node_id=? AND protocol=? AND port=? FOR UPDATE',[node,protocol,port]))[0];
    }
    async journal(tx:Transaction,forward:string,generation:number):Promise<TransitDeliveryJournalRow|undefined> {
        return (await rows<TransitDeliveryJournalRow>(tx,'SELECT revision,phase,position,plan_digest,receipt_highwater,journal_digest FROM transit_coordination WHERE forward_id=? AND generation=? FOR UPDATE',[forward,generation]))[0];
    }
    async status(tx:Transaction,forward:string,generation:number,lock=false):Promise<TransitDeliveryJournalStatus|undefined> {
        return (await rows<TransitDeliveryJournalStatus>(tx,'SELECT revision,phase FROM transit_coordination WHERE forward_id=? AND generation=?'+(lock?' FOR UPDATE':''),[forward,generation]))[0];
    }
    async outbox(tx:Transaction,forward:string,generation:number,revision:number,node:string):Promise<TransitDeliveryOutboxRow|undefined> {
        return (await rows<TransitDeliveryOutboxRow>(tx,'SELECT * FROM transit_delivery_outbox WHERE forward_id=? AND generation=? AND coordination_revision=? AND node_id=? FOR UPDATE',[forward,generation,revision,node]))[0];
    }
    async envelope(tx:Transaction,digestValue:string):Promise<TransitDeliveryOutboxRow|undefined> {
        return (await rows<TransitDeliveryOutboxRow>(tx,'SELECT * FROM transit_delivery_outbox WHERE envelope_digest=? FOR UPDATE',[digestValue]))[0];
    }
    async previousReceipt(tx:Transaction,node:string,epoch:number,sequence:number):Promise<TransitDeliveryReceiptRow|undefined> {
        return (await rows<TransitDeliveryReceiptRow>(tx,'SELECT request_digest FROM transit_delivery_receipts WHERE node_id=? AND session_epoch=? AND report_sequence=?',[node,epoch,sequence]))[0];
    }
    async highwater(tx:Transaction,node:string,epoch:number):Promise<{last_sequence:number|null}|undefined> {
        return (await rows<{last_sequence:number|null}>(tx,'SELECT MAX(report_sequence) last_sequence FROM transit_delivery_receipts WHERE node_id=? AND session_epoch=?',[node,epoch]))[0];
    }
    async insertOutbox(tx:Transaction,row:{envelopeDigest:string;forward:string;generation:number;revision:number;node:string;epoch:number;commandDigest:string;body:unknown;createdAt:number}):Promise<void> {
        await write(tx,'INSERT INTO transit_delivery_outbox(envelope_digest,forward_id,generation,coordination_revision,node_id,session_epoch,command_digest,body,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[row.envelopeDigest,row.forward,row.generation,row.revision,row.node,row.epoch,row.commandDigest,JSON.stringify(row.body),'pending',row.createdAt]);
    }
    async insertReceipt(tx:Transaction,row:{node:string;epoch:number;sequence:number;envelopeDigest:string;requestDigest:string;receivedAt:number}):Promise<void> {
        await write(tx,'INSERT INTO transit_delivery_receipts(node_id,session_epoch,report_sequence,envelope_digest,request_digest,received_at) VALUES(?,?,?,?,?,?)',[row.node,row.epoch,row.sequence,row.envelopeDigest,row.requestDigest,row.receivedAt]);
    }
    async acknowledge(tx:Transaction,envelopeDigest:string,at:number):Promise<number> {
        return write(tx,"UPDATE transit_delivery_outbox SET state='acknowledged',acknowledged_at=? WHERE envelope_digest=? AND state='pending'",[at,envelopeDigest]);
    }
}
