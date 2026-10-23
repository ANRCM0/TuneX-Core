import { ResourceAccess } from '../src/modules/resource-access-owner/public.ts';
import { MySqlResourceAccessStore } from '../src/infrastructure/mysql-resource-access.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createConnection } from 'mysql2/promise';
import { digest } from '@tunex/contracts/shared';
import { parseForwardSpec } from '@tunex/core';
import { MySqlPathGroupStore, MySqlPathGroupBindingStore } from '../src/infrastructure/mysql-path-group-store.ts';
import { MySqlPathGroups, MySqlPathGroupBindings } from '../src/infrastructure/mysql-path-groups.ts';
import { MySqlPathBindings } from '../src/infrastructure/mysql-path-bindings.ts';
import { MySqlPathTemplates } from '../src/infrastructure/mysql-path-templates.ts';
import { MySqlUnitOfWork, rows, write, json } from '../src/infrastructure/mysql.ts';
import { consolePageSql } from '../src/infrastructure/mysql-read-pagination.ts';
import { ControlError } from '../src/framework/public.ts';
import { Identity } from '../src/modules/identity.ts';
import { Idempotency } from '../src/modules/idempotency.ts';
import { PathGroups, parsePathTemplate } from '../src/modules/path-owner/public.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import type { PathGroupConfig, PathGroupRevision, PathGroupBindingRecord } from '../src/modules/path-owner/public.ts';

type Statement=readonly [string,readonly unknown[]];
const hash='sha256:'+'a'.repeat(64),at=1800000000000,principal={actorId:'actor',governance:true},paging={page:2,limit:3,offset:3};
const config:PathGroupConfig={schemaVersion:1,kind:'backup-paths',candidates:[{candidateId:'first',template:{templateId:'template',revision:1,configDigest:hash}}]};
const record=(revision=1):PathGroupRevision=>({revision,config,configDigest:digest(config),createdBy:'actor',createdAt:at});
const selection={groupId:'group',revision:1,configDigest:digest(config),candidateId:'first'};
const appended:Omit<PathGroupBindingRecord,'sequence'>={...selection,pathBindingSequence:1,forwardRevision:1,expandedSpec:{opaque:true} as never,specDigest:hash,actorId:'actor',createdAt:at};
const native={n:'63',group_id:'group',owner_actor_id:'actor',current_revision:0,archived:2,revision:0,config:{opaque:true},config_digest:'bad',created_by:'bad/id',created_at:-1,
    sequence:0,group_revision:0,candidate_id:'first',path_binding_sequence:0,forward_revision:0,expanded_spec:{opaque:true},spec_digest:'bad',actor_id:'bad/id',id:'forward',spec:{opaque:true},recovery_suspended:2};
