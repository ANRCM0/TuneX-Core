import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as Core from '@tunex/core';
import * as Native from '../src/compatibility/public.ts';
import * as Http from '../src/compatibility/control-http/public.ts';
import * as Framework from '../src/framework/public.ts';
import * as Queries from '../src/modules/console-query-owner/public.ts';
import { createControlApp } from '../src/api/public.ts';
import type { ControlApi, ControlHttpOptions } from '../src/api/public.ts';
import { ControlError } from '../src/framework/public.ts';

type Invocation={owner:string;receiver:unknown;args:unknown[]};

// This is a complete independent provider. Every required member is written out:
// a newly required public method fails compilation instead of being hidden by a
// partial-record assertion. Unselected methods deliberately fail when dispatched.
function provider(factory=createControlApp){
    const calls:Invocation[]=[],trace:string[]=[],fault={owner:false,authority:false};
    function refuse(owner:string){return async function(this:unknown,...args:unknown[]):Promise<never>{
        called(owner,this,args);throw new ControlError('SUBSTITUTE_REFUSED',409,'independent provider refused');
    };}
    function called(owner:string,receiver:unknown,args:unknown[]){
        calls.push({owner,receiver,args});trace.push(owner);
        if(fault.owner)throw new ControlError('SUBSTITUTE_REFUSED',409,'independent provider refused');
    }
    const control={
        async create(...args){called('create',this,args);return {status:202 as const,body:{forwardId:'forward-a',revision:2,operationId:null}};},
        update:refuse('update'),remove:refuse('remove'),retry:refuse('retry'),planRelay:refuse('planRelay'),classifyOwner:refuse('classifyOwner'),
        changeMember:refuse('changeMember'),changeNodeGrant:refuse('changeNodeGrant'),changeNode:refuse('changeNode'),
        identity:{
            async authenticate(...args){called('identity.authenticate',this,args);return 'actor-a';},
            async listMembers(...args){called('identity.listMembers',this,args);return {members:[]};},
            context:refuse('identity.context'),
        },
        nodes:{
            async machine(...args){called('nodes.machine',this,args);return 'node-a';},
            async enroll(...args){called('nodes.enroll',this,args);return {certificate:'certificate-a',ca:'ca-a'};},
            async provision(...args){called('nodes.provision',this,args);return {nodeId:'node-a',enrollmentToken:'token-a',expiresAt:'2026-10-20T00:10:00.000Z'};},
            async listGrants(...args){called('nodes.listGrants',this,args);return {nodeId:'node-a',revision:2,actorIds:['actor-a'],grants:[{actorId:'actor-a',allowedRoles:null,portLimits:null}]};},
            async view(...args){called('nodes.view',this,args);return {detail:'full' as const,resourceSource:'private' as const,ownerActorId:'actor-a',resourceRevision:1,nodeId:'node-a',scopeId:'scope-a',policy:null,revoked:false,pendingRevocation:true,latestAuthorizationUntil:null,credentials:[]};},
            provisionShared:refuse('nodes.provisionShared'),portUsage:refuse('nodes.portUsage'),
            rotate:refuse('nodes.rotate'),relayCredential:refuse('nodes.relayCredential'),
        },
        resourceLimits:{get:refuse('resourceLimits.get'),set:refuse('resourceLimits.set')},
        transport:{publish:refuse('transport.publish'),get:refuse('transport.get'),async list(...args){called('transport.list',this,args);return {profiles:[],executionSupported:false};},grants:refuse('transport.grants')},
        relayEndpoints:{change:refuse('relayEndpoints.change'),get:refuse('relayEndpoints.get')},
        details:{
            async capabilities(...args){called('details.capabilities',this,args);return {multihopEnabled:false,maxPathNodes:8 as const,executionExtension:1 as const,probeIssuanceEnabled:false,probeIngressIssuanceEnabled:false,probeServicesIssuanceEnabled:false};},
            async deployment(...args){called('details.deployment',this,args);return {deployment:null};},
            async revisions(...args){called('details.revisions',this,args);return {revisions:[{revision:2,spec:null},{revision:1,spec:'raw-spec'}]};},
            forward:refuse('details.forward'),operation:refuse('details.operation'),
        },
        queries:{
            async nodes(...args){called('queries.nodes',this,args);return {page:1,limit:25,total:0,items:[]};},
            forwards:refuse('queries.forwards'),operations:refuse('queries.operations'),candidates:refuse('queries.candidates'),overview:refuse('queries.overview'),diagnostics:refuse('queries.diagnostics'),
        },
        nativeDrivers:{list:refuse('nativeDrivers.list')},transportQueries:{references:refuse('transportQueries.references')},tunnelQueries:{status:refuse('tunnelQueries.status'),references:refuse('tunnelQueries.references')},
        pathTemplates:{publish:refuse('pathTemplates.publish'),archive:refuse('pathTemplates.archive'),classifyOwner:refuse('pathTemplates.classifyOwner')},pathTemplateQueries:{list:refuse('pathTemplateQueries.list'),get:refuse('pathTemplateQueries.get')},
        pathBindings:{get:refuse('pathBindings.get'),preview:refuse('pathBindings.preview'),references:refuse('pathBindings.references')},forwards:{applyPath:refuse('forwards.applyPath'),applyGroup:refuse('forwards.applyGroup')},
        tunnels:{list:refuse('tunnels.list'),get:refuse('tunnels.get'),publish:refuse('tunnels.publish'),archive:refuse('tunnels.archive'),binding:refuse('tunnels.binding'),preview:refuse('tunnels.preview'),references:refuse('tunnels.references'),apply:refuse('tunnels.apply')},
        pathGroups:{list:refuse('pathGroups.list'),get:refuse('pathGroups.get'),publish:refuse('pathGroups.publish'),archive:refuse('pathGroups.archive'),getBinding:refuse('pathGroups.getBinding'),preview:refuse('pathGroups.preview'),references:refuse('pathGroups.references'),classifyOwner:refuse('pathGroups.classifyOwner')},
        pathPublications:{preview:refuse('pathPublications.preview'),create:refuse('pathPublications.create'),get:refuse('pathPublications.get'),list:refuse('pathPublications.list'),act:refuse('pathPublications.act'),cancel:refuse('pathPublications.cancel')},
        ingressGroups:{list:refuse('ingressGroups.list'),get:refuse('ingressGroups.get'),publish:refuse('ingressGroups.publish'),archive:refuse('ingressGroups.archive'),classifyOwner:refuse('ingressGroups.classifyOwner')},
        ingressDeployments:{preview:refuse('ingressDeployments.preview'),create:refuse('ingressDeployments.create'),get:refuse('ingressDeployments.get'),list:refuse('ingressDeployments.list'),act:refuse('ingressDeployments.act'),cancel:refuse('ingressDeployments.cancel')},
        ingressMigrations:{preview:refuse('ingressMigrations.preview'),create:refuse('ingressMigrations.create'),get:refuse('ingressMigrations.get'),list:refuse('ingressMigrations.list'),act:refuse('ingressMigrations.act'),cancel:refuse('ingressMigrations.cancel')},
        observations:{observe:refuse('observations.observe')},profileGrants:{change:refuse('profileGrants.change')},probePlans:{plan:refuse('probePlans.plan')},
        probeCapabilities:{get:refuse('probeCapabilities.get')},
        probes:{create:refuse('probes.create'),inspect:refuse('probes.inspect'),revoke:refuse('probes.revoke')},probeNegotiation:{hello:refuse('probeNegotiation.hello')},probeRegistry:{handle:refuse('probeRegistry.handle')},
        probeClaims:{handle:refuse('probeClaims.handle')},probeDelivery:{poll:refuse('probeDelivery.poll'),status:refuse('probeDelivery.status')},probeResults:{handle:refuse('probeResults.handle')},
        probeTypeRegistry:{handle:refuse('probeTypeRegistry.handle')},probeTypes:{poll:refuse('probeTypes.poll'),claim:refuse('probeTypes.claim'),status:refuse('probeTypes.status'),result:refuse('probeTypes.result')},
        probeServiceRegistry:{handle:refuse('probeServiceRegistry.handle')},probeServices:{poll:refuse('probeServices.poll'),claim:refuse('probeServices.claim'),status:refuse('probeServices.status'),result:refuse('probeServices.result')},
        transitNegotiation:{hello:refuse('transitNegotiation.hello')},transitDelivery:{poll:refuse('transitDelivery.poll'),report:refuse('transitDelivery.report')},
    } satisfies ControlApi;
    const runtime={hello:refuse('runtime.hello'),snapshot:refuse('runtime.snapshot'),report:refuse('runtime.report')} satisfies ControlHttpOptions['runtime'];
    const options={control,runtime,
        requests:{async run<T>(action:()=>Promise<T>){trace.push('request');try{return await action();}finally{trace.push('drain');}}},
        authority:{async allow(){trace.push('allow');if(fault.authority)throw new ControlError('MAINTENANCE',503,'maintenance');},async read(){trace.push('read');return {maintenance:false};}},
    } satisfies ControlHttpOptions;
    return {control,runtime,options,app:factory(options),calls,trace,fault};
}

