import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as Core from '@tunex/core';
import * as Framework from '../src/framework/public.ts';
import * as Compatibility from '../src/compatibility/public.ts';
import * as TemplateState from '../src/modules/path-owner/template-state.ts';
import * as BindingValues from '../src/modules/path-owner/binding-values.ts';
import { digest } from '@tunex/contracts/shared';
import { parseForwardSpec } from '@tunex/core';
import { PathBindings, parsePathSelection, expandPath, parsePathTemplate } from '../src/modules/path-owner/public.ts';
import { PathBindings as OldBindings } from '../src/application/path-bindings.ts';
import { parsePathSelection as oldParse, expandPath as oldExpand } from '../src/modules/path-binding-contract.ts';
import type { Forward, ForwardSpec } from '@tunex/core';
import type { PathBindingRecord, PathSelection, PathTemplateRevision } from '../src/modules/path-owner/public.ts';
import type * as Lower from '../src/framework/public.ts';
import type * as Old from '../src/modules/path-binding-ports.ts';

type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Same<T extends true>=T;
type Flat<T>={[K in keyof T]:T[K]};
type ExpectedRecord={templateId:string;revision:number;configDigest:string;sequence:number;forwardRevision:number;expandedSpec:ForwardSpec;specDigest:string;actorId:string;createdAt:number};
export type BindingOriginalDeclarations56=[Same<Equal<Flat<PathBindingRecord>,ExpectedRecord>>,Same<Equal<Flat<Lower.PathBindingStoredRecord>,ExpectedRecord>>,
    Same<Equal<Old.PathBindingReader<Tx>,Lower.PathBindingStorageReader<Tx>>>,Same<Equal<Old.PathBindingWriter<Tx>,Lower.PathBindingStorage<Tx>>>,
    Same<Equal<Lower.PathBindingSequenceReader<Tx>,{at(tx:Tx,scope:string,forwardId:string,sequence:number):Promise<Lower.PathBindingStoredRecord|null>}>>];

