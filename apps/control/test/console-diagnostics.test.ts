import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConsoleQueries } from '../src/application/console-queries.ts';
import { MySqlConsoleReadModels } from '../src/infrastructure/mysql-console-read.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

function fixture(permit: boolean, returned = true) {
  const statements:{sql:string;args:unknown[]}[]=[];
  const tx={
    execute:async (sql:string,args:unknown[])=>{
      statements.push({sql,args});
      assert.ok(sql.includes('n.scope_id=?'),'diagnostic SQL must filter by scope');
      return [[...(returned?[{
        id:'node-1',revoked:0,credential_until:500000,session_epoch:3,
        snapshot_generation:4,last_report_sequence:7,received_at:200000,last_report:JSON.stringify({
          observations:[
            {assignmentId:'a',condition:'ready',errorCode:null},
            {assignmentId:'b',condition:'error',errorCode:'TARGET_UNAVAILABLE',retryable:true}
          ],secretKey:'MUST_NOT_LEAK'
        }),valid_until:400000
      }]:[])],[]];
    }
  };
  const queries=new ConsoleQueries<Transaction>(
    {transaction:async action=>action(tx as unknown as Transaction)},
    {scope:async (_tx:Transaction,actor:string,scope:string)=>{
      if(!permit||actor!=='viewer'||scope!=='allowed-scope')throw Error('Denied');
    }}, new MySqlConsoleReadModels()
  );
  return {queries,statements};
}
test('Node diagnostics authorizes scope before querying any Node state',async()=>{
  const f=fixture(false);
  await assert.rejects(f.queries.diagnostics('viewer','other-scope','node-1'));
  assert.equal(f.statements.length,0);
  await assert.rejects(f.queries.diagnostics('viewer','allowed-scope','../bad'));
  assert.equal(f.statements.length,0);
});
test('Node diagnostics is read-only, scoped, sanitized and never claims probe health',async()=>{
  const f=fixture(true);
  const result=await f.queries.diagnostics('viewer','allowed-scope','node-1');
  assert.equal(result.nodeId,'node-1');
  assert.equal(result.independentProbe,false);
  assert.equal(result.source,'persisted-control-state');
  assert.equal(result.reportStatus,'age-only');
  assert.equal(result.totalReportedObservations,2);
  assert.deepEqual(result.errors,[{assignmentId:'b',condition:'error',errorCode:'TARGET_UNAVAILABLE',retryable:true}]);
  assert.equal(JSON.stringify(result).includes('MUST_NOT_LEAK'),false);
  assert.equal(f.statements.length,1);
  assert.deepEqual(f.statements[0]!.args,['node-1','allowed-scope']);
});
test('Node diagnostics returns 404 for out-of-scope or missing Node',async()=>{
  const f=fixture(true,false);
  await assert.rejects(f.queries.diagnostics('viewer','allowed-scope','node-1'),(error:unknown)=>
    typeof error==='object'&&error!==null&&'code' in error&&error.code==='NOT_FOUND'
  );
});
