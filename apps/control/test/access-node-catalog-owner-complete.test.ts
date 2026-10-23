import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { digest } from '@tunex/contracts/shared';
import { NATIVE_DRIVER_CATALOG as OriginalCatalog, NATIVE_DRIVER_CATALOG_DIGEST as OriginalDigest } from '@tunex/contracts/runtime';
import * as Identity from '../src/modules/identity-owner/public.ts';
import * as Node from '../src/modules/node-owner/public.ts';
import * as Catalog from '../src/modules/native-driver-owner/public.ts';
import * as LegacyAccess from '../src/application/access-commands.ts';
import * as LegacyAccessApi from '../src/application/access-command-contract.ts';
import * as LegacyNode from '../src/application/node-management.ts';
import * as LegacyCatalog from '../src/application/native-drivers.ts';
import * as LegacyCatalogApi from '../src/application/native-driver-contract.ts';
import { nativeIdentityTokenHash, nativeCommandRequest, nativeIsoTime, NATIVE_DRIVER_CATALOG, NATIVE_DRIVER_CATALOG_DIGEST } from '../src/compatibility/public.ts';
import { tokenHash } from '../src/infrastructure/identity-secrets.ts';
import type { AuthorizedNodeFacts, CommandResponse, IdempotentRequests, RequestIdentity, ScopeOwnerAuthorization, ScopeAuthorization, TransactionBoundary } from '../src/framework/public.ts';

type Equal<A,B>=(<T>()=>T extends A?1:2)extends(<T>()=>T extends B?1:2)?true:false;
type Same<T extends true>=T;
type Tx={readonly original:symbol};
export type AccessNodeCatalogOriginalDeclarations=[
    Same<Equal<typeof Identity.AccessCommands,typeof LegacyAccess.AccessCommands>>,
    Same<Equal<typeof Node.NodeManagementCommands,typeof LegacyNode.NodeManagementCommands>>,
    Same<Equal<typeof Catalog.NativeDrivers,typeof LegacyCatalog.NativeDrivers>>,
    Same<Equal<Identity.AccessCommandApi,LegacyAccessApi.AccessCommandApi>>,
    Same<Equal<Catalog.NativeDriverApi,LegacyCatalogApi.NativeDriverApi>>,
    Same<Equal<Pick<Identity.AccessCommands<Tx>,'changeMember'|'changeNodeGrant'>,Identity.AccessCommandApi>>,
    Same<Equal<Pick<Node.NodeManagementCommands<Tx>,'change'>,Node.NodeManagementApi>>,
    Same<Equal<ConstructorParameters<typeof Identity.AccessCommands<Tx>>,[TransactionBoundary<Tx>,ScopeOwnerAuthorization<Tx>&Identity.MemberWriter<Tx>,Node.NodeGrantWriter<Tx>,IdempotentRequests<Tx>,Identity.AccessChangeEffects<Tx>]>>,
    Same<Equal<ConstructorParameters<typeof Node.NodeManagementCommands<Tx>>,[TransactionBoundary<Tx>,ScopeAuthorization<Tx>,IdempotentRequests<Tx>,Node.NodeManagementWriter<Tx>,Node.NodeManagementEffects<Tx>]>>,
];

