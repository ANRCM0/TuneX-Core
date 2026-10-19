import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { initProbeRuns } from '../probe-runs.js';

const now = Date.parse('2026-10-19T12:00:00.000Z'), issued = now - 10000;
const limits = { retentionMs: 604800000, maxRunsPerScope: 1024, pruneBatch: 16,
  defaultPageSize: 25, maxPageSize: 50, maxRecordBytes: 4096, maxResponseBytes: 262144 };
const hash = 'sha256:' + 'a'.repeat(64);
const keys = ['probeId','scopeId','actorId','binding','instanceId','instanceGeneration','timeoutMs','issuedAt','expiresAt',
  'state','closedAt','revision','updatedAt','withdrawnAt','result','recoverySuspended'];
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value !== null && typeof value === 'object' ?
  '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const digest = value => 'sha256:' + createHash('sha256').update(canonical(value)).digest('hex');
function seal(run, invocation = true) {
  if (run.echoChallenge && invocation) run.echoChallenge.invocationDigest = digest({
    domain: 'tunex.probe.echo.invocation.v1', probeVersion: 4, measurement: run.measurement, permitId: run.probeId,
    binding: run.binding, instanceId: run.instanceId, instanceGeneration: run.instanceGeneration, timeoutMs: run.timeoutMs,
    issuedAt: new Date(run.issuedAt).toISOString(), expiresAt: new Date(run.expiresAt).toISOString(), service: run.service, nonce: run.echoChallenge.nonce,
  });
  const stored = Object.fromEntries(keys.map(key => [key, run[key]]));
  for (const key of ['measurement','service','echoChallenge']) if (Object.hasOwn(run, key)) stored[key] = run[key];
  run.contentDigest = digest(stored); return run;
}
function run(protocol = 'tcp', legacy = false) {
  const value = { probeId: 'probe-a', scopeId: 'scope-a', actorId: 'actor-a',
    binding: { nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 1, snapshotGeneration: 1, assignmentId: 'assignment-a',
      forwardId: 'forward-a', forwardRevision: 1, deploymentGeneration: 1, bindingFence: 1, configDigest: hash, egressPolicyRevision: 1 },
    instanceId: 'b'.repeat(64), instanceGeneration: 1, timeoutMs: 500, issuedAt: issued, expiresAt: issued + 2000,
    state: 'consumed', closedAt: issued + 10, revision: 2, updatedAt: issued + 30, withdrawnAt: null, recoverySuspended: false,
    result: { status: 'connected', code: 'tcp-connected', elapsedMs: 10, measuredAt: issued + 20, validUntil: issued + 1000,
      acceptedAt: issued + 30, resultDigest: hash },
    kind: 'tcp-connect', businessProtocol: 'tcp', point: 'agent-direct-egress', independentProbe: false, applicationPayloadBytes: 0,
    health: 'unknown', executionAuthorized: false, historical: true, permitExpired: true, resultExpired: true,
    resultSource: 'agent-reported', bindingMatchCurrent: 'not-evaluated', resultDigestVerification: 'captured-from-original-owner-not-recomputed' };
  if (!legacy) Object.assign(value, { measurement: protocol + '-ingress-echo-v1', kind: protocol + '-ingress-echo', businessProtocol: protocol,
    point: 'agent-local-direct-ingress', applicationPayloadBytes: 512,
    service: { scopeId: 'scope-a', serviceId: 'service-a', revision: 1, configRevision: 1, configDigest: hash, contextDigest: hash },
    echoChallenge: { nonce: Buffer.alloc(32, 1).toString('base64'), invocationDigest: hash },
    result: { ...value.result, status: 'echoed', code: 'nonce-echo-verified', requestBytes: 256, responseBytes: 256,
      echo: { algorithm: 'Ed25519', requestDigest: hash, signature: Buffer.alloc(64, 2).toString('base64'), verified: true } } });
  return seal(value);
}
const envelope = fields => ({ probeRunsVersion: 1, scopeId: 'scope-a', capturedAt: now,
  source: 'persisted-probe-run-history', coverage: 'new-accepted-probes-since-history-enabled', historyComplete: false,
  readOnly: true, executionAuthorized: false, health: 'unknown', networkCheck: 'not-performed-by-read',
  consistency: 'read-committed-not-global-snapshot', limits: { ...limits }, losses: { rowsExpired: 0, rowsEvicted: 0, updatesWithoutHead: 0 }, ...fields });
