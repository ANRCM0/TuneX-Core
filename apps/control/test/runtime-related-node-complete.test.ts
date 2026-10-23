import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_POLICY, digest } from '@tunex/contracts/shared';
import { RuntimeHost, RuntimeRelayHost } from '../src/framework/public.ts';
import { runtimeCodec, nativeRelayCompiler } from '../src/compatibility/public.ts';
import type { RuntimeMessages } from '@tunex/contracts/runtime';

type Tx={id:number};
type Event={name:string;tx:Tx|undefined;args:unknown[]};
function deployment(id:string,nodes:string[],generation=1,ingress=nodes[0]!){
    const body={forwardId:id,forwardRevision:1,deploymentGeneration:generation,authorizationUntil:999999,endpointRevision:1,nodes:nodes.map(nodeId=>({nodeId,sessionEpoch:2,assignments:[]}))};
    const plan={...body,planDigest:digest(body)};
    return {forward_id:id,generation,target_revision:1,ingress_node_id:ingress,egress_node_id:nodes.at(-1),body:JSON.stringify(plan),stage:'withdrawn',prepared_count:0,activated_count:0};
}
function fixture(){
    const events:Event[]=[],failure=new Error('original Runtime provider'),effects:string[]=[],state={fail:'',transaction:0,target:'node-c',missing:'',epoch:2,now:1800000000000,cleanup:['node-c','cleanup-only','node-b'],pending:[] as ReturnType<typeof deployment>[],boot:true};
    // Reverse edges require more than one fixed-point pass; old withdrawn rows
    // retain their historical links, while an unrelated component remains out.
    const deployments=[deployment('cd',['node-c','node-d'],1),deployment('bc',['node-b','node-c'],2),deployment('ab',['node-a','node-b'],3),deployment('cycle',['node-d','node-a'],4),deployment('unrelated',['node-x','node-y'],5)];
    const event=(name:string,tx:Tx|undefined,args:unknown[]=[])=>{events.push({name,tx,args});if(state.fail===name)throw failure;};
    let active:Tx|undefined;
    function same(name:string,tx:Tx,args:unknown[]=[]){assert.equal(tx,active,`${name} original transaction`);event(name,tx,args);}
    const db={async transaction<T>(run:(tx:Tx)=>Promise<T>){assert.equal(active,undefined,'no nested owner transaction');const tx={id:++state.transaction};active=tx;event('begin',tx);const before=[...effects];try{const result=await run(tx);event('commit',tx);return result;}catch(error){effects.splice(0,effects.length,...before);events.push({name:'rollback',tx,args:[]});throw error;}finally{active=undefined;}}};
    const relayStore={async allDeployments(tx:Tx){same('allDeployments',tx);return deployments;},async forForward(tx:Tx,id:string){same('historical',tx,[id]);return deployments.filter(row=>row.forward_id==='ab'||row.forward_id==='cd');},async pendingDeployments(tx:Tx){same('pendingDeployments',tx);return state.pending;},async forwardIDsForNode(tx:Tx,id:string){same('forwardIDs',tx,[id]);return [];}};
    const relayLedger={async lockNode(tx:Tx,id:string){same('relay-lock',tx,[id]);}};
    const relayObservations={async leaseNodes(tx:Tx,id:string){same('leaseNodes',tx,[id]);return [{node_id:'lease-only'},{node_id:'node-c'}];}};
    const relay=new RuntimeRelayHost({compiler:nativeRelayCompiler,store:relayStore,observations:relayObservations,ledger:relayLedger,policy:DEFAULT_POLICY,multihopEnabled:true,now:()=>state.now} as never);
    const facts={nodeId:state.target,scopeId:'scope',capabilities:['adp.3','native.direct.v1','tcp'],allowedListenerAddresses:['127.0.0.1'],allowedPorts:[8080],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false};
    const store={async lockNode(tx:Tx,id:string){same('lock',tx,[id]);return id===state.missing?undefined:{node_id:id,session_epoch:state.epoch,boot_id:'boot',snapshot_generation:0,last_report_sequence:0};},async boot(tx:Tx,id:string,boot:string){same('boot',tx,[id,boot]);return state.boot?{session_epoch:state.epoch}:undefined;},async beginBoot(tx:Tx,...args:unknown[]){same('beginBoot',tx,args);effects.push('boot');},async snapshot(tx:Tx,...args:unknown[]){same('snapshot',tx,args);return undefined;},async awaitingClaim(tx:Tx,...args:unknown[]){same('awaiting',tx,args);return 0;},async saveSnapshot(tx:Tx,...args:unknown[]){same('save',tx,args);effects.push('snapshot');},async cleanupNodeIDs(){assert.equal(active,undefined);event('cleanup',undefined);return state.cleanup;},async reportDigest(tx:Tx,...args:unknown[]){same('reportDigest',tx,args);return undefined;},async saveReport(tx:Tx,...args:unknown[]){same('saveReport',tx,args);effects.push('report');}};
    const nodes={async facts(tx:Tx,id:string){same('facts',tx,[id]);return {facts:{...facts,nodeId:id}};},async state(tx:Tx,id:string){same('state',tx,[id]);return {facts:{...facts,nodeId:id},credentialUntil:state.now+3600000,revoked:false};},async credential(tx:Tx,...args:unknown[]){same('credential',tx,args);return state.now+3600000;},async capabilities(tx:Tx,...args:unknown[]){same('capabilities',tx,args);effects.push('capabilities');}};
    const ledger={async assignments(tx:Tx,...args:unknown[]){same('assignments',tx,args);return [];},async retireChanged(tx:Tx,...args:unknown[]){same('retire',tx,args);effects.push('retirement');},async tombstones(tx:Tx,...args:unknown[]){same('tombstones',tx,args);return [];},async verifyPublishable(tx:Tx,...args:unknown[]){same('verify',tx,args);},async recordLeases(tx:Tx,...args:unknown[]){same('leases',tx,args);effects.push('leases');},async complete(tx:Tx,...args:unknown[]){same('complete',tx,args);effects.push('cleanup');},async observeDrains(tx:Tx,...args:unknown[]){same('drains',tx,args);effects.push('drains');},async claim(tx:Tx){same('claim',tx);return undefined;}};
    const authority={async issue(...args:unknown[]){assert.ok(active);event('authority',active,args);}};
    const unlimitedPayloadPolicy={async limits(tx:Tx){same('payload-policy',tx);return {excludedAssignmentIds:[]};}};
    const host=new RuntimeHost({db,store,nodes,ledger,relay,authority,payloadPolicy:unlimitedPayloadPolicy,codec:runtimeCodec,now:()=>state.now,forwards:{},observations:{}} as never);
    const hello:RuntimeMessages['HelloRequest']={protocolVersion:3,nodeId:'node-c',bootId:'boot',agentBuild:'test',capabilities:[...facts.capabilities],lastStoredSnapshotGeneration:0};
    return {host,relay,db,events,effects,failure,state,deployments,store,nodes,ledger,hello,clear(){events.length=0;effects.length=0;state.transaction=0;}};
}
const names=(f:ReturnType<typeof fixture>)=>f.events.map(e=>e.name);

