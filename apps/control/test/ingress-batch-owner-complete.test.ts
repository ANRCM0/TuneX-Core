import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as Core from '@tunex/core';
import * as Framework from '../src/framework/public.ts';
import * as Compatibility from '../src/compatibility/public.ts';
import * as Ingress from '../src/modules/ingress-owner/public.ts';
import * as Path from '../src/modules/path-owner/public.ts';
import { nativeValueDigest as digest } from '../src/compatibility/public.ts';
import { ControlError } from '../src/framework/public.ts';
import { IngressDeployments, IngressMigrations, INGRESS_LIMITS, INGRESS_MIGRATION_LIMITS, parseIngressInput, parseIngressPlan,
    parseIngressOriginRef, parseIngressLineage, parseIngressMigrationInput, parseIngressMigrationPlan, parseIngressGroup } from '../src/modules/ingress-owner/public.ts';
import { IngressDeployments as LegacyDeployment } from '../src/application/ingress-deployments.ts';
import { IngressMigrations as LegacyMigration } from '../src/application/ingress-migrations.ts';
import * as LegacyValues from '../src/modules/ingress-contract.ts';
import * as LegacyMigrationValues from '../src/modules/ingress-migration-contract.ts';
import { parsePathTemplate, pathPublicationStorageValues, parsePublicationState } from '../src/modules/path-owner/public.ts';
import type { ForwardSpec } from '@tunex/core';
import type { IngressDeploymentHead } from '../src/modules/ingress-owner/public.ts';
import type { PublicationOperation, PublicationForwardState } from '../src/modules/path-owner/public.ts';

type Any=Record<string,any>;
const at=1800000000000,hash='sha256:'+'a'.repeat(64),clone=<T>(value:T):T=>structuredClone(value);
function member(id:string,revision=1){
    const config=parsePathTemplate({version:1,protocols:['tcp','udp'],nodes:['ingress-'+id,'relay-'+id+'-'+revision],endpoints:[{nodeId:'relay-'+id+'-'+revision,revision:1}],transport:{profileId:'profile',configRevision:revision}});
    return {memberId:id,template:{templateId:'template-'+id,revision,configDigest:digest({config,profileDigest:hash})},config};
}
function specFor(value:ReturnType<typeof member>,port=32001){return {enabled:false,protocols:value.config.protocols,ingress:{nodeId:value.config.nodes[0],listen:{address:'127.0.0.1',port}},target:{host:'127.0.0.1',port:9000},path:{via:value.config.nodes.slice(1)},transport:value.config.transport};}
function forwardState(id:string,value:ReturnType<typeof member>,revision=1){const spec=specFor(value);return parsePublicationState({forwardId:id,revision,spec,specDigest:digest(spec),path:{...value.template,sequence:1,forwardRevision:1},group:null});}

