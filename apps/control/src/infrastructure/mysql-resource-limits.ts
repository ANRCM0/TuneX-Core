import type { SharedResourceLimitRecord, SharedResourceLimitStore } from '../framework/public.ts';
import { ControlError } from '../framework/public.ts';
import { json, rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

const fields='bucket_id bucketId,scope_id scopeId,node_id nodeId,actor_id actorId,revision,starts_at startsAt,ends_at endsAt,bytes_per_second bytesPerSecond,burst_bytes burstBytes,byte_limit byteLimit';

/** This adapter writes only its own policy, receipt and audit tables. */
export class MySqlSharedResourceLimitStore implements SharedResourceLimitStore<Transaction> {
    async lock(tx:Transaction,nodeId:string,actorId:string):Promise<void> {
        await write(tx,'INSERT IGNORE INTO shared_resource_limit_heads(node_id,actor_id,revision) VALUES(?,?,0)',[nodeId,actorId]);
        await rows(tx,'SELECT revision FROM shared_resource_limit_heads WHERE node_id=? AND actor_id=? FOR UPDATE',[nodeId,actorId]);
    }
    async current(tx:Transaction,nodeId:string,actorId:string):Promise<SharedResourceLimitRecord|undefined> {
        const head=(await rows<{bucket_id:string|null;revision:number}>(tx,
            'SELECT bucket_id,revision FROM shared_resource_limit_heads WHERE node_id=? AND actor_id=? FOR SHARE',[nodeId,actorId]))[0];
        if(!head)return undefined;
        if(head.bucket_id===null){
            if(head.revision!==0)throw new ControlError('INTEGRITY_FAILURE',409,'Resource limit head is missing its protected bucket');
            return undefined;
        }
        const record=(await rows<SharedResourceLimitRecord>(tx,`SELECT ${fields} FROM shared_resource_limit_buckets WHERE bucket_id=? FOR SHARE`,[head.bucket_id]))[0];
        if(!record||record.revision!==head.revision||record.nodeId!==nodeId||record.actorId!==actorId)
            throw new ControlError('INTEGRITY_FAILURE',409,'Resource limit head does not match its protected bucket');
        return record;
    }
    async history(tx:Transaction,nodeId:string,actorId:string):Promise<SharedResourceLimitRecord[]> {
        const history=await rows<SharedResourceLimitRecord>(tx,`SELECT ${fields} FROM shared_resource_limit_buckets WHERE node_id=? AND actor_id=? ORDER BY starts_at,bucket_id LIMIT 1025 FOR SHARE`,[nodeId,actorId]);
        if(history.length>1024)throw new ControlError('RESOURCE_LIMIT',429,'Protected resource limit history capacity exceeded');
        return history;
    }
    async save(tx:Transaction,record:SharedResourceLimitRecord,expectedRevision:number):Promise<boolean> {
        const current=await this.current(tx,record.nodeId,record.actorId);
        if((current?.revision??0)!==expectedRevision||record.revision!==expectedRevision+1)return false;
        const existing=(await rows<SharedResourceLimitRecord>(tx,`SELECT ${fields} FROM shared_resource_limit_buckets WHERE bucket_id=? FOR UPDATE`,[record.bucketId]))[0];
        if(existing){
            if(existing.scopeId!==record.scopeId||existing.nodeId!==record.nodeId||existing.actorId!==record.actorId||
                existing.startsAt!==record.startsAt||existing.endsAt!==record.endsAt||current?.bucketId!==record.bucketId)
                throw new ControlError('INTEGRITY_FAILURE',409,'Resource limit bucket identity is immutable');
            if(await write(tx,'UPDATE shared_resource_limit_buckets SET revision=?,bytes_per_second=?,burst_bytes=?,byte_limit=? WHERE bucket_id=? AND revision=?',
                [record.revision,record.bytesPerSecond,record.burstBytes,record.byteLimit,record.bucketId,expectedRevision])!==1)return false;
        }else await write(tx,'INSERT INTO shared_resource_limit_buckets(bucket_id,scope_id,node_id,actor_id,revision,starts_at,ends_at,bytes_per_second,burst_bytes,byte_limit) VALUES(?,?,?,?,?,?,?,?,?,?)',
            [record.bucketId,record.scopeId,record.nodeId,record.actorId,record.revision,record.startsAt,record.endsAt,record.bytesPerSecond,record.burstBytes,record.byteLimit]);
        if(await write(tx,'UPDATE shared_resource_limit_heads SET bucket_id=?,revision=? WHERE node_id=? AND actor_id=? AND revision=?',
            [record.bucketId,record.revision,record.nodeId,record.actorId,expectedRevision])!==1)
            throw new ControlError('REVISION_CONFLICT',409,'Resource limit head changed during save');
        return true;
    }
    async replay(tx:Transaction,scopeId:string,actorId:string,requestId:string) {
        const receipt=(await rows<{requestDigest:string;response:unknown}>(tx,
            'SELECT request_digest requestDigest,response FROM shared_resource_limit_requests WHERE scope_id=? AND actor_id=? AND request_id=? FOR UPDATE',[scopeId,actorId,requestId]))[0];
        return receipt&&{requestDigest:receipt.requestDigest,response:json(receipt.response)};
    }
    async receipt(tx:Transaction,scopeId:string,actorId:string,requestId:string,requestDigest:string,response:unknown):Promise<void> {
        try {
            await write(tx,'INSERT INTO shared_resource_limit_requests(scope_id,actor_id,request_id,request_digest,response) VALUES(?,?,?,?,?)',
                [scopeId,actorId,requestId,requestDigest,JSON.stringify(response)]);
        }catch(error){
            // Different Node locks can race on the same actor-scoped request key.
            if((error as {code?:string}).code==='ER_DUP_ENTRY')
                throw new ControlError('IDEMPOTENCY_CONFLICT',409,'Request identity was concurrently claimed');
            throw error;
        }
    }
    async audit(tx:Transaction,eventId:string,actorId:string,record:SharedResourceLimitRecord,at:number):Promise<void> {
        await write(tx,'INSERT INTO shared_resource_limit_audit(event_id,actor_id,bucket_id,at_ms,body) VALUES(?,?,?,?,?)',
            [eventId,actorId,record.bucketId,at,JSON.stringify(record)]);
    }
}
