import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'mysql2/promise';
import { TelemetryRecovery } from '../src/modules/telemetry-owner/public.ts';
import { StationAlertRecovery, StationAlerts, emptyStationAlertState, parseStationAlertConfig, parseStationAlertPolicy } from '../src/modules/station-alert-owner/public.ts';
import type { StationAlertState } from '../src/modules/station-alert-owner/public.ts';
import { NotificationRecovery, NotificationDeliveries } from '../src/modules/notification-owner/public.ts';
import { nativeJsonEncode, nativeValueDigest as digest } from '../src/compatibility/public.ts';
import { MySqlTelemetryRecoveryStore } from '../src/infrastructure/mysql-telemetry-recovery-store.ts';
import { MySqlStationAlertRecoveryStore } from '../src/infrastructure/mysql-station-alert-recovery-store.ts';
import { MySqlNotificationRecoveryStore } from '../src/infrastructure/mysql-notification-recovery-store.ts';
import { MySqlStationAlertStore } from '../src/infrastructure/mysql-station-alerts.ts';
import { MySqlNotificationEndpoints } from '../src/infrastructure/mysql-notification-endpoints.ts';
import { MySqlNotificationDeliveries } from '../src/infrastructure/mysql-notification-deliveries.ts';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

type Statement=readonly [string,readonly unknown[]];
const telemetrySQL:Statement[]=[
    ['DELETE FROM telemetry_heads',[]],
    ['UPDATE telemetry_points SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE',[]],
    ['DELETE FROM telemetry_rollup_cursors',[]],
    ['UPDATE telemetry_rollup_buckets SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE',[]],
    ['DELETE FROM probe_telemetry_heads',[]],
    ['UPDATE probe_telemetry_points SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE',[]],
    ['DELETE FROM host_telemetry_heads',[]],
    ['UPDATE host_telemetry_points SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE',[]],
    ['DELETE FROM forward_telemetry_heads',[]],
    ['UPDATE forward_telemetry_points SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE',[]],
];
const stationState='{"condition":"unknown","episode":0,"instanceKey":null,"armed":false,"openedAt":null,"opening":null,"lastFiring":null,"last":null,"evaluatedAt":null}';
const stationSQL=(encoded:string):Statement[]=>[
    ["UPDATE station_alert_policies SET suspended='recovery',next_evaluate_at=0,state=?",[encoded]],
    ['UPDATE station_alert_events SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE',[]],
];
const notificationSQL=(at:number):Statement[]=>[
    ["UPDATE notification_endpoints SET suspended='recovery'",[]],
    ['UPDATE notification_deliveries SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE',[]],
    ["UPDATE notification_deliveries SET last_status_code=IF(status='claimed',NULL,last_status_code),last_outcome=IF(status='claimed','unknown',last_outcome),status='cancelled',revision=revision+1,last_code='RECOVERY_SUSPENDED',next_attempt_at=0,claimed_at=NULL,claim_until=NULL,updated_at=GREATEST(updated_at,?) WHERE status IN ('queued','claimed','retry-wait')",[at]],
    ["UPDATE notification_delivery_attempts SET finished_at=GREATEST(started_at,?),outcome='unknown',code='RECOVERY_SUSPENDED',status_code=NULL WHERE outcome='pending'",[at]],
];

function executor(failAt=-1) {
    const calls:Statement[]=[],failure=new Error(`statement:${failAt}`);
    const value={async execute(this:unknown,sql:string,args:unknown[]=[]){assert.equal(this,tx);calls.push([sql,[...args]]);
        if(calls.length-1===failAt)throw failure;return [{affectedRows:0},[]];}};
    const tx=new Proxy(value,{get(target,key,receiver){if(key==='execute')return Reflect.get(target,key,receiver);
        assert.fail(`recovery adapter used an unsupplied effect: ${String(key)}`);}}) as unknown as Transaction;
    return {tx,calls,failure};
}

