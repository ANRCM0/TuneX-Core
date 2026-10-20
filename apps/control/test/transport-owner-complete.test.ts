import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TransportService } from '../src/modules/transport-owner/public.ts';
import type { TransportOptions } from '../src/modules/transport-owner/public.ts';
import { RelayEndpointService } from '../src/modules/relay-endpoint-owner/public.ts';
import type { RelayEndpointOptions } from '../src/modules/relay-endpoint-owner/public.ts';
import { nativeRelayConfigurationCodec as native } from '../src/compatibility/public.ts';
import type { NativeRelayConfigurationCodec } from '../src/compatibility/public.ts';
import type { TransportProfileStore, RelayEndpointStore, TransportRevisionRecord, RelayEndpointRecord, RequestIdentity, CommandResponse, IdempotentRequests } from '../src/framework/public.ts';
import { Transport } from '../src/modules/transport.ts';
import { RelayEndpoints, parseRelayEndpoint } from '../src/modules/relay-endpoints.ts';

const input={driver:'native.relay.v1',wireVersion:1,security:'mutual-tls13',protocols:['tcp','udp'],handshakeTimeoutSeconds:5,idleTimeoutSeconds:60,maxFrameBytes:65536,maxUdpDatagramBytes:16384,maxConnectionsPerNode:4096};
const profile=native.profile(input),endpoint=native.endpoint({listenAddress:'127.0.0.1',advertisedHost:'EXAMPLE.COM',allowedTcpPorts:[32002,32001]});
type Tx={readonly id:symbol};
function fixture(){
 const tx:Tx={id:Symbol()},events:string[]=[],calls:{name:string;args:unknown[]}[]=[];
 const state={fail:'',error:new Error('original provider error'),effects:[] as unknown[],replay:undefined as CommandResponse|undefined,
  current:{scope_id:'scope',current_revision:0},revision:{revision:1,config:JSON.stringify(profile),config_digest:native.digest(profile),created_by:'creator',created_at:123} as TransportRevisionRecord|undefined,
  grant:{grant_revision:1} as {grant_revision:number}|undefined,count:0,authorized:true,currentEndpoint:undefined as RelayEndpointRecord|undefined,revoked:0,live:false};
 const record=(name:string,args:unknown[]=[])=>{events.push(name);calls.push({name,args});if(state.fail===name)throw state.error;};
 function bound(self:unknown,expected:unknown,name:string,current:Tx,args:unknown[]){assert.equal(self,expected);assert.equal(current,tx);record(name,args);}
 const answers:Record<string,()=>unknown>={publicationForUpdate:()=>state.current,revision:()=>state.revision,authorizedProfile:()=>state.authorized,grantRevisionForUpdate:()=>state.grant,grantRevision:()=>state.grant,grantCount:()=>state.count,grantActors:()=>[{actor_id:'a'},{actor_id:'z'}],currentRevision:()=>({current_revision:state.current.current_revision}),list:()=>[{id:'a',current_revision:1},{id:'z',current_revision:3}],forUpdate:()=>state.currentEndpoint,resolve:()=>state.currentEndpoint};
 const store=new Proxy({} as TransportProfileStore<Tx>,{get(_t,key){return async function(this:unknown,current:Tx,...args:unknown[]){bound(this,store,String(key),current,args);if(answers[String(key)])return answers[String(key)]!();state.effects.push([key,...args]);};}});
 const endpoints=new Proxy({} as RelayEndpointStore<Tx>,{get(_t,key){return async function(this:unknown,current:Tx,...args:unknown[]){bound(this,endpoints,String(key),current,args);if(answers[String(key)])return answers[String(key)]!();state.effects.push([key,...args]);};}});
 class Authority{async owner(current:Tx,...args:unknown[]){bound(this,identity,'owner',current,args);}async scope(current:Tx,...args:unknown[]){bound(this,identity,'scope',current,args);}}
 const identity=new Authority();
 const idempotency:IdempotentRequests<Tx>={async claim<R extends CommandResponse>(current:Tx,request:RequestIdentity){bound(this,idempotency,'claim',current,[request]);return state.replay as R|undefined;},async respond(current,request,response){bound(this,idempotency,'respond',current,[request,response]);state.effects.push(['response',response]);}};
 class References{async hasLiveRelay(current:Tx,...args:unknown[]){bound(this,forwarding,'live',current,args);return state.live;}}
 const forwarding=new References();
 const nodes={async management(current:Tx,...args:unknown[]){bound(this,nodes,'management',current,args);return {id:'node',scope_id:'scope',credential_until:999999,facts:{},revoked:state.revoked};},async cleanupFacts(current:Tx,...args:unknown[]){bound(this,nodes,'cleanupFacts',current,args);return {} as never;},async audit(current:Tx,...args:unknown[]){bound(this,nodes,'nodeAudit',current,args);state.effects.push(['nodeAudit',...args]);}};
 const codec=new Proxy({...native} as NativeRelayConfigurationCodec,{get(target,key,receiver){const value=Reflect.get(target,key,receiver);if(typeof value!=='function')return value;return function(this:unknown,...args:unknown[]){assert.equal(this,codec);record(String(key),args);return Reflect.apply(value,target,args);};}});
 const db={async transaction<T>(action:(tx:Tx)=>Promise<T>){record('begin');const before=structuredClone(state.effects);try{const value=await action(tx);record('commit');return value;}catch(error){state.effects=before;events.push('rollback');throw error;}}};
 const transportOptions:TransportOptions<Tx>={db,identity,idempotency,forwarding,store,codec,now:()=>{record('now');return 1234;},newID:()=>{record('newID');return 'event';}};
 const endpointOptions:RelayEndpointOptions<Tx>={db,identity,idempotency,forwarding,nodes,store:endpoints,codec,now:transportOptions.now};
 return {tx,state,events,calls,store,endpoints,codec,db,transportOptions,endpointOptions,transport:new TransportService(transportOptions),endpoint:new RelayEndpointService(endpointOptions),clear(){events.length=0;calls.length=0;}};
}
const code=(expected:string)=>(error:unknown)=>{assert.equal((error as {code:string}).code,expected);return true;};
function core(f:ReturnType<typeof fixture>){return f.events.filter(e=>!['isId','isCounter','validRequestKey','profile','endpoint','digest','readStored'].includes(e));}

