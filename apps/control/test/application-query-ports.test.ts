import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConsoleQueries } from '../src/application/console-queries.ts';
import type { ConsoleReadPort } from '../src/application/console-queries.ts';
import type { ConsoleFilters, ConsolePaging } from '../src/application/console-query.ts';
import type { ScopeAuthorization, TransactionBoundary } from '../src/application/ports.ts';

import type { ReadPrincipal, ResourceReadAccess } from '../src/framework/public.ts';

type Tx = Readonly<{ id: symbol }>;
function fixture(permit = true) {
    const tx: Tx = Object.freeze({ id: Symbol('transaction') });
    const events: string[] = [], calls: {
        kind: string; tx: Tx; scope: string; actor?: string; paging?: ConsolePaging; filters?: ConsoleFilters; principal?: ReadPrincipal;
    }[] = [];
    const db: TransactionBoundary<Tx> = {
        transaction: async action => {
            events.push('begin');
            try {
                const result = await action(tx);
                events.push('commit');
                return result;
            } catch (error) {
                events.push('rollback');
                throw error;
            }
        },
    };
    const identity: ScopeAuthorization<Tx> = {
        scope: async (current, actor, scope, manage) => {
            assert.equal(current, tx);
            assert.equal(actor, 'actor-a');
            assert.equal(scope, 'scope-a');
            events.push(manage ? 'manage' : 'view');
            if (!permit) throw new Error('denied');
        },
    };
    const principal: ReadPrincipal = Object.freeze({actorId: 'actor-a', governance: false});
    const access: ResourceReadAccess<Tx> = {
        async principal(current, actor, scope) { assert.equal(current, tx); assert.equal(actor, principal.actorId); assert.equal(scope, 'scope-a'); events.push('principal'); return principal; },
        async node(current, actor, scope, id, detail) { assert.equal(current, tx); assert.equal(actor, principal.actorId); assert.equal(scope, 'scope-a'); assert.equal(detail, 'diagnostics'); if(id!=='node-a') throw new Error('personal Node denied'); events.push('node-access'); return 'full'; },
        async forward() { throw new Error('Unused'); }, async owned() { throw new Error('Unused'); },
    };
    const page = (kind: string, current: Tx, scope: string, supplied: ReadPrincipal, paging: ConsolePaging, filters: ConsoleFilters) => {
        assert.equal(supplied, principal); calls.push({ kind, tx: current, scope, principal: supplied, paging, filters });
        events.push(kind);
        return { page: paging.page, limit: paging.limit, total: 0, items: [] };
    };
    const read: ConsoleReadPort<Tx> = {
        nodes: async (...args) => page('nodes', ...args),
        forwards: async (...args) => page('forwards', ...args),
        operations: async (...args) => page('operations', ...args),
        candidates: async (current, scope, supplied, paging, filters) => {
            return { ...page('candidates', current, scope, supplied, paging, filters), mode: filters.mode ?? 'direct',
                source: 'persisted-control-state', independentProbe: false, fullPlanAuthorization: false, reserved: false };
        },
        overview: async (current, scope, supplied) => {
            assert.equal(supplied, principal);
            calls.push({ kind: 'overview', tx: current, scope }); events.push('overview');
            return { nodes: 0, forwards: 0, activeOperations: 0, failedOperations: 0,
                observedAt: '2026-10-16T00:00:00.000Z', source: 'persisted-control-state', independentProbe: false };
        },
        diagnostics: async (current, scope, supplied, nodeId) => {
            assert.equal(supplied, principal);
            calls.push({ kind: 'diagnostics', tx: current, scope }); events.push('diagnostics');
            return { nodeId, observedAt: '2026-10-16T00:00:00.000Z', source: 'persisted-control-state',
                independentProbe: false, revoked: false, credentialUntil: null, sessionEpoch: 0,
                snapshotGeneration: 0, lastReportSequence: 0, lastReportAt: null, reportAgeSeconds: null,
                reportStatus: 'missing', snapshotLeaseUntil: null, snapshotLeaseRemainingSeconds: null,
                totalReportedObservations: 0, errors: [], note: 'No independent probe.' };
        },
    };
    return { tx, events, calls, identity, read, queries: new ConsoleQueries(db, identity, read, access) };
}

