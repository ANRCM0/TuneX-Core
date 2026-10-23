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
import type { NodePolicy } from '../src/modules/node-management-ports.ts';
import type { ForwardSpec } from '@tunex/core';
import { multihopFixture } from './fixtures/multihop.ts';

const url=process.env.TUNEX_TEST_DATABASE_URL;

// Synthetic reports exercise real MySQL transactions; they are not network evidence.
async function withRuntime(action:(f:{
  db:MySqlUnitOfWork;app:ControlApplication;runtime:RuntimeController;identity:Identity;nodes:Nodes;
  owner:string;scope:string;forwardId:string;operationId:string;plan:RelayPreparedPlan;
  snapshots:RuntimeSnapshot[];report:(index:number,retryable?:boolean)=>RuntimeMessages['ReportRequest'];
  authority:AuthorityStore;
})=>Promise<void>,forwardOwner='multihop-owner'){
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
    if(forwardOwner!==owner)await app.changeMember(owner,scope,forwardOwner,randomUUID(),{expectedRevision:0,role:'manager',token:newToken()});
    await db.transaction(async tx=>{
      for(const [index,node] of input.nodes.entries()){
        const id=node.facts.nodeId,facts={...node.facts,allowedPorts:[32001,32003]};
        await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts,resource_source,owner_actor_id,resource_revision) VALUES(?,?,?,?,?,?,?,?,?)',
          [id,scope,createHash('sha256').update(id).digest('hex'),until,until,JSON.stringify(facts),'admin-shared',null,1]);
        for(const actor of new Set([owner,forwardOwner]))await write(tx,'INSERT INTO node_grants(node_id,actor_id,allowed_roles,port_limits) VALUES(?,?,?,?)',[id,actor,JSON.stringify([index===0?'ingress':index===input.nodes.length-1?'egress':'transit']),JSON.stringify({allowedPorts:index===0?[32001,32003]:input.endpoints.find(endpoint=>endpoint.nodeId===id)!.config.allowedTcpPorts,maxBindings:16})]);
        await write(tx,'INSERT INTO runtime_nodes(node_id,session_epoch,boot_id) VALUES(?,?,?)',[id,node.sessionEpoch,'boot-'+index]);
        await write(tx,'INSERT INTO node_relay_credentials(fingerprint,node_id,issued_at,valid_until,certificate) VALUES(?,?,?,?,?)',
          [node.peers[0]!.fingerprint.slice(7),id,now,until,'Synthetic DB fixture; never used for TLS']);
      }
      for(const endpoint of input.endpoints)
        await write(tx,'INSERT INTO node_relay_endpoints(node_id,revision,config,created_by,updated_at) VALUES(?,?,?,?,?)',
          [endpoint.nodeId,1,JSON.stringify(endpoint.config),owner,now]);
    });
    await app.transport.publish(owner,scope,input.profile.profileId,randomUUID(),0,input.profile.config);
    if(forwardOwner!==owner)await app.profileGrants.change(owner,scope,input.profile.profileId,forwardOwner,randomUUID(),1,true);
    const accepted=await app.create(forwardOwner,scope,randomUUID(),input.forward.spec);
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
    await action({db,app,runtime,identity,nodes,owner,scope,forwardId,operationId,plan,snapshots,report,authority});
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

test('Profile grant command revokes one shared operation stream without extending leases or releasing slots',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const profileId=multihopFixture().profile.profileId,key=randomUUID();
    const leases=await rows(f.db.pool,'SELECT * FROM execution_leases WHERE forward_id=? ORDER BY node_id,assignment_id',[f.forwardId]);
    const slots=await rows(f.db.pool,'SELECT * FROM port_slots WHERE owner_id=? ORDER BY node_id,protocol,port',[f.forwardId]);
    const withdrawn=await f.app.profileGrants.change(f.owner,f.scope,profileId,f.owner,key,1,false);
    assert.equal(withdrawn.status,202);assert.equal(withdrawn.body.revision,2);
    assert.equal(withdrawn.body.operationIds.length,1);
    const operation=await f.db.transaction(tx=>f.app.ledger.latest(tx,f.forwardId));
    assert.equal(operation?.id,withdrawn.body.operationIds[0]);assert.equal(operation?.kind,'revoke');
    assert.equal(operation?.target_revision,1);assert.equal(operation?.requested_by,f.owner);
    const status=await f.db.transaction(async tx=>f.app.relay.status(tx,await f.app.forwarding.get(tx,f.scope,f.forwardId)));
    assert.equal(status?.renewalAllowed,false);
    for(const node of f.plan.nodes)assert.deepEqual(await f.db.transaction(tx=>f.app.relay.assignments(tx,node.nodeId,true)),[]);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM execution_leases WHERE forward_id=? ORDER BY node_id,assignment_id',[f.forwardId]),leases);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM port_slots WHERE owner_id=? ORDER BY node_id,protocol,port',[f.forwardId]),slots);
    assert.equal(slots.length,6,'accepted revocation is not proof of drained physical resources');
    assert.deepEqual(await f.app.profileGrants.change(f.owner,f.scope,profileId,f.owner,key,1,false),withdrawn);
    const noOp=await f.app.profileGrants.change(f.owner,f.scope,profileId,f.owner,randomUUID(),2,false);
    assert.equal(noOp.status,200);assert.deepEqual(noOp.body.operationIds,[]);
    assert.equal((await rows<{n:number}>(f.db.pool,'SELECT COUNT(*) n FROM transport_events WHERE profile_id=?',[profileId]))[0]!.n,1);
    assert.equal((await rows<{n:number}>(f.db.pool,'SELECT COUNT(*) n FROM operations WHERE forward_id=?',[f.forwardId]))[0]!.n,2);
    await assert.rejects(f.app.profileGrants.change(f.owner,f.scope,profileId,f.owner,randomUUID(),1,true),{code:'REVISION_CONFLICT'});
    await assert.rejects(f.db.transaction(tx=>f.app.transport.resolve(tx,f.owner,f.scope,profileId,1)),{code:'NOT_FOUND'});
    const restored=await f.app.profileGrants.change(f.owner,f.scope,profileId,f.owner,randomUUID(),2,true);
    assert.equal(restored.status,202);assert.equal(restored.body.operationIds.length,1);
    assert.equal((await f.db.transaction(tx=>f.app.ledger.latest(tx,f.forwardId)))?.kind,'policy');
    assert.equal((await f.db.transaction(tx=>f.app.forwarding.get(tx,f.scope,f.forwardId))).revision,1);
    const plans=await rows<{generation:number;target_revision:number}>(f.db.pool,
      'SELECT generation,target_revision FROM relay_deployments WHERE forward_id=? ORDER BY generation',[f.forwardId]);
    assert.deepEqual(plans,[{generation:1,target_revision:1},{generation:2,target_revision:1}]);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM execution_leases WHERE forward_id=? ORDER BY node_id,assignment_id',[f.forwardId]),leases);
  });
});

