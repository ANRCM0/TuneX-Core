import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { request } from 'node:https';
import { connect, createServer } from 'node:net';
import { createSocket } from 'node:dgram';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { platform, release } from 'node:os';
import { createConnection } from 'mysql2/promise';
import { startControl } from '../../apps/control/src/server.ts';
import { timeProofArguments } from '../time-proof.ts';
import { newToken } from '../../apps/control/src/modules/identity.ts';
import { DEFAULT_POLICY } from '@tunex/contracts';
const run = promisify(execFile), databaseUrl = process.env.TUNEX_TEST_DATABASE_URL;
if (!databaseUrl)
    throw new Error('Disposable TUNEX_TEST_DATABASE_URL required');
const openssl = process.env.TUNEX_OPENSSL ?? 'openssl';
await mkdir('.artifacts/faults', { recursive: true });
const directory = await mkdtemp(resolve('.artifacts/faults/run-'));
const caKey = join(directory, 'ca.key'), caCert = join(directory, 'ca.pem'), serverKey = join(directory, 'server.key'), serverCert = join(directory, 'server.pem');
await run(openssl, ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', caKey, '-out', caCert, '-days', '2', '-subj', '/CN=Fault Acceptance CA']);
await run(openssl, ['req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', serverKey, '-out', join(directory, 'server.csr'), '-subj', '/CN=localhost']);
await writeFile(join(directory, 'server.ext'), 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n');
await run(openssl, ['x509', '-req', '-in', join(directory, 'server.csr'), '-CA', caCert, '-CAkey', caKey, '-set_serial', '1', '-out', serverCert, '-days', '1', '-extfile', join(directory, 'server.ext')]);
const ca = await readFile(caCert), scope = 'fault-scope', actor = 'fault-owner', token = newToken();
const admin = await createConnection(databaseUrl), database = `tunex_fault_${randomUUID().replaceAll('-', '')}`;
await admin.query(`CREATE DATABASE \`${database}\``);
const dbUrl = new URL(databaseUrl);
dbUrl.pathname = `/${database}`;
let control: Awaited<ReturnType<typeof startControl>> | undefined, agent: ChildProcess | undefined, target: ChildProcess | undefined;
const binary = resolve('.artifacts', process.platform === 'win32' ? 'tunex-agent.exe' : 'tunex-agent');
const sockets: ReturnType<typeof connect>[] = [];
const datagrams: ReturnType<typeof createSocket>[] = [];
const checks: string[] = [];
const policy = { ...DEFAULT_POLICY, pollIntervalSeconds: 1, leaseSeconds: 18, renewalLeadSeconds: 8, drainTimeoutSeconds: 30 };
const configuration = { databaseUrl: dbUrl.toString(), caCert, caKey, serverCert, serverKey, openssl, stateDirectory: join(directory, 'control'), initializeAuthority:true, port: 0, policy };
function pass(message: string) { checks.push(message); console.log(`PASS ${message}`); }
async function call(method: string, path: string, input?: unknown) { const raw = input === undefined ? undefined : JSON.stringify(input); return new Promise<{
    status: number;
    body: any;
}>((resolve, reject) => { const req = request({ hostname: '127.0.0.1', port: control!.port, path, method, ca, agent: false, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID(), ...(raw ? { 'content-length': String(Buffer.byteLength(raw)) } : {}) } }, response => { const chunks: Buffer[] = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => { try {
    resolve({ status: response.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()) });
}
catch (error) {
    reject(error);
} }); }); req.on('error', reject); req.end(raw); }); }
async function until(action: () => Promise<boolean>, timeout = 30000) { const start = Date.now(); while (Date.now() - start < timeout) {
    if (await action())
        return;
    await new Promise(resolve => setTimeout(resolve, 100));
} throw new Error('Fault acceptance timed out'); }
async function freePort() { const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening'); const port = (listener.address() as {
    port: number;
}).port; await new Promise<void>(resolve => listener.close(() => resolve())); return port; }
async function kill(child: ChildProcess | undefined) { if (!child || child.exitCode !== null || child.signalCode !== null)
    return; const exit = once(child, 'exit'); child.kill(); await exit; }
