import type {
    NodeTelemetrySample, NodeTelemetryAck, HostTelemetrySample, HostTelemetryAck,
    ForwardTelemetryPoint, ForwardTelemetryAck, ProbeTelemetryPoint, ProbeTelemetryAck,
} from '../../compatibility/public.ts';
import type { ForwardTelemetryExport, ForwardTelemetryRecord } from './forward-contracts.ts';
import type { ProbeTelemetryExport, ProbeTelemetryRecord } from './probe-contracts.ts';
import type { TelemetryFamily, TelemetryResolution, TelemetryRollupRecord, TelemetryRollupLosses, TelemetryRollupCounts } from './rollup-contracts.ts';
import type { TELEMETRY_ROLLUP_LIMITS } from './policy.ts';

export const TELEMETRY_API_INTERFACE_VERSION=2 as const;

export interface TelemetryHistoryQuery {from?:string|undefined;to?:string|undefined;limit?:string|undefined}
export interface TelemetryReadAdmission {admitReadRequest<T>(action:()=>Promise<T>):Promise<T>}
export interface TelemetryMachineAdmission {admitMachineRequest<T>(action:()=>Promise<T>):Promise<T>}
export interface NodeTelemetryDelta {
    status:'baseline'|'continuous'|'gap'|'counter-reset'|'historical';
    elapsedMs:number|null;cpuTimeNanos:string|null;exportDroppedSamples:string|null;
}
export interface HostTelemetryDelta {
    status:'baseline'|'continuous'|'gap'|'counter-reset'|'historical';
    elapsedMs:number|null;cpuTotalTicks:string|null;cpuIdleTicks:string|null;cpuIoWaitTicks:string|null;exportDroppedSamples:string|null;
}
export type ForwardTelemetryCounterName=keyof NonNullable<ForwardTelemetryPoint['counters']>;
export type ForwardTelemetryDelta={
    status:'baseline'|'continuous'|'gap'|'counter-reset'|'historical'|'unavailable'|'overflowed'|'terminal';
    elapsedMs:number|null;
}&Record<ForwardTelemetryCounterName,string|null>;
export type ProbeTelemetryCounterName='attempted'|'succeeded'|'failed'|'unknown';
export type ProbeTelemetryDelta={
    status:'baseline'|'continuous'|'gap'|'counter-reset'|'historical'|'unavailable'|'overflowed'|'terminal';
    elapsedMs:number|null;inFlightBefore:string|null;
}&Record<ProbeTelemetryCounterName,string|null>;

export interface TelemetrySampleView<Sample,Delta> {
    sample:Sample;receivedAt:string;recoverySuspended:boolean;sessionCurrent:boolean;
    freshness:'historical'|'fresh'|'stale';delta:Delta;
}
export type NodeTelemetryPointView=TelemetrySampleView<NodeTelemetrySample,NodeTelemetryDelta>;
export type HostTelemetryPointView=TelemetrySampleView<HostTelemetrySample,HostTelemetryDelta>;
export interface TelemetryForwardPointEvidence {
    receivedAt:string;recoverySuspended:boolean;currentSession:{bootId:string;sessionEpoch:number}|null;
    nodeRevoked:boolean;credentialWindowOpen:boolean;sessionCurrent:boolean;freshness:string;
}
export interface ForwardTelemetryPointView extends TelemetryForwardPointEvidence {
    point:ForwardTelemetryPoint;exporter:Omit<ForwardTelemetryExport,'coverage'|'droppedSamples'>;delta:ForwardTelemetryDelta;
    mapping:{source:ForwardTelemetryRecord['mappingSource'];publishedUntil:string;currentBinding:string};
}
export interface ProbeTelemetryPointView extends TelemetryForwardPointEvidence {
    point:ProbeTelemetryPoint;exporter:Omit<ProbeTelemetryExport,'coverage'|'droppedSamples'>;delta:ProbeTelemetryDelta;
    mapping:{source:ProbeTelemetryRecord['mappingSource'];publishedUntil:string;currentBinding:string;
        probeInstance:ProbeTelemetryRecord['probeInstance'];instanceUntil:string|null};
}