// Snapshot all affected owner tables, not only the final grant revision.
async function grantState(db:MySqlUnitOfWork):Promise<unknown[]>{
  const tables=['accounts','scope_members','access_events','nodes','node_grants','node_credentials','node_relay_credentials','node_security_events',
    'transport_profiles','transport_profile_grants','transport_events','forwards','forward_revisions',
    'operations','idempotency','relay_deployments','port_slots','execution_leases','retirements','runtime_nodes','snapshots'];
  const result=[];
  for(const table of tables)result.push([table,(await rows(db.pool,`SELECT * FROM ${table}`)).map(r=>JSON.stringify(r)).sort()]);
  return result;
}

test('Profile revocation response failure rolls back authority, operation and idempotency on real MySQL',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const before=await grantState(f.db),key=randomUUID(),profileId=multihopFixture().profile.profileId;
    const original=f.app.idempotency.respond;
    let reached=false;
    f.app.idempotency.respond=async(tx,request,response)=>{
      assert.equal(request.key,key);
      assert.equal((await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM transport_profile_grants WHERE profile_id=? AND actor_id=?',[profileId,f.owner]))[0]!.n,0);
      assert.equal((await rows<{n:number}>(tx,"SELECT COUNT(*) n FROM operations WHERE forward_id=? AND kind='revoke'",[f.forwardId]))[0]!.n,1);
      await original.call(f.app.idempotency,tx,request,response);
      reached=true;throw new Error('Injected post-acceptance response failure');
    };
    try{await assert.rejects(f.app.profileGrants.change(f.owner,f.scope,profileId,f.owner,key,1,false),/Injected post-acceptance/);}
    finally{f.app.idempotency.respond=original;}
    assert.equal(reached,true);assert.deepEqual(await grantState(f.db),before);
    assert.equal((await f.app.profileGrants.change(f.owner,f.scope,profileId,f.owner,key,1,false)).status,202);
  });
});

test('Profile restore capacity failure rolls back every new deployment, Fence, operation and grant',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const profileId=multihopFixture().profile.profileId;
    await f.app.profileGrants.change(f.owner,f.scope,profileId,f.owner,randomUUID(),1,false);
    const before=await grantState(f.db),key=randomUUID(),original=f.app.ledger.assertCapacity;
    let checks=0;
    f.app.ledger.assertCapacity=async(...args)=>{
      checks++;
      if(checks===2){
        assert.equal((await rows<{n:number}>(args[0],'SELECT COUNT(*) n FROM relay_deployments WHERE forward_id=?',[f.forwardId]))[0]!.n,2);
        assert.equal((await rows<{n:number}>(args[0],"SELECT COUNT(*) n FROM operations WHERE forward_id=? AND kind='policy'",[f.forwardId]))[0]!.n,1);
        throw new Error('Injected intermediate capacity failure');
      }
      return original.apply(f.app.ledger,args);
    };
    try{await assert.rejects(f.app.profileGrants.change(f.owner,f.scope,profileId,f.owner,key,2,true),/Injected intermediate capacity/);}
    finally{f.app.ledger.assertCapacity=original;}
    assert.equal(checks,2);assert.deepEqual(await grantState(f.db),before);
    assert.equal((await f.app.profileGrants.change(f.owner,f.scope,profileId,f.owner,key,2,true)).status,202);
  });
});

test('member demotion and restoration preserve shared leases, slots, replay and user revision on real MySQL',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const subject='runtime-member',key=randomUUID();
    const leases=await rows<{valid_until:number}>(f.db.pool,'SELECT * FROM execution_leases WHERE forward_id=? ORDER BY node_id,assignment_id',[f.forwardId]);
    const slots=await rows(f.db.pool,'SELECT * FROM port_slots WHERE owner_id=? ORDER BY node_id,protocol,port',[f.forwardId]);
    const assertRetained=async()=>{
      assert.deepEqual(await rows(f.db.pool,'SELECT * FROM execution_leases WHERE forward_id=? ORDER BY node_id,assignment_id',[f.forwardId]),leases);
      assert.deepEqual(await rows(f.db.pool,'SELECT * FROM port_slots WHERE owner_id=? ORDER BY node_id,protocol,port',[f.forwardId]),slots);
    };
    const before=await f.db.transaction(async tx=>f.app.relay.status(tx,await f.app.forwarding.get(tx,f.scope,f.forwardId)));
    assert.equal(before?.renewalAllowed,true);
    const originalCapacity=f.app.ledger.assertCapacity;
    f.app.ledger.assertCapacity=async()=>{throw new Error('Withdrawal must not depend on snapshot capacity');};
    let withdrawn;
    try{withdrawn=await f.app.changeMember(f.owner,f.scope,subject,key,{expectedRevision:1,role:'viewer'});}
    finally{f.app.ledger.assertCapacity=originalCapacity;}
    assert.equal(withdrawn.status,202);assert.equal(withdrawn.body.operationIds.length,1);
    assert.equal(withdrawn.body.latestAuthorizationUntil,new Date(Math.max(...leases.map(l=>l.valid_until))+5000).toISOString());
    const operation=await f.db.transaction(tx=>f.app.ledger.latest(tx,f.forwardId));
    assert.equal(operation?.kind,'revoke');assert.equal(operation?.requested_by,f.owner);assert.equal(operation?.target_revision,1);
    for(const node of f.plan.nodes)assert.deepEqual(await f.db.transaction(tx=>f.app.relay.assignments(tx,node.nodeId,true)),[]);
    await assertRetained();
    assert.deepEqual(await f.app.changeMember(f.owner,f.scope,subject,key,{expectedRevision:1,role:'viewer'}),withdrawn);
    const noOp=await f.app.changeMember(f.owner,f.scope,subject,randomUUID(),{expectedRevision:2,role:'viewer'});
    assert.equal(noOp.status,200);assert.deepEqual(noOp.body.operationIds,[]);assert.equal(noOp.body.latestAuthorizationUntil,null);
    await assert.rejects(f.app.changeMember(f.owner,f.scope,subject,randomUUID(),{expectedRevision:1,role:'manager'}),{code:'REVISION_CONFLICT'});
    await assert.rejects(f.app.changeMember(f.owner,f.scope,f.owner,randomUUID(),{expectedRevision:1,role:'removed'}),{code:'OWNER_PROTECTED'});
    const restored=await f.app.changeMember(f.owner,f.scope,subject,randomUUID(),{expectedRevision:2,role:'manager'});
    assert.equal(restored.status,202);assert.equal(restored.body.operationIds.length,1);
    assert.equal((await f.db.transaction(tx=>f.app.ledger.latest(tx,f.forwardId)))?.kind,'policy');
    assert.equal((await f.db.transaction(tx=>f.app.forwarding.get(tx,f.scope,f.forwardId))).revision,1);
    assert.deepEqual(await rows(f.db.pool,'SELECT generation,target_revision FROM relay_deployments WHERE forward_id=? ORDER BY generation',[f.forwardId]),
      [{generation:1,target_revision:1},{generation:2,target_revision:1}]);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM execution_leases WHERE forward_id=? ORDER BY node_id,assignment_id',[f.forwardId]),leases);
  },'runtime-member');
});

