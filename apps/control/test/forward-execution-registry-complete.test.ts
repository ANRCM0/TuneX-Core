import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import type { Forward } from '@tunex/core';
import type { AuthorizedNodeFacts, ReservedSlot } from '../src/framework/public.ts';
import { NATIVE_DRIVER_CATALOG } from '../src/compatibility/public.ts';
import { ForwardExecutionRegistry, nativeDriverFor, nativeForwardAdapters, ForwardCommandExecutor, EXECUTION_HOST_VERSION } from '../src/modules/forward-owner/public.ts';
import type { ForwardExecutionAdapter, NativeDriverId } from '../src/modules/forward-owner/public.ts';
import { ForwardExecutionRegistry as oldRegistry, nativeDriverFor as oldDriver } from '../src/modules/runtime/execution-adapters.ts';
import { nativeForwardAdapters as oldFactory } from '../src/modules/runtime/native-forward-adapters.ts';
import { ForwardCommandExecutor as oldExecutor } from '../src/modules/runtime/forward-commands.ts';
import { ForwardExecutionRegistry as canonicalRegistry } from '../src/modules/forward-owner/execution-registry.ts';
import { nativeForwardAdapters as canonicalFactory } from '../src/modules/forward-owner/native-adapters.ts';
import { ForwardCommandExecutor as canonicalExecutor } from '../src/modules/forward-owner/execution.ts';

const methods=['prepareCreate','planCreate','prepareUpdate','planUpdate','lockRemoval','authorizeRetry'] as const;
const ids=['native.direct.v1','native.relay.v1','native.multihop.v1'] as const;
type Tx={readonly marker:symbol};
function bindings(value:unknown):Record<string,any>{return value as Record<string,any>;}
function forward(count=0,enabled=true):Forward {
    return {id:'forward-a',scopeId:'scope-a',revision:2,spec:{enabled,protocols:['tcp','udp'],
        ingress:{nodeId:'node-z',listen:{address:'127.0.0.1',port:32001}},target:{host:'127.0.0.1',port:80},
        ...(count?{path:{via:count===1?['node-b']:['node-b','node-a']},transport:{profileId:'profile-a',configRevision:1}}:{})}};
}
function adapter(id:NativeDriverId,record:(owner:unknown,name:string,args:unknown[])=>unknown=()=>undefined):ForwardExecutionAdapter<Tx>{
    const owner={id,hostInterfaceVersion:EXECUTION_HOST_VERSION,...Object.fromEntries(methods.map(name=>[name,function(this:unknown,...args:unknown[]){return record(this,name,args);}]))};
    return owner as unknown as ForwardExecutionAdapter<Tx>;
}
function fixture(){
    const tx:Tx={marker:Symbol('original transaction')},events:string[]=[],args:unknown[][]=[];
    const failure=new Error('original provider failure'),options={fail:'',denied:false,oldRevoked:true,invalidFacts:false,invalidSlots:false};
    const facts:AuthorizedNodeFacts={nodeId:'node-z',scopeId:'scope-a',capabilities:['adp.3','native.direct.v1','tcp','udp'],egressPolicyRevision:1,
        allowedListenerAddresses:['127.0.0.1'],allowedPorts:[32001],allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false};
    const slots:ReservedSlot[]=['tcp','udp'].map(protocol=>({nodeId:'node-z',forwardId:'forward-a',protocol:protocol as 'tcp'|'udp',port:32001,bindingFence:1,deploymentGeneration:1}));
    function call(owner:unknown,expected:unknown,name:string,actual:unknown[]){assert.equal(owner,expected);assert.equal(actual[0],tx);events.push(name);args.push([name,...actual]);if(options.fail===name)throw failure;}
    const nodes={async authorized(this:unknown,...actual:unknown[]){call(this,nodes,'authorized',actual);return options.invalidFacts?{...facts,allowedPorts:[1]}:facts;},
        async authorizedRelayNode(this:unknown,...actual:unknown[]){call(this,nodes,`authorizedRelayNode:${actual[3]}`,actual);return facts;},
        async state(this:unknown,...actual:unknown[]){call(this,nodes,'state',actual);return {revoked:options.oldRevoked};}};
    const resources={async lockOwnership(this:unknown,...actual:unknown[]){call(this,resources,'lockOwnership',actual);},async lockNode(this:unknown,...actual:unknown[]){call(this,resources,`lockNode:${actual[1]}`,actual);},
        async reserve(this:unknown,...actual:unknown[]){call(this,resources,'reserve',actual);return options.invalidSlots?[]:slots;},
        async transition(this:unknown,...actual:unknown[]){call(this,resources,'resourceTransition',actual);return options.invalidSlots?[]:slots;}};
    const relay={async lockNodes(this:unknown,...actual:unknown[]){call(this,relay,'lockNodes',actual);},
        async canExecute(this:unknown,...actual:unknown[]){call(this,relay,'canExecute',actual);return !options.denied;},
        async acceptPlan(this:unknown,...actual:unknown[]){call(this,relay,'acceptPlan',actual);}};
    const execution={async lock(this:unknown,...actual:unknown[]){call(this,execution,'lock',actual);},
        async transition(this:unknown,...actual:unknown[]){call(this,execution,'executionTransition',actual);},
        async assertCapacity(this:unknown,...actual:unknown[]){call(this,execution,'assertCapacity',actual);}};
    const adapters=nativeForwardAdapters<Tx>(nodes as never,resources as never,relay as never,execution as never);
    const executor=new ForwardCommandExecutor<Tx>(nodes as never,resources as never,relay as never,execution as never);
    return {tx,events,args,options,failure,facts,slots,nodes,resources,relay,execution,adapters,executor,clear(){events.length=0;args.length=0;}};
}

