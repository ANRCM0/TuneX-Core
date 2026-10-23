import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'mysql2/promise';
import { IdentityService } from '../src/modules/identity-owner/public.ts';
import { nativeIdentityCodec } from '../src/compatibility/public.ts';
import { nativeNodeSecrets, tokenHash } from '../src/infrastructure/identity-secrets.ts';
import { MySqlIdentityStore, MySqlIdentityAccountLookup } from '../src/infrastructure/mysql-identity.ts';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

type Statement=readonly [string,readonly unknown[]];
const raw={id:'actor',can_manage:7,owner_id:'owner',revision:9,active:3,token_hash:'original-hash',actor_id:'subject',extra:'native'};
type Case={name:string;run:(s:MySqlIdentityStore,tx:Transaction)=>Promise<unknown>;sql:Statement;expected?:unknown;empty?:unknown;identity?:boolean};
const cases:Case[]=[
 {name:'recoveryAccounts',run:(s,t)=>s.recoveryAccounts(t),sql:['SELECT a.id,EXISTS(SELECT 1 FROM scopes s WHERE s.owner_id=a.id) owner FROM accounts a ORDER BY a.id FOR UPDATE',[]],expected:[raw],empty:[],identity:true},
 {name:'replaceToken',run:(s,t)=>s.replaceToken(t,'actor','hash'),sql:['UPDATE accounts SET token_hash=? WHERE id=?',['hash','actor']]},
 {name:'deactivateNonOwners',run:(s,t)=>s.deactivateNonOwners(t),sql:['UPDATE scope_members m JOIN scopes s ON s.id=m.scope_id SET m.active=FALSE,m.can_manage=FALSE WHERE m.actor_id<>s.owner_id',[]]},
 {name:'insertAccount',run:(s,t)=>s.insertAccount(t,'actor','hash'),sql:['INSERT INTO accounts(id,token_hash) VALUES(?,?)',['actor','hash']]},
 {name:'insertMemberAccount',run:(s,t)=>s.insertMemberAccount(t,'actor','hash'),sql:['INSERT INTO accounts(id,token_hash) VALUES(?,?)',['actor','hash']]},
 {name:'createScope',run:(s,t)=>s.createScope(t,'scope','owner'),sql:['INSERT INTO scopes(id,owner_id) VALUES(?,?)',['scope','owner']]},
 {name:'addOwner',run:(s,t)=>s.addOwner(t,'scope','owner'),sql:['INSERT INTO scope_members(scope_id,actor_id,can_manage) VALUES(?,?,TRUE)',['scope','owner']]},
 {name:'accountByToken',run:(s,t)=>s.accountByToken(t,'hash'),sql:['SELECT id FROM accounts WHERE token_hash=?',['hash']],expected:raw,identity:true},
 {name:'activeMembership',run:(s,t)=>s.activeMembership(t,'scope','actor'),sql:['SELECT can_manage FROM scope_members WHERE scope_id=? AND actor_id=? AND active=TRUE FOR SHARE',['scope','actor']],expected:{canManage:7}},
 {name:'ownerForShare',run:(s,t)=>s.ownerForShare(t,'scope'),sql:['SELECT owner_id FROM scopes WHERE id=? FOR SHARE',['scope']],expected:{ownerId:'owner'}},
 {name:'ownerForUpdate',run:(s,t)=>s.ownerForUpdate(t,'scope'),sql:['SELECT owner_id FROM scopes WHERE id=? FOR UPDATE',['scope']],expected:{ownerId:'owner'}},
 {name:'executionMembershipCount',run:(s,t)=>s.executionMembershipCount(t,'scope','actor'),sql:['SELECT actor_id FROM scope_members WHERE scope_id=? AND actor_id=? AND active=TRUE AND can_manage=TRUE FOR SHARE',['scope','actor']],expected:1,empty:0},
 {name:'memberForUpdate',run:(s,t)=>s.memberForUpdate(t,'scope','actor'),sql:['SELECT revision,active,can_manage FROM scope_members WHERE scope_id=? AND actor_id=? FOR UPDATE',['scope','actor']],expected:{revision:9,active:3,canManage:7}},
 {name:'accountForShare',run:(s,t)=>s.accountForShare(t,'actor'),sql:['SELECT token_hash FROM accounts WHERE id=? FOR SHARE',['actor']],expected:{tokenHash:'original-hash'}},
 {name:'saveMember',run:(s,t)=>s.saveMember(t,'scope','actor',false,true,5),sql:['INSERT INTO scope_members(scope_id,actor_id,can_manage,active,revision) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE can_manage=VALUES(can_manage),active=VALUES(active),revision=VALUES(revision)',['scope','actor',false,true,5]]},
 {name:'audit',run:(s,t)=>s.audit(t,'id','scope','actor','subject','member_change',5,123,{b:2,a:1}),sql:['INSERT INTO access_events(id,scope_id,actor_id,subject_id,kind,revision,created_at,details) VALUES(?,?,?,?,?,?,?,?)',['id','scope','actor','subject','member_change',5,123,'{"b":2,"a":1}']]},
 {name:'listMembers',run:(s,t)=>s.listMembers(t,'scope'),sql:['SELECT m.*,s.owner_id FROM scope_members m JOIN scopes s ON s.id=m.scope_id WHERE m.scope_id=? ORDER BY m.actor_id',['scope']],expected:[{actorId:'subject',canManage:7,active:3,revision:9,ownerId:'owner'}],empty:[]},
];
for(const entry of cases)test('20 native Identity SQL '+entry.name+' keeps literal locks arguments raw projection receiver empty and original query error',async()=>{
 const returned=[raw];for(const mode of ['row','empty','error'] as const){const calls:Statement[]=[],failure=new Error(entry.name);let tx:Transaction;tx={async execute(this:unknown,sql:string,args:unknown[]=[]){assert.equal(this,tx);calls.push([sql,args]);if(mode==='error')throw failure;return [sql.startsWith('SELECT')?mode==='empty'?[]:returned:{affectedRows:1},[]];}} as unknown as Transaction;
  if(mode==='error')await assert.rejects(entry.run(new MySqlIdentityStore(),tx),e=>e===failure);else{const result=await entry.run(new MySqlIdentityStore(),tx);assert.deepEqual(result,mode==='empty'?entry.empty:entry.expected);if(entry.identity&&mode==='row')assert.equal(result,entry.name==='recoveryAccounts'?returned:raw);if(result&&typeof result==='object'&&!entry.identity){assert.equal(Object.isFrozen(result),false);if(mode==='row'&&entry.name==='memberForUpdate')assert.deepEqual(Object.keys(result),['revision','active','canManage']);if(mode==='row'&&entry.name==='listMembers')assert.deepEqual(Object.keys((result as unknown[])[0]!),['actorId','canManage','active','revision','ownerId']);}}assert.deepEqual(calls,[entry.sql]);
 }
});

