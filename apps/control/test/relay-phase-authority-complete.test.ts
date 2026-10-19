import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import { MAX_COUNTER } from '@tunex/core';
import { RuntimeRelayHost } from '../src/framework/public.ts';
import type { RuntimeRelayDeployment } from '../src/framework/public.ts';
import { nativeRelayCompiler } from '../src/compatibility/public.ts';
import { multihopFixture } from './fixtures/multihop.ts';

type Event={name:string;args:unknown[]};
function fixture(){
    const tx={},input=multihopFixture(),plan=nativeRelayCompiler.multihopPlan(input),events:Event[]=[],failure=new Error('original Relay phase provider');
    const state={now:Date.parse(input.issuedAt)+1000,fail:'',currentPins:true,issuedPins:true,missingSnapshot:'',missingSession:'',pending:1,occupied:new Set<number>(),requested:[] as unknown[][]};
    const record:RuntimeRelayDeployment={forward_id:input.forward.id,generation:9,target_revision:1,ingress_node_id:plan.nodes[0]!.nodeId,egress_node_id:plan.nodes.at(-1)!.nodeId,body:JSON.stringify(plan),stage:'preparing',prepared_count:0,activated_count:0};
    const forward={...input.forward,deleting:false,recoverySuspended:false},op={id:'operation',scope_id:forward.scopeId,forward_id:forward.id,target_revision:1,status:'running',kind:'create',execution_deadline:state.now+600000,recovery_invalidated:0,requested_by:'actor',cleanup_pending:1};
    function call(self:unknown,owner:unknown,name:string,args:unknown[]){assert.equal(self,owner);assert.equal(args[0],tx);events.push({name,args});if(state.fail===name)throw failure;}
    const nodes={async authorizedRelayNode(this:unknown,...args:unknown[]){call(this,nodes,`grant:${args[3]}`,args);return input.nodes.find(n=>n.facts.nodeId===args[3])!.facts;},async facts(this:unknown,...args:unknown[]){call(this,nodes,`facts:${args[1]}`,args);const n=input.nodes.find(n=>n.facts.nodeId===args[1])!;return {facts:n.facts,credentialUntil:n.credentialUntil};},async relayCredentialFacts(this:unknown,...args:unknown[]){call(this,nodes,`peers:${args[1]}:${args[2]===true?'current':'issued'}`,args);const n=input.nodes.find(n=>n.facts.nodeId===args[1])!;
        if(args[2]===true)return state.currentPins?n.peers:[{fingerprint:'sha256:'+'e'.repeat(64),validUntil:state.now+3600000}];
        return state.issuedPins?n.peers:[];}};
    const transport={async resolve(this:unknown,...args:unknown[]){call(this,transport,'profile',args);return input.profile;}};
    const endpoints={async resolve(this:unknown,...args:unknown[]){call(this,endpoints,`endpoint:${args[1]}`,args);return input.endpoints.find(e=>e.nodeId===args[1])!;}};
    const store={async forForward(this:unknown,...args:unknown[]){call(this,store,'history',args);return [record];},async latest(this:unknown,...args:unknown[]){call(this,store,'latest',args);return record;},async forNode(this:unknown,...args:unknown[]){call(this,store,'forNode',args);return [record];},async touch(this:unknown,...args:unknown[]){call(this,store,'touch',args);},async insertMultihop(this:unknown,...args:unknown[]){call(this,store,'insert',args);state.requested.push(args);},async setPreparation(this:unknown,...args:unknown[]){call(this,store,'prepare',args);},async incrementActivation(this:unknown,...args:unknown[]){call(this,store,'increment',args);},async activate(this:unknown,...args:unknown[]){call(this,store,'activate',args);},async withdraw(this:unknown,...args:unknown[]){call(this,store,'withdraw',args);}};
    const ledger={async lockNode(this:unknown,...args:unknown[]){call(this,ledger,`lock:${args[1]}`,args);},async latest(this:unknown,...args:unknown[]){call(this,ledger,'operation',args);return op;},async reserveRelay(this:unknown,...args:unknown[]){call(this,ledger,'reserve',args);return (args[2] as typeof input.reservations).map((r,i)=>({...r,forwardId:forward.id,deploymentGeneration:args[3],bindingFence:i+10}));},async sessionAuthoritySafe(this:unknown,...args:unknown[]){call(this,ledger,'sessionSafe',args);return true;},async accept(this:unknown,...args:unknown[]){call(this,ledger,'accept',args);return 'refresh-operation';},async assertCapacity(this:unknown,...args:unknown[]){call(this,ledger,'capacity',args);}};
    const forwards={async authorizer(this:unknown,...args:unknown[]){call(this,forwards,'actor',args);return 'actor';},async record(this:unknown,...args:unknown[]){call(this,forwards,'forward',args);return forward;}};
    const snapshots=new Map<string,any>(),runtimes=new Map<string,any>();
    const observations={async nodeSession(this:unknown,...args:unknown[]){call(this,observations,`session:${args[1]}`,args);const n=input.nodes.find(n=>n.facts.nodeId===args[1])!;return state.missingSession===n.facts.nodeId?undefined:{session_epoch:n.sessionEpoch};},async portOwner(this:unknown,...args:unknown[]){call(this,observations,`port:${args[1]}:${args[2]}`,args);return state.occupied.has(Number(args[2]))?{owner_id:'other-forward'}:undefined;},async runtimeNode(this:unknown,...args:unknown[]){call(this,observations,`runtime:${args[1]}`,args);return runtimes.get(String(args[1]));},async snapshot(this:unknown,...args:unknown[]){call(this,observations,`snapshot:${args[1]}`,args);return state.missingSnapshot===args[1]?undefined:{body:JSON.stringify(snapshots.get(String(args[1])))};},async pendingRetirementCount(this:unknown,...args:unknown[]){call(this,observations,'pending',args);return state.pending;}};
    const host=new RuntimeRelayHost({nodes,transport,endpoints,store,ledger,forwards,observations,compiler:nativeRelayCompiler,policy:DEFAULT_POLICY,multihopEnabled:true,now:()=>state.now} as never);
    function evidence(phase:(index:number)=>'prepared'|'active'){
        for(const [index,node]of plan.nodes.entries()){
            const selected=phase(index),assignments=node.assignments.map(a=>({...a,phase:selected}));snapshots.set(node.nodeId,{nodeId:node.nodeId,sessionEpoch:node.sessionEpoch,snapshotGeneration:1,validUntil:new Date(state.now+60000).toISOString(),assignments});
            runtimes.set(node.nodeId,{session_epoch:node.sessionEpoch,snapshot_generation:1,received_at:state.now,last_report:JSON.stringify({sessionEpoch:node.sessionEpoch,acceptedSnapshotGeneration:1,observations:assignments.map(a=>({assignmentId:a.assignmentId,deploymentGeneration:a.deploymentGeneration,bindingFence:a.bindingFence,phase:selected,condition:selected==='prepared'?'prepared':'ready'}))})});
        }
    }
    evidence(()=> 'prepared');
    return {tx,input,plan,events,failure,state,record,forward,op,nodes,transport,endpoints,store,ledger,forwards,observations,host,snapshots,runtimes,evidence,clear(){events.length=0;}};
}
const names=(f:ReturnType<typeof fixture>)=>f.events.map(e=>e.name);
const mutations=(f:ReturnType<typeof fixture>)=>names(f).filter(n=>['reserve','insert','prepare','increment','activate','withdraw','accept','capacity'].includes(n));

