import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import { MAX_COUNTER } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import type { RuntimeAssignmentValue, RuntimeSnapshotValue, RuntimeReportRequestValue } from '@tunex/contracts/execution-values';
import { RuntimeLedgerHost, RuntimeHost } from '../src/framework/public.ts';
import type { RuntimeHostOptions, RuntimeLedgerOptions, RuntimeOperation, RuntimeRetirement, RuntimeRetirementKey } from '../src/framework/public.ts';
import { nativeLedgerCompiler, runtimeCodec } from '../src/compatibility/public.ts';
import type { NativeRuntimeFamily } from '../src/compatibility/public.ts';
import { Forwarding } from '../src/modules/forwarding.ts';
import { MySqlRuntimeLedgerStore } from '../src/infrastructure/mysql-runtime-ledger.ts';
import { NodePortLimitPolicy } from '../src/modules/node-owner/public.ts';
import { MySqlNodeAuthorityStore } from '../src/infrastructure/mysql-node-authority.ts';
import { MySqlRuntimeResourceStore, createMySqlRuntimeResources } from '../src/infrastructure/mysql-runtime-resources.ts';
import { MySqlUnitOfWork, rows, write, json } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

type Event={name:string;args:unknown[]};
function fixture(){
    const tx={identity:Symbol()},events:Event[]=[],failure=new Error('original Ledger provider failure');
    const forward:Forward&{deleting:boolean;recoverySuspended:boolean}={id:'forward-a',scopeId:'scope-a',revision:2,deleting:false,recoverySuspended:false,
        spec:{enabled:true,protocols:['tcp'],ingress:{nodeId:'node-a',listen:{address:'127.0.0.1',port:32001}},target:{host:'127.0.0.1',port:32002}}};
    const facts={nodeId:'node-a',scopeId:'scope-a',capabilities:['adp.3','native.direct.v1','tcp'],allowedListenerAddresses:['127.0.0.1'],allowedPorts:[32001],
        egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false};
    const op:RuntimeOperation={id:'old-operation',scope_id:forward.scopeId,forward_id:forward.id,target_revision:2,kind:'create',status:'running',execution_deadline:90000,
        claim_token:'old-token',claim_until:20000,cleanup_pending:1,last_error:null,source_operation_id:null,previous_spec:null,created_at:101,requested_by:'actor-a',recovery_invalidated:0};
    const assignment:RuntimeAssignmentValue={assignmentId:'assignment-a',forwardId:forward.id,forwardRevision:2,deploymentGeneration:3,bindingFence:4,
        role:'direct',protocol:'tcp',phase:'active',resource:{address:'127.0.0.1',port:32001,protocol:'tcp'},driver:{id:'test',configDigest:'digest'},drainTimeoutSeconds:30};
    const snapshot:RuntimeSnapshotValue={nodeId:'node-a',sessionEpoch:1,snapshotGeneration:4,complete:true,issuedAt:'10000',validUntil:'30000',snapshotDigest:'snapshot',assignments:[assignment],tombstones:[]};
    const report:RuntimeReportRequestValue={nodeId:'node-a',bootId:'boot',sessionEpoch:1,reportSequence:1,observedAt:'10000',acceptedSnapshotGeneration:4,
        observations:[{assignmentId:'assignment-a',deploymentGeneration:3,bindingFence:4,phase:'active',condition:'ready',errorCode:null,retryable:false}],drains:[]};
    const retirement:RuntimeRetirement={node_id:'node-a',assignment_id:assignment.assignmentId,deployment_generation:3,binding_fence:4,forward_id:forward.id,operation_id:op.id,
        body:JSON.stringify(assignment),removed_epoch:null,retirement_generation:4,safe:0};
    const data={now:10000,fail:'',authorized:true,actor:'actor-a' as string|null,forwards:[forward] as Forward[],operations:[op],retired:[] as RuntimeRetirement[],
        quarantine:[] as Array<{node_id:string;generation:number;body:unknown}>,snapshot:{body:JSON.stringify(snapshot)} as {body:unknown}|undefined,
        pending:0,unsafe:0,outstanding:0,claim:op as RuntimeOperation|undefined,operation:op as RuntimeOperation|undefined,
        directHook:undefined as (()=>void)|undefined,snapshotHook:undefined as ((input:unknown)=>void)|undefined};
    function called(self:unknown,owner:unknown,name:string,args:unknown[],transaction=true){assert.equal(self,owner);if(transaction)assert.equal(args[0],tx);events.push({name,args});if(data.fail===name)throw failure;}
    const store={
        async beginQuarantine(this:unknown,...args:unknown[]){called(this,store,'beginQuarantine',args);return data.quarantine;},
        async quarantineRetirement(this:unknown,...args:unknown[]){called(this,store,'quarantineRetirement',args);},
        async assignmentOperations(this:unknown,...args:unknown[]){called(this,store,'operations',args);return data.operations;},
        async assignmentSlots(this:unknown,...args:unknown[]){called(this,store,'slots',args);return [{owner_id:forward.id,protocol:'tcp',port:32001,fence:4,deployment_generation:3}];},
        async latestSnapshot(this:unknown,...args:unknown[]){called(this,store,'latestSnapshot',args);return data.snapshot;},
        async nodeSession(this:unknown,...args:unknown[]){called(this,store,'session',args);return {session_epoch:0};},
        async operationForRevision(this:unknown,...args:unknown[]){called(this,store,'operationForRevision',args);return data.operation;},
        async latestOperation(this:unknown,...args:unknown[]){called(this,store,'latest',args);return data.operation;},
        async acceptOperation(this:unknown,...args:unknown[]){called(this,store,'accept',args);},
        async retireAssignment(this:unknown,...args:unknown[]){called(this,store,'retire',args);},
        async retirements(this:unknown,...args:unknown[]){called(this,store,'retirements',args);return data.retired;},
        async unsafeRetirementsForUpdate(this:unknown,...args:unknown[]){called(this,store,'retirementLocks',args);return [];},
        async completionOperations(this:unknown,...args:unknown[]){called(this,store,'operationLocks',args);return data.operations;},
        async pendingRetirementCount(this:unknown,...args:unknown[]){called(this,store,'pending',args);return data.pending;},
        async unsafeLeaseCount(this:unknown,...args:unknown[]){called(this,store,'unsafe',args);return data.unsafe;},
        async outstandingRetirementLeases(this:unknown,...args:unknown[]){called(this,store,'outstanding',args);return data.outstanding;},
        async markRetirementSafe(this:unknown,...args:unknown[]){called(this,store,'safe',args);},
        async completeOperation(this:unknown,...args:unknown[]){called(this,store,'complete',args);},
        async clearFailedSupersededCleanup(this:unknown,...args:unknown[]){called(this,store,'clearPrior',args);},
        async clearOperationCleanup(this:unknown,...args:unknown[]){called(this,store,'clearOwn',args);},
        async previousUnsafeLeases(this:unknown,...args:unknown[]){called(this,store,'previousLeases',args);return [];},
        async getOperation(this:unknown,...args:unknown[]){called(this,store,'get',args);return data.operation;},
        async expireOperations(this:unknown,...args:unknown[]){called(this,store,'expire',args);},
        async claimableOperation(this:unknown,...args:unknown[]){called(this,store,'claimable',args);return data.claim;},
        async claimOperation(this:unknown,...args:unknown[]){called(this,store,'claim',args);},
    };
    const resources=Object.fromEntries(['lockNode','releaseForwardSlots','releaseObsoleteSlots'].map(name=>[name,async function(this:unknown,...args:unknown[]){called(this,resources,name,args);} ]));
    const forwarding={async forNode(this:unknown,...args:unknown[]){called(this,forwarding,'forwards',args);return data.forwards;},
        async authorizer(this:unknown,...args:unknown[]){called(this,forwarding,'authorizer',args);return data.actor;},
        async record(this:unknown,...args:unknown[]){called(this,forwarding,'forwardRead',args);return forward;}};
    const authorization={async canExecute(this:unknown,...args:unknown[]){called(this,authorization,'authorize',args);return data.authorized;}};
    const assignments={async merge(this:unknown,...args:unknown[]){called(this,assignments,'merge',args);return [...args[2] as RuntimeAssignmentValue[]];}};
    const compiler={parseTime(this:unknown,value:string){called(this,compiler,'parseTime',[value],false);return Number(value);},
        formatTime(this:unknown,value:number){called(this,compiler,'formatTime',[value],false);return String(value);},
        targetAllowed(this:unknown,...args:unknown[]){called(this,compiler,'target',args,false);return true;},
        direct(this:unknown,...args:unknown[]){called(this,compiler,'direct',args,false);data.directHook?.();return [assignment];},
        decodeSnapshot(this:unknown,value:unknown){called(this,compiler,'decodeSnapshot',[value],false);return nativeLedgerCompiler.decodeSnapshot(value);},
        decodeAssignment(this:unknown,value:unknown){called(this,compiler,'decodeAssignment',[value],false);return nativeLedgerCompiler.decodeAssignment(value);},
        snapshot(this:unknown,input:{assignments:RuntimeAssignmentValue[]}){called(this,compiler,'snapshot',[input],false);data.snapshotHook?.(input);return {...input,complete:true,snapshotDigest:'compiled'};},
    };
    const options={policy:DEFAULT_POLICY,store,resources,authorization,assignments,compiler,now:()=>{events.push({name:'now',args:[data.now]});return data.now;},
        newID:()=>{events.push({name:'id',args:[]});return 'new-operation';}} as unknown as RuntimeLedgerOptions<typeof tx>;
    return {tx,events,failure,forward,facts,op,assignment,snapshot,report,retirement,data,store,resources,forwarding,authorization,assignments,compiler,options,host:()=>new RuntimeLedgerHost(options)};
}
const names=(f:ReturnType<typeof fixture>)=>f.events.map(e=>e.name);

