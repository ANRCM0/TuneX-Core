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

const profileDigest = 'sha256:' + 'a'.repeat(64);
function profileProposal(count = 2) {
  return { profileId: 'p1', targetRevision: 2, configDigest: profileDigest, items: Array.from({ length: count }, (_, index) => {
    const original = { ...item('rule-' + index, index % 2 === 0).spec, target: { host: '127.0.0.1', port: 80 + index }, path: { via: ['node-b'] }, transport: { profileId: 'p1', configRevision: 1 } };
    return { forwardId: 'rule-' + index, revision: 3, expectedRevision: 3, configRevision: 1, changed: true, recoverySuspended: false, spec: original,
      proposedSpec: { ...original, transport: { profileId: 'p1', configRevision: 2 } } };
  }) };
}
const freshProfilePlan = () => ({ reserved: false, executionSupported: false, runtimeEnabled: true, profile: { profileId: 'p1', revision: 2, configDigest: profileDigest } });

test('Profile batch freezes at most ten independent CAS proposals, preserves enabled/path/target and checks each before its first write', async () => {
  const h = harness(async (_, resource, input) => resource === 'relay-plan' ? freshProfilePlan() : accepted(resource, input));
  const proposal = profileProposal(10); assert.equal(h.api.profileBatch(proposal), true);
  proposal.items[0].proposedSpec.target.port = 999; proposal.items[0].spec.target.port = 999; proposal.targetRevision = 99;
  assert.equal(h.calls.length, 0); assert.equal(h.el('command-start').disabled, true);
  h.consent(); await h.send(); assert.equal(h.calls.length, 20); assert.deepEqual(states(h), Array(10).fill('accepted'));
  for (let index = 0; index < 10; index++) {
    const [check, put] = h.calls.slice(index * 2, index * 2 + 2);
    assert.deepEqual(check.slice(0, 2), ['POST', 'relay-plan']); assert.equal(check[3], undefined);
    assert.deepEqual(put.slice(0, 2), ['PUT', 'forwards/rule-' + index]); assert.equal(put[2].expectedRevision, 3);
    assert.deepEqual(check[2], put[2].spec); assert.equal(check[2].transport.configRevision, 2);
    assert.equal(check[2].target.port, 80 + index); assert.equal(check[2].enabled, index % 2 === 0);
    assert.deepEqual(check[2].path.via, ['node-b']); assert.equal(check[4].timeoutMs, 5000); assert.equal(put[4].timeoutMs, 5000);
  }
  assert.equal(new Set(h.calls.filter(call => call[0] === 'PUT').map(call => call[3])).size, 10);
});

test('invalid/mixed/recovered Profile impacts cannot prepare commands or smuggle target/path/enabled changes', () => {
  const patches = [p => { p.items = []; }, p => { p.items.push(p.items[0]); }, p => { p.configDigest = 'unknown'; },
    p => { p.items[0].recoverySuspended = true; }, p => { p.items[0].changed = false; }, p => { p.items[0].expectedRevision = 4; },
    p => { p.items[0].proposedSpec.target = { host: 'different.invalid', port: 80 }; }, p => { p.items[0].proposedSpec.enabled = false; },
    p => { p.items[0].proposedSpec.path = { via: ['foreign'] }; }, p => { p.items[0].spec.transport.profileId = 'another'; }];
  for (const patch of patches) { const h = harness(), proposal = profileProposal(); patch(proposal); assert.equal(h.api.profileBatch(proposal), false); assert.equal(h.calls.length, 0); }
  assert.equal(harness().api.profileBatch(profileProposal(11)), false);
});

test('fresh plan authorization rejection sends no intent for that row but independent later rows can still publish', async () => {
  const h = harness(async (_, resource, input) => {
    if (resource === 'relay-plan') { if (input.target.port === 80) throw Object.assign(Error('Profile or Node grant withdrawn'), { httpStatus: 403 }); return freshProfilePlan(); }
    return accepted(resource, input);
  });
  h.api.profileBatch(profileProposal()); h.consent(); await h.send();
  assert.deepEqual(states(h), ['rejected', 'accepted']); assert.equal(h.calls.length, 3);
  assert.deepEqual(h.calls.map(call => call[1]), ['relay-plan', 'relay-plan', 'forwards/rule-1']);
  assert.match(h.el('command-rows').children[0].children[2].textContent, /No intent sent/);
});

