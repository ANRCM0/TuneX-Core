import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { test } from 'node:test';
import * as Core from '@tunex/core';
import * as Native from '../src/compatibility/public.ts';
import * as Http from '../src/compatibility/control-http/public.ts';
import * as Framework from '../src/framework/public.ts';
import * as Queries from '../src/modules/console-query-owner/public.ts';
import { createControlApp } from '../src/api/public.ts';
import type { ControlApi, ControlHttpOptions, ControlHttpServices } from '../src/api/public.ts';

type Route={method:string;path:string;owner:string;body:unknown;args:unknown[];limit:number;plain?:boolean;query?:boolean;bad?:unknown[]};
const prefix='/api/v1/scopes/scope-a/',actor='actor-a',key='request-key',config={opaque:true},group={groupId:'group-a'},spec={opaque:'spec'};
const routes:Route[]=[
    {method:'POST',path:'relay-plan',owner:'planRelay',body:config,args:[actor,'scope-a',config],limit:32768,plain:true},
    {method:'PUT',path:'transport-profiles/profile-a/grants/target-a',owner:'profileGrants.change',body:{allowed:false,expectedRevision:1},args:[actor,'scope-a','profile-a','target-a',key,1,false],limit:8192,bad:[{allowed:false,expectedRevision:0},{allowed:0,expectedRevision:1}]},
    {method:'PUT',path:'nodes/node-a/relay-endpoint',owner:'relayEndpoints.change',body:{config,expectedRevision:0},args:[actor,'scope-a','node-a',key,0,config],limit:8192,bad:[{config,expectedRevision:-1}]},
    {method:'PUT',path:'observation-services/service-a',owner:'observationServices.publish',body:{config,expectedRevision:0},args:[actor,'scope-a','service-a',key,0,config],limit:18432,query:true},
    {method:'DELETE',path:'observation-services/service-a',owner:'observationServices.archive',body:{expectedRevision:1},args:[actor,'scope-a','service-a',key,1],limit:2048,query:true,bad:[{expectedRevision:0}]},
    {method:'PUT',path:'ingress-groups/group-a',owner:'ingressGroups.publish',body:{config,expectedRevision:0},args:[actor,'scope-a','group-a',key,0,config],limit:8192,query:true},
    {method:'DELETE',path:'ingress-groups/group-a',owner:'ingressGroups.archive',body:{expectedRevision:1},args:[actor,'scope-a','group-a',key,1],limit:1024,query:true,bad:[{expectedRevision:0}]},
    ...['path-templates','path-groups','tunnels'].flatMap((family):Route[]=>{
        const owner=family==='path-templates'?'pathTemplates':family==='path-groups'?'pathGroups':'tunnels';
        return [
            {method:'PUT',path:family+'/item-a',owner:owner+'.publish',body:{config,expectedRevision:0},args:[actor,'scope-a','item-a',key,0,config],limit:8192,query:true,bad:[{config,expectedRevision:0.5}]},
            {method:'DELETE',path:family+'/item-a',owner:owner+'.archive',body:{expectedRevision:1},args:[actor,'scope-a','item-a',key,1],limit:family==='path-groups'?1024:8192,query:true,bad:[{expectedRevision:0}]},
        ];
    }),
    ...['ingress-deployments','ingress-migrations','path-publications'].flatMap((family):Route[]=>{
        const owner=family==='ingress-deployments'?'ingressDeployments':family==='ingress-migrations'?'ingressMigrations':'pathPublications';
        const plan=family==='ingress-migrations'?{schemaVersion:1,sourceGroup:group,targetGroup:config,sources:[],items:[]}:family==='ingress-deployments'?{schemaVersion:1,group,enabled:false,target:config,items:[]}:{schemaVersion:1,group,items:[]};
        const actions=family==='ingress-deployments'?['create','compensate']:['apply','compensate'];
        return [
            {method:'POST',path:family+'/preview',owner:owner+'.preview',body:config,args:[actor,'scope-a',config],limit:16384,query:true,plain:true},
            {method:'POST',path:family,owner:owner+'.create',body:{...plan,previewDigest:'digest-a'},args:[actor,'scope-a',key,plan,'digest-a'],limit:16384,query:true},
            ...actions.map((action):Route=>({method:'POST',path:family+'/batch-a/items/1/'+action,owner:owner+'.act',body:{expectedRevision:1},args:[actor,'scope-a','batch-a',key,1,action,1],limit:1024,query:true,bad:[{expectedRevision:0}]})),
            {method:'POST',path:family+'/batch-a/cancel',owner:owner+'.cancel',body:{expectedRevision:1},args:[actor,'scope-a','batch-a',key,1],limit:1024,query:true,bad:[{expectedRevision:0}]},
        ];
    }),
    {method:'PUT',path:'transport-profiles/profile-a',owner:'transport.publish',body:{config,expectedRevision:0},args:[actor,'scope-a','profile-a',key,0,config],limit:8192},
    {method:'PUT',path:'members/target-a',owner:'changeMember',body:{expectedRevision:1,role:'viewer',token:'secret-a'},args:[actor,'scope-a','target-a',key,{expectedRevision:1,role:'viewer',token:'secret-a'}],limit:32768,bad:[{expectedRevision:1,role:'admin'},{expectedRevision:1,role:'viewer',token:1}]},
    {method:'PUT',path:'nodes/node-a/grants/target-a',owner:'changeNodeGrant',body:{expectedRevision:1,allowed:false},args:[actor,'scope-a','node-a','target-a',key,1,false],limit:1048576},
    {method:'POST',path:'forwards',owner:'create',body:spec,args:[actor,'scope-a',key,spec],limit:1048576},
    {method:'PUT',path:'forwards/forward-a',owner:'update',body:{expectedRevision:1,spec},args:[actor,'scope-a','forward-a',key,1,spec],limit:1048576},
    {method:'DELETE',path:'forwards/forward-a',owner:'remove',body:{expectedRevision:1},args:[actor,'scope-a','forward-a',key,1],limit:1048576},
    {method:'POST',path:'operations/operation-a/retry',owner:'retry',body:{expectedRevision:1},args:[actor,'scope-a',key,'operation-a',1],limit:1048576},
    {method:'POST',path:'probe-plans/preview',owner:'probePlans.preview',body:config,args:[actor,'scope-a',config],limit:8192,query:true,plain:true},
    {method:'POST',path:'probe-plans',owner:'probePlans.create',body:config,args:[actor,'scope-a',key,config],limit:8192,query:true},
    ...['run','cancel'].map((action):Route=>({method:'POST',path:'probe-plans/plan-a/'+action,owner:'probePlans.command',body:{expectedRevision:1},args:[actor,'scope-a','plan-a',key,action,{expectedRevision:1}],limit:1024,query:true})),
    {method:'PUT',path:'notification-endpoints/endpoint-a',owner:'notificationEndpoints.publish',body:{config,destination:'https://example.test/hook',expectedRevision:0},args:[actor,'scope-a','endpoint-a',key,0,config,'https://example.test/hook'],limit:8192,query:true},
    {method:'POST',path:'notification-endpoints/endpoint-a/disable',owner:'notificationEndpoints.disable',body:{expectedRevision:1},args:[actor,'scope-a','endpoint-a',key,1],limit:1024,query:true,bad:[{expectedRevision:0}]},
    {method:'PUT',path:'alert-policies/policy-a',owner:'stationAlerts.publish',body:{config,expectedRevision:0},args:[actor,'scope-a','policy-a',key,0,config],limit:2048,query:true},
    {method:'POST',path:'alert-policies/policy-a/silence',owner:'stationAlerts.silence',body:{until:null,expectedRevision:1},args:[actor,'scope-a','policy-a',key,1,null],limit:1024,query:true,bad:[{expectedRevision:1,until:0.5},{expectedRevision:0,until:null}]},
    {method:'POST',path:'station-events/event-a/acknowledge',owner:'stationAlerts.acknowledge',body:{expectedRevision:1},args:[actor,'scope-a','event-a',key,1],limit:1024,query:true,bad:[{expectedRevision:0}]},
    {method:'POST',path:'forwards/forward-a/path-group-preview',owner:'pathGroups.preview',body:{expectedRevision:1,group},args:[actor,'scope-a','forward-a',1,group],limit:1024,query:true,plain:true},
    {method:'PUT',path:'forwards/forward-a/path-group-binding',owner:'forwards.applyGroup',body:{expectedRevision:1,group},args:[actor,'scope-a','forward-a',key,1,group],limit:1024,query:true},
    ...['path-preview','path-binding','tunnel-preview','tunnel-binding'].map((action):Route=>{
        const preview=action.endsWith('preview'),tunnel=action.startsWith('tunnel');
        return {method:preview?'POST':'PUT',path:'forwards/forward-a/'+action,owner:tunnel?(preview?'tunnels.preview':'tunnels.apply'):(preview?'pathBindings.preview':'forwards.applyPath'),body:{expectedRevision:1,template:group},args:preview?[actor,'scope-a','forward-a',1,group]:[actor,'scope-a','forward-a',key,1,group],limit:1024,query:true,plain:preview};
    }),
    {method:'POST',path:'forwards/forward-a/probe-plan',owner:'probePlans.plan',body:config,args:[actor,'scope-a','forward-a',config],limit:1024,plain:true},
    {method:'POST',path:'forwards/forward-a/probes',owner:'probes.create',body:config,args:[actor,'scope-a','forward-a',key,config],limit:1024},
    {method:'PUT',path:'nodes/node-a/policy',owner:'changeNode',body:{expectedRevision:1,policy:config},args:[actor,'scope-a','node-a',key,{kind:'policy',expectedRevision:1,policy:config}],limit:1048576},
    {method:'POST',path:'nodes/node-a/revoke',owner:'changeNode',body:{},args:[actor,'scope-a','node-a',key,{kind:'revoke'}],limit:1048576,bad:[{extra:true},[]]},
];

