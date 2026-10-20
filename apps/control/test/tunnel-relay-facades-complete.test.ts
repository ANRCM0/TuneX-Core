import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward, ForwardSpec } from '@tunex/core';
import * as Tunnels from '../src/modules/native-tunnel-owner/public.ts';
import * as LegacyTunnels from '../src/application/native-tunnels.ts';
import * as LegacyTunnelApi from '../src/application/native-tunnel-api.ts';
import * as Relay from '../src/modules/relay-plan-owner/public.ts';
import type { PathTemplateQueryApi, PathTemplateCommandApi, PathBindingApi } from '../src/modules/path-owner/public.ts';
import type { ForwardBindingApi } from '../src/modules/forward-owner/public.ts';
import { ControlApplication } from '../src/application/control.ts';
import type { ScopeAuthorization, TransactionBoundary } from '../src/framework/public.ts';

type Equal<A,B>=(<T>()=>T extends A?1:2)extends(<T>()=>T extends B?1:2)?true:false;
type Same<T extends true>=T;
type Tx={readonly token:symbol};
export type OriginalFacadeDeclarations=[
 Same<Equal<typeof Tunnels.NativeTunnels,typeof LegacyTunnels.NativeTunnels>>,
 Same<Equal<Tunnels.NativeTunnelApi,LegacyTunnelApi.NativeTunnelApi>>,
 Same<Equal<ConstructorParameters<typeof Tunnels.NativeTunnels<Tx>>,[PathTemplateQueryApi,PathTemplateCommandApi,PathBindingApi,Pick<ForwardBindingApi,'applyPath'>]>>,
 Same<Equal<Tunnels.NativeTunnelApi['list'],(...args:Parameters<PathTemplateQueryApi['list']>)=>Promise<Tunnels.NativeTunnelPage>>>,
 Same<Equal<Tunnels.NativeTunnelApi['get'],(...args:Parameters<PathTemplateQueryApi['get']>)=>Promise<Tunnels.NativeTunnelView>>>,
 Same<Equal<Pick<Tunnels.NativeTunnelApi,'publish'|'archive'>,PathTemplateCommandApi>>,
 Same<Equal<Tunnels.NativeTunnelApi['binding'],PathBindingApi['get']>>,
 Same<Equal<Tunnels.NativeTunnelApi['preview'],PathBindingApi['preview']>>,
 Same<Equal<Tunnels.NativeTunnelApi['references'],PathBindingApi['references']>>,
 Same<Equal<Tunnels.NativeTunnelApi['apply'],ForwardBindingApi['applyPath']>>,
 Same<Equal<Tunnels.NativeTunnelManagement,{readonly version:1;readonly kind:'native-logical-tunnel';readonly backingResource:'path-template';readonly configurationReuse:true;readonly physicalConnectionSharing:false;readonly allocationOwner:'forward-runtime';readonly health:'not-assessed'}>>,
 Same<Equal<ConstructorParameters<typeof Relay.RelayPlans<Tx>>,[TransactionBoundary<Tx>,ScopeAuthorization<Tx>,Relay.RelayPreviewProvider<Tx>]>>,
 Same<Equal<Relay.RelayPlanApi['planRelay'],(actorId:string,scopeId:string,input:unknown)=>Promise<Relay.RelayPreview>>>,
];

