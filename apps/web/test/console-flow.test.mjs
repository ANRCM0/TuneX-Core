import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import * as model from '../model.js';
import * as relayModel from '../relay-model.js';

// A minimal DOM contract harness, not a real browser/layout/end-to-end acceptance.
class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.listeners = {}; this.dataset = {};
    this.value = ''; this.textContent = ''; this.hidden = false; this.disabled = false;
    this.classList = { toggle() {} };
  }
  append(...children) {
    for (const child of children) {
      this.children.push(child);
      if (this.tag === 'select' && (this.children.length === 1 || child.selected)) this.value = child.value;
    }
  }
  replaceChildren(...children) { this.children = []; if (this.tag === 'select') this.value = ''; this.append(...children); }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  setAttribute() {}
  scrollIntoView() {}
  reset() {}
  close() { this.open = false; }
  showModal() { this.open = true; }
}
const node = id => ({
  id, revoked: false, credentialUntil: '2099-01-01T00:00:00Z',
  policy: { allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [25565],
    capabilities: ['adp.3','native.direct.v1','native.relay.v1','relay.wire.1','adp.execution.1','native.multihop.v1','multihop.wire.1','tcp','udp'] }
});
async function harness(handler) {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const elements = new Map();
  for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"[^>]*>/g))
    elements.set(match[2], new Element(match[1]));
  for (const match of html.matchAll(/<form\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/form>/g)) {
    const fields = new Map();
    for (const input of match[2].matchAll(/<(input|select)\b([^>]*)>/g)) {
      const name = input[2].match(/\bname="([^"]+)"/)?.[1];
      if (!name) continue;
      const id = input[2].match(/\bid="([^"]+)"/)?.[1];
      fields.set(name, id ? elements.get(id) : new Element(input[1]));
    }
    elements.get(match[1]).elements = { namedItem: name => {
      assert.ok(fields.has(name), 'unknown form field ' + match[1] + '/' + name);
      return fields.get(name);
    } };
  }
  const calls = [], document = {
    getElementById(id) { assert.ok(elements.has(id), 'unknown HTML id ' + id); return elements.get(id); },
    createElement: tag => new Element(tag), querySelectorAll: () => [], addEventListener() {},
  };
  const context = vm.createContext({ ...model, ...relayModel, document, URLSearchParams, AbortSignal, AbortController, setTimeout, clearTimeout,
    crypto: { randomUUID }, console, confirm: () => true,
    fetch: async (url, options) => {
      const resource = url.split('/scope-a/')[1] ?? url.split('/scope-b/')[1];
      calls.push({resource,options});
      const result = await handler(resource, options);
      return { ok: true, status: 200, json: async () => result };
    }
  });
  const relay = (await readFile(new URL('../relay.js', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace('export function', 'function');
  const probe = (await readFile(new URL('../probe.js', import.meta.url), 'utf8')).replace('export function', 'function');
  const transport = (await readFile(new URL('../transport-console.js', import.meta.url), 'utf8')).replace('export function', 'function');
  const rules = (await readFile(new URL('../rule-console.js', import.meta.url), 'utf8')).replace('export function', 'function');
  const tunnels = (await readFile(new URL('../tunnel-console.js', import.meta.url), 'utf8')).replace('export function', 'function');
  const app = (await readFile(new URL('../app.js', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '');
  vm.runInContext(relay + '\n' + probe + '\n' + transport + '\n' + rules + '\n' + tunnels + '\n' + app + `
    globalThis.flow={load,loadOverview,editor,saveForward,action,refreshDirectCandidates,relayConsole,request,
      connect(scope='scope-a'){clearConnectionData();auth.scope=scope;auth.token='x'.repeat(40);},
      setPage(kind,value){page[kind]=value;},setFilters(kind,value){filters[kind]=value;},
      candidates,page,store,clearConnectionData};
  `, context);
  return { flow: context.flow, elements, calls };
}
const page = (items = [], total = items.length) => ({ page: 1, limit: 25, items, total });
test('scope-wide overview and candidate selectors do not depend on filtered list pages', async () => {
  const h = await harness(resource => {
    if (resource === 'overview') return { nodes: 80, forwards: 60, activeOperations: 28, failedOperations: 32 };
    if (resource.startsWith('nodes/candidates')) return page(resource.includes('nodeId=outside-page') ? [node('outside-page')] : [node('candidate-first')], 40);
    if (resource.startsWith('nodes?')) return page([node('listing-only')], 80);
    return page([{ id: 'op', forwardId: 'f', kind: 'create', status: 'succeeded', updatedAt: '2026-01-01' }], 100);
  });
  h.flow.connect();
  await h.flow.loadOverview(); await h.flow.load('nodes'); await h.flow.load('operations');
  h.flow.setPage('operations', 2); h.flow.setFilters('operations', { status: 'failed' });
  await h.flow.load('operations');
  assert.equal(h.elements.get('metric-running').textContent, '28');
  assert.equal(h.elements.get('metric-failed').textContent, '32');
  assert.ok(h.calls.some(call => call.resource === 'operations?page=2&limit=25&status=failed'));
  const spec = { protocols: ['tcp'], ingress: { nodeId: 'outside-page', listen: { address: '127.0.0.1', port: 25565 } }, target: { host: '127.0.0.1', port: 80 }, enabled: true };
  await h.flow.editor({ id: 'forward', revision: 1, spec });
  assert.equal(h.elements.get('forward-node').value, 'outside-page');
  await h.flow.load('nodes');
  assert.equal(h.elements.get('forward-node').value, 'outside-page', 'node table refresh must not reset the editor');
  h.elements.get('direct-candidate-prefix').value = 'candidate';
  await h.flow.refreshDirectCandidates();
  assert.equal(h.elements.get('forward-node').value, 'outside-page');
  assert.equal(h.elements.get('forward-port').value, '25565');
});

test('Direct copy is a detached, disabled new spec requiring an explicit listen port, never a source update', async () => {
  const h = await harness((resource, options) => {
    if (options.method === 'POST') return { forwardId: 'copy', revision: 1, operationId: 'create-copy' };
    if (resource.startsWith('nodes/candidates')) return page([node('node-a')]);
    if (resource === 'overview') return { nodes: 1, forwards: 2, activeOperations: 0, failedOperations: 0 };
    return page();
  });
  h.flow.connect();
  const original = { id: 'source', revision: 6, appliedGeneration: 50, health: 'healthy', spec: { enabled: true, protocols: ['tcp'],
    ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 25565 } }, target: { host: '127.0.0.1', port: 80 } } };
  await h.flow.editor(original, true);
  const fields = h.elements.get('forward-form').elements;
  assert.equal(fields.namedItem('enabled').checked, false); assert.equal(h.elements.get('forward-node').disabled, false);
  assert.equal(h.elements.get('forward-port').value, '');
  assert.equal(h.calls.some(call => call.options.method !== 'GET'), false);
  h.elements.get('forward-port').value = '25565';
  await h.flow.saveForward({ preventDefault() {} });
  const sent = h.calls.filter(call => call.options.method === 'POST'); assert.equal(sent.length, 1);
  assert.equal(sent[0].resource, 'forwards');
  const body = JSON.parse(sent[0].options.body); assert.equal(body.enabled, false);
  assert.deepEqual(Object.keys(body).sort(), ['enabled', 'ingress', 'protocols', 'target']);
  assert.equal(original.spec.enabled, true); assert.equal(original.revision, 6);
});

test('Relay copy keeps the immutable Profile lock and path but requires fresh preview and creates disabled intent', async () => {
  const declarations = JSON.parse(await readFile(new URL('../../../packages/contracts/data/native-drivers-v1.json', import.meta.url), 'utf8'));
  const h = await harness((resource, options) => {
    if (resource === 'execution-capabilities') return { multihopEnabled: true };
    if (resource === 'native-drivers') return { ...declarations, source: 'declared-native-implementation', authorized: false, reserved: false };
    if (resource === 'transport-profiles') return { profiles: [{ profileId: 'profile-a', currentRevision: 8 }] };
    if (resource.startsWith('nodes/candidates')) return page([node('relay-a'), node('relay-mid'), node('relay-b')]);
    if (resource === 'transport-profiles/profile-a?revision=2') return { profileId: 'profile-a', revision: 2, config: { driver: 'native.relay.v1', protocols: ['tcp', 'udp'] } };
    if (resource.endsWith('/relay-endpoint')) return { revision: 1 };
    if (resource === 'relay-plan') return { reserved: false, executionSupported: true };
    if (resource === 'forwards' && options.method === 'POST') return { forwardId: 'copy', revision: 1, operationId: 'create-copy' };
    if (resource === 'overview') return { nodes: 3, forwards: 2, activeOperations: 0, failedOperations: 0 };
    if (resource.startsWith('forwards?') || resource.startsWith('operations?')) return page();
    throw Error(resource + '/' + options.method);
  });
  h.flow.connect();
  const original = { id: 'source', revision: 6, spec: { enabled: true, protocols: ['udp'],
    ingress: { nodeId: 'relay-a', listen: { address: '127.0.0.1', port: 25565 } }, target: { host: '127.0.0.1', port: 80 },
    path: { via: ['relay-mid', 'relay-b'] }, transport: { profileId: 'profile-a', configRevision: 2 } } };
  await h.flow.relayConsole.copy(original);
  assert.equal(h.calls.some(call => call.options.method !== 'GET'), false);
  assert.equal(h.elements.get('relay-submit').disabled, true);
  const form = h.elements.get('relay-forward-form');
  assert.equal(form.elements.namedItem('enabled').checked, false); assert.equal(h.elements.get('relay-ingress').disabled, false);
  assert.equal(h.elements.get('relay-listen-port').value, '');
  h.elements.get('relay-listen-port').value = '25565';
  await h.elements.get('relay-preview').listeners.click();
  assert.equal(h.elements.get('relay-submit').disabled, false);
  await form.listeners.submit({ preventDefault() {} });
  const sent = h.calls.filter(call => call.resource === 'forwards' && call.options.method === 'POST'); assert.equal(sent.length, 1);
  const body = JSON.parse(sent[0].options.body);
  assert.equal(body.enabled, false); assert.deepEqual(body.path.via, ['relay-mid', 'relay-b']);
  assert.deepEqual(body.transport, { profileId: 'profile-a', configRevision: 2 });
  assert.equal(Object.hasOwn(body, 'id'), false); assert.equal(Object.hasOwn(body, 'revision'), false);
  assert.equal(original.spec.enabled, true);
});
test('late responses cannot cross connections or overwrite a newer page', async () => {
  const pending = [];
  const h = await harness(() => new Promise(resolve => pending.push(resolve)));
  h.flow.connect();
  const older = h.flow.load('nodes');
  const newer = h.flow.load('nodes');
  pending[1](page([node('newer')]));
  await newer;
  pending[0](page([node('older')]));
  await older;
  assert.equal(h.flow.store.nodes[0].id, 'newer');
  const stale = h.flow.loadOverview();
  h.flow.connect('scope-b');
  pending[2]({ nodes: 999, forwards: 999, activeOperations: 999, failedOperations: 999 });
  await assert.rejects(stale, /连接已变化/);
  assert.equal(h.elements.get('metric-nodes').textContent, '—');
  assert.equal(h.flow.candidates.direct.length, 0);
});
test('Direct candidate refresh never silently changes a revoked selection to a different node', async () => {
  let revoked = false;
  const h = await harness(resource => {
    const id = new URLSearchParams(resource.split('?')[1]).get('nodeId');
    return page(id ? revoked ? [] : [node(id)] : [node(revoked ? 'replacement' : 'selected')]);
  });
  h.flow.connect();
  await h.flow.editor(null);
  assert.equal(h.elements.get('forward-node').value, 'selected');
  revoked = true;
  await assert.rejects(h.flow.refreshDirectCandidates(), /已失效/);
  assert.equal(h.elements.get('forward-node').value, '');
  assert.equal(h.elements.get('save-forward').disabled, true);
});
test('Relay selections survive independent candidate searches and fail closed after grant loss', async () => {
  let revoked = false;
  const h = await harness(resource => {
    if (!resource.startsWith('nodes/candidates')) throw Error(resource);
    const query = new URLSearchParams(resource.split('?')[1]);
    const id = query.get('nodeId');
    if (id) return page(revoked && id === 'relay-a' ? [] : [node(id)]);
    return page(query.get('idPrefix') ? [node('relay-c')] : [node('relay-a'),node('relay-b')], 50);
  });
  h.flow.connect();
  await h.flow.relayConsole.refreshCandidates();
  h.elements.get('relay-ingress').value = 'relay-a';
  h.elements.get('relay-egress').value = 'relay-b';
  h.elements.get('relay-candidate-prefix').value = 'relay-c';
  await h.flow.relayConsole.refreshCandidates();
  assert.equal(h.elements.get('relay-ingress').value, 'relay-a');
  assert.equal(h.elements.get('relay-egress').value, 'relay-b');
  assert.ok(h.flow.candidates.relay.some(n => n.id === 'relay-c'));
  revoked = true;
  await assert.rejects(h.flow.relayConsole.refreshCandidates(), /已失效/);
  assert.equal(h.elements.get('relay-preview').disabled, true);
  assert.equal(h.elements.get('relay-submit').disabled, true);
  assert.ok(!h.flow.candidates.relay.some(n => n.id === 'relay-a'));
});

test('disconnect discards a late deployment view without opening a dialog or creating historical restore actions', async () => {
  const pending = [];
  const h = await harness(resource => new Promise(resolve => pending.push(() => resolve(resource.endsWith('/deployment') ?
    { deployment: { stage: 'active', nodes: [], isolation: [] } } : resource.endsWith('/revisions') ? { revisions: [{ revision: 1 }] } : { desired: { revision: 2 } }))));
  h.flow.connect(); const old = h.flow.relayConsole.deployment('f1'); h.flow.clearConnectionData();
  for (const complete of pending) complete(); await assert.rejects(old, /连接已变化/);
  assert.equal(h.elements.get('deployment-dialog').open, false); assert.equal(h.elements.get('deployment-nodes').children.length, 0);
});

test('a changed Relay form cannot enable submit from a late previous plan response', async () => {
  const declarations = JSON.parse(await readFile(new URL('../../../packages/contracts/data/native-drivers-v1.json', import.meta.url), 'utf8'));
  const entered = Promise.withResolvers(), reply = Promise.withResolvers();
  const h = await harness(resource => {
    if (resource === 'execution-capabilities') return { multihopEnabled: false };
    if (resource === 'native-drivers') return { ...declarations, source: 'declared-native-implementation', authorized: false, reserved: false };
    if (resource === 'transport-profiles') return { profiles: [{ profileId: 'p1', currentRevision: 1 }] };
    if (resource.startsWith('nodes/candidates')) return page([node('relay-a'), node('relay-b')]);
    if (resource === 'transport-profiles/p1?revision=1') return { profileId: 'p1', revision: 1, config: { driver: 'native.relay.v1', protocols: ['tcp'] } };
    if (resource.endsWith('/relay-endpoint')) return { revision: 1 };
    if (resource === 'relay-plan') { entered.resolve(); return reply.promise; }
    throw Error(resource);
  });
  h.flow.connect(); await h.flow.relayConsole.edit({ id: 'f1', revision: 3, spec: { enabled: true, protocols: ['tcp'],
    ingress: { nodeId: 'relay-a', listen: { address: '127.0.0.1', port: 25565 } }, target: { host: '127.0.0.1', port: 80 }, path: { via: ['relay-b'] }, transport: { profileId: 'p1', configRevision: 1 } } });
  const pending = h.elements.get('relay-preview').listeners.click(); await entered.promise;
  h.elements.get('relay-forward-form').listeners.input(); reply.resolve({ reserved: false }); await pending;
  assert.equal(h.elements.get('relay-submit').disabled, true); assert.equal(h.elements.get('relay-preview-output').hidden, true);
  assert.equal(h.calls.filter(call => call.options.method !== 'GET').length, 1, 'Only the original read-only plan POST was sent');
});
