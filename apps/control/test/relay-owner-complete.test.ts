import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import type { RuntimeSnapshot } from '@tunex/contracts/runtime';
import type { Observation } from '@tunex/contracts/execution-observation';
import { RuntimeRelayHost, RuntimeLedgerHost, ControlError, RELAY_FORWARD_ASSIGNMENTS_INTERFACE_VERSION, RELAY_NODE_ASSIGNMENTS_INTERFACE_VERSION } from '../src/framework/public.ts';
import type { RuntimeOperation, RuntimeRelayDeployment, RuntimeLedgerOptions, RuntimeRelayOptions, RelayForwardAssignmentReader, RelayNodeAssignmentReader } from '../src/framework/public.ts';
import { nativeRelayCompiler, nativeLedgerCompiler } from '../src/compatibility/public.ts';
import type { NativeRuntimeFamily } from '../src/compatibility/public.ts';
import { RuntimeLedger } from '../src/modules/runtime/ledger.ts';
import { MySqlRuntimeLedgerStore } from '../src/infrastructure/mysql-runtime-ledger.ts';
import { MySqlRelayDeploymentStore } from '../src/infrastructure/mysql-runtime-relay.ts';
import { MySqlUnitOfWork, rows, write, json } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { multihopFixture } from './fixtures/multihop.ts';

