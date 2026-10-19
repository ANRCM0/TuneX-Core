import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import type { AuthorizedNodeFacts, RequestIdentity } from '../src/framework/public.ts';
import { ProfileGrantReconciler } from '../src/modules/transport-owner/public.ts';
import { AccessChangeReconciler } from '../src/modules/identity-owner/public.ts';
import { NodeChangeReconciler } from '../src/modules/node-owner/public.ts';
import { ProfileGrantReconciler as oldProfile } from '../src/modules/runtime/profile-grants.ts';
import { AccessChangeReconciler as oldAccess } from '../src/modules/runtime/access-changes.ts';
import { NodeChangeReconciler as oldNode } from '../src/modules/runtime/node-changes.ts';
import { ProfileGrantReconciler as canonicalProfile } from '../src/modules/transport-owner/grant-reconciler.ts';
import { AccessChangeReconciler as canonicalAccess } from '../src/modules/identity-owner/access-reconciler.ts';
import { NodeChangeReconciler as canonicalNode } from '../src/modules/node-owner/change-reconciler.ts';

const request:RequestIdentity={scopeId:'scope-a',actorId:'owner',key:'request',digest:'digest'};
function bindings(value:unknown):Record<string,any>{return value as Record<string,any>;}
function forward(id:string,node='node-a',enabled=true,path?:string[]):Forward{
    return {id,scopeId:'scope-a',revision:3,spec:{enabled,protocols:['tcp'],ingress:{nodeId:node,listen:{address:'127.0.0.1',port:32001}},target:{host:'127.0.0.1',port:80},
        ...(path?{path:{via:path},transport:{profileId:'profile',configRevision:1}}:{})}};
}
function fixture(){
    const tx={marker:Symbol()},calls:unknown[][]=[],effects:string[]=[],failure=new Error('original reconciliation failure');
    const options={fail:'',foreign:false},values=[forward('enabled','node-a',true,['node-middle','node-tail']),forward('disabled','node-b',false)],records=new Map(values.map(value=>[value.id,{...value,deleting:false,recoverySuspended:false}])),authorizers=new Map(values.map(value=>[value.id,'member']));
    const allowed=new Map(values.map(value=>[value.id,true])),until=new Map<string,number|null>([['node-a',0],['node-middle',23],['node-tail',17],['node-b',null]]);
    function called(self:unknown,owner:unknown,name:string,args:unknown[]){assert.equal(self,owner);assert.equal(args[0],tx);calls.push([name,...args]);if(options.fail===name)throw failure;}
    const forwards={async forProfileActor(this:unknown,...args:unknown[]){called(this,forwards,'profileReferences',args);return values;},
        async forActor(this:unknown,...args:unknown[]){called(this,forwards,'actorReferences',args);return values;},
        async record(this:unknown,...args:unknown[]){called(this,forwards,`record:${args[2]}`,args);return records.get(String(args[2]))!;},
        async authorizer(this:unknown,...args:unknown[]){called(this,forwards,`authorizer:${args[1]}`,args);return authorizers.get(String(args[1]))??null;},
        async forReferencedNode(this:unknown,...args:unknown[]){called(this,forwards,'nodeReferences',args);return values;}};
    const execution={async lock(this:unknown,...args:unknown[]){called(this,execution,`lock:${(args[1]as Forward).id}`,args);},
        async allowed(this:unknown,...args:unknown[]){called(this,execution,`allowed:${(args[2]as Forward).id}`,args);return allowed.get((args[2]as Forward).id)??false;},
        async transition(this:unknown,...args:unknown[]){called(this,execution,`transition:${(args[2]as Forward).id}`,args);},
        async accept(this:unknown,...args:unknown[]){const id=(args[1]as Forward).id;called(this,execution,`accept:${id}`,args);assert.equal(args[2],request);effects.push(id);return `operation:${id}`;},
        async assertCapacity(this:unknown,...args:unknown[]){called(this,execution,`capacity:${(args[1]as Forward).id}`,args);},
        async nodeIDs(this:unknown,...args:unknown[]){const value=args[1]as Forward;called(this,execution,`nodes:${value.id}`,args);return [value.spec.ingress.nodeId,...value.spec.path!.via,'node-middle'];},
        async maximumAuthorization(this:unknown,...args:unknown[]){called(this,execution,`until:${args[1]}`,args);return until.get(String(args[1]))??null;},
        async validateNode(this:unknown,...args:unknown[]){called(this,execution,'validateNode',args);},
        async denyIntent(this:unknown,...args:unknown[]){called(this,execution,`deny:${args[1]}`,args);},
        async assertNodeCapacity(this:unknown,...args:unknown[]){called(this,execution,'nodeCapacity',args);}};
    const facts:AuthorizedNodeFacts={nodeId:'node-middle',scopeId:'scope-a',capabilities:[],egressPolicyRevision:1,allowedListenerAddresses:[],allowedPorts:[],allowedDestinationCidrs:[],allowMetadataTargets:false};
    const profile=new ProfileGrantReconciler(forwards,execution),access=new AccessChangeReconciler(forwards,execution),node=new NodeChangeReconciler(forwards,execution);
    const grant={profileId:'profile',actorId:'member',revision:1,allowed:true,changed:true},member={actorId:'member',revision:1,role:'manager',active:true,changed:true},nodeGrant={nodeId:'node-middle',actorId:'member',revision:1,allowed:true,changed:true};
    return {tx,calls,effects,options,failure,values,records,authorizers,allowed,until,forwards,execution,facts,profile,access,node,grant,member,nodeGrant,names:()=>calls.map(row=>row[0]),clear(){calls.length=0;effects.length=0;},
        async transaction(action:()=>Promise<unknown>){const before=[...effects];try{return await action();}catch(error){effects.splice(0,effects.length,...before);throw error;}}};
}

