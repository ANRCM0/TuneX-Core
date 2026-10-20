import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runControlStartup, CONTROL_STARTUP_INTERFACE_VERSION } from '../src/modules/control-startup-owner/public.ts';
import { runControlStartup as canonical } from '../src/modules/control-startup-owner/service.ts';
import type { ControlStartupEffects, ControlStartupOptions } from '../src/modules/control-startup-owner/public.ts';
import { nativeControlStartupEffects, verifyMultihopRelease } from '../src/compatibility/public.ts';
import { verifyMultihopRelease as originalRelease } from '../src/infrastructure/multihop-release.ts';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';

const required = ['DATABASE_URL', 'TUNEX_CA_CERT', 'TUNEX_CA_KEY', 'TUNEX_SERVER_CERT', 'TUNEX_SERVER_KEY', 'TUNEX_CONTROL_STATE'];
function fixture(extra: Record<string, string | undefined> = {}) {
    const env: Record<string, string | undefined> = Object.fromEntries(required.map(key => [key, key])); Object.assign(env, extra);
    const events: string[] = [], signals = new Map<string, () => void>(), reads = new Map<string, number>();
    const policy = { maxClockSkewSeconds: 99, nested: {} };
    let supplied: ControlStartupOptions<typeof policy> | undefined;
    const failure = new Error('failure'), options = { fail: '', close: async () => {} };
    const effects: ControlStartupEffects<typeof policy> = {
        env(name) { const count = (reads.get(name) ?? 0) + 1; reads.set(name, count); events.push(name); return env[name]; },
        defaultPolicy: policy,
        async verifyRelease(path, revision) { events.push('verify'); assert.deepEqual([path, revision], ['evidence', 'revision']); if (options.fail === 'verify') throw failure; },
        async start(value) { supplied = value; events.push('start'); if (options.fail === 'start') throw failure; return { port: 4567, close: async () => { events.push('close'); await options.close(); } }; },
        log(message) { events.push(message); }, onSignal(signal, callback) { events.push(signal); signals.set(signal, callback); },
    };
    return { env, events, signals, reads, policy, effects, options, failure, supplied: () => supplied };
}
const featureReads = ['TUNEX_CONTROL_PORT', 'TUNEX_PROBE_EXECUTION', 'TUNEX_PROBE_SCHEDULE', 'TUNEX_PROBE_INGRESS', 'TUNEX_PROBE_SERVICES'];

test('156 structural/public/native bindings and default startup option values preserve identity and order', async () => {
    assert.equal(runControlStartup, canonical); assert.equal(CONTROL_STARTUP_INTERFACE_VERSION, 1);
    assert.equal(nativeControlStartupEffects.defaultPolicy, DEFAULT_POLICY); assert.equal(verifyMultihopRelease, originalRelease);
    const f = fixture(); await runControlStartup(f.effects);
    assert.deepEqual(f.events, [...featureReads, 'NODE_ENV', ...required, 'TUNEX_OPENSSL', 'TUNEX_RELAY_CREDENTIAL_SECONDS',
        'TUNEX_CONTROL_HOST', 'TUNEX_AUTHORITY_INITIALIZE', 'TUNEX_MULTIHOP_EXECUTION', 'TUNEX_TELEMETRY', 'TUNEX_FORWARD_TELEMETRY',
        'TUNEX_HOST_TELEMETRY', 'TUNEX_PROBE_TELEMETRY', 'TUNEX_TELEMETRY_ROLLUPS', 'TUNEX_STATION_ALERTS', 'TUNEX_WEBHOOK_DELIVERY',
        'TUNEX_NOTIFICATION_SECRETS', 'start', 'TUNEX_CONTROL_HOST', 'Control listening on https://127.0.0.1:4567', 'SIGINT', 'SIGTERM']);
    assert.deepEqual(f.supplied(), { databaseUrl: 'DATABASE_URL', caCert: 'TUNEX_CA_CERT', caKey: 'TUNEX_CA_KEY', serverCert: 'TUNEX_SERVER_CERT',
        serverKey: 'TUNEX_SERVER_KEY', stateDirectory: 'TUNEX_CONTROL_STATE', openssl: 'openssl', relayCredentialSeconds: 86400,
        port: 41001, host: '127.0.0.1', initializeAuthority: false, multihopEnabled: false, probeExecutionEnabled: false,
        probeScheduleEnabled: false, probeIngressEnabled: false, probeServicesEnabled: false, telemetryEnabled: false,
        forwardTelemetryEnabled: false, hostTelemetryEnabled: false, probeTelemetryEnabled: false, telemetryRollupsEnabled: false,
        stationAlertsEnabled: false, webhookDeliveryEnabled: false, policy: f.policy });
    assert.equal(f.supplied()!.policy, f.policy);
});