type Tx={marker:symbol};
type Event={name:string;args:unknown[]};
const bindings=(value:unknown)=>value as Record<string,any>;
function fixture(){
    const input=multihopFixture(),plan=nativeRelayCompiler.multihopPlan(input),tx:Tx={marker:Symbol()},events:Event[]=[];
    const forward={...input.forward,deleting:false,recoverySuspended:false};
    const op:RuntimeOperation={id:'original-operation',scope_id:forward.scopeId,forward_id:forward.id,target_revision:1,kind:'create',status:'running',
        execution_deadline:Date.parse(input.issuedAt)+600000,claim_token:'claim',claim_until:17,cleanup_pending:1,last_error:null,
        source_operation_id:null,previous_spec:null,created_at:1,requested_by:'actor-a',recovery_invalidated:0};
    const record:RuntimeRelayDeployment={forward_id:forward.id,generation:9,target_revision:1,ingress_node_id:plan.nodes[0]!.nodeId,
        egress_node_id:plan.nodes.at(-1)!.nodeId,body:JSON.stringify(plan),stage:'active',prepared_count:3,activated_count:3};
    const state={now:Date.parse(input.issuedAt)+1000,fail:'',pending:0,unsafe:0,previousSafe:true,missing:false,actor:'actor-a',leasesLive:false,currentPins:true,deniedPorts:new Set<number>()};
    const failure=new Error('original Relay provider error');
    function called(self:unknown,owner:unknown,name:string,args:unknown[],transaction=true){assert.equal(self,owner);if(transaction)assert.equal(args[0],tx);events.push({name,args});if(state.fail===name)throw failure;}
    const store={async latest(this:unknown,...args:unknown[]){called(this,store,'latest',args);return state.missing?undefined:record;},
        async forForward(this:unknown,...args:unknown[]){called(this,store,'forForward',args);return [record];},
        async touch(this:unknown,...args:unknown[]){called(this,store,'touch',args);},
        async withdraw(this:unknown,...args:unknown[]){called(this,store,'withdraw',args);},
        async setStage(this:unknown,...args:unknown[]){called(this,store,'setStage',args);},
        async setPreparation(this:unknown,...args:unknown[]){called(this,store,'setPreparation',args);},
        async incrementActivation(this:unknown,...args:unknown[]){called(this,store,'incrementActivation',args);},
        async activate(this:unknown,...args:unknown[]){called(this,store,'activate',args);},
        async quarantine(this:unknown,...args:unknown[]){called(this,store,'quarantine',args);},
        async forNode(this:unknown,...args:unknown[]){called(this,store,'forNode',args);return [record];},
    };
    const ledger={async latest(this:unknown,...args:unknown[]){called(this,ledger,'operation',args);return op;},
        async accept(this:unknown,...args:unknown[]){called(this,ledger,'accept',args);return 'incident-operation';},
        async recordRelayError(this:unknown,...args:unknown[]){called(this,ledger,'recordError',args);},
        async failRelayOperation(this:unknown,...args:unknown[]){called(this,ledger,'fail',args);},
        async succeedRelayOperation(this:unknown,...args:unknown[]){called(this,ledger,'succeed',args);},
        async clearTerminalRelayCleanup(this:unknown,...args:unknown[]){called(this,ledger,'clear',args);},
        async previousLeasesSafe(this:unknown,...args:unknown[]){called(this,ledger,'previousSafe',args);return state.previousSafe;},
        async retainSlots(this:unknown,...args:unknown[]){called(this,ledger,'retain',args);},
        async releaseForwardSlots(this:unknown,...args:unknown[]){called(this,ledger,'release',args);},
        async sessionAuthoritySafe(this:unknown,...args:unknown[]){called(this,ledger,'sessionSafe',args);return true;},
    };
    const forwards={async record(this:unknown,...args:unknown[]){called(this,forwards,'forward',args);return forward;},
        async authorizer(this:unknown,...args:unknown[]){called(this,forwards,'authorizer',args);return state.actor;}};
    const nodes={async reservationPorts(this:unknown,current:Tx,actor:string,scope:string,nodeId:string,ports:readonly number[]){assert.equal(this,nodes);assert.equal(current,tx);assert.equal(actor,state.actor);assert.equal(scope,forward.scopeId);const allowed=input.endpoints.find(endpoint=>endpoint.nodeId===nodeId)!.config.allowedTcpPorts;return ports.filter(port=>allowed.includes(port)&&!state.deniedPorts.has(port));},async authorizedRelayNode(this:unknown,...args:unknown[]){called(this,nodes,'authorizedNode',args);return input.nodes.find(n=>n.facts.nodeId===args[3])!.facts;},
        async facts(this:unknown,...args:unknown[]){called(this,nodes,'facts',args);const node=input.nodes.find(n=>n.facts.nodeId===args[1])!;return {facts:node.facts,credentialUntil:node.credentialUntil};},
        async relayCredentialFacts(this:unknown,...args:unknown[]){called(this,nodes,'peers',args);const peers=input.nodes.find(n=>n.facts.nodeId===args[1])!.peers;
            return args[2]===true&&!state.currentPins?[{fingerprint:'sha256:'+'e'.repeat(64),validUntil:state.now+3600000}]:peers;}};
    const transport={async resolve(this:unknown,...args:unknown[]){called(this,transport,'profile',args);return input.profile;}};
    const endpoints={async resolve(this:unknown,...args:unknown[]){called(this,endpoints,'endpoint',args);return input.endpoints.find(e=>e.nodeId===args[1])!;}};
    const snapshots=new Map(plan.nodes.map(node=>[node.nodeId,{nodeId:node.nodeId,sessionEpoch:node.sessionEpoch,snapshotGeneration:1,
        validUntil:new Date(state.now+60000).toISOString(),assignments:node.assignments.map(a=>({...a,phase:'active'}))}]));
    const runtimes=new Map(plan.nodes.map(node=>[node.nodeId,{session_epoch:node.sessionEpoch,snapshot_generation:1,received_at:state.now,
        last_report:JSON.stringify({sessionEpoch:node.sessionEpoch,acceptedSnapshotGeneration:1,observations:node.assignments.map(a=>({assignmentId:a.assignmentId,
            deploymentGeneration:a.deploymentGeneration,bindingFence:a.bindingFence,phase:'active',condition:'ready'}))})}]));
    const observations={async nodeSession(this:unknown,...args:unknown[]){called(this,observations,'session',args);return {session_epoch:input.nodes.find(n=>n.facts.nodeId===args[1])!.sessionEpoch};},
        async runtimeNode(this:unknown,...args:unknown[]){called(this,observations,'runtime',args);return runtimes.get(String(args[1]));},
        async snapshot(this:unknown,...args:unknown[]){called(this,observations,'snapshot',args);return {body:JSON.stringify(snapshots.get(String(args[1])))};},
        async latestSnapshot(this:unknown,...args:unknown[]){called(this,observations,'latestSnapshot',args);return state.leasesLive?{valid_until:state.now+1000,body:JSON.stringify(snapshots.get(String(args[1])))}:undefined;},
        async pendingRetirementCount(this:unknown,...args:unknown[]){called(this,observations,'pending',args);return state.pending;},
        async unsafeLeaseCount(this:unknown,...args:unknown[]){called(this,observations,'unsafe',args);return state.unsafe;},
        async isolation(this:unknown,...args:unknown[]){called(this,observations,'isolation',args);return [];},
    };
    const host=new RuntimeRelayHost({nodes,forwards,transport,endpoints,ledger,policy:DEFAULT_POLICY,multihopEnabled:true,store,observations,
        compiler:nativeRelayCompiler,now:()=>{events.push({name:'now',args:[state.now]});return state.now;}} as unknown as RuntimeRelayOptions<Tx,NativeRuntimeFamily>);
    const snapshot=snapshots.get(plan.nodes[0]!.nodeId)! as unknown as RuntimeSnapshot;
    const assignment=plan.nodes[0]!.assignments[0]!;
    const observation:Observation={assignmentId:assignment.assignmentId,deploymentGeneration:assignment.deploymentGeneration,bindingFence:assignment.bindingFence,
        phase:'active',condition:'error',errorCode:'AUTHENTICATION_FAILED',retryable:false};
    return {host,input,plan,tx,events,forward,op,record,state,failure,snapshot,assignment,observation,snapshots,runtimes,store,ledger,forwards,nodes};
}
const names=(f:ReturnType<typeof fixture>)=>f.events.map(e=>e.name);

