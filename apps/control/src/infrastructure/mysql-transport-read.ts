import type { ReadPrincipal } from '../framework/public.ts';
import { TransportReferenceReadModels } from '../application/management-read-models.ts';
import { nativeReadProjectionValues } from '../compatibility/public.ts';
import { MySqlProfileReferenceReadStore } from './mysql-management-read.ts';
import type { Transaction } from './mysql.ts';
import type { TransportReferenceReader } from '../modules/transport-owner/public.ts';
import type { ConsolePaging } from '../modules/console-query-owner/public.ts';

const reader=new TransportReferenceReadModels(new MySqlProfileReferenceReadStore(),nativeReadProjectionValues);

/** Stateless compatibility methods; no SQL, projection or private class state is copied. */
export class MySqlTransportReader implements TransportReferenceReader<Transaction> {
    async profile(tx:Transaction,scope:string,profile:string) {return reader.profile(tx,scope,profile);}
    async references(tx:Transaction,scope:string,principal:ReadPrincipal,profile:string,paging:ConsolePaging,revision?:number) {return reader.references(tx,scope,principal,profile,paging,revision);}
}
