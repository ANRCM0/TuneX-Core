import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { digest } from '@tunex/contracts';
import { ControlError } from '../src/application/errors.ts';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import { TransitCoordinationJournal, offlineTransitStep } from '../src/modules/runtime/transit-coordination.ts';
import type { OfflineTransitCommand, TransitObservationProof } from '../src/modules/runtime/transit-coordination.ts';
import type { TransitStageRow } from '../src/modules/runtime/transit-staging.ts';
import { verifyTransitStage, TransitStagingCoordinator } from '../src/modules/runtime/transit-staging.ts';

const url=process.env.TUNEX_TEST_DATABASE_URL;
function assertCode(code:string) {
 return (error:unknown):boolean=>error instanceof ControlError&&error.code===code;
}
function stageFixture(account:string,scope:string,forwardId:string,nodes:string[]):TransitStageRow {
 const now=Date.now();
 const assignments=nodes.map((nodeId,i)=>{
  const role=(i===0?'ingress':i===2?'egress':'transit') as 'ingress'|'transit'|'egress';
  return {
   assignmentId:'test-'+i, nodeId,role,protocol:'tcp' as const,
   sessionEpoch:1,bindingFence:i+4,
   resource:{nodeId,role,forwardProtocol:'tcp' as const,physicalProtocol:'tcp' as const,
    address:'127.0.0.1',port:32001+i},
   ...(i>0?{upstreamNodeId:nodes[i-1]}:{}),
   ...(i<2?{downstreamNodeId:nodes[i+1]}:{}),
  };
 });
 const body={
  executable:false as const,scopeId:scope,forwardId,
  forwardRevision:1,deploymentGeneration:1,
  profileDigest:'sha256:'+'1'.repeat(64),pathDigest:'sha256:'+'2'.repeat(64),
  authorizationUntil:now+240000,activationOrder:[...nodes].reverse(),
  assignments,intents:[],
 };
 const planDigest=digest(body);
 return {
  forward_id:forwardId,generation:1,target_revision:1,scope_id:scope,
  created_by:account,state:'reserved',expires_at:now+180000,
  plan_digest:planDigest,body:{...body,planDigest},created_at:now,updated_at:now,
 };
}
function observation(command:OfflineTransitCommand,reportSequence:number):TransitObservationProof {
 return {
  commandDigest:command.commandDigest,nodeId:command.nodeId,action:command.action,
  reportSequence,receivedAt:Date.now(),
  assignments:command.assignments.map(a=>({
   assignmentId:a.assignmentId,sessionEpoch:a.sessionEpoch,
   bindingFence:a.bindingFence,deploymentGeneration:command.generation,
   condition:command.action==='prepare'?'prepared':
    command.action==='activate'?'ready':'removed',
  })),
 };
}

test('offline Transit coordination plan remains downstream-first, ingress-first on withdrawal',()=>{
 const nodes=['a','b','c'];
 const stage=stageFixture('owner','scope','forward',nodes);
 const plan=verifyTransitStage(stage);
 const progress={forwardId:'forward',generation:1,planDigest:plan.planDigest,
  phase:'preparing' as const,position:0,revision:1,receiptHighwater:{}};
 const first=offlineTransitStep(plan,progress);
 assert.equal(first?.nodeId,'c');
 assert.equal(first?.action,'prepare');
 assert.equal(first?.assignments[0]?.bindingFence,6);
 assert.equal(offlineTransitStep(plan,{...progress,phase:'activating',position:2})?.nodeId,'a');
 assert.equal(offlineTransitStep(plan,{...progress,phase:'compensating'})?.nodeId,'a');
 assert.equal(offlineTransitStep(plan,{...progress,phase:'sealed',position:3}),null);
});