const projected={sequence:0,groupId:'group',revision:0,configDigest:'bad',candidateId:'first',pathBindingSequence:0,forwardRevision:0,expandedSpec:native.expanded_spec,specDigest:'bad',actorId:'bad/id',createdAt:-1};
const countSQL='SELECT COUNT(*) n FROM path_groups WHERE scope_id=?';
const headSQL='SELECT group_id,owner_actor_id,current_revision,archived FROM path_groups WHERE scope_id=? AND group_id=?';
const revisionSQL='SELECT revision,config,config_digest,created_by,created_at FROM path_group_revisions WHERE scope_id=? AND group_id=? AND revision=?';
const createSQL='INSERT INTO path_groups(scope_id,group_id,current_revision,owner_actor_id) VALUES(?,?,1,?)';
const immutableSQL='INSERT INTO path_group_revisions(scope_id,group_id,revision,config,config_digest,created_by,created_at) VALUES(?,?,?,?,?,?,?)';
const casSQL='UPDATE path_groups SET current_revision=? WHERE scope_id=? AND group_id=? AND current_revision=? AND archived=FALSE';
const auditSQL='INSERT INTO path_group_events(id,scope_id,group_id,actor_id,revision,kind,created_at) VALUES(?,?,?,?,?,?,?)';
const join=' FROM current_forward_path_group_bindings c JOIN forward_path_group_bindings b ON b.forward_id=c.forward_id AND b.sequence=c.sequence JOIN forwards f ON f.id=c.forward_id';
const filter=' WHERE f.scope_id=? AND b.scope_id=? AND b.group_id=? AND f.deleting=FALSE';
const currentSQL='SELECT b.*'+join+' WHERE f.scope_id=? AND b.scope_id=? AND f.id=?';
const historySQL='SELECT b.* FROM forward_path_group_bindings b JOIN forwards f ON f.id=b.forward_id WHERE f.scope_id=? AND b.scope_id=? AND f.id=? ORDER BY b.sequence LIMIT 64';
const maxSQL='SELECT COALESCE(MAX(sequence),0) n FROM forward_path_group_bindings WHERE forward_id=?';
const appendSQL='INSERT INTO forward_path_group_bindings(forward_id,sequence,scope_id,group_id,group_revision,config_digest,candidate_id,path_binding_sequence,forward_revision,expanded_spec,spec_digest,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)';
const pointerSQL='INSERT INTO current_forward_path_group_bindings(forward_id,sequence) VALUES(?,?) ON DUPLICATE KEY UPDATE sequence=VALUES(sequence)';
const detachSQL='DELETE c FROM current_forward_path_group_bindings c JOIN forward_path_group_bindings b ON b.forward_id=c.forward_id AND b.sequence=c.sequence WHERE c.forward_id=? AND b.scope_id=?';
type Groups=MySqlPathGroupStore<unknown>|MySqlPathGroups;
type Bindings=MySqlPathGroupBindingStore|MySqlPathGroupBindings;
type Case<S>={name:string;run:(s:S,t:Transaction)=>Promise<unknown>;sql:Statement[];result:unknown};
const groups:Case<Groups>[]=[
    {name:'scope',run:(s,t)=>s.lockScope(t,'scope'),sql:[['SELECT id FROM scopes WHERE id=? FOR UPDATE',['scope']]],result:undefined},
    {name:'count',run:(s,t)=>s.count(t,'scope'),sql:[[countSQL,['scope']]],result:'63'},
    ...[false,true].map(lock=>({name:'head '+lock,run:(s:Groups,t:Transaction)=>s.head(t,'scope','group',lock),sql:[[headSQL+(lock?' FOR UPDATE':''),['scope','group']]] as Statement[],result:{groupId:'group',currentRevision:0,archived:true,ownerActorId:'actor'}})),
    {name:'revision',run:(s,t)=>s.revision(t,'scope','group',0),sql:[[revisionSQL,['scope','group',0]]],result:{revision:0,config:native.config,configDigest:'bad',createdBy:'bad/id',createdAt:-1}},
    {name:'list',run:(s,t)=>s.list(t,'scope',principal,paging,'%'),sql:[['SELECT COUNT(*) n FROM path_groups WHERE scope_id=? AND LEFT(group_id,CHAR_LENGTH(?))=?',['scope','%','%']],['SELECT group_id,owner_actor_id,current_revision,archived FROM path_groups WHERE scope_id=? AND LEFT(group_id,CHAR_LENGTH(?))=? ORDER BY group_id LIMIT 3 OFFSET 3',['scope','%','%']]],result:{total:'63',items:[{groupId:'group',currentRevision:0,archived:true,ownerActorId:'actor'}]}},
    ...[1,2].map(revision=>({name:'publish '+revision,run:(s:Groups,t:Transaction)=>s.publish(t,'scope','group',record(revision)),sql:[...(revision===1?[[countSQL,['scope']] as Statement,[createSQL,['scope','group','actor']] as Statement]:[]),[immutableSQL,['scope','group',revision,JSON.stringify(config),digest(config),'actor',at]] as Statement,...(revision===1?[]:[[casSQL,[revision,'scope','group',revision-1]] as Statement])],result:undefined})),
    {name:'archive',run:(s,t)=>s.archive(t,'scope','group'),sql:[['UPDATE path_groups SET archived=TRUE WHERE scope_id=? AND group_id=?',['scope','group']]],result:undefined},
    {name:'audit',run:(s,t)=>s.audit(t,'scope','group','actor',2,'archive',at),sql:[[auditSQL,['$uuid','scope','group','actor',2,'archive',at]]],result:undefined}
];
const bindings:Case<Bindings>[]=[
    {name:'current',run:(s,t)=>s.current(t,'scope','forward'),sql:[[currentSQL,['scope','scope','forward']]],result:projected},
    {name:'history',run:(s,t)=>s.history(t,'scope','forward'),sql:[[historySQL,['scope','scope','forward']]],result:[projected]},
    ...[undefined,0,3].map(revision=>({name:'references '+revision,run:(s:Bindings,t:Transaction)=>s.references(t,'scope',principal,'group',paging,revision),sql:[['SELECT COUNT(*) n'+join+filter+(revision===undefined?'':' AND b.group_revision=?'),['scope','scope','group',...(revision===undefined?[]:[revision])]],['SELECT b.*,f.id,f.revision,f.spec,f.recovery_suspended'+join+filter+(revision===undefined?'':' AND b.group_revision=?')+' ORDER BY f.id LIMIT 3 OFFSET 3',['scope','scope','group',...(revision===undefined?[]:[revision])]]] as Statement[],result:{total:'63',items:[{forward:{id:'forward',scopeId:'scope',revision:0,spec:native.spec},recoverySuspended:true,binding:projected}]}})),
    {name:'append',run:(s,t)=>s.append(t,'scope','forward',appended),sql:[[maxSQL,['forward']],[appendSQL,['forward',64,'scope','group',1,digest(config),'first',1,1,JSON.stringify(appended.expandedSpec),hash,'actor',at]],[pointerSQL,['forward',64]]],result:{...appended,sequence:64}},
    {name:'detach',run:(s,t)=>s.detach(t,'scope','forward'),sql:[[detachSQL,['forward','scope']]],result:undefined}
];
function exact<S>(stores:S[],entry:Case<S>){test('57 '+entry.name+' lower and legacy preserve literal SQL raw values supplied receiver and each failure prefix',async()=>{
    for(const store of stores)for(const failAt of [-1,...entry.sql.map((_,index)=>index)]){
        const calls:Statement[]=[],failure=new Error('original SQL');let tx:Transaction;
        tx={async execute(this:unknown,sql:string,args:unknown[]=[]){assert.equal(this,tx);const copy=[...args];if(sql===auditSQL){assert.match(String(copy[0]),/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);copy[0]='$uuid';}calls.push([sql,copy]);if(calls.length-1===failAt)throw failure;return [sql.startsWith('SELECT')?[native]:{affectedRows:sql===casSQL?1:0},[]];}} as unknown as Transaction;
        if(failAt<0)assert.deepEqual(await entry.run(store,tx),entry.result);else await assert.rejects(entry.run(store,tx),e=>e===failure);
        assert.deepEqual(calls,entry.sql.slice(0,failAt<0?undefined:failAt+1));
    }
});}
for(const entry of groups)exact<Groups>([new MySqlPathGroupStore(),new MySqlPathGroups()],entry);
for(const entry of bindings)exact<Bindings>([new MySqlPathGroupBindingStore(),new MySqlPathGroupBindings()],entry);

