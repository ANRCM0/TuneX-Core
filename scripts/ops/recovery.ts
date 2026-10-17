import { RelayCoordinator } from '../../apps/control/src/modules/runtime/relay-coordinator.ts';
import { Transport } from '../../apps/control/src/modules/transport.ts';
import { createHash,randomUUID } from 'node:crypto';
import { mkdir,readFile,chmod,open } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { spawn,execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve,dirname,relative,isAbsolute,sep } from 'node:path';
import { createConnection } from 'mysql2/promise';
import { parseJson } from '@tunex/contracts';
import { AuthorityStore } from '../../apps/control/src/infrastructure/authority.ts';
import { MySqlUnitOfWork,write } from '../../apps/control/src/infrastructure/mysql.ts';
import { Identity } from '../../apps/control/src/modules/identity.ts';
import { Nodes } from '../../apps/control/src/modules/nodes.ts';
import { Forwarding } from '../../apps/control/src/modules/forwarding.ts';
import { RuntimeLedger } from '../../apps/control/src/modules/runtime/ledger.ts';
import { SnapshotAssignmentRegistry } from '../../apps/control/src/modules/runtime/snapshot-assignments.ts';
import { Idempotency } from '../../apps/control/src/modules/idempotency.ts';
import { MySqlProbeInstances } from '../../apps/control/src/infrastructure/mysql-probe-instances.ts';
import { MySqlProbePermits } from '../../apps/control/src/infrastructure/mysql-probe-permits.ts';

