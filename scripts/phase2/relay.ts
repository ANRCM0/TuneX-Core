import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
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
import { host,linuxPath,linux,spawnLinux,linuxBinary,topology,viaWSL } from './native-linux.ts';
import { relaySwitchFaults } from './relay-scenarios.ts';
import { reportsDuringIntentLock } from './runtime-intent-lock.ts';
import { verifyTunnelConsole } from './tunnel-console.ts';
import { verifyControlledEcho } from './product-p-observation.ts';

const execute=promisify(execFile),databaseUrl=process.env.TUNEX_TEST_DATABASE_URL,openssl=process.env.TUNEX_OPENSSL??'openssl';
const tunnelBrowser=process.env.TUNEX_TUNNEL_BROWSER==='1';
const productP=process.env.TUNEX_PRODUCT_P_ACCEPTANCE==='1'&&tunnelBrowser;
if(tunnelBrowser&&(process.platform!=='linux'||process.env.GITHUB_ACTIONS!=='true'))throw Error('Tunnel browser acceptance is Actions-only');
if(!databaseUrl)throw new Error('Disposable MySQL URL required');
await mkdir('.artifacts/relay',{recursive:true});const directory=await mkdtemp(resolve('.artifacts/relay/run-'));
const caKey=join(directory,'ca.key'),caCert=join(directory,'ca.pem'),serverKey=join(directory,'server.key'),serverCert=join(directory,'server.pem');
await execute(openssl,['req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',caKey,'-out',caCert,'-days','2','-subj','/CN=Relay Acceptance CA']);
await execute(openssl,['req','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',serverKey,'-out',join(directory,'server.csr'),'-subj','/CN=localhost']);
await writeFile(join(directory,'server.ext'),`subjectAltName=IP:${host}\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n`);
await execute(openssl,['x509','-req','-in',join(directory,'server.csr'),'-CA',caCert,'-CAkey',caKey,'-set_serial','1','-out',serverCert,'-days','1','-extfile',join(directory,'server.ext')]);
const admin=await createConnection(databaseUrl),database=`tunex_relay_${randomUUID().replaceAll('-','')}`;await admin.query(`CREATE DATABASE \`${database}\``);
const dbUrl=new URL(databaseUrl);dbUrl.pathname=`/${database}`;
const token=newToken(),scope='relay-scope',owner='relay-owner',ca=await readFile(caCert),checks:string[]=[];
const binary=linuxBinary('tunex-agent'),fixture=linuxBinary('network-fixture'),collector=linuxBinary('time-proof');
const nativeRoot=`/tmp/tunex-relay-${randomUUID()}`;
const switchFaults=process.argv.includes('--switch-faults'),tag=switchFaults?'A':'';
const policy={...DEFAULT_POLICY,maxClockSkewSeconds:productP?1:DEFAULT_POLICY.maxClockSkewSeconds,pollIntervalSeconds:1,leaseSeconds:switchFaults?45:30,renewalLeadSeconds:switchFaults?18:12,observationFreshnessSeconds:5,drainTimeoutSeconds:switchFaults?20:2,udpIdleTimeoutSeconds:2};
const options={databaseUrl:dbUrl.toString(),caCert,caKey,serverKey,serverCert,openssl,stateDirectory:join(directory,'control'),initializeAuthority:true,port:0,host,policy,worker:false,
    probeExecutionEnabled:productP,probeIngressEnabled:productP,probeServicesEnabled:productP,probeEchoEnabled:productP,probePathEchoEnabled:productP};
