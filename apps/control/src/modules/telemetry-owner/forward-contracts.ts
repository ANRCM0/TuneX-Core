import type { ForwardTelemetryPoint, ForwardTelemetrySample } from '../../compatibility/public.ts';
import type { TelemetryStoredMappedHead, TelemetryStoredForward, TelemetryAcceptedPoint,
    TelemetryMappedRecord, TelemetryMappedStorage } from '../../framework/public.ts';
import type { ForwardTelemetryMapping } from './forward-mapping-contracts.ts';

export type ForwardTelemetryExport = Pick<ForwardTelemetrySample,
    'sampleEpoch' | 'sequence' | 'capturedAt' | 'uptimeMs' | 'snapshotGeneration' | 'droppedSamples' | 'coverage'>;
export interface ForwardTelemetryHead extends TelemetryStoredMappedHead {}
export interface ForwardTelemetryForward extends TelemetryStoredForward {}
export interface ForwardTelemetryAccepted extends TelemetryAcceptedPoint<ForwardTelemetryPoint,ForwardTelemetryMapping> {}
export interface ForwardTelemetryRecord extends TelemetryMappedRecord<ForwardTelemetryMapping['source']> {}
export interface ForwardTelemetryStore<Tx> extends TelemetryMappedStorage<Tx,ForwardTelemetrySample,ForwardTelemetryAccepted,ForwardTelemetryRecord> {}
