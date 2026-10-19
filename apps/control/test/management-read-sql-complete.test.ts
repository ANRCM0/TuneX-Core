import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MySqlManagementReadStore, MySqlProfileReferenceReadStore, MySqlTunnelMetadataReadStore } from '../src/infrastructure/mysql-management-read.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import type { ManagementReadEffects, ReadFilters, ReadPageWindow, ReadProjectionValues } from '../src/framework/public.ts';
import { ConsoleReadModels } from '../src/modules/console-query-owner/public.ts';
import { nativeReadProjectionValues } from '../src/compatibility/public.ts';

function fixture(){
    const trace:string[]=[],statements:{sql:string;args:unknown[]}[]=[],failure=new Error('raw SELECT failure');
    const first={opaque:'first'},last=[{opaque:'last',raw:null}],replies:unknown[][]=[[first],last];
    const state={failAt:0,clock:100,validateAt:0,failValidation:0,failClock:0,hook:undefined as ((ordinal:number)=>void|Promise<void>)|undefined};
    const driver={};
    // The only native surface the raw adapter receives is mysql2 execute. Any
    // attempted connection, nested transaction, lock or retry is observable here.
    const tx=new Proxy(driver,{get(target,key,receiver){assert.equal(key,'execute');return Reflect.get(target,key,receiver);}}) as unknown as Transaction;
    // mysql2 calls execute with its supplied transaction as the receiver.
    Object.defineProperty(driver,'execute',{value:async function(this:unknown,sql:string,args:unknown[]){
        assert.equal(this,tx);assert.equal(sql.startsWith('SELECT'),true);
        statements.push({sql,args});const ordinal=statements.length;trace.push('execute:'+ordinal);
        if(state.failAt===ordinal)throw failure;
        await state.hook?.(ordinal);trace.push('done:'+ordinal);return [replies[ordinal-1]??[],[]];
    }});
    const effects:ManagementReadEffects={
        now(){assert.equal(this,effects);trace.push('clock:'+state.clock);if(state.failClock===state.clock)throw failure;return state.clock++;},
        validateFilters(kind,filters){trace.push('validate:'+kind);state.validateAt++;if(state.failValidation===state.validateAt)throw failure;assert.equal(filters,currentFilters);},
    };
    let currentFilters:ReadFilters={};
    const management=new MySqlManagementReadStore(effects),profiles=new MySqlProfileReferenceReadStore(),tunnels=new MySqlTunnelMetadataReadStore();
    return {tx,trace,statements,failure,first,last,replies,state,effects,management,profiles,tunnels,setFilters(value:ReadFilters){currentFilters=value;}};
}
type Fixture=ReturnType<typeof fixture>;
type Scenario={name:string;count:number;prefix:string[];page:boolean;sql:string[];args:unknown[][];call:(f:Fixture,project:(value:unknown)=>unknown)=>Promise<unknown>};
const window=():ReadPageWindow=>({page:2,limit:3,offset:3});
function configured(f:Fixture,filters:ReadFilters){f.setFilters(filters);return filters;}
const scenarios:Scenario[]=[
    {name:'nodes',count:2,prefix:['clock:100','validate:nodes','validate:nodes'],page:true,
        sql:["SELECT COUNT(*) n FROM nodes WHERE scope_id=? AND id LIKE CONCAT(?,'%') ESCAPE '!' AND revoked=FALSE AND credential_until>?","SELECT n.id,n.revoked,n.credential_until,n.facts,r.session_epoch,r.snapshot_generation,r.received_at FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE n.scope_id=? AND n.id LIKE CONCAT(?,'%') ESCAPE '!' AND n.revoked=FALSE AND n.credential_until>? ORDER BY n.id LIMIT 3 OFFSET 3"],
        args:[['scope-a','node!_',100],['scope-a','node!_',100]],call:(f,p)=>f.management.nodes(f.tx,'scope-a',window(),configured(f,{idPrefix:'node_',credential:'valid'}),p)},
    {name:'forwards',count:2,prefix:['clock:100','validate:forwards','clock:101','validate:forwards'],page:true,
        sql:["SELECT COUNT(*) n FROM forwards WHERE scope_id=? AND id LIKE CONCAT(?,'%') ESCAPE '!' AND deleting=FALSE AND spec->'$.enabled'=CAST(? AS JSON) AND recovery_suspended=? AND JSON_CONTAINS(spec->'$.protocols',?)","SELECT f.id,f.revision,f.spec,f.recovery_suspended,o.id operation_id,o.kind operation_kind,o.status operation_status FROM forwards f LEFT JOIN operations o ON o.id=(SELECT recent.id FROM operations recent WHERE recent.forward_id=f.id ORDER BY recent.target_revision DESC,recent.created_at DESC,recent.id DESC LIMIT 1) WHERE f.scope_id=? AND f.id LIKE CONCAT(?,'%') ESCAPE '!' AND f.deleting=FALSE AND f.spec->'$.enabled'=CAST(? AS JSON) AND f.recovery_suspended=? AND JSON_CONTAINS(f.spec->'$.protocols',?) ORDER BY f.id LIMIT 3 OFFSET 3"],
        args:[['scope-a','f!_','false',false,'["tcp","udp"]'],['scope-a','f!_','false',false,'["tcp","udp"]']],call:(f,p)=>f.management.forwards(f.tx,'scope-a',window(),configured(f,{idPrefix:'f_',enabled:'false',recoverySuspended:'false',protocol:'both'}),p)},
    {name:'operations',count:2,prefix:['clock:100','validate:operations'],page:true,
        sql:["SELECT COUNT(*) n FROM operations WHERE scope_id=? AND id LIKE CONCAT(?,'%') ESCAPE '!' AND forward_id=? AND kind=? AND status=?","SELECT id,forward_id,kind,status,target_revision,created_at,updated_at,last_error,recovery_invalidated,cleanup_pending FROM operations WHERE scope_id=? AND id LIKE CONCAT(?,'%') ESCAPE '!' AND forward_id=? AND kind=? AND status=? ORDER BY created_at DESC,id DESC LIMIT 3 OFFSET 3"],
        args:[['scope-a','o!_','forward-a','retry','failed'],['scope-a','o!_','forward-a','retry','failed']],call:(f,p)=>f.management.operations(f.tx,'scope-a',window(),configured(f,{idPrefix:'o_',forwardId:'forward-a',kind:'retry',status:'failed'}),p)},
    {name:'candidates',count:2,prefix:['clock:100','validate:candidates'],page:true,
        sql:["SELECT COUNT(*) n FROM nodes n WHERE n.scope_id=? AND n.id LIKE CONCAT(?,'%') ESCAPE '!' AND n.revoked=FALSE AND n.credential_until>? AND EXISTS(SELECT 1 FROM node_grants g WHERE g.node_id=n.id AND g.actor_id=?) AND n.id=? AND JSON_CONTAINS(n.facts->'$.capabilities',?) AND (JSON_CONTAINS(n.facts->'$.capabilities','\"tcp\"') OR JSON_CONTAINS(n.facts->'$.capabilities','\"udp\"')) AND JSON_LENGTH(n.facts->'$.allowedListenerAddresses')>0 AND JSON_LENGTH(n.facts->'$.allowedPorts')>0","SELECT n.id,n.revoked,n.credential_until,n.facts,r.session_epoch,r.snapshot_generation,r.received_at FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE n.scope_id=? AND n.id LIKE CONCAT(?,'%') ESCAPE '!' AND n.revoked=FALSE AND n.credential_until>? AND EXISTS(SELECT 1 FROM node_grants g WHERE g.node_id=n.id AND g.actor_id=?) AND n.id=? AND JSON_CONTAINS(n.facts->'$.capabilities',?) AND (JSON_CONTAINS(n.facts->'$.capabilities','\"tcp\"') OR JSON_CONTAINS(n.facts->'$.capabilities','\"udp\"')) AND JSON_LENGTH(n.facts->'$.allowedListenerAddresses')>0 AND JSON_LENGTH(n.facts->'$.allowedPorts')>0 ORDER BY n.id LIMIT 3 OFFSET 3"],
        args:[['scope-a','cand!_',100,'actor-a','node-a','["adp.3","tcp"]'],['scope-a','cand!_',100,'actor-a','node-a','["adp.3","tcp"]']],call:(f,p)=>f.management.candidates(f.tx,'actor-a','scope-a',window(),configured(f,{idPrefix:'cand_',nodeId:'node-a'}),['adp.3','tcp'],p)},
    {name:'overview',count:1,prefix:[],page:false,
        sql:["SELECT\n                    (SELECT COUNT(*) FROM nodes WHERE scope_id=?) nodes,\n                    (SELECT COUNT(*) FROM forwards WHERE scope_id=? AND deleting=FALSE) forwards,\n                    (SELECT COUNT(*) FROM operations WHERE scope_id=? AND status IN ('accepted','running')) active,\n                    (SELECT COUNT(*) FROM operations WHERE scope_id=? AND status='failed') failed"],
        args:[['scope-a','scope-a','scope-a','scope-a']],call:(f,p)=>f.management.overview(f.tx,'scope-a',p)},
    {name:'diagnostics',count:1,prefix:[],page:false,
        sql:['SELECT n.id,n.revoked,n.credential_until,r.session_epoch,r.snapshot_generation,r.last_report_sequence,r.received_at,r.last_report,s.valid_until FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id LEFT JOIN snapshots s ON s.node_id=n.id AND s.generation=r.snapshot_generation WHERE n.id=? AND n.scope_id=?'],
        args:[['node-a','scope-a']],call:(f,p)=>f.management.diagnostics(f.tx,'scope-a','node-a',p)},
    {name:'profile',count:1,prefix:[],page:false,
        sql:['SELECT current_revision FROM transport_profiles WHERE id=? AND scope_id=?'],args:[['profile-a','scope-a']],call:(f,p)=>f.profiles.profile(f.tx,'scope-a','profile-a',p)},
    {name:'profile references',count:2,prefix:[],page:true,
        sql:["SELECT COUNT(*) n FROM forwards WHERE scope_id=? AND deleting=FALSE AND CAST(JSON_UNQUOTE(spec->'$.transport.profileId') AS BINARY)=CAST(? AS BINARY) AND spec->'$.transport.configRevision'=CAST(? AS JSON)","SELECT id,revision,spec,recovery_suspended FROM forwards WHERE scope_id=? AND deleting=FALSE AND CAST(JSON_UNQUOTE(spec->'$.transport.profileId') AS BINARY)=CAST(? AS BINARY) AND spec->'$.transport.configRevision'=CAST(? AS JSON) ORDER BY id LIMIT 3 OFFSET 3"],
        args:[['scope-a','profile-a','2'],['scope-a','profile-a','2']],call:(f,p)=>f.profiles.references(f.tx,'scope-a','profile-a',window(),2,p)},
    {name:'tunnel node',count:1,prefix:[],page:false,
        sql:["SELECT n.id,n.revoked,n.credential_until,n.facts->'$.capabilities' capabilities,r.session_epoch,r.snapshot_generation,r.received_at\n             FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE n.id=? AND n.scope_id=?"],args:[['node-a','scope-a']],call:(f,p)=>f.tunnels.node(f.tx,'scope-a','node-a',p)},
    {name:'tunnel endpoint',count:1,prefix:[],page:false,
        sql:['SELECT revision,config FROM node_relay_endpoints WHERE node_id=?'],args:[['node-a']],call:(f,p)=>f.tunnels.endpoint(f.tx,'node-a',p)},
    {name:'tunnel peers',count:2,prefix:[],page:true,
        sql:['SELECT COUNT(*) total,COALESCE(SUM(revoked=FALSE AND valid_until>? AND (retire_after IS NULL OR retire_after>?)),0) window_count FROM node_relay_credentials WHERE node_id=?',"SELECT fingerprint,issued_at,valid_until,retire_after,revoked FROM node_relay_credentials WHERE node_id=?\n             ORDER BY (revoked=FALSE AND valid_until>? AND (retire_after IS NULL OR retire_after>?)) DESC,issued_at DESC,fingerprint DESC LIMIT 4"],args:[[500,500,'node-a'],['node-a',500,500]],call:(f,p)=>f.tunnels.peers(f.tx,'node-a',500,p)},
    {name:'tunnel references',count:2,prefix:[],page:true,
        sql:["SELECT COUNT(*) n FROM forwards WHERE scope_id=? AND deleting=FALSE AND spec->'$.path.via' IS NOT NULL AND\n            (CAST(JSON_UNQUOTE(spec->'$.ingress.nodeId') AS BINARY)=CAST(? AS BINARY) OR JSON_CONTAINS(spec->'$.path.via',JSON_QUOTE(?)))","SELECT id,revision,spec,recovery_suspended FROM forwards WHERE scope_id=? AND deleting=FALSE AND spec->'$.path.via' IS NOT NULL AND\n            (CAST(JSON_UNQUOTE(spec->'$.ingress.nodeId') AS BINARY)=CAST(? AS BINARY) OR JSON_CONTAINS(spec->'$.path.via',JSON_QUOTE(?))) ORDER BY id LIMIT 3 OFFSET 3"],args:[['scope-a','node-a','node-a'],['scope-a','node-a','node-a']],call:(f,p)=>f.tunnels.references(f.tx,'scope-a','node-a',window(),p)},
];

