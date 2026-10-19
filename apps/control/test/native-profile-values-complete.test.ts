import assert from 'node:assert/strict';
import { test } from 'node:test';
import { digest } from '@tunex/contracts/shared';
import { parseRelayMessage } from '@tunex/contracts/runtime';
import type { RelayProfileConfig } from '@tunex/contracts/runtime';
import type { RuntimeRelayProfile, RuntimeRelayTransport, RuntimeRelayPlanInput, RuntimeMultihopInput, TransportProfileConfig, RelayConfigurationCodec } from '../src/framework/public.ts';
import { nativeRelayConfigurationCodec as codec, nativeTransitProfileConfig, nativeTransitPreparationIntent, compileRelayResources, compileRelayPlan, compileMultihopPlan } from '../src/compatibility/public.ts';
import type { NativeRuntimeFamily, NativeRuntimeRelayProfile, NativeRuntimeRelayTransport, NativeRuntimeRelayPlanInput, NativeRuntimeMultihopInput, NativeTransportProfileConfig, NativeRelayConfigurationCodec } from '../src/compatibility/public.ts';
import { multihopFixture } from './fixtures/multihop.ts';

type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
const familyCorrelations:[Equal<RuntimeRelayProfile['config'],unknown>,Equal<NativeRuntimeRelayProfile,RuntimeRelayProfile<NativeRuntimeFamily>>,Equal<NativeRuntimeRelayTransport<{tx:true}>,RuntimeRelayTransport<{tx:true},NativeRuntimeFamily>>,Equal<NativeRuntimeRelayPlanInput,RuntimeRelayPlanInput<NativeRuntimeFamily>>,Equal<NativeRuntimeMultihopInput,RuntimeMultihopInput<NativeRuntimeFamily>>,Equal<NativeTransportProfileConfig,TransportProfileConfig<NativeRuntimeFamily>>,Equal<NativeTransportProfileConfig,RelayProfileConfig>,Equal<NativeRelayConfigurationCodec,RelayConfigurationCodec<NativeRuntimeFamily>>]=[true,true,true,true,true,true,true,true];
const rawProfile=()=>({driver:'native.relay.v1',wireVersion:1,security:'mutual-tls13',protocols:['tcp','udp'],handshakeTimeoutSeconds:5,idleTimeoutSeconds:60,maxFrameBytes:65536,maxUdpDatagramBytes:16384,maxConnectionsPerNode:128});
function relay(){
    const multi=multihopFixture(),input={...multi,forward:{...multi.forward,spec:{...multi.forward.spec,path:{via:[multi.nodes[1]!.facts.nodeId]}}},nodes:multi.nodes.slice(0,2)},endpoint=input.endpoints[0]!,ports={tcp:endpoint.config.allowedTcpPorts[0]!,udp:endpoint.config.allowedTcpPorts[1]!};
    const resources=compileRelayResources(input.forward,input.nodes.map(n=>n.facts),input.profile,endpoint,ports);
    const reservations=resources.map((r,i)=>({...r,forwardId:input.forward.id,deploymentGeneration:9,bindingFence:i+1}));
    return {...input,endpoint,ports,resources,reservations};
}

test('131 native opaque Profile bindings preserve original typed config correlation and exact codec function identities',()=>{
    assert.ok(familyCorrelations.every(Boolean));assert.equal(Object.isFrozen(codec),true);
    assert.equal(codec.digest,digest);assert.deepEqual(Object.keys(codec),['formatTime','isId','isCounter','maxRevision','validRequestKey','profile','endpoint','readStored','encode','digest']);
    const input=rawProfile(),result=codec.profile(input);
    assert.deepEqual(result,parseRelayMessage('ProfileConfig',JSON.stringify(input)));assert.notEqual(result,input);assert.equal(Object.isFrozen(result),true);assert.equal(Object.isFrozen(result.protocols),true);
    assert.equal(Object.isFrozen(input),false);assert.equal(Object.isFrozen(input.protocols),false);
    assert.deepEqual(Object.keys(result),Object.keys(input));assert.equal(codec.encode(result),JSON.stringify(input));assert.equal(codec.digest(result),digest(input));
    assert.deepEqual(nativeTransitProfileConfig(input),result);
});

