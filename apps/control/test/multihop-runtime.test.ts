import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import { DEFAULT_POLICY, digest, parseRuntimeMessage } from '@tunex/contracts';
import type { RuntimeMessages, RuntimeSnapshot } from '@tunex/contracts';
import { ControlApplication } from '../src/application/control.ts';
import { AuthorityStore } from '../src/infrastructure/authority.ts';
import { json, MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import { Identity, newToken } from '../src/modules/identity.ts';
import { Nodes } from '../src/modules/nodes.ts';
import { RuntimeController } from '../src/modules/runtime/controller.ts';
import { compileDirect, compileSnapshot } from '../src/modules/runtime/planner.ts';
import type { RelayPreparedPlan } from '../src/modules/runtime/relay-plan.ts';
import { multihopFixture } from './fixtures/multihop.ts';

const url=process.env.TUNEX_TEST_DATABASE_URL;

// Synthetic reports exercise real MySQL transactions; they are not network evidence.
async function withRuntime(action:(f:{
  db:MySqlUnitOfWork;app:ControlApplication;runtime:RuntimeController;identity:Identity;nodes:Nodes;
  owner:string;scope:string;forwardId:string;operationId:string;plan:RelayPreparedPlan;
  snapshots:RuntimeSnapshot[];report:(index:number,retryable?:boolean)=>RuntimeMessages['ReportRequest'];
})=>Promise<void>){
  const admin=await createConnection(url!),database='tunex_mh_runtime_'+randomUUID().replaceAll('-','');
  const connectionURL=new URL(url!);connectionURL.pathname='/'+database;
  const db=new MySqlUnitOfWork(connectionURL.toString()),directory=await mkdtemp(join(tmpdir(),'tunex-mh-runtime-'));
  let created=false;
  try{
    await admin.query(`CREATE DATABASE \`${database}\``);created=true;
    await db.migrate();
    const owner='multihop-owner',scope='scope-a',input=multihopFixture(),now=Date.now(),until=now+3600000;
    const identity=new Identity(db),nodes=new Nodes(db,identity,null as never);
    const app=new ControlApplication(db,identity,nodes,DEFAULT_POLICY,true);
    const authority=new AuthorityStore(directory);
    await authority.initialize(database,'sha256:'+'a'.repeat(64),true);
    const runtime=new RuntimeController(db,nodes,app.forwarding,app.ledger,DEFAULT_POLICY,authority,app.relay);
    await identity.bootstrap(scope,owner,newToken());
    await db.transaction(async tx=>{
      for(const [index,node] of input.nodes.entries()){
        const id=node.facts.nodeId,facts={...node.facts,allowedPorts:[32001,32003]};
        await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts) VALUES(?,?,?,?,?,?)',
          [id,scope,createHash('sha256').update(id).digest('hex'),until,until,JSON.stringify(facts)]);
        await write(tx,'INSERT INTO node_grants(node_id,actor_id) VALUES(?,?)',[id,owner]);
        await write(tx,'INSERT INTO runtime_nodes(node_id,session_epoch,boot_id) VALUES(?,?,?)',[id,node.sessionEpoch,'boot-'+index]);
        await write(tx,'INSERT INTO node_relay_credentials(fingerprint,node_id,issued_at,valid_until,certificate) VALUES(?,?,?,?,?)',
          [node.peers[0]!.fingerprint.slice(7),id,now,until,'Synthetic DB fixture; never used for TLS']);
      }
      for(const endpoint of input.endpoints)
        await write(tx,'INSERT INTO node_relay_endpoints(node_id,revision,config,created_by,updated_at) VALUES(?,?,?,?,?)',
          [endpoint.nodeId,1,JSON.stringify(endpoint.config),owner,now]);
    });
    await app.transport.publish(owner,scope,input.profile.profileId,randomUUID(),0,input.profile.config);
    const accepted=await app.create(owner,scope,randomUUID(),input.forward.spec);
    const forwardId=accepted.body.forwardId,operationId=accepted.body.operationId!;
    const record=(await rows<{body:unknown}>(db.pool,'SELECT body FROM relay_deployments WHERE forward_id=?',[forwardId]))[0]!;
    const plan=json<RelayPreparedPlan>(record.body);
    const snapshots=plan.nodes.map(node=>compileSnapshot({
      nodeId:node.nodeId,sessionEpoch:node.sessionEpoch,snapshotGeneration:1,
      issuedAt:new Date(now).toISOString(),validUntil:new Date(now+240000).toISOString(),
      assignments:node.assignments.map(a=>({...a,phase:'active'})),tombstones:[],
    }));
    await db.transaction(async tx=>{
      await write(tx,"UPDATE operations SET status='succeeded' WHERE id=?",[operationId]);
      await write(tx,"UPDATE relay_deployments SET stage='active',prepared_count=3,activated_count=3 WHERE forward_id=?",[forwardId]);
      for(const snapshot of snapshots){
        await write(tx,'INSERT INTO snapshots(node_id,generation,session_epoch,valid_until,body) VALUES(?,?,?,?,?)',
          [snapshot.nodeId,1,snapshot.sessionEpoch,Date.parse(snapshot.validUntil),JSON.stringify(snapshot)]);
        await write(tx,'UPDATE runtime_nodes SET snapshot_generation=1 WHERE node_id=?',[snapshot.nodeId]);
        await app.ledger.recordLeases(tx,snapshot);
      }
    });
    function report(index:number,retryable=false):RuntimeMessages['ReportRequest']{
      const snapshot=snapshots[index]!;
      return parseRuntimeMessage('ReportRequest',JSON.stringify({
        protocolVersion:3,nodeId:snapshot.nodeId,bootId:'boot-'+index,sessionEpoch:snapshot.sessionEpoch,
        reportSequence:1,observedAt:new Date().toISOString(),acceptedSnapshotGeneration:1,drains:[],
        observations:snapshot.assignments.map((a,i)=>({assignmentId:a.assignmentId,deploymentGeneration:a.deploymentGeneration,
          bindingFence:a.bindingFence,phase:a.phase,condition:i===0?'error':'ready',
          errorCode:i===0?(retryable?'DOWNSTREAM_UNAVAILABLE':'AUTHENTICATION_FAILED'):null,retryable:i===0&&retryable})),
      }));
    }
    await action({db,app,runtime,identity,nodes,owner,scope,forwardId,operationId,plan,snapshots,report});
  }finally{
    try{await db.close();if(created)await admin.query(`DROP DATABASE \`${database}\``);}
    finally{await admin.end();await rm(directory,{recursive:true,force:true});}
  }
}

