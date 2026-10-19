import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as core from '@tunex/core';
import * as framework from '../src/framework/public.ts';
import * as runtime from '@tunex/contracts/runtime';
import * as observability from '@tunex/contracts/observability';
import * as shared from '@tunex/contracts/shared';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'mysql2/promise';
import { MySqlUnitOfWork, rows as mysqlRows, write as mysqlWrite } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { MySqlTelemetryStore } from '../src/infrastructure/mysql-telemetry.ts';
import { MySqlHostTelemetryStore } from '../src/infrastructure/mysql-host-telemetry.ts';
import { MySqlForwardTelemetryStore } from '../src/infrastructure/mysql-forward-telemetry.ts';
import { MySqlProbeTelemetryStore } from '../src/infrastructure/mysql-probe-telemetry.ts';
import { MySqlTelemetryRollups } from '../src/infrastructure/mysql-telemetry-rollups.ts';
import { MySqlTelemetryRollupStorage } from '../src/infrastructure/mysql-telemetry-rollup-storage.ts';
import { MySqlTelemetryRecoveryStore } from '../src/infrastructure/mysql-telemetry-recovery-store.ts';
import { processObservation, hostObservation, forwardObservations, probeObservations, telemetryRollupStorageValues } from '../src/modules/telemetry-owner/public.ts';
import { nativeValueDigest as digest, compileDirect, compileSnapshot, compileRelayPlan, compileRelayResources, compileMultihopPlan } from '../src/compatibility/public.ts';
import { multihopFixture } from './fixtures/multihop.ts';

type Any = Record<string, any>;
const at = 1800000000000, epoch = 'a'.repeat(32), hash = 'sha256:' + 'b'.repeat(64);
const nodeRow = { id: 'node', scope_id: 'scope', revoked: 0, credential_until: String(at + 60000), session_epoch: '1', boot_id: 'boot' };
const headRow = { node_id: 'node', scope_id: 'scope', session_epoch: '1', boot_id: 'boot', sample_epoch: epoch, last_sequence: '0',
    last_uptime_ms: '0', last_digest: null, last_received_at: '0', last_captured_at: '0', dropped_samples: '0', accepted_points: '0', rejected_points: '0' };
