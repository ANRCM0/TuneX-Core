import { MySqlIngressDeploymentStore } from './mysql-ingress-deployment-store.ts';
import type { ReadPageWindow } from '../framework/public.ts';
import { ingressDeploymentStorageValues } from '../modules/ingress-owner/public.ts';
import type { IngressPlan, IngressAttempt, IngressDeploymentHead, IngressDeploymentRecord, IngressDeploymentStore } from '../modules/ingress-owner/public.ts';
import type { PathPublicationFailure, PublicationOperation } from '../modules/path-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlIngressDeploymentStore<IngressPlan,IngressAttempt['outcome'],PathPublicationFailure>(ingressDeploymentStorageValues);

/** Legacy zero-argument entry; preserve original count/event dispatch without copied SQL. */
export class MySqlIngressDeployments implements IngressDeploymentStore<Transaction> {
    async lockScope(tx:Transaction,scope:string):Promise<void> {return store.lockScope(tx,scope);}
    async count(tx:Transaction,scope:string):Promise<number> {return store.count(tx,scope);}
    async list(tx:Transaction,scope:string,paging:ReadPageWindow,groupId?:string) {return store.list(tx,scope,paging,groupId);}
    async read(tx:Transaction,scope:string,id:string,lock=false):Promise<IngressDeploymentRecord|null> {return store.read(tx,scope,id,lock);}
    async create(tx:Transaction,scope:string,record:IngressDeploymentHead,plan:IngressPlan):Promise<void> {
        return store.create(tx,scope,record,plan,{count:(tx,scope)=>this.count(tx,scope),
            event:(tx,scope,id,revision,kind,actor,at)=>this.event(tx,scope,id,revision,kind,actor,at)});
    }
    async append(tx:Transaction,scope:string,id:string,expectedRevision:number,record:IngressAttempt):Promise<void> {
        return store.append(tx,scope,id,expectedRevision,record,{event:(tx,scope,id,revision,kind,actor,at)=>this.event(tx,scope,id,revision,kind,actor,at)});
    }
    async cancel(tx:Transaction,scope:string,id:string,expectedRevision:number,actor:string,at:number):Promise<void> {
        return store.cancel(tx,scope,id,expectedRevision,actor,at,{event:(tx,scope,id,revision,kind,actor,at)=>this.event(tx,scope,id,revision,kind,actor,at)});
    }
    private async event(tx:Transaction,scope:string,id:string,revision:number,kind:'create'|'compensate'|'cancel',actor:string,at:number):Promise<void> {return store.event(tx,scope,id,revision,kind,actor,at);}
    async isolate<T>(tx:Transaction,action:()=>Promise<T>):Promise<{accepted:true;value:T}|{accepted:false;error:PathPublicationFailure}> {return store.isolate(tx,action);}
    async operations(tx:Transaction,scope:string,ids:string[]):Promise<PublicationOperation[]> {return store.operations(tx,scope,ids);}
}
