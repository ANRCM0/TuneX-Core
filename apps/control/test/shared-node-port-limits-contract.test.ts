import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import { RuntimeResources } from '../src/framework/runtime-resources.ts';
import { RuntimeExclusiveReservations } from '../src/framework/runtime-exclusive-reservations.ts';
import type { RuntimeResourceStore, RuntimeSlotKey, RuntimeSlotState } from '../src/framework/runtime-resource-ports.ts';
import type { RuntimeExclusiveReservationStore } from '../src/framework/runtime-exclusive-reservation-ports.ts';
import type { RuntimePortUsageStore } from '../src/framework/runtime-port-policy-ports.ts';
import type { NodeAuthorityStore, NodeResourceAccess } from '../src/framework/node-authority-ports.ts';
import { NodePortLimitPolicy, nodeGrantPortLimits, NodeResourcePolicy, NodeService } from '../src/modules/node-owner/public.ts';
import type { NodeGrantPortLimits } from '../src/modules/node-owner/public.ts';
import { nativeNodeCodec } from '../src/compatibility/public.ts';

type Tx={readonly token:symbol};
const forward=(id='forward'):Forward=>({id,scopeId:'scope',revision:1,spec:{enabled:true,protocols:['tcp'],ingress:{nodeId:'node',listen:{address:'127.0.0.1',port:23001}},target:{host:'127.0.0.1',port:80}}});
const slotKey=(value:RuntimeSlotKey)=>`${value.nodeId}/${value.protocol}/${value.port}`;

function fixture(limits:NodeGrantPortLimits|null={allowedPorts:null,maxBindings:2}){
    const tx:Tx={token:Symbol('original')},events:string[]=[];
    const state={limits,source:'admin-shared' as NodeResourceAccess['resource_source'],owner:null as string|null,grant:true};
    const owners=new Map<string,string|null>(),slots=new Map<string,RuntimeSlotKey&RuntimeSlotState>();
    const same=(value:Tx)=>assert.equal(value,tx);
    const nodes={async resourceAccess(value:Tx,nodeId:string,scopeId:string,actor:string){same(value);return {id:nodeId,scope_id:scopeId,resource_source:state.source,owner_actor_id:state.owner,resource_revision:1,grant_actor_id:state.grant?actor:null,allowed_roles:null,port_limits:state.limits};}} as unknown as NodeAuthorityStore<Tx>;
    const usage:RuntimePortUsageStore<Tx>={
        async forwardPortOwner(value,id){same(value);return owners.has(id)?{scopeId:'scope',ownerActorId:owners.get(id)!}:undefined;},
        async actorPortSlots(value,nodeId,actor,ownedForwardId){same(value);return [...slots.values()].filter(slot=>slot.nodeId===nodeId&&slot.owner_id!==null&&(owners.get(slot.owner_id)===actor||slot.owner_id===ownedForwardId)).map(slot=>({...slot,forwardId:slot.owner_id!}));},
    };
    const store:RuntimeResourceStore<Tx>&RuntimeExclusiveReservationStore<Tx>={
        async initializeNode(value){same(value);},
        async lockNode(value){same(value);events.push('node-lock');return {session_epoch:1};},
        async lockedNodes(value,nodeId){same(value);events.push('node-lock');return [{node_id:nodeId}];},
        async maximumAuthorization(value){same(value);return null;},
        async ensureSlot(value,key){same(value);if(!slots.has(slotKey(key)))slots.set(slotKey(key),{...key,owner_id:null,fence:0,deployment_generation:0});},
        async lockSlot(value,key){same(value);events.push('slot-lock');return slots.get(slotKey(key))!;},
        async exclusiveSlot(value,key){same(value);return slots.get(slotKey(key));},
        async lockOwnedSlots(value,nodeId,id){same(value);return [...slots.values()].filter(slot=>slot.nodeId===nodeId&&slot.owner_id===id);},
        async assignSlot(value,key,id,generation){same(value);events.push('assign');const slot=slots.get(slotKey(key))!;slot.owner_id=id;slot.fence++;slot.deployment_generation=generation;},
        async countOwnedSlots(value,nodeId){same(value);return [...slots.values()].filter(slot=>slot.nodeId===nodeId&&slot.owner_id!==null).length;},
        async ownedSlotCount(value,nodeId){return {n:await this.countOwnedSlots(value,nodeId)};},
        async ownedSlots(value,id){same(value);return [...slots.values()].filter(slot=>slot.owner_id===id);},
        async releaseSlot(value,key,id){same(value);const slot=slots.get(slotKey(key));if(slot?.owner_id===id)slot.owner_id=null;},
        async releaseForwardSlots(value,id){same(value);for(const slot of slots.values())if(slot.owner_id===id)slot.owner_id=null;},
    };
    const policy=new NodePortLimitPolicy(nodes,usage),runtime=new RuntimeResources(store,100,policy);
    return {tx,state,owners,slots,events,nodes,policy,runtime,store,exclusive:new RuntimeExclusiveReservations(store,()=>100,policy)};
}

