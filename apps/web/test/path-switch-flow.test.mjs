import test from 'node:test';
import assert from 'node:assert/strict';
import { initPathSwitch } from '../path-templates.js';

class Element {
  constructor(){this.value='';this.textContent='';this.disabled=false;this.children=[];this.listeners={};}
  append(...values){this.children.push(...values);}
  replaceChildren(...values){this.children=[...values];}
  addEventListener(event,fn){this.listeners[event]=fn;}
}
const hash='sha256:'+'a'.repeat(64),profileDigest='sha256:'+'b'.repeat(64);
const config=()=>({version:1,nodes:['ingress','egress'],protocols:['tcp','udp'],endpoints:[{nodeId:'egress',revision:2}],transport:{profileId:'profile',configRevision:1}});
const selection=()=>({templateId:'path',revision:2,configDigest:hash});
const spec=()=>({enabled:true,protocols:['tcp','udp'],ingress:{nodeId:'ingress',listen:{address:'127.0.0.1',port:32001}},
  target:{host:'127.0.0.1',port:9000},path:{via:['middle','egress']},transport:{profileId:'profile',configRevision:1}});
const proposed=()=>({...spec(),path:{via:['egress']}});
const immutable=()=>({...selection(),currentRevision:3,archived:false,config:config(),profileDigest,executionAuthorized:false,bindingCreated:false,reserved:false});
const preview=()=>({forwardId:'forward',expectedRevision:4,template:selection(),spec:spec(),proposedSpec:proposed(),changed:true,
  previewOnly:true,reserved:false,executionAuthorized:false,fullPlanAuthorization:false});
const plan=()=>({reserved:false,executionSupported:false,runtimeEnabled:true,profile:{profileId:'profile',revision:1,configDigest:profileDigest}});
const acceptance=()=>({forwardId:'forward',revision:5,operationId:'operation',pathBinding:{...selection(),sequence:1,forwardRevision:5,changed:true}});
const fail=(status,message='Denied')=>Object.assign(Error(message),{httpStatus:status});
function handler(method,path){
  if(path==='path-templates/path?revision=2')return immutable();
  if(path==='forwards/forward/path-preview')return preview();
  if(path==='relay-plan')return plan();
  if(method==='PUT')return acceptance();
  if(path==='forwards/forward/path-binding')return {forwardId:'forward',revision:4,deleting:false,recoverySuspended:false,binding:null,history:[],reserved:false,executionAuthorized:false};
  if(path.startsWith('path-templates/path/references?'))return {...preview(),templateId:'path',target:{...selection(),config:config()},page:Number(new URLSearchParams(path.split('?')[1]).get('page')),limit:25,total:26,
    items:[{forwardId:'forward',expectedRevision:4,binding:{...selection(),revision:1},spec:spec(),proposedSpec:proposed(),changed:true,unavailableReason:null,recoverySuspended:false}]};
  throw Error('Unexpected request '+method+' '+path);
}
function harness(run=handler,confirm=()=>true){
  const elements=new Map(),calls=[],notices=[];let keys=0;
  const byId=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const api=initPathSwitch({byId,document:{createElement:()=>new Element()},confirm,randomUUID:()=>`key-${++keys}`,
    request:async(...args)=>{calls.push(args);return run(...args);},notify:(...args)=>notices.push(args)});
  const el=name=>byId('path-switch-'+name),click=name=>el(name).listeners.click();
  const draft=()=>{el('forward').value='forward';el('expected').value='4';el('template').value='path';el('revision').value='2';};
  const ready=async()=>{draft();await api.lock();await api.prepare();assert.equal(el('submit').disabled,false);};
  return {api,el,calls,notices,click,draft,ready,writes:()=>calls.filter(([method])=>method==='PUT')};
}
const buttons=el=>el.children.flatMap(child=>[child,...buttons(child)]).filter(child=>child.listeners.click);

