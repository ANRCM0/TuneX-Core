import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { request } from 'node:https';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createConnection } from 'mysql2/promise';
import { DEFAULT_POLICY, digest } from '@tunex/contracts';
import { startControl } from '../../apps/control/src/server.ts';
import { newToken } from '../../apps/control/src/modules/identity.ts';
import { host, linux, linuxPath, linuxBinary, spawnLinux, viaWSL } from './native-linux.ts';
import { NetworkLab } from './network-lab.ts';

interface OwnedProcess { process: ChildProcess; pid: number; binary: string; identity: string; namespace?: string; errors: string }
interface Agent extends OwnedProcess { nodeId: string; root: string; args: string[]; uid: number; namespace: string }
interface Fixture extends OwnedProcess { messages: any[]; done: Promise<any> }
const execute = promisify(execFile), databaseUrl = process.env.TUNEX_TEST_DATABASE_URL, openssl = process.env.TUNEX_OPENSSL ?? 'openssl';
if (!databaseUrl) throw new Error('Disposable MySQL URL required');
const peerRotation = process.argv.includes('--peer-rotation'), artifactRoot = peerRotation ? '.artifacts/relay-rotation' : '.artifacts/relay-capacity';
await mkdir(artifactRoot, { recursive: true });
const directory = await mkdtemp(resolve(`${artifactRoot}/run-`));
const lab = new NetworkLab(), processes: OwnedProcess[] = [], agents: Agent[] = [], checks: string[] = [], samples: any[] = [];
const nativeRoot = `/tmp/${lab.identity}-capacity`, scope = 'relay-capacity', owner = 'capacity-owner', token = newToken();
const binary = linuxBinary('tunex-agent'), fixture = linuxBinary('network-fixture'), collector = linuxBinary('time-proof');
const caKey = join(directory, 'ca.key'), caCert = join(directory, 'ca.pem'), serverKey = join(directory, 'server.key'), serverCert = join(directory, 'server.pem');
const policy = { ...DEFAULT_POLICY, pollIntervalSeconds: 1, leaseSeconds: 30, renewalLeadSeconds: 12, observationFreshnessSeconds: 5, drainTimeoutSeconds: 2, udpIdleTimeoutSeconds: 2 };
const database = `tunex_relay_capacity_${randomUUID().replaceAll('-', '')}`;
let control: Awaited<ReturnType<typeof startControl>> | undefined, admin: Awaited<ReturnType<typeof createConnection>> | undefined, evidence: Record<string, unknown> | undefined;
let caBytes: Buffer, nativeProvisioned = false;
function pass(message: string) { checks.push(message); console.log(`PASS ${message}`); }
async function until(action: () => Promise<boolean>, label: string, timeout = 45000) { const started = Date.now(); while (Date.now() - started < timeout) { if (await action()) return; await new Promise(resolve => setTimeout(resolve, 150)); } throw new Error(`Relay capacity timed out: ${label}`); }
async function call(method: string, path: string, input?: unknown) {
 const body = input === undefined ? undefined : JSON.stringify(input);
 return new Promise<{ status: number; body: any }>((resolve, reject) => {
  const req = request({ hostname: host, port: control!.port, path, method, ca: caBytes, agent: false, timeout: 10000, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID(), ...(body ? { 'content-length': String(Buffer.byteLength(body)) } : {}) } }, res => {
   const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => { try { resolve({ status: res.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()) }); } catch (error) { reject(error); } });
  }); req.on('error', reject); req.on('timeout', () => req.destroy(new Error('Control timeout'))); req.end(body);
 });
}
async function launchFixture(namespace: string | undefined, mode: string, args: string[], name: string) {
 const identity = `${nativeRoot}/${name}`, argumentsIn = ['--mode', mode, ...args, '--run-id', identity];
 const process = namespace ? lab.spawn(namespace, fixture, argumentsIn) : spawnLinux(fixture, argumentsIn);
 let ready!: (value: any) => void, failReady!: (error: Error) => void;
 const readiness = new Promise<any>((resolve, reject) => { ready = resolve; failReady = reject; });
 const entry: Fixture = { process, pid: 0, binary: fixture, identity, ...(namespace ? { namespace } : {}), errors: '', messages: [], done: undefined as unknown as Promise<any> };
 processes.push(entry); process.stderr!.on('data', chunk => { entry.errors = (entry.errors + chunk.toString()).slice(-8192); });
 entry.done = new Promise((resolve, reject) => {
  let buffered = '';
  process.stdout!.on('data', chunk => {
   buffered += chunk.toString(); let end: number;
   while ((end = buffered.indexOf('\n')) >= 0) { const line = buffered.slice(0, end); buffered = buffered.slice(end + 1); try { const message = JSON.parse(line); entry.messages.push(message); if (message.pid) { assert.equal(message.runId, identity); entry.pid = message.pid; ready(message); } } catch (error) { reject(error); failReady(new Error('Invalid fixture readiness')); } }
  });
  process.once('error', error => { reject(error); failReady(error); });
  process.once('exit', code => { if (code !== 0) { const error = new Error(`Fixture ${name} exited ${code}: ${entry.errors}`); reject(error); failReady(error); } else resolve(entry.messages.at(-1)); });
 });
 entry.done.catch(() => {}); const status = await readiness; return { entry, status };
}
function unprivileged(uid: number) { return ['--nofile=256:256', '--', '/bin/setpriv', `--reuid=${uid}`, `--regid=${uid}`, '--clear-groups', '--bounding-set=-all', '--inh-caps=-all', '--ambient-caps=-all', '--no-new-privs', '/usr/bin/env', 'GOMAXPROCS=4']; }
async function launchAgent(agent: Agent) {
 agent.process = lab.spawn(agent.namespace, '/usr/bin/prlimit', [...unprivileged(agent.uid), agent.binary, ...agent.args]);
 agent.process.stderr!.on('data', chunk => { agent.errors = (agent.errors + chunk.toString()).slice(-16384); });
 await until(async () => {
  const candidates = await lab.run(agent.namespace, '/usr/bin/pgrep', ['-f', agent.root]).catch(() => undefined);
  for (const candidate of candidates?.stdout.trim().split('\n') ?? []) { if (!/^[1-9][0-9]*$/.test(candidate)) continue; const fields = (await lab.run(agent.namespace, '/bin/cat', [`/proc/${candidate}/cmdline`]).catch(() => undefined))?.stdout.split('\0'); if (fields?.[0] === agent.binary && fields.includes(agent.identity)) { agent.pid = Number(candidate); return true; } }
  return false;
 }, 'owned non-root Agent');
}
async function stop(entry: OwnedProcess) {
 const inspect = (command: string, args: string[]) => entry.namespace ? lab.run(entry.namespace, command, args) : lab.host(command, args);
 const fields = (await inspect('/bin/cat', [`/proc/${entry.pid}/cmdline`]).catch(() => undefined))?.stdout.split('\0');
 if (fields?.[0] === entry.binary && fields.includes(entry.identity)) {
  if (entry.namespace) { const inode = (await inspect('stat', ['-Lc', '%i', `/proc/${entry.pid}/ns/net`])).stdout.trim(); assert.equal(inode, lab.inodes.get(entry.namespace), 'Refuse foreign namespace process cleanup'); }
  await inspect('/bin/kill', ['-TERM', String(entry.pid)]);
  await until(async () => !(await inspect('/bin/cat', [`/proc/${entry.pid}/cmdline`]).catch(() => undefined))?.stdout.split('\0').includes(entry.identity), 'owned process exit', 10000);
 }
 entry.process.kill();
}
async function diagnostics() {
 return Promise.all(agents.map(async agent => { const value = JSON.parse((await lab.run(agent.namespace, '/bin/cat', [`${agent.root}/state/diagnostics/status.json`])).stdout); assert.equal(value.pid, agent.pid); assert.ok(Date.now() - Date.parse(value.capturedAt) < 5000, 'Fresh protected resource sample required'); return { nodeId: agent.nodeId, ...value }; }));
}
try {
 await lab.open();
 await lab.host('/usr/bin/install', ['-d', '-m', '0711', nativeRoot]); nativeProvisioned = true;
 const marker = join(directory, 'lab-identity'); await writeFile(marker, lab.identity); await lab.host('/usr/bin/install', ['-m', '0600', linuxPath(marker), `${nativeRoot}/identity`]);
 const synchronization = JSON.parse((await linux(collector, ['--check'])).stdout); assert.equal(synchronization.synchronized, true);
 await execute(openssl, ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', caKey, '-out', caCert, '-days', '2', '-subj', '/CN=Relay Capacity CA']);
 await execute(openssl, ['req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', serverKey, '-out', join(directory, 'server.csr'), '-subj', '/CN=localhost']);
 await writeFile(join(directory, 'server.ext'), `subjectAltName=IP:${host},IP:${lab.gateway}\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n`);
 await execute(openssl, ['x509', '-req', '-in', join(directory, 'server.csr'), '-CA', caCert, '-CAkey', caKey, '-set_serial', '1', '-out', serverCert, '-days', '1', '-extfile', join(directory, 'server.ext')]);
 caBytes = await readFile(caCert); admin = await createConnection(databaseUrl); await admin.query(`CREATE DATABASE \`${database}\``); const url = new URL(databaseUrl); url.pathname = `/${database}`;
 const options = { databaseUrl: url.toString(), caCert, caKey, serverKey, serverCert, openssl, stateDirectory: join(directory, 'control'), port: 0, host, policy, worker: true, ...(peerRotation ? { relayCredentialSeconds: 120, credentialOverlapSeconds: 30 } : {}) };
 control = await startControl({ ...options, initializeAuthority: true }); await control.control.identity.bootstrap(scope, owner, token);
 const proxy = await launchFixture(undefined, 'tcp-proxy', ['--host', lab.gateway, '--upstream-host', host, '--upstream-port', String(control.port)], 'control-proxy');
 const ingressNS = lab.namespaces[0]!, egressNS = lab.namespaces[1]!;
 const target = await launchFixture(egressNS, 'target', ['--target-connection-seconds', '180'], 'target');
 const freePort = async (namespace: string) => JSON.parse((await lab.run(namespace, fixture, ['--mode', 'port'])).stdout).port as number;
 const listenPort = await freePort(ingressNS), peerPorts = [await freePort(egressNS), await freePort(egressNS)]; assert.equal(new Set(peerPorts).size, 2);
 const profile = { driver: 'native.relay.v1', wireVersion: 1, security: 'mutual-tls13', protocols: ['tcp', 'udp'], handshakeTimeoutSeconds: 1, idleTimeoutSeconds: 2, maxFrameBytes: 65536, maxUdpDatagramBytes: 16384, maxConnectionsPerNode: 64 };
 const profilePath = `/api/v1/scopes/${scope}/transport-profiles/sustained`;
 assert.equal((await call('PUT', profilePath, { expectedRevision: 0, config: profile })).status, 202);
 for (const [index, namespace] of [ingressNS, egressNS].entries()) {
  const uid = 62001 + index;
  const passwd = (await lab.host('/bin/cat', ['/etc/passwd'])).stdout; assert.ok(!passwd.split('\n').some(line => line.split(':')[2] === String(uid)), 'Test UID must be unassigned');
  assert.equal((await lab.host('/usr/bin/pgrep', ['-u', String(uid)]).catch(() => undefined))?.stdout.trim() ?? '', '', 'Test UID must have no foreign processes');
  const node = await call('POST', `/api/v1/scopes/${scope}/nodes`, { allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [listenPort], egressPolicyRevision: 1, allowedDestinationCidrs: ['127.0.0.0/8', lab.subnet], allowMetadataTargets: false }); assert.equal(node.status, 201);
  const root = `${nativeRoot}/agent-${index}`, ownedBinary = `${root}/tunex-agent`;
  await lab.host('/usr/bin/install', ['-d', '-m', '0700', '-o', String(uid), '-g', String(uid), root]);
  await lab.host('/usr/bin/install', ['-m', '0500', '-o', String(uid), '-g', String(uid), binary, ownedBinary]);
  await lab.host('/usr/bin/install', ['-m', '0500', '-o', String(uid), '-g', String(uid), collector, `${root}/time-proof`]);
  await lab.host('/usr/bin/install', ['-m', '0400', '-o', String(uid), '-g', String(uid), linuxPath(caCert), `${root}/ca.pem`]);
  const args = ['--control', `https://${lab.gateway}:${proxy.status.port}`, '--node', node.body.nodeId, '--ca', `${root}/ca.pem`, '--state', `${root}/state`, '--journal-key', `${root}/secrets/journal.key`, '--relay', '--diagnostics'];
  try { await lab.run(namespace, '/usr/bin/prlimit', [...unprivileged(uid), `TUNEX_ENROLLMENT_TOKEN=${node.body.enrollmentToken}`, ownedBinary, ...args, '--enroll']); } catch { throw new Error('Non-root enrollment rejected; enrollment token is redacted'); }
  const agent: Agent = { process: undefined as unknown as ChildProcess, pid: 0, binary: ownedBinary, identity: `${root}/state`, namespace, errors: '', nodeId: node.body.nodeId, root, args, uid }; agents.push(agent); await launchAgent(agent);
  await until(async () => { const [rows] = await control!.db.pool.query<any[]>('SELECT COUNT(*) n FROM node_relay_credentials WHERE node_id=? AND revoked=FALSE', [agent.nodeId]); return rows[0].n === 1; }, 'unprivileged peer issuance');
 }
 const [ingress, egress] = agents as [Agent, Agent];
 assert.equal((await call('PUT', `/api/v1/scopes/${scope}/nodes/${egress.nodeId}/relay-endpoint`, { expectedRevision: 0, config: { listenAddress: lab.egress, advertisedHost: lab.egress, allowedTcpPorts: peerPorts } })).status, 202);
 const processFacts = await Promise.all(agents.map(async agent => {
  const status = (await lab.run(agent.namespace, '/bin/cat', [`/proc/${agent.pid}/status`])).stdout, limits = (await lab.run(agent.namespace, '/bin/cat', [`/proc/${agent.pid}/limits`])).stdout;
  for (const key of ['Uid', 'Gid']) { const ids = status.match(new RegExp(`^${key}:\\s+(.+)$`, 'm'))![1]!.trim().split(/\s+/); assert.deepEqual(ids, Array(4).fill(String(agent.uid))); }
  for (const key of ['CapInh', 'CapPrm', 'CapEff', 'CapBnd', 'CapAmb']) assert.match(status.match(new RegExp(`^${key}:\\s+(.+)$`, 'm'))![1]!, /^0+$/);
  assert.match(status, /^NoNewPrivs:\s+1$/m); assert.match(limits, /^Max open files\s+256\s+256\s+files[ \t]*$/m);
  const paths = [`${agent.root}/state`, `${agent.root}/secrets`, `${agent.root}/state/private.pem`, `${agent.root}/secrets/journal.key`];
  const permissions = await Promise.all(paths.map(async path => { const fields = (await lab.run(agent.namespace, 'stat', ['-c', '%a %u %g', path])).stdout.trim().split(' '); assert.equal(fields[1], String(agent.uid)); assert.equal(fields[2], String(agent.uid)); assert.equal(fields[0], path.endsWith('/state') || path.endsWith('/secrets') ? '700' : '600'); return { path, mode: fields[0], uid: fields[1], gid: fields[2] }; }));
  const inode = (await lab.run(agent.namespace, 'stat', ['-Lc', '%i', `/proc/${agent.pid}/ns/net`])).stdout.trim(); assert.equal(inode, lab.inodes.get(agent.namespace));
  const timeProof = JSON.parse((await lab.run(agent.namespace, '/usr/bin/prlimit', [...unprivileged(agent.uid), `${agent.root}/time-proof`, '--check'])).stdout); assert.equal(timeProof.synchronized, true);
  return { nodeId: agent.nodeId, uid: agent.uid, namespace: agent.namespace, inode, status, limits, permissions, synchronization: timeProof };
 }));
 assert.equal(new Set(processFacts.map(fact => fact.inode)).size, 2);
 pass('Deployment privileges: independent UID/GID Agents run with zero capabilities, NoNewPrivs and 256 FD; actual owned secrets/state and synchronized Linux time pass');
 let spec = { enabled: true, protocols: ['tcp', 'udp'], ingress: { nodeId: ingress.nodeId, listen: { address: '127.0.0.1', port: listenPort } }, target: { host: '127.0.0.1', port: target.status.port as number }, path: { via: [egress.nodeId] }, transport: { profileId: 'sustained', configRevision: 1 } }, revision = 1;
 const created = await call('POST', `/api/v1/scopes/${scope}/forwards`, spec); assert.equal(created.status, 202, JSON.stringify(created.body)); const forwardId = created.body.forwardId as string, resourcePath = `/api/v1/scopes/${scope}/forwards/${forwardId}`;
 const latest = async () => { const [rows] = await control!.db.pool.query<any[]>('SELECT generation,stage,body FROM relay_deployments WHERE forward_id=? ORDER BY generation DESC LIMIT 1', [forwardId]); return rows[0]; };
 const waitHealthy = async () => until(async () => { const plan = await latest(), resource = (await call('GET', resourcePath)).body; return plan.stage === 'active' && resource.health.condition === 'ready' && resource.applied.length === 4 && resource.applied.every((obs: any) => obs.phase === 'active' && obs.deploymentGeneration === plan.generation && obs.forwardRevision === revision); }, 'current two-Node active/ready', 65000);
 const waitOperation = async (id: string) => until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${id}`)).body.status === 'succeeded', 'Operation success', 65000);
 await waitOperation(created.body.operationId); await waitHealthy(); const generation = (await latest()).generation;
 const baseline = await diagnostics(); pass('Non-root Relay acceptance: real Control/MySQL and independently isolated Agents complete both exact current deployment roles');
 if (peerRotation) {
  const initialPlan = await latest(), initialOperation = created.body.operationId;
  const [initialCredentials] = await control.db.pool.query<any[]>('SELECT node_id,fingerprint,issued_at,valid_until FROM node_relay_credentials ORDER BY node_id');
  const firstGeneration = initialPlan.generation, rotationDetails: any[] = [];
  const initialSessions = (await control.db.pool.query<any[]>('SELECT node_id,session_epoch FROM runtime_nodes ORDER BY node_id'))[0]; assert.ok(initialSessions.every(row => row.session_epoch === 1));
  for (const agent of agents) await lab.host('/bin/cp', [`${agent.root}/state/relay-credential.json`, `${agent.root}/old-relay-credential.json`]);
  const issue = control.control.nodes.relayCredential.bind(control.control.nodes), attempts: {nodeId:string;requestId:string;csrDigest:string;lost:boolean}[] = [];
  let dropped = false;
  control.control.nodes.relayCredential = async (nodeId, fingerprint, epoch, requestId, csr) => {
   const response = await issue(nodeId, fingerprint, epoch, requestId, csr);
   const lost = nodeId === ingress.nodeId && !dropped && response.overlapUntil !== null;
   attempts.push({nodeId,requestId,csrDigest:digest({csr}),lost});
   if (lost) { dropped = true; throw new Error('Injected response loss after committed peer issuance'); }
   return response;
  };
  const held = await launchFixture(ingressNS, 'load', ['--port',String(listenPort),'--tcp-clients','1','--udp-clients','1','--seconds','90','--payload-bytes','256','--load-progress','--interval-ms','200','--expect-cutoff'], 'held-before-rotation');
  await until(async () => held.entry.messages.at(-1).clients?.every((client:any) => client.verified > 0), 'held streams before automatic rotation');
  // The new roles can become active before old connections finish their bounded
  // retirement. Do not wait for the retirement Operation before starting the
  // first overlap traffic window: that would consume the next scheduled renewal.
  const waitRenewed = async (count:number, previousGeneration:number, waitForRetirement=true) => {
   await until(async () => {
    const [rows] = await control!.db.pool.query<any[]>('SELECT node_id,COUNT(*) n FROM node_relay_credentials GROUP BY node_id');
    return rows.length === 2 && rows.every(row => row.n >= count);
   }, `automatic peer issuance ${count}`, 100000);
   await until(async () => {
    const plan = await latest(), [current] = await control!.db.pool.query<any[]>('SELECT node_id,fingerprint FROM node_relay_credentials WHERE retire_after IS NULL AND revoked=FALSE');
    return plan.generation > previousGeneration && plan.body.nodes.every((node:any)=>node.assignments.every((a:any)=>{const config=a.driver.config,peerId=a.role==='relay-ingress'?config.binding.egressNodeId:config.binding.ingressNodeId;return digest(config.peerFingerprints)===digest([`sha256:${current.find(row=>row.node_id===peerId)?.fingerprint}`]);}));
   }, 'latest plan includes both actual renewed peer identities');
   await waitHealthy();
   if(waitForRetirement) await until(async () => (await call('GET',resourcePath)).body.lastOperation.status === 'succeeded', 'renewal retirement completion', 65000);
   const plan = await latest(); assert.ok(plan.generation > previousGeneration);
   const [credentials] = await control!.db.pool.query<any[]>('SELECT node_id,fingerprint,issued_at,valid_until,retire_after FROM node_relay_credentials ORDER BY node_id,issued_at');
   const current = credentials.filter(row => row.retire_after === null); assert.equal(current.length,2);
   for (const node of plan.body.nodes) for (const assignment of node.assignments) {
    const config = assignment.driver.config, peerId = assignment.role === 'relay-ingress' ? config.binding.egressNodeId : config.binding.ingressNodeId;
    assert.deepEqual(config.peerFingerprints, [`sha256:${current.find(row=>row.node_id===peerId).fingerprint}`]);
    const previous = initialPlan.body.nodes.find((part:any)=>part.nodeId===node.nodeId).assignments.find((a:any)=>a.assignmentId===assignment.assignmentId);
    assert.ok(assignment.bindingFence > previous.bindingFence); assert.equal(assignment.forwardRevision,1);
   }
   assert.ok(plan.body.authorizationUntil > Date.now()+60000);
   const sessions = (await control!.db.pool.query<any[]>('SELECT node_id,session_epoch,snapshot_generation,last_report_sequence FROM runtime_nodes ORDER BY node_id'))[0];
   assert.ok(sessions.every(row=>row.session_epoch===1)); assert.equal((await call('GET',resourcePath)).body.desired.revision,1);
   assert.equal((await call('GET',`/api/v1/scopes/${scope}/operations/${initialOperation}`)).body.status,'succeeded');
   const detail = {count,generation:plan.generation,credentials,sessions,observedAt:new Date().toISOString()}; rotationDetails.push(detail); return {plan,credentials,current};
  };
  const first = await waitRenewed(2,firstGeneration,false);
  assert.equal(dropped,true); const lost = attempts.find(attempt=>attempt.lost)!;
  assert.ok(attempts.filter(attempt=>attempt.nodeId===lost.nodeId&&attempt.requestId===lost.requestId&&attempt.csrDigest===lost.csrDigest).length>=2);
  const [requests] = await control.db.pool.query<any[]>('SELECT node_id,request_id,request_digest FROM relay_credential_requests ORDER BY node_id,request_id');
  assert.equal(requests.filter(row=>row.node_id===lost.nodeId&&row.request_id===lost.requestId).length,1);
  pass('Automatic peer renewal: actual issuance response loss replays the same durable CSR once, creates higher fences/generation and retains both sessions and Forward revision');
  const verifyWindow = async (name:string) => {
   const before = (await latest()).generation;
   const load = await launchFixture(ingressNS,'load',['--port',String(listenPort),'--tcp-clients','4','--udp-clients','2','--seconds','36','--payload-bytes','512','--load-progress','--interval-ms','20'],name);
   let done = false; load.entry.done.finally(()=>{done=true;}).catch(()=>{});
   while(!done){ samples.push({phase:name,agents:await diagnostics()}); await new Promise(resolve=>setTimeout(resolve,1000)); }
   const result = await load.entry.done; assert.equal(result.completed,true); assert.equal(result.errors,0); assert.ok(result.clients.every((client:any)=>client.verified>100)); assert.equal((await latest()).generation,before); return result;
  };
  // New clients and genuine old-client retirement must overlap in *real time*.
  // Previous ordering waited for old retirement first (until about t+90s),
  // then ran a 36s window across the next automatic renewal (about t+120s).
  // All six new clients correctly closed during that later generation change,
  // but the test called it an unexpected retirement-window failure.
  const windowStartedAt=Date.now();
  const firstWindow = await verifyWindow('first-retirement-window');
  const heldResult = await held.entry.done; assert.equal(heldResult.expectedCutoff,true); assert.equal(heldResult.errors,2);
  for (const client of heldResult.clients) assert.ok(client.verified>0 && client.closedAt);
  await until(async () => (await call('GET',resourcePath)).body.lastOperation.status === 'succeeded', 'first retirement Operation terminal', 15000);
  assert.ok(windowStartedAt < Math.min(...first.credentials.filter(row=>row.retire_after!==null).map(row=>row.retire_after)), 'new traffic must begin while genuine old-peer authorization is still overlapping');
  pass('Renewal retirement: old TCP drains and UDP resets while fresh TCP/UDP clients remain error-free; prior completed Operation stays terminal');
  assert.ok(first.credentials.filter(row=>row.retire_after!==null).every(row=>Date.now()>row.retire_after+policy.maxClockSkewSeconds*1000));
  const stillFirst = await latest(); assert.equal(stillFirst.stage,'active'); assert.equal(stillFirst.generation,first.plan.generation);
  pass('Overlap closure: new encrypted TCP/UDP survives actual old-peer retirement plus clock margin, with no expiry-driven withdrawal or unnecessary deployment rebuild');
  const negativeOpen = join(directory,'retired-open.json'), assignment = stillFirst.body.nodes.find((part:any)=>part.nodeId===egress.nodeId).assignments.find((a:any)=>a.protocol==='tcp');
  await writeFile(negativeOpen,JSON.stringify({wireVersion:1,type:'open',action:'probe',requestId:'retired-peer',binding:assignment.driver.config.binding}));
  await lab.host('/usr/bin/install',['-m','0600',linuxPath(negativeOpen),`${nativeRoot}/retired-open.json`]);
  const negative = JSON.parse((await lab.run(ingressNS,fixture,['--mode','relay-negative','--host',lab.egress,'--port',String(assignment.resource.port),'--relay-ca',`${ingress.root}/ca.pem`,'--relay-bundle',`${ingress.root}/old-relay-credential.json`,'--relay-journal-key',`${ingress.root}/secrets/journal.key`,'--relay-node',egress.nodeId,'--relay-pin',`sha256:${first.current.find(row=>row.node_id===egress.nodeId).fingerprint}`,'--relay-open',`${nativeRoot}/retired-open.json`])).stdout);
  assert.equal(negative.rejected,true); assert.equal(negative.currentBinding,true);
  const accepted = JSON.parse((await lab.run(ingressNS,fixture,['--mode','probe','--port',String(listenPort)])).stdout); assert.equal(accepted.tcp,true); assert.equal(accepted.udp,true);
  pass('Retired peer refusal: original genuine CA-signed peer cannot probe a live current binding while freshly pinned Agents still carry exact TCP/UDP');
  // The second rotation has the same independent drain barrier as the first.
  // Do not start a generation-stable 36s load after waiting for retirement,
  // because that may cross into the third credential refresh.
  const second = await waitRenewed(3,first.plan.generation,false);
  const secondWindowStartedAt=Date.now();
  const secondWindow = await verifyWindow('second-retirement-window');
  await until(async () => (await call('GET',resourcePath)).body.lastOperation.status === 'succeeded', 'second retirement Operation terminal', 15000);
  assert.ok(secondWindowStartedAt < Math.min(...second.credentials.filter(row=>row.retire_after!==null).map(row=>row.retire_after)), 'second fresh load must begin before old-peer retirement');
  assert.equal((await latest()).generation,second.plan.generation);
  assert.ok(initialCredentials.every(row=>Date.now()>row.valid_until+policy.maxClockSkewSeconds*1000));
  assert.ok(second.credentials.filter(row=>row.retire_after!==null).every(row=>Date.now()>row.retire_after+policy.maxClockSkewSeconds*1000));
  await waitHealthy();
  pass('Repeated renewal: a second automatic key change and stable new traffic cross original effective expiry without restarting either Agent or resetting any persistent counter');
  const [beforeOffline] = await control.db.pool.query<any[]>('SELECT node_id,session_epoch,snapshot_generation FROM runtime_nodes WHERE node_id=?',[ingress.nodeId]);
  const [offlineCredential] = await control.db.pool.query<any[]>('SELECT fingerprint,valid_until FROM node_relay_credentials WHERE node_id=? AND retire_after IS NULL',[ingress.nodeId]);
  await stop(ingress);
  console.log('Waiting for the stopped Agent peer credential to reach its actual configured expiry');
  await until(async()=>Date.now()>offlineCredential[0].valid_until+policy.maxClockSkewSeconds*1000,'real offline peer authority expiry',150000);
  for(const args of [['-H','-ltn'],['-H','-lun']])assert.equal((await lab.run(ingressNS,lab.ss,[...args,`sport = :${listenPort}`])).stdout.trim(),'');
  await launchAgent(ingress); await waitHealthy();
  const [recoveredSession] = await control.db.pool.query<any[]>('SELECT node_id,session_epoch,snapshot_generation FROM runtime_nodes WHERE node_id=?',[ingress.nodeId]);
  const [recoveredPeer] = await control.db.pool.query<any[]>('SELECT fingerprint,valid_until FROM node_relay_credentials WHERE node_id=? AND retire_after IS NULL',[ingress.nodeId]);
  assert.ok(recoveredSession[0].session_epoch>beforeOffline[0].session_epoch); assert.ok(recoveredSession[0].snapshot_generation>beforeOffline[0].snapshot_generation);
  assert.notEqual(recoveredPeer[0].fingerprint,offlineCredential[0].fingerprint); assert.ok(recoveredPeer[0].valid_until>Date.now());
  const recoveryPayload=JSON.parse((await lab.run(ingressNS,fixture,['--mode','probe','--port',String(listenPort)])).stdout); assert.equal(recoveryPayload.tcp,true); assert.equal(recoveryPayload.udp,true);
  pass('Expired peer recovery: a stopped non-root Agent waits for genuine effective expiry, then uses the intact MAC journal and fresh online session/issuance to restore both payloads without executing cached authority');
  const removed = await call('DELETE',resourcePath,{expectedRevision:revision}); assert.equal(removed.status,202); await waitOperation(removed.body.operationId);
  const [remaining] = await control.db.pool.query<any[]>('SELECT COUNT(*) n FROM port_slots WHERE owner_id=?',[forwardId]); assert.equal(remaining[0].n,0);
  await until(async()=> (await diagnostics()).every(value=>value.tcpStreams===0&&value.udpAssociations===0),'rotation cleanup');
  pass('Rotation cleanup: current and historical peer deployments remove safely and every physical reservation releases');
  const commit=(await execute('git',['rev-parse','HEAD'])).stdout.trim();
  evidence={commit,workingTreeDirty:Boolean((await execute('git',['status','--porcelain'])).stdout.trim()),command:'npm run test:relay-rotation',checks,processFacts,baseline,samples,initialCredentials,rotationDetails,attempts,requests,heldResult,firstWindow,secondWindow,negative,beforeOffline,offlineCredential,recoveredSession,recoveredPeer,recoveryPayload,policy,synchronization,kernel:(await linux('/bin/uname',['-a'])).stdout.trim(),protocolVersion:3,agentSHA:createHash('sha256').update(await readFile(viaWSL?'.artifacts/tunex-agent-linux':binary)).digest('hex'),fixtureSHA:createHash('sha256').update(await readFile(viaWSL?'.artifacts/network-fixture-linux':fixture)).digest('hex'),topology:`${viaWSL?'Windows locked Control/MySQL with WSL':'Native Linux Control/MySQL and'} two non-root Agents in independent namespaces, real configured 120-second peer authority/30-second overlap; no clocks, certificate fields or DB expiry injection`,limitations:'Two live renewal cycles on one physical host; CA-signed leaf lifetime is one day, effective peer authority is configured to 120 seconds. Whole release and long-duration production stability remain separate gates.'};
 } else {
 const sustained = await launchFixture(ingressNS, 'load', ['--port', String(listenPort), '--tcp-clients', '16', '--udp-clients', '8', '--seconds', '60', '--payload-bytes', '1024', '--load-progress'], 'sustained-load');
 let sustainedDone = false; sustained.entry.done.finally(() => { sustainedDone = true; }).catch(() => {});
 while (!sustainedDone) { const observed = await diagnostics(); samples.push({ phase: 'sustained', agents: observed }); assert.ok(observed.every(sample => sample.authorizationActive && sample.openFileDescriptors < 256)); await new Promise(resolve => setTimeout(resolve, 2000)); }
 const sustainedRun = await sustained.entry.done; assert.equal(sustainedRun.completed, true); assert.equal(sustainedRun.errors, 0); assert.ok(sustainedRun.seconds >= 60); assert.equal(sustainedRun.clients.length, 24); assert.ok(sustainedRun.clients.every((client: any) => client.verified > 10));
 assert.ok(samples.some(sample => sample.agents.every((a: any) => a.tcpStreams >= 16 && a.udpAssociations >= 8)));
 assert.equal((await latest()).generation, generation);
 const [published] = await control.db.pool.query<any[]>('SELECT node_id,generation,body FROM snapshots ORDER BY node_id,generation');
 const renewals = agents.map(agent => { const active = published.filter(row => row.node_id === agent.nodeId && row.body.assignments.length === 2 && row.body.assignments.every((a: any) => a.phase === 'active')); assert.ok(active.length >= 3); assert.ok(active.every(row => row.body.assignments.every((a: any) => a.deploymentGeneration === generation))); return { nodeId: agent.nodeId, snapshots: active.length, generations: active.map(row => row.generation) }; });
 pass('Sustained encrypted Relay: 16 TCP and 8 UDP clients verify independent payloads for 60 seconds across multiple real renewals; execution generation stays fixed');
 await until(async () => (await diagnostics()).every(value => value.tcpStreams === 0 && value.udpAssociations === 0), 'post-load connection reclaim'); const reclaimed = await diagnostics();
 reclaimed.forEach((value, index) => assert.ok(value.openFileDescriptors <= baseline[index].openFileDescriptors + 4));
 pass('Sustained resource reclamation: both real Nodes return stream/association counts to zero and FD near baseline');
 assert.equal((await call('PUT', profilePath, { expectedRevision: 1, config: { ...profile, maxConnectionsPerNode: 12 } })).status, 202);
 spec = { ...spec, transport: { ...spec.transport, configRevision: 2 } }; const updated = await call('PUT', resourcePath, { expectedRevision: revision, spec }); assert.equal(updated.status, 202); revision = updated.body.revision; await waitOperation(updated.body.operationId); await waitHealthy();
 const held = await launchFixture(ingressNS, 'load', ['--port', String(listenPort), '--tcp-clients', '10', '--udp-clients', '2', '--seconds', '90', '--payload-bytes', '1024', '--load-progress', '--interval-ms', '200', '--expect-cutoff'], 'saturation-load');
 await until(async () => { const progress = held.entry.messages.at(-1); assert.equal(progress.errors ?? 0, 0, 'All capacity clients must first be admitted'); return progress.clients?.length === 12 && progress.clients.every((client: any) => client.verified > 0); }, 'all held capacity clients verify payload', 15000);
 await until(async () => (await diagnostics()).every(value => value.tcpStreams === 10 && value.udpAssociations === 2), 'exact shared Node capacity');
 const beforeRejection = held.entry.messages.at(-1).clients.map((client: any) => client.verified), saturation = await diagnostics();
 for (const flag of ['--tcp-only', '--udp-only']) { let rejected = false; try { await lab.run(ingressNS, fixture, ['--mode', 'probe', '--port', String(listenPort), flag]); } catch { rejected = true; } assert.equal(rejected, true, 'Extra clients must fail exact payload at shared capacity'); }
 await until(async () => held.entry.messages.at(-1).clients?.every((client: any, index: number) => client.verified > beforeRejection[index] && !client.closedAt), 'held clients survive overload');
 const saturatedHealth = (await call('GET', resourcePath)).body.health; assert.equal((await call('GET', `/api/v1/scopes/${scope}/operations/${updated.body.operationId}`)).body.status, 'succeeded');
 pass('Shared Relay budget: immutable cap 12 rejects independent extra TCP and UDP while all ten existing streams and two associations continue verified payload');
 const controlPort = control.port; await control.close(); control = undefined; const outageAt = Date.now();
 const [deadlineRows] = await admin.query<any[]>(`SELECT node_id,MAX(valid_until) valid_until FROM \`${database}\`.snapshots GROUP BY node_id`);
 const deadlines = agents.map(agent => { const row = deadlineRows.find(row => row.node_id === agent.nodeId); assert.ok(row); return { nodeId: agent.nodeId, validUntil: row.valid_until }; });
 const earliestDeadline = Math.min(...deadlines.map(row => row.validUntil)); assert.ok(earliestDeadline > outageAt + 3000, 'Real remaining lease required for outage test');
 const atOutage = held.entry.messages.at(-1).clients.map((client: any) => client.verified);
 await until(async () => held.entry.messages.at(-1).clients?.every((client: any, index: number) => client.verified > atOutage[index]), 'all protocols continue within offline lease', 8000);
 const cutoffRun = await held.entry.done; assert.equal(cutoffRun.completed, true); assert.equal(cutoffRun.expectedCutoff, true); assert.equal(cutoffRun.errors, 12);
 for (const client of cutoffRun.clients) { assert.ok(Date.parse(client.lastVerifiedAt) > outageAt); assert.ok(Date.parse(client.lastVerifiedAt) >= earliestDeadline - 2 * policy.maxClockSkewSeconds * 1000 - 1000, 'Traffic must persist until the actual lease safety margin'); assert.ok(Date.parse(client.lastVerifiedAt) <= earliestDeadline + policy.maxClockSkewSeconds * 1000); assert.ok(Date.parse(client.closedAt) <= earliestDeadline + 4000, 'Every independent active socket reaches real hard cutoff'); }
 await until(async () => (await diagnostics()).every(value => !value.authorizationActive && value.tcpStreams === 0 && value.udpAssociations === 0), 'unauthorized runtime completely closed'); const cutoffResources = await diagnostics();
 for (const args of [['-H', '-ltn'], ['-H', '-lun']]) assert.equal((await lab.run(ingressNS, lab.ss, [...args, `sport = :${listenPort}`])).stdout.trim(), '');
 pass('Control outage: every initially verified TCP/UDP client continues inside genuine signed leases, then hard cutoff removes all live traffic and client listeners without clock/deadline injection');
 control = await startControl({ ...options, port: controlPort });
 for (const agent of agents) { await stop(agent); await launchAgent(agent); }
 await waitHealthy();
 const [recoverySessions] = await control.db.pool.query<any[]>('SELECT node_id,session_epoch,snapshot_generation FROM runtime_nodes ORDER BY node_id'); assert.equal(recoverySessions.length, 2); assert.ok(recoverySessions.every(row => row.session_epoch >= 2));
 const restored = JSON.parse((await lab.run(ingressNS, fixture, ['--mode', 'probe', '--port', String(listenPort)])).stdout); assert.equal(restored.tcp, true); assert.equal(restored.udp, true);
 pass('Control recovery: non-root Agents restart with protected existing journals, higher sessions and authenticated snapshots to restore exact encrypted TCP/UDP after hard cutoff');
 const removed = await call('DELETE', resourcePath, { expectedRevision: revision }); assert.equal(removed.status, 202); await waitOperation(removed.body.operationId);
 const [remaining] = await control.db.pool.query<any[]>('SELECT COUNT(*) n FROM port_slots WHERE owner_id=?', [forwardId]); assert.equal(remaining[0].n, 0);
 await until(async () => (await diagnostics()).every(value => value.tcpStreams === 0 && value.udpAssociations === 0), 'final traffic cleanup');
 pass('Safe Relay deletion: authentic removal and historical authorization retirements release every physical reservation');
 const commit = (await execute('git', ['rev-parse', 'HEAD'])).stdout.trim();
 evidence = { commit, workingTreeDirty: Boolean((await execute('git', ['status', '--porcelain'])).stdout.trim()), command: 'npm run test:relay-capacity', checks, processFacts, baseline, samples, sustainedRun, renewals, reclaimed, saturation, saturatedHealth, outageAt: new Date(outageAt).toISOString(), deadlines, cutoffRun, cutoffResources, recoverySessions, restored, policy, synchronization, kernel: (await linux('/bin/uname', ['-a'])).stdout.trim(), topology: `${viaWSL ? 'Windows locked Control/MySQL with WSL' : 'Native Linux Control/MySQL and'} two independent non-root Agent network namespaces on one host; end-to-end Control TLS through opaque proxy`, protocolVersion: 3, agentSHA: createHash('sha256').update(await readFile(viaWSL ? '.artifacts/tunex-agent-linux' : binary)).digest('hex'), fixtureSHA: createHash('sha256').update(await readFile(viaWSL ? '.artifacts/network-fixture-linux' : fixture)).digest('hex'), limitations: 'Bounded 60-second local sample, not maximum supported capacity or fully Linux production deployment. At saturation readiness probes share the peer connection budget and may degrade health while established traffic remains live. Sustained recovery beyond peer-credential overlap remains a separate gate.' };
 }
} catch (error) {
 if (control) { const [runtime] = await control.db.pool.query('SELECT node_id,session_epoch,snapshot_generation,last_report FROM runtime_nodes'); const [deployments] = await control.db.pool.query('SELECT * FROM relay_deployments'); const [credentials]=await control.db.pool.query('SELECT node_id,fingerprint,issued_at,valid_until,retire_after,revoked FROM node_relay_credentials'); await writeFile(join(directory, 'failure.json'), JSON.stringify({ credentials, error: error instanceof Error ? error.message : 'Relay capacity failed', runtime, deployments, processes: [...agents, ...processes].map(entry => ({
  pid:entry.pid,namespace:entry.namespace,errors:entry.errors,exitCode:entry.process?.exitCode??null,
  loadProgress:'messages' in entry && Array.isArray(entry.messages)
    ? entry.messages.slice(-3).map((item:any)=>({
      completed:item.completed===true,reason:typeof item.reason==='string'?item.reason:null,
      verifiedReplies:typeof item.verifiedReplies==='number'?item.verifiedReplies:null,
      errors:typeof item.errors==='number'?item.errors:null,
      clients:Array.isArray(item.clients)?item.clients.map((client:any)=>({
        protocol:client.protocol,verified:client.verified,
        failure:client.failure??null,errorKind:client.errorKind??null
      })):[],
    })) : [],
})) }, null, 2)); }
 console.error(`Failure evidence: ${directory}`); throw error;
} finally {
 const errors: unknown[] = [];
 for (const entry of [...agents, ...processes].reverse()) await stop(entry).catch(error => errors.push(error));
 await control?.close().catch(error => errors.push(error));
 if (admin) { await admin.query(`DROP DATABASE IF EXISTS \`${database}\``).catch(error => errors.push(error)); await admin.end().catch(error => errors.push(error)); }
 if (nativeProvisioned) await (async () => { assert.equal((await lab.host('/usr/bin/readlink', ['-f', nativeRoot])).stdout.trim(), nativeRoot); assert.equal((await lab.host('/bin/cat', [`${nativeRoot}/identity`])).stdout, lab.identity); await lab.host('/bin/rm', ['-rf', '--', nativeRoot]); })().catch(error => errors.push(error));
 await lab.close().catch(error => errors.push(error)); await lab.verifyClosed().catch(error => errors.push(error)); if (errors.length) throw new AggregateError(errors, 'Owned resource cleanup failed');
}
await writeFile(join(directory, 'evidence.json'), JSON.stringify({ ...evidence, networkCleanupVerified: true, processCleanupVerified: true }, null, 2));
console.log(`Relay ${peerRotation ? 'rotation' : 'capacity'} acceptance passed: ${checks.length} checks. Evidence ${directory}`);
