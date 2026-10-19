export const PROBE_REGISTRATION_STORAGE_INTERFACE_VERSION=1 as const;

// Detached persistence records; these contracts neither register nor authorize execution.
export interface ProbeInstanceStoredRecord<State extends string=string> {
    readonly nodeId:string;readonly bootId:string;readonly sessionEpoch:number;readonly fingerprint:string;
    readonly instanceId:string;readonly generation:number;readonly state:State;
    readonly registeredAt:number;readonly expiresAt:number;readonly revokedAt:number|null;
}
/** Synchronous, unretained owner rules at the original read/transition points. */
export interface ProbeInstanceStorageValues<Record extends ProbeInstanceStoredRecord> {
    readonly read:(input:ProbeInstanceStoredRecord,nodeId:string)=>Record;
    readonly closing:(expectedGeneration:number,next:Record)=>boolean;
}
export interface ProbeInstanceStorage<Tx,Record extends ProbeInstanceStoredRecord> {
    readCurrent(tx:Tx,nodeId:string):Promise<Record|undefined>;
    read(tx:Tx,nodeId:string):Promise<Record|undefined>;
    lock(tx:Tx,nodeId:string):Promise<Record|undefined>;
    replace(tx:Tx,expectedGeneration:number,next:Record):Promise<void>;
}

export interface ProbeQualificationStoredRecord<State extends string=string,ServicesVersion extends number=number,EchoVersion extends number=number> {
    servicesVersion?:ServicesVersion;echoVersion?:EchoVersion;
    nodeId:string;bootId:string;sessionEpoch:number;fingerprint:string;instanceId:string;instanceGeneration:number;
    state:State;qualifiedAt:number;expiresAt:number;
}
/** Validation only; never I/O, a retained transaction, issuance or retry. */
export interface ProbeQualificationStorageValues<Record extends ProbeQualificationStoredRecord> {
    readonly read:(input:ProbeQualificationStoredRecord)=>Record;
}
export interface ProbeQualificationStorage<Tx,Record extends ProbeQualificationStoredRecord> {
    get(tx:Tx,node:string,lock?:boolean):Promise<Record|null>;
    put(tx:Tx,value:Record):Promise<void>;
}
