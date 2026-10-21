import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TunnelQueries } from '../src/application/tunnel-queries.ts';
import type { TunnelNodeRecord, TunnelPeerRecord, TunnelReference, TunnelReadPort, TunnelPaging } from '../src/application/tunnel-queries.ts';
import type { ResourceReadAccess, ReadPrincipal, TransactionBoundary, ScopeAuthorization } from '../src/framework/public.ts';
import { tunnelReferenceQuery } from '../src/api/tunnel-query.ts';

function fixture() {
    const tx = Symbol('read-tx'), events: string[] = [], now = 1800000000000;
    const node: TunnelNodeRecord = { nodeId: 'node-a', revoked: false, credentialUntil: now + 10000,
        capabilities: ['adp.3', 'native.relay.v1'], sessionEpoch: 2, snapshotGeneration: 3, lastReportAt: now - 1000 };
    const endpoint = { revision: 2, config: { listenAddress: '127.0.0.1', advertisedHost: '127.0.0.1', allowedTcpPorts: [32002, 32001] } };
    const peers: { total: number; windowCount: number; items: TunnelPeerRecord[] } = { total: 9, windowCount: 1,
        items: [{ fingerprint: 'a'.repeat(64), issuedAt: now - 1000, validUntil: now + 20000, retireAfter: now + 5000, revoked: false }] };
    const references: TunnelReference[] = [0, 1, 2].map(index => ({ forwardId: 'rule-' + index, revision: 7,
        recoverySuspended: index === 1, spec: { enabled: index !== 0, protocols: ['tcp', 'udp'],
            ingress: { nodeId: index === 0 ? 'node-a' : 'ingress', listen: { address: '127.0.0.1', port: 30001 } },
            path: { via: index === 0 ? ['egress'] : index === 1 ? ['node-a', 'egress'] : ['transit', 'node-a'] },
            target: { host: '127.0.0.1', port: 80 }, transport: { profileId: 'p1', configRevision: 2 } } }));
    const options = { denied: false, missing: false, missingEndpoint: false, resourceDenied: false, delay: undefined as (() => Promise<void>) | undefined };
    const db: TransactionBoundary<symbol> = { transaction: async action => { events.push('begin'); const result = await action(tx); events.push('commit'); return result; } };
    const identity: ScopeAuthorization<symbol> = { scope: async (current, actor, scope, manage) => {
        assert.equal(current, tx); assert.equal(actor, 'actor'); assert.equal(scope, 'scope'); assert.notEqual(manage, true);
        events.push('scope'); await options.delay?.(); if (options.denied) throw Error('denied');
    } };
    const principal: ReadPrincipal = Object.freeze({ actorId: 'actor', governance: false });
    const access: ResourceReadAccess<symbol> = {
        principal: async (current, actor, scope) => {
            assert.equal(current, tx); assert.deepEqual([actor, scope], ['actor', 'scope']); events.push('principal'); return principal;
        },
        node: async (current, actor, scope, requested, detail) => {
            assert.equal(current, tx); assert.deepEqual([actor, scope, requested], ['actor', 'scope', 'node-a']);
            events.push('access:' + detail);
            if (options.resourceDenied) throw Object.assign(Error('not found'), { code: 'NOT_FOUND' });
            return 'full';
        },
        forward: async () => assert.fail('Tunnel references must filter ownership in their read provider'),
        owned: async () => assert.fail('Tunnel reads must not enter mutation ownership'),
    };
    const read: TunnelReadPort<symbol> = {
        node: async (current, scope, requested) => { assert.equal(current, tx); assert.equal(scope, 'scope'); assert.equal(requested, 'node-a'); events.push('node'); return options.missing ? null : node; },
        endpoint: async (current, requested) => { assert.equal(current, tx); assert.equal(requested, 'node-a'); events.push('endpoint'); return options.missingEndpoint ? null : endpoint; },
        peers: async (current, requested, time) => { assert.equal(current, tx); assert.equal(requested, 'node-a'); assert.equal(time, now); events.push('peers'); return peers; },
        references: async (current, scope, caller, requested, paging) => { assert.equal(current, tx); assert.equal(scope, 'scope'); assert.equal(requested, 'node-a');
            assert.equal(caller, principal); assert.ok(Object.isFrozen(paging)); events.push('references:' + paging.page + '/' + paging.limit); return { total: references.length, items: references.slice(0, paging.limit) }; },
    };
    return { queries: new TunnelQueries(db, identity, read, access, () => now), node, endpoint, peers, references, events, options, now };
}

