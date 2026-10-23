import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'mysql2/promise';
import { MySqlTransportProfileStore, MySqlRelayEndpointStore } from '../src/infrastructure/mysql-relay-configuration.ts';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { Transport } from '../src/modules/transport.ts';
import { RelayEndpoints } from '../src/modules/relay-endpoints.ts';
import { Identity } from '../src/modules/identity.ts';
import { Nodes } from '../src/modules/nodes.ts';
import { Forwarding } from '../src/modules/forwarding.ts';
import { Idempotency } from '../src/modules/idempotency.ts';
import type { NodeCertificateAuthority } from '../src/infrastructure/pki.ts';

type Statement=readonly [string,readonly unknown[]];
const record={scope_id:'scope',current_revision:3,revision:2,config:'opaque native JSON',grant_revision:4,actor_id:'actor',id:'profile',extra:'retained'};
type Case={name:string;run:(s:MySqlTransportProfileStore,t:Transaction)=>Promise<unknown>;sql:Statement;shape?:'row'|'rows'|'bool'|'count'};
const cases:Case[]=[
 {name:'quarantine',run:(s,t)=>s.quarantine(t),sql:['DELETE FROM transport_profile_grants',[]]},
 {name:'ensureProfile',run:(s,t)=>s.ensureProfile(t,'profile','scope'),sql:['INSERT INTO transport_profiles(id,scope_id) VALUES(?,?) ON DUPLICATE KEY UPDATE id=id',['profile','scope']]},
 {name:'publicationForUpdate',run:(s,t)=>s.publicationForUpdate(t,'profile'),sql:['SELECT scope_id,current_revision FROM transport_profiles WHERE id=? FOR UPDATE',['profile']],shape:'row'},
 {name:'revision',run:(s,t)=>s.revision(t,'profile',2),sql:['SELECT * FROM transport_profile_revisions WHERE profile_id=? AND revision=?',['profile',2]],shape:'row'},
 {name:'publishRevision',run:(s,t)=>s.publishRevision(t,'profile',2,'encoded','digest','actor',123),sql:['INSERT INTO transport_profile_revisions(profile_id,revision,config,config_digest,created_by,created_at) VALUES(?,?,?,?,?,?)',['profile',2,'encoded','digest','actor',123]]},
 {name:'setCurrentRevision',run:(s,t)=>s.setCurrentRevision(t,'profile',2),sql:['UPDATE transport_profiles SET current_revision=? WHERE id=?',[2,'profile']]},
 {name:'insertGrant',run:(s,t)=>s.insertGrant(t,'profile','actor'),sql:['INSERT INTO transport_profile_grants(profile_id,actor_id) VALUES(?,?)',['profile','actor']]},
 {name:'deleteGrant',run:(s,t)=>s.deleteGrant(t,'profile','actor'),sql:['DELETE FROM transport_profile_grants WHERE profile_id=? AND actor_id=?',['profile','actor']]},
 {name:'authorizedProfile',run:(s,t)=>s.authorizedProfile(t,'profile','scope','actor'),sql:['SELECT p.id FROM transport_profiles p JOIN transport_profile_grants g ON g.profile_id=p.id WHERE p.id=? AND p.scope_id=? AND g.actor_id=? FOR SHARE',['profile','scope','actor']],shape:'bool'},
 {name:'grantRevisionForUpdate',run:(s,t)=>s.grantRevisionForUpdate(t,'profile','scope'),sql:['SELECT grant_revision FROM transport_profiles WHERE id=? AND scope_id=? FOR UPDATE',['profile','scope']],shape:'row'},
 {name:'grantCount',run:(s,t)=>s.grantCount(t,'profile','actor'),sql:['SELECT actor_id FROM transport_profile_grants WHERE profile_id=? AND actor_id=?',['profile','actor']],shape:'count'},
 {name:'setGrantRevision',run:(s,t)=>s.setGrantRevision(t,'profile',4),sql:['UPDATE transport_profiles SET grant_revision=? WHERE id=?',[4,'profile']]},
 {name:'grantEvent',run:(s,t)=>s.grantEvent(t,'event','profile','actor','subject',4,123,'encoded'),sql:['INSERT INTO transport_events(id,profile_id,actor_id,subject_id,revision,created_at,details) VALUES(?,?,?,?,?,?,?)',['event','profile','actor','subject',4,123,'encoded']]},
 {name:'grantRevision',run:(s,t)=>s.grantRevision(t,'profile','scope'),sql:['SELECT grant_revision FROM transport_profiles WHERE id=? AND scope_id=?',['profile','scope']],shape:'row'},
 {name:'grantActors',run:(s,t)=>s.grantActors(t,'profile'),sql:['SELECT actor_id FROM transport_profile_grants WHERE profile_id=? ORDER BY actor_id',['profile']],shape:'rows'},
 {name:'currentRevision',run:(s,t)=>s.currentRevision(t,'profile','scope'),sql:['SELECT current_revision FROM transport_profiles WHERE id=? AND scope_id=?',['profile','scope']],shape:'row'},
 {name:'list',run:(s,t)=>s.list(t,'scope'),sql:['SELECT id,current_revision FROM transport_profiles WHERE scope_id=? ORDER BY id',['scope']],shape:'rows'},
];
for(const entry of cases)test('21 native Transport SQL '+entry.name+' literal args lazy raw shape receiver and original failure',async()=>{
 const returned=[record];for(const mode of ['row','empty','error'] as const){const failure=new Error('SQL'),calls:Statement[]=[];let tx:Transaction;tx={async execute(this:unknown,sql:string,args:unknown[]=[]){assert.equal(this,tx);calls.push([sql,args]);if(mode==='error')throw failure;return [sql.startsWith('SELECT')?(mode==='empty'?[]:returned):{affectedRows:1},[]];}} as unknown as Transaction;
  if(mode==='error')await assert.rejects(entry.run(new MySqlTransportProfileStore(),tx),e=>e===failure);else{const value=await entry.run(new MySqlTransportProfileStore(),tx);if(entry.shape==='row')assert.equal(value,mode==='row'?record:undefined);else if(entry.shape==='rows')mode==='row'?assert.equal(value,returned):assert.deepEqual(value,[]);else if(entry.shape==='bool')assert.equal(value,mode==='row');else if(entry.shape==='count')assert.equal(value,mode==='row'?1:0);else assert.equal(value,undefined);}assert.deepEqual(calls,[entry.sql]);
 }
});

