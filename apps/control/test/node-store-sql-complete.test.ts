import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'mysql2/promise';
import { NodeService, NodePortLimitPolicy } from '../src/modules/node-owner/public.ts';
import { Nodes } from '../src/modules/nodes.ts';
import { Identity } from '../src/modules/identity.ts';
import { nativeNodeCodec } from '../src/compatibility/public.ts';
import { MySqlNodeAuthorityStore, MySqlNodeMachineLookup } from '../src/infrastructure/mysql-node-authority.ts';
import { createMySqlRuntimeResources, MySqlRuntimeResourceStore } from '../src/infrastructure/mysql-runtime-resources.ts';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import type { AuthorizedNodeFacts, NodeCertificateSigner } from '../src/framework/public.ts';

type Statement=readonly [string,readonly unknown[]];
const facts:AuthorizedNodeFacts={nodeId:'node',scopeId:'scope',capabilities:['adp.3','native.direct.v1','tcp'],allowedListenerAddresses:['127.0.0.1'],allowedPorts:[32001],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false};
const signed={certificate:'CERT',ca:'CA',fingerprint:'f'.repeat(64),until:100000},response={certificate:'CERT',ca:'CA'},json=JSON.stringify;
const sharedResource={resource_source:'admin-shared' as const,owner_actor_id:null,resource_revision:1};
const grantRoles=['ingress'] as const,grantPortLimits={allowedPorts:[32001],maxBindings:2};
type Case={name:string;run:(s:MySqlNodeAuthorityStore,tx:Transaction)=>Promise<unknown>;sql:Statement[];result?:'row'|'rows'|'true'};
const cases:Case[]=[
 {name:'quarantine',run:(s,t)=>s.quarantine(t),sql:[['UPDATE nodes SET revoked=TRUE',[]],['UPDATE node_credentials SET revoked=TRUE',[]],['UPDATE node_relay_credentials SET revoked=TRUE',[]]]},
 {name:'create',run:(s,t)=>s.create(t,'node','scope','actor','hash',9000,facts,sharedResource),sql:[['INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts,resource_source,owner_actor_id,resource_revision) VALUES(?,?,?,?,?,?,?,?)',['node','scope','hash',9000,json(facts),'admin-shared',null,1]]]},
 {name:'resourceAccess',run:(s,t)=>s.resourceAccess(t,'node','scope','actor'),sql:[['SELECT n.id,n.scope_id,n.resource_source,n.owner_actor_id,n.resource_revision,g.actor_id AS grant_actor_id,g.allowed_roles,g.port_limits FROM nodes n LEFT JOIN node_grants g ON g.node_id=n.id AND g.actor_id=? WHERE n.id=? AND n.scope_id=? FOR SHARE',['actor','node','scope']]],result:'row'},
 {name:'classify',run:(s,t)=>s.classify(t,'node',1,{resource_source:'private',owner_actor_id:'actor',resource_revision:2}),sql:[["UPDATE nodes SET resource_source=?,owner_actor_id=?,resource_revision=? WHERE id=? AND resource_source='legacy-unclassified' AND resource_revision=?",['private','actor',2,'node',1]]],result:'true'},
 {name:'clearGrants',run:(s,t)=>s.clearGrants(t,'node'),sql:[['DELETE FROM node_grants WHERE node_id=?',['node']]]},
 {name:'enrollment',run:(s,t)=>s.enrollment(t,'node','hash'),sql:[['SELECT * FROM nodes WHERE id=? AND enrollment_hash=? FOR UPDATE',['node','hash']]],result:'row'},
 {name:'acceptEnrollment',run:(s,t)=>s.acceptEnrollment(t,'node','digest',signed,response),sql:[['UPDATE nodes SET csr_digest=?,credential_fingerprint=?,credential_until=?,enrollment_response=? WHERE id=?',['digest',signed.fingerprint,100000,json(response),'node']]]},
 {name:'insertCredential',run:(s,t)=>s.insertCredential(t,'node',signed,123),sql:[['INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until) VALUES(?,?,?,?)',[signed.fingerprint,'node',123,100000]]]},
 {name:'credential',run:(s,t)=>s.credential(t,'node','fp'),sql:[['SELECT c.valid_until,c.retire_after FROM node_credentials c JOIN nodes n ON n.id=c.node_id WHERE c.fingerprint=? AND c.node_id=? AND c.revoked=FALSE AND n.revoked=FALSE FOR SHARE',['fp','node']]],result:'row'},
 {name:'state',run:(s,t)=>s.state(t,'node'),sql:[['SELECT * FROM nodes WHERE id=? FOR SHARE',['node']]],result:'row'},
 {name:'currentForUpdate',run:(s,t)=>s.currentForUpdate(t,'node'),sql:[['SELECT * FROM nodes WHERE id=? FOR UPDATE',['node']]],result:'row'},
 {name:'scopeGrant',run:(s,t)=>s.scopeGrant(t,'node','actor','scope'),sql:[['SELECT g.node_id FROM node_grants g JOIN nodes n ON n.id=g.node_id WHERE g.node_id=? AND g.actor_id=? AND n.scope_id=? FOR SHARE',['node','actor','scope']]],result:'true'},
 {name:'relayGrant',run:(s,t)=>s.relayGrant(t,'node','scope','actor'),sql:[['SELECT n.id FROM nodes n JOIN node_grants g ON g.node_id=n.id WHERE n.id=? AND n.scope_id=? AND g.actor_id=? FOR SHARE',['node','scope','actor']]],result:'true'},
 {name:'hasGrant',run:(s,t)=>s.hasGrant(t,'node','actor'),sql:[['SELECT node_id FROM node_grants WHERE node_id=? AND actor_id=? FOR SHARE',['node','actor']]],result:'true'},
 {name:'setFacts',run:(s,t)=>s.setFacts(t,'node',facts),sql:[['UPDATE nodes SET facts=? WHERE id=?',[json(facts),'node']]]},
 {name:'relayReplay',run:(s,t)=>s.relayReplay(t,'node','request'),sql:[['SELECT request_digest,response FROM relay_credential_requests WHERE node_id=? AND request_id=?',['node','request']]],result:'row'},
 {name:'rotationReplay',run:(s,t)=>s.rotationReplay(t,'node','request'),sql:[['SELECT * FROM credential_rotations WHERE node_id=? AND request_id=?',['node','request']]],result:'row'},
 {name:'activeRelayCredentials',run:(s,t)=>s.activeRelayCredentials(t,'node',101,102),sql:[['SELECT fingerprint,valid_until FROM node_relay_credentials WHERE node_id=? AND revoked=FALSE AND valid_until>? AND (retire_after IS NULL OR retire_after>?) ORDER BY issued_at FOR UPDATE',['node',101,102]]],result:'rows'},
 {name:'retireRelayCredentials',run:(s,t)=>s.retireRelayCredentials(t,'node',500),sql:[['UPDATE node_relay_credentials SET retire_after=LEAST(valid_until,?) WHERE node_id=? AND revoked=FALSE AND retire_after IS NULL',[500,'node']]]},
 {name:'insertRelayCredential',run:(s,t)=>s.insertRelayCredential(t,'node',signed,123,90000),sql:[['INSERT INTO node_relay_credentials(fingerprint,node_id,issued_at,valid_until,certificate) VALUES(?,?,?,?,?)',[signed.fingerprint,'node',123,90000,'CERT']]]},
 {name:'saveRelayRequest',run:(s,t)=>s.saveRelayRequest(t,'node','request','digest','fp',response),sql:[['INSERT INTO relay_credential_requests(node_id,request_id,request_digest,source_fingerprint,response) VALUES(?,?,?,?,?)',['node','request','digest','fp',json(response)]]]},
 ...[false,true].map(currentOnly=>({name:'relayCredentials-'+currentOnly,run:(s:MySqlNodeAuthorityStore,t:Transaction)=>s.relayCredentials(t,'node',101,102,currentOnly),sql:[['SELECT fingerprint,certificate,valid_until,retire_after FROM node_relay_credentials WHERE node_id=? AND revoked=FALSE AND valid_until>? AND (retire_after IS NULL OR retire_after>?) AND (?=FALSE OR retire_after IS NULL) ORDER BY fingerprint FOR SHARE',['node',101,102,currentOnly]]] as Statement[],result:'rows' as const})),
 {name:'retireCredential',run:(s,t)=>s.retireCredential(t,'node','fp',500),sql:[['UPDATE node_credentials SET retire_after=? WHERE node_id=? AND fingerprint=?',[500,'node','fp']]]},
 {name:'setCurrentCredential',run:(s,t)=>s.setCurrentCredential(t,'node',signed),sql:[['UPDATE nodes SET credential_fingerprint=?,credential_until=? WHERE id=?',[signed.fingerprint,100000,'node']]]},
 {name:'saveRotation',run:(s,t)=>s.saveRotation(t,'node','request','digest','fp',response),sql:[['INSERT INTO credential_rotations(node_id,request_id,request_digest,source_fingerprint,response) VALUES(?,?,?,?,?)',['node','request','digest','fp',json(response)]]]},
 {name:'securityEvent',run:(s,t)=>s.securityEvent(t,'event','node',null,'credential_rotation',123,{a:1,b:2}),sql:[['INSERT INTO node_security_events(id,node_id,actor_id,kind,created_at,details) VALUES(?,?,?,?,?,?)',['event','node',null,'credential_rotation',123,'{"a":1,"b":2}']]]},
 {name:'grantRevisionForUpdate',run:(s,t)=>s.grantRevisionForUpdate(t,'node'),sql:[['SELECT grant_revision FROM nodes WHERE id=? FOR UPDATE',['node']]],result:'row'},
 {name:'grantRevision',run:(s,t)=>s.grantRevision(t,'node','scope'),sql:[['SELECT grant_revision FROM nodes WHERE id=? AND scope_id=?',['node','scope']]],result:'row'},
 {name:'grantActors',run:(s,t)=>s.grantActors(t,'node'),sql:[['SELECT actor_id,allowed_roles,port_limits FROM node_grants WHERE node_id=? ORDER BY actor_id',['node']]],result:'rows'},
 {name:'insertGrant',run:(s,t)=>s.insertGrant(t,'node','actor',grantRoles,grantPortLimits),sql:[['INSERT INTO node_grants(node_id,actor_id,allowed_roles,port_limits) VALUES(?,?,?,?)',['node','actor',json(grantRoles),json(grantPortLimits)]]]},
 {name:'insertPrivateOwnerGrant',run:(s,t)=>s.insertGrant(t,'node','actor',null,null),sql:[['INSERT INTO node_grants(node_id,actor_id,allowed_roles,port_limits) VALUES(?,?,?,?)',['node','actor',null,null]]]},
 {name:'setGrantRoles',run:(s,t)=>s.setGrantRoles(t,'node','actor',grantRoles,grantPortLimits),sql:[['UPDATE node_grants SET allowed_roles=?,port_limits=? WHERE node_id=? AND actor_id=?',[json(grantRoles),json(grantPortLimits),'node','actor']]]},
 {name:'deleteGrant',run:(s,t)=>s.deleteGrant(t,'node','actor'),sql:[['DELETE FROM node_grants WHERE node_id=? AND actor_id=?',['node','actor']]]},
 {name:'setGrantRevision',run:(s,t)=>s.setGrantRevision(t,'node',123),sql:[['UPDATE nodes SET grant_revision=? WHERE id=?',[123,'node']]]},
 {name:'visible',run:(s,t)=>s.visible(t,'node','scope'),sql:[['SELECT id FROM nodes WHERE id=? AND scope_id=?',['node','scope']]],result:'true'},
 ...[false,true].map(lock=>({name:'scopedNode-'+lock,run:(s:MySqlNodeAuthorityStore,t:Transaction)=>s.scopedNode(t,'node','scope',lock),sql:[['SELECT * FROM nodes WHERE id=? AND scope_id=?'+(lock?' FOR UPDATE':''),['node','scope']]] as Statement[],result:'row' as const})),
 {name:'markRevoked',run:(s,t)=>s.markRevoked(t,'node'),sql:[['UPDATE nodes SET revoked=TRUE WHERE id=?',['node']],['UPDATE node_credentials SET revoked=TRUE WHERE node_id=?',['node']],['UPDATE node_relay_credentials SET revoked=TRUE WHERE node_id=?',['node']]]},
 {name:'credentials',run:(s,t)=>s.credentials(t,'node'),sql:[['SELECT fingerprint,valid_until,retire_after,revoked FROM node_credentials WHERE node_id=? ORDER BY issued_at',['node']]],result:'rows'},
];