test('10 Ledger quarantine decodes only after original writes and keeps duplicate instance retirement ownership generation and provider order',async()=>{
    const f=fixture(),duplicate={...f.assignment};f.data.quarantine=[{node_id:'node-a',generation:MAX_COUNTER,body:JSON.stringify({...f.snapshot,assignments:[f.assignment,duplicate]})}];
    await f.host().quarantineRecovery(f.tx);
    assert.deepEqual(names(f),['beginQuarantine','decodeSnapshot','latest','quarantineRetirement','latest','quarantineRetirement']);
    for(const event of f.events.filter(e=>e.name==='quarantineRetirement'))assert.deepEqual(event.args,[f.tx,'node-a',f.assignment,f.op.id,MAX_COUNTER]);
    const absent=fixture();absent.data.operation=undefined;absent.data.quarantine=[{node_id:'node-a',generation:2,body:JSON.stringify(absent.snapshot)}];await absent.host().quarantineRecovery(absent.tx);
    assert.deepEqual(names(absent),['beginQuarantine','decodeSnapshot','latest']);
    const bad=fixture();bad.data.quarantine=[{node_id:'node-a',generation:1,body:'{'}];await assert.rejects(bad.host().quarantineRecovery(bad.tx),SyntaxError);
    assert.deepEqual(names(bad),['beginQuarantine','decodeSnapshot']);
});

