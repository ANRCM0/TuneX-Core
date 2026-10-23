import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RuntimeAssignmentValue } from '@tunex/contracts/execution-values';
import type { NodeAuthorityStore, NodeResourceAccess } from '../src/framework/node-authority-ports.ts';
import type { SharedResourceLimitRecord, SharedResourceLimitStore } from '../src/framework/resource-limit-ports.ts';
import { SharedResourceLimits, SharedResourceLimitPublicationPolicy } from '../src/modules/resource-limit-owner/public.ts';
import type { SharedResourceLimitInput } from '../src/modules/resource-limit-owner/public.ts';

type Tx={original:true};
const first='2026-10-01T00:00:00.000Z',last='2026-11-01T00:00:00.000Z';
const input=(expectedRevision=0):SharedResourceLimitInput=>({expectedRevision,startsAt:first,endsAt:last,bytesPerSecond:1024,burstBytes:2048,byteLimit:10000});
const assignment=(id:string,forwardId='forward'):RuntimeAssignmentValue=>({assignmentId:id,forwardId,forwardRevision:1,deploymentGeneration:1,bindingFence:1,
    role:'multihop-transit',protocol:'tcp',phase:'active',resource:{address:'127.0.0.1',port:24001,protocol:'tcp'},driver:{id:'native',configDigest:'digest'},drainTimeoutSeconds:1});

function fixture(){
    const tx:Tx={original:true},events:string[]=[],records=new Map<string,SharedResourceLimitRecord>();
    let current:SharedResourceLimitRecord|undefined,id=0;
    const receipts=new Map<string,{requestDigest:string;response:unknown}>();
    const state={source:'admin-shared' as NodeResourceAccess['resource_source'],owner:null as string|null,grant:true,active:true};
    const same=(value:Tx)=>assert.equal(value,tx);
    const nodes={async resourceAccess(value:Tx,nodeId:string,scopeId:string,actor:string){same(value);return {id:nodeId,scope_id:scopeId,
        resource_source:state.source,owner_actor_id:state.owner,resource_revision:1,grant_actor_id:state.grant?actor:null,allowed_roles:null,port_limits:null};}} as unknown as NodeAuthorityStore<Tx>;
    const store:SharedResourceLimitStore<Tx>={
        async lock(value){same(value);events.push('head');},
        async current(value,node,actor){same(value);return current?.nodeId===node&&current.actorId===actor?current:undefined;},
        async history(value,node,actor){same(value);events.push(`history:${actor}`);return [...records.values()].filter(record=>record.nodeId===node&&record.actorId===actor);},
        async save(value,record,expected){same(value);if((current?.revision??0)!==expected)return false;current={...record};records.set(record.bucketId,{...record});events.push('save');return true;},
        async replay(value,scope,actor,request){same(value);return receipts.get(`${scope}/${actor}/${request}`);},
        async receipt(value,scope,actor,request,requestDigest,response){same(value);receipts.set(`${scope}/${actor}/${request}`,{requestDigest,response});events.push('receipt');},
        async audit(value){same(value);events.push('audit');},
    };
    const identity={async owner(value:Tx,actor:string){same(value);events.push('owner');if(actor!=='admin')throw new Error('governance required');},
        async scope(value:Tx,actor:string){same(value);events.push(`member:${actor}`);if(!state.active)throw new Error('inactive member');}};
    const options={db:{async transaction<T>(action:(value:Tx)=>Promise<T>){return action(tx);}},identity,nodes,
        runtime:{async lockNode(value:Tx){same(value);events.push('runtime');},async initializeNode(){},async maximumAuthorization(){return null;}},
        owners:{async forwardPortOwner(value:Tx,id:string){same(value);return {scopeId:'scope',ownerActorId:id==='other-forward'?'other':'member'};}},store,
        now:()=>Date.parse('2026-10-21T00:00:00.000Z'),codec:{digest:JSON.stringify,formatTime:(at:number)=>new Date(at).toISOString(),parseTime:(value:string)=>Date.parse(value),newID:()=>`bucket-${++id}`}};
    return {tx,events,records,state,store,options,service:new SharedResourceLimits(options),policy:new SharedResourceLimitPublicationPolicy(options)};
}