test('57 raw null JSON Boolean pagination sequence and archived CAS edges refuse before later statements',async()=>{
    for(const store of [new MySqlPathGroupStore(),new MySqlPathGroups()]){
        const calls:string[]= [];let response:unknown[]=[],affected=1;
        const tx={async execute(sql:string){calls.push(sql);return [sql.startsWith('SELECT')?response:{affectedRows:affected},[]];}} as unknown as Transaction;
        assert.equal(await store.head(tx,'scope','id'),null);assert.equal(await store.revision(tx,'scope','id',1),null);await assert.rejects(store.count(tx,'scope'),TypeError);
        for(const value of [null,7,{bad:true},'null','7','{"bad":true}']){response=[{...native,config:value}];assert.deepEqual((await store.revision(tx,'scope','id',1))!.config,typeof value==='string'?JSON.parse(value):value);}
        response=[{...native,config:'malformed'}];await assert.rejects(store.revision(tx,'scope','id',1),SyntaxError);
        for(const archived of [0,1,2,null,'0']){response=[{...native,archived}];assert.equal((await store.head(tx,'scope','id'))!.archived,Boolean(archived));}
        response=[{n:64}];calls.length=0;await assert.rejects(store.publish(tx,'scope','id',record()),{code:'RESOURCE_LIMIT'});assert.deepEqual(calls,[countSQL]);
        for(const value of [0,2]){affected=value;calls.length=0;await assert.rejects(store.publish(tx,'scope','id',record(2)),{code:'REVISION_CONFLICT'});assert.deepEqual(calls,[immutableSQL,casSQL]);}
        calls.length=0;await assert.rejects(store.list(tx,'scope',principal,{page:1,limit:101,offset:0},'%'),{code:'INVALID_CONFIG'});assert.deepEqual(calls,['SELECT COUNT(*) n FROM path_groups WHERE scope_id=? AND LEFT(group_id,CHAR_LENGTH(?))=?']);
    }
    for(const store of [new MySqlPathGroupBindingStore(),new MySqlPathGroupBindings()]){
        let value:unknown=0;const calls:string[]=[];const tx={async execute(sql:string){calls.push(sql);return [sql.startsWith('SELECT')?[{n:value}]:{affectedRows:0},[]];}} as unknown as Transaction;
        for(const previous of [0,1,63,'0','1','63']){value=previous;calls.length=0;assert.equal((await store.append(tx,'scope','forward',appended)).sequence,Number(previous)+1);assert.deepEqual(calls,[maxSQL,appendSQL,pointerSQL]);}
        for(const previous of [undefined,null,NaN,Infinity,-1,0.5,'01','1.0','1e0',' 1','',{},'9007199254740992',9007199254740992]){value=previous;calls.length=0;await assert.rejects(store.append(tx,'scope','forward',appended),{code:'INTEGRITY_FAILURE'});assert.deepEqual(calls,[maxSQL]);}
        for(const previous of [64,'64',Number.MAX_SAFE_INTEGER]){value=previous;calls.length=0;await assert.rejects(store.append(tx,'scope','forward',appended),{code:'RESOURCE_LIMIT'});assert.deepEqual(calls,[maxSQL]);}
        const empty={async execute(){return [[],[]];}} as unknown as Transaction;assert.equal(await store.current(empty,'scope','forward'),null);assert.deepEqual(await store.history(empty,'scope','forward'),[]);
        let row:unknown=native;const lazy={async execute(sql:string){return [sql.startsWith('SELECT COUNT')?[{n:'2'}]:[row],[]];}} as unknown as Transaction;
        for(const input of [null,7,{bad:true},'null','7','{"bad":true}']){row={...native,expanded_spec:input};assert.deepEqual((await store.current(lazy,'scope','forward'))!.expandedSpec,typeof input==='string'?JSON.parse(input):input);}
        row={...native,expanded_spec:'malformed'};await assert.rejects(store.current(lazy,'scope','forward'),SyntaxError);
        for(const suspended of [0,1,2,null,'0']){row={...native,recovery_suspended:suspended};assert.equal((await store.references(lazy,'scope',principal,'group',paging)).items[0]!.recoverySuspended,Boolean(suspended));}
        const order:string[]=[];row=native;const badPage={async execute(sql:string){order.push(sql);return [[{n:0}],[]];}} as unknown as Transaction;await assert.rejects(store.references(badPage,'scope',principal,'group',{page:0,limit:1,offset:0},3),{code:'INVALID_CONFIG'});assert.deepEqual(order,['SELECT COUNT(*) n'+join+filter+' AND b.group_revision=?']);
    }
});

