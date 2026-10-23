import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import { ControlError } from '../src/framework/public.ts';
import type { NodeAuthorityStore, NodeResourceAccess, NodeAuthorityRecord, NodeUseRole, NodeResourceClaim } from '../src/framework/node-authority-ports.ts';
import type { AuthorizedNodeFacts, IdempotentRequests, RequestIdentity, CommandResponse } from '../src/framework/public.ts';
import { nativeNodeCodec } from '../src/compatibility/public.ts';
import { NodeService, NodeManagementCommands, NodeResourcePolicy, NodePortLimitPolicy, nodeGrantRoles, snapshotNodeCommand } from '../src/modules/node-owner/public.ts';
import { AccessChangeReconciler } from '../src/modules/identity-owner/access-reconciler.ts';
import type { AccessExecution } from '../src/modules/identity-owner/execution-ports.ts';
import type { ActorForwardReferences } from '../src/modules/forward-owner/public.ts';

type Tx={id:string};
const tx:Tx={id:'original-transaction'};
const facts:AuthorizedNodeFacts={nodeId:'node-a',scopeId:'scope-a',capabilities:['adp.3','native.direct.v1','tcp'],allowedListenerAddresses:['127.0.0.1'],allowedPorts:[32001],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false};
const forward:Forward={id:'forward-a',scopeId:'scope-a',revision:1,spec:{enabled:true,protocols:['tcp'],ingress:{nodeId:'node-a',listen:{address:'127.0.0.1',port:32001}},target:{host:'127.0.0.1',port:8080}}};
const rejected=(error:unknown)=>error instanceof ControlError&&['AUTHORIZATION_DENIED','NOT_FOUND'].includes(error.code);

function fixture(source:NodeResourceClaim['resource_source']='private'){
    const calls:string[]=[],grants=new Map<string,readonly NodeUseRole[]|null>([['alice',null],['bob',null],['admin',null]]);
    let grantRevision=1;
    const record:NodeAuthorityRecord={id:'node-a',scope_id:'scope-a',facts,revoked:0,credential_until:100000,
        resource_source:source,owner_actor_id:source==='private'?'alice':null,resource_revision:1};
    const check=(current:Tx)=>assert.equal(current,tx);
    const store={
        async create(current:Tx,_node:string,_scope:string,_actor:string,_hash:string,_until:number,value:AuthorizedNodeFacts,claim:NodeResourceClaim){check(current);Object.assign(record,claim,{facts:value});grants.clear();calls.push('create');},
        async resourceAccess(current:Tx,node:string,scope:string,actor:string):Promise<NodeResourceAccess|undefined>{check(current);return node===record.id&&scope===record.scope_id?{...record,grant_actor_id:grants.has(actor)?actor:null,allowed_roles:grants.get(actor)??null,port_limits:null}:undefined;},
        async state(current:Tx){check(current);return record;},
        async scopeGrant(current:Tx,_node:string,actor:string){check(current);return grants.has(actor);},
        async relayGrant(current:Tx,_node:string,_scope:string,actor:string){check(current);return grants.has(actor);},
        async hasGrant(current:Tx,_node:string,actor:string){check(current);return grants.has(actor);},
        async visible(current:Tx){check(current);return true;},
        async scopedNode(current:Tx){check(current);return record;},
        async grantRevisionForUpdate(current:Tx){check(current);return {grant_revision:grantRevision};},
        async grantRevision(current:Tx){check(current);return {grant_revision:grantRevision};},
        async grantActors(current:Tx){check(current);return [...grants].map(([actor_id,allowed_roles])=>({actor_id,allowed_roles,port_limits:null}));},
        async insertGrant(current:Tx,_node:string,actor:string,roles:readonly NodeUseRole[]|null){check(current);assert.equal(grants.has(actor),false);grants.set(actor,roles);},
        async setGrantRoles(current:Tx,_node:string,actor:string,roles:readonly NodeUseRole[]|null){check(current);grants.set(actor,roles);},
        async deleteGrant(current:Tx,_node:string,actor:string){check(current);grants.delete(actor);},
        async setGrantRevision(current:Tx,_node:string,revision:number){check(current);grantRevision=revision;},
        async classify(current:Tx,_node:string,expected:number,claim:NodeResourceClaim){check(current);if(record.resource_revision!==expected)return false;Object.assign(record,claim);calls.push('classify');return true;},
        async clearGrants(current:Tx){check(current);grants.clear();calls.push('clear-grants');},
        async securityEvent(current:Tx,_id:string,_node:string,_actor:string,kind:string){check(current);calls.push(kind);},
        async credentials(current:Tx){check(current);calls.push('credentials');return [];},
    } as unknown as NodeAuthorityStore<Tx>;
    const portLimits=new NodePortLimitPolicy(store,{
        async forwardPortOwner(current:Tx,id:string){check(current);return {scopeId:'scope-a',ownerActorId:id==='forward-bob'?'bob':record.owner_actor_id??'alice'};},
        async actorPortSlots(current:Tx){check(current);return [];},
    });
    const host=new NodeService({db:{async transaction<T>(action:(current:Tx)=>Promise<T>){return action(tx);}},store,portLimits,
        identity:{async scope(current:Tx){check(current);},async owner(current:Tx,actor:string){check(current);if(actor!=='admin')throw new ControlError('AUTHORIZATION_DENIED',403,'Owner required');},async executing(current:Tx){check(current);return true;},async audit(current:Tx){check(current);calls.push('grant-audit');}},
        resources:{async initializeNode(current:Tx){check(current);calls.push('initialize');},async lockNode(current:Tx){check(current);calls.push('runtime-lock');},async maximumAuthorization(current:Tx){check(current);calls.push('maximum');return null;}},
        signer:{async sign(){throw new Error('Signing is outside these product command cases');}},machine:{async machine(){return undefined;}},
        secrets:{newID:()=> 'node-a',newToken:()=> 'a'.repeat(32),tokenHash:value=>value},codec:nativeNodeCodec,now:()=>1000,overlapSeconds:120,relayCredentialSeconds:3600});
    return {host,record,store,portLimits,grants,calls,revision:()=>grantRevision};
}

