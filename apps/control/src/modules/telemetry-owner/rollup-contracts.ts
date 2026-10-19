import type { ForwardTelemetryPoint, ProbeTelemetryIdentity } from '../../compatibility/public.ts';
import type { TelemetryNode } from './node-contracts.ts';
import type { TelemetryRollupStorageFamily, TelemetryRollupStorageResolution, TelemetryRollupObservationRecord,
    TelemetryRollupBucketRecord, TelemetryRollupStoredRecord, TelemetryRollupStorageAfter, TelemetryRollupStorageWindow,
    TelemetryRollupStorageLosses, TelemetryRollupStorageCounts, TelemetryRollupStorageRecorder,
    TelemetryRollupStorage } from '../../framework/public.ts';

export type TelemetryFamily = TelemetryRollupStorageFamily;
export type TelemetryResolution = TelemetryRollupStorageResolution;
export interface TelemetrySeries {
    family: TelemetryFamily;
    nodeId: string;
    bootId: string;
    sessionEpoch: number;
    sampleEpoch: string;
    counterEpoch: string | null;
    execution: ForwardTelemetryPoint['identity'] | ProbeTelemetryIdentity | null;
}
export interface TelemetryObservation extends TelemetryRollupObservationRecord {
    series: TelemetrySeries;
    sequence: number;
    uptimeMs: number;
    capturedAt: number;
    state: 'current' | 'draining' | 'terminal';
    available: boolean;
    overflowed: boolean;
    counterContext: string;
    droppedSamples: string;
    tailsEvicted: string;
    tailsExpired: string;
    truncated: boolean;
    gauges: Record<string, string>;
    counters: Record<string, string>;
}
export interface TelemetryMetricStats {
    count: number;
    sum: string;
    min: string;
    max: string;
    elapsedMs: number;
}
export interface TelemetryCumulativeStats {
    count: number;
    first: string;
    last: string;
    min: string;
    max: string;
}
export interface TelemetryRollupBucket extends TelemetryRollupBucketRecord {
    telemetryAggregateVersion: 1;
    series: TelemetrySeries;
    end: number;
    sampleCount: number;
    receivedFrom: number;
    receivedTo: number;
    capturedFrom: number;
    capturedTo: number;
    quality: {
        baseline: number;
        continuous: number;
        gap: number;
        counterReset: number;
        unavailable: number;
        overflowed: number;
        terminal: number;
        truncated: number;
        exporterDropsMax: string;
        tailsEvictedMax: string;
        tailsExpiredMax: string;
        historyComplete: false;
    };
    coverage: {
        intervalCount: number;
        elapsedMs: number;
        from: number | null;
        to: number | null;
        boundaryIntervals: number;
        attribution: 'receipt-interval-end';
    };
    gauges: Record<string, TelemetryMetricStats>;
    cumulative: Record<string, TelemetryCumulativeStats>;
    increments: Record<string, TelemetryMetricStats>;
}
export interface TelemetryRollupRecord extends TelemetryRollupStoredRecord<TelemetryRollupBucket> {}
export interface TelemetryRollupAfter extends TelemetryRollupStorageAfter {}
export interface TelemetryRollupWindow extends TelemetryRollupStorageWindow {}
export interface TelemetryRollupLosses extends TelemetryRollupStorageLosses {}
export interface TelemetryRollupCounts extends TelemetryRollupStorageCounts {}
export interface TelemetryRollupRecorder<Tx> extends TelemetryRollupStorageRecorder<Tx,TelemetryObservation> {}
export interface TelemetryRollupStore<Tx> extends TelemetryRollupRecorder<Tx>,TelemetryRollupStorage<Tx,TelemetryObservation,TelemetryRollupBucket> {}
export interface TelemetryRollupTargets<Tx> {
    node(tx: Tx, nodeId: string): Promise<TelemetryNode | null>;
    forward(tx: Tx, scopeId: string, forwardId: string): Promise<{ scopeId: string; forwardId: string } | null>;
}
