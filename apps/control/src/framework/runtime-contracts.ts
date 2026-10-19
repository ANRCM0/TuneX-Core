import type { Forward } from '@tunex/core';
import type { ExecutionRole, RuntimeResourceValue, RuntimeValueFamily, RuntimeMessagesFor } from '@tunex/contracts/execution-values';
import type { Observation } from '@tunex/contracts/execution-observation';

export interface AppliedObservation extends Observation {
    nodeId:string;forwardRevision:number;role:ExecutionRole;
}
export interface ForwardRuntimeStatus {
    applied:AppliedObservation[];
    health:{condition:'unknown'|'ready'|'degraded';receivedAt:string|null;freshUntil:string|null};
}
export interface RuntimeObservationReader<Tx> {
    status(tx:Tx,forward:Forward):Promise<ForwardRuntimeStatus>;
}
export interface OperationReadRecord {
    id:string;forward_id:string;kind:string;requested_by:string;source_operation_id:string|null;
    status:string;recovery_invalidated:number;target_revision:number;cleanup_pending:number;last_error:unknown;
}
export interface OperationReader<Tx> {
    latest(tx:Tx,forwardId:string):Promise<OperationReadRecord|undefined>;
    get(tx:Tx,scope:string,id:string):Promise<OperationReadRecord>;
}
export interface RelayDeploymentStatus {
    generation:number;forwardRevision:number;stage:'preparing'|'egress_active'|'ingress_active'|'active'|'withdrawn';
    preparedCount:number|null;activatedCount:number|null;renewalAllowed:boolean;
    operation:{id:string;status:string;sourceOperationId:string|null;lastError:unknown}|null;
    activationOrder:string[];authorizationUntil:string;trafficVerified:boolean;
    nodes:{nodeId:string;sessionEpoch:number;currentSessionEpoch:number|null;role:ExecutionRole;
        physicalResources:RuntimeResourceValue[];reportFresh:boolean;observations:Observation[];
        receivedAt:string|null;validUntil:string|null;prepared:boolean;ready:boolean}[];
    isolation:{node_id:string;assignment_id:string;binding_fence:number;removed_epoch:number|null}[];
}
export interface DeploymentReader<Tx> {
    status(tx:Tx,forward:Forward):Promise<RelayDeploymentStatus|null>;
}

/** A supplied family binds online values; no scheduling, SQL or publication helpers. */
export interface RuntimeMachinePort<F extends RuntimeValueFamily=RuntimeValueFamily> {
    hello(nodeId:string,input:RuntimeMessagesFor<F>['HelloRequest'],fingerprint?:string):Promise<RuntimeMessagesFor<F>['HelloResponse']>;
    snapshot(nodeId:string,epoch:number,fingerprint?:string):Promise<RuntimeMessagesFor<F>['Snapshot']>;
    report(nodeId:string,epoch:number,input:RuntimeMessagesFor<F>['ReportRequest'],fingerprint?:string):Promise<RuntimeMessagesFor<F>['ReportAck']>;
}
