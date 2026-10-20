import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { X509Certificate } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Forward } from '@tunex/core';
import { NodeAuthorityHost } from '../src/framework/public.ts';
import type { AuthorizedNodeFacts, NodeAuthorityOptions, NodeAuthorityStore, NodeEnrollmentRecord, NodeCurrentCredentialRecord, NodeScopeAuthority, NodeAuthorityCodec, SignedNodeCredential } from '../src/framework/public.ts';
import { NodeService, snapshotNodeCommand, validatePolicy } from '../src/modules/node-owner/public.ts';
import { nativeNodeCodec } from '../src/compatibility/public.ts';
import { nativeNodeSecrets, newToken, tokenHash } from '../src/infrastructure/identity-secrets.ts';
import { Nodes } from '../src/modules/nodes.ts';
import { NodeCertificateAuthority } from '../src/infrastructure/pki.ts';

type Tx={readonly owner:symbol};
const csr='-----BEGIN CERTIFICATE REQUEST-----\noriginal';
const token='a'.repeat(32);
const facts:AuthorizedNodeFacts={nodeId:'node-a',scopeId:'scope-a',capabilities:['adp.3','native.direct.v1','tcp'],allowedListenerAddresses:['127.0.0.1'],allowedPorts:[32001],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false};
const signed:SignedNodeCredential={certificate:'CERTIFICATE',ca:'CA',fingerprint:'new-fingerprint',until:500000};
function fixture(){
 const tx:Tx=Object.freeze({owner:Symbol()}),events:string[]=[],calls:{name:string;args:unknown[]}[]=[];
 const state={now:1000,fail:'',error:new Error('original provider failure'),sign:()=>{},credentialReads:0,
  enrollment:{id:'node-a',scope_id:'scope-a',facts,revoked:0,credential_until:100000,enrollment_until:2000,csr_digest:null,enrollment_response:null} as NodeEnrollmentRecord|undefined,
  current:{id:'node-a',scope_id:'scope-a',facts,revoked:0,credential_until:100000,credential_fingerprint:'old'} as NodeCurrentCredentialRecord|undefined,
  credential:{valid_until:100000,retire_after:null} as {valid_until:number;retire_after:number|null}|undefined,
  replay:undefined as {request_digest:string;response:unknown}|undefined,active:[] as {fingerprint:string;valid_until:number}[],
  relay:[] as {fingerprint:string;certificate:string;valid_until:number;retire_after:number|null}[],grant:false,revision:1,visible:true,
  maximum:null as number|null,writes:[] as unknown[],machine:{node_id:'node-a'} as {node_id:string}|undefined};
 const record=(name:string,args:unknown[]=[])=>{events.push(name);calls.push({name,args});if(state.fail===name)throw state.error;};
 const answers:Record<string,()=>unknown>={enrollment:()=>state.enrollment,currentForUpdate:()=>state.current,state:()=>state.current,
  credential:()=>{state.credentialReads++;return state.credential;},rotationReplay:()=>state.replay,relayReplay:()=>state.replay,
  activeRelayCredentials:()=>state.active,relayCredentials:()=>state.relay,hasGrant:()=>state.grant,scopeGrant:()=>state.grant,relayGrant:()=>state.grant,
  grantRevisionForUpdate:()=>({grant_revision:state.revision}),grantRevision:()=>({grant_revision:state.revision}),grantActors:()=>[{actor_id:'subject'}],
  visible:()=>state.visible,scopedNode:()=>state.current,credentials:()=>[]};
 const store=new Proxy({} as NodeAuthorityStore<Tx>,{get(_target,key){return async function(this:unknown,current:Tx,...args:unknown[]){assert.equal(this,store);assert.equal(current,tx);const name=String(key);record(name,args);if(answers[name])return answers[name]!();state.writes.push([name,...args]);};}});
 const identity:NodeScopeAuthority<Tx>={async scope(current,...args){assert.equal(this,identity);assert.equal(current,tx);record('scope',args);},async owner(current,...args){assert.equal(this,identity);assert.equal(current,tx);record('owner',args);},async executing(current,...args){assert.equal(this,identity);assert.equal(current,tx);record('executing',args);return true;},async audit(current,...args){assert.equal(this,identity);assert.equal(current,tx);record('accessAudit',args);}};
 const resources={async initializeNode(current:Tx,...args:unknown[]){assert.equal(this,resources);assert.equal(current,tx);record('initializeNode',args);},async lockNode(current:Tx,...args:unknown[]){assert.equal(this,resources);assert.equal(current,tx);record('lockNode',args);},async maximumAuthorization(current:Tx,...args:unknown[]){assert.equal(this,resources);assert.equal(current,tx);record('maximumAuthorization',args);return state.maximum;}};
 const secrets={newID(){assert.equal(this,secrets);record('newID');return 'event-a';},newToken(){assert.equal(this,secrets);record('newToken');return token;},tokenHash(value:string){assert.equal(this,secrets);record('tokenHash',[value]);return tokenHash(value);}};
 const codec=new Proxy({...nativeNodeCodec} as NodeAuthorityCodec,{get(target,key,receiver){const value=Reflect.get(target,key,receiver);if(typeof value!=='function')return value;return function(this:unknown,...args:unknown[]){assert.equal(this,codec);record(String(key),args);return Reflect.apply(value,target,args);};}});
 const signer={async sign(...args:Parameters<NodeAuthorityOptions<Tx>['signer']['sign']>){assert.equal(this,signer);record('sign',args);state.sign();return {...signed};}};
 const machine={async machine(...args:unknown[]){assert.equal(this,machine);record('machine',args);return state.machine;}};
 const options:NodeAuthorityOptions<Tx>={db:{async transaction(action){record('begin');const before=structuredClone(state.writes);try{const result=await action(tx);record('commit');return result;}catch(error){state.writes=before;events.push('rollback');throw error;}}},identity,store,resources,secrets,codec,signer,machine,now:()=>{record('now');return state.now;},overlapSeconds:1,relayCredentialSeconds:60};
 const host=new NodeService(options);
 return {tx,events,calls,state,options,host,clear(){events.length=0;calls.length=0;state.credentialReads=0;}};
}
function code(expected:string,message?:string){return (error:unknown)=>{assert.equal((error as {code:string}).code,expected);if(message)assert.equal((error as Error).message,message);return true;};}
function sequence(f:ReturnType<typeof fixture>){return f.events.filter(x=>!['now','formatTime','newID','digest','readValue','isId','validEnrollmentToken','validCredentialRequest','tokenHash'].includes(x));}

