import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuleCommands } from '../rule-command-owner/public.js';

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function harness(overrides={}) {
  const trace=[], notices=[];
  const view={consented:()=>true,render(){trace.push('render');},clearConsent(){trace.push('consent');},clear(){},resetInputs(){},selectionState(){},show(){}};
  const effects={id:value=>typeof value==='string'&&value.length>0,revision:Number.isSafeInteger,hash:()=>true,
    clone:value=>JSON.parse(JSON.stringify(value)),encode:encodeURIComponent,newKey:()=> 'key',confirm:()=>true,
    newAbort:()=>new AbortController(),options:abort=>({signal:abort.signal}),aborted:abort=>abort?.signal.aborted===true,
    throwIfAborted:abort=>abort.signal.throwIfAborted(),abort:abort=>abort?.abort(),completeRejection:error=>error?.definite===true,
    errorText:error=>error.message,ordered:value=>value,json:JSON.stringify,checkedAt:()=> 'checked'};
  const request=async()=>{trace.push('request');return {forwardId:'f',revision:2,operationId:'op'};};
  const refresh=async()=>trace.push('refresh');
  const api=createRuleCommands({request:overrides.request??request,notify:(...args)=>{notices.push(args);trace.push('notify');overrides.notify?.(...args);},refresh:overrides.refresh??refresh,view:Object.assign(view,overrides.view),effects:Object.assign(effects,overrides.effects)});
  const row={forwardId:'f',expectedRevision:1,method:'PUT',resource:'forwards/f',input:{expectedRevision:1,spec:{enabled:true}},key:'original-key',state:'pending',result:null,error:''};
  api.state.plan={rows:[row]};return {api,row,trace,notices,view,effects};
}

test('Rule dispatch finally clears consent renders and awaits refresh while retaining exact accepted result',async()=>{
  const gate=deferred();let h;h=harness({refresh:()=>{h.trace.push('refresh');assert.equal(h.api.state.active,false);assert.equal(h.api.state.controller,null);return gate.promise;}});
  let settled=false;const pending=h.api.dispatch().then(()=>{settled=true;});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(settled,false);assert.deepEqual(h.trace,['render','render','request','render','consent','render','refresh']);
  assert.equal(h.row.state,'accepted');assert.deepEqual(h.row.result,{forwardId:'f',revision:2,operationId:'op'});
  assert.equal(h.row.key,'original-key');gate.resolve();await pending;assert.equal(settled,true);
});

test('Rule failed list refresh keeps accepted rejected and uncertain results and issues only bounded manual-refresh notice',async()=>{
  for(const kind of ['accepted','rejected','uncertain','unchanged']) {
    const failure=Error('refresh failed');let writes=0;
    const h=harness({request:async()=>{writes++;if(kind==='rejected')throw Object.assign(Error('denied'),{definite:true});if(kind==='uncertain')throw Error('lost');return {forwardId:'f',revision:kind==='unchanged'?1:2,operationId:kind==='unchanged'?null:'op'};},refresh:async()=>{throw failure;}});
    await h.api.dispatch();assert.equal(h.row.state,kind);assert.equal(writes,1);assert.equal(h.row.key,'original-key');
    assert.equal(h.api.state.active,false);assert.equal(h.api.state.controller,null);
    assert.deepEqual(h.notices,[['Command results retained; list refresh failed. Refresh manually, not by issuing replacements.',true]]);
    assert.deepEqual(h.trace.slice(-3),['consent','render','notify']);
  }
});

test('Rule generation changes suppress stale finally and late refresh rejection notifications',async()=>{
  const requestGate=deferred();let refreshed=0;
  const h=harness({request:()=>requestGate.promise,refresh:async()=>{refreshed++;}});
  const pending=h.api.dispatch();h.api.clear();const afterClear=[...h.trace];requestGate.resolve({forwardId:'f',revision:2,operationId:'op'});await pending;
  assert.deepEqual(h.trace,afterClear);assert.equal(refreshed,0);assert.equal(h.api.state.plan,null);assert.equal(h.row.result,null);
  const refreshGate=deferred();const b=harness({refresh:()=>refreshGate.promise});const completion=b.api.dispatch();
  await new Promise(resolve=>setImmediate(resolve));b.api.clear();refreshGate.reject(Error('late failure'));await completion;assert.deepEqual(b.notices,[]);
});

test('Rule original view and notify exceptions preserve finally precedence without replacing commands',async()=>{
  for(const stage of ['initial-render','final-render','consent','notify']) {
    const error=Error(stage);let renders=0,refreshes=0;
    const h=harness({view:{render(){renders++;if((stage==='initial-render'&&renders===1)||(stage==='final-render'&&renders===4))throw error;},clearConsent(){if(stage==='consent')throw error;}},
      refresh:async()=>{refreshes++;if(stage==='notify')throw Error('refresh');},notify(){if(stage==='notify')throw error;}});
    await assert.rejects(h.api.dispatch(),caught=>caught===error);
    assert.equal(h.api.state.active,false);assert.equal(h.api.state.controller,null);assert.equal(h.row.key,'original-key');
    assert.equal(refreshes,stage==='initial-render'||stage==='notify'?1:0);
    assert.equal(h.row.result===null,stage==='initial-render');
  }
});

test('Rule effect failures before write and while projecting acceptance keep original uncertain classification',async()=>{
  for(const stage of ['abort','clone','options','acceptance']) {
    let writes=0,clones=0;
    const h=harness({request:async()=>{writes++;if(stage==='acceptance')return {get forwardId(){throw Error('acceptance');}};return {forwardId:'f',revision:2,operationId:'op'};},
      effects:{throwIfAborted:abort=>{if(stage==='abort')throw Error('abort check');abort.signal.throwIfAborted();},clone:value=>{clones++;if(stage==='clone')throw Error('clone');return value;},options:()=>{if(stage==='options')throw Error('options');return {};}}});
    await h.api.dispatch();assert.equal(h.row.state,stage==='abort'?'preflight-failed':'uncertain');
    assert.equal(writes,stage==='acceptance'?1:0);assert.equal(h.api.state.active,false);assert.equal(h.api.state.controller,null);
    assert.equal(h.row.result,null);assert.equal(h.row.key,'original-key');assert.deepEqual(h.trace.slice(-3),['consent','render','refresh']);
    if(stage==='clone')assert.equal(clones,1);
  }
});
