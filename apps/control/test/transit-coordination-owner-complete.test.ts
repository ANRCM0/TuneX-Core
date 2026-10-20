import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_COUNTER } from '@tunex/core';
import { TransitCoordinationService, offlineTransitStep, verifyTransitStage } from '../src/modules/transit-owner/public.ts';
import type { TransitPreparation, TransitCoordinationBody, TransitCoordinationPhase, TransitCommandAction, TransitProofVerifier, TransitObservationProof, OfflineTransitCommand } from '../src/modules/transit-owner/public.ts';
import type * as LegacyTransit from '../src/modules/runtime/transit-coordination.ts';
import { TransitCoordinationJournal, offlineTransitStep as legacyStep } from '../src/modules/runtime/transit-coordination.ts';
import { nativeValueDigest as digest } from '../src/compatibility/public.ts';
import type { TransitStoredStage, TransitStoredCoordination, TransitCoordinationStorage, TransitCoordinationUpdate } from '../src/framework/public.ts';
import { ControlError } from '../src/framework/public.ts';
import type { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';

type Tx={readonly id:symbol};
type Journal=TransitStoredCoordination<TransitCoordinationPhase>;
const now=1800000000000;
const code=(expected:string,message?:string)=>(error:unknown)=>{assert.ok(error instanceof ControlError);assert.equal(error.code,expected);assert.equal(error.status,expected==='AUTHORIZATION_DENIED'?403:expected==='NOT_FOUND'?404:expected==='RESOURCE_LIMIT'?429:409);if(message)assert.equal(error.message,message);return true;};
type Same<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;

function stage(forwardId='forward'):TransitStoredStage {
 const assignments=['node-c','node-a','node-b'].flatMap((nodeId,index)=>['udp','tcp'].map((protocol,offset)=>{
  const role=nodeId==='node-a'?'ingress' as const:nodeId==='node-b'?'transit' as const:'egress' as const;
  return {assignmentId:'binding-'+nodeId+'-'+protocol,nodeId,role,protocol:protocol as 'tcp'|'udp',sessionEpoch:2,bindingFence:4+index*2+offset,resource:{nodeId,role,forwardProtocol:protocol as 'tcp'|'udp',physicalProtocol:role==='ingress'?protocol as 'tcp'|'udp':'tcp' as const,address:'127.0.0.1',port:32001+index*2+offset}};
 }));
 const body={executable:false as const,scopeId:'scope',forwardId,forwardRevision:1,deploymentGeneration:1,profileDigest:'sha256:'+'1'.repeat(64),pathDigest:'sha256:'+'2'.repeat(64),authorizationUntil:now+240000,activationOrder:['node-c','node-b','node-a'],assignments,intents:[]};
 const planDigest=digest(body);
 return {forward_id:forwardId,generation:1,target_revision:1,scope_id:'scope',created_by:'owner',state:'reserved',expires_at:now+180000,plan_digest:planDigest,body:JSON.stringify({...body,planDigest}),created_at:now-100,updated_at:now-100};
}
function body(plan:TransitPreparation,phase:TransitCoordinationPhase='preparing',position=0,revision=1,receiptHighwater:Record<string,number>={}):TransitCoordinationBody {
 return {forwardId:plan.forwardId,generation:plan.deploymentGeneration,planDigest:plan.planDigest,phase,position,revision,receiptHighwater};
}
function journal(plan:TransitPreparation,phase:TransitCoordinationPhase='preparing',position=0,revision=1,receiptHighwater:Record<string,number>={}):Journal {
 const value=body(plan,phase,position,revision,receiptHighwater);
 return {forward_id:value.forwardId,generation:value.generation,plan_digest:value.planDigest,phase,position,revision,receipt_highwater:receiptHighwater,journal_digest:digest(value),created_at:now-50,updated_at:now-50};
}
function observation(command:OfflineTransitCommand,reportSequence=1):TransitObservationProof {
 return {commandDigest:command.commandDigest,nodeId:command.nodeId,action:command.action,reportSequence,receivedAt:now,assignments:command.assignments.map(a=>({assignmentId:a.assignmentId,sessionEpoch:a.sessionEpoch,bindingFence:a.bindingFence,deploymentGeneration:command.generation,condition:command.action==='prepare'?'prepared' as const:command.action==='activate'?'ready' as const:'removed' as const}))};
}
function fixture(){
 const tx:Tx={id:Symbol()},events:string[]=[],calls:{name:string;args:unknown[]}[]=[];
 const initial=stage(),plan=verifyTransitStage(initial),stages=new Map<string,TransitStoredStage>([['forward',initial]]),journals=new Map<string,Journal>();
 const state={stage:initial as TransitStoredStage|undefined,row:undefined as Journal|undefined,session:2,missingSession:'',slot:undefined as {owner_id:string|null;fence:number;deployment_generation:number}|undefined,overrideSlot:false,cas:1,failName:'',failAfter:'',failure:new Error('original provider failure'),clock:now,clockValues:[] as number[],recovering:[] as Journal[]};
 function event(name:string,args:unknown[]=[]){events.push(name);calls.push({name,args});if(state.failName===name)throw state.failure;}
 const store:TransitCoordinationStorage<Tx,TransitCoordinationPhase>={
  async stage(current,...args){assert.equal(this,store);assert.equal(current,tx);event('stage',args);return state.stage;},
  async recoveryStage(current,...args){assert.equal(this,store);assert.equal(current,tx);event('recoveryStage',args);return stages.get(args[0]);},
  async session(current,node){assert.equal(this,store);assert.equal(current,tx);event('session',[node]);return node===state.missingSession?undefined:{session_epoch:state.session};},
  async slot(current,node,protocol,port){assert.equal(this,store);assert.equal(current,tx);event('slot',[node,protocol,port]);if(state.overrideSlot)return state.slot;const assignment=plan.assignments.find(a=>a.nodeId===node&&a.resource.physicalProtocol===protocol&&a.resource.port===port)!;return {owner_id:plan.forwardId,fence:assignment.bindingFence,deployment_generation:plan.deploymentGeneration};},
  async journal(current,...args){assert.equal(this,store);assert.equal(current,tx);event('journal',args);return state.row;},
  async recovering(current){assert.equal(this,store);assert.equal(current,tx);event('recovering');return state.recovering;},
  async insert(current,row){assert.equal(this,store);assert.equal(current,tx);event('insert',[row]);state.row={...row};if(state.failAfter==='insert')throw state.failure;},
  async update(current,row){assert.equal(this,store);assert.equal(current,tx);event('update',[row]);const previous=state.row?.forward_id===row.forward_id?state.row:journals.get(row.forward_id);if(previous){const updated={...previous,phase:row.phase,position:row.position,revision:row.revision,receipt_highwater:row.receipt_highwater,journal_digest:row.journal_digest,updated_at:row.updated_at};if(state.row?.forward_id===row.forward_id)state.row=updated;else journals.set(row.forward_id,updated);}if(state.failAfter==='update')throw state.failure;return state.cas;},
 };
 const db={async transaction<T>(action:(value:Tx)=>Promise<T>){assert.equal(this,db);const saved=state.row&&Object.create(Object.getPrototypeOf(state.row),Object.getOwnPropertyDescriptors(state.row)) as Journal|undefined,other=new Map(journals);event('begin');try{const result=await action(tx);event('commit');return result;}catch(error){state.row=saved;journals.clear();for(const [key,value] of other)journals.set(key,value);events.push('rollback');throw error;}}};
 const owner=new TransitCoordinationService(db,store);
 return {tx,events,calls,state,plan,stages,journals,store,db,owner,event,clock(){event('clock');return state.clockValues.shift()??state.clock;},seed(phase:TransitCoordinationPhase='preparing',position=0,revision=1,highwater:Record<string,number>={}){state.row=journal(plan,phase,position,revision,highwater);return state.row;},clear(){events.length=0;calls.length=0;},call(){return owner.begin('owner','scope','forward',1);},peek(){return owner.peek('owner','scope','forward',1);},fail(){return owner.fail('owner','scope','forward',1);},command(){const row=state.row!;return offlineTransitStep(plan,body(plan,row.phase,row.position,row.revision,(typeof row.receipt_highwater==='string'?JSON.parse(row.receipt_highwater):row.receipt_highwater) as Record<string,number>))!;}};
}

test('64 legacy journal owns original async entries db lazy dispatch subclass and canonical step identity without constructor I/O',async()=>{
 let reads=0;const db={get transaction(){reads++;throw new Error('not during construction');}} as unknown as MySqlUnitOfWork;
 class Derived extends TransitCoordinationJournal {}
 const legacy=new Derived(db);assert.equal(TransitCoordinationJournal.length,1);assert.equal(TransitCoordinationService.length,2);assert.equal(reads,0);assert.equal((legacy as unknown as {db:unknown}).db,db);assert.equal(legacyStep,offlineTransitStep);
 const aliases:[Same<TransitCoordinationPhase,LegacyTransit.TransitCoordinationPhase>,Same<TransitCommandAction,LegacyTransit.TransitCommandAction>,Same<OfflineTransitCommand,LegacyTransit.OfflineTransitCommand>,Same<TransitObservationProof,LegacyTransit.TransitObservationProof>,Same<TransitProofVerifier,LegacyTransit.TransitProofVerifier>]=[true,true,true,true,true];assert.deepEqual(aliases,[true,true,true,true,true]);const f=fixture(),structural:Pick<TransitCoordinationJournal,'begin'|'peek'|'confirm'|'fail'|'quarantineRecovery'>=f.owner;assert.equal(structural,f.owner);
 for(const name of ['begin','peek','confirm','fail','quarantineRecovery'] as const){assert.equal(Object.hasOwn(TransitCoordinationJournal.prototype,name),true);assert.equal(TransitCoordinationJournal.prototype[name].constructor.name,'AsyncFunction');}
 await assert.rejects(legacy.quarantineRecovery(),{message:'not during construction'});assert.equal(reads,1);
});

test('64 begin preserves guard actor plan state freshness sorted unique sessions all physical locks prior journal and two independent insert clocks',async t=>{
 const f=fixture();t.mock.method(Date,'now',()=>f.clock());f.state.clockValues=[now,now+1,now+2];const command=await f.call();
 assert.deepEqual(f.events,['begin','stage','clock','session','session','session',...Array(6).fill('slot'),'journal','clock','clock','insert','commit']);
 assert.deepEqual(f.calls.find(c=>c.name==='stage')!.args,['scope','forward',1]);assert.deepEqual(f.calls.filter(c=>c.name==='session').map(c=>c.args),[['node-a'],['node-b'],['node-c']]);
 const sorted=[...f.plan.assignments].sort((a,b)=>a.nodeId.localeCompare(b.nodeId)||a.resource.physicalProtocol.localeCompare(b.resource.physicalProtocol)||a.resource.port-b.resource.port);assert.deepEqual(f.calls.filter(c=>c.name==='slot').map(c=>c.args),sorted.map(a=>[a.nodeId,a.resource.physicalProtocol,a.resource.port]));
 const inserted=f.calls.find(c=>c.name==='insert')!.args[0] as Journal;assert.equal(inserted.created_at,now+1);assert.equal(inserted.updated_at,now+2);assert.equal(inserted.receipt_highwater,'{}');assert.equal(inserted.journal_digest,digest(body(f.plan)));assert.deepEqual(command,offlineTransitStep(f.plan,body(f.plan)));assert.equal(Object.isFrozen(command),false);
 for(const generation of [0,-1,1.5,NaN,Infinity,MAX_COUNTER+1]){f.clear();await assert.rejects(f.owner.begin('foreign','scope','forward',generation),code('INVALID_CONFIG'));assert.deepEqual(f.events,['begin','rollback']);}
 f.clear();f.state.stage=undefined;await assert.rejects(f.call(),code('NOT_FOUND'));assert.deepEqual(f.events,['begin','stage','rollback']);
 f.state.stage={...stage(),created_by:'foreign',body:'{'};f.clear();await assert.rejects(f.call(),code('AUTHORIZATION_DENIED'));assert.deepEqual(f.events,['begin','stage','rollback']);
 f.state.stage={...stage(),state:'aborted',body:'{'};f.clear();await assert.rejects(f.call(),code('INTEGRITY_FAILURE','Malformed retained Transit JSON'));assert.deepEqual(f.events,['begin','stage','rollback']);
 f.state.stage={...stage(),state:'aborted',expires_at:now+5000};f.clear();await assert.rejects(f.call(),code('FENCING_REJECTED'));assert.deepEqual(f.events,['begin','stage','rollback']);
 f.state.stage={...stage(),expires_at:now+5000};f.clear();await assert.rejects(f.call(),code('LEASE_EXPIRED'));assert.deepEqual(f.events,['begin','stage','clock','rollback']);
 f.state.stage=stage();f.state.session=3;f.clear();await assert.rejects(f.call(),code('SESSION_SUPERSEDED'));assert.deepEqual(f.events,['begin','stage','clock','session','rollback']);
 f.state.session='2' as unknown as number;f.clear();await assert.rejects(f.call(),code('SESSION_SUPERSEDED'));assert.equal(f.events.includes('slot'),false);f.state.session=2;f.state.missingSession='node-b';f.clear();await assert.rejects(f.call(),code('SESSION_SUPERSEDED'));assert.equal(f.events.includes('slot'),false);f.state.missingSession='';
 const firstFence=sorted[0]!.bindingFence;
 for(const slot of [undefined,{owner_id:null,fence:firstFence,deployment_generation:1},{owner_id:'foreign',fence:firstFence,deployment_generation:1},{owner_id:'forward',fence:0,deployment_generation:1},{owner_id:'forward',fence:String(firstFence) as unknown as number,deployment_generation:1},{owner_id:'forward',fence:firstFence,deployment_generation:2},{owner_id:'forward',fence:firstFence,deployment_generation:'1' as unknown as number}]){f.state.overrideSlot=true;f.state.slot=slot;f.clear();await assert.rejects(f.call(),code('FENCING_REJECTED'));assert.equal(f.events.includes('journal'),false);}f.state.overrideSlot=false;
 f.clear();await assert.rejects(f.call(),code('RESOURCE_CONFLICT'));assert.equal(f.events.at(-2),'journal');
});

test('64 journal raw highwater JSON and phase revision position identity membership digest short circuits precede freshness',async t=>{
 const f=fixture();t.mock.method(Date,'now',()=>f.clock());
 const invalidRows:Partial<Journal>[]=[{phase:'other' as TransitCoordinationPhase},{revision:0},{revision:1.5},{revision:MAX_COUNTER+1},{position:-1},{position:0.5},{position:NaN},{position:3},{plan_digest:'other'},{forward_id:'other'},{generation:2},{receipt_highwater:undefined},{receipt_highwater:null},{receipt_highwater:[]},{receipt_highwater:3},{receipt_highwater:'null'},{receipt_highwater:{foreign:1}},{receipt_highwater:{'node-c':0}},{receipt_highwater:{'node-c':1.5}},{receipt_highwater:{'node-c':MAX_COUNTER+1}},{journal_digest:'other'}];
 for(const change of invalidRows){f.seed();Object.assign(f.state.row!,change);f.clear();await assert.rejects(f.peek(),code('INTEGRITY_FAILURE'));assert.deepEqual(f.events,['begin','stage','journal','rollback']);}
 for(const phase of ['sealed','quarantined'] as const){f.seed(phase,2);f.clear();await assert.rejects(f.peek(),code('INTEGRITY_FAILURE'));assert.equal(f.events.includes('clock'),false);}
 f.seed();f.state.row!.receipt_highwater='{';f.state.row!.phase='invalid' as TransitCoordinationPhase;f.clear();await assert.rejects(f.peek(),SyntaxError);assert.deepEqual(f.events,['begin','stage','journal','rollback']);
 f.state.row=undefined;f.clear();await assert.rejects(f.peek(),code('NOT_FOUND'));assert.deepEqual(f.events,['begin','stage','journal','rollback']);
 // Inherited properties are intentionally outside original Object.entries validation/digest.
 const highwater=Object.assign(Object.create({foreign:0}) as Record<string,number>,{'node-c':2});f.seed('preparing',0,1,highwater);f.clear();await f.peek();assert.equal(f.state.row!.receipt_highwater,highwater);assert.equal(Object.isFrozen(highwater),false);
 const nativeParse=JSON.parse;let calls=0;t.mock.method(JSON,'parse',(...args:Parameters<typeof JSON.parse>)=>{calls++;f.events.push('decode');return nativeParse(...args);});f.state.row!.receipt_highwater=JSON.stringify({'node-c':2});f.clear();await f.peek();assert.equal(calls,2,'retained stage first then highwater JSON at locked journal');assert.deepEqual(f.events.slice(0,6),['begin','stage','decode','journal','decode','clock']);
 // Invalid phase skips the journal-digest field after raw JSON; no hardening/reorder.
 f.seed();f.state.row!.phase='unknown' as TransitCoordinationPhase;Object.defineProperty(f.state.row!,'journal_digest',{get(){assert.fail('digest evaluated after an earlier refusal');}});f.clear();await assert.rejects(f.peek(),code('INTEGRITY_FAILURE'));
});

test('64 peek confirm and fail retain phase-specific fresh ownership terminal and compensation rules',async t=>{
 const f=fixture();t.mock.method(Date,'now',()=>f.clock());
 for(const phase of ['preparing','activating'] as const){f.seed(phase);f.state.stage={...stage(),expires_at:now+5000};f.clear();await assert.rejects(f.peek(),code('LEASE_EXPIRED'));assert.deepEqual(f.events,['begin','stage','journal','clock','rollback']);f.state.stage={...stage(),expires_at:now+5001};f.clear();assert.equal((await f.peek())?.action,phase==='preparing'?'prepare':'activate');assert.equal(f.events.filter(e=>e==='session').length,3);assert.equal(f.events.filter(e=>e==='slot').length,6);}
 f.state.stage={...stage(),expires_at:now-1};f.state.session=999;f.state.overrideSlot=true;
 for(const phase of ['compensating','sealed','quarantined'] as const){f.seed(phase,phase==='compensating'?0:3);f.clear();const command=await f.peek();assert.equal(command?.action??null,phase==='compensating'?'withdraw':null);assert.deepEqual(f.events,['begin','stage','journal','commit']);}
 f.seed('compensating',1);f.clear();const same=await f.fail();assert.equal(same?.nodeId,'node-b');assert.deepEqual(f.events,['begin','stage','journal','commit']);
 f.seed('quarantined',3);f.clear();assert.equal(await f.fail(),null);assert.deepEqual(f.events,['begin','stage','journal','commit']);
 for(const phase of ['preparing','activating','sealed'] as const){const original=f.seed(phase,phase==='sealed'?3:0,4,{'node-c':2});f.clear();const command=await f.fail();assert.equal(command?.action,'withdraw');assert.equal(command?.nodeId,'node-a');assert.deepEqual(f.events,['begin','stage','journal','clock','update','commit']);assert.equal(f.state.row!.revision,5);assert.equal(f.state.row!.receipt_highwater,JSON.stringify(original.receipt_highwater));}
 f.seed('sealed',3);f.clear();let verified=0;await assert.rejects(f.owner.confirm('owner','scope','forward',1,{} as never,async()=>{verified++;return true;}),code('FENCING_REJECTED','Terminal Transit journal cannot accept observations'));assert.equal(verified,0);assert.deepEqual(f.events,['begin','stage','journal','rollback']);
});

test('64 proof explicit verifier precedes Tx and all binding time sequence assignment condition checks precede verifier',async t=>{
 const f=fixture();t.mock.method(Date,'now',()=>f.clock());
 for(const verifier of [undefined,null,{},true]){f.clear();await assert.rejects(f.owner.confirm('foreign','scope','forward',0,{} as never,verifier as never),code('AUTHORIZATION_DENIED','Authenticated Transit report verifier required'));assert.deepEqual(f.events,[]);}
 const changes:((proof:TransitObservationProof)=>TransitObservationProof)[]=[p=>({...p,nodeId:'foreign'}),p=>({...p,action:'activate'}),p=>({...p,commandDigest:'other'}),...[0,-1,1.5,NaN,MAX_COUNTER+1].map(reportSequence=>(p:TransitObservationProof)=>({...p,reportSequence})),p=>({...p,receivedAt:now+5001}),p=>({...p,receivedAt:now-30001}),p=>({...p,receivedAt:now+0.5}),p=>({...p,assignments:p.assignments.slice(1)}),p=>({...p,assignments:[p.assignments[0]!,p.assignments[0]!]}),...(['assignmentId','sessionEpoch','bindingFence','deploymentGeneration','condition'] as const).map(field=>(p:TransitObservationProof)=>({...p,assignments:p.assignments.map((a,index)=>index? a:{...a,[field]:field==='assignmentId'?'other':field==='condition'?'ready':999})} as TransitObservationProof))];
 for(const change of changes){f.seed();const proof=change(observation(f.command()));f.clear();let verified=0;await assert.rejects(f.owner.confirm('owner','scope','forward',1,proof,async()=>{verified++;return true;}),code('FENCING_REJECTED'));assert.equal(verified,0);assert.equal(f.events.filter(e=>e==='clock').length,2);assert.equal(f.events.includes('update'),false);}
 f.seed('preparing',0,1,{'node-c':2});f.clear();await assert.rejects(f.owner.confirm('owner','scope','forward',1,observation(f.command(),2),async()=>assert.fail('stale proof must precede verifier')),code('FENCING_REJECTED'));
 for(const receivedAt of [now+5000,now-30000]){f.seed();const proof={...observation(f.command()),receivedAt};f.clear();await f.owner.confirm('owner','scope','forward',1,proof,async supplied=>{assert.equal(supplied,proof);return true;});assert.equal(f.state.row!.revision,2);}
});

test('64 authenticated proof is awaited before write and tail transitions preserve highwater exact previous digest revision CAS and strict affected row1',async t=>{
 const f=fixture();t.mock.method(Date,'now',()=>f.clock());f.seed();const proof=observation(f.command());let release!:(value:boolean)=>void;const waiting=new Promise<boolean>(resolve=>{release=resolve;}),entered=new Promise<void>(resolve=>{f.state.failName='';const verify=async function(this:unknown,supplied:TransitObservationProof){assert.equal(this,undefined);assert.equal(supplied,proof);f.event('verify');resolve();return waiting;};const result=f.owner.confirm('owner','scope','forward',1,proof,verify);(f as unknown as {pending:Promise<unknown>}).pending=result;});await entered;assert.equal(f.events.includes('update'),false);assert.equal(f.state.row!.revision,1);release(true);await (f as unknown as {pending:Promise<unknown>}).pending;assert.equal(f.events.indexOf('verify')<f.events.indexOf('update'),true);
 for(const [phase,target] of [['preparing','activating'],['activating','sealed'],['compensating','quarantined']] as const){const old=f.seed(phase,2,7,{'node-a':1,'node-b':2,'node-c':3}),command=f.command(),proof=observation(command,4);f.clear();const next=await f.owner.confirm('owner','scope','forward',1,proof,async()=>true),update=f.calls.find(c=>c.name==='update')!.args[0] as TransitCoordinationUpdate<TransitCoordinationPhase>;assert.equal(update.phase,target);assert.equal(update.position,target==='activating'?0:3);assert.equal(update.revision,8);assert.equal(update.previous_revision,7);assert.equal(update.previous_journal_digest,old.journal_digest);assert.equal(update.forward_id,'forward');assert.equal(update.generation,1);assert.deepEqual(JSON.parse(update.receipt_highwater),{...old.receipt_highwater as Record<string,number>,[proof.nodeId]:4});assert.equal(next?.action??null,target==='activating'?'activate':null);assert.equal(f.events.filter(e=>e==='clock').length,phase==='compensating'?2:3);}
 for(const cas of [0,2,'1',undefined]){const old=f.seed();f.state.cas=cas as number;const proof=observation(f.command());f.clear();await assert.rejects(f.owner.confirm('owner','scope','forward',1,proof,async()=>true),code('FENCING_REJECTED','Concurrent Transit coordination writer'));assert.deepEqual(f.state.row,old);assert.equal(f.events.at(-1),'rollback');}f.state.cas=1;
 for(const result of [false,f.state.failure]){const old=f.seed(),proof=observation(f.command());f.clear();await assert.rejects(f.owner.confirm('owner','scope','forward',1,proof,async()=>{if(result instanceof Error)throw result;return result;}),result instanceof Error?(e:unknown)=>e===result:code('AUTHORIZATION_DENIED'));assert.deepEqual(f.state.row,old);assert.equal(f.events.includes('update'),false);}
 f.seed('preparing',0,MAX_COUNTER);f.clear();await assert.rejects(f.owner.confirm('owner','scope','forward',1,observation(f.command()),async()=>{f.event('verify');return true;}),code('RESOURCE_LIMIT','Transit journal revision exhausted'));assert.equal(f.events.includes('verify'),true);assert.equal(f.events.includes('update'),false);
});

test('64 persist encode digest clock ordering and post-write step failures roll back original journal without history mutation',async t=>{
 const f=fixture();t.mock.method(Date,'now',()=>f.clock());const nativeEncode=JSON.stringify,nativeEntries=Object.entries,nativeCompare=String.prototype.localeCompare;let failAt='',stepFailure=false,stepCompareOrdinal=0,failStepAt=0;
 t.mock.method(JSON,'stringify',function(value:unknown,...args:unknown[]){if(value===f.state.row?.receipt_highwater){f.event('encode');if(failAt==='encode')throw f.state.failure;}return Reflect.apply(nativeEncode,JSON,[value,...args]);});
 t.mock.method(Object,'entries',function(value:unknown){if(value&&typeof value==='object'&&'receiptHighwater' in value&&'revision' in value&&(value as {revision:number}).revision===2){f.event('digest');if(failAt==='digest')throw f.state.failure;}return nativeEntries(value as object);});
 t.mock.method(String.prototype,'localeCompare',function(this:string,value:string){if(stepFailure&&String(this).startsWith('binding-')&&stepCompareOrdinal++===failStepAt)throw f.state.failure;return nativeCompare.call(this,value);});
 for(const at of ['encode','digest','clock','update']){const old=f.seed();f.clear();failAt=at;f.state.failName=at==='clock'?'clock':'';f.state.failAfter=at==='update'?'update':'';await assert.rejects(f.fail(),e=>e===f.state.failure);assert.deepEqual(f.state.row,old);const ordered=f.events.filter(e=>['encode','digest','clock','update'].includes(e));assert.deepEqual(ordered,['encode','digest','clock','update'].slice(0,['encode','digest','clock','update'].indexOf(at)+1));assert.equal(f.events.at(-1),'rollback');f.state.failName='';f.state.failAfter='';}failAt='';
 f.seed();f.clear();await f.fail();assert.deepEqual(f.events.filter(e=>['encode','digest','clock','update'].includes(e)),['encode','digest','clock','update']);
 // Projecting the next step is after INSERT/UPDATE and remains inside the same Tx.
 f.state.row=undefined;stepFailure=true;stepCompareOrdinal=0;failStepAt=0;f.clear();await assert.rejects(f.call(),e=>e===f.state.failure);assert.equal(f.events.includes('insert'),true);assert.equal(f.state.row,undefined);
 stepFailure=false;const old=f.seed();const proof=observation(f.command());stepFailure=true;stepCompareOrdinal=0;failStepAt=1;f.clear();await assert.rejects(f.owner.confirm('owner','scope','forward',1,proof,async()=>true),e=>e===f.state.failure);assert.equal(f.events.includes('update'),true);assert.deepEqual(f.state.row,old);stepFailure=false;
 const beforeFail=f.seed();stepFailure=true;stepCompareOrdinal=0;failStepAt=0;f.clear();await assert.rejects(f.fail(),e=>e===f.state.failure);assert.equal(f.events.includes('update'),true);assert.deepEqual(f.state.row,beforeFail);stepFailure=false;
 for(const after of ['insert','update']){f.state.failAfter=after;const previous:Journal|undefined=after==='insert'?undefined:f.seed();f.state.row=previous;f.clear();await assert.rejects(after==='insert'?f.call():f.fail(),e=>e===f.state.failure);assert.deepEqual(f.state.row,previous);}f.state.failAfter='';
 // Every store access failure cuts off subsequent owner work and uses caller rollback.
 for(const name of ['stage','session','slot','journal','insert']){f.state.row=undefined;f.state.failName=name;f.clear();await assert.rejects(f.call(),e=>e===f.state.failure);assert.equal(f.state.row,undefined);assert.equal(f.events.at(-2),name);}f.state.failName='';
});

test('64 recovery follows supplied locked order validates each retained stage/body and atomically compensates without actor scope ownership freshness or reset',async t=>{
 const f=fixture();t.mock.method(Date,'now',()=>f.clock());
 for(const [index,id] of ['forward-a','forward-b','forward-c'].entries()){const retained={...stage(id),state:'aborted' as const,created_by:'foreign',expires_at:now-1},plan=verifyTransitStage(retained),row=journal(plan,(['preparing','activating','sealed'] as const)[index]!,index===2?3:1,4,{'node-c':2});f.stages.set(id,retained);f.journals.set(id,row);f.state.recovering.push(row);}
 const before=new Map(f.journals);f.state.session=999;f.state.overrideSlot=true;const count=await f.owner.quarantineRecovery();assert.equal(count,3);assert.deepEqual(f.events,['begin','recovering',...Array.from({length:3},()=>['recoveryStage','clock','update']).flat(),'commit']);assert.deepEqual(f.calls.filter(c=>c.name==='recoveryStage').map(c=>c.args),[['forward-a',1],['forward-b',1],['forward-c',1]]);
 for(const [id,row] of f.journals){assert.equal(row.phase,'compensating');assert.equal(row.position,0);assert.equal(row.revision,5);assert.equal(row.receipt_highwater,JSON.stringify(before.get(id)!.receipt_highwater));assert.equal(row.created_at,before.get(id)!.created_at);assert.equal(row.plan_digest,before.get(id)!.plan_digest);}
 for(const mode of ['missing','stage','body','revision','update']){f.journals.clear();for(const [key,row] of before)f.journals.set(key,row);const second=f.stages.get('forward-b')!;if(mode==='missing')f.stages.delete('forward-b');if(mode==='stage')f.stages.set('forward-b',{...second,body:'{'});if(mode==='body')f.state.recovering[1]={...before.get('forward-b')!,receipt_highwater:'{'};if(mode==='revision')f.state.recovering[1]=journal(verifyTransitStage(second),'activating',1,MAX_COUNTER,{'node-c':2});if(mode==='update')f.state.failAfter='update';f.clear();await assert.rejects(f.owner.quarantineRecovery());assert.deepEqual([...f.journals],[...before]);assert.equal(f.events.at(-1),'rollback');assert.equal(f.events.includes('session'),false);assert.equal(f.events.includes('slot'),false);f.stages.set('forward-b',second);f.state.recovering[1]=before.get('forward-b')!;f.state.failAfter='';}
 f.state.recovering=[];f.clear();assert.equal(await f.owner.quarantineRecovery(),0);assert.deepEqual(f.events,['begin','recovering','commit']);
});
