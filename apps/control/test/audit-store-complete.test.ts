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
import { Identity } from '../src/modules/identity.ts';
import { AuditEvents } from '../src/modules/audit-owner/public.ts';

const query:AuditReadQuery={from:100,to:200,limit:2,filters:{},before:null};
function fixture(){const calls:{sql:string;args:unknown[]}[]=[],state={rows:[] as unknown[],failure:undefined as unknown};const tx={async execute(this:unknown,sql:string,args:unknown[]){assert.equal(this,tx);calls.push({sql,args});if(state.failure)throw state.failure;return [state.rows,[]];}} as unknown as Transaction;return {calls,state,tx,store:new MySqlAuditReadStore(auditStoragePolicy)};}
const row=()=>({occurredAt:'100',revision:'9007199254740991',sequence:'0',position:null,retryable:1,recoveryInvalidated:0,unclassified:'retained'});

test('68 SQL projection retains every source owner immutable attribution and stable bounded ordering on supplied Tx',async()=>{
 const f=fixture(),owners:Record<typeof AUDIT_SOURCES[number],string>={access:'access_events','node-security':'node_security_events','forward-ownership':'forward_ownership_events',
  'resource-limits':'shared_resource_limit_audit',transport:'transport_events','path-template':'path_template_events','path-binding':'forward_path_bindings',
  'path-group':'path_group_events','path-group-binding':'forward_path_group_bindings','path-publication':'path_publication_events','path-publication-attempt':'path_publication_attempts',
  'ingress-group':'ingress_group_events','ingress-deployment':'ingress_deployment_events','ingress-deployment-attempt':'ingress_deployment_attempts',
  'ingress-migration':'ingress_migration_events','ingress-migration-attempt':'ingress_migration_attempts',operation:'operations'};
 for(const source of AUDIT_SOURCES){
  assert.deepEqual(await f.store.source(f.tx,'scope',source,query,x=>x),[]);const call=f.calls.at(-1)!;
  assert.ok(call.sql.includes('FROM '+owners[source]+' e'),source);assert.deepEqual(call.args,['scope',100,200]);
  assert.ok(call.sql.endsWith('ORDER BY audit.occurredAt DESC,CAST(audit.source AS BINARY) DESC,CAST(audit.`key` AS BINARY) DESC LIMIT 3'));
  assert.ok(call.sql.includes("CONCAT('sha256:',SHA2(CAST(JSON_ARRAY("));assert.ok(call.sql.includes('audit.occurredAt>=? AND audit.occurredAt<?'));
  assert.doesNotMatch(call.sql,/FOR UPDATE|INSERT |UPDATE |DELETE |SELECT \*/);
  if(source.endsWith('-attempt')){assert.ok(call.sql.includes("'owner-attempt' AS `recordType`"));assert.ok(call.sql.includes('LEFT JOIN '+owners[source]+' applied'));assert.ok(call.sql.includes("e.kind='compensate'"));assert.ok(call.sql.includes("ELSE 'OTHER_ERROR' END"));assert.ok(call.sql.includes("'invalid'"));}
  if(['path-publication','ingress-deployment','ingress-migration'].includes(source)){assert.ok(call.sql.includes("CASE WHEN e.kind='recovery' THEN NULL ELSE e.actor_id END"));assert.ok(call.sql.includes("'unattributed-recovery'"));}
  if(source==='operation'){assert.ok(call.sql.includes('LEFT JOIN forward_revisions r ON r.forward_id=e.forward_id AND r.revision=e.target_revision'));assert.ok(call.sql.includes("'requester-not-status-actor'"));assert.ok(call.sql.includes('e.updated_at AS `occurredAt`'));}
  if(source==='node-security')assert.ok(call.sql.includes('owner.scope_id=?'));
  if(source==='path-binding'||source==='path-group-binding')assert.ok(call.sql.includes('owner.scope_id=e.scope_id'));
 }
});

