export const PUBLICATION_RECOVERY_STORAGE_INTERFACE_VERSION=1 as const;

/** Supplied transaction and caller's shared time; never reconcile or apply work. */
export interface PathPublicationRecoveryStore<Tx> {quarantineRecovery(tx:Tx,at:number):Promise<void>}
export interface IngressDeploymentRecoveryStore<Tx> {quarantineRecovery(tx:Tx,at:number):Promise<void>}
export interface IngressMigrationRecoveryStore<Tx> {quarantineRecovery(tx:Tx,at:number):Promise<void>}