function fixture(){
    const tx:Tx={original:Symbol('one original transaction')},events:string[]=[],calls:unknown[][]=[],error=new Error('original effect error');
    const input={role:'viewer' as const,expectedRevision:0},grant={nodeId:'node-a',actorId:'subject-a',revision:4,allowed:false,allowedRoles:null,portLimits:null,changed:true};
    const member={actorId:'subject-a',revision:3,role:'viewer',active:true,changed:true};
    const facts:AuthorizedNodeFacts={nodeId:'node-a',scopeId:'scope-a',capabilities:['adp.3','native.direct.v1','tcp'],allowedPorts:[32001],allowedListenerAddresses:['127.0.0.1'],allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false,egressPolicyRevision:7};
    const change:Node.NodeManagementChange={nodeId:'node-a',kind:'revoke',facts},result:Identity.AccessExecutionResult={operationIds:['operation-a'],maximumAuthorization:10000};
    const mutable={failure:'',replay:undefined as CommandResponse|undefined,onAuthorize:()=>{},writes:0,responses:0,audits:[] as unknown[][]};
    const record=(event:string,current:Tx,...args:unknown[])=>{assert.equal(current,tx);events.push(event);calls.push([event,...args]);if(mutable.failure===event)throw error;};
    const db:TransactionBoundary<Tx>={async transaction<T>(action:(tx:Tx)=>Promise<T>){assert.equal(this,db);events.push('begin');const before={writes:mutable.writes,responses:mutable.responses,audits:[...mutable.audits]};try{const value=await action(tx);events.push('commit');return value;}catch(failure){Object.assign(mutable,before);events.push('rollback');throw failure;}}};
    const identity:ScopeOwnerAuthorization<Tx>&ScopeAuthorization<Tx>&Identity.MemberWriter<Tx>={
        async owner(current,...args){assert.equal(this,identity);record('owner',current,...args);mutable.onAuthorize();},
        async scope(current,...args){assert.equal(this,identity);record('scope',current,...args);mutable.onAuthorize();},
        async changeMember(current,...args){assert.equal(this,identity);record('member',current,...args);mutable.writes++;return member;},
    };
    const idempotency:IdempotentRequests<Tx>={async claim<R extends CommandResponse>(current:Tx,request:RequestIdentity){assert.equal(this,idempotency);record('claim',current,request);return mutable.replay as R|undefined;},async respond(current,request,response){assert.equal(this,idempotency);record('respond',current,request,response);mutable.responses++;}};
    const nodes:Node.NodeGrantWriter<Tx>&Node.NodeManagementWriter<Tx>={
        async changeGrant(current,...args){assert.equal(this,nodes);record('grant',current,...args);mutable.writes++;return grant;},
        async applyManagement(current,...args){assert.equal(this,nodes);record('apply',current,...args);mutable.writes++;return change;},
        async audit(current,...args){assert.equal(this,nodes);record('audit',current,...args);mutable.audits.push(args);},
    };
    const effects:Identity.AccessChangeEffects<Tx>&Node.NodeManagementEffects<Tx>={
        async member(current,...args){assert.equal(this,effects);record('member-effects',current,...args);mutable.writes++;return result;},
        async nodeGrant(current,...args){assert.equal(this,effects);record('grant-effects',current,...args);mutable.writes++;return result;},
        async reconcile(current,...args){assert.equal(this,effects);record('reconcile',current,...args);mutable.writes++;return result;},
    };
    const access=new Identity.AccessCommands(db,identity,nodes,idempotency,effects),management=new Node.NodeManagementCommands(db,identity,idempotency,nodes,effects);
    const memberCall=(value:Identity.MemberChangeInput=input)=>access.changeMember('owner-a','scope-a','subject-a','key-a',value);
    const grantCall=()=>access.changeNodeGrant('owner-a','scope-a','node-a','subject-a','key-a',1,false);
    const nodeCall=(value:Node.NodeManagementCommand={kind:'revoke'})=>management.change('manager-a','scope-a','node-a','key-a',value);
    return {tx,events,calls,error,input,member,grant,facts,change,result,mutable,db,identity,nodes,idempotency,effects,access,management,memberCall,grantCall,nodeCall};
}