test('12/133 Node constructor validates bounds then formatter then all four native prerequisites before clock or IO',()=>{
 const f=fixture();
 for(const overlap of [0,301,1.5,NaN,Infinity])assert.throws(()=>new NodeAuthorityHost({...f.options,overlapSeconds:overlap,relayCredentialSeconds:0,codec:undefined as never}),/overlap/);
 for(const lifetime of [59,86401,60.5,NaN,Infinity])assert.throws(()=>new NodeAuthorityHost({...f.options,relayCredentialSeconds:lifetime,codec:undefined as never}),/authority/);
 assert.throws(()=>new NodeAuthorityHost({...f.options,codec:undefined as never}),/time codec/);
 for(const key of ['validEnrollmentToken','validCredentialRequest','supportsDirectRuntime','relayFingerprint'] as const)for(const bad of [undefined,null,1,{}])assert.throws(()=>new NodeAuthorityHost({...f.options,codec:{...nativeNodeCodec,[key]:bad} as never}),/native codec/);
 for(const overlapSeconds of [1,300])for(const relayCredentialSeconds of [60,86400])new NodeAuthorityHost({...f.options,overlapSeconds,relayCredentialSeconds});
 assert.deepEqual(f.events,[]);
 const ordered=['formatTime','validEnrollmentToken','validCredentialRequest','supportsDirectRuntime','relayFingerprint'];
 for(const missing of ordered){const reads:string[]=[];const guarded=new Proxy({...nativeNodeCodec},{get(target,key,receiver){reads.push(String(key));return key===missing?undefined:Reflect.get(target,key,receiver);}});assert.throws(()=>new NodeAuthorityHost({...f.options,codec:guarded}),missing==='formatTime'?/time codec/:/native codec/);assert.deepEqual(reads,ordered.slice(0,ordered.indexOf(missing)+1));}
});

