import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ResourceReadAccess } from '../src/framework/public.ts';
import { ControlError } from '../src/framework/public.ts';
import { NodeTelemetry, HostTelemetry } from '../src/modules/telemetry-owner/public.ts';
import type { TelemetryStore, HostTelemetryStore, TelemetryHead, TelemetryNode, TelemetryRollupRecorder, TelemetryObservation } from '../src/modules/telemetry-owner/public.ts';
import type { NodeTelemetrySample, HostTelemetrySample } from '../src/compatibility/public.ts';

type Family = 'process' | 'host';
const at = 1800000000000;
function sample(family: Family): NodeTelemetrySample | HostTelemetrySample {
    const common = { nodeId: 'node', bootId: 'boot', sessionEpoch: 1, sampleEpoch: 'a'.repeat(32), sequence: 1,
        capturedAt: new Date(at).toISOString(), uptimeMs: 1000, platform: 'windows', droppedSamples: '0' };
    if (family === 'process') return { ...common, telemetryVersion: 1, kind: 'telemetry-sample',
        process: { goroutines: 2, heapAllocBytes: '123', runtimeBytes: '456', cpuTimeNanos: null, maxRssBytes: null, openFileDescriptors: null },
        runtime: { snapshotGeneration: 4, authorizationActive: true, tcpStreams: '0', udpAssociations: '0', drainingInstances: 0 } };
    return { ...common, hostTelemetryVersion: 1, kind: 'host-telemetry-sample', host: {
        scope: 'agent-visible-os', cpu: { availability: 'unsupported', logicalProcessors: null, totalTicks: null, idleTicks: null, ioWaitTicks: null },
        memory: { availability: 'unsupported', totalBytes: null, availableBytes: null },
        load: { availability: 'unsupported', oneMilli: null, fiveMilli: null, fifteenMilli: null },
        filesystem: { availability: 'unsupported', scope: 'agent-root-filesystem', totalBytes: null, availableBytes: null },
        network: { availability: 'unsupported', scope: 'agent-network-namespace', limit: 16, available: 0, returned: 0, omitted: 0, truncated: false, interfaces: [] },
    } };
}

