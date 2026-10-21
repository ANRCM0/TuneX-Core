import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mountControlConsole } from '../browser-native/public.js';
import { directCapable } from '../model.js';

const enrollmentSecret = 'only-this-secret'.repeat(3);

const initializerNames = ['initRelayConsole', 'initProbeConsole', 'initProbeRuns', 'initProbePlans', 'initTransportConsole', 'initRuleConsole',
  'initTunnelConsole', 'initTelemetryConsole', 'initForwardTelemetryConsole', 'initHostTelemetryConsole', 'initProbeTelemetryConsole',
  'initTelemetryAggregateConsole', 'initPathSwitch', 'initPathTemplates', 'initPathGroups', 'initPathPublications', 'initIngressGroups',
  'initIngressMigrations', 'initForwardDiagnostics', 'initAuditConsole', 'initStationAlerts', 'initNotificationEndpoints',
  'initNotificationDeliveries', 'initObservationServices'];
const clearOrder = ['initForwardDiagnostics', 'initAuditConsole', 'initProbeRuns', 'initProbePlans', 'initStationAlerts',
  'initNotificationEndpoints', 'initNotificationDeliveries', 'initObservationServices', 'initRelayConsole', 'initProbeConsole',
  'initTransportConsole', 'initRuleConsole', 'initTunnelConsole', 'initTelemetryConsole', 'initForwardTelemetryConsole',
  'initHostTelemetryConsole', 'initProbeTelemetryConsole', 'initTelemetryAggregateConsole', 'initPathTemplates', 'initPathSwitch',
  'initPathGroups', 'initPathPublications', 'initIngressGroups', 'initIngressMigrations'];