class Element {
  constructor() { this.value = ''; this.textContent = ''; this.children = []; this.listeners = {}; this.disabled = false; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  replaceChildren(...values) { this.children = values; }
  append(...values) { this.children.push(...values); }
}
function harness(t, handler) {
  t.mock.method(Date, 'now', () => now);
  const elements = new Map(), calls = [], notices = [];
  let scope = 'scope-a';
  const byId = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const api = initProbeRuns({ byId, document: { createElement: () => new Element() }, getScope: () => scope,
    request: async (...args) => { calls.push(args); return handler(...args); }, notify: (...args) => notices.push(args) });
  const el = name => byId('probe-run-' + name), click = name => el(name).listeners.click();
  return { api, calls, notices, el, click, scope: value => { scope = value; } };
}
const text = element => [element.textContent, ...element.children.map(text)].join('\n');
function page(items, query, extra = {}) {
  return envelope({ window: { from: Date.parse(query.get('from')), to: Date.parse(query.get('to')) },
    filters: Object.fromEntries(['forwardId','nodeId','probeId','state','resultStatus'].map(key => [key, query.get(key)])),
    limit: Number(query.get('limit')), items, hasMore: false, nextCursor: null, ...extra });
}

test('manual historical run reads validate legacy and TCP/UDP Echo summaries and display stored evidence without commands', async t => {
  for (const value of [run('tcp', true), run('tcp'), run('udp')]) {
    const h = harness(t, async (_method, resource) => page([value], new URLSearchParams(resource.split('?')[1])));
    assert.equal(h.calls.length, 0); await h.click('list');
    assert.equal(h.notices.length, 0); assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0][0], 'GET'); assert.equal(h.calls[0][4].timeoutMs, 5000);
    assert.match(text(h.el('rows')), /contentDigest verified over full stored summary only/);
    assert.match(text(h.el('rows')), /health=unknown/); assert.match(h.el('meta').textContent, /executionAuthorized=false/);
    if (value.measurement) {
      assert.match(text(h.el('rows')), /not independently reverified/);
      assert.match(text(h.el('rows')), /requestBytes\/responseBytes=256\/256/);
      assert.match(text(h.el('rows')), new RegExp(' / ' + value.businessProtocol + ' / '));
    }
    h.el('rows').children[0].children[6].children[0].listeners.click();
    assert.equal(h.el('id').value, value.probeId); assert.equal(h.calls.length, 1, 'Loading an ID sends no detail request');
  }
});

test('full stored digest and independent Echo invocation digest reject tampering even when outer summary is resealed', async t => {
  const mutations = [
    value => { value.actorId = 'actor-changed'; }, value => { value.binding.bindingFence++; },
    value => { value.result.resultDigest = 'sha256:' + 'c'.repeat(64); },
    value => { value.echoChallenge.nonce = Buffer.alloc(32, 3).toString('base64'); seal(value, false); },
    value => { value.timeoutMs = 600; seal(value, false); },
    value => { value.service.contextDigest = 'sha256:' + 'd'.repeat(64); seal(value, false); },
  ];
  for (const mutate of mutations) {
    const value = run(); mutate(value); const h = harness(t, async () => envelope({ run: value }));
    h.el('id').value = value.probeId; await h.click('read');
    assert.equal(h.el('detail').textContent, ''); assert.equal(h.notices.length, 1); assert.equal(h.calls.length, 1);
    assert.match(h.notices[0][0], /summary digest/);
  }
});

test('run detail refuses retention, lifecycle, Scope, status, proof and byte inconsistencies after valid content resealing', async t => {
  const mutations = [
    value => { value.scopeId = 'scope-b'; }, value => { value.service.scopeId = 'scope-b'; },
    value => { value.issuedAt = now - limits.retentionMs - 1; }, value => { value.expiresAt = value.issuedAt; },
    value => { value.closedAt = value.expiresAt; value.updatedAt = value.closedAt; },
    value => { value.permitExpired = false; }, value => { value.resultExpired = false; },
    value => { value.result.acceptedAt = value.result.validUntil; }, value => { value.result.status = 'future-status'; },
    value => { value.result.echo.verified = false; }, value => { value.result.requestBytes = 255; },
    value => { value.applicationPayloadBytes = 0; }, value => { value.extra = 'closed-object'; },
  ];
  for (const mutate of mutations) {
    const value = run(); mutate(value); seal(value); const h = harness(t, async () => envelope({ run: value }));
    h.el('id').value = value.probeId; await h.click('read');
    assert.equal(h.el('detail').textContent, ''); assert.equal(h.notices.length, 1); assert.equal(h.calls.length, 1);
  }
  const value = run(), h = harness(t, async () => envelope({ run: value }));
  h.el('id').value = value.probeId; await h.click('read'); assert.equal(h.notices.length, 0);
  assert.equal(JSON.parse(h.el('detail').textContent).run.contentDigest, value.contentDigest);
});

