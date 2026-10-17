import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/api/app.ts';
import { ControlError } from '../src/application/errors.ts';
import type { ControlApplication } from '../src/application/control.ts';
import type { RuntimeController } from '../src/modules/runtime/controller.ts';
import type { AuthorityStore } from '../src/infrastructure/authority.ts';

function fixture() {
    const events: unknown[][] = [], tx = Symbol('read-transaction');
    const control = {
        db: { transaction: async (action: (value: symbol) => Promise<unknown>) => action(tx) },
        identity: {
            authenticate: async (header: string) => { if (header !== 'Bearer test-token') throw new ControlError('UNAUTHENTICATED', 401, 'Bearer required'); return 'actor-a'; },
            scope: async (...args: unknown[]) => { events.push(['scope', ...args]); if (args[2] !== 'scope-a') throw new ControlError('AUTHORIZATION_DENIED', 403, 'Scope denied'); },
        },
        ledger: { get: async (...args: unknown[]) => { events.push(['read', ...args]); return { id: 'source-a', forward_id: 'rule-a', kind: 'update',
            requested_by: 'actor-a', source_operation_id: null, status: 'failed', recovery_invalidated: 0, target_revision: 3, cleanup_pending: 1, last_error: { code: 'TARGET_UNAVAILABLE' } }; } },
        retry: async (...args: unknown[]) => { events.push(['retry', ...args]); return { status: 202, body: { forwardId: 'rule-a', revision: 3, operationId: 'retry-a', sourceOperationId: 'source-a' } }; },
    } as unknown as ControlApplication;
    const app = createApp(control, {} as RuntimeController, { allow: async () => undefined } as unknown as AuthorityStore);
    const call = (method: string, resource: string, body?: string, headers = {}) => app.request('/api/v1/scopes/' + resource,
        { method, headers: { authorization: 'Bearer test-token', 'idempotency-key': 'command-a', 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body }) });
    return { events, tx, call };
}

test('Operation detail exposes the scoped Forward identity for explicit retry without skipping same-transaction authorization', async () => {
    const f = fixture(), response = await f.call('GET', 'scope-a/operations/source-a');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: 'source-a', forwardId: 'rule-a', kind: 'update', requestedBy: 'actor-a', sourceOperationId: null,
        status: 'failed', recoveryInvalidated: false, targetRevision: 3, cleanupPending: true, lastError: { code: 'TARGET_UNAVAILABLE' } });
    assert.deepEqual(f.events, [['scope', f.tx, 'actor-a', 'scope-a'], ['read', f.tx, 'scope-a', 'source-a']]);
    f.events.length = 0;
    assert.equal((await f.call('GET', 'foreign/operations/source-a')).status, 403);
    assert.equal(f.events.some(event => event[0] === 'read'), false);
});

test('explicit retry delegates the original actor/scope/key and rejects extra or duplicate intent fields', async () => {
    const f = fixture(), path = 'scope-a/operations/source-a/retry';
    for (const body of ['null', '[]', '{}', '{"expectedRevision":"3"}', '{"expectedRevision":3,"enabled":true}', '{"expectedRevision":3,"expectedRevision":3}'])
        assert.ok((await f.call('POST', path, body)).status >= 400);
    assert.equal(f.events.length, 0);
    assert.equal((await f.call('POST', path, '{"expectedRevision":3}', { cookie: 'x=y' })).status, 401);
    assert.equal((await f.call('POST', path, '{"expectedRevision":3}', { authorization: '' })).status, 401);
    const response = await f.call('POST', path, '{"expectedRevision":3}'); assert.equal(response.status, 202);
    assert.deepEqual(f.events, [['retry', 'actor-a', 'scope-a', 'command-a', 'source-a', 3]]);
    assert.equal(response.headers.get('cache-control'), 'no-store');
});