test('terminal failure after success records one incident and withdraws ingress despite unrelated queued work',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const report=f.report(1);
    assert.equal((await f.runtime.report(report.nodeId,report.sessionEpoch,report)).status,'accepted');
    const incident=await f.db.transaction(tx=>f.app.ledger.latest(tx,f.forwardId));
    assert.equal(incident?.status,'failed');assert.equal(incident?.cleanup_pending,1);
    assert.equal(incident?.source_operation_id,f.operationId);
    assert.equal(json<{nodeId:string}>(incident?.last_error).nodeId,report.nodeId);
    assert.equal((await rows<{status:string}>(f.db.pool,'SELECT status FROM operations WHERE id=?',[f.operationId]))[0]!.status,'succeeded');
    assert.equal((await rows<{stage:string}>(f.db.pool,'SELECT stage FROM relay_deployments WHERE forward_id=?',[f.forwardId]))[0]!.stage,'withdrawn');
    const deployment=await f.db.transaction(async tx=>f.app.relay.status(tx,await f.app.forwarding.get(tx,f.scope,f.forwardId)));
    assert.equal(deployment?.renewalAllowed,false);assert.equal(deployment?.operation?.sourceOperationId,f.operationId);
    assert.equal((deployment?.operation?.lastError as {nodeId:string}).nodeId,report.nodeId);
    assert.equal((await f.runtime.report(report.nodeId,report.sessionEpoch,report)).status,'duplicate');
    assert.equal((await rows<{n:number}>(f.db.pool,'SELECT COUNT(*) n FROM operations WHERE forward_id=?',[f.forwardId]))[0]!.n,2);
    for(const node of f.plan.nodes)
      assert.deepEqual(await f.db.transaction(tx=>f.app.relay.assignments(tx,node.nodeId)),[]);
    const ingress=f.snapshots[0]!;
    await f.app.create(f.owner,f.scope,randomUUID(),{enabled:true,protocols:['tcp'],
      ingress:{nodeId:ingress.nodeId,listen:{address:'127.0.0.1',port:32003}},target:{host:'127.0.0.1',port:32002}});
    const withdrawn=await f.runtime.snapshot(ingress.nodeId,ingress.sessionEpoch);
    assert.ok(withdrawn.snapshotGeneration>ingress.snapshotGeneration);
    assert.ok(!withdrawn.assignments.some(a=>a.forwardId===f.forwardId));
    assert.equal(withdrawn.tombstones.filter(t=>t.forwardId===f.forwardId).length,2);
    const leases=await rows<{valid_until:number}>(f.db.pool,'SELECT valid_until FROM execution_leases WHERE forward_id=?',[f.forwardId]);
    assert.ok(leases.every(l=>l.valid_until===Date.parse(ingress.validUntil)),'withdrawal must not extend old authority');
    const slots=await rows(f.db.pool,'SELECT port FROM port_slots WHERE owner_id=?',[f.forwardId]);
    assert.equal(slots.length,6,'unconfirmed cleanup must retain physical ownership');
  });
});

