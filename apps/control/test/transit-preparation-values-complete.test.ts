import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as core from '@tunex/core';
import type { Forward } from '@tunex/core';
import { validCidr, validateTime } from '@tunex/contracts/shared';
import * as native from '../src/compatibility/public.ts';
import * as Transit from '../src/modules/transit-owner/public.ts';
import * as Legacy from '../src/modules/runtime/transit-preparation.ts';
import { validateTransitReservationSet as legacyValidate } from '../src/modules/runtime/transit-reservations.ts';
import { ControlError } from '../src/framework/public.ts';

type Any=Record<string,any>;
type Equal<A,B>=(<T>()=>T extends A?1:2)extends(<T>()=>T extends B?1:2)?true:false;
type Same<T extends true>=T;
export type OriginalTransitDeclarations=[
 Same<Equal<Transit.TransitInput,{forward:Forward;profile:import('../src/modules/transport-owner/public.ts').ResolvedProfile;nodes:readonly import('../src/framework/public.ts').RuntimeRelayNodeFacts[];endpoints:readonly import('../src/modules/relay-endpoint-owner/public.ts').ResolvedEndpoint[];ports:Readonly<Record<string,Partial<Record<'tcp'|'udp',number>>>>}>>,
 Same<Equal<Transit.TransitPreparationInput,Omit<Transit.TransitInput,'ports'>&{reservations:readonly Transit.ReservedTransitResource[];issuedAt:string;peerPins:Readonly<Record<string,string>>;maxConnections:number}>>,
 Same<Equal<typeof Transit.compileTransitPreparation,typeof Legacy.compileTransitPreparation>>,
 Same<Equal<typeof Transit.compileTransitResources,typeof Legacy.compileTransitResources>>,
];
function fixture(){
 const forward:Forward={id:'forward',scopeId:'scope',revision:4,spec:{enabled:true,protocols:['tcp','udp'],ingress:{nodeId:'ingress',listen:{address:'127.0.0.1',port:32001}},target:{host:'127.0.0.1',port:80},path:{via:['transit','egress']},transport:{profileId:'profile',configRevision:1}}};
 const profile={profileId:'profile',revision:1,configDigest:'',config:{driver:'native.relay.v1' as const,wireVersion:1 as const,security:'mutual-tls13' as const,protocols:['tcp','udp'] as ('tcp'|'udp')[],handshakeTimeoutSeconds:5,idleTimeoutSeconds:60,maxFrameBytes:65536,maxUdpDatagramBytes:16384,maxConnectionsPerNode:4096}};profile.configDigest=native.nativeValueDigest(profile.config);
 const issuedAt='2026-10-15T00:00:00Z',issued=native.nativeParseTime(issuedAt);
 const nodes=['ingress','transit','egress'].map((nodeId,index)=>({facts:{nodeId,scopeId:'scope',capabilities:['adp.3','adp.multihop.1','native.transit.v1','transit.wire.1','native.relay.v1','relay.wire.1','tcp','udp'],allowedListenerAddresses:['127.0.0.1'],allowedPorts:[32001],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false},sessionEpoch:index+2,credentialUntil:issued+600000,peers:[{fingerprint:'sha256:'+String(index+1).repeat(64),validUntil:issued+300000}]}));
 const endpoints=['transit','egress'].map((nodeId,index)=>({nodeId,revision:1,config:{listenAddress:'127.0.0.1',advertisedHost:'127.0.0.1',allowedTcpPorts:[32101+2*index,32102+2*index]}})),ports={transit:{tcp:32101,udp:32102},egress:{tcp:32103,udp:32104}};
 const resources=Transit.compileTransitResources({forward,profile,nodes,endpoints,ports}),reservations=resources.map((resource,index)=>({...resource,forwardId:'forward',deploymentGeneration:7,bindingFence:index+4}));
 return {forward,profile,nodes,endpoints,ports,reservations,issuedAt,peerPins:Object.fromEntries(nodes.map(node=>[node.facts.nodeId,node.peers[0]!.fingerprint])),maxConnections:64};
}
function load(overrides:Any={}){const exports:Any={},source=ts.transpileModule(readFileSync(new URL('../src/modules/transit-owner/preparation.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;new vm.Script('(function(exports,require){'+source+'\n})',{filename:'actual-transit-preparation.ts'}).runInThisContext()(exports,(name:string)=>{const providers:Any={'@tunex/core':core,'../../compatibility/public.ts':native};assert.ok(Object.hasOwn(providers,name),name);return {...providers[name],...overrides[name]};});return exports;}

test('65 original compiler validator shared native helpers and public input specializations retain exact aliases and import-time no effects',()=>{
 assert.equal(Transit.compileTransitPreparation,Legacy.compileTransitPreparation);assert.equal(Transit.compileTransitResources,Legacy.compileTransitResources);assert.equal(Transit.validateTransitReservationSet,legacyValidate);assert.equal(native.nativeTransitValidCidr,validCidr);assert.equal(native.nativeTransitValidateTime,validateTime);
 const observed:string[]=[],actual=load({'@tunex/core':{parseForward(){observed.push('parse');return assert.fail('module initialization cannot parse');}},'../../compatibility/public.ts':{nativeTransitValidateTime(){observed.push('time');return assert.fail('module initialization cannot read time');}}});assert.equal(typeof actual.compileTransitPreparation,'function');assert.equal(typeof actual.compileTransitResources,'function');assert.deepEqual(observed,[]);
});

test('65 resource compiler keeps Core parse topology Profile identity digest capability and policy competing first-refusal order as plain Errors',()=>{
 const cases:[string,(input:Any)=>void][]=[
  ['INVALID_CONFIG: Enabled multi-hop path and locked Profile required',f=>{f.forward.spec.enabled=false;f.profile.profileId='wrong';}],
  ['UNSUPPORTED_CAPABILITY: Transit requires at least three Nodes',f=>{f.forward.spec.path.via=['egress'];f.profile.profileId='wrong';}],
  ['AUTHORIZATION_DENIED: Profile revision differs',f=>{f.profile.profileId='wrong';f.profile.configDigest='bad';}],
  ['INTEGRITY_FAILURE: Profile config differs',f=>{f.profile.configDigest='sha256:'+'0'.repeat(64);f.nodes=[];}],
  ['AUTHORIZATION_DENIED: Complete Node/endpoint facts required',f=>{f.nodes.pop();f.ports.unexpected={tcp:1};}],
  ['INVALID_CONFIG: Unexpected internal port owner',f=>{f.ports.ingress={tcp:32001};f.nodes[1]=f.nodes[0];}],
  ['AUTHORIZATION_DENIED: Duplicate Node or missing endpoint',f=>{f.nodes[1]=f.nodes[0];f.nodes[0].facts.capabilities=[];}],
  ['UNSUPPORTED_CAPABILITY: Scoped multi-hop capability required',f=>{f.nodes[0].facts.scopeId='foreign';f.nodes[0].facts.egressPolicyRevision=0;}],
  ['UNSUPPORTED_CAPABILITY: Role-specific wire support required',f=>{f.nodes[1].facts.capabilities=f.nodes[1].facts.capabilities.filter((value:string)=>value!=='transit.wire.1');f.nodes[1].facts.egressPolicyRevision=0;}],
  ['AUTHORIZATION_DENIED: Missing destination policy',f=>{f.nodes[0].facts.allowedDestinationCidrs=['invalid'];f.nodes[0].facts.allowedPorts=[];}],
  ['AUTHORIZATION_DENIED: Ingress listener denied',f=>{f.nodes[0].facts.allowedPorts=[];f.endpoints[0].config.advertisedHost='169.254.169.254';}],
  ['AUTHORIZATION_DENIED: Internal bind address denied',f=>{f.nodes[1].facts.allowedListenerAddresses=[];}],
  ['AUTHORIZATION_DENIED: Neighbor target denied',f=>{f.nodes[0].facts.allowedDestinationCidrs=['10.0.0.0/8'];}],
  ['AUTHORIZATION_DENIED: Egress destination denied',f=>{f.nodes[2].facts.allowedDestinationCidrs=['10.0.0.0/8'];}],
  ['RESOURCE_CONFLICT: Missing internal TLS port',f=>{delete f.ports.transit.tcp;}],
  ['AUTHORIZATION_DENIED: Internal TLS port denied',f=>{f.ports.transit.tcp=32999;}],
  ['RESOURCE_CONFLICT: Physical TCP/UDP port collision',f=>{f.ports.transit.udp=f.ports.transit.tcp;}],
 ];
 for(const [message,mutate]of cases){const f=fixture();mutate(f);assert.throws(()=>Transit.compileTransitResources(f),error=>error instanceof Error&&!(error instanceof ControlError)&&error.constructor===Error&&error.message===message,message);}
 const f=fixture();f.endpoints[1]!.nodeId='transit';assert.throws(()=>Transit.compileTransitResources(f),{message:'AUTHORIZATION_DENIED: Duplicate Node or missing endpoint'});
});

test('65 preparation validates issued time before Forward parse and keeps repeated original checkPath resource compilation then exact digest frames',()=>{
 const events:string[]=[],frames:unknown[]=[],inputs:unknown[]=[],intents:unknown[]=[],error=new Error('first time');
 const stopped=load({'@tunex/core':{parseForward(){throw new Error('parse later');}},'../../compatibility/public.ts':{nativeTransitValidateTime(){throw error;}}});assert.throws(()=>stopped.compileTransitPreparation({get forward(){throw new Error('forward later');},issuedAt:'bad'}),cause=>cause===error);
 const f=fixture(),before=JSON.stringify(f);const actual=load({'@tunex/core':{parseForward(value:unknown){events.push('parseForward');inputs.push(value);return core.parseForward(value);}},'../../compatibility/public.ts':{
  nativeTransitValidateTime(value:string){events.push('validateTime');return native.nativeTransitValidateTime(value);},nativeParseTime(value:string){events.push('parseTime');return native.nativeParseTime(value);},compilePathTopology(value:Forward){events.push('topology');return native.compilePathTopology(value);},nativeTransitProfileConfig(value:unknown){events.push('profile');return native.nativeTransitProfileConfig(value);},nativeValueDigest(value:unknown){frames.push(value);return native.nativeValueDigest(value);},nativeTransitPreparationIntent(value:Any){events.push('intent:'+value.protocol);intents.push(value);return native.nativeTransitPreparationIntent(value as never);},
 }});
 const plan=actual.compileTransitPreparation(f);assert.deepEqual(events.filter(value=>['validateTime','parseTime','parseForward','topology','profile'].includes(value)),['validateTime','parseTime','parseForward','topology','profile','parseForward','topology','profile']);assert.equal(inputs.length,2);assert.equal(inputs[0],f.forward);assert.equal(inputs[1],f.forward);assert.deepEqual(events.slice(-2),['intent:tcp','intent:udp']);assert.equal(JSON.stringify(f),before);
 assert.equal(frames.length,10);assert.deepEqual(Object.keys(frames[0] as object),Object.keys(f.profile.config));assert.deepEqual(Object.keys(frames[2] as object),['nodeId','forwardId','protocol','role']);assert.deepEqual(frames[2],{nodeId:'ingress',forwardId:'forward',protocol:'tcp',role:'ingress'});
 assert.deepEqual(Object.keys(frames[8] as object),['forwardId','revision','scopeId','generation','profileId','profileRevision','profileDigest','nodes','assignments']);assert.deepEqual(Object.keys(frames[9] as object),['executable','scopeId','forwardId','forwardRevision','deploymentGeneration','profileDigest','pathDigest','authorizationUntil','activationOrder','assignments','intents']);assert.equal(plan.pathDigest,native.nativeValueDigest(frames[8]));assert.equal(plan.planDigest,native.nativeValueDigest(frames[9]));assert.deepEqual(plan.activationOrder,['egress','transit','ingress']);assert.equal(plan.authorizationUntil,native.nativeParseTime(f.issuedAt)+300000);
 for(const [index,frame]of (intents as Any[]).entries()){assert.equal(frame.input,f);assert.equal(frame.local,plan.assignments.find((item:Any)=>item.nodeId==='transit'&&item.protocol===(index?'udp':'tcp')));assert.equal(frame.endpoint,f.endpoints[1]);assert.equal(frame.node,f.nodes[1]);assert.equal(frame.until,plan.authorizationUntil);}
 assert.ok(Object.isFrozen(plan));assert.ok(Object.isFrozen(plan.assignments));assert.ok(Object.isFrozen(plan.assignments[0].resource));assert.ok(Object.isFrozen(plan.intents[0]));assert.equal(Object.isFrozen(f.nodes[0]),false);assert.equal(Object.isFrozen(f.reservations[0]),false);
});

test('65 preparation resource and identity refusal bounds retain exact first errors without parsing execution assignments',()=>{
 for(const maxConnections of [0,4097,1.5,NaN,Infinity]){const f=fixture();assert.throws(()=>Transit.compileTransitPreparation({...f,maxConnections}),{message:'INVALID_CONFIG: Invalid time or connection limit'});}for(const maxConnections of [1,4096])assert.equal(Transit.compileTransitPreparation({...fixture(),maxConnections}).intents[0]!.maxConnections,maxConnections);
 const cases:[string,(input:Any)=>void][]=[
  ['RESOURCE_CONFLICT: Exact reservations and peer identities required',f=>{f.reservations.shift();f.peerPins.ingress='wrong';}],
  ['RESOURCE_CONFLICT: Exact reservations and peer identities required',f=>{f.peerPins.extra='sha256:'+'9'.repeat(64);}],
  ['AUTHORIZATION_DENIED: Active distinct Node identity/session required',f=>{f.nodes[0].sessionEpoch=0;f.reservations[0].bindingFence=0;}],
  ['AUTHORIZATION_DENIED: Active distinct Node identity/session required',f=>{f.nodes[0].credentialUntil=native.nativeParseTime(f.issuedAt);}],
  ['AUTHORIZATION_DENIED: Active distinct Node identity/session required',f=>{f.nodes[0].peers.push({...f.nodes[0].peers[0]});}],
  ['AUTHORIZATION_DENIED: Active distinct Node identity/session required',f=>{f.nodes[0].peers[0].validUntil=native.nativeParseTime(f.issuedAt);}],
  ['AUTHORIZATION_DENIED: Active distinct Node identity/session required',f=>{f.nodes[1].peers[0].fingerprint=f.peerPins.ingress;f.peerPins.transit=f.peerPins.ingress;}],
  ['RESOURCE_CONFLICT: Missing or foreign fenced reservation',f=>{f.reservations[0].forwardId='other';}],
  ['RESOURCE_CONFLICT: Missing or foreign fenced reservation',f=>{f.reservations[0].bindingFence=0;}],
  ['RESOURCE_CONFLICT: Missing or foreign fenced reservation',f=>{f.reservations[0].address='other';}],
  ['INTEGRITY_FAILURE: Mixed deployment generation',f=>{f.reservations[1].deploymentGeneration=8;}],
 ];
 for(const [message,mutate]of cases){const f=fixture();mutate(f);assert.throws(()=>Transit.compileTransitPreparation(f),error=>error instanceof Error&&error.constructor===Error&&error.message===message,message);}
 const shortest=fixture();shortest.nodes[2]!.credentialUntil=native.nativeParseTime(shortest.issuedAt)+1;assert.equal(Transit.compileTransitPreparation(shortest).authorizationUntil,native.nativeParseTime(shortest.issuedAt)+1);
});

test('65 complete physical and logical reservation set validation precedes store ownership and retains exact ControlError message',()=>{
 const f=fixture(),resources=Transit.compileTransitResources(f);assert.equal(Transit.validateTransitReservationSet(f.forward,resources,7),undefined);
 const invalid=[[],[...resources,resources[0]!],resources.map((item,index)=>index===1?{...resources[0]!}:item),resources.map((item,index)=>index===2?{...item,role:'egress' as const}:item),resources.map((item,index)=>index===2?{...item,physicalProtocol:'udp' as const}:item),resources.map((item,index)=>index===0?{...item,address:'other'}:item),resources.map((item,index)=>index===0?{...item,port:1}:item)];
 for(const rows of invalid)assert.throws(()=>Transit.validateTransitReservationSet(f.forward,rows,7),{code:'RESOURCE_CONFLICT',status:409,message:'Incomplete, unauthorized or duplicate multi-hop reservation set'});for(const generation of [0,-1,NaN,Infinity,1.5])assert.throws(()=>Transit.validateTransitReservationSet(f.forward,resources,generation),{code:'RESOURCE_CONFLICT'});
 const getters:string[]=[],poison=resources.map(item=>new Proxy(item,{get(target,key,receiver){getters.push(String(key));return Reflect.get(target,key,receiver);}}));Transit.validateTransitReservationSet(f.forward,poison,7);assert.deepEqual(getters.slice(0,6),['nodeId','physicalProtocol','port','nodeId','physicalProtocol','port']);assert.equal(Object.isFrozen(poison),false);
});

test('65 native intent projector keeps exact neighbor fields sorted destination CIDRs ISO before JSON and strict parser without clock or authority effects',()=>{
 const f=fixture(),sources:Any[]=[],compiler=load({'../../compatibility/public.ts':{nativeTransitPreparationIntent(value:Any){sources.push(value);return native.nativeTransitPreparationIntent(value as never);}}});compiler.compileTransitPreparation(f);
 const source=sources[0]!,events:string[]=[],rawFrames:string[]=[],exports:Any={};
 const javascript=ts.transpileModule(readFileSync(new URL('../src/compatibility/native-transit-preparation.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
 const original=new Error('original strict parser');let refuse=false;
 new vm.Script('(function(exports,require){'+javascript+'\n})').runInThisContext()(exports,(name:string)=>{
  if(name==='@tunex/contracts/shared')return {validCidr,validateTime};
  if(name==='@tunex/contracts/runtime')return {parseRelayMessage(){return assert.fail('Intent projection cannot parse Profile again');}};
  assert.equal(name,'@tunex/contracts/experimental/transit');return {parseTransitIntent(raw:string){events.push('strict');rawFrames.push(raw);if(refuse)throw original;return {raw};}};
 });
 const node={...source.node,facts:{...source.node.facts,allowedDestinationCidrs:['127.0.0.0/8','10.0.0.0/8','127.0.0.0/8']}},input={...source.input,profile:{...source.input.profile}};
 const selected={...source,input,node},out=exports.nativeTransitPreparationIntent(selected);assert.equal(out.raw,rawFrames[0]);
 const expected={contractVersion:1,role:'relay-transit',driver:'native.transit.v1',security:'mutual-tls13',scopeId:'scope',forwardId:'forward',forwardRevision:4,deploymentGeneration:7,
  profileId:'profile',profileRevision:1,profileDigest:f.profile.configDigest,pathDigest:source.pathDigest,nodeId:'transit',assignmentId:source.local.assignmentId,sessionEpoch:3,bindingFence:source.local.bindingFence,protocol:'tcp',hopIndex:1,hopCount:3,
  listener:{address:'127.0.0.1',port:32101,protocol:'tcp'},upstream:{nodeId:'ingress',assignmentId:source.up.assignmentId,sessionEpoch:2,bindingFence:source.up.bindingFence,peerFingerprint:f.peerPins.ingress},
  downstream:{nodeId:'egress',assignmentId:source.down.assignmentId,sessionEpoch:4,bindingFence:source.down.bindingFence,peerFingerprint:f.peerPins.egress,endpoint:{host:'127.0.0.1',port:32103}},
  issuedAt:f.issuedAt,authorizationUntil:new Date(source.until).toISOString(),egressPolicyRevision:1,allowedDestinationCidrs:['10.0.0.0/8','127.0.0.0/8'],allowMetadataTargets:false,maxConnections:64};
 assert.equal(rawFrames[0],JSON.stringify(expected));assert.deepEqual(events,['strict']);assert.deepEqual(node.facts.allowedDestinationCidrs,['127.0.0.0/8','10.0.0.0/8','127.0.0.0/8']);assert.equal(Object.isFrozen(node),false);
 refuse=true;assert.throws(()=>exports.nativeTransitPreparationIntent(selected),error=>error===original);assert.equal(rawFrames.length,2);
 const first=new Error('first source getter');assert.throws(()=>exports.nativeTransitPreparationIntent({...selected,get forward(){throw first;},until:NaN}),error=>error===first);assert.equal(rawFrames.length,2);
 const later=new Error('CIDRs after ISO'),poison={...node,facts:{...node.facts,get allowedDestinationCidrs(){throw later;}}};
 assert.throws(()=>exports.nativeTransitPreparationIntent({...selected,node:poison,until:NaN}),RangeError);assert.throws(()=>exports.nativeTransitPreparationIntent({...selected,node:poison}),error=>error===later);assert.equal(rawFrames.length,2);
 assert.throws(()=>exports.nativeTransitPreparationIntent({...selected,input:{...input,profile:{...input.profile,configDigest:1n}}}),TypeError);assert.equal(rawFrames.length,2);
});
