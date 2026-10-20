import assert from 'node:assert/strict';
import { test } from 'node:test';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RequestOptions } from 'node:https';
import { parseJson } from '@tunex/contracts/shared';
import { runControlClient, CONTROL_CLIENT_COMMAND_INTERFACE_VERSION } from '../src/modules/control-client-command-owner/public.ts';
import { runControlClient as canonical } from '../src/modules/control-client-command-owner/service.ts';
import type { ControlClientEffects } from '../src/modules/control-client-command-owner/public.ts';
import { nativeControlClientEffects } from '../src/compatibility/public.ts';
import { nativeControlClientEffects as leafEffects } from '../src/compatibility/native-control-client-cli.ts';

type Url = { path: string; base: string }; type Bytes = { ca: symbol };
function fixture(args: string[]) {
    const events: string[] = [], env: Record<string, string | undefined> = { TUNEX_CONTROL_URL: 'https://control.example/base', TUNEX_CA_CERT: 'ca-file', TUNEX_OWNER_TOKEN: 'token' };
    const ca = { ca: Symbol('opaque') }, failure = new Error('original');
    const options = { fail: '', response: '{"result":true}', input: '{"input":"é"}' };
    let supplied: Parameters<ControlClientEffects<Url, Bytes>['request']> | undefined;
    const event = (name: string) => { events.push(name); if (options.fail === name) throw failure; };
    const effects: ControlClientEffects<Url, Bytes> = {
        arguments() { event('args'); return args; }, env(name) { event(name); return env[name]; },
        async readText(path) { event(`text:${path}`); return options.input; }, async readBytes(path) { event(`bytes:${path}`); return ca; },
        parseJson(text) { event(text === options.response ? 'parse-response' : 'parse-input'); return JSON.parse(text) as unknown; },
        stringify(value, replacer, space) { event(space === 2 ? 'pretty' : 'stringify'); return JSON.stringify(value, replacer, space); },
        encodeComponent(value) { event(`encode:${value}`); return encodeURIComponent(value); },
        url(path, base) { event('url'); return { path, base }; },
        async request(...values) { event('request'); supplied = values; return options.response; }, log(message) { event('log'); assert.equal(message, '{\n  "result": true\n}'); },
    };
    return { effects, events, env, ca, failure, options, supplied: () => supplied };
}
type Case = { args: string[]; method: string; path: string; key?: string; file?: string; body?: unknown; literal?: string };
const cases: Case[] = [
    { args: ['relay-plan', 'scope', 'input'], method: 'POST', path: 'relay-plan', file: 'input', body: { input: 'é' } },
    { args: ['profile-grants', 'scope', 'p/é'], method: 'GET', path: 'transport-profiles/p%2F%C3%A9/grants' },
    { args: ['profile-grant', 'scope', 'p', 'actor/', 'input', 'mutation'], method: 'PUT', path: 'transport-profiles/p/grants/actor%2F', file: 'input', key: 'mutation', body: { input: 'é' } },
    { args: ['node-endpoint-get', 'scope', 'n'], method: 'GET', path: 'nodes/n/relay-endpoint' },
    { args: ['node-endpoint', 'scope', 'n', 'input', 'stable'], method: 'PUT', path: 'nodes/n/relay-endpoint', file: 'input', key: 'stable', body: { input: 'é' } },
    { args: ['profiles', 'scope'], method: 'GET', path: 'transport-profiles' },
    { args: ['profile-get', 'scope', 'p'], method: 'GET', path: 'transport-profiles/p' },
    { args: ['profile-get', 'scope', 'p', '1 /'], method: 'GET', path: 'transport-profiles/p?revision=1%20%2F', key: '1 /' },
    { args: ['profile', 'scope', 'p', 'input', 'stable'], method: 'PUT', path: 'transport-profiles/p', file: 'input', key: 'stable', body: { input: 'é' } },
    { args: ['members', 'scope'], method: 'GET', path: 'members' },
    { args: ['member', 'scope', 'a', 'input', 'stable'], method: 'PUT', path: 'members/a', file: 'input', key: 'stable', body: { input: 'é' } },
    { args: ['node-grants', 'scope', 'n'], method: 'GET', path: 'nodes/n/grants' },
    { args: ['node-grant', 'scope', 'n', 'a', 'input', 'mutation'], method: 'PUT', path: 'nodes/n/grants/a', file: 'input', key: 'mutation', body: { input: 'é' } },
    { args: ['create', 'scope', 'input', 'stable'], method: 'POST', path: 'forwards', file: 'input', key: 'stable', body: { input: 'é' } },
    { args: ['node', 'scope', 'input'], method: 'POST', path: 'nodes', file: 'input', body: { input: 'é' } },
    { args: ['get', 'scope', 'f/é'], method: 'GET', path: 'forwards/f%2F%C3%A9' },
    { args: ['operation', 'scope', 'o'], method: 'GET', path: 'operations/o' },
    { args: ['node-get', 'scope', 'n'], method: 'GET', path: 'nodes/n' },
    { args: ['update', 'scope', 'f', '0x10', 'input', 'mutation'], method: 'PUT', path: 'forwards/f', file: 'input', key: 'mutation', body: { expectedRevision: 16, spec: { input: 'é' } } },
    { args: ['node-policy', 'scope', 'n', 'bad-number', 'input', 'mutation'], method: 'PUT', path: 'nodes/n/policy', file: 'input', key: 'mutation', body: { expectedRevision: null, policy: { input: 'é' } } },
    { args: ['delete', 'scope', 'f', '1.5', 'stable'], method: 'DELETE', path: 'forwards/f', key: 'stable', body: { expectedRevision: 1.5 } },
    { args: ['retry', 'scope', 'o', 'Infinity', 'stable'], method: 'POST', path: 'operations/o/retry', key: 'stable', body: { expectedRevision: null } },
    { args: ['node-revoke', 'scope', 'n', 'stable'], method: 'POST', path: 'nodes/n/revoke', key: 'stable', literal: '{}' },
];
for (const entry of cases) test(`157 ${entry.args[0]} ${entry.args[3] ?? ''} exact command method/path/body/key and opaque providers`, async () => {
    const argumentsWithIgnoredTail = [...entry.args]; argumentsWithIgnoredTail.length = 6;
    argumentsWithIgnoredTail.push('ignored-extra', 'still-ignored');
    const f = fixture(argumentsWithIgnoredTail); await runControlClient(f.effects);
    const [url, method, ca, token, key, body] = f.supplied()!;
    assert.deepEqual(url, { path: `/api/v1/scopes/scope/${entry.path}`, base: 'https://control.example/base' });
    assert.equal(method, entry.method); assert.equal(ca, f.ca); assert.equal(token, 'token'); assert.equal(key, entry.key);
    assert.equal(body, entry.literal ?? (entry.body ? JSON.stringify(entry.body) : undefined));
    assert.deepEqual(f.events.slice(0, 4), ['args', 'TUNEX_CONTROL_URL', 'TUNEX_CA_CERT', 'TUNEX_OWNER_TOKEN']);
    assert.ok(f.events.indexOf('url') < f.events.indexOf('bytes:ca-file'));
    if (entry.file) assert.ok(f.events.indexOf(`text:${entry.file}`) < f.events.indexOf('parse-input') && f.events.indexOf('parse-input') < f.events.indexOf('stringify'));
    else assert.equal(f.events.some(name => name.startsWith('text:')), false);
    assert.deepEqual(f.events.slice(-5), ['bytes:ca-file', 'request', 'parse-response', 'pretty', 'log']);
});

