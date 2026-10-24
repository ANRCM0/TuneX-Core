import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { execFile } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { request } from 'node:https';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createConnection } from 'mysql2/promise';
import { startControl } from '../../apps/control/src/server.ts';
import { newToken } from '../../apps/control/src/modules/identity.ts';
import { DEFAULT_POLICY } from '@tunex/contracts';
import { host, linuxPath, linux, spawnLinux, linuxBinary, topology, viaWSL } from './native-linux.ts';
import { NetworkLab } from './network-lab.ts';
import { verifyMultihopConsole } from './multihop-console.ts';
import { verifyControlledEcho } from './product-p-observation.ts';
import { verifyPathAlertOutbox } from './product-p-path-alert.ts';

const execute=promisify(execFile),databaseUrl=process.env.TUNEX_TEST_DATABASE_URL,openssl=process.env.TUNEX_OPENSSL??'openssl';
const count=Number(process.env.TUNEX_MULTIHOP_NODES??'3');
const browserConsole=process.env.TUNEX_MULTIHOP_BROWSER==='1';
if(browserConsole&&(process.platform!=='linux'||process.env.GITHUB_ACTIONS!=='true'||process.argv.includes('--isolated')))throw Error('Multi-hop browser acceptance requires non-isolated Linux Actions');
const lab=process.argv.includes('--isolated')?new NetworkLab(count):undefined;
const productP=process.env.TUNEX_PRODUCT_P_ACCEPTANCE==='1'&&!lab&&count===3;
if(!databaseUrl||![3,4,8].includes(count))throw Error('Disposable MySQL URL and TUNEX_MULTIHOP_NODES=3,4,8 required');
await mkdir('.artifacts/multihop',{recursive:true});const directory=await mkdtemp(resolve(`.artifacts/multihop/${count}-nodes-`));
const caKey=join(directory,'ca.key'),caCert=join(directory,'ca.pem'),serverKey=join(directory,'server.key'),serverCert=join(directory,'server.pem');
await execute(openssl,['req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',caKey,'-out',caCert,'-days','2','-subj','/CN=Multi-hop Acceptance CA']);
await execute(openssl,['req','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',serverKey,'-out',join(directory,'server.csr'),'-subj','/CN=localhost']);
await writeFile(join(directory,'server.ext'),`subjectAltName=IP:${host}\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n`);
await execute(openssl,['x509','-req','-in',join(directory,'server.csr'),'-CA',caCert,'-CAkey',caKey,'-set_serial','1','-out',serverCert,'-days','1','-extfile',join(directory,'server.ext')]);
const admin=await createConnection(databaseUrl),database=`tunex_multihop_${randomUUID().replaceAll('-','')}`;await admin.query(`CREATE DATABASE \`${database}\``);
const url=new URL(databaseUrl);url.pathname='/'+database;
const token=newToken(),scope='multihop-scope',owner='multihop-owner',ca=await readFile(caCert),checks:string[]=[],deploymentHistory:unknown[]=[];
const binary=linuxBinary('tunex-agent'),fixture=linuxBinary('network-fixture'),nativeRoot=`/tmp/tunex-multihop-${randomUUID()}`;
const policy={...DEFAULT_POLICY,maxClockSkewSeconds:productP?1:DEFAULT_POLICY.maxClockSkewSeconds,pollIntervalSeconds:1,leaseSeconds:45,renewalLeadSeconds:18,observationFreshnessSeconds:10,drainTimeoutSeconds:3,udpIdleTimeoutSeconds:2};
const options={databaseUrl:url.toString(),caCert,caKey,serverKey,serverCert,openssl,stateDirectory:join(directory,'control'),initializeAuthority:true,port:0,host,policy,multihopEnabled:true,
    probeExecutionEnabled:productP,probeIngressEnabled:productP,probeServicesEnabled:productP,probeEchoEnabled:productP,probePathEchoEnabled:productP};