function fixture(kind:'deployment'|'migration'='deployment',action:'add'|'update'|'remove'='update'){
    const migration=kind==='migration',tx={original:true},events:string[]=[],failure=new Error('original owner provider');
    const old=member('a'),next=member('a',2),added=member('c',2),oldConfig=parseIngressGroup({schemaVersion:1,members:[{memberId:'a',template:old.template}]}),targetMember=action==='add'?added:next;
    const newConfig=parseIngressGroup({schemaVersion:1,members:[{memberId:targetMember.memberId,template:targetMember.template}]}),group={groupId:'group',revision:1,configDigest:digest(oldConfig)},targetGroup={groupId:'group',revision:2,configDigest:digest(newConfig)};
    const ref={kind:'deployment',batchId:'origin',position:1,phase:'apply'},source=parseIngressLineage({ref,group,memberId:'a',template:old.template,state:forwardState('forward-a',old)});
    const input:any=migration?{schemaVersion:1,sourceGroup:group,targetGroup,sources:[ref],items:[action==='add'?{kind:'add',memberId:'c',enabled:false,listen:{address:'127.0.0.1',port:32003},target:{host:'127.0.0.1',port:9000}}:action==='update'?{kind:'update',memberId:'a',source:1}:{kind:'remove',source:1}]}:
        {schemaVersion:1,group,enabled:false,target:{host:'127.0.0.1',port:9000},items:[{memberId:'a',listen:{address:'127.0.0.1',port:32001}}]};
    const desired=specFor(targetMember,action==='add'?32003:32001);
    const changes:any[]=action==='add'?[{memberId:'a',kind:'removed',sourceTemplate:old.template,targetTemplate:null,sourceIngress:'ingress-a',targetIngress:null},{memberId:'c',kind:'added',sourceTemplate:null,targetTemplate:added.template,sourceIngress:null,targetIngress:'ingress-c'}]:
        [{memberId:'a',kind:'reference-changed',sourceTemplate:old.template,targetTemplate:next.template,sourceIngress:'ingress-a',targetIngress:'ingress-a'}];
    const plan:any=migration?parseIngressMigrationPlan({schemaVersion:1,sourceGroup:group,targetGroup,sourceDefinition:oldConfig,targetDefinition:newConfig,sources:[source],changes,
        items:[{position:1,kind:action,memberId:action==='add'?'c':'a',source:action==='add'?null:1,template:action==='remove'?null:targetMember.template,spec:action==='remove'?null:desired,specDigest:action==='remove'?null:digest(desired)}]}):
        parseIngressPlan({schemaVersion:1,group,items:[{position:1,memberId:'a',template:old.template,spec:specFor(old),specDigest:digest(specFor(old))}]});
    const state={record:{head:{batchId:'batch',revision:1,createdBy:'actor',createdAt:at,planDigest:digest(plan),cancelled:false,recoveryInvalidated:false},plan,attempts:[]} as {head:IngressDeploymentHead;plan:any;attempts:any[]},
        count:0,replay:undefined as any,response:undefined as any,forwards:[] as Any[],fail:'',now:at,clockCalls:0,id:'new-batch',badResult:'' as string,refusal:false,operations:[] as Any[],planChanged:false};
    const step=(name:string,actual?:unknown)=>{if(actual!==undefined)assert.equal(actual,tx);events.push(name);if(state.fail===name)throw failure;};
    const db={async transaction<T>(run:(value:typeof tx)=>Promise<T>){events.push('begin');const saved=clone({record:state.record,response:state.response,forwards:state.forwards});try{const result=await run(tx);events.push('commit');return result;}catch(error){Object.assign(state,saved);events.push('rollback');throw error;}}};
    const auth={async scope(actual:unknown,actor:string,scope:string,manage=false){assert.equal(this,auth);assert.equal(actor,'actor');assert.equal(scope,'scope');step('auth:'+manage,actual);}};
    const requests={async claim<T>(actual:unknown,request:Any):Promise<T|undefined>{assert.equal(this,requests);assert.equal(request.actorId,'actor');assert.equal(request.scopeId,'scope');assert.match(request.digest,/^sha256:[a-f0-9]{64}$/);step('claim',actual);return state.replay;},async respond(actual:unknown,request:Any,response:unknown){assert.equal(this,requests);assert.equal(request.scopeId,'scope');step('respond',actual);state.response=response;}};
    const store={async lockScope(actual:unknown,scope:string){assert.equal(this,store);assert.equal(scope,'scope');step('scopeLock',actual);},async count(actual:unknown){assert.equal(this,store);step('count',actual);return state.count;},
        async create(actual:unknown,scope:string,head:IngressDeploymentHead,createdPlan:Any){assert.equal(this,store);assert.equal(scope,'scope');step('createBatch',actual);state.record={head:clone(head),plan:clone(createdPlan),attempts:[]};},
        async read(actual:unknown,scope:string,id:string,lock=false){assert.equal(this,store);assert.equal(scope,'scope');assert.equal(id,'batch');step('read:'+lock,actual);return state.record===null?null:clone(state.record);},
        async list(actual:unknown,scope:string,paging:Any,groupId?:string){assert.equal(this,store);assert.equal(scope,'scope');assert.deepEqual(paging,{page:1,limit:25,offset:0});assert.equal(groupId,'group');step('list',actual);return {total:1,items:[clone(state.record.head)]};},
        async operations(actual:unknown,scope:string,ids:string[]){assert.equal(this,store);assert.equal(scope,'scope');step('operations',actual);assert.deepEqual(ids,[...new Set(state.record.attempts.flatMap((entry:Any)=>entry.outcome.accepted&&entry.outcome.result.accepted.body.operationId?[entry.outcome.result.accepted.body.operationId]:[]))]);return state.operations as PublicationOperation[];},
        async isolate<T>(actual:unknown,run:()=>Promise<T>){assert.equal(this,store);step('savepoint',actual);const saved=clone(state.forwards);try{const value=await run();step('release',actual);return {accepted:true as const,value};}catch(error){if(!pathPublicationStorageValues.isRefusal(error))throw error;state.forwards=saved;step('rollbackSavepoint',actual);step('release',actual);return {accepted:false as const,error:pathPublicationStorageValues.refusal(error)};}},
        async append(actual:unknown,scope:string,id:string,revision:number,attempt:Any){assert.equal(this,store);assert.equal(scope,'scope');assert.equal(id,'batch');assert.equal(revision,state.record.head.revision);step('append',actual);state.record.head.revision++;state.record.attempts.push(clone(attempt));},
        async cancel(actual:unknown,scope:string,id:string,revision:number,actor:string,time:number){assert.equal(this,store);assert.equal(scope,'scope');assert.equal(id,'batch');assert.equal(revision,state.record.head.revision);assert.equal(actor,'actor');assert.equal(time,state.now);step('cancelBatch',actual);state.record.head.cancelled=true;state.record.head.revision++;}};
    const groups={async resolveIn(actual:unknown,actor:string,scope:string,selected:Any,ids:string[]){assert.equal(this,groups);assert.equal(actor,'actor');assert.equal(scope,'scope');assert.deepEqual(selected,migration?targetGroup:group);step('resolve:'+ids.join(','),actual);return ids.map(id=>{assert.equal(id,(migration?targetMember:old).memberId);return clone(migration?targetMember:old);});},
        async describeIn(actual:unknown,actor:string,scope:string,selected:Any,active=false){assert.equal(this,groups);assert.equal(actor,'actor');assert.equal(scope,'scope');step('describe:'+selected.revision+':'+active,actual);return selected.revision===1?{config:oldConfig,members:[old]}:{config:newConfig,members:[targetMember]};}};
    const origins={async resolveIn(actual:unknown,actor:string,scope:string,selected:Any){assert.equal(this,origins);assert.equal(actor,'actor');assert.equal(scope,'scope');assert.deepEqual(selected,ref);step('origin:'+selected.batchId,actual);return clone(source);}};
    function accepted(name:string,actual:unknown,spec:Any,template:Any|null,before:any,removing=false){
        step(name,actual);state.forwards.push({name,spec:clone(spec),template:clone(template),before:clone(before)});if(state.refusal)throw new ControlError('PORT_RESERVED',409,'known refusal');
        const changed=before===null||digest(spec)!==before.specDigest,revision=before===null?1:before.revision+Number(removing||changed),id=before?.forwardId??'created-forward';
        const path=removing?clone(before.path):{...template,sequence:before===null?1:before.path.sequence+Number(changed),forwardRevision:changed?revision:before.path.forwardRevision};
        const result:any={accepted:{status:removing||changed?202:200,body:{forwardId:id,revision,operationId:removing||changed?'operation-'+name+'-'+revision:null,...(removing?{}:{pathBinding:{...path,changed}})}},state:{forwardId:id,revision,spec:clone(spec),specDigest:digest(spec),path,group:null},...(removing?{deleting:true}:{})};
        if(state.badResult==='receipt')result.accepted.body.forwardId='other';if(state.badResult==='operation')result.accepted.body.operationId='bad/id';if(state.badResult==='path')result.state.path.templateId='wrong';if(state.badResult==='status')result.accepted.status=201;if(state.badResult==='revision')result.state.revision++;
        if(state.badResult==='group'){result.state.group={groupId:'pathgroup',revision:1,configDigest:hash,candidateId:'candidate',sequence:1,pathBindingSequence:result.state.path.sequence,forwardRevision:result.state.revision};result.accepted.body.pathGroupBinding={...result.state.group,changed:true};}
        return result;
    }
    const forwards={async previewIngressIn(actual:unknown,actor:string,scope:string,spec:ForwardSpec,template:Any){assert.equal(this,forwards);assert.equal(actor,'actor');assert.equal(scope,'scope');assert.ok(template.templateId);step('previewCreate',actual);const value=state.planChanged?{...spec,target:{host:'127.0.0.2',port:9000}}:spec;return {spec:value,specDigest:digest(value)};},
        async previewIngressUpdateIn(actual:unknown,actor:string,scope:string,before:PublicationForwardState,spec:ForwardSpec,template:Any){assert.equal(this,forwards);assert.equal(actor,'actor');assert.equal(scope,'scope');assert.deepEqual(before,source.state);assert.deepEqual(template,next.template);step('previewUpdate',actual);return {source:before,spec,specDigest:digest(spec)};},
        async inspectIngressIn(actual:unknown,actor:string,scope:string,before:PublicationForwardState){assert.equal(this,forwards);assert.equal(actor,'actor');assert.equal(scope,'scope');assert.deepEqual(before,source.state);step('inspect:'+before.forwardId,actual);return before;},
        async createIngressIn(actual:unknown,request:Any,spec:Any,template:Any){assert.equal(this,forwards);assert.equal(request.actorId,'actor');return accepted('createForward',actual,spec,template,null);},
        async compensateIngressIn(actual:unknown,request:Any,before:Any){assert.equal(this,forwards);assert.equal(request.actorId,'actor');return accepted('removeForward',actual,before.spec,before.path,before,true);},
        async updateIngressIn(actual:unknown,request:Any,before:Any,spec:Any,template:Any){assert.equal(this,forwards);assert.equal(request.actorId,'actor');return accepted('updateForward',actual,spec,template,before);},
        async removeIngressIn(actual:unknown,request:Any,before:Any){assert.equal(this,forwards);assert.equal(request.actorId,'actor');return accepted('removeForward',actual,before.spec,before.path,before,true);},
        async compensatePublicationIn(actual:unknown,request:Any,before:Any,original:Any){assert.equal(this,forwards);assert.equal(request.actorId,'actor');assert.deepEqual(original,source.state);return accepted('restoreForward',actual,original.spec,original.path,before);}};
    const clock=()=>{step('clock');state.clockCalls++;return state.now;},newId=()=>{step('id');return state.id;};
    const owner:any=migration?new IngressMigrations(db,auth,requests,store,groups,origins,forwards,clock,newId):new IngressDeployments(db,auth,requests,store,groups,forwards,clock,newId);
    return {kind,migration,action,tx,events,failure,state,db,auth,requests,store,groups,origins,forwards,owner,input,plan,source,group,targetGroup,old,next,added,oldConfig,newConfig,ref,reset(){events.length=0;state.clockCalls=0;}};
}