test('57 zeroarg singleton wrappers retain async prototypes and revision-one dynamic count override while native effects remain lazy',async()=>{
    function loaded(file:string,providers:Record<string,unknown>){const exports:Record<string,any>={},source=readFileSync(new URL('../src/infrastructure/'+file,import.meta.url),'utf8');new vm.Script(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText).runInNewContext({exports,require(name:string){assert.ok(Object.hasOwn(providers,name),name);return providers[name];}});return exports;}
    let groupConstructions=0,bindingConstructions=0;class GroupLower{constructor(){groupConstructions++;}}class BindingLower{constructor(){bindingConstructions++;}}
    const wrapper=loaded('mysql-path-groups.ts',{'./mysql-path-group-store.ts':{MySqlPathGroupStore:GroupLower,MySqlPathGroupBindingStore:BindingLower}});
    assert.equal(groupConstructions,1);assert.equal(bindingConstructions,1);assert.equal(wrapper.MySqlPathGroups.length,0);assert.equal(wrapper.MySqlPathGroupBindings.length,0);assert.equal(MySqlPathGroupStore.length,0);assert.equal(MySqlPathGroupBindingStore.length,0);const legacy=new wrapper.MySqlPathGroups(),binding=new wrapper.MySqlPathGroupBindings();assert.deepEqual(Object.keys(legacy),[]);assert.deepEqual(Object.keys(binding),[]);
    const tx={} as Transaction,groupArgs:Record<string,unknown[]>={lockScope:[tx,'scope'],count:[tx,'scope'],head:[tx,'scope','id'],revision:[tx,'scope','id',2],classifyOwner:[tx,'scope','id',2,'next-owner'],auditOwnership:[tx,'scope','id','actor','next-owner',2,at],list:[tx,'scope',principal,paging,'id'],publish:[tx,'scope','id',record()],archive:[tx,'scope','id'],audit:[tx,'scope','id','actor',1,'publish',at]};
    const bindingArgs:Record<string,unknown[]>={current:[tx,'scope','forward'],history:[tx,'scope','forward'],references:[tx,'scope',principal,'id',paging],append:[tx,'scope','forward',appended],detach:[tx,'scope','forward']};
    for(const [Ctor,Lower,object,args] of [[wrapper.MySqlPathGroups,GroupLower,legacy,groupArgs],[wrapper.MySqlPathGroupBindings,BindingLower,binding,bindingArgs]] as const)for(const [method,input] of Object.entries(args)){
        const expected={},failure=new Error(method);let captured:unknown[]=[];const descriptor=Object.getOwnPropertyDescriptor(Ctor.prototype,method)!;assert.equal(descriptor.enumerable,false);assert.equal(descriptor.configurable,true);assert.equal(descriptor.writable,true);assert.equal(descriptor.value.constructor.name,'AsyncFunction');
        Object.defineProperty(Lower.prototype,method,{configurable:true,value:function(this:unknown,...values:unknown[]){assert.ok(this instanceof Lower);captured=values;return expected;}});assert.equal(await object[method](...input),expected);
        if(method==='publish'){assert.deepEqual(captured.slice(0,4),input);assert.equal(typeof captured[4],'function');let count=0;object.count=async(...values:unknown[])=>{count++;assert.deepEqual(values,[tx,'scope']);return 17;};assert.equal(await (captured[4] as Function)(tx,'scope'),17);assert.equal(count,1);}
        else assert.deepEqual(captured,method==='head'?[...input,false]:method==='references'?[...input,undefined]:input);
        Object.defineProperty(Lower.prototype,method,{configurable:true,value(){throw failure;}});if(method==='count')delete object.count;await assert.rejects(object[method](...input),e=>e===failure);
    }
    const events:string[]=[],failure=new Error('UUID'),native=loaded('mysql-path-group-store.ts',{'node:crypto':{randomUUID(){events.push('uuid');throw failure;}},'../framework/public.ts':{ControlError},'./mysql-read-pagination.ts':{consolePageSql},'./mysql.ts':{rows,write,json}});
    assert.equal(events.length,0);const lower=new native.MySqlPathGroupStore();assert.equal(events.length,0);await assert.rejects(lower.audit(tx,'scope','id','actor',1,'publish',at),e=>e===failure);assert.deepEqual(events,['uuid']);
    for(const revision of [1,2]){let counts=0;const sql:string[]=[],realTx={async execute(text:string){sql.push(text);return [{affectedRows:1},[]];}} as unknown as Transaction;
        await new MySqlPathGroupStore().publish(realTx,'scope','id',record(revision),async(current,scope)=>{assert.equal(current,realTx);assert.equal(scope,'scope');counts++;return 0;});assert.equal(counts,revision===1?1:0);assert.deepEqual(sql,revision===1?[createSQL,immutableSQL]:[immutableSQL,casSQL]);}
    class Denied extends MySqlPathGroups{override async count():Promise<number>{throw failure;}}const deniedTx={async execute(){assert.fail('quota denial precedes SQL');}} as unknown as Transaction;await assert.rejects(new Denied().publish(deniedTx,'scope','id',record()),e=>e===failure);
});