test('92/93/94 canonical and legacy class/version/constructor/method contracts retain exact public identities and effects getter refusal order',()=>{
    assert.equal(Identity.AccessCommands,LegacyAccess.AccessCommands);assert.equal(Node.NodeManagementCommands,LegacyNode.NodeManagementCommands);assert.equal(Catalog.NativeDrivers,LegacyCatalog.NativeDrivers);
    assert.equal(Identity.ACCESS_COMMAND_INTERFACE_VERSION,3);assert.equal(Node.NODE_MANAGEMENT_INTERFACE_VERSION,2);assert.equal(Catalog.NATIVE_DRIVER_QUERY_INTERFACE_VERSION,1);
    assert.deepEqual([Identity.AccessCommands.length,Node.NodeManagementCommands.length,Catalog.NativeDrivers.length],[5,5,2]);
    for(const [Class,methods] of [[Identity.AccessCommands,['changeMember','changeNodeGrant']],[Node.NodeManagementCommands,['change']],[Catalog.NativeDrivers,['list']]] as const){
        assert.deepEqual(Object.getOwnPropertyNames(Class.prototype),['constructor',...methods]);
        for(const method of methods){const descriptor=Object.getOwnPropertyDescriptor(Class.prototype,method)!;assert.deepEqual([descriptor.enumerable,descriptor.writable,descriptor.configurable],[false,true,true]);assert.equal(descriptor.value.constructor.name,'AsyncFunction');}
    }
    const f=fixture(),events:string[]=[];
    for(const present of [false,true]){events.length=0;const effects={get member(){events.push('member');return present?async()=>f.result:undefined;},get nodeGrant(){events.push('grant');return undefined;}};
        assert.throws(()=>new Identity.AccessCommands(f.db,f.identity,f.nodes,f.idempotency,effects as unknown as Identity.AccessChangeEffects<Tx>),{message:'Member and Node grant execution effects are required'});assert.deepEqual(events,present?['member','grant']:['member']);}
    for(const effects of [undefined,null,{}, {reconcile:1}])assert.throws(()=>new Node.NodeManagementCommands(f.db,f.identity,f.idempotency,f.nodes,effects as unknown as Node.NodeManagementEffects<Tx>),{message:'Whole-Node execution effects are required'});
    assert.equal(f.events.length,0);assert.equal(nativeIdentityTokenHash,tokenHash);assert.equal(NATIVE_DRIVER_CATALOG,OriginalCatalog);assert.equal(NATIVE_DRIVER_CATALOG_DIGEST,OriginalDigest);
});

test('92 member snapshots token omission and exact native hash/request identity before owner authorization while no-change still runs effects',async()=>{
    const token='a'.repeat(32),hash=createHash('sha256').update(token).digest('hex');assert.equal(nativeIdentityTokenHash(token),hash);
    for(const supplied of [false,true])for(const changed of [false,true]){
        const f=fixture(),reads:string[]=[],value={get expectedRevision(){reads.push('revision');return 0;},get role(){reads.push('role');return 'viewer' as const;},get token(){reads.push('token');return supplied?token:undefined;}};
        f.member.changed=changed;const response=await f.memberCall(value as unknown as Identity.MemberChangeInput);assert.deepEqual(reads,supplied?['revision','role','token','token']:['revision','role','token']);
        assert.deepEqual(f.events,['begin','owner','claim','member','member-effects','respond','commit']);assert.equal(response.status,changed?202:200);
        const expected=nativeCommandRequest('owner-a','scope-a','key-a','PUT','/api/v1/scopes/scope-a/members/subject-a',{expectedRevision:0,role:'viewer',tokenHash:supplied?hash:null});
        assert.deepEqual(f.calls.find(call=>call[0]==='claim'),['claim',expected]);assert.equal(expected.digest,digest({method:'PUT',path:'/api/v1/scopes/scope-a/members/subject-a',input:{expectedRevision:0,role:'viewer',tokenHash:supplied?hash:null}}));assert.ok(!JSON.stringify(expected).includes(token));
        assert.deepEqual(f.calls.find(call=>call[0]==='member'),['member','owner-a','scope-a','subject-a',0,'viewer',supplied?token:undefined]);assert.equal(f.calls.find(call=>call[0]==='member-effects')![2],f.member);
        assert.equal(response.body.operationIds,f.result.operationIds);assert.deepEqual(Object.keys(response.body),['actorId','revision','role','active','operationIds','latestAuthorizationUntil']);assert.equal(response.body.latestAuthorizationUntil,new Date(15000).toISOString());
    }
    const f=fixture(),value:{expectedRevision:number;role:'viewer';token:string}={expectedRevision:0,role:'viewer',token};f.mutable.onAuthorize=()=>{value.expectedRevision=99;value.token='b'.repeat(32);};await f.memberCall(value);assert.equal(f.calls.find(call=>call[0]==='member')![4],0);assert.equal(f.calls.find(call=>call[0]==='member')![6],token);
});

