import type { RecoveryEventStorage } from '../../framework/public.ts';
import type { RecoveryIdentity } from '../identity-owner/public.ts';

export const RECOVERY_QUARANTINE_INTERFACE_VERSION=1 as const;

export interface RecoveryQuarantineOwners<Tx> {
    identity(tx:Tx):Promise<RecoveryIdentity[]>;
    transport(tx:Tx):Promise<void>;
    relay(tx:Tx):Promise<void>;
    nodes(tx:Tx):Promise<void>;
    telemetry(tx:Tx):Promise<void>;
    station(tx:Tx):Promise<void>;
    notification(tx:Tx):Promise<void>;
    probeHistory(tx:Tx):Promise<void>;
    probePlans(tx:Tx):Promise<void>;
    probeQualifications(tx:Tx):Promise<void>;
    observationServices(tx:Tx):Promise<void>;
    pathPublications(tx:Tx,at:number):Promise<void>;
    ingressDeployments(tx:Tx,at:number):Promise<void>;
    ingressMigrations(tx:Tx,at:number):Promise<void>;
    probeInstances(tx:Tx):Promise<void>;
    probePermits(tx:Tx):Promise<void>;
    forwards(tx:Tx):Promise<void>;
    ledger(tx:Tx):Promise<void>;
    idempotency(tx:Tx):Promise<void>;
}
export interface RecoveryQuarantineContext {
    recoveryId:string;
    manifest:{id:string;database:string;trustDigest:string};
    authority:{latestValidUntil:number|null};
    readonly newTrustDigest:string;
    acceptCredentials(accounts:RecoveryIdentity[]):void;
}
export interface RecoveryQuarantineEffects {
    now():number;
    encode(value:unknown):string;
}
export interface RecoveryQuarantineOptions<Tx> {
    owners:RecoveryQuarantineOwners<Tx>;
    events:RecoveryEventStorage<Tx>;
    effects:RecoveryQuarantineEffects;
}
