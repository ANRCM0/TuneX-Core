import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { request } from 'node:https';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join,dirname } from 'node:path';
import { createConnection } from 'mysql2/promise';
import { startControl } from '../../apps/control/src/server.ts';
import { newToken } from '../../apps/control/src/modules/identity.ts';
import { backupDatabase,restoreDatabase } from '../ops/recovery.ts';
import { trustDigest } from '../../apps/control/src/infrastructure/authority.ts';
import { DEFAULT_POLICY } from '@tunex/contracts';
import { host,linuxPath,linux,spawnLinux,linuxBinary,mysqlClient,recoveryClock,topology } from './native-linux.ts';
const execute = promisify(execFile);
const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL;
if (!databaseUrl)
    throw new Error('Disposable MySQL URL required');
const openssl = process.env.TUNEX_OPENSSL ?? 'openssl';
await mkdir('.artifacts/recovery', { recursive: true });
const directory = await mkdtemp(resolve('.artifacts/recovery/run-'));
const caKey = join(directory, 'ca.key'), caCert = join(directory, 'ca.pem'), serverKey = join(directory, 'server.key'), serverCert = join(directory, 'server.pem');
await execute(openssl, ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', caKey, '-out', caCert, '-days', '2', '-subj', '/CN=Linux Agent Acceptance CA']);
await execute(openssl, ['req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', serverKey, '-out', join(directory, 'server.csr'), '-subj', '/CN=localhost']);
await writeFile(join(directory, 'server.ext'), `subjectAltName=IP:${host}\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n`);
await execute(openssl, ['x509', '-req', '-in', join(directory, 'server.csr'), '-CA', caCert, '-CAkey', caKey, '-set_serial', '1', '-out', serverCert, '-days', '1', '-extfile', join(directory, 'server.ext')]);
const admin = await createConnection(databaseUrl), database = `tunex_linux_${randomUUID().replaceAll('-', '')}`;
await admin.query(`CREATE DATABASE \`${database}\``);
const dbUrl = new URL(databaseUrl);
dbUrl.pathname = `/${database}`;
let control: Awaited<ReturnType<typeof startControl>> | undefined, agent: ChildProcess | undefined, target: ChildProcess | undefined, monitor: ChildProcess | undefined, targetPID: number | undefined;
const token = newToken(), scope = 'linux-scope', owner = 'linux-owner', ca = await readFile(caCert), checks: string[] = [];
const binary = linuxBinary('tunex-agent'), fixture = linuxBinary('network-fixture'), collector = linuxBinary('time-proof');
const nativeRoot = `/tmp/tunex-linux-${randomUUID()}`;
const runtimePolicy = { ...DEFAULT_POLICY, pollIntervalSeconds: 1, leaseSeconds: 18, renewalLeadSeconds: 8 };
const serverOptions = { databaseUrl: dbUrl.toString(), caCert, caKey, serverKey, serverCert, openssl, stateDirectory: join(directory, 'control'), initializeAuthority:true, port: 0, host, policy: runtimePolicy };
async function call(method: string, path: string, input?: unknown) { const body = input === undefined ? undefined : JSON.stringify(input); return new Promise<{
    status: number;
    body: any;
}>((resolve, reject) => { const req = request({ hostname: host, port: control!.port, path, method, ca, agent: false, timeout: 10000, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID(), ...(body ? { 'content-length': String(Buffer.byteLength(body)) } : {}) } }, res => { const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => { try {
    resolve({ status: res.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()) });
}
catch (error) {
    reject(error);
} }); }); req.on('timeout', () => req.destroy(new Error('Control timeout'))); req.on('error', reject); req.end(body); }); }
async function until(action: () => Promise<boolean>) { const start = Date.now(); while (Date.now() - start < 45000) {
    if (await action())
        return;
    await new Promise(resolve => setTimeout(resolve, 100));
} throw new Error('Linux Agent acceptance timed out'); }
function passed(text: string) { checks.push(text); console.log(`PASS ${text}`); }
try {
    const observed = JSON.parse((await linux(collector)).stdout);
    assert.equal(observed.source, 'linux-adjtimex');
    assert.equal(observed.synchronized, true);
    assert.ok(observed.maxErrorNanos < 5e9);
    passed('Linux OS time: synchronized kernel state and bounded error obtained without changing time');
    control = await startControl(serverOptions);
    await control.control.identity.bootstrap(scope, owner, token);
    target = spawnLinux(fixture, ['--mode', 'target', '--run-id', nativeRoot]);
    const targetStatus = JSON.parse(await new Promise<string>((resolve, reject) => { target!.stdout!.once('data', data => resolve(data.toString())); target!.once('error', reject); }));
    assert.equal(targetStatus.platform, 'linux');
    targetPID = targetStatus.pid;
    assert.equal(targetStatus.runId, nativeRoot);
    const portStatus = JSON.parse((await linux(fixture, ['--mode', 'port'])).stdout);
    assert.equal(portStatus.platform, 'linux');
    const provision = await call('POST', `/api/v1/scopes/${scope}/nodes`, { allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [portStatus.port], egressPolicyRevision: 1, allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false });
    assert.equal(provision.status, 201);
    const nodeId = provision.body.nodeId as string;
    const args = ['--control', `https://${host}:${control.port}`, '--node', nodeId, '--ca', linuxPath(caCert), '--state', `${nativeRoot}/state`, '--journal-key', `${nativeRoot}/secrets/journal.key`];
    try {
        await linux('env', [`TUNEX_ENROLLMENT_TOKEN=${provision.body.enrollmentToken}`, binary, ...args, '--enroll']);
    }
    catch {
        throw new Error('Linux enrollment rejected or Control interface unreachable; token is redacted');
    }
    agent = spawnLinux(binary, [...args, '--probe-registration']);
    let errors = '';
    agent.stderr!.on('data', data => { errors += data.toString(); });
    await until(async () => { const [records] = await control!.db.pool.query<any[]>('SELECT session_epoch FROM runtime_nodes WHERE node_id=?', [nodeId]); return records[0].session_epoch > 0; });
    const spec = { enabled: true, protocols: ['tcp', 'udp'], ingress: { nodeId, listen: { address: '127.0.0.1', port: portStatus.port } }, target: { host: '127.0.0.1', port: targetStatus.port } };
    const created = await call('POST', `/api/v1/scopes/${scope}/forwards`, spec);
    assert.equal(created.status, 202);
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${created.body.operationId}`)).body.status === 'succeeded');
    const probe = JSON.parse((await linux(fixture, ['--mode', 'probe', '--port', String(portStatus.port)])).stdout);
    assert.equal(probe.tcp, true);
    assert.equal(probe.udp, true);
    passed('Linux Agent: real mTLS Control/MySQL acceptance produces exact native TCP/UDP payloads');

    const recoveryProfile=await call('PUT',`/api/v1/scopes/${scope}/transport-profiles/recovery-profile`,{expectedRevision:0,config:{driver:'native.relay.v1',wireVersion:1,security:'mutual-tls13',protocols:['tcp','udp'],handshakeTimeoutSeconds:5,idleTimeoutSeconds:60,maxFrameBytes:65536,maxUdpDatagramBytes:16384,maxConnectionsPerNode:4096}});assert.equal(recoveryProfile.status,202);
    await control.db.pool.query('INSERT INTO node_relay_credentials(fingerprint,node_id,issued_at,valid_until,certificate) VALUES(?,?,?,?,?)',['a'.repeat(64),nodeId,Date.now(),Date.now()+60000,'recovery-fixture-public-certificate']);
    await until(async () => {
        const [current] = await control!.db.pool.query<any[]>("SELECT expires_at FROM probe_instances WHERE node_id=? AND state='registered'", [nodeId]);
        return current.length === 1 && current[0].expires_at > Date.now();
    });
    const [probeRows] = await control.db.pool.query<any[]>('SELECT generation,instance_id FROM probe_instances WHERE node_id=?', [nodeId]);
    const probeRegistration = { generation: probeRows[0].generation, instanceId: probeRows[0].instance_id };
    passed('Probe registration: opt-in real Agent registers over mTLS while Direct TCP/UDP forwarding remains operational');
    let recoveryPermit: { id: string; issuedAt: number } | undefined;
    await until(async () => {
        const [current] = await control!.db.pool.query<any[]>(
            "SELECT generation,instance_id FROM probe_instances WHERE node_id=? AND state='registered' AND expires_at>?", [nodeId, Date.now() + 5000]);
        if (!current[0]) return false;
        try {
            recoveryPermit = await control!.control.probePermits.issue(owner, scope, created.body.forwardId,
                { version: 1, kind: 'tcp-connect', expectedRevision: 1,
                    instanceId: current[0].instance_id, instanceGeneration: current[0].generation });
            return true;
        } catch (error) {
            if ((error as { code?: string }).code === 'PROBE_PERMIT_UNAVAILABLE') return false;
            throw error;
        }
    });
    assert.ok(recoveryPermit);
    passed('Internal Probe permit: current Actor/Forward/registered Agent binding accepted without remote execution');
    const manifest=await backupDatabase({databaseUrl:dbUrl.toString(),authority:control.authority,directory:join(directory,'backups'),mysqldump:mysqlClient('mysqldump')});
    const backupEnvelope=JSON.parse(await readFile(manifest,'utf8'));assert.equal(backupEnvelope.payload.forwardCount,1);const originalJournal=JSON.parse((await linux('/bin/cat',[`${nativeRoot}/state/journal.json`])).stdout);const originalGeneration=originalJournal.payload.generation;
    passed('Backup: actual single-transaction MySQL dump and protected MAC manifest capture the running intent');
    const changed=await call('PUT',`/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`,{expectedRevision:1,spec:{...spec,target:{...spec.target,port:targetStatus.port+1}}});assert.equal(changed.status,202);await until(async()=>(await call('GET',`/api/v1/scopes/${scope}/operations/${changed.body.operationId}`)).body.status==='succeeded');
    const newerJournal=JSON.parse((await linux('/bin/cat',[`${nativeRoot}/state/journal.json`])).stdout);assert.ok(newerJournal.payload.generation>originalGeneration);
    const [currentRows]=await control.db.pool.query<any[]>('SELECT snapshot_generation FROM runtime_nodes WHERE node_id=?',[nodeId]);const newerGeneration=currentRows[0].snapshot_generation;
    assert.ok((await control.authority.read()).latestValidUntil!==null);await control.authority.maintain();assert.equal((await call('GET','/health')).body.status,'maintenance');assert.equal((await call('POST',`/api/v1/scopes/${scope}/forwards`,spec)).status,503);
    const [stoppedRows]=await control.db.pool.query<any[]>('SELECT snapshot_generation FROM runtime_nodes WHERE node_id=?',[nodeId]);await control.runtime.tick().catch(()=>{});const [stillRows]=await control.db.pool.query<any[]>('SELECT snapshot_generation FROM runtime_nodes WHERE node_id=?',[nodeId]);assert.equal(stillRows[0].snapshot_generation,stoppedRows[0].snapshot_generation);
    const independent=control.authority;await control.close();control=undefined;passed('Maintenance: HTTP acceptance and Worker authorization are stopped before database recovery');
    const nextCa=join(directory,'new-ca.pem'),nextKey=join(directory,'new-ca.key'),nextServerKey=join(directory,'new-server.key'),nextServerCert=join(directory,'new-server.pem');
    await execute(openssl,['req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',nextKey,'-out',nextCa,'-days','2','-subj','/CN=Recovered Node Trust']);
    await execute(openssl,['req','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',nextServerKey,'-out',join(directory,'new-server.csr'),'-subj','/CN=localhost']);await execute(openssl,['x509','-req','-in',join(directory,'new-server.csr'),'-CA',nextCa,'-CAkey',nextKey,'-set_serial','2','-out',nextServerCert,'-days','1','-extfile',join(directory,'server.ext')]);
    const recoveredName=`tunex_recovered_${randomUUID().replaceAll('-','')}`;
    const restoreOptions={sourceDatabaseUrl:dbUrl.toString(),targetDatabase:recoveredName,manifest,authority:independent,newTrustDigest:trustDigest(await readFile(nextCa)),mysql:mysqlClient('mysql'),credentialsDirectory:join(directory,'recovery-secrets'),issuersStopped:true,...recoveryClock};
    let refused=false;try{await restoreDatabase(restoreOptions);}catch(error){refused=String(error).includes('RECOVERY_NOT_READY');}assert.equal(refused,true);passed('Recovery fence: old backup cannot be restored before independently recorded authorization has expired');
    const beforeTrust=await independent.read();await until(async()=>{const checked=JSON.parse((await linux(collector,['--check'])).stdout);return Date.parse(checked.checkedAt)-checked.maxSkewSeconds*1000>beforeTrust.latestValidUntil!+beforeTrust.maxClockSkewSeconds*1000;});
    await assert.rejects(()=>restoreDatabase({...restoreOptions,targetDatabase:database}),/source database/);
    const damagedDirectory=join(directory,'damaged-backup');await mkdir(damagedDirectory,{recursive:true});const damagedManifest=join(damagedDirectory,'manifest.json');await writeFile(damagedManifest,await readFile(manifest));const originalSQL=await readFile(join(dirname(manifest),backupEnvelope.payload.sqlFile));await writeFile(join(damagedDirectory,backupEnvelope.payload.sqlFile),Buffer.concat([originalSQL,Buffer.from('\n-- tampered\n')]));await assert.rejects(()=>restoreDatabase({...restoreOptions,manifest:damagedManifest}),/integrity failure/);
    passed('Backup integrity: changed SQL is refused and restore cannot overwrite its source database');
    const restored=await restoreDatabase(restoreOptions);const ownerVault=JSON.parse(await readFile(restored.ownerCredentials,'utf8'));const recoveredToken=ownerVault.owners.find((row:any)=>row.actorId===owner).token as string;
    await assert.rejects(()=>startControl({...serverOptions,initializeAuthority:false}),/binding differs/);
    const restoredAdmin=await createConnection(restored.databaseUrl);try{
        const [oldState]=await restoredAdmin.query<any[]>('SELECT snapshot_generation FROM runtime_nodes WHERE node_id=?',[nodeId]);assert.equal(oldState[0].snapshot_generation,originalGeneration);assert.ok(oldState[0].snapshot_generation<newerGeneration);
        const [oldProbe] = await restoredAdmin.query<any[]>('SELECT generation,instance_id,state,revoked_at FROM probe_instances WHERE node_id=?', [nodeId]);
        // The live Agent may rotate between observation and the dump's consistent snapshot.
        assert.ok(oldProbe[0].generation >= probeRegistration.generation);
        if (oldProbe[0].generation === probeRegistration.generation) assert.equal(oldProbe[0].instance_id, probeRegistration.instanceId);
        assert.match(oldProbe[0].instance_id, /^[a-f0-9]{64}$/);
        assert.equal(oldProbe[0].state, 'quarantined'); assert.ok(oldProbe[0].revoked_at > 0);
        const [oldPermits] = await restoredAdmin.query<any[]>('SELECT id,state,closed_at FROM probe_permits WHERE id=?', [recoveryPermit.id]);
        assert.equal(oldPermits.length, 1); assert.equal(oldPermits[0].state, 'quarantined'); assert.ok(oldPermits[0].closed_at > 0);
        const [permitBudget] = await restoredAdmin.query<any[]>('SELECT observed_at FROM probe_permit_budget WHERE id=1');
        assert.equal(permitBudget[0].observed_at, recoveryPermit.issuedAt);
        const [profileHistory]=await restoredAdmin.query<any[]>("SELECT COUNT(*) n FROM transport_profile_revisions WHERE profile_id='recovery-profile'");assert.equal(profileHistory[0].n,1);const [profileGrants]=await restoredAdmin.query<any[]>('SELECT COUNT(*) n FROM transport_profile_grants');assert.equal(profileGrants[0].n,0);const [retiredPeerCredentials]=await restoredAdmin.query<any[]>('SELECT COUNT(*) n FROM node_relay_credentials WHERE revoked=FALSE');assert.equal(retiredPeerCredentials[0].n,0);
        const [quarantine]=await restoredAdmin.query<any[]>('SELECT revoked FROM nodes WHERE id=?',[nodeId]);assert.equal(quarantine[0].revoked,1);const [intents]=await restoredAdmin.query<any[]>('SELECT revision,spec,recovery_suspended FROM forwards WHERE id=?',[created.body.forwardId]);assert.equal(intents[0].revision,1);assert.equal(intents[0].spec.target.port,targetStatus.port);assert.equal(intents[0].recovery_suspended,1);
    }finally{await restoredAdmin.end();}
    passed('Old backup recovery: actual lower-generation data is restored without clearing Agent high-water; all old trust/history is quarantined');
    const oldControl=serverOptions;control=await startControl({...oldControl,databaseUrl:restored.databaseUrl,caCert:nextCa,caKey:nextKey,serverKey:nextServerKey,serverCert:nextServerCert,initializeAuthority:false});
    const newCa=await readFile(nextCa);async function recoveredCall(method:string,path:string,input?:unknown,bearer=recoveredToken,requestKey:string=randomUUID()){
        const raw=input===undefined?undefined:JSON.stringify(input);return new Promise<{status:number;body:any}>((resolve,reject)=>{const req=request({hostname:host,port:control!.port,path,method,ca:newCa,agent:false,headers:{authorization:`Bearer ${bearer}`,'idempotency-key':requestKey,'content-type':'application/json',...(raw?{'content-length':String(Buffer.byteLength(raw))}:{})}},response=>{const chunks:Buffer[]=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{try{resolve({status:response.statusCode!,body:JSON.parse(Buffer.concat(chunks).toString())});}catch(error){reject(error);}});});req.on('error',reject);req.end(raw);});}
    assert.equal((await recoveredCall('GET','/health')).body.status,'maintenance');assert.equal((await recoveredCall('POST',`/api/v1/scopes/${scope}/nodes`,{})).status,503);await assert.rejects(()=>independent.resume(),/review/);await independent.resume(restored.recoveryId);
    assert.equal((await recoveredCall('GET',`/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`,undefined,token)).status,401);const recoveredResource=await recoveredCall('GET',`/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`);assert.equal(recoveredResource.body.desired.recoverySuspended,true);assert.equal(recoveredResource.body.lastOperation.recoveryInvalidated,true);assert.equal(recoveredResource.body.health.condition,'unknown');
    const oldCertificate=Buffer.from((await linux('/bin/cat',[`${nativeRoot}/state/node.pem`])).stdout);const oldPrivateKey=Buffer.from((await linux('/bin/cat',[`${nativeRoot}/state/private.pem`])).stdout);
    const oldIdentityStatus=await new Promise<number>((resolve,reject)=>{const req=request({hostname:host,port:control!.port,path:'/agent/v3/hello',method:'POST',ca:newCa,cert:oldCertificate,key:oldPrivateKey,agent:false},response=>{response.resume();response.on('end',()=>resolve(response.statusCode!));});req.on('error',reject);req.end();});assert.equal(oldIdentityStatus,401);
    const [requestHistory]=await control.db.pool.query<any[]>('SELECT idempotency_key FROM operations WHERE id=?',[created.body.operationId]);const oldReplay=await recoveredCall('POST',`/api/v1/scopes/${scope}/forwards`,spec,recoveredToken,requestHistory[0].idempotency_key);assert.equal(oldReplay.status,409);assert.equal(oldReplay.body.code,'RECOVERY_REPLAY_REQUIRES_REVIEW');
    passed('Review gate: restart stays in maintenance; retired user credentials and recovered observations are not treated as current facts');
    const newNode=await recoveredCall('POST',`/api/v1/scopes/${scope}/nodes`,{allowedListenerAddresses:['127.0.0.1'],allowedPorts:[portStatus.port],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false});assert.equal(newNode.status,201);assert.notEqual(newNode.body.nodeId,nodeId);
    const newRoot=`${nativeRoot}/recovered`;const newArgs=['--control',`https://${host}:${control.port}`,'--node',newNode.body.nodeId,'--ca',linuxPath(nextCa),'--state',`${newRoot}/state`,'--journal-key',`${newRoot}/secrets/journal.key`];
    try{await linux('env',[`TUNEX_ENROLLMENT_TOKEN=${newNode.body.enrollmentToken}`,binary,...newArgs,'--enroll']);}catch{throw new Error('Recovered Node enrollment failed; token redacted');}
    agent=spawnLinux(binary,newArgs);await until(async()=>{const [rows]=await control!.db.pool.query<any[]>('SELECT session_epoch FROM runtime_nodes WHERE node_id=?',[newNode.body.nodeId]);return rows[0].session_epoch>0;});
    const rebound=await recoveredCall('PUT',`/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`,{expectedRevision:1,spec:{...spec,ingress:{nodeId:newNode.body.nodeId,listen:{address:'127.0.0.1',port:portStatus.port}}}});assert.equal(rebound.status,202,JSON.stringify(rebound.body));assert.equal(rebound.body.revision,2);await until(async()=>(await recoveredCall('GET',`/api/v1/scopes/${scope}/operations/${rebound.body.operationId}`)).body.status==='succeeded');
    const recoveredProbe=JSON.parse((await linux(fixture,['--mode','probe','--port',String(portStatus.port)])).stdout);assert.equal(recoveredProbe.tcp,true);assert.equal(recoveredProbe.udp,true);const unchangedOldJournal=JSON.parse((await linux('/bin/cat',[`${nativeRoot}/state/journal.json`])).stdout);assert.equal(unchangedOldJournal.payload.generation,newerJournal.payload.generation);
    passed('Fresh trust recovery: new Node identity and explicit Forward revision restore exact TCP/UDP payload without resetting retired identity state');
    const commit=(await execute('git',['rev-parse','HEAD'])).stdout.trim();await writeFile(join(directory,'evidence.json'),JSON.stringify({commit,workingTreeDirty:Boolean((await execute('git',['status','--porcelain'])).stdout.trim()),command:'npm run test:recovery',checks,oldGeneration:originalGeneration,agentHighWater:newerGeneration,recoveredGeneration:originalGeneration,recoveryId:restored.recoveryId,protectedCutoff:beforeTrust.latestValidUntil,newNodeId:newNode.body.nodeId,agentSHA:createHash('sha256').update(await readFile(process.platform==='win32'?'.artifacts/tunex-agent-linux':binary)).digest('hex'),kernel:(await linux('/bin/uname',['-a'])).stdout.trim(),topology:`${topology}; old/new CA trust`},null,2));console.log(`Recovery passed: ${checks.length} checks. Evidence ${directory}`);
    await control.close();control=undefined;await admin.query(`DROP DATABASE \`${recoveredName}\``);
}
finally {
    // Kill only this run's native processes via their unique command line; do not touch existing services.
    if (agent) {
        const candidates = await linux('/usr/bin/pgrep', ['-f', nativeRoot]).catch(() => undefined);
        for (const line of candidates?.stdout.trim().split('\n') ?? []) {
            if (!/^[1-9][0-9]*$/.test(line))
                continue;
            const command = await linux('/bin/cat', [`/proc/${line}/cmdline`]).catch(() => undefined);
            const fields = command?.stdout.split('\0');
            if (fields?.[0] === binary && (fields.includes(`${nativeRoot}/state`)||fields.includes(`${nativeRoot}/recovered/state`)))
                await linux('/bin/kill', ['-TERM', line]).catch(() => { });
        }
    }
    if (targetPID) {
        const command = await linux('/bin/cat', [`/proc/${targetPID}/cmdline`]).catch(() => undefined);
        if (command?.stdout.split('\0').includes(nativeRoot) && command.stdout.split('\0')[0] === fixture)
            await linux('/bin/kill', ['-TERM', String(targetPID)]);
    }
    if (target) {
        target.kill();
    }
    monitor?.kill();
    agent?.kill();
    await control?.close();
    await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
}