test('92/93 exact truthy authorization cutoff projection preserves zero null negative invalid and post-mutation rollback semantics',async()=>{
    for(const call of ['memberCall','grantCall','nodeCall'] as const)for(const maximum of [null,0,-5000,-1,1,NaN,Infinity,-Infinity,8640000000000000]){
        const f=fixture();f.result.maximumAuthorization=maximum;
        if(maximum!==null&&maximum&&(!Number.isFinite(maximum)||maximum+5000>8640000000000000)){
            await assert.rejects(f[call](),RangeError);assert.equal(f.mutable.writes,0);assert.equal(f.mutable.responses,0);assert.deepEqual(f.mutable.audits,[]);assert.equal(f.events.at(-1),'rollback');continue;
        }
        const response=await f[call]();assert.equal(response.body.latestAuthorizationUntil,maximum?new Date(maximum+5000).toISOString():null);assert.equal(response.body.operationIds,f.result.operationIds);
        if(call==='nodeCall')assert.deepEqual(f.mutable.audits,[['node-a','manager-a','node_revocation',{policyRevision:7,operationIds:f.result.operationIds,latestAuthorizationUntil:maximum}]]);
    }
});

test('92 Node grant response uses original command subject and allowed while effects receive exact raw owner grant',async()=>{
    for(const changed of [false,true]){
        const f=fixture();f.grant.changed=changed;f.grant.allowed=true;f.grant.nodeId='provider-node';f.grant.actorId='provider-subject';const response=await f.grantCall();
        assert.deepEqual(f.events,['begin','owner','claim','grant','grant-effects','respond','commit']);assert.deepEqual(f.calls.find(call=>call[0]==='grant'),['grant','owner-a','scope-a','node-a','subject-a',1,false,null,undefined]);assert.equal(f.calls.find(call=>call[0]==='grant-effects')![2],f.grant);
        assert.deepEqual(response,{status:changed?202:200,body:{nodeId:'node-a',actorId:'subject-a',revision:4,allowed:false,allowedRoles:null,portLimits:null,operationIds:['operation-a'],latestAuthorizationUntil:nativeIsoTime(15000)}});
    }
});

test('92/93 replay is gated by current authorization and returns original response identity without writers effects or audit; each later error aborts all owner state',async()=>{
    for(const [call,steps] of [['memberCall',['owner','claim','member','member-effects','respond']],['grantCall',['owner','claim','grant','grant-effects','respond']],['nodeCall',['scope','claim','apply','reconcile','audit','respond']]] as const){
        const f=fixture(),replay:CommandResponse={status:200,body:{replayed:true}};f.mutable.replay=replay;assert.equal(await f[call](),replay);assert.deepEqual(f.events,['begin',steps[0],'claim','commit']);assert.equal(f.mutable.writes,0);
        const ordered:readonly string[]=steps;
        for(const step of steps){const denied=fixture();denied.mutable.failure=step;await assert.rejects(denied[call](),failure=>failure===denied.error);assert.equal(denied.events.at(-1),'rollback');assert.deepEqual([denied.mutable.writes,denied.mutable.responses,denied.mutable.audits],[0,0,[]]);assert.deepEqual(denied.events,['begin',...ordered.slice(0,ordered.indexOf(step)+1),'rollback']);}
    }
});

