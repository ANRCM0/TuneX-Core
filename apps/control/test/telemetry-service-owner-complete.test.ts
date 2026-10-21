import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as core from '@tunex/core';
import * as compatibility from '../src/compatibility/public.ts';
import * as framework from '../src/framework/public.ts';
import * as telemetry from '../src/modules/telemetry-owner/public.ts';
import { test } from 'node:test';
import { ForwardTelemetry, ProbeTelemetry, NodeTelemetry, HostTelemetry } from '../src/modules/telemetry-owner/public.ts';
import type { ResourceReadAccess } from '../src/framework/public.ts';
import { ResourceAccess } from '../src/modules/resource-access-owner/public.ts';
import { ControlError } from '../src/framework/public.ts';
import { nativeValueDigest as digest } from '../src/compatibility/public.ts';
import { NodeTelemetry as LegacyNode } from '../src/application/node-telemetry.ts';
import { HostTelemetry as LegacyHost } from '../src/application/host-telemetry.ts';
import { ForwardTelemetry as LegacyForward } from '../src/application/forward-telemetry.ts';
import { ProbeTelemetry as LegacyProbe } from '../src/application/probe-telemetry.ts';
import { TelemetryRollups as LegacyRollups } from '../src/application/telemetry-rollups.ts';
import { TelemetryRollups, telemetryRollupStorageValues, foldTelemetryRollup, forwardObservations, probeObservations, parseTelemetryObservation } from '../src/modules/telemetry-owner/public.ts';
import { telemetryRollupStorageValues as LegacyValues } from '../src/application/telemetry-rollup-storage-values.ts';
import { foldTelemetryRollup as LegacyFold } from '../src/modules/telemetry-rollup-values.ts';

