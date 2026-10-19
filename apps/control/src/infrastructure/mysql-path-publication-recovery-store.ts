import type { PathPublicationRecoveryStore } from '../framework/public.ts';
import { write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

export class MySqlPathPublicationRecoveryStore implements PathPublicationRecoveryStore<Transaction> {
    async quarantineRecovery(tx:Transaction,at:number):Promise<void> {
        await write(tx,"INSERT INTO path_publication_events(scope_id,batch_id,revision,kind,actor_id,created_at) SELECT scope_id,batch_id,revision+1,'recovery',created_by,? FROM path_publications WHERE recovery_invalidated=FALSE",[at]);
        await write(tx,'UPDATE path_publications SET recovery_invalidated=TRUE,revision=revision+1 WHERE recovery_invalidated=FALSE');
    }
}
