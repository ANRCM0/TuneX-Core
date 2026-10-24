import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import { createServer } from 'node:net';
import type { Socket } from 'node:net';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { promisify } from 'node:util';
import { createConnection } from 'mysql2/promise';
import { DEFAULT_POLICY, parseRuntimeMessage } from '@tunex/contracts';
import { startControl } from '../../apps/control/src/server.ts';
import { newToken } from '../../apps/control/src/modules/identity.ts';
import { json, rows, write } from '../../apps/control/src/infrastructure/mysql.ts';
import { issueFromConsole, verifyDisabledConsole, verifyHistoricalConsole } from './probe-console.ts';
import { verifyRuleConsole } from './rule-console.ts';
import { verifyControlledEcho } from './product-p-observation.ts';
import { verifyProductConsole, verifyProductUsageConsole } from './product-p-console.ts';

if (process.platform !== 'linux' || !process.env.GITHUB_ACTIONS || !process.env.TUNEX_TEST_DATABASE_URL)
    throw new Error('Probe combined acceptance requires disposable MySQL and a native Linux GitHub Actions runner');
const execute = promisify(execFile), openssl = process.env.TUNEX_OPENSSL ?? 'openssl';
await mkdir('.artifacts/probe', { recursive: true });
const directory = await mkdtemp(resolve('.artifacts/probe/run-'));
const caKey = join(directory, 'ca.key'), caCert = join(directory, 'ca.pem');
const serverKey = join(directory, 'server.key'), serverCert = join(directory, 'server.pem');
const binary = resolve('.artifacts/tunex-agent'), database = 'tunex_probe_e2e_' + randomUUID().replaceAll('-', '');
const databaseUrl = new URL(process.env.TUNEX_TEST_DATABASE_URL), admin = await createConnection(databaseUrl.toString());
databaseUrl.pathname = '/' + database;
const token = newToken(), actor = 'probe-owner', scope = 'probe-scope', checks: string[] = [];
const attempts: { probeId: string; connected: number; resultAccepted: boolean }[] = [];
const policy = { ...DEFAULT_POLICY, pollIntervalSeconds: 1, leaseSeconds: 60, renewalLeadSeconds: 20, maxClockSkewSeconds: 1 };
const browserEnabled = process.env.TUNEX_PROBE_BROWSER === '1';
const productP = process.env.TUNEX_PRODUCT_P_ACCEPTANCE === '1';
let control: Awaited<ReturnType<typeof startControl>> | undefined, agent: ChildProcess | undefined;
let createdDatabase = false, ca: Buffer, agentArgs: string[] = [], nodeId = '', forwardId = '';
let connections = 0, eof = 0, applicationBytes = 0;
const sockets = new Set<Socket>();
const ruleSockets = new Set<Socket>();
const ruleTarget = createServer(socket => {
    ruleSockets.add(socket); socket.on('data', bytes => socket.write(bytes)); socket.on('error', () => {});
    socket.on('close', () => ruleSockets.delete(socket));
});
const target = createServer(socket => {
    connections++; sockets.add(socket);
    socket.setTimeout(3000, () => socket.destroy());
    socket.on('data', bytes => { applicationBytes += bytes.length; });
    socket.on('end', () => { eof++; });
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
});
function passed(value: string) { checks.push(value); console.log('PASS ' + value); }
async function call(method: string, path: string, input?: unknown, key: string = randomUUID(), machine?: { cert: Buffer; key: Buffer; epoch: number }) {
    const body = input === undefined ? undefined : JSON.stringify(input);
    return new Promise<{ status: number; body: any }>((resolve, reject) => {
        const outgoing = request({ hostname: '127.0.0.1', port: control!.port, path, method, ca, agent: false,
            ...(machine ? { cert: machine.cert, key: machine.key } : {}), timeout: 5000,
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key,
                ...(body === undefined ? {} : { 'content-length': Buffer.byteLength(body) }),
                ...(machine ? { 'x-tunex-session-epoch': String(machine.epoch) } : {}) } }, incoming => {
            const chunks: Buffer[] = []; let size = 0;
            incoming.on('data', chunk => { size += chunk.length; if (size > 65536) incoming.destroy(new Error('Bounded API reply required')); else chunks.push(chunk); });
            incoming.on('error', reject);
            incoming.on('end', () => { try { resolve({ status: incoming.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()) }); } catch (error) { reject(error); } });
        });
        outgoing.on('timeout', () => outgoing.destroy(new Error('Probe acceptance API timeout')));
        outgoing.on('error', reject); outgoing.end(body);
    });
}
async function until(check: () => Promise<boolean>, label: string, timeout = 20000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        if (agent && (agent.exitCode !== null || agent.signalCode !== null)) throw new Error('Agent exited before ' + label);
        if (await check()) return;
        await sleep(25);
    }
    throw new Error('Timed out: ' + label);
}
async function ready(afterEpoch = 0) {
    await until(async () => {
        const [current] = await rows<{ session_epoch: number; snapshot_generation: number; last_report: unknown;
            body: unknown; valid_until: number; instance_until: number }>(control!.db.pool,
        `SELECT r.session_epoch,r.snapshot_generation,r.last_report,s.body,s.valid_until,i.expires_at instance_until
         FROM runtime_nodes r JOIN snapshots s ON s.node_id=r.node_id AND s.generation=r.snapshot_generation AND s.session_epoch=r.session_epoch
         JOIN probe_instances i ON i.node_id=r.node_id AND i.session_epoch=r.session_epoch AND i.boot_id=r.boot_id AND i.state='registered'
         WHERE r.node_id=?`, [nodeId]);
        if (!current || current.session_epoch <= afterEpoch || current.valid_until < Date.now() + 10000 ||
            current.instance_until < Date.now() + 10000 || !current.last_report) return false;
        const snapshot = parseRuntimeMessage('Snapshot', JSON.stringify(json(current.body)));
        const report = parseRuntimeMessage('ReportRequest', JSON.stringify(json(current.last_report)));
        const assignment = snapshot.assignments.find(a => a.forwardId === forwardId && a.protocol === 'tcp' && a.phase === 'active');
        return Boolean(assignment && report.acceptedSnapshotGeneration === current.snapshot_generation &&
            report.observations.some(o => o.assignmentId === assignment.assignmentId && o.condition === 'ready'));
    }, 'registered Agent with current active Direct report');
}
function startAgent(execution: boolean) {
    agent = spawn(binary, [...agentArgs, '--probe-registration', ...(execution ? ['--probe-execution',
        ...(productP?['--probe-ingress','--probe-services','--probe-echo']:[])] : [])], { stdio: 'ignore' });
    agent.once('error', () => { console.error('Agent process could not start'); });
}
async function stopAgent() {
    if (!agent) return;
    const child = agent; agent = undefined;
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGCONT'); child.kill('SIGTERM');
    for (let i = 0; i < 100 && child.exitCode === null && child.signalCode === null; i++) await sleep(50);
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); throw new Error('Agent did not stop gracefully'); }
}
const issue = (key: string = randomUUID()) => call('POST', `/api/v1/scopes/${scope}/forwards/${forwardId}/probes`,
    { version: 1, kind: 'tcp-connect', expectedRevision: 1, timeoutMs: 500 }, key);