test('P Relay Node Snapshot read retains legacy projections but consumes one locked multihop input per plan',async()=>{
    assert.equal(RELAY_NODE_ASSIGNMENTS_INTERFACE_VERSION,1);
    for(const stage of ['preparing','egress_active','ingress_active','active','withdrawn'] as const)
        for(const includeAccepted of [false,true])for(const status of ['running','accepted','succeeded'] as const){
            const current=fixture(),legacy=fixture(),node=current.plan.nodes[0]!.nodeId;
            for(const f of [current,legacy]){f.record.stage=stage;f.record.prepared_count=1;f.record.activated_count=1;f.op.status=status;}
            const reader:RelayNodeAssignmentReader<Tx,NativeRuntimeFamily>=current.host;
            const actual=await reader.assignmentsForNode(current.tx,node,includeAccepted);
            const expected=await legacy.host.assignments(legacy.tx,node,includeAccepted);
            assert.deepEqual(actual,expected);
            const reads=stage==='withdrawn'||status==='accepted'&&!includeAccepted?0:current.plan.nodes.length;
            assert.equal(names(current).filter(name=>name==='authorizedNode').length,reads);
            assert.equal(names(legacy).filter(name=>name==='authorizedNode').length,2*reads);
            assert.equal(names(current).filter(name=>name==='forNode').length,1);
            assert.equal(names(current).includes('latest'),false);
            assert.equal(names(current).some(name=>['accept','touch','withdraw','succeed','fail'].includes(name)),false);
        }
    for(const includeAccepted of [false,true])for(const nodeIndex of [0,1,2]){
        const current=fixture(),legacy=fixture(),node=current.plan.nodes[nodeIndex]!.nodeId;
        for(const f of [current,legacy]){f.record.stage='preparing';f.record.prepared_count=1;f.record.activated_count=1;}
        assert.deepEqual(await current.host.assignmentsForNode(current.tx,node,includeAccepted),await legacy.host.assignments(legacy.tx,node,includeAccepted));
    }
    const fresh=fixture(),node=fresh.plan.nodes[0]!.nodeId;
    assert.ok((await fresh.host.assignmentsForNode(fresh.tx,node)).length>0);
    fresh.state.currentPins=false;
    assert.deepEqual(await fresh.host.assignmentsForNode(fresh.tx,node),[],'another call must read current authority again');
    const customized=fixture(),original=customized.host.canExecute;let calls=0;
    customized.host.canExecute=async function(this:RuntimeRelayHost<Tx,NativeRuntimeFamily>,...args:Parameters<typeof original>){
        assert.equal(this,customized.host);calls++;return original.apply(this,args);
    };
    assert.ok((await customized.host.assignmentsForNode(customized.tx,node)).length>0);
    assert.equal(calls,1);assert.equal(names(customized).filter(name=>name==='authorizedNode').length,2*customized.plan.nodes.length);
    const denied=fixture();denied.host.canExecute=async()=>false;
    assert.deepEqual(await denied.host.assignmentsForNode(denied.tx,node),[]);
    const failed=fixture();failed.host.canExecute=async()=>{throw failed.failure;};
    await assert.rejects(()=>failed.host.assignmentsForNode(failed.tx,node),error=>error===failed.failure);
});

test('P Relay Node Snapshot read rejects unknown inputs, preserves original refusals and never falls back after failure',async()=>{
    for(const node of ['', 'bad id',null,17]){
        const f=fixture();await assert.rejects(()=>f.host.assignmentsForNode(f.tx,node as never),{code:'INVALID_CONFIG',status:422});assert.deepEqual(f.events,[]);
    }
    for(const flag of ['true',null,0,{}]){
        const f=fixture();await assert.rejects(()=>f.host.assignmentsForNode(f.tx,f.plan.nodes[0]!.nodeId,flag as never),{code:'INVALID_CONFIG',status:422});assert.deepEqual(f.events,[]);
    }
    for(const mode of ['deleted','suspended','revoke','failed','changed-pins','blocked-resource']){
        const f=fixture();
        if(mode==='deleted')f.forward.deleting=true;if(mode==='suspended')f.forward.recoverySuspended=true;
        if(mode==='revoke')f.op.kind='revoke';if(mode==='failed')f.op.status='failed';if(mode==='changed-pins')f.state.currentPins=false;
        if(mode==='blocked-resource')for(const endpoint of f.input.endpoints)for(const port of endpoint.config.allowedTcpPorts)f.state.deniedPorts.add(port);
        assert.deepEqual(await f.host.assignmentsForNode(f.tx,f.plan.nodes[0]!.nodeId),[]);
    }
    const unsafe=fixture();unsafe.ledger.sessionAuthoritySafe=async()=>false;
    assert.deepEqual(await unsafe.host.assignmentsForNode(unsafe.tx,unsafe.plan.nodes[0]!.nodeId),[]);
    const empty=fixture(),read=empty.store.forNode;
    empty.store.forNode=async function(...args){await read.apply(this,args);return [];};
    assert.deepEqual(await empty.host.assignmentsForNode(empty.tx,empty.plan.nodes[0]!.nodeId),[]);
    for(const name of ['forNode','operation','forward','authorizer','authorizedNode','facts','peers','profile','endpoint','sessionSafe']){
        const f=fixture();f.state.fail=name;
        await assert.rejects(()=>f.host.assignmentsForNode(f.tx,f.plan.nodes[0]!.nodeId),error=>error===f.failure);
        assert.equal(names(f).filter(event=>event==='forNode').length,1);
    }
    const refused=fixture();refused.nodes.authorizedRelayNode=async()=>{throw new ControlError('AUTHORIZATION_DENIED',403,'withdrawn');};
    assert.deepEqual(await refused.host.assignmentsForNode(refused.tx,refused.plan.nodes[0]!.nodeId),[]);
    const deniedPort=fixture(),ports=deniedPort.nodes.reservationPorts;
    deniedPort.nodes.reservationPorts=async function(...args){await ports.apply(this,args);throw deniedPort.failure;};
    await assert.rejects(()=>deniedPort.host.assignmentsForNode(deniedPort.tx,deniedPort.plan.nodes[0]!.nodeId),error=>error===deniedPort.failure);
    for(const mode of ['foreign-record','stale-revision','corrupt-plan']){
        const f=fixture();if(mode==='foreign-record')f.record.forward_id='other';if(mode==='stale-revision')f.record.target_revision++;if(mode==='corrupt-plan')f.record.body='{}';
        await assert.rejects(()=>f.host.assignmentsForNode(f.tx,f.plan.nodes[0]!.nodeId),{code:'INTEGRITY_FAILURE'});
    }
});

