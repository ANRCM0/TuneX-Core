import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NodeService, NodePortLimitPolicy, NODE_PORT_USAGE_QUERY_INTERFACE_VERSION } from '../src/modules/node-owner/public.ts';
import type { NodeGrantPortLimits, NodePortUsageQueries } from '../src/modules/node-owner/public.ts';
import type { NodeAuthorityStore, NodeResourceAccess } from '../src/framework/node-authority-ports.ts';
import type { RuntimePortUsageStore } from '../src/framework/runtime-port-policy-ports.ts';
import { nativeNodeCodec } from '../src/compatibility/public.ts';

type Tx={readonly marker:symbol};

function fixture(){
    const tx:Tx={marker:Symbol('original-transaction')},events:string[]=[];
    const state={source:'admin-shared' as NodeResourceAccess['resource_source'],owner:null as string|null,granted:true,
        limits:{allowedPorts:[23001],maxBindings:2} as NodeGrantPortLimits|null,clock:1770000000000,error:undefined as Error|undefined};
    const slots=[
        {nodeId:'node',protocol:'tcp' as const,port:23001,forwardId:'private-internal-forward'},
        {nodeId:'node',protocol:'udp' as const,port:23001,forwardId:'private-user-forward'},
        {nodeId:'node',protocol:'tcp' as const,port:23002,forwardId:'private-draining-forward'},
    ];
    const nodes={
        async resourceAccess(value:Tx,nodeId:string,scopeId:string,actor:string){
            assert.equal(value,tx);events.push('claim');
            return {id:nodeId,scope_id:scopeId,resource_source:state.source,owner_actor_id:state.owner,resource_revision:1,
                grant_actor_id:state.granted?actor:null,allowed_roles:['egress'],port_limits:state.limits,revoked:1};
        },
        async state(){throw new Error('Usage query must not inspect Node credentials');},
        async scopeGrant(){throw new Error('Usage query must not authorize execution');},
    } as unknown as NodeAuthorityStore<Tx>;
    const usage:RuntimePortUsageStore<Tx>={
        async forwardPortOwner(){throw new Error('Aggregate query must not inspect individual Forward authority');},
        async actorPortSlots(value,nodeId,actor,ownedForwardId){
            assert.equal(value,tx);assert.equal(nodeId,'node');assert.equal(actor,'actor');assert.equal(ownedForwardId,undefined);events.push('own-slots');
            if(state.error)throw state.error;
            return slots;
        },
    };
    const policy=new NodePortLimitPolicy(nodes,usage);
    const service=new NodeService<Tx>({
        db:{async transaction(action:(value:Tx)=>Promise<unknown>){events.push('transaction');return action(tx);}},
        identity:{async scope(value:Tx,actor:string,scope:string,manage?:boolean){assert.equal(value,tx);assert.equal(actor,'actor');assert.equal(scope,'scope');assert.equal(manage,undefined);events.push('scope');},
            async owner(){throw new Error('Governance cannot replace a personal grant');}},
        store:nodes,portLimits:policy,resources:{},codec:nativeNodeCodec,secrets:{},machine:{},signer:{},
        now:()=>state.clock,overlapSeconds:1,relayCredentialSeconds:60,
        additionalUseAuthorization:{async allowed(){throw new Error('Personal usage is not an execution-authority query');}},
    } as never);
    const query:NodePortUsageQueries=service;
    return {state,events,slots,query};
}

test('personal query v1 returns caller-only physical aggregates in the original transaction',async()=>{
    const f=fixture(),view=await f.query.portUsage('actor','scope','node');
    assert.equal(NODE_PORT_USAGE_QUERY_INTERFACE_VERSION,1);
    assert.deepEqual(f.events,['transaction','scope','claim','own-slots']);
    assert.equal(view.occupiedBindings,3);assert.equal(view.remainingBindings,0);assert.equal(view.overLimit,true);
    assert.equal(view.outOfRangeBindings,1);assert.equal(view.limitApplicability,'shared-grant');
    assert.equal(view.source,'runtime-port-slots');assert.equal(view.executionAuthorized,false);
    assert.equal(view.observedAt,new Date(f.state.clock).toISOString());
    assert.deepEqual(view.counting,{unit:'protocol+port',tcpUdp:'separate',includesInternal:true,includesDraining:true});
    assert.equal(JSON.stringify(view).includes('private-internal-forward'),false);
    assert.equal(JSON.stringify(view).includes('private-draining-forward'),false);
    assert.equal(Object.hasOwn(view,'slots'),false);assert.equal(Object.hasOwn(view,'forwards'),false);
});

test('revoked and over-range retained occupation stays readable without execution authority',async()=>{
    const f=fixture();f.state.limits={allowedPorts:[24000],maxBindings:10};
    const view=await f.query.portUsage('actor','scope','node');
    assert.equal(view.occupiedBindings,3);assert.equal(view.outOfRangeBindings,3);
    assert.equal(view.overLimit,false);assert.equal(view.remainingBindings,7);assert.equal(view.executionAuthorized,false);
});

test('private owner sees personal occupation with explicit not-applicable limits',async()=>{
    const f=fixture();f.state.source='private';f.state.owner='actor';f.state.granted=false;
    const view=await f.query.portUsage('actor','scope','node');
    assert.equal(view.resourceSource,'private');assert.equal(view.occupiedBindings,3);
    assert.equal(view.portLimits,null);assert.equal(view.remainingBindings,null);
    assert.equal(view.limitApplicability,'not-applicable');assert.equal(view.overLimit,false);assert.equal(view.outOfRangeBindings,0);
});

test('shared unlimited grant retains shared applicability and null numeric remaining',async()=>{
    const f=fixture();f.state.limits=null;
    const view=await f.query.portUsage('actor','scope','node');
    assert.equal(view.limitApplicability,'shared-grant');assert.equal(view.remainingBindings,null);assert.equal(view.overLimit,false);
});

test('governance has no private-owner or absent-grant read bypass',async()=>{
    for(const source of ['private','admin-shared','legacy-unclassified'] as const){
        const f=fixture();f.state.source=source;f.state.owner=source==='private'?'another-user':null;f.state.granted=false;
        await assert.rejects(f.query.portUsage('actor','scope','node'));
        assert.equal(f.events.includes('own-slots'),false);
    }
});

test('storage errors propagate by identity instead of becoming empty or unauthorized usage',async()=>{
    const f=fixture(),error=new Error('original-database-read-failure');f.state.error=error;
    await assert.rejects(f.query.portUsage('actor','scope','node'),value=>value===error);
});
