import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ResourceAccess } from '../src/modules/resource-access-owner/public.ts';
import { ConsoleReadModels } from '../src/modules/console-query-owner/public.ts';
import { MySqlManagementReadStore, MySqlProfileReferenceReadStore, MySqlTunnelMetadataReadStore } from '../src/infrastructure/mysql-management-read.ts';
import type { ManagementReadStore, ReadNodeRow, ResourceAccessStore, ResourceNodeReadRecord,
    ResourceOwnershipRecord, ScopeAuthorization } from '../src/framework/public.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

function fixture() {
    const tx = Object.freeze({ transaction: 'read' }), calls: string[] = [];
    let resource: ResourceOwnershipRecord | undefined = { ownerActorId: 'alice' };
    let node: ResourceNodeReadRecord | undefined = { source: 'private', ownerActorId: 'alice', granted: false };
    const identity: ScopeAuthorization<typeof tx> = { async scope(actual, actor, scope) {
        assert.equal(actual, tx); assert.equal(scope, 'scope'); calls.push('scope:' + actor);
    } };
    const store: ResourceAccessStore<typeof tx> = {
        async scopeOwner(actual, scope) { assert.equal(actual, tx); assert.equal(scope, 'scope'); return { ownerActorId: 'admin' }; },
        async ownership(actual, scope) { assert.equal(actual, tx); assert.equal(scope, 'scope'); return resource; },
        async node(actual, actor, scope) { assert.equal(actual, tx); assert.equal(scope, 'scope'); calls.push('node:' + actor); return node; },
    };
    return { tx, calls, access: new ResourceAccess(identity, store),
        setResource(value: ResourceOwnershipRecord | undefined) { resource = value; },
        setNode(value: ResourceNodeReadRecord | undefined) { node = value; } };
}

test('private and shared read policy never turns governance or a grant into private use ownership', async () => {
    const f = fixture();
    assert.equal(await f.access.node(f.tx, 'alice', 'scope', 'node', 'host'), 'full');
    await assert.rejects(f.access.node(f.tx, 'bob', 'scope', 'node', 'basic'), { code: 'NOT_FOUND' });
    assert.equal(await f.access.node(f.tx, 'admin', 'scope', 'node', 'diagnostics'), 'full');
    f.setNode({ source: 'private', ownerActorId: 'alice', granted: true });
    await assert.rejects(f.access.node(f.tx, 'bob', 'scope', 'node', 'basic'), { code: 'NOT_FOUND' });
    f.setNode({ source: 'admin-shared', ownerActorId: null, granted: true });
    assert.equal(await f.access.node(f.tx, 'bob', 'scope', 'node', 'basic'), 'shared');
    for (const detail of ['host', 'diagnostics'] as const)
        await assert.rejects(f.access.node(f.tx, 'bob', 'scope', 'node', detail), { code: 'NOT_FOUND' });
    f.setNode({ source: 'admin-shared', ownerActorId: null, granted: false });
    await assert.rejects(f.access.node(f.tx, 'bob', 'scope', 'node', 'basic'), { code: 'NOT_FOUND' });
    f.setNode({ source: 'legacy-unclassified', ownerActorId: null, granted: true });
    await assert.rejects(f.access.node(f.tx, 'bob', 'scope', 'node', 'basic'), { code: 'NOT_FOUND' });
});

test('unclassified claims and absent required fields fail closed; governance must be explicitly requested', async () => {
    const f = fixture();
    await f.access.owned(f.tx, 'alice', 'scope', 'path-template', 'template');
    await assert.rejects(f.access.owned(f.tx, 'admin', 'scope', 'path-template', 'template'), { code: 'NOT_FOUND' });
    await f.access.owned(f.tx, 'admin', 'scope', 'path-template', 'template', true);
    await f.access.forward(f.tx, 'admin', 'scope', 'forward');
    await assert.rejects(f.access.forward(f.tx, 'bob', 'scope', 'forward'), { code: 'NOT_FOUND' });
    f.setResource({ ownerActorId: null });
    await assert.rejects(f.access.forward(f.tx, 'alice', 'scope', 'forward'), { code: 'NOT_FOUND' });
    f.setResource({} as ResourceOwnershipRecord);
    await assert.rejects(f.access.forward(f.tx, 'admin', 'scope', 'forward'), { code: 'INTEGRITY_FAILURE' });
    f.setNode({ source: 'private', ownerActorId: null, granted: true });
    await assert.rejects(f.access.node(f.tx, 'admin', 'scope', 'node', 'basic'), { code: 'INTEGRITY_FAILURE' });
    f.setNode({ ownerActorId: 'alice', granted: true } as ResourceNodeReadRecord);
    await assert.rejects(f.access.node(f.tx, 'alice', 'scope', 'node', 'basic'), { code: 'INTEGRITY_FAILURE' });
});

