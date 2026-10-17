import assert from 'node:assert/strict';
import { test } from 'node:test';
import { digest } from '@tunex/contracts';
import { PathTemplateCommands, PathTemplateQueries } from '../src/application/path-templates.ts';
import { ControlError } from '../src/application/errors.ts';
import type { IdempotentRequests, RequestIdentity } from '../src/application/ports.ts';
import { parsePathTemplate, pathRequirements } from '../src/modules/path-template-contract.ts';
import { NativePathReferences } from '../src/modules/native-path-references.ts';
import type { PathTemplateConfig } from '../src/modules/path-template-contract.ts';
import type { PathTemplateHead, PathTemplateRevision, PathTemplateWriter } from '../src/modules/path-template-ports.ts';
import { pathTemplateListQuery, pathTemplateRevisionQuery } from '../src/api/path-template-query.ts';

const config = () => ({ version: 1, protocols: ['udp', 'tcp'], nodes: ['ingress', 'transit', 'egress'],
    endpoints: [{ nodeId: 'transit', revision: 1 }, { nodeId: 'egress', revision: 2 }], transport: { profileId: 'profile', configRevision: 3 } });
const profileDigest = 'sha256:' + 'a'.repeat(64);
type Tx = { label: string };
function fixture() {
    const tx: Tx = { label: 'same-transaction' }, calls: string[] = [];
    let heads = new Map<string, PathTemplateHead>(), revisions = new Map<string, PathTemplateRevision>(), events: string[] = [];
    let replies = new Map<string, { digest: string; response?: { status: 200 | 202; body: unknown } }>();
    const scopeKey = (scope: string, id: string) => scope + '/' + id;
    const check = (value: Tx) => assert.equal(value, tx);
    const db = { async transaction<T>(action: (value: Tx) => Promise<T>) {
        const before = structuredClone({ heads, revisions, events, replies });
        try { return await action(tx); } catch (error) { ({ heads, revisions, events, replies } = before); throw error; }
    } };
    const auth = { async scope(value: Tx, actor: string, scope: string, manage = false) {
        check(value); calls.push('auth:' + manage);
        if (scope !== 'scope' || actor === 'outside' || manage && actor === 'viewer') throw new ControlError('AUTHORIZATION_DENIED', 403, 'Denied');
    } };
    const requests: IdempotentRequests<Tx> = {
        async claim<R>(value: Tx, request: RequestIdentity) {
            check(value); calls.push('claim'); const key = request.actorId + '/' + request.key, old = replies.get(key);
            if (old && old.digest !== request.digest) throw new ControlError('IDEMPOTENCY_CONFLICT', 409, 'Different request');
            if (!old) replies.set(key, { digest: request.digest });
            return old?.response as R | undefined;
        },
        async respond(value, request, response) { check(value); calls.push('respond'); replies.get(request.actorId + '/' + request.key)!.response = structuredClone(response); }
    };
    const store: PathTemplateWriter<Tx> = {
        async lockScope(value) { check(value); calls.push('scope-lock'); },
        async count(value, scope) { check(value); return [...heads.keys()].filter(key => key.startsWith(scope + '/')).length; },
        async head(value, scope, id) { check(value); return structuredClone(heads.get(scopeKey(scope, id)) ?? null); },
        async revision(value, scope, id, number) { check(value); return structuredClone(revisions.get(scopeKey(scope, id) + '/' + number) ?? null); },
        async list(value, scope, paging, prefix) {
            check(value); const items = [...heads.entries()].filter(([key, head]) => key.startsWith(scope + '/') && head.templateId.startsWith(prefix)).map(([, head]) => structuredClone(head));
            return { total: items.length, items: items.slice(paging.offset, paging.offset + paging.limit) };
        },
        async publish(value, scope, id, record) {
            check(value); calls.push('publish'); heads.set(scopeKey(scope, id), { templateId: id, currentRevision: record.revision, archived: false });
            assert.ok(!revisions.has(scopeKey(scope, id) + '/' + record.revision)); revisions.set(scopeKey(scope, id) + '/' + record.revision, structuredClone(record));
        },
        async archive(value, scope, id) { check(value); calls.push('archive'); heads.get(scopeKey(scope, id))!.archived = true; },
        async audit(value, _scope, _id, _actor, _revision, kind) { check(value); calls.push('audit'); events.push(kind); }
    };
    const references = { async validate(value: Tx, _actor: string, _scope: string, input: PathTemplateConfig) {
        check(value); calls.push('references'); assert.equal(Object.isFrozen(input.nodes), true); return { profileDigest };
    } };
    return { db, auth, requests, store, references, calls,
        commands: new PathTemplateCommands(db, auth, requests, store, references, () => 1800000000000),
        queries: new PathTemplateQueries(db, auth, store),
        state: () => ({ heads, revisions, events, replies }) };
}

