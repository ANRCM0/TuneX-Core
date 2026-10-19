import type { Forward } from '@tunex/core';
import type { RequestIdentity } from '../../framework/public.ts';

export type ForwardOperationKind = 'create' | 'update' | 'enable' | 'disable' | 'delete' | 'retry';

export interface RetrySource {
    id: string;
    target_revision: number;
    status: 'accepted' | 'running' | 'succeeded' | 'failed' | 'superseded';
    recovery_invalidated: number;
    previous_spec: unknown;
}

export interface ForwardOperationCommands<Tx> {
    read(tx: Tx, scopeId: string, operationId: string): Promise<{ forward_id: string }>;
    get(tx: Tx, scopeId: string, operationId: string): Promise<RetrySource>;
    accept(tx: Tx, forward: Forward, request: RequestIdentity, kind: ForwardOperationKind,
        previousSpec?: unknown, sourceOperationId?: string | null): Promise<string>;
}

export interface ForwardCommandPreparation<Tx> {
    prepareCreate(tx: Tx, actor: string, forward: Forward): Promise<void>;
    planCreate(tx: Tx, actor: string, forward: Forward): Promise<void>;
    prepareUpdate(tx: Tx, actor: string, current: Forward, next: Forward, recoverySuspended: boolean): Promise<void>;
    planUpdate(tx: Tx, actor: string, forward: Forward): Promise<void>;
    lock(tx: Tx, forward: Forward): Promise<void>;
    lockRemoval(tx: Tx, forward: Forward): Promise<void>;
    prepareRetry(tx: Tx, actor: string, forward: Forward): Promise<void>;
    assertCapacity(tx: Tx, forward: Forward): Promise<void>;
}
