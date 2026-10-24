import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ResourceUsage } from '../src/modules/resource-limit-owner/public.ts';
import type { ResourceUsageInput } from '../src/modules/resource-limit-owner/public.ts';
import type { ResourceUsageStore, ResourceUsageSample, ResourceUsageReceipt, SharedResourceLimitRecord } from '../src/framework/public.ts';

function fixture() {
    let now=1000,epoch=1,sequence=1,failure=false,credential=true;
    const policy:SharedResourceLimitRecord={bucketId:'bucket',scopeId:'scope',nodeId:'node',actorId:'actor',revision:1,
        startsAt:0,endsAt:2000,byteLimit:100,bytesPerSecond:null,burstBytes:64};
    let samples=new Map<string,ResourceUsageSample>(),head:ResourceUsageReceipt|undefined;
    const tx={id:'original'};
    const store:ResourceUsageStore<typeof tx>={
        async lockReport(input,node){assert.equal(input,tx);assert.equal(node,'node');return {bootId:'boot',sessionEpoch:epoch,reportSequence:sequence,snapshotGeneration:2,receivedAt:now};},
        async lockHead(){return head;},async policy(){return policy;},async sample(_tx,bucket){return samples.get(bucket);},async session(){return epoch;},
        async save(input,sample){assert.equal(input,tx);samples.set(sample.bucketId,{...sample});},
        async receipt(_tx,_node,value){head=value;if(failure)throw Error('receipt failed');},
    };
    const service=new ResourceUsage({store,db:{async transaction(action){const old=new Map(samples),receipt=head;
        try{return await action(tx);}catch(error){samples=old;head=receipt;throw error;}}},
        nodes:{async credential(){return credential?{valid_until:10000,retire_after:null}:undefined;}},
        now:()=>now,freshnessMs:100,codec:{digest:JSON.stringify,parseTime:Date.parse,formatTime:at=>new Date(at).toISOString()}});
    const input=(consumedBytes='20'):ResourceUsageInput=>({version:1,nodeId:'node',bootId:'boot',sessionEpoch:epoch,
        reportSequence:sequence,snapshotGeneration:2,buckets:[{bucketId:'bucket',scopeId:'scope',actorId:'actor',revision:policy.revision,
            startsAt:new Date(0).toISOString(),endsAt:new Date(2000).toISOString(),consumedBytes}]});
    return {service,input,policy,tx,store,setNow:(value:number)=>{now=value;},next:()=>{sequence++;},
        reboot:()=>{epoch++;sequence=1;},fail:()=>{failure=true;},revoke:()=>{credential=false;}};
}
const code=(expected:string)=>(error:unknown)=>(error as {code?:string})?.code===expected;

test('P3 usage binds accepted report, keeps original transaction and handles identical replay',async()=>{
    const f=fixture(),input=f.input();
    assert.equal((await f.service.handle('node','fingerprint',1,input)).status,'accepted');
    assert.equal((await f.service.handle('node','fingerprint',1,input)).status,'duplicate');
    await assert.rejects(f.service.handle('node','fingerprint',1,f.input('21')),code('INTEGRITY_FAILURE'));
    assert.equal((await f.service.consumption(f.tx,f.policy)).remainingBytes,'80');
});
test('P3 no sample, stale sample, new session and changed policy never invent a current balance',async()=>{
    const f=fixture();assert.equal((await f.service.consumption(f.tx,f.policy)).status,'unknown');
    await f.service.handle('node','fingerprint',1,f.input());f.setNow(1101);
    let view=await f.service.consumption(f.tx,f.policy);assert.equal(view.status,'stale');assert.equal(view.remainingBytes,null);
    f.setNow(1000);f.reboot();view=await f.service.consumption(f.tx,f.policy);assert.equal(view.status,'stale');
    f.policy.revision++;view=await f.service.consumption(f.tx,f.policy);assert.equal(view.status,'policy-outdated');assert.equal(view.usedBytes,'20');
});
test('P3 counter rollback across sessions and revision rollback refuse without changing the last observation',async()=>{
    const f=fixture();await f.service.handle('node','fingerprint',1,f.input('90'));f.reboot();
    await assert.rejects(f.service.handle('node','fingerprint',2,f.input('10')),code('INTEGRITY_FAILURE'));
    assert.equal((await f.service.consumption(f.tx,f.policy)).usedBytes,'90');
    f.policy.revision=2;await f.service.handle('node','fingerprint',2,f.input('95'));f.next();
    const old=f.input('99');old.buckets[0]!.revision=1;
    await assert.rejects(f.service.handle('node','fingerprint',2,old),code('INTEGRITY_FAILURE'));
});
test('P3 closed decimal bounds, foreign bucket owner and unaccepted report refuse before projection',async()=>{
    for(const mutate of [(input:any)=>{input.extra=true;},(input:any)=>{input.buckets[0].consumedBytes='01';},
        (input:any)=>{input.buckets[0].consumedBytes='9007199254740992';},(input:any)=>{input.buckets[0].actorId='other';},
        (input:any)=>{input.reportSequence=2;},(input:any)=>{input.buckets.push({...input.buckets[0]});}]){
        const f=fixture(),input=f.input();mutate(input);await assert.rejects(f.service.handle('node','fingerprint',1,input));
        assert.equal((await f.service.consumption(f.tx,f.policy)).usedBytes,null);
    }
    const f=fixture();f.revoke();await assert.rejects(f.service.handle('node','fingerprint',1,f.input()),code('AUTHORIZATION_DENIED'));
});
test('P3 receipt failure rolls all projection rows back and over-limit use stays exhausted',async()=>{
    const f=fixture();await f.service.handle('node','fingerprint',1,f.input('100'));f.next();f.fail();
    await assert.rejects(f.service.handle('node','fingerprint',1,f.input('110')),/receipt failed/);
    assert.equal((await f.service.consumption(f.tx,f.policy)).usedBytes,'100');
    f.policy.byteLimit=50;assert.equal((await f.service.consumption(f.tx,f.policy)).remainingBytes,'0');
});
