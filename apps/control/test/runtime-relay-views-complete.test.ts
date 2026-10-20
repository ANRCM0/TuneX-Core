import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import { RuntimeRelayHost } from '../src/framework/public.ts';
import { nativeRelayCompiler } from '../src/compatibility/public.ts';

// The existing relay-owner matrix covers transactions and publication. These
// cases isolate the original host's unchecked policy expressions and receivers.
const privateHost=(value:unknown)=>value as Record<string,any>;
function fixture(){
    const tx={},events:string[]=[],failure=new Error('original projection'),state={now:1000};
    const facts=[
        {facts:{nodeId:'ingress',egressPolicyRevision:1,allowMetadataTargets:false,allowedDestinationCidrs:['b','a','b']},sessionEpoch:1,credentialUntil:9000,peers:[{fingerprint:'pin-i',validUntil:8000}]},
        {facts:{nodeId:'egress',egressPolicyRevision:1,allowMetadataTargets:false,allowedDestinationCidrs:['b','a','b']},sessionEpoch:2,credentialUntil:7000,peers:[{fingerprint:'pin-e',validUntil:6000}]},
    ];
    const config={binding:{ingressNodeId:'ingress',egressNodeId:'egress'},egressPolicyRevision:1,allowMetadataTargets:false,allowedDestinationCidrs:['a','b'],peerFingerprints:['pin-e']};
    const assignment={role:'relay-ingress',forwardId:'forward',config,hop:undefined as any};
    const plan={forwardId:'forward',forwardRevision:1,deploymentGeneration:1,authorizationUntil:5000,endpointRevision:1,planDigest:'stored',nodes:[{nodeId:'ingress',sessionEpoch:1,assignments:[assignment]}]};
    const record={forward_id:'forward',target_revision:1,generation:1,body:plan};
    const forward={id:'forward',scopeId:'scope',revision:1,spec:{ingress:{nodeId:'ingress'},path:{via:['egress']},enabled:true}};
    const compiler={...nativeRelayCompiler,
        digest(this:unknown,value:unknown){assert.equal(this,compiler);events.push('digest');return value&&typeof value==='object'&&!Array.isArray(value)&&'forwardId' in value?'stored':JSON.stringify(value);},
        readValue<T>(this:unknown,value:unknown):T{assert.equal(this,compiler);events.push('read');return value as T;},
        relayAssignmentPolicy(this:unknown,value:any){assert.equal(this,compiler);assert.equal(value,assignment);events.push('relay-view');return value.config;},
        multihopAssignmentPolicy(this:unknown,value:any){assert.equal(this,compiler);assert.equal(value,assignment);events.push('hop-view');return value.hop;},
    };
    const nodes={async facts(this:unknown,t:unknown,id:string){assert.equal(this,nodes);assert.equal(t,tx);events.push(`facts:${id}`);return facts.find(n=>n.facts.nodeId===id)!;},
        async relayCredentialFacts(this:unknown,t:unknown,id:string){assert.equal(this,nodes);assert.equal(t,tx);events.push(`peers:${id}`);return facts.find(n=>n.facts.nodeId===id)!.peers;}};
    const store={async latest(this:unknown,t:unknown,id:string){assert.equal(this,store);assert.equal(t,tx);assert.equal(id,'forward');events.push('latest');return record;}};
    const forwarding={async authorizer(this:unknown,t:unknown,id:string){assert.equal(this,forwarding);assert.equal(t,tx);assert.equal(id,'forward');events.push('actor');return 'actor';}};
    const endpoints={async resolve(this:unknown,t:unknown,id:string){assert.equal(this,endpoints);assert.equal(t,tx);assert.equal(id,'egress');events.push('endpoint');return {revision:1};}};
    const options={compiler,nodes,store,forwards:forwarding,endpoints,transport:{},ledger:{},observations:{},policy:{...DEFAULT_POLICY,maxClockSkewSeconds:0},multihopEnabled:true,now(){events.push('now');return state.now;}};
    const host=new RuntimeRelayHost(options as never),internal=privateHost(host);
    internal.canExecute=async(t:unknown,actor:string,f:unknown)=>{assert.equal(t,tx);assert.equal(actor,'actor');assert.equal(f,forward);events.push('canExecute');return true;};
    internal.facts=async(t:unknown,actor:string,f:unknown)=>{assert.equal(t,tx);assert.equal(actor,'actor');assert.equal(f,forward);events.push('facts');return facts;};
    internal.multihopInput=async()=>{events.push('input');return {nodes:facts,endpoints:[{nodeId:'egress',revision:1}]};};
    return {host,internal,options,compiler,tx,events,failure,state,facts,config,assignment,plan,record,forward};
}