let control:Awaited<ReturnType<typeof startControl>>|undefined,target:ChildProcess|undefined,targetPID:number|undefined,releaseReady:(()=>void)|undefined,proxy:ChildProcess|undefined,proxyPID:number|undefined,controlURL='';
const agents:{nodeId:string;root:string;args:string[];process:ChildProcess;errors:string;exitedAt?:string}[]=[];
let completedEvidence:Record<string,unknown>|undefined;
let consoleEvidence:unknown;
const echoTrace:Record<string,unknown>[]=[];
const appendEcho=(sample:Record<string,unknown>)=>{echoTrace.push(sample);if(echoTrace.length>100)echoTrace.shift();};
function pass(text:string){checks.push(text);console.log('PASS '+text);}
async function until(action:()=>Promise<boolean>,label:string,timeout=120000){const start=Date.now();while(Date.now()-start<timeout){if(await action())return;await new Promise(r=>setTimeout(r,150));}throw Error('Multi-hop acceptance timed out: '+label);}
async function call(method:string,path:string,input?:unknown,key:string=randomUUID()):Promise<{status:number;body:any}>{
  const body=input===undefined?undefined:JSON.stringify(input);return new Promise((resolve,reject)=>{
    const req=request({hostname:host,port:control!.port,path:`/api/v1/scopes/${scope}/`+path,method,ca,agent:false,timeout:15000,
      headers:{authorization:`Bearer ${token}`,'content-type':'application/json','idempotency-key':key,...(body!==undefined?{'content-length':String(Buffer.byteLength(body))}:{})}},res=>{const parts:Buffer[]=[];res.on('data',b=>parts.push(b));res.on('end',()=>{try{resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(parts).toString())});}catch(e){reject(e);}});});
    req.on('error',reject);req.on('timeout',()=>req.destroy(Error('Acceptance HTTP timeout')));req.end(body);
  });
}
async function port(){return JSON.parse((await linux(fixture,['--mode','port'])).stdout).port as number;}
async function probe(port:number){return JSON.parse((await (lab?lab.run(lab.namespaces[0]!,fixture,['--mode','probe','--port',String(port)]):linux(fixture,['--mode','probe','--port',String(port)]))).stdout);}
async function stopOwned(root:string){
  const index=agents.findIndex(a=>a.root===root),namespace=lab&&index>=0?lab.namespaces[index]:undefined;
  const run=(command:string,args:string[])=>namespace?lab!.run(namespace,command,args):linux(command,args);
  const found=await linux('/usr/bin/pgrep',['-f',root]).catch(()=>undefined);
  for(const pid of found?.stdout.trim().split('\n')??[]){if(!/^[1-9][0-9]*$/.test(pid))continue;const read=()=>linux('/bin/cat',[`/proc/${pid}/cmdline`]).catch(()=>undefined);const fields=(await read())?.stdout.split('\0');
    if(fields?.[0]===binary&&fields.includes(root+'/state')&&fields.includes(root+'/secrets/journal.key')){
      if(namespace)assert.equal((await run('stat',['-Lc','%i',`/proc/${pid}/ns/net`])).stdout.trim(),lab!.inodes.get(namespace));
      await run('/bin/kill',['-TERM',pid]);await until(async()=>!(await read())?.stdout.split('\0').includes(root+'/state'),'owned Agent exit',10000);
    }
  }
}
function observeAgent(agent:typeof agents[number]){
  const process=agent.process;delete agent.exitedAt;
  process.stderr!.on('data',b=>{agent.errors=(agent.errors+new Date().toISOString()+' '+b.toString()).slice(-16384);});
  process.once('exit',()=>{if(agent.process===process)agent.exitedAt=new Date().toISOString();});
}
function restart(agent:typeof agents[number]){const index=agents.indexOf(agent);agent.process=lab?lab.spawn(lab.namespaces[index]!,binary,agent.args):spawnLinux(binary,agent.args);observeAgent(agent);}
async function ready(process:ChildProcess):Promise<any>{return new Promise((resolve,reject)=>{let buffer='';const timer=setTimeout(()=>reject(Error('Fixture startup timeout')),10000);process.once('error',reject);process.stdout!.on('data',b=>{buffer+=b.toString();if(buffer.includes('\n')){clearTimeout(timer);try{resolve(JSON.parse(buffer.split('\n')[0]!));}catch(e){reject(e);}}});});}
async function diagnostics(){return Promise.all(agents.map(async(a,i)=>JSON.parse((await(lab?lab.run(lab.namespaces[i]!,'/bin/cat',[a.root+'/state/diagnostics/status.json']):linux('/bin/cat',[a.root+'/state/diagnostics/status.json']))).stdout)));}
async function replay(agent:typeof agents[number],report:any){
  const index=agents.indexOf(agent),read=(file:string)=>lab?lab.run(lab.namespaces[index]!,'/bin/cat',[file]):linux('/bin/cat',[file]);
  const cert=Buffer.from((await read(agent.root+'/state/node.pem')).stdout),key=Buffer.from((await read(agent.root+'/state/private.pem')).stdout);
  return new Promise<{status:number;body:any}>((resolve,reject)=>{const req=request({hostname:host,port:control!.port,path:'/agent/v3/report',method:'POST',cert,key,ca,agent:false,timeout:15000,headers:{'content-type':'application/json','x-tunex-session-epoch':String(report.sessionEpoch)}},res=>{const chunks:Buffer[]=[];res.on('data',b=>chunks.push(b));res.on('end',()=>{try{resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(chunks).toString())});}catch(e){reject(e);}});});req.on('error',reject);req.on('timeout',()=>req.destroy(Error('Replay timeout')));req.end(JSON.stringify(report));});
}
try{
  if(lab){await lab.open();await writeFile(join(directory,'server.ext'),`subjectAltName=IP:${host},IP:${lab.gateway}\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n`);await execute(openssl,['x509','-req','-in',join(directory,'server.csr'),'-CA',caCert,'-CAkey',caKey,'-set_serial','1','-out',serverCert,'-days','1','-extfile',join(directory,'server.ext')]);}
  const synchronization=JSON.parse((await linux(linuxBinary('time-proof'),['--check'])).stdout);assert.equal(synchronization.synchronized,true);
  control=await startControl(options);await control.control.identity.bootstrap(scope,owner,token);
  if(productP) {
    // Keep only public outcome metadata; never persist credential, nonce or service material.
    type SqlTiming={poolWaitMs:number;statements:number;sqlMs:number;slow:{table:string;operation:string;lock:string;durationMs:number}[]};
    const sqlContext=new AsyncLocalStorage<SqlTiming>(),instrumented=new WeakSet<object>();
    const pool=control.db.pool,connect=pool.getConnection.bind(pool);
    pool.getConnection=async()=>{
      const started=Date.now(),connection=await connect(),timing=sqlContext.getStore();
      if(timing)timing.poolWaitMs+=Date.now()-started;
      if(!instrumented.has(connection)){
        instrumented.add(connection);
        const methods=connection as unknown as Record<'query'|'execute'|'beginTransaction'|'commit'|'rollback',(...args:any[])=>Promise<any>>;
        for(const method of ['query','execute','beginTransaction','commit','rollback'] as const){
          const original=methods[method].bind(connection);
          methods[method]=async(...args:any[])=>{
            const timing=sqlContext.getStore();if(!timing)return original(...args);
            const started=Date.now();
            try{return await original(...args);}
            finally{
              const durationMs=Date.now()-started,sql=typeof args[0]==='string'?args[0]:'';
              timing.statements++;timing.sqlMs+=durationMs;
              timing.slow.push({table:/\b(probe_permit_budget|probe_permits|probe_instances|probe_type_qualifications|runtime_nodes|nodes|node_credentials|forwards|relay_deployments|scope_members|scopes|snapshots|port_slots)\b/.exec(sql)?.[1]??'other',
                operation:method==='beginTransaction'?'BEGIN':method==='commit'?'COMMIT':method==='rollback'?'ROLLBACK':
                  /^\s*(SELECT|INSERT|UPDATE|DELETE|SET)\b/i.exec(sql)?.[1]?.toUpperCase()??'other',
                lock:/FOR UPDATE/i.test(sql)?'exclusive':/FOR SHARE/i.test(sql)?'shared':'none',durationMs});
              timing.slow.sort((a,b)=>b.durationMs-a.durationMs);timing.slow.length=Math.min(5,timing.slow.length);
            }
          };
        }
      }
      return connection;
    };
    const registry=control.control.probeEchoRegistry,handle=registry.handle.bind(registry);
    registry.handle=async(...args)=>{try{const result=await handle(...args);appendEcho({stage:'qualification',node:args[0],action:result.action,qualified:result.qualified});return result;}
      catch(error){appendEcho({stage:'qualification',node:args[0],code:(error as {code?:string}).code??'error'});throw error;}};
    const echo=control.control.probeEcho;
    const trace=<T>(stage:string,invoke:(node:string,fingerprint:string,epoch:number,input:unknown)=>Promise<T>)=>async(...args:Parameters<typeof invoke>):Promise<T>=>{
      const started=Date.now(),sql:SqlTiming={poolWaitMs:0,statements:0,sqlMs:0,slow:[]};
      try{const result=await sqlContext.run(sql,()=>invoke(...args)),durationMs=Date.now()-started;
        const offer=stage==='poll'?(result as {offer:{issuedAt:string;expiresAt:string}|null}).offer:null;
        if(stage!=='poll'||offer||durationMs>=200)appendEcho({stage,node:args[0],outcome:'accepted',durationMs,sql,
          ...(offer?{ageMs:Date.now()-Date.parse(offer.issuedAt),remainingMs:Date.parse(offer.expiresAt)-Date.now(),lifetimeMs:Date.parse(offer.expiresAt)-Date.parse(offer.issuedAt)}:{})});return result;}
      catch(error){appendEcho({stage,node:args[0],code:(error as {code?:string}).code??'error',durationMs:Date.now()-started,sql});throw error;}
    };
    echo.poll=trace('poll',echo.poll.bind(echo));echo.claim=trace('claim',echo.claim.bind(echo));
    echo.status=trace('status',echo.status.bind(echo));echo.result=trace('result',echo.result.bind(echo));
  }
  controlURL=`https://${host}:${control.port}`;
  if(lab){proxy=spawnLinux(fixture,['--mode','tcp-proxy','--host',lab.gateway,'--upstream-host',host,'--upstream-port',String(control.port),'--run-id',nativeRoot+'/proxy']);const status=await ready(proxy);proxyPID=status.pid;controlURL=`https://${lab.gateway}:${status.port}`;}
  const targetArgs=['--mode','target','--run-id',nativeRoot,'--target-connection-seconds','120'];
  target=lab?lab.spawn(lab.namespaces.at(-1)!,fixture,targetArgs):spawnLinux(fixture,targetArgs);
  const targetStatus=await ready(target);targetPID=targetStatus.pid;assert.equal(targetStatus.platform,'linux');
  const usedPorts=new Set<number>([targetStatus.port]);
  async function distinctPort(){for(let attempt=0;attempt<128;attempt++){const next=await port();if(!usedPorts.has(next)){usedPorts.add(next);return next;}}throw Error('Distinct fixture port selection exhausted');}
  const listenPort=await distinctPort(),copyPort=browserConsole?await distinctPort():undefined,batchPort=browserConsole?await distinctPort():undefined;
  const echoPort=productP?await distinctPort():undefined;
  const profile={driver:'native.relay.v1',wireVersion:1,security:'mutual-tls13',protocols:['tcp','udp'],handshakeTimeoutSeconds:5,idleTimeoutSeconds:5,maxFrameBytes:65536,maxUdpDatagramBytes:16384,maxConnectionsPerNode:128};
  assert.equal((await call('PUT','transport-profiles/multihop-profile',{expectedRevision:0,config:profile})).status,202);
  for(let i=0;i<count;i++){
    const node=await call('POST','shared-nodes',{allowedListenerAddresses:['127.0.0.1'],allowedPorts:[...(i===0&&copyPort!==undefined?[listenPort,copyPort,batchPort!]:[listenPort]),...(echoPort===undefined?[]:[echoPort])],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8',...(lab?[lab.subnet]:[])],allowMetadataTargets:false});assert.equal(node.status,201);
    const useGrant=await call('PUT',`nodes/${node.body.nodeId}/grants/${owner}`,{expectedRevision:1,allowed:true,allowedRoles:['ingress','transit','egress']});assert.equal(useGrant.status,202);assert.equal(useGrant.body.revision,2);
    const root=nativeRoot+'/node-'+i;const args:string[]=['--control',controlURL,'--node',node.body.nodeId,'--ca',linuxPath(caCert),'--state',root+'/state','--journal-key',root+'/secrets/journal.key','--relay','--multihop','--diagnostics'];
    if(productP)args.push('--probe-registration','--probe-execution','--probe-ingress','--probe-services','--probe-echo','--probe-path-echo');
    try{const enroll=[`TUNEX_ENROLLMENT_TOKEN=${node.body.enrollmentToken}`,binary,...args,'--enroll'];if(lab)await lab.run(lab.namespaces[i]!,'/usr/bin/env',enroll);else await linux('env',enroll);}catch{throw Error('Multi-hop enrollment failed; token redacted');}
    const process=lab?lab.spawn(lab.namespaces[i]!,binary,args):spawnLinux(binary,args);const entry:typeof agents[number]={nodeId:node.body.nodeId,root,args,process,errors:''};observeAgent(entry);agents.push(entry);
    await until(async()=>{const [r]=await control!.db.pool.query<any[]>('SELECT session_epoch,(SELECT COUNT(*) FROM node_relay_credentials WHERE node_id=? AND revoked=FALSE) peers FROM runtime_nodes WHERE node_id=?',[entry.nodeId,entry.nodeId]);return r[0]?.session_epoch>0&&r[0]?.peers>0;},'current Node session and peer credential');
    if(i>0){
      // The port fixture closes its temporary listener; the OS may return the same
      // ephemeral port again, including for this endpoint's second TCP resource.
      const peerPorts:number[]=[];for(let n=0;n<(browserConsole?6:2);n++)peerPorts.push(await distinctPort());
      const config={listenAddress:lab?lab.address(i):'127.0.0.1',advertisedHost:lab?lab.address(i):'127.0.0.1',allowedTcpPorts:peerPorts};
      const endpoint=await call('PUT',`nodes/${entry.nodeId}/relay-endpoint`,{expectedRevision:0,config});
      assert.equal(endpoint.status,202,JSON.stringify({nodeId:entry.nodeId,config,response:endpoint.body}));
    }
  }
  pass(`${count} independent Agent processes advertise the explicit execution extension`);
  const ingress=agents[0]!,spec={enabled:true,protocols:['tcp','udp'],ingress:{nodeId:ingress.nodeId,listen:{address:'127.0.0.1',port:listenPort}},target:{host:'127.0.0.1',port:targetStatus.port},path:{via:agents.slice(1).map(a=>a.nodeId)},transport:{profileId:'multihop-profile',configRevision:1}};
  const originalReport=control.runtime.report.bind(control.runtime);let held=false;
  const gate=new Promise<void>(r=>{releaseReady=r;});
  control.runtime.report=async(node,epoch,report,fingerprint)=>{if(node===agents.at(-1)!.nodeId&&report.observations.some(o=>o.phase==='active'&&o.condition==='ready')){held=true;await gate;}return originalReport(node,epoch,report,fingerprint);};
  const key=randomUUID(),created=await call('POST','forwards',spec,key);assert.equal(created.status,202,JSON.stringify(created.body));assert.deepEqual(await call('POST','forwards',spec,key),created);
  const id=created.body.forwardId,resource='forwards/'+id;let desiredRevision=1;
  const conflict=await call('POST','forwards',spec);assert.equal(conflict.status,409);
  await until(async()=>held,'held egress execution report');
  assert.equal((await call('GET',resource+'/deployment')).body.deployment.activatedCount,1);
  await assert.rejects(()=>probe(listenPort));releaseReady!();releaseReady=undefined;
  pass('Unacknowledged active egress keeps every upstream activation and the ingress listener closed');
  async function converge(){await until(async()=>{const r=await call('GET',resource);return r.body.health.condition==='ready'&&r.body.lastOperation.status==='succeeded';},'real multi-node reports and old-lease retirement');}
  await converge();const initial=(await call('GET',resource+'/deployment')).body.deployment;deploymentHistory.push(initial);
  assert.equal(initial.nodes.length,count);assert.equal(initial.activatedCount,count);assert.ok(initial.nodes.every((n:any)=>n.ready));
  const traffic=await probe(listenPort);assert.equal(traffic.tcp,true);assert.equal(traffic.udp,true);
  const [slots]=await control.db.pool.query<any[]>('SELECT node_id,protocol,port,fence FROM port_slots WHERE owner_id=?',[id]);assert.equal(slots.length,2*count);
  pass('Exact bidirectional TCP and UDP data crosses the fully activated path with two exclusive resources per Node');
  if(productP)for(const check of await verifyControlledEcho({scopeId:scope,nodeId:ingress.nodeId,mode:'multihop',directory,listenPort:echoPort!,spec,call,diagnostics:()=>echoTrace.slice(-100),discovery:control.control.probeEcho,
      responseDelayMs:15,pathAlerts:forward=>verifyPathAlertOutbox({db:control!.db,auth:control!.control.identity,samples:control!.control.probePathObservations,actor:owner,scope,forward,directory}),
      qualified:async()=>{const [result]=await control!.db.pool.query<any[]>("SELECT COUNT(*) n FROM probe_type_qualifications q JOIN runtime_nodes r ON r.node_id=q.node_id AND r.session_epoch=q.session_epoch WHERE q.node_id=? AND q.state='qualified' AND q.echo_version=1 AND q.expires_at>?",[ingress.nodeId,Date.now()+2000]);return result[0].n===1;}
  }))pass('P multihop '+check);
  const [generation]=await control.db.pool.query<any[]>('SELECT node_id,snapshot_generation FROM runtime_nodes');
  await until(async()=>{const [r]=await control!.db.pool.query<any[]>('SELECT node_id,snapshot_generation FROM runtime_nodes');return r.every(n=>n.snapshot_generation>generation.find(p=>p.node_id===n.node_id).snapshot_generation);},'whole-Node lease renewal');
  assert.equal((await call('GET',resource+'/deployment')).body.deployment.generation,initial.generation);assert.equal((await probe(listenPort)).udp,true);
  pass('Whole-Node renewal preserves deployment generation and verified flow');
  const baseline=await diagnostics(),loadArgs=['--mode','load','--port',String(listenPort),'--tcp-clients','2','--udp-clients','2','--seconds','35','--payload-bytes','1200','--interval-ms','20'];
  const sustained=JSON.parse((await(lab?lab.run(lab.namespaces[0]!,fixture,loadArgs):linux(fixture,loadArgs))).stdout);assert.equal(sustained.completed,true);assert.equal(sustained.errors,0);assert.ok(sustained.clients.every((c:any)=>c.verified>10));
  const samples=await diagnostics();assert.ok(samples.every(s=>s.openFileDescriptors<256&&s.goroutines<1024));
  pass('Held TCP and isolated UDP clients survive renewal with bounded FD/goroutine measurements');
  const savedPort=control.port;await control.close();control=await startControl({...options,port:savedPort,initializeAuthority:false});await converge();assert.equal((await probe(listenPort)).tcp,true);
  pass('Control restart resumes durable deployment stages and real Agent reports');
  if(lab){
    const [resources]=await control.db.pool.query<any[]>("SELECT port FROM port_slots WHERE owner_id=? AND node_id=? AND protocol='tcp'",[id,agents[2]!.nodeId]);
    const ports=resources.map(r=>r.port);await lab.cutEdge(1,2,ports,true);await assert.rejects(()=>probe(listenPort));
    await until(async()=>(await call('GET',resource)).body.health.condition!=='ready','actual adjacent network partition');
    await lab.cutEdge(1,2,ports,false);await converge();assert.equal((await probe(listenPort)).tcp,true);
    await lab.shape(1,40,1);assert.equal((await probe(listenPort)).udp,true);await lab.shape(1,0,0);
    pass('Independent network namespaces exercise an interior packet partition, recovery, delay and loss');
  }
  for(const middle of agents.slice(1,-1)){
    const before=(await call('GET',resource+'/deployment')).body.deployment;
    await stopOwned(middle.root);middle.process.kill();await assert.rejects(()=>probe(listenPort));
    await until(async()=>(await call('GET',resource)).body.health.condition!=='ready','intermediate loss becomes degraded');
    restart(middle);await converge();const after=(await call('GET',resource+'/deployment')).body.deployment;assert.ok(after.generation>before.generation);assert.equal((await probe(listenPort)).udp,true);deploymentHistory.push(after);
  }
  pass('Removing each consecutive intermediate breaks data flow; restart obtains a fresh session, deployment and Fence');
  const [prior]=await control.db.pool.query<any[]>('SELECT last_report FROM runtime_nodes WHERE node_id=?',[agents[1]!.nodeId]);
  const report=typeof prior[0].last_report==='string'?JSON.parse(prior[0].last_report):prior[0].last_report;
  let preparedHeld=false;const preparedGate=new Promise<void>(r=>{releaseReady=r;}),reportHandler=control.runtime.report.bind(control.runtime);
  control.runtime.report=async(node,epoch,value,fingerprint)=>{if(node===agents[1]!.nodeId&&value.observations.some(o=>o.phase==='prepared'&&o.condition==='prepared')){preparedHeld=true;await preparedGate;}return reportHandler(node,epoch,value,fingerprint);};
  const updated=await call('PUT',resource,{expectedRevision:desiredRevision,spec:{...spec,target:{...spec.target,host:'localhost'}}});assert.equal(updated.status,202);desiredRevision=updated.body.revision;
  await until(async()=>preparedHeld,'held successor Prepared report');const beforeReplay=(await call('GET',resource+'/deployment')).body.deployment;
  const duplicate=await replay(agents[1]!,report);assert.equal(duplicate.status,200);assert.equal(duplicate.body.status,'duplicate');
  const afterReplay=(await call('GET',resource+'/deployment')).body.deployment;assert.equal(afterReplay.stage,'preparing');assert.equal(afterReplay.preparedCount,beforeReplay.preparedCount);assert.equal(afterReplay.activatedCount,0);
  releaseReady!();releaseReady=undefined;control.runtime.report=reportHandler;await converge();assert.equal((await probe(listenPort)).tcp,true);
  pass('Authentic prior-generation Report replay receives duplicate ACK without advancing the held successor');
  const grantPath=`nodes/${agents[1]!.nodeId}/grants/${owner}`,withdrawn=await call('PUT',grantPath,{expectedRevision:2,allowed:false});assert.equal(withdrawn.status,202);
  await until(async()=>(await call('GET','operations/'+withdrawn.body.operationIds[0])).body.status==='succeeded','middle authority withdrawal');await assert.rejects(()=>probe(listenPort));
  const restored=await call('PUT',grantPath,{expectedRevision:3,allowed:true,allowedRoles:['ingress','transit','egress']});assert.equal(restored.status,202);await converge();assert.equal((await probe(listenPort)).tcp,true);
  pass('Intermediate grant withdrawal revokes the whole path and restoration requires fresh execution authority');
  if(browserConsole){
    const current=await call('GET',resource);assert.equal(current.status,200);assert.equal(current.body.desired.revision,desiredRevision);
    consoleEvidence=await verifyMultihopConsole({url:`https://${host}:${control.port}`,scope,token,directory,sourceId:id,revision:desiredRevision,spec:current.body.desired.spec,profile:profile as import('@tunex/contracts').RelayProfileConfig,copyPort:copyPort!,batchPort:batchPort!,
      traffic:async listen=>{const actual=await probe(listen);assert.equal(actual.tcp,true);assert.equal(actual.udp,true);},
      closed:async listen=>{for(const flag of ['--tcp-only','--udp-only'])await assert.rejects(()=>linux(fixture,['--mode','probe','--port',String(listen),flag]),/connection refused|i\/o timeout/);},
      operationProgress:async operationId=>{
        const [rows]=await control!.db.pool.query<any[]>('SELECT o.forward_id,o.target_revision,o.execution_deadline,d.generation,d.stage,d.prepared_count,d.activated_count FROM operations o JOIN relay_deployments d ON d.forward_id=o.forward_id AND d.generation=(SELECT MAX(recent.generation) FROM relay_deployments recent WHERE recent.forward_id=o.forward_id) WHERE o.id=?',[operationId]);
        assert.equal(rows.length,1);const row=rows[0];
        return {forwardId:row.forward_id,revision:row.target_revision,executionDeadline:row.execution_deadline,
          generation:row.generation,stage:row.stage,prepared:row.prepared_count,activated:row.activated_count};
      },
      slots:async(owner,retained,businessPort=copyPort)=>{
        const [rows]=await control!.db.pool.query<any[]>('SELECT node_id,protocol,port,fence FROM port_slots WHERE owner_id=? ORDER BY node_id,protocol,port',[owner]);
        assert.equal(rows.length,retained?2*count:0);if(!retained)return;
        for(const [index,agent] of agents.entries()){
          const local=rows.filter(row=>row.node_id===agent.nodeId);assert.equal(local.length,2);assert.ok(local.every(row=>Number.isSafeInteger(row.fence)&&row.fence>0));
          if(index===0){assert.deepEqual(local.map(row=>row.protocol),['tcp','udp']);assert.ok(local.every(row=>row.port===businessPort));}
          else{assert.ok(local.every(row=>row.protocol==='tcp'));assert.notEqual(local[0].port,local[1].port);}
        }
      },
      onlySourceReservations:async()=>{const [rows]=await control!.db.pool.query<any[]>('SELECT owner_id FROM port_slots WHERE owner_id IS NOT NULL');assert.equal(rows.length,2*count);assert.ok(rows.every(row=>row.owner_id===id));}
    });
    await converge();pass('Real Chromium ordered multi-hop copy retains locked Profile, requires fresh preview, explicitly enables/disables/deletes and verifies TCP/UDP plus safe reservations');
  }
  await stopOwned(agents.at(-1)!.root);agents.at(-1)!.process.kill();
  const deleted=await call('DELETE',resource,{expectedRevision:desiredRevision});assert.equal(deleted.status,202);
  await until(async()=>(await call('GET','operations/'+deleted.body.operationId)).body.status==='succeeded','offline Node lease cutoff and reclamation');
  const [remaining]=await control.db.pool.query<any[]>('SELECT COUNT(*) n FROM port_slots WHERE owner_id=?',[id]);assert.equal(remaining[0].n,0);
  pass('Deletion retains isolation through offline-node lease expiry before releasing all physical resources');
  const commit=(await execute('git',['rev-parse','HEAD'])).stdout.trim(),diff=(await execute('git',['diff','--binary','HEAD'],{maxBuffer:32*1024*1024})).stdout;
  completedEvidence={passed:true,cleanupVerified:false,commit,workingTreeDirty:Boolean((await execute('git',['status','--porcelain'])).stdout.trim()),trackedPatchSHA256:createHash('sha256').update(diff).digest('hex'),completedAt:new Date().toISOString(),checks,count,policy,synchronization,topology:`${topology}; ${lab?'independent network namespaces':'independent processes'} on the same Linux host`,physicalHosts:false,isolated:!!lab,traffic,baseline,samples,sustained,
    agentSHA256:createHash('sha256').update(await readFile(viaWSL?'.artifacts/tunex-agent-linux':binary)).digest('hex'),fixtureSHA256:createHash('sha256').update(await readFile(viaWSL?'.artifacts/network-fixture-linux':fixture)).digest('hex'),deploymentHistory,console:consoleEvidence??null};
  await writeFile(join(directory,'evidence.json'),JSON.stringify(completedEvidence,null,2));
  console.log('Multi-hop acceptance evidence: '+directory);
}catch(error){
  if(control){
    const [operations]=await control.db.pool.query('SELECT id,forward_id,target_revision,status,cleanup_pending,last_error,created_at,updated_at,execution_deadline,claim_until FROM operations');
    const [runtime]=await control.db.pool.query('SELECT node_id,session_epoch,snapshot_generation,last_report FROM runtime_nodes');
    // Keep only timing and instance identifiers, never wire bodies, credentials,
    // driver configuration or key material, in uploaded failure evidence.
    const readBody=(body:any)=>typeof body==='string'?JSON.parse(body):body;
    const [storedSnapshots]=await control.db.pool.query<any[]>('SELECT s.node_id,s.generation,s.session_epoch,s.body FROM snapshots s JOIN runtime_nodes n ON n.node_id=s.node_id WHERE s.generation>=GREATEST(CAST(n.snapshot_generation AS SIGNED)-7,0) ORDER BY s.node_id,s.generation');
    const snapshots=storedSnapshots.map(row=>{const body=readBody(row.body);return {nodeId:row.node_id,generation:row.generation,sessionEpoch:row.session_epoch,
      issuedAt:body.issuedAt,validUntil:body.validUntil,assignments:body.assignments.map((assignment:any)=>({forwardId:assignment.forwardId,
        assignmentId:assignment.assignmentId,deploymentGeneration:assignment.deploymentGeneration,bindingFence:assignment.bindingFence,phase:assignment.phase,role:assignment.role,protocol:assignment.protocol}))};});
    const [storedDeployments]=await control.db.pool.query<any[]>('SELECT forward_id,generation,stage,prepared_count,activated_count,updated_at,body FROM relay_deployments ORDER BY forward_id,generation');
    const deployments=storedDeployments.map(row=>{const body=readBody(row.body);return {forwardId:row.forward_id,generation:row.generation,stage:row.stage,
      preparedCount:row.prepared_count,activatedCount:row.activated_count,updatedAt:row.updated_at,
      authorizationUntil:body.authorizationUntil,nodes:body.nodes.map((node:any)=>({nodeId:node.nodeId,sessionEpoch:node.sessionEpoch}))};});
    const measurements=await diagnostics().catch(()=>undefined);
    await writeFile(join(directory,'failure.json'),JSON.stringify({passed:false,capturedAt:new Date().toISOString(),policy,
      error:error instanceof Error?error.message:'Multi-hop acceptance failed',checks,operations,runtime,snapshots,deployments,measurements,echoTrace:echoTrace.slice(-100),
      agents:agents.map(a=>({nodeId:a.nodeId,errors:a.errors,exitCode:a.process.exitCode,exitedAt:a.exitedAt??null}))},null,2));
  }
  throw error;
}finally{
  const cleanupErrors:unknown[]=[],collect=async(action:()=>Promise<unknown>)=>{try{await action();}catch(error){cleanupErrors.push(error);}};
  releaseReady?.();for(const agent of agents){await collect(()=>stopOwned(agent.root));agent.process.kill();}
  if(targetPID)await collect(async()=>{const fields=(await linux('/bin/cat',[`/proc/${targetPID}/cmdline`]).catch(()=>undefined))?.stdout.split('\0');if(fields?.[0]===fixture&&fields.includes(nativeRoot)){if(lab)await lab.run(lab.namespaces.at(-1)!,'/bin/kill',['-TERM',String(targetPID)]);else await linux('/bin/kill',['-TERM',String(targetPID)]);}});
  target?.kill();await collect(async()=>control?.close());await collect(()=>admin.query(`DROP DATABASE \`${database}\``));await collect(()=>admin.end());
  if(proxyPID)await collect(async()=>{const fields=(await linux('/bin/cat',[`/proc/${proxyPID}/cmdline`]).catch(()=>undefined))?.stdout.split('\0');if(fields?.[0]===fixture&&fields.includes(nativeRoot+'/proxy'))await linux('/bin/kill',['-TERM',String(proxyPID)]);});
  proxy?.kill();if(lab){await collect(()=>lab.close());await collect(()=>lab.verifyClosed());}
  if(completedEvidence){completedEvidence.cleanupVerified=cleanupErrors.length===0;completedEvidence.passed=cleanupErrors.length===0;await writeFile(join(directory,'evidence.json'),JSON.stringify(completedEvidence,null,2));}
  if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Acceptance resource cleanup failed');
}