test('157 public generic signature and native identity preserve strict parse binding', () => {
    assert.equal(runControlClient, canonical); assert.equal(CONTROL_CLIENT_COMMAND_INTERFACE_VERSION, 1);
    assert.equal(nativeControlClientEffects, leafEffects); assert.equal(nativeControlClientEffects.parseJson, parseJson);
});

test('157 required env/scope precede command dispatch; every required positional argument preserves original usage refusal', async () => {
    for (const env of [{ TUNEX_CONTROL_URL: 'HTTPS://control' }, { TUNEX_CA_CERT: '' }, { TUNEX_OWNER_TOKEN: '' }]) {
        const f = fixture(['unknown', 'scope']); Object.assign(f.env, env);
        await assert.rejects(runControlClient(f.effects), /Trusted Control URL\/CA, owner token and scope required/);
        assert.deepEqual(f.events, ['args', 'TUNEX_CONTROL_URL', 'TUNEX_CA_CERT', 'TUNEX_OWNER_TOKEN']);
    }
    const scope = fixture(['profiles']); await assert.rejects(runControlClient(scope.effects), /scope required/);
    const requirements: Record<string, number[]> = {
        'relay-plan': [2], 'profile-grants': [2], 'profile-grant': [2, 3, 4, 5], 'node-endpoint-get': [2], 'node-endpoint': [2, 3, 4],
        'profile-get': [2], profile: [2, 3, 4], member: [2, 3, 4], 'node-grants': [2], 'node-grant': [2, 3, 4, 5],
        create: [2], node: [2], get: [2], operation: [2], 'node-get': [2], update: [2, 3, 4, 5], 'node-policy': [2, 3, 4, 5],
        delete: [2, 3, 4], retry: [2, 3, 4], 'node-revoke': [2, 3],
    };
    const usage: Record<string, string> = {
        'relay-plan': 'Forward JSON file required', 'profile-grants': 'Profile ID required', 'profile-get': 'Profile ID required',
        'node-endpoint-get': 'Node ID required', 'node-grants': 'Node ID required', create: 'JSON input file required', node: 'JSON input file required',
        get: 'Resource ID required', operation: 'Resource ID required', 'node-get': 'Resource ID required',
        'profile-grant': 'Usage: profile-grant <scope> <profileId> <actorId> <input.json> <stable-key>',
        'node-endpoint': 'Usage: node-endpoint <scope> <nodeId> <input.json> <stable-key>',
        profile: 'Usage: profile <scope> <profileId> <input.json> <stable-key>', member: 'Usage: member <scope> <actorId> <input.json> <stable-key>',
        'node-grant': 'Usage: node-grant <scope> <nodeId> <actorId> <input.json> <stable-key>',
        update: 'Usage: update <scope> <id> <expectedRevision> <spec.json> <key>', 'node-policy': 'Usage: update <scope> <id> <expectedRevision> <spec.json> <key>',
        delete: 'Usage: delete|retry <scope> <id> <expectedRevision> <key>', retry: 'Usage: delete|retry <scope> <id> <expectedRevision> <key>',
        'node-revoke': 'Usage: node-revoke <scope> <nodeId> <stable-key>',
    };
    for (const [command, indices] of Object.entries(requirements)) for (const index of indices) {
        const args = [command, 'scope', 'id', 'key', 'file', 'mutation']; args[index] = '';
        const f = fixture(args); await assert.rejects(runControlClient(f.effects), { message: usage[command] });
        assert.deepEqual(f.events, ['args', 'TUNEX_CONTROL_URL', 'TUNEX_CA_CERT', 'TUNEX_OWNER_TOKEN']);
    }
    const unknown = fixture(['unknown', 'scope']); await assert.rejects(runControlClient(unknown.effects), {
        message: 'Usage: create|node|get|operation|update|delete|retry|node-get|node-policy|node-revoke|members|member|node-grants|node-grant|profiles|profile-get|profile|profile-grants|profile-grant|node-endpoint-get|node-endpoint' });
    const create = fixture(['create', 'scope', 'input']);
    await assert.rejects(runControlClient(create.effects), /persistent Idempotency-Key/);
    assert.ok(create.events.includes('stringify')); assert.equal(create.events.includes('url'), false);
});

