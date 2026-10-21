import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nativeValueDigest as digest } from '../src/compatibility/public.ts';
import { ControlError } from '../src/framework/public.ts';
import { NotificationDeliveries, NotificationEndpoints, notificationDeliveryId, notificationAttemptId, notificationPayload,
    parseNotificationDelivery, NOTIFICATION_API_INTERFACE_VERSION } from '../src/modules/notification-owner/public.ts';
import { emptyStationAlertState } from '../src/modules/station-alert-owner/public.ts';

type Any=Record<string,any>;
const copy=<T>(v:T):T=>structuredClone(v);
const at=1800000000000,binding='sha256:'+'a'.repeat(64),reference='b'.repeat(64),scope='scope';
const losses={queueRejected:0,routingRejected:0,silenceSuppressed:0,disabledSuppressed:0,rowsExpired:0,rowsEvicted:0,attemptsEvicted:0};
function fixture() {
    const trace:string[]=[],destination={url:'https://notify.tunex.org/hook',signingKey:'c'.repeat(64)};
    const config={schemaVersion:1,enabled:true,policyIds:['policy'],kinds:['firing'],minimumIntervalSeconds:10};
    const endpoint={endpointId:'endpoint',revision:1,credentialRevision:1,config,configDigest:digest(config),managedBy:'endpoint-manager',createdAt:at,updatedAt:at,suspended:'none',authorityDigest:binding,credentialRef:reference};
    const policyConfig={schemaVersion:1,rule:'forward-operation-failed',target:{kind:'forward',id:'forward'},enabled:true,thresholdSeconds:0};
    const policy={policyId:'policy',revision:1,configRevision:1,config:policyConfig,configDigest:digest(policyConfig),managedBy:'policy-manager',createdAt:at,updatedAt:at,silencedUntil:null,suspended:'none',nextEvaluateAt:at,state:emptyStationAlertState()};
    const evidence={kind:'operation',targetId:'forward',forwardRevision:1,operationId:'operation',targetRevision:1,operationKind:'create',status:'failed',sourceOperationId:null,createdAt:at,updatedAt:at,errorCode:null,recoveryInvalidated:false};
    const event={id:'event',policyId:'policy',policyRevision:1,configRevision:1,config:policyConfig,configDigest:policy.configDigest,episode:1,kind:'firing',reason:'operation-failed',occurredAt:at,evidence,opening:evidence,silenced:false,silencedUntil:null,revision:1,acknowledgedAt:null,recoverySuspended:false};
    const id=notificationDeliveryId(scope,'event','endpoint'),payload=notificationPayload(scope,id,event as never);
    const queued={id,eventId:'event',policyId:'policy',endpointId:'endpoint',policyConfigRevision:1,endpointRevision:1,credentialRevision:1,policyManagedBy:'policy-manager',endpointManagedBy:'endpoint-manager',authorityDigest:binding,payload,payloadDigest:digest(payload),revision:1,status:'queued',attemptCount:0,fence:0,claimedAt:null,claimUntil:null,createdAt:at,updatedAt:at,nextAttemptAt:at,expiresAt:at+3600000,lastCode:null,lastOutcome:'none',lastStatusCode:null,recoverySuspended:false};
    const state:Any={row:copy(queued),endpoint:copy(endpoint),policy:copy(policy),routes:[copy(endpoint)],attempts:[],history:[],audit:[],losses:copy(losses),now:at,count:0,active:0,rate:at,denied:false,binding,replay:null,fail:'',transactions:0,tx:null,stages:[],inserted:[],due:true,lockMutate:null};
    const failure=new Error('original owner port failure');
    const checked=(tx:unknown,label:string)=>{assert.equal(tx,state.tx);trace.push(label);if(state.fail===label)throw failure;};
    const db={async transaction(action:(tx:object)=>Promise<unknown>){assert.equal(state.tx,null);const tx={number:++state.transactions},saved=copy({row:state.row,attempts:state.attempts,endpoint:state.endpoint,audit:state.audit,losses:state.losses,inserted:state.inserted});state.tx=tx;trace.push('begin');try{const answer=await action(tx);trace.push('commit');return answer;}catch(error){Object.assign(state,saved);trace.push('rollback');throw error;}finally{state.tx=null;}}};
    const auth={async scope(tx:unknown,actor:string,actualScope:string,manage:boolean){assert.equal(tx,state.tx);assert.equal(actor,'selfservice-manager');assert.equal(actualScope,scope);assert.equal(manage,true);},async owner(tx:unknown,actor:string,actualScope:string,...extra:unknown[]){checked(tx,'auth:'+actor);assert.equal(actualScope,scope);assert.deepEqual(extra,[]);if(state.denied||!['actor','policy-manager','endpoint-manager'].includes(actor))throw new ControlError('AUTHORIZATION_DENIED',403,'Scope owner permission required');}};
    const store:Any={async lockScope(tx:unknown){checked(tx,'outbox-lock');},async due(tx:unknown,now:number){checked(tx,'due');assert.equal(now,state.now);return state.due?{scopeId:scope,id,revision:state.row.revision}:null;},
        async get(tx:unknown,actualScope:string,actualId:string,lock:unknown=false){checked(tx,'get:'+lock);assert.equal(actualScope,scope);assert.equal(actualId,id);if(lock===true)state.lockMutate?.();return state.row;},
        async put(tx:unknown,_scope:string,value:unknown){checked(tx,'put');state.row=value;},async activeCount(tx:unknown){checked(tx,'active');return state.active;},async reserveRate(tx:unknown,_scope:string,_endpoint:string,_now:number,interval:number){checked(tx,'rate');assert.equal(interval,10000);return state.rate;},
        async appendAttempt(tx:unknown,_scope:string,value:unknown){checked(tx,'append');state.attempts.push(value);},async finishAttempt(tx:unknown,_scope:string,_id:string,value:any){checked(tx,'finish');state.attempts=state.attempts.map((v:any)=>v.id===value.id?value:v);},
        async defer(tx:unknown,header:unknown,cutoff:number,retryAt:number){checked(tx,'defer');state.deferred={header,cutoff,retryAt};},async loss(tx:unknown,_scope:string,kind:string,count:number){checked(tx,'loss:'+kind);state.losses[kind]+=count;},async insert(tx:unknown,_scope:string,value:unknown,now:number){checked(tx,'insert');assert.equal(now,state.now);state.inserted.push(value);return 'inserted';},
        async attempts(tx:unknown){checked(tx,'attempts');return state.attempts;},async history(tx:unknown,_scope:string,query:unknown){checked(tx,'history');state.query=query;return state.history;},async losses(tx:unknown){checked(tx,'losses');return state.losses;}};
    const endpoints:Any={async lockScope(tx:unknown){checked(tx,'endpoint-lock');},async get(tx:unknown,_scope:string,_id:string,lock:unknown=false){checked(tx,'endpoint:'+lock);return state.endpoint;},async count(tx:unknown){checked(tx,'count');return state.count;},
        async list(tx:unknown){checked(tx,'routes');if(state.fail==='route-integrity')throw new ControlError('INTEGRITY_FAILURE',409,'route');return state.routes;},async put(tx:unknown,_scope:string,value:unknown){checked(tx,'endpoint-put');state.endpoint=value;},async audit(tx:unknown,_scope:string,value:unknown){checked(tx,'audit');state.audit.push(value);},async audits(tx:unknown){checked(tx,'audits');return state.audit;},async auditLosses(tx:unknown){checked(tx,'audit-losses');return state.losses.attemptsEvicted;}};
    const policies:Any={async lockScope(tx:unknown){checked(tx,'policy-lock');},async policy(tx:unknown,_scope:string,id:string,lock:unknown=false){checked(tx,'policy:'+lock);assert.equal(id,'policy');return state.policy;}};
    const requests:Any={async claim(tx:unknown,request:unknown){checked(tx,'replay');state.request=request;return state.replay;},async respond(tx:unknown,request:unknown,response:unknown){checked(tx,'respond');assert.equal(request,state.request);state.response=response;}};
    const secrets:Any={async stage(actual:unknown,requestDigest:string,value:unknown,previous:unknown){assert.equal(state.tx!==null,true);trace.push('stage');state.stages.push({actual,requestDigest,value,previous});if(state.fail==='stage')throw failure;return reference;},async acquire(){assert.fail('read/command must not lease');}};
    const sender:Any={async send(){assert.fail('direct owner cases must not send');},async idle(){trace.push('idle');},async close(){trace.push('close');}};
    const options:Any={db,auth,store,endpoints,policies,secrets,sender,enabled:true,clock:()=>{trace.push('clock');return state.now;},authorityBinding:async()=>{trace.push('authority');return state.binding;}};
    const worker:any=new NotificationDeliveries(options as never);
    const commands=(secret:unknown=secrets)=>new NotificationEndpoints(db as never,auth,requests as never,endpoints as never,policies as never,secret as never,options.authorityBinding,options.clock,true);
    return {trace,state,failure,db,auth,store,endpoints,policies,requests,secrets,sender,options,worker,commands,queued,endpoint,policy,event,id,destination};
}
function claimed(f:ReturnType<typeof fixture>,attemptCount=1) {
    f.state.row={...f.queued,revision:2,status:'claimed',attemptCount,fence:attemptCount,claimedAt:at,claimUntil:at+30000,nextAttemptAt:at+30000};
    f.state.attempts=[{id:notificationAttemptId(f.id,attemptCount),deliveryId:f.id,ordinal:attemptCount,fence:attemptCount,startedAt:at,finishedAt:null,outcome:'pending',code:null,statusCode:null}];
    return copy(f.state.row);
}
const claim=(f:ReturnType<typeof fixture>)=>f.worker.claim(()=>{});