test('query ports preserve one authorized transaction without a concrete Control or SQL connection', async () => {
    const f = fixture();
    for (const kind of ['nodes', 'forwards', 'operations', 'candidates'] as const) {
        f.events.length = 0;
        const result = await f.queries[kind]('actor-a', 'scope-a', '2', '40');
        assert.deepEqual(f.events, ['begin', kind === 'candidates' ? 'manage' : 'view', 'principal', kind, 'commit']);
        assert.equal(result.page, 2); assert.equal(result.limit, 40);
        assert.deepEqual(f.calls.at(-1)!.paging, { page: 2, limit: 40, offset: 40 });
    }
    for (const kind of ['overview', 'diagnostics'] as const) {
        f.events.length = 0;
        if (kind === 'overview') await f.queries.overview('actor-a', 'scope-a');
        else await f.queries.diagnostics('actor-a', 'scope-a', 'node-a');
        assert.deepEqual(f.events, ['begin', 'view', 'principal', ...(kind==='diagnostics'?['node-access']:[]), kind, 'commit']);
    }
    assert.equal(f.calls.length, 6);
    assert.ok(f.calls.every(call => call.tx === f.tx && call.scope === 'scope-a'));
});

test('denied query authorization prevents every projection and propagates transaction failure', async () => {
    const f = fixture(false);
    const commands = [
        () => f.queries.nodes('actor-a', 'scope-a'),
        () => f.queries.forwards('actor-a', 'scope-a'),
        () => f.queries.operations('actor-a', 'scope-a'),
        () => f.queries.candidates('actor-a', 'scope-a'),
        () => f.queries.overview('actor-a', 'scope-a'),
        () => f.queries.diagnostics('actor-a', 'scope-a', 'node-a'),
    ];
    for (const command of commands) {
        f.events.length = 0;
        await assert.rejects(command, /denied/);
        assert.equal(f.events.at(-1), 'rollback');
        assert.ok(!f.events.includes('commit'));
    }
    assert.equal(f.calls.length, 0);
});

test('non-HTTP query callers cannot bypass pagination, filter or identifier validation', async () => {
    const f = fixture();
    for (const kind of ['nodes', 'forwards', 'operations', 'candidates'] as const) {
        await assert.rejects(f.queries[kind]('actor-a', 'scope-a', '0'));
        await assert.rejects(f.queries[kind]('actor-a', 'scope-a', '1', '101'));
        await assert.rejects(f.queries[kind]('actor-a', 'scope-a', undefined, undefined, { scope: 'other' }));
    }
    await assert.rejects(f.queries.diagnostics('actor-a', 'scope-a', '../other'));
    assert.deepEqual(f.events, []);
    assert.deepEqual(f.calls, []);
});

test('query inputs are detached before asynchronous authorization and adapter failures are not swallowed', async () => {
    const f = fixture(), filters = { idPrefix: 'original' };
    f.identity.scope = async current => {
        assert.equal(current, f.tx);
        filters.idPrefix = 'changed';
    };
    await f.queries.nodes('actor-a', 'scope-a', undefined, undefined, filters);
    assert.deepEqual(f.calls[0]!.filters, { idPrefix: 'original' });
    assert.ok(Object.isFrozen(f.calls[0]!.filters));
    const failure = new Error('projection failed');
    f.read.overview = async () => { throw failure; };
    await assert.rejects(f.queries.overview('actor-a', 'scope-a'), error => error === failure);
    assert.equal(f.events.at(-1), 'rollback');
});

 test('personal Node rejection prevents diagnostic projection in the same transaction',async()=>{const f=fixture();await assert.rejects(f.queries.diagnostics('actor-a','scope-a','other-node'),/personal Node denied/);assert.deepEqual(f.calls,[]);assert.deepEqual(f.events,['begin','view','principal','rollback']);});
