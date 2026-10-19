import type { ForwardIntent } from './forward-import.ts';
import type { ForwardValue } from './intent-store-ports.ts';
import type { ReadPageWindow } from './management-read-ports.ts';

export const PATH_BINDING_STORAGE_INTERFACE_VERSION=1 as const;

export interface PathBindingStoredSelection { templateId: string; revision: number; configDigest: string }
export interface PathBindingStoredRecord extends PathBindingStoredSelection {
    sequence: number; forwardRevision: number; expandedSpec: ForwardIntent; specDigest: string; actorId: string; createdAt: number;
}
export interface PathBindingStorageReader<Tx> {
    current(tx: Tx, scope: string, forwardId: string): Promise<PathBindingStoredRecord | null>;
    history(tx: Tx, scope: string, forwardId: string): Promise<PathBindingStoredRecord[]>;
    references(tx: Tx, scope: string, templateId: string, paging: ReadPageWindow, revision?: number): Promise<{
        total: number; items: { forward: ForwardValue; recoverySuspended: boolean; binding: PathBindingStoredRecord }[];
    }>;
}
/** Existing sequence lookup used by the original PathGroup provenance reader. */
export interface PathBindingSequenceReader<Tx> {
    at(tx: Tx, scope: string, forwardId: string, sequence: number): Promise<PathBindingStoredRecord | null>;
}
export interface PathBindingStorage<Tx> extends PathBindingStorageReader<Tx> {
    append(tx: Tx, scope: string, forwardId: string, record: Omit<PathBindingStoredRecord, 'sequence'>): Promise<PathBindingStoredRecord>;
    detach(tx: Tx, scope: string, forwardId: string): Promise<void>;
}
