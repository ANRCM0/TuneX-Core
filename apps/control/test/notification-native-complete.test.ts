import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { MySqlNotificationEndpointStore } from '../src/infrastructure/mysql-notification-endpoint-store.ts';
import { MySqlNotificationOutboxStore } from '../src/infrastructure/mysql-notification-outbox-store.ts';
import { MySqlNotificationEndpoints } from '../src/infrastructure/mysql-notification-endpoints.ts';
import { MySqlNotificationDeliveries } from '../src/infrastructure/mysql-notification-deliveries.ts';
import { notificationEndpointStorageValues, notificationOutboxStorageValues, notificationDeliveryId, notificationAttemptId,
    parseNotificationEndpoint, parseNotificationDelivery, notificationPayload, parseNotificationDeliveryAttempt } from '../src/modules/notification-owner/public.ts';
import type { NotificationDelivery, NotificationDeliveryAttempt, NotificationEndpoint } from '../src/modules/notification-owner/public.ts';
import { nativeValueDigest as digest } from '../src/compatibility/public.ts';

type Row=Record<string,any>;
const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
const scope='scope',at=1800000000000,maximum=Number.MAX_SAFE_INTEGER,binding='sha256:'+'a'.repeat(64);
const endpointStore=new MySqlNotificationEndpointStore(notificationEndpointStorageValues),outbox=new MySqlNotificationOutboxStore(notificationOutboxStorageValues);
const tables=['notification_endpoint_scopes','notification_endpoints','notification_endpoint_events','notification_delivery_scopes','notification_deliveries','notification_delivery_attempts','notification_delivery_rates'] as const;
async function database(action:(db:MySqlUnitOfWork)=>Promise<void>) {
    const name='tunex_notify_'+randomUUID().replaceAll('-',''),admin=await createConnection(databaseURL!),url=new URL(databaseURL!);url.pathname='/'+name;
    const db=new MySqlUnitOfWork(url.toString());let created=false;
    try{await admin.query(`CREATE DATABASE \`${name}\``);created=true;await db.migrate();
        await write(db.pool as unknown as Transaction,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',['manager','0'.repeat(64)]);
        await write(db.pool as unknown as Transaction,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',[scope,'manager']);
        await db.transaction(async tx=>{await endpointStore.lockScope(tx,scope);await outbox.lockScope(tx,scope);await endpointStore.put(tx,scope,endpoint());});
        await action(db);
    }finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${name}\``);}finally{await admin.end();}}
}
function endpoint(id='endpoint'):NotificationEndpoint {
    const config={schemaVersion:1 as const,enabled:true,policyIds:['policy'],kinds:['firing' as const],minimumIntervalSeconds:10};
    return parseNotificationEndpoint({endpointId:id,revision:1,credentialRevision:1,config,configDigest:digest(config),managedBy:'manager',createdAt:at,updatedAt:at,suspended:'none',authorityDigest:binding,credentialRef:'b'.repeat(64)});
}
function delivery(eventId='event',createdAt=at,status:NotificationDelivery['status']='queued',endpointId='endpoint'):NotificationDelivery {
    const id=notificationDeliveryId(scope,eventId,endpointId),payload=notificationPayload(scope,id,{id:eventId,policyId:'policy',configRevision:1,episode:1,kind:'firing',config:{rule:'forward-operation-failed',target:{kind:'forward',id:'forward'}},reason:'operation-failed',occurredAt:createdAt} as never);
    return parseNotificationDelivery({id,eventId,policyId:'policy',endpointId,policyConfigRevision:1,endpointRevision:1,credentialRevision:1,policyManagedBy:'manager',endpointManagedBy:'manager',authorityDigest:binding,payload,payloadDigest:digest(payload),revision:1,status,attemptCount:0,fence:0,claimedAt:null,claimUntil:null,createdAt,updatedAt:createdAt,nextAttemptAt:['cancelled','dead-letter'].includes(status)?0:createdAt,expiresAt:createdAt+3600000,lastCode:null,lastOutcome:'none',lastStatusCode:null,recoverySuspended:false});
}
function attempt(value:NotificationDelivery,ordinal=1,startedAt=value.createdAt):NotificationDeliveryAttempt {
    return parseNotificationDeliveryAttempt({id:notificationAttemptId(value.id,ordinal),deliveryId:value.id,ordinal,fence:ordinal,startedAt,finishedAt:null,outcome:'pending',code:null,statusCode:null});
}
const deliveryColumns='id,scope_id,event_id,policy_id,endpoint_id,policy_config_revision,endpoint_revision,credential_revision,policy_managed_by,endpoint_managed_by,authority_digest,payload,payload_digest,revision,status,attempt_count,fence,claimed_at,claim_until,created_at,updated_at,next_attempt_at,expires_at,last_code,last_outcome,last_status_code,recovery_suspended';
function deliveryArgs(v:NotificationDelivery):unknown[]{return [v.id,scope,v.eventId,v.policyId,v.endpointId,v.policyConfigRevision,v.endpointRevision,v.credentialRevision,v.policyManagedBy,v.endpointManagedBy,v.authorityDigest,JSON.stringify(v.payload),v.payloadDigest,v.revision,v.status,v.attemptCount,v.fence,v.claimedAt,v.claimUntil,v.createdAt,v.updatedAt,v.nextAttemptAt,v.expiresAt,v.lastCode,v.lastOutcome,v.lastStatusCode,v.recoverySuspended];}
async function seed(tx:Transaction,values:NotificationDelivery[]) {
    for(let start=0;start<values.length;start+=100){const batch=values.slice(start,start+100);await write(tx,`INSERT INTO notification_deliveries(${deliveryColumns}) VALUES ${batch.map(()=>`(${Array(27).fill('?').join(',')})`).join(',')}`,batch.flatMap(deliveryArgs));}
}
async function snapshot(tx:Transaction) {const result:Row={};for(const table of tables)result[table]=(await rows<Row>(tx,`SELECT * FROM ${table}`)).map(value=>JSON.stringify(value)).sort();return result;}
async function count(tx:Transaction,table:typeof tables[number]) {return (await rows<Row>(tx,`SELECT COUNT(*) n FROM ${table}`))[0]!.n as number;}
function proxy(tx:Transaction,afterWrite:number,calls:string[],failure:Error):Transaction {
    let writes=0;
    return new Proxy(tx,{get(target,key){if(key==='execute')return async(sql:string,args:unknown[]=[])=>{calls.push(sql);const result=await target.execute(sql,args);if(/^\s*(INSERT|UPDATE|DELETE)\b/.test(sql)&&++writes===afterWrite)throw failure;return result;};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
}

test('35 real canonical MySQL endpoint quotas audit eviction JSON/integer corruption and old count override retain exact original effects',
    {skip:!databaseURL,timeout:120000},async()=>database(async db=>{
        await db.transaction(async tx=>{
            for(let i=1;i<16;i++)await endpointStore.put(tx,scope,endpoint('endpoint-'+i));assert.equal(await endpointStore.count(tx,scope),16);assert.equal((await endpointStore.list(tx,scope)).length,16);
            await assert.rejects(endpointStore.put(tx,scope,endpoint('endpoint-over')),{code:'RESOURCE_LIMIT',status:429});
            const existing=endpoint();await endpointStore.putUsingCount(tx,scope,{...existing,revision:2},async()=>assert.fail('existing endpoint must not count'));assert.equal((await endpointStore.get(tx,scope,'endpoint',true))!.revision,2);
            const old=new MySqlNotificationEndpoints();let calls=0;old.count=async(actual,actualScope)=>{assert.equal(actual,tx);assert.equal(actualScope,scope);assert.equal(Object.getPrototypeOf(old),MySqlNotificationEndpoints.prototype);calls++;return 16;};await assert.rejects(old.put(tx,scope,endpoint('overridden')),{code:'RESOURCE_LIMIT'});assert.equal(calls,1);
            for(let i=0;i<129;i++)await endpointStore.audit(tx,scope,{id:'audit-'+String(i).padStart(3,'0'),endpointId:'endpoint',revision:2,kind:'publish',actorId:'manager',createdAt:at+i});
            assert.equal(await count(tx,'notification_endpoint_events'),128);assert.equal(await endpointStore.auditLosses(tx,scope),1);assert.deepEqual((await endpointStore.audits(tx,scope,'endpoint')).map(v=>v.id),Array.from({length:17},(_,i)=>'audit-'+String(128-i).padStart(3,'0')));assert.equal((await rows(tx,'SELECT id FROM notification_endpoint_events WHERE id=?',['audit-000'])).length,0);
            await write(tx,'UPDATE notification_endpoints SET revision=?,credential_revision=? WHERE scope_id=? AND endpoint_id=?',[maximum,maximum,scope,'endpoint']);const max=await endpointStore.get(tx,scope,'endpoint');assert.equal(max!.revision,maximum);assert.equal(max!.credentialRevision,maximum);
            await write(tx,'UPDATE notification_endpoints SET config_digest=? WHERE scope_id=? AND endpoint_id=?',['sha256:'+'0'.repeat(64),scope,'endpoint']);await assert.rejects(endpointStore.get(tx,scope,'endpoint'),{code:'INTEGRITY_FAILURE'});
            await endpointStore.put(tx,scope,{...existing,revision:2});
            await assert.rejects(write(tx,'UPDATE notification_endpoints SET revision=0 WHERE scope_id=? AND endpoint_id=?',[scope,'endpoint']));
            await write(tx,"UPDATE notification_endpoints SET config=JSON_SET(config,'$.unexpected',true) WHERE scope_id=? AND endpoint_id=?",[scope,'endpoint']);await assert.rejects(endpointStore.get(tx,scope,'endpoint'),{code:'INTEGRITY_FAILURE'});await endpointStore.put(tx,scope,{...existing,revision:2});
            await write(tx,"INSERT INTO notification_endpoints SELECT scope_id,'raw-over',revision,credential_revision,config,config_digest,enabled,managed_by,created_at,updated_at,suspended,authority_digest,credential_ref FROM notification_endpoints WHERE endpoint_id='endpoint'");await assert.rejects(endpointStore.list(tx,scope),{code:'INTEGRITY_FAILURE'});await write(tx,"DELETE FROM notification_endpoints WHERE endpoint_id='raw-over'");
            await write(tx,"INSERT INTO notification_endpoint_events(id,scope_id,endpoint_id,revision,kind,actor_id,created_at) VALUES('raw-audit-over',?,'endpoint',2,'publish','manager',?)",[scope,at]);await assert.rejects(endpointStore.audit(tx,scope,{id:'refused',endpointId:'endpoint',revision:2,kind:'publish',actorId:'manager',createdAt:at}),{code:'INTEGRITY_FAILURE'});await write(tx,"DELETE FROM notification_endpoint_events WHERE id='raw-audit-over'");
            await write(tx,'UPDATE notification_endpoint_scopes SET audit_evicted=? WHERE scope_id=?',[maximum,scope]);
        });
        const before=await db.transaction(snapshot);await assert.rejects(db.transaction(tx=>endpointStore.audit(tx,scope,{id:'saturated',endpointId:'endpoint',revision:2,kind:'publish',actorId:'manager',createdAt:at+1000})),{code:'INTEGRITY_FAILURE'});assert.deepEqual(await db.transaction(snapshot),before);
        await db.transaction(async tx=>{await write(tx,'UPDATE notification_endpoint_scopes SET audit_evicted=0 WHERE scope_id=?',[scope]);await write(tx,'DELETE FROM notification_endpoint_events');await write(tx,'DELETE FROM notification_endpoints WHERE endpoint_id<>?',['endpoint']);await endpointStore.putUsingCount(tx,scope,endpoint('new'),async(actual,s)=>{assert.equal(actual,tx);assert.equal(s,scope);return 0;});assert.equal(await endpointStore.count(tx,scope),2);});
    }));

test('35 real canonical MySQL outbox duplicate immutable JSON roundtrip claim CAS stale fence current override due defer rate and readonly history',
    {skip:!databaseURL,timeout:120000},async()=>database(async db=>{
        const value=delivery();await db.transaction(async tx=>{
            assert.equal(await outbox.insert(tx,scope,value,at),'inserted');assert.deepEqual(await outbox.get(tx,scope,value.id),value);assert.equal(await outbox.insert(tx,scope,value,at),'duplicate');
            await assert.rejects(outbox.insert(tx,scope,{...value,authorityDigest:'sha256:'+'c'.repeat(64)},at),{code:'INTEGRITY_FAILURE'});
            assert.deepEqual(await outbox.due(tx,at),{scopeId:scope,id:value.id,revision:1});assert.equal(await outbox.due(tx,at-1),null);
            await outbox.defer(tx,{scopeId:scope,id:value.id,revision:2},at,at+10);assert.equal((await outbox.get(tx,scope,value.id))!.nextAttemptAt,at);
            await outbox.defer(tx,{scopeId:scope,id:value.id,revision:1},at,at+10);assert.equal(await outbox.due(tx,at),null);assert.equal((await outbox.due(tx,at+10))!.id,value.id);
            const previous=(await outbox.get(tx,scope,value.id,'share'))!,claimed=parseNotificationDelivery({...previous,revision:2,status:'claimed',attemptCount:1,fence:1,claimedAt:at+10,claimUntil:at+30010,updatedAt:at+10,nextAttemptAt:at+30010});
            await outbox.put(tx,scope,claimed);assert.equal(await outbox.activeCount(tx,scope,at+30009),1);assert.equal(await outbox.activeCount(tx,scope,at+30010),0);
            await assert.rejects(outbox.putUsingCurrent(tx,scope,claimed,async()=>previous),{code:'REVISION_CONFLICT'});assert.deepEqual(await outbox.get(tx,scope,value.id,true),claimed);
            const old=new MySqlNotificationDeliveries();let gets=0;old.get=async(actual,s,id)=>{assert.equal(actual,tx);assert.equal(s,scope);assert.equal(id,value.id);gets++;return claimed;};await old.put(tx,scope,{...claimed,revision:3});assert.equal(gets,1);
            assert.equal(await outbox.reserveRate(tx,scope,'endpoint',at,10000),at);assert.equal(await outbox.reserveRate(tx,scope,'endpoint',at+9999,10000),at+10000);assert.equal(await outbox.reserveRate(tx,scope,'endpoint',at+10000,10000),at+10000);
            assert.equal((await rows<Row>(tx,'SELECT next_allowed_at FROM notification_delivery_rates'))[0]!.next_allowed_at,at+20000);
            const a=attempt(value,1,at+10);await outbox.appendAttempt(tx,scope,a);await outbox.finishAttempt(tx,scope,value.id,{...a,finishedAt:at+20,outcome:'delivered',code:'HTTP_ACCEPTED',statusCode:204});assert.equal((await outbox.attempts(tx,scope,value.id))[0]!.outcome,'delivered');
            await outbox.finishAttempt(tx,scope,value.id,{...a,finishedAt:at+21,outcome:'unknown',code:'NETWORK_UNKNOWN',statusCode:null});assert.equal((await outbox.attempts(tx,scope,value.id))[0]!.outcome,'delivered');
            const before=await snapshot(tx);const found=await outbox.history(tx,scope,{from:at,to:at+1,limit:1,before:null,endpointId:'endpoint',eventId:'event',status:'claimed'});assert.equal(found.length,1);assert.equal(found[0]!.revision,3);assert.deepEqual(await snapshot(tx),before);
            assert.deepEqual(await outbox.history(tx,scope,{from:at,to:at+1,limit:1,before:{createdAt:at,id:value.id}}),[]);
            await write(tx,"UPDATE notification_deliveries SET payload=JSON_SET(payload,'$.scopeId','foreign') WHERE id=?",[value.id]);await assert.rejects(outbox.get(tx,scope,value.id),{code:'INTEGRITY_FAILURE'});
            await write(tx,'UPDATE notification_deliveries SET payload=?,payload_digest=? WHERE id=?',[JSON.stringify(value.payload),value.payloadDigest,value.id]);
            await write(tx,'UPDATE notification_deliveries SET last_code=? WHERE id=?',['INVALID',value.id]);await assert.rejects(outbox.get(tx,scope,value.id),{code:'INTEGRITY_FAILURE'});await write(tx,'UPDATE notification_deliveries SET last_code=NULL WHERE id=?',[value.id]);
            await assert.rejects(write(tx,'UPDATE notification_deliveries SET fence=2 WHERE id=?',[value.id]));
            await write(tx,'UPDATE notification_deliveries SET revision=? WHERE id=?',[maximum,value.id]);assert.equal((await outbox.get(tx,scope,value.id))!.revision,maximum);await write(tx,'UPDATE notification_deliveries SET revision=3 WHERE id=?',[value.id]);
        });
    }));

test('35 real canonical MySQL seven-day strict terminal-only prune16 preserves live pending/history and loss accounting',
    {skip:!databaseURL,timeout:120000},async()=>database(async db=>{
        const now=at+604800001,old=Array.from({length:17},(_,i)=>delivery('old-'+i,at,'cancelled')).sort((a,b)=>a.id<b.id?-1:1),pending=delivery('old-pending',at),equal=delivery('equal',at+1,'cancelled');
        await db.transaction(async tx=>{await seed(tx,[...old,pending,equal]);for(const value of old.slice(0,2))await outbox.appendAttempt(tx,scope,attempt(value));
            assert.equal(await outbox.insert(tx,scope,delivery('new',now),now),'inserted');assert.equal(await count(tx,'notification_deliveries'),4);
            const remaining=(await rows<Row>(tx,'SELECT event_id FROM notification_deliveries ORDER BY event_id')).map(v=>v.event_id);assert.ok(remaining.includes('old-pending'));assert.ok(remaining.includes('equal'));assert.equal(remaining.filter(v=>v.startsWith('old-')&&v!=='old-pending').length,1);
            const retained=await outbox.losses(tx,scope);assert.equal(retained.rowsExpired,16);assert.equal(retained.attemptsEvicted,2);assert.equal(retained.rowsEvicted,0);
            const value=old.find(v=>remaining.includes(v.eventId))!;assert.ok(await outbox.get(tx,scope,value.id));assert.equal(await outbox.insert(tx,scope,delivery('second',now),now),'inserted');assert.equal((await outbox.losses(tx,scope)).rowsExpired,17);
        });
    }));

test('35 real canonical MySQL outbox1024 evicts only oldest terminal attempts256 retain newest and saturated loss rolls every write back',
    {skip:!databaseURL,timeout:180000},async()=>database(async db=>{
        const values=Array.from({length:1024},(_,i)=>delivery('queue-'+String(i).padStart(4,'0'),at));
        await db.transaction(async tx=>{await seed(tx,values);assert.equal(await outbox.insert(tx,scope,delivery('full'),at),'full');assert.equal(await count(tx,'notification_deliveries'),1024);assert.equal((await outbox.losses(tx,scope)).queueRejected,1);
            const terminal=values[0]!;await write(tx,"UPDATE notification_deliveries SET status='cancelled',next_attempt_at=0 WHERE id=?",[terminal.id]);await outbox.appendAttempt(tx,scope,attempt(terminal));
            assert.equal(await outbox.insert(tx,scope,delivery('evicted'),at),'inserted');assert.equal(await outbox.get(tx,scope,terminal.id),null);assert.equal((await outbox.losses(tx,scope)).rowsEvicted,1);assert.equal((await outbox.losses(tx,scope)).attemptsEvicted,1);
            for(let i=0;i<256;i++){const value=values[1+Math.floor(i/6)]!;await outbox.appendAttempt(tx,scope,attempt(value,i%6+1,at+i));}
            const evicted=attempt(values[1]!,1);await outbox.appendAttempt(tx,scope,attempt(values[44]!,1,at+1000));assert.equal(await count(tx,'notification_delivery_attempts'),256);assert.equal((await outbox.losses(tx,scope)).attemptsEvicted,2);
            await outbox.finishAttempt(tx,scope,evicted.deliveryId,{...evicted,finishedAt:at+2000,outcome:'unknown',code:'NETWORK_UNKNOWN',statusCode:null});assert.equal((await rows(tx,'SELECT id FROM notification_delivery_attempts WHERE id=?',[evicted.id])).length,0);
            await write(tx,'UPDATE notification_delivery_scopes SET attempts_evicted=? WHERE scope_id=?',[maximum,scope]);
        });
        const before=await db.transaction(snapshot);await assert.rejects(db.transaction(tx=>outbox.appendAttempt(tx,scope,attempt(values[45]!,1,at+3000))),{code:'INTEGRITY_FAILURE'});assert.deepEqual(await db.transaction(snapshot),before);
        await db.transaction(async tx=>{const raw=attempt(values[46]!,1,at+4000);await write(tx,'INSERT INTO notification_delivery_attempts(id,scope_id,delivery_id,ordinal,fence,started_at,finished_at,outcome,code,status_code) VALUES(?,?,?,?,?,?,?,?,?,?)',[raw.id,scope,raw.deliveryId,raw.ordinal,raw.fence,raw.startedAt,raw.finishedAt,raw.outcome,raw.code,raw.statusCode]);const over=await snapshot(tx);await assert.rejects(outbox.appendAttempt(tx,scope,attempt(values[47]!,1,at+5000)),{code:'INTEGRITY_FAILURE'});assert.deepEqual(await snapshot(tx),over);await write(tx,'DELETE FROM notification_delivery_attempts WHERE id=?',[raw.id]);});
        await db.transaction(async tx=>{await write(tx,'UPDATE notification_delivery_scopes SET routing_rejected=? WHERE scope_id=?',[maximum,scope]);});const saturated=await db.transaction(snapshot);await assert.rejects(db.transaction(tx=>outbox.loss(tx,scope,'routingRejected',1)),{code:'INTEGRITY_FAILURE'});assert.deepEqual(await db.transaction(snapshot),saturated);
        await db.transaction(async tx=>{await write(tx,'UPDATE notification_delivery_scopes SET attempts_evicted=0,queue_rejected=? WHERE scope_id=?',[maximum,scope]);});
        const fullBefore=await db.transaction(snapshot);await assert.rejects(db.transaction(tx=>outbox.insert(tx,scope,delivery('full-saturated'),at)),{code:'INTEGRITY_FAILURE'});assert.deepEqual(await db.transaction(snapshot),fullBefore);
        await db.transaction(async tx=>{await write(tx,"UPDATE notification_deliveries SET status='cancelled',next_attempt_at=0 WHERE id=?",[values[2]!.id]);});
        for(const kind of ['rows_evicted','rows_expired'] as const){await db.transaction(async tx=>{await write(tx,'UPDATE notification_delivery_scopes SET rows_evicted=?,rows_expired=? WHERE scope_id=?',[kind==='rows_evicted'?maximum:0,kind==='rows_expired'?maximum:0,scope]);});const retained=await db.transaction(snapshot),now=kind==='rows_expired'?at+604800001:at;await assert.rejects(db.transaction(tx=>outbox.insert(tx,scope,delivery('loss-'+kind,now),now)),{code:'INTEGRITY_FAILURE'});assert.deepEqual(await db.transaction(snapshot),retained,kind+' saturation must roll back deleted attempts, head and intermediate loss');}
        await db.transaction(async tx=>{await write(tx,'UPDATE notification_delivery_scopes SET rows_evicted=0,rows_expired=0 WHERE scope_id=?',[scope]);});
        for(let position=1;position<=5;position++){const retained=await db.transaction(snapshot),failure=new Error('queue-eviction-write:'+position),calls:string[]=[];await assert.rejects(db.transaction(tx=>outbox.insert(proxy(tx,position,calls,failure),scope,delivery('rollback-eviction'),at)),error=>error===failure);assert.deepEqual(await db.transaction(snapshot),retained);}
        await db.transaction(async tx=>{await seed(tx,[delivery('raw-overflow')]);const before=await snapshot(tx);await assert.rejects(outbox.insert(tx,scope,delivery('count-refusal'),at),{code:'INTEGRITY_FAILURE'});assert.deepEqual(await snapshot(tx),before);await write(tx,'DELETE FROM notification_deliveries WHERE id=?',[delivery('raw-overflow').id]);});
    }));

test('35 real canonical MySQL every original write failure rolls back all seven notification tables in supplied transaction',
    {skip:!databaseURL,timeout:180000},async()=>database(async db=>{
        const old=delivery('rollback-terminal',at,'cancelled');
        await db.transaction(async tx=>{await seed(tx,[old]);await outbox.appendAttempt(tx,scope,attempt(old));for(let i=0;i<128;i++)await endpointStore.audit(tx,scope,{id:'rollback-audit-'+i,endpointId:'endpoint',revision:1,kind:'publish',actorId:'manager',createdAt:at+i});});
        const audit={id:'late-audit',endpointId:'endpoint',revision:1,kind:'publish' as const,actorId:'manager',createdAt:at+1000};
        const operations:Array<[string,number,(tx:Transaction)=>Promise<unknown>]>=[
            ['endpoint scope lock',1,tx=>endpointStore.lockScope(tx,scope)],
            ['delivery scope lock',1,tx=>outbox.lockScope(tx,scope)],
            ['endpoint publish',1,tx=>endpointStore.put(tx,scope,{...endpoint(),revision:2})],
            ['audit bounded retention',3,tx=>endpointStore.audit(tx,scope,audit)],
            ['terminal prune then insert',5,tx=>outbox.insert(tx,scope,delivery('rollback-insert',at+604800001),at+604800001)],
            ['rate reservation',1,tx=>outbox.reserveRate(tx,scope,'endpoint',at,10000)],
            ['loss arithmetic',1,tx=>outbox.loss(tx,scope,'disabledSuppressed',2)],
            ['claim CAS update',1,tx=>outbox.put(tx,scope,{...old,revision:2})],
            ['attempt completion',1,tx=>outbox.finishAttempt(tx,scope,old.id,{...attempt(old),finishedAt:at+1,outcome:'unknown',code:'NETWORK_UNKNOWN',statusCode:null})],
            ['header defer',1,tx=>outbox.defer(tx,{scopeId:scope,id:old.id,revision:1},at,at+1)],
        ];
        for(const [name,total,operation] of operations)for(let position=1;position<=total;position++){
            const before=await db.transaction(snapshot),failure=new Error(name+':write:'+position),calls:string[]=[];
            await assert.rejects(db.transaction(tx=>operation(proxy(tx,position,calls,failure))),error=>error===failure);
            assert.equal(calls.filter(sql=>/^\s*(INSERT|UPDATE|DELETE)\b/.test(sql)).length,position,name);assert.deepEqual(await db.transaction(snapshot),before,name+' rollback all notification tables');
        }
        // The third bounded-attempt write follows oldest-detail deletion and loss increment.
        await db.transaction(async tx=>{const values=Array.from({length:43},(_,i)=>delivery('rollback-detail-'+i));await seed(tx,values);for(let i=1;i<256;i++)await outbox.appendAttempt(tx,scope,attempt(values[Math.floor((i-1)/6)]!,((i-1)%6)+1,at+i));});
        const appended=attempt(old,2,at+5000);
        for(let position=1;position<=3;position++){const before=await db.transaction(snapshot),failure=new Error('attempt-retention:'+position),calls:string[]=[];await assert.rejects(db.transaction(tx=>outbox.appendAttempt(proxy(tx,position,calls,failure),scope,appended)),error=>error===failure);assert.deepEqual(await db.transaction(snapshot),before);}
    }));

test('35 real canonical MySQL loss maxima every loss family and sixteen rate identities remain bounded without mutating readonly losses',
    {skip:!databaseURL,timeout:120000},async()=>database(async db=>{
        await db.transaction(async tx=>{for(let i=1;i<16;i++)await endpointStore.put(tx,scope,endpoint('rate-'+i));for(const value of await endpointStore.list(tx,scope))assert.equal(await outbox.reserveRate(tx,scope,value.endpointId,at,1),at);assert.equal(await count(tx,'notification_delivery_rates'),16);
            const before=await snapshot(tx);assert.equal(await outbox.reserveRate(tx,scope,'endpoint',at,1),at+1);assert.deepEqual(await snapshot(tx),before);await assert.rejects(outbox.reserveRate(tx,scope,'rate-over',at,1),{code:'INTEGRITY_FAILURE'});
            await write(tx,'UPDATE notification_delivery_scopes SET queue_rejected=?,routing_rejected=?,silence_suppressed=?,disabled_suppressed=?,rows_expired=?,rows_evicted=?,attempts_evicted=? WHERE scope_id=?',[maximum,maximum,maximum,maximum,maximum,maximum,maximum,scope]);const snapshotBefore=await snapshot(tx);assert.deepEqual(Object.values(await outbox.losses(tx,scope)),Array(7).fill(maximum));assert.deepEqual(await snapshot(tx),snapshotBefore);
            for(const kind of ['routingRejected','silenceSuppressed','disabledSuppressed'] as const)await assert.rejects(outbox.loss(tx,scope,kind,1),{code:'INTEGRITY_FAILURE'});
            await outbox.loss(tx,scope,'routingRejected',0);assert.deepEqual(await snapshot(tx),snapshotBefore);
        });
    }));
