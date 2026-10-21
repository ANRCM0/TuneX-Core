import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as core from '@tunex/core';
import * as native from '../src/compatibility/public.ts';
import * as framework from '../src/framework/public.ts';
import * as owner from '../src/modules/observation-service-owner/public.ts';
import { ObservationServices as Legacy } from '../src/application/observation-services.ts';
import * as oldValues from '../src/application/observation-service-values.ts';
import * as oldStorage from '../src/application/observation-service-storage-values.ts';
import * as oldPorts from '../src/modules/observation-service-ports.ts';
import type * as OldApi from '../src/application/observation-service-api.ts';
import type * as Flat from '../src/modules/observation-service-ports.ts';

type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Same<T extends true>=T;
export type ObservationServiceOriginalDeclarations=[
    Same<Equal<OldApi.ObservationServicesApi,owner.ObservationServicesApi>>,Same<Equal<OldApi.ObservationServiceEnvelope,owner.ObservationServiceEnvelope>>,
    Same<Equal<OldApi.ObservationServiceList,owner.ObservationServiceList>>,Same<Equal<OldApi.ObservationServiceDetail,owner.ObservationServiceDetail>>,
    Same<Equal<Flat.ObservationServiceConfig,owner.ObservationServiceConfig>>,Same<Equal<Flat.ObservationServiceHead,owner.ObservationServiceHead>>,
    Same<Equal<Flat.ObservationServiceRevision,owner.ObservationServiceRevision>>,Same<Equal<Flat.ObservationServiceAudit,owner.ObservationServiceAudit>>,
    Same<Equal<Flat.ObservationServiceReceipt,owner.ObservationServiceReceipt>>,Same<Equal<Flat.ObservationServiceStore<object>,owner.ObservationServiceStore<object>>>,
    Same<Legacy<object> extends owner.ObservationServicesApi?true:false>,Same<Equal<owner.ObservationServiceReadPort<object>,Pick<owner.ObservationServiceStore<object>,'head'|'revision'>>>,
    Same<Equal<owner.ObservationServicesApi,{
        admitRequest<T>(action:()=>Promise<T>):Promise<T>;list(actor:string,scope:string):Promise<owner.ObservationServiceList>;
        get(actor:string,scope:string,id:string,configRevision?:number):Promise<owner.ObservationServiceDetail>;
        publish(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,input:unknown):Promise<owner.ObservationServiceReceipt>;
        archive(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number):Promise<owner.ObservationServiceReceipt>;
    }>>
];
type Any=Record<string,any>;
const at=1800000000000,max=Number.MAX_SAFE_INTEGER,copy=<T>(value:T):T=>structuredClone(value);
const key=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64');
const config=()=>owner.parseObservationServiceConfig({version:2,purpose:'controlled-nonce-echo',endpoint:{address:'127.0.0.1',port:9000,protocols:['tcp','udp']},trust:{mode:'ed25519-echo-v1',publicKey:key},validFrom:at-1000,validUntil:at+600000},'scope','service');
const head=(serviceId='service')=>({serviceId,revision:1,configRevision:1,archived:false,recoverySuspended:false});
const revision=(number=1)=>{const value=config();return {configRevision:number,config:value,configDigest:native.nativeValueDigest(value),createdBy:'manager',createdAt:at};};
const audit=(index=0)=>({id:'audit-'+index,serviceId:'service',revision:1,configRevision:1,kind:'publish',actorId:'manager',createdAt:at+index});
const integrity={code:'INTEGRITY_FAILURE',status:409},invalid={code:'INVALID_CONFIG',status:422},busy={code:'OBSERVATION_SERVICE_BUSY',status:429,retryable:true};
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(existing=true){
    const trace:string[]=[],failure=new Error('original observation provider failure');
    const state:Any={head:existing?head():null,revisions:existing?{1:revision()}: {},audits:[],responses:[],claims:[],scope:false,count:0,now:at,tx:null,fail:'',replay:null,list:undefined,losses:0,authorization:[],readNumbers:[]};
    const check=(tx:unknown,label:string)=>{assert.equal(tx,state.tx);trace.push(label);if(state.fail===label)throw failure;};
    const snapshot=()=>copy({head:state.head,revisions:state.revisions,audits:state.audits,responses:state.responses,scope:state.scope});
    const db={async transaction<T>(action:(tx:object)=>Promise<T>){assert.equal(state.tx,null);const saved=snapshot(),tx={};state.tx=tx;trace.push('begin');try{const result=await action(tx);trace.push('commit');return result;}catch(error){Object.assign(state,saved);trace.push('rollback');throw error;}finally{state.tx=null;}}};
    const auth={async scope(tx:unknown,actor:string,scope:string,manage?:boolean){assert.equal(tx,state.tx);assert.equal(actor,'selfservice-manager');assert.equal(scope,'scope');assert.equal(manage,true);},async owner(tx:unknown,actor:string,scope:string,...extra:unknown[]){check(tx,'auth');assert.equal(scope,'scope');assert.deepEqual(extra,[]);state.authorization.push({actor,scope,authority:'owner'});if(actor!=='actor')throw new framework.ControlError('AUTHORIZATION_DENIED',403,'Scope owner permission required');}};
    const requests={async claim(tx:unknown,request:unknown){check(tx,'claim');state.claims.push(request);return state.replay;},async respond(tx:unknown,request:unknown,response:unknown){state.responses.push({request,response});check(tx,'respond');}};
    const store={async lockScope(tx:unknown,scope:string){assert.equal(scope,'scope');state.scope=true;check(tx,'lock');},async count(tx:unknown,scope:string){assert.equal(scope,'scope');check(tx,'count');return state.count;},
        async list(tx:unknown,scope:string){assert.equal(scope,'scope');check(tx,'list');return state.list===undefined?(state.head?[state.head]:[]):state.list;},
        async head(tx:unknown,scope:string,id:string,lock=false){assert.equal(scope,'scope');assert.equal(id,'service');check(tx,'head:'+lock);return state.head;},
        async revision(tx:unknown,scope:string,id:string,number:number){assert.equal(scope,'scope');assert.equal(id,'service');state.readNumbers.push(number);check(tx,'revision');return state.revisions[number]??null;},
        async insertRevision(tx:unknown,scope:string,id:string,value:unknown){assert.equal(scope,'scope');assert.equal(id,'service');state.revisions[(value as Any).configRevision]=value;check(tx,'insert');},
        async putHead(tx:unknown,scope:string,value:unknown){assert.equal(scope,'scope');state.head=value;check(tx,'put');},async audit(tx:unknown,scope:string,value:unknown){assert.equal(scope,'scope');state.audits.push(value);check(tx,'audit');},
        async audits(tx:unknown,scope:string,id:string){assert.equal(scope,'scope');assert.equal(id,'service');check(tx,'audits');return state.audits;},async auditLosses(tx:unknown,scope:string){assert.equal(scope,'scope');check(tx,'losses');return state.losses;}};
    const clock=()=>{trace.push('clock');if(state.fail==='clock')throw failure;return state.now;};
    const create=()=>new owner.ObservationServices<object>(db,auth,requests as never,store as never,clock,true,true);
    const publish=(input:unknown=config(),expected=state.head?.revision??0)=>create().publish('actor','scope','service','key',expected,input);
    const archive=(expected=state.head?.revision??1)=>create().archive('actor','scope','service','key',expected);
    return {state,trace,failure,db,auth,requests,store,clock,create,publish,archive,snapshot};
}
function load(path:string,providers:Any={}){const exports:Any={};const source=ts.transpileModule(readFileSync(new URL('../src/'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;new vm.Script(source,{filename:'original-'+path}).runInNewContext({exports,require(id:string){assert.ok(Object.hasOwn(providers,id),id);return providers[id];}});return exports;}

test('78 original public and legacy aliases metadata parsers receipts references and runtime-mutable limit identity remain exact',()=>{
    assert.equal(Legacy,owner.ObservationServices);assert.equal(Legacy.prototype,owner.ObservationServices.prototype);assert.equal(owner.OBSERVATION_SERVICE_MODULE_INTERFACE_VERSION,2);assert.equal(owner.OBSERVATION_SERVICE_API_INTERFACE_VERSION,1);
    assert.equal(oldPorts.OBSERVATION_SERVICE_LIMITS,owner.OBSERVATION_SERVICE_LIMITS);assert.equal(oldPorts.OBSERVATION_SERVICE_ALPN,owner.OBSERVATION_SERVICE_ALPN);assert.equal(oldStorage.observationServiceStorageValues,owner.observationServiceStorageValues);
    for(const name of ['observationObject','observationServerName','observationAddress','observationServiceId','observationTime','observationHash','observationServiceIdentity','observationTrust','parseObservationServiceConfig','parseObservationServiceHead','parseObservationServiceRevision','parseObservationServiceAudit','parseObservationServiceReceipt'] as const)assert.equal(oldValues[name],owner[name]);
    assert.equal(owner.parseObservationServiceReference,owner.parseProbeServiceReference);assert.deepEqual(Object.getOwnPropertyNames(Legacy.prototype).sort(),['constructor','now','envelope','bounded','admitRequest','admitted','losses','list','get','publish','archive','command'].sort());
    const isolated=load('modules/observation-service-owner/contracts.ts').OBSERVATION_SERVICE_LIMITS;assert.equal(Object.isFrozen(isolated),false);isolated.servicesPerScope=31;assert.equal(isolated.servicesPerScope,31);assert.deepEqual(JSON.parse(JSON.stringify({...isolated,servicesPerScope:32})),{servicesPerScope:32,revisionsPerService:64,auditPerScope:256,auditPage:16,certificateBytes:8192,configBytes:16384,responseBytes:131072,validityMs:604800000});
    assert.equal(owner.observationServiceId('a'.repeat(64)),true);for(const value of ['',null,'a'.repeat(65),'bad/id','service\n'])assert.equal(owner.observationServiceId(value),false);
    for(const value of [0,at,253402300799999])assert.equal(owner.observationTime(value),true);for(const value of [-1,0.5,NaN,253402300800000,'0'])assert.equal(owner.observationTime(value),false);
    assert.equal(owner.observationHash('sha256:'+'a'.repeat(64)),true);for(const value of ['sha256:'+'A'.repeat(64),'sha256:'+'a'.repeat(64)+'\n',null])assert.equal(owner.observationHash(value),false);
    const h=head(),r=revision(),a=audit(),receipt={status:202,body:{...h,configDigest:r.configDigest,changed:true}},reference={serviceId:'service',revision:1,configRevision:1,configDigest:r.configDigest};
    for(const input of [h,Object.assign(Object.create(null),h)])assert.deepEqual(owner.parseObservationServiceHead(input),h);
    for(const patch of [{extra:true},{revision:0},{revision:0.5},{configRevision:0},{configRevision:65},{revision:1,configRevision:2},{archived:1},{recoverySuspended:0},{serviceId:'bad/id'}])assert.throws(()=>owner.parseObservationServiceHead({...h,...patch}),invalid);
    for(const patch of [{extra:true},{configDigest:'sha256:'+'0'.repeat(64)},{configRevision:65},{createdBy:''},{createdAt:-1},{config:{...r.config,extra:true}}])assert.throws(()=>owner.parseObservationServiceRevision({...r,...patch},'scope','service'),invalid);
    assert.deepEqual(owner.parseObservationServiceRevision(r,'scope','service'),r);for(const patch of [{extra:true},{id:''},{kind:'recover'},{actorId:''},{createdAt:253402300800000},{revision:0},{revision:1,configRevision:2}])assert.throws(()=>owner.parseObservationServiceAudit({...a,...patch}),invalid);
    assert.deepEqual(owner.parseObservationServiceAudit(a),a);assert.deepEqual(owner.parseObservationServiceReceipt(receipt,'service'),receipt);
    for(const input of [{...receipt,status:200},{...receipt,extra:true},{...receipt,body:{...receipt.body,serviceId:'other'}},{...receipt,body:{...receipt.body,changed:1}},{...receipt,body:{...receipt.body,extra:true}}])assert.throws(()=>owner.parseObservationServiceReceipt(input,'service'),invalid);
    assert.deepEqual(owner.parseObservationServiceReference(reference),reference);for(const patch of [{extra:true},{revision:0},{configRevision:65},{revision:1,configRevision:2},{configDigest:'sha256:'+'f'.repeat(64)+'\n'},{serviceId:'a'.repeat(65)}])assert.throws(()=>owner.parseObservationServiceReference({...reference,...patch}),invalid);
});

test('78 constructor captures default wall clock without reading it retains original flags and starts independent empty gates',()=>{
    const f=fixture(),state={factories:0,reads:0,mono:0,bytes:0},first=()=>{state.reads++;return at;},second=()=>at+1;let current=first;
    const api=load('modules/observation-service-owner/service.ts',{'@tunex/core':core,'../../framework/public.ts':framework,'./contracts.ts':owner,'./values.ts':owner,
        '../../compatibility/public.ts':{...native,nativeWallClockSource:()=>{state.factories++;return current;},nativeMonotonicNow:()=>state.mono,jsonUtf8Bytes:()=>state.bytes}});
    assert.equal(state.factories+state.reads,0);const a=new api.ObservationServices(f.db,f.auth,f.requests,f.store),b=new api.ObservationServices(f.db,f.auth,f.requests,f.store);assert.equal(state.factories,2);assert.equal(state.reads,0);assert.equal(a.clock,first);assert.equal(a.measurementAvailable,false);assert.equal(a.echoAvailable,false);assert.equal(a.active+a.requestsActive+a.actors.size,0);assert.notEqual(a.actors,b.actors);assert.equal(a.db,f.db);assert.equal(a.store,f.store);
    current=second;assert.equal(a.now(),at);const c=new api.ObservationServices(f.db,f.auth,f.requests,f.store,undefined,true,true);assert.equal(c.now(),at+1);assert.equal(c.measurementAvailable,true);assert.equal(c.echoAvailable,true);const explicit=()=>at+2,d=new api.ObservationServices(f.db,f.auth,f.requests,f.store,explicit);assert.equal(state.factories,3);assert.equal(d.clock,explicit);
    for(const value of [-1,0.5,NaN,Infinity,253402300800000]){const bad=new api.ObservationServices(f.db,f.auth,f.requests,f.store,()=>value);assert.throws(()=>bad.now(),integrity);}
    state.bytes=131072;const response={nested:{accepted:true}};assert.equal(a.bounded(response),response);assert.ok(Object.isFrozen(response.nested));state.bytes=131073;assert.throws(()=>a.bounded({}),integrity);assert.equal(f.trace.length,0);
});

test('78 request and actor admission are independent per-instance gates with two active slots exact monotonic cooldown and finally cleanup',async()=>{
    const f=fixture(),state={mono:0};const api=load('modules/observation-service-owner/service.ts',{'@tunex/core':core,'../../framework/public.ts':framework,'./contracts.ts':owner,'./values.ts':owner,'../../compatibility/public.ts':{...native,nativeMonotonicNow:()=>state.mono}});
    const create=()=>new api.ObservationServices(f.db,f.auth,f.requests,f.store,()=>at),a=create(),b=create(),one=deferred<number>(),two=deferred<number>();let actions=0;
    const first=a.admitRequest(()=>{actions++;return one.promise;}),second=a.admitRequest(()=>{actions++;return two.promise;});assert.equal(a.requestsActive,2);await assert.rejects(a.admitRequest(async()=>++actions),busy);assert.equal(await b.admitRequest(async()=>3),3);assert.equal(await a.admitted('independent',async()=>4),4);one.resolve(1);assert.equal(await first,1);two.reject(f.failure);await assert.rejects(second,error=>error===f.failure);assert.equal(a.requestsActive,0);await assert.rejects(a.admitRequest(()=>{throw f.failure;}),error=>error===f.failure);assert.equal(a.requestsActive,0);assert.equal(actions,2);
    const held=deferred<number>(),other=deferred<number>(),x=a.admitted('actor-a',()=>held.promise),y=a.admitted('actor-b',()=>other.promise);assert.equal(a.active,2);await assert.rejects(a.admitted('actor-c',async()=>0),busy);await assert.rejects(a.admitted('actor-a',async()=>0),busy);assert.equal(await b.admitted('actor-a',async()=>5),5);
    state.mono=50;held.resolve(6);assert.equal(await x,6);assert.equal(a.actors.get('actor-a').until,1050);state.mono=1049;await assert.rejects(a.admitted('actor-a',async()=>0),busy);state.mono=1050;assert.equal(await a.admitted('actor-a',async()=>7),7);other.reject(f.failure);await assert.rejects(y,error=>error===f.failure);assert.equal(a.active,0);assert.equal(a.actors.get('actor-b').until,2050);state.mono=2050;await assert.rejects(a.admitted('actor-b',()=>{throw f.failure;}),error=>error===f.failure);assert.equal(a.active,0);assert.equal(a.actors.get('actor-b').until,3050);
    const full=create();state.mono=0;for(let i=0;i<128;i++)await full.admitted('actor-'+i,async()=>i);assert.equal(full.actors.size,128);state.mono=999;await assert.rejects(full.admitted('overflow',async()=>0),busy);state.mono=1000;assert.equal(await full.admitted('new',async()=>9),9);assert.equal(full.actors.size,1);const pending=deferred<number>(),running=full.admitted('held',()=>pending.promise);state.mono=100000;await assert.rejects(full.admitted('held',async()=>0),busy);assert.equal(full.actors.get('held').active,true);pending.resolve(1);await running;assert.equal(full.active,0);assert.equal(f.trace.length,0);
});

test('78 original publication trace owner replay Scope head CAS prior clock quotas immutable revision head audit respond remains one transaction',async()=>{
    const f=fixture(false),input=config(),result=await f.publish(input);assert.deepEqual(f.trace,['begin','auth','claim','lock','head:true','clock','count','insert','put','audit','respond','commit']);assert.deepEqual(result,{status:202,body:{...head(),configDigest:native.nativeValueDigest(input),changed:true}});assert.ok(Object.isFrozen(result.body));assert.deepEqual(f.state.authorization,[{actor:'actor',scope:'scope',authority:'owner'}]);assert.equal(f.state.audits[0].actorId,'actor');assert.equal(f.state.audits[0].kind,'publish');assert.equal(f.state.audits[0].createdAt,at);assert.equal(f.state.revisions[1].createdBy,'actor');assert.equal(f.state.revisions[1].createdAt,at);assert.deepEqual(f.state.responses[0].response,result);
    const request=f.state.claims[0],expected=native.nativeCommandRequest('actor','scope','key','PUT','/api/v1/scopes/scope/observation-services/service',{expectedRevision:0,config:input});assert.deepEqual(request,expected);
    f.trace.length=0;const unchanged=await f.publish(input);assert.equal(unchanged.status,200);assert.equal(unchanged.body.changed,false);assert.equal(unchanged.body.revision,1);assert.deepEqual(f.trace,['begin','auth','claim','lock','head:true','revision','clock','respond','commit']);assert.equal(f.state.audits.length,1);assert.equal(Object.keys(f.state.revisions).length,1);
    f.trace.length=0;f.state.head.recoverySuspended=true;const resumed=await f.publish(input);assert.equal(resumed.status,202);assert.equal(resumed.body.revision,2);assert.equal(resumed.body.configRevision,1);assert.equal(resumed.body.recoverySuspended,false);assert.deepEqual(f.trace,['begin','auth','claim','lock','head:true','revision','clock','put','audit','respond','commit']);assert.equal(Object.keys(f.state.revisions).length,1);
    f.trace.length=0;const changed=await f.publish({...input,endpoint:{...input.endpoint,port:9001}});assert.equal(changed.body.revision,3);assert.equal(changed.body.configRevision,2);assert.deepEqual(f.trace,['begin','auth','claim','lock','head:true','revision','clock','insert','put','audit','respond','commit']);assert.equal(f.state.revisions[1].config.endpoint.port,9000);assert.equal(f.state.revisions[2].config.endpoint.port,9001);
    f.trace.length=0;const archived=await f.archive();assert.equal(archived.status,202);assert.equal(archived.body.revision,4);assert.equal(archived.body.configRevision,2);assert.equal(archived.body.archived,true);assert.equal(f.state.audits.at(-1).kind,'archive');assert.deepEqual(f.trace,['begin','auth','claim','lock','head:true','revision','clock','put','audit','respond','commit']);
    f.trace.length=0;const repeated=await f.archive();assert.equal(repeated.status,200);assert.equal(repeated.body.changed,false);assert.equal(repeated.body.revision,4);assert.deepEqual(f.trace,['begin','auth','claim','lock','head:true','revision','clock','respond','commit']);await assert.rejects(f.publish(),{code:'OBSERVATION_SERVICE_ARCHIVED',status:409});
});

test('78 authorized replay precedes every metadata lock current clock quota and immutable read while corrupt receipts fail before Scope',async()=>{
    const f=fixture(),receipt={status:202,body:{...head(),configDigest:revision().configDigest,changed:true}};f.state.replay=receipt;f.state.head=null;f.state.revisions={};f.state.count=999;f.state.now=-1;assert.deepEqual(await f.publish(config(),0),receipt);assert.deepEqual(f.trace,['begin','auth','claim','commit']);assert.equal(f.state.responses.length,0);
    f.trace.length=0;f.state.replay={status:200,body:{...receipt.body,changed:false}};assert.equal((await f.archive(1)).status,200);assert.deepEqual(f.trace,['begin','auth','claim','commit']);
    for(const input of [{...receipt,status:200},{...receipt,body:{...receipt.body,serviceId:'other'}},{...receipt,body:{...receipt.body,configRevision:65}},{...receipt,extra:true}]){const bad=fixture();bad.state.replay=input;await assert.rejects(bad.publish(),integrity);assert.deepEqual(bad.trace,['begin','auth','claim','rollback']);}
    const denied=fixture();denied.state.replay=receipt;denied.state.fail='auth';await assert.rejects(denied.publish(),error=>error===denied.failure);assert.deepEqual(denied.trace,['begin','auth','rollback']);
});

test('78 conflicts archive reuse corrupt prior history clock expiry seven-day quotas and safe exhaustion keep original refusal precedence',async()=>{
    const cases:Array<[string,(f:ReturnType<typeof fixture>)=>void,unknown,string[]]>=[
        ['CAS',f=>{f.state.head.revision=2;f.state.head.archived=true;},{code:'REVISION_CONFLICT'},['begin','auth','claim','lock','head:true','rollback']],
        ['bad-head',f=>{f.state.head.extra=true;},integrity,['begin','auth','claim','lock','head:true','rollback']],
        ['other-head',f=>{f.state.head.serviceId='other';},integrity,['begin','auth','claim','lock','head:true','rollback']],
        ['archived',f=>{f.state.head.archived=true;},{code:'OBSERVATION_SERVICE_ARCHIVED'},['begin','auth','claim','lock','head:true','rollback']],
        ['missing-prior',f=>{f.state.revisions={};},integrity,['begin','auth','claim','lock','head:true','revision','rollback']],
        ['bad-prior',f=>{f.state.revisions[1].configDigest='sha256:'+'0'.repeat(64);},integrity,['begin','auth','claim','lock','head:true','revision','rollback']],
        ['wrong-number',f=>{f.state.revisions[1].configRevision=2;},integrity,['begin','auth','claim','lock','head:true','revision','rollback']],
        ['clock-before-history',f=>{f.state.now=at-1;},{code:'CLOCK_UNCERTAIN'},['begin','auth','claim','lock','head:true','revision','clock','rollback']],
        ['invalid-clock',f=>{f.state.now=-1;},integrity,['begin','auth','claim','lock','head:true','revision','clock','rollback']],
        ['expired',f=>{f.state.now=config().validUntil;},{code:'OBSERVATION_SERVICE_EXPIRED'},['begin','auth','claim','lock','head:true','revision','clock','rollback']],
    ];
    for(const [name,change,error,trace] of cases){const f=fixture();change(f);await assert.rejects(f.publish(config(),1),error as never,name);assert.deepEqual(f.trace,trace,name);assert.equal(f.state.responses.length,0,name);}
    for(const count of [32,33,-1,0.5,NaN]){const f=fixture(false);f.state.count=count;await assert.rejects(f.publish(),count===32?{code:'RESOURCE_LIMIT',status:429}:integrity);assert.deepEqual(f.trace,['begin','auth','claim','lock','head:true','clock','count','rollback']);}
    const within=fixture(false);assert.equal((await within.publish({...config(),validFrom:at,validUntil:at+604800000})).status,202);const beyond=fixture(false);await assert.rejects(beyond.publish({...config(),validFrom:at+1,validUntil:at+604800001}),{code:'OBSERVATION_SERVICE_EXPIRED'});assert.equal(beyond.trace.includes('count'),false);
    const quota=fixture();quota.state.head={...head(),revision:64,configRevision:64};quota.state.revisions={64:revision(64)};await assert.rejects(quota.publish({...config(),endpoint:{...config().endpoint,port:9001}},64),{code:'RESOURCE_LIMIT'});assert.equal(quota.trace.includes('insert'),false);assert.equal((await quota.publish(config(),64)).status,200);
    for(const archive of [false,true]){const f=fixture();f.state.head.revision=max;f.state.head.recoverySuspended=true;await assert.rejects(archive?f.archive(max):f.publish(config(),max),{code:'REVISION_EXHAUSTED'});assert.equal(f.trace.includes('put'),false);assert.equal(f.trace.includes('insert'),false);}
    const absent=fixture(false);await assert.rejects(absent.archive(1),{code:'REVISION_CONFLICT'});assert.equal(absent.trace.includes('clock'),false);
});

test('78 every command provider failure restores original immutable head audit receipt and Scope state without compensating writes',async()=>{
    for(const existing of [false,true])for(const label of ['auth','claim','lock','head:true',...(existing?['revision']:['count']),'clock','insert','put','audit','respond']){
        const f=fixture(existing),saved=f.snapshot();f.state.fail=label;const changed={...config(),endpoint:{...config().endpoint,port:9001}};await assert.rejects(f.publish(changed),error=>error===f.failure,`${existing}:${label}`);assert.deepEqual(f.snapshot(),saved,`${existing}:${label}`);assert.equal(f.trace.at(-1),'rollback');assert.equal(f.state.tx,null);
    }
    for(const label of ['put','audit','respond']){const f=fixture(),saved=f.snapshot();f.state.fail=label;await assert.rejects(f.archive(),error=>error===f.failure);assert.deepEqual(f.snapshot(),saved);}
});

test('78 reads preserve owner authorization native immutable trust lifecycle precedence history truncation order and inert envelope',async()=>{
    const f=fixture();f.state.head={...head(),revision:2,configRevision:2};f.state.revisions[2]=revision(2);f.state.audits=Array.from({length:17},(_,index)=>audit(16-index));f.state.losses=9;
    const detail=await f.create().get('actor','scope','service',1);assert.deepEqual(f.trace,['begin','auth','head:false','revision','audits','clock','losses','commit']);assert.deepEqual(f.state.readNumbers,[1]);assert.equal(detail.revision.configRevision,1);assert.equal(detail.head.configRevision,2);assert.equal(detail.lifecycle,'declared');assert.deepEqual(detail.trust,owner.observationTrust(config(),'scope','service'));assert.deepEqual(detail.audit.items.map(value=>value.id),Array.from({length:16},(_,index)=>'audit-'+(16-index)));assert.equal(detail.audit.truncated,true);assert.equal(detail.auditEvicted,9);
    for(const [field,value] of Object.entries({observationServicesVersion:1,scopeId:'scope',capturedAt:at,source:'manager-declared-observation-services',readOnly:true,executionAuthorized:false,health:'unknown',ownership:'not-verified',networkCheck:'not-performed',measurementAvailable:true,echoAvailable:true,consistency:'read-committed-not-global-snapshot'}))assert.equal((detail as unknown as Any)[field],value);assert.equal(detail.limits,owner.OBSERVATION_SERVICE_LIMITS);assert.ok(Object.isFrozen(detail.revision.config.endpoint));assert.ok(Object.isFrozen(detail.audit.items));
    for(const [archived,recoverySuspended,now,lifecycle] of [[true,true,at-100000,'archived'],[false,true,at-100000,'recovery-suspended'],[false,false,at-1001,'not-yet-valid'],[false,false,at-1000,'declared'],[false,false,at+600000,'expired']] as const){const g=fixture();g.state.head={...head(),archived,recoverySuspended};g.state.now=now;assert.equal((await g.create().get('actor','scope','service')).lifecycle,lifecycle);}
    const list=fixture();list.state.list=[head('z'),head('a')];const result=await list.create().list('actor','scope');assert.deepEqual(result.items.map(value=>value.serviceId),['z','a']);assert.deepEqual(list.trace,['begin','auth','list','clock','losses','commit']);assert.equal(result.executionAuthorized,false);assert.equal(result.health,'unknown');
});

test('78 original read integrity refusals occur at their existing head revision audit clock and loss boundaries',async()=>{
    for(const [change,trace] of [
        [(f:ReturnType<typeof fixture>)=>{f.state.head=null;},['begin','auth','head:false','rollback']],
        [(f:ReturnType<typeof fixture>)=>{f.state.head.serviceId='other';},['begin','auth','head:false','rollback']],
        [(f:ReturnType<typeof fixture>)=>{f.state.revisions={};},['begin','auth','head:false','revision','rollback']],
        [(f:ReturnType<typeof fixture>)=>{f.state.revisions[1].configRevision=2;},['begin','auth','head:false','revision','rollback']],
        [(f:ReturnType<typeof fixture>)=>{f.state.audits=Array.from({length:18},(_,i)=>audit(i));},['begin','auth','head:false','revision','audits','rollback']],
        [(f:ReturnType<typeof fixture>)=>{f.state.audits=[audit(),audit()];},['begin','auth','head:false','revision','audits','rollback']],
        [(f:ReturnType<typeof fixture>)=>{f.state.audits=[{...audit(),serviceId:'other'}];},['begin','auth','head:false','revision','audits','rollback']],
        [(f:ReturnType<typeof fixture>)=>{f.state.now=-1;},['begin','auth','head:false','revision','audits','clock','rollback']],
        [(f:ReturnType<typeof fixture>)=>{f.state.losses=-1;},['begin','auth','head:false','revision','audits','clock','losses','rollback']],
    ] as const){const f=fixture();change(f);await assert.rejects(f.create().get('actor','scope','service'),f.state.head===null?{code:'NOT_FOUND'}:integrity);assert.deepEqual(f.trace,trace);}
    const future=fixture();await assert.rejects(future.create().get('actor','scope','service',2),{code:'NOT_FOUND'});assert.deepEqual(future.trace,['begin','auth','head:false','rollback']);
    for(const input of [null,{},Array.from({length:33},(_,i)=>head('service-'+i)),[head(),head()],[{...head(),archived:1}]]){const f=fixture();f.state.list=input;await assert.rejects(f.create().list('actor','scope'),integrity);assert.equal(f.trace.includes('clock'),false);}
    for(const value of [0,NaN,1.5,65]){const f=fixture();await assert.rejects(f.create().get('actor','scope','service',value),invalid);assert.deepEqual(f.trace,[]);}
});

test('78 invalid command identities config keys CAS and idempotency inputs refuse before admission and every public response retains native byte guard',async()=>{
    for(const call of [(service:owner.ObservationServices<object>)=>service.list('','scope'),(service:owner.ObservationServices<object>)=>service.get('actor','scope','bad/id'),(service:owner.ObservationServices<object>)=>service.publish('actor','scope','service','key',-1,config()),(service:owner.ObservationServices<object>)=>service.publish('actor','scope','service',undefined,0,config()),(service:owner.ObservationServices<object>)=>service.publish('actor','scope','service','key',0,{...config(),extra:true}),(service:owner.ObservationServices<object>)=>service.archive('actor','scope','service','key',0)]){const f=fixture(),service=f.create();await assert.rejects(call(service),invalid);assert.deepEqual(f.trace,[]);assert.equal((service as unknown as Any).actors.size,0);}
    for(const operation of ['list','get','publish','archive','replay'] as const)for(const overflow of [false,true]){const f=fixture(),bytes:unknown[]=[];const api=load('modules/observation-service-owner/service.ts',{'@tunex/core':core,'../../framework/public.ts':framework,'./contracts.ts':owner,'./values.ts':{...owner,parseObservationServiceReceipt(value:unknown,id:string){return owner.parseObservationServiceReceipt(structuredClone(value),id);}},'../../compatibility/public.ts':{...native,jsonUtf8Bytes(value:unknown){bytes.push(value);return overflow?131073:131072;}}});
        if(operation==='replay')f.state.replay={status:202,body:{...head(),configDigest:revision().configDigest,changed:true}};const service=new api.ObservationServices(f.db,f.auth,f.requests,f.store,f.clock);
        const action=()=>operation==='list'?service.list('actor','scope'):operation==='get'?service.get('actor','scope','service'):operation==='archive'?service.archive('actor','scope','service','key',1):service.publish('actor','scope','service','key',1,config());
        if(overflow)await assert.rejects(action(),integrity);else assert.ok(Object.isFrozen(await action()));assert.equal(bytes.length,1,operation);assert.equal(service.active,0);assert.equal(service.requestsActive,0);
    }
});

test('observation metadata refuses same-Scope selfservice management before history replay locks and writes',async()=>{
 for(const operation of ['list','get','publish','archive'] as const){const f=fixture(),saved=f.snapshot(),service=f.create();
  const action=()=>operation==='list'?service.list('selfservice-manager','scope'):operation==='get'?service.get('selfservice-manager','scope','service'):operation==='publish'?service.publish('selfservice-manager','scope','service','manager-key',1,config()):service.archive('selfservice-manager','scope','service','manager-key',1);
  await assert.rejects(action(),{code:'AUTHORIZATION_DENIED'});assert.deepEqual(f.trace,['begin','auth','rollback']);assert.deepEqual(f.snapshot(),saved);assert.deepEqual(f.state.claims,[]);assert.deepEqual(f.state.readNumbers,[]);
 }
});