test('23 complete independently declared ControlApi substitutes through real HTTP with original receivers arguments DTOs and request lifetime',async()=>{
    const cases:[string,string,unknown,string,unknown[],unknown,number][]=[
        ['GET','members',undefined,'identity.listMembers',['actor-a','scope-a'],{members:[]},200],
        ['GET','nodes/node-a/grants',undefined,'nodes.listGrants',['actor-a','scope-a','node-a'],{nodeId:'node-a',revision:2,actorIds:['actor-a'],grants:[{actorId:'actor-a',allowedRoles:null,portLimits:null}]},200],
        ['GET','nodes/node-a',undefined,'nodes.view',['actor-a','scope-a','node-a'],{detail:'full',resourceSource:'private',ownerActorId:'actor-a',resourceRevision:1,nodeId:'node-a',scopeId:'scope-a',policy:null,revoked:false,pendingRevocation:true,latestAuthorizationUntil:null,credentials:[]},200],
        ['GET','transport-profiles',undefined,'transport.list',['actor-a','scope-a'],{profiles:[],executionSupported:false},200],
        ['GET','execution-capabilities',undefined,'details.capabilities',['actor-a','scope-a'],{multihopEnabled:false,maxPathNodes:8,executionExtension:1,probeIssuanceEnabled:false,probeIngressIssuanceEnabled:false,probeServicesIssuanceEnabled:false},200],
        ['GET','forwards/forward-a/deployment',undefined,'details.deployment',['actor-a','scope-a','forward-a'],{deployment:null},200],
        ['GET','forwards/forward-a/revisions',undefined,'details.revisions',['actor-a','scope-a','forward-a'],{revisions:[{revision:2,spec:null},{revision:1,spec:'raw-spec'}]},200],
        ['GET','nodes',undefined,'queries.nodes',['actor-a','scope-a',undefined,undefined,{}],{page:1,limit:25,total:0,items:[]},200],
        ['POST','forwards',{arbitrary:'unchanged'},'create',['actor-a','scope-a','key-a',Object.assign(Object.create(null),{arbitrary:'unchanged'})],{forwardId:'forward-a',revision:2,operationId:null},202],
    ];
    for(const [method,path,input,owner,args,reply,status] of cases){
        const f=provider(),response=await f.app.request('/api/v1/scopes/scope-a/'+path,{method,headers:{authorization:'Bearer token-a','idempotency-key':'key-a'},...(input===undefined?{}:{body:JSON.stringify(input)})});
        assert.equal(response.status,status);assert.deepEqual(await response.json(),reply);assert.equal(response.headers.get('cache-control'),'no-store');
        assert.deepEqual(f.calls.map(call=>[call.owner,call.args]),[['identity.authenticate',['Bearer token-a']],[owner,args]]);
        assert.equal(f.calls[0]?.receiver,f.control.identity);
        const receiver=owner==='create'?f.control:owner.startsWith('identity.')?f.control.identity:owner.startsWith('nodes.')?f.control.nodes:owner.startsWith('transport.')?f.control.transport:owner.startsWith('details.')?f.control.details:f.control.queries;
        assert.equal(f.calls[1]?.receiver,receiver);assert.deepEqual(f.trace,['request','allow','identity.authenticate',owner,'drain']);
    }
});

