import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IdentityAccessHost } from '../src/framework/public.ts';
import type { IdentityAccessStore, IdentityMembershipRecord, IdentityListedMember, IdentityValueCodec } from '../src/framework/public.ts';
import { IdentityService } from '../src/modules/identity-owner/public.ts';
import { Identity, newToken, tokenHash, validBearerToken } from '../src/modules/identity.ts';
import { nativeIdentityCodec } from '../src/compatibility/public.ts';
import { nativeNodeSecrets } from '../src/infrastructure/identity-secrets.ts';

type Tx={readonly id:symbol};
const token='a'.repeat(32);
function fixture(){
 const tx:Tx={id:Symbol()},events:string[]=[],calls:{name:string;args:unknown[]}[]=[];
 const state={fail:'',error:new Error('provider failure'),account:{id:'actor'} as {id:string}|undefined,membership:{canManage:1} as {canManage:number}|undefined,
  owner:{ownerId:'owner'} as {ownerId:string}|undefined,current:{revision:1,active:1,canManage:0} as IdentityMembershipRecord|undefined,
  subject:{tokenHash:tokenHash(token)} as {tokenHash:string}|undefined,count:1,writes:[] as unknown[],serial:0,now:123,
  accounts:[{id:'a-owner',owner:1},{id:'b-member',owner:0},{id:'z-owner',owner:1}],listed:[] as IdentityListedMember[]};
 const record=(name:string,args:unknown[]=[])=>{events.push(name);calls.push({name,args});if(state.fail===name)throw state.error;};
 const answers:Record<string,()=>unknown>={accountByToken:()=>state.account,activeMembership:()=>state.membership,ownerForShare:()=>state.owner,ownerForUpdate:()=>state.owner,memberForUpdate:()=>state.current,accountForShare:()=>state.subject,executionMembershipCount:()=>state.count,recoveryAccounts:()=>state.accounts,listMembers:()=>state.listed};
 const store=new Proxy({} as IdentityAccessStore<Tx>,{get(_target,key){return async function(this:unknown,current:Tx,...args:unknown[]){assert.equal(this,store);assert.equal(current,tx);const name=String(key);record(name,args);if(answers[name])return answers[name]!();state.writes.push([name,...args]);};}});
 const accounts={async byToken(hash:string){assert.equal(this,accounts);record('byToken',[hash]);return state.account;}};
 const secrets={newID(){assert.equal(this,secrets);record('newID');return 'event';},newToken(){assert.equal(this,secrets);record('newToken');return 'T'.repeat(31)+(++state.serial);},tokenHash(value:string){assert.equal(this,secrets);record('tokenHash',[value]);return tokenHash(value);}};
 const codec=new Proxy({...nativeIdentityCodec} as IdentityValueCodec,{get(target,key,receiver){const value=Reflect.get(target,key,receiver);if(typeof value!=='function')return value;return function(this:unknown,...args:unknown[]){assert.equal(this,codec);record(String(key),args);return Reflect.apply(value,target,args);};}});
 const db={async transaction<T>(action:(tx:Tx)=>Promise<T>){record('begin');const before=structuredClone(state.writes);try{const result=await action(tx);record('commit');return result;}catch(error){state.writes=before;events.push('rollback');throw error;}}};
 const options={db,store,accounts,secrets,codec,now:()=>{record('now');return state.now;}};
 const host=new IdentityService(options);return {tx,state,events,calls,options,host,clear(){events.length=0;calls.length=0;}};
}
const code=(expected:string,message?:string)=>(error:unknown)=>{assert.equal((error as {code:string}).code,expected);if(message)assert.equal((error as Error).message,message);return true;};
const meaningful=(f:ReturnType<typeof fixture>)=>f.events.filter(name=>!['isId','isCounter','validBearer','tokenHash'].includes(name));

