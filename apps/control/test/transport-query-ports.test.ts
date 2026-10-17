import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NativeDrivers } from '../src/application/native-drivers.ts';
import { TransportQueries } from '../src/application/transport-queries.ts';
import type { ProfileReference, ProfileReferenceQuery, TransportReferenceReader } from '../src/application/transport-queries.ts';
import type { ScopeAuthorization, TransactionBoundary } from '../src/application/ports.ts';
import type { TransportProfileResolver } from '../src/modules/transport-ports.ts';
import { transportReferenceQuery } from '../src/api/transport-query.ts';

type Tx = { id: symbol };
function fixture() {
    const tx = Object.freeze({ id: Symbol('tx') }), events: string[] = [];
    const options = { deny: false, profile: true, grant: true, limit: 2, corrupt: false, delay: undefined as (() => Promise<void>) | undefined };
    const items: ProfileReference[] = [1, 2].map(revision => ({ forwardId: 'f-' + revision, revision: 7, configRevision: revision, recoverySuspended: false,
        spec: { enabled: true, protocols: ['tcp'], ingress: { nodeId: 'n1', listen: { address: '127.0.0.1', port: 32001 } },
            target: { host: '127.0.0.1', port: 80 }, path: { via: ['n2'] }, transport: { profileId: 'p1', configRevision: revision } } }));
    const db: TransactionBoundary<Tx> = { transaction: async action => { events.push('begin'); const value = await action(tx); events.push('commit'); return value; } };
    const identity: ScopeAuthorization<Tx> = { scope: async (current, actor, scope, manage) => {
        assert.equal(current, tx); assert.equal(actor, 'actor'); assert.equal(scope, 'scope'); events.push(manage ? 'manage' : 'read');
        await options.delay?.(); if (options.deny) throw Error('denied');
    } };
    const read: TransportReferenceReader<Tx> = {
        profile: async (current, scope, profile) => { assert.equal(current, tx); assert.equal(scope, 'scope'); assert.equal(profile, 'p1'); events.push('profile'); return options.profile ? { currentRevision: 2 } : null; },
        references: async (current, scope, profile, paging, revision) => {
            assert.equal(current, tx); assert.equal(scope, 'scope'); assert.equal(profile, 'p1'); assert.ok(Object.isFrozen(paging)); events.push('references:' + revision);
            const selected = revision ? items.filter(i => i.configRevision === revision) : items;
            return { total: selected.length, items: options.corrupt ? [{ ...items[0]!, configRevision: 3 }] : selected.slice(0, options.limit) };
        }
    };
    const resolver: TransportProfileResolver<Tx> = { resolve: async (current, actor, scope, profile, revision) => {
        assert.equal(current, tx); assert.equal(actor, 'actor'); assert.equal(scope, 'scope'); assert.equal(profile, 'p1');
        events.push('resolve:' + revision); if (!options.grant) throw Error('missing explicit Profile Grant');
        return { profileId: profile, revision, configDigest: 'sha256:' + 'a'.repeat(64), config: {} as never };
    } };
    return { queries: new TransportQueries(db, identity, read, resolver), db, identity, events, options, items };
}

test('native catalog needs current scope access and separates process gates from Node proof or authorization', async () => {
    const f = fixture();
    const defaultView = await new NativeDrivers(f.db, f.identity).list('actor', 'scope');
    assert.deepEqual(f.events, ['begin', 'read', 'commit']);
    assert.equal(defaultView.drivers[2]!.controlEnabled, false); assert.equal(defaultView.authorized, false);
    assert.equal(defaultView.nodeEvidence, 'not-included'); assert.equal(defaultView.platformAcceptance, 'not-inferred');
    assert.equal((await new NativeDrivers(f.db, f.identity, true, true).list('actor', 'scope')).drivers[2]!.controlEnabled, true);
    f.options.deny = true; await assert.rejects(new NativeDrivers(f.db, f.identity).list('actor', 'scope'), /denied/);
});

