import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createConnection } from 'mysql2/promise';
import { digest } from '@tunex/contracts/shared';
import { MySqlPathTemplateStore } from '../src/infrastructure/mysql-path-template-store.ts';
import { MySqlPathTemplates } from '../src/infrastructure/mysql-path-templates.ts';
import { MySqlUnitOfWork, rows, write, json } from '../src/infrastructure/mysql.ts';
import { consolePageSql } from '../src/infrastructure/mysql-read-pagination.ts';
import { PathTemplateCommands, PathTemplateQueries, parsePathTemplate } from '../src/modules/path-owner/public.ts';
import { Identity } from '../src/modules/identity.ts';
import { Idempotency } from '../src/modules/idempotency.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import type { PathTemplateStorage } from '../src/framework/public.ts';
import type { PathTemplateRevision } from '../src/modules/path-owner/public.ts';

type Statement=readonly [string,readonly unknown[]];
const hash='sha256:'+'a'.repeat(64),at=1800000000000,paging={page:2,limit:3,offset:3};
const config=()=>parsePathTemplate({version:1,protocols:['tcp','udp'],nodes:['ingress','egress'],endpoints:[{nodeId:'egress',revision:1}],transport:{profileId:'profile',configRevision:1}});
const record=(revision=1):PathTemplateRevision=>{const value=config();return {revision,config:value,profileDigest:hash,configDigest:digest({config:value,profileDigest:hash}),createdBy:'actor',createdAt:at};};
const native={n:'007',template_id:'id',current_revision:0,archived:2,revision:0,config:{opaque:'not product validated'},profile_digest:'invalid',config_digest:'bad',created_by:'bad/id',created_at:-1};
const countSQL='SELECT COUNT(*) n FROM path_templates WHERE scope_id=?';
const headSQL='SELECT template_id,current_revision,archived FROM path_templates WHERE scope_id=? AND template_id=?';
const revisionSQL='SELECT revision,config,profile_digest,config_digest,created_by,created_at FROM path_template_revisions WHERE scope_id=? AND template_id=? AND revision=?';
const insertRevision='INSERT INTO path_template_revisions(scope_id,template_id,revision,config,profile_digest,config_digest,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)';
const createHead='INSERT INTO path_templates(scope_id,template_id,current_revision) VALUES(?,?,1)';
const updateHead='UPDATE path_templates SET current_revision=? WHERE scope_id=? AND template_id=?';
const auditSQL='INSERT INTO path_template_events(id,scope_id,template_id,actor_id,revision,kind,created_at) VALUES(?,?,?,?,?,?,?)';
type Store=PathTemplateStorage<Transaction,unknown>;
type Case={name:string;run:(s:Store,tx:Transaction)=>Promise<unknown>;statements:Statement[];result:unknown};
const cases:Case[]=[
    {name:'scope lock',run:(s,t)=>s.lockScope(t,'scope'),statements:[['SELECT id FROM scopes WHERE id=? FOR UPDATE',['scope']]],result:undefined},
    {name:'raw count',run:(s,t)=>s.count(t,'scope'),statements:[[countSQL,['scope']]],result:'007'},
    ...[false,true].map(lock=>({name:'head lock '+lock,run:(s:Store,t:Transaction)=>s.head(t,'scope','id',lock),statements:[[headSQL+(lock?' FOR UPDATE':''),['scope','id']]] as Statement[],result:{templateId:'id',currentRevision:0,archived:true}})),
    {name:'raw revision',run:(s,t)=>s.revision(t,'scope','id',0),statements:[[revisionSQL,['scope','id',0]]],result:{revision:0,config:native.config,profileDigest:'invalid',configDigest:'bad',createdBy:'bad/id',createdAt:-1}},
    {name:'count before page',run:(s,t)=>s.list(t,'scope',paging,'id'),statements:[
        ['SELECT COUNT(*) n FROM path_templates WHERE scope_id=? AND LEFT(template_id,CHAR_LENGTH(?))=?',['scope','id','id']],
        ['SELECT template_id,current_revision,archived FROM path_templates WHERE scope_id=? AND LEFT(template_id,CHAR_LENGTH(?))=? ORDER BY template_id LIMIT 3 OFFSET 3',['scope','id','id']]
    ],result:{total:'007',items:[{templateId:'id',currentRevision:0,archived:true}]}},
    ...[1,2].map(revision=>({name:'publish revision '+revision,run:(s:Store,t:Transaction)=>s.publish(t,'scope','id',record(revision)),statements:[
        ...(revision===1?[[createHead,['scope','id']] as Statement]:[]),
        [insertRevision,['scope','id',revision,JSON.stringify(config()),hash,record().configDigest,'actor',at]] as Statement,
        [updateHead,[revision,'scope','id']] as Statement
    ],result:undefined})),
    {name:'archive',run:(s,t)=>s.archive(t,'scope','id'),statements:[['UPDATE path_templates SET archived=TRUE WHERE scope_id=? AND template_id=?',['scope','id']]],result:undefined},
    {name:'audit',run:(s,t)=>s.audit(t,'scope','id','actor',2,'archive',at),statements:[[auditSQL,['$uuid','scope','id','actor',2,'archive',at]]],result:undefined}
];
for(const entry of cases)test('55 Path lower and zeroarg legacy '+entry.name+' exact supplied transaction SQL arguments raw projection and first-error cutoff',async()=>{
    for(const store of [new MySqlPathTemplateStore<unknown>(),new MySqlPathTemplates() as Store])for(const failAt of [-1,...entry.statements.map((_,index)=>index)]){
        const calls:Statement[]=[],failure=new Error('original native statement');let tx:Transaction;
        tx={async execute(this:unknown,sql:string,args:unknown[]=[]){assert.equal(this,tx);const captured=[...args];
            if(sql===auditSQL){assert.match(String(captured[0]),/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);captured[0]='$uuid';}
            calls.push([sql,captured]);if(calls.length-1===failAt)throw failure;return [sql.startsWith('SELECT')?[native]:{affectedRows:0},[]];
        }} as unknown as Transaction;
        if(failAt<0){const result=await entry.run(store,tx);assert.deepEqual(result,entry.result);if(entry.name==='raw revision')assert.equal((result as {config:unknown}).config,native.config);}
        else await assert.rejects(entry.run(store,tx),e=>e===failure);
        assert.deepEqual(calls,entry.statements.slice(0,failAt<0?undefined:failAt+1));
    }
});

