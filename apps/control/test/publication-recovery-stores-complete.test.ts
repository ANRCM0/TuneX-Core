import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'mysql2/promise';
import { PathPublicationRecovery } from '../src/modules/path-owner/public.ts';
import { IngressRecovery } from '../src/modules/ingress-owner/public.ts';
import { MySqlPathPublicationRecoveryStore } from '../src/infrastructure/mysql-path-publication-recovery-store.ts';
import { MySqlIngressDeploymentRecoveryStore } from '../src/infrastructure/mysql-ingress-deployment-recovery-store.ts';
import { MySqlIngressMigrationRecoveryStore } from '../src/infrastructure/mysql-ingress-migration-recovery-store.ts';
import { MySqlRecoveryEventStore } from '../src/infrastructure/mysql-recovery-event-store.ts';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

const cases=[
    {name:'Path publication',head:'path_publications',events:'path_publication_events',attempts:'path_publication_attempts',
        eventSQL:"INSERT INTO path_publication_events(scope_id,batch_id,revision,kind,actor_id,created_at) SELECT scope_id,batch_id,revision+1,'recovery',created_by,? FROM path_publications WHERE recovery_invalidated=FALSE",
        invalidateSQL:'UPDATE path_publications SET recovery_invalidated=TRUE,revision=revision+1 WHERE recovery_invalidated=FALSE',
        create:()=>new MySqlPathPublicationRecoveryStore()},
    {name:'Ingress deployment',head:'ingress_deployments',events:'ingress_deployment_events',attempts:'ingress_deployment_attempts',
        eventSQL:"INSERT INTO ingress_deployment_events(scope_id,batch_id,revision,kind,actor_id,created_at) SELECT scope_id,batch_id,revision+1,'recovery',created_by,? FROM ingress_deployments WHERE recovery_invalidated=FALSE",
        invalidateSQL:'UPDATE ingress_deployments SET recovery_invalidated=TRUE,revision=revision+1 WHERE recovery_invalidated=FALSE',
        create:()=>new MySqlIngressDeploymentRecoveryStore()},
    {name:'Ingress migration',head:'ingress_migrations',events:'ingress_migration_events',attempts:'ingress_migration_attempts',
        eventSQL:"INSERT INTO ingress_migration_events(scope_id,batch_id,revision,kind,actor_id,created_at) SELECT scope_id,batch_id,revision+1,'recovery',created_by,? FROM ingress_migrations WHERE recovery_invalidated=FALSE",
        invalidateSQL:'UPDATE ingress_migrations SET recovery_invalidated=TRUE,revision=revision+1 WHERE recovery_invalidated=FALSE',
        create:()=>new MySqlIngressMigrationRecoveryStore()},
] as const;

for(const entry of cases)test(`162 ${entry.name} recovery preserves exact event-before-invalidation SQL predicate revision actor supplied time and first failure`,async()=>{
    for(const at of [0,123.5,NaN,Infinity,-Infinity])for(const failAt of [-1,0,1]){
        const calls:unknown[][]=[],failure=new Error('supplied executor failure');let tx:Transaction;
        tx=new Proxy({async execute(this:unknown,sql:string,args:unknown[]=[]){assert.equal(this,tx);calls.push([sql,[...args]]);
            if(calls.length-1===failAt)throw failure;return [{affectedRows:0},[]];}},
            {get(target,key,receiver){if(key==='execute')return Reflect.get(target,key,receiver);assert.fail(`recovery requested hidden effect ${String(key)}`);}}) as unknown as Transaction;
        const pending=entry.create().quarantineRecovery(tx,at);
        if(failAt<0)await pending;else await assert.rejects(pending,error=>error===failure);
        assert.deepEqual(calls,[[entry.eventSQL,[at]],[entry.invalidateSQL,[]]].slice(0,failAt===0?1:2));
    }
});