test('131 Profile JSON getters toJSON and native failures occur before schema parsing without eager key normalization',()=>{
    const events:string[]=[],failure=new Error('original Profile getter'),raw=rawProfile();
    const observed=Object.fromEntries(Object.entries(raw).map(([key,value])=>[key,value]));
    Object.defineProperty(observed,'driver',{enumerable:true,get(){events.push('driver');return raw.driver;}});
    Object.defineProperty(observed,'protocols',{enumerable:true,get(){events.push('protocols');return raw.protocols;}});
    const parsed=codec.profile(observed);assert.deepEqual(events,['driver','protocols']);assert.deepEqual(parsed,raw);
    events.length=0;assert.deepEqual(codec.profile({toJSON(){events.push('toJSON');return raw;}}),parsed);assert.deepEqual(events,['toJSON']);
    for(const parse of [codec.profile,nativeTransitProfileConfig]){
        assert.throws(()=>parse({get driver(){throw failure;}}),e=>e===failure);
        assert.throws(()=>parse({toJSON(){throw failure;}}),e=>e===failure);
        assert.throws(()=>parse({...raw,maxConnectionsPerNode:1n}),TypeError);
        const cycle:Record<string,unknown>={...raw};cycle.cycle=cycle;assert.throws(()=>parse(cycle),TypeError);
        for(const invalid of [{...raw,extra:true},{...raw,protocols:['udp','tcp']},{...raw,protocols:['tcp','tcp']},{...raw,maxUdpDatagramBytes:65537}])assert.throws(()=>parse(invalid),/INVALID_CONFIG:/);
    }
    assert.equal(codec.encode({toJSON(){return {z:1,a:2};}}),' {"z":1,"a":2}'.trim());
    assert.throws(()=>codec.encode({get value(){throw failure;}}),e=>e===failure);
    assert.throws(()=>codec.digest({get value(){throw failure;}}),e=>e===failure);
});

test('131 Relay resources keep Profile JSON then revision/digest then Endpoint then Forward precedence and detached frozen output',()=>{
    const f=relay(),events:string[]=[],failure=new Error('original resource getter'),profile={...f.profile};
    Object.defineProperty(profile,'config',{get(){events.push('config');return f.profile.config;}});
    Object.defineProperty(profile,'revision',{get(){events.push('revision');return 1;}});
    Object.defineProperty(profile,'configDigest',{get(){events.push('digest');return f.profile.configDigest;}});
    const result=compileRelayResources(f.forward,f.nodes.map(n=>n.facts),profile,f.endpoint,f.ports);
    assert.deepEqual(events,['config','revision','digest','revision']);assert.deepEqual(result,f.resources);assert.equal(Object.isFrozen(result),true);assert.ok(result.every(Object.isFrozen));
    assert.equal(Object.isFrozen(f.profile.config),false);
    const poison={get config(){throw failure;}};
    assert.throws(()=>compileRelayResources(null as never,[] ,poison as never,{} as never,{} as never),e=>e===failure);
    assert.throws(()=>compileRelayResources(null as never,[],{...f.profile,revision:0},poison as never,{} as never),{message:'INTEGRITY_FAILURE: Locked Profile integrity differs'});
    assert.throws(()=>compileRelayResources(null as never,[],{...f.profile,configDigest:'wrong'},poison as never,{} as never),{message:'INTEGRITY_FAILURE: Locked Profile integrity differs'});
    assert.throws(()=>compileRelayResources(null as never,[],f.profile,poison as never,{} as never),e=>e===failure);
});

