import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as core from '@tunex/core';
import { digest } from '@tunex/contracts/shared';
import * as framework from '../src/framework/public.ts';
import * as path from '../src/modules/path-owner/public.ts';
import * as legacy from '../src/application/path-templates.ts';
import * as legacyParser from '../src/modules/path-template-contract.ts';
import { nativeWallClockSource, nativeIsoTime } from '../src/compatibility/public.ts';
import type { PathTemplateConfig, PathTemplateHead, PathTemplateRevision, PathTemplateReader, PathTemplateWriter } from '../src/modules/path-owner/public.ts';
import type { PathTemplateStoredHead, PathTemplateStoredRevision, PathTemplateStorageReader, PathTemplateStorage, ReadPageWindow, ResourceReadAccess } from '../src/framework/public.ts';
import type { ConsolePaging } from '../src/application/console-query.ts';

type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
const typeWitness:[Equal<PathTemplateHead,PathTemplateStoredHead>,Equal<PathTemplateRevision,PathTemplateStoredRevision<PathTemplateConfig>>,
    Equal<PathTemplateReader<symbol>,PathTemplateStorageReader<symbol,PathTemplateConfig>>,
    Equal<keyof PathTemplateWriter<symbol>,keyof PathTemplateStorage<symbol,PathTemplateConfig>>,Equal<ConsolePaging,ReadPageWindow>]=[true,true,true,true,true];
void typeWitness;
const hash='sha256:'+'a'.repeat(64),at=1800000000000;
const config=()=>({version:1,protocols:['udp','tcp'],nodes:['z-ingress','b-transit','a-egress'],
    endpoints:[{nodeId:'b-transit',revision:3},{nodeId:'a-egress',revision:4}],transport:{profileId:'profile',configRevision:2}});
const record=(revision=1):PathTemplateRevision=>{const value=path.parsePathTemplate(config());return {revision,config:value,profileDigest:hash,configDigest:digest({config:value,profileDigest:hash}),createdBy:'actor',createdAt:at};};
const error=(message:string,code='INTEGRITY_FAILURE',status=409)=>(value:unknown)=>{
    assert.equal((value as Error).message,message);assert.equal((value as {code:string}).code,code);assert.equal((value as {status:number}).status,status);return true;
};
function loaded(file:string,providers:Record<string,unknown>){
    const source=readFileSync(new URL('../src/modules/path-owner/'+file,import.meta.url),'utf8');
    const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
    const exports:Record<string,any>={};new vm.Script(javascript,{filename:file}).runInNewContext({exports,require(name:string){assert.ok(Object.hasOwn(providers,name),name);return providers[name];}});return exports;
}

test('54 original public legacy parser classes validators and mutable limits retain identity without construction time I/O',t=>{
    assert.equal(legacy.PathTemplateQueries,path.PathTemplateQueries);assert.equal(legacy.PathTemplateCommands,path.PathTemplateCommands);
    assert.equal(legacyParser.parsePathTemplate,path.parsePathTemplate);assert.equal(legacyParser.pathRequirements,path.pathRequirements);
    for(const name of ['PATH_TEMPLATE_LIMITS','validateTemplateHead','validateTemplateRevision'] as const)assert.equal(legacy[name],path[name]);
    assert.deepEqual(path.PATH_TEMPLATE_LIMITS,{templatesPerScope:128,revisionsPerTemplate:64});assert.equal(Object.isFrozen(path.PATH_TEMPLATE_LIMITS),false);
    Object.assign(path.PATH_TEMPLATE_LIMITS,{revisionsPerTemplate:2});
    try{assert.throws(()=>path.validateTemplateHead({templateId:'id',ownerActorId:'actor',currentRevision:3,archived:false}));}
    finally{Object.assign(path.PATH_TEMPLATE_LIMITS,{revisionsPerTemplate:64});}
    let reads=0;const original=()=>{reads++;return at;};t.mock.method(Date,'now',original);
    assert.equal(nativeWallClockSource(),Date.now);assert.equal(reads,0);
    const untouched=new Proxy({},{get(_target,key){assert.fail('construction read '+String(key));}});
    new path.PathTemplateQueries(untouched as never,untouched as never,untouched as never,untouched as never);
    new path.PathTemplateCommands(untouched as never,untouched as never,untouched as never,untouched as never,untouched as never,untouched as never);
    assert.equal(reads,0);assert.equal(path.PathTemplateQueries.length,4);assert.equal(path.PathTemplateCommands.length,6);
    for(const [owner,names] of [[path.PathTemplateQueries,['list','get']],[path.PathTemplateCommands,['publish','archive','classifyOwner']]] as const)
        for(const name of names){const method=Object.getOwnPropertyDescriptor(owner.prototype,name)!;assert.equal(method.enumerable,false);assert.equal(method.writable,true);assert.equal(method.configurable,true);assert.equal(method.value.constructor.name,'AsyncFunction');}
});