for(const scenario of scenarios)test(`28 raw ${scenario.name} exact ordered literal SELECT args raw identity single synchronous final projection and every statement refusal`,async()=>{
    const f=fixture(),result={originalResult:true};assert.deepEqual(f.trace,[]);assert.deepEqual(f.statements,[]);let callbacks=0;
    const value=await scenario.call(f,raw=>{
        callbacks++;f.trace.push('project');assert.equal(f.statements.length,scenario.count);assert.equal(f.trace.at(-2),'done:'+scenario.count);
        if(scenario.page){assert.ok(raw!==null&&typeof raw==='object');assert.equal(Reflect.get(raw,'count'),f.first);assert.equal(Reflect.get(raw,'records'),f.last);}
        else assert.equal(raw,f.first);
        return result;
    });
    assert.equal(value,result);assert.equal(callbacks,1);assert.deepEqual(f.statements,scenario.sql.map((sql,i)=>({sql,args:scenario.args[i]})));
    assert.deepEqual(f.trace,[...scenario.prefix,...Array.from({length:scenario.count},(_,i)=>['execute:'+(i+1),'done:'+(i+1)]).flat(),'project']);
    for(let ordinal=1;ordinal<=scenario.count;ordinal++){
        const g=fixture();g.state.failAt=ordinal;let reached=false;
        await assert.rejects(scenario.call(g,()=>{reached=true;return result;}),error=>error===g.failure);
        assert.equal(reached,false);assert.deepEqual(g.statements,scenario.sql.slice(0,ordinal).map((sql,i)=>({sql,args:scenario.args[i]})));
        assert.deepEqual(g.trace,[...scenario.prefix,...Array.from({length:ordinal-1},(_,i)=>['execute:'+(i+1),'done:'+(i+1)]).flat(),'execute:'+ordinal]);
    }
    const g=fixture();let throws=0;const completion:string[]=[];
    await assert.rejects((async()=>{completion.push('begin');try{await scenario.call(g,()=>{throws++;completion.push('project');throw g.failure;});completion.push('commit');}catch(error){completion.push('rollback');throw error;}})(),error=>error===g.failure);
    assert.equal(throws,1);assert.equal(g.statements.length,scenario.count);assert.deepEqual(completion,['begin','project','rollback']);
    for(const empty of [[],[null]]){
        const h=fixture();h.replies[0]=empty;h.replies[1]=[];let rawValue:unknown;
        await scenario.call(h,value=>{rawValue=value;return result;});
        if(scenario.page){assert.ok(rawValue!==null&&typeof rawValue==='object');assert.equal(Reflect.get(rawValue,'count'),empty[0]);assert.equal(Reflect.get(rawValue,'records'),h.replies[1]);}
        else assert.equal(rawValue,empty[0]);
    }
});