test('grant limit normalization refuses unknown fields and distinguishes zero from unlimited',()=>{
    assert.deepEqual(nodeGrantPortLimits({allowedPorts:[23002,23001],maxBindings:0}),{allowedPorts:[23001,23002],maxBindings:0});
    for(const input of [undefined,{},[],{allowedPorts:[],maxBindings:null},{allowedPorts:[1,1],maxBindings:null},{allowedPorts:[65536],maxBindings:null},{allowedPorts:null,maxBindings:-1},{allowedPorts:null,maxBindings:1.1},{allowedPorts:null,maxBindings:1,unknown:true}])
        assert.throws(()=>nodeGrantPortLimits(input));
    assert.equal(nodeGrantPortLimits(null),null);
});

test('pre-insert explicit owner is required and both physical protocols consume quota',async()=>{
    const f=fixture({allowedPorts:[23001],maxBindings:1}),base=forward(),intent:Forward={...base,spec:{...base.spec,protocols:['tcp','udp']}};
    await assert.rejects(f.runtime.reserve(f.tx,intent),/Creating Forward owner required/);
    await assert.rejects(f.runtime.reserve(f.tx,intent,'actor'),/binding limit exceeded/);
    assert.equal(f.slots.size,0);
    assert.equal(f.events[0],'node-lock');
    f.state.limits={allowedPorts:[23001],maxBindings:2};
    await f.runtime.reserve(f.tx,intent,'actor');
    assert.equal(f.slots.size,2);
});

test('same Forward reuse does not double count while Transit exclusive rejects it',async()=>{
    const f=fixture({allowedPorts:null,maxBindings:1}),intent=forward();f.owners.set(intent.id,'actor');
    const resource={nodeId:'node',role:'ingress' as const,forwardProtocol:'tcp' as const,physicalProtocol:'tcp' as const,address:'127.0.0.1',port:23001};
    await f.runtime.reserveRelay(f.tx,intent,[resource],1);
    await f.runtime.reserveRelay(f.tx,intent,[resource],2);
    assert.equal(f.slots.size,1);
    await assert.rejects(f.exclusive.reserve(f.tx,intent,[resource],3),/Physical port owned/);
});

test('original unreleased obsolete slots and internal Relay slots stay charged to immutable owner',async()=>{
    const f=fixture({allowedPorts:null,maxBindings:2}),first=forward(),second=forward('second');
    f.owners.set(first.id,'actor');f.owners.set(second.id,'actor');
    await f.runtime.reserve(f.tx,first);
    const next={...first,revision:2,spec:{...first.spec,ingress:{...first.spec.ingress,listen:{address:'127.0.0.1',port:23002}}}};
    await f.runtime.transition(f.tx,first,next);
    assert.equal(await f.store.countOwnedSlots(f.tx,'node'),2);
    await assert.rejects(f.runtime.reserveRelay(f.tx,second,[{nodeId:'node',role:'egress',forwardProtocol:'udp',physicalProtocol:'tcp',address:'127.0.0.1',port:23003}],1),/binding limit exceeded/);
    await f.runtime.releaseObsoleteSlots(f.tx,next);
    await f.runtime.reserveRelay(f.tx,second,[{nodeId:'node',role:'egress',forwardProtocol:'udp',physicalProtocol:'tcp',address:'127.0.0.1',port:23003}],1);
    assert.equal(await f.store.countOwnedSlots(f.tx,'node'),2);
});

