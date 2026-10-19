import type { RecoveryEventStorage } from '../framework/public.ts';
import { write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

export class MySqlRecoveryEventStore implements RecoveryEventStorage<Transaction> {
    async record(tx:Transaction,id:string,at:number,details:string):Promise<void> {
        await write(tx,'INSERT INTO recovery_events(id,created_at,details) VALUES(?,?,?)',[id,at,details]);
    }
}
