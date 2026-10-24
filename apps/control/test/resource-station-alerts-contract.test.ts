import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseStationAlertConfig, parseStationAlertEvidence, emptyStationAlertState, evaluateStationAlert,
    advanceStationAlert, StationResourceFacts } from '../src/modules/station-alert-owner/public.ts';
import type { StationAlertConfig, StationAlertFact, StationAlertState, StationResourceEvidence } from '../src/modules/station-alert-owner/public.ts';

const now=Date.parse('2026-10-24T00:00:00.000Z');
const config=(rule:'shared-usage-high'|'shared-period-ending'='shared-usage-high'):StationAlertConfig=>({
    schemaVersion:2,rule,target:{kind:'node',id:'node'},enabled:true,subjectActorId:'alice',
    thresholdPercent:rule==='shared-usage-high'?80:null,thresholdSeconds:rule==='shared-usage-high'?0:60});
const evidence=():StationResourceEvidence=>({kind:'resource-limit',targetId:'node',actorId:'alice',bucketId:'bucket',policyRevision:1,
    startsAt:now-1000,endsAt:now+60000,byteLimit:'100',usedBytes:'80',receivedAt:now,usageStatus:'fresh'});
const fact=(resource:StationResourceEvidence|null=evidence()):StationAlertFact=>({kind:'node',id:'node',revoked:false,
    credentialUntil:now+100000,report:null,invalidReport:false,resource});
const evaluate=(value:StationAlertFact|null,state:StationAlertState=emptyStationAlertState(),cfg=config())=>evaluateStationAlert(cfg,value,state,now,1000);

test('P4 quota rule uses exact decimal percentage; stale/missing evidence neither fires nor recovers',()=>{
    const high=evaluate(fact());assert.equal(high.reason,'usage-high');assert.equal(high.status,'firing');
    const firing=advanceStationAlert(emptyStationAlertState(),high,now).state;
    for(const value of [null,{...evidence(),usageStatus:'stale' as const},{...evidence(),usageStatus:'policy-outdated' as const}]){
        const unknown=evaluate(fact(value),firing);assert.equal(unknown.status,'unknown');
        const next=advanceStationAlert(firing,unknown,now);assert.equal(next.state.condition,'firing');assert.equal(next.event,null);
    }
    const low={...evidence(),usedBytes:'79'};assert.equal(evaluate(fact(low)).status,'clear');
    const exact={...evidence(),usedBytes:'7205759403792793',byteLimit:'9007199254740991'};
    assert.equal(evaluate(fact(exact)).status,'firing');
});
test('P4 configured period expiry is explicit even without use; a future head cannot clear the started period',()=>{
    const value={...evidence(),usageStatus:'unknown' as const,usedBytes:null,receivedAt:null};
    assert.equal(evaluate(fact(value),emptyStationAlertState(),config('shared-period-ending')).reason,'period-ending');
    value.endsAt=now;assert.equal(evaluate(fact(value),emptyStationAlertState(),config('shared-period-ending')).reason,'period-ended');
    value.startsAt=now+1;value.endsAt=now+100000;
    assert.equal(evaluate(fact(value),emptyStationAlertState(),config('shared-period-ending')).status,'unknown');
});
test('P4 new period invalidates a firing episode and missing samples do not fabricate recovery',()=>{
    const firing=advanceStationAlert(emptyStationAlertState(),evaluate(fact()),now).state;
    const changed=evaluate(fact({...evidence(),bucketId:'next',usageStatus:'unknown',usedBytes:null,receivedAt:null}),firing);
    const result=advanceStationAlert(firing,changed,now);
    assert.equal(result.event?.kind,'invalidated');assert.equal(result.event?.reason,'period-changed');
    assert.equal(result.state.condition,'unknown');assert.equal(result.state.episode,firing.episode);
});
test('P4 resource config is versioned and refuses arbitrary subjects thresholds and ambiguous evidence',()=>{
    for(const mutate of [(value:any)=>{value.schemaVersion=1;},(value:any)=>{value.thresholdPercent=101;},
        (value:any)=>{value.subjectActorId='bad actor';},(value:any)=>{value.target.kind='forward';},
        (value:any)=>{value.thresholdSeconds=60;},(value:any)=>{value.extra=true;}]){
        const value=structuredClone(config());mutate(value);assert.throws(()=>parseStationAlertConfig(value));
    }
    assert.throws(()=>parseStationAlertEvidence({...evidence(),usedBytes:'080'}));
    assert.equal(evaluate(fact({...evidence(),actorId:'bob'})).status,'unknown');
});
test('P4 Station public fact bridge passes original transaction and managing actor to the resource owner',async()=>{
    const tx={},seen:any[]=[],cfg=config();
    const bridge=new StationResourceFacts({async read(actual,scope){assert.equal(actual,tx);assert.equal(scope,'scope');return fact(null);}},
        {async forAlertIn(...args){seen.push(args);return {policy:{bucketId:'bucket',nodeId:'node',scopeId:'scope',actorId:'alice',revision:1,
            startsAt:now-1000,endsAt:now+100000,byteLimit:100,bytesPerSecond:null,burstBytes:64},consumption:null};}},()=>now);
    const result=await bridge.read(tx,'scope',cfg,'admin');assert.deepEqual(seen,[[tx,'admin','scope','node','alice',now]]);
    assert.equal(result?.kind==='node'&&result.resource?.usageStatus,'unknown');
    await assert.rejects(bridge.read(tx,'scope',cfg),{code:'AUTHORIZATION_DENIED'});
});
