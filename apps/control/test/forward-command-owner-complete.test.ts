import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_COUNTER } from '@tunex/core';
import type { Forward, ForwardSpec } from '@tunex/core';
import { ForwardCommands as LegacyCommands } from '../src/application/forward-commands.ts';
import { FORWARD_COMMAND_INTERFACE_VERSION as legacyVersion } from '../src/application/forward-command-contract.ts';
import { ForwardCommands, FORWARD_COMMAND_INTERFACE_VERSION, ForwardCommandExecutor } from '../src/modules/forward-owner/public.ts';
import { ForwardCommandExecutor as LegacyPreparation } from '../src/modules/runtime/forward-commands.ts';
import type { ForwardCommandPreparation, ForwardOperationCommands, ForwardWriter, RetrySource } from '../src/modules/forward-owner/public.ts';
import type { ForwardCommandPreparation as OldPreparation, ForwardOperationCommands as OldOperations, RetrySource as OldSource } from '../src/modules/runtime/forward-command-ports.ts';
import type { CommandResponse, IdempotentRequests, RequestIdentity, ScopeAuthorization, ScopeOwnerAuthorization, ResourceReadAccess, TransactionBoundary } from '../src/framework/public.ts';
import type { ForwardPathBindings, ForwardPathGroups } from '../src/modules/path-owner/public.ts';
import type { RuntimeLedger } from '../src/modules/runtime/ledger.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

type Tx = Readonly<{ marker: symbol }>;
const spec = (): ForwardSpec => ({ enabled:true,protocols:['tcp'],ingress:{nodeId:'node',listen:{address:'127.0.0.1',port:22001}},target:{host:'127.0.0.1',port:80} });
// Compile-time consumers use exact old and canonical declarations. The native
// Runtime ledger itself supplies the port; no alternative Operation owner exists.
const originalLedgerPort = (value:RuntimeLedger):ForwardOperationCommands<Transaction> => value;
const oldPreparation = <T>(value:ForwardCommandPreparation<T>):OldPreparation<T> => value;
const canonicalPreparation = <T>(value:OldPreparation<T>):ForwardCommandPreparation<T> => value;
const oldOperations = <T>(value:ForwardOperationCommands<T>):OldOperations<T> => value;
const canonicalSource = (value:OldSource):RetrySource => value;

