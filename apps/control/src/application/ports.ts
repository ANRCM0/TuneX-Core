export interface TransactionBoundary<Tx> {
    transaction<T>(action: (tx: Tx) => Promise<T>): Promise<T>;
}

export interface ScopeAuthorization<Tx> {
    scope(tx: Tx, actorId: string, scopeId: string, manage?: boolean): Promise<void>;
}

export interface ScopeOwnerAuthorization<Tx> {
    owner(tx: Tx, actorId: string, scopeId: string): Promise<void>;
}

export interface RequestIdentity {
    scopeId: string;
    actorId: string;
    key: string;
    digest: string;
}

export interface CommandResponse {
    status: 200 | 202;
    body: unknown;
}

export interface IdempotentRequests<Tx> {
    claim<R extends CommandResponse>(tx: Tx, request: RequestIdentity): Promise<R | undefined>;
    respond(tx: Tx, request: RequestIdentity, response: CommandResponse): Promise<void>;
}
