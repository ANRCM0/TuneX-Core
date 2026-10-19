import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as core from '@tunex/core';
import * as framework from '../src/framework/public.ts';
import { nativeValueDigest as digest } from '../src/compatibility/public.ts';
import { TelemetryRollups, processObservation, hostObservation, parseTelemetryObservation, parseTelemetryRollupBucket, foldTelemetryRollup, telemetryRollupStorageValues, TELEMETRY_ROLLUP_LIMITS } from '../src/modules/telemetry-owner/public.ts';
import type { NodeTelemetrySample } from '../src/compatibility/public.ts';

type Any = Record<string, any>;
const at = 1800000000000, key = 'sha256:' + 'a'.repeat(64);
const sample: NodeTelemetrySample = { telemetryVersion: 1, kind: 'telemetry-sample', nodeId: 'node', bootId: 'boot', sessionEpoch: 1,
    sampleEpoch: 'a'.repeat(32), sequence: 1, capturedAt: new Date(at).toISOString(), uptimeMs: 1000, platform: 'linux', droppedSamples: '0',
    process: { goroutines: 2, heapAllocBytes: '3', runtimeBytes: '4', cpuTimeNanos: '5', maxRssBytes: null, openFileDescriptors: null },
    runtime: { snapshotGeneration: 1, authorizationActive: false, tcpStreams: '0', udpAssociations: '0', drainingInstances: 0 } };
const observation = processObservation('scope', sample, at + 1000);
const bucket = foldTelemetryRollup(null, null, observation, 'minute');
const losses = { minuteEvicted: '0', hourEvicted: '0', cursorEvicted: '0', cursorExpired: '0' };
const query = { family: 'process', from: new Date(at).toISOString(), to: new Date(at + 60000).toISOString(), limit: '1' };
test('77 native Host projection pairs metrics and CPU context while missing CPU never invents an increment interval', () => {
    const host: any = { ...sample, hostTelemetryVersion: 1, kind: 'host-telemetry-sample', host: { scope: 'agent-visible-os',
        cpu: { availability: 'available', logicalProcessors: 2, totalTicks: '100', idleTicks: '50', ioWaitTicks: '10' },
        memory: { availability: 'available', totalBytes: '1000', availableBytes: '700' }, load: { availability: 'available', oneMilli: '1', fiveMilli: '2', fifteenMilli: '3' },
        filesystem: { availability: 'available', scope: 'agent-root-filesystem', totalBytes: '2000', availableBytes: '900' },
        network: { availability: 'available', scope: 'agent-network-namespace', limit: 16, available: 2, returned: 1, omitted: 1, truncated: true, interfaces: [] } } };
    delete host.telemetryVersion; delete host.process; delete host.runtime;
    const first = hostObservation('scope', host, at);
    assert.deepEqual(first.gauges, { logicalProcessors: '2', memoryTotalBytes: '1000', memoryAvailableBytes: '700', filesystemTotalBytes: '2000', filesystemAvailableBytes: '900', loadOneMilli: '1', loadFiveMilli: '2', loadFifteenMilli: '3', networkAvailableInterfaces: '2', networkReturnedInterfaces: '1' });
    assert.deepEqual(first.counters, { totalTicks: '100', idleTicks: '50', ioWaitTicks: '10' }); assert.equal(first.counterContext, '2');
    for (const variant of ['same', 'context', 'missing', 'reset'] as const) {
        const next = structuredClone(host); next.sequence = 2; next.uptimeMs = 2000; next.capturedAt = new Date(at + 1000).toISOString();
        Object.assign(next.host.cpu, { totalTicks: '110', idleTicks: '53', ioWaitTicks: '11' });
        if (variant === 'context') next.host.cpu.logicalProcessors = 4;
        if (variant === 'missing') next.host.cpu = { availability: 'unsupported', logicalProcessors: null, totalTicks: null, idleTicks: null, ioWaitTicks: null };
        if (variant === 'reset') Object.assign(next.host.cpu, { totalTicks: '101', idleTicks: '53', ioWaitTicks: '11' });
        const current = hostObservation('scope', next, at + 1000), value = foldTelemetryRollup(null, first, current, 'minute');
        if (variant === 'same') { assert.equal(value.increments.totalTicks!.sum, '10'); assert.equal(value.increments.idleTicks!.sum, '3'); assert.equal(value.coverage.intervalCount, 1); }
        else { assert.deepEqual(value.increments, {}); assert.equal(value.coverage.intervalCount, 0); assert.equal(value.coverage.elapsedMs, 0); }
        assert.equal(value.quality[variant === 'reset' ? 'counterReset' : 'continuous'], 1);
    }
    for (const patch of [{ counterContext: '4' }, { counters: { totalTicks: '100' } }, { counters: { totalTicks: '50', idleTicks: '50', ioWaitTicks: '10' } },
        { gauges: { ...first.gauges, memoryAvailableBytes: '1001' } }, { gauges: { ...first.gauges, filesystemTotalBytes: undefined } },
        { gauges: { ...first.gauges, networkReturnedInterfaces: '3' } }, { gauges: { logicalProcessors: '2', loadOneMilli: '1' } }]) assert.throws(() => parseTelemetryObservation({ ...first, ...patch }));
});

