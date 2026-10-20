import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import { RuntimeLedgerHost, RuntimeRelayHost, NodeAuthorityHost } from '../src/framework/public.ts';
import { NodeService } from '../src/modules/node-owner/public.ts';
import { nativeLedgerCompiler, nativeRelayCompiler, nativeNodeCodec, nativeParseTime, nativeIsoTime } from '../src/compatibility/public.ts';

const internal=(value:unknown)=>value as Record<string,any>;
function ledger(){
    const tx={},events:string[]=[],failure=new Error('original ledger time'),state={now:1000,lease:10,deadline:5,parseThrow:false,report:true,snapshot:true,executionDeadline:2000,parsed:9000};
    const assignment={assignmentId:'assignment',forwardId:'forward',forwardRevision:1,protocol:'tcp',deploymentGeneration:1,bindingFence:1,resource:{port:80,protocol:'tcp'}};
    const snapshot={validUntil:'raw-time',assignments:[assignment]},report={drains:[{assignmentId:'assignment',deploymentGeneration:1,bindingFence:1,condition:'draining',deadline:'raw-deadline'}],acceptedSnapshotGeneration:1,observations:[{...assignment,phase:'active',condition:'ready'}]};
    const op={id:'operation',scope_id:'scope',forward_id:'forward',status:'running',kind:'create',get execution_deadline(){return state.executionDeadline;}};
    const store={async latestSnapshot(){events.push('latest');return undefined;},async nodeSession(){events.push('session');return {session_epoch:0};},async retirement(){events.push('retirement');return {retirement_generation:1};},async instanceLease(){events.push('lease');return {until:state.lease};},async unsafeRetirementsForUpdate(){return [];},async completionOperations(){return [op];},async pendingRetirementCount(){return 0;},async unsafeLeaseCount(){return 0;},async previousUnsafeLeases(){return [];},async completeOperation(){events.push('complete');},async clearFailedSupersededCleanup(){events.push('clear');}};
    const compiler={...nativeLedgerCompiler,formatTime(this:unknown,at:number){assert.equal(this,compiler);events.push(`format:${at}`);return `time:${at}`;},parseTime(this:unknown,value:string){assert.equal(this,compiler);events.push(`parse:${value}`);if(state.parseThrow)throw failure;return state.parsed;},snapshot(this:unknown,input:unknown){assert.equal(this,compiler);events.push('compile');return input as never;}};
    const resources={async releaseObsoleteSlots(){events.push('release');}},assignments={merge(){return [];}};
    const host=new RuntimeLedgerHost({compiler,store,resources,assignments,policy:DEFAULT_POLICY,now(){events.push('now');return state.now;},newID(){throw failure;}} as never);
    const forwarding={async record(){return {id:'forward',revision:1,spec:{enabled:true,protocols:['tcp']}};}};
    return {tx,events,failure,state,assignment,snapshot,report,store,compiler,host,forwarding};
}

test('122 native time functions retain exact Date parse/ISO values zero offsets fractions NaN and RangeError',()=>{
    for(const value of ['', 'invalid','1970-01-01T00:00:00Z','2026-10-20T01:02:03.125+08:00','2026-10-20T01:02:03.123456Z'])assert.ok(Object.is(nativeParseTime(value),Date.parse(value)));
    for(const value of [0,-1,1.75,-1.75,8640000000000000,-8640000000000000])assert.equal(nativeIsoTime(value),new Date(value).toISOString());
    for(const value of [NaN,Infinity,-Infinity,8640000000000001])assert.throws(()=>nativeIsoTime(value),RangeError);
    assert.equal(nativeLedgerCompiler.parseTime,nativeParseTime);assert.equal(nativeRelayCompiler.parseTime,nativeParseTime);assert.equal(nativeLedgerCompiler.formatTime,nativeIsoTime);assert.equal(nativeRelayCompiler.formatTime,nativeIsoTime);assert.equal(nativeNodeCodec.formatTime,nativeIsoTime);
});