test('private Node grants cannot give another actor or administrator use or delegation',async()=>{
    const f=fixture();
    assert.equal(await f.host.canExecute(tx,'alice',forward),true);
    for(const actor of ['bob','admin']){
        assert.equal(await f.host.canExecute(tx,actor,forward),false);
        await assert.rejects(f.host.authorized(tx,actor,forward),rejected);
    }
    await assert.rejects(f.host.changeGrant(tx,'admin','scope-a','node-a','bob',1,true),rejected);
    await f.host.management(tx,'alice','scope-a','node-a');
    await f.host.management(tx,'admin','scope-a','node-a');
    await assert.rejects(f.host.management(tx,'bob','scope-a','node-a'),rejected);
});

test('ordinary provision records private ownership; shared provision requires the explicit administrator entry',async()=>{
    const {nodeId:_node,scopeId:_scope,capabilities:_capabilities,...policy}=facts;
    const f=fixture();await f.host.provision('alice','scope-a',policy);
    assert.equal(f.record.resource_source,'private');assert.equal(f.record.owner_actor_id,'alice');
    assert.deepEqual([...f.grants],[['alice',null]]);
    await assert.rejects(f.host.provisionShared('alice','scope-a',policy),rejected);
    await f.host.provisionShared('admin','scope-a',policy);
    assert.equal(f.record.resource_source,'admin-shared');assert.equal(f.record.owner_actor_id,null);
    assert.equal(f.grants.size,0);assert.equal(await f.host.canExecute(tx,'admin',forward),false);
});

