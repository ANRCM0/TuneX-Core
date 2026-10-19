import { MySqlPathPublicationStore } from './mysql-publication-store.ts';
import type { ReadPageWindow } from '../framework/public.ts';
import { pathPublicationStorageValues } from '../modules/path-owner/public.ts';
import type { PathPublicationPlan, PathPublicationAttempt, PathPublicationFailure, PathPublicationHead, PathPublicationRecord,
    PathPublicationStore, PublicationOperation } from '../modules/path-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlPathPublicationStore<PathPublicationPlan,PathPublicationAttempt['outcome'],PathPublicationFailure>(pathPublicationStorageValues);

/** Legacy zero-argument entry; dynamic count/event calls keep their original owner. */
export class MySqlPathPublications implements PathPublicationStore<Transaction> {
    async lockScope(tx:Transaction,scope:string):Promise<void> {return store.lockScope(tx,scope);}
    async count(tx:Transaction,scope:string):Promise<number> {return store.count(tx,scope);}
    async list(tx:Transaction,scope:string,paging:ReadPageWindow) {
        return store.list(tx,scope,paging,{count:(tx,scope)=>this.count(tx,scope)});
    }
    async read(tx:Transaction,scope:string,id:string,lock=false):Promise<PathPublicationRecord|null> {return store.read(tx,scope,id,lock);}
    async create(tx:Transaction,scope:string,record:PathPublicationHead,plan:PathPublicationPlan):Promise<void> {
        return store.create(tx,scope,record,plan,{count:(tx,scope)=>this.count(tx,scope),
            event:(tx,scope,id,revision,kind,actor,at)=>this.event(tx,scope,id,revision,kind,actor,at)});
    }
    async append(tx:Transaction,scope:string,id:string,expectedRevision:number,record:PathPublicationAttempt):Promise<void> {
        return store.append(tx,scope,id,expectedRevision,record,{event:(tx,scope,id,revision,kind,actor,at)=>this.event(tx,scope,id,revision,kind,actor,at)});
    }
    async cancel(tx:Transaction,scope:string,id:string,expectedRevision:number,actor:string,at:number):Promise<void> {
        return store.cancel(tx,scope,id,expectedRevision,actor,at,{event:(tx,scope,id,revision,kind,actor,at)=>this.event(tx,scope,id,revision,kind,actor,at)});
    }
    private async event(tx:Transaction,scope:string,id:string,revision:number,kind:'create'|'apply'|'compensate'|'cancel',actor:string,at:number):Promise<void> {
        return store.event(tx,scope,id,revision,kind,actor,at);
    }
    async isolate<T>(tx:Transaction,action:()=>Promise<T>):Promise<{accepted:true;value:T}|{accepted:false;error:PathPublicationFailure}> {return store.isolate(tx,action);}
    async operations(tx:Transaction,scope:string,ids:string[]):Promise<PublicationOperation[]> {return store.operations(tx,scope,ids);}
}
