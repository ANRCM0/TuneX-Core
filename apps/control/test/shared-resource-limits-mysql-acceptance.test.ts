import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'mysql2/promise';
import type { RuntimeAssignmentValue } from '@tunex/contracts/execution-values';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { MySqlNodeAuthorityStore } from '../src/infrastructure/mysql-node-authority.ts';
import { MySqlRuntimeResourceStore } from '../src/infrastructure/mysql-runtime-resources.ts';
import { MySqlSharedResourceLimitStore } from '../src/infrastructure/mysql-resource-limits.ts';
import { nativeValueDigest } from '../src/compatibility/public.ts';
import { Identity } from '../src/modules/identity.ts';
import { SharedResourceLimits } from '../src/modules/resource-limit-owner/public.ts';
import { ResourceUsage } from '../src/modules/resource-limit-owner/public.ts';
import { MySqlResourceUsageStore } from '../src/infrastructure/mysql-resource-usage.ts';
import { MySqlStationAlertStore } from '../src/infrastructure/mysql-station-alerts.ts';
import { MySqlNotificationEndpoints } from '../src/infrastructure/mysql-notification-endpoints.ts';
import { MySqlNotificationDeliveries } from '../src/infrastructure/mysql-notification-deliveries.ts';
import { StationAlerts, StationResourceFacts } from '../src/modules/station-alert-owner/public.ts';
import type { StationEventHandoff } from '../src/modules/station-alert-owner/public.ts';
import { NotificationDeliveries, parseNotificationEndpoint } from '../src/modules/notification-owner/public.ts';
import type { NotificationDelivery, NotificationSecrets, NotificationSender } from '../src/modules/notification-owner/public.ts';
import { Idempotency } from '../src/modules/idempotency.ts';
import type { SharedResourceLimitInput } from '../src/modules/resource-limit-owner/public.ts';

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
const startsAt='2026-10-01T00:00:00.000Z',endsAt='2026-11-01T00:00:00.000Z';
const now=Date.parse('2026-10-21T00:00:00.000Z');
const input=(expectedRevision=0):SharedResourceLimitInput=>({expectedRevision,startsAt,endsAt,
    bytesPerSecond:1024,burstBytes:4096,byteLimit:10000});
const code=(expected:string)=>(error:unknown)=>(error as {code?:string})?.code===expected;