test('115 public canonical and legacy registry/factory/executor are the same constructors and six-method contract values',()=>{
    assert.equal(ForwardExecutionRegistry,oldRegistry);assert.equal(ForwardExecutionRegistry,canonicalRegistry);
    assert.equal(nativeDriverFor,oldDriver);assert.equal(nativeForwardAdapters,oldFactory);assert.equal(nativeForwardAdapters,canonicalFactory);
    assert.equal(ForwardCommandExecutor,oldExecutor);assert.equal(ForwardCommandExecutor,canonicalExecutor);
    assert.equal(EXECUTION_HOST_VERSION,1);assert.equal(ForwardExecutionRegistry.length,1);assert.equal(nativeForwardAdapters.length,4);assert.equal(ForwardCommandExecutor.length,4);
    assert.deepEqual(Object.getOwnPropertyNames(ForwardExecutionRegistry.prototype),['constructor','descriptor','select']);
    assert.deepEqual(Object.getOwnPropertyNames(ForwardCommandExecutor.prototype),['constructor','prepareCreate','planCreate','prepareUpdate','planUpdate','lock','lockOwnership','lockRemoval','prepareRetry','assertCapacity']);
});

test('115 registry rejects incomplete declaration before getters and preserves descriptor version duplicate then six-method refusal order',()=>{
    for(const invalid of [undefined,null,{},[],[adapter(ids[0])],new Array(3)])assert.throws(()=>new ForwardExecutionRegistry(invalid as never),invalid&&Array.isArray(invalid)&&invalid.length===3?/Invalid or duplicate native execution adapter/:/Complete native execution adapter registration required/);
    const trace:string[]=[];
    function observed(id:NativeDriverId,missing?:string){const owner:Record<string,unknown>={id,hostInterfaceVersion:1};for(const name of methods)Object.defineProperty(owner,name,{get(){trace.push(name);return name===missing?undefined:async()=>{};},enumerable:true});return owner as unknown as ForwardExecutionAdapter<Tx>;}
    const complete=ids.map(id=>observed(id));new ForwardExecutionRegistry(complete);
    assert.deepEqual(trace,ids.flatMap(()=>[...methods,...methods]));
    for(const missing of methods){trace.length=0;assert.throws(()=>new ForwardExecutionRegistry([observed(ids[0],missing),adapter(ids[1]),adapter(ids[2])]),{name:'Error',message:'Invalid or duplicate native execution adapter'});assert.deepEqual(trace,methods.slice(0,methods.indexOf(missing)+1));}
    trace.length=0;const wrong=observed(ids[0]);Object.defineProperty(wrong,'hostInterfaceVersion',{value:2});
    assert.throws(()=>new ForwardExecutionRegistry([wrong,adapter(ids[1]),adapter(ids[2])]),/Invalid or duplicate native execution adapter/);assert.deepEqual(trace,[]);
    for(const invalid of [null,{id:'unknown',hostInterfaceVersion:1},adapter(ids[0])]){
        trace.length=0;assert.throws(()=>new ForwardExecutionRegistry([adapter(ids[0]),invalid,adapter(ids[2])] as never),/Invalid or duplicate native execution adapter/);assert.deepEqual(trace,[]);
    }
    const bomb=new Error('method getter');const throwing=adapter(ids[0]);Object.defineProperty(throwing,'prepareUpdate',{get(){throw bomb;}});
    assert.throws(()=>new ForwardExecutionRegistry([throwing,adapter(ids[1]),adapter(ids[2])]),error=>error===bomb);
});

