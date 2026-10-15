import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MultihopConfig } from '@tunex/contracts';
import { compileMultihopPlan } from '../src/modules/runtime/multihop-plan.ts';
import { compileSnapshot } from '../src/modules/runtime/planner.ts';
import { multihopFixture } from './fixtures/multihop.ts';

for(const count of [3,4,8])test(`${count}-Node execution binds every role, session and physical Fence`,()=>{
  const input=multihopFixture(count),before=JSON.stringify(input),plan=compileMultihopPlan(input);
  assert.equal(plan.nodes.length,count);assert.equal(plan.authorizationUntil,Date.parse('2026-10-16T11:00:00Z'));
  for(const [i,node] of plan.nodes.entries()){
    assert.equal(node.assignments.length,2);
    for(const a of node.assignments){const h=(a.driver.config as MultihopConfig).hop;
      assert.equal(h.path.length,count);assert.equal(h.hopIndex,i);assert.equal(h.path[i]!.sessionEpoch,node.sessionEpoch);
      assert.equal(a.role,i===0?'multihop-ingress':i===count-1?'multihop-egress':'multihop-transit');
      assert.equal(a.resource.protocol,i===0?a.protocol:'tcp');
    }
    const snapshot=compileSnapshot({nodeId:node.nodeId,sessionEpoch:node.sessionEpoch,snapshotGeneration:1,
      issuedAt:input.issuedAt,validUntil:'2026-10-16T10:05:00Z',assignments:node.assignments,tombstones:[]});
    assert.equal(snapshot.executionExtension,1);
  }
  assert.equal(JSON.stringify(input),before);assert.equal(Object.isFrozen(input.profile.config),false);
  assert.equal(compileMultihopPlan({...input,nodes:[...input.nodes].reverse(),endpoints:[...input.endpoints].reverse(),reservations:[...input.reservations].reverse()}).planDigest,plan.planDigest);
});

test('multi-hop compiler refuses absent capabilities, policy, exact ownership and peer authority',()=>{
  const mutations:((f:ReturnType<typeof multihopFixture>)=>void)[]=[
    f=>{f.nodes[1]!.facts={...f.nodes[1]!.facts,capabilities:f.nodes[1]!.facts.capabilities.filter(c=>c!=='adp.execution.1')};},
    f=>{f.nodes[1]!.facts={...f.nodes[1]!.facts,allowedDestinationCidrs:['10.0.0.0/8']};},
    f=>{f.nodes[1]!.sessionEpoch=0;},f=>{f.nodes[1]!.peers=[];},
    f=>{f.reservations[1]!.bindingFence=0;},f=>{f.reservations[1]!.deploymentGeneration++;},
    f=>{f.reservations[1]!.forwardId='foreign';},f=>{f.reservations.pop();},
    f=>{f.ports['node-2']!.udp=f.ports['node-2']!.tcp!;},
  ];
  for(const mutate of mutations){const f=multihopFixture();mutate(f);assert.throws(()=>compileMultihopPlan(f));}
});
