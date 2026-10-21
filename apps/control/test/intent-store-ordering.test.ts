import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import { IdempotencyHost } from '../src/framework/idempotency.ts';
import type { IdempotencyStore, StoredIdempotency, StoredValues, ForwardIntentStore } from '../src/framework/intent-store-ports.ts';
import { ForwardStateService } from '../src/modules/forward-owner/service.ts';

const tx = Object.freeze({ transaction: Symbol('supplied') });
const values: StoredValues = { read: <T>(v: unknown) => v as T, encode: JSON.stringify };
function idempotency(record: StoredIdempotency) {
    const events: string[] = [];
    const request = { scopeId: 'scope', actorId: 'actor', key: 'original', digest: 'digest' };
    const hooks = { ensure: () => {}, lock: () => {} };
    const store: IdempotencyStore<typeof tx> = {
        quarantine: async current => { assert.equal(current, tx); events.push('quarantine'); },
        ensure: async (current, key, digest) => {
            assert.equal(current, tx); assert.deepEqual(key, { scopeId: 'scope', actorId: 'actor', key: 'original' });
            assert.equal(digest, 'digest'); events.push('ensure'); hooks.ensure();
        },
        currentForUpdate: async (current, key) => {
            assert.equal(current, tx); assert.deepEqual(key, { scopeId: 'scope', actorId: 'actor', key: 'original' });
            events.push('lock'); hooks.lock(); return record;
        },
        respond: async () => { throw new Error('unexpected response write'); },
    };
    return { request, hooks, events, store };
}

test('idempotency snapshots keys before ensure but compares the live digest after the row lock', async () => {
    const f = idempotency({ request_digest: 'later', http_status: null, response: null, recovery_invalidated: 0 });
    f.hooks.ensure = () => { f.request.scopeId = 'changed'; f.request.actorId = 'changed'; f.request.key = 'changed'; };
    f.hooks.lock = () => { f.request.digest = 'later'; };
    assert.equal(await new IdempotencyHost(f.store, values).claim(tx, f.request), undefined);
    assert.deepEqual(f.events, ['ensure', 'lock']);
});

test('recovery-invalidated idempotency refuses before digest conflict or stored response decoding', async () => {
    const f = idempotency({ request_digest: 'conflicting', http_status: 202, response: 'malformed', recovery_invalidated: 1 });
    let decoded = 0;
    const host = new IdempotencyHost(f.store, { ...values, read: () => { decoded++; throw new Error('decode'); } });
    await assert.rejects(host.claim(tx, f.request), { code: 'RECOVERY_REPLAY_REQUIRES_REVIEW', status: 409 });
    assert.equal(decoded, 0); assert.deepEqual(f.events, ['ensure', 'lock']);
});

test('pending idempotency never decodes response and completed replay preserves body identity and decoder failure', async () => {
    const record = { request_digest: 'digest', http_status: null as number | null, response: { nested: [] }, recovery_invalidated: 0 };
    const f = idempotency(record), sentinel = new Error('native decoder'), body = { retained: true };
    let decoded = 0, fail = false;
    const host = new IdempotencyHost(f.store, { ...values, read: <T>(input: unknown) => {
        assert.equal(input, record.response); decoded++; if (fail) throw sentinel; return body as T;
    } });
    assert.equal(await host.claim(tx, f.request), undefined); assert.equal(decoded, 0);
    record.http_status = 202;
    const replay = await host.claim(tx, f.request); assert.equal(replay?.status, 202); assert.equal(replay?.body, body);
    fail = true; await assert.rejects(host.claim(tx, f.request), error => error === sentinel);
});