test('60/61 canonical legacy classes parsers limits and async prototypes preserve original identity and frozen migration limits',()=>{
    assert.equal(IngressDeployments,LegacyDeployment);assert.equal(IngressMigrations,LegacyMigration);
    assert.equal(parseIngressInput,LegacyValues.parseIngressInput);assert.equal(parseIngressPlan,LegacyValues.parseIngressPlan);assert.equal(INGRESS_LIMITS,LegacyValues.INGRESS_LIMITS);
    for(const name of ['parseIngressOriginRef','parseIngressLineage','parseIngressMigrationInput','parseIngressMigrationPlan','INGRESS_MIGRATION_LIMITS'] as const)assert.equal(({parseIngressOriginRef,parseIngressLineage,parseIngressMigrationInput,parseIngressMigrationPlan,INGRESS_MIGRATION_LIMITS})[name],LegacyMigrationValues[name]);
    assert.equal(Object.isFrozen(INGRESS_LIMITS),false);assert.equal(Object.isFrozen(INGRESS_MIGRATION_LIMITS),true);assert.deepEqual(INGRESS_MIGRATION_LIMITS,{batchesPerScope:64,itemsPerBatch:8,sourcesPerBatch:8,attemptsPerItem:2,maxPlanBytes:131072,maxBatchRevision:20});
    for(const Ctor of [IngressDeployments,IngressMigrations])for(const method of ['preview','create','list','get','originIn','act','cancel']){const d=Object.getOwnPropertyDescriptor(Ctor.prototype,method)!;assert.equal(d.value.constructor.name,'AsyncFunction');assert.equal(d.enumerable,false);assert.equal(d.configurable,true);assert.equal(d.writable,true);}
    assert.equal(IngressDeployments.length,6);assert.equal(IngressMigrations.length,7);
});