// Ordinary inferred response flags stay broad; nested wire and declared delta types do not.
export interface TelemetryHistoryView<Point> {
    enabled:boolean;source:string;health:string;executionAuthorized:boolean;observedAt:string;
    window:{from:string;to:string;limit:number;truncated:boolean};latest:Point|null;items:Point[];
}
export interface NodeTelemetryHistory extends TelemetryHistoryView<NodeTelemetryPointView> {
    telemetryVersion:number;nodeId:string;currentSession:{sessionEpoch:number;bootId:string}|null;nodeRevoked:boolean;
    retention:{rawSeconds:number;maxPointsPerNode:number};
}
export interface HostTelemetryHistory extends TelemetryHistoryView<HostTelemetryPointView> {
    hostTelemetryVersion:number;nodeId:string;currentSession:{sessionEpoch:number;bootId:string}|null;nodeRevoked:boolean;
    retention:{rawSeconds:number;maxPointsPerNode:number};
}
export interface ForwardTelemetryHistoryView<Point> extends TelemetryHistoryView<Point> {
    forwardId:string;forward:{revision:number;deleting:boolean;recoverySuspended:boolean};
    retention:{rawSeconds:number;maxPointsPerNode:number;maxPointBytes:number;maxMetadataBytes:number;historyComplete:boolean};
}
export interface ForwardTelemetryHistory extends ForwardTelemetryHistoryView<ForwardTelemetryPointView> {forwardTelemetryVersion:number}
export interface ProbeTelemetryHistory extends ForwardTelemetryHistoryView<ProbeTelemetryPointView> {probeTelemetryVersion:number}

export interface NodeTelemetryApi extends TelemetryReadAdmission,TelemetryMachineAdmission {
    history(actor:string,scopeId:string,nodeId:string,input?:TelemetryHistoryQuery):Promise<NodeTelemetryHistory>;
    ingest(nodeId:string,fingerprint:string,sessionEpoch:number,input:unknown):Promise<NodeTelemetryAck>;
}
export interface ForwardTelemetryApi extends TelemetryReadAdmission,TelemetryMachineAdmission {
    history(actor:string,scopeId:string,forwardId:string,input?:TelemetryHistoryQuery):Promise<ForwardTelemetryHistory>;
    ingest(nodeId:string,fingerprint:string,sessionEpoch:number,input:unknown):Promise<ForwardTelemetryAck>;
}
export interface HostTelemetryApi extends TelemetryReadAdmission,TelemetryMachineAdmission {
    history(actor:string,scopeId:string,nodeId:string,input?:TelemetryHistoryQuery):Promise<HostTelemetryHistory>;
    ingest(nodeId:string,fingerprint:string,sessionEpoch:number,input:unknown):Promise<HostTelemetryAck>;
}
export interface ProbeTelemetryApi extends TelemetryReadAdmission,TelemetryMachineAdmission {
    history(actor:string,scopeId:string,forwardId:string,input?:TelemetryHistoryQuery):Promise<ProbeTelemetryHistory>;
    ingest(nodeId:string,fingerprint:string,sessionEpoch:number,input:unknown):Promise<ProbeTelemetryAck>;
}

export interface TelemetryRollupQuery {
    family?:string|undefined;resolution?:string|undefined;from?:string|undefined;to?:string|undefined;
    limit?:string|undefined;seriesKey?:string|undefined;after?:string|undefined;
}
export interface TelemetryRollupHistory {
    telemetryAggregateVersion:number;target:{kind:'node'|'forward';id:string};family:TelemetryFamily;enabled:boolean;
    source:string;health:string;executionAuthorized:boolean;observedAt:string;
    window:{from:string;to:string;resolution:TelemetryResolution;limit:number;seriesKey:string|null;after:string|null;nextAfter:string|null;truncated:boolean};
    retention:typeof TELEMETRY_ROLLUP_LIMITS;
    losses:({scope:'node-family'|'scope-family'}&TelemetryRollupLosses)|{
        scope:'withheld-scope-family';minuteEvicted:null;hourEvicted:null;cursorEvicted:null;cursorExpired:null;
    };
    items:TelemetryRollupRecord[];
}
export interface TelemetryRollupCapacity {
    telemetryAggregateVersion:number;enabled:boolean;source:string;executionAuthorized:boolean;observedAt:string;
    policy:typeof TELEMETRY_ROLLUP_LIMITS;observed:TelemetryRollupCounts;
    logicalBudget:{maxBucketJsonBytesPerNode:string;maxCursorJsonBytesPerNode:string;maxBucketJsonBytesPerScope:string;
        maxCursorJsonBytesPerScope:string;rawMaxJsonBytesPerNode:string;scopeRawHardCap:boolean;physicalBytesMeasured:boolean};
}
export interface TelemetryRollupApi extends TelemetryReadAdmission {
    history(actor:string,scopeId:string,kind:'node'|'forward',targetId:string,input:TelemetryRollupQuery):Promise<TelemetryRollupHistory>;
    capacity(actor:string,scopeId:string):Promise<TelemetryRollupCapacity>;
}