test('54 parser and stored hash keep terminal newline behavior canonical key order prototype and exception wrapping',()=>{
    assert.equal(path.pathTemplateHash(hash),true);
    for(const suffix of ['\n','\r','\u2028','\u2029'])assert.equal(path.pathTemplateHash(hash+suffix),false,suffix);
    for(const value of [hash+'\r\n',hash+'\n\n',hash.toUpperCase(),hash.slice(1),undefined,{},new String(hash)])assert.equal(path.pathTemplateHash(value),false);
    const plain=config(),nullObject=Object.assign(Object.create(null),plain),parsed=path.parsePathTemplate(nullObject);
    assert.deepEqual(Object.keys(parsed),['version','protocols','nodes','endpoints','transport']);assert.deepEqual(parsed.protocols,['tcp','udp']);
    assert.deepEqual(Object.keys(parsed.endpoints[0]!),['nodeId','revision']);assert.deepEqual(Object.keys(parsed.transport),['profileId','configRevision']);
    for(const value of [parsed,parsed.nodes,parsed.protocols,parsed.endpoints,parsed.endpoints[0],parsed.transport])assert.equal(Object.isFrozen(value),true);
    const decorated=Object.assign(Object.create({}),plain);assert.throws(()=>path.parsePathTemplate(decorated),error('Closed PathTemplate fields required','INVALID_CONFIG',422));
    const sentinel=new Error('native property getter'),bad={...config(),get version(){throw sentinel;}};
    assert.throws(()=>path.parsePathTemplate(bad),value=>value===sentinel);
    assert.throws(()=>path.validateTemplateRevision({...record(),config:bad as never},1),error('Invalid persisted PathTemplate configuration'));
    // Config parsing precedes corrupt revision/hash/time fields; no new normalization.
    assert.throws(()=>path.validateTemplateRevision({...record(),revision:0,createdAt:-1,config:{} as never},0),error('Invalid persisted PathTemplate configuration'));
    for(const number of [0,1.5,NaN,Infinity,65])assert.throws(()=>path.validateTemplateRevision(record(),number),error('Invalid persisted immutable PathTemplate revision'));
    for(const createdAt of [-1,0.5,NaN,Infinity,8640000000000001])assert.throws(()=>path.validateTemplateRevision({...record(),createdAt},1));
    for(const createdAt of [0,8640000000000000])assert.equal(path.validateTemplateRevision({...record(),createdAt},1).createdAt,createdAt);
    const newlineProfile=hash+'\n',newlineRecord={...record(),profileDigest:newlineProfile,configDigest:digest({config:parsed,profileDigest:newlineProfile})};
    assert.throws(()=>path.validateTemplateRevision(newlineRecord,1));
    assert.throws(()=>path.validateTemplateRevision({...record(),configDigest:record().configDigest+'\n'},1));
    const input={templateId:'id',ownerActorId:'actor',currentRevision:1,archived:false,extra:'native spread'};const result=path.validateTemplateHead(input);assert.notEqual(result,input);assert.equal((result as typeof input).extra,'native spread');assert.equal(Object.isFrozen(result),false);
});

