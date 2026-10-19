import type { TelemetryRollupStorageValues } from '../../framework/public.ts';
import type { TelemetryObservation, TelemetryRollupBucket } from './rollup-contracts.ts';
import { TELEMETRY_ROLLUP_LIMITS, parseTelemetryObservation, parseTelemetryRollupBucket,
    foldTelemetryRollup } from './rollup-values.ts';

export const telemetryRollupStorageValues:TelemetryRollupStorageValues<TelemetryObservation,TelemetryRollupBucket>=Object.freeze({
    limits:TELEMETRY_ROLLUP_LIMITS,
    observation:parseTelemetryObservation,
    bucket:parseTelemetryRollupBucket,
    fold:foldTelemetryRollup,
});