test('122 Ledger collector guard precedes time guard before policy/default getters and Node bounds precede time/native methods',()=>{
    const failure=new Error('option getter');
    assert.throws(()=>new RuntimeLedgerHost({get compiler(){throw failure;}} as never),{message:'Snapshot assignment collector is required'});
    for(const compiler of [undefined,{}, {parseTime(){}},{parseTime:0,formatTime(){}}])assert.throws(()=>new RuntimeLedgerHost({assignments:{merge(){}},compiler,get policy(){throw failure;}} as never),{message:'Runtime ledger time codec is required'});
    assert.throws(()=>new RuntimeRelayHost({compiler:{relayAssignmentPolicy(){throw failure;}},get policy(){throw failure;}} as never),{message:'Runtime relay time codec is required'});
    assert.throws(()=>new NodeAuthorityHost({overlapSeconds:0,relayCredentialSeconds:0,get codec(){throw failure;}} as never),/overlap/);
    assert.throws(()=>new NodeAuthorityHost({overlapSeconds:1,relayCredentialSeconds:0,get codec(){throw failure;}} as never),/authority/);
    assert.throws(()=>new NodeAuthorityHost({overlapSeconds:1,relayCredentialSeconds:60,codec:{},get db(){throw failure;}} as never),{message:'Node authority time codec is required'});
});

test('122 Ledger capacity formats original early sample only after assignment tombstone snapshot/session awaits',async()=>{
    const f=ledger(),bound=internal(f.host);bound.assignments=async()=>{f.events.push('assignments');f.state.now=2000;return [];};bound.tombstones=async()=>{f.events.push('tombstones');f.state.now=3000;return [];};
    await f.host.assertCapacity(f.tx,{} as never,{nodeId:'node'} as never);
    assert.deepEqual(f.events,['now','assignments','tombstones','latest','session','format:1000',`format:${1000+DEFAULT_POLICY.leaseSeconds*1000}`,'compile']);
    f.compiler.formatTime=function(){throw f.failure;};f.events.length=0;await assert.rejects(f.host.assertCapacity(f.tx,{} as never,{nodeId:'node'} as never),e=>e===f.failure);assert.deepEqual(f.events,['now','assignments','tombstones','latest','session']);
});

test('122 Ledger draining parses only truthy lease at original post-read expression and preserves native NaN comparison',async()=>{
    for(const lease of [0,null,undefined]){const f=ledger();f.state.lease=lease as never;await assert.rejects(f.host.observeDrains(f.tx,'node',2,f.report as never),{code:'LEASE_EXPIRED'});assert.deepEqual(f.events,['retirement','lease']);}
    for(const parsed of [5,10,NaN]){const f=ledger();f.state.parsed=parsed;await f.host.observeDrains(f.tx,'node',2,f.report as never);assert.deepEqual(f.events,['retirement','lease','parse:raw-deadline']);}
    const expired=ledger();expired.state.parsed=11;await assert.rejects(expired.host.observeDrains(expired.tx,'node',2,expired.report as never),{code:'LEASE_EXPIRED'});
    const thrown=ledger();thrown.state.parseThrow=true;await assert.rejects(thrown.host.observeDrains(thrown.tx,'node',2,thrown.report as never),e=>e===thrown.failure);
});

test('122 Ledger completion keeps report snapshot deadline and two Now short circuits before parse/filter/readiness',async()=>{
    for(const mode of ['no-report','no-snapshot','deadline','parse-fails','equal','ready'] as const){
        const f=ledger();if(mode==='deadline')f.state.executionDeadline=1000;if(mode==='parse-fails')f.state.parseThrow=true;if(mode==='equal')f.state.parsed=6000;
        const action=f.host.complete(f.tx,'node',f.forwarding as never,mode==='no-report'?undefined:f.report as never,mode==='no-snapshot'?undefined:f.snapshot as never);
        if(mode==='parse-fails')await assert.rejects(action,e=>e===f.failure);else await action;
        assert.equal(f.events.filter(e=>e==='now').length,mode==='no-report'||mode==='no-snapshot'?0:mode==='deadline'||mode==='parse-fails'?1:mode==='ready'?4:2);
        assert.equal(f.events.includes('parse:raw-time'),!['no-report','no-snapshot','deadline'].includes(mode));assert.equal(f.events.includes('complete'),mode==='ready');
    }
});