function fixture(route:Route){
    const trace:string[]=[],calls:unknown[][]=[],fault={stage:''};
    const reply={owner:route.owner,executionEnabled:false};
    const admit=async<T>(action:()=>Promise<T>)=>{trace.push('admit');try{return await action();}finally{trace.push('release');}};
    const control:Record<string,unknown>={identity:{authenticate:async()=>{trace.push('auth');return actor;}}},services:Record<string,unknown>={authenticateObservation:async()=>{trace.push('auth');return actor;}};
    const service=route.path.startsWith('probe-plans/')||route.path==='probe-plans'?'probePlans':route.owner.split('.')[0]!;
    const optional=['observationServices','notificationEndpoints','notificationDeliveries','stationAlerts','probeRuns','telemetry','hostTelemetry','forwardTelemetry','probeTelemetry','telemetryRollups','diagnostics','audit'].includes(service)||service==='probePlans'&&(route.path==='probe-plans'||route.path.startsWith('probe-plans/'));
    const target=optional?services:control,parts=route.owner.split('.');let parent=target;
    for(const part of parts.slice(0,-1))parent=(parent[part]??={}) as Record<string,unknown>;
    if(optional){parent.admitRequest=admit;parent.admitReadRequest=admit;}
    const fn=async function(this:unknown,...args:unknown[]){assert.equal(this,parent);trace.push('owner');calls.push(args);if(fault.stage==='owner')throw new Framework.ControlError('TEST_OWNER',409,'owner refused');return route.plain?reply:{status:202,body:reply};};
    parent[parts.at(-1)!]=fn;
    const app=createControlApp({control:control as unknown as ControlApi,runtime:{} as ControlHttpOptions['runtime'],services:services as ControlHttpServices,
        authority:{allow:async()=>{trace.push('authority');if(fault.stage==='authority')throw new Framework.ControlError('MAINTENANCE',503,'stopped');},read:async()=>({maintenance:false})}});
    const call=(body:string|Uint8Array=JSON.stringify(route.body),suffix='',headers:Record<string,string>={})=>app.request(prefix+route.path+suffix,{method:route.method,headers:{authorization:'Bearer test','idempotency-key':key,...headers},body:route.method==='GET'?null:typeof body==='string'?body:new Uint8Array(body)});
    return {call,trace,calls,fault,reply,optional};
}

