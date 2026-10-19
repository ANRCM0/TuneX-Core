import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MySqlAuditReadStore } from '../src/infrastructure/mysql-audit-read-store.ts';
import { MySqlAuditEvents } from '../src/infrastructure/mysql-audit-events.ts';
import { AuditReadModels, auditStoragePolicy, AUDIT_SOURCES, AUDIT_ERROR_CODES } from '../src/modules/audit-owner/public.ts';
import { AuditReadModels as LegacyModels, auditStoragePolicy as legacyPolicy } from '../src/application/audit-read-models.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import type { AuditStorageRow } from '../src/framework/public.ts';
import type { AuditReadQuery } from '../src/modules/audit-owner/public.ts';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'mysql2/promise';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import { AuditEvents } from '../src/modules/audit-owner/public.ts';

const query:AuditReadQuery={from:100,to:200,limit:2,filters:{},before:null};
function fixture(){const calls:{sql:string;args:unknown[]}[]=[],state={rows:[] as unknown[],failure:undefined as unknown};const tx={async execute(this:unknown,sql:string,args:unknown[]){assert.equal(this,tx);calls.push({sql,args});if(state.failure)throw state.failure;return [state.rows,[]];}} as unknown as Transaction;return {calls,state,tx,store:new MySqlAuditReadStore(auditStoragePolicy)};}
const row=()=>({occurredAt:'100',revision:'9007199254740991',sequence:'0',position:null,retryable:1,recoveryInvalidated:0,unclassified:'retained'});

test('68 SQL projection retains every source owner immutable attribution and stable bounded ordering on supplied Tx',async()=>{
 const f=fixture(),owners=['access_events','node_security_events','transport_events','path_template_events','forward_path_bindings','path_group_events','forward_path_group_bindings','path_publication_events','path_publication_attempts','ingress_group_events','ingress_deployment_events','ingress_deployment_attempts','ingress_migration_events','ingress_migration_attempts','operations'];
 for(const [index,source] of AUDIT_SOURCES.entries()){
  assert.deepEqual(await f.store.source(f.tx,'scope',source,query,x=>x),[]);const call=f.calls.at(-1)!;
  assert.ok(call.sql.includes('FROM '+owners[index]+' e'),source);assert.deepEqual(call.args,['scope',100,200]);
  assert.ok(call.sql.endsWith('ORDER BY audit.occurredAt DESC,CAST(audit.source AS BINARY) DESC,CAST(audit.`key` AS BINARY) DESC LIMIT 3'));
  assert.ok(call.sql.includes("CONCAT('sha256:',SHA2(CAST(JSON_ARRAY("));assert.ok(call.sql.includes('audit.occurredAt>=? AND audit.occurredAt<?'));
  assert.doesNotMatch(call.sql,/FOR UPDATE|INSERT |UPDATE |DELETE |SELECT \*/);
  if(source.endsWith('-attempt')){assert.ok(call.sql.includes("'owner-attempt' AS `recordType`"));assert.ok(call.sql.includes('LEFT JOIN '+owners[index]+' applied'));assert.ok(call.sql.includes("e.kind='compensate'"));assert.ok(call.sql.includes("ELSE 'OTHER_ERROR' END"));assert.ok(call.sql.includes("'invalid'"));}
  if(['path-publication','ingress-deployment','ingress-migration'].includes(source)){assert.ok(call.sql.includes("CASE WHEN e.kind='recovery' THEN NULL ELSE e.actor_id END"));assert.ok(call.sql.includes("'unattributed-recovery'"));}
  if(source==='operation'){assert.ok(call.sql.includes('LEFT JOIN forward_revisions r ON r.forward_id=e.forward_id AND r.revision=e.target_revision'));assert.ok(call.sql.includes("'requester-not-status-actor'"));assert.ok(call.sql.includes('e.updated_at AS `occurredAt`'));}
  if(source==='node-security')assert.ok(call.sql.includes('owner.scope_id=?'));
  if(source==='path-binding'||source==='path-group-binding')assert.ok(call.sql.includes('owner.scope_id=e.scope_id'));
 }
});