test('133 native token CSR predicates preserve exact boundaries and caller-specific short circuit errors',async()=>{
 for(const value of [undefined,null,1,{},[],new String(token),'a'.repeat(31),'a'.repeat(129),'a'.repeat(31)+'+','a'.repeat(31)+'\n'])assert.equal(nativeNodeCodec.validEnrollmentToken(value),false);
 for(const value of [token,'A_-0'.repeat(32)])assert.equal(nativeNodeCodec.validEnrollmentToken(value),true);
 for(const value of [undefined,null,1,{},'bad',csr+'a'.repeat(16384)])assert.equal(nativeNodeCodec.validCredentialRequest(value),false);
 for(const value of ['-----BEGIN CERTIFICATE REQUEST-----','-----BEGIN CERTIFICATE REQUEST-----'+'x'.repeat(16384-35)])assert.equal(nativeNodeCodec.validCredentialRequest(value),true);
 for(const method of ['enroll','rotate','relayCredential'] as const){const f=fixture();
  await assert.rejects(method==='enroll'?f.host.enroll('',token,csr):f.host[method]('node-a','old',2,'',csr),code('INVALID_CONFIG',method==='enroll'?'Invalid enrollment input':method==='rotate'?'Valid request ID and CSR required':'Valid Relay request ID and CSR required'));
  assert.deepEqual(f.events,['isId']);f.clear();
  await assert.rejects(method==='enroll'?f.host.enroll('node-a','bad',csr):f.host[method]('node-a','old',2,'request-a','bad'),code('INVALID_CONFIG'));
  assert.deepEqual(f.events,method==='enroll'?['isId','validEnrollmentToken']:['isId','validCredentialRequest']);
 }
 const marker=new Error('digest');const f=fixture();f.state.fail='digest';f.state.error=marker;await assert.rejects(f.host.enroll('node-a',token,csr),e=>e===marker);assert.equal(f.events.includes('begin'),false);
 const badCSR=fixture();await assert.rejects(badCSR.host.enroll('node-a',token,'bad'),code('INVALID_CONFIG','Invalid enrollment input'));assert.deepEqual(badCSR.events,['isId','validEnrollmentToken','validCredentialRequest']);
 const hashFailure=fixture();hashFailure.state.fail='tokenHash';await assert.rejects(hashFailure.host.enroll('node-a',token,csr),e=>e===hashFailure.state.error);assert.deepEqual(sequence(hashFailure),['begin','rollback']);
});

test('12/134 enrollment missing revoked expired replay conflict and expiry during signing preserve original transaction ordering',async()=>{
 for(const mode of ['missing','revoked','expired','equal','different','during','signer'] as const){const f=fixture();
  if(mode==='missing')f.state.enrollment=undefined;else if(mode==='revoked')f.state.enrollment!.revoked=1;else if(mode==='expired')f.state.enrollment!.enrollment_until=1000;
  if(mode==='equal'||mode==='different'){f.state.enrollment!.csr_digest=mode==='equal'?nativeNodeCodec.digest({csr}):'different';f.state.enrollment!.enrollment_response='{"certificate":"saved","ca":"savedCA"}';}
  if(mode==='during')f.state.sign=()=>{f.state.now=2000;};if(mode==='signer')f.state.fail='sign';
  if(mode==='equal'){assert.deepEqual(await f.host.enroll('node-a',token,csr),{certificate:'saved',ca:'savedCA'});assert.deepEqual(sequence(f),['begin','enrollment','commit']);}
  else {await assert.rejects(f.host.enroll('node-a',token,csr),mode==='signer'?e=>e===f.state.error:code(mode==='different'?'ENROLLMENT_USED':'AUTHORIZATION_DENIED'));assert.deepEqual(f.state.writes,[]);assert.equal(f.events.includes('sign'),mode==='during'||mode==='signer');assert.equal(f.events.at(-1),'rollback');}
  assert.deepEqual(f.calls.find(c=>c.name==='enrollment')!.args,['node-a',tokenHash(token)]);
 }
 const expected=['begin','enrollment','sign','acceptEnrollment','insertCredential','commit'];
 for(const failure of ['',...expected.slice(1,-1)]){const f=fixture();f.state.fail=failure;
  if(failure){await assert.rejects(f.host.enroll('node-a',token,csr),e=>e===f.state.error);assert.deepEqual(f.state.writes,[]);assert.deepEqual(sequence(f),[...expected.slice(0,expected.indexOf(failure)+1),'rollback']);}
  else {assert.deepEqual(await f.host.enroll('node-a',token,csr),{certificate:signed.certificate,ca:signed.ca});assert.deepEqual(sequence(f),expected);assert.deepEqual(f.calls.find(c=>c.name==='sign')!.args,['node-a',csr]);assert.deepEqual(f.calls.find(c=>c.name==='insertCredential')!.args,['node-a',signed,1000]);assert.ok(f.events.lastIndexOf('now')>f.events.indexOf('acceptEnrollment'));assert.ok(f.events.lastIndexOf('now')<f.events.indexOf('insertCredential'));}
 }
});