test('71 endpoint publish authenticates replay before missing secrets and preserves durable stage before SQL audit response with rollback orphan',async()=>{
    const f=fixture();f.state.endpoint=null;const response=await f.commands().publish('actor',scope,'endpoint','key',0,f.endpoint.config,f.destination);
    assert.deepEqual(response,{status:202,body:{endpointId:'endpoint',revision:1,changed:true}});
    const trace=f.trace;for(const [first,second] of [['auth:actor','replay'],['replay','endpoint-lock'],['endpoint:true','count'],['policy:false','authority'],['authority','stage'],['stage','endpoint-put'],['endpoint-put','audit'],['audit','respond'],['respond','commit']])assert.ok(trace.indexOf(first!)<trace.indexOf(second!),first+' before '+second);
    assert.deepEqual(f.state.stages[0].actual,{scopeId:scope,endpointId:'endpoint',credentialRevision:1,authorityDigest:binding});assert.equal(f.state.stages[0].previous,null);
    const replay=fixture();replay.state.replay=response;assert.deepEqual(await replay.commands(null).publish('actor',scope,'endpoint','key',0,f.endpoint.config,f.destination),response);assert.deepEqual(replay.trace,['begin','auth:actor','replay','commit']);
    const absent=fixture();await assert.rejects(absent.commands(null).publish('actor',scope,'endpoint','key',1,f.endpoint.config,f.destination),{code:'NOTIFICATION_SECRETS_UNAVAILABLE'});
    for(const failure of ['endpoint-put','audit','respond']){const broken=fixture();broken.state.endpoint=null;broken.state.fail=failure;await assert.rejects(broken.commands().publish('actor',scope,'endpoint','key',0,f.endpoint.config,f.destination),error=>error===broken.failure);assert.equal(broken.state.endpoint,null);assert.equal(broken.state.audit.length,0);assert.equal(broken.state.stages.length,1);assert.equal(broken.trace.at(-1),'rollback');}
});

