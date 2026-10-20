import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { SnapshotAssignmentRegistry, RelayAssignmentSource, FORWARD_STATE_INTERFACE_VERSION } from '../src/modules/forward-owner/public.ts';
import { SnapshotAssignmentRegistry as canonicalRegistry } from '../src/modules/forward-owner/snapshot-assignments.ts';
import { RelayAssignmentSource as canonicalRelay } from '../src/modules/forward-owner/relay-assignment-source.ts';
import { SnapshotAssignmentRegistry as oldRegistry } from '../src/modules/runtime/snapshot-assignments.ts';
import { RelayAssignmentSource as oldRelay } from '../src/modules/runtime/relay-assignment-source.ts';
import { compileDirect, nativeCloneSnapshotAssignments, NATIVE_DRIVER_CATALOG } from '../src/compatibility/public.ts';
import { nativeCloneSnapshotAssignments as canonicalClone } from '../src/compatibility/native-runtime-catalog.ts';
import type { RuntimeAssignment, NativeSnapshotAssignmentSource, NativeSnapshotContribution, NativeRelayAssignmentReader } from '../src/compatibility/public.ts';
import type { SnapshotAssignmentContext } from '../src/framework/public.ts';

type Tx={readonly marker:symbol};
const tx:Tx={marker:Symbol('same owner transaction')};
const context:SnapshotAssignmentContext={nodeId:'node-a',includeAccepted:false};
function bindings(value:unknown):Record<string,any>{return value as Record<string,any>;}
function assignment(id:string,port:number,role:RuntimeAssignment['role']='direct'):RuntimeAssignment{
    const [compiled]=compileDirect({id:`forward-${id}`,scopeId:'scope-a',revision:1,spec:{enabled:true,protocols:['tcp'],
        ingress:{nodeId:'node-a',listen:{address:'127.0.0.1',port}},target:{host:'127.0.0.1',port:80}}},
        {nodeId:'node-a',scopeId:'scope-a',capabilities:['adp.3','native.direct.v1','tcp'],egressPolicyRevision:1,
            allowedListenerAddresses:['127.0.0.1'],allowedPorts:[port],allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false},
        [{nodeId:'node-a',forwardId:`forward-${id}`,protocol:'tcp',port,bindingFence:1,deploymentGeneration:1}]);
    const result=structuredClone(compiled!);result.assignmentId=id;result.role=role;
    result.driver.id=role==='direct'?'native.direct.v1':role.startsWith('relay-')?'native.relay.v1':'native.multihop.v1';return result;
}
function source(id:string,values:RuntimeAssignment[]=[],role:Exclude<RuntimeAssignment['role'],'direct'>='relay-ingress'):NativeSnapshotAssignmentSource<Tx>{
    return {id,drivers:[{id:role.startsWith('relay-')?'native.relay.v1':'native.multihop.v1',schemaVersion:1,roles:[role]}],
        async collect(current,request){assert.equal(current,tx);return {nodeId:request.nodeId,assignments:values};}};
}

test('118 original public legacy classes constructor prototypes readonly source contracts and native clone remain exact aliases',async()=>{
    assert.equal(SnapshotAssignmentRegistry,canonicalRegistry);assert.equal(SnapshotAssignmentRegistry,oldRegistry);
    assert.equal(RelayAssignmentSource,canonicalRelay);assert.equal(RelayAssignmentSource,oldRelay);assert.equal(nativeCloneSnapshotAssignments,canonicalClone);
    assert.equal(FORWARD_STATE_INTERFACE_VERSION,1);assert.equal(SnapshotAssignmentRegistry.length,1);assert.equal(RelayAssignmentSource.length,1);
    assert.deepEqual(Object.getOwnPropertyNames(SnapshotAssignmentRegistry.prototype),['constructor','merge']);assert.deepEqual(Object.getOwnPropertyNames(RelayAssignmentSource.prototype),['constructor','collect']);
    const roles=NATIVE_DRIVER_CATALOG.drivers.filter(value=>value.id!=='native.direct.v1').map(value=>[value.id,value.roles]);
    assert.deepEqual(roles,[['native.relay.v1',['relay-ingress','relay-egress']],['native.multihop.v1',['multihop-ingress','multihop-transit','multihop-egress']]]);
    const native=await readFile(new URL('../src/compatibility/native-runtime-catalog.ts',import.meta.url),'utf8');assert.match(native,/nativeCloneSnapshotAssignments<T>\(value:T\):T \{return structuredClone\(value\);\}/);
});