test('156 port and competing feature refusals occur at original read stage', async () => {
    for (const port of ['', '0', '-1', '65536', '1.5', 'NaN', 'Infinity']) {
        const f = fixture({ TUNEX_CONTROL_PORT: port }); await assert.rejects(runControlStartup(f.effects), /Invalid TUNEX_CONTROL_PORT/);
        assert.deepEqual(f.events, ['TUNEX_CONTROL_PORT']);
    }
    for (const [extra, error] of [
        [{ TUNEX_PROBE_SERVICES: '1', TUNEX_PROBE_SCHEDULE: '1' }, /SERVICES=1 requires/],
        [{ TUNEX_PROBE_INGRESS: '1', TUNEX_PROBE_SCHEDULE: '1' }, /INGRESS=1 requires/],
        [{ TUNEX_PROBE_SCHEDULE: '1' }, /SCHEDULE=1 requires/],
        [{ TUNEX_PROBE_EXECUTION: '1' }, /independently synchronized/],
    ] as const) {
        const f = fixture(extra); await assert.rejects(runControlStartup(f.effects), error);
        assert.deepEqual(f.events, [...featureReads, ...(extra.TUNEX_PROBE_EXECUTION === '1' ? ['TUNEX_PROBE_CLOCK_SKEW_SECONDS'] : [])]);
    }
});

test('156 production release gate short circuits, required arguments evaluate left to right and release errors stop startup', async () => {
    for (const nodeEnv of [undefined, '', 'development', 'production']) {
        const f = fixture({ NODE_ENV: nodeEnv }); await runControlStartup(f.effects);
        assert.equal(f.events.includes('verify'), false); assert.equal(f.reads.get('TUNEX_MULTIHOP_EXECUTION'), nodeEnv === 'production' ? 2 : 1);
    }
    for (const missing of ['TUNEX_MULTIHOP_RELEASE_EVIDENCE', 'TUNEX_SOURCE_REVISION']) {
        const f = fixture({ NODE_ENV: 'production', TUNEX_MULTIHOP_EXECUTION: '1', TUNEX_MULTIHOP_RELEASE_EVIDENCE: 'evidence', TUNEX_SOURCE_REVISION: 'revision', [missing]: '' });
        await assert.rejects(runControlStartup(f.effects), new RegExp(`${missing} required`));
        assert.equal(f.events.includes('verify'), false); assert.equal(f.events.includes('DATABASE_URL'), false);
        if (missing === 'TUNEX_MULTIHOP_RELEASE_EVIDENCE') assert.equal(f.events.includes('TUNEX_SOURCE_REVISION'), false);
    }
    const f = fixture({ NODE_ENV: 'production', TUNEX_MULTIHOP_EXECUTION: '1', TUNEX_MULTIHOP_RELEASE_EVIDENCE: 'evidence', TUNEX_SOURCE_REVISION: 'revision' });
    f.options.fail = 'verify'; await assert.rejects(runControlStartup(f.effects), error => error === f.failure);
    assert.deepEqual(f.events.slice(-4), ['TUNEX_MULTIHOP_EXECUTION', 'TUNEX_MULTIHOP_RELEASE_EVIDENCE', 'TUNEX_SOURCE_REVISION', 'verify']);
    assert.equal(f.events.includes('DATABASE_URL'), false);
});

