import test from 'node:test';
import assert from 'node:assert/strict';
import { initPathTemplates } from '../path-templates.js';

class Element {
  constructor() { this.value='';this.textContent='';this.disabled=false;this.children=[];this.listeners={}; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children=[...items]; }
  addEventListener(event,fn) { this.listeners[event]=fn; }
}
const digest='sha256:'+'a'.repeat(64), profileDigest='sha256:'+'b'.repeat(64);
const config=()=>({version:1,nodes:['ingress','transit','egress'],protocols:['tcp','udp'],
  endpoints:[{nodeId:'transit',revision:3},{nodeId:'egress',revision:4}],transport:{profileId:'profile-a',configRevision:1}});
const record=(extra={})=>({templateId:'path-a',currentRevision:2,revision:2,archived:false,config:config(),
  configDigest:digest,profileDigest,executionAuthorized:false,reserved:false,bindingCreated:false,...extra});
const failure=(status,message='denied')=>Object.assign(Error(message),{httpStatus:status});
function defaultHandler(method,resource,body) {
  if(resource.endsWith('/relay-endpoint')) {
    const nodeId=resource.split('/')[1];return {nodeId,revision:nodeId==='transit'?3:4};
  }
  if(method!=='GET')return {templateId:resource.split('/')[1],revision:body.expectedRevision+(method==='PUT'?1:0),
    configDigest:digest,archived:method==='DELETE',changed:true};
  if(resource.startsWith('path-templates?')) {
    const query=new URLSearchParams(resource.split('?')[1]);return {items:[],total:0,page:Number(query.get('page')),limit:25};
  }
  return record();
}
function harness(handler=defaultHandler,confirm=()=>true) {
  const elements=new Map(),calls=[],notices=[];let keys=0;
  const byId=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const api=initPathTemplates({byId,document:{createElement:()=>new Element()},confirm,randomUUID:()=>`key-${++keys}`,
    request:async(...args)=>{calls.push(args);return handler(...args);},notify:(...args)=>notices.push(args)});
  const el=name=>byId('path-template-'+name);
  const draft=()=>{el('id').value='path-a';el('nodes').value='ingress\ntransit\negress';el('profile').value='profile-a';el('profile-revision').value='1';};
  const click=name=>el(name).listeners.click();
  return {api,calls,notices,el,draft,click,writes:()=>calls.filter(([method])=>method!=='GET')};
}
const buttons=el=>el.children.flatMap(child=>[child,...buttons(child)]).filter(child=>child.listeners.click);

test('template draft captures only ordered exact Endpoint metadata, then publishes detached metadata without a Forward',async()=>{
  const h=harness();h.draft();await h.api.capture();
  assert.deepEqual(h.calls.map(call=>call.slice(0,2)),[['GET','nodes/transit/relay-endpoint'],['GET','nodes/egress/relay-endpoint']]);
  assert.match(h.el('state').textContent,/not reserved or authorized/);
  await h.click('publish');assert.equal(h.writes().length,1);
  const [method,resource,body,key,options]=h.writes()[0];
  assert.equal(method,'PUT');assert.equal(resource,'path-templates/path-a');assert.equal(key,'key-1');
  assert.deepEqual(body,{expectedRevision:0,config:config()});assert.equal(options.timeoutMs,5000);
  assert.equal(h.el('expected').value,'1');assert.match(h.el('state').textContent,/No Forward binding or execution/);
  h.el('nodes').value='changed';assert.deepEqual(body.config,config());
  assert.ok(h.calls.every(([,path])=>!path.includes('forwards')&&!path.includes('relay-plan')));
});

test('same-key same-body replay is explicit and a later denial cannot clear an uncertain original',async()=>{
  let attempts=0;
  const h=harness((method,resource,body)=>{
    if(method==='PUT'){attempts++;if(attempts===1)throw Error('response lost after commit');if(attempts===2)throw failure(403);}
    return defaultHandler(method,resource,body);
  });
  h.draft();await h.api.capture();await h.click('publish');
  assert.match(h.el('state').textContent,/uncertain/);assert.equal(h.el('nodes').disabled,true);
  const original=structuredClone(h.writes()[0].slice(0,4)), reads=h.calls.length;
  await h.click('capture');await h.click('inspect');await h.click('archive');assert.equal(h.calls.length,reads);
  await h.click('publish');assert.match(h.el('state').textContent,/uncertain/);assert.equal(h.el('id').disabled,true);
  await h.click('publish');assert.equal(h.writes().length,3);
  for(const call of h.writes())assert.deepEqual(call.slice(0,4),original);
  assert.equal(h.el('id').disabled,false);assert.equal(h.el('expected').value,'1');
});

test('initial rejection permits a new deliberate command; malformed acceptance stays uncertain',async()=>{
  for(const status of [400,401,403,404,409,413,422,429]) {
    const h=harness((method,resource,body)=>{if(method==='PUT')throw failure(status);return defaultHandler(method,resource,body);});
    h.draft();await h.api.capture();await h.click('publish');
    assert.match(h.el('state').textContent,/Rejected/);assert.equal(h.el('id').disabled,false);assert.equal(h.el('discard').disabled,true);
  }
  const h=harness((method,resource,body)=>method==='PUT'?{...defaultHandler(method,resource,body),revision:55}:defaultHandler(method,resource,body));
  h.draft();await h.api.capture();await h.click('publish');
  assert.match(h.el('state').textContent,/uncertain/);assert.equal(h.el('id').disabled,true);
});

