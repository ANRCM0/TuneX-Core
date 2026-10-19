import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import { DEFAULT_POLICY } from '@tunex/contracts';
import type { ForwardRuntimeStatus, Policy, RuntimeStatusNodeRecord, RuntimeStatusStorageReader } from '../src/framework/public.ts';
import { RuntimeStatusQueries } from '../src/modules/runtime-status-owner/public.ts';
import type { RuntimeStatusCodec } from '../src/modules/runtime-status-owner/public.ts';
import { MySqlRuntimeStatusStore } from '../src/infrastructure/mysql-runtime-status-store.ts';
import { MySqlRuntimeObservations } from '../src/infrastructure/mysql-runtime-observations.ts';
import { nativeRuntimeStatusCodec } from '../src/compatibility/public.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

const forward:Forward={id:'forward-a',scopeId:'scope-a',revision:2,spec:{enabled:true,protocols:['tcp'],
    ingress:{nodeId:'node-a',listen:{address:'127.0.0.1',port:9000}},target:{host:'example.test',port:80}}};
function fixture() {
    const tx=Object.freeze({id:'original'}),trace:string[]=[],failure=new Error('original status failure');
    const observation={assignmentId:'assignment-a',deploymentGeneration:3,bindingFence:4,phase:'active',condition:'ready',errorCode:null,retryable:false,
        nodeId:'untrusted',forwardRevision:-1,role:'untrusted',retained:{identity:true}};
    const assignment={...observation,forwardId:forward.id,forwardRevision:2,role:'direct',protocol:'udp'};
    const report={sessionEpoch:7,acceptedSnapshotGeneration:8,observations:[observation]};
    const current={assignments:[assignment],validUntil:'20000'},reported={validUntil:'18000'};
    const state:RuntimeStatusNodeRecord={node_id:'node-a',session_epoch:7,snapshot_generation:9,last_report:report,received_at:10000};
    const data={node:true,current:true,reported:true,fail:'',now:11000,reads:0};
    const store:RuntimeStatusStorageReader<typeof tx>={
        async node(supplied,id){assert.equal(this,store);assert.equal(supplied,tx);assert.equal(id,'node-a');trace.push('node');if(data.fail==='node')throw failure;return data.node?state:undefined;},
        async currentSnapshot(supplied,id,generation){assert.equal(this,store);assert.equal(supplied,tx);assert.deepEqual([id,generation],['node-a',9]);trace.push('current');if(data.fail==='current')throw failure;return data.current?{body:current}:undefined;},
        async reportedSnapshot(supplied,id,generation,epoch){assert.equal(this,store);assert.equal(supplied,tx);assert.deepEqual([id,generation,epoch],['node-a',report.acceptedSnapshotGeneration,report.sessionEpoch]);trace.push('reported');if(data.fail==='reported')throw failure;return data.reported?{body:reported}:undefined;},
    };
    const codec:RuntimeStatusCodec={
        read<T>(input:unknown):T{assert.equal(this,codec);const name=input===report?'read-report':input===current?`read-current-${++data.reads}`:'read-reported';trace.push(name);if(data.fail===name)throw failure;return input as T;},
        parseTime(input){assert.equal(this,codec);trace.push('parse:'+input);if(data.fail==='parse:'+input)throw failure;return Number(input);},
        formatTime(input){assert.equal(this,codec);trace.push('format:'+input);if(data.fail==='format:'+input)throw failure;return String(input);},
        now(){assert.equal(this,codec);trace.push('now');if(data.fail==='now')throw failure;return data.now;},
    };
    const policy:Policy={...DEFAULT_POLICY,observationFreshnessSeconds:4,maxClockSkewSeconds:1};
    return {tx,trace,failure,observation,assignment,report,current,reported,state,data,store,codec,policy,
        owner:new RuntimeStatusQueries(store,codec,policy)};
}

test('153 status optional storage and malformed epoch preserve lazy current and reported query boundaries',async()=>{
    for(const absent of ['node','report','current','reported'] as const){
        const f=fixture();
        if(absent==='node')f.data.node=false;
        if(absent==='report')f.state.last_report=undefined;
        if(absent==='current')f.data.current=false;
        if(absent==='reported')f.data.reported=false;
        if(absent==='node'){await assert.rejects(f.owner.status(f.tx,forward),TypeError);assert.deepEqual(f.trace,['node']);continue;}
        const result=await f.owner.status(f.tx,forward);assert.equal(result.health.condition,'unknown');
        assert.deepEqual(f.trace,absent==='report'?['node','current','read-current-1','format:10000']:
            absent==='current'?['node','read-report','current','reported','format:10000']:
            ['node','read-report','current','read-current-1','reported','format:10000']);
    }
    const f=fixture();(f.report as {sessionEpoch:number|undefined}).sessionEpoch=undefined;
    await f.owner.status(f.tx,forward);assert.ok(f.trace.includes('reported'));
    for(const value of [0,null,false,'']){const next=fixture();next.state.last_report=value;next.state.snapshot_generation=0;
        assert.deepEqual(await next.owner.status(next.tx,forward),{applied:[],health:{condition:'unknown',receivedAt:'10000',freshUntil:null}});
        assert.deepEqual(next.trace,['node','format:10000']);}
});

