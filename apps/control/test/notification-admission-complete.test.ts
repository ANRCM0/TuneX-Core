import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as core from '@tunex/core';
import * as native from '../src/compatibility/public.ts';
import * as framework from '../src/framework/public.ts';
import * as station from '../src/modules/station-alert-owner/public.ts';
import * as notification from '../src/modules/notification-owner/public.ts';
import { NotificationEndpoints as LegacyEndpoints } from '../src/application/notification-endpoints.ts';
import { NotificationDeliveries as LegacyDeliveries } from '../src/application/notification-deliveries.ts';
import * as legacyEndpointValues from '../src/application/notification-endpoint-values.ts';
import * as legacyDeliveryValues from '../src/application/notification-delivery-values.ts';
import { notificationEndpointStorageValues as legacyEndpointStorage } from '../src/application/notification-endpoint-storage-values.ts';
import { notificationOutboxStorageValues as legacyOutboxStorage } from '../src/application/notification-outbox-storage-values.ts';
import { createControlApp } from '../src/api/public.ts';
import type { ControlHttpOptions } from '../src/api/public.ts';
import type * as F from '../src/framework/public.ts';
import type * as Product from '../src/modules/notification-owner/public.ts';
import type * as FlatEffects from '../src/modules/notification-ports.ts';
import type * as FlatDeliveries from '../src/modules/notification-delivery-ports.ts';
import type * as FlatApi from '../src/application/notification-api.ts';

type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Same<T extends true>=T;
type Optional<T>={[K in keyof T]-?:{} extends Pick<T,K>?K:never}[keyof T];
type Mutable<T>={[K in keyof T]-?:Equal<{[P in K]:T[P]},{-readonly [P in K]:T[P]}> extends true?K:never}[keyof T];
type Binding={scopeId:string;endpointId:string;credentialRevision:number;authorityDigest:string};
type Destination={url:string;signingKey:string};
type SendCode='HTTP_ACCEPTED'|'HTTP_REJECTED'|'DESTINATION_DENIED'|'DNS_DENIED'|'DNS_FAILED'|'DNS_TIMEOUT'|'CAPACITY_UNAVAILABLE'|'REQUEST_INVALID'|'ABORTED'|'DEADLINE'|'RESPONSE_LIMIT'|'NETWORK_UNKNOWN'|'DISPATCH_DENIED'|'GUARD_FAILED';
type SendResult={outcome:'delivered'|'rejected'|'unknown';code:SendCode;statusCode:number|null};
type Sender={send(input:{destination:string;deliveryId:string;body:string;secret:Uint8Array;beforeDispatch:()=>Promise<boolean>;signal?:F.CancellationSignal}):Promise<SendResult>;idle():Promise<void>;close():Promise<void>};
type Secrets={stage(binding:Binding,requestDigest:string,destination:Destination,keepReference:string|null):Promise<string>;read(binding:Binding,reference:string):Promise<Destination>;acquire(binding:Binding,reference:string):Promise<{destination:Destination;release():void}>;close():Promise<void>};
export type NotificationEffectsAndOwnerDeclarationsComplete=[
    Same<Equal<F.NotificationSecretBinding,Binding>>,Same<Equal<F.NotificationDestination,Destination>>,Same<Equal<F.NotificationSecretLease,{destination:Destination;release():void}>>,Same<Equal<F.NotificationSendCode,SendCode>>,Same<Equal<F.NotificationSendResult,SendResult>>,Same<Equal<F.NotificationSender,Sender>>,Same<Equal<F.NotificationSecrets,Secrets>>,
    Same<Equal<Mutable<F.NotificationSecretBinding>,keyof Binding>>,Same<Equal<Mutable<F.NotificationDestination>,keyof Destination>>,Same<Equal<Mutable<F.NotificationSendResult>,keyof SendResult>>,Same<Equal<Optional<Parameters<F.NotificationSender['send']>[0]>,'signal'>>,
    Same<Equal<Product.NotificationSecretBinding,F.NotificationSecretBinding>>,Same<Equal<Product.NotificationSecretLease,F.NotificationSecretLease>>,Same<Equal<Product.NotificationSecrets,F.NotificationSecrets>>,Same<Equal<Product.NotificationSender,F.NotificationSender>>,Same<Equal<FlatEffects.NotificationDestination,Destination>>,Same<Equal<FlatEffects.NotificationSendResult,SendResult>>,Same<Equal<FlatEffects.NotificationSecrets,Secrets>>,Same<Equal<FlatDeliveries.NotificationDelivery,Product.NotificationDelivery>>,
    Same<Equal<FlatApi.NotificationEndpointsApi,Product.NotificationEndpointsApi>>,Same<Equal<FlatApi.NotificationDeliveriesApi,Product.NotificationDeliveriesApi>>,Same<LegacyEndpoints<object> extends Product.NotificationEndpointsApi?true:false>,Same<LegacyDeliveries<object> extends Product.NotificationDeliveriesApi?true:false>
];

