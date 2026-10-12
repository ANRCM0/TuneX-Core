import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { request } from 'node:https';
import { createServer, connect } from 'node:net';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { platform, release } from 'node:os';
import { createConnection } from 'mysql2/promise';
import { startControl } from '../../apps/control/src/server.ts';
import { timeProofArguments } from '../time-proof.ts';
import { rows } from '../../apps/control/src/infrastructure/mysql.ts';
import { newToken } from '../../apps/control/src/modules/identity.ts';
const run = promisify(execFile);
const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL;
if (!databaseUrl)
    throw new Error('Disposable TUNEX_TEST_DATABASE_URL required');
const openssl = process.env.TUNEX_OPENSSL ?? 'openssl';
await mkdir('.artifacts/security', { recursive: true });
const directory = await mkdtemp(resolve('.artifacts/security/run-'));
const caKey = join(directory, 'ca.key'), caCert = join(directory, 'ca.pem'), serverKey = join(directory, 'server.key'), serverCert = join(directory, 'server.pem');
await run(openssl, ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', caKey, '-out', caCert, '-days', '2', '-subj', '/CN=Security Acceptance CA']);
await run(openssl, ['req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', serverKey, '-out', join(directory, 'server.csr'), '-subj', '/CN=localhost']);
await writeFile(join(directory, 'server.ext'), 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n');
await run(openssl, ['x509', '-req', '-in', join(directory, 'server.csr'), '-CA', caCert, '-CAkey', caKey, '-set_serial', '1', '-out', serverCert, '-days', '1', '-extfile', join(directory, 'server.ext')]);
const ca = await readFile(caCert), ownerToken = newToken(), scope = 'security-scope', actor = 'security-owner';
const administrator = await createConnection(databaseUrl), database = `tunex_security_${randomUUID().replaceAll('-', '')}`;
await administrator.query(`CREATE DATABASE \`${database}\``);
const dbUrl = new URL(databaseUrl);
dbUrl.pathname = `/${database}`;
let control: Awaited<ReturnType<typeof startControl>> | undefined, agent: ChildProcess | undefined, target: ChildProcess | undefined;
const sockets: ReturnType<typeof connect>[] = [];
const checks: string[] = [];
function passed(message: string) { checks.push(message); console.log(`PASS ${message}`); }
type Machine = {
    cert: Buffer;
    key: Buffer;
};
async function call(method: string, path: string, input?: unknown, machine?: Machine, headers: Record<string, string> = {}) {
    const body = input === undefined ? undefined : JSON.stringify(input);
    return new Promise<{
        status: number;
        body: any;
    }>((resolve, reject) => {
        const req = request({ hostname: '127.0.0.1', port: control!.port, path, method, ca, ...machine, agent: false, timeout: 10000, headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json', ...(body ? { 'content-length': String(Buffer.byteLength(body)) } : {}), ...headers } }, response => { const chunks: Buffer[] = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => { try {
            resolve({ status: response.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()) });
        }
        catch (error) {
            reject(error);
        } }); });
        req.on('timeout', () => req.destroy(new Error('HTTPS request timed out')));
        req.on('error', reject);
        req.end(body);
    });
}
async function until(action: () => Promise<boolean>, timeout = 45000) { const start = Date.now(); while (Date.now() - start < timeout) {
    if (await action())
        return;
    await new Promise(resolve => setTimeout(resolve, 100));
} throw new Error('Security acceptance condition timed out'); }
async function freePort() { const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const port = (server.address() as {
    port: number;
}).port; await new Promise<void>(resolve => server.close(() => resolve())); return port; }
async function tcp(port: number) { const client = connect(port, '127.0.0.1'); sockets.push(client); client.on('error', () => { }); await once(client, 'connect'); return client; }
async function echo(client: ReturnType<typeof connect>, text: string) { await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('TCP echo timed out')), 4000); client.once('data', chunk => { clearTimeout(timer); try {
    assert.equal(chunk.toString(), text);
    resolve();
}
catch (error) {
    reject(error);
} }); client.write(text); }); }
async function kill(child: ChildProcess | undefined) { if (!child || child.exitCode !== null || child.signalCode !== null)
    return; const exit = once(child, 'exit'); child.kill(); await exit; }