test('54 current state and command digest helpers preserve independent input property order and original provider failures',async()=>{
    const digests:unknown[][]=[],failure=new Error('digest failure');let fail=false;
    const injected={nativeValueDigest(value:Record<string,unknown>){digests.push([Object.keys(value),value]);if(fail)throw failure;return digest(value);}};
    const state=loaded('template-state.ts',{'@tunex/core':core,'../../framework/public.ts':framework,'../../compatibility/public.ts':injected,'./template-values.ts':path});
    const value=record();state.validateTemplateRevision(value,1);assert.deepEqual(digests[0]![0],['config','profileDigest']);
    assert.equal((digests[0]![1] as Record<string,unknown>).profileDigest,hash);fail=true;assert.throws(()=>state.validateTemplateRevision(value,1),e=>e===failure);
    const calls:unknown[][]=[];let sampled=0;const compatibility={...injected,nativeWallClockSource(){calls.push(['capture']);return ()=>{sampled++;return at;};},nativeIsoTime};fail=false;
    const api=loaded('templates.ts',{'@tunex/core':core,'../../framework/public.ts':framework,'../../compatibility/public.ts':compatibility,'./template-values.ts':path,'./template-state.ts':path});
    const tx={},replay={status:200,body:{prior:'same raw object'}},db={transaction(action:(tx:object)=>unknown){calls.push(['begin']);return action(tx);}},auth={scope(...args:unknown[]){calls.push(['auth',...args]);}},requests={claim(_tx:unknown,request:unknown){calls.push(['claim',request]);return replay;}};
    const owner=new api.PathTemplateCommands(db,auth,{async owned(current:object,actor:string,scope:string,kind:string,id:string,governance:boolean){assert.equal(current,tx);assert.deepEqual([actor,scope,kind,id,governance],['actor','scope','path-template','id',true]);}},requests,{},{});assert.deepEqual(calls,[['capture']]);assert.equal(sampled,0);
    calls.length=0;digests.length=0;assert.equal(await owner.publish('actor','scope','id','key',0,config()),replay);
    const request=digests[0]![1] as Record<string,unknown>;assert.deepEqual(Object.keys(request),['method','path','expectedRevision','config']);assert.equal(request.path,'/api/v1/scopes/scope/path-templates/id');assert.equal(sampled,0);
    digests.length=0;await owner.archive('actor','scope','id','key',1);assert.deepEqual((digests[0]![0]),['method','path','expectedRevision']);
});

function fixture(){
    const tx=Object.freeze({original:Symbol()}),calls:string[]=[],failure=new Error('original owner failure');let failAt:string|undefined;
    const data={head:null as PathTemplateHead|null,revision:null as PathTemplateRevision|null,total:0,page:[] as PathTemplateHead[],clock:at,profile:hash,replay:undefined as unknown,published:[] as PathTemplateRevision[],audits:[] as unknown[]};
    const trace=(name:string,supplied:unknown)=>{assert.equal(supplied,tx);calls.push(name);if(failAt===name)throw failure;};
    const db={async transaction<T>(action:(current:typeof tx)=>Promise<T>){calls.push('begin');const before=structuredClone(data);try{const value=await action(tx);calls.push('commit');return value;}catch(e){Object.assign(data,before);calls.push('rollback');throw e;}}};
    const auth={async owner(current:typeof tx){assert.equal(current,tx);assert.fail('unexpected classification');},scope(current:typeof tx,_actor:string,_scope:string,manage=false){trace('auth:'+manage,current);return Promise.resolve();}};
    const requests={async claim<T>(current:typeof tx){trace('claim',current);return data.replay as T|undefined;},async respond(current:typeof tx){trace('respond',current);}};
    const store:PathTemplateWriter<typeof tx>={
        async classifyOwner(){assert.fail('unexpected classification');},async auditOwnership(){assert.fail('unexpected classification');},
        async lockScope(current){trace('scope-lock',current);},async count(current){trace('count',current);return data.total;},
        async head(current,_scope,_id,lock=false){trace('head:'+lock,current);return data.head;},async revision(current){trace('revision',current);return data.revision;},
        async list(current){trace('list',current);return {total:data.total,items:data.page};},
        async publish(current,_scope,_id,value){trace('publish',current);data.published.push(value);},async archive(current){trace('archive',current);},
        async audit(current,...args){trace('audit',current);data.audits.push(args);}
    };
    const references={async validate(current:typeof tx){trace('references',current);return {profileDigest:data.profile};}};
    const clock=()=>{calls.push('clock');if(failAt==='clock')throw failure;return data.clock;};
    const access:ResourceReadAccess<typeof tx>={
        async principal(current,actor,scope){assert.equal(current,tx);assert.equal(scope,'scope');if(failAt==='access')throw failure;return {actorId:actor,governance:false};},
        async owned(current,actor,scope,kind,id,allowGovernance){assert.equal(current,tx);assert.deepEqual([actor,scope,kind,id],['actor','scope','path-template','id']);assert.equal(typeof allowGovernance,'boolean');if(failAt==='access')throw failure;},
        async forward(){assert.fail('unexpected Forward read');},async node(){assert.fail('unexpected Node read');}
    };
    return {tx,calls,data,failure,fail(name:string){failAt=name;},store,references,commands:new path.PathTemplateCommands(db,auth,access,requests,store,references,clock),queries:new path.PathTemplateQueries(db,auth,access,store)};
}

