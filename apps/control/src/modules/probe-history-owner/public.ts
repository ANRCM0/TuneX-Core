export const PROBE_HISTORY_MODULE_INTERFACE_VERSION=1 as const;
export { PROBE_HISTORY_API_INTERFACE_VERSION } from './api.ts';
export type * from './api.ts';
export type * from './contracts.ts';
export { PROBE_RUN_LIMITS } from './policy.ts';
export { PROBE_RUN_STATES, probeRunTime, probeRunObject, parseProbeRunPermit, parseProbeRunResult,
    parseProbeRunRecord, parseProbeRunLosses, probeRunImmutable, publicProbeRun } from './values.ts';
export { probeRunStorageValues } from './storage-values.ts';
export { ProbeRunHistoryRecorder, ProbeRuns } from './service.ts';
