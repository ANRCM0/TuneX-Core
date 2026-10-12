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
import type { Policy } from '@tunex/contracts';

export interface ServerOptions { databaseUrl:string; caCert:string; caKey:string; serverCert:string; serverKey:string; openssl:string; stateDirectory:string; port:number; host?:string; worker?:boolean;credentialOverlapSeconds?:number;policy?:Policy }
export async function startControl(options:ServerOptions):Promise<{ port:number; db:MySqlUnitOfWork; control:ControlApplication; runtime:RuntimeController; close:()=>Promise<void> }> {
  const db=new MySqlUnitOfWork(options.databaseUrl); await db.migrate();
  const identity=new Identity(db), ca=new NodeCertificateAuthority(options.openssl,options.caCert,options.caKey,options.stateDirectory);
  const nodes=new Nodes(db,identity,ca,options.credentialOverlapSeconds??120), control=new ControlApplication(db,identity,nodes,options.policy);
  const runtime=new RuntimeController(db,nodes,control.forwarding,control.ledger,options.policy), app=createApp(control,runtime);
  const server=createServer({ key:await readFile(options.serverKey),cert:await readFile(options.serverCert),ca:await readFile(options.caCert),requestCert:true,rejectUnauthorized:false,minVersion:'TLSv1.3' },getRequestListener(app.fetch));
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(options.port,options.host??'127.0.0.1',resolve);});
  let busy=false, active:Promise<void>=Promise.resolve();
  const interval=options.worker===false?undefined:setInterval(()=>{ if(busy)return;busy=true;active=runtime.tick().catch(()=>{console.error('Runtime tick failed');}).finally(()=>{busy=false;}); },250);
  return { port:(server.address() as {port:number}).port,db,control,runtime,close:async()=>{clearInterval(interval);await active;server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await db.close();} };
}
