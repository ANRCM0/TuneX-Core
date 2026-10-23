import type { AuthorizedNodeFacts } from '../../framework/public.ts';
import type { NodeResourceClaim } from '../../framework/public.ts';
export type { AuthorizedNodeFacts } from '../../framework/public.ts';

export type NodePolicy = Omit<AuthorizedNodeFacts, 'nodeId' | 'scopeId' | 'capabilities'>;

export type NodeManagementCommand = {
    readonly kind: 'policy';
    readonly expectedRevision: number;
    readonly policy: NodePolicy;
} | { readonly kind: 'revoke' } | {
    readonly kind:'classify';readonly expectedRevision:number;
    readonly source:'private'|'admin-shared';readonly ownerActorId:string|null;
    readonly legacyGrants:'discard'|'retain';
};

export interface NodeManagementChange {
    readonly nodeId: string;
    readonly kind: NodeManagementCommand['kind'];
    readonly facts: AuthorizedNodeFacts;
    readonly resource?:NodeResourceClaim;
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