test('20 explicit access host preserves exact native Bearer grammar pool versus transaction lookup and 401 boundaries',async()=>{
 for(const header of [undefined,'',token,'bearer '+token,'Bearer  '+token,'Bearer '+token+' ','Bearer '+'a'.repeat(31),'Bearer '+'a'.repeat(129),'Bearer '+'a'.repeat(31)+'+']){const f=fixture();await assert.rejects(f.host.authenticate(header),code('UNAUTHENTICATED'));assert.deepEqual(f.events,['bearer']);}
 // The original header regex uses $, retaining its native final-newline match;
 // standalone bearer validation has a separate explicit CR/LF refusal.
 const newline=fixture();assert.equal(await newline.host.authenticate('Bearer '+token+'\n'),'actor');assert.equal(validBearerToken(token+'\n'),false);
 for(const method of ['authenticate','authenticateIn'] as const)for(const absent of [false,true]){const f=fixture();if(absent)f.state.account=undefined;const invoke=()=>method==='authenticate'?f.host.authenticate('Bearer '+token):f.host.authenticateIn(f.tx,'Bearer '+token);if(absent)await assert.rejects(invoke(),code('UNAUTHENTICATED'));else assert.equal(await invoke(),'actor');assert.deepEqual(f.events,['bearer','tokenHash',method==='authenticate'?'byToken':'accountByToken']);assert.deepEqual(f.calls.at(-1)!.args,[tokenHash(token)]);}
 for(const stage of ['bearer','tokenHash','byToken','accountByToken']){const f=fixture();f.state.fail=stage;await assert.rejects(stage==='accountByToken'?f.host.authenticateIn(f.tx,'Bearer '+token):f.host.authenticate('Bearer '+token),e=>e===f.state.error);assert.equal(f.events.at(-1),stage);}
 const f=fixture(),access=new IdentityAccessHost(f.options);assert.equal(await access.authenticate('Bearer '+token),'actor');assert.deepEqual(f.state.writes,[]);
});

test('20 native Identity codec retains ID counter token boundaries without additional normalization',()=>{
 for(const value of ['',null,1,{},'a'.repeat(129),'a\n',' a','/a'])assert.equal(nativeIdentityCodec.isId(value),false);
 for(const value of ['a','A_0.x:-','a'.repeat(128)])assert.equal(nativeIdentityCodec.isId(value),true);
 for(const value of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'1'])assert.equal(nativeIdentityCodec.isCounter(value,true),false);
 assert.equal(nativeIdentityCodec.isCounter(0,true),true);assert.equal(nativeIdentityCodec.isCounter(0),false);assert.equal(nativeIdentityCodec.isCounter(Number.MAX_SAFE_INTEGER),true);assert.equal(nativeIdentityCodec.maxRevision,Number.MAX_SAFE_INTEGER);
 for(const value of [null,1,{},'a'.repeat(31),'a'.repeat(129),'a'.repeat(31)+'+','a'.repeat(32)+'\n'])assert.equal(nativeIdentityCodec.validBearer(value),false);
 for(const value of ['a'.repeat(32),'A_-0'.repeat(32)])assert.equal(nativeIdentityCodec.validBearer(value),true);
});

test('20 membership scope owner and execution permission preserve missing404 management403 owner403 and raw query failures',async()=>{
 for(const manage of [false,true])for(const membership of [undefined,{canManage:0},{canManage:1}]){const f=fixture();f.state.membership=membership;if(!membership||manage&&!membership.canManage)await assert.rejects(f.host.scope(f.tx,'actor','scope',manage),code(membership?'AUTHORIZATION_DENIED':'NOT_FOUND'));else await f.host.scope(f.tx,'actor','scope',manage);assert.deepEqual(f.calls[0],{name:'activeMembership',args:['scope','actor']});assert.deepEqual(f.events,['activeMembership']);}
 for(const owner of [undefined,{ownerId:'other'},{ownerId:'actor'}]){const f=fixture();f.state.owner=owner;if(owner?.ownerId==='actor')await f.host.owner(f.tx,'actor','scope');else await assert.rejects(f.host.owner(f.tx,'actor','scope'),code('AUTHORIZATION_DENIED'));assert.deepEqual(f.events,['activeMembership','ownerForShare']);}
 for(const count of [0,1,2]){const f=fixture();f.state.count=count;assert.equal(await f.host.executing(f.tx,'actor','scope'),count===1);assert.deepEqual(f.calls[0],{name:'executionMembershipCount',args:['scope','actor']});}
 for(const failure of ['activeMembership','ownerForShare','executionMembershipCount']){const f=fixture();f.state.fail=failure;await assert.rejects(failure==='executionMembershipCount'?f.host.executing(f.tx,'actor','scope'):f.host.owner(f.tx,'actor','scope'),e=>e===f.state.error);assert.equal(f.events.at(-1),failure);}
});

