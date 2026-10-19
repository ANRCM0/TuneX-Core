import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createConnection } from 'mysql2/promise';
import { digest } from '@tunex/contracts/shared';
import { MySqlPathPublicationStore } from '../src/infrastructure/mysql-publication-store.ts';
import { MySqlPathPublications } from '../src/infrastructure/mysql-path-publications.ts';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import * as Framework from '../src/framework/public.ts';
import { Identity } from '../src/modules/identity.ts';
import { Idempotency } from '../src/modules/idempotency.ts';
import { PathPublications, pathPublicationStorageValues, parsePublicationState } from '../src/modules/path-owner/public.ts';
import type { PathPublicationPlan, PathPublicationAttempt, PathPublicationFailure, PathPublicationForwardPort } from '../src/modules/path-owner/public.ts';

const hash='sha256:'+'a'.repeat(64),at=1800000000000,paging={page:2,limit:3,offset:3};
const headSQL='SELECT batch_id,revision,created_by,created_at,plan_digest,cancelled,recovery_invalidated';
const countSQL='SELECT COUNT(*) n FROM path_publications WHERE scope_id=?';
const createSQL='INSERT INTO path_publications(scope_id,batch_id,revision,created_by,created_at,plan_digest,cancelled,recovery_invalidated,plan) VALUES(?,?,?,?,?,?,?,?,?)';
const attemptsSQL='SELECT position,kind,actor_id,created_at,request_key,request_digest,outcome FROM path_publication_attempts WHERE scope_id=? AND batch_id=? ORDER BY position,kind LIMIT 20';
const appendSQL='INSERT INTO path_publication_attempts(scope_id,batch_id,position,kind,actor_id,created_at,request_key,request_digest,outcome) VALUES(?,?,?,?,?,?,?,?,?)';
const updateSQL='UPDATE path_publications SET revision=revision+1 WHERE scope_id=? AND batch_id=? AND revision=? AND revision<24 AND recovery_invalidated=FALSE';
const cancelSQL='UPDATE path_publications SET cancelled=TRUE,revision=revision+1 WHERE scope_id=? AND batch_id=? AND revision=? AND revision<24 AND cancelled=FALSE AND recovery_invalidated=FALSE';
const eventSQL='INSERT INTO path_publication_events(scope_id,batch_id,revision,kind,actor_id,created_at) VALUES(?,?,?,?,?,?)';
const head={batchId:'batch',revision:1,createdBy:'actor',createdAt:at,planDigest:hash,cancelled:false,recoveryInvalidated:false};
const native={batch_id:'batch',revision:'2',created_by:'actor',created_at:'123',plan_digest:'opaque',cancelled:'0',recovery_invalidated:0,plan:{opaque:true}};
const projected={batchId:'batch',revision:'2',createdBy:'actor',createdAt:'123',planDigest:'opaque',cancelled:true,recoveryInvalidated:false};
const attempt:PathPublicationAttempt={position:1,kind:'apply',actorId:'actor',createdAt:at,requestKey:'key',requestDigest:hash,outcome:{accepted:false,error:{code:'PORT_RESERVED',status:409}}};
type Statement=readonly [string,readonly unknown[]];
function sqlFixture(responses:unknown[]=[]){const calls:Statement[]=[],failure=new Error('original SQL error');let fail=-1;const tx={async execute(sql:string,args:unknown[]=[]){assert.equal(this,tx);calls.push([sql,args]);if(calls.length-1===fail)throw failure;const result=responses.shift()??(sql.startsWith('SELECT')?[]:{affectedRows:1});return [result,[]];}} as unknown as Transaction;return {tx,calls,failure,fail:(position:number)=>{fail=position;}};}
const stores=()=>[new MySqlPathPublicationStore<PathPublicationPlan,PathPublicationAttempt['outcome'],PathPublicationFailure>(pathPublicationStorageValues),new MySqlPathPublications()];
const plan={schemaVersion:1,items:[{opaque:true}]} as unknown as PathPublicationPlan;