function fixture(metadata=true) {
    const tx:Tx=Object.freeze({marker:Symbol('original-command-tx')}),events:string[]=[];
    let state={forward:{id:'forward',scopeId:'scope',revision:4,spec:spec()} as Forward,authorizer:'before',deleting:false,
        operations:[] as {kind:string;forward:Forward;previous:unknown;source:string|null|undefined;request:RequestIdentity}[],responses:[] as CommandResponse[]};
    const options={failure:'',replay:undefined as CommandResponse|undefined,recovery:false,reference:'forward',
        source:{id:'reread-source',target_revision:4,status:'failed',recovery_invalidated:0,previous_spec:{historical:'opaque'}} as RetrySource};
    const failure=new Error('original provider failure');
    const event=(value:Tx,name:string)=>{assert.equal(value,tx);events.push(name);if(options.failure===name)throw failure;};
    const db:TransactionBoundary<Tx>={async transaction(action){events.push('begin');const before=structuredClone(state);try{const result=await action(tx);events.push('commit');return result;}catch(error){state=before;events.push('rollback');throw error;}}};
    const identity:ScopeAuthorization<Tx>&ScopeOwnerAuthorization<Tx>={async owner(value,actor,scope){assert.equal(value,tx);assert.equal(actor,'actor');assert.equal(scope,'scope');},async scope(value,actor,scope,manage){event(value,manage?'manage':'visible');assert.equal(actor,'actor');assert.equal(scope,'scope');}};
    const idempotency:IdempotentRequests<Tx>={async claim<R extends CommandResponse>(value:Tx){event(value,'claim');return options.replay as R|undefined;},async respond(value,_request,response){event(value,'respond');state.responses.push(response);}};
    const forwarding:ForwardWriter<Tx>={async ownershipForUpdate(value){assert.equal(value,tx);return state.forward;},async classifyOwner(){throw Error('Unused classification');},async record(value){event(value,'record');return {...state.forward,ownerActorId:'actor',deleting:state.deleting,recoverySuspended:options.recovery};},async currentForUpdate(value,_scope,id){event(value,'current');assert.equal(id,options.reference);return state.forward;},async insert(value,forward){event(value,'insert');state.forward=forward;},async replace(value,_current,next){event(value,'replace');state.forward=next;},async setAuthorizer(value,_id,actor){event(value,'authorizer');state.authorizer=actor;},async markDeleting(value,current,revision){event(value,'deleting');state.forward={...current,revision};state.deleting=true;}};
    const operations:ForwardOperationCommands<Tx>={async read(value,_scope,id){event(value,'operation-reference');assert.equal(id,'requested-source');return {forward_id:options.reference};},async get(value,_scope,id){event(value,'operation-reread');assert.equal(id,'requested-source');return options.source;},async accept(value,forward,request,kind,previous=null,source=null){event(value,'operation');state.operations.push({kind,forward,request,previous,source});return 'accepted-operation';}};
    const execution:ForwardCommandPreparation<Tx>={async lockOwnership(value){assert.equal(value,tx);},async prepareCreate(value){event(value,'prepare-create');},async planCreate(value){event(value,'plan-create');},async prepareUpdate(value,_actor,current,next,recovery){event(value,'prepare-update');assert.equal(recovery,next.spec.ingress.nodeId!==current.spec.ingress.nodeId&&options.recovery);},async planUpdate(value){event(value,'plan-update');},async lock(value){event(value,'execution-lock');},async lockRemoval(value){event(value,'removal-lock');},async prepareRetry(value){event(value,'prepare-retry');},async assertCapacity(value){event(value,'capacity');}};
    const paths:ForwardPathBindings<Tx>={async resolve(){throw Error('unused');},async accept(){throw Error('unused');},async preserve(value){event(value,'path-preserve');}};
    const groups:ForwardPathGroups<Tx>={async resolve(){throw Error('unused');},async accept(){throw Error('unused');},async preserve(value){event(value,'group-preserve');},async detach(){throw Error('unused');}};
    const access:ResourceReadAccess<Tx>={
        async principal(value,actor){assert.equal(value,tx);return {actorId:actor,governance:false};},
        async forward(value,actor,scope,id){assert.equal(value,tx);assert.equal(actor,'actor');assert.equal(scope,'scope');assert.equal(id,state.forward.id);if(options.replay)event(value,'read-access');},
        async node(){throw Error('Unused Node view');},
        async owned(value,actor,scope,kind,id){assert.equal(value,tx);assert.equal(actor,'actor');assert.equal(scope,'scope');assert.equal(kind,'forward');assert.equal(id,state.forward.id);},
    };
    const service=new ForwardCommands(db,identity,access,idempotency,forwarding,operations,execution,()=>{events.push('new-id');return 'created-forward';},metadata?paths:undefined,metadata?groups:undefined);
    return {tx,events,options,failure,db,identity,access,idempotency,forwarding,operations,execution,service,state:()=>state,
        create:()=>service.create('actor','scope','create-key',spec()),update:(input:ForwardSpec=spec(),expected=4)=>service.update('actor','scope','forward','update-key',expected,input),remove:(expected=4)=>service.remove('actor','scope','forward','remove-key',expected),retry:(expected=4)=>service.retry('actor','scope','retry-key','requested-source',expected)};
}

