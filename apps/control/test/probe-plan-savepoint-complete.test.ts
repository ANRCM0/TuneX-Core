import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ControlError } from '../src/framework/public.ts';
import { nativeValueDigest } from '../src/compatibility/public.ts';
import { ProbePlans, probePlanStorageValues, PROBE_PLAN_REJECTIONS } from '../src/modules/probe-plan-owner/public.ts';
import type { ProbePlanHead, ProbePlanDecision, ProbePlanConfig, ProbePlanStore } from '../src/modules/probe-plan-owner/public.ts';
import { MySqlProbePlanStore } from '../src/infrastructure/mysql-probe-plan-store.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

const codes=['PROBE_DISABLED','PROBE_UNAVAILABLE','PROBE_PERMIT_UNAVAILABLE','PROBE_PERMIT_LIMIT','AUTHORIZATION_DENIED','NOT_FOUND','REVISION_CONFLICT','UNSUPPORTED_CAPABILITY','SESSION_SUPERSEDED'] as const;
const statuses=[200,400,401,403,404,409,413,422,429,503] as const;
const allowedStatuses=new Set([403,404,409,422,429]);
const save='SAVEPOINT probe_plan_issue',rollback='ROLLBACK TO SAVEPOINT probe_plan_issue',release='RELEASE SAVEPOINT probe_plan_issue';
const transient=new Set(['PROBE_UNAVAILABLE','PROBE_PERMIT_UNAVAILABLE','PROBE_PERMIT_LIMIT','SESSION_SUPERSEDED']);
const at=1800000000000;

test('36 actual finite-plan native isolate covers all nine rejection codes all status classes and retryable quota exception without swallowing unknown failures',async()=>{
    assert.deepEqual(PROBE_PLAN_REJECTIONS,codes);
    const lower=new MySqlProbePlanStore(probePlanStorageValues);
    for(const code of codes)for(const status of statuses)for(const retryable of [false,true]){
        const error=new ControlError(code,status as 409,'original private error',retryable),trace:string[]=[];
        const tx={async query(this:unknown,sql:string){assert.equal(this,tx);trace.push(sql);return [];}} as unknown as Transaction;
        const action=async()=>{trace.push('action');throw error;};
        const permitted=allowedStatuses.has(status)&&(!retryable||code==='PROBE_PERMIT_LIMIT'&&status===429);
        if(permitted){assert.deepEqual(await lower.isolate(tx,action),{accepted:false,error:{code,status}});assert.deepEqual(trace,[save,'action',rollback,release]);}
        else {await assert.rejects(lower.isolate(tx,action),actual=>actual===error);assert.deepEqual(trace,[save,'action']);}
    }
    for(const error of [new Error('driver failure'),new ControlError('OTHER_ERROR',409,'unknown'),{code:'PROBE_DISABLED',status:409,retryable:false}]){
        const trace:string[]=[],tx={async query(sql:string){trace.push(sql);return [];}} as unknown as Transaction;
        await assert.rejects(lower.isolate(tx,async()=>{trace.push('action');throw error;}),actual=>actual===error);assert.deepEqual(trace,[save,'action']);
    }
});

test('36 original finite-plan isolate retains classifier timing and every native savepoint callback failure identity before any retry or result projection',async()=>{
    for(const mode of ['create','success-release','classify','rollback','refusal-release'] as const){
        const trace:string[]=[],failure=new Error(mode),refusal=new ControlError('AUTHORIZATION_DENIED',403,'original');
        const lower=new MySqlProbePlanStore({...probePlanStorageValues,failure(error:unknown){trace.push('classify');assert.equal(error,refusal);if(mode==='classify')throw failure;return probePlanStorageValues.failure(error);}});
        const tx={async query(this:unknown,sql:string){assert.equal(this,tx);trace.push(sql);if(sql===save&&mode==='create'||sql===rollback&&mode==='rollback'||sql===release&&(mode==='success-release'||mode==='refusal-release'))throw failure;return [];}} as unknown as Transaction;
        let actions=0;await assert.rejects(lower.isolate(tx,async()=>{actions++;trace.push('action');if(mode!=='success-release')throw refusal;return {original:true};}),actual=>actual===failure);
        const expected=mode==='create'?[save]:mode==='success-release'?[save,'action',release]:mode==='classify'?[save,'action','classify']:mode==='rollback'?[save,'action','classify',rollback]:[save,'action','classify',rollback,release];
        assert.deepEqual(trace,expected);assert.equal(actions,mode==='create'?0:1);
    }
    const trace:string[]=[],value={original:true},lower=new MySqlProbePlanStore(probePlanStorageValues),tx={async query(sql:string){trace.push(sql);return [];}} as unknown as Transaction;
    const result=await lower.isolate(tx,async()=>{trace.push('action');return value;});assert.equal(result.accepted,true);if(result.accepted)assert.equal(result.value,value);assert.deepEqual(trace,[save,'action',release]);
});