const at=1800000000000,hash='sha256:'+'a'.repeat(64);
const config=(via=['middle','egress'])=>parsePathTemplate({version:1,protocols:['tcp','udp'],nodes:['ingress',...via],endpoints:via.map(nodeId=>({nodeId,revision:1})),transport:{profileId:'profile',configRevision:1}});
function spec():ForwardSpec {const parsed=parseForwardSpec({enabled:false,protocols:['tcp','udp'],ingress:{nodeId:'ingress',listen:{address:'127.0.0.1',port:32001}},target:{host:'127.0.0.1',port:9000},path:{via:['middle','egress']},transport:{profileId:'profile',configRevision:1}});if(!parsed.ok)throw Error('fixture');return parsed.value;}
type Tx={readonly original:true};
type MutableForward={-readonly [K in keyof Forward]:Forward[K]};
function fixture(){
    const tx:Tx={original:true},events:string[]=[],failure=new Error('original provider'),state={
        forward:{id:'forward',scopeId:'scope',revision:5,spec:spec(),deleting:false,recoverySuspended:false} as MutableForward & {deleting:boolean;recoverySuspended:boolean},
        pointer:null as PathBindingRecord|null,history:[] as PathBindingRecord[],archived:false,headRevision:2,
        now:at,profileDigest:hash,fail:'',missingHead:false,missingRevision:false,total:1,page:undefined as any
    };
    const templates=new Map<number,PathTemplateRevision>([1,2].map(revision=>{const value=config(revision===1?['middle','egress']:['egress']);return [revision,{revision,config:value,profileDigest:hash,configDigest:digest({config:value,profileDigest:hash}),createdBy:'actor',createdAt:at}];}));
    const selection=(revision=1):PathSelection=>({templateId:'template',revision,configDigest:templates.get(revision)!.configDigest});
    function step(name:string,value:Tx){assert.equal(value,tx);events.push(name);if(state.fail===name)throw failure;}
    const db={async transaction<T>(action:(value:Tx)=>Promise<T>){events.push('begin');const before=structuredClone({pointer:state.pointer,history:state.history});try{const value=await action(tx);events.push('commit');return value;}catch(error){state.pointer=before.pointer;state.history=before.history;events.push('rollback');throw error;}}};
    const auth={async scope(value:Tx,actor:string,scope:string,manage=false){assert.equal(this,auth);assert.equal(actor,'actor');assert.equal(scope,'scope');step('auth:'+manage,value);}};
    const reader={async head(value:Tx,scope:string,id:string,lock?:boolean){assert.equal(this,reader);assert.equal(scope,'scope');assert.equal(id,'template');step('head:'+String(lock),value);return state.missingHead?null:{templateId:id,currentRevision:state.headRevision,archived:state.archived};},
        async revision(value:Tx,scope:string,id:string,revision:number){assert.equal(this,reader);assert.equal(scope,'scope');assert.equal(id,'template');step('revision:'+revision,value);return state.missingRevision?null:templates.get(revision)??null;},async list(){throw Error('not used');}};
    const references={async validate(value:Tx,actor:string,scope:string,input:unknown){assert.equal(this,references);assert.equal(actor,'actor');assert.equal(scope,'scope');assert.ok([...templates.values()].some(value=>digest(value.config)===digest(input)));step('references',value);return {profileDigest:state.profileDigest};}};
    const store={async current(value:Tx,scope:string,id:string){assert.equal(this,store);assert.equal(scope,'scope');assert.equal(id,'forward');step('current',value);return state.pointer;},
        async history(value:Tx,scope:string,id:string){assert.equal(this,store);assert.equal(scope,'scope');assert.equal(id,'forward');step('history',value);return state.history;},
        async references(value:Tx,scope:string,id:string,paging:unknown,revision?:number){assert.equal(this,store);assert.equal(scope,'scope');assert.equal(id,'template');assert.deepEqual(paging,{page:1,limit:25,offset:0});assert.ok(revision===undefined||revision===1);step('page',value);return state.page??{total:state.total,items:state.pointer?[{forward:state.forward,recoverySuspended:state.forward.recoverySuspended,binding:state.pointer}]:[]};},
        async append(value:Tx,scope:string,id:string,input:Omit<PathBindingRecord,'sequence'>){assert.equal(this,store);assert.equal(scope,'scope');assert.equal(id,'forward');step('append',value);const record={...input,sequence:state.history.length+1};state.history.push(record);state.pointer=record;return record;},
        async detach(value:Tx,scope:string,id:string){assert.equal(this,store);assert.equal(scope,'scope');assert.equal(id,'forward');step('detach',value);state.pointer=null;}};
    const forwards={async record(value:Tx,scope:string,id:string){assert.equal(this,forwards);assert.equal(scope,'scope');assert.equal(id,'forward');step('forward',value);return state.forward;}};
    const paths=new PathBindings(db,auth,reader,references,store,forwards,()=>{events.push('clock');if(state.fail==='clock')throw failure;return state.now;});
    function attach(){const record:PathBindingRecord={...selection(),sequence:1,forwardRevision:4,expandedSpec:state.forward.spec,specDigest:digest(state.forward.spec),actorId:'actor',createdAt:at};state.pointer=record;state.history=[record];return record;}
    return {tx,events,state,failure,templates,selection,paths,attach};
}

test('56 public and legacy parser expansion and owner retain identities closed input exact bounds and async public shape',()=>{
    assert.equal(PathBindings,OldBindings);assert.equal(parsePathSelection,oldParse);assert.equal(expandPath,oldExpand);assert.equal(PathBindings.length,6);
    for(const method of ['resolve','resolveCreateIn','accept','preserve','currentIn','detachIn','get','preview','previewIn','references']){
        const descriptor=Object.getOwnPropertyDescriptor(PathBindings.prototype,method)!;assert.equal(descriptor.enumerable,false);assert.equal(descriptor.configurable,true);assert.equal(descriptor.writable,true);assert.equal(descriptor.value.constructor.name,'AsyncFunction');
    }
    const input={templateId:'template',revision:64,configDigest:hash},value=parsePathSelection(Object.assign(Object.create(null),input));assert.deepEqual(value,input);assert.equal(Object.isFrozen(value),true);assert.notEqual(value,input);
    for(const bad of [null,[],1,Object.create(input),{...input,extra:true},...['', 'bad/id'].map(templateId=>({...input,templateId})),...[0,65,-1,1.5,NaN,Infinity,'1'].map(revision=>({...input,revision})),...[hash+'\n',hash.toUpperCase(),'sha256:'+'g'.repeat(64),hash.slice(1),null].map(configDigest=>({...input,configDigest}))])assert.throws(()=>parsePathSelection(bad),{code:'INVALID_CONFIG'});
    const original=spec(),expanded=expandPath(original,config(['egress']));assert.deepEqual(expanded.ingress,original.ingress);assert.deepEqual(expanded.target,original.target);assert.equal(expanded.enabled,original.enabled);assert.deepEqual(expanded.path,{via:['egress']});assert.equal(Object.isFrozen(expanded),true);
    assert.throws(()=>expandPath({...original,protocols:['tcp']},config()),{code:'UNSUPPORTED_CAPABILITY',status:422});assert.throws(()=>expandPath({...original,ingress:{...original.ingress,nodeId:'other'}},config()),{code:'UNSUPPORTED_CAPABILITY'});
    assert.throws(()=>expandPath({...original,target:{host:'',port:0}},config()),{code:'INTEGRITY_FAILURE'});
});