test('history query rejects invalid windows, limits and status before I/O and preserves the echoed exact filter', async t => {
  for (const [name, value] of [['from', new Date(now - limits.retentionMs - 1).toISOString()], ['to', new Date(now - 86400000).toISOString()],
    ['limit', '51'], ['limit', '01'], ['resultStatus', 'unknown'], ['probeId', '../escape']]) {
    const h = harness(t, () => assert.fail('invalid query cannot request')); h.el(name).value = value; await h.click('list');
    assert.equal(h.calls.length, 0); assert.equal(h.notices.length, 1);
  }
  const value = run('udp'), h = harness(t, async (_method, resource) => {
    const query = new URLSearchParams(resource.split('?')[1]); assert.equal(query.get('resultStatus'), 'echoed'); return page([value], query);
  });
  h.el('resultStatus').value = 'echoed'; await h.click('list'); assert.equal(h.notices.length, 0);
});

test('history pages reject mismatched filters, order, duplicate IDs, cursor binding and excessive response size', async t => {
  for (const mode of ['filter','order','duplicate','cursor','size']) {
    const h = harness(t, async (_method, resource) => {
      const query = new URLSearchParams(resource.split('?')[1]), first = run(), second = seal({ ...run(), probeId: 'probe-b' });
      const data = page([first], query);
      if (mode === 'filter') data.filters.state = 'issued';
      if (mode === 'order') data.items = [first, second];
      if (mode === 'duplicate') data.items = [first, first];
      if (mode === 'cursor') Object.assign(data, { hasMore: true, nextCursor: 'not_bound_to_query' });
      if (mode === 'size') { data.items = Array(50).fill(first); first.actorId = 'x'.repeat(262144); }
      return data;
    });
    if (mode === 'cursor') h.el('limit').value = '1';
    if (mode === 'size') h.el('limit').value = '50';
    await h.click('list'); assert.equal(h.el('rows').children.length, 0); assert.equal(h.notices.length, 1); assert.equal(h.el('next').disabled, true);
  }
});

test('next page requires the same frozen query and cursor position and never paginates automatically', async t => {
  const first = run(), second = run('udp'); second.probeId = 'probe-older';
  for (const key of ['issuedAt','expiresAt','closedAt','updatedAt']) second[key] -= 1000;
  for (const key of ['measuredAt','validUntil','acceptedAt']) second.result[key] -= 1000;
  seal(second);
  let cursor;
  const h = harness(t, async (_method, resource) => {
    const query = new URLSearchParams(resource.split('?')[1]);
    if (query.has('cursor')) { assert.equal(query.get('cursor'), cursor); return page([second], query); }
    const data = page([first], query);
    cursor = Buffer.from(JSON.stringify({ version: 1, queryDigest: digest({ scope: 'scope-a', from: data.window.from,
      to: data.window.to, limit: 1, filters: data.filters }), position: { issuedAt: first.issuedAt, probeId: first.probeId } })).toString('base64url');
    return { ...data, hasMore: true, nextCursor: cursor };
  });
  h.el('limit').value = '1'; await h.click('list');
  assert.equal(h.notices.length, 0); assert.equal(h.calls.length, 1); assert.equal(h.el('next').disabled, false);
  await h.click('next'); assert.equal(h.calls.length, 2); assert.equal(h.notices.length, 0);
  assert.match(text(h.el('rows')), /probe-older/); assert.equal(h.el('next').disabled, true);
  h.api.clear(); assert.equal(h.calls.length, 2);
});

test('cancel, input edits, clear and Scope changes discard late history without automatic follow-up', async t => {
  for (const invalidate of [h => h.click('cancel'), h => h.el('from').listeners.input(), h => h.api.clear(), h => h.scope('scope-b')]) {
    let finish; const h = harness(t, (_method, resource) => new Promise(resolve => { finish = () => resolve(page([run()], new URLSearchParams(resource.split('?')[1]))); }));
    const pending = h.click('list'); invalidate(h); finish(); await pending;
    assert.equal(h.el('rows').children.length, 0); assert.equal(h.el('detail').textContent, ''); assert.equal(h.calls.length, 1);
    assert.equal(h.el('next').disabled, true);
  }
});