test('retryable downstream failure keeps the active generation recoverable',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const report=f.report(1,true);
    await f.runtime.report(report.nodeId,report.sessionEpoch,report);
    const operation=await f.db.transaction(tx=>f.app.ledger.latest(tx,f.forwardId));
    assert.equal(operation?.id,f.operationId);assert.equal(operation?.status,'succeeded');
    assert.equal((await rows<{stage:string}>(f.db.pool,'SELECT stage FROM relay_deployments WHERE forward_id=?',[f.forwardId]))[0]!.stage,'active');
    assert.equal((await f.db.transaction(tx=>f.app.relay.assignments(tx,f.plan.nodes[0]!.nodeId))).length,2);
  });
});

test('grant withdrawal immediately clears deployment readiness while retaining fresh execution evidence',{skip:!url},async()=>{
  await withRuntime(async f=>{
    for(let index=0;index<f.plan.nodes.length;index++){
      const report=structuredClone(f.report(index));
      report.observations=report.observations.map(o=>({...o,condition:'ready',errorCode:null,retryable:false}));
      await f.runtime.report(report.nodeId,report.sessionEpoch,report);
    }
    const status=()=>f.db.transaction(async tx=>f.app.relay.status(tx,await f.app.forwarding.get(tx,f.scope,f.forwardId)));
    const before=await status();
    assert.equal(before?.renewalAllowed,true);assert.ok(before?.nodes.every(n=>n.ready&&n.reportFresh));
    const withdrawn=await f.app.changeNodeGrant(f.owner,f.scope,f.plan.nodes[1]!.nodeId,f.owner,randomUUID(),1,false);
    const after=await status();
    assert.equal(after?.stage,'active','withdrawal has not yet published removal Snapshots');
    assert.equal(after?.renewalAllowed,false);assert.equal(after?.operation?.id,withdrawn.body.operationIds[0]);
    assert.ok(after?.nodes.every(n=>!n.ready&&!n.prepared&&n.reportFresh&&n.observations.every(o=>o.condition==='ready')));
    assert.deepEqual(after?.nodes.map(n=>n.validUntil),before?.nodes.map(n=>n.validUntil),'issued leases retain their original cutoff');
  });
});

test('stale execution reports do not appear as fresh deployment observations',{skip:!url},async()=>{
  await withRuntime(async f=>{
    for(let index=0;index<f.plan.nodes.length;index++){
      const report=structuredClone(f.report(index));
      report.observations=report.observations.map(o=>({...o,condition:'ready',errorCode:null,retryable:false}));
      await f.runtime.report(report.nodeId,report.sessionEpoch,report);
    }
    const middle=f.plan.nodes[1]!.nodeId;
    await write(f.db.pool,'UPDATE runtime_nodes SET received_at=? WHERE node_id=?',
      [Date.now()-DEFAULT_POLICY.observationFreshnessSeconds*1000-1000,middle]);
    const deployment=await f.db.transaction(async tx=>f.app.relay.status(tx,await f.app.forwarding.get(tx,f.scope,f.forwardId)));
    const stale=deployment?.nodes.find(n=>n.nodeId===middle);
    assert.equal(deployment?.renewalAllowed,true);assert.equal(stale?.reportFresh,false);assert.equal(stale?.ready,false);
    assert.deepEqual(stale?.observations,[]);assert.ok(deployment?.nodes.filter(n=>n.nodeId!==middle).every(n=>n.ready&&n.reportFresh));
  });
});