test('77 bucket parser preserves reachable wide sums and rejects decimal128 maximum when count and metric extrema cannot explain it', () => {
    const wide = '340282366920938463463374607431768211455', max = '18446744073709551615';
    const bounded = { ...bucket, sampleCount: 1000000, quality: { ...bucket.quality, baseline: 1000000 }, gauges: { ...bucket.gauges,
        heapAllocBytes: { count: 1000000, sum: wide, min: '0', max, elapsedMs: 0 } } };
    assert.throws(() => parseTelemetryRollupBucket(bounded), 'decimal128 lexical maximum cannot exceed max metric times bounded sample count');
    const reachable = (BigInt(max) * 1000000n).toString();
    assert.equal(parseTelemetryRollupBucket({ ...bounded, gauges: { ...bounded.gauges, heapAllocBytes: { ...bounded.gauges.heapAllocBytes, sum: reachable } } }).gauges.heapAllocBytes!.sum, reachable);
    for (const stats of [{ count: 1000000, sum: '340282366920938463463374607431768211456', min: '0', max, elapsedMs: 0 },
        { count: 1, sum: '3', min: '4', max: '3', elapsedMs: 0 }, { count: 1, sum: '3', min: '3', max: '3', elapsedMs: 1 },
        { count: 0, sum: '0', min: '0', max: '0', elapsedMs: 0 }]) assert.throws(() => parseTelemetryRollupBucket({ ...bucket, gauges: { ...bucket.gauges, heapAllocBytes: stats } }));
});
function owner() {
    const tx = {}, trace: string[] = [], state: Any = { now: at + 1000, rows: [], losses: { ...losses }, target: { nodeId: 'node', scopeId: 'scope' },
        counts: { minuteRows: 1, hourRows: 2, cursorRows: 3, nodeFamilies: 4 }, denied: false };
    const same = (actual: unknown, name: string) => { assert.equal(actual, tx); trace.push(name); };
    const db = { async transaction(action: any) { trace.push('begin'); try { const result = await action(tx); trace.push('commit'); return result; } catch (e) { trace.push('rollback'); throw e; } } };
    const auth = { async scope(actual: unknown, actor: string, scope: string) { same(actual, 'scope'); assert.deepEqual([actor, scope], ['reader', 'scope']); if (state.denied) throw new framework.ControlError('AUTHORIZATION_DENIED', 403, 'denied'); } };
    const store = { async history(actual: unknown, window: unknown) { same(actual, 'history'); state.window = window; return state.rows; },
        async losses(actual: unknown, ...args: unknown[]) { same(actual, 'losses'); state.lossArgs = args; return state.losses; },
        async capacity(actual: unknown, scope: string) { same(actual, 'capacity'); assert.equal(scope, 'scope'); return state.counts; },
        async prune(actual: unknown, now: number) { same(actual, 'prune'); assert.equal(now, state.now); return 7; }, async append() {} };
    const targets = { async node(actual: unknown, node: string) { same(actual, 'node'); assert.equal(node, 'node'); return state.target; },
        async forward(actual: unknown, scope: string, forward: string) { same(actual, 'forward'); assert.deepEqual([scope, forward], ['scope', 'forward']); return state.target; } };
    return { service: new TelemetryRollups(db, auth, store, targets, true, () => state.now), tx, state, trace };
}

