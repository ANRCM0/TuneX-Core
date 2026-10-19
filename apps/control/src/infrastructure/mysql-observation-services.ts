import { MySqlObservationServiceStore } from './mysql-observation-service-store.ts';
import { observationServiceStorageValues } from '../modules/observation-service-owner/public.ts';
import type { ObservationServiceAudit, ObservationServiceHead, ObservationServiceRevision, ObservationServiceStore } from '../modules/observation-service-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlObservationServiceStore(observationServiceStorageValues);

/** Original public/static entrypoints and head/count overrides over one lower SQL implementation. */
export class MySqlObservationServices implements ObservationServiceStore<Transaction> {
    async lockScope(tx:Transaction,scope:string):Promise<void> {return store.lockScope(tx,scope);}
    async count(tx:Transaction,scope:string):Promise<number> {return store.count(tx,scope);}
    async list(tx:Transaction,scope:string):Promise<ObservationServiceHead[]> {return store.list(tx,scope);}
    async head(tx:Transaction,scope:string,id:string,lock=false):Promise<ObservationServiceHead|null> {return store.head(tx,scope,id,lock);}
    async revision(tx:Transaction,scope:string,id:string,revision:number):Promise<ObservationServiceRevision|null> {return store.revision(tx,scope,id,revision);}
    async insertRevision(tx:Transaction,scope:string,id:string,value:ObservationServiceRevision):Promise<void> {return store.insertRevision(tx,scope,id,value);}
    async putHead(tx:Transaction,scope:string,value:ObservationServiceHead):Promise<void> {return store.putHeadUsing(tx,scope,value,{head:(tx,scope,id)=>this.head(tx,scope,id),count:(tx,scope)=>this.count(tx,scope)});}
    async audit(tx:Transaction,scope:string,value:ObservationServiceAudit):Promise<void> {return store.audit(tx,scope,value);}
    async audits(tx:Transaction,scope:string,id:string):Promise<ObservationServiceAudit[]> {return store.audits(tx,scope,id);}
    async auditLosses(tx:Transaction,scope:string):Promise<number> {return store.auditLosses(tx,scope);}
    static async quarantineRecovery(tx:Transaction):Promise<void> {return MySqlObservationServiceStore.quarantineRecovery(tx);}
}