test('55 nullable reads Boolean archive raw JSON malformed decode and pagination retain original boundary without product validation',async()=>{
    for(const store of [new MySqlPathTemplateStore<unknown>(),new MySqlPathTemplates() as Store]){
        const calls:Statement[]=[];let response:unknown[]=[];
        const tx={async execute(sql:string,args:unknown[]=[]){calls.push([sql,args]);return [response,[]];}} as unknown as Transaction;
        assert.equal(await store.head(tx,'scope','none'),null);assert.equal(await store.revision(tx,'scope','none',1),null);
        await assert.rejects(store.count(tx,'scope'),TypeError);
        for(const archived of [0,1,2,null,'0']){response=[{...native,archived}];assert.equal((await store.head(tx,'scope','id'))!.archived,Boolean(archived));}
        for(const value of [{invalid:'config'},null,42,'{"corrupt":true}','null','7']){
            response=[{...native,config:value}];const result=await store.revision(tx,'scope','id',0);assert.deepEqual(result!.config,typeof value==='string'?JSON.parse(value):value);
        }
        response=[{...native,config:'not JSON'}];await assert.rejects(store.revision(tx,'scope','id',0),SyntaxError);
        for(const invalid of [{page:0,limit:1,offset:0},{page:10001,limit:1,offset:10000},{page:1,limit:101,offset:0},{page:1,limit:1,offset:1},{page:1.5,limit:1,offset:0},{page:1,limit:NaN,offset:0}]){
            response=[{n:0}];calls.length=0;await assert.rejects(store.list(tx,'scope',invalid,'%'),e=>(e as {code:string}).code==='INVALID_CONFIG');
            assert.deepEqual(calls,[['SELECT COUNT(*) n FROM path_templates WHERE scope_id=? AND LEFT(template_id,CHAR_LENGTH(?))=?',['scope','%','%']]]);
        }
        const emptyTx={async execute(sql:string){return [sql.startsWith('SELECT COUNT')?[{n:0}]:[],[]];}} as unknown as Transaction;
        assert.deepEqual(await store.list(emptyTx,'scope',{page:10000,limit:100,offset:999900},''),{total:0,items:[]});
    }
});

