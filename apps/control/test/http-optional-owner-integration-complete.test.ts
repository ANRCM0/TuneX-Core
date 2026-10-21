import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as core from '@tunex/core';
import * as observability from '@tunex/contracts/observability';
import * as framework from '../src/framework/public.ts';
import type { ResourceReadAccess } from '../src/framework/public.ts';
import { ResourceAccess } from '../src/modules/resource-access-owner/public.ts';
import * as mysql from '../src/infrastructure/mysql.ts';
import { nativeValueDigest } from '../src/compatibility/public.ts';
import { createApp, createControlApp } from '../src/api/public.ts';
import type { ControlApi, ControlHttpOptions, ControlHttpServices } from '../src/api/public.ts';
import { NodeTelemetry, HostTelemetry, ForwardTelemetry, ProbeTelemetry, TelemetryRollups } from '../src/modules/telemetry-owner/public.ts';
import { NotificationDeliveries } from '../src/modules/notification-owner/public.ts';
import { ProbePlans } from '../src/modules/probe-plan-owner/public.ts';

type Any = Record<string, any>;
const at = 1800000000000;
const noEffect = () => assert.fail('optional history must not enter an execution, credential or Runtime collaborator');
const clock = () => at;
const families = [
    ['telemetry', 'nodes/node/telemetry', 'TELEMETRY_UNAVAILABLE'],
    ['hostTelemetry', 'nodes/node/host-telemetry', 'HOST_TELEMETRY_UNAVAILABLE'],
    ['forwardTelemetry', 'forwards/forward/telemetry', 'FORWARD_TELEMETRY_UNAVAILABLE'],
    ['probeTelemetry', 'forwards/forward/probe-telemetry', 'PROBE_TELEMETRY_UNAVAILABLE'],
    ['telemetryRollups', 'nodes/node/telemetry/aggregates?family=process', 'TELEMETRY_AGGREGATE_UNAVAILABLE'],
] as const;

function http(services: Any, positional = false) {
    const options: ControlHttpOptions = {
        control: { identity: { authenticate: noEffect }, nodes: { machine: noEffect } } as unknown as ControlApi,
        runtime: new Proxy({}, { get: noEffect }) as ControlHttpOptions['runtime'],
        authority: { async allow() {}, async read() { return { maintenance: false }; } },
        services: { ...services, authenticateObservation: async (header: string | undefined) => {
            const authorization = header ?? '';
            assert.ok(authorization.startsWith('Bearer ')); return authorization.slice(7);
        } } as ControlHttpServices,
    };
    const s = options.services!;
    return positional ? createApp(options.control, options.runtime, options.authority, s.telemetry, s.forwardTelemetry,
        s.authenticateObservation, s.hostTelemetry, s.probeTelemetry, s.telemetryRollups, s.diagnostics, s.audit,
        s.stationAlerts, s.notificationEndpoints, s.notificationDeliveries, s.probeRuns, s.probePlans, s.observationServices) : createControlApp(options);
}
function read(app: ReturnType<typeof http>, path: string, actor = 'reader') {
    return app.request('/api/v1/scopes/scope/' + path, { headers: { authorization: 'Bearer ' + actor } });
}
function fixture(db?: Any, policy?: ResourceReadAccess<any>) {
    const tx = {}, trace: string[] = [];
    const database = db ?? { async transaction(action: (tx: unknown) => Promise<unknown>) { return action(tx); } };
    const auth = { async scope(_tx: unknown, actor: string, scope: string) { assert.ok(actor); assert.equal(scope, 'scope'); trace.push('scope'); } };
    const access: ResourceReadAccess<any> = policy ?? {
        principal: async (_tx, actor) => Object.freeze({ actorId: actor, governance: actor === 'capacity-reader' }),
        node: async () => 'full', forward: async () => undefined,
        owned: async () => assert.fail('Observation history must not enter command ownership'),
    };
    const current = { nodeId: 'node', scopeId: 'scope', revoked: false, credentialUntil: at + 60000, sessionEpoch: 1, bootId: 'boot' };
    const stores: Any = {};
    for (const name of ['telemetry', 'hostTelemetry', 'forwardTelemetry', 'probeTelemetry']) stores[name] = {
        async node() { return current; }, async nodes() { return []; },
        async forward() { return { scopeId: 'scope', forwardId: 'forward', revision: 1, deleting: false, recoverySuspended: false }; },
        async history() { trace.push(name + ':history'); return []; }, async latest() { trace.push(name + ':latest'); return []; },
    };
    const make = (ctor: any, name: string, mapped = false) => new ctor(database, auth, access, { credential: noEffect }, stores[name],
        ...(mapped ? [{ resolve: noEffect }] : []), false, clock);
    const rollupStore = {
        async history() { trace.push('telemetryRollups:history'); return []; },
        async losses() { return { minuteEvicted: '0', hourEvicted: '0', cursorEvicted: '0', cursorExpired: '0' }; },
        async capacity() { return { minuteRows: 0, hourRows: 0, cursorRows: 0, nodeFamilies: 0 }; },
    };
    const services = { telemetry: make(NodeTelemetry, 'telemetry'), hostTelemetry: make(HostTelemetry, 'hostTelemetry'),
        forwardTelemetry: make(ForwardTelemetry, 'forwardTelemetry', true), probeTelemetry: make(ProbeTelemetry, 'probeTelemetry', true),
        telemetryRollups: new TelemetryRollups(database as any, auth, access, rollupStore as any,
            { node: async () => current, forward: noEffect }, false, clock) };
    return { services, stores, trace, database, auth, access };
}

