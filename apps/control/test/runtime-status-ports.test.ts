import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import type { RuntimeReportRequestValue, RuntimeSnapshotValue } from '@tunex/contracts/execution-values';
import { RuntimeStatusQueries } from '../src/modules/runtime-status-owner/public.ts';
import type { RuntimeStatusCodec } from '../src/modules/runtime-status-owner/contracts.ts';
import type { RuntimeStatusStorageReader, RuntimeStatusNodeRecord } from '../src/framework/runtime-status-storage-ports.ts';
import { MySqlRuntimeStatusStore } from '../src/infrastructure/mysql-runtime-status-store.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

const forward: Forward = { id: 'forward', scopeId: 'scope', revision: 1, spec: { enabled: true, protocols: ['tcp'],
    ingress: { nodeId: 'node', listen: { address: '127.0.0.1', port: 8080 } }, target: { host: 'example.com', port: 80 } } };
function fixture() {
    const tx = Object.freeze({ id: 'original' }), events: string[] = [];
    const report: RuntimeReportRequestValue = { nodeId: 'node', bootId: 'boot', sessionEpoch: 2, reportSequence: 1, observedAt: '10000', acceptedSnapshotGeneration: 4,
        observations: [{ assignmentId: 'assignment', deploymentGeneration: 2, bindingFence: 3, phase: 'active', condition: 'ready', errorCode: null, retryable: false }], drains: [] };
    const current: RuntimeSnapshotValue = { nodeId: 'node', sessionEpoch: 2, snapshotGeneration: 4, complete: true, issuedAt: '0', validUntil: '30000', snapshotDigest: 'digest', tombstones: [],
        assignments: [{ assignmentId: 'assignment', forwardId: 'forward', forwardRevision: 1, deploymentGeneration: 2, bindingFence: 3, role: 'direct', protocol: 'tcp', phase: 'active',
            resource: { address: '127.0.0.1', port: 8080, protocol: 'tcp' }, driver: { id: 'test', configDigest: 'config' }, drainTimeoutSeconds: 5 }] };
    const reported = { ...current, validUntil: '28000' };
    const state: RuntimeStatusNodeRecord = { node_id: 'node', session_epoch: 2, snapshot_generation: 4, last_report: report, received_at: 10000 };
    const data = { now: 10000, missingCurrent: false, missingReported: false, decodeFailure: undefined as unknown };
    const codec: RuntimeStatusCodec = { read: <T>(value: unknown) => { events.push(value === report ? 'decode-report' : value === current ? 'decode-current' : 'decode-reported');
        if (value === data.decodeFailure) throw new Error('malformed'); return value as T; }, parseTime: Number, formatTime: String, now: () => { events.push('now'); return data.now; } };
    const store: RuntimeStatusStorageReader<typeof tx> = {
        node: async (supplied, node) => { assert.equal(supplied, tx); assert.equal(node, 'node'); events.push('node'); return state; },
        currentSnapshot: async (supplied, node, generation) => { assert.equal(supplied, tx); assert.equal(node, 'node'); assert.equal(generation, 4); events.push('current'); return data.missingCurrent ? undefined : { body: current }; },
        reportedSnapshot: async (supplied, node, generation, epoch) => { assert.equal(supplied, tx); assert.equal(node, 'node'); assert.equal(generation, 4); assert.equal(epoch, report.sessionEpoch);
            events.push('reported'); return data.missingReported ? undefined : { body: reported }; },
    };
    return { tx, events, state, report, current, reported, data, codec, store, host: new RuntimeStatusQueries(store, codec, DEFAULT_POLICY) };
}

test('runtime status decodes report before current and preserves separate current freshness decode in the caller transaction', async () => {
    const f = fixture(), result = await f.host.status(f.tx, forward);
    assert.deepEqual(f.events, ['node', 'decode-report', 'current', 'decode-current', 'reported', 'decode-current', 'decode-reported', 'now']);
    assert.equal(result.health.condition, 'ready'); assert.equal(result.health.freshUntil, String(Math.min(10000 + DEFAULT_POLICY.observationFreshnessSeconds * 1000, 28000 - DEFAULT_POLICY.maxClockSkewSeconds * 1000)));
    assert.deepEqual(result.applied[0], { ...f.report.observations[0], nodeId: 'node', forwardRevision: 1, role: 'direct' });
});

test('runtime status retains lazy malformed-body failure order and absent body/zero timestamp semantics', async () => {
    const f = fixture(); f.data.decodeFailure = f.report;
    await assert.rejects(f.host.status(f.tx, forward), /malformed/); assert.deepEqual(f.events, ['node', 'decode-report']);
    f.events.length = 0; f.data.decodeFailure = f.current;
    await assert.rejects(f.host.status(f.tx, forward), /malformed/); assert.deepEqual(f.events, ['node', 'decode-report', 'current', 'decode-current']);
    f.events.length = 0; f.state.last_report = null; f.state.snapshot_generation = 0; f.state.received_at = 0;
    assert.deepEqual(await f.host.status(f.tx, forward), { applied: [], health: { condition: 'unknown', receivedAt: null, freshUntil: null } });
    assert.deepEqual(f.events, ['node']);
});

test('runtime status matches generation/fence tuples and marks exact expiry, wrong epoch and missing evidence unknown', async () => {
    for (const mode of ['generation', 'fence', 'expiry', 'epoch', 'current', 'reported'] as const) {
        const f = fixture();
        if (mode === 'generation') f.report.observations[0]!.deploymentGeneration++;
        if (mode === 'fence') f.report.observations[0]!.bindingFence++;
        if (mode === 'expiry') f.data.now = Math.min(10000 + DEFAULT_POLICY.observationFreshnessSeconds * 1000, 28000 - DEFAULT_POLICY.maxClockSkewSeconds * 1000);
        if (mode === 'epoch') f.state.session_epoch++;
        if (mode === 'current') f.data.missingCurrent = true;
        if (mode === 'reported') f.data.missingReported = true;
        const result = await f.host.status(f.tx, forward);
        assert.equal(result.health.condition, mode === 'generation' || mode === 'fence' ? 'degraded' : 'unknown', mode);
        if (mode === 'generation' || mode === 'fence') assert.deepEqual(result.applied, []);
    }
});

test('runtime raw status adapter uses only supplied execute and exact original query arguments', async () => {
    const calls: { sql: string; args: unknown[] }[] = [], row = { raw: true };
    const tx = { execute: async (sql: string, args: unknown[]) => { calls.push({ sql, args }); return [[row], []]; } } as unknown as Transaction;
    const store = new MySqlRuntimeStatusStore();
    assert.equal(await store.node(tx, 'node'), row); assert.equal(await store.currentSnapshot(tx, 'node', 4), row);
    assert.equal(await store.reportedSnapshot(tx, 'node', 3, 2), row);
    assert.deepEqual(calls, [{ sql: 'SELECT * FROM runtime_nodes WHERE node_id=?', args: ['node'] },
        { sql: 'SELECT body FROM snapshots WHERE node_id=? AND generation=?', args: ['node', 4] },
        { sql: 'SELECT body FROM snapshots WHERE node_id=? AND generation=? AND session_epoch=?', args: ['node', 3, 2] }]);
});