function loaded(file:string,providers:Record<string,unknown>){
    const source=readFileSync(new URL('../src/infrastructure/'+file,import.meta.url),'utf8'),javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
    const exports:Record<string,any>={},imports:string[]=[];
    new vm.Script(javascript,{filename:file}).runInNewContext({exports,require(name:string){imports.push(name);assert.ok(Object.hasOwn(providers,name),name);return providers[name];}});return {exports,imports};
}
test('55 lower native module initialization audit UUID timing lazy publication encoding and legacy singleton dispatch preserve original async prototypes',async()=>{
    const events:string[]=[],failure=new Error('original UUID'),nativeSQL={rows,write,json};let uuidFailure=false;
    const lower=loaded('mysql-path-template-store.ts',{'node:crypto':{randomUUID(){events.push('uuid');if(uuidFailure)throw failure;return 'controlled-id';}},'./mysql-read-pagination.ts':{consolePageSql},'./mysql.ts':nativeSQL});
    assert.deepEqual(lower.imports,['node:crypto','./mysql-read-pagination.ts','./mysql.ts']);assert.equal(events.length,0);
    const store=new lower.exports.MySqlPathTemplateStore(),calls:Statement[]=[];
    const tx={async execute(sql:string,args:unknown[]=[]){events.push('execute');calls.push([sql,Array.from(args)]);return [{affectedRows:0},[]];}} as unknown as Transaction;
    await store.audit(tx,'scope','id','actor',2,'archive',at);assert.deepEqual(events,['uuid','execute']);assert.deepEqual(calls,[[auditSQL,['controlled-id','scope','id','actor',2,'archive',at]]]);
    events.length=0;calls.length=0;uuidFailure=true;await assert.rejects(store.audit(tx,'scope','id','actor',2,'archive',at),e=>e===failure);assert.deepEqual(events,['uuid']);assert.equal(calls.length,0);
    events.length=0;const value={...record(),get config(){events.push('config');return {toJSON(){events.push('json');throw failure;}};}};
    await assert.rejects(store.publish(tx,'scope','id',value),e=>e===failure);assert.deepEqual(events,['execute','config','json']);assert.deepEqual(calls,[[createHead,['scope','id']]]);
    let constructions=0;const delegated:unknown[][]=[];
    class Lower {constructor(){constructions++;}}
    const wrapper=loaded('mysql-path-templates.ts',{'./mysql-path-template-store.ts':{MySqlPathTemplateStore:Lower}});
    assert.equal(constructions,1);assert.equal(delegated.length,0);const legacy=new wrapper.exports.MySqlPathTemplates();assert.equal(constructions,1);
    const args:Record<string,unknown[]>={lockScope:[tx,'scope'],count:[tx,'scope'],head:[tx,'scope','id'],revision:[tx,'scope','id',2],list:[tx,'scope',paging,'id'],publish:[tx,'scope','id',record()],archive:[tx,'scope','id'],audit:[tx,'scope','id','actor',2,'publish',at]};
    for(const [method,input] of Object.entries(args)){
        const result={method},descriptor=Object.getOwnPropertyDescriptor(wrapper.exports.MySqlPathTemplates.prototype,method)!;
        assert.equal(descriptor.enumerable,false);assert.equal(descriptor.writable,true);assert.equal(descriptor.configurable,true);assert.equal(descriptor.value.constructor.name,'AsyncFunction');
        Object.defineProperty(Lower.prototype,method,{configurable:true,value:function(this:unknown,...supplied:unknown[]){assert.ok(this instanceof Lower);delegated.push(supplied);return result;}});
        assert.equal(await legacy[method](...input),result);assert.deepEqual(delegated.at(-1),method==='head'?[...input,false]:input);
        Object.defineProperty(Lower.prototype,method,{configurable:true,value(){throw failure;}});await assert.rejects(legacy[method](...input),e=>e===failure);
    }
    assert.equal(wrapper.exports.MySqlPathTemplates.length,0);assert.equal(MySqlPathTemplateStore.length,0);assert.equal(MySqlPathTemplates.length,0);
    class Derived extends MySqlPathTemplates {override async count(){return 31;}}
    assert.equal(await new Derived().count(),31);
});

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
async function withDatabase(action:(db:MySqlUnitOfWork)=>Promise<void>){
    const admin=await createConnection(databaseURL!),name='tunex_path_template_'+randomUUID().replaceAll('-',''),url=new URL(databaseURL!);url.pathname='/'+name;
    const db=new MySqlUnitOfWork(url.toString());let created=false;
    try{await admin.query(`CREATE DATABASE \`${name}\``);created=true;await db.migrate();await new Identity(db).bootstrap('scope','actor','a'.repeat(32));await action(db);}
    finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${name}\``);}finally{await admin.end();}}
}
async function snapshot(db:MySqlUnitOfWork){
    const tables=await rows<Record<string,string>>(db.pool,'SHOW TABLES');
    return Object.fromEntries(await Promise.all(tables.map(async row=>{const name=Object.values(row)[0]!,values=await rows<Record<string,unknown>>(db.pool,`SELECT * FROM \`${name}\``);
        return [name,values.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))];})));
}
test('54/55 real canonical MySQL original command atomicity preserves every table after each publication archival audit and idempotency write failure',{skip:!databaseURL},async()=>{
    await withDatabase(async db=>{
        await db.transaction(async tx=>{await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts) VALUES(?,?,?,?,?)',['protected-node','scope','b'.repeat(64),at,'{}']);await write(tx,'INSERT INTO runtime_nodes(node_id,session_epoch) VALUES(?,?)',['protected-node',7]);});
        const statements:Statement[]=[],failure=new Error('after original write');let failAt=-1,ordinal=0,transactions=0;
        const boundary={transaction<T>(action:(current:Transaction)=>Promise<T>){transactions++;return db.transaction(async tx=>{
            const supplied=new Proxy(tx,{get(target,key){if(key==='execute')return async(sql:string,args:unknown[]=[])=>(statements.push([sql,args]),
                await Reflect.apply(target.execute,target,[sql,args]).then((value:unknown)=>{if(!sql.startsWith('SELECT')&&ordinal++===failAt)throw failure;return value;}));return Reflect.get(target,key);}});
            return action(supplied);
        });}};
        const references={async validate(){return {profileDigest:hash};}},store=new MySqlPathTemplates(),identity=new Identity(db),requests=new Idempotency();
        const commands=new PathTemplateCommands(boundary,identity,requests,store,references,()=>at),queries=new PathTemplateQueries(boundary,identity,store);
        async function everyWrite<T>(action:()=>Promise<T>,count:number){
            const before=await snapshot(db);for(let n=0;n<count;n++){failAt=n;ordinal=0;transactions=0;await assert.rejects(action(),e=>e===failure);assert.equal(ordinal,n+1);assert.equal(transactions,1);assert.deepEqual(await snapshot(db),before,'all original tables after write '+n);}
            failAt=-1;ordinal=0;transactions=0;statements.length=0;const result=await action();assert.equal(ordinal,count);assert.equal(transactions,1);return result;
        }
        const first=await everyWrite(()=>commands.publish('actor','scope','id','create',0,config()),6);assert.equal(first.status,202);
        const sql=statements.map(([text])=>text),auth=sql.indexOf('SELECT can_manage FROM scope_members WHERE scope_id=? AND actor_id=? AND active=TRUE FOR SHARE'),scope=sql.indexOf('SELECT id FROM scopes WHERE id=? FOR UPDATE'),head=sql.indexOf(headSQL+' FOR UPDATE'),quota=sql.indexOf(countSQL),publication=sql.indexOf(createHead);
        assert.ok(auth>=0&&auth<scope&&scope<head&&head<quota&&quota<publication);assert.ok(publication<sql.indexOf(insertRevision)&&sql.indexOf(insertRevision)<sql.indexOf(updateHead)&&sql.indexOf(updateHead)<sql.indexOf(auditSQL));
        const saved=await snapshot(db);assert.deepEqual(await commands.publish('actor','scope','id','create',0,config()),first);assert.deepEqual(await snapshot(db),saved);
        const next={...config(),protocols:['tcp'] as const};await everyWrite(()=>commands.publish('actor','scope','id','next',1,next),5);
        assert.deepEqual((await queries.get('actor','scope','id',1)).config.protocols,['tcp','udp']);assert.deepEqual((await queries.get('actor','scope','id')).config.protocols,['tcp']);
        await everyWrite(()=>commands.archive('actor','scope','id','archive',2),4);assert.equal((await queries.get('actor','scope','id')).archived,true);
        const archived=await snapshot(db);await assert.rejects(commands.publish('actor','scope','id','reuse',2,config()),e=>(e as {code:string}).code==='TEMPLATE_ARCHIVED');assert.deepEqual(await snapshot(db),archived);
        assert.equal((await queries.list('actor','scope')).items[0]!.archived,true);
        for(const name of Object.keys(saved))if(!['path_templates','path_template_revisions','path_template_events','idempotency'].includes(name))assert.deepEqual(archived[name],saved[name],name+' protected outside original metadata writes');
    });
});

test('55 real MySQL lower reads retain archived metadata literal prefix corrupt product JSON and read committed count then later page',{skip:!databaseURL},async()=>{
    await withDatabase(async db=>{
        const store=new MySqlPathTemplates();await db.transaction(tx=>store.publish(tx,'scope','a',record()));
        let intervened=false;
        const result=await db.transaction(async tx=>store.list(new Proxy(tx,{get(target,key){if(key==='execute')return async(sql:string,args:unknown[]=[])=>(
            await Reflect.apply(target.execute,target,[sql,args]).then(async(value:unknown)=>{if(sql.startsWith('SELECT COUNT')&&!intervened){intervened=true;await db.transaction(other=>store.publish(other,'scope','b',record()));}return value;}));return Reflect.get(target,key);}}),'scope',{page:1,limit:100,offset:0},''));
        assert.equal(intervened,true);assert.equal(result.total,1);assert.deepEqual(result.items.map(value=>value.templateId),['a','b']);
        await db.transaction(async tx=>{await store.archive(tx,'scope','a');await write(tx,'UPDATE path_template_revisions SET config=? WHERE scope_id=? AND template_id=?',['{"corrupt":"product shape"}','scope','a']);await store.publish(tx,'scope','literal%tail',record());});
        const raw=await db.transaction(tx=>store.revision(tx,'scope','a',1));assert.deepEqual(raw!.config,{corrupt:'product shape'});
        const queries=new PathTemplateQueries(db,new Identity(db),store);await assert.rejects(queries.get('actor','scope','a'),e=>(e as {code:string}).code==='INTEGRITY_FAILURE');
        const literal=await db.transaction(tx=>store.list(tx,'scope',{page:1,limit:100,offset:0},'literal%'));assert.equal(literal.total,1);assert.equal(literal.items[0]!.templateId,'literal%tail');
        assert.equal((await db.transaction(tx=>store.head(tx,'scope','a')))!.archived,true);
        assert.equal(await db.transaction(tx=>store.head(tx,'scope','absent')),null);assert.equal(await db.transaction(tx=>store.revision(tx,'scope','a',2)),null);
    });
});