test('30 actual five disabled collection owners remain HTTP-readable through named and positional composition while absent services refuse', async () => {
    for (const positional of [false, true]) {
        const f = fixture(), app = http(f.services, positional);
        for (const [name, path, unavailable] of families) {
            const response = await read(app, path, name);
            assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
            const body = await response.json();
            assert.equal(body.enabled, false); assert.equal(body.health, 'unknown'); assert.equal(body.executionAuthorized, false);
            assert.deepEqual(body.items, []); assert.ok(f.trace.includes(name + ':history'));
            for (const absent of [{}, { [name]: undefined }]) {
                const missing = await read(http(absent, positional), path, name);
                assert.equal(missing.status, 503); assert.equal((await missing.json()).code, unavailable);
            }
        }
        const capacity = await read(app, 'telemetry/capacity', 'capacity-reader');
        assert.equal(capacity.status, 200); const budget = await capacity.json();
        assert.equal(budget.enabled, false); assert.equal(budget.logicalBudget.physicalBytesMeasured, false);
    }
});

test('30 actual disabled Node owner returns retained native history but all four machine HTTP intakes refuse before parsing or credentials', async () => {
    const f = fixture();
    const body = { nodeId: 'node', bootId: 'boot', sessionEpoch: 1, sampleEpoch: 'a'.repeat(32), sequence: 1,
        capturedAt: new Date(at - 1000).toISOString(), uptimeMs: 1000, platform: 'linux', droppedSamples: '0',
        telemetryVersion: 1, kind: 'telemetry-sample',
        process: { goroutines: 1, heapAllocBytes: '2', runtimeBytes: '3', cpuTimeNanos: '4', maxRssBytes: null, openFileDescriptors: null },
        runtime: { snapshotGeneration: 1, authorizationActive: false, tcpStreams: '0', udpAssociations: '0', drainingInstances: 0 } };
    const row = { nodeId: 'node', scopeId: 'scope', sessionEpoch: 1, bootId: 'boot', sampleEpoch: body.sampleEpoch, sequence: 1,
        capturedAt: at - 1000, receivedAt: at - 1000, uptimeMs: 1000, body, digest: nativeValueDigest(body), recoverySuspended: true };
    f.stores.telemetry.history = async () => [row]; f.stores.telemetry.latest = async () => [row];
    const app = http(f.services), response = await read(app, 'nodes/node/telemetry');
    assert.equal(response.status, 200); const history = await response.json();
    assert.equal(history.enabled, false); assert.deepEqual(history.items[0].sample, body);
    assert.equal(history.items[0].recoverySuspended, true); assert.deepEqual(history.latest.sample, body);
    assert.equal(history.executionAuthorized, false); assert.equal(history.health, 'unknown');
    for (const [path, code] of [['telemetry', 'TELEMETRY_DISABLED'], ['host-telemetry', 'HOST_TELEMETRY_DISABLED'],
        ['forward-telemetry', 'FORWARD_TELEMETRY_DISABLED'], ['probe-telemetry', 'PROBE_TELEMETRY_DISABLED']]) {
        const denied = await app.request('/agent/v3/' + path, { method: 'POST', body: '{', headers: { 'content-type': 'application/json' } });
        assert.equal(denied.status, 503); assert.equal((await denied.json()).code, code);
    }
});