test('10 Ledger empty Relay-only unauthorized and succeeded work retain original laziness filtering and exact provider receivers',async()=>{
    for(const mode of ['empty','relay','no-actor','no-authorization','denied','succeeded-expired','accepted-opt-in']){
        const f=fixture();f.op.previous_spec='{';f.op.last_error='{';
        if(mode==='empty')f.data.forwards=[];
        if(mode==='relay')Object.assign(f.forward,{spec:{...f.forward.spec,path:{via:['node-b']},transport:{profileId:'profile',configRevision:1}}});
        if(mode==='no-actor')f.data.actor=null;
        if(mode==='no-authorization')Object.assign(f.options,{authorization:undefined});
        if(mode==='denied')f.data.authorized=false;
        if(mode==='succeeded-expired'){f.op.status='succeeded';f.op.execution_deadline=0;}
        if(mode==='accepted-opt-in')f.op.status='accepted';
        const result=await f.host().assignments(f.tx,f.forwarding,f.facts,mode==='accepted-opt-in');
        assert.deepEqual(result,['succeeded-expired','accepted-opt-in'].includes(mode)?[f.assignment]:[]);
        assert.ok(!names(f).some(name=>name.startsWith('decode')),'unused persisted error/previous bodies remain undecoded');
        if(mode==='empty'||mode==='relay')assert.deepEqual(names(f),['forwards','merge']);
        if(mode==='succeeded-expired')assert.ok(!names(f).includes('now'));
        if(mode==='no-actor'||mode==='no-authorization')assert.ok(!names(f).includes('authorize'));
        if(names(f).includes('direct'))assert.deepEqual(f.events.find(e=>e.name==='direct')!.args,[f.forward,f.facts,[{nodeId:'node-a',forwardId:f.forward.id,protocol:'tcp',port:32001,bindingFence:4,deploymentGeneration:3}]]);
        assert.deepEqual(f.events.at(-1)!.args,[f.tx,{nodeId:'node-a',includeAccepted:mode==='accepted-opt-in'},result]);
    }
});

test('10 Ledger capacity observes current permission and operation changes during compile are refused before publication',async()=>{
    const denied=fixture();denied.data.authorized=false;let capacity:unknown;
    denied.data.snapshotHook=input=>{capacity=input;};await denied.host().assertCapacity(denied.tx,denied.forwarding,denied.facts);
    const value=capacity as {assignments:unknown[];tombstones:unknown[];issuedAt:string;validUntil:string;sessionEpoch:number};
    assert.deepEqual(value.assignments,[]);assert.equal(value.tombstones.length,1);assert.equal(value.issuedAt,'10000');assert.equal(value.validUntil,String(10000+DEFAULT_POLICY.leaseSeconds*1000));assert.equal(value.sessionEpoch,MAX_COUNTER);
    assert.ok(!names(denied).includes('direct'));assert.ok(names(denied).indexOf('authorize')<names(denied).indexOf('snapshot'));
    for(const mutate of [(f:ReturnType<typeof fixture>)=>{f.op.recovery_invalidated=1;},(f:ReturnType<typeof fixture>)=>{f.op.status='failed';},
        (f:ReturnType<typeof fixture>)=>{f.data.now=f.op.execution_deadline;}]){
        const f=fixture(),host=f.host();f.data.directHook=()=>mutate(f);
        const assignments=await host.assignments(f.tx,f.forwarding,f.facts);assert.deepEqual(assignments,[f.assignment]);
        await assert.rejects(host.verifyPublishable(f.tx,assignments),{code:'STALE_CLAIM'});assert.ok(!names(f).includes('snapshot'));
    }
    const later=fixture(),host=later.host();later.data.snapshotHook=()=>{later.data.authorized=false;};await host.assertCapacity(later.tx,later.forwarding,later.facts);
    assert.ok(names(later).includes('direct'));assert.deepEqual(await host.assignments(later.tx,later.forwarding,later.facts),[],'permission changed during capacity is observed by the next original collection');
    later.data.authorized=true;later.data.directHook=()=>{later.data.authorized=false;};
    assert.deepEqual(await host.assignments(later.tx,later.forwarding,later.facts),[later.assignment]);
    assert.deepEqual(await host.assignments(later.tx,later.forwarding,later.facts),[],'permission changed by the compiler is never cached into a later collection');
});

