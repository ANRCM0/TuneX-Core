import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { isId, MAX_COUNTER } from '@tunex/core';
import * as legacy from '../../../scripts/ops/upgrade.ts';
import * as oldInspection from '../../../scripts/ops/upgrade-inspect.ts';
import * as owner from '../src/modules/upgrade-assessment-owner/public.ts';
import { readUpgradeInput, upgradeSchemaCatalog, inspectUpgradeDatabase, nativeUpgradeInspectionEffects,
  schemaMarkers, inspectSchema, nativeUpgradeParseJson, nativeUpgradeFormat } from '../src/compatibility/public.ts';
import { parseJson } from '@tunex/contracts';
import type { AuthorityRecord } from '../src/infrastructure/authority.ts';
import type { NativeUpgradeAuthorityRecord, NativeUpgradeConnection, NativeUpgradeDatabaseInspection } from '../src/compatibility/public.ts';
import type { Connection } from 'mysql2/promise';

type Equal<A,B>=(<T>()=>T extends A?1:2)extends(<T>()=>T extends B?1:2)?true:false;
type Same<T extends true>=T;
export type UpgradePublicCompatibility=[Same<Equal<legacy.CompatibilityProfile,owner.CompatibilityProfile>>,Same<Equal<legacy.JournalInspection,owner.JournalInspection>>,
 Same<Equal<legacy.UpgradePlan,owner.UpgradePlan>>,Same<Equal<legacy.DatabaseInspection,owner.DatabaseInspection>>,Same<Equal<legacy.UpgradeInspection,owner.UpgradeInspection>>,
 Same<Equal<AuthorityRecord,NativeUpgradeAuthorityRecord>>,Same<Equal<Connection,NativeUpgradeConnection>>,Same<Equal<owner.DatabaseInspection,NativeUpgradeDatabaseInspection>>,
 Same<Equal<Parameters<typeof owner.runUpgradeAssessment>,[options:{planPath:string;databaseUrl:string;stateDirectory:string;caPath:string}]>>];