test('21 endpoint SQL locks and upsert retain raw config exact original args receiver and first error',async()=>{
 for(const method of ['forUpdate','resolve','save'] as const)for(const mode of ['row','empty','error'] as const){const failure=new Error('endpoint SQL'),calls:Statement[]=[];let tx:Transaction;tx={async execute(this:unknown,sql:string,args:unknown[]=[]){assert.equal(this,tx);calls.push([sql,args]);if(mode==='error')throw failure;return [method==='save'?{affectedRows:1}:mode==='empty'?[]:[record],[]];}} as unknown as Transaction;
  const run=()=>method==='save'?new MySqlRelayEndpointStore().save(tx,'node',4,'encoded','actor',123):new MySqlRelayEndpointStore()[method](tx,'node');if(mode==='error')await assert.rejects(run(),e=>e===failure);else assert.equal(await run(),method==='save'||mode==='empty'?undefined:record);
  assert.deepEqual(calls,[method==='save'?['INSERT INTO node_relay_endpoints(node_id,revision,config,created_by,updated_at) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE revision=VALUES(revision),config=VALUES(config),created_by=VALUES(created_by),updated_at=VALUES(updated_at)',['node',4,'encoded','actor',123]]:['SELECT revision,config FROM node_relay_endpoints WHERE node_id=?'+(method==='forUpdate'?' FOR UPDATE':' FOR SHARE'),['node']]]);
 }
});