let control:Awaited<ReturnType<typeof startControl>>|undefined,target:ChildProcess|undefined,targetPID:number|undefined;
const agents:{nodeId:string;root:string;args:string[];process:ChildProcess;errors?:string}[]=[];
let releaseReady:(()=>void)|undefined;
function pass(text:string){checks.push(text);console.log(`PASS ${text}`);}
async function call(method:string,path:string,input?:unknown,key:string=randomUUID()):Promise<{status:number;body:any}>{const body=input===undefined?undefined:JSON.stringify(input);return new Promise((resolve,reject)=>{const req=request({hostname:host,port:control!.port,path,method,ca,agent:false,timeout:10000,headers:{authorization:`Bearer ${token}`,'content-type':'application/json','idempotency-key':key,...(body?{'content-length':String(Buffer.byteLength(body))}:{})}},res=>{const parts:Buffer[]=[];res.on('data',chunk=>parts.push(chunk));res.on('end',()=>{try{resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(parts).toString())})}catch(err){reject(err)}})});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Control timeout')));req.end(body)});}
async function until(action:()=>Promise<boolean>,label:string,timeout=45000){const started=Date.now();while(Date.now()-started<timeout){if(await action())return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error(`Relay acceptance timed out: ${label}`);}
async function port(){return JSON.parse((await linux(fixture,['--mode','port'])).stdout).port as number;}
async function stopNative(root:string){const candidates=await linux('/usr/bin/pgrep',['-f',root]).catch(()=>undefined);for(const pid of candidates?.stdout.trim().split('\n')??[]){if(!/^[1-9][0-9]*$/.test(pid))continue;const command=await linux('/bin/cat',[`/proc/${pid}/cmdline`]).catch(()=>undefined);const fields=command?.stdout.split('\0');if(fields?.[0]===binary&&fields.includes(`${root}/state`)&&fields.includes(`${root}/secrets/journal.key`)){await linux('/bin/kill',['-TERM',pid]);await until(async()=>{const remaining=await linux('/bin/cat',[`/proc/${pid}/cmdline`]).catch(()=>undefined);return !remaining?.stdout.split('\0').includes(`${root}/state`);},'owned Agent exit',10000);}}}
try{
 const synchronization=JSON.parse((await linux(collector,['--check'])).stdout);assert.equal(synchronization.synchronized,true);
 control=await startControl(options);await control.control.identity.bootstrap(scope,owner,token);
 target=spawnLinux(fixture,['--mode','target','--tag',tag,'--run-id',nativeRoot]);const targetStatus=JSON.parse(await new Promise<string>((resolve,reject)=>{target!.stdout!.once('data',chunk=>resolve(chunk.toString()));target!.once('error',reject)}));assert.equal(targetStatus.platform,'linux');assert.equal(targetStatus.runId,nativeRoot);targetPID=targetStatus.pid;
 const listenPort=await port(),movedPort=await port(),peerPorts=[await port(),await port()];assert.notEqual(peerPorts[0],peerPorts[1]);
 let echoPort=await port();while([listenPort,movedPort,...peerPorts].includes(echoPort))echoPort=await port();
 if(tunnelBrowser){while(peerPorts.length<4){const next=await port();if(![listenPort,movedPort,echoPort,...peerPorts].includes(next))peerPorts.push(next);}}
 const profile={driver:'native.relay.v1',wireVersion:1,security:'mutual-tls13',protocols:['tcp','udp'],handshakeTimeoutSeconds:2,idleTimeoutSeconds:2,maxFrameBytes:65536,maxUdpDatagramBytes:16384,maxConnectionsPerNode:32};
 assert.equal((await call('PUT',`/api/v1/scopes/${scope}/transport-profiles/secure-relay`,{expectedRevision:0,config:profile})).status,202);
 for(const role of ['ingress','egress']){
  const node=await call('POST',`/api/v1/scopes/${scope}/shared-nodes`,{allowedListenerAddresses:['127.0.0.1'],allowedPorts:[listenPort,movedPort,...(productP?[echoPort]:[])],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false});assert.equal(node.status,201);
  const useGrant=await call('PUT',`/api/v1/scopes/${scope}/nodes/${node.body.nodeId}/grants/${owner}`,{expectedRevision:1,allowed:true,allowedRoles:[role]});assert.equal(useGrant.status,202);assert.equal(useGrant.body.revision,2);
  const root=`${nativeRoot}/${role}`,args=['--control',`https://${host}:${control.port}`,'--node',node.body.nodeId,'--ca',linuxPath(caCert),'--state',`${root}/state`,'--journal-key',`${root}/secrets/journal.key`,'--relay'];
  if(productP)args.push('--probe-registration','--probe-execution','--probe-ingress','--probe-services','--probe-echo','--probe-path-echo');
  try{await linux('env',[`TUNEX_ENROLLMENT_TOKEN=${node.body.enrollmentToken}`,binary,...args,'--enroll']);}catch{throw new Error('Relay enrollment failed; token redacted');}
  const process=spawnLinux(binary,args),entry={nodeId:node.body.nodeId,root,args,process,errors:''};process.stderr!.on('data',chunk=>{entry.errors=(entry.errors+chunk.toString()).slice(-32768);});agents.push(entry);
  await until(async()=>{const [rows]=await control!.db.pool.query<any[]>('SELECT COUNT(*) n FROM node_relay_credentials WHERE node_id=? AND revoked=FALSE',[node.body.nodeId]);return rows[0].n===1;},'peer issuance');
 }
 const [ingress,egress]=agents;
 assert.equal((await call('PUT',`/api/v1/scopes/${scope}/nodes/${egress!.nodeId}/relay-endpoint`,{expectedRevision:0,config:{listenAddress:'127.0.0.1',advertisedHost:'127.0.0.1',allowedTcpPorts:peerPorts}})).status,202);
 pass('Relay identities: two independent Linux Agents use dedicated current-session peer credentials and a locked secure Profile');
 const spec={enabled:true,protocols:['tcp','udp'] as const,ingress:{nodeId:ingress!.nodeId,listen:{address:'127.0.0.1',port:listenPort}},target:{host:'127.0.0.1',port:targetStatus.port},path:{via:[egress!.nodeId]},transport:{profileId:'secure-relay',configRevision:1}};
 const respond=control.control.idempotency.respond.bind(control.control.idempotency);control.control.idempotency.respond=async()=>{throw new Error('Injected final response failure');};assert.equal((await call('POST',`/api/v1/scopes/${scope}/forwards`,spec)).status,503);control.control.idempotency.respond=respond;
 const [rolled]=await control.db.pool.query<any[]>('SELECT (SELECT COUNT(*) FROM forwards) forwards,(SELECT COUNT(*) FROM relay_deployments) deployments,(SELECT COUNT(*) FROM port_slots WHERE owner_id IS NOT NULL) slots');assert.equal(rolled[0].forwards,0);assert.equal(rolled[0].deployments,0);assert.equal(rolled[0].slots,0);
 pass('Relay transaction: failure after allocation/plan/Operation rolls all intent and physical ownership back');
 const requestKey=randomUUID(),created=await call('POST',`/api/v1/scopes/${scope}/forwards`,spec,requestKey);assert.equal(created.status,202,JSON.stringify(created.body));assert.deepEqual(await call('POST',`/api/v1/scopes/${scope}/forwards`,spec,requestKey),created);
 const conflict=await call('POST',`/api/v1/scopes/${scope}/forwards`,spec);assert.equal(conflict.status,409);assert.equal(conflict.body.code,'PORT_RESERVED');
 const [resources]=await control.db.pool.query<any[]>('SELECT node_id,protocol,port,fence FROM port_slots WHERE owner_id=?',[created.body.forwardId]);assert.equal(resources.length,4);assert.equal(resources.filter(r=>r.node_id===egress!.nodeId&&r.protocol==='tcp').length,2);
 pass('Relay acceptance: Forward/Operation/immutable deployment and four exclusive physical resources persist together and replay once');
 const originalReport=control.runtime.report.bind(control.runtime);let heldActive=false;
 const readyGate=new Promise<void>(resolve=>{releaseReady=resolve;});
 control.runtime.report=async(nodeId,epoch,report,fingerprint)=>{if(nodeId===egress!.nodeId&&report.observations.some(obs=>obs.phase==='active'&&obs.condition==='ready')&&!heldActive){heldActive=true;await readyGate;}return originalReport(nodeId,epoch,report,fingerprint);};
 await control.runtime.tick();
 await until(async()=>heldActive,'downstream active report held');
 const [preparedStage]=await control.db.pool.query<any[]>('SELECT stage FROM relay_deployments WHERE forward_id=? ORDER BY generation DESC LIMIT 1',[created.body.forwardId]);assert.equal(preparedStage[0].stage,'egress_active');
 let closed=false;try{await linux(fixture,['--mode','probe','--port',String(listenPort)]);}catch{closed=true;}assert.equal(closed,true);
 assert.notEqual((await call('GET',`/api/v1/scopes/${scope}/operations/${created.body.operationId}`)).body.status,'succeeded');
 pass('Tail-to-head activation: prepared or unacknowledged active downstream keeps the actual client-facing ingress closed');
 releaseReady!();releaseReady=undefined;
 await until(async()=>{await control!.runtime.tick();return (await call('GET',`/api/v1/scopes/${scope}/operations/${created.body.operationId}`)).body.status==='succeeded';},'both roles active');
 const probe=JSON.parse((await linux(fixture,['--mode','probe','--port',String(listenPort),'--tag',tag])).stdout);assert.equal(probe.tcp,true);assert.equal(probe.udp,true);
 const [stage]=await control.db.pool.query<any[]>('SELECT generation,stage,body FROM relay_deployments WHERE forward_id=? ORDER BY generation DESC LIMIT 1',[created.body.forwardId]);assert.equal(stage[0].stage,'active');
 const healthy=await call('GET',`/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`);assert.equal(healthy.body.applied.length,4);assert.equal(healthy.body.health.condition,'ready');assert.equal(new Set(healthy.body.applied.map((obs:any)=>obs.nodeId)).size,2);assert.ok(healthy.body.applied.every((obs:any)=>obs.forwardRevision===1));assert.deepEqual([...new Set(healthy.body.applied.map((obs:any)=>obs.role))].sort(),['relay-egress','relay-ingress']);
 pass('Encrypted Relay traffic: real API/Worker/two native Agents/target verify exact bidirectional TCP and UDP payload');
 if(productP)for(const check of await verifyControlledEcho({scopeId:scope,nodeId:ingress!.nodeId,mode:'relay',directory,listenPort:echoPort,spec,discovery:control.control.probeEcho,
    call:(method,path,input,key)=>call(method,`/api/v1/scopes/${scope}/`+path,input,key),tick:async()=>{await control!.runtime.tick();},
    qualified:async()=>{const [result]=await control!.db.pool.query<any[]>("SELECT COUNT(*) n FROM probe_type_qualifications q JOIN runtime_nodes r ON r.node_id=q.node_id AND r.session_epoch=q.session_epoch WHERE q.node_id=? AND q.state='qualified' AND q.echo_version=1 AND q.expires_at>?",[ingress!.nodeId,Date.now()+2000]);return result[0].n===1;}
 }))pass('P Relay '+check);
 const egressAssignment=stage[0].body.nodes.find((node:any)=>node.nodeId===egress!.nodeId).assignments.find((a:any)=>a.protocol==='tcp');
 const currentOpen=join(directory,'negative-open.json');await writeFile(currentOpen,JSON.stringify({wireVersion:1,type:'open',action:'probe',requestId:'negative-probe',binding:egressAssignment.driver.config.binding}));
 const peerFacts=await control.db.transaction(tx=>control!.control.nodes.relayCredentialFacts(tx,egress!.nodeId));
 const negativeArgs=['--mode','relay-negative','--port',String(egressAssignment.resource.port),'--relay-ca',linuxPath(caCert),'--relay-cert',`${ingress!.root}/state/node.pem`,'--relay-key',`${ingress!.root}/state/private.pem`,'--relay-node',egress!.nodeId,'--relay-pin',peerFacts[0]!.fingerprint,'--relay-open',linuxPath(currentOpen)];
 for(const extra of [[],['--tls12']]){const negative=JSON.parse((await linux(fixture,[...negativeArgs,...extra])).stdout);assert.equal(negative.rejected,true);assert.equal(negative.currentBinding,true);}
 pass('Real Relay identity refusal: a valid deployment probe with machine-only credentials or TLS 1.2 cannot obtain acceptance');
 const generation=stage[0].generation,renewedBefore=(await control.db.pool.query<any[]>('SELECT snapshot_generation FROM runtime_nodes WHERE node_id=?',[ingress!.nodeId]))[0][0].snapshot_generation;
 await until(async()=>{const [rows]=await control!.db.pool.query<any[]>('SELECT snapshot_generation FROM runtime_nodes WHERE node_id=?',[ingress!.nodeId]);return rows[0].snapshot_generation>renewedBefore;},'Relay renewal');
 const [after]=await control.db.pool.query<any[]>('SELECT generation FROM relay_deployments WHERE forward_id=? ORDER BY generation DESC LIMIT 1',[created.body.forwardId]);assert.equal(after[0].generation,generation);
 assert.equal(JSON.parse((await linux(fixture,['--mode','probe','--port',String(listenPort),'--tag',tag])).stdout).udp,true);
 pass('Relay renewal: higher whole-Node Snapshot retains the same execution generation and both checked protocols');
 const savedPort=control.port;await control.close();control=await startControl({...options,port:savedPort,initializeAuthority:false,worker:true});
 await until(async()=>(await call('GET',`/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`)).body.health.condition==='ready','Control restart');
 assert.equal(JSON.parse((await linux(fixture,['--mode','probe','--port',String(listenPort),'--tag',tag])).stdout).tcp,true);
 pass('Coordinator restart: persisted stages and current leases converge through the scheduled Worker without changing intent');
 await reportsDuringIntentLock(control.db,created.body.forwardId,agents.map(agent=>agent.nodeId),until);
 pass('Runtime lock boundary: both genuine Agent Reports commit while another transaction owns Forward intent; the Worker does not acquire a reverse intent lock');
 const noop=await call('PUT',`/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`,{expectedRevision:1,spec});assert.equal(noop.status,200);assert.equal(noop.body.revision,1);
 const movedSpec={...spec,ingress:{...spec.ingress,listen:{address:'127.0.0.1',port:movedPort}}},changed=await call('PUT',`/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`,{expectedRevision:1,spec:movedSpec});assert.equal(changed.status,202);
 await until(async()=>(await call('GET',`/api/v1/scopes/${scope}/operations/${changed.body.operationId}`)).body.status==='succeeded','Relay port change');
 assert.equal(JSON.parse((await linux(fixture,['--mode','probe','--port',String(movedPort),'--tag',tag])).stdout).udp,true);
 const [oldPort]=await control.db.pool.query<any[]>('SELECT COUNT(*) n FROM port_slots WHERE node_id=? AND port=? AND owner_id=?',[ingress!.nodeId,listenPort,created.body.forwardId]);assert.equal(oldPort[0].n,0);
 const disabled=await call('PUT',`/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`,{expectedRevision:2,spec:{...movedSpec,enabled:false}});assert.equal(disabled.status,202);
 await until(async()=>(await call('GET',`/api/v1/scopes/${scope}/operations/${disabled.body.operationId}`)).body.status==='succeeded','Relay disable');
 const [disabledSlots]=await control.db.pool.query<any[]>('SELECT COUNT(*) n FROM port_slots WHERE owner_id=?',[created.body.forwardId]);assert.equal(disabledSlots[0].n,4);
 const enabled=await call('PUT',`/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`,{expectedRevision:3,spec:movedSpec});assert.equal(enabled.status,202);
 await until(async()=>(await call('GET',`/api/v1/scopes/${scope}/operations/${enabled.body.operationId}`)).body.status==='succeeded','Relay enable');
 pass('Relay lifecycle: canonical no-op, port change, both-protocol safe cleanup, disable reservation retention and fresh enable');
 const grantsPath=`/api/v1/scopes/${scope}/transport-profiles/secure-relay/grants/${owner}`;
 const withdrawn=await call('PUT',grantsPath,{expectedRevision:1,allowed:false});assert.equal(withdrawn.status,202);assert.equal(withdrawn.body.operationIds.length,1);
 await until(async()=>{await control!.runtime.tick();return (await call('GET',`/api/v1/scopes/${scope}/operations/${withdrawn.body.operationIds[0]}`)).body.status==='succeeded';},'Profile withdrawal');
 let denied=false;try{await linux(fixture,['--mode','probe','--port',String(movedPort)]);}catch{denied=true;}assert.equal(denied,true);
 const restoredGrant=await call('PUT',grantsPath,{expectedRevision:2,allowed:true});assert.equal(restoredGrant.status,202);assert.equal(restoredGrant.body.operationIds.length,1);
 await until(async()=>{await control!.runtime.tick();return (await call('GET',`/api/v1/scopes/${scope}/operations/${restoredGrant.body.operationIds[0]}`)).body.status==='succeeded';},'Profile restoration');
 assert.equal(JSON.parse((await linux(fixture,['--mode','probe','--port',String(movedPort),'--tag',tag])).stdout).tcp,true);
 pass('Profile execution authority: withdrawal persists a two-Node cleanup Operation and restoration requires fresh deployment/fences');
 const nodeGrantPath=`/api/v1/scopes/${scope}/nodes/${egress!.nodeId}/grants/${owner}`;
 const nodeWithdrawn=await call('PUT',nodeGrantPath,{expectedRevision:2,allowed:false});assert.equal(nodeWithdrawn.status,202);assert.equal(nodeWithdrawn.body.operationIds.length,1);
 const [historicalBounds]=await control.db.pool.query<any[]>('SELECT MAX(valid_until) maximum FROM execution_leases WHERE forward_id=?',[created.body.forwardId]);assert.ok(Date.parse(nodeWithdrawn.body.latestAuthorizationUntil)>=historicalBounds[0].maximum+5000);
 await until(async()=>(await call('GET',`/api/v1/scopes/${scope}/operations/${nodeWithdrawn.body.operationIds[0]}`)).body.status==='succeeded','egress grant withdrawal');
 const nodeRestored=await call('PUT',nodeGrantPath,{expectedRevision:3,allowed:true,allowedRoles:['egress']});assert.equal(nodeRestored.status,202);assert.equal(nodeRestored.body.operationIds.length,1);
 await until(async()=>(await call('GET',`/api/v1/scopes/${scope}/operations/${nodeRestored.body.operationIds[0]}`)).body.status==='succeeded','egress grant restoration');
 assert.equal(JSON.parse((await linux(fixture,['--mode','probe','--port',String(movedPort),'--tag',tag])).stdout).udp,true);
 pass('Egress Node authority: downstream use-grant withdrawal stops the whole Relay and explicit restoration recompiles both roles');
 const [beforeBoot]=await control.db.pool.query<any[]>('SELECT MAX(generation) generation FROM relay_deployments WHERE forward_id=?',[created.body.forwardId]);
 await stopNative(egress!.root);egress!.process.kill();egress!.process=spawnLinux(binary,egress!.args);egress!.process.stderr!.on('data',chunk=>{egress!.errors=((egress!.errors??'')+chunk.toString()).slice(-32768);});
 await until(async()=>{await control!.runtime.tick();const [latest]=await control!.db.pool.query<any[]>('SELECT generation,stage FROM relay_deployments WHERE forward_id=? ORDER BY generation DESC LIMIT 1',[created.body.forwardId]);const resource=await call('GET',`/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`);return latest[0].generation>beforeBoot[0].generation&&latest[0].stage==='active'&&resource.body.lastOperation.status==='succeeded';},'fresh egress session and historical lease',60000);
 const reconnected=JSON.parse((await linux(fixture,['--mode','probe','--port',String(movedPort),'--tag',tag])).stdout);assert.equal(reconnected.tcp,true);assert.equal(reconnected.udp,true);
 pass('Relay restart: new egress session creates a higher immutable deployment while old-session authorization remains in the retirement ledger');
 let desiredRevision=4,scenarioDetails:unknown,tunnelConsole:unknown,currentSpec:import('@tunex/core').ForwardSpec=movedSpec;
 if(tunnelBrowser){const result=await verifyTunnelConsole({url:`https://${host}:${control.port}`,scope,token,directory,sourceId:created.body.forwardId,revision:desiredRevision,spec:currentSpec,profile:profile as import('@tunex/contracts').RelayProfileConfig,unusedListenPort:listenPort,
  traffic:async listen=>{const actual=JSON.parse((await linux(fixture,['--mode','probe','--port',String(listen),'--tag',tag])).stdout);assert.equal(actual.tcp,true);assert.equal(actual.udp,true);},
  closed:async listen=>{let refused=false;try{await linux(fixture,['--mode','probe','--port',String(listen)]);}catch{refused=true;}assert.equal(refused,true,'Disabled or removed browser copy accepted traffic');}});desiredRevision=result.revision;currentSpec=result.spec;tunnelConsole=result.evidence;pass('Real Chromium Relay Console: scoped TLS metadata, exact Profile inspection, referenced revision switch with fresh preview/CAS, disabled copy, real TCP/UDP and cleanup');}
 if(switchFaults){const result=await relaySwitchFaults({control:()=>control!,call,until,pass,agents,scope,forwardId:created.body.forwardId,spec:currentSpec as Parameters<typeof relaySwitchFaults>[0]['spec'],revision:desiredRevision,nativeRoot,binary,fixture,caPath:caCert,freePort:port,unusedListenPort:listenPort});desiredRevision=result.revision;scenarioDetails=result.details;}
 await stopNative(egress!.root);egress!.process.kill();
 await until(async()=>{const status=await call('GET',`/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`);return status.body.health.condition!=='ready';},'downstream loss observable');
 assert.equal((await call('GET',`/api/v1/scopes/${scope}/operations/${created.body.operationId}`)).body.status,'succeeded');
 pass('Downstream loss: ingress probe stops reporting ready while the completed Operation remains terminal');
 const deleted=await call('DELETE',`/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`,{expectedRevision:desiredRevision});assert.equal(deleted.status,202);
 await until(async()=>{await control!.runtime.tick();return (await call('GET',`/api/v1/scopes/${scope}/operations/${deleted.body.operationId}`)).body.status==='succeeded';},'offline egress safe deletion',60000);
 const [remaining]=await control.db.pool.query<any[]>('SELECT COUNT(*) n FROM port_slots WHERE owner_id=?',[created.body.forwardId]);assert.equal(remaining[0].n,0);assert.equal((await call('GET',`/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`)).status,404);
 pass('Relay deletion: both Nodes retain historical lease/fence facts until safe reclamation, including an offline egress');
 const commit=(await execute('git',['rev-parse','HEAD'])).stdout.trim();await writeFile(join(directory,'evidence.json'),JSON.stringify({commit,workingTreeDirty:Boolean((await execute('git',['status','--porcelain'])).stdout.trim()),command:(tunnelBrowser?'TUNEX_TUNNEL_BROWSER=1 ':'')+(switchFaults?'npm run test:relay-switch':'npm run test:relay'),checks,policy,synchronization,agentSHA:createHash('sha256').update(await readFile(viaWSL?'.artifacts/tunex-agent-linux':binary)).digest('hex'),fixtureSHA:createHash('sha256').update(await readFile(viaWSL?'.artifacts/network-fixture-linux':fixture)).digest('hex'),kernel:(await linux('/bin/uname',['-a'])).stdout.trim(),topology:`${topology}; ${agents.length} independent Agents; same Linux host`,deploymentGeneration:generation,protocolVersion:3,scenarioDetails,tunnelConsole},null,2));console.log(`Relay acceptance passed: ${checks.length} checks. Evidence ${directory}`);
}catch(error){
 if(control){const [operations]=await control.db.pool.query<any[]>('SELECT id,forward_id,target_revision,kind,status,cleanup_pending,last_error FROM operations');const [runtime]=await control.db.pool.query<any[]>('SELECT node_id,session_epoch,snapshot_generation,last_report FROM runtime_nodes');const [deployments]=await control.db.pool.query<any[]>('SELECT * FROM relay_deployments');await writeFile(join(directory,'failure.json'),JSON.stringify({error:error instanceof Error?error.message:'Relay failed',operations,runtime,deployments,agents:agents.map(agent=>({nodeId:agent.nodeId,errors:agent.errors??'',exitCode:agent.process.exitCode}))},null,2));console.error(`Failure evidence: ${directory}`);}
 throw error;
}finally{
 releaseReady?.();
 for(const agent of agents){await stopNative(agent.root).catch(()=>{});agent.process.kill();}
 if(targetPID){const command=await linux('/bin/cat',[`/proc/${targetPID}/cmdline`]).catch(()=>undefined);if(command?.stdout.split('\0')[0]===fixture&&command.stdout.split('\0').includes(nativeRoot))await linux('/bin/kill',['-TERM',String(targetPID)]).catch(()=>{});}
 target?.kill();await control?.close();await admin.query(`DROP DATABASE \`${database}\``);await admin.end();
}