for(const entry of cases)test('12/134 Node native SQL '+entry.name+' preserves exact statement arguments receiver and original first-error cutoff',async()=>{
 const row={sentinel:'unchanged native row'},returned=[row];
 for(const failAt of [-1,...entry.sql.map((_,i)=>i)]){const calls:Statement[]=[],failure=new Error(entry.name);let supplied:Transaction;
  supplied={async execute(this:unknown,sql:string,args:unknown[]=[]){assert.equal(this,supplied);calls.push([sql,args]);if(calls.length-1===failAt)throw failure;return [sql.startsWith('SELECT')?returned:{affectedRows:1},[]];}} as unknown as Transaction;
  if(failAt>=0){await assert.rejects(entry.run(new MySqlNodeAuthorityStore(),supplied),e=>e===failure);assert.deepEqual(calls,entry.sql.slice(0,failAt+1));}
  else {const result=await entry.run(new MySqlNodeAuthorityStore(),supplied);assert.deepEqual(calls,entry.sql);if(entry.result==='row')assert.equal(result,row);else if(entry.result==='rows')assert.equal(result,returned);else if(entry.result==='true')assert.equal(result,true);else assert.equal(result,undefined);}
 }
 if(entry.result){const empty={async execute(){return [[],[]];}} as unknown as Transaction;assert.deepEqual(await entry.run(new MySqlNodeAuthorityStore(),empty),entry.result==='row'?undefined:entry.result==='true'?false:[]);}
});

