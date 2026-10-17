import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import { ForwardProbePlans } from '../src/application/forward-probe-plans.ts';
import { ControlError } from '../src/application/errors.ts';
import { compileDirect, compileSnapshot } from '../src/modules/runtime/planner.ts';
import type { AuthorizedNodeFacts } from '../src/modules/node-management-ports.ts';
import type { PublishedProbeSnapshot } from '../src/modules/probe-ports.ts';
import { MySqlProbeReader } from '../src/infrastructure/mysql-probe-read.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

const command = { version: 1, kind: 'tcp-connect', expectedRevision: 1 };
function fixture() {
    const tx = Object.freeze({ marker: Symbol('tx') }), calls: string[] = [];
    const forward: Forward & { deleting: boolean; recoverySuspended: boolean } = {
        id: 'forward-a', scopeId: 'scope-a', revision: 1, deleting: false, recoverySuspended: false,
        spec: { enabled: true, protocols: ['tcp'], ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 22001 } },
            target: { host: '127.0.0.1', port: 80 } },
    };
    const facts: AuthorizedNodeFacts = { nodeId: 'node-a', scopeId: 'scope-a',
        capabilities: ['adp.3', 'native.direct.v1', 'tcp', 'udp'], allowedListenerAddresses: ['127.0.0.1'],
        allowedPorts: [22001], egressPolicyRevision: 1, allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false };
    const now = Date.now();
    const current: PublishedProbeSnapshot = { bootId: 'boot-a', sessionEpoch: 2, credentialUntil: now + 60000,
        snapshot: compileSnapshot({ nodeId: 'node-a', sessionEpoch: 2, snapshotGeneration: 3,
            issuedAt: new Date(now).toISOString(), validUntil: new Date(now + 60000).toISOString(), tombstones: [],
            assignments: compileDirect(forward, facts, [{ nodeId: 'node-a', forwardId: 'forward-a', protocol: 'tcp',
                port: 22001, bindingFence: 4, deploymentGeneration: 5 }]) }) };
    const state = { forward, facts, current: structuredClone(current) as PublishedProbeSnapshot | undefined, denyNode: false, denyScope: false };
    const host = new ForwardProbePlans({
        transaction: async action => { calls.push('begin'); const result = await action(tx); calls.push('commit'); return result; },
    }, {
        scope: async (actual, actor, scope, manage) => {
            assert.equal(actual, tx); assert.equal(actor, 'actor-a'); assert.equal(scope, 'scope-a'); assert.equal(manage, true);
            calls.push('scope'); if (state.denyScope) throw new ControlError('AUTHORIZATION_DENIED', 403, 'denied');
        },
    }, {
        record: async (actual, scope, id) => {
            assert.equal(actual, tx); assert.equal(scope, 'scope-a'); assert.equal(id, 'forward-a');
            calls.push('intent'); return state.forward;
        },
    }, {
        authorized: async (actual, actor, intent) => {
            assert.equal(actual, tx); assert.equal(actor, 'actor-a'); assert.equal(intent.id, 'forward-a');
            calls.push('grant'); if (state.denyNode) throw new ControlError('AUTHORIZATION_DENIED', 403, 'denied');
            return state.facts;
        },
    }, {
        read: async (actual, scope, node) => {
            assert.equal(actual, tx); assert.equal(scope, 'scope-a'); assert.equal(node, 'node-a');
            calls.push('published'); return state.current;
        },
    }, 5000);
    return { state, host, calls, tx, run: (input: unknown = command) => host.plan('actor-a', 'scope-a', 'forward-a', input) };
}

test('probe preflight rejects open inputs, coercions and invalid identities before starting a transaction', async () => {
    const f = fixture();
    for (const input of [null, [], {}, Object.create(command), { ...command, target: '169.254.169.254' },
        { ...command, version: 2 }, { ...command, kind: 'udp' }, { ...command, expectedRevision: '1' },
        { ...command, expectedRevision: 0 }, { ...command, timeoutMs: null }, { ...command, timeoutMs: '100' },
        { ...command, timeoutMs: 99 }, { ...command, timeoutMs: 2001 }, { ...command, timeoutMs: 100.5 }])
        await assert.rejects(f.run(input), { code: 'INVALID_CONFIG' });
    await assert.rejects(f.host.plan('actor-a\n', 'scope-a', 'forward-a', command), { code: 'INVALID_CONFIG' });
    assert.deepEqual(f.calls, []);
});

