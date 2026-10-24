import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProbePathObservations } from '../src/modules/probe-history-owner/public.ts';
import { nativeValueDigest as digest, nativeProbeHistoryEchoInvocation, probeEchoInvocationDigest, probeEchoServiceSelection } from '../src/compatibility/public.ts';
import { ControlError } from '../src/framework/public.ts';
import { evaluateStationAlert, advanceStationAlert, emptyStationAlertState, parseStationAlertConfig, StationPathFacts } from '../src/modules/station-alert-owner/public.ts';
import type { StationAlertConfig, StationAlertFact, StationPathEvidence } from '../src/modules/station-alert-owner/public.ts';
import { parseNotificationPayload, notificationWireBody } from '../src/modules/notification-owner/public.ts';

const at=Date.parse('2026-10-24T00:00:00.000Z');
const config:StationAlertConfig={schemaVersion:3,rule:'recent-path-probe-degraded',target:{kind:'forward',id:'forward'},enabled:true,
    thresholdSeconds:0,measurement:'tcp-path-echo-v1',maxSampleAgeSeconds:120,maxElapsedMs:250};
const sample=():StationPathEvidence=>({kind:'path-probe',targetId:'forward',forwardRevision:1,bindingDigest:'sha256:'+'b'.repeat(64),probeId:'probe',
    measurement:'tcp-path-echo-v1',status:'unverified',elapsedMs:200,measuredAt:at-100,acceptedAt:at-50,validUntil:at+1000});
const fact=(pathSample:StationPathEvidence|null):StationAlertFact=>({kind:'forward',id:'forward',revision:1,enabled:true,deleting:false,recoverySuspended:false,operation:null,pathSample});

test('P4 notification payload preserves Forward targets for recent path rules and rejects the opposite target for all six rules',()=>{
    for(const [rule,kind,reason] of [
        ['forward-operation-failed','forward','operation-failed'],['node-report-stale','node','report-stale'],
        ['node-credential-expiring','node','credential-expiring'],['shared-usage-high','node','usage-high'],
        ['shared-period-ending','node','period-ending'],['recent-path-probe-degraded','forward','path-sample-slow'],
    ] as const) {
        const payload={notificationVersion:1,deliveryId:'delivery',scopeId:'scope',event:{id:'event',policyId:'policy',
            configRevision:1,episode:1,kind:'firing',rule,target:{kind,id:'target'},reason,occurredAt:at}};
        const parsed=parseNotificationPayload(payload);assert.deepEqual(parsed,payload);
        assert.equal(notificationWireBody(parsed),JSON.stringify(payload),'closed v1 bytes and field order stay unchanged');
        assert.throws(()=>parseNotificationPayload({...payload,event:{...payload.event,target:{kind:kind==='forward'?'node':'forward',id:'target'}}}),{code:'INVALID_CONFIG'});
        assert.throws(()=>parseNotificationPayload({...payload,event:{...payload.event,target:{...payload.event.target,extra:true}}}),{code:'INVALID_CONFIG'});
    }
});

test('P4 recent path condition distinguishes a recorded failure and slow sample from missing stale and threshold-equal samples',()=>{
    const first=evaluateStationAlert(config,fact(sample()),emptyStationAlertState(),at,0);assert.equal(first.reason,'path-sample-failed');
    const firing=advanceStationAlert(emptyStationAlertState(),first,at).state;
    for(const missing of [null,{...sample(),measuredAt:at-120001}]){
        const unknown=evaluateStationAlert(config,fact(missing),firing,at,0);assert.equal(unknown.status,'unknown');
        assert.equal(advanceStationAlert(firing,unknown,at).event,null);
    }
    assert.equal(evaluateStationAlert(config,fact({...sample(),status:'echoed',elapsedMs:251}),emptyStationAlertState(),at,0).reason,'path-sample-slow');
    assert.equal(evaluateStationAlert(config,fact({...sample(),status:'echoed',elapsedMs:250}),emptyStationAlertState(),at,0).status,'clear');
});
test('P4 recovery requires a newer different sample and a new binding invalidates without a recovered event',()=>{
    const firing=advanceStationAlert(emptyStationAlertState(),evaluateStationAlert(config,fact(sample()),emptyStationAlertState(),at,0),at).state;
    assert.equal(evaluateStationAlert(config,fact({...sample(),status:'echoed'}),firing,at,0).reason,'recovery-not-proven');
    const next={...sample(),probeId:'new-probe',status:'echoed' as const,measuredAt:at,acceptedAt:at};
    const recovered=advanceStationAlert(firing,evaluateStationAlert(config,fact(next),firing,at,0),at);assert.equal(recovered.event?.kind,'recovered');
    const rebound={...next,bindingDigest:'sha256:'+'c'.repeat(64)};
    const changed=advanceStationAlert(firing,evaluateStationAlert(config,fact(rebound),firing,at,0),at);
    assert.equal(changed.event?.kind,'invalidated');assert.equal(changed.event?.reason,'path-binding-changed');
    assert.throws(()=>parseStationAlertConfig({...config,measurement:'tcp-ingress-echo-v1'}));
    assert.throws(()=>parseStationAlertConfig({...config,maxSampleAgeSeconds:301}));
    assert.throws(()=>parseStationAlertConfig({...config,automaticProbe:true}));
});