test('fresh preview is not a CAS lease: a changed rule rejects independently after its successful check', async () => {
  const h = harness(async (_, resource, input) => {
    if (resource === 'relay-plan') return freshProfilePlan();
    if (resource.endsWith('rule-0')) throw Object.assign(Error('REVISION_CONFLICT'), { httpStatus: 409 });
    return accepted(resource, input);
  });
  h.api.profileBatch(profileProposal()); h.consent(); await h.send();
  assert.deepEqual(states(h), ['rejected', 'accepted']); assert.equal(h.calls.length, 4);
  assert.equal(h.calls[1][2].expectedRevision, 3); assert.equal(h.calls[3][2].expectedRevision, 3);
});

test('unknown, disabled or mismatched preflight stops unsent tail and needs explicit same-proposal recheck, never write replay', async () => {
  for (const mode of ['network', 'revision', 'digest', 'disabled', 'reserved']) {
    let first = true;
    const h = harness(async (_, resource, input) => {
      if (resource !== 'relay-plan') return accepted(resource, input);
      if (!first) return freshProfilePlan(); first = false;
      if (mode === 'network') throw Error('Lost read-only plan response');
      const result = freshProfilePlan();
      if (mode === 'revision') result.profile.revision = 3;
      if (mode === 'digest') result.profile.configDigest = 'sha256:' + 'b'.repeat(64);
      if (mode === 'disabled') result.runtimeEnabled = false;
      if (mode === 'reserved') result.reserved = true;
      return result;
    });
    h.api.profileBatch(profileProposal()); h.consent(); await h.send();
    assert.deepEqual(states(h), ['preflight-failed', 'pending']); assert.equal(h.calls.length, 1);
    assert.equal(replay(h).textContent, 'Recheck Same Proposal'); assert.equal(replay(h).disabled, true);
    h.consent(); await replay(h).listeners.click(); assert.deepEqual(states(h), ['accepted', 'pending']); assert.equal(h.calls.length, 3);
    assert.equal(h.calls[1][1], 'relay-plan'); assert.equal(h.calls[2][3], 'key-1');
    assert.equal(h.el('command-start').disabled, true, 'Tail requires another consent');
  }
});

test('stop or disconnect during Profile check cannot send an intent after the late read completes', async () => {
  for (const disconnect of [false, true]) {
    let finish;
    const h = harness(() => new Promise(resolve => { finish = () => resolve(freshProfilePlan()); }));
    h.api.profileBatch(profileProposal()); h.consent(); const pending = h.send();
    assert.deepEqual(states(h), ['checking', 'pending']);
    if (disconnect) h.api.clear(); else h.el('command-stop').listeners.click();
    assert.equal(h.calls[0][4].signal.aborted, true); finish(); await pending; assert.equal(h.calls.length, 1);
    if (disconnect) { assert.equal(h.el('command-dialog').open, false); assert.equal(h.refreshes(), 0); }
    else { assert.deepEqual(states(h), ['preflight-failed', 'pending']); assert.match(h.el('command-rows').children[0].children[2].textContent, /No intent sent/); }
  }
});

test('unknown Profile write replays only the original key/body without another plan or automatic tail', async () => {
  let lost = true;
  const h = harness(async (_, resource, input) => {
    if (resource === 'relay-plan') return freshProfilePlan();
    if (lost) { lost = false; throw Error('Commit succeeded but response lost'); }
    return accepted(resource, input);
  });
  h.api.profileBatch(profileProposal()); h.consent(); await h.send(); assert.deepEqual(states(h), ['uncertain', 'pending']); assert.equal(h.calls.length, 2);
  h.consent(); await replay(h).listeners.click(); assert.equal(h.calls.length, 3);
  assert.deepEqual(h.calls[1].slice(0, 4), h.calls[2].slice(0, 4)); assert.deepEqual(states(h), ['accepted', 'pending']);
  assert.equal(h.calls.filter(call => call[1] === 'relay-plan').length, 1); assert.equal(h.el('command-start').disabled, true);
});

test('a rejected replay cannot erase uncertainty about the original committed-or-not command', async () => {
  for (const profile of [false, true]) {
    let first = true;
    const h = harness(async (_, resource) => {
      if (resource === 'relay-plan') return freshProfilePlan();
      if (first) { first = false; throw Error('Original outcome unknown'); }
      throw Object.assign(Error('Current authorization no longer allows replay'), { httpStatus: 403 });
    });
    if (profile) h.api.profileBatch(profileProposal()); else { h.select(item()); h.select(item('tail')); h.api.batch(false); }
    h.consent(); await h.send(); h.consent(); await replay(h).listeners.click();
    assert.deepEqual(states(h), ['uncertain', 'pending']); assert.equal(h.el('command-start').disabled, true);
    assert.match(h.el('command-rows').children[0].children[2].textContent, /Original outcome remains unknown/);
  }
});
