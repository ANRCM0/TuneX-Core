import test from 'node:test';
import assert from 'node:assert/strict';
import { createConsoleRequests } from '../console-request-owner/public.js';
import { browserConsoleRequestEffects } from '../browser-native/public.js';

function harness() {
  let version = 1, fail = false, key = 0;
  const calls = [], order = [];
  const state = { scope: () => 'scope', token: () => 'token', version: () => version };
  const effects = {
    send: async (_state, method, resource, input, stableKey) => { calls.push({ method, resource, input, stableKey }); return {}; },
    readJson: async () => { order.push('decode'); if (fail) throw Error('decode'); return { ok: true }; },
    throwIfAborted: () => { order.push('abort'); }, checkResponse: () => { order.push('status'); },
    signature: (method, resource, input) => JSON.stringify([method, resource, input]), newKey: () => 'key-' + ++key,
  };
  return { api: createConsoleRequests(state, effects), calls, order, effects,
    stale: () => { version++; }, failDecode: value => { fail = value; } };
}

test('canonical request factory gives JSON decoding precedence over stale connection and abort/status checks', async () => {
  const h = harness();
  h.effects.send = async () => { h.stale(); return {}; };
  h.failDecode(true);
  await assert.rejects(h.api.request('GET', 'nodes'), /Control 返回了非 JSON 响应/);
  assert.deepEqual(h.order, ['decode']);
  h.failDecode(false); h.order.length = 0;
  await assert.rejects(h.api.request('GET', 'nodes'), /连接已变化/);
  assert.deepEqual(h.order, ['decode']);
});

test('canonical mutation factory retains keys after failure, deletes on success, and resets explicitly', async () => {
  const h = harness(), input = { expectedRevision: 7 };
  h.failDecode(true);
  await assert.rejects(h.api.mutate('PUT', 'forwards/a', input));
  await assert.rejects(h.api.mutate('PUT', 'forwards/a', input));
  assert.equal(h.calls[0].stableKey, h.calls[1].stableKey);
  h.failDecode(false);
  await h.api.mutate('PUT', 'forwards/a', input);
  assert.equal(h.calls[2].stableKey, h.calls[0].stableKey);
  await h.api.mutate('PUT', 'forwards/a', input);
  assert.notEqual(h.calls[3].stableKey, h.calls[2].stableKey);
  h.failDecode(true); await assert.rejects(h.api.mutate('PUT', 'forwards/a', input));
  h.api.clearPending(); await assert.rejects(h.api.mutate('PUT', 'forwards/a', input));
  assert.notEqual(h.calls[4].stableKey, h.calls[5].stableKey);
});

test('canonical request succeeds only after decode, cancellation, and response checks in order', async () => {
  const h = harness();
  assert.deepEqual(await h.api.request('GET', 'nodes'), { ok: true });
  assert.deepEqual(h.order, ['decode', 'abort', 'status']);
});

test('canonical request construction is lazy and disconnected mutations prepare a stable key before connection refusal', async () => {
  const order = [];
  const state = {
    scope: () => { order.push('scope'); return ''; },
    token: () => { order.push('token'); return 'token'; },
    version: () => { order.push('version'); return 1; },
  };
  const effects = {
    signature: () => { order.push('signature'); return 'same'; },
    newKey: () => { order.push('key'); return 'stable'; },
    send: () => assert.fail('disconnected request cannot send'),
  };
  const api = createConsoleRequests(state, effects);
  assert.deepEqual(order, []);
  await assert.rejects(api.mutate('PUT', 'forwards/a', {}), /请先连接 Control/);
  assert.deepEqual(order, ['signature', 'key', 'scope']);
  order.length = 0;
  await assert.rejects(api.mutate('PUT', 'forwards/a', {}), /请先连接 Control/);
  assert.deepEqual(order, ['signature', 'scope']);
});

test('native request effects preserve exact fetch framing and caller cancellation reason', async t => {
  const calls = [], response = { json: async () => ({ accepted: true }) };
  t.mock.method(globalThis, 'fetch', async (...args) => { calls.push(args); return response; });
  const state = { token: () => 'secret-token', scope: () => 'scope:a/b' };
  const controller = new AbortController(), reason = { stopped: true };
  const input = { expectedRevision: 3 };
  assert.equal(await browserConsoleRequestEffects.send(state, 'PUT', 'forwards/a', input, 'stable-key', { signal: controller.signal, timeoutMs: 5000 }), response);
  const [url, options] = calls[0];
  assert.equal(url, '/api/v1/scopes/scope%3Aa%2Fb/forwards/a');
  assert.deepEqual(options.headers, { Authorization: 'Bearer secret-token', Accept: 'application/json', 'Content-Type': 'application/json', 'Idempotency-Key': 'stable-key' });
  assert.equal(options.method, 'PUT'); assert.equal(options.body, JSON.stringify(input));
  assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store');
  assert.equal(options.redirect, 'error'); assert.equal(options.referrerPolicy, 'no-referrer');
  controller.abort(reason); assert.equal(options.signal.aborted, true); assert.equal(options.signal.reason, reason);
  assert.throws(() => browserConsoleRequestEffects.throwIfAborted({ signal: controller.signal }), error => error === reason);
  await browserConsoleRequestEffects.send(state, 'GET', 'nodes', undefined, undefined, {});
  assert.equal(Object.hasOwn(calls[1][1], 'body'), false);
  assert.deepEqual(calls[1][1].headers, { Authorization: 'Bearer secret-token', Accept: 'application/json' });
  assert.deepEqual(await browserConsoleRequestEffects.readJson(response), { accepted: true });
});

test('native response checking preserves server code and status with bounded fallback semantics', () => {
  assert.throws(() => browserConsoleRequestEffects.checkResponse({ ok: false, status: 409 }, { code: 'REVISION_CONFLICT', message: 'changed' }),
    error => error.httpStatus === 409 && error.message === 'REVISION_CONFLICT：changed');
  assert.throws(() => browserConsoleRequestEffects.checkResponse({ ok: false, status: 503 }, {}),
    error => error.httpStatus === 503 && error.message === 'HTTP_503：请求失败');
  assert.equal(browserConsoleRequestEffects.checkResponse({ ok: true }, {}), undefined);
});
