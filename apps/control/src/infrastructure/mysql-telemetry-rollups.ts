import { MySqlTelemetryRollupStorage } from './mysql-telemetry-rollup-storage.ts';
import { telemetryRollupStorageValues } from '../modules/telemetry-owner/public.ts';
import type { TelemetryFamily, TelemetryObservation, TelemetryRollupCounts, TelemetryRollupLosses,
    TelemetryRollupRecord, TelemetryRollupStore, TelemetryRollupWindow } from '../modules/telemetry-owner/public.ts';
import type { Transaction } from './mysql.ts';

const store=new MySqlTelemetryRollupStorage(telemetryRollupStorageValues);

/** Original stateless zero-argument public prototype over one lower SQL implementation. */
export class MySqlTelemetryRollups implements TelemetryRollupStore<Transaction> {
    async append(tx:Transaction,values:readonly TelemetryObservation[]):Promise<void> {return store.append(tx,values);}
    async history(tx:Transaction,window:TelemetryRollupWindow):Promise<TelemetryRollupRecord[]> {return store.history(tx,window);}
    async losses(tx:Transaction,scopeId:string,family:TelemetryFamily,nodeId:string|null):Promise<TelemetryRollupLosses> {return store.losses(tx,scopeId,family,nodeId);}
    async capacity(tx:Transaction,scopeId:string):Promise<TelemetryRollupCounts> {return store.capacity(tx,scopeId);}
    async prune(tx:Transaction,now:number):Promise<number> {return store.prune(tx,now);}
}
