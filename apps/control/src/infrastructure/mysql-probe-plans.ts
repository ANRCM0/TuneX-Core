import { MySqlProbePlanStore } from './mysql-probe-plan-store.ts';
import { probePlanStorageValues } from '../modules/probe-plan-owner/public.ts';
import type { ProbePlanStore, ProbePlanHead, ProbePlanDecision, ProbePlanQuery, ProbePlanHeader, ProbePlanLosses, ProbePlanFailure } from '../modules/probe-plan-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlProbePlanStore(probePlanStorageValues);

/** Existing public constructor/static methods and lock/get/put override points remain. */
export class MySqlProbePlans implements ProbePlanStore<Transaction> {
    async lockScope(tx:Transaction,scope:string):Promise<void> {return store.lockScope(tx,scope);}
    async losses(tx:Transaction,scope:string):Promise<ProbePlanLosses> {return store.losses(tx,scope);}
    async create(tx:Transaction,value:ProbePlanHead,now:number):Promise<void> {return store.createUsing(tx,value,now,{lockScope:(tx,scope)=>this.lockScope(tx,scope),put:(tx,head)=>this.put(tx,head)});}
    async get(tx:Transaction,scope:string,id:string,lock:boolean|'share'=false):Promise<ProbePlanHead|null> {return store.get(tx,scope,id,lock);}
    async put(tx:Transaction,value:ProbePlanHead):Promise<void> {return store.putUsingCurrent(tx,value,(tx,scope,id)=>this.get(tx,scope,id));}
    async append(tx:Transaction,scope:string,id:string,value:ProbePlanDecision):Promise<void> {return store.appendUsingCurrent(tx,scope,id,value,(tx,scope,id)=>this.get(tx,scope,id));}
    async decisions(tx:Transaction,scope:string,id:string):Promise<ProbePlanDecision[]> {return store.decisions(tx,scope,id);}
    async history(tx:Transaction,scope:string,query:ProbePlanQuery):Promise<ProbePlanHead[]> {return store.history(tx,scope,query);}
    async due(tx:Transaction,now:number):Promise<ProbePlanHeader|null> {return store.due(tx,now);}
    async defer(tx:Transaction,header:ProbePlanHeader,cutoff:number,retryAt:number):Promise<void> {return store.defer(tx,header,cutoff,retryAt);}
    async isolate<T>(tx:Transaction,action:()=>Promise<T>):Promise<{accepted:true;value:T}|{accepted:false;error:ProbePlanFailure}> {return store.isolate(tx,action);}
    static async quarantineRecovery(tx:Transaction):Promise<void> {return MySqlProbePlanStore.quarantineRecovery(tx);}
}
