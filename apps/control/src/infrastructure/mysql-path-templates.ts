import { MySqlPathTemplateStore } from './mysql-path-template-store.ts';
import type { ReadPageWindow, ReadPrincipal } from '../framework/public.ts';
import type { PathTemplateConfig, PathTemplateHead, PathTemplateRevision, PathTemplateWriter } from '../modules/path-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlPathTemplateStore<PathTemplateConfig>();

/** Legacy zero-argument entry; all SQL lives in the lower store. */
export class MySqlPathTemplates implements PathTemplateWriter<Transaction> {
    async lockScope(tx:Transaction,scope:string):Promise<void> {return store.lockScope(tx,scope);}
    async count(tx:Transaction,scope:string):Promise<number> {return store.count(tx,scope);}
    async head(tx:Transaction,scope:string,id:string,lock=false):Promise<PathTemplateHead|null> {return store.head(tx,scope,id,lock);}
    async revision(tx:Transaction,scope:string,id:string,number:number):Promise<PathTemplateRevision|null> {return store.revision(tx,scope,id,number);}
    async list(tx:Transaction,scope:string,principal:ReadPrincipal,paging:ReadPageWindow,prefix:string) {return store.list(tx,scope,principal,paging,prefix);}
    async publish(tx:Transaction,scope:string,id:string,record:PathTemplateRevision):Promise<void> {return store.publish(tx,scope,id,record);}
    async archive(tx:Transaction,scope:string,id:string):Promise<void> {return store.archive(tx,scope,id);}
    async classifyOwner(tx:Transaction,scope:string,id:string,expectedRevision:number,ownerActorId:string):Promise<number> {return store.classifyOwner(tx,scope,id,expectedRevision,ownerActorId);}
    async auditOwnership(tx:Transaction,scope:string,id:string,actor:string,ownerActorId:string,revision:number,at:number):Promise<void> {return store.auditOwnership(tx,scope,id,actor,ownerActorId,revision,at);}
    async audit(tx:Transaction,scope:string,id:string,actor:string,revision:number,kind:'publish'|'archive',at:number):Promise<void> {return store.audit(tx,scope,id,actor,revision,kind,at);}
}