test('115 registry binds all six methods to each original owner and freezes captured registration without copying promise or argument values',async()=>{
    const tx:Tx={marker:Symbol()},current=forward(),next={...current,revision:3},seen:unknown[][]=[];
    const result=Promise.resolve();const owners=ids.map(id=>{let owner:ForwardExecutionAdapter<Tx>;owner=adapter(id,(self,name,args)=>{assert.equal(self,owner);seen.push([id,name,...args]);return result;});return owner;});
    const registry=new ForwardExecutionRegistry(owners),saved=[...owners];owners.reverse();
    for(let i=0;i<ids.length;i++){
        const selected=registry.select(forward(i));assert.equal(selected.id,ids[i]);assert.ok(Object.isFrozen(selected));assert.notEqual(selected,saved[i]);
        assert.equal(registry.select(forward(i)),selected);assert.equal(registry.descriptor(ids[i]!),NATIVE_DRIVER_CATALOG.drivers.find(value=>value.id===ids[i]));
        for(const name of methods){const args=name==='prepareUpdate'?[tx,'actor',current,next]:name==='lockRemoval'?[tx,current]:[tx,'actor',current];
            const invoke=bindings(selected)[name];assert.equal(invoke(...args),result);assert.deepEqual(seen.pop(),[ids[i],name,...args]);}
        bindings(saved[i]).prepareCreate=()=>{assert.fail('later replacement must not replace registered callback');};assert.equal(selected.prepareCreate(tx,'actor',current),result);
    }
    assert.throws(()=>registry.descriptor('unknown' as never),{name:'Error',code:'UNSUPPORTED_CAPABILITY',status:422,message:'Native execution adapter is not installed'});
    await result;
});

test('115 native classifier keeps direct Relay multihop intent selection and original invalid-intent error before registry lookup',()=>{
    for(let count=0;count<3;count++)assert.equal(nativeDriverFor(forward(count)),ids[count]);
    for(const invalid of [null,{},...[forward(0),forward(1)].map(value=>({...value,spec:{...value.spec,protocols:['sctp']}}))]){
        assert.throws(()=>nativeDriverFor(invalid as never),{name:'Error',code:'INVALID_CONFIG',status:422,message:'Valid native Forward intent required'});
    }
    const registry=new ForwardExecutionRegistry(ids.map(id=>adapter(id)));assert.throws(()=>registry.select({} as never),{code:'INVALID_CONFIG'});
});