for(const kind of ['deployment','migration'] as const){const number=kind==='deployment'?60:61;
    test(`${number} actual preview create retain owner authorization replay replan quota exact digest ID clock and public nonauthorization flags`,async()=>{
        const f=fixture(kind),preview=await f.owner.preview('actor','scope',f.input);assert.equal(preview.previewDigest,digest(f.plan));assert.equal(preview.limits,kind==='migration'?INGRESS_MIGRATION_LIMITS:INGRESS_LIMITS);assert.equal(preview.health,'unknown');assert.equal(preview.reserved,false);assert.equal(preview.executionAuthorized,false);assert.equal(preview.fullPlanAuthorization,false);assert.equal(preview.atomicAcrossForwards,false);assert.equal(preview.automaticExecution,false);assert.equal(preview.physicalConnectionSharing,false);assert.equal(preview.source,'persisted-control-state');assert.ok(Object.isFrozen(preview.items[0]));assert.equal(f.state.clockCalls,0);
        f.reset();const result=await f.owner.create('actor','scope','create',f.input,preview.previewDigest);assert.equal(result.status,202);assert.equal(result.body.batchId,'new-batch');assert.equal(f.state.record.head.createdAt,at);assert.equal(f.state.record.head.planDigest,digest(f.plan));assert.equal(f.state.record.plan.items[0].spec.enabled,false);
        const planning=kind==='deployment'?['resolve:a','previewCreate']:['origin:origin','inspect:forward-a','describe:1:false','describe:2:true','previewUpdate'];
        assert.deepEqual(f.events,['begin','auth:true','claim','scopeLock','count',...planning,'id','clock','createBatch','respond','commit']);
        f.reset();f.state.replay={status:202,body:{saved:true}};assert.equal(await f.owner.create('actor','scope','replay',f.input,digest(f.plan)),f.state.replay);assert.deepEqual(f.events,['begin','auth:true','claim','commit']);
        for(const [count,code] of [[64,'RESOURCE_LIMIT'],[-1,'INTEGRITY_FAILURE'],[65,'INTEGRITY_FAILURE'],[0.5,'INTEGRITY_FAILURE'],[NaN,'INTEGRITY_FAILURE']] as const){const item=fixture(kind);item.state.count=count;await assert.rejects(item.owner.create('actor','scope','quota',item.input,digest(item.plan)),{code});assert.deepEqual(item.events,['begin','auth:true','claim','scopeLock','count','rollback']);}
        const changed=fixture(kind);await assert.rejects(changed.owner.create('actor','scope','changed',changed.input,hash),{code:'PUBLICATION_STATE_CHANGED'});assert.equal(changed.events.includes('id'),false);
        for(const phase of ['auth:true','claim','scopeLock','count',...planning,'id','clock','createBatch','respond']){const item=fixture(kind);item.state.fail=phase;await assert.rejects(item.owner.create('actor','scope','failure',item.input,digest(item.plan)),error=>error===item.failure);assert.equal(item.state.record.head.batchId,'batch');assert.equal(item.state.response,undefined);assert.equal(item.events.at(-1),'rollback');}
        for(const badClock of [-1,NaN,0.5,8640000000000001]){const item=fixture(kind);item.state.now=badClock;await assert.rejects(item.owner.create('actor','scope','clock',item.input,digest(item.plan)),{code:'INTEGRITY_FAILURE'});assert.equal(item.events.includes('createBatch'),false);}
        const badId=fixture(kind);badId.state.id='bad/id';await assert.rejects(badId.owner.create('actor','scope','id',badId.input,digest(badId.plan)),{code:'INTEGRITY_FAILURE'});assert.equal(badId.events.includes('clock'),false);
    });

    test(`${number} actual item command enforces manager recovery before replay CAS duplicates cancel eligibility and savepoint result validation`,async()=>{
        const f=fixture(kind),phase=kind==='deployment'?'create':'apply';
        await f.owner.act('actor','scope','batch','apply',1,phase,1);
        const forward=kind==='deployment'?'createForward':'updateForward',inside=kind==='deployment'?['resolve:a',forward]:['origin:origin','inspect:forward-a','resolve:a',forward];
        assert.deepEqual(f.events,['begin','auth:true','read:true','claim','savepoint',...inside,'release','clock','append','respond','commit']);assert.equal(f.state.record.head.revision,2);assert.equal(f.state.record.attempts[0].createdAt,at);assert.equal(f.state.record.attempts[0].outcome.accepted,true);
        f.reset();await assert.rejects(f.owner.act('actor','scope','batch','duplicate',2,phase,1),{code:'PUBLICATION_ITEM_ATTEMPTED'});assert.equal(f.events.includes('savepoint'),false);
        for(const [patch,code] of [[{createdBy:'different'},'AUTHORIZATION_DENIED'],[{recoveryInvalidated:true,revision:2},'RECOVERY_REPLAY_REQUIRES_REVIEW']] as const){const item=fixture(kind);Object.assign(item.state.record.head,patch);item.state.replay={status:202,body:{saved:true}};await assert.rejects(item.owner.act('actor','scope','batch','replay',1,phase,1),{code});assert.equal(item.events.includes('claim'),false);}
        const replay=fixture(kind);replay.state.replay={saved:true};assert.equal(await replay.owner.act('actor','scope','batch','replay',20,phase,1),replay.state.replay);assert.deepEqual(replay.events,['begin','auth:true','read:true','claim','commit']);
        const cas=fixture(kind);await assert.rejects(cas.owner.act('actor','scope','batch','cas',2,phase,1),{code:'REVISION_CONFLICT'});assert.equal(cas.events.includes('savepoint'),false);
        const cancelled=fixture(kind);Object.assign(cancelled.state.record.head,{cancelled:true,revision:2});await assert.rejects(cancelled.owner.act('actor','scope','batch','cancelled',2,phase,1),{code:'PUBLICATION_CANCELLED'});
        const missing=fixture(kind);await assert.rejects(missing.owner.act('actor','scope','batch','missing',1,phase,2),{code:'NOT_FOUND'});
        const compensation=fixture(kind);await assert.rejects(compensation.owner.act('actor','scope','batch','compensate',1,'compensate',1),{code:'PUBLICATION_NOT_COMPENSATABLE'});
        for(const defect of ['receipt','operation','path','status','revision','group']){const item=fixture(kind);item.state.badResult=defect;await assert.rejects(item.owner.act('actor','scope','batch','bad-result',1,phase,1),{code:'INTEGRITY_FAILURE'});assert.equal(item.events.includes('release'),false);assert.deepEqual(item.state.forwards,[]);assert.deepEqual(item.state.record.attempts,[]);assert.equal(item.state.record.head.revision,1);}
        for(const phaseName of ['auth:true','read:true','claim','savepoint',...inside,'release','clock','append','respond']){const item=fixture(kind);item.state.fail=phaseName;await assert.rejects(item.owner.act('actor','scope','batch','failure',1,phase,1),error=>error===item.failure);assert.equal(item.state.record.head.revision,1);assert.deepEqual(item.state.record.attempts,[]);assert.deepEqual(item.state.forwards,[]);assert.equal(item.state.response,undefined);}
        const refusal=fixture(kind);refusal.state.refusal=true;await refusal.owner.act('actor','scope','batch','refusal',1,phase,1);assert.deepEqual(refusal.state.record.attempts[0].outcome,{accepted:false,error:{code:'PORT_RESERVED',status:409}});assert.equal(refusal.state.record.head.revision,2);assert.deepEqual(refusal.state.forwards,[]);assert.ok(refusal.events.indexOf('rollbackSavepoint')<refusal.events.indexOf('release'));assert.ok(refusal.events.indexOf('release')<refusal.events.indexOf('append'));
    });

    test(`${number} cancellation no-op avoids time mutation origin historical state stays nonauthorizing get/list associate exact Operations`,async()=>{
        const f=fixture(kind),phase=kind==='deployment'?'create':'apply';await f.owner.act('actor','scope','batch','accepted',1,phase,1);f.reset();
        const result=await f.owner.cancel('actor','scope','batch','cancel',2);assert.deepEqual(result,{status:202,body:{batchId:'batch',revision:3,cancelled:true,changed:true}});assert.equal(f.state.clockCalls,1);
        f.reset();assert.deepEqual(await f.owner.cancel('actor','scope','batch','cancel-again',3),{status:200,body:{batchId:'batch',revision:3,cancelled:true,changed:false}});assert.equal(f.state.clockCalls,0);assert.equal(f.events.includes('cancelBatch'),false);
        const originRef={kind:kind==='deployment'?'deployment':'migration',batchId:'batch',position:1,phase:'apply'},lineage=await f.owner.originIn(f.tx,'actor','scope',originRef);assert.equal(lineage.state.forwardId,kind==='deployment'?'created-forward':'forward-a');assert.equal(f.events.some(x=>x.startsWith('inspect:')),false);
        f.reset();const accepted=f.state.record.attempts[0].outcome.result,operation={operationId:accepted.accepted.body.operationId,forwardId:accepted.state.forwardId,targetRevision:accepted.state.revision,status:'running',cleanupPending:true,recoveryInvalidated:false};f.state.operations=[operation];
        const view=await f.owner.get('actor','scope','batch');assert.equal(view.createdAt,new Date(at).toISOString());assert.equal(view.attempts[0].createdAt,new Date(at).toISOString());assert.deepEqual(view.operations,[operation]);assert.equal(view.items[0].state,'accepted');assert.equal(view.consistency,'read-committed-not-global-snapshot');assert.equal(view.health,'unknown');assert.equal(view.executionAuthorized,false);assert.ok(Object.isFrozen(view.attempts));
        for(const patch of [{operationId:'other'},{forwardId:'other'},{targetRevision:99},{status:'unknown'},{cleanupPending:1},{recoveryInvalidated:0}]){f.state.operations=[{...operation,...patch}];await assert.rejects(f.owner.get('actor','scope','batch'),{code:'INTEGRITY_FAILURE'});}f.state.operations=[operation,operation];await assert.rejects(f.owner.get('actor','scope','batch'),{code:'INTEGRITY_FAILURE'});
        f.reset();const page=await f.owner.list('actor','scope',{groupId:'group'});assert.equal(page.total,1);assert.equal(page.items[0].createdAt,new Date(at).toISOString());assert.deepEqual(f.events,['begin','auth:false','list','commit']);
        for(const bad of [{extra:1},{groupId:'bad/id'},{page:1},[],null])await assert.rejects(f.owner.list('actor','scope',bad),{code:'INVALID_CONFIG'});
        f.state.record.head.recoveryInvalidated=true;f.state.record.head.revision++;await assert.rejects(f.owner.originIn(f.tx,'actor','scope',originRef),{code:'RECOVERY_REPLAY_REQUIRES_REVIEW'});
    });
}

