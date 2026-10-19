import type { ForwardIntent } from './forward-import.ts';
import type { ForwardValue } from './intent-store-ports.ts';
import type { ReadPageWindow } from './management-read-ports.ts';

export const PATH_GROUP_STORAGE_INTERFACE_VERSION=1 as const;

export interface PathGroupStoredHead { groupId: string; currentRevision: number; archived: boolean }
export interface PathGroupStoredRevision<Config> {
    revision: number; config: Config; configDigest: string; createdBy: string; createdAt: number;
}
export interface PathGroupStorageReader<Tx,Config> {
    head(tx: Tx, scope: string, id: string, lock?: boolean): Promise<PathGroupStoredHead | null>;
    revision(tx: Tx, scope: string, id: string, revision: number): Promise<PathGroupStoredRevision<Config> | null>;
    list(tx: Tx, scope: string, paging: ReadPageWindow, prefix: string): Promise<{ total: number; items: PathGroupStoredHead[] }>;
}
export interface PathGroupStorage<Tx,Config> extends PathGroupStorageReader<Tx,Config> {
    lockScope(tx: Tx, scope: string): Promise<void>;
    count(tx: Tx, scope: string): Promise<number>;
    publish(tx: Tx, scope: string, id: string, record: PathGroupStoredRevision<Config>): Promise<void>;
    archive(tx: Tx, scope: string, id: string): Promise<void>;
    audit(tx: Tx, scope: string, id: string, actor: string, revision: number, kind: 'publish' | 'archive', at: number): Promise<void>;
}
export interface PathGroupStoredSelection { groupId: string; revision: number; configDigest: string; candidateId: string }
export interface PathGroupBindingStoredRecord extends PathGroupStoredSelection {
    sequence: number; pathBindingSequence: number; forwardRevision: number;
    expandedSpec: ForwardIntent; specDigest: string; actorId: string; createdAt: number;
}
export interface PathGroupBindingStorageReader<Tx> {
    current(tx: Tx, scope: string, forwardId: string): Promise<PathGroupBindingStoredRecord | null>;
    history(tx: Tx, scope: string, forwardId: string): Promise<PathGroupBindingStoredRecord[]>;
    references(tx: Tx, scope: string, id: string, paging: ReadPageWindow, revision?: number): Promise<{
        total: number; items: { forward: ForwardValue; recoverySuspended: boolean; binding: PathGroupBindingStoredRecord }[];
    }>;
}
export interface PathGroupBindingStorage<Tx> extends PathGroupBindingStorageReader<Tx> {
    append(tx: Tx, scope: string, forwardId: string, record: Omit<PathGroupBindingStoredRecord, 'sequence'>): Promise<PathGroupBindingStoredRecord>;
    detach(tx: Tx, scope: string, forwardId: string): Promise<void>;
}