const binary = resolve('.artifacts', process.platform === 'win32' ? 'tunex-agent.exe' : 'tunex-agent');
try {
    control = await startControl({ databaseUrl: dbUrl.toString(), caCert, caKey, serverCert, serverKey, openssl, stateDirectory: join(directory, 'control'), port: 0, credentialOverlapSeconds: 20 });
    await control.control.identity.bootstrap(scope, actor, ownerToken);
    target = spawn(process.execPath, ['scripts/phase1/echo-target.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const targetPort = JSON.parse(await new Promise<string>(resolve => target!.stdout!.once('data', chunk => resolve(chunk.toString())))).port as number;
    const port = await freePort();
    const policy = { allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [port], egressPolicyRevision: 1, allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false };
    const provision = await call('POST', `/api/v1/scopes/${scope}/nodes`, policy);
    assert.equal(provision.status, 201);
    const nodeId = provision.body.nodeId as string;
    const state = join(directory, 'agent'), key = join(directory, 'secrets', 'journal.key');
    const argumentsList = ['--control', `https://127.0.0.1:${control.port}`, '--node', nodeId, '--ca', caCert, '--state', state, '--journal-key', key,...timeProofArguments()];
    await run(binary, [...argumentsList, '--enroll'], { env: { ...process.env, TUNEX_ENROLLMENT_TOKEN: provision.body.enrollmentToken } });
    const old: Machine = { cert: await readFile(join(state, 'node.pem')), key: await readFile(join(state, 'private.pem')) };
    agent = spawn(binary, argumentsList, { stdio: ['ignore', 'pipe', 'pipe'] });
    let agentErrors = '';
    agent.stderr!.on('data', chunk => { agentErrors += chunk.toString(); });
    await until(async () => (await rows<{
        session_epoch: number;
    }>(control!.db.pool, 'SELECT session_epoch FROM runtime_nodes WHERE node_id=?', [nodeId]))[0]!.session_epoch > 0);
    const spec = { enabled: true, protocols: ['tcp'], ingress: { nodeId, listen: { address: '127.0.0.1', port } }, target: { host: '127.0.0.1', port: targetPort } };
    const created = await call('POST', `/api/v1/scopes/${scope}/forwards`, spec, undefined, { 'idempotency-key': 'create' });
    assert.equal(created.status, 202);
    const forwardId = created.body.forwardId as string;
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${created.body.operationId}`)).body.status === 'succeeded');
    const longStream = await tcp(port);
    await echo(longStream, 'before-rotation');
    const before = (await rows<{
        session_epoch: number;
        snapshot_generation: number;
    }>(control.db.pool, 'SELECT session_epoch,snapshot_generation FROM runtime_nodes WHERE node_id=?', [nodeId]))[0]!;
    await run(openssl, ['req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', join(directory, 'rotated.key'), '-out', join(directory, 'rotated.csr'), '-subj', `/CN=${nodeId}`]);
    const csr = await readFile(join(directory, 'rotated.csr'), 'utf8'), rotation = { requestId: 'rotation-one', csr }, epoch = { 'x-tunex-session-epoch': String(before.session_epoch) };
    const responses = await Promise.all([call('POST', '/agent/v2/credentials/rotate', rotation, old, epoch), call('POST', '/agent/v2/credentials/rotate', rotation, old, epoch)]);
    assert.equal(responses[0]!.status, 200, JSON.stringify(responses[0]));
    assert.deepEqual(responses[0], responses[1]);
    const signed = responses[0]!.body;
    const rotated: Machine = { cert: Buffer.from(signed.certificate), key: await readFile(join(directory, 'rotated.key')) };
    const corruptRequest = await call('POST', '/agent/v2/credentials/rotate', { ...rotation, csr: csr + '\n' }, old, epoch);
    assert.equal(corruptRequest.status, 409);
    assert.equal(corruptRequest.body.code, 'IDEMPOTENCY_CONFLICT');
    assert.equal((await rows<{
        n: number;
    }>(control.db.pool, 'SELECT COUNT(*) n FROM node_credentials WHERE node_id=?', [nodeId]))[0]!.n, 2);
    passed('SEC-06: concurrent rotation retries produce one new credential and reject changed CSR');
    const journalBefore = await readFile(join(state, 'journal.json'));
    await writeFile(join(state, 'credential.json'), JSON.stringify({ certificate: signed.certificate, privateKey: rotated.key.toString() }), { mode: 0o600 });
    const oldSnapshot = await call('GET', '/agent/v2/snapshot', undefined, old, epoch);
    assert.equal(oldSnapshot.status, 200);
    assert.ok(Date.parse(oldSnapshot.body.validUntil) <= Date.parse(signed.oldCredentialUntil));
    const newSnapshot = await call('GET', '/agent/v2/snapshot', undefined, rotated, epoch);
    assert.equal(newSnapshot.status, 200);
    assert.ok(Date.parse(newSnapshot.body.validUntil) > Date.parse(signed.oldCredentialUntil));
    await until(async () => (await rows<{
        last_report: any;
    }>(control!.db.pool, 'SELECT last_report FROM runtime_nodes WHERE node_id=?', [nodeId]))[0]?.last_report?.acceptedSnapshotGeneration === newSnapshot.body.snapshotGeneration);
    await echo(longStream, 'after-live-rotation');
    const after = (await rows<{
        session_epoch: number;
    }>(control.db.pool, 'SELECT session_epoch FROM runtime_nodes WHERE node_id=?', [nodeId]))[0]!;
    assert.equal(after.session_epoch, before.session_epoch);
    assert.equal((await rows<{
        revision: number;
    }>(control.db.pool, 'SELECT revision FROM forwards WHERE id=?', [forwardId]))[0]!.revision, 1);
    assert.ok(journalBefore.length > 0);
    passed('SEC-06: live credential reload preserves TCP stream, session and Forward revision');
    await until(async () => Date.now() > Date.parse(signed.oldCredentialUntil) + 50);
    assert.equal((await call('GET', '/agent/v2/snapshot', undefined, old, epoch)).status, 403);
    assert.equal((await call('GET', '/agent/v2/snapshot', undefined, rotated, epoch)).status, 200);
    passed('SEC-06: overlap has a hard bound; retired credential cannot request new authorization');
    const policy2 = { ...policy, egressPolicyRevision: 2, allowedDestinationCidrs: ['127.0.0.0/9'] };
    const stalePolicy = await call('PUT', `/api/v1/scopes/${scope}/nodes/${nodeId}/policy`, { expectedRevision: 2, policy: policy2 }, undefined, { 'idempotency-key': 'stale-policy' });
    assert.equal(stalePolicy.status, 409);
    const changed = await call('PUT', `/api/v1/scopes/${scope}/nodes/${nodeId}/policy`, { expectedRevision: 1, policy: policy2 }, undefined, { 'idempotency-key': 'policy-allow' });
    assert.equal(changed.status, 202, JSON.stringify(changed.body));
    await writeFile(join(directory, 'policy.json'), JSON.stringify(policy2));
    const cliEnvironment = { ...process.env, TUNEX_CONTROL_URL: `https://127.0.0.1:${control.port}`, TUNEX_CA_CERT: caCert, TUNEX_OWNER_TOKEN: ownerToken };
    const cliPolicy = await run(process.execPath, ['apps/control/src/client.ts', 'node-policy', scope, nodeId, '1', join(directory, 'policy.json'), 'policy-allow'], { env: cliEnvironment });
    assert.deepEqual(JSON.parse(cliPolicy.stdout), changed.body);
    assert.deepEqual(await call('PUT', `/api/v1/scopes/${scope}/nodes/${nodeId}/policy`, { expectedRevision: 1, policy: policy2 }, undefined, { 'idempotency-key': 'policy-allow' }), changed);
    assert.equal((await call('PUT', `/api/v1/scopes/${scope}/nodes/${nodeId}/policy`, { expectedRevision: 1, policy: { ...policy2, allowMetadataTargets: true } }, undefined, { 'idempotency-key': 'policy-allow' })).body.code, 'IDEMPOTENCY_CONFLICT');
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/forwards/${forwardId}`)).body.applied.some((o: any) => o.deploymentGeneration >= 2 && o.condition === 'ready'));
    await echo(longStream, 'old-policy-stream');
    longStream.destroy();
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${changed.body.operationIds[0]}`)).body.status === 'succeeded');
    const active = await tcp(port);
    await echo(active, 'new-policy-stream');
    const policy3 = { ...policy2, egressPolicyRevision: 3, allowedDestinationCidrs: ['192.0.2.0/24'] };
    const denied = await call('PUT', `/api/v1/scopes/${scope}/nodes/${nodeId}/policy`, { expectedRevision: 2, policy: policy3 }, undefined, { 'idempotency-key': 'policy-deny' });
    assert.equal(denied.status, 202);
    await until(async () => { const s = (await rows<{
        body: any;
    }>(control!.db.pool, 'SELECT body FROM snapshots WHERE node_id=? ORDER BY generation DESC LIMIT 1', [nodeId]))[0]!.body; return s.assignments.length === 0; });
    const forbidden = await call('POST', `/api/v1/scopes/${scope}/forwards`, spec, undefined, { 'idempotency-key': 'denied-target' });
    assert.equal(forbidden.status, 403);
    active.destroy();
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${denied.body.operationIds[0]}`)).body.cleanupPending === false);
    assert.equal((await call('GET', `/api/v1/scopes/${scope}/forwards/${forwardId}`)).body.desired.revision, 1);
    passed('SEC-06: policy changes version execution without rewriting intent and withdraw forbidden targets');
    const restoredPolicy = { ...policy, egressPolicyRevision: 4 };
    const restored = await call('PUT', `/api/v1/scopes/${scope}/nodes/${nodeId}/policy`, { expectedRevision: 3, policy: restoredPolicy }, undefined, { 'idempotency-key': 'policy-restore' });
    assert.equal(restored.status, 202);
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${restored.body.operationIds[0]}`)).body.status === 'succeeded');
    await kill(agent);
    agent = spawn(binary, [...argumentsList, '--rotate'], { stdio: ['ignore', 'pipe', 'pipe'] });
    agent.stderr!.on('data', chunk => { agentErrors += chunk.toString(); });
    await until(async () => (await rows<{
        n: number;
    }>(control!.db.pool, 'SELECT COUNT(*) n FROM node_credentials WHERE node_id=?', [nodeId]))[0]!.n === 3);
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/forwards/${forwardId}`)).body.health.condition === 'ready');
    const cliBundle = JSON.parse(await readFile(join(state, 'credential.json'), 'utf8'));
    const cliCredential: Machine = { cert: Buffer.from(cliBundle.certificate), key: Buffer.from(cliBundle.privateKey) };
    const currentSession = (await rows<{
        session_epoch: number;
    }>(control.db.pool, 'SELECT session_epoch FROM runtime_nodes WHERE node_id=?', [nodeId]))[0]!.session_epoch;
    assert.ok(currentSession > before.session_epoch);
    assert.equal((await call('GET', '/agent/v2/snapshot', undefined, cliCredential, { 'x-tunex-session-epoch': String(currentSession) })).status, 200);
    passed('SEC-06/ADP-13: Agent --rotate atomically installs a keypair and restarts only through a fresh online session');
    const revoked = await call('POST', `/api/v1/scopes/${scope}/nodes/${nodeId}/revoke`, {}, undefined, { 'idempotency-key': 'revoke-node' });
    assert.equal(revoked.status, 202);
    assert.deepEqual(await call('POST', `/api/v1/scopes/${scope}/nodes/${nodeId}/revoke`, {}, undefined, { 'idempotency-key': 'revoke-node' }), revoked);
    const latePolicy = await call('PUT', `/api/v1/scopes/${scope}/nodes/${nodeId}/policy`, { expectedRevision: 4, policy: { ...policy, egressPolicyRevision: 5 } }, undefined, { 'idempotency-key': 'revoked-policy' });
    assert.equal(latePolicy.status, 403);
    assert.equal((await call('GET', '/agent/v2/snapshot', undefined, rotated, epoch)).status, 403);
    assert.equal((await call('GET', '/agent/v2/snapshot', undefined, cliCredential, { 'x-tunex-session-epoch': String(currentSession) })).status, 403);
    assert.equal((await call('POST', '/agent/v2/credentials/rotate', rotation, cliCredential, { 'x-tunex-session-epoch': String(currentSession) })).status, 403);
    await until(async () => (await rows<{
        body: any;
    }>(control!.db.pool, 'SELECT body FROM snapshots WHERE node_id=? ORDER BY generation DESC LIMIT 1', [nodeId]))[0]!.body.assignments.length === 0);
    const view = await call('GET', `/api/v1/scopes/${scope}/nodes/${nodeId}`);
    assert.equal(view.body.revoked, true);
    assert.equal(view.body.pendingRevocation, true);
    assert.ok(view.body.latestAuthorizationUntil);
    const cliRevoke = await run(process.execPath, ['apps/control/src/client.ts', 'node-revoke', scope, nodeId, 'revoke-node'], { env: cliEnvironment });
    assert.deepEqual(JSON.parse(cliRevoke.stdout), revoked.body);
    const cliView = await run(process.execPath, ['apps/control/src/client.ts', 'node-get', scope, nodeId], { env: cliEnvironment });
    assert.equal(JSON.parse(cliView.stdout).revoked, true);
    const highwater = (await rows<{
        session_epoch: number;
        snapshot_generation: number;
    }>(control.db.pool, 'SELECT session_epoch,snapshot_generation FROM runtime_nodes WHERE node_id=?', [nodeId]))[0]!;
    assert.equal(highwater.session_epoch, currentSession);
    assert.ok(highwater.snapshot_generation > before.snapshot_generation);
    passed('SEC-06: revocation rejects every credential, stops renewal, preserves counters and exposes historical cutoff');
    const auditRows = await rows<{
        kind: string;
        details: unknown;
    }>(control.db.pool, 'SELECT kind,details FROM node_security_events WHERE node_id=?', [nodeId]);
    assert.equal(auditRows.filter(row => row.kind === 'credential_rotation').length, 2);
    assert.equal(auditRows.filter(row => row.kind === 'policy_update').length, 3);
    assert.equal(auditRows.filter(row => row.kind === 'node_revocation').length, 1);
    const auditText = JSON.stringify(auditRows);
    assert.ok(!auditText.includes('PRIVATE KEY') && !auditText.includes(ownerToken));
    passed('Node security audit: retries do not duplicate policy/credential events or store private keys');
    const deletion = await call('DELETE', `/api/v1/scopes/${scope}/forwards/${forwardId}`, { expectedRevision: 1 }, undefined, { 'idempotency-key': 'delete-revoked' });
    assert.equal(deletion.status, 202);
    passed('Node cleanup: revoked identity can still be safely deleted by its authorized owner');
    assert.ok(!agentErrors.includes('PERSISTENCE_FAILURE'), agentErrors);
    const commit = (await run('git', ['rev-parse', 'HEAD'])).stdout.trim(), dirty = Boolean((await run('git', ['status', '--porcelain'])).stdout.trim());
    await writeFile(join(directory, 'evidence.json'), JSON.stringify({ commit, workingTreeDirty: dirty, command: 'npm run test:security', checks, agentSHA: createHash('sha256').update(await readFile(binary)).digest('hex'), environment: { platform: platform(), kernel: release(), mysql: (await rows<{
                version: string;
            }>(control.db.pool, 'SELECT VERSION() version'))[0]!.version } }, null, 2));
    console.log(`Node security passed: ${checks.length} checks. Evidence ${directory}`);
}
finally {
    for (const socket of sockets)
        socket.destroy();
    await kill(agent);
    await kill(target);
    await control?.close();
    await administrator.query(`DROP DATABASE \`${database}\``);
    await administrator.end();
}
