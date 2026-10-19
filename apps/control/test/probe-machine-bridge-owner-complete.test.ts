import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { test } from 'node:test';
import { ControlError } from '../src/framework/public.ts';
import * as Public from '../src/modules/probe-owner/public.ts';
import { ProbeClaims } from '../src/application/probe-claims.ts';
import { ProbeDelivery } from '../src/application/probe-delivery.ts';
import { ProbeResults } from '../src/application/probe-results.ts';
import { ProbeTypes } from '../src/application/probe-types.ts';
import { ProbeServices } from '../src/application/probe-services.ts';

type Any=Record<string,any>;
const at=1800000000000;
function load(file:string,dependencies:Any):Any {const out:Any={},source=readFileSync(new URL('../src/modules/probe-owner/'+file+'.ts',import.meta.url),'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new vm.Script('(function(exports,require){'+code+'\n})').runInThisContext()(out,(name:string)=>{assert.ok(name in dependencies,name);return dependencies[name];});return out;}
function fixture(family:'claims'|'delivery'|'results'|'types'|'services',explicit=true){
 const trace:string[]=[],calls:any[][]=[],failure=new Error('native bridge failure'),ack={originalAck:true},binding={nodeId:'node',bootId:'boot',sessionEpoch:2},request:Any={nodeId:'node',sessionEpoch:2,bootId:'boot',permitId:'permit',instanceId:'instance',instanceGeneration:3,measurement:'tcp-connect-v1',service:null,validUntil:at+1000};
 const state:Any={now:at,observedAt:at,checkedAt:at,acceptedAt:at,closedAt:at,expiresAt:at+1000,id:'permit',instanceId:'instance',instanceGeneration:3,state:'consumed',binding,executionEnabled:false,offer:null,resultDigest:'digest',duplicate:false,serviceContext:undefined,parserFailure:false,ownerFailure:false,ackFailure:false,measureFailure:false,lazy:true,sourceCalls:0};
 const native:Any={nativeJsonEncode(value:unknown){trace.push('encode');return JSON.stringify(value);},nativeWallClockSource(){trace.push('source');state.sourceCalls++;const captured=state.now;return ()=>{trace.push('clock');return explicit?state.now:captured;};},nativeParseTime(value:unknown){trace.push('parse-time');return value;},nativeValueDigest(value:unknown){trace.push('selection-digest');return JSON.stringify(value);},parseProbeServiceContext(value:unknown){trace.push('context-parse');if(state.contextFailure)throw failure;return value;},probeServiceSelection(value:unknown){trace.push('selection');return value;}};
 for(const parser of ['parseProbeClaim','parseProbeDelivery','parseProbeResult','parseProbeTypes','parseProbeServices'])native[parser]=(kind:string,json:string)=>{trace.push('parse:'+kind);if(state.parserFailure)throw failure;return JSON.parse(json);};
 for(const digest of ['probeResultDigest','probeTypesResultDigest','probeServicesResultDigest'])native[digest]=(value:unknown)=>{trace.push('digest');assert.deepEqual(value,request);return 'digest';};
 for(const name of ['nativeProbeClaimAck','nativeProbePollAck','nativeProbeStatusAck','nativeProbeResultAck','nativeProbeTypesPollAck','nativeProbeTypesClaimAck','nativeProbeTypesStatusAck','nativeProbeTypesResultAck','nativeProbeServicesPollAck','nativeProbeServicesClaimAck','nativeProbeServicesStatusAck','nativeProbeServicesResultAck'])native[name]=(...args:any[])=>{trace.push(name);calls.push([name,...args]);if(state.ackFailure)throw failure;const lazy=args.at(-1);if(typeof lazy==='function'&&state.lazy&&state.offer!==null){trace.push('callback');assert.deepEqual(lazy(),{measurement:state.offer.measurement});}return ack;};
 const measurements={PROBE_EGRESS_MEASUREMENT:'tcp-connect-v1',PROBE_SERVICE_MEASUREMENTS:['tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1'],probeMeasurement(value:string){trace.push('measurement:'+value);if(state.measureFailure)throw failure;return {measurement:value};}};
 const owner:Any={};for(const method of ['consume','offer','check','receiveResult'])owner[method]=async(...args:any[])=>{trace.push('owner:'+method);calls.push([method,...args]);if(state.ownerFailure)throw failure;trace.push('commit');return state;};
 const exports=load(family,{'../../compatibility/public.ts':native,'../../framework/public.ts':{ControlError},'./measurements.ts':measurements}),name={claims:'ProbeClaims',delivery:'ProbeDelivery',results:'ProbeResults',types:'ProbeTypes',services:'ProbeServices'}[family],Type=exports[name];
 const instance=explicit?new Type(owner,()=>{trace.push('clock');return state.now;}):new Type(owner);const invoke=(method:string,input=request)=>instance[method]('node','fingerprint',2,input);
 return {trace,calls,failure,ack,request,state,owner,instance,Type,invoke};
}

test('87/88 public and legacy machine classes retain exact constructor identity and captured defaults versus dynamic claim clock',async()=>{
 for(const [name,Type] of Object.entries({ProbeClaims,ProbeDelivery,ProbeResults,ProbeTypes,ProbeServices}))assert.equal((Public as Any)[name],Type);
 for(const family of ['delivery','results','types','services'] as const){const f=fixture(family,false);assert.deepEqual(f.trace,['source']);assert.equal(f.state.sourceCalls,1);f.state.now=at+1;await f.invoke(family==='results'?'handle':'poll');assert.equal(f.state.sourceCalls,1);assert.ok(f.trace.indexOf('clock')>f.trace.indexOf('commit'));assert.equal(f.calls.at(-1)![3],at);}
 const claim=fixture('claims',false);assert.equal(claim.state.sourceCalls,0);await claim.invoke('handle');assert.equal(claim.state.sourceCalls,1);assert.ok(claim.trace.indexOf('source')>claim.trace.indexOf('commit'));claim.state.now++;await claim.invoke('handle');assert.equal(claim.state.sourceCalls,2);assert.equal(claim.calls.at(-1)![3],at+1);
});

test('87/88 every bridge parses before connection identity and defers original owner and clock until successful identity',async()=>{
 for(const [family,methods] of [['claims',['handle']],['delivery',['poll','status']],['results',['handle']],['types',['poll','claim','status','result']],['services',['poll','claim','status','result']]] as const)for(const method of methods){
  const f=fixture(family);f.state.parserFailure=true;await assert.rejects(f.invoke(method,{...f.request,nodeId:'foreign'}),error=>error===f.failure);assert.deepEqual(f.trace.slice(-2),['encode','parse:'+(method==='handle'?'Request':method[0]!.toUpperCase()+method.slice(1)+'Request')]);assert.equal(f.calls.length,0);
  const g=fixture(family);await assert.rejects(g.invoke(method,{...g.request,sessionEpoch:3}),{code:'SESSION_SUPERSEDED'});assert.equal(g.calls.length,0);assert.equal(g.trace.includes('clock'),false);
  const h=fixture(family);h.state.ownerFailure=true;await assert.rejects(h.invoke(method),error=>error===h.failure);assert.equal(h.trace.includes('clock'),false);assert.equal(h.trace.includes('commit'),false);
 }
});

test('87 v1 projections retain exact owner arguments, original ACK identity and late receipt rejection after commit',async()=>{
 for(const [family,method,ownerMethod] of [['claims','handle','consume'],['delivery','poll','offer'],['delivery','status','check'],['results','handle','receiveResult']] as const){const f=fixture(family);assert.equal(await f.invoke(method),f.ack);const call=f.calls[0]!;assert.deepEqual(call.slice(0,4),[ownerMethod,'node','fingerprint',2]);assert.deepEqual(call[4],ownerMethod==='receiveResult'?f.request:{...(ownerMethod==='offer'?{}:{permitId:'permit'}),bootId:'boot',instanceId:'instance',instanceGeneration:3});assert.equal(call.length,5);assert.ok(f.trace.indexOf('clock')>f.trace.indexOf('commit'));const ackCall=f.calls.at(-1)!;assert.deepEqual(ackCall[1],f.request);if(method!=='poll')assert.equal(ackCall[2],f.state);
  f.trace.length=0;f.state.now=at+1000;await assert.rejects(f.invoke(method),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.ok(f.trace.includes('commit'));assert.equal(f.trace.some(v=>v.startsWith('nativeProbe')),false);
 }
 const claim=fixture('claims');for(const patch of [{id:'different'},{instanceId:'different'},{instanceGeneration:4},{binding:{nodeId:'foreign'}},{binding:{nodeId:'node',bootId:'foreign'}},{binding:{nodeId:'node',bootId:'boot',sessionEpoch:3}},{state:'issued'},{closedAt:null},{closedAt:at+1},{expiresAt:at}]){const f=fixture('claims');Object.assign(f.state,patch);await assert.rejects(f.invoke('handle'),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.ok(f.trace.includes('commit'));}assert.equal(claim.calls.length,0);
 for(const patch of [{observedAt:-1},{observedAt:at+1},{observedAt:at-251},{observedAt:1.5},{now:NaN},{now:8640000000000001},{executionEnabled:true},{offer:[]},{offer:{instanceId:'foreign'}},{offer:{instanceId:'instance',instanceGeneration:3,expiresAt:at}}]){const f=fixture('delivery');Object.assign(f.state,patch);await assert.rejects(f.invoke('poll'),{code:'PROBE_PERMIT_UNAVAILABLE'});}
 for(const patch of [{checkedAt:at-251},{acceptedAt:-1},{acceptedAt:at+1},{checkedAt:at-1},{resultDigest:'different'},{duplicate:1}]){const f=fixture('results');Object.assign(f.state,patch);await assert.rejects(f.invoke('handle'),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.ok(f.trace.includes('commit'));}
 const valid=fixture('delivery');valid.state.now=at+250;assert.equal(await valid.invoke('poll'),valid.ack);
});

test('88 v2 and v3 keep owner selection args, absent egress default, lazy descriptors and original missing flag guards',async()=>{
 for(const family of ['types','services'] as const){for(const method of ['poll','claim','status','result']){const f=fixture(family);f.state.executionEnabled=true;assert.equal(await f.invoke(method),f.ack);const call=f.calls[0]!,selection=family==='types'?true:'services';if(method==='poll')assert.equal(call[5],selection);if(method==='claim'||method==='status'){assert.equal(call[5],'tcp-connect-v1');assert.equal(call[6],selection);assert.equal(call.length,family==='services'?8:7);if(family==='services')assert.equal(call[7],null);}if(method==='result')assert.deepEqual(call[4],f.request);assert.ok(f.trace.indexOf('clock')>f.trace.indexOf('commit'));}
  const nullOffer=fixture(family);assert.equal(await nullOffer.invoke('poll'),nullOffer.ack);assert.equal(nullOffer.trace.some(v=>v.startsWith('measurement:')),false);
  for(const measurement of family==='types'?['tcp-connect-v1','tcp-ingress-connect-v1']:['tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1']){const f=fixture(family);f.state.offer={instanceId:'instance',instanceGeneration:3,measurement,expiresAt:at+1000};f.state.lazy=false;await f.invoke('poll');assert.equal(f.trace.some(v=>v.startsWith('measurement:')),false);const callback=f.calls.at(-1)!.at(-1);assert.equal(typeof callback,'function');assert.deepEqual(callback(),{measurement});f.state.measureFailure=true;assert.throws(callback,error=>error===f.failure);}
  for(const measurement of ['unknown','udp-ingress-echo-v1',...(family==='types'?['tcp-ingress-tls-v1']:[])]){const f=fixture(family);f.state.offer={instanceId:'instance',instanceGeneration:3,measurement,expiresAt:at+1000};await assert.rejects(f.invoke('poll'),{code:'PROBE_PERMIT_UNAVAILABLE'});}
  for(const method of ['claim','status']){const f=fixture(family);delete f.state.measurement;assert.equal(await f.invoke(method),f.ack);f.request.measurement='tcp-ingress-connect-v1';await assert.rejects(f.invoke(method),{code:'PROBE_PERMIT_UNAVAILABLE'});}
 }
});

test('88 service selection parses and digests before receipt identity; v2 and v3 retain distinct timestamp caps and first refusal',async()=>{
 for(const method of ['claim','status']){const f=fixture('services');f.state.serviceContext={pinned:'actual'};f.state.id='wrong';f.state.contextFailure=true;await assert.rejects(f.invoke(method),error=>error===f.failure);assert.ok(f.trace.indexOf('context-parse')>f.trace.indexOf('clock'));assert.equal(f.trace.includes('selection-digest'),false);f.state.contextFailure=false;await assert.rejects(f.invoke(method),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.equal(f.trace.filter(v=>v==='selection-digest').length,2);}
 const high=253402300800000;for(const family of ['types','services'] as const){const f=fixture(family);Object.assign(f.state,{now:high,observedAt:high});if(family==='types')assert.equal(await f.invoke('poll'),f.ack);else await assert.rejects(f.invoke('poll'),{code:'PROBE_PERMIT_UNAVAILABLE'});}
 for(const family of ['types','services'] as const)for(const patch of [{now:NaN},{now:at-1},{observedAt:-1},{observedAt:at-251}]){const f=fixture(family);Object.assign(f.state,patch);await assert.rejects(f.invoke('poll'),{code:'PROBE_PERMIT_UNAVAILABLE'});}
 for(const family of ['claims','delivery','results','types','services'] as const){const f=fixture(family);f.state.ackFailure=true;await assert.rejects(f.invoke(family==='claims'||family==='results'?'handle':'poll'),error=>error===f.failure);assert.ok(f.trace.includes('commit'));}
});

test('87/88 status and typed receipts check each original identity time field without broadening binding or flag guards',async()=>{
 for(const family of ['delivery','types','services'] as const){for(const patch of [{id:'foreign'},{instanceId:'foreign'},{instanceGeneration:4},{state:'issued'},{closedAt:null},{expiresAt:at}]){const f=fixture(family);Object.assign(f.state,patch);await assert.rejects(f.invoke('status'),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.ok(f.trace.includes('commit'));assert.equal(f.trace.some(v=>v.endsWith('StatusAck')),false);}
  const g=fixture(family);g.state.binding={nodeId:'foreign',bootId:'foreign',sessionEpoch:99};g.state.closedAt=at+1;assert.equal(await g.invoke('status'),g.ack); // Original status adapters check current owner identity, not these unlisted fields.
  const h=fixture(family);h.state.executionEnabled=true;if(family==='delivery')await assert.rejects(h.invoke('status'),{code:'PROBE_PERMIT_UNAVAILABLE'});else assert.equal(await h.invoke('status'),h.ack);
 }
 for(const family of ['types','services'] as const){for(const method of ['claim','status'])for(const patch of [{id:'foreign'},{instanceId:'foreign'},{instanceGeneration:4},{state:'issued'},{closedAt:null},{expiresAt:at},{measurement:'tcp-ingress-connect-v1'},{checkedAt:at+1}]){if(method==='claim'&&'checkedAt' in patch)continue;const f=fixture(family);Object.assign(f.state,patch);await assert.rejects(f.invoke(method),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.ok(f.trace.includes('commit'));}
  for(const patch of [{acceptedAt:NaN},{acceptedAt:-1},{acceptedAt:at+1},{checkedAt:at-251},{checkedAt:at+1},{resultDigest:'other'},{duplicate:undefined},{now:at+1000}]){const f=fixture(family);Object.assign(f.state,patch);await assert.rejects(f.invoke('result'),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.ok(f.trace.includes('commit'));assert.equal(f.trace.some(v=>v.endsWith('ResultAck')),false);}
  for(const patch of [{instanceId:'foreign'},{instanceGeneration:4},{expiresAt:at}]){const f=fixture(family);f.state.offer={instanceId:'instance',instanceGeneration:3,expiresAt:at+1000,measurement:'tcp-connect-v1',...patch};await assert.rejects(f.invoke('poll'),{code:'PROBE_PERMIT_UNAVAILABLE'});}
 }
 const boundaries=fixture('delivery');boundaries.state.observedAt=8640000000000000;boundaries.state.now=8640000000000000;assert.equal(await boundaries.invoke('poll'),boundaries.ack);for(const family of ['types','services'] as const){const f=fixture(family);f.state.now=at+250;assert.equal(await f.invoke('status'),f.ack);f.state.now=at+251;await assert.rejects(f.invoke('status'),{code:'PROBE_PERMIT_UNAVAILABLE'});}
});
