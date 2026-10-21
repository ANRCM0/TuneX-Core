import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import { ControlError } from '../src/application/errors.ts';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import { reserveTransitResources } from '../src/modules/runtime/transit-reservations.ts';

const url=process.env.TUNEX_TEST_DATABASE_URL;
test('Transit real MySQL: atomic rollback, concurrent exclusivity and monotonic fences',
  {skip:!url},async()=>{
  const db=new MySqlUnitOfWork(url!);
  const suffix=randomUUID().replaceAll('-','').slice(0,16);
  const account='tma-'+suffix,scope='tms-'+suffix,forwardId='tmf-'+suffix;
  const nodes=[0,1,2].map(i=>'tmn-'+i+'-'+suffix);
  const forward:Forward={id:forwardId,scopeId:scope,revision:1,spec:{
    enabled:true,protocols:['tcp'],
    ingress:{nodeId:nodes[0]!,listen:{address:'127.0.0.1',port:25565}},
    target:{host:'127.0.0.1',port:18080},
    path:{via:[nodes[1]!,nodes[2]!]},transport:{profileId:'profile-a',configRevision:1}
  }};
  const resources=[
    {nodeId:nodes[0]!,role:'ingress' as const,forwardProtocol:'tcp' as const,physicalProtocol:'tcp' as const,address:'127.0.0.1',port:25565},
    {nodeId:nodes[1]!,role:'transit' as const,forwardProtocol:'tcp' as const,physicalProtocol:'tcp' as const,address:'127.0.0.1',port:32101},
    {nodeId:nodes[2]!,role:'egress' as const,forwardProtocol:'tcp' as const,physicalProtocol:'tcp' as const,address:'127.0.0.1',port:32102}
  ];
  try{
    await db.migrate();
    await db.transaction(async tx=>{
      await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',[account,'a'.repeat(48)+suffix]);
      await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',[scope,account]);
      for(let i=0;i<nodes.length;i++){
        await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts,resource_source,owner_actor_id,resource_revision) VALUES(?,?,?,?,?,?,?,?)',
          [nodes[i],scope,String(i).repeat(48)+suffix,9999999999,JSON.stringify({}),'private',account,1]);
        await write(tx,'INSERT INTO runtime_nodes(node_id,session_epoch) VALUES(?,?)',[nodes[i],1]);
      }
      await write(tx,'INSERT INTO forwards(id,scope_id,revision,spec,authorization_actor,owner_actor_id) VALUES(?,?,?,?,?,?)',
        [forwardId,scope,forward.revision,JSON.stringify(forward.spec),account,account]);
    });
    // A thrown transaction must not leave a port owner or a bumped fence.
    await assert.rejects(db.transaction(async tx=>{
      await reserveTransitResources(tx,forward,resources,1);
      throw new Error('forced rollback');
    }),/forced rollback/);
    const empty=await rows<{n:number}>(db.pool,
      'SELECT COUNT(*) n FROM port_slots WHERE node_id IN (?,?,?)',nodes);
    assert.equal(Number(empty[0]?.n),0);

    // Two contenders cannot both acquire the same physical resources.
    const attempts=await Promise.allSettled([1,2].map(g=>
      db.transaction(tx=>reserveTransitResources(tx,forward,resources,g))));
    const winners=attempts.filter(a=>a.status==='fulfilled');
    const losers=attempts.filter(a=>a.status==='rejected');
    assert.equal(winners.length,1);
    assert.equal(losers.length,1);
    assert.ok(losers[0]!.status==='rejected' &&
      losers[0]!.reason instanceof ControlError &&
      losers[0]!.reason.code==='PORT_RESERVED');
    const occupied=await rows<{owner_id:string;fence:number}>(db.pool,
      'SELECT owner_id,fence FROM port_slots WHERE node_id IN (?,?,?) ORDER BY node_id',nodes);
    assert.equal(occupied.length,3);
    assert.ok(occupied.every(r=>r.owner_id===forwardId && Number(r.fence)===1));

    // Releasing ownership must not reset the fence; the next claim increments it.
    await db.transaction(async tx=>{
      await write(tx,'UPDATE port_slots SET owner_id=NULL WHERE node_id IN (?,?,?) AND owner_id=?',
        [...nodes,forwardId]);
    });
    const reacquired=await db.transaction(tx=>reserveTransitResources(tx,forward,resources,3));
    assert.deepEqual(reacquired.map(r=>r.bindingFence),[2,2,2]);
    await assert.rejects(db.transaction(tx=>reserveTransitResources(tx,forward,resources,4)),
      e=>e instanceof ControlError && e.code==='PORT_RESERVED');
  }finally{
    try{
      await db.transaction(async tx=>{
        await write(tx,'DELETE FROM port_slots WHERE node_id IN (?,?,?)',nodes);
        await write(tx,'DELETE FROM runtime_nodes WHERE node_id IN (?,?,?)',nodes);
        await write(tx,'DELETE FROM forwards WHERE id=?',[forwardId]);
        await write(tx,'DELETE FROM nodes WHERE id IN (?,?,?)',nodes);
        await write(tx,'DELETE FROM scopes WHERE id=?',[scope]);
        await write(tx,'DELETE FROM accounts WHERE id=?',[account]);
      });
    }finally{await db.close();}
  }
});