test('28 all paged raw readers retain live post-count page bounds pre-count filter arguments and final callback ordering without recapture',async()=>{
    for(const kind of ['nodes','forwards','operations','candidates','profile','tunnel'] as const){
        const f=fixture(),paging=window(),filters={idPrefix:'before_'};f.setFilters(filters);
        let entered!:()=>void,release!:()=>void;const waiting=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
        f.state.hook=async ordinal=>{if(ordinal===1){entered();await gate;}};
        let projected=0;const project=(raw:unknown)=>{projected++;assert.equal(f.trace.at(-1),'done:2');assert.equal(paging.page,3);assert.equal(paging.limit,4);return raw;};
        const pending=kind==='nodes'?f.management.nodes(f.tx,'scope-a',paging,filters,project):kind==='forwards'?f.management.forwards(f.tx,'scope-a',paging,filters,project):kind==='operations'?f.management.operations(f.tx,'scope-a',paging,filters,project):kind==='candidates'?f.management.candidates(f.tx,'actor-a','scope-a',paging,filters,['adp.3'],project):kind==='profile'?f.profiles.references(f.tx,'scope-a','profile-a',paging,undefined,project):f.tunnels.references(f.tx,'scope-a','node-a',paging,project);
        await waiting;assert.equal(projected,0);assert.equal(f.statements.length,1);
        filters.idPrefix='after_';paging.page=3;paging.limit=4;paging.offset=8;release();await pending;
        assert.equal(projected,1);assert.equal(f.statements.length,2);assert.ok(f.statements[1]!.sql.endsWith('LIMIT 4 OFFSET 8'));
        assert.equal(f.statements[0]!.args,f.statements[1]!.args,'original count argument array is reused by page');
        if(kind!=='profile'&&kind!=='tunnel'){assert.equal(f.statements[0]!.args[1],'before!_');assert.equal(f.state.validateAt,kind==='nodes'||kind==='forwards'?2:1);}
        assert.equal(f.state.clock,kind==='forwards'?102:kind==='profile'||kind==='tunnel'?100:101);
    }
});