test('offline coordination database enforces ownership, receipt CAS, recovery and never releases ports',
 {skip:!url},async()=>{
 const db=new MySqlUnitOfWork(url!);
 const suffix=randomUUID().replaceAll('-','').slice(0,16);
 const account='tco-'+suffix,scope='tcs-'+suffix,forwardId='tcf-'+suffix;
 const nodes=[0,1,2].map(i=>'tcn-'+i+'-'+suffix);
 const row=stageFixture(account,scope,forwardId,nodes);
 const coordinator=new TransitCoordinationJournal(db);
 try{
  await db.migrate();
  await db.transaction(async tx=>{
   await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',[account,'a'.repeat(48)+suffix]);
   await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',[scope,account]);
   const spec={
    enabled:true,protocols:['tcp'],
    ingress:{nodeId:nodes[0],listen:{address:'127.0.0.1',port:32001}},
    target:{host:'127.0.0.1',port:18080},
    path:{via:[nodes[1],nodes[2]]},transport:{profileId:'profile-a',configRevision:1},
   };
   await write(tx,'INSERT INTO forwards(id,scope_id,revision,spec) VALUES(?,?,?,?)',
    [forwardId,scope,1,JSON.stringify(spec)]);
   for(let i=0;i<nodes.length;i++){
    await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts) VALUES(?,?,?,?,?)',
     [nodes[i],scope,String(i).repeat(48)+suffix,9999999999,'{}']);
    await write(tx,'INSERT INTO runtime_nodes(node_id,session_epoch) VALUES(?,?)',[nodes[i],1]);
    await write(tx,'INSERT INTO port_slots(node_id,protocol,port,owner_id,fence,deployment_generation) VALUES(?,?,?,?,?,?)',
     [nodes[i],'tcp',32001+i,forwardId,4+i,1]);
   }
   await write(tx,'INSERT INTO transit_deployments(forward_id,generation,target_revision,scope_id,created_by,state,expires_at,plan_digest,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    [forwardId,1,1,scope,account,'reserved',row.expires_at,row.plan_digest,JSON.stringify(row.body),row.created_at,row.updated_at]);
  });

  await assert.rejects(coordinator.begin('foreign',scope,forwardId,1),assertCode('AUTHORIZATION_DENIED'));
  await write(db.pool,'UPDATE runtime_nodes SET session_epoch=2 WHERE node_id=?',[nodes[1]]);
  await assert.rejects(coordinator.begin(account,scope,forwardId,1),assertCode('SESSION_SUPERSEDED'));
  await write(db.pool,'UPDATE runtime_nodes SET session_epoch=1 WHERE node_id=?',[nodes[1]]);
  await write(db.pool,'UPDATE port_slots SET fence=10 WHERE node_id=? AND port=?',[nodes[2],32003]);
  await assert.rejects(coordinator.begin(account,scope,forwardId,1),assertCode('FENCING_REJECTED'));
  await write(db.pool,'UPDATE port_slots SET fence=6 WHERE node_id=? AND port=?',[nodes[2],32003]);
  const begun=await Promise.allSettled([1,2].map(()=>coordinator.begin(account,scope,forwardId,1)));
  assert.equal(begun.filter(p=>p.status==='fulfilled').length,1,'only one coordinator writer may create journal');
  assert.equal(begun.filter(p=>p.status==='rejected').length,1);
  let command=await coordinator.peek(account,scope,forwardId,1);
  assert.equal(command?.nodeId,nodes[2]);
  assert.equal(command?.action,'prepare');
  const simulatedVerifier=async (_proof:TransitObservationProof)=>true;
  const first=observation(command!,1);
  await assert.rejects(coordinator.confirm(account,scope,forwardId,1,first,async()=>false),
   assertCode('AUTHORIZATION_DENIED'));
  await assert.rejects(coordinator.confirm(account,scope,forwardId,1,
   {...first,commandDigest:'sha256:'+'f'.repeat(64)},simulatedVerifier),assertCode('FENCING_REJECTED'));
  assert.equal((await coordinator.peek(account,scope,forwardId,1))?.commandDigest,command?.commandDigest);

  const sequences=new Map<string,number>();
  for (const phase of ['prepare','activate'] as const){
   for(const nodeId of [...nodes].reverse()){
    assert.equal(command?.action,phase);
    assert.equal(command?.nodeId,nodeId);
    const next=(sequences.get(nodeId)??0)+1;
    const proof=observation(command!,next);
    command=await coordinator.confirm(account,scope,forwardId,1,proof,simulatedVerifier);
    sequences.set(nodeId,next);
    await assert.rejects(coordinator.confirm(account,scope,forwardId,1,proof,simulatedVerifier),
     assertCode('FENCING_REJECTED'));
   }
  }
  assert.equal(command,null,'offline complete does not publish any executable Snapshot');
  assert.equal(await coordinator.peek(account,scope,forwardId,1),null);
  assert.equal(await coordinator.quarantineRecovery(),1,'cold restart must quarantine even sealed offline work');
  command=await coordinator.peek(account,scope,forwardId,1);
  assert.equal(command?.action,'withdraw');
  assert.equal(command?.nodeId,nodes[0],'compensation must withdraw ingress first');
  assert.equal((await coordinator.fail(account,scope,forwardId,1))?.commandDigest,command?.commandDigest);
  for(const nodeId of nodes){
   assert.equal(command?.nodeId,nodeId);
   const next=(sequences.get(nodeId)??0)+1;
   command=await coordinator.confirm(account,scope,forwardId,1,
    observation(command!,next),simulatedVerifier);
   sequences.set(nodeId,next);
  }
  assert.equal(command,null);
  assert.equal(await coordinator.peek(account,scope,forwardId,1),null);
  const state=await rows<{phase:string;position:number;revision:number}>(db.pool,
   'SELECT phase,position,revision FROM transit_coordination WHERE forward_id=?',[forwardId]);
  assert.equal(state[0]?.phase,'quarantined');
  assert.equal(state[0]?.position,3);
  assert.equal(state[0]?.revision,11);
  const slots=await rows<{owner_id:string;fence:number}>(db.pool,
   'SELECT owner_id,fence FROM port_slots WHERE owner_id=? ORDER BY port',[forwardId]);
  assert.equal(slots.length,3,'offline coordinator must never release physical slots');
  assert.deepEqual(slots.map(s=>s.fence),[4,5,6]);
  const staging=new TransitStagingCoordinator(db,null as never,null as never,null as never,null as never);
  await assert.rejects(staging.abort(account,scope,forwardId,1),assertCode('FENCING_REJECTED'));
 }finally{
  try{
   await db.transaction(async tx=>{
    await write(tx,'DELETE FROM transit_coordination WHERE forward_id=?',[forwardId]);
    await write(tx,'DELETE FROM transit_deployments WHERE forward_id=?',[forwardId]);
    await write(tx,'DELETE FROM port_slots WHERE node_id IN (?,?,?)',nodes);
    await write(tx,'DELETE FROM runtime_nodes WHERE node_id IN (?,?,?)',nodes);
    await write(tx,'DELETE FROM nodes WHERE id IN (?,?,?)',nodes);
    await write(tx,'DELETE FROM forwards WHERE id=?',[forwardId]);
    await write(tx,'DELETE FROM scopes WHERE id=?',[scope]);
    await write(tx,'DELETE FROM accounts WHERE id=?',[account]);
   });
  }finally{await db.close();}
 }
});
test('offline rollout SQL creates only an isolated coordination journal',()=>{
 const sql=readFileSync(new URL('../migrations/0011-transit-coordination.sql',import.meta.url),'utf8');
 assert.match(sql,/FOREIGN KEY\(forward_id,generation\) REFERENCES transit_deployments/);
 assert.match(sql,/receipt_highwater JSON NOT NULL/);
 assert.match(sql,/journal_digest/);
 assert.doesNotMatch(sql,/CREATE TABLE snapshots/);
 assert.doesNotMatch(sql,/CREATE TABLE execution_leases/);
});