test('tunnel metadata authorizes inside one transaction, bounds peer windows, and never claims execution or network health', async () => {
    const f = fixture(), result = await f.queries.status('actor', 'scope', 'node-a');
    assert.deepEqual(f.events, ['begin', 'scope', 'access:diagnostics', 'node', 'endpoint', 'peers', 'commit']);
    assert.equal(result.executionAuthorized, false); assert.equal(result.reserved, false); assert.equal(result.health, 'unknown');
    assert.equal(result.networkCheck, 'not-performed'); assert.equal(result.certificateVerification, 'not-performed-by-this-query');
    assert.equal(result.peerCredentials.total, 9); assert.equal(result.peerCredentials.limit, 4); assert.equal(result.peerCredentials.truncated, true);
    assert.equal(result.peerCredentials.items[0]!.recordedWindowOpen, true);
    assert.equal(result.peerCredentials.items[0]!.effectiveUntil, new Date(f.now + 5000).toISOString());
    assert.deepEqual(result.endpoint!.config.allowedTcpPorts, [32001, 32002]); assert.ok(Object.isFrozen(result.endpoint!.config));
    assert.deepEqual(f.endpoint.config.allowedTcpPorts, [32002, 32001], 'Projection must not mutate owner configuration');
    assert.equal(Object.hasOwn(result.peerCredentials.items[0]!, 'certificate'), false);
    assert.equal(Object.hasOwn(result.node, 'lastReport'), false);
});

test('revoked or expired Node/peer windows stay closed, and an absent Endpoint is metadata rather than fabricated readiness', async () => {
    for (const mode of ['node-revoked', 'machine-expired', 'machine-null', 'peer-revoked', 'peer-expired', 'peer-retired']) {
        const f = fixture(); f.options.missingEndpoint = true;
        if (mode === 'node-revoked') f.node.revoked = true;
        else if (mode === 'machine-expired') f.node.credentialUntil = f.now;
        else if (mode === 'machine-null') f.node.credentialUntil = null;
        else if (mode === 'peer-revoked') f.peers.items[0]!.revoked = true;
        else if (mode === 'peer-expired') f.peers.items[0]!.validUntil = f.now;
        else f.peers.items[0]!.retireAfter = f.now;
        const result = await f.queries.status('actor', 'scope', 'node-a');
        assert.equal(result.endpoint, null); assert.equal(result.peerCredentials.items[0]!.recordedWindowOpen, false);
        assert.equal(result.health, 'unknown');
    }
});

test('desired-rule references include disabled and recovery-suspended intent and derive exact ordered adjacency for all native roles', async () => {
    const f = fixture(), result = await f.queries.references('actor', 'scope', 'node-a');
    assert.deepEqual(f.events, ['begin', 'scope', 'access:basic', 'principal', 'node', 'references:1/25', 'commit']);
    assert.deepEqual(result.items.map(item => [item.role, item.previousNodeId, item.nextNodeId, item.endpointRequired]),
        [['ingress', null, 'egress', false], ['transit', 'ingress', 'egress', true], ['egress', 'transit', null, true]]);
    assert.equal(result.items[0]!.enabled, false); assert.equal(result.items[1]!.recoverySuspended, true);
    assert.equal(result.historicalReferencesIncluded, false); assert.equal(result.deletionSafety, 'not-proven');
    assert.equal(result.executionAuthorized, false); assert.equal(result.items[1]!.configRevision, 2);
    assert.equal(Object.hasOwn(result.items[0]!, 'target'), false); assert.ok(Object.isFrozen(result.items[0]!.path));
});