test('20 bootstrap validates left to right and preserves raw account or scope duplicate with original transactional prefix',async()=>{
 for(const args of [['','actor',token],['scope','',token],['scope','actor','short']] as const){const f=fixture();await assert.rejects(f.host.bootstrap(args[0],args[1],args[2]),/Bootstrap requires valid IDs and a random bearer token/);assert.equal(f.events.includes('begin'),false);}
 const order=['begin','insertAccount','createScope','addOwner','commit'];for(const fail of ['',...order.slice(1,-1)]){const f=fixture();f.state.fail=fail;f.state.error=Object.assign(new Error('raw duplicate'),{code:'ER_DUP_ENTRY'});if(fail){await assert.rejects(f.host.bootstrap('scope','actor',token),e=>e===f.state.error);assert.deepEqual(f.state.writes,[]);assert.deepEqual(meaningful(f),[...order.slice(0,order.indexOf(fail)+1),'rollback']);}else{await f.host.bootstrap('scope','actor',token);assert.deepEqual(meaningful(f),order);assert.deepEqual(f.calls.find(c=>c.name==='insertAccount')!.args,['actor',tokenHash(token)]);}}
});

test('20 member full authority lock chain no-op and all active/role transitions preserve revisions mutable response and audit ordering',async()=>{
 const prefix=['activeMembership','ownerForShare','ownerForUpdate','memberForUpdate','accountForShare'];
 for(const active of [0,1])for(const manage of [0,1])for(const role of ['viewer','manager','removed'] as const){const f=fixture();f.state.current={revision:1,active,canManage:manage};const changed=Boolean(active)!==(role!=='removed')||Boolean(manage)!==(role==='manager');const result=await f.host.changeMember(f.tx,'owner','scope','subject',1,role);
  assert.deepEqual(result,{actorId:'subject',revision:changed?2:1,role,active:role!=='removed',changed});assert.deepEqual(meaningful(f),[...prefix,...(changed?['saveMember','newID','now','audit']:[])]);assert.deepEqual(f.calls.find(c=>c.name==='isCounter')!.args,[1,true]);if(changed)assert.deepEqual(f.calls.find(c=>c.name==='audit')!.args,['event','scope','owner','subject','member_change',2,123,{role}]);else assert.deepEqual(f.state.writes,[]);result.role='viewer';result.active=false;assert.equal(Object.isFrozen(result),false);
 }
 for(const role of ['viewer','manager'] as const){const f=fixture();f.state.current=undefined;f.state.subject=undefined;const result=await f.host.changeMember(f.tx,'owner','scope','subject',0,role,token);assert.equal(result.revision,1);assert.deepEqual(meaningful(f),[...prefix,'insertMemberAccount','saveMember','newID','now','audit']);assert.deepEqual(f.calls.find(c=>c.name==='insertMemberAccount')!.args,['subject',tokenHash(token)]);}
});

test('20 member invalid inputs protected owner stale zero missing account credential mismatch and exhaustion stop before mutation',async()=>{
 for(const args of [['',0,'viewer',undefined],['subject',-1,'viewer',undefined],['subject',0,'owner',undefined],['subject',0,'viewer','short']] as const){const f=fixture();await assert.rejects(f.host.changeMember(f.tx,'owner','scope',args[0],args[1],args[2] as 'viewer',args[3]),code('INVALID_CONFIG'));assert.equal(f.events.includes('activeMembership'),false);}
 for(const mode of ['protected','stale','zero','newMissing','newRemoved','mismatch','exhausted'] as const){const f=fixture();if(mode==='protected')f.state.owner={ownerId:'subject'};if(mode==='newMissing'||mode==='newRemoved'){f.state.current=undefined;f.state.subject=undefined;}if(mode==='exhausted')f.state.current!.revision=Number.MAX_SAFE_INTEGER;
  const revision=mode==='stale'?2:mode==='zero'||mode==='newMissing'||mode==='newRemoved'?0:mode==='exhausted'?Number.MAX_SAFE_INTEGER:1;
  const role=mode==='newRemoved'?'removed':'manager',supplied=mode==='mismatch'?'b'.repeat(32):mode==='newRemoved'?token:undefined;
  await assert.rejects(f.host.changeMember(f.tx,mode==='protected'?'subject':'owner','scope','subject',revision,role,supplied),code(mode==='protected'?'OWNER_PROTECTED':mode==='stale'||mode==='zero'?'REVISION_CONFLICT':mode==='newMissing'||mode==='newRemoved'?'INVALID_CONFIG':mode==='mismatch'?'ACCOUNT_CONFLICT':'REVISION_EXHAUSTED'));assert.deepEqual(f.state.writes,[]);
 }
 const max=fixture();max.state.current!.revision=Number.MAX_SAFE_INTEGER;assert.equal((await max.host.changeMember(max.tx,'owner','scope','subject',Number.MAX_SAFE_INTEGER,'viewer')).changed,false);assert.deepEqual(max.state.writes,[]);
 const equal=fixture();assert.equal((await equal.host.changeMember(equal.tx,'owner','scope','subject',1,'viewer',token)).changed,false);
});