test('56 original resolve and creation validate existing provenance then immutable template then caller reference without new authorization or transaction',async()=>{
    const f=fixture();assert.deepEqual(f.events,[]);f.attach();assert.deepEqual(await f.paths.resolve(f.tx,'actor',f.state.forward,f.selection(2)),expandPath(spec(),config(['egress'])));
    assert.deepEqual(f.events,['current','head:false','revision:1','head:true','revision:2','references']);
    f.events.length=0;await f.paths.resolveCreateIn(f.tx,'actor','scope',spec(),f.selection(2));assert.deepEqual(f.events,['head:true','revision:2','references']);
    for(const bad of ['','bad/id']){f.events.length=0;await assert.rejects(f.paths.resolveCreateIn(f.tx,bad,'scope',spec(),f.selection()),{code:'INVALID_CONFIG'});assert.deepEqual(f.events,[]);}
    f.events.length=0;await assert.rejects(f.paths.resolveCreateIn(f.tx,'actor','scope',{} as ForwardSpec,f.selection()),{code:'INVALID_CONFIG'});assert.deepEqual(f.events,[]);
    f.state.profileDigest='sha256:'+'b'.repeat(64);f.events.length=0;await assert.rejects(f.paths.resolveCreateIn(f.tx,'actor','scope',spec(),f.selection()),{code:'INTEGRITY_FAILURE'});assert.deepEqual(f.events,['head:true','revision:1','references']);
    for(const [mutation,code] of [[(f:ReturnType<typeof fixture>)=>{f.state.missingHead=true;},'NOT_FOUND'],[(f:ReturnType<typeof fixture>)=>{f.state.archived=true;},'TEMPLATE_ARCHIVED'],[(f:ReturnType<typeof fixture>)=>{f.state.missingRevision=true;},'NOT_FOUND'],[(f:ReturnType<typeof fixture>)=>{f.state.headRevision=1;},'REVISION_CONFLICT']] as const){const f=fixture();mutation(f);await assert.rejects(f.paths.resolveCreateIn(f.tx,'actor','scope',spec(),f.selection(2)),{code});assert.equal(f.events.includes('references'),false);}
    for(const failureAt of ['head:true','revision:1','references']){const f=fixture();f.state.fail=failureAt;await assert.rejects(f.paths.resolveCreateIn(f.tx,'actor','scope',spec(),f.selection()),e=>e===f.failure);assert.equal(f.events.at(-1),failureAt);}
});

test('56 every persisted provenance shape digest counter time template and current topology refusal precedes receipt or detach',async()=>{
    const mutations:Array<(record:PathBindingRecord,f:ReturnType<typeof fixture>)=>void>=[
        record=>{record.templateId='bad/id';},record=>{record.revision=0;},record=>{record.configDigest=hash+'\n';},
        ...[0,65,1.5,NaN].map(sequence=>(record:PathBindingRecord)=>{record.sequence=sequence;}),
        ...[0,6,1.5].map(forwardRevision=>(record:PathBindingRecord)=>{record.forwardRevision=forwardRevision;}),
        record=>{record.actorId='bad/id';},...[-1,1.5,NaN,Infinity,8640000000000001].map(createdAt=>(record:PathBindingRecord)=>{record.createdAt=createdAt;}),
        record=>{record.expandedSpec={} as ForwardSpec;},record=>{record.specDigest=hash;},
        (_record,f)=>{f.state.forward.spec={...f.state.forward.spec,path:{via:['egress']}};},
        (_record,f)=>{f.templates.set(1,{...f.templates.get(1)!,configDigest:hash});},
        (record)=>{record.expandedSpec={...record.expandedSpec,ingress:{...record.expandedSpec.ingress,nodeId:'elsewhere'}};record.specDigest=digest(record.expandedSpec);}
    ];
    for(const mutate of mutations){const f=fixture(),record=f.attach();mutate(record,f);await assert.rejects(f.paths.currentIn(f.tx,f.state.forward),{code:'INTEGRITY_FAILURE'});assert.equal(f.events.includes('detach'),false);assert.equal(f.events.includes('append'),false);}
    for(const createdAt of [0,8640000000000000]){const f=fixture(),record=f.attach();record.createdAt=createdAt;assert.equal((await f.paths.currentIn(f.tx,f.state.forward))!.sequence,1);}
    const f=fixture();assert.equal(await f.paths.currentIn(f.tx,f.state.forward),null);await f.paths.detachIn(f.tx,f.state.forward);assert.deepEqual(f.events,['current','current']);
});