function fixture(family: Family, enabled = true) {
    const tx = Object.freeze({ transaction: Symbol(family) }), trace: string[] = [];
    const state = { now: at, deny: false, readDenied: false, failRollup: false, rows: 0, observations: [] as TelemetryObservation[],
        current: { nodeId: 'node', scopeId: 'scope', revoked: false, credentialUntil: at + 3600000, sessionEpoch: 1, bootId: 'boot' } as TelemetryNode,
        head: { nodeId: 'node', scopeId: 'scope', sessionEpoch: 1, bootId: 'boot', sampleEpoch: 'a'.repeat(32), lastSequence: 0,
            lastUptimeMs: 0, lastDigest: null, lastReceivedAt: 0, lastCapturedAt: 0, droppedSamples: '0' } as TelemetryHead };
    const check = (actual: typeof tx, name: string) => { assert.equal(actual, tx); trace.push(name); };
    const db = { async transaction<T>(action: (actual: typeof tx) => Promise<T>) {
        const saved = structuredClone({ head: state.head, rows: state.rows, observations: state.observations }); trace.push('begin');
        try { const value = await action(tx); trace.push('commit'); return value; }
        catch (error) { Object.assign(state, saved); trace.push('rollback'); throw error; }
    } };
    const auth = { async scope(actual: typeof tx, actor: string, scope: string, manage?: boolean) {
        check(actual, 'scope'); assert.deepEqual([actor, scope, manage], ['reader', 'scope', undefined]);
        if (state.deny) throw new ControlError('AUTHORIZATION_DENIED', 403, 'denied');
    } };
    const readAccess: ResourceReadAccess<typeof tx> = {
        node: async (actual, actor, scope, node, detail) => {
            check(actual, 'read-access'); assert.deepEqual([actor, scope, node, detail], ['reader', 'scope', 'node', 'host']);
            if (state.readDenied) throw new ControlError('NOT_FOUND', 404, 'not found'); return 'full';
        },
        principal: async () => assert.fail('Raw Node telemetry does not project a principal'),
        forward: async () => assert.fail('Node telemetry must not read Forward ownership'),
        owned: async () => assert.fail('Telemetry must not enter mutation ownership'),
    };
    const machine = { async credential(actual: typeof tx, node: string, fingerprint: string) {
        check(actual, 'credential'); assert.equal(node, 'node'); assert.equal(fingerprint, 'b'.repeat(64));
        if (state.deny) throw new ControlError('AUTHORIZATION_DENIED', 403, 'denied'); return 1;
    } };
    const store: TelemetryStore<typeof tx> & HostTelemetryStore<typeof tx> = {
        async node(actual, node) { check(actual, 'node'); assert.equal(node, 'node'); return state.current; },
        async lockHead(actual, scope, input: NodeTelemetrySample | HostTelemetrySample) { check(actual, 'head'); assert.equal(scope, 'scope'); assert.equal(input.nodeId, 'node'); return state.head; },
        async append(actual, scope, input: NodeTelemetrySample | HostTelemetrySample, hash, receivedAt) {
            check(actual, 'append'); assert.equal(scope, 'scope'); assert.equal(receivedAt, state.now); state.rows++;
            state.head = { nodeId: input.nodeId, scopeId: scope, sessionEpoch: input.sessionEpoch, bootId: input.bootId, sampleEpoch: input.sampleEpoch,
                lastSequence: input.sequence, lastUptimeMs: input.uptimeMs, lastDigest: hash, lastReceivedAt: receivedAt,
                lastCapturedAt: Date.parse(input.capturedAt), droppedSamples: input.droppedSamples };
        },
        async history(actual) { check(actual, 'history'); return []; }, async latest(actual) { check(actual, 'latest'); return []; },
        async prune(actual) { check(actual, 'prune'); return 0; },
    };
    const rollups: TelemetryRollupRecorder<typeof tx> = { async append(actual, observations) {
        check(actual, 'rollup'); assert.equal(observations.length, 1); assert.equal(observations[0]!.family, family);
        assert.equal(observations[0]!.scopeId, 'scope'); assert.equal(observations[0]!.receivedAt, state.now);
        state.observations.push(...observations); if (state.failRollup) throw new Error('rollup failed');
    } };
    const clock = () => { trace.push('clock'); return state.now; };
    const service = family === 'process' ? new NodeTelemetry(db, auth, readAccess, machine, store, enabled, clock, rollups)
        : new HostTelemetry(db, auth, readAccess, machine, store, enabled, clock, rollups);
    return { service, state, trace, input: sample(family) };
}