test('118 registration preserves complete declaration ID driver role ownership refusal messages and first-error precedence',()=>{
    for(const invalid of [undefined,null,{},'sources'])assert.throws(()=>new SnapshotAssignmentRegistry(invalid as never),{name:'Error',message:'Snapshot assignment sources are required'});
    const good=source('good');
    const cases:[unknown[],string][]=[
        [[null],'Invalid Snapshot assignment source declaration'],[[{...good,id:'../source'}],'Invalid Snapshot assignment source declaration'],
        [[{...good,collect:undefined}],'Invalid Snapshot assignment source declaration'],[[{...good,drivers:[]}],'Invalid Snapshot assignment source declaration'],
        [[good,{...good,collect:undefined}],'Invalid Snapshot assignment source declaration'],[[good,{...good}],'Duplicate Snapshot assignment source ID'],
        [[{...good,drivers:[{id:'native.direct.v1',schemaVersion:1,roles:['direct']}]}],'Unsupported Snapshot assignment driver declaration'],
        [[{...good,drivers:[{id:'native.relay.v1',schemaVersion:2,roles:['relay-ingress']}]}],'Unsupported Snapshot assignment driver declaration'],
        [[{...good,drivers:[{id:'native.relay.v1',schemaVersion:1,roles:[]}]}],'Unsupported Snapshot assignment driver declaration'],
        [[{...good,drivers:[good.drivers[0],good.drivers[0]]}],'Duplicate Snapshot assignment driver declaration'],
        [[{...good,drivers:[{id:'native.relay.v1',schemaVersion:1,roles:['multihop-ingress']}]}],'Unsupported Snapshot assignment role declaration'],
        [[{...good,drivers:[{id:'native.relay.v1',schemaVersion:1,roles:['relay-ingress','relay-ingress']}]}],'Duplicate Snapshot assignment driver/role ownership'],
        [[good,source('other')],'Duplicate Snapshot assignment driver/role ownership'],
    ];
    for(const [values,message]of cases)assert.throws(()=>new SnapshotAssignmentRegistry(values as never),{name:'Error',message});
    const failure=new Error('source getter');const malformed={...good};Object.defineProperty(malformed,'collect',{get(){throw failure;}});assert.throws(()=>new SnapshotAssignmentRegistry([malformed]),error=>error===failure);
});

test('118 registry binds original source receiver at construction snapshots declarations freezes registrations and performs no eager collect clone or clock reads',async t=>{
    const events:string[]=[],owner=source('source');let calls=0;
    owner.collect=async function(this:unknown,current,request){assert.equal(this,owner);assert.equal(current,tx);assert.deepEqual(request,context);calls++;return {nodeId:request.nodeId,assignments:[]};};
    const clone=globalThis.structuredClone;t.mock.method(globalThis,'structuredClone',function<T>(value:T){events.push('clone');return clone(value);});
    t.mock.method(Date,'now',()=>assert.fail('registry must not sample a clock'));
    const entries=[owner],registry=new SnapshotAssignmentRegistry(entries);assert.equal(calls,0);assert.deepEqual(events,[]);
    assert.ok(Object.isFrozen(registry));assert.ok(Object.isFrozen(bindings(registry).sources));assert.ok(Object.isFrozen(bindings(registry).sources[0]));assert.ok(Object.isFrozen(bindings(registry).sources[0].bindings));
    entries.length=0;bindings(owner).id='changed';bindings(owner).drivers.length=0;owner.collect=async()=>assert.fail('captured collector must not be replaced');
    assert.deepEqual(await registry.merge(tx,context,[]),[]);assert.equal(calls,1);assert.deepEqual(events,['clone','clone']);
    const getters:string[]=[],late=source('late');let reads=0;
    Object.defineProperty(late,'collect',{get(){getters.push('collect');reads++;return reads===1?async()=>assert.fail('validation function is not the later captured function'):async function(this:unknown,current:Tx,request:SnapshotAssignmentContext){assert.equal(this,late);assert.equal(current,tx);return {nodeId:request.nodeId,assignments:[]};};}});
    const second=new SnapshotAssignmentRegistry([late]);assert.deepEqual(getters,['collect','collect']);assert.deepEqual(await second.merge(tx,context,[]),[]);assert.deepEqual(getters,['collect','collect']);
});

