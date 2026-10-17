import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { MAX_COUNTER } from '@tunex/core';
import { ProbeInstances } from '../src/application/probe-instances.ts';
import { MySqlProbeInstances } from '../src/infrastructure/mysql-probe-instances.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import type { ProbeInstanceRecord, ProbeInstanceStore } from '../src/modules/probe-instance-ports.ts';
import type { ProbeMachineEvidence } from '../src/modules/probe-negotiation-ports.ts';

const fingerprint = 'a'.repeat(64), instanceA = '1'.repeat(64), instanceB = '2'.repeat(64);
const initial = { bootId: 'boot-a', instanceId: instanceA, expectedGeneration: 0 };
function fixture(t: TestContext) {
    let now = Date.parse('2026-10-17T01:00:00.000Z');
    t.mock.method(Date, 'now', () => now);
    const tx = Object.freeze({ token: Symbol('tx') }), calls: string[] = [];
    const state: { row: ProbeInstanceRecord | undefined; machine: ProbeMachineEvidence | undefined; failWrite?: boolean;
        failCommit?: boolean; onLock?: () => void } = { row: undefined, machine: {
        nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, revoked: false, credentialRevoked: false,
        nodeCredentialUntil: now + 120000, credentialUntil: now + 60000, retireAfter: null,
        capabilities: ['adp.3', 'native.direct.v1', 'tcp'],
    } };
    let staged: ProbeInstanceRecord | undefined;
    const db = { transaction: async <T>(action: (actual: typeof tx) => Promise<T>): Promise<T> => {
        staged = state.row; calls.push('begin');
        try {
            const result = await action(tx);
            if (state.failCommit) throw new Error('commit guard failed');
            state.row = staged; calls.push('commit'); return result;
        } catch (error) { calls.push('rollback'); throw error; }
    } };
    const machines = { read: async (actual: typeof tx, nodeId: string, fp: string) => {
        assert.equal(actual, tx); assert.equal(nodeId, 'node-a'); assert.equal(fp, fingerprint);
        calls.push('machine'); return state.machine;
    } };
    const store: ProbeInstanceStore<typeof tx> = {
        read: async actual => { assert.equal(actual, tx); calls.push('read'); return staged; },
        lock: async actual => { assert.equal(actual, tx); calls.push('lock'); state.onLock?.(); return staged; },
        replace: async (actual, expected, next) => {
            assert.equal(actual, tx); assert.equal(expected, staged?.generation ?? 0); calls.push('replace');
            staged = next;
            if (state.failWrite) throw new Error('owner write failed');
        },
    };
    const host = new ProbeInstances(db, machines, store);
    return { host, state, calls, freshHost: () => new ProbeInstances(db, machines, store),
        advance: (ms: number) => { now += ms; },
        register: (input = initial) => host.register('node-a', fingerprint, 2, input),
        inspect: () => host.inspect('node-a', fingerprint, 2, 'boot-a'),
        revoke: (id = instanceA, generation = 1) => host.revoke('node-a', fingerprint, 2,
            { bootId: 'boot-a', instanceId: id, expectedGeneration: generation }) };
}
test('durable instance registration uses one transaction, immutable output and non-renewing retry across host reconstruction', async t => {
    const f = fixture(t), first = await f.register();
    assert.deepEqual(f.calls, ['begin', 'machine', 'lock', 'replace', 'commit']);
    assert.equal(first.generation, 1); assert.equal(first.expiresAt - first.registeredAt, 30000);
    assert.equal(first.executionEnabled, false); assert.ok(Object.isFrozen(first));
    f.advance(1000); f.calls.length = 0;
    const replay = await f.freshHost().register('node-a', fingerprint, 2, initial);
    assert.deepEqual(replay, first);
    assert.deepEqual(f.calls, ['begin', 'machine', 'lock', 'commit']);
    f.calls.length = 0;
    const inspection = await f.inspect();
    assert.equal(inspection.state, 'registered'); assert.equal(inspection.executionEnabled, false);
    assert.ok(Object.isFrozen(inspection)); assert.ok(Object.isFrozen(inspection.instance));
    assert.deepEqual(f.calls, ['begin', 'machine', 'read', 'commit']);
    assert.equal(Object.keys(first).some(k => /permit|target|lease|snapshot/i.test(k)), false);
});
test('generation CAS rejects delayed installation and revocation without harming the current successor', async t => {
    const f = fixture(t); await f.register();
    const next = { ...initial, instanceId: instanceB, expectedGeneration: 1 };
    const second = await f.register(next);
    assert.equal(second.generation, 2);
    for (const input of [initial, { ...next, expectedGeneration: 0 }, { ...next, expectedGeneration: 2 }])
        await assert.rejects(f.register(input), { code: 'PROBE_INSTANCE_CONFLICT' });
    await assert.rejects(f.revoke(), { code: 'PROBE_INSTANCE_CONFLICT' });
    assert.equal(f.state.row!.instanceId, instanceB);
    assert.deepEqual(await f.register(next), second);
});
test('expiry or clock rollback cannot renew an instance; a fresh identity and current generation are required', async t => {
    const f = fixture(t), first = await f.register();
    f.advance(30000);
    assert.equal((await f.inspect()).state, 'stale');
    await assert.rejects(f.register(), { code: 'PROBE_INSTANCE_EXPIRED' });
    assert.equal(f.state.row!.expiresAt, first.expiresAt);
    f.advance(-30001);
    assert.equal((await f.inspect()).state, 'stale');
    await assert.rejects(f.register(), { code: 'PROBE_INSTANCE_EXPIRED' });
    f.advance(2);
    assert.equal((await f.register({ ...initial, instanceId: instanceB, expectedGeneration: 1 })).generation, 2);
});
test('every registration and replay reauthorizes machine/session/credential/capability evidence and clamps overlap expiry', async t => {
    const f = fixture(t), evidence = f.state.machine!, until = Date.now() + 1500;
    f.state.machine = { ...evidence, retireAfter: until };
    const first = await f.register(); assert.equal(first.expiresAt, until);
    for (const patch of [
        { revoked: true }, { credentialRevoked: true }, { credentialUntil: Date.now() },
        { nodeCredentialUntil: NaN }, { retireAfter: Date.now() }, { nodeId: 'foreign' },
        { sessionEpoch: 3 }, { bootId: null }, { capabilities: ['adp.3', 'tcp'] },
    ]) {
        f.state.machine = { ...evidence, ...patch };
        f.calls.length = 0; await assert.rejects(f.register());
        assert.deepEqual(f.calls, ['begin', 'machine', 'rollback']);
        assert.equal(f.state.row!.generation, 1);
    }
    f.state.machine = undefined;
    await assert.rejects(f.register(), { code: 'SESSION_SUPERSEDED' });
});
test('revocation is sticky, repeatable and available after capability withdrawal and counter exhaustion', async t => {
    const f = fixture(t); await f.register();
    f.state.machine = { ...f.state.machine!, capabilities: [] };
    assert.equal((await f.inspect()).state, 'stale');
    const revoked = await f.revoke();
    assert.equal(revoked.state, 'revoked'); assert.equal(revoked.generation, 1);
    f.advance(100);
    assert.deepEqual(await f.revoke(), revoked);
    f.state.machine = { ...f.state.machine!, capabilities: ['adp.3', 'native.direct.v1', 'tcp'] };
    await assert.rejects(f.register(), { code: 'PROBE_INSTANCE_CONFLICT' });
    f.state.row = { ...f.state.row!, generation: MAX_COUNTER, state: 'registered', revokedAt: null };
    await assert.rejects(f.register({ ...initial, instanceId: instanceB, expectedGeneration: MAX_COUNTER }),
        { code: 'COUNTER_EXHAUSTED' });
    assert.equal((await f.revoke(instanceA, MAX_COUNTER)).state, 'revoked');
    assert.equal(f.state.row.generation, MAX_COUNTER);
});
test('a new boot reports the prior registration as stale rather than silently adopting it', async t => {
    const f = fixture(t); await f.register();
    f.state.machine = { ...f.state.machine!, bootId: 'boot-b', sessionEpoch: 3 };
    assert.equal((await f.host.inspect('node-a', fingerprint, 3, 'boot-b')).state, 'stale');
    await assert.rejects(f.host.register('node-a', fingerprint, 3, { ...initial, bootId: 'boot-b', expectedGeneration: 1 }),
        { code: 'PROBE_INSTANCE_CONFLICT' });
    const fresh = await f.host.register('node-a', fingerprint, 3,
        { bootId: 'boot-b', instanceId: instanceB, expectedGeneration: 1 });
    assert.equal(fresh.generation, 2); assert.equal(fresh.sessionEpoch, 3);
});
test('closed typed input validates before I/O and is detached before asynchronous acceptance', async t => {
    const f = fixture(t);
    for (const patch of [{ target: '127.0.0.1' }, { instanceId: instanceA + '\n' }, { instanceId: '1' },
        { bootId: 'boot-a\n' }, { expectedGeneration: -1 }, { expectedGeneration: '0' },
        { expectedGeneration: MAX_COUNTER + 1 }])
        await assert.rejects(f.register({ ...initial, ...patch } as never), { code: 'INVALID_CONFIG' });
    await assert.rejects(f.host.register('node-a', fingerprint + '\n', 2, initial), { code: 'INVALID_CONFIG' });
    await assert.rejects(f.host.register('node-a', fingerprint, 0, initial), { code: 'INVALID_CONFIG' });
    assert.deepEqual(f.calls, []);
    const input = { ...initial }, pending = f.register(input);
    input.instanceId = instanceB; input.expectedGeneration = 99;
    assert.equal((await pending).instanceId, instanceA);
});
test('write failure, commit guard failure and expiry while waiting for a lock leave no accepted ownership', async t => {
    const f = fixture(t);
    f.state.failWrite = true; await assert.rejects(f.register(), /owner write failed/);
    assert.equal(f.state.row, undefined);
    f.state.failWrite = false; f.state.failCommit = true;
    await assert.rejects(f.register(), /commit guard failed/); assert.equal(f.state.row, undefined);
    f.state.failCommit = false;
    f.state.onLock = () => { f.advance(60000); };
    await assert.rejects(f.register(), { code: 'AUTHORIZATION_DENIED' }); assert.equal(f.state.row, undefined);
});
test('MySQL owner locks absent slots, binds updates, rejects corrupt projections and quarantines without resetting generation', async () => {
    const calls: { sql: string; args: unknown[] }[] = [];
    let row: Record<string, unknown> = { node_id: 'node-a', generation: 1, boot_id: 'boot-a', session_epoch: 2,
        fingerprint, instance_id: instanceA, state: 'registered', registered_at: 1000, expires_at: 31000, revoked_at: null };
    const tx = { execute: async (sql: string, args: unknown[]) => {
        calls.push({ sql, args }); return sql.startsWith('SELECT') ? [[row], []] : [{ affectedRows: 1 }, []];
    } } as unknown as Transaction;
    const store = new MySqlProbeInstances(), current = await store.lock(tx, 'node-a');
    assert.match(calls[0]!.sql, /INSERT INTO probe_instances.*ON DUPLICATE KEY UPDATE/);
    assert.match(calls[1]!.sql, /FOR UPDATE/);
    await store.replace(tx, 1, { ...current!, instanceId: instanceB, generation: 2 });
    assert.match(calls[2]!.sql, /WHERE node_id=\? AND generation=\?/);
    assert.deepEqual(calls[2]!.args.slice(-2), ['node-a', 1]);
    await assert.rejects(store.replace(tx, 2, { ...current!, generation: 1 }), { code: 'PROBE_INSTANCE_CONFLICT' });
    await assert.rejects(store.replace(tx, 1, current!), { code: 'PROBE_INSTANCE_CONFLICT' });
    await store.replace(tx, 1, { ...current!, state: 'revoked', revokedAt: 2000 });
    assert.match(calls[3]!.sql, /AND state='registered' AND boot_id=\?/);
    for (const patch of [{ generation: '1' }, { generation: MAX_COUNTER + 1 }, { instance_id: instanceA + '\n' },
        { state: 'empty' }, { expires_at: 31001 }, { revoked_at: 1 }, { node_id: 'foreign' }]) {
        const saved = row; row = { ...row, ...patch };
        await assert.rejects(store.read(tx, 'node-a'), { code: 'PROBE_INSTANCE_CORRUPT' }); row = saved;
    }
    await MySqlProbeInstances.quarantineRecovery(tx);
    assert.match(calls.at(-1)!.sql, /state='quarantined'/);
    assert.ok(!/\bgeneration\s*=/.test(calls.at(-1)!.sql));
    const staleTx = { execute: async () => [{ affectedRows: 0 }, []] } as unknown as Transaction;
    await assert.rejects(store.replace(staleTx, 1, { ...current!, generation: 2 }), { code: 'PROBE_INSTANCE_CONFLICT' });
});