test('purpose narrowing changes revision even with allowed=true and blocks ingress and egress',async()=>{
    const f=fixture('admin-shared');
    const changed=await f.host.changeGrant(tx,'admin','scope-a','node-a','bob',1,true,['transit']);
    assert.equal(changed.changed,true);assert.equal(changed.revision,2);assert.deepEqual(changed.allowedRoles,['transit']);
    assert.equal(await f.host.canExecute(tx,'bob',forward),false);
    await f.host.authorizedRelayNode(tx,'bob','scope-a','node-a','transit');
    for(const role of ['ingress','egress',undefined] as const)await assert.rejects(f.host.authorizedRelayNode(tx,'bob','scope-a','node-a',role as NodeUseRole),rejected);
    const same=await f.host.changeGrant(tx,'admin','scope-a','node-a','bob',2,true,['transit']);assert.equal(same.changed,false);
    await assert.rejects(f.host.changeGrant(tx,'admin','scope-a','node-a','bob',1,true,null),error=>error instanceof ControlError&&error.code==='REVISION_CONFLICT');
    await f.host.changeGrant(tx,'admin','scope-a','node-a','bob',2,true,null);
    for(const role of ['ingress','transit','egress'] as const)await f.host.authorizedRelayNode(tx,'bob','scope-a','node-a',role);
    f.grants.delete('bob');await assert.rejects(f.host.authorizedRelayNode(tx,'bob','scope-a','node-a','transit'),rejected);
});

test('legacy classification never infers owner, discards old grants, and inserts only explicit private owner',async()=>{
    const f=fixture('legacy-unclassified');assert.equal(await f.host.canExecute(tx,'alice',forward),false);
    const command={kind:'classify',expectedRevision:1,source:'private',ownerActorId:'bob',legacyGrants:'discard'} as const;
    await assert.rejects(f.host.applyManagement(tx,'alice','scope-a','node-a',command),rejected);
    const changed=await f.host.applyManagement(tx,'admin','scope-a','node-a',command);
    assert.equal(changed.resource?.resource_revision,2);assert.deepEqual([...f.grants],[['bob',null]]);
    assert.equal(await f.host.canExecute(tx,'alice',forward),false);assert.equal(await f.host.canExecute(tx,'bob',forward),true);
    assert.ok(f.calls.indexOf('runtime-lock')<f.calls.indexOf('classify'));assert.ok(f.calls.includes('resource_classification'));
    await assert.rejects(f.host.applyManagement(tx,'admin','scope-a','node-a',command),rejected);
    assert.throws(()=>snapshotNodeCommand({...command,legacyGrants:'retain'}));
});

test('shared legacy grants survive only an explicit retain choice and classification uses resource CAS',async()=>{
    for(const legacyGrants of ['retain','discard'] as const){
        const f=fixture('legacy-unclassified');
        await assert.rejects(f.host.applyManagement(tx,'admin','scope-a','node-a',{kind:'classify',expectedRevision:2,source:'admin-shared',ownerActorId:null,legacyGrants}),error=>error instanceof ControlError&&error.code==='REVISION_CONFLICT');
        assert.equal(f.record.resource_source,'legacy-unclassified');
        await f.host.applyManagement(tx,'admin','scope-a','node-a',{kind:'classify',expectedRevision:1,source:'admin-shared',ownerActorId:null,legacyGrants});
        assert.equal(await f.host.canExecute(tx,'bob',{...forward,id:'forward-bob'}),legacyGrants==='retain');
        assert.equal(await f.host.canExecute(tx,'bob',forward),false);
        assert.equal(f.grants.size,legacyGrants==='retain'?3:0);
    }
});

