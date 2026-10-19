import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { posix as paths } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { parseJson } from '@tunex/contracts';
import { RecoveryWorkflow } from '../src/modules/recovery-owner/public.ts';
import type { AuthorityRecord } from '../src/infrastructure/authority.ts';
import type { NativeRecoveryAuthorityRecord, BackupEnvelope as PublicEnvelope } from '../src/compatibility/public.ts';
import type { BackupEnvelope, nativeRecoveryEffects as NativeEffects } from '../src/compatibility/native-recovery.ts';
import type { RecoveryWorkflowNative, RecoveryDatabase } from '../src/modules/recovery-owner/public.ts';
import type { MySqlUnitOfWork, Transaction } from '../src/infrastructure/mysql.ts';
import type { NativeRecoverySource } from '../src/compatibility/public.ts';
import type * as operator from '../../../scripts/ops/recovery.ts';

type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Same<T extends true> = T;
export type NativeRecoveryPublicContract = [Same<Equal<AuthorityRecord,NativeRecoveryAuthorityRecord>>,
  Same<Equal<BackupEnvelope,PublicEnvelope>>, Same<Equal<Parameters<typeof operator.backupDatabase>['length'],1>>,
  Same<Equal<Parameters<typeof operator.restoreDatabase>['length'],1>>,
  Same<Equal<ReturnType<typeof operator.backupDatabase>,Promise<string>>>,
  Same<Equal<ReturnType<typeof operator.restoreDatabase>,Promise<{recoveryId:string;databaseUrl:string;ownerCredentials:string}>>>];
type NativeHost = RecoveryWorkflowNative<MySqlUnitOfWork,NativeRecoverySource>;
export type NativeRecoveryMethodCompatibility = [Same<Equal<MySqlUnitOfWork extends RecoveryDatabase<Transaction>?true:false,true>>,
  Same<Equal<typeof NativeEffects extends NativeHost?true:false,true>>];

