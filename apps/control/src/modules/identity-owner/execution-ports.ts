import type { Forward } from '@tunex/core';
import type { ForwardAuthorizationExecution } from '../forward-owner/public.ts';

export interface AccessExecution<Tx> extends ForwardAuthorizationExecution<Tx> {
    nodeIDs(tx: Tx, forward: Forward): Promise<string[]>;
    maximumAuthorization(tx: Tx, nodeId: string): Promise<number | null>;
    /** Always validate cleanup facts and scope; only grants may require capacity. */
    validateNode(tx: Tx, nodeId: string, scopeId: string, capacity: boolean): Promise<void>;
}
