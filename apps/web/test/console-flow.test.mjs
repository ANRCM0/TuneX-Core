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
  for (const match of html.matchAll(/<([a-z]+)\b[^>]*\bid="([^"]+)"[^>]*>/g))
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
  const context = vm.createContext({ ...model, ...relayModel, document, URLSearchParams, AbortSignal,
    crypto: { randomUUID }, console, confirm: () => true,
    fetch: async (url, options) => {
      const resource = url.split('/scope-a/')[1] ?? url.split('/scope-b/')[1];
      calls.push({resource,options});
      const result = await handler(resource, options);
      return { ok: true, status: 200, json: async () => result };
    }
  });
  const relay = (await readFile(new URL('../relay.js', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '').replace('export function', 'function');
  const app = (await readFile(new URL('../app.js', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '');
  vm.runInContext(relay + '\n' + app + `
    globalThis.flow={load,loadOverview,editor,refreshDirectCandidates,relayConsole,request,
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
