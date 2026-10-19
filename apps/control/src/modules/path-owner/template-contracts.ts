import type { PathTemplateStoredHead, PathTemplateStoredRevision, PathTemplateStorageReader, PathTemplateStorage } from '../../framework/public.ts';

export interface PathTemplateConfig {
    readonly version: 1;
    readonly protocols: readonly ('tcp' | 'udp')[];
    readonly nodes: readonly string[];
    readonly endpoints: readonly { readonly nodeId: string; readonly revision: number }[];
    readonly transport: { readonly profileId: string; readonly configRevision: number };
}

export interface PathTemplateHead extends PathTemplateStoredHead {}
export interface PathTemplateRevision extends PathTemplateStoredRevision<PathTemplateConfig> {}
export interface PathTemplateReader<Tx> extends PathTemplateStorageReader<Tx,PathTemplateConfig> {}
export interface PathTemplateWriter<Tx> extends PathTemplateReader<Tx>,PathTemplateStorage<Tx,PathTemplateConfig> {}
export interface PathTemplateReferences<Tx> {
    validate(tx: Tx, actor: string, scope: string, config: PathTemplateConfig): Promise<{ profileDigest: string }>;
}