test('126 Relay constructor time methods precede projections and all option/policy reads without invoking providers',()=>{
    const sentinel=new Error('option must remain unread');
    for(const compiler of [undefined,{}, {parseTime(){}}, {parseTime:0,formatTime(){}}]){
        const options={compiler,get nodes(){throw sentinel;},get policy(){throw sentinel;}};
        assert.throws(()=>new RuntimeRelayHost(options as never),{message:'Runtime relay time codec is required'});
    }
    for(const compiler of [{parseTime(){},formatTime(){}},{parseTime(){},formatTime(){},relayAssignmentPolicy(){}}]){
        assert.throws(()=>new RuntimeRelayHost({compiler,get nodes(){throw sentinel;},get policy(){throw sentinel;}} as never),{message:'Runtime relay assignment projections are required'});
    }
    const calls:string[]=[],compiler={get parseTime(){calls.push('parse');return ()=>assert.fail('parse');},get formatTime(){calls.push('format');return ()=>assert.fail('format');},get relayAssignmentPolicy(){calls.push('relay');return ()=>assert.fail('relay');},get multihopAssignmentPolicy(){calls.push('hop');return ()=>assert.fail('hop');}};
    assert.throws(()=>new RuntimeRelayHost({compiler,get nodes(){calls.push('nodes');throw sentinel;}} as never),e=>e===sentinel);
    assert.deepEqual(calls,['parse','format','relay','hop','nodes']);
    const broken={get parseTime(){throw sentinel;}};
    assert.throws(()=>new RuntimeRelayHost({compiler:broken} as never),e=>e===sentinel);
});

test('126 native Relay and multihop views return exact unchecked mutable references with original getter and first-error timing',()=>{
    const events:string[]=[],failure=new Error('native getter'),config={hop:{path:[]}};
    const assignment={get driver(){events.push('driver');return {get config(){events.push('config');return config;}};}};
    assert.equal(nativeRelayCompiler.relayAssignmentPolicy(assignment as never),config);
    assert.deepEqual(events,['driver','config']);assert.equal(Object.isFrozen(config),false);
    events.length=0;assert.equal(nativeRelayCompiler.multihopAssignmentPolicy(assignment as never),config.hop);
    assert.deepEqual(events,['driver','config']);assert.equal(Object.isFrozen(config.hop),false);
    for(const value of [undefined,null,0,'raw',[]])assert.equal(nativeRelayCompiler.relayAssignmentPolicy({driver:{config:value}} as never),value);
    assert.equal(nativeRelayCompiler.multihopAssignmentPolicy({driver:{config:{}}} as never),undefined);
    assert.throws(()=>nativeRelayCompiler.multihopAssignmentPolicy({driver:{config:null}} as never),TypeError);
    assert.throws(()=>nativeRelayCompiler.relayAssignmentPolicy({get driver(){throw failure;}} as never),e=>e===failure);
    assert.throws(()=>nativeRelayCompiler.multihopAssignmentPolicy({driver:{config:{get hop(){throw failure;}}}} as never),e=>e===failure);
});

