import { MySqlStationAlertStorage } from './mysql-station-alert-storage.ts';
import { MySqlStationAlertFactStore } from './mysql-station-alert-fact-store.ts';
import { stationAlertStorageValues, stationAlertFactValues } from '../modules/station-alert-owner/public.ts';
import type { StationAlertConfig, StationAlertEvent, StationAlertFact, StationAlertFacts, StationAlertLosses,
    StationAlertPolicy, StationAlertPolicyAudit, StationAlertStore, StationEventQuery } from '../modules/station-alert-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlStationAlertStorage(stationAlertStorageValues),facts=new MySqlStationAlertFactStore(stationAlertFactValues);

/** Original zero-argument public methods and policyCount override over one SQL implementation. */
export class MySqlStationAlertStore implements StationAlertStore<Transaction> {
    async lockScope(tx:Transaction,scope:string):Promise<void> {return store.lockScope(tx,scope);}
    async losses(tx:Transaction,scope:string):Promise<StationAlertLosses> {return store.losses(tx,scope);}
    async policyCount(tx:Transaction,scope:string):Promise<number> {return store.policyCount(tx,scope);}
    async policies(tx:Transaction,scope:string):Promise<StationAlertPolicy[]> {return store.policies(tx,scope);}
    async policy(tx:Transaction,scope:string,id:string,lock=false):Promise<StationAlertPolicy|null> {return store.policy(tx,scope,id,lock);}
    async putPolicy(tx:Transaction,scope:string,value:StationAlertPolicy):Promise<void> {return store.putPolicyUsingCount(tx,scope,value,(tx,scope)=>this.policyCount(tx,scope));}
    async audit(tx:Transaction,scope:string,value:StationAlertPolicyAudit):Promise<void> {return store.audit(tx,scope,value);}
    async audits(tx:Transaction,scope:string,id:string):Promise<StationAlertPolicyAudit[]> {return store.audits(tx,scope,id);}
    async due(tx:Transaction,now:number):Promise<{scopeId:string;policyId:string;revision:number}|null> {return store.due(tx,now);}
    async defer(tx:Transaction,scope:string,id:string,expectedRevision:number,cutoff:number,retryAt:number):Promise<void> {return store.defer(tx,scope,id,expectedRevision,cutoff,retryAt);}
    async event(tx:Transaction,scope:string,id:string,lock=false):Promise<StationAlertEvent|null> {return store.event(tx,scope,id,lock);}
    async events(tx:Transaction,scope:string,query:StationEventQuery):Promise<StationAlertEvent[]> {return store.events(tx,scope,query);}
    async appendEvent(tx:Transaction,scope:string,value:StationAlertEvent,now:number):Promise<void> {return store.appendEvent(tx,scope,value,now);}
    async acknowledge(tx:Transaction,scope:string,id:string,expectedRevision:number,at:number):Promise<void> {return store.acknowledge(tx,scope,id,expectedRevision,at);}
}

/** Original passive fact reader, without another owner, authority or connection. */
export class MySqlStationAlertFacts implements StationAlertFacts<Transaction> {
    async read(tx:Transaction,scope:string,config:StationAlertConfig):Promise<StationAlertFact|null> {return facts.read(tx,scope,config);}
}