test('21 Transport publication validates native input before owner then claim insert and lock with initial owner grant response',async()=>{
 const f=fixture(),result=await f.transport.publish('owner','scope','profile','key',0,input);assert.deepEqual(core(f),['begin','owner','claim','ensureProfile','publicationForUpdate','encode','now','publishRevision','setCurrentRevision','insertGrant','respond','commit']);
 assert.deepEqual(result,{status:202,body:{profileId:'profile',revision:1,configDigest:native.digest(profile),changed:true}});assert.deepEqual(f.calls.find(c=>c.name==='publishRevision')!.args,['profile',1,JSON.stringify(profile),native.digest(profile),'owner',1234]);
 assert.deepEqual(f.calls.find(c=>c.name==='claim')!.args,[{actorId:'owner',scopeId:'scope',key:'key',digest:native.digest({method:'PUT',path:'/api/v1/scopes/scope/transport-profiles/profile',expectedRevision:0,config:profile})}]);
 const replay=fixture();replay.state.replay=result;assert.equal(await replay.transport.publish('owner','scope','profile','key',0,input),result);assert.deepEqual(core(replay),['begin','owner','claim','commit']);
 for(const args of [['',0,'key'],['profile',-1,'key'],['profile',0,''],['profile',0,'bad key'],['profile',0,'x'.repeat(129)]] as const){const invalid=fixture();await assert.rejects(invalid.transport.publish('owner','scope',args[0],args[2],args[1],input),code('INVALID_CONFIG'));assert.equal(invalid.events.includes('begin'),false);}
});