test('56 accept preserves no-op before clock and bounds new time before append while original preserve/detach changes only pointer',async()=>{
    const f=fixture(),old=f.attach();f.state.now=NaN;const noOp=await f.paths.accept(f.tx,'actor',f.state.forward,f.selection());assert.deepEqual(noOp,{...f.selection(),sequence:1,forwardRevision:4,changed:false});assert.equal(f.events.includes('clock'),false);assert.equal(f.events.includes('append'),false);
    for(const now of [-1,1.5,NaN,Infinity,8640000000000001]){const f=fixture();f.state.now=now;await assert.rejects(f.paths.accept(f.tx,'actor',f.state.forward,f.selection()),{code:'INTEGRITY_FAILURE'});assert.deepEqual(f.events,['current','clock']);}
    const g=fixture();const accepted=await g.paths.accept(g.tx,'actor',g.state.forward,g.selection());assert.equal(accepted.changed,true);assert.equal(accepted.forwardRevision,5);assert.deepEqual(g.events,['current','clock','append','head:false','revision:1']);
    assert.equal(g.state.pointer!.expandedSpec,g.state.forward.spec);assert.equal(g.state.pointer!.createdAt,at);
    f.events.length=0;await f.paths.preserve(f.tx,f.state.forward,{...f.state.forward,spec:{...f.state.forward.spec,enabled:true,target:{host:'127.0.0.1',port:9001}}});assert.equal(f.state.pointer,old);assert.equal(f.events.includes('detach'),false);
    f.events.length=0;await f.paths.preserve(f.tx,f.state.forward,{...f.state.forward,spec:{...f.state.forward.spec,path:{via:['egress']}}});assert.equal(f.state.pointer,null);assert.deepEqual(f.state.history,[old]);assert.deepEqual(f.events,['current','head:false','revision:1','detach']);
    f.state.pointer=old;await f.paths.detachIn(f.tx,f.state.forward);assert.equal(f.state.pointer,null);assert.deepEqual(f.state.history,[old]);
    for(const failureAt of ['current','clock','append','head:false','revision:1']){const f=fixture();f.state.fail=failureAt;await assert.rejects(f.paths.accept(f.tx,'actor',f.state.forward,f.selection()),e=>e===f.failure);assert.equal(f.events.at(-1),failureAt);}
});