test('58 lower and zero-argument native stores retain literal SQL transaction receivers raw counts JSON and boolean projection',async()=>{
    assert.equal(MySqlPathPublicationStore.length,1);assert.equal(MySqlPathPublications.length,0);
    for(const store of stores()){
        let f=sqlFixture();await store.lockScope(f.tx,'scope');assert.deepEqual(f.calls,[['SELECT id FROM scopes WHERE id=? FOR UPDATE',['scope']]]);
        f=sqlFixture([[{n:'63'}]]);assert.equal(await store.count(f.tx,'scope'),'63');assert.deepEqual(f.calls,[[countSQL,['scope']]]);
        f=sqlFixture([[{n:'2'}],[native]]);assert.deepEqual(await store.list(f.tx,'scope',paging),{total:'2',items:[projected]});assert.deepEqual(f.calls,[[countSQL,['scope']],[headSQL+' FROM path_publications WHERE scope_id=? ORDER BY batch_id LIMIT 3 OFFSET 3',['scope']]]);
        for(const lock of [false,true]){f=sqlFixture([[native],[{position:'1',kind:'apply',actor_id:'actor',created_at:'123',request_key:'key',request_digest:hash,outcome:'{"accepted":false}'}]]);const value=await store.read(f.tx,'scope','batch',lock);assert.deepEqual(value!.head,projected);assert.equal(value!.plan,native.plan);assert.equal(value!.attempts[0]!.position as unknown,'1');assert.equal(value!.attempts[0]!.createdAt as unknown,'123');assert.equal(Object.getPrototypeOf(value!.attempts[0]!.outcome),Object.prototype);assert.equal((value!.attempts[0]!.outcome as any).accepted,false);assert.deepEqual(f.calls,[[headSQL+',plan FROM path_publications WHERE scope_id=? AND batch_id=?'+(lock?' FOR UPDATE':' FOR SHARE'),['scope','batch']],[attemptsSQL,['scope','batch']]]);}
        f=sqlFixture([[]]);assert.equal(await store.read(f.tx,'scope','missing'),null);assert.equal(f.calls.length,1);
        f=sqlFixture([[{...native,plan:'invalid JSON'}],[]]);await assert.rejects(store.read(f.tx,'scope','batch'));assert.equal(f.calls.length,2);
        f=sqlFixture([[native],[{position:1,kind:'apply',actor_id:'actor',created_at:at,request_key:'key',request_digest:hash,outcome:'invalid JSON'}]]);await assert.rejects(store.read(f.tx,'scope','batch'),{name:'SyntaxError'});assert.equal(f.calls.length,2);
        f=sqlFixture();assert.deepEqual(await store.operations(f.tx,'scope',[]),[]);assert.equal(f.calls.length,0);
        f=sqlFixture([[{id:'op',forward_id:'forward',target_revision:'4',status:'opaque',cleanup_pending:'0',recovery_invalidated:0}]]);assert.deepEqual(await store.operations(f.tx,'scope',['op']),[{operationId:'op',forwardId:'forward',targetRevision:'4',status:'opaque',cleanupPending:true,recoveryInvalidated:false}]);assert.deepEqual(f.calls,[['SELECT id,forward_id,target_revision,status,cleanup_pending,recovery_invalidated FROM operations WHERE scope_id=? AND id IN (?) ORDER BY id LIMIT 20',['scope','op']]]);
        for(const ids of [null,['x','x'],['invalid/id'],Array.from({length:21},(_,i)=>'op'+i)]){f=sqlFixture();await assert.rejects(store.operations(f.tx,'scope',ids as never),{code:'INVALID_CONFIG'});assert.equal(f.calls.length,0);}
        for(const invoke of [(tx:Transaction)=>store.lockScope(tx,'scope'),(tx:Transaction)=>store.count(tx,'scope'),(tx:Transaction)=>store.list(tx,'scope',paging),(tx:Transaction)=>store.read(tx,'scope','batch'),(tx:Transaction)=>store.operations(tx,'scope',['op'])]){f=sqlFixture();f.fail(0);await assert.rejects(invoke(f.tx),e=>e===f.failure);assert.equal(f.calls.length,1);}
    }
});