test('shared Console projection removes machine policy secrets and machine-wide observation fields', async () => {
    const row: ReadNodeRow = { id: 'shared', revoked: 0, credential_until: null, read_detail: 'shared',
        resource_source:'admin-shared',owner_actor_id:null,allowed_roles:['transit'],can_use:0,
        facts: { capabilities: ['tcp'], allowedListenerAddresses: ['0.0.0.0'], allowedPorts: [1000],
            egressPolicy: { secret: 'another-tenant' }, policyRevision: 9, credentials: 'never-public' },
        session_epoch: 27, snapshot_generation: 42, received_at: 1000 };
    const store = { async nodes(_tx: object, _scope: string, _principal: unknown, _paging: unknown, _filters: unknown,
        project: (value: {count: {n: number}; records: ReadNodeRow[]}) => unknown) {
        return project({ count: { n: 1 }, records: [row] });
    } } as unknown as ManagementReadStore<object>;
    const read = new ConsoleReadModels(store, { read<T>(value: unknown) { return value as T; },
        now: () => 1000, iso: String, currentIso: () => '1000' });
    const result = await read.nodes({}, 'scope', { actorId: 'bob', governance: false }, { page: 1, limit: 25, offset: 0 }, {});
    assert.deepEqual(result.items[0], { id: 'shared', revoked: false, credentialUntil: null, readDetail: 'shared',
        resourceSource:'admin-shared',ownerActorId:null,allowedRoles:['transit'],canUse:false,
        policy: { capabilities: ['tcp'], allowedListenerAddresses: ['0.0.0.0'], allowedPorts: [1000] },
        sessionEpoch: 0, snapshotGeneration: 0, lastReportAt: null });
    row.read_detail = undefined as unknown as ReadNodeRow['read_detail'];
    await assert.rejects(read.nodes({}, 'scope', { actorId: 'bob', governance: false }, { page: 1, limit: 25, offset: 0 }, {}),
        { code: 'INTEGRITY_FAILURE' });
});

test('MySQL count/page pairs carry the same caller predicate and bindings before pagination', async () => {
    const calls: { sql: string; args: unknown[] }[] = [];
    const tx = { async execute(sql: string, args: unknown[]) {
        calls.push({ sql, args }); return [sql.includes('COUNT(*)') ? [{ n: 0 }] : [], []];
    } } as unknown as Transaction;
    const store = new MySqlManagementReadStore({ now: () => 1000, validateFilters: () => undefined });
    const principal = { actorId: 'alice', governance: false }, paging = { page: 2, limit: 25, offset: 25 };
    for (const kind of ['nodes', 'forwards', 'operations'] as const) {
        calls.length = 0;
        await store[kind](tx, 'scope', principal, paging, {}, page => page.records);
        assert.equal(calls.length, 2);
        const count = calls[0]!, page = calls[1]!;
        assert.equal(count.sql.split(' WHERE ').at(-1), page.sql.split(' WHERE ').at(-1)?.split(' ORDER BY ')[0]);
        assert.deepEqual(page.args.slice(-count.args.length), count.args);
        assert.ok(count.args.includes('alice'));
        assert.ok(!count.sql.includes(' LIMIT '));
    }
    for (const store of [new MySqlProfileReferenceReadStore(), new MySqlTunnelMetadataReadStore()]) {
        calls.length = 0;
        if (store instanceof MySqlProfileReferenceReadStore)
            await store.references(tx, 'scope', principal, 'profile', paging, undefined, page => page.records);
        else await store.references(tx, 'scope', principal, 'node', paging, page => page.records);
        assert.ok(calls[0]!.sql.includes('owner_actor_id=?'));
        assert.deepEqual(calls[0]!.args, calls[1]!.args);
        assert.equal(calls[0]!.args[0], 'alice');
    }
});
