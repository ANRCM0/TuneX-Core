import { MySqlNotificationEndpointStore } from './mysql-notification-endpoint-store.ts';
import { notificationEndpointStorageValues } from '../modules/notification-owner/public.ts';
import type { NotificationEndpoint, NotificationEndpointAudit, NotificationEndpointStore } from '../modules/notification-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlNotificationEndpointStore(notificationEndpointStorageValues);

/** Existing zero-argument/stateless compatibility methods; production composes providers explicitly. */
export class MySqlNotificationEndpoints implements NotificationEndpointStore<Transaction> {
    async lockScope(tx:Transaction,scope:string):Promise<void> {return store.lockScope(tx,scope);}
    async count(tx:Transaction,scope:string):Promise<number> {return store.count(tx,scope);}
    async list(tx:Transaction,scope:string):Promise<NotificationEndpoint[]> {return store.list(tx,scope);}
    async get(tx:Transaction,scope:string,id:string,lock=false):Promise<NotificationEndpoint|null> {return store.get(tx,scope,id,lock);}
    async put(tx:Transaction,scope:string,value:NotificationEndpoint):Promise<void> {return store.putUsingCount(tx,scope,value,(tx,scope)=>this.count(tx,scope));}
    async audit(tx:Transaction,scope:string,value:NotificationEndpointAudit):Promise<void> {return store.audit(tx,scope,value);}
    async audits(tx:Transaction,scope:string,id:string):Promise<NotificationEndpointAudit[]> {return store.audits(tx,scope,id);}
    async auditLosses(tx:Transaction,scope:string):Promise<number> {return store.auditLosses(tx,scope);}
}
