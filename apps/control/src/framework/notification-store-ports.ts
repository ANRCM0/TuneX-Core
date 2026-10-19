export const NOTIFICATION_STORAGE_INTERFACE_VERSION=1 as const;

// Storage envelopes parameterize outer product values and state/code vocabularies.
// No alert rules, credential interpretation, issuance or dispatch policy lives here.
export interface NotificationEndpointRecord<Config extends {enabled:boolean}={enabled:boolean},Suspension extends string=string> {
    endpointId:string;revision:number;credentialRevision:number;config:Config;configDigest:string;
    managedBy:string;createdAt:number;updatedAt:number;suspended:Suspension;authorityDigest:string;credentialRef:string;
}
export interface NotificationEndpointAuditRecord<Kind extends string=string> {
    id:string;endpointId:string;revision:number;kind:Kind;actorId:string;createdAt:number;
}
export interface NotificationEndpointValues<Endpoint,Audit> {
    // Synchronous owner validation at the original decode points; no I/O or retry.
    readonly endpoint:(input:unknown)=>Endpoint;
    readonly audit:(input:unknown)=>Audit;
}
export interface NotificationEndpointStorage<Tx,Endpoint extends NotificationEndpointRecord,Audit extends NotificationEndpointAuditRecord> {
    lockScope(tx:Tx,scope:string):Promise<void>;
    count(tx:Tx,scope:string):Promise<number>;
    list(tx:Tx,scope:string):Promise<Endpoint[]>;
    get(tx:Tx,scope:string,id:string,lock?:boolean):Promise<Endpoint|null>;
    put(tx:Tx,scope:string,value:Endpoint):Promise<void>;
    audit(tx:Tx,scope:string,value:Audit):Promise<void>;
    audits(tx:Tx,scope:string,id:string):Promise<Audit[]>;
    auditLosses(tx:Tx,scope:string):Promise<number>;
}

export interface NotificationOutboxRecord<Payload extends {scopeId:string}={scopeId:string},Status extends string=string,Code extends string=string,Outcome extends string=string> {
    id:string;eventId:string;policyId:string;endpointId:string;policyConfigRevision:number;endpointRevision:number;credentialRevision:number;
    policyManagedBy:string;endpointManagedBy:string;authorityDigest:string;payload:Payload;payloadDigest:string;
    revision:number;status:Status;attemptCount:number;fence:number;claimedAt:number|null;claimUntil:number|null;
    createdAt:number;updatedAt:number;nextAttemptAt:number;expiresAt:number;lastCode:Code|null;lastOutcome:Outcome;lastStatusCode:number|null;recoverySuspended:boolean;
}
export interface NotificationAttemptRecord<Code extends string=string,Outcome extends string=string> {
    id:string;deliveryId:string;ordinal:number;fence:number;startedAt:number;finishedAt:number|null;outcome:Outcome;code:Code|null;statusCode:number|null;
}
export interface NotificationOutboxHeader {scopeId:string;id:string;revision:number}
export interface NotificationOutboxLosses {
    queueRejected:number;routingRejected:number;silenceSuppressed:number;disabledSuppressed:number;
    rowsExpired:number;rowsEvicted:number;attemptsEvicted:number;
}
export type NotificationOutboxLoss='routingRejected'|'silenceSuppressed'|'disabledSuppressed';
export interface NotificationOutboxQuery<Status extends string=string> {
    from:number;to:number;limit:number;before:{createdAt:number;id:string}|null;
    endpointId?:string;eventId?:string;status?:Status;
}
export interface NotificationOutboxValues<Delivery,Attempt> {
    // Synchronous owner validation at the original decode points; no I/O or retry.
    readonly delivery:(input:unknown)=>Delivery;
    readonly attempt:(input:unknown)=>Attempt;
}
export interface NotificationOutboxStorage<Tx,Delivery extends NotificationOutboxRecord,Attempt extends NotificationAttemptRecord> {
    lockScope(tx:Tx,scope:string):Promise<void>;
    losses(tx:Tx,scope:string):Promise<NotificationOutboxLosses>;
    loss(tx:Tx,scope:string,kind:NotificationOutboxLoss,count:number):Promise<void>;
    insert(tx:Tx,scope:string,value:Delivery,now:number):Promise<'inserted'|'duplicate'|'full'>;
    due(tx:Tx,now:number):Promise<NotificationOutboxHeader|null>;
    defer(tx:Tx,header:NotificationOutboxHeader,cutoff:number,retryAt:number):Promise<void>;
    get(tx:Tx,scope:string,id:string,lock?:boolean|'share'):Promise<Delivery|null>;
    put(tx:Tx,scope:string,value:Delivery):Promise<void>;
    activeCount(tx:Tx,scope:string,now:number):Promise<number>;
    reserveRate(tx:Tx,scope:string,endpointId:string,now:number,intervalMs:number):Promise<number>;
    appendAttempt(tx:Tx,scope:string,value:Attempt):Promise<void>;
    finishAttempt(tx:Tx,scope:string,deliveryId:string,value:Attempt):Promise<void>;
    attempts(tx:Tx,scope:string,id:string):Promise<Attempt[]>;
    history(tx:Tx,scope:string,query:NotificationOutboxQuery<Delivery['status']>):Promise<Delivery[]>;
}
