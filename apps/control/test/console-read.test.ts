import assert from 'node:assert/strict';
import { test } from 'node:test';
import { consolePage, consolePageSql, consoleNodes, consoleForwards, consoleOperations, consoleQuery, consoleNodeCandidates, consoleOverview } from '../src/api/console-read.ts';
import type { ControlApplication } from '../src/application/control.ts';

test('console pagination is bounded and rejects malformed integers', () => {
  assert.deepEqual(consolePage(undefined, undefined), { page:1, limit:25, offset:0 });
  assert.deepEqual(consolePage('2','100'), { page:2, limit:100, offset:100 });
  assert.equal(consolePageSql(consolePage('2','100')), 'LIMIT 100 OFFSET 100');
  assert.equal(consolePageSql(consolePage('10000','100')), 'LIMIT 100 OFFSET 999900');
  assert.throws(() => consolePageSql({page:1,limit:25,offset:1.5}));
  assert.throws(() => consolePageSql({page:1,limit:0,offset:0}));
  assert.throws(() => consolePageSql({page:1,limit:25,offset:25}));

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
  const lists = fixture.queries.filter(q=>q.sql.includes('LIMIT 25 OFFSET 0'));
  assert.equal(lists.length,3);
  assert.ok(lists.every(q=>q.params.length===1&&q.params[0]==='scope-a'));
  assert.ok(fixture.queries.every(q=>!q.sql.includes('LIMIT ?')&&!q.sql.includes('OFFSET ?')));
});
test('all three scoped lists use bounded second-page literal offsets', async () => {
  const fixture = stubControl(true);
  await consoleNodes(fixture.control,'viewer','scope-a','2','40');
  await consoleForwards(fixture.control,'viewer','scope-a','2','40');
  await consoleOperations(fixture.control,'viewer','scope-a','2','40');
  const lists = fixture.queries.filter(q=>q.sql.includes('LIMIT 40 OFFSET 40'));
  assert.equal(lists.length,3);
  assert.ok(lists.every(q=>q.params.length===1&&q.params[0]==='scope-a'));
});
test('console filter contracts reject duplicate, unknown, unbounded and injection inputs', () => {
  assert.deepEqual(consoleQuery('operations', new URLSearchParams('page=2&status=failed&forwardId=f_1')), {
    page:'2',limit:undefined,filters:{status:'failed',forwardId:'f_1'}
  });
  for (const [kind, query] of [
    ['nodes','page=1&page=2'],['nodes','idPrefix=x&idPrefix=y'],['nodes','scope=other'],
    ['nodes','credential=online'],['nodes','idPrefix=%25'],['nodes','idPrefix='+ 'x'.repeat(129)],
    ['forwards','enabled=1'],['forwards','recoverySuspended=false%27%20OR%201=1'],
    ['operations','status=ready'],['operations','kind=anything'],['operations','forwardId='],
    ['candidates','mode=quic'],['candidates','protocol=TCP'],['candidates','limit=101'],
    ['candidates','nodeId=../escape'],['nodes','page=10001'],
  ] as const) assert.throws(()=>consoleQuery(kind,new URLSearchParams(query)),query);
});
test('filters are bound identically into count and page SQL; prefix underscore stays literal', async () => {
  const f=stubControl(true);
  await consoleNodes(f.control,'viewer','scope-a','2','25',{idPrefix:'node_',credential:'valid'});
  assert.deepEqual(f.queries[0]!.params,f.queries[1]!.params);
  assert.equal(f.queries[0]!.params[1],'node!_');
  assert.ok(f.queries.every(q=>q.sql.includes("ESCAPE '!'")&&!q.sql.includes('node_')));
  f.queries.length=0;
  await consoleForwards(f.control,'viewer','scope-a',undefined,undefined,{enabled:'false',protocol:'both',recoverySuspended:'true'});
  assert.deepEqual(f.queries[0]!.params,['scope-a','false',true,'["tcp","udp"]']);
  assert.deepEqual(f.queries[0]!.params,f.queries[1]!.params);
  f.queries.length=0;
  await consoleOperations(f.control,'viewer','scope-a',undefined,undefined,{forwardId:'f-1',kind:'update',status:'failed'});
  assert.deepEqual(f.queries[0]!.params,['scope-a','f-1','update','failed']);
  assert.deepEqual(f.queries[0]!.params,f.queries[1]!.params);
});
test('candidate and overview authorization precedes data SQL, including manager requirement', async () => {
  const f=stubControl(false);
  await assert.rejects(consoleNodeCandidates(f.control,'viewer','scope-a'));
  await assert.rejects(consoleOverview(f.control,'viewer','scope-a'));
  assert.equal(f.queries.length,0);
  const permitted=stubControl(true);
  let manage=false;
  permitted.control.identity.scope=async(_tx,_actor,_scope,required)=>{manage=required===true;};
  const candidates=await consoleNodeCandidates(permitted.control,'viewer','scope-a','2','25',{mode:'multihop',protocol:'both'});
  assert.equal(manage,true);
  assert.equal(candidates.reserved,false);
  assert.equal(candidates.fullPlanAuthorization,false);
  assert.equal(candidates.independentProbe,false);
  assert.ok(permitted.queries.every(q=>q.sql.startsWith('SELECT')&&q.sql.includes('node_grants')&&q.params[0]==='scope-a'));
  assert.ok(permitted.queries[1]!.sql.includes('ORDER BY n.id LIMIT 25 OFFSET 25'));
  assert.equal(permitted.queries[0]!.params.at(-1),'["adp.3","native.direct.v1","native.relay.v1","relay.wire.1","adp.execution.1","native.multihop.v1","multihop.wire.1","tcp","udp"]');
});
test('overview counts are scoped, single-statement and independent of any page or filter', async () => {
  let queries=0;
  const control={
    db:{transaction:async(fn:(v:unknown)=>Promise<unknown>)=>fn({
      execute:async(sql:string,args:unknown[])=>{
        queries++; assert.deepEqual(args,['scope-a','scope-a','scope-a','scope-a']);
        assert.ok(sql.includes("status IN ('accepted','running')"));
        assert.ok(!sql.includes('LIMIT'));
        return [[{nodes:80,forwards:60,active:28,failed:32}],[]];
      }
    })},
    identity:{scope:async()=>undefined}
  } as unknown as ControlApplication;
  const result=await consoleOverview(control,'viewer','scope-a');
  assert.equal(queries,1);
  assert.equal(result.nodes,80);assert.equal(result.activeOperations,28);assert.equal(result.failedOperations,32);
  assert.equal(result.independentProbe,false);
});