test('exact revision inspection plus non-reserving proposal creates no write, then fresh original plan precedes one frozen same-transaction command',async()=>{
  const h=harness();await h.ready();assert.equal(h.writes().length,0);
  assert.deepEqual(h.calls.map(value=>value.slice(0,2)),[['GET','path-templates/path?revision=2'],['POST','forwards/forward/path-preview']]);
  await h.click('submit');assert.equal(h.writes().length,1);
  assert.deepEqual(h.calls.slice(-2).map(value=>value.slice(0,2)),[['POST','relay-plan'],['PUT','forwards/forward/path-binding']]);
  assert.deepEqual(h.calls.at(-2)[2],proposed());assert.deepEqual(h.writes()[0].slice(0,4),['PUT','forwards/forward/path-binding',{expectedRevision:4,template:selection()},'key-1']);
  assert.equal(h.writes()[0][4].timeoutMs,5000);assert.equal(h.el('expected').value,'5');assert.match(h.el('state').textContent,/Accepted original Operation/);
  h.el('template').value='changed';assert.equal(h.writes()[0][2].template.templateId,'path');
});

test('lost committed result and later replay denial retain the original key/body with no new plan or automatic CAS/revision replacement',async()=>{
  let attempts=0;
  const h=harness((method,path,...args)=>{if(method==='PUT'){attempts++;if(attempts===1)throw Error('Lost committed result');if(attempts===2)throw fail(403);}return handler(method,path,...args);});
  await h.ready();await h.click('submit');assert.equal(h.el('forward').disabled,true);assert.match(h.el('state').textContent,/uncertain/);
  const count=h.calls.length;await h.click('lock');await h.click('current');await h.click('prepare');await h.click('references');assert.equal(h.calls.length,count);
  await h.click('submit');assert.match(h.el('state').textContent,/uncertain/);assert.equal(h.el('expected').value,'4');
  await h.click('submit');assert.equal(h.writes().length,3);
  for(const call of h.writes())assert.deepEqual(call.slice(0,4),h.writes()[0].slice(0,4));
  assert.equal(h.calls.filter(([,path])=>path==='relay-plan').length,1);assert.equal(h.el('forward').disabled,false);
});

test('unknown preflight, mismatched Profile, disabled gate or malformed plan cannot dispatch a path write and requires fresh proposal/consent',async()=>{
  for(const run of [()=>{throw Error('Timeout');},()=>({...plan(),reserved:true}),()=>({...plan(),runtimeEnabled:false}),
    ()=>({...plan(),profile:{...plan().profile,configDigest:hash}}),()=>({...plan(),executionSupported:true})]){
    const h=harness((method,path,...args)=>path==='relay-plan'?run():handler(method,path,...args));await h.ready();await h.click('submit');
    assert.equal(h.writes().length,0);assert.equal(h.el('forward').disabled,false);assert.equal(h.el('submit').disabled,true);
    assert.match(h.el('state').textContent,/Preflight failed/);
  }
});

test('complete initial client rejection permits deliberate new proposal; malformed accepted response stays uncertain',async()=>{
  for(const status of [400,401,403,404,409,413,422,429]){
    const h=harness((method,path,...args)=>{if(method==='PUT')throw fail(status);return handler(method,path,...args);});await h.ready();await h.click('submit');
    assert.equal(h.writes().length,1);assert.equal(h.el('forward').disabled,false);assert.equal(h.el('submit').disabled,true);assert.match(h.el('state').textContent,/rejected/);
  }
  for(const bad of [{...acceptance(),revision:99},{...acceptance(),pathBinding:{...acceptance().pathBinding,configDigest:profileDigest}},
    {...acceptance(),operationId:null}]){
    const h=harness((method,path,...args)=>method==='PUT'?bad:handler(method,path,...args));await h.ready();await h.click('submit');
    assert.equal(h.el('forward').disabled,true);assert.match(h.el('state').textContent,/uncertain/);
  }
});

test('equivalent expanded spec accepts provenance without pretending an Operation ran',async()=>{
  const h=harness((method,path,...args)=>path.endsWith('/path-preview')?{...preview(),spec:proposed(),changed:false}:
    method==='PUT'?{...acceptance(),revision:4,operationId:null,pathBinding:{...acceptance().pathBinding,forwardRevision:4}}:handler(method,path,...args));
  await h.ready();await h.click('submit');assert.equal(h.el('expected').value,'4');assert.match(h.el('state').textContent,/without a deployment Operation/);
});