test('23/24/25/26/27 complete structural public providers reach every remaining management family with exact original arguments and mapped owner refusal',async()=>{
    type Route={method:string;path:string;body?:unknown;owner:string;args:unknown[];receiver:(control:ControlApi)=>unknown;signal?:boolean};
    const raw=Object.create(null),routes:Route[]=[
        {method:'PUT',path:'members/member-a',body:{expectedRevision:1,role:'viewer'},owner:'changeMember',args:['actor-a','scope-a','member-a','key-a',{expectedRevision:1,role:'viewer'}],receiver:c=>c},
        {method:'PUT',path:'nodes/node-a/grants/member-a',body:{expectedRevision:1,allowed:false},owner:'changeNodeGrant',args:['actor-a','scope-a','node-a','member-a','key-a',1,false,undefined,undefined],receiver:c=>c},
        {method:'GET',path:'nodes/node-a/payload-limits/member-a',owner:'resourceLimits.get',args:['actor-a','scope-a','node-a','member-a'],receiver:c=>c.resourceLimits},
        {method:'PUT',path:'nodes/node-a/payload-limits/member-a',body:{expectedRevision:0,startsAt:'2026-11-01T00:00:00.000Z',endsAt:'2026-12-01T00:00:00.000Z',bytesPerSecond:0,burstBytes:65536,byteLimit:null},owner:'resourceLimits.set',args:['actor-a','scope-a','node-a','member-a','key-a',{expectedRevision:0,startsAt:'2026-11-01T00:00:00.000Z',endsAt:'2026-12-01T00:00:00.000Z',bytesPerSecond:0,burstBytes:65536,byteLimit:null}],receiver:c=>c.resourceLimits},
        {method:'POST',path:'nodes/node-a/revoke',body:{},owner:'changeNode',args:['actor-a','scope-a','node-a','key-a',{kind:'revoke'}],receiver:c=>c},
        {method:'PUT',path:'transport-profiles/profile-a/grants/member-a',body:{expectedRevision:1,allowed:false},owner:'profileGrants.change',args:['actor-a','scope-a','profile-a','member-a','key-a',1,false],receiver:c=>c.profileGrants},
        {method:'GET',path:'relay-endpoint',owner:'relayEndpoints.get',args:['actor-a','scope-a','node-a'],receiver:c=>c.relayEndpoints},
        {method:'GET',path:'native-drivers',owner:'nativeDrivers.list',args:['actor-a','scope-a'],receiver:c=>c.nativeDrivers},
        {method:'GET',path:'forwards/forward-a/probe-capabilities',owner:'probeCapabilities.get',args:['actor-a','scope-a','forward-a'],receiver:c=>c.probeCapabilities},
        {method:'GET',path:'transport-profiles/profile-a/references',owner:'transportQueries.references',args:['actor-a','scope-a','profile-a',{}],receiver:c=>c.transportQueries},
        {method:'GET',path:'nodes/node-a/tunnel',owner:'tunnelQueries.status',args:['actor-a','scope-a','node-a'],receiver:c=>c.tunnelQueries},
        {method:'PUT',path:'path-templates/template-a',body:{expectedRevision:0,config:{}},owner:'pathTemplates.publish',args:['actor-a','scope-a','template-a','key-a',0,raw],receiver:c=>c.pathTemplates},
        {method:'GET',path:'path-templates',owner:'pathTemplateQueries.list',args:['actor-a','scope-a',{}],receiver:c=>c.pathTemplateQueries},
        {method:'GET',path:'forwards/forward-a/path-binding',owner:'pathBindings.get',args:['actor-a','scope-a','forward-a'],receiver:c=>c.pathBindings},
        {method:'PUT',path:'forwards/forward-a/path-binding',body:{expectedRevision:1,template:{}},owner:'forwards.applyPath',args:['actor-a','scope-a','forward-a','key-a',1,raw],receiver:c=>c.forwards},
        {method:'GET',path:'tunnels',owner:'tunnels.list',args:['actor-a','scope-a',{}],receiver:c=>c.tunnels},
        {method:'GET',path:'path-groups',owner:'pathGroups.list',args:['actor-a','scope-a',{}],receiver:c=>c.pathGroups},
        {method:'GET',path:'path-publications',owner:'pathPublications.list',args:['actor-a','scope-a',{}],receiver:c=>c.pathPublications},
        {method:'GET',path:'ingress-groups',owner:'ingressGroups.list',args:['actor-a','scope-a',{}],receiver:c=>c.ingressGroups},
        {method:'GET',path:'ingress-deployments',owner:'ingressDeployments.list',args:['actor-a','scope-a',{}],receiver:c=>c.ingressDeployments},
        {method:'GET',path:'ingress-migrations',owner:'ingressMigrations.list',args:['actor-a','scope-a',{}],receiver:c=>c.ingressMigrations},
        {method:'POST',path:'relay-plan',body:{},owner:'planRelay',args:['actor-a','scope-a',raw],receiver:c=>c},
        {method:'POST',path:'forwards/forward-a/probe-plan',body:{},owner:'probePlans.plan',args:['actor-a','scope-a','forward-a',raw],receiver:c=>c.probePlans},
        {method:'GET',path:'probes/probe-a',owner:'probes.inspect',args:['actor-a','scope-a','probe-a'],receiver:c=>c.probes},
        {method:'POST',path:'nodes/node-a/observations',body:{},owner:'observations.observe',args:['actor-a','scope-a','node-a',raw],receiver:c=>c.observations,signal:true},
    ];
    for(const route of routes){
        const f=provider(),path=route.path==='relay-endpoint'?'nodes/node-a/relay-endpoint':route.path;
        const request=new Request('http://localhost/api/v1/scopes/scope-a/'+path,{method:route.method,headers:{authorization:'Bearer token-a','idempotency-key':'key-a'},...(route.body===undefined?{}:{body:JSON.stringify(route.body)})});
        const response=await f.app.request(request);assert.equal(response.status,409,route.owner);
        const reply=await response.json();assert.equal(reply.code,'SUBSTITUTE_REFUSED');assert.equal(reply.message,'independent provider refused');assert.equal(reply.retryable,false);
        assert.deepEqual(f.calls.map(call=>[call.owner,call.args]),[['identity.authenticate',['Bearer token-a']],[route.owner,[...route.args,...(route.signal?[request.signal]:[])]]]);
        assert.equal(f.calls[1]?.receiver,route.receiver(f.control));assert.deepEqual(f.trace,['request','allow','identity.authenticate',route.owner,'drain']);
    }
});

