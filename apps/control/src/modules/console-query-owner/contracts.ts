import type { ReadPageWindow, ReadFilters, ManagementReadKind, ReadPrincipal } from '../../framework/public.ts';

export const CONSOLE_QUERY_INTERFACE_VERSION=2 as const;
export type ConsoleListKind=ManagementReadKind;
export type ConsoleFilters=ReadFilters;
export interface ConsolePaging extends ReadPageWindow {}

export interface ConsolePage<T> { page: number; limit: number; total: number; items: T[] }
export interface ConsoleNode {
    id: string; revoked: boolean; credentialUntil: string | null; policy: unknown;
    resourceSource:'private'|'admin-shared'|'legacy-unclassified';ownerActorId:string|null;
    allowedRoles:('ingress'|'transit'|'egress')[]|null;canUse:boolean;
    sessionEpoch: number; snapshotGeneration: number; lastReportAt: string | null;
    readDetail: 'full' | 'shared';
}
export interface ConsoleForward {
    id: string; revision: number; spec: unknown; recoverySuspended: boolean;
    lastOperation: { id: string; kind: string | null; status: string | null } | null;
}
export interface ConsoleOperation {
    id: string; forwardId: string; kind: string; status: string; targetRevision: number;
    createdAt: string; updatedAt: string; lastError: unknown;
    recoveryInvalidated: boolean; cleanupPending: boolean;
}
export interface ConsoleCandidates extends ConsolePage<ConsoleNode> {
    mode: string; source: 'persisted-control-state'; independentProbe: false;
    fullPlanAuthorization: false; reserved: false;
}
export interface ConsoleOverview {
    nodes: number; forwards: number; activeOperations: number; failedOperations: number;
    observedAt: string; source: 'persisted-control-state'; independentProbe: false;
}
export interface ConsoleDiagnostics {
    nodeId: string; observedAt: string; source: 'persisted-control-state'; independentProbe: false;
    revoked: boolean; credentialUntil: string | null; sessionEpoch: number; snapshotGeneration: number;
    lastReportSequence: number; lastReportAt: string | null; reportAgeSeconds: number | null;
    reportStatus: 'missing' | 'age-only'; snapshotLeaseUntil: string | null;
    snapshotLeaseRemainingSeconds: number | null; totalReportedObservations: number;
    errors: { assignmentId: string; condition: string; errorCode: string; retryable: boolean }[];
    note: string;
}

/** Deliberate cross-module read projections, not commands or live health probes. */
export interface ConsoleReadPort<Tx> {
    nodes(tx: Tx, scope: string, principal: ReadPrincipal, paging: ConsolePaging, filters: ConsoleFilters): Promise<ConsolePage<ConsoleNode>>;
    forwards(tx: Tx, scope: string, principal: ReadPrincipal, paging: ConsolePaging, filters: ConsoleFilters): Promise<ConsolePage<ConsoleForward>>;
    operations(tx: Tx, scope: string, principal: ReadPrincipal, paging: ConsolePaging, filters: ConsoleFilters): Promise<ConsolePage<ConsoleOperation>>;
    candidates(tx: Tx, scope: string, principal: ReadPrincipal, paging: ConsolePaging, filters: ConsoleFilters): Promise<ConsoleCandidates>;
    overview(tx: Tx, scope: string, principal: ReadPrincipal): Promise<ConsoleOverview>;
    diagnostics(tx: Tx, scope: string, principal: ReadPrincipal, nodeId: string): Promise<ConsoleDiagnostics>;
}


export interface ConsoleQueryApi {
    nodes(actor:string,scope:string,page?:string,limit?:string,filters?:ConsoleFilters):Promise<ConsolePage<ConsoleNode>>;
    forwards(actor:string,scope:string,page?:string,limit?:string,filters?:ConsoleFilters):Promise<ConsolePage<ConsoleForward>>;
    operations(actor:string,scope:string,page?:string,limit?:string,filters?:ConsoleFilters):Promise<ConsolePage<ConsoleOperation>>;
    candidates(actor:string,scope:string,page?:string,limit?:string,filters?:ConsoleFilters):Promise<ConsoleCandidates>;
    overview(actor:string,scope:string):Promise<ConsoleOverview>;
    diagnostics(actor:string,scope:string,nodeId:string):Promise<ConsoleDiagnostics>;
}
