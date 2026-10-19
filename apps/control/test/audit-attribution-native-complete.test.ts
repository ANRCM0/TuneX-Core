import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'mysql2/promise';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { MySqlAuditReadStore } from '../src/infrastructure/mysql-audit-read-store.ts';
import { AuditEvents, AuditReadModels, auditStoragePolicy } from '../src/modules/audit-owner/public.ts';
import type { AuditFilters, AuditReadQuery, AuditSource } from '../src/modules/audit-owner/public.ts';
import type { AuditStorageRow } from '../src/framework/public.ts';
import { createControlApp } from '../src/api/public.ts';
import type { ControlHttpOptions } from '../src/api/public.ts';

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
const hash=(digit='a')=>'sha256:'+digit.repeat(64),secret='AUDIT_PRIVATE_VALUE_NOT_FOR_DTO';
const spec=(node:string,via:string[]=[])=>({ingress:{nodeId:node},path:{via},secret});
const state=(forwardId:string,node:string,revision=7)=>({forwardId,revision,spec:spec(node),secret});
const accepted=(forwardId:string,node:string,revision=7)=>({accepted:true,result:{accepted:{body:{forwardId,revision,operationId:'operation-'+forwardId,secret}},state:state(forwardId,node,revision)},secret});
const rejected=(code:unknown='CONNECT_FAILED')=>({accepted:false,error:{code,message:secret,retryable:true},secret});
async function insert(tx:Transaction,table:string,value:Record<string,unknown>){const keys=Object.keys(value);await write(tx,`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`,Object.values(value));}
async function database(action:(db:MySqlUnitOfWork)=>Promise<void>){
 const admin=await createConnection(databaseURL!),name='tunex_audit_truth_'+randomUUID().replaceAll('-',''),url=new URL(databaseURL!);url.pathname='/'+name;const db=new MySqlUnitOfWork(url.toString());let created=false;
 try{await admin.query(`CREATE DATABASE \`${name}\``);created=true;await db.migrate();await db.transaction(async tx=>{await insert(tx,'accounts',{id:'actor',token_hash:'a'.repeat(64)});for(const scope of ['scope','foreign'])await insert(tx,'scopes',{id:scope,owner_id:'actor'});});await action(db);}
 finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${name}\``);}finally{await admin.end();}}
}
async function snapshot(db:MySqlUnitOfWork){const tables=await rows<{name:string}>(db.pool,'SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');return Object.fromEntries(await Promise.all(tables.map(async({name})=>[name,(await rows(db.pool,`SELECT * FROM \`${name}\``)).map(row=>JSON.stringify(row)).sort()])));}
function readQuery(filters:AuditFilters={},from=0,to=1000):AuditReadQuery{return {from,to,limit:50,filters,before:null};}
async function read(tx:Transaction,source:AuditSource,filters:AuditFilters={},scope='scope',from=0,to=1000){return new MySqlAuditReadStore(auditStoragePolicy).source(tx,scope,source,readQuery(filters,from,to),row=>row);}
function safe(value:unknown){assert.doesNotMatch(JSON.stringify(value),new RegExp(secret+'|request_digest|request_key|plan_digest|expanded_spec|password|certificate'));}
async function seedMetadata(tx:Transaction){
 for(const scope of ['scope','foreign']){
  await insert(tx,'path_templates',{scope_id:scope,template_id:'template',current_revision:2,archived:true});
  for(const revision of [1,2]){const node=scope==='foreign'?'foreign-node':revision===1?'old-node':'new-node';await insert(tx,'path_template_revisions',{scope_id:scope,template_id:'template',revision,config:JSON.stringify({nodes:[node],secret}),profile_digest:hash(),config_digest:hash(revision===1?'a':'b'),created_by:'actor',created_at:revision});await insert(tx,'path_template_events',{id:scope+'-template-'+revision,scope_id:scope,template_id:'template',revision,kind:revision===1?'publish':'archive',actor_id:'actor',created_at:10+revision});}
  for(const family of ['path','ingress']){const collection=family==='path'?'candidates':'members';await insert(tx,family+'_groups',{scope_id:scope,group_id:'group',current_revision:2,archived:true});for(const revision of [1,2]){await insert(tx,family+'_group_revisions',{scope_id:scope,group_id:'group',revision,config:JSON.stringify({[collection]:[{template:{templateId:'template',revision,configDigest:hash(revision===1?'a':'b')},secret}],secret}),config_digest:hash(),created_by:'actor',created_at:revision});await insert(tx,family+'_group_events',{id:scope+'-'+family+'-'+revision,scope_id:scope,group_id:'group',revision,kind:revision===1?'publish':'archive',actor_id:'actor',created_at:20+revision});}}
 }
 await insert(tx,'path_templates',{scope_id:'foreign',template_id:'foreign-only',current_revision:1,archived:false});await insert(tx,'path_template_revisions',{scope_id:'foreign',template_id:'foreign-only',revision:1,config:JSON.stringify({nodes:['foreign-only-node'],secret}),profile_digest:hash(),config_digest:hash(),created_by:'actor',created_at:1});
 for(const family of ['path','ingress'])for(const [id,reference] of [['bad-digest',{templateId:'template',revision:1,configDigest:hash('c')}],['bad-revision',{templateId:'template',revision:64,configDigest:hash()}],['foreign-only',{templateId:'foreign-only',revision:1,configDigest:hash()}],['null-member',null]] as const){await insert(tx,family+'_groups',{scope_id:'scope',group_id:id,current_revision:1,archived:false});await insert(tx,family+'_group_revisions',{scope_id:'scope',group_id:id,revision:1,config:JSON.stringify({[family==='path'?'candidates':'members']:[{template:reference,secret}],secret}),config_digest:hash(),created_by:'actor',created_at:1});await insert(tx,family+'_group_events',{id:family+'-'+id,scope_id:'scope',group_id:id,revision:1,kind:'publish',actor_id:'actor',created_at:30});}
}