test('161 Telemetry recovery executes exactly ten original writes in the supplied transaction and forwards the original promise',async()=>{
    const f=executor(),store=new MySqlTelemetryRecoveryStore(),owner=new TelemetryRecovery(store);
    await owner.quarantineRecovery(f.tx);assert.deepEqual(f.calls,telemetrySQL);
    for(let failAt=0;failAt<telemetrySQL.length;failAt++){
        const failed=executor(failAt);await assert.rejects(owner.quarantineRecovery(failed.tx),error=>error===failed.failure);
        assert.deepEqual(failed.calls,telemetrySQL.slice(0,failAt+1),'first error stops all later writes without retry');
    }
    const tx={},promise=Promise.resolve(),port={quarantineRecovery(actual:object){assert.equal(this,port);assert.equal(actual,tx);return promise;}};
    assert.equal(new TelemetryRecovery(port).quarantineRecovery(tx),promise);
});

test('161 Station recovery passes a fresh exact nine-field mutable state to its explicit encoder before the native two writes',async()=>{
    const f=executor(),states:StationAlertState[]=[],store=new MySqlStationAlertRecoveryStore();let owner:StationAlertRecovery<Transaction>;
    const encoder=function(this:unknown,state:StationAlertState){assert.equal(this,owner);states.push(state);
        assert.deepEqual(Object.keys(state),['condition','episode','instanceKey','armed','openedAt','opening','lastFiring','last','evaluatedAt']);
        assert.equal(Object.isFrozen(state),false);assert.equal(Object.isExtensible(state),true);
        for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(state)))assert.deepEqual(
            {writable:descriptor.writable,enumerable:descriptor.enumerable,configurable:descriptor.configurable},
            {writable:true,enumerable:true,configurable:true});
        assert.equal(nativeJsonEncode(state),stationState);assert.deepEqual(f.calls,[],'encoding happens before either SQL write');
        return nativeJsonEncode(state);};
    owner=new StationAlertRecovery(store,encoder);await owner.quarantineRecovery(f.tx);assert.deepEqual(f.calls,stationSQL(stationState));
    f.calls.length=0;states[0]!.episode=19;await owner.quarantineRecovery(f.tx);assert.notEqual(states[0],states[1]);assert.equal(states[1]!.episode,0);
    const tx={},sentinel='opaque encoded state',events:string[]=[],port={async quarantineRecovery(actual:object,value:string){assert.equal(this,port);assert.equal(actual,tx);assert.equal(value,sentinel);events.push('store');}};
    await new StationAlertRecovery(port,state=>{events.push('encode');state.episode=1;return sentinel;}).quarantineRecovery(tx);
    assert.deepEqual(events,['encode','store'],'custom encoding remains opaque to storage');
    const failure=new Error('encoder');await assert.rejects(new StationAlertRecovery(port,()=>{throw failure;}).quarantineRecovery(tx),error=>error===failure);
    assert.deepEqual(events,['encode','store']);
    for(let failAt=0;failAt<2;failAt++){const failed=executor(failAt);
        await assert.rejects(new StationAlertRecovery(store,nativeJsonEncode).quarantineRecovery(failed.tx),error=>error===failed.failure);
        assert.deepEqual(failed.calls,stationSQL(stationState).slice(0,failAt+1));}
});

