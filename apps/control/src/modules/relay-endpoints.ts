import { RelayEndpointService } from './relay-endpoint-owner/public.ts';
import type { RelayEndpointOptions } from './relay-endpoint-owner/public.ts';
import { MySqlRelayEndpointStore } from '../infrastructure/mysql-relay-configuration.ts';
import { nativeRelayConfigurationCodec } from '../compatibility/public.ts';
import type { MySqlUnitOfWork, Transaction } from '../infrastructure/mysql.ts';
export { parseRelayEndpoint } from './relay-endpoint-contract.ts';
export type { RelayEndpoint, ResolvedEndpoint } from './relay-endpoint-contract.ts';

/** Preserve old construction while the endpoint owner consumes public provider contracts. */
export class RelayEndpoints extends RelayEndpointService<Transaction> {
    constructor(db:MySqlUnitOfWork,identity:RelayEndpointOptions<Transaction>['identity'],nodes:RelayEndpointOptions<Transaction>['nodes'],
        idempotency:RelayEndpointOptions<Transaction>['idempotency'],forwarding:RelayEndpointOptions<Transaction>['forwarding']) {
        super({db,identity,nodes,idempotency,forwarding,store:new MySqlRelayEndpointStore(),codec:nativeRelayConfigurationCodec,now:()=>Date.now()});
    }
}