test('54 complete command auth replay lock CAS prior-validation clock reference quota publication audit response prefix and failures',async()=>{
    const expected=['begin','auth:true','claim','scope-lock','head:true','clock','references','count','publish','audit','respond','commit'];
    const first=fixture();assert.equal((await first.commands.publish('actor','scope','id','key',0,config())).status,202);assert.deepEqual(first.calls,expected);
    for(const name of expected.slice(1,-1)){
        const f=fixture();f.fail(name);await assert.rejects(f.commands.publish('actor','scope','id','key',0,config()),e=>e===f.failure);
        assert.deepEqual(f.calls,[...expected.slice(0,expected.indexOf(name)+1),'rollback']);assert.equal(f.data.published.length,0);assert.equal(f.data.audits.length,0);
    }
    const replay=fixture();replay.data.replay={original:true};assert.equal(await replay.commands.publish('actor','scope','id','key',0,config()),replay.data.replay);assert.deepEqual(replay.calls,['begin','auth:true','claim','commit']);
    for(const mode of ['conflict','archived','missing-old','invalid-old','bad-clock','bad-profile','quota'] as const){
        const f=fixture();f.data.head={templateId:'id',ownerActorId:'actor',currentRevision:1,archived:mode==='archived'};f.data.revision=record();
        if(mode==='missing-old')f.data.revision=null;if(mode==='invalid-old')f.data.revision={...record(),config:{} as never};
        if(mode==='bad-clock')f.data.clock=NaN;if(mode==='bad-profile')f.data.profile='bad';if(mode==='quota'){f.data.head=null;f.data.revision=null;f.data.total=128;}
        await assert.rejects(f.commands.publish('actor','scope','id','key',mode==='conflict'||mode==='quota'?0:1,config()));
        assert.equal(f.calls.includes('publish'),false);assert.equal(f.calls.includes('respond'),false);
        if(['conflict','archived','missing-old','invalid-old'].includes(mode))assert.equal(f.calls.includes('clock'),false);
        if(mode==='bad-clock')assert.equal(f.calls.includes('references'),false);
    }
    const unchanged=fixture();unchanged.data.head={templateId:'id',ownerActorId:'actor',currentRevision:1,archived:false};unchanged.data.revision=record();
    assert.equal((await unchanged.commands.publish('actor','scope','id','key',1,config())).body.changed,false);
    assert.deepEqual(unchanged.calls,['begin','auth:true','claim','scope-lock','head:true','revision','clock','references','respond','commit']);
    for(const at of [-1,0.5,Infinity,8640000000000001]){const f=fixture();f.data.clock=at;await assert.rejects(f.commands.publish('actor','scope','id','key',0,config()),error('Invalid template command time'));assert.equal(f.calls.includes('references'),false);}
});

