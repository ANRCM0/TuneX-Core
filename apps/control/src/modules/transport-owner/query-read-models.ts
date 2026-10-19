import type { ProfileReferenceReadStore, ReadProjectionValues, ForwardIntent } from '../../framework/public.ts';
import type { ConsolePaging } from '../console-query-owner/public.ts';
import type { ProfileReference, TransportReferenceReader } from './query-contracts.ts';

export class TransportReferenceReadModels<Tx> implements TransportReferenceReader<Tx> {
    private readonly store:ProfileReferenceReadStore<Tx>;
    private readonly values:ReadProjectionValues;
    constructor(store:ProfileReferenceReadStore<Tx>,values:ReadProjectionValues) {this.store=store;this.values=values;}
    async profile(tx:Tx,scope:string,profile:string) {
        return this.store.profile(tx,scope,profile,record=>record?{currentRevision:record.current_revision}:null);
    }
    async references(tx:Tx,scope:string,profile:string,paging:ConsolePaging,revision?:number) {
        return this.store.references(tx,scope,profile,paging,revision,({count,records})=>{
            const items: ProfileReference[] = records.map(record => {
                const spec = this.values.read<ForwardIntent>(record.spec);
                return { forwardId: record.id, revision: record.revision, spec, configRevision: spec?.transport?.configRevision ?? 0,
                    recoverySuspended: Boolean(record.recovery_suspended) };
            });
            return { total: Number(count?.n ?? 0), items };
        });
    }
}