test('10 Ledger malformed authoritative and retired bodies fail at original lazy decode point after pending and ownership guards',async()=>{
    for(const mode of ['pending','relay','decode']){
        const f=fixture();f.data.snapshot={body:'{'};
        if(mode==='pending')f.data.pending=1;
        if(mode==='relay')Object.assign(f.forward,{spec:{...f.forward.spec,path:{via:['node-b']}}});
        if(mode==='decode')await assert.rejects(f.host().complete(f.tx,'node-a',f.forwarding,f.report,f.snapshot),SyntaxError);
        else await f.host().complete(f.tx,'node-a',f.forwarding,f.report,f.snapshot);
        assert.deepEqual(names(f).slice(0,4),['latestSnapshot','retirementLocks','operationLocks','forwardRead']);
        if(mode==='pending')assert.deepEqual(names(f),['latestSnapshot','retirementLocks','operationLocks','forwardRead','pending']);
        if(mode==='relay')assert.deepEqual(names(f),['latestSnapshot','retirementLocks','operationLocks','forwardRead']);
        if(mode==='decode'){assert.equal(names(f).at(-1),'decodeSnapshot');assert.ok(!names(f).includes('unsafe'));assert.ok(names(f).includes('parseTime'));}
    }
    const tombstones=fixture();tombstones.data.retired=[{...tombstones.retirement,body:'{'}];tombstones.data.snapshot={body:'{'};
    await assert.rejects(tombstones.host().assertCapacity(tombstones.tx,tombstones.forwarding,tombstones.facts),SyntaxError);
    assert.deepEqual(names(tombstones).slice(-2),['retirements','decodeAssignment']);assert.ok(!names(tombstones).includes('latestSnapshot'));
    const capacity=fixture();capacity.data.snapshot={body:'{'};await assert.rejects(capacity.host().assertCapacity(capacity.tx,capacity.forwarding,capacity.facts),SyntaxError);
    assert.deepEqual(names(capacity).slice(-3),['retirements','latestSnapshot','decodeSnapshot']);assert.ok(!names(capacity).includes('session'));
});

test('10 Ledger accept and retirement keep monotonic source ownership exact original clock UUID order and no unnecessary decode',async()=>{
    for(const prior of [undefined,0,100,10000,10001]){
        const f=fixture();f.data.now=10000;if(prior===undefined)f.data.operation=undefined;else f.op.created_at=prior;
        const request={actorId:'actor-a',scopeId:'scope-a',key:'original-key',digest:'original-digest'};
        assert.equal(await f.host().accept(f.tx,f.forward,request),'new-operation');assert.deepEqual(names(f),['id','latest','now','accept']);
        assert.deepEqual(f.events.at(-1)!.args,[f.tx,{id:'new-operation',forward:f.forward,request,kind:'create',at:Math.max(10000,(prior??0)+1),
            executionDeadline:Math.max(10000,(prior??0)+1)+600000,sourceOperationId:null,previousSpec:null}]);
    }
    const f=fixture(),old={...f.assignment,assignmentId:'retired'},previous={...f.snapshot,assignments:[f.assignment,old,old]};
    await f.host().retireChanged(f.tx,'node-a',previous,[f.assignment],7);assert.deepEqual(names(f),['latest','retire','latest','retire']);
    for(const event of f.events.filter(e=>e.name==='retire'))assert.deepEqual(event.args,[f.tx,'node-a',old,f.op.id,7]);
    f.events.length=0;await f.host().retireChanged(f.tx,'node-a',undefined,[],7);assert.deepEqual(f.events,[]);
    f.data.operation=undefined;await assert.rejects(f.host().retireChanged(f.tx,'node-a',previous,[],7),{message:'Missing retirement owner'});assert.equal(names(f).at(-1),'latest');
});

test('10 Ledger claim and get preserve expiration selector token first-error order empty laziness and original lock flags',async()=>{
    const f=fixture(),host=f.host();f.data.claim=undefined;assert.equal(await host.claim(f.tx),undefined);assert.deepEqual(names(f),['now','expire','claimable']);
    for(const fail of ['expire','claimable','claim']){
        const g=fixture();g.data.fail=fail;await assert.rejects(g.host().claim(g.tx),error=>error===g.failure);
        const expected=['now','expire','claimable','id','claim'];assert.deepEqual(names(g),expected.slice(0,expected.indexOf(fail)+1));
    }
    const claimed=fixture();assert.deepEqual(await claimed.host().claim(claimed.tx),{...claimed.op,status:'running',claim_token:'new-operation',claim_until:25000});
    assert.deepEqual(claimed.events.at(-1)!.args,[claimed.tx,claimed.op.id,'new-operation',10000,25000]);assert.equal(claimed.op.claim_token,'old-token');
    f.events.length=0;assert.equal(await host.get(f.tx,'scope-a','old-operation'),f.op);assert.equal(await host.read(f.tx,'scope-a','old-operation'),f.op);
    assert.deepEqual(f.events.map(e=>e.args),[[f.tx,'scope-a','old-operation',true],[f.tx,'scope-a','old-operation',false]]);
    f.data.operation=undefined;await assert.rejects(host.get(f.tx,'scope-a','missing'),{code:'NOT_FOUND'});await assert.rejects(host.read(f.tx,'scope-a','missing'),{code:'NOT_FOUND'});
});

