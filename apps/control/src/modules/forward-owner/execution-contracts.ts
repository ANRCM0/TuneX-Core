import type { Forward } from '@tunex/core';
import type { RequestIdentity, ReservedSlot } from '../../framework/public.ts';
import type { NativeDriverDescriptor } from '../../compatibility/public.ts';

export interface ForwardAuthorizationExecution<Tx> {
    lock(tx: Tx, forward: Forward): Promise<void>;
    allowed(tx: Tx, actor: string, forward: Forward): Promise<boolean>;
    transition(tx: Tx, actor: string, forward: Forward): Promise<void>;
    accept(tx: Tx, forward: Forward, request: RequestIdentity, kind: 'policy' | 'revoke'): Promise<string>;
    assertCapacity(tx: Tx, forward: Forward): Promise<void>;
}

export interface ForwardResourceHost<Tx> {
    lockNode(tx: Tx, nodeId: string): Promise<void>;
    reserve(tx: Tx, forward: Forward): Promise<ReservedSlot[]>;
    transition(tx: Tx, current: Forward, next: Forward): Promise<ReservedSlot[]>;
}

export interface ForwardRelayHost<Tx> {
    lockNodes(tx: Tx, forward: Forward): Promise<void>;
    canExecute(tx: Tx, actor: string, forward: Forward): Promise<boolean>;
    acceptPlan(tx: Tx, actor: string, forward: Forward): Promise<void>;
}

export const EXECUTION_HOST_VERSION=1 as const;
export type NativeDriverId=NativeDriverDescriptor['id'];

/** Trusted adapters join the caller's transaction; none owns a second Runtime ledger. */
export interface ForwardExecutionAdapter<Tx> {
    readonly id:NativeDriverId;
    readonly hostInterfaceVersion:typeof EXECUTION_HOST_VERSION;
    prepareCreate(tx:Tx,actor:string,forward:Forward):Promise<void>;
    planCreate(tx:Tx,actor:string,forward:Forward):Promise<void>;
    prepareUpdate(tx:Tx,actor:string,current:Forward,next:Forward):Promise<void>;
    planUpdate(tx:Tx,actor:string,forward:Forward):Promise<void>;
    lockRemoval(tx:Tx,forward:Forward):Promise<void>;
    authorizeRetry(tx:Tx,actor:string,forward:Forward):Promise<void>;
}