test('intermediate Node Grant withdrawal and no-op retain cutoff and resources without a capacity veto',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const nodeId=f.plan.nodes[1]!.nodeId,key=randomUUID();
    const leases=await rows<{valid_until:number}>(f.db.pool,'SELECT * FROM execution_leases WHERE forward_id=? ORDER BY node_id,assignment_id',[f.forwardId]);
    const slots=await rows(f.db.pool,'SELECT * FROM port_slots WHERE owner_id=? ORDER BY node_id,protocol,port',[f.forwardId]);
    const original=f.app.ledger.assertCapacity;
    f.app.ledger.assertCapacity=async()=>{throw new Error('Withdrawal must not depend on snapshot capacity');};
    let withdrawn;
    try{withdrawn=await f.app.changeNodeGrant(f.owner,f.scope,nodeId,f.owner,key,1,false);}
    finally{f.app.ledger.assertCapacity=original;}
    assert.equal(withdrawn.status,202);assert.equal(withdrawn.body.operationIds.length,1);
    assert.equal(withdrawn.body.latestAuthorizationUntil,new Date(Math.max(...leases.map(l=>l.valid_until))+5000).toISOString());
    for(const node of f.plan.nodes)assert.deepEqual(await f.db.transaction(tx=>f.app.relay.assignments(tx,node.nodeId,true)),[]);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM port_slots WHERE owner_id=? ORDER BY node_id,protocol,port',[f.forwardId]),slots);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM execution_leases WHERE forward_id=? ORDER BY node_id,assignment_id',[f.forwardId]),leases);
    assert.deepEqual(await f.app.changeNodeGrant(f.owner,f.scope,nodeId,f.owner,key,1,false),withdrawn);
    const noOp=await f.app.changeNodeGrant(f.owner,f.scope,nodeId,f.owner,randomUUID(),2,false);
    assert.equal(noOp.status,200);assert.deepEqual(noOp.body.operationIds,[]);
    assert.equal(noOp.body.latestAuthorizationUntil,withdrawn.body.latestAuthorizationUntil);
    const restored=await f.app.changeNodeGrant(f.owner,f.scope,nodeId,f.owner,randomUUID(),2,true,['transit'],{allowedPorts:multihopFixture().endpoints[0]!.config.allowedTcpPorts,maxBindings:16});
    assert.equal(restored.status,202);assert.equal(restored.body.operationIds.length,1);
    assert.equal((await f.db.transaction(tx=>f.app.forwarding.get(tx,f.scope,f.forwardId))).revision,1);
    assert.deepEqual(await rows(f.db.pool,'SELECT generation,target_revision FROM relay_deployments WHERE forward_id=? ORDER BY generation',[f.forwardId]),
      [{generation:1,target_revision:1},{generation:2,target_revision:1}]);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM execution_leases WHERE forward_id=? ORDER BY node_id,assignment_id',[f.forwardId]),leases);
  });
});

test('member response failure rolls back membership, audit, operations and persisted replay together',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const subject='runtime-member',before=await grantState(f.db),key=randomUUID(),original=f.app.idempotency.respond;
    let reached=false;
    f.app.idempotency.respond=async(tx,request,response)=>{
      assert.equal(request.key,key);
      assert.equal((await rows<{can_manage:number}>(tx,'SELECT can_manage FROM scope_members WHERE scope_id=? AND actor_id=?',[f.scope,subject]))[0]!.can_manage,0);
      assert.equal((await f.app.ledger.latest(tx,f.forwardId))?.kind,'revoke');
      await original.call(f.app.idempotency,tx,request,response);
      reached=true;throw new Error('Injected member response failure');
    };
    try{await assert.rejects(f.app.changeMember(f.owner,f.scope,subject,key,{expectedRevision:1,role:'viewer'}),/Injected member response/);}
    finally{f.app.idempotency.respond=original;}
    assert.equal(reached,true);assert.deepEqual(await grantState(f.db),before);
    assert.equal((await f.app.changeMember(f.owner,f.scope,subject,key,{expectedRevision:1,role:'viewer'})).status,202);
  },'runtime-member');
});

test('Node Grant restoration capacity failure rolls back grant audit, deployment, Fence and operation',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const nodeId=f.plan.nodes[1]!.nodeId;
    await f.app.changeNodeGrant(f.owner,f.scope,nodeId,f.owner,randomUUID(),1,false);
    const before=await grantState(f.db),key=randomUUID(),original=f.app.ledger.assertCapacity;
    let checks=0;
    f.app.ledger.assertCapacity=async(...args)=>{
      if(++checks===2){
        assert.equal((await rows<{n:number}>(args[0],'SELECT COUNT(*) n FROM relay_deployments WHERE forward_id=?',[f.forwardId]))[0]!.n,2);
        assert.equal((await f.app.ledger.latest(args[0],f.forwardId))?.kind,'policy');
        throw new Error('Injected Node grant path capacity failure');
      }
      return original.apply(f.app.ledger,args);
    };
    try{await assert.rejects(f.app.changeNodeGrant(f.owner,f.scope,nodeId,f.owner,key,2,true,['transit'],{allowedPorts:multihopFixture().endpoints[0]!.config.allowedTcpPorts,maxBindings:16}),/Injected Node grant path capacity/);}
    finally{f.app.ledger.assertCapacity=original;}
    assert.equal(checks,2);assert.deepEqual(await grantState(f.db),before);
    assert.equal((await f.app.changeNodeGrant(f.owner,f.scope,nodeId,f.owner,key,2,true,['transit'],{allowedPorts:multihopFixture().endpoints[0]!.config.allowedTcpPorts,maxBindings:16})).status,202);
  });
});

