import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initMemberConsole, memberCommand, memberListView, memberReceipt } from '../member-console.js';

const owner = { actorId: 'owner', revision: 1, role: 'owner', active: true };
const member = { actorId: 'member', revision: 3, role: 'manager', active: true };
const token = 'a'.repeat(64);
const receipt = command => ({ actorId: command.actorId, revision: command.body.expectedRevision + 1,
  role: command.body.role, active: command.body.role !== 'removed', operationIds: [], latestAuthorizationUntil: null });

test('member views detach public fields and reject duplicate malformed or excessive rows', () => {
  const input = { members: [{ ...owner, token: 'do-not-export' }, { ...member }] };
  const result = memberListView(input);
  assert.deepEqual(result, [owner, member]);
  input.members[1].role = 'viewer';
  assert.equal(result[1].role, 'manager');
  for (const value of [{}, { members: [owner, owner] }, { members: [{ ...member, revision: 0 }] },
    { members: [{ ...member, role: 'removed' }] }, { members: Array(10001).fill(owner) }])
    assert.throws(() => memberListView(value));
});

test('membership role commands use the loaded revision and never replace existing account credentials', () => {
  const command = memberCommand({ actorId: 'member', role: 'viewer', accountMode: 'existing', token }, [owner, member]);
  assert.deepEqual(command.body, { expectedRevision: 3, role: 'viewer' });
  assert.equal(command.path, 'members/member');
  assert.throws(() => memberCommand({ actorId: 'owner', role: 'removed', accountMode: 'existing' }, [owner]));
  assert.throws(() => memberCommand({ actorId: 'member', role: 'viewer', accountMode: 'new', token, tokenSaved: true }, [member]));
  assert.throws(() => memberCommand({ actorId: 'missing', role: 'removed', accountMode: 'existing' }, []));
});

test('a new account needs an explicitly saved valid initial secret while an existing account join omits it', () => {
  const input = { actorId: 'new-account', role: 'manager', accountMode: 'new', token, tokenSaved: true };
  assert.deepEqual(memberCommand(input, []).body, { expectedRevision: 0, role: 'manager', token });
  assert.deepEqual(memberCommand({ ...input, accountMode: 'existing' }, []).body, { expectedRevision: 0, role: 'manager' });
  assert.throws(() => memberCommand({ ...input, tokenSaved: false }, []));
  assert.throws(() => memberCommand({ ...input, token: 'invalid secret' }, []));
  assert.throws(() => memberCommand({ ...input, role: 'owner' }, []));
});

test('a command response must match its subject role revision and original operation envelope', () => {
  const command = memberCommand({ actorId: 'member', role: 'removed', accountMode: 'existing' }, [member]);
  const value = receipt(command);
  assert.deepEqual(memberReceipt(command, { ...value, token }), value);
  for (const change of [{ actorId: 'other' }, { role: 'viewer' }, { revision: 6 }, { active: true },
    { operationIds: ['not a valid id'] }, { latestAuthorizationUntil: 'not-a-time' }])
    assert.throws(() => memberReceipt(command, { ...value, ...change }));
});

class Element {
  constructor() { this.value = ''; this.checked = false; this.disabled = false; this.hidden = false; this.type = 'password'; this.children = []; this.listeners = {}; this.textContent = ''; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  append(...values) { this.children.push(...values); }
  replaceChildren(...values) { this.children = [...values]; }
  scrollIntoView() {}
  reset() {}
}
function fixture(request, canGovern = () => true) {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new Element() };
  const nodes = new Map(), byId = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  byId('member-account-mode').value = 'existing'; byId('member-role').value = 'viewer';
  const messages = [];
  const console = initMemberConsole({ request, canGovern, byId, notify: (...value) => messages.push(value),
    confirm: () => true, randomUUID: () => 'stable-member-key' });
  return { console, messages, el: name => byId('member-' + name), restore: () => { globalThis.document = previous; } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('governance denial prevents both member disclosure and mutation preparation', async () => {
  let calls = 0;
  const f = fixture(async () => { calls++; return { members: [owner] }; }, () => false);
  try {
    await f.console.read();
    assert.equal(calls, 0);
    assert.equal(f.el('save').disabled, true);
    assert.match(f.messages[0][0], /所有者/);
  } finally { f.restore(); }
});

test('late member reads cannot repopulate a cleared account or workspace', async () => {
  let resolve;
  const f = fixture(() => new Promise(value => { resolve = value; }));
  try {
    const reading = f.console.read();
    f.console.clear();
    resolve({ members: [owner, member] }); await reading;
    assert.equal(f.el('save').disabled, true);
    assert.equal(f.el('state').textContent, '');
    assert.match(f.el('summary').textContent, /尚未读取/);
  } finally { f.restore(); }
});

test('uncertain new-member writes replay the exact initial body and key and keep secrets out of receipts', async () => {
  const writes = [];
  const f = fixture(async (method, path, body, key) => {
    if (method === 'GET') return { members: [owner] };
    writes.push({ method, path, body: structuredClone(body), key });
    if (writes.length === 1) throw Error('connection interrupted');
    return { actorId: 'new-account', revision: 1, role: 'manager', active: true, operationIds: [], latestAuthorizationUntil: null };
  });
  try {
    await f.console.read();
    f.el('actor').value = 'new-account'; f.el('role').value = 'manager'; f.el('account-mode').value = 'new';
    f.el('token').value = token; f.el('token-saved').checked = true;
    f.el('form').listeners.submit({ preventDefault() {} }); await settle();
    assert.equal(f.el('refresh').disabled, true);
    assert.equal(f.el('replay').disabled, false);
    assert.equal(f.el('token').value, '');
    f.el('actor').value = 'edited-after-timeout'; f.el('token').value = 'b'.repeat(64);
    await f.el('replay').listeners.click();
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[1], writes[0]);
    assert.equal(writes[0].key, 'stable-member-key');
    assert.equal(writes[0].body.token, token);
    assert.doesNotMatch(f.el('receipt').textContent, /token|aaaaaaa|bbbbbbb/);
    assert.equal(f.el('token').value, '');
    assert.equal(f.el('save').disabled, true);
  } finally { f.restore(); }
});
