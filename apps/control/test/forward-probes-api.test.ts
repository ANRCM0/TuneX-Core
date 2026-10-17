import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/api/app.ts';
import { ControlError } from '../src/application/errors.ts';
import type { ControlApplication } from '../src/application/control.ts';
import type { RuntimeController } from '../src/modules/runtime/controller.ts';
import type { AuthorityStore } from '../src/infrastructure/authority.ts';

function fixture() {
    const calls: unknown[][] = [];
    const control = { identity: { authenticate: async (header: string | undefined) => {
        if (header !== 'Bearer test-token') throw new ControlError('UNAUTHENTICATED', 401, 'Bearer required');
        return 'actor-a';
    } }, probes: {
        create: async (...args: unknown[]) => { calls.push(['create', ...args]); return { status: 202, body: { probeId: 'probe-a' } }; },
        inspect: async (...args: unknown[]) => { calls.push(['inspect', ...args]); return { health: 'unknown', executionEnabled: false }; },
        revoke: async (...args: unknown[]) => { calls.push(['revoke', ...args]); return { id: 'probe-a', state: 'consumed', withdrawnAt: 1800000000000 }; },
    } } as unknown as ControlApplication;
    const app = createApp(control, {} as RuntimeController, { allow: async () => undefined } as unknown as AuthorityStore);
    const call = (method: string, path: string, body?: string, headers: Record<string, string> = {}) => app.request(path,
        { method, headers: { authorization: 'Bearer test-token', 'content-type': 'application/json', ...headers },
            ...(body === undefined ? {} : { body }) });
    return { calls, call };
}

test('Probe management routes delegate verified actor, scope, strict JSON and idempotency key', async () => {
    const f = fixture(), input = { version: 1, kind: 'tcp-connect', expectedRevision: 1 };
    const accepted = await f.call('POST', '/api/v1/scopes/scope-a/forwards/forward-a/probes', JSON.stringify(input), { 'idempotency-key': 'request-a' });
    assert.equal(accepted.status, 202); assert.deepEqual(await accepted.json(), { probeId: 'probe-a' });
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0])), ['create', 'actor-a', 'scope-a', 'forward-a', 'request-a', input]);
    const read = await f.call('GET', '/api/v1/scopes/scope-a/probes/probe-a');
    assert.equal(read.status, 200); assert.equal((await read.json()).health, 'unknown');
    const revoked = await f.call('POST', '/api/v1/scopes/scope-a/probes/probe-a/revoke', '{}');
    assert.equal(revoked.status, 200); assert.deepEqual(await revoked.json(), { probeId: 'probe-a', state: 'consumed', executionEnabled: false,
        withdrawnAt: new Date(1800000000000).toISOString() });
    assert.equal(revoked.headers.get('cache-control'), 'no-store');
});

test('Probe management routes reject cookies, missing authentication, oversized/duplicate JSON and query injection before delegation', async () => {
    const f = fixture(), path = '/api/v1/scopes/scope-a/forwards/forward-a/probes';
    for (const headers of [{ cookie: 'session=x' }, { authorization: '' }]) {
        assert.equal((await f.call('POST', path, '{}', headers)).status, 401);
    }
    assert.equal((await f.call('POST', path, '{"version":1,"version":1}')).status, 409);
    assert.equal((await f.call('POST', path, JSON.stringify({ data: 'x'.repeat(1024) }))).status, 413);
    assert.equal((await f.call('GET', '/api/v1/scopes/scope-a/probes/probe-a?target=127.0.0.1')).status, 422);
    for (const body of ['null', '[]', '{"target":"127.0.0.1"}'])
        assert.equal((await f.call('POST', '/api/v1/scopes/scope-a/probes/probe-a/revoke', body)).status, 422);
    assert.deepEqual(f.calls, []);
});
