import type { ConsolePaging } from '../application/console-query.ts';
import type { PathTemplateConfig } from './path-template-contract.ts';

export interface PathTemplateHead { templateId: string; currentRevision: number; archived: boolean }
export interface PathTemplateRevision {
    revision: number; config: PathTemplateConfig; profileDigest: string; configDigest: string; createdBy: string; createdAt: number;
}
export interface PathTemplateReader<Tx> {
    head(tx: Tx, scope: string, id: string, lock?: boolean): Promise<PathTemplateHead | null>;
    revision(tx: Tx, scope: string, id: string, revision: number): Promise<PathTemplateRevision | null>;
    list(tx: Tx, scope: string, paging: ConsolePaging, prefix: string): Promise<{ total: number; items: PathTemplateHead[] }>;
}
export interface PathTemplateWriter<Tx> extends PathTemplateReader<Tx> {
    lockScope(tx: Tx, scope: string): Promise<void>;
    count(tx: Tx, scope: string): Promise<number>;
    publish(tx: Tx, scope: string, id: string, record: PathTemplateRevision): Promise<void>;
    archive(tx: Tx, scope: string, id: string): Promise<void>;
    audit(tx: Tx, scope: string, id: string, actor: string, revision: number, kind: 'publish' | 'archive', at: number): Promise<void>;
}
export interface PathTemplateReferences<Tx> {
    validate(tx: Tx, actor: string, scope: string, config: PathTemplateConfig): Promise<{ profileDigest: string }>;
}