test('P Relay Forward read shares original node projections while authorizing one current plan on the caller transaction',async()=>{
    assert.equal(RELAY_FORWARD_ASSIGNMENTS_INTERFACE_VERSION,1);
    for(const stage of ['preparing','egress_active','ingress_active','active','withdrawn'] as const){
        const f=fixture();f.record.stage=stage;f.record.prepared_count=1;f.record.activated_count=1;
        const reader:RelayForwardAssignmentReader<Tx,NativeRuntimeFamily>=f.host;
        const result=await reader.assignmentsForForward(f.tx,f.forward.id);
        assert.equal(names(f).filter(name=>name==='operation').length,1);
        assert.equal(names(f).includes('forNode'),false);
        if(stage==='withdrawn'){assert.deepEqual(result,[]);continue;}
        assert.equal(names(f).filter(name=>name==='authorizedNode').length,f.plan.nodes.length);
        assert.deepEqual(result.map(part=>part.nodeId),f.plan.nodes.map(node=>node.nodeId));
        assert.equal(names(f).filter(name=>name==='sessionSafe').length,f.plan.nodes.length);
        for(const part of result){
            assert.deepEqual(part.assignments,await f.host.assignments(f.tx,part.nodeId));
            assert.notEqual(part.assignments,f.plan.nodes.find(node=>node.nodeId===part.nodeId)!.assignments);
        }
        assert.equal(names(f).some(name=>['accept','touch','withdraw','succeed','fail'].includes(name)),false);
    }
});

test('P Relay Forward read preserves current authority refusal, per-node session safety and original failures',async()=>{
    for(const mode of ['missing','deleted','suspended','stale-revision','revoke','failed','changed-pins','foreign-record','corrupt-plan']){
        const f=fixture();
        if(mode==='missing')f.state.missing=true;
        if(mode==='deleted')f.forward.deleting=true;
        if(mode==='suspended')f.forward.recoverySuspended=true;
        if(mode==='stale-revision')f.record.target_revision++;
        if(mode==='revoke')f.op.kind='revoke';
        if(mode==='failed')f.op.status='failed';
        if(mode==='changed-pins')f.state.currentPins=false;
        if(mode==='foreign-record')f.record.forward_id='other-forward';
        if(mode==='corrupt-plan')f.record.body='{}';
        if(['stale-revision','foreign-record','corrupt-plan'].includes(mode))await assert.rejects(()=>f.host.assignmentsForForward(f.tx,f.forward.id));
        else assert.deepEqual(await f.host.assignmentsForForward(f.tx,f.forward.id),[]);
    }
    const unsafe=fixture(),denied=unsafe.plan.nodes[1]!.nodeId,original=unsafe.ledger.sessionAuthoritySafe;
    unsafe.ledger.sessionAuthoritySafe=async function(...args){const accepted=await original.apply(this,args);return args[1]===denied?false:accepted;};
    const grouped=await unsafe.host.assignmentsForForward(unsafe.tx,unsafe.forward.id);
    assert.deepEqual(grouped.find(part=>part.nodeId===denied)!.assignments,[]);
    assert.ok(grouped.filter(part=>part.nodeId!==denied).every(part=>part.assignments.length>0));
    for(const name of ['latest','operation','forward','authorizer','authorizedNode','facts','profile','endpoint','sessionSafe']){
        const f=fixture();f.state.fail=name;
        await assert.rejects(()=>f.host.assignmentsForForward(f.tx,f.forward.id),error=>error===f.failure);
    }
});

test('9 Relay ledger command providers sample original one one two one clock boundaries preserve receiver error and caller Tx',async()=>{
    const tx={},trace:unknown[][]=[],error={code:'AUTHENTICATION_FAILED',retryable:false,detail:{unchanged:true}};
    const store=Object.fromEntries(['recordRelayError','failRelayOperation','succeedRelayOperation','clearTerminalRelayCleanup'].map(name=>[name,function(this:unknown,...args:unknown[]){assert.equal(this,store);assert.equal(args[0],tx);trace.push([name,...args]);return Promise.resolve();}]));
    let at=100;
    const ledger=new RuntimeLedgerHost({assignments:{merge:async()=>[]},compiler:nativeLedgerCompiler,store,policy:DEFAULT_POLICY,now:()=>{trace.push(['now',at]);return at++;}} as unknown as RuntimeLedgerOptions<object,NativeRuntimeFamily>);
    await ledger.recordRelayError(tx,'operation',error);await ledger.failRelayOperation(tx,'operation',error);await ledger.succeedRelayOperation(tx,'operation');await ledger.clearTerminalRelayCleanup(tx,'forward');
    assert.deepEqual(trace,[['now',100],['recordRelayError',tx,'operation',error,100],['now',101],['failRelayOperation',tx,'operation',error,101],
        ['now',102],['now',103],['succeedRelayOperation',tx,'operation',102,103],['now',104],['clearTerminalRelayCleanup',tx,'forward',104]]);
    const failure=new Error('original storage error');store.failRelayOperation=function(){assert.equal(this,store);throw failure;};
    assert.throws(()=>ledger.failRelayOperation(tx,'operation',error),value=>value===failure);assert.equal(at,106);
});