for(const route of routes)test(`137 original HTTP ${route.method} ${route.path} exact dispatch byte bound and first refusal`,async()=>{
    const f=fixture(route),response=await f.call();assert.equal(response.status,route.plain?200:202);assert.deepEqual(await response.json(),f.reply);assert.deepEqual(f.calls,[route.args]);
    assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(f.trace,f.optional?['authority','admit','auth','owner','release']:['authority','auth','owner']);
    // Valid JSON padded to the inclusive byte bound must still dispatch; limit+1 refuses before JSON parsing or owner effects.
    const raw=JSON.stringify(route.body),edge=fixture(route);assert.equal((await edge.call(raw+' '.repeat(route.limit-Buffer.byteLength(raw)))).status,route.plain?200:202);assert.equal(edge.calls.length,1);
    for(const bad of ['{', '',new Uint8Array([0xc3]),'x'.repeat(route.limit+1)]){
        const g=fixture(route),result=await g.call(bad);assert.equal(result.status,typeof bad==='string'&&bad.length>route.limit?413:400);assert.equal(g.calls.length,0);assert.equal((await result.json()).code,typeof bad==='string'&&bad.length>route.limit?'RESOURCE_LIMIT':'INVALID_CONFIG');
    }
    for(const bad of route.bad??[]){const g=fixture(route),result=await g.call(JSON.stringify(bad));assert.equal(result.status,422);assert.equal(g.calls.length,0);}
    if(route.query){const g=fixture(route),result=await g.call('{','?unexpected=1');assert.equal(result.status,422);assert.equal(g.calls.length,0);}
    const denied=fixture(route);denied.fault.stage='authority';assert.equal((await denied.call('x'.repeat(route.limit+1))).status,503);assert.deepEqual(denied.trace,['authority']);
    const cookie=fixture(route);assert.equal((await cookie.call('{','',{cookie:'x'})).status,401);assert.equal(cookie.calls.length,0);
    const failed=fixture(route);failed.fault.stage='owner';const failure=await failed.call();assert.equal(failure.status,409);assert.equal((await failure.json()).code,'TEST_OWNER');assert.deepEqual(failed.calls,[route.args]);
});