test('28 Node and Forward retain count-versus-page filter evaluation and original separate clock or validation failure precedence',async()=>{
    for(const kind of ['nodes','forwards'] as const){
        const f=fixture(),filters={get idPrefix(){return f.state.validateAt===1?'count_':'page_';}};f.setFilters(filters);
        const project=(raw:unknown)=>raw;
        await (kind==='nodes'?f.management.nodes(f.tx,'scope-a',window(),filters,project):f.management.forwards(f.tx,'scope-a',window(),filters,project));
        assert.deepEqual(f.statements[0]!.args,['scope-a','count!_']);assert.equal(f.statements[0]!.args,f.statements[1]!.args);
        assert.equal(f.state.validateAt,2);assert.equal(f.state.clock,kind==='nodes'?101:102);
        for(const [failedClock,failedValidation,prefix] of [
            [100,0,['clock:100']],
            [0,1,['clock:100','validate:'+kind]],
            ...(kind==='forwards'?[[101,0,['clock:100','validate:forwards','clock:101']]]:[]),
            [0,2,kind==='nodes'?['clock:100','validate:nodes','validate:nodes']:['clock:100','validate:forwards','clock:101','validate:forwards']],
        ] as [number,number,string[]][]){
            const g=fixture();g.state.failClock=failedClock;g.state.failValidation=failedValidation;const filter={};g.setFilters(filter);
            await assert.rejects(kind==='nodes'?g.management.nodes(g.tx,'scope-a',window(),filter,()=>assert.fail('no projection')):g.management.forwards(g.tx,'scope-a',window(),filter,()=>assert.fail('no projection')),error=>error===g.failure);
            assert.deepEqual(g.trace,prefix);assert.equal(g.statements.length,0);
        }
    }
});

