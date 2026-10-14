import assert from 'node:assert/strict';
import { test } from 'node:test';
import { consolePage, consoleNodes, consoleForwards, consoleOperations } from '../src/api/console-read.ts';
import type { ControlApplication } from '../src/application/control.ts';

test('console pagination is bounded and rejects malformed integers', () => {
  assert.deepEqual(consolePage(undefined, undefined), { page:1, limit:25, offset:0 });
  assert.deepEqual(consolePage('2','100'), { page:2, limit:100, offset:100 });
  for (const value of ['0','-1','1.5','0x10','10001','Infinity','1e4','']) {
    assert.throws(() => consolePage(value,undefined));
  }
  for (const value of ['0','101','01','-3','1.5']) assert.throws(() => consolePage('1',value));
});

function stubControl(allow: boolean) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const tx = {
    execute: async (sql: string, params: unknown[]) => {
      queries.push({sql, params});
      if (sql.includes('COUNT(*)')) return [[{ n: 1 }], []];
      if (sql.includes('FROM nodes n')) return [[{
        id:'node-a', revoked:0, credential_until:null,
        facts: JSON.stringify({ allowedListenerAddresses:['127.0.0.1'],allowedPorts:[25565],capabilities:[] }),
        session_epoch:1, snapshot_generation:2, received_at:null
      }], []];
      if (sql.includes('FROM forwards f')) return [[{
        id:'forward-a', revision:3, spec:JSON.stringify({enabled:false}),
        recovery_suspended:1, operation_id:'op-1', operation_kind:'disable', operation_status:'succeeded'
      }], []];
      if (sql.includes('FROM operations WHERE scope_id=')) return [[{
        id:'op-1',forward_id:'forward-a',kind:'disable',status:'succeeded',target_revision:3,
        created_at:1000,updated_at:2000,last_error:null,recovery_invalidated:0,cleanup_pending:0
      }], []];
      throw new Error('Unexpected query: ' + sql);
    }
  };
  const control = {
    db:{ transaction:async (fn: (v: unknown)=>Promise<unknown>)=>fn(tx) },
    identity:{ scope:async (_: unknown, actor:string, scope:string)=>{
      if (!allow || actor!=='viewer' || scope!=='scope-a') throw new Error('denied');
    }}
  } as unknown as ControlApplication;
  return { control, queries };
}
test('read models enforce scope before running any page SQL', async () => {
  const fixture = stubControl(false);
  for (const read of [consoleNodes, consoleForwards, consoleOperations]) {
    await assert.rejects(read(fixture.control,'viewer','scope-a'));
  }
  assert.equal(fixture.queries.length,0);
});
test('page queries are scope bound, return no enrollment secret and separate operation status', async () => {
  const fixture = stubControl(true);
  const nodes = await consoleNodes(fixture.control,'viewer','scope-a');
  const forwards = await consoleForwards(fixture.control,'viewer','scope-a');
  const operations = await consoleOperations(fixture.control,'viewer','scope-a');
  assert.equal(nodes.items[0]?.id,'node-a');
  assert.equal(nodes.items[0]?.lastReportAt,null);
  assert.equal('enrollmentToken' in (nodes.items[0] ?? {}),false);
  assert.deepEqual(forwards.items[0]?.lastOperation,{id:'op-1',kind:'disable',status:'succeeded'});
  assert.equal(forwards.items[0]?.recoverySuspended,true);
  assert.equal(operations.items[0]?.status,'succeeded');
  assert.ok(fixture.queries.every(q=>q.params[0]==='scope-a'));
  assert.ok(fixture.queries.filter(q=>q.sql.includes('LIMIT ? OFFSET ?')).every(q=>q.params[1]===25&&q.params[2]===0));
});
