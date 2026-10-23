import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IdentityService } from '../src/modules/identity-owner/public.ts';
import type { IdentityContextQuery } from '../src/modules/identity-owner/contracts.ts';
import { MySqlIdentityStore } from '../src/infrastructure/mysql-identity.ts';
import { nativeIdentityCodec } from '../src/compatibility/public.ts';
import type { IdentityAccessStore, IdentityScopeContextRecord } from '../src/framework/public.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

function fixture() {
    const tx = Object.freeze({ identity: 'context' }), trace: string[] = [];
    const state = { records: [] as IdentityScopeContextRecord[], failure: null as Error | null,
        request: undefined as unknown };
    const store = { async scopeContext(actual: typeof tx, actor: string, window: unknown) {
        assert.equal(actual, tx); assert.equal(actor, 'actor'); trace.push('context'); state.request = window;
        if (state.failure) throw state.failure;
        return state.records;
    } } as unknown as IdentityAccessStore<typeof tx>;
    const service = new IdentityService({ store, codec: nativeIdentityCodec,
        db: { async transaction<T>(action: (value: typeof tx) => Promise<T>) {
            trace.push('begin'); try { const result = await action(tx); trace.push('commit'); return result; }
            catch (error) { trace.push('rollback'); throw error; }
        } },
        accounts: { async byToken() { return assert.fail('Context must not read token hashes'); } },
        secrets: { newID() { return assert.fail('Context cannot create IDs'); },
            newToken() { return assert.fail('Context cannot issue tokens'); },
            tokenHash() { return assert.fail('Context must not hash credentials'); } },
        now() { return assert.fail('Context has no execution clock'); } });
    return { service, state, trace };
}

function membership(scopeId: string, ownerId: string, active: number, canManage: number): IdentityScopeContextRecord {
    return { scopeId, ownerId, membership: { actorId: 'actor', revision: 3, active, canManage } };
}

test('context maps only original membership/ownership facts and never repairs an unavailable owner membership', async () => {
    const f = fixture();
    f.state.records = [membership('a', 'other', 1, 1), membership('b', 'actor', 0, 1),
        { scopeId: 'c', ownerId: 'actor', membership: null }, membership('d', 'other', 1, 0)];
    const result = await f.service.context('actor');
    assert.deepEqual(result, { actorId: 'actor', limit: 25, truncated: false, nextAfter: null, scopes: [
        { scopeId: 'a', role: 'manager', membership: 'active', membershipRevision: 3, canEnter: true, canManage: true },
        { scopeId: 'b', role: 'owner', membership: 'inactive', membershipRevision: 3, canEnter: false, canManage: false },
        { scopeId: 'c', role: 'owner', membership: 'absent', membershipRevision: null, canEnter: false, canManage: false },
        { scopeId: 'd', role: 'viewer', membership: 'active', membershipRevision: 3, canEnter: true, canManage: false },
    ] });
    assert.deepEqual(f.state.request, { after: null, limit: 25 });
    assert.deepEqual(f.trace, ['begin', 'context', 'commit']);
    assert.equal('total' in result, false);
    assert.equal(JSON.stringify(result).includes('other'), false);
});

test('context keyset pages use only the last returned visible Scope as continuation', async () => {
    const f = fixture();
    f.state.records = [membership('b', 'actor', 1, 1), membership('c', 'other', 1, 0)];
    const first = await f.service.context('actor', { after: 'a', limit: '1' });
    assert.deepEqual(f.state.request, { after: 'a', limit: 1 });
    assert.deepEqual(first.scopes.map(value => value.scopeId), ['b']);
    assert.equal(first.nextAfter, 'b'); assert.equal(first.truncated, true);
    f.state.records = [membership('c', 'other', 1, 0)];
    const last = await f.service.context('actor', { after: first.nextAfter!, limit: '1' });
    assert.equal(last.nextAfter, null); assert.equal(last.truncated, false);
    f.state.records = [];
    assert.deepEqual((await f.service.context('actor')).scopes, []);
});

test('closed context inputs reject invalid bounds/cursors and actor overrides before starting a transaction', async () => {
    const inputs: unknown[] = [null, [], 1, { actor: 'other' }, { scopeId: 'secret' }, { limit: '0' },
        { limit: '101' }, { limit: '01' }, { limit: '1\n' }, { limit: ' 1' }, { limit: 25 },
        { after: '../scope' }, { after: '' }, { after: 'x\n' }, Object.create({ limit: '1' })];
    for (const input of inputs) {
        const f = fixture();
        await assert.rejects(f.service.context('actor', input as IdentityContextQuery), { code: 'INVALID_CONFIG' });
        assert.deepEqual(f.trace, []);
    }
    const f = fixture();
    await assert.rejects(f.service.context('../actor'), { code: 'INVALID_CONFIG' });
    assert.deepEqual(f.trace, []);
});

test('context rejects provider leakage, invalid claims, duplicate/unsorted rows and rows outside its cursor', async () => {
    const valid = membership('b', 'other', 1, 0);
    const invalid: IdentityScopeContextRecord[][] = [
        [membership('b', 'other', 0, 1)], [{ scopeId: 'b', ownerId: 'other', membership: null }],
        [{ ...valid, membership: { ...valid.membership!, actorId: 'another' } }],
        [{ ...valid, membership: { ...valid.membership!, active: 2 } }],
        [{ ...valid, membership: { ...valid.membership!, canManage: 2 } }],
        [{ ...valid, membership: { ...valid.membership!, revision: 0 } }],
        [{ ...valid, ownerId: undefined as unknown as string }],
        [valid, valid], [membership('c', 'other', 1, 0), valid],
        [membership('a', 'other', 1, 0)],
        [valid, membership('c', 'other', 1, 0), membership('d', 'other', 1, 0)],
    ];
    for (const records of invalid) {
        const f = fixture(); f.state.records = records;
        await assert.rejects(f.service.context('actor', { after: 'a', limit: '1' }), { code: 'INTEGRITY_FAILURE' });
        assert.deepEqual(f.trace, ['begin', 'context', 'rollback']);
    }
    const f = fixture(); const failure = new Error('original provider failure'); f.state.failure = failure;
    await assert.rejects(f.service.context('actor'), error => error === failure);
});

test('MySQL context binds the current actor to membership and ownership, caps lookahead and selects no credentials', async () => {
    const calls: { sql: string; args: unknown[] }[] = [];
    const tx = { async execute(sql: string, args: unknown[]) {
        calls.push({ sql, args });
        return [[{ scope_id: 'owned', owner_id: 'actor', actor_id: null, active: null, can_manage: null, revision: null }], []];
    } } as unknown as Transaction;
    const store = new MySqlIdentityStore();
    const records = await store.scopeContext(tx, 'actor', { after: 'before', limit: 100 });
    assert.deepEqual(records, [{ scopeId: 'owned', ownerId: 'actor', membership: null }]);
    assert.deepEqual(calls[0]!.args, ['actor', 'actor', 'before']);
    assert.match(calls[0]!.sql, /m\.actor_id=\?/);
    assert.match(calls[0]!.sql, /s\.owner_id=\? OR m\.active=TRUE/);
    assert.match(calls[0]!.sql, /AND s\.id>\?/);
    assert.match(calls[0]!.sql, /ORDER BY s\.id COLLATE ascii_bin LIMIT 101/);
    assert.doesNotMatch(calls[0]!.sql, /token|accounts|INSERT|UPDATE|DELETE|COUNT/i);
    await assert.rejects(store.scopeContext(tx, 'actor', { after: null, limit: 101 }), { code: 'INTEGRITY_FAILURE' });
    assert.equal(calls.length, 1);
});