test('60 creation compensation conditionally deletes exact accepted snapshot and keeps rejected compensation eligible historical origin',async()=>{
    for(const reject of [false,true]){const f=fixture();await f.owner.act('actor','scope','batch','create',1,'create',1);f.reset();f.state.refusal=reject;await f.owner.act('actor','scope','batch','undo',2,'compensate',1);assert.deepEqual(f.events,['begin','auth:true','read:true','claim','savepoint','removeForward',...(reject?['rollbackSavepoint']:[]),'release','clock','append','respond','commit']);
        const ref={kind:'deployment',batchId:'batch',position:1,phase:'apply'};if(reject)assert.equal((await f.owner.originIn(f.tx,'actor','scope',ref)).state.forwardId,'created-forward');else await assert.rejects(f.owner.originIn(f.tx,'actor','scope',ref),{code:'PUBLICATION_STATE_CHANGED'});
    }
});

test('61 action dispatch removes without target resolution compensates add/update only and derives exact update restoration lineage',async()=>{
    for(const action of ['add','update','remove'] as const){const f=fixture('migration',action);await f.owner.act('actor','scope','batch','apply',1,'apply',1);assert.equal(f.state.record.attempts[0].outcome.accepted,true);assert.equal(f.events.includes('resolve:'+ (action==='add'?'c':'a')),action!=='remove');assert.equal(f.events.includes('origin:origin'),action!=='add');assert.equal(f.events.some(value=>value.startsWith('inspect:')),action!=='add');
        f.reset();if(action==='remove'){await assert.rejects(f.owner.act('actor','scope','batch','compensate',2,'compensate',1),{code:'PUBLICATION_NOT_COMPENSATABLE'});assert.equal(f.events.includes('savepoint'),false);await assert.rejects(f.owner.originIn(f.tx,'actor','scope',{kind:'migration',batchId:'batch',position:1,phase:'apply'}),{code:'PUBLICATION_STATE_CHANGED'});continue;}
        await f.owner.act('actor','scope','batch','compensate',2,'compensate',1);assert.equal(f.events.includes(action==='add'?'removeForward':'restoreForward'),true);assert.equal(f.events.includes('resolve:a')||f.events.includes('resolve:c')||f.events.includes('origin:origin'),false);
        await assert.rejects(f.owner.originIn(f.tx,'actor','scope',{kind:'migration',batchId:'batch',position:1,phase:'apply'}),{code:'PUBLICATION_STATE_CHANGED'});
        if(action==='add')await assert.rejects(f.owner.originIn(f.tx,'actor','scope',{kind:'migration',batchId:'batch',position:1,phase:'compensate'}),{code:'PUBLICATION_STATE_CHANGED'});
        else{const restored=await f.owner.originIn(f.tx,'actor','scope',{kind:'migration',batchId:'batch',position:1,phase:'compensate'});assert.deepEqual(restored.group,f.group);assert.deepEqual(restored.template,f.old.template);assert.equal(restored.state.specDigest,f.source.state.specDigest);assert.equal(restored.state.revision,3);}
    }
    const refused=fixture('migration');await refused.owner.act('actor','scope','batch','apply',1,'apply',1);refused.state.refusal=true;await refused.owner.act('actor','scope','batch','failed-restore',2,'compensate',1);
    assert.equal((await refused.owner.originIn(refused.tx,'actor','scope',{kind:'migration',batchId:'batch',position:1,phase:'apply'})).state.revision,2);await assert.rejects(refused.owner.originIn(refused.tx,'actor','scope',{kind:'migration',batchId:'batch',position:1,phase:'compensate'}),{code:'PUBLICATION_STATE_CHANGED'});
});