function ownerFixture(){
    const binding=JSON.parse(readFileSync(new URL('../../../docs/protocol/fixtures/probe-result-v1.json',import.meta.url),'utf8')).request.binding;
    const config:ProbePlanConfig={version:1,kind:'tcp-connect',forwardId:binding.forwardId,expectedForwardRevision:binding.forwardRevision,timeoutMs:1000,mode:'manual',intervalSeconds:null,maxRuns:3,expiresAt:at+60000};
    const head:ProbePlanHead={id:'plan',scopeId:'scope-a',createdBy:'creator',createdAt:at-1000,config,configDigest:nativeValueDigest(config),originBinding:binding,revision:1,state:'active',decisionCount:0,acceptedCount:0,nextRunAt:0,updatedAt:at-1000,cancelledBy:null,cancelledAt:null,lastCode:null,recoverySuspended:false};
    const trace:string[]=[],state={head,decisions:[] as ProbePlanDecision[],issued:[] as string[],replies:[] as unknown[],error:undefined as unknown,fault:''},failure=new Error('original owner provider');let issuedSavepoint:string[]=[];
    const tx={async query(this:unknown,sql:string){assert.equal(this,tx);trace.push(sql);if(state.fault===sql)throw failure;if(sql===save)issuedSavepoint=[...state.issued];if(sql===rollback)state.issued=[...issuedSavepoint];return [];}};
    function same(actual:unknown,name:string){assert.equal(actual,tx);trace.push(name);if(state.fault===name)throw failure;}
    const db={async transaction<T>(action:(actual:typeof tx)=>Promise<T>){trace.push('begin');const before=structuredClone({head:state.head,decisions:state.decisions,issued:state.issued,replies:state.replies});try{const result=await action(tx);trace.push('commit');return result;}catch(error){Object.assign(state,before);trace.push('outer-rollback');throw error;}}};
    const lower=new MySqlProbePlanStore(probePlanStorageValues);
    const store={async lockScope(actual:unknown){same(actual,'lock');},async get(actual:unknown){same(actual,'get');return state.head;},async isolate<T>(actual:typeof tx,action:()=>Promise<T>){same(actual,'isolate');return lower.isolate(actual as unknown as Transaction,action);},async append(actual:unknown,_scope:string,_id:string,value:ProbePlanDecision){same(actual,'append');state.decisions.push(value);},async put(actual:unknown,value:ProbePlanHead){same(actual,'put');state.head=value;}} as unknown as ProbePlanStore<typeof tx>;
    const owner=new ProbePlans({db,auth:{async scope(actual,actor,scope,manage){same(actual,'auth:'+actor);assert.equal(scope,'scope-a');assert.equal(manage,true);}},requests:{async claim(actual){same(actual,'claim');return undefined;},async respond(actual,_request,response){same(actual,'respond');state.replies.push(response);}},store,
        issuer:{async previewIn(){assert.fail('manual saved plan never previews');},async issueIn(actual,actor,scope,value){same(actual,'issue');assert.equal(actor,'manager');assert.equal(scope,'scope-a');assert.deepEqual(value,state.head.config);state.issued.push('original permit mutation');if(state.error)throw state.error;return {status:202,body:{probeId:'permit',forwardId:config.forwardId,issuedAt:new Date(at).toISOString(),expiresAt:new Date(at+2000).toISOString(),dispatch:'agent-poll',executionEnabled:false}};}},executionEnabled:true,scheduleEnabled:false,clock:()=>at});
    return {state,trace,failure,run:()=>owner.command('manager','scope-a','plan','request-key','run',{expectedRevision:1})};
}

test('36 actual original ProbePlans owner persists every recognized native refusal after isolated issuer rollback while unknown and retryable nonquota errors abort the whole transaction',async()=>{
    for(const code of codes)for(const status of [403,404,409,422,429] as const)for(const retryable of [false,true]){
        const f=ownerFixture(),error=new ControlError(code,status,'original',retryable);f.state.error=error;
        const permitted=!retryable||code==='PROBE_PERMIT_LIMIT'&&status===429;
        if(permitted){const result=await f.run();assert.deepEqual(result.body.decision!.outcome,{accepted:false,error:{code,status}});assert.deepEqual(f.state.issued,[]);assert.equal(f.state.decisions.length,1);assert.equal(f.state.head.revision,2);assert.equal(f.state.head.acceptedCount,0);assert.equal(f.state.head.state,transient.has(code)?'active':'suspended');assert.equal(f.state.replies.length,1);assert.deepEqual(f.trace.slice(f.trace.indexOf('issue')+1),[rollback,release,'append','put','respond','commit']);}
        else {await assert.rejects(f.run(),actual=>actual===error);assert.equal(f.state.head.revision,1);assert.deepEqual(f.state.issued,[]);assert.deepEqual(f.state.decisions,[]);assert.deepEqual(f.state.replies,[]);assert.deepEqual(f.trace.slice(f.trace.indexOf('issue')+1),['outer-rollback']);}
    }
    const f=ownerFixture(),unknown=new Error('uncertain original issuer');f.state.error=unknown;await assert.rejects(f.run(),actual=>actual===unknown);assert.deepEqual(f.state.issued,[]);assert.equal(f.state.decisions.length,0);assert.equal(f.trace.at(-1),'outer-rollback');assert.equal(f.trace.includes(rollback),false);
});

test('36 actual owner native savepoint release rollback and late decision provider faults restore all transaction effects with no durable partial decision or implicit retry',async()=>{
    for(const rejected of [false,true])for(const fault of [save,release,...(rejected?[rollback]:[]),'append','put','respond']){
        const f=ownerFixture();f.state.fault=fault;if(rejected)f.state.error=new ControlError('PROBE_PERMIT_LIMIT',429,'recognized quota',true);
        await assert.rejects(f.run(),actual=>actual===f.failure);assert.equal(f.state.head.revision,1);assert.equal(f.state.head.decisionCount,0);assert.deepEqual(f.state.issued,[]);assert.deepEqual(f.state.decisions,[]);assert.deepEqual(f.state.replies,[]);assert.equal(f.trace.at(-1),'outer-rollback');
        assert.equal(f.trace.filter(name=>name==='issue').length,fault===save?0:1);assert.equal(f.trace.filter(name=>name===save).length,1);
        if(fault===rollback)assert.equal(f.trace.includes(release),false);if(fault===save||fault===release||fault===rollback)assert.equal(f.trace.includes('append'),false);
    }
});
