export interface AuthorizedNodeFacts {
    readonly nodeId: string;
    readonly scopeId: string;
    readonly capabilities: readonly string[];
    readonly allowedListenerAddresses: readonly string[];
    readonly allowedPorts: readonly number[];
    readonly egressPolicyRevision: number;
    readonly allowedDestinationCidrs: readonly string[];
    readonly allowMetadataTargets: boolean;
}

export type NodePolicy = Omit<AuthorizedNodeFacts, 'nodeId' | 'scopeId' | 'capabilities'>;

export type NodeManagementCommand = {
    readonly kind: 'policy';
    readonly expectedRevision: number;
    readonly policy: NodePolicy;
} | { readonly kind: 'revoke' };

export interface NodeManagementChange {
    readonly nodeId: string;
    readonly kind: NodeManagementCommand['kind'];
    readonly facts: AuthorizedNodeFacts;
}

export interface NodeManagementAudit {
    policyRevision: number;
    operationIds: string[];
    latestAuthorizationUntil: number | null;
}

export interface NodeManagementWriter<Tx> {
    applyManagement(tx: Tx, actor: string, scopeId: string, nodeId: string,
        command: NodeManagementCommand): Promise<NodeManagementChange>;
    audit(tx: Tx, nodeId: string, actor: string, kind: 'policy_update' | 'node_revocation',
        details: NodeManagementAudit): Promise<void>;
}