test('115 factory is a fresh frozen ordered triple holding exact supplied collaborators and executor fifth default stays original',async()=>{
    const f=fixture(),another=nativeForwardAdapters<Tx>(f.nodes as never,f.resources as never,f.relay as never,f.execution as never);
    assert.ok(Object.isFrozen(f.adapters));assert.deepEqual(f.adapters.map(value=>value.id),ids);assert.notEqual(f.adapters,another);
    for(let i=0;i<3;i++){const native=bindings(f.adapters[i]);assert.notEqual(native,another[i]);assert.equal(native.nodes,f.nodes);assert.equal(native.resources,f.resources);assert.equal(native.hostInterfaceVersion,1);assert.equal(i===0?native.execution:native.relay,i===0?f.execution:f.relay);}
    assert.deepEqual(f.events,[]);
    const explicit:unknown[][]=[],supplied=ids.map(id=>adapter(id,(_self,name,args)=>{explicit.push([id,name,...args]);return Promise.resolve();}));
    const custom=new ForwardCommandExecutor<Tx>(null as never,null as never,null as never,null as never,supplied),intent=forward(1);
    await custom.prepareCreate(f.tx,'actor',intent);assert.deepEqual(explicit,[['native.relay.v1','prepareCreate',f.tx,'actor',intent]]);
    assert.throws(()=>new ForwardCommandExecutor(null as never,null as never,null as never,null as never,[]),/Complete native execution adapter registration required/);
    const original=new ForwardCommandExecutor<Tx>(f.nodes as never,f.resources as never,f.relay as never,f.execution as never,undefined);
    await original.prepareCreate(f.tx,'actor',forward());assert.deepEqual(f.events,['authorized','lockNode:node-z','reserve']);
    const source=await readFile(new URL('../src/modules/forward-owner/execution.ts',import.meta.url),'utf8');
    assert.match(source,/adapters:readonly ForwardExecutionAdapter<Tx>\[\]=nativeForwardAdapters\(nodes,resources,relay,execution\)/);
});

test('115 real Direct adapter authorizes locks validates before allocation recompiles returned slots and retains no-op planning',async()=>{
    const f=fixture(),direct=f.adapters[0]!,intent=forward(),next={...intent,revision:3};
    await direct.prepareCreate(f.tx,'actor',intent);assert.deepEqual(f.events,['authorized','lockNode:node-z','reserve']);assert.deepEqual(f.args,[['authorized',f.tx,'actor',intent],['lockNode:node-z',f.tx,'node-z'],['reserve',f.tx,intent,'actor']]);
    f.clear();await direct.prepareUpdate(f.tx,'actor',intent,{...intent});assert.deepEqual(f.events,['authorized','lock']);
    f.clear();await direct.prepareUpdate(f.tx,'actor',intent,next);assert.deepEqual(f.events,['authorized','lock','resourceTransition']);assert.deepEqual(f.args[2],['resourceTransition',f.tx,intent,next]);
    f.clear();await direct.planCreate(f.tx,'actor',intent);await direct.planUpdate(f.tx,'actor',intent);assert.deepEqual(f.events,[]);
    await direct.lockRemoval(f.tx,intent);await direct.authorizeRetry(f.tx,'actor',intent);assert.deepEqual(f.args,[['lockNode:node-z',f.tx,'node-z'],['authorized',f.tx,'actor',intent]]);
    for(const operation of ['create','update']as const){const invalid=fixture();invalid.options.invalidFacts=true;const native=invalid.adapters[0]!;
        await assert.rejects(operation==='create'?native.prepareCreate(invalid.tx,'actor',intent):native.prepareUpdate(invalid.tx,'actor',intent,next),/Listener is not allowed/);
        assert.deepEqual(invalid.events,operation==='create'?['authorized','lockNode:node-z']:['authorized','lock']);
        const after=fixture();after.options.invalidSlots=true;await assert.rejects(operation==='create'?after.adapters[0]!.prepareCreate(after.tx,'actor',intent):after.adapters[0]!.prepareUpdate(after.tx,'actor',intent,next),/reservation|resource|Fence|slot/i);
        assert.deepEqual(after.events,operation==='create'?['authorized','lockNode:node-z','reserve']:['authorized','lock','resourceTransition']);
    }
});