test('21 Transport immutable old revision missing corrupt digest scope stale no-op and maximum bounds retain lazy reads',async()=>{
 for(const mode of ['scope','stale','missing','json','shape','digest','noop','maxnoop','maxchange'] as const){const f=fixture();f.state.current.current_revision=1;if(mode==='scope')f.state.current.scope_id='other';if(mode==='missing')f.state.revision=undefined;if(mode==='json')f.state.revision!.config='{';if(mode==='shape')f.state.revision!.config='{}';if(mode==='digest')f.state.revision!.config_digest='corrupt';if(mode.startsWith('max'))f.state.current.current_revision=Number.MAX_SAFE_INTEGER;
  const expected=mode==='stale'?2:f.state.current.current_revision,newInput=mode==='maxchange'?{...input,idleTimeoutSeconds:61}:input;
  if(mode==='noop'||mode==='maxnoop'){const result=await f.transport.publish('owner','scope','profile','key',expected,newInput);assert.equal(result.status,200);assert.equal(result.body.changed,false);assert.equal(result.body.revision,expected);assert.deepEqual(core(f),['begin','owner','claim','ensureProfile','publicationForUpdate','revision','respond','commit']);}
  else {await assert.rejects(f.transport.publish('owner','scope','profile','key',expected,newInput),mode==='json'?SyntaxError:mode==='shape'?()=>true:code(mode==='scope'?'AUTHORIZATION_DENIED':mode==='stale'?'REVISION_CONFLICT':mode==='missing'?'NOT_FOUND':mode==='digest'?'INTEGRITY_FAILURE':'REVISION_EXHAUSTED'));assert.deepEqual(f.state.effects,[]);}
  if(mode==='scope'||mode==='stale')assert.equal(f.events.includes('revision'),false);
 }
});

test('21 publication all providers encode clock pointer initial grant and response failures preserve original rollback prefix',async()=>{
 const order=['owner','claim','ensureProfile','publicationForUpdate','encode','now','publishRevision','setCurrentRevision','insertGrant','respond'];
 for(const stage of order){const f=fixture();f.state.fail=stage;await assert.rejects(f.transport.publish('owner','scope','profile','key',0,input),e=>e===f.state.error);assert.deepEqual(f.state.effects,[]);assert.equal(f.events.at(-2),stage);assert.equal(f.events.at(-1),'rollback');}
});

test('21 locked resolve gets exact immutable revision after Scope management and grant while get list grants keep original read permissions order and shape',async()=>{
 const f=fixture();f.state.current.current_revision=3;const resolved=await f.transport.resolve(f.tx,'actor','scope','profile',1);assert.deepEqual(resolved,{profileId:'profile',revision:1,config:profile,configDigest:native.digest(profile)});assert.deepEqual(core(f),['scope','authorizedProfile','revision']);assert.deepEqual(f.calls.find(c=>c.name==='scope')!.args,['actor','scope',true]);assert.deepEqual(f.calls.find(c=>c.name==='revision')!.args,['profile',1]);
 f.clear();const viewed=await f.transport.get('actor','scope','profile',1);assert.deepEqual(Object.keys(viewed),['profileId','currentRevision','revision','config','configDigest','createdBy','createdAt','executionSupported']);assert.equal(viewed.createdAt,native.formatTime(123));assert.deepEqual(core(f),['begin','scope','currentRevision','revision','formatTime','commit']);assert.deepEqual(f.calls.find(c=>c.name==='scope')!.args,['actor','scope']);
 f.clear();assert.deepEqual(await f.transport.list('actor','scope'),{profiles:[{profileId:'a',currentRevision:1},{profileId:'z',currentRevision:3}],executionSupported:true});assert.deepEqual(core(f),['begin','scope','list','commit']);f.clear();assert.deepEqual(await f.transport.grants('owner','scope','profile'),{profileId:'profile',revision:1,actorIds:['a','z']});assert.deepEqual(core(f),['begin','owner','grantRevision','grantActors','commit']);
 for(const method of ['resolve','get'] as const){const bad=fixture();bad.state.revision!.config_digest='bad';await assert.rejects(method==='resolve'?bad.transport.resolve(bad.tx,'actor','scope','profile',1):bad.transport.get('actor','scope','profile'),code('INTEGRITY_FAILURE'));}
 const denied=fixture();denied.state.authorized=false;await assert.rejects(denied.transport.resolve(denied.tx,'actor','scope','profile',1),code('NOT_FOUND'));assert.equal(denied.events.includes('revision'),false);
});