test('60/61 parsers enforce origin provenance closed input immutable complete diff explicit false update-only path source reuse replacement and UTF8 bound',()=>{
    const d=fixture(),m=fixture('migration');assert.equal(parseIngressInput(d.input).enabled,false);assert.ok(Object.isFrozen(parseIngressInput(d.input).items[0]));assert.deepEqual(parseIngressMigrationInput(m.input),m.input);
    for(const bad of [{...d.input,enabled:undefined},{...d.input,extra:true},{...d.input,items:[]},{...d.input,items:Array(9).fill(d.input.items[0])},{...d.input,items:[d.input.items[0],d.input.items[0]]}])assert.throws(()=>parseIngressInput(bad),{code:'INVALID_CONFIG'});
    for(const bad of [{...m.ref,phase:'compensate'},{...m.ref,position:0},{...m.ref,position:9},{...m.ref,extra:1}])assert.throws(()=>parseIngressOriginRef(bad),{code:'INVALID_CONFIG'});
    for(const bad of [{...m.source,state:{...m.source.state,path:null}},{...m.source,template:{...m.source.template,templateId:'wrong'}},{...m.source,extra:true}])assert.throws(()=>parseIngressLineage(bad),{code:'INVALID_CONFIG'});
    for(const bad of [{...m.input,targetGroup:m.group},{...m.input,targetGroup:{...m.targetGroup,groupId:'other'}},{...m.input,sources:[m.ref,m.ref]},{...m.input,items:[m.input.items[0],m.input.items[0]]},{...m.input,items:[{kind:'update',memberId:'a',source:2}]}])assert.throws(()=>parseIngressMigrationInput(bad),{code:'INVALID_CONFIG'});
    for(const transform of [(p:Any)=>{p.changes=[];},(p:Any)=>{p.changes[0].kind='unchanged';},(p:Any)=>{p.items[0].source=2;},(p:Any)=>{p.items[0].spec.enabled=true;p.items[0].specDigest=digest(p.items[0].spec);},(p:Any)=>{p.items[0].spec.target.port++;p.items[0].specDigest=digest(p.items[0].spec);},(p:Any)=>{p.items[0].position=2;},(p:Any)=>{p.sourceDefinition.members[0].template.revision++;}]){const plan=clone(m.plan);transform(plan);assert.throws(()=>parseIngressMigrationPlan(plan),{code:'INVALID_CONFIG'});}
    const replacement=clone(m.plan);replacement.items=[{...replacement.items[0],kind:'add',source:null}];assert.throws(()=>parseIngressMigrationPlan(replacement),{code:'INVALID_CONFIG'});replacement.items.unshift({position:1,kind:'remove',memberId:'a',source:1,template:null,spec:null,specDigest:null});replacement.items[1].position=2;assert.equal(parseIngressMigrationPlan(replacement).items.length,2);
    assert.equal(INGRESS_LIMITS.maxPlanBytes,131072);assert.ok(Buffer.byteLength(JSON.stringify(d.plan),'utf8')<=INGRESS_LIMITS.maxPlanBytes);assert.ok(Object.isFrozen(parseIngressPlan(d.plan))); // Inclusive 131072/131073 native UTF8 effect cases below exercise both parsers without mutating the shared limit frozen by preview.
});

