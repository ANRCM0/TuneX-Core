import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { initProbePlans } from '../probe-plans.js';

const now = Date.parse('2026-10-21T12:00:00.000Z');
const limits = { plansPerScope:32, decisionsPerPlan:16, maxLifetimeMs:3600000, retentionMs:604800000,
  minIntervalSeconds:30, maxIntervalSeconds:3600, defaultPageSize:25, maxPageSize:50,
  maxPlanBytes:4096, maxDecisionBytes:2048, maxResponseBytes:262144 };
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value !== null && typeof value === 'object' ?
  '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const digest = value => 'sha256:' + createHash('sha256').update(canonical(value)).digest('hex');
function plan() {
  const config = { version:1, kind:'tcp-connect', forwardId:'forward-a', expectedForwardRevision:1,
    timeoutMs:500, mode:'manual', intervalSeconds:null, maxRuns:2, expiresAt:now + 600000 };
  const head = { id:'plan-a', scopeId:'scope-a', createdBy:'actor-a', createdAt:now - 10000, config, configDigest:digest(config),
    originBinding:{ nodeId:'node-a', bootId:'boot-a', sessionEpoch:1, snapshotGeneration:1, assignmentId:'assignment-a',
      forwardId:'forward-a', forwardRevision:1, deploymentGeneration:1, bindingFence:1,
      configDigest:'sha256:' + 'a'.repeat(64), egressPolicyRevision:1 },
    revision:1, state:'active', decisionCount:0, acceptedCount:0, nextRunAt:0, updatedAt:now - 10000,
    cancelledBy:null, cancelledAt:null, lastCode:null, recoverySuspended:false };
  return { ...head, expired:false, remainingRuns:2, health:'unknown', executionAuthorized:false,
    originBindingCurrent:'not-evaluated', configStoredOnly:true, contentDigest:digest(head) };
}
function response(resource, losses) {
  const envelope = { probePlansVersion:1, scopeId:'scope-a', capturedAt:now, source:'persisted-probe-plans',
    readOnly:true, executionAuthorized:false, health:'unknown', networkCheck:'not-performed-by-read',
    consistency:'read-committed-not-global-snapshot', historyComplete:false,
    executionEnabled:false, ingressExecutionEnabled:false, servicesExecutionEnabled:false, scheduleEnabled:false,
    workerState:'disabled', limits:{...limits}, losses };
  if (resource === 'probe-plans/plan-a') return { ...envelope, plan:plan(), decisions:[] };
  assert.match(resource, /^probe-plans\?/);
  const query = new URLSearchParams(resource.split('?')[1]);
  return { ...envelope, window:{from:Date.parse(query.get('from')),to:Date.parse(query.get('to'))},
    filters:Object.fromEntries(['forwardId','mode','state'].map(key => [key,query.get(key)])),
    limit:Number(query.get('limit')), items:[plan()], hasMore:false, nextCursor:null };
}
class Element {
  constructor(tag = 'div') {
    this.tag=tag; this.value=''; this.checked=false; this.disabled=false; this.textContent='';
    this.children=[]; this.listeners={}; this.dataset={};
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children=[...children]; }
  addEventListener(name, callback) { this.listeners[name]=callback; }
  querySelectorAll(selector) {
    assert.equal(selector,'button');
    return this.children.flatMap(child=>[...(child.tag==='button'?[child]:[]),...child.querySelectorAll(selector)]);
  }
}
function harness(handler) {
  const elements=new Map(), calls=[], notices=[];
  const names=['kind','forward','forward-revision','timeout','mode','interval','max-runs','expires','delegation',
    'service-id','service-revision','service-config-revision','service-digest','from','to','limit',
    'filter-forward','filter-mode','filter-state','id','preview','list','read','next','create','run','cancel',
    'cancel-read','replay','clear','rows','decisions','preview-output','record','receipt','meta','losses','message'];
  for(const name of names)elements.set('probe-plan-'+name,new Element());
  const byId=id=>{assert.ok(elements.has(id),'unexpected ProbePlan element '+id);return elements.get(id);};
  initProbePlans({ byId, getScope:()=>'scope-a', document:{createElement:tag=>new Element(tag)},
    confirm:()=>assert.fail('history reads must not ask to issue commands'), randomUUID:()=>assert.fail('history reads must not create command keys'),
    notify:(...args)=>notices.push(args), request:async(...args)=>{
      calls.push(args);assert.equal(args[0],'GET');return handler(args[1]);
    } });
  const el=name=>byId('probe-plan-'+name);
  return {el,calls,notices,read:kind=>{el('id').value='plan-a';return el(kind==='detail'?'read':'list').listeners.click();}};
}
const text = element => [element.textContent,...element.children.map(text)].join('\n');

