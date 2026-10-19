import { MySqlPathBindingStore } from './mysql-path-binding-store.ts';
import type { ReadPageWindow } from '../framework/public.ts';
import type { PathBindingRecord, PathBindingWriter } from '../modules/path-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlPathBindingStore();

/** Legacy zero-argument entry; retains original public prototype/subclass methods. */
export class MySqlPathBindings implements PathBindingWriter<Transaction> {
    async at(tx:Transaction,scope:string,forwardId:string,sequence:number):Promise<PathBindingRecord|null> {return store.at(tx,scope,forwardId,sequence);}
    async current(tx:Transaction,scope:string,forwardId:string):Promise<PathBindingRecord|null> {return store.current(tx,scope,forwardId);}
    async history(tx:Transaction,scope:string,forwardId:string):Promise<PathBindingRecord[]> {return store.history(tx,scope,forwardId);}
    async references(tx:Transaction,scope:string,templateId:string,paging:ReadPageWindow,revision?:number) {return store.references(tx,scope,templateId,paging,revision);}
    async append(tx:Transaction,scope:string,forwardId:string,record:Omit<PathBindingRecord,'sequence'>):Promise<PathBindingRecord> {return store.append(tx,scope,forwardId,record);}
    async detach(tx:Transaction,scope:string,forwardId:string):Promise<void> {return store.detach(tx,scope,forwardId);}
}