test('116 canonical public legacy reconciliation classes remain exact constructors without clocks defaults or eager provider calls',()=>{
    for(const [actual,old,canonical,names]of [[ProfileGrantReconciler,oldProfile,canonicalProfile,['constructor','reconcile']],
        [AccessChangeReconciler,oldAccess,canonicalAccess,['constructor','checkScope','cutoff','member','nodeGrant']],
        [NodeChangeReconciler,oldNode,canonicalNode,['constructor','reconcile']]]as const){assert.equal(actual,old);assert.equal(actual,canonical);assert.equal(actual.length,2);assert.deepEqual(Object.getOwnPropertyNames(actual.prototype),names);}
    const f=fixture();assert.deepEqual(f.calls,[]);for(const owner of [f.profile,f.access,f.node]){assert.equal(bindings(owner).forwards,f.forwards);assert.equal(bindings(owner).execution,f.execution);}
});

test('116 Profile keeps original reference order allowed short circuit enabled transition accept capacity and exact owner receivers',async()=>{
    const f=fixture(),result=await f.profile.reconcile(f.tx,request,f.grant);
    assert.deepEqual(f.names(),['profileReferences','lock:enabled','allowed:enabled','transition:enabled','accept:enabled','capacity:enabled','lock:disabled','allowed:disabled','accept:disabled']);
    assert.deepEqual(result,['operation:enabled','operation:disabled']);assert.deepEqual(f.calls[0],['profileReferences',f.tx,'profile','member']);
    assert.deepEqual(f.calls[3],['transition:enabled',f.tx,'member',f.values[0]]);assert.deepEqual(f.calls[4],['accept:enabled',f.tx,f.values[0],request,'policy']);
    const denied=fixture();denied.allowed.set('enabled',false);await denied.profile.reconcile(denied.tx,request,denied.grant);assert.deepEqual(denied.calls[3],['accept:enabled',denied.tx,denied.values[0],request,'revoke']);assert.ok(!denied.names().includes('transition:enabled'));assert.ok(!denied.names().includes('capacity:enabled'));
    const withdrawn=fixture();await withdrawn.profile.reconcile(withdrawn.tx,request,{...withdrawn.grant,allowed:false});assert.deepEqual(withdrawn.names(),['profileReferences','lock:enabled','accept:enabled','lock:disabled','accept:disabled']);assert.equal(withdrawn.calls[2]![4],'revoke');
    const foreign=fixture();foreign.values[0]={...foreign.values[0]!,scopeId:'other'};await assert.rejects(foreign.profile.reconcile(foreign.tx,request,foreign.grant),{code:'INTEGRITY_FAILURE',message:'Profile reference belongs to another scope'});assert.deepEqual(foreign.names(),['profileReferences']);
});

