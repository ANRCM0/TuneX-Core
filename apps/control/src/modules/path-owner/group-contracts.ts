import type { ForwardValue as Forward } from '../../framework/public.ts';
import type { PathGroupStoredHead, PathGroupStoredRevision, PathGroupStorageReader, PathGroupStorage, PathGroupStoredSelection,
    PathGroupBindingStoredRecord, PathGroupBindingStorageReader, PathGroupBindingStorage } from '../../framework/public.ts';
import type { PathBindingPreview, PathBindingReceipt, PathBindingRecord, PathSelection } from './binding-contracts.ts';

export interface PathGroupConfig {
    schemaVersion: 1;
    kind: 'egress-candidates' | 'backup-paths';
    candidates: { candidateId: string; template: PathSelection }[];
}
export interface PathGroupSelection extends PathGroupStoredSelection {}

export interface PathGroupHead extends PathGroupStoredHead {}
export interface PathGroupRevision extends PathGroupStoredRevision<PathGroupConfig> {}
export interface PathGroupReader<Tx> extends PathGroupStorageReader<Tx,PathGroupConfig> {}
export interface PathGroupWriter<Tx> extends PathGroupReader<Tx>,PathGroupStorage<Tx,PathGroupConfig> {}
export interface PathGroupBindingRecord extends PathGroupSelection,PathGroupBindingStoredRecord {}
export interface PathGroupBindingReceipt extends PathGroupSelection {
    sequence: number; pathBindingSequence: number; forwardRevision: number; changed: boolean;
}
export interface PathGroupBindingReader<Tx> extends PathGroupBindingStorageReader<Tx> {}
export interface PathGroupBindingWriter<Tx> extends PathGroupBindingReader<Tx>,PathGroupBindingStorage<Tx> {}
export interface ForwardPathGroups<Tx> {
    resolve(tx: Tx, actor: string, current: Forward, selection: PathGroupSelection): Promise<PathSelection>;
    accept(tx: Tx, actor: string, next: Forward, selection: PathGroupSelection, path: PathBindingReceipt): Promise<PathGroupBindingReceipt>;
    preserve(tx: Tx, current: Forward, next: Forward): Promise<void>;
    detach(tx: Tx, current: Forward): Promise<void>;
}
export interface PathGroupPathPreview<Tx> {
    previewIn(tx: Tx, actor: string, scope: string, forwardId: string, expectedRevision: number, selection: PathSelection): Promise<PathBindingPreview>;
}
export interface PathGroupOriginalPaths<Tx> {
    current(tx: Tx, scope: string, forwardId: string): Promise<PathBindingRecord | null>;
    at(tx: Tx, scope: string, forwardId: string, sequence: number): Promise<PathBindingRecord | null>;
}