test('form edits invalidate delayed exact reads/proposals; malformed preview cannot change target/listener/enabled/protocols',async()=>{
  for(const mutate of [value=>{value.proposedSpec.target.port=9001;},value=>{value.proposedSpec.enabled=false;},
    value=>{value.proposedSpec.ingress.listen.port=32002;},value=>{value.spec.protocols=['tcp'];},value=>{value.template.revision=3;}]){
    const h=harness((method,path,...args)=>{const value=handler(method,path,...args);if(path.endsWith('/path-preview'))mutate(value);return value;});
    h.draft();await h.api.lock();await h.api.prepare();assert.equal(h.el('submit').disabled,true);assert.equal(h.writes().length,0);
  }
  let finish;const h=harness((method,path,...args)=>path.includes('?revision=2')?new Promise(resolve=>{finish=()=>resolve(immutable());}):handler(method,path,...args));
  h.draft();const pending=h.api.lock();h.el('revision').value='3';h.el('revision').listeners.input();finish();await pending;
  assert.equal(h.el('digest').value,'');await h.api.prepare();assert.equal(h.el('submit').disabled,true);
});

test('disconnect/discard aborts a pending plan or path request and drops all late transitions',async()=>{
  for(const delayed of ['relay-plan','forwards/forward/path-binding'])for(const discard of [false,true]){
    let finish;
    const h=harness((method,path,...args)=>path===delayed&&method!=='GET'?new Promise(resolve=>{finish=()=>resolve(handler(method,path,...args));}):handler(method,path,...args));
    await h.ready();const pending=h.click('submit');
    if(delayed!=='relay-plan'){await new Promise(resolve=>setImmediate(resolve));}
    if(discard)await h.click('discard');else h.api.clear();
    const inflight=h.calls.find(([method,path])=>path===delayed&&method!=='GET');assert.equal(inflight[4].signal.aborted,true);
    finish();await pending;assert.equal(h.el('forward').value,'');assert.equal(h.el('record').textContent,'');assert.equal(h.el('submit').disabled,true);
    assert.equal(h.writes().length,delayed==='relay-plan'?0:1);
  }
});

test('bounded reference paging has no write; stale and failed row actions are invalidated and selection still needs a fresh proposal',async()=>{
  let denied=false;
  const h=harness((method,path,...args)=>{if(denied&&path.includes('/references?'))throw fail(403);return handler(method,path,...args);});
  h.draft();await h.api.lock();await h.api.references();assert.equal(h.writes().length,0);
  const old=buttons(h.el('rows'))[0];await h.click('next');assert.equal(h.el('next').disabled,true);
  assert.match(h.calls.at(-1)[1],/page=2&limit=25&targetRevision=2/);h.el('forward').value='other';
  await old.listeners.click();assert.equal(h.el('forward').value,'other');
  await buttons(h.el('rows'))[0].listeners.click();assert.equal(h.el('forward').value,'forward');assert.equal(h.el('submit').disabled,true);
  denied=true;await h.click('references');assert.equal(h.el('rows').children.length,0);assert.equal(h.el('next').disabled,true);
  assert.equal(h.calls.filter(([method])=>method!=='GET').length,0);
});

test('current provenance lookup only fills explicit CAS; invalid identities/exact revisions and no consent never write',async()=>{
  const h=harness();h.el('forward').value='forward';await h.api.current();assert.equal(h.el('expected').value,'4');assert.equal(h.writes().length,0);
  h.el('template').value='path';for(const revision of ['','0','01','65','1.5']){h.el('revision').value=revision;await h.api.lock();}
  assert.equal(h.calls.length,1);
  const denied=harness(handler,()=>false);await denied.ready();await denied.click('submit');assert.equal(denied.writes().length,0);
  assert.equal(denied.calls.some(([,path])=>path==='relay-plan'),false);
});