test('9 Relay execution error keeps detail retryability successful history exact operation request and no extra clock transaction or connection',async()=>{
    for(const status of ['running','succeeded'] as const)for(const retryable of [false,true]){
        const f=fixture();f.op.status=status;f.observation.retryable=retryable;
        await f.host.executionError(f.tx,f.snapshot,f.assignment,f.observation);
        const error={code:'AUTHENTICATION_FAILED',retryable,nodeId:f.snapshot.nodeId,sessionEpoch:f.snapshot.sessionEpoch,
            assignmentId:f.assignment.assignmentId,deploymentGeneration:f.assignment.deploymentGeneration,bindingFence:f.assignment.bindingFence};
        const expected=['latest','operation','forward',...(retryable?(status==='running'?['recordError']:[]):[...(status==='succeeded'?['accept']:[]),'fail','now','withdraw'])];
        assert.deepEqual(names(f),expected);assert.equal(f.op.status,status,'host never rewrites successful historical object');
        const effect=f.events.find(e=>e.name===(retryable?'recordError':'fail'));
        if(effect){assert.deepEqual(effect.args,[f.tx,status==='succeeded'?'incident-operation':f.op.id,error]);assert.equal((effect.args[2] as Record<string,unknown>).code,f.observation.errorCode);}
        if(status==='succeeded'&&!retryable){const event=f.events.find(e=>e.name==='accept')!;
            assert.deepEqual(event.args,[f.tx,f.forward,{actorId:f.op.requested_by,scopeId:f.op.scope_id,key:'multihop-error:9',
                digest:nativeRelayCompiler.digest({sourceOperationId:f.op.id,...error})},'policy',f.forward.spec,f.op.id]);}
        if(!retryable)assert.deepEqual(f.events.at(-1)!.args,[f.tx,f.forward.id,9,f.state.now]);
    }
});

test('9 Relay error refusals leave operation and deployment untouched and each provider failure stops exact subsequent work',async()=>{
    const cases:Array<(f:ReturnType<typeof fixture>)=>void>=[
        f=>{f.observation.condition='ready';},f=>{f.assignment={...f.assignment,role:'direct'};},f=>{f.observation.assignmentId='old';},
        f=>{f.observation.deploymentGeneration++;},f=>{f.observation.bindingFence++;},f=>{f.state.missing=true;},
        f=>{f.record.stage='withdrawn';},f=>{f.snapshot={...f.snapshot,sessionEpoch:999};},f=>{f.assignment={...f.assignment,driver:{...f.assignment.driver,configDigest:'sha256:'+'f'.repeat(64)}};},
        f=>{f.op.recovery_invalidated=1;},f=>{f.op.target_revision++;},f=>{f.op.kind='revoke';},f=>{f.op.status='accepted';},f=>{f.op.status='failed';},f=>{f.op.status='superseded';},
        f=>{f.forward.deleting=true;},f=>{f.forward.recoverySuspended=true;},f=>{f.forward.spec={...f.forward.spec,enabled:false};},f=>{f.forward.revision++;},
    ];
    for(const mutate of cases){const f=fixture();mutate(f);await f.host.executionError(f.tx,f.snapshot,f.assignment,f.observation);
        assert.ok(!names(f).some(name=>['accept','recordError','fail','withdraw','now'].includes(name)));}
    for(const step of ['latest','operation','forward','accept','fail','withdraw']){
        const f=fixture();f.op.status='succeeded';f.state.fail=step;
        await assert.rejects(f.host.executionError(f.tx,f.snapshot,f.assignment,f.observation),error=>error===f.failure);
        const expected=['latest','operation','forward','accept','fail','now','withdraw'];assert.deepEqual(names(f),expected.slice(0,expected.indexOf(step)+1));
    }
});

test('9 Relay complete keeps exact running deadline status claim cleanup selection and separate clock boundaries',async()=>{
    // Exercise the unchanged private decision through its existing binding; no production test hook or public contract change.
    for(const status of ['accepted','running','succeeded','failed','superseded'] as const)for(const offset of [-1,0,1])for(const stopped of [false,true]){
        const f=fixture();f.op.status=status;f.op.execution_deadline=f.state.now+offset;if(stopped)f.forward.spec={...f.forward.spec,enabled:false};
        await bindings(f.host).complete(f.tx,{...f.record,stage:stopped?'withdrawn':'active'},f.forward,f.op,f.plan);
        const trace=names(f),succeed=status==='running'&&offset>0;
        assert.equal(trace.includes('succeed'),succeed);assert.equal(trace.includes('clear'),status==='succeeded'||stopped);
        assert.equal(trace.filter(name=>name==='now').length,stopped?(status==='running'?1:0):6+(status==='running'?1:0));
        if(succeed)assert.deepEqual(f.events.find(e=>e.name==='succeed')!.args,[f.tx,f.op.id]);
        if(trace.includes('clear'))assert.deepEqual(f.events.find(e=>e.name==='clear')!.args,[f.tx,f.forward.id]);
        assert.equal(f.op.claim_token,'claim','claim writes belong to ledger store');assert.equal(f.op.claim_until,17);
        assert.equal(trace.includes('retain'),!stopped);assert.equal(trace.includes('release'),false);
    }
    for(const mode of ['pending','unsafe','live','delete','revoke','withdrawn-enabled','previous-unsafe','not-active','not-ready']){
        const f=fixture();const record={...f.record};
        if(mode==='pending')f.state.pending=1;
        if(mode==='unsafe'){f.forward.spec={...f.forward.spec,enabled:false};f.state.unsafe=1;record.stage='withdrawn';}
        if(mode==='live'){f.forward.spec={...f.forward.spec,enabled:false};f.state.leasesLive=true;record.stage='withdrawn';}
        if(mode==='delete')f.forward.deleting=true;
        if(mode==='revoke')f.op.kind='revoke';
        if(mode==='withdrawn-enabled')record.stage='withdrawn';
        if(mode==='previous-unsafe')f.state.previousSafe=false;
        if(mode==='not-active')record.stage='preparing';
        if(mode==='not-ready')f.runtimes.get(f.plan.nodes[0]!.nodeId)!.received_at=0;
        await bindings(f.host).complete(f.tx,record,f.forward,f.op,f.plan);
        const trace=names(f);assert.equal(trace.includes('succeed'),mode==='delete'||mode==='revoke');
        assert.equal(trace.includes('clear'),['delete','revoke','withdrawn-enabled'].includes(mode));assert.equal(trace.includes('release'),mode==='delete');
        if(mode==='pending')assert.deepEqual(trace,['pending']);
        if(mode==='unsafe')assert.ok(trace.includes('unsafe')&&!trace.includes('release'));
        if(mode==='live')assert.ok(!trace.includes('unsafe'));
    }
});

