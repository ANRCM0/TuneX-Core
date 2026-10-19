import { MySqlProbePermitStore } from './mysql-probe-permit-store.ts';
import { probePermitStorageValues } from '../modules/probe-owner/public.ts';
import type { ProbePermitRecord, ProbePermitStore } from '../modules/probe-owner/public.ts';
import type { ProbeResultRecord } from '../modules/probe-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlProbePermitStore(probePermitStorageValues);

/** Legacy stateless entry; all SQL and recovery have one lower implementation. */
export class MySqlProbePermits implements ProbePermitStore<Transaction> {
    async lock(tx:Transaction) {return store.lock(tx);}
    async clock(tx:Transaction,now:number):Promise<void> {return store.clock(tx,now);}
    async prune(tx:Transaction,expiredBefore:number):Promise<void> {return store.prune(tx,expiredBefore);}
    async insert(tx:Transaction,permit:ProbePermitRecord):Promise<void> {return store.insert(tx,permit);}
    async close(tx:Transaction,id:string,state:'consumed'|'revoked',at:number):Promise<void> {return store.close(tx,id,state,at);}
    async withdraw(tx:Transaction,id:string,at:number):Promise<void> {return store.withdraw(tx,id,at);}
    async result(tx:Transaction,permitId:string):Promise<ProbeResultRecord|undefined> {return store.result(tx,permitId);}
    async recordResult(tx:Transaction,record:ProbeResultRecord):Promise<void> {return store.recordResult(tx,record);}
    static async quarantineRecovery(tx:Transaction):Promise<void> {return MySqlProbePermitStore.quarantineRecovery(tx);}
}