test('preflight uses one authorized read transaction, returns immutable binding and never issues executable authority', async () => {
    const f = fixture(), result = await f.run();
    assert.deepEqual(f.calls, ['begin', 'scope', 'intent', 'grant', 'published', 'commit']);
    assert.equal(result.executable, false); assert.equal(result.dispatch, 'not-implemented');
    assert.equal(result.independentProbe, false); assert.equal(result.health, 'unknown');
    assert.equal(result.maxAttempts, 1); assert.equal(result.applicationPayloadBytes, 0);
    assert.equal(result.binding.bindingFence, 4); assert.equal(result.binding.deploymentGeneration, 5);
    assert.equal(result.binding.snapshotGeneration, 3); assert.equal(result.binding.sessionEpoch, 2);
    assert.equal(result.binding.bootId, 'boot-a'); assert.equal(result.timeoutMs, 1000);
    assert.ok(Date.parse(result.expiresAt) - Date.parse(result.plannedAt) <= 2000);
    assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.binding));
    assert.ok(Buffer.byteLength(JSON.stringify(result)) < 4096);
    assert.ok(!JSON.stringify(result).includes('127.0.0.1'));
    f.state.current!.snapshot.assignments[0]!.bindingFence = 999;
    assert.equal(result.binding.bindingFence, 4);
});

test('manager and explicit Node Grant checks occur before reading any published execution', async () => {
    const scope = fixture(); scope.state.denyScope = true;
    await assert.rejects(scope.run(), { code: 'AUTHORIZATION_DENIED' });
    assert.deepEqual(scope.calls, ['begin', 'scope']);
    const grant = fixture(); grant.state.denyNode = true;
    await assert.rejects(grant.run(), { code: 'AUTHORIZATION_DENIED' });
    assert.deepEqual(grant.calls, ['begin', 'scope', 'intent', 'grant']);
});

test('trusted authorization port joins the supplied transaction without starting a nested one or granting execution', async () => {
    const f = fixture();
    const plan = await f.host.authorize(f.tx, 'actor-a', 'scope-a', 'forward-a', command);
    assert.deepEqual(f.calls, ['scope', 'intent', 'grant', 'published']);
    assert.equal(plan.executable, false); assert.equal(plan.dispatch, 'not-implemented');
});

test('stale revisions and disabled, deleting, recovery-suspended, DNS, UDP-only and Relay intents cannot plan', async () => {
    for (const change of [
        (f: ReturnType<typeof fixture>) => { f.state.forward = { ...f.state.forward, revision: 2 }; },
        (f: ReturnType<typeof fixture>) => { f.state.forward.deleting = true; },
        (f: ReturnType<typeof fixture>) => { f.state.forward.recoverySuspended = true; },
        (f: ReturnType<typeof fixture>) => { f.state.forward = { ...f.state.forward, spec: { ...f.state.forward.spec, enabled: false } }; },
        (f: ReturnType<typeof fixture>) => { f.state.forward = { ...f.state.forward, spec: { ...f.state.forward.spec, protocols: ['udp'] } }; },
        (f: ReturnType<typeof fixture>) => { f.state.forward = { ...f.state.forward,
            spec: { ...f.state.forward.spec, target: { host: 'example.org', port: 80 } } }; },
        (f: ReturnType<typeof fixture>) => { f.state.forward = { ...f.state.forward, spec: { ...f.state.forward.spec,
            path: { via: ['node-b'] }, transport: { profileId: 'profile-a', configRevision: 1 } } }; },
    ]) {
        const f = fixture(); change(f); await assert.rejects(f.run()); assert.ok(!f.calls.includes('published'));
    }
});