test('a report for the old published generation cannot fail its running successor',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const successor=await f.db.transaction(async tx=>{
      const forward=await f.app.forwarding.record(tx,f.scope,f.forwardId);
      const plan=await f.app.relay.acceptPlan(tx,f.owner,forward);
      const id=await f.app.ledger.accept(tx,forward,{actorId:f.owner,scopeId:f.scope,key:randomUUID(),digest:digest(plan)},'policy',forward.spec,f.operationId);
      await write(tx,"UPDATE operations SET status='running' WHERE id=?",[id]);
      return {id,generation:plan.deploymentGeneration};
    });
    const report=f.report(1);
    await f.runtime.report(report.nodeId,report.sessionEpoch,report);
    const operation=await f.db.transaction(tx=>f.app.ledger.latest(tx,f.forwardId));
    assert.equal(operation?.id,successor.id);assert.equal(operation?.status,'running');
    assert.equal((await rows<{stage:string}>(f.db.pool,'SELECT stage FROM relay_deployments WHERE forward_id=? AND generation=?',[f.forwardId,successor.generation]))[0]!.stage,'preparing');
  });
});

test('a terminal error during deployment fails the existing attempt',{skip:!url},async()=>{
  await withRuntime(async f=>{
    await write(f.db.pool,"UPDATE operations SET status='running' WHERE id=?",[f.operationId]);
    const report=f.report(1);await f.runtime.report(report.nodeId,report.sessionEpoch,report);
    const operation=await f.db.transaction(tx=>f.app.ledger.latest(tx,f.forwardId));
    assert.equal(operation?.id,f.operationId);assert.equal(operation?.status,'failed');
    assert.equal((await rows<{n:number}>(f.db.pool,'SELECT COUNT(*) n FROM operations WHERE forward_id=?',[f.forwardId]))[0]!.n,1);
  });
});

test('retry rejects an oversized intermediate Snapshot and rolls back every new Fence and operation',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const report=f.report(1);await f.runtime.report(report.nodeId,report.sessionEpoch,report);
    const incident=(await f.db.transaction(tx=>f.app.ledger.latest(tx,f.forwardId)))!;
    const middle=f.plan.nodes[1]!,ingress=f.plan.nodes[0]!;
    await f.db.transaction(async tx=>{
      const facts=await f.nodes.cleanupFacts(tx,middle.nodeId,f.scope);
      for(let i=0;i<96;i++){
        const port=34000+i;
        const [a]=compileDirect({id:f.forwardId,scopeId:f.scope,revision:1,spec:{enabled:true,protocols:['tcp'],
          ingress:{nodeId:middle.nodeId,listen:{address:'127.0.0.1',port}},target:{host:'127.0.0.1',port:32002}}},
          {...facts,allowedPorts:[...facts.allowedPorts,port]},[{nodeId:middle.nodeId,forwardId:f.forwardId,protocol:'tcp',port,bindingFence:1,deploymentGeneration:100+i}]);
        await write(tx,'INSERT INTO retirements(node_id,assignment_id,deployment_generation,binding_fence,forward_id,operation_id,body,retirement_generation,safe) VALUES(?,?,?,?,?,?,?,?,TRUE)',
          [middle.nodeId,a!.assignmentId,a!.deploymentGeneration,a!.bindingFence,f.forwardId,incident.id,JSON.stringify(a),1]);
      }
    });
    const policy={...DEFAULT_POLICY,maxSnapshotBytes:16384};
    const limited=new ControlApplication(f.db,f.identity,f.nodes,policy,true);
    await f.db.transaction(async tx=>limited.ledger.assertCapacity(tx,limited.forwarding,await f.nodes.cleanupFacts(tx,ingress.nodeId,f.scope)));
    const slotsBefore=await rows(f.db.pool,'SELECT * FROM port_slots WHERE owner_id=? ORDER BY node_id,protocol,port',[f.forwardId]);
    await assert.rejects(()=>limited.retry(f.owner,f.scope,randomUUID(),incident.id,1),/RESOURCE_LIMIT: Complete snapshot too large/);
    const latest=await f.db.transaction(tx=>limited.ledger.latest(tx,f.forwardId));
    assert.equal(latest?.id,incident.id);
    assert.equal((await rows<{n:number}>(f.db.pool,'SELECT COUNT(*) n FROM relay_deployments WHERE forward_id=?',[f.forwardId]))[0]!.n,1);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM port_slots WHERE owner_id=? ORDER BY node_id,protocol,port',[f.forwardId]),slotsBefore);
  });
});