const plain=(value:unknown)=>JSON.parse(JSON.stringify(value));
const digest='sha256:'+'a'.repeat(64);
function deferred<T=void>(){let resolve!:(value:T|PromiseLike<T>)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function evaluate(path:string,providers:Record<string,unknown>,globals:Record<string,unknown>={}) {
 const url=new URL(path,import.meta.url),source=readFileSync(url,'utf8').replaceAll('import.meta.url',JSON.stringify(url.href));
 const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,exports:Record<string,any>={};
 vm.runInNewContext(output,{exports,require:(name:string)=>{assert.ok(Object.hasOwn(providers,name),'unmocked upgrade dependency '+name);return providers[name];},URL,Buffer,TextDecoder,Error,...globals},{filename:path});return exports;
}
function plan():owner.UpgradePlan {
 const build={revision:'a'.repeat(40),imageDigest:digest,profile:'adp3-multihop-v1' as const};
 return {version:1,operation:'upgrade',source:{control:{...build},agent:{...build}},target:{control:{...build},agent:{...build}},controlMultihop:false,agentMultihop:true,
  journals:[{version:1,nodeId:'node-a',protocolVersion:3,executionExtension:1,generation:1,snapshotDigest:digest,fileDigest:digest,maxBindingFence:1,maxRetiredFence:0,importedTransit:false}]};
}
const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
function inspection():owner.UpgradeInspection {
 return {database:{binding:'binding',mysqlVersion:'8.4.1',migrations:migrations.slice(0,13),schemaIssues:[],nodes:[{nodeId:'node-a',generation:1,snapshotDigest:digest}],unsupportedSnapshots:0,multihopDeployments:0,enabledMultihopForwards:0,latestLeaseUntil:1},
 authority:{version:1,sequence:1,database:'binding',trustDigest:digest,maintenance:false,latestValidUntil:1,maxLeaseSeconds:300,maxClockSkewSeconds:5,maintenanceSince:null,recoveryId:null},authorityStable:true,trustMatches:true,schemaFiles:migrations.map(name=>({name,sha256:'b'.repeat(64)}))};
}

test('upgrade public aliases exact source-only version and mutable report retain independent key check and safety inventories',()=>{
 assert.equal(owner.UPGRADE_ASSESSMENT_INTERFACE_VERSION,2);assert.equal(owner.runUpgradeAssessment.length,1);assert.equal(legacy.parseUpgradePlan,owner.parseUpgradePlan);assert.equal(legacy.assessUpgrade,owner.assessUpgrade);
 assert.equal(legacy.schemaMarkers,schemaMarkers);assert.equal(legacy.inspectSchema,inspectSchema);assert.equal(oldInspection.runUpgradeAssessment,owner.runUpgradeAssessment);assert.equal(oldInspection.readUpgradeInput,readUpgradeInput);assert.equal(oldInspection.upgradeSchemaCatalog,upgradeSchemaCatalog);assert.equal(oldInspection.inspectUpgradeDatabase,inspectUpgradeDatabase);assert.equal(nativeUpgradeParseJson,parseJson);
 assert.equal(nativeUpgradeInspectionEffects.readInput,readUpgradeInput);assert.equal(nativeUpgradeInspectionEffects.catalog,upgradeSchemaCatalog);assert.equal(nativeUpgradeInspectionEffects.inspectDatabase,inspectUpgradeDatabase);
 const p=plan(),i=inspection(),report=owner.assessUpgrade(p,i);
 assert.deepEqual(Object.keys(report),['version','scope','decision','runtimeReady','productionApproved','operation','source','target','identitySource','database','authority','journals','checks','backupResponsibilities','unchecked','requiredActions']);
 assert.deepEqual(Object.keys(report.database),['mysqlVersion','migrations','schemaFiles','pendingMigrations','schemaIssues','latestLeaseUntil','multihopDeployments','enabledMultihopForwards']);
 assert.deepEqual(Object.keys(report.authority),['sequence','maintenance','latestValidUntil','maxClockSkewSeconds']);
 assert.deepEqual(report.checks.map(({code,status,subject})=>[code,status,subject]),[
  ['MIGRATION_HISTORY','pass','database'],['MYSQL_BASELINE','pass','database'],['SCHEMA_FOOTPRINTS','pass','database'],['AUTHORITY_BINDING','pass','authority'],['TRUST_BINDING','pass','authority'],['AUTHORITY_OBSERVATION_STABLE','pass','authority'],['AUTHORIZATION_UPPER_BOUND','pass','authority'],['PERSISTED_PROTOCOL','pass','database'],['CONTROL_SCHEMA_READER','pass','source'],['CONTROL_SCHEMA_READER','pass','target'],['CONTROL_HISTORY_NOT_BEHIND_AGENT','pass','node-a'],['SNAPSHOT_HISTORY_DIGEST','pass','node-a']]);
 assert.deepEqual(report.unchecked,['image-and-binary-identity','journal-export-origin-and-freshness','backup-existence-and-integrity','full-schema-equivalence-and-data-backfills','control-agent-fence-equivalence','all-issuers-stopped','trusted-clock-and-lease-exhaustion','atomic-multi-host-snapshot','network-and-runtime-health']);
 assert.deepEqual(report.backupResponsibilities.map(x=>x.owner),['database-operator','control-operator','agent-operator']);assert.equal(report.source,p.source);assert.equal(report.target,p.target);assert.equal(report.journals,p.journals);assert.equal(report.database.migrations,i.database.migrations);assert.equal(report.database.schemaFiles,i.schemaFiles);assert.equal(report.database.schemaIssues,i.database.schemaIssues);
 assert.equal(Object.isFrozen(report),false);assert.equal(Object.isFrozen(report.checks),false);report.checks[0]!.subject='mutable';assert.equal(report.checks[0]!.subject,'mutable');assert.equal(report.runtimeReady,false);assert.equal(report.productionApproved,false);assert.equal(report.decision,'compatible');
});

const ceilings:[owner.CompatibilityProfile,number][]=[['adp3-runtime-v1',12],['adp3-multihop-v1',13],['adp3-probe-registry-v1',14],['adp3-probe-permits-v1',15],['adp3-probe-withdrawals-v1',16],['adp3-probe-results-v1',17],['adp3-path-templates-v1',18],['adp3-path-bindings-v1',19],['adp3-node-telemetry-v1',20],['adp3-forward-telemetry-v1',21],['adp3-host-telemetry-v1',22],['adp3-probe-telemetry-v1',23],['adp3-telemetry-rollups-v1',24],['adp3-path-groups-v1',25],['adp3-path-publications-v1',26],['adp3-ingress-groups-v1',27],['adp3-ingress-migrations-v1',28],['adp3-station-alerts-v1',29],['adp3-notification-endpoints-v1',30],['adp3-notification-deliveries-v1',31],['adp3-probe-runs-v1',32],['adp3-probe-plans-v1',33],['adp3-typed-probes-v1',34],['adp3-observation-services-v1',35],['adp3-probe-services-v1',36],['adp3-probe-echo-v1',37],['adp3-probe-plan-json-integers-v1',38]];
test('all twenty-seven independent Control profile ceilings including the JSON integer review preserve agent restrictions reader pending and report precedence',()=>{
 for(const [profile,ceiling] of ceilings){const p=plan(),i=inspection();p.source.control.profile=p.target.control.profile=profile;i.database.migrations=migrations.slice(0,ceiling);const parsed=owner.parseUpgradePlan(JSON.stringify(p));const report=owner.assessUpgrade(parsed,i);assert.equal(report.decision,'compatible',profile);
  if(ceiling<38){i.database.migrations.push(migrations[ceiling]!);const blocked=owner.assessUpgrade(parsed,i);assert.deepEqual(blocked.checks.filter(x=>x.code==='CONTROL_SCHEMA_READER').map(x=>[x.status,x.subject]),[['block','source'],['block','target']],profile);assert.equal(blocked.decision,'blocked');}
  i.database.migrations=migrations.slice(0,ceiling-1);const pending=owner.assessUpgrade(parsed,i);assert.deepEqual(pending.database.pendingMigrations,[migrations[ceiling-1]]);assert.equal(pending.decision,'review-required');assert.equal(pending.runtimeReady,false);assert.equal(pending.productionApproved,false);
  p.target.agent.profile=profile;if(!['adp3-runtime-v1','adp3-multihop-v1'].includes(profile))assert.throws(()=>owner.parseUpgradePlan(JSON.stringify(p)),/INVALID_UPGRADE_PLAN/);
 }
 const p=plan(),i=inspection();p.operation='recover';i.authority.maintenance=false;i.authorityStable=false;i.database.nodes.push({nodeId:'node-missing',generation:0,snapshotDigest:null});p.journals.push({...p.journals[0]!,nodeId:'foreign'});const report=owner.assessUpgrade(p,i);assert.equal(report.decision,'blocked');assert.deepEqual(report.checks.slice(-4).map(x=>[x.code,x.status,x.subject]),[['JOURNAL_NODE_NOT_IN_DATABASE','block','foreign'],['JOURNAL_INVENTORY_MISSING','review','node-missing'],['RECOVERY_MAINTENANCE','block','authority'],['RECOVERY_WORKFLOW_REQUIRED','review','authority']]);
 assert.deepEqual(report.requiredActions,['Resolve blocking checks; do not start the target or reset protected state']);
});

test('0038 Control review preserves all old reader ceilings pending DDL and both unchanged Agent release restrictions',()=>{
 const p=plan(),i=inspection();p.source.control.profile=p.target.control.profile='adp3-probe-plan-json-integers-v1';
 i.database.migrations=migrations.slice(0,37);
 const pending=owner.assessUpgrade(owner.parseUpgradePlan(JSON.stringify(p)),i);
 assert.equal(pending.decision,'review-required');assert.deepEqual(pending.database.pendingMigrations,['0038-probe-plan-json-integers.sql']);
 assert.ok(pending.unchecked.includes('full-schema-equivalence-and-data-backfills'));
 i.database.migrations=[...migrations];
 const complete=owner.assessUpgrade(p,i);assert.equal(complete.decision,'compatible');assert.equal(complete.version,1);
 assert.equal(complete.runtimeReady,false);assert.equal(complete.productionApproved,false);
 for(const [profile,ceiling] of ceilings.filter(([,ceiling])=>ceiling<38)){
  const old=plan();old.source.control.profile=old.target.control.profile=profile;
  const report=owner.assessUpgrade(owner.parseUpgradePlan(JSON.stringify(old)),i);
  assert.deepEqual(report.checks.filter(check=>check.code==='CONTROL_SCHEMA_READER').map(check=>[check.status,check.subject]),[['block','source'],['block','target']],profile+':'+ceiling);
  assert.equal(report.decision,'blocked',profile);
 }
 for(const side of ['source','target'] as const){const agent=plan();agent[side].agent.profile='adp3-probe-plan-json-integers-v1';assert.throws(()=>owner.parseUpgradePlan(JSON.stringify(agent)),/INVALID_UPGRADE_PLAN/);}
 i.database.migrations.push('0039-new.sql');assert.equal(owner.assessUpgrade(p,i).decision,'blocked');
});

test('upgrade original closed JSON build Journal counters zero generations imported Transit and distinct native format rules remain exact',()=>{
 const p=plan();for(const [key,value] of [['generation',MAX_COUNTER],['maxBindingFence',MAX_COUNTER],['maxRetiredFence',MAX_COUNTER]] as const){const q=plan();q.journals[0]![key]=value;assert.doesNotThrow(()=>owner.parseUpgradePlan(JSON.stringify(q)));}
 for(const key of ['generation','maxBindingFence','maxRetiredFence'])for(const value of [-1,'1',null]){const q:any=plan();q.journals[0][key]=value;assert.throws(()=>owner.parseUpgradePlan(JSON.stringify(q)),/INVALID_UPGRADE_PLAN/);}
 for(const key of ['generation','maxBindingFence','maxRetiredFence'])for(const value of [1.1,MAX_COUNTER+1]){const q:any=plan();q.journals[0][key]=value;assert.throws(()=>owner.parseUpgradePlan(JSON.stringify(q)),/^Error: INVALID_CONFIG: Expected an exact safe integer$/);}
 const variants:((q:any)=>void)[]=[q=>q.extra=1,q=>delete q.version,q=>q.version=2,q=>q.operation='migrate',q=>q.source.extra=1,q=>q.target.agent.extra=1,q=>q.source.control.revision='A'.repeat(40),q=>q.target.control.imageDigest='sha256:'+'A'.repeat(64),q=>q.source.control.profile='unknown',q=>q.journals.push({...q.journals[0]}),q=>q.journals[0].extra=1,q=>q.journals[0].nodeId='bad/id',q=>q.journals[0].protocolVersion=2,q=>q.journals[0].executionExtension=2,q=>q.journals[0].generation=0,q=>{q.journals[0].executionExtension=0;q.journals[0].importedTransit=true;},q=>q.journals[0].fileDigest='bad'];
 for(const change of variants){const q=plan();change(q);assert.throws(()=>owner.parseUpgradePlan(JSON.stringify(q)),/INVALID_UPGRADE_PLAN/);}
 for(const select of [(q:any)=>q,(q:any)=>q.source,(q:any)=>q.target.control,(q:any)=>q.journals[0]])for(const key of Object.keys(select(plan()))){const q=plan();delete select(q)[key];assert.throws(()=>owner.parseUpgradePlan(JSON.stringify(q)),/INVALID_UPGRADE_PLAN/);}
 for(const key of ['controlMultihop','agentMultihop']){const q:any=plan();q[key]=1;assert.throws(()=>owner.parseUpgradePlan(JSON.stringify(q)),/INVALID_UPGRADE_PLAN/);}
 const zero=plan();zero.journals[0]!.generation=0;zero.journals[0]!.snapshotDigest='';zero.journals[0]!.executionExtension=0;assert.doesNotThrow(()=>owner.parseUpgradePlan(JSON.stringify(zero)));
 const imported=plan();imported.journals[0]!.importedTransit=true;assert.doesNotThrow(()=>owner.parseUpgradePlan(JSON.stringify(imported)));
 const thousand=plan();thousand.journals=Array.from({length:1000},(_,n)=>({...p.journals[0]!,nodeId:'node-'+n}));assert.doesNotThrow(()=>owner.parseUpgradePlan(JSON.stringify(thousand)));thousand.journals.push({...p.journals[0]!,nodeId:'node-1000'});assert.throws(()=>owner.parseUpgradePlan(JSON.stringify(thousand)),/INVALID_UPGRADE_PLAN/);
 assert.throws(()=>owner.parseUpgradePlan('{"version":1,"version":1}'));assert.throws(()=>owner.parseUpgradePlan(' '.repeat(1048577)));for(const value of ['8.4.0','8.4.99-extra','8.4.9+vendor','8.4.9.1'])assert.equal(nativeUpgradeFormat.mysqlBaseline(value),true);for(const value of ['8.0.99','8.4','8.4.9other'])assert.equal(nativeUpgradeFormat.mysqlBaseline(value),false);
});

test('upgrade remaining explicit multihop Journal migration maintenance and recovery branches retain ordered checks and blocked over review precedence',()=>{
 const rows:[string,(p:owner.UpgradePlan,i:owner.UpgradeInspection)=>void,string][]=[
  ['executor-control',p=>{p.controlMultihop=true;p.target.control.profile='adp3-runtime-v1';},'MULTIHOP_EXECUTOR_REQUIRED'],
  ['executor-agent',p=>{p.controlMultihop=true;p.target.agent.profile='adp3-runtime-v1';},'MULTIHOP_EXECUTOR_REQUIRED'],
  ['executor-flag',p=>{p.controlMultihop=true;p.agentMultihop=false;},'MULTIHOP_EXECUTOR_REQUIRED'],
  ['withdraw-deployment',(_p,i)=>{i.database.multihopDeployments=1;},'MULTIHOP_WITHDRAWAL_REQUIRED'],
  ['withdraw-forward',(_p,i)=>{i.database.enabledMultihopForwards=1;},'MULTIHOP_WITHDRAWAL_REQUIRED'],
  ['source-journal',p=>{p.source.agent.profile='adp3-runtime-v1';},'SOURCE_JOURNAL_PROFILE_MISMATCH'],
  ['agent-extension',p=>{p.target.agent.profile='adp3-runtime-v1';},'AGENT_EXECUTION_EXTENSION_UNSUPPORTED']];
 for(const [name,change,code] of rows){const p=plan(),i=inspection();change(p,i);i.authorityStable=false;const report=owner.assessUpgrade(p,i);assert.equal(report.decision,'blocked',name);assert.ok(report.checks.some(x=>x.code===code&&x.status==='block'),name);assert.equal(report.runtimeReady,false);assert.equal(report.productionApproved,false);}
 for(const [operation,recoveryId,code] of [['upgrade',null,'MAINTENANCE_ACTIVE'],['rollback','recovery','RECOVERY_REVIEW_REQUIRED'],['recover','recovery','RECOVERY_WORKFLOW_REQUIRED']] as const){const p=plan(),i=inspection();p.operation=operation;i.authority.maintenance=true;i.authority.recoveryId=recoveryId;const report=owner.assessUpgrade(p,i);assert.equal(report.decision,'review-required');assert.ok(report.checks.some(x=>x.code===code&&x.status==='review'));if(operation==='rollback')assert.equal(report.checks.at(-2)?.code,'ROLLBACK_REVIEW_REQUIRED');if(operation==='recover'){assert.equal(report.checks.at(-2)?.code,'RECOVERY_MAINTENANCE');assert.ok(report.requiredActions.at(-1)?.includes('assessment grants no recovery permission'));}}
 const zero=plan(),i=inspection();zero.journals[0]!.executionExtension=0;zero.journals[0]!.generation=0;zero.journals[0]!.snapshotDigest='';const report=owner.assessUpgrade(zero,i);assert.equal(report.checks.some(x=>x.code==='SNAPSHOT_HISTORY_DIGEST'),false);assert.equal(report.checks.at(-1)?.code,'EXPLICIT_JOURNAL_MIGRATION_REQUIRED');
});

function nativeHarness() {
 const events:any[]=[],failure=Error('native inspection failure');const state:any={fail:'',maximumSize:undefined,bytes:Buffer.from('plain'),position:0,chunks:[],names:migrations,sql:undefined,query:undefined,rollback:undefined,connection:undefined};
 const record=(name:string,...args:unknown[])=>{events.push([name,...args]);if(state.fail===name)throw failure;};
 const file={async stat(){record('stat');return {isFile:()=>state.isFile!==false,size:state.maximumSize??state.bytes.length};},async read(buffer:Buffer,offset:number,length:number,position:null){record('read',offset,length,position);const remaining=state.bytes.length-state.position,count=Math.min(remaining,length,state.chunks.length?state.chunks.shift():length);state.bytes.copy(buffer,offset,state.position,state.position+count);state.position+=count;return {bytesRead:count};},async close(){record('close');}};
 const db={async query(options:{sql:string;timeout:number}){record('query',options);return state.query?state.query(options):[[]];},async rollback(){record('rollback');if(state.rollback)return state.rollback();},async end(){record('end');}};
 class Authority {constructor(path:string){record('authority',path);}}
 const trust=(value:unknown)=>{record('trust',value);return 'digest';};
 const exports=evaluate('../src/compatibility/native-upgrade-inspection.ts',{'node:crypto':{createHash},'node:fs/promises':{open:async(path:string|URL,flags:string)=>{record('open',path,flags);if(state.sql){const bytes=Buffer.from(state.sql(path));let position=0;return {stat:async()=>({isFile:()=>true,size:bytes.length}),read:async(buffer:Buffer,offset:number,length:number,_position:null)=>{const count=Math.min(length,bytes.length-position);bytes.copy(buffer,offset,position,position+count);position+=count;return {bytesRead:count};},close:async()=>record('catalog-close',path)};}return file;},readdir:async(path:URL)=>{record('readdir',path);return state.names;}},'mysql2/promise':{createConnection:(options:unknown)=>{record('connect',options);return state.connection?state.connection(options):Promise.resolve(db);}},'@tunex/core':{isId,MAX_COUNTER},'../infrastructure/authority.ts':{AuthorityStore:Authority,trustDigest:trust},'./native-upgrade-format.ts':{inspectSchema,schemaMarkers}});
 return {api:exports,state,events,file,db,failure,trust};
}

test('native bounded upgrade input preserves default allocation partial reads zero-byte UTF8 stat limits and every finally close precedence',async()=>{
 const h=nativeHarness();h.state.bytes=Buffer.from('é中');h.state.chunks=[1,2,2];assert.equal(await h.api.readUpgradeInput('/plan'), 'é中');assert.deepEqual(h.events.slice(0,3),[['open','/plan','r'],['stat'],['read',0,1048577,null]]);assert.deepEqual(h.events.filter(x=>x[0]==='read').map(x=>x[1]),[0,1,3,5]);assert.deepEqual(h.events.at(-1),['close']);
 for(const count of [0,4]){const f=nativeHarness();f.state.bytes=Buffer.alloc(count,97);assert.equal((await f.api.readUpgradeInput('/p',4)).length,count);assert.equal(f.events.filter(x=>x[0]==='read')[0][2],5);}
 for(const mode of ['not-file','stat-limit','grow-limit','utf8']){const f=nativeHarness();if(mode==='not-file')f.state.isFile=false;if(mode==='stat-limit')f.state.maximumSize=5;if(mode==='grow-limit'){f.state.maximumSize=4;f.state.bytes=Buffer.alloc(5,97);}if(mode==='utf8')f.state.bytes=Buffer.from([0xc3]);await assert.rejects(f.api.readUpgradeInput('/p',4));assert.deepEqual(f.events.at(-1),['close']);if(mode==='not-file'||mode==='stat-limit')assert.equal(f.events.some(x=>x[0]==='read'),false);}
 for(const stage of ['open','stat','read','close']){const f=nativeHarness();f.state.fail=stage;await assert.rejects(f.api.readUpgradeInput('/p',8),error=>error===f.failure);assert.equal(f.events.some(x=>x[0]==='close'),stage!=='open');}
 const precedence=nativeHarness(),last=Error('close wins');precedence.state.fail='read';precedence.file.close=async()=>{throw last;};await assert.rejects(precedence.api.readUpgradeInput('/p',8),error=>error===last);
});

test('native migration catalog resolves real new relative root all thirty-eight hashes markers and deliberate floor unknown-file refusals',async()=>{
 const h=nativeHarness();h.state.names=[...migrations].reverse().concat(['README.md']);h.state.sql=(url:URL)=>readFileSync(url,'utf8');const result=await h.api.upgradeSchemaCatalog();
 assert.equal(h.events[0][0],'readdir');assert.equal(h.events[0][1].href,new URL('../migrations/',import.meta.url).href);assert.deepEqual(plain(result.files.map((x:any)=>x.name)),migrations);assert.equal(result.files.length,38);
 assert.equal(result.files.at(-1).name,'0038-probe-plan-json-integers.sql');for(const file of result.files){const sql=readFileSync(new URL('../migrations/'+file.name,import.meta.url),'utf8');assert.equal(file.sql,sql);assert.equal(file.sha256,createHash('sha256').update(sql).digest('hex'));}assert.deepEqual(plain(result.markers),migrations.flatMap(name=>schemaMarkers(name,readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'))));
 for(const names of [migrations.slice(0,37),[...migrations,'0039-new.sql'],[...migrations.slice(0,37),'0038-wrong.sql'],['0000-invalid.sql',...migrations.slice(1)]]){const f=nativeHarness();f.state.names=names;await assert.rejects(f.api.upgradeSchemaCatalog(),/UNREVIEWED_UPGRADE_SCHEMA/);assert.equal(f.events.some(x=>x[0]==='open'),false);}
 const unknown=nativeHarness();unknown.state.names=['0001-INVALID.sql',...migrations.slice(1)];unknown.state.sql=(url:URL)=>url.pathname.endsWith('0038-probe-plan-json-integers.sql')?readFileSync(url,'utf8'):'CREATE TABLE example (id INT);';await assert.rejects(unknown.api.upgradeSchemaCatalog(),/UNKNOWN_MIGRATION_FILE/);
 const empty=nativeHarness();empty.state.sql=()=> 'SELECT 1;';await assert.rejects(empty.api.upgradeSchemaCatalog(),/UNREVIEWED_MIGRATION_FILE/);
});

test('only the exact reviewed CHECK replacement permits no new footprint while whitespace comments and original hashes stay distinct',async()=>{
 const name='0038-probe-plan-json-integers.sql',sql=readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8');
 assert.deepEqual(schemaMarkers(name,sql),[]);
 const spaced=sql.replace('ALTER TABLE','ALTER\t TABLE').replace(' DROP CHECK',' -- reviewed line comment\n DROP  CHECK');
 assert.deepEqual(schemaMarkers(name,spaced),[]);
 assert.deepEqual(schemaMarkers(name,sql+'\n--'),[]);
 // Existing 0033 tables must not create a false interrupted-0038 footprint before this migration applies.
 assert.deepEqual(inspectSchema([],schemaMarkers(name,sql),[{table:'probe_plans',column:'config',type:'json'}]),[]);
 for(const changed of [sql.replace('probe_plans_chk_7','probe_plans_chk_8'),sql.replace('UNSIGNED INTEGER','UNSIGNEDINTEGER'),sql.replace('UNSIGNED INTEGER','UNSIGNED  INTEGER'),
  sql.replace(" IN ('INTEGER','UNSIGNED INTEGER')"," = 'INTEGER'"),sql.replace(' IS NOT NULL',' IS NULL'),
  sql.replace('probe_plan_expiry_json_integer','other_constraint'),sql+'\nSELECT 1;',sql.replace('ALTER TABLE','ALTER /* ignored? */ TABLE'),
  sql.replace('ALTER TABLE','ALTER --not-comment\n TABLE'),sql.replace('ALTER TABLE','ALTER\u00a0TABLE')]){
  assert.throws(()=>schemaMarkers(name,changed),/UNREVIEWED_MIGRATION_FILE/);
  const h=nativeHarness();h.state.sql=(url:URL)=>url.pathname.endsWith(name)?changed:readFileSync(url,'utf8');
  await assert.rejects(h.api.upgradeSchemaCatalog(),/UNREVIEWED_MIGRATION_FILE/);
 }
 for(const other of ['0039-new.sql','0038-other.sql','0037-check-only.sql'])assert.throws(()=>schemaMarkers(other,sql),/UNREVIEWED_MIGRATION_FILE/);
 const h=nativeHarness();h.state.sql=(url:URL)=>url.pathname.endsWith(name)?spaced:readFileSync(url,'utf8');const catalog=await h.api.upgradeSchemaCatalog();
 assert.equal(catalog.files.at(-1).sql,spaced);assert.equal(catalog.files.at(-1).sha256,createHash('sha256').update(spaced).digest('hex'));
 assert.notEqual(catalog.files.at(-1).sha256,createHash('sha256').update(sql).digest('hex'));
});

const sqls={isolation:'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ',start:'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY',
 metadata:"SELECT CONCAT(@@server_uuid,':',DATABASE()) binding,VERSION() mysqlVersion",
 columns:'SELECT TABLE_NAME AS `table`,COLUMN_NAME AS `column`,COLUMN_TYPE AS `type` FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,COLUMN_NAME LIMIT 10001',
 migrations:'SELECT name FROM vnext_migrations ORDER BY name LIMIT 101',
 nodes:"SELECT n.id nodeId,COALESCE(r.snapshot_generation,0) generation,JSON_UNQUOTE(JSON_EXTRACT(s.body,'$.snapshotDigest')) snapshotDigest FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id LEFT JOIN snapshots s ON s.node_id=n.id AND s.generation=r.snapshot_generation ORDER BY n.id LIMIT 1001",
 protocols:"SELECT COUNT(*) n FROM snapshots WHERE JSON_EXTRACT(body,'$.protocolVersion') IS NULL OR JSON_TYPE(JSON_EXTRACT(body,'$.protocolVersion'))<>'INTEGER' OR JSON_EXTRACT(body,'$.protocolVersion')<>3 OR (JSON_EXTRACT(body,'$.executionExtension') IS NOT NULL AND (JSON_TYPE(JSON_EXTRACT(body,'$.executionExtension'))<>'INTEGER' OR JSON_EXTRACT(body,'$.executionExtension')<>1))",
 leases:'SELECT MAX(bound) until FROM (SELECT MAX(valid_until) bound FROM execution_leases UNION ALL SELECT MAX(valid_until) bound FROM snapshots) authorization_bounds',
 paths:"SELECT COUNT(*) n FROM relay_deployments WHERE path_nodes IS NOT NULL AND stage<>'withdrawn'",
 intents:"SELECT COUNT(*) n FROM forwards WHERE deleting=FALSE AND JSON_EXTRACT(spec,'$.enabled')=TRUE AND JSON_LENGTH(JSON_EXTRACT(spec,'$.path.via'))>1"};
function queryHarness(full=true) {
 const h=nativeHarness();const data:any={columns:full?['nodes','runtime_nodes','snapshots','execution_leases','forwards'].map(table=>({table,column:'id',type:'varchar(128)'})).concat([{table:'relay_deployments',column:'path_nodes',type:'json'}]):[],
 metadata:[{binding:'original-binding',mysqlVersion:'8.4.1'}],migrations:[{name:'0001-phase1.sql'}],nodes:[{nodeId:'node-a',generation:'1',snapshotDigest:digest}],protocols:[{n:'2'}],leases:[{until:String(MAX_COUNTER)}],paths:[{n:'3'}],intents:[{n:'4'}],columnReads:0,failSql:'',after:undefined};
 h.state.query=({sql,timeout}:{sql:string;timeout:number})=>{assert.equal(timeout,10000);if(data.failSql===sql)throw h.failure;
  if(sql===sqls.isolation||sql===sqls.start)return [undefined];if(sql===sqls.metadata)return [data.metadata];if(sql===sqls.columns)return [++data.columnReads===2&&data.after!==undefined?data.after:data.columns];
  if(sql===sqls.migrations)return [data.migrations];if(sql===sqls.nodes)return [data.nodes];if(sql===sqls.protocols)return [data.protocols];if(sql===sqls.leases)return [data.leases];if(sql===sqls.paths)return [data.paths];if(sql===sqls.intents)return [data.intents];return assert.fail('unreviewed SQL '+sql);};
 const catalog={files:[],markers:[]};return {...h,data,catalog,inspect:()=>h.api.inspectUpgradeDatabase(h.db,catalog)};
}

test('native upgrade inspection issues exact bounded read-only SQL in original order optional-table defaults and rollback only after successful setup',async()=>{
 const h=queryHarness(),result=await h.inspect();assert.deepEqual(plain(result),{binding:'original-binding',mysqlVersion:'8.4.1',migrations:['0001-phase1.sql'],schemaIssues:[],nodes:[{nodeId:'node-a',generation:1,snapshotDigest:digest}],unsupportedSnapshots:2,multihopDeployments:3,enabledMultihopForwards:4,latestLeaseUntil:MAX_COUNTER});
 assert.deepEqual(h.events.filter(x=>x[0]==='query').map(x=>plain(x[1])),[sqls.isolation,sqls.start,sqls.metadata,sqls.columns,sqls.migrations,sqls.nodes,sqls.protocols,sqls.leases,sqls.paths,sqls.intents,sqls.columns].map(sql=>({sql,timeout:10000})));assert.deepEqual(h.events.at(-1),['rollback']);assert.equal(h.events.some(x=>x[0]==='end'),false);
 const minimal=queryHarness(false);const projection=await minimal.inspect();assert.deepEqual(plain(projection),{binding:'original-binding',mysqlVersion:'8.4.1',migrations:['0001-phase1.sql'],schemaIssues:[],nodes:[],unsupportedSnapshots:0,multihopDeployments:0,enabledMultihopForwards:0,latestLeaseUntil:null});assert.deepEqual(minimal.events.filter(x=>x[0]==='query').map(x=>x[1].sql),[sqls.isolation,sqls.start,sqls.metadata,sqls.columns,sqls.migrations,sqls.columns]);
 for(const sql of Object.values(sqls)){const f=queryHarness();f.data.failSql=sql;await assert.rejects(f.inspect(),error=>error===f.failure);assert.equal(f.events.some(x=>x[0]==='rollback'),sql!==sqls.isolation&&sql!==sqls.start,sql);assert.equal(f.events.some(x=>x[0]==='end'),false);}
 const close=queryHarness(),last=Error('rollback wins');close.data.failSql=sqls.metadata;close.state.rollback=()=>{throw last;};await assert.rejects(close.inspect(),error=>error===last);
 const successRollback=queryHarness();successRollback.state.fail='rollback';await assert.rejects(successRollback.inspect(),error=>error===successRollback.failure);
 for(const missing of ['nodes','runtime_nodes','snapshots']){const f=queryHarness();f.data.columns=f.data.columns.filter((c:any)=>c.table!==missing);await f.inspect();assert.equal(f.events.some(x=>x[0]==='query'&&x[1].sql===sqls.nodes),false);}
 const effects=nativeHarness();assert.equal(effects.api.nativeUpgradeInspectionEffects.readInput,effects.api.readUpgradeInput);assert.equal(effects.api.nativeUpgradeInspectionEffects.catalog,effects.api.upgradeSchemaCatalog);assert.equal(effects.api.nativeUpgradeInspectionEffects.inspectDatabase,effects.api.inspectUpgradeDatabase);assert.equal(effects.api.nativeUpgradeInspectionEffects.trust,effects.trust);effects.api.nativeUpgradeInspectionEffects.authority('/protected');const opening=effects.api.nativeUpgradeInspectionEffects.openDatabase('mysql://db');assert.equal(await opening,effects.db);assert.deepEqual(plain(effects.events),[['authority','/protected'],['connect',{uri:'mysql://db',connectTimeout:10000,supportBigNumbers:true,bigNumberStrings:true}]]);
});

test('native upgrade inspection retains metadata table history node counter lease bounds and visible schema-race refusals',async()=>{
 const cases:[string,(h:ReturnType<typeof queryHarness>)=>void,string][]=[
 ['metadata-absent',h=>h.data.metadata=[], 'INVALID_DATABASE_METADATA'],['metadata-binding',h=>h.data.metadata[0].binding='x'.repeat(129),'INVALID_DATABASE_METADATA'],['metadata-version',h=>h.data.metadata[0].mysqlVersion=null,'INVALID_DATABASE_METADATA'],
 ['columns',h=>h.data.columns=Array.from({length:10001},()=>({table:'a',column:'b',type:'int'})),'UNSUPPORTED_UPGRADE_DATABASE'],['foreign-table',h=>h.data.columns.push({table:'_prisma_migrations',column:'id',type:'int'}),'UNSUPPORTED_UPGRADE_DATABASE'],
 ['history-limit',h=>h.data.migrations=Array.from({length:101},()=>({name:'0001-phase1.sql'})),'INVALID_MIGRATION_HISTORY'],['history-name',h=>h.data.migrations=[{name:'../a.sql'}],'INVALID_MIGRATION_HISTORY'],
 ['node-limit',h=>h.data.nodes=Array.from({length:1001},()=>h.data.nodes[0]),'UPGRADE_NODE_INVENTORY_LIMIT'],['node-id',h=>h.data.nodes[0].nodeId='bad/id','INVALID_DATABASE_NODE_HISTORY'],['node-digest',h=>h.data.nodes[0].snapshotDigest=null,'INVALID_DATABASE_NODE_HISTORY'],
 ['schema-race',h=>h.data.after=[...h.data.columns].reverse(),'UPGRADE_SCHEMA_CHANGED_RETRY']];
 for(const [name,change,message] of cases){const h=queryHarness();change(h);await assert.rejects(h.inspect(),new RegExp(message),name);assert.deepEqual(h.events.at(-1),['rollback']);}
 for(const table of ['Tunnel','Forward','User']){const h=queryHarness();h.data.columns.push({table,column:'id',type:'int'});await assert.rejects(h.inspect(),/UNSUPPORTED_UPGRADE_DATABASE/);}
 for(const key of ['nodes','protocols','leases','paths','intents'])for(const value of [-1,1.5,MAX_COUNTER+1,'1.0',' 1','-1',null]){if(key==='leases'&&value===null)continue;const h=queryHarness();if(key==='nodes')h.data.nodes[0].generation=value;else h.data[key][0][key==='leases'?'until':'n']=value;await assert.rejects(h.inspect(),/INVALID_DATABASE_COUNTER/);assert.deepEqual(h.events.at(-1),['rollback']);}
 for(const value of [0,'000',MAX_COUNTER,String(MAX_COUNTER)]){const h=queryHarness();h.data.nodes[0].generation=value;h.data.nodes[0].snapshotDigest=Number(value)===0?null:digest;h.data.protocols[0].n=value;h.data.leases[0].until=null;const result=await h.inspect();assert.equal(result.nodes[0].generation,Number(value));assert.equal(result.unsupportedSnapshots,Number(value));assert.equal(result.latestLeaseUntil,null);}
 const footprint=queryHarness(false);footprint.catalog.markers.push({migration:'0001-phase1.sql',table:'required'} as never);const result=await footprint.inspect();assert.deepEqual(plain(result.schemaIssues),['0001-phase1.sql']);
});

function assessmentHarness() {
 const events:any[]=[],failure=Error('inspection provider failed'),state:any={fail:'',reads:0,sequenceBefore:1,sequenceAfter:1,trust:'same',ca:'same',readGate:undefined};
 const before={sequence:1,trustDigest:'same'},after={sequence:1,trustDigest:'same'},db={async end(){record('end');}},catalog={files:[{name:'file.sql',sha256:'hash',sql:'private-sql'}],markers:[]},database={original:'database'},parsed={original:'parsed-plan'},report={original:'report'};
 const record=(name:string,...args:unknown[])=>{events.push([name,...args]);if(state.fail===name)throw failure;};
 const authority={async read(){const first=++state.reads===1;record(first?'before':'after');Object.assign(before,{sequence:state.sequenceBefore});Object.assign(after,{sequence:state.sequenceAfter,trustDigest:state.trust});return first?before:after;}};
 const effects={readInput:async(path:string,limit?:number)=>{record('input',path,limit);if(state.readGate)return state.readGate(path,limit);return path==='plan-path'?'plan-raw':'ca-raw';},catalog:async()=>{record('catalog');return catalog;},authority:(path:string)=>{record('authority',path);return authority;},trust:(raw:string)=>{record('trust',raw);return state.ca;},openDatabase:async(url:string)=>{record('open',url);return db;},inspectDatabase:async(supplied:unknown,suppliedCatalog:unknown)=>{assert.equal(supplied,db);assert.equal(suppliedCatalog,catalog);record('inspect');return database;}};
 let captured:any;const rules={parseUpgradePlan:(raw:string)=>{record('parse',raw);return parsed;},assessUpgrade:(p:unknown,inspection:unknown)=>{assert.equal(p,parsed);record('report',inspection);captured=inspection;return report;}};
 const api=evaluate('../src/modules/upgrade-assessment-owner/inspection.ts',{'../../compatibility/public.ts':{nativeUpgradeInspectionEffects:effects},'./rules.ts':rules});
 const options={planPath:'plan-path',databaseUrl:'database-url',stateDirectory:'state-path',caPath:'ca-path'};return {api,events,state,failure,before,after,db,catalog,database,parsed,report,options,captured:()=>captured};
}

test('actual assessment orchestrator preserves awaited plan catalog authority CA connection database after report end and lazy options identity',async()=>{
 const h=assessmentHarness(),keys:string[]=[];const options=new Proxy(h.options,{get(target,key){keys.push(String(key));return Reflect.get(target,key);}});assert.equal(h.api.runUpgradeAssessment.length,1);assert.equal(await h.api.runUpgradeAssessment(options),h.report);
 assert.deepEqual(h.events.map(x=>x[0]),['input','parse','catalog','authority','before','input','trust','open','inspect','after','report','end']);assert.deepEqual(keys,['planPath','stateDirectory','caPath','databaseUrl']);assert.deepEqual(h.events[0],['input','plan-path',undefined]);assert.deepEqual(h.events[5],['input','ca-path',65536]);
 const inspection=h.captured();assert.equal(inspection.database,h.database);assert.equal(inspection.authority,h.after);assert.deepEqual(plain(inspection.schemaFiles),[{name:'file.sql',sha256:'hash'}]);assert.notEqual(inspection.schemaFiles[0],h.catalog.files[0]);assert.equal(inspection.authorityStable,true);assert.equal(inspection.trustMatches,true);
 for(const [before,after,trust,stable,match] of [[1,2,'same',false,true],[1,1,'changed',true,false]] as const){const f=assessmentHarness();Object.assign(f.state,{sequenceBefore:before,sequenceAfter:after,trust});await f.api.runUpgradeAssessment(f.options);assert.equal(f.captured().authorityStable,stable);assert.equal(f.captured().trustMatches,match);}
 const gate=deferred<string>(),waiting=assessmentHarness();waiting.state.readGate=(path:string)=>path==='ca-path'?gate.promise:'plan-raw';let settled=false;const pending=waiting.api.runUpgradeAssessment(waiting.options).then(()=>{settled=true;});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(waiting.events.map(x=>x[0]),['input','parse','catalog','authority','before','input']);assert.equal(settled,false);gate.resolve('ca-raw');await pending;
 const endGate=deferred(),end=assessmentHarness();end.db.end=async()=>{end.events.push(['end']);await endGate.promise;};let completed=false;const completion=end.api.runUpgradeAssessment(end.options).then(()=>{completed=true;});await new Promise(resolve=>setImmediate(resolve));assert.equal(completed,false);endGate.resolve();await completion;
});

test('actual assessment orchestrator preserves setup-before-try no database close and original inspect report after/end failure precedence',async()=>{
 for(const stage of ['input','parse','catalog','authority','before','trust','open','inspect','after','report','end']){const h=assessmentHarness();h.state.fail=stage;await assert.rejects(h.api.runUpgradeAssessment(h.options),error=>error===h.failure);assert.equal(h.events.some(x=>x[0]==='end'),['inspect','after','report','end'].includes(stage),stage);if(stage!=='end')assert.equal(h.events.some(x=>x[0]==='report'),stage==='report');}
 const ca=assessmentHarness();ca.state.readGate=(path:string)=>{if(path==='ca-path')throw ca.failure;return 'plan-raw';};await assert.rejects(ca.api.runUpgradeAssessment(ca.options),error=>error===ca.failure);assert.equal(ca.events.some(x=>x[0]==='open'||x[0]==='end'),false);
 const close=assessmentHarness(),last=Error('end failure');close.state.fail='inspect';close.db.end=async()=>{throw last;};await assert.rejects(close.api.runUpgradeAssessment(close.options),error=>error===last);
 const getters=assessmentHarness(),original=Error('options getter');for(const key of ['planPath','stateDirectory','caPath','databaseUrl']){const options={...getters.options};Object.defineProperty(options,key,{get(){throw original;}});const h=assessmentHarness();await assert.rejects(h.api.runUpgradeAssessment(options),error=>error===original);assert.equal(h.events.some(x=>x[0]==='end'),false,key);}
});