test('115 Direct adapter preserves the original error and stops without retry at each authorize lock reserve transition callback',async()=>{
    for(const [operation,stage,prefix]of [
        ['create','authorized',['authorized']],['create','lockNode:node-z',['authorized','lockNode:node-z']],['create','reserve',['authorized','lockNode:node-z','reserve']],
        ['update','authorized',['authorized']],['update','lock',['authorized','lock']],['update','resourceTransition',['authorized','lock','resourceTransition']],
    ]as const){const f=fixture();f.options.fail=stage;const current=forward(),next={...current,revision:3};await assert.rejects(operation==='create'?f.adapters[0]!.prepareCreate(f.tx,'actor',current):f.adapters[0]!.prepareUpdate(f.tx,'actor',current,next),error=>error===f.failure);assert.deepEqual(f.events,prefix);}
});

test('115 both Path adapters keep sorted authorize-lock order plan creation while disabled and conditional update authorization and planning',async()=>{
    for(let count=1;count<=2;count++){
        const f=fixture(),path=f.adapters[count]!,intent=forward(count),disabled=forward(count,false);
        await path.prepareCreate(f.tx,'actor',intent);const nodeIds=[intent.spec.ingress.nodeId,...intent.spec.path!.via].sort();assert.deepEqual(f.events,nodeIds.flatMap(id=>[`authorizedRelayNode:${id}`,`lockNode:${id}`]));
        for(let i=0;i<nodeIds.length;i++){assert.deepEqual(f.args[i*2],[`authorizedRelayNode:${nodeIds[i]}`,f.tx,'actor','scope-a',nodeIds[i],nodeIds[i]===intent.spec.ingress.nodeId?'ingress':nodeIds[i]===intent.spec.path!.via.at(-1)?'egress':'transit',intent]);assert.deepEqual(f.args[i*2+1],[`lockNode:${nodeIds[i]}`,f.tx,nodeIds[i]]);}
        f.clear();await path.planCreate(f.tx,'actor',disabled);assert.deepEqual(f.args,[['acceptPlan',f.tx,'actor',disabled]]);
        f.clear();await path.prepareUpdate(f.tx,'actor',intent,disabled);await path.planUpdate(f.tx,'actor',disabled);assert.deepEqual(f.args,[['lockNodes',f.tx,disabled]]);
        f.clear();await path.prepareUpdate(f.tx,'actor',disabled,intent);await path.planUpdate(f.tx,'actor',intent);assert.deepEqual(f.args,[['lockNodes',f.tx,intent],['canExecute',f.tx,'actor',intent],['acceptPlan',f.tx,'actor',intent]]);
        f.clear();await path.lockRemoval(f.tx,intent);await path.authorizeRetry(f.tx,'actor',intent);assert.deepEqual(f.args,[['lockNodes',f.tx,intent],['canExecute',f.tx,'actor',intent]]);
        f.clear();f.options.denied=true;await assert.rejects(path.authorizeRetry(f.tx,'actor',intent),{code:'AUTHORIZATION_DENIED',status:403,message:'Whole Relay path execution is not authorized'});assert.deepEqual(f.events,['canExecute']);
        f.clear();f.options.denied=true;await assert.rejects(path.prepareUpdate(f.tx,'actor',disabled,intent),{code:'AUTHORIZATION_DENIED',status:403,message:'Relay execution is not authorized'});assert.deepEqual(f.events,['lockNodes','canExecute']);
        for(const invalid of [forward(),{...intent,spec:{...intent.spec,transport:undefined}}]){f.clear();await assert.rejects(path.prepareCreate(f.tx,'actor',invalid as never),{code:'UNSUPPORTED_CAPABILITY',status:422,message:'Relay path and Transport Profile are both required'});assert.deepEqual(f.events,[]);}
    }
});