test('57 publication config and provenance encoding retain exact lazy failure phases before immutable and pointer writes',async()=>{
    const failure=new Error('original native encoding');
    for(const store of [new MySqlPathGroupStore(),new MySqlPathGroups()])for(const revision of [1,2]){
        const events:string[]=[],tx={async execute(sql:string){events.push(sql);return [sql.startsWith('SELECT')?[{n:0}]:{affectedRows:1},[]];}} as unknown as Transaction;
        const value={...record(revision),get config(){events.push('config');return {toJSON(){events.push('encode');throw failure;}};}};
        await assert.rejects(store.publish(tx,'scope','group',value as never),error=>error===failure);assert.deepEqual(events,[...(revision===1?[countSQL,createSQL]:[]),'config','encode']);
    }
    for(const store of [new MySqlPathGroupBindingStore(),new MySqlPathGroupBindings()]){
        const events:string[]=[],tx={async execute(sql:string){events.push(sql);return [[{n:63}],[]];}} as unknown as Transaction;
        const value={...appended,get expandedSpec(){events.push('spec');return {toJSON(){events.push('encode');throw failure;}};}};
        await assert.rejects(store.append(tx,'scope','forward',value as never),error=>error===failure);assert.deepEqual(events,[maxSQL,'spec','encode']);
        events.length=0;const maximum={async execute(sql:string){events.push(sql);return [[{n:64}],[]];}} as unknown as Transaction;await assert.rejects(store.append(maximum,'scope','forward',value as never),{code:'RESOURCE_LIMIT'});assert.deepEqual(events,[maxSQL]);
    }
});

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
async function database(action:(db:MySqlUnitOfWork)=>Promise<void>){const admin=await createConnection(databaseURL!),name='tunex_path_group_'+randomUUID().replaceAll('-',''),url=new URL(databaseURL!);url.pathname='/'+name;const db=new MySqlUnitOfWork(url.toString());let created=false;try{await admin.query(`CREATE DATABASE \`${name}\``);created=true;await db.migrate();await new Identity(db).bootstrap('scope','actor','a'.repeat(32));await action(db);}finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${name}\``);}finally{await admin.end();}}}
async function snapshot(db:MySqlUnitOfWork){const tables=await rows<Record<string,string>>(db.pool,'SHOW TABLES');return Object.fromEntries(await Promise.all(tables.map(async row=>{const name=Object.values(row)[0]!,values=await rows<Record<string,unknown>>(db.pool,`SELECT * FROM \`${name}\``);return [name,values.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))];})));}