test('56 original read and preview authorize in one transaction preserve failure prefix frozen flags and bounded contiguous history',async()=>{
    const f=fixture();f.attach();const got=await f.paths.get('actor','scope','forward');assert.equal(got.history[0]!.createdAt,new Date(at).toISOString());assert.equal(got.binding!.current,true);assert.equal(got.executionAuthorized,false);assert.equal(got.referenceAuthorization,'not-rechecked-by-this-query');assert.equal(got.consistency,'read-committed-not-global-snapshot');assert.equal(Object.isFrozen(got.history[0]),true);
    assert.deepEqual(f.events,['begin','auth:false','forward','current','head:false','revision:1','history','head:false','revision:1','commit']);
    f.events.length=0;const preview=await f.paths.preview('actor','scope','forward',5,f.selection(2));assert.equal(preview.changed,true);assert.equal(preview.previewOnly,true);assert.equal(preview.reserved,false);assert.equal(preview.fullPlanAuthorization,false);assert.equal(Object.isFrozen(preview.proposedSpec),true);assert.deepEqual(f.events,['begin','auth:true','forward','head:false','revision:2','references','commit']);
    for(const mutation of [(f:ReturnType<typeof fixture>)=>{f.state.forward.deleting=true;},(f:ReturnType<typeof fixture>)=>{f.state.forward.recoverySuspended=true;},(f:ReturnType<typeof fixture>)=>{f.state.forward.revision=6;}]){const f=fixture();mutation(f);await assert.rejects(f.paths.preview('actor','scope','forward',5,f.selection()),{code:'REVISION_CONFLICT'});assert.deepEqual(f.events,['begin','auth:true','forward','rollback']);}
    for(const failureAt of ['auth:true','forward','head:false','revision:1','references']){const f=fixture();f.state.fail=failureAt;await assert.rejects(f.paths.preview('actor','scope','forward',5,f.selection()),e=>e===f.failure);assert.equal(f.events.at(-2),failureAt);assert.equal(f.events.at(-1),'rollback');}
    for(const mutation of [(f:ReturnType<typeof fixture>)=>{f.state.history=Array.from({length:65},()=>f.state.pointer!);},(f:ReturnType<typeof fixture>)=>{f.state.history=[{...f.state.pointer!,sequence:2}];},(f:ReturnType<typeof fixture>)=>{f.state.pointer={...f.state.pointer!,sequence:2};}]){const f=fixture();f.attach();mutation(f);await assert.rejects(f.paths.get('actor','scope','forward'),{code:'INTEGRITY_FAILURE'});assert.equal(f.events.at(-1),'rollback');}
    const historical=fixture(),first=historical.attach();historical.state.forward.spec=expandPath(spec(),config(['egress']));const second={...first,...historical.selection(2),sequence:2,expandedSpec:historical.state.forward.spec,specDigest:digest(historical.state.forward.spec)};historical.state.pointer=second;historical.state.history=[first,second];const all=await historical.paths.get('actor','scope','forward');assert.deepEqual(all.history.map(value=>value.current),[false,true]);
    const empty=fixture();assert.equal((await empty.paths.get('actor','scope','forward')).binding,null);
});

test('56 reference query closed inputs page integrity and unavailable reasons retain original read-only owner sequencing',async()=>{
    for(const input of [null,[],Object.create({page:'1'}),{extra:true},{page:1},{limit:1},{revision:0},{revision:65},{targetRevision:65},{page:'01'},{limit:'101'}]){const f=fixture();await assert.rejects(f.paths.references('actor','scope','template',input as never),{code:'INVALID_CONFIG'});assert.deepEqual(f.events,[]);}
    const f=fixture();f.attach();const page=await f.paths.references('actor','scope','template',{targetRevision:2,revision:1});assert.equal(page.total,1);assert.equal(page.items[0]!.changed,true);assert.equal(page.items[0]!.unavailableReason,null);assert.deepEqual(page.items[0]!.proposedSpec!.path,{via:['egress']});assert.equal(page.executionAuthorized,false);assert.equal(page.consistency,'read-committed-page-not-global-snapshot');assert.equal(Object.isFrozen(page.items[0]),true);assert.deepEqual(f.events,['begin','auth:true','head:undefined','revision:2','references','page','head:false','revision:1','commit']);
    for(const kind of ['archived','suspended','unsupported'] as const){const f=fixture();f.attach();if(kind==='archived')f.state.archived=true;if(kind==='suspended')f.state.forward.recoverySuspended=true;if(kind==='unsupported'){const value=config();const changed={...value,nodes:['different','egress'],endpoints:[{nodeId:'egress',revision:1}]};f.templates.set(2,{...f.templates.get(2)!,config:changed,configDigest:digest({config:changed,profileDigest:hash})});}const value=await f.paths.references('actor','scope','template',{targetRevision:2});assert.equal(value.items[0]!.proposedSpec,null);assert.equal(value.items[0]!.changed,null);assert.equal(value.items[0]!.unavailableReason,kind==='archived'?'TEMPLATE_ARCHIVED':kind==='suspended'?'RECOVERY_SUSPENDED':'UNSUPPORTED_CAPABILITY');if(kind==='archived')assert.equal(f.events.includes('references'),false);}
    for(const mutate of [(page:any)=>{page.total=-1;},(page:any)=>{page.total=1.5;},(page:any)=>{page.items=[...page.items,...page.items];},(page:any)=>{page.items[0].forward.scopeId='other';},(page:any)=>{page.items[0].forward.id='bad/id';},(page:any)=>{page.items[0].forward.revision=0;},(page:any)=>{page.items[0].forward.spec={};},(page:any)=>{page.items[0].recoverySuspended=0;},(page:any)=>{page.items[0].binding.templateId='other';},(page:any)=>{page.items[0].binding.revision=2;}]){const f=fixture();f.attach();f.state.page=structuredClone({total:1,items:[{forward:f.state.forward,recoverySuspended:false,binding:f.state.pointer}]});mutate(f.state.page);await assert.rejects(f.paths.references('actor','scope','template',{revision:1}),{code:'INTEGRITY_FAILURE'});assert.equal(f.events.at(-1),'rollback');}
    for(const failureAt of ['auth:true','head:undefined','revision:2','references','page','head:false','revision:1']){const f=fixture();f.attach();f.state.fail=failureAt;await assert.rejects(f.paths.references('actor','scope','template',{targetRevision:2}),e=>e===f.failure);assert.equal(f.events.at(-2),failureAt);assert.equal(f.events.at(-1),'rollback');}
});

