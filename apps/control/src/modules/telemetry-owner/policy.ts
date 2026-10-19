import { freezeModuleValue } from '../../framework/public.ts';

export const NODE_TELEMETRY_LIMITS = freezeModuleValue({ rawSeconds: 86400, maxPointsPerNode: 8640,
    maxQueryPoints: 512, minSampleIntervalMs: 9000, freshnessMs: 30000, maxSampleClockSkewMs: 300000 });
export const FORWARD_TELEMETRY_LIMITS = freezeModuleValue({ rawSeconds: 86400, maxPointsPerNode: 4096,
    maxPointBytes: 4096, maxMetadataBytes: 2048, maxQueryPoints: 512, minSampleIntervalMs: 9000,
    freshnessMs: 30000, maxSampleClockSkewMs: 300000, maxPointAgeMs: 900000 });
export const HOST_TELEMETRY_LIMITS = freezeModuleValue({ rawSeconds: 86400, maxPointsPerNode: 8640,
    maxQueryPoints: 512, minSampleIntervalMs: 9000, freshnessMs: 30000, maxSampleClockSkewMs: 300000 });
export const PROBE_TELEMETRY_LIMITS = freezeModuleValue({ rawSeconds: 86400, maxPointsPerNode: 4096,
    maxPointBytes: 4096, maxMetadataBytes: 2048, maxQueryPoints: 512, minSampleIntervalMs: 9000,
    freshnessMs: 30000, maxSampleClockSkewMs: 300000, maxPointAgeMs: 900000 });
export const TELEMETRY_ROLLUP_LIMITS = freezeModuleValue({ minuteSeconds: 604800, hourSeconds: 2592000,
    maxMinuteRowsPerNodeFamily: 10081, maxHourRowsPerNodeFamily: 721, maxCursorRowsPerNodeFamily: 512,
    maxMinuteRowsPerScope: 500000, maxHourRowsPerScope: 50000, maxCursorRowsPerScope: 16384,
    maxNodeFamiliesPerScope: 4096, maxBucketBytes: 8192, maxCursorBytes: 8192, maxQueryPoints: 512, cursorSeconds: 86400 });
