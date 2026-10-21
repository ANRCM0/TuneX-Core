import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { initTelemetryAggregateConsole } from '../telemetry-aggregate-console.js';

const now=Date.parse('2026-10-21T12:00:30.000Z');
const retention={minuteSeconds:604800,hourSeconds:2592000,maxMinuteRowsPerNodeFamily:10081,maxHourRowsPerNodeFamily:721,
  maxCursorRowsPerNodeFamily:512,maxMinuteRowsPerScope:500000,maxHourRowsPerScope:50000,maxCursorRowsPerScope:16384,
  maxNodeFamiliesPerScope:4096,maxBucketBytes:8192,maxCursorBytes:8192,maxQueryPoints:512,cursorSeconds:86400};
const countKeys=['minuteEvicted','hourEvicted','cursorEvicted','cursorExpired'];
const withheld=()=>({scope:'withheld-scope-family',...Object.fromEntries(countKeys.map(key=>[key,null]))});
const visible=scope=>({scope,minuteEvicted:'9007199254740993',hourEvicted:'0',cursorEvicted:'2',cursorExpired:'3'});
const canonical=value=>value!==null&&typeof value==='object'?
  '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);
function sparseForwardBucket(){
  const series={family:'forward',nodeId:'node-a',bootId:'boot-a',sessionEpoch:1,sampleEpoch:'a'.repeat(32),counterEpoch:'b'.repeat(32),
    execution:{nodeId:'node-a',bootId:'boot-a',sessionEpoch:1,assignmentId:'assignment-a',forwardId:'forward-a',forwardRevision:1,
      deploymentGeneration:1,bindingFence:1,role:'direct',protocol:'tcp',driverId:'native.direct.v1',driverSchemaVersion:1,
      configDigest:'sha256:'+'c'.repeat(64),resource:{protocol:'tcp',address:'127.0.0.1',port:25565}}};
  const start=Math.floor(now/60000)*60000;
  return {body:{telemetryAggregateVersion:1,scopeId:'scope-a',nodeId:'node-a',forwardId:'forward-a',family:'forward',
    seriesKey:'sha256:'+createHash('sha256').update(canonical(series)).digest('hex'),series,resolution:'minute',start,end:start+60000,
    sampleCount:1,receivedFrom:start+1000,receivedTo:start+2000,capturedFrom:start+500,capturedTo:start+1500,
    quality:{baseline:1,continuous:0,gap:0,counterReset:0,unavailable:0,overflowed:0,terminal:0,truncated:0,
      exporterDropsMax:'0',tailsEvictedMax:'0',tailsExpiredMax:'0',historyComplete:false},
    coverage:{intervalCount:0,elapsedMs:0,from:null,to:null,boundaryIntervals:0,attribution:'receipt-interval-end'},
    gauges:{},cumulative:{},increments:{}},recoverySuspended:false};
}
function response(resource,losses,items=[]){
  const match=resource.match(/^(nodes|forwards)\/([^/]+)\/telemetry\/aggregates\?/);
  assert.ok(match,'unexpected aggregate resource '+resource);
  const query=new URLSearchParams(resource.split('?')[1]);
  return {telemetryAggregateVersion:1,target:{kind:match[1]==='nodes'?'node':'forward',id:match[2]},family:query.get('family'),
    enabled:true,source:'agent-reported',health:'unknown',executionAuthorized:false,observedAt:new Date(now).toISOString(),
    window:{from:query.get('from'),to:query.get('to'),resolution:query.get('resolution'),limit:Number(query.get('limit')),
      seriesKey:query.get('seriesKey'),after:query.get('after'),nextAfter:null,truncated:false},retention:{...retention},losses,items};
}
class Element{
  constructor(tag='div'){this.tag=tag;this.value='';this.textContent='';this.children=[];this.listeners={};this.disabled=false;this.open=false;}
  append(...children){for(const child of children){this.children.push(child);if(this.tag==='select'&&this.children.length===1)this.value=child.value;}}
  replaceChildren(...children){this.children=[];if(this.tag==='select')this.value='';this.append(...children);}
  addEventListener(name,callback){this.listeners[name]=callback;}
  querySelector(selector){
    const match=selector.match(/^option\[value="([^"]+)"\]$/);assert.ok(match,'unexpected aggregate selector '+selector);
    return this.children.find(child=>child.tag==='option'&&child.value===match[1])??null;
  }
  get firstChild(){return this.children[0]??null;}
  showModal(){this.open=true;}
  close(){if(this.open){this.open=false;this.listeners.close?.();}}
}
function harness(handler){
  const names=['family','resolution','range','limit','series','reload','next','capacity','close','dialog','rows','meta','capacity-output','state','title'];
  const elements=new Map(names.map(name=>['telemetry-aggregate-'+name,new Element(['family','resolution','range','limit'].includes(name)?'select':'div')]));
  const byId=id=>{assert.ok(elements.has(id),'unexpected aggregate element '+id);return elements.get(id);};
  const el=name=>byId('telemetry-aggregate-'+name),calls=[],notices=[];
  for(const value of ['3600000','86400000','604800000','2592000000']){const option=new Element('option');option.value=value;el('range').append(option);}
  el('limit').value='128';
  const api=initTelemetryAggregateConsole({byId,getScope:()=>'scope-a',document:{createElement:tag=>new Element(tag)},
    notify:(...args)=>notices.push(args),request:async(...args)=>{
      calls.push(args);assert.equal(args[0],'GET');return handler(args[1]);
    }});
  return {api,el,calls,notices,open:kind=>api[kind==='node'?'openNode':'openForward'](kind+'-a'),read:()=>el('reload').listeners.click()};
}
const text=element=>[element.textContent,...element.children.map(text)].join('\n');