test('68 populated MySQL template and group attribution uses exact historical revision digest and Scope while binding and operation use immutable specs',{skip:!databaseURL},async()=>database(async db=>{
 await db.transaction(async tx=>{
  await seedMetadata(tx);await insert(tx,'forwards',{id:'forward',scope_id:'scope',revision:2,spec:JSON.stringify(spec('current-node'))});await insert(tx,'forward_revisions',{forward_id:'forward',revision:1,spec:JSON.stringify(spec('history-node'))});
  await insert(tx,'forward_path_bindings',{forward_id:'forward',sequence:1,scope_id:'scope',template_id:'template',template_revision:1,config_digest:hash(),forward_revision:1,expanded_spec:JSON.stringify(spec('bound-ingress',['bound-via'])),spec_digest:hash(),actor_id:'actor',created_at:40});
  await insert(tx,'forward_path_group_bindings',{forward_id:'forward',sequence:1,scope_id:'scope',group_id:'group',group_revision:1,config_digest:hash(),candidate_id:'candidate',path_binding_sequence:1,forward_revision:1,expanded_spec:JSON.stringify(spec('group-bound-ingress',['group-bound-via'])),spec_digest:hash(),actor_id:'actor',created_at:41});
  for(const [index,code,retryable] of [[0,'CONNECT_FAILED',true],[1,'connect_failed','true'],[2,19,1]] as const)await insert(tx,'operations',{id:'operation-'+index,scope_id:'scope',forward_id:'forward',target_revision:1,kind:'update',status:'failed',requested_by:'actor',idempotency_key:'key-'+index,request_digest:hash(),created_at:1,updated_at:50+index,execution_deadline:1000,last_error:JSON.stringify({code,retryable,message:secret})});
 });
 const before=await snapshot(db);
 await db.transaction(async tx=>{
  for(const source of ['path-template','path-group','ingress-group'] as const){for(const [node,revision] of [['old-node',1],['new-node',2]] as const){const result=await read(tx,source,{nodeId:node});assert.equal(result.length,1,source+' '+node);assert.equal(result[0]!.revision,revision);assert.equal(result[0]!.kind,revision===1?'publish':'archive');safe(result);}
   for(const node of ['OLD-NODE','foreign-node','foreign-only-node'])assert.deepEqual(await read(tx,source,{nodeId:node}),[],source+' '+node);const foreign=await read(tx,source,{nodeId:'foreign-node'},'foreign');assert.equal(foreign.length,2);safe(foreign);
   const all=await read(tx,source);assert.equal(all.length,source==='path-template'?2:6);assert.ok(all.every(row=>row.nodeAssociation===(source==='path-template'?'immutable-template-config':'immutable-group-definition')));safe(all);
  }
  for(const [source,nodes] of [['path-binding',['bound-ingress','bound-via']],['path-group-binding',['group-bound-ingress','group-bound-via']]] as const){for(const nodeId of nodes){const result=await read(tx,source,{nodeId});assert.equal(result.length,1);assert.equal(result[0]!.recordType,'immutable-provenance');assert.equal(result[0]!.sequence,1);assert.equal(result[0]!.revision,1);assert.equal(result[0]!.forwardId,'forward');safe(result);}for(const nodeId of ['current-node','history-node','new-node'])assert.deepEqual(await read(tx,source,{nodeId}),[]);assert.deepEqual(await read(tx,source,{},'foreign'),[]);}
  const operations=await read(tx,'operation',{nodeId:'history-node'});assert.equal(operations.length,3);assert.deepEqual(operations.map(row=>[row.operationId,row.errorCode,row.retryable]),[['operation-2',null,null],['operation-1','OTHER_ERROR',null],['operation-0','CONNECT_FAILED',true]]);assert.ok(operations.every(row=>row.recordType==='latest-operation-state'&&row.timeMeaning==='latest-operation-update'&&row.actorAttribution==='requester-not-status-actor'));safe(operations);assert.deepEqual(await read(tx,'operation',{nodeId:'current-node'}),[]);assert.deepEqual(await read(tx,'operation',{errorCode:'connect_failed' as never}),[]);assert.equal((await read(tx,'operation',{errorCode:'OTHER_ERROR'})).length,1);assert.deepEqual(await read(tx,'operation',{},'foreign'),[]);
 });assert.deepEqual(await snapshot(db),before);
}));

