import assert from 'node:assert/strict';
import { randomUUID, createHash, X509Certificate } from 'node:crypto';
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
import { host, linuxPath, linux, linuxBinary, spawnLinux, topology, viaWSL } from './native-linux.ts';
const execute = promisify(execFile), relayEnabled = process.argv.includes('--relay');
const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL;
if (!databaseUrl)
    throw new Error('Disposable MySQL URL required');
const openssl = process.env.TUNEX_OPENSSL ?? 'openssl';
await mkdir('.artifacts/linux-agent', { recursive: true });
const directory = await mkdtemp(resolve('.artifacts/linux-agent/run-'));
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
    if (relayEnabled) args.push('--relay');
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
    let peerFingerprint: string | undefined;
    if (relayEnabled) {
        const protectedPeer = JSON.parse((await linux('/bin/cat', [`${nativeRoot}/state/relay-credential.json`])).stdout);
        const peer = protectedPeer.payload.snapshot;
        assert.equal(peer.nodeId, nodeId); assert.ok(typeof protectedPeer.mac === 'string' && protectedPeer.mac.length === 64);
        const leaf = new X509Certificate(peer.certificate); assert.equal(leaf.subjectAltName, `URI:urn:tunex:node:${nodeId}`);
        assert.ok(leaf.keyUsage.includes('1.3.6.1.5.5.7.3.1') && leaf.keyUsage.includes('1.3.6.1.5.5.7.3.2'));
        assert.ok(Date.parse(peer.validUntil) <= Date.parse(peer.certificateNotAfter)); peerFingerprint = peer.fingerprint;
        const facts = await control.db.transaction(tx => control!.control.nodes.facts(tx, nodeId));
        assert.ok(facts.facts.capabilities.includes('native.relay.v1') && facts.facts.capabilities.includes('relay.wire.1'));
        passed('Relay Agent identity: real machine-session issuance produces protected dedicated peer identity and explicit capabilities');
    }
    monitor = spawnLinux(fixture, ['--mode', 'monitor', '--port', String(portStatus.port)]);
    let buffered = '', connected = false, ended = false;
    monitor.stdout!.on('data', data => { buffered += data.toString(); const lines = buffered.split('\n'); buffered = lines.pop()!; for (const line of lines) {
        if (!line.trim())
            continue;
        const row = JSON.parse(line);
        connected ||= Boolean(row.connected);
        ended ||= Boolean(row.ended);
    } });
    await until(async () => connected);
    const initialJournal = JSON.parse((await linux('/bin/cat', [`${nativeRoot}/state/journal.json`])).stdout);
    assert.equal(initialJournal.payload.snapshot.protocolVersion,3);assert.equal(initialJournal.payload.snapshot.nodeId,nodeId);assert.equal(initialJournal.payload.snapshot.journal.generation,initialJournal.payload.generation);
    const oldGeneration = initialJournal.payload.generation as number;
    const hardCutoff = Date.parse(initialJournal.payload.snapshot.journal.snapshot.validUntil) - runtimePolicy.maxClockSkewSeconds * 1000;
    const controlPort = control.port;
    await control.close();
    control = undefined;
    const offline = JSON.parse((await linux(fixture, ['--mode', 'probe', '--port', String(portStatus.port)])).stdout);
    assert.equal(offline.tcp, true);
    assert.equal(offline.udp, true);
    await until(async () => ended);
    assert.ok(Number.isFinite(hardCutoff));assert.ok(Date.now() >= hardCutoff - 1000);
    let udpExpired = false;
    try {
        await linux(fixture, ['--mode', 'probe', '--port', String(portStatus.port), '--udp-only']);
    }
    catch {
        udpExpired = true;
    }
    ;
    assert.equal(udpExpired, true);
    passed('Linux ADP-12: Control loss ends a held TCP stream and active UDP at the real ticket cutoff');
    await until(async () => agent!.exitCode !== null);
    agent = spawnLinux(binary, args);
    agent.stderr!.on('data', data => { errors += data.toString(); });
    await new Promise(resolve => setTimeout(resolve, 1000));
    let offlineClosed = false;
    try {
        await linux(fixture, ['--mode', 'probe', '--port', String(portStatus.port)]);
    }
    catch {
        offlineClosed = true;
    }
    ;
    assert.equal(offlineClosed, true);
    passed('Linux ADP-13: offline restart does not rebuild cached listeners');
    control = await startControl({ ...serverOptions, port: controlPort });
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`)).body.health.condition === 'ready');
    const restoredJournal = JSON.parse((await linux('/bin/cat', [`${nativeRoot}/state/journal.json`])).stdout);
    assert.ok(restoredJournal.payload.generation > oldGeneration);
    const recovery = JSON.parse((await linux(fixture, ['--mode', 'probe', '--port', String(portStatus.port)])).stdout);
    assert.equal(recovery.tcp, true);
    assert.equal(recovery.udp, true);
    passed('Linux ADP-13: online new session restores both protocols with preserved high-water');
    if (relayEnabled) {
        const peer = JSON.parse((await linux('/bin/cat', [`${nativeRoot}/state/relay-credential.json`])).stdout).payload.snapshot;
        assert.equal(peer.fingerprint, peerFingerprint);
        const [issued] = await control.db.pool.query<any[]>('SELECT COUNT(*) n FROM node_relay_credentials WHERE node_id=?', [nodeId]); assert.equal(issued[0].n, 1);
        passed('Relay restart identity: offline boot opens no sockets; online restart reuses durable peer key without additional issuance');
    }
    const disabled = await call('PUT', `/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`, { expectedRevision: 1, spec: { ...spec, enabled: false } });
    assert.equal(disabled.status, 202);
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${disabled.body.operationId}`)).body.status === 'succeeded');
    passed('Linux lifecycle: both protocols disable with persistent ACK and safe drain');
    const deleted = await call('DELETE', `/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`, { expectedRevision: 2 });
    assert.equal(deleted.status, 202);
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${deleted.body.operationId}`)).body.status === 'succeeded');
    assert.equal((await call('GET', `/api/v1/scopes/${scope}/forwards/${created.body.forwardId}`)).status, 404);
    passed('Linux lifecycle: tombstoned Forward reaches deletion terminal state');
    assert.ok(!errors.includes('CLOCK_UNCERTAIN') && !errors.includes('PERSISTENCE_FAILURE'), errors);
    const commit = (await execute('git', ['rev-parse', 'HEAD'])).stdout.trim();
    await writeFile(join(directory, 'evidence.json'), JSON.stringify({ commit, workingTreeDirty: Boolean((await execute('git', ['status', '--porcelain'])).stdout.trim()), command: relayEnabled ? 'npm run test:relay-agent' : 'npm run test:linux-agent', checks, synchronization: observed, policy: runtimePolicy, oldGeneration, restoredGeneration: restoredJournal.payload.generation, relayEnabled, agentSHA: createHash('sha256').update(await readFile(viaWSL ? '.artifacts/tunex-agent-linux' : binary)).digest('hex'), kernel: (await linux('/bin/uname', ['-a'])).stdout.trim(), topology }, null, 2));
    console.log(`Native Linux Agent passed: ${checks.length} checks. Evidence ${directory}`);
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
