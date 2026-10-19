import { consolePage, validateConsoleFilters } from './rules.ts';
import { invalid } from '../../framework/public.ts';
import type { ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';

import type { ConsoleFilters, ConsoleListKind, ConsoleReadPort, ConsoleQueryApi } from './contracts.ts';
export type { ConsolePage, ConsoleNode, ConsoleForward, ConsoleOperation, ConsoleCandidates, ConsoleOverview,
    ConsoleDiagnostics, ConsoleReadPort } from './contracts.ts';

/** Authorization and projection share the caller's UnitOfWork transaction. */
export class ConsoleQueries<Tx> implements ConsoleQueryApi {
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