async function managementPolicy(f:{db:MySqlUnitOfWork;nodes:Nodes;scope:string},nodeId:string,revision:number,
  cidrs?:readonly string[]):Promise<NodePolicy>{
  const facts=await f.db.transaction(tx=>f.nodes.cleanupFacts(tx,nodeId,f.scope));
  return {allowedListenerAddresses:facts.allowedListenerAddresses,allowedPorts:facts.allowedPorts,egressPolicyRevision:revision,
    allowedDestinationCidrs:cidrs??facts.allowedDestinationCidrs,allowMetadataTargets:facts.allowMetadataTargets};
}

async function seedMachineCredentials(db:MySqlUnitOfWork,nodeId:string):Promise<string[]>{
  const now=Date.now(),fingerprints=[0,1].map(i=>createHash('sha256').update(nodeId+'-machine-'+i).digest('hex'));
  await db.transaction(async tx=>{
    for(const [i,fingerprint] of fingerprints.entries())
      await write(tx,'INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until,retire_after) VALUES(?,?,?,?,?)',
        [fingerprint,nodeId,now-1000,now+3600000,i===0?now+120000:null]);
  });
  return fingerprints;
}

test('shared Node policy requires the scope owner and recompiles with the original Forward authorizer and user revision',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const manager='node-manager',nodeId=f.plan.nodes[1]!.nodeId,key=randomUUID();
    await f.app.changeMember(f.owner,f.scope,manager,randomUUID(),{expectedRevision:0,role:'manager',token:newToken()});
    assert.equal(await f.db.transaction(tx=>f.nodes.hasGrant(tx,nodeId,manager)),false);
    const policy=await managementPolicy(f,nodeId,2),command={kind:'policy' as const,expectedRevision:1,policy};
    const leases=await rows(f.db.pool,'SELECT * FROM execution_leases WHERE forward_id=? ORDER BY node_id,assignment_id',[f.forwardId]);
    await assert.rejects(f.app.changeNode(manager,f.scope,nodeId,randomUUID(),command),{code:'AUTHORIZATION_DENIED'});
    const result=await f.app.changeNode(f.owner,f.scope,nodeId,key,command);
    assert.equal(result.status,202);assert.equal(result.body.policyRevision,2);assert.equal(result.body.operationIds.length,1);
    assert.equal(await f.db.transaction(tx=>f.app.forwarding.authorizer(tx,f.forwardId)),'forward-manager');
    const operation=await f.db.transaction(tx=>f.app.ledger.latest(tx,f.forwardId));
    assert.equal(operation?.kind,'policy');assert.equal(operation?.requested_by,f.owner);assert.equal(operation?.target_revision,1);
    assert.deepEqual(await rows(f.db.pool,'SELECT generation,target_revision FROM relay_deployments WHERE forward_id=? ORDER BY generation',[f.forwardId]),
      [{generation:1,target_revision:1},{generation:2,target_revision:1}]);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM execution_leases WHERE forward_id=? ORDER BY node_id,assignment_id',[f.forwardId]),leases);
    assert.deepEqual(await f.app.changeNode(f.owner,f.scope,nodeId,key,command),result);
    assert.equal((await rows<{n:number}>(f.db.pool,"SELECT COUNT(*) n FROM node_security_events WHERE node_id=? AND kind='policy_update'",[nodeId]))[0]!.n,1);
    await assert.rejects(f.app.changeNode(f.owner,f.scope,nodeId,randomUUID(),command),{code:'REVISION_CONFLICT'});
    await write(f.db.pool,'UPDATE scope_members SET can_manage=FALSE WHERE scope_id=? AND actor_id=?',[f.scope,manager]);
    await assert.rejects(f.app.changeNode(manager,f.scope,nodeId,key,command),{code:'AUTHORIZATION_DENIED'});
  },'forward-manager');
});

test('denied Node policy records failed cleanup intent and restores only through a fresh deployment generation',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const nodeId=f.plan.nodes[1]!.nodeId;
    const leases=await rows(f.db.pool,'SELECT * FROM execution_leases WHERE forward_id=? ORDER BY node_id,assignment_id',[f.forwardId]);
    const slots=await rows(f.db.pool,'SELECT * FROM port_slots WHERE owner_id=? ORDER BY node_id,protocol,port',[f.forwardId]);
    const denied=await f.app.changeNode(f.owner,f.scope,nodeId,randomUUID(),{
      kind:'policy',expectedRevision:1,policy:await managementPolicy(f,nodeId,2,['192.0.2.0/24'])});
    assert.equal(denied.status,202);assert.equal(denied.body.policyRevision,2);
    const operation=await f.db.transaction(tx=>f.app.ledger.latest(tx,f.forwardId));
    assert.equal(operation?.id,denied.body.operationIds[0]);assert.equal(operation?.kind,'revoke');
    assert.equal(operation?.status,'failed');assert.equal(operation?.cleanup_pending,1);
    assert.deepEqual(json(operation?.last_error),{code:'AUTHORIZATION_DENIED',retryable:false});
    for(const node of f.plan.nodes)assert.deepEqual(await f.db.transaction(tx=>f.app.relay.assignments(tx,node.nodeId,true)),[]);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM port_slots WHERE owner_id=? ORDER BY node_id,protocol,port',[f.forwardId]),slots);
    const restored=await f.app.changeNode(f.owner,f.scope,nodeId,randomUUID(),{
      kind:'policy',expectedRevision:2,policy:await managementPolicy(f,nodeId,3,['127.0.0.0/8'])});
    assert.equal(restored.body.policyRevision,3);
    assert.equal((await f.db.transaction(tx=>f.app.ledger.latest(tx,f.forwardId)))?.kind,'policy');
    assert.equal((await f.db.transaction(tx=>f.app.forwarding.get(tx,f.scope,f.forwardId))).revision,1);
    assert.deepEqual(await rows(f.db.pool,'SELECT generation,target_revision FROM relay_deployments WHERE forward_id=? ORDER BY generation',[f.forwardId]),
      [{generation:1,target_revision:1},{generation:2,target_revision:1}]);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM execution_leases WHERE forward_id=? ORDER BY node_id,assignment_id',[f.forwardId]),leases);
  });
});

