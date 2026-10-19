import { MySqlProbeInstanceStore } from './mysql-probe-instance-store.ts';
import { probeInstanceStorageValues } from '../modules/probe-owner/public.ts';
import type { ProbeInstanceRecord, ProbeInstanceStore } from '../modules/probe-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlProbeInstanceStore(probeInstanceStorageValues);

/** Legacy zero-argument entry; storage and recovery have one lower implementation. */
export class MySqlProbeInstances implements ProbeInstanceStore<Transaction> {
    async readCurrent(tx:Transaction,nodeId:string):Promise<ProbeInstanceRecord|undefined> {return store.readCurrent(tx,nodeId);}
    async read(tx:Transaction,nodeId:string):Promise<ProbeInstanceRecord|undefined> {return store.read(tx,nodeId);}
    async lock(tx:Transaction,nodeId:string):Promise<ProbeInstanceRecord|undefined> {return store.lock(tx,nodeId);}
    async replace(tx:Transaction,expectedGeneration:number,next:ProbeInstanceRecord):Promise<void> {return store.replace(tx,expectedGeneration,next);}
    static async quarantineRecovery(tx:Transaction):Promise<void> {return MySqlProbeInstanceStore.quarantineRecovery(tx);}
}
