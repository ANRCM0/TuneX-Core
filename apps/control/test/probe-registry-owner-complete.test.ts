import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProbeTypeRegistry, ProbeServiceRegistry, PROBE_TYPED_MEASUREMENTS, PROBE_SERVICE_MEASUREMENTS, PROBE_ECHO_MEASUREMENTS } from '../src/modules/probe-owner/public.ts';
import type { ProbeMachineEvidence, ProbeInstanceRecord, ProbeTypeQualification, ProbeTypeQualifications, ProbeMeasurementDescription } from '../src/modules/probe-owner/public.ts';
import { ProbeTypeRegistry as LegacyTypes, ProbeServiceRegistry as LegacyServices } from '../src/application/probe-type-qualifications.ts';
import * as legacyMeasurements from '../src/modules/probe-measurements.ts';
import type { ProbeTypesQualificationRequest, ProbeServicesQualificationRequest } from '../src/compatibility/public.ts';

const at=1800000000000,fp='a'.repeat(64),instanceId='1'.repeat(64);
const capabilities=['adp.3','native.direct.v1','tcp','probe.tcp-connect.v1','probe.tcp-ingress-connect.v1','probe.tcp-ingress-tls.v1'];
type Mutable<T>={-readonly [K in keyof T]:T[K]};
const typedRequest=(action:ProbeTypesQualificationRequest['action']='register'):ProbeTypesQualificationRequest=>({protocolVersion:3,probeVersion:2,kind:'probe-types-instance',nodeId:'node',bootId:'boot',sessionEpoch:2,instanceId,instanceGeneration:3,requestId:'3'.repeat(64),action,measurements:['tcp-connect-v1','tcp-ingress-connect-v1']});
const servicesRequest=(action:ProbeServicesQualificationRequest['action']='register'):ProbeServicesQualificationRequest=>({...typedRequest(action),probeVersion:3,kind:'probe-services-instance',measurements:['tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1']});
function fixture(version:2|3){
    const tx=Object.freeze({marker:Symbol('registry-tx')}),events:string[]=[];
    const machine:Mutable<ProbeMachineEvidence>={nodeId:'node',bootId:'boot',sessionEpoch:2,revoked:false,credentialRevoked:false,nodeCredentialUntil:at+90000,credentialUntil:at+90000,retireAfter:null,capabilities:[...capabilities]};
    let slot:ProbeInstanceRecord|undefined={nodeId:'node',bootId:'boot',sessionEpoch:2,fingerprint:fp,instanceId,generation:3,state:'registered',registeredAt:at-100,expiresAt:at+29900,revokedAt:null};
    let proof:ProbeTypeQualification|null=null,clockValue=at;
    const failure=new Error('original registry provider failure'),options={failure:'',onGet:()=>{},clockCalls:0};
    const event=(actual:typeof tx,name:string)=>{assert.equal(actual,tx);events.push(name);if(options.failure===name)throw failure;};
    const db={async transaction<T>(action:(value:typeof tx)=>Promise<T>){events.push('begin');const before=proof;try{const result=await action(tx);if(options.failure==='commit')throw failure;events.push('commit');return result;}catch(error){proof=before;events.push('rollback');throw error;}}};
    const machines={async read(actual:typeof tx,node:string,fingerprint:string){event(actual,'machine');assert.equal(node,'node');assert.equal(fingerprint,fp);return machine;}};
    const instances={async readCurrent(actual:typeof tx,node:string){event(actual,'slot');assert.equal(node,'node');return slot;}};
    const store:ProbeTypeQualifications<typeof tx>={async get(actual,node,lock){event(actual,'get:'+String(lock));assert.equal(node,'node');options.onGet();return proof;},async put(actual,value){assert.equal(actual,tx);proof=value;event(actual,'put');}};
    const clock=()=>{events.push('clock');options.clockCalls++;if(options.failure==='ack-clock'&&options.clockCalls===2)throw failure;return clockValue;};
    const owner=version===2?new ProbeTypeRegistry(db,machines,instances,store,clock):new ProbeServiceRegistry(db,machines,instances,store,clock);
    const call=(action:ProbeTypesQualificationRequest['action']='register')=>version===2?(owner as ProbeTypeRegistry<typeof tx>).handle('node',fp,2,typedRequest(action)):(owner as ProbeServiceRegistry<typeof tx>).handle('node',fp,2,servicesRequest(action));
    const old=(patch:Partial<ProbeTypeQualification>={}):ProbeTypeQualification=>({nodeId:'node',bootId:'boot',sessionEpoch:2,fingerprint:fp,instanceId,instanceGeneration:3,state:'qualified',qualifiedAt:at-50,expiresAt:at+29000,...patch});
    return {version,owner,call,tx,db,machines,instances,store,clock,machine,events,options,failure,old,proof:()=>proof,setProof:(value:ProbeTypeQualification|null)=>{proof=value;},slot:()=>slot!,setSlot:(value:ProbeInstanceRecord|undefined)=>{slot=value;},time:(value:number)=>{clockValue=value;}};
}

