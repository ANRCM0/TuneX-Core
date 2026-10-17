import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initTransportConsole } from '../transport-console.js';

class Element {
  constructor() { this.children = []; this.listeners = {}; this.value = ''; this.textContent = ''; this.disabled = false; this.open = false; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = [...items]; }
  addEventListener(event, fn) { this.listeners[event] = fn; }
  close() { if (this.open) { this.open = false; this.listeners.close?.(); } }
  showModal() { this.open = true; }
}
const profile = { profileId: 'profile-a', currentRevision: 2 };
const spec = { enabled: true, protocols: ['udp'], ingress: { nodeId: 'n1', listen: { address: '127.0.0.1', port: 32001 } },
  target: { host: '127.0.0.1', port: 80 }, path: { via: ['n2'] }, transport: { profileId: 'profile-a', configRevision: 1 } };
function referencePage(resource) {
  const query = new URLSearchParams(resource.split('?')[1]), preview = query.has('targetRevision');
  return { profileId: 'profile-a', currentRevision: 2, page: Number(query.get('page')), limit: 25, total: 26,
    previewOnly: true, reserved: false, fullPlanAuthorization: false, target: preview ? { revision: Number(query.get('targetRevision')) } : null,
    items: [{ forwardId: 'f1', revision: 7, expectedRevision: 7, configRevision: 1, recoverySuspended: false, spec,
      changed: preview ? true : null, proposedSpec: preview ? { ...spec, transport: { ...spec.transport, configRevision: Number(query.get('targetRevision')) } } : null }] };
}
function harness(handler = async (_, resource) => referencePage(resource), confirm = () => true) {
  const elements = new Map(), calls = [], edits = [], details = [], notices = [];
  const byId = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const api = initTransportConsole({ byId, confirm, document: { createElement: () => new Element() },
    request: async (...args) => { calls.push(args); return handler(...args); }, notify: (...args) => notices.push(args),
    detail: (...args) => details.push(args), edit: async item => edits.push(item) });
  return { api, calls, edits, details, notices, el: name => byId('transport-' + name) };
}
function buttons(element) { return element.children.flatMap(child => [child, ...buttons(child)]).filter(child => child.listeners.click); }

test('Profile references and impact use only bounded GETs and explicit immutable target revisions', async () => {
  const h = harness(); await h.api.open(profile);
  assert.equal(h.calls.length, 1); assert.match(h.calls[0][1], /page=1&limit=25$/);
  assert.equal(buttons(h.el('reference-rows')).some(b => b.textContent === 'Load Editor'), false);
  h.el('from-revision').value = '1'; await h.api.references(true);
  assert.match(h.calls[1][1], /revision=1&targetRevision=2/);
  await h.el('references-next').listeners.click();
  assert.match(h.calls[2][1], /page=2&limit=25&revision=1&targetRevision=2/);
  assert.ok(h.calls.every(c => c[0] === 'GET')); assert.equal(h.edits.length, 0);
  assert.match(h.el('references-meta').textContent, /NOT deployment authorization/);
});

test('loading an impact is an explicit editor proposal, never a mutation or implicit plan check', async () => {
  const h = harness(); await h.api.open(profile); await h.api.references(true);
  const load = buttons(h.el('reference-rows')).find(b => b.textContent === 'Load Editor');
  await load.listeners.click();
  assert.equal(h.edits.length, 1); assert.equal(h.edits[0].id, 'f1'); assert.equal(h.edits[0].revision, 7);
  assert.equal(h.edits[0].spec.transport.configRevision, 2); assert.equal(h.el('references-dialog').open, false);
  await load.listeners.click(); assert.equal(h.edits.length, 1, 'Old detached action must not load twice');
  assert.ok(h.calls.every(c => c[0] === 'GET'));
});

test('revision edits, dialog close and scope reset discard stale previews and cancel their request', async () => {
  for (const cancel of [h => h.el('target-revision').listeners.input(), h => h.el('references-dialog').close(), h => h.api.clear()]) {
    let resolve;
    const h = harness(async (_, resource) => new Promise(done => { resolve = () => done(referencePage(resource)); }));
    const pending = h.api.open(profile); cancel(h);
    assert.equal(h.calls[0][4].signal.aborted, true); resolve(); await pending;
    assert.equal(buttons(h.el('reference-rows')).length, 0);
    assert.equal(h.el('references-next').disabled, true);
  }
});

test('missing grant and malformed impact association fail closed without leaving a deployable proposal', async () => {
  let fail = false;
  const h = harness(async (_, resource) => { if (fail) throw Error('missing Profile Grant'); return referencePage(resource); });
  await h.api.open(profile); await h.api.references(true); fail = true; await h.api.references(true);
  assert.equal(buttons(h.el('reference-rows')).length, 0); assert.match(h.notices.at(-1)[0], /Grant/);
  const malformed = harness(async (_, resource) => {
    const data = referencePage(resource); data.items[0].expectedRevision = 999; return data;
  });
  await malformed.api.open(profile); assert.equal(buttons(malformed.el('reference-rows')).length, 0);
});

test('canonical revision checks reject ambiguous or injected fields before requesting a page', async () => {
  const h = harness(); await h.api.open(profile);
  for (const value of ['01', '0', '1.5', '1&target=any', '9007199254740992']) {
    h.el('target-revision').value = value; await h.api.references(true);
  }
  assert.equal(h.calls.length, 1); assert.equal(h.edits.length, 0);
});

test('native declarations show business UDP as Relay TCP carrier and never infer Node proof from Control gates', async () => {
  const catalog = JSON.parse(await readFile(new URL('../../../packages/contracts/data/native-drivers-v1.json', import.meta.url), 'utf8'));
  const h = harness(async () => ({ ...catalog, source: 'declared-native-implementation', authorized: false, reserved: false,
    drivers: catalog.drivers.map(d => ({ ...d, controlEnabled: d.controlGate === 'none' })) }));
  await h.api.catalog();
  const rows = h.el('catalog-rows').children;
  assert.equal(rows.length, 3); assert.match(rows[1].children[1].textContent, /UDP -> TCP/);
  assert.match(rows[2].children[2].textContent, /Control gate OFF/);
  buttons(h.el('catalog-rows'))[0].listeners.click(); assert.equal(h.details.length, 1);
  assert.equal(h.calls[0][1], 'native-drivers'); assert.equal(h.edits.length, 0);
});