test('4/11 actual Relay historical closure reaches a fixed point across reverse/cyclic/withdrawn links and sorted locks include all old Nodes',async()=>{
    const f=fixture();await f.db.transaction(async tx=>{
        assert.deepEqual(await f.relay.relatedNodeIDs(tx,'node-c'),['node-a','node-b','node-c','node-d']);
        assert.deepEqual(await f.relay.relatedNodeIDs(tx,'node-z'),['node-z']);
        const forward={id:'forward',spec:{ingress:{nodeId:'new-ingress'},path:{via:['new-egress','node-b']}}} as never;
        assert.deepEqual(await f.relay.nodeIDs(tx,forward),['new-egress','new-ingress','node-a','node-b','node-c','node-d']);
        await f.relay.lockNodes(tx,forward);
    });
    assert.deepEqual(f.events.filter(e=>e.name==='relay-lock').map(e=>e.args),[['new-egress'],['new-ingress'],['node-a'],['node-b'],['node-c'],['node-d']]);
    assert.ok(f.events.every(e=>e.tx===f.events[0]!.tx));assert.equal(f.effects.length,0);
});

test('4 actual Runtime Hello takes complete transitive Node locks before any target credential/facts/boot read',async()=>{
    const f=fixture();const response=await f.host.hello('node-c',f.hello,'fingerprint');assert.equal(response.sessionEpoch,2);
    assert.deepEqual(names(f),['begin','allDeployments','lock','lock','lock','lock','credential','facts','boot','commit']);
    assert.deepEqual(f.events.filter(e=>e.name==='lock').map(e=>e.args),[['node-a'],['node-b'],['node-c'],['node-d']]);assert.equal(f.effects.length,0);
    for(const mode of ['missing','epoch'] as const){const g=fixture();if(mode==='missing')g.state.missing='node-c';else g.state.epoch=3;
        await assert.rejects(g.host.snapshot('node-c',2),{code:'SESSION_SUPERSEDED'});assert.deepEqual(names(g),['begin','allDeployments','lock','lock','lock','lock','rollback']);assert.equal(g.effects.length,0);}
});