test('12/134 machine and Relay rotations replay before superseded source but require live source and post-sign credential recheck',async()=>{
 for(const method of ['rotate','relayCredential'] as const){
  for(const mode of ['missing','revoked','expired','replay','conflict','superseded','limit','postSignExpired','noAuthority'] as const){const f=fixture();
   if(mode==='missing')f.state.current=undefined;if(mode==='revoked')f.state.current!.revoked=1;if(mode==='expired')f.state.credential=undefined;
   if(['replay','conflict','superseded'].includes(mode))f.state.current!.credential_fingerprint='another';
   if(mode==='replay'||mode==='conflict')f.state.replay={request_digest:mode==='replay'?nativeNodeCodec.digest({csr}):'other',response:'{"original":"replay"}'};
   if(mode==='limit'){if(method==='rotate')continue;f.state.active=[{fingerprint:'one',valid_until:10000},{fingerprint:'two',valid_until:10000}];}
   if(mode==='postSignExpired')f.state.sign=()=>{f.state.credential=undefined;};
   if(mode==='noAuthority'){if(method==='rotate')continue;f.state.sign=()=>{f.state.now=100000;f.state.credential={valid_until:200000,retire_after:null};};}
   if(mode==='replay'){assert.deepEqual(await f.host[method]('node-a','old',2,'request-a',csr),{original:'replay'});assert.equal(f.events.includes('sign'),false);}
   else await assert.rejects(f.host[method]('node-a','old',2,'request-a',csr),code(mode==='conflict'?'IDEMPOTENCY_CONFLICT':mode==='superseded'?'CREDENTIAL_SUPERSEDED':mode==='limit'?'RESOURCE_LIMIT':'AUTHORIZATION_DENIED'));
   assert.deepEqual(f.state.writes,[]);assert.deepEqual(f.calls.find(c=>c.name==='lockNode')!.args,['node-a',2]);
   if(mode==='postSignExpired')assert.equal(f.state.credentialReads,2);
  }
  const writes=method==='rotate'?['insertCredential','retireCredential','setCurrentCredential','saveRotation','securityEvent']:['retireRelayCredentials','insertRelayCredential','saveRelayRequest','securityEvent'];
  const expected=['begin','lockNode','currentForUpdate','credential',method==='rotate'?'rotationReplay':'relayReplay',...(method==='relayCredential'?['activeRelayCredentials']:[]),'sign','credential',...writes,'commit'];
  for(const failure of ['',...expected.slice(1,-1)]){const f=fixture();f.state.fail=failure;
   if(failure){await assert.rejects(f.host[method]('node-a','old',2,'request-a',csr),e=>e===f.state.error);assert.deepEqual(f.state.writes,[]);const stop=failure==='credential'?expected.indexOf('credential'):expected.indexOf(failure);assert.deepEqual(sequence(f),[...expected.slice(0,stop+1),'rollback']);}
   else {const result=await f.host[method]('node-a','old',2,'request-a',csr);assert.deepEqual(sequence(f),expected);assert.deepEqual(f.calls.find(c=>c.name==='sign')!.args,method==='rotate'?['node-a',csr]:['node-a',csr,'relay']);assert.equal(result.validUntil,nativeNodeCodec.formatTime(method==='rotate'?500000:61000));assert.deepEqual(Object.keys(result),method==='rotate'?['certificate','ca','fingerprint','validUntil','oldCredentialUntil']:['nodeId','certificate','ca','fingerprint','validUntil','certificateNotAfter','overlapUntil']);const audit=f.calls.find(c=>c.name==='securityEvent')!;assert.equal(audit.args[3],method==='rotate'?'credential_rotation':'relay_credential_issue');assert.equal(JSON.stringify(result).includes('privateKey'),false);}
  }
 }
});

