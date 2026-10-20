import test from 'node:test';
import assert from 'node:assert/strict';
import { CONSOLE_REQUEST_INTERFACE_VERSION, createConsoleRequests } from '../console-request-owner/public.js';
import { browserConsoleRequestEffects as native } from '../browser-native/public.js';

test('request public signatures and lazy connection getters retain short circuit and exact errors', async () => {
  const order = [], failure = new Error('state getter failed');
  let scope = '', token = '', broken;
  const state = {};
  for (const [name, value] of [['scope', () => scope], ['token', () => token], ['version', () => 1]]) {
    Object.defineProperty(state, name, { get() {
      order.push('lookup:' + name);
      if (broken === name) throw failure;
      return function () { assert.equal(this, state); order.push(name); return value(); };
    } });
  }
  const api = createConsoleRequests(state, new Proxy({}, { get() { assert.fail('connection cannot read effects'); } }));
  assert.equal(CONSOLE_REQUEST_INTERFACE_VERSION, 1);
  assert.deepEqual(Object.keys(api), ['connected', 'request', 'mutate', 'clearPending']);
  assert.deepEqual(Object.values(api).map(fn => fn.length), [0, 4, 3, 0]);
  assert.deepEqual(order, []);
  assert.throws(api.connected, { message: '请先连接 Control' });
  assert.deepEqual(order.splice(0), ['lookup:scope', 'scope']);
  scope = 'scope';
  await assert.rejects(api.request('GET', 'nodes'), { message: '请先连接 Control' });
  assert.deepEqual(order.splice(0), ['lookup:scope', 'scope', 'lookup:token', 'token']);
  token = 'token'; assert.equal(api.connected(), undefined);
  assert.deepEqual(order.splice(0), ['lookup:scope', 'scope', 'lookup:token', 'token']);
  broken = 'scope'; await assert.rejects(api.request('GET', 'nodes'), error => error === failure);
  assert.deepEqual(order, ['lookup:scope']);
});

test('request captures version before dispatch and preserves default options and effect receiver lookup order', async () => {
  const order = [], response = {}, result = { accepted: true }, state = {};
  for (const [name, value] of [['scope', 'scope'], ['token', 'token'], ['version', 9]]) {
    Object.defineProperty(state, name, { get() {
      order.push('lookup:' + name);
      return function () { assert.equal(this, state); order.push(name); return value; };
    } });
  }
  let optionsSeen;
  const methods = {
    send: (...args) => { assert.deepEqual(args.slice(0, 5), [state, 'PATCH', 'nodes/a', undefined, undefined]); optionsSeen = args[5]; return response; },
    readJson: value => { assert.equal(value, response); return result; },
    throwIfAborted: options => assert.equal(options, optionsSeen),
    checkResponse: (value, body) => { assert.equal(value, response); assert.equal(body, result); },
  };
  const effects = {};
  for (const name of Object.keys(methods)) Object.defineProperty(effects, name, { get() {
    order.push('lookup:' + name);
    return function (...args) { assert.equal(this, effects); order.push(name); return methods[name](...args); };
  } });
  const api = createConsoleRequests(state, effects);
  assert.equal(await api.request('PATCH', 'nodes/a'), result);
  assert.deepEqual(optionsSeen, {});
  assert.deepEqual(order.splice(0), ['lookup:scope', 'scope', 'lookup:token', 'token', 'lookup:version', 'version',
    'lookup:send', 'send', 'lookup:readJson', 'readJson', 'lookup:version', 'version',
    'lookup:throwIfAborted', 'throwIfAborted', 'lookup:checkResponse', 'checkResponse']);
  const firstOptions = optionsSeen;
  await api.request('PATCH', 'nodes/a'); assert.notEqual(optionsSeen, firstOptions);
  const explicitOptions = { signal: {} };
  await api.request('PATCH', 'nodes/a', undefined, undefined, explicitOptions);
  assert.equal(optionsSeen, explicitOptions);
});