type Any = Record<string, any>;
type Family = 'forward' | 'probe';
const at = 1800000000000, epoch = 'a'.repeat(32), hash = 'sha256:' + 'b'.repeat(64), fingerprint = 'b'.repeat(64);
const time = new Date(at).toISOString();
const intakeOnlyAccess: ResourceReadAccess<unknown> = {
    principal: async () => assert.fail('machine intake cannot request a read principal'),
    node: async () => assert.fail('machine intake cannot request Node read authority'),
    forward: async () => assert.fail('machine intake cannot request Forward read authority'),
    owned: async () => assert.fail('machine intake cannot request product ownership'),
};
test('75 77 legacy application and rollup value entrypoints retain exact owner identity without a competing implementation', () => {
    assert.equal(LegacyNode, NodeTelemetry); assert.equal(LegacyHost, HostTelemetry); assert.equal(LegacyForward, ForwardTelemetry);
    assert.equal(LegacyProbe, ProbeTelemetry); assert.equal(LegacyRollups, TelemetryRollups); assert.equal(LegacyValues, telemetryRollupStorageValues); assert.equal(LegacyFold, foldTelemetryRollup);
});
test('75 76 77 each original owner captures one default clock source lazily and preserves explicit clocks independent admission and native ACK dispatch', async () => {
    for (const [file, name, mapped, aggregate] of [['node.ts', 'NodeTelemetry', false, false], ['host.ts', 'HostTelemetry', false, false],
        ['forward.ts', 'ForwardTelemetry', true, false], ['probe.ts', 'ProbeTelemetry', true, false], ['rollups.ts', 'TelemetryRollups', false, true]] as const) {
        let factories = 0, reads = 0, acks = 0; const clock = () => { reads++; return at; };
        const exports: Any = {}, javascript = ts.transpileModule(readFileSync(new URL('../src/modules/telemetry-owner/' + file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
        const compat = { ...compatibility, nativeWallClockSource() { factories++; return clock; } };
        for (const key of ['nativeNodeTelemetryAck', 'nativeHostTelemetryAck', 'nativeForwardTelemetryAck', 'nativeProbeTelemetryAck'] as const) (compat as Any)[key] = (...args: any[]) => { acks++; return (compatibility[key] as any)(...args); };
        new vm.Script('(function(exports,require){\n' + javascript + '\n})').runInThisContext()(exports, (path: string) => {
            if (path === '@tunex/core') return core; if (path === '../../compatibility/public.ts') return compat; if (path === '../../framework/public.ts') return framework;
            if (path === './policy.ts' || path === './rollup-values.ts') return telemetry; throw new Error('Unexpected telemetry owner import ' + path);
        });
        const owner: any = exports[name], collaborators = [{}, {}, {}, {}, {}, ...(mapped ? [{}] : [])], service = new owner(...collaborators);
        assert.equal(factories, 1); assert.equal(reads, 0); assert.equal(service.enabled, false);
        assert.equal(service.now(), at); assert.equal(reads, 1);
        const second = new owner(...collaborators); assert.notEqual(service.readStarts, second.readStarts);
        assert.notEqual(aggregate ? service.keys : mapped ? service.activeKeys : service.activeNodes, aggregate ? second.keys : mapped ? second.activeKeys : second.activeNodes);
        assert.equal(factories, 2); const explicit = new owner(...collaborators, true, () => at + 1); assert.equal(factories, 2); assert.equal(explicit.now(), at + 1);
        for (const value of [NaN, -1, 1.5, 253402300800000, '0']) { explicit.clock = () => value; assert.throws(() => explicit.now(), { code: 'INTEGRITY_FAILURE' }); }
        let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
        const one = service.admitted('one', () => pending), two = service.admitted('two', () => pending);
        const code = aggregate ? 'TELEMETRY_AGGREGATE_BUSY' : name === 'NodeTelemetry' ? 'TELEMETRY_BUSY' : name === 'HostTelemetry' ? 'HOST_TELEMETRY_BUSY' : name === 'ForwardTelemetry' ? 'FORWARD_TELEMETRY_BUSY' : 'PROBE_TELEMETRY_BUSY';
        await assert.rejects(service.admitted('three', async () => 3), { code }); await assert.rejects(service.admitted('one', async () => 3), { code });
        release(); await Promise.all([one, two]); const failure = new Error('callback failure');
        await assert.rejects(service.admitted('one', async () => { throw failure; }), (error: unknown) => error === failure); assert.equal(await service.admitted('one', async () => 7), 7);
        assert.equal(service.active, 0);
        if (mapped) {
            const sample = input(file === 'forward.ts' ? 'forward' : 'probe');
            assert.throws(() => service.ack(sample, at, 0, 0), { code: 'INTEGRITY_FAILURE' }); assert.equal(acks, 0);
            const ack = service.ack(sample, at, 1, 0); assert.equal(acks, 1); assert.equal(ack.executionAuthorized, false); assert.equal(ack.receivedAt, time); assert.ok(Object.isFrozen(ack));
        }
    }
});
test('77 original mapped observations preserve exact accepted order membership markers and Probe attempted conservation', () => {
    for (const family of ['forward', 'probe'] as const) {
        const sample = input(family), project: any = family === 'forward' ? forwardObservations : probeObservations;
        const first = project('scope', sample, sample.items, at)[0];
        assert.equal(first.seriesKey, digest(first.series)); assert.deepEqual(first.series.execution, sample.items[0].identity);
        assert.equal(first.forwardId, 'forward'); assert.equal(first.counterContext, ''); assert.equal(first.capturedAt, at); assert.ok(Object.isFrozen(first));
        assert.deepEqual(first.gauges, family === 'forward' ? {} : { inFlight: '1' });
        const keys = family === 'forward' ? Object.keys(sample.items[0].counters) : ['attempted', 'succeeded', 'failed', 'unknown'];
        assert.deepEqual(Object.keys(first.counters), keys); assert.equal(first.counters.inFlight, undefined);
        const changed = structuredClone(sample); changed.sequence = 2; changed.uptimeMs = 2000; changed.items[0].capturedAt = new Date(at + 1000).toISOString();
        if (family === 'forward') changed.items[0].counters.payloadSentBytes = '19'; else { changed.items[0].counters.attempted = '5'; changed.items[0].counters.succeeded = '2'; }
        const second = project('scope', changed, changed.items, at + 2000)[0];
        const folded = foldTelemetryRollup(null, first, second, 'minute');
        assert.equal(folded.increments[family === 'forward' ? 'payloadSentBytes' : 'attempted']!.sum, family === 'forward' ? '9' : '1');
        assert.equal(folded.coverage.elapsedMs, 1000); assert.equal(folded.coverage.to, at + 2000);
        assert.deepEqual(project('scope', sample, [], at), []);
        const truncated = project('scope', { ...sample, coverage: { ...sample.coverage, truncated: true, tailsEvicted: '3', tailsExpired: '4' } }, sample.items, at)[0];
        assert.equal(truncated.truncated, true); assert.equal(truncated.tailsEvicted, '3'); assert.equal(truncated.tailsExpired, '4');
        if (family === 'probe') {
            assert.throws(() => parseTelemetryObservation({ ...first, counters: { ...first.counters, attempted: '5' } }));
            assert.doesNotThrow(() => parseTelemetryObservation({ ...first, overflowed: true, counters: { ...first.counters, attempted: '5' } }));
        }
        for (const malformed of [{ ...first, seriesKey: hash }, { ...first, counters: { ...first.counters, foreign: '0' } }, { ...first, gauges: { ...first.gauges, foreign: '0' } },
            { ...first, available: false }, { ...first, series: { ...first.series, bootId: 'foreign' } }]) assert.throws(() => parseTelemetryObservation(malformed));
    }
});
const coverage = { limit: 32, available: 1, returned: 1, omitted: 0, truncated: false, offset: 0, nextOffset: 0,
    unavailableSources: 0, tailLimit: 128, tailRetentionSeconds: 600, tailsEvicted: '0', tailsExpired: '0', historyComplete: false };
function input(family: Family): Any {
    const binding = { nodeId: 'node', bootId: 'boot', sessionEpoch: 1, assignmentId: 'assignment', forwardId: 'forward', forwardRevision: 1,
        deploymentGeneration: 1, bindingFence: 1, configDigest: hash };
    const point = family === 'forward' ? { identity: { ...binding, role: 'direct', protocol: 'tcp', driverId: 'native.direct.v1', driverSchemaVersion: 1,
        resource: { protocol: 'tcp', address: '127.0.0.1', port: 10001 } }, phase: 'active', counters: { payloadSentBytes: '10', payloadReceivedBytes: '20',
            tcpAccepted: '1', tcpConnected: '1', tcpClosed: '0', udpAssociationsCreated: '0', udpAssociationsClosed: '0', udpDatagramsSent: '0', udpDatagramsReceived: '0' } }
        : { identity: { binding: { ...binding, snapshotGeneration: 1, egressPolicyRevision: 1 }, instanceId: 'c'.repeat(64), instanceGeneration: 1 },
            counters: { attempted: '4', succeeded: '1', failed: '1', unknown: '1', inFlight: '1' } };
    return { [`${family}TelemetryVersion`]: 1, kind: `${family}-telemetry-sample`, nodeId: 'node', bootId: 'boot', sessionEpoch: 1,
        sampleEpoch: epoch, sequence: 1, capturedAt: time, uptimeMs: 1000, droppedSamples: '0',
        ...(family === 'forward' ? { snapshotGeneration: 1 } : {}),
        coverage: { ...coverage, ...(family === 'probe' ? { snapshotLimit: 2, retiringSourceLimit: 8, retiringSources: 0 } : {}) },
        items: [{ ...point, state: 'current', capturedAt: time, endedAt: null, availability: 'available', counterEpoch: epoch, overflowed: false }] };
}
function fixture(family: Family) {
    const tx = {}, trace: string[] = [], sample = input(family), state: Any = { now: at, denied: false, ownerActorId: 'reader', failRollup: false, rows: [], latest: [], observations: [],
        current: { nodeId: 'node', scopeId: 'scope', revoked: false, credentialUntil: at + 3600000, sessionEpoch: 1, bootId: 'boot' },
        forward: { scopeId: 'scope', forwardId: 'forward', revision: 1, deleting: false, recoverySuspended: false },
        head: { nodeId: 'node', scopeId: 'scope', sessionEpoch: 1, bootId: 'boot', sampleEpoch: epoch, lastSequence: 0,
            lastUptimeMs: 0, lastDigest: null, lastReceivedAt: 0, lastCapturedAt: 0, droppedSamples: '0', acceptedPoints: 0, rejectedPoints: 0 } };
    state.mappings = [{ scopeId: 'scope', identity: sample.items[0].identity, publishedUntil: at + 60000, forwardRecoverySuspended: false,
        ...(family === 'forward' ? { source: 'current-published' } : { source: 'published-snapshot', probeInstance: 'current-registered', instanceUntil: at + 60000 }) }];
    const check = (actual: unknown, name: string) => { assert.equal(actual, tx); trace.push(name); };
    const db = { async transaction(action: any) { const saved = structuredClone({ rows: state.rows, head: state.head, observations: state.observations }); trace.push('begin');
        try { const result = await action(tx); trace.push('commit'); return result; } catch (error) { Object.assign(state, saved); trace.push('rollback'); throw error; } } };
    const auth = { async scope(actual: unknown, actor: string, scope: string) { check(actual, 'scope'); assert.deepEqual([actor, scope], ['reader', 'scope']); if (state.denied) throw new ControlError('AUTHORIZATION_DENIED', 403, 'denied'); } };
    const access: ResourceReadAccess<typeof tx> = {
        async forward(actual, actor, scope, forward) {
            check(actual, 'access:forward'); assert.deepEqual([actor, scope, forward], ['reader', 'scope', 'forward']);
            if (state.ownerActorId !== actor) throw new ControlError('NOT_FOUND', 404, 'not found');
        },
        principal: async () => assert.fail('raw Forward history does not read Scope counters'),
        node: async () => assert.fail('Forward history must not disclose whole-host detail'),
        owned: async () => assert.fail('Forward history must not enter mutation ownership'),
    };
    const machine = { async credential(actual: unknown, node: string, fp: string) { check(actual, 'credential'); assert.deepEqual([node, fp], ['node', fingerprint]); if (state.denied) throw new ControlError('AUTHORIZATION_DENIED', 403, 'denied'); return 1; } };
    const store = { async node(actual: unknown) { check(actual, 'node'); return state.current; }, async lockHead(actual: unknown) { check(actual, 'head'); return state.head; },
        async append(actual: unknown, scope: string, value: Any, accepted: Any[], requestDigest: string, now: number) { check(actual, 'append'); assert.equal(scope, 'scope'); state.accepted = accepted;
            state.head = { ...state.head, sessionEpoch: value.sessionEpoch, bootId: value.bootId, sampleEpoch: value.sampleEpoch, lastSequence: value.sequence,
                lastUptimeMs: value.uptimeMs, lastDigest: requestDigest, lastReceivedAt: now, lastCapturedAt: Date.parse(value.capturedAt), droppedSamples: value.droppedSamples,
                acceptedPoints: accepted.length, rejectedPoints: value.items.length - accepted.length }; if (state.failAfterAppend) throw new Error('append failure'); },
        async forward(actual: unknown) { check(actual, 'forward'); return state.forward; },
        async history(actual: unknown, ...args: unknown[]) { check(actual, 'history'); state.window = args; return state.rows; },
        async latest(actual: unknown) { check(actual, 'latest'); return state.latest; },
        async nodes(actual: unknown, ids: string[]) { check(actual, 'nodes'); state.ids = ids; return state.nodes ?? (ids.includes('node') ? [state.current] : []); },
        async prune(actual: unknown, before: number) { check(actual, 'prune'); state.before = before; return 3; } };
    const mapping = { async resolve(actual: unknown, ...args: unknown[]) { check(actual, 'mapping'); state.mappingArgs = args; return state.mappings; } };
    const rollups = { async append(actual: unknown, observations: Any[]) { check(actual, 'rollups'); state.observations.push(...observations); if (state.failRollup) throw new Error('rollup failure'); } };
    const ctor: any = family === 'forward' ? ForwardTelemetry : ProbeTelemetry;
    return { service: new ctor(db, auth, access, machine, store, mapping, true, () => state.now, rollups), sample, state, trace };
}
function record(family: Family, sample: Any, receivedAt: number, changes: Any = {}): Any {
    const { items, nodeId, bootId, sessionEpoch, ...rest } = sample;
    const exporter = Object.fromEntries(Object.entries(rest).filter(([key]) => !['kind', `${family}TelemetryVersion`].includes(key)));
    const point = items[0], source = family === 'forward' ? 'current-published' : 'published-snapshot';
    const provenance = { point, exporter, mappingSource: source, publishedUntil: at + 60000,
        ...(family === 'probe' ? { probeInstance: 'current-registered', instanceUntil: at + 60000 } : {}) };
    const row = { nodeId, bootId, sessionEpoch, scopeId: 'scope', forwardId: 'forward', sampleEpoch: sample.sampleEpoch, sequence: sample.sequence,
        itemIndex: 0, receivedAt, capturedAt: Date.parse(point.capturedAt), sampleCapturedAt: Date.parse(sample.capturedAt), uptimeMs: sample.uptimeMs,
        identityDigest: digest(point.identity), counterEpoch: point.counterEpoch, ...provenance, digest: digest(provenance), recoverySuspended: false, ...changes };
    return row;
}

for (const family of ['forward', 'probe'] as const) {
    const prefix = family.toUpperCase() + '_TELEMETRY';
    test(`75 ${family} intake preserves same-transaction authentication mapping append rollup order and exact replay receipt`, async () => {
        const f = fixture(family), ack = await f.service.ingest('node', fingerprint, 1, f.sample);
        assert.deepEqual(f.trace, ['begin', 'credential', 'node', 'head', 'mapping', 'append', 'rollups', 'commit']);
        assert.equal(ack.acceptedPoints, 1); assert.equal(ack.rejectedPoints, 0); assert.equal(ack.executionAuthorized, false); assert.ok(Object.isFrozen(ack));
        assert.equal(f.state.observations[0].family, family); assert.equal(f.state.observations[0].scopeId, 'scope'); assert.ok(Object.isFrozen(f.state.accepted[0]));
        assert.deepEqual(f.state.mappingArgs[0], { nodeId: 'node', bootId: 'boot', sessionEpoch: 1, ...(family === 'probe' ? { fingerprint } : {}) });
        if (family === 'probe') assert.equal(f.state.mappingArgs[2], at);
        f.trace.length = 0; f.state.now += 10000;
        assert.deepEqual(await f.service.ingest('node', fingerprint, 1, f.sample), ack); assert.deepEqual(f.trace, ['begin', 'credential', 'node', 'head', 'commit']);
        assert.equal(f.state.observations.length, 1);
        f.state.failRollup = true; const next = structuredClone(f.sample); next.sequence = 2; next.uptimeMs = 11000; next.capturedAt = new Date(f.state.now).toISOString(); next.items[0].capturedAt = next.capturedAt;
        await assert.rejects(f.service.ingest('node', fingerprint, 1, next), /rollup failure/); assert.equal(f.state.head.lastSequence, 1); assert.equal(f.state.observations.length, 1); assert.equal(f.trace.at(-1), 'rollback');
    });

    test(`75 ${family} machine identity session clock rate epoch sequence and persisted-head guards precede mapping`, async () => {
        const denied = fixture(family); denied.state.denied = true; await assert.rejects(denied.service.ingest('node', fingerprint, 1, denied.sample), { code: 'AUTHORIZATION_DENIED' }); assert.deepEqual(denied.trace, ['begin', 'credential', 'rollback']);
        const identity = fixture(family); await assert.rejects(identity.service.ingest('other', fingerprint, 1, identity.sample), { code: 'AUTHORIZATION_DENIED' }); assert.deepEqual(identity.trace, []);
        for (const change of [{ revoked: true }, { bootId: 'other' }, { sessionEpoch: 2 }, { credentialUntil: at }]) {
            const f = fixture(family); Object.assign(f.state.current, change); await assert.rejects(f.service.ingest('node', fingerprint, 1, f.sample), { code: 'SESSION_SUPERSEDED' }); assert.ok(!f.trace.includes('head'));
        }
        const clock = fixture(family); clock.state.now = at + 300001; await assert.rejects(clock.service.ingest('node', fingerprint, 1, clock.sample), { code: prefix + '_CLOCK_SKEW' });
        for (const [change, code] of [[{ sampleEpoch: 'c'.repeat(32) }, '_EPOCH_CONFLICT'], [{ sequence: 1, droppedSamples: '1' }, '_SEQUENCE_CONFLICT'], [{ sequence: 2 }, '_SEQUENCE_CONFLICT']] as const) {
            const f = fixture(family); await f.service.ingest('node', fingerprint, 1, f.sample); f.trace.length = 0; Object.assign(f.sample, change);
            await assert.rejects(f.service.ingest('node', fingerprint, 1, f.sample), { code: prefix + code }); assert.ok(!f.trace.includes('mapping'));
        }
        const rate = fixture(family); await rate.service.ingest('node', fingerprint, 1, rate.sample); rate.sample.sequence = 2; rate.sample.uptimeMs = 2000; rate.state.now += 8999;
        await assert.rejects(rate.service.ingest('node', fingerprint, 1, rate.sample), { code: prefix + '_RATE_LIMIT' });
        const corrupt = fixture(family); corrupt.state.head.acceptedPoints = 33; await assert.rejects(corrupt.service.ingest('node', fingerprint, 1, corrupt.sample), { code: 'INTEGRITY_FAILURE' });
    });

    test(`75 ${family} missing suspended and aged mappings reject points while malformed trusted provenance aborts the batch`, async () => {
        for (const map of [null, { forwardRecoverySuspended: true }]) {
            const f = fixture(family); f.state.mappings = [map === null ? null : { ...f.state.mappings[0], ...map }];
            const ack = await f.service.ingest('node', fingerprint, 1, f.sample); assert.deepEqual([ack.acceptedPoints, ack.rejectedPoints], [0, 1]); assert.deepEqual(f.state.accepted, []); assert.deepEqual(f.state.observations, []);
        }
        const old = fixture(family); old.sample.items[0].capturedAt = new Date(at - 900001).toISOString();
        const oldAck = await old.service.ingest('node', fingerprint, 1, old.sample); assert.equal(oldAck.rejectedPoints, 1);
        for (const change of [{ scopeId: 'other' }, { identity: {} }, { publishedUntil: -1 }, { source: 'foreign' }, { forwardRecoverySuspended: 1 },
            ...(family === 'probe' ? [{ probeInstance: 'current-registered', instanceUntil: at }, { probeInstance: 'not-rechecked', instanceUntil: at + 1 }] : [])]) {
            const f = fixture(family); Object.assign(f.state.mappings[0], change); await assert.rejects(f.service.ingest('node', fingerprint, 1, f.sample), { code: 'INTEGRITY_FAILURE' }); assert.ok(!f.trace.includes('append'));
        }
        const count = fixture(family); count.state.mappings = []; await assert.rejects(count.service.ingest('node', fingerprint, 1, count.sample), { code: 'INTEGRITY_FAILURE' });
    });

    test(`75 ${family} history verifies stored digest and provenance then computes exact continuous deltas without current-binding authority`, async () => {
        const f = fixture(family), first = structuredClone(f.sample), second = structuredClone(f.sample); second.sequence = 2; second.uptimeMs += 1000;
        second.capturedAt = new Date(at + 1000).toISOString(); second.items[0].capturedAt = second.capturedAt;
        if (family === 'forward') second.items[0].counters.payloadSentBytes = '17'; else { second.items[0].counters.attempted = '5'; second.items[0].counters.succeeded = '2'; }
        f.state.now = at + 2000; const rows = [record(family, first, at), record(family, second, at + 1000)]; f.state.rows = rows; f.state.latest = [rows[1], rows[0]];
        const result = await f.service.history('reader', 'scope', 'forward');
        assert.deepEqual(f.trace, ['begin', 'scope', 'access:forward', 'forward', 'history', 'latest', 'nodes', 'commit']); assert.equal(result.items[0].delta.status, 'baseline'); assert.equal(result.items[1].delta.status, 'continuous');
        assert.equal(result.items[1].delta.elapsedMs, 1000); assert.equal(result.items[1].delta[family === 'forward' ? 'payloadSentBytes' : 'attempted'], family === 'forward' ? '7' : '1');
        if (family === 'probe') assert.equal(result.items[1].delta.inFlightBefore, '1');
        assert.equal(result.latest.mapping.currentBinding, 'not-rechecked'); assert.equal(result.executionAuthorized, false); assert.equal(result.health, 'unknown'); assert.equal(result.retention.historyComplete, false); assert.ok(Object.isFrozen(result));
        assert.deepEqual(f.state.ids, ['node']);
    });

    test(`75 ${family} history quality separates resets gaps terminal unavailable and historical sessions`, async () => {
        for (const variant of ['gap', 'counter-reset', 'overflowed', 'terminal', 'unavailable', 'historical'] as const) {
            const f = fixture(family), first = structuredClone(f.sample), second = structuredClone(f.sample); f.state.now = at + 2000;
            second.sequence = 2; second.uptimeMs = 2000; second.capturedAt = new Date(at + 1000).toISOString(); second.items[0].capturedAt = second.capturedAt;
            if (variant === 'gap') second.droppedSamples = '1';
            if (variant === 'counter-reset') second.uptimeMs = 500;
            if (variant === 'overflowed') second.items[0].overflowed = true;
            if (variant === 'terminal') { second.items[0].state = 'terminal'; second.items[0].endedAt = second.items[0].capturedAt; }
            if (variant === 'unavailable') Object.assign(second.items[0], { availability: 'unavailable', counters: null, counterEpoch: null, overflowed: null });
            if (variant === 'historical') f.state.current.revoked = true;
            f.state.rows = [record(family, first, at), record(family, second, at + 1000)];
            const result = await f.service.history('reader', 'scope', 'forward'); assert.equal(result.items[1].delta.status, variant); assert.equal(result.items[1].delta.elapsedMs, null);
        }
    });

    test(`75 ${family} history rejects corrupt row duplicates foreign nodes invalid window and cooldown before unsafe reads`, async () => {
        for (const change of [{ digest: hash }, { scopeId: 'other' }, { identityDigest: hash }, { sequence: 2 }, { itemIndex: 1 }, { publishedUntil: -1 }]) {
            const f = fixture(family); f.state.rows = [record(family, f.sample, at, change)]; await assert.rejects(f.service.history('reader', 'scope', 'forward'), { code: 'INTEGRITY_FAILURE' });
        }
        const dup = fixture(family); const row = record(family, dup.sample, at); dup.state.rows = [row, row]; await assert.rejects(dup.service.history('reader', 'scope', 'forward'), { code: 'INTEGRITY_FAILURE' });
        const nodes = fixture(family); nodes.state.rows = [record(family, nodes.sample, at)]; nodes.state.nodes = [{ ...nodes.state.current, nodeId: 'foreign' }]; await assert.rejects(nodes.service.history('reader', 'scope', 'forward'), { code: 'INTEGRITY_FAILURE' });
        for (const query of [{ limit: '513' }, { limit: '01' }, { extra: 'x' }, { to: time, from: time }]) { const f = fixture(family); await assert.rejects(f.service.history('reader', 'scope', 'forward', query), { code: 'INVALID_CONFIG' }); assert.deepEqual(f.trace, []); }
        const f = fixture(family); await f.service.history('reader', 'scope', 'forward'); await assert.rejects(f.service.history('reader', 'scope', 'forward'), { code: prefix + '_RATE_LIMIT' });
        assert.equal(await f.service.prune(), 3); assert.equal(f.state.before, at - 86400000);
    });
    test(`76 ${family} original private ACK failure after raw and accepted rollup callbacks restores caller transaction and releases active key`, async () => {
        for (const fault of ['append', 'rollup', 'ack'] as const) {
            const f = fixture(family), saved = structuredClone(f.state.head), originalAck = f.service.ack;
            if (fault === 'append') f.state.failAfterAppend = true;
            if (fault === 'rollup') f.state.failRollup = true;
            if (fault === 'ack') f.service.ack = () => { throw new Error('ack failure'); };
            await assert.rejects(f.service.ingest('node', fingerprint, 1, f.sample), new RegExp(fault + ' failure'));
            assert.deepEqual(f.state.head, saved); assert.deepEqual(f.state.observations, []); assert.equal(f.trace.at(-1), 'rollback'); assert.equal(f.service.active, 0);
            f.state.failAfterAppend = false; f.state.failRollup = false; f.service.ack = originalAck;
            assert.equal((await f.service.ingest('node', fingerprint, 1, f.sample)).acceptedPoints, 1);
        }
    });
    test(`76 ${family} stored nanosecond provenance forbids a point after exporter even when both truncate to the same SQL millisecond`, async () => {
        const f = fixture(family), body = structuredClone(f.sample);
        body.capturedAt = new Date(at).toISOString().replace('.000Z', '.000000001Z'); body.items[0].capturedAt = body.capturedAt;
        f.state.rows = [record(family, body, at)]; assert.equal((await f.service.history('reader', 'scope', 'forward')).items.length, 1);
        const bad = fixture(family), invalid = structuredClone(body); invalid.items[0].capturedAt = body.capturedAt.replace('000000001Z', '000000002Z');
        bad.state.rows = [record(family, invalid, at)]; await assert.rejects(bad.service.history('reader', 'scope', 'forward'), { code: 'INTEGRITY_FAILURE' });
        const latest = fixture(family), row = record(family, f.sample, at); latest.state.latest = [row, row];
        await assert.rejects(latest.service.history('reader', 'scope', 'forward'), { code: 'INTEGRITY_FAILURE' });
    });
}

for (const family of ['node', 'host'] as const) {
    function rawSample(): Any {
        const common = { nodeId: 'node', bootId: 'boot', sessionEpoch: 1, sampleEpoch: epoch, sequence: 1, capturedAt: time, uptimeMs: 1000, platform: 'linux', droppedSamples: '0' };
        return family === 'node' ? { ...common, telemetryVersion: 1, kind: 'telemetry-sample',
            process: { goroutines: 1, heapAllocBytes: '2', runtimeBytes: '3', cpuTimeNanos: '18446744073709551000', maxRssBytes: null, openFileDescriptors: null },
            runtime: { snapshotGeneration: 1, authorizationActive: false, tcpStreams: '0', udpAssociations: '0', drainingInstances: 0 } }
            : { ...common, hostTelemetryVersion: 1, kind: 'host-telemetry-sample', host: { scope: 'agent-visible-os',
                cpu: { availability: 'available', logicalProcessors: 2, totalTicks: '100', idleTicks: '50', ioWaitTicks: '10' },
                memory: { availability: 'unsupported', totalBytes: null, availableBytes: null }, load: { availability: 'unsupported', oneMilli: null, fiveMilli: null, fifteenMilli: null },
                filesystem: { availability: 'unsupported', scope: 'agent-root-filesystem', totalBytes: null, availableBytes: null },
                network: { availability: 'unsupported', scope: 'agent-network-namespace', limit: 16, available: 0, returned: 0, omitted: 0, truncated: false, interfaces: [] } } };
    }
    function rawRow(body: Any, receivedAt: number): Any { return { nodeId: 'node', scopeId: 'scope', sessionEpoch: body.sessionEpoch, bootId: body.bootId,
        sampleEpoch: body.sampleEpoch, sequence: body.sequence, capturedAt: Date.parse(body.capturedAt), receivedAt, uptimeMs: body.uptimeMs, body, digest: digest(body), recoverySuspended: false }; }
    function rawOwner() {
        const tx = {}, state: Any = { rows: [], latest: [], ownerActorId: 'reader', resourceSource: 'private', now: at + 2000, current: { nodeId: 'node', scopeId: 'scope', revoked: false, credentialUntil: at + 3600000, sessionEpoch: 1, bootId: 'boot' } }, trace: string[] = [];
        const check = (actual: unknown, name: string) => { assert.equal(actual, tx); trace.push(name); };
        const db = { async transaction(action: any) { trace.push('begin'); const value = await action(tx); trace.push('commit'); return value; } };
        const auth = { async scope(actual: unknown) { check(actual, 'scope'); } }, machine = { async credential() { return 1; } };
        const access: ResourceReadAccess<typeof tx> = {
            async node(actual, actor, scope, node, detail) {
                check(actual, 'access:host'); assert.deepEqual([actor, scope, node, detail], ['reader', 'scope', 'node', 'host']);
                if (state.resourceSource !== 'private' || state.ownerActorId !== actor) throw new ControlError('NOT_FOUND', 404, 'not found'); return 'full';
            },
            principal: async () => assert.fail('Node history must not inspect Scope totals'),
            forward: async () => assert.fail('Node history must not inspect Forward ownership'),
            owned: async () => assert.fail('Node history must not enter mutation ownership'),
        };
        const store = { async node(actual: unknown) { check(actual, 'node'); return state.current; }, async history(actual: unknown, ...args: unknown[]) { check(actual, 'history'); state.window = args; return state.rows; },
            async latest(actual: unknown) { check(actual, 'latest'); return state.latest; }, async prune() { return 0; }, async lockHead() { return {}; }, async append() {} };
        const ctor: any = family === 'node' ? NodeTelemetry : HostTelemetry;
        return { state, trace, service: new ctor(db, auth, access, machine, store, true, () => state.now) };
    }
    test(`75 ${family} history validates native body and wide arithmetic while preserving gap reset historical freshness and CPU unavailable meaning`, async () => {
        for (const variant of ['continuous', 'gap', 'counter-reset', 'historical', 'unavailable', 'stale'] as const) {
            const f = rawOwner(), before = rawSample(), current = rawSample(); current.sequence = 2; current.uptimeMs = 2000; current.capturedAt = new Date(at + 1000).toISOString();
            if (family === 'node') current.process.cpuTimeNanos = '18446744073709551009'; else Object.assign(current.host.cpu, { totalTicks: '110', idleTicks: '53', ioWaitTicks: '11' });
            if (variant === 'gap') current.droppedSamples = '1';
            if (variant === 'counter-reset') current.uptimeMs = 500;
            if (variant === 'historical') f.state.current.bootId = 'replacement';
            if (variant === 'unavailable') { if (family === 'node') current.process.cpuTimeNanos = null; else current.host.cpu = { availability: 'unsupported', logicalProcessors: null, totalTicks: null, idleTicks: null, ioWaitTicks: null }; }
            if (variant === 'stale') f.state.now = at + 31001;
            const rows = [rawRow(before, at), rawRow(current, at + 1000)]; f.state.rows = rows; f.state.latest = [rows[1], rows[0]];
            const result = await f.service.history('reader', 'scope', 'node');
            assert.deepEqual(f.trace, ['begin', 'scope', 'access:host', 'node', 'history', 'latest', 'commit']);
            const item = result.items[1], expected = variant === 'unavailable' || variant === 'stale' ? 'continuous' : variant;
            assert.equal(item.delta.status, expected); assert.equal(result.latest.delta.status, expected); assert.equal(result.executionAuthorized, false); assert.equal(result.health, 'unknown');
            const metric = family === 'node' ? 'cpuTimeNanos' : 'cpuTotalTicks';
            if (expected === 'continuous') assert.equal(item.delta[metric], variant === 'unavailable' ? null : family === 'node' ? '9' : '10');
            if (variant === 'stale' || variant === 'historical') assert.equal(item.freshness, variant);
            assert.ok(Object.isFrozen(item.delta));
        }
    });
    test(`75 ${family} shared whole-host and another user's private history stop before persisted rows`, async () => {
        for (const source of ['admin-shared', 'private']) {
            const f = rawOwner(); f.state.resourceSource = source; f.state.ownerActorId = source === 'private' ? 'other' : null;
            await assert.rejects(f.service.history('reader', 'scope', 'node'), { code: 'NOT_FOUND' });
            assert.deepEqual(f.trace, ['begin', 'scope', 'access:host']);
        }
    });
    test(`75 ${family} history rejects persisted digest association duplicated epoch sequence and out of order latest rows`, async () => {
        for (const change of [{ digest: hash }, { nodeId: 'foreign' }, { sequence: 2 }, { capturedAt: at + 1 }, { uptimeMs: 2 }, { recoverySuspended: 1 }, { body: {} }]) {
            const f = rawOwner(); f.state.rows = [{ ...rawRow(rawSample(), at), ...change }]; await assert.rejects(f.service.history('reader', 'scope', 'node'), { code: 'INTEGRITY_FAILURE' });
        }
        const duplicate = rawOwner(), row = rawRow(rawSample(), at); duplicate.state.rows = [row, row]; await assert.rejects(duplicate.service.history('reader', 'scope', 'node'), { code: 'INTEGRITY_FAILURE' });
        const order = rawOwner(); order.state.latest = [row, { ...row, receivedAt: at + 1 }]; await assert.rejects(order.service.history('reader', 'scope', 'node'), { code: 'INTEGRITY_FAILURE' });
        const clamp = rawOwner(); clamp.state.now = at + 86400000; clamp.state.current.credentialUntil = clamp.state.now + 60000;
        await clamp.service.history('reader', 'scope', 'node', { from: new Date(at - 1000).toISOString(), to: new Date(at + 1000).toISOString() });
        assert.deepEqual(clamp.state.window, ['scope', 'node', at, at + 1000, 128]);
    });
    test(`75 ${family} raw intake retains exact clock rate head and epoch guard precedence with old-session rollover`, async () => {
        const tx = {}, prefix = family === 'node' ? 'TELEMETRY' : 'HOST_TELEMETRY';
        function fixture() {
            const state: Any = { now: at, trace: [], current: { nodeId: 'node', scopeId: 'scope', revoked: false, credentialUntil: at + 3600000, sessionEpoch: 1, bootId: 'boot' },
                head: { nodeId: 'node', scopeId: 'scope', sessionEpoch: 1, bootId: 'boot', sampleEpoch: epoch, lastSequence: 0,
                    lastUptimeMs: 0, lastDigest: null, lastReceivedAt: 0, lastCapturedAt: 0, droppedSamples: '0' } };
            const check = (actual: unknown, name: string) => { assert.equal(actual, tx); state.trace.push(name); };
            const db = { async transaction(action: any) { state.trace.push('begin'); const value = await action(tx); state.trace.push('commit'); return value; } };
            const store = { async node(actual: unknown) { check(actual, 'node'); return state.current; }, async lockHead(actual: unknown) { check(actual, 'head'); return state.head; },
                async append(actual: unknown) { check(actual, 'append'); }, async history() { return []; }, async latest() { return []; }, async prune() { return 0; } };
            const ctor: any = family === 'node' ? NodeTelemetry : HostTelemetry;
            const service = new ctor(db, { async scope() {} }, intakeOnlyAccess, { async credential(actual: unknown) { check(actual, 'credential'); return 1; } }, store, true, () => { state.trace.push('clock'); return state.now; });
            return { state, service };
        }
        for (const [head, body, now, code] of [
            [{}, {}, at + 300001, prefix + '_CLOCK_SKEW'],
            [{ lastSequence: 1, lastUptimeMs: 1000, lastReceivedAt: at, lastDigest: hash }, { sequence: 2, uptimeMs: 2000 }, at + 8999, prefix + '_RATE_LIMIT'],
            [{ lastSequence: 1, lastUptimeMs: 1000, lastReceivedAt: at, lastDigest: hash }, { sequence: 2, uptimeMs: 2000 }, at - 1, prefix + '_RATE_LIMIT'],
            [{ lastSequence: 1, lastDigest: hash, sessionEpoch: 2 }, {}, at, 'SESSION_SUPERSEDED'],
            [{ lastSequence: 1, lastDigest: hash, bootId: 'other' }, {}, at, 'SESSION_SUPERSEDED'],
            [{ lastSequence: 1, lastDigest: hash, sessionEpoch: 0, bootId: 'prior' }, {}, at, 'INTEGRITY_FAILURE'],
            [{ scopeId: 'foreign' }, {}, at, 'INTEGRITY_FAILURE'], [{ lastSequence: -1 }, {}, at, 'INTEGRITY_FAILURE'],
            [{ droppedSamples: '01' }, {}, at, 'INTEGRITY_FAILURE'],
        ] as const) {
            const f = fixture(); Object.assign(f.state.head, head); f.state.now = now; const value = { ...rawSample(), ...body };
            await assert.rejects(f.service.ingest('node', fingerprint, 1, value), { code }); assert.ok(!f.state.trace.includes('append'));
        }
        const rollover = fixture(); rollover.state.current.sessionEpoch = 2; rollover.state.current.bootId = 'replacement';
        Object.assign(rollover.state.head, { lastSequence: 1, lastDigest: hash, lastReceivedAt: at - 10000 });
        const next = { ...rawSample(), sessionEpoch: 2, bootId: 'replacement', sampleEpoch: 'c'.repeat(32) };
        assert.equal((await rollover.service.ingest('node', fingerprint, 2, next)).executionAuthorized, false); assert.ok(rollover.state.trace.includes('append'));
        const conflict = fixture(); conflict.state.current.sessionEpoch = 2; conflict.state.current.bootId = 'replacement'; Object.assign(conflict.state.head, { lastSequence: 1, lastDigest: hash });
        await assert.rejects(conflict.service.ingest('node', fingerprint, 2, { ...next, sampleEpoch: epoch }), { code: prefix + '_EPOCH_CONFLICT' });
    });
    test(`75 ${family} reader map has128 slots rejects clock rollback cooldown and frees expired slots at exactly1000ms`, async () => {
        const f = rawOwner(), prefix = family === 'node' ? 'TELEMETRY' : 'HOST_TELEMETRY';
        for (let index = 0; index < 128; index++) f.service.readStarts.set('actor-' + index, f.state.now);
        await assert.rejects(f.service.history('reader', 'scope', 'node'), { code: prefix + '_RATE_LIMIT' }); assert.equal(f.trace.length, 0);
        f.state.now -= 1; await assert.rejects(f.service.history('reader', 'scope', 'node'), { code: prefix + '_RATE_LIMIT' });
        f.state.now += 1001; await f.service.history('reader', 'scope', 'node'); assert.equal(f.service.readStarts.size, 1);
    });
    test(`75 ${family} append rollup and private ACK faults restore same-transaction head raw rows and accepted observations with no compensating write`, async () => {
        for (const fault of ['append', 'rollup', 'ack'] as const) {
            const tx = {}, body = rawSample(), state: Any = { head: { nodeId: 'node', scopeId: 'scope', sessionEpoch: 1, bootId: 'boot', sampleEpoch: epoch,
                lastSequence: 0, lastUptimeMs: 0, lastDigest: null, lastReceivedAt: 0, lastCapturedAt: 0, droppedSamples: '0' }, rows: [], observations: [] };
            const before = structuredClone(state), trace: string[] = [];
            const db = { async transaction(action: any) { const saved = structuredClone(state); trace.push('begin'); try { const value = await action(tx); trace.push('commit'); return value; }
                catch (error) { Object.assign(state, saved); trace.push('rollback'); throw error; } } };
            const same = (actual: unknown) => assert.equal(actual, tx);
            const store = { async node(actual: unknown) { same(actual); return { nodeId: 'node', scopeId: 'scope', revoked: false, credentialUntil: at + 3600000, sessionEpoch: 1, bootId: 'boot' }; },
                async lockHead(actual: unknown) { same(actual); return state.head; }, async append(actual: unknown) { same(actual); trace.push('append'); state.head.lastSequence = 1; state.rows.push(body); if (fault === 'append') throw new Error('append failure'); },
                async history() { return []; }, async latest() { return []; }, async prune() { return 0; } };
            const rollups = { async append(actual: unknown, values: Any[]) { same(actual); trace.push('rollup'); state.observations.push(...values); if (fault === 'rollup') throw new Error('rollup failure'); } };
            const ctor: any = family === 'node' ? NodeTelemetry : HostTelemetry, service = new ctor(db, { async scope() {} }, intakeOnlyAccess, { async credential(actual: unknown) { same(actual); return 1; } }, store, true, () => at, rollups);
            if (fault === 'ack') service.ack = () => { trace.push('ack'); throw new Error('ack failure'); };
            await assert.rejects(service.ingest('node', fingerprint, 1, body), new RegExp(fault + ' failure'));
            assert.deepEqual(state, before); assert.equal(trace.at(-1), 'rollback'); assert.equal(service.active, 0); assert.equal(trace.filter(value => value === 'append').length, 1);
        }
    });
}

for (const family of ['forward', 'probe'] as const) {
    test(`76 ${family} personal history cannot disclose another owner's persisted listener series`, async () => {
        const f = fixture(family); f.state.ownerActorId = 'other';
        await assert.rejects(f.service.history('reader', 'scope', 'forward'), { code: 'NOT_FOUND' });
        assert.deepEqual(f.trace, ['begin', 'scope', 'access:forward', 'rollback']);
        assert.deepEqual(f.state.rows, []);
    });
}

test('77 real product policy keeps personal Forward loss counters withheld and Scope capacity governance-only', async () => {
    for (const actor of ['reader', 'administrator']) {
        const tx = {}, trace: string[] = [];
        const same = (actual: unknown, event: string) => { assert.equal(actual, tx); trace.push(event); };
        const auth = { async scope(actual: unknown, who: string, scope: string) { same(actual, 'scope'); assert.deepEqual([who, scope], [actor, 'scope']); } };
        const access = new ResourceAccess(auth, {
            async scopeOwner(actual, scope) { same(actual, 'scope-owner'); assert.equal(scope, 'scope'); return { ownerActorId: 'administrator' }; },
            async ownership(actual, scope, kind, id) { same(actual, 'ownership'); assert.deepEqual([scope, kind, id], ['scope', 'forward', 'forward']); return { ownerActorId: 'reader' }; },
            node: async () => assert.fail('Forward aggregate cannot inspect Node detail'),
        });
        const db = { async transaction<T>(action: (actual: typeof tx) => Promise<T>) { trace.push('begin'); try { const value = await action(tx); trace.push('commit'); return value; } catch (error) { trace.push('rollback'); throw error; } } };
        const losses = { minuteEvicted: '1', hourEvicted: '2', cursorEvicted: '3', cursorExpired: '4' };
        const store = { async history(actual: unknown) { same(actual, 'history'); return []; }, async losses(actual: unknown) { same(actual, 'losses'); return losses; },
            async capacity(actual: unknown) { same(actual, 'capacity'); return { minuteRows: 0, hourRows: 0, cursorRows: 0, nodeFamilies: 0 }; }, async append() {}, async prune() { return 0; } };
        const targets = { async forward(actual: unknown) { same(actual, 'forward'); return { forwardId: 'forward', scopeId: 'scope' }; }, node: async () => assert.fail('Forward aggregate must not read a Node') };
        let now = at;
        const service = new TelemetryRollups(db, auth, access, store, targets, true, () => now);
        const result = await service.history(actor, 'scope', 'forward', 'forward', { family: 'forward' });
        assert.deepEqual(result.losses, actor === 'administrator' ? { scope: 'scope-family', ...losses } : { scope: 'withheld-scope-family', minuteEvicted: null, hourEvicted: null, cursorEvicted: null, cursorExpired: null });
        assert.equal(trace.includes('losses'), actor === 'administrator'); trace.length = 0; now += 1000;
        if (actor === 'administrator') { await service.capacity(actor, 'scope'); assert.ok(trace.includes('capacity')); }
        else { await assert.rejects(service.capacity(actor, 'scope'), { code: 'NOT_FOUND' }); assert.equal(trace.includes('capacity'), false); assert.equal(trace.at(-1), 'rollback'); }
    }
});