test('77 aggregate history authorizes in its transaction and returns canonical exclusive pagination without issuing authority', async () => {
    const f = owner(), second = foldTelemetryRollup(null, null, { ...observation, receivedAt: at + 61000 }, 'minute');
    f.state.rows = [{ body: bucket, recoverySuspended: true }, { body: second, recoverySuspended: false }];
    const input = { ...query, to: new Date(at + 120000).toISOString() };
    f.state.now = at + 61000;
    const result = await f.service.history('reader', 'scope', 'node', 'node', input);
    assert.deepEqual(f.trace, ['begin', 'scope', 'node', 'history', 'losses', 'commit']);
    assert.deepEqual(f.state.window, { scopeId: 'scope', family: 'process', resolution: 'minute', kind: 'node', targetId: 'node', from: at, to: at + 120000, limit: 1, seriesKey: null, after: null });
    assert.deepEqual(f.state.lossArgs, ['scope', 'process', 'node']);
    assert.equal(result.executionAuthorized, false); assert.equal(result.health, 'unknown'); assert.equal(result.window.truncated, true);
    assert.deepEqual(result.items, [{ body: bucket, recoverySuspended: true }]); assert.ok(Object.isFrozen(result.items));
    assert.deepEqual(JSON.parse(Buffer.from(result.window.nextAfter!, 'base64url').toString()), { start: at, nodeId: 'node', seriesKey: bucket.seriesKey });
    f.state.now += 1000; f.state.rows = [{ body: second, recoverySuspended: false }];
    const next = await f.service.history('reader', 'scope', 'node', 'node', { ...input, after: result.window.nextAfter! });
    assert.equal(next.window.nextAfter, null); assert.equal(next.window.truncated, false); assert.equal(next.items[0]!.body.start, at + 60000);
});
test('77 aggregate Forward hourly queries keep scope-family loss attribution and original default aligned minute windows', async () => {
    const f = owner(); f.state.target = { scopeId: 'scope', forwardId: 'forward' };
    const result = await f.service.history('reader', 'scope', 'forward', 'forward', { family: 'forward', resolution: 'hour', from: new Date(at).toISOString(), to: new Date(at + 3600000).toISOString() });
    assert.deepEqual(f.trace, ['begin', 'scope', 'forward', 'history', 'losses', 'commit']); assert.deepEqual(f.state.lossArgs, ['scope', 'forward', null]);
    assert.equal(result.losses.scope, 'scope-family'); assert.equal(f.state.window.resolution, 'hour'); assert.equal(result.window.limit, 128);
    const defaults = owner(); await defaults.service.history('reader', 'scope', 'node', 'node', { family: 'host' });
    assert.deepEqual(defaults.state.window, { scopeId: 'scope', family: 'host', resolution: 'minute', kind: 'node', targetId: 'node',
        from: at + 60000 - 3600000, to: at + 60000, limit: 128, seriesKey: null, after: null });
});

test('77 aggregate query rejects incompatible families unaligned UTC windows malformed cursors unknown keys and oversized limits before storage', async () => {
    for (const input of [{ ...query, family: 'forward' }, { ...query, resolution: 'day' }, { ...query, from: new Date(at + 1).toISOString() },
        { ...query, to: query.from }, { ...query, limit: '513' }, { ...query, limit: '01' }, { ...query, limit: '1\n' },
        { ...query, after: 'e30' }, { ...query, after: '=' }, { ...query, seriesKey: 'invalid' }, { ...query, extra: 'value' },
        { ...query, from: new Date(at).toISOString().replace('.000Z', 'Z') }]) {
        const f = owner(); await assert.rejects(f.service.history('reader', 'scope', 'node', 'node', input), { code: 'INVALID_CONFIG' }); assert.deepEqual(f.trace, []);
    }
});

test('77 aggregate history detects persisted scope family target ordering duplicates suspension and loss corruption', async () => {
    for (const rows of [[{ body: { ...bucket, scopeId: 'other' }, recoverySuspended: false }], [{ body: bucket, recoverySuspended: 1 }],
        [{ body: bucket, recoverySuspended: false }, { body: bucket, recoverySuspended: false }], [{ body: { ...bucket, sampleCount: 0 }, recoverySuspended: false }]]) {
        const f = owner(); f.state.rows = rows; await assert.rejects(f.service.history('reader', 'scope', 'node', 'node', query), { code: 'INTEGRITY_FAILURE' }); assert.equal(f.trace.at(-1), 'rollback');
    }
    for (const bad of ['-1', '01', '340282366920938463463374607431768211456', 0, '0\n']) {
        const f = owner(); f.state.losses.minuteEvicted = bad;
        await assert.rejects(f.service.history('reader', 'scope', 'node', 'node', query), { code: 'INTEGRITY_FAILURE' });
    }
    const denied = owner(); denied.state.denied = true;
    await assert.rejects(denied.service.history('reader', 'scope', 'node', 'node', query), { code: 'AUTHORIZATION_DENIED' }); assert.deepEqual(denied.trace, ['begin', 'scope', 'rollback']);
    const missing = owner(); missing.state.target = null;
    await assert.rejects(missing.service.history('reader', 'scope', 'node', 'node', query), { code: 'NOT_FOUND' }); assert.deepEqual(missing.trace, ['begin', 'scope', 'node', 'rollback']);
});