const reads:[string,string,unknown[]][]=[
    ['native-drivers','nativeDrivers.list',[]],['execution-capabilities','details.capabilities',[]],
    ['forwards/forward-a/deployment','details.deployment',['forward-a']],['forwards/forward-a/revisions','details.revisions',['forward-a']],
    ['transport-profiles/profile-a/grants','transport.grants',['profile-a']],['nodes/node-a/relay-endpoint','relayEndpoints.get',['node-a']],
    ['nodes/node-a/tunnel','tunnelQueries.status',['node-a']],['nodes/node-a/tunnel/references','tunnelQueries.references',['node-a',{}]],
    ['observation-services','observationServices.list',[]],['observation-services/service-a','observationServices.get',['service-a',undefined]],
    ...['path-templates','path-groups','tunnels'].flatMap((family):[string,string,unknown[]][]=>{
        const owner=family==='path-templates'?'pathTemplateQueries':family==='path-groups'?'pathGroups':'tunnels',references=family==='path-templates'?'pathBindings':owner;
        return [[family,owner+'.list',[{}]],[family+'/item-a',owner+'.get',['item-a',undefined]],[family+'/item-a/references',references+'.references',['item-a',{}]]];
    }),
    ...['ingress-groups','ingress-deployments','ingress-migrations','path-publications'].flatMap((family):[string,string,unknown[]][]=>{
        const owner=family==='ingress-groups'?'ingressGroups':family==='ingress-deployments'?'ingressDeployments':family==='ingress-migrations'?'ingressMigrations':'pathPublications';
        return [[family,owner+'.list',[{}]],[family+'/item-a',owner+'.get',family==='ingress-groups'?['item-a',undefined]:['item-a']]];
    }),
    ['transport-profiles','transport.list',[]],['transport-profiles/profile-a','transport.get',['profile-a',undefined]],['transport-profiles/profile-a/references','transportQueries.references',['profile-a',{}]],
    ['members','identity.listMembers',[]],['nodes/node-a/grants','nodes.listGrants',['node-a']],['overview','queries.overview',[]],
    ...['nodes','forwards','operations','candidates'].map((kind):[string,string,unknown[]]=>[kind==='candidates'?'nodes/candidates':kind,'queries.'+kind,[undefined,undefined,{}]]),
    ['probe-runs','probeRuns.history',[{}]],['probe-runs/item-a','probeRuns.get',['item-a']],['probe-plans','probePlans.history',[{}]],['probe-plans/item-a','probePlans.get',['item-a']],
    ['notification-deliveries','notificationDeliveries.history',[{}]],['notification-deliveries/item-a','notificationDeliveries.get',['item-a']],
    ['notification-endpoints','notificationEndpoints.list',[]],['notification-endpoints/item-a','notificationEndpoints.get',['item-a']],
    ['alert-policies','stationAlerts.listPolicies',[]],['alert-policies/item-a','stationAlerts.getPolicy',['item-a']],['station-events','stationAlerts.history',[{}]],['station-events/item-a','stationAlerts.getEvent',['item-a']],
    ['audit-events','audit.query',[{}]],['forwards/forward-a/diagnostics','diagnostics.get',['forward-a']],
    ['forwards/forward-a/path-group-binding','pathGroups.getBinding',['forward-a']],['forwards/forward-a/path-binding','pathBindings.get',['forward-a']],['forwards/forward-a/tunnel-binding','tunnels.binding',['forward-a']],
    ['forwards/forward-a','details.forward',['forward-a']],['operations/operation-a','details.operation',['operation-a']],['nodes/node-a','nodes.view',['node-a']],['nodes/node-a/diagnostics','queries.diagnostics',['node-a']],
    ['probes/probe-a','probes.inspect',['probe-a']],
    ['nodes/node-a/telemetry','telemetry.history',['node-a',{}]],['nodes/node-a/host-telemetry','hostTelemetry.history',['node-a',{}]],['forwards/forward-a/telemetry','forwardTelemetry.history',['forward-a',{}]],['forwards/forward-a/probe-telemetry','probeTelemetry.history',['forward-a',{}]],
    ['nodes/node-a/telemetry/aggregates','telemetryRollups.history',['node','node-a',{}]],['forwards/forward-a/telemetry/aggregates','telemetryRollups.history',['forward','forward-a',{}]],['telemetry/capacity','telemetryRollups.capacity',[]],
];
for(const [path,owner,args] of reads)test(`137 original HTTP GET ${path} exact read owner receiver scope and omitted query arguments`,async()=>{
    const f=fixture({method:'GET',path,owner,args:[],body:null,plain:true,limit:0}),response=await f.call();assert.equal(response.status,200);assert.deepEqual(await response.json(),f.reply);assert.deepEqual(f.calls,[[actor,'scope-a',...args]]);
    assert.deepEqual(f.trace,f.optional?['authority','admit','auth','owner','release']:['authority','auth','owner']);
    const failed=fixture({method:'GET',path,owner,args:[],body:null,plain:true,limit:0});failed.fault.stage='owner';const error=await failed.call();assert.equal(error.status,409);assert.equal((await error.json()).code,'TEST_OWNER');assert.equal(failed.calls.length,1);
});

test('137 item position grammar is checked after body read but before owner; closed wrappers reject unknown fields',async()=>{
    for(const route of routes.filter(r=>r.path.includes('/items/1/'))){
        const maximum=route.path.startsWith('path-publications')?10:8;
        for(const position of ['0','01','-1',String(maximum+1),'1.0']){
            const f=fixture({...route,path:route.path.replace('/items/1/','/items/'+position+'/')}),result=await f.call();assert.equal(result.status,422);assert.equal(f.calls.length,0);
        }
        const f=fixture({...route,path:route.path.replace('/items/1/','/items/'+maximum+'/')});assert.equal((await f.call()).status,202);assert.equal(f.calls[0]?.at(-1),maximum);
    }
    for(const route of routes.filter(r=>r.owner!=='probePlans.command'&&typeof r.body==='object'&&r.body!==null&&'expectedRevision' in r.body)){
        const f=fixture(route),result=await f.call(JSON.stringify({...route.body as Record<string,unknown>,unknown:true}));assert.equal(result.status,422);assert.equal(f.calls.length,0);
    }
});

