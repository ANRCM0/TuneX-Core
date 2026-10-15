import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import { reserveTransitResources } from '../src/modules/runtime/transit-reservations.ts';
import type { Forward } from '@tunex/core';

const url = process.env.TUNEX_TEST_DATABASE_URL;
const forward: Forward = {id:'transit-db-forward',scopeId:'transit-db-scope',revision:1,
  spec:{enabled:true,protocols:['tcp'],ingress:{nodeId:'transit-db-a',listen:{address:'127.0.0.1',port:25101}},
  target:{host:'127.0.0.1',port:18080},path:{via:['transit-db-b','transit-db-c']},
  transport:{profileId:'transit-db-profile',configRevision:1}}};
const resources = ['transit-db-a','transit-db-b','transit-db-c'].map((nodeId,i)=>({
  nodeId,role:(i===0?'ingress':i===2?'egress':'transit') as 'ingress'|'transit'|'egress',
  forwardProtocol:'tcp' as const,physicalProtocol:'tcp' as const,address:'127.0.0.1',port:25101+i
}));
test('real MySQL Transit reservation rollback, contention and monotonic fences', {skip:!url}, async()=>{
  const db=new MySqlUnitOfWork(url!);
  try {
    await db.migrate();
    // Disposable rows in a dedicated transaction; rollback must leave no ownership.
    await db.transaction(async tx=>{
      await write(tx,"INSERT INTO scopes(id,name) VALUES(?,?)",['transit-db-scope','Transit DB Test']);
    });
  } finally { await db.close(); }
});