const families=[{source:'path-publication',head:'path_publications',prefix:'path_publication',first:'apply'},{source:'ingress-deployment',head:'ingress_deployments',prefix:'ingress_deployment',first:'create'},{source:'ingress-migration',head:'ingress_migrations',prefix:'ingress_migration',first:'apply'}] as const;
type Family=typeof families[number];
function plan(family:Family){
 const items=Array.from({length:8},(_,i)=>family.source==='path-publication'?{source:state('baseline-'+(i+1),'baseline-node-'+(i+1)),proposedSpec:spec('proposed-node-'+(i+1)),secret}:family.source==='ingress-deployment'?{spec:spec('planned-node-'+(i+1)),secret}:{kind:i===0?'add':i===5?'remove':'update',source:i===0?null:1,spec:i===5?null:spec('add-node-'+(i+1)),secret});
 return {items,sources:[{state:state('migration-baseline','migration-baseline-node')}],secret};
}
async function seedBatch(tx:Transaction,family:Family,scope='scope',batch='batch'){
 const value:Record<string,unknown>={scope_id:scope,batch_id:batch,revision:3,created_by:'creator',created_at:60,plan_digest:hash(),cancelled:true,recovery_invalidated:true,plan:JSON.stringify(plan(family))};if(family.source!=='path-publication')Object.assign(value,{group_id:'group',...(family.source==='ingress-deployment'?{group_revision:1}:{source_group_revision:1,target_group_revision:2})});await insert(tx,family.head,value);
 for(const [revision,kind] of [[1,'create'],[2,'recovery']] as const)await insert(tx,family.prefix+'_events',{scope_id:scope,batch_id:batch,revision,kind,actor_id:'recorded-actor',created_at:60+revision});
}
async function attempt(tx:Transaction,family:Family,position:number,kind:string,outcome:unknown,at:number,scope='scope',batch='batch'){await insert(tx,family.prefix+'_attempts',{scope_id:scope,batch_id:batch,position,kind,actor_id:'actor',created_at:at,request_key:'request-'+position+'-'+kind,request_digest:hash(),outcome:JSON.stringify(outcome)});}
function tuples(result:AuditStorageRow[]){return result.map(row=>[row.position,row.kind,row.forwardId,row.revision,row.operationId,row.outcome,row.errorCode,row.retryable]);}

