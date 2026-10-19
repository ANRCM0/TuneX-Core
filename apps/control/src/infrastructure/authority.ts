import { createHmac,randomBytes,createHash,X509Certificate,timingSafeEqual } from 'node:crypto';
import { mkdir,readFile,open,rename,unlink,stat } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { parseJson, digest } from '@tunex/contracts/shared';
import { MAX_COUNTER,isId } from '@tunex/core';
import { ControlError } from '../framework/public.ts';

export interface AuthorityRecord {
 version:1;sequence:number;database:string;trustDigest:string;maintenance:boolean;
 latestValidUntil:number|null;maxLeaseSeconds:number;maxClockSkewSeconds:number;
 maintenanceSince:number|null;recoveryId:string|null;
}
interface Envelope {payload:AuthorityRecord;mac:string}
export function trustDigest(certificate:Buffer|string):string{return `sha256:${createHash('sha256').update(new X509Certificate(certificate).raw).digest('hex')}`;}
export class AuthorityStore {
 readonly path:string;readonly keyPath:string;private key:Buffer|undefined;
 constructor(directory:string){const root=resolve(directory);this.path=resolve(root,'authority','state.json');this.keyPath=resolve(root,'authority-secrets','key');}
 private async secret():Promise<Buffer>{if(!this.key){const key=await readFile(this.keyPath);if(key.length!==32)throw new Error('Invalid protected authority key');this.key=key;}return this.key;}
 private async signature(payload:unknown):Promise<string>{return createHmac('sha256',await this.secret()).update(digest(payload)).digest('hex');}
 async signArtifact(payload:unknown):Promise<string>{return this.signature(payload);}
 async verifyArtifact(payload:unknown,mac:string):Promise<void>{const expected=await this.signature(payload);if(typeof mac!=='string'||!/^[0-9a-f]{64}$/.test(mac)||!timingSafeEqual(Buffer.from(mac,'hex'),Buffer.from(expected,'hex')))throw new Error('Authority artifact integrity failure');}
 async initialize(database:string,ca:string,allowed:boolean):Promise<void>{
  await mkdir(dirname(this.path),{recursive:true,mode:0o700});await mkdir(dirname(this.keyPath),{recursive:true,mode:0o700});
  try{const current=await this.read();if(current.database!==database||current.trustDigest!==ca)throw new Error('Authority binding differs; offline recovery approval required');return;}
  catch(error){if((error as {code?:string}).code!=='ENOENT')throw error;}
  const exists=async(path:string)=>stat(path).then(()=>true).catch(error=>{if((error as {code?:string}).code==='ENOENT')return false;throw error;});
  if(await exists(this.path)||await exists(this.keyPath))throw new Error('Partial protected authority state cannot be initialized from zero');
  if(!allowed)throw new Error('Protected authority state missing; explicit fresh deployment initialization required');
  const key=await open(this.keyPath,'wx',0o600);try{const bytes=randomBytes(32);await key.writeFile(bytes);await key.sync();this.key=bytes;}finally{await key.close();}
  await this.atomic({version:1,sequence:1,database,trustDigest:ca,maintenance:false,latestValidUntil:null,maxLeaseSeconds:0,maxClockSkewSeconds:0,maintenanceSince:null,recoveryId:null});
 }
 async read():Promise<AuthorityRecord>{
  const raw=await readFile(this.path,'utf8');const value=parseJson(raw,16384) as Envelope;
  if(!value||Object.keys(value).sort().join(',')!=='mac,payload'||!value.payload||Object.keys(value.payload).sort().join(',')!=='database,latestValidUntil,maintenance,maintenanceSince,maxClockSkewSeconds,maxLeaseSeconds,recoveryId,sequence,trustDigest,version')throw new Error('Invalid protected authority envelope');
  await this.verifyArtifact(value.payload,value.mac);const record=value.payload;
  if(record.version!==1||!Number.isSafeInteger(record.sequence)||record.sequence<1||record.sequence>MAX_COUNTER||typeof record.database!=='string'||record.database.length>128||typeof record.maintenance!=='boolean'||!/^sha256:[0-9a-f]{64}$/.test(record.trustDigest)||!Number.isSafeInteger(record.maxLeaseSeconds)||record.maxLeaseSeconds<0||record.maxLeaseSeconds>300||!Number.isSafeInteger(record.maxClockSkewSeconds)||record.maxClockSkewSeconds<0||record.maxClockSkewSeconds>5||[record.latestValidUntil,record.maintenanceSince].some(n=>n!==null&&(!Number.isSafeInteger(n)||n<0))||record.recoveryId!==null&&!isId(record.recoveryId))throw new Error('Invalid protected authority state');return record;
 }
 async allow():Promise<void>{if((await this.read()).maintenance)throw new ControlError('MAINTENANCE',503,'Control is in maintenance mode',true);}
 private async atomic(payload:AuthorityRecord):Promise<void>{
  const temporary=`${this.path}.${randomBytes(12).toString('hex')}.tmp`;const file=await open(temporary,'wx',0o600);
  try{await file.writeFile(JSON.stringify({payload,mac:await this.signature(payload)}));await file.sync();}catch(error){await file.close();await unlink(temporary).catch(()=>{});throw error;}await file.close();
  try{await rename(temporary,this.path);if(process.platform!=='win32'){const directory=await open(dirname(this.path),'r');try{await directory.sync();}finally{await directory.close();}}}finally{await unlink(temporary).catch(()=>{});}
 }
 private async mutate(change:(record:AuthorityRecord)=>AuthorityRecord|Promise<AuthorityRecord>):Promise<AuthorityRecord>{
  const lockPath=`${this.path}.lock`;let lock:Awaited<ReturnType<typeof open>>|undefined;const start=Date.now();
  while(!lock){try{lock=await open(lockPath,'wx',0o600);}catch(error){if((error as {code?:string}).code!=='EEXIST'||Date.now()-start>5000)throw error;await new Promise(resolve=>setTimeout(resolve,25));}}
  try{await lock.writeFile(JSON.stringify({pid:process.pid,createdAt:Date.now()}));await lock.sync();const current=await this.read();if(current.sequence>=MAX_COUNTER)throw new Error('Authority sequence exhausted');const next={...await change(current),sequence:current.sequence+1};await this.atomic(next);return next;}
  finally{await lock.close();await unlink(lockPath);}
 }
 async issue(validUntil:number,leaseSeconds:number,skewSeconds:number):Promise<void>{if(!Number.isSafeInteger(validUntil)||validUntil<=Date.now()||!Number.isInteger(leaseSeconds)||leaseSeconds<1||leaseSeconds>300||!Number.isInteger(skewSeconds)||skewSeconds<1||skewSeconds>5||validUntil>Date.now()+leaseSeconds*1000)throw new Error('Invalid authority publication bound');await this.mutate(record=>{if(record.maintenance)throw new ControlError('MAINTENANCE',503,'New execution authority is disabled',true);return {...record,latestValidUntil:Math.max(record.latestValidUntil??0,validUntil),maxLeaseSeconds:Math.max(record.maxLeaseSeconds,leaseSeconds),maxClockSkewSeconds:Math.max(record.maxClockSkewSeconds,skewSeconds)};});}
 async maintain():Promise<AuthorityRecord>{return this.mutate(record=>({...record,maintenance:true,maintenanceSince:record.maintenanceSince??Date.now()}));}
 async rebind(database:string,ca:string,recoveryId:string):Promise<AuthorityRecord>{if(database.length>128||!/^sha256:[0-9a-f]{64}$/.test(ca)||!isId(recoveryId))throw new Error('Valid recovery database, trust and review ID required');return this.mutate(record=>{if(!record.maintenance)throw new Error('Offline recovery requires maintenance');if(record.latestValidUntil!==null&&Date.now()<record.latestValidUntil+record.maxClockSkewSeconds*1000)throw new Error('Historical authorization has not expired');if(record.trustDigest===ca)throw new Error('Recovery requires new Node trust material');return {...record,database,trustDigest:ca,recoveryId};});}
 async resume(reviewedRecoveryId?:string):Promise<AuthorityRecord>{return this.mutate(record=>{if(record.recoveryId&&reviewedRecoveryId!==record.recoveryId)throw new Error('Recovered intents require explicit review acknowledgment');return {...record,maintenance:false,maintenanceSince:null};});}
}
