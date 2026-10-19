import type { TunnelMetadataReadStore, ReadProjectionValues, ForwardIntent } from '../../framework/public.ts';
import type { ConsolePaging } from '../console-query-owner/public.ts';
import type { TunnelReadPort, TunnelReference } from './contracts.ts';

export class TunnelReadModels<Tx> implements TunnelReadPort<Tx> {
    private readonly store:TunnelMetadataReadStore<Tx>;
    private readonly values:ReadProjectionValues;
    constructor(store:TunnelMetadataReadStore<Tx>,values:ReadProjectionValues) {this.store=store;this.values=values;}
    async node(tx:Tx,scope:string,node:string) {
        return this.store.node(tx,scope,node,record=>record?{
            nodeId: record.id, revoked: Boolean(record.revoked), credentialUntil: record.credential_until,
            capabilities: record.capabilities === null ? [] : this.values.read<unknown>(record.capabilities), sessionEpoch: record.session_epoch ?? 0,
            snapshotGeneration: record.snapshot_generation ?? 0, lastReportAt: record.received_at,
        }:null);
    }
    async endpoint(tx:Tx,node:string) {
        return this.store.endpoint(tx,node,record=>record?{revision:record.revision,config:this.values.read<unknown>(record.config)}:null);
    }
    async peers(tx:Tx,node:string,now:number) {
        return this.store.peers(tx,node,now,({count,records})=>({
            total: Number(count?.total ?? 0), windowCount: Number(count?.window_count ?? 0), items: records.map(record => ({
                fingerprint: record.fingerprint, issuedAt: record.issued_at, validUntil: record.valid_until, retireAfter: record.retire_after, revoked: Boolean(record.revoked),
            })),
        }));
    }
    async references(tx:Tx,scope:string,node:string,paging:ConsolePaging) {
        return this.store.references(tx,scope,node,paging,({count,records})=>{
            const items: TunnelReference[] = records.map(record => ({ forwardId: record.id, revision: record.revision,
                spec: this.values.read<ForwardIntent>(record.spec), recoverySuspended: Boolean(record.recovery_suspended) }));
            return { total: Number(count?.n ?? 0), items };
        });
    }
}