test('93 Node ID refusal precedes snapshot getters and original policy/revoke request identity audit and receipt retain one detached frozen intent',async()=>{
    const f=fixture(),input={get kind(){assert.fail('invalid Node must refuse before command kind');return 'revoke' as const;}};
    await assert.rejects(f.management.change('manager-a','scope-a','../node','key-a',input),{code:'INVALID_CONFIG',message:'Valid Node ID required'});assert.equal(f.events.length,0);
    const policy={allowedPorts:[32001],allowedListenerAddresses:['127.0.0.1'],allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false,egressPolicyRevision:7};
    const command:Node.NodeManagementCommand={kind:'policy',expectedRevision:1,policy},before=structuredClone(command);f.mutable.onAuthorize=()=>{policy.allowedPorts[0]=1;policy.egressPolicyRevision=99;};
    const response=await f.nodeCall(command);assert.equal(response.status,202);assert.deepEqual(f.events,['begin','scope','claim','apply','reconcile','audit','respond','commit']);assert.deepEqual(f.calls.find(call=>call[0]==='scope'),['scope','manager-a','scope-a',true]);
    const snapshot=f.calls.find(call=>call[0]==='apply')![4] as Node.NodeManagementCommand;assert.deepEqual(snapshot,before);assert.notEqual(snapshot,command);assert.equal(Object.isFrozen(snapshot),true);assert.equal(snapshot.kind,'policy');if(snapshot.kind==='policy'){assert.equal(Object.isFrozen(snapshot.policy.allowedPorts),true);assert.notEqual(snapshot.policy.allowedPorts,policy.allowedPorts);}
    assert.deepEqual(f.calls.find(call=>call[0]==='claim')![1],nativeCommandRequest('manager-a','scope-a','key-a','PUT','/api/v1/scopes/scope-a/nodes/node-a/policy',before));assert.equal(f.calls.find(call=>call[0]==='reconcile')![2],f.change);
    assert.deepEqual(f.mutable.audits,[['node-a','manager-a','policy_update',{policyRevision:7,operationIds:f.result.operationIds,latestAuthorizationUntil:10000}]]);
    const revoked=fixture();await revoked.nodeCall();assert.deepEqual(revoked.calls.find(call=>call[0]==='claim')![1],nativeCommandRequest('manager-a','scope-a','key-a','POST','/api/v1/scopes/scope-a/nodes/node-a/revoke',{kind:'revoke'}));
});

test('94 native catalog keeps every descriptor order shallow spread nested identity process flag defaults and deep freeze on the caller authorization transaction',async()=>{
    for(const flags of [[],[false,false],[true,false],[false,true],[true,true]] as const){
        const f=fixture(),owner=new Catalog.NativeDrivers(f.db,f.identity,...flags),first=await owner.list('reader-a','scope-a'),second=await owner.list('reader-a','scope-a');
        assert.deepEqual(f.events,['begin','scope','commit','begin','scope','commit']);assert.deepEqual(f.calls[0],['scope','reader-a','scope-a']);assert.notEqual(first,second);assert.notEqual(first.drivers,second.drivers);
        assert.deepEqual(Object.keys(first),['version','catalogDigest','source','authorized','reserved','nodeEvidence','platformAcceptance','protocolCapabilityCheck','probeIssuanceEnabled','drivers']);
        assert.deepEqual({...first,drivers:undefined},{version:1,catalogDigest:OriginalDigest,source:'declared-native-implementation',authorized:false,reserved:false,nodeEvidence:'not-included',platformAcceptance:'not-inferred',protocolCapabilityCheck:'each-requested-business-protocol',probeIssuanceEnabled:flags[1]??false,drivers:undefined});
        assert.deepEqual(first.drivers.map(value=>value.id),OriginalCatalog.drivers.map(value=>value.id));assert.equal(Object.isFrozen(first),true);assert.equal(Object.isFrozen(first.drivers),true);
        for(let index=0;index<first.drivers.length;index++){
            const raw=OriginalCatalog.drivers[index]!,view=first.drivers[index]!;assert.notEqual(view,raw);assert.equal(Object.isFrozen(view),true);assert.deepEqual(view,{...raw,controlEnabled:raw.controlGate!=='multihop'||(flags[0]??false)});
            for(const [field,value] of Object.entries(raw))if(value&&typeof value==='object')assert.equal((view as unknown as Record<string,unknown>)[field],value,field);
        }
    }
    const denied=fixture();denied.mutable.failure='scope';await assert.rejects(new Catalog.NativeDrivers(denied.db,denied.identity).list('reader-a','scope-a'),failure=>failure===denied.error);assert.deepEqual(denied.events,['begin','scope','rollback']);
});
