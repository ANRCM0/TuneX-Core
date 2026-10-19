import { MySqlProbeQualificationStore } from './mysql-probe-qualification-store.ts';
import { probeQualificationStorageValues } from '../modules/probe-owner/public.ts';
import type { ProbeTypeQualification, ProbeTypeQualifications } from '../modules/probe-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlProbeQualificationStore(probeQualificationStorageValues);

/** Legacy zero-argument entry; no second qualification store or authority. */
export class MySqlProbeTypeQualifications implements ProbeTypeQualifications<Transaction> {
    async get(tx:Transaction,node:string,lock=false):Promise<ProbeTypeQualification|null> {return store.get(tx,node,lock);}
    async put(tx:Transaction,input:ProbeTypeQualification):Promise<void> {return store.put(tx,input);}
    static async quarantineRecovery(tx:Transaction):Promise<void> {return MySqlProbeQualificationStore.quarantineRecovery(tx);}
}
