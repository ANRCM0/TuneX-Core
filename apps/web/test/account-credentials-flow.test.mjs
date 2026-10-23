import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountCredentialView, initAccountCredentials, requestAccountCredentials } from '../account-credentials.js';

const oldToken = 'a'.repeat(64), newToken = 'b'.repeat(64);
const view = () => ({ credentialVersion: 1, actorId: 'account-a', kind: 'bearer', scope: 'account-global',
  history: { source: 'self-service-rotation', retained: 1, limit: 1024, lastSelfRotatedAt: 1790000000000 }, agentCredentialsChanged: false });

test('own-account credential metadata rejects other identities, secret fields and contradictory history', () => {
  const value = view(); assert.deepEqual(accountCredentialView(value, 'account-a'), value);
  for (const changed of [{ actorId: 'another-account' }, { tokenHash: 'private' }, { agentCredentialsChanged: true },
    { scope: 'workspace' }, { history: { ...value.history, retained: 0 } }, { history: { ...value.history, source: 'telemetry' } }])
    assert.throws(() => accountCredentialView({ ...value, ...changed }, 'account-a'));
  assert.throws(() => accountCredentialView(value, 'account-a', true));
  assert.equal(accountCredentialView({ ...value, changed: false }, 'account-a', true).changed, false);
});

test('credential requests use the unscoped endpoint and bearer-only transport without actor overrides', async () => {
  const calls = [];
  const send = async (path, options) => { calls.push({ path, options }); return { ok: true, json: async () => view() }; };
  await requestAccountCredentials(oldToken, undefined, { send });
  await requestAccountCredentials(newToken, { credentialVersion: 1, newToken }, { send });
  assert.ok(calls.every(call => call.path === '/api/v1/me/credentials' && call.options.credentials === 'omit' && call.options.cache === 'no-store'));
  assert.equal(calls[0].options.method, 'GET'); assert.equal(calls[1].options.method, 'PUT');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer ' + newToken);
  assert.deepEqual(JSON.parse(calls[1].options.body), { credentialVersion: 1, newToken });
  assert.equal(Object.hasOwn(calls[1].options.headers, 'Idempotency-Key'), false);
});

class Element {
  constructor() { this.value = ''; this.checked = false; this.disabled = false; this.type = 'password'; this.textContent = ''; this.listeners = {}; this.open = true; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
}
function fixture(request) {
  const nodes = new Map(), byId = name => { if (!nodes.has(name)) nodes.set(name, new Element()); return nodes.get(name); };
  const identity = { actorId: 'account-a', token: oldToken }, rotations = [], errors = [];
  const console = initAccountCredentials({ byId, request, getIdentity: () => identity, confirm: () => true,
    notify: (...value) => errors.push(value), onRotated: async (token, actorId) => { rotations.push({ token, actorId }); identity.token = token; } });
  return { console, identity, rotations, errors, el: name => byId('credential-' + name) };
}

test('a saved new token is required and initial rotation never automatically retries an uncertain write', async () => {
  let calls = 0;
  const f = fixture(async () => { calls++; throw Error('connection interrupted'); });
  f.el('next').value = newToken; await f.console.rotate(); assert.equal(calls, 0);
  f.el('saved').checked = true; await f.console.rotate();
  assert.equal(calls, 1); assert.equal(f.el('next').value, ''); assert.equal(f.el('rotate').disabled, true);
  assert.equal(f.el('verify-new').disabled, false); assert.equal(f.el('read').disabled, true);
  assert.equal(f.identity.token, oldToken); assert.equal(f.rotations.length, 0);
});

test('explicit new-token verification preserves the exact original body and adopts only a matching confirmed response', async () => {
  const calls = [];
  const f = fixture(async (token, input) => {
    calls.push({ token, input: structuredClone(input) });
    if (calls.length === 1) throw Error('response lost');
    return { ...view(), changed: false };
  });
  f.el('next').value = newToken; f.el('saved').checked = true; await f.console.rotate();
  f.el('next').value = 'c'.repeat(64);
  await f.el('verify-new').listeners.click();
  assert.equal(calls.length, 2); assert.equal(calls[0].token, oldToken); assert.equal(calls[1].token, newToken);
  assert.deepEqual(calls[1].input, calls[0].input); assert.equal(calls[1].input.newToken, newToken);
  assert.deepEqual(f.rotations, [{ token: newToken, actorId: 'account-a' }]);
  assert.equal(f.identity.token, newToken); assert.equal(f.el('next').value, '');
  assert.doesNotMatch(f.el('metadata').textContent + f.el('state').textContent, /aaaaaaa|bbbbbbb|ccccccc/);
});

test('new-token refusal after uncertainty retains the original decision instead of guessing rollback or generating another request', async () => {
  let calls = 0;
  const f = fixture(async () => { calls++; if (calls === 1) throw Error('unknown'); const error = Error('not current'); error.httpStatus = 401; throw error; });
  f.el('next').value = newToken; f.el('saved').checked = true; await f.console.rotate();
  await f.el('verify-new').listeners.click();
  assert.equal(calls, 2); assert.equal(f.el('rotate').disabled, true); assert.equal(f.el('replay-old').disabled, false);
  assert.equal(f.rotations.length, 0); assert.equal(f.identity.token, oldToken);
});

test('account reset discards late rotation results and all local credential input', async () => {
  let resolve;
  const f = fixture(() => new Promise(value => { resolve = value; }));
  f.el('next').value = newToken; f.el('saved').checked = true;
  const rotating = f.console.rotate();
  f.identity.actorId = 'account-other'; f.identity.token = 'z'.repeat(64); f.console.clear();
  resolve({ ...view(), changed: true }); await rotating;
  assert.equal(f.rotations.length, 0); assert.equal(f.el('next').value, ''); assert.equal(f.el('metadata').textContent, '');
  assert.equal(f.identity.token, 'z'.repeat(64));
});
