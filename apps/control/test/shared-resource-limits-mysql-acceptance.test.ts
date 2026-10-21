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
import type { SharedResourceLimitInput } from '../src/modules/resource-limit-owner/public.ts';

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
const startsAt='2026-10-01T00:00:00.000Z',endsAt='2026-11-01T00:00:00.000Z';
const now=Date.parse('2026-10-21T00:00:00.000Z');
const input=(expectedRevision=0):SharedResourceLimitInput=>({expectedRevision,startsAt,endsAt,
    bytesPerSecond:1024,burstBytes:4096,byteLimit:10000});
const code=(expected:string)=>(error:unknown)=>(error as {code?:string})?.code===expected;

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
    const after=await policyRows(db);
    await assert.rejects(service.set('admin','scope','shared','alice','overlap',input(3)),code('REVISION_CONFLICT'));
    assert.deepEqual(await policyRows(db),after);
    await db.transaction(tx=>write(tx,"UPDATE scope_members SET active=FALSE WHERE scope_id='scope' AND actor_id='alice'"));
    await assert.rejects(service.set('admin','scope','shared','alice','inactive',input(3)),code('NOT_FOUND'));
    assert.deepEqual(await policyRows(db),after);
}));
