// Process-local runtime decisions, separate from the frozen pure domain package.
export const RUNTIME_KERNEL_INTERFACE_VERSION=1 as const;
export { holdPublishedSnapshot, reusePublishedSnapshot, publicationDeadline } from './publication.ts';
export type { PublishedSnapshotFacts, PublicationLeaseFacts } from './publication.ts';
