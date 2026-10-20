import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createConnection } from 'mysql2/promise';
import { digest } from '@tunex/contracts/shared';
import { parseForwardSpec } from '@tunex/core';
import { MySqlPathBindingStore } from '../src/infrastructure/mysql-path-binding-store.ts';
import { MySqlPathBindings } from '../src/infrastructure/mysql-path-bindings.ts';
import { MySqlPathTemplates } from '../src/infrastructure/mysql-path-templates.ts';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import { Identity } from '../src/modules/identity.ts';
import { parsePathTemplate } from '../src/modules/path-owner/public.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import type { PathBindingStoredRecord } from '../src/framework/public.ts';

type Statement=readonly [string,readonly unknown[]];
const hash='sha256:'+'a'.repeat(64),at=1800000000000;
const join=' FROM current_path_bindings c JOIN forward_path_bindings b ON b.forward_id=c.forward_id AND b.sequence=c.sequence JOIN forwards f ON f.id=c.forward_id';
const filter=' WHERE f.scope_id=? AND b.scope_id=? AND b.template_id=? AND f.deleting=FALSE';
const atSQL='SELECT b.* FROM forward_path_bindings b JOIN forwards f ON f.id=b.forward_id WHERE f.scope_id=? AND b.scope_id=? AND f.id=? AND b.sequence=?';
const currentSQL='SELECT b.*'+join+' WHERE f.scope_id=? AND b.scope_id=? AND f.id=?';
const historySQL='SELECT b.* FROM forward_path_bindings b JOIN forwards f ON f.id=b.forward_id WHERE f.scope_id=? AND b.scope_id=? AND f.id=? ORDER BY b.sequence';
const maximumSQL='SELECT COALESCE(MAX(sequence),0) n FROM forward_path_bindings WHERE forward_id=?';
const appendSQL='INSERT INTO forward_path_bindings(forward_id,sequence,scope_id,template_id,template_revision,config_digest,forward_revision,expanded_spec,spec_digest,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)';
const pointerSQL='INSERT INTO current_path_bindings(forward_id,sequence) VALUES(?,?) ON DUPLICATE KEY UPDATE sequence=VALUES(sequence)';
const detachSQL='DELETE c FROM current_path_bindings c JOIN forward_path_bindings b ON b.forward_id=c.forward_id AND b.sequence=c.sequence WHERE c.forward_id=? AND b.scope_id=?';
const opaque={not:'product validated'},native={n:'63',sequence:0,template_id:'template',template_revision:0,config_digest:'bad',forward_revision:0,
    expanded_spec:opaque,spec_digest:'bad spec',actor_id:'bad/id',created_at:-1,id:'forward',revision:0,spec:opaque,recovery_suspended:2};