test('whole-Node revocation invalidates overlapping machine and Relay credentials without a Snapshot capacity veto',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const nodeId=f.plan.nodes[1]!.nodeId,key=randomUUID(),fingerprints=await seedMachineCredentials(f.db,nodeId);
    assert.equal(await f.nodes.machine(fingerprints[0]!),nodeId);
    const leases=await rows<{valid_until:number}>(f.db.pool,'SELECT * FROM execution_leases WHERE forward_id=? ORDER BY node_id,assignment_id',[f.forwardId]);
    const slots=await rows(f.db.pool,'SELECT * FROM port_slots WHERE owner_id=? ORDER BY node_id,protocol,port',[f.forwardId]);
    const original=f.app.ledger.assertCapacity;
    f.app.ledger.assertCapacity=async()=>{throw new Error('Revocation must not depend on removal Snapshot capacity');};
    let result;
    try{result=await f.app.changeNode(f.owner,f.scope,nodeId,key,{kind:'revoke'});}
    finally{f.app.ledger.assertCapacity=original;}
    assert.equal(result.status,202);assert.equal(result.body.policyRevision,1);assert.equal(result.body.operationIds.length,1);
    assert.equal(result.body.latestAuthorizationUntil,new Date(Math.max(...leases.map(l=>l.valid_until))+5000).toISOString());
    assert.equal((await f.db.transaction(tx=>f.nodes.state(tx,nodeId))).revoked,true);
    for(const table of ['node_credentials','node_relay_credentials'])
      assert.ok((await rows<{revoked:number}>(f.db.pool,`SELECT revoked FROM ${table} WHERE node_id=?`,[nodeId])).every(c=>c.revoked===1));
    for(const fingerprint of fingerprints)await assert.rejects(f.nodes.machine(fingerprint),{code:'AUTHORIZATION_DENIED'});
    await assert.rejects(f.db.transaction(tx=>f.nodes.relayCredentialFacts(tx,nodeId)),{code:'AUTHORIZATION_DENIED'});
    for(const node of f.plan.nodes)assert.deepEqual(await f.db.transaction(tx=>f.app.relay.assignments(tx,node.nodeId,true)),[]);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM execution_leases WHERE forward_id=? ORDER BY node_id,assignment_id',[f.forwardId]),leases);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM port_slots WHERE owner_id=? ORDER BY node_id,protocol,port',[f.forwardId]),slots);
    assert.deepEqual(await f.app.changeNode(f.owner,f.scope,nodeId,key,{kind:'revoke'}),result);
    const audit=(await rows<{details:unknown}>(f.db.pool,"SELECT details FROM node_security_events WHERE node_id=? AND kind='node_revocation'",[nodeId]));
    assert.equal(audit.length,1);
    assert.equal(json<{latestAuthorizationUntil:number}>(audit[0]!.details).latestAuthorizationUntil,Math.max(...leases.map(l=>l.valid_until)));
    await assert.rejects(f.app.changeNode(f.owner,f.scope,nodeId,randomUUID(),{
      kind:'policy',expectedRevision:1,policy:await managementPolicy(f,nodeId,2)}),{code:'AUTHORIZATION_DENIED'});
  });
});

test('Node policy path capacity failure rolls back policy, new deployment, Fence and operation',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const nodeId=f.plan.nodes[1]!.nodeId,key=randomUUID(),policy=await managementPolicy(f,nodeId,2);
    const before=await grantState(f.db),original=f.app.ledger.assertCapacity;
    let checks=0;
    f.app.ledger.assertCapacity=async(...args)=>{
      if(++checks===2){
        assert.equal((await rows<{n:number}>(args[0],'SELECT COUNT(*) n FROM relay_deployments WHERE forward_id=?',[f.forwardId]))[0]!.n,2);
        assert.equal((await f.app.ledger.latest(args[0],f.forwardId))?.kind,'policy');
        throw new Error('Injected Node policy capacity failure');
      }
      return original.apply(f.app.ledger,args);
    };
    try{await assert.rejects(f.app.changeNode(f.owner,f.scope,nodeId,key,{kind:'policy',expectedRevision:1,policy}),/Injected Node policy capacity/);}
    finally{f.app.ledger.assertCapacity=original;}
    assert.equal(checks,2);assert.deepEqual(await grantState(f.db),before);
    assert.equal((await f.app.changeNode(f.owner,f.scope,nodeId,key,{kind:'policy',expectedRevision:1,policy})).status,202);
  });
});

test('Node policy persisted response failure rolls back owner, Runtime and security audit tables',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const nodeId=f.plan.nodes[1]!.nodeId,key=randomUUID(),policy=await managementPolicy(f,nodeId,2);
    const before=await grantState(f.db),original=f.app.idempotency.respond;
    let reached=false;
    f.app.idempotency.respond=async(tx,request,response)=>{
      assert.equal(request.key,key);
      assert.equal((await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM node_security_events WHERE node_id=?',[nodeId]))[0]!.n,1);
      assert.equal((await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM relay_deployments WHERE forward_id=?',[f.forwardId]))[0]!.n,2);
      await original.call(f.app.idempotency,tx,request,response);
      reached=true;throw new Error('Injected Node policy response failure');
    };
    try{await assert.rejects(f.app.changeNode(f.owner,f.scope,nodeId,key,{kind:'policy',expectedRevision:1,policy}),/Injected Node policy response/);}
    finally{f.app.idempotency.respond=original;}
    assert.equal(reached,true);assert.deepEqual(await grantState(f.db),before);
    assert.equal((await f.app.changeNode(f.owner,f.scope,nodeId,key,{kind:'policy',expectedRevision:1,policy})).status,202);
  });
});

test('whole-Node audit failure restores credential authority, operation and idempotency state together',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const nodeId=f.plan.nodes[1]!.nodeId,key=randomUUID();
    const fingerprints=await seedMachineCredentials(f.db,nodeId),before=await grantState(f.db),original=f.nodes.audit;
    let reached=false;
    f.nodes.audit=async(tx,id,actor,kind,details)=>{
      assert.equal(id,nodeId);assert.equal(kind,'node_revocation');
      for(const table of ['node_credentials','node_relay_credentials'])
        assert.ok((await rows<{revoked:number}>(tx,`SELECT revoked FROM ${table} WHERE node_id=?`,[nodeId])).every(c=>c.revoked===1));
      assert.equal((await f.app.ledger.latest(tx,f.forwardId))?.kind,'revoke');
      await original.call(f.nodes,tx,id,actor,kind,details);
      reached=true;throw new Error('Injected whole-Node audit failure');
    };
    try{await assert.rejects(f.app.changeNode(f.owner,f.scope,nodeId,key,{kind:'revoke'}),/Injected whole-Node audit/);}
    finally{f.nodes.audit=original;}
    assert.equal(reached,true);assert.deepEqual(await grantState(f.db),before);
    assert.equal(await f.nodes.machine(fingerprints[0]!),nodeId);
    assert.equal((await f.app.changeNode(f.owner,f.scope,nodeId,key,{kind:'revoke'})).status,202);
  });
});

