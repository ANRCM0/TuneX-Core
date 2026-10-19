import type { ProbeTelemetryPoint, ProbeTelemetrySample } from '../../compatibility/public.ts';
import type { TelemetryStoredMappedHead, TelemetryStoredForward, TelemetryAcceptedPoint,
    TelemetryProbeRecord, TelemetryMappedStorage } from '../../framework/public.ts';
import type { ProbeTelemetryMapping } from './probe-mapping-contracts.ts';

export type ProbeTelemetryExport = Pick<ProbeTelemetrySample,
    'sampleEpoch' | 'sequence' | 'capturedAt' | 'uptimeMs' | 'droppedSamples' | 'coverage'>;
export interface ProbeTelemetryHead extends TelemetryStoredMappedHead {}
export interface ProbeTelemetryForward extends TelemetryStoredForward {}
export interface ProbeTelemetryAccepted extends TelemetryAcceptedPoint<ProbeTelemetryPoint,ProbeTelemetryMapping> {}
export interface ProbeTelemetryRecord extends TelemetryProbeRecord {}
export interface ProbeTelemetryStore<Tx> extends TelemetryMappedStorage<Tx,ProbeTelemetrySample,ProbeTelemetryAccepted,ProbeTelemetryRecord> {}