test('71 endpoint owner refuses quota CAS policy clock authority before staging and disable preserves credential revision/reference',async()=>{
    for(const [configure,code] of [
        [(f:ReturnType<typeof fixture>)=>{f.state.endpoint=null;f.state.count=16;},'RESOURCE_LIMIT'],
        [(f:ReturnType<typeof fixture>)=>{f.state.endpoint.revision=2;},'REVISION_CONFLICT'],
        [(f:ReturnType<typeof fixture>)=>{f.state.policy=null;},'NOT_FOUND'],
        [(f:ReturnType<typeof fixture>)=>{f.state.now=at-1;},'CLOCK_UNCERTAIN'],
        [(f:ReturnType<typeof fixture>)=>{f.state.binding='bad';},'INTEGRITY_FAILURE']] as const){const f=fixture();configure(f);await assert.rejects(f.commands().publish('actor',scope,'endpoint','key',f.state.endpoint?1:0,f.endpoint.config,f.destination),{code});assert.equal(f.state.stages.length,0);}
    const f=fixture();const result=await f.commands().disable('actor',scope,'endpoint','key',1);assert.deepEqual(result,{status:202,body:{endpointId:'endpoint',revision:2,changed:true}});assert.equal(f.state.endpoint.config.enabled,false);assert.equal(f.state.endpoint.credentialRevision,1);assert.equal(f.state.endpoint.credentialRef,reference);assert.equal(f.state.stages.length,0);
    const noChange=fixture();noChange.state.endpoint.config.enabled=false;noChange.state.endpoint.configDigest=digest(noChange.state.endpoint.config);assert.deepEqual(await noChange.commands().disable('actor',scope,'endpoint','key',1),{status:200,body:{endpointId:'endpoint',revision:1,changed:false}});assert.equal(noChange.trace.includes('endpoint-put'),false);assert.equal(noChange.trace.includes('audit'),false);
});