test('P3 MySQL usage projection commits with its receipt and refuses foreign, rollback and revoked samples',
    {skip:!databaseURL},async()=>withDatabase(async db=>{
    const fingerprint='a'.repeat(64);
    await db.transaction(async tx=>{
        await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',['admin','1'.repeat(64)]);
        await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',['scope','admin']);
        await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts,resource_source,resource_revision) VALUES(?,?,?,?,?,?,?)',
            ['node','scope','2'.repeat(64),now+60000,'{}','admin-shared',1]);
        const report={nodeId:'node',bootId:'boot',sessionEpoch:1,reportSequence:1,acceptedSnapshotGeneration:2};
        await write(tx,'INSERT INTO runtime_nodes(node_id,session_epoch,boot_id,last_report_sequence,last_report,received_at) VALUES(?,?,?,?,?,?)',
            ['node',1,'boot',1,JSON.stringify(report),now]);
        await write(tx,'INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until) VALUES(?,?,?,?)',[fingerprint,'node',now-1000,now+60000]);
        await write(tx,'INSERT INTO shared_resource_limit_heads(node_id,actor_id,revision) VALUES(?,?,0)',['node','admin']);
        await write(tx,'INSERT INTO shared_resource_limit_buckets(bucket_id,scope_id,node_id,actor_id,revision,starts_at,ends_at,burst_bytes,byte_limit) VALUES(?,?,?,?,?,?,?,?,?)',
            ['bucket','scope','node','admin',1,Date.parse(startsAt),Date.parse(endsAt),64,100]);
        await write(tx,'UPDATE shared_resource_limit_heads SET bucket_id=?,revision=1 WHERE node_id=? AND actor_id=?',['bucket','node','admin']);
    });
    const make=(store=new MySqlResourceUsageStore())=>new ResourceUsage({db,store,nodes:new MySqlNodeAuthorityStore(),now:()=>now,
        freshnessMs:30000,codec:{digest:nativeValueDigest,parseTime:Date.parse,formatTime:at=>new Date(at).toISOString()}});
    const service=make(),input={version:1,nodeId:'node',bootId:'boot',sessionEpoch:1,reportSequence:1,snapshotGeneration:2,
        buckets:[{bucketId:'bucket',scopeId:'scope',actorId:'admin',revision:1,startsAt,endsAt,consumedBytes:'30'}]};
    assert.equal((await service.handle('node',fingerprint,1,input)).status,'accepted');
    assert.equal((await service.handle('node',fingerprint,1,input)).status,'duplicate');
    const before=await rows(db.pool,'SELECT * FROM resource_usage_samples');
    await db.transaction(async tx=>{
        await write(tx,"UPDATE runtime_nodes SET last_report_sequence=2,last_report=JSON_SET(last_report,'$.reportSequence',2) WHERE node_id='node'");
    });
    class FailingUsageReceipt extends MySqlResourceUsageStore {
        override async receipt(tx:Transaction,node:string,value:Parameters<MySqlResourceUsageStore['receipt']>[2]) {
            await super.receipt(tx,node,value);throw Error('injected usage receipt failure');
        }
    }
    await assert.rejects(make(new FailingUsageReceipt()).handle('node',fingerprint,1,{...input,reportSequence:2,
        buckets:[{...input.buckets[0]!,consumedBytes:'40'}]}),/injected usage receipt failure/);
    assert.deepEqual(await rows(db.pool,'SELECT * FROM resource_usage_samples'),before);
    await assert.rejects(service.handle('node',fingerprint,1,{...input,reportSequence:2,
        buckets:[{...input.buckets[0]!,consumedBytes:'1'}]}),code('INTEGRITY_FAILURE'));
    await db.transaction(async tx=>{await write(tx,'UPDATE node_credentials SET revoked=TRUE WHERE fingerprint=?',[fingerprint]);});
    await assert.rejects(service.handle('node',fingerprint,1,{...input,reportSequence:2}),code('AUTHORIZATION_DENIED'));
    assert.deepEqual(await rows(db.pool,'SELECT * FROM resource_usage_samples'),before);
}));

async function withDatabase(action:(db:MySqlUnitOfWork)=>Promise<void>){
    const admin=await createConnection(databaseURL!),database='tunex_payload_'+randomUUID().replaceAll('-','');
    const url=new URL(databaseURL!);url.pathname='/'+database;
    const db=new MySqlUnitOfWork(url.toString());let created=false;
    try{await admin.query(`CREATE DATABASE \`${database}\``);created=true;await db.migrate();await action(db);}
    finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${database}\``);}finally{await admin.end();}}
}
const policyTables=['shared_resource_limit_heads','shared_resource_limit_buckets','shared_resource_limit_requests','shared_resource_limit_audit'];
async function policyRows(db:MySqlUnitOfWork){
    return Object.fromEntries(await Promise.all(policyTables.map(async table=>[table,
        (await rows(db.pool,`SELECT * FROM \`${table}\``)).map(row=>JSON.stringify(row)).sort()])));
}

