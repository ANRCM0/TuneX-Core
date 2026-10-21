import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { MAX_COUNTER } from '@tunex/core';
import * as canonical from '../src/compatibility/native-http-queries.ts';
import * as native from '../src/compatibility/public.ts';
import { consoleQuery, consoleFilterNames, validateConsoleFilters } from '../src/modules/console-query-owner/public.ts';
import { consoleQuery as canonicalConsole } from '../src/modules/console-query-owner/http-query.ts';
import type { ConsoleListKind } from '../src/modules/console-query-owner/public.ts';
import { createControlApp } from '../src/api/public.ts';
import { ProbeRuns } from '../src/modules/probe-history-owner/public.ts';
import { MySqlProbeRuns } from '../src/infrastructure/mysql-probe-runs.ts';
import type { ResourceReadAccess } from '../src/framework/public.ts';
import type { Transaction, MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';

type Equal<A,B>=(<T>()=>T extends A?1:2)extends(<T>()=>T extends B?1:2)?true:false;
type Same<T extends true>=T;
type StringQuery={page?:string;limit?:string};
type RecordQuery=Record<string,string>;
export type ExactQueryReturnDeclarations=[
    Same<Equal<ReturnType<typeof canonical.transportReferenceQuery>,{page?:string|undefined;limit?:string|undefined;revision?:number|undefined;targetRevision?:number|undefined}>>,
    Same<Equal<ReturnType<typeof canonical.tunnelReferenceQuery>,{page?:string|undefined;limit?:string|undefined}>>,
    Same<Equal<ReturnType<typeof canonical.pathTemplateListQuery>,{page?:string;limit?:string;prefix?:string}>>,
    Same<Equal<ReturnType<typeof canonical.pathTemplateRevisionQuery>,number|undefined>>,
    Same<Equal<ReturnType<typeof canonical.pathReferenceQuery>,{page?:string;limit?:string;revision?:number;targetRevision?:number}>>,
    Same<Equal<ReturnType<typeof canonical.pathGroupReferenceQuery>,{page?:string;limit?:string;revision?:number;targetRevision?:number}>>,
    Same<Equal<ReturnType<typeof canonical.pathPublicationListQuery>,StringQuery>>,
    Same<Equal<ReturnType<typeof canonical.ingressDeploymentListQuery>,{page?:string;limit?:string;groupId?:string}>>,
    Same<Equal<ReturnType<typeof canonical.telemetryHistoryQuery>,{from?:string;to?:string;limit?:string}>>,
    Same<Equal<ReturnType<typeof canonical.telemetryRollupQuery>,{family?:string|undefined;resolution?:string|undefined;from?:string|undefined;to?:string|undefined;limit?:string|undefined;seriesKey?:string|undefined;after?:string|undefined}>>,
    Same<Equal<ReturnType<typeof canonical.auditQuery>,RecordQuery>>,Same<Equal<ReturnType<typeof canonical.stationEventQuery>,RecordQuery>>,
    Same<Equal<ReturnType<typeof canonical.notificationDeliveryQuery>,RecordQuery>>,Same<Equal<ReturnType<typeof canonical.probeRunQuery>,RecordQuery>>,
    Same<Equal<ReturnType<typeof canonical.probePlanQuery>,RecordQuery>>,Same<Equal<ReturnType<typeof canonical.observationServiceRevisionQuery>,number|undefined>>,
    Same<Equal<ReturnType<typeof consoleQuery>,{page:string|undefined;limit:string|undefined;filters:RecordQuery}>>,
    Same<Equal<typeof import('../src/api/console-query.ts').consoleQuery,typeof consoleQuery>>,
    Same<Equal<typeof import('../src/api/path-template-query.ts').pathTemplateRevisionQuery,typeof canonical.pathTemplateRevisionQuery>>,
    Same<Equal<typeof import('../src/api/transport-query.ts').transportReferenceQuery,typeof canonical.transportReferenceQuery>>,
];

const aliases:[string,string[]][]=[
    ['console-query',['consoleQuery']],['transport-query',['transportReferenceQuery']],['tunnel-query',['tunnelReferenceQuery']],
    ['path-template-query',['pathTemplateListQuery','pathTemplateRevisionQuery','pathReferenceQuery']],['path-group-query',['pathGroupReferenceQuery']],
    ['path-publication-query',['pathPublicationListQuery']],['ingress-query',['ingressDeploymentListQuery']],['telemetry-query',['telemetryHistoryQuery']],
    ['telemetry-rollup-query',['telemetryRollupQuery']],['audit-query',['auditQuery']],['station-alert-query',['stationEventQuery']],
    ['notification-delivery-query',['notificationDeliveryQuery']],['probe-run-query',['probeRunQuery']],['probe-plan-query',['probePlanQuery']],
    ['observation-service-query',['observationServiceRevisionQuery']],
];
type ObjectQuery=(search:URLSearchParams)=>object;
const families:{name:string;parse:ObjectQuery;values:[string,string][];error:string}[]=[
    {name:'Profile references',parse:canonical.transportReferenceQuery,values:[['page','2'],['limit','7'],['revision','3'],['targetRevision','4']],error:'Unknown or duplicate Profile reference query parameter'},
    {name:'Tunnel references',parse:canonical.tunnelReferenceQuery,values:[['page','2'],['limit','7']],error:'Unknown or duplicate tunnel reference parameter'},
    {name:'Path template list',parse:canonical.pathTemplateListQuery,values:[['page','2'],['limit','7'],['prefix','a_%']],error:'Unknown or duplicate PathTemplate list query'},
    {name:'Path references',parse:canonical.pathReferenceQuery,values:[['page','2'],['limit','7'],['revision','3'],['targetRevision','4']],error:'Unknown or duplicate PathTemplate reference query'},
    {name:'Path group references',parse:canonical.pathGroupReferenceQuery,values:[['page','2'],['limit','7'],['revision','3']],error:'Unknown or duplicate PathTemplate reference query'},
    {name:'Path publication list',parse:canonical.pathPublicationListQuery,values:[['page','2'],['limit','7']],error:'Unknown or duplicate publication query'},
    {name:'Ingress deployment list',parse:canonical.ingressDeploymentListQuery,values:[['page','2'],['limit','7'],['groupId','group-a']],error:'Unknown or duplicate ingress deployment query'},
    {name:'Telemetry history',parse:canonical.telemetryHistoryQuery,values:[['from','time one'],['to','time two'],['limit','raw-limit']],error:'Unknown or duplicate telemetry query'},
    {name:'Telemetry aggregates',parse:canonical.telemetryRollupQuery,values:[['family','node'],['resolution','1m'],['from','a'],['to','b'],['limit','raw-limit'],['seriesKey','a:b/+'],['after','cursor/+']],error:'Closed aggregate query required'},
    {name:'Audit',parse:canonical.auditQuery,values:['from','to','limit','cursor','actorId','nodeId','forwardId','operationId','errorCode','source'].map(key=>[key,`${key} value`]),error:'Unknown or duplicate audit query parameter'},
    {name:'Station event',parse:canonical.stationEventQuery,values:['from','to','limit','cursor','policyId','targetId','rule','kind','acknowledged'].map(key=>[key,`${key} value`]),error:'Unknown or duplicate station event query parameter'},
    {name:'Notification delivery',parse:canonical.notificationDeliveryQuery,values:['from','to','limit','cursor','endpointId','eventId','status'].map(key=>[key,`${key} value`]),error:'Unknown or duplicate notification query parameter'},
    {name:'Probe history',parse:canonical.probeRunQuery,values:['from','to','limit','cursor','forwardId','nodeId','probeId','state','resultStatus'].map(key=>[key,key==='resultStatus'?'echoed':`${key} value`]),error:'Unknown or duplicate Probe history query parameter'},
    {name:'Probe plans',parse:canonical.probePlanQuery,values:['from','to','limit','cursor','forwardId','mode','state'].map(key=>[key,`${key} value`]),error:'Unknown or duplicate Probe plan query parameter'},
];
const query=(pairs:[string,string][]|string)=>new URLSearchParams(pairs);
function refused(action:()=>unknown,message:string){assert.throws(action,{name:'Error',code:'INVALID_CONFIG',status:422,message});}

test('113 all fifteen old query entry modules retain the exact seventeen public canonical functions and no expanded exports',async()=>{
    assert.equal(aliases.length,15);assert.equal(aliases.flatMap(row=>row[1]).length,17);assert.equal(consoleQuery,canonicalConsole);
    for(const [leaf,names]of aliases){const old=await import(new URL(`../src/api/${leaf}.ts`,import.meta.url).href)as Record<string,unknown>;assert.deepEqual(Object.keys(old).sort(),[...names].sort());
        for(const name of names){if(name==='consoleQuery')assert.equal(old[name],consoleQuery);else{assert.equal(old[name],(canonical as unknown as Record<string,unknown>)[name]);assert.equal(old[name],(native as unknown as Record<string,unknown>)[name]);}}
    }
});

test('113 every object query family returns fresh mutable ordinary objects preserving decoded insertion order and original value types',()=>{
    for(const family of families){
        const empty=family.parse(query('')),other=family.parse(query(''));assert.deepEqual(empty,{},family.name);assert.notEqual(empty,other);assert.equal(Object.getPrototypeOf(empty),Object.prototype);assert.equal(Object.isFrozen(empty),false);
        for(const pairs of [family.values,[...family.values].reverse()]){const search=query(pairs),result=family.parse(search)as Record<string,string|number>;assert.deepEqual(Object.keys(result),pairs.map(row=>row[0]),family.name);
            const expected=Object.fromEntries(pairs.map(([key,value])=>[key,key==='revision'||key==='targetRevision'?Number(value):value]));assert.deepEqual(result,expected,family.name);assert.equal(Object.isFrozen(result),false);
            result.extra='mutable';assert.equal(result.extra,'mutable');assert.equal(search.has('extra'),false);
        }
        const [key,value]=family.values[0]!;const encoded=key.split('').map(character=>`%${character.charCodeAt(0).toString(16)}`).join('');assert.deepEqual(family.parse(query(`${encoded}=${encodeURIComponent(value)}`)),family.parse(query([[key,value]])),family.name);
    }
});

test('113 every family rejects unknown duplicate and encoded-duplicate keys with the original exact message',()=>{
    for(const family of families){
        for(const unknown of ['unknown','__proto__','constructor'])refused(()=>family.parse(query([[unknown,'x']])),family.error);
        for(const [key,value]of family.values){refused(()=>family.parse(query([[key,value],[key,value]])),family.error);const encoded=`%${key.charCodeAt(0).toString(16)}${key.slice(1)}`;refused(()=>family.parse(query(`${key}=${encodeURIComponent(value)}&${encoded}=${encodeURIComponent(value)}`)),family.error);}
    }
});

test('113 original pagination bounds apply only to paged families while raw history and cursor families keep their strings and empty values',()=>{
    const paged=families.slice(0,7);
    for(const family of paged){assert.deepEqual(family.parse(query('page=10000&limit=100')),{page:'10000',limit:'100'});
        for(const [name,values]of [['page',['','0','00','01','+1','1.0','1e2','10001']],['limit',['','0','01','+1','101']]]as [string,string[]][]){for(const value of values)refused(()=>family.parse(query([[name,value]])),'Invalid pagination parameter');}
    }
    assert.deepEqual(canonical.telemetryHistoryQuery(query('from=&to=&limit=999999')),{from:'',to:'',limit:'999999'});
    for(const family of families.slice(9)){for(const [key]of family.values){if(family.parse===canonical.probeRunQuery&&key==='resultStatus')continue;assert.deepEqual(family.parse(query([[key,'']])),{[key]:''});}}
    assert.deepEqual(canonical.pathTemplateListQuery(query('prefix=')),{prefix:''});
});

test('113 Profile and template detail revisions retain safe-counter range without a new64 ceiling while Path and observation remain capped64',()=>{
    for(const value of ['1','64','65',String(MAX_COUNTER)]){
        assert.equal(canonical.pathTemplateRevisionQuery(query([['revision',value]])),Number(value));
        for(const name of ['revision','targetRevision'])assert.deepEqual(canonical.transportReferenceQuery(query([[name,value]])),{[name]:Number(value)});
    }
    for(const value of ['1','64']){assert.equal(canonical.observationServiceRevisionQuery(query([['revision',value]])),Number(value));for(const name of ['revision','targetRevision'])assert.deepEqual(canonical.pathReferenceQuery(query([[name,value]])),{[name]:Number(value)});}
    refused(()=>canonical.pathReferenceQuery(query('revision=65')),'Canonical exact PathTemplate revision required');refused(()=>canonical.pathReferenceQuery(query('targetRevision=65')),'Canonical exact PathTemplate revision required');
    refused(()=>canonical.observationServiceRevisionQuery(query('revision=65')),'Canonical observation configuration revision required');
    assert.equal(canonical.pathTemplateRevisionQuery(query('')),undefined);assert.equal(canonical.observationServiceRevisionQuery(query('')),undefined);
    const malformed=['','0','00','01','+1','-1',' 1','1 ','1.0','1e2','1\n','Infinity','NaN',String(MAX_COUNTER+1),'9'.repeat(40)];
    for(const value of malformed){
        refused(()=>canonical.pathTemplateRevisionQuery(query([['revision',value]])),'Canonical PathTemplate revision required');
        refused(()=>canonical.observationServiceRevisionQuery(query([['revision',value]])),'Canonical observation configuration revision required');
        for(const name of ['revision','targetRevision']){refused(()=>canonical.transportReferenceQuery(query([[name,value]])),'Canonical locked Profile revision required');refused(()=>canonical.pathReferenceQuery(query([[name,value]])),'Canonical exact PathTemplate revision required');}
    }
});

test('113 exact detail revision first rejects all unknown or duplicate keys before validating the revision value',()=>{
    for(const [parse,message]of [[canonical.pathTemplateRevisionQuery,'Only one exact template revision is supported'],[canonical.observationServiceRevisionQuery,'Only one exact observation configuration revision is supported']]as const){
        for(const input of ['unknown=x','revision=1&revision=2','r%65vision=1&revision=2','revision=bad&unknown=x','unknown=x&revision=bad'])refused(()=>parse(query(input)),message);
    }
    refused(()=>canonical.transportReferenceQuery(query('revision=bad&unknown=x')),'Canonical locked Profile revision required');
    refused(()=>canonical.transportReferenceQuery(query('unknown=x&revision=bad')),'Unknown or duplicate Profile reference query parameter');
    refused(()=>canonical.pathReferenceQuery(query('revision=bad&unknown=x')),'Canonical exact PathTemplate revision required');
});

test('113 group targetRevision presence refuses before iteration parsing and pagination; Ingress validates pagination before group identity',()=>{
    for(const input of ['targetRevision=','unknown=x&targetRevision=bad&page=0','page=0&target%52evision=1','targetRevision=1&targetRevision=2'])refused(()=>canonical.pathGroupReferenceQuery(query(input)),'Group references do not expand or switch a target revision');
    const target=query('targetRevision=1');Object.defineProperty(target,Symbol.iterator,{value(){assert.fail('Group presence guard must precede iteration');}});refused(()=>canonical.pathGroupReferenceQuery(target),'Group references do not expand or switch a target revision');
    for(const input of ['groupId=../bad&page=0','page=0&groupId=../bad','groupId=&limit=101'])refused(()=>canonical.ingressDeploymentListQuery(query(input)),'Invalid pagination parameter');
    for(const value of ['','../bad','a/b','x'.repeat(129),'a\n'])refused(()=>canonical.ingressDeploymentListQuery(query([['groupId',value]])),'Exact ingress group filter required');
    assert.deepEqual(canonical.ingressDeploymentListQuery(query('groupId=group_1&page=1')),{groupId:'group_1',page:'1'});
    refused(()=>canonical.ingressDeploymentListQuery(query('groupId=bad&page=0&unknown=x')),'Unknown or duplicate ingress deployment query');
});

test('113 aggregate parser uses own-property duplicate nonempty guards and Object.assign rather than getAll family behavior',t=>{
    class WithoutGetAll extends URLSearchParams{override getAll():string[]{assert.fail('aggregate must not call getAll');}}
    assert.deepEqual(canonical.telemetryRollupQuery(new WithoutGetAll('from=a&to=b')),{from:'a',to:'b'});
    refused(()=>canonical.telemetryRollupQuery(new WithoutGetAll('from=a&from=b')),'Closed aggregate query required');
    for(const name of ['family','resolution','from','to','limit','seriesKey','after'])refused(()=>canonical.telemetryRollupQuery(query([[name,'']])),'Closed aggregate query required');
    const failure=new Error('original getAll');const ordinary=query('from=a');ordinary.getAll=()=>{throw failure;};assert.throws(()=>canonical.telemetryHistoryQuery(ordinary),error=>error===failure);
    const calls:unknown[][]=[],originalAssign=Object.assign;const mock=t.mock.method(Object,'assign',function(target:object,...sources:object[]){calls.push([target,...sources]);return originalAssign(target,...sources);});
    const result=canonical.telemetryRollupQuery(query('after=a&from=b'));mock.mock.restore();
    assert.equal(calls.length,2);assert.equal(calls[0]![0],result);assert.equal(calls[1]![0],result);assert.deepEqual(calls.map(row=>row.slice(1)),[[{after:'a'}],[{from:'b'}]]);
});

test('113 Probe history retains every resultStatus including staged recorded Echo and its original competing-error precedence',()=>{
    for(const resultStatus of ['connected','unreachable','verified','unverified','echoed','missing'])assert.deepEqual(canonical.probeRunQuery(query([['resultStatus',resultStatus]])),{resultStatus});
    for(const resultStatus of ['','CONNECTED','failed','echo',' echoed'])refused(()=>canonical.probeRunQuery(query([['resultStatus',resultStatus]])),'Invalid Probe history result status');
    refused(()=>canonical.probeRunQuery(query('resultStatus=invalid&unknown=x')),'Invalid Probe history result status');
    refused(()=>canonical.probeRunQuery(query('unknown=x&resultStatus=invalid')),'Unknown or duplicate Probe history query parameter');
    refused(()=>canonical.probeRunQuery(query('resultStatus=invalid&resultStatus=connected')),'Unknown or duplicate Probe history query parameter');
});

test('113 native Console query keeps original map kind filters reference mutable returns and callback-before-pagination order',()=>{
    const events:string[]=[],allowed=['state'],names={get custom(){assert.equal(this,names);events.push('names');return allowed;}};let received:Record<string,string>|undefined;
    const search=query('limit=7&state=ready&page=2');const result=canonical.nativeConsoleQuery('custom',search,names,(kind,filters)=>{events.push('filters');assert.equal(kind,'custom');assert.deepEqual(filters,{state:'ready'});received=filters;(filters as Record<string,string>).callback='same reference';});
    assert.deepEqual(events,['names','names','names','filters']);assert.equal(result.filters,received);assert.deepEqual(Object.keys(result),['page','limit','filters']);assert.deepEqual(result,{page:'2',limit:'7',filters:{state:'ready',callback:'same reference'}});assert.equal(Object.isFrozen(result),false);assert.equal(Object.isFrozen(result.filters),false);
    const empty=canonical.nativeConsoleQuery('custom',query(''),names,()=>{});assert.deepEqual(empty,{page:undefined,limit:undefined,filters:{}});assert.deepEqual(Object.keys(empty),['page','limit','filters']);assert.notEqual(empty.filters,result.filters);
    let calls=0;for(const input of ['unknown=x&page=0','state=x&state=y&page=0','state=x&st%61te=y'])refused(()=>canonical.nativeConsoleQuery('custom',query(input),names,()=>{calls++;}),'Invalid console query parameter');assert.equal(calls,0);
    const failure=new Error('owner filter failure');assert.throws(()=>canonical.nativeConsoleQuery('custom',query('page=0&state=ready'),names,()=>{throw failure;}),error=>error===failure);
    refused(()=>canonical.nativeConsoleQuery('custom',query('page=0&state=ready'),names,()=>{calls++;}),'Invalid pagination parameter');assert.equal(calls,1);
});

test('113 Console wrapper uses exact owner table and validator with all existing kind filters and original refusal ordering',async()=>{
    const examples:Record<ConsoleListKind,Record<string,string[]>>={nodes:{idPrefix:['node_1'],credential:['valid','expired','unenrolled','revoked'],resourceSource:['private','admin-shared','legacy-unclassified'],ownership:['mine','available']},
        forwards:{idPrefix:['forward_1'],enabled:['true','false'],recoverySuspended:['true','false'],protocol:['tcp','udp','both'],ownership:['mine','available']},
        operations:{forwardId:['forward_1'],kind:['create','update','enable','disable','delete','retry','policy','revoke'],status:['accepted','running','succeeded','failed','superseded']},
        candidates:{idPrefix:['node_1'],nodeId:['node-a'],mode:['direct','relay','multihop'],protocol:['tcp','udp','both'],role:['ingress','transit','egress']}};
    for(const [kind,filters]of Object.entries(examples)as [ConsoleListKind,Record<string,string[]>][]){assert.deepEqual(consoleFilterNames[kind],Object.keys(filters));
        for(const [key,values]of Object.entries(filters))for(const value of values){const result=consoleQuery(kind,query([[key,value],['page','2']]));assert.deepEqual(result,{page:'2',limit:undefined,filters:{[key]:value}});}
    }
    refused(()=>consoleQuery('nodes',query('page=0&credential=unknown')),'Invalid console filter');
    refused(()=>consoleQuery('nodes',query('credential=valid&unknown=x&page=0')),'Invalid console query parameter');
    for(const value of ['','../bad','x'.repeat(129),'x\n'])refused(()=>consoleQuery('nodes',query([['idPrefix',value]])),'Invalid console filter');
    assert.equal(consoleQuery('nodes',query([['idPrefix','x'.repeat(128)]])).filters.idPrefix?.length,128);
    const source=await readFile(new URL('../src/modules/console-query-owner/http-query.ts',import.meta.url),'utf8');assert.match(source,/return nativeConsoleQuery\(kind, search, consoleFilterNames, validateConsoleFilters\)/);
    assert.equal(typeof validateConsoleFilters,'function');
});

test('113/187 actual HTTP decoded echoed filter crosses original ProbeRuns owner and parameterized native SQL while unknown status refuses before SQL',async()=>{
    const now=1700000000000,events:string[]=[],calls:{sql:string;args:unknown[]}[]=[];
    const tx={async execute(this:unknown,sql:string,args:unknown[]){assert.equal(this,tx);calls.push({sql,args});events.push(sql.includes('FROM probe_runs WHERE')?'history-sql':'loss-sql');return [[],[]];}}as unknown as Transaction;
    const db={async transaction<T>(this:unknown,action:(current:Transaction)=>Promise<T>){assert.equal(this,db);events.push('begin');const result=await action(tx);events.push('commit');return result;}}as unknown as MySqlUnitOfWork;
    const auth={async scope(current:Transaction,actor:string,scope:string,manage:boolean){assert.equal(this,auth);assert.equal(current,tx);assert.equal(actor,'actor-a');assert.equal(scope,'scope-a');assert.equal(manage,true);events.push('scope');}};
    let governance=true;
    const access:ResourceReadAccess<Transaction>={
        async principal(current,actor,scope){assert.equal(current,tx);assert.deepEqual([actor,scope],['actor-a','scope-a']);events.push('principal');return Object.freeze({actorId:actor,governance});},
        node:async()=>assert.fail('history listing does not read Node detail'),
        forward:async()=>assert.fail('history listing filters its original actor claim'),
        owned:async()=>assert.fail('listing must not enter detail ownership'),
    };
    const owner=new ProbeRuns(db,auth,access,new MySqlProbeRuns(),()=>now);
    const app=createControlApp({control:{} as never,runtime:{} as never,authority:{allow:async()=>{events.push('authority');},read:async()=>({maintenance:false})},
        services:{probeRuns:owner,authenticateObservation:async header=>{assert.equal(header,'Bearer original');events.push('authenticate');return 'actor-a';}}});
    const response=await app.request('/api/v1/scopes/scope-a/probe-runs?result%53tatus=%65choed&nodeId=node-a&forwardId=forward-a&state=consumed&limit=7',{headers:{authorization:'Bearer original'}});
    assert.equal(response.status,200);const body=await response.json()as Record<string,any>;
    assert.deepEqual(body.filters,{forwardId:'forward-a',nodeId:'node-a',probeId:null,state:'consumed',resultStatus:'echoed'});assert.deepEqual(body.items,[]);assert.equal(body.executionAuthorized,false);assert.equal(body.health,'unknown');
    assert.deepEqual(events,['authority','authenticate','begin','scope','principal','history-sql','loss-sql','commit']);
    assert.equal(calls.length,2);const history=calls[0]!;
    const fields='scope_id,probe_id,actor_id,forward_id,node_id,binding,instance_id,instance_generation,timeout_ms,issued_at,expires_at,state,closed_at,revision,updated_at,withdrawn_at,result_status,result_code,result_elapsed_ms,result_measured_at,result_valid_until,result_accepted_at,result_digest,recovery_suspended,measurement,service_selection,result_tls,echo_challenge,result_echo,result_request_bytes,result_response_bytes';
    const projection=fields.replace(',binding,',',IF(OCTET_LENGTH(binding)<=2048,binding,NULL) binding,')
        .replace(',service_selection,',",IF(service_selection IS NULL OR OCTET_LENGTH(service_selection)<=1024,service_selection,JSON_OBJECT('invalid','oversized')) service_selection,")
        .replace(',result_tls,',",IF(result_tls IS NULL OR OCTET_LENGTH(result_tls)<=512,result_tls,JSON_OBJECT('invalid','oversized')) result_tls,")
        .replace(',echo_challenge,',",IF(echo_challenge IS NULL OR OCTET_LENGTH(echo_challenge)<=512,echo_challenge,JSON_OBJECT('invalid','oversized')) echo_challenge,")
        .replace(',result_echo,',",IF(result_echo IS NULL OR OCTET_LENGTH(result_echo)<=512,result_echo,JSON_OBJECT('invalid','oversized')) result_echo,");
    assert.equal(history.sql,`SELECT ${projection} FROM probe_runs WHERE scope_id=? AND issued_at>=? AND issued_at<? AND CAST(forward_id AS BINARY)=CAST(? AS BINARY) AND CAST(node_id AS BINARY)=CAST(? AS BINARY) AND CAST(state AS BINARY)=CAST(? AS BINARY) AND CAST(result_status AS BINARY)=CAST(? AS BINARY) ORDER BY issued_at DESC,CAST(probe_id AS BINARY) DESC LIMIT 8`);
    assert.deepEqual(history.args,['scope-a',now-86400000,now,'forward-a','node-a','consumed','echoed']);
    assert.deepEqual(calls[1],{sql:'SELECT rows_expired,rows_evicted,updates_without_head FROM probe_run_scopes WHERE scope_id=?',args:['scope-a']});
    const before=calls.length;events.length=0;
    const rejected=await app.request('/api/v1/scopes/scope-a/probe-runs?resultStatus=unknown',{headers:{authorization:'Bearer original'}});
    assert.equal(rejected.status,422);assert.equal((await rejected.json()as {message:string}).message,'Invalid Probe history result status');assert.equal(calls.length,before);assert.deepEqual(events,['authority','authenticate']);
    await assert.rejects(owner.history('actor-other','scope-a',{resultStatus:'unknown'}),{code:'INVALID_CONFIG',message:'Invalid Probe history filter'});assert.equal(calls.length,before);
    governance=false;events.length=0;
    const personal=new ProbeRuns(db,auth,access,new MySqlProbeRuns(),()=>now);
    const own=await personal.history('actor-a','scope-a',{resultStatus:'echoed'});
    assert.equal(own.losses,null);assert.deepEqual(events,['begin','scope','principal','history-sql','commit']);
    assert.equal(calls.length,before+1);assert.match(calls.at(-1)!.sql,/issued_at<\? AND actor_id=\? AND CAST\(result_status AS BINARY\)=CAST\(\? AS BINARY\)/);
    assert.deepEqual(calls.at(-1)!.args,['scope-a',now-86400000,now,'actor-a','echoed']);
});