function relayTime(){
    const tx={},events:string[]=[],failure=new Error('original Relay time'),state={sample:0,received:0,missing:false,formatFail:false,parseFail:false};
    const assignment={assignmentId:'a',role:'relay-ingress',resource:{port:80},deploymentGeneration:1,bindingFence:1,driver:{configDigest:'digest'},phase:'prepared'},node={nodeId:'node',sessionEpoch:1,assignments:[assignment]};
    const plan={forwardId:'forward',forwardRevision:1,deploymentGeneration:1,authorizationUntil:9999,nodes:[node],planDigest:'stored'};
    const forward={id:'forward',scopeId:'scope',revision:1,spec:{ingress:{nodeId:'node'},path:{via:['egress']},transport:{profileId:'profile',configRevision:1},protocols:['tcp'],enabled:true}};
    const runtime={session_epoch:1,snapshot_generation:1,last_report:{sessionEpoch:1,acceptedSnapshotGeneration:1,observations:[{...assignment,condition:'prepared'}]},get received_at(){return state.received;}};
    const snapshot={snapshotGeneration:1,validUntil:'raw-time',assignments:[assignment]};
    const compiler={...nativeRelayCompiler,digest(){return 'stored';},readValue<T>(value:unknown){return value as T;},parseTime(this:unknown,value:string){assert.equal(this,compiler);events.push(`parse:${value}`);if(state.parseFail)throw failure;return 9000;},formatTime(this:unknown,value:number){assert.equal(this,compiler);events.push(`format:${value}`);if(state.formatFail)throw failure;return `time:${value}`;},relayResources(){events.push('resources');return [];},relayPlan(){events.push('plan');return plan as never;}};
    const store={async latest(){events.push('latest');return state.missing?undefined:{forward_id:'forward',target_revision:1,generation:1,body:plan,stage:'active'};},async forForward(){return [];},async insertRelay(_tx:unknown,_f:unknown,_g:unknown,p:unknown,at:number,updated:number){assert.equal(_tx,tx);assert.equal(p,plan);events.push(`insert:${at}:${updated}`);}};
    const observations={async runtimeNode(){events.push('runtime');return runtime;},async snapshot(){events.push('snapshot');return {body:snapshot};},async isolation(){events.push('isolation');return [];},async portOwner(){events.push('port');return undefined;}};
    const ledger={async latest(){events.push('operation');return undefined;},async lockNode(){events.push('lock');},async reserveRelay(){events.push('reserve');return [];}};
    const transport={async resolve(){events.push('profile');return {}; }},endpoints={async resolve(){events.push('endpoint');return {nodeId:'egress',revision:1,config:{allowedTcpPorts:[33000]}};}};
    const host=new RuntimeRelayHost({compiler,store,observations,ledger,transport,endpoints,policy:DEFAULT_POLICY,now(){events.push('now');return ++state.sample;}} as never),bound=internal(host);
    bound.publishablePlan=async()=>{events.push('publishable');return false;};bound.facts=async()=>{events.push('facts');return [];};
    return {host,bound,tx,events,failure,state,plan,node,forward,compiler,runtime,snapshot};
}

