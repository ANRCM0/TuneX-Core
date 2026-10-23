import test from 'node:test';
import assert from 'node:assert/strict';
import { initProbeConsole } from '../probe.js';

const kinds = ['tcp-connect', 'tcp-ingress-connect', 'tcp-ingress-tls', 'tcp-ingress-echo', 'udp-ingress-echo'];
const forward = { id: 'forward-a', revision: 7, spec: { protocols: ['tcp'], enabled: true } };
function view(id = 'forward-a', scope = 'scope-a', mode = 'direct') {
  return {
    capabilityVersion: 1, scopeId: scope, forwardId: id, forwardRevision: 8, mode,
    readOnly: true, networkCheck: 'not-performed', executionAuthorized: false, endToEnd: false,
    health: 'unknown', consistency: 'read-committed-not-global-snapshot',
    items: kinds.map((kind, index) => ({
      measurement: kind + '-v1', taskKind: kind,
      point: index === 0 ? 'agent-direct-egress' : 'agent-local-direct-ingress', capability: 'probe.' + kind + '.v1',
      protocol: index === 4 ? 'udp' : 'tcp', endToEnd: false, health: 'unknown',
      transportSupport: mode === 'direct' ? 'supported' : 'unsupported',
      issuance: index >= 3 ? 'not-dispatchable' : 'disabled', issuanceReason: index >= 3 ? 'Command has no echo dispatch.' : 'Original switch off.',
      preflight: mode !== 'direct' ? { state: 'unsupported', reason: { code: 'UNSUPPORTED_CAPABILITY', message: 'No controlled Relay/multihop business-path Probe.' }, expiresAt: null } :
        index >= 2 ? { state: 'requires-controlled-service', reason: { code: 'CONTROLLED_SERVICE_REQUIRED', message: 'Exact service reference required.' }, expiresAt: null } :
          { state: 'available', reason: { code: 'PREFLIGHT_AVAILABLE', message: 'Original read-only preflight accepted.' }, expiresAt: '2026-10-20T00:00:00.000Z' },
    })),
    diagnostics: { apiPath: `/api/v1/scopes/${scope}/forwards/${id}/diagnostics`, source: 'persisted-control-and-agent-state',
      readOnly: true, networkCheck: 'not-performed', health: 'unknown', description: 'Persisted evidence only.' },
  };
}

function harness(handler = async (_method, resource) => resource === 'execution-capabilities' ? { probeIssuanceEnabled: false } : view()) {
  const elements = new Map(), calls = [], notices = [], displays = [];
  const doc = { createElement: tag => new Element(tag) };
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.ownerDocument = doc; this.children = []; this.dataset = {}; this.listeners = {}; this.attributes = {}; this.value = ''; this.checked = false; this.disabled = false; this.text = ''; }
    set id(value) { this.elementId = value; elements.set(value, this); }
    get id() { return this.elementId; }
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return this.text + this.children.map(child => child.textContent).join(' '); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.text = ''; this.children = children; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(name, action) { this.listeners[name] = action; }
    insertAdjacentElement(position, element) { assert.equal(position, 'afterend'); this.adjacent = element; }
  }
  const byId = id => { if (!elements.has(id)) { const node = new Element(); node.id = id; } return elements.get(id); };
  let scope = 'scope-a';
  const api = initProbeConsole({ byId, getScope: () => scope, notify: (...args) => notices.push(args),
    display: value => displays.push(value), confirm: () => true,
    request: async (...args) => { calls.push(args); return handler(...args); } });
  return { api, calls, notices, displays, el: name => byId('probe-' + name), setScope: value => { scope = value; } };
}

test('dynamic support matrix renders five exact observations and independent switches without enabling commands', async () => {
  const h = harness(); await h.api.openCapabilities(forward);
  assert.deepEqual(h.calls.map(call => [call[0], call[1]]), [['GET', 'forwards/forward-a/probe-capabilities']]);
  assert.deepEqual(h.displays, ['probes']); assert.equal(h.el('support-rows').children.length, 5);
  const text = h.el('support-rows').textContent;
  assert.match(text, /Agent 到原目标/); assert.match(text, /Agent 本机 Direct 入口/);
  assert.match(text, /原命令开关已关闭/); assert.match(text, /现有命令不可派发/);
  assert.match(text, /需要精确受控服务/); assert.match(text, /没有采集业务链路观测/);
  assert.match(h.el('support-state').textContent, /读取 revision 8.*选择 revision 7/);
  assert.equal(h.el('issue').disabled, true); assert.equal(h.el('prepare').disabled, true);
  assert.equal(h.el('consent').checked, false); assert.equal(h.el('id').value, '');
  assert.equal(h.el('support-diagnostics').dataset.action, 'forward-diagnostics');
  assert.equal(h.el('support-diagnostics').dataset.id, 'forward-a'); assert.equal(h.el('support-diagnostics').disabled, false);
});