test('58 original create append cancel event SQL and quotas CAS each statement fault retain exact mutation order',async()=>{
    for(const store of stores()){
        let f=sqlFixture([[{n:63}]]);await store.create(f.tx,'scope',head,plan);assert.deepEqual(f.calls,[[countSQL,['scope']],[createSQL,['scope','batch',1,'actor',at,hash,false,false,JSON.stringify(plan)]],[eventSQL,['scope','batch',1,'create','actor',at]]]);
        for(const n of [64,'64',65]){f=sqlFixture([[{n}]]);await assert.rejects(store.create(f.tx,'scope',head,plan),{code:'RESOURCE_LIMIT'});assert.deepEqual(f.calls,[[countSQL,['scope']]]);}
        for(const kind of ['apply','compensate'] as const){f=sqlFixture();await store.append(f.tx,'scope','batch',3,{...attempt,kind});assert.deepEqual(f.calls,[[updateSQL+(kind==='apply'?' AND cancelled=FALSE':''),['scope','batch',3]],[appendSQL,['scope','batch',1,kind,'actor',at,'key',hash,JSON.stringify(attempt.outcome)]],[eventSQL,['scope','batch',4,kind,'actor',at]]]);}
        f=sqlFixture();await store.cancel(f.tx,'scope','batch',3,'actor',at);assert.deepEqual(f.calls,[[cancelSQL,['scope','batch',3]],[eventSQL,['scope','batch',4,'cancel','actor',at]]]);
        for(const changed of [0,2,'1'])for(const method of ['append','cancel'] as const){f=sqlFixture([{affectedRows:changed}]);await assert.rejects(method==='append'?store.append(f.tx,'scope','batch',1,attempt):store.cancel(f.tx,'scope','batch',1,'actor',at),{code:'REVISION_CONFLICT'});assert.equal(f.calls.length,1);}
        const actions=[{count:3,answers:[[{n:0}]],run:(tx:Transaction)=>store.create(tx,'scope',head,plan)},{count:3,answers:[],run:(tx:Transaction)=>store.append(tx,'scope','batch',1,attempt)},{count:2,answers:[],run:(tx:Transaction)=>store.cancel(tx,'scope','batch',1,'actor',at)}];
        for(const action of actions)for(let n=0;n<action.count;n++){f=sqlFixture([...action.answers]);f.fail(n);await assert.rejects(action.run(f.tx),e=>e===f.failure);assert.equal(f.calls.length,n+1);}
        const encoding=new Error('native encoding');f=sqlFixture([[{n:0}]]);await assert.rejects(store.create(f.tx,'scope',head,{toJSON(){throw encoding;}} as never),e=>e===encoding);assert.deepEqual(f.calls,[[countSQL,['scope']]]);
        f=sqlFixture();await assert.rejects(store.append(f.tx,'scope','batch',1,{...attempt,outcome:{toJSON(){throw encoding;}} as never}),e=>e===encoding);assert.deepEqual(f.calls,[[updateSQL+' AND cancelled=FALSE',['scope','batch',1]]]);
    }
});

test('58 legacy singleton preserves async subclass methods deferred dynamic count event hooks and exact lower result/error identity',async()=>{
    const module={exports:{} as any},instances:unknown[][]=[],captures:unknown[][]=[],failure=new Error('lower'),answer={original:true};
    const methods=['lockScope','count','list','read','create','append','cancel','isolate','operations'];const Lower=class{constructor(...args:unknown[]){instances.push(args);}};for(const method of methods)Object.defineProperty(Lower.prototype,method,{configurable:true,value:function(...args:unknown[]){assert.ok(this instanceof Lower);captures.push([method,...args]);return Promise.resolve(answer);}});
    vm.runInNewContext(ts.transpile(readFileSync(new URL('../src/infrastructure/mysql-path-publications.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}),{exports:module.exports,module,require:(name:string)=>name==='./mysql-publication-store.ts'?{MySqlPathPublicationStore:Lower}:name==='../modules/path-owner/public.ts'?{pathPublicationStorageValues}:assert.fail(name)});
    const Ctor=module.exports.MySqlPathPublications,first=new Ctor(),second=new Ctor();assert.equal(instances.length,1);assert.equal(instances[0]![0],pathPublicationStorageValues);const eventDescriptor=Object.getOwnPropertyDescriptor(Ctor.prototype,'event')!;assert.equal(eventDescriptor.value.constructor.name,'AsyncFunction');assert.equal(eventDescriptor.enumerable,false);const tx={};
    const args:Record<string,unknown[]>={lockScope:[tx,'scope'],count:[tx,'scope'],list:[tx,'scope',paging],read:[tx,'scope','batch'],create:[tx,'scope',head,plan],append:[tx,'scope','batch',1,attempt],cancel:[tx,'scope','batch',1,'actor',at],isolate:[tx,async()=>answer],operations:[tx,'scope',['op']]};
    for(const method of methods){captures.length=0;const descriptor=Object.getOwnPropertyDescriptor(Ctor.prototype,method)!;assert.equal(descriptor.value.constructor.name,'AsyncFunction');assert.equal(descriptor.enumerable,false);assert.equal(descriptor.writable,true);assert.equal(descriptor.configurable,true);assert.equal(await first[method](...args[method]!),answer);const call=captures[0]!;assert.equal(call[0],method);assert.deepEqual(call.slice(1,args[method]!.length+1),args[method]);if(method==='read')assert.equal(call.at(-1),false);if(['list','create','append','cancel'].includes(method)){const hooks=call.at(-1) as any;if(method==='list'||method==='create'){let count=0;first.count=async(...values:unknown[])=>{count++;assert.deepEqual(values,[tx,'scope']);return 7;};assert.equal(await hooks.count(tx,'scope'),7);assert.equal(count,1);delete first.count;}if(method!=='list'){first.event=async(...values:unknown[])=>{assert.deepEqual(values,[tx,'scope','batch',2,'cancel','actor',at]);return answer;};assert.equal(await hooks.event(tx,'scope','batch',2,'cancel','actor',at),answer);delete first.event;}}
        const original=Object.getOwnPropertyDescriptor(Lower.prototype,method)!;Object.defineProperty(Lower.prototype,method,{...original,value(){throw failure;}});try{await assert.rejects(second[method](...args[method]!),e=>e===failure);}finally{Object.defineProperty(Lower.prototype,method,original);}}
});

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
async function database(action:(db:MySqlUnitOfWork)=>Promise<void>){const admin=await createConnection(databaseURL!),name='tunex_path_publication_'+randomUUID().replaceAll('-',''),url=new URL(databaseURL!);url.pathname='/'+name;const db=new MySqlUnitOfWork(url.toString());let created=false;try{await admin.query(`CREATE DATABASE \`${name}\``);created=true;await db.migrate();await new Identity(db).bootstrap('scope','actor','a'.repeat(32));await action(db);}finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${name}\``);}finally{await admin.end();}}}
async function snapshot(db:MySqlUnitOfWork){const tables=await rows<Record<string,string>>(db.pool,'SHOW TABLES');return Object.fromEntries(await Promise.all(tables.map(async row=>{const name=Object.values(row)[0]!,values=await rows<Record<string,unknown>>(db.pool,`SELECT * FROM \`${name}\``);return [name,values.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))];})));}

