import { MySqlPathGroupStore, MySqlPathGroupBindingStore } from './mysql-path-group-store.ts';
import type { ReadPageWindow, ReadPrincipal } from '../framework/public.ts';
import type { PathGroupConfig, PathGroupHead, PathGroupRevision, PathGroupWriter, PathGroupBindingRecord, PathGroupBindingWriter } from '../modules/path-owner/public.ts';
import type { Transaction } from './mysql.ts';

const groups=new MySqlPathGroupStore<PathGroupConfig>();
const bindings=new MySqlPathGroupBindingStore();

/** Legacy zero-argument entry; preserve dynamic count overrides during publish. */
export class MySqlPathGroups implements PathGroupWriter<Transaction> {
    async lockScope(tx:Transaction,scope:string):Promise<void> {return groups.lockScope(tx,scope);}
    async count(tx:Transaction,scope:string):Promise<number> {return groups.count(tx,scope);}
    async head(tx:Transaction,scope:string,id:string,lock=false):Promise<PathGroupHead|null> {return groups.head(tx,scope,id,lock);}
    async revision(tx:Transaction,scope:string,id:string,number:number):Promise<PathGroupRevision|null> {return groups.revision(tx,scope,id,number);}
    async list(tx:Transaction,scope:string,principal:ReadPrincipal,paging:ReadPageWindow,prefix:string) {return groups.list(tx,scope,principal,paging,prefix);}
    async publish(tx:Transaction,scope:string,id:string,record:PathGroupRevision):Promise<void> {
        return groups.publish(tx,scope,id,record,(tx,scope)=>this.count(tx,scope));
    }
    async archive(tx:Transaction,scope:string,id:string):Promise<void> {return groups.archive(tx,scope,id);}
    async classifyOwner(tx:Transaction,scope:string,id:string,expectedRevision:number,ownerActorId:string):Promise<number> {return groups.classifyOwner(tx,scope,id,expectedRevision,ownerActorId);}
    async auditOwnership(tx:Transaction,scope:string,id:string,actor:string,ownerActorId:string,revision:number,at:number):Promise<void> {return groups.auditOwnership(tx,scope,id,actor,ownerActorId,revision,at);}
    async audit(tx:Transaction,scope:string,id:string,actor:string,revision:number,kind:'publish'|'archive',at:number):Promise<void> {return groups.audit(tx,scope,id,actor,revision,kind,at);}
}

/** Legacy zero-argument entry over the one original group-provenance SQL owner. */
export class MySqlPathGroupBindings implements PathGroupBindingWriter<Transaction> {
    async current(tx:Transaction,scope:string,forwardId:string):Promise<PathGroupBindingRecord|null> {return bindings.current(tx,scope,forwardId);}
    async history(tx:Transaction,scope:string,forwardId:string):Promise<PathGroupBindingRecord[]> {return bindings.history(tx,scope,forwardId);}
    async references(tx:Transaction,scope:string,principal:ReadPrincipal,id:string,paging:ReadPageWindow,revision?:number) {return bindings.references(tx,scope,principal,id,paging,revision);}
    async append(tx:Transaction,scope:string,forwardId:string,record:Omit<PathGroupBindingRecord,'sequence'>):Promise<PathGroupBindingRecord> {return bindings.append(tx,scope,forwardId,record);}
    async detach(tx:Transaction,scope:string,forwardId:string):Promise<void> {return bindings.detach(tx,scope,forwardId);}
}