test('68 populated MySQL batches attribute plan source proposed and add nodes while attempts distinguish accepted state rejected baseline compensation and strict error JSON types',{skip:!databaseURL},async()=>database(async db=>{
 await db.transaction(async tx=>{await seedMetadata(tx);for(const family of families){await seedBatch(tx,family);await seedBatch(tx,family,'foreign');
  await attempt(tx,family,1,family.first,rejected(),101);await attempt(tx,family,2,family.first,accepted('accepted-forward','accepted-node',11),102);await attempt(tx,family,2,'compensate',rejected('connect_failed'),112);
  await attempt(tx,family,3,family.first,rejected('PRIVATE_ERROR'),103);await attempt(tx,family,3,'compensate',accepted('compensated-forward','compensated-node',12),113);
  await attempt(tx,family,4,family.first,{accepted:'true',error:{code:'RESOURCE_LIMIT'},secret},104);
  await attempt(tx,family,4,'compensate',rejected('BIND_FAILED'),114);
  await attempt(tx,family,5,family.first,{accepted:true,result:{accepted:{body:{forwardId:19,revision:'13',operationId:false}},state:{spec:spec('typed-state-node')}},secret},105);
  await attempt(tx,family,6,family.first,rejected(12),106);await attempt(tx,family,7,family.first,[],107);
  await attempt(tx,family,8,family.first,{accepted:true,result:{accepted:{body:{forwardId:'zero-forward',revision:0,operationId:'zero-operation'}},state:{spec:spec('zero-state-node')}},secret},108);
  await attempt(tx,family,1,family.first,accepted('foreign-forward','foreign-accepted-node'),101,'foreign');
 }});
 const before=await snapshot(db);
 await db.transaction(async tx=>{for(const family of families){const source=(family.source+'-attempt') as AuditSource;
  const eventNodes=family.source==='path-publication'?['baseline-node-1','proposed-node-1']:family.source==='ingress-deployment'?['planned-node-1']:['add-node-1','migration-baseline-node'];
  for(const nodeId of eventNodes){const records=await read(tx,family.source,{nodeId});assert.equal(records.length,2,family.source+' '+nodeId);assert.deepEqual(records.map(row=>[row.kind,row.actorId,row.actorAttribution,row.forwardId,row.operationId,row.position,row.recoveryInvalidated]),[['recovery',null,'unattributed-recovery',null,null,null,true],['create','recorded-actor','initiator',null,null,null,true]]);safe(records);}
  assert.deepEqual(await read(tx,family.source,{nodeId:'accepted-node'}),[]);assert.deepEqual(await read(tx,family.source,{nodeId:'never-present'}),[]);
  const baseline=family.source==='path-publication'?['baseline-1',7]:[null,null],baselineNode=family.source==='path-publication'?'baseline-node-1':family.source==='ingress-deployment'?'planned-node-1':'add-node-1';
  assert.deepEqual(tuples(await read(tx,source,{nodeId:baselineNode})),[[1,family.first,...baseline,null,'rejected','CONNECT_FAILED',false]]);
  if(family.source==='ingress-migration'){const records=await read(tx,source,{nodeId:'migration-baseline-node'}),update=records.find(row=>row.position===3&&row.kind==='apply'),remove=records.find(row=>row.position===6&&row.kind==='apply');assert.ok(update);assert.ok(remove);assert.deepEqual([update.forwardId,update.revision,update.errorCode],['migration-baseline',7,'OTHER_ERROR']);assert.deepEqual([remove.forwardId,remove.revision,remove.errorCode],['migration-baseline',7,null]);}
  assert.deepEqual(tuples(await read(tx,source,{nodeId:'accepted-node'})),[[2,'compensate','accepted-forward',11,null,'rejected','OTHER_ERROR',false],[2,family.first,'accepted-forward',11,'operation-accepted-forward','accepted',null,null]]);
  assert.deepEqual(tuples(await read(tx,source,{nodeId:'compensated-node'})),[[3,'compensate','compensated-forward',12,'operation-compensated-forward','accepted',null,null]]);
  const typed=await read(tx,source,{nodeId:'typed-state-node'});assert.deepEqual(tuples(typed),[[5,family.first,null,null,null,'accepted',null,null]]);
  assert.deepEqual(tuples(await read(tx,source,{nodeId:'zero-state-node'})),[[8,family.first,'zero-forward',0,'zero-operation','accepted',null,null]]);
  assert.equal((await read(tx,source,{errorCode:'OTHER_ERROR'})).length,2);assert.equal((await read(tx,source,{errorCode:'CONNECT_FAILED'})).length,1);assert.deepEqual(await read(tx,source,{errorCode:'connect_failed' as never}),[]);assert.equal((await read(tx,source,{forwardId:'accepted-forward'})).length,2);assert.equal((await read(tx,source,{operationId:'operation-accepted-forward'})).length,1);
  const all=await read(tx,source);assert.equal(all.length,11);assert.equal(all.find(row=>row.position===4&&row.kind===family.first)!.outcome,'invalid');assert.equal(all.find(row=>row.position===4&&row.kind===family.first)!.errorCode,'RESOURCE_LIMIT');assert.equal(all.find(row=>row.position===6)!.errorCode,null);assert.equal(all.find(row=>row.position===7)!.outcome,'invalid');assert.ok(all.every(row=>row.actorId==='actor'&&row.nodeAssociation==='immutable-forward-spec'&&row.recoveryInvalidated===true));safe(all);
  assert.deepEqual(tuples(await read(tx,source,{errorCode:'BIND_FAILED'})),[[4,'compensate',null,null,null,'rejected','BIND_FAILED',false]]);
  assert.deepEqual(await read(tx,source,{nodeId:'foreign-accepted-node'}),[]);assert.equal((await read(tx,source,{nodeId:'foreign-accepted-node'},'foreign')).length,1);assert.deepEqual(await read(tx,source,{actorId:'ACTOR'}),[]);assert.deepEqual(await read(tx,source,{},'missing'),[]);
 }});assert.deepEqual(await snapshot(db),before);
}));