test('Forward command complete canonical/legacy API, private compatibility shape and each required preparation method',()=>{
    assert.equal(LegacyCommands,ForwardCommands);assert.equal(LegacyPreparation,ForwardCommandExecutor);assert.equal(legacyVersion,2);assert.equal(FORWARD_COMMAND_INTERFACE_VERSION,2);
    assert.equal(ForwardCommands.length,11);
    assert.deepEqual(Object.getOwnPropertyNames(ForwardCommands.prototype),['constructor','classifyOwner','create','acceptCreate','previewIngressIn','createIngressIn','compensateIngressIn','removeIngressIn','inspectIngressIn','previewIngressUpdateIn','updateIngressIn','update','applyPath','applyGroup','acceptUpdate','publicationCurrent','publicationState','previewPublicationIn','applyPublicationIn','compensatePublicationIn','remove','acceptRemove','retry']);
    const f=fixture();assert.equal(oldPreparation(f.execution),f.execution);assert.equal(canonicalPreparation(f.execution),f.execution);assert.equal(oldOperations(f.operations),f.operations);assert.equal(canonicalSource(f.options.source),f.options.source);assert.equal(typeof originalLedgerPort,'function');
    for(const method of ['prepareCreate','planCreate','prepareUpdate','planUpdate','lock','lockOwnership','lockRemoval','prepareRetry','assertCapacity'] as const){const broken={...f.execution,[method]:undefined};assert.throws(()=>new ForwardCommands(f.db,f.identity,f.access,f.idempotency,f.forwarding,f.operations,broken as unknown as ForwardCommandPreparation<Tx>,()=>''),{message:'Forward execution preparation is required'});}
    assert.deepEqual(f.events,[]);assert.ok(fixture(false).service);
});

test('Forward command complete create and changed/no-op metadata preserve ordering keeps exact responses',async()=>{
    const created=fixture(),result=await created.create();assert.deepEqual(created.events,['begin','visible','claim','manage','new-id','prepare-create','insert','plan-create','operation','capacity','respond','commit']);assert.deepEqual(result,{status:202,body:{forwardId:'created-forward',revision:1,operationId:'accepted-operation'}});
    for(const changed of [false,true]){const f=fixture();const result=await f.update(changed?{...spec(),target:{host:'127.0.0.1',port:81}}:spec());assert.deepEqual(f.events,changed?['begin','visible','claim','manage','current','record','prepare-update','replace','group-preserve','path-preserve','authorizer','plan-update','operation','capacity','respond','commit']:['begin','visible','claim','manage','current','record','prepare-update','respond','commit']);assert.deepEqual(result,{status:changed?202:200,body:{forwardId:'forward',revision:changed?5:4,operationId:changed?'accepted-operation':null}});}
    for(const method of ['create','update','remove','retry'] as const){const f=fixture();f.options.replay={status:202,body:{forwardId:'forward',revision:4,operationId:'historical'}};const response=await f[method]();assert.equal(response,f.options.replay);assert.deepEqual(f.events,['begin','visible','claim','read-access','commit']);}
    for(const stage of ['group-preserve','path-preserve','capacity','respond']){const f=fixture(),before=structuredClone(f.state());f.options.failure=stage;await assert.rejects(f.update({...spec(),enabled:false}),error=>error===f.failure);assert.deepEqual(f.state(),before);assert.equal(f.events.at(-1),'rollback');}
});

test('Forward command complete original authorization and provider failures retain first error and atomic owner state',async()=>{
    for(const method of ['create','update','remove','retry'] as const)for(const stage of ['visible','claim','manage']){const f=fixture(),before=structuredClone(f.state());f.options.failure=stage;await assert.rejects(f[method](),error=>error===f.failure);assert.deepEqual(f.state(),before);assert.deepEqual(f.events,['begin',...(['visible','claim','manage'].slice(0,['visible','claim','manage'].indexOf(stage)+1)),'rollback']);}
    for(const stage of ['prepare-create','insert','plan-create','operation','capacity','respond']){const f=fixture(),before=structuredClone(f.state());f.options.failure=stage;await assert.rejects(f.create(),error=>error===f.failure);assert.deepEqual(f.state(),before);assert.equal(f.events.at(-2),stage);assert.equal(f.events.at(-1),'rollback');}
    for(const stage of ['current','record','prepare-update','replace','authorizer','plan-update','operation']){const f=fixture(),before=structuredClone(f.state());f.options.failure=stage;await assert.rejects(f.update({...spec(),enabled:false}),error=>error===f.failure);assert.deepEqual(f.state(),before);assert.equal(f.events.at(-2),stage);assert.equal(f.events.at(-1),'rollback');}
    const replay=fixture();replay.options.replay={status:202,body:{forwardId:'forward',revision:4,operationId:'old'}};replay.options.failure='read-access';await assert.rejects(replay.create(),error=>error===replay.failure);assert.deepEqual(replay.events,['begin','visible','claim','read-access','rollback']);
    for(const method of ['create','update','remove','retry'] as const){const f=fixture();const invoke=method==='create'?()=>f.service.create('actor','scope','key',{}):method==='update'?()=>f.update(spec(),0):method==='remove'?()=>f.remove(0):()=>f.retry(0);await assert.rejects(invoke(),{code:'INVALID_CONFIG'});assert.deepEqual(f.events,[]);}
});

