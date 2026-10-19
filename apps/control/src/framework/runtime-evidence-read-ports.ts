import type { RuntimeValueFamily, RuntimeSnapshotFor } from '@tunex/contracts/execution-values';

export const RUNTIME_EVIDENCE_READ_INTERFACE_VERSION=2 as const;

/** Current credential/session facts, not an issuer, lease or connection owner. */
export interface MachineSessionEvidence {
    readonly nodeId:string;
    readonly bootId:string|null;
    readonly sessionEpoch:number;
    readonly revoked:boolean;
    readonly credentialRevoked:boolean;
    readonly nodeCredentialUntil:number;
    readonly credentialUntil:number;
    readonly retireAfter:number|null;
    readonly capabilities:readonly string[];
}
export interface MachineSessionReader<Tx,Evidence extends MachineSessionEvidence=MachineSessionEvidence> {
    read(tx:Tx,nodeId:string,fingerprint:string):Promise<Evidence|undefined>;
}

/** An existing publication plus its session context, never a publication command. */
export interface PublishedRuntimeEvidence<F extends RuntimeValueFamily=RuntimeValueFamily> {
    readonly bootId:string|null;
    readonly sessionEpoch:number;
    readonly credentialUntil:number;
    readonly snapshot:RuntimeSnapshotFor<F>;
}
export interface PublishedRuntimeReader<Tx,Evidence extends PublishedRuntimeEvidence=PublishedRuntimeEvidence> {
    read(tx:Tx,scopeId:string,nodeId:string):Promise<Evidence|undefined>;
}
