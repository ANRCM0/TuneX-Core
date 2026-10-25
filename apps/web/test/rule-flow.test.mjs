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
const states = h => h.el('command-rows').children.map(row => row.children[1]['data-state']);
const resultDetails = (h, index = 0) => find(h.el('command-rows').children[index].children[2], 'pre')[0].textContent;
const replay = h => find(h.el('command-rows'), 'button')[0];

test('page selection fills ten slots in list order, skips suspended rules and preserves original proposals', async () => {
  const h = harness();
  const suspended = h.api.checkbox({ ...item('suspended'), recoverySuspended: true });
  const records = Array.from({ length: 12 }, (_, index) => item('rule-' + index));
  const boxes = records.map(record => h.api.checkbox(record));
  boxes[11].checked = true; boxes[11].listeners.change();
  h.el('select-page').listeners.click();
  assert.equal(suspended.checked, false);
  assert.deepEqual(boxes.map((box, index) => box.checked ? index : null).filter(index => index !== null), [0,1,2,3,4,5,6,7,8,11]);
  assert.equal(h.el('select-page').disabled, true);
  assert.match(h.el('selection').textContent, /已选 10 \/ 10 条 · 本页可选 12 条，恢复暂停 1 条暂不可选/);
  assert.equal(h.calls.length, 0, 'selection cannot issue a request');
  records[0].spec.target.port = 999;
  h.api.batch(false);
  assert.equal(h.el('command-title').textContent, '批量停用转发');
  assert.equal(h.el('command-start').textContent, '确认并提交这 10 条');
  assert.equal(h.calls.length, 0, 'preview cannot issue a request');
  h.consent(); await h.send();
  assert.equal(h.calls.length, 10);
  assert.equal(h.calls[0][1], 'forwards/rule-11');
  assert.equal(h.calls[1][2].spec.target.port, 80, 'selection uses the original detached proposal');
});

test('clear selection retains current-page choices while a page change drops every old choice', () => {
  const h = harness(), old = h.api.checkbox(item());
  h.el('select-page').listeners.click();
  h.el('clear-selection').listeners.click();
  assert.equal(old.checked, false); assert.equal(h.el('batch-enable').disabled, true);
  assert.equal(h.el('clear-selection').disabled, true); assert.equal(h.el('select-page').disabled, false);
  h.el('select-page').listeners.click(); assert.equal(old.checked, true);
  h.api.page(); assert.equal(old.checked, false); assert.equal(h.el('select-page').disabled, true);
  const next = h.api.checkbox(item('next-page'));
  h.el('select-page').listeners.click(); assert.equal(next.checked, true); assert.equal(old.checked, false);
  h.api.batch(true); assert.equal(h.el('command-rows').children.length, 1);
  assert.match(h.el('command-rows').children[0].children[0].textContent, /next-page/);
  assert.equal(h.calls.length, 0);
});

test('active dispatch disables selection and ignores stale page-selection events', async () => {
  let finish;
  const h = harness((_, resource, input) => new Promise(resolve => { finish = () => resolve(accepted(resource, input)); }));
  h.select(item()); h.api.batch(false);
  const later = h.api.checkbox(item('later'));
  h.consent(); const pending = h.send();
  assert.equal(later.disabled, true); assert.equal(h.el('select-page').disabled, true);
  assert.equal(h.el('clear-selection').disabled, true);
  h.el('select-page').listeners.click(); h.el('clear-selection').listeners.click();
  assert.equal(later.checked, false); assert.equal(h.calls.length, 1);
  finish(); await pending;
  assert.equal(later.disabled, false); assert.equal(h.el('select-page').disabled, false);
  assert.equal(h.calls.length, 1);
});

