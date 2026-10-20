import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'mysql2/promise';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { MySqlTransitMachineReader } from '../src/infrastructure/mysql-transit-machine.ts';
import { TransitNegotiationService } from '../src/modules/transit-owner/public.ts';
import { TRANSIT_NEGOTIATION_CAPABILITIES } from '../src/compatibility/public.ts';

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
test('62 real MySQL read-only negotiation locks raw machine in one Tx and releases on SQL clock JSON formatter failure without authority changes',{skip:!databaseURL},async t=>{
 const database='tunex_n62_'+randomUUID().replaceAll('-',''),admin=await createConnection(databaseURL!);let db:MySqlUnitOfWork|undefined,created=false;
 try{
  await admin.query(`CREATE DATABASE \`${database}\``);created=true;const url=new URL(databaseURL!);url.pathname='/'+database;db=new MySqlUnitOfWork(url.toString());await db.migrate();const activeDB=db;
  const now=1800000000000,fp='a'.repeat(64),facts={capabilities:[...TRANSIT_NEGOTIATION_CAPABILITIES]};
  await db.transaction(async tx=>{await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',['owner','b'.repeat(64)]);await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',['scope','owner']);await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts) VALUES(?,?,?,?,?,?)',['node','scope','c'.repeat(64),now+10000,now+10000,JSON.stringify(facts)]);await write(tx,'INSERT INTO runtime_nodes(node_id,session_epoch,boot_id) VALUES(?,?,?)',['node',2,'boot']);await write(tx,'INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until) VALUES(?,?,?,?)',[fp,'node',now-10,now+10000]);});
  async function snapshot(){const tables=await rows<{name:string}>(activeDB.pool,'SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');return Object.fromEntries(await Promise.all(tables.map(async({name})=>[name,(await rows(activeDB.pool,`SELECT * FROM \`${name}\``)).map(value=>JSON.stringify(value)).sort()])));}
  const before=await snapshot(),statements:[string,unknown[]][]=[],failure=new Error('native-failure');let mode='ok',transactions=0,ownerClockArmed=false;
  t.mock.method(Date,'now',()=>{if(!ownerClockArmed)return now;ownerClockArmed=false;if(mode==='clock')throw failure;return mode==='formatter'?NaN:now;});
  const boundary={async transaction<T>(action:(tx:Transaction)=>Promise<T>){transactions++;return activeDB.transaction(async tx=>{let proxy:Transaction;proxy=new Proxy(tx,{get(target,key,receiver){if(key==='execute')return async function(this:unknown,sql:string,args:unknown[]){assert.equal(this,proxy);statements.push([sql,args]);assert.ok(sql.startsWith('SELECT'),'negotiation must never write');if(mode==='sql')throw failure;const output=await Reflect.apply(target.execute,target,[sql,args]);if(mode==='json'){const row=(output[0] as {facts:unknown}[])[0];if(row)row.facts='{';}ownerClockArmed=true;return output;};return Reflect.get(target,key,receiver);}});return action(proxy);});}};
  const service=new TransitNegotiationService(boundary,new MySqlTransitMachineReader()),request={protocolVersion:3 as const,extensionVersion:1 as const,nodeId:'node',bootId:'boot',sessionEpoch:2,requiredCapabilities:TRANSIT_NEGOTIATION_CAPABILITIES,lastStoredTransitGeneration:0};
  for(mode of ['ok','sql','clock','json','formatter']){statements.length=0;const count=transactions;if(mode==='ok'){const ack=await service.hello('node',fp,2,request);assert.equal(ack.executionEnabled,false);assert.equal(ack.state,'contract-only');assert.equal(ack.requiredCapabilities,TRANSIT_NEGOTIATION_CAPABILITIES);}else await assert.rejects(service.hello('node',fp,2,request),mode==='sql'||mode==='clock'?(error:unknown)=>error===failure:mode==='json'?SyntaxError:RangeError);assert.equal(transactions,count+1);assert.equal(statements.length,1);assert.match(statements[0]![0],/LEFT JOIN node_credentials c ON c.node_id=r.node_id AND c.fingerprint=\?\n         WHERE r.node_id=\? FOR UPDATE$/);assert.deepEqual(statements[0]![1],[fp,'node']);ownerClockArmed=false;assert.deepEqual(await snapshot(),before);}
 }finally{try{await db?.close();if(created)await admin.query(`DROP DATABASE \`${database}\``);}finally{await admin.end();}}
});