test('20 raw bootstrap insert duplicate and membership-only duplicate translation preserve code message receiver and original unrelated failure',async()=>{
 for(const method of ['insertAccount','insertMemberAccount'] as const)for(const code of ['ER_DUP_ENTRY','ER_LOCK_DEADLOCK','OTHER']){const failure=Object.assign(new Error('native '+code),{code}),tx={async execute(){throw failure;}} as unknown as Transaction;
  await assert.rejects(new MySqlIdentityStore()[method](tx,'actor','hash'),error=>{if(method==='insertMemberAccount'&&code==='ER_DUP_ENTRY'){assert.notEqual(error,failure);assert.equal((error as {code:string}).code,'ACCOUNT_CONFLICT');assert.equal((error as {status:number}).status,409);assert.equal((error as Error).message,'Account identity or bearer credential already exists');}else assert.equal(error,failure);return true;});
 }
 const calls:unknown[][]=[],store=new MySqlIdentityStore(),failure=new Error('delegated insert');store.insertAccount=async function(this:unknown,...args:unknown[]){assert.equal(this,store);calls.push(args);throw failure;};const tx={} as Transaction;await assert.rejects(store.insertMemberAccount(tx,'actor','hash'),e=>e===failure);assert.deepEqual(calls,[[tx,'actor','hash']]);
});

