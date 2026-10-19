import type { IngressMigrationRecoveryStore } from '../framework/public.ts';
import { write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

export class MySqlIngressMigrationRecoveryStore implements IngressMigrationRecoveryStore<Transaction> {
    async quarantineRecovery(tx:Transaction,at:number):Promise<void> {
        await write(tx,"INSERT INTO ingress_migration_events(scope_id,batch_id,revision,kind,actor_id,created_at) SELECT scope_id,batch_id,revision+1,'recovery',created_by,? FROM ingress_migrations WHERE recovery_invalidated=FALSE",[at]);
        await write(tx,'UPDATE ingress_migrations SET recovery_invalidated=TRUE,revision=revision+1 WHERE recovery_invalidated=FALSE');
    }
}