test('native template parser is closed, bounded, ordered and detached, with computed native requirements', () => {
    const input = config(), parsed = parsePathTemplate(input); input.nodes.reverse(); input.endpoints[0]!.revision = 88;
    assert.deepEqual(parsed.nodes, ['ingress', 'transit', 'egress']); assert.equal(parsed.endpoints[0]!.revision, 1);
    assert.deepEqual(parsed.protocols, ['tcp', 'udp']); assert.equal(Object.isFrozen(parsed.endpoints[0]), true);
    assert.ok(pathRequirements(parsed).includes('native.multihop.v1'));
    for (const mutation of [
        (c: any) => { c.extra = true; }, (c: any) => { c.nodes[2] = 'ingress'; }, (c: any) => { c.nodes = ['ingress']; },
        (c: any) => { c.nodes = Array.from({ length: 9 }, (_, i) => 'n' + i); }, (c: any) => { c.protocols = ['tcp', 'tcp']; },
        (c: any) => { c.endpoints.reverse(); }, (c: any) => { c.endpoints[0].revision = 0; }, (c: any) => { c.transport.latest = true; },
        (c: any) => { c.transport.configRevision = 1.1; }, (c: any) => { c.nodes[0] = 'in/gress'; }
    ]) { const value = config(); mutation(value); assert.throws(() => parsePathTemplate(value)); }
    const eight = config(); eight.nodes = Array.from({ length: 8 }, (_, i) => 'n' + i); eight.endpoints = eight.nodes.slice(1).map(nodeId => ({ nodeId, revision: 1 }));
    assert.equal(parsePathTemplate(eight).nodes.length, 8);
});

test('publication uses one authorization/owner transaction and preserves immutable versions, deduplication and audit', async () => {
    const f = fixture(), first = await f.commands.publish('manager', 'scope', 'saved', 'create', 0, config());
    assert.equal(first.status, 202); assert.equal(first.body.revision, 1);
    assert.deepEqual(f.calls, ['auth:true', 'claim', 'scope-lock', 'references', 'publish', 'audit', 'respond']);
    const before = structuredClone(f.state()); assert.deepEqual(await f.commands.publish('manager', 'scope', 'saved', 'create', 0, config()), first);
    assert.deepEqual(f.state(), before);
    assert.equal((await f.commands.publish('manager', 'scope', 'saved', 'same', 1, config())).status, 200);
    const next = config(); next.protocols = ['tcp']; const second = await f.commands.publish('manager', 'scope', 'saved', 'next', 1, next);
    assert.equal(second.body.revision, 2); assert.notEqual(second.body.configDigest, first.body.configDigest);
    const old = await f.queries.get('viewer', 'scope', 'saved', 1), current = await f.queries.get('viewer', 'scope', 'saved');
    assert.deepEqual(old.config.protocols, ['tcp', 'udp']); assert.deepEqual(current.config.protocols, ['tcp']);
    assert.equal(old.currentRevision, 2); assert.equal(old.executionAuthorized, false); assert.equal(old.bindingCreated, false);
    assert.deepEqual(f.state().events, ['publish', 'publish']);
});

