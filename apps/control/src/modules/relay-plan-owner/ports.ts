import type { Forward } from '@tunex/core';
import type { RelayPreview } from './contracts.ts';

export interface RelayPreviewProvider<Tx> {
    preview(tx:Tx,actor:string,forward:Forward):Promise<RelayPreview>;
}