test('57 canonical MySQL command locks quotas CAS original idempotency and every write rollback preserve all tables',{skip:!databaseURL},async()=>{
    await database(async db=>{
        const templates=new MySqlPathTemplates(),store=new MySqlPathGroups(),template=parsePathTemplate({version:1,protocols:['tcp'],nodes:['ingress','egress'],endpoints:[{nodeId:'egress',revision:1}],transport:{profileId:'profile',configRevision:1}}),templateDigest=digest({config:template,profileDigest:hash});
        await db.transaction(tx=>templates.publish(tx,'scope','template',{revision:1,config:template,profileDigest:hash,configDigest:templateDigest,createdBy:'actor',createdAt:at}));
        const groupConfig={...config,candidates:[{candidateId:'first',template:{templateId:'template',revision:1,configDigest:templateDigest}}]},failure=new Error('after original write');let failAt=-1,writes=0,transactions=0;const sql:string[]=[];
        const boundary={transaction<T>(action:(tx:Transaction)=>Promise<T>){transactions++;return db.transaction(tx=>action(new Proxy(tx,{get(target,key){if(key==='execute')return async(text:string,args:unknown[]=[])=>(sql.push(text),await Reflect.apply(target.execute,target,[text,args]).then((result:unknown)=>{if(!text.startsWith('SELECT')&&writes++===failAt)throw failure;return result;}));return Reflect.get(target,key);}})));}};
        const groups=new PathGroups(boundary,new Identity(db),new ResourceAccess(new Identity(db),new MySqlResourceAccessStore()),new Idempotency(),store,templates,{async validate(){return {profileDigest:hash};}},new MySqlPathGroupBindings(),{async record(){throw Error('unused');}},{async previewIn(){throw Error('unused');}},new MySqlPathBindings(),()=>at);
        async function everyWrite(action:()=>Promise<unknown>,count:number){const before=await snapshot(db);for(let n=0;n<count;n++){failAt=n;writes=0;transactions=0;await assert.rejects(action(),e=>e===failure);assert.equal(writes,n+1);assert.equal(transactions,1);assert.deepEqual(await snapshot(db),before);}failAt=-1;writes=0;transactions=0;sql.length=0;const result=await action();assert.equal(writes,count);assert.equal(transactions,1);return result;}
        await everyWrite(()=>groups.publish('actor','scope','group','first',0,groupConfig),5);const auth=sql.indexOf('SELECT can_manage FROM scope_members WHERE scope_id=? AND actor_id=? AND active=TRUE FOR SHARE'),scope=sql.indexOf('SELECT id FROM scopes WHERE id=? FOR UPDATE'),head=sql.indexOf(headSQL+' FOR UPDATE');assert.ok(auth>=0&&auth<scope&&scope<head&&head<sql.indexOf(countSQL));assert.equal(sql.filter(text=>text===countSQL).length,2);
        const saved=await snapshot(db);assert.equal((await groups.publish('actor','scope','group','noop',1,groupConfig)).status,200);const noop=await snapshot(db);for(const table of Object.keys(saved))if(table!=='idempotency')assert.deepEqual(noop[table],saved[table]);
        const next={...groupConfig,kind:'egress-candidates' as const};await everyWrite(()=>groups.publish('actor','scope','group','next',1,next),5);await everyWrite(()=>groups.archive('actor','scope','group','archive',2),4);
        const archived=await snapshot(db);await assert.rejects(groups.publish('actor','scope','group','reuse',2,next),{code:'GROUP_ARCHIVED'});assert.deepEqual(await snapshot(db),archived);assert.equal((await groups.get('actor','scope','group',1)).archived,true);
    });
});

