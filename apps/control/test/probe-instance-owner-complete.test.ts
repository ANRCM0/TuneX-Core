import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { ProbeInstances, ProbeInstanceRegistry, ProbeNegotiator, PROBE_MACHINE_API_INTERFACE_VERSION } from '../src/modules/probe-owner/public.ts';
import type { ProbeMachineEvidence, ProbeInstanceRecord, ProbeInstanceStore } from '../src/modules/probe-owner/public.ts';
import { ProbeInstances as LegacyInstances } from '../src/application/probe-instances.ts';
import { ProbeInstanceRegistry as LegacyRegistry } from '../src/application/probe-instance-registry.ts';
import { ProbeNegotiator as LegacyNegotiator } from '../src/application/probe-negotiation.ts';
import type { ProbeNegotiationRequest, ProbeInstanceRequest } from '../src/compatibility/public.ts';

const at=1800000000000,fp='a'.repeat(64),instanceId='1'.repeat(64);
const command={bootId:'boot',instanceId,expectedGeneration:0};
function fixture(t:TestContext){
    const tx=Object.freeze({marker:Symbol('instance-owner')}),events:string[]=[];
    let now=at,row:ProbeInstanceRecord|undefined;
    const machine:{-readonly [K in keyof ProbeMachineEvidence]:ProbeMachineEvidence[K]}={nodeId:'node',bootId:'boot',sessionEpoch:2,revoked:false,credentialRevoked:false,nodeCredentialUntil:at+100000,credentialUntil:at+100000,retireAfter:null,capabilities:['adp.3','native.direct.v1','tcp']};
    const options={onLock:()=>{},onRead:()=>{},fail:false};
    t.mock.method(Date,'now',()=>{events.push('clock');return now;});
    const db={async transaction<T>(action:(value:typeof tx)=>Promise<T>){events.push('begin');const before=row;try{const result=await action(tx);events.push('commit');return result;}catch(error){row=before;events.push('rollback');throw error;}}};
    const machines={async read(value:typeof tx,node:string,fingerprint:string){assert.equal(value,tx);assert.equal(node,'node');assert.equal(fingerprint,fp);events.push('machine');options.onRead();return machine;}};
    const store:ProbeInstanceStore<typeof tx>={async read(value){assert.equal(value,tx);events.push('read');return row;},async lock(value){assert.equal(value,tx);events.push('lock');options.onLock();return row;},async replace(value,expected,next){assert.equal(value,tx);assert.equal(expected,row?.generation??0);events.push('replace');row=next;if(options.fail)throw Error('after instance replace');}};
    const owner=new ProbeInstances(db,machines,store);
    return {owner,db,machines,store,machine,events,options,row:()=>row,set:(value:ProbeInstanceRecord)=>{row=value;},time:(value:number)=>{now=value;},register:(input=command)=>owner.register('node',fp,2,input),revoke:()=>owner.revoke('node',fp,2,{...command,expectedGeneration:1})};
}

test('79 canonical instances/registry/negotiator identities and dynamic pre/post-lock machine time remain exact',async t=>{
    assert.equal(LegacyInstances,ProbeInstances);assert.equal(LegacyRegistry,ProbeInstanceRegistry);assert.equal(LegacyNegotiator,ProbeNegotiator);assert.equal(PROBE_MACHINE_API_INTERFACE_VERSION,1);assert.equal(ProbeInstances.length,3);assert.equal(ProbeInstanceRegistry.length,1);assert.equal(ProbeNegotiator.length,2);assert.deepEqual(Object.getOwnPropertyNames(ProbeInstances.prototype),['constructor','register','revoke','inspect']);assert.deepEqual(Object.getOwnPropertyNames(ProbeInstanceRegistry.prototype),['constructor','handle']);assert.deepEqual(Object.getOwnPropertyNames(ProbeNegotiator.prototype),['constructor','hello']);
    const f=fixture(t);f.options.onLock=()=>{f.time(at+900);};const result=await f.register();assert.equal(result.registeredAt,at+900);assert.deepEqual(f.events,['begin','machine','clock','lock','clock','replace','commit']);
    f.events.length=0;f.time(at+1000);assert.deepEqual(await f.register(),result);assert.deepEqual(f.events,['begin','machine','clock','lock','clock','commit']);assert.equal(f.row()!.expiresAt,result.expiresAt);
    f.events.length=0;f.options.onLock=()=>{t.mock.method(Date,'now',()=>{f.events.push('replacement-clock');return at+100000;});};await assert.rejects(f.register({...command,instanceId:'2'.repeat(64),expectedGeneration:1}),{code:'AUTHORIZATION_DENIED'});assert.deepEqual(f.events,['begin','machine','clock','lock','replacement-clock','rollback']);assert.equal(f.row()!.generation,1);
});