test('153 status first provider decoder time and formatter errors retain identity and stop later effects',async()=>{
    const ordered=['node','read-report','current','read-current-1','reported','read-current-2','parse:20000','read-reported','parse:18000','now','format:10000','format:14000'];
    for(const failed of ordered){const f=fixture();f.data.fail=failed;
        await assert.rejects(f.owner.status(f.tx,forward),error=>error===f.failure);
        assert.deepEqual(f.trace,ordered.slice(0,ordered.indexOf(failed)+1),failed);}
    const f=fixture();(f.report as {observations:unknown}).observations=null;
    await assert.rejects(f.owner.status(f.tx,forward),TypeError);assert.deepEqual(f.trace,['node','read-report','current','read-current-1']);
});

test('153 raw status adapter returns absent rows uses an undefined epoch placeholder and preserves execute errors',async()=>{
    const calls:{sql:string;args:unknown[]}[]=[],failure=new Error('driver'),store=new MySqlRuntimeStatusStore();let fail=false;
    const tx={async execute(sql:string,args:unknown[]){assert.equal(this,tx);calls.push({sql,args});if(fail)throw failure;return [[],[]];}} as unknown as Transaction;
    assert.equal(await store.node(tx,'node-a'),undefined);assert.equal(await store.currentSnapshot(tx,'node-a',0),undefined);
    assert.equal(await store.reportedSnapshot(tx,'node-a',0,undefined as unknown as number),undefined);
    assert.deepEqual(calls,[{sql:'SELECT * FROM runtime_nodes WHERE node_id=?',args:['node-a']},
        {sql:'SELECT body FROM snapshots WHERE node_id=? AND generation=?',args:['node-a',0]},
        {sql:'SELECT body FROM snapshots WHERE node_id=? AND generation=? AND session_epoch=?',args:['node-a',0,undefined]}]);
    fail=true;for(const action of [()=>store.node(tx,'n'),()=>store.currentSnapshot(tx,'n',1),()=>store.reportedSnapshot(tx,'n',1,2)])
        await assert.rejects(action,error=>error===failure);
});

test('154 status retains tuple order spread references policy copy and permissive identities without protocol matching',async()=>{
    const f=fixture();f.policy.observationFreshnessSeconds=0;
    f.report.observations.unshift({...f.observation,assignmentId:'unmatched'});
    f.report.observations.push({...f.observation,phase:'absent'});
    const result=await f.owner.status(f.tx,forward);
    assert.equal(result.health.condition,'degraded');assert.equal(result.health.freshUntil,'14000');
    assert.deepEqual(result.applied.map(value=>[value.nodeId,value.role,value.forwardRevision,value.phase]),[['node-a','direct',2,'active'],['node-a','direct',2,'absent']]);
    assert.equal((result.applied[0] as unknown as {retained:unknown}).retained,f.observation.retained);
    const single=fixture();single.assignment.protocol='udp';assert.equal((await single.owner.status(single.tx,forward)).health.condition,'ready');
    single.observation.condition='error';assert.equal((await single.owner.status(single.tx,forward)).health.condition,'degraded');
});

test('154 status earliest window equality null zero NaN and unknown epoch keep native truthy formatting and clock sampling',async()=>{
    for(const [received,current,reported,now,condition,fresh] of [
        [10000,'12000','18000',11000,'unknown','11000'],[10000,'20000','12000',10999,'ready','11000'],
        [0,'20000','18000',0,'ready','4000'],[null,'20000','18000',0,'unknown',null],
        [10000,'1000','18000',-1,'ready',null],[10000,'NaN','18000',0,'unknown',null],
    ] as const){const f=fixture();f.state.received_at=received;f.current.validUntil=current;f.reported.validUntil=reported;f.data.now=now;
        const result=await f.owner.status(f.tx,forward);assert.equal(result.health.condition,condition);assert.equal(result.health.freshUntil,fresh);
        assert.equal(result.health.receivedAt,received?String(received):null);assert.equal(f.trace.filter(x=>x==='now').length,received===null?0:1);}
    const f=fixture();f.state.session_epoch++;assert.equal((await f.owner.status(f.tx,forward)).health.condition,'unknown');assert.ok(f.trace.includes('now'));
    const invalid=fixture();invalid.state.received_at=Number.POSITIVE_INFINITY;invalid.codec.formatTime=nativeRuntimeStatusCodec.formatTime;
    await assert.rejects(invalid.owner.status(invalid.tx,forward),RangeError);
});