async function cooldown(expiresAt: string) { await sleep(Math.max(0, Date.parse(expiresAt) + 1001 - Date.now())); }
async function evidence(status: 'passed' | 'failed') {
    const commit = (await execute('git', ['rev-parse', 'HEAD'])).stdout.trim();
    await writeFile(join(directory, 'evidence.json'), JSON.stringify({ status, commit,
        workingTreeDirty: Boolean((await execute('git', ['status', '--porcelain'])).stdout.trim()),
        command: 'npm run test:probe', checks, policy, attempts, target: { connections, eof, applicationBytes },
        browser: { enabled: browserEnabled, engine: 'Chromium', viewports: browserEnabled ? ['1440x1000', '390x844'] : [],
            certificateTrust: 'Isolated test context ignores disposable fixture CA; not production browser trust evidence' },
        agentSHA: createHash('sha256').update(await readFile(binary)).digest('hex'),
        topology: 'Native Linux Control, real Agent process, mTLS, disposable MySQL and TCP target on one Actions host; not physical-host proof' }, null, 2));
}
try {
    await execute(openssl, ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
        '-keyout', caKey, '-out', caCert, '-days', '1', '-subj', '/CN=Probe Acceptance CA']);
    await execute(openssl, ['req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
        '-keyout', serverKey, '-out', join(directory, 'server.csr'), '-subj', '/CN=localhost']);
    await writeFile(join(directory, 'server.ext'), 'subjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n');
    await execute(openssl, ['x509', '-req', '-in', join(directory, 'server.csr'), '-CA', caCert, '-CAkey', caKey,
        '-set_serial', '1', '-out', serverCert, '-days', '1', '-extfile', join(directory, 'server.ext')]);
    ca = await readFile(caCert);
    await admin.query(`CREATE DATABASE \`${database}\``); createdDatabase = true;
    const options = { databaseUrl: databaseUrl.toString(), caCert, caKey, serverKey, serverCert, openssl,
        stateDirectory: join(directory, 'control'), initializeAuthority: true, port: 0, host: '127.0.0.1', policy };
    control = await startControl(options);
    await control.control.identity.bootstrap(scope, actor, token);
    forwardId = 'unused-forward';
    assert.equal((await issue()).body.code, 'PROBE_DISABLED');
    assert.equal((await rows<{ n: number }>(control.db.pool, 'SELECT COUNT(*) n FROM probe_permits'))[0]!.n, 0);
    assert.equal((await rows<{ n: number }>(control.db.pool, 'SELECT COUNT(*) n FROM idempotency'))[0]!.n, 0);
    passed('Control issuance defaults off and rolls back idempotency without creating permits');
    if (browserEnabled) {
        await verifyDisabledConsole({ url: `https://127.0.0.1:${control.port}`, scope, token, directory });
        passed('Real HTTPS Chromium Console keeps credentials out of storage, respects disabled selection, reads native declarations and publishes/previews an unreferenced immutable Profile without deployment');
    }
    await control.close(); control = undefined; control = await startControl({ ...options, probeExecutionEnabled: true,
        probeIngressEnabled:productP,probeServicesEnabled:productP,probeEchoEnabled:productP,probePathEchoEnabled:productP });
    await new Promise<void>(resolve => target.listen(0, '127.0.0.1', resolve));
    const targetPort = (target.address() as { port: number }).port;
    const reservations = await Promise.all(Array.from({ length: (browserEnabled ? 3 : 1)+(productP?1:0) }, async () => {
        const server = createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); return server;
    }));
    const ingressPorts = reservations.map(server => (server.address() as { port: number }).port), ingressPort = ingressPorts[0]!;
    if (browserEnabled) await new Promise<void>(resolve => ruleTarget.listen(0, '127.0.0.1', resolve));
    await Promise.all(reservations.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
    const provision = await call('POST', `/api/v1/scopes/${scope}/shared-nodes`, { allowedListenerAddresses: ['127.0.0.1'],
        allowedPorts: ingressPorts, egressPolicyRevision: 1, allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false });
    assert.equal(provision.status, 201); nodeId = provision.body.nodeId;
    const useGrant = await call('PUT', `/api/v1/scopes/${scope}/nodes/${nodeId}/grants/${actor}`,
        { expectedRevision: 1, allowed: true, allowedRoles: ['ingress'] });
    assert.equal(useGrant.status, 202); assert.equal(useGrant.body.revision, 2);
    agentArgs = ['--control', `https://127.0.0.1:${control.port}`, '--node', nodeId, '--ca', caCert,
        '--state', join(directory, 'agent-state'), '--journal-key', join(directory, 'secrets', 'journal.key')];
    await execute(binary, [...agentArgs, '--enroll'], { env: { ...process.env, TUNEX_ENROLLMENT_TOKEN: provision.body.enrollmentToken } });
    startAgent(false);
    await until(async () => {
        const [current] = await rows<{ session_epoch: number; facts: unknown }>(control!.db.pool,
            'SELECT r.session_epoch,n.facts FROM nodes n JOIN runtime_nodes r ON r.node_id=n.id WHERE n.id=?', [nodeId]);
        const facts = current ? json<{ capabilities: string[] }>(current.facts) : null;
        return Boolean(current?.session_epoch && ['adp.3', 'native.direct.v1', 'tcp'].every(capability => facts?.capabilities.includes(capability)));
    }, 'real Agent Hello capability publication before Direct authoring');
    const created = await call('POST', `/api/v1/scopes/${scope}/forwards`, { enabled: true, protocols: ['tcp'],
        ingress: { nodeId, listen: { address: '127.0.0.1', port: ingressPort } }, target: { host: '127.0.0.1', port: targetPort } });
    assert.equal(created.status, 202, JSON.stringify(created.body)); forwardId = created.body.forwardId;
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${created.body.operationId}`)).body.status === 'succeeded', 'Direct acceptance');
    await ready();
    const browserIssue = browserEnabled ? await issueFromConsole({ url: `https://127.0.0.1:${control.port}`, scope, token, directory }, forwardId) : null;
    const disabledKey = browserIssue?.key ?? randomUUID(), inactive = browserIssue ?? await issue(disabledKey);
    assert.equal(inactive.status, 202); await sleep(2200);
    const unused = await call('GET', `/api/v1/scopes/${scope}/probes/${inactive.body.probeId}`);
    if (browserEnabled && unused.status === 404) assert.equal(unused.body.code, 'NOT_FOUND');
    else { assert.equal(unused.status, 200); assert.equal(unused.body.state, browserEnabled ? 'revoked' : 'issued'); assert.equal(unused.body.result, null); }
    assert.equal(connections, 0);
    assert.deepEqual((await issue(disabledKey)).body, inactive.body);
    const inactiveRevocation = await call('POST', `/api/v1/scopes/${scope}/probes/${inactive.body.probeId}/revoke`, {});
    assert.ok(inactiveRevocation.status === 200 || browserEnabled && inactiveRevocation.status === 404);
    passed('Registration-only real Agent never polls, consumes, connects or reports issued tasks');
    if (browserEnabled) passed('Real desktop/mobile Console issues once, replays a lost committed acceptance with the same key, queries/revokes and clears on disconnect');
    await cooldown(inactive.body.expiresAt);
    const [old] = await rows<{ session_epoch: number }>(control.db.pool, 'SELECT session_epoch FROM runtime_nodes WHERE node_id=?', [nodeId]);
    await stopAgent(); startAgent(true); await ready(old!.session_epoch);
    let key = '', accepted: Awaited<ReturnType<typeof issue>> | undefined, receipt: any;
    // Best-effort tasks can expire before discovery. Distinct explicit commands never retry a spent ID.
    for (let attempt = 0; attempt < 4; attempt++) {
        await ready(); await sleep(125 + attempt * 173);
        const before = connections;
        key = randomUUID(); accepted = await issue(key); assert.equal(accepted.status, 202);
        assert.deepEqual((await issue(key)).body, accepted.body);
        do {
            receipt = await call('GET', `/api/v1/scopes/${scope}/probes/${accepted.body.probeId}`);
            assert.equal(receipt.status, 200);
            if (receipt.body.result) break;
            await sleep(25);
        } while (Date.now() < Date.parse(accepted.body.expiresAt) + 100);
        assert.ok(connections - before <= 1, 'One permit opened multiple target sockets');
        attempts.push({ probeId: accepted.body.probeId, connected: connections - before, resultAccepted: Boolean(receipt.body.result) });
        if (receipt.body.result) { assert.equal(connections - before, 1); break; }
        await cooldown(accepted.body.expiresAt);
    }
    assert.ok(accepted && receipt.body.result, 'No bounded independent task completed the real workflow');
    const successful = accepted, stableConnections = connections;
    await until(async () => eof === stableConnections, 'zero application payload EOF');
    assert.equal(applicationBytes, 0); assert.equal(receipt.body.state, 'consumed');
    assert.equal(receipt.body.health, 'unknown'); assert.equal(receipt.body.executionEnabled, false);
    assert.equal(receipt.body.result.body.source, 'agent-reported'); assert.equal(receipt.body.result.body.applicationHealth, 'unknown');
    assert.equal(receipt.body.result.body.status, 'connected'); assert.equal(receipt.body.result.historical, true);
    if (browserEnabled) {
        await verifyHistoricalConsole({ url: `https://127.0.0.1:${control.port}`, scope, token, directory }, successful.body.probeId);
        passed('Real Console displays a successful actual Agent TCP receipt as historical/agent-reported with unknown application health');
    }
    const [counts] = await rows<{ n: number }>(control.db.pool, 'SELECT COUNT(*) n FROM probe_results WHERE permit_id=?', [successful.body.probeId]);
    assert.equal(counts!.n, 1);
    const [permit] = await rows<{ instance_id: string; instance_generation: number; binding: unknown }>(control.db.pool,
        'SELECT instance_id,instance_generation,binding FROM probe_permits WHERE id=?', [successful.body.probeId]);
    const binding = json<{ bootId: string; sessionEpoch: number }>(permit!.binding);
    const repeat = { protocolVersion: 3, probeVersion: 1, kind: 'probe-claim', nodeId, bootId: binding.bootId, sessionEpoch: binding.sessionEpoch,
        instanceId: permit!.instance_id, instanceGeneration: permit!.instance_generation, permitId: successful.body.probeId };
    assert.equal((await call('POST', '/agent/v3/probe/claim', repeat)).status, 401);
    const machine = { cert: await readFile(join(directory, 'agent-state', 'node.pem')), key: await readFile(join(directory, 'agent-state', 'private.pem')), epoch: binding.sessionEpoch };
    assert.equal((await call('POST', '/agent/v3/probe/claim', repeat, randomUUID(), machine)).status, 409);
    await cooldown(successful.body.expiresAt); assert.deepEqual((await issue(key)).body, successful.body); assert.equal(connections, stableConnections);
    passed('Real poll/claim/watch/zero-payload connect/report commits one result; lost-client replay and spent mTLS claim cannot reexecute');
    if(productP){
        if(browserEnabled)for(const check of await verifyProductConsole({url:`https://127.0.0.1:${control.port}`,scope,token,directory}))passed('P Console '+check);
        for(const check of await verifyControlledEcho({scopeId:scope,nodeId,mode:'direct',directory,listenPort:ingressPorts.at(-1)!,spec:{},discovery:control.control.probeEcho,
            ...(browserEnabled?{usage:{actorId:actor,display:()=>verifyProductUsageConsole({url:`https://127.0.0.1:${control!.port}`,scope,token,directory},nodeId,actor)}}:{}),
            call:(method,path,input,key)=>call(method,`/api/v1/scopes/${scope}/`+path,input,key),
            tick:async()=>{await control!.runtime.tick();},qualified:async()=>{
                const result=await rows<{n:number}>(control!.db.pool,"SELECT COUNT(*) n FROM probe_type_qualifications q JOIN runtime_nodes r ON r.node_id=q.node_id AND r.session_epoch=q.session_epoch WHERE q.node_id=? AND q.state='qualified' AND q.echo_version=1 AND q.expires_at>?",[nodeId,Date.now()+2000]);
                return result[0]!.n===1;
            }}))passed('P Direct '+check);
    }
    await ready(); agent!.kill('SIGSTOP');
    try {
        const withdrawn = await issue(); assert.equal(withdrawn.status, 202);
        assert.equal((await call('POST', `/api/v1/scopes/${scope}/probes/${withdrawn.body.probeId}/revoke`, {})).status, 200);
        assert.equal((await call('POST', `/api/v1/scopes/${scope}/probes/${withdrawn.body.probeId}/revoke`, {})).status, 200);
    } finally { agent!.kill('SIGCONT'); }
    await sleep(3100); assert.equal(connections, stableConnections); assert.equal(applicationBytes, 0);
    passed('Explicit revocation before delivery stays closed across repeated manager requests');
    if (browserEnabled) {
        await verifyRuleConsole({ url: `https://127.0.0.1:${control.port}`, scope, token, directory, sourceId: forwardId,
            listenerPorts: [ingressPorts[1]!, ingressPorts[2]!], targetPort: (ruleTarget.address() as { port: number }).port,
            injectFailedOperation: async id => {
                assert.equal(await write(control!.db.pool, "UPDATE operations SET status='failed',last_error=?,cleanup_pending=TRUE WHERE id=? AND status='succeeded'",
                    [JSON.stringify({ code: 'TEST_INJECTED_FAILURE', retryable: true }), id]), 1);
            } });
        passed('Real Chromium copies disabled Direct rules, sends partial-CAS batches, validates actual Agent TCP bytes, replays a lost committed response with the same key and explicitly retries a fixture-injected failed Operation without changing desired revision');
    }
    await ready(); agent!.kill('SIGSTOP');
    try {
        const blocked = await issue(); assert.equal(blocked.status, 202);
        const grants = await call('GET', `/api/v1/scopes/${scope}/nodes/${nodeId}/grants`); assert.equal(grants.status, 200);
        const removed = await call('PUT', `/api/v1/scopes/${scope}/nodes/${nodeId}/grants/${actor}`, { expectedRevision: grants.body.revision, allowed: false });
        assert.ok([200, 202].includes(removed.status));
        assert.equal((await issue()).status, 404);
    } finally { agent!.kill('SIGCONT'); }
    await sleep(2200); assert.equal(connections, stableConnections); assert.equal(applicationBytes, 0);
    passed('Original Actor Node Grant withdrawal blocks issued tasks and all later issuance without target traffic');
    await stopAgent();
    const [slot] = await rows<{ state: string }>(control.db.pool, 'SELECT state FROM probe_instances WHERE node_id=?', [nodeId]);
    assert.equal(slot!.state, 'revoked');
    passed('Graceful real Agent shutdown closes and remotely revokes the instance without Journal downgrade');
    await evidence('passed');
    console.log(`Probe combined acceptance passed: ${checks.length} checks`);
} catch (error) {
    await evidence('failed').catch(() => {});
    throw error;
} finally {
    await stopAgent().catch(() => {});
    for (const socket of sockets) socket.destroy();
    for (const socket of ruleSockets) socket.destroy();
    if (ruleTarget.listening) await new Promise<void>(resolve => ruleTarget.close(() => resolve()));
    if (target.listening) await new Promise<void>(resolve => target.close(() => resolve()));
    await control?.close();
    if (createdDatabase) await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
}