test('77 aggregate capacity preserves over-budget inspection and exact wide logical budgets plus reader cooldown', async () => {
    const f = owner(); f.state.counts.minuteRows = TELEMETRY_ROLLUP_LIMITS.maxMinuteRowsPerScope + 1;
    const result = await f.service.capacity('reader', 'scope');
    assert.deepEqual(f.trace, ['begin', 'scope', 'capacity', 'commit']); assert.deepEqual(result.observed, f.state.counts);
    assert.equal(result.logicalBudget.maxBucketJsonBytesPerNode, ((10081n + 721n) * 4n * 8192n).toString());
    assert.equal(result.logicalBudget.maxCursorJsonBytesPerNode, (512n * 4n * 8192n).toString());
    assert.equal(result.logicalBudget.maxBucketJsonBytesPerScope, (550000n * 8192n).toString());
    assert.equal(result.logicalBudget.rawMaxJsonBytesPerNode, (2n * 8640n * 8192n + 2n * 4096n * 6144n).toString());
    assert.equal(result.logicalBudget.scopeRawHardCap, false); assert.equal(result.logicalBudget.physicalBytesMeasured, false);
    await assert.rejects(f.service.capacity('reader', 'scope'), { code: 'TELEMETRY_AGGREGATE_RATE_LIMIT' });
    f.state.now += 1000; f.state.counts = { ...f.state.counts, cursorRows: -1 };
    await assert.rejects(f.service.capacity('reader', 'scope'), { code: 'INTEGRITY_FAILURE' });
    assert.equal(await f.service.prune(), 7);
});

test('77 aggregate four request slots reject the fifth and release slots after success and failure', async () => {
    const f = owner(); let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; });
    const held = Array.from({ length: 4 }, () => f.service.admitReadRequest(() => barrier));
    await assert.rejects(f.service.admitReadRequest(async () => 5), { code: 'TELEMETRY_AGGREGATE_BUSY' });
    release(); await Promise.all(held);
    await assert.rejects(f.service.admitReadRequest(async () => { throw new Error('expected'); }), /expected/);
    assert.equal(await f.service.admitReadRequest(async () => 6), 6);
});

test('77 aggregate reader keys retain128 cooldown entries use exact1000ms cleanup and reject canonical cursor target mismatches', async () => {
    const f = owner();
    for (let index = 0; index < 128; index++) (f.service as any).readStarts.set('actor-' + index, f.state.now);
    await assert.rejects(f.service.capacity('reader', 'scope'), { code: 'TELEMETRY_AGGREGATE_RATE_LIMIT' }); assert.equal(f.trace.length, 0);
    f.state.now += 999; await assert.rejects(f.service.capacity('reader', 'scope'), { code: 'TELEMETRY_AGGREGATE_RATE_LIMIT' });
    f.state.now += 1; await f.service.capacity('reader', 'scope'); assert.equal((f.service as any).readStarts.size, 1);
    for (const cursor of [{ start: at, nodeId: 'foreign', seriesKey: bucket.seriesKey }, { start: at + 1, nodeId: 'node', seriesKey: bucket.seriesKey },
        { start: at - 60000, nodeId: 'node', seriesKey: bucket.seriesKey }, { start: at, nodeId: 'node', seriesKey: key }]) {
        const g = owner(), after = Buffer.from(JSON.stringify(cursor)).toString('base64url');
        await assert.rejects(g.service.history('reader', 'scope', 'node', 'node', { ...query, seriesKey: bucket.seriesKey, after }), { code: 'INVALID_CONFIG' }); assert.equal(g.trace.length, 0);
    }
});