function evaluate(path:string, providers:Record<string,unknown>, globals:Record<string,unknown>={}) {
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports:Record<string,any>={};
  vm.runInNewContext(output,{exports,require:(name:string)=>{assert.ok(Object.hasOwn(providers,name),'unmocked native import '+name);return providers[name];},
    URL,Buffer,...globals},{filename:path});
  return exports;
}
const plain=(value:unknown)=>JSON.parse(JSON.stringify(value));
function deferred<T=void>(){let resolve!:(value:T|PromiseLike<T>)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function nativeHarness(options:{platform?:string}={}) {
  const events:any[]=[];const failure=Error('native provider failure');
  const state:any={fail:'',stdout:'{}',started:10000,finished:10000,reads:0,manifest:'',streamChunks:[Buffer.from('a'),Buffer.from('bc')],
    execute:undefined,spawn:undefined,pipeline:undefined,lstat:undefined,realpath:undefined,queryRows:[],query:undefined,connection:undefined};
  const record=(name:string,...args:unknown[])=>{events.push([name,...args]);if(state.fail===name)throw failure;};
  const file={async writeFile(content:string){record('write',content);},async sync(){record('file-sync');},async close(){record('file-close');}};
  const directory={async sync(){record('dir-sync');},async close(){record('dir-close');}};
  const mysql={async query(...args:unknown[]){record('admin-query',...args);return state.query?state.query(...args):[state.queryRows];},end(){record('admin-end');return state.endPromise??Promise.resolve();}};
  class Database {pool={query:async(...args:unknown[])=>{record('pool-query',...args);return [state.queryRows];}};constructor(url:string){record('database',url);}}
  class Clock extends Date {constructor(value?:any){super(value===undefined?state.finished:value);}static now(){record('now');return state.reads++===0?state.started:state.finished;}static parse(value:string){record('date-parse',value);return Date.parse(value);}}
  const execFile=()=>assert.fail('real execFile is never invoked');
  const randomUUID=()=>{record('uuid');return '00000000-0000-0000-0000-000000000001';};
  const readStream=(path:string)=>{record('read-stream',path);return {path,async *[Symbol.asyncIterator](){for(const chunk of state.streamChunks){record('hash-chunk',chunk);yield chunk;}}};};
  const child:any=new EventEmitter();child.stdin={original:true};child.stderr={on:(name:string,listener:Function)=>{record('stderr',name,listener);return child.stderr;}};
  const originalOnce=child.once;child.once=function(name:string,listener:Function){record('child-once',name);return originalOnce.call(this,name,listener as any);};
  child.kill=()=>assert.fail('the native adapter must not invent process termination');
  const providers={
    'node:crypto':{createHash,randomUUID},'node:fs':{createReadStream:readStream},'node:path':paths,
    'node:fs/promises':{mkdir:async(...args:unknown[])=>record('mkdir',...args),readFile:async(...args:unknown[])=>{record('read-file',...args);return state.manifest;},
      chmod:async(...args:unknown[])=>record('chmod',...args),open:async(...args:unknown[])=>{record('open',...args);return state.open?state.open(...args):args[1]==='r'?directory:file;},
      lstat:async(path:string)=>{record('lstat',path);return state.lstat?state.lstat(path):{isSymbolicLink:()=>false,isDirectory:()=>true};},realpath:async(path:string)=>{record('realpath',path);return state.realpath?state.realpath(path):path;}},
    'node:child_process':{execFile,spawn:(...args:unknown[])=>{record('spawn',...args);return state.spawn?state.spawn(...args):child;}},
    'node:stream/promises':{pipeline:(...args:unknown[])=>{record('pipeline',...args);return state.pipeline?state.pipeline(...args):Promise.resolve();}},
    'node:util':{promisify:(supplied:unknown)=>{assert.equal(supplied,execFile);record('promisify');return async(...args:unknown[])=>{record('execute',...args);return state.execute?state.execute(...args):{stdout:state.stdout};};}},
    'mysql2/promise':{createConnection:async(url:string)=>{record('connect',url);return state.connection?state.connection(url):mysql;}},
    '@tunex/contracts':{parseJson:(raw:string,limit:number)=>{record('parse-json',raw,limit);return state.parse?state.parse(raw,limit):parseJson(raw,limit);}},
    '../infrastructure/mysql.ts':{MySqlUnitOfWork:Database},
  };
  const exports=evaluate('../src/compatibility/native-recovery.ts',providers,{Date:Clock,process:{platform:options.platform??'linux',env:{NATIVE_RECOVERY_TEST:'retained',MYSQL_PWD:'old'}}});
  assert.deepEqual(events,[['promisify']]);events.length=0;
  return {api:exports.nativeRecoveryEffects,exports,state,events:events as any[],failure,file,directory,mysql,child,randomUUID};
}

test('native Recovery keeps exact public effect methods aliases construction and raw query result identities',async()=>{
  const h=nativeHarness();assert.equal(h.exports.RECOVERY_NATIVE_INTERFACE_VERSION,1);
  assert.deepEqual(Object.keys(h.api),['resolve','outsideProtectedDirectory','outsideNotificationDirectory','makeDirectory','openDatabase','backupMetadata','leaseBound','databaseBinding','createEmptyDump','dump','syncDump','fileSHA','durableFile','readManifest','newId','createdAt','pretty','trustedTime','validTargetDatabase','validTrustDigest','sqlPath','beginRestore','createRestoreTarget','restoreDump','closeRestoreSource']);
  assert.equal(h.api.resolve,paths.resolve);assert.equal(h.api.newId,h.randomUUID);assert.equal(h.api.trustedTime,h.exports.trustedRecoveryTime);
  const db=h.api.openDatabase('mysql://source');assert.deepEqual(h.events,[['database','mysql://source']]);
  const rows=[{raw:'provider-owned'}];h.state.queryRows=rows;
  for(const method of ['backupMetadata','leaseBound','databaseBinding'])assert.equal(await h.api[method](db),rows);
  assert.deepEqual(h.events.slice(1).map(x=>x[1]),[
    'SELECT DATABASE() name,CONCAT(@@server_uuid,\':\',DATABASE()) binding,VERSION() version,(SELECT COUNT(*) FROM nodes) nodes,(SELECT COUNT(*) FROM forwards) forwards,(SELECT COUNT(*) FROM operations) operations',
    'SELECT MAX(valid_until) until FROM execution_leases',"SELECT CONCAT(@@server_uuid,':',DATABASE()) binding"]);
  h.state.fail='pool-query';await assert.rejects(h.api.leaseBound(db),error=>error===h.failure);
  h.state.fail='database';assert.throws(()=>h.api.openDatabase('bad'),error=>error===h.failure);
  assert.equal(h.api.createdAt(),'1970-01-01T00:00:10.000Z');assert.equal(h.api.pretty({b:1,a:[2]}),'{\n  "b": 1,\n  "a": [\n    2\n  ]\n}');
  await h.api.makeDirectory('/output');assert.deepEqual(plain(h.events.at(-1)),['mkdir','/output',{recursive:true,mode:448}]);
  assert.equal(await h.api.fileSHA('/dump.sql'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('native mysqldump retains exact decoded IPv6 argv env limits and pre-execute versus masked failure boundary',async()=>{
  const h=nativeHarness();const options={mysqldump:'original-dump',databaseUrl:'mysql://u%40ser:p%24ss@[::1]:3307/source_db'};
  await h.api.dump(options,'/output/raw.sql');
  assert.deepEqual(plain(h.events),[['execute','original-dump',['--no-defaults','--host=::1','--port=3307','--user=u@ser','--single-transaction','--quick','--skip-comments','--no-tablespaces','--set-gtid-purged=OFF','--hex-blob','--result-file=/output/raw.sql','source_db'],{env:{NATIVE_RECOVERY_TEST:'retained',MYSQL_PWD:'p$ss'},timeout:120000,maxBuffer:1048576}]]);
  const original=Error('getter');h.events.length=0;
  await assert.rejects(h.api.dump({get databaseUrl(){throw original;}},'/out'),error=>error===original);assert.deepEqual(h.events,[]);
  for(const url of ['https://host/db','mysql://host/db-name','mysql://host/'+ 'a'.repeat(65)])await assert.rejects(h.api.dump({databaseUrl:url,get mysqldump(){return assert.fail('URL validation precedes executable getter');}},'/out'));
  await assert.rejects(h.api.dump({databaseUrl:'mysql://host/db',get mysqldump(){throw original;}},'/out'),{message:'MySQL dump failed; no backup manifest was accepted'});
  h.state.fail='execute';await assert.rejects(h.api.dump({databaseUrl:'mysql://host/db',mysqldump:'dump'},'/out'),{message:'MySQL dump failed; no backup manifest was accepted'});
  const lastExecution=h.events.at(-1);assert.ok(lastExecution);const lastArguments=lastExecution[2];assert.ok(lastArguments);assert.equal(lastArguments[2],'--port=3306');
  assert.equal(h.events.some(x=>x[0]==='write'),false);
});

test('native durable output uses direct exclusive target write sync finally close and POSIX directory sync with original error precedence',async()=>{
  const expected=['open','write','file-sync','file-close','open','dir-sync','dir-close'];
  const h=nativeHarness();await h.api.durableFile('/out/manifest.json','bytes');assert.deepEqual(h.events.map(x=>x[0]),expected);
  assert.deepEqual(h.events[0],['open','/out/manifest.json','wx',384]);assert.deepEqual(h.events[4],['open','/out','r']);
  for(const stage of ['open','write','file-sync','file-close','dir-sync','dir-close']) {
    const f=nativeHarness();f.state.fail=stage;await assert.rejects(f.api.durableFile('/out/file','bytes'),error=>error===f.failure);
    if(stage==='open')assert.deepEqual(f.events,[['open','/out/file','wx',384]]);
    if(stage==='write'||stage==='file-sync')assert.equal(f.events.at(-1)[0],'file-close');
    if(['write','file-sync','file-close'].includes(stage))assert.equal(f.events.some(x=>x[1]==='/out'),false);
    if(stage==='dir-sync')assert.equal(f.events.at(-1)[0],'dir-close');
  }
  const close=nativeHarness();const first=Error('write failed'),last=Error('close failed');close.file.writeFile=async()=>{throw first;};close.file.close=async()=>{throw last;};await assert.rejects(close.api.durableFile('/out/file','bytes'),error=>error===last);
  const dirOpen=nativeHarness();dirOpen.state.open=(_path:string,flag:string)=>{if(flag==='r')throw dirOpen.failure;return dirOpen.file;};await assert.rejects(dirOpen.api.durableFile('/out/file','bytes'),error=>error===dirOpen.failure);assert.deepEqual(dirOpen.events.map(x=>x[0]),['open','write','file-sync','file-close','open']);
  const dirClose=nativeHarness();dirClose.directory.sync=async()=>{throw first;};dirClose.directory.close=async()=>{throw last;};await assert.rejects(dirClose.api.durableFile('/out/file','bytes'),error=>error===last);
  const win=nativeHarness({platform:'win32'});await win.api.durableFile('/out/file','bytes');assert.deepEqual(win.events.map(x=>x[0]),expected.slice(0,4));
  const empty=nativeHarness();await empty.api.createEmptyDump('/out/dump');assert.deepEqual(empty.events,[['open','/out/dump','wx',384],['file-close']]);
  for(const stage of ['open','file-close']){const f=nativeHarness();f.state.fail=stage;await assert.rejects(f.api.createEmptyDump('/out/dump'),error=>error===f.failure);assert.equal(f.events.some(x=>x[0]==='write'||x[0]==='dir-sync'),false);}
  const sync=nativeHarness();await sync.api.syncDump('/out/dump','/out');assert.deepEqual(sync.events,[['chmod','/out/dump',384],['open','/out/dump','r+'],['file-sync'],['file-close'],['open','/out','r'],['dir-sync'],['dir-close']]);
  for(const stage of ['chmod','open','file-sync','file-close','dir-sync','dir-close']){const f=nativeHarness();f.state.fail=stage;await assert.rejects(f.api.syncDump('/out/dump','/out'),error=>error===f.failure);if(stage==='file-sync')assert.equal(f.events.at(-1)[0],'file-close');}
  for(const stage of ['read-stream','hash-chunk']){const f=nativeHarness();f.state.fail=stage;await assert.rejects(f.api.fileSHA('/dump.sql'),error=>error===f.failure);assert.equal(f.events.some(x=>x[0]==='open'||x[0]==='write'),false);}
});

test('native operator directory identity preserves lexical authority and realpath missing-ancestor vault exclusions',async()=>{
  const h=nativeHarness();
  for(const output of ['/out','/out/key','/'])assert.throws(()=>h.api.outsideProtectedDirectory(output,{keyPath:'/out/key'}),/Authority secrets/);
  for(const output of ['/outside','/sibling','/out/key-sibling'])assert.doesNotThrow(()=>h.api.outsideProtectedDirectory(output,{keyPath:'/out/key'}));
  await h.api.outsideNotificationDirectory('/out',undefined);assert.deepEqual(h.events,[]);
  await assert.rejects(h.api.outsideNotificationDirectory('/out','relative'),{message:'Protected notification material must remain separate from operator output'});assert.deepEqual(h.events,[]);
  for(const [output,vault] of [['/same','/same'],['/out','/out/vault'],['/out/sub','/out']])await assert.rejects(h.api.outsideNotificationDirectory(output,vault),/Protected notification material/);
  const fresh=nativeHarness();fresh.state.lstat=(path:string)=>{if(path==='/out/new/deep'||path==='/out/new')throw Object.assign(Error('missing'),{code:'ENOENT'});return {isSymbolicLink:()=>false,isDirectory:()=>true};};
  fresh.state.realpath=(path:string)=>'/canonical'+path;await fresh.api.outsideNotificationDirectory('/out/new/deep','/vault');
  assert.deepEqual(fresh.events.filter(x=>x[0]==='lstat'&&x[1].startsWith('/out')).map(x=>x[1]),['/out/new/deep','/out/new','/out']);
  assert.ok(fresh.events.some(x=>x[0]==='realpath'&&x[1]==='/out'));assert.ok(fresh.events.some(x=>x[0]==='lstat'&&x[1]==='/'));
  for(const mode of ['leaf-link','leaf-file','ancestor-link','stat-error','realpath-error','canonical-overlap']) {
    const f=nativeHarness();f.state.lstat=(path:string)=>{if(mode==='stat-error'&&path==='/out/leaf')throw Object.assign(Error('denied'),{code:'EACCES'});return {isSymbolicLink:()=>mode==='leaf-link'&&path==='/out/leaf'||mode==='ancestor-link'&&path==='/out',isDirectory:()=>!(mode==='leaf-file'&&path==='/out/leaf')};};
    f.state.realpath=(path:string)=>{if(mode==='realpath-error')throw Error('resolve');return mode==='canonical-overlap'?'/same':path;};
    await assert.rejects(f.api.outsideNotificationDirectory('/out/leaf','/vault'),{message:'Protected notification material must remain separate from operator output'});
  }
});

function manifest(){return {payload:{version:1,id:'00000000-0000-0000-0000-000000000001',createdAt:'2026-01-01T00:00:00Z',database:'database_1',authorityBinding:'binding',trustDigest:'sha256:'+'a'.repeat(64),sqlFile:'00000000-0000-0000-0000-000000000001.sql',sqlSHA:'b'.repeat(64),mysqlVersion:'8',nodeCount:0,forwardCount:1,operationCount:2},mac:'original-mac'};}
test('native manifest parser retains exact bounded closed keys native date and count coercion refusal without adding MAC validation',async()=>{
  const h=nativeHarness();h.state.manifest=JSON.stringify(manifest());const result=await h.api.readManifest('/input.json');assert.deepEqual(plain(result),manifest());
  assert.deepEqual(h.events.slice(0,2),[['read-file','/input.json','utf8'],['parse-json',h.state.manifest,16384]]);
  const refusals:any[]=[{...manifest(),extra:1},{...manifest(),payload:{...manifest().payload,extra:1}},null,[],{mac:'x',payload:null}];
  for(const key of Object.keys(manifest().payload)){const item:any=manifest();delete item.payload[key];refusals.push(item);}
  for(const [key,value] of [['version',2],['id','bad'],['createdAt','bad'],['database','unsafe-name'],['authorityBinding','a'.repeat(129)],['trustDigest','sha256:'+'A'.repeat(64)],['sqlFile','../x.sql'],['sqlSHA','f'.repeat(63)],['mysqlVersion','x'.repeat(129)],['nodeCount',-1],['forwardCount',1.5],['operationCount',Number.MAX_SAFE_INTEGER+1]]){const item:any=manifest();item.payload[key as string]=value;refusals.push(item);}
  for(const item of refusals){h.state.manifest=JSON.stringify(item);await assert.rejects(h.api.readManifest('/input.json'));}
  for(const raw of ['{"mac":"x","mac":"y","payload":{}}','{',' '.repeat(16385)]){h.state.manifest=raw;await assert.rejects(h.api.readManifest('/input.json'));}
  const loose:any=manifest();loose.mac=42;loose.payload.id='-'.repeat(36);loose.payload.sqlFile=loose.payload.id+'.sql';loose.payload.authorityBinding='';loose.payload.mysqlVersion='';h.state.manifest=JSON.stringify(loose);assert.deepEqual(plain(await h.api.readManifest('/input.json')),loose);
  const identity=nativeHarness(),parsed=manifest();identity.state.parse=()=>parsed;assert.equal(await identity.api.readManifest('/input.json'),parsed);
  for(const stage of ['read-file','parse-json']){const f=nativeHarness();f.state.fail=stage;await assert.rejects(f.api.readManifest('/input.json'),error=>error===f.failure);}
  const coercible={toString:()=> 'db_1'};assert.equal(h.api.validTargetDatabase(coercible),true);assert.equal(h.api.validTargetDatabase(null),true);assert.equal(h.api.validTargetDatabase('x'.repeat(65)),false);
  assert.equal(h.api.validTrustDigest({toString:()=> 'sha256:'+'a'.repeat(64)}),true);assert.equal(h.api.validTrustDigest('sha256:'+'a'.repeat(63)),false);
  assert.equal(h.api.sqlPath({manifest:'/backup/file.json'},'a-b.sql'),'/backup/a-b.sql');assert.throws(()=>h.api.sqlPath({manifest:'/backup/file.json'},'../bad.sql'),/Unsafe backup SQL path/);
});

test('trusted Recovery time keeps original argument defaults started exec bounded parse and short-circuit late clock order',async()=>{
  const good=(at:number,skew=5)=>JSON.stringify({synchronized:true,checkedAt:new Date(at).toISOString(),maxSkewSeconds:skew});
  const h=nativeHarness();h.state.stdout=good(10000);assert.deepEqual(plain(await h.exports.trustedRecoveryTime('clock')), {now:10000,maxSkewSeconds:5});
  assert.deepEqual(plain(h.events),[['now'],['execute','clock',['--check'],{timeout:10000,maxBuffer:8192}],['parse-json',good(10000),8192],['date-parse',new Date(10000).toISOString()],['now']]);
  const args=['--bounded'];const f=nativeHarness();f.state.stdout=good(10000,1);await f.exports.trustedRecoveryTime('clock',args);assert.deepEqual(args,['--bounded']);assert.deepEqual(plain(f.events[1][2]),['--bounded','--check']);
  for(const args of [null,{},[1]]){const bad=nativeHarness();await assert.rejects(bad.exports.trustedRecoveryTime('clock',args),/Clock arguments must be strings/);assert.deepEqual(bad.events,[]);}
  for(const at of [5000,15000]){const b=nativeHarness();b.state.stdout=good(at);assert.equal((await b.exports.trustedRecoveryTime('clock')).now,at);}
  for(const [at,skew,synchronized] of [[4999,5,true],[15001,5,true],[10000,0,true],[10000,6,true],[10000,1.5,true],[10000,1,false]] as const){const b=nativeHarness();b.state.stdout=JSON.stringify({synchronized,checkedAt:new Date(at).toISOString(),maxSkewSeconds:skew});await assert.rejects(b.exports.trustedRecoveryTime('clock'),/Fresh trusted OS clock/);assert.equal(b.events.filter(x=>x[0]==='now').length,at===15001?2:1);}
  const raw=nativeHarness();raw.state.fail='execute';await assert.rejects(raw.exports.trustedRecoveryTime('clock'),error=>error===raw.failure);assert.equal(raw.events.some(x=>x[0]==='parse-json'),false);
  const extra=nativeHarness();extra.state.stdout=JSON.stringify({...JSON.parse(good(10000)),additional:'retained native compatibility'});assert.equal((await extra.exports.trustedRecoveryTime('clock')).now,10000);
  for(const stdout of ['{','{"synchronized":true,"synchronized":false}','x'.repeat(8193)]){const bad=nativeHarness();bad.state.stdout=stdout;await assert.rejects(bad.exports.trustedRecoveryTime('clock'));assert.equal(bad.events.some(x=>x[0]==='date-parse'),false);}
  const order=nativeHarness();order.state.parse=()=>new Proxy({synchronized:false,checkedAt:'bad',maxSkewSeconds:1},{get(target,key){order.events.push(['field',key]);return Reflect.get(target,key);}});await assert.rejects(order.exports.trustedRecoveryTime('clock'),/Fresh trusted OS clock/);assert.deepEqual(order.events.filter(x=>x[0]==='field').map(x=>x[1]),['checkedAt','synchronized']);
});

test('native restore source fresh-target DDL and original direct admin close retain distinct failure boundaries',async()=>{
  const h=nativeHarness();const source='mysql://user:pass@host/source';
  await assert.rejects(h.api.beginRestore({sourceDatabaseUrl:source,targetDatabase:'source'}),/Restore never overwrites/);assert.deepEqual(h.events,[]);
  const session=await h.api.beginRestore({sourceDatabaseUrl:source,targetDatabase:'fresh'});assert.equal(session.admin,h.mysql);assert.equal(session.recoveryId,'00000000-0000-0000-0000-000000000001');assert.deepEqual(h.events,[['connect',source],['uuid']]);
  h.state.queryRows=[{SCHEMA_NAME:'fresh'}];await assert.rejects(h.api.createRestoreTarget(session,{targetDatabase:'fresh'}),/Restore target must not already exist/);assert.equal(session.source.pathname,'/source');assert.equal(h.events.filter(x=>x[0]==='admin-query').length,1);
  h.state.queryRows=[];assert.equal(await h.api.createRestoreTarget(session,{targetDatabase:'fresh'}),'mysql://user:pass@host/fresh');assert.deepEqual(plain(h.events.slice(-2)),[['admin-query','SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',['fresh']],['admin-query','CREATE DATABASE `fresh`']]);
  const close=Promise.resolve('closed');h.state.endPromise=close;assert.equal(h.api.closeRestoreSource(session),close);
  const failed=nativeHarness();failed.state.fail='connect';await assert.rejects(failed.api.beginRestore({sourceDatabaseUrl:source,targetDatabase:'fresh'}),error=>error===failed.failure);assert.equal(failed.events.some(x=>x[0]==='uuid'),false);
  const uuid=nativeHarness();uuid.state.fail='uuid';await assert.rejects(uuid.api.beginRestore({sourceDatabaseUrl:source,targetDatabase:'fresh'}),error=>error===uuid.failure);assert.deepEqual(uuid.events,[['connect',source],['uuid']]);
  const getters=nativeHarness(),keys:string[]=[];await getters.api.beginRestore(new Proxy({sourceDatabaseUrl:source,targetDatabase:'fresh'},{get(target,key){keys.push(String(key));return Reflect.get(target,key);}}));assert.deepEqual(keys,['sourceDatabaseUrl','targetDatabase','sourceDatabaseUrl']);
  const ddl=nativeHarness();const other=await ddl.api.beginRestore({sourceDatabaseUrl:source,targetDatabase:'fresh'});ddl.state.query=(sql:string)=>{if(sql.startsWith('CREATE'))throw ddl.failure;return [[]];};await assert.rejects(ddl.api.createRestoreTarget(other,{targetDatabase:'fresh'}),error=>error===ddl.failure);assert.equal(other.source.pathname,'/source');assert.equal(ddl.events.some(x=>x[0]==='admin-end'),false);
});

test('native restore child preserves stderr error exit pipeline Promise.all and original uncancelled partial process behavior',async()=>{
  const h=nativeHarness();const stream=deferred(),childDone=deferred();h.state.pipeline=()=>stream.promise;
  let settled=false;const pending=h.api.restoreDump({mysql:'original-client'},'mysql://u:p@host:3307/fresh','/dump.sql').then(()=>{settled=true;childDone.resolve();});
  assert.deepEqual(plain(h.events[0]),['spawn','original-client',['--no-defaults','--host=host','--port=3307','--user=u','--database=fresh','--binary-mode'],{env:{NATIVE_RECOVERY_TEST:'retained',MYSQL_PWD:'p'},stdio:['pipe','ignore','pipe']}]);
  assert.deepEqual(h.events.slice(1).map(x=>x.slice(0,2)),[['stderr','data'],['child-once','error'],['child-once','exit'],['read-stream','/dump.sql'],['pipeline',h.events.at(-1)[1]]]);
  assert.equal(h.events.at(-1)[2],h.child.stdin);h.child.emit('exit',0);await Promise.resolve();assert.equal(settled,false);stream.resolve();await pending;await childDone.promise;assert.equal(settled,true);
  for(const mode of ['error','nonzero','pipeline']){const f=nativeHarness(),pipe=deferred();f.state.pipeline=()=>pipe.promise;const result=f.api.restoreDump({mysql:'client'},'mysql://host/db','/dump');const rejection=assert.rejects(result,mode==='pipeline'?(error:unknown)=>error===f.failure:mode==='error'?/MySQL restore process failed/:/MySQL restore rejected the protected dump/);if(mode==='pipeline')pipe.reject(f.failure);else {f.child.emit(mode==='error'?'error':'exit',mode==='error'?f.failure:1);pipe.resolve();}await rejection;if(mode==='pipeline')f.child.emit('exit',0);assert.equal(f.events.filter(x=>x[0]==='spawn').length,1);assert.equal(f.events.some(x=>x[0]==='admin-query'||x[0]==='execute'),false);}
  const spawn=nativeHarness();spawn.state.fail='spawn';await assert.rejects(spawn.api.restoreDump({mysql:'client'},'mysql://host/db','/dump'),error=>error===spawn.failure);assert.deepEqual(spawn.events.map(x=>x[0]),['spawn']);
  for(const stage of ['stderr','read-stream','pipeline']){const f=nativeHarness();f.state.fail=stage;await assert.rejects(f.api.restoreDump({mysql:'client'},'mysql://host/db','/dump'),error=>error===f.failure);if(stage!=='stderr')f.child.emit('exit',0);assert.equal(f.events.filter(x=>x[0]==='spawn').length,1);}
});

function workflowHarness() {
  const events:string[]=[],failure=Error('workflow effect failure'),tx=Object.freeze({original:'tx'});
  const data:any={fail:'',committed:false,authorityReads:0,vaultReads:0,record:{version:1,sequence:1,database:'binding',trustDigest:'old',maintenance:true,latestValidUntil:10000,maxClockSkewSeconds:5},
    envelope:{payload:{version:1,authorityBinding:'binding',trustDigest:'old',sqlFile:'dump.sql',sqlSHA:'hash'},mac:'mac'},now:15000,skew:0,lease:10000,
    accounts:[{actorId:'owner',owner:true,token:'owner-token'},{actorId:'member',owner:false,token:'member-token'}],prettyValue:undefined,afterDump:()=>{},targetValid:true,trustValid:true};
  const act=(name:string)=>{events.push(name);if(data.fail===name)throw failure;};
  const db={async migrate(){act('migrate');},async close(){act('close-db');},async transaction<T>(callback:(current:typeof tx)=>Promise<T>):Promise<T>{act('begin');let result:T;try{result=await callback(tx);}catch(error){act('rollback');throw error;}act('commit');data.committed=true;return result;}};
  const authority={keyPath:'/key',async read(){act('authority:'+ ++data.authorityReads);return data.currentRecord={...data.record};},async signArtifact(payload:unknown){act('sign');data.signed=payload;return 'signature';},async verifyArtifact(payload:unknown,mac:unknown){assert.equal(payload,data.envelope.payload);assert.equal(mac,'mac');act('verify');},async rebind(binding:string,trust:string,id:string){assert.equal(data.committed,true);act('rebind');data.rebind=[binding,trust,id];return data.record;}};
  const source={recoveryId:'recovery'};
  const native:any={resolve:(...args:string[])=>{act('resolve:'+args.join('/'));return args.join('/');},outsideProtectedDirectory:()=>act('protected'),outsideNotificationDirectory:async()=>act('vault:'+ ++data.vaultReads),makeDirectory:async()=>act('mkdir'),
    openDatabase:(url:string)=>{act('open:'+url);return db;},backupMetadata:async(supplied:unknown)=>{assert.equal(supplied,db);act('metadata');return data.metadata??[{name:'db',binding:'binding',version:'8',nodes:1,forwards:2,operations:3}];},
    leaseBound:async(supplied:unknown)=>{assert.equal(supplied,db);act('leases');return [{until:data.lease}];},databaseBinding:async(supplied:unknown)=>{assert.equal(supplied,db);act('binding');return [{binding:'new-binding'}];},
    createEmptyDump:async()=>act('exclusive'),dump:async(supplied:unknown)=>{data.dumpOptions=supplied;act('dump');data.afterDump();},syncDump:async()=>act('sync'),fileSHA:async()=>{act('hash');return data.hash??'hash';},durableFile:async(path:string,content:string)=>{act('durable:'+path);data.durable=[path,content];},
    readManifest:async()=>{act('manifest');return data.envelope;},newId:()=>{act('id');return 'backup';},createdAt:()=>{act('created');return 'time';},pretty:(value:unknown)=>{act('pretty');data.prettyValue=value;return 'encoded';},
    validTargetDatabase:()=>{act('target-valid');return data.targetValid;},validTrustDigest:()=>{act('trust-valid');return data.trustValid;},trustedTime:async()=>{act('trusted');return {now:data.now,maxSkewSeconds:data.skew};},sqlPath:()=>{act('sql-path');return '/dump.sql';},
    beginRestore:async(supplied:unknown)=>{assert.equal(supplied,restore);act('source');return source;},createRestoreTarget:async(supplied:unknown,options:unknown)=>{assert.equal(supplied,source);assert.equal(options,restore);act('target');return 'restored';},restoreDump:async(options:unknown,url:string,path:string)=>{assert.equal(options,restore);assert.deepEqual([url,path],['restored','/dump.sql']);act('restore');},closeRestoreSource:async(supplied:unknown)=>{assert.equal(supplied,source);act('close-source');}};
  const backup:any={databaseUrl:'source',authority,directory:'/backup',mysqldump:'dump'};
  const restore:any={sourceDatabaseUrl:'source',targetDatabase:'new',manifest:'/manifest.json',authority,newTrustDigest:'fresh',mysql:'mysql',credentialsDirectory:'/credentials',issuersStopped:true,timeChecker:'clock'};
  const host=new RecoveryWorkflow<any,typeof db,typeof source>({native,quarantine:async(supplied,current,context)=>{assert.equal(supplied,db);assert.equal(current,tx);assert.equal(context.authority,data.currentRecord);assert.equal(context.manifest,data.envelope.payload);assert.equal(context.recoveryId,'recovery');assert.equal(context.newTrustDigest,'fresh');act('quarantine');context.acceptCredentials(data.accounts);}});
  return {host,db,authority,source,native,data,backup,restore,events,failure};
}

test('Recovery backup owner retains full preparation signed manifest sequence lazy options and every bounded partial-effect failure',async()=>{
  const h=workflowHarness();assert.equal(await h.host.backupDatabase(h.backup),'/backup/backup.json');
  const expected=['resolve:/backup','protected','vault:1','mkdir','vault:2','open:source','metadata','authority:1','id','resolve:/backup/backup.sql','exclusive','dump','sync','authority:2','leases','created','hash','resolve:/backup/backup.json','sign','pretty','durable:/backup/backup.json','close-db'];
  assert.deepEqual(h.events,expected);assert.deepEqual(h.data.prettyValue,{payload:{version:1,id:'backup',createdAt:'time',database:'db',authorityBinding:'binding',trustDigest:'old',sqlFile:'backup.sql',sqlSHA:'hash',mysqlVersion:'8',nodeCount:1,forwardCount:2,operationCount:3},mac:'signature'});assert.equal(h.data.signed,h.data.prettyValue.payload);
  assert.equal(h.data.dumpOptions,h.backup);
  for(const stage of expected){const f=workflowHarness();f.data.fail=stage;await assert.rejects(f.host.backupDatabase(f.backup),error=>error===f.failure);const beforeOpen=expected.indexOf(stage)<=expected.indexOf('open:source');assert.equal(f.events.includes('close-db'),!beforeOpen,stage);if(expected.indexOf(stage)<expected.indexOf('durable:/backup/backup.json'))assert.equal(f.events.includes('durable:/backup/backup.json'),false,stage);}
  const lazy=workflowHarness(),keys:string[]=[];lazy.backup=new Proxy(lazy.backup,{get(target,key){keys.push(String(key));return Reflect.get(target,key);}});await lazy.host.backupDatabase(lazy.backup);
  assert.deepEqual(keys,['directory','authority','notificationSecretsDirectory','notificationSecretsDirectory','databaseUrl','authority','authority','authority']);
  assert.equal(lazy.data.dumpOptions,lazy.backup);
  for(const mode of ['initial-binding','changed-binding','changed-trust','lease-overrun']){const f=workflowHarness();if(mode==='initial-binding')f.data.record.database='foreign';else if(mode==='lease-overrun')f.data.lease=10001;else f.data.afterDump=()=>{f.data.record[mode==='changed-binding'?'database':'trustDigest']='changed';};await assert.rejects(f.host.backupDatabase(f.backup));assert.equal(f.events.includes('sign'),false);assert.equal(f.events.at(-1),'close-db');}
  const absent=workflowHarness();absent.data.metadata=[];await assert.rejects(absent.host.backupDatabase(absent.backup));assert.deepEqual(absent.events.slice(-3),['metadata','authority:1','close-db']);
  const nil=workflowHarness();nil.data.record.latestValidUntil=null;nil.data.lease=null;await nil.host.backupDatabase(nil.backup);assert.ok(nil.data.durable);
});

test('Recovery restore owner retains full no-side-effect refusals trusted exhaustion and same transaction commit before credentials binding and closes',async()=>{
  const h=workflowHarness();assert.deepEqual(await h.host.restoreDatabase(h.restore),{recoveryId:'recovery',databaseUrl:'restored',ownerCredentials:'/credentials/recovery-credentials.json'});
  const expected=['target-valid','authority:1','manifest','verify','trust-valid','sql-path','hash','trusted','resolve:/credentials','protected','vault:1','mkdir','vault:2','source','target','restore','open:restored','migrate','leases','begin','quarantine','commit','binding','resolve:/credentials/recovery-credentials.json','pretty','durable:/credentials/recovery-credentials.json','rebind','close-db','close-source'];
  assert.deepEqual(h.events,expected);assert.equal(h.data.prettyValue.accounts,h.data.accounts);assert.deepEqual(h.data.prettyValue.owners,[h.data.accounts[0]]);assert.equal(h.data.prettyValue.owners[0],h.data.accounts[0]);assert.deepEqual(h.data.rebind,['new-binding','fresh','recovery']);
  for(const stage of expected){const f=workflowHarness();f.data.fail=stage;await assert.rejects(f.host.restoreDatabase(f.restore),error=>error===f.failure);const position=expected.indexOf(stage);assert.equal(f.events.includes('close-source'),position>expected.indexOf('source'),stage);assert.equal(f.events.includes('close-db'),position>expected.indexOf('open:restored'),stage);assert.equal(f.data.committed,position>expected.indexOf('commit'),stage);assert.equal(f.events.includes('rollback'),stage==='quarantine',stage);if(position<expected.indexOf('rebind'))assert.equal(f.events.includes('rebind'),false,stage);}
  for(const mode of ['issuers','target','maintenance','version','binding','trust','same-trust','hash','historical-bound','restored-bound']){
    const f=workflowHarness();if(mode==='issuers')f.restore.issuersStopped=false;if(mode==='target')f.data.targetValid=false;if(mode==='maintenance')f.data.record.maintenance=false;
    if(mode==='version')f.data.envelope.payload.version=2;if(mode==='binding')f.data.envelope.payload.authorityBinding='other';if(mode==='trust')f.data.trustValid=false;if(mode==='same-trust')f.restore.newTrustDigest='old';if(mode==='hash')f.data.hash='tampered';if(mode==='historical-bound')f.data.now=14999;if(mode==='restored-bound')f.data.lease=10001;
    await assert.rejects(f.host.restoreDatabase(f.restore));assert.equal(f.events.includes('begin'),false,mode);assert.equal(f.events.includes('rebind'),false,mode);
    if(mode!=='restored-bound')assert.equal(f.events.includes('source'),false,mode);if(mode==='issuers')assert.deepEqual(f.events,[]);if(mode==='version'||mode==='binding')assert.equal(f.events.includes('trust-valid'),false);
  }
  const lazy=workflowHarness();let reads=0;Object.defineProperty(lazy.restore,'newTrustDigest',{get(){reads++;return 'fresh';}});await lazy.host.restoreDatabase(lazy.restore);assert.equal(reads,4);
  const ownerFailure=workflowHarness();Object.defineProperty(ownerFailure.data.accounts[0],'owner',{get(){throw ownerFailure.failure;}});await assert.rejects(ownerFailure.host.restoreDatabase(ownerFailure.restore),error=>error===ownerFailure.failure);assert.equal(ownerFailure.data.committed,true);assert.equal(ownerFailure.events.includes('rollback'),false);assert.equal(ownerFailure.events.includes('pretty'),false);assert.deepEqual(ownerFailure.events.slice(-2),['close-db','close-source']);
  const precedence=workflowHarness(),closeError=Error('source end failed');precedence.data.fail='quarantine';precedence.native.closeRestoreSource=async()=>{throw closeError;};await assert.rejects(precedence.host.restoreDatabase(precedence.restore),error=>error===closeError);assert.equal(precedence.events.includes('rollback'),true);
});