test('12 Relay authority overlap is bounded by original machine certificate lifetime and active count',async()=>{
 for(const credentialUntil of [null,1500,100000]){const f=fixture();f.state.current!.credential_until=credentialUntil;const result=await f.host.rotate('node-a','old',2,'request-a',csr);assert.equal(result.oldCredentialUntil,nativeNodeCodec.formatTime(Math.min(credentialUntil??1000,2000)));}
 for(const machineUntil of [1500,50000,800000])for(const certificateUntil of [1200,70000,900000])for(const active of [0,1]){const f=fixture();f.state.credential!.valid_until=machineUntil;f.state.active=active?[{fingerprint:'prior',valid_until:50000}]:[];
  f.options.signer.sign=async()=>({...signed,until:certificateUntil});const result=await f.host.relayCredential('node-a','old',2,'request-a',csr);const until=Math.min(machineUntil,certificateUntil,61000),overlap=Math.min(until,2000);
  assert.equal(result.validUntil,nativeNodeCodec.formatTime(until));assert.equal(result.certificateNotAfter,nativeNodeCodec.formatTime(certificateUntil));assert.equal(result.overlapUntil,active?nativeNodeCodec.formatTime(overlap):null);
  assert.deepEqual(f.calls.find(c=>c.name==='retireRelayCredentials')!.args,['node-a',overlap]);assert.deepEqual(f.calls.find(c=>c.name==='insertRelayCredential')!.args,['node-a',{...signed,until:certificateUntil},1000,until]);
 }
 for(const currentOnly of [false,true])for(const count of [0,1,2,3]){const f=fixture();f.state.relay=Array.from({length:count},(_,i)=>({fingerprint:'raw'+i,certificate:'pem'+i,valid_until:90000,retire_after:i?2500:null}));
  if(count===0||count===3)await assert.rejects(f.host.relayCredentialFacts(f.tx,'node-a',currentOnly),code('AUTHORIZATION_DENIED'));else {const result=await f.host.relayCredentialFacts(f.tx,'node-a',currentOnly);assert.deepEqual(result,f.state.relay.map(c=>({fingerprint:'sha256:'+c.fingerprint,certificate:c.certificate,validUntil:Math.min(c.valid_until,c.retire_after??c.valid_until,100000)})));for(const item of result)assert.deepEqual(Object.keys(item),['fingerprint','certificate','validUntil']);}
  assert.deepEqual(f.calls.find(c=>c.name==='relayCredentials')!.args,['node-a',1000,1000,currentOnly]);
 }
});

test('12 grant no-op change conflict revoked and exhaustion preserve visibility Runtime lock and scoped read before write and access audit',async()=>{
 const order=['isCounter','owner','scope','visible','lockNode','scopedNode','grantRevisionForUpdate'];
 for(const allowed of [false,true])for(const previous of [false,true]){const f=fixture();f.state.grant=previous;const result=await f.options.db.transaction(tx=>f.host.changeGrant(tx,'owner','scope-a','node-a','subject',1,allowed));
  assert.deepEqual(result,{nodeId:'node-a',actorId:'subject',revision:allowed===previous?1:2,allowed,changed:allowed!==previous});
  assert.deepEqual(sequence(f),['begin',...order,...(allowed?['scope']:[]),'hasGrant',...(allowed!==previous?[allowed?'insertGrant':'deleteGrant','setGrantRevision','accessAudit']:[]),'commit']);
  if(allowed!==previous)assert.deepEqual(f.calls.find(c=>c.name==='accessAudit')!.args,['scope-a','owner','subject','node_grant_change',2,{nodeId:'node-a',allowed}]);
 }
 for(const mode of ['conflict','revoked','exhausted','invisible','missing'] as const){const f=fixture();if(mode==='conflict')f.state.revision=2;if(mode==='revoked')f.state.current!.revoked=1;if(mode==='exhausted')f.state.revision=Number.MAX_SAFE_INTEGER;if(mode==='invisible')f.state.visible=false;if(mode==='missing')f.state.current=undefined;
  await assert.rejects(f.host.changeGrant(f.tx,'owner','scope-a','node-a','subject',mode==='exhausted'?Number.MAX_SAFE_INTEGER:1,true),code(mode==='conflict'?'REVISION_CONFLICT':mode==='revoked'?'AUTHORIZATION_DENIED':mode==='exhausted'?'REVISION_EXHAUSTED':'NOT_FOUND'));assert.deepEqual(f.state.writes,[]);
  if(mode==='invisible')assert.equal(f.events.includes('lockNode'),false);
 }
 for(const failure of ['owner','scope','visible','lockNode','scopedNode','grantRevisionForUpdate','hasGrant','insertGrant','setGrantRevision','accessAudit']){const f=fixture();f.state.fail=failure;await assert.rejects(f.options.db.transaction(tx=>f.host.changeGrant(tx,'owner','scope-a','node-a','subject',1,true)),e=>e===f.state.error);assert.deepEqual(f.state.writes,[]);assert.equal(f.events.at(-1),'rollback');}
 for(const allowed of [false,true]){const f=fixture();f.state.grant=allowed;f.state.revision=Number.MAX_SAFE_INTEGER;assert.equal((await f.host.changeGrant(f.tx,'owner','scope-a','node-a','subject',Number.MAX_SAFE_INTEGER,allowed)).changed,false);assert.deepEqual(f.state.writes,[]);}
 const revoked=fixture();revoked.state.current!.revoked=1;revoked.state.grant=true;assert.equal((await revoked.host.changeGrant(revoked.tx,'owner','scope-a','node-a','subject',1,false)).changed,true);
 for(const args of [['',1,true],['subject',0,true],['subject',1,'true']] as const){const f=fixture();await assert.rejects(f.host.changeGrant(f.tx,'owner','scope-a','node-a',args[0],args[1],args[2] as boolean),code('INVALID_CONFIG'));assert.deepEqual(f.events.filter(x=>x==='owner'||x==='scope'),[]);}
});