test('57 canonical MySQL group provenance original Forward lock serialized sequences rollback pointer-only detach and read committed page',{skip:!databaseURL},async()=>{
    await database(async db=>{
        const templates=new MySqlPathTemplates(),groups=new MySqlPathGroups(),paths=new MySqlPathBindings(),bindings=new MySqlPathGroupBindings(),template=parsePathTemplate({version:1,protocols:['tcp'],nodes:['ingress','egress'],endpoints:[{nodeId:'egress',revision:1}],transport:{profileId:'profile',configRevision:1}}),templateDigest=digest({config:template,profileDigest:hash});
        const parsed=parseForwardSpec({enabled:false,protocols:['tcp'],ingress:{nodeId:'ingress',listen:{address:'127.0.0.1',port:32001}},target:{host:'127.0.0.1',port:9000},path:{via:['egress']},transport:template.transport});assert.ok(parsed.ok);if(!parsed.ok)throw Error('fixture');
        const groupConfig={...config,candidates:[{candidateId:'first',template:{templateId:'template',revision:1,configDigest:templateDigest}}]},valid={...appended,configDigest:digest(groupConfig),expandedSpec:parsed.value,specDigest:digest(parsed.value)};
        await db.transaction(async tx=>{await templates.publish(tx,'scope','template',{revision:1,config:template,profileDigest:hash,configDigest:templateDigest,createdBy:'actor',createdAt:at});await groups.publish(tx,'scope','group',{...record(),config:groupConfig,configDigest:digest(groupConfig)});await write(tx,'INSERT INTO forwards(id,scope_id,revision,spec,authorization_actor,owner_actor_id) VALUES(?,?,1,?,?,?)',['forward','scope',JSON.stringify(parsed.value),'actor','actor']);await write(tx,'INSERT INTO forward_revisions(forward_id,revision,spec) VALUES(?,1,?)',['forward',JSON.stringify(parsed.value)]);await paths.append(tx,'scope','forward',{templateId:'template',revision:1,configDigest:templateDigest,forwardRevision:1,expandedSpec:parsed.value,specDigest:digest(parsed.value),actorId:'actor',createdAt:at});});
        const failure=new Error('post-write'),before=await snapshot(db);for(const n of [0,1]){let writes=0;await assert.rejects(db.transaction(async tx=>{await rows(tx,'SELECT id FROM forwards WHERE scope_id=? AND id=? FOR UPDATE',['scope','forward']);return bindings.append(new Proxy(tx,{get(target,key){if(key==='execute')return async(sql:string,args:unknown[]=[])=>(await Reflect.apply(target.execute,target,[sql,args]).then((result:unknown)=>{if(!sql.startsWith('SELECT')&&writes++===n)throw failure;return result;}));return Reflect.get(target,key);}}),'scope','forward',valid);}),e=>e===failure);assert.equal(writes,n+1);assert.deepEqual(await snapshot(db),before);}
        const append=()=>db.transaction(async tx=>{await rows(tx,'SELECT id FROM forwards WHERE scope_id=? AND id=? FOR UPDATE',['scope','forward']);return bindings.append(tx,'scope','forward',valid);});assert.equal((await append()).sequence,1);assert.deepEqual((await Promise.all([append(),append()])).map(item=>item.sequence).sort(),[2,3]);
        let changed=false;const page=await db.transaction(tx=>bindings.references(new Proxy(tx,{get(target,key){if(key==='execute')return async(sql:string,args:unknown[]=[])=>(await Reflect.apply(target.execute,target,[sql,args]).then(async(result:unknown)=>{if(sql.startsWith('SELECT COUNT')&&!changed){changed=true;await db.transaction(other=>write(other,'UPDATE forwards SET deleting=TRUE WHERE id=?',['forward']));}return result;}));return Reflect.get(target,key);}}),'scope',principal,'group',{page:1,limit:100,offset:0},1));assert.equal(page.total,1);assert.deepEqual(page.items,[]);assert.equal(changed,true);
        const saved=await snapshot(db);await db.transaction(tx=>bindings.detach(tx,'other-scope','forward'));assert.deepEqual(await snapshot(db),saved);await assert.rejects(db.transaction(async tx=>{await bindings.detach(tx,'scope','forward');throw failure;}),e=>e===failure);assert.deepEqual(await snapshot(db),saved);
        await db.transaction(tx=>bindings.detach(tx,'scope','forward'));assert.equal(await db.transaction(tx=>bindings.current(tx,'scope','forward')),null);assert.equal((await db.transaction(tx=>bindings.history(tx,'scope','forward'))).length,3);assert.equal((await db.transaction(tx=>paths.history(tx,'scope','forward'))).length,1);const detached=await snapshot(db);for(const table of Object.keys(saved))if(table!=='current_forward_path_group_bindings')assert.deepEqual(detached[table],saved[table],table);
    });
});


