import test from 'node:test';
import assert from 'node:assert/strict';
import { initProbeConsole } from '../probe.js';

const issuedAt = '2026-10-17T00:00:00.000Z', expiresAt = '2026-10-17T00:00:02.000Z';
const forward = { id: 'forward-a', revision: 7, spec: { protocols: ['tcp'], enabled: true } };
const acceptance = { probeId: 'probe-a', forwardId: forward.id, issuedAt, expiresAt, dispatch: 'agent-poll', executionEnabled: false };
const receipt = (changes = {}) => ({ probeId: 'probe-a', forwardId: forward.id, issuedAt, expiresAt,
  state: 'issued', expired: false, withdrawnAt: null, executionEnabled: false, health: 'unknown', result: null, ...changes });
const result = () => ({ historical: true, expired: true, acceptedAt: Date.parse(issuedAt) + 50, resultDigest: 'sha256:' + 'a'.repeat(64),
  body: { protocolVersion: 3, probeVersion: 1, kind: 'probe-result', nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 1,
    instanceId: 'b'.repeat(64), instanceGeneration: 1, permitId: 'probe-a',
    binding: { nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 1, snapshotGeneration: 1, assignmentId: 'assignment-a',
      forwardId: forward.id, forwardRevision: 7, deploymentGeneration: 1, bindingFence: 1, configDigest: 'sha256:' + 'c'.repeat(64), egressPolicyRevision: 1 },
    consumedAt: issuedAt, source: 'agent-reported', applicationHealth: 'unknown',
    applicationPayloadBytes: 0, point: 'agent-direct-egress', status: 'connected', code: 'tcp-connected', timeoutMs: 500, issuedAt, expiresAt, elapsedMs: 0,
    measuredAt: issuedAt, validUntil: expiresAt } });
function harness(handler = async () => ({ probeIssuanceEnabled: true }), confirm = () => true, scope = '') {
  const elements = new Map(), calls = [], notices = [], views = [];
  const byId = id => {
    if (!elements.has(id)) elements.set(id, { value: '', checked: false, textContent: '', disabled: false, listeners: {},
      addEventListener(name, fn) { this.listeners[name] = fn; } });
    return elements.get(id);
  };
  const api = initProbeConsole({ byId, confirm, getScope: () => scope, display: view => views.push(view), delay: async () => {},
    notify: (...args) => notices.push(args), request: async (...args) => { calls.push(args); return handler(...args); } });
  const el = name => byId('probe-' + name);
  return { api, el, calls, notices, views };
}
const consent = h => { h.el('timeout').value = '500'; h.el('consent').checked = true; };

test('Probe console defaults off, rejects unsupported selections and requires explicit consent', async () => {
  const h = harness(async () => ({ probeIssuanceEnabled: false }));
  assert.equal(h.el('issue').disabled, true);
  await h.api.open(forward); consent(h); await h.api.issue();
  assert.equal(h.calls.filter(c => c[0] === 'POST').length, 0);
  assert.equal(h.el('issue').disabled, true);
  await assert.rejects(h.api.open({ ...forward, spec: { protocols: ['udp'] } }), /Direct TCP/);
  await assert.rejects(h.api.open({ ...forward, spec: { protocols: ['tcp'], path: {} } }), /Direct TCP/);
  const enabled = harness(); await enabled.api.open(forward); await enabled.api.issue();
  assert.equal(enabled.calls.filter(c => c[0] === 'POST').length, 0);
});

test('uncertain issue replays the same immutable key/body, double clicks and successful replays never issue new tasks', async () => {
  let fail = true, pending;
  const h = harness(async (method) => {
    if (method === 'GET') return { probeIssuanceEnabled: true };
    if (fail) { fail = false; throw Error('connection lost after commit'); }
    return new Promise(resolve => { pending = resolve; });
  });
  await h.api.open(forward); consent(h); await h.api.issue();
  assert.match(h.el('state').textContent, /uncertain/);
  assert.equal(h.el('timeout').disabled, true);
  h.el('timeout').value = '2000';
  const replay = h.api.issue(); await h.api.issue();
  const posts = h.calls.filter(c => c[0] === 'POST');
  assert.equal(posts.length, 2); assert.equal(posts[0][3], posts[1][3]);
  assert.deepEqual(posts[0][2], { version: 1, kind: 'tcp-connect', expectedRevision: 7, timeoutMs: 500 });
  assert.equal(posts[0][2], posts[1][2]);
  pending(acceptance); await replay; await h.api.issue();
  assert.equal(h.calls.filter(c => c[0] === 'POST').length, 2);
  assert.equal(h.el('id').value, 'probe-a'); assert.equal(h.el('issue').disabled, true);
  assert.match(h.el('state').textContent, /not guaranteed/);
  await h.api.prepare(); assert.equal(h.el('consent').checked, false);
});