test('11 preview retains sorted grant facts session current-peer then Profile/endpoints and does not reserve or probe port ownership',async()=>{
    const f=fixture(),result=await f.host.preview(f.tx,'actor',f.forward);
    assert.deepEqual(names(f),f.input.nodes.flatMap(n=>[`grant:${n.facts.nodeId}`,`facts:${n.facts.nodeId}`,`session:${n.facts.nodeId}`,`peers:${n.facts.nodeId}:current`]).concat(['profile',...f.input.endpoints.map(e=>`endpoint:${e.nodeId}`)]));
    assert.equal(result.reserved,false);assert.deepEqual(result.resources,nativeRelayCompiler.multihopResources(f.input));assert.deepEqual(mutations(f),[]);
    for(const step of names(f)){const g=fixture();g.state.fail=step;await assert.rejects(g.host.preview(g.tx,'actor',g.forward),e=>e===g.failure);assert.deepEqual(names(g),names(f).slice(0,names(f).indexOf(step)+1));assert.deepEqual(mutations(g),[]);}
    const missing=fixture();missing.state.missingSession=missing.input.nodes[1]!.facts.nodeId;await assert.rejects(missing.host.preview(missing.tx,'actor',missing.forward),{code:'SESSION_SUPERSEDED'});assert.equal(names(missing).includes(`peers:${missing.state.missingSession}:current`),false);
});

