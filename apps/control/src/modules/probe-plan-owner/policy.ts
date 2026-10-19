import { freezeModuleValue } from '../../framework/public.ts';

export const PROBE_PLAN_LIMITS = freezeModuleValue({ plansPerScope:32,decisionsPerPlan:16,maxLifetimeMs:3600000,retentionMs:604800000,
    minIntervalSeconds:30,maxIntervalSeconds:3600,defaultPageSize:25,maxPageSize:50,maxPlanBytes:4096,maxDecisionBytes:2048,maxResponseBytes:262144 });