const projected={sequence:0,templateId:'template',revision:0,configDigest:'bad',forwardRevision:0,expandedSpec:opaque,specDigest:'bad spec',actorId:'bad/id',createdAt:-1};
const record:Omit<PathBindingStoredRecord,'sequence'>={templateId:'template',revision:1,configDigest:hash,forwardRevision:1,expandedSpec:opaque as never,specDigest:hash,actorId:'actor',createdAt:at};
type Store=MySqlPathBindingStore|MySqlPathBindings;
type Case={name:string;run:(store:Store,tx:Transaction)=>Promise<unknown>;statements:Statement[];result:unknown};
const cases:Case[]=[
    {name:'at',run:(s,t)=>s.at(t,'scope','forward',7),statements:[[atSQL,['scope','scope','forward',7]]],result:projected},
    {name:'current',run:(s,t)=>s.current(t,'scope','forward'),statements:[[currentSQL,['scope','scope','forward']]],result:projected},
    {name:'history',run:(s,t)=>s.history(t,'scope','forward'),statements:[[historySQL,['scope','scope','forward']]],result:[projected]},
    ...[undefined,0,3].map(revision=>({name:'references '+revision,run:(s:Store,t:Transaction)=>s.references(t,'scope','template',{page:2,limit:3,offset:3},revision),
        statements:[['SELECT COUNT(*) n'+join+filter+(revision===undefined?'':' AND b.template_revision=?'),['scope','scope','template',...(revision===undefined?[]:[revision])]],
            ['SELECT b.*,f.id,f.revision,f.spec,f.recovery_suspended'+join+filter+(revision===undefined?'':' AND b.template_revision=?')+' ORDER BY f.id LIMIT 3 OFFSET 3',['scope','scope','template',...(revision===undefined?[]:[revision])]]] as Statement[],
        result:{total:'63',items:[{forward:{id:'forward',scopeId:'scope',revision:0,spec:opaque},recoverySuspended:true,binding:projected}]}})),
    {name:'append maximum63',run:(s,t)=>s.append(t,'scope','forward',record),statements:[[maximumSQL,['forward']],
        [appendSQL,['forward',64,'scope','template',1,hash,1,JSON.stringify(opaque),hash,'actor',at]],[pointerSQL,['forward',64]]],result:{...record,sequence:64}},
    {name:'detach pointer',run:(s,t)=>s.detach(t,'scope','forward'),statements:[[detachSQL,['forward','scope']]],result:undefined}
];
for(const entry of cases)test('56 PathBinding lower and legacy '+entry.name+' exact original SQL supplied receiver raw values and every first-error cutoff',async()=>{
    for(const store of [new MySqlPathBindingStore(),new MySqlPathBindings()])for(const failAt of [-1,...entry.statements.map((_,index)=>index)]){
        const calls:Statement[]=[],failure=new Error('original statement');let tx:Transaction;
        tx={async execute(this:unknown,sql:string,args:unknown[]=[]){assert.equal(this,tx);calls.push([sql,[...args]]);if(calls.length-1===failAt)throw failure;return [sql.startsWith('SELECT')?[native]:{affectedRows:0},[]];}} as unknown as Transaction;
        if(failAt<0){const result=await entry.run(store,tx);assert.deepEqual(result,entry.result);if(entry.name==='append maximum63')assert.equal((result as typeof record).expandedSpec,opaque);}
        else await assert.rejects(entry.run(store,tx),error=>error===failure);
        assert.deepEqual(calls,entry.statements.slice(0,failAt<0?undefined:failAt+1));
    }
});

test('56 original nullable JSON Boolean count-before-page and zeroarg async wrapper semantics remain unchanged',async()=>{
    for(const store of [new MySqlPathBindingStore(),new MySqlPathBindings()]){
        let response:unknown[]=[];const calls:Statement[]=[];
        const tx={async execute(sql:string,args:unknown[]=[]){calls.push([sql,[...args]]);return [response,[]];}} as unknown as Transaction;
        assert.equal(await store.at(tx,'scope','forward',1),null);assert.equal(await store.current(tx,'scope','forward'),null);assert.deepEqual(await store.history(tx,'scope','forward'),[]);
        for(const value of [opaque,null,7,'{"opaque":true}','null','7']){response=[{...native,expanded_spec:value}];assert.deepEqual((await store.current(tx,'scope','forward'))!.expandedSpec,typeof value==='string'?JSON.parse(value):value);}
        response=[{...native,expanded_spec:'bad JSON'}];await assert.rejects(store.history(tx,'scope','forward'),SyntaxError);
        for(const paging of [{page:0,limit:1,offset:0},{page:10001,limit:1,offset:10000},{page:1,limit:101,offset:0},{page:1,limit:1,offset:1}]){
            response=[{n:0}];calls.length=0;await assert.rejects(store.references(tx,'scope','template',paging),{code:'INVALID_CONFIG'});
            assert.deepEqual(calls,[['SELECT COUNT(*) n'+join+filter,['scope','scope','template']]]);
        }
        response=[];await assert.rejects(store.references(tx,'scope','template',{page:1,limit:1,offset:0}),TypeError);
        for(const recovery_suspended of [0,1,2,null,'0']){
            response=[{...native,recovery_suspended}];assert.equal((await store.references(tx,'scope','template',{page:1,limit:1,offset:0})).items[0]!.recoverySuspended,Boolean(recovery_suspended));
        }
    }
    const source=readFileSync(new URL('../src/infrastructure/mysql-path-bindings.ts',import.meta.url),'utf8');
    const exports:Record<string,any>={},calls:unknown[][]=[];let constructions=0;
    class Lower {constructor(){constructions++;}}
    const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
    new vm.Script(javascript).runInNewContext({exports,require(name:string){assert.equal(name,'./mysql-path-binding-store.ts');return {MySqlPathBindingStore:Lower};}});
    assert.equal(constructions,1);const legacy=new exports.MySqlPathBindings();assert.equal(constructions,1);assert.deepEqual(Object.keys(legacy),[]);
    const args:Record<string,unknown[]>={at:[{},'scope','forward',3],current:[{},'scope','forward'],history:[{},'scope','forward'],references:[{},'scope','template',{page:1,limit:1,offset:0}],append:[{},'scope','forward',record],detach:[{},'scope','forward']};
    for(const [method,input] of Object.entries(args)){
        const expected={method},failure=new Error(method),descriptor=Object.getOwnPropertyDescriptor(exports.MySqlPathBindings.prototype,method)!;
        assert.equal(descriptor.enumerable,false);assert.equal(descriptor.configurable,true);assert.equal(descriptor.writable,true);assert.equal(descriptor.value.constructor.name,'AsyncFunction');
        Object.defineProperty(Lower.prototype,method,{configurable:true,value:function(this:unknown,...values:unknown[]){assert.ok(this instanceof Lower);calls.push(values);return expected;}});
        assert.equal(await legacy[method](...input),expected);assert.deepEqual(calls.at(-1),method==='references'?[...input,undefined]:input);
        Object.defineProperty(Lower.prototype,method,{configurable:true,value(){throw failure;}});await assert.rejects(legacy[method](...input),error=>error===failure);
    }
    assert.equal(MySqlPathBindingStore.length,0);assert.equal(MySqlPathBindings.length,0);assert.equal(exports.MySqlPathBindings.length,0);
    class Override extends MySqlPathBindings {override async history(){return [];}}
    assert.deepEqual(await new Override().history(),[]);
});

