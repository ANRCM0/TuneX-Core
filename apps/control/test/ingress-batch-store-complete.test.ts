import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MySqlIngressDeploymentStore } from '../src/infrastructure/mysql-ingress-deployment-store.ts';
import { MySqlIngressMigrationStore } from '../src/infrastructure/mysql-ingress-migration-store.ts';
import { MySqlIngressDeployments } from '../src/infrastructure/mysql-ingress-deployments.ts';
import { MySqlIngressMigrations } from '../src/infrastructure/mysql-ingress-migrations.ts';
import { ingressDeploymentStorageValues, ingressMigrationStorageValues } from '../src/modules/ingress-owner/public.ts';
import { pathPublicationStorageValues, PATH_PUBLICATION_REJECTIONS } from '../src/modules/path-owner/public.ts';
import { ControlError } from '../src/framework/public.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import type { PathPublicationStorageValues, IngressDeploymentStoredPlan, IngressMigrationStoredPlan } from '../src/framework/public.ts';
import type { PathPublicationFailure } from '../src/modules/path-owner/public.ts';

const at=1800000000000, hash='sha256:'+'a'.repeat(64);
const head={batchId:'batch',revision:1,createdBy:'actor',createdAt:at,planDigest:hash,cancelled:false,recoveryInvalidated:false};
const stored={batch_id:'batch',revision:1,created_by:'actor',created_at:at,plan_digest:hash,cancelled:0,recovery_invalidated:1};
const outcome={accepted:false,error:{code:'PORT_RESERVED',status:409 as const,message:'occupied'}};
const deploymentPlan={schemaVersion:1,group:{groupId:'group',revision:2,configDigest:hash},items:[]};
const migrationPlan={schemaVersion:1,sourceGroup:{groupId:'group',revision:2,configDigest:hash},targetGroup:{groupId:'group',revision:3,configDigest:hash},items:[]};
const configurations=[
    {number:60,table:'ingress_deployments',attempts:'ingress_deployment_attempts',events:'ingress_deployment_events',savepoint:'ingress_deployment_forward',kind:'create',make:(values:PathPublicationStorageValues<PathPublicationFailure>)=>new MySqlIngressDeploymentStore<IngressDeploymentStoredPlan,unknown,PathPublicationFailure>(values),Legacy:MySqlIngressDeployments,values:ingressDeploymentStorageValues,plan:deploymentPlan},
    {number:61,table:'ingress_migrations',attempts:'ingress_migration_attempts',events:'ingress_migration_events',savepoint:'ingress_migration_forward',kind:'apply',make:(values:PathPublicationStorageValues<PathPublicationFailure>)=>new MySqlIngressMigrationStore<IngressMigrationStoredPlan,unknown,PathPublicationFailure>(values),Legacy:MySqlIngressMigrations,values:ingressMigrationStorageValues,plan:migrationPlan},
] as const;
function harness(){
    const calls:{sql:string;args:unknown[]}[]=[],answers:any[]=[],affected:number[]=[],failure=new Error('original database error');
    let fail=-1;
    const original={async execute(sql:string,args:unknown[]=[]){assert.equal(this,original);calls.push({sql,args});if(calls.length===fail)throw failure;return [answers.length?answers.shift():sql.startsWith('SELECT')?[]:{affectedRows:affected.shift()??1},[]];},async query(sql:string){assert.equal(this,original);calls.push({sql,args:[]});if(calls.length===fail)throw failure;return [[],[]];}};
    return {tx:original as unknown as Transaction,calls,answers,affected,failure,set fail(value:number){fail=value;},reset(){calls.length=0;answers.length=0;affected.length=0;fail=-1;}};
}