test('set keeps original transaction, governance/member locks, Runtime-before-head ordering and replay',async()=>{
    const f=fixture(),response=await f.service.set('admin','scope','node','member','request',input());
    assert.deepEqual(f.events,['owner','member:member','runtime','head','history:member','save','audit','receipt']);
    assert.equal(response.policy?.bucketId,'bucket-1');
    assert.equal(response.consumption.status,'unavailable');
    assert.equal(response.consumption.usedBytes,null);
    assert.equal(response.consumption.remainingBytes,null);
    assert.deepEqual(await f.service.set('admin','scope','node','member','request',input()),response);
    assert.equal(f.events.filter(event=>event==='save').length,1);
    await assert.rejects(f.service.set('admin','scope','node','member','request',{...input(),byteLimit:20}),/different payload/);
    await assert.rejects(f.service.set('admin','scope','node','member','stale',input()),/revision changed/);
});

test('same period retains protected bucket; adjacent new period preserves history and overlap refuses',async()=>{
    const f=fixture(),a=await f.service.set('admin','scope','node','member','r1',input());
    const b=await f.service.set('admin','scope','node','member','r2',{...input(1),bytesPerSecond:400});
    assert.equal(a.policy?.bucketId,b.policy?.bucketId);
    const c=await f.service.set('admin','scope','node','member','r3',{...input(2),startsAt:last,endsAt:'2026-12-01T00:00:00.000Z'});
    assert.notEqual(c.policy?.bucketId,b.policy?.bucketId);
    assert.equal(f.records.size,2);
    await assert.rejects(f.service.set('admin','scope','node','member','overlap',{...input(3),startsAt:'2026-10-15T00:00:00.000Z',endsAt:'2026-12-15T00:00:00.000Z'}),/overlap/);
});

test('scope owner, active subject and real shared grant are mandatory; personal reads cannot inspect others',async()=>{
    const f=fixture();
    await assert.rejects(f.service.set('member','scope','node','member','r1',input()),/governance/);
    f.state.active=false;
    await assert.rejects(f.service.set('admin','scope','node','member','r1',input()),/inactive/);
    f.state.active=true;f.state.grant=false;
    await assert.rejects(f.service.set('admin','scope','node','member','r1',input()),/grant/);
    await assert.rejects(f.service.get('member','scope','node','member'),/grant|governance/);
    await assert.rejects(f.service.get('member','scope','node','other'),/governance/);
    assert.equal((await f.service.get('admin','scope','node','member')).policy,null);
    assert.equal((await f.service.get('admin','scope','node','admin')).policy,null);
    f.state.grant=true;f.state.source='private';f.state.owner='member';
    await assert.rejects(f.service.set('admin','scope','node','member','r1',input()),/governance/);
    assert.equal(f.records.size,0);
});

test('invalid limits, missing limits, ambiguous time and unknown input fields refuse before mutation',async()=>{
    const f=fixture();
    for(const value of [{...input(),bytesPerSecond:null,byteLimit:null},{...input(),bytesPerSecond:-1},{...input(),byteLimit:0.5},
        {...input(),burstBytes:65537},{...input(),burstBytes:0},{...input(),byteLimit:Number.MAX_SAFE_INTEGER+1},
        {...input(),startsAt:'2026-10-01T00:00:00Z'},{...input(),startsAt:'2026-10-01T01:00:00.000+01:00'},
        {...input(),endsAt:first},{...input(),extra:true}])
        await assert.rejects(f.service.set('admin','scope','node','member','r',value));
    assert.equal(f.records.size,0);
});

test('publication aggregates sorted assignments by immutable owner and excludes configured unsupported/period/zero',async()=>{
    const f=fixture();
    await f.service.set('admin','scope','node','member','r1',input());
    const at=f.options.now(),assignments=[assignment('z'),{...assignment('a'),protocol:'udp' as const},assignment('b','other-forward')];
    const result=await f.policy.limits(f.tx,'node',['shared-resource-limits.v1'],assignments,at);
    assert.deepEqual(result.excludedAssignmentIds,[]);
    assert.deepEqual(result.resourceLimits?.buckets[0]?.assignmentIds,['a','z']);
    assert.equal(result.resourceLimits?.buckets[0]?.actorId,'member');
    for(const [caps,time] of [[[],at],[['shared-resource-limits.v1'],Date.parse(first)-1],[['shared-resource-limits.v1'],Date.parse(last)]] as const){
        const blocked=await f.policy.limits(f.tx,'node',caps,[assignment('a')],time);
        assert.deepEqual(blocked.excludedAssignmentIds,['a']);
        assert.equal(blocked.resourceLimits,undefined);
    }
    await f.service.set('admin','scope','node','member','r2',{...input(1),bytesPerSecond:0});
    assert.deepEqual((await f.policy.limits(f.tx,'node',['shared-resource-limits.v1'],[assignment('a')],at)).excludedAssignmentIds,['a']);
});