test('116 member lock reread uses latest Forward skips deleting or reassigned state and keeps disabled allowed capacity plus exact cutoff iteration',async()=>{
    const f=fixture(),latest={...f.records.get('enabled')!,revision:9};f.records.set('enabled',latest);
    const result=await f.access.member(f.tx,request,f.member);
    assert.deepEqual(f.names(),['actorReferences','lock:enabled','record:enabled','authorizer:enabled','allowed:enabled','transition:enabled','accept:enabled','capacity:enabled','nodes:enabled','until:node-a','until:node-middle','until:node-tail','until:node-middle',
        'lock:disabled','record:disabled','authorizer:disabled','allowed:disabled','accept:disabled','capacity:disabled','until:node-b']);
    assert.deepEqual(result,{operationIds:['operation:enabled','operation:disabled'],maximumAuthorization:23});assert.deepEqual(f.calls[0],['actorReferences',f.tx,'scope-a','member']);assert.deepEqual(f.calls[2],['record:enabled',f.tx,'scope-a','enabled']);assert.equal(f.calls[6]![2],latest);
    const skipped=fixture();skipped.records.get('enabled')!.deleting=true;skipped.authorizers.set('disabled','other');assert.deepEqual(await skipped.access.member(skipped.tx,request,skipped.member),{operationIds:[],maximumAuthorization:null});assert.deepEqual(skipped.names(),['actorReferences','lock:enabled','record:enabled','lock:disabled','record:disabled','authorizer:disabled']);
    const unchanged=fixture();assert.deepEqual(await unchanged.access.member(unchanged.tx,request,{...unchanged.member,changed:false}),{operationIds:[],maximumAuthorization:null});assert.deepEqual(unchanged.calls,[]);
    const viewer=fixture();viewer.values.length=1;await viewer.access.member(viewer.tx,request,{...viewer.member,role:'viewer'});assert.ok(!viewer.names().some(name=>String(name).startsWith('allowed:')||String(name).startsWith('transition:')||String(name).startsWith('capacity:')));assert.equal(viewer.calls[4]![4],'revoke');
    const zero=fixture();zero.values.splice(0,1);zero.until.set('node-b',0);assert.equal((await zero.access.member(zero.tx,request,zero.member)).maximumAuthorization,0);
});

test('116 member rejects candidate Scope before lock and latest reread Scope before authorizer while every provider error stops and rolls back supplied transaction',async()=>{
    const early=fixture();early.values[0]={...early.values[0]!,scopeId:'other'};await assert.rejects(early.access.member(early.tx,request,early.member),{code:'INTEGRITY_FAILURE',message:'Actor reference belongs to another scope'});assert.deepEqual(early.names(),['actorReferences']);
    const latest=fixture();latest.records.get('enabled')!.scopeId='other';await assert.rejects(latest.access.member(latest.tx,request,latest.member),{code:'INTEGRITY_FAILURE',message:'Actor reference belongs to another scope'});assert.deepEqual(latest.names(),['actorReferences','lock:enabled','record:enabled']);
    const baseline=fixture();await baseline.access.member(baseline.tx,request,baseline.member);const names=baseline.names()as string[];
    for(const stage of [...new Set(names)]){const f=fixture();f.options.fail=stage;await assert.rejects(f.transaction(()=>f.access.member(f.tx,request,f.member)),error=>error===f.failure);assert.deepEqual(f.names(),names.slice(0,names.indexOf(stage)+1));assert.deepEqual(f.effects,[]);}
});

test('116 Node Grant filters unrelated paths preserves reference and affected-Node insertion order unconditional validation no-op and nullable maximum',async()=>{
    const f=fixture();f.values.push(forward('unrelated','node-unrelated'));f.values[1]=forward('disabled','node-middle',false);
    const result=await f.access.nodeGrant(f.tx,request,f.nodeGrant);assert.deepEqual(result,{operationIds:['operation:enabled','operation:disabled'],maximumAuthorization:23});
    assert.deepEqual(f.names(),['actorReferences','lock:enabled','nodes:enabled','transition:enabled','accept:enabled','capacity:enabled','lock:disabled','accept:disabled','validateNode','until:node-middle','until:node-a','until:node-tail']);
    assert.deepEqual(f.calls[8],['validateNode',f.tx,'node-middle','scope-a',true]);assert.deepEqual(f.calls[4],['accept:enabled',f.tx,f.values[0],request,'policy']);
    const noOp=fixture();assert.deepEqual(await noOp.access.nodeGrant(noOp.tx,request,{...noOp.nodeGrant,changed:false}),{operationIds:[],maximumAuthorization:23});assert.deepEqual(noOp.calls,[['validateNode',noOp.tx,'node-middle','scope-a',true],['until:node-middle',noOp.tx,'node-middle']]);
    const withdrawn=fixture();withdrawn.until.clear();await withdrawn.access.nodeGrant(withdrawn.tx,request,{...withdrawn.nodeGrant,allowed:false});assert.deepEqual(withdrawn.names(),['actorReferences','lock:enabled','nodes:enabled','accept:enabled','validateNode','until:node-middle','until:node-a','until:node-tail']);assert.equal(withdrawn.calls[3]![4],'revoke');assert.equal(withdrawn.calls[4]![4],false);
    const foreign=fixture();foreign.values.push({...forward('unrelated','other'),scopeId:'foreign'});await assert.rejects(foreign.access.nodeGrant(foreign.tx,request,foreign.nodeGrant),{code:'INTEGRITY_FAILURE'});assert.ok(!foreign.names().includes('validateNode'));
});

