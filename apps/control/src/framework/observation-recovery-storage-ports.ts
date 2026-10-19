export const OBSERVATION_RECOVERY_STORAGE_INTERFACE_VERSION=1 as const;

/** Recovery joins the original caller transaction; no pool, clock or issuer. */
export interface TelemetryRecoveryStore<Tx> {
    quarantineRecovery(tx:Tx):Promise<void>;
}

export interface StationAlertRecoveryStore<Tx> {
    quarantineRecovery(tx:Tx,state:string):Promise<void>;
}

export interface NotificationRecoveryStore<Tx> {
    suspendEndpoints(tx:Tx):Promise<void>;
    quarantineDeliveries(tx:Tx,at:number):Promise<void>;
}
