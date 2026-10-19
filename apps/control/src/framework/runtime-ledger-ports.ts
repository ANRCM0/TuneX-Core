import type { Forward } from '@tunex/core';
import type { Policy } from '@tunex/contracts/policy';
import type { RuntimeValueFamily, RuntimeAssignmentFor, RuntimeSnapshotFor } from '@tunex/contracts/execution-values';
import type { RequestIdentity } from './application-ports.ts';
import type { AuthorizedNodeFacts } from './node-facts.ts';
import type { RuntimeSnapshotInput } from './runtime-host-ports.ts';
import type { ReservedSlot, RuntimeResourceAccess } from './runtime-resource-ports.ts';
import type { SnapshotAssignmentCollector } from './runtime-assignment-ports.ts';

export const RUNTIME_LEDGER_INTERFACE_VERSION=3 as const;

export interface RuntimeOperation {
    id:string;
    scope_id:string;
    forward_id:string;
    target_revision:number;
    kind:'create'|'update'|'enable'|'disable'|'delete'|'retry'|'policy'|'revoke';
    status:'accepted'|'running'|'succeeded'|'failed'|'superseded';
    execution_deadline:number;
    claim_token:string|null;
    claim_until:number|null;
    cleanup_pending:number;
    last_error:unknown;
    source_operation_id:string|null;
    previous_spec:unknown;
    created_at:number;
    requested_by:string;
    recovery_invalidated:number;
}
export interface RuntimeRetirementKey {
    node_id:string;
    assignment_id:string;
    deployment_generation:number;
    binding_fence:number;
}
export interface RuntimeRetirement extends RuntimeRetirementKey {
    forward_id:string;
    operation_id:string;
    body:unknown;
    removed_epoch:number|null;
    retirement_generation:number;
    safe:number;
}
export interface RuntimeAssignmentSlot {
    owner_id:string;
    protocol:'tcp'|'udp';
    port:number;
    fence:number;
    deployment_generation:number;
}
export interface RuntimeSnapshotRecord { body:unknown }
export interface RuntimeQuarantineSnapshot extends RuntimeSnapshotRecord { node_id:string;generation:number }
export interface RuntimeAcceptedOperation {
    id:string;
    forward:Forward;
    request:RequestIdentity;
    kind:RuntimeOperation['kind'];
    at:number;
    executionDeadline:number;
    sourceOperationId:string|null;
    previousSpec:unknown;
}
/** Storage only: no implicit transaction, authorization, clock, UUID or retry. */
export interface RuntimeLedgerStore<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    beginQuarantine(tx:Tx):Promise<RuntimeQuarantineSnapshot[]>;
    quarantineRetirement(tx:Tx,nodeId:string,assignment:RuntimeAssignmentFor<F>,operationId:string,generation:number):Promise<void>;
    assignmentOperations(tx:Tx,forwardIds:readonly string[]):Promise<RuntimeOperation[]>;
    assignmentSlots(tx:Tx,nodeId:string):Promise<RuntimeAssignmentSlot[]>;
    latestSnapshot(tx:Tx,nodeId:string):Promise<RuntimeSnapshotRecord|undefined>;
    nodeSession(tx:Tx,nodeId:string):Promise<{session_epoch:number}|undefined>;
    operationForRevision(tx:Tx,forwardId:string,revision:number):Promise<RuntimeOperation|undefined>;
    latestOperation(tx:Tx,forwardId:string):Promise<RuntimeOperation|undefined>;
    recordRelayError(tx:Tx,operationId:string,error:unknown,at:number):Promise<void>;
    failRelayOperation(tx:Tx,operationId:string,error:unknown,at:number):Promise<void>;
    succeedRelayOperation(tx:Tx,operationId:string,at:number,deadlineAt:number):Promise<void>;
    clearTerminalRelayCleanup(tx:Tx,forwardId:string,at:number):Promise<void>;
    denyIntent(tx:Tx,operationId:string,at:number):Promise<void>;
    acceptOperation(tx:Tx,input:RuntimeAcceptedOperation):Promise<void>;
    retireAssignment(tx:Tx,nodeId:string,assignment:RuntimeAssignmentFor<F>,operationId:string,generation:number):Promise<void>;
    recordLeases(tx:Tx,snapshot:RuntimeSnapshotFor<F>):Promise<void>;
    previousUnsafeLeases(tx:Tx,forwardId:string,at:number):Promise<RuntimeRetirementKey[]>;
    unsafeSessionLeaseCount(tx:Tx,nodeId:string,epoch:number,at:number):Promise<number>;
    retirements(tx:Tx,nodeId:string):Promise<RuntimeRetirement[]>;
    retirement(tx:Tx,key:RuntimeRetirementKey):Promise<RuntimeRetirement|undefined>;
    instanceLease(tx:Tx,key:RuntimeRetirementKey,epoch:number):Promise<{until:number|null}|undefined>;
    markRemoved(tx:Tx,key:RuntimeRetirementKey,epoch:number):Promise<void>;
    unsafeRetirementsForUpdate(tx:Tx,nodeId:string):Promise<RuntimeRetirement[]>;
    outstandingRetirementLeases(tx:Tx,retirement:RuntimeRetirement,at:number):Promise<number>;
    markRetirementSafe(tx:Tx,key:RuntimeRetirementKey):Promise<void>;
    completionOperations(tx:Tx,nodeId:string):Promise<RuntimeOperation[]>;
    pendingRetirementCount(tx:Tx,forwardId:string):Promise<number>;
    unsafeLeaseCount(tx:Tx,forwardId:string):Promise<number>;
    completeOperation(tx:Tx,operationId:string,at:number,clearClaim:boolean):Promise<void>;
    clearFailedSupersededCleanup(tx:Tx,forwardId:string):Promise<void>;
    clearOperationCleanup(tx:Tx,operationId:string,at:number):Promise<void>;
    getOperation(tx:Tx,scopeId:string,id:string,lock:boolean):Promise<RuntimeOperation|undefined>;
    expireOperations(tx:Tx,at:number):Promise<void>;
    claimableOperation(tx:Tx,at:number):Promise<RuntimeOperation|undefined>;
    claimOperation(tx:Tx,id:string,token:string,at:number,claimUntil:number):Promise<void>;
}
export interface RuntimeLedgerForwards<Tx> {
    forNode(tx:Tx,nodeId:string):Promise<Forward[]>;
    authorizer(tx:Tx,forwardId:string):Promise<string|null>;
    record(tx:Tx,scopeId:string,id:string):Promise<Forward&{deleting:boolean;recoverySuspended:boolean}>;
}
export interface RuntimeLedgerAuthorization<Tx> {
    canExecute(tx:Tx,actor:string,forward:Forward):Promise<boolean>;
}
export interface RuntimeLedgerCompiler<F extends RuntimeValueFamily=RuntimeValueFamily> {
    parseTime(text:string):number;
    formatTime(at:number):string;
    direct(forward:Forward,facts:AuthorizedNodeFacts,reservations:readonly ReservedSlot[]):readonly RuntimeAssignmentFor<F>[];
    snapshot(input:RuntimeSnapshotInput<F>):RuntimeSnapshotFor<F>;
    targetAllowed(host:string,facts:AuthorizedNodeFacts):boolean;
    decodeSnapshot(value:unknown):RuntimeSnapshotFor<F>;
    decodeAssignment(value:unknown):RuntimeAssignmentFor<F>;
}
export interface RuntimeLedgerOptions<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    readonly policy:Policy;
    readonly store:RuntimeLedgerStore<Tx,F>;
    readonly authorization:RuntimeLedgerAuthorization<Tx>|undefined;
    readonly assignments:SnapshotAssignmentCollector<Tx,F>;
    readonly resources:RuntimeResourceAccess<Tx>;
    readonly compiler:RuntimeLedgerCompiler<F>;
    readonly now:()=>number;
    readonly newID:()=>string;
}
