import { createHash,randomUUID } from 'node:crypto';
import { mkdir,readFile,chmod,open,lstat,realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { spawn,execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve,dirname,basename,relative,isAbsolute,sep } from 'node:path';
import { createConnection } from 'mysql2/promise';
import type { Connection } from 'mysql2/promise';
import { parseJson } from '@tunex/contracts';
import { MySqlUnitOfWork } from '../infrastructure/mysql.ts';
export type { AuthorityRecord as NativeRecoveryAuthorityRecord } from '../infrastructure/authority.ts';
export const RECOVERY_NATIVE_INTERFACE_VERSION=1 as const;
const execute=promisify(execFile);
async function durableFile(path:string,content:string):Promise<void>{
 const file=await open(path,'wx',0o600);try{await file.writeFile(content);await file.sync();}finally{await file.close();}
 await syncDirectory(dirname(path));
}
async function syncDirectory(path:string):Promise<void>{if(process.platform!=='win32'){const directory=await open(path,'r');try{await directory.sync();}finally{await directory.close();}}}
export interface BackupManifest {version:1;id:string;createdAt:string;database:string;authorityBinding:string;trustDigest:string;sqlFile:string;sqlSHA:string;mysqlVersion:string;nodeCount:number;forwardCount:number;operationCount:number}
export interface BackupEnvelope {payload:BackupManifest;mac:string}
function parseManifest(raw:string):BackupEnvelope{
 const value=parseJson(raw,16384) as BackupEnvelope;
 if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='mac,payload'||!value.payload||typeof value.payload!=='object')throw new Error('Invalid backup envelope');
 const m=value.payload;
 if(Object.keys(m).sort().join(',')!=='authorityBinding,createdAt,database,forwardCount,id,mysqlVersion,nodeCount,operationCount,sqlFile,sqlSHA,trustDigest,version'||m.version!==1||typeof m.id!=='string'||!/^[0-9a-f-]{36}$/.test(m.id)||typeof m.createdAt!=='string'||!Number.isFinite(Date.parse(m.createdAt))||typeof m.database!=='string'||!/^[A-Za-z0-9_]{1,64}$/.test(m.database)||typeof m.authorityBinding!=='string'||m.authorityBinding.length>128||typeof m.trustDigest!=='string'||!/^sha256:[0-9a-f]{64}$/.test(m.trustDigest)||m.sqlFile!==`${m.id}.sql`||typeof m.sqlSHA!=='string'||!/^[0-9a-f]{64}$/.test(m.sqlSHA)||typeof m.mysqlVersion!=='string'||m.mysqlVersion.length>128||[m.nodeCount,m.forwardCount,m.operationCount].some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('Invalid backup manifest');
 return value;
}
function clientOptions(url:string){const value=new URL(url);if(value.protocol!=='mysql:')throw new Error('MySQL URL required');const database=decodeURIComponent(value.pathname.slice(1));if(!/^[A-Za-z0-9_]{1,64}$/.test(database))throw new Error('Simple bounded database name required');return {database,args:['--no-defaults',`--host=${value.hostname.replace(/^\[|\]$/g,'')}`,`--port=${value.port||3306}`,`--user=${decodeURIComponent(value.username)}`,`--database=${database}`],env:{...process.env,MYSQL_PWD:decodeURIComponent(value.password)}};}
function outsideProtectedDirectory(directory:string,authority:{keyPath:string}){const path=relative(resolve(directory),authority.keyPath);if(path===''||path!=='..'&&!path.startsWith('..'+sep)&&!isAbsolute(path))throw new Error('Authority secrets must not be part of backup/recovery output');}
async function operatorDirectoryIdentity(path:string):Promise<string>{
 const missing:string[]=[];let current=resolve(path);
 for(;;){
  let info;
  try{info=await lstat(current);}catch(error){
   if((error as {code?:string}).code!=='ENOENT')throw error;
   const parent=dirname(current);if(parent===current)throw error;missing.push(basename(current));current=parent;continue;
  }
  if(info.isSymbolicLink()||!info.isDirectory())throw new Error('Unsafe operator directory');
  let ancestor=dirname(current);
  for(;;){const parent=await lstat(ancestor);if(parent.isSymbolicLink()||!parent.isDirectory())throw new Error('Unsafe operator directory');const next=dirname(ancestor);if(next===ancestor)break;ancestor=next;}
  return resolve(await realpath(current),...missing.reverse());
 }
}
async function outsideNotificationDirectory(directory:string,protectedDirectory:string|undefined):Promise<void>{
 if(protectedDirectory===undefined)return;
 try{
  if(!isAbsolute(protectedDirectory))throw new Error('Invalid protected directory');
  const [output,vault]=await Promise.all([operatorDirectoryIdentity(directory),operatorDirectoryIdentity(protectedDirectory)]);
  const contains=(parent:string,child:string)=>{const path=relative(parent,child);return path===''||path!=='..'&&!path.startsWith('..'+sep)&&!isAbsolute(path);};
  if(contains(output,vault)||contains(vault,output))throw new Error('Overlapping protected directory');
 }catch{throw new Error('Protected notification material must remain separate from operator output');}
}
async function fileSHA(path:string){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
export async function trustedRecoveryTime(executable:string,args:string[]=[]):Promise<{now:number;maxSkewSeconds:number}>{
 if(!Array.isArray(args)||args.some(arg=>typeof arg!=='string'))throw new Error('Clock arguments must be strings');
 const started=Date.now();
 const result=await execute(executable,[...args,'--check'],{timeout:10000,maxBuffer:8192});const value=parseJson(result.stdout,8192) as {synchronized:boolean;checkedAt:string;maxSkewSeconds:number};
 const now=Date.parse(value.checkedAt);if(value.synchronized!==true||!Number.isInteger(value.maxSkewSeconds)||value.maxSkewSeconds<1||value.maxSkewSeconds>5||!Number.isFinite(now)||now<started-value.maxSkewSeconds*1000||now>Date.now()+value.maxSkewSeconds*1000)throw new Error('Fresh trusted OS clock result required for recovery');return {now,maxSkewSeconds:value.maxSkewSeconds};
}
export interface RecoveryBackupMetadata {name:string;binding:string;version:string;nodes:number;forwards:number;operations:number}
export interface RecoveryLeaseBound {until:number|null}
export interface RecoveryDatabaseBinding {binding:string}
export interface NativeRecoverySource {source:URL;admin:Connection;recoveryId:string}

export const nativeRecoveryEffects={
 resolve,
 outsideProtectedDirectory,
 outsideNotificationDirectory,
 async makeDirectory(directory:string):Promise<void>{await mkdir(directory,{recursive:true,mode:0o700});},
 openDatabase(url:string):MySqlUnitOfWork{return new MySqlUnitOfWork(url);},
 async backupMetadata(db:MySqlUnitOfWork):Promise<RecoveryBackupMetadata[]>{
  const [metadata]=await db.pool.query<any[]>("SELECT DATABASE() name,CONCAT(@@server_uuid,':',DATABASE()) binding,VERSION() version,(SELECT COUNT(*) FROM nodes) nodes,(SELECT COUNT(*) FROM forwards) forwards,(SELECT COUNT(*) FROM operations) operations");return metadata;
 },
 async leaseBound(db:MySqlUnitOfWork):Promise<RecoveryLeaseBound[]>{
  const [leases]=await db.pool.query<any[]>('SELECT MAX(valid_until) until FROM execution_leases');return leases;
 },
 async databaseBinding(db:MySqlUnitOfWork):Promise<RecoveryDatabaseBinding[]>{
  const [binding]=await db.pool.query<any[]>("SELECT CONCAT(@@server_uuid,':',DATABASE()) binding");return binding;
 },
 async createEmptyDump(path:string):Promise<void>{const empty=await open(path,'wx',0o600);await empty.close();},
 async dump(options:{mysqldump:string;databaseUrl:string},path:string):Promise<void>{
  const connection=clientOptions(options.databaseUrl);const args=connection.args.filter(arg=>!arg.startsWith('--database='));
  try{await execute(options.mysqldump,[...args,'--single-transaction','--quick','--skip-comments','--no-tablespaces','--set-gtid-purged=OFF','--hex-blob',`--result-file=${path}`,connection.database],{env:connection.env,timeout:120000,maxBuffer:1048576});}catch{throw new Error('MySQL dump failed; no backup manifest was accepted');}
 },
 async syncDump(path:string,directory:string):Promise<void>{
  await chmod(path,0o600);const file=await open(path,'r+');try{await file.sync();}finally{await file.close();}await syncDirectory(directory);
 },
 fileSHA,
 durableFile,
 async readManifest(path:string):Promise<BackupEnvelope>{return parseManifest(await readFile(path,'utf8'));},
 newId:randomUUID,
 createdAt:()=>new Date().toISOString(),
 pretty:(value:unknown):string=>JSON.stringify(value,null,2),
 trustedTime:trustedRecoveryTime,
 validTargetDatabase:(value:string):boolean=>/^[A-Za-z0-9_]{1,64}$/.test(value),
 validTrustDigest:(value:string):boolean=>/^sha256:[0-9a-f]{64}$/.test(value),
 sqlPath(options:{manifest:string},sqlFile:string):string{
  if(!/^[A-Za-z0-9-]+\.sql$/.test(sqlFile))throw new Error('Unsafe backup SQL path');return resolve(dirname(options.manifest),sqlFile);
 },
 async beginRestore(options:{sourceDatabaseUrl:string;targetDatabase:string}):Promise<NativeRecoverySource>{
  const source=new URL(options.sourceDatabaseUrl);if(decodeURIComponent(source.pathname.slice(1))===options.targetDatabase)throw new Error('Restore never overwrites the source database');const admin=await createConnection(options.sourceDatabaseUrl);const recoveryId=randomUUID();
  return {source,admin,recoveryId};
 },
 async createRestoreTarget(session:NativeRecoverySource,options:{targetDatabase:string}):Promise<string>{
  const [exists]=await session.admin.query<any[]>('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[options.targetDatabase]);if(exists.length)throw new Error('Restore target must not already exist');
  await session.admin.query(`CREATE DATABASE \`${options.targetDatabase}\``);session.source.pathname=`/${options.targetDatabase}`;const databaseUrl=session.source.toString();return databaseUrl;
 },
 async restoreDump(options:{mysql:string},databaseUrl:string,path:string):Promise<void>{
  const connection=clientOptions(databaseUrl);
  const child=spawn(options.mysql,[...connection.args,'--binary-mode'],{env:connection.env,stdio:['pipe','ignore','pipe']});child.stderr.on('data',()=>{});
  const completed=new Promise<void>((resolve,reject)=>{child.once('error',()=>reject(new Error('MySQL restore process failed')));child.once('exit',code=>code===0?resolve():reject(new Error('MySQL restore rejected the protected dump')));});await Promise.all([pipeline(createReadStream(path),child.stdin),completed]);
 },
 closeRestoreSource:(session:NativeRecoverySource)=>session.admin.end(),
};