test('61 preview sorts exact origin and Forward locks separately retains source input order complete sorted diff and action order',async()=>{
    const f=fixture('migration'),a=member('a'),b=member('b'),nextA=member('a',2),nextB=member('b',2);
    const sourceConfig=parseIngressGroup({schemaVersion:1,members:[{memberId:'b',template:b.template},{memberId:'a',template:a.template}]}),targetConfig=parseIngressGroup({schemaVersion:1,members:[{memberId:'a',template:nextA.template},{memberId:'b',template:nextB.template}]});
    const sourceGroup={groupId:'group',revision:1,configDigest:digest(sourceConfig)},targetGroup={groupId:'group',revision:2,configDigest:digest(targetConfig)};
    const firstRef={kind:'deployment' as const,batchId:'z-origin',position:1,phase:'apply' as const},secondRef={kind:'deployment' as const,batchId:'a-origin',position:1,phase:'apply' as const};
    const first=parseIngressLineage({ref:firstRef,group:sourceGroup,memberId:'a',template:a.template,state:forwardState('z-forward',a)}),second=parseIngressLineage({ref:secondRef,group:sourceGroup,memberId:'b',template:b.template,state:forwardState('a-forward',b)});
    f.origins.resolveIn=async function(actual,actor,scope,ref){assert.equal(this,f.origins);assert.equal(actual,f.tx);assert.equal(actor,'actor');assert.equal(scope,'scope');f.events.push('origin:'+ref.batchId);return clone(ref.batchId==='z-origin'?first:second);};
    f.forwards.inspectIngressIn=async function(actual,actor,scope,before){assert.equal(this,f.forwards);assert.equal(actual,f.tx);assert.equal(actor,'actor');assert.equal(scope,'scope');f.events.push('inspect:'+before.forwardId);return before;};
    f.groups.describeIn=async function(actual,actor,scope,selection,active=false){assert.equal(this,f.groups);assert.equal(actual,f.tx);assert.equal(actor,'actor');assert.equal(scope,'scope');f.events.push('describe:'+selection.revision+':'+active);return selection.revision===1?{config:sourceConfig,members:[b,a]}:{config:targetConfig,members:[nextA,nextB]};};
    f.forwards.previewIngressUpdateIn=async function(actual,actor,scope,before,spec,template){assert.equal(this,f.forwards);assert.equal(actual,f.tx);assert.equal(actor,'actor');assert.equal(scope,'scope');assert.ok(before.path);assert.equal(template.templateId,before.path.templateId);f.events.push('preview:'+before.forwardId);return {source:before,spec,specDigest:digest(spec)};};
    const input={schemaVersion:1,sourceGroup,targetGroup,sources:[firstRef,secondRef],items:[{kind:'update',source:2,memberId:'b'},{kind:'update',source:1,memberId:'a'}]};
    const preview=await f.owner.preview('actor','scope',input);assert.deepEqual(f.events,['begin','auth:true','origin:a-origin','origin:z-origin','inspect:a-forward','inspect:z-forward','describe:1:false','describe:2:true','preview:a-forward','preview:z-forward','commit']);
    assert.deepEqual(preview.sources.map((value:Any)=>value.ref),[firstRef,secondRef]);assert.deepEqual(preview.items.map((value:Any)=>[value.position,value.memberId,value.source]),[[1,'b',2],[2,'a',1]]);assert.deepEqual(preview.changes.map((value:Any)=>value.memberId),['a','b']);
    const reversed=clone(preview);reversed.changes.reverse();delete reversed.previewDigest;delete reversed.limits;for(const key of ['source','reserved','executionAuthorized','fullPlanAuthorization','health','automaticExecution','atomicAcrossForwards','physicalConnectionSharing','impactScope','interruption','removeCompensation'])delete reversed[key];assert.throws(()=>parseIngressMigrationPlan(reversed),{code:'INVALID_CONFIG'});
});

test('60/61 immutable record validation refuses duplicate accepted Forward IDs attempt identity head counters hashes and invalid receipts',async()=>{
    for(const kind of ['deployment','migration'] as const){const f=fixture(kind,kind==='migration'?'add':'update'),phase=kind==='deployment'?'create':'apply';await f.owner.act('actor','scope','batch','accepted',1,phase,1);const valid=clone(f.state.record);
        for(const patch of [
            (r:Any)=>{r.head.batchId='different';},(r:Any)=>{r.head.planDigest=hash;},(r:Any)=>{r.head.revision=1;},(r:Any)=>{r.head.createdAt=-1;},(r:Any)=>{r.head.cancelled=0;},
            (r:Any)=>{r.attempts[0].actorId='other';},(r:Any)=>{r.attempts[0].createdAt=-1;},(r:Any)=>{r.attempts[0].requestKey='white space';},(r:Any)=>{r.attempts[0].requestDigest='bad';},(r:Any)=>{r.attempts[0].position=9;},
            (r:Any)=>{r.attempts.push(clone(r.attempts[0]));r.head.revision++;},(r:Any)=>{r.attempts[0].outcome.result.accepted.body.revision++;},(r:Any)=>{r.attempts[0].outcome={accepted:false,error:{code:'UNREGISTERED_REFUSAL',status:409}};}
        ]){f.state.record=clone(valid);patch(f.state.record);await assert.rejects(f.owner.get('actor','scope','batch'),{code:'INTEGRITY_FAILURE'});}
        if(kind==='migration'){f.state.record=clone(valid);f.state.record.attempts[0].outcome.result.state.forwardId=f.source.state.forwardId;f.state.record.attempts[0].outcome.result.accepted.body.forwardId=f.source.state.forwardId;await assert.rejects(f.owner.get('actor','scope','batch'),{code:'INTEGRITY_FAILURE'});}
        f.state.record=clone(valid);const other=member(kind==='deployment'?'b':'d',kind==='deployment'?1:2),newSpec=specFor(other,32002),secondItem={...f.state.record.plan.items[0],position:2,memberId:other.memberId,template:other.template,spec:newSpec,specDigest:digest(newSpec)};
        if(kind==='migration'){
            const config=parseIngressGroup({schemaVersion:1,members:[...f.state.record.plan.targetDefinition.members,{memberId:other.memberId,template:other.template}]});f.state.record.plan.targetDefinition=config;f.state.record.plan.targetGroup.configDigest=digest(config);f.state.record.plan.changes.push({memberId:other.memberId,kind:'added',sourceTemplate:null,targetTemplate:other.template,sourceIngress:null,targetIngress:other.config.nodes[0]});
        }
        f.state.record.plan.items.push(secondItem);f.state.record.head.planDigest=digest(f.state.record.plan);const original=f.state.record.attempts[0].outcome.result,duplicate=clone(original);duplicate.state.spec=newSpec;duplicate.state.specDigest=digest(newSpec);duplicate.state.path={...other.template,sequence:1,forwardRevision:1};duplicate.accepted.body.pathBinding={...duplicate.state.path,changed:true};duplicate.accepted.body.operationId='other-operation';f.state.record.attempts.push({...clone(f.state.record.attempts[0]),position:2,requestKey:'second-key',outcome:{accepted:true,result:duplicate}});f.state.record.head.revision++;
        assert.doesNotThrow(()=>kind==='deployment'?parseIngressPlan(f.state.record.plan):parseIngressMigrationPlan(f.state.record.plan));await assert.rejects(f.owner.get('actor','scope','batch'),{code:'INTEGRITY_FAILURE'});
    }
});