test('137 global request lifecycle surrounds authority and complete response while health bypasses allow only',async()=>{
    const trace:string[]=[],options:ControlHttpOptions={control:{} as ControlApi,runtime:{} as ControlHttpOptions['runtime'],
        requests:{async run<T>(action:()=>Promise<T>){trace.push('run');try{return await action();}finally{trace.push('release');}}},
        authority:{allow:async()=>{trace.push('allow');},read:async()=>{trace.push('read');return {maintenance:true};}}};
    const app=createControlApp(options);
    for(const path of ['/health','/unknown','/agent/v2/hello']){
        trace.length=0;const response=await app.request(path);assert.equal(response.headers.get('cache-control'),'no-store');
        if(path==='/health'){assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'maintenance',protocolVersion:3});assert.deepEqual(trace,['run','read','release']);}
        else {assert.equal(response.status,path==='/unknown'?404:409);const body=await response.json();assert.equal(body.code,path==='/unknown'?'NOT_FOUND':'UNSUPPORTED_PROTOCOL_VERSION');assert.match(body.requestId,/^[a-f0-9-]{36}$/);assert.equal(body.retryable,false);assert.deepEqual(trace,['run','allow','release']);}
    }
    options.requests={async run(){trace.push('refused');throw new Framework.ControlError('ADMISSION_CLOSED',503,'closed');}};trace.length=0;
    const refused=await createControlApp(options).request('/health');assert.equal(refused.status,503);assert.equal((await refused.json()).code,'ADMISSION_CLOSED');assert.deepEqual(trace,['refused']);
});

// Compile the current route module unchanged in one realm. Only external fingerprint and wire-parser effects
// are rebound; actual Hono registration/middleware/body reader/session parser/error mapping remain original.
async function machineFactory(trace:string[],fault:{stage:string},effects:Record<string,unknown>={}){
    const source=await readFile(new URL('../src/api/routes.ts',import.meta.url),'utf8');
    const parsers=['parseRuntimeMessage','parseTransitNegotiation','parseTransitDelivery','parseProbeNegotiation','parseProbeInstance','parseProbeClaim','parseProbeDelivery','parseProbeResult','parseProbeTypes','parseProbeServices','parseNodeTelemetrySample','parseForwardTelemetrySample','parseHostTelemetrySample','parseProbeTelemetrySample'];
    const native={...Native,...effects} as Record<string,unknown>;
    for(const name of parsers)native[name]=(...args:unknown[])=>{trace.push('parse:'+name);if(fault.stage==='parse')throw new Framework.ControlError('TEST_PARSE',422,'parse refused');return {parser:name,args,nodeId:'claimed-node'};};
    const modules:Record<string,unknown>={'../compatibility/public.ts':native,'../compatibility/control-http/public.ts':{...Http,nativeControlRequestFingerprint(){trace.push('fingerprint');if(fault.stage==='fingerprint')throw new Framework.ControlError('UNAUTHENTICATED',401,'certificate required');return 'fingerprint-a';}},'@tunex/core':Core,'../framework/public.ts':Framework,'../modules/console-query-owner/public.ts':Queries};
    const exports:Record<string,unknown>={};
    const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    const run=new vm.Script('(function(exports,require){'+js+'\n})').runInThisContext() as (exports:unknown,require:(name:string)=>unknown)=>void;
    run(exports,name=>{assert.ok(name in modules,name);return modules[name];});
    return exports.createControlApp as typeof createControlApp;
}