test('154 path projection dispatches serial overrides removes path and preserves unknown null minimum and parse order',async()=>{
    const tx={},seen:Forward[]=[],trace:string[]=[],failure=new Error('second node'),responses:ForwardRuntimeStatus[]=[
        {applied:[{nodeId:'wrong',forwardRevision:1,role:'direct'} as never],health:{condition:'ready',receivedAt:'30',freshUntil:'90'}},
        {applied:[],health:{condition:'degraded',receivedAt:'20',freshUntil:'80'}},
        {applied:[],health:{condition:'unknown',receivedAt:null,freshUntil:null}},
    ];let fail=false;
    const codec={...nativeRuntimeStatusCodec,parseTime(value:string){trace.push('parse:'+value);return Number(value);},formatTime(value:number){trace.push('format:'+value);return String(value);}};
    class Derived extends RuntimeStatusQueries<object>{override async status(supplied:object,value:Forward):Promise<ForwardRuntimeStatus>{
        assert.equal(supplied,tx);if(value.spec.path)return super.status(supplied,value);
        seen.push(value);trace.push('node:'+value.spec.ingress.nodeId);if(fail&&seen.length===2)throw failure;return responses[seen.length-1]!;
    }}
    const owner=new Derived({node:async()=>assert.fail('override ignored'),currentSnapshot:async()=>assert.fail(),reportedSnapshot:async()=>assert.fail()},codec,DEFAULT_POLICY);
    const path={...forward,spec:{...forward.spec,path:{via:['node-b','node-c']}}};const result=await owner.status(tx,path);
    assert.deepEqual(seen.map(value=>value.spec.ingress.nodeId),['node-a','node-b','node-c']);
    for(const value of seen){assert.equal(Object.hasOwn(value.spec,'path'),false);assert.equal(value.id,forward.id);assert.equal(value.spec.target,forward.spec.target);assert.equal(value.spec.ingress.listen,forward.spec.ingress.listen);}
    assert.deepEqual(result.health,{condition:'unknown',receivedAt:null,freshUntil:null});assert.equal(result.applied[0]!.nodeId,'node-a');
    assert.deepEqual(trace,['node:node-a','node:node-b','node:node-c','parse:90','parse:80','parse:30','parse:20']);
    seen.length=0;trace.length=0;responses.pop();path.spec.path.via.pop();
    assert.deepEqual((await owner.status(tx,path)).health,{condition:'degraded',receivedAt:'20',freshUntil:'80'});
    assert.deepEqual(trace,['node:node-a','node:node-b','parse:90','parse:80','parse:30','parse:20','format:20','format:80']);
    seen.length=0;trace.length=0;responses[1]!.health.condition='ready';assert.equal((await owner.status(tx,path)).health.condition,'ready');
    seen.length=0;trace.length=0;fail=true;await assert.rejects(owner.status(tx,path),error=>error===failure);assert.deepEqual(trace,['node:node-a','node:node-b']);
});

test('154 legacy native status wrapper retains one-argument own method dynamic clock permissive references and native invalid dates',async t=>{
    assert.equal(MySqlRuntimeObservations.length,1);assert.ok(Object.hasOwn(MySqlRuntimeObservations.prototype,'status'));
    const value={identity:true};assert.equal(nativeRuntimeStatusCodec.read(value),value);assert.equal(nativeRuntimeStatusCodec.parseTime('bad'),Number.NaN);
    assert.throws(()=>nativeRuntimeStatusCodec.formatTime(Number.NaN),RangeError);
    const prior=Date.now;t.after(()=>{Date.now=prior;});let now=10000;Date.now=()=>now;
    assert.equal(nativeRuntimeStatusCodec.now(),10000);now=20000;assert.equal(nativeRuntimeStatusCodec.now(),20000);
    const tx={async execute(sql:string){if(sql.includes('runtime_nodes'))return [[{session_epoch:1,snapshot_generation:0,last_report:null,received_at:0}],[]];assert.fail(sql);}} as unknown as Transaction;
    assert.deepEqual(await new MySqlRuntimeObservations(DEFAULT_POLICY).status(tx,forward),{applied:[],health:{condition:'unknown',receivedAt:null,freshUntil:null}});
});
