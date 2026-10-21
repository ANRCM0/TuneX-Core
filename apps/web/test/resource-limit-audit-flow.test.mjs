import test from 'node:test';
import assert from 'node:assert/strict';
import { initAuditConsole } from '../audit-console.js';

const now=Date.parse('2026-10-21T12:00:00.000Z');
const sources=['access','node-security','forward-ownership','resource-limits','transport','path-template','path-binding','path-group','path-group-binding',
  'path-publication','path-publication-attempt','ingress-group','ingress-deployment','ingress-deployment-attempt','ingress-migration','ingress-migration-attempt','operation'];
class Element {
  constructor(tag='div'){this.tag=tag;this.value='';this.textContent='';this.children=[];this.listeners={};this.disabled=false;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  addEventListener(name,callback){this.listeners[name]=callback;}
}
const text=element=>[element.textContent,...element.children.map(text)].join('\n');
function row(source='resource-limits'){
  const value={occurredAt:new Date(now-1000).toISOString(),source,key:'sha256:'+'a'.repeat(64),kind:'configure',recordType:'owner-event',
    timeMeaning:'recorded-at',actorId:'administrator',actorAttribution:'initiator',subjectId:'member',entityKind:'node',entityId:'node',
    revision:2,revisionKind:'resource',sequence:null,position:null,nodeId:'node',nodeAssociation:'explicit-node',forwardId:null,
    operationId:null,outcome:'recorded',errorCode:null,retryable:null,recoveryInvalidated:null};
  if(source==='node-security')return {...value,kind:'resource_classification',subjectId:null};
  if(source==='forward-ownership')return {...value,kind:'classify-owner',entityKind:'forward',entityId:'forward',revisionKind:'forward',
    nodeId:null,nodeAssociation:'immutable-forward-spec',forwardId:'forward'};
  return value;
}
function response(resource,items){
  const query=new URLSearchParams(resource.split('?')[1]),filters={};
  for(const name of ['actorId','nodeId','forwardId','operationId','errorCode','source'])if(query.has(name))filters[name]=query.get(name);
  return {auditVersion:1,scopeId:'scope',capturedAt:new Date(now).toISOString(),window:{from:query.get('from'),to:query.get('to')},
    filters,limit:Number(query.get('limit')),items,nextCursor:null,hasMore:false,
    coverage:{sources:filters.source?[filters.source]:sources,completeness:'existing-owner-records-only',retention:'source-owned-no-common-retention',
      operationHistory:'latest-state-not-transition-log',relatedRows:'not-independent-command-count',nodeFilter:'explicit-node-or-immutable-owned-config',
      associations:'explicit-single-value-only-not-exhaustive-relations',globalRecovery:'excluded-no-scope-attribution',ordering:'occurredAt-desc-source-desc-key-desc',
      queryCost:'bounded-output-not-verified-sql-cost'},
    limits:{defaultWindowMs:86400000,maxWindowMs:2678400000,maxPageSize:50,maxResponseBytes:131072,activeRequests:2,actorKeys:128,cooldownMs:1000},
    source:'persisted-owner-records',readOnly:true,executionAuthorized:false,health:'unknown',networkCheck:'not-performed',consistency:'read-committed-not-global-snapshot'};
}
function harness(handler){
  const names=['read','cancel','next','rows','meta','coverage','from','to','limit','actorId','nodeId','forwardId','operationId','errorCode','source','state','form','clear'];
  const elements=new Map(names.map(name=>['audit-'+name,new Element(['source','errorCode'].includes(name)?'select':'div')]));
  const el=name=>elements.get('audit-'+name),calls=[],notices=[];
  const api=initAuditConsole({byId:id=>{assert.ok(elements.has(id),id);return elements.get(id);},getScope:()=>'scope',
    document:{createElement:tag=>new Element(tag)},notify:(...args)=>notices.push(args),request:async(...args)=>{calls.push(args);return handler(args[1]);}});
  return {api,el,calls,notices,read:()=>el('form').listeners.submit({preventDefault(){}})};
}

test('resource policy audit remains a manual GET and renders administrator, beneficiary and immutable resource revision',async t=>{
  t.mock.method(Date,'now',()=>now);
  const h=harness(resource=>response(resource,[row()]));
  assert.equal(h.calls.length,0);
  assert.ok(h.el('source').children.some(option=>option.value==='resource-limits'));
  assert.ok(h.el('source').children.some(option=>option.value==='forward-ownership'));
  h.el('source').value='resource-limits';h.el('nodeId').value='node';h.el('actorId').value='administrator';
  await h.read();
  assert.equal(h.notices.length,0);assert.equal(h.calls.length,1);
  assert.equal(h.calls[0][0],'GET');assert.equal(h.calls[0][2],undefined);assert.equal(h.calls[0][3],undefined);
  assert.equal(h.calls[0][4].timeoutMs,5000);
  const query=new URLSearchParams(h.calls[0][1].split('?')[1]);
  assert.equal(query.get('source'),'resource-limits');assert.equal(query.get('nodeId'),'node');assert.equal(query.get('actorId'),'administrator');
  assert.match(text(h.el('rows')),/resource-limits\nconfigure\nowner-event/);
  assert.match(text(h.el('rows')),/actor=administrator\ninitiator\nsubject=member/);
  assert.match(text(h.el('rows')),/revision=2 \/ resource/);
  assert.match(text(h.el('rows')),/node=node\nexplicit-node/);
  assert.equal(h.el('next').disabled,true);
  assert.match(h.el('meta').textContent,/health=unknown \/ executionAuthorized=false/);
});

test('existing ownership and Node resource classification events survive strict Web response validation',async t=>{
  t.mock.method(Date,'now',()=>now);
  for(const source of ['forward-ownership','node-security']){
    const h=harness(resource=>response(resource,[row(source)]));h.el('source').value=source;await h.read();
    assert.equal(h.notices.length,0,source);
    assert.match(text(h.el('rows')),new RegExp(source==='forward-ownership'?'classify-owner':'resource_classification'));
    assert.match(text(h.el('rows')),new RegExp(source==='forward-ownership'?'revision=2 / forward':'revision=2 / resource'));
  }
  const all=harness(resource=>response(resource,[row()]));await all.read();
  assert.equal(all.notices.length,0);assert.deepEqual(JSON.parse(all.el('coverage').textContent).sources,sources);
});

test('resource audit refuses misattributed or malformed resource rows and clears prior results',async t=>{
  t.mock.method(Date,'now',()=>now);
  const mutations=[value=>{value.kind='member_change';},value=>{value.revisionKind='config';},value=>{value.revision=null;},
    value=>{value.subjectId=null;},value=>{value.nodeId='another-node';},value=>{value.entityKind='forward';},
    value=>{value.nodeAssociation='immutable-forward-spec';value.nodeId=null;},value=>{value.actorAttribution='unattributed';value.actorId=null;},
    value=>{value.forwardId='invented-forward';},value=>{value.operationId='invented-operation';},value=>{value.usedBytes=0;}];
  for(const mutate of mutations){
    let changed=false;
    const h=harness(resource=>{const item=row();if(changed)mutate(item);return response(resource,[item]);});
    h.el('source').value='resource-limits';h.el('nodeId').value='node';await h.read();assert.equal(h.notices.length,0);
    changed=true;await h.read();
    assert.equal(h.notices.length,1);assert.equal(h.el('rows').children.length,0);assert.equal(h.el('meta').textContent,'');
    assert.equal(h.el('next').disabled,true);
  }
});

test('new source filter changes invalidate old pages and authorization failure does not become an empty history',async t=>{
  t.mock.method(Date,'now',()=>now);
  let denied=false;
  const h=harness(resource=>{if(denied)throw Object.assign(new Error('owner required'),{httpStatus:403});return response(resource,[row()]);});
  h.el('source').value='resource-limits';await h.read();assert.equal(h.el('rows').children.length,1);
  h.el('source').listeners.change();assert.equal(h.el('rows').children.length,0);assert.equal(h.calls.length,1);
  denied=true;await h.read();assert.equal(h.notices.length,1);assert.equal(h.el('rows').children.length,0);
  assert.match(h.el('state').textContent,/需要当前 Scope 管理权限/);assert.equal(h.el('next').disabled,true);
});
