import type { TransitCoordinationStorage, TransitStoredCoordination, TransitCoordinationInsert, TransitCoordinationUpdate, TransitStoredStage } from '../framework/public.ts';
import { rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

/** Original offline journal SQL; no transaction, admission or phase decisions. */
export class MySqlTransitCoordinationStore<Phase extends string=string> implements TransitCoordinationStorage<Transaction,Phase> {
    async stage(tx:Transaction,scope:string,forward:string,generation:number):Promise<TransitStoredStage|undefined> {
        return (await rows<TransitStoredStage>(tx,
            'SELECT * FROM transit_deployments WHERE forward_id=? AND generation=? AND scope_id=? FOR UPDATE',
            [forward,generation,scope]))[0];
    }
    async recoveryStage(tx:Transaction,forward:string,generation:number):Promise<TransitStoredStage|undefined> {
        return (await rows<TransitStoredStage>(tx,
            'SELECT * FROM transit_deployments WHERE forward_id=? AND generation=? FOR UPDATE',
            [forward,generation]))[0];
    }
    async session(tx:Transaction,node:string):Promise<{session_epoch:number}|undefined> {
        return (await rows<{session_epoch:number}>(tx,
            'SELECT session_epoch FROM runtime_nodes WHERE node_id=? FOR UPDATE',[node]))[0];
    }
    async slot(tx:Transaction,node:string,protocol:'tcp'|'udp',port:number):Promise<{owner_id:string|null;fence:number;deployment_generation:number}|undefined> {
        return (await rows<{owner_id:string|null;fence:number;deployment_generation:number}>(tx,
            'SELECT owner_id,fence,deployment_generation FROM port_slots WHERE node_id=? AND protocol=? AND port=? FOR UPDATE',
            [node,protocol,port]))[0];
    }
    async journal(tx:Transaction,forward:string,generation:number):Promise<TransitStoredCoordination<Phase>|undefined> {
        return (await rows<TransitStoredCoordination<Phase>>(tx,
            'SELECT * FROM transit_coordination WHERE forward_id=? AND generation=? FOR UPDATE',
            [forward,generation]))[0];
    }
    async recovering(tx:Transaction):Promise<TransitStoredCoordination<Phase>[]> {
        return rows<TransitStoredCoordination<Phase>>(tx,
            "SELECT * FROM transit_coordination WHERE phase IN ('preparing','activating','sealed') ORDER BY forward_id,generation FOR UPDATE");
    }
    async insert(tx:Transaction,row:TransitCoordinationInsert<Phase>):Promise<void> {
        await write(tx,'INSERT INTO transit_coordination(forward_id,generation,plan_digest,phase,position,revision,receipt_highwater,journal_digest,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
            [row.forward_id,row.generation,row.plan_digest,row.phase,row.position,row.revision,row.receipt_highwater,row.journal_digest,row.created_at,row.updated_at]);
    }
    async update(tx:Transaction,row:TransitCoordinationUpdate<Phase>):Promise<number> {
        return write(tx,
            'UPDATE transit_coordination SET phase=?,position=?,revision=?,receipt_highwater=?,journal_digest=?,updated_at=? WHERE forward_id=? AND generation=? AND revision=? AND journal_digest=?',
            [row.phase,row.position,row.revision,row.receipt_highwater,row.journal_digest,row.updated_at,row.forward_id,row.generation,row.previous_revision,row.previous_journal_digest]);
    }
}
