import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { MySqlUnitOfWork, rows, write } from '../../apps/control/src/infrastructure/mysql.ts';
import type { Transaction } from '../../apps/control/src/infrastructure/mysql.ts';
import { MySqlStationAlertStore, MySqlStationAlertFacts } from '../../apps/control/src/infrastructure/mysql-station-alerts.ts';
import { MySqlNotificationEndpoints } from '../../apps/control/src/infrastructure/mysql-notification-endpoints.ts';
import { MySqlNotificationDeliveries } from '../../apps/control/src/infrastructure/mysql-notification-deliveries.ts';
import { StationAlerts, StationPathFacts } from '../../apps/control/src/modules/station-alert-owner/public.ts';
import type { StationEventHandoff } from '../../apps/control/src/modules/station-alert-owner/public.ts';
import { NotificationDeliveries, parseNotificationEndpoint } from '../../apps/control/src/modules/notification-owner/public.ts';
import type { NotificationDelivery, NotificationSecrets, NotificationSender } from '../../apps/control/src/modules/notification-owner/public.ts';
import type { ProbePathObservationReader } from '../../apps/control/src/modules/probe-history-owner/public.ts';
import type { ScopeAuthorization, ScopeOwnerAuthorization } from '../../apps/control/src/framework/public.ts';
import { Idempotency } from '../../apps/control/src/modules/idempotency.ts';
import { nativeValueDigest } from '../../apps/control/src/compatibility/public.ts';

interface Options {
    db:MySqlUnitOfWork;auth:ScopeAuthorization<Transaction>&ScopeOwnerAuthorization<Transaction>;samples:ProbePathObservationReader<Transaction>;
    actor:string;scope:string;forward:string;directory:string;
}

