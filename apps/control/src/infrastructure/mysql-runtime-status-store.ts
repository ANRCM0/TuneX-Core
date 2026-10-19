import type { RuntimeStatusNodeRecord, RuntimeStatusSnapshotRecord, RuntimeStatusStorageReader } from '../framework/public.ts';
import { rows } from './mysql.ts';
import type { Transaction } from './mysql.ts';

/** Original SELECTs, with the caller's transaction and no decoding or freshness decision. */
export class MySqlRuntimeStatusStore implements RuntimeStatusStorageReader<Transaction> {
    async node(tx:Transaction,nodeId:string):Promise<RuntimeStatusNodeRecord|undefined> {
        return (await rows<RuntimeStatusNodeRecord>(tx,'SELECT * FROM runtime_nodes WHERE node_id=?',[nodeId]))[0];
    }
    async currentSnapshot(tx:Transaction,nodeId:string,generation:number):Promise<RuntimeStatusSnapshotRecord|undefined> {
        return (await rows<RuntimeStatusSnapshotRecord>(tx,
            'SELECT body FROM snapshots WHERE node_id=? AND generation=?',[nodeId,generation]))[0];
    }
    async reportedSnapshot(tx:Transaction,nodeId:string,generation:number,epoch:number):Promise<RuntimeStatusSnapshotRecord|undefined> {
        return (await rows<RuntimeStatusSnapshotRecord>(tx,
            'SELECT body FROM snapshots WHERE node_id=? AND generation=? AND session_epoch=?',
            [nodeId,generation,epoch]))[0];
    }
}