test('4/11 malformed unrelated historical plan aborts complete closure before locks and preserves original decode/getter errors',async()=>{
    for(const kind of ['digest','json'] as const){const f=fixture();f.deployments.at(-1)!.body=kind==='digest'?JSON.stringify({forwardId:'other',nodes:[],planDigest:'wrong'}):'{';
        await assert.rejects(f.host.hello('node-c',f.hello),kind==='digest'?{code:'INTEGRITY_FAILURE'}:SyntaxError);assert.deepEqual(names(f),['begin','allDeployments','rollback']);}
    const f=fixture();Object.defineProperty(f.deployments[0]!,'body',{get(){throw f.failure;}});await assert.rejects(f.host.hello('node-c',f.hello),e=>e===f.failure);assert.deepEqual(names(f),['begin','allDeployments','rollback']);
});

test('4/11 pending Nodes retain ingress priority lexical ties historical/lease membership and cleanup dedup order across separate original transactions',async()=>{
    const f=fixture();f.state.pending=[deployment('bc',['node-b','node-c'],7,'node-b'),deployment('ab',['node-a','node-b'],8,'node-a')];
    await f.db.transaction(async tx=>assert.deepEqual(await f.relay.pendingNodeIDs(tx),['node-a','node-b','lease-only','node-c']));
    assert.deepEqual(names(f),['begin','pendingDeployments','leaseNodes','leaseNodes','commit']);f.clear();f.state.epoch=0;
    await f.host.tick();
    const transactions=new Map<number,Event[]>();for(const event of f.events)if(event.tx){const rows=transactions.get(event.tx.id)??[];rows.push(event);transactions.set(event.tx.id,rows);}
    assert.equal(f.events[0]!.name,'cleanup');assert.deepEqual([...transactions.values()][0]!.map(e=>e.name),['begin','pendingDeployments','leaseNodes','leaseNodes','commit']);
    const processed=[...transactions.values()].filter(rows=>rows.some(e=>e.name==='complete'));
    assert.deepEqual(processed.map(rows=>rows.find(e=>e.name==='complete')!.args[0]),['node-a','node-b','lease-only','node-c','cleanup-only']);
    for(const rows of processed){const target=String(rows.find(e=>e.name==='complete')!.args[0]);const expected=['node-a','node-b','node-c','node-d'].includes(target)?['node-a','node-b','node-c','node-d']:[target];
        assert.deepEqual(rows.filter(e=>e.name==='lock').map(e=>e.args[0]),expected);assert.deepEqual(rows.slice(-3).map(e=>e.name),['complete','forwardIDs','commit']);assert.equal(rows.some(e=>e.name==='save'),false);}
    assert.deepEqual([...transactions.values()].at(-1)!.map(e=>e.name),['begin','claim','commit']);
});

test('4 publication and cleanup retain same closure transaction through authority save leases complete and fail atomically at every provider',async()=>{
    const success=fixture();await success.host.snapshot('node-c',2,'fingerprint');
    const expected=['begin','allDeployments','lock','lock','lock','lock','state','credential','snapshot','awaiting','forwardIDs','assignments','payload-policy','retire','tombstones','verify','authority','save','leases','complete','commit'];
    assert.deepEqual(names(success),expected);assert.ok(success.events.every(e=>e.tx===success.events[0]!.tx));
    for(const step of ['allDeployments','lock','state','credential','snapshot','awaiting','forwardIDs','assignments','payload-policy','retire','tombstones','verify','authority','save','leases','complete']){
        const f=fixture();f.state.fail=step;await assert.rejects(f.host.snapshot('node-c',2,'fingerprint'),e=>e===f.failure);assert.equal(f.events.at(-1)!.name,'rollback');assert.deepEqual(f.effects,[]);assert.deepEqual(names(f).slice(0,-1),expected.slice(0,expected.indexOf(step)+1),step);
    }
});

test('4 report locks full closure before drain and report writes and keeps advancement inside same transaction',async()=>{
    const f=fixture(),report={protocolVersion:3,nodeId:'node-c',bootId:'boot',sessionEpoch:2,reportSequence:1,observedAt:new Date(f.state.now).toISOString(),acceptedSnapshotGeneration:0,observations:[],drains:[]} as RuntimeMessages['ReportRequest'];
    await f.host.report('node-c',2,report,'fingerprint');assert.deepEqual(names(f),['begin','allDeployments','lock','lock','lock','lock','credential','facts','reportDigest','drains','saveReport','forwardIDs','commit']);
    for(const step of ['drains','saveReport','forwardIDs']){const g=fixture();g.state.fail=step;await assert.rejects(g.host.report('node-c',2,report,'fingerprint'),e=>e===g.failure);assert.deepEqual(g.effects,[]);assert.equal(g.events.at(-1)!.name,'rollback');}
});