test('12 machine pool lookup credential bounds policy revision pending revocation and no-lease view retain native fields',async()=>{
 const f=fixture();assert.equal(await f.host.machine('old'),'node-a');assert.deepEqual(f.calls.find(c=>c.name==='machine')!.args,['old',1000,1000]);f.state.machine=undefined;await assert.rejects(f.host.machine('old'),code('AUTHORIZATION_DENIED'));
 for(const pair of [[10000,null],[10000,2000],[10000,1000],[1000,null]] as const){f.state.credential={valid_until:pair[0],retire_after:pair[1]};if(Math.min(pair[0],pair[1]??pair[0])<=1000)await assert.rejects(f.host.credential(f.tx,'node-a','old'),code('AUTHORIZATION_DENIED'));else assert.equal(await f.host.credential(f.tx,'node-a','old'),Math.min(pair[0],pair[1]??pair[0]));}
 f.state.current!.revoked=1;for(const maximum of [null,0,1,1000]){f.state.maximum=maximum;const result=await f.host.view('actor','scope-a','node-a');assert.equal(result.pendingRevocation,Boolean(maximum&&maximum+5000>1000));assert.equal(result.latestAuthorizationUntil,maximum?nativeNodeCodec.formatTime(maximum+5000):null);assert.deepEqual(result.credentials,[]);}
 f.state.current!.revoked=0;const {nodeId:_n,scopeId:_s,capabilities:_c,...policy}=facts;
 const updated=await f.host.storePolicy(f.tx,'node-a',{...policy,egressPolicyRevision:2},1);assert.deepEqual(updated,{...policy,egressPolicyRevision:2,nodeId:'node-a',scopeId:'scope-a',capabilities:facts.capabilities});
 await assert.rejects(f.host.storePolicy(f.tx,'node-a',{...policy,egressPolicyRevision:3},1),code('INVALID_CONFIG'));await assert.rejects(f.host.storePolicy(f.tx,'node-a',policy,2),code('REVISION_CONFLICT'));
});

test('133 intent refusal keeps Node Scope listener port native capability protocol target evaluation order and separate capability reads',()=>{
 const f=fixture(),forward:Forward={id:'forward-a',scopeId:'scope-a',revision:1,spec:{enabled:true,protocols:['tcp'],ingress:{nodeId:'node-a',listen:{address:'127.0.0.1',port:32001}},target:{host:'127.0.0.1',port:80}}};
 for(const patch of [{nodeId:'other'},{scopeId:'other'},{allowedListenerAddresses:[]},{allowedPorts:[]}]){f.clear();assert.equal(f.host.intentAllowed({...facts,...patch},forward),false);assert.deepEqual(f.events,[]);}
 for(const capabilities of [[],['adp.3'],['native.direct.v1'],['adp.3','native.direct.v1']]){f.clear();assert.equal(f.host.intentAllowed({...facts,capabilities},forward),false);assert.deepEqual(f.events,['supportsDirectRuntime']);}
 f.clear();let reads=0;const observed={...facts,get capabilities(){reads++;return facts.capabilities;}};assert.equal(f.host.intentAllowed(observed,forward),true);assert.equal(reads,3);assert.deepEqual(f.events,['supportsDirectRuntime','targetAllowed']);
 const value={toString(){return 'RAW:not-normalized';}};assert.equal(nativeNodeCodec.relayFingerprint(value as never),'sha256:RAW:not-normalized');const failure=new Error('coercion');assert.throws(()=>nativeNodeCodec.relayFingerprint({toString(){throw failure;}} as never),e=>e===failure);
});