test('28 raw candidate capability JSON is computed once before SQL and serializer or filter getter failures never enter the driver',async()=>{
    const f=fixture(),filters={};f.setFilters(filters);
    const capabilities=Object.assign(['adp.3'],{toJSON(){f.trace.push('capability-json');return ['adp.3','tcp'];}});
    await f.management.candidates(f.tx,'actor-a','scope-a',window(),filters,capabilities,raw=>raw);
    assert.deepEqual(f.trace.slice(0,4),['clock:100','validate:candidates','capability-json','execute:1']);
    assert.equal(f.trace.filter(value=>value==='capability-json').length,1);assert.equal(f.statements[0]!.args.at(-1),'["adp.3","tcp"]');
    const g=fixture(),empty={};g.setFilters(empty);
    const broken=Object.assign(['adp.3'],{toJSON(){g.trace.push('capability-json');throw g.failure;}});
    await assert.rejects(g.management.candidates(g.tx,'actor-a','scope-a',window(),empty,broken,()=>assert.fail('no projection')),error=>error===g.failure);
    assert.deepEqual(g.trace,['clock:100','validate:candidates','capability-json']);assert.equal(g.statements.length,0);
    const h=fixture(),throwing={get idPrefix():string{h.trace.push('filter-getter');throw h.failure;}};h.setFilters(throwing);
    await assert.rejects(h.management.nodes(h.tx,'scope-a',window(),throwing,()=>assert.fail('no projection')),error=>error===h.failure);
    assert.deepEqual(h.trace,['clock:100','validate:nodes','filter-getter']);assert.equal(h.statements.length,0);
});

