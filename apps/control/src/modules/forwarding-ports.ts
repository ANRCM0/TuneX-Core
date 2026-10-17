import type { Forward } from '@tunex/core';

export interface ProfileForwardReferences<Tx> {
    hasLiveRelay(tx: Tx, profileId: string): Promise<boolean>;
    forProfileActor(tx: Tx, profileId: string, actor: string): Promise<Forward[]>;
}

export interface ActorForwardReferences<Tx> {
    forActor(tx: Tx, scopeId: string, actorId: string): Promise<Forward[]>;
    record(tx: Tx, scopeId: string, id: string): Promise<Forward & { deleting: boolean; recoverySuspended: boolean }>;
    authorizer(tx: Tx, forwardId: string): Promise<string | null>;
}

export interface NodeForwardReferences<Tx> {
    forReferencedNode(tx: Tx, nodeId: string): Promise<Forward[]>;
    authorizer(tx: Tx, forwardId: string): Promise<string | null>;
}

export interface ForwardWriter<Tx> {
    record(tx: Tx, scopeId: string, id: string): Promise<Forward & { deleting: boolean; recoverySuspended: boolean }>;
    currentForUpdate(tx: Tx, scopeId: string, id: string): Promise<Forward>;
    insert(tx: Tx, forward: Forward, actorId: string): Promise<void>;
    replace(tx: Tx, current: Forward, next: Forward): Promise<void>;
    setAuthorizer(tx: Tx, forwardId: string, actorId: string): Promise<void>;
    markDeleting(tx: Tx, current: Forward, nextRevision: number): Promise<void>;
}