test('54 query first-refusal order bounded page corruption and archived immutable metadata without reference authorization',async()=>{
    for(const mode of ['missing','head','missing-revision','configuration','timestamp'] as const){
        const f=fixture();f.data.head=mode==='missing'?null:{templateId:'id',ownerActorId:'actor',currentRevision:mode==='head'?0:1,archived:true};f.data.revision=mode==='missing-revision'?null:record();
        if(mode==='configuration')f.data.revision={...record(),config:{} as never};if(mode==='timestamp')f.data.revision={...record(),createdAt:-1};
        await assert.rejects(f.queries.get('actor','scope','id'));assert.equal(f.calls[1],'auth:false');assert.equal(f.calls.at(-1),'rollback');assert.equal(f.calls.includes('references'),false);
        if(mode==='missing'||mode==='head')assert.equal(f.calls.includes('revision'),false);
    }
    const f=fixture();f.data.head={templateId:'id',ownerActorId:'actor',currentRevision:2,archived:true};f.data.revision=record(1);const view=await f.queries.get('actor','scope','id',1);
    assert.deepEqual(f.calls,['begin','auth:false','head:false','revision','commit']);assert.equal(view.createdAt,new Date(at).toISOString());assert.equal(view.currentRevision,2);assert.equal(view.archived,true);assert.equal(view.reserved,false);assert.equal(Object.isFrozen(view.config),true);
    for(const input of [null,[],Object.create({}),{page:1},{limit:1},{prefix:'x'.repeat(129)},{prefix:'%'},{extra:true}]){const f=fixture();await assert.rejects(f.queries.list('actor','scope',input as never));assert.equal(f.calls.length,0);}
    for(const data of [{total:-1,page:[]},{total:129,page:[]},{total:0.5,page:[]},{total:2,page:[{templateId:'id',ownerActorId:'actor',currentRevision:1,archived:false},{templateId:'id',ownerActorId:'actor',currentRevision:1,archived:false}]},{total:1,page:[{templateId:'foreign',ownerActorId:'actor',currentRevision:1,archived:false}]}]){
        const f=fixture();Object.assign(f.data,data);await assert.rejects(f.queries.list('actor','scope',{prefix:'id'}),error('Invalid bounded PathTemplate page'));assert.equal(f.calls.at(-1),'rollback');
    }
    const empty=fixture();const page=await empty.queries.list('actor','scope');assert.equal(page.total,0);assert.equal(Object.isFrozen(page),true);assert.equal(page.executionAuthorized,false);
});

test('54 archival validates prior revision and clock then writes only changed archive audit response and preserves every original failure',async()=>{
    const expected=['begin','auth:true','claim','scope-lock','head:true','revision','clock','archive','audit','respond','commit'];
    for(const fail of [undefined,...expected.slice(1,-1)]){
        const f=fixture();f.data.head={templateId:'id',ownerActorId:'actor',currentRevision:1,archived:false};f.data.revision=record();if(fail)f.fail(fail);
        if(fail){await assert.rejects(f.commands.archive('actor','scope','id','key',1),e=>e===f.failure);assert.deepEqual(f.calls,[...expected.slice(0,expected.indexOf(fail)+1),'rollback']);}
        else{const result=await f.commands.archive('actor','scope','id','key',1);assert.equal(result.status,202);assert.deepEqual(result.body,{templateId:'id',revision:1,configDigest:record().configDigest,archived:true,changed:true});assert.deepEqual(f.calls,expected);}
        assert.equal(f.calls.includes('references'),false);assert.equal(f.calls.includes('publish'),false);
    }
    const old=fixture();old.data.head={templateId:'id',ownerActorId:'actor',currentRevision:1,archived:true};old.data.revision=record();
    assert.equal((await old.commands.archive('actor','scope','id','key',1)).body.changed,false);
    assert.deepEqual(old.calls,['begin','auth:true','claim','scope-lock','head:true','revision','clock','respond','commit']);
    for(const run of [(f:ReturnType<typeof fixture>)=>f.commands.archive('actor','scope','id','key',0),
        (f:ReturnType<typeof fixture>)=>f.commands.publish('bad/id','scope','id','key',0,config()),
        (f:ReturnType<typeof fixture>)=>f.commands.publish('actor','scope','id','key\n',0,config()),
        (f:ReturnType<typeof fixture>)=>f.commands.publish('actor','scope','id','key',NaN,config())]){
        const f=fixture();await assert.rejects(run(f));assert.deepEqual(f.calls,[]);
    }
});

