import { createServer } from 'node:https';
import { readFile } from 'node:fs/promises';
import { getRequestListener } from '@hono/node-server';
import { MySqlUnitOfWork } from './infrastructure/mysql.ts';
import { NodeCertificateAuthority } from './infrastructure/pki.ts';
import { Identity } from './modules/identity.ts';
import { Nodes } from './modules/nodes.ts';
import { ControlApplication } from './application/control.ts';
import { RuntimeController } from './modules/runtime/controller.ts';
import { createApp } from './api/app.ts';
import { DEFAULT_POLICY } from '@tunex/contracts';
import type { Policy } from '@tunex/contracts';
import { AuthorityStore,trustDigest } from './infrastructure/authority.ts';

export interface ServerOptions { databaseUrl:string; caCert:string; caKey:string; serverCert:string; serverKey:string; openssl:string; stateDirectory:string; port:number; host?:string; worker?:boolean;credentialOverlapSeconds?:number;relayCredentialSeconds?:number;policy?:Policy;initializeAuthority?:boolean;multihopEnabled?:boolean;probeExecutionEnabled?:boolean }
export async function startControl(options:ServerOptions):Promise<{ port:number; db:MySqlUnitOfWork; control:ControlApplication; runtime:RuntimeController;authority:AuthorityStore; close:()=>Promise<void> }> {
  if(options.probeExecutionEnabled===true&&(options.policy??DEFAULT_POLICY).maxClockSkewSeconds!==1)throw new Error('Probe execution requires an explicitly configured one-second maximum clock skew');
  const policy=options.policy??DEFAULT_POLICY,lead=Math.max(60,policy.leaseSeconds+2*policy.maxClockSkewSeconds+2*policy.pollIntervalSeconds),lifetime=options.relayCredentialSeconds??86400;
  if(!Number.isInteger(lifetime)||lifetime<2*lead||lifetime>86400||(options.credentialOverlapSeconds??120)+1>=lifetime-lead)throw new Error('Relay credential lifetime must allow renewal before expiry and bounded overlap');
  const db=new MySqlUnitOfWork(options.databaseUrl); await db.migrate();
  const [obsolete]=await db.pool.query<any[]>("SELECT COUNT(*) n FROM snapshots WHERE JSON_EXTRACT(body,'$.protocolVersion') IS NULL OR JSON_EXTRACT(body,'$.protocolVersion')<>3");if(obsolete[0].n>0){await db.close();throw new Error('UNSUPPORTED_PROTOCOL_VERSION: ADP/2 persisted history is unsupported; use a fresh ADP/3 deployment without resetting old Node identities');}
  const [records]=await db.pool.query<any[]>("SELECT CONCAT(@@server_uuid,':',DATABASE()) name,(SELECT COUNT(*) FROM nodes) nodes");const authority=new AuthorityStore(options.stateDirectory);
  try{await authority.initialize(records[0].name,trustDigest(await readFile(options.caCert)),options.initializeAuthority===true&&records[0].nodes===0);}catch(error){await db.close();throw error;}db.guard=()=>authority.allow();
  const identity=new Identity(db), ca=new NodeCertificateAuthority(options.openssl,options.caCert,options.caKey,options.stateDirectory);
  const nodes=new Nodes(db,identity,ca,options.credentialOverlapSeconds??120,options.relayCredentialSeconds??86400), control=new ControlApplication(db,identity,nodes,options.policy,options.multihopEnabled===true,options.probeExecutionEnabled===true);
  const runtime=new RuntimeController(db,nodes,control.forwarding,control.ledger,options.policy,authority,control.relay), app=createApp(control,runtime,authority);
  const server=createServer({ key:await readFile(options.serverKey),cert:await readFile(options.serverCert),ca:await readFile(options.caCert),requestCert:true,rejectUnauthorized:false,minVersion:'TLSv1.3' },getRequestListener(app.fetch));
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(options.port,options.host??'127.0.0.1',resolve);});
  let busy=false, active:Promise<void>=Promise.resolve();
  const interval=options.worker===false?undefined:setInterval(()=>{ if(busy)return;busy=true;active=authority.read().then(record=>record.maintenance?undefined:runtime.tick()).catch(()=>{console.error('Runtime tick failed');}).finally(()=>{busy=false;}); },250);
  return { port:(server.address() as {port:number}).port,db,control,runtime,authority,close:async()=>{clearInterval(interval);await active;server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await db.close();} };
}