test('95 NativeTunnels retains original public legacy API four required collaborators and singleton management without constructor work',()=>{
 assert.equal(Tunnels.NativeTunnels,LegacyTunnels.NativeTunnels);assert.equal(Tunnels.NATIVE_TUNNEL_MANAGEMENT,LegacyTunnels.NATIVE_TUNNEL_MANAGEMENT);
 assert.equal(Tunnels.NATIVE_TUNNEL_API_INTERFACE_VERSION,LegacyTunnelApi.NATIVE_TUNNEL_API_INTERFACE_VERSION);assert.equal(Tunnels.NATIVE_TUNNEL_API_INTERFACE_VERSION,1);
 assert.equal(Tunnels.NativeTunnels.length,4);assert.deepEqual(Tunnels.NATIVE_TUNNEL_MANAGEMENT,{version:1,kind:'native-logical-tunnel',backingResource:'path-template',configurationReuse:true,physicalConnectionSharing:false,allocationOwner:'forward-runtime',health:'not-assessed'});assert.ok(Object.isFrozen(Tunnels.NATIVE_TUNNEL_MANAGEMENT));
 const deps=Array.from({length:4},()=>new Proxy({},{get(){return assert.fail('construction must not read providers');}}));
 const service=new Tunnels.NativeTunnels(deps[0] as never,deps[1] as never,deps[2] as never,deps[3] as never);
 const fields=service as unknown as Record<string,unknown>;assert.deepEqual(Object.keys(fields),['queries','commands','bindings','forwards']);
 for(const [index,name]of ['queries','commands','bindings','forwards'].entries())assert.equal(fields[name],deps[index]);
 assert.deepEqual(Object.getOwnPropertyNames(Tunnels.NativeTunnels.prototype),['constructor','list','get','publish','archive','binding','preview','references','apply']);
 for(const name of ['publish','archive','binding','preview','references','apply']){const d=Object.getOwnPropertyDescriptor(Tunnels.NativeTunnels.prototype,name)!;assert.equal(d.enumerable,false);assert.equal(d.value.constructor.name,'Function');}
});

test('95 six NativeTunnels forwarding methods preserve exact argument count references receiver synchronous error and direct promise identity',async()=>{
 for(const [method,owner,key,args]of [
  ['publish','commands','publish',['actor','scope','template',undefined,7,{canonical:'template'}]],
  ['archive','commands','archive',['actor','scope','template','request-key',8]],
  ['binding','bindings','get',['actor','scope','forward']],
  ['preview','bindings','preview',['actor','scope','forward',9,{selection:'original'}]],
  ['references','bindings','references',['actor','scope','template',{page:'2',limit:'1'}]],
  ['apply','forwards','applyPath',['actor','scope','forward','durable-key',10,{selection:'original'}]],
 ]as const){
  const result={original:method},promise=Promise.resolve(result),failure=new Error(method),calls:unknown[][]=[];let throwing=false;
  const providers:Record<string,Record<string,(...args:unknown[])=>unknown>>={queries:{},commands:{},bindings:{},forwards:{}};
  providers[owner]![key]=function(this:unknown,...actual:unknown[]){assert.equal(this,providers[owner]);calls.push(actual);if(throwing)throw failure;return promise;};
  const service=new Tunnels.NativeTunnels(providers.queries as never,providers.commands as never,providers.bindings as never,providers.forwards as never) as unknown as Record<string,(...args:unknown[])=>unknown>;
  const actual=service[method]!(...args);assert.equal(actual,promise);assert.equal(await actual,result);assert.equal(calls.length,1);assert.deepEqual(calls[0],args);for(let i=0;i<args.length;i++)assert.equal(calls[0]![i],args[i]);
  throwing=true;assert.throws(()=>service[method]!(...args),error=>error===failure);assert.equal(calls.length,2);
 }
});

test('95 NativeTunnels list uses call then spread overrides tunnel ID and preserves metadata references before recursive freeze',async()=>{
 const extra={retained:true},head={templateId:'template-a',currentRevision:4,archived:false,tunnelId:'old-id',extra};
 const page={page:2,limit:1,total:7,items:[head],source:'persisted-control-state',executionAuthorized:false,management:{old:true},extra};
 const calls:unknown[][]=[],query={page:'2',limit:'1'};
 const queries={list(...args:unknown[]){assert.equal(this,queries);calls.push(args);return Promise.resolve(page);}};
 const service=new Tunnels.NativeTunnels(queries as never,{} as never,{} as never,{} as never);
 const out=await service.list('actor','scope',query);assert.deepEqual(calls,[['actor','scope',query]]);assert.equal(calls[0]![2],query);
 assert.deepEqual(out,{...page,items:[{...head,tunnelId:'template-a'}],management:Tunnels.NATIVE_TUNNEL_MANAGEMENT});assert.notEqual(out,page);assert.notEqual(out.items,page.items);assert.notEqual(out.items[0],head);assert.equal((out as unknown as typeof page).extra,extra);assert.equal((out.items[0] as typeof head).extra,extra);
 assert.ok(Object.isFrozen(out));assert.ok(Object.isFrozen(out.items));assert.ok(Object.isFrozen(out.items[0]));assert.ok(Object.isFrozen(extra));assert.equal(Object.isFrozen(page),false);assert.equal(Object.isFrozen(head),false);assert.equal(Object.isFrozen(page.items),false);assert.equal(head.tunnelId,'old-id');
});