test('idempotency response samples status and encodes body before reading request keys', async () => {
    const events: string[] = [], request = {
        get scopeId() { events.push('scope'); return 'scope'; },
        get actorId() { events.push('actor'); return 'actor'; },
        get key() { events.push('key'); return 'key'; }, digest: 'digest',
    };
    const base = idempotency({ request_digest: '', http_status: null, response: null, recovery_invalidated: 0 });
    base.store.respond = async (current, status, encoded, key) => {
        assert.equal(current, tx); assert.equal(status, 202); assert.equal(encoded, 'encoded');
        assert.deepEqual(key, { scopeId: 'scope', actorId: 'actor', key: 'key' }); events.push('write');
    };
    const host = new IdempotencyHost(base.store, { ...values, encode: body => {
        assert.equal(body, 'body'); events.push('encode'); return 'encoded';
    } });
    await host.respond(tx, request, { get status() { events.push('status'); return 202 as const; }, body: 'body' });
    assert.deepEqual(events, ['status', 'encode', 'scope', 'actor', 'key', 'write']);
});

function forwardFixture() {
    const forward: Forward = { id: 'forward', scopeId: 'scope', revision: 1, spec: {
        enabled: true, protocols: ['tcp'], ingress: { nodeId: 'node', listen: { address: '127.0.0.1', port: 32001 } },
        target: { host: '127.0.0.1', port: 80 },
    } };
    const calls: unknown[][] = [], hooks = { current: () => {}, replacement: () => {} }, outcome = { changed: 1 };
    const unsupported = async (): Promise<never> => { throw new Error('unexpected store call'); };
    const store: ForwardIntentStore<typeof tx> = {
        revisions: unsupported, quarantine: unsupported, liveProfileCount: unsupported, liveNodeCount: unsupported,
        forNode: unsupported, forReferencedNode: unsupported, forProfileActor: unsupported, authorizer: unsupported,
        classifyOwner: unsupported, auditOwnership: unsupported, setAuthorizer: unsupported, forActor: unsupported, get: unsupported, currentForUpdate: unsupported, record: unsupported,
        insertCurrent: async (...args) => { assert.equal(args[0], tx); calls.push(['current', ...args.slice(1)]); hooks.current(); },
        insertRevision: async (...args) => { assert.equal(args[0], tx); calls.push(['revision', ...args.slice(1)]); },
        replaceCurrent: async (...args) => { assert.equal(args[0], tx); calls.push(['replace', ...args.slice(1)]); hooks.replacement(); return outcome.changed; },
        markDeleting: async (...args) => { assert.equal(args[0], tx); calls.push(['delete', ...args.slice(1)]); return outcome.changed; },
    };
    return { forward, calls, hooks, outcome, store, host: new ForwardStateService({ store, values }) };
}

test('Forward insert encodes again after the current-row await rather than caching mutable spec bytes', async () => {
    const f = forwardFixture(); f.hooks.current = () => { (f.forward.spec.target as { port: number }).port = 81; };
    await f.host.insert(tx, f.forward, 'actor');
    assert.equal(f.calls[0]![0], 'current'); assert.equal(f.calls[1]![0], 'revision');
    assert.equal(JSON.parse(f.calls[0]![4] as string).target.port, 80);
    assert.equal(JSON.parse(f.calls[1]![3] as string).target.port, 81);
});

test('Forward replacement encodes after CAS await and refuses zero or multiple affected rows before history', async () => {
    const f = forwardFixture(), next = { ...structuredClone(f.forward), revision: 2 };
    f.hooks.replacement = () => { (next.spec.target as { port: number }).port = 82; };
    await f.host.replace(tx, f.forward, next);
    assert.equal(JSON.parse(f.calls[0]![2] as string).target.port, 80);
    assert.equal(JSON.parse(f.calls[1]![3] as string).target.port, 82);
    for (const changed of [0, 2]) {
        const denied = forwardFixture(); denied.outcome.changed = changed;
        await assert.rejects(denied.host.replace(tx, denied.forward, next), { code: 'REVISION_CONFLICT' });
        assert.equal(denied.calls.length, 1);
        await assert.rejects(denied.host.markDeleting(tx, denied.forward, 2), { code: 'REVISION_CONFLICT' });
        assert.equal(denied.calls.length, 2);
    }
});

test('Forward storage failure preserves identity and prevents the subsequent immutable revision write', async () => {
    const f = forwardFixture(), sentinel = new Error('write failed');
    f.hooks.current = () => { throw sentinel; };
    await assert.rejects(f.host.insert(tx, f.forward, 'actor'), error => error === sentinel);
    assert.equal(f.calls.length, 1);
});
