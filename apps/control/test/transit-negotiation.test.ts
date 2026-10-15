import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {TRANSIT_NEGOTIATION_CAPABILITIES,parseTransitNegotiation,checkTransitNegotiation} from '@tunex/contracts';
import {MySqlUnitOfWork,rows,write} from '../src/infrastructure/mysql.ts';
import {TransitNegotiator} from '../src/modules/runtime/transit-negotiation.ts';
import {ControlError} from '../src/application/errors.ts';
import {createApp} from '../src/api/app.ts';

const url=process.env.TUNEX_TEST_DATABASE_URL;
const rejectCode=(code:string)=>(error:unknown):boolean=>error instanceof ControlError&&error.code===code;
test('real MySQL TLS-bound Transit handshake rejects retired boot, credential revocation and capability spoofing',
 {skip:!url},async()=>{
 const db=new MySqlUnitOfWork(url!);
 const unique=randomUUID().replaceAll('-','').slice(0,16);
 const account='tha-'+unique,scope='ths-'+unique,node='thn-'+unique;
 const fingerprint='b'.repeat(48)+unique,boot='boot-'+unique;
 const caps=['adp.3','native.direct.v1','tcp','udp',...TRANSIT_NEGOTIATION_CAPABILITIES];
 const current=Date.now();
 const body={
  protocolVersion:3 as const,extensionVersion:1 as const,nodeId:node,bootId:boot,sessionEpoch:8,
  requiredCapabilities:TRANSIT_NEGOTIATION_CAPABILITIES,lastStoredTransitGeneration:0,
 };
 const handshake=parseTransitNegotiation('Request',JSON.stringify(body));
 const negotiation=new TransitNegotiator(db);
 try {
  await db.migrate();
  await db.transaction(async tx=>{
   await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',[account,'a'.repeat(48)+unique]);
   await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',[scope,account]);
   await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts) VALUES(?,?,?,?,?,?)',
    [node,scope,'c'.repeat(48)+unique,9999999999999,current+300000,JSON.stringify({capabilities:caps})]);
   await write(tx,'INSERT INTO runtime_nodes(node_id,session_epoch,boot_id) VALUES(?,?,?)',[node,8,boot]);
   await write(tx,'INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until) VALUES(?,?,?,?)',
    [fingerprint,node,current,current+240000]);
  });
  const ack=parseTransitNegotiation('Response',JSON.stringify(await negotiation.hello(node,fingerprint,8,handshake)));
  checkTransitNegotiation(handshake,ack);
  assert.equal(ack.executionEnabled,false);
  assert.equal(ack.state,'contract-only');
  await assert.rejects(negotiation.hello(node,'f'.repeat(64),8,handshake),rejectCode('AUTHORIZATION_DENIED'));
  await assert.rejects(negotiation.hello(node,fingerprint,9,handshake),rejectCode('SESSION_SUPERSEDED'));
  await assert.rejects(negotiation.hello(node,fingerprint,8,{...handshake,lastStoredTransitGeneration:1}),rejectCode('FENCING_REJECTED'));

  await write(db.pool,'UPDATE runtime_nodes SET boot_id=? WHERE node_id=?',['retired-boot',node]);
  await assert.rejects(negotiation.hello(node,fingerprint,8,handshake),rejectCode('SESSION_SUPERSEDED'));
  await write(db.pool,'UPDATE runtime_nodes SET boot_id=? WHERE node_id=?',[boot,node]);

  await write(db.pool,'UPDATE node_credentials SET revoked=TRUE WHERE fingerprint=?',[fingerprint]);
  await assert.rejects(negotiation.hello(node,fingerprint,8,handshake),rejectCode('AUTHORIZATION_DENIED'));
  await write(db.pool,'UPDATE node_credentials SET revoked=FALSE,retire_after=? WHERE fingerprint=?',
   [current-1,fingerprint]);
  await assert.rejects(negotiation.hello(node,fingerprint,8,handshake),rejectCode('AUTHORIZATION_DENIED'));
  await write(db.pool,'UPDATE node_credentials SET retire_after=NULL WHERE fingerprint=?',[fingerprint]);

  await write(db.pool,'UPDATE nodes SET facts=? WHERE id=?',[JSON.stringify({capabilities:['adp.3','tcp','udp','native.direct.v1']}),node]);
  await assert.rejects(negotiation.hello(node,fingerprint,8,handshake),rejectCode('UNSUPPORTED_CAPABILITY'));
  const journals=await rows<{n:number}>(db.pool,
   'SELECT COUNT(*) n FROM transit_coordination WHERE forward_id LIKE ?',[node+'%']);
  assert.equal(Number(journals[0]?.n),0,'read-only capability handshake must not create deployment state');
 } finally{
  try{
   await db.transaction(async tx=>{
    await write(tx,'DELETE FROM node_credentials WHERE fingerprint=?',[fingerprint]);
    await write(tx,'DELETE FROM runtime_nodes WHERE node_id=?',[node]);
    await write(tx,'DELETE FROM nodes WHERE id=?',[node]);
    await write(tx,'DELETE FROM scopes WHERE id=?',[scope]);
    await write(tx,'DELETE FROM accounts WHERE id=?',[account]);
   });
  }finally{await db.close();}
 }
});

test('transit negotiation HTTP path refuses client without a verified TLS machine certificate',async()=>{
 const app=createApp({} as never,{} as never,{allow:async()=>{}} as never);
 const response=await app.request('/agent/v3/transit/hello',{
  method:'POST',headers:{'content-type':'application/json','x-tunex-session-epoch':'8'},
  body:JSON.stringify({protocolVersion:3,extensionVersion:1,nodeId:'node-b',bootId:'boot-b',
   sessionEpoch:8,requiredCapabilities:TRANSIT_NEGOTIATION_CAPABILITIES,
   lastStoredTransitGeneration:0}),
 });
 assert.equal(response.status,401);
 assert.equal((await response.json() as {code:string}).code,'UNAUTHENTICATED');
});