test('162 public Path and Ingress recovery forward only their own store exact Tx time receiver and original promise without defaults',async t=>{
    t.mock.method(Date,'now',()=>assert.fail('publication recovery must use caller time'));
    const tx={},times=[0,12.75,NaN,Infinity,-Infinity],promises=[Promise.resolve(),Promise.resolve(),Promise.resolve()],calls:unknown[][]=[];
    const stores=promises.map((promise,index)=>({quarantineRecovery(this:unknown,...args:unknown[]){assert.equal(this,stores[index]);calls.push([index,...args]);return promise;}}));
    const path=new PathPublicationRecovery(stores[0]!),ingress=new IngressRecovery(stores[1]!,stores[2]!);
    for(const at of times){assert.equal(path.quarantineRecovery(tx,at),promises[0]);assert.equal(ingress.quarantineDeployments(tx,at),promises[1]);assert.equal(ingress.quarantineMigrations(tx,at),promises[2]);}
    assert.deepEqual(calls,times.flatMap(at=>[[0,tx,at],[1,tx,at],[2,tx,at]]));
    const failure=new Error('original store refusal'),bad={quarantineRecovery(){throw failure;}};
    assert.throws(()=>new PathPublicationRecovery(bad).quarantineRecovery(tx,0),error=>error===failure);
    assert.throws(()=>new IngressRecovery(bad,bad).quarantineDeployments(tx,0),error=>error===failure);
    assert.throws(()=>new IngressRecovery(bad,bad).quarantineMigrations(tx,0),error=>error===failure);
    assert.throws(()=>new PathPublicationRecovery(undefined as never).quarantineRecovery(tx,0),TypeError);
    assert.throws(()=>new IngressRecovery(undefined as never,undefined as never).quarantineDeployments(tx,0),TypeError);
    const untouched=new Proxy({},{get(_target,key){assert.fail(`constructor inspected provider ${String(key)}`);}});
    new PathPublicationRecovery(untouched as never);new IngressRecovery(untouched as never,untouched as never);
});

test('162 native final recovery event store retains supplied event identity time opaque encoding and original one-write error',async()=>{
    const calls:unknown[][]=[],failure=new Error('record failed');let fail=false,tx:Transaction;
    tx={async execute(this:unknown,...args:unknown[]){assert.equal(this,tx);calls.push(args);if(fail)throw failure;return [{affectedRows:1},[]];}} as unknown as Transaction;
    const store=new MySqlRecoveryEventStore(),details='opaque\u0000not parsed',at=123.75;
    await store.record(tx,'event',at,details);assert.deepEqual(calls,[['INSERT INTO recovery_events(id,created_at,details) VALUES(?,?,?)',['event',at,details]]]);
    fail=true;await assert.rejects(store.record(tx,'next',0,''),error=>error===failure);assert.equal(calls.length,2);
});

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
async function withDatabase(action:(db:MySqlUnitOfWork)=>Promise<void>) {
    const admin=await createConnection(databaseURL!),database='tunex_recovery_publication_'+randomUUID().replaceAll('-','');
    const url=new URL(databaseURL!);url.pathname='/'+database;const db=new MySqlUnitOfWork(url.toString());let created=false;
    try{await admin.query(`CREATE DATABASE \`${database}\``);created=true;await db.migrate();
        await db.transaction(async tx=>{await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',['actor','a'.repeat(64)]);
            await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',['scope','actor']);});await action(db);
    }finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${database}\``);}finally{await admin.end();}}
}
async function insert(tx:Transaction,name:string,value:Record<string,unknown>) {
    const keys=Object.keys(value);await write(tx,`INSERT INTO ${name}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`,Object.values(value));
}
async function snapshot(db:MySqlUnitOfWork,names:readonly string[]):Promise<Record<string,Record<string,unknown>[]>> {
    return Object.fromEntries(await Promise.all(names.map(async name=>[name,await rows<Record<string,unknown>>(db.pool,`SELECT * FROM ${name} ORDER BY 1,2`)])));
}

