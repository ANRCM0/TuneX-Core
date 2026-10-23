import type { ReadPrincipal } from './resource-access-ports.ts';
import type { ReadPageWindow } from './management-read-ports.ts';

export const PATH_PUBLICATION_STORAGE_INTERFACE_VERSION=2 as const;

export interface PathPublicationStoredHead {
    batchId: string; revision: number; createdBy: string; createdAt: number; planDigest: string; cancelled: boolean; recoveryInvalidated: boolean;
}
export interface PathPublicationStoredAttempt<Outcome = unknown> {
    position: number; kind: 'apply' | 'compensate'; actorId: string; createdAt: number; requestKey: string; requestDigest: string;
    outcome: Outcome;
}
export interface PathPublicationStoredRecord<Plan,Outcome> {
    head: PathPublicationStoredHead; plan: Plan; attempts: PathPublicationStoredAttempt<Outcome>[];
}
export interface PathPublicationStoredOperation {
    operationId: string; forwardId: string; targetRevision: number;
    status: 'accepted' | 'running' | 'succeeded' | 'failed' | 'superseded'; cleanupPending: boolean; recoveryInvalidated: boolean;
}
export interface PathPublicationStorageValues<Failure> {
    isRefusal(error: unknown): boolean;
    refusal(error: unknown): Failure;
}
export interface PathPublicationStorageHooks<Tx> {
    count?: (tx: Tx, scope: string) => Promise<number>;
    event?: (tx: Tx, scope: string, id: string, revision: number, kind: 'create' | 'apply' | 'compensate' | 'cancel', actor: string, at: number) => Promise<void>;
}
export interface PathPublicationStorage<Tx,Plan,Outcome,Failure> {
    lockScope(tx: Tx, scope: string): Promise<void>;
    count(tx: Tx, scope: string): Promise<number>;
    list(tx: Tx, scope: string, principal: ReadPrincipal, paging: ReadPageWindow): Promise<{ total: number; items: PathPublicationStoredHead[] }>;
    read(tx: Tx, scope: string, id: string, lock?: boolean): Promise<PathPublicationStoredRecord<Plan,Outcome> | null>;
    create(tx: Tx, scope: string, head: PathPublicationStoredHead, plan: Plan): Promise<void>;
    append(tx: Tx, scope: string, id: string, expectedRevision: number, attempt: PathPublicationStoredAttempt<Outcome>): Promise<void>;
    cancel(tx: Tx, scope: string, id: string, expectedRevision: number, actor: string, at: number): Promise<void>;
    isolate<T>(tx: Tx, action: () => Promise<T>): Promise<{ accepted: true; value: T } | { accepted: false; error: Failure }>;
    operations(tx: Tx, scope: string, ids: string[]): Promise<PathPublicationStoredOperation[]>;
}