test('12 native pool machine lookup uses separate time samples no transaction and original pool receiver errors',async()=>{
 const expected:Statement=['SELECT c.node_id FROM node_credentials c JOIN nodes n ON n.id=c.node_id WHERE c.fingerprint=? AND c.revoked=FALSE AND n.revoked=FALSE AND c.valid_until>? AND (c.retire_after IS NULL OR c.retire_after>?)',['fp',101,102]];
 for(const failure of [false,true]){const error=new Error('pool'),row={node_id:'node'},calls:Statement[]=[];const pool={async execute(this:unknown,sql:string,args:unknown[]){assert.equal(this,pool);calls.push([sql,args]);if(failure)throw error;return [[row],[]];}};
  const lookup=new MySqlNodeMachineLookup({pool,transaction(){assert.fail('machine lookup cannot open transaction');}} as never);if(failure)await assert.rejects(lookup.machine('fp',101,102),e=>e===error);else assert.equal(await lookup.machine('fp',101,102),row);assert.deepEqual(calls,[expected]);
 }
});

test('12 static legacy quarantine retains exact three-table order and first failure',async()=>{
 const entry=cases[0]!;for(const failAt of [-1,0,1,2]){const calls:Statement[]=[],error=new Error('quarantine');const tx={async execute(sql:string,args:unknown[]=[]){calls.push([sql,args]);if(calls.length-1===failAt)throw error;return [{affectedRows:1},[]];}} as unknown as Transaction;
  if(failAt<0)await Nodes.quarantineRecovery(tx);else await assert.rejects(Nodes.quarantineRecovery(tx),e=>e===error);assert.deepEqual(calls,entry.sql.slice(0,failAt<0?3:failAt+1));
 }
});

