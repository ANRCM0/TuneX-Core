import assert from 'node:assert/strict';
import { test } from 'node:test';
import { payloadLimitView, personalPayloadLimitView } from '../resource-limit-console.js';
const identity={nodeId:'node',scopeId:'scope',actorId:'actor'};
const view=()=>({...identity,revision:1,policy:{bucketId:'bucket',startsAt:'2026-10-01T00:00:00.000Z',
  endsAt:'2026-11-01T00:00:00.000Z',bytesPerSecond:null,burstBytes:64,byteLimit:100},
  consumption:{status:'fresh',source:'agent-protected-journal',accounting:'conservative-precharge',usedBytes:'30',remainingBytes:'70',
    remainingMeaning:'upper-bound-at-sample',receivedAt:'2026-10-24T00:00:00.000Z',policyRevision:1,sessionEpoch:1,reportSequence:2,periodStatus:'active'}});
test('P3 recent sample explains precharge and does not promise a live balance',()=>{
  const result=personalPayloadLimitView(view(),identity);assert.match(result['样本时剩余额度'],/70 B/);
  assert.match(result['样本时剩余额度'],/可能更少/);assert.match(result['消费口径'],/不是精确送达量/);
});
test('P3 unknown and old policy samples cannot carry remaining bytes or incompatible identities',()=>{
  for(const change of [v=>{v.consumption.status='unknown';},v=>{v.consumption.status='stale';},
    v=>{v.actorId='foreign';},v=>{v.consumption.usedBytes='030';},v=>{v.consumption.remainingBytes='99';}]){
    const value=view();change(value);assert.throws(()=>payloadLimitView(value,identity));
  }
});
test('P3 latest configured future period and active period are displayed independently',()=>{
  const value=view();value.activePeriod={revision:1,policy:{...value.policy},consumption:{...value.consumption}};
  value.revision=2;value.policy={...value.policy,bucketId:'next',startsAt:'2026-11-01T00:00:00.000Z',endsAt:'2026-12-01T00:00:00.000Z'};
  value.consumption={...value.consumption,status:'unknown',usedBytes:null,remainingBytes:null,receivedAt:null,
    policyRevision:null,sessionEpoch:null,reportSequence:null,periodStatus:'future'};
  const result=personalPayloadLimitView(value,identity);assert.match(result['当前周期已预扣'],/30 B/);
  assert.match(result['当前周期样本剩余'],/70 B/);assert.equal(result['已持久预扣'],'未知');
});