test('12/134 native legacy constructor captures original clock defaults providers and token hash without duplicate owner',()=>{
 const original=Date.now;let clock=1234;try{Date.now=()=>clock;const owner=new Nodes({pool:{}} as never,{} as never,{} as never);Date.now=()=>9999;clock=4567;
  assert.equal(Reflect.get(owner,'now')(),4567);assert.equal(Reflect.get(owner,'overlapSeconds'),120);assert.equal(Reflect.get(owner,'relayCredentialSeconds'),86400);assert.equal(Reflect.get(owner,'codec'),nativeNodeCodec);assert.equal(Reflect.get(owner,'secrets'),nativeNodeSecrets);assert.ok(owner instanceof NodeService);assert.ok(owner instanceof NodeAuthorityHost);
 }finally{Date.now=original;}
 assert.equal(nativeNodeSecrets.newToken,newToken);assert.equal(nativeNodeSecrets.tokenHash,tokenHash);const seen=new Set<string>();for(let i=0;i<16;i++){const value=newToken();assert.match(value,/^[A-Za-z0-9_-]{43}$/);assert.equal(Buffer.from(value,'base64url').length,32);seen.add(value);}assert.equal(seen.size,16);
 for(const value of ['',token,'unicode-测试','a\n'])assert.equal(tokenHash(value),createHash('sha256').update(value).digest('hex'));
});

test('12 authorization grant and execution refusal retain scope/grant/state/network order without new authority',async()=>{
 const forward:Forward={id:'forward-a',scopeId:'scope-a',revision:1,spec:{enabled:true,protocols:['tcp'],ingress:{nodeId:'node-a',listen:{address:'127.0.0.1',port:32001}},target:{host:'127.0.0.1',port:80}}};
 for(const method of ['authorized','authorizedRelayNode'] as const)for(const mode of ['scope','grant','missing','revoked','expired','network','ok'] as const){const f=fixture();f.state.grant=mode!=='grant';if(mode==='scope')f.state.fail='scope';if(mode==='missing')f.state.current=undefined;if(mode==='revoked')f.state.current!.revoked=1;if(mode==='expired')f.state.current!.credential_until=1000;if(mode==='network')f.state.current!.facts={...facts,allowedPorts:[]};
  const invoke=()=>method==='authorized'?f.host.authorized(f.tx,'actor',forward):f.host.authorizedRelayNode(f.tx,'actor','scope-a','node-a');
  if(mode==='ok'||(method==='authorizedRelayNode'&&mode==='network'))assert.deepEqual(await invoke(),f.state.current!.facts);
  else await assert.rejects(invoke(),mode==='scope'?e=>e===f.state.error:code(mode==='grant'||mode==='missing'?'NOT_FOUND':'AUTHORIZATION_DENIED'));
  assert.deepEqual(sequence(f).slice(0,mode==='scope'?1:2),['scope',...(mode==='scope'?[]:[method==='authorized'?'scopeGrant':'relayGrant'])]);assert.deepEqual(f.state.writes,[]);
 }
 const f=fixture();f.state.grant=false;assert.equal(await f.host.canExecute(f.tx,'actor',forward),false);assert.deepEqual(sequence(f),['executing','hasGrant']);f.clear();
 f.state.grant=true;assert.equal(await f.host.canExecute(f.tx,'actor',forward),true);assert.deepEqual(sequence(f),['executing','hasGrant','state','supportsDirectRuntime','targetAllowed']);
 f.options.identity.executing=async()=>false;f.clear();assert.equal(await f.host.canExecute(f.tx,'actor',forward),false);assert.deepEqual(f.events,[]);
 await assert.rejects(f.host.cleanupFacts(f.tx,'node-a','other-scope'),code('NOT_FOUND'));f.state.current!.revoked=1;f.state.current!.credential_until=0;assert.deepEqual(await f.host.cleanupFacts(f.tx,'node-a','scope-a'),facts);
});