test('Forward removal complete execution lock wins over CAS/exhaustion and all later owner writes roll back',async()=>{
    for(const revision of [4,MAX_COUNTER]){const f=fixture();f.state().forward={...f.state().forward,revision};f.options.failure='removal-lock';await assert.rejects(f.remove(3),error=>error===f.failure);assert.deepEqual(f.events,['begin','visible','claim','manage','current','removal-lock','rollback']);}
    const stale=fixture();stale.state().forward={...stale.state().forward,revision:MAX_COUNTER};await assert.rejects(stale.remove(3),{code:'REVISION_CONFLICT',message:'Expected revision does not match'});
    const exhausted=fixture();exhausted.state().forward={...exhausted.state().forward,revision:MAX_COUNTER};await assert.rejects(exhausted.remove(MAX_COUNTER),{code:'REVISION_EXHAUSTED',message:'Revision counter exhausted'});
    const f=fixture();assert.deepEqual(await f.remove(),{status:202,body:{forwardId:'forward',revision:5,operationId:'accepted-operation'}});assert.deepEqual(f.events,['begin','visible','claim','manage','current','removal-lock','deleting','operation','capacity','respond','commit']);assert.deepEqual(f.state().operations[0]!.previous,spec());
    for(const stage of ['deleting','operation','capacity','respond']){const f=fixture(),before=structuredClone(f.state());f.options.failure=stage;await assert.rejects(f.remove(),error=>error===f.failure);assert.deepEqual(f.state(),before);}
});

test('Forward retry complete reread authority and multi-defect first errors precede preparation and preserve source identity',async()=>{
    const success=fixture();const result=await success.retry();assert.deepEqual(success.events,['begin','visible','claim','manage','operation-reference','current','execution-lock','operation-reread','prepare-retry','authorizer','operation','capacity','respond','commit']);assert.deepEqual(result,{status:202,body:{forwardId:'forward',revision:4,operationId:'accepted-operation',sourceOperationId:'reread-source'}});assert.deepEqual(success.state().operations[0]!.previous,{historical:'opaque'});assert.equal(success.state().operations[0]!.source,'reread-source');assert.equal(success.state().forward.revision,4);
    for(const mode of ['recovery-first','revision-before-status','source-revision-before-status','status','maximum-revision'] as const){const f=fixture();f.options.source.status='succeeded';let expected=4;let code='OPERATION_SUPERSEDED',message='Operation no longer targets an editable desired revision';if(mode==='recovery-first'){f.options.source.recovery_invalidated=1;f.options.source.target_revision=3;expected=2;message='Restored operation is not an authoritative deployment attempt';}else if(mode==='revision-before-status'){expected=3;}else if(mode==='source-revision-before-status'){f.options.source.target_revision=3;}else if(mode==='maximum-revision'){f.state().forward={...f.state().forward,revision:MAX_COUNTER};f.options.source.target_revision=MAX_COUNTER;f.options.source.status='failed';expected=MAX_COUNTER;assert.equal((await f.retry(expected)).status,202);continue;}else{code='OPERATION_NOT_RETRYABLE';message='Only failed Operations can be retried';}await assert.rejects(f.retry(expected),{code,message});assert.equal(f.events.includes('prepare-retry'),false);assert.equal(f.state().authorizer,'before');}
    for(const stage of ['operation-reference','current','execution-lock','operation-reread','prepare-retry','authorizer','operation','capacity','respond']){const f=fixture(),before=structuredClone(f.state());f.options.failure=stage;await assert.rejects(f.retry(),error=>error===f.failure);assert.deepEqual(f.state(),before);assert.equal(f.events.at(-2),stage);assert.equal(f.events.at(-1),'rollback');}
});