function historyFixture() {
    const tx={},principal={actorId:'observer',governance:true} as any,trace:any[]=[];
    const config={version:2 as const,purpose:'controlled-nonce-echo' as const,endpoint:{address:'127.0.0.1',port:8080,protocols:['tcp'] as const},
        trust:{mode:'ed25519-echo-v1' as const,publicKey:Buffer.alloc(32,1).toString('base64')},validFrom:at-10000,validUntil:at+60000};
    const raw={scopeId:'scope',serviceId:'service',revision:1,configRevision:1,configDigest:digest(config),config},context={...raw,contextDigest:digest(raw)};
    const record:any={probeId:'probe',scopeId:'scope',actorId:'issuer',measurement:'tcp-path-echo-v1',service:probeEchoServiceSelection(context),
        binding:{nodeId:'node',bootId:'boot',sessionEpoch:1,snapshotGeneration:1,assignmentId:'assignment',forwardId:'forward',forwardRevision:1,
            deploymentGeneration:1,bindingFence:1,configDigest:'sha256:'+'a'.repeat(64),egressPolicyRevision:1},
        instanceId:'1'.repeat(64),instanceGeneration:1,timeoutMs:1000,issuedAt:at-1000,expiresAt:at+1000,state:'consumed',closedAt:at-900,
        revision:3,updatedAt:at-50,withdrawnAt:null,recoverySuspended:false,echoChallenge:{nonce:Buffer.alloc(32,2).toString('base64'),invocationDigest:''},
        result:{status:'unverified',code:'nonce-echo-rejected',elapsedMs:200,measuredAt:at-100,validUntil:at+500,acceptedAt:at-50,
            resultDigest:'sha256:'+'d'.repeat(64),echo:null,requestBytes:256,responseBytes:0}};
    record.echoChallenge.invocationDigest=probeEchoInvocationDigest(nativeProbeHistoryEchoInvocation(record));
    let records=[record],deny=false,rebound=false;
    const auth:any={async scope(actual:any,...args:any[]){assert.equal(actual,tx);trace.push(['scope',...args]);}};
    const access:any={async forward(actual:any,...args:any[]){assert.equal(actual,tx);trace.push(['access',...args]);},async principal(actual:any){assert.equal(actual,tx);return principal;}};
    const store:any={async history(actual:any,_scope:string,p:any,q:any){assert.equal(actual,tx);assert.equal(p,principal);assert.equal(q.limit,25);trace.push(['history']);return records;}};
    const plans:any={async authorize(actual:any,actor:string){assert.equal(actual,tx);assert.equal(actor,'issuer');trace.push(['planner']);
        if(deny)throw new ControlError('AUTHORIZATION_DENIED',403,'grant withdrawn');
        return {kind:'tcp-path-echo',measurement:'tcp-path-echo-v1',binding:{...record.binding,bindingFence:rebound?2:1},serviceContext:context};}};
    const reader=new ProbePathObservations(auth,access,store,plans);
    return {tx,reader,record,trace,read:()=>reader.readIn(tx,'observer','scope','forward','tcp-path-echo-v1',at,120),
        records:(values:any[])=>{records=values;},deny:()=>{deny=true;},rebound:()=>{rebound=true;}};
}
test('P4 path sample reader uses original principal and issuer in the supplied transaction without writes or nested transactions',async()=>{
    const f=historyFixture(),value=await f.read();assert.equal(value?.status,'unverified');assert.equal(value?.probeId,'probe');
    assert.deepEqual(f.trace.map(item=>item[0]),['scope','access','history','planner']);
    f.deny();assert.equal(await f.read(),null);
    const changed=historyFixture();changed.rebound();assert.equal(await changed.read(),null);
    const latest=historyFixture(),newer={...latest.record,probeId:'newer',issuedAt:at-900,result:null};
    newer.echoChallenge={...newer.echoChallenge,invocationDigest:probeEchoInvocationDigest(nativeProbeHistoryEchoInvocation(newer))};
    latest.records([newer,latest.record]);assert.equal(await latest.read(),null);
    const corrupt=historyFixture();corrupt.record.result.elapsedMs=-1;await assert.rejects(corrupt.read(),{code:'INTEGRITY_FAILURE'});
});
test('P4 Station path bridge reads only the public original sample reader in its caller transaction',async()=>{
    const tx={},bridge=new StationPathFacts({async read(actual:object){assert.equal(actual,tx);return fact(null);}},
        {async readIn(actual,actor,scope,forward,measurement,now,age){assert.equal(actual,tx);assert.deepEqual([actor,scope,forward,measurement,now,age],
            ['owner','scope','forward','tcp-path-echo-v1',at,120]);const {kind:_,...value}=sample();return value;}},()=>at);
    const value=await bridge.read(tx,'scope',config,'owner');assert.equal(value?.kind,'forward');
    assert.equal(value?.kind==='forward'&&value.pathSample?.kind,'path-probe');
    await assert.rejects(bridge.read(tx,'scope',config),{code:'AUTHORIZATION_DENIED'});
});