test('9 Relay advance preserves terminal eligibility touch before state refusal and stopped cleanup on the same supplied Tx',async()=>{
    for(const status of ['accepted','running','succeeded','failed','superseded'] as const)for(const cleanup of [0,1]){
        const f=fixture();f.op.status=status;f.op.cleanup_pending=cleanup;f.forward.spec={...f.forward.spec,enabled:false};
        await f.host.advance(f.tx,f.forward.id);
        const eligible=status==='running'||status==='succeeded'||status==='failed'&&cleanup===1;
        assert.deepEqual(names(f).slice(0,5),['latest','operation','now','touch','forward']);
        assert.equal(names(f).includes('withdraw'),eligible);assert.equal(names(f).includes('pending'),eligible);
        assert.equal(names(f).filter(name=>name==='now').length,1+(eligible?1:0)+(status==='running'?1:0));
        assert.deepEqual(f.events.find(e=>e.name==='latest')!.args,[f.tx,f.forward.id,true]);
    }
    const missing=fixture();missing.state.missing=true;await missing.host.advance(missing.tx,missing.forward.id);assert.deepEqual(names(missing),['latest','operation']);
    const recovery=fixture();recovery.op.recovery_invalidated=1;await recovery.host.advance(recovery.tx,recovery.forward.id);assert.deepEqual(names(recovery),['latest','operation']);
});

test('9 Relay native store command SQL keeps error JSON property order claim clearing exact status deadline and terminal predicates',async()=>{
    const calls:unknown[][]=[],tx={async execute(this:unknown,...args:unknown[]){assert.equal(this,tx);calls.push(args);return [{affectedRows:1},[]];}} as unknown as Transaction;
    const store=new MySqlRuntimeLedgerStore(),error={code:'AUTHENTICATION_FAILED',retryable:false,nodeId:'node-a',detail:{original:true}};
    await store.recordRelayError(tx,'op',error,1);await store.failRelayOperation(tx,'op',error,2);await store.succeedRelayOperation(tx,'op',3,4);await store.clearTerminalRelayCleanup(tx,'forward',5);
    assert.deepEqual(calls,[['UPDATE operations SET last_error=?,updated_at=? WHERE id=?',[JSON.stringify(error),1,'op']],
        ["UPDATE operations SET status='failed',last_error=?,cleanup_pending=TRUE,claim_token=NULL,claim_until=NULL,updated_at=? WHERE id=?",[JSON.stringify(error),2,'op']],
        ["UPDATE operations SET status='succeeded',cleanup_pending=FALSE,claim_token=NULL,claim_until=NULL,updated_at=? WHERE id=? AND status='running' AND execution_deadline>?",[3,'op',4]],
        ["UPDATE operations SET cleanup_pending=FALSE,updated_at=? WHERE forward_id=? AND status IN ('succeeded','failed','superseded')",[5,'forward']]]);
    const failure=new Error('JSON error');const poison={toJSON(){throw failure;}};await assert.rejects(store.failRelayOperation(tx,'op',poison,6),error=>error===failure);assert.equal(calls.length,4);
});

test('9/11 Relay status retains terminal source error and fresh physical evidence while current pins differ from still-issued retiring authority',async()=>{
    for(const status of ['running','succeeded','failed'] as const){
        const f=fixture();f.op.status=status;f.op.source_operation_id='successful-source';f.op.last_error=JSON.stringify({code:'AUTHENTICATION_FAILED',retryable:false,detail:'original'});
        const result=await f.host.status(f.tx,f.forward);
        assert.deepEqual(result?.operation,{id:f.op.id,status,sourceOperationId:'successful-source',lastError:{code:'AUTHENTICATION_FAILED',retryable:false,detail:'original'}});
        assert.equal(result?.renewalAllowed,status!=='failed');assert.equal(result?.trafficVerified,false);assert.equal(result?.stage,'active');
        assert.deepEqual(result?.activationOrder,[...f.plan.nodes].reverse().map(n=>n.nodeId));assert.equal(result?.authorizationUntil,new Date(f.plan.authorizationUntil).toISOString());
        assert.ok(result?.nodes.every(n=>n.reportFresh&&n.ready===(status!=='failed')&&!n.prepared&&n.observations.length===f.plan.nodes.find(p=>p.nodeId===n.nodeId)!.assignments.length));
        assert.ok(!names(f).some(name=>['accept','fail','recordError','withdraw','touch'].includes(name)));
    }
    const f=fixture();f.state.currentPins=false;
    assert.equal((await f.host.status(f.tx,f.forward))?.renewalAllowed,false);
    assert.ok(f.events.filter(e=>e.name==='peers').every(e=>e.args[2]===true),'new authority sees current credentials only');
    f.events.length=0;
    assert.equal(await f.host.authorizationBound(f.tx,[...f.plan.nodes[0]!.assignments,...f.plan.nodes[1]!.assignments]),f.plan.authorizationUntil);
    assert.deepEqual(names(f),['latest','facts','peers','facts','peers','facts','peers']);
    assert.ok(f.events.filter(e=>e.name==='peers').every(e=>e.args.length===2),'issued authority may still use pinned retiring credentials');
    f.input.nodes[0]!.peers=[];
    await assert.rejects(f.host.authorizationBound(f.tx,f.plan.nodes[0]!.assignments),{code:'AUTHORIZATION_DENIED'});
    assert.equal(await f.host.authorizationBound(f.tx,[]),Number.MAX_SAFE_INTEGER);
});

