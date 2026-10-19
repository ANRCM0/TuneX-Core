import type { RuntimeAssignment, RuntimeSnapshot } from '@tunex/contracts/runtime';
import type { NativeRuntimeFamily } from '../compatibility/public.ts';
import type { RuntimeAcceptedOperation, RuntimeAssignmentSlot, RuntimeLedgerStore, RuntimeOperation,
    RuntimeQuarantineSnapshot, RuntimeRetirement, RuntimeRetirementKey, RuntimeSnapshotRecord } from '../framework/public.ts';
import { rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

const retirementArgs=(key:RuntimeRetirementKey):unknown[]=>[key.node_id,key.assignment_id,key.deployment_generation,key.binding_fence];
async function count(tx:Transaction,sql:string,args:unknown[]):Promise<number> {
    return (await rows<{n:number}>(tx,sql,args))[0]!.n;
}

/** Original ledger tables and locking SQL, always in the owner's supplied transaction. */
export class MySqlRuntimeLedgerStore implements RuntimeLedgerStore<Transaction,NativeRuntimeFamily> {
    async beginQuarantine(tx:Transaction):Promise<RuntimeQuarantineSnapshot[]> {
        await write(tx,'UPDATE operations SET recovery_invalidated=TRUE,claim_token=NULL,claim_until=NULL');
        await write(tx,'UPDATE retirements SET safe=TRUE');
        await write(tx,'UPDATE runtime_nodes SET last_report=NULL,received_at=NULL');
        return rows(tx,'SELECT s.node_id,s.generation,s.body FROM snapshots s JOIN runtime_nodes r ON r.node_id=s.node_id AND r.snapshot_generation=s.generation');
    }
    async quarantineRetirement(tx:Transaction,nodeId:string,a:RuntimeAssignment,operationId:string,generation:number):Promise<void> {
        await write(tx,'INSERT INTO retirements(node_id,assignment_id,deployment_generation,binding_fence,forward_id,operation_id,body,retirement_generation,safe) VALUES(?,?,?,?,?,?,?,?,TRUE) ON DUPLICATE KEY UPDATE safe=TRUE',[nodeId,a.assignmentId,a.deploymentGeneration,a.bindingFence,a.forwardId,operationId,JSON.stringify(a),generation]);
    }
    assignmentOperations(tx:Transaction,forwardIds:readonly string[]):Promise<RuntimeOperation[]> {
        const placeholders=forwardIds.map(()=>'?').join(',');
        return rows(tx,`SELECT * FROM operations WHERE forward_id IN (${placeholders}) ORDER BY created_at DESC,id DESC FOR UPDATE`,[...forwardIds]);
    }
    assignmentSlots(tx:Transaction,nodeId:string):Promise<RuntimeAssignmentSlot[]> {
        return rows(tx,'SELECT * FROM port_slots WHERE node_id=? AND owner_id IS NOT NULL',[nodeId]);
    }
    async latestSnapshot(tx:Transaction,nodeId:string):Promise<RuntimeSnapshotRecord|undefined> {
        return (await rows<RuntimeSnapshotRecord>(tx,'SELECT body FROM snapshots WHERE node_id=? ORDER BY generation DESC LIMIT 1',[nodeId]))[0];
    }
    async nodeSession(tx:Transaction,nodeId:string):Promise<{session_epoch:number}|undefined> {
        return (await rows<{session_epoch:number}>(tx,'SELECT session_epoch FROM runtime_nodes WHERE node_id=?',[nodeId]))[0];
    }
    async operationForRevision(tx:Transaction,forwardId:string,revision:number):Promise<RuntimeOperation|undefined> {
        return (await rows<RuntimeOperation>(tx,'SELECT * FROM operations WHERE forward_id=? AND target_revision=? ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE',[forwardId,revision]))[0];
    }
    async latestOperation(tx:Transaction,forwardId:string):Promise<RuntimeOperation|undefined> {
        return (await rows<RuntimeOperation>(tx,'SELECT * FROM operations WHERE forward_id=? ORDER BY target_revision DESC,created_at DESC,id DESC LIMIT 1',[forwardId]))[0];
    }
    async recordRelayError(tx:Transaction,operationId:string,error:unknown,at:number):Promise<void> {
        await write(tx,'UPDATE operations SET last_error=?,updated_at=? WHERE id=?',[JSON.stringify(error),at,operationId]);
    }
    async failRelayOperation(tx:Transaction,operationId:string,error:unknown,at:number):Promise<void> {
        await write(tx,"UPDATE operations SET status='failed',last_error=?,cleanup_pending=TRUE,claim_token=NULL,claim_until=NULL,updated_at=? WHERE id=?",[JSON.stringify(error),at,operationId]);
    }
    async succeedRelayOperation(tx:Transaction,operationId:string,at:number,deadlineAt:number):Promise<void> {
        await write(tx,"UPDATE operations SET status='succeeded',cleanup_pending=FALSE,claim_token=NULL,claim_until=NULL,updated_at=? WHERE id=? AND status='running' AND execution_deadline>?",[at,operationId,deadlineAt]);
    }
    async clearTerminalRelayCleanup(tx:Transaction,forwardId:string,at:number):Promise<void> {
        await write(tx,"UPDATE operations SET cleanup_pending=FALSE,updated_at=? WHERE forward_id=? AND status IN ('succeeded','failed','superseded')",[at,forwardId]);
    }
    async denyIntent(tx:Transaction,operationId:string,at:number):Promise<void> {
        await write(tx,"UPDATE operations SET status='failed',last_error=?,cleanup_pending=TRUE,updated_at=? WHERE id=? AND status='accepted'",[JSON.stringify({code:'AUTHORIZATION_DENIED',retryable:false}),at,operationId]);
    }
    async acceptOperation(tx:Transaction,input:RuntimeAcceptedOperation):Promise<void> {
        const {id,forward,request,kind,at,executionDeadline,sourceOperationId,previousSpec}=input;
        await write(tx,"INSERT INTO operations(id,scope_id,forward_id,target_revision,kind,status,requested_by,idempotency_key,request_digest,created_at,updated_at,execution_deadline,source_operation_id,previous_spec) VALUES(?,?,?,? ,?,'accepted',?,?,?,?,?,?,?,?)",[id,forward.scopeId,forward.id,forward.revision,kind,request.actorId,request.key,request.digest,at,at,executionDeadline,sourceOperationId,previousSpec===null?null:JSON.stringify(previousSpec)]);
        await write(tx,"UPDATE operations SET status='superseded',superseded_by=?,claim_token=NULL,claim_until=NULL,updated_at=? WHERE forward_id=? AND id<>? AND status IN ('accepted','running')",[id,at,forward.id,id]);
        await write(tx,'UPDATE retirements SET operation_id=? WHERE forward_id=? AND safe=FALSE',[id,forward.id]);
    }
    async retireAssignment(tx:Transaction,nodeId:string,a:RuntimeAssignment,operationId:string,generation:number):Promise<void> {
        await write(tx,'INSERT INTO retirements(node_id,assignment_id,deployment_generation,binding_fence,forward_id,operation_id,body,retirement_generation) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE operation_id=VALUES(operation_id)',[nodeId,a.assignmentId,a.deploymentGeneration,a.bindingFence,a.forwardId,operationId,JSON.stringify(a),generation]);
        await write(tx,'UPDATE operations SET cleanup_pending=TRUE WHERE id=?',[operationId]);
    }
    async recordLeases(tx:Transaction,snapshot:RuntimeSnapshot):Promise<void> {
        for(const a of snapshot.assignments)
            await write(tx,'INSERT INTO execution_leases(forward_id,node_id,assignment_id,deployment_generation,binding_fence,session_epoch,valid_until) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE valid_until=GREATEST(valid_until,VALUES(valid_until))',[a.forwardId,snapshot.nodeId,a.assignmentId,a.deploymentGeneration,a.bindingFence,snapshot.sessionEpoch,Date.parse(snapshot.validUntil)]);
    }
    previousUnsafeLeases(tx:Transaction,forwardId:string,at:number):Promise<RuntimeRetirementKey[]> {
        return rows(tx,'SELECT l.node_id,l.assignment_id,l.deployment_generation,l.binding_fence FROM execution_leases l LEFT JOIN retirements r ON r.node_id=l.node_id AND r.assignment_id=l.assignment_id AND r.deployment_generation=l.deployment_generation AND r.binding_fence=l.binding_fence WHERE l.forward_id=? AND l.valid_until+5000>? AND (r.safe IS NULL OR r.safe=FALSE)',[forwardId,at]);
    }
    unsafeSessionLeaseCount(tx:Transaction,nodeId:string,epoch:number,at:number):Promise<number> {
        return count(tx,'SELECT COUNT(*) n FROM execution_leases l LEFT JOIN retirements r ON r.node_id=l.node_id AND r.assignment_id=l.assignment_id AND r.deployment_generation=l.deployment_generation AND r.binding_fence=l.binding_fence WHERE l.node_id=? AND l.session_epoch<>? AND l.valid_until+5000>? AND (r.safe IS NULL OR r.safe=FALSE)',[nodeId,epoch,at]);
    }
    retirements(tx:Transaction,nodeId:string):Promise<RuntimeRetirement[]> {
        return rows(tx,'SELECT * FROM retirements WHERE node_id=? ORDER BY retirement_generation,assignment_id',[nodeId]);
    }
    async retirement(tx:Transaction,key:RuntimeRetirementKey):Promise<RuntimeRetirement|undefined> {
        return (await rows<RuntimeRetirement>(tx,'SELECT * FROM retirements WHERE node_id=? AND assignment_id=? AND deployment_generation=? AND binding_fence=?',retirementArgs(key)))[0];
    }
    async instanceLease(tx:Transaction,key:RuntimeRetirementKey,epoch:number):Promise<{until:number|null}|undefined> {
        return (await rows<{until:number|null}>(tx,'SELECT MAX(valid_until) until FROM execution_leases WHERE node_id=? AND assignment_id=? AND deployment_generation=? AND binding_fence=? AND session_epoch=?',[...retirementArgs(key),epoch]))[0];
    }
    async markRemoved(tx:Transaction,key:RuntimeRetirementKey,epoch:number):Promise<void> {
        await write(tx,'UPDATE retirements SET removed_epoch=? WHERE node_id=? AND assignment_id=? AND deployment_generation=? AND binding_fence=?',[epoch,...retirementArgs(key)]);
    }
    unsafeRetirementsForUpdate(tx:Transaction,nodeId:string):Promise<RuntimeRetirement[]> {
        return rows(tx,'SELECT * FROM retirements WHERE node_id=? AND safe=FALSE FOR UPDATE',[nodeId]);
    }
    outstandingRetirementLeases(tx:Transaction,r:RuntimeRetirement,at:number):Promise<number> {
        return count(tx,'SELECT COUNT(*) n FROM execution_leases WHERE node_id=? AND assignment_id=? AND deployment_generation=? AND binding_fence=? AND valid_until+5000>? AND (session_epoch<>? OR ? IS NULL)',[...retirementArgs(r),at,r.removed_epoch,r.removed_epoch]);
    }
    async markRetirementSafe(tx:Transaction,key:RuntimeRetirementKey):Promise<void> {
        await write(tx,'UPDATE retirements SET safe=TRUE WHERE node_id=? AND assignment_id=? AND deployment_generation=? AND binding_fence=?',retirementArgs(key));
    }
    completionOperations(tx:Transaction,nodeId:string):Promise<RuntimeOperation[]> {
        // Lock only Operations: the caller already holds Node, not Forward.
        return rows(tx,"SELECT o.* FROM operations o JOIN forwards f ON f.id=o.forward_id AND f.revision=o.target_revision WHERE o.recovery_invalidated=FALSE AND JSON_UNQUOTE(JSON_EXTRACT(f.spec,'$.ingress.nodeId'))=? AND (o.status='running' OR o.cleanup_pending=TRUE) ORDER BY o.id FOR UPDATE OF o",[nodeId]);
    }
    pendingRetirementCount(tx:Transaction,forwardId:string):Promise<number> {
        return count(tx,'SELECT COUNT(*) n FROM retirements WHERE forward_id=? AND safe=FALSE',[forwardId]);
    }
    unsafeLeaseCount(tx:Transaction,forwardId:string):Promise<number> {
        return count(tx,'SELECT COUNT(*) n FROM execution_leases l LEFT JOIN retirements r ON r.node_id=l.node_id AND r.assignment_id=l.assignment_id AND r.deployment_generation=l.deployment_generation AND r.binding_fence=l.binding_fence WHERE l.forward_id=? AND (r.safe IS NULL OR r.safe=FALSE)',[forwardId]);
    }
    async completeOperation(tx:Transaction,id:string,at:number,clearClaim:boolean):Promise<void> {
        if(clearClaim)
            await write(tx,"UPDATE operations SET status=IF(status='running','succeeded',status),cleanup_pending=FALSE,claim_token=NULL,claim_until=NULL,updated_at=? WHERE id=?",[at,id]);
        else
            await write(tx,"UPDATE operations SET status=IF(status='running','succeeded',status),cleanup_pending=FALSE,updated_at=? WHERE id=?",[at,id]);
    }
    async clearFailedSupersededCleanup(tx:Transaction,forwardId:string):Promise<void> {
        await write(tx,"UPDATE operations SET cleanup_pending=FALSE WHERE forward_id=? AND status IN ('failed','superseded')",[forwardId]);
    }
    async clearOperationCleanup(tx:Transaction,operationId:string,at:number):Promise<void> {
        await write(tx,'UPDATE operations SET cleanup_pending=FALSE,updated_at=? WHERE id=?',[at,operationId]);
    }
    async getOperation(tx:Transaction,scopeId:string,id:string,lock:boolean):Promise<RuntimeOperation|undefined> {
        return (await rows<RuntimeOperation>(tx,`SELECT * FROM operations WHERE id=? AND scope_id=?${lock?' FOR UPDATE':''}`,[id,scopeId]))[0];
    }
    async expireOperations(tx:Transaction,at:number):Promise<void> {
        await write(tx,"UPDATE operations SET status='failed',last_error=?,cleanup_pending=TRUE,claim_token=NULL,claim_until=NULL,updated_at=? WHERE recovery_invalidated=FALSE AND status IN ('accepted','running') AND execution_deadline<=?",[JSON.stringify({code:'EXECUTION_DEADLINE',retryable:false}),at,at]);
    }
    async claimableOperation(tx:Transaction,at:number):Promise<RuntimeOperation|undefined> {
        return (await rows<RuntimeOperation>(tx,"SELECT * FROM operations WHERE recovery_invalidated=FALSE AND status IN ('accepted','running') AND (claim_until IS NULL OR claim_until<=?) AND execution_deadline>? ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED",[at,at]))[0];
    }
    async claimOperation(tx:Transaction,id:string,token:string,at:number,claimUntil:number):Promise<void> {
        await write(tx,"UPDATE operations SET status='running',claim_token=?,claim_until=?,attempt_count=attempt_count+1,updated_at=? WHERE id=?",[token,claimUntil,at,id]);
    }
}