test('21 Profile grants use exact-one previous count and lock Forward references before mutations with UUID clock encoding event order',async()=>{
 for(const count of [0,1,2])for(const allowed of [false,true]){const f=fixture();f.state.count=count;f.state.live=true;const changed=(count===1)!==allowed,result=await f.transport.applyGrant(f.tx,{actorId:'owner',scopeId:'scope',profileId:'profile',subject:'subject',expectedRevision:1,allowed});
  assert.deepEqual(result,{profileId:'profile',actorId:'subject',revision:changed?2:1,allowed,changed});assert.deepEqual(core(f),['owner','grantRevisionForUpdate',...(allowed?['scope']:[]),'grantCount',...(changed?['live',allowed?'insertGrant':'deleteGrant','setGrantRevision','newID','now','encode','grantEvent']:[])]);if(changed)assert.deepEqual(f.calls.find(c=>c.name==='grantEvent')!.args,['event','profile','owner','subject',2,1234,JSON.stringify({allowed})]);
 }
 for(const mode of ['missing','stale','exhausted'] as const){const f=fixture();if(mode==='missing')f.state.grant=undefined;if(mode==='exhausted')f.state.grant!.grant_revision=Number.MAX_SAFE_INTEGER;await assert.rejects(f.transport.applyGrant(f.tx,{actorId:'owner',scopeId:'scope',profileId:'profile',subject:'subject',expectedRevision:mode==='exhausted'?Number.MAX_SAFE_INTEGER:mode==='stale'?2:1,allowed:true}),code(mode==='missing'?'NOT_FOUND':mode==='stale'?'REVISION_CONFLICT':'REVISION_EXHAUSTED'));assert.deepEqual(f.state.effects,[]);}
 for(const stage of ['owner','grantRevisionForUpdate','scope','grantCount','live','insertGrant','setGrantRevision','newID','now','encode','grantEvent']){const f=fixture();f.state.fail=stage;await assert.rejects(f.db.transaction(tx=>f.transport.applyGrant(tx,{actorId:'owner',scopeId:'scope',profileId:'profile',subject:'subject',expectedRevision:1,allowed:true})),e=>e===f.state.error);assert.deepEqual(f.state.effects,[]);assert.equal(f.events.at(-2),stage);}
 const max=fixture();max.state.grant!.grant_revision=Number.MAX_SAFE_INTEGER;max.state.count=1;assert.equal((await max.transport.applyGrant(max.tx,{actorId:'owner',scopeId:'scope',profileId:'profile',subject:'subject',expectedRevision:Number.MAX_SAFE_INTEGER,allowed:true})).changed,false);assert.equal(max.events.includes('live'),false);
});

test('21 Endpoint owner claims before Node management then locked revision Forward references save audit response including active-reference noop',async()=>{
 const f=fixture(),result=await f.endpoint.change('owner','scope','node','key',0,endpoint);assert.deepEqual(result,{status:202,body:{nodeId:'node',revision:1,changed:true}});assert.deepEqual(core(f),['begin','owner','claim','management','forUpdate','live','encode','now','save','nodeAudit','respond','commit']);assert.deepEqual(f.calls.find(c=>c.name==='live')!.args,[undefined,'node']);assert.deepEqual(f.calls.find(c=>c.name==='save')!.args,['node',1,JSON.stringify(endpoint),'owner',1234]);assert.deepEqual(f.calls.find(c=>c.name==='nodeAudit')!.args,['node','owner','relay_endpoint_update',{revision:1,config:endpoint}]);
 const replay=fixture();replay.state.replay=result;assert.equal(await replay.endpoint.change('owner','scope','node','key',0,endpoint),result);assert.deepEqual(core(replay),['begin','owner','claim','commit']);
 for(const mode of ['revoked','stale','live','corrupt','noop','maxnoop','maxchange'] as const){const f=fixture();f.state.currentEndpoint={revision:1,config:JSON.stringify(endpoint)};if(mode==='revoked')f.state.revoked=1;if(mode==='live')f.state.live=true;if(mode==='corrupt')f.state.currentEndpoint.config='{';if(mode==='noop')f.state.live=true;if(mode.startsWith('max'))f.state.currentEndpoint.revision=Number.MAX_SAFE_INTEGER;const expected=mode==='stale'?0:f.state.currentEndpoint.revision;const config=mode==='live'||mode==='maxchange'?{...endpoint,allowedTcpPorts:[32003]}:endpoint;
  if(mode==='noop'||mode==='maxnoop'){const response=await f.endpoint.change('owner','scope','node','key',expected,config);assert.equal(response.status,200);assert.equal(f.events.includes('live'),false);assert.equal(f.events.includes('nodeAudit'),false);}
  else{await assert.rejects(f.endpoint.change('owner','scope','node','key',expected,config),mode==='corrupt'?SyntaxError:code(mode==='revoked'?'AUTHORIZATION_DENIED':mode==='stale'?'REVISION_CONFLICT':mode==='live'?'UNSUPPORTED_CAPABILITY':'REVISION_EXHAUSTED'));assert.deepEqual(f.state.effects,[]);}
 }
 for(const stage of ['owner','claim','management','forUpdate','live','encode','now','save','nodeAudit','respond']){const f=fixture();f.state.fail=stage;await assert.rejects(f.endpoint.change('owner','scope','node','key',0,endpoint),e=>e===f.state.error);assert.deepEqual(f.state.effects,[]);assert.equal(f.events.at(-2),stage);}
 const opaqueOld=fixture();opaqueOld.state.currentEndpoint={revision:1,config:'{}'};assert.equal((await opaqueOld.endpoint.change('owner','scope','node','key',1,endpoint)).status,202);assert.equal(opaqueOld.calls.filter(c=>c.name==='endpoint').length,1,'old endpoint is decoded for digest only, not newly validated');
});