test('private owner remains exempt, unconfigured shared is unlimited, absent real grant excludes',async()=>{
    const f=fixture(),at=f.options.now();
    assert.deepEqual(await f.policy.limits(f.tx,'node',[],[assignment('a')],at),{excludedAssignmentIds:[]});
    f.state.grant=false;
    assert.deepEqual((await f.policy.limits(f.tx,'node',[],[assignment('a')],at)).excludedAssignmentIds,['a']);
    f.state.source='private';f.state.owner='member';
    assert.deepEqual(await f.policy.limits(f.tx,'node',[],[assignment('a')],at),{excludedAssignmentIds:[]});
    f.state.owner='another';
    assert.deepEqual((await f.policy.limits(f.tx,'node',[],[assignment('a')],at)).excludedAssignmentIds,['a']);
});

test('a scheduled next period preserves the active old bucket and changes at the explicit boundary',async()=>{
    const f=fixture();
    const october=await f.service.set('admin','scope','node','member','r1',input());
    const november=await f.service.set('admin','scope','node','member','r2',{
        ...input(1),startsAt:last,endsAt:'2026-12-01T00:00:00.000Z',bytesPerSecond:512,byteLimit:20000});
    assert.notEqual(october.policy?.bucketId,november.policy?.bucketId);
    assert.equal((await f.service.get('member','scope','node','member')).policy?.bucketId,november.policy?.bucketId);
    f.events.length=0;
    const before=await f.policy.limits(f.tx,'node',['shared-resource-limits.v1'],[assignment('b'),assignment('a')],Date.parse(last)-1);
    assert.equal(before.resourceLimits?.buckets[0]?.bucketId,october.policy?.bucketId);
    assert.equal(before.resourceLimits?.buckets[0]?.revision,1);
    assert.deepEqual(before.resourceLimits?.buckets[0]?.assignmentIds,['a','b']);
    assert.equal(f.events.filter(event=>event==='history:member').length,1);
    const boundary=await f.policy.limits(f.tx,'node',['shared-resource-limits.v1'],[assignment('a')],Date.parse(last));
    assert.equal(boundary.resourceLimits?.buckets[0]?.bucketId,november.policy?.bucketId);
    assert.equal(boundary.resourceLimits?.buckets[0]?.revision,2);
    const gap=await f.policy.limits(f.tx,'node',['shared-resource-limits.v1'],[assignment('a')],Date.parse('2026-12-01T00:00:00.000Z'));
    assert.deepEqual(gap.excludedAssignmentIds,['a']);
    assert.equal(gap.resourceLimits,undefined);
});

test('publication refuses overlapping or mismatched protected history instead of choosing a window',async()=>{
    const f=fixture();
    await f.service.set('admin','scope','node','member','r1',input());
    const initial=[...f.records.values()][0]!;
    f.records.set('overlap',{...initial,bucketId:'overlap',startsAt:initial.startsAt+1});
    await assert.rejects(f.policy.limits(f.tx,'node',['shared-resource-limits.v1'],[assignment('a')],f.options.now()),/ownership or history/);
    f.records.delete('overlap');
    f.records.set(initial.bucketId,{...initial,scopeId:'another-scope'});
    await assert.rejects(f.policy.limits(f.tx,'node',['shared-resource-limits.v1'],[assignment('a')],f.options.now()),/ownership or history/);
});

test('a control-only bucket updates old drains after active assignments disappear without granting new work',async()=>{
    const f=fixture();
    await f.service.set('admin','scope','node','member','initial',input());
    const initial=await f.policy.limits(f.tx,'node',['shared-resource-limits.v1'],[assignment('a')],f.options.now());
    const previous=initial.resourceLimits!.buckets;
    await f.service.set('admin','scope','node','member','deny',{...input(1),bytesPerSecond:0});
    const restricted=await f.policy.limits(f.tx,'node',['shared-resource-limits.v1'],[],f.options.now(),previous);
    assert.deepEqual(restricted.excludedAssignmentIds,[]);
    assert.deepEqual(restricted.resourceLimits!.buckets[0]!.assignmentIds,[]);
    assert.equal(restricted.resourceLimits!.buckets[0]!.bucketId,previous[0]!.bucketId);
    assert.equal(restricted.resourceLimits!.buckets[0]!.revision,2);
    assert.equal(restricted.resourceLimits!.buckets[0]!.bytesPerSecond,0);
    const expired=await f.policy.limits(f.tx,'node',['shared-resource-limits.v1'],[],Date.parse(last),previous);
    assert.equal(expired.resourceLimits,undefined);
});