test('request native failure precedence preserves identity except the exact JSON refusal boundary', async () => {
  const failure = new Error('original native failure'), options = {}, response = {};
  for (const stage of ['version-before', 'send', 'json', 'version-after', 'stale', 'abort', 'status']) {
    const order = []; let reads = 0;
    const api = createConsoleRequests({ scope: () => 's', token: () => 't', version: () => {
      order.push('version'); reads++;
      if (stage === (reads === 1 ? 'version-before' : 'version-after')) throw failure;
      return stage === 'stale' ? reads : 1;
    } }, {
      send() { order.push('send'); if (stage === 'send') throw failure; return response; },
      readJson() { order.push('json'); if (stage === 'json') return Promise.reject(failure); return null; },
      throwIfAborted(value) { assert.equal(value, options); order.push('abort'); if (stage === 'abort') throw failure; },
      checkResponse(value, result) { assert.equal(value, response); assert.equal(result, null); order.push('status'); throw failure; },
    });
    await assert.rejects(api.request('GET', 'nodes', undefined, undefined, options), error =>
      stage === 'json' ? error.message === 'Control 返回了非 JSON 响应' && error !== failure :
      stage === 'stale' ? error.message === '连接已变化，已丢弃旧请求结果' : error === failure);
    const expected = ['version', 'send', 'json', 'version', 'abort', 'status'];
    const end = { 'version-before': 1, send: 2, json: 3, 'version-after': 4, stale: 4, abort: 5, status: 6 }[stage];
    assert.deepEqual(order, expected.slice(0, end), stage);
  }
  const api = createConsoleRequests({ scope: () => 's', token: () => 't', version: () => 1 }, {
    send: () => response, get readJson() { throw failure; },
  });
  await assert.rejects(api.request('GET', 'nodes'), { message: 'Control 返回了非 JSON 响应' });
  assert.throws(() => native.checkResponse({ ok: false, status: 500 }, null), TypeError);
  assert.equal(native.checkResponse({ ok: true }, null), undefined);
  const result = { get code() { throw failure; } };
  assert.throws(() => native.checkResponse({ ok: false, status: 500 }, result), error => error === failure);
  const jsonFailure = { json() { assert.equal(this, jsonFailure); throw failure; } };
  assert.throws(() => native.readJson(jsonFailure), error => error === failure);
  const rejected = Promise.reject(failure), rejectedResponse = { json: () => rejected };
  assert.equal(native.readJson(rejectedResponse), rejected);
  await assert.rejects(rejected, error => error === failure);
  const cancellation = { signal: { throwIfAborted() { assert.equal(this, cancellation.signal); throw failure; } } };
  assert.throws(() => native.throwIfAborted(cancellation), error => error === failure);
  assert.equal(native.throwIfAborted({}), undefined);
});

test('native send returns the exact fetch promise and preserves native option defaults and getter order', t => {
  const order = [], signal = new AbortController().signal, sentinel = Promise.resolve({}), calls = [];
  t.mock.method(AbortSignal, 'timeout', value => { order.push(['timeout', value]); return signal; });
  t.mock.method(AbortSignal, 'any', values => { order.push(['any', values]); return signal; });
  t.mock.method(globalThis, 'fetch', (...args) => { calls.push(args); order.push('fetch'); return sentinel; });
  const state = { token() { order.push('token'); return 't'; }, scope() { order.push('scope'); return 's/a'; } };
  const options = { get timeoutMs() { order.push('timeoutMs'); return undefined; }, get signal() { order.push('signal'); return signal; } };
  assert.equal(native.send(state, 'POST', 'nodes', undefined, '', options), sentinel);
  assert.deepEqual(order, ['token', 'scope', 'timeoutMs', ['timeout', 15000], 'signal', 'signal', ['any', [signal, signal]], 'fetch']);
  assert.equal(calls[0][0], '/api/v1/scopes/s%2Fa/nodes');
  assert.deepEqual(calls[0][1], { method: 'POST', headers: { Authorization: 'Bearer t', Accept: 'application/json' },
    credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal });
  for (const [timeoutMs, expected] of [[null, 15000], [0, 0], [37, 37]]) {
    order.length = 0; assert.equal(native.send(state, 'GET', 'nodes', undefined, undefined, { timeoutMs }), sentinel);
    assert.deepEqual(order[2], ['timeout', expected]);
    assert.deepEqual(order[3], ['any', [signal]]);
  }
  const failure = new Error('native fetch failure');
  t.mock.method(globalThis, 'fetch', () => { throw failure; });
  assert.throws(() => native.send(state, 'GET', 'nodes', undefined, undefined, {}), error => error === failure);
});

