import type { Observation, RuntimeAssignment, RuntimeMessages, RuntimeSnapshot } from '@tunex/contracts/runtime';
import type { RuntimeNodeState, RuntimeStateStore, RuntimeWorkRecord } from '../framework/public.ts';
import type { NativeRuntimeFamily } from '../compatibility/public.ts';
import { json, rows, write } from './mysql.ts';
import type { MySqlUnitOfWork, Transaction } from './mysql.ts';

/** Existing authoritative SQL and lock order, behind the host's transaction ports. */
export class MySqlRuntimeStateStore implements RuntimeStateStore<Transaction,NativeRuntimeFamily> {
    private readonly db:Pick<MySqlUnitOfWork,'pool'>;
    constructor(db:Pick<MySqlUnitOfWork,'pool'>) {this.db=db;}
    async lockNode(tx:Transaction,nodeId:string):Promise<RuntimeNodeState|undefined> {
        return (await rows<RuntimeNodeState>(tx,'SELECT * FROM runtime_nodes WHERE node_id=? FOR UPDATE',[nodeId]))[0];
    }
    async boot(tx:Transaction,nodeId:string,bootId:string):Promise<{session_epoch:number}|undefined> {
        return (await rows<{session_epoch:number}>(tx,'SELECT session_epoch FROM node_boots WHERE node_id=? AND boot_id=?',[nodeId,bootId]))[0];
    }
    async beginBoot(tx:Transaction,nodeId:string,bootId:string,epoch:number):Promise<void> {
        await write(tx,'INSERT INTO node_boots(node_id,boot_id,session_epoch) VALUES(?,?,?)',[nodeId,bootId,epoch]);
        await write(tx,'UPDATE runtime_nodes SET session_epoch=?,boot_id=?,last_report_sequence=0,last_report=NULL,received_at=NULL WHERE node_id=?',[epoch,bootId,nodeId]);
    }
    async snapshot(tx:Transaction,nodeId:string,generation:number,epoch?:number):Promise<RuntimeSnapshot|undefined> {
        const record=(epoch===undefined?
            await rows<{body:unknown}>(tx,'SELECT body FROM snapshots WHERE node_id=? AND generation=?',[nodeId,generation]):
            await rows<{body:unknown}>(tx,'SELECT body FROM snapshots WHERE node_id=? AND generation=? AND session_epoch=?',[nodeId,generation,epoch]))[0];
        return record?json<RuntimeSnapshot>(record.body):undefined;
    }
    async awaitingClaim(tx:Transaction,nodeId:string):Promise<number> {
        return (await rows<{n:number}>(tx,"SELECT COUNT(*) n FROM operations o JOIN forwards f ON f.id=o.forward_id AND f.revision=o.target_revision WHERE o.status='accepted' AND JSON_UNQUOTE(JSON_EXTRACT(f.spec,'$.ingress.nodeId'))=?",[nodeId]))[0]!.n;
    }
    async operation(tx:Transaction,id:string):Promise<RuntimeWorkRecord|undefined> {
        return (await rows<RuntimeWorkRecord>(tx,'SELECT * FROM operations WHERE id=? FOR UPDATE',[id]))[0];
    }
    async saveSnapshot(tx:Transaction,snapshot:RuntimeSnapshot):Promise<void> {
        await write(tx,'INSERT INTO snapshots(node_id,generation,session_epoch,valid_until,body) VALUES(?,?,?,?,?)',
            [snapshot.nodeId,snapshot.snapshotGeneration,snapshot.sessionEpoch,Date.parse(snapshot.validUntil),JSON.stringify(snapshot)]);
        await write(tx,'UPDATE runtime_nodes SET snapshot_generation=? WHERE node_id=?',[snapshot.snapshotGeneration,snapshot.nodeId]);
    }
    async cleanupNodeIDs():Promise<string[]> {
        const records=await rows<{node_id:string}>(this.db.pool,"SELECT node_id FROM retirements WHERE safe=FALSE UNION SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(f.spec,'$.ingress.nodeId')) AS CHAR CHARACTER SET ascii) COLLATE ascii_bin node_id FROM operations o JOIN forwards f ON f.id=o.forward_id WHERE o.cleanup_pending=TRUE AND o.status='failed' LIMIT 20");
        return records.map(record=>record.node_id);
    }
    async reportDigest(tx:Transaction,nodeId:string,epoch:number,sequence:number):Promise<string|undefined> {
        return (await rows<{request_digest:string}>(tx,'SELECT request_digest FROM reports WHERE node_id=? AND session_epoch=? AND sequence=?',[nodeId,epoch,sequence]))[0]?.request_digest;
    }
    async saveReport(tx:Transaction,report:RuntimeMessages['ReportRequest'],requestDigest:string,receivedAt:number):Promise<void> {
        await write(tx,'INSERT INTO reports(node_id,session_epoch,sequence,request_digest) VALUES(?,?,?,?)',
            [report.nodeId,report.sessionEpoch,report.reportSequence,requestDigest]);
        await write(tx,'UPDATE runtime_nodes SET last_report_sequence=?,last_report=?,received_at=? WHERE node_id=?',
            [report.reportSequence,JSON.stringify(report),receivedAt,report.nodeId]);
    }
    async failExecution(tx:Transaction,assignment:RuntimeAssignment,observation:Observation,at:number):Promise<void> {
        await write(tx,"UPDATE operations SET last_error=?,updated_at=?,status=IF(?,'running','failed'),cleanup_pending=IF(?,cleanup_pending,TRUE) WHERE forward_id=? AND target_revision=? AND status='running'",
            [JSON.stringify({code:observation.errorCode,retryable:observation.retryable}),at,observation.retryable,observation.retryable,assignment.forwardId,assignment.forwardRevision]);
    }
}
