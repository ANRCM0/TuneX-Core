import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { digest } from '@tunex/contracts';
import { verifyTransitStage } from '../src/modules/runtime/transit-staging.ts';
import type { TransitStageRow } from '../src/modules/runtime/transit-staging.ts';
import { ControlError } from '../src/application/errors.ts';

function example():TransitStageRow {
  const assignments=[
    {nodeId:'node-a',role:'ingress',sessionEpoch:2,bindingFence:4,resource:{nodeId:'node-a',role:'ingress',port:32001}},
    {nodeId:'node-b',role:'transit',sessionEpoch:3,bindingFence:5,resource:{nodeId:'node-b',role:'transit',port:32101}},
    {nodeId:'node-c',role:'egress',sessionEpoch:4,bindingFence:6,resource:{nodeId:'node-c',role:'egress',port:32102}},
  ];
  const body={executable:false,forwardId:'forward-a',scopeId:'scope-a',
    forwardRevision:4,deploymentGeneration:7,pathDigest:'sha256:'+'2'.repeat(64),
    profileDigest:'sha256:'+'1'.repeat(64),authorizationUntil:Date.parse('2026-10-15T00:30:00Z'),
    activationOrder:['node-c','node-b','node-a'],assignments,intents:[]};
  const planDigest=digest(body);
  return {forward_id:'forward-a',generation:7,target_revision:4,scope_id:'scope-a',
    created_by:'owner-a',state:'reserved',expires_at:Date.parse('2026-10-15T00:05:00Z'),
    plan_digest:planDigest,body:{...body,planDigest},
    created_at:Date.parse('2026-10-15T00:00:00Z'),updated_at:Date.parse('2026-10-15T00:00:00Z')};
}
const rejected=(e:unknown)=>e instanceof ControlError && e.code==='INTEGRITY_FAILURE';
test('staging journal is detached immutable and retains independent Scope, generation, digest and Fence proof',()=>{
  const row=example(),plan=verifyTransitStage(row);
  assert.equal(plan.executable,false);
  assert.equal(plan.planDigest,row.plan_digest);
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.assignments[0]));
  for(const mutation of [
    (r:TransitStageRow)=>{r.scope_id='other';},
    (r:TransitStageRow)=>{r.generation=8;},
    (r:TransitStageRow)=>{r.plan_digest='sha256:'+'f'.repeat(64);},
    (r:TransitStageRow)=>{r.expires_at=Date.parse('2026-10-15T01:00:00Z');},
    (r:TransitStageRow)=>{Reflect.set(r.body as object,'executable',true);},
    (r:TransitStageRow)=>{Reflect.set((r.body as {assignments:unknown[]}).assignments[0]!, 'bindingFence',0);},
    (r:TransitStageRow)=>{Reflect.set(r.body as object,'activationOrder',['node-b','node-b','node-a']);},
  ]){
    const copy=structuredClone(row);mutation(copy);
    assert.throws(()=>verifyTransitStage(copy),rejected);
  }
});
test('multi-hop MySQL state stores no executable or active states',()=>{
  const sql=readFileSync(new URL('../migrations/0010-transit-staging.sql',import.meta.url),'utf8');
  assert.match(sql,/CREATE TABLE transit_deployments/);
  assert.match(sql,/ENUM\('reserved','aborted'\)/);
  assert.match(sql,/plan_digest/);
  assert.match(sql,/CHECK\(generation BETWEEN/);
  assert.doesNotMatch(sql,/ENUM\([^)]*active/);
});
