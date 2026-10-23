import type { SharedResourceLimitRecord } from './resource-limit-ports.ts';

export const RESOURCE_USAGE_STORE_INTERFACE_VERSION=1 as const;
export interface ResourceUsageSample {
    bucketId:string;scopeId:string;actorId:string;nodeId:string;revision:number;
    startsAt:number;endsAt:number;consumedBytes:string;
    sessionEpoch:number;reportSequence:number;snapshotGeneration:number;receivedAt:number;
}
export interface ResourceUsageReportReference {
    bootId:string;sessionEpoch:number;reportSequence:number;snapshotGeneration:number;receivedAt:number;
}
export interface ResourceUsageReceipt {sessionEpoch:number;reportSequence:number;digest:string}
/** Read projection only. The original Runtime node lock serializes report/policy changes. */
export interface ResourceUsageStore<Tx> {
    lockReport(tx:Tx,nodeId:string):Promise<ResourceUsageReportReference|undefined>;
    lockHead(tx:Tx,nodeId:string):Promise<ResourceUsageReceipt|undefined>;
    policy(tx:Tx,bucketId:string):Promise<SharedResourceLimitRecord|undefined>;
    sample(tx:Tx,bucketId:string):Promise<ResourceUsageSample|undefined>;
    session(tx:Tx,nodeId:string):Promise<number|undefined>;
    save(tx:Tx,sample:ResourceUsageSample):Promise<void>;
    receipt(tx:Tx,nodeId:string,value:ResourceUsageReceipt):Promise<void>;
}
export interface ResourceUsageReader<Tx> {
    consumption(tx:Tx,record:SharedResourceLimitRecord):Promise<ResourceUsageConsumption>;
}
export interface ResourceUsageConsumption {
    status:'unknown'|'stale'|'policy-outdated'|'fresh';source:'agent-protected-journal';
    accounting:'conservative-precharge';usedBytes:string|null;remainingBytes:string|null;
    remainingMeaning:'upper-bound-at-sample';receivedAt:string|null;policyRevision:number|null;
    sessionEpoch:number|null;reportSequence:number|null;periodStatus:'future'|'active'|'ended';
}