test('156 successful release remains awaited and rereads multihop rather than capturing its first value', async () => {
    const f = fixture({ NODE_ENV: 'production', TUNEX_MULTIHOP_EXECUTION: '1', TUNEX_MULTIHOP_RELEASE_EVIDENCE: 'evidence', TUNEX_SOURCE_REVISION: 'revision' });
    const original = f.effects.env; let finish!: () => void;
    f.effects.env = name => { const value = original(name); return name === 'TUNEX_MULTIHOP_EXECUTION' && f.reads.get(name) === 2 ? '0' : value; };
    f.effects.verifyRelease = async () => { f.events.push('verify'); await new Promise<void>(resolve => { finish = resolve; }); };
    const starting = runControlStartup(f.effects); await Promise.resolve();
    assert.equal(f.events.at(-1), 'verify'); assert.equal(f.supplied(), undefined); finish(); await starting;
    assert.equal(f.supplied()!.multihopEnabled, false); assert.equal(f.reads.get('TUNEX_MULTIHOP_EXECUTION'), 2);
    assert.ok(f.events.indexOf('verify') < f.events.indexOf('DATABASE_URL'));
});

test('156 native Number/default and exact flag values retain permissive original conversions', async () => {
    for (const [text, port] of [['1', 1], ['65535', 65535], [' 10 ', 10], ['0x10', 16], ['1e2', 100]] as const) {
        const f = fixture({ TUNEX_CONTROL_PORT: text, TUNEX_TELEMETRY: 'true', TUNEX_OPENSSL: '', TUNEX_RELAY_CREDENTIAL_SECONDS: '' });
        await runControlStartup(f.effects); assert.equal(f.supplied()!.port, port); assert.equal(f.supplied()!.telemetryEnabled, false);
        assert.equal(f.supplied()!.relayCredentialSeconds, 0); assert.equal(f.supplied()!.openssl, '');
        assert.equal(Object.hasOwn(f.supplied()!, 'notificationSecretsDirectory'), false);
    }
});

test('156 every required server option fails before later option reads/start/log/signals', async () => {
    for (const [index, name] of required.entries()) {
        const f = fixture({ [name]: '' }); await assert.rejects(runControlStartup(f.effects), new RegExp(`${name} required`));
        assert.deepEqual(f.events, [...featureReads, 'NODE_ENV', ...required.slice(0, index + 1)]);
    }
    const f = fixture(); f.options.fail = 'start';
    await assert.rejects(runControlStartup(f.effects), error => error === f.failure);
    assert.equal(f.events.at(-1), 'start'); assert.equal(f.signals.size, 0); assert.equal(f.reads.get('TUNEX_CONTROL_HOST'), 1);
});

test('156 repeated environment reads, explicit feature flags and shallow policy spread remain observable', async () => {
    const f = fixture(Object.fromEntries(['TUNEX_PROBE_EXECUTION', 'TUNEX_PROBE_SCHEDULE', 'TUNEX_PROBE_INGRESS', 'TUNEX_PROBE_SERVICES',
        'TUNEX_PROBE_CLOCK_SKEW_SECONDS', 'TUNEX_AUTHORITY_INITIALIZE', 'TUNEX_TELEMETRY', 'TUNEX_FORWARD_TELEMETRY', 'TUNEX_HOST_TELEMETRY',
        'TUNEX_PROBE_TELEMETRY', 'TUNEX_TELEMETRY_ROLLUPS', 'TUNEX_STATION_ALERTS', 'TUNEX_WEBHOOK_DELIVERY'].map(name => [name, '1'])));
    const originalEnv = f.effects.env;
    f.effects.env = name => {
        const value = originalEnv(name);
        if (name === 'TUNEX_CONTROL_HOST') return f.reads.get(name) === 1 ? 'bound' : 'logged';
        if (name === 'TUNEX_NOTIFICATION_SECRETS') return f.reads.get(name) === 1 ? 'present' : 'second-directory';
        if (name === 'TUNEX_OPENSSL') return '';
        if (name === 'TUNEX_RELAY_CREDENTIAL_SECONDS') return 'not-number';
        return value;
    };
    await runControlStartup(f.effects); const value = f.supplied()!;
    assert.equal(value.host, 'bound'); assert.ok(f.events.includes('Control listening on https://logged:4567'));
    assert.equal(value.notificationSecretsDirectory, 'second-directory'); assert.equal(f.reads.get('TUNEX_NOTIFICATION_SECRETS'), 2);
    assert.equal(value.openssl, ''); assert.equal(Number.isNaN(value.relayCredentialSeconds), true);
    assert.notEqual(value.policy, f.policy); assert.equal(value.policy.nested, f.policy.nested); assert.equal(value.policy.maxClockSkewSeconds, 1);
    assert.equal(f.policy.maxClockSkewSeconds, 99);
    for (const key of ['probeExecutionEnabled', 'probeScheduleEnabled', 'probeIngressEnabled', 'probeServicesEnabled', 'initializeAuthority',
        'telemetryEnabled', 'forwardTelemetryEnabled', 'hostTelemetryEnabled', 'probeTelemetryEnabled', 'telemetryRollupsEnabled', 'stationAlertsEnabled', 'webhookDeliveryEnabled'] as const) assert.equal(value[key], true, key);
});