test('21 Transport legacy static recovery deletes only grant table and preserves original error',async()=>{for(const fail of [false,true]){const calls:Statement[]=[],failure=new Error('recovery');const tx={async execute(sql:string,args:unknown[]=[]){calls.push([sql,args]);if(fail)throw failure;return [{affectedRows:1},[]];}} as unknown as Transaction;if(fail)await assert.rejects(Transport.quarantineRecovery(tx),e=>e===failure);else await Transport.quarantineRecovery(tx);assert.deepEqual(calls,[['DELETE FROM transport_profile_grants',[]]]);}});

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
async function withDatabase(action:(db:MySqlUnitOfWork)=>Promise<void>){const admin=await createConnection(databaseURL!),database='tunex_transport_complete_'+randomUUID().replaceAll('-',''),url=new URL(databaseURL!);url.pathname='/'+database;const db=new MySqlUnitOfWork(url.toString());let created=false;try{await admin.query(`CREATE DATABASE \`${database}\``);created=true;await db.migrate();await action(db);}finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${database}\``);}finally{await admin.end();}}}
async function snapshot(db:MySqlUnitOfWork){const tables=await rows<{name:string}>(db.pool,'SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');return Object.fromEntries(await Promise.all(tables.map(async({name})=>[name,(await rows(db.pool,`SELECT * FROM \`${name}\``)).map(value=>JSON.stringify(value)).sort()])));}
const profile={driver:'native.relay.v1',wireVersion:1,security:'mutual-tls13',protocols:['tcp','udp'],handshakeTimeoutSeconds:5,idleTimeoutSeconds:60,maxFrameBytes:65536,maxUdpDatagramBytes:16384,maxConnectionsPerNode:4096},endpoint={listenAddress:'127.0.0.1',advertisedHost:'127.0.0.1',allowedTcpPorts:[32001]};

