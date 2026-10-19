export const OBSERVATION_READ_STORAGE_INTERFACE_VERSION=1 as const;

export interface ObservationMetadataHead {serviceId:string;revision:number;configRevision:number;archived:boolean;recoverySuspended:boolean}
export interface ObservationMetadataRevision<Config> {configRevision:number;config:Config;configDigest:string;createdBy:string;createdAt:number}
export interface ObservationMetadataAudit<Kind extends string=string> {id:string;serviceId:string;revision:number;configRevision:number;kind:Kind;actorId:string;createdAt:number}
/** Synchronous outer value interpretation, never network/PKI validation or I/O. */
export interface ObservationMetadataValues<Config,Kind extends string> {
    readonly config:(input:unknown)=>Config;
    readonly auditKind:(input:unknown)=>input is Kind;
}
export interface ObservationMetadataStorage<Tx,Config,Kind extends string> {
    lockScope(tx:Tx,scope:string):Promise<void>;
    count(tx:Tx,scope:string):Promise<number>;
    list(tx:Tx,scope:string):Promise<ObservationMetadataHead[]>;
    head(tx:Tx,scope:string,id:string,lock?:boolean):Promise<ObservationMetadataHead|null>;
    revision(tx:Tx,scope:string,id:string,revision:number):Promise<ObservationMetadataRevision<Config>|null>;
    insertRevision(tx:Tx,scope:string,id:string,value:ObservationMetadataRevision<Config>):Promise<void>;
    putHead(tx:Tx,scope:string,value:ObservationMetadataHead):Promise<void>;
    audit(tx:Tx,scope:string,value:ObservationMetadataAudit<Kind>):Promise<void>;
    audits(tx:Tx,scope:string,id:string):Promise<ObservationMetadataAudit<Kind>[]>;
    auditLosses(tx:Tx,scope:string):Promise<number>;
}

// SQL projection values remain untrusted until the original product validator.
// Nullable native counters deliberately do not promise a valid business record.
export interface AuditStorageRow {
    occurredAt:number|null;source:unknown;key:unknown;kind:unknown;recordType:unknown;timeMeaning:unknown;
    actorId:unknown;actorAttribution:unknown;subjectId:unknown;entityKind:unknown;entityId:unknown;
    revision:number|null;revisionKind:unknown;sequence:number|null;position:number|null;nodeId:unknown;nodeAssociation:unknown;
    forwardId:unknown;operationId:unknown;outcome:unknown;errorCode:unknown;retryable:boolean|null;recoveryInvalidated:boolean|null;
}
export interface AuditStorageFilters {actorId?:string;nodeId?:string;forwardId?:string;operationId?:string;errorCode?:string;source?:string}
export interface AuditStoragePosition {occurredAt:number;source:string;key:string}
export interface AuditStorageQuery {from:number;to:number;limit:number;filters:Readonly<AuditStorageFilters>;before:AuditStoragePosition|null}
export interface AuditStoragePolicy {readonly sources:readonly string[];readonly errorCodes:readonly string[]}
/** SELECT-only on caller Tx; project each mapped row synchronously at the old
 * return point. No raw owner JSON, new connections, retry or retained callbacks.
 */
export interface AuditStorage<Tx> {
    source<R>(tx:Tx,scope:string,source:string,query:AuditStorageQuery,project:(row:AuditStorageRow)=>R):Promise<R[]>;
}
