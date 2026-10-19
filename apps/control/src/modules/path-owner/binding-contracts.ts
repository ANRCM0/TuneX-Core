import type { ForwardValue as Forward, ForwardIntent as ForwardSpec } from '../../framework/public.ts';
import type { PathBindingStoredSelection, PathBindingStoredRecord, PathBindingStorageReader, PathBindingStorage } from '../../framework/public.ts';

export interface PathSelection extends PathBindingStoredSelection {}
export interface PathBindingRecord extends PathSelection,PathBindingStoredRecord {}
export interface PathBindingReceipt extends PathSelection { sequence: number; forwardRevision: number; changed: boolean }
export interface PathBindingPreview {
    forwardId: string; expectedRevision: number; template: PathSelection; spec: ForwardSpec; proposedSpec: ForwardSpec;
    changed: boolean; source: 'persisted-control-state'; reserved: false; executionAuthorized: false; fullPlanAuthorization: false;
    previewOnly: true; interruption: 'possible-same-listener-replacement'; tcp: 'bounded-drain-or-authorization-deadline';
    udp: 'associations-may-reset-and-lose-datagrams';
}
export interface PathBindingReader<Tx> extends PathBindingStorageReader<Tx> {}
export interface PathBindingWriter<Tx> extends PathBindingReader<Tx>,PathBindingStorage<Tx> {}
export interface ForwardPathBindings<Tx> {
    resolveCreateIn?(tx: Tx, actor: string, scope: string, spec: ForwardSpec, selection: PathSelection): Promise<ForwardSpec>;
    resolve(tx: Tx, actor: string, current: Forward, selection: PathSelection): Promise<ForwardSpec>;
    accept(tx: Tx, actor: string, next: Forward, selection: PathSelection): Promise<PathBindingReceipt>;
    preserve(tx: Tx, current: Forward, next: Forward): Promise<void>;
}