test('9 Relay ledger legacy Date.now is captured once and error success and cleanup use unchanged samples on caller executor',async t=>{
    let at=100; t.mock.method(Date,'now',()=>at++);
    const ledger=new RuntimeLedger(undefined,undefined,{merge:async(_tx,_context,current)=>[...current]});
    t.mock.method(Date,'now',()=>assert.fail('legacy ledger must retain original function'));
    const calls:unknown[][]=[],tx={async execute(this:unknown,...args:unknown[]){assert.equal(this,tx);calls.push(args);return [{affectedRows:1},[]];}} as unknown as Transaction;
    await ledger.recordRelayError(tx,'op',{original:true});await ledger.failRelayOperation(tx,'op',{original:true});await ledger.succeedRelayOperation(tx,'op');await ledger.clearTerminalRelayCleanup(tx,'forward');
    assert.equal(at,105);assert.deepEqual(calls.map(call=>call[1]),[[JSON.stringify({original:true}),100,'op'],[JSON.stringify({original:true}),101,'op'],[102,'op',103],[104,'forward']]);
});

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
async function withDatabase(action:(db:MySqlUnitOfWork,f:ReturnType<typeof fixture>)=>Promise<void>){
    const admin=await createConnection(databaseURL!),database='tunex_relay_owner_'+randomUUID().replaceAll('-','');
    const connectionURL=new URL(databaseURL!);connectionURL.pathname='/'+database;const db=new MySqlUnitOfWork(connectionURL.toString());let created=false;
    try{await admin.query(`CREATE DATABASE \`${database}\``);created=true;await db.migrate();const f=fixture();
        await db.transaction(async tx=>{
            await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',['actor-a','a'.repeat(64)]);
            await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',[f.forward.scopeId,'actor-a']);
            for(const [index,node] of f.input.nodes.entries())await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts) VALUES(?,?,?,?,?)',[node.facts.nodeId,f.forward.scopeId,String(index+1).repeat(64),f.state.now+3600000,JSON.stringify(node.facts)]);
            await write(tx,'INSERT INTO forwards(id,scope_id,revision,spec) VALUES(?,?,?,?)',[f.forward.id,f.forward.scopeId,f.forward.revision,JSON.stringify(f.forward.spec)]);
            await new MySqlRelayDeploymentStore().insertMultihop(tx,f.forward,9,f.plan,1,1);
        });await action(db,f);
    }finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${database}\``);}finally{await admin.end();}}
}
async function insertOperation(tx:Transaction,f:ReturnType<typeof fixture>,id:string,status:RuntimeOperation['status'],deadline:number,forwardId=f.forward.id){
    await write(tx,'INSERT INTO operations(id,scope_id,forward_id,target_revision,kind,status,requested_by,idempotency_key,request_digest,created_at,updated_at,execution_deadline,claim_token,claim_until,cleanup_pending) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,TRUE)',
        [id,f.forward.scopeId,forwardId,1,'create',status,'actor-a',id,'sha256:'+'b'.repeat(64),1,1,deadline,'original-claim',19]);
}

test('9 real MySQL Relay command predicates keep successful history claim boundaries cleanup selection and exact error detail',{skip:!databaseURL},async()=>{
    await withDatabase(async(db,f)=>{
        const store=new MySqlRuntimeLedgerStore(),error={code:'AUTHENTICATION_FAILED',retryable:false,nodeId:'node-1',detail:{original:'kept'}};
        await db.transaction(async tx=>{
            for(const status of ['accepted','running','succeeded','failed','superseded'] as const)for(const deadline of [99,100,101]){
                const id=`${status}-${deadline}`;await insertOperation(tx,f,id,status,deadline);await store.succeedRelayOperation(tx,id,11,100);
                const op=(await rows<RuntimeOperation>(tx,'SELECT * FROM operations WHERE id=?',[id]))[0]!,success=status==='running'&&deadline>100;
                assert.equal(op.status,success?'succeeded':status);assert.equal(op.claim_token,success?null:'original-claim');assert.equal(op.claim_until,success?null:19);assert.equal(op.cleanup_pending,success?0:1);
            }
            await store.recordRelayError(tx,'running-99',error,12);let recorded=(await rows<RuntimeOperation>(tx,'SELECT * FROM operations WHERE id=?',['running-99']))[0]!;
            assert.deepEqual(json(recorded.last_error),error);assert.equal(recorded.status,'running');assert.equal(recorded.claim_token,'original-claim');assert.equal(recorded.cleanup_pending,1);
            await store.failRelayOperation(tx,'running-99',error,13);recorded=(await rows<RuntimeOperation>(tx,'SELECT * FROM operations WHERE id=?',['running-99']))[0]!;
            assert.equal(recorded.status,'failed');assert.equal(recorded.claim_token,null);assert.equal(recorded.claim_until,null);assert.equal(recorded.cleanup_pending,1);assert.deepEqual(json(recorded.last_error),error);
            const other='other-forward';await write(tx,'INSERT INTO forwards(id,scope_id,revision,spec) VALUES(?,?,?,?)',[other,f.forward.scopeId,1,JSON.stringify(f.forward.spec)]);await insertOperation(tx,f,'other-op','failed',101,other);
            await store.clearTerminalRelayCleanup(tx,f.forward.id,14);
            const all=await rows<RuntimeOperation>(tx,'SELECT * FROM operations ORDER BY id');
            for(const op of all){const selected=op.forward_id===f.forward.id&&['succeeded','failed','superseded'].includes(op.status);assert.equal(op.cleanup_pending,selected?0:1);}
        });
    });
});

