import type { ForwardValue as Forward, ForwardIntentStore, StoredValues } from '../../framework/public.ts';
import type { RuntimeLedgerForwards } from '../../framework/public.ts';

export interface ForwardRuntimeReader<Tx> extends RuntimeLedgerForwards<Tx> {}

export interface ProfileForwardReferences<Tx> {
    hasLiveRelay(tx: Tx, profileId: string): Promise<boolean>;
    forProfileActor(tx: Tx, profileId: string, actor: string): Promise<Forward[]>;
}

/** Read/lock original Relay references by explicit Profile or Node selection. */
export interface RelayForwardReferences<Tx> {
    hasLiveRelay(tx:Tx,profileId?:string,nodeId?:string):Promise<boolean>;
}

export interface ActorForwardReferences<Tx> {
    forActor(tx: Tx, scopeId: string, actorId: string): Promise<Forward[]>;
    record(tx: Tx, scopeId: string, id: string): Promise<Forward & { ownerActorId: string | null; deleting: boolean; recoverySuspended: boolean }>;
    authorizer(tx: Tx, forwardId: string): Promise<string | null>;
}

export interface NodeForwardReferences<Tx> {
    forReferencedNode(tx: Tx, nodeId: string): Promise<Forward[]>;
    authorizer(tx: Tx, forwardId: string): Promise<string | null>;
}

export interface ForwardWriter<Tx> {
    record(tx: Tx, scopeId: string, id: string): Promise<Forward & { ownerActorId: string | null; deleting: boolean; recoverySuspended: boolean }>;
    /** Includes deleting/suspended inventory; caller does not acquire execution authority. */
    ownershipForUpdate(tx: Tx, scopeId: string, id: string): Promise<Forward>;
    currentForUpdate(tx: Tx, scopeId: string, id: string): Promise<Forward>;
    insert(tx: Tx, forward: Forward, actorId: string): Promise<void>;
    classifyOwner(tx: Tx, scopeId: string, id: string, expectedRevision: number, actorId: string,
        ownerActorId: string, eventId: string, at: number): Promise<void>;
    replace(tx: Tx, current: Forward, next: Forward): Promise<void>;
    setAuthorizer(tx: Tx, forwardId: string, actorId: string): Promise<void>;
    markDeleting(tx: Tx, current: Forward, nextRevision: number): Promise<void>;
}


export interface ForwardReadPort<Tx> {
    get(tx:Tx,scope:string,id:string):Promise<Forward&{ownerActorId:string|null}>;
    record(tx:Tx,scope:string,id:string):Promise<Forward&{ownerActorId:string|null;deleting:boolean;recoverySuspended:boolean}>;
    revisions(tx:Tx,forwardId:string):Promise<{revision:number;spec:unknown}[]>;
}

export interface ForwardStateOwner<Tx> extends ForwardReadPort<Tx>, ForwardWriter<Tx>, ActorForwardReferences<Tx>,
    NodeForwardReferences<Tx>, ForwardRuntimeReader<Tx>, RelayForwardReferences<Tx>, Pick<ProfileForwardReferences<Tx>,'forProfileActor'> {
    record:ForwardReadPort<Tx>['record'];
    quarantineRecovery(tx:Tx):Promise<void>;
}
export interface ForwardStateOptions<Tx> { readonly store:ForwardIntentStore<Tx>;readonly values:StoredValues }