test('71 endpoint reads redact native secret bindings retain 16+1 audit page and reject duplicate/corrupt or oversized owner rows',async()=>{
    const f=fixture();f.state.audit=Array.from({length:17},(_,i)=>({id:'audit-'+i,endpointId:'endpoint',revision:1,kind:'publish',actorId:'actor',createdAt:at}));
    const result=await f.commands().get('actor',scope,'endpoint');assert.equal(result.audit.items.length,16);assert.equal(result.audit.truncated,true);assert.equal(result.readOnly,true);assert.equal(result.executionAuthorized,false);for(const forbidden of [reference,binding,f.destination.url,f.destination.signingKey])assert.equal(JSON.stringify(result).includes(forbidden),false);assert.deepEqual(f.trace.filter(v=>v!=='clock'),['begin','auth:actor','endpoint:false','audits','audit-losses','commit']);
    for(const routes of [Array.from({length:17},()=>f.endpoint),[f.endpoint,f.endpoint],[{...f.endpoint,configDigest:'bad'}]]){const broken=fixture();broken.state.routes=routes;await assert.rejects(broken.commands().list('actor',scope),{code:'INTEGRITY_FAILURE'});}
    const bad=fixture();bad.state.losses.attemptsEvicted=-1;await assert.rejects(bad.commands().list('actor',scope),{code:'INTEGRITY_FAILURE'});
});

test('72 handoff validates policy event time before route lock maps only route corruption and preserves same-Tx disabled silence deterministic insertion',async()=>{
    const invalid=fixture();await assert.rejects(invalid.worker.enqueueIn({},scope,invalid.policy,{...invalid.event,occurredAt:at+1},at),{code:'INTEGRITY_FAILURE'});assert.equal(invalid.trace.length,0);
    for(const mode of ['route-integrity','disabled','silenced','recovery','no-routes','insert']){const f=fixture();if(mode==='route-integrity')f.state.fail=mode;if(mode==='disabled')f.options.enabled=false;if(mode==='silenced')f.event.silenced=true,(f.event as Any).silencedUntil=at+1;if(mode==='recovery')f.event.recoverySuspended=true;if(mode==='no-routes')f.state.routes=[];
        const worker=mode==='disabled'?new NotificationDeliveries({...f.options,enabled:false} as never):f.worker;
        await f.db.transaction(tx=>worker.enqueueIn(tx,scope,f.policy as never,f.event as never,at));
        assert.deepEqual(f.trace.slice(0,3),['begin','endpoint-lock','routes']);
        if(mode==='insert'){assert.equal(f.state.inserted.length,1);assert.deepEqual(f.state.inserted[0],parseNotificationDelivery(f.queued));assert.ok(f.trace.indexOf('outbox-lock')<f.trace.indexOf('insert'));}
        else if(mode!=='no-routes'){const loss=mode==='route-integrity'?'routingRejected':mode==='disabled'?'disabledSuppressed':'silenceSuppressed';assert.equal(f.state.losses[loss],1);assert.equal(f.state.inserted.length,0);}
        else assert.equal(f.trace.includes('outbox-lock'),false);
    }
    const failure=fixture();failure.state.fail='routes';await assert.rejects(failure.db.transaction(tx=>failure.worker.enqueueIn(tx,scope,failure.policy,failure.event,at)),error=>error===failure.failure);assert.equal(failure.trace.includes('outbox-lock'),false);
});

