import type { Forward } from '@tunex/core';
import type { Policy } from '@tunex/contracts/policy';
import type { RuntimeValueFamily, RuntimeAssignmentFor, RuntimeMessagesFor, RuntimeSnapshotFor, RuntimeTombstoneValue } from '@tunex/contracts/execution-values';
import type { Observation } from '@tunex/contracts/execution-observation';
import type { TransactionBoundary } from './application-ports.ts';
import type { AuthorizedNodeFacts } from './node-facts.ts';
import type { RuntimeObservationReader } from './runtime-contracts.ts';

export const RUNTIME_HOST_INTERFACE_VERSION=3 as const;

export interface RuntimeNodeState {
    node_id:string;session_epoch:number;boot_id:string|null;snapshot_generation:number;
    last_report_sequence:number;last_report:unknown;received_at:number|null;
}
export interface RuntimeWorkRecord {
    id:string;scope_id:string;forward_id:string;target_revision:number;status:string;
    claim_token:string|null;claim_until:number|null;execution_deadline:number;
}
export interface RuntimeStateStore<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    lockNode(tx:Tx,nodeId:string):Promise<RuntimeNodeState|undefined>;
    boot(tx:Tx,nodeId:string,bootId:string):Promise<{session_epoch:number}|undefined>;
    beginBoot(tx:Tx,nodeId:string,bootId:string,epoch:number):Promise<void>;
    snapshot(tx:Tx,nodeId:string,generation:number,epoch?:number):Promise<RuntimeSnapshotFor<F>|undefined>;
    awaitingClaim(tx:Tx,nodeId:string):Promise<number>;
    operation(tx:Tx,id:string):Promise<RuntimeWorkRecord|undefined>;
    saveSnapshot(tx:Tx,snapshot:RuntimeSnapshotFor<F>):Promise<void>;
    cleanupNodeIDs():Promise<string[]>;
    reportDigest(tx:Tx,nodeId:string,epoch:number,sequence:number):Promise<string|undefined>;
    saveReport(tx:Tx,report:RuntimeMessagesFor<F>['ReportRequest'],requestDigest:string,receivedAt:number):Promise<void>;
    failExecution(tx:Tx,assignment:RuntimeAssignmentFor<F>,observation:Observation,at:number):Promise<void>;
}
export interface RuntimeNodes<Tx> {
    credential(tx:Tx,nodeId:string,fingerprint:string):Promise<number>;
    facts(tx:Tx,nodeId:string):Promise<{facts:AuthorizedNodeFacts}>;
    state(tx:Tx,nodeId:string):Promise<{facts:AuthorizedNodeFacts;revoked:boolean;credentialUntil:number}>;
    capabilities(tx:Tx,nodeId:string,capabilities:string[]):Promise<void>;
}
export interface RuntimeForwards<Tx> {
    record(tx:Tx,scopeId:string,id:string):Promise<Forward&{deleting:boolean;recoverySuspended:boolean}>;
}
export interface RuntimeExecutionLedger<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    assignments(tx:Tx,facts:AuthorizedNodeFacts):Promise<RuntimeAssignmentFor<F>[]>;
    retireChanged(tx:Tx,nodeId:string,previous:RuntimeSnapshotFor<F>|undefined,next:readonly RuntimeAssignmentFor<F>[],generation:number):Promise<void>;
    tombstones(tx:Tx,nodeId:string,generation:number):Promise<RuntimeTombstoneValue[]>;
    verifyPublishable(tx:Tx,assignments:readonly RuntimeAssignmentFor<F>[]):Promise<void>;
    recordLeases(tx:Tx,snapshot:RuntimeSnapshotFor<F>):Promise<void>;
    complete(tx:Tx,nodeId:string,report?:RuntimeMessagesFor<F>['ReportRequest'],snapshot?:RuntimeSnapshotFor<F>):Promise<void>;
    claim(tx:Tx):Promise<RuntimeWorkRecord|undefined>;
    get(tx:Tx,scopeId:string,id:string):Promise<RuntimeWorkRecord>;
    observeDrains(tx:Tx,nodeId:string,epoch:number,report:RuntimeMessagesFor<F>['ReportRequest']):Promise<void>;
}
export interface RuntimeRelay<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    relatedNodeIDs(tx:Tx,nodeId:string):Promise<string[]>;
    advanceForNode(tx:Tx,nodeId:string):Promise<void>;
    authorizationBound(tx:Tx,assignments:readonly RuntimeAssignmentFor<F>[]):Promise<number>;
    pendingNodeIDs(tx:Tx):Promise<string[]>;
    executionError(tx:Tx,snapshot:RuntimeSnapshotFor<F>,assignment:RuntimeAssignmentFor<F>,observation:Observation):Promise<void>;
}
export interface RuntimeAuthorityRecorder {
    issue(until:number,leaseSeconds:number,clockSkewSeconds:number):Promise<void>;
}
export interface RuntimeSnapshotInput<F extends RuntimeValueFamily=RuntimeValueFamily> {
    nodeId:string;sessionEpoch:number;snapshotGeneration:number;issuedAt:string;validUntil:string;
    assignments:readonly RuntimeAssignmentFor<F>[];tombstones:RuntimeTombstoneValue[];policy?:Policy;
}
/** Wire validation and compilation are injected, not dependencies on parser internals. */
export interface RuntimeCodec<F extends RuntimeValueFamily=RuntimeValueFamily> {
    readonly defaultPolicy:Readonly<Policy>;
    validatePolicy(policy:Policy,at:number):Policy;
    digest(value:unknown):string;
    compileSnapshot(input:RuntimeSnapshotInput<F>):RuntimeSnapshotFor<F>;
    checkHelloProtocol(input:RuntimeMessagesFor<F>['HelloRequest']):void;
    checkHelloCapabilities(input:RuntimeMessagesFor<F>['HelloRequest']):void;
    helloResponse(nodeId:string,bootId:string,epoch:number,serverTime:string,policy:Policy):RuntimeMessagesFor<F>['HelloResponse'];
    reportAck(nodeId:string,bootId:string,epoch:number,sequence:number,status:'accepted'|'duplicate'):RuntimeMessagesFor<F>['ReportAck'];
    parseTime(text:string):number;
    formatTime(at:number):string;
}
export interface RuntimeHostOptions<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    readonly db:TransactionBoundary<Tx>;
    readonly nodes:RuntimeNodes<Tx>;
    readonly forwards:RuntimeForwards<Tx>;
    readonly ledger:RuntimeExecutionLedger<Tx,F>;
    readonly store:RuntimeStateStore<Tx,F>;
    readonly codec:RuntimeCodec<F>;
    readonly observations:RuntimeObservationReader<Tx>;
    readonly policy?:Policy|undefined;
    readonly authority?:RuntimeAuthorityRecorder|undefined;
    readonly relay?:RuntimeRelay<Tx,F>|undefined;
    readonly now:()=>number;
}