test('10 Ledger native quarantine preserves ordered authorization clearing observation clearing snapshot decode and duplicate retirement SQL',async()=>{
    const f=fixture(),calls:Array<[string,unknown[]]>=[],snapshot={...f.snapshot,assignments:[f.assignment,f.assignment]};
    const results:unknown[]=[{affectedRows:1},{affectedRows:1},{affectedRows:1},[{node_id:'node-a',generation:MAX_COUNTER,body:JSON.stringify(snapshot)}],
        [f.op],{affectedRows:1},[f.op],{affectedRows:1}];
    const tx={async execute(this:unknown,sql:string,args:unknown[]=[]){assert.equal(this,tx);const index=calls.length;calls.push([sql,args]);assert.ok(index<results.length);return [results[index],[]];}} as unknown as Transaction;
    await nativeLedger().quarantineRecovery(tx);
    const latest='SELECT * FROM operations WHERE forward_id=? ORDER BY target_revision DESC,created_at DESC,id DESC LIMIT 1';
    const retire='INSERT INTO retirements(node_id,assignment_id,deployment_generation,binding_fence,forward_id,operation_id,body,retirement_generation,safe) VALUES(?,?,?,?,?,?,?,?,TRUE) ON DUPLICATE KEY UPDATE safe=TRUE';
    const retirementArgs=['node-a',f.assignment.assignmentId,3,4,f.forward.id,f.op.id,JSON.stringify(f.assignment),MAX_COUNTER];
    assert.deepEqual(calls,[['UPDATE operations SET recovery_invalidated=TRUE,claim_token=NULL,claim_until=NULL',[]],['UPDATE retirements SET safe=TRUE',[]],
        ['UPDATE runtime_nodes SET last_report=NULL,received_at=NULL',[]],['SELECT s.node_id,s.generation,s.body FROM snapshots s JOIN runtime_nodes r ON r.node_id=s.node_id AND r.snapshot_generation=s.generation',[]],
        [latest,[f.forward.id]],[retire,retirementArgs],[latest,[f.forward.id]],[retire,retirementArgs]]);
});

test('10 Runtime worker locks Node before operation and rejects every original stale claim gate before protected authority or persistence',async()=>{
    for(const stage of ['before','after'] as const)for(const mode of stage==='before'?['status','token','null-until','zero-until','equal-until','revision']:['status','token','clock','deadline']){
        const f=fixture(),claim={...f.op},trace:string[]=[];
        const mutate=()=>{if(mode==='status')f.op.status='failed';if(mode==='token')f.op.claim_token='replacement';if(mode==='null-until')f.op.claim_until=null;
            if(mode==='zero-until')f.op.claim_until=0;if(mode==='equal-until')f.op.claim_until=f.data.now;if(mode==='revision')f.op.target_revision++;
            if(mode==='clock')f.data.now=claim.claim_until!;if(mode==='deadline')f.op.execution_deadline=f.data.now;};
        if(stage==='before')mutate();
        const db={async transaction<T>(action:(tx:typeof f.tx)=>Promise<T>){assert.equal(this,db);trace.push('begin');try{const value=await action(f.tx);trace.push('commit');return value;}catch(error){trace.push('rollback');throw error;}}};
        const ledger={async claim(tx:typeof f.tx){assert.equal(this,ledger);assert.equal(tx,f.tx);trace.push('claim');return claim;},
            async get(tx:typeof f.tx){assert.equal(this,ledger);assert.equal(tx,f.tx);trace.push('get-operation');return f.op;},
            async assignments(){trace.push('assignments');return [];},async retireChanged(){trace.push('retire');},async tombstones(){trace.push('tombstones');return [];},async verifyPublishable(){trace.push('verify');}};
        const store={async cleanupNodeIDs(){return [];},async lockNode(tx:typeof f.tx,nodeId:string){assert.equal(this,store);assert.equal(tx,f.tx);assert.equal(nodeId,'node-a');trace.push('node-lock');return {node_id:'node-a',session_epoch:1,boot_id:'boot',snapshot_generation:0,last_report_sequence:0,last_report:null,received_at:null};},
            async snapshot(){return undefined;},async awaitingClaim(){return 0;},async operation(tx:typeof f.tx){assert.equal(this,store);assert.equal(tx,f.tx);trace.push('reread-operation');return f.op;},
            async saveSnapshot(){assert.fail('stale worker must not save Snapshot');}};
        const host=new RuntimeHost({db,store,ledger,forwards:{async record(tx:typeof f.tx){assert.equal(tx,f.tx);trace.push('forward-read');return f.forward;}},
            // Explicit unlimited fixture keeps stale-claim acceptance independent of payload policy.
            payloadPolicy:{async limits(tx:typeof f.tx){assert.equal(tx,f.tx);return {excludedAssignmentIds:[]};}},
            nodes:{async state(){trace.push('node-state');return {facts:f.facts,credentialUntil:60000,revoked:false};}},
            now:()=>f.data.now,codec:{...runtimeCodec,formatTime:String,parseTime:Number,compileSnapshot(input:Record<string,unknown>){trace.push('compile');mutate();return {...input,complete:true,snapshotDigest:'snapshot'};}},
            authority:{async issue(){assert.fail('stale worker must not advance protected authority');}}} as unknown as RuntimeHostOptions<typeof f.tx>);
        if(stage==='before')await host.tick();else await assert.rejects(host.tick(),{code:'STALE_CLAIM'});
        assert.deepEqual(trace.slice(0,7),['begin','claim','commit','begin','forward-read','node-lock','get-operation']);
        assert.equal(trace.filter(value=>value==='begin').length,2);assert.ok(trace.indexOf('node-lock')<trace.indexOf('get-operation'));
        if(stage==='before'){assert.equal(trace.at(-1),'commit');assert.ok(!trace.includes('node-state'));}else{assert.ok(trace.indexOf('compile')<trace.indexOf('reread-operation'));assert.equal(trace.at(-1),'rollback');}
    }
});