test('12/134 native Node SQL preserves signed-field and native JSON evaluation before original execute errors',async()=>{
 const events:string[]=[],failure=new Error('native getter'),tx={async execute(){events.push('execute');return [{affectedRows:1},[]];}} as unknown as Transaction;
 const watched={get fingerprint(){events.push('fingerprint');return signed.fingerprint;},get until(){events.push('until');return signed.until;},get certificate(){events.push('certificate');return signed.certificate;},ca:'CA'};
 const body={get certificate(){events.push('json');throw failure;}};
 await assert.rejects(new MySqlNodeAuthorityStore().acceptEnrollment(tx,'node','digest',watched,body),e=>e===failure);assert.deepEqual(events,['fingerprint','until','json']);events.length=0;
 await new MySqlNodeAuthorityStore().insertRelayCredential(tx,'node',watched,123,9000);assert.deepEqual(events,['fingerprint','certificate','execute']);events.length=0;
 for(const method of ['saveRotation','saveRelayRequest'] as const){await assert.rejects(new MySqlNodeAuthorityStore()[method](tx,'node','request','digest','fp',body),e=>e===failure);assert.deepEqual(events,['json']);events.length=0;}
 const badFacts={get nodeId(){events.push('facts');throw failure;}};await assert.rejects(new MySqlNodeAuthorityStore().create(tx,'node','scope','actor','hash',100,badFacts as never,sharedResource),e=>e===failure);assert.deepEqual(events,['facts']);
});

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
async function withDatabase(action:(db:MySqlUnitOfWork)=>Promise<void>){
 const admin=await createConnection(databaseURL!),database='tunex_node_complete_'+randomUUID().replaceAll('-',''),url=new URL(databaseURL!);url.pathname='/'+database;
 const db=new MySqlUnitOfWork(url.toString());let created=false;
 try{await admin.query(`CREATE DATABASE \`${database}\``);created=true;await db.migrate();await db.transaction(async tx=>{await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',['actor','a'.repeat(64)]);await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',['scope','actor']);});await action(db);}
 finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${database}\``);}finally{await admin.end();}}
}
const names=['nodes','node_grants','node_credentials','node_relay_credentials','credential_rotations','relay_credential_requests','node_security_events','access_events','scope_members','runtime_nodes','execution_leases'] as const;
async function snapshot(db:MySqlUnitOfWork){return Object.fromEntries(await Promise.all(names.map(async name=>[name,await rows(db.pool,`SELECT * FROM ${name} ORDER BY 1,2`)])));}