test('mutation retains original input for separate signature and body serialization without clone or freeze', async t => {
  const signal = new AbortController().signal, order = [], sent = [], input = { count: 0,
    toJSON() { assert.equal(this, input); order.push('serialize:' + ++this.count); return { pass: this.count }; } };
  t.mock.method(AbortSignal, 'timeout', () => signal); t.mock.method(AbortSignal, 'any', () => signal);
  t.mock.method(globalThis.crypto, 'randomUUID', () => { order.push('key'); return 'stable'; });
  t.mock.method(globalThis, 'fetch', (url, options) => { sent.push({ url, options }); return Promise.resolve({ ok: true, json: async () => ({ accepted: true }) }); });
  const signatures = [], effects = { ...native, signature(...args) { const signature = native.signature(...args); signatures.push(signature); return signature; } };
  const api = createConsoleRequests({ scope: () => 'scope', token: () => 'token', version: () => 1 }, effects);
  assert.deepEqual(await api.mutate('PUT', 'forwards/a', input), { accepted: true });
  assert.deepEqual(order, ['serialize:1', 'key', 'serialize:2']);
  assert.equal(signatures[0], '["PUT","forwards/a",{"pass":1}]');
  assert.equal(sent[0].options.body, '{"pass":2}');
  assert.equal(sent[0].options.headers['Idempotency-Key'], 'stable');
  assert.equal(input.count, 2); assert.equal(Object.isFrozen(input), false);
});

test('same-signature concurrent mutations share a key and dispatch independently without an added queue', async () => {
  const sent = [], settle = []; let nextKey = 0;
  const api = createConsoleRequests({ scope: () => 's', token: () => 't', version: () => 1 }, {
    signature: native.signature, newKey: () => 'key-' + ++nextKey,
    send(_state, method, resource, input, key) { sent.push({ method, resource, input, key }); return new Promise(resolve => settle.push(resolve)); },
    readJson: response => response, throwIfAborted() {}, checkResponse() {},
  });
  const input = { revision: 1 }, a = api.mutate('PUT', 'forwards/a', input), b = api.mutate('PUT', 'forwards/a', input);
  assert.equal(sent.length, 2); assert.equal(nextKey, 1);
  assert.equal(sent[0].key, sent[1].key); assert.equal(sent[0].input, input); assert.equal(sent[1].input, input);
  settle[0]({ a: true }); settle[1]({ b: true });
  assert.deepEqual(await a, { a: true }); assert.deepEqual(await b, { b: true });
});

test('mutation signature and key failures precede connection and clearing pending performs no effects', async () => {
  const failure = new Error('key preparation failed'), order = []; let fail = 'signature', sequence = 0;
  const api = createConsoleRequests({ scope() { order.push('scope'); return ''; } }, {
    signature() { order.push('signature'); if (fail === 'signature') throw failure; return 'same'; },
    newKey() { order.push('key'); if (fail === 'key') throw failure; return ++sequence; },
  });
  await assert.rejects(api.mutate('PUT', 'nodes', {}), error => error === failure);
  assert.deepEqual(order.splice(0), ['signature']);
  fail = 'key'; await assert.rejects(api.mutate('PUT', 'nodes', {}), error => error === failure);
  assert.deepEqual(order.splice(0), ['signature', 'key']);
  fail = ''; await assert.rejects(api.mutate('PUT', 'nodes', {}), { message: '请先连接 Control' });
  assert.deepEqual(order.splice(0), ['signature', 'key', 'scope']);
  assert.equal(sequence, 1); assert.equal(api.clearPending(), undefined); assert.deepEqual(order, []);
  await assert.rejects(api.mutate('PUT', 'nodes', {}), { message: '请先连接 Control' });
  assert.equal(sequence, 2); assert.deepEqual(order, ['signature', 'key', 'scope']);
});

test('native response errors preserve property and primitive coercion order including falsy nonnull values', () => {
  const order = [], result = {
    get code() { order.push('code'); return { [Symbol.toPrimitive](hint) { order.push('code:' + hint); return 'DENIED'; } }; },
    get message() { order.push('message'); return { [Symbol.toPrimitive](hint) { order.push('message:' + hint); return 'reason'; } }; },
  };
  const response = { get ok() { order.push('ok'); return false; }, get status() { order.push('status'); return 403; } };
  assert.throws(() => native.checkResponse(response, result), error => error.message === 'DENIED：reason' && error.httpStatus === 403);
  assert.deepEqual(order, ['ok', 'code', 'code:string', 'message', 'message:string', 'status']);
  assert.throws(() => native.checkResponse({ ok: false, status: 0 }, { code: 0, message: false }),
    error => error.message === '0：false' && error.httpStatus === 0);
  const failure = new Error('message coercion failed');
  assert.throws(() => native.checkResponse({ ok: false, status: 400 }, { code: 'BAD', get message() { throw failure; } }), error => error === failure);
});