test('68 actual owner and HTTP route populated native SQL share read-only caller Tx sanitize secrets enforce response bytes and refuse malformed raw rows without changing history',{skip:!databaseURL},async t=>database(async db=>{
 await db.transaction(async tx=>{await seedMetadata(tx);for(const family of families){await seedBatch(tx,family);await attempt(tx,family,1,family.first,accepted('accepted-forward','accepted-node',11),101);await attempt(tx,family,1,'compensate',rejected('PRIVATE_ERROR'),111);await attempt(tx,family,2,family.first,{accepted:1,error:{code:'CONNECT_FAILED'},secret},102);await attempt(tx,family,3,family.first,{accepted:true,result:{accepted:{body:{forwardId:'zero-forward',revision:0,operationId:'zero-operation'}},state:{spec:spec('zero-node')}},secret},103);}});
 const before=await snapshot(db),trace:string[]=[],store=new MySqlAuditReadStore(auditStoragePolicy);let transaction:Transaction|undefined,denied=false;
 const failure=new Error('denied audit');
 const boundary={async transaction<T>(action:(tx:Transaction)=>Promise<T>){return db.transaction(async original=>{let proxy:Transaction;proxy=new Proxy(original,{get(target,key,receiver){if(key==='execute')return async function(this:unknown,sql:string,args:unknown[]){assert.equal(this,proxy);assert.equal(transaction,proxy);assert.equal(trace.at(0),'authorize');assert.match(sql,/^SELECT audit\.\* FROM /);assert.doesNotMatch(sql,/FOR UPDATE|INSERT |UPDATE |DELETE /);trace.push('read');return Reflect.apply(target.execute,target,[sql,args]);};return Reflect.get(target,key,receiver);}});transaction=proxy;return action(proxy);});}};
 function owner(){return new AuditEvents(boundary,{async scope(tx,actor,scope,manage){assert.equal(tx,transaction);assert.equal(actor,'actor');assert.equal(scope,'scope');assert.equal(manage,true);trace.push('authorize');if(denied)throw failure;}},new AuditReadModels(store),()=>1000);}
 for(const family of families){trace.length=0;const result=await owner().query('actor','scope',{from:new Date(0).toISOString(),to:new Date(1000).toISOString(),source:family.source+'-attempt',nodeId:'accepted-node'});assert.deepEqual(trace,['authorize','read']);assert.deepEqual(result.items.map(row=>[row.kind,row.forwardId,row.revision,row.outcome,row.errorCode]),[['compensate','accepted-forward',11,'rejected','OTHER_ERROR'],[family.first,'accepted-forward',11,'accepted',null]]);assert.equal(result.readOnly,true);assert.equal(result.executionAuthorized,false);assert.equal(result.networkCheck,'not-performed');safe(result);
  for(const at of [102,103]){trace.length=0;await assert.rejects(owner().query('actor','scope',{from:new Date(at).toISOString(),to:new Date(at+1).toISOString(),source:family.source+'-attempt'}),{code:'INTEGRITY_FAILURE'});assert.deepEqual(trace,['authorize','read']);}
 }
 trace.length=0;denied=true;await assert.rejects(owner().query('actor','scope',{}),e=>e===failure);assert.deepEqual(trace,['authorize']);denied=false;
 const routeTrace:string[]=[],service=owner(),audit={async admitReadRequest<T>(action:()=>Promise<T>){routeTrace.push('admit');return service.admitReadRequest(async()=>{try{return await action();}finally{routeTrace.push('release');}});},query(...args:Parameters<typeof service.query>){return service.query(...args);}};
 const options:ControlHttpOptions={control:{} as ControlHttpOptions['control'],runtime:{} as ControlHttpOptions['runtime'],authority:{async allow(){routeTrace.push('authority');},async read(){return {maintenance:false};}},services:{audit,async authenticateObservation(header){routeTrace.push('authenticate');assert.equal(header,'Bearer test');return 'actor';}}};
 const app=createControlApp(options),params=new URLSearchParams({from:new Date(0).toISOString(),to:new Date(1000).toISOString(),source:'path-publication-attempt',nodeId:'accepted-node'}),path='/api/v1/scopes/scope/audit-events?'+params;
 trace.length=0;let response=await app.request(path,{headers:{authorization:'Bearer test'}});assert.equal(response.status,200);const body=await response.json() as {items:unknown[];executionAuthorized:boolean};assert.equal(body.items.length,2);assert.equal(body.executionAuthorized,false);safe(body);assert.deepEqual(routeTrace,['authority','admit','authenticate','release']);assert.deepEqual(trace,['authorize','read']);assert.equal(response.headers.get('cache-control'),'no-store');
 trace.length=0;routeTrace.length=0;response=await app.request(path+'&source=path-publication-attempt',{headers:{authorization:'Bearer test'}});assert.equal(response.status,422);assert.deepEqual(trace,[]);assert.deepEqual(routeTrace,['authority','admit','authenticate','release']);
 trace.length=0;routeTrace.length=0;response=await app.request(path,{headers:{authorization:'Bearer test',cookie:'session=ignored'}});assert.equal(response.status,401);assert.deepEqual(trace,[]);assert.deepEqual(routeTrace,['authority','admit','release']);
 const missingIdentity=createControlApp({...options,services:{audit:owner()}});trace.length=0;response=await missingIdentity.request(path,{headers:{authorization:'Bearer test'}});assert.equal(response.status,503);assert.equal((await response.json() as {code:string}).code,'AUDIT_UNAVAILABLE');assert.deepEqual(trace,[]);
 const original=Buffer.byteLength;t.mock.method(Buffer,'byteLength',(...args:Parameters<typeof Buffer.byteLength>)=>typeof args[0]==='string'&&args[0].includes('"auditVersion":1')?131073:original(...args));const bounded=createControlApp({...options,services:{...options.services,audit:owner()}});trace.length=0;response=await bounded.request(path,{headers:{authorization:'Bearer test'}});assert.equal(response.status,409);assert.equal((await response.json() as {code:string}).code,'INTEGRITY_FAILURE');assert.deepEqual(trace,['authorize','read']);
 assert.deepEqual(await snapshot(db),before);
}));