function directCommandSpec(nodeId:string):ForwardSpec{
  return {enabled:true,protocols:['tcp','udp'],ingress:{nodeId,listen:{address:'127.0.0.1',port:32003}},
    target:{host:'127.0.0.1',port:32002}};
}

test('Forward Direct command acceptance preserves CAS, no-op authorization, retry source and occupied resources',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const nodeId=f.plan.nodes[0]!.nodeId,spec=directCommandSpec(nodeId),key=randomUUID();
    const created=await f.app.create(f.owner,f.scope,key,spec),id=created.body.forwardId;
    assert.deepEqual(await f.app.create(f.owner,f.scope,key,spec),created);
    const noop=await f.app.update(f.owner,f.scope,id,randomUUID(),1,spec);
    assert.equal(noop.status,200);assert.equal(noop.body.operationId,null);
    assert.equal((await rows<{n:number}>(f.db.pool,'SELECT COUNT(*) n FROM operations WHERE forward_id=?',[id]))[0]!.n,1);
    await write(f.db.pool,'DELETE FROM node_grants WHERE node_id=? AND actor_id=?',[nodeId,f.owner]);
    await assert.rejects(f.app.update(f.owner,f.scope,id,randomUUID(),1,spec),{code:'NOT_FOUND'});
    await write(f.db.pool,'INSERT INTO node_grants(node_id,actor_id,allowed_roles,port_limits) VALUES(?,?,?,?)',[nodeId,f.owner,JSON.stringify(['ingress']),JSON.stringify({allowedPorts:[32001,32003],maxBindings:16})]);
    const disabled=await f.app.update(f.owner,f.scope,id,randomUUID(),1,{...spec,enabled:false});
    assert.equal(disabled.body.revision,2);
    const enabled=await f.app.update(f.owner,f.scope,id,randomUUID(),2,spec);
    assert.equal(enabled.body.revision,3);
    await write(f.db.pool,"UPDATE operations SET status='failed' WHERE id=?",[enabled.body.operationId]);
    const retried=await f.app.retry(f.owner,f.scope,randomUUID(),enabled.body.operationId!,3);
    assert.equal(retried.body.revision,3);assert.equal(retried.body.sourceOperationId,enabled.body.operationId);
    assert.deepEqual(await rows(f.db.pool,'SELECT generation FROM relay_deployments WHERE forward_id=?',[id]),[]);
    const slots=await rows<{fence:number;deployment_generation:number}>(f.db.pool,
      'SELECT fence,deployment_generation FROM port_slots WHERE owner_id=? ORDER BY protocol',[id]);
    assert.equal(slots.length,2);assert.ok(slots.every(s=>s.fence===4&&s.deployment_generation===4));
    const leases=await rows(f.db.pool,'SELECT * FROM execution_leases ORDER BY node_id,assignment_id');
    const removeKey=randomUUID(),removed=await f.app.remove(f.owner,f.scope,id,removeKey,3);
    assert.equal(removed.body.revision,4);assert.deepEqual(await f.app.remove(f.owner,f.scope,id,removeKey,3),removed);
    assert.equal((await f.db.transaction(tx=>f.app.forwarding.record(tx,f.scope,id))).deleting,true);
    assert.deepEqual(await rows(f.db.pool,'SELECT fence,deployment_generation FROM port_slots WHERE owner_id=? ORDER BY protocol',[id]),slots);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM execution_leases ORDER BY node_id,assignment_id'),leases);
    const kinds=await rows<{kind:string}>(f.db.pool,'SELECT kind FROM operations WHERE forward_id=? ORDER BY target_revision,created_at',[id]);
    assert.deepEqual(kinds.map(o=>o.kind),['create','disable','enable','retry','delete']);
  });
});

test('Forward multi-hop edit and retry advance deployments without rewriting retry intent or extending old leases',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const current=await f.db.transaction(tx=>f.app.forwarding.get(tx,f.scope,f.forwardId)),spec=current.spec;
    const leases=await rows(f.db.pool,'SELECT * FROM execution_leases ORDER BY node_id,assignment_id');
    assert.equal((await f.app.update(f.owner,f.scope,f.forwardId,randomUUID(),1,spec)).status,200);
    const updatedSpec={...spec,target:{host:'127.0.0.1',port:32005}};
    const updateKey=randomUUID(),updated=await f.app.update(f.owner,f.scope,f.forwardId,updateKey,1,updatedSpec);
    assert.equal(updated.body.revision,2);
    assert.deepEqual(await f.app.update(f.owner,f.scope,f.forwardId,updateKey,1,updatedSpec),updated);
    await assert.rejects(f.app.update(f.owner,f.scope,f.forwardId,randomUUID(),1,updatedSpec),{code:'REVISION_CONFLICT'});
    await f.app.update(f.owner,f.scope,f.forwardId,randomUUID(),2,{...updatedSpec,enabled:false});
    const enabled=await f.app.update(f.owner,f.scope,f.forwardId,randomUUID(),3,updatedSpec);
    await write(f.db.pool,"UPDATE operations SET status='failed' WHERE id=?",[enabled.body.operationId]);
    const retryKey=randomUUID(),retried=await f.app.retry(f.owner,f.scope,retryKey,enabled.body.operationId!,4);
    assert.equal(retried.body.revision,4);assert.equal(retried.body.sourceOperationId,enabled.body.operationId);
    assert.deepEqual(await f.app.retry(f.owner,f.scope,retryKey,enabled.body.operationId!,4),retried);
    assert.deepEqual(await rows(f.db.pool,'SELECT generation,target_revision FROM relay_deployments WHERE forward_id=? ORDER BY generation',[f.forwardId]),
      [{generation:1,target_revision:1},{generation:2,target_revision:2},{generation:4,target_revision:4},{generation:5,target_revision:4}]);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM execution_leases ORDER BY node_id,assignment_id'),leases);
  });
});