test('abandoning an uncertain command is explicit; no new key appears without a new submit', async () => {
  const h = harness(async method => { if (method === 'GET') return { probeIssuanceEnabled: true }; throw Error('timeout'); }, () => false);
  await h.api.open(forward); consent(h); await h.api.issue();
  await h.api.prepare(); await h.api.open({ ...forward, id: 'other' });
  assert.match(h.el('selected').textContent, /forward-a/);
  assert.match(h.el('issue').textContent, /Replay/);
  assert.equal(h.calls.filter(c => c[0] === 'POST').length, 1);
});

test('historical connected result stays unknown and query failures never become zero-latency success', async () => {
  let fail = false;
  const h = harness(async () => { if (fail) throw Error('404'); return receipt({ state: 'consumed', expired: true, result: result() }); });
  h.el('id').value = 'probe-a'; await h.api.query();
  const view = JSON.parse(h.el('receipt').textContent);
  assert.equal(view.health, 'unknown'); assert.equal(view.report.historical, true);
  assert.equal(view.report.source, 'agent-reported'); assert.equal(view.report.elapsedMs, 0);
  assert.match(h.el('state').textContent, /Historical/);
  fail = true; await h.api.query();
  assert.equal(h.el('receipt').textContent, ''); assert.equal(h.el('revoke').disabled, true);
  assert.match(h.el('state').textContent, /unknown/);
});

test('invalid source, payload, identity and current-health assertions fail closed in display projection', async () => {
  for (const bad of [receipt({ probeId: 'other' }), receipt({ health: 'healthy' }), receipt({ executionEnabled: true }),
    receipt({ result: { ...result(), historical: false } }), receipt({ result: { ...result(), body: { ...result().body, applicationPayloadBytes: 1 } } }),
    receipt({ result: { ...result(), body: { ...result().body, source: 'independent' } } }),
    receipt({ state: 'consumed', result: { ...result(), body: { ...result().body, elapsedMs: 501 } } }),
    receipt({ state: 'consumed', result: { ...result(), body: { ...result().body, code: 'tcp-connect-failed' } } })]) {
    const h = harness(async () => bad); h.el('id').value = 'probe-a'; await h.api.query();
    assert.equal(h.el('receipt').textContent, ''); assert.equal(h.el('revoke').disabled, true);
    assert.match(h.el('state').textContent, /unknown/);
  }
});

test('receipt wait makes at most eight GETs, never a hidden POST, and stops at expiry', async () => {
  const h = harness(async () => receipt()); h.el('id').value = 'probe-a'; await h.api.wait();
  assert.equal(h.calls.length, 8); assert.ok(h.calls.every(c => c[0] === 'GET' && c[4].timeoutMs === 1500));
  assert.equal(h.el('stop').disabled, true); assert.match(h.el('state').textContent, /Bounded/);
  const expired = harness(async () => receipt({ expired: true })); expired.el('id').value = 'probe-a'; await expired.api.wait();
  assert.equal(expired.calls.length, 1); assert.match(expired.el('state').textContent, /unknown/);
});

test('stop, edited IDs and disconnect discard in-flight responses even when the transport ignores abort', async () => {
  for (const cancel of [h => h.api.stop(), h => h.el('id').listeners.input(), h => h.api.clear()]) {
    let resolve;
    const h = harness(async () => new Promise(done => { resolve = done; }));
    h.el('id').value = 'probe-a'; const pending = h.api.wait(); cancel(h);
    assert.equal(h.calls[0][4].signal.aborted, true);
    resolve(receipt({ result: result(), state: 'consumed' })); await pending;
    assert.equal(h.el('receipt').textContent, ''); assert.equal(h.el('revoke').disabled, true);
  }
});

test('newer queries win and invalid ID characters cannot expand the request path', async () => {
  const pending = [], h = harness(async () => new Promise(resolve => pending.push(resolve)));
  h.el('id').value = 'probe-a'; const first = h.api.query(), second = h.api.query();
  pending[1](receipt({ state: 'revoked' })); await second; pending[0](receipt()); await first;
  assert.equal(JSON.parse(h.el('receipt').textContent).state, 'revoked');
  h.el('id').value = '../other'; await h.api.query(); assert.equal(h.calls.length, 2);
});

test('revoke uses the queried ID, exact empty body, no idempotency task and a confirmation', async () => {
  let withdrawn = false;
  const h = harness(async method => {
    if (method === 'POST') { withdrawn = true; return {}; }
    return receipt({ state: 'consumed', withdrawnAt: withdrawn ? issuedAt : null });
  });
  h.el('id').value = 'probe-a'; await h.api.query();
  h.el('id').value = 'other'; await h.api.revoke(); assert.equal(h.calls.length, 1);
  h.el('id').value = 'probe-a'; await h.api.revoke();
  const post = h.calls.find(c => c[0] === 'POST');
  assert.equal(post[1], 'probes/probe-a/revoke'); assert.deepEqual(post[2], {}); assert.equal(post[3], undefined);
  assert.equal(h.el('revoke').disabled, true); assert.equal(JSON.parse(h.el('receipt').textContent).state, 'consumed');
});

