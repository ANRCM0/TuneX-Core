/** Validated facts supplied by the Node owner; the host does not grant them. */
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