test('scope denial precedes idempotency, reads and owner side effects; stale CAS and keys cannot mutate metadata', async () => {
    const f = fixture(); await assert.rejects(f.commands.publish('viewer', 'scope', 'saved', 'denied', 0, config()));
    assert.deepEqual(f.calls, ['auth:true']); assert.equal(f.state().heads.size, 0);
    await assert.rejects(f.queries.get('outside', 'scope', 'saved'));
    await f.commands.publish('manager', 'scope', 'saved', 'first', 0, config()); const before = structuredClone(f.state());
    await assert.rejects(f.commands.publish('manager', 'scope', 'saved', 'stale', 0, config()), /conflict/);
    const next = config(); next.protocols = ['tcp']; await assert.rejects(f.commands.publish('manager', 'scope', 'saved', 'first', 1, next), /Different/);
    assert.deepEqual(f.state(), before);
});

test('archival is terminal, keeps immutable history and does not require or create new execution authority', async () => {
    const f = fixture(); await f.commands.publish('manager', 'scope', 'saved', 'first', 0, config()); f.calls.length = 0;
    const result = await f.commands.archive('manager', 'scope', 'saved', 'archive', 1);
    assert.equal(result.body.archived, true); assert.equal(result.body.revision, 1); assert.ok(!f.calls.includes('references'));
    assert.deepEqual(await f.commands.archive('manager', 'scope', 'saved', 'archive', 1), result);
    assert.equal((await f.commands.archive('manager', 'scope', 'saved', 'archive-again', 1)).body.changed, false);
    await assert.rejects(f.commands.publish('manager', 'scope', 'saved', 'reuse', 1, config()), /cannot be reused/);
    assert.equal((await f.queries.get('viewer', 'scope', 'saved', 1)).archived, true);
    assert.deepEqual(f.state().events, ['publish', 'archive']);
});

test('quota, reference denial and audit failure roll back head, immutable version, event and idempotent response together', async () => {
    const f = fixture(); f.store.count = async () => 128;
    await assert.rejects(f.commands.publish('manager', 'scope', 'saved', 'quota', 0, config()), /limit/);
    assert.equal(f.state().heads.size, 0); assert.equal(f.state().replies.size, 0);
    f.store.count = async () => 0;
    f.references.validate = async () => { throw new ControlError('AUTHORIZATION_DENIED', 403, 'Grant revoked'); };
    await assert.rejects(f.commands.publish('manager', 'scope', 'saved', 'revoked', 0, config()), /revoked/);
    assert.equal(f.state().heads.size, 0); assert.equal(f.state().replies.size, 0);
    f.references.validate = async () => ({ profileDigest }); f.store.audit = async () => { throw Error('audit failed'); };
    await assert.rejects(f.commands.publish('manager', 'scope', 'saved', 'audit', 0, config()), /audit failed/);
    assert.equal(f.state().heads.size, 0); assert.equal(f.state().revisions.size, 0); assert.equal(f.state().replies.size, 0);
});

test('revision ceiling permits authorized no-op and archival, but cannot overwrite the last version', async () => {
    const f = fixture(), parsed = parsePathTemplate(config());
    f.state().heads.set('scope/saved', { templateId: 'saved', currentRevision: 64, archived: false });
    f.state().revisions.set('scope/saved/64', { revision: 64, config: parsed, profileDigest,
        configDigest: digest({ config: parsed, profileDigest }), createdBy: 'manager', createdAt: 1800000000000 });
    assert.equal((await f.commands.publish('manager', 'scope', 'saved', 'same', 64, config())).body.changed, false);
    const next = config(); next.protocols = ['tcp']; await assert.rejects(f.commands.publish('manager', 'scope', 'saved', 'overflow', 64, next), /limit/);
    assert.equal((await f.commands.archive('manager', 'scope', 'saved', 'archive', 64)).body.archived, true);
    assert.equal(f.state().revisions.size, 1);
});