test('path group lists and binding references apply owner filters before pagination',async()=>{
 for(const store of [new MySqlPathGroupStore(),new MySqlPathGroups()]){
  const calls:Statement[]=[],tx={async execute(sql:string,args:unknown[]){calls.push([sql,args]);return [sql.startsWith('SELECT COUNT')?[{n:0}]:[],[]];}} as unknown as Transaction;
  await store.list(tx,'scope',{actorId:'actor',governance:false},paging,'pre');
  const filter='scope_id=? AND LEFT(group_id,CHAR_LENGTH(?))=? AND owner_actor_id=?';
  assert.deepEqual(calls,[['SELECT COUNT(*) n FROM path_groups WHERE '+filter,['scope','pre','pre','actor']],['SELECT group_id,owner_actor_id,current_revision,archived FROM path_groups WHERE '+filter+' ORDER BY group_id LIMIT 3 OFFSET 3',['scope','pre','pre','actor']]]);
 }
 for(const store of [new MySqlPathGroupBindingStore(),new MySqlPathGroupBindings()]){
  const calls:Statement[]=[],tx={async execute(sql:string,args:unknown[]){calls.push([sql,args]);return [sql.startsWith('SELECT COUNT')?[{n:0}]:[],[]];}} as unknown as Transaction;
  await store.references(tx,'scope',{actorId:'actor',governance:false},'group',paging,3);
  assert.deepEqual(calls,[['SELECT COUNT(*) n'+join+filter+' AND f.owner_actor_id=? AND b.group_revision=?',['scope','scope','group','actor',3]],['SELECT b.*,f.id,f.revision,f.spec,f.recovery_suspended'+join+filter+' AND f.owner_actor_id=? AND b.group_revision=? ORDER BY f.id LIMIT 3 OFFSET 3',['scope','scope','group','actor',3]]]);
 }
});


test('path group classification forwards original row-count CAS and ownership audit parameters',async()=>{
 for(const store of [new MySqlPathGroupStore(),new MySqlPathGroups()])for(const affected of [0,1,2]){
  const calls:Statement[]=[],tx={async execute(sql:string,args:unknown[]){calls.push([sql,args]);return [{affectedRows:affected},[]];}} as unknown as Transaction;
  assert.equal(await store.classifyOwner(tx,'scope','group',2,'next-owner'),affected);
  assert.deepEqual(calls,[['UPDATE path_groups SET owner_actor_id=? WHERE scope_id=? AND group_id=? AND current_revision=? AND owner_actor_id IS NULL',['next-owner','scope','group',2]]]);
  calls.length=0;await store.auditOwnership(tx,'scope','group','actor','next-owner',2,at);
  assert.equal(calls[0]![0],"INSERT INTO path_group_events(id,scope_id,group_id,actor_id,owner_actor_id,revision,kind,created_at) VALUES(?,?,?,?,?,?,'classify-owner',?)");
  assert.match(calls[0]![1][0] as string,/^[0-9a-f-]{36}$/);assert.deepEqual(calls[0]![1].slice(1),['scope','group','actor','next-owner',2,at]);
 }
});