test('118 direct and every contribution clone freeze before the next await with source-ID order context copy dynamic clone lookup and final ID sort',async t=>{
    const direct=[assignment('m-direct',32001)],first=[assignment('z-relay',33001,'relay-ingress')],last=[assignment('a-hop',34001,'multihop-transit')];
    const input={nodeId:'node-a',includeAccepted:false},events:string[]=[],originalClone=globalThis.structuredClone;
    let finish!:(value:NativeSnapshotContribution)=>void;const pending=new Promise<NativeSnapshotContribution>(resolve=>{finish=resolve;});
    const a=source('a-owner',first),b=source('b-owner',last,'multihop-transit');
    a.collect=async function(this:unknown,current,request){assert.equal(this,a);assert.equal(current,tx);assert.notEqual(request,input);assert.ok(Object.isFrozen(request));assert.deepEqual(Object.keys(request),['nodeId','includeAccepted']);events.push('collect:a');return pending;};
    b.collect=async function(this:unknown,current,request){assert.equal(this,b);assert.equal(current,tx);assert.deepEqual(request,context);events.push('collect:b');first[0]!.resource.port=1;
        globalThis.structuredClone=function<T>(value:T){assert.equal(value,last);events.push('clone:last-dynamic');return originalClone(value);};return {nodeId:request.nodeId,assignments:last};};
    t.mock.method(globalThis,'structuredClone',function<T>(value:T){events.push(value===direct?'clone:direct':value===first?'clone:first':'unexpected');return originalClone(value);});
    const registry=new SnapshotAssignmentRegistry([b,a]),result=registry.merge(tx,input,direct);
    assert.deepEqual(events,['clone:direct','collect:a']);direct[0]!.resource.port=2;input.nodeId='changed';input.includeAccepted=true;
    finish({nodeId:'node-a',assignments:first});const merged=await result;
    assert.deepEqual(events,['clone:direct','collect:a','clone:first','collect:b','clone:last-dynamic']);
    assert.deepEqual(merged.map(value=>value.assignmentId),['a-hop','m-direct','z-relay']);assert.deepEqual(merged.map(value=>value.resource.port),[34001,32001,33001]);
    for(const value of merged){assert.ok(Object.isFrozen(value));assert.ok(Object.isFrozen(value.driver.config));assert.ok(Object.isFrozen(value.resource));}
    assert.equal(Object.isFrozen(direct),false);assert.equal(Object.isFrozen(direct[0]),false);assert.equal(Object.isFrozen(first[0]),false);assert.equal(Object.isFrozen(merged),false);
});

test('118 dynamic native clone failures retain original identity at direct or contribution boundary and stop subsequent owners',async t=>{
    const originalClone=globalThis.structuredClone;let events:string[]=[],direct:RuntimeAssignment[]=[],first:RuntimeAssignment[]=[],last:RuntimeAssignment[]=[],stage='direct',failure=new Error('direct');
    t.mock.method(globalThis,'structuredClone',function<T>(value:T){const label=value===direct?'direct':value===first?'first':'last';events.push(`clone:${label}`);if(label===stage)throw failure;return originalClone(value);});
    for(const current of ['direct','first','last']){
        events=[];direct=[];first=[];last=[];stage=current;failure=new Error(stage);
        const a=source('a-owner',first),b=source('b-owner',last,'relay-egress');
        a.collect=async()=>{events.push('collect:a');return {nodeId:'node-a',assignments:first};};b.collect=async()=>{events.push('collect:b');return {nodeId:'node-a',assignments:last};};
        await assert.rejects(new SnapshotAssignmentRegistry([b,a]).merge(tx,context,direct),error=>error===failure);
        const all=['clone:direct','collect:a','clone:first','collect:b','clone:last'];assert.deepEqual(events,all.slice(0,all.indexOf(`clone:${stage}`)+1));
    }
    t.mock.restoreAll();let calls=0;const invalid=assignment('invalid',35001);bindings(invalid.driver.config).uncloneable=()=>{};
    const owner=source('owner');owner.collect=async()=>{calls++;return {nodeId:'node-a',assignments:[]};};
    await assert.rejects(new SnapshotAssignmentRegistry([owner]).merge(tx,context,[invalid]),{name:'DataCloneError'});assert.equal(calls,0);
});