test('161 Notification recovery awaits endpoint suspension then samples once before history cancel and pending-attempt writes',async()=>{
    const f=executor(),events:string[]=[];let release!:()=>void,owner:NotificationRecovery<Transaction>;
    const suspended=new Promise<void>(resolve=>{release=resolve;}),native=new MySqlNotificationRecoveryStore();
    const store={async suspendEndpoints(actual:Transaction){assert.equal(this,store);assert.equal(actual,f.tx);events.push('suspend');await native.suspendEndpoints(actual);await suspended;events.push('suspended');},
        async quarantineDeliveries(actual:Transaction,at:number){assert.equal(this,store);assert.equal(actual,f.tx);assert.equal(at,0);events.push('deliveries');return native.quarantineDeliveries(actual,at);}};
    owner=new NotificationRecovery(store,function(this:unknown){assert.equal(this,owner);events.push('now');return 0;});
    const pending=owner.quarantineRecovery(f.tx);await Promise.resolve();await Promise.resolve();
    assert.deepEqual(events,['suspend']);assert.deepEqual(f.calls,notificationSQL(0).slice(0,1));release();await pending;
    assert.deepEqual(events,['suspend','suspended','now','deliveries']);assert.deepEqual(f.calls,notificationSQL(0));
    for(let failAt=0;failAt<4;failAt++){
        const failed=executor(failAt);let samples=0;
        await assert.rejects(new NotificationRecovery(native,()=>{samples++;return 123.5;}).quarantineRecovery(failed.tx),error=>error===failed.failure);
        assert.deepEqual(failed.calls,notificationSQL(123.5).slice(0,failAt+1));assert.equal(samples,failAt===0?0:1);
    }
    const clockFailure=new Error('clock'),failed=executor();
    await assert.rejects(new NotificationRecovery(native,()=>{throw clockFailure;}).quarantineRecovery(failed.tx),error=>error===clockFailure);
    assert.deepEqual(failed.calls,notificationSQL(0).slice(0,1));
});

test('161 explicit recovery owners and raw SQL adapters construct without hidden clock database or provider defaults',async t=>{
    t.mock.method(Date,'now',()=>assert.fail('explicit recovery construction must not read a clock'));
    const noEffects=new Proxy({},{get(_target,key){assert.fail(`constructor inspected provider ${String(key)}`);}});
    new TelemetryRecovery(noEffects as never);new StationAlertRecovery(noEffects as never,()=>assert.fail('constructor encoded'));
    new NotificationRecovery(noEffects as never,()=>assert.fail('constructor sampled'));
    new MySqlTelemetryRecoveryStore();new MySqlStationAlertRecoveryStore();new MySqlNotificationRecoveryStore();
    const tx={};assert.throws(()=>new TelemetryRecovery(undefined as never).quarantineRecovery(tx),TypeError);
    await assert.rejects(new StationAlertRecovery({async quarantineRecovery(){assert.fail('missing encoder must not reach storage');}},undefined as never).quarantineRecovery(tx),TypeError);
});

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
async function withDatabase(action:(db:MySqlUnitOfWork)=>Promise<void>) {
    const admin=await createConnection(databaseURL!),database='tunex_recovery_observation_'+randomUUID().replaceAll('-','');
    const url=new URL(databaseURL!);url.pathname='/'+database;const db=new MySqlUnitOfWork(url.toString());let created=false;
    try{await admin.query(`CREATE DATABASE \`${database}\``);created=true;await db.migrate();
        await db.transaction(async tx=>{await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',['actor','a'.repeat(64)]);
            await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',['scope','actor']);
            await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts) VALUES(?,?,?,?,?)',['node','scope','b'.repeat(64),900000,'{}']);
            await write(tx,'INSERT INTO forwards(id,scope_id,revision,spec) VALUES(?,?,?,?)',['forward','scope',1,'{}']);});
        await action(db);
    }finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${database}\``);}finally{await admin.end();}}
}

