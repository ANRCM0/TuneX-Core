import type { StationAlertRecoveryStore } from '../framework/public.ts';
import { write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

export class MySqlStationAlertRecoveryStore implements StationAlertRecoveryStore<Transaction> {
    async quarantineRecovery(tx:Transaction,state:string):Promise<void> {
        await write(tx,"UPDATE station_alert_policies SET suspended='recovery',next_evaluate_at=0,state=?",[state]);
        await write(tx,'UPDATE station_alert_events SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE');
    }
}