test('118 contribution shape and ownership refuse before conflicts and each assignment logical physical conflict stops the next source',async()=>{
    const direct=assignment('direct',32001),base=assignment('relay',33001,'relay-ingress');
    for(const [name,change,code]of [
        ['ownership-before-duplicate',(value:RuntimeAssignment)=>{value.assignmentId=direct.assignmentId;value.driver.id='native.direct.v1';},'INTEGRITY_FAILURE'],
        ['assignment-ID',(value:RuntimeAssignment)=>{value.assignmentId=direct.assignmentId;},'RESOURCE_CONFLICT'],
        ['logical',(value:RuntimeAssignment)=>{value.assignmentId='different';},'RESOURCE_CONFLICT'],
        ['physical',(value:RuntimeAssignment)=>{value.assignmentId='different';value.forwardId='different';value.resource.port=direct.resource.port;},'RESOURCE_CONFLICT'],
    ]as const){
        const candidate=structuredClone(base);change(candidate);let after=0;const first=name==='logical'?[base,candidate]:[candidate];
        const a=source('a-owner',first),b=source('b-owner',[],'relay-egress');b.collect=async()=>{after++;return {nodeId:'node-a',assignments:[]};};
        await assert.rejects(new SnapshotAssignmentRegistry([a,b]).merge(tx,context,[direct]),{code});assert.equal(after,0);
    }
    let assignmentsRead=false;const malformed=source('source');malformed.collect=async()=>({nodeId:'foreign',get assignments():readonly RuntimeAssignment[]{assignmentsRead=true;throw new Error('must refuse Node first');}});
    await assert.rejects(new SnapshotAssignmentRegistry([malformed]).merge(tx,context,[]),{code:'INTEGRITY_FAILURE',message:'Snapshot contribution belongs to another Node or has invalid shape'});assert.equal(assignmentsRead,false);
    const udp=assignment('udp',direct.resource.port,'relay-ingress');udp.protocol='udp';udp.resource.protocol='udp';assert.equal((await new SnapshotAssignmentRegistry([source('udp-source',[udp])]).merge(tx,context,[direct])).length,2);
});

test('118 Relay source captures original member callback without reading plans until collection and retains literal frozen role catalog and original contribution references',async()=>{
    const values:RuntimeAssignment[]=[],events:unknown[][]=[];const reader:NativeRelayAssignmentReader<Tx>={async assignments(this:unknown,...args){assert.equal(this,reader);events.push(args);return values;}};
    const relay=new RelayAssignmentSource(reader);assert.deepEqual(events,[]);assert.ok(Object.isFrozen(relay));assert.equal(relay.id,'native-relay-plans');
    assert.deepEqual(relay.drivers,[{id:'native.relay.v1',schemaVersion:1,roles:['relay-ingress','relay-egress']},{id:'native.multihop.v1',schemaVersion:1,roles:['multihop-ingress','multihop-transit','multihop-egress']}]);
    assert.ok(Object.isFrozen(relay.drivers));for(const driver of relay.drivers){assert.ok(Object.isFrozen(driver));assert.ok(Object.isFrozen(driver.roles));}
    reader.assignments=async()=>assert.fail('captured reader method must remain installed');
    for(const includeAccepted of [false,true]){const contribution=await relay.collect(tx,{nodeId:'node-a',includeAccepted});assert.deepEqual(Object.keys(contribution),['nodeId','assignments']);assert.equal(contribution.assignments,values);assert.equal(contribution.nodeId,'node-a');assert.equal(Object.isFrozen(contribution),false);}
    assert.deepEqual(events,[[tx,'node-a',false],[tx,'node-a',true]]);
    const failure=new Error('original deferred Relay reader');const rejected=new RelayAssignmentSource<Tx>({async assignments(){throw failure;}});await assert.rejects(rejected.collect(tx,context),error=>error===failure);
    for(const value of [undefined,null,{}, {assignments:null}])assert.throws(()=>new RelayAssignmentSource(value as never),{name:'Error',message:'Relay assignment reader is required'});
});
