export const AUDIT_SOURCES = ['access','node-security','forward-ownership','resource-limits','transport','path-template','path-binding','path-group','path-group-binding',
    'path-publication','path-publication-attempt','ingress-group','ingress-deployment','ingress-deployment-attempt',
    'ingress-migration','ingress-migration-attempt','operation'] as const;
export type AuditSource = typeof AUDIT_SOURCES[number];
export const AUDIT_KINDS: Readonly<Record<AuditSource, readonly string[]>> = {
    access: ['member_change','node_grant_change'],
    'node-security': ['credential_rotation','policy_update','node_revocation','relay_endpoint_update','relay_credential_issue','resource_classification'],
    'forward-ownership': ['classify-owner'],
    'resource-limits': ['configure'],
    transport: ['grant-change'], 'path-template': ['publish','archive','classify-owner'], 'path-binding': ['bind'],
    'path-group': ['publish','archive','classify-owner'], 'path-group-binding': ['bind'],
    'path-publication': ['create','apply','compensate','cancel','recovery'], 'path-publication-attempt': ['apply','compensate'],
    'ingress-group': ['publish','archive','classify-owner'], 'ingress-deployment': ['create','compensate','cancel','recovery'],
    'ingress-deployment-attempt': ['create','compensate'], 'ingress-migration': ['create','apply','compensate','cancel','recovery'],
    'ingress-migration-attempt': ['apply','compensate'], operation: ['create','update','enable','disable','delete','retry','policy','revoke'],
};
export const AUDIT_ERROR_CODES = ['AUTHORIZATION_DENIED','EXECUTION_DEADLINE','INTEGRITY_FAILURE','INVALID_CONFIG','UNSUPPORTED_CAPABILITY',
    'RESOURCE_CONFLICT','RESOURCE_LIMIT','PORT_RESERVED','FENCING_REJECTED','LEASE_EXPIRED','SESSION_SUPERSEDED','LISTEN_FAILED',
    'BIND_FAILED','TARGET_DENIED','CONNECT_FAILED','DIAL_FAILED','PEER_UNAVAILABLE','TLS_FAILED','RELAY_HANDSHAKE_FAILED',
    'DRAIN_TIMEOUT','INTERNAL_ERROR','CLOCK_UNCERTAIN','CONFIG_DIGEST_MISMATCH','AUTHENTICATION_FAILED','TARGET_REJECTED',
    'DOWNSTREAM_NOT_ACTIVE','DOWNSTREAM_UNAVAILABLE','TARGET_UNAVAILABLE','PORT_IN_USE','REVISION_CONFLICT','GROUP_ARCHIVED',
    'TEMPLATE_ARCHIVED','REVISION_EXHAUSTED','PUBLICATION_STATE_CHANGED','NOT_FOUND','OTHER_ERROR'] as const;
export type AuditErrorCode = typeof AUDIT_ERROR_CODES[number];
export interface AuditFilters {
    actorId?: string; nodeId?: string; forwardId?: string; operationId?: string; errorCode?: AuditErrorCode; source?: AuditSource;
}
export interface AuditPosition { occurredAt: number; source: AuditSource; key: string }
export interface AuditReadQuery { from: number; to: number; limit: number; filters: Readonly<AuditFilters>; before: AuditPosition | null }
export interface AuditRecord extends AuditPosition {
    kind: string;
    recordType: 'owner-event' | 'immutable-provenance' | 'owner-attempt' | 'latest-operation-state';
    timeMeaning: 'recorded-at' | 'latest-operation-update';
    actorId: string | null;
    actorAttribution: 'initiator' | 'unattributed' | 'unattributed-recovery' | 'requester-not-status-actor';
    subjectId: string | null;
    entityKind: 'scope-access' | 'node' | 'transport-profile' | 'path-template' | 'forward' | 'path-group' | 'path-publication' |
        'ingress-group' | 'ingress-deployment' | 'ingress-migration';
    entityId: string;
    revision: number | null;
    revisionKind: 'access' | 'grant' | 'config' | 'forward' | 'batch' | 'resource' | null;
    sequence: number | null;
    position: number | null;
    nodeId: string | null;
    nodeAssociation: 'explicit-node' | 'immutable-forward-spec' | 'immutable-template-config' | 'immutable-group-definition' | 'none';
    forwardId: string | null;
    operationId: string | null;
    outcome: 'recorded' | 'accepted' | 'rejected' | 'running' | 'succeeded' | 'failed' | 'superseded';
    errorCode: AuditErrorCode | null;
    retryable: boolean | null;
    recoveryInvalidated: boolean | null;
}

/** Deliberate owner-record projection. Filters apply before each bounded source window. */
export interface AuditReadPort<Tx> {
    source(tx: Tx, scope: string, source: AuditSource, query: AuditReadQuery): Promise<AuditRecord[]>;
}
