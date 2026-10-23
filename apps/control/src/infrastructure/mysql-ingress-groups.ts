import { MySqlIngressGroupStore } from './mysql-ingress-group-store.ts';
import type { ReadPageWindow, ReadPrincipal } from '../framework/public.ts';
import type { IngressGroupConfig, IngressGroupHead, IngressGroupRevision, IngressGroupStore } from '../modules/ingress-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlIngressGroupStore<IngressGroupConfig>();

/** Legacy zero-argument entry; retain original prototype methods and count overrides. */
export class MySqlIngressGroups implements IngressGroupStore<Transaction> {
    async lockScope(tx:Transaction,scope:string):Promise<void> {return store.lockScope(tx,scope);}
    async count(tx:Transaction,scope:string):Promise<number> {return store.count(tx,scope);}
    async head(tx:Transaction,scope:string,id:string,lock=false):Promise<IngressGroupHead|null> {return store.head(tx,scope,id,lock);}
    async revision(tx:Transaction,scope:string,id:string,number:number):Promise<IngressGroupRevision|null> {return store.revision(tx,scope,id,number);}
    async list(tx:Transaction,scope:string,principal:ReadPrincipal,paging:ReadPageWindow,prefix:string) {return store.list(tx,scope,principal,paging,prefix);}
    async publish(tx:Transaction,scope:string,id:string,record:IngressGroupRevision):Promise<void> {
        return store.publish(tx,scope,id,record,(tx,scope)=>this.count(tx,scope));
    }
    async classifyOwner(tx:Transaction,scope:string,id:string,expectedRevision:number,ownerActorId:string):Promise<void> {return store.classifyOwner(tx,scope,id,expectedRevision,ownerActorId);}
    async archive(tx:Transaction,scope:string,id:string):Promise<void> {return store.archive(tx,scope,id);}
    async audit(tx:Transaction,scope:string,id:string,actor:string,revision:number,kind:'publish'|'archive'|'classify-owner',at:number,ownerActorId?:string):Promise<void> {return store.audit(tx,scope,id,actor,revision,kind,at,ownerActorId);}
}
