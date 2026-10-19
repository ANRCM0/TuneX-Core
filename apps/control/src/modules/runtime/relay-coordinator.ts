import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import type { Policy } from '@tunex/contracts/policy';
import { RuntimeRelayHost } from '../../framework/public.ts';
import { MySqlRelayDeploymentStore, MySqlRelayObservations } from '../../infrastructure/mysql-runtime-relay.ts';
import type { Transaction } from '../../infrastructure/mysql.ts';
import type { RelayNodeAuthority } from '../node-owner/public.ts';
import type { ForwardRuntimeReader } from '../forward-owner/public.ts';
import type { TransportProfileResolver } from '../transport-owner/public.ts';
import type { RelayEndpointResolver } from '../relay-endpoint-owner/public.ts';
import type { RelayExecutionLedger } from './relay-ledger-ports.ts';
import { nativeRelayCompiler } from '../../compatibility/public.ts';
import type { NativeRuntimeFamily } from '../../compatibility/public.ts';

/** Legacy provider assembly; the same Relay host joins the existing ledger transaction. */
export class RelayCoordinator extends RuntimeRelayHost<Transaction,NativeRuntimeFamily> {
    constructor(nodes:RelayNodeAuthority<Transaction>,forwarding:ForwardRuntimeReader<Transaction>,
        transport:TransportProfileResolver<Transaction>,endpoints:RelayEndpointResolver<Transaction>,
        ledger:RelayExecutionLedger<Transaction>,policy:Policy={...DEFAULT_POLICY},multihopEnabled=false) {
        super({nodes,forwards:forwarding,transport,endpoints,ledger,policy,multihopEnabled,
            store:new MySqlRelayDeploymentStore(),observations:new MySqlRelayObservations(),now:Date.now,
            compiler:nativeRelayCompiler,
        });
    }
    static async quarantineRecovery(tx:Transaction):Promise<void> {
        await new MySqlRelayDeploymentStore().quarantine(tx,Date.now());
    }
}