test('personal Forward aggregates accept four withheld null counters and keep empty history distinct from zero',async t=>{
  t.mock.method(Date,'now',()=>now);
  const h=harness(resource=>response(resource,withheld()));h.open('forward');assert.equal(h.calls.length,0);await h.read();
  assert.equal(h.notices.length,0);assert.equal(h.calls.length,1);
  assert.equal(h.calls[0][2],undefined);assert.equal(h.calls[0][3],undefined);assert.equal(h.calls[0][4].timeoutMs,5000);
  assert.match(h.el('meta').textContent,/withheld-scope-family/);assert.match(h.el('meta').textContent,/不可见，不表示零损失/);
  assert.doesNotMatch(h.el('meta').textContent,/minute evicted=|hour evicted=|cursors evicted=|cursors expired=/);
  assert.match(text(h.el('rows')),/缺测、不可用、淘汰或未启用均不是零/);
  assert.match(h.el('state').textContent,/health=unknown; executionAuthorized=false/);assert.equal(h.el('next').disabled,true);
});

test('withheld Scope totals do not turn missing Forward metrics or rates into zeroes',async t=>{
  t.mock.method(Date,'now',()=>now);
  const h=harness(resource=>response(resource,withheld(),[sparseForwardBucket()]));h.open('forward');await h.read();
  assert.equal(h.notices.length,0);assert.equal(h.el('rows').children.length,1);
  const rendered=text(h.el('rows'));
  assert.match(rendered,/payloadSentBytes: 不可用 \/ 无合格观察（不是零）/);
  assert.match(rendered,/payloadReceivedBytes 合格区间速率: 不可计算（不是零）/);
  assert.doesNotMatch(rendered,/delta sum=0|0\.000 B\/s/);
  assert.match(rendered,/Coverage start: unavailable/);assert.match(h.el('meta').textContent,/不表示零损失/);
});

test('authorized Node and Scope loss counters preserve their exact decimal strings and scope labels',async t=>{
  t.mock.method(Date,'now',()=>now);
  for(const [kind,scope] of [['node','node-family'],['forward','scope-family']]){
    const losses=visible(scope),h=harness(resource=>response(resource,losses));h.open(kind);await h.read();
    assert.equal(h.notices.length,0);assert.match(h.el('meta').textContent,new RegExp('淘汰统计范围='+scope));
    assert.match(h.el('meta').textContent,/minute evicted=9007199254740993/);assert.match(h.el('meta').textContent,/hour evicted=0/);
    assert.match(h.el('meta').textContent,/cursors evicted=2; cursors expired=3/);assert.doesNotMatch(h.el('meta').textContent,/不表示零损失/);
  }
});

test('missing, mixed or wrongly typed withheld totals reject the response and clear previous output',async t=>{
  t.mock.method(Date,'now',()=>now);
  const mutations=[
    value=>{delete value.losses;},value=>{value.losses=null;},value=>{delete value.losses.cursorExpired;},
    value=>{value.losses.otherActorTotal='0';},
    ...countKeys.flatMap(key=>[0,'0',false,undefined].map(wrong=>value=>{value.losses[key]=wrong;})),
    value=>{value.losses={...withheld(),scope:'scope-family'};},
    value=>{value.losses={...withheld(),scope:'node-family'};},
    value=>{value.losses={...visible('scope-family'),cursorExpired:null};},
    value=>{value.losses={...visible('scope-family'),cursorExpired:0};},
    value=>{value.losses={...visible('scope-family'),cursorExpired:'-1'};},
    value=>{value.losses={...visible('scope-family'),cursorExpired:'01'};},
  ];
  for(const mutate of mutations){
    let changed=false;
    const h=harness(resource=>{const value=response(resource,withheld(),[sparseForwardBucket()]);if(changed)mutate(value);return value;});
    h.open('forward');await h.read();assert.equal(h.notices.length,0);assert.match(text(h.el('rows')),/payloadSentBytes/);
    changed=true;await h.read();
    assert.equal(h.notices.length,1);assert.equal(h.calls.length,2);assert.equal(h.el('rows').children.length,0);
    for(const name of ['meta','capacity-output'])assert.equal(h.el(name).textContent,'');
    assert.equal(h.el('next').disabled,true);assert.match(h.el('state').textContent,/不可用，不推导零值或健康/);
  }
});

test('Node aggregates cannot relabel withheld Scope totals as Node family counters',async t=>{
  t.mock.method(Date,'now',()=>now);
  const h=harness(resource=>response(resource,withheld()));h.open('node');await h.read();
  assert.equal(h.notices.length,1);assert.equal(h.el('rows').children.length,0);assert.equal(h.el('meta').textContent,'');
  assert.equal(h.el('next').disabled,true);
});