test('116 Node facts refuse before references then policy uses original source actor and deny after accept with whole-Node capacity before cutoff',async()=>{
    for(const facts of [{...fixture().facts,nodeId:'other'},{...fixture().facts,scopeId:'other'}]){const f=fixture();await assert.rejects(f.node.reconcile(f.tx,request,{nodeId:'node-middle',kind:'policy',facts}),{code:'INTEGRITY_FAILURE',message:'Node management facts differ from their owner context'});assert.deepEqual(f.calls,[]);}
    const f=fixture();f.authorizers.set('disabled','source-disabled');f.allowed.set('disabled',false);const result=await f.node.reconcile(f.tx,request,{nodeId:'node-middle',kind:'policy',facts:f.facts});
    assert.deepEqual(result,{operationIds:['operation:enabled','operation:disabled'],maximumAuthorization:23});
    assert.deepEqual(f.names(),['nodeReferences','lock:enabled','nodes:enabled','authorizer:enabled','allowed:enabled','transition:enabled','accept:enabled','capacity:enabled','lock:disabled','authorizer:disabled','allowed:disabled','accept:disabled','deny:operation:disabled','nodeCapacity','until:node-middle','until:node-a','until:node-tail']);
    assert.deepEqual(f.calls[0],['nodeReferences',f.tx,'node-middle']);assert.deepEqual(f.calls[4],['allowed:enabled',f.tx,'member',f.values[0]]);assert.deepEqual(f.calls[10],['allowed:disabled',f.tx,'source-disabled',f.values[1]]);assert.deepEqual(f.calls[12],['deny:operation:disabled',f.tx,'operation:disabled']);assert.deepEqual(f.calls[13],['nodeCapacity',f.tx,f.facts]);
    const disabled=fixture();disabled.values.splice(0,1);await disabled.node.reconcile(disabled.tx,request,{nodeId:'node-middle',kind:'policy',facts:disabled.facts});assert.deepEqual(disabled.names(),['nodeReferences','lock:disabled','authorizer:disabled','allowed:disabled','accept:disabled','nodeCapacity','until:node-middle']);
    const absent=fixture();absent.authorizers.clear();await absent.node.reconcile(absent.tx,request,{nodeId:'node-middle',kind:'policy',facts:absent.facts});assert.ok(!absent.names().some(name=>String(name).startsWith('allowed:')));assert.ok(absent.names().includes('deny:operation:enabled'));
});

test('116 whole-Node revocation never calls allowed transition per-Forward capacity denial or whole-Node capacity and retains exact authorizer cutoff result order',async()=>{
    const f=fixture();const result=await f.node.reconcile(f.tx,request,{nodeId:'node-middle',kind:'revoke',facts:f.facts});
    assert.deepEqual(result,{operationIds:['operation:enabled','operation:disabled'],maximumAuthorization:23});
    assert.deepEqual(f.names(),['nodeReferences','lock:enabled','nodes:enabled','authorizer:enabled','accept:enabled','lock:disabled','authorizer:disabled','accept:disabled','until:node-middle','until:node-a','until:node-tail']);
    assert.deepEqual(f.calls[4],['accept:enabled',f.tx,f.values[0],request,'revoke']);assert.deepEqual(f.calls[7],['accept:disabled',f.tx,f.values[1],request,'revoke']);
    const foreign=fixture();foreign.values[0]={...foreign.values[0]!,scopeId:'other'};await assert.rejects(foreign.node.reconcile(foreign.tx,request,{nodeId:'node-middle',kind:'revoke',facts:foreign.facts}),{code:'INTEGRITY_FAILURE',message:'Node reference belongs to another scope'});assert.deepEqual(foreign.names(),['nodeReferences']);
});

test('116 Profile Grant and Node policy and revocation propagate every callback failure and retain rollback in the original caller transaction',async()=>{
    const operations={profile:(f:ReturnType<typeof fixture>)=>f.profile.reconcile(f.tx,request,f.grant),
        nodeGrant:(f:ReturnType<typeof fixture>)=>f.access.nodeGrant(f.tx,request,f.nodeGrant),
        nodePolicy:(f:ReturnType<typeof fixture>)=>{f.allowed.set('disabled',false);return f.node.reconcile(f.tx,request,{nodeId:'node-middle',kind:'policy',facts:f.facts});},
        nodeRevoke:(f:ReturnType<typeof fixture>)=>f.node.reconcile(f.tx,request,{nodeId:'node-middle',kind:'revoke',facts:f.facts})};
    for(const action of Object.values(operations)){const baseline=fixture();await action(baseline);const names=baseline.names()as string[];
        for(const stage of [...new Set(names)]){const f=fixture();f.options.fail=stage;await assert.rejects(f.transaction(()=>action(f)),error=>error===f.failure);assert.deepEqual(f.names(),names.slice(0,names.indexOf(stage)+1));assert.deepEqual(f.effects,[]);}
    }
});