test('11 accept keeps historical sorted locks previous generation and preferred old ports before fallback exclusive reservation',async()=>{
    const f=fixture();for(const endpoint of f.input.endpoints)endpoint.config.allowedTcpPorts.unshift(35000+Number(endpoint.nodeId.at(-1)));
    const result=await f.host.acceptPlan(f.tx,'actor',f.forward);assert.equal(result.deploymentGeneration,10);
    assert.deepEqual(names(f).slice(0,5),['history','lock:node-1','lock:node-2','lock:node-3','latest']);
    assert.deepEqual(f.events.filter(e=>e.name.startsWith('port:')).map(e=>e.args.slice(1)),f.input.endpoints.flatMap(e=>[[e.nodeId,e.config.allowedTcpPorts[1]],[e.nodeId,e.config.allowedTcpPorts[2]]]));
    const insert=f.state.requested[0]!;assert.equal(insert[0],f.tx);assert.equal(insert[1],f.forward);assert.equal(insert[2],10);assert.equal(insert[3],result);assert.deepEqual(insert.slice(4),[f.state.now,f.state.now]);assert.deepEqual(mutations(f),['reserve','insert']);
    const occupied=fixture();occupied.input.endpoints[0]!.config.allowedTcpPorts.push(34000);occupied.state.occupied.add(33000);
    const replacement=await occupied.host.acceptPlan(occupied.tx,'actor',occupied.forward);
    const chosen=replacement.nodes.find(n=>n.nodeId==='node-2')!.assignments.find(a=>a.protocol==='tcp')!;assert.equal(chosen.resource.port,33001);
    assert.deepEqual(occupied.events.filter(e=>e.name.startsWith('port:node-2:')).map(e=>e.args[2]),[33000,33001,33000,34000]);
    const exhausted=fixture();exhausted.record.generation=MAX_COUNTER;await assert.rejects(exhausted.host.acceptPlan(exhausted.tx,'actor',exhausted.forward),{code:'RESOURCE_LIMIT'});assert.deepEqual(names(exhausted),['history','lock:node-1','lock:node-2','lock:node-3','latest']);
});

test('11 every preparing cursor and activation phase admits only downstream-authorized assignments with original session safety',async()=>{
    for(const stage of ['preparing','egress_active','active'] as const)for(const count of [0,1,2,3]){
        const f=fixture();f.record.stage=stage;f.record.prepared_count=count;f.record.activated_count=count;
        for(const [index,node]of f.plan.nodes.entries()){
            f.clear();const assignments=await f.host.assignments(f.tx,node.nodeId);
            const admitted=stage!=='preparing'||index>=3-Math.min(3,count+1);
            assert.equal(assignments.length,admitted?node.assignments.length:0,`${stage}:${count}:${index}`);
            if(admitted)assert.ok(assignments.every(a=>a.phase===(stage==='active'||stage!=='preparing'&&index>=3-count?'active':'prepared')));
            assert.equal(names(f).includes('sessionSafe'),true);assert.deepEqual(mutations(f),[]);
        }
    }
    const f=fixture();f.ledger.sessionAuthoritySafe=async()=>false;assert.deepEqual(await f.host.assignments(f.tx,'node-3'),[]);
    assert.equal((await f.host.assignments(f.tx,'node-1',true)).length,2,'accepted capacity projection bypasses session/cursor admission but does not publish');
});

