import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as core from '@tunex/core';
import * as framework from '../src/framework/public.ts';
import * as native from '../src/compatibility/public.ts';
import * as Owner from '../src/modules/node-observation-owner/public.ts';
import * as Legacy from '../src/application/node-observations.ts';
import { observeNodeReport as legacyRules } from '../src/modules/node-report-observation.ts';
import type { NodeReportEvidence, NodeObservationContext } from '../src/framework/public.ts';

type Any=Record<string,any>;
const policy={freshnessMs:30000,clockSkewMs:5000},command={source:'persisted-agent-report',version:1};
const evidence=():NodeReportEvidence=>({scopeId:'scope',nodeId:'node',revoked:false,credentialUntil:200000,sessionEpoch:2,bootId:'boot',snapshotGeneration:3,snapshotValidUntil:160000,invalidReport:false,report:{nodeId:'node',bootId:'boot',sessionEpoch:2,reportSequence:4,snapshotGeneration:3,observedAt:99000,receivedAt:100000,assignmentCount:2}});
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
function evaluated(file:string,providers:Any){const exports:Any={},source=ts.transpileModule(readFileSync(new URL('../src/modules/node-observation-owner/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;new vm.Script('(function(exports,require){'+source+'\n})',{filename:'actual-'+file}).runInThisContext()(exports,(name:string)=>{assert.ok(Object.hasOwn(providers,name),name);return providers[name];});return exports;}
function fixture(){
 const events:string[]=[],controller=new AbortController(),handle={original:Symbol('native timeout')},state={mono:10,wall:100000,bytes:4096,delay:0,callback:()=>{},readError:undefined as unknown,pending:undefined as Promise<NodeReportEvidence>|undefined,projectError:undefined as unknown};let context:NodeObservationContext|undefined;
 const values={...native,nativeMonotonicNow(){events.push('monotonic');return state.mono;},nativeWallClockNow(){events.push('wall');return state.wall;},nativeObservationController(){events.push('controller');return controller;},nativeObservationTimeout(callback:()=>void,delay:number){events.push('schedule');state.callback=callback;state.delay=delay;return handle;},nativeClearObservationTimeout(value:unknown){assert.equal(value,handle);events.push('clear');},nativeJsonEncoderBytes(value:unknown){events.push('bytes');assert.equal(value,result);return state.bytes;}};
 const result={original:'rules result'},rules={observeNodeReport(raw:NodeReportEvidence,scope:string,node:string,now:number,actualPolicy:unknown){events.push('project');assert.equal(raw,rawEvidence);assert.equal(scope,'scope');assert.equal(node,'node');assert.equal(now,state.wall);assert.deepEqual(actualPolicy,policy);if(state.projectError)throw state.projectError;return result;}};
 const reader={async read(actual:NodeObservationContext){assert.equal(this,reader);events.push('read');context=actual;if(state.readError)throw state.readError;return state.pending??rawEvidence;}},rawEvidence=evidence();
 const service=evaluated('service.ts',{'@tunex/core':core,'../../framework/public.ts':framework,'../../compatibility/public.ts':values,'./rules.ts':rules});
 const host=new service.NodeObservations(reader,policy);return {host,state,events,controller,handle,reader,result,rawEvidence,get context(){return context;}};
}

test('102 public legacy passive host rules frozen limits and raw contracts retain exact identities',()=>{
 assert.equal(Owner.NodeObservations,Legacy.NodeObservations);assert.equal(Owner.NODE_OBSERVATION_LIMITS,Legacy.NODE_OBSERVATION_LIMITS);assert.equal(Owner.observeNodeReport,legacyRules);assert.equal(Owner.NODE_OBSERVATION_API_INTERFACE_VERSION,1);assert.equal(Owner.NodeObservations.length,2);assert.deepEqual(Owner.NODE_OBSERVATION_LIMITS,{maxActive:8,maxActors:256,cooldownMs:1000,maxResultBytes:4096,defaultTimeoutMs:2000,minTimeoutMs:100,maxTimeoutMs:2000});assert.ok(Object.isFrozen(Owner.NODE_OBSERVATION_LIMITS));
 const calls:string[]=[],reader={get read(){calls.push('reader');return function(this:unknown){assert.equal(this,reader);return Promise.resolve(evidence());};}},input={get freshnessMs(){calls.push('freshness');return 400000;},get clockSkewMs(){calls.push('skew');return 3;}};
 const host=new Owner.NodeObservations(reader,input) as unknown as Any;assert.deepEqual(calls,['freshness','freshness','skew','skew','reader','freshness','skew']);assert.deepEqual(host.policy,{freshnessMs:300000,clockSkewMs:3});assert.ok(Object.isFrozen(host.policy));assert.notEqual(host.policy,input);assert.equal(host.active,0);assert.equal(host.actors.size,0);assert.equal(host.nodes.size,0);
 const failure=new Error('policy first');assert.throws(()=>new Owner.NodeObservations({get read(){throw new Error('reader later');}} as never,{get freshnessMs():number{throw failure;},clockSkewMs:0}),error=>error===failure);
});

test('102 native lifecycle clock encoder and ISO adapters resolve current globals and preserve exact callback delay handle and receiver',t=>{
 const events:unknown[][]=[],controller=new AbortController(),handle=Symbol('timer');
 t.mock.method(globalThis,'AbortController',function(){events.push(['controller']);return controller;} as never);
 t.mock.method(globalThis,'setTimeout',((callback:unknown,delay:unknown,...rest:unknown[])=>{events.push(['schedule',callback,delay,...rest]);return handle;}) as never);
 t.mock.method(globalThis,'clearTimeout',((actual:unknown)=>{events.push(['clear',actual]);}) as never);
 const callback=()=>{};assert.equal(native.nativeObservationController(),controller);assert.equal(native.nativeObservationTimeout(callback,101),handle);native.nativeClearObservationTimeout(handle as never);assert.deepEqual(events,[['controller'],['schedule',callback,101],['clear',handle]] as unknown[][]);
 const next=new (Object.getPrototypeOf(controller).constructor)();t.mock.method(globalThis,'AbortController',function(){events.push(['replacement']);return next;} as never);assert.equal(native.nativeObservationController(),next);
 t.mock.method(Date,'now',()=>12.5);assert.equal(native.nativeWallClockNow(),12.5);t.mock.method(Date,'now',()=>Infinity);assert.equal(native.nativeWallClockNow(),Infinity);
 t.mock.method(performance,'now',()=>-1.25);assert.equal(native.nativeMonotonicNow(),-1.25);t.mock.method(performance,'now',()=>NaN);assert.ok(Number.isNaN(native.nativeMonotonicNow()));
 const encoded={toJSON(){events.push(['toJSON',this]);return {value:'被动'};}};assert.equal(native.nativeJsonEncoderBytes(encoded),Buffer.byteLength('{"value":"被动"}','utf8'));assert.deepEqual(events.at(-1),['toJSON',encoded]);
 const failure=new Error('JSON effect');assert.throws(()=>native.nativeJsonEncoderBytes({toJSON(){throw failure;}}),error=>error===failure);assert.throws(()=>native.nativeJsonEncoderBytes({value:1n}),TypeError);
 t.mock.method(Date.prototype,'toISOString',function(this:Date){events.push(['ISO',this.getTime()]);return 'original-native-ISO';});assert.equal(native.nativeIsoTime(123.75),'original-native-ISO');assert.deepEqual(events.at(-1),['ISO',123]);
});

test('102 actual host records one bound reader and original monotonic controller wall timer projection bytes release clear listener order',async()=>{
 const f=fixture(),listenerCalls:unknown[][]=[],signal={aborted:false,addEventListener(...args:unknown[]){f.events.push('outer.add');listenerCalls.push(['add',...args]);},removeEventListener(...args:unknown[]){f.events.push('outer.remove');listenerCalls.push(['remove',...args]);}};
 assert.deepEqual(f.events,[]);f.reader.read=async()=>assert.fail('reader was captured and bound during construction');
 assert.equal(await f.host.observe('actor','scope','node',command,signal),f.result);assert.equal(f.state.delay,2000);assert.deepEqual(f.events,['monotonic','controller','wall','schedule','outer.add','read','monotonic','wall','project','bytes','monotonic','clear','outer.remove']);
 assert.equal(f.context!.deadlineAt,102000);assert.equal(f.context!.signal,f.controller.signal);assert.ok(Object.isFrozen(f.context));assert.deepEqual(Object.keys(f.context!),['actorId','scopeId','nodeId','deadlineAt','signal']);assert.equal(listenerCalls[0]![1],'abort');assert.deepEqual(listenerCalls[0]![3],{once:true});assert.equal(listenerCalls[0]![2],listenerCalls[1]![2]);assert.equal(f.host.active,0);assert.equal(f.host.nodes.size,0);assert.deepEqual(f.host.actors.get('actor'),{active:false,until:1010});
 for(const bytes of [4096,4097]){const x=fixture();x.state.bytes=bytes;if(bytes===4096)assert.equal(await x.host.observe('a','scope','node',{...command,timeoutMs:100}),x.result);else await assert.rejects(x.host.observe('a','scope','node',command),{code:'OBSERVATION_INVALID_RESULT',status:503,message:'Invalid observation evidence',retryable:true});assert.equal(x.host.active,0);assert.ok(x.events.indexOf('bytes')<x.events.indexOf('clear'));}
});

test('102 input and already-cancelled refusal precede clocks while timeout retains the owned reader slot until its real settlement',async()=>{
 const bad=fixture(),cancelled=new AbortController();cancelled.abort();await assert.rejects(bad.host.observe('actor','scope','node',{...command,unknown:true},cancelled.signal),{code:'INVALID_CONFIG'});assert.deepEqual(bad.events,[]);await assert.rejects(bad.host.observe('actor','scope','node',command,cancelled.signal),{code:'OBSERVATION_CANCELLED'});assert.deepEqual(bad.events,[]);
 const f=fixture(),pending=deferred<NodeReportEvidence>();f.state.pending=pending.promise;const response=f.host.observe('actor','scope','node',{...command,timeoutMs:100});await Promise.resolve();await Promise.resolve();assert.equal(f.host.active,1);assert.equal(f.state.delay,100);f.state.callback();await assert.rejects(response,{code:'OBSERVATION_TIMEOUT',status:503});assert.equal(f.host.active,1);assert.equal(f.host.nodes.size,1);assert.equal(f.host.actors.get('actor').active,true);assert.equal(f.events.includes('project'),false);await assert.rejects(f.host.observe('other','scope','node',command),{code:'OBSERVATION_BUSY'});
 pending.resolve(f.rawEvidence);for(let i=0;i<6;i++)await Promise.resolve();assert.equal(f.host.active,0);assert.equal(f.host.nodes.size,0);assert.equal(f.events.includes('project'),false);assert.deepEqual(f.host.actors.get('actor'),{active:false,until:1010});
});

test('102 original error masking sanitizes known source errors preserves cancellation reason and releases on projection encoder or source failures',async()=>{
 for(const [input,expected]of [[new framework.ControlError('NOT_FOUND',404,'secret'),'NOT_FOUND'],[new framework.ControlError('AUTHORIZATION_DENIED',403,'secret'),'AUTHORIZATION_DENIED'],[new framework.ControlError('OBSERVATION_INVALID_RESULT',503,'secret'),'OBSERVATION_INVALID_RESULT'],[new Error('secret'),'OBSERVATION_FAILED']]as const){const f=fixture();f.state.readError=input;await assert.rejects(f.host.observe('a','scope','node',command),(error:unknown)=>error instanceof framework.ControlError&&error.code===expected&&error!==input&&!error.message.includes('secret'));assert.equal(f.host.active,0);assert.equal(f.events.at(-1),'clear');}
 const f=fixture();f.state.projectError=new Error('private projection');await assert.rejects(f.host.observe('a','scope','node',command),{code:'OBSERVATION_FAILED',status:503,message:'Observation source unavailable'});assert.equal(f.host.active,0);assert.equal(f.events.includes('bytes'),false);
});

test('102 original report rules retain reason precedence distinct stale status and exact ISO order with bounded public provenance copies',()=>{
 const events:number[]=[],rules=evaluated('rules.ts',{'@tunex/core':core,'../../framework/public.ts':framework,'../../compatibility/public.ts':{nativeIsoTime(value:number){events.push(value);return 'ISO:'+value;}}});
 const raw=evidence(),result=rules.observeNodeReport(raw,'scope','node',100000,policy);assert.deepEqual(events,[100000,100000,129000]);assert.equal(result.capturedAt,'ISO:100000');assert.equal(result.receivedAt,'ISO:100000');assert.equal(result.expiresAt,'ISO:129000');assert.equal(result.reason,'recent-report');assert.equal(result.status,'observed');assert.notEqual(result.provenance,raw.report);assert.ok(Object.isFrozen(result.provenance));assert.equal(Object.isFrozen(raw.report),false);assert.deepEqual(Object.keys(result.provenance),['nodeId','bootId','sessionEpoch','reportSequence','snapshotGeneration','observedAt','receivedAt','assignmentCount']);
 const cases:[string,Partial<NodeReportEvidence>,number,string][]=[['node-revoked',{revoked:true,credentialUntil:0,invalidReport:true,report:null},100000,'unknown'],['credential-expired',{credentialUntil:100000,invalidReport:true,report:null},100000,'unknown'],['invalid-report',{invalidReport:true,report:null},100000,'unknown'],['missing-report',{report:null},100000,'unknown'],['session-mismatch',{bootId:'different',snapshotGeneration:9},100000,'unknown'],['snapshot-mismatch',{snapshotGeneration:9},100000,'unknown'],['clock-skew',{},99999,'unknown'],['snapshot-expired',{snapshotValidUntil:105000},100000,'stale'],['report-expired',{},129000,'stale']];
 for(const [reason,patch,now,status]of cases){events.length=0;const input={...evidence(),...patch},out=rules.observeNodeReport(input,'scope','node',now,policy);assert.equal(out.reason,reason);assert.equal(out.status,status);assert.equal(out.health,'unknown');assert.equal(out.independentProbe,false);assert.equal(events[0],now);if(!input.report){assert.deepEqual(events,[now]);assert.equal(out.provenance,null);assert.equal(out.receivedAt,null);assert.equal(out.expiresAt,null);}else assert.equal(events[1],input.report.receivedAt);}
 for(const patch of [{assignmentCount:10001},{assignmentCount:-1},{observedAt:8640000000000001},{receivedAt:NaN},{reportSequence:0},{sessionEpoch:0}]){events.length=0;assert.throws(()=>rules.observeNodeReport({...evidence(),report:{...evidence().report!,...patch}},'scope','node',100000,policy),{code:'OBSERVATION_INVALID_RESULT'});assert.deepEqual(events,[]);}
 const failure=new Error('original ISO');const refused=evaluated('rules.ts',{'@tunex/core':core,'../../framework/public.ts':framework,'../../compatibility/public.ts':{nativeIsoTime(){throw failure;}}});assert.throws(()=>refused.observeNodeReport(raw,'scope','node',100000,policy),error=>error===failure);
});