test('Forward Direct creation rolls back reservations, owner history and operations after response persistence fails',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const key=randomUUID(),spec=directCommandSpec(f.plan.nodes[0]!.nodeId),before=await grantState(f.db),original=f.app.idempotency.respond;
    let reached=false;
    f.app.idempotency.respond=async(tx,request,response)=>{
      await original.call(f.app.idempotency,tx,request,response);
      assert.equal((await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM forwards'))[0]!.n,2);
      assert.equal((await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM port_slots WHERE port=32003'))[0]!.n,2);
      reached=true;throw new Error('Injected Forward create response failure');
    };
    try{await assert.rejects(f.app.create(f.owner,f.scope,key,spec),/Injected Forward create/);}
    finally{f.app.idempotency.respond=original;}
    assert.equal(reached,true);assert.deepEqual(await grantState(f.db),before);
    assert.equal((await f.app.create(f.owner,f.scope,key,spec)).status,202);
  });
});

test('Forward multi-hop update capacity failure rolls back intent, authorizer, plans, fences and replay together',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const forward=await f.db.transaction(tx=>f.app.forwarding.get(tx,f.scope,f.forwardId));
    const spec={...forward.spec,target:{host:'127.0.0.1',port:32005}},key=randomUUID(),before=await grantState(f.db);
    const original=f.app.ledger.assertCapacity;let checks=0;
    f.app.ledger.assertCapacity=async(...args)=>{
      if(++checks===2){
        assert.equal((await f.app.forwarding.get(args[0],f.scope,f.forwardId)).revision,2);
        assert.equal((await rows<{n:number}>(args[0],'SELECT COUNT(*) n FROM relay_deployments WHERE forward_id=?',[f.forwardId]))[0]!.n,2);
        assert.equal((await f.app.ledger.latest(args[0],f.forwardId))?.kind,'update');
        throw new Error('Injected Forward update capacity failure');
      }
      return original.apply(f.app.ledger,args);
    };
    try{await assert.rejects(f.app.update(f.owner,f.scope,f.forwardId,key,1,spec),/Injected Forward update capacity/);}
    finally{f.app.ledger.assertCapacity=original;}
    assert.equal(checks,2);assert.deepEqual(await grantState(f.db),before);
    assert.equal((await f.app.update(f.owner,f.scope,f.forwardId,key,1,spec)).body.revision,2);
  });
});

test('Forward removal retains its capacity veto and rolls back deleting history and cleanup work',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const key=randomUUID(),before=await grantState(f.db),original=f.app.ledger.assertCapacity;
    const leases=await rows(f.db.pool,'SELECT * FROM execution_leases ORDER BY node_id,assignment_id');
    let reached=false;
    f.app.ledger.assertCapacity=async(tx)=>{
      assert.equal((await f.app.forwarding.record(tx,f.scope,f.forwardId)).deleting,true);
      assert.equal((await f.app.ledger.latest(tx,f.forwardId))?.kind,'delete');
      reached=true;throw new Error('Injected Forward delete capacity failure');
    };
    try{await assert.rejects(f.app.remove(f.owner,f.scope,f.forwardId,key,1),/Injected Forward delete capacity/);}
    finally{f.app.ledger.assertCapacity=original;}
    assert.equal(reached,true);assert.deepEqual(await grantState(f.db),before);
    const removed=await f.app.remove(f.owner,f.scope,f.forwardId,key,1);
    assert.equal(removed.body.revision,2);assert.deepEqual(await f.app.remove(f.owner,f.scope,f.forwardId,key,1),removed);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM execution_leases ORDER BY node_id,assignment_id'),leases);
  });
});

test('Forward retry persisted response failure restores source operation, deployment history and idempotency atomically',{skip:!url},async()=>{
  await withRuntime(async f=>{
    await assert.rejects(f.app.retry(f.owner,f.scope,randomUUID(),f.operationId,1),{code:'OPERATION_NOT_RETRYABLE'});
    await write(f.db.pool,"UPDATE operations SET status='failed' WHERE id=?",[f.operationId]);
    const key=randomUUID(),before=await grantState(f.db),original=f.app.idempotency.respond;let reached=false;
    f.app.idempotency.respond=async(tx,request,response)=>{
      assert.equal((await f.app.ledger.latest(tx,f.forwardId))?.kind,'retry');
      assert.equal((await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM relay_deployments WHERE forward_id=?',[f.forwardId]))[0]!.n,2);
      await original.call(f.app.idempotency,tx,request,response);
      reached=true;throw new Error('Injected Forward retry response failure');
    };
    try{await assert.rejects(f.app.retry(f.owner,f.scope,key,f.operationId,1),/Injected Forward retry response/);}
    finally{f.app.idempotency.respond=original;}
    assert.equal(reached,true);assert.deepEqual(await grantState(f.db),before);
    const retried=await f.app.retry(f.owner,f.scope,key,f.operationId,1);
    assert.equal(retried.body.sourceOperationId,f.operationId);assert.equal(retried.body.revision,1);
    assert.deepEqual(await f.app.retry(f.owner,f.scope,key,f.operationId,1),retried);
  });
});

test('Snapshot sources share capacity and publication collection across Direct and non-Direct-only Nodes',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const middle=f.plan.nodes[1]!,ingress=f.plan.nodes[0]!;
    const native=await f.db.transaction(async tx=>f.app.ledger.assignments(tx,f.app.forwarding,await f.nodes.cleanupFacts(tx,middle.nodeId,f.scope)));
    assert.equal(native.length,2);assert.ok(native.every(a=>a.role==='multihop-transit'));
    const accepted=await f.app.create(f.owner,f.scope,randomUUID(),directCommandSpec(ingress.nodeId));
    const collect=(includeAccepted:boolean)=>f.db.transaction(async tx=>
      f.app.ledger.assignments(tx,f.app.forwarding,await f.nodes.cleanupFacts(tx,ingress.nodeId,f.scope),includeAccepted));
    const publish=await collect(false),capacity=await collect(true);
    assert.equal(publish.length,2);assert.ok(publish.every(a=>a.forwardId===f.forwardId));
    assert.equal(capacity.length,4);assert.equal(capacity.filter(a=>a.forwardId===accepted.body.forwardId).length,2);
    await write(f.db.pool,"UPDATE operations SET status='succeeded' WHERE id=?",[accepted.body.operationId]);
    const snapshot=await f.runtime.snapshot(ingress.nodeId,ingress.sessionEpoch);
    assert.equal(snapshot.executionExtension,1);assert.equal(snapshot.assignments.length,4);
    assert.deepEqual(snapshot.assignments.map(a=>a.assignmentId),snapshot.assignments.map(a=>a.assignmentId).sort());
    assert.equal(snapshot.assignments.filter(a=>a.role==='direct').length,2);
    const stored=(await rows<{body:unknown}>(f.db.pool,'SELECT body FROM snapshots WHERE node_id=? AND generation=?',
      [ingress.nodeId,snapshot.snapshotGeneration]))[0]!;
    assert.deepEqual(parseRuntimeMessage('Snapshot',JSON.stringify(json(stored.body))),snapshot);
    assert.equal((await rows<{n:number}>(f.db.pool,'SELECT COUNT(*) n FROM execution_leases WHERE forward_id=?',
      [accepted.body.forwardId]))[0]!.n,2);
  });
});