test('Chinese progress explains uncertainty and preserves original request details until explicit replay', async () => {
  let first = true;
  const h = harness(async (_, resource, input) => { if (first) { first = false; throw Error('Lost response'); } return accepted(resource, input); });
  h.select(item()); h.select(item('rule-b')); h.api.batch(false); h.consent(); await h.send();
  const row = h.el('command-rows').children[0];
  assert.equal(row.children[1].textContent, '提交结果未知');
  assert.match(row.children[2].children[0].textContent, /可能已经提交/);
  assert.match(h.el('command-state').textContent, /待提交 1 条 · 提交结果未知 1 条/);
  assert.match(resultDetails(h), /Lost response/); assert.equal(replay(h).textContent, '重试原请求');
  assert.equal(replay(h).disabled, true); h.consent(); await replay(h).listeners.click();
  assert.deepEqual(h.calls[0].slice(0,4), h.calls[1].slice(0,4));
  assert.deepEqual(states(h), ['accepted', 'pending']);
  assert.equal(h.el('command-start').textContent, '继续提交剩余 1 条');
  assert.match(h.el('command-rows').children[0].children[2].children[0].textContent, /执行记录/);
  assert.equal(JSON.parse(resultDetails(h)).operationId, 'operation-rule-a');
});

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
  assert.equal(box.checked, false); assert.equal(h.el('selection').textContent, '已选 0 / 10 条 · 本页可选 1 条，恢复暂停 1 条暂不可选');
});

test('definite CAS rejection is retained per rule while independent later rules continue', async () => {
  const h = harness(async (_, resource, input) => {
    if (resource.endsWith('rule-a')) throw Object.assign(Error('REVISION_CONFLICT'), { httpStatus: 409 });
    return accepted(resource, input);
  });
  h.select(item()); h.select(item('rule-b')); h.api.batch(false); h.consent(); await h.send();
  assert.deepEqual(states(h), ['rejected', 'accepted']); assert.equal(h.calls.length, 2);
  assert.equal(replay(h), undefined); assert.equal(h.el('command-start').disabled, true);
  assert.match(h.el('command-state').textContent, /已接收不代表部署完成或业务可用/);
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
  assert.deepEqual(states(h), ['unchanged']); assert.equal(JSON.parse(resultDetails(h)).operationId, null);
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
  assert.match(resultDetails(h), /No intent sent/);
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
    assert.equal(replay(h).textContent, '重新检查原方案'); assert.equal(replay(h).disabled, true);
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
    else { assert.deepEqual(states(h), ['preflight-failed', 'pending']); assert.match(resultDetails(h), /No intent sent/); }
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
    assert.match(resultDetails(h), /Original outcome remains unknown/);
  }
});

function pathProposal(count=2){
  return {templateId:'saved',targetRevision:2,configDigest:'sha256:'+'c'.repeat(64),profileDigest,
    config:{version:1,nodes:['node-a','node-b'],protocols:['tcp'],endpoints:[{nodeId:'node-b',revision:1}],transport:{profileId:'p1',configRevision:2}},
    items:profileProposal(count).items.map(row=>{
      const spec={...row.spec,path:{via:['middle','node-b']}};
      return {forwardId:row.forwardId,expectedRevision:row.expectedRevision,recoverySuspended:false,unavailableReason:null,changed:true,
        binding:{templateId:'saved',revision:1,configDigest:'sha256:'+'b'.repeat(64)},spec,
        proposedSpec:{...structuredClone(spec),path:{via:['node-b']},transport:{profileId:'p1',configRevision:2}}};
    })};
}
function pathReply(proposal,method,resource,input){
  if(resource==='relay-plan')return freshProfilePlan();
  const row=proposal.items.find(row=>row.forwardId===resource.split('/')[1]);assert.ok(row);
  const changed=JSON.stringify(row.spec)!==JSON.stringify(row.proposedSpec),target={templateId:proposal.templateId,revision:proposal.targetRevision,configDigest:proposal.configDigest};
  if(resource.endsWith('/path-preview'))return {forwardId:row.forwardId,expectedRevision:row.expectedRevision,template:target,spec:structuredClone(row.spec),
    proposedSpec:structuredClone(row.proposedSpec),changed,previewOnly:true,reserved:false,executionAuthorized:false,fullPlanAuthorization:false};
  assert.equal(method,'PUT');assert.ok(resource.endsWith('/path-binding'));assert.deepEqual(input,{expectedRevision:row.expectedRevision,template:target});
  return {forwardId:row.forwardId,revision:row.expectedRevision+(changed?1:0),operationId:changed?'operation-'+row.forwardId:null,
    pathBinding:{...target,sequence:2,forwardRevision:row.expectedRevision+(changed?1:0),changed:true}};
}

