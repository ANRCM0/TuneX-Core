import type { ReadPrincipal } from './resource-access-ports.ts';
import type { ReadPageWindow } from './management-read-ports.ts';

export const PATH_TEMPLATE_STORAGE_INTERFACE_VERSION=2 as const;

export interface PathTemplateStoredHead { templateId: string; ownerActorId: string | null; currentRevision: number; archived: boolean }
export interface PathTemplateStoredRevision<Config> {
    revision: number; config: Config; profileDigest: string; configDigest: string; createdBy: string; createdAt: number;
}
export interface PathTemplateStorageReader<Tx,Config> {
    head(tx: Tx, scope: string, id: string, lock?: boolean): Promise<PathTemplateStoredHead | null>;
    revision(tx: Tx, scope: string, id: string, revision: number): Promise<PathTemplateStoredRevision<Config> | null>;
    list(tx: Tx, scope: string, principal: ReadPrincipal, paging: ReadPageWindow, prefix: string): Promise<{ total: number; items: PathTemplateStoredHead[] }>;
}
export interface PathTemplateStorage<Tx,Config> extends PathTemplateStorageReader<Tx,Config> {
    lockScope(tx: Tx, scope: string): Promise<void>;
    count(tx: Tx, scope: string): Promise<number>;
    publish(tx: Tx, scope: string, id: string, record: PathTemplateStoredRevision<Config>): Promise<void>;
    archive(tx: Tx, scope: string, id: string): Promise<void>;
    classifyOwner(tx: Tx, scope: string, id: string, expectedRevision: number, ownerActorId: string): Promise<number>;
    auditOwnership(tx: Tx, scope: string, id: string, actor: string, ownerActorId: string, revision: number, at: number): Promise<void>;
    audit(tx: Tx, scope: string, id: string, actor: string, revision: number, kind: 'publish' | 'archive', at: number): Promise<void>;
}