test('12/134 canonical MySQL original Node enrollment rotation Relay issuance replay revocation and quarantine rollback every real write', {skip:!databaseURL},async()=>{
 await withDatabase(async db=>{
  const store=new MySqlNodeAuthorityStore(),old='1'.repeat(64),fresh='2'.repeat(64),relay='3'.repeat(64),csr='-----BEGIN CERTIFICATE REQUEST-----\noriginal',token='a'.repeat(32),tokenDigest='b'.repeat(64);
  const identity=new Identity(db);
  let now=1000,issued={...signed,fingerprint:old},signs=0;
  const signer:NodeCertificateSigner={async sign(){signs++;return {...issued};}};
  const resources=createMySqlRuntimeResources(new NodePortLimitPolicy(store,new MySqlRuntimeResourceStore()));
  const secrets={newID:()=>randomUUID(),newToken:()=>token,tokenHash:()=>tokenDigest};
  const statements:string[]=[],originals:Transaction[]=[];let failAt=-1,index=0;
  const wrapped=new Proxy(store,{get(target,key,receiver){const value=Reflect.get(target,key,receiver);if(typeof value!=='function')return value;return async function(tx:Transaction,...args:unknown[]){assert.ok(originals.includes(tx),'all SQL mutations use original supplied Tx');return Reflect.apply(value,target,[tx,...args]);};}});
  const boundary={async transaction<T>(action:(tx:Transaction)=>Promise<T>){return db.transaction(async tx=>{let proxy:Transaction;proxy=new Proxy(tx,{get(target,key,receiver){if(key==='execute')return async function(this:unknown,sql:string,args:unknown[]=[]){assert.equal(this,proxy);statements.push(sql);if(!sql.startsWith('SELECT')&&index++===failAt)throw failure;return Reflect.apply(target.execute,target,[sql,args]);};return Reflect.get(target,key,receiver);}});originals.push(proxy);return action(proxy);});}};
  const failure=new Error('fail original SQL write');
  const host=new NodeService({db:boundary,identity,store:wrapped,portLimits:new NodePortLimitPolicy(wrapped,new MySqlRuntimeResourceStore()),machine:new MySqlNodeMachineLookup(db),signer,resources,secrets,codec:nativeNodeCodec,now:()=>now,overlapSeconds:1,relayCredentialSeconds:60});
  await db.transaction(async tx=>{await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',['subject','c'.repeat(64)]);await write(tx,'INSERT INTO scope_members(scope_id,actor_id,can_manage) VALUES(?,?,TRUE),(?,?,FALSE)',['scope','actor','scope','subject']);await store.create(tx,'node','scope','actor',tokenDigest,10000,facts,sharedResource);await resources.initializeNode(tx,'node');await write(tx,'UPDATE runtime_nodes SET session_epoch=2 WHERE node_id=?',['node']);});
  assert.deepEqual(await rows(db.pool,'SELECT actor_id,allowed_roles,port_limits FROM node_grants WHERE node_id=?',['node']),[],'shared creation does not grant its creator implicit use');
  async function retryEachWrite(action:()=>Promise<unknown>,count:number){const before=await snapshot(db);for(let n=0;n<count;n++){failAt=n;index=0;statements.length=0;await assert.rejects(action(),e=>e===failure);assert.deepEqual(await snapshot(db),before,'rollback restores all Node credentials grants requests and events at write '+n);}failAt=-1;index=0;return action();}
  assert.deepEqual(await retryEachWrite(()=>host.enroll('node',token,csr),2),{certificate:'CERT',ca:'CA'});assert.equal(await host.machine(old),'node');
  const signedBefore=signs;assert.deepEqual(await host.enroll('node',token,csr),{certificate:'CERT',ca:'CA'});assert.equal(signs,signedBefore);
  issued={...signed,fingerprint:fresh};const rotation=await retryEachWrite(()=>host.rotate('node',old,2,'rotation',csr),5) as {fingerprint:string};assert.equal(rotation.fingerprint,fresh);
  const afterRotate=await snapshot(db),count=signs;assert.deepEqual(await host.rotate('node',old,2,'rotation',csr),rotation);assert.equal(signs,count);assert.deepEqual(await snapshot(db),afterRotate);
  await assert.rejects(host.rotate('node',old,2,'another',csr),e=>(e as {code:string}).code==='CREDENTIAL_SUPERSEDED');
  issued={...signed,fingerprint:relay};const relayResult=await retryEachWrite(()=>host.relayCredential('node',fresh,2,'relay',csr),4) as {validUntil:string;overlapUntil:null};assert.equal(relayResult.validUntil,nativeNodeCodec.formatTime(61000));assert.equal(relayResult.overlapUntil,null);
  const afterRelay=await snapshot(db);assert.deepEqual(await host.relayCredential('node',fresh,2,'relay',csr),relayResult);assert.deepEqual(await snapshot(db),afterRelay);
  const beforeSubjectAuthority=await snapshot(db);await assert.rejects(boundary.transaction(tx=>host.changeGrant(tx,'actor','scope','node','subject',1,true,grantRoles,grantPortLimits)),e=>(e as {code:string}).code==='AUTHORIZATION_DENIED');assert.deepEqual(await snapshot(db),beforeSubjectAuthority,'viewer subject is rejected by the original Scope management check before grant writes');
  await db.transaction(tx=>write(tx,'UPDATE scope_members SET can_manage=TRUE WHERE scope_id=? AND actor_id=?',['scope','subject']));assert.deepEqual(await rows(db.pool,'SELECT actor_id,can_manage FROM scope_members WHERE scope_id=? ORDER BY actor_id',['scope']),[{actor_id:'actor',can_manage:1},{actor_id:'subject',can_manage:1}]);
  const grant=await retryEachWrite(()=>boundary.transaction(tx=>host.changeGrant(tx,'actor','scope','node','subject',1,true,grantRoles,grantPortLimits)),3);assert.deepEqual(grant,{nodeId:'node',actorId:'subject',revision:2,allowed:true,changed:true,allowedRoles:grantRoles,portLimits:grantPortLimits});
  const visible=statements.lastIndexOf('SELECT id FROM nodes WHERE id=? AND scope_id=?'),runtime=statements.lastIndexOf('SELECT session_epoch FROM runtime_nodes WHERE node_id=? FOR UPDATE'),nodeLock=statements.lastIndexOf('SELECT * FROM nodes WHERE id=? AND scope_id=? FOR UPDATE');assert.ok(visible>=0&&visible<runtime&&runtime<nodeLock,'visibility precedes the original Runtime lock then scoped Node FOR UPDATE');
  const access=await rows<{kind:string;revision:number;subject_id:string}>(db.pool,'SELECT kind,revision,subject_id FROM access_events');assert.deepEqual(access,[{kind:'node_grant_change',revision:2,subject_id:'subject'}]);
  for(const method of ['markRevoked','quarantine'] as const){const before=await snapshot(db);for(let n=0;n<3;n++){let counter=0;await assert.rejects(db.transaction(async tx=>{const proxy=new Proxy(tx,{get(target,key,receiver){if(key==='execute')return async(sql:string,args:unknown[]=[])=>(counter++===n?Promise.reject(failure):Reflect.apply(target.execute,target,[sql,args]));return Reflect.get(target,key,receiver);}});await (method==='markRevoked'?store.markRevoked(proxy,'node'):store.quarantine(proxy));}),e=>e===failure);assert.deepEqual(await snapshot(db),before);}}
  await db.transaction(tx=>store.markRevoked(tx,'node'));for(const table of ['nodes','node_credentials','node_relay_credentials'])assert.ok((await rows<{revoked:number}>(db.pool,`SELECT revoked FROM ${table}`)).every(row=>row.revoked===1));
  const revoked=await snapshot(db);await db.transaction(tx=>store.quarantine(tx));assert.deepEqual(await snapshot(db),revoked);await assert.rejects(host.machine(fresh),e=>(e as {code:string}).code==='AUTHORIZATION_DENIED');
  now=10000;await assert.rejects(host.enroll('node',token,csr),e=>(e as {code:string}).code==='AUTHORIZATION_DENIED');
 });
});
