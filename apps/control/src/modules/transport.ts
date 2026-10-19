import { randomUUID } from 'node:crypto';
import { TransportService } from './transport-owner/public.ts';
import type { TransportOptions } from './transport-owner/public.ts';
import { MySqlTransportProfileStore } from '../infrastructure/mysql-relay-configuration.ts';
import { nativeRelayConfigurationCodec } from '../compatibility/public.ts';
import type { MySqlUnitOfWork, Transaction } from '../infrastructure/mysql.ts';

/** Existing constructor/static recovery bind providers for the same Transport owner. */
export class Transport extends TransportService<Transaction> {
    constructor(db:MySqlUnitOfWork,identity:TransportOptions<Transaction>['identity'],
        idempotency:TransportOptions<Transaction>['idempotency'],forwarding:TransportOptions<Transaction>['forwarding']) {
        super({db,identity,idempotency,forwarding,store:new MySqlTransportProfileStore(),codec:nativeRelayConfigurationCodec,
            now:()=>Date.now(),newID:randomUUID});
    }
    static async quarantineRecovery(tx:Transaction):Promise<void>{await new MySqlTransportProfileStore().quarantine(tx);}
}