test('11 downstream prepare/activate advances only after exact matching reports and original three-node cursor boundaries',async()=>{
    for(const prepared of [0,1,2]){
        const f=fixture();f.record.prepared_count=prepared;await f.host.advance(f.tx,f.forward.id);
        const event=f.events.find(e=>e.name==='prepare')!;assert.ok(event);assert.deepEqual(event.args,[f.tx,f.forward.id,9,prepared+1,prepared===2?'egress_active':'preparing',prepared===2?1:0,f.state.now]);
        assert.deepEqual(f.events.filter(e=>e.name.startsWith('runtime:')).map(e=>e.name),f.plan.nodes.slice(2-prepared).map(n=>`runtime:${n.nodeId}`));
    }
    for(const activated of [1,2,3]){
        const f=fixture();f.record.stage='egress_active';f.record.activated_count=activated;f.evidence(index=>index>=3-activated?'active':'prepared');await f.host.advance(f.tx,f.forward.id);
        assert.deepEqual(mutations(f),[activated===3?'activate':'increment']);if(activated===3)assert.ok(names(f).includes('pending'));
    }
});

test('11 stale report and Snapshot generation epoch fence config phase and exact expiry refuse every phase transition',async()=>{
    for(const stage of ['preparing','egress_active'] as const)for(const mode of ['runtime-epoch','report-epoch','report-generation','snapshot-absent','snapshot-fence','snapshot-generation','snapshot-digest','snapshot-phase','report-fence','report-phase','report-condition','received-expiry','snapshot-expiry']){
        const f=fixture();f.record.stage=stage;f.record.prepared_count=0;f.record.activated_count=1;f.evidence(index=>stage==='egress_active'&&index===2?'active':'prepared');
        const id='node-3',runtime=f.runtimes.get(id),snapshot=f.snapshots.get(id),report=JSON.parse(runtime.last_report);
        if(mode==='runtime-epoch')runtime.session_epoch++;
        if(mode==='report-epoch')report.sessionEpoch++;
        if(mode==='report-generation')report.acceptedSnapshotGeneration++;
        if(mode==='snapshot-absent')f.state.missingSnapshot=id;
        if(mode==='snapshot-fence')snapshot.assignments[0].bindingFence++;
        if(mode==='snapshot-generation')snapshot.assignments[0].deploymentGeneration++;
        if(mode==='snapshot-digest')snapshot.assignments[0].driver={...snapshot.assignments[0].driver,configDigest:'wrong'};
        if(mode==='snapshot-phase')snapshot.assignments[0].phase=stage==='egress_active'?'prepared':'active';
        if(mode==='report-fence')report.observations[0].bindingFence++;
        if(mode==='report-phase')report.observations[0].phase=stage==='egress_active'?'prepared':'active';
        if(mode==='report-condition')report.observations[0].condition='error';
        if(mode==='received-expiry')runtime.received_at=f.state.now-DEFAULT_POLICY.observationFreshnessSeconds*1000;
        if(mode==='snapshot-expiry')snapshot.validUntil=new Date(f.state.now+DEFAULT_POLICY.maxClockSkewSeconds*1000).toISOString();
        runtime.last_report=JSON.stringify(report);await f.host.advance(f.tx,f.forward.id);assert.deepEqual(mutations(f),[],`${stage}:${mode}`);assert.ok(names(f).includes('touch'));
    }
});

test('11 every phase refuses replacement current pins while still-issued retiring pins bound old authority until the original provider cutoff',async()=>{
    for(const stage of ['preparing','egress_active','active'] as const)for(const count of [0,1,2,3]){
        const f=fixture();f.record.stage=stage;f.record.prepared_count=count;f.record.activated_count=count;f.state.currentPins=false;
        for(const node of f.plan.nodes)assert.deepEqual(await f.host.assignments(f.tx,node.nodeId),[],`${stage}:${count}:${node.nodeId}`);
        f.clear();assert.equal(await f.host.authorizationBound(f.tx,f.plan.nodes.flatMap(n=>n.assignments)),f.plan.authorizationUntil);
        assert.ok(f.events.filter(e=>e.name.startsWith('peers:')).every(e=>e.name.endsWith(':issued')));
        f.state.issuedPins=false;await assert.rejects(f.host.authorizationBound(f.tx,f.plan.nodes[0]!.assignments),{code:'AUTHORIZATION_DENIED'});
    }
});
