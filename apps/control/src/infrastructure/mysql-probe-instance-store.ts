import { ControlError } from '../framework/public.ts';
import type { ProbeInstanceStoredRecord, ProbeInstanceStorage, ProbeInstanceStorageValues } from '../framework/public.ts';
import { rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

interface Row {
    node_id:string;generation:number;boot_id:string|null;session_epoch:number|null;
    fingerprint:string|null;instance_id:string|null;state:string;
    registered_at:number|null;expires_at:number|null;revoked_at:number|null;
}
function record<Value extends ProbeInstanceStoredRecord>(row:Row|undefined,nodeId:string,values:ProbeInstanceStorageValues<Value>):Value|undefined {
    if (!row) return undefined;
    const empty = row.state === 'empty' && row.generation === 0 &&
        [row.boot_id, row.session_epoch, row.fingerprint, row.instance_id, row.registered_at, row.expires_at, row.revoked_at].every(v => v === null);
    if (row.node_id === nodeId && empty) return undefined;
    return values.read({nodeId:row.node_id,generation:row.generation,bootId:row.boot_id!,sessionEpoch:row.session_epoch!,
        fingerprint:row.fingerprint!,instanceId:row.instance_id!,state:row.state,
        registeredAt:row.registered_at!,expiresAt:row.expires_at!,revokedAt:row.revoked_at},nodeId);
}

/** One supplied transaction; native row mapping never registers or authorizes a slot. */
export class MySqlProbeInstanceStore<Value extends ProbeInstanceStoredRecord> implements ProbeInstanceStorage<Transaction,Value> {
    private readonly values:ProbeInstanceStorageValues<Value>;
    constructor(values:ProbeInstanceStorageValues<Value>) {this.values=values;}
    async readCurrent(tx:Transaction,nodeId:string):Promise<Value|undefined> {
        return record((await rows<Row>(tx, 'SELECT * FROM probe_instances WHERE node_id=? FOR SHARE', [nodeId]))[0],nodeId,this.values);
    }
    async read(tx:Transaction,nodeId:string):Promise<Value|undefined> {
        return record((await rows<Row>(tx, 'SELECT * FROM probe_instances WHERE node_id=?', [nodeId]))[0],nodeId,this.values);
    }
    async lock(tx:Transaction,nodeId:string):Promise<Value|undefined> {
        // The no-op upsert serializes an absent slot; a failed acceptance rolls it back.
        await write(tx, 'INSERT INTO probe_instances(node_id) VALUES(?) ON DUPLICATE KEY UPDATE node_id=VALUES(node_id)', [nodeId]);
        return record((await rows<Row>(tx, 'SELECT * FROM probe_instances WHERE node_id=? FOR UPDATE', [nodeId]))[0],nodeId,this.values);
    }
    async replace(tx:Transaction,expectedGeneration:number,next:Value):Promise<void> {
        record({node_id:next.nodeId,generation:next.generation,boot_id:next.bootId,session_epoch:next.sessionEpoch,
            fingerprint:next.fingerprint,instance_id:next.instanceId,state:next.state,
            registered_at:next.registeredAt,expires_at:next.expiresAt,revoked_at:next.revokedAt},next.nodeId,this.values);
        const closing=this.values.closing(expectedGeneration,next);
        const match = closing ? " AND state='registered' AND boot_id=? AND session_epoch=? AND fingerprint=? AND instance_id=? AND registered_at=? AND expires_at=?" : '';
        const changed = await write(tx, `UPDATE probe_instances SET generation=?,boot_id=?,session_epoch=?,fingerprint=?,
            instance_id=?,state=?,registered_at=?,expires_at=?,revoked_at=? WHERE node_id=? AND generation=?${match}`,
        [next.generation, next.bootId, next.sessionEpoch, next.fingerprint, next.instanceId, next.state,
            next.registeredAt, next.expiresAt, next.revokedAt, next.nodeId, expectedGeneration,
            ...(closing ? [next.bootId, next.sessionEpoch, next.fingerprint, next.instanceId, next.registeredAt, next.expiresAt] : [])]);
        if (changed !== 1) throw new ControlError('PROBE_INSTANCE_CONFLICT', 409, 'Probe instance changed');
    }
    static async quarantineRecovery(tx:Transaction):Promise<void> {
        await write(tx, "UPDATE probe_instances SET state='quarantined',revoked_at=? WHERE generation>0", [Date.now()]);
    }
}
