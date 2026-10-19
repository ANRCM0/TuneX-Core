import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createControlApp, createApp } from '../src/api/public.ts';
import type { ControlApi, ControlHttpOptions, ControlHttpServices } from '../src/api/public.ts';
import { ControlError } from '../src/framework/public.ts';

// These partial doubles exercise only HTTP admission/dispatch, not owner storage or policy.
const services = [
    ['telemetry', 'nodes/node-a/telemetry', 'history', ['actor-a', 'scope-a', 'node-a', {}], 'TELEMETRY_UNAVAILABLE'],
    ['forwardTelemetry', 'forwards/forward-a/telemetry', 'history', ['actor-a', 'scope-a', 'forward-a', {}], 'FORWARD_TELEMETRY_UNAVAILABLE'],
    ['hostTelemetry', 'nodes/node-a/host-telemetry', 'history', ['actor-a', 'scope-a', 'node-a', {}], 'HOST_TELEMETRY_UNAVAILABLE'],
    ['probeTelemetry', 'forwards/forward-a/probe-telemetry', 'history', ['actor-a', 'scope-a', 'forward-a', {}], 'PROBE_TELEMETRY_UNAVAILABLE'],
    ['telemetryRollups', 'telemetry/capacity', 'capacity', ['actor-a', 'scope-a'], 'TELEMETRY_AGGREGATE_UNAVAILABLE'],
    ['diagnostics', 'forwards/forward-a/diagnostics', 'get', ['actor-a', 'scope-a', 'forward-a'], 'DIAGNOSTIC_UNAVAILABLE'],
    ['audit', 'audit-events', 'query', ['actor-a', 'scope-a', {}], 'AUDIT_UNAVAILABLE'],
    ['stationAlerts', 'alert-policies', 'listPolicies', ['actor-a', 'scope-a'], 'STATION_ALERT_UNAVAILABLE'],
    ['notificationEndpoints', 'notification-endpoints', 'list', ['actor-a', 'scope-a'], 'NOTIFICATION_UNAVAILABLE'],
    ['notificationDeliveries', 'notification-deliveries/delivery-a', 'get', ['actor-a', 'scope-a', 'delivery-a'], 'NOTIFICATION_UNAVAILABLE'],
    ['probeRuns', 'probe-runs/run-a', 'get', ['actor-a', 'scope-a', 'run-a'], 'PROBE_HISTORY_UNAVAILABLE'],
    ['probePlans', 'probe-plans/plan-a', 'get', ['actor-a', 'scope-a', 'plan-a'], 'PROBE_PLAN_UNAVAILABLE'],
    ['observationServices', 'observation-services', 'list', ['actor-a', 'scope-a'], 'OBSERVATION_SERVICE_UNAVAILABLE'],
] as const;

for (const [name, path, method, expectedArgs, unavailable] of services) {
    function fixture(positional = false, installed = true) {
        const trace: string[] = [], failure = { stage: '' }, result = { owner: name, executionEnabled: false };
        const admit = async <T>(action: () => Promise<T>): Promise<T> => {
            trace.push('admit');
            if (failure.stage === 'admit') throw new ControlError('TEST_BUSY', 429, 'busy');
            try { return await action(); } finally { trace.push('release'); }
        };
        const selected = {
            admitReadRequest: admit, admitRequest: admit,
            [method]: async (...args: unknown[]) => {
                trace.push('owner'); assert.deepEqual(args, expectedArgs);
                if (failure.stage === 'owner') throw new ControlError('TEST_OWNER', 409, 'owner denied');
                return result;
            },
        };
        const options: ControlHttpOptions = {
            control: { identity: { authenticate: async () => assert.fail('must use observation authentication') } } as unknown as ControlApi,
            runtime: {} as ControlHttpOptions['runtime'],
            authority: { allow: async () => { trace.push('authority'); }, read: async () => ({ maintenance: false }) },
            services: {
                ...(installed ? { [name]: selected } : {}),
                authenticateObservation: async header => {
                    trace.push('authenticate'); assert.equal(header, 'Bearer test');
                    if (failure.stage === 'authenticate') throw new ControlError('TEST_AUTH', 401, 'denied');
                    return 'actor-a';
                },
            } as ControlHttpServices,
        };
        const s = options.services!;
        const app = positional ? createApp(options.control, options.runtime, options.authority, s.telemetry, s.forwardTelemetry,
            s.authenticateObservation, s.hostTelemetry, s.probeTelemetry, s.telemetryRollups, s.diagnostics, s.audit,
            s.stationAlerts, s.notificationEndpoints, s.notificationDeliveries, s.probeRuns, s.probePlans, s.observationServices) :
            createControlApp(options);
        const call = (query = '', headers: Record<string, string> = {}) => app.request(`/api/v1/scopes/scope-a/${path}${query}`,
            { headers: { authorization: 'Bearer test', ...headers } });
        return { trace, failure, result, call };
    }

    test(`${name} named and positional HTTP wiring admit before authentication, await the owner and release`, async () => {
        for (const positional of [false, true]) {
            const f = fixture(positional), response = await f.call();
            assert.equal(response.status, 200); assert.deepEqual(await response.json(), f.result);
            assert.equal(response.headers.get('cache-control'), 'no-store');
            assert.deepEqual(f.trace, ['authority', 'admit', 'authenticate', 'owner', 'release']);
        }
    });

    test(`${name} omission, admission refusal, denied authentication and owner failure preserve dispatch boundaries`, async () => {
        const missing = fixture(false, false), absent = await missing.call();
        assert.equal(absent.status, 503); assert.equal((await absent.json()).code, unavailable);
        assert.deepEqual(missing.trace, ['authority']);
        for (const [stage, status, code, trace] of [
            ['admit', 429, 'TEST_BUSY', ['authority', 'admit']],
            ['authenticate', 401, 'TEST_AUTH', ['authority', 'admit', 'authenticate', 'release']],
            ['owner', 409, 'TEST_OWNER', ['authority', 'admit', 'authenticate', 'owner', 'release']],
        ] as const) {
            const f = fixture(); f.failure.stage = stage;
            const response = await f.call(); assert.equal(response.status, status); assert.equal((await response.json()).code, code);
            assert.deepEqual(f.trace, trace);
        }
        const cookie = fixture(), denied = await cookie.call('', { cookie: 'session=x' });
        assert.equal(denied.status, 401); assert.deepEqual(cookie.trace, ['authority', 'admit', 'release']);
        const query = fixture(), invalid = await query.call('?unexpected=1');
        assert.equal(invalid.status, 422); assert.deepEqual(query.trace, ['authority', 'admit', 'authenticate', 'release']);
    });
}