test('126 multihop pin some/some short circuits missing Node mismatched pins and expiry with conditional per-peer Now',()=>{
    const f=fixture(),hop={path:[{nodeId:'egress',peerFingerprint:'pin-e'}]};Object.assign(f.assignment,{hop});Object.assign(f.plan,{path:['ingress','egress']});
    assert.equal(f.internal.pinsChanged(f.plan,f.facts),false);assert.deepEqual(f.events,['hop-view','now']);
    f.events.length=0;f.facts[1]!.peers.unshift({fingerprint:'other',validUntil:0});
    assert.equal(f.internal.pinsChanged(f.plan,f.facts),false);assert.deepEqual(f.events,['hop-view','now']);
    f.events.length=0;f.facts[1]!.peers=[{fingerprint:'wrong',validUntil:9000}];
    assert.equal(f.internal.pinsChanged(f.plan,f.facts),true);assert.deepEqual(f.events,['hop-view']);
    f.events.length=0;hop.path[0]!.nodeId='missing';
    assert.equal(f.internal.pinsChanged(f.plan,f.facts),true);assert.deepEqual(f.events,['hop-view']);
    hop.path[0]!.nodeId='egress';f.facts[1]!.peers=[{fingerprint:'pin-e',validUntil:1000},{fingerprint:'pin-e',validUntil:1001}];f.events.length=0;
    assert.equal(f.internal.pinsChanged(f.plan,f.facts),false);assert.deepEqual(f.events,['hop-view','now','now']);
    f.facts[1]!.peers.pop();f.events.length=0;assert.equal(f.internal.pinsChanged(f.plan,f.facts),true);assert.deepEqual(f.events,['hop-view','now']);
    const poison={get path(){throw f.failure;}};Object.assign(f.assignment,{hop:poison});
    assert.throws(()=>f.internal.pinsChanged(f.plan,f.facts),e=>e===f.failure);
});

test('126 Relay authorization retains raw binding access policy digest sorting and peer conditional time order',async()=>{
    const f=fixture();assert.equal(await f.internal.authorized(f.tx,f.forward,f.plan),true);
    assert.deepEqual(f.events,['actor','canExecute','facts','endpoint','now','relay-view','digest','digest','now']);
    assert.deepEqual(f.facts[0]!.facts.allowedDestinationCidrs,['b','a','b']);assert.deepEqual(f.config.allowedDestinationCidrs,['a','b']);
    f.events.length=0;f.plan.nodes[0]!.sessionEpoch=99;assert.equal(await f.internal.authorized(f.tx,f.forward,f.plan),false);assert.equal(f.events.includes('relay-view'),false);
    f.plan.nodes[0]!.sessionEpoch=1;f.config.egressPolicyRevision=2;f.events.length=0;
    assert.equal(await f.internal.authorized(f.tx,f.forward,f.plan),false);assert.deepEqual(f.events.slice(-1),['relay-view']);
    f.config.egressPolicyRevision=1;f.config.allowMetadataTargets=true;f.events.length=0;
    assert.equal(await f.internal.authorized(f.tx,f.forward,f.plan),false);assert.equal(f.events.includes('digest'),false);
    f.config.allowMetadataTargets=false;f.config.allowedDestinationCidrs=['wrong'];f.events.length=0;
    assert.equal(await f.internal.authorized(f.tx,f.forward,f.plan),false);assert.equal(f.events.filter(e=>e==='now').length,1);
    f.config.allowedDestinationCidrs=['a','b'];f.config.binding.egressNodeId='missing';f.events.length=0;
    assert.equal(await f.internal.authorized(f.tx,f.forward,f.plan),false);assert.equal(f.events.filter(e=>e==='now').length,1);
    f.config.binding.egressNodeId='egress';f.config.peerFingerprints=['wrong'];f.events.length=0;
    assert.equal(await f.internal.authorized(f.tx,f.forward,f.plan),false);assert.equal(f.events.filter(e=>e==='now').length,1);
    f.config.peerFingerprints=['pin-e'];Object.defineProperty(f.config,'binding',{get(){throw f.failure;}});
    await assert.rejects(f.internal.authorized(f.tx,f.forward,f.plan),e=>e===f.failure);
});