const machineRoutes=[
    ['probe/hello','probeNegotiation.hello','parseProbeNegotiation','Request',4096],['probe/instance','probeRegistry.handle','parseProbeInstance','Request',4096],
    ['probe/claim','probeClaims.handle','parseProbeClaim','Request',4096],['probe/poll','probeDelivery.poll','parseProbeDelivery','PollRequest',4096],['probe/status','probeDelivery.status','parseProbeDelivery','StatusRequest',4096],['probe/result','probeResults.handle','parseProbeResult','Request',4096],
    ['probe/types/instance','probeTypeRegistry.handle','parseProbeTypes','QualificationRequest',4096],...['poll','claim','status','result'].map(action=>['probe/types/'+action,'probeTypes.'+action,'parseProbeTypes',action[0]!.toUpperCase()+action.slice(1)+'Request',4096] as const),
    ['probe/services/instance','probeServiceRegistry.handle','parseProbeServices','QualificationRequest',4096],...['poll','claim','status','result'].map(action=>['probe/services/'+action,'probeServices.'+action,'parseProbeServices',action[0]!.toUpperCase()+action.slice(1)+'Request',4096] as const),
    ['transit/hello','transitNegotiation.hello','parseTransitNegotiation','Request',8192],['transit/report','transitDelivery.report','parseTransitDelivery','Report',8192],
    ['hello','runtime.hello','parseRuntimeMessage','HelloRequest',1048576],['report','runtime.report','parseRuntimeMessage','ReportRequest',1048576],
] as const;
for(const [path,owner,parser,kind,limit] of machineRoutes)test(`137 machine ${path} original middleware receiver session parser and body-bound ordering`,async()=>{
    const trace:string[]=[],calls:unknown[][]=[],fault={stage:''},factory=await machineFactory(trace,fault);
    const control:Record<string,unknown>={nodes:{machine:async(fingerprint:string)=>{trace.push('machine');assert.equal(fingerprint,'fingerprint-a');if(fault.stage==='machine')throw new Framework.ControlError('TEST_MACHINE',403,'machine refused');return 'node-a';}}},runtime:Record<string,unknown>={};
    const [family,method]=owner.split('.') as [string,string];const parent=family==='runtime'?runtime:(control[family]={}) as Record<string,unknown>;
    parent[method]=async function(this:unknown,...args:unknown[]){assert.equal(this,parent);trace.push('owner');calls.push(args);return {accepted:true};};
    const app=factory({control:control as unknown as ControlApi,runtime:runtime as unknown as ControlHttpOptions['runtime'],authority:{allow:async()=>{trace.push('authority');},read:async()=>({maintenance:false})}});
    const call=(body:string,suffix='',epoch='1')=>app.request('/agent/v3/'+path+suffix,{method:'POST',headers:{'x-tunex-session-epoch':epoch},body});
    const raw='{}'.padEnd(limit,' '),success=await call(raw);assert.equal(success.status,200);assert.deepEqual(trace,['authority','fingerprint','machine','parse:'+parser,'owner']);
    const parsed={parser,args:[kind,raw],nodeId:'claimed-node'};assert.deepEqual(calls,[path==='hello'?['node-a',parsed,'fingerprint-a']:['node-a','fingerprint-a',1,parsed]].map(args=>path==='report'?['node-a',1,parsed,'fingerprint-a']:args));
    for(const [body,epoch,status,expected] of [['x'.repeat(limit+1),'1',413,['authority','fingerprint','machine']],['{}','01',409,['authority','fingerprint','machine']]] as const){trace.length=0;calls.length=0;
        // Hello has no session header; all other routes parse it before reading the body.
        if(path==='hello'&&epoch==='01')continue;
        assert.equal((await call(body,'',epoch)).status,status);assert.deepEqual(trace,expected);assert.equal(calls.length,0);
    }
    for(const stage of ['fingerprint','machine','parse']){fault.stage=stage;trace.length=0;calls.length=0;const response=await call('{}');assert.equal(response.status,stage==='fingerprint'?401:stage==='machine'?403:422);assert.equal(calls.length,0);assert.deepEqual(trace,['authority','fingerprint','machine','parse:'+parser].slice(0,stage==='fingerprint'?2:stage==='machine'?3:4));}
    fault.stage='';if(path.startsWith('probe/services/')){trace.length=0;assert.equal((await call('x'.repeat(limit+1),'?x=1')).status,422);assert.deepEqual(trace,['authority']);}
});

for(const [path,service,parser,limit] of [
    ['telemetry','telemetry','parseNodeTelemetrySample',8192],['host-telemetry','hostTelemetry','parseHostTelemetrySample',8192],
    ['forward-telemetry','forwardTelemetry','parseForwardTelemetrySample',65536],['probe-telemetry','probeTelemetry','parseProbeTelemetrySample',65536],
] as const)test(`137 machine ${path} admits before certificate excludes initial Nodes lookup and parses before epoch`,async()=>{
    const trace:string[]=[],fault={stage:''},factory=await machineFactory(trace,fault),calls:unknown[][]=[];
    const owner={async admitMachineRequest<T>(action:()=>Promise<T>){assert.equal(this,owner);trace.push('admit');try{return await action();}finally{trace.push('release');}},
        async ingest(...args:unknown[]){assert.equal(this,owner);trace.push('owner');calls.push(args);return {accepted:true};}};
    const options:ControlHttpOptions={control:{nodes:{machine:async()=>assert.fail('telemetry must authenticate within its original owner transaction')}} as unknown as ControlApi,
        runtime:{} as ControlHttpOptions['runtime'],authority:{allow:async()=>{trace.push('authority');},read:async()=>({maintenance:false})},services:{[service]:owner} as ControlHttpServices};
    const app=factory(options),call=(body:string|Uint8Array,epoch='1',query='')=>app.request('/agent/v3/'+path+query,{method:'POST',headers:{'x-tunex-session-epoch':epoch},body:typeof body==='string'?body:new Uint8Array(body)});
    assert.equal((await call('{}'.padEnd(limit,' '))).status,200);assert.deepEqual(calls,[['claimed-node','fingerprint-a',1,{parser,args:[{}],nodeId:'claimed-node'}]]);assert.deepEqual(trace,['authority','admit','fingerprint','parse:'+parser,'owner','release']);
    for(const [input,epoch,query,status,parsed] of [['x'.repeat(limit+1),'1','',413,false],['{','01','',400,false],['{}','01','',409,true],['{','1','?x=1',422,false],[new Uint8Array([0xc3]),'1','',400,false]] as const){
        trace.length=0;calls.length=0;assert.equal((await call(input,epoch,query)).status,status);assert.equal(calls.length,0);assert.deepEqual(trace,['authority','admit','fingerprint',...(parsed?['parse:'+parser]:[]),'release']);
    }
    options.services={};trace.length=0;assert.equal((await factory(options).request('/agent/v3/'+path,{method:'POST',body:'x'.repeat(limit+1)})).status,503);assert.deepEqual(trace,['authority']);
});