test('narrowing denies execution but exact stop and release remain available',async()=>{
    const f=fixture(),intent=forward();f.owners.set(intent.id,'actor');
    await f.runtime.reserve(f.tx,intent);
    f.state.limits={allowedPorts:[24000],maxBindings:0};
    assert.equal(await f.policy.allowed(f.tx,'actor','scope','node',intent),false);
    const stopped={...intent,revision:2,spec:{...intent.spec,enabled:false}};
    await f.runtime.transition(f.tx,intent,stopped);
    await f.runtime.releaseForwardSlots(f.tx,intent.id);
    assert.equal(await f.store.countOwnedSlots(f.tx,'node'),0);
});

test('private Nodes bypass shared limits while additional owner policy can only reduce access',async()=>{
    const f=fixture({allowedPorts:[24000],maxBindings:0});f.state.source='private';f.state.owner='actor';
    await f.runtime.reserve(f.tx,forward(),'actor');
    const base=new NodeResourcePolicy(f.nodes,f.policy,{async allowed(){return false;}});
    assert.equal(await base.allowed(f.tx,'actor','scope','node','ingress',forward()),false);
});

test('range filtering preserves later legal automatic Relay candidates',async()=>{
    const f=fixture({allowedPorts:[23003],maxBindings:2});
    assert.deepEqual(await f.policy.reservationPorts(f.tx,'actor','scope','node',[23001,23002,23003]),[23003]);
});

test('immutable ownership and unclassified rows cannot be replaced by execution actor',async()=>{
    const f=fixture(null),intent=forward();f.owners.set(intent.id,'business-owner');
    await assert.rejects(f.runtime.reserve(f.tx,intent,'mutable-authorizer'),/Immutable Forward port owner/);
    assert.equal(await f.policy.allowed(f.tx,'mutable-authorizer','scope','node',intent),false);
    f.owners.set(intent.id,null);
    assert.equal(await f.policy.allowed(f.tx,'actor','scope','node',intent),false);
});

test('several pre-insert calls include the same Forward original slots in its explicit owner usage',async()=>{
    const f=fixture({allowedPorts:null,maxBindings:1}),intent=forward();
    await f.runtime.reserve(f.tx,intent,'actor');
    await assert.rejects(f.runtime.reserveRelay(f.tx,intent,[{nodeId:'node',role:'egress',forwardProtocol:'tcp',physicalProtocol:'tcp',address:'127.0.0.1',port:23002}],1,'actor'),/binding limit exceeded/);
});

test('purpose-only grant changes retain port limits and explicit null clears them',async()=>{
    const f=fixture({allowedPorts:[23001],maxBindings:2});let revision=1;const writes:unknown[]=[];
    const store={...f.nodes,
        async visible(){return true;},async scopedNode(){return {id:'node',scope_id:'scope',resource_source:'admin-shared',owner_actor_id:null,resource_revision:1,revoked:0};},
        async grantRevisionForUpdate(){return {grant_revision:revision};},async hasGrant(){return true;},
        async grantActors(){return [{actor_id:'actor',allowed_roles:null,port_limits:f.state.limits}];},
        async setGrantRoles(_tx:Tx,_node:string,_actor:string,_roles:unknown,limits:NodeGrantPortLimits|null){f.state.limits=limits;writes.push(limits);},
        async setGrantRevision(_tx:Tx,_node:string,next:number){revision=next;},
    };
    const nodes=new NodeService({db:{},identity:{async scope(){},async owner(){},async audit(){}},store,
        resources:f.runtime,portLimits:f.policy,codec:nativeNodeCodec,secrets:{},signer:{},machine:{},now:()=>0,overlapSeconds:1,relayCredentialSeconds:60} as never);
    const unchanged=await nodes.changeGrant(f.tx,'administrator','scope','node','actor',1,true,null);
    assert.equal(unchanged.changed,false);assert.equal(writes.length,0);
    const cleared=await nodes.changeGrant(f.tx,'administrator','scope','node','actor',1,true,null,null);
    assert.equal(cleared.changed,true);assert.equal(cleared.portLimits,null);assert.deepEqual(writes,[null]);
});