test('72 claim denial precedence recovery authorization policy endpoint silence authority never reaches capacity or rate',async()=>{
    const cases:Array<[string,(f:ReturnType<typeof fixture>)=>void]>=[
        ['RECOVERY_SUSPENDED',f=>{f.state.row.recoverySuspended=true;f.state.denied=true;f.state.policy=null;}],
        ['AUTHORIZATION_REVOKED',f=>{f.state.denied=true;f.state.policy=null;}],
        ['POLICY_CHANGED',f=>{f.state.policy.revision=2;f.state.policy.configRevision=2;f.state.endpoint=null;}],
        ['ENDPOINT_CHANGED',f=>{f.state.endpoint.credentialRevision=2;f.state.endpoint.revision=2;f.state.policy.silencedUntil=at+1;}],
        ['CURRENT_SILENCE',f=>{f.state.policy.silencedUntil=at+1;f.state.binding='sha256:'+'d'.repeat(64);}],
        ['RECOVERY_SUSPENDED',f=>{f.state.binding='sha256:'+'d'.repeat(64);}]];
    for(const [code,configure] of cases){const f=fixture();configure(f);await claim(f);assert.equal(f.state.row.status,'cancelled');assert.equal(f.state.row.lastCode,code);assert.equal(f.state.row.revision,2);assert.equal(f.state.row.nextAttemptAt,0);assert.equal(f.trace.includes('active'),false);assert.equal(f.trace.includes('rate'),false);assert.equal(f.state.attempts.length,0);}
});

test('72 claim exact active2 rate equal expiry sixth expired-attempt and immutable candidate revision boundaries',async()=>{
    const full=fixture();full.state.active=2;await claim(full);assert.equal(full.state.row.lastCode,'CAPACITY_WAIT');assert.equal(full.state.row.nextAttemptAt,at+1000);assert.equal(full.trace.includes('rate'),false);
    const rate=fixture();rate.state.rate=at+1;await claim(rate);assert.equal(rate.state.row.lastCode,'RATE_WAIT');assert.equal(rate.state.row.nextAttemptAt,at+1);
    const accepted=fixture();const selected=await claim(accepted);assert.equal(selected.row.status,'claimed');assert.equal(accepted.state.row.fence,1);assert.equal(accepted.state.row.claimUntil,at+30000);assert.deepEqual(accepted.trace.filter(v=>v.startsWith('auth:')),['auth:endpoint-manager','auth:policy-manager']);assert.ok(accepted.trace.indexOf('policy-lock')<accepted.trace.indexOf('endpoint-lock'));assert.ok(accepted.trace.indexOf('endpoint-lock')<accepted.trace.indexOf('outbox-lock'));assert.ok(accepted.trace.indexOf('put')<accepted.trace.indexOf('append'));
    const expired=fixture();expired.state.now=at+3600000;await claim(expired);assert.equal(expired.state.row.lastCode,'EVENT_TOO_OLD');assert.equal(expired.state.row.status,'dead-letter');
    for(const attempts of [1,5,6]){const f=fixture();claimed(f,attempts);f.state.now=at+30000;await claim(f);assert.equal(f.state.row.lastCode,'ATTEMPT_EXPIRED');assert.equal(f.state.row.status,attempts===6?'dead-letter':'retry-wait');assert.equal(f.state.row.nextAttemptAt,attempts===6?0:at+30000+Math.min(300000,30000*2**(attempts-1)));assert.equal(f.state.attempts[0].outcome,'unknown');}
    const max=fixture();max.state.row={...max.queued,status:'retry-wait',attemptCount:6,fence:6,lastOutcome:'unknown'};await claim(max);assert.equal(max.state.row.status,'dead-letter');assert.equal(max.trace.includes('active'),false);
    const stale=fixture();stale.state.lockMutate=()=>{stale.state.row={...stale.state.row,revision:2};};assert.equal(await claim(stale),null);assert.equal(stale.trace.includes('put'),false);
});

