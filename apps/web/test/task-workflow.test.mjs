import assert from 'node:assert/strict';
import { test } from 'node:test';
import { workflowSteps, createBoundedPageReads, batchProgress } from '../task-workflow.js';

function fixture(read=async()=>{}) {
  let identity='connection-1',page='overview',visible=true;
  const timers=[],states=[],calls=[];
  const api=createBoundedPageReads({identity:()=>identity,page:()=>page,visible:()=>visible,
    async read(...args){calls.push(args);return read(...args);},state:value=>states.push(value),
    schedule(work,ms){assert.equal(ms,10000);const timer={work,cancelled:false};timers.push(timer);return timer;},
    cancel(timer){timer.cancelled=true;}});
  return {api,calls,states,timers,scope:value=>{identity=value;},page:value=>{page=value;},hide:()=>{visible=false;},
    async tick(){const timer=timers.shift();assert.ok(timer);if(!timer.cancelled)await timer.work();}};
}
test('P5 reads require explicit start, finish after six rounds and never schedule a seventh',async()=>{
  const f=fixture();assert.equal(f.calls.length,0);await f.api.start();
  for(let index=0;index<5;index++)await f.tick();
  assert.equal(f.calls.length,6);assert.equal(f.timers.length,0);assert.equal(f.states.at(-1).reason,'complete');
});
test('P5 unresolved read never overlaps and manual stop fences even a client ignoring abort',async()=>{
  let resolve,applied=0;
  const f=fixture(async(_page,guard)=>{await new Promise(done=>{resolve=done;});if(guard.isCurrent())applied++;});
  const work=f.api.start();assert.equal(f.calls.length,1);assert.equal(f.timers.length,0);
  const signal=f.calls[0][1].signal;f.api.stop();assert.equal(signal.aborted,true);resolve();await work;
  assert.equal(applied,0);assert.equal(f.timers.length,0);
});
test('P5 scope page hidden and unsupported contexts stop without another read',async()=>{
  for(const change of [f=>f.scope('connection-2'),f=>f.page('forwards'),f=>f.hide()]){
    const f=fixture();await f.api.start();change(f);await f.tick();assert.equal(f.calls.length,1);assert.equal(f.timers.length,0);
  }
  const unsupported=fixture();unsupported.page('resources');await unsupported.api.start();assert.equal(unsupported.calls.length,0);
});
test('P5 read error stops finite refresh and account changes fence a late successful response',async()=>{
  const failed=fixture(async()=>{throw Error('offline');});await failed.api.start();
  assert.equal(failed.states.at(-1).reason,'failed');assert.equal(failed.timers.length,0);
  let release,applied=0;const late=fixture(async(_page,guard)=>{await new Promise(done=>{release=done;});if(guard.isCurrent())applied++;});
  const work=late.api.start();late.scope('connection-2');release();await work;assert.equal(applied,0);assert.equal(late.timers.length,0);
});
test('P5 batch summary distinguishes accepted commands missing observations and failed Operations',()=>{
  const accepted=id=>({kind:'apply',outcome:{accepted:true,result:{accepted:{body:{operationId:id}}}}});
  const result=batchProgress({items:[{state:'accepted'},{state:'accepted'},{state:'rejected'},{state:'pending'}],
    attempts:[accepted('one'),accepted('two')],operations:[{operationId:'one',status:'failed',cleanupPending:true,recoveryInvalidated:false}]});
  assert.equal(result.items.accepted,2);assert.equal(result.operations.succeeded,0);assert.equal(result.operations.failed,1);
  assert.equal(result.missing,1);assert.equal(result.cleanup,1);assert.match(result.text,/不证明业务健康/);
});
test('P5 guide remains actionable without representing counts or historical failures as accepted health',()=>{
  const disconnected=workflowSteps({connected:false,overview:null});assert.equal(disconnected.length,5);assert.ok(disconnected.every(item=>!item.enabled));
  const connected=workflowSteps({connected:true,overview:{nodes:1,forwards:1,activeOperations:1,failedOperations:1}});
  assert.match(connected[3].detail,/尚在执行/);assert.match(connected[4].detail,/历史失败/);assert.ok(connected.every(item=>item.enabled));
});

test('guide recommends one next task only from complete bounded counters, never from missing data',()=>{
  for(const overview of [null,{}, {nodes:0,forwards:0}, {nodes:-1,forwards:0,activeOperations:0},
    {nodes:0,forwards:NaN,activeOperations:0}]){
    assert.equal(workflowSteps({connected:true,overview}).filter(step=>step.primary).length,0);
  }
  const overview={nodes:0,forwards:0,activeOperations:0,failedOperations:0};
  assert.equal(workflowSteps({connected:false,overview}).filter(step=>step.primary).length,0);
  const steps=workflowSteps({connected:true,overview});
  assert.deepEqual(steps.filter(step=>step.primary).map(step=>step.action),['workflow-node-create']);
  assert.equal(steps[1].enabled,true);assert.match(steps[0].detail,/共享/);
});

test('guide prioritizes pending deployment and does not describe historical failures as current incidents',()=>{
  const selected=overview=>workflowSteps({connected:true,overview}).find(step=>step.primary);
  assert.equal(selected({nodes:0,forwards:0,activeOperations:2}).view,'operations');
  assert.equal(selected({nodes:1,forwards:0,activeOperations:0}).action,'workflow-forward-create');
  const next=selected({nodes:1,forwards:1,activeOperations:0,failedOperations:20});
  assert.equal(next.label,'查看转发状态');assert.match(next.detail,/不代表当前故障/);
  assert.ok(!Object.hasOwn(next,'healthy'));assert.ok(!Object.hasOwn(next,'complete'));
});