test('157 provider failures preserve identity and stop without catch, retry or later output', async () => {
    const stages = ['args', 'TUNEX_CONTROL_URL', 'TUNEX_CA_CERT', 'TUNEX_OWNER_TOKEN', 'text:input', 'parse-input', 'stringify', 'encode:scope', 'url', 'bytes:ca-file', 'request', 'parse-response', 'pretty', 'log'];
    for (const failed of stages) {
        const f = fixture(['create', 'scope', 'input', 'key']); f.options.fail = failed;
        await assert.rejects(runControlClient(f.effects), error => error === f.failure);
        assert.equal(f.events.at(-1), failed); assert.equal(f.events.filter(name => name === 'request').length, stages.indexOf(failed) >= stages.indexOf('request') ? 1 : 0);
    }
    const f = fixture(['profiles', 'space/é']); await runControlClient(f.effects);
    assert.equal(f.supplied()![0].path, '/api/v1/scopes/space%2F%C3%A9/transport-profiles');
    const strict = fixture(['profiles', 'scope']); strict.effects.parseJson = parseJson; strict.options.response = '{"x":1,"x":2}';
    await assert.rejects(runControlClient(strict.effects)); assert.equal(strict.events.includes('pretty'), false); assert.equal(strict.events.includes('log'), false);
});

