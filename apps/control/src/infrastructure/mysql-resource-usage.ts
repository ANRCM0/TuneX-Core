import type { ResourceUsageStore, ResourceUsageReceipt, ResourceUsageSample,
    ResourceUsageReportReference, SharedResourceLimitRecord } from '../framework/public.ts';
import { rows, write, json } from './mysql.ts';
import type { Transaction } from './mysql.ts';

const sampleFields='bucket_id bucketId,scope_id scopeId,node_id nodeId,actor_id actorId,revision,starts_at startsAt,ends_at endsAt,consumed_bytes consumedBytes,session_epoch sessionEpoch,report_sequence reportSequence,snapshot_generation snapshotGeneration,received_at receivedAt';
/** Resource-limit owner's projection, never an execution ledger or payload authority. */
export class MySqlResourceUsageStore implements ResourceUsageStore<Transaction> {
    async lockReport(tx:Transaction,node:string):Promise<ResourceUsageReportReference|undefined> {
        const row=(await rows<{session_epoch:number;boot_id:string|null;last_report_sequence:number;last_report:unknown;received_at:number|null}>(tx,
            'SELECT session_epoch,boot_id,last_report_sequence,last_report,received_at FROM runtime_nodes WHERE node_id=? FOR UPDATE',[node]))[0];
        if(!row||!row.boot_id||!row.last_report||row.received_at===null)return undefined;
        const report=json<{nodeId:string;bootId:string;sessionEpoch:number;reportSequence:number;acceptedSnapshotGeneration:number}>(row.last_report);
        if(report.nodeId!==node||report.bootId!==row.boot_id||report.sessionEpoch!==row.session_epoch||report.reportSequence!==row.last_report_sequence)return undefined;
        return {bootId:row.boot_id,sessionEpoch:row.session_epoch,reportSequence:row.last_report_sequence,
            snapshotGeneration:report.acceptedSnapshotGeneration,receivedAt:row.received_at};
    }
    async lockHead(tx:Transaction,node:string):Promise<ResourceUsageReceipt|undefined> {
        return (await rows<ResourceUsageReceipt>(tx,'SELECT session_epoch sessionEpoch,report_sequence reportSequence,digest FROM resource_usage_heads WHERE node_id=? FOR UPDATE',[node]))[0];
    }
    async policy(tx:Transaction,bucket:string):Promise<SharedResourceLimitRecord|undefined> {
        return (await rows<SharedResourceLimitRecord>(tx,'SELECT bucket_id bucketId,scope_id scopeId,node_id nodeId,actor_id actorId,revision,starts_at startsAt,ends_at endsAt,bytes_per_second bytesPerSecond,burst_bytes burstBytes,byte_limit byteLimit FROM shared_resource_limit_buckets WHERE bucket_id=? FOR SHARE',[bucket]))[0];
    }
    async sample(tx:Transaction,bucket:string):Promise<ResourceUsageSample|undefined> {
        return (await rows<ResourceUsageSample>(tx,`SELECT ${sampleFields} FROM resource_usage_samples WHERE bucket_id=?`,[bucket]))[0];
    }
    async session(tx:Transaction,node:string) {
        return (await rows<{session_epoch:number}>(tx,'SELECT session_epoch FROM runtime_nodes WHERE node_id=?',[node]))[0]?.session_epoch;
    }
    async save(tx:Transaction,sample:ResourceUsageSample):Promise<void> {
        await write(tx,'INSERT INTO resource_usage_samples(bucket_id,scope_id,node_id,actor_id,revision,starts_at,ends_at,consumed_bytes,session_epoch,report_sequence,snapshot_generation,received_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE revision=VALUES(revision),consumed_bytes=VALUES(consumed_bytes),session_epoch=VALUES(session_epoch),report_sequence=VALUES(report_sequence),snapshot_generation=VALUES(snapshot_generation),received_at=VALUES(received_at)',
            [sample.bucketId,sample.scopeId,sample.nodeId,sample.actorId,sample.revision,sample.startsAt,sample.endsAt,
                sample.consumedBytes,sample.sessionEpoch,sample.reportSequence,sample.snapshotGeneration,sample.receivedAt]);
    }
    async receipt(tx:Transaction,node:string,value:ResourceUsageReceipt):Promise<void> {
        await write(tx,'INSERT INTO resource_usage_heads(node_id,session_epoch,report_sequence,digest) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE session_epoch=VALUES(session_epoch),report_sequence=VALUES(report_sequence),digest=VALUES(digest)',
            [node,value.sessionEpoch,value.reportSequence,value.digest]);
    }
}