test('28 raw pagination keeps maximum literal window and rejects each invalid late page before second statement with no retry or projection',async()=>{
    for(const kind of ['nodes','forwards','operations','candidates','profile','tunnel'] as const){
        const run=(f:Fixture,paging:ReadPageWindow)=>{
            const filters={};f.setFilters(filters);const project=(raw:unknown)=>raw;
            return kind==='nodes'?f.management.nodes(f.tx,'scope-a',paging,filters,project):kind==='forwards'?f.management.forwards(f.tx,'scope-a',paging,filters,project):kind==='operations'?f.management.operations(f.tx,'scope-a',paging,filters,project):kind==='candidates'?f.management.candidates(f.tx,'actor-a','scope-a',paging,filters,[],project):kind==='profile'?f.profiles.references(f.tx,'scope-a','profile-a',paging,undefined,project):f.tunnels.references(f.tx,'scope-a','node-a',paging,project);
        };
        const f=fixture();await run(f,{page:10000,limit:100,offset:999900});assert.ok(f.statements[1]!.sql.endsWith('LIMIT 100 OFFSET 999900'));
        for(const paging of [{page:0,limit:3,offset:0},{page:10001,limit:3,offset:30000},{page:1.5,limit:3,offset:1.5},{page:2,limit:0,offset:0},{page:2,limit:101,offset:101},{page:2,limit:3,offset:2},{page:2,limit:3,offset:Number.MAX_SAFE_INTEGER+1}]){
            const g=fixture();await assert.rejects(run(g,paging),{code:'INVALID_CONFIG',message:'Invalid bounded pagination'});assert.equal(g.statements.length,1);assert.equal(g.trace.at(-1),'done:1');
        }
    }
});

