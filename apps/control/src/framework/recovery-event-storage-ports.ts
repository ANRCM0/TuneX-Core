export const RECOVERY_EVENT_STORAGE_INTERFACE_VERSION=1 as const;

export interface RecoveryEventStorage<Tx> {record(tx:Tx,id:string,at:number,details:string):Promise<void>}