class Element {
  constructor(id = '') {
    this.id = id; this.value = ''; this.textContent = ''; this.hidden = false; this.disabled = false;
    this.children = []; this.listeners = new Map(); this.dataset = {}; this.open = false; this.resetCount = 0;
    this.classList = { toggle: (...args) => { this.toggled = args; } };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) {
    this.children = [...children];
    if (this.id === 'scope' && !children.some(child => child.value === this.value)) this.value = children[0]?.value ?? '';
  }
  addEventListener(name, callback) {
    assert.equal(this.listeners.has(name), false, this.id + ':' + name); this.listeners.set(name, callback);
  }
  reset() { this.resetCount++; }
  showModal() { this.open = true; }
  close() { if (this.open) { this.open = false; this.listeners.get('close')?.(); } }
  scrollIntoView(options) { this.scrolled = options; }
  querySelectorAll() { return []; }
  querySelector(selector) {
    assert.equal(selector, 'option[value="retain"]');
    return this.children.find(child=>child.value==='retain') ?? null;
  }
}
function harness(t, options = {}) {
  const saved = ['document', 'navigator', 'FormData', 'fetch'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  t.after(() => { for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  } });
  const elements = new Map(), initializers = {}, owners = {}, events = [], requests = [], mutations = [], copies = [];
  const byId = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  byId('resource-provision-form').elements=[];
  const retain=new Element('option');retain.value='retain';byId('resource-classify-legacy').append(retain);
  byId('nodes-filter').elements={namedItem:name=>{assert.equal(name,'ownership');return byId('nodes-ownership');}};
  const navs = ['overview', 'relay', 'resources', 'notifications'].map(view => { const item = new Element('nav-' + view); item.dataset.view = view; return item; });
  const governanceNavs=navs.filter(item=>['resources','notifications'].includes(item.dataset.view));
  const views = ['overview', 'nodes', 'forwards', 'relay', 'resources', 'notifications'].map(view => new Element('view-' + view));
  const document = new Element('document');
  Object.assign(document, { getElementById: byId, createElement: tag => new Element(tag),
    querySelectorAll: selector => selector === '.nav' ? navs : selector === '.view' ? views : selector === '[data-governance]' ? governanceNavs : assert.fail(selector) });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async value => {
    copies.push(value); if (options.copyError) throw options.copyError;
  } } } });
  Object.defineProperty(globalThis, 'FormData', { configurable: true, value: class {
    constructor(form) { this.values = form.entries; }
    [Symbol.iterator]() { return this.values[Symbol.iterator](); }
  } });
  const contexts=[];
  Object.defineProperty(globalThis,'fetch',{configurable:true,value:async(url,input)=>{
    assert.equal(url,'/api/v1/me/context?limit=100');
    assert.equal(input.method,'GET');assert.equal(input.headers.Authorization,'Bearer '+'x'.repeat(40));
    contexts.push({url,input});
    const body=options.context??{actorId:'actor-a',limit:100,scopes:[{scopeId:'scope-a',role:'manager',membership:'active',membershipRevision:1,canEnter:true,canManage:true}],truncated:false,nextAfter:null};
    return {ok:true,status:200,json:async()=>body};
  }});
  let state;
  const dependencies = {
    validScope: scope => /^[a-z][a-z0-9-]*$/.test(scope), parsePorts: value => { events.push(['ports', value]); return [10001]; },
    parseCidrs: value => { events.push(['cidrs', value]); return ['127.0.0.0/8']; }, directCapable,
    allowedProtocols: () => ['tcp'], directSpec: () => assert.fail('not a direct form test'), stateTone: () => 'good',
    pageCount: (total, limit) => Math.max(1, Math.ceil(total / limit)),
    listResource: (kind, page, filters) => { events.push(['resource', kind, page, filters]); return kind; },
    candidateChoices: rows => rows,
    createRequests(value) {
      state = value; events.push(['createRequests']);
      // In the original composition the lazy version closure precedes the later
      // let initialization. Calling it eagerly here must retain that native TDZ.
      assert.equal(state.scope(), ''); assert.equal(state.token(), ''); assert.throws(() => state.version(), ReferenceError);
      return {
        connected() { events.push(['connected', state.scope(), state.token(), state.version()]);
          if (!state.scope() || !state.token()) throw new Error('missing connection'); },
        async request(method, resource, input) {
          requests.push({ method, resource, input, scope: state.scope(), token: state.token(), version: state.version() });
          if (options.request) return options.request(method, resource, input);
          if(method==='POST'&&resource==='nodes')return {nodeId:'node-created',enrollmentToken:enrollmentSecret,expiresAt:'2099-01-01T00:00:00Z'};
          assert.equal(method,'GET','unexpected write must have an explicit fixture');
          return resource === 'overview' ? { nodes: 0, forwards: 0, activeOperations: 0, failedOperations: 0 }
            : { page: 1, limit: 25, total: 0, items: [] };
        },
        async mutate(method, resource, input) { mutations.push({ method, resource, input });
          if (options.mutate) return options.mutate(method, resource, input);
          return { nodeId: 'node-created', enrollmentToken: enrollmentSecret, expiresAt: '2099-01-01T00:00:00Z' }; },
        clearPending() { events.push(['clearPending', state.scope(), state.token(), state.version()]); },
      };
    },
  };
  for (const name of initializerNames) dependencies[name] = input => {
    events.push([name]); initializers[name] = input;
    const owner = owners[name] = {};
    for (const method of ['clear', 'leave', 'refresh', 'list', 'selectDefinition', 'refreshCandidates', 'edit', 'copy',
      'deployment', 'open', 'openCapabilities', 'loadPathDraft', 'loadDraft', 'openNode', 'openForward', 'retry', 'profileBatch', 'pathBatch', 'catalog', 'page']) owner[method] = function(...args) {
        assert.equal(this, owner); events.push([name, method, ...args]);
        if (method === 'list' || method === 'refresh' || method === 'refreshCandidates') return Promise.resolve();
        return options.ownerResult?.(name, method, args) ?? true;
      };
    return owner;
  };
  assert.equal(mountControlConsole(dependencies), undefined);
  assert.deepEqual(events.map(event => event[0]), ['createRequests', ...initializerNames]);
  assert.equal(state.version(), 0); assert.deepEqual(requests, []); assert.deepEqual(mutations, []);
  const event = (id, name, extra = {}) => {
    let prevented = 0; const callback = byId(id).listeners.get(name); assert.equal(typeof callback, 'function', id + ':' + name);
    const result = callback({ currentTarget: byId(id), preventDefault() { prevented++; }, ...extra });
    return { result, prevented: () => prevented };
  };
  const connect = async (scope = 'scope-a', token = 'x'.repeat(40)) => {
    byId('token').value = ' ' + token + ' ';
    const fired = event('connection-form', 'submit'); await fired.result; assert.equal(fired.prevented(), 1);
    if(state.scope()&&scope!==state.scope()){byId('scope').value=scope;await event('scope','change').result;}
  };
  return { byId, state, initializers, owners, events, requests, mutations, copies, contexts, event, connect, document, navs, views };
}