test('28 raw optional predicates preserve revoked unenrolled expired no-filter exact revisions and peer windows without source normalization',async()=>{
    for(const [credential,clause,args] of [
        [undefined,'',['scope-a']],['revoked',' AND revoked=TRUE',['scope-a']],['unenrolled',' AND revoked=FALSE AND credential_until IS NULL',['scope-a']],['expired',' AND revoked=FALSE AND credential_until<=?',['scope-a',100]],
    ] as const){
        const f=fixture(),filters=credential?{credential}:{};f.setFilters(filters);
        await f.management.nodes(f.tx,'scope-a',window(),filters,raw=>raw);
        assert.deepEqual(f.statements[0],{sql:'SELECT COUNT(*) n FROM nodes WHERE scope_id=?'+clause,args});
        assert.equal(f.statements[1]!.sql,'SELECT n.id,n.revoked,n.credential_until,n.facts,r.session_epoch,r.snapshot_generation,r.received_at FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE n.scope_id=?'+clause.replaceAll('revoked','n.revoked').replaceAll('credential_until','n.credential_until')+' ORDER BY n.id LIMIT 3 OFFSET 3');
        assert.equal(f.statements[0]!.args,f.statements[1]!.args);
    }
    const f=fixture();await f.profiles.references(f.tx,'scope-a','profile-a',window(),undefined,raw=>raw);
    assert.deepEqual(f.statements,[
        {sql:"SELECT COUNT(*) n FROM forwards WHERE scope_id=? AND deleting=FALSE AND CAST(JSON_UNQUOTE(spec->'$.transport.profileId') AS BINARY)=CAST(? AS BINARY)",args:['scope-a','profile-a']},
        {sql:"SELECT id,revision,spec,recovery_suspended FROM forwards WHERE scope_id=? AND deleting=FALSE AND CAST(JSON_UNQUOTE(spec->'$.transport.profileId') AS BINARY)=CAST(? AS BINARY) ORDER BY id LIMIT 3 OFFSET 3",args:['scope-a','profile-a']},
    ]);
    for(const value of [0,-1,1.5,Number.NaN]){
        const g=fixture();await g.tunnels.peers(g.tx,'node-a',value,raw=>raw);assert.deepEqual(g.statements.map(item=>item.args),[[value,value,'node-a'],['node-a',value,value]]);
    }
});

test('28 actual raw store plus L3 projections retain malformed JSON missing-date and projection failure before caller transaction completion with no current-time fallback',async()=>{
    for(const stage of ['json','date','callback'] as const){
        const f=fixture(),row={id:'node-a',revoked:0,credential_until:stage==='date'?undefined:null,facts:stage==='json'?'{':'null',session_epoch:null,snapshot_generation:null,received_at:null};
        f.replies[0]=[{n:1}];f.replies[1]=[row];
        const values:ReadProjectionValues={...nativeReadProjectionValues,read<T>(value:unknown):T{f.trace.push('decode');if(stage==='callback')throw f.failure;return nativeReadProjectionValues.read<T>(value);}};
        const reader=new ConsoleReadModels(f.management,values),filters={};f.setFilters(filters);const life:string[]=[];
        await assert.rejects((async()=>{life.push('begin');try{await reader.nodes(f.tx,'scope-a',window(),filters);life.push('commit');}catch(error){life.push('rollback');throw error;}})(),error=>stage==='json'?error instanceof SyntaxError:stage==='date'?error instanceof RangeError:error===f.failure);
        assert.deepEqual(life,['begin','rollback']);assert.equal(f.statements.length,2);assert.equal(f.trace.filter(value=>value==='decode').length,stage==='date'?0:1);assert.equal(f.trace.indexOf('done:2')<f.trace.length,true);
    }
    assert.throws(()=>Reflect.apply(nativeReadProjectionValues.iso,nativeReadProjectionValues,[undefined]),RangeError);
});
