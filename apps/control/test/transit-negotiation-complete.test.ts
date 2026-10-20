import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TLSSocket } from 'node:tls';
import { createApp } from '../src/api/app.ts';
import { TransitNegotiator } from '../src/modules/runtime/transit-negotiation.ts';
import { TransitNegotiationService } from '../src/modules/transit-owner/public.ts';
import { MySqlTransitMachineReader } from '../src/infrastructure/mysql-transit-machine.ts';
import { TRANSIT_NEGOTIATION_CAPABILITIES, nativeTransitNegotiationAck } from '../src/compatibility/public.ts';
import { TRANSIT_NEGOTIATION_CAPABILITIES as wireCapabilities } from '@tunex/contracts/experimental/transit';
import { ControlError } from '../src/framework/public.ts';
import type { LockedMachineSession } from '../src/framework/public.ts';
import type { TransitNegotiationRequest } from '../src/compatibility/public.ts';
import type { Transaction, MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';

const fingerprint='a'.repeat(64),now=1800000000000;
const request=():TransitNegotiationRequest=>({protocolVersion:3,extensionVersion:1,nodeId:'node',bootId:'boot',sessionEpoch:2,requiredCapabilities:TRANSIT_NEGOTIATION_CAPABILITIES,lastStoredTransitGeneration:0});
const machine=():LockedMachineSession=>({session_epoch:2,boot_id:'boot',node_revoked:0,credential_revoked:0,credential_until:now+10,valid_until:now+20,retire_after:null,facts:{capabilities:[...wireCapabilities]}});
const code=(expected:string)=>(error:unknown)=>error instanceof ControlError&&error.code===expected;

test('62 negotiation keeps legacy construction subclass lazy database access and exact native lock raw row query without I/O',async()=>{
 const events:unknown[][]=[],row=machine(),second=machine();let result:unknown[]=[row,second];
 const tx={async execute(this:unknown,sql:string,args:unknown[]){assert.equal(this,tx);events.push([sql,args]);return [result,[]];}} as unknown as Transaction;
 const db={async transaction<T>(action:(tx:Transaction)=>Promise<T>){assert.equal(this,db);return action(tx);}} as unknown as MySqlUnitOfWork;
 class Subclass extends TransitNegotiator { override async hello(...args:Parameters<TransitNegotiator['hello']>){return super.hello(...args);} }
 const legacy=new Subclass(db);assert.equal(TransitNegotiator.length,1);assert.equal(TransitNegotiationService.length,2);assert.equal((legacy as unknown as {db:unknown}).db,db);assert.equal(events.length,0);
 assert.equal(Object.hasOwn(TransitNegotiator.prototype,'hello'),true);assert.equal(TransitNegotiator.prototype.hello.constructor.name,'AsyncFunction');
 const reader=new MySqlTransitMachineReader();assert.equal(await reader.read(tx,'node',fingerprint),row);
 assert.deepEqual(events,[['SELECT r.session_epoch,r.boot_id,n.revoked node_revoked,n.credential_until,n.facts,\n          c.revoked credential_revoked,c.valid_until,c.retire_after\n         FROM runtime_nodes r\n         JOIN nodes n ON n.id=r.node_id\n         LEFT JOIN node_credentials c ON c.node_id=r.node_id AND c.fingerprint=?\n         WHERE r.node_id=? FOR UPDATE',[fingerprint,'node']]]);
 assert.equal(row.facts,(result[0] as LockedMachineSession).facts);result=[];assert.equal(await reader.read(tx,'node',fingerprint),undefined);
 const failure=new Error('SQL');const broken={async execute(){throw failure;}} as unknown as Transaction;await assert.rejects(reader.read(broken,'node',fingerprint),e=>e===failure);
 // An explicit reader is required; construction itself never probes or opens a connection.
 const service=new TransitNegotiationService(db,undefined as never);await assert.rejects(service.hello('node',fingerprint,2,request()),TypeError);
});

test('62 owner preserves ordered session credential raw JSON capability history refusals one dynamic clock mutable ACK and rollback',async t=>{
 const events:string[]=[],tx={},failure=new Error('provider');let selected:LockedMachineSession|undefined=machine(),clock=now,readFailure=false,clockFailure=false;
 const db={async transaction<T>(action:(value:typeof tx)=>Promise<T>){assert.equal(this,db);events.push('begin');try{const value=await action(tx);events.push('commit');return value;}catch(error){events.push('rollback');throw error;}}};
 const reader={async read(actual:typeof tx,node:string,fp:string){assert.equal(this,reader);assert.equal(actual,tx);assert.equal(node,'node');assert.equal(fp,fingerprint);events.push('read');if(readFailure)throw failure;return selected;}};
 const owner=new TransitNegotiationService(db,reader);t.mock.method(Date,'now',()=>{events.push('clock');if(clockFailure)throw failure;return clock;});
 const invoke=(body=request(),fp=fingerprint,epoch=2)=>owner.hello('node',fp,epoch,body);
 async function refusal(change:Partial<LockedMachineSession>|undefined,expected:string,body=request(),suffix=['begin','read','clock','rollback']){events.length=0;selected=change===undefined?undefined:{...machine(),...change};await assert.rejects(invoke(body),code(expected));assert.deepEqual(events,suffix);}
 for(const epoch of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){events.length=0;await assert.rejects(invoke({...request(),sessionEpoch:epoch},'bad',epoch),code('SESSION_SUPERSEDED'));assert.deepEqual(events,[]);}
 for(const body of [{...request(),nodeId:'other'},{...request(),sessionEpoch:3}]){await assert.rejects(invoke(body,'bad'),code('SESSION_SUPERSEDED'));assert.deepEqual(events,[]);}
 for(const fp of ['', 'A'.repeat(64),'a'.repeat(63),'a'.repeat(65)]){await assert.rejects(invoke(request(),fp),code('AUTHORIZATION_DENIED'));assert.deepEqual(events,[]);}
 for(const change of [undefined,{session_epoch:3},{boot_id:null},{boot_id:'old',node_revoked:1,facts:'{'}])await refusal(change,'SESSION_SUPERSEDED',request(),['begin','read','rollback']);
 for(const change of [{node_revoked:1},{credential_revoked:1},{credential_revoked:null},{valid_until:null},{valid_until:0},{valid_until:now},{valid_until:now-1},{retire_after:0},{retire_after:now},{retire_after:now-1},{credential_until:null},{credential_until:0},{credential_until:now},{credential_until:now-1}])await refusal({...change,facts:'{'},'AUTHORIZATION_DENIED',{...request(),lastStoredTransitGeneration:1});
 for(const facts of [null,undefined,{}, {capabilities:null},{capabilities:'transit'}, {capabilities:[]},JSON.stringify({capabilities:wireCapabilities.slice(1)})])await refusal({facts},'UNSUPPORTED_CAPABILITY',{...request(),lastStoredTransitGeneration:1});
 await refusal({},'FENCING_REJECTED',{...request(),lastStoredTransitGeneration:1});
 // Values are read as stored: no boolean normalization or extra parser is inserted.
 await refusal({credential_revoked:false as unknown as number},'AUTHORIZATION_DENIED');
 selected={...machine(),node_revoked:null as unknown as number,retire_after:now+1};events.length=0;const first=await invoke();assert.deepEqual(events,['begin','read','clock','commit']);
 assert.equal(TRANSIT_NEGOTIATION_CAPABILITIES,wireCapabilities);assert.equal(first.requiredCapabilities,wireCapabilities);assert.equal(Object.isFrozen(first),false);assert.equal(Object.isFrozen(wireCapabilities),false);
 assert.deepEqual(Object.keys(first),['protocolVersion','extensionVersion','nodeId','bootId','sessionEpoch','requiredCapabilities','serverTime','state','executionEnabled']);assert.deepEqual(first,nativeTransitNegotiationAck('node','boot',2,now));assert.equal(first.serverTime,new Date(now).toISOString());assert.equal(first.executionEnabled,false);assert.equal(first.state,'contract-only');
 (first as unknown as {state:string}).state='caller mutation';assert.equal(first.state,'caller mutation');assert.equal((await invoke({...request(),protocolVersion:99} as unknown as TransitNegotiationRequest)).protocolVersion,3,'owner does not introduce a response/request parser');
 const tuple=wireCapabilities as unknown as string[];tuple.push('test-only-capability');try{assert.equal(first.requiredCapabilities.at(-1),'test-only-capability');selected={...machine(),facts:{capabilities:[...tuple]}};clock=now+1;assert.equal((await invoke()).serverTime,new Date(now+1).toISOString());}finally{tuple.pop();}clock=now;
 // Defer JSON parsing until after credential checks and retain includes receiver/traversal.
 const nativeParse=JSON.parse;let parseCalls=0;t.mock.method(JSON,'parse',(...args:Parameters<typeof JSON.parse>)=>{parseCalls++;events.push('json');return nativeParse(...args);});
 selected={...machine(),facts:JSON.stringify({capabilities:wireCapabilities})};events.length=0;await invoke();assert.equal(parseCalls,1);assert.deepEqual(events,['begin','read','clock','json','commit']);
 const caps=[...wireCapabilities];Object.defineProperty(caps,'includes',{value:function(this:unknown,value:unknown){assert.equal(this,caps);events.push('includes:'+String(value));return Array.prototype.includes.call(this,value);}});selected={...machine(),facts:{capabilities:caps}};events.length=0;await invoke();assert.deepEqual(events,['begin','read','clock',...wireCapabilities.map(cap=>'includes:'+cap),'commit']);
 for(let missing=0;missing<wireCapabilities.length;missing++){const partial=[...wireCapabilities].filter((_,index)=>index!==missing);Object.defineProperty(partial,'includes',{value:function(value:unknown){events.push('includes:'+String(value));return Array.prototype.includes.call(this,value);}});selected={...machine(),facts:{capabilities:partial}};events.length=0;await assert.rejects(invoke({...request(),lastStoredTransitGeneration:1}),code('UNSUPPORTED_CAPABILITY'));assert.deepEqual(events,['begin','read','clock',...wireCapabilities.slice(0,missing+1).map(cap=>'includes:'+cap),'rollback']);}
 for(const mode of ['sql','clock','json','formatter'] as const){events.length=0;selected=machine();readFailure=mode==='sql';clockFailure=mode==='clock';if(mode==='json')selected.facts='{';if(mode==='formatter')clock=NaN;await assert.rejects(invoke(),mode==='sql'||mode==='clock'?(e:unknown)=>e===failure:mode==='json'?SyntaxError:RangeError);assert.equal(events.at(-1),'rollback');assert.equal(events.includes('commit'),false);assert.equal(events.filter(e=>e==='read').length,1);readFailure=false;clockFailure=false;clock=now;}
});

test('62 HTTP binds verified TLS fingerprint to server Node before strict Transit request parsing and owner invocation',async()=>{
 const events:string[]=[],socket=Object.create(TLSSocket.prototype) as TLSSocket;Object.defineProperty(socket,'authorized',{value:true});Object.defineProperty(socket,'getPeerCertificate',{value(){events.push('certificate');return {fingerprint256:'AA:'.repeat(31)+'AA'};}});
 const control={nodes:{async machine(fp:string){events.push('machine');assert.equal(fp,'a'.repeat(64));return 'server-node';}},transitNegotiation:{async hello(node:string,fp:string,epoch:number,input:TransitNegotiationRequest){events.push('owner');assert.equal(node,'server-node');assert.equal(fp,'a'.repeat(64));assert.equal(epoch,2);assert.equal(input.nodeId,'node');assert.equal(Object.isFrozen(input),true);return {opaque:'owner output'};}}};
 const app=createApp(control as never,{} as never,{async allow(){events.push('admit');}} as never),env={incoming:{socket}};
 async function post(body:unknown){return app.fetch(new Request('http://local/agent/v3/transit/hello',{method:'POST',headers:{'content-type':'application/json','x-tunex-session-epoch':'2'},body:JSON.stringify(body)}),env as never);}
 let response=await post(request());assert.equal(response.status,200);assert.deepEqual(await response.json(),{opaque:'owner output'});assert.deepEqual(events,['admit','certificate','machine','owner']);
 events.length=0;response=await post({...request(),unknown:true});assert.equal(response.status,422);assert.deepEqual(events,['admit','certificate','machine']);
});