test('20 pool bearer lookup retains original pool receiver native row and original error without transaction',async()=>{
 for(const mode of ['row','empty','error'] as const){const failure=new Error('pool'),calls:Statement[]=[],pool={async execute(this:unknown,sql:string,args:unknown[]){assert.equal(this,pool);calls.push([sql,args]);if(mode==='error')throw failure;return [mode==='empty'?[]:[raw],[]];}};const lookup=new MySqlIdentityAccountLookup({pool} as never);if(mode==='error')await assert.rejects(lookup.byToken('hash'),e=>e===failure);else assert.equal(await lookup.byToken('hash'),mode==='empty'?undefined:raw);assert.deepEqual(calls,[['SELECT id FROM accounts WHERE token_hash=?',['hash']]]);}
});

test('20 real Identity audit evaluates UUID then supplied clock then native details JSON before execute',async()=>{
 const tx={} as Transaction,events:string[]=[],failure=new Error('details'),details={get first(){events.push('json');return 1;},get second(){events.push('json-error');throw failure;}};
 const store=new MySqlIdentityStore(),owner=new IdentityService({db:{} as never,store,accounts:{} as never,codec:nativeIdentityCodec,secrets:{newID(){events.push('uuid');return 'event';},newToken(){assert.fail('audit creates no token');},tokenHash(){assert.fail('audit hashes no token');}},now:()=>{events.push('now');return 123;}});
 await assert.rejects(owner.audit(tx,'scope','actor','subject','member_change',5,details),e=>e===failure);assert.deepEqual(events,['uuid','now','json','json-error']);
});

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
async function withDatabase(action:(db:MySqlUnitOfWork)=>Promise<void>){const admin=await createConnection(databaseURL!),database='tunex_identity_complete_'+randomUUID().replaceAll('-',''),url=new URL(databaseURL!);url.pathname='/'+database;const db=new MySqlUnitOfWork(url.toString());let created=false;
 try{await admin.query(`CREATE DATABASE \`${database}\``);created=true;await db.migrate();await action(db);}finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${database}\``);}finally{await admin.end();}}}
async function snapshot(db:MySqlUnitOfWork){const names=await rows<{name:string}>(db.pool,'SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');return Object.fromEntries(await Promise.all(names.map(async({name})=>[name,(await rows(db.pool,`SELECT * FROM \`${name}\``)).map(row=>JSON.stringify(row)).sort()])));}

