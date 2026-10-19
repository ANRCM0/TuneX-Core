import { MySqlProbeHistoryStore } from './mysql-probe-history-store.ts';
import { probeRunStorageValues } from '../modules/probe-history-owner/public.ts';
import type { ProbeRunLosses, ProbeRunQuery, ProbeRunRecord, ProbeRunStore } from '../modules/probe-history-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlProbeHistoryStore(probeRunStorageValues);

/** Legacy zero-argument public methods; one lower SQL implementation and original get overrides. */
export class MySqlProbeRuns implements ProbeRunStore<Transaction> {
    async lockScope(tx:Transaction,scope:string):Promise<void> {return store.lockScope(tx,scope);}
    async losses(tx:Transaction,scope:string):Promise<ProbeRunLosses> {return store.losses(tx,scope);}
    async missingUpdate(tx:Transaction,scope:string):Promise<void> {return store.missingUpdate(tx,scope);}
    async insert(tx:Transaction,value:ProbeRunRecord,now:number):Promise<void> {return store.insertUsingCurrent(tx,value,now,(tx,scope,id)=>this.get(tx,scope,id));}
    async get(tx:Transaction,scope:string,id:string,lock=false):Promise<ProbeRunRecord|null> {return store.get(tx,scope,id,lock);}
    async put(tx:Transaction,value:ProbeRunRecord):Promise<void> {return store.putUsingCurrent(tx,value,(tx,scope,id)=>this.get(tx,scope,id));}
    async history(tx:Transaction,scope:string,query:ProbeRunQuery):Promise<ProbeRunRecord[]> {return store.history(tx,scope,query);}
    static async quarantineRecovery(tx:Transaction):Promise<void> {return MySqlProbeHistoryStore.quarantineRecovery(tx);}
}