test('58 canonical MySQL original owner and savepoint preserve every write rollback durable refusal reply replay and all immutable history',{skip:!databaseURL},async()=>{
    await database(async db=>{
        const spec={enabled:false,protocols:['tcp'] as const,ingress:{nodeId:'ingress',listen:{address:'127.0.0.1',port:32001}},target:{host:'127.0.0.1',port:9000}},proposed={...spec,path:{via:['egress']},transport:{profileId:'profile',configRevision:1}},source=parsePublicationState({forwardId:'forward',revision:3,spec,specDigest:digest(spec),path:null,group:null}),group={groupId:'group',revision:1,configDigest:hash,candidateId:'candidate'},template={templateId:'template',revision:1,configDigest:hash};
        const body={schemaVersion:1,group,items:[{forwardId:'forward',expectedRevision:3}]},plan={schemaVersion:1,group,items:[{position:1,source,template,proposedSpec:proposed,proposedDigest:digest(proposed)}]},failure=new Error('post native write');let failAt=-1,writes=0,transactions=0,refused=false;
        await db.transaction(async tx=>{await write(tx,'INSERT INTO forwards(id,scope_id,revision,spec,authorization_actor) VALUES(?,?,3,?,?)',['forward','scope',JSON.stringify(spec),'actor']);await write(tx,'INSERT INTO forward_revisions(forward_id,revision,spec) VALUES(?,3,?)',['forward',JSON.stringify(spec)]);});
        const boundary={transaction<T>(action:(tx:Transaction)=>Promise<T>){transactions++;return db.transaction(tx=>action(new Proxy(tx,{get(target,key){if(key==='execute')return async(sql:string,args:unknown[]=[])=>(await Reflect.apply(target.execute,target,[sql,args]).then((result:unknown)=>{if(!sql.startsWith('SELECT')&&writes++===failAt)throw failure;return result;}));return Reflect.get(target,key);}})));}};
        // Test-owned Forward port writes its original test Forward only. Other suites
        // independently exercise the real Forward/Path/Group execution owner chain.
        const forwards:PathPublicationForwardPort<Transaction>={async previewPublicationIn(){const {position:_,...item}=plan.items[0]!;return item;},async applyPublicationIn(tx){await write(tx,'UPDATE forwards SET revision=4,spec=? WHERE id=?',[JSON.stringify(proposed),'forward']);if(refused)throw new Framework.ControlError('PORT_RESERVED',409,'redacted native refusal');const state=parsePublicationState({...source,revision:4,spec:proposed,specDigest:digest(proposed),path:{...template,sequence:1,forwardRevision:4},group:{...group,sequence:1,pathBindingSequence:1,forwardRevision:4}});return {state,accepted:{status:202,body:{forwardId:'forward',revision:4,operationId:'operation',pathBinding:{...state.path!,changed:true},pathGroupBinding:{...state.group!,changed:true}}}};},async compensatePublicationIn(){throw Error('unused');}};
        const owner=new PathPublications(boundary,new Identity(db),new Idempotency(),new MySqlPathPublications(),forwards,()=>at,()=> 'batch');
        async function everyWrite(action:()=>Promise<unknown>,count:number){const before=await snapshot(db);for(let n=0;n<count;n++){failAt=n;writes=0;transactions=0;await assert.rejects(action(),e=>e===failure);assert.equal(writes,n+1);assert.equal(transactions,1);assert.deepEqual(await snapshot(db),before);}failAt=-1;writes=0;transactions=0;const result=await action();assert.equal(writes,count);assert.equal(transactions,1);return result;}
        await everyWrite(()=>owner.create('actor','scope','create',body,digest(plan)),4);
        refused=true;const rejected=await everyWrite(()=>owner.act('actor','scope','batch','apply',1,'apply',1),6);assert.ok(rejected);assert.equal((await rows<any>(db.pool,'SELECT revision FROM forwards WHERE id=?',['forward']))[0]!.revision,3);assert.equal((await owner.get('actor','scope','batch')).items[0]!.state,'rejected');
        const saved=await snapshot(db);assert.deepEqual(await owner.act('actor','scope','batch','apply',1,'apply',1),rejected);assert.deepEqual(await snapshot(db),saved);
        await everyWrite(()=>owner.cancel('actor','scope','batch','cancel',2),4);const terminal=await snapshot(db);assert.equal((await owner.cancel('actor','scope','batch','noop',3)).status,200);const noop=await snapshot(db);for(const table of Object.keys(terminal))if(table!=='idempotency')assert.deepEqual(noop[table],terminal[table]);assert.equal((await rows<any>(db.pool,'SELECT COUNT(*) n FROM path_publication_attempts'))[0]!.n,1);assert.equal((await rows<any>(db.pool,'SELECT COUNT(*) n FROM path_publication_events'))[0]!.n,3);
        await db.transaction(async tx=>{await write(tx,'UPDATE path_publications SET recovery_invalidated=TRUE,revision=revision+1 WHERE scope_id=? AND batch_id=?',['scope','batch']);});const restored=await snapshot(db);await assert.rejects(owner.act('actor','scope','batch','apply',1,'apply',1),{code:'RECOVERY_REPLAY_REQUIRES_REVIEW'});assert.deepEqual(await snapshot(db),restored);
    });
});