test('inspecting history uses an exact revision and current CAS; no-op and terminal archive preserve history',async()=>{
  const h=harness((method,resource,body)=>method==='PUT'?{templateId:'path-a',revision:2,configDigest:digest,archived:false,changed:false}:
    method==='GET'&&!resource.includes('?page=')&&!resource.endsWith('/relay-endpoint')?record({revision:1}):defaultHandler(method,resource,body));
  h.el('read-revision').value='1';await h.api.inspect('path-a','1');
  assert.equal(h.calls[0][1],'path-templates/path-a?revision=1');assert.equal(h.el('expected').value,'2');
  assert.equal(h.el('profile-revision').value,'1');assert.match(h.el('record').textContent,/"revision": 1/);
  await h.click('publish');assert.equal(h.el('expected').value,'2');assert.equal(h.writes()[0][2].expectedRevision,2);
  await h.click('archive');assert.deepEqual(h.writes()[1].slice(0,4),['DELETE','path-templates/path-a',{expectedRevision:2},'key-2']);
  assert.match(h.el('state').textContent,/Archived r2/);
});

test('form edits invalidate both captured metadata and delayed reads without dispatching a write',async()=>{
  let finish;
  const h=harness((method,resource,body)=>resource.startsWith('path-templates/path-a')?new Promise(resolve=>{finish=resolve;}):defaultHandler(method,resource,body));
  h.draft();await h.api.capture();h.el('nodes').value='ingress\negress';h.el('form').listeners.input();
  await h.click('publish');assert.equal(h.writes().length,0);
  const pending=h.api.inspect('path-a','');h.el('form').listeners.change();finish(record());await pending;
  assert.equal(h.el('record').textContent,'');assert.equal(h.el('nodes').value,'ingress\negress');
  await h.click('publish');assert.equal(h.writes().length,0);
});

test('capture and inspection supersede each other, and failed inspect removes older captured locks',async()=>{
  for(const first of ['capture','inspect']) {
    let finish,delay=true;
    const h=harness((method,resource,body)=>{
      const isFirst=first==='capture'?resource.endsWith('/relay-endpoint'):resource==='path-templates/path-a';
      if(isFirst&&delay)return new Promise(resolve=>{finish=()=>resolve(defaultHandler(method,resource,body));});
      return defaultHandler(method,resource,body);
    });
    h.draft();const pending=first==='capture'?h.api.capture():h.api.inspect('path-a','');delay=false;
    if(first==='capture')await h.api.inspect('path-a','');else await h.api.capture();
    finish();await pending;
    assert.equal(h.el('expected').value,first==='capture'?'2':'0');
    assert.equal(h.el('record').textContent!=='',first==='capture');
  }
  let fail=false;
  const h=harness((method,resource,body)=>{if(fail&&resource==='path-templates/path-a')throw failure(403);return defaultHandler(method,resource,body);});
  h.draft();await h.api.capture();fail=true;await h.api.inspect('path-a','');await h.click('publish');
  assert.equal(h.writes().length,0);assert.equal(h.el('endpoints').textContent,'');
});

test('disconnect or explicit discard aborts pending requests and ignores late accepted outcomes',async()=>{
  for(const action of ['clear','discard']) {
    let finish;
    const h=harness((method,resource,body)=>method==='PUT'?new Promise(resolve=>{finish=()=>resolve(defaultHandler(method,resource,body));}):defaultHandler(method,resource,body));
    h.draft();await h.api.capture();const sending=h.click('publish');
    if(action==='clear')h.api.clear();else await h.click('discard');
    assert.equal(h.writes()[0][4].signal.aborted,true);finish();await sending;
    assert.equal(h.el('id').value,'');assert.equal(h.el('expected').value,'0');assert.equal(h.el('id').disabled,false);
    assert.equal(h.el('rows').children.length,0);assert.match(h.el('state').textContent,/Metadata authoring only/);
  }
});

test('bounded list uses literal prefix and pagination; failed or stale pages leave no older action',async()=>{
  let fail=false;
  const h=harness((method,resource,body)=>{
    if(!resource.startsWith('path-templates?'))return defaultHandler(method,resource,body);
    if(fail)throw failure(403);
    const page=Number(new URLSearchParams(resource.split('?')[1]).get('page'));
    return {page,limit:25,total:26,items:[{templateId:'path-a',currentRevision:2,archived:false}]};
  });
  h.el('prefix').value='path-';await h.click('query');assert.equal(buttons(h.el('rows')).length,1);
  const old=buttons(h.el('rows'))[0];await h.click('next');assert.equal(h.calls.at(-1)[1],'path-templates?page=2&limit=25&prefix=path-');
  assert.equal(h.el('next').disabled,true);await old.listeners.click();assert.equal(h.calls.length,2);
  fail=true;await h.click('query');assert.equal(buttons(h.el('rows')).length,0);assert.equal(h.el('next').disabled,true);
  assert.equal(h.writes().length,0);
});

test('canonical bounds, missing confirmation and malformed metadata fail closed before publication',async()=>{
  const h=harness();h.draft();
  for(const nodes of ['ingress','ingress\ningress',Array.from({length:9},(_,i)=>'n'+i).join('\n')]) {
    h.el('nodes').value=nodes;await h.api.capture();
  }
  h.draft();h.el('profile-revision').value='01';await h.api.capture();assert.equal(h.calls.length,0);
  for(const revision of ['0','01','65','1.5','1&other=2'])await h.api.inspect('path-a',revision);
  assert.equal(h.calls.length,0);
  const malformed=harness(()=>record({revision:1}));await malformed.api.inspect('path-a','');
  assert.equal(malformed.el('record').textContent,'');assert.match(malformed.notices.at(-1)[0],/Invalid immutable/);
  const denied=harness(defaultHandler,()=>false);denied.draft();await denied.api.capture();await denied.click('publish');
  assert.equal(denied.writes().length,0);
});