test('68 multi-row MySQL group and batch node attribution matches independent canonical JSON containment without correlated JSON_TABLE semijoins',{skip:!databaseURL},async()=>database(async db=>{
 await db.transaction(async tx=>{
  await seedMetadata(tx);
  for(const family of families){await seedBatch(tx,family);await seedBatch(tx,family,'scope','second-batch');await seedBatch(tx,family,'foreign');}
 });
 const before=await snapshot(db);
 const identity=(records:{entityId:unknown;revision:unknown;kind:unknown}[])=>records.map(record=>[record.entityId,Number(record.revision),record.kind]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
 await db.transaction(async tx=>{
  for(const family of ['path','ingress'] as const){
   const collection=family==='path'?'candidates':'members',source=family==='path'?'path-group':'ingress-group';
   const count=await rows<{n:number}>(tx,`SELECT COUNT(*) n FROM ${family}_group_events WHERE scope_id=?`,['scope']);assert.equal(Number(count[0]!.n),6,'multiple outer group-event rows must remain in the fixture');
   for(const scope of ['scope','foreign'])for(const nodeId of ['old-node','new-node','OLD-NODE','foreign-node','foreign-only-node','never-present']){
    // This independent baseline joins immutable revisions directly and tests
    // whole template references by JSON containment; it has no JSON_TABLE or
    // correlated subquery that could share the adapter's optimizer failure.
    const canonical=await rows<{entityId:string;revision:number;kind:string}>(tx,
     `SELECT DISTINCT e.group_id entityId,e.revision,e.kind FROM ${family}_group_events e `+
     `JOIN ${family}_group_revisions r ON r.scope_id=e.scope_id AND r.group_id=e.group_id AND r.revision=e.revision `+
     'JOIN path_template_revisions t ON t.scope_id=e.scope_id '+
     `AND JSON_CONTAINS(r.config,JSON_OBJECT('template',JSON_OBJECT('templateId',t.template_id,'revision',t.revision,'configDigest',t.config_digest)),'$.${collection}') `+
     "WHERE e.scope_id=? AND JSON_CONTAINS(JSON_EXTRACT(t.config,'$.nodes'),JSON_QUOTE(?))",[scope,nodeId]);
    const actual=await read(tx,source,{nodeId},scope);assert.deepEqual(identity(actual),identity(canonical),source+' '+scope+' '+nodeId);safe(actual);
    if(scope==='scope'&&(nodeId==='old-node'||nodeId==='new-node'))assert.equal(canonical.length,1,'canonical historical template join must be populated');
   }
  }
  for(const family of families){
   const count=await rows<{n:number}>(tx,`SELECT COUNT(*) n FROM ${family.prefix}_events WHERE scope_id=?`,['scope']);assert.equal(Number(count[0]!.n),4,'multiple outer batch-event rows must remain in the fixture');
   const specPaths=family.source==='path-publication'?['$.items[*].source.spec','$.items[*].proposedSpec']:family.source==='ingress-deployment'?['$.items[*].spec']:['$.items[*].spec','$.sources[*].state.spec'];
   const predicate=specPaths.flatMap(path=>[`${path}.ingress.nodeId`,`${path}.path.via`]).map(path=>`JSON_CONTAINS(JSON_EXTRACT(p.plan,'${path}'),JSON_QUOTE(?))`).join(' OR ');
   for(const scope of ['scope','foreign'])for(const nodeId of ['baseline-node-1','proposed-node-1','planned-node-1','add-node-1','migration-baseline-node','BASELINE-NODE-1','never-present']){
    const canonical=await rows<{entityId:string;revision:number;kind:string}>(tx,
     `SELECT e.batch_id entityId,e.revision,e.kind FROM ${family.prefix}_events e JOIN ${family.head} p ON p.scope_id=e.scope_id AND p.batch_id=e.batch_id WHERE e.scope_id=? AND (${predicate})`,[scope,...specPaths.flatMap(()=>[nodeId,nodeId])]);
    const actual=await read(tx,family.source,{nodeId},scope);assert.deepEqual(identity(actual),identity(canonical),family.source+' '+scope+' '+nodeId);safe(actual);
    const populated=family.source==='path-publication'?['baseline-node-1','proposed-node-1']:family.source==='ingress-deployment'?['planned-node-1']:['add-node-1','migration-baseline-node'];
    if(populated.includes(nodeId))assert.equal(canonical.length,scope==='scope'?4:2,'canonical immutable plan association must be populated');
   }
  }
 });
 assert.deepEqual(await snapshot(db),before);
}));