test('95 NativeTunnels get retains config identity ordered topology ingress null and prior endpoint revisions for zero one two and four nodes',async()=>{
 for(const nodes of [[],['only'],['ingress','egress'],['ingress','middle-a','middle-b','egress']]){
  const config={version:1 as const,protocols:['tcp' as const],nodes,endpoints:nodes.slice(1).map((nodeId,index)=>({nodeId,revision:20+index})),transport:{profileId:'profile',configRevision:3}};
  const record={templateId:'template',currentRevision:7,archived:false,revision:4,configDigest:'digest',profileDigest:'profile-digest',config,createdAt:'native-time',capabilityRequirements:['tcp'],source:'persisted-control-state',referenceAuthorization:'original',executionAuthorized:false,reserved:false,bindingCreated:false,tunnelId:'obsolete',topology:['obsolete']};
  const calls:unknown[][]=[],queries={get(...args:unknown[]){assert.equal(this,queries);calls.push(args);return Promise.resolve(record);}};
  const service=new Tunnels.NativeTunnels({} as never,{} as never,{} as never,{} as never);(service as unknown as {queries:unknown}).queries=queries;
  const out=await service.get('actor','scope','template',4);assert.deepEqual(calls,[['actor','scope','template',4]]);assert.equal(out.config,config);assert.equal(out.management,Tunnels.NATIVE_TUNNEL_MANAGEMENT);assert.equal(out.tunnelId,'template');
  assert.deepEqual(out.topology,nodes.map((nodeId,index)=>({nodeId,role:index===0?'ingress':index===nodes.length-1?'egress':'transit',endpointRevision:index===0?null:20+index-1})));
  assert.ok(Object.isFrozen(out));assert.ok(Object.isFrozen(config));assert.ok(Object.isFrozen(config.nodes));assert.ok(Object.isFrozen(config.endpoints));assert.ok(Object.isFrozen(out.topology));for(const item of out.topology)assert.ok(Object.isFrozen(item));assert.equal(Object.isFrozen(record),false);assert.deepEqual(record.topology,['obsolete']);
 }
 const failure=new Error('get owner');const failed=new Tunnels.NativeTunnels({get:async()=>{throw failure;},list:async()=>{throw failure;}} as never,{} as never,{} as never,{} as never);await assert.rejects(failed.get('a','s','id'),error=>error===failure);await assert.rejects(failed.list('a','s'),error=>error===failure);
 const malformed={templateId:'template',config:{nodes:['a','b'],endpoints:[]}};await assert.rejects(new Tunnels.NativeTunnels({get:async()=>malformed} as never,{} as never,{} as never,{} as never).get('a','s','id'),TypeError);
});

function relayFixture(){
 const tx:Tx={token:Symbol('one original caller transaction')},events:string[]=[],calls:unknown[][]=[];const error=new Error('original Relay preview failure');let fault='';
 let result:Relay.RelayPreview={profile:{profileId:'profile',revision:4,configDigest:'digest'},resources:[],endpointRevision:6,executionSupported:false,runtimeEnabled:true,reserved:false};
 const db:TransactionBoundary<Tx>={async transaction(action){assert.equal(this,db);events.push('begin');if(fault==='begin')throw error;try{const value=await action(tx);events.push('commit');if(fault==='commit')throw error;return value;}catch(cause){events.push('rollback');throw cause;}}};
 const identity:ScopeAuthorization<Tx>={async scope(...args){assert.equal(this,identity);events.push('scope');calls.push(['scope',...args]);if(fault==='scope')throw error;}};
 const relay:Relay.RelayPreviewProvider<Tx>={async preview(...args){assert.equal(this,relay);events.push('preview');calls.push(['preview',...args]);if(fault==='preview')throw error;return result;}};
 const service=new Relay.RelayPlans(db,identity,relay);return {tx,events,calls,error,db,identity,relay,service,set fault(value:string){fault=value;},set result(value:Relay.RelayPreview){result=value;},get result(){return result;}};
}
const spec=():ForwardSpec=>({enabled:false,protocols:['tcp','udp'],ingress:{nodeId:'ingress',listen:{address:'127.0.0.1',port:32001}},target:{host:'127.0.0.1',port:80},path:{via:['egress']},transport:{profileId:'profile',configRevision:4}});