test('12 native policy closed fields snapshot deep immutability and exactly one revision remain original',()=>{
 const {nodeId:_n,scopeId:_s,capabilities:_c,...policy}=facts;
 const command={kind:'policy' as const,expectedRevision:1,policy:{...policy,allowedPorts:[...policy.allowedPorts],allowedListenerAddresses:[...policy.allowedListenerAddresses],allowedDestinationCidrs:[...policy.allowedDestinationCidrs]}};const frozen=snapshotNodeCommand(command);command.policy.allowedPorts[0]=9;command.policy.allowedListenerAddresses[0]='127.0.0.2';command.policy.allowedDestinationCidrs[0]='127.0.0.0/9';
 assert.deepEqual(frozen,{kind:'policy',expectedRevision:1,policy});assert.ok(Object.isFrozen(frozen));if(frozen.kind==='policy')for(const value of [frozen.policy,frozen.policy.allowedPorts,frozen.policy.allowedListenerAddresses,frozen.policy.allowedDestinationCidrs])assert.ok(Object.isFrozen(value));
 for(const invalid of [null,[],{...policy,extra:1},{...policy,allowedPorts:[]},{...policy,allowedPorts:[0]},{...policy,allowedPorts:[32001,32001]},{...policy,allowedListenerAddresses:['127.0.0.1','127.0.0.1']},{...policy,allowedDestinationCidrs:['bad']},{...policy,egressPolicyRevision:0},{...policy,allowMetadataTargets:1}])assert.throws(()=>validatePolicy(invalid as never),code('INVALID_CONFIG'));
 for(const invalid of [null,[],{kind:'revoke',extra:1},{kind:'policy',expectedRevision:0,policy},{kind:'policy',expectedRevision:1,policy,extra:1}])assert.throws(()=>snapshotNodeCommand(invalid as never),code('INVALID_CONFIG'));
 assert.deepEqual(snapshotNodeCommand({kind:'revoke'}),{kind:'revoke'});
});

test('12/134 native PKI default control and explicit Relay purpose retain P256 validation and cleanup after signing failure',{skip:!process.env.TUNEX_TEST_DATABASE_URL},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'tunex-node-owner-complete-')),run=promisify(execFile);
 const openssl=(...args:string[])=>run('openssl',args,{cwd:directory,timeout:10000});
 try{
  await openssl('req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout','ca.key','-out','ca.pem','-days','1','-subj','/CN=node-complete-ca','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign');
  await openssl('req','-new','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout','node.key','-out','node.csr','-subj','/CN=untrusted-csr-name');
  const ca=new NodeCertificateAuthority('openssl',join(directory,'ca.pem'),join(directory,'ca.key'),directory),request=await readFile(join(directory,'node.csr'),'utf8'),caText=await readFile(join(directory,'ca.pem'),'utf8');
  for(const purpose of [undefined,'control','relay'] as const){const value=await ca.sign('node-a',request,purpose),parsed=new X509Certificate(value.certificate);assert.equal(value.ca,caText);assert.equal(value.fingerprint,parsed.fingerprint256.replaceAll(':','').toLowerCase());assert.equal(value.until,Date.parse(parsed.validTo));assert.equal(parsed.subject,'CN=node-a');assert.equal(parsed.ca,false);assert.deepEqual(parsed.keyUsage,purpose==='relay'?['1.3.6.1.5.5.7.3.2','1.3.6.1.5.5.7.3.1']:['1.3.6.1.5.5.7.3.2']);assert.equal(parsed.subjectAltName,purpose==='relay'?'URI:urn:tunex:node:node-a':undefined);assert.ok(parsed.verify(new X509Certificate(caText).publicKey));assert.equal((await readdir(directory)).some(name=>name.startsWith('csr-')),false);}
  await openssl('req','-new','-newkey','rsa:2048','-nodes','-keyout','rsa.key','-out','rsa.csr','-subj','/CN=rsa');await assert.rejects(ca.sign('node-a',await readFile(join(directory,'rsa.csr'),'utf8')),code('INVALID_CONFIG','Node credentials require an ECDSA P-256 key'));
  await assert.rejects(ca.sign('node-a','-----BEGIN CERTIFICATE REQUEST-----\ninvalid'));assert.equal((await readdir(directory)).some(name=>name.startsWith('csr-')),false);
 }finally{await rm(directory,{recursive:true,force:true});}
});