test('20 member every authority secret mutation and audit failure preserves first original error and caller rollback',async()=>{
 const order=['activeMembership','ownerForShare','ownerForUpdate','memberForUpdate','accountForShare','tokenHash','insertMemberAccount','saveMember','newID','now','audit'];
 for(const failure of order){const f=fixture();f.state.current=undefined;f.state.subject=undefined;f.state.fail=failure;await assert.rejects(f.options.db.transaction(tx=>f.host.changeMember(tx,'owner','scope','subject',0,'manager',token)),e=>e===f.state.error);assert.deepEqual(f.state.writes,[]);assert.equal(f.events.at(-2),failure);assert.equal(f.events.at(-1),'rollback');}
 const f=fixture();await f.host.audit(f.tx,'scope','actor','subject','node_grant_change',7,{second:2,first:1});assert.deepEqual(f.events,['newID','now','audit']);assert.deepEqual(f.calls.at(-1)!.args,['event','scope','actor','subject','node_grant_change',7,123,{second:2,first:1}]);
});

test('20 list retains native ordering mutable arrays role precedence truthiness and original owner checks',async()=>{
 const f=fixture();f.state.listed=[{actorId:'a',ownerId:'a',revision:8,active:0,canManage:0},{actorId:'b',ownerId:'a',revision:3,active:0,canManage:1},{actorId:'c',ownerId:'a',revision:4,active:1,canManage:1},{actorId:'d',ownerId:'a',revision:5,active:1,canManage:0}];
 const result=await f.host.listMembers('owner','scope');assert.deepEqual(result,{members:[{actorId:'a',revision:8,active:false,role:'owner'},{actorId:'b',revision:3,active:false,role:'removed'},{actorId:'c',revision:4,active:true,role:'manager'},{actorId:'d',revision:5,active:true,role:'viewer'}]});assert.deepEqual(f.events,['begin','activeMembership','ownerForShare','listMembers','commit']);result.members.reverse();result.members[0]!.role='mutable';assert.equal(f.state.listed[0]!.actorId,'a');
 f.state.fail='listMembers';await assert.rejects(f.host.listMembers('owner','scope'),e=>e===f.state.error);assert.equal(f.events.at(-1),'rollback');
});

test('20 recovery rotates every account token in supplied sorted order before any non-owner deactivation with no private transaction',async()=>{
 const f=fixture(),result=await f.host.quarantineRecovery(f.tx);assert.deepEqual(f.events,['recoveryAccounts',...Array.from({length:3},()=>['newToken','tokenHash','replaceToken']).flat(),'deactivateNonOwners']);assert.deepEqual(result,f.state.accounts.map((row,i)=>({actorId:row.id,token:'T'.repeat(31)+(i+1),owner:Boolean(row.owner)})));assert.deepEqual(f.calls.filter(c=>c.name==='replaceToken').map(c=>c.args),result.map(row=>[row.actorId,tokenHash(row.token)]));assert.equal(f.events.includes('now'),false);assert.equal(f.events.includes('newID'),false);
 for(const fail of ['recoveryAccounts','newToken','tokenHash','replaceToken','deactivateNonOwners']){const broken=fixture();broken.state.fail=fail;await assert.rejects(broken.options.db.transaction(tx=>broken.host.quarantineRecovery(tx)),e=>e===broken.state.error);assert.deepEqual(broken.state.writes,[]);assert.equal(broken.events.at(-2),fail);}
 const empty=fixture();empty.state.accounts=[];assert.deepEqual(await empty.host.quarantineRecovery(empty.tx),[]);assert.deepEqual(empty.events,['recoveryAccounts','deactivateNonOwners']);
});

test('20 legacy Identity keeps native helpers explicit providers and dynamically reads original clock',()=>{
 const original=Date.now;try{const owner=new Identity({pool:{}} as never);Date.now=()=>9876;assert.equal(Reflect.get(owner,'now')(),9876);assert.ok(owner instanceof IdentityService);assert.ok(owner instanceof IdentityAccessHost);assert.equal(Reflect.get(owner,'secrets'),nativeNodeSecrets);assert.equal(Reflect.get(owner,'codec'),nativeIdentityCodec);assert.equal(newToken,nativeNodeSecrets.newToken);assert.equal(tokenHash,nativeNodeSecrets.tokenHash);assert.equal(validBearerToken,nativeIdentityCodec.validBearer);}finally{Date.now=original;}
});