test('60/61 default clocks capture constructor Date.now without sampling and cancellation samples only after replay CAS and changed decision',async()=>{
    const original=Date.now;let reads=0;
    try{
        for(const kind of ['deployment','migration'] as const){const f=fixture(kind);Date.now=()=>{reads++;return at;};const before=reads;
            const owner=kind==='deployment'?new IngressDeployments(f.db,f.auth,f.requests,f.store,f.groups,f.forwards):new IngressMigrations(f.db,f.auth,f.requests,f.store,f.groups,f.origins,f.forwards);
            assert.equal(reads,before);Date.now=()=>assert.fail('default clock must retain the constructor function');
            await owner.cancel('actor','scope','batch','cancel',1);assert.equal(reads,before+1);assert.equal(f.state.record.head.revision,2);await owner.cancel('actor','scope','batch','noop',2);assert.equal(reads,before+1);
            f.state.replay={status:200,body:{batchId:'batch',revision:2,cancelled:true,changed:false}};await owner.cancel('actor','scope','batch','replay',20);assert.equal(reads,before+1);
        }
    }finally{Date.now=original;}
    for(const kind of ['deployment','migration'] as const){
        for(const step of ['auth:true','read:true','claim','clock','cancelBatch','respond']){const f=fixture(kind);f.state.fail=step;await assert.rejects(f.owner.cancel('actor','scope','batch','failure',1),error=>error===f.failure);assert.equal(f.state.record.head.cancelled,false);assert.equal(f.state.record.head.revision,1);assert.equal(f.state.response,undefined);}
        for(const [patch,code] of [[{createdBy:'other'},'AUTHORIZATION_DENIED'],[{recoveryInvalidated:true,revision:2},'RECOVERY_REPLAY_REQUIRES_REVIEW']] as const){const f=fixture(kind);Object.assign(f.state.record.head,patch);f.state.replay={saved:true};await assert.rejects(f.owner.cancel('actor','scope','batch','replay',1),{code});assert.equal(f.events.includes('claim'),false);assert.equal(f.state.clockCalls,0);}
        const f=fixture(kind);await assert.rejects(f.owner.cancel('actor','scope','batch','cas',2),{code:'REVISION_CONFLICT'});assert.equal(f.state.clockCalls,0);
    }
});

test('60/61 original immutable parsers retain inclusive UTF8 storage bound and private closed-object error projections',()=>{
    for(const kind of ['deployment','migration'] as const){const f=fixture(kind),file=kind==='deployment'?'values.ts':'migration-values.ts',exports:Any={},measured:unknown[]=[];let bytes=131072;
        const source=ts.transpileModule(readFileSync(new URL('../src/modules/ingress-owner/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
        new vm.Script(source,{filename:'original-'+file}).runInNewContext({exports,Buffer,Object,require(name:string){const providers:Any={'@tunex/core':Core,'../../framework/public.ts':Framework,'../../compatibility/public.ts':{...Compatibility,jsonUtf8Bytes(value:unknown){measured.push(value);assert.equal(Compatibility.jsonUtf8Bytes(value),Buffer.byteLength(JSON.stringify(value),'utf8'));return bytes;}},'../path-owner/public.ts':Path,'./values.ts':Ingress,'./limits.ts':{INGRESS_LIMITS,INGRESS_MIGRATION_LIMITS}};assert.ok(Object.hasOwn(providers,name),name);return providers[name];}});
        const parse=kind==='deployment'?exports.parseIngressPlan:exports.parseIngressMigrationPlan;assert.deepEqual(JSON.parse(JSON.stringify(parse(f.plan))),JSON.parse(JSON.stringify(f.plan)));assert.equal(measured.length,1);bytes=131073;assert.throws(()=>parse(f.plan),{code:'INVALID_CONFIG',status:422,message:kind==='deployment'?'Ingress plan exceeds bounded storage':'Ingress migration plan exceeds bounded storage'});assert.equal(measured.length,2);
        const inputParser=kind==='deployment'?exports.parseIngressInput:exports.parseIngressMigrationInput;assert.throws(()=>inputParser(null),{code:'INVALID_CONFIG',status:422,message:kind==='deployment'?'Closed ingress object required':'Closed ingress migration object required'});
    }
    assert.equal(Compatibility.jsonUtf8Bytes({value:'入站'}),Buffer.byteLength(JSON.stringify({value:'入站'}),'utf8'));
});
