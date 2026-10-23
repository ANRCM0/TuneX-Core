import { NodeService, NodePortLimitPolicy } from './node-owner/public.ts';
import { nativeNodeCodec } from '../compatibility/public.ts';
import { nativeNodeSecrets } from '../infrastructure/identity-secrets.ts';
import { MySqlNodeAuthorityStore, MySqlNodeMachineLookup } from '../infrastructure/mysql-node-authority.ts';
import { createMySqlRuntimeResources, MySqlRuntimeResourceStore } from '../infrastructure/mysql-runtime-resources.ts';
import type { MySqlUnitOfWork, Transaction } from '../infrastructure/mysql.ts';
import type { NodeCertificateAuthority } from '../infrastructure/pki.ts';
import type { RuntimeNodeResources, NodeScopeAuthority } from '../framework/public.ts';
import type { ForwardNodeAuthorization, RelayNodeAuthority } from './node-owner/public.ts';
export { validatePolicy } from './node-owner/public.ts';
export type { NodePolicy, NodeRecord } from './node-owner/public.ts';

/** Preserve the legacy construction API while the Node owner consumes public providers. */
export class Nodes extends NodeService<Transaction> implements ForwardNodeAuthorization<Transaction>, RelayNodeAuthority<Transaction> {
    constructor(db:MySqlUnitOfWork,identity:NodeScopeAuthority<Transaction>,ca:NodeCertificateAuthority,overlapSeconds=120,relayCredentialSeconds=86400,
        resources?:RuntimeNodeResources<Transaction>,portLimits?:NodePortLimitPolicy<Transaction>) {
        const store=new MySqlNodeAuthorityStore();
        const limits=portLimits??new NodePortLimitPolicy(store,new MySqlRuntimeResourceStore());
        super({db,identity,signer:ca,overlapSeconds,relayCredentialSeconds,resources:resources??createMySqlRuntimeResources(limits),portLimits:limits,
            store,machine:new MySqlNodeMachineLookup(db),
            secrets:nativeNodeSecrets,codec:nativeNodeCodec,now:Date.now});
    }
    static async quarantineRecovery(tx:Transaction):Promise<void> {
        await new MySqlNodeAuthorityStore().quarantine(tx);
    }
}
