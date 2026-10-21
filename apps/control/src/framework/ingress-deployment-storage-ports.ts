import type { ReadPrincipal } from './resource-access-ports.ts';
import type { ReadPageWindow } from './management-read-ports.ts';
import type { PathPublicationStoredHead, PathPublicationStoredOperation } from './path-publication-storage-ports.ts';

export const INGRESS_DEPLOYMENT_STORAGE_INTERFACE_VERSION=2 as const;

export interface IngressDeploymentStoredHead extends PathPublicationStoredHead {}
export interface IngressDeploymentStoredPlan { group: { groupId: string; revision: number } }
export interface IngressDeploymentStoredAttempt<Outcome = unknown> {
    position: number; kind: 'create' | 'compensate'; actorId: string; createdAt: number; requestKey: string; requestDigest: string;
    outcome: Outcome;
}
export interface IngressDeploymentStoredRecord<Plan,Outcome> {
    head: IngressDeploymentStoredHead; plan: Plan; attempts: IngressDeploymentStoredAttempt<Outcome>[];
}
export interface IngressDeploymentStorageHooks<Tx> {
    count?: (tx: Tx, scope: string) => Promise<number>;
    event?: (tx: Tx, scope: string, id: string, revision: number, kind: 'create' | 'compensate' | 'cancel', actor: string, at: number) => Promise<void>;
}
export interface IngressDeploymentStorage<Tx,Plan extends IngressDeploymentStoredPlan,Outcome,Failure> {
    lockScope(tx: Tx, scope: string): Promise<void>;
    count(tx: Tx, scope: string): Promise<number>;
    list(tx: Tx, scope: string, principal: ReadPrincipal, paging: ReadPageWindow, groupId?: string): Promise<{ total: number; items: IngressDeploymentStoredHead[] }>;
    read(tx: Tx, scope: string, id: string, lock?: boolean): Promise<IngressDeploymentStoredRecord<Plan,Outcome> | null>;
    create(tx: Tx, scope: string, head: IngressDeploymentStoredHead, plan: Plan): Promise<void>;
    append(tx: Tx, scope: string, id: string, expectedRevision: number, attempt: IngressDeploymentStoredAttempt<Outcome>): Promise<void>;
    cancel(tx: Tx, scope: string, id: string, expectedRevision: number, actor: string, at: number): Promise<void>;
    isolate<T>(tx: Tx, action: () => Promise<T>): Promise<{ accepted: true; value: T } | { accepted: false; error: Failure }>;
    operations(tx: Tx, scope: string, ids: string[]): Promise<PathPublicationStoredOperation[]>;
}
