import { freezeModuleValue } from '../../framework/public.ts';

export const STATION_ALERT_LIMITS = freezeModuleValue({ policiesPerScope: 64, eventsPerScope: 1024, auditPerScope: 256,
    auditPage: 16, eventPage: 50, eventRetentionMs: 2592000000, evaluationIntervalMs: 30000,
    silenceMaxMs: 604800000, responseBytes: 262144, activeRequests: 2, actorKeys: 128, cooldownMs: 1000 });
