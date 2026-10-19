import { TunnelReadModels } from '../application/management-read-models.ts';
import { nativeReadProjectionValues } from '../compatibility/public.ts';
import { MySqlTunnelMetadataReadStore } from './mysql-management-read.ts';
import type { Transaction } from './mysql.ts';
import type { TunnelReadPort } from '../modules/tunnel-query-owner/public.ts';
import type { ConsolePaging } from '../modules/console-query-owner/public.ts';

const reader=new TunnelReadModels(new MySqlTunnelMetadataReadStore(),nativeReadProjectionValues);

/** Stateless compatibility methods; no SQL, projection or private class state is copied. */
export class MySqlTunnelReader implements TunnelReadPort<Transaction> {
    async node(tx:Transaction,scope:string,node:string) {return reader.node(tx,scope,node);}
    async endpoint(tx:Transaction,node:string) {return reader.endpoint(tx,node);}
    async peers(tx:Transaction,node:string,now:number) {return reader.peers(tx,node,now);}
    async references(tx:Transaction,scope:string,node:string,paging:ConsolePaging) {return reader.references(tx,scope,node,paging);}
}