test('native main module import has no eager DOM clock fetch or credentials effect', () => {
  const target = new URL('../browser-native/control-console.js', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    Object.defineProperty(globalThis, 'document', { get() { throw new Error('eager document'); } });
    Object.defineProperty(globalThis, 'navigator', { get() { throw new Error('eager navigator'); } });
    Date.now = () => { throw new Error('eager time'); };
    globalThis.fetch = () => { throw new Error('eager fetch'); };
    const module = await import(process.argv[1]);
    assert.deepEqual(Object.keys(module), ['mountControlConsole']);
    assert.equal(module.mountControlConsole.length, 1);
  `, target], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr);
});

test('main login validates token then reads account context and enters a real membership; disconnect clears every owner in order', async t => {
  const h = harness(t);
  const registrations = ['connection-form:submit', 'disconnect:click', 'refresh:click', 'show-node-form:click',
    'cancel-node:click', 'node-form:submit', 'show-forward-form:click', 'cancel-forward:click', 'forward-node:change',
    'forward-form:submit', 'close-detail:click', 'detail-dialog:close', 'copy-secret:click',
    'nodes-filter:submit', 'forwards-filter:submit', 'operations-filter:submit',
    'direct-candidate-search:click', 'direct-candidate-prev:click', 'direct-candidate-next:click', 'direct-candidate-prefix:keydown',
    'relay-candidate-search:click', 'relay-candidate-prev:click', 'relay-candidate-next:click', 'relay-candidate-prefix:keydown','relay-candidate-role:change'];
  assert.deepEqual([...h.byId('connection-form').listeners.keys()], ['submit']);
  for (const registration of registrations) {
    const [id, event] = registration.split(':'); assert.equal(typeof h.byId(id).listeners.get(event), 'function', registration);
  }
  assert.equal(typeof h.document.listeners.get('click'), 'function');
  h.events.length = 0;
  await h.connect('scope-a', 'short'); assert.equal(h.state.version(), 0);
  assert.deepEqual(h.requests,[]);assert.deepEqual(h.contexts,[]);assert.deepEqual(h.events,[]);
  assert.match(h.byId('notice').textContent,/Token/);
  await h.connect();
  assert.equal(h.contexts.length,1);
  assert.deepEqual(h.events.filter(event => event[0] === 'clearPending'), [['clearPending', '', '', 1],['clearPending','','x'.repeat(40),2]]);
  assert.deepEqual(h.events.filter(event => event[1] === 'clear').map(event => event[0]), [...clearOrder,...clearOrder]);
  assert.equal(h.state.scope(), 'scope-a'); assert.equal(h.state.token(), 'x'.repeat(40)); assert.equal(h.state.version(), 2);
  assert.equal(h.byId('token').value, ''); assert.equal(h.byId('refresh').disabled, false); assert.equal(h.byId('disconnect').disabled, false);
  assert.deepEqual(h.requests.map(value => value.resource), ['nodes', 'forwards', 'operations', 'overview']);
  for (const request of h.requests) assert.deepEqual([request.method, request.scope, request.token, request.version], ['GET', 'scope-a', 'x'.repeat(40), 2]);
  assert.equal(h.byId('connection-indicator').textContent, '已认证 · scope-a');
  assert.equal(h.navs.find(item=>item.dataset.view==='resources').hidden,true,'manager membership never opens owner governance');
  h.events.length = 0; h.requests.length = 0;
  h.byId('detail-dialog').showModal(); h.byId('deployment-dialog').showModal(); h.byId('detail-content').textContent = 'private';
  h.byId('direct-candidate-prefix').value = 'old-direct'; h.byId('relay-candidate-prefix').value = 'old-relay';
  h.event('disconnect', 'click');
  assert.equal(h.state.scope(), ''); assert.equal(h.state.token(), ''); assert.equal(h.state.version(), 3);
  assert.deepEqual(h.events.filter(event => event[0] === 'clearPending'), [['clearPending', '', '', 3]]);
  assert.deepEqual(h.events.filter(event => event[1] === 'clear').map(event => event[0]), clearOrder);
  assert.deepEqual(h.requests, []); assert.equal(h.byId('detail-dialog').open, false); assert.equal(h.byId('deployment-dialog').open, false);
  assert.equal(h.byId('detail-content').textContent, ''); assert.equal(h.byId('scope').value, ''); assert.equal(h.byId('token').value, '');
  assert.equal(h.byId('refresh').disabled, true); assert.equal(h.byId('disconnect').disabled, true);
  assert.equal(h.byId('connection-indicator').textContent, '未连接');
  for (const kind of ['nodes', 'forwards', 'operations']) assert.equal(h.byId(kind + '-filter').resetCount, 3);
  for (const mode of ['direct', 'relay']) {
    assert.equal(h.byId(mode + '-candidate-prefix').value, ''); assert.equal(h.byId(mode + '-candidate-page').textContent, '尚未查询候选');
    assert.equal(h.byId(mode + '-candidate-prev').disabled, true); assert.equal(h.byId(mode + '-candidate-next').disabled, true);
  }
  assert.equal(h.byId('node-form').hidden, true); assert.equal(h.byId('forward-form').hidden, true);
  for (const key of ['nodes', 'forwards', 'running', 'failed']) assert.equal(h.byId('metric-' + key).textContent, '—');
});

test('main one-time registration secret flows through real node submit copy dialog close failure and disconnect callbacks', async t => {
  const h = harness(t); await h.connect();
  const fields = { address: { value: '127.0.0.1' }, ports: { value: '10001' }, cidrs: { value: '127.0.0.0/8' }, metadata: { checked: false } };
  h.byId('node-form').elements = { namedItem: name => fields[name] };
  h.event('show-node-form', 'click'); assert.equal(h.byId('node-form').hidden, false);
  h.event('cancel-node', 'click'); assert.equal(h.byId('node-form').hidden, true);
  h.events.length = 0; h.requests.length = 0;
  const submitted = h.event('node-form', 'submit'); await submitted.result; assert.equal(submitted.prevented(), 1);
  assert.deepEqual(h.requests.filter(item=>item.method==='POST').map(({method,resource,input})=>({method,resource,input})), [{ method: 'POST', resource: 'nodes', input: { allowedListenerAddresses: ['127.0.0.1'],
    allowedPorts: [10001], allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false, egressPolicyRevision: 1 } }]);
  assert.deepEqual(h.events.filter(event => event[0] === 'ports' || event[0] === 'cidrs'), [['ports', '10001'], ['cidrs', '127.0.0.0/8']]);
  assert.deepEqual(h.requests.map(request => request.resource), ['nodes', 'nodes', 'overview']);
  assert.deepEqual(h.mutations,[],'non-idempotent provision must not use mutation replay');
  assert.equal(h.byId('detail-dialog').open, true); assert.equal(h.byId('detail-secret').hidden, false);
  assert.deepEqual(JSON.parse(h.byId('detail-content').textContent), { nodeId: 'node-created', enrollmentToken: enrollmentSecret, expiresAt: '2099-01-01T00:00:00Z' });
  await h.event('copy-secret', 'click').result; assert.deepEqual(h.copies, [enrollmentSecret]);
  h.event('close-detail', 'click'); assert.equal(h.byId('detail-content').textContent, '');
  await h.event('copy-secret', 'click').result; assert.equal(h.copies.length, 1);
  await h.event('node-form', 'submit').result; h.event('disconnect', 'click');
  await h.event('copy-secret', 'click').result; assert.equal(h.copies.length, 1);
});

test('account records without active membership cannot open a Scope or owner navigation',async t=>{
  const h=harness(t,{context:{actorId:'actor-a',limit:100,scopes:[{scopeId:'scope-a',role:'owner',membership:'inactive',membershipRevision:2,canEnter:false,canManage:false}],truncated:false,nextAfter:null}});
  await h.connect();assert.equal(h.state.scope(),'');assert.equal(h.requests.length,0);
  assert.equal(h.navs.find(item=>item.dataset.view==='resources').hidden,true);
  h.byId('scope').value='scope-a';await h.event('scope','change').result;
  assert.equal(h.state.scope(),'');assert.equal(h.requests.length,0);
  assert.equal(h.byId('refresh').disabled,true);
});

test('unknown private provision results lock a second attempt without fabricating enrollment credentials',async t=>{
  const h=harness(t,{request:async(method,resource)=>{
    if(method==='POST')throw Error('connection interrupted');
    return resource==='overview'?{nodes:0,forwards:0,activeOperations:0,failedOperations:0}:{page:1,limit:25,total:0,items:[]};
  }});await h.connect();h.requests.length=0;
  const fields={address:{value:'127.0.0.1'},ports:{value:'10001'},cidrs:{value:'127.0.0.0/8'},metadata:{checked:false}};
  h.byId('node-form').elements={namedItem:name=>fields[name]};
  await h.event('node-form','submit').result;await h.event('node-form','submit').result;
  assert.equal(h.requests.filter(item=>item.method==='POST').length,1);
  assert.equal(h.byId('node-provision-submit').disabled,true);assert.equal(h.byId('node-provision-reset').hidden,false);
  assert.equal(h.byId('detail-dialog').open,false);assert.equal(h.byId('detail-content').textContent,'');
  assert.deepEqual(h.mutations,[]);
});

test('main clipboard failure and node mutation failure stay bounded and do not fabricate credentials or refresh', async t => {
  const h = harness(t, { copyError: new Error('clipboard unavailable') });
  h.initializers.initRelayConsole.detail('test', {}, 'private-token');
  await h.event('copy-secret', 'click').result;
  assert.match(h.byId('notice').textContent, /复制失败/); assert.equal(h.byId('notice').className, 'notice error');
  h.event('detail-dialog', 'close'); assert.equal(h.byId('detail-content').textContent, '');
  await h.event('copy-secret', 'click').result; assert.equal(h.copies.length, 1);
});

test('main native listeners keep lazy cross-owner callbacks filters navigation paging refresh and clear behavior', async t => {
  const h = harness(t); await h.connect(); h.events.length = 0; h.requests.length = 0;
  const profile = {}, proposal = {}, path = {};
  h.initializers.initRelayConsole.inspectProfile(profile); h.initializers.initRelayConsole.loadCatalog();
  h.initializers.initRelayConsole.inspectTunnel('node-1'); h.initializers.initTransportConsole.edit(profile);
  h.initializers.initTransportConsole.prepareProfileBatch(proposal); h.initializers.initPathSwitch.preparePathBatch(path);
  h.initializers.initTunnelConsole.deployment('forward-1'); h.initializers.initPathTemplates.onSelectDefinition(path);
  assert.deepEqual(h.events, [['initTransportConsole', 'open', profile], ['initTransportConsole', 'catalog'],
    ['initTunnelConsole', 'open', 'node-1'], ['initRelayConsole', 'edit', profile], ['initRuleConsole', 'profileBatch', proposal],
    ['initRuleConsole', 'pathBatch', path], ['initRelayConsole', 'deployment', 'forward-1'], ['initPathSwitch', 'selectDefinition', path]]);
  assert.deepEqual(h.byId('path-switch-title').scrolled, { block: 'start', behavior: 'smooth' });
  for (const initializer of Object.values(h.initializers)) if (initializer.getScope) assert.equal(initializer.getScope(), 'scope-a');
  const relayNav = h.navs.find(node => node.dataset.view === 'relay'); relayNav.listeners.get('click')();
  await Promise.resolve(); assert.ok(h.events.some(event => event[0] === 'initNotificationEndpoints' && event[1] === 'leave'));
  assert.ok(h.events.some(event => event[0] === 'initRelayConsole' && event[1] === 'refresh'));
  assert.ok(h.events.some(event => event[0] === 'initPathTemplates' && event[1] === 'list'));
  assert.equal(h.byId('page-title').textContent, '我的线路');
  for (const kind of ['nodes', 'forwards', 'operations']) {
    h.byId(kind + '-filter').entries = [['query', ' value '], ['empty', '']];
    const submitted = h.event(kind + '-filter', 'submit'); assert.equal(submitted.prevented(), 1); await Promise.resolve();
    assert.ok(h.events.some(event => event[0] === 'resource' && event[1] === kind && event[2] === 1 && event[3].query === 'value'));
  }
  const click = h.document.listeners.get('click');
  const button = action => ({ closest: () => ({ dataset: { action } }) });
  click({ target: button('next-nodes') }); await Promise.resolve();
  assert.ok(h.events.some(event => event[0] === 'resource' && event[1] === 'nodes' && event[2] === 2));
  click({ target: button('prev-nodes') }); await Promise.resolve();
  const count = h.requests.length; click({ target: button('next-unknown') }); click({ target: { closest: () => null } });
  assert.equal(h.requests.length, count);
  h.event('relay-candidate-search', 'click'); h.event('relay-candidate-next', 'click'); h.event('relay-candidate-prev', 'click');
  h.byId('relay-candidate-role').value='egress';h.event('relay-candidate-role','change');
  const key = h.event('relay-candidate-prefix', 'keydown', { key: 'Enter' }); assert.equal(key.prevented(), 1);
  assert.equal(h.events.filter(event => event[0] === 'initRelayConsole' && event[1] === 'refreshCandidates').length, 5);
  h.events.length = 0; h.requests.length = 0;
  await h.event('refresh', 'click').result; assert.deepEqual(h.requests.map(request => request.resource), ['nodes', 'forwards', 'operations', 'overview']);
  h.event('cancel-forward', 'click'); assert.equal(h.byId('forward-form').hidden, true);
  h.event('disconnect', 'click');
  for (const initializer of Object.values(h.initializers)) if (initializer.getScope) assert.equal(initializer.getScope(), '');
});
