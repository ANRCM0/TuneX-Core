import type { NotificationRecoveryStore } from '../framework/public.ts';
import { write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

export class MySqlNotificationRecoveryStore implements NotificationRecoveryStore<Transaction> {
    async suspendEndpoints(tx:Transaction):Promise<void> {
        await write(tx,"UPDATE notification_endpoints SET suspended='recovery'");
    }

    async quarantineDeliveries(tx:Transaction,at:number):Promise<void> {
        await write(tx,'UPDATE notification_deliveries SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE');
        // Preserve terminal HTTP evidence; an interrupted claimed result is unknown.
        await write(tx,"UPDATE notification_deliveries SET last_status_code=IF(status='claimed',NULL,last_status_code),last_outcome=IF(status='claimed','unknown',last_outcome),status='cancelled',revision=revision+1,last_code='RECOVERY_SUSPENDED',next_attempt_at=0,claimed_at=NULL,claim_until=NULL,updated_at=GREATEST(updated_at,?) WHERE status IN ('queued','claimed','retry-wait')",[at]);
        await write(tx,"UPDATE notification_delivery_attempts SET finished_at=GREATEST(started_at,?),outcome='unknown',code='RECOVERY_SUSPENDED',status_code=NULL WHERE outcome='pending'",[at]);
    }
}