test('156 SIGINT before SIGTERM and close admission guard precedes await', async () => {
    const f = fixture(); let finish!: () => void;
    f.options.close = () => new Promise<void>(resolve => { finish = resolve; }); await runControlStartup(f.effects);
    assert.deepEqual([...f.signals.keys()], ['SIGINT', 'SIGTERM']);
    f.signals.get('SIGINT')!(); f.signals.get('SIGTERM')!(); f.signals.get('SIGINT')!();
    assert.equal(f.events.filter(name => name === 'close').length, 1); finish(); await Promise.resolve();
    f.signals.get('SIGTERM')!(); assert.equal(f.events.filter(name => name === 'close').length, 1);
});

test('156 policy getter and enumerable spread run after option evaluation without eager policy access', async () => {
    for (const enabled of [false, true]) {
        const f = fixture(enabled ? { TUNEX_PROBE_EXECUTION: '1', TUNEX_PROBE_CLOCK_SKEW_SECONDS: '1' } : {});
        const reads: string[] = [];
        const policy = { get maxClockSkewSeconds() { reads.push('skew'); return 99; }, get nested() { reads.push('nested'); return f.policy.nested; } };
        Object.defineProperty(f.effects, 'defaultPolicy', { get() { f.events.push('policy'); return policy; } });
        await runControlStartup(f.effects);
        assert.equal(f.events.filter(value => value === 'policy').length, 1);
        assert.ok(f.events.indexOf('TUNEX_NOTIFICATION_SECRETS') < f.events.indexOf('policy'));
        assert.ok(f.events.indexOf('policy') < f.events.indexOf('start'));
        assert.deepEqual(reads, enabled ? ['skew', 'nested'] : []);
        if (!enabled) assert.equal(f.supplied()!.policy, policy);
    }
});

test('156 rejected close stays once-only and retains the original uncaught rejection', async () => {
    const moduleUrl = new URL('../src/modules/control-startup-owner/service.ts', import.meta.url).href;
    const script = `import {runControlStartup} from ${JSON.stringify(moduleUrl)};
const signals={};let calls=0;const failure=new Error('close-original');
process.on('unhandledRejection',error=>{if(error!==failure)process.exit(2);signals.SIGTERM();setImmediate(()=>{console.log(calls);process.exit(calls===1?0:3)});});
await runControlStartup({env:name=>['DATABASE_URL','TUNEX_CA_CERT','TUNEX_CA_KEY','TUNEX_SERVER_CERT','TUNEX_SERVER_KEY','TUNEX_CONTROL_STATE'].includes(name)?'x':undefined,defaultPolicy:{},verifyRelease:async()=>{},start:async()=>({port:1,close:async()=>{calls++;throw failure}}),log:()=>{},onSignal:(name,callback)=>{signals[name]=callback}});signals.SIGINT();signals.SIGTERM();`;
    const result = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', script]); assert.equal(result.stdout.trim(), '1');
});

test('156 native leaves have no product import and main binds original server/release', async () => {
    const native = await readFile(new URL('../src/compatibility/native-control-startup.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(native, /modules\//);
    const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
    assert.match(main, /import \{ startControl \} from '\.\/server\.ts'/);
    assert.match(main, /runControlStartup\(\{\.\.\.nativeControlStartupEffects,start:startControl,verifyRelease:verifyMultihopRelease\}\)/);
});