test('Snapshot source failure during capacity rolls back accepted owner changes, reservations, operations and replay',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const key=randomUUID(),spec=directCommandSpec(f.plan.nodes[0]!.nodeId),before=await grantState(f.db);
    const original=f.app.relay.assignments;let reached=false;
    f.app.relay.assignments=async(tx)=>{
      assert.equal((await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM forwards'))[0]!.n,2);
      assert.equal((await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM port_slots WHERE port=32003'))[0]!.n,2);
      assert.equal((await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM operations'))[0]!.n,2);
      reached=true;throw new Error('Injected Snapshot source read failure');
    };
    try{await assert.rejects(f.app.create(f.owner,f.scope,key,spec),/Injected Snapshot source read/);}
    finally{f.app.relay.assignments=original;}
    assert.equal(reached,true);assert.deepEqual(await grantState(f.db),before);
    assert.equal((await f.app.create(f.owner,f.scope,key,spec)).status,202);
  });
});

test('Snapshot source ownership and resource conflicts fail before publication and roll back preceding coordinator work',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const middle=f.plan.nodes[1]!,original=f.app.relay.assignments,before=await grantState(f.db);
    const authorityBefore=await f.authority.read();
    for(const mode of ['duplicate','host-direct'] as const){
      f.app.relay.assignments=async(...args)=>{
        const assignments=await original.apply(f.app.relay,args);
        assert.equal(assignments.length,2);
        if(mode==='duplicate')return [...assignments,structuredClone(assignments[0]!)];
        return [{...assignments[0]!,role:'direct',driver:{...assignments[0]!.driver,id:'native.direct.v1'}}];
      };
      try{await assert.rejects(f.runtime.snapshot(middle.nodeId,middle.sessionEpoch),
        {code:mode==='duplicate'?'RESOURCE_CONFLICT':'INTEGRITY_FAILURE'});}
      finally{f.app.relay.assignments=original;}
      assert.deepEqual(await grantState(f.db),before);
      assert.deepEqual(await f.authority.read(),authorityBefore);
    }
  });
});

test('Snapshot source registration remains present when multi-hop is disabled so withdrawal retains leases and physical ownership',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const disabled=new ControlApplication(f.db,f.identity,f.nodes,DEFAULT_POLICY,false),middle=f.plan.nodes[1]!;
    const leases=await rows(f.db.pool,'SELECT * FROM execution_leases ORDER BY node_id,assignment_id');
    const slots=await rows(f.db.pool,'SELECT * FROM port_slots ORDER BY node_id,protocol,port');
    assert.deepEqual(await f.db.transaction(async tx=>disabled.ledger.assignments(tx,disabled.forwarding,
      await f.nodes.cleanupFacts(tx,middle.nodeId,f.scope))),[]);
    const runtime=new RuntimeController(f.db,f.nodes,disabled.forwarding,disabled.ledger,DEFAULT_POLICY,f.authority,disabled.relay);
    const snapshot=await runtime.snapshot(middle.nodeId,middle.sessionEpoch);
    assert.deepEqual(snapshot.assignments,[]);assert.equal(snapshot.tombstones.length,2);
    assert.ok(snapshot.tombstones.every(t=>t.role==='multihop-transit'));
    assert.equal(snapshot.executionExtension,1);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM execution_leases ORDER BY node_id,assignment_id'),leases);
    assert.deepEqual(await rows(f.db.pool,'SELECT * FROM port_slots ORDER BY node_id,protocol,port'),slots);
  });
});

test('Snapshot publication failure after lease recording rolls back MySQL but preserves the independent authority high-water',{skip:!url},async()=>{
  await withRuntime(async f=>{
    const ingress=f.plan.nodes[0]!,accepted=await f.app.create(f.owner,f.scope,randomUUID(),directCommandSpec(ingress.nodeId));
    await write(f.db.pool,"UPDATE operations SET status='succeeded' WHERE id=?",[accepted.body.operationId]);
    const before=await grantState(f.db),authorityBefore=await f.authority.read(),original=f.app.ledger.recordLeases;
    let reached=false,issuedUntil=0;
    f.app.ledger.recordLeases=async(tx,snapshot)=>{
      assert.equal(snapshot.assignments.length,4);issuedUntil=Date.parse(snapshot.validUntil);
      await original.call(f.app.ledger,tx,snapshot);
      assert.equal((await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM execution_leases WHERE forward_id=?',
        [accepted.body.forwardId]))[0]!.n,2);
      reached=true;throw new Error('Injected mixed Snapshot lease persistence failure');
    };
    try{await assert.rejects(f.runtime.snapshot(ingress.nodeId,ingress.sessionEpoch),/Injected mixed Snapshot lease persistence/);}
    finally{f.app.ledger.recordLeases=original;}
    assert.equal(reached,true);assert.deepEqual(await grantState(f.db),before);
    const authorityAfter=await f.authority.read();
    assert.ok(authorityAfter.sequence>authorityBefore.sequence);
    assert.ok(authorityAfter.latestValidUntil!>=issuedUntil);
    assert.ok(authorityAfter.latestValidUntil!>=(authorityBefore.latestValidUntil??0));
    const snapshot=await f.runtime.snapshot(ingress.nodeId,ingress.sessionEpoch);
    assert.equal(snapshot.assignments.length,4);
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