test('79 revoke performs both credential checks without direct capability and uses only original generation/instance match',async t=>{
    const f=fixture(t);await f.register();f.machine.capabilities=[];f.events.length=0;f.options.onLock=()=>{f.time(at+100);};const result=await f.revoke();assert.equal(result.revokedAt,at+100);assert.deepEqual(f.events,['begin','machine','clock','lock','clock','replace','commit']);
    f.events.length=0;assert.deepEqual(await f.revoke(),result);assert.equal(f.events.includes('replace'),false);
    f.set({...result,state:'registered',revokedAt:null});f.events.length=0;f.options.onLock=()=>{f.machine.credentialRevoked=true;};await assert.rejects(f.revoke(),{code:'AUTHORIZATION_DENIED'});assert.deepEqual(f.events,['begin','machine','clock','lock','clock','rollback']);assert.equal(f.row()!.state,'registered');
    f.machine.credentialRevoked=false;f.options.onLock=()=>{};f.set({...f.row()!,bootId:'prior-boot',sessionEpoch:1,fingerprint:'b'.repeat(64)});assert.equal((await f.revoke()).state,'revoked');
});

test('79 inspect stale precedence and original frozen projection never reserve or replace',async t=>{
    const f=fixture(t);assert.deepEqual(await f.owner.inspect('node',fp,2,'boot'),{generation:0,state:'absent',instance:null,executionEnabled:false});await f.register();
    for(const patch of [{bootId:'prior'},{sessionEpoch:1},{fingerprint:'b'.repeat(64)},{registeredAt:at+1},{expiresAt:at}]){const saved=f.row()!;f.set({...saved,...patch});f.events.length=0;const result=await f.owner.inspect('node',fp,2,'boot');assert.equal(result.state,'stale');assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.instance));assert.deepEqual(f.events,['begin','machine','read','clock','commit']);f.set(saved);}
    f.set({...f.row()!,state:'quarantined',expiresAt:at});assert.equal((await f.owner.inspect('node',fp,2,'boot')).state,'quarantined');
    f.machine.revoked=true;await assert.rejects(f.owner.inspect('node',fp,2,'boot'),{code:'AUTHORIZATION_DENIED'});
});

test('79 registry samples a newly installed clock only after owner return and retains committed ownership on ACK failure',async t=>{
    const f=fixture(t),request:ProbeInstanceRequest={protocolVersion:3,probeVersion:1,kind:'probe-instance',action:'register',nodeId:'node',bootId:'boot',sessionEpoch:2,instanceId,expectedGeneration:0};
    const registry=new ProbeInstanceRegistry({register:async(...args)=>{const result=await f.owner.register(...args);t.mock.method(Date,'now',()=>{f.events.push('ack-clock');return at+10;});return result;},revoke:f.owner.revoke.bind(f.owner),inspect:f.owner.inspect.bind(f.owner)});
    assert.equal((await registry.handle('node',fp,2,request)).serverTime,new Date(at+10).toISOString());assert.equal(f.events.at(-2),'commit');assert.equal(f.events.at(-1),'ack-clock');
    const broken=new ProbeInstanceRegistry({register:async(...args)=>{const result=await f.owner.register(...args);t.mock.method(Date,'now',()=>NaN);return result;},revoke:f.owner.revoke.bind(f.owner),inspect:f.owner.inspect.bind(f.owner)});
    await assert.rejects(broken.handle('node',fp,2,request));assert.equal(f.row()!.generation,1);assert.equal(f.row()!.state,'registered');
});

test('79 hello preserves parser/identity/fingerprint order and dynamic time inside the original transaction',async t=>{
    const f=fixture(t),hello:ProbeNegotiationRequest={protocolVersion:3,probeVersion:1,kind:'probe-hello',nodeId:'node',bootId:'boot',sessionEpoch:2,instanceId,capability:'probe.tcp-connect.v1',point:'agent-direct-egress',maxTimeoutMs:2000,maxAttempts:1,applicationPayloadBytes:0};
    const owner=new ProbeNegotiator(f.db,f.machines);f.options.onRead=()=>{t.mock.method(Date,'now',()=>{f.events.push('hello-clock');return at+77;});};assert.equal((await owner.hello('node',fp,2,hello)).serverTime,new Date(at+77).toISOString());assert.deepEqual(f.events,['begin','machine','hello-clock','commit']);
    f.events.length=0;await assert.rejects(owner.hello('other','bad',2,hello),{code:'SESSION_SUPERSEDED'});await assert.rejects(owner.hello('node','bad',2,hello),{code:'INVALID_CONFIG'});await assert.rejects(owner.hello('other','bad',2,{...hello,kind:'bad'} as never),/Unsupported Probe negotiation contract/);assert.deepEqual(f.events,[]);
});