test('23 complete structural Node provider keeps actual enrollment and provision route defaults without constructor Tx or private state',async()=>{
    const enrollment=provider(),response=await enrollment.app.request('/enrollment/v1',{method:'POST',body:JSON.stringify({nodeId:'node-a',token:'token-a',csr:'csr-a'})});
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{certificate:'certificate-a',ca:'ca-a'});
    assert.deepEqual(enrollment.calls.map(call=>[call.owner,call.args]),[['nodes.enroll',['node-a','token-a','csr-a']]]);assert.equal(enrollment.calls[0]?.receiver,enrollment.control.nodes);
    assert.deepEqual(enrollment.trace,['request','allow','nodes.enroll','drain']);
    const f=provider(),policy={allowedListenerAddresses:['127.0.0.1'],allowedPorts:[443],egressPolicyRevision:1,allowedDestinationCidrs:[],allowMetadataTargets:false};
    const provision=await f.app.request('/api/v1/scopes/scope-a/nodes',{method:'POST',headers:{authorization:'Bearer token-a'},body:JSON.stringify(policy)});
    assert.equal(provision.status,201);assert.deepEqual(await provision.json(),{nodeId:'node-a',enrollmentToken:'token-a',expiresAt:'2026-10-20T00:10:00.000Z'});
    assert.deepEqual(f.calls.map(call=>[call.owner,call.args]),[['identity.authenticate',['Bearer token-a']],['nodes.provision',['actor-a','scope-a',Object.assign(Object.create(null),policy)]]]);
    assert.equal(f.calls[1]?.receiver,f.control.nodes);
});

