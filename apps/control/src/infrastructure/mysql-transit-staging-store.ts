import type { TransitStoredStage, TransitStageInsert, TransitStagingStorage } from '../framework/public.ts';
import { rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

/** Original staging SQL; resource writes stay with MySqlRuntimeResourceStore. */
export class MySqlTransitStagingStore implements TransitStagingStorage<Transaction> {
    async latest(tx:Transaction,forward:string):Promise<TransitStoredStage|undefined> {
        return (await rows<TransitStoredStage>(tx,
            'SELECT * FROM transit_deployments WHERE forward_id=? ORDER BY generation DESC LIMIT 1 FOR UPDATE',[forward]))[0];
    }
    async stage(tx:Transaction,scope:string,forward:string,generation:number):Promise<TransitStoredStage|undefined> {
        return (await rows<TransitStoredStage>(tx,
            'SELECT * FROM transit_deployments WHERE forward_id=? AND generation=? AND scope_id=? FOR UPDATE',
            [forward,generation,scope]))[0];
    }
    async session(tx:Transaction,node:string):Promise<{session_epoch:number}|undefined> {
        return (await rows<{session_epoch:number}>(tx,
            'SELECT session_epoch FROM runtime_nodes WHERE node_id=? FOR UPDATE',[node]))[0];
    }
    async lockedNodes(tx:Transaction,node:string):Promise<{node_id:string}[]> {
        return rows<{node_id:string}>(tx,'SELECT node_id FROM runtime_nodes WHERE node_id=? FOR UPDATE',[node]);
    }
    async candidateOwner(tx:Transaction,node:string,port:number):Promise<{owner_id:string|null}|undefined> {
        return (await rows<{owner_id:string|null}>(tx,
            "SELECT owner_id FROM port_slots WHERE node_id=? AND protocol='tcp' AND port=?",[node,port]))[0];
    }
    async physicalOwner(tx:Transaction,node:string,protocol:'tcp'|'udp',port:number):Promise<{owner_id:string|null}|undefined> {
        return (await rows<{owner_id:string|null}>(tx,
            'SELECT owner_id FROM port_slots WHERE node_id=? AND protocol=? AND port=?',[node,protocol,port]))[0];
    }
    async coordination(tx:Transaction,forward:string,generation:number):Promise<{generation:number}[]> {
        return rows<{generation:number}>(tx,
            'SELECT generation FROM transit_coordination WHERE forward_id=? AND generation=? FOR UPDATE',[forward,generation]);
    }
    async maximumLease(tx:Transaction,forward:string):Promise<{until:number|null}|undefined> {
        return (await rows<{until:number|null}>(tx,
            'SELECT MAX(valid_until) until FROM execution_leases WHERE forward_id=?',[forward]))[0];
    }
    async snapshots(tx:Transaction,node:string,after:number):Promise<{body:unknown}[]> {
        return rows<{body:unknown}>(tx,'SELECT body FROM snapshots WHERE node_id=? AND valid_until>?',[node,after]);
    }
    async insert(tx:Transaction,row:TransitStageInsert):Promise<void> {
        await write(tx,
            'INSERT INTO transit_deployments(forward_id,generation,target_revision,scope_id,created_by,state,expires_at,plan_digest,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
            [row.forward_id,row.generation,row.target_revision,row.scope_id,row.created_by,row.state,row.expires_at,row.plan_digest,row.body,row.created_at,row.updated_at]);
    }
    async abort(tx:Transaction,forward:string,generation:number,now:number):Promise<number> {
        return write(tx,
            "UPDATE transit_deployments SET state='aborted',updated_at=? WHERE forward_id=? AND generation=? AND state='reserved'",
            [now,forward,generation]);
    }
}
