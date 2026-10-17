import type { Forward, ForwardSpec } from '@tunex/core';
import type { ConsolePaging } from '../application/console-query.ts';

export interface PathSelection { templateId: string; revision: number; configDigest: string }
export interface PathBindingRecord extends PathSelection {
    sequence: number; forwardRevision: number; expandedSpec: ForwardSpec; specDigest: string; actorId: string; createdAt: number;
}
export interface PathBindingReceipt extends PathSelection { sequence: number; forwardRevision: number; changed: boolean }
export interface PathBindingReader<Tx> {
    current(tx: Tx, scope: string, forwardId: string): Promise<PathBindingRecord | null>;
    history(tx: Tx, scope: string, forwardId: string): Promise<PathBindingRecord[]>;
    references(tx: Tx, scope: string, templateId: string, paging: ConsolePaging, revision?: number): Promise<{
        total: number; items: { forward: Forward; recoverySuspended: boolean; binding: PathBindingRecord }[];
    }>;
}
export interface PathBindingWriter<Tx> extends PathBindingReader<Tx> {
    append(tx: Tx, scope: string, forwardId: string, record: Omit<PathBindingRecord, 'sequence'>): Promise<PathBindingRecord>;
    detach(tx: Tx, scope: string, forwardId: string): Promise<void>;
}
export interface ForwardPathBindings<Tx> {
    resolve(tx: Tx, actor: string, current: Forward, selection: PathSelection): Promise<ForwardSpec>;
    accept(tx: Tx, actor: string, next: Forward, selection: PathSelection): Promise<PathBindingReceipt>;
    preserve(tx: Tx, current: Forward, next: Forward): Promise<void>;
}