const databaseURL=process.env.TUNEX_TEST_DATABASE_URL;
async function withDatabase(action:(db:MySqlUnitOfWork,f:ReturnType<typeof fixture>)=>Promise<void>){
    const admin=await createConnection(databaseURL!),database='tunex_ledger_owner_'+randomUUID().replaceAll('-','');
    const connectionURL=new URL(databaseURL!);connectionURL.pathname='/'+database;const db=new MySqlUnitOfWork(connectionURL.toString());let created=false;
    try{await admin.query(`CREATE DATABASE \`${database}\``);created=true;await db.migrate();const f=fixture();
        await db.transaction(async tx=>{await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',['actor-a','a'.repeat(64)]);
            await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',['scope-a','actor-a']);
            await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts) VALUES(?,?,?,?,?)',['node-a','scope-a','b'.repeat(64),900000,JSON.stringify(f.facts)]);
            await write(tx,'INSERT INTO runtime_nodes(node_id,session_epoch) VALUES(?,?)',['node-a',1]);
            await write(tx,'INSERT INTO forwards(id,scope_id,revision,spec) VALUES(?,?,?,?)',[f.forward.id,'scope-a',2,JSON.stringify(f.forward.spec)]);
        });await action(db,f);
    }finally{try{await db.close();if(created)await admin.query(`DROP DATABASE \`${database}\``);}finally{await admin.end();}}
}
async function insertOperation(tx:Transaction,f:ReturnType<typeof fixture>,id:string,status:RuntimeOperation['status']='accepted',created=1,deadline=200000){
    await write(tx,'INSERT INTO operations(id,scope_id,forward_id,target_revision,kind,status,requested_by,idempotency_key,request_digest,created_at,updated_at,execution_deadline,claim_token,claim_until,cleanup_pending) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,TRUE)',
        [id,'scope-a',f.forward.id,2,'create',status,'actor-a',id,'sha256:'+'c'.repeat(64),created,created,deadline,'old-token',null]);
}
function nativeLedger(now:()=>number=()=>100,newID:()=>string=()=>randomUUID()){
    return new RuntimeLedgerHost({policy:DEFAULT_POLICY,store:new MySqlRuntimeLedgerStore(),authorization:undefined,
        assignments:{merge:async(_tx,_context,current)=>[...current]},resources:createMySqlRuntimeResources(new NodePortLimitPolicy(new MySqlNodeAuthorityStore(),new MySqlRuntimeResourceStore()),DEFAULT_POLICY.maxAssignmentsPerNode),
        compiler:nativeLedgerCompiler,now,newID} as RuntimeLedgerOptions<Transaction,NativeRuntimeFamily>);
}
function traceTransaction(tx:Transaction,execute:(sql:string,args:unknown[],run:()=>Promise<unknown>)=>Promise<unknown>):Transaction{
    let proxy:Transaction;proxy=new Proxy(tx,{get(target,key,receiver){if(key==='execute')return async function(this:unknown,sql:string,args:unknown[]=[]){assert.equal(this,proxy);return execute(sql,args,()=>Reflect.apply(target.execute,target,[sql,args]));};return Reflect.get(target,key,receiver);}});return proxy;
}