type Any=Record<string,any>;
const at=1800000000000,binding='sha256:'+'a'.repeat(64),reference='b'.repeat(64);
const loss={queueRejected:0,routingRejected:0,silenceSuppressed:0,disabledSuppressed:0,rowsExpired:0,rowsEvicted:0,attemptsEvicted:0};
const modules=['endpoints','deliveries'] as const;
type Kind=typeof modules[number];
const programs=Object.fromEntries(modules.map(name=>[name,ts.transpileModule(readFileSync(new URL('../src/modules/notification-owner/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText]));
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const busy={code:'NOTIFICATION_BUSY',status:429,retryable:true};
function harness(){
    const state:Any={mono:0,wall:at,clockReads:0,factories:0,bytes:null,byteReads:[],calls:[],replay:null,fail:'',tx:null};state.source=()=>{state.clockReads++;return state.wall;};
    const constructors:Any={};
    for(const name of modules){const exports:Any={};new vm.Script(programs[name]!,{filename:'actual-notification-'+name+'.cjs'}).runInNewContext({exports,
        require(id:string){const providers:Any={'@tunex/core':core,'../../compatibility/public.ts':{...native,nativeMonotonicNow:()=>state.mono,nativeWallClockSource:()=>{state.factories++;return state.source;},jsonUtf8Bytes(value:unknown){state.byteReads.push(value);return state.bytes??native.jsonUtf8Bytes(value);}},'../../framework/public.ts':framework,'../station-alert-owner/public.ts':station,'./policy.ts':notification,'./endpoint-values.ts':{...notification,
            // Preserve actual parsing while bridging VM-created record prototypes into its native realm.
            parseNotificationEndpoint(value:unknown){return notification.parseNotificationEndpoint(structuredClone(value));}},'./delivery-values.ts':notification};assert.ok(Object.hasOwn(providers,id),id);return providers[id];}});Object.assign(constructors,exports);}
    assert.equal(state.factories+state.clockReads+state.calls.length,0,'module evaluation performs no clock, admission or provider work');
    const config={schemaVersion:1,enabled:true,policyIds:['policy'],kinds:['firing'],minimumIntervalSeconds:10};
    const endpoint={endpointId:'endpoint',revision:1,credentialRevision:1,config,configDigest:native.nativeValueDigest(config),managedBy:'manager',createdAt:at,updatedAt:at,suspended:'none',authorityDigest:binding,credentialRef:reference};
    const policyConfig={schemaVersion:1,rule:'forward-operation-failed',target:{kind:'forward',id:'forward'},enabled:true,thresholdSeconds:0};
    const policy={policyId:'policy',revision:1,configRevision:1,config:policyConfig,configDigest:native.nativeValueDigest(policyConfig),managedBy:'manager',createdAt:at,updatedAt:at,silencedUntil:null,suspended:'none',nextEvaluateAt:at,state:station.emptyStationAlertState()};
    const id=notification.notificationDeliveryId('scope','event','endpoint'),payload=notification.parseNotificationPayload({notificationVersion:1,deliveryId:id,scopeId:'scope',event:{id:'event',policyId:'policy',configRevision:1,episode:1,kind:'firing',rule:'forward-operation-failed',target:{kind:'forward',id:'forward'},reason:'operation-failed',occurredAt:at}});
    const row={id,eventId:'event',policyId:'policy',endpointId:'endpoint',policyConfigRevision:1,endpointRevision:1,credentialRevision:1,policyManagedBy:'manager',endpointManagedBy:'manager',authorityDigest:binding,payload,payloadDigest:native.nativeValueDigest(payload),revision:1,status:'queued',attemptCount:0,fence:0,claimedAt:null,claimUntil:null,createdAt:at,updatedAt:at,nextAttemptAt:at,expiresAt:at+3600000,lastCode:null,lastOutcome:'none',lastStatusCode:null,recoverySuspended:false};
    state.endpoint=endpoint;state.row=row;
    const check=(label:string)=>{state.calls.push(label);if(state.fail===label)throw new Error('original '+label+' failure');};
    const db={async transaction(action:(tx:object)=>Promise<unknown>){check('transaction');const tx={};state.tx=tx;try{return await action(tx);}finally{state.tx=null;}}};
    const auth={async scope(){check('auth');}};
    const requests={async claim(){check('claim');return state.replay;},async respond(){check('respond');}};
    const endpoints={async lockScope(){check('endpoint-lock');},async list(){check('list');return [state.endpoint];},async get(){check('endpoint-get');return state.endpoint;},async count(){check('count');return 0;},async put(_tx:unknown,_scope:string,value:unknown){check('endpoint-put');state.endpoint=value;},async audit(){check('audit');},async audits(){check('audits');return [];},async auditLosses(){check('audit-losses');return 0;}};
    const store={async get(){check('delivery-get');return state.row;},async attempts(){check('attempts');return [];},async history(){check('history');return [];},async losses(){check('losses');return loss;}};
    const secrets={async stage(){check('stage');return reference;},async acquire(){assert.fail('read and endpoint management must not acquire secrets');}};
    const sender={async send(){assert.fail('read and endpoint management must not send');},async idle(){check('idle');},async close(){check('close');}};
    const policies={async policy(){check('policy');return policy;}};
    const authority=async()=>{check('authority');return binding;};
    const options:Any={db,auth,store,endpoints,policies,secrets,sender,authorityBinding:authority,enabled:false};
    const create=(kind:Kind,clock?:()=>number,deliveryEnabled?:boolean):Any=>kind==='endpoints'?new constructors.NotificationEndpoints(db,auth,requests,endpoints,policies,secrets,authority,clock,deliveryEnabled):new constructors.NotificationDeliveries({...options,...(clock?{clock}:{})});
    return {state,constructors,create,options,config,endpoint,policy,row,id,db,auth,requests,endpoints,policies,secrets,authority};
}

test('71/72 original public and flat constructors prototypes parsers constants and storage providers are identical aliases',()=>{
    assert.equal(LegacyEndpoints,notification.NotificationEndpoints);assert.equal(LegacyDeliveries,notification.NotificationDeliveries);
    assert.equal(LegacyEndpoints.prototype,notification.NotificationEndpoints.prototype);assert.equal(LegacyDeliveries.prototype,notification.NotificationDeliveries.prototype);
    assert.deepEqual(Object.getOwnPropertyNames(LegacyEndpoints.prototype).sort(),['constructor','now','envelope','bounded','admitRequest','admitted','list','losses','get','publish','disable'].sort());
    assert.deepEqual(Object.getOwnPropertyNames(LegacyDeliveries.prototype).sort(),['constructor','now','row','bounded','envelope','admitRequest','admitted','enqueueIn','authorized','locked','denial','save','completed','attempt','claim','preflight','finish','tick','run','close','get','history'].sort());
    for(const [old,current] of [[legacyEndpointValues.parseNotificationEndpointConfig,notification.parseNotificationEndpointConfig],[legacyEndpointValues.parseNotificationDestination,notification.parseNotificationDestination],[legacyEndpointValues.parseNotificationEndpoint,notification.parseNotificationEndpoint],[legacyEndpointValues.publicNotificationEndpoint,notification.publicNotificationEndpoint],[legacyEndpointValues.NOTIFICATION_ENDPOINT_LIMITS,notification.NOTIFICATION_ENDPOINT_LIMITS],[legacyDeliveryValues.notificationDeliveryId,notification.notificationDeliveryId],[legacyDeliveryValues.notificationWireBody,notification.notificationWireBody],[legacyDeliveryValues.parseNotificationDelivery,notification.parseNotificationDelivery],[legacyDeliveryValues.parseNotificationDeliveryAttempt,notification.parseNotificationDeliveryAttempt],[legacyDeliveryValues.NOTIFICATION_DELIVERY_LIMITS,notification.NOTIFICATION_DELIVERY_LIMITS],[legacyEndpointStorage,notification.notificationEndpointStorageValues],[legacyOutboxStorage,notification.notificationOutboxStorageValues]])assert.equal(old,current);
    assert.equal(native.nativeWallClockSource(),Date.now,'native default returns the existing wall-clock function without reading it');
});

test('71/72 constructors capture default clock once retain injected providers and independent empty state without eager read or send',async()=>{
    const h=harness(),first=()=>at+1,second=()=>at+2;h.state.source=first;
    for(const kind of modules){const before=h.state.factories,owner=h.create(kind);assert.equal(h.state.factories,before+1);assert.equal(h.state.clockReads,0);assert.equal(h.state.calls.length,0);assert.equal(owner.clock,first);assert.equal(owner.active,0);assert.equal(owner.admittedRequests,0);assert.equal(owner.actors.size,0);assert.equal(owner.now(),at+1);h.state.source=second;assert.equal(owner.now(),at+1);const newer=h.create(kind);assert.equal(newer.clock,second);assert.notEqual(owner.actors,newer.actors);h.state.source=first;
        if(kind==='deliveries'){assert.equal(owner.enabled,false);assert.equal(owner.stopping,false);assert.equal(owner.running,null);assert.equal(owner.options.db,h.db);assert.equal(owner.options.sender,h.options.sender);}else{assert.equal(owner.deliveryEnabled,false);assert.equal(owner.db,h.db);assert.equal(owner.store,h.endpoints);assert.equal(owner.secrets,h.secrets);}
        const count=h.state.factories,clock=()=>at+3,explicit=h.create(kind,clock);assert.equal(explicit.clock,clock);assert.equal(explicit.now(),at+3);assert.equal(h.state.factories,count);
    }
    for(const clockSkewMs of [-1,0.5,NaN,Infinity,300001])assert.throws(()=>new h.constructors.NotificationDeliveries({...h.options,clockSkewMs}),/Bounded notification clock skew required/);
    for(const clockSkewMs of [0,1000,300000])assert.equal(new h.constructors.NotificationDeliveries({...h.options,clockSkewMs}).enabled,false);
    const before=h.state.factories;assert.throws(()=>new h.constructors.NotificationDeliveries({...h.options,enabled:true,secrets:undefined}),{code:'NOTIFICATION_SECRETS_UNAVAILABLE',status:503});assert.equal(h.state.factories,before);
    const disabled=new h.constructors.NotificationDeliveries({...h.options,secrets:undefined});await disabled.tick();assert.equal(h.state.calls.length,0);
    for(const kind of modules)for(const value of [-1,0.5,NaN,253402300800000]){const owner=h.create(kind,()=>value);assert.throws(()=>owner.now(),{code:'INTEGRITY_FAILURE'});}
});

test('71/72 per-instance request admission holds two independent awaits releases on success rejection and synchronous throw in original finally',async()=>{
    for(const kind of modules){const h=harness(),owner=h.create(kind),other=h.create(kind),one=deferred<number>(),two=deferred<number>();let actions=0;
        const a=owner.admitRequest(()=>{actions++;return one.promise;}),b=owner.admitRequest(()=>{actions++;return two.promise;});assert.equal(owner.admittedRequests,2);await assert.rejects(owner.admitRequest(async()=>{actions++;return 3;}),busy);assert.equal(actions,2);assert.equal(await other.admitRequest(async()=>4),4);assert.equal(other.admittedRequests,0);
        one.resolve(1);assert.equal(await a,1);assert.equal(owner.admittedRequests,1);assert.equal(await owner.admitRequest(async()=>5),5);const failure=new Error('original action failure');two.reject(failure);await assert.rejects(b,error=>error===failure);assert.equal(owner.admittedRequests,0);await assert.rejects(owner.admitRequest(()=>{throw failure;}),error=>error===failure);assert.equal(owner.admittedRequests,0);
        assert.equal(await owner.admitted('actor',async()=>6),6);assert.equal(owner.admittedRequests,0);assert.equal(h.state.clockReads,0);
    }
});

test('71/72 actor admission has independent two-active capacity key exclusion and monotonic completion-based cooldown despite wall rollback',async()=>{
    for(const kind of modules){const h=harness(),owner=h.create(kind),other=h.create(kind),one=deferred<number>(),two=deferred<number>();let actions=0;
        const a=owner.admitted('actor-a',()=>{actions++;return one.promise;}),b=owner.admitted('actor-b',()=>{actions++;return two.promise;});assert.equal(owner.active,2);assert.equal(owner.actors.get('actor-a').until,Infinity);await assert.rejects(owner.admitted('actor-c',async()=>{actions++;return 3;}),busy);await assert.rejects(owner.admitted('actor-a',async()=>0),busy);assert.equal(actions,2);assert.equal(await owner.admitRequest(async()=>7),7);assert.equal(await other.admitted('actor-a',async()=>8),8);
        h.state.mono=50;h.state.wall=at-100000;one.resolve(1);assert.equal(await a,1);assert.equal(owner.active,1);assert.equal(owner.actors.get('actor-a').until,1050);h.state.mono=1049;await assert.rejects(owner.admitted('actor-a',async()=>0),busy);h.state.mono=1050;assert.equal(await owner.admitted('actor-a',async()=>9),9);
        const failure=new Error('original actor failure');two.reject(failure);await assert.rejects(b,error=>error===failure);assert.equal(owner.active,0);assert.equal(owner.actors.get('actor-b').until,2050);h.state.mono=2050;await assert.rejects(owner.admitted('actor-b',()=>{throw failure;}),error=>error===failure);assert.equal(owner.active,0);assert.equal(owner.actors.get('actor-b').active,false);assert.equal(owner.actors.get('actor-b').until,3050);assert.equal(h.state.clockReads,0);
    }
});

test('71/72 actor key128 limit retains unexpired inactive keys purges at exact equality and never expires a still-active actor',async()=>{
    for(const kind of modules){const h=harness(),owner=h.create(kind);for(let index=0;index<128;index++)await owner.admitted('actor-'+index,async()=>index);assert.equal(owner.actors.size,128);assert.equal(owner.active,0);await assert.rejects(owner.admitted('actor-128',async()=>0),busy);h.state.mono=999;await assert.rejects(owner.admitted('actor-128',async()=>0),busy);h.state.mono=1000;assert.equal(await owner.admitted('actor-128',async()=>128),128);assert.equal(owner.actors.size,1);
        h.state.mono=2000;const held=deferred<number>(),running=owner.admitted('held',()=>held.promise);h.state.mono=100000;await assert.rejects(owner.admitted('held',async()=>0),busy);assert.equal(owner.actors.get('held').active,true);assert.equal(owner.active,1);assert.equal(await owner.admitted('other',async()=>1),1);held.resolve(2);assert.equal(await running,2);assert.equal(owner.actors.get('held').until,101000);assert.equal(owner.active,0);
    }
});

test('71/72 public identity refusal precedes admission while transaction authorization storage and clock failures each leave cooldown and release active slots',async()=>{
    for(const kind of modules){const h=harness(),owner=h.create(kind),call=(actor:string)=>kind==='endpoints'?owner.list(actor,'scope'):owner.get(actor,'scope',h.id);
        await assert.rejects(call(''),{code:'INVALID_CONFIG'});assert.equal(owner.actors.size,0);assert.equal(h.state.calls.length,0);
        for(const [index,label] of ['transaction','auth',kind==='endpoints'?'list':'delivery-get'].entries()){h.state.fail=label;const actor='failed-'+index;await assert.rejects(call(actor),new RegExp('original '+label+' failure'));assert.equal(owner.active,0);assert.equal(owner.actors.get(actor).active,false);assert.equal(owner.actors.get(actor).until,1000);await assert.rejects(call(actor),busy);}
        h.state.fail='';h.state.wall=-1;await assert.rejects(call('clock-failure'),{code:'INTEGRITY_FAILURE'});assert.equal(owner.active,0);h.state.wall=at;h.state.mono=1000;await call('clock-failure');assert.equal(owner.active,0);
    }
});

test('71/72 original response-byte guards accept exact bound freeze nested values and refuse one extra byte before freeze',()=>{
    for(const kind of modules){const h=harness(),owner=h.create(kind),limit=kind==='endpoints'?131072:262144;const result={text:'你',nested:{items:[1,2]}};h.state.bytes=limit;assert.equal(owner.bounded(result),result);assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.nested.items));const over={nested:{value:1}};h.state.bytes=limit+1;assert.throws(()=>owner.bounded(over),{code:'INTEGRITY_FAILURE'});assert.equal(Object.isFrozen(over),false);assert.equal(Object.isFrozen(over.nested),false);assert.equal(native.jsonUtf8Bytes({text:'你'}),Buffer.byteLength(JSON.stringify({text:'你'}),'utf8'));}
});

test('71/72 every public read and endpoint replay or mutation receipt passes the original byte guard and exposes no protected binding',async()=>{
    for(const kind of modules){const operations=kind==='endpoints'?['list','get','publish-replay','publish','disable-replay','disable','disable-noop']:['get','history'];
        for(const operation of operations)for(const overflow of [false,true]){const h=harness(),owner=h.create(kind),limit=kind==='endpoints'?131072:262144;h.state.bytes=limit+(overflow?1:0);const receipt={status:202,body:{endpointId:'endpoint',revision:1,changed:true}};
            if(operation.endsWith('-replay'))h.state.replay=receipt;if(operation==='publish')h.state.endpoint=null;if(operation==='disable-noop'){h.state.endpoint={...h.endpoint,config:{...h.config,enabled:false}};h.state.endpoint.configDigest=native.nativeValueDigest(h.state.endpoint.config);}
            const call=()=>operation==='list'?owner.list('actor','scope'):operation==='get'?owner.get('actor','scope',kind==='endpoints'?'endpoint':h.id):operation==='history'?owner.history('actor','scope'):operation.startsWith('publish')?owner.publish('actor','scope','endpoint','key',operation==='publish'?0:1,h.config,{url:'https://notify.tunex.org/hook',signingKey:'c'.repeat(64)}):owner.disable('actor','scope','endpoint','key',1);
            if(overflow)await assert.rejects(call(),{code:'INTEGRITY_FAILURE'});else{const result=await call();assert.ok(Object.isFrozen(result));const text=JSON.stringify(result);for(const privateText of [binding,reference,'https://notify.tunex.org/hook','c'.repeat(64),'authorityDigest','credentialRef','signingKey'])assert.equal(text.includes(privateText),false,operation+':'+privateText);}
            assert.equal(h.state.byteReads.length,1,operation);assert.equal(owner.active,0);assert.equal(h.state.calls.includes('idle'),false);assert.equal(h.state.calls.includes('close'),false);
        }
    }
});

test('71 native HTTP endpoint publish8192 and disable1024 UTF8 body bounds closed wrappers and query refusal retain admission and response headers',async()=>{
    for(const operation of ['publish','disable'] as const){const maximum=operation==='publish'?8192:1024,method=operation==='publish'?'PUT':'POST',path='/api/v1/scopes/scope/notification-endpoints/endpoint'+(operation==='disable'?'/disable':'');
        const wrapper=operation==='publish'?{expectedRevision:0,config:{text:'你'},destination:{url:'https://notify.tunex.org/hook',signingKey:'c'.repeat(64)}}:{expectedRevision:1};
        const original=JSON.stringify(wrapper);
        for(const bytes of [maximum,maximum+1]){const h=harness(),owner=h.create('endpoints'),trace:string[]=[],receipt={status:202 as const,body:{endpointId:'endpoint',revision:1,changed:true}};
            const selected={admitRequest:owner.admitRequest.bind(owner),async publish(...args:unknown[]){trace.push('publish');assert.deepEqual(args,['actor','scope','endpoint','key',0,(wrapper as Any).config,(wrapper as Any).destination]);return receipt;},async disable(...args:unknown[]){trace.push('disable');assert.deepEqual(args,['actor','scope','endpoint','key',1]);return receipt;}};
            const app=createControlApp({control:{} as ControlHttpOptions['control'],runtime:{} as ControlHttpOptions['runtime'],authority:{async allow(){trace.push('authority');},async read(){return {maintenance:false};}},services:{notificationEndpoints:selected as never,async authenticateObservation(){trace.push('authenticate');return 'actor';}}});
            const text=original+' '.repeat(bytes-Buffer.byteLength(original,'utf8'));assert.equal(Buffer.byteLength(text,'utf8'),bytes);const response=await app.request(path,{method,headers:{authorization:'Bearer test','idempotency-key':'key','content-type':'application/json'},body:text});assert.equal(response.status,bytes===maximum?202:413);assert.equal(response.headers.get('cache-control'),'no-store');const body=await response.json() as Any;if(bytes===maximum){assert.deepEqual(body,receipt.body);assert.deepEqual(trace,['authority','authenticate',operation]);}else{assert.equal(body.code,'RESOURCE_LIMIT');assert.deepEqual(trace,['authority','authenticate']);}assert.equal(owner.admittedRequests,0);
            for(const bodyValue of [null,[],{},operation==='publish'?{...wrapper,extra:true}:{expectedRevision:0},{...wrapper,expectedRevision:-1},{...wrapper,expectedRevision:'1'}]){trace.length=0;const denied=await app.request(path,{method,headers:{authorization:'Bearer test','content-type':'application/json'},body:JSON.stringify(bodyValue)});assert.equal(denied.status,422);assert.equal(trace.includes(operation),false);assert.equal(owner.admittedRequests,0);}
            const query=await app.request(path+'?unexpected=1',{method,headers:{authorization:'Bearer test','content-type':'application/json'},body:original});assert.equal(query.status,422);assert.equal(owner.admittedRequests,0);
        }
    }
});

test('71 original endpoint config destination and pre-admission command bounds preserve closed sorted selections and lowercase32byte material',async()=>{
    const h=harness(),config=h.config;
    for(const minimumIntervalSeconds of [10,3600]){const value=notification.parseNotificationEndpointConfig({...config,minimumIntervalSeconds,policyIds:Array.from({length:16},(_,index)=>'policy-'+String(index).padStart(2,'0')),kinds:['firing','invalidated','recovered']});assert.ok(Object.isFrozen(value));assert.ok(Object.isFrozen(value.policyIds));assert.equal(value.policyIds.length,16);}
    const invalid:unknown[]=[null,[],{...config,extra:true},Object.assign(Object.create({inherited:true}),config),{...config,schemaVersion:2},{...config,enabled:1},...[-1,9,3601,10.5,NaN,Infinity,'10'].map(minimumIntervalSeconds=>({...config,minimumIntervalSeconds})),...([[],['policy','policy'],['z','a'],[''],Array.from({length:17},(_,index)=>'policy-'+index),'policy'] as unknown[]).map(policyIds=>({...config,policyIds})),...([[],['firing','firing'],['recovered','firing'],['unknown'],['firing','invalidated','recovered','z']] as unknown[]).map(kinds=>({...config,kinds}))];
    for(const value of invalid){assert.throws(()=>notification.parseNotificationEndpointConfig(value),{code:'INVALID_CONFIG'});const owner=h.create('endpoints');await assert.rejects(owner.publish('actor','scope','endpoint','key',0,value,{url:'https://notify.tunex.org/hook',signingKey:'c'.repeat(64)}),{code:'INVALID_CONFIG'});assert.equal(owner.actors.size,0);}
    const destination={url:'https://Notify.TuneX.org:443/a/../hook',signingKey:'a'.repeat(64)};assert.deepEqual(notification.parseNotificationDestination(destination),{url:'https://notify.tunex.org/hook',signingKey:'a'.repeat(64)});
    for(const value of [null,[],{...destination,extra:true},{...destination,signingKey:'A'.repeat(64)},{...destination,signingKey:'a'.repeat(63)},{...destination,signingKey:'a'.repeat(65)},{...destination,signingKey:'g'.repeat(64)},{...destination,url:'https://node.internal/'},{...destination,url:'https://notify.tunex.org/?secret=1'}])assert.throws(()=>notification.parseNotificationDestination(value),{code:'INVALID_CONFIG'});
    for(const revision of [-1,0.5,NaN,Number.MAX_SAFE_INTEGER+1]){const owner=h.create('endpoints');await assert.rejects(owner.publish('actor','scope','endpoint','key',revision,config,destination),{code:'INVALID_CONFIG'});assert.equal(owner.actors.size,0);}
    const disable=h.create('endpoints');await assert.rejects(disable.disable('actor','scope','endpoint','key',0),{code:'INVALID_CONFIG'});assert.equal(disable.actors.size,0);assert.equal(h.state.calls.length,0,'invalid commands perform no auth transaction secret or network effects');
});