test('122 Relay receivedAt zero remains null and authority formatter runs after isolation with native receiver/error',async()=>{
    const f=relayTime(),status=await f.host.status(f.tx,f.forward as never);assert.ok(status);assert.equal(status.nodes[0]!.receivedAt,null);assert.equal(status.authorizationUntil,'time:9999');assert.equal(f.events.includes('format:0'),false);assert.ok(f.events.indexOf('isolation')<f.events.indexOf('format:9999'));
    const failure=relayTime();failure.state.formatFail=true;await assert.rejects(failure.host.status(failure.tx,failure.forward as never),e=>e===failure.failure);assert.deepEqual(failure.events.slice(-2),['isolation','format:9999']);
    const absent=relayTime();absent.state.missing=true;assert.equal(await absent.host.status(absent.tx,absent.forward as never),null);assert.deepEqual(absent.events,['latest']);
});

test('122 Relay acceptance formats after reservation and uses separate original insert samples without formatter normalization',async()=>{
    const f=relayTime();assert.equal(await f.host.acceptPlan(f.tx,'actor',f.forward as never),f.plan);
    const index=f.events.indexOf('reserve');assert.deepEqual(f.events.slice(index),['reserve','now','format:1','plan','now','now','insert:2:3']);
    const failure=relayTime();failure.state.formatFail=true;await assert.rejects(failure.host.acceptPlan(failure.tx,'actor',failure.forward as never),e=>e===failure.failure);assert.deepEqual(failure.events.slice(failure.events.indexOf('reserve')),['reserve','now','format:1']);
});

test('122 Relay observed parses only after runtime report and original snapshot read with two independent Now samples',async()=>{
    const f=relayTime();assert.equal(await f.bound.observed(f.tx,f.node,'prepared'),true);assert.deepEqual(f.events,['runtime','now','snapshot','parse:raw-time','now']);
    const failure=relayTime();failure.state.parseFail=true;await assert.rejects(failure.bound.observed(failure.tx,failure.node,'prepared'),e=>e===failure.failure);assert.deepEqual(failure.events,['runtime','now','snapshot','parse:raw-time']);
    const stale=relayTime();stale.runtime.session_epoch=2;assert.equal(await stale.bound.observed(stale.tx,stale.node,'prepared'),false);assert.deepEqual(stale.events,['runtime']);
});

function node(){
    const tx={},events:string[]=[],effects:string[]=[],failure=new Error('original Node formatter'),state={now:1000,formatFail:0,formats:0,active:0,until:0 as number|null,revoked:0,replay:undefined as any};
    const current={id:'node',scope_id:'scope',credential_fingerprint:'old',credential_until:100000,revoked:0,facts:{original:true}},signed={certificate:'certificate',ca:'ca',fingerprint:'new',until:90000};
    const writeNames=['create','insertCredential','retireCredential','setCurrentCredential','saveRotation','retireRelayCredentials','insertRelayCredential','saveRelayRequest','securityEvent'];
    const answers:Record<string,()=>unknown>={currentForUpdate:()=>current,credential:()=>({valid_until:100000,retire_after:null}),rotationReplay:()=>state.replay,relayReplay:()=>state.replay,activeRelayCredentials:()=>Array.from({length:state.active},()=>({fingerprint:'active',valid_until:100000})),scopedNode:()=>({...current,revoked:state.revoked}),credentials:()=>[{fingerprint:'zero',valid_until:0,retire_after:0,revoked:0},{fingerprint:'one',valid_until:1,retire_after:2,revoked:1}]};
    const store=new Proxy({},{get(_target,key){return async function(this:unknown,t:unknown,..._args:unknown[]){assert.equal(this,store);assert.equal(t,tx);const name=String(key);events.push(name);if(writeNames.includes(name))effects.push(name);return answers[name]?.();};}});
    const codec={...nativeNodeCodec,formatTime(this:unknown,at:number){assert.equal(this,codec);events.push(`format:${at}`);if(++state.formats===state.formatFail)throw failure;return `time:${at}`;},readValue<T>(this:unknown,value:unknown){assert.equal(this,codec);events.push('read');return value as T;},validateNetworkPolicy(){events.push('validate');}};
    const db={async transaction<T>(run:(tx:unknown)=>Promise<T>){events.push('begin');const before=[...effects];try{const out=await run(tx);events.push('commit');return out;}catch(error){effects.splice(0,effects.length,...before);events.push('rollback');throw error;}}};
    const identity={async scope(t:unknown){assert.equal(t,tx);events.push('scope');}};
    const resources={async initializeNode(t:unknown){assert.equal(t,tx);events.push('initialize');effects.push('initialize');},async lockNode(t:unknown){assert.equal(t,tx);events.push('lock');},async maximumAuthorization(t:unknown){assert.equal(t,tx);events.push('maximum');return state.until;}};
    const signer={async sign(){events.push('sign');return signed;}};
    const secrets={newID(){return 'id';},newToken(){return 'token';},tokenHash(){return 'hash';}};
    const host=new NodeService({db,identity,store,resources,signer,secrets,codec,machine:{},overlapSeconds:1,relayCredentialSeconds:60,now(){events.push('now');return state.now;}} as never);
    return {host,tx,events,effects,failure,state,current,signed,codec};
}

