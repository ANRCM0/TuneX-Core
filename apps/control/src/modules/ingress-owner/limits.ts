import { freezeModuleValue } from '../../framework/public.ts';

export const INGRESS_LIMITS = { groupsPerScope: 64, revisionsPerGroup: 64, membersPerGroup: 8, batchesPerScope: 64,
    itemsPerBatch: 8, attemptsPerItem: 2, maxPlanBytes: 131072, maxBatchRevision: 20 } as const;
// Preserve the migration limit object's existing runtime freeze and broad number types.
export const INGRESS_MIGRATION_LIMITS = freezeModuleValue({ batchesPerScope: 64, itemsPerBatch: 8, sourcesPerBatch: 8,
    attemptsPerItem: 2, maxPlanBytes: 131072, maxBatchRevision: 20 });
