import type { RuntimeAssignmentValue, RuntimeResourceLimitsValue, RuntimeResourceLimitBucketValue } from '@tunex/contracts/execution-values';

export const RESOURCE_LIMIT_INTERFACE_VERSION=1 as const;

/** Publication invokes this policy in the original locked Runtime transaction. */
export interface RuntimePayloadPolicy<Tx> {
    limits(tx:Tx,nodeId:string,capabilities:readonly string[],assignments:readonly RuntimeAssignmentValue[],at:number,
        previous?:readonly RuntimeResourceLimitBucketValue[]):Promise<{
        excludedAssignmentIds:readonly string[];resourceLimits?:RuntimeResourceLimitsValue;
    }>;
}
export interface OfflinePayloadPolicy<Tx> {
    assertUnmetered(tx:Tx,forward:{id:string;scopeId:string},nodeIds:readonly string[]):Promise<void>;
}

export interface SharedResourceLimitRecord {
    bucketId:string;scopeId:string;nodeId:string;actorId:string;revision:number;
    startsAt:number;endsAt:number;bytesPerSecond:number|null;burstBytes:number;byteLimit:number|null;
}
export interface SharedResourceLimitReceipt {requestDigest:string;response:unknown}
/** Storage belongs to resource-limit policy only; no caller-owned transaction is replaced. */
export interface SharedResourceLimitStore<Tx> {
    lock(tx:Tx,nodeId:string,actorId:string):Promise<void>;
    current(tx:Tx,nodeId:string,actorId:string):Promise<SharedResourceLimitRecord|undefined>;
    history(tx:Tx,nodeId:string,actorId:string):Promise<SharedResourceLimitRecord[]>;
    save(tx:Tx,record:SharedResourceLimitRecord,expectedRevision:number):Promise<boolean>;
    replay(tx:Tx,scopeId:string,actorId:string,requestId:string):Promise<SharedResourceLimitReceipt|undefined>;
    receipt(tx:Tx,scopeId:string,actorId:string,requestId:string,requestDigest:string,response:unknown):Promise<void>;
    audit(tx:Tx,eventId:string,actorId:string,record:SharedResourceLimitRecord,at:number):Promise<void>;
}