test('23 complete structural HTTP provider retains first refusal error mapping and finally drain before route owner',async()=>{
    const cases:[string,number,string,string[]][]=[
        ['authority',503,'MAINTENANCE',['request','allow','drain']],
        ['cookie',401,'UNAUTHENTICATED',['request','allow','drain']],
        ['identity',409,'SUBSTITUTE_REFUSED',['request','allow','identity.authenticate','drain']],
        ['scope',422,'INVALID_CONFIG',['request','allow','identity.authenticate','drain']],
        ['body',422,'INVALID_CONFIG',['request','allow','identity.authenticate','drain']],
    ];
    for(const [kind,status,code,trace] of cases){
        const f=provider();f.fault.authority=kind==='authority';f.fault.owner=kind==='identity';
        const response=await f.app.request('/api/v1/scopes/'+(kind==='scope'?'bad!scope':'scope-a')+'/forwards',{method:'POST',headers:{authorization:'Bearer token-a',...(kind==='cookie'?{cookie:'session=1'}:{})},body:kind==='body'?'{':'{}'});
        assert.equal(response.status,status);const reply=await response.json();assert.equal(reply.code,code);assert.equal(reply.retryable,false);assert.match(reply.requestId,/^[a-f0-9-]{36}$/);
        assert.deepEqual(f.trace,trace);assert.equal(f.calls.some(call=>call.owner==='create'),false);
    }
    const f=provider(),response=await f.app.request('/enrollment/v1',{method:'POST',body:JSON.stringify({nodeId:'node-a',token:'token-a',csr:'csr-a',extra:true})});
    assert.equal(response.status,422);assert.equal(f.calls.length,0);assert.deepEqual(f.trace,['request','allow','drain']);
});