test('9 real MySQL failure after operation write before deployment withdrawal rolls back running failure and later incident without losing succeeded history',{skip:!databaseURL},async()=>{
    await withDatabase(async(db,f)=>{
        const store=new MySqlRuntimeLedgerStore(),deployments=new MySqlRelayDeploymentStore();
        for(const status of ['running','succeeded'] as const){
            await db.transaction(async tx=>{await write(tx,'DELETE FROM operations');await insertOperation(tx,f,'original-operation',status,f.state.now+60000);});
            const before=await rows(db.pool,'SELECT * FROM operations ORDER BY id'),beforeDeployments=await rows(db.pool,'SELECT * FROM relay_deployments ORDER BY generation');
            const failure=new Error('stop after operation write before deployment withdrawal'),trace:string[]=[];let supplied:Transaction|undefined;
            const ledger=new RuntimeLedger(undefined,undefined,{merge:async(_tx,_context,current)=>[...current]});
            const forward={async record(received:Transaction,scope:string,id:string){assert.equal(received,supplied);assert.deepEqual([scope,id],[f.forward.scopeId,f.forward.id]);return f.forward;}};
            const failingStore={async latest(received:Transaction,id:string,lock:boolean){assert.equal(received,supplied);trace.push('latest');return deployments.latest(received,id,lock);},
                async withdraw(received:Transaction,id:string,generation:number,at:number){assert.equal(received,supplied);assert.deepEqual([id,generation],[f.forward.id,9]);assert.equal(typeof at,'number');trace.push('before-withdraw');
                    const current=await ledger.latest(received,id);assert.equal(current?.status,'failed');assert.equal(current?.cleanup_pending,1);assert.equal(current?.claim_token,null);
                    assert.equal((await deployments.latest(received,id,true))?.stage,'preparing');throw failure;}};
            const host=new RuntimeRelayHost({nodes:{} as never,forwards:forward,transport:{} as never,endpoints:{} as never,ledger,policy:DEFAULT_POLICY,multihopEnabled:true,
                store:failingStore,observations:{} as never,compiler:nativeRelayCompiler,now:()=>f.state.now} as unknown as RuntimeRelayOptions<Transaction,NativeRuntimeFamily>);
            await assert.rejects(db.transaction(async tx=>{supplied=tx;await host.executionError(tx,f.snapshot,f.assignment,f.observation);}),error=>error===failure);
            assert.deepEqual(trace,['latest','before-withdraw']);assert.deepEqual(await rows(db.pool,'SELECT * FROM operations ORDER BY id'),before);assert.deepEqual(await rows(db.pool,'SELECT * FROM relay_deployments ORDER BY generation'),beforeDeployments);
            const successful=new RuntimeRelayHost({...bindings(host),forwards:forward,store:deployments,now:()=>f.state.now} as unknown as RuntimeRelayOptions<Transaction,NativeRuntimeFamily>);
            await db.transaction(async tx=>{supplied=tx;await successful.executionError(tx,f.snapshot,f.assignment,f.observation);});
            const operations=await rows<RuntimeOperation>(db.pool,'SELECT * FROM operations ORDER BY created_at,id');
            assert.equal(operations.length,status==='succeeded'?2:1);const incident=operations.at(-1)!;assert.equal(incident.status,'failed');assert.equal(incident.cleanup_pending,1);assert.equal(incident.claim_token,null);assert.equal(incident.claim_until,null);
            if(status==='succeeded'){assert.equal(operations[0]!.status,'succeeded');assert.equal(incident.source_operation_id,'original-operation');assert.notEqual(incident.id,'original-operation');}
            assert.deepEqual(json(incident.last_error),{code:f.observation.errorCode,retryable:false,nodeId:f.snapshot.nodeId,sessionEpoch:f.snapshot.sessionEpoch,assignmentId:f.assignment.assignmentId,deploymentGeneration:f.assignment.deploymentGeneration,bindingFence:f.assignment.bindingFence});
            assert.equal((await deployments.latest(db.pool as unknown as Transaction,f.forward.id,false))?.stage,'withdrawn');
            await db.transaction(tx=>store.clearTerminalRelayCleanup(tx,f.forward.id,99));
            assert.ok((await rows<RuntimeOperation>(db.pool,'SELECT * FROM operations')).every(op=>op.cleanup_pending===0));
            await db.transaction(tx=>write(tx,"UPDATE relay_deployments SET stage='preparing'"));
        }
    });
});
