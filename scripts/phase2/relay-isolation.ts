import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { request } from 'node:https';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createConnection } from 'mysql2/promise';
import { DEFAULT_POLICY } from '@tunex/contracts';
import type { RuntimeMessages } from '@tunex/contracts';
import { startControl } from '../../apps/control/src/server.ts';
import { newToken } from '../../apps/control/src/modules/identity.ts';
import { host, linux, linuxPath, linuxBinary, spawnLinux, viaWSL } from './native-linux.ts';
import { NetworkLab } from './network-lab.ts';

type Report=RuntimeMessages['ReportRequest'];
interface OwnedProcess {process:ChildProcess;pid:number;binary:string;identity:string;namespace?:string;errors:string}
interface Agent extends OwnedProcess {nodeId:string;root:string;args:string[];namespace:string}
const execute=promisify(execFile),databaseUrl=process.env.TUNEX_TEST_DATABASE_URL,openssl=process.env.TUNEX_OPENSSL??'openssl';
if(!databaseUrl)throw new Error('Disposable MySQL URL required');
await mkdir('.artifacts/relay-isolation',{recursive:true});const directory=await mkdtemp(resolve('.artifacts/relay-isolation/run-'));
const lab=new NetworkLab(),processes:OwnedProcess[]=[],agents:Agent[]=[],checks:string[]=[],details:unknown[]=[];
const caKey=join(directory,'ca.key'),caCert=join(directory,'ca.pem'),serverKey=join(directory,'server.key'),serverCert=join(directory,'server.pem');
const binary=linuxBinary('tunex-agent'),fixture=linuxBinary('network-fixture'),collector=linuxBinary('time-proof');
const nativeRoot=`/tmp/${lab.identity}`,scope='isolation-scope',owner='isolation-owner',token=newToken();
const policy={...DEFAULT_POLICY,pollIntervalSeconds:1,leaseSeconds:30,renewalLeadSeconds:12,observationFreshnessSeconds:5,drainTimeoutSeconds:2,udpIdleTimeoutSeconds:2};
let evidence:Record<string,unknown>|undefined;
let control:Awaited<ReturnType<typeof startControl>>|undefined,admin:Awaited<ReturnType<typeof createConnection>>|undefined;
const database=`tunex_isolation_${randomUUID().replaceAll('-','')}`;
const gates:{nodeId:string;match:(report:Report)=>boolean;report:Report|undefined;opened:boolean;wait:Promise<void>;release:()=>void}[]=[];
function gate(nodeId:string,match:(report:Report)=>boolean){let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve;});const entry={nodeId,match,report:undefined as Report|undefined,opened:false,wait,release:()=>{entry.opened=true;release();}};gates.push(entry);return entry;}
function pass(message:string){checks.push(message);console.log(`PASS ${message}`);}
async function until(action:()=>Promise<boolean>,label:string,timeout=45000){const started=Date.now();while(Date.now()-started<timeout){if(await action())return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error(`Relay isolation timed out: ${label}`);}
async function call(method:string,path:string,input?:unknown){
 const body=input===undefined?undefined:JSON.stringify(input);
 return new Promise<{status:number;body:any}>((resolve,reject)=>{const req=request({hostname:host,port:control!.port,path,method,ca:caBytes,agent:false,timeout:10000,headers:{authorization:`Bearer ${token}`,'content-type':'application/json','idempotency-key':randomUUID(),...(body?{'content-length':String(Buffer.byteLength(body))}:{})}},res=>{const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{try{resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(chunks).toString())})}catch(err){reject(err)}})});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Control timeout')));req.end(body);});
}
let caBytes:Buffer;
async function launchFixture(mode:string,args:string[],name:string,namespace?:string){
 const identity=`${nativeRoot}/${name}`,process=namespace?lab.spawn(namespace,fixture,['--mode',mode,...args,'--run-id',identity]):spawnLinux(fixture,['--mode',mode,...args,'--run-id',identity]);
 const entry:OwnedProcess={process,pid:0,binary:fixture,identity,errors:'',...(namespace?{namespace}:{})};processes.push(entry);process.stderr!.on('data',chunk=>{entry.errors=(entry.errors+chunk.toString()).slice(-8192);});
 const status=await new Promise<any>((resolve,reject)=>{let buffered='';const receive=(chunk:Buffer)=>{buffered+=chunk.toString();const end=buffered.indexOf('\n');if(end<0)return;process.stdout!.off('data',receive);try{resolve(JSON.parse(buffered.slice(0,end)))}catch(err){reject(err)}};process.stdout!.on('data',receive);process.once('error',reject);process.once('exit',code=>reject(new Error(`Fixture ${name} exited before readiness: ${code}`)));});
 assert.equal(status.runId,identity);entry.pid=status.pid;return status;
}
async function launchAgent(agent:Agent){
 agent.process=lab.spawn(agent.namespace,binary,agent.args);agent.process.stderr!.on('data',chunk=>{agent.errors=(agent.errors+chunk.toString()).slice(-16384);});
 await until(async()=>{const result=await lab.run(agent.namespace,'/usr/bin/pgrep',['-f',agent.root]).catch(()=>undefined);for(const candidate of result?.stdout.trim().split('\n')??[]){if(!/^[1-9][0-9]*$/.test(candidate))continue;const fields=(await lab.run(agent.namespace,'/bin/cat',[`/proc/${candidate}/cmdline`]).catch(()=>undefined))?.stdout.split('\0');if(fields?.[0]===binary&&fields.includes(`${agent.root}/state`)){agent.pid=Number(candidate);return true;}}return false;},'owned Agent process');
}
async function stop(entry:OwnedProcess){
 const inspect=(command:string,args:string[])=>entry.namespace?lab.run(entry.namespace,command,args):linux(command,args);
 const fields=(await inspect('/bin/cat',[`/proc/${entry.pid}/cmdline`]).catch(()=>undefined))?.stdout.split('\0');
 if(fields?.[0]===entry.binary&&fields.includes(entry.identity)){
  if(entry.namespace){const actual=(await inspect('stat',['-Lc','%i',`/proc/${entry.pid}/ns/net`])).stdout.trim();assert.equal(actual,lab.inodes.get(entry.namespace),'Refuse foreign namespace process cleanup');}
  if(entry.namespace)await lab.run(entry.namespace,'/bin/kill',['-TERM',String(entry.pid)]);else await linux('/bin/kill',['-TERM',String(entry.pid)]);
  await until(async()=>!(await inspect('/bin/cat',[`/proc/${entry.pid}/cmdline`]).catch(()=>undefined))?.stdout.split('\0').includes(entry.identity),'owned process exit',10000);
 }
 entry.process.kill();
}
async function machineReplay(agent:Agent,report:Report){
 const cert=Buffer.from((await lab.run(agent.namespace,'/bin/cat',[`${agent.root}/state/node.pem`])).stdout),key=Buffer.from((await lab.run(agent.namespace,'/bin/cat',[`${agent.root}/state/private.pem`])).stdout),body=JSON.stringify(report);
 return new Promise<{status:number;body:any}>((resolve,reject)=>{const req=request({hostname:host,port:control!.port,path:'/agent/v3/report',method:'POST',ca:caBytes,cert,key,agent:false,timeout:10000,headers:{'content-type':'application/json','content-length':String(Buffer.byteLength(body)),'x-tunex-session-epoch':String(report.sessionEpoch)}},res=>{const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{try{resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(chunks).toString())})}catch(err){reject(err)}})});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Replay timeout')));req.end(body);});
}
try{
 await lab.open();
 const synchronization=JSON.parse((await linux(collector,['--check'])).stdout);assert.equal(synchronization.synchronized,true);
 await execute(openssl,['req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',caKey,'-out',caCert,'-days','2','-subj','/CN=Isolated Relay CA']);
 await execute(openssl,['req','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',serverKey,'-out',join(directory,'server.csr'),'-subj','/CN=localhost']);
 await writeFile(join(directory,'server.ext'),`subjectAltName=IP:${host},IP:${lab.gateway}\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n`);
 await execute(openssl,['x509','-req','-in',join(directory,'server.csr'),'-CA',caCert,'-CAkey',caKey,'-set_serial','1','-out',serverCert,'-days','1','-extfile',join(directory,'server.ext')]);
 caBytes=await readFile(caCert);admin=await createConnection(databaseUrl);await admin.query(`CREATE DATABASE \`${database}\``);const url=new URL(databaseUrl);url.pathname=`/${database}`;
 control=await startControl({databaseUrl:url.toString(),caCert,caKey,serverKey,serverCert,openssl,stateDirectory:join(directory,'control'),initializeAuthority:true,port:0,host,policy,worker:true});await control.control.identity.bootstrap(scope,owner,token);
 const originalReport=control.runtime.report.bind(control.runtime);control.runtime.report=async(nodeId,epoch,report,fingerprint)=>{for(const held of gates)if(!held.opened&&held.nodeId===nodeId&&held.match(report)){held.report??=structuredClone(report);await held.wait;}return originalReport(nodeId,epoch,report,fingerprint);};
 const proxy=await launchFixture('tcp-proxy',['--host',lab.gateway,'--upstream-host',host,'--upstream-port',String(control.port)],'control-proxy');
 const ingressNS=lab.namespaces[0]!,egressNS=lab.namespaces[1]!,replacementNS=lab.namespaces[2]!;
 const targetA=await launchFixture('target',['--tag','A'],'target-A',egressNS),targetB=await launchFixture('target',['--tag','B'],'target-B',replacementNS);
 const freePort=async(namespace:string)=>JSON.parse((await lab.run(namespace,fixture,['--mode','port'])).stdout).port as number;
 const listenPort=await freePort(ingressNS),peerPorts=[await freePort(egressNS),await freePort(egressNS)],replacementPorts=[await freePort(replacementNS),await freePort(replacementNS)];assert.equal(new Set(peerPorts).size,2);assert.equal(new Set(replacementPorts).size,2);
 const profile={driver:'native.relay.v1',wireVersion:1,security:'mutual-tls13',protocols:['tcp','udp'],handshakeTimeoutSeconds:1,idleTimeoutSeconds:2,maxFrameBytes:65536,maxUdpDatagramBytes:16384,maxConnectionsPerNode:32};
 assert.equal((await call('PUT',`/api/v1/scopes/${scope}/transport-profiles/isolated-relay`,{expectedRevision:0,config:profile})).status,202);
 for(const [index,namespace] of lab.namespaces.entries()){
  const node=await call('POST',`/api/v1/scopes/${scope}/nodes`,{allowedListenerAddresses:['127.0.0.1'],allowedPorts:[listenPort],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8',lab.subnet],allowMetadataTargets:false});assert.equal(node.status,201);
  const root=`${nativeRoot}/agent-${index}`,args=['--control',`https://${lab.gateway}:${proxy.port}`,'--node',node.body.nodeId,'--ca',linuxPath(caCert),'--state',`${root}/state`,'--journal-key',`${root}/secrets/journal.key`,'--relay'];
  try{await lab.run(namespace,'/usr/bin/env',[`TUNEX_ENROLLMENT_TOKEN=${node.body.enrollmentToken}`,binary,...args,'--enroll']);}catch{throw new Error('Isolated enrollment failed; token redacted');}
  const agent:Agent={nodeId:node.body.nodeId,root,args,namespace,process:undefined as unknown as ChildProcess,pid:0,binary,identity:`${root}/state`,errors:''};agents.push(agent);await launchAgent(agent);
  await until(async()=>{const [rows]=await control!.db.pool.query<any[]>('SELECT COUNT(*) n FROM node_relay_credentials WHERE node_id=? AND revoked=FALSE',[node.body.nodeId]);return rows[0].n===1;},'isolated peer issuance');
  if(index>0){const address=index===1?lab.egress:lab.replacement;assert.equal((await call('PUT',`/api/v1/scopes/${scope}/nodes/${agent.nodeId}/relay-endpoint`,{expectedRevision:0,config:{listenAddress:address,advertisedHost:address,allowedTcpPorts:index===1?peerPorts:replacementPorts}})).status,202);}
 }
 const [ingress,egress,replacement]=agents as [Agent,Agent,Agent];
 const namespaceFacts=await Promise.all(agents.map(async agent=>({nodeId:agent.nodeId,namespace:agent.namespace,inode:(await lab.run(agent.namespace,'stat',['-Lc','%i',`/proc/${agent.pid}/ns/net`])).stdout.trim()})));assert.equal(new Set(namespaceFacts.map(fact=>fact.inode)).size,3);details.push({namespaceFacts,subnet:lab.subnet});
 pass('Isolation: three actual Agents have distinct Linux network namespaces and authenticated Control sessions over an opaque TLS proxy');
 let spec={enabled:true,protocols:['tcp','udp'],ingress:{nodeId:ingress.nodeId,listen:{address:'127.0.0.1',port:listenPort}},target:{host:'127.0.0.1',port:targetA.port as number},path:{via:[egress.nodeId]},transport:{profileId:'isolated-relay',configRevision:1}},revision=1;
 const isPhase=(phase:string)=>(report:Report)=>report.observations.some(obs=>obs.phase===phase&&obs.condition===(phase==='prepared'?'prepared':'ready'));
 const preparedGate=gate(egress.nodeId,isPhase('prepared')),activeGate=gate(egress.nodeId,isPhase('active'));
 await lab.partition(peerPorts,true);
 const created=await call('POST',`/api/v1/scopes/${scope}/forwards`,spec);assert.equal(created.status,202,JSON.stringify(created.body));const forwardId=created.body.forwardId as string,resourcePath=`/api/v1/scopes/${scope}/forwards/${forwardId}`;
 const latest=async()=>{const [rows]=await control!.db.pool.query<any[]>('SELECT generation,target_revision,stage,body FROM relay_deployments WHERE forward_id=? ORDER BY generation DESC LIMIT 1',[forwardId]);return rows[0];};
 const operation=async(id:string)=>(await call('GET',`/api/v1/scopes/${scope}/operations/${id}`)).body;
 const waitOperation=async(id:string)=>until(async()=>(await operation(id)).status==='succeeded','Operation success',65000);
 const assertClosed=async()=>{for(const args of [['-H','-ltn'],['-H','-lun']]){const sockets=(await lab.run(ingressNS,lab.ss,[...args,`sport = :${listenPort}`])).stdout.trim();assert.equal(sockets,'','Client-facing listener must remain closed');}};
 const probe=async(tag:string)=>JSON.parse((await lab.run(ingressNS,fixture,['--mode','probe','--port',String(listenPort),'--tag',tag])).stdout);
 const waitHealthy=async()=>until(async()=>{const plan=await latest(),resource=(await call('GET',resourcePath)).body;return plan.stage==='active'&&resource.health.condition==='ready'&&resource.applied.length===4&&resource.applied.every((obs:any)=>obs.phase==='active'&&obs.deploymentGeneration===plan.generation&&obs.forwardRevision===revision);},'exact current Relay readiness',65000);
 await until(async()=>Boolean(preparedGate.report),'prepared downstream report');assert.equal((await latest()).stage,'preparing');await assertClosed();assert.equal((await operation(created.body.operationId)).status,'running');
 pass('OPS-03/07: real prepared downstream behind a partition cannot open either client protocol');
 preparedGate.release();await until(async()=>Boolean(activeGate.report),'active downstream report');assert.equal((await latest()).stage,'egress_active');await assertClosed();
 const ingressGate=gate(ingress.nodeId,()=>true);
 await until(async()=>{const [rows]=await control!.db.pool.query<any[]>('SELECT received_at FROM runtime_nodes WHERE node_id=?',[ingress.nodeId]);return Date.now()>rows[0].received_at+policy.observationFreshnessSeconds*1000+200;},'actual prepared report becomes stale');
 activeGate.release();await until(async()=>{const [rows]=await control!.db.pool.query<any[]>('SELECT last_report FROM runtime_nodes WHERE node_id=?',[egress.nodeId]);return rows[0].last_report?.observations.some((obs:any)=>obs.phase==='active'&&obs.condition==='ready');},'persisted downstream ready');
 assert.equal((await latest()).stage,'egress_active');await assertClosed();
 pass('OPS-07: current downstream ready plus an actually stale ingress prepared report cannot advance activation');
 ingressGate.release();await until(async()=>{const resource=(await call('GET',resourcePath)).body;return resource.applied.filter((obs:any)=>obs.nodeId===ingress.nodeId&&obs.errorCode==='DOWNSTREAM_UNAVAILABLE').length===2;},'activation detects actual packet drop');
 assert.equal((await latest()).stage,'ingress_active');assert.equal((await operation(created.body.operationId)).status,'running');await assertClosed();details.push({activationDropCounters:await lab.counters()});
 pass('OPS-08: authenticated downstream ready followed by actual network isolation leaves ingress closed and both protocols retryable');
 await lab.partition(peerPorts,false);await waitOperation(created.body.operationId);await waitHealthy();const restored=await probe('A');assert.equal(restored.tcp,true);assert.equal(restored.udp,true);const generation=(await latest()).generation;
 pass('Partition recovery: removing only the scoped packet drop restores exact encrypted TCP/UDP without changing intent or deployment generation');
 await lab.partition(peerPorts,true);await until(async()=>{const resource=(await call('GET',resourcePath)).body;return resource.health.condition==='degraded'&&resource.applied.filter((obs:any)=>obs.nodeId===ingress.nodeId&&obs.errorCode==='DOWNSTREAM_UNAVAILABLE').length===2;},'active Relay degradation');assert.equal((await operation(created.body.operationId)).status,'succeeded');
 for(const flag of ['--tcp-only','--udp-only']){let failed=false;try{await lab.run(ingressNS,fixture,['--mode','probe','--port',String(listenPort),flag,'--tag','A']);}catch{failed=true;}assert.equal(failed,true,'Isolated Relay must not carry checked payload');}
 const counters=await lab.counters();assert.ok(counters.split('\n').some(line=>/^\s*[1-9][0-9]*\s+\d+\s+DROP\s/.test(line)));details.push({activeDropCounters:counters});
 pass('Active partition: both actual payload paths fail, health reports degradation and the already completed Operation remains terminal');
 await lab.partition(peerPorts,false);await waitHealthy();assert.equal((await latest()).generation,generation);assert.equal((await probe('A')).udp,true);
 pass('Active recovery: current reports and both encrypted protocols recover within the same deployment');
 const [savedRows]=await control.db.pool.query<any[]>('SELECT last_report FROM runtime_nodes WHERE node_id=?',[egress.nodeId]);const savedReport=savedRows[0].last_report as Report;
 const targetC=await launchFixture('target',['--tag','C'],'target-C',egressNS),nextPrepared=gate(egress.nodeId,isPhase('prepared'));spec={...spec,target:{host:'127.0.0.1',port:targetC.port}};
 const updated=await call('PUT',resourcePath,{expectedRevision:revision,spec});assert.equal(updated.status,202);revision=updated.body.revision;await until(async()=>Boolean(nextPrepared.report),'successor prepared report held');
 const replay=await machineReplay(egress,savedReport);assert.equal(replay.status,200);assert.equal(replay.body.status,'duplicate');assert.equal((await latest()).stage,'preparing');await assertClosed();assert.equal((await operation(updated.body.operationId)).status,'running');
 nextPrepared.release();await waitOperation(updated.body.operationId);await waitHealthy();assert.equal((await probe('C')).tcp,true);
 pass('OPS-07/ADP-07: delayed authentic prior-generation ready receives duplicate ACK and cannot activate or complete its successor');
 const primarySpec=structuredClone(spec);await lab.partition(replacementPorts,true,lab.replacement);spec={...spec,path:{via:[replacement.nodeId]},target:{host:'127.0.0.1',port:targetB.port}};
 const failedPath=await call('PUT',resourcePath,{expectedRevision:revision,spec});assert.equal(failedPath.status,202);revision=failedPath.body.revision;
 await until(async()=>{const resource=(await call('GET',resourcePath)).body;return resource.applied.filter((obs:any)=>obs.nodeId===ingress.nodeId&&obs.forwardRevision===revision&&obs.errorCode==='DOWNSTREAM_UNAVAILABLE').length===2;},'partitioned replacement activation');await assertClosed();assert.equal((await operation(failedPath.body.operationId)).status,'running');
 const [retained]=await control.db.pool.query<any[]>('SELECT COUNT(*) n FROM port_slots WHERE owner_id=?',[forwardId]);assert.equal(retained[0].n,6);
 await control.db.pool.query('UPDATE operations SET execution_deadline=? WHERE id=?',[Date.now()-1,failedPath.body.operationId]);
 await until(async()=>{const op=await operation(failedPath.body.operationId);return op.status==='failed'&&!op.cleanupPending;},'real scanner and historical path cleanup',75000);await assertClosed();
 pass('OPS-04/FWD-12: partitioned path replacement retains both paths, then real scanner deadline failure safely withdraws both roles');
 const compensation=await call('PUT',resourcePath,{expectedRevision:revision,spec:primarySpec});assert.equal(compensation.status,202);assert.notEqual(compensation.body.operationId,failedPath.body.operationId);revision=compensation.body.revision;spec=primarySpec;await waitOperation(compensation.body.operationId);await waitHealthy();assert.equal((await probe('C')).udp,true);assert.equal((await operation(failedPath.body.operationId)).status,'failed');
 const [released]=await control.db.pool.query<any[]>('SELECT node_id,COUNT(*) n FROM port_slots WHERE owner_id=? GROUP BY node_id',[forwardId]);assert.equal(released.length,2);assert.ok(!released.some(row=>row.node_id===replacement.nodeId));assert.equal(released.reduce((sum,row)=>sum+row.n,0),4);
 pass('Path compensation: an explicit newer revision restores the original path while the failed Operation stays terminal and unused egress slots release safely');
 await lab.partition(replacementPorts,false,lab.replacement);
 const [oldSessionRows]=await control.db.pool.query<any[]>('SELECT last_report,session_epoch FROM runtime_nodes WHERE node_id=?',[egress.nodeId]);const oldReport=oldSessionRows[0].last_report as Report,oldEpoch=oldSessionRows[0].session_epoch;
 const bootReady=gate(egress.nodeId,report=>report.sessionEpoch>oldEpoch&&isPhase('active')(report));await stop(egress);await launchAgent(egress);await until(async()=>Boolean(bootReady.report),'new-session downstream active report held');await assertClosed();assert.equal((await latest()).stage,'egress_active');
 const oldBoot=await machineReplay(egress,oldReport);assert.equal(oldBoot.status,409);assert.equal(oldBoot.body.code,'SESSION_SUPERSEDED');assert.equal((await latest()).stage,'egress_active');bootReady.release();await waitHealthy();await until(async()=>(await call('GET',resourcePath)).body.lastOperation.status==='succeeded','restart retirement cleanup',65000);assert.equal((await probe('C')).tcp,true);
 pass('OPS-07/ADP-10: genuine old-session ready is rejected during new-boot activation; fresh reports restore both roles without resetting intent');
 const deleted=await call('DELETE',resourcePath,{expectedRevision:revision});assert.equal(deleted.status,202);await waitOperation(deleted.body.operationId);const [remaining]=await control.db.pool.query<any[]>('SELECT COUNT(*) n FROM port_slots WHERE owner_id=?',[forwardId]);assert.equal(remaining[0].n,0);await assertClosed();
 pass('Isolation cleanup: Forward deletion closes both client protocols and returns every physical reservation');
 const commit=(await execute('git',['rev-parse','HEAD'])).stdout.trim();evidence={commit,workingTreeDirty:Boolean((await execute('git',['status','--porcelain'])).stdout.trim()),command:'npm run test:relay-isolation',checks,caseCoverage:[{caseId:'OPS-03',checks:[1]},{caseId:'OPS-07',checks:[1,2,7,10]},{caseId:'OPS-08',checks:[3,4,5,6]},{caseId:'OPS-04',checks:[8,9]},{caseId:'ADP-07',checks:[7]},{caseId:'ADP-10',checks:[10]}],details,policy,synchronization,kernel:(await linux('/bin/uname',['-a'])).stdout.trim(),topology:`${viaWSL?'Windows locked Control/MySQL and WSL':'Native Linux Control/MySQL and'} three independent Agent network namespaces; isolated bridge, no host NAT/firewall changes; TLS remains end-to-end through Control TCP proxy`,protocolVersion:3,agentSHA:createHash('sha256').update(await readFile(viaWSL?'.artifacts/tunex-agent-linux':binary)).digest('hex'),fixtureSHA:createHash('sha256').update(await readFile(viaWSL?'.artifacts/network-fixture-linux':fixture)).digest('hex'),initialGeneration:generation,finalRevision:revision,deadlineInjection:'Disposable Operation execution_deadline only; actual clocks and lease waits unchanged'};
}catch(error){
 if(control){const [operations]=await control.db.pool.query('SELECT id,forward_id,target_revision,status,cleanup_pending,last_error FROM operations');const [runtime]=await control.db.pool.query('SELECT node_id,session_epoch,snapshot_generation,last_report FROM runtime_nodes');const [deployments]=await control.db.pool.query('SELECT * FROM relay_deployments');await writeFile(join(directory,'failure.json'),JSON.stringify({error:error instanceof Error?error.message:'Relay isolation failed',operations,runtime,deployments,processes:[...agents,...processes].map(entry=>({pid:entry.pid,namespace:entry.namespace??null,errors:entry.errors,exitCode:entry.process?.exitCode??null}))},null,2));}
 console.error(`Failure evidence: ${directory}`);throw error;
}finally{
 for(const held of gates)held.release();
 const cleanupErrors:unknown[]=[];
 for(const entry of [...agents,...processes].reverse())await stop(entry).catch(error=>{cleanupErrors.push(error);console.error('Owned process cleanup failed');});
 await control?.close();if(admin){await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);await admin.end();}
 await lab.close();
 await lab.verifyClosed();
 if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Owned process cleanup failed');
}
await writeFile(join(directory,'evidence.json'),JSON.stringify({...evidence,networkCleanupVerified:true},null,2));console.log(`Relay isolation acceptance passed: ${checks.length} checks. Evidence ${directory}`);
