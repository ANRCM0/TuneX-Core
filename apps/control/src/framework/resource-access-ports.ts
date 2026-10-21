export const RESOURCE_ACCESS_INTERFACE_VERSION = 1 as const;

export interface ReadPrincipal {
    readonly actorId: string;
    readonly governance: boolean;
}

export type OwnedResourceKind = 'forward' | 'path-template' | 'path-group' | 'ingress-group' |
    'path-publication' | 'ingress-deployment' | 'ingress-migration' | 'probe-plan' | 'probe-run';
export type NodeReadDetail = 'basic' | 'host' | 'diagnostics';

export interface ResourceOwnershipRecord {
    readonly ownerActorId: string | null;
}
export interface ResourceNodeReadRecord extends ResourceOwnershipRecord {
    readonly source: 'legacy-unclassified' | 'private' | 'admin-shared';
    readonly granted: boolean;
}

/** Original owner claims only. Every read joins the supplied transaction. */
export interface ResourceAccessStore<Tx> {
    scopeOwner(tx: Tx, scopeId: string): Promise<{ ownerActorId: string } | undefined>;
    ownership(tx: Tx, scopeId: string, kind: OwnedResourceKind, id: string): Promise<ResourceOwnershipRecord | undefined>;
    node(tx: Tx, actorId: string, scopeId: string, nodeId: string): Promise<ResourceNodeReadRecord | undefined>;
}

/** Caller-aware product reads and ownership checks; never execution authority. */
export interface ResourceReadAccess<Tx> {
    principal(tx: Tx, actorId: string, scopeId: string): Promise<ReadPrincipal>;
    forward(tx: Tx, actorId: string, scopeId: string, forwardId: string): Promise<void>;
    node(tx: Tx, actorId: string, scopeId: string, nodeId: string, detail: NodeReadDetail): Promise<'full' | 'shared'>;
    owned(tx: Tx, actorId: string, scopeId: string, kind: OwnedResourceKind, id: string,
        allowGovernance?: boolean): Promise<void>;
}