test('103 RelayPlans parses before any transaction then refuses absent path or locked Profile without authorization or reservation',async()=>{
 const f=relayFixture();assert.equal(Relay.RelayPlans.length,3);assert.equal(Relay.RELAY_QUERY_INTERFACE_VERSION,1);assert.deepEqual(f.events,[]);
 for(const input of [null,undefined,[],{}, {enabled:false}, {...spec(),protocols:[]},{...spec(),path:undefined},{...spec(),transport:undefined},{...spec(),path:undefined,transport:undefined}]){await assert.rejects(f.service.planRelay('actor','scope',input),{code:'INVALID_CONFIG',status:422});assert.deepEqual(f.events,[]);}
 const {path:_path,transport:_transport,...direct}=spec();void _path;void _transport;
 await assert.rejects(f.service.planRelay('actor','scope',direct),{code:'UNSUPPORTED_CAPABILITY',status:422,message:'Path and locked Transport Profile required'});assert.deepEqual(f.events,[]);
 const failure=new Error('input getter');const poisoned={...spec(),get enabled(){throw failure;}};await assert.rejects(f.service.planRelay('actor','scope',poisoned),error=>error===failure);assert.deepEqual(f.events,[]);
});

test('103 RelayPlans uses management authorization in one Tx and the original preview ID revision enabled projection for both result unions',async()=>{
 for(const multi of [false,true]){
  const f=relayFixture();if(multi)f.result={profile:{profileId:'profile',revision:4,configDigest:'digest'},resources:[],endpointRevisions:{egress:6,transit:7},path:['ingress','transit','egress'],executionSupported:true,runtimeEnabled:false,reserved:true};
  const input=spec(),before=structuredClone(input),out=await f.service.planRelay('actor','scope',input);assert.equal(out,f.result);assert.deepEqual(f.events,['begin','scope','preview','commit']);assert.deepEqual(f.calls[0],['scope',f.tx,'actor','scope',true]);
  const forwarded=f.calls[1]![3] as Forward;assert.deepEqual(f.calls[1]!.slice(0,3),['preview',f.tx,'actor']);assert.deepEqual(forwarded,{id:'preview',scopeId:'scope',revision:1,spec:{...before,enabled:true}});assert.equal(forwarded.spec.enabled,true);assert.deepEqual(input,before);assert.equal(input.enabled,false);assert.equal(Object.isFrozen(input),false);assert.equal(Object.isFrozen(out),false);
 }
 for(const fault of ['begin','scope','preview','commit']){const f=relayFixture();f.fault=fault;await assert.rejects(f.service.planRelay('actor','scope',spec()),cause=>cause===f.error);assert.deepEqual(f.events,fault==='begin'?['begin']:fault==='scope'?['begin','scope','rollback']:fault==='preview'?['begin','scope','preview','rollback']:['begin','scope','preview','commit','rollback']);}
});

test('95/103 actual ControlApplication assembles original four tunnel owners and one required RelayPlans without native construction IO',async t=>{
 t.mock.method(Date,'now',()=>1000);const db={},identity={},nodes={};const app=new ControlApplication(db as never,identity as never,nodes as never);
 const tunnel=app.tunnels as unknown as Record<string,unknown>;assert.equal(tunnel.queries,app.pathTemplateQueries);assert.equal(tunnel.commands,app.pathTemplates);assert.equal(tunnel.bindings,app.pathBindings);assert.equal(tunnel.forwards,app.forwards);
 const relay=app.relayPlans as unknown as Record<string,unknown>;assert.equal(relay.db,db);assert.equal(relay.identity,identity);assert.equal(relay.relay,app.relay);assert.ok(app.relayPlans instanceof Relay.RelayPlans);
 const result={original:true},calls:unknown[][]=[];app.relayPlans.planRelay=async function(...args:unknown[]){assert.equal(this,app.relayPlans);calls.push(args);return result as never;};const input={original:'input'};assert.equal(await app.planRelay('actor','scope',input),result);assert.deepEqual(calls,[['actor','scope',input]]);assert.equal(calls[0]![2],input);assert.equal(ControlApplication.prototype.planRelay.constructor.name,'AsyncFunction');
});