test('31 actual disabled NotificationDeliveries and ProbePlans retain their HTTP read envelopes without worker effects', async () => {
    for (const positional of [false, true]) {
        const f = fixture(), trace: string[] = [];
        const auth = {
            async scope(_tx: unknown, _actor: string, scope: string, manage?: boolean) {
                assert.equal(scope, 'scope'); assert.equal(manage, true); trace.push('scope');
            },
            async owner(_tx: unknown, actor: string, scope: string) {
                assert.deepEqual([actor, scope], ['reader', 'scope']); trace.push('owner');
            },
        };
        const access: ResourceReadAccess<any> = {
            principal: async (_tx, actor, scope) => {
                assert.deepEqual([actor, scope], ['reader', 'scope']); trace.push('principal');
                return Object.freeze({ actorId: actor, governance: true });
            },
            node: noEffect, forward: noEffect, owned: noEffect,
        };
        const store = (name: string, losses: Any) => ({ async history() { trace.push(name); return []; }, async losses() { return losses; } });
        const notificationDeliveries = new NotificationDeliveries({ db: f.database, auth,
            store: store('deliveries', { queueRejected: 0, routingRejected: 0, silenceSuppressed: 0, disabledSuppressed: 0, rowsExpired: 0, rowsEvicted: 0, attemptsEvicted: 0 }),
            endpoints: new Proxy({}, { get: noEffect }), policies: new Proxy({}, { get: noEffect }), secrets: undefined,
            sender: { send: noEffect, idle: noEffect, close: noEffect }, authorityBinding: noEffect, enabled: false, clock } as any);
        const probePlans = new ProbePlans({ db: f.database, auth, access,
            store: store('plans', { rowsExpired: 0, rowsEvicted: 0, decisionsEvicted: 0 }),
            requests: new Proxy({}, { get: noEffect }), issuer: new Proxy({}, { get: noEffect }), executionEnabled: false, scheduleEnabled: false, clock } as any);
        const app = http({ notificationDeliveries, probePlans }, positional);
        for (const [path, flag, source, code] of [
            ['notification-deliveries', 'deliveryEnabled', 'persisted-notification-deliveries', 'NOTIFICATION_UNAVAILABLE'],
            ['probe-plans', 'executionEnabled', 'persisted-probe-plans', 'PROBE_PLAN_UNAVAILABLE'],
        ] as const) {
            const response = await read(app, path); assert.equal(response.status, 200);
            const body = await response.json(); assert.equal(body[flag], false); assert.equal(body.workerState, 'disabled');
            assert.equal(body.source, source); assert.equal(body.readOnly, true); assert.equal(body.health, 'unknown');
            assert.equal(body.executionAuthorized, false); assert.equal(body.networkCheck, 'not-performed-by-read');
            assert.deepEqual(body.items, []); assert.equal(body.hasMore, false); assert.equal(body.nextCursor, null);
            assert.deepEqual(body.losses, path === 'probe-plans' ? { rowsExpired: 0, rowsEvicted: 0, decisionsEvicted: 0 } :
                { queueRejected: 0, routingRejected: 0, silenceSuppressed: 0, disabledSuppressed: 0, rowsExpired: 0, rowsEvicted: 0, attemptsEvicted: 0 });
            if (path === 'probe-plans') assert.equal(body.scheduleEnabled, false);
            const absent = await read(http({}, positional), path); assert.equal(absent.status, 503); assert.equal((await absent.json()).code, code);
        }
        assert.deepEqual(trace, ['owner', 'deliveries', 'scope', 'principal', 'plans']);
    }
});

test('30 actual product policy hides foreign private history and shared whole-host detail through HTTP', async () => {
    for (const source of ['private', 'admin-shared'] as const) {
        for (const [, path] of families) {
            const reads: string[] = [];
            const access = new ResourceAccess({ scope: async () => undefined }, {
                scopeOwner: async () => ({ ownerActorId: 'administrator' }),
                ownership: async () => ({ ownerActorId: 'another-user' }),
                node: async () => ({ source, ownerActorId: source === 'private' ? 'another-user' : null, granted: source === 'admin-shared' }),
            });
            const f = fixture(undefined, access);
            for (const store of Object.values(f.stores) as Any[]) {
                store.history = async () => { reads.push('history'); return []; };
                store.latest = async () => { reads.push('latest'); return []; };
            }
            const response = await read(http(f.services), path);
            assert.equal(response.status, 404); assert.equal((await response.json()).code, 'NOT_FOUND');
            assert.deepEqual(reads, []); assert.ok(!f.trace.some(event => event.endsWith(':history')));
        }
    }
});

