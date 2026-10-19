export const PATH_GROUP_LIMITS = { groupsPerScope: 64, revisionsPerGroup: 64, candidatesPerGroup: 8, bindingsPerForward: 64 } as const;
export const PATH_PUBLICATION_LIMITS = { batchesPerScope: 64, itemsPerBatch: 10, attemptsPerItem: 2, maxPlanBytes: 131072, maxBatchRevision: 24 } as const;