test('21 canonical MySQL Transport publish grants endpoints use original Identity Node Forward locks and every write rolls back original request history',{skip:!databaseURL},async()=>{
 await withDatabase(async db=>{
  const setup=new Identity(db);await setup.bootstrap('scope','owner','a'.repeat(32));await db.transaction(async tx=>{await setup.changeMember(tx,'owner','scope','subject',0,'manager','b'.repeat(32));await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts,resource_source,owner_actor_id,resource_revision) VALUES(?,?,?,?,?,?,?,?,?)',['node','scope','c'.repeat(64),999999,999999,'{}','private','owner',1]);await write(tx,'INSERT INTO runtime_nodes(node_id,session_epoch) VALUES(?,?)',['node',4]);});
  const failure=new Error('real native statement'),statements:Statement[]=[];let failAt=-1,ordinal=0;
  const boundary={async transaction<T>(action:(tx:Transaction)=>Promise<T>){return db.transaction(async tx=>{let proxy:Transaction;proxy=new Proxy(tx,{get(target,key,receiver){if(key==='execute')return async function(this:unknown,sql:string,args:unknown[]=[]){assert.equal(this,proxy);statements.push([sql,args]);if(!sql.startsWith('SELECT')&&ordinal++===failAt)throw failure;return Reflect.apply(target.execute,target,[sql,args]);};return Reflect.get(target,key,receiver);}});return action(proxy);});},pool:db.pool};
  const identity=new Identity(boundary as never),idempotency=new Idempotency(),forwarding=new Forwarding(),transport=new Transport(boundary as never,identity,idempotency,forwarding),nodes=new Nodes(boundary as never,identity,{} as NodeCertificateAuthority),endpoints=new RelayEndpoints(boundary as never,identity,nodes,idempotency,forwarding);
  async function everyWrite(action:()=>Promise<unknown>,count:number){const before=await snapshot(db);for(let n=0;n<count;n++){failAt=n;ordinal=0;statements.length=0;await assert.rejects(action(),e=>e===failure);assert.deepEqual(await snapshot(db),before,'every original SQL write rollback '+n);}failAt=-1;ordinal=0;statements.length=0;return action();}
  // claim, ensure Profile, immutable revision, pointer, initial owner grant, response.
  const published=await everyWrite(()=>transport.publish('owner','scope','profile','publish',0,profile),6);const afterPublish=await snapshot(db);assert.deepEqual(await transport.publish('owner','scope','profile','publish',0,profile),published);assert.deepEqual(await snapshot(db),afterPublish);
  await everyWrite(()=>boundary.transaction(tx=>transport.applyGrant(tx,{actorId:'owner',scopeId:'scope',profileId:'profile',subject:'subject',expectedRevision:1,allowed:true})),3);
  const forwardIndex=statements.findIndex(([sql])=>sql==="SELECT id FROM forwards WHERE recovery_suspended=FALSE AND deleting=FALSE AND JSON_UNQUOTE(JSON_EXTRACT(spec,'$.transport.profileId'))=? FOR SHARE"),grantIndex=statements.findIndex(([sql])=>sql==='INSERT INTO transport_profile_grants(profile_id,actor_id) VALUES(?,?)');assert.ok(forwardIndex>=0&&forwardIndex<grantIndex);
  await everyWrite(()=>endpoints.change('owner','scope','node','endpoint',0,endpoint),4);
  const sql=statements.map(([text])=>text),nodeVisible=sql.indexOf('SELECT id FROM nodes WHERE id=? AND scope_id=?'),runtime=sql.indexOf('SELECT session_epoch FROM runtime_nodes WHERE node_id=? FOR UPDATE'),nodeLock=sql.indexOf('SELECT * FROM nodes WHERE id=? AND scope_id=? FOR UPDATE'),endpointLock=sql.indexOf('SELECT revision,config FROM node_relay_endpoints WHERE node_id=? FOR UPDATE'),forwardLock=sql.findIndex(text=>text.startsWith('SELECT id FROM forwards WHERE recovery_suspended=FALSE AND deleting=FALSE AND (')),save=sql.findIndex(text=>text.startsWith('INSERT INTO node_relay_endpoints(')),audit=sql.findIndex(text=>text.startsWith('INSERT INTO node_security_events('));assert.ok(nodeVisible>=0&&nodeVisible<runtime&&runtime<nodeLock&&nodeLock<endpointLock&&endpointLock<forwardLock&&forwardLock<save&&save<audit);
  await db.transaction(tx=>write(tx,'INSERT INTO forwards(id,scope_id,revision,spec,authorization_actor,owner_actor_id) VALUES(?,?,?,?,?,?)',['reference','scope',1,JSON.stringify({enabled:true,protocols:['tcp'],ingress:{nodeId:'node',listen:{address:'127.0.0.1',port:32001}},target:{host:'127.0.0.1',port:80},transport:{profileId:'profile',configRevision:1},path:{via:['middle']}}),'owner','owner']));
  const noop=await endpoints.change('owner','scope','node','endpoint-noop',1,endpoint);assert.equal(noop.status,200);const beforeDenied=await snapshot(db);await assert.rejects(endpoints.change('owner','scope','node','endpoint-changed',1,{...endpoint,allowedTcpPorts:[32002]}),e=>(e as {code:string}).code==='UNSUPPORTED_CAPABILITY');assert.deepEqual(await snapshot(db),beforeDenied);
  await db.transaction(tx=>write(tx,'UPDATE idempotency SET recovery_invalidated=TRUE WHERE request_key=?',['publish']));await assert.rejects(transport.publish('owner','scope','profile','publish',0,profile),e=>(e as {code:string}).code==='RECOVERY_REPLAY_REQUIRES_REVIEW');
  const beforeRecovery=await snapshot(db);await db.transaction(tx=>Transport.quarantineRecovery(tx));const recovered=await snapshot(db);for(const [name,value] of Object.entries(beforeRecovery))if(name!=='transport_profile_grants')assert.deepEqual(recovered[name],value,'static Transport recovery leaves original history table '+name);assert.deepEqual(recovered.transport_profile_grants,[]);
 });
});