test('classification effects and receipts join the original transaction, rollback together, and replay without execution',async()=>{
    const f=fixture('legacy-unclassified'),receipts=new Map<string,{request:RequestIdentity;response:CommandResponse}>();
    let fail=true,effects=0;
    const db={async transaction<T>(action:(current:Tx)=>Promise<T>){
        const before={...f.record},grants=new Map(f.grants),revision=f.revision(),saved=new Map(receipts),calls=f.calls.length;
        try{return await action(tx);}catch(error){Object.assign(f.record,before);f.grants.clear();for(const [actor,roles] of grants)f.grants.set(actor,roles);await f.store.setGrantRevision(tx,'node-a',revision);receipts.clear();for(const [key,value] of saved)receipts.set(key,value);f.calls.length=calls;throw error;}
    }};
    const idempotency:IdempotentRequests<Tx>={
        async claim<R extends CommandResponse>(current:Tx,request:RequestIdentity):Promise<R|undefined>{assert.equal(current,tx);const receipt=receipts.get(request.key);if(receipt&&receipt.request.digest!==request.digest)throw new ControlError('IDEMPOTENCY_CONFLICT',409,'Request differs');return receipt?.response as R|undefined;},
        async respond(current:Tx,request:RequestIdentity,response:CommandResponse){assert.equal(current,tx);receipts.set(request.key,{request,response});},
    };
    const commands=new NodeManagementCommands(db,{async scope(current:Tx){assert.equal(current,tx);}},idempotency,f.host,
        {async reconcile(current:Tx,_request,change){assert.equal(current,tx);assert.equal(change.kind,'classify');assert.equal(f.record.resource_source,'private');effects++;if(fail)throw new Error('effect failure');return {operationIds:['operation-a'],maximumAuthorization:2000};}});
    const command={kind:'classify',expectedRevision:1,source:'private',ownerActorId:'bob',legacyGrants:'discard'} as const;
    await assert.rejects(commands.change('admin','scope-a','node-a','classify-request',command),/effect failure/);
    assert.equal(f.record.resource_source,'legacy-unclassified');assert.equal(f.revision(),1);assert.equal(f.grants.size,3);assert.equal(receipts.size,0);
    fail=false;
    const accepted=await commands.change('admin','scope-a','node-a','classify-request',command);
    assert.equal(accepted.body.resourceRevision,2);assert.deepEqual([...f.grants],[['bob',null]]);
    assert.deepEqual(await commands.change('admin','scope-a','node-a','classify-request',command),accepted);assert.equal(effects,2);
    await assert.rejects(commands.change('admin','scope-a','node-a','classify-request',{...command,ownerActorId:'alice'}),error=>error instanceof ControlError&&error.code==='IDEMPOTENCY_CONFLICT');
});

test('shared Node detail omits policy, credentials and cutoff while owner and governance retain full detail',async()=>{
    const f=fixture('admin-shared'),basic=await f.host.view('bob','scope-a','node-a');
    assert.equal(basic.detail,'basic');for(const key of ['credentials','policy','latestAuthorizationUntil','pendingRevocation'])assert.equal(key in basic,false);
    assert.equal(f.calls.includes('credentials'),false);assert.equal(f.calls.includes('maximum'),false);
    assert.equal((await f.host.view('admin','scope-a','node-a')).detail,'full');
    assert.equal((await fixture().host.view('alice','scope-a','node-a')).detail,'full');
    await assert.rejects(fixture().host.view('bob','scope-a','node-a'),rejected);
});

test('purpose metadata rejects empty and malformed stored grants rather than treating them as unrestricted',async()=>{
    assert.equal(nodeGrantRoles(null),null);for(const input of [[],['invalid'],['transit','transit'],undefined])assert.throws(()=>nodeGrantRoles(input));
    const f=fixture('admin-shared');f.grants.set('bob',[]);
    await assert.rejects(new NodeResourcePolicy(f.store,f.portLimits).allowed(tx,'bob','scope-a','node-a','transit'));
});

test('grant narrowing rechecks the whole Forward in the original transaction and publishes revocation',async()=>{
    const events:string[]=[],path={...forward,spec:{...forward.spec,path:{via:['node-b','node-c']},transport:{profileId:'profile-a',configRevision:1}}};
    const refs={async forActor(current:Tx){assert.equal(current,tx);return [path];}} as unknown as ActorForwardReferences<Tx>;
    const execution={async lock(current:Tx){assert.equal(current,tx);events.push('lock');},async nodeIDs(){return ['node-a','node-b','node-c'];},async allowed(current:Tx,actor:string,checked:Forward){assert.equal(current,tx);assert.equal(actor,'bob');assert.equal(checked,path);events.push('allowed');return false;},async transition(){throw new Error('A narrowed path must not transition');},async accept(_tx:Tx,_forward:Forward,_request:unknown,kind:string){events.push(kind);return 'operation-a';},async validateNode(){events.push('validate');},async maximumAuthorization(){return 2000;}} as unknown as AccessExecution<Tx>;
    const result=await new AccessChangeReconciler(refs,execution).nodeGrant(tx,{actorId:'admin',scopeId:'scope-a',key:'request-a',digest:'digest-a'},
        {nodeId:'node-b',actorId:'bob',revision:2,allowed:true,changed:true,allowedRoles:['egress'],portLimits:null});
    assert.deepEqual(events,['lock','allowed','revoke','validate']);assert.deepEqual(result.operationIds,['operation-a']);assert.equal(result.maximumAuthorization,2000);
});
