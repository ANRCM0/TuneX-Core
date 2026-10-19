import type { ReadPageWindow } from './management-read-ports.ts';
import type { IngressDeploymentStoredHead } from './ingress-deployment-storage-ports.ts';
import type { PathPublicationStoredAttempt, PathPublicationStoredOperation, PathPublicationStorageHooks } from './path-publication-storage-ports.ts';

export const INGRESS_MIGRATION_STORAGE_INTERFACE_VERSION=1 as const;

export interface IngressMigrationStoredPlan {
    sourceGroup: { groupId: string; revision: number };
    targetGroup: { groupId: string; revision: number };
}
export interface IngressMigrationStoredAttempt<Outcome = unknown> extends PathPublicationStoredAttempt<Outcome> {}
export interface IngressMigrationStoredRecord<Plan,Outcome> {
    head: IngressDeploymentStoredHead; plan: Plan; attempts: IngressMigrationStoredAttempt<Outcome>[];
}
export type IngressMigrationStorageHooks<Tx> = PathPublicationStorageHooks<Tx>;
export interface IngressMigrationStorage<Tx,Plan extends IngressMigrationStoredPlan,Outcome,Failure> {
    lockScope(tx: Tx, scope: string): Promise<void>;
    count(tx: Tx, scope: string): Promise<number>;
    list(tx: Tx, scope: string, paging: ReadPageWindow, groupId?: string): Promise<{ total: number; items: IngressDeploymentStoredHead[] }>;
    read(tx: Tx, scope: string, id: string, lock?: boolean): Promise<IngressMigrationStoredRecord<Plan,Outcome> | null>;
    create(tx: Tx, scope: string, head: IngressDeploymentStoredHead, plan: Plan): Promise<void>;
    append(tx: Tx, scope: string, id: string, expectedRevision: number, attempt: IngressMigrationStoredAttempt<Outcome>): Promise<void>;
    cancel(tx: Tx, scope: string, id: string, expectedRevision: number, actor: string, at: number): Promise<void>;
    isolate<T>(tx: Tx, action: () => Promise<T>): Promise<{ accepted: true; value: T } | { accepted: false; error: Failure }>;
    operations(tx: Tx, scope: string, ids: string[]): Promise<PathPublicationStoredOperation[]>;
}
