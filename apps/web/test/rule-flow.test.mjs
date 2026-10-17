import test from 'node:test';
import assert from 'node:assert/strict';
import { initRuleConsole } from '../rule-console.js';

class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.listeners = {}; this.checked = false; this.disabled = false; this.textContent = ''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(event, fn) { this.listeners[event] = fn; }
  close() { this.open = false; }
  showModal() { this.open = true; }
}
const item = (id = 'rule-a', enabled = true) => ({ id, revision: 3, recoverySuspended: false,
  spec: { enabled, protocols: ['tcp'], ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 30001 } }, target: { host: '127.0.0.1', port: 80 } } });
const accepted = (resource, input) => ({ forwardId: resource.split('/')[1], revision: input.expectedRevision + 1, operationId: 'operation-' + resource.split('/')[1] });
function harness(handler = async (_, resource, input) => accepted(resource, input), confirm = () => true) {
  const elements = new Map(), calls = [], notices = [];
  let counter = 0, refreshes = 0;
  const byId = name => { if (!elements.has(name)) elements.set(name, new Element()); return elements.get(name); };
  const api = initRuleConsole({ byId, confirm, document: { createElement: tag => new Element(tag) }, newKey: () => 'key-' + ++counter,
    request: async (...args) => { calls.push(args); return handler(...args); }, notify: (...args) => notices.push(args), refresh: async () => { refreshes++; } });
  const el = suffix => byId('rule-' + suffix);
  const select = forward => { const box = api.checkbox(forward); box.checked = true; box.listeners.change(); return box; };
  const consent = () => { el('command-consent').checked = true; el('command-consent').listeners.change(); };
  const send = () => el('command-start').listeners.click();
  return { api, calls, notices, select, el, consent, send, refreshes: () => refreshes };
}
function find(element, tag) { return element.children.flatMap(child => [child, ...find(child, tag)]).filter(child => child.tag === tag); }
const states = h => h.el('command-rows').children.map(row => row.children[1].textContent);
const replay = h => find(h.el('command-rows'), 'button')[0];

test('batch selection is bounded to 10 current-page detached configurations and preview sends nothing', async () => {
  const h = harness(), original = item(); h.select(original); original.spec.target.port = 99;
  for (let i = 0; i < 9; i++) h.select(item('rule-' + i));
  const excess = h.select(item('too-many')); assert.equal(excess.checked, false); assert.equal(h.calls.length, 0);
  h.api.batch(false); assert.equal(h.el('command-dialog').open, true);
  assert.equal(h.el('command-rows').children.length, 10); assert.equal(h.calls.length, 0);
  assert.equal(h.el('command-start').disabled, true); await h.send(); assert.equal(h.calls.length, 0);
  h.consent(); await h.send(); assert.equal(h.calls.length, 10);
  assert.equal(h.calls[0][2].spec.target.port, 80); assert.equal(h.calls[0][2].spec.enabled, false);
  assert.equal(h.calls[0][2].expectedRevision, 3); assert.equal(new Set(h.calls.map(call => call[3])).size, 10);
  assert.ok(h.calls.every(call => call[4].timeoutMs === 5000));
  assert.deepEqual(states(h), Array(10).fill('accepted')); assert.equal(h.refreshes(), 1);
});

test('page changes clear selection rather than silently accumulating a scope-wide batch', () => {
  const h = harness(), box = h.select(item()); h.api.page();
  assert.equal(box.checked, false); assert.equal(h.el('batch-enable').disabled, true);
  h.api.batch(true); assert.equal(h.el('command-dialog').open, undefined); assert.equal(h.calls.length, 0);
});

test('recovery-suspended rows are not selected and repeated preview/cancel keeps the current checkbox state consistent', () => {
  const h = harness();
  const suspended = h.select({ ...item('suspended'), recoverySuspended: true });
  assert.equal(suspended.disabled, true); assert.equal(suspended.checked, false);
  const box = h.select(item()); h.api.batch(false); assert.equal(box.checked, false);
  h.el('command-close').listeners.click();
  box.checked = true; box.listeners.change(); h.api.batch(true);
  assert.equal(box.checked, false); assert.equal(h.el('selection').textContent, '0 / 10 selected on this page');
});

test('definite CAS rejection is retained per rule while independent later rules continue', async () => {
  const h = harness(async (_, resource, input) => {
    if (resource.endsWith('rule-a')) throw Object.assign(Error('REVISION_CONFLICT'), { httpStatus: 409 });
    return accepted(resource, input);
  });
  h.select(item()); h.select(item('rule-b')); h.api.batch(false); h.consent(); await h.send();
  assert.deepEqual(states(h), ['rejected', 'accepted']); assert.equal(h.calls.length, 2);
  assert.equal(replay(h), undefined); assert.equal(h.el('command-start').disabled, true);
  assert.match(h.el('command-state').textContent, /not applied or healthy/);
});