const sample = { nodeId: 'node', bootId: 'boot', sessionEpoch: 1, sampleEpoch: epoch, sequence: 1, capturedAt: new Date(at).toISOString(), uptimeMs: 1000, droppedSamples: '0' };
const pointColumns = 'node_id,scope_id,session_epoch,boot_id,sample_epoch,sequence,captured_at,received_at,uptime_ms,body,digest,recovery_suspended';
function harness() {
    const tx = {}, events: Array<{ kind: string; sql: string; args: unknown[] }> = [], answers: any[][] = [], affected: number[] = [], cache: Any = {}, state: Any = { failAt: -1, calls: 0, poolOptions: null, timers: [] };
    const rows = async (actual: unknown, statement: string, args: unknown[]) => { assert.equal(actual, tx); events.push({ kind: 'rows', sql: statement.replace(/\s+/g, ' ').trim(), args }); return answers.shift() ?? []; };
    const write = async (actual: unknown, statement: string, args: unknown[]) => { assert.equal(actual, tx); events.push({ kind: 'write', sql: statement.replace(/\s+/g, ' ').trim(), args }); if (++state.calls === state.failAt) throw new Error('injected write failure'); return affected.shift() ?? 1; };
    function load(file: string): Any {
        if (cache[file]) return cache[file]; const exports: Any = {}; cache[file] = exports;
        const javascript = ts.transpileModule(readFileSync(new URL('../src/infrastructure/' + file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
        new vm.Script('(function(exports,Buffer,require,setTimeout,clearTimeout){\n' + javascript + '\n})').runInThisContext()(exports, Buffer, (name: string) => {
            if (name === '@tunex/core') return core; if (name === '@tunex/contracts/shared') return shared; if (name === '@tunex/contracts/observability') return observability;
            if (name === '@tunex/contracts/runtime') return runtime;
            if (name === '../framework/public.ts') return framework; if (name === './mysql.ts') return { rows, write, json: (value: unknown) => typeof value === 'string' ? JSON.parse(value) : value };
            if (name === 'mysql2/promise') return { createPool(options: unknown) { state.poolOptions = options; return state.pool; } };
            if (name.startsWith('./')) return load(name.slice(2)); throw new Error('Unexpected SQL adapter import ' + name);
        }, (callback: () => void, ms: number) => { const timer = { callback, ms, cleared: false, unref() {} }; state.timers.push(timer); return timer; }, (timer: Any) => { timer.cleared = true; });
        return exports;
    }
    return { tx, events, answers, affected, state, load };
}

test('75 76 77 lower recovery quarantines only observation cursors and retained history flags in the original ten-statement order', async () => {
    const h = harness(), recovery = new (h.load('mysql-telemetry-recovery-store.ts').MySqlTelemetryRecoveryStore)();
    await recovery.quarantineRecovery(h.tx);
    assert.deepEqual(h.events.map(event => event.sql), ['DELETE FROM telemetry_heads', 'UPDATE telemetry_points SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE',
        'DELETE FROM telemetry_rollup_cursors', 'UPDATE telemetry_rollup_buckets SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE',
        'DELETE FROM probe_telemetry_heads', 'UPDATE probe_telemetry_points SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE',
        'DELETE FROM host_telemetry_heads', 'UPDATE host_telemetry_points SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE',
        'DELETE FROM forward_telemetry_heads', 'UPDATE forward_telemetry_points SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE']);
    assert.ok(h.events.every(event => event.kind === 'write' && event.args === undefined));
});

for (const family of ['node', 'host'] as const) {
    const prefix = family === 'node' ? 'telemetry' : 'host_telemetry', file = family === 'node' ? 'mysql-telemetry.ts' : 'mysql-host-telemetry.ts', cls = family === 'node' ? 'MySqlTelemetryStore' : 'MySqlHostTelemetryStore';
    test(`76 ${family} raw store maps node nullable runtime state and head lock with exact bound SQL`, async () => {
        const h = harness(), store = new (h.load(file)[cls])(); h.answers.push([nodeRow]);
        assert.deepEqual(await store.node(h.tx, 'node'), { nodeId: 'node', scopeId: 'scope', revoked: false, credentialUntil: at + 60000, sessionEpoch: 1, bootId: 'boot' });
        assert.equal(h.events[0]!.sql, 'SELECT n.id,n.scope_id,n.revoked,n.credential_until,r.session_epoch,r.boot_id FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE n.id=?'); assert.deepEqual(h.events[0]!.args, ['node']);
        h.answers.push([{ ...nodeRow, credential_until: null, session_epoch: null, boot_id: null }]); assert.deepEqual(await store.node(h.tx, 'node'), { nodeId: 'node', scopeId: 'scope', revoked: false, credentialUntil: 0, sessionEpoch: 0, bootId: null });
        h.answers.push([headRow]); const result = await store.lockHead(h.tx, 'scope', sample); assert.equal(result.lastSequence, 0); assert.equal(result.lastDigest, null);
        assert.equal(h.events[2]!.sql, `INSERT INTO ${prefix}_heads(node_id,scope_id,session_epoch,boot_id,sample_epoch) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE node_id=VALUES(node_id)`); assert.deepEqual(h.events[2]!.args, ['node', 'scope', 1, 'boot', epoch]);
        assert.equal(h.events[3]!.sql, `SELECT * FROM ${prefix}_heads WHERE node_id=? FOR UPDATE`);
        for (const change of [{ revoked: '0' }, { session_epoch: '-1' }, { credential_until: '9007199254740992' }, { id: '' }]) { h.answers.push([{ ...nodeRow, ...change }]); await assert.rejects(store.node(h.tx, 'node'), { code: 'INTEGRITY_FAILURE' }); }
        h.answers.push([{ ...headRow, dropped_samples: '18446744073709551616' }]); await assert.rejects(store.lockHead(h.tx, 'scope', sample), { code: 'INTEGRITY_FAILURE' });
    });
    test(`76 ${family} raw append strictly expires 256 evicts oldest at quota inserts complete body then advances head`, async () => {
        const h = harness(), store = new (h.load(file)[cls])(); h.answers.push([{ total: '8640' }]); await store.append(h.tx, 'scope', sample, hash, at);
        assert.deepEqual(h.events.map(event => event.sql), [`DELETE FROM ${prefix}_points WHERE node_id=? AND received_at<? ORDER BY received_at LIMIT 256`,
            `SELECT COUNT(*) total FROM ${prefix}_points WHERE node_id=?`, `DELETE FROM ${prefix}_points WHERE node_id=? ORDER BY received_at,sample_epoch,sequence LIMIT 1`,
            `INSERT INTO ${prefix}_points(node_id,scope_id,session_epoch,boot_id,sample_epoch,sequence, captured_at,received_at,uptime_ms,body,digest) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
            `UPDATE ${prefix}_heads SET scope_id=?,session_epoch=?,boot_id=?,sample_epoch=?,last_sequence=?, last_uptime_ms=?,last_digest=?,last_received_at=?,last_captured_at=?,dropped_samples=? WHERE node_id=?`]);
        assert.deepEqual(h.events[0]!.args, ['node', at - 86400000]); assert.deepEqual(h.events[3]!.args, ['node', 'scope', 1, 'boot', epoch, 1, at, at, 1000, JSON.stringify(sample), hash]);
        assert.deepEqual(h.events[4]!.args, ['scope', 1, 'boot', epoch, 1, 1000, hash, at, at, '0', 'node']);
        const over = harness(), overStore = new (over.load(file)[cls])(); over.answers.push([{ total: '8641' }]); await assert.rejects(overStore.append(over.tx, 'scope', sample, hash, at), { code: 'INTEGRITY_FAILURE' }); assert.equal(over.events.length, 2);
    });
    test(`76 ${family} raw history latest pruning retain inclusive window deterministic order and reject limit interpolation`, async () => {
        const h = harness(), store = new (h.load(file)[cls])();
        h.answers.push([{ node_id: 'node', scope_id: 'scope', session_epoch: '1', boot_id: 'boot', sample_epoch: epoch, sequence: '1', captured_at: String(at), received_at: String(at), uptime_ms: '1000', body: JSON.stringify(sample), digest: hash, recovery_suspended: 1 }]);
        const result = await store.history(h.tx, 'scope', 'node', at, at + 1, 1); assert.deepEqual(result[0].body, sample); assert.equal(result[0].recoverySuspended, true);
        assert.equal(h.events[0]!.sql, `SELECT ${pointColumns} FROM ${prefix}_points WHERE node_id=? AND scope_id=? AND received_at>=? AND received_at<=? ORDER BY received_at,sample_epoch,sequence LIMIT 2`); assert.deepEqual(h.events[0]!.args, ['node', 'scope', at, at + 1]);
        await store.latest(h.tx, 'scope', 'node', at); assert.equal(h.events[1]!.sql, `SELECT ${pointColumns} FROM ${prefix}_points WHERE node_id=? AND scope_id=? AND received_at>=? ORDER BY received_at DESC,sample_epoch DESC,sequence DESC LIMIT 2`);
        await store.prune(h.tx, at); assert.equal(h.events[2]!.sql, `DELETE FROM ${prefix}_points WHERE received_at<? ORDER BY received_at LIMIT 256`);
        for (const limit of [0, 513, 1.5, NaN, '1']) await assert.rejects(store.history(h.tx, 'scope', 'node', at, at + 1, limit), { code: 'INTEGRITY_FAILURE' }); assert.equal(h.events.length, 3);
    });
}

test('76 observation pool has two nonqueued slots uses original transaction commits releases and runs guards before begin and commit', async () => {
    const h = harness(), trace: string[] = [], connection: Any = { connection: { stream: { destroy() { trace.push('stream-destroy'); } } },
        async query(sql: string) { trace.push(sql); }, async beginTransaction() { trace.push('begin'); }, async commit() { trace.push('commit'); },
        async rollback() { trace.push('rollback'); }, release() { trace.push('release'); }, destroy() { trace.push('destroy'); } };
    h.state.pool = { async getConnection() { trace.push('get'); return connection; }, async end() { trace.push('end'); } };
    const Database = h.load('mysql-telemetry.ts').MySqlTelemetryDatabase, db = new Database('mysql://hidden'); db.guard = async () => { trace.push('guard'); };
    assert.deepEqual(h.state.poolOptions, { uri: 'mysql://hidden', connectionLimit: 2, maxIdle: 2, waitForConnections: false, connectTimeout: 1000, supportBigNumbers: true, bigNumberStrings: false, timezone: 'Z' });
    assert.equal(await db.transaction(async (actual: unknown) => { assert.equal(actual, connection); trace.push('action'); return 7; }), 7);
    assert.deepEqual(trace, ['get', 'guard', 'SET SESSION innodb_lock_wait_timeout=1', 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED', 'begin', 'action', 'guard', 'commit', 'release']);
    assert.equal(h.state.timers[0].ms, 1500); assert.equal(h.state.timers[0].cleared, true);
    let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; });
    const pending = [db.transaction(async () => barrier), db.transaction(async () => barrier)]; await assert.rejects(db.transaction(async () => 3), { code: 'TELEMETRY_BUSY' }); release(); await Promise.all(pending);
    await db.close(); assert.equal(trace.at(-1), 'end');
});

test('76 observation pool rolls back begun failures preserves domain errors destroys broken rollback and rejects missing transport', async () => {
    for (const mode of ['action', 'commit', 'rollback', 'guard', 'missing-stream', 'deadline'] as const) {
        const h = harness(), trace: string[] = []; const domain = new framework.ControlError('AUTHORIZATION_DENIED', 403, 'denied');
        const connection: Any = { connection: { stream: { destroy() { trace.push('stream-destroy'); } } }, async query() {}, async beginTransaction() { trace.push('begin'); },
            async commit() { trace.push('commit'); if (mode === 'commit') throw new Error('commit failure'); }, async rollback() { trace.push('rollback'); if (mode === 'rollback') throw new Error('rollback failure'); }, release() { trace.push('release'); }, destroy() { trace.push('destroy'); } };
        if (mode === 'missing-stream') connection.connection.stream = undefined;
        h.state.pool = { async getConnection() { return connection; } }; const db = new (h.load('mysql-telemetry.ts').MySqlTelemetryDatabase)('mysql://hidden');
        if (mode === 'guard') db.guard = async () => { throw domain; };
        const action = async () => { if (mode === 'deadline') h.state.timers[0].callback(); if (mode === 'action' || mode === 'rollback') throw domain; return 1; };
        await assert.rejects(db.transaction(action), mode === 'action' || mode === 'rollback' || mode === 'guard' ? (error: unknown) => error === domain : { code: mode === 'deadline' ? 'TELEMETRY_TIMEOUT' : 'TELEMETRY_UNAVAILABLE' });
        if (mode === 'action' || mode === 'commit' || mode === 'rollback') assert.ok(trace.includes('rollback'));
        if (mode === 'rollback' || mode === 'missing-stream' || mode === 'deadline') { assert.ok(trace.includes('destroy')); assert.ok(!trace.includes('release')); } else assert.equal(trace.at(-1), 'release');
        if (mode === 'guard' || mode === 'missing-stream') assert.ok(!trace.includes('begin'));
    }
});

function execution(family: 'forward' | 'probe') {
    const assignments = compileDirect({ id: 'forward', scopeId: 'scope', revision: 1, spec: { enabled: true, protocols: ['tcp'],
        ingress: { nodeId: 'node', listen: { address: '127.0.0.1', port: 22001 } }, target: { host: '127.0.0.1', port: 80 } } },
    { nodeId: 'node', scopeId: 'scope', capabilities: ['adp.3', 'native.direct.v1', 'tcp', 'udp'], allowedListenerAddresses: ['127.0.0.1'],
        allowedPorts: [22001], egressPolicyRevision: 1, allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false },
    [{ nodeId: 'node', forwardId: 'forward', protocol: 'tcp', port: 22001, bindingFence: 1, deploymentGeneration: 1 }]);
    const snapshot = compileSnapshot({ nodeId: 'node', sessionEpoch: 1, snapshotGeneration: 1, issuedAt: new Date(at).toISOString(),
        validUntil: new Date(at + 60000).toISOString(), tombstones: [], assignments });
    const assignment = assignments[0]!;
    const binding = { nodeId: 'node', bootId: 'boot', sessionEpoch: 1, assignmentId: assignment.assignmentId, forwardId: 'forward',
        forwardRevision: 1, deploymentGeneration: 1, bindingFence: 1, configDigest: assignment.driver.configDigest };
    const identity = family === 'forward' ? { ...binding, role: 'direct', protocol: 'tcp', driverId: assignment.driver.id,
        driverSchemaVersion: 1, resource: assignment.resource } : { binding: { ...binding, snapshotGeneration: 1, egressPolicyRevision: 1 }, instanceId: 'c'.repeat(64), instanceGeneration: 1 };
    const point = { identity, capturedAt: sample.capturedAt, state: 'current', ...(family === 'forward' ? { phase: 'active' } : {}),
        endedAt: null, availability: 'available', counterEpoch: epoch, counters: family === 'forward' ? { payloadSentBytes: '10', payloadReceivedBytes: '20',
            tcpAccepted: '1', tcpConnected: '1', tcpClosed: '0', udpAssociationsCreated: '0', udpAssociationsClosed: '0', udpDatagramsSent: '0', udpDatagramsReceived: '0' }
            : { attempted: '4', succeeded: '1', failed: '1', unknown: '1', inFlight: '1' }, overflowed: false };
    const coverage = { limit: 32, available: 1, returned: 1, omitted: 0, truncated: false, offset: 0, nextOffset: 0, unavailableSources: 0,
        tailLimit: 128, tailRetentionSeconds: 600, tailsEvicted: '0', tailsExpired: '0', historyComplete: false,
        ...(family === 'probe' ? { snapshotLimit: 2, retiringSourceLimit: 8, retiringSources: 0 } : {}) };
    const input = { ...sample, [`${family}TelemetryVersion`]: 1, kind: family + '-telemetry-sample', coverage,
        ...(family === 'forward' ? { snapshotGeneration: 1 } : {}), items: [point] };
    const mapping = { identity, scopeId: 'scope', source: family === 'forward' ? 'current-published' : 'published-snapshot', publishedUntil: at + 60000,
        forwardRecoverySuspended: false, ...(family === 'probe' ? { probeInstance: 'current-registered', instanceUntil: at + 30000 } : {}) };
    return { snapshot, assignment, point, input, mapping, accepted: [{ index: 0, point, mapping }] };
}
const mappedColumns = 'node_id,scope_id,forward_id,session_epoch,boot_id,sample_epoch,sequence,item_index,received_at,captured_at,sample_captured_at,uptime_ms,identity_digest,counter_epoch,body,exporter,digest,mapping_source,published_until';

test('75 actual Forward mapper validates current immutable native Snapshot provenance and uses only supplied transaction SELECTs', async () => {
    const h = harness(), mapper = new (h.load('mysql-forward-telemetry-mapping.ts').MySqlForwardTelemetryMapping)(), e = execution('forward');
    const current = { scope_id: 'scope', snapshot_generation: 1, generation: 1, session_epoch: 1, valid_until: at + 60000, body: JSON.stringify(e.snapshot) };
    h.answers.push([current], [{ id: 'forward', scope_id: 'scope', recovery_suspended: 0 }]);
    assert.deepEqual(await mapper.resolve(h.tx, { nodeId: 'node', bootId: 'boot', sessionEpoch: 1 }, [e.point]), [e.mapping]);
    assert.deepEqual(h.events.map(event => event.kind), ['rows', 'rows']);
    assert.equal(h.events[0]!.sql, 'SELECT n.scope_id,r.snapshot_generation, s.generation,s.session_epoch,s.valid_until, IF(OCTET_LENGTH(s.body)<=4194304,s.body,NULL) body FROM nodes n JOIN runtime_nodes r ON r.node_id=n.id LEFT JOIN snapshots s ON s.node_id=r.node_id AND s.generation=r.snapshot_generation WHERE n.id=? AND r.session_epoch=? AND r.boot_id=?');
    assert.deepEqual(h.events[0]!.args, ['node', 1, 'boot']); assert.equal(h.events[1]!.sql, 'SELECT id,scope_id,recovery_suspended FROM forwards WHERE id IN (?)'); assert.deepEqual(h.events[1]!.args, ['forward']);
    for (const change of [{ generation: 2 }, { valid_until: at + 1 }, { body: '{}' }, { body: null }, { scope_id: '' }]) {
        const bad = harness(), other = new (bad.load('mysql-forward-telemetry-mapping.ts').MySqlForwardTelemetryMapping)(); bad.answers.push([{ ...current, ...change }]); await assert.rejects(other.resolve(bad.tx, { nodeId: 'node', bootId: 'boot', sessionEpoch: 1 }, [e.point]), { code: 'INTEGRITY_FAILURE' });
    }
    const absent = harness(), missing = new (absent.load('mysql-forward-telemetry-mapping.ts').MySqlForwardTelemetryMapping)();
    absent.answers.push([]); assert.deepEqual(await missing.resolve(absent.tx, { nodeId: 'node', bootId: 'boot', sessionEpoch: 1 }, [e.point]), [null]);
    assert.deepEqual(await missing.resolve(absent.tx, { nodeId: 'node', bootId: 'boot', sessionEpoch: 1 }, []), []); assert.equal(absent.events.length, 1);
});

test('75 actual Forward mapper resolves retired published lease provenance and prevents duplicate retirement authority', async () => {
    const h = harness(), mapper = new (h.load('mysql-forward-telemetry-mapping.ts').MySqlForwardTelemetryMapping)(), e = execution('forward');
    const current = { scope_id: 'scope', snapshot_generation: 0, generation: null, session_epoch: null, valid_until: null, body: null };
    const retired = { assignment_id: e.assignment.assignmentId, deployment_generation: 1, binding_fence: 1, forward_id: 'forward', scope_id: 'scope',
        recovery_suspended: 1, valid_until: at + 60000, body: JSON.stringify(e.assignment) };
    h.answers.push([current], [retired]);
    assert.deepEqual(await mapper.resolve(h.tx, { nodeId: 'node', bootId: 'boot', sessionEpoch: 1 }, [e.point]), [{ ...e.mapping, source: 'retired-published', forwardRecoverySuspended: true }]);
    assert.equal(h.events[1]!.sql, 'SELECT r.assignment_id,r.deployment_generation,r.binding_fence, r.forward_id,f.scope_id,f.recovery_suspended,l.valid_until, IF(OCTET_LENGTH(r.body)<=4194304,r.body,NULL) body FROM retirements r JOIN execution_leases l ON l.node_id=r.node_id AND l.assignment_id=r.assignment_id AND l.deployment_generation=r.deployment_generation AND l.binding_fence=r.binding_fence AND l.forward_id=r.forward_id AND l.session_epoch=? JOIN forwards f ON f.id=r.forward_id WHERE r.node_id=? AND (r.assignment_id,r.deployment_generation,r.binding_fence) IN ((?,?,?))');
    assert.deepEqual(h.events[1]!.args, [1, 'node', e.assignment.assignmentId, 1, 1]);
    for (const rows of [[retired, retired], [{ ...retired, scope_id: 'foreign' }], [{ ...retired, assignment_id: 'wrong' }], [{ ...retired, valid_until: -1 }]]) {
        const bad = harness(), other = new (bad.load('mysql-forward-telemetry-mapping.ts').MySqlForwardTelemetryMapping)(); bad.answers.push([current], rows); await assert.rejects(other.resolve(bad.tx, { nodeId: 'node', bootId: 'boot', sessionEpoch: 1 }, [e.point]), { code: 'INTEGRITY_FAILURE' });
    }
});

test('75 actual Probe mapper validates native snapshot binding and current registered instance independently from reported observation', async () => {
    const e = execution('probe'), node = { nodeId: 'node', bootId: 'boot', sessionEpoch: 1, fingerprint: 'b'.repeat(64) };
    const current = { scope_id: 'scope', session_epoch: 1, boot_id: 'boot', instance_id: 'c'.repeat(64), instance_generation: 1,
        instance_state: 'registered', instance_boot: 'boot', instance_session: 1, instance_fingerprint: node.fingerprint,
        instance_registered_at: at, instance_until: at + 30000, instance_revoked_at: null };
    const snapshot = { generation: 1, session_epoch: 1, valid_until: at + 60000, body: JSON.stringify(e.snapshot) };
    for (const change of [{}, { instance_state: 'revoked' }, { instance_until: at }, { instance_fingerprint: 'd'.repeat(64) }, { instance_revoked_at: at }, { instance_until: at + 30001 }]) {
        const h = harness(), mapper = new (h.load('mysql-probe-telemetry-mapping.ts').MySqlProbeTelemetryMapping)(); h.answers.push([{ ...current, ...change }], [snapshot], [{ id: 'forward', scope_id: 'scope', recovery_suspended: 0 }]);
        const registered = Object.keys(change).length === 0;
        assert.deepEqual(await mapper.resolve(h.tx, node, [e.point], at), [{ ...e.mapping, probeInstance: registered ? 'current-registered' : 'not-rechecked', instanceUntil: registered ? at + 30000 : null }]);
        assert.deepEqual(h.events.map(event => event.kind), ['rows', 'rows', 'rows']);
        assert.equal(h.events[0]!.sql, 'SELECT n.scope_id,r.session_epoch,r.boot_id, p.instance_id,p.generation instance_generation,p.state instance_state,p.boot_id instance_boot, p.session_epoch instance_session,p.fingerprint instance_fingerprint,p.registered_at instance_registered_at, p.expires_at instance_until,p.revoked_at instance_revoked_at FROM nodes n JOIN runtime_nodes r ON r.node_id=n.id LEFT JOIN probe_instances p ON p.node_id=n.id WHERE n.id=?');
        assert.equal(h.events[1]!.sql, 'SELECT generation,session_epoch,valid_until, IF(OCTET_LENGTH(body)<=4194304,body,NULL) body FROM snapshots WHERE node_id=? AND session_epoch=? AND generation IN (?)'); assert.deepEqual(h.events[1]!.args, ['node', 1, 1]);
    }
    for (const change of [{ generation: 2 }, { session_epoch: 2 }, { valid_until: at + 1 }, { body: '{}' }]) {
        const h = harness(), mapper = new (h.load('mysql-probe-telemetry-mapping.ts').MySqlProbeTelemetryMapping)(); h.answers.push([current], [{ ...snapshot, ...change }]); await assert.rejects(mapper.resolve(h.tx, node, [e.point], at), { code: 'INTEGRITY_FAILURE' });
    }
    const mismatch = harness(), mapper = new (mismatch.load('mysql-probe-telemetry-mapping.ts').MySqlProbeTelemetryMapping)(); mismatch.answers.push([{ ...current, session_epoch: 2 }]); assert.deepEqual(await mapper.resolve(mismatch.tx, node, [e.point], at), [null]); assert.equal(mismatch.events.length, 1);
});

test('75 actual Forward mapper preserves native Relay and Multihop ingress provenance plus rejects cross-scope config binding', async () => {
    const profile: Any = { profileId: 'profile', revision: 1, config: { driver: 'native.relay.v1', wireVersion: 1, security: 'mutual-tls13', protocols: ['tcp', 'udp'],
        handshakeTimeoutSeconds: 5, idleTimeoutSeconds: 60, maxFrameBytes: 65536, maxUdpDatagramBytes: 16384, maxConnectionsPerNode: 128 } }; profile.configDigest = digest(profile.config);
    const forward: core.Forward = { id: 'forward', scopeId: 'scope', revision: 1, spec: { enabled: true, protocols: ['tcp', 'udp'], ingress: { nodeId: 'node', listen: { address: '127.0.0.1', port: 22001 } },
        target: { host: '127.0.0.1', port: 80 }, path: { via: ['egress'] }, transport: { profileId: 'profile', configRevision: 1 } } };
    const nodes: any = ['node', 'egress'].map((nodeId, index) => ({ facts: { nodeId, scopeId: 'scope', capabilities: ['adp.3', 'native.relay.v1', 'relay.wire.1', 'tcp', 'udp'],
        allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [22001], egressPolicyRevision: 1, allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false },
        sessionEpoch: index + 1, credentialUntil: at + 60000, peers: [{ fingerprint: 'sha256:' + String(index + 1).repeat(64), validUntil: at + 60000 }] }));
    const endpoint = { nodeId: 'egress', revision: 1, config: { listenAddress: '127.0.0.1', advertisedHost: '127.0.0.1', allowedTcpPorts: [23001, 23002] } };
    const reservations = compileRelayResources(forward, nodes.map((node: Any) => node.facts), profile as any, endpoint, { tcp: 23001, udp: 23002 }).map((value, index) => ({ ...value, forwardId: 'forward', deploymentGeneration: 1, bindingFence: index + 1 }));
    const relay = compileRelayPlan({ forward, nodes, profile: profile as any, endpoint, reservations, issuedAt: sample.capturedAt, drainTimeoutSeconds: 30 });
    const multiInput = multihopFixture(3), multi = compileMultihopPlan(multiInput);
    for (const [plan, scopeId, issuedAt] of [[relay, 'scope', sample.capturedAt], [multi, 'scope-a', multiInput.issuedAt]] as const) {
        const node = plan.nodes.find(value => value.assignments.some(assignment => assignment.role.endsWith('-ingress')))!, until = Date.parse(issuedAt) + 60000, snapshot = compileSnapshot({ nodeId: node.nodeId, sessionEpoch: node.sessionEpoch, snapshotGeneration: 1,
            issuedAt, validUntil: new Date(until).toISOString(), assignments: node.assignments, tombstones: [] });
        const points = node.assignments.map(assignment => ({ ...execution('forward').point, identity: { nodeId: node.nodeId, bootId: 'boot', sessionEpoch: node.sessionEpoch,
            assignmentId: assignment.assignmentId, forwardId: assignment.forwardId, forwardRevision: assignment.forwardRevision, deploymentGeneration: assignment.deploymentGeneration,
            bindingFence: assignment.bindingFence, role: assignment.role, protocol: assignment.protocol, driverId: assignment.driver.id,
            driverSchemaVersion: assignment.driver.schemaVersion, configDigest: assignment.driver.configDigest, resource: assignment.resource } }));
        for (const badScope of [false, true]) {
            const h = harness(), mapper = new (h.load('mysql-forward-telemetry-mapping.ts').MySqlForwardTelemetryMapping)();
            const scope = badScope ? 'foreign' : scopeId;
            h.answers.push([{ scope_id: scope, snapshot_generation: 1, generation: 1, session_epoch: node.sessionEpoch, valid_until: until, body: JSON.stringify(snapshot) }],
                [{ id: node.assignments[0]!.forwardId, scope_id: scope, recovery_suspended: 0 }]);
            const action = mapper.resolve(h.tx, { nodeId: node.nodeId, bootId: 'boot', sessionEpoch: node.sessionEpoch }, points);
            if (badScope) await assert.rejects(action, { code: 'INTEGRITY_FAILURE' });
            else { const result = await action; assert.equal(result.length, 2); assert.deepEqual(result.map((value: Any) => value.identity), points.map(point => point.identity)); assert.ok(result.every((value: Any) => value.scopeId === scopeId && value.source === 'current-published')); }
        }
    }
});

for (const family of ['forward', 'probe'] as const) {
    const table = family + '_telemetry', file = `mysql-${family}-telemetry.ts`, cls = family === 'forward' ? 'MySqlForwardTelemetryStore' : 'MySqlProbeTelemetryStore';
    const columns = mappedColumns + (family === 'probe' ? ',probe_instance,instance_until' : '') + ',recovery_suspended';
    test(`76 ${family} mapped raw append binds provenance and digest evicts bounded oldest surplus then advances accepted rejected head`, async () => {
        const h = harness(), store = new (h.load(file)[cls])(), e = execution(family); h.answers.push([{ total: '4096' }]);
        await store.append(h.tx, 'scope', e.input, e.accepted, hash, at);
        assert.deepEqual(h.events.slice(0, 3).map(event => event.sql), [`DELETE FROM ${table}_points WHERE node_id=? AND received_at<? ORDER BY received_at,sample_epoch,sequence,item_index LIMIT 256`,
            `SELECT COUNT(*) total FROM ${table}_points WHERE node_id=?`, `DELETE FROM ${table}_points WHERE node_id=? ORDER BY received_at,sample_epoch,sequence,item_index LIMIT 1`]);
        assert.deepEqual(h.events[0]!.args, ['node', at - 86400000]);
        assert.equal(h.events[3]!.sql, `INSERT INTO ${table}_points(${columns}) VALUES (${Array(family === 'forward' ? 19 : 21).fill('?').join(',')},FALSE)`);
        const args = h.events[3]!.args; assert.deepEqual(args.slice(0, 14), ['node', 'scope', 'forward', 1, 'boot', epoch, 1, 0, at, at, at, 1000, digest(e.point.identity), epoch]);
        assert.deepEqual(JSON.parse(args[14] as string), e.point); const exporter = JSON.parse(args[15] as string);
        assert.equal(args[16], digest({ point: e.point, exporter, mappingSource: e.mapping.source, publishedUntil: at + 60000,
            ...(family === 'probe' ? { probeInstance: 'current-registered', instanceUntil: at + 30000 } : {}) }));
        assert.deepEqual(args.slice(17), family === 'forward' ? ['current-published', at + 60000] : ['published-snapshot', at + 60000, 'current-registered', at + 30000]);
        assert.deepEqual(h.events[4]!.args, ['scope', 1, 'boot', epoch, 1, 1000, hash, at, at, '0', 1, 0, 'node']);
        assert.equal(h.events[4]!.sql, `UPDATE ${table}_heads SET scope_id=?,session_epoch=?,boot_id=?,sample_epoch=?,last_sequence=?, last_uptime_ms=?,last_digest=?,last_received_at=?,last_captured_at=?,dropped_samples=?,accepted_points=?,rejected_points=? WHERE node_id=?`);
        const empty = harness(), emptyStore = new (empty.load(file)[cls])(); empty.answers.push([{ total: 0 }]); await emptyStore.append(empty.tx, 'scope', e.input, [], hash, at);
        assert.equal(empty.events.filter(event => event.sql.startsWith('INSERT INTO')).length, 0); assert.deepEqual(empty.events.at(-1)!.args.slice(-3), [0, 1, 'node']);
        for (const accepted of [[{ ...e.accepted[0], index: 1 }], [e.accepted[0], e.accepted[0]], [{ ...e.accepted[0], mapping: { ...e.mapping, scopeId: 'other' } }],
            [{ ...e.accepted[0], mapping: { ...e.mapping, forwardRecoverySuspended: true } }]]) {
            const invalid = harness(), invalidStore = new (invalid.load(file)[cls])(); await assert.rejects(invalidStore.append(invalid.tx, 'scope', e.input, accepted, hash, at), { code: 'INTEGRITY_FAILURE' }); assert.equal(invalid.events.length, 0);
        }
    });

    test(`76 ${family} mapped node collection deduplicates requests rejects foreign rows and locks bounded accepted rejected counters`, async () => {
        const h = harness(), store = new (h.load(file)[cls])(), e = execution(family); h.answers.push([nodeRow]);
        assert.equal((await store.nodes(h.tx, ['node', 'node'])).length, 1); assert.deepEqual(h.events[0]!.args, ['node']);
        assert.equal(h.events[0]!.sql, 'SELECT n.id,n.scope_id,n.revoked,n.credential_until,r.session_epoch,r.boot_id FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE n.id IN (?)');
        h.answers.push([headRow]); const head = await store.lockHead(h.tx, 'scope', e.input); assert.equal(head.acceptedPoints, 0);
        assert.equal(h.events[1]!.sql, `INSERT INTO ${table}_heads(node_id,scope_id,session_epoch,boot_id,sample_epoch) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE node_id=VALUES(node_id)`); assert.equal(h.events[2]!.sql, `SELECT * FROM ${table}_heads WHERE node_id=? FOR UPDATE`);
        h.answers.push([{ ...headRow, accepted_points: 32, rejected_points: 1 }]); await assert.rejects(store.lockHead(h.tx, 'scope', e.input), { code: 'INTEGRITY_FAILURE' });
        h.answers.push([{ ...nodeRow, id: 'foreign' }]); await assert.rejects(store.nodes(h.tx, ['node']), { code: 'INTEGRITY_FAILURE' });
        await assert.rejects(store.nodes(h.tx, Array(515).fill('node')), { code: 'INTEGRITY_FAILURE' });
        h.answers.push([{ id: 'forward', scope_id: 'scope', revision: '1', deleting: 0, recovery_suspended: 1 }]); assert.deepEqual(await store.forward(h.tx, 'scope', 'forward'), { forwardId: 'forward', scopeId: 'scope', revision: 1, deleting: false, recoverySuspended: true });
    });

    test(`76 ${family} mapped history and latest pair use inclusive retention stable order null-safe counter epoch and strict previous tuple`, async () => {
        const h = harness(), store = new (h.load(file)[cls])(); await store.history(h.tx, 'scope', 'forward', at, at + 1, 2);
        assert.equal(h.events[0]!.sql, `SELECT ${columns} FROM ${table}_points WHERE scope_id=? AND forward_id=? AND received_at>=? AND received_at<=? ORDER BY received_at,node_id,sample_epoch,sequence,item_index LIMIT 3`); assert.deepEqual(h.events[0]!.args, ['scope', 'forward', at, at + 1]);
        const raw = { node_id: 'node', scope_id: 'scope', forward_id: 'forward', session_epoch: 1, boot_id: 'boot', sample_epoch: epoch, sequence: 2,
            item_index: 0, received_at: at + 1000, captured_at: at + 1000, sample_captured_at: at + 1000, uptime_ms: 2000, identity_digest: hash, counter_epoch: null,
            body: '{}', exporter: '{}', digest: hash, mapping_source: family === 'forward' ? 'current-published' : 'published-snapshot', published_until: at + 60000,
            probe_instance: 'not-rechecked', instance_until: null, recovery_suspended: 0 };
        h.answers.push([raw], [{ ...raw, sequence: 1, received_at: at }]); const pair = await store.latest(h.tx, 'scope', 'forward', at); assert.deepEqual(pair.map((row: Any) => row.sequence), [2, 1]);
        assert.equal(h.events[1]!.sql, `SELECT ${columns} FROM ${table}_points WHERE scope_id=? AND forward_id=? AND received_at>=? ORDER BY received_at DESC,node_id DESC,sample_epoch DESC,sequence DESC,item_index DESC LIMIT 1`);
        assert.equal(h.events[2]!.sql, `SELECT ${columns} FROM ${table}_points WHERE scope_id=? AND forward_id=? AND received_at>=? AND identity_digest=? AND counter_epoch<=>? AND NOT(node_id=? AND sample_epoch=? AND sequence=? AND item_index=?) AND (received_at,node_id,sample_epoch,sequence,item_index)<(?,?,?,?,?) ORDER BY received_at DESC,node_id DESC,sample_epoch DESC,sequence DESC,item_index DESC LIMIT 1`);
        assert.deepEqual(h.events[2]!.args, ['scope', 'forward', at, hash, null, 'node', epoch, 2, 0, at + 1000, 'node', epoch, 2, 0]);
        await store.prune(h.tx, at); assert.equal(h.events[3]!.sql, `DELETE FROM ${table}_points WHERE received_at<? ORDER BY received_at LIMIT 256`);
        for (const change of [{ item_index: 32 }, { sample_epoch: 'A'.repeat(32) }, { recovery_suspended: false }, { mapping_source: 'foreign' }, { body: '"' + 'x'.repeat(4097) + '"' }]) {
            h.answers.push([{ ...raw, ...change }]); await assert.rejects(store.history(h.tx, 'scope', 'forward', at, at + 1, 1), { code: 'INTEGRITY_FAILURE' });
        }
    });
}

const databaseURL = process.env.TUNEX_TEST_DATABASE_URL;
const nativeTables = ['telemetry_heads', 'telemetry_points', 'host_telemetry_heads', 'host_telemetry_points', 'forward_telemetry_heads', 'forward_telemetry_points',
    'probe_telemetry_heads', 'probe_telemetry_points', 'telemetry_rollup_scope_heads', 'telemetry_rollup_heads', 'telemetry_rollup_cursors', 'telemetry_rollup_buckets'];
async function nativeSnapshot(tx: Transaction) {
    const result: Any = {};
    for (const table of nativeTables) result[table] = (await mysqlRows<Any>(tx, `SELECT * FROM ${table}`)).map(row => JSON.stringify(row)).sort();
    return result;
}
function afterWrite(tx: Transaction, after: number, calls: string[], failure: Error): Transaction {
    let count = 0;
    return new Proxy(tx, { get(target, key) {
        if (key === 'execute') return async (sql: string, args: unknown[] = []) => { const result = await target.execute(sql, args);
            if (/^\s*(INSERT|UPDATE|DELETE)\b/.test(sql)) { calls.push(sql); if (++count === after) throw failure; } return result; };
        const member = Reflect.get(target, key, target); return typeof member === 'function' ? member.bind(target) : member;
    } });
}
async function canonicalDatabase(action: (db: MySqlUnitOfWork) => Promise<void>) {
    const name = 'tunex_telemetry_' + randomUUID().replaceAll('-', ''), admin = await createConnection(databaseURL!), url = new URL(databaseURL!); url.pathname = '/' + name;
    const db = new MySqlUnitOfWork(url.toString()); let created = false;
    try {
        await admin.query(`CREATE DATABASE \`${name}\``); created = true; await db.migrate();
        await db.transaction(async tx => {
            await mysqlWrite(tx, 'INSERT INTO accounts(id,token_hash) VALUES(?,?)', ['owner', '0'.repeat(64)]);
            await mysqlWrite(tx, 'INSERT INTO scopes(id,owner_id) VALUES(?,?)', ['scope', 'owner']);
            await mysqlWrite(tx, 'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts) VALUES(?,?,?,?,?)', ['node', 'scope', '1'.repeat(64), at + 60000, '{}']);
            await mysqlWrite(tx, 'INSERT INTO forwards(id,scope_id,revision,spec) VALUES(?,?,?,?)', ['forward', 'scope', 1, '{}']);
        });
        await action(db);
    } finally { try { await db.close(); if (created) await admin.query(`DROP DATABASE \`${name}\``); } finally { await admin.end(); } }
}

test('76 77 real canonical MySQL raw and rollup every successful native write followed by failure restores all twelve telemetry tables', { skip: !databaseURL, timeout: 300000 }, async () => canonicalDatabase(async db => {
    const node = new MySqlTelemetryStore(), host = new MySqlHostTelemetryStore(), forward = new MySqlForwardTelemetryStore(), probe = new MySqlProbeTelemetryStore(), rollups = new MySqlTelemetryRollups();
    const nodeSample: any = { ...sample, telemetryVersion: 1, kind: 'telemetry-sample', platform: 'linux',
        process: { goroutines: 1, heapAllocBytes: '2', runtimeBytes: '3', cpuTimeNanos: '4', maxRssBytes: null, openFileDescriptors: null },
        runtime: { snapshotGeneration: 1, authorizationActive: false, tcpStreams: '0', udpAssociations: '0', drainingInstances: 0 } };
    const hostSample: any = { ...sample, hostTelemetryVersion: 1, kind: 'host-telemetry-sample', platform: 'linux', host: { scope: 'agent-visible-os',
        cpu: { availability: 'unsupported', logicalProcessors: null, totalTicks: null, idleTicks: null, ioWaitTicks: null }, memory: { availability: 'unsupported', totalBytes: null, availableBytes: null },
        load: { availability: 'unsupported', oneMilli: null, fiveMilli: null, fifteenMilli: null }, filesystem: { availability: 'unsupported', scope: 'agent-root-filesystem', totalBytes: null, availableBytes: null },
        network: { availability: 'unsupported', scope: 'agent-network-namespace', limit: 16, available: 0, returned: 0, omitted: 0, truncated: false, interfaces: [] } } };
    const f = execution('forward'), p = execution('probe'), obs = processObservation('scope', nodeSample, at);
    const tasks: Array<[string, (tx: Transaction) => Promise<unknown>]> = [
        ['node-intake', async tx => { await node.lockHead(tx, 'scope', nodeSample); await node.append(tx, 'scope', nodeSample, digest(nodeSample), at); await rollups.append(tx, [obs]); }],
        ['host-intake', async tx => { await host.lockHead(tx, 'scope', hostSample); await host.append(tx, 'scope', hostSample, digest(hostSample), at); await rollups.append(tx, [hostObservation('scope', hostSample, at)]); }],
        ['forward-intake', async tx => { await forward.lockHead(tx, 'scope', f.input as any); await forward.append(tx, 'scope', f.input as any, f.accepted as any, digest(f.input), at); await rollups.append(tx, forwardObservations('scope', f.input as any, [f.point] as any, at)); }],
        ['probe-intake', async tx => { await probe.lockHead(tx, 'scope', p.input as any); await probe.append(tx, 'scope', p.input as any, p.accepted as any, digest(p.input), at); await rollups.append(tx, probeObservations('scope', p.input as any, [p.point] as any, at)); }],
    ];
    const sentinel = new Error('count successful native writes then rollback'), failure = new Error('fail immediately after successful native write');
    async function verify(name: string, action: (tx: Transaction) => Promise<unknown>) {
        const baseline = await db.transaction(nativeSnapshot), calls: string[] = [];
        await assert.rejects(db.transaction(async tx => { await action(afterWrite(tx, Infinity, calls, failure)); throw sentinel; }), error => error === sentinel);
        assert.ok(calls.length > 0, name);
        for (let after = 1; after <= calls.length; after++) { await assert.rejects(db.transaction(tx => action(afterWrite(tx, after, [], failure))), error => error === failure); assert.deepEqual(await db.transaction(nativeSnapshot), baseline, name + ' after write ' + after); }
    }
    for (const [name, action] of tasks) await verify(name, action);
    for (const [, action] of tasks) await db.transaction(action);
    for (const [name, action] of [
        ['node-prune', (tx: Transaction) => node.prune(tx, at + 1)], ['host-prune', (tx: Transaction) => host.prune(tx, at + 1)],
        ['forward-prune', (tx: Transaction) => forward.prune(tx, at + 1)], ['probe-prune', (tx: Transaction) => probe.prune(tx, at + 1)],
        ['rollup-prune', (tx: Transaction) => rollups.prune(tx, at + 2592000000 + 3600001)],
    ] as const) await verify(name, action);
    const capacity = await db.transaction(tx => rollups.capacity(tx, 'scope')); assert.deepEqual(capacity, { minuteRows: 4, hourRows: 4, cursorRows: 4, nodeFamilies: 4 });
    const history = await db.transaction(tx => node.history(tx, 'scope', 'node', at, at, 1)); assert.equal(history.length, 1); assert.equal(history[0]!.receivedAt, at);
    // The lower adapter accepts owner-owned values/limits. A one-row budget
    // exercises every eviction SQL branch against the canonical schema; the
    // default production capacities are asserted separately in owner tests.
    const bounded = new MySqlTelemetryRollupStorage({ ...telemetryRollupStorageValues, limits: { ...telemetryRollupStorageValues.limits,
        maxMinuteRowsPerNodeFamily: 1, maxHourRowsPerNodeFamily: 1, maxCursorRowsPerNodeFamily: 1 } });
    const newSeries = processObservation('scope', { ...nodeSample, sampleEpoch: 'd'.repeat(32) }, at + 10000);
    await verify('rollup-minute-hour-cursor-eviction', tx => bounded.append(tx, [newSeries]));
    await db.transaction(tx => bounded.append(tx, [newSeries]));
    assert.deepEqual(await db.transaction(tx => rollups.losses(tx, 'scope', 'process', 'node')), { minuteEvicted: '1', hourEvicted: '1', cursorEvicted: '1', cursorExpired: '0' });
    assert.deepEqual(await db.transaction(tx => rollups.capacity(tx, 'scope')), capacity);
    const recovery = new MySqlTelemetryRecoveryStore(); await verify('all-telemetry-recovery-quarantine', tx => recovery.quarantineRecovery(tx));
    // Exercise successful expiry + quota eviction + insert + checkpoint writes at
    // the original native capacities, then fail after each statement separately.
    for (const family of ['node', 'host', 'forward', 'probe'] as const) {
        const table = family === 'node' ? 'telemetry_points' : family + '_telemetry_points', count = family === 'node' || family === 'host' ? 8640 : 4096;
        const columns = family === 'node' || family === 'host' ? pointColumns : mappedColumns + (family === 'probe' ? ',probe_instance,instance_until' : '') + ',recovery_suspended';
        const names = columns.split(',');
        await db.transaction(async tx => {
            const copies = JSON.stringify(Array.from({ length: count - 1 }, (_, index) => index + 2));
            await mysqlWrite(tx, `INSERT INTO ${table}(${columns}) SELECT ${names.map(name => name === 'sequence' ? 'seed.sequence_value' : 'p.' + name).join(',')}
                FROM ${table} p CROSS JOIN JSON_TABLE(?,'$[*]' COLUMNS(sequence_value BIGINT PATH '$')) seed WHERE p.node_id=? AND p.sequence=1`, [copies, 'node']);
            await mysqlWrite(tx, `INSERT INTO ${table}(${columns}) SELECT ${names.map(name => name === 'sequence' ? '?' : name === 'received_at' ? '?' : 'p.' + name).join(',')}
                FROM ${table} p WHERE p.node_id=? AND p.sequence=1`, [count + 1, at - 86400001, 'node']);
        });
        const next = { ...(family === 'node' ? nodeSample : family === 'host' ? hostSample : family === 'forward' ? f.input : p.input), sequence: count + 2, uptimeMs: 11000 };
        const store: any = family === 'node' ? node : family === 'host' ? host : family === 'forward' ? forward : probe;
        const action = async (tx: Transaction) => { await store.lockHead(tx, 'scope', next); if (family === 'node' || family === 'host') await store.append(tx, 'scope', next, digest(next), at + 10000);
            else await store.append(tx, 'scope', next, family === 'forward' ? f.accepted : p.accepted, digest(next), at + 10000); };
        await verify(family + '-native-quota-expire-evict', action);
        await db.transaction(action);
        const [total] = await db.transaction(tx => mysqlRows<{ n: number }>(tx, `SELECT COUNT(*) n FROM ${table}`)); assert.equal(total!.n, count);
        const [old] = await db.transaction(tx => mysqlRows<{ n: number }>(tx, `SELECT COUNT(*) n FROM ${table} WHERE sequence IN (?,?)`, [1, count + 1])); assert.equal(old!.n, 0);
    }
}));