test('68 SQL node association follows immutable plans template revisions and accepted compensation rather than current routes',async()=>{
 const f=fixture();
 for(const source of AUDIT_SOURCES){f.calls.length=0;await f.store.source(f.tx,'scope',source,{...query,filters:{nodeId:'node'}},x=>x);if(source==='transport'){assert.equal(f.calls.length,0);continue;}
  const {sql,args}=f.calls[0]!;assert.ok(!sql.includes('__AUDIT_NODE__'));assert.deepEqual(args.slice(-2),[100,200]);assert.ok(args.slice(1,-2).length>0);assert.ok(args.slice(1,-2).every(x=>x==='node'));
  if(source==='path-template')assert.ok(sql.includes("JSON_EXTRACT(r.config,'$.nodes')"));
  if(source==='path-group'||source==='ingress-group'){
   const collection=source==='path-group'?'candidates':'members';
   assert.ok(sql.includes(`((SELECT COUNT(*) FROM JSON_TABLE(r.config,'$.${collection}[*]' COLUMNS (`+
    "template_id VARCHAR(128) PATH '$.template.templateId',template_revision BIGINT PATH '$.template.revision',"+
    "config_digest VARCHAR(71) PATH '$.template.configDigest')) audit_members "+
    'JOIN path_template_revisions audit_template ON audit_template.scope_id=e.scope_id AND audit_template.template_id=audit_members.template_id '+
    'AND audit_template.revision=audit_members.template_revision AND audit_template.config_digest=audit_members.config_digest '+
    "WHERE JSON_CONTAINS(JSON_EXTRACT(audit_template.config,'$.nodes'),JSON_QUOTE(?)))>0)"),source);
  }
  if(source==='path-publication'||source==='ingress-deployment'||source==='ingress-migration'){
   const expectedSpec="(CAST(CASE WHEN JSON_TYPE(JSON_EXTRACT(audit_specs.spec,'$.ingress.nodeId'))='STRING' THEN JSON_UNQUOTE(JSON_EXTRACT(audit_specs.spec,'$.ingress.nodeId')) ELSE NULL END AS BINARY)=CAST(? AS BINARY) OR JSON_CONTAINS(JSON_EXTRACT(audit_specs.spec,'$.path.via'),JSON_QUOTE(?)))";
   const selections=source==='path-publication'?[['$.items[*]','$.source.spec'],['$.items[*]','$.proposedSpec']]:source==='ingress-deployment'?[['$.items[*]','$.spec']]:[['$.items[*]','$.spec'],['$.sources[*]','$.state.spec']];
   for(const [collection,path] of selections)assert.ok(sql.includes(`((SELECT COUNT(*) FROM JSON_TABLE(p.plan,'${collection}' COLUMNS (spec JSON PATH '${path}')) audit_specs WHERE ${expectedSpec})>0)`),source+' '+path);
  }
  if(['path-group','ingress-group','path-publication','ingress-deployment','ingress-migration'].includes(source)){
   assert.doesNotMatch(sql,/EXISTS\s*\(/);assert.equal((sql.match(/\(SELECT COUNT\(\*\) FROM JSON_TABLE\(/g)??[]).length,source==='path-publication'||source==='ingress-migration'?2:1);
  }
  if(source.endsWith('-attempt')){assert.ok(sql.includes("'$.result.state'"));assert.ok(sql.includes("'$.ingress.nodeId'"));assert.ok(sql.includes("'$.path.via'"));assert.ok(sql.includes("'$.result.accepted.body'"));}
  if(source==='ingress-migration')assert.ok(sql.includes("'$.sources[*]'"));
 }
 const before={occurredAt:150,source:'access' as const,key:'sha256:'+'a'.repeat(64)};
 await f.store.source(f.tx,'scope','access',{...query,filters:{actorId:'actor',forwardId:'forward',operationId:'operation',errorCode:'OTHER_ERROR'},before},x=>x);
 const {sql,args}=f.calls.at(-1)!;assert.deepEqual(args,['scope',100,200,'actor','forward','operation','OTHER_ERROR',150,150,'access','access',before.key]);
 for(const name of ['actorId','forwardId','operationId','errorCode'])assert.ok(sql.includes('CAST(audit.`'+name+'` AS BINARY)=CAST(? AS BINARY)'));
 assert.ok(sql.includes('CAST(audit.source AS BINARY)<CAST(? AS BINARY)'));assert.ok(sql.includes('CAST(audit.`key` AS BINARY)<CAST(? AS BINARY)'));
});

test('68 SQL admission decimal counters flags mapper timing and original failures retain the native projection seam',async()=>{
 const f=fixture();
 for(const bad of [{limit:0},{limit:51},{limit:1.5},{from:-1},{from:NaN},{to:100},{to:Infinity}])await assert.rejects(f.store.source(f.tx,'scope','access',{...query,...bad},x=>x),{code:'INVALID_CONFIG'});
 await assert.rejects(f.store.source(f.tx,'scope','missing',query,x=>x),{code:'INVALID_CONFIG'});assert.equal(f.calls.length,0);
 assert.deepEqual(await f.store.source(f.tx,'scope','access',{...query,filters:{source:'operation'}},x=>x),[]);assert.equal(f.calls.length,0);
 f.state.rows=[row()];let mapped:AuditStorageRow|undefined;assert.deepEqual(await f.store.source(f.tx,'scope','access',query,x=>{mapped=x;return 'projected';}),['projected']);
 assert.equal(mapped!.occurredAt,100);assert.equal(mapped!.revision,Number.MAX_SAFE_INTEGER);assert.equal(mapped!.sequence,0);assert.equal(mapped!.position,null);assert.equal(mapped!.retryable,true);assert.equal(mapped!.recoveryInvalidated,false);assert.equal((mapped as unknown as {unclassified:string}).unclassified,'retained');assert.equal(Object.isFrozen(mapped),false);
 for(const field of ['occurredAt','revision','sequence','position'])for(const value of ['01','-1','1.0',' 1','1\n','9007199254740992',-1,1.5,undefined,true]){f.state.rows=[{...row(),[field]:value}];let calls=0;await assert.rejects(f.store.source(f.tx,'scope','access',query,()=>{calls++;}),{code:'INTEGRITY_FAILURE'});assert.equal(calls,0);}
 for(const field of ['retryable','recoveryInvalidated'])for(const value of ['0','1',2,undefined]){f.state.rows=[{...row(),[field]:value}];await assert.rejects(f.store.source(f.tx,'scope','access',query,x=>x),{code:'INTEGRITY_FAILURE'});}
 for(const value of [null,true,false,0,1]){f.state.rows=[{...row(),retryable:value,recoveryInvalidated:value}];const [out]=await f.store.source(f.tx,'scope','access',query,x=>x);assert.equal(out!.retryable,value===null?null:!!value);}
 const failure=new Error('original');f.state.rows=[row()];await assert.rejects(f.store.source(f.tx,'scope','access',query,()=>{throw failure;}),e=>e===failure);f.state.failure=failure;await assert.rejects(f.store.source(f.tx,'scope','access',query,x=>x),e=>e===failure);
});

test('68 owner projection aliases policy array identity and zero constructor prototype compatibility preserve lazy decoding',async()=>{
 assert.equal(AuditReadModels,LegacyModels);assert.equal(auditStoragePolicy,legacyPolicy);assert.equal(auditStoragePolicy.sources,AUDIT_SOURCES);assert.equal(auditStoragePolicy.errorCodes,AUDIT_ERROR_CODES);assert.ok(Object.isFrozen(auditStoragePolicy));assert.equal(Object.isFrozen(AUDIT_SOURCES),false);
 const tx={},raw={private:'still unvalidated'};let seen:unknown;const models=new AuditReadModels({async source(actual,scope,source,actualQuery,project){assert.equal(actual,tx);assert.equal(scope,'scope');assert.equal(source,'access');assert.equal(actualQuery,query);seen=project(raw as unknown as AuditStorageRow);return [seen] as never[];}});
 assert.equal((await models.source(tx,'scope','access',query))[0],raw);assert.equal(seen,raw);
 const f=fixture();f.state.rows=[row()];const native=Object.create(MySqlAuditEvents.prototype) as MySqlAuditEvents;const output=await native.source(f.tx,'scope','access',query);assert.equal(output[0]!.occurredAt,100);assert.equal((output[0] as unknown as {unclassified:string}).unclassified,'retained');
});

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
test('68 migrated MySQL executes all fifteen audit SQL families and immutable node filters while access projection redacts raw JSON and preserves every table',{skip:!databaseURL},async()=>{
 const name='tunex_a68_'+randomUUID().replaceAll('-',''),admin=await createConnection(databaseURL!);let db:MySqlUnitOfWork|undefined,created=false;
 try{
  await admin.query(`CREATE DATABASE \`${name}\``);created=true;const url=new URL(databaseURL!);url.pathname='/'+name;db=new MySqlUnitOfWork(url.toString());await db.migrate();const active=db;
  await db.transaction(async tx=>{await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',['actor','a'.repeat(64)]);await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',['scope','actor']);await write(tx,'INSERT INTO access_events(id,scope_id,actor_id,subject_id,kind,revision,created_at,details) VALUES(?,?,?,?,?,?,?,?)',['event','scope','actor','subject','node_grant_change',1,150,JSON.stringify({nodeId:'node',token:'DO_NOT_EXPOSE',nested:{password:'DO_NOT_EXPOSE'}})]);});
  async function snapshot(){const tables=await rows<{name:string}>(active.pool,'SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');return Object.fromEntries(await Promise.all(tables.map(async({name})=>[name,(await rows(active.pool,`SELECT * FROM \`${name}\``)).map(value=>JSON.stringify(value)).sort()])));}
  const before=await snapshot(),store=new MySqlAuditReadStore(auditStoragePolicy);
  await db.transaction(async tx=>{for(const source of AUDIT_SOURCES){const plain=await store.source(tx,'scope',source,query,x=>x),node=await store.source(tx,'scope',source,{...query,filters:{nodeId:'node'}},x=>x);assert.equal(plain.length,source==='access'?1:0,source);assert.equal(node.length,source==='access'?1:0,source+' node');assert.deepEqual(await store.source(tx,'other-scope',source,query,x=>x),[]);}});
  let authCalls=0;const service=new AuditEvents(db,{async scope(_tx,actor,scope,manage){assert.equal(actor,'actor');assert.equal(scope,'scope');assert.equal(manage,true);authCalls++;}},new AuditReadModels(store),()=>200);
  const report=await service.query('actor','scope',{from:new Date(100).toISOString(),to:new Date(200).toISOString(),nodeId:'node'});assert.equal(authCalls,1);assert.equal(report.items.length,1);assert.equal(report.items[0]!.nodeAssociation,'explicit-node');assert.equal(report.items[0]!.nodeId,'node');assert.equal(report.items[0]!.revisionKind,'grant');assert.doesNotMatch(JSON.stringify(report),/DO_NOT_EXPOSE|password|token/);assert.deepEqual(await snapshot(),before);
 }finally{try{await db?.close();if(created)await admin.query(`DROP DATABASE \`${name}\``);}finally{await admin.end();}}
});
