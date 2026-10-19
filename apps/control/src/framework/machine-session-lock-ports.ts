export const MACHINE_SESSION_LOCK_INTERFACE_VERSION=1 as const;

/** Raw lock-bound evidence. Decode facts only at the caller's original decision point. */
export interface LockedMachineSession {
    session_epoch:number; boot_id:string|null;
    node_revoked:number; credential_revoked:number|null;
    credential_until:number|null; valid_until:number|null;
    retire_after:number|null; facts:unknown;
}
export interface MachineSessionLockReader<Tx> {
    read(tx:Tx,nodeId:string,fingerprint:string):Promise<LockedMachineSession|undefined>;
}
