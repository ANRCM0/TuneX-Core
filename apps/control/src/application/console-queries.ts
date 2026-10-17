import { consolePage, validateConsoleFilters } from './console-query.ts';
import type { ConsoleFilters, ConsoleListKind, ConsolePaging } from './console-query.ts';
import { invalid } from './errors.ts';
import type { ScopeAuthorization, TransactionBoundary } from './ports.ts';

export interface ConsolePage<T> { page: number; limit: number; total: number; items: T[] }
export interface ConsoleNode {
    id: string; revoked: boolean; credentialUntil: string | null; policy: unknown;
    sessionEpoch: number; snapshotGeneration: number; lastReportAt: string | null;
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
    nodes(tx: Tx, scope: string, paging: ConsolePaging, filters: ConsoleFilters): Promise<ConsolePage<ConsoleNode>>;
    forwards(tx: Tx, scope: string, paging: ConsolePaging, filters: ConsoleFilters): Promise<ConsolePage<ConsoleForward>>;
    operations(tx: Tx, scope: string, paging: ConsolePaging, filters: ConsoleFilters): Promise<ConsolePage<ConsoleOperation>>;
    candidates(tx: Tx, actor: string, scope: string, paging: ConsolePaging, filters: ConsoleFilters): Promise<ConsoleCandidates>;
    overview(tx: Tx, scope: string): Promise<ConsoleOverview>;
    diagnostics(tx: Tx, scope: string, nodeId: string): Promise<ConsoleDiagnostics>;
}

/** Authorization and projection share the caller's UnitOfWork transaction. */
export class ConsoleQueries<Tx> {
    private readonly db: TransactionBoundary<Tx>;
    private readonly identity: ScopeAuthorization<Tx>;
    private readonly read: ConsoleReadPort<Tx>;

    constructor(db: TransactionBoundary<Tx>, identity: ScopeAuthorization<Tx>, read: ConsoleReadPort<Tx>) {
        this.db = db; this.identity = identity; this.read = read;
    }

    private page(kind: ConsoleListKind, page: string | undefined, limit: string | undefined, filters: ConsoleFilters) {
        const paging = consolePage(page, limit), owned = Object.freeze({ ...filters });
        validateConsoleFilters(kind, owned);
        return { paging, filters: owned };
    }

    private authorized<T>(actor: string, scope: string, manage: boolean, read: (tx: Tx) => Promise<T>): Promise<T> {
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actor, scope, manage);
            return read(tx);
        });
    }

    async nodes(actor: string, scope: string, page?: string, limit?: string, filters: ConsoleFilters = {}) {
        const query = this.page('nodes', page, limit, filters);
        return this.authorized(actor, scope, false, tx => this.read.nodes(tx, scope, query.paging, query.filters));
    }
    async forwards(actor: string, scope: string, page?: string, limit?: string, filters: ConsoleFilters = {}) {
        const query = this.page('forwards', page, limit, filters);
        return this.authorized(actor, scope, false, tx => this.read.forwards(tx, scope, query.paging, query.filters));
    }
    async operations(actor: string, scope: string, page?: string, limit?: string, filters: ConsoleFilters = {}) {
        const query = this.page('operations', page, limit, filters);
        return this.authorized(actor, scope, false, tx => this.read.operations(tx, scope, query.paging, query.filters));
    }
    async candidates(actor: string, scope: string, page?: string, limit?: string, filters: ConsoleFilters = {}) {
        const query = this.page('candidates', page, limit, filters);
        return this.authorized(actor, scope, true, tx => this.read.candidates(tx, actor, scope, query.paging, query.filters));
    }
    async overview(actor: string, scope: string) {
        return this.authorized(actor, scope, false, tx => this.read.overview(tx, scope));
    }
    async diagnostics(actor: string, scope: string, nodeId: string) {
        if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(nodeId)) invalid('Invalid Node identifier');
        return this.authorized(actor, scope, false, tx => this.read.diagnostics(tx, scope, nodeId));
    }
}
