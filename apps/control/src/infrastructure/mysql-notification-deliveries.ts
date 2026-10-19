import { MySqlNotificationOutboxStore } from './mysql-notification-outbox-store.ts';
import { notificationOutboxStorageValues } from '../modules/notification-owner/public.ts';
import type { NotificationDelivery, NotificationDeliveryAttempt, NotificationDeliveryHeader, NotificationDeliveryLoss,
    NotificationDeliveryLosses, NotificationDeliveryQuery, NotificationDeliveryStore } from '../modules/notification-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlNotificationOutboxStore(notificationOutboxStorageValues);

/** Old constructor and public methods bind one lower implementation, not copied SQL or authority. */
export class MySqlNotificationDeliveries implements NotificationDeliveryStore<Transaction> {
    async lockScope(tx:Transaction,scope:string):Promise<void> {return store.lockScope(tx,scope);}
    async losses(tx:Transaction,scope:string):Promise<NotificationDeliveryLosses> {return store.losses(tx,scope);}
    async loss(tx:Transaction,scope:string,kind:NotificationDeliveryLoss,count:number):Promise<void> {return store.loss(tx,scope,kind,count);}
    async insert(tx:Transaction,scope:string,value:NotificationDelivery,now:number):Promise<'inserted'|'duplicate'|'full'> {return store.insert(tx,scope,value,now);}
    async due(tx:Transaction,now:number):Promise<NotificationDeliveryHeader|null> {return store.due(tx,now);}
    async defer(tx:Transaction,header:NotificationDeliveryHeader,cutoff:number,retryAt:number):Promise<void> {return store.defer(tx,header,cutoff,retryAt);}
    async get(tx:Transaction,scope:string,id:string,lock:boolean|'share'=false):Promise<NotificationDelivery|null> {return store.get(tx,scope,id,lock);}
    async put(tx:Transaction,scope:string,value:NotificationDelivery):Promise<void> {return store.putUsingCurrent(tx,scope,value,(tx,scope,id)=>this.get(tx,scope,id));}
    async activeCount(tx:Transaction,scope:string,now:number):Promise<number> {return store.activeCount(tx,scope,now);}
    async reserveRate(tx:Transaction,scope:string,endpointId:string,now:number,intervalMs:number):Promise<number> {return store.reserveRate(tx,scope,endpointId,now,intervalMs);}
    async appendAttempt(tx:Transaction,scope:string,value:NotificationDeliveryAttempt):Promise<void> {return store.appendAttempt(tx,scope,value);}
    async finishAttempt(tx:Transaction,scope:string,deliveryId:string,value:NotificationDeliveryAttempt):Promise<void> {return store.finishAttempt(tx,scope,deliveryId,value);}
    async attempts(tx:Transaction,scope:string,id:string):Promise<NotificationDeliveryAttempt[]> {return store.attempts(tx,scope,id);}
    async history(tx:Transaction,scope:string,query:NotificationDeliveryQuery):Promise<NotificationDelivery[]> {return store.history(tx,scope,query);}
}