test('162 real MySQL Path and Ingress recovery append creator-attributed next-revision events then invalidate only eligible batches and preserve all definitions lineage attempts audits cancel flags and current pointers',{skip:!databaseURL},async()=>{
    await withDatabase(async db=>{
        const hash='sha256:'+'a'.repeat(64),definitionTables=['path_templates','path_template_revisions','path_template_events','path_groups','path_group_revisions','path_group_events',
            'ingress_groups','ingress_group_revisions','ingress_group_events','forwards','forward_revisions','forward_path_bindings','current_path_bindings',
            'forward_path_group_bindings','current_forward_path_group_bindings'];
        await db.transaction(async tx=>{
            await insert(tx,'forwards',{id:'forward',scope_id:'scope',revision:1,spec:'{"preserved":"intent"}'});
            await insert(tx,'forward_revisions',{forward_id:'forward',revision:1,spec:'{"preserved":"history"}'});
            await insert(tx,'path_templates',{scope_id:'scope',template_id:'template',current_revision:2,archived:true});
            for(const revision of [1,2])await insert(tx,'path_template_revisions',{scope_id:'scope',template_id:'template',revision,config:'{"preserved":"template"}',profile_digest:hash,config_digest:hash,created_by:'actor',created_at:revision});
            await insert(tx,'path_template_events',{id:'template-audit',scope_id:'scope',template_id:'template',revision:2,kind:'publish',actor_id:'actor',created_at:2});
            for(const name of ['path','ingress']){
                await insert(tx,`${name}_groups`,{scope_id:'scope',group_id:'group',current_revision:2,archived:true});
                for(const revision of [1,2])await insert(tx,`${name}_group_revisions`,{scope_id:'scope',group_id:'group',revision,
                    config:name==='path'?'{"candidates":[{"preserved":"path"}]}':'{"members":[{"preserved":"ingress"}]}',config_digest:hash,created_by:'actor',created_at:revision});
                await insert(tx,`${name}_group_events`,{id:name+'-audit',scope_id:'scope',group_id:'group',revision:2,kind:'archive',actor_id:'actor',created_at:3});
            }
            await insert(tx,'forward_path_bindings',{forward_id:'forward',sequence:1,scope_id:'scope',template_id:'template',template_revision:1,config_digest:hash,
                forward_revision:1,expanded_spec:'{"preserved":"expanded intent"}',spec_digest:hash,actor_id:'actor',created_at:4});
            await insert(tx,'current_path_bindings',{forward_id:'forward',sequence:1});
            await insert(tx,'forward_path_group_bindings',{forward_id:'forward',sequence:1,scope_id:'scope',group_id:'group',group_revision:1,config_digest:hash,candidate_id:'candidate',
                path_binding_sequence:1,forward_revision:1,expanded_spec:'{"preserved":"provenance"}',spec_digest:hash,actor_id:'actor',created_at:5});
            await insert(tx,'current_forward_path_group_bindings',{forward_id:'forward',sequence:1});
            for(const entry of cases)for(const [index,batch] of ['active','cancelled','already-invalidated'].entries()){
                const value:Record<string,unknown>={scope_id:'scope',batch_id:batch,revision:index+2,created_by:'creator-'+batch,created_at:100+index,plan_digest:hash,
                    cancelled:batch==='cancelled',recovery_invalidated:batch==='already-invalidated',
                    plan:JSON.stringify({items:[{position:1}],lineage:{sourceRevision:1,targetRevision:2,origin:{forwardId:'forward',sequence:1}},preserved:entry.head})};
                if(entry.head==='ingress_deployments')Object.assign(value,{group_id:'group',group_revision:1});
                if(entry.head==='ingress_migrations')Object.assign(value,{group_id:'group',source_group_revision:1,target_group_revision:2});
                await insert(tx,entry.head,value);
                await insert(tx,entry.attempts,{scope_id:'scope',batch_id:batch,position:1,kind:'compensate',actor_id:'actor',created_at:200,
                    request_key:'original-'+batch,request_digest:hash,outcome:'{"preserved":"attempt outcome and lineage"}'});
                await insert(tx,entry.events,{scope_id:'scope',batch_id:batch,revision:index+2,kind:'cancel',actor_id:'audit-actor',created_at:210});
            }
        });
        const all=[...definitionTables,...cases.flatMap(entry=>[entry.head,entry.events,entry.attempts])],before=await snapshot(db,all),at=345678;
        const path=new PathPublicationRecovery(new MySqlPathPublicationRecoveryStore()),ingress=new IngressRecovery(new MySqlIngressDeploymentRecoveryStore(),new MySqlIngressMigrationRecoveryStore());
        const quarantine=async(tx:Transaction)=>{await path.quarantineRecovery(tx,at);await ingress.quarantineDeployments(tx,at);await ingress.quarantineMigrations(tx,at);};
        const failure=new Error('caller rollback after all native writes');
        await assert.rejects(db.transaction(async tx=>{await quarantine(tx);throw failure;}),error=>error===failure);assert.deepEqual(await snapshot(db,all),before);
        await db.transaction(quarantine);const after=await snapshot(db,all);
        for(const name of definitionTables)assert.deepEqual(after[name],before[name],`definition/history/provenance/current pointer ${name}`);
        for(const entry of cases){
            assert.deepEqual(after[entry.head],before[entry.head]!.map(row=>row.recovery_invalidated?row:{...row,recovery_invalidated:1,revision:Number(row.revision)+1}));
            assert.deepEqual(after[entry.attempts],before[entry.attempts]);
            const oldKeys=new Set(before[entry.events]!.map(row=>`${row.scope_id}/${row.batch_id}/${row.revision}`));
            assert.deepEqual(after[entry.events]!.filter(row=>oldKeys.has(`${row.scope_id}/${row.batch_id}/${row.revision}`)),before[entry.events]);
            const added=after[entry.events]!.filter(row=>!oldKeys.has(`${row.scope_id}/${row.batch_id}/${row.revision}`));
            assert.deepEqual(added,before[entry.head]!.filter(row=>!row.recovery_invalidated).map(row=>({scope_id:row.scope_id,batch_id:row.batch_id,
                revision:Number(row.revision)+1,kind:'recovery',actor_id:row.created_by,created_at:at})));
        }
        await db.transaction(quarantine);assert.deepEqual(await snapshot(db,all),after,'already invalidated rows add no recovery event revision attempt or compensation');
    });
});
