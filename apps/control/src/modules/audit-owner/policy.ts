import { freezeModuleValue } from '../../framework/public.ts';

export const AUDIT_LIMITS = freezeModuleValue({ defaultWindowMs: 86400000, maxWindowMs: 2678400000, maxPageSize: 50,
    maxResponseBytes: 131072, activeRequests: 2, actorKeys: 128, cooldownMs: 1000 });
export const AUDIT_COVERAGE = freezeModuleValue({ completeness: 'existing-owner-records-only', retention: 'source-owned-no-common-retention',
    operationHistory: 'latest-state-not-transition-log', relatedRows: 'not-independent-command-count',
    nodeFilter: 'explicit-node-or-immutable-owned-config', associations: 'explicit-single-value-only-not-exhaustive-relations',
    globalRecovery: 'excluded-no-scope-attribution', ordering: 'occurredAt-desc-source-desc-key-desc',
    queryCost: 'bounded-output-not-verified-sql-cost' });