test('resource limit audit projects immutable event revision and explicit Node/subject while filtering before the bounded window',async()=>{
 const f=fixture();
 await f.store.source(f.tx,'scope','resource-limits',{...query,filters:{nodeId:'shared-node',actorId:'administrator'}},x=>x);
 const {sql,args}=f.calls[0]!;
 assert.deepEqual(args,['scope','shared-node',100,200,'administrator']);
 for(const clause of ['JOIN shared_resource_limit_buckets b ON b.bucket_id=e.bucket_id','WHERE b.scope_id=?',
  'JSON_ARRAY(e.event_id)','e.at_ms AS `occurredAt`',"'configure' AS `kind`",'e.actor_id AS `actorId`','b.actor_id AS `subjectId`',
  "'node' AS `entityKind`",'b.node_id AS `entityId`','b.node_id AS `nodeId`',"'explicit-node' AS `nodeAssociation`",
  "JSON_EXTRACT(e.body,'$.revision')","'resource' AS `revisionKind`",'CAST(b.node_id AS BINARY)=CAST(? AS BINARY)',
  'CAST(audit.`actorId` AS BINARY)=CAST(? AS BINARY)'])assert.ok(sql.includes(clause),clause);
 assert.doesNotMatch(sql,/b\.revision|e\.body AS|shared_resource_limit_heads|node_grants|SUM\(|COUNT\(/);
 assert.ok(sql.endsWith('DESC LIMIT 3'));
});

test('68 SQL node association follows immutable plans template revisions and accepted compensation rather than current routes',async()=>{
 const f=fixture();
 for(const source of AUDIT_SOURCES){f.calls.length=0;await f.store.source(f.tx,'scope',source,{...query,filters:{nodeId:'node'}},x=>x);if(source==='transport'){assert.equal(f.calls.length,0);continue;}
  const {sql,args}=f.calls[0]!;assert.ok(!sql.includes('__AUDIT_NODE__'));assert.deepEqual(args.slice(-2),[100,200]);assert.ok(args.slice(1,-2).length>0);assert.ok(args.slice(1,-2).every(x=>x==='node'));
  if(source==='path-template')assert.ok(sql.includes("JSON_EXTRACT(r.config,'$.nodes')"));
  if(source==='path-group'||source==='ingress-group'){
   const collection=source==='path-group'?'candidates':'members';
   assert.ok(sql.includes(` JOIN JSON_TABLE(r.config,'$.${collection}[*]' COLUMNS (`+
    "template_id VARCHAR(128) PATH '$.template.templateId',template_revision BIGINT PATH '$.template.revision',"+
    "config_digest VARCHAR(71) PATH '$.template.configDigest')) audit_members ON TRUE "+
    'JOIN path_template_revisions audit_template ON audit_template.scope_id=e.scope_id AND audit_template.template_id=audit_members.template_id '+
    'AND audit_template.revision=audit_members.template_revision AND audit_template.config_digest=audit_members.config_digest'),source);
   assert.ok(sql.includes("WHERE e.scope_id=? AND (JSON_CONTAINS(JSON_EXTRACT(audit_template.config,'$.nodes'),JSON_QUOTE(?)))"));
  }
  if(source==='path-publication'||source==='ingress-deployment'||source==='ingress-migration'){
   const selections=source==='path-publication'?[['$.items[*]','$.source.spec'],['$.items[*]','$.proposedSpec']]:source==='ingress-deployment'?[['$.items[*]','$.spec']]:[['$.items[*]','$.spec'],['$.sources[*]','$.state.spec']];
   for(const [index,[collection,path]] of selections.entries()){
    const alias='audit_specs_'+index,expectedSpec=`(CAST(CASE WHEN JSON_TYPE(JSON_EXTRACT(${alias}.spec,'$.ingress.nodeId'))='STRING' THEN JSON_UNQUOTE(JSON_EXTRACT(${alias}.spec,'$.ingress.nodeId')) ELSE NULL END AS BINARY)=CAST(? AS BINARY) OR JSON_CONTAINS(JSON_EXTRACT(${alias}.spec,'$.path.via'),JSON_QUOTE(?)))`;
    assert.ok(sql.includes(` LEFT JOIN JSON_TABLE(p.plan,'${collection}' COLUMNS (spec JSON PATH '${path}')) ${alias} ON TRUE`),source+' '+path);assert.ok(sql.includes(expectedSpec));
   }
  }
  if(['path-group','ingress-group','path-publication','ingress-deployment','ingress-migration'].includes(source)){
   assert.doesNotMatch(sql,/EXISTS\s*\(|SELECT COUNT\(\*\) FROM JSON_TABLE/);assert.ok(sql.startsWith('SELECT audit.* FROM (SELECT DISTINCT '));assert.equal((sql.match(/JOIN JSON_TABLE\(/g)??[]).length,source==='path-publication'||source==='ingress-migration'?2:1);
   await f.store.source(f.tx,'scope',source,query,x=>x);assert.doesNotMatch(f.calls.at(-1)!.sql,/JSON_TABLE|SELECT DISTINCT/);assert.deepEqual(f.calls.at(-1)!.args,['scope',100,200]);
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
test('resource audit MySQL keeps both immutable revisions after the bucket changes and isolates Scope Node and initiating actor',{skip:!databaseURL},async()=>{
 const name='tunex_resource_audit_'+randomUUID().replaceAll('-',''),admin=await createConnection(databaseURL!);let db:MySqlUnitOfWork|undefined,created=false;
 try{
  await admin.query(`CREATE DATABASE \`${name}\``);created=true;const url=new URL(databaseURL!);url.pathname='/'+name;db=new MySqlUnitOfWork(url.toString());await db.migrate();
  await db.transaction(async tx=>{
   for(const [actor,hash] of [['administrator','c'],['member','d']])await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',[actor,hash!.repeat(64)]);
   await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',['scope','administrator']);
   await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts,resource_source) VALUES(?,?,?,?,?,?)',['node','scope','e'.repeat(64),10000,'{}','admin-shared']);
   await write(tx,'INSERT INTO shared_resource_limit_heads(node_id,actor_id) VALUES(?,?)',['node','member']);
   await write(tx,'INSERT INTO shared_resource_limit_buckets(bucket_id,scope_id,node_id,actor_id,revision,starts_at,ends_at,bytes_per_second,burst_bytes,byte_limit) VALUES(?,?,?,?,?,?,?,?,?,?)',
    ['bucket','scope','node','member',2,0,10000,10,20,1000]);
   await write(tx,'UPDATE shared_resource_limit_heads SET bucket_id=?,revision=? WHERE node_id=? AND actor_id=?',['bucket',2,'node','member']);
   for(const revision of [1,2])await write(tx,'INSERT INTO shared_resource_limit_audit(event_id,actor_id,bucket_id,at_ms,body) VALUES(?,?,?,?,?)',
    ['event-'+revision,'administrator','bucket',149+revision,JSON.stringify({revision,private:'DO_NOT_EXPOSE_POLICY_BODY'})]);
   await write(tx,'UPDATE shared_resource_limit_buckets SET revision=9,byte_limit=500 WHERE bucket_id=?',['bucket']);
   await write(tx,'UPDATE shared_resource_limit_heads SET revision=9 WHERE node_id=? AND actor_id=?',['node','member']);
  });
  const store=new MySqlAuditReadStore(auditStoragePolicy);
  await db.transaction(async tx=>{
   const records=await store.source(tx,'scope','resource-limits',{...query,filters:{nodeId:'node',actorId:'administrator'}},value=>value);
   assert.equal(records.length,2);assert.deepEqual(records.map(record=>record.revision),[2,1]);
   assert.notEqual(records[0]!.key,records[1]!.key);
   for(const record of records){assert.equal(record.subjectId,'member');assert.equal(record.actorId,'administrator');assert.equal(record.entityKind,'node');
    assert.equal(record.entityId,'node');assert.equal(record.nodeId,'node');assert.equal(record.nodeAssociation,'explicit-node');assert.equal(record.revisionKind,'resource');}
   assert.doesNotMatch(JSON.stringify(records),/DO_NOT_EXPOSE_POLICY_BODY|byte_limit|byteLimit/);
   assert.deepEqual(await store.source(tx,'other-scope','resource-limits',query,value=>value),[]);
   for(const filters of [{nodeId:'other-node'},{actorId:'member'}])assert.deepEqual(await store.source(tx,'scope','resource-limits',{...query,filters},value=>value),[]);
  });
 }finally{try{await db?.close();if(created)await admin.query(`DROP DATABASE \`${name}\``);}finally{await admin.end();}}
});

test('68 migrated MySQL executes declared audit SQL families and immutable node filters while access projection redacts raw JSON and preserves every table',{skip:!databaseURL},async()=>{
 const name='tunex_a68_'+randomUUID().replaceAll('-',''),admin=await createConnection(databaseURL!);let db:MySqlUnitOfWork|undefined,created=false;
 try{
  await admin.query(`CREATE DATABASE \`${name}\``);created=true;const url=new URL(databaseURL!);url.pathname='/'+name;db=new MySqlUnitOfWork(url.toString());await db.migrate();const active=db;
  await db.transaction(async tx=>{await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',['actor','a'.repeat(64)]);await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',['scope','actor']);await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',['selfservice-manager','b'.repeat(64)]);for(const actor of ['actor','selfservice-manager'])await write(tx,'INSERT INTO scope_members(scope_id,actor_id,can_manage,active) VALUES(?,?,TRUE,TRUE)',['scope',actor]);await write(tx,'INSERT INTO access_events(id,scope_id,actor_id,subject_id,kind,revision,created_at,details) VALUES(?,?,?,?,?,?,?,?)',['event','scope','actor','subject','node_grant_change',1,150,JSON.stringify({nodeId:'node',token:'DO_NOT_EXPOSE',nested:{password:'DO_NOT_EXPOSE'}})]);});
  async function snapshot(){const tables=await rows<{name:string}>(active.pool,'SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');return Object.fromEntries(await Promise.all(tables.map(async({name})=>[name,(await rows(active.pool,`SELECT * FROM \`${name}\``)).map(value=>JSON.stringify(value)).sort()])));}
  const before=await snapshot(),store=new MySqlAuditReadStore(auditStoragePolicy);
  await db.transaction(async tx=>{for(const source of AUDIT_SOURCES){const plain=await store.source(tx,'scope',source,query,x=>x),node=await store.source(tx,'scope',source,{...query,filters:{nodeId:'node'}},x=>x);assert.equal(plain.length,source==='access'?1:0,source);assert.equal(node.length,source==='access'?1:0,source+' node');assert.deepEqual(await store.source(tx,'other-scope',source,query,x=>x),[]);}});
  let authCalls=0;const identity=new Identity(db),service=new AuditEvents(db,{async scope(){assert.fail('Audit reader must use owner authorization');},async owner(tx,actor,scope,...extra:unknown[]){assert.equal(actor,'actor');assert.equal(scope,'scope');assert.deepEqual(extra,[]);authCalls++;await identity.owner(tx,actor,scope);}},new AuditReadModels(store),()=>200);
  const report=await service.query('actor','scope',{from:new Date(100).toISOString(),to:new Date(200).toISOString(),nodeId:'node'});assert.equal(authCalls,1);assert.equal(report.items.length,1);assert.equal(report.items[0]!.nodeAssociation,'explicit-node');assert.equal(report.items[0]!.nodeId,'node');assert.equal(report.items[0]!.revisionKind,'grant');assert.doesNotMatch(JSON.stringify(report),/DO_NOT_EXPOSE|password|token/);assert.deepEqual(await snapshot(),before);
  await db.transaction(tx=>identity.scope(tx,'selfservice-manager','scope',true));const denied=new AuditEvents(db,identity,{async source(){assert.fail('same-Scope manager reached audit SQL');}},()=>200);await assert.rejects(denied.query('selfservice-manager','scope',{from:new Date(100).toISOString(),to:new Date(200).toISOString()}),{code:'AUTHORIZATION_DENIED'});assert.deepEqual(await snapshot(),before);
 }finally{try{await db?.close();if(created)await admin.query(`DROP DATABASE \`${name}\``);}finally{await admin.end();}}
});