test('56 actual native default captures original Date.now without reading and final reference projection constructs fresh zeroarg Date after all reads',async()=>{
    const events:string[]=[],dateArguments:unknown[][]=[],failure=new Error('final time'),RealDate=Date;let fail=false,nowValue=at;
    const oldNow=()=>{events.push('captured-now');return nowValue;},laterNow=()=>{events.push('later-now');return at+1000;};
    function NativeDate(this:unknown,...args:unknown[]){events.push('new-date');dateArguments.push(args);if(fail)throw failure;return args.length?new RealDate(args[0] as number):new RealDate(nowValue);}
    NativeDate.now=oldNow;
    function loaded(relative:string,providers:Record<string,unknown>){const source=readFileSync(new URL('../src/'+relative,import.meta.url),'utf8'),exports:Record<string,any>={};
        const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
        new vm.Script(javascript,{filename:relative}).runInNewContext({exports,Date:NativeDate,require(name:string){assert.ok(Object.hasOwn(providers,name),name);return providers[name];}});return exports;
    }
    const moduleValues=loaded('compatibility/native-module-values.ts',{'node:crypto':{},'@tunex/contracts/shared':{digest},'../framework/public.ts':Framework});
    const readValues=loaded('compatibility/native-read-projection.ts',{'./stored-value.ts':{readStoredValue:(value:unknown)=>value}}).nativeReadProjectionValues;
    const actual=loaded('modules/path-owner/bindings.ts',{'@tunex/core':Core,'../../framework/public.ts':Framework,'../../compatibility/public.ts':{...Compatibility,nativeWallClockSource:moduleValues.nativeWallClockSource,nativeIsoTime:moduleValues.nativeIsoTime,nativeReadProjectionValues:readValues},'./template-state.ts':TemplateState,'./binding-values.ts':BindingValues});
    assert.equal(events.length,0);
    const f=fixture(),empty={async current(){events.push('current');return null;},async append(){events.push('append');throw failure;},async references(){events.push('page');return {total:0,items:[]};}},template={async head(){events.push('head');return {templateId:'template',currentRevision:1,archived:false};}},db={async transaction(action:(tx:Tx)=>unknown){events.push('begin');try{const value=await action(f.tx);events.push('commit');return value;}catch(error){events.push('rollback');throw error;}}};
    const owner=new actual.PathBindings(db,{async scope(){events.push('auth');}},template,{},empty,{});assert.equal(events.length,0);
    NativeDate.now=laterNow;
    await assert.rejects(owner.accept(f.tx,'actor',f.state.forward,f.selection()),e=>e===failure);assert.deepEqual(events,['current','captured-now','append']);
    events.length=0;const first=await owner.references('actor','scope','template');assert.equal(first.observedAt,new RealDate(at).toISOString());assert.deepEqual(events,['begin','auth','head','page','new-date','commit']);assert.deepEqual(dateArguments,[[]]);
    events.length=0;nowValue=at+2000;assert.equal((await owner.references('actor','scope','template')).observedAt,new RealDate(nowValue).toISOString());assert.deepEqual(dateArguments,[[],[]]);
    events.length=0;fail=true;await assert.rejects(owner.references('actor','scope','template'),e=>e===failure);assert.deepEqual(events,['begin','auth','head','page','new-date','rollback']);
});