test('72 preflight exact five-second margin and finish stale fences revision deadline backclock do not mutate protected attempt history',async()=>{
    for(const [now,allowed] of [[at+25000,true],[at+25001,false],[at-1,false]] as const){const f=fixture();const row=claimed(f);f.state.now=now;assert.equal(await f.worker.preflight(scope,row),allowed);assert.equal(f.trace.includes('put'),false);}
    for(const configure of [(f:ReturnType<typeof fixture>)=>{f.state.row.revision++;},(f:ReturnType<typeof fixture>)=>{f.state.row.fence=2;f.state.row.attemptCount=2;},(f:ReturnType<typeof fixture>)=>{f.state.now=at+30000;},(f:ReturnType<typeof fixture>)=>{f.state.now=at-1;}]){const f=fixture();const row=claimed(f);configure(f);const before=copy(f.state.attempts);await f.worker.finish(scope,row,{outcome:'unknown',code:'NETWORK_UNKNOWN',statusCode:null});assert.deepEqual(f.state.attempts,before);assert.equal(f.trace.includes('finish'),false);assert.equal(f.trace.includes('put'),false);}
});

test('72 finish complete retry-code HTTP status sixth-attempt and strict lifetime boundary matrix',async()=>{
    const retryCodes=['DNS_FAILED','DNS_TIMEOUT','GUARD_FAILED','CAPACITY_UNAVAILABLE','ABORTED','DEADLINE','RESPONSE_LIMIT','NETWORK_UNKNOWN'];
    const rows:Array<[string,number|null,boolean]>=[...retryCodes.map(code=>[code,null,true] as [string,null,boolean]),...([400,408,429,499,500,503] as const).map(status=>['HTTP_REJECTED',status,status===408||status===429||status>=500] as [string,number,boolean]),['DNS_DENIED',null,false],['CREDENTIAL_UNAVAILABLE',null,false],['DISPATCH_DENIED',null,false]];
    for(const [code,statusCode,retry] of rows){const f=fixture();const row=claimed(f);await f.worker.finish(scope,row,{outcome:'rejected',code,statusCode});assert.equal(f.state.row.status,code==='DISPATCH_DENIED'?'cancelled':retry?'retry-wait':'dead-letter');assert.equal(f.state.row.nextAttemptAt,retry?at+30000:0);assert.equal(f.state.row.revision,3);assert.equal(f.state.attempts[0].code,code);}
    const delivered=fixture();await delivered.worker.finish(scope,claimed(delivered),{outcome:'delivered',code:'HTTP_ACCEPTED',statusCode:204});assert.equal(delivered.state.row.status,'delivered');
    const sixth=fixture();await sixth.worker.finish(scope,claimed(sixth,6),{outcome:'unknown',code:'NETWORK_UNKNOWN',statusCode:null});assert.equal(sixth.state.row.status,'dead-letter');
    for(const offset of [30000,30001]){const f=fixture();const row=claimed(f);f.state.now=at+3600000-offset;f.state.row={...f.state.row,claimedAt:f.state.now,claimUntil:f.state.now+30000,nextAttemptAt:f.state.now+30000,updatedAt:f.state.now};f.state.attempts[0].startedAt=f.state.now;await f.worker.finish(scope,{...row,...f.state.row},{outcome:'unknown',code:'NETWORK_UNKNOWN',statusCode:null});assert.equal(f.state.row.status,offset===30001?'retry-wait':'dead-letter');}
});

