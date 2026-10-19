export const STATION_ALERT_STORAGE_INTERFACE_VERSION=1 as const;

export interface StationStorageConfig {enabled:boolean;rule:string;target:{id:string}}
export interface StationPolicyRecord<Config extends StationStorageConfig=StationStorageConfig,State=unknown,Suspension extends string=string> {
    policyId:string;revision:number;configRevision:number;config:Config;configDigest:string;managedBy:string;
    createdAt:number;updatedAt:number;silencedUntil:number|null;suspended:Suspension;nextEvaluateAt:number;state:State;
}
export interface StationPolicyAuditRecord<Kind extends string=string> {
    id:string;policyId:string;revision:number;configRevision:number;configDigest:string;kind:Kind;
    actorId:string;createdAt:number;eventId:string|null;
}
export interface StationEventRecord<Config extends StationStorageConfig=StationStorageConfig,Kind extends string=string,Reason extends string=string,Evidence=unknown> {
    id:string;policyId:string;policyRevision:number;configRevision:number;config:Config;configDigest:string;
    episode:number;kind:Kind;reason:Reason;occurredAt:number;evidence:Evidence;opening:Evidence|null;
    silenced:boolean;silencedUntil:number|null;revision:number;acknowledgedAt:number|null;recoverySuspended:boolean;
}
export interface StationStorageEventQuery<Rule extends string=string,Kind extends string=string> {
    from:number;to:number;limit:number;before:{occurredAt:number;id:string}|null;
    policyId?:string;targetId?:string;rule?:Rule;kind?:Kind;acknowledged?:boolean;
}
export interface StationStorageLosses {eventsEvicted:number;eventsExpired:number;auditEvicted:number}
/** Synchronous type projections at old row-map points, without early product validation or I/O. */
export interface StationStorageValues<Policy,Audit,Event> {
    readonly policy:(input:StationPolicyRecord)=>Policy;
    readonly audit:(input:StationPolicyAuditRecord)=>Audit;
    readonly event:(input:StationEventRecord)=>Event;
}
export interface StationAlertStorage<Tx,Policy extends StationPolicyRecord,Audit extends StationPolicyAuditRecord,Event extends StationEventRecord> {
    lockScope(tx:Tx,scope:string):Promise<void>;
    losses(tx:Tx,scope:string):Promise<StationStorageLosses>;
    policyCount(tx:Tx,scope:string):Promise<number>;
    policies(tx:Tx,scope:string):Promise<Policy[]>;
    policy(tx:Tx,scope:string,id:string,lock?:boolean):Promise<Policy|null>;
    putPolicy(tx:Tx,scope:string,value:Policy):Promise<void>;
    audit(tx:Tx,scope:string,value:Audit):Promise<void>;
    audits(tx:Tx,scope:string,id:string):Promise<Audit[]>;
    due(tx:Tx,now:number):Promise<{scopeId:string;policyId:string;revision:number}|null>;
    defer(tx:Tx,scope:string,id:string,expectedRevision:number,cutoff:number,retryAt:number):Promise<void>;
    event(tx:Tx,scope:string,id:string,lock?:boolean):Promise<Event|null>;
    events(tx:Tx,scope:string,query:StationStorageEventQuery):Promise<Event[]>;
    appendEvent(tx:Tx,scope:string,value:Event,now:number):Promise<void>;
    acknowledge(tx:Tx,scope:string,id:string,expectedRevision:number,at:number):Promise<void>;
}

// Detached SELECT-only facts. No stale/credential threshold or alert decision lives here.
export interface StationOperationFactRecord {
    kind:'operation';targetId:string;forwardRevision:number;operationId:string;targetRevision:number;
    operationKind:string;status:'accepted'|'running'|'succeeded'|'failed'|'superseded';sourceOperationId:string|null;
    createdAt:number;updatedAt:number;errorCode:string|null;recoveryInvalidated:boolean;
}
export interface StationReportFactRecord {
    kind:'node-report';targetId:string;bootId:string;sessionEpoch:number;reportSequence:number;snapshotGeneration:number;
    observedAt:number;receivedAt:number;credentialUntil:number;
}
export interface StationForwardFactRecord {
    kind:'forward';id:string;revision:number;enabled:boolean;deleting:boolean;recoverySuspended:boolean;operation:StationOperationFactRecord|null;
}
export interface StationNodeFactRecord {
    kind:'node';id:string;revoked:boolean;credentialUntil:number|null;report:StationReportFactRecord|null;invalidReport:boolean;
}
export type StationFactRecord=StationForwardFactRecord|StationNodeFactRecord;
export interface StationFactTarget {target:{kind:string;id:string}}
export interface StationFactValues {readonly errorCode:(input:unknown)=>string|null}
export interface StationFactsStorage<Tx,Config extends StationFactTarget=StationFactTarget> {
    read(tx:Tx,scope:string,config:Config):Promise<StationFactRecord|null>;
}