test('122 Node provision formatting occurs after commit preserving writes on formatter failure',async()=>{
    const f=node();f.state.formatFail=1;await assert.rejects(f.host.provision('actor','scope',{} as never),e=>e===f.failure);
    assert.deepEqual(f.events,['validate','now','begin','scope','create','initialize','commit','format:601000']);assert.deepEqual(f.effects,['create','initialize']);assert.equal(f.events.includes('rollback'),false);
});

test('122 machine and Relay credential formatting after writes before replay/audit rolls original Tx back at every formatter',async()=>{
    for(const method of ['rotate','relayCredential'] as const)for(let position=1;position<=(method==='rotate'?2:3);position++){
        const f=node();f.state.active=1;f.state.formatFail=position;
        await assert.rejects(f.host[method]('node','old',2,'request','-----BEGIN CERTIFICATE REQUEST-----'),e=>e===f.failure);
        assert.equal(f.state.formats,position);assert.equal(f.events.at(-1),'rollback');assert.deepEqual(f.effects,[]);
        assert.ok(f.events.indexOf(method==='rotate'?'setCurrentCredential':'insertRelayCredential')<f.events.findIndex(e=>e.startsWith('format:')));
        assert.equal(f.events.includes(method==='rotate'?'saveRotation':'saveRelayRequest'),false);assert.equal(f.events.includes('securityEvent'),false);
    }
    for(const method of ['rotate','relayCredential'] as const){const f=node();f.state.formatFail=1;f.state.replay={request_digest:nativeNodeCodec.digest({csr:'-----BEGIN CERTIFICATE REQUEST-----'}),response:{original:'response'}};
        assert.equal(await f.host[method]('node','old',2,'request','-----BEGIN CERTIFICATE REQUEST-----'),f.state.replay.response);assert.equal(f.events.includes('sign'),false);assert.equal(f.state.formats,0);assert.equal(f.events.at(-1),'commit');}
});

test('122 Node view truthy authorization and retirement preserve pending sample then formatter/map order inside Tx',async()=>{
    for(const until of [0,null,1000]){const f=node();f.state.until=until;f.state.revoked=1;const result=await f.host.view('actor','scope','node');
        assert.equal(result.latestAuthorizationUntil,until?'time:6000':null);assert.equal(result.pendingRevocation,Boolean(until));assert.deepEqual(result.credentials,[{fingerprint:'zero',validUntil:'time:0',retireAfter:null,revoked:false},{fingerprint:'one',validUntil:'time:1',retireAfter:'time:2',revoked:true}]);
        assert.deepEqual(f.events,['begin','scope','scopedNode','maximum','credentials','read',...(until?['now','format:6000']:[]),'format:0','format:1','format:2','commit']);
    }
    const f=node();f.state.until=1000;f.state.revoked=1;f.state.formatFail=2;await assert.rejects(f.host.view('actor','scope','node'),e=>e===f.failure);assert.equal(f.events.at(-1),'rollback');assert.equal(f.events.includes('format:1'),false);
});