test('72 readonly history closed query canonical cursor filter ordering loss and head SHARE tail corruption matrix',async()=>{
    const from=new Date(at-1000).toISOString(),to=new Date(at+1).toISOString();
    const f=fixture();f.state.history=[f.queued,{...f.queued,id:notificationDeliveryId(scope,'event-old','endpoint'),eventId:'event-old',payload:{...f.queued.payload,deliveryId:notificationDeliveryId(scope,'event-old','endpoint'),event:{...f.queued.payload.event,id:'event-old'}}}];
    f.state.history[1].payloadDigest=digest(f.state.history[1].payload);f.state.history.sort((a:any,b:any)=>b.id.localeCompare(a.id));
    const first:any=await f.worker.history('actor',scope,{from,to,limit:'1'});assert.equal(first.hasMore,true);assert.equal(first.items.length,1);assert.equal(first.executionAuthorized,false);assert.equal(typeof first.nextCursor,'string');
    const next=fixture();next.state.history=[];await next.worker.history('actor',scope,{from,to,limit:'1',cursor:first.nextCursor});assert.deepEqual(next.state.query.before,{createdAt:at,id:first.items[0].id});
    for(const input of [{unknown:'x'},{limit:'01'},{limit:'51'},{from:'2027-01-01T00:00:00Z',to},{cursor:first.nextCursor},{from,to,limit:'2',cursor:first.nextCursor},{from,to,status:'unknown'},{from,to,cursor:'!'}]){const bad=fixture();await assert.rejects(bad.worker.history('actor',scope,input),{code:'INVALID_CONFIG'});assert.equal(bad.trace.includes('history'),false);}
    for(const rows of [[f.queued,f.queued],[{...f.queued,createdAt:at+2}],[f.state.history[1],f.state.history[0]]]){const bad=fixture();bad.state.history=rows;await assert.rejects(bad.worker.history('actor',scope,{from,to,limit:'2'}),{code:'INTEGRITY_FAILURE'});}
    const detail=fixture();const row=claimed(detail);const response:any=await detail.worker.get('actor',scope,row.id);assert.ok(detail.trace.indexOf('get:share')<detail.trace.indexOf('attempts'));assert.equal(response.attempts.items.length,1);for(const text of [binding,reference,detail.destination.url])assert.equal(JSON.stringify(response).includes(text),false);
    const bad=fixture();claimed(bad);bad.state.attempts.push(copy(bad.state.attempts[0]));await assert.rejects(bad.worker.get('actor',scope,bad.id),{code:'INTEGRITY_FAILURE'});
});

test('72 failure-header defers original revision cutoff exactly five minutes with rollback preserved and no private send',async()=>{
    const f=fixture();f.state.fail='append';await assert.rejects(f.worker.tick(),error=>error===f.failure);assert.equal(f.state.row.status,'queued');assert.equal(f.state.row.fence,0);assert.equal(f.state.attempts.length,0);assert.deepEqual(f.state.deferred,{header:{scopeId:scope,id:f.id,revision:1},cutoff:at,retryAt:at+300000});assert.deepEqual(f.trace.slice(-3),['defer','commit','idle']);
});

test('notification governance refuses same-Scope selfservice managers before endpoint secrets or delivery history',async()=>{
 assert.equal(NOTIFICATION_API_INTERFACE_VERSION,2);
 for(const operation of ['list','get','publish','disable','history','delivery'] as const){
  const f=fixture(),before=copy({endpoint:f.state.endpoint,row:f.state.row,attempts:f.state.attempts,audit:f.state.audit,inserted:f.state.inserted});
  const action=()=>operation==='list'?f.commands().list('selfservice-manager',scope):operation==='get'?f.commands().get('selfservice-manager',scope,'endpoint'):operation==='publish'?f.commands().publish('selfservice-manager',scope,'endpoint','manager-key',1,f.endpoint.config,f.destination):operation==='disable'?f.commands().disable('selfservice-manager',scope,'endpoint','manager-key',1):operation==='history'?f.worker.history('selfservice-manager',scope,{from:new Date(at-1).toISOString(),to:new Date(at+1).toISOString()}):f.worker.get('selfservice-manager',scope,f.id);
  await assert.rejects(action(),{code:'AUTHORIZATION_DENIED'});assert.equal(f.trace.at(0),'begin');assert.equal(f.trace.at(-1),'rollback');assert.deepEqual(f.trace.filter(value=>value!=='clock'),['begin','auth:selfservice-manager','rollback']);assert.deepEqual({endpoint:f.state.endpoint,row:f.state.row,attempts:f.state.attempts,audit:f.state.audit,inserted:f.state.inserted},before);assert.deepEqual(f.state.stages,[]);
 }
});
