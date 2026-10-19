import type { ProbeInstanceStoredRecord } from '../../framework/public.ts';

export interface ProbeInstanceRecord extends ProbeInstanceStoredRecord<'registered'|'revoked'|'quarantined'> {
    /** Advances on replacement, never on replay, revocation or recovery quarantine. */
    readonly generation: number;
}

export interface ProbeInstanceCommand {
    readonly bootId: string;
    readonly instanceId: string;
    readonly expectedGeneration: number;
}
export interface ProbeInstanceRegistration extends ProbeInstanceRecord {
    readonly executionEnabled: false;
}
export interface ProbeInstanceInspection {
    readonly generation: number;
    readonly state: 'absent' | 'registered' | 'revoked' | 'quarantined' | 'stale';
    readonly instance: ProbeInstanceRegistration | null;
    readonly executionEnabled: false;
}
export interface ProbeInstanceOwner {
    register(nodeId:string,fingerprint:string,epoch:number,input:ProbeInstanceCommand):Promise<ProbeInstanceRegistration>;
    revoke(nodeId:string,fingerprint:string,epoch:number,input:ProbeInstanceCommand):Promise<ProbeInstanceRegistration>;
    inspect(nodeId:string,fingerprint:string,epoch:number,bootId:string):Promise<ProbeInstanceInspection>;
}

/** Uses only the caller's transaction. Lock serializes first registration as well as replacement. */
export interface ProbeInstanceStore<Tx> {
    read(tx: Tx, nodeId: string): Promise<ProbeInstanceRecord | undefined>;
    lock(tx: Tx, nodeId: string): Promise<ProbeInstanceRecord | undefined>;
    replace(tx: Tx, expectedGeneration: number, next: ProbeInstanceRecord): Promise<void>;
}

/** Must lock the existing slot against replacement/revocation until transaction end. */
export interface CurrentProbeInstances<Tx> {
    readCurrent(tx: Tx, nodeId: string): Promise<ProbeInstanceRecord | undefined>;
}