test('126 authorization bound collects pins only after original facts/credentials awaits preserves Set and minimum/refusal',async()=>{
    const f=fixture();
    assert.equal(await f.host.authorizationBound(f.tx,[f.assignment] as never),5000);
    assert.deepEqual(f.events,['latest','read','digest','facts:ingress','peers:ingress','relay-view']);
    f.events.length=0;Object.assign(f.plan,{nodes:[{nodeId:'egress',sessionEpoch:2,assignments:[f.assignment,f.assignment]}]});
    f.facts[1]!.credentialUntil=4000;f.facts[1]!.peers[0]!.validUntil=3000;
    assert.equal(await f.host.authorizationBound(f.tx,[{...f.assignment,role:'direct'},f.assignment,f.assignment] as never),3000);
    assert.deepEqual(f.events,['latest','read','digest','facts:egress','peers:egress','relay-view','relay-view']);
    f.config.peerFingerprints=['pin-e','missing'];f.events.length=0;
    await assert.rejects(f.host.authorizationBound(f.tx,[f.assignment] as never),{code:'AUTHORIZATION_DENIED',status:403,message:'Pinned Relay authority expired'});
    f.compiler.relayAssignmentPolicy=function(){f.events.push('throw-view');throw f.failure;};f.events.length=0;
    await assert.rejects(f.host.authorizationBound(f.tx,[f.assignment] as never),e=>e===f.failure);
    assert.deepEqual(f.events,['latest','read','digest','facts:egress','peers:egress','throw-view']);
    f.events.length=0;assert.equal(await f.host.authorizationBound(f.tx,[{role:'direct'}] as never),Number.MAX_SAFE_INTEGER);assert.deepEqual(f.events,[]);
});

test('126 multihop authorization preserves path digest then bound then endpoint/pin/session/policy every order',async()=>{
    const f=fixture(),hop={path:[{nodeId:'egress',peerFingerprint:'pin-e'}],egressPolicyRevision:1,allowMetadataTargets:false,allowedDestinationCidrs:['a','b']};
    Object.assign(f.assignment,{hop});Object.assign(f.plan,{path:['ingress','egress'],endpointRevisions:{egress:1}});
    assert.equal(await f.internal.authorized(f.tx,f.forward,f.plan),true);
    assert.deepEqual(f.events,['actor','canExecute','digest','digest','now','input','hop-view','now','hop-view','digest','digest']);
    f.events.length=0;f.forward.spec.path.via=['other'];
    assert.equal(await f.internal.authorized(f.tx,f.forward,f.plan),false);assert.deepEqual(f.events,['actor','canExecute','digest','digest']);
    f.forward.spec.path.via=['egress'];f.plan.authorizationUntil=1000;f.events.length=0;
    assert.equal(await f.internal.authorized(f.tx,f.forward,f.plan),false);assert.equal(f.events.includes('input'),false);
    f.plan.authorizationUntil=5000;f.facts[0]!.sessionEpoch=99;f.events.length=0;
    assert.equal(await f.internal.authorized(f.tx,f.forward,f.plan),false);assert.equal(f.events.filter(e=>e==='hop-view').length,1);
    f.facts[0]!.sessionEpoch=1;hop.egressPolicyRevision=2;f.events.length=0;
    assert.equal(await f.internal.authorized(f.tx,f.forward,f.plan),false);assert.equal(f.events.filter(e=>e==='digest').length,2);
    hop.egressPolicyRevision=1;Object.defineProperty(hop,'allowedDestinationCidrs',{get(){throw f.failure;}});
    await assert.rejects(f.internal.authorized(f.tx,f.forward,f.plan),e=>e===f.failure);
});

test('126 pin collection multihop filter/map retains duplicate Set collapse and original malformed/getter failure',async()=>{
    const f=fixture(),hop={path:[{nodeId:'egress',peerFingerprint:'pin-e'},{nodeId:'egress',peerFingerprint:'pin-e'},{nodeId:'other',get peerFingerprint(){throw f.failure;}}]};
    Object.assign(f.assignment,{hop});Object.assign(f.plan,{path:['ingress','egress'],nodes:[{nodeId:'egress',sessionEpoch:2,assignments:[f.assignment]}]});
    assert.equal(await f.host.authorizationBound(f.tx,[f.assignment] as never),5000);
    assert.deepEqual(f.events,['latest','read','digest','facts:egress','peers:egress','hop-view']);
    Object.defineProperty(hop,'path',{get(){throw f.failure;}});f.events.length=0;
    await assert.rejects(f.host.authorizationBound(f.tx,[f.assignment] as never),e=>e===f.failure);
    assert.deepEqual(f.events,['latest','read','digest','facts:egress','peers:egress','hop-view']);
});