test('10 real MySQL Ledger acceptance rollback restores insertion supersession retirement ownership and preserves monotonic source history',{skip:!databaseURL},async()=>{
    await withDatabase(async(db,f)=>{
        await db.transaction(async tx=>{await insertOperation(tx,f,f.op.id,'running',500);await new MySqlRuntimeLedgerStore().retireAssignment(tx,'node-a',f.assignment as never,f.op.id,4);});
        const before=await rows(db.pool,'SELECT * FROM operations ORDER BY id'),retired=await rows(db.pool,'SELECT * FROM retirements ORDER BY assignment_id');
        const failure=new Error('after operation insert before supersession'),trace:string[]=[],ledger=nativeLedger(()=>100,()=> 'new-operation');
        await assert.rejects(db.transaction(async tx=>{const supplied=traceTransaction(tx,async(sql,args,run)=>{trace.push(sql);const result=await run();
            if(sql.startsWith('INSERT INTO operations')){assert.equal((await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM operations WHERE id=?',['new-operation']))[0]!.n,1);assert.equal(args[0],'new-operation');throw failure;}return result;});
            await ledger.accept(supplied,f.forward,{actorId:'actor-a',scopeId:'scope-a',key:'retry-key',digest:'digest'},'retry',f.forward.spec,f.op.id);
        }),error=>error===failure);
        assert.equal(trace.filter(sql=>sql.startsWith('INSERT INTO operations')).length,1);assert.ok(!trace.some(sql=>sql.startsWith("UPDATE operations SET status='superseded'")));
        assert.deepEqual(await rows(db.pool,'SELECT * FROM operations ORDER BY id'),before);assert.deepEqual(await rows(db.pool,'SELECT * FROM retirements ORDER BY assignment_id'),retired);
        await db.transaction(tx=>ledger.accept(tx,f.forward,{actorId:'actor-a',scopeId:'scope-a',key:'retry-key',digest:'digest'},'retry',f.forward.spec,f.op.id));
        const operations=await rows<RuntimeOperation>(db.pool,'SELECT * FROM operations ORDER BY created_at,id');assert.equal(operations[0]!.status,'superseded');assert.equal(operations[0]!.claim_token,null);assert.equal(operations[0]!.claim_until,null);
        assert.equal(operations[1]!.created_at,501);assert.equal(operations[1]!.execution_deadline,600501);assert.equal(operations[1]!.source_operation_id,f.op.id);assert.deepEqual(json(operations[1]!.previous_spec),f.forward.spec);
        assert.equal((await rows<{operation_id:string}>(db.pool,'SELECT operation_id FROM retirements'))[0]!.operation_id,'new-operation');
    });
});

test('10 real MySQL Ledger claim expires first retains token attempt deadline and SKIP LOCKED competition does not double claim',{skip:!databaseURL},async()=>{
    await withDatabase(async(db,f)=>{
        await db.transaction(async tx=>{await insertOperation(tx,f,'expired-accepted','accepted',1,100);await insertOperation(tx,f,'expired-running','running',2,99);
            await insertOperation(tx,f,'recovery','accepted',3,99);await write(tx,'UPDATE operations SET recovery_invalidated=TRUE WHERE id=?',['recovery']);});
        const empty=nativeLedger(()=>100,()=>assert.fail('empty queue must not allocate token'));assert.equal(await db.transaction(tx=>empty.claim(tx)),undefined);
        const expired=await rows<RuntimeOperation>(db.pool,'SELECT * FROM operations ORDER BY id');
        for(const op of expired){if(op.id==='recovery'){assert.equal(op.status,'accepted');assert.equal(op.claim_token,'old-token');continue;}
            assert.equal(op.status,'failed');assert.equal(op.claim_token,null);assert.equal(op.claim_until,null);assert.equal(op.cleanup_pending,1);assert.deepEqual(json(op.last_error),{code:'EXECUTION_DEADLINE',retryable:false});}
        await db.transaction(async tx=>{await write(tx,'DELETE FROM operations');await insertOperation(tx,f,'first','accepted',1);await insertOperation(tx,f,'second','accepted',2);});
        const left=await db.pool.getConnection(),right=await db.pool.getConnection();
        try{await left.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');await right.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');await left.beginTransaction();await right.beginTransaction();
            // Isolate selector competition from claim's preceding expiry UPDATE, whose scan can hold other queue rows.
            // A keyed row lock also avoids depending on the left selector's filesort/index lock footprint.
            const first=(await rows<RuntimeOperation>(left,'SELECT * FROM operations WHERE id=? FOR UPDATE',['first']))[0];assert.equal(first?.id,'first');
            const store=new MySqlRuntimeLedgerStore();await store.claimOperation(left,first!.id,'token-first',100,15100);
            const second=await store.claimableOperation(right,100);assert.equal(second?.id,'second','locked oldest claim is skipped');
            assert.notEqual(second!.id,first!.id,'concurrent selector must not return the operation owned by the other transaction');
            await store.claimOperation(right,second!.id,'token-second',100,15100);
            assert.equal(await store.claimableOperation(right,100),undefined,'locked first and live second cannot be claimed again');
            await right.commit();await left.commit();
        }finally{await left.rollback();await right.rollback();left.release();right.release();}
        const claimed=await rows<RuntimeOperation&{attempt_count:number}>(db.pool,'SELECT * FROM operations ORDER BY id');
        assert.deepEqual(claimed.map(op=>[op.id,op.status,op.claim_token,op.claim_until,op.attempt_count,op.execution_deadline]),
            [['first','running','token-first',15100,1,200000],['second','running','token-second',15100,1,200000]]);
        assert.equal(await db.transaction(tx=>nativeLedger(()=>15099,()=>assert.fail('live claims must not be stolen')).claim(tx)),undefined);
        const reclaimed=await db.transaction(tx=>nativeLedger(()=>15100,()=> 'replacement-token').claim(tx));assert.equal(reclaimed?.id,'first');assert.equal(reclaimed?.claim_until,30100);
        const updated=(await rows<RuntimeOperation&{attempt_count:number}>(db.pool,'SELECT * FROM operations WHERE id=?',['first']))[0]!;assert.equal(updated.attempt_count,2);assert.equal(updated.execution_deadline,200000);assert.equal(updated.claim_token,'replacement-token');
    });
});

test('10 real MySQL completion holds Node then Operation while original Forward intent remains unlocked',{skip:!databaseURL},async()=>{
    await withDatabase(async(db,f)=>{
        await db.transaction(tx=>insertOperation(tx,f,f.op.id,'running'));
        const first=await db.pool.getConnection(),second=await db.pool.getConnection(),trace:string[]=[];
        try{await first.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');await second.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');await first.beginTransaction();await second.beginTransaction();
            const supplied=traceTransaction(first,async(sql,_args,run)=>{trace.push(sql);return run();}),ledger=nativeLedger();
            await ledger.lockNode(supplied,'node-a',1);await ledger.complete(supplied,'node-a',new Forwarding());
            assert.match(trace[0]!,/^SELECT session_epoch FROM runtime_nodes .*FOR UPDATE$/);const operationIndex=trace.findIndex(sql=>sql.includes('FOR UPDATE OF o'));assert.ok(operationIndex>0);
            assert.ok(!trace.some(sql=>/^SELECT .* FROM forwards/.test(sql)&&sql.includes('FOR UPDATE')));
            await rows(second,'SELECT * FROM forwards WHERE id=? FOR UPDATE NOWAIT',[f.forward.id]);
            await assert.rejects(rows(second,'SELECT * FROM operations WHERE id=? FOR UPDATE NOWAIT',[f.op.id]),{code:'ER_LOCK_NOWAIT'});
            await assert.rejects(rows(second,'SELECT * FROM runtime_nodes WHERE node_id=? FOR UPDATE NOWAIT',['node-a']),{code:'ER_LOCK_NOWAIT'});
        }finally{await first.rollback();await second.rollback();first.release();second.release();}
    });
});

test('10 real MySQL leases preserve cross-session five-second boundary duplicate retirement ownership and absent versus zero maximum',{skip:!databaseURL},async()=>{
    await withDatabase(async(db,f)=>{
        const store=new MySqlRuntimeLedgerStore(),key:RuntimeRetirementKey={node_id:'node-a',assignment_id:'assignment-a',deployment_generation:3,binding_fence:4};
        await db.transaction(async tx=>{
            await insertOperation(tx,f,'old','running');await insertOperation(tx,f,'new','running',2);
            assert.deepEqual(await store.instanceLease(tx,key,1),{until:null});
            await write(tx,'INSERT INTO execution_leases(forward_id,node_id,assignment_id,deployment_generation,binding_fence,session_epoch,valid_until) VALUES(?,?,?,?,?,?,?)',[f.forward.id,'node-a','assignment-a',3,4,1,0]);
            assert.deepEqual(await store.instanceLease(tx,key,1),{until:0});
            await write(tx,'UPDATE execution_leases SET valid_until=10000');
            assert.equal((await store.previousUnsafeLeases(tx,f.forward.id,14999)).length,1);assert.equal((await store.previousUnsafeLeases(tx,f.forward.id,15000)).length,0);
            assert.equal(await store.unsafeSessionLeaseCount(tx,'node-a',1,14999),0);assert.equal(await store.unsafeSessionLeaseCount(tx,'node-a',2,14999),1);assert.equal(await store.unsafeSessionLeaseCount(tx,'node-a',2,15000),0);
            await store.retireAssignment(tx,'node-a',f.assignment as never,'old',4);await store.retireAssignment(tx,'node-a',f.assignment as never,'new',9);
            const retired=(await store.retirements(tx,'node-a'))[0]!;assert.equal(retired.operation_id,'new');assert.equal(retired.retirement_generation,4,'duplicate ownership transfer retains original generation');
            assert.equal(await store.outstandingRetirementLeases(tx,retired,14999),1);await store.markRemoved(tx,key,1);
            const removed=(await store.retirement(tx,key))!;assert.equal(await store.outstandingRetirementLeases(tx,removed,14999),0);
            await write(tx,'INSERT INTO execution_leases(forward_id,node_id,assignment_id,deployment_generation,binding_fence,session_epoch,valid_until) VALUES(?,?,?,?,?,?,?)',[f.forward.id,'node-a','assignment-a',3,4,2,10000]);
            assert.equal(await store.outstandingRetirementLeases(tx,removed,14999),1,'one session removal cannot release another live session');assert.equal(await store.outstandingRetirementLeases(tx,removed,15000),0);
            await store.markRetirementSafe(tx,key);assert.equal(await store.unsafeSessionLeaseCount(tx,'node-a',3,14999),0);
            await write(tx,'UPDATE operations SET claim_until=17');await store.completeOperation(tx,'old',20,false);await store.completeOperation(tx,'new',21,true);
            const completed=await rows<RuntimeOperation>(tx,'SELECT * FROM operations ORDER BY id');
            assert.deepEqual(completed.map(op=>[op.id,op.status,op.cleanup_pending,op.claim_token,op.claim_until]),[['new','succeeded',0,null,null],['old','succeeded',0,'old-token',17]]);
            await write(tx,"UPDATE operations SET status='failed',cleanup_pending=TRUE,claim_token='kept',claim_until=18 WHERE id='new'");await store.clearOperationCleanup(tx,'new',22);
            const failed=(await rows<RuntimeOperation>(tx,"SELECT * FROM operations WHERE id='new'"))[0]!;assert.deepEqual([failed.status,failed.cleanup_pending,failed.claim_token,failed.claim_until],['failed',0,'kept',18]);
            await write(tx,'UPDATE operations SET cleanup_pending=TRUE');await store.clearFailedSupersededCleanup(tx,f.forward.id);
            assert.deepEqual((await rows<RuntimeOperation>(tx,'SELECT * FROM operations ORDER BY id')).map(op=>[op.id,op.cleanup_pending]),[['new',0],['old',1]]);
        });
    });
});