test('137 Transit boot header precedes epoch and owner; snapshot keeps epoch before owner and enrollment preserves closed bound',async()=>{
    const trace:string[]=[],fault={stage:''},factory=await machineFactory(trace,fault),calls:unknown[][]=[];
    const control={nodes:{async machine(){trace.push('machine');return 'node-a';},async enroll(...args:unknown[]){trace.push('enroll');calls.push(args);return {enrolled:true};}},
        transitDelivery:{async poll(...args:unknown[]){trace.push('poll');calls.push(args);return {ok:true};}}};
    const runtime={async snapshot(...args:unknown[]){trace.push('snapshot');calls.push(args);return {ok:true};}};
    const app=factory({control:control as unknown as ControlApi,runtime:runtime as unknown as ControlHttpOptions['runtime'],authority:{allow:async()=>{trace.push('authority');},read:async()=>({maintenance:false})}});
    for(const headers of [{},{'x-tunex-boot-id':'bad value'},{'x-tunex-boot-id':'boot-a'}]){
        trace.length=0;const response=await app.request('/agent/v3/transit/command',{headers});assert.equal(response.status,headers['x-tunex-boot-id']==='boot-a'?409:422);assert.deepEqual(trace,['authority','fingerprint','machine']);assert.equal(calls.length,0);
    }
    assert.equal((await app.request('/agent/v3/transit/command',{headers:{'x-tunex-boot-id':'boot-a','x-tunex-session-epoch':'2'}})).status,200);assert.deepEqual(calls.pop(),['node-a','fingerprint-a',2,'boot-a']);
    assert.equal((await app.request('/agent/v3/snapshot',{headers:{'x-tunex-session-epoch':'2'}})).status,200);assert.deepEqual(calls.pop(),['node-a',2,'fingerprint-a']);
    for(const [body,status] of [[JSON.stringify({csr:'CSR',nodeId:'node-a',token:'secret'}).padEnd(32768,' '),200],['x'.repeat(32769),413],['{',400],[JSON.stringify({csr:'CSR',nodeId:'node-a',token:'secret',extra:1}),422]] as const){
        trace.length=0;const response=await app.request('/enrollment/v1',{method:'POST',body});assert.equal(response.status,status);assert.deepEqual(trace,status===200?['authority','enroll']:['authority']);if(status===200)assert.deepEqual(calls.pop(),['node-a','secret','CSR']);else assert.equal(calls.length,0);
    }
});

test('137 both credential machine routes preserve body before epoch field errors and exact rotation arguments',async()=>{
    const trace:string[]=[],fault={stage:''},factory=await machineFactory(trace,fault),calls:unknown[][]=[];
    const nodes={async machine(){trace.push('machine');return 'node-a';},async rotate(...args:unknown[]){calls.push(['rotate',...args]);return {rotated:true};},async relayCredential(...args:unknown[]){calls.push(['relay',...args]);return {rotated:true};}};
    const app=factory({control:{nodes} as unknown as ControlApi,runtime:{} as ControlHttpOptions['runtime'],authority:{allow:async()=>{},read:async()=>({maintenance:false})}});
    for(const [path,method] of [['credentials/rotate','rotate'],['relay-credential','relay']] as const){
        for(const [raw,epoch,status] of [[JSON.stringify({csr:'CSR',requestId:'request-a'}).padEnd(32768,' '),'2',200],['x'.repeat(32769),'01',413],['{','01',400],[JSON.stringify({csr:1,requestId:'request-a'}),'01',422],[JSON.stringify({csr:'CSR',requestId:'request-a',extra:1}),'2',422],[JSON.stringify({csr:'CSR',requestId:'request-a'}),'01',409]] as const){
            calls.length=0;const response=await app.request('/agent/v3/'+path,{method:'POST',headers:{'x-tunex-session-epoch':epoch},body:raw});assert.equal(response.status,status);assert.deepEqual(calls,status===200?[[method,'node-a','fingerprint-a',2,'request-a','CSR']]:[]);
        }
    }
});

test('137 Node provisioning observation and Probe withdrawal preserve original status signal and projection',async()=>{
    const calls:unknown[][]=[],signal=new AbortController(),withdrawn=1800000000000;
    const control={identity:{async authenticate(){return actor;}},nodes:{async provision(...args:unknown[]){calls.push(['provision',...args]);return {nodeId:'created'};}},
        observations:{async observe(...args:unknown[]){calls.push(['observe',...args]);return {observed:true};}},
        probes:{async revoke(...args:unknown[]){calls.push(['revoke',...args]);return {id:'probe-a',state:'withdrawn',withdrawnAt:withdrawn};}}};
    const app=createControlApp({control:control as unknown as ControlApi,runtime:{} as ControlHttpOptions['runtime'],authority:{allow:async()=>{},read:async()=>({maintenance:false})}});
    const provision=await app.request(prefix+'nodes',{method:'POST',body:'{}'.padEnd(1048576,' ')});assert.equal(provision.status,201);assert.deepEqual(calls.pop(),['provision',actor,'scope-a',{}]);
    assert.equal((await app.request(prefix+'nodes',{method:'POST',body:'x'.repeat(1048577)})).status,413);assert.equal(calls.length,0);
    const raw=new Request('http://localhost'+prefix+'nodes/node-a/observations',{method:'POST',body:'{}'.padEnd(1024,' '),signal:signal.signal});
    assert.equal((await app.request(raw)).status,200);assert.deepEqual(calls.pop(),['observe',actor,'scope-a','node-a',{},raw.signal]);
    assert.equal((await app.request(prefix+'nodes/node-a/observations',{method:'POST',body:'x'.repeat(1025)})).status,413);assert.equal(calls.length,0);
    const revoke=await app.request(prefix+'probes/probe-a/revoke',{method:'POST',body:'{}'.padEnd(1024,' ')});assert.equal(revoke.status,200);assert.deepEqual(await revoke.json(),{probeId:'probe-a',state:'withdrawn',executionEnabled:false,withdrawnAt:new Date(withdrawn).toISOString()});assert.deepEqual(calls.pop(),['revoke',actor,'scope-a','probe-a']);
    for(const [body,status] of [['[]',422],['null',422],['{"extra":1}',422],['x'.repeat(1025),413],['{',400]] as const){assert.equal((await app.request(prefix+'probes/probe-a/revoke',{method:'POST',body})).status,status);assert.equal(calls.length,0);}
});