test('80 canonical registry identities and original measurement array/type contracts stay unchanged',()=>{
    assert.equal(LegacyTypes,ProbeTypeRegistry);assert.equal(LegacyServices,ProbeServiceRegistry);assert.equal(ProbeTypeRegistry.length,4);assert.equal(ProbeServiceRegistry.length,4);assert.deepEqual(Object.getOwnPropertyNames(ProbeTypeRegistry.prototype),['constructor','now','handle']);assert.deepEqual(Object.getOwnPropertyNames(ProbeServiceRegistry.prototype),['constructor','now','handle']);assert.equal(legacyMeasurements.PROBE_TYPED_MEASUREMENTS,PROBE_TYPED_MEASUREMENTS);assert.equal(legacyMeasurements.PROBE_SERVICE_MEASUREMENTS,PROBE_SERVICE_MEASUREMENTS);assert.equal(legacyMeasurements.PROBE_ECHO_MEASUREMENTS,PROBE_ECHO_MEASUREMENTS);
    assert.deepEqual(PROBE_TYPED_MEASUREMENTS,['tcp-connect-v1','tcp-ingress-connect-v1']);assert.deepEqual(PROBE_SERVICE_MEASUREMENTS,[...PROBE_TYPED_MEASUREMENTS,'tcp-ingress-tls-v1']);assert.deepEqual(PROBE_ECHO_MEASUREMENTS,[...PROBE_SERVICE_MEASUREMENTS,'tcp-ingress-echo-v1','udp-ingress-echo-v1']);for(const value of [PROBE_TYPED_MEASUREMENTS,PROBE_SERVICE_MEASUREMENTS,PROBE_ECHO_MEASUREMENTS])assert.equal(Object.isFrozen(value),false);
    const broadEcho:ProbeMeasurementDescription={measurement:'tcp-ingress-echo-v1',taskKind:'udp-ingress-echo',point:'agent-local-direct-ingress',capability:'probe.udp-ingress-echo.v1'};assert.equal(broadEcho.taskKind,'udp-ingress-echo');
});

test('80 new proof clamps credentials and replays without renewal, while replacement accepts only older proof generation',async()=>{
    for(const version of [2,3] as const){const f=fixture(version);f.machine.retireAfter=at+1200;const result=await f.call();assert.equal(result.qualified,true);assert.equal(result.expiresAt,new Date(at+1200).toISOString());assert.deepEqual(f.events,['begin','machine','slot','get:true','clock','put','commit','clock']);assert.equal(f.proof()!.instanceGeneration,3);assert.equal(f.proof()!.servicesVersion,version===3?1:undefined);assert.equal('echoVersion' in f.proof()!,false);
        const accepted=f.proof();f.events.length=0;f.time(at+100);assert.equal((await f.call()).qualified,true);assert.equal(f.proof(),accepted);assert.equal(f.events.includes('put'),false);assert.equal(f.proof()!.qualifiedAt,at);assert.equal(f.proof()!.expiresAt,at+1200);
        for(const generation of [3,4]){f.setProof(f.old({instanceId:'2'.repeat(64),instanceGeneration:generation}));await assert.rejects(f.call(),{code:'PROBE_PERMIT_UNAVAILABLE'});}
        f.setProof(f.old({instanceId:'2'.repeat(64),instanceGeneration:2}));assert.equal((await f.call()).qualified,true);assert.equal(f.proof()!.instanceId,instanceId);assert.equal(f.proof()!.instanceGeneration,3);
    }
});

