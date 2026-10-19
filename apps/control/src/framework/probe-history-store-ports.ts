export const PROBE_HISTORY_STORAGE_INTERFACE_VERSION=1 as const;

// Historical capture/persistence envelopes only, not executable grants or an issuer.
export interface ProbeHistoryPermit<Binding extends {forwardId:string;nodeId:string}={forwardId:string;nodeId:string},State extends string=string,Measurement extends string=string,Service=unknown,Challenge=unknown> {
    measurement?:Measurement;service?:Service;echoChallenge?:Challenge;
    probeId:string;scopeId:string;actorId:string;binding:Binding;instanceId:string;instanceGeneration:number;timeoutMs:number;
    issuedAt:number;expiresAt:number;state:State;closedAt:number|null;
}
export interface ProbeHistoryResult<Status extends string=string,Code extends string=string,TLS=unknown,Proof=unknown> {
    status:Status;code:Code;tls?:TLS|null;echo?:Proof|null;requestBytes?:number;responseBytes?:number;
    elapsedMs:number;measuredAt:number;validUntil:number;acceptedAt:number;resultDigest:string;
}
export interface ProbeHistoryMetadata<Result=ProbeHistoryResult> {
    revision:number;updatedAt:number;withdrawnAt:number|null;result:Result|null;recoverySuspended:boolean;
}
export interface ProbeHistoryRecord extends ProbeHistoryPermit,ProbeHistoryMetadata {}
export interface ProbeHistoryLosses {rowsExpired:number;rowsEvicted:number;updatesWithoutHead:number}
export interface ProbeHistoryQuery<State extends string=string,ResultStatus extends string=string> {
    from:number;to:number;limit:number;before:{issuedAt:number;probeId:string}|null;
    forwardId?:string;nodeId?:string;probeId?:string;state?:State;resultStatus?:ResultStatus|'missing';
}
/** Synchronous owner values, not storage I/O, authority or asynchronous validation. */
export interface ProbeHistoryValues<Record> {readonly read:(input:unknown)=>Record;readonly immutable:(input:Record)=>string}
export interface ProbeHistoryStorage<Tx,Record extends ProbeHistoryRecord> {
    lockScope(tx:Tx,scope:string):Promise<void>;
    losses(tx:Tx,scope:string):Promise<ProbeHistoryLosses>;
    missingUpdate(tx:Tx,scope:string):Promise<void>;
    insert(tx:Tx,value:Record,now:number):Promise<void>;
    get(tx:Tx,scope:string,id:string,lock?:boolean):Promise<Record|null>;
    put(tx:Tx,value:Record):Promise<void>;
    history(tx:Tx,scope:string,query:ProbeHistoryQuery<Record['state'],NonNullable<Record['result']>['status']>):Promise<Record[]>;
}

export interface ProbePlanStoredHead<Config extends {forwardId:string;mode:string;expiresAt:number}={forwardId:string;mode:string;expiresAt:number},Binding=unknown,State extends string=string,Code extends string=string> {
    id:string;scopeId:string;createdBy:string;createdAt:number;config:Config;configDigest:string;originBinding:Binding;
    revision:number;state:State;decisionCount:number;acceptedCount:number;nextRunAt:number;updatedAt:number;
    cancelledBy:string|null;cancelledAt:number|null;lastCode:Code|null;recoverySuspended:boolean;
}
export interface ProbePlanStoredDecision<Source extends string=string,Outcome=unknown> {position:number;actorId:string;source:Source;decidedAt:number;outcome:Outcome}
export interface ProbePlanStoredFailure<Code extends string=string,Status extends number=number> {code:Code;status:Status}
export interface ProbePlanStoredHeader {scopeId:string;id:string;revision:number}
export interface ProbePlanStoredLosses {rowsExpired:number;rowsEvicted:number;decisionsEvicted:number}
export interface ProbePlanStoredQuery<State extends string=string,Mode extends string=string> {
    from:number;to:number;limit:number;before:{createdAt:number;id:string}|null;forwardId?:string;mode?:Mode;state?:State;
}
/** Product transitions/refusal vocabularies stay in the supplied owner callbacks.
 * Invoke synchronously at the original points; never await, retain or retry them.
 */
export interface ProbePlanStorageValues<Head extends ProbePlanStoredHead,Decision,Failure> {
    readonly head:(input:unknown)=>Head;
    readonly decision:(input:unknown,config?:Head['config'])=>Decision;
    readonly immutable:(input:Head)=>string;
    readonly expired:(head:Head,now:number)=>Head|null;
    readonly failure:(error:unknown)=>Failure|null;
}
export interface ProbePlanStorage<Tx,Head extends ProbePlanStoredHead,Decision extends ProbePlanStoredDecision,Failure extends ProbePlanStoredFailure> {
    lockScope(tx:Tx,scope:string):Promise<void>;
    losses(tx:Tx,scope:string):Promise<ProbePlanStoredLosses>;
    create(tx:Tx,head:Head,now:number):Promise<void>;
    get(tx:Tx,scope:string,id:string,lock?:boolean|'share'):Promise<Head|null>;
    put(tx:Tx,head:Head):Promise<void>;
    append(tx:Tx,scope:string,id:string,decision:Decision):Promise<void>;
    decisions(tx:Tx,scope:string,id:string):Promise<Decision[]>;
    history(tx:Tx,scope:string,query:ProbePlanStoredQuery<Head['state'],Head['config']['mode']>):Promise<Head[]>;
    due(tx:Tx,now:number):Promise<ProbePlanStoredHeader|null>;
    defer(tx:Tx,header:ProbePlanStoredHeader,cutoff:number,retryAt:number):Promise<void>;
    isolate<T>(tx:Tx,action:()=>Promise<T>):Promise<{accepted:true;value:T}|{accepted:false;error:Failure}>;
}
