import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuditEvents, AUDIT_SOURCES } from '../src/modules/audit-owner/public.ts';
import type { AuditRecord, AuditSource, AuditReadPort } from '../src/modules/audit-owner/public.ts';
import { ControlError } from '../src/framework/public.ts';

function fixture() {
    const tx = Object.freeze({ transaction: Symbol('audit') }), events: string[] = [];
    const state = { clocks: 0, deny: false, rows: [] as AuditRecord[], fail: false };
    const now = 1800000000000;
    const check = (actual: typeof tx) => assert.equal(actual, tx);
    const db = { async transaction<T>(action: (actual: typeof tx) => Promise<T>) {
        events.push('begin');
        try { const value = await action(tx); events.push('commit'); return value; }
        catch (error) { events.push('rollback'); throw error; }
    } };
    const auth = { async scope(actual: typeof tx, actor: string, scope: string, manage?: boolean) {
        check(actual); assert.equal(actor,'selfservice-manager'); assert.equal(scope,'scope'); assert.equal(manage,true);
    }, async owner(actual: typeof tx, actor: string, scope: string, ...extra: unknown[]) {
        check(actual); events.push('authorize'); assert.equal(scope, 'scope'); assert.deepEqual(extra,[]); assert.ok(actor);
        if(!['manager','manager-a','manager-b','manager-c','reader-a','reader-b','reader-c'].includes(actor)) throw new ControlError('AUTHORIZATION_DENIED',403,'Scope owner permission required');
        if (state.deny) throw new ControlError('AUTHORIZATION_DENIED', 403, 'denied');
    } };
    const read: AuditReadPort<typeof tx> = { async source(actual, scope, source, query) {
        check(actual); assert.equal(scope, 'scope'); assert.ok(Object.isFrozen(query)); events.push(`read:${source}`);
        if (state.fail) throw new Error('reader failed');
        return state.rows.filter(row => row.source === source && (!query.before || row.occurredAt < query.before.occurredAt))
            .slice(0, query.limit + 1);
    } };
    const service = new AuditEvents(db, auth, read, () => { state.clocks++; return now; });
    return { service, state, events, now };
}

function record(at: number, digit: string): AuditRecord {
    return { occurredAt: at, source: 'access', key: 'sha256:' + digit.repeat(64), kind: 'member_change',
        recordType: 'owner-event', timeMeaning: 'recorded-at', actorId: 'manager', actorAttribution: 'initiator',
        subjectId: 'member', entityKind: 'scope-access', entityId: 'scope', revision: 1, revisionKind: 'access',
        sequence: null, position: null, nodeId: null, nodeAssociation: 'none', forwardId: null, operationId: null,
        outcome: 'recorded', errorCode: null, retryable: null, recoveryInvalidated: null };
}

test('audit rejects invalid closed queries before clock and authorization before any source read', async () => {
    const f = fixture();
    await assert.rejects(f.service.query('', 'scope', {}), { code: 'INVALID_CONFIG' });
    await assert.rejects(f.service.query('manager', 'scope', { extra: 'x' }), { code: 'INVALID_CONFIG' });
    assert.equal(f.state.clocks, 0); assert.deepEqual(f.events, []);
    f.state.deny = true;
    await assert.rejects(f.service.query('manager', 'scope', {}), { code: 'AUTHORIZATION_DENIED' });
    assert.deepEqual(f.events, ['begin', 'authorize', 'rollback']);
});

test('audit sequential source reads share caller transaction and frozen read-only result', async () => {
    const f = fixture(), result = await f.service.query('manager', 'scope', {});
    assert.deepEqual(f.events, ['begin', 'authorize', ...AUDIT_SOURCES.map(source => `read:${source}`), 'commit']);
    assert.equal(f.state.clocks, 2); assert.equal(result.executionAuthorized, false); assert.equal(result.readOnly, true);
    assert.equal(result.health, 'unknown'); assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.coverage.sources));
    assert.deepEqual(result.items, []);
});

test('audit pagination binds cursor to explicit query and rejects corrupt duplicate ordering', async () => {
    const f = fixture();
    f.state.rows = [record(f.now - 100, 'c'), record(f.now - 200, 'b'), record(f.now - 300, 'a')];
    const input = { from: new Date(f.now - 1000).toISOString(), to: new Date(f.now).toISOString(), source: 'access' as AuditSource, limit: '2' };
    const first = await f.service.query('manager-a', 'scope', input);
    assert.equal(first.hasMore, true); assert.ok(first.nextCursor); assert.equal(first.items.length, 2);
    const next = await f.service.query('manager-b', 'scope', { ...input, cursor: first.nextCursor! });
    assert.equal(next.hasMore, false); assert.equal(next.items.length, 1); assert.equal(next.items[0]!.key, f.state.rows[2]!.key);
    await assert.rejects(f.service.query('manager-c', 'scope', { ...input, limit: '1', cursor: first.nextCursor! }), { code: 'INVALID_CONFIG' });
    const broken = fixture(); broken.state.rows = [record(broken.now - 100, 'a'), record(broken.now - 100, 'a')];
    await assert.rejects(broken.service.query('manager', 'scope', input), { code: 'INTEGRITY_FAILURE' });
    assert.equal(broken.events.at(-1), 'rollback');
});

test('audit request admission releases capacity after both rejection and successful drain', async () => {
    const f = fixture(); let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const first = f.service.admitReadRequest(() => held), second = f.service.admitReadRequest(() => held);
    await assert.rejects(f.service.admitReadRequest(async () => assert.fail('over-capacity callback ran')), { code: 'AUDIT_BUSY' });
    release(); await Promise.all([first, second]);
    const failure = new Error('original callback');
    await assert.rejects(f.service.admitReadRequest(async () => { throw failure; }), error => error === failure);
    assert.equal(await f.service.admitReadRequest(async () => 'available'), 'available');
});

test('audit store and malformed-row failures release active slots for later independent actors', async () => {
    const f = fixture(); f.state.fail = true;
    await assert.rejects(f.service.query('reader-a', 'scope', {}), /reader failed/);
    f.state.fail = false;
    f.state.rows = [record(f.now - 1, 'a'), record(f.now - 1, 'a')];
    await assert.rejects(f.service.query('reader-b', 'scope', {}), { code: 'INTEGRITY_FAILURE' });
    f.state.rows = [];
    const next = await f.service.query('reader-c', 'scope', {});
    assert.deepEqual(next.items, []); assert.equal(f.events.at(-1), 'commit');
});

test('same-Scope selfservice management cannot read cross-owner audit records',async()=>{
    const f=fixture();f.state.rows=[record(f.now-1,'a')];
    await assert.rejects(f.service.query('selfservice-manager','scope',{}),{code:'AUTHORIZATION_DENIED'});
    assert.deepEqual(f.events,['begin','authorize','rollback']);assert.equal(f.state.clocks,1);
});