test('metadata remains forbidden even when Forward policy allows it; foreign facts and denied CIDRs fail closed', async () => {
    for (const host of ['169.254.169.254', '100.100.100.200', 'fd00:ec2::254', 'fe80::1',
        '::ffff:169.254.169.254', '224.0.0.1', '255.255.255.255']) {
        const f = fixture(); f.state.forward = { ...f.state.forward, spec: { ...f.state.forward.spec, target: { host, port: 80 } } };
        f.state.facts = { ...f.state.facts, allowedDestinationCidrs: ['0.0.0.0/0', '::/0'], allowMetadataTargets: true };
        await assert.rejects(f.run(), { code: 'AUTHORIZATION_DENIED' }); assert.ok(!f.calls.includes('published'));
    }
    for (const facts of [{ nodeId: 'node-b' }, { scopeId: 'scope-b' }, { allowedDestinationCidrs: ['10.0.0.0/8'] }]) {
        const f = fixture(); f.state.facts = { ...f.state.facts, ...facts };
        await assert.rejects(f.run(), { code: 'AUTHORIZATION_DENIED' });
    }
    for (const host of ['0.0.0.0', '::']) {
        const f = fixture(); f.state.forward = { ...f.state.forward, spec: { ...f.state.forward.spec, target: { host, port: 80 } } };
        await assert.rejects(f.run(), { code: 'PROBE_UNAVAILABLE' });
    }
});

test('missing, expired and incompatible published bindings cannot become a plan', async () => {
    const changes: ((current: PublishedProbeSnapshot) => PublishedProbeSnapshot | undefined)[] = [
        () => undefined, c => ({ ...c, bootId: null }), c => ({ ...c, sessionEpoch: 3 }),
        c => ({ ...c, credentialUntil: Date.now() }),
        c => ({ ...c, snapshot: { ...c.snapshot, nodeId: 'foreign-node' } }),
        c => ({ ...c, snapshot: { ...c.snapshot, validUntil: new Date(Date.now()).toISOString() } }),
        c => ({ ...c, snapshot: { ...c.snapshot, issuedAt: new Date(Date.now() + 60000).toISOString() } }),
        c => ({ ...c, snapshot: { ...c.snapshot, issuedAt: 'invalid' } }),
        c => ({ ...c, snapshot: { ...c.snapshot, assignments: [] } }),
        c => ({ ...c, snapshot: { ...c.snapshot, assignments: [...c.snapshot.assignments, ...c.snapshot.assignments] } }),
        ...[
            { forwardRevision: 2 }, { role: 'relay-ingress' }, { phase: 'prepared' },
            { resource: { address: '127.0.0.2', port: 22001, protocol: 'tcp' } },
        ].map(patch => (c: PublishedProbeSnapshot) => {
            Object.assign(c.snapshot.assignments[0]!, patch); return c;
        }),
        c => { Object.assign(c.snapshot.assignments[0]!.driver.config, { egressPolicyRevision: 2 }); return c; },
        c => { Object.assign(c.snapshot.assignments[0]!.driver.config, { target: { host: '127.0.0.2', port: 80 } }); return c; },
    ];
    for (const change of changes) {
        const f = fixture(); f.state.current = change(f.state.current!);
        await assert.rejects(f.run(), { code: 'PROBE_UNAVAILABLE' });
    }
});

test('MySQL projection is scoped, supplied-transaction-only and binds body generation/session/expiry to database rows', async () => {
    const f = fixture(), snapshot = f.state.current!.snapshot;
    const record = { boot_id: 'boot-a', session_epoch: 2, snapshot_generation: 3,
        credential_until: Date.now() + 60000, valid_until: Date.parse(snapshot.validUntil), body: snapshot };
    let query = '', parameters: unknown[] = [];
    const tx = { execute: async (sql: string, args: unknown[]) => {
        query = sql; parameters = args; return [[record], []];
    } } as unknown as Transaction;
    const reader = new MySqlProbeReader();
    assert.equal((await reader.read(tx, 'scope-a', 'node-a'))!.snapshot.snapshotGeneration, 3);
    assert.deepEqual(parameters, ['node-a', 'scope-a']); assert.match(query, /OCTET_LENGTH/);
    assert.ok(!/\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/.test(query));
    record.snapshot_generation = 4; assert.equal(await reader.read(tx, 'scope-a', 'node-a'), undefined);
    record.snapshot_generation = 3; record.session_epoch = 3;
    assert.equal(await reader.read(tx, 'scope-a', 'node-a'), undefined);
    record.session_epoch = 2; record.valid_until--;
    assert.equal(await reader.read(tx, 'scope-a', 'node-a'), undefined);
});
