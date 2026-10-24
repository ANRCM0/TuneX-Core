export const PROBE_PERMIT_STORAGE_INTERFACE_VERSION=1 as const;
export const PROBE_PERMIT_OBSERVATION_INTERFACE_VERSION=1 as const;

/** Detached storage shape; measurement interpretation stays with the supplied owner. */
export interface ProbePermitStoredRecord {
    readonly measurement?:string;readonly serviceContext?:unknown;readonly echoChallenge?:unknown;
    readonly id:string;readonly actorId:string;readonly scopeId:string;readonly binding:unknown;
    readonly instanceId:string;readonly instanceGeneration:number;readonly fingerprint:string;
    readonly timeoutMs:number;readonly issuedAt:number;readonly expiresAt:number;
    readonly state:'issued'|'consumed'|'revoked'|'quarantined';readonly closedAt:number|null;
}
export interface ProbePermitStoredInput {
    readonly measurement:string;readonly tlsContext:unknown;readonly echoChallenge:unknown;
    readonly id:string;readonly actorId:string;readonly scopeId:string;readonly binding:unknown;
    readonly instanceId:string;readonly instanceGeneration:number;readonly fingerprint:string;
    readonly timeoutMs:number;readonly issuedAt:number;readonly expiresAt:number;
    readonly state:string;readonly closedAt:number|null;
}
export interface ProbePermitResultInput {
    readonly body:unknown;readonly resultDigest:string;readonly acceptedAt:number;
}
export interface ProbePermitStoredResult extends ProbePermitResultInput {
    readonly body:{readonly permitId:string};
}
/** Synchronous rules at the original decode/check points; no retained transaction or I/O. */
export interface ProbePermitStorageValues<Permit extends ProbePermitStoredRecord,Result extends ProbePermitStoredResult> {
    readonly readPermit:(input:ProbePermitStoredInput,decode:(value:unknown)=>unknown)=>Permit;
    readonly validPermit:(value:unknown)=>value is Permit;
    readonly readResult:(input:ProbePermitResultInput)=>Result;
    readonly checkResult:(record:Result)=>void;
}
export interface ProbePermitBudget<Permit extends ProbePermitStoredRecord> {
    observedAt:number;records:readonly Permit[];withdrawals:readonly {permitId:string;withdrawnAt:number}[];
}
/** Non-executing observation; its shared lock still excludes original writers. */
export interface ProbePermitObservationStorage<Tx,Permit extends ProbePermitStoredRecord> {
    observe(tx:Tx):Promise<ProbePermitBudget<Permit>>;
}
/** One caller-owned transaction and the original shared permit budget lock. */
export interface ProbePermitStorage<Tx,Permit extends ProbePermitStoredRecord,Result extends ProbePermitStoredResult> {
    lock(tx:Tx):Promise<ProbePermitBudget<Permit>>;
    clock(tx:Tx,now:number):Promise<void>;
    prune(tx:Tx,expiredBefore:number):Promise<void>;
    insert(tx:Tx,permit:Permit):Promise<void>;
    close(tx:Tx,id:string,state:'consumed'|'revoked',at:number):Promise<void>;
    withdraw(tx:Tx,id:string,at:number):Promise<void>;
    result(tx:Tx,permitId:string):Promise<Result|undefined>;
    recordResult(tx:Tx,record:Result):Promise<void>;
}