test('uncertain committed response stops the tail and only explicit same-key same-body replay can resolve it', async () => {
  let first = true;
  const h = harness(async (_, resource, input) => { if (first) { first = false; throw Error('Lost response'); } return accepted(resource, input); });
  h.select(item()); h.select(item('rule-b')); h.api.batch(false); h.consent(); await h.send();
  assert.deepEqual(states(h), ['uncertain', 'pending']); assert.equal(h.calls.length, 1);
  assert.equal(h.el('command-start').disabled, true); assert.equal(replay(h).disabled, true);
  h.consent(); assert.equal(h.el('command-start').disabled, true); await replay(h).listeners.click();
  assert.deepEqual(states(h), ['accepted', 'pending']); assert.equal(h.calls.length, 2, 'Replay must not auto-send the tail');
  assert.deepEqual(h.calls[0].slice(0, 4), h.calls[1].slice(0, 4));
  assert.equal(h.el('command-start').disabled, true, 'Continuing the tail requires fresh consent');
  h.consent(); await h.send(); assert.deepEqual(states(h), ['accepted', 'accepted']);
  assert.notEqual(h.calls[0][3], h.calls[2][3]);
});

test('server errors and malformed acceptances remain uncertain and never turn into replacement commands', async () => {
  for (const mode of ['503', 'bad-body', 'wrong-id', 'wrong-revision']) {
    const h = harness(async (_, resource, input) => {
      if (mode === '503') throw Object.assign(Error('INTERNAL_ERROR'), { httpStatus: 503 });
      if (mode === 'bad-body') return null;
      return { ...accepted(resource, input), ...(mode === 'wrong-id' ? { forwardId: 'another' } : { revision: 9 }) };
    });
    h.select(item()); h.api.batch(false); h.consent(); await h.send();
    assert.deepEqual(states(h), ['uncertain']); assert.equal(h.calls.length, 1);
  }
});

test('no-op accepts current revision without inventing an Operation or new desired revision', async () => {
  const h = harness(async (_, resource, input) => ({ forwardId: resource.split('/')[1], revision: input.expectedRevision, operationId: null }));
  h.select(item('rule-a', false)); h.api.batch(false); h.consent(); await h.send();
  assert.deepEqual(states(h), ['unchanged']); assert.match(h.el('command-rows').children[0].children[2].textContent, /"operationId":null/);
});

test('batch requests are serial, cannot double-submit, and stop aborts current without sending the tail', async () => {
  let release;
  const h = harness((_, resource, input) => new Promise(resolve => { release = () => resolve(accepted(resource, input)); }));
  h.select(item()); h.select(item('rule-b')); h.api.batch(false); h.consent(); const pending = h.send();
  await h.send(); assert.equal(h.calls.length, 1); assert.deepEqual(states(h), ['sending', 'pending']);
  h.el('command-stop').listeners.click(); assert.equal(h.calls[0][4].signal.aborted, true);
  release(); await pending; assert.deepEqual(states(h), ['uncertain', 'pending']); assert.equal(h.calls.length, 1);
});

test('disconnect clears local commands and discards late acceptance and refresh work', async () => {
  let release;
  const h = harness((_, resource, input) => new Promise(resolve => { release = () => resolve(accepted(resource, input)); }));
  h.select(item()); h.api.batch(false); h.consent(); const pending = h.send();
  h.api.clear(); assert.equal(h.calls[0][4].signal.aborted, true); release(); await pending;
  assert.equal(h.el('command-dialog').open, false); assert.equal(h.el('command-rows').children.length, 0); assert.equal(h.refreshes(), 0);
});

test('unresolved discard requires acknowledgement and never sends remote cancellation or rollback', async () => {
  let allow = false;
  const h = harness(async () => { throw Error('unknown'); }, () => allow);
  h.select(item()); h.api.batch(false); h.consent(); await h.send();
  h.el('command-close').listeners.click(); assert.equal(h.el('command-dialog').open, true);
  allow = true; h.el('command-close').listeners.click(); assert.equal(h.el('command-dialog').open, false); assert.equal(h.calls.length, 1);
});

test('retry requires fresh current failed Operation, exact desired revision and latest-source identity', async () => {
  for (const failure of ['', 'succeeded', 'recovered', 'revision', 'latest', 'suspended']) {
    const h = harness(async (method, resource, input) => {
      if (resource === 'operations/source-a') return { id: 'source-a', forwardId: 'rule-a', targetRevision: 3, status: failure === 'succeeded' ? 'succeeded' : 'failed', recoveryInvalidated: failure === 'recovered' };
      if (resource === 'forwards/rule-a' && method === 'GET') return { desired: { revision: failure === 'revision' ? 4 : 3, recoverySuspended: failure === 'suspended', deleting: false }, lastOperation: { id: failure === 'latest' ? 'newer' : 'source-a' } };
      return { forwardId: 'rule-a', revision: input.expectedRevision, operationId: 'retry-a', sourceOperationId: 'source-a' };
    });
    await h.api.retry('source-a'); assert.ok(h.calls.every(call => call[0] === 'GET'));
    if (failure) { assert.equal(h.el('command-dialog').open, false); continue; }
    h.consent(); await h.send(); assert.deepEqual(h.calls.at(-1).slice(0, 3), ['POST', 'operations/source-a/retry', { expectedRevision: 3 }]);
    assert.deepEqual(states(h), ['accepted']);
  }
});

test('late retry reads cannot reopen a dialog after connection changes', async () => {
  let release;
  const h = harness(() => new Promise(resolve => { release = resolve; }));
  const pending = h.api.retry('source-a'); h.api.clear();
  release({ id: 'source-a', forwardId: 'rule-a', targetRevision: 3, status: 'failed', recoveryInvalidated: false }); await pending;
  assert.equal(h.calls.length, 1); assert.equal(h.el('command-dialog').open, false);
});
