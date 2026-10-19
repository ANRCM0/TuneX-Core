import type { Forward } from '@tunex/core';
import type { AuthorizedNodeFacts, RuntimeRelayNodes } from '../../framework/public.ts';

export interface ForwardNodeAuthorization<Tx> {
    authorized(tx: Tx, actor: string, forward: Forward): Promise<AuthorizedNodeFacts>;
    authorizedRelayNode(tx: Tx, actor: string, scopeId: string, nodeId: string): Promise<AuthorizedNodeFacts>;
    state(tx: Tx, nodeId: string): Promise<{ revoked: boolean }>;
}

export interface RelayNodeAuthority<Tx> extends RuntimeRelayNodes<Tx> {}