test('80 v3 upgrades only the same live original proof and revoke preserves original marker spread and tombstones',async()=>{
    const services=fixture(3),old=services.old();services.setProof(old);await services.call();assert.deepEqual(services.proof(),{...old,servicesVersion:1});assert.equal(services.proof()!.qualifiedAt,old.qualifiedAt);assert.equal(services.proof()!.expiresAt,old.expiresAt);assert.equal(services.slot().generation,3);
    for(const version of [2,3] as const)for(const previous of ['absent','same','older'] as const){const f=fixture(version);if(previous!=='absent')f.setProof(f.old({servicesVersion:1,...(previous==='older'?{instanceGeneration:2,instanceId:'2'.repeat(64)}:{})}));f.machine.capabilities=[];const old=f.proof(),result=await f.call('revoke');assert.equal(result.qualified,false);assert.equal(f.proof()!.state,'revoked');assert.equal(f.proof()!.instanceGeneration,3);assert.equal(f.proof()!.servicesVersion,version===3||previous==='same'?1:undefined);assert.equal(f.proof()!.qualifiedAt,previous==='same'?old!.qualifiedAt:at);assert.equal(f.proof()!.expiresAt,previous==='same'?old!.expiresAt:f.slot().expiresAt);assert.equal('echoVersion' in f.proof()!,false);assert.equal(f.events.filter(value=>value==='put').length,1);
        await assert.rejects(f.call(),{code:'UNSUPPORTED_CAPABILITY'});f.machine.capabilities=[...capabilities];await assert.rejects(f.call(),{code:'PROBE_PERMIT_UNAVAILABLE'});
    }
    for(const version of [2,3] as const)for(const generation of [3,4]){const f=fixture(version);f.setProof(f.old({instanceGeneration:generation,instanceId:'2'.repeat(64)}));await assert.rejects(f.call('revoke'),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.equal(f.events.includes('put'),false);}
});

test('80 inspect preserves v2 historical qualification predicate and v3 registeredAt plus all-three-capabilities predicate',async()=>{
    for(const version of [2,3] as const){const f=fixture(version);f.setProof(f.old({servicesVersion:1,qualifiedAt:at-101,expiresAt:at+20000}));f.events.length=0;assert.equal((await f.call('inspect')).qualified,version===2);assert.deepEqual(f.events,['begin','machine','slot','get:false','clock','commit','clock']);assert.equal(f.proof()!.qualifiedAt,at-101);
        f.setProof(f.old({servicesVersion:1}));for(const capability of capabilities){f.machine.capabilities=capabilities.filter(value=>value!==capability);assert.equal((await f.call('inspect')).qualified,version===2&&capability!=='probe.tcp-ingress-connect.v1');}f.machine.capabilities=[...capabilities];
        f.machine.credentialUntil=at+1;f.machine.retireAfter=at+1;assert.equal((await f.call('inspect')).qualified,true);f.machine.credentialUntil=at+90000;f.machine.retireAfter=null;
        for(const state of ['revoked','quarantined'] as const){f.setProof(f.old({state,servicesVersion:1}));assert.equal((await f.call('inspect')).qualified,false);}f.setProof(null);assert.equal((await f.call('inspect')).qualified,false);
    }
    const types=fixture(2);types.machine.capabilities=['adp.3','native.direct.v1','tcp','probe.tcp-ingress-connect.v1'];assert.equal((await types.call()).qualified,true);const services=fixture(3);services.machine.capabilities=[...types.machine.capabilities];await assert.rejects(services.call(),{code:'UNSUPPORTED_CAPABILITY'});
});

test('80 exact slot/proof/time/evidence first-error precedence remains inside the original transaction',async()=>{
    for(const version of [2,3] as const){
        for(const patch of [{nodeId:'foreign'},{bootId:'other'},{sessionEpoch:1},{fingerprint:'b'.repeat(64)},{instanceId:'2'.repeat(64)},{generation:4}]){const f=fixture(version);f.setSlot({...f.slot(),...patch});f.setProof(f.old({state:'invalid'} as never));f.machine.revoked=true;await assert.rejects(f.call(),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.deepEqual(f.events,['begin','machine','slot','rollback']);}
        const absent=fixture(version);absent.setSlot(undefined);await assert.rejects(absent.call(),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.equal(absent.events.includes('clock'),false);
        for(const patch of [{expiresAt:at-50},{servicesVersion:2},{echoVersion:2,servicesVersion:1},{extra:true}]){const malformed=fixture(version);malformed.setProof(malformed.old(patch as never));malformed.machine.revoked=true;await assert.rejects(malformed.call(),{code:'INTEGRITY_FAILURE'});assert.deepEqual(malformed.events,['begin','machine','slot','get:true','rollback']);}
        const expired=fixture(version);expired.options.onGet=()=>expired.time(at+29900);await assert.rejects(expired.call(),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.equal(expired.events.includes('put'),false);
        const credential=fixture(version);credential.setSlot({...credential.slot(),expiresAt:at});credential.machine.credentialUntil=at;await assert.rejects(credential.call(),{code:'AUTHORIZATION_DENIED'});
        const future=fixture(version);future.setProof(future.old({qualifiedAt:at+1}));await assert.rejects(future.call('inspect'),{code:'CLOCK_UNCERTAIN',message:'Probe qualification is in the future'});
        for(const patch of [{qualifiedAt:at-101},{expiresAt:at},{expiresAt:at+29901},{state:'revoked' as const},{state:'quarantined' as const}]){const f=fixture(version);f.setProof(f.old(patch));await assert.rejects(f.call(),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.equal(f.events.includes('put'),false);}
        for(const state of ['revoked','quarantined'] as const){const f=fixture(version);f.setSlot({...f.slot(),state,revokedAt:at});await assert.rejects(f.call(),{code:'PROBE_PERMIT_UNAVAILABLE'});assert.equal(f.events.includes('put'),false);}
        for(const patch of [{revoked:true},{credentialRevoked:true},{credentialUntil:at},{nodeCredentialUntil:at},{retireAfter:at}]){const f=fixture(version);Object.assign(f.machine,patch);await assert.rejects(f.call('revoke'),{code:'AUTHORIZATION_DENIED'});assert.equal(f.events.includes('put'),false);}
        for(const value of [NaN,-1,253402300800000]){const f=fixture(version);f.time(value);await assert.rejects(f.call(),{code:'CLOCK_UNCERTAIN'});assert.equal(f.events.includes('put'),false);}
        for(const stage of ['machine','slot','get:true','put','commit']){const f=fixture(version),before=f.proof();f.options.failure=stage;await assert.rejects(f.call(),error=>error===f.failure);assert.equal(f.proof(),before);assert.equal(f.events.at(-1),'rollback');}
    }
});

test('80 v2 eagerly samples ACK time before projection, v3 lazily samples after both date projections, with no extra read',async t=>{
    const iso=Date.prototype.toISOString,projection:string[]=[];t.mock.method(Date.prototype,'toISOString',function(this:Date){projection.push('iso:'+this.getTime());return iso.call(this);});
    for(const version of [2,3] as const){const f=fixture(version);f.setProof(f.old({servicesVersion:1}));const clock=()=>{projection.push('clock');return at;};const owner=version===2?new ProbeTypeRegistry(f.db,f.machines,f.instances,f.store,clock):new ProbeServiceRegistry(f.db,f.machines,f.instances,f.store,clock);projection.length=0;if(version===2)await(owner as ProbeTypeRegistry<typeof f.tx>).handle('node',fp,2,typedRequest());else await(owner as ProbeServiceRegistry<typeof f.tx>).handle('node',fp,2,servicesRequest());assert.deepEqual(projection,version===2?['clock','clock','iso:'+(at-50),'iso:'+(at+29000),'iso:'+at]:['clock','iso:'+(at-50),'iso:'+(at+29000),'clock','iso:'+at]);
        const fail=fixture(version);fail.options.failure='ack-clock';await assert.rejects(fail.call(),error=>error===fail.failure);assert.equal(fail.proof()!.state,'qualified');assert.equal(fail.events.at(-2),'commit');assert.equal(fail.events.at(-1),'clock');
    }
});

test('80 default clocks stay captured at construction while parser and connection refusal stay before transactions',async t=>{
    let oldCalls=0,newCalls=0;t.mock.method(Date,'now',()=>{oldCalls++;return at;});
    const f=fixture(2),types=new ProbeTypeRegistry(f.db,f.machines,f.instances,f.store),services=new ProbeServiceRegistry(f.db,f.machines,f.instances,f.store);t.mock.method(Date,'now',()=>{newCalls++;return at+100000;});assert.equal((await types.handle('node',fp,2,typedRequest())).qualified,true);assert.equal((await services.handle('node',fp,2,servicesRequest())).qualified,true);assert.equal(oldCalls,4);assert.equal(newCalls,0);
    f.events.length=0;await assert.rejects(types.handle('other',fp,2,typedRequest()),{code:'SESSION_SUPERSEDED'});await assert.rejects(services.handle('node',fp,3,servicesRequest()),{code:'SESSION_SUPERSEDED'});await assert.rejects(types.handle('node',fp,2,{...typedRequest(),measurements:['tcp-connect-v1']} as never));await assert.rejects(services.handle('node',fp,2,{...servicesRequest(),measurements:PROBE_TYPED_MEASUREMENTS} as never));assert.deepEqual(f.events,[]);
});