function sqlHarness(limits: Any = TELEMETRY_ROLLUP_LIMITS) {
    const tx = {}, events: Array<{ sql: string; args: unknown[]; kind: string }> = [], answers: any[][] = [], affected: number[] = [];
    const sql = (value: string) => value.replace(/\s+/g, ' ').trim();
    const rows = async (actual: unknown, statement: string, args: unknown[]) => { assert.equal(actual, tx); events.push({ kind: 'rows', sql: sql(statement), args }); return answers.shift() ?? []; };
    const write = async (actual: unknown, statement: string, args: unknown[]) => { assert.equal(actual, tx); events.push({ kind: 'write', sql: sql(statement), args }); return affected.shift() ?? 1; };
    const exports: Any = {};
    const javascript = ts.transpileModule(readFileSync(new URL('../src/infrastructure/mysql-telemetry-rollup-storage.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
    new vm.Script('(function(exports,Buffer,require){\n' + javascript + '\n})').runInThisContext()(exports, Buffer, (name: string) => {
        if (name === '@tunex/core') return core; if (name === '@tunex/contracts/shared') return { digest };
        if (name === '@tunex/contracts/observability') return { telemetryUint64: (value: unknown) => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) && BigInt(value) <= 18446744073709551615n };
        if (name === '../framework/public.ts') return framework;
        if (name === './mysql.ts') return { rows, write, json: (value: unknown) => typeof value === 'string' ? JSON.parse(value) : value };
        throw new Error('Unexpected adapter import ' + name);
    });
    return { tx, events, answers, affected, Lower: exports.MySqlTelemetryRollupStorage, store: new exports.MySqlTelemetryRollupStorage({ ...telemetryRollupStorageValues, limits }) };
}
function stored(body: Any = bucket) { return { scope_id: body.scopeId, node_id: body.nodeId, family: body.family, resolution: body.resolution,
    bucket_start: String(body.start), series_key: body.seriesKey, forward_id: body.forwardId, body: JSON.stringify(body), digest: digest(body), recovery_suspended: 0 }; }

test('77 original zero-argument SQL wrapper initializes one native values provider lazily and all instances delegate caller transaction to it', async () => {
    const h = sqlHarness(), exports: Any = {}; let constructors = 0;
    class Lower extends h.Lower { constructor(values: unknown) { super(values); constructors++; assert.equal(values, telemetryRollupStorageValues); } }
    const javascript = ts.transpileModule(readFileSync(new URL('../src/infrastructure/mysql-telemetry-rollups.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
    new vm.Script('(function(exports,require){\n' + javascript + '\n})').runInThisContext()(exports, (name: string) => {
        if (name === './mysql-telemetry-rollup-storage.ts') return { MySqlTelemetryRollupStorage: Lower };
        assert.equal(name, '../modules/telemetry-owner/public.ts'); return { telemetryRollupStorageValues };
    });
    assert.equal(constructors, 1); assert.equal(h.events.length, 0); const first = new exports.MySqlTelemetryRollups(), second = new exports.MySqlTelemetryRollups();
    assert.equal(constructors, 1); assert.deepEqual(Object.getOwnPropertyNames(exports.MySqlTelemetryRollups.prototype), ['constructor', 'append', 'history', 'losses', 'capacity', 'prune']);
    assert.equal(first.append, second.append); assert.deepEqual(Object.keys(first), []);
    await first.append(h.tx, []); assert.equal(h.events.length, 0);
    h.answers.push([]); assert.deepEqual(await first.history(h.tx, { scopeId: 'scope', family: 'process', resolution: 'minute', kind: 'node', targetId: 'node', from: at, to: at + 60000, limit: 1, seriesKey: null, after: null }), []);
    h.answers.push([{ minute_evicted: '0', hour_evicted: '0', cursor_evicted: '0', cursor_expired: '0' }]); assert.deepEqual(await second.losses(h.tx, 'scope', 'process', 'node'), losses);
    h.answers.push([{ m: 0, h: 0 }], [{ n: 0 }], [{ n: 0 }]); assert.deepEqual(await first.capacity(h.tx, 'scope'), { minuteRows: 0, hourRows: 0, cursorRows: 0, nodeFamilies: 0 });
    h.answers.push([]); assert.equal(await second.prune(h.tx, at), 0); assert.equal(constructors, 1);
});

test('77 lower aggregate history uses exact target series cursor filters exclusive bounds deterministic ordering and limit plus one', async () => {
    const h = sqlHarness(), w = { scopeId: 'scope', family: 'process', resolution: 'minute', kind: 'node', targetId: 'node', from: at, to: at + 60000, limit: 2, seriesKey: bucket.seriesKey, after: { start: at, nodeId: 'node', seriesKey: bucket.seriesKey } };
    h.answers.push([stored()]); assert.deepEqual(await h.store.history(h.tx, w), [{ body: bucket, recoverySuspended: false }]);
    assert.equal(h.events[0]!.sql, 'SELECT scope_id,node_id,family,resolution,bucket_start,series_key,forward_id,body,digest,recovery_suspended FROM telemetry_rollup_buckets WHERE scope_id=? AND family=? AND resolution=? AND node_id=? AND bucket_start>=? AND bucket_start<? AND series_key=? AND (bucket_start,node_id,series_key)>(?,?,?) ORDER BY bucket_start,node_id,series_key LIMIT 3');
    assert.deepEqual(h.events[0]!.args, ['scope', 'process', 'minute', 'node', at, at + 60000, bucket.seriesKey, at, 'node', bucket.seriesKey]);
    h.answers.push([]); await h.store.history(h.tx, { ...w, kind: 'forward', targetId: 'forward', seriesKey: null, after: null });
    assert.equal(h.events[1]!.sql, 'SELECT scope_id,node_id,family,resolution,bucket_start,series_key,forward_id,body,digest,recovery_suspended FROM telemetry_rollup_buckets WHERE scope_id=? AND family=? AND resolution=? AND forward_id=? AND bucket_start>=? AND bucket_start<? ORDER BY bucket_start,node_id,series_key LIMIT 3');
    for (const change of [{ digest: key }, { recovery_suspended: '0' }, { bucket_start: String(at + 1) }, { node_id: 'other' }, { body: '{}' }, { family: 'unknown' }]) {
        const next = sqlHarness(); next.answers.push([{ ...stored(), ...change }]); await assert.rejects(next.store.history(next.tx, w), { code: 'INTEGRITY_FAILURE' });
    }
});

test('77 lower aggregate loss sums are decimal128 and capacity inspection accepts over budget data but rejects corrupt counts', async () => {
    const h = sqlHarness(), raw = { minute_evicted: '340282366920938463463374607431768211455', hour_evicted: '0', cursor_evicted: 0, cursor_expired: '1' };
    h.answers.push([raw]); assert.deepEqual(await h.store.losses(h.tx, 'scope', 'host', null), { minuteEvicted: raw.minute_evicted, hourEvicted: '0', cursorEvicted: '0', cursorExpired: '1' });
    assert.equal(h.events[0]!.sql, 'SELECT COALESCE(SUM(CAST(minute_evicted AS DECIMAL(39,0))),0) minute_evicted, COALESCE(SUM(CAST(hour_evicted AS DECIMAL(39,0))),0) hour_evicted, COALESCE(SUM(CAST(cursor_evicted AS DECIMAL(39,0))),0) cursor_evicted, COALESCE(SUM(CAST(cursor_expired AS DECIMAL(39,0))),0) cursor_expired FROM telemetry_rollup_heads WHERE scope_id=? AND family=?');
    h.answers.push([raw]); await h.store.losses(h.tx, 'scope', 'host', 'node'); assert.deepEqual(h.events[1]!.args, ['scope', 'host', 'node']); assert.ok(h.events[1]!.sql.endsWith(' AND node_id=?'));
    for (const value of ['01', '-1', '1\n', '340282366920938463463374607431768211456', 0.5]) { const next = sqlHarness(); next.answers.push([{ ...raw, minute_evicted: value }]); await assert.rejects(next.store.losses(next.tx, 'scope', 'process', null), { code: 'INTEGRITY_FAILURE' }); }
    h.answers.push([{ m: '500001', h: '50001' }], [{ n: '16385' }], [{ n: '4097' }]);
    assert.deepEqual(await h.store.capacity(h.tx, 'scope'), { minuteRows: 500001, hourRows: 50001, cursorRows: 16385, nodeFamilies: 4097 });
    assert.deepEqual(h.events.slice(2).map(event => event.sql), ["SELECT COUNT(CASE WHEN resolution='minute' THEN 1 END) m, COUNT(CASE WHEN resolution='hour' THEN 1 END) h FROM telemetry_rollup_buckets WHERE scope_id=?", 'SELECT COUNT(*) n FROM telemetry_rollup_cursors WHERE scope_id=?', 'SELECT COUNT(*) n FROM telemetry_rollup_heads WHERE scope_id=?']);
});

test('77 lower aggregate append validates empty duplicate mixed-owner batches before SQL and persists head buckets cursor markers in order', async () => {
    const h = sqlHarness(); await h.store.append(h.tx, []); assert.equal(h.events.length, 0);
    for (const input of [[observation, observation], [{ ...observation, receivedAt: -1 }], Array(33).fill(observation)]) { await assert.rejects(h.store.append(h.tx, input)); assert.equal(h.events.length, 0); }
    h.answers.push([{ scope_id: 'scope' }], [], [{ sm: '0', sh: '0', nm: '0', nh: '0' }], [{ sc: '0', nc: '0' }], [{ n: '0' }], [], []);
    await h.store.append(h.tx, [observation]);
    assert.equal(h.events[0]!.sql, 'INSERT INTO telemetry_rollup_scope_heads(scope_id) VALUES(?) ON DUPLICATE KEY UPDATE scope_id=VALUES(scope_id)');
    assert.equal(h.events[1]!.sql, 'SELECT scope_id FROM telemetry_rollup_scope_heads WHERE scope_id=? FOR UPDATE');
    assert.equal(h.events[8]!.sql, 'INSERT INTO telemetry_rollup_heads(node_id,family,scope_id) VALUES(?,?,?)');
    assert.deepEqual(h.events[8]!.args, ['node', 'process', 'scope']);
    const writes = h.events.filter(event => event.kind === 'write');
    assert.equal(writes.length, 5); assert.ok(writes[2]!.sql.endsWith('recovery_suspended=telemetry_rollup_buckets.recovery_suspended OR VALUES(recovery_suspended)'));
    assert.deepEqual(writes[2]!.args.slice(0, 7), ['scope', 'node', 'process', 'minute', at, bucket.seriesKey, null]);
    assert.deepEqual(JSON.parse(writes[2]!.args[7] as string), bucket); assert.equal(writes[2]!.args[8], digest(bucket));
    assert.deepEqual(writes[3]!.args, ['node', 'process', observation.seriesKey, 'scope', observation.receivedAt, JSON.stringify(observation), digest(observation)]);
    assert.deepEqual(writes[4]!.args, ['0', '0', '0', '0', 'node', 'process']);
});

test('77 lower aggregate prune chooses oldest scope serializes it expires 128 cursors with saturated grouped loss and spends remaining 256 budget', async () => {
    const h = sqlHarness(), cursorBefore = at - 86400000;
    h.answers.push([{ scope_id: 'scope' }], [{ scope_id: 'scope' }], [{ node_id: 'node', family: 'process', series_key: key }]); h.affected.push(1, 1, 1, 2);
    assert.equal(await h.store.prune(h.tx, at), 3);
    assert.deepEqual(h.events[0]!.args, [at - 604800000 - 60000, at - 2592000000 - 3600000, cursorBefore]);
    assert.ok(h.events[0]!.sql.endsWith('eligible ORDER BY candidate_at,scope_id LIMIT 1'));
    assert.equal(h.events[3]!.sql, 'SELECT node_id,family,series_key FROM telemetry_rollup_cursors WHERE scope_id=? AND last_received_at<? ORDER BY last_received_at,node_id,family,series_key LIMIT 128');
    assert.deepEqual(h.events[3]!.args, ['scope', cursorBefore]);
    assert.deepEqual(h.events[4]!.args, ['scope', 'node', 'process', key]);
    assert.equal(h.events[5]!.sql, 'UPDATE telemetry_rollup_heads SET cursor_expired=LEAST(18446744073709551615,cursor_expired+ CASE WHEN node_id=? AND family=? THEN ? ELSE 0 END) WHERE scope_id=? AND (node_id,family) IN ((?,?))');
    assert.deepEqual(h.events[5]!.args, ['node', 'process', 1, 'scope', 'node', 'process']);
    assert.ok(h.events[6]!.sql.endsWith('ORDER BY bucket_start,node_id,family,resolution,series_key LIMIT 255'));
    const empty = sqlHarness(); empty.answers.push([]); assert.equal(await empty.store.prune(empty.tx, at), 0); assert.equal(empty.events.length, 1);
});

test('77 lower aggregate append evicts minute hour and cursor oldest rows excludes incoming keys saturates losses and binds deletions', async () => {
    const limits = { ...TELEMETRY_ROLLUP_LIMITS, maxMinuteRowsPerNodeFamily: 1, maxHourRowsPerNodeFamily: 1, maxCursorRowsPerNodeFamily: 1 }, h = sqlHarness(limits);
    const max = '18446744073709551615';
    h.answers.push([{ scope_id: 'scope' }], [{ scope_id: 'scope', minute_evicted: max, hour_evicted: '0', cursor_evicted: '0', cursor_expired: '0' }],
        [{ sm: 1, sh: 1, nm: 1, nh: 1 }], [{ sc: 1, nc: 1 }], [{ n: 1 }], [], [],
        [{ bucket_start: at - 60000, series_key: key }], [{ bucket_start: at - 3600000, series_key: key }], [{ series_key: key, last_received_at: at }]);
    await h.store.append(h.tx, [observation]);
    assert.equal(h.events[8]!.sql, 'SELECT bucket_start,series_key FROM telemetry_rollup_buckets WHERE node_id=? AND family=? AND resolution=? AND NOT(bucket_start=? AND series_key IN (?)) ORDER BY bucket_start,series_key LIMIT 1');
    assert.deepEqual(h.events[8]!.args, ['node', 'process', 'minute', at, observation.seriesKey]);
    assert.equal(h.events[9]!.sql, 'DELETE FROM telemetry_rollup_buckets WHERE node_id=? AND family=? AND resolution=? AND (bucket_start,series_key) IN ((?,?))');
    assert.deepEqual(h.events[9]!.args, ['node', 'process', 'minute', at - 60000, key]);
    assert.deepEqual(h.events[10]!.args, ['node', 'process', 'hour', at, observation.seriesKey]); assert.deepEqual(h.events[11]!.args, ['node', 'process', 'hour', at - 3600000, key]);
    assert.equal(h.events[12]!.sql, 'SELECT series_key,last_received_at FROM telemetry_rollup_cursors WHERE node_id=? AND family=? AND series_key NOT IN (?) ORDER BY last_received_at,series_key LIMIT 1');
    assert.equal(h.events[13]!.sql, 'DELETE FROM telemetry_rollup_cursors WHERE node_id=? AND family=? AND series_key IN (?)'); assert.deepEqual(h.events[13]!.args, ['node', 'process', key]);
    assert.deepEqual(h.events.at(-1)!.args, [max, '1', '1', '0', 'node', 'process']);
});

test('77 lower aggregate Scope row and head caps fail before persistence and exact-count eviction guards abort corrupt selection', async () => {
    for (const mode of ['head-cap', 'scope-cap', 'wrong-scope', 'missing-lock', 'missing-count', 'missing-eviction', 'short-delete'] as const) {
        const limits = { ...TELEMETRY_ROLLUP_LIMITS, maxMinuteRowsPerNodeFamily: 1 }, h = sqlHarness(limits);
        h.answers.push(mode === 'missing-lock' ? [] : [{ scope_id: 'scope' }]);
        if (mode !== 'missing-lock') h.answers.push(mode === 'head-cap' ? [] : [{ scope_id: mode === 'wrong-scope' ? 'other' : 'scope', minute_evicted: '0', hour_evicted: '0', cursor_evicted: '0', cursor_expired: '0' }]);
        h.answers.push(mode === 'missing-count' ? [] : [{ sm: mode === 'scope-cap' ? 500000 : 1, sh: 0, nm: mode === 'scope-cap' ? 0 : 1, nh: 0 }], [{ sc: 0, nc: 0 }], [{ n: mode === 'head-cap' ? 4096 : 1 }], [], []);
        if (mode === 'missing-eviction') h.answers.push([]);
        if (mode === 'short-delete') { h.answers.push([{ bucket_start: at - 60000, series_key: key }]); h.affected.push(1, 0); }
        await assert.rejects(h.store.append(h.tx, [observation]), { code: mode === 'head-cap' || mode === 'scope-cap' ? 'TELEMETRY_AGGREGATE_CAPACITY' : 'INTEGRITY_FAILURE' });
        assert.equal(h.events.some(event => event.sql.startsWith('INSERT INTO telemetry_rollup_buckets')), false, mode);
    }
});

test('77 lower aggregate cursor expiry resets baseline only after strict TTL while existing bucket recovery suspension stays sticky', async () => {
    for (const elapsed of [86400000, 86400001]) {
        const h = sqlHarness(), now = at + elapsed, current = processObservation('scope', { ...sample, sequence: 2, uptimeMs: elapsed + 1000, capturedAt: new Date(now).toISOString() }, now);
        const previous = processObservation('scope', sample, at);
        const prior = { node_id: 'node', family: 'process', series_key: previous.seriesKey, scope_id: 'scope', last_received_at: at, body: JSON.stringify(previous), digest: digest(previous) };
        h.answers.push([{ scope_id: 'scope' }], [{ scope_id: 'scope', minute_evicted: '0', hour_evicted: '0', cursor_evicted: '0', cursor_expired: '0' }], [{ sm: 0, sh: 0, nm: 0, nh: 0 }], [{ sc: 1, nc: 1 }], [{ n: 1 }], [prior], []);
        await h.store.append(h.tx, [current]);
        assert.deepEqual(h.events.at(-1)!.args, ['0', '0', '0', elapsed === 86400000 ? '0' : '1', 'node', 'process']);
        const inserted = h.events.find(event => event.sql.startsWith('INSERT INTO telemetry_rollup_buckets'))!;
        const body = JSON.parse(inserted.args[7] as string); assert.equal(body.quality[elapsed === 86400000 ? 'continuous' : 'baseline'], 1);
        assert.ok(inserted.sql.includes('recovery_suspended=telemetry_rollup_buckets.recovery_suspended OR VALUES(recovery_suspended)'));
    }
});
