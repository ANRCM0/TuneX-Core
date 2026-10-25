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
  reset() { this.resetCount++; for (const field of this.formFields?.values() ?? []) field.value = field.defaultValue; }
  showModal() { this.open = true; }
  close() { if (this.open) { this.open = false; this.listeners.get('close')?.(); } }
  scrollIntoView(options) { this.scrolled = options; }
  focus(options) { this.focused = options ?? {}; this.focusCount = (this.focusCount ?? 0) + 1; }
  setAttribute(name, value) { (this.attributes ??= new Map()).set(name, String(value)); }
  getAttribute(name) { return this.attributes?.get(name) ?? null; }
  click() { return this.listeners.get('click')?.({currentTarget:this,target:this}); }
  querySelectorAll() { return []; }
  querySelector(selector) {
    assert.equal(selector, 'option[value="retain"]');
    return this.children.find(child=>child.value==='retain') ?? null;
  }
}
function harness(t, options = {}) {
  const saved = ['document', 'navigator', 'FormData', 'fetch', 'confirm'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  t.after(() => { for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  } });
  const elements = new Map(), initializers = {}, owners = {}, events = [], requests = [], mutations = [], copies = [];
  const byId = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  byId('token').type='password';
  byId('resource-provision-form').elements=[];
  const retain=new Element('option');retain.value='retain';byId('resource-classify-legacy').append(retain);
  byId('forward-form').elements = { namedItem: name => byId('direct-field-' + name) };
  byId('nodes-filter').elements={namedItem:name=>byId('nodes-' + name)};
  for (const kind of ['forwards','operations']) {
    const form = byId(kind + '-filter'); form.formFields = new Map();
    form.elements = { namedItem(name) {
      if (!form.formFields.has(name)) {
        const defaultValue = name === 'ownership' ? 'mine' : '';
        form.formFields.set(name,{value:defaultValue,defaultValue});
      }
      return form.formFields.get(name);
    } };
  }
  const pageNames=['overview','nodes','available','forwards','relay','probes','operations','resources','members','audit','alerts','notifications','observation-services'];
  const navs = pageNames.map(view => { const item = new Element('nav-' + view); item.dataset.view = view; return item; });
  const governanceNavs=navs.filter(item=>['resources','members','audit','alerts','notifications','observation-services'].includes(item.dataset.view));
  const views = pageNames.filter(view=>view!=='available').map(view => new Element('view-' + view));
  const document = new Element('document');
  Object.assign(document, { getElementById: byId, createElement: tag => new Element(tag),
    querySelectorAll: selector => selector === '.nav' ? navs : selector === '.view' ? views : selector === '[data-governance]' ? governanceNavs : selector === '.table-wrap' ? [] : assert.fail(selector) });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async value => {
    copies.push(value); if (options.copyError) throw options.copyError;
  } } } });
  Object.defineProperty(globalThis, 'confirm', { configurable: true, value: message => options.confirm?.(message) ?? true });
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
    allowedProtocols: () => ['tcp'], directSpec: (...args) => options.directSpec ? options.directSpec(...args) : assert.fail('not a direct form test'), stateTone: () => 'good',
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
      'deployment', 'open', 'openCapabilities', 'loadPathDraft', 'loadDraft', 'openNode', 'openForward', 'retry', 'profileBatch', 'pathBatch', 'catalog', 'page', 'checkbox', 'read']) owner[method] = function(...args) {
        assert.equal(this, owner); events.push([name, method, ...args]);
        if (method === 'checkbox') return new Element('input');
        if (method === 'list' || method === 'refresh' || method === 'refreshCandidates' || method === 'read') return Promise.resolve();
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

function descendants(node) {
  return [node,...node.children.flatMap(descendants)];
}
async function invokeAction(h,node) {
  assert.ok(node,'expected an actionable control');
  h.document.listeners.get('click')({target:{closest:()=>node}});
  await new Promise(resolve=>setImmediate(resolve));
}

test('first-use guidance opens original node and Forward forms without creating records',async t=>{
  const h=harness(t);await h.connect();
  const guide=descendants(h.byId('workflow-guide'));
  assert.equal(guide.filter(node=>node.textContent==='建议下一步').length,1);
  await invokeAction(h,guide.find(node=>node.dataset.action==='workflow-node-create'));
  assert.equal(h.byId('node-form').hidden,false);
  assert.equal(h.byId('node-form').scrolled.block,'start');
  await invokeAction(h,descendants(h.byId('forward-rows')).find(node=>node.dataset.action==='workflow-forward-create'));
  assert.equal(h.byId('forward-form').hidden,false);
  assert.equal(h.byId('save-forward').disabled,true,'missing candidates never enable submission');
  assert.deepEqual(h.mutations,[]);assert.ok(h.requests.every(request=>request.method==='GET'));
  h.event('disconnect','click');
});

test('filtered empty lists offer filter reset instead of suggesting duplicate creation',async t=>{
  const h=harness(t);await h.connect();
  h.byId('forwards-filter').entries=[['idPrefix','absent']];
  h.event('forwards-filter','submit');await new Promise(resolve=>setImmediate(resolve));
  let nodes=descendants(h.byId('forward-rows'));
  assert.ok(nodes.some(node=>node.textContent==='没有符合筛选条件的记录'));
  assert.ok(!nodes.some(node=>node.dataset.action==='workflow-forward-create'));
  const resetsBefore=h.byId('forwards-filter').resetCount;
  await invokeAction(h,nodes.find(node=>node.dataset.action==='workflow-reset-filter'));
  const read=h.events.filter(event=>event[0]==='resource'&&event[1]==='forwards').at(-1);
  assert.equal(read[2],1);assert.deepEqual(read[3],{});
  assert.equal(h.byId('forwards-filter').resetCount,resetsBefore+1);
  nodes=descendants(h.byId('forward-rows'));
  assert.ok(nodes.some(node=>node.dataset.action==='workflow-forward-create'));
  assert.deepEqual(h.mutations,[]);h.event('disconnect','click');
});

test('empty machine lists keep a shared-resource path and disconnected lists expose no write action',async t=>{
  const h=harness(t);
  assert.ok(!descendants(h.byId('node-rows')).some(node=>node.dataset.action));
  await h.connect();
  const choices=descendants(h.byId('node-rows'));
  const own=choices.find(node=>node.dataset.action==='workflow-node-create');
  const shared=choices.find(node=>node.dataset.id==='available');
  await invokeAction(h,shared);
  assert.equal(h.byId('show-node-form').hidden,true);
  assert.ok(descendants(h.byId('node-rows')).some(node=>node.textContent==='当前授权范围没有资源记录'));
  h.event('disconnect','click');const before=h.requests.length;
  await invokeAction(h,own);
  assert.equal(h.requests.length,before);assert.deepEqual(h.mutations,[]);
});

test('clearing filters keeps the available-resource view and reads only the first page of the chosen list',async t=>{
  const h=harness(t);await h.connect();
  await invokeAction(h,descendants(h.byId('node-rows')).find(node=>node.dataset.id==='available'));
  h.byId('nodes-filter').entries=[['ownership','available'],['idPrefix','missing']];
  h.event('nodes-filter','submit');await new Promise(resolve=>setImmediate(resolve));
  await invokeAction(h,descendants(h.byId('node-rows')).find(node=>node.dataset.action==='workflow-reset-filter'));
  const read=h.events.filter(event=>event[0]==='resource'&&event[1]==='nodes').at(-1);
  assert.equal(read[2],1);assert.deepEqual(read[3],{ownership:'available'});
  assert.equal(h.byId('nodes-ownership').value,'available');
  const reset={dataset:{action:'workflow-reset-filter',id:'operations'}};
  await invokeAction(h,reset);
  const operations=h.events.filter(event=>event[0]==='resource'&&event[1]==='operations').at(-1);
  assert.equal(operations[2],1);assert.deepEqual(operations[3],{});
  const count=h.requests.length;
  await invokeAction(h,{dataset:{action:'workflow-reset-filter',id:'not-a-list'}});
  assert.equal(h.requests.length,count);assert.deepEqual(h.mutations,[]);
  h.event('disconnect','click');await invokeAction(h,reset);assert.equal(h.requests.length,count);
});

const managementForward = {
  id:'forward-a',revision:3,recoverySuspended:false,lastOperation:{id:'operation-a',status:'succeeded'},
  spec:{enabled:true,protocols:['tcp'],ingress:{nodeId:'node-a',listen:{address:'127.0.0.1',port:30001}},target:{host:'target.example',port:443}},
};
function managementReply(method,resource) {
  assert.equal(method,'GET','management shortcuts must remain read-only');
  if(resource==='overview')return {nodes:0,forwards:1,activeOperations:0,failedOperations:0};
  if(resource==='forwards/'+managementForward.id)return {};
  const items=resource==='forwards'?[managementForward]:resource==='operations'?[{
    id:'operation-a',forwardId:managementForward.id,targetRevision:3,kind:'update',status:'succeeded',updatedAt:'2026-10-24T00:00:00Z',recoveryInvalidated:false,
  }]:[];
  return {page:1,limit:25,total:items.length,items};
}
const presetButton=id=>({dataset:{action:'list-preset',id}});

test('Forward shortcuts replace intent filters and preserve applied ownership prefix and protocol without a write',async t=>{
  const h=harness(t);await h.connect();
  h.byId('forwards-filter').entries=[['ownership','mine'],['idPrefix','customer'],['protocol','udp'],['enabled','true'],['recoverySuspended','false']];
  h.event('forwards-filter','submit');await new Promise(resolve=>setImmediate(resolve));
  await invokeAction(h,presetButton('forwards-disabled'));
  let read=h.events.filter(event=>event[0]==='resource'&&event[1]==='forwards').at(-1);
  assert.equal(read[2],1);assert.deepEqual(read[3],{ownership:'mine',idPrefix:'customer',protocol:'udp',enabled:'false',recoverySuspended:''});
  assert.equal(h.byId('forwards-filter').elements.namedItem('enabled').value,'false');
  await invokeAction(h,presetButton('forwards-suspended'));
  read=h.events.filter(event=>event[0]==='resource'&&event[1]==='forwards').at(-1);
  assert.equal(read[3].enabled,'');assert.equal(read[3].recoverySuspended,'true');assert.equal(read[3].idPrefix,'customer');
  await invokeAction(h,presetButton('forwards-all'));
  read=h.events.filter(event=>event[0]==='resource'&&event[1]==='forwards').at(-1);
  assert.equal(read[3].enabled,'');assert.equal(read[3].recoverySuspended,'');assert.equal(read[3].protocol,'udp');
  assert.deepEqual(h.mutations,[]);assert.ok(h.requests.every(item=>item.method==='GET'));h.event('disconnect','click');
});

test('a Forward opens its exact execution records and status shortcuts retain the selected rule and kind',async t=>{
  const h=harness(t,{request:managementReply});await h.connect();
  const link=descendants(h.byId('forward-rows')).find(node=>node.dataset.action==='forward-operations');
  await invokeAction(h,link);
  assert.equal(h.byId('page-title').textContent,'执行记录');
  let read=h.events.filter(event=>event[0]==='resource'&&event[1]==='operations').at(-1);
  assert.equal(read[2],1);assert.deepEqual(read[3],{forwardId:'forward-a'});
  assert.equal(h.byId('operations-filter').elements.namedItem('forwardId').value,'forward-a');
  assert.match(h.byId('operations-query-status').textContent,/规则 forward-a 的执行记录/);
  h.byId('operations-filter').entries=[['forwardId','forward-a'],['kind','update'],['status','']];
  h.event('operations-filter','submit');await new Promise(resolve=>setImmediate(resolve));
  await invokeAction(h,presetButton('operations-failed'));
  read=h.events.filter(event=>event[0]==='resource'&&event[1]==='operations').at(-1);
  assert.deepEqual(read[3],{forwardId:'forward-a',kind:'update',status:'failed'});
  const diagnosis=descendants(h.byId('operation-rows')).find(node=>node.dataset.action==='forward-diagnostics');
  await invokeAction(h,diagnosis);
  assert.ok(h.events.some(event=>event[0]==='initForwardDiagnostics'&&event[1]==='open'&&event[2]==='forward-a'));
  assert.deepEqual(h.mutations,[]);h.event('disconnect','click');
});

test('less frequent and destructive Forward actions remain under native details while common actions stay visible',async t=>{
  const h=harness(t,{request:managementReply});await h.connect();
  const row=h.byId('forward-rows').children[0],cell=row.children[6];
  const primary=cell.children[0].children.map(node=>node.dataset.action);
  assert.deepEqual(primary,['forward-diagnostics','forward-edit','forward-toggle']);
  const more=cell.children[1];assert.equal(more.id,'details');assert.equal(more.children[0].textContent,'更多操作');
  assert.equal(more.open,false);
  const actions=descendants(more).filter(node=>node.dataset.action).map(node=>node.dataset.action);
  for(const kind of ['forward-detail','forward-copy','forward-probe','forward-telemetry','forward-delete'])assert.ok(actions.includes(kind));
  assert.equal(actions.includes('forward-deployment'),false,'Direct rows cannot expose Relay deployment');
  assert.ok(!h.requests.some(item=>item.method!=='GET'));h.event('disconnect','click');
});

test('failed or late list reads cannot present retained rows as results of the new query',async t=>{
  let fail=false,release;
  const h=harness(t,{request:(method,resource)=>{
    if(resource==='operations'&&fail)return new Promise((resolve,reject)=>{release=()=>reject(Error('read unavailable'));});
    return managementReply(method,resource);
  }});await h.connect();
  const oldRows=h.byId('operation-rows').children;
  fail=true;
  const read=invokeAction(h,presetButton('operations-failed'));
  assert.match(h.byId('operations-query-status').textContent,/正在读取/);
  release();await read;
  assert.equal(h.byId('operation-rows').children,oldRows);
  assert.match(h.byId('operations-query-status').textContent,/不代表当前筛选结果/);
  const late=invokeAction(h,presetButton('operations-running'));
  h.event('disconnect','click');const cleared=h.byId('operations-query-status').textContent;
  const notice=h.byId('notice').textContent;
  release();await late;assert.equal(h.byId('operations-query-status').textContent,cleared);assert.equal(h.byId('notice').textContent,notice);
  assert.equal(h.byId('operation-rows').children.length,1,'disconnected empty state replaces old records');
  assert.deepEqual(h.mutations,[]);
});

test('shortcuts ignore unrecognized presets and disconnected stale controls without reading or writing',async t=>{
  const h=harness(t);assert.equal(h.byId('forwards-disabled').disabled,true);
  await invokeAction(h,presetButton('forwards-disabled'));assert.equal(h.requests.length,0);
  await h.connect();assert.equal(h.byId('forwards-disabled').disabled,false);
  const count=h.requests.length;
  await invokeAction(h,presetButton('not-a-preset'));assert.equal(h.requests.length,count);
  h.event('disconnect','click');assert.equal(h.byId('operations-failed').disabled,true);
  await invokeAction(h,{dataset:{action:'forward-operations',id:'forward-a'}});
  assert.equal(h.requests.length,count);assert.deepEqual(h.mutations,[]);
});

const writeReceipt = h => JSON.parse(h.byId('forward-write-detail').textContent);
const forwardControl = (h,kind) => descendants(h.byId('forward-rows')).find(node=>node.dataset.action===kind);
const nextTurn = () => new Promise(resolve=>setImmediate(resolve));
const writeAccepted = {forwardId:'forward-a',revision:4,operationId:'operation-change'};

test('single-rule changes block duplicate clicks until the original request and refresh finish',async t=>{
  let release;
  const h=harness(t,{request:managementReply,mutate:()=>new Promise(resolve=>{release=()=>resolve(writeAccepted);})});
  await h.connect();const toggle=forwardControl(h,'forward-toggle');
  await invokeAction(h,toggle);
  assert.equal(h.mutations.length,1);assert.equal(toggle.disabled,true);
  assert.equal(h.byId('show-forward-form').disabled,true);assert.equal(h.byId('forward-write-dismiss').disabled,true);
  assert.equal(h.byId('forward-write-result').dataset.state,'sending');
  await invokeAction(h,toggle);h.event('forward-write-dismiss','click');
  assert.equal(h.mutations.length,1);assert.equal(h.byId('forward-write-result').hidden,false);
  assert.deepEqual(h.mutations[0],{method:'PUT',resource:'forwards/forward-a',input:{expectedRevision:3,spec:{...managementForward.spec,enabled:false}}});
  release();await nextTurn();
  assert.equal(h.byId('forward-write-result').dataset.state,'accepted');
  assert.equal(forwardControl(h,'forward-toggle').disabled,false);assert.equal(h.mutations.length,1);
  h.event('disconnect','click');
});

test('an accepted command retains its receipt when the following list read fails and manual refresh sends no replacement',async t=>{
  let fail=false;
  const h=harness(t,{request:(method,resource)=>{if(fail&&resource==='forwards')throw Error('read failed');return managementReply(method,resource);},
    mutate:async()=>{fail=true;return writeAccepted;}});
  await h.connect();await invokeAction(h,forwardControl(h,'forward-toggle'));
  assert.equal(h.byId('forward-write-result').dataset.state,'accepted');
  assert.match(h.byId('forward-write-message').textContent,/请求已接收/);
  assert.match(h.byId('forward-write-message').textContent,/列表刷新失败，原回执已保留/);
  assert.deepEqual(writeReceipt(h).result,writeAccepted);
  fail=false;await h.event('refresh','click').result;
  assert.equal(h.mutations.length,1);assert.deepEqual(writeReceipt(h).result,writeAccepted);
  assert.doesNotMatch(h.byId('forward-write-message').textContent,/列表刷新失败/);
  h.event('forward-write-records','click');await nextTurn();
  const read=h.events.filter(event=>event[0]==='resource'&&event[1]==='operations').at(-1);
  assert.deepEqual(read[3],{forwardId:'forward-a'});assert.equal(h.mutations.length,1);h.event('disconnect','click');
});

test('unknown write outcomes keep the original command visible and require explicit acknowledgement before another single write',async t=>{
  let allow=false;
  const h=harness(t,{request:managementReply,mutate:async()=>{throw Error('response lost');},confirm:()=>allow});
  await h.connect();await invokeAction(h,forwardControl(h,'forward-toggle'));
  assert.equal(h.byId('forward-write-result').dataset.state,'unknown');
  assert.match(h.byId('forward-write-message').textContent,/可能已经被接收/);
  const original=writeReceipt(h);assert.equal(original.input.expectedRevision,3);assert.equal(original.input.spec.enabled,false);
  await invokeAction(h,forwardControl(h,'forward-delete'));await invokeAction(h,forwardControl(h,'forward-toggle'));
  h.event('forward-write-dismiss','click');assert.equal(h.byId('forward-write-result').hidden,false);
  assert.equal(h.mutations.length,1);assert.deepEqual(writeReceipt(h),original);
  allow=true;h.event('forward-write-dismiss','click');assert.equal(h.byId('forward-write-result').hidden,true);
  assert.equal(h.mutations.length,1,'acknowledgement cannot send a command or clear request-owner keys');
  assert.equal(forwardControl(h,'forward-toggle').disabled,false);h.event('disconnect','click');
});

test('definite rejection is distinct from uncertainty and preserves the original reason without claiming applied state',async t=>{
  const h=harness(t,{request:managementReply,mutate:async()=>{throw Object.assign(Error('REVISION_CONFLICT'),{httpStatus:409});}});
  await h.connect();await invokeAction(h,forwardControl(h,'forward-toggle'));
  assert.equal(h.byId('forward-write-result').dataset.state,'rejected');
  assert.match(h.byId('forward-write-message').textContent,/请求被拒绝/);
  assert.equal(writeReceipt(h).error,'REVISION_CONFLICT');assert.equal(writeReceipt(h).result,null);
  assert.equal(forwardControl(h,'forward-toggle').disabled,false);assert.equal(h.mutations.length,1);h.event('disconnect','click');
});

test('a no-change acceptance keeps the current revision and does not invent a deployment operation',async t=>{
  const h=harness(t,{request:managementReply,mutate:async()=>({forwardId:'forward-a',revision:3,operationId:null})});
  await h.connect();await invokeAction(h,forwardControl(h,'forward-toggle'));
  assert.equal(h.byId('forward-write-result').dataset.state,'accepted');
  assert.match(h.byId('forward-write-message').textContent,/没有产生新的部署操作/);
  assert.deepEqual(writeReceipt(h).result,{forwardId:'forward-a',revision:3,operationId:null});
  assert.equal(h.mutations.length,1);h.event('disconnect','click');
});

test('malformed acceptance stays unknown without replaying a request whose original key may have been retired',async t=>{
  const h=harness(t,{request:managementReply,mutate:async()=>({...writeAccepted,forwardId:'another-rule'})});
  await h.connect();await invokeAction(h,forwardControl(h,'forward-toggle'));
  assert.equal(h.byId('forward-write-result').dataset.state,'unknown');
  assert.match(writeReceipt(h).error,/回执与原请求不匹配/);
  await invokeAction(h,forwardControl(h,'forward-toggle'));assert.equal(h.mutations.length,1);
  h.event('forward-write-records','click');await nextTurn();
  const read=h.events.filter(event=>event[0]==='resource'&&event[1]==='operations').at(-1);
  assert.deepEqual(read[3],{forwardId:'forward-a'},'unknown receipts cannot replace the original rule identity');
  h.event('disconnect','click');
});

test('delete receipt still links to original execution records after the rule disappears from the list',async t=>{
  let deleted=false;
  const h=harness(t,{request:(method,resource)=>deleted&&resource==='forwards'?{page:1,limit:25,total:0,items:[]}:managementReply(method,resource),
    mutate:async()=>{deleted=true;return writeAccepted;}});
  await h.connect();await invokeAction(h,forwardControl(h,'forward-delete'));
  assert.equal(h.mutations[0].method,'DELETE');assert.deepEqual(h.mutations[0].input,{expectedRevision:3});
  assert.equal(h.byId('forward-write-result').dataset.state,'accepted');
  assert.equal(h.byId('forward-write-records').disabled,false);h.event('forward-write-records','click');await nextTurn();
  assert.equal(h.byId('page-title').textContent,'执行记录');
  const read=h.events.filter(event=>event[0]==='resource'&&event[1]==='operations').at(-1);
  assert.deepEqual(read[3],{forwardId:'forward-a'});assert.equal(h.mutations.length,1);h.event('disconnect','click');
});

test('disconnect clears local write memory and late acceptance cannot refresh lists or resurrect its receipt',async t=>{
  let release;
  const h=harness(t,{request:managementReply,mutate:()=>new Promise(resolve=>{release=()=>resolve(writeAccepted);})});
  await h.connect();await invokeAction(h,forwardControl(h,'forward-toggle'));
  h.event('disconnect','click');const reads=h.requests.length,notice=h.byId('notice').textContent;
  release();await nextTurn();
  assert.equal(h.requests.length,reads);assert.equal(h.byId('forward-write-result').hidden,true);
  assert.equal(h.byId('forward-write-detail').textContent,'');assert.equal(h.byId('notice').textContent,notice);
});

test('Direct form submits once, closes only after acceptance and retains the create receipt through refresh failure',async t=>{
  let release,accepted=false;
  const node={id:'node-a',canUse:true,allowedRoles:null,policy:{capabilities:['adp.3','native.direct.v1','tcp'],allowedListenerAddresses:['127.0.0.1'],allowedPorts:[30001]}};
  const h=harness(t,{directSpec:()=>structuredClone(managementForward.spec),request:(method,resource)=>{
    if(resource==='nodes/candidates')return {page:1,limit:25,total:1,items:[node]};
    if(accepted&&resource==='forwards')throw Error('list unavailable');return managementReply(method,resource);
  },mutate:()=>new Promise(resolve=>{release=()=>{accepted=true;resolve({forwardId:'created-forward',revision:1,operationId:'operation-create'});};})});
  await h.connect();h.byId('forward-node').value='node-a';await h.event('show-forward-form','click').result;
  const fields=Object.fromEntries(Object.entries({node:'node-a',protocol:'tcp',listenAddress:'127.0.0.1',listenPort:'30001',targetHost:'target.example',targetPort:'443'}).map(([name,value])=>[name,Object.assign(new Element(name),{value})]));
  fields.enabled=Object.assign(new Element('enabled'),{checked:true});
  h.byId('forward-form').elements={namedItem:name=>fields[name]};
  const first=h.event('forward-form','submit');await h.event('forward-form','submit').result;
  assert.equal(h.mutations.length,1);assert.equal(h.byId('forward-form').hidden,false);
  fields.targetHost.value='edited-after-send';
  release();await first.result;
  assert.equal(h.byId('forward-form').hidden,true);assert.equal(h.byId('forward-write-result').dataset.state,'accepted');
  assert.equal(writeReceipt(h).input.target.host,'target.example');assert.equal(writeReceipt(h).result.forwardId,'created-forward');
  assert.match(h.byId('forward-write-message').textContent,/列表刷新失败/);assert.equal(h.mutations.length,1);h.event('disconnect','click');
});

const ownerContext={actorId:'actor-a',limit:100,scopes:[{scopeId:'scope-a',role:'owner',membership:'active',membershipRevision:1,canEnter:true,canManage:true}],truncated:false,nextAfter:null};
async function navigate(h,view) {
  const nav=h.navs.find(node=>node.dataset.view===view);assert.ok(nav);nav.click();await nextTurn();return nav;
}

test('every page gives its own guidance, active navigation and an explicit refresh scope without issuing mutations',async t=>{
  const h=harness(t,{context:ownerContext});await h.connect();
  const pages={overview:'运行概览',nodes:'我的机器',available:'可用资源',forwards:'我的转发',relay:'我的线路',probes:'受限探测',operations:'执行记录',
    resources:'共享资源管理',members:'工作空间成员',audit:'管理审计',alerts:'站内事件',notifications:'通知配置与投递','observation-services':'观测服务声明'};
  const independent=new Set(['probes','audit','alerts','notifications','observation-services']);
  for(const [view,title] of Object.entries(pages)){
    const before=h.byId('page-title').focusCount??0;
    const nav=await navigate(h,view);
    assert.equal(h.byId('page-title').textContent,title);assert.ok(h.byId('page-guidance').textContent.length>10);
    assert.equal(nav.ariaCurrent,'page');assert.equal(h.navs.filter(node=>node.ariaCurrent==='page').length,1);
    assert.equal(h.byId('page-title').focusCount,before+1);
    assert.equal(h.byId('refresh').disabled,independent.has(view));
    if(independent.has(view))assert.equal(h.byId('refresh').textContent,'使用页内读取');
    assert.equal(h.byId('read-session-start').disabled,!['overview','nodes','available','forwards','operations'].includes(view));
  }
  assert.ok(h.requests.every(read=>read.method==='GET'));assert.deepEqual(h.mutations,[]);h.event('disconnect','click');
});

test('topbar refresh reads the selected core list and retains the available-resource ownership filter',async t=>{
  const h=harness(t);await h.connect();
  for(const [view,resource]of [['nodes','nodes'],['available','nodes'],['forwards','forwards'],['operations','operations']]){
    await navigate(h,view);h.requests.length=0;h.events.length=0;
    await h.event('refresh','click').result;
    assert.deepEqual(h.requests.map(read=>read.resource),[resource]);
    if(view==='available')assert.equal(h.events.find(event=>event[0]==='resource')[3].ownership,'available');
  }
  await navigate(h,'probes');const count=h.requests.length;
  await h.event('refresh','click').result;assert.equal(h.requests.length,count,'a disabled global read cannot issue a probe');
  assert.deepEqual(h.mutations,[]);h.event('disconnect','click');
});

test('long-page section navigation only scrolls and focuses anchors belonging to that page',async t=>{
  const h=harness(t,{context:ownerContext});await h.connect();
  for(const view of ['overview','nodes','relay','probes','resources','members','audit','alerts','notifications','observation-services']){
    await navigate(h,view);const controls=[...h.byId('page-sections').children];
    assert.ok(controls.length>=2,view+' needs meaningful sections');
    const reads=h.requests.length;
    for(const control of controls){
      await invokeAction(h,control);const target=h.byId(control.dataset.id);
      assert.deepEqual(target.scrolled,{block:'start'});assert.equal(target.tabIndex,-1);assert.ok(target.focused);
    }
    assert.equal(h.requests.length,reads,view+' anchors cannot query or mutate');
  }
  await navigate(h,'nodes');
  await invokeAction(h,h.byId('page-sections').children.find(node=>node.dataset.id==='node-enrollment-guide'));
  assert.equal(h.byId('node-enrollment-guide').open,true);
  const before=h.byId('relay-forward-title').focusCount??0,reads=h.requests.length;
  await invokeAction(h,{dataset:{action:'page-section',id:'relay-forward-title'}});
  assert.equal(h.byId('relay-forward-title').focusCount??0,before);assert.equal(h.requests.length,reads);
  assert.deepEqual(h.mutations,[]);h.event('disconnect','click');
});

test('login waits once, masks the token and disconnect fences a late context response',async t=>{
  let release;
  const h=harness(t,{context:new Promise(resolve=>{release=resolve;})});
  h.byId('token').value='x'.repeat(40);h.event('token-reveal','click');
  assert.equal(h.byId('token').type,'text');assert.equal(h.byId('token-reveal').ariaPressed,'true');
  const pending=h.event('connection-form','submit');
  assert.equal(h.byId('connect').disabled,true);assert.equal(h.byId('token').disabled,true);
  assert.equal(h.byId('token').type,'password');assert.equal(h.byId('token').value,'');
  await h.event('connection-form','submit').result;assert.equal(h.contexts.length,1);
  h.event('disconnect','click');assert.equal(h.byId('connect').disabled,false);assert.equal(h.byId('token-reveal').disabled,false);
  const notice=h.byId('notice').textContent;release(ownerContext);await pending.result;
  assert.equal(h.state.scope(),'');assert.equal(h.requests.length,0);assert.equal(h.byId('notice').textContent,notice);
  assert.equal(h.byId('token').type,'password');assert.equal(h.byId('token-reveal').ariaPressed,'false');
});

test('topbar duplicate reads and late failures cannot unlock a different page or overwrite a disconnect notice',async t=>{
  let reading=false,release;
  const h=harness(t,{request:(method,resource)=>{
    if(reading&&resource==='forwards')return new Promise((resolve,reject)=>{release=()=>reject(Error('old read failed'));});
    return managementReply(method,resource);
  }});await h.connect();await navigate(h,'forwards');h.requests.length=0;reading=true;
  const pending=h.event('refresh','click');await h.event('refresh','click').result;
  assert.equal(h.requests.length,1);assert.equal(h.byId('refresh').disabled,true);
  h.event('disconnect','click');const notice=h.byId('notice').textContent;
  release();await pending.result;
  assert.equal(h.byId('notice').textContent,notice);assert.equal(h.byId('refresh').disabled,true);
  assert.match(h.byId('page-guidance').textContent,/先登录/);
});

test('line resource loading prevents repeated reads and paging until its bounded request set finishes',async t=>{
  let release;
  const h=harness(t,{request:(method,resource)=>{
    if(resource==='transport-profiles')return new Promise(resolve=>{release=()=>resolve({profiles:[]});});
    if(resource.startsWith('nodes/candidates?mode=relay&role='))return {page:1,limit:25,total:0,items:[]};
    return managementReply(method,resource);
  }});await h.connect();h.requests.length=0;
  const pending=h.event('line-resources-refresh','click');
  await h.event('line-resources-refresh','click').result;await h.event('line-ingress-next','click').result;
  assert.equal(h.requests.length,4);assert.equal(h.byId('line-resources-refresh').disabled,true);
  assert.equal(h.byId('line-ingress-next').disabled,true);assert.equal(h.byId('line-use').disabled,true);
  release();await pending.result;
  assert.equal(h.byId('line-resources-refresh').disabled,false);assert.equal(h.byId('line-ingress-next').disabled,true);
  assert.deepEqual(h.mutations,[]);h.event('disconnect','click');
});

test('disconnect invalidates delayed line resource reads without repopulating canvas profiles or enabling paging',async t=>{
  let release;
  const h=harness(t,{request:(method,resource)=>{
    if(resource==='transport-profiles')return new Promise(resolve=>{release=resolve;});
    if(resource.startsWith('nodes/candidates?mode=relay&role='))return {page:1,limit:25,total:0,items:[]};
    return managementReply(method,resource);
  }});await h.connect();
  const reading=h.event('line-resources-refresh','click');h.event('disconnect','click');
  const message=h.byId('line-builder-status').textContent;
  release({profiles:[{profileId:'old-scope-profile',currentRevision:1}]});await reading.result;
  assert.equal(h.byId('line-profile').children.length,1);
  assert.equal(h.byId('line-builder-status').textContent,message);
  for(const role of ['ingress','transit','egress'])assert.equal(h.byId('line-'+role+'-next').disabled,true);
  assert.deepEqual(h.mutations,[]);
});

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
  await h.event('refresh', 'click').result; assert.deepEqual(h.requests, []);
  assert.deepEqual(h.events,[['connected','scope-a','x'.repeat(40),h.state.version()],['initPathTemplates','list']]);
  h.event('cancel-forward', 'click'); assert.equal(h.byId('forward-form').hidden, true);
  h.event('disconnect', 'click');
  for (const initializer of Object.values(h.initializers)) if (initializer.getScope) assert.equal(initializer.getScope(), '');
});
