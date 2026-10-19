export const TELEMETRY_ROLLUP_STORAGE_INTERFACE_VERSION=1 as const;

export type TelemetryRollupStorageFamily='process'|'host'|'forward'|'probe';
export type TelemetryRollupStorageResolution='minute'|'hour';
export interface TelemetryRollupObservationRecord {
    scopeId:string;nodeId:string;forwardId:string|null;family:TelemetryRollupStorageFamily;seriesKey:string;receivedAt:number;
}
export interface TelemetryRollupBucketRecord {
    scopeId:string;nodeId:string;forwardId:string|null;family:TelemetryRollupStorageFamily;
    resolution:TelemetryRollupStorageResolution;start:number;seriesKey:string;
}
export interface TelemetryRollupStoredRecord<Bucket> {body:Bucket;recoverySuspended:boolean}
export interface TelemetryRollupStorageAfter {start:number;nodeId:string;seriesKey:string}
export interface TelemetryRollupStorageWindow {
    scopeId:string;family:TelemetryRollupStorageFamily;resolution:TelemetryRollupStorageResolution;kind:'node'|'forward';
    targetId:string;from:number;to:number;limit:number;seriesKey:string|null;after:TelemetryRollupStorageAfter|null;
}
export interface TelemetryRollupStorageLosses {minuteEvicted:string;hourEvicted:string;cursorEvicted:string;cursorExpired:string}
export interface TelemetryRollupStorageCounts {minuteRows:number;hourRows:number;cursorRows:number;nodeFamilies:number}
export interface TelemetryRollupStorageLimits {
    readonly minuteSeconds:number;readonly hourSeconds:number;readonly cursorSeconds:number;
    readonly maxMinuteRowsPerNodeFamily:number;readonly maxHourRowsPerNodeFamily:number;readonly maxCursorRowsPerNodeFamily:number;
    readonly maxMinuteRowsPerScope:number;readonly maxHourRowsPerScope:number;readonly maxCursorRowsPerScope:number;
    readonly maxNodeFamiliesPerScope:number;readonly maxBucketBytes:number;readonly maxCursorBytes:number;readonly maxQueryPoints:number;
}
/** Synchronous outer schema/arithmetic at the original parse/fold points; no I/O or retained Tx. */
export interface TelemetryRollupStorageValues<Observation extends TelemetryRollupObservationRecord,Bucket extends TelemetryRollupBucketRecord> {
    readonly limits:TelemetryRollupStorageLimits;
    readonly observation:(input:unknown)=>Observation;
    readonly bucket:(input:unknown)=>Bucket;
    readonly fold:(bucket:Bucket|null,before:Observation|null,value:Observation,resolution:TelemetryRollupStorageResolution)=>Bucket;
}
export interface TelemetryRollupStorageRecorder<Tx,Observation> {append(tx:Tx,observations:readonly Observation[]):Promise<void>}
export interface TelemetryRollupStorage<Tx,Observation,Bucket> extends TelemetryRollupStorageRecorder<Tx,Observation> {
    history(tx:Tx,window:TelemetryRollupStorageWindow):Promise<TelemetryRollupStoredRecord<Bucket>[]>;
    losses(tx:Tx,scopeId:string,family:TelemetryRollupStorageFamily,nodeId:string|null):Promise<TelemetryRollupStorageLosses>;
    capacity(tx:Tx,scopeId:string):Promise<TelemetryRollupStorageCounts>;
    prune(tx:Tx,now:number):Promise<number>;
}