async function tcp(port: number) { const client = connect(port, '127.0.0.1'); client.on('error', () => { }); sockets.push(client); await once(client, 'connect'); return client; }
async function echo(client: ReturnType<typeof connect>, text: string) { return new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('TCP payload timeout')), 2000); client.once('data', data => { clearTimeout(timer); try {
    assert.equal(data.toString(), text);
    resolve();
}
catch (error) {
    reject(error);
} }); client.write(text); }); }
async function udp(client: ReturnType<typeof createSocket>, port: number, text: string, expect = true) { return new Promise<void>((resolve, reject) => { const handle = (data: Buffer) => { if (data.toString() !== text)
    return; clearTimeout(timer); client.off('message', handle); expect ? resolve() : reject(new Error('UDP forwarded after cutoff')); }; const timer = setTimeout(() => { client.off('message', handle); expect ? reject(new Error('UDP payload timeout')) : resolve(); }, expect ? 1500 : 400); client.on('message', handle); client.send(Buffer.from(text), port, '127.0.0.1', error => { if (error) {
    clearTimeout(timer);
    reject(error);
} }); }); }
try {
    control = await startControl(configuration);
    await control.control.identity.bootstrap(scope, actor, token);
    target = spawn(process.execPath, ['scripts/phase2/dual-target.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const targetPort = JSON.parse(await new Promise<string>(resolve => target!.stdout!.once('data', data => resolve(data.toString())))).port as number;
    const port = await freePort();
    const nodePolicy = { allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [port], egressPolicyRevision: 1, allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false };
    const provision = await call('POST', `/api/v1/scopes/${scope}/nodes`, nodePolicy);
    assert.equal(provision.status, 201);
    const nodeId = provision.body.nodeId as string;
    const state = join(directory, 'agent'), key = join(directory, 'secrets', 'journal.key'), journal = join(state, 'journal.json');
    const args = ['--control', `https://127.0.0.1:${control.port}`, '--node', nodeId, '--ca', caCert, '--state', state, '--journal-key', key,...timeProofArguments()];
    await run(binary, [...args, '--enroll'], { env: { ...process.env, TUNEX_ENROLLMENT_TOKEN: provision.body.enrollmentToken } });
    agent = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let errors = '';
    agent.stderr!.on('data', data => { errors += data.toString(); });
    await until(async () => (await control!.db.pool.query<any[]>('SELECT session_epoch FROM runtime_nodes WHERE node_id=?', [nodeId]))[0][0].session_epoch > 0);
    const spec = { enabled: true, protocols: ['tcp', 'udp'], ingress: { nodeId, listen: { address: '127.0.0.1', port } }, target: { host: '127.0.0.1', port: targetPort } };
    const created = await call('POST', `/api/v1/scopes/${scope}/forwards`, spec);
    assert.equal(created.status, 202);
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${created.body.operationId}`)).body.status === 'succeeded');
    const client = await tcp(port), udpClient = createSocket('udp4');
    udpClient.on('error',()=>{});
    datagrams.push(udpClient);
    await echo(client, 'before-outage');
    await udp(udpClient, port, 'udp-before-outage');
    const persistentState = JSON.parse(await readFile(journal, 'utf8'));
    const currentGeneration = persistentState.payload.generation as number;
    const cutoff = Date.parse(persistentState.payload.snapshot.validUntil) - policy.maxClockSkewSeconds * 1000;
    const portControl = control.port;
    await control.close();
    control = undefined;
    await echo(client, 'offline-authorized');
    await udp(udpClient, port, 'udp-offline-authorized');
    pass('ADP-06/ADP-12: running TCP/UDP continues during Control loss only within existing authorization');
    await until(async () => Date.now() > cutoff + 250, 20000);
    await until(async () => agent!.exitCode !== null, 5000);
    assert.ok(errors.includes('LEASE_EXPIRED'), errors);
    assert.equal(client.destroyed || client.readableEnded, true);
    await udp(udpClient, port, 'udp-after-hard-cutoff', false);
    const released = createServer();
    released.listen(port, '127.0.0.1');
    await once(released, 'listening');
    await new Promise<void>(resolve => released.close(() => resolve()));
    pass('ADP-12: hard cutoff closes a held TCP stream, rejects UDP and releases the listener');
    const stored = JSON.parse(await readFile(journal, 'utf8'));
    assert.equal(stored.payload.generation, currentGeneration);
    agent = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.equal(agent.exitCode, null);
    const noListener = await new Promise<boolean>(resolve => { const attempt = connect(port, '127.0.0.1'); attempt.once('connect', () => { attempt.destroy(); resolve(false); }); attempt.once('error', () => resolve(true)); });
    assert.equal(noListener, true);
    pass('ADP-13: offline restart retains high-water but never reconstructs sockets');
    control = await startControl({ ...configuration, port: portControl });
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`)).body.health.condition === 'ready');
    const restored = JSON.parse(await readFile(journal, 'utf8'));
    assert.ok(restored.payload.generation > currentGeneration);
    const restoredClient = await tcp(port);
    await echo(restoredClient, 'after-online-restart');
    await udp(udpClient, port, 'udp-after-online-restart');
    pass('ADP-13: fresh online session/snapshot restores both protocols without resetting counters');
    // Disable creates a real drain while a long TCP stream remains active.
    const disabled = await call('PUT', `/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`, { expectedRevision: 1, spec: { ...spec, enabled: false } });
    assert.equal(disabled.status, 202);
    await until(async () => { const [records] = await control!.db.pool.query<any[]>('SELECT last_report FROM runtime_nodes WHERE node_id=?', [nodeId]); return records[0].last_report?.drains?.some((d: any) => d.condition === 'draining'); });
    const drainJournal = JSON.parse(await readFile(journal, 'utf8'));
    const [runtimeRows] = await control.db.pool.query<any[]>('SELECT last_report FROM runtime_nodes WHERE node_id=?', [nodeId]);
    const drain = runtimeRows[0].last_report.drains.find((d: any) => d.condition === 'draining');
    assert.ok(Date.parse(drain.deadline) <= Date.parse(drainJournal.payload.snapshot.validUntil));
    await control.close();
    control = undefined;
    await until(async () => Date.now() > Date.parse(drain.deadline) + 250, 20000);
    await until(async () => restoredClient.destroyed || restoredClient.readableEnded, 5000);
    pass('ADP-12: ordinary drain cannot extend the retired stream beyond its original authorization');
    await kill(agent);
    agent = undefined;
    const original = await readFile(journal);
    await writeFile(journal, Buffer.concat([original, Buffer.from('tampered')]));
    let rejected = false;
    try {
        await run(binary, args, { timeout: 5000 });
    }
    catch (error) {
        rejected = String((error as {
            stderr?: string;
        }).stderr ?? error).includes('INTEGRITY_FAILURE');
    }
    assert.equal(rejected, true);
    await writeFile(journal, original);
    pass('ADP-04/SEC-04: corrupt persistent state fails before Hello or socket restoration');
    const commit = (await run('git', ['rev-parse', 'HEAD'])).stdout.trim();
    await writeFile(join(directory, 'evidence.json'), JSON.stringify({ commit, workingTreeDirty: Boolean((await run('git', ['status', '--porcelain'])).stdout.trim()), command: 'npm run test:faults', checks, policy, initialSnapshotGeneration: currentGeneration, restoredSnapshotGeneration: restored.payload.generation, agentSHA: createHash('sha256').update(await readFile(binary)).digest('hex'), environment: { platform: platform(), kernel: release(), mysql: (await admin.query<any[]>('SELECT VERSION() version'))[0][0].version } }, null, 2));
    console.log(`Fault acceptance passed: ${checks.length} checks. Evidence ${directory}`);
}
finally {
    for (const socket of sockets)
        socket.destroy();
    for (const socket of datagrams)
        socket.close();
    await kill(agent);
    await kill(target);
    await control?.close();
    await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
}