test('reference listing is authorized first in the same transaction and does not require an execution grant', async () => {
    const f = fixture(); f.options.grant = false;
    const response = await f.queries.references('actor', 'scope', 'p1');
    assert.deepEqual(f.events, ['begin', 'read', 'profile', 'references:undefined', 'commit']);
    assert.equal(response.total, 2); assert.equal(response.target, null); assert.equal(response.fullPlanAuthorization, false);
    assert.ok(response.items.every(i => i.proposedSpec === null && i.changed === null));
    assert.ok(Object.isFrozen(response.items[0]!.spec));
});

test('impact preview requires manager and exact Profile revision grant but never mutates the source or authorizes deployment', async () => {
    const f = fixture(), before = structuredClone(f.items);
    const result = await f.queries.references('actor', 'scope', 'p1', { targetRevision: 2 });
    assert.deepEqual(f.events, ['begin', 'manage', 'profile', 'resolve:2', 'references:undefined', 'commit']);
    assert.deepEqual(result.items.map(i => i.changed), [true, false]); assert.equal(result.items[0]!.expectedRevision, 7);
    assert.equal(result.items[0]!.proposedSpec!.transport!.configRevision, 2); assert.equal(result.reserved, false);
    assert.equal(result.fullPlanAuthorization, false); assert.deepEqual(f.items, before);
    f.options.grant = false; await assert.rejects(f.queries.references('actor', 'scope', 'p1', { targetRevision: 2 }), /explicit Profile Grant/);
});

test('scope denial and invisible Profiles stop before projection/resolution', async () => {
    const f = fixture(); f.options.deny = true;
    await assert.rejects(f.queries.references('actor', 'scope', 'p1', { targetRevision: 2 }), /denied/);
    assert.deepEqual(f.events, ['begin', 'manage']); f.events.length = 0; f.options.deny = false; f.options.profile = false;
    await assert.rejects(f.queries.references('actor', 'scope', 'p1'), /not found/);
    assert.deepEqual(f.events, ['begin', 'read', 'profile']);
});

test('query parameters are closed, bounded and canonical before any transaction', async () => {
    const f = fixture();
    for (const input of [{ page: '0' }, { limit: '101' }, { revision: 0 }, { targetRevision: 1.2 }, { targetRevision: '2' },
        { page: 1 }, { limit: 25 }, { all: true }, new Date()])
        await assert.rejects(f.queries.references('actor', 'scope', 'p1', input as ProfileReferenceQuery));
    assert.deepEqual(f.events, []);
    assert.deepEqual(transportReferenceQuery(new URLSearchParams('page=2&limit=1&revision=1&targetRevision=2')),
        { page: '2', limit: '1', revision: 1, targetRevision: 2 });
    for (const raw of ['revision=', 'revision=01', 'revision=1&revision=2', 'limit=0', 'targetRevision=9007199254740992', 'target=arbitrary', 'page=2e0'])
        assert.throws(() => transportReferenceQuery(new URLSearchParams(raw)), raw);
});

test('owned query survives caller mutation across authorization and stale pages never widen the revision filter', async () => {
    const f = fixture(); let release!: () => void;
    f.options.delay = () => new Promise<void>(resolve => { release = resolve; });
    const input = { targetRevision: 2, revision: 1, page: '1', limit: '25' };
    const pending = f.queries.references('actor', 'scope', 'p1', input);
    input.targetRevision = 1; input.revision = 2; release(); const value = await pending;
    assert.equal(value.target!.revision, 2); assert.equal(value.items.length, 1); assert.equal(value.items[0]!.configRevision, 1);
});

test('malformed persisted reference fails closed instead of suggesting an update to another Profile', async () => {
    const f = fixture(); f.options.corrupt = true;
    await assert.rejects(f.queries.references('actor', 'scope', 'p1', { targetRevision: 2 }), /persisted Profile reference/);
});