test('131 Relay and multihop plans retain original Profile key reads native digest freeze and independent error access points',()=>{
    const f=relay(),events:string[]=[],profile={...f.profile};Object.defineProperty(profile,'config',{get(){events.push('config');return f.profile.config;}});
    const result=compileRelayPlan({...f,profile});assert.deepEqual(events,['config','config']);
    const {planDigest,...body}=result;assert.equal(planDigest,digest(body));assert.equal(Object.isFrozen(result),true);assert.ok(result.nodes.every(n=>Object.isFrozen(n.assignments)));
    for(const node of result.nodes)for(const assignment of node.assignments){const config=assignment.driver.config;assert.equal(assignment.driver.configDigest,digest(config));assert.equal(Object.isFrozen(config),true);assert.deepEqual((config as {profile:unknown}).profile,f.profile.config);}
    const failure=new Error('Profile must remain unread');
    assert.throws(()=>compileRelayPlan({...f,forward:null as never,profile:{get config(){throw failure;}} as never}),{message:'INVALID_CONFIG: Invalid Forward'});
    const broken={...f,nodes:f.nodes.map(n=>({...n,sessionEpoch:0})),profile:{get config(){throw failure;}} as never};
    assert.throws(()=>compileRelayPlan(broken),{message:'AUTHORIZATION_DENIED: Current session and bounded peer authority required'});
    const m=multihopFixture(),profile2={...m.profile};let reads=0;Object.defineProperty(profile2,'config',{get(){reads++;return m.profile.config;}});
    const multi=compileMultihopPlan({...m,profile:profile2});assert.equal(reads,2);const {planDigest:multiDigest,...multiBody}=multi;assert.equal(multiDigest,digest(multiBody));
    assert.equal(Object.isFrozen(multi),true);assert.equal(Object.isFrozen(m.profile.config),false);
    assert.throws(()=>compileMultihopPlan({...m,forward:null as never,profile:{get config(){throw failure;}} as never}),{message:'INVALID_CONFIG: Locked multi-hop Forward required'});
    assert.throws(()=>compileMultihopPlan({...m,reservations:[],profile:{...m.profile,configDigest:'wrong'}}),{message:'INTEGRITY_FAILURE: Locked multi-hop Profile differs'});
});

test('131 native Transit intent retains Profile fields raw getter ordering exact JSON values sorted CIDRs and original ISO errors',()=>{
    const f=multihopFixture(),plan=compileMultihopPlan(f),node=plan.nodes[1]!,assignment=node.assignments.find(a=>a.protocol==='tcp')!;
    const hop=(assignment.driver.config as {hop:any}).hop,path=hop.path;
    const binding=(part:any)=>({nodeId:part.nodeId,assignmentId:part.assignmentId,sessionEpoch:part.sessionEpoch,bindingFence:part.bindingFence,resource:{address:part.listenAddress,port:part.port}});
    const source={forward:f.forward,generation:plan.deploymentGeneration,pathDigest:hop.pathDigest,protocol:'tcp' as const,input:{profile:f.profile,peerPins:Object.fromEntries(path.map((p:any)=>[p.nodeId,p.peerFingerprint])),issuedAt:f.issuedAt,maxConnections:128},hop:{index:1},route:{nodes:path},local:binding(path[1]),up:binding(path[0]),down:binding(path[2]),endpoint:f.endpoints[1]!,node:f.nodes[1]!,until:plan.authorizationUntil};
    const result=nativeTransitPreparationIntent(source);assert.equal(result.profileId,f.profile.profileId);assert.equal(result.profileRevision,f.profile.revision);assert.equal(result.profileDigest,f.profile.configDigest);assert.equal(result.authorizationUntil,new Date(plan.authorizationUntil).toISOString());assert.equal(Object.isFrozen(result),true);
    const events:string[]=[],profile={...f.profile};for(const key of ['profileId','revision','configDigest'] as const)Object.defineProperty(profile,key,{configurable:true,get(){events.push(key);return f.profile[key];}});
    assert.deepEqual(nativeTransitPreparationIntent({...source,input:{...source.input,profile}}),result);assert.deepEqual(events,['profileId','revision','configDigest']);
    const failure=new Error('native Transit Profile key');Object.defineProperty(profile,'profileId',{get(){throw failure;}});
    assert.throws(()=>nativeTransitPreparationIntent({...source,input:{...source.input,profile},until:NaN}),e=>e===failure);
    for(const until of [NaN,Infinity,-Infinity])assert.throws(()=>nativeTransitPreparationIntent({...source,until}),RangeError);
});
