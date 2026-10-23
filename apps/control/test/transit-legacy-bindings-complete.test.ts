import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import { TransitCoordinationJournal } from '../src/modules/runtime/transit-coordination.ts';
import { TransitDeliveryService } from '../src/modules/runtime/transit-delivery.ts';
import { TransitNegotiator } from '../src/modules/runtime/transit-negotiation.ts';
import { reserveTransitResources, validateTransitReservationSet } from '../src/modules/runtime/transit-reservations.ts';
import { TransitStagingCoordinator, verifyTransitStage } from '../src/modules/runtime/transit-staging.ts';
import { TransitCoordinationService, TransitPreviewDelivery, TransitNegotiationService, TransitStagingService, TransitReservations,
    validateTransitReservationSet as canonicalValidation, verifyTransitStage as canonicalVerification } from '../src/modules/transit-owner/public.ts';
import { MySqlTransitCoordinationStore } from '../src/infrastructure/mysql-transit-coordination-store.ts';
import { MySqlTransitDeliveryStore } from '../src/infrastructure/mysql-transit-delivery-store.ts';
import { MySqlTransitMachineReader } from '../src/infrastructure/mysql-transit-machine.ts';
import { MySqlTransitStagingStore } from '../src/infrastructure/mysql-transit-staging-store.ts';
import { MySqlRuntimeResourceStore } from '../src/infrastructure/mysql-runtime-resources.ts';
import { NodePortLimitPolicy } from '../src/modules/node-owner/public.ts';
import { SharedResourceLimitPublicationPolicy } from '../src/modules/resource-limit-owner/public.ts';
import { MySqlSharedResourceLimitStore } from '../src/infrastructure/mysql-resource-limits.ts';
import { MySqlNodeAuthorityStore } from '../src/infrastructure/mysql-node-authority.ts';
import { RuntimeExclusiveReservations, RuntimeReservationRelease } from '../src/framework/public.ts';
import type { Transaction, MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';

function bindings(value:unknown):Record<string,any>{return value as Record<string,any>;}
function database(){const tx={};const seen:unknown[]=[];const db={async transaction(action:(value:unknown)=>unknown){assert.equal(this,db);seen.push(tx);return action(tx);}};return {db:db as unknown as MySqlUnitOfWork,tx,seen};}

test('203/205 journal holds one real coordinator/store and forwards all arguments result failure and original database member transaction', async t=>{
    const f=database(), journal=new TransitCoordinationJournal(f.db), held=bindings(journal).coordinator;
    assert.equal(TransitCoordinationJournal.length,1);assert.ok(held instanceof TransitCoordinationService);assert.ok(bindings(held).store instanceof MySqlTransitCoordinationStore);
    const proof={},verify=()=>true, result={},calls:unknown[][]=[];
    const cases:[string,unknown[]][]=[['begin',['actor','scope','forward',3]],['peek',['actor','scope','forward',3]],['confirm',['actor','scope','forward',3,proof,verify]],['fail',['actor','scope','forward',3]],['quarantineRecovery',[]]];
    for(const [name,args] of cases){t.mock.method(bindings(TransitCoordinationService.prototype),name,async function(this:unknown,...actual:unknown[]){assert.equal(this,held);calls.push([name,...actual]);return result;});assert.equal(await bindings(journal)[name](...args),result);assert.deepEqual(calls.pop(),[name,...args]);assert.equal(bindings(journal).coordinator,held);}
    const marker={};assert.equal(await bindings(held).db.transaction((tx:unknown)=>{assert.equal(tx,f.tx);return marker;}),marker);assert.deepEqual(f.seen,[f.tx]);
    const failure=new Error('coordinator failure');t.mock.method(TransitCoordinationService.prototype,'peek',async()=>{throw failure;});await assert.rejects(journal.peek('a','s','f',1),error=>error===failure);
});

test('203/205 delivery retains held offline journal but creates preview service/store at each original call and exposes only peek', async t=>{
    const f=database(), delivery=new TransitDeliveryService(f.db), journal=bindings(delivery).coordination;
    assert.ok(journal instanceof TransitCoordinationJournal);assert.equal(TransitDeliveryService.length,1);
    const instances:unknown[]=[],stores:unknown[]=[],result={},report={};
    for(const [name,args] of [['enqueuePreview',['actor','scope','forward',3]],['poll',['node','fingerprint',4,'boot']],['report',['node','fingerprint',4,report]],['poll',['node','fingerprint',4,'boot']]] as [string,unknown[]][]){
        t.mock.method(bindings(TransitPreviewDelivery.prototype),name,async function(this:unknown,...actual:unknown[]){assert.deepEqual(actual,args);instances.push(this);const b=bindings(this);assert.ok(b.store instanceof MySqlTransitDeliveryStore);stores.push(b.store);assert.deepEqual(Object.keys(b.coordination),['peek']);const marker={};assert.equal(await b.db.transaction((tx:unknown)=>{assert.equal(tx,f.tx);return marker;}),marker);return result;});
        assert.equal(await bindings(delivery)[name](...args),result);assert.equal(bindings(delivery).coordination,journal);
    }
    assert.equal(new Set(instances).size,4);assert.equal(new Set(stores).size,4);assert.equal(f.seen.length,4);
    const planner=bindings(instances[0]).coordination, expected=['a','s','f',9], output={};
    t.mock.method(TransitCoordinationJournal.prototype,'peek',async function(this:unknown,...args:unknown[]){assert.equal(this,journal);assert.deepEqual(args,expected);return output as never;});
    assert.equal(await planner.peek(...expected),output);
    const failure=new Error('preview failure');t.mock.method(TransitPreviewDelivery.prototype,'report',async()=>{throw failure;});await assert.rejects(delivery.report('n','f',1,report as never),error=>error===failure);
});

test('203/205 negotiation constructs original machine reader per hello and retains member transaction and complete argument identities', async t=>{
    const f=database(), negotiator=new TransitNegotiator(f.db), request={},result={},instances:unknown[]=[],readers:unknown[]=[];
    assert.equal(TransitNegotiator.length,1);
    t.mock.method(TransitNegotiationService.prototype,'hello',async function(this:unknown,...args:unknown[]){assert.deepEqual(args,['node','fingerprint',7,request]);instances.push(this);const b=bindings(this);assert.ok(b.machine instanceof MySqlTransitMachineReader);readers.push(b.machine);await b.db.transaction((tx:unknown)=>assert.equal(tx,f.tx));return result as never;});
    assert.equal(await negotiator.hello('node','fingerprint',7,request as never),result);assert.equal(await negotiator.hello('node','fingerprint',7,request as never),result);
    assert.notEqual(instances[0],instances[1]);assert.notEqual(readers[0],readers[1]);assert.equal(f.seen.length,2);
    const failure=new Error('negotiation failure');t.mock.method(TransitNegotiationService.prototype,'hello',async()=>{throw failure;});await assert.rejects(negotiator.hello('n','f',1,request as never),error=>error===failure);
});

test('203/205 compatibility reservations retain explicit or native default policy and exact reservation arguments with late default capacity',async t=>{
    const tx={},forward={},resources:unknown[]=[],result:unknown[]=[],owners:unknown[]=[];
    const portPolicy={async assertReservation(){assert.fail('construction must not reserve');}};
    assert.equal(reserveTransitResources.length,4);assert.equal(validateTransitReservationSet,canonicalValidation);
    t.mock.method(TransitReservations.prototype,'reserve',async function(this:unknown,...args:unknown[]){owners.push(this);assert.deepEqual(args,[tx,forward,resources,7]);return result as never;});
    assert.equal(await reserveTransitResources(tx as never,forward as never,resources as never,7,portPolicy),result);
    assert.equal(await reserveTransitResources(tx as never,forward as never,resources as never,7,portPolicy),result);
    assert.notEqual(owners[0],owners[1]);
    for(const owner of owners){const access=bindings(owner).resources;assert.ok(access instanceof RuntimeExclusiveReservations);assert.ok(bindings(access).store instanceof MySqlRuntimeResourceStore);assert.equal(bindings(access).portPolicy,portPolicy);assert.equal(bindings(access).capacity(),DEFAULT_POLICY.maxAssignmentsPerNode);}
    assert.equal(await reserveTransitResources(tx as never,forward as never,resources as never,7),result);
    const defaultAccess=bindings(owners[2]).resources,defaultPolicy=bindings(defaultAccess).portPolicy;
    assert.notEqual(owners[2],owners[0]);assert.ok(defaultAccess instanceof RuntimeExclusiveReservations);
    assert.ok(bindings(defaultAccess).store instanceof MySqlRuntimeResourceStore);assert.ok(defaultPolicy instanceof NodePortLimitPolicy);
    assert.ok(bindings(defaultPolicy).nodes instanceof MySqlNodeAuthorityStore);assert.ok(bindings(defaultPolicy).usage instanceof MySqlRuntimeResourceStore);
    assert.equal(bindings(defaultAccess).capacity(),DEFAULT_POLICY.maxAssignmentsPerNode);
    assert.ok(Object.isFrozen(DEFAULT_POLICY));
    const failure=new Error('reservation failure');t.mock.method(TransitReservations.prototype,'reserve',async()=>{throw failure;});
    await assert.rejects(reserveTransitResources(tx as never,forward as never,resources as never,7,portPolicy),error=>error===failure);
});

test('203/205 staging holds service original native resource/release/store and all member receivers currentOnly arguments and one database transaction',async t=>{
    const f=database(),calls:unknown[][]=[],result={},tx=f.tx,forward={},nodes=provider('nodes',['authorizedRelayNode','reservationPorts','facts','relayCredentialFacts']),forwarding=provider('forwarding',['currentForUpdate','authorizer']),transport=provider('transport',['resolve']),endpoints=provider('endpoints',['resolve']);
    function provider(label:string,names:string[]){const owner=Object.fromEntries(names.map(name=>[name,function(this:unknown,...args:unknown[]){assert.equal(this,owner);calls.push([label,name,...args]);return result;}]));return owner;}
    const staging=new TransitStagingCoordinator(f.db,nodes as never,forwarding as never,transport as never,endpoints as never),held=bindings(staging).staging,options=bindings(held).options;
    assert.equal(TransitStagingCoordinator.length,5);assert.equal(verifyTransitStage,canonicalVerification);assert.ok(held instanceof TransitStagingService);assert.ok(options.store instanceof MySqlTransitStagingStore);
    assert.ok(options.reservations instanceof TransitReservations);assert.ok(bindings(options.reservations).resources instanceof RuntimeExclusiveReservations);assert.ok(bindings(bindings(options.reservations).resources).store instanceof MySqlRuntimeResourceStore);
    assert.ok(bindings(bindings(options.reservations).resources).portPolicy instanceof NodePortLimitPolicy);
    assert.ok(options.release instanceof RuntimeReservationRelease);assert.ok(bindings(options.release).store instanceof MySqlRuntimeResourceStore);
    assert.ok(options.payloadPolicy instanceof SharedResourceLimitPublicationPolicy);
    const payloadOptions=bindings(options.payloadPolicy).options;
    assert.ok(payloadOptions.nodes instanceof MySqlNodeAuthorityStore);assert.ok(payloadOptions.owners instanceof MySqlRuntimeResourceStore);
    assert.ok(payloadOptions.store instanceof MySqlSharedResourceLimitStore);assert.equal(typeof payloadOptions.codec.formatTime,'function');
    const cases:[string,string,unknown[]][]=[['nodes','authorizedRelayNode',[tx,'a','s','n','transit',forward]],['nodes','reservationPorts',[tx,'a','s','n',[32001,32002]]],['nodes','facts',[tx,'n']],['nodes','relayCredentialFacts',[tx,'n',true]],['nodes','relayCredentialFacts',[tx,'n',false]],['forwarding','currentForUpdate',[tx,'s','f']],['forwarding','authorizer',[tx,forward]],['transport','resolve',[tx,'a','s','p',4]],['endpoints','resolve',[tx,'n']]];
    for(const [owner,name,args] of cases){assert.equal(options[owner][name](...args),result);assert.deepEqual(calls.pop(),[owner,name,...args]);}
    assert.equal(await options.db.transaction((actual:unknown)=>{assert.equal(actual,tx);return result;}),result);assert.deepEqual(f.seen,[tx]);
    for(const [name,args] of [['stage',['a','s','f',4]],['abort',['a','s','f',7]]] as [string,unknown[]][]){t.mock.method(bindings(TransitStagingService.prototype),name,async function(this:unknown,...actual:unknown[]){assert.equal(this,held);assert.deepEqual(actual,args);return result;});assert.equal(await bindings(staging)[name](...args),result);}
    const failure=new Error('stage failure');t.mock.method(TransitStagingService.prototype,'stage',async()=>{throw failure;});await assert.rejects(staging.stage('a','s','f',4),error=>error===failure);
});

test('205 native Transit store adapters issue original locks on caller transaction without opening or replacing it',async()=>{
    const calls:unknown[][]=[],tx={execute:async function(this:unknown,...args:unknown[]){assert.equal(this,tx);calls.push(args);return [[{session_epoch:3}],[]];}} as unknown as Transaction;
    const coordination=new MySqlTransitCoordinationStore();await coordination.stage(tx,'scope','forward',7);await coordination.recoveryStage(tx,'forward',7);await coordination.session(tx,'node');await coordination.journal(tx,'forward',7);
    await new MySqlTransitMachineReader().read(tx,'node','fingerprint');
    assert.deepEqual(calls.slice(0,4),[
        ['SELECT * FROM transit_deployments WHERE forward_id=? AND generation=? AND scope_id=? FOR UPDATE',['forward',7,'scope']],
        ['SELECT * FROM transit_deployments WHERE forward_id=? AND generation=? FOR UPDATE',['forward',7]],
        ['SELECT session_epoch FROM runtime_nodes WHERE node_id=? FOR UPDATE',['node']],
        ['SELECT * FROM transit_coordination WHERE forward_id=? AND generation=? FOR UPDATE',['forward',7]],
    ]);assert.match(String(calls[4]![0]),/LEFT JOIN node_credentials.*fingerprint=\?[\s\S]*WHERE r.node_id=\? FOR UPDATE/);assert.deepEqual(calls[4]![1],['fingerprint','node']);
});