test('Relay/multihop readonly selection stays outside original Direct TCP command selection', async () => {
  for (const mode of ['relay', 'multihop']) {
    const h = harness(async () => view('forward-a', 'scope-a', mode));
    await h.api.openCapabilities({ ...forward, spec: { protocols: ['udp'], path: { via: ['node-b'] } } });
    assert.equal(h.el('support-rows').children.length, 5);
    assert.match(h.el('support-rows').textContent, /不支持此观测/);
    assert.equal(h.el('issue').disabled, true); assert.equal(h.calls.filter(call => call[0] === 'POST').length, 0);
    await assert.rejects(h.api.open({ ...forward, spec: { protocols: ['tcp'], path: { via: ['node-b'] } } }), /complete supported path/);
  }
});

test('P4 extended path matrix keeps original five refusal rows and two explicit controlled-service rows without dispatch',async()=>{
  const candidate=view('forward-a','scope-a','multihop');candidate.capabilityVersion=2;
  for(const protocol of ['tcp','udp'])candidate.items.push({measurement:protocol+'-path-echo-v1',taskKind:protocol+'-path-echo',
    point:'agent-local-forward-ingress',capability:'probe.'+protocol+'-path-echo.v1',protocol,endToEnd:false,health:'unknown',
    transportSupport:'supported',issuance:'disabled',issuanceReason:'Path switch off.',preflight:{state:'requires-controlled-service',
      reason:{code:'CONTROLLED_SERVICE_REQUIRED',message:'Exact controlled final service required.'},expiresAt:null}});
  const h=harness(async()=>candidate);await h.api.openCapabilities(forward);
  assert.equal(h.el('support-rows').children.length,7);assert.match(h.el('support-rows').textContent,/agent-local-forward-ingress/);
  assert.equal(h.calls.some(call=>call[0]==='POST'),false);assert.equal(h.el('issue').disabled,true);
});

test('only explicit matrix refresh and existing capability refresh read support, with no polling or POST', async () => {
  const h = harness(); await h.api.open(forward);
  assert.equal(h.calls.filter(call => call[1].endsWith('/probe-capabilities')).length, 1);
  await h.el('support-refresh').listeners.click();
  assert.equal(h.calls.filter(call => call[1].endsWith('/probe-capabilities')).length, 2);
  await h.api.capabilities();
  assert.equal(h.calls.filter(call => call[1].endsWith('/probe-capabilities')).length, 3);
  assert.equal(h.calls.filter(call => call[1] === 'execution-capabilities').length, 2);
  assert.ok(h.calls.every(call => call[0] === 'GET'));
  assert.ok(h.calls.every(call => call[4].timeoutMs === 3000));
});

test('clear aborts the shared request session and discards late support results', async () => {
  let settle;
  const h = harness(async () => new Promise(resolve => { settle = resolve; }));
  const pending = h.api.openCapabilities(forward); const signal = h.calls[0][4].signal;
  h.api.clear(); assert.equal(signal.aborted, true); settle(view()); await pending;
  assert.equal(h.el('support-rows').children.length, 0); assert.equal(h.el('support-diagnostics').disabled, true);
  assert.equal(h.el('support-diagnostics').dataset.id, undefined); assert.equal(h.notices.length, 0);
});

test('late Forward selection and Scope responses never replace the current matrix', async () => {
  const resolvers = [];
  const h = harness(async () => new Promise(resolve => { resolvers.push(resolve); }));
  const first = h.api.openCapabilities(forward);
  const second = h.api.openCapabilities({ ...forward, id: 'forward-b' });
  resolvers[1](view('forward-b')); await second;
  resolvers[0](view()); await first;
  assert.equal(h.el('support-diagnostics').dataset.id, 'forward-b');
  const third = h.api.openCapabilities(forward); h.setScope('scope-b');
  resolvers[2](view()); await third;
  assert.equal(h.el('support-rows').children.length, 0); assert.equal(h.el('support-diagnostics').disabled, true);
  assert.ok(!h.el('support-state').textContent.includes('revision 8'));
});

test('API denial and malformed support contracts erase previous rows and never become unsupported claims', async () => {
  let response = view(), failure = null;
  const h = harness(async () => { if (failure) throw failure; return response; });
  await h.api.openCapabilities(forward);
  for (const mutate of [value => { value.endToEnd = true; }, value => { value.executionAuthorized = true; },
    value => { value.items[1] = value.items[0]; }, value => { value.diagnostics.apiPath = '/other-scope'; },
    value => { value.items[0].preflight.state = 'available'; value.items[0].preflight.expiresAt = null; }]) {
    response = view(); mutate(response); await h.el('support-refresh').listeners.click();
    assert.equal(h.el('support-rows').children.length, 0); assert.equal(h.el('support-diagnostics').disabled, true);
    assert.match(h.el('support-state').textContent, /失败或无权读取/);
  }
  failure = Error('Access revoked'); await h.el('support-refresh').listeners.click();
  assert.equal(h.el('support-rows').children.length, 0); assert.ok(h.calls.every(call => call[0] === 'GET'));
  assert.equal(h.el('issue').disabled, true);
});
