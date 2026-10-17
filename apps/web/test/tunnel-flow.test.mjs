import test from 'node:test';
import assert from 'node:assert/strict';
import { initTunnelConsole } from '../tunnel-console.js';

class Element {
  constructor() { this.children = []; this.listeners = {}; this.textContent = ''; this.disabled = false; this.open = false; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = [...items]; }
  addEventListener(event, fn) { this.listeners[event] = fn; }
  close() { if (this.open) { this.open = false; this.listeners.close?.(); } }
  showModal() { this.open = true; }
}
function metadata(id = 'node-a') {
  return { nodeId: id, source: 'persisted-control-state', observedAt: '2026-10-17T00:00:00.000Z', health: 'unknown', executionAuthorized: false, reserved: false,
    networkCheck: 'not-performed', certificateVerification: 'not-performed-by-this-query',
    node: { revoked: false, credentialUntil: '2026-10-18T00:00:00Z', recordedMachineWindowOpen: true, capabilities: ['native.relay.v1'], sessionEpoch: 2, snapshotGeneration: 3, lastReportAt: null },
    endpoint: { revision: 2, config: { listenAddress: '127.0.0.1', advertisedHost: '127.0.0.1', allowedTcpPorts: [32001] } },
    peerCredentials: { total: 5, recordedWindowCount: 1, limit: 4, items: [{ fingerprint: 'sha256:' + 'a'.repeat(64),
      issuedAt: '2026-10-16T00:00:00Z', validUntil: '2026-10-18T00:00:00Z', effectiveUntil: '2026-10-18T00:00:00Z', retireAfter: null, revoked: false, recordedWindowOpen: true }] } };
}
function references(resource) {
  const page = Number(new URLSearchParams(resource.split('?')[1]).get('page'));
  return { nodeId: 'node-a', page, limit: 25, total: 26, previewOnly: true, executionAuthorized: false, reserved: false, historicalReferencesIncluded: false, deletionSafety: 'not-proven',
    items: [{ forwardId: 'f' + page, revision: 7, enabled: false, recoverySuspended: true, profileId: 'p1', configRevision: 2, protocols: ['tcp', 'udp'],
      role: 'transit', path: ['ingress', 'node-a', 'egress'], previousNodeId: 'ingress', nextNodeId: 'egress', endpointRequired: true }] };
}
function response(resource) { return resource.includes('/references?') ? references(resource) : metadata(); }
function harness(handler = async (_, resource) => response(resource)) {
  const elements = new Map(), calls = [], deployments = [], notices = [];
  const byId = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const api = initTunnelConsole({ byId, document: { createElement: () => new Element() }, notify: (...args) => notices.push(args),
    deployment: async id => deployments.push(id), request: async (...args) => { calls.push(args); return handler(...args); } });
  return { api, calls, deployments, notices, el: name => byId('tunnel-' + name) };
}
function buttons(element) { return element.children.flatMap(child => [child, ...buttons(child)]).filter(child => child.listeners.click); }

test('tunnel Console uses only bounded read-only GETs and distinguishes recorded windows from network or certificate evidence', async () => {
  const h = harness(); await h.api.open('node-a');
  assert.equal(h.calls.length, 2); assert.ok(h.calls.every(call => call[0] === 'GET'));
  assert.equal(h.calls[0][1], 'nodes/node-a/tunnel'); assert.match(h.calls[1][1], /page=1&limit=25$/);
  assert.match(h.el('state').textContent, /health UNKNOWN/); assert.match(h.el('state').textContent, /not active sessions/);
  const data = JSON.parse(h.el('status').textContent); assert.equal(data.peerCredentials.truncated, true);
  assert.equal(data.node.snapshotGeneration, 3); assert.equal(data.endpoint.revision, 2);
  assert.match(h.el('reference-rows').children[0].children[0].textContent, /disabled.*recovery suspended/);
  assert.match(h.el('reference-rows').children[0].children[1].textContent, /transit.*previous: ingress.*next: egress/);
  assert.match(h.el('reference-rows').children[0].children[2].textContent, /locked r2.*tcp\/udp/);
  assert.equal(h.deployments.length, 0);
});