// Load the current route body with only the external mTLS fingerprint effect
// replaced. Native wire parsers, Hono, body/session readers and error projection
// stay real. This tests public substitution without inventing a TLS authority.
async function machineFactory(fingerprint:()=>string){
    const source=await readFile(new URL('../src/api/routes.ts',import.meta.url),'utf8');
    const modules:Record<string,unknown>={
        '../compatibility/public.ts':Native,
        '../compatibility/control-http/public.ts':{...Http,nativeControlRequestFingerprint:fingerprint},
        '@tunex/core':Core,'../framework/public.ts':Framework,'../modules/console-query-owner/public.ts':Queries,
    };
    const exports:{createControlApp?:typeof createControlApp}={};
    const javascript=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    new vm.Script('(function(exports,require){'+javascript+'\n})').runInThisContext()(exports,(name:string)=>{assert.ok(Object.hasOwn(modules,name),name);return modules[name];});
    const factory=exports.createControlApp;assert.ok(factory);return factory;
}
async function fixtureRaw(file:string,name:string){
    const fixture=JSON.parse(await readFile(new URL('../../../docs/protocol/fixtures/'+file+'.json',import.meta.url),'utf8')) as {cases:{name:string;raw:string;valid:boolean}[]};
    const item=fixture.cases.find(value=>value.name===name);assert.ok(item?.valid);return item.raw;
}