for(const c of configurations){
    test(`${c.number} actual lower and legacy stores retain exact SQL arguments lock choices raw JSON Boolean and bounded operations`,async()=>{
        const h=harness(),store:any=c.make(c.values);
        assert.equal(c.values,pathPublicationStorageValues);assert.equal(ingressDeploymentStorageValues,ingressMigrationStorageValues);
        await store.lockScope(h.tx,'scope');assert.deepEqual(h.calls,[{sql:'SELECT id FROM scopes WHERE id=? FOR UPDATE',args:['scope']}]);
        h.reset();h.answers.push([{n:7}]);assert.equal(await store.count(h.tx,'scope'),7);assert.deepEqual(h.calls,[{sql:`SELECT COUNT(*) n FROM ${c.table} WHERE scope_id=?`,args:['scope']}]);
        for(const groupId of [undefined,'group']){
            h.reset();store.count=async()=>assert.fail('filtered list must execute its own original COUNT');h.answers.push([{n:1}],[stored]);
            const result=await store.list(h.tx,'scope',{page:2,limit:5,offset:5},groupId),filter='scope_id=?'+(groupId===undefined?'':' AND group_id=?'),args=groupId===undefined?['scope']:['scope','group'];
            assert.deepEqual(h.calls,[{sql:`SELECT COUNT(*) n FROM ${c.table} WHERE ${filter}`,args},{sql:`SELECT batch_id,revision,created_by,created_at,plan_digest,cancelled,recovery_invalidated FROM ${c.table} WHERE ${filter} ORDER BY batch_id LIMIT 5 OFFSET 5`,args}]);
            assert.deepEqual(result,{total:1,items:[{...head,cancelled:false,recoveryInvalidated:true}]});
        }
        for(const lock of [undefined,false,true])for(const jsonString of [false,true]){
            h.reset();h.answers.push([{...stored,plan:jsonString?JSON.stringify(c.plan):c.plan}],[{position:1,kind:c.kind,actor_id:'actor',created_at:at,request_key:'key',request_digest:hash,outcome:jsonString?JSON.stringify(outcome):outcome}]);
            assert.deepEqual(await store.read(h.tx,'scope','batch',lock),{head:{...head,recoveryInvalidated:true},plan:c.plan,attempts:[{position:1,kind:c.kind,actorId:'actor',createdAt:at,requestKey:'key',requestDigest:hash,outcome}]});
            assert.deepEqual(h.calls,[{sql:`SELECT batch_id,revision,created_by,created_at,plan_digest,cancelled,recovery_invalidated,plan FROM ${c.table} WHERE scope_id=? AND batch_id=?${lock?' FOR UPDATE':' FOR SHARE'}`,args:['scope','batch']},{sql:`SELECT position,kind,actor_id,created_at,request_key,request_digest,outcome FROM ${c.attempts} WHERE scope_id=? AND batch_id=? ORDER BY position,kind LIMIT 16`,args:['scope','batch']}]);
        }
        h.reset();assert.equal(await store.read(h.tx,'scope','missing'),null);assert.equal(h.calls.length,1);
        h.reset();assert.deepEqual(await store.operations(h.tx,'scope',[]),[]);assert.equal(h.calls.length,0);
        h.answers.push([{id:'operation',forward_id:'forward',target_revision:2,status:'running',cleanup_pending:1,recovery_invalidated:0}]);
        assert.deepEqual(await store.operations(h.tx,'scope',['operation','another']),[{operationId:'operation',forwardId:'forward',targetRevision:2,status:'running',cleanupPending:true,recoveryInvalidated:false}]);
        assert.deepEqual(h.calls,[{sql:'SELECT id,forward_id,target_revision,status,cleanup_pending,recovery_invalidated FROM operations WHERE scope_id=? AND id IN (?,?) ORDER BY id LIMIT 16',args:['scope','operation','another']}]);
        for(const ids of [null,['bad/id'],['same','same'],Array.from({length:17},(_,i)=>'operation-'+i)]){h.reset();await assert.rejects(store.operations(h.tx,'scope',ids),{code:'INVALID_CONFIG'});assert.equal(h.calls.length,0);}
        h.reset();h.answers.push([]);await store.operations(h.tx,'scope',Array.from({length:16},(_,i)=>'operation-'+i));assert.equal(h.calls[0]!.args.length,17);
    });

    test(`${c.number} original create append cancel event dispatch preserves lazy indexes CAS predicates quota and affected row refusal`,async()=>{
        const h=harness(),lower:any=c.make(c.values),legacy:any=new c.Legacy(),steps:string[]=[];
        assert.equal(c.Legacy.length,0);assert.equal(Object.hasOwn(legacy,'create'),false);assert.equal(legacy.create,new c.Legacy().create);
        for(const method of ['lockScope','count','list','read','create','append','cancel','event','isolate','operations'])assert.equal(Object.getOwnPropertyDescriptor(c.Legacy.prototype,method)?.value.constructor.name,'AsyncFunction');
        legacy.count=async function(tx:Transaction,scope:string){assert.equal(this,legacy);assert.equal(tx,h.tx);assert.equal(scope,'scope');steps.push('count');return 0;};
        legacy.event=async function(tx:Transaction,...args:unknown[]){assert.equal(this,legacy);assert.equal(tx,h.tx);steps.push('event');assert.deepEqual(args,['scope','batch',1,'create','actor',at]);};
        await legacy.create(h.tx,'scope',head,c.plan);assert.deepEqual(steps,['count','event']);
        const columns=c.number===60?'group_id,group_revision':'group_id,source_group_revision,target_group_revision',indices=c.number===60?['group',2]:['group',2,3];
        assert.deepEqual(h.calls,[{sql:`INSERT INTO ${c.table}(scope_id,batch_id,${columns},revision,created_by,created_at,plan_digest,cancelled,recovery_invalidated,plan) VALUES(${Array(c.number===60?11:12).fill('?').join(',')})`,args:['scope','batch',...indices,1,'actor',at,hash,false,false,JSON.stringify(c.plan)]}]);
        h.reset();steps.length=0;legacy.count=async()=>{steps.push('quota');return 64;};await assert.rejects(legacy.create(h.tx,'scope',head,c.plan),{code:'RESOURCE_LIMIT'});assert.deepEqual(steps,['quota']);assert.equal(h.calls.length,0);
        if(c.number===61){h.reset();steps.length=0;await assert.rejects(legacy.create(h.tx,'scope',head,{...migrationPlan,targetGroup:{...migrationPlan.targetGroup,groupId:'different'}}),{code:'INTEGRITY_FAILURE'});assert.deepEqual(steps,[]);assert.equal(h.calls.length,0);}
        for(const kind of [c.kind,'compensate']){
            h.reset();const attempt={position:2,kind,actorId:'actor',createdAt:at,requestKey:'key',requestDigest:hash,outcome};
            await lower.append(h.tx,'scope','batch',3,attempt);
            assert.deepEqual(h.calls,[{sql:`UPDATE ${c.table} SET revision=revision+1 WHERE scope_id=? AND batch_id=? AND revision=? AND revision<20 AND recovery_invalidated=FALSE${kind===c.kind?' AND cancelled=FALSE':''}`,args:['scope','batch',3]},
                {sql:`INSERT INTO ${c.attempts}(scope_id,batch_id,position,kind,actor_id,created_at,request_key,request_digest,outcome) VALUES(?,?,?,?,?,?,?,?,?)`,args:['scope','batch',2,kind,'actor',at,'key',hash,JSON.stringify(outcome)]},
                {sql:`INSERT INTO ${c.events}(scope_id,batch_id,revision,kind,actor_id,created_at) VALUES(?,?,?,?,?,?)`,args:['scope','batch',4,kind,'actor',at]}]);
            for(const affected of [0,2]){h.reset();h.affected.push(affected);await assert.rejects(lower.append(h.tx,'scope','batch',3,attempt),{code:'REVISION_CONFLICT'});assert.equal(h.calls.length,1);}
            h.reset();steps.length=0;legacy.event=async function(tx:Transaction,...args:unknown[]){assert.equal(this,legacy);assert.equal(tx,h.tx);assert.deepEqual(args,['scope','batch',4,kind,'actor',at]);steps.push('event');};await legacy.append(h.tx,'scope','batch',3,attempt);assert.equal(h.calls.length,2);assert.deepEqual(steps,['event']);
        }
        h.reset();await lower.cancel(h.tx,'scope','batch',3,'actor',at);assert.deepEqual(h.calls,[{sql:`UPDATE ${c.table} SET cancelled=TRUE,revision=revision+1 WHERE scope_id=? AND batch_id=? AND revision=? AND revision<20 AND cancelled=FALSE AND recovery_invalidated=FALSE`,args:['scope','batch',3]},{sql:`INSERT INTO ${c.events}(scope_id,batch_id,revision,kind,actor_id,created_at) VALUES(?,?,?,?,?,?)`,args:['scope','batch',4,'cancel','actor',at]}]);
        for(const affected of [0,2]){h.reset();h.affected.push(affected);await assert.rejects(lower.cancel(h.tx,'scope','batch',3,'actor',at),{code:'REVISION_CONFLICT'});assert.equal(h.calls.length,1);}
        h.reset();legacy.event=async function(tx:Transaction,...args:unknown[]){assert.equal(this,legacy);assert.equal(tx,h.tx);assert.deepEqual(args,['scope','batch',4,'cancel','actor',at]);};await legacy.cancel(h.tx,'scope','batch',3,'actor',at);assert.equal(h.calls.length,1);
        for(const failureAt of [1,2,3]){h.reset();h.fail=failureAt;await assert.rejects(lower.append(h.tx,'scope','batch',3,{position:1,kind:c.kind,actorId:'actor',createdAt:at,requestKey:'key',requestDigest:hash,outcome}),error=>error===h.failure);assert.equal(h.calls.length,failureAt);}
    });

    test(`${c.number} named savepoint invokes classifier before rollback projection after release and propagates every provider failure`,async()=>{
        const h=harness(),order:string[]=[],refusal=new ControlError('PORT_RESERVED',409,'occupied'),value={original:true};
        const values={isRefusal(error:unknown){assert.equal(error,refusal);order.push('classify');assert.deepEqual(h.calls.map(x=>x.sql),['SAVEPOINT '+c.savepoint]);return true;},refusal(error:unknown){assert.equal(error,refusal);order.push('project');assert.deepEqual(h.calls.map(x=>x.sql),['SAVEPOINT '+c.savepoint,'ROLLBACK TO SAVEPOINT '+c.savepoint,'RELEASE SAVEPOINT '+c.savepoint]);return outcome.error;}};
        const store=c.make(values);assert.deepEqual(await store.isolate(h.tx,async()=>{throw refusal;}),{accepted:false,error:outcome.error});assert.deepEqual(order,['classify','project']);
        h.reset();assert.deepEqual(await store.isolate(h.tx,async()=>value),{accepted:true,value});assert.deepEqual(h.calls.map(x=>x.sql),['SAVEPOINT '+c.savepoint,'RELEASE SAVEPOINT '+c.savepoint]);
        for(const failureAt of [1,2,3]){h.reset();h.fail=failureAt;const raw=c.make(c.values);await assert.rejects(raw.isolate(h.tx,async()=>{throw refusal;}),error=>error===h.failure);assert.equal(h.calls.length,failureAt);}
        for(const error of [new Error('unknown'),Object.assign(new Error('deadlock'),{code:'ER_LOCK_DEADLOCK'}),Object.assign(new Error('db'),{code:'ER_NO_SUCH_TABLE'}),new ControlError('INTEGRITY_FAILURE',409,'corrupt'),new ControlError('PORT_RESERVED',409,'retryable refusal',true)]){h.reset();const raw=c.make(c.values);await assert.rejects(raw.isolate(h.tx,async()=>{throw error;}),actual=>actual===error);assert.deepEqual(h.calls.map(x=>x.sql),['SAVEPOINT '+c.savepoint]);}
        for(const phase of ['isRefusal','refusal']){h.reset();const bad=c.make({...c.values,[phase](){throw h.failure;}});await assert.rejects(bad.isolate(h.tx,async()=>{throw refusal;}),error=>error===h.failure);assert.equal(h.calls.length,phase==='isRefusal'?1:3);}
        const added='B_INGRESS_REFUSAL';PATH_PUBLICATION_REJECTIONS.add(added);try{h.reset();const raw=c.make(c.values);assert.equal((await raw.isolate(h.tx,async()=>{throw new ControlError(added as any,409,'late shared refusal');})).accepted,false);}finally{PATH_PUBLICATION_REJECTIONS.delete(added);}
    });
}