function nativeDatabase() {
    const timers: Any[] = [], connections: Any[] = [], poolOptions: Any[] = [];
    const pool = { async getConnection() {
        const events: string[] = [];
        const connection = { events, connection: { stream: { destroy(error: Error) { assert.equal(error.message, 'Telemetry deadline exceeded'); events.push('stream-destroy'); } } },
            async query(sql: string) { events.push(sql); }, async beginTransaction() { events.push('begin'); },
            async commit() { events.push('commit'); }, async rollback() { events.push('rollback'); },
            release() { events.push('release'); }, destroy() { events.push('destroy'); } };
        connections.push(connection); return connection;
    }, async end() {} };
    const exports: Any = {}, source = readFileSync(new URL('../src/infrastructure/mysql-telemetry.ts', import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
    // Execute the original adapter, replacing only external native pool acquisition and wall timers.
    new vm.Script('(function(exports,require,setTimeout,clearTimeout){\n' + js + '\n})').runInThisContext()(exports, (name: string) => {
        if (name === 'mysql2/promise') return { createPool(options: Any) { poolOptions.push(options); return pool; } };
        if (name === '@tunex/core') return core; if (name === '@tunex/contracts/observability') return observability;
        if (name === '../framework/public.ts') return framework; if (name === './mysql.ts') return mysql;
        throw new Error('Unexpected observation adapter dependency ' + name);
    }, (callback: () => void, ms: number) => { const timer = { callback, ms, cleared: false, unref() {} }; timers.push(timer); return timer; },
    (timer: Any) => { timer.cleared = true; });
    const database = new exports.MySqlTelemetryDatabase('mysql://observation-only');
    let guards = 0; database.guard = async () => { guards++; };
    return { database, connections, timers, poolOptions, guards: () => guards };
}
function deferred() {
    let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve };
}

test('30 31 actual observation pool enforces two nonqueued slots and 1500ms deadline through real owners and HTTP without Runtime fallback', async () => {
    const native = nativeDatabase(), f = fixture(native.database), app = http(f.services);
    const entered = [deferred(), deferred()], resume = [deferred(), deferred()];
    for (const [index, name] of ['telemetry', 'hostTelemetry'].entries()) f.stores[name].history = async () => {
        entered[index]!.resolve(); await resume[index]!.promise; return [];
    };
    const first = read(app, 'nodes/node/telemetry', 'first-reader'), second = read(app, 'nodes/node/host-telemetry', 'second-reader');
    try {
    await Promise.all(entered.map(value => value.promise));
    const busy = await read(app, 'forwards/forward/telemetry', 'third-reader');
    assert.equal(busy.status, 429); const busyBody = await busy.json();
    assert.equal(busyBody.code, 'TELEMETRY_BUSY'); assert.equal(busyBody.retryable, true);
    assert.equal(native.connections.length, 2); assert.deepEqual(native.timers.map(timer => timer.ms), [1500, 1500]);
    assert.equal(native.guards(), 2); assert.ok(!f.trace.includes('forwardTelemetry:history'));
    native.timers[0]!.callback(); resume[0]!.resolve();
    const timeout = await first; assert.equal(timeout.status, 503); const timeoutBody = await timeout.json();
    assert.equal(timeoutBody.code, 'TELEMETRY_TIMEOUT'); assert.equal(timeoutBody.retryable, true);
    resume[1]!.resolve(); assert.equal((await second).status, 200);
    assert.deepEqual(native.connections[0]!.events, ['SET SESSION innodb_lock_wait_timeout=1', 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED', 'begin', 'stream-destroy', 'destroy']);
    assert.deepEqual(native.connections[1]!.events, ['SET SESSION innodb_lock_wait_timeout=1', 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED', 'begin', 'commit', 'release']);
    assert.equal(native.guards(), 4); assert.ok(native.timers.every(timer => timer.cleared));
    f.stores.telemetry.history = async () => [];
    assert.equal((await read(app, 'nodes/node/telemetry', 'after-timeout')).status, 200);
    assert.equal(native.connections.length, 3); assert.equal(native.guards(), 6); assert.equal(native.timers[2]!.ms, 1500); assert.equal(native.timers[2]!.cleared, true);
    assert.deepEqual(native.poolOptions, [{ uri: 'mysql://observation-only', connectionLimit: 2, maxIdle: 2, waitForConnections: false,
        connectTimeout: 1000, supportBigNumbers: true, bigNumberStrings: false, timezone: 'Z' }]);
    } finally {
        for (const value of resume) value.resolve();
        await Promise.all([first, second]);
        await native.database.close();
    }
});