test('ten exact path commands freeze source/target/CAS and use serial proposal + Relay plan + original binding, never ordinary PUT or a bulk API',async()=>{
  const original=pathProposal(10),fixed=structuredClone(original),h=harness((...args)=>pathReply(fixed,...args));
  assert.equal(h.api.pathBatch(original),true);original.targetRevision=9;original.items[0].proposedSpec.target.port=1;original.config.nodes.reverse();
  assert.equal(h.calls.length,0);await h.send();assert.equal(h.calls.length,0);h.consent();await h.send();
  assert.deepEqual(states(h),Array(10).fill('accepted'));assert.equal(h.calls.length,30);
  for(let index=0;index<10;index++){
    const [preview,plan,put]=h.calls.slice(index*3,index*3+3);
    assert.deepEqual(preview.slice(0,2),['POST','forwards/rule-'+index+'/path-preview']);assert.equal(plan[1],'relay-plan');
    assert.deepEqual(plan[2],fixed.items[index].proposedSpec);assert.equal(put[1],'forwards/rule-'+index+'/path-binding');
    assert.deepEqual(preview[2],put[2]);assert.equal(put[3],'key-'+(index+1));assert.equal(Object.hasOwn(put[2],'spec'),false);
    assert.equal(JSON.parse(resultDetails(h,index)).pathBinding.revision,2);
  }
  assert.ok(h.calls.every(call=>call[4].timeoutMs===5000));
});

test('path batch rejects mixed/unavailable/duplicate targets and any expansion changing listener, target, enabled or protocols',()=>{
  const mutations=[p=>{p.items=[];},p=>{p.items.push(p.items[0]);},p=>{p.targetRevision=65;},p=>{p.profileDigest='unknown';},p=>{p.config.nodes.push('node-a');},
    p=>{p.items[0].changed=false;},p=>{p.items[0].recoverySuspended=true;},p=>{p.items[0].unavailableReason='TEMPLATE_ARCHIVED';},p=>{p.items[0].binding.templateId='other';},
    p=>{p.items[0].proposedSpec.target.port=99;},p=>{p.items[0].proposedSpec.ingress={...p.items[0].spec.ingress,listen:{port:99}};},
    p=>{p.items[0].proposedSpec.enabled=false;},p=>{p.items[0].proposedSpec.protocols=['udp'];},p=>{p.items[0].spec.ingress.nodeId='other';},
    p=>{p.items[0].proposedSpec.path.via=['other'];},p=>{p.items[0].proposedSpec.transport.configRevision=3;}];
  for(const mutate of mutations){const h=harness(),p=pathProposal();mutate(p);assert.equal(h.api.pathBatch(p),false);assert.equal(h.calls.length,0);}
  assert.equal(harness().api.pathBatch(pathProposal(11)),false);
});

test('new path provenance with equivalent expansion returns unchanged spec and retains the original no-Operation receipt',async()=>{
  const p=pathProposal(1);p.items[0].spec=structuredClone(p.items[0].proposedSpec);
  const h=harness((...args)=>pathReply(p,...args));assert.equal(h.api.pathBatch(p),true);h.consent();await h.send();
  assert.deepEqual(states(h),['unchanged']);assert.equal(h.calls.length,3);
  const receipt=JSON.parse(resultDetails(h));assert.equal(receipt.revision,3);assert.equal(receipt.operationId,null);assert.equal(receipt.pathBinding.changed,true);
});

test('stale CAS or withdrawn authority rejects one fresh path proposal without a binding write and permits independent later rows',async()=>{
  for(const status of [403,409,429]){
    const p=pathProposal(),h=harness((method,resource,...args)=>{if(resource==='forwards/rule-0/path-preview')throw Object.assign(Error('Original reference or CAS denied'),{httpStatus:status});return pathReply(p,method,resource,...args);});
    h.api.pathBatch(p);h.consent();await h.send();assert.deepEqual(states(h),['rejected','accepted']);assert.equal(h.calls.length,4);
    assert.equal(h.calls.filter(call=>call[1]==='forwards/rule-0/path-binding').length,0);
  }
});