test('115 Path adapters propagate each owner failure at its original call and skip all following Node or plan work',async()=>{
    for(let count=1;count<=2;count++){
        const intent=forward(count),nodes=[intent.spec.ingress.nodeId,...intent.spec.path!.via].sort(),create=nodes.flatMap(id=>[`authorizedRelayNode:${id}`,`lockNode:${id}`]);
        for(const stage of create){const f=fixture();f.options.fail=stage;await assert.rejects(f.adapters[count]!.prepareCreate(f.tx,'actor',intent),error=>error===f.failure);assert.deepEqual(f.events,create.slice(0,create.indexOf(stage)+1));}
        for(const [name,args,events]of [['prepareUpdate',['actor',intent,intent],['lockNodes','canExecute']],['planCreate',['actor',intent],['acceptPlan']],['planUpdate',['actor',intent],['acceptPlan']],['lockRemoval',[intent],['lockNodes']],['authorizeRetry',['actor',intent],['canExecute']]]as [string,unknown[],string[]][]){
            for(const stage of events){const f=fixture();f.options.fail=stage;await assert.rejects(bindings(f.adapters[count])[name](f.tx,...args),error=>error===f.failure);assert.deepEqual(f.events,events.slice(0,events.indexOf(stage)+1));}
        }
    }
});

test('115 executor preserves moved-Node state first recovery/revoked refusal sorted locks selected adapter and retry lock transition capacity receivers',async()=>{
    const current=forward(),next={...current,revision:3,spec:{...current.spec,ingress:{...current.spec.ingress,nodeId:'node-a'}}};
    for(const [suspended,revoked]of [[false,false],[false,true],[true,false]]){const f=fixture();f.options.oldRevoked=revoked!;await assert.rejects(f.executor.prepareUpdate(f.tx,'actor',current,next,suspended!),{code:'UNSUPPORTED_CAPABILITY',status:422,message:'Live Node moves require the later multi-node coordinator'});assert.deepEqual(f.args,[['state',f.tx,'node-z']]);}
    const f=fixture(),customEvents:string[]=[];const adapters=ids.map(id=>adapter(id,(_owner,name,args)=>{customEvents.push(name);assert.deepEqual(args,[f.tx,'actor',current,next]);return Promise.resolve();}));
    const custom=new ForwardCommandExecutor<Tx>(f.nodes as never,f.resources as never,f.relay as never,f.execution as never,adapters);
    await custom.prepareUpdate(f.tx,'actor',current,next,true);assert.deepEqual(f.args,[['state',f.tx,'node-z'],['lockNode:node-a',f.tx,'node-a'],['lockNode:node-z',f.tx,'node-z']]);assert.deepEqual(customEvents,['prepareUpdate']);
    for(const enabled of [false,true]){const retry=fixture(),intent=forward(0,enabled);await retry.executor.prepareRetry(retry.tx,'actor',intent);assert.deepEqual(retry.args,[['authorized',retry.tx,'actor',intent],['lock',retry.tx,intent],...(enabled?[['executionTransition',retry.tx,'actor',intent]]:[])]);retry.clear();await retry.executor.assertCapacity(retry.tx,intent);await retry.executor.lock(retry.tx,intent);assert.deepEqual(retry.args,[['assertCapacity',retry.tx,intent],['lock',retry.tx,intent]]);}
    for(const stage of ['authorized','lock','executionTransition']){const failed=fixture();failed.options.fail=stage;await assert.rejects(failed.executor.prepareRetry(failed.tx,'actor',current),error=>error===failed.failure);assert.deepEqual(failed.events,['authorized','lock','executionTransition'].slice(0,['authorized','lock','executionTransition'].indexOf(stage)+1));}
});

test('executor ownership locking delegates the exact transaction and Forward and preserves resource refusal identity',async()=>{
    const f=fixture(),intent=forward();await f.executor.lockOwnership(f.tx,intent);
    assert.deepEqual(f.args,[['lockOwnership',f.tx,intent]]);
    f.clear();f.options.fail='lockOwnership';await assert.rejects(f.executor.lockOwnership(f.tx,intent),error=>error===f.failure);
    assert.deepEqual(f.events,['lockOwnership']);assert.deepEqual(f.args,[['lockOwnership',f.tx,intent]]);
});