test('137 every registered Console asset dispatches its exact native name with original security and media headers',async()=>{
    const trace:string[]=[],fault={stage:''},names:string[]=[],factory=await machineFactory(trace,fault,{async nativeControlConsoleAsset(name:string){names.push(name);return 'native:'+name;}});
    const options:ControlHttpOptions={control:{} as ControlApi,runtime:{} as ControlHttpOptions['runtime'],authority:{allow:async()=>{},read:async()=>({maintenance:false})}};
    const app=factory(options),original=createControlApp(options);
    const assets=['app.js','model.js','console-model-owner/public.js','console-model-owner/service.js','browser-native/public.js','console-request-owner/public.js','console-request-owner/service.js','rule-command-owner/public.js','rule-command-owner/service.js','browser-native/rule-console.js','browser-native/control-console.js','browser-native/relay-forms.js','browser-native/relay-console.js','relay-model.js','relay.js','probe.js','transport-console.js','rule-console.js','tunnel-console.js','path-templates.js','observation-services.js','path-groups.js','path-publications.js','ingress-groups.js','ingress-migrations.js','forward-diagnostics.js','audit-console.js','station-alerts.js','notification-endpoints.js','notification-deliveries.js','probe-runs.js','probe-plans.js','telemetry-console.js','forward-telemetry-console.js','host-telemetry-console.js','probe-telemetry-console.js','telemetry-aggregate-console.js','style.css'];
    for(const path of ['','/',...assets.map(name=>'/'+name)]){
        const response=await app.request('/console'+path),name=path===''||path==='/'?'index.html':path.slice(1);assert.equal(response.status,200);assert.equal(await response.text(),'native:'+name);assert.equal(names.pop(),name);assert.equal(names.length,0);
        assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('x-frame-options'),'DENY');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('content-security-policy'),"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
        assert.match(response.headers.get('content-type')??'',name==='index.html'?/^text\/html/:name.endsWith('.css')?/^text\/css/:/^text\/javascript/);
        const actual=await original.request('/console'+path);assert.equal(actual.status,200);assert.equal(await actual.text(),await readFile(new URL('../../web/'+name,import.meta.url),'utf8'));
    }
});

test('137 request ID precedes lifecycle admission and native request abort does not release the actual admitted action',async()=>{
    const trace:string[]=[],factory=await machineFactory(trace,{stage:''},{nativeRequestId(){trace.push('requestId');return '00000000-0000-4000-8000-000000000001';}});
    const requests=new Framework.RequestLifecycle();let enter!:()=>void,finish!:()=>void;
    const entered=new Promise<void>(resolve=>{enter=resolve;}),pending=new Promise<void>(resolve=>{finish=resolve;});
    const control={identity:{async authenticate(){return actor;}},observations:{async observe(...args:unknown[]){trace.push('owner');assert.equal((args.at(-1) as AbortSignal).aborted,false);enter();await pending;trace.push('settled');return {ok:true};}}};
    const app=factory({control:control as unknown as ControlApi,runtime:{} as ControlHttpOptions['runtime'],authority:{allow:async()=>{trace.push('allow');},read:async()=>({maintenance:false})},
        requests:{run:action=>{trace.push('run');return requests.run(action);}}});
    const abort=new AbortController(),raw=new Request('http://localhost'+prefix+'nodes/node-a/observations',{method:'POST',body:'{}',signal:abort.signal});
    const response=app.request(raw);await entered;abort.abort();assert.equal(raw.signal.aborted,true);requests.stopAdmission();let drained=false;
    const closing=requests.drain().then(()=>{drained=true;});await Promise.resolve();await Promise.resolve();assert.equal(drained,false);assert.deepEqual(trace,['requestId','run','allow','owner']);
    finish();assert.equal((await response).status,200);await closing;assert.equal(drained,true);assert.deepEqual(trace,['requestId','run','allow','owner','settled']);
    const refused=await app.request('/unknown');assert.equal(refused.status,503);const error=await refused.json();assert.equal(error.requestId,'00000000-0000-4000-8000-000000000001');assert.deepEqual(trace.slice(-2),['requestId','run']);
});