test('60/61 legacy async subclasses keep virtual quota dispatch without eager SQL or event side effects',async()=>{
    const h=harness(),calls:unknown[][]=[];
    class DeploymentSubclass extends MySqlIngressDeployments { override async count(tx:Transaction,scope:string){calls.push([this,tx,scope]);return 64;} }
    class MigrationSubclass extends MySqlIngressMigrations { override async count(tx:Transaction,scope:string){calls.push([this,tx,scope]);return 64;} }
    const deployment=new DeploymentSubclass(),migration=new MigrationSubclass();assert.equal(h.calls.length,0);
    await assert.rejects(deployment.create(h.tx,'scope',head,deploymentPlan as any),{code:'RESOURCE_LIMIT'});await assert.rejects(migration.create(h.tx,'scope',head,migrationPlan as any),{code:'RESOURCE_LIMIT'});
    assert.deepEqual(calls,[[deployment,h.tx,'scope'],[migration,h.tx,'scope']]);assert.equal(h.calls.length,0);
    const poison={get group(){return assert.fail('deployment quota must refuse before group index evaluation');}};
    await assert.rejects(deployment.create(h.tx,'scope',head,poison as any),{code:'RESOURCE_LIMIT'});assert.equal(h.calls.length,0);
    const indices:string[]=[],source={get groupId(){indices.push('source.id');return 'group';},revision:1},target={get groupId(){indices.push('target.id');return 'group';},revision:2};
    const guarded={get sourceGroup(){indices.push('source');return source;},get targetGroup(){indices.push('target');return target;}};
    migration.count=async function(tx:Transaction,scope:string){assert.equal(this,migration);assert.equal(tx,h.tx);assert.equal(scope,'scope');indices.push('count');return 64;};
    await assert.rejects(migration.create(h.tx,'scope',head,guarded as any),{code:'RESOURCE_LIMIT'});assert.deepEqual(indices,['source','source.id','target','target.id','count']);assert.equal(h.calls.length,0);
});