const execute=promisify(execFile);
async function durableFile(path:string,content:string):Promise<void>{
 const file=await open(path,'wx',0o600);try{await file.writeFile(content);await file.sync();}finally{await file.close();}
 await syncDirectory(dirname(path));
}
async function syncDirectory(path:string):Promise<void>{if(process.platform!=='win32'){const directory=await open(path,'r');try{await directory.sync();}finally{await directory.close();}}}
interface BackupManifest {version:1;id:string;createdAt:string;database:string;authorityBinding:string;trustDigest:string;sqlFile:string;sqlSHA:string;mysqlVersion:string;nodeCount:number;forwardCount:number;operationCount:number}
interface BackupEnvelope {payload:BackupManifest;mac:string}
function parseManifest(raw:string):BackupEnvelope{
 const value=parseJson(raw,16384) as BackupEnvelope;
 if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='mac,payload'||!value.payload||typeof value.payload!=='object')throw new Error('Invalid backup envelope');
 const m=value.payload;
 if(Object.keys(m).sort().join(',')!=='authorityBinding,createdAt,database,forwardCount,id,mysqlVersion,nodeCount,operationCount,sqlFile,sqlSHA,trustDigest,version'||m.version!==1||typeof m.id!=='string'||!/^[0-9a-f-]{36}$/.test(m.id)||typeof m.createdAt!=='string'||!Number.isFinite(Date.parse(m.createdAt))||typeof m.database!=='string'||!/^[A-Za-z0-9_]{1,64}$/.test(m.database)||typeof m.authorityBinding!=='string'||m.authorityBinding.length>128||typeof m.trustDigest!=='string'||!/^sha256:[0-9a-f]{64}$/.test(m.trustDigest)||m.sqlFile!==`${m.id}.sql`||typeof m.sqlSHA!=='string'||!/^[0-9a-f]{64}$/.test(m.sqlSHA)||typeof m.mysqlVersion!=='string'||m.mysqlVersion.length>128||[m.nodeCount,m.forwardCount,m.operationCount].some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('Invalid backup manifest');
 return value;
}
function clientOptions(url:string){const value=new URL(url);if(value.protocol!=='mysql:')throw new Error('MySQL URL required');const database=decodeURIComponent(value.pathname.slice(1));if(!/^[A-Za-z0-9_]{1,64}$/.test(database))throw new Error('Simple bounded database name required');return {database,args:['--no-defaults',`--host=${value.hostname.replace(/^\[|\]$/g,'')}`,`--port=${value.port||3306}`,`--user=${decodeURIComponent(value.username)}`,`--database=${database}`],env:{...process.env,MYSQL_PWD:decodeURIComponent(value.password)}};}
function outsideProtectedDirectory(directory:string,authority:AuthorityStore){const path=relative(resolve(directory),authority.keyPath);if(path===''||path!=='..'&&!path.startsWith('..'+sep)&&!isAbsolute(path))throw new Error('Authority secrets must not be part of backup/recovery output');}
async function fileSHA(path:string){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
export async function backupDatabase(options:{databaseUrl:string;authority:AuthorityStore;directory:string;mysqldump:string}):Promise<string>{
 const directory=resolve(options.directory);outsideProtectedDirectory(directory,options.authority);await mkdir(directory,{recursive:true,mode:0o700});
 const db=new MySqlUnitOfWork(options.databaseUrl);try{
  const [metadata]=await db.pool.query<any[]>("SELECT DATABASE() name,CONCAT(@@server_uuid,':',DATABASE()) binding,VERSION() version,(SELECT COUNT(*) FROM nodes) nodes,(SELECT COUNT(*) FROM forwards) forwards,(SELECT COUNT(*) FROM operations) operations");
  const current=await options.authority.read();if(current.database!==metadata[0].binding)throw new Error('Backup database does not match protected authority binding');
  const id=randomUUID(),sqlFile=`${id}.sql`,path=resolve(directory,sqlFile);const empty=await open(path,'wx',0o600);await empty.close();
  const connection=clientOptions(options.databaseUrl);const args=connection.args.filter(arg=>!arg.startsWith('--database='));
  try{await execute(options.mysqldump,[...args,'--single-transaction','--quick','--skip-comments','--no-tablespaces','--set-gtid-purged=OFF','--hex-blob',`--result-file=${path}`,connection.database],{env:connection.env,timeout:120000,maxBuffer:1048576});}catch{throw new Error('MySQL dump failed; no backup manifest was accepted');}
  await chmod(path,0o600);const file=await open(path,'r+');try{await file.sync();}finally{await file.close();}await syncDirectory(directory);
  const after=await options.authority.read();if(after.database!==metadata[0].binding||after.trustDigest!==current.trustDigest)throw new Error('Authority binding changed during backup');const [leases]=await db.pool.query<any[]>('SELECT MAX(valid_until) until FROM execution_leases');if(leases[0].until!==null&&(after.latestValidUntil??0)<leases[0].until)throw new Error('Database authorization exceeds the independent trusted record');
  const payload:BackupManifest={version:1,id,createdAt:new Date().toISOString(),database:metadata[0].name,authorityBinding:after.database,trustDigest:after.trustDigest,sqlFile,sqlSHA:await fileSHA(path),mysqlVersion:metadata[0].version,nodeCount:metadata[0].nodes,forwardCount:metadata[0].forwards,operationCount:metadata[0].operations};
  const manifest=resolve(directory,`${id}.json`);await durableFile(manifest,JSON.stringify({payload,mac:await options.authority.signArtifact(payload)},null,2));return manifest;
 }finally{await db.close();}
}
export async function trustedRecoveryTime(executable:string,args:string[]=[]):Promise<{now:number;maxSkewSeconds:number}>{
 if(!Array.isArray(args)||args.some(arg=>typeof arg!=='string'))throw new Error('Clock arguments must be strings');
 const started=Date.now();
 const result=await execute(executable,[...args,'--check'],{timeout:10000,maxBuffer:8192});const value=parseJson(result.stdout,8192) as {synchronized:boolean;checkedAt:string;maxSkewSeconds:number};
 const now=Date.parse(value.checkedAt);if(value.synchronized!==true||!Number.isInteger(value.maxSkewSeconds)||value.maxSkewSeconds<1||value.maxSkewSeconds>5||!Number.isFinite(now)||now<started-value.maxSkewSeconds*1000||now>Date.now()+value.maxSkewSeconds*1000)throw new Error('Fresh trusted OS clock result required for recovery');return {now,maxSkewSeconds:value.maxSkewSeconds};
}
export async function restoreDatabase(options:{sourceDatabaseUrl:string;targetDatabase:string;manifest:string;authority:AuthorityStore;newTrustDigest:string;mysql:string;credentialsDirectory:string;issuersStopped:boolean;timeChecker:string;timeCheckerArgs?:string[]}):Promise<{recoveryId:string;databaseUrl:string;ownerCredentials:string}>{
 if(options.issuersStopped!==true)throw new Error('All signing services must be stopped and verified before restore');
 if(!/^[A-Za-z0-9_]{1,64}$/.test(options.targetDatabase))throw new Error('Bounded fresh database name required');
 const authority=await options.authority.read();if(!authority.maintenance)throw new Error('Protected maintenance state required');
 const envelope=parseManifest(await readFile(options.manifest,'utf8'));await options.authority.verifyArtifact(envelope.payload,envelope.mac);const manifest=envelope.payload;
 if(manifest.version!==1||manifest.authorityBinding!==authority.database||manifest.trustDigest!==authority.trustDigest||!/^sha256:[0-9a-f]{64}$/.test(options.newTrustDigest)||options.newTrustDigest===authority.trustDigest)throw new Error('Fresh trust and matching backup authority required');
 if(!/^[A-Za-z0-9-]+\.sql$/.test(manifest.sqlFile))throw new Error('Unsafe backup SQL path');const path=resolve(dirname(options.manifest),manifest.sqlFile);if(await fileSHA(path)!==manifest.sqlSHA)throw new Error('Backup SQL integrity failure');
 const time=await trustedRecoveryTime(options.timeChecker,options.timeCheckerArgs);if(authority.latestValidUntil!==null&&time.now-time.maxSkewSeconds*1000<authority.latestValidUntil+authority.maxClockSkewSeconds*1000)throw new Error('RECOVERY_NOT_READY: historical authorization has not been exhausted');
 const directory=resolve(options.credentialsDirectory);outsideProtectedDirectory(directory,options.authority);await mkdir(directory,{recursive:true,mode:0o700});
 const source=new URL(options.sourceDatabaseUrl);if(decodeURIComponent(source.pathname.slice(1))===options.targetDatabase)throw new Error('Restore never overwrites the source database');const admin=await createConnection(options.sourceDatabaseUrl);const recoveryId=randomUUID();
 try{
  const [exists]=await admin.query<any[]>('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[options.targetDatabase]);if(exists.length)throw new Error('Restore target must not already exist');
  await admin.query(`CREATE DATABASE \`${options.targetDatabase}\``);source.pathname=`/${options.targetDatabase}`;const databaseUrl=source.toString();const connection=clientOptions(databaseUrl);
  const child=spawn(options.mysql,[...connection.args,'--binary-mode'],{env:connection.env,stdio:['pipe','ignore','pipe']});child.stderr.on('data',()=>{});
  const completed=new Promise<void>((resolve,reject)=>{child.once('error',()=>reject(new Error('MySQL restore process failed')));child.once('exit',code=>code===0?resolve():reject(new Error('MySQL restore rejected the protected dump')));});await Promise.all([pipeline(createReadStream(path),child.stdin),completed]);
  const db=new MySqlUnitOfWork(databaseUrl);let accounts:{actorId:string;token:string;owner:boolean}[]=[];
  try{await db.migrate();const [bounds]=await db.pool.query<any[]>('SELECT MAX(valid_until) until FROM execution_leases');if(bounds[0].until!==null&&bounds[0].until>(authority.latestValidUntil??0))throw new Error('Restored authorization exceeds independently recorded bounds');
   await db.transaction(async tx=>{accounts=await new Identity(db).quarantineRecovery(tx);await Transport.quarantineRecovery(tx);await RelayCoordinator.quarantineRecovery(tx);await Nodes.quarantineRecovery(tx);await MySqlProbeInstances.quarantineRecovery(tx);await MySqlProbePermits.quarantineRecovery(tx);await new Forwarding().quarantineRecovery(tx);await new RuntimeLedger(undefined,undefined,new SnapshotAssignmentRegistry([])).quarantineRecovery(tx);await new Idempotency().quarantineRecovery(tx);await write(tx,'INSERT INTO recovery_events(id,created_at,details) VALUES(?,?,?)',[recoveryId,Date.now(),JSON.stringify({backupId:manifest.id,sourceDatabase:manifest.database,oldTrust:manifest.trustDigest,newTrust:options.newTrustDigest,authorizationCutoff:authority.latestValidUntil,reviewRequired:true})]);});
   const [binding]=await db.pool.query<any[]>("SELECT CONCAT(@@server_uuid,':',DATABASE()) binding");const credentials=resolve(directory,`${recoveryId}-credentials.json`);await durableFile(credentials,JSON.stringify({recoveryId,accounts,owners:accounts.filter(account=>account.owner)},null,2));
   // Independent state remains in maintenance until the operator reviews this recovery ID.
   await options.authority.rebind(binding[0].binding,options.newTrustDigest,recoveryId);return {recoveryId,databaseUrl,ownerCredentials:credentials};
  }finally{await db.close();}
 }finally{await admin.end();}
}
