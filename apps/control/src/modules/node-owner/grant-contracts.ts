export interface NodeGrantState {
    readonly nodeId: string;
    readonly actorId: string;
    readonly revision: number;
    readonly allowed: boolean;
    readonly changed: boolean;
}

export interface NodeGrantWriter<Tx> {
    changeGrant(tx: Tx, owner: string, scopeId: string, nodeId: string, subject: string,
        expectedRevision: number, allowed: boolean): Promise<NodeGrantState>;
}