test('unknown or mismatched path proposals stop before Relay planning/writing and need explicit same-proposal recheck without changing keys',async()=>{
  for(const mode of ['network','source','proposed','selection','flags','changed']){
    const p=pathProposal();let first=true;
    const h=harness((...args)=>{const value=pathReply(p,...args);if(!args[1].endsWith('/path-preview')||!first)return value;first=false;
      if(mode==='network')throw Error('Unknown read-only proposal');if(mode==='source')value.spec.target.port=99;
      if(mode==='proposed')value.proposedSpec.enabled=false;if(mode==='selection')value.template.revision=3;
      if(mode==='flags')value.reserved=true;if(mode==='changed')value.changed=false;return value;});
    h.api.pathBatch(p);h.consent();await h.send();assert.deepEqual(states(h),['preflight-failed','pending']);assert.equal(h.calls.length,1);
    h.consent();await replay(h).listeners.click();assert.deepEqual(states(h),['accepted','pending']);assert.equal(h.calls.length,4);assert.equal(h.calls.at(-1)[3],'key-1');
    assert.equal(h.el('command-start').disabled,true);
  }
});

test('unknown Relay plan after a valid path proposal still writes nothing and a recheck repeats both frozen reads',async()=>{
  const p=pathProposal();let fail=true;
  const h=harness((...args)=>{if(args[1]==='relay-plan'&&fail){fail=false;throw Error('Plan lost');}return pathReply(p,...args);});
  h.api.pathBatch(p);h.consent();await h.send();assert.equal(h.calls.length,2);assert.deepEqual(states(h),['preflight-failed','pending']);
  h.consent();await replay(h).listeners.click();assert.deepEqual(h.calls.map(call=>call[1]),['forwards/rule-0/path-preview','relay-plan','forwards/rule-0/path-preview','relay-plan','forwards/rule-0/path-binding']);
});

test('lost path write and current replay denial keep uncertainty; only the exact original binding request replays without either preview',async()=>{
  const p=pathProposal();let writes=0;
  const h=harness((...args)=>{if(args[0]==='PUT'){writes++;if(writes===1)throw Error('Committed response lost');if(writes===2)throw Object.assign(Error('Current scope denied'),{httpStatus:403});}return pathReply(p,...args);});
  h.api.pathBatch(p);h.consent();await h.send();assert.deepEqual(states(h),['uncertain','pending']);
  h.consent();await replay(h).listeners.click();assert.deepEqual(states(h),['uncertain','pending']);h.consent();await replay(h).listeners.click();
  assert.deepEqual(states(h),['accepted','pending']);assert.equal(h.calls.length,5);for(const call of h.calls.slice(3))assert.deepEqual(call.slice(0,4),h.calls[2].slice(0,4));
  assert.equal(h.el('command-start').disabled,true);h.consent();await h.send();assert.deepEqual(states(h),['accepted','accepted']);assert.equal(h.calls.at(-1)[3],'key-2');
});

test('malformed path binding receipts, wrong target or unexpected Operation stay uncertain rather than becoming a substitute update',async()=>{
  for(const mutate of [r=>{delete r.pathBinding;},r=>{r.pathBinding.sequence=65;},r=>{r.pathBinding.revision=3;},r=>{r.pathBinding.configDigest='unknown';},
    r=>{r.pathBinding.forwardRevision=99;},r=>{r.revision=3;r.operationId=null;}]){
    const p=pathProposal(1),h=harness((...args)=>{const value=pathReply(p,...args);if(args[0]==='PUT')mutate(value);return value;});
    h.api.pathBatch(p);h.consent();await h.send();assert.deepEqual(states(h),['uncertain']);assert.equal(h.calls.length,3);
  }
});

test('stop/disconnect during either path preflight cannot dispatch late writes; stop during binding retains uncertainty and blocks tail',async()=>{
  for(const phase of ['forwards/rule-0/path-preview','relay-plan','forwards/rule-0/path-binding'])for(const disconnect of [false,true]){
    const p=pathProposal();let release;
    const h=harness((...args)=>args[1]===phase?new Promise(resolve=>{release=()=>resolve(pathReply(p,...args));}):pathReply(p,...args));
    h.api.pathBatch(p);h.consent();const sending=h.send();while(!release)await new Promise(resolve=>setImmediate(resolve));
    if(disconnect)h.api.clear();else h.el('command-stop').listeners.click();const count=h.calls.length;
    assert.equal(h.calls.at(-1)[4].signal.aborted,true);release();await sending;assert.equal(h.calls.length,count);
    if(disconnect)assert.equal(h.el('command-dialog').open,false);else assert.deepEqual(states(h),[phase.endsWith('/path-binding')?'uncertain':'preflight-failed','pending']);
  }
});
