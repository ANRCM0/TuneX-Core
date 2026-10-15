import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { ControlError } from '../src/application/errors.ts';
import { reserveTransitResources } from '../src/modules/runtime/transit-reservations.ts';

const forward:Forward={id:'forward-a',scopeId:'scope-a',revision:1,
  spec:{enabled:true,protocols:['tcp'],
    ingress:{nodeId:'node-a',listen:{address:'127.0.0.1',port:25565}},
    target:{host:'127.0.0.1',port:18080},
    path:{via:['node-b','node-c']},transport:{profileId:'profile-a',configRevision:1}}};
const resources=[
  {nodeId:'node-a',role:'ingress' as const,forwardProtocol:'tcp' as const,
    physicalProtocol:'tcp' as const,address:'127.0.0.1',port:25565},
  {nodeId:'node-b',role:'transit' as const,forwardProtocol:'tcp' as const,
    physicalProtocol:'tcp' as const,address:'127.0.0.1',port:32101},
  {nodeId:'node-c',role:'egress' as const,forwardProtocol:'tcp' as const,
    physicalProtocol:'tcp' as const,address:'127.0.0.1',port:32102},
];

test('strict reservation refuses same-Forward or foreign physical owner before overwriting fences',async()=>{
  for(const owner of ['forward-a','foreign']){
    const statements:string[]=[];
    const tx={execute:async (sql:string,args:unknown[])=>{
      statements.push(sql);
      if(sql.includes('FROM runtime_nodes'))return [[{node_id:args[0]}],[]];
      if(sql.startsWith('INSERT INTO port_slots'))return [{affectedRows:1},[]];
      if(sql.includes('SELECT owner_id,fence'))return [[{owner_id:owner,fence:4}],[]];
      if(sql.startsWith('UPDATE port_slots'))throw new Error('owner fence unexpectedly overwritten');
      return [[],[]];
    }} as unknown as Transaction;
    await assert.rejects(reserveTransitResources(tx,forward,resources,7),
      e=>e instanceof ControlError && e.code==='PORT_RESERVED');
    assert.equal(statements.filter(s=>s.startsWith('UPDATE port_slots')).length,0);
  }
});

test('new exclusively free ports acquire monotonically increasing Fences under locks',async()=>{
  const seen:string[]=[];
  const tx={execute:async(sql:string,args:unknown[])=>{
    seen.push(sql);
    if(sql.includes('FROM runtime_nodes'))return [[{node_id:args[0]}],[]];
    if(sql.startsWith('INSERT INTO port_slots'))return [{affectedRows:1},[]];
    if(sql.includes('SELECT owner_id,fence'))return [[{owner_id:null,fence:4}],[]];
    if(sql.startsWith('UPDATE port_slots'))return [{affectedRows:1},[]];
    if(sql.startsWith('SELECT COUNT(*)'))return [[{n:1}],[]];
    throw new Error('Unexpected SQL '+sql);
  }} as unknown as Transaction;
  const slots=await reserveTransitResources(tx,forward,resources,7);
  assert.equal(slots.length,3);
  assert.deepEqual(slots.map(s=>s.bindingFence),[5,5,5]);
  assert.ok(slots.every(s=>s.forwardId==='forward-a' && s.deploymentGeneration===7));
  assert.equal(seen.filter(s=>s.includes('FOR UPDATE')).length,6);
  assert.equal(seen.filter(s=>s.startsWith('UPDATE port_slots')).length,3);
});