test('20 canonical MySQL bootstrap raw duplicate member account mapping exact locks and every account member audit failure roll back caller Runtime history',{skip:!databaseURL},async()=>{
 await withDatabase(async db=>{
  const store=new MySqlIdentityStore(),failure=new Error('actual statement fault'),statements:Statement[]=[];let failAt=-1,ordinal=0;
  const boundary={async transaction<T>(action:(tx:Transaction)=>Promise<T>){return db.transaction(async tx=>{let proxy:Transaction;proxy=new Proxy(tx,{get(target,key,receiver){if(key==='execute')return async function(this:unknown,sql:string,args:unknown[]=[]){assert.equal(this,proxy);statements.push([sql,args]);if(!sql.startsWith('SELECT')&&ordinal++===failAt)throw failure;return Reflect.apply(target.execute,target,[sql,args]);};return Reflect.get(target,key,receiver);}});return action(proxy);});}};
  const owner=new IdentityService({db:boundary,store,accounts:new MySqlIdentityAccountLookup(db),secrets:nativeNodeSecrets,codec:nativeIdentityCodec,now:()=>1234});
  const ownerToken='a'.repeat(32),memberToken='b'.repeat(32);
  const empty=await snapshot(db);for(let n=0;n<3;n++){failAt=n;ordinal=0;await assert.rejects(owner.bootstrap('scope','owner',ownerToken),e=>e===failure);assert.deepEqual(await snapshot(db),empty);}failAt=-1;ordinal=0;await owner.bootstrap('scope','owner',ownerToken);
  await assert.rejects(owner.bootstrap('different','owner',ownerToken),e=>(e as {code:string}).code==='ER_DUP_ENTRY');
  const bootstrapped=await snapshot(db);await assert.rejects(owner.bootstrap('other-scope','different-account',ownerToken),e=>(e as {code:string}).code==='ER_DUP_ENTRY');await assert.rejects(owner.bootstrap('scope','different-account','d'.repeat(32)),e=>(e as {code:string}).code==='ER_DUP_ENTRY');assert.deepEqual(await snapshot(db),bootstrapped);
  await db.transaction(async tx=>{await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts,resource_source,owner_actor_id,resource_revision) VALUES(?,?,?,?,?,?,?,1)',['history-node','scope','c'.repeat(64),999999,'{}','private','owner']);await write(tx,'INSERT INTO runtime_nodes(node_id,session_epoch) VALUES(?,?)',['history-node',7]);});
  const before=await snapshot(db);for(let n=0;n<4;n++){failAt=n;ordinal=0;await assert.rejects(boundary.transaction(async tx=>{await write(tx,'UPDATE runtime_nodes SET session_epoch=8 WHERE node_id=?',['history-node']);await owner.changeMember(tx,'owner','scope','subject',0,'manager',memberToken);}),e=>e===failure);assert.deepEqual(await snapshot(db),before,'account/member/audit and preceding caller Runtime mutation roll back together at write '+n);}
  failAt=-1;ordinal=0;statements.length=0;assert.deepEqual(await boundary.transaction(tx=>owner.changeMember(tx,'owner','scope','subject',0,'manager',memberToken)),{actorId:'subject',revision:1,role:'manager',active:true,changed:true});
  assert.deepEqual(statements.slice(0,5),[
   ['SELECT can_manage FROM scope_members WHERE scope_id=? AND actor_id=? AND active=TRUE FOR SHARE',['scope','owner']],
   ['SELECT owner_id FROM scopes WHERE id=? FOR SHARE',['scope']],['SELECT owner_id FROM scopes WHERE id=? FOR UPDATE',['scope']],
   ['SELECT revision,active,can_manage FROM scope_members WHERE scope_id=? AND actor_id=? FOR UPDATE',['scope','subject']],['SELECT token_hash FROM accounts WHERE id=? FOR SHARE',['subject']]]);
  const once=await snapshot(db);assert.equal((await boundary.transaction(tx=>owner.changeMember(tx,'owner','scope','subject',1,'manager',memberToken))).changed,false);assert.deepEqual(await snapshot(db),once);
  await assert.rejects(boundary.transaction(tx=>owner.changeMember(tx,'owner','scope','duplicate',0,'viewer',memberToken)),e=>(e as {code:string}).code==='ACCOUNT_CONFLICT');assert.deepEqual(await snapshot(db),once);
  const audit=await rows<{kind:string;revision:number;details:unknown}>(db.pool,'SELECT kind,revision,details FROM access_events');assert.equal(audit.length,1);assert.equal(audit[0]!.kind,'member_change');assert.equal(audit[0]!.revision,1);assert.deepEqual(nativeNodeCodecRead(audit[0]!.details),{role:'manager'});
  assert.equal(await owner.authenticate('Bearer '+memberToken),'subject');assert.equal(await boundary.transaction(tx=>owner.authenticateIn(tx,'Bearer '+ownerToken)),'owner');assert.equal((await rows<{session_epoch:number}>(db.pool,'SELECT session_epoch FROM runtime_nodes'))[0]!.session_epoch,7);
 });
});
function nativeNodeCodecRead(value:unknown){return typeof value==='string'?JSON.parse(value):value;}

test('20 canonical MySQL recovery locks ID order rotates all tokens then deactivates only nonowners with every-write rollback and protected history retention',{skip:!databaseURL},async()=>{
 await withDatabase(async db=>{
  const store=new MySqlIdentityStore(),tokens=['a','b','c'].map(x=>x.repeat(32)),initial=new IdentityService({db,store,accounts:new MySqlIdentityAccountLookup(db),secrets:nativeNodeSecrets,codec:nativeIdentityCodec,now:()=>1234});
  await initial.bootstrap('scope-z','z-owner',tokens[2]!);await initial.bootstrap('scope-a','a-owner',tokens[0]!);await db.transaction(tx=>initial.changeMember(tx,'a-owner','scope-a','m-member',0,'manager',tokens[1]!));
  await db.transaction(async tx=>{await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts,resource_source,owner_actor_id,resource_revision) VALUES(?,?,?,?,?,?,?,1)',['history','scope-a','d'.repeat(64),999999,'{}','private','a-owner']);await write(tx,'INSERT INTO runtime_nodes(node_id,session_epoch) VALUES(?,?)',['history',17]);});
  const before=await snapshot(db),failure=new Error('recovery write');for(const n of [0,1,2,3]){let ordinal=0;await assert.rejects(db.transaction(async tx=>{const proxy=new Proxy(tx,{get(target,key,receiver){if(key==='execute')return async(sql:string,args:unknown[]=[])=>(!sql.startsWith('SELECT')&&ordinal++===n?Promise.reject(failure):Reflect.apply(target.execute,target,[sql,args]));return Reflect.get(target,key,receiver);}});await initial.quarantineRecovery(proxy);}),e=>e===failure);assert.deepEqual(await snapshot(db),before);}
  const order:Statement[]=[],result=await db.transaction(async tx=>{const proxy=new Proxy(tx,{get(target,key,receiver){if(key==='execute')return async(sql:string,args:unknown[]=[])=>(order.push([sql,args]),Reflect.apply(target.execute,target,[sql,args]));return Reflect.get(target,key,receiver);}});return initial.quarantineRecovery(proxy);});
  assert.deepEqual(result.map(row=>[row.actorId,row.owner]),[['a-owner',true],['m-member',false],['z-owner',true]]);assert.equal(order[0]![0],'SELECT a.id,EXISTS(SELECT 1 FROM scopes s WHERE s.owner_id=a.id) owner FROM accounts a ORDER BY a.id FOR UPDATE');assert.deepEqual(order.slice(1,4),result.map(row=>['UPDATE accounts SET token_hash=? WHERE id=?',[tokenHash(row.token),row.actorId]]));assert.equal(order[4]![0],'UPDATE scope_members m JOIN scopes s ON s.id=m.scope_id SET m.active=FALSE,m.can_manage=FALSE WHERE m.actor_id<>s.owner_id');
  const memberships=await rows<{actor_id:string;active:number;can_manage:number}>(db.pool,'SELECT actor_id,active,can_manage FROM scope_members ORDER BY actor_id');assert.deepEqual(memberships,[{actor_id:'a-owner',active:1,can_manage:1},{actor_id:'m-member',active:0,can_manage:0},{actor_id:'z-owner',active:1,can_manage:1}]);
  for(const row of result)assert.equal(await initial.authenticate('Bearer '+row.token),row.actorId);for(const token of tokens)await assert.rejects(initial.authenticate('Bearer '+token),e=>(e as {code:string}).code==='UNAUTHENTICATED');
  const after=await snapshot(db);for(const [name,value] of Object.entries(before))if(!['accounts','scope_members'].includes(name))assert.deepEqual(after[name],value,'protected Runtime/history retained '+name);
 });
});

test('current account Scope SQL binds the actor twice and applies the bounded binary cursor before projection',async()=>{
 const store=new MySqlIdentityStore(),calls:Statement[]=[],failure=new Error('context query failed');let fail=false;
 const tx={async execute(sql:string,args:unknown[]){calls.push([sql,args]);if(fail)throw failure;return [[{scope_id:'scope-b',owner_id:'owner',actor_id:'actor',revision:2,active:1,can_manage:0},{scope_id:'scope-c',owner_id:'actor',actor_id:null,revision:null,active:null,can_manage:null}],[]];}} as unknown as Transaction;
 const result=await store.scopeContext(tx,'actor',{after:'scope-a',limit:2});assert.deepEqual(result,[{scopeId:'scope-b',ownerId:'owner',membership:{actorId:'actor',revision:2,active:1,canManage:0}},{scopeId:'scope-c',ownerId:'actor',membership:null}]);
 assert.deepEqual(calls[0]![1],['actor','actor','scope-a']);assert.match(calls[0]![0],/m.actor_id=\?[\s\S]*WHERE \(s.owner_id=\? OR m.active=TRUE\) AND s.id>\?[\s\S]*ORDER BY s.id COLLATE ascii_bin LIMIT 3/);
 fail=true;await assert.rejects(store.scopeContext(tx,'actor',{after:null,limit:2}),error=>error===failure);const before=calls.length;await assert.rejects(store.scopeContext(tx,'actor',{after:null,limit:0}),{code:'INTEGRITY_FAILURE'});assert.equal(calls.length,before);
});
