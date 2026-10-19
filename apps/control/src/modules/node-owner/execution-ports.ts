import type { Forward } from '@tunex/core';
import type { AuthorizedNodeFacts } from '../../framework/public.ts';
import type { ForwardAuthorizationExecution } from '../forward-owner/public.ts';

export interface NodeManagementExecution<Tx> extends ForwardAuthorizationExecution<Tx> {
    nodeIDs(tx: Tx, forward: Forward): Promise<string[]>;
    maximumAuthorization(tx: Tx, nodeId: string): Promise<number | null>;
    denyIntent(tx: Tx, operationId: string): Promise<void>;
    assertNodeCapacity(tx: Tx, facts: AuthorizedNodeFacts): Promise<void>;
}
