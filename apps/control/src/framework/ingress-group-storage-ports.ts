import type { ReadPageWindow } from './management-read-ports.ts';
import type { ReadPrincipal } from './resource-access-ports.ts';

export const INGRESS_GROUP_STORAGE_INTERFACE_VERSION=2 as const;

export interface IngressGroupStoredHead { groupId: string; currentRevision: number; archived: boolean; ownerActorId: string | null }
export interface IngressGroupStoredRevision<Config> {
    revision: number; config: Config; configDigest: string; createdBy: string; createdAt: number;
}
export interface IngressGroupStorage<Tx,Config> {
    lockScope(tx: Tx, scope: string): Promise<void>;
    count(tx: Tx, scope: string): Promise<number>;
    head(tx: Tx, scope: string, id: string, lock?: boolean): Promise<IngressGroupStoredHead | null>;
    revision(tx: Tx, scope: string, id: string, revision: number): Promise<IngressGroupStoredRevision<Config> | null>;
    list(tx: Tx, scope: string, principal: ReadPrincipal, paging: ReadPageWindow, prefix: string): Promise<{ total: number; items: IngressGroupStoredHead[] }>;
    publish(tx: Tx, scope: string, id: string, record: IngressGroupStoredRevision<Config>): Promise<void>;
    classifyOwner(tx: Tx, scope: string, id: string, expectedRevision: number, ownerActorId: string): Promise<void>;
    archive(tx: Tx, scope: string, id: string): Promise<void>;
    audit(tx: Tx, scope: string, id: string, actor: string, revision: number, kind: 'publish' | 'archive' | 'classify-owner', at: number, ownerActorId?: string): Promise<void>;
}