for (const family of ['process', 'host'] as const) {
    const prefix = family === 'process' ? 'TELEMETRY' : 'HOST_TELEMETRY';
    test(`${family} telemetry intake authorizes before stored reads and preserves exact replay receipt without append`, async () => {
        const f = fixture(family);
        const ack = await f.service.ingest('node', 'b'.repeat(64), 1, f.input);
        assert.deepEqual(f.trace, ['begin', 'credential', 'node', 'clock', 'head', 'append', 'rollup', 'commit']);
        assert.equal(ack.executionAuthorized, false); assert.equal(ack.receivedAt, new Date(at).toISOString()); assert.ok(Object.isFrozen(ack));
        f.trace.length = 0; f.state.now += 10000;
        assert.deepEqual(await f.service.ingest('node', 'b'.repeat(64), 1, f.input), ack);
        assert.deepEqual(f.trace, ['begin', 'credential', 'node', 'clock', 'head', 'commit']);
        assert.equal(f.state.rows, 1); assert.equal(f.state.observations.length, 1);
        if (family === 'host') {
            assert.deepEqual(f.state.observations[0]!.gauges, {});
            assert.deepEqual(f.state.observations[0]!.counters, {});
            assert.equal(f.state.observations[0]!.available, false);
        } else assert.equal(f.state.observations[0]!.counters.cpuTimeNanos, undefined);
    });

    test(`${family} telemetry rollup failure rolls back raw head and releases node admission`, async () => {
        const f = fixture(family), original = structuredClone(f.state.head); f.state.failRollup = true;
        await assert.rejects(f.service.ingest('node', 'b'.repeat(64), 1, f.input), /rollup failed/);
        assert.deepEqual(f.state.head, original); assert.equal(f.state.rows, 0); assert.deepEqual(f.state.observations, []);
        assert.equal(f.trace.at(-1), 'rollback'); f.state.failRollup = false;
        await f.service.ingest('node', 'b'.repeat(64), 1, f.input); assert.equal(f.state.rows, 1);
    });

    test(`${family} telemetry parser and credential refusal cannot touch persisted head`, async () => {
        const disabled = fixture(family, false);
        await assert.rejects(disabled.service.ingest('node', '', 0, null), { code: `${prefix}_DISABLED` });
        assert.deepEqual(disabled.trace, []);
        const f = fixture(family);
        await assert.rejects(f.service.ingest('node', 'b'.repeat(64), 1, null)); assert.deepEqual(f.trace, []);
        f.state.deny = true;
        await assert.rejects(f.service.ingest('node', 'b'.repeat(64), 1, f.input), { code: 'AUTHORIZATION_DENIED' });
        assert.deepEqual(f.trace, ['begin', 'credential', 'rollback']); assert.equal(f.state.rows, 0);
    });

    test(`${family} telemetry changed replay, epoch and uptime preserve original refusal precedence`, async () => {
        const f = fixture(family); await f.service.ingest('node', 'b'.repeat(64), 1, f.input); f.state.now += 10000;
        for (const [input, code] of [
            [{ ...f.input, droppedSamples: '1' }, `${prefix}_SEQUENCE_CONFLICT`],
            [{ ...f.input, sampleEpoch: 'c'.repeat(32) }, `${prefix}_EPOCH_CONFLICT`],
            [{ ...f.input, sequence: 2 }, `${prefix}_SEQUENCE_CONFLICT`],
        ] as const) await assert.rejects(f.service.ingest('node', 'b'.repeat(64), 1, input), { code });
        assert.equal(f.state.rows, 1); assert.equal(f.state.observations.length, 1);
    });

    test(`${family} telemetry refuses revoked expired or superseded sessions before locking head`, async () => {
        for (const change of [
            { revoked: true }, { credentialUntil: at }, { sessionEpoch: 2 }, { bootId: 'replacement' },
        ]) {
            const f = fixture(family); Object.assign(f.state.current, change);
            await assert.rejects(f.service.ingest('node', 'b'.repeat(64), 1, f.input), { code: 'SESSION_SUPERSEDED' });
            assert.deepEqual(f.trace, ['begin', 'credential', 'node', 'clock', 'rollback']);
            assert.equal(f.state.rows, 0);
        }
    });

    test(`${family} telemetry history authorizes Scope before Node reads and keeps response non-authoritative`, async () => {
        const denied = fixture(family); denied.state.deny = true;
        await assert.rejects(denied.service.history('reader', 'scope', 'node'), { code: 'AUTHORIZATION_DENIED' });
        assert.deepEqual(denied.trace, ['clock', 'begin', 'scope', 'rollback']);
        const f = fixture(family), result = await f.service.history('reader', 'scope', 'node');
        assert.deepEqual(f.trace, ['clock', 'begin', 'scope', 'read-access', 'node', 'history', 'latest', 'clock', 'commit']);
        assert.equal(result.executionAuthorized, false); assert.equal(result.health, 'unknown'); assert.equal(result.latest, null);
        assert.ok(Object.isFrozen(result)); assert.equal(f.state.rows, 0);
    });

    test(`${family} telemetry denies shared host detail before persisted samples`, async () => {
        const f = fixture(family); f.state.readDenied = true;
        await assert.rejects(f.service.history('reader', 'scope', 'node'), { code: 'NOT_FOUND' });
        assert.deepEqual(f.trace, ['clock', 'begin', 'scope', 'read-access', 'rollback']);
        assert.equal(f.state.rows, 0);
    });

    test(`${family} telemetry request capacity drains and callback errors release capacity`, async () => {
        const f = fixture(family); let release!: () => void;
        const held = new Promise<void>(resolve => { release = resolve; });
        const requests = Array.from({ length: 4 }, () => f.service.admitMachineRequest(() => held));
        await assert.rejects(f.service.admitReadRequest(async () => assert.fail('full intake ran read callback')), { code: `${prefix}_BUSY` });
        release(); await Promise.all(requests);
        const error = new Error('callback failed');
        await assert.rejects(f.service.admitMachineRequest(async () => { throw error; }), failure => failure === error);
        assert.equal(await f.service.admitReadRequest(async () => 'drained'), 'drained');
        assert.deepEqual(f.trace, []);
    });
}