test('56 original sequence conversion refuses corruption before encoding and serializes before pointer write with original getter/spread order',async()=>{
    for(const store of [new MySqlPathBindingStore(),new MySqlPathBindings()]){
        const calls:string[]=[],failure=new Error('encoding failed');let maximum:unknown=0;
        const tx={async execute(sql:string){calls.push(sql);return [sql.startsWith('SELECT')?[{n:maximum}]:{affectedRows:0},[]];}} as unknown as Transaction;
        const value={...record,get expandedSpec(){calls.push('expandedSpec');return {toJSON(){calls.push('toJSON');throw failure;}};}};
        for(const bad of [-1,1.5,NaN,Infinity,null,undefined,true,'','01','1.0','1e1','+1','-0','1\n','9007199254740992']){
            maximum=bad;calls.length=0;await assert.rejects(store.append(tx,'scope','forward',value as never),{code:'INTEGRITY_FAILURE'});assert.deepEqual(calls,[maximumSQL]);
        }
        for(const full of [64,'64',65,'65',Number.MAX_SAFE_INTEGER]){maximum=full;calls.length=0;await assert.rejects(store.append(tx,'scope','forward',value as never),{code:'RESOURCE_LIMIT'});assert.deepEqual(calls,[maximumSQL]);}
        maximum=0;calls.length=0;await assert.rejects(store.append(tx,'scope','forward',value as never),error=>error===failure);assert.deepEqual(calls,[maximumSQL,'expandedSpec','toJSON']);
        let reads=0;const input={...record,get expandedSpec(){reads++;return opaque as never;}};
        calls.length=0;const result=await store.append(tx,'scope','forward',input);assert.equal(reads,2);assert.equal(result.expandedSpec,opaque);assert.deepEqual(Object.keys(result),[...Object.keys(record),'sequence']);assert.deepEqual(calls,[maximumSQL,appendSQL,pointerSQL]);
    }
});

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
async function withDatabase(action:(db:MySqlUnitOfWork)=>Promise<void>){
    const admin=await createConnection(databaseURL!),name='tunex_path_binding_'+randomUUID().replaceAll('-',''),url=new URL(databaseURL!);url.pathname='/'+name;
    const db=new MySqlUnitOfWork(url.toString());let created=false;
    try{await admin.query(`CREATE DATABASE \`${name}\``);created=true;await db.migrate();await new Identity(db).bootstrap('scope','actor','a'.repeat(32));await action(db);}
    finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${name}\``);}finally{await admin.end();}}
}
async function snapshot(db:MySqlUnitOfWork){
    const tables=await rows<Record<string,string>>(db.pool,'SHOW TABLES');return Object.fromEntries(await Promise.all(tables.map(async row=>{
        const name=Object.values(row)[0]!,values=await rows<Record<string,unknown>>(db.pool,`SELECT * FROM \`${name}\``);return [name,values.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))];
    })));
}
test('56 real MySQL original Forward lock append and detach retain every immutable row and roll back each original write failure',{skip:!databaseURL},async()=>{
    await withDatabase(async db=>{
        const templates=new MySqlPathTemplates(),store=new MySqlPathBindings(),config=parsePathTemplate({version:1,protocols:['tcp'],nodes:['ingress','egress'],endpoints:[{nodeId:'egress',revision:1}],transport:{profileId:'profile',configRevision:1}});
        const spec=parseForwardSpec({enabled:false,protocols:['tcp'],ingress:{nodeId:'ingress',listen:{address:'127.0.0.1',port:32001}},target:{host:'127.0.0.1',port:9000},path:{via:['egress']},transport:config.transport});assert.equal(spec.ok,true);if(!spec.ok)throw Error('fixture');
        await db.transaction(async tx=>{await templates.publish(tx,'scope','template',{revision:1,config,profileDigest:hash,configDigest:digest({config,profileDigest:hash}),createdBy:'actor',createdAt:at});
            await write(tx,'INSERT INTO forwards(id,scope_id,revision,spec,authorization_actor) VALUES(?,?,1,?,?)',['forward','scope',JSON.stringify(spec.value),'actor']);
            await write(tx,'INSERT INTO forward_revisions(forward_id,revision,spec) VALUES(?,1,?)',['forward',JSON.stringify(spec.value)]);
        });
        const valid={...record,configDigest:digest({config,profileDigest:hash}),expandedSpec:spec.value,specDigest:digest(spec.value)},failure=new Error('after original write');
        const before=await snapshot(db);
        for(const failAt of [0,1]){
            let writes=0;await assert.rejects(db.transaction(async tx=>{await rows(tx,'SELECT id FROM forwards WHERE scope_id=? AND id=? FOR UPDATE',['scope','forward']);
                const supplied=new Proxy(tx,{get(target,key){if(key==='execute')return async(sql:string,args:unknown[]=[])=>(await Reflect.apply(target.execute,target,[sql,args]).then((result:unknown)=>{if(!sql.startsWith('SELECT')&&writes++===failAt)throw failure;return result;}));return Reflect.get(target,key);}});
                await store.append(supplied,'scope','forward',valid);
            }),error=>error===failure);assert.equal(writes,failAt+1);assert.deepEqual(await snapshot(db),before);
        }
        const append=()=>db.transaction(async tx=>{await rows(tx,'SELECT id FROM forwards WHERE scope_id=? AND id=? FOR UPDATE',['scope','forward']);return store.append(tx,'scope','forward',valid);});
        assert.equal((await append()).sequence,1);const concurrent=await Promise.all([append(),append()]);assert.deepEqual(concurrent.map(value=>value.sequence).sort(),[2,3]);
        let changed=false;const page=await db.transaction(tx=>store.references(new Proxy(tx,{get(target,key){if(key==='execute')return async(sql:string,args:unknown[]=[])=>(await Reflect.apply(target.execute,target,[sql,args]).then(async(result:unknown)=>{if(sql.startsWith('SELECT COUNT')&&!changed){changed=true;await db.transaction(other=>write(other,'UPDATE forwards SET deleting=TRUE WHERE id=?',['forward']));}return result;}));return Reflect.get(target,key);}}),'scope','template',{page:1,limit:100,offset:0}));
        assert.equal(changed,true);assert.equal(page.total,1);assert.deepEqual(page.items,[]);await db.transaction(tx=>write(tx,'UPDATE forwards SET deleting=FALSE WHERE id=?',['forward']));
        const saved=await snapshot(db);await assert.rejects(db.transaction(async tx=>{await rows(tx,'SELECT id FROM forwards WHERE scope_id=? AND id=? FOR UPDATE',['scope','forward']);await store.detach(tx,'scope','forward');throw failure;}),error=>error===failure);assert.deepEqual(await snapshot(db),saved);
        await db.transaction(tx=>store.detach(tx,'other-scope','forward'));assert.deepEqual(await snapshot(db),saved);
        await db.transaction(tx=>store.detach(tx,'scope','forward'));assert.equal(await db.transaction(tx=>store.current(tx,'scope','forward')),null);assert.equal((await db.transaction(tx=>store.history(tx,'scope','forward'))).length,3);
        const detached=await snapshot(db);for(const table of Object.keys(saved))if(table!=='current_path_bindings')assert.deepEqual(detached[table],saved[table],table+' immutable/protected');
        assert.equal(await db.transaction(tx=>store.at(tx,'other-scope','forward',1)),null);
    });
});