export async function verifyPathAlertOutbox(options:Options):Promise<string[]> {
    if(process.platform!=='linux'||process.env.GITHUB_ACTIONS!=='true')throw Error('Product P path alert acceptance is Actions-only');
    const {db,auth,samples,actor,scope,forward,directory}=options,checks:string[]=[];
    const policyId='p-path-sample',endpointId='p-path-sample-endpoint';
    let now=Date.now(),conclusion='failed',failInsert=true,handoffTx:Transaction|undefined,secretUses=0,sends=0;
    let observed:unknown=null;
    const failure=new Error('injected path alert outbox post-insert failure');
    const outcomes:string[]=[],tables=['notification_endpoint_scopes','notification_endpoints','notification_endpoint_events',
        'notification_delivery_scopes','notification_deliveries','notification_delivery_attempts','notification_delivery_rates'];
    const notificationRows=async()=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,
        (await rows(db.pool,`SELECT * FROM \`${table}\``)).map(row=>JSON.stringify(row)).sort()])));
    const commandCounts=async()=>Promise.all(['probe_permits','probe_runs'].map(async table=>
        (await rows<{n:number}>(db.pool,`SELECT COUNT(*) n FROM \`${table}\``))[0]!.n));
    class FaultOutbox extends MySqlNotificationDeliveries {
        override async insert(tx:Transaction,scopeId:string,value:NotificationDelivery,at:number) {
            assert.equal(tx,handoffTx,'original path alert transaction reaches the real outbox');
            const outcome=await super.insert(tx,scopeId,value,at);outcomes.push(outcome);
            if(failInsert)throw failure;
            return outcome;
        }
    }
    const outbox=new FaultOutbox(),endpoints=new MySqlNotificationEndpoints(),store=new MySqlStationAlertStore();
    const secrets:NotificationSecrets={async acquire(){secretUses++;assert.fail('cancelled path alert must not acquire secrets');},
        async read(){secretUses++;assert.fail('path alert enqueue must not read secrets');},
        async stage(){secretUses++;assert.fail('path alert enqueue must not stage secrets');},async close(){}};
    const sender:NotificationSender={async send(){sends++;assert.fail('cancelled path alert must not send');},async idle(){},async close(){}};
    const binding='sha256:'+'a'.repeat(64);
    const deliveries=new NotificationDeliveries({db,auth,store:outbox,endpoints,policies:store,enabled:true,secrets,sender,
        authorityBinding:async()=>binding,clock:()=>now,clockSkewMs:0});
    const handoff:StationEventHandoff<Transaction>={async enqueueIn(tx,scopeId,policy,event,at){
        assert.equal(scopeId,scope);assert.equal(event.config.rule,'recent-path-probe-degraded');
        assert.equal(event.config.schemaVersion,3);handoffTx=tx;
        try{await deliveries.enqueueIn(tx,scopeId,policy,event,at);}finally{handoffTx=undefined;}
    }};
    const alerts=new StationAlerts(db,auth,new Idempotency(),store,
        new StationPathFacts(new MySqlStationAlertFacts(),samples,()=>now),true,()=>now,0,handoff);
    const config={schemaVersion:3,rule:'recent-path-probe-degraded',target:{kind:'forward',id:forward},enabled:true,
        thresholdSeconds:0,measurement:'udp-path-echo-v1',maxSampleAgeSeconds:300,maxElapsedMs:1};
    try {
        const beforeCommands=await commandCounts();
        const sample=await db.transaction(tx=>samples.readIn(tx,actor,scope,forward,'udp-path-echo-v1',now,300));
        assert.ok(sample,'actual accepted path sample must retain its current original binding and issuer authorization');
        assert.equal(sample.status,'echoed');assert.ok(sample.elapsedMs>1,'the controlled delayed reply must exceed the declared alert threshold');
        observed={probeId:sample.probeId,bindingDigest:sample.bindingDigest,measurement:sample.measurement,
            measuredAt:sample.measuredAt,validUntil:sample.validUntil,elapsedMs:sample.elapsedMs};
        await alerts.publish(actor,scope,policyId,'p-path-create',0,config);
        const endpointConfig={schemaVersion:1,enabled:true,policyIds:[policyId],kinds:['firing'],minimumIntervalSeconds:10};
        await db.transaction(async tx=>{await endpoints.lockScope(tx,scope);await endpoints.put(tx,scope,
            parseNotificationEndpoint({endpointId,revision:1,credentialRevision:1,config:endpointConfig,
                configDigest:nativeValueDigest(endpointConfig),managedBy:actor,createdAt:now,updatedAt:now,
                suspended:'none',authorityDigest:binding,credentialRef:'b'.repeat(64)}));});
        const beforeNotification=await notificationRows();
        const beforePolicy=(await rows<Record<string,unknown>>(db.pool,'SELECT * FROM station_alert_policies WHERE scope_id=? AND policy_id=?',[scope,policyId]))[0]!;
        await assert.rejects(alerts.tick(),error=>error===failure);
        assert.equal((await rows(db.pool,'SELECT id FROM station_alert_events WHERE scope_id=? AND policy_id=?',[scope,policyId])).length,0);
        assert.deepEqual(await notificationRows(),beforeNotification,'real path event and all notification tables roll back');
        const deferred=(await rows<Record<string,unknown>>(db.pool,'SELECT * FROM station_alert_policies WHERE scope_id=? AND policy_id=?',[scope,policyId]))[0]!;
        assert.equal(deferred.next_evaluate_at,now+300000);
        assert.deepEqual({...deferred,next_evaluate_at:beforePolicy.next_evaluate_at},beforePolicy);
        checks.push('Actual accepted signed path history and original planner feed schema3 Station SQL; post-insert failure rolls event/state/outbox back');

        failInsert=false;
        await db.transaction(tx=>write(tx,'UPDATE station_alert_policies SET next_evaluate_at=? WHERE scope_id=? AND policy_id=?',[now,scope,policyId]));
        await alerts.tick();await alerts.tick();
        const eventFrom=now-1000;
        const events=await db.transaction(tx=>store.events(tx,scope,{from:eventFrom,to:now+1,limit:50,before:null,policyId}));
        assert.equal(events.length,1);assert.equal(events[0]!.kind,'firing');assert.equal(events[0]!.reason,'path-sample-slow');
        const queued=(await rows<{id:string}>(db.pool,'SELECT id FROM notification_deliveries WHERE scope_id=? AND policy_id=?',[scope,policyId]))[0]!;
        assert.ok(queued);
        await db.transaction(async tx=>{await store.lockScope(tx,scope);const policy=await store.policy(tx,scope,policyId,true);
            assert.ok(policy);await deliveries.enqueueIn(tx,scope,policy,events[0]!,events[0]!.occurredAt);});
        assert.deepEqual(outcomes,['inserted','inserted','duplicate']);
        assert.equal((await rows(db.pool,'SELECT id FROM notification_deliveries WHERE scope_id=? AND policy_id=?',[scope,policyId])).length,1);
        checks.push('Actual path event payload persists once and immutable-event replay deduplicates the original outbox');

        now+=301000;
        await alerts.tick();
        const unknown=await db.transaction(tx=>store.policy(tx,scope,policyId));
        assert.ok(unknown);assert.equal(unknown.state.condition,'unknown');
        assert.equal((await db.transaction(tx=>store.events(tx,scope,{from:eventFrom,to:now+1,limit:50,before:null,policyId}))).length,1,'stale history cannot emit recovered');
        assert.deepEqual(await commandCounts(),beforeCommands,'alert reads/evaluation issue no Probe permits or history');
        checks.push('Real SQL stale sample stays unknown without recovered event or additional Probe issuance');

        await sleep(1100);
        await alerts.publish(actor,scope,policyId,'p-path-disable',1,{...config,enabled:false});
        await deliveries.tick();
        const cancelled=await db.transaction(tx=>outbox.get(tx,scope,queued.id));
        assert.equal(cancelled!.status,'cancelled');assert.equal(cancelled!.lastCode,'POLICY_CHANGED');assert.equal(cancelled!.attemptCount,0);
        assert.equal((await rows(db.pool,'SELECT id FROM notification_delivery_attempts')).length,0);
        assert.deepEqual([secretUses,sends],[0,0]);
        checks.push('Original policy disable cancels queued path delivery with zero attempts, secrets or sends');
        conclusion='passed';return checks;
    } finally {
        await writeFile(directory+'/product-p-path-alert.json',JSON.stringify({conclusion,checks,observed,outcomes,secretUses,sends,
            topology:'actual signed three-node sample and native SQL on the same hosted runner',physicalHosts:false,
            externalDelivery:'not-executed; original policy cancellation is verified before sender access'},null,2));
    }
}