test('personal plan list and detail accept withheld loss totals without inventing zero counters',async t=>{
  t.mock.method(Date,'now',()=>now);
  for(const kind of ['list','detail']){
    const h=harness(resource=>response(resource,null));assert.equal(h.calls.length,0);await h.read(kind);
    assert.equal(h.notices.length,0);assert.equal(h.calls.length,1);
    assert.match(h.el('losses').textContent,/不可见/);assert.match(h.el('losses').textContent,/不表示零损失/);
    assert.doesNotMatch(h.el('losses').textContent,/rowsExpired|rowsEvicted|decisionsEvicted/);
    assert.match(h.el('meta').textContent,/health=unknown; executionAuthorized=false/);
    if(kind==='detail'){
      assert.match(h.el('record').textContent,/plan-a/);
      assert.match(text(h.el('decisions')),/No recorded decisions/);
      assert.match(text(h.el('decisions')),/not a Probe result or execution proof/);
    }else assert.match(text(h.el('rows')),/plan-a/);
  }
});

test('visible plan loss counters retain the reported zero and positive values as Scope totals',async t=>{
  t.mock.method(Date,'now',()=>now);
  const losses={rowsExpired:7,rowsEvicted:0,decisionsEvicted:11};
  for(const kind of ['list','detail']){
    const h=harness(resource=>response(resource,losses));await h.read(kind);
    assert.equal(h.notices.length,0);assert.match(h.el('losses').textContent,/Scope-wide cumulative loss counters/);
    assert.match(h.el('losses').textContent,/not this query or completeness proof/);
    assert.deepEqual(JSON.parse(h.el('losses').textContent.split('\n').slice(1).join('\n')),losses);
  }
});

test('malformed plan loss totals reject both read shapes and clear previously accepted data and command CAS',async t=>{
  t.mock.method(Date,'now',()=>now);
  const mutations=[
    value=>{delete value.losses;}, value=>{value.losses={};},
    value=>{value.losses={rowsExpired:null,rowsEvicted:null,decisionsEvicted:null};},
    value=>{value.losses={rowsExpired:'0',rowsEvicted:0,decisionsEvicted:0};},
    value=>{value.losses={rowsExpired:-1,rowsEvicted:0,decisionsEvicted:0};},
    value=>{value.losses={rowsExpired:0,rowsEvicted:0.5,decisionsEvicted:0};},
    value=>{value.losses={rowsExpired:0,rowsEvicted:0,decisionsEvicted:false};},
    value=>{value.losses={rowsExpired:0,rowsEvicted:0,decisionsEvicted:0,otherActorTotal:0};},
  ];
  for(const kind of ['list','detail'])for(const mutate of mutations){
    let changed=false;
    const h=harness(resource=>{const value=response(resource,null);if(changed)mutate(value);return value;});
    await h.read(kind);assert.equal(h.notices.length,0);
    changed=true;await h.read(kind);
    assert.equal(h.notices.length,1);assert.equal(h.calls.length,2);
    for(const name of ['meta','losses','record','receipt','preview-output'])assert.equal(h.el(name).textContent,'');
    assert.equal(h.el('rows').children.length,0);assert.equal(h.el('decisions').children.length,0);
    for(const name of ['create','run','cancel','next'])assert.equal(h.el(name).disabled,true);
    assert.match(h.el('message').textContent,/no execution or health conclusion/);
  }
});