test('157 native HTTPS exact headers, UTF8 body length, end, chunks, statuses, timeout destruction and original errors', async t => {
    let callback: ((res: EventEmitter & { statusCode?: number | undefined }) => void) | undefined;
    let supplied: { url: unknown; options: RequestOptions } | undefined;
    let req: EventEmitter & { end(body: unknown): void; destroy(error: Error): void };
    const ended: unknown[] = [], destroyed: Error[] = []; let calls = 0, creationFailure: Error | undefined, endFailure: Error | undefined;
    t.mock.method(https, 'request', ((url: unknown, options: RequestOptions, receive: typeof callback) => {
        calls++; if (creationFailure) throw creationFailure;
        supplied = { url, options }; callback = receive;
        req = Object.assign(new EventEmitter(), { end(body: unknown) { ended.push(body); if (endFailure) throw endFailure; }, destroy(error: Error) { destroyed.push(error); req.emit('error', error); } });
        return req;
    }) as typeof https.request);
    syncBuiltinESMExports();
    try {
        const url = new URL('https://control.example/path'), ca = Buffer.from('ca');
        for (const [body, key] of [['é', 'key'], [undefined, undefined], ['', '']] as const) {
            const pending = nativeControlClientEffects.request(url, 'POST', ca, 'token', key, body);
            assert.equal(supplied!.url, url); assert.equal(supplied!.options.ca, ca); assert.equal(supplied!.options.timeout, 10000);
            assert.deepEqual(Object.keys(supplied!.options), ['method', 'ca', 'timeout', 'headers']);
            assert.equal(supplied!.options.method, 'POST');
            assert.deepEqual(supplied!.options.headers, { authorization: 'Bearer token', 'content-type': 'application/json',
                ...(key ? { 'idempotency-key': key } : {}), ...(body ? { 'content-length': '2' } : {}) });
            assert.equal(ended.at(-1), body);
            const res = Object.assign(new EventEmitter(), { statusCode: 200 }); callback!(res);
            const bytes = Buffer.from('é'); res.emit('data', bytes.subarray(0, 1)); res.emit('data', bytes.subarray(1)); res.emit('end');
            assert.equal(await pending, 'é');
        }
        for (const statusCode of [199, 201, 204, 299, 300, 302, 400, 503, undefined]) {
            const pending = nativeControlClientEffects.request(url, 'GET', ca, 'token', undefined, undefined);
            const res = Object.assign(new EventEmitter(), { statusCode }); callback!(res); res.emit('data', Buffer.from('raw')); res.emit('end');
            if (statusCode !== undefined && statusCode >= 200 && statusCode < 300) assert.equal(await pending, 'raw');
            else await assert.rejects(pending, { message: `HTTP ${statusCode}: raw` });
        }
        const failure = new Error('native-request');
        const errored = nativeControlClientEffects.request(url, 'GET', ca, 'token', undefined, undefined);
        req!.emit('error', failure); await assert.rejects(errored, error => error === failure);
        const timed = nativeControlClientEffects.request(url, 'GET', ca, 'token', undefined, undefined);
        req!.emit('timeout'); await assert.rejects(timed, error => error === destroyed.at(-1));
        assert.equal(destroyed.at(-1)!.message, 'Control request timeout'); assert.equal(destroyed.length, 1);
        assert.equal(calls, 14);
        creationFailure = failure;
        await assert.rejects(nativeControlClientEffects.request(url, 'GET', ca, 'token', undefined, undefined), error => error === failure);
        creationFailure = undefined; endFailure = failure;
        await assert.rejects(nativeControlClientEffects.request(url, 'GET', ca, 'token', undefined, undefined), error => error === failure);
        assert.equal(calls, 16);
    } finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
});

test('157 native argv/env/URL/encoding/strict JSON/files and main composition retain original implementations', async t => {
    const directory = await mkdtemp(join(tmpdir(), 'tunex-client-'));
    try {
        const path = join(directory, 'input'); await writeFile(path, 'é');
        assert.equal(await nativeControlClientEffects.readText(path), 'é'); assert.deepEqual(await nativeControlClientEffects.readBytes(path), Buffer.from('é'));
        t.mock.property(process, 'argv', ['node', 'cli', 'profiles', 'scope']); assert.deepEqual(nativeControlClientEffects.arguments(), ['profiles', 'scope']);
        assert.equal(nativeControlClientEffects.env('PATH'), process.env.PATH);
        assert.equal(nativeControlClientEffects.url('/path', 'https://control.example/base').href, 'https://control.example/path');
        assert.equal(nativeControlClientEffects.encodeComponent(' /é'), '%20%2F%C3%A9');
        assert.throws(() => nativeControlClientEffects.parseJson('{"x":1,"x":2}'));
        assert.equal(nativeControlClientEffects.stringify({ x: 1 }, null, 2), '{\n  "x": 1\n}');
        const logs: unknown[] = []; t.mock.method(console, 'log', (value: unknown) => { logs.push(value); }); nativeControlClientEffects.log('text'); assert.deepEqual(logs, ['text']);
    } finally { await rm(directory, { recursive: true, force: true }); }
    const source = await readFile(new URL('../src/compatibility/native-control-client-cli.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /modules\/|redirect|setTimeout|process\.exit|\.catch\(/);
    const client = await readFile(new URL('../src/client.ts', import.meta.url), 'utf8'); assert.match(client, /await runControlClient\(nativeControlClientEffects\)/);
});
