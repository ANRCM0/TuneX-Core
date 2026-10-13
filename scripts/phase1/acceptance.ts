import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { platform,release,arch } from 'node:os';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { request as httpsRequest } from 'node:https';
import { createServer, connect } from 'node:net';
import { once } from 'node:events';
import { mkdir, readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createConnection } from 'mysql2/promise';
import { startControl } from '../../apps/control/src/server.ts';
import { timeProofArguments } from '../time-proof.ts';
import { compileDirect,compileSnapshot } from '../../apps/control/src/modules/runtime/planner.ts';
import type { AuthorizedNodeFacts } from '../../apps/control/src/modules/runtime/planner.ts';
import type { Forward,ForwardSpec } from '@tunex/core';
import { newToken } from '../../apps/control/src/modules/identity.ts';
import { rows, write } from '../../apps/control/src/infrastructure/mysql.ts';
import { parseMessage,digest } from '@tunex/contracts';
import type { HelloResponse, Snapshot } from '@tunex/contracts';

const exec=promisify(execFile);
const databaseUrl=process.env.TUNEX_TEST_DATABASE_URL;
if(!databaseUrl)throw new Error('TUNEX_TEST_DATABASE_URL must point at a disposable MySQL database');
const openssl=process.env.TUNEX_OPENSSL??'openssl';
await mkdir('.artifacts/phase1',{recursive:true});
const directory=await mkdtemp(resolve('.artifacts/phase1/run-'));
const caKey=join(directory,'ca.key'),caCert=join(directory,'ca.pem'),serverKey=join(directory,'server.key'),serverCert=join(directory,'server.pem');
await exec(openssl,['req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',caKey,'-out',caCert,'-days','2','-subj','/CN=TuneX Acceptance CA']);
await exec(openssl,['req','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',serverKey,'-out',join(directory,'server.csr'),'-subj','/CN=localhost']);
await writeFile(join(directory,'server.ext'),'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n');
await exec(openssl,['x509','-req','-in',join(directory,'server.csr'),'-CA',caCert,'-CAkey',caKey,'-set_serial','1','-out',serverCert,'-days','1','-extfile',join(directory,'server.ext')]);
const ca=await readFile(caCert);
const administrator=await createConnection(databaseUrl);
const database=`tunex_test_${randomUUID().replaceAll('-','')}`;
await administrator.query(`CREATE DATABASE \`${database}\``);
const url=new URL(databaseUrl);url.pathname=`/${database}`;
let server:Awaited<ReturnType<typeof startControl>>|undefined;
let agent:ReturnType<typeof spawn>|undefined;
let target:ReturnType<typeof spawn>|undefined;
const checks:string[]=[];
const check=(message:string)=>{checks.push(message);console.log(`PASS ${message}`);};
const scope='scope-test',actor='owner-test',token=newToken();
async function call(method:string,path:string,payload?:unknown,extra:Record<string,string>={},machine?:{cert:Buffer;key:Buffer}):Promise<{status:number;body:any}>{
  const raw=payload===undefined?undefined:JSON.stringify(payload);
  return new Promise((resolve,reject)=>{
    const request=httpsRequest({hostname:'127.0.0.1',port:server!.port,path,method,ca,...machine,headers:{'content-type':'application/json',...(machine?{}:{authorization:`Bearer ${token}`}),...extra}},response=>{
      const chunks:Buffer[]=[];response.on('data',value=>chunks.push(value));response.on('end',()=>{try{resolve({status:response.statusCode!,body:JSON.parse(Buffer.concat(chunks).toString())});}catch(error){reject(error);}});
    });request.on('error',reject);request.end(raw);
  });
}
async function eventually(action:()=>Promise<boolean>,timeout=30000):Promise<void>{const start=Date.now();while(Date.now()-start<timeout){if(await action())return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Acceptance condition timed out');}
async function freePort():Promise<number>{const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=(socket.address() as {port:number}).port;await new Promise<void>(resolve=>socket.close(()=>resolve()));return port;}
const agentPath=resolve('.artifacts',process.platform==='win32'?'tunex-agent.exe':'tunex-agent');
try{
  server=await startControl({databaseUrl:url.toString(),caCert,caKey,serverKey,serverCert,openssl,stateDirectory:join(directory,'control'),initializeAuthority:true,port:0,worker:false});
  await server.control.identity.bootstrap(scope,actor,token);
  target=spawn(process.execPath,['scripts/phase1/echo-target.mjs'],{stdio:['ignore','pipe','pipe']});
  const targetLine=await new Promise<string>((resolve,reject)=>{target!.stdout!.once('data',chunk=>resolve(chunk.toString()));target!.once('error',reject);});
  const targetPort=JSON.parse(targetLine).port as number,port=await freePort(),port2=await freePort(),port3=await freePort();
  const policy={allowedListenerAddresses:['127.0.0.1'],allowedPorts:[port,port2,port3],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false};
  const provision=await call('POST',`/api/v1/scopes/${scope}/nodes`,policy);assert.equal(provision.status,201);
  const {nodeId,enrollmentToken}=provision.body;
  const state=join(directory,'agent'),protection=join(directory,'secrets','journal.key');
  const args=['--control',`https://127.0.0.1:${server.port}`,'--node',nodeId,'--ca',caCert,'--state',state,'--journal-key',protection,...timeProofArguments()];
  await exec(agentPath,[...args,'--enroll'],{env:{...process.env,TUNEX_ENROLLMENT_TOKEN:enrollmentToken}});
  check('SEC-05: trusted enrollment binds one Node certificate');
  agent=spawn(agentPath,args,{stdio:['ignore','pipe','pipe']});let agentLog='';agent.stderr!.on('data',chunk=>{agentLog+=chunk.toString();});
  await eventually(async()=>((await rows<{session_epoch:number}>(server!.db.pool,'SELECT session_epoch FROM runtime_nodes WHERE node_id=?',[nodeId]))[0]!.session_epoch)>0);
  const machine={cert:await readFile(join(state,'node.pem')),key:await readFile(join(state,'private.pem'))};
  const csr=await readFile(join(state,'enrollment.csr'),'utf8');
  const enrollmentReplay=await call('POST','/enrollment/v1',{nodeId,token:enrollmentToken,csr});assert.equal(enrollmentReplay.status,200);assert.equal(enrollmentReplay.body.certificate,machine.cert.toString());
  const enrollmentReuse=await call('POST','/enrollment/v1',{nodeId,token:enrollmentToken,csr:csr+'\n'});assert.equal(enrollmentReuse.status,409);
  check('SEC-05: identical enrollment retries reuse one certificate; changed CSR cannot reuse token');
  const spec:ForwardSpec={enabled:true,protocols:['tcp'],ingress:{nodeId,listen:{address:'127.0.0.1',port}},target:{host:'127.0.0.1',port:targetPort}};
  const accepted=await call('POST',`/api/v1/scopes/${scope}/forwards`,spec,{'idempotency-key':'create-one'});assert.equal(accepted.status,202,JSON.stringify(accepted.body));
  const replay=await call('POST',`/api/v1/scopes/${scope}/forwards`,spec,{'idempotency-key':'create-one'});assert.deepEqual(replay,accepted);
  check('API-01: lost-response retry returns identical persistent resource/operation IDs');
  const conflict=await call('POST',`/api/v1/scopes/${scope}/forwards`,{...spec,target:{...spec.target,port:targetPort+1}},{'idempotency-key':'create-one'});assert.equal(conflict.status,409);assert.equal(conflict.body.code,'IDEMPOTENCY_CONFLICT');
  const parallel=await Promise.all([call('POST',`/api/v1/scopes/${scope}/forwards`,spec,{'idempotency-key':'create-one'}),call('POST',`/api/v1/scopes/${scope}/forwards`,spec,{'idempotency-key':'create-one'})]);assert.deepEqual(parallel,[accepted,accepted]);
  check('API-02: same-key concurrency replays; changed input conflicts');
  const occupied=await call('POST',`/api/v1/scopes/${scope}/forwards`,spec,{'idempotency-key':'port-conflict'});assert.equal(occupied.status,409);assert.equal(occupied.body.code,'PORT_RESERVED');
  const counts=await rows<{n:number}>(server.db.pool,'SELECT COUNT(*) n FROM forwards');assert.equal(counts[0]!.n,1);
  const idempotency=await rows<{n:number}>(server.db.pool,"SELECT COUNT(*) n FROM idempotency WHERE request_key='port-conflict'");assert.equal(idempotency[0]!.n,0);
  check('FWD-08/API-05: conflicting acceptance rolls back intent, slots, Operation and key');
  const crashedClaim=await server.db.transaction(tx=>server!.control.ledger.claim(tx));assert.equal(crashedClaim?.id,accepted.body.operationId);
  await server.db.transaction(tx=>write(tx,'UPDATE operations SET claim_until=? WHERE id=?',[Date.now()-1,accepted.body.operationId]));
  const recovered=await server.db.transaction(tx=>server!.control.ledger.claim(tx));assert.equal(recovered?.id,accepted.body.operationId);assert.notEqual(recovered?.claim_token,crashedClaim?.claim_token);
  await server.db.transaction(tx=>write(tx,'UPDATE operations SET claim_until=? WHERE id=?',[Date.now()-1,accepted.body.operationId]));
  await server.runtime.tick();
  check('OPS-01: persistent scanner rediscovers committed work and fences an expired Worker claim');
  await eventually(async()=>{const result=await call('GET',`/api/v1/scopes/${scope}/operations/${accepted.body.operationId}`);return result.body.status==='succeeded';});
  const resource=await call('GET',`/api/v1/scopes/${scope}/forwards/${accepted.body.forwardId}`);assert.equal(resource.body.health.condition,'ready');assert.equal(resource.body.desired.revision,1);
  check('ADP-11: persistent matching report advances current Operation to succeeded');
  const payload=Buffer.from('TuneX Phase 1 bidirectional TCP\n'+randomUUID());
  await new Promise<void>((resolve,reject)=>{const socket=connect(port,'127.0.0.1');const chunks:Buffer[]=[];socket.setTimeout(5000,()=>socket.destroy(new Error('TCP timeout')));socket.on('error',reject);socket.on('connect',()=>socket.end(payload));socket.on('data',value=>chunks.push(value));socket.on('end',()=>{try{assert.deepEqual(Buffer.concat(chunks),payload);resolve();}catch(error){reject(error);}finally{socket.destroy();}});});
  check('FWD-01: independent Agent/target processes echo exact payload with TCP half-close');
  const foreign=await call('POST','/agent/v2/hello',{protocolVersion:2,nodeId:'foreign-node',bootId:'foreign-boot',agentBuild:'acceptance',capabilities:['tcp','native.direct.v1'],lastStoredSnapshotGeneration:0},{},machine);assert.equal(foreign.status,403);
  const noCert=await call('GET','/agent/v2/snapshot');assert.equal(noCert.status,401);
  check('ADP-05: absent client certificate and foreign Node identity are rejected');
  const stateRow=(await rows<{session_epoch:number;last_report:unknown}>(server.db.pool,'SELECT session_epoch,last_report FROM runtime_nodes WHERE node_id=?',[nodeId]))[0]!;
  const report=typeof stateRow.last_report==='string'?JSON.parse(stateRow.last_report):stateRow.last_report;
  const duplicate=await call('POST','/agent/v2/report',report,{'x-tunex-session-epoch':String(stateRow.session_epoch)},machine);assert.equal(duplicate.status,200);assert.equal(duplicate.body.status,'duplicate');
  const changed=await call('POST','/agent/v2/report',{...report,observedAt:'2026-10-12T00:00:00Z'},{'x-tunex-session-epoch':String(stateRow.session_epoch)},machine);assert.equal(changed.status,409);assert.equal(changed.body.code,'INTEGRITY_FAILURE');
  check('ADP-11: ACK loss replays durable duplicate; changed report body is rejected');
  const snapshot=await call('GET','/agent/v2/snapshot',undefined,{'x-tunex-session-epoch':String(stateRow.session_epoch)},machine);parseMessage('Snapshot',JSON.stringify(snapshot.body));
  const snapshotMessage=snapshot.body as Snapshot;
  const helloInput={protocolVersion:2,nodeId,bootId:'test-new-boot',agentBuild:'acceptance',capabilities:['tcp','native.direct.v1'],lastStoredSnapshotGeneration:snapshotMessage.snapshotGeneration};
  const newSession=await call('POST','/agent/v2/hello',helloInput,{},machine);assert.equal(newSession.status,200);const hello=newSession.body as HelloResponse;assert.equal(hello.sessionEpoch,stateRow.session_epoch+1);
  const oldReport=await call('POST','/agent/v2/report',report,{'x-tunex-session-epoch':String(stateRow.session_epoch)},machine);assert.equal(oldReport.status,409);
  check('ADP-10: new boot retires old report authority');
  const scopeB='scope-other',actorB='owner-other',tokenB=newToken();await server.control.identity.bootstrap(scopeB,actorB,tokenB);
  const denied=await call('GET',`/api/v1/scopes/${scope}/forwards/${accepted.body.forwardId}`,undefined,{authorization:`Bearer ${tokenB}`});assert.equal(denied.status,404);
  check('FWD-06: foreign scope identity receives non-disclosing 404');
  const concurrentSpec={...spec,ingress:{...spec.ingress,listen:{address:'127.0.0.1',port:port2}}};
  const sameKey=await Promise.all([call('POST',`/api/v1/scopes/${scope}/forwards`,concurrentSpec,{'idempotency-key':'parallel-new'}),call('POST',`/api/v1/scopes/${scope}/forwards`,concurrentSpec,{'idempotency-key':'parallel-new'})]);assert.equal(sameKey[0]!.status,202);assert.deepEqual(sameKey[0],sameKey[1]);
  check('API-02: two first-time concurrent writes create exactly one intent');
  const failingSpec={...spec,ingress:{...spec.ingress,listen:{address:'127.0.0.1',port:port3}}};
  await server.db.pool.query("CREATE TRIGGER acceptance_failure BEFORE INSERT ON operations FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected acceptance failure'");
  const failing=await call('POST',`/api/v1/scopes/${scope}/forwards`,failingSpec,{'idempotency-key':'injected-failure'});assert.equal(failing.status,503);
  const rolledBack=await rows<{n:number}>(server.db.pool,'SELECT COUNT(*) n FROM port_slots WHERE port=?',[port3]);assert.equal(rolledBack[0]!.n,0);
  await server.db.pool.query('DROP TRIGGER acceptance_failure');
  const recoveredWrite=await call('POST',`/api/v1/scopes/${scope}/forwards`,failingSpec,{'idempotency-key':'injected-failure'});assert.equal(recoveredWrite.status,202);
  check('API-05: post-intent fault rolls back every owner and the same key remains retryable');
  await server.db.transaction(tx=>write(tx,'UPDATE operations SET execution_deadline=? WHERE id=?',[Date.now()-1,recoveredWrite.body.operationId]));
  await server.runtime.tick();const expired=await call('GET',`/api/v1/scopes/${scope}/operations/${recoveredWrite.body.operationId}`);assert.equal(expired.body.status,'failed');
  check('API-04: execution deadline creates a stable failed terminal state');
  const forbidden=await call('POST',`/api/v1/scopes/${scope}/forwards`,{...spec,ingress:{...spec.ingress,listen:{address:'0.0.0.0',port:port3}}},{'idempotency-key':'not-authorized'});assert.equal(forbidden.status,403);assert.equal(forbidden.body.code,'AUTHORIZATION_DENIED');assert.equal(forbidden.body.retryable,false);
  check('FWD-06: rejected Node listener policy returns a permanent authorization error');
  const snapshotRecord=(await rows<{body:unknown}>(server.db.pool,'SELECT body FROM snapshots WHERE node_id=? AND generation=?',[nodeId,snapshotMessage.snapshotGeneration]))[0]!;
  const expiredBody=(typeof snapshotRecord.body==='string'?JSON.parse(snapshotRecord.body):snapshotRecord.body) as Snapshot;
  expiredBody.issuedAt=new Date(Date.now()-400000).toISOString();expiredBody.validUntil=new Date(Date.now()-100000).toISOString();const {snapshotDigest:omitted,...expiredContent}=expiredBody;void omitted;expiredBody.snapshotDigest=digest(expiredContent);
  await server.db.transaction(tx=>write(tx,'UPDATE snapshots SET body=?,valid_until=? WHERE node_id=? AND generation=?',[JSON.stringify(expiredBody),Date.parse(expiredBody.validUntil),nodeId,snapshotMessage.snapshotGeneration]));
  const latest=await call('GET','/agent/v2/snapshot',undefined,{'x-tunex-session-epoch':String(hello.sessionEpoch)},machine);assert.equal(latest.status,200);
  const lateReport={...report,bootId:helloInput.bootId,sessionEpoch:hello.sessionEpoch,reportSequence:1,acceptedSnapshotGeneration:latest.body.snapshotGeneration};
  const freshAck=await call('POST','/agent/v2/report',lateReport,{'x-tunex-session-epoch':String(hello.sessionEpoch)},machine);assert.equal(freshAck.status,200);
  // Isolated fault injection: make the reported authorization expired while leaving a newer published lease live.
  const reported=structuredClone(latest.body) as Snapshot;reported.issuedAt=new Date(Date.now()-400000).toISOString();reported.validUntil=new Date(Date.now()-100000).toISOString();const {snapshotDigest:ignored,...reportedContent}=reported;void ignored;reported.snapshotDigest=digest(reportedContent);
  await server.db.transaction(tx=>write(tx,'UPDATE snapshots SET body=?,valid_until=? WHERE node_id=? AND generation=?',[JSON.stringify(reported),Date.parse(reported.validUntil),nodeId,reported.snapshotGeneration]));
  const renewed=await call('GET','/agent/v2/snapshot',undefined,{'x-tunex-session-epoch':String(hello.sessionEpoch)},machine);assert.ok(renewed.body.snapshotGeneration>reported.snapshotGeneration);
  await exec(process.execPath,['apps/control/src/client.ts','get',scope,accepted.body.forwardId],{env:{...process.env,TUNEX_CONTROL_URL:`https://127.0.0.1:${server.port}`,TUNEX_CA_CERT:caCert,TUNEX_OWNER_TOKEN:token}});
  check('Phase 1 CLI: trusted HTTPS resource query is usable independently of the test client');
  const late=await call('POST','/agent/v2/report',{...lateReport,reportSequence:2}, {'x-tunex-session-epoch':String(hello.sessionEpoch)},machine);assert.equal(late.status,200);
  const unknown=await call('GET',`/api/v1/scopes/${scope}/forwards/${accepted.body.forwardId}`);assert.equal(unknown.body.health.condition,'unknown');
  check('ADP-07: expired reported authorization cannot borrow a newer published lease for health');
  const blocking=await server.db.pool.getConnection();await blocking.beginTransaction();
  await blocking.execute('SELECT * FROM runtime_nodes WHERE node_id=? FOR UPDATE',[nodeId]);
  const recoveringId=sameKey[0]!.body.operationId as string;
  await write(server.db.pool,'UPDATE operations SET status=\'running\',claim_token=NULL,claim_until=NULL WHERE id=?',[recoveringId]);
  const waitingWorker=server.runtime.tick();
  await eventually(async()=>Boolean((await rows<{claim_token:string|null}>(server!.db.pool,'SELECT claim_token FROM operations WHERE id=?',[recoveringId]))[0]?.claim_token));
  await write(blocking,'UPDATE operations SET status=\'failed\' WHERE id=?',[recoveringId]);await blocking.commit();blocking.release();await waitingWorker;
  const afterWorker=(await rows<{snapshot_generation:number}>(server.db.pool,'SELECT snapshot_generation FROM runtime_nodes WHERE node_id=?',[nodeId]))[0]!;
  assert.equal(afterWorker.snapshot_generation,renewed.body.snapshotGeneration);
  check('OPS-01: blocked Worker sees the current failed Operation after the Node lock is released');
  const capacityScope='capacity-scope',capacityActor='capacity-owner',capacityToken=newToken();await server.control.identity.bootstrap(capacityScope,capacityActor,capacityToken);
  const capacityNode='capacity-node',cidrs=Array.from({length:256},(_,i)=>`2001:db8:ffff:ffff:ffff:ffff:ffff:${(0x1000+i).toString(16)}/128`);
  const capacitySpec={...spec,target:{host:'2001:db8:ffff:ffff:ffff:ffff:ffff:1000',port:443}};
  const capacityFacts:AuthorizedNodeFacts={nodeId:capacityNode,scopeId:capacityScope,capabilities:['tcp','native.direct.v1'],allowedListenerAddresses:['127.0.0.1'],allowedPorts:Array.from({length:1000},(_,i)=>10000+i),egressPolicyRevision:1,allowedDestinationCidrs:cidrs,allowMetadataTargets:false};
  const largeAssignments:Snapshot['assignments']=[];let validCount=0;
  for(let i=0;i<1000;i++){
    const intent:Forward={id:`capacity-${i}`,scopeId:capacityScope,revision:1,spec:{...capacitySpec,ingress:{nodeId:capacityNode,listen:{address:'127.0.0.1',port:10000+i}}}};
    largeAssignments.push(...compileDirect(intent,capacityFacts,[{nodeId:capacityNode,forwardId:intent.id,protocol:'tcp',port:10000+i,bindingFence:1,deploymentGeneration:1}]));
    try{compileSnapshot({nodeId:capacityNode,sessionEpoch:Number.MAX_SAFE_INTEGER,snapshotGeneration:Number.MAX_SAFE_INTEGER,issuedAt:'2026-10-12T08:00:00.000Z',validUntil:'2026-10-12T08:05:00.000Z',assignments:largeAssignments,tombstones:[]});validCount++;}
    catch{break;}
  }
  assert.ok(validCount>0&&validCount<1000);
  await server.db.transaction(async tx=>{
    await write(tx,'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts) VALUES(?,?,?,?,?,?)',[capacityNode,capacityScope,'a'.repeat(64),Date.now()+600000,Date.now()+86400000,JSON.stringify(capacityFacts)]);
    await write(tx,'INSERT INTO runtime_nodes(node_id) VALUES(?)',[capacityNode]);await write(tx,'INSERT INTO node_grants(node_id,actor_id) VALUES(?,?)',[capacityNode,capacityActor]);
    for(let i=0;i<validCount;i++){
      const forward:Forward={id:`capacity-${i}`,scopeId:capacityScope,revision:1,spec:{...capacitySpec,ingress:{nodeId:capacityNode,listen:{address:'127.0.0.1',port:10000+i}}}};
      await server!.control.forwarding.insert(tx,forward,capacityActor);
      await server!.control.ledger.accept(tx,forward,{scopeId:capacityScope,actorId:capacityActor,key:`seed-${i}`,digest:digest({seed:i})});
      await write(tx,'INSERT INTO port_slots(node_id,protocol,port,owner_id,fence,deployment_generation) VALUES(?,\'tcp\',?,?,1,1)',[capacityNode,10000+i,forward.id]);
    }
  });
  const tooLarge=await call('POST',`/api/v1/scopes/${capacityScope}/forwards`,{...capacitySpec,ingress:{nodeId:capacityNode,listen:{address:'127.0.0.1',port:10000+validCount}}},{authorization:`Bearer ${capacityToken}`,'idempotency-key':'over-capacity'});
  assert.equal(tooLarge.status,429);assert.equal(tooLarge.body.code,'RESOURCE_LIMIT');assert.equal((await rows<{n:number}>(server.db.pool,'SELECT COUNT(*) n FROM forwards WHERE scope_id=?',[capacityScope]))[0]!.n,validCount);
  check('ADP-15: full prospective snapshot byte capacity is checked before atomic acceptance');
  assert.ok(!agentLog.includes('PERSISTENCE_FAILURE'),agentLog);
  const commit=(await exec('git',['rev-parse','HEAD'])).stdout.trim();const agentSHA=createHash('sha256').update(await readFile(agentPath)).digest('hex');
  const databaseVersion=(await rows<{version:string}>(server.db.pool,'SELECT VERSION() version'))[0]!.version;
  const workingTreeDirty=Boolean((await exec('git',['status','--porcelain'])).stdout.trim());
  await writeFile(join(directory,'evidence.json'),JSON.stringify({status:'verified-local',commit,workingTreeDirty,command:'npm run test:phase1',agentSHA,protocolVersion:2,schema:'adp-v2-direct',snapshotGeneration:snapshotMessage.snapshotGeneration,environment:{platform:platform(),kernel:release(),arch:arch(),node:process.version,mysql:databaseVersion},topology:'MySQL + HTTPS Control + independent Go Agent process + independent TCP echo process + client',checks},null,2));
  console.log(`Phase 1 local acceptance passed: ${checks.length} checks. Evidence ${directory}`);
}finally{
  if(agent){agent.kill();await once(agent,'exit').catch(()=>{});}
  if(target){target.kill();await once(target,'exit').catch(()=>{});}
  await server?.close();
  await administrator.query(`DROP DATABASE \`${database}\``);await administrator.end();
}