test('late acceptance cannot restore keys, receipt IDs or selection after connection reset', async () => {
  let resolve;
  const h = harness(async method => method === 'GET' ? { probeIssuanceEnabled: true } : new Promise(done => { resolve = done; }));
  await h.api.open(forward); consent(h); const pending = h.api.issue();
  h.api.clear(); assert.equal(h.calls.at(-1)[4].signal.aborted, true);
  resolve(acceptance); await pending;
  assert.equal(h.el('id').value, ''); assert.equal(h.el('acceptance').textContent, ''); assert.equal(h.el('issue').disabled, true);
});

function echoReceipt(protocol = 'tcp', state = 'consumed', outcome = 'echoed') {
  const taskKind = protocol + '-ingress-echo';
  const service = { scopeId: 'scope-a', serviceId: 'echo-service', revision: 1, configRevision: 1, configDigest: 'sha256:' + 'd'.repeat(64), contextDigest: 'sha256:' + 'e'.repeat(64) };
  const description = { measurement: taskKind + '-v1', taskKind, point: 'agent-local-direct-ingress', capability: 'probe.' + taskKind + '.v1' };
  const report = result();
  Object.assign(report.body, description, { probeVersion: 4, kind: 'probe-echo-result', businessProtocol: protocol, service, tls: null,
    challenge: { nonce: Buffer.alloc(32, 1).toString('base64'), invocationDigest: 'sha256:' + 'f'.repeat(64) },
    status: outcome, code: outcome === 'echoed' ? 'nonce-echo-verified' : outcome === 'unverified' ? 'nonce-echo-rejected' : 'tcp-connect-failed',
    echo: outcome === 'echoed' ? { algorithm: 'Ed25519', requestDigest: 'sha256:' + 'a'.repeat(64), signature: Buffer.alloc(64, 2).toString('base64'), verified: true } : null,
    requestBytes: outcome === 'unreachable' ? 0 : 256, responseBytes: outcome === 'echoed' ? 256 : 0,
    applicationPayloadBytes: outcome === 'echoed' ? 512 : outcome === 'unreachable' ? 0 : 256 });
  return receipt({ ...description, service, state, result: state === 'consumed' ? report : null });
}

test('TCP and UDP Echo receipts display stored evidence with unknown health across terminal and pending states', async () => {
  for (const protocol of ['tcp', 'udp']) for (const state of ['issued', 'consumed', 'revoked', 'quarantined']) {
    const value = echoReceipt(protocol, state), h = harness(async () => value, () => true, 'scope-a');
    h.el('id').value = 'probe-a'; await h.api.query();
    const view = JSON.parse(h.el('receipt').textContent);
    assert.equal(view.state, state); assert.equal(view.health, 'unknown'); assert.equal(view.executionEnabled, false);
    assert.equal(view.businessProtocol, protocol); assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0], 'GET');
    if (state === 'consumed') {
      assert.equal(view.report.proofVerification, 'stored-evidence-not-reverified-by-browser');
      assert.equal(view.report.applicationPayloadBytes, 512); assert.equal(view.report.requestBytes, 256); assert.equal(view.report.responseBytes, 256);
    } else assert.equal(view.report, null);
  }
  for (const [protocol, outcome] of [['tcp', 'unreachable'], ['tcp', 'unverified'], ['udp', 'unverified']]) {
    const h = harness(async () => echoReceipt(protocol, 'consumed', outcome), () => true, 'scope-a');
    h.el('id').value = 'probe-a'; await h.api.query();
    assert.equal(JSON.parse(h.el('receipt').textContent).report.status, outcome);
  }
});

test('Echo display rejects malformed scope, descriptor, binding, timing, proof and byte relationships without hidden requests', async () => {
  const mutations = [
    value => { value.extra = true; }, value => { value.service.scopeId = 'foreign'; }, value => { value.capability = 'wrong'; },
    value => { value.result.body.binding.nodeId = 'other'; }, value => { value.result.body.service.contextDigest = 'invalid'; },
    value => { value.result.body.challenge.nonce = 'invalid'; }, value => { value.result.body.echo.verified = false; },
    value => { value.result.body.echo.signature = 'invalid'; }, value => { value.result.body.requestBytes = 255; },
    value => { value.result.body.applicationPayloadBytes = 0; }, value => { value.result.body.status = 'unknown'; },
    value => { value.result.acceptedAt = Date.parse(expiresAt); }, value => { value.result.body.validUntil = issuedAt; },
    value => { value.result.body.instanceId = 'wrong'; }, value => { value.result.body.tls = {}; },
    value => { value.result.body.source = 'independent'; }, value => { value.executionEnabled = true; },
  ];
  for (const mutate of mutations) {
    const value = echoReceipt(); mutate(value);
    const h = harness(async () => value, () => true, 'scope-a'); h.el('id').value = 'probe-a'; await h.api.query();
    assert.equal(h.el('receipt').textContent, ''); assert.equal(h.el('revoke').disabled, true); assert.equal(h.calls.length, 1);
    assert.match(h.el('state').textContent, /unknown/);
  }
});