test('pagination is bounded, read-only, and a deployment view delegates to the original management entrypoint exactly once', async () => {
  const h = harness(); await h.api.open('node-a'); await h.el('next').listeners.click();
  assert.match(h.calls[2][1], /page=2&limit=25$/); assert.equal(h.el('next').disabled, true);
  const view = buttons(h.el('reference-rows'))[0]; await view.listeners.click(); await view.listeners.click();
  assert.deepEqual(h.deployments, ['f2']); assert.equal(h.el('dialog').open, false);
  assert.ok(h.calls.every(call => call[0] === 'GET'));
});

test('dialog close and disconnect abort both reads and discard late responses without recreating actions', async () => {
  for (const clear of [h => h.api.clear(), h => h.el('dialog').close()]) {
    const completions = [];
    const h = harness(async (_, resource) => new Promise(resolve => completions.push(() => resolve(response(resource)))));
    const pending = h.api.open('node-a'); clear(h);
    assert.ok(h.calls.every(call => call[4].signal.aborted));
    for (const complete of completions) complete(); await pending;
    assert.equal(h.el('status').textContent, ''); assert.equal(buttons(h.el('reference-rows')).length, 0); assert.equal(h.el('next').disabled, true);
  }
});

test('replacing the selected Node ignores all stale metadata and references', async () => {
  const completions = [], queuedClose = [];
  const h = harness(async (_, resource) => resource.includes('node-a') ? new Promise(resolve => completions.push(() => resolve(response(resource)))) :
    resource.includes('/references?') ? { ...references(resource), nodeId: 'node-b', total: 0, items: [] } : metadata('node-b'));
  // Native dialog close events may arrive after a new showModal, unlike this synchronous fake DOM.
  h.el('dialog').close = function () { if (this.open) { this.open = false; queuedClose.push(() => this.listeners.close?.()); } };
  const old = h.api.open('node-a'); await h.api.open('node-b'); for (const close of queuedClose) close();
  for (const complete of completions) complete(); await old;
  assert.equal(JSON.parse(h.el('status').textContent).nodeId, 'node-b'); assert.equal(buttons(h.el('reference-rows')).length, 0);
  assert.equal(h.el('dialog').open, true, 'A queued previous close must not clear the new modal session');
});

test('unavailable and malformed metadata clears previous output instead of retaining a readiness claim', async () => {
  let fail = false;
  const h = harness(async (_, resource) => { if (fail) throw Error('scope no longer visible'); return response(resource); });
  await h.api.open('node-a'); fail = true; await h.el('refresh').listeners.click();
  assert.equal(h.el('status').textContent, ''); assert.equal(buttons(h.el('reference-rows')).length, 0);
  assert.match(h.el('state').textContent, /unavailable.*UNKNOWN/);
  const corrupt = harness(async (_, resource) => resource.includes('/references?') ? response(resource) : { ...metadata(), health: 'ready' });
  await corrupt.api.open('node-a'); assert.equal(corrupt.el('status').textContent, ''); assert.match(corrupt.notices[0][0], /Invalid/);
});

test('unrelated adjacency, incorrect authorization and invalid paging fail closed without actions', async () => {
  for (const patch of [data => { data.items[0].previousNodeId = 'foreign'; }, data => { data.executionAuthorized = true; }, data => { data.items[0].path = ['node-a', 'node-a']; }]) {
    const h = harness(async (_, resource) => { const data = response(resource); if (resource.includes('/references?')) patch(data); return data; });
    await h.api.open('node-a'); assert.equal(buttons(h.el('reference-rows')).length, 0); assert.match(h.notices.at(-1)[0], /Invalid/);
  }
  const h = harness(); await h.api.open('node-a'); await h.api.references(10001);
  assert.equal(h.calls.length, 2); assert.equal(buttons(h.el('reference-rows')).length, 0);
  await assert.rejects(h.api.open('../other'), /scoped Node/);
});

test('unknown extra metadata fields never flow into the rendered credential projection', async () => {
  const h = harness(async (_, resource) => {
    const data = response(resource);
    if (!resource.includes('/references?')) { data.privateKey = 'secret-marker'; data.node.lastReport = 'secret-marker'; data.peerCredentials.items[0].certificate = 'secret-marker'; }
    return data;
  });
  await h.api.open('node-a'); assert.doesNotMatch(h.el('status').textContent, /secret-marker|privateKey|certificate|lastReport\"/);
});
