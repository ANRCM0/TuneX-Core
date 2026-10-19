import { freezeModuleValue } from '../../framework/public.ts';

export const PROBE_RUN_LIMITS = freezeModuleValue({ retentionMs: 604800000, maxRunsPerScope: 1024, pruneBatch: 16,
    defaultPageSize: 25, maxPageSize: 50, maxRecordBytes: 4096, maxResponseBytes: 262144 });