test('58 canonical MySQL batch head locks serialize CAS and retain cancel/recovery/revision predicates with a second quota check',{skip:!databaseURL},async()=>{
    await database(async db=>{const store=new MySqlPathPublications();await db.transaction(tx=>store.create(tx,'scope',head,plan));
        const action=()=>db.transaction(async tx=>{assert.ok(await store.read(tx,'scope','batch',true));await store.append(tx,'scope','batch',1,attempt);});const results=await Promise.allSettled([action(),action()]);assert.equal(results.filter(item=>item.status==='fulfilled').length,1);const rejected=results.find(item=>item.status==='rejected') as PromiseRejectedResult;assert.equal(rejected.reason.code,'REVISION_CONFLICT');
        await db.transaction(tx=>store.cancel(tx,'scope','batch',2,'actor',at));await assert.rejects(db.transaction(tx=>store.append(tx,'scope','batch',3,attempt)),{code:'REVISION_CONFLICT'});await db.transaction(tx=>store.append(tx,'scope','batch',3,{...attempt,kind:'compensate'}));
        await db.transaction(tx=>write(tx,'UPDATE path_publications SET revision=24 WHERE scope_id=? AND batch_id=?',['scope','batch']));await assert.rejects(db.transaction(tx=>store.cancel(tx,'scope','batch',24,'actor',at)),{code:'REVISION_CONFLICT'});await assert.rejects(db.transaction(tx=>store.append(tx,'scope','batch',24,{...attempt,position:2,kind:'compensate'})),{code:'REVISION_CONFLICT'});
        await db.transaction(async tx=>{for(let n=1;n<64;n++)await store.create(tx,'scope',{...head,batchId:'batch-'+n},plan);});const before=await snapshot(db);await assert.rejects(db.transaction(tx=>store.create(tx,'scope',{...head,batchId:'overflow'},plan)),{code:'RESOURCE_LIMIT'});assert.deepEqual(await snapshot(db),before);
    });
});