async function insert(tx:Transaction,table:string,value:Record<string,unknown>) {
    const keys=Object.keys(value);await write(tx,`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`,Object.values(value));
}
async function table(db:MySqlUnitOfWork,name:string) {
    const values=await rows<Record<string,unknown>>(db.pool,`SELECT * FROM ${name}`);
    return values.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
async function snapshot(db:MySqlUnitOfWork,names:readonly string[]):Promise<Record<string,Record<string,unknown>[]>> {
    return Object.fromEntries(await Promise.all(names.map(async name=>[name,await table(db,name)])));
}

test('161 real MySQL telemetry quarantine retains all four raw families and rollup samples while only operational cursors reset and rollback restores all ten writes',{skip:!databaseURL},async()=>{
    await withDatabase(async db=>{
        const heads=['telemetry_heads','probe_telemetry_heads','host_telemetry_heads','forward_telemetry_heads','telemetry_rollup_cursors'];
        const retained=['telemetry_points','probe_telemetry_points','host_telemetry_points','forward_telemetry_points','telemetry_rollup_buckets'];
        await db.transaction(async tx=>{
            const base={node_id:'node',scope_id:'scope',session_epoch:2,boot_id:'original-boot',sample_epoch:'c'.repeat(32)};
            for(const name of heads.slice(0,4))await insert(tx,name,{...base,last_sequence:2,last_uptime_ms:700,dropped_samples:'18446744073709551615'});
            for(const family of ['telemetry_points','host_telemetry_points'])for(const sequence of [1,2])await insert(tx,family,
                {...base,sequence,captured_at:100,received_at:110,uptime_ms:700,body:'{"retained":"18446744073709551615"}',digest:'sha256:'+'d'.repeat(64),recovery_suspended:sequence===2});
            for(const family of ['forward_telemetry_points','probe_telemetry_points'])for(const sequence of [1,2])await insert(tx,family,
                {...base,forward_id:'forward',sequence,item_index:0,captured_at:100,received_at:110,sample_captured_at:90,uptime_ms:700,
                    identity_digest:'sha256:'+'e'.repeat(64),counter_epoch:'f'.repeat(32),body:'{"retained":"18446744073709551615"}',exporter:'{"original":true}',
                    digest:'sha256:'+'d'.repeat(64),mapping_source:family==='probe_telemetry_points'?'published-snapshot':'retired-published',published_until:500000,
                    ...(family==='probe_telemetry_points'?{probe_instance:'not-rechecked',instance_until:null}:{}),recovery_suspended:sequence===2});
            await insert(tx,'telemetry_rollup_scope_heads',{scope_id:'scope'});
            await insert(tx,'telemetry_rollup_heads',{node_id:'node',family:'process',scope_id:'scope',minute_evicted:'18446744073709551615',cursor_expired:7});
            await insert(tx,'telemetry_rollup_cursors',{node_id:'node',family:'process',scope_id:'scope',series_key:'sha256:'+'1'.repeat(64),last_received_at:110,body:'{}',digest:'sha256:'+'2'.repeat(64)});
            for(const bucket_start of [0,60000])await insert(tx,'telemetry_rollup_buckets',{node_id:'node',family:'process',scope_id:'scope',resolution:'minute',bucket_start,
                series_key:'sha256:'+'1'.repeat(64),forward_id:null,body:'{"retained":"18446744073709551615"}',digest:'sha256:'+'2'.repeat(64),recovery_suspended:bucket_start===60000});
        });
        const all=[...heads,...retained,'telemetry_rollup_heads','telemetry_rollup_scope_heads'],before=await snapshot(db,all),owner=new TelemetryRecovery(new MySqlTelemetryRecoveryStore()),failure=new Error('caller rollback');
        await assert.rejects(db.transaction(async tx=>{await owner.quarantineRecovery(tx);throw failure;}),error=>error===failure);
        assert.deepEqual(await snapshot(db,all),before);
        await db.transaction(tx=>owner.quarantineRecovery(tx));
        for(const name of heads)assert.deepEqual(await table(db,name),[]);
        for(const name of retained)assert.deepEqual(await table(db,name),before[name]!.map(row=>({...row,recovery_suspended:1})),name);
        for(const name of ['telemetry_rollup_heads','telemetry_rollup_scope_heads'])assert.deepEqual(await table(db,name),before[name]);
        const once=await snapshot(db,all);await db.transaction(tx=>owner.quarantineRecovery(tx));assert.deepEqual(await snapshot(db,all),once,'second quarantine does not replay ingestion or append samples');
    });
});

test('161 real MySQL Station recovery resets exactly policy suspension evaluation and nine-field state while retaining events audit and definition history',{skip:!databaseURL},async()=>{
    await withDatabase(async db=>{
        await db.transaction(async tx=>{
            await insert(tx,'station_alert_scopes',{scope_id:'scope',events_evicted:7,events_expired:8,audit_evicted:9});
            await insert(tx,'station_alert_policies',{scope_id:'scope',policy_id:'policy',revision:4,config_revision:2,config_digest:'sha256:'+'a'.repeat(64),
                config:'{"enabled":true,"original":"definition"}',enabled:true,managed_by:'actor',created_at:100,updated_at:200,silenced_until:700000,
                suspended:'none',next_evaluate_at:800000,state:JSON.stringify({...emptyStationAlertState(),condition:'clear',episode:3,armed:true})});
            for(const n of [1,2])await insert(tx,'station_alert_events',{id:'event-'+n,scope_id:'scope',policy_id:'policy',occurred_at:100+n,rule:'node-report-stale',
                target_id:'node',kind:'firing',episode:n,config_revision:2,body:'{"original":"event evidence"}',revision:3,acknowledged_at:150,recovery_suspended:n===2});
            await insert(tx,'station_alert_policy_events',{id:'audit',scope_id:'scope',policy_id:'policy',revision:4,config_revision:2,config_digest:'sha256:'+'a'.repeat(64),
                kind:'publish',actor_id:'actor',created_at:200,event_id:null});
        });
        const names=['station_alert_policies','station_alert_events','station_alert_policy_events','station_alert_scopes'],before=await snapshot(db,names),owner=new StationAlertRecovery(new MySqlStationAlertRecoveryStore(),nativeJsonEncode);
        await db.transaction(tx=>owner.quarantineRecovery(tx));
        assert.deepEqual(await table(db,'station_alert_policies'),before.station_alert_policies!.map(row=>({...row,suspended:'recovery',next_evaluate_at:0,state:JSON.parse(stationState)})));
        assert.deepEqual(await table(db,'station_alert_events'),before.station_alert_events!.map(row=>({...row,recovery_suspended:1})));
        for(const name of ['station_alert_policy_events','station_alert_scopes'])assert.deepEqual(await table(db,name),before[name]);
    });
});

test('161 real MySQL Notification recovery preserves terminal HTTP evidence opaque references and rate bounds while cancelling only nonterminal work without refund',{skip:!databaseURL},async()=>{
    await withDatabase(async db=>{
        const statuses=['queued','claimed','retry-wait','delivered','dead-letter','cancelled'] as const;
        await db.transaction(async tx=>{
            await insert(tx,'notification_endpoint_scopes',{scope_id:'scope',audit_evicted:9});
            await insert(tx,'notification_endpoints',{scope_id:'scope',endpoint_id:'endpoint',revision:3,credential_revision:2,config:'{"enabled":true,"original":"intent"}',
                config_digest:'sha256:'+'a'.repeat(64),enabled:true,managed_by:'actor',created_at:100,updated_at:200,suspended:'none',authority_digest:'sha256:'+'b'.repeat(64),credential_ref:'c'.repeat(64)});
            await insert(tx,'notification_endpoint_events',{id:'endpoint-audit',scope_id:'scope',endpoint_id:'endpoint',revision:3,kind:'publish',actor_id:'actor',created_at:200});
            await insert(tx,'notification_delivery_scopes',{scope_id:'scope',queue_rejected:1,routing_rejected:2,silence_suppressed:3,disabled_suppressed:4,rows_expired:5,rows_evicted:6,attempts_evicted:7});
            await insert(tx,'notification_delivery_rates',{scope_id:'scope',endpoint_id:'endpoint',next_allowed_at:9007199254740991});
            for(const [index,status] of statuses.entries()){
                const claimed=status==='claimed',terminal=['delivered','dead-letter','cancelled'].includes(status),started=claimed?6000:500;
                await insert(tx,'notification_deliveries',{id:status,scope_id:'scope',event_id:'event-'+status,policy_id:'policy',endpoint_id:'endpoint',policy_config_revision:1,
                    endpoint_revision:3,credential_revision:2,policy_managed_by:'actor',endpoint_managed_by:'actor',authority_digest:'sha256:'+'b'.repeat(64),
                    payload:'{"original":"payload"}',payload_digest:'sha256:'+'d'.repeat(64),revision:10+index,status,attempt_count:1,fence:1,
                    claimed_at:claimed?started:null,claim_until:claimed?started+30000:null,created_at:100,updated_at:index%2?9000:1000,
                    next_attempt_at:terminal?0:claimed?started+30000:1000,expires_at:3600100,last_code:'ORIGINAL_CODE',
                    last_outcome:status==='delivered'?'delivered':'rejected',last_status_code:status==='delivered'?204:503,recovery_suspended:status==='dead-letter'});
                await insert(tx,'notification_delivery_attempts',{id:'attempt-'+status,scope_id:'scope',delivery_id:status,ordinal:1,fence:1,started_at:started,
                    finished_at:claimed?null:7000,outcome:claimed?'pending':status==='delivered'?'delivered':'rejected',code:claimed?null:'ORIGINAL_CODE',status_code:claimed?null:503});
            }
        });
        const names=['notification_endpoints','notification_deliveries','notification_delivery_attempts','notification_delivery_rates',
            'notification_delivery_scopes','notification_endpoint_scopes','notification_endpoint_events'],before=await snapshot(db,names),at=5000;
        const owner=new NotificationRecovery(new MySqlNotificationRecoveryStore(),()=>at),failure=new Error('rollback all four writes');
        await assert.rejects(db.transaction(async tx=>{await owner.quarantineRecovery(tx);throw failure;}),error=>error===failure);assert.deepEqual(await snapshot(db,names),before);
        await db.transaction(tx=>owner.quarantineRecovery(tx));
        assert.deepEqual(await table(db,'notification_endpoints'),before.notification_endpoints!.map(row=>({...row,suspended:'recovery'})));
        assert.deepEqual(await table(db,'notification_deliveries'),before.notification_deliveries!.map(row=>({
            ...row,recovery_suspended:1,...(['queued','claimed','retry-wait'].includes(String(row.status))?{
                last_status_code:row.status==='claimed'?null:row.last_status_code,last_outcome:row.status==='claimed'?'unknown':row.last_outcome,
                status:'cancelled',revision:Number(row.revision)+1,last_code:'RECOVERY_SUSPENDED',next_attempt_at:0,claimed_at:null,claim_until:null,updated_at:Math.max(Number(row.updated_at),at)}:{})
        })),'claimed status is read before assignment to cancelled; terminal evidence stays byte-for-byte');
        assert.deepEqual(await table(db,'notification_delivery_attempts'),before.notification_delivery_attempts!.map(row=>row.outcome==='pending'?{
            ...row,finished_at:Math.max(Number(row.started_at),at),outcome:'unknown',code:'RECOVERY_SUSPENDED',status_code:null}:row));
        for(const name of names.slice(3))assert.deepEqual(await table(db,name),before[name],'no rate refund audit rewrite vault reference or loss reset');
        const once=await snapshot(db,names);await db.transaction(tx=>owner.quarantineRecovery(tx));assert.deepEqual(await snapshot(db,names),once,'recovery does not catch up requeue refund or append attempts');
    });
});

test('31/161 real native Station event SQL precedes original Notification outbox handoff on one transaction without secret acquisition or sender effects',{skip:!databaseURL},async()=>{
    await withDatabase(async db=>{
        const now=1800000000000,station=new MySqlStationAlertStore(),endpoints=new MySqlNotificationEndpoints(),outbox=new MySqlNotificationDeliveries();
        const config=parseStationAlertConfig({schemaVersion:1,rule:'node-credential-expiring',target:{kind:'node',id:'node'},enabled:true,thresholdSeconds:60});
        const policy=parseStationAlertPolicy({policyId:'policy',revision:1,configRevision:1,config,configDigest:digest(config),managedBy:'actor',
            createdAt:now-1000,updatedAt:now-1000,silencedUntil:null,suspended:'none',nextEvaluateAt:now,state:{...emptyStationAlertState(),condition:'clear',armed:true}});
        const routeConfig={schemaVersion:1 as const,enabled:true,policyIds:['policy'],kinds:['firing' as const],minimumIntervalSeconds:10};
        await db.transaction(async tx=>{
            await station.lockScope(tx,'scope');await station.putPolicy(tx,'scope',policy);await endpoints.lockScope(tx,'scope');
            await endpoints.put(tx,'scope',{endpointId:'endpoint',revision:1,credentialRevision:1,config:routeConfig,configDigest:digest(routeConfig),managedBy:'actor',
                createdAt:now-1000,updatedAt:now-1000,suspended:'none',authorityDigest:'sha256:'+'e'.repeat(64),credentialRef:'f'.repeat(64)});
        });
        const statements:string[]=[],seen:Transaction[]=[],boundary={async transaction<T>(action:(tx:Transaction)=>Promise<T>){
            return db.transaction(async tx=>{let supplied:Transaction;supplied=new Proxy(tx,{get(target,key,receiver){if(key==='execute')return async function(this:unknown,sql:string,args:unknown[]=[]){
                assert.equal(this,supplied);statements.push(sql);return Reflect.apply(target.execute,target,[sql,args]);};return Reflect.get(target,key,receiver);}});
                seen.push(supplied);return action(supplied);});}};
        const auth={async scope(tx:Transaction,actor:string,scope:string,manage?:boolean){assert.equal(tx,seen[0]);assert.deepEqual([actor,scope,manage],['actor','scope',true]);}};
        const handoff=new NotificationDeliveries({db:boundary,auth,store:outbox,endpoints,policies:station,enabled:true,
            secrets:new Proxy({},{get(){assert.fail('enqueue must not acquire vault material');}}) as never,
            sender:{async send(){assert.fail('enqueue must not send');},async idle(){assert.fail('enqueue must not await sender');},async close(){assert.fail('enqueue must not close sender');}},
            authorityBinding:async()=>assert.fail('enqueue must not acquire new authority'),clock:()=>now});
        const service=new StationAlerts(boundary,auth,{async claim(){assert.fail('worker must not claim a command');},async respond(){assert.fail('worker must not store command replay');}},station,
            {async read(tx:Transaction,scope:string){assert.equal(tx,seen[0]);assert.equal(scope,'scope');return {kind:'node' as const,id:'node',revoked:false,credentialUntil:now+1000,report:null,invalidReport:false};}},
            true,()=>now,1000,handoff);
        await service.tick();assert.equal(seen.length,1,'native handoff does not open its own transaction');
        const eventIndex=statements.findIndex(sql=>sql.startsWith('INSERT INTO station_alert_events(')),outboxIndex=statements.findIndex(sql=>sql.startsWith('INSERT INTO notification_deliveries('));
        assert.ok(eventIndex>=0);assert.ok(outboxIndex>eventIndex,'durable Station event is inserted before delivery');
        const persisted=await table(db,'station_alert_events'),delivery=await table(db,'notification_deliveries');
        assert.equal(persisted.length,1);assert.equal(delivery.length,1);assert.equal(delivery[0]!.event_id,persisted[0]!.id);
        assert.equal(delivery[0]!.status,'queued');assert.equal(delivery[0]!.attempt_count,0);assert.equal(delivery[0]!.fence,0);
        assert.equal(delivery[0]!.created_at,now);assert.equal(delivery[0]!.next_attempt_at,now);
        assert.deepEqual(await table(db,'notification_delivery_attempts'),[]);assert.deepEqual(await table(db,'notification_delivery_rates'),[]);
    });
});