test('54 native references sort every Node and Endpoint retain provider receiver original identity and first refusal prefix',async()=>{
    const parsed=path.parsePathTemplate(config()),tx={},expected=['node:a-egress','node:b-transit','node:z-ingress','profile','endpoint:a-egress','endpoint:b-transit'];
    for(const mode of ['valid','node-id','node-scope','capability','profile-id','profile-revision','protocol','endpoint-id','endpoint-revision',...expected] as const){
        const calls:string[]=[],failure=new Error('original reference provider');
        const step=(event:string,current:unknown)=>{assert.equal(current,tx);calls.push(event);if(mode===event)throw failure;};
        const nodes={async authorizedRelayNode(this:unknown,current:unknown,actor:string,scope:string,id:string){
            assert.equal(this,nodes);assert.equal(actor,'actor');assert.equal(scope,'scope');step('node:'+id,current);
            return {nodeId:mode==='node-id'?'foreign':id,scopeId:mode==='node-scope'?'foreign':scope,capabilities:mode==='capability'?['tcp']:path.pathRequirements(parsed)};
        }};
        const profiles={async resolve(this:unknown,current:unknown,actor:string,scope:string,id:string,revision:number){
            assert.equal(this,profiles);assert.deepEqual([actor,scope,id,revision],['actor','scope','profile',2]);step('profile',current);
            return {profileId:mode==='profile-id'?'foreign':id,revision:mode==='profile-revision'?3:revision,configDigest:hash,config:{protocols:mode==='protocol'?['tcp']:['tcp','udp']}};
        }};
        const endpoints={async resolve(this:unknown,current:unknown,id:string){assert.equal(this,endpoints);step('endpoint:'+id,current);
            return {nodeId:mode==='endpoint-id'?'foreign':id,revision:mode==='endpoint-revision'?0:id==='a-egress'?4:3};
        }};
        const references=new path.NativePathReferences(nodes as never,profiles as never,endpoints as never);
        if(mode==='valid'){assert.deepEqual(await references.validate(tx,'actor','scope',parsed),{profileDigest:hash});assert.deepEqual(calls,expected);}
        else{
            const isProviderFailure=expected.includes(mode);
            await assert.rejects(references.validate(tx,'actor','scope',parsed),isProviderFailure?e=>e===failure:
                mode.startsWith('node')||mode==='capability'?error('Every template Node must declare the required native capabilities','UNSUPPORTED_CAPABILITY',422):
                mode.startsWith('profile')||mode==='protocol'?error('Template Profile binding or business protocols differ'):
                error('Template Endpoint revision changed; prepare an explicit new template proposal','REVISION_CONFLICT'));
            const last=isProviderFailure?mode:mode.startsWith('node')||mode==='capability'?expected[0]!:mode.startsWith('profile')||mode==='protocol'?'profile':'endpoint:a-egress';
            assert.deepEqual(calls,expected.slice(0,expected.indexOf(last)+1));
        }
    }
});

test('54 caller ownership denials preserve the original transaction and prevent template reads or mutation',async()=>{
    for(const action of ['list','get','archive','update','replay'] as const){
        const f=fixture();f.fail('access');f.data.head={templateId:'id',ownerActorId:'other',currentRevision:1,archived:false};f.data.revision=record();
        if(action==='replay')f.data.replay={prior:true};
        await assert.rejects(action==='list'?f.queries.list('actor','scope'):action==='get'?f.queries.get('actor','scope','id'):action==='archive'?f.commands.archive('actor','scope','id','key',1):f.commands.publish('actor','scope','id','key',1,config()),e=>e===f.failure);
        assert.equal(f.calls.at(-1),'rollback');for(const denied of ['list','revision','publish','archive','respond'])assert.equal(f.calls.includes(denied),false);
    }
});
