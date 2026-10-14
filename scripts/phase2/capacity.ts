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
import { host,linuxPath,linux,spawnLinux,linuxBinary,topology } from './native-linux.ts';
const execute = promisify(execFile);
const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL;
if (!databaseUrl)
    throw new Error('Disposable MySQL URL required');
const openssl = process.env.TUNEX_OPENSSL ?? 'openssl';
await mkdir('.artifacts/capacity', { recursive: true });
const directory = await mkdtemp(resolve('.artifacts/capacity/run-'));
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
const fleet:{nodeId:string;port:number;root:string;forwardId:string;process:ChildProcess|undefined}[]=[];
async function stopNative(root:string){const candidates=await linux('/usr/bin/pgrep',['-f',root]).catch(()=>undefined);for(const pid of candidates?.stdout.trim().split('\n')??[]){if(!/^[1-9][0-9]*$/.test(pid))continue;const command=await linux('/bin/cat',[`/proc/${pid}/cmdline`]).catch(()=>undefined);const fields=command?.stdout.split('\0');if(fields?.[0]===binary&&fields.includes(`${root}/state`)){await linux('/bin/kill',['-TERM',pid]).catch(()=>{});for(let attempt=0;attempt<100;attempt++){const remaining=await linux('/bin/cat',[`/proc/${pid}/cmdline`]).catch(()=>undefined);if(!remaining?.stdout.split('\0').includes(`${root}/state`))break;await new Promise(resolve=>setTimeout(resolve,25));}}}}
const runtimePolicy = { ...DEFAULT_POLICY, pollIntervalSeconds: 1, leaseSeconds: 18, renewalLeadSeconds: 8,udpIdleTimeoutSeconds:2,maxTcpConnectionsPerAssignment:64,maxUdpSessionsPerAssignment:32 };
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
    const args = ['--control', `https://${host}:${control.port}`, '--node', nodeId, '--ca', linuxPath(caCert), '--state', `${nativeRoot}/state`, '--journal-key', `${nativeRoot}/secrets/journal.key`, '--diagnostics'];
    try {
        await linux('env', [`TUNEX_ENROLLMENT_TOKEN=${provision.body.enrollmentToken}`, binary, ...args, '--enroll']);
    }
    catch {
        throw new Error('Linux enrollment rejected or Control interface unreachable; token is redacted');
    }
    agent = spawnLinux(binary, args);
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

    const diagnosticsPath=`${nativeRoot}/state/diagnostics/status.json`;
    await until(async()=>Boolean(await linux('/bin/cat',[diagnosticsPath]).catch(()=>undefined)));
    const baseline=JSON.parse((await linux('/bin/cat',[diagnosticsPath])).stdout);
    const samples:any[]=[];const runs:any[]=[];
    for(const [tcpCount,udpCount] of [[32,16],[64,32]]){
        await until(async()=>{const measured=JSON.parse((await linux('/bin/cat',[diagnosticsPath])).stdout);return measured.tcpStreams===0&&measured.udpAssociations===0;});
        let done=false;const load=linux(fixture,['--mode','load','--port',String(portStatus.port),'--tcp-clients',String(tcpCount),'--udp-clients',String(udpCount),'--seconds','3','--payload-bytes','1024']);load.finally(()=>{done=true}).catch(()=>{});
        while(!done){const snapshot=await linux('/bin/cat',[diagnosticsPath]).catch(()=>undefined);if(snapshot)samples.push(JSON.parse(snapshot.stdout));await new Promise(resolve=>setTimeout(resolve,300));}
        const measured=JSON.parse((await load).stdout);assert.ok(measured.verifiedReplies>tcpCount!+udpCount!);assert.equal(measured.errors,0);runs.push(measured);
    }
    assert.ok(samples.some(sample=>sample.tcpStreams>=32&&sample.udpAssociations>=16));assert.ok(samples.some(sample=>sample.authorizationActive===true));
    const peak={tcpStreams:Math.max(...samples.map(s=>s.tcpStreams)),udpAssociations:Math.max(...samples.map(s=>s.udpAssociations)),goroutines:Math.max(...samples.map(s=>s.goroutines)),heapAllocBytes:Math.max(...samples.map(s=>s.heapAllocBytes)),runtimeBytes:Math.max(...samples.map(s=>s.runtimeBytes)),openFileDescriptors:Math.max(...samples.map(s=>s.openFileDescriptors??0)),maxRSSBytes:Math.max(...samples.map(s=>s.maxRSSBytes??0)),measuredCpuTimeNanos:Math.max(...samples.map(s=>s.cpuTimeNanos??0))-(baseline.cpuTimeNanos??0)};
    passed('Capacity: independent Linux clients verify unique TCP/UDP payloads and measured latency/throughput under bounded concurrency');
    // The two short load bursts do not necessarily cross a real lease renewal.
    // Preserve the strict >=2 snapshots assertion, but synchronize on a real
    // higher-generation publication plus durable Agent acknowledgement first.
    const activeSnapshotRows=async()=>{
        const [records]=await control!.db.pool.query<any[]>('SELECT generation,body FROM snapshots WHERE node_id=? ORDER BY generation',[nodeId]);
        return records.filter((record:any)=>record.body.assignments.length===2);
    };
    await until(async()=>(await activeSnapshotRows()).length>=2);
    const renewed=await activeSnapshotRows();
    assert.ok(renewed.every((record:any)=>record.body.assignments.every((assignment:any)=>
        assignment.deploymentGeneration===1&&assignment.bindingFence===1)));
    const lastRenewedGeneration=renewed.at(-1)!.generation;
    await until(async()=>{
        const [records]=await control!.db.pool.query<any[]>('SELECT snapshot_generation,last_report FROM runtime_nodes WHERE node_id=?',[nodeId]);
        const row=records[0],report=typeof row?.last_report==='string'?JSON.parse(row.last_report):row?.last_report;
        return row?.snapshot_generation>=lastRenewedGeneration&&
            report?.acceptedSnapshotGeneration===row.snapshot_generation &&
            report.observations?.length===2 &&
            report.observations.every((item:any)=>item.condition==='ready' && item.phase==='active' && item.deploymentGeneration===1 && item.bindingFence===1);
    });
    // Observe a full current-authority ready Report, not just its generation.
    // Report acknowledgement can precede readiness of both actual engines.
    let renewedProbe: any;
    try {
        renewedProbe=JSON.parse((await linux(fixture,['--mode','probe','--port',String(portStatus.port)])).stdout);
        assert.equal(renewedProbe.tcp,true);
        assert.equal(renewedProbe.udp,true);
    } catch (error) {
        // The Agent can truthfully report ready while the *real* UDP path is
        // degraded. Preserve only bounded nonsecret observations; do not retry
        // or convert a failed packet into a successful acceptance.
        const [reported]=await control!.db.pool.query<any[]>('SELECT snapshot_generation,last_report FROM runtime_nodes WHERE node_id=?',[nodeId]);
        const current=reported[0];
        const report=typeof current?.last_report==='string'?JSON.parse(current.last_report):current?.last_report;
        const local=await linux('/bin/cat',[diagnosticsPath]).then(out=>JSON.parse(out.stdout)).catch(()=>null);
        const targetReachable=await linux(fixture,['--mode','probe','--udp-only','--port',String(targetStatus.port)]).then(()=>true).catch(()=>false);
        const failure={
            failedCheck:'post-renewal exact TCP/UDP payload',
            errorKind:error instanceof Error?error.name:'unknown',
            expectedCurrentGeneration:lastRenewedGeneration,
            nodeSnapshotGeneration:current?.snapshot_generation??null,
            observedSnapshotGeneration:report?.acceptedSnapshotGeneration??null,
            observations:Array.isArray(report?.observations)?report.observations.map((o:any)=>({
                protocol:o.protocol??null,condition:o.condition,phase:o.phase,
                deploymentGeneration:o.deploymentGeneration,bindingFence:o.bindingFence
            })):[],
            targetUdpEchoReachable:targetReachable,
            agentExitCode:agent?.exitCode??null,
            diagnostics:local?{
                snapshotGeneration:local.snapshotGeneration,authorizationActive:local.authorizationActive,
                tcpStreams:local.tcpStreams,udpAssociations:local.udpAssociations,
                udpCapacityDropped:local.udpCapacityDropped,udpTargetRejected:local.udpTargetRejected,
                udpDatagramDropped:local.udpDatagramDropped,udpQueueDropped:local.udpQueueDropped,
                udpAmplificationDropped:local.udpAmplificationDropped
            }:null
        };
        await writeFile(join(directory,'failure.json'),JSON.stringify(failure,null,2));
        console.error('Post-renewal live UDP failed; nonsecret failure evidence:',JSON.stringify(failure));
        throw error;
    }
    passed('Snapshot renewal: higher-generation leases are reported by Agent while TCP/UDP preserve the execution fence');
    const removed=await call('DELETE',`/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`,{expectedRevision:1});assert.equal(removed.status,202);await until(async()=>(await call('GET',`/api/v1/scopes/${scope}/operations/${removed.body.operationId}`)).body.status==='succeeded');
    await until(async()=>{const measured=JSON.parse((await linux('/bin/cat',[diagnosticsPath])).stdout);return measured.tcpStreams===0&&measured.udpAssociations===0;});const reclaimed=JSON.parse((await linux('/bin/cat',[diagnosticsPath])).stdout);
    assert.ok(reclaimed.openFileDescriptors<=baseline.openFileDescriptors+4);passed('Capacity cleanup: actual stream/session counters and descriptors return near baseline after safe deletion');
    const [snapshots]=await control.db.pool.query<any[]>('SELECT COUNT(*) n,MAX(JSON_STORAGE_SIZE(body)) maxBytes FROM snapshots WHERE node_id=?',[nodeId]);const [nodeStats]=await control.db.pool.query<any[]>('SELECT snapshot_generation,session_epoch,last_report_sequence FROM runtime_nodes WHERE node_id=?',[nodeId]);
    const [published]=await control.db.pool.query<any[]>('SELECT body FROM snapshots WHERE node_id=? ORDER BY generation',[nodeId]);const activeSnapshots=published.filter(row=>row.body.assignments.length===2);assert.ok(activeSnapshots.length>=2);assert.ok(activeSnapshots.every(row=>row.body.assignments.every((a:any)=>a.deploymentGeneration===1&&a.bindingFence===1)));passed('Renewal cost: real higher-generation publications preserve both execution instances and checked payloads');
    for(let index=0;index<4;index++){
        let port=JSON.parse((await linux(fixture,['--mode','port'])).stdout).port as number;while(fleet.some(item=>item.port===port))port=JSON.parse((await linux(fixture,['--mode','port'])).stdout).port;
        const node=await call('POST',`/api/v1/scopes/${scope}/nodes`,{allowedListenerAddresses:['127.0.0.1'],allowedPorts:[port],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false});assert.equal(node.status,201);const root=`${nativeRoot}/fleet-${index}`;const args=['--control',`https://${host}:${control.port}`,'--node',node.body.nodeId,'--ca',linuxPath(caCert),'--state',`${root}/state`,'--journal-key',`${root}/secrets/journal.key`];
        try{await linux('env',[`TUNEX_ENROLLMENT_TOKEN=${node.body.enrollmentToken}`,binary,...args,'--enroll']);}catch{throw new Error('Fleet enrollment failed; token redacted');}
        const process=spawnLinux(binary,args);const entry={nodeId:node.body.nodeId,port,root,forwardId:'',process};fleet.push(entry);process.stderr!.on('data',()=>{});await until(async()=>{const [rows]=await control!.db.pool.query<any[]>('SELECT session_epoch FROM runtime_nodes WHERE node_id=?',[node.body.nodeId]);return rows[0].session_epoch>0;});
        const forward=await call('POST',`/api/v1/scopes/${scope}/forwards`,{...spec,ingress:{nodeId:node.body.nodeId,listen:{address:'127.0.0.1',port}}});assert.equal(forward.status,202);entry.forwardId=forward.body.forwardId;await until(async()=>(await call('GET',`/api/v1/scopes/${scope}/operations/${forward.body.operationId}`)).body.status==='succeeded');
    }
    for(const member of fleet){await stopNative(member.root);member.process?.kill();}
    const reconnectStart=performance.now();for(const member of fleet){const args=['--control',`https://${host}:${control.port}`,'--node',member.nodeId,'--ca',linuxPath(caCert),'--state',`${member.root}/state`,'--journal-key',`${member.root}/secrets/journal.key`];member.process=spawnLinux(binary,args);member.process.stderr!.on('data',()=>{});}
    await until(async()=>{const [rows]=await control!.db.pool.query<any[]>('SELECT COUNT(*) n FROM runtime_nodes WHERE node_id IN (?,?,?,?) AND session_epoch>=2 AND received_at IS NOT NULL',fleet.map(member=>member.nodeId));return rows[0].n===4;});const fleetReconnectMs=performance.now()-reconnectStart;
    for(const member of fleet){const checked=JSON.parse((await linux(fixture,['--mode','probe','--port',String(member.port)])).stdout);assert.equal(checked.tcp,true);assert.equal(checked.udp,true);}
    passed('Reconnect sample: four real Linux Agent identities recover fresh sessions together and verify both protocols');
    for(const member of fleet){const deleted=await call('DELETE',`/api/v1/scopes/${scope}/forwards/${member.forwardId}`,{expectedRevision:1});assert.equal(deleted.status,202);await until(async()=>(await call('GET',`/api/v1/scopes/${scope}/operations/${deleted.body.operationId}`)).body.status==='succeeded');}
    const uid=(await linux('/usr/bin/id',['-u'])).stdout.trim();const processLimits=(await linux('/bin/cat',[`/proc/${reclaimed.pid}/limits`])).stdout;
    const commit=(await execute('git',['rev-parse','HEAD'])).stdout.trim();await writeFile(join(directory,'evidence.json'),JSON.stringify({commit,workingTreeDirty:Boolean((await execute('git',['status','--porcelain'])).stdout.trim()),command:'npm run test:capacity',checks,baseline,peak,reclaimed,runs,snapshots:snapshots[0],node:nodeStats[0],fleet:{agents:4,reconnectMs:fleetReconnectMs,hostCount:1},policy:runtimePolicy,agentSHA:createHash('sha256').update(await readFile(process.platform==='win32'?'.artifacts/tunex-agent-linux':binary)).digest('hex'),kernel:(await linux('/bin/uname',['-a'])).stdout.trim(),uid,processLimits,diagnosticsEnabled:true,topology:`${topology}; bounded local load, not maximum supported throughput`},null,2));console.log(JSON.stringify({peak,runs,fleetReconnectMs},null,2));console.log(`Capacity measurement passed: ${checks.length} checks. Evidence ${directory}`);
}
finally {
    for(const member of fleet){await stopNative(member.root);member.process?.kill();}
    // Kill only this run's native processes via their unique command line; do not touch existing services.
    if (agent) {
        const candidates = await linux('/usr/bin/pgrep', ['-f', nativeRoot]).catch(() => undefined);
        for (const line of candidates?.stdout.trim().split('\n') ?? []) {
            if (!/^[1-9][0-9]*$/.test(line))
                continue;
            const command = await linux('/bin/cat', [`/proc/${line}/cmdline`]).catch(() => undefined);
            const fields = command?.stdout.split('\0');
            if (fields?.[0] === binary && fields.includes(`${nativeRoot}/state`) && fields.includes(`${nativeRoot}/secrets/journal.key`))
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