test('reads detect stored corruption, detach pagination and retain archived rows without checking execution grants', async () => {
    const f = fixture(); await f.commands.publish('manager', 'scope', 'saved', 'first', 0, config());
    const page = await f.queries.list('viewer', 'scope', { page: '1', limit: '1', prefix: 'sav' });
    assert.equal(page.items.length, 1); assert.equal(Object.isFrozen(page.items[0]), true);
    f.state().revisions.get('scope/saved/1')!.configDigest = 'sha256:' + 'b'.repeat(64);
    await assert.rejects(f.queries.get('viewer', 'scope', 'saved'), /Invalid persisted/);
    for (const input of [{ page: '01' }, { page: 1 }, { prefix: '%' }, { limit: '101' }, { extra: true }])
        await assert.rejects(f.queries.list('viewer', 'scope', input as any));
    assert.throws(() => pathTemplateListQuery(new URLSearchParams('page=1&page=2')));
    for (const query of ['revision=1&revision=2', 'revision=01', 'revision=0', 'current=1', 'revision=1e2'])
        assert.throws(() => pathTemplateRevisionQuery(new URLSearchParams(query)));
});

test('native authoring adapter checks sorted Node grants/capabilities, locked Profile and every current Endpoint in the supplied transaction', async () => {
    const calls: string[] = [], tx: Tx = { label: 'tx' }, parsed = parsePathTemplate(config());
    let endpointRevision = 1, denied = false, missingCapability = false, profileProtocol: 'tcp' | 'udp' | null = null;
    const adapter = new NativePathReferences<Tx>({ async authorizedRelayNode(value, _actor, scope, id) {
        assert.equal(value, tx); calls.push('node:' + id); if (denied) throw new ControlError('AUTHORIZATION_DENIED', 403, 'No implicit owner grant');
        return { nodeId: id, scopeId: scope, capabilities: missingCapability ? ['adp.3', 'tcp', 'udp'] : pathRequirements(parsed), allowedListenerAddresses: [], allowedPorts: [],
            allowedDestinationCidrs: [], allowMetadataTargets: false, egressPolicyRevision: 1 };
    } }, { async resolve(value, _actor, _scope, profileId, revision) {
        assert.equal(value, tx); calls.push('profile'); return { profileId, revision, configDigest: profileDigest,
            config: { driver: 'native.relay.v1', wireVersion: 1, security: 'mutual-tls13', protocols: profileProtocol ? [profileProtocol] : ['tcp', 'udp'],
                handshakeTimeoutSeconds: 5, idleTimeoutSeconds: 60, maxFrameBytes: 1024, maxUdpDatagramBytes: 1024, maxConnectionsPerNode: 8 } };
    } }, { async resolve(value, nodeId) {
        assert.equal(value, tx); calls.push('endpoint:' + nodeId); return { nodeId, revision: nodeId === 'transit' ? endpointRevision : 2,
            config: { listenAddress: '127.0.0.1', advertisedHost: '127.0.0.1', allowedTcpPorts: [32001] } };
    } });
    assert.deepEqual(await adapter.validate(tx, 'manager', 'scope', parsed), { profileDigest });
    assert.deepEqual(calls, ['node:egress', 'node:ingress', 'node:transit', 'profile', 'endpoint:egress', 'endpoint:transit']);
    endpointRevision = 2; await assert.rejects(adapter.validate(tx, 'manager', 'scope', parsed), /Endpoint revision/);
    endpointRevision = 1; missingCapability = true; await assert.rejects(adapter.validate(tx, 'manager', 'scope', parsed), /required native capabilities/);
    missingCapability = false; profileProtocol = 'tcp'; await assert.rejects(adapter.validate(tx, 'manager', 'scope', parsed), /business protocols differ/);
    profileProtocol = null;
    denied = true; await assert.rejects(adapter.validate(tx, 'owner', 'scope', parsed), /No implicit owner grant/);
});