test('FR0032 real MySQL original identity locks CAS replay history and post-audit rollback preserve policy ownership',
    {skip:!databaseURL},async()=>withDatabase(async db=>{
    await db.transaction(async tx=>{
        for(const [index,actor] of ['admin','alice','bob'].entries())
            await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',[actor,String(index+1).repeat(64)]);
        await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',['scope','admin']);
        for(const actor of ['admin','alice','bob'])
            await write(tx,'INSERT INTO scope_members(scope_id,actor_id,can_manage) VALUES(?,?,TRUE)',['scope',actor]);
        for(const [index,node] of ['shared','shared-two','private'].entries()){
            await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts,resource_source,owner_actor_id,resource_revision) VALUES(?,?,?,?,?,?,?,?)',
                [node,'scope',String(index+4).repeat(64),now+3600000,'{}',node==='private'?'private':'admin-shared',node==='private'?'alice':null,1]);
            await write(tx,'INSERT INTO runtime_nodes(node_id) VALUES(?)',[node]);
            for(const actor of ['alice','bob'])await write(tx,'INSERT INTO node_grants(node_id,actor_id) VALUES(?,?)',[node,actor]);
        }
        await write(tx,'INSERT INTO forwards(id,scope_id,revision,spec,authorization_actor,owner_actor_id) VALUES(?,?,?,?,?,?)',
            ['forward','scope',1,'{}','bob','alice']);
    });
    const resources=new MySqlRuntimeResourceStore(),nodes=new MySqlNodeAuthorityStore(),store=new MySqlSharedResourceLimitStore();
    const options={db,identity:new Identity(db),nodes,owners:resources,store,now:()=>now,
        runtime:{async initializeNode(tx:Transaction,node:string){await resources.initializeNode(tx,node);},async lockNode(tx:Transaction,node:string){assert.ok(await resources.lockNode(tx,node));},async maximumAuthorization(tx:Transaction,node:string){return resources.maximumAuthorization(tx,node);}},
        codec:{digest:nativeValueDigest,formatTime:(at:number)=>new Date(at).toISOString(),parseTime:Date.parse,newID:randomUUID}};
    const service=new SharedResourceLimits(options),empty=await policyRows(db);
    await assert.rejects(service.set('alice','scope','shared','alice','no-governance',input()),code('AUTHORIZATION_DENIED'));
    await assert.rejects(service.set('admin','scope','private','alice','private-denied',input()),code('AUTHORIZATION_DENIED'));
    assert.deepEqual(await policyRows(db),empty);

    const first=await Promise.all([service.set('admin','scope','shared','alice','same-request',input()),
        service.set('admin','scope','shared','alice','same-request',input())]);
    assert.deepEqual(first[0],first[1]);assert.equal(first[0]!.revision,1);
    assert.equal((await rows(db.pool,'SELECT * FROM shared_resource_limit_audit')).length,1);
    await assert.rejects(service.set('admin','scope','shared-two','alice','same-request',input()),code('IDEMPOTENCY_CONFLICT'));
    assert.equal((await rows(db.pool,"SELECT * FROM shared_resource_limit_heads WHERE node_id='shared-two'")).length,0);
    assert.equal((await service.get('alice','scope','shared','alice')).policy?.bucketId,first[0]!.policy!.bucketId);
    await assert.rejects(service.get('bob','scope','shared','alice'),code('AUTHORIZATION_DENIED'));
    assert.equal((await service.get('bob','scope','shared','bob')).policy,null);

    const contenders=await Promise.allSettled([
        service.set('admin','scope','shared','alice','cas-a',{...input(1),bytesPerSecond:2000}),
        service.set('admin','scope','shared','alice','cas-b',{...input(1),bytesPerSecond:3000}),
    ]);
    assert.equal(contenders.filter(result=>result.status==='fulfilled').length,1);
    const rejected=contenders.find(result=>result.status==='rejected');
    assert.equal(rejected?.status==='rejected'&&rejected.reason.code,'REVISION_CONFLICT');
    const current=await service.get('admin','scope','shared','alice');assert.equal(current.revision,2);
    assert.equal(current.policy!.bucketId,first[0]!.policy!.bucketId);

    const beforeFailure=await policyRows(db),failure=new Error('receipt persistence failed');
    class FailedReceiptStore extends MySqlSharedResourceLimitStore {
        override async receipt():Promise<void>{throw failure;}
    }
    const failing=new SharedResourceLimits({...options,store:new FailedReceiptStore()});
    await assert.rejects(failing.set('admin','scope','shared','alice','receipt-fault',input(2)),error=>error===failure);
    assert.deepEqual(await policyRows(db),beforeFailure,'head bucket audit and receipt roll back together');

    await service.set('admin','scope','shared','alice','future-period',{...input(2),startsAt:endsAt,endsAt:'2026-12-01T00:00:00.000Z'});
    const assignment:RuntimeAssignmentValue={assignmentId:'assignment',forwardId:'forward',forwardRevision:1,
        deploymentGeneration:1,bindingFence:1,role:'relay-egress',protocol:'tcp',phase:'active',
        resource:{address:'127.0.0.1',port:24001,protocol:'tcp'},driver:{id:'native',configDigest:'digest'},drainTimeoutSeconds:1};
    const published=await db.transaction(async tx=>{
        await options.runtime.lockNode(tx,'shared');
        return service.limits(tx,'shared',['shared-resource-limits.v1'],[assignment],now);
    });
    assert.equal(published.resourceLimits!.buckets[0]!.actorId,'alice','execution authorizer bob cannot change product debit owner');
    assert.equal(published.resourceLimits!.buckets[0]!.revision,2,'future head preserves the currently active historical period');
    assert.equal(published.resourceLimits!.buckets[0]!.bucketId,current.policy!.bucketId);
    assert.deepEqual(published.excludedAssignmentIds,[]);
    const stationNow=Date.parse(endsAt)-30000;
    const alertObservation=await db.transaction(tx=>service.forAlertIn(tx,'admin','scope','shared','alice',stationNow));
    assert.equal(alertObservation?.policy.bucketId,current.policy!.bucketId,'future policy does not replace the started period');
    const stationFacts=new StationResourceFacts<Transaction>({async read(){return {kind:'node',id:'shared',revoked:false,
        credentialUntil:stationNow+60000,report:null,invalidReport:false};}},service,()=>stationNow);
    const stationStore=new MySqlStationAlertStore(),endpoints=new MySqlNotificationEndpoints();
    let failOutbox=true,handoffs=0,handoffTx:Transaction|undefined;
    const outboxFailure=new Error('injected resource alert outbox post-insert failure'),insertOutcomes:string[]=[];
    class FailingOutbox extends MySqlNotificationDeliveries {
        override async insert(tx:Transaction,scope:string,value:NotificationDelivery,at:number) {
            assert.equal(tx,handoffTx,'the original Station transaction reaches the native outbox insert');
            const result=await super.insert(tx,scope,value,at);insertOutcomes.push(result);
            assert.equal((await rows(tx,'SELECT id FROM notification_deliveries')).length,1);
            if(failOutbox)throw outboxFailure;
            return result;
        }
    }
    const outbox=new FailingOutbox(),notificationTables=['notification_endpoint_scopes','notification_endpoints',
        'notification_endpoint_events','notification_delivery_scopes','notification_deliveries','notification_delivery_attempts','notification_delivery_rates'];
    const notificationRows=async()=>Object.fromEntries(await Promise.all(notificationTables.map(async table=>[table,
        (await rows(db.pool,`SELECT * FROM \`${table}\``)).map(row=>JSON.stringify(row)).sort()])));
    let secretUses=0,sends=0;
    const noSecrets:NotificationSecrets={async acquire(){secretUses++;assert.fail('revoked deliveries must not acquire secrets');},
        async read(){secretUses++;assert.fail('enqueue does not read secrets');},async stage(){secretUses++;assert.fail('enqueue does not stage secrets');},async close(){}};
    const noSender:NotificationSender={async send(){sends++;assert.fail('revoked deliveries must not send');},async idle(){},async close(){}};
    const deliveries=new NotificationDeliveries({db,auth:options.identity,store:outbox,endpoints,policies:stationStore,
        enabled:true,secrets:noSecrets,sender:noSender,authorityBinding:async()=>'sha256:'+'a'.repeat(64),clock:()=>stationNow,clockSkewMs:0});
    const endpointConfig={schemaVersion:1,enabled:true,policyIds:['quota-policy'],kinds:['firing'],minimumIntervalSeconds:10};
    await db.transaction(async tx=>{
        await endpoints.lockScope(tx,'scope');
        await endpoints.put(tx,'scope',parseNotificationEndpoint({endpointId:'quota-endpoint',revision:1,credentialRevision:1,
            config:endpointConfig,configDigest:nativeValueDigest(endpointConfig),managedBy:'admin',createdAt:stationNow,updatedAt:stationNow,
            suspended:'none',authorityDigest:'sha256:'+'a'.repeat(64),credentialRef:'b'.repeat(64)}));
    });
    const handoff:StationEventHandoff<Transaction>={
        async enqueueIn(tx,scope,policy,event,at){
            assert.equal(scope,'scope');assert.equal(policy.config.rule,'shared-period-ending');
            assert.equal(event.config.rule,'shared-period-ending');
            assert.equal(Number((await rows<{count:number}>(tx,'SELECT COUNT(*) AS count FROM station_alert_events'))[0]!.count),1);
            handoffTx=tx;
            try{await deliveries.enqueueIn(tx,scope,policy,event,at);handoffs++;}finally{handoffTx=undefined;}
        }};
    const alerts=new StationAlerts(db,options.identity,new Idempotency(),stationStore,stationFacts,true,()=>stationNow,0,handoff);
    await alerts.publish('admin','scope','quota-policy','quota-alert-create',0,{schemaVersion:2,rule:'shared-period-ending',
        target:{kind:'node',id:'shared'},enabled:true,subjectActorId:'alice',thresholdPercent:null,thresholdSeconds:60});
    const notificationBefore=await notificationRows(),policyBefore=(await rows<Record<string,unknown>>(db.pool,'SELECT * FROM station_alert_policies'))[0]!;
    await assert.rejects(alerts.tick(),error=>error===outboxFailure);
    assert.equal((await rows(db.pool,'SELECT * FROM station_alert_events')).length,0,'event insert rolls back with failed handoff');
    assert.deepEqual(await notificationRows(),notificationBefore,'the actual outbox write and all seven notification tables roll back');
    const deferred=(await rows<Record<string,unknown>>(db.pool,'SELECT * FROM station_alert_policies'))[0]!;
    assert.equal(deferred.next_evaluate_at,stationNow+300000);
    assert.deepEqual({...deferred,next_evaluate_at:policyBefore.next_evaluate_at},policyBefore,'only the original separate failure deferral persists');
    const stored=(await rows<{state:unknown}>(db.pool,"SELECT state FROM station_alert_policies WHERE policy_id='quota-policy'"))[0]!.state;
    assert.equal((typeof stored==='string'?JSON.parse(stored):stored).condition,'unknown');
    failOutbox=false;
    await db.transaction(tx=>write(tx,"UPDATE station_alert_policies SET next_evaluate_at=? WHERE policy_id='quota-policy'",[stationNow]));
    await alerts.tick();await alerts.tick();
    assert.equal(handoffs,1);assert.equal((await rows(db.pool,'SELECT * FROM station_alert_events')).length,1);
    const queued=(await rows<{id:string;event_id:string}>(db.pool,'SELECT id,event_id FROM notification_deliveries'))[0]!;
    await db.transaction(async tx=>{
        await options.identity.owner(tx,'admin','scope');await stationStore.lockScope(tx,'scope');
        const policy=await stationStore.policy(tx,'scope','quota-policy',true),event=await stationStore.event(tx,'scope',queued.event_id,true);
        await handoff.enqueueIn(tx,'scope',policy!,event!,stationNow);
        const delivery=await outbox.get(tx,'scope',queued.id);
        assert.equal(delivery!.payload.event.rule,'shared-period-ending');assert.equal(delivery!.payload.event.reason,'period-ending');
        assert.equal(delivery!.status,'queued');assert.equal(delivery!.eventId,event!.id);
    });
    assert.deepEqual(insertOutcomes,['inserted','inserted','duplicate']);
    assert.equal((await rows(db.pool,'SELECT id FROM notification_deliveries')).length,1);
    await db.transaction(tx=>write(tx,"UPDATE scope_members SET active=FALSE WHERE scope_id='scope' AND actor_id='admin'"));
    await deliveries.tick();
    const revoked=await db.transaction(tx=>outbox.get(tx,'scope',queued.id));
    assert.equal(revoked!.status,'cancelled');assert.equal(revoked!.lastCode,'AUTHORIZATION_REVOKED');
    assert.equal(revoked!.attemptCount,0);assert.equal((await rows(db.pool,'SELECT id FROM notification_delivery_attempts')).length,0);
    assert.deepEqual([secretUses,sends],[0,0]);
    await db.transaction(tx=>write(tx,"UPDATE scope_members SET active=TRUE WHERE scope_id='scope' AND actor_id='admin'"));
    const after=await policyRows(db);
    await assert.rejects(service.set('admin','scope','shared','alice','overlap',input(3)),code('REVISION_CONFLICT'));
    assert.deepEqual(await policyRows(db),after);
    await db.transaction(tx=>write(tx,"UPDATE scope_members SET active=FALSE WHERE scope_id='scope' AND actor_id='alice'"));
    await assert.rejects(service.set('admin','scope','shared','alice','inactive',input(3)),code('NOT_FOUND'));
    assert.deepEqual(await policyRows(db),after);
}));