test('21 endpoint get retains Scope then Node cleanup then shared resolution false execution and original parse errors',async()=>{
 const f=fixture();f.state.currentEndpoint={revision:4,config:JSON.stringify(endpoint)};assert.deepEqual(await f.endpoint.get('actor','scope','node'),{nodeId:'node',revision:4,config:endpoint,executionSupported:false});assert.deepEqual(core(f),['begin','scope','cleanupFacts','resolve','commit']);assert.deepEqual(f.calls.find(c=>c.name==='cleanupFacts')!.args,['node','scope']);
 const missing=fixture();await assert.rejects(missing.endpoint.resolve(missing.tx,'node'),code('NOT_FOUND'));for(const value of ['{','{}']){const bad=fixture();bad.state.currentEndpoint={revision:1,config:value};await assert.rejects(bad.endpoint.get('actor','scope','node'));}
 for(const stage of ['scope','cleanupFacts','resolve','readStored','endpoint']){const broken=fixture();broken.state.currentEndpoint={revision:1,config:endpoint};broken.state.fail=stage;await assert.rejects(broken.endpoint.get('actor','scope','node'),e=>e===broken.state.error);assert.equal(broken.events.at(-2),stage);}
});

test('21 native normalization closed Profile/endpoint/key grammar old imports defaults and prototype hooks remain native',()=>{
 assert.equal(parseRelayEndpoint,native.endpoint);assert.deepEqual(endpoint,{listenAddress:'127.0.0.1',advertisedHost:'example.com',allowedTcpPorts:[32001,32002]});for(const bad of [null,[],{}, {...input,extra:1},{...input,wireVersion:2}])assert.throws(()=>native.profile(bad));for(const bad of [null,[],{}, {...endpoint,extra:1},{...endpoint,advertisedHost:'0.0.0.0'},{...endpoint,allowedTcpPorts:[1,1]}])assert.throws(()=>native.endpoint(bad));
 for(const key of ['!','~','a'.repeat(128)])assert.equal(native.validRequestKey(key),true);for(const key of ['', ' ','\u007f','a'.repeat(129)])assert.equal(native.validRequestKey(key),false);
 let serialized=0;const inherited=Object.create({toJSON(){serialized++;return input;}});assert.deepEqual(native.profile(inherited),profile);assert.equal(serialized,1);const marker=new Error('prototype JSON');assert.throws(()=>native.profile(Object.create({toJSON(){throw marker;}})),e=>e===marker);
 const endpointWithHook=Object.assign(Object.create({toJSON(){assert.fail('endpoint parser does not serialize raw input');}}),endpoint);assert.deepEqual(native.endpoint(endpointWithHook),endpoint);
 const transport=new Transport({} as never,{} as never,{} as never,{} as never),endpoints=new RelayEndpoints({} as never,{} as never,{} as never,{} as never,{} as never);assert.ok(transport instanceof TransportService);assert.ok(endpoints instanceof RelayEndpointService);assert.equal(Reflect.get(transport,'codec'),native);assert.equal(Reflect.get(endpoints,'codec'),native);
 const old=Date.now;try{Date.now=()=>123;assert.equal(Reflect.get(transport,'now')(),123);assert.equal(Reflect.get(endpoints,'now')(),123);Date.now=()=>456;assert.equal(Reflect.get(transport,'now')(),456);}finally{Date.now=old;}
});
