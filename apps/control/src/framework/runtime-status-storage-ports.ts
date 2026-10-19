export const RUNTIME_STATUS_STORAGE_INTERFACE_VERSION=1 as const;

/** Persisted fields only; the consumer chooses when to decode and correlate bodies. */
export interface RuntimeStatusNodeRecord {
    node_id:string;session_epoch:number;snapshot_generation:number;last_report:unknown;received_at:number|null;
}
export interface RuntimeStatusSnapshotRecord {body:unknown}
export interface RuntimeStatusStorageReader<Tx> {
    node(tx:Tx,nodeId:string):Promise<RuntimeStatusNodeRecord|undefined>;
    currentSnapshot(tx:Tx,nodeId:string,generation:number):Promise<RuntimeStatusSnapshotRecord|undefined>;
    reportedSnapshot(tx:Tx,nodeId:string,generation:number,epoch:number):Promise<RuntimeStatusSnapshotRecord|undefined>;
}
