import { freezeModuleValue } from '../../framework/public.ts';

export const FORWARD_DIAGNOSTIC_LIMITS = freezeModuleValue({ nodes: 8, operations: 8, listeners: 16, slots: 16,
    retirements: 32, leases: 32, probes: 8, responseBytes: 131072, supportBytes: 65536,
    activeRequests: 2, actorKeys: 128, cooldownMs: 1000 });
