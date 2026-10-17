import type { Forward } from '@tunex/core';
import type { RequestIdentity } from '../../application/ports.ts';
import type { AuthorizedNodeFacts } from '../node-management-ports.ts';

export interface ForwardAuthorizationExecution<Tx> {
    lock(tx: Tx, forward: Forward): Promise<void>;
    allowed(tx: Tx, actor: string, forward: Forward): Promise<boolean>;
    transition(tx: Tx, actor: string, forward: Forward): Promise<void>;
    accept(tx: Tx, forward: Forward, request: RequestIdentity, kind: 'policy' | 'revoke'): Promise<string>;
    assertCapacity(tx: Tx, forward: Forward): Promise<void>;
}

export interface AccessExecution<Tx> extends ForwardAuthorizationExecution<Tx> {
    nodeIDs(tx: Tx, forward: Forward): Promise<string[]>;
    maximumAuthorization(tx: Tx, nodeId: string): Promise<number | null>;
    /** Always validate cleanup facts and scope; only grants may require capacity. */
    validateNode(tx: Tx, nodeId: string, scopeId: string, capacity: boolean): Promise<void>;
}

export interface NodeManagementExecution<Tx> extends ForwardAuthorizationExecution<Tx> {
    nodeIDs(tx: Tx, forward: Forward): Promise<string[]>;
    maximumAuthorization(tx: Tx, nodeId: string): Promise<number | null>;
    denyIntent(tx: Tx, operationId: string): Promise<void>;
    assertNodeCapacity(tx: Tx, facts: AuthorizedNodeFacts): Promise<void>;
}