test('scope denial and a missing scoped Node stop before any endpoint, peer or reference disclosure', async () => {
    for (const method of ['status', 'references'] as const) {
        const denied = fixture(); denied.options.denied = true;
        await assert.rejects(denied.queries[method]('actor', 'scope', 'node-a'), /denied/);
        assert.deepEqual(denied.events, ['begin', 'scope']);
        const missing = fixture(); missing.options.missing = true;
        await assert.rejects(missing.queries[method]('actor', 'scope', 'node-a'), { code: 'NOT_FOUND' });
        assert.deepEqual(missing.events, method === 'status' ? ['begin', 'scope', 'access:diagnostics', 'node'] : ['begin', 'scope', 'access:basic', 'principal', 'node']);
    }
});

test('reference input is closed/canonical/bounded and detached before authorization awaits', async () => {
    const f = fixture();
    for (const input of [{ page: '0' }, { page: '10001' }, { limit: '101' }, { page: 2 }, { limit: 25 }, { target: 'any' }, [], new Date()])
        await assert.rejects(f.queries.references('actor', 'scope', 'node-a', input as TunnelPaging), { code: 'INVALID_CONFIG' });
    await assert.rejects(f.queries.status('actor', 'scope', '../node'), { code: 'INVALID_CONFIG' });
    assert.deepEqual(f.events, []);
    for (const raw of ['page=01', 'page=1&page=2', 'limit=0', 'limit=25&limit=25', 'node=foreign', 'revision=1', 'page=1e0'])
        assert.throws(() => tunnelReferenceQuery(new URLSearchParams(raw)), raw);
    assert.deepEqual(tunnelReferenceQuery(new URLSearchParams('page=2&limit=1')), { page: '2', limit: '1' });
    const query = { page: '2', limit: '1' }; f.options.delay = async () => { query.page = '1'; query.limit = '100'; };
    const result = await f.queries.references('actor', 'scope', 'node-a', query);
    assert.equal(result.page, 2); assert.equal(result.limit, 1); assert.equal(result.items.length, 1);
});

test('corrupt Node, Endpoint and credential metadata fail closed rather than emit partial authorization claims', async () => {
    const patches: ((f: ReturnType<typeof fixture>) => void)[] = [
        f => { f.node.nodeId = 'foreign'; }, f => { f.node.capabilities = ['duplicate', 'duplicate']; },
        f => { f.node.credentialUntil = Number.NaN; }, f => { f.node.sessionEpoch = -1; },
        f => { f.endpoint.revision = 0; }, f => { f.endpoint.config.allowedTcpPorts = []; },
        f => { f.peers.windowCount = 3; }, f => { f.peers.items[0]!.fingerprint = 'not-a-fingerprint'; },
        f => { f.peers.items[0]!.retireAfter = Number.POSITIVE_INFINITY; },
        f => { f.peers.items = Array(5).fill(f.peers.items[0]); },
    ];
    for (const patch of patches) { const f = fixture(); patch(f); await assert.rejects(f.queries.status('actor', 'scope', 'node-a'), { code: 'INTEGRITY_FAILURE' }); }
});

test('invalid, duplicate or unrelated desired references are rejected and do not become neighboring execution facts', async () => {
    for (const mode of ['duplicate', 'wrong-path', 'wrong-spec', 'wrong-revision']) {
        const f = fixture();
        if (mode === 'duplicate') f.references.push(f.references[0]!);
        else if (mode === 'wrong-path') f.references[0]!.spec = { ...f.references[0]!.spec, ingress: { nodeId: 'other', listen: { address: '127.0.0.1', port: 30001 } } };
        else if (mode === 'wrong-spec') f.references[0]!.spec = { ...f.references[0]!.spec, transport: undefined } as never;
        else f.references[0]!.revision = 0;
        await assert.rejects(f.queries.references('actor', 'scope', 'node-a'), { code: 'INTEGRITY_FAILURE' });
    }
});

test('resource refusal precedes persisted Node metadata and bounded reference disclosure', async () => {
    for (const method of ['status', 'references'] as const) {
        const f = fixture(); f.options.resourceDenied = true;
        await assert.rejects(f.queries[method]('actor', 'scope', 'node-a'), { code: 'NOT_FOUND' });
        assert.deepEqual(f.events, ['begin', 'scope', method === 'status' ? 'access:diagnostics' : 'access:basic']);
    }
});