test('25/27 all eleven complete Probe APIs Transit and native Runtime providers substitute through actual HTTP and real wire parsers with TLS effect only',async()=>{
    type Machine={path:string;raw?:string;owner:string;parsed?:unknown;receiver:(f:ReturnType<typeof provider>)=>unknown;runtime?:'hello'|'report'|'snapshot';boot?:boolean};
    const resultVector=JSON.parse(await readFile(new URL('../../../docs/protocol/fixtures/probe-result-v1.json',import.meta.url),'utf8')) as {request:unknown};
    const base=Native.parseProbeResult('Request',JSON.stringify(resultVector.request));
    const identity={protocolVersion:3,nodeId:base.nodeId,bootId:base.bootId,sessionEpoch:base.sessionEpoch,instanceId:base.instanceId,instanceGeneration:base.instanceGeneration,requestId:base.requestId};
    const descriptor={measurement:'tcp-connect-v1',taskKind:'tcp-connect',point:'agent-direct-egress',capability:'probe.tcp-connect.v1'};
    const hello=await fixtureRaw('probe-negotiation-v1','valid-request'),instance=await fixtureRaw('probe-instance-v1','valid-register'),claim=await fixtureRaw('probe-claim-v1','valid-claim');
    const poll=await fixtureRaw('probe-delivery-v1','valid-poll'),status=await fixtureRaw('probe-delivery-v1','valid-status'),result=JSON.stringify(base);
    const negotiation=JSON.stringify({protocolVersion:3,extensionVersion:1,nodeId:'node-a',bootId:'boot-a',sessionEpoch:2,requiredCapabilities:['adp.multihop.1','transit.wire.1','native.transit.v1'],lastStoredTransitGeneration:0});
    const report=JSON.stringify({protocolVersion:3,extensionVersion:1,kind:'transit-delivery-report-v1',nodeId:'node-a',bootId:'boot-a',sessionEpoch:2,commandDigest:'sha256:'+'a'.repeat(64),envelopeDigest:'sha256:'+'b'.repeat(64),reportSequence:1,observedAt:'2026-10-20T00:00:00.000Z',condition:'received'});
    const runtimeHello=await fixtureRaw('adp-v3-runtime','hello');
    const runtimeReport=JSON.stringify({protocolVersion:3,nodeId:'node-a',bootId:'boot-a',sessionEpoch:2,reportSequence:1,observedAt:'2026-10-20T00:00:00.000Z',acceptedSnapshotGeneration:0,observations:[],drains:[]});
    const routes:Machine[]=[
        {path:'probe/hello',raw:hello,owner:'probeNegotiation.hello',parsed:Native.parseProbeNegotiation('Request',hello),receiver:f=>f.control.probeNegotiation},
        {path:'probe/instance',raw:instance,owner:'probeRegistry.handle',parsed:Native.parseProbeInstance('Request',instance),receiver:f=>f.control.probeRegistry},
        {path:'probe/claim',raw:claim,owner:'probeClaims.handle',parsed:Native.parseProbeClaim('Request',claim),receiver:f=>f.control.probeClaims},
        {path:'probe/poll',raw:poll,owner:'probeDelivery.poll',parsed:Native.parseProbeDelivery('PollRequest',poll),receiver:f=>f.control.probeDelivery},
        {path:'probe/status',raw:status,owner:'probeDelivery.status',parsed:Native.parseProbeDelivery('StatusRequest',status),receiver:f=>f.control.probeDelivery},
        {path:'probe/result',raw:result,owner:'probeResults.handle',parsed:base,receiver:f=>f.control.probeResults},
        {path:'transit/hello',raw:negotiation,owner:'transitNegotiation.hello',parsed:Native.parseTransitNegotiation('Request',negotiation),receiver:f=>f.control.transitNegotiation},
        {path:'transit/report',raw:report,owner:'transitDelivery.report',parsed:Native.parseTransitDelivery('Report',report),receiver:f=>f.control.transitDelivery},
        {path:'transit/command',owner:'transitDelivery.poll',receiver:f=>f.control.transitDelivery,boot:true},
        {path:'hello',raw:runtimeHello,owner:'runtime.hello',parsed:Native.parseRuntimeMessage('HelloRequest',runtimeHello),receiver:f=>f.runtime,runtime:'hello'},
        {path:'report',raw:runtimeReport,owner:'runtime.report',parsed:Native.parseRuntimeMessage('ReportRequest',runtimeReport),receiver:f=>f.runtime,runtime:'report'},
        {path:'snapshot',owner:'runtime.snapshot',receiver:f=>f.runtime,runtime:'snapshot'},
    ];
    for(const family of ['types','services'] as const){
        const version=family==='types'?2:3,prefix='probe-'+family,measurements=family==='types'?['tcp-connect-v1','tcp-ingress-connect-v1']:['tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1'];
        const qualify=JSON.stringify({...identity,probeVersion:version,kind:prefix+'-instance',action:'register',measurements}),discover=JSON.stringify({...identity,probeVersion:version,kind:prefix+'-poll',measurements});
        const consume=JSON.stringify({...identity,...descriptor,probeVersion:version,kind:prefix+'-claim',permitId:base.permitId,...(family==='services'?{service:null}:{})});
        const check=JSON.stringify({...identity,...descriptor,probeVersion:version,kind:prefix+'-status',permitId:base.permitId,...(family==='services'?{service:null}:{})});
        const measured=JSON.stringify({...base,...descriptor,probeVersion:version,kind:prefix+'-result',...(family==='services'?{service:null,tls:null}:{})});
        if(family==='types')routes.push(
            {path:'probe/types/instance',raw:qualify,owner:'probeTypeRegistry.handle',parsed:Native.parseProbeTypes('QualificationRequest',qualify),receiver:f=>f.control.probeTypeRegistry},
            {path:'probe/types/poll',raw:discover,owner:'probeTypes.poll',parsed:Native.parseProbeTypes('PollRequest',discover),receiver:f=>f.control.probeTypes},
            {path:'probe/types/claim',raw:consume,owner:'probeTypes.claim',parsed:Native.parseProbeTypes('ClaimRequest',consume),receiver:f=>f.control.probeTypes},
            {path:'probe/types/status',raw:check,owner:'probeTypes.status',parsed:Native.parseProbeTypes('StatusRequest',check),receiver:f=>f.control.probeTypes},
            {path:'probe/types/result',raw:measured,owner:'probeTypes.result',parsed:Native.parseProbeTypes('ResultRequest',measured),receiver:f=>f.control.probeTypes},
        );else routes.push(
            {path:'probe/services/instance',raw:qualify,owner:'probeServiceRegistry.handle',parsed:Native.parseProbeServices('QualificationRequest',qualify),receiver:f=>f.control.probeServiceRegistry},
            {path:'probe/services/poll',raw:discover,owner:'probeServices.poll',parsed:Native.parseProbeServices('PollRequest',discover),receiver:f=>f.control.probeServices},
            {path:'probe/services/claim',raw:consume,owner:'probeServices.claim',parsed:Native.parseProbeServices('ClaimRequest',consume),receiver:f=>f.control.probeServices},
            {path:'probe/services/status',raw:check,owner:'probeServices.status',parsed:Native.parseProbeServices('StatusRequest',check),receiver:f=>f.control.probeServices},
            {path:'probe/services/result',raw:measured,owner:'probeServices.result',parsed:Native.parseProbeServices('ResultRequest',measured),receiver:f=>f.control.probeServices},
        );
    }
    for(const route of routes){
        const tls:string[]=[],factory=await machineFactory(()=>{tls.push('fingerprint');return 'fingerprint-a';}),f=provider(factory);
        const response=await f.app.request('/agent/v3/'+route.path,{method:route.raw===undefined?'GET':'POST',headers:{'x-tunex-session-epoch':'2',...(route.boot?{'x-tunex-boot-id':'boot-a'}:{})},...(route.raw===undefined?{}:{body:route.raw})});
        assert.equal(response.status,409,route.path);assert.equal((await response.json()).code,'SUBSTITUTE_REFUSED');assert.deepEqual(tls,['fingerprint']);
        const args=route.boot?['node-a','fingerprint-a',2,'boot-a']:route.runtime==='hello'?['node-a',route.parsed,'fingerprint-a']:route.runtime==='report'?['node-a',2,route.parsed,'fingerprint-a']:route.runtime==='snapshot'?['node-a',2,'fingerprint-a']:['node-a','fingerprint-a',2,route.parsed];
        assert.deepEqual(f.calls.map(call=>[call.owner,call.args]),[['nodes.machine',['fingerprint-a']],[route.owner,args]]);
        assert.equal(f.calls[0]?.receiver,f.control.nodes);assert.equal(f.calls[1]?.receiver,route.receiver(f));assert.deepEqual(f.trace,['request','allow','nodes.machine',route.owner,'drain']);
        if(route.parsed!==undefined)assert.ok(Object.isFrozen(f.calls[1]?.args.find(arg=>arg!==null&&typeof arg==='object')));
    }
});

test('23 complete inherited NodeApi credential methods retain actual machine route arguments error mapping and request drain',async()=>{
    const factory=await machineFactory(()=> 'fingerprint-a');
    for(const [path,owner] of [['credentials/rotate','nodes.rotate'],['relay-credential','nodes.relayCredential']] as const){
        const f=provider(factory),response=await f.app.request('/agent/v3/'+path,{method:'POST',headers:{'x-tunex-session-epoch':'2'},body:JSON.stringify({requestId:'request-a',csr:'csr-a'})});
        assert.equal(response.status,409);assert.equal((await response.json()).code,'SUBSTITUTE_REFUSED');
        assert.deepEqual(f.calls.map(call=>[call.owner,call.args]),[['nodes.machine',['fingerprint-a']],[owner,['node-a','fingerprint-a',2,'request-a','csr-a']]]);
        assert.equal(f.calls[1]?.receiver,f.control.nodes);assert.deepEqual(f.trace,['request','allow','nodes.machine',owner,'drain']);
    }
});
