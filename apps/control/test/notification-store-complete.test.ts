import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as core from '@tunex/core';
import { ControlError, invalid } from '../src/framework/public.ts';

type Any = Record<string, any>;
function load(file:string,providers:Any) {
    const exports:Any={};
    const code=ts.transpileModule(readFileSync(new URL('../src/infrastructure/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
    new vm.Script(code,{filename:file}).runInNewContext({exports,Buffer,require(name:string){assert.ok(Object.hasOwn(providers,name),name);return providers[name];}});
    return exports;
}
const plain=(value:unknown)=>JSON.parse(JSON.stringify(value));
const normalize=(sql:string)=>sql.replace(/\s+/g,' ').trim();
function harness(kind:'endpoint'|'outbox') {
    const tx={},calls:Any[]=[],answers:any[]=[],failure=new Error('native SQL failure');
    let rejectParse=false;
    const values={endpoint:(v:any)=>{calls.push({kind:'endpoint',v});if(rejectParse)throw failure;return v;},audit:(v:any)=>{calls.push({kind:'audit',v});if(rejectParse)throw failure;return v;},
        delivery:(v:any)=>{calls.push({kind:'delivery',v});if(rejectParse)throw failure;return v;},attempt:(v:any)=>{calls.push({kind:'attempt',v});if(rejectParse)throw failure;return v;}};
    const sql={json:(v:unknown)=>typeof v==='string'?JSON.parse(v):v,
        rows:async(actual:unknown,query:string,args:unknown[])=>{assert.equal(actual,tx);calls.push({kind:'rows',sql:normalize(query),args});const answer=answers.shift();if(answer instanceof Error)throw answer;assert.ok(Array.isArray(answer),'queued SELECT answer required');return answer;},
        write:async(actual:unknown,query:string,args:unknown[])=>{assert.equal(actual,tx);calls.push({kind:'write',sql:normalize(query),args});const answer=answers.shift();if(answer instanceof Error)throw answer;assert.equal(typeof answer,'number','queued write answer required');return answer;}};
    const api=load('mysql-notification-'+(kind==='endpoint'?'endpoint':'outbox')+'-store.ts',{'@tunex/core':core,'../framework/public.ts':{ControlError,invalid},'./mysql.ts':sql});
    const Store=api[kind==='endpoint'?'MySqlNotificationEndpointStore':'MySqlNotificationOutboxStore'];
    const store=new Store(values);assert.equal(calls.length,0);
    return {tx,calls,answers,store,failure,setReject:(value:boolean)=>{rejectParse=value;},sql:()=>calls.filter(v=>v.kind==='rows'||v.kind==='write')};
}
const endpoint={endpointId:'endpoint-a',revision:2,credentialRevision:1,config:{enabled:true},configDigest:'digest',managedBy:'actor-a',createdAt:10,updatedAt:20,suspended:'none',authorityDigest:'authority',credentialRef:'ref'};
const audit={id:'audit-a',endpointId:'endpoint-a',revision:2,kind:'publish',actorId:'actor-a',createdAt:20};
const delivery={id:'delivery-a',eventId:'event-a',policyId:'policy-a',endpointId:'endpoint-a',policyConfigRevision:1,endpointRevision:2,credentialRevision:1,policyManagedBy:'actor-a',endpointManagedBy:'actor-b',authorityDigest:'authority',payload:{scopeId:'scope-a',event:{kind:'opened'}},payloadDigest:'digest',revision:1,status:'queued',attemptCount:0,fence:0,claimedAt:null,claimUntil:null,createdAt:10,updatedAt:10,nextAttemptAt:10,expiresAt:1000000,lastCode:null,lastOutcome:'none',lastStatusCode:null,recoverySuspended:false};
const attempt={id:'attempt-a',deliveryId:delivery.id,ordinal:1,fence:1,startedAt:20,finishedAt:null,outcome:'pending',code:null,statusCode:null};
function deliveryRow(value:Any=delivery):Any {
    const columns=['id','event_id','policy_id','endpoint_id','policy_config_revision','endpoint_revision','credential_revision','policy_managed_by','endpoint_managed_by','authority_digest','payload','payload_digest','revision','status','attempt_count','fence','claimed_at','claim_until','created_at','updated_at','next_attempt_at','expires_at','last_code','last_outcome','last_status_code','recovery_suspended'];
    const keys=['id','eventId','policyId','endpointId','policyConfigRevision','endpointRevision','credentialRevision','policyManagedBy','endpointManagedBy','authorityDigest','payload','payloadDigest','revision','status','attemptCount','fence','claimedAt','claimUntil','createdAt','updatedAt','nextAttemptAt','expiresAt','lastCode','lastOutcome','lastStatusCode','recoverySuspended'];
    return Object.fromEntries([['scope_id','scope-a'],...columns.map((key,i)=>[key,value[keys[i]!]])]);
}

test('35 endpoint native parse precedes SQL count stays lazy and exact original transaction upsert argument order survives',async()=>{
    const h=harness('endpoint');let counts=0;
    h.setReject(true);await assert.rejects(h.store.putUsingCount(h.tx,'scope-a',endpoint,()=>{counts++;return 0;}),{code:'INTEGRITY_FAILURE'});assert.equal(h.sql().length,0);assert.equal(counts,0);
    h.setReject(false);h.answers.push([{endpoint_id:endpoint.endpointId}],1);
    await h.store.putUsingCount(h.tx,'scope-a',endpoint,()=>{counts++;return 99;});assert.equal(counts,0);
    const write=h.sql().at(-1)!;assert.equal(write.sql,'INSERT INTO notification_endpoints(scope_id,endpoint_id,revision,credential_revision,config,config_digest,enabled,managed_by,created_at,updated_at,suspended,authority_digest,credential_ref) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE revision=VALUES(revision),credential_revision=VALUES(credential_revision),config=VALUES(config),config_digest=VALUES(config_digest), enabled=VALUES(enabled),managed_by=VALUES(managed_by),updated_at=VALUES(updated_at),suspended=VALUES(suspended),authority_digest=VALUES(authority_digest),credential_ref=VALUES(credential_ref)');
    assert.deepEqual(plain(write.args),['scope-a','endpoint-a',2,1,'{"enabled":true}','digest',true,'actor-a',10,20,'none','authority','ref']);
    for(const count of [15,16,17]){h.answers.push([]);if(count===15)h.answers.push(1);const call=h.store.putUsingCount(h.tx,'scope-a',endpoint,(tx:unknown,scope:string)=>{assert.equal(tx,h.tx);assert.equal(scope,'scope-a');counts++;return count;});if(count===15)await call;else await assert.rejects(call,{code:'RESOURCE_LIMIT',status:429});}
    h.answers.push(h.failure);await assert.rejects(h.store.get(h.tx,'scope-a','endpoint-a'),error=>error===h.failure);
});

test('35 endpoint exact 16 list 128 audit loss saturation canonical integer and native JSON refusal boundaries',async()=>{
    const h=harness('endpoint');
    h.answers.push(1,[]);await h.store.lockScope(h.tx,'scope-a');assert.deepEqual(h.sql().map(v=>v.sql),['INSERT INTO notification_endpoint_scopes(scope_id) VALUES(?) ON DUPLICATE KEY UPDATE scope_id=VALUES(scope_id)','SELECT scope_id FROM notification_endpoint_scopes WHERE scope_id=? FOR UPDATE']);
    const row={endpoint_id:'endpoint-a',revision:'2',credential_revision:'1',config:'{"enabled":true}',config_digest:'digest',managed_by:'actor-a',created_at:'0',updated_at:'9007199254740991',suspended:'none',authority_digest:'authority',credential_ref:'ref'};
    h.answers.push(Array.from({length:16},()=>row));assert.equal((await h.store.list(h.tx,'scope-a')).length,16);assert.match(h.sql().at(-1)!.sql,/ORDER BY endpoint_id LIMIT 17$/);
    h.answers.push(Array.from({length:17},()=>row));await assert.rejects(h.store.list(h.tx,'scope-a'),{code:'INTEGRITY_FAILURE'});
    for(const patch of [{revision:'01'},{revision:-1},{revision:'1 '},{config:'{'},{config:JSON.stringify('x'.repeat(4097))}]){h.answers.push([{...row,...patch}]);await assert.rejects(h.store.get(h.tx,'scope-a','endpoint-a',true),{code:'INTEGRITY_FAILURE'});assert.match(h.sql().at(-1)!.sql,/FOR UPDATE$/);}
    for(const count of [127,128,129]){const start=h.sql().length;h.answers.push([{n:String(count)}]);if(count===128)h.answers.push(1,1);if(count<=128)h.answers.push(1);if(count===129)await assert.rejects(h.store.audit(h.tx,'scope-a',audit),{code:'INTEGRITY_FAILURE'});else await h.store.audit(h.tx,'scope-a',audit);const writes=h.sql().slice(start).filter(v=>v.kind==='write');assert.equal(writes.length,count===128?3:count===127?1:0);if(count===128){assert.equal(writes[0]!.sql,'DELETE FROM notification_endpoint_events WHERE scope_id=? ORDER BY created_at,id LIMIT 1');assert.match(writes[1]!.sql,/audit_evicted<9007199254740991$/);}}
    for(const replies of [[[{n:128}],0],[[{n:128}],1,0]]){h.answers.push(...replies);await assert.rejects(h.store.audit(h.tx,'scope-a',audit),{code:'INTEGRITY_FAILURE'});}
    h.answers.push([],[{audit_evicted:'9007199254740991'}]);assert.equal(await h.store.auditLosses(h.tx,'scope-a'),0);assert.equal(await h.store.auditLosses(h.tx,'scope-a'),Number.MAX_SAFE_INTEGER);
    h.answers.push([]);await h.store.audits(h.tx,'scope-a','endpoint-a');assert.equal(h.sql().at(-1)!.sql,'SELECT id,endpoint_id,revision,kind,actor_id,created_at FROM notification_endpoint_events WHERE scope_id=? AND endpoint_id=? ORDER BY created_at DESC,id DESC LIMIT 17');
});

test('35 outbox insert duplicates compare immutable values before prune and exact 27-column insert remains in caller transaction',async()=>{
    const h=harness('outbox');h.answers.push([],[],[{n:1023}],1);assert.equal(await h.store.insert(h.tx,'scope-a',delivery,604800001),'inserted');
    const writes=h.sql().filter(v=>v.kind==='write');assert.equal(writes.length,1);assert.equal(writes[0]!.args.length,27);
    assert.deepEqual(plain(writes[0]!.args),['delivery-a','scope-a','event-a','policy-a','endpoint-a',1,2,1,'actor-a','actor-b','authority',JSON.stringify(delivery.payload),'digest',1,'queued',0,0,null,null,10,10,10,1000000,null,'none',null,false]);
    assert.match(h.sql()[1]!.sql,/status IN \('delivered','dead-letter','cancelled'\) AND created_at<\? ORDER BY created_at,id LIMIT 16$/);assert.deepEqual(plain(h.sql()[1]!.args),['scope-a',1]);
    h.answers.push([deliveryRow({...delivery,revision:9,status:'delivered'})]);assert.equal(await h.store.insert(h.tx,'scope-a',delivery,20),'duplicate');
    for(const rows of [[deliveryRow({...delivery,payloadDigest:'changed'})],[deliveryRow(),deliveryRow()]]){h.answers.push(rows);await assert.rejects(h.store.insert(h.tx,'scope-a',delivery,20),{code:'INTEGRITY_FAILURE'});}
    h.setReject(true);const before=h.sql().length;await assert.rejects(h.store.insert(h.tx,'scope-a',delivery,20),{code:'INTEGRITY_FAILURE'});assert.equal(h.sql().length,before);
});

test('35 outbox terminal-only 7day pruning max16 queue1024 eviction and loss counters fail closed at exact native writes',async()=>{
    const h=harness('outbox');h.answers.push([],Array.from({length:16},(_,i)=>({id:'old-'+i})),3,16,1,1,[{n:1024}],[{id:'evict-a'}],2,1,1,1,1);
    assert.equal(await h.store.insert(h.tx,'scope-a',delivery,604800000),'inserted');
    const calls=h.sql();assert.deepEqual(plain(calls[1]!.args),['scope-a',0]);assert.match(calls[3]!.sql,/AND status IN \('delivered','dead-letter','cancelled'\)$/);assert.equal(calls[2]!.args.length,17);
    const loss=calls.filter(v=>v.sql.startsWith('UPDATE notification_delivery_scopes'));assert.deepEqual(loss.map(v=>plain(v.args)),[[3,'scope-a',Number.MAX_SAFE_INTEGER-3],[16,'scope-a',Number.MAX_SAFE_INTEGER-16],[2,'scope-a',Number.MAX_SAFE_INTEGER-2],[1,'scope-a',Number.MAX_SAFE_INTEGER-1]]);
    h.answers.push([],[],[{n:1024}],[],1);assert.equal(await h.store.insert(h.tx,'scope-a',delivery,20),'full');assert.match(h.sql().at(-1)!.sql,/queue_rejected=queue_rejected\+\?/);
    h.answers.push([],[],[{n:1025}]);await assert.rejects(h.store.insert(h.tx,'scope-a',delivery,20),{code:'INTEGRITY_FAILURE'});
    h.answers.push([],[{id:'old-a'}],0,0);await assert.rejects(h.store.insert(h.tx,'scope-a',delivery,20),{code:'INTEGRITY_FAILURE'});
    for(const kind of ['routingRejected','silenceSuppressed','disabledSuppressed']){const before=h.sql().length;await h.store.loss(h.tx,'scope-a',kind,0);assert.equal(h.sql().length,before);h.answers.push(0);await assert.rejects(h.store.loss(h.tx,'scope-a',kind,1),{code:'INTEGRITY_FAILURE'});}
    await assert.rejects(h.store.loss(h.tx,'scope-a','rowsEvicted',1),{code:'INTEGRITY_FAILURE'});
});

test('35 outbox native get decode scope flag and payload checks remain synchronous before owner values and SQL CAS',async()=>{
    const h=harness('outbox');for(const lock of [false,true,'share']){h.answers.push([deliveryRow()]);assert.deepEqual(plain(await h.store.get(h.tx,'scope-a',delivery.id,lock)),delivery);assert.equal(h.sql().at(-1)!.sql.endsWith(' FOR SHARE'),lock==='share');assert.equal(h.sql().at(-1)!.sql.endsWith(' FOR UPDATE'),lock===true);}
    for(const patch of [{revision:'01'},{recovery_suspended:'0'},{payload:'{'},{payload:'"'+('x'.repeat(4097))+'"'},{scope_id:'foreign-scope'}]){h.answers.push([{...deliveryRow(),...patch}]);await assert.rejects(h.store.get(h.tx,'scope-a',delivery.id),{code:'INTEGRITY_FAILURE'});}
    const value={...delivery,revision:2,status:'claimed',attemptCount:1,fence:1,claimedAt:30,claimUntil:5000,updatedAt:30,nextAttemptAt:5000};let gets=0;
    h.answers.push(1);await h.store.putUsingCurrent(h.tx,'scope-a',value,(tx:unknown,scope:string,id:string)=>{assert.equal(tx,h.tx);assert.equal(scope,'scope-a');assert.equal(id,delivery.id);gets++;return delivery;});assert.equal(gets,1);
    assert.deepEqual(plain(h.sql().at(-1)!.args),[2,'claimed',1,1,30,5000,30,5000,null,'none',null,false,'scope-a','delivery-a',1]);assert.match(h.sql().at(-1)!.sql,/WHERE scope_id=\? AND id=\? AND revision=\?$/);
    for(const previous of [null,{...delivery,payloadDigest:'changed'},{...delivery,revision:2}])await assert.rejects(h.store.putUsingCurrent(h.tx,'scope-a',value,()=>previous),{code:'INTEGRITY_FAILURE'});
    h.answers.push(0);await assert.rejects(h.store.putUsingCurrent(h.tx,'scope-a',value,()=>delivery),{code:'REVISION_CONFLICT'});
    h.setReject(true);await assert.rejects(h.store.putUsingCurrent(h.tx,'scope-a',value,()=>{assert.fail('parse must precede get');}),{code:'INTEGRITY_FAILURE'});
});

test('35 outbox attempt256 retention zero-row finish never recreates history and rate16 uses strict live boundary',async()=>{
    const h=harness('outbox');h.answers.push([{n:256}],1,1,1);await h.store.appendAttempt(h.tx,'scope-a',attempt);assert.equal(h.sql()[1]!.sql,'DELETE FROM notification_delivery_attempts WHERE scope_id=? ORDER BY started_at,id LIMIT 1');assert.deepEqual(plain(h.sql().at(-1)!.args),['attempt-a','scope-a','delivery-a',1,1,20,null,'pending',null,null]);
    h.answers.push([{n:257}]);await assert.rejects(h.store.appendAttempt(h.tx,'scope-a',attempt),{code:'INTEGRITY_FAILURE'});
    h.answers.push(0);await h.store.finishAttempt(h.tx,'scope-a',delivery.id,{...attempt,finishedAt:30,outcome:'delivered',code:'HTTP_ACCEPTED',statusCode:204});assert.deepEqual(plain(h.sql().at(-1)!.args),[30,'delivered','HTTP_ACCEPTED',204,'scope-a','attempt-a','delivery-a',1,1,20]);assert.match(h.sql().at(-1)!.sql,/AND outcome='pending'$/);
    await assert.rejects(h.store.finishAttempt(h.tx,'scope-a','other',attempt),{code:'INTEGRITY_FAILURE'});
    h.answers.push([{next_allowed_at:101}]);const before=h.sql().length;assert.equal(await h.store.reserveRate(h.tx,'scope-a','endpoint-a',100,1000),101);assert.equal(h.sql().length,before+1);
    h.answers.push([{next_allowed_at:100}],1);assert.equal(await h.store.reserveRate(h.tx,'scope-a','endpoint-a',100,1000),100);assert.deepEqual(plain(h.sql().at(-1)!.args),['scope-a','endpoint-a',1100]);
    h.answers.push([],[{n:16}]);await assert.rejects(h.store.reserveRate(h.tx,'scope-a','endpoint-a',100,1000),{code:'INTEGRITY_FAILURE'});
    await assert.rejects(h.store.reserveRate(h.tx,'scope-a','endpoint-a',Number.MAX_SAFE_INTEGER,1),{code:'INTEGRITY_FAILURE'});
});

test('35 outbox due defer active exact bounds and parameterized readonly attempts history losses',async()=>{
    const h=harness('outbox');h.answers.push([{scope_id:'scope-a',id:delivery.id,revision:'1'}]);assert.deepEqual(plain(await h.store.due(h.tx,100)),{scopeId:'scope-a',id:delivery.id,revision:1});assert.match(h.sql().at(-1)!.sql,/status IN \('queued','retry-wait','claimed'\) AND next_attempt_at<=\? ORDER BY next_attempt_at,id LIMIT 1$/);
    const header={scopeId:'scope-a',id:delivery.id,revision:1};await assert.rejects(h.store.defer(h.tx,header,100,100));h.answers.push(0);await h.store.defer(h.tx,header,100,101);assert.deepEqual(plain(h.sql().at(-1)!.args),[101,'scope-a','delivery-a',1,100]);
    h.answers.push([{n:'2'}]);assert.equal(await h.store.activeCount(h.tx,'scope-a',100),2);assert.match(h.sql().at(-1)!.sql,/status='claimed' AND claim_until>\?$/);
    h.answers.push([]);await h.store.attempts(h.tx,'scope-a',delivery.id);assert.match(h.sql().at(-1)!.sql,/ORDER BY ordinal DESC,id DESC LIMIT 17$/);
    for(const limit of [1,50]){h.answers.push([]);await h.store.history(h.tx,'scope-a',{from:1,to:10,limit,endpointId:'endpoint-a',eventId:'event-a',status:'queued',before:{createdAt:5,id:'before-a'}});assert.match(h.sql().at(-1)!.sql,new RegExp('ORDER BY created_at DESC,id DESC LIMIT '+(limit+1)+'$'));assert.deepEqual(plain(h.sql().at(-1)!.args),['scope-a',1,10,'endpoint-a','event-a','queued',5,5,'before-a']);}
    for(const limit of [0,51,1.1])await assert.rejects(h.store.history(h.tx,'scope-a',{from:1,to:10,limit}));
    h.answers.push([]);assert.deepEqual(plain(await h.store.losses(h.tx,'scope-a')),{queueRejected:0,routingRejected:0,silenceSuppressed:0,disabledSuppressed:0,rowsExpired:0,rowsEvicted:0,attemptsEvicted:0});
});

test('35 old zeroarg wrappers keep prototype receiver count/get overrides and singleton original value providers',async()=>{
    for(const kind of ['endpoint','outbox'] as const){const trace:any[]=[],values={},tx={},value=kind==='endpoint'?endpoint:delivery;
        class Store {constructor(actual:unknown){assert.equal(actual,values);trace.push('construct');}async putUsingCount(actual:unknown,scope:string,v:unknown,count:(tx:unknown,scope:string)=>Promise<number>){assert.equal(actual,tx);assert.equal(v,value);assert.equal(await count(actual,scope),7);}async putUsingCurrent(actual:unknown,scope:string,v:unknown,get:(tx:unknown,scope:string,id:string)=>Promise<unknown>){assert.equal(actual,tx);assert.equal(v,value);assert.equal(await get(actual,scope,'delivery-a'),delivery);}}
        const file=kind==='endpoint'?'mysql-notification-endpoints.ts':'mysql-notification-deliveries.ts';
        const module=load(file,{['./mysql-notification-'+(kind==='endpoint'?'endpoint':'outbox')+'-store.ts']:{[kind==='endpoint'?'MySqlNotificationEndpointStore':'MySqlNotificationOutboxStore']:Store},'../modules/notification-owner/public.ts':{[kind==='endpoint'?'notificationEndpointStorageValues':'notificationOutboxStorageValues']:values}});
        const Wrapper=module[kind==='endpoint'?'MySqlNotificationEndpoints':'MySqlNotificationDeliveries'];const instance=new Wrapper();new Wrapper();assert.deepEqual(trace,['construct']);
        if(kind==='endpoint')instance.count=function(actual:unknown,scope:string){assert.equal(this,instance);assert.equal(actual,tx);assert.equal(scope,'scope-a');return 7;};
        else instance.get=function(actual:unknown,scope:string,id:string){assert.equal(this,instance);assert.equal(actual,tx);assert.equal(scope,'scope-a');assert.equal(id,'delivery-a');return delivery;};
        await instance.put(tx,'scope-a',value);assert.equal(Object.hasOwn(instance,'put'),false);
    }
});

test('35 endpoint and outbox bindings initialize only their own synchronous parser pair and lower adapters contain no upper source or type dependency',()=>{
    for(const family of ['endpoint','outbox']){
        const seen:string[]=[],pair=family==='endpoint'?['endpoint','audit']:['delivery','attempt'];let binding:unknown;
        const parsers=Object.fromEntries(pair.map(name=>['parseNotification'+name[0]!.toUpperCase()+name.slice(1),(value:unknown)=>{seen.push(name);return value;}]));
        // The original exported names include Delivery rather than the generic storage term outbox.
        const values=family==='endpoint'?{parseNotificationEndpoint:parsers.parseNotificationEndpoint,parseNotificationEndpointAudit:parsers.parseNotificationAudit}:
            {parseNotificationDelivery:parsers.parseNotificationDelivery,parseNotificationDeliveryAttempt:parsers.parseNotificationAttempt};
        const providers={'../../framework/public.ts':{freezeModuleValue(value:unknown){binding=value;return Object.freeze(value);}},['./'+(family==='endpoint'?'endpoint':'delivery')+'-values.ts']:values};
        const module=load('../modules/notification-owner/'+family+'-storage-values.ts',providers),actual=module[family==='endpoint'?'notificationEndpointStorageValues':'notificationOutboxStorageValues'];
        assert.ok(actual===binding);assert.equal(Object.isFrozen(actual),true);assert.deepEqual(Object.keys(actual),pair);assert.equal(seen.length,0);
        for(const name of pair){const input={original:name};assert.equal(actual[name](input),input);}assert.deepEqual(seen,pair);
    }
    for(const file of ['mysql-notification-endpoint-store.ts','mysql-notification-outbox-store.ts']){
        const source=ts.createSourceFile(file,readFileSync(new URL('../src/infrastructure/'+file,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
        const imports=source.statements.filter(ts.isImportDeclaration).map(statement=>(statement.moduleSpecifier as ts.StringLiteral).text);
        assert.ok(imports.every(name=>['@tunex/core','../framework/public.ts','./mysql.ts'].includes(name)),file+' all source and type imports must remain lower/public');
        assert.ok(imports.includes('../framework/public.ts'));assert.ok(imports.includes('./mysql.ts'));
    }
});
