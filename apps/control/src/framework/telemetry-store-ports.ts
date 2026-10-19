export const TELEMETRY_STORAGE_INTERFACE_VERSION=1 as const;

export interface TelemetryStoredNode {
    nodeId:string;scopeId:string;revoked:boolean;credentialUntil:number;sessionEpoch:number;bootId:string|null;
}
export interface TelemetryStoredHead {
    nodeId:string;scopeId:string;sessionEpoch:number;bootId:string;sampleEpoch:string;
    lastSequence:number;lastUptimeMs:number;lastDigest:string|null;lastReceivedAt:number;lastCapturedAt:number;droppedSamples:string;
}
export interface TelemetryStoredPoint {
    nodeId:string;scopeId:string;sessionEpoch:number;bootId:string;sampleEpoch:string;sequence:number;
    capturedAt:number;receivedAt:number;uptimeMs:number;body:unknown;digest:string;recoverySuspended:boolean;
}
/** Caller-owned transaction and outer sample shape; no pool, wire decoder or receipt policy. */
export interface TelemetryStorage<Tx,Sample> {
    node(tx:Tx,nodeId:string):Promise<TelemetryStoredNode|null>;
    lockHead(tx:Tx,scopeId:string,sample:Sample):Promise<TelemetryStoredHead>;
    append(tx:Tx,scopeId:string,sample:Sample,hash:string,receivedAt:number):Promise<void>;
    history(tx:Tx,scopeId:string,nodeId:string,from:number,to:number,limit:number):Promise<TelemetryStoredPoint[]>;
    latest(tx:Tx,scopeId:string,nodeId:string,from:number):Promise<TelemetryStoredPoint[]>;
    prune(tx:Tx,before:number):Promise<number>;
}

export interface TelemetryStoredMappedHead extends TelemetryStoredHead {acceptedPoints:number;rejectedPoints:number}
export interface TelemetryStoredForward {forwardId:string;scopeId:string;revision:number;deleting:boolean;recoverySuspended:boolean}
// These labels describe stored provenance; none grants or renews execution authority.
export type TelemetryForwardMappingSource='current-published'|'retired-published';
export type TelemetryProbeMappingSource='published-snapshot';
export type TelemetryProbeInstanceSource='current-registered'|'not-rechecked';
export interface TelemetryPublishedMapping<Identity,Source extends string> {
    identity:Identity;scopeId:string;source:Source;publishedUntil:number;forwardRecoverySuspended:boolean;
}
export interface TelemetryProbeMapping<Identity> extends TelemetryPublishedMapping<Identity,TelemetryProbeMappingSource> {
    probeInstance:TelemetryProbeInstanceSource;instanceUntil:number|null;
}
export interface TelemetryAcceptedPoint<Point,Mapping> {index:number;point:Point;mapping:Mapping}
export interface TelemetryMappedRecord<Source extends string> {
    nodeId:string;scopeId:string;forwardId:string;sessionEpoch:number;bootId:string;sampleEpoch:string;sequence:number;itemIndex:number;
    receivedAt:number;capturedAt:number;sampleCapturedAt:number;uptimeMs:number;identityDigest:string;counterEpoch:string|null;
    point:unknown;exporter:unknown;digest:string;mappingSource:Source;publishedUntil:number;recoverySuspended:boolean;
}
export interface TelemetryProbeRecord extends TelemetryMappedRecord<TelemetryProbeMappingSource> {
    probeInstance:TelemetryProbeInstanceSource;instanceUntil:number|null;
}
export interface TelemetryMappedStorage<Tx,Sample,Accepted,Record> {
    node(tx:Tx,nodeId:string):Promise<TelemetryStoredNode|null>;
    nodes(tx:Tx,nodeIds:readonly string[]):Promise<TelemetryStoredNode[]>;
    forward(tx:Tx,scopeId:string,forwardId:string):Promise<TelemetryStoredForward|null>;
    lockHead(tx:Tx,scopeId:string,sample:Sample):Promise<TelemetryStoredMappedHead>;
    append(tx:Tx,scopeId:string,sample:Sample,accepted:readonly Accepted[],hash:string,receivedAt:number):Promise<void>;
    history(tx:Tx,scopeId:string,forwardId:string,from:number,to:number,limit:number):Promise<Record[]>;
    latest(tx:Tx,scopeId:string,forwardId:string,from:number):Promise<Record[]>;
    prune(tx:Tx,before:number):Promise<number>;
}

/** Read-only published-source lookup; the outer caller owns receipt acceptance. */
export interface TelemetryPublishedMappingPort<Tx,Node,Point,Mapping> {
    resolve(tx:Tx,node:Node,points:readonly Point[]):Promise<readonly (Mapping|null)[]>;
}
export interface TelemetryObservedMappingPort<Tx,Node,Point,Mapping> {
    resolve(tx:Tx,node:Node,points:readonly Point[],observedAt:number):Promise<readonly (Mapping|null)[]>;
}
