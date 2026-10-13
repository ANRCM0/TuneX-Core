import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { platform, release, arch } from 'node:os';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { request as httpsRequest } from 'node:https';
import { createServer, connect } from 'node:net';
import { createSocket } from 'node:dgram';
import { once } from 'node:events';
import { mkdir, readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createConnection } from 'mysql2/promise';
import { startControl } from '../../apps/control/src/server.ts';
import { timeProofArguments } from '../time-proof.ts';
import type { ForwardSpec } from '@tunex/core';
import { newToken } from '../../apps/control/src/modules/identity.ts';
import { rows, write } from '../../apps/control/src/infrastructure/mysql.ts';
const exec = promisify(execFile);
const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL;
if (!databaseUrl)
    throw new Error('TUNEX_TEST_DATABASE_URL must point at a disposable MySQL database');
const openssl = process.env.TUNEX_OPENSSL ?? 'openssl';
await mkdir('.artifacts/phase2', { recursive: true });
const directory = await mkdtemp(resolve('.artifacts/phase2/run-'));
const caKey = join(directory, 'ca.key'), caCert = join(directory, 'ca.pem'), serverKey = join(directory, 'server.key'), serverCert = join(directory, 'server.pem');
await exec(openssl, ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', caKey, '-out', caCert, '-days', '2', '-subj', '/CN=TuneX Acceptance CA']);
await exec(openssl, ['req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', serverKey, '-out', join(directory, 'server.csr'), '-subj', '/CN=localhost']);
await writeFile(join(directory, 'server.ext'), 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n');
await exec(openssl, ['x509', '-req', '-in', join(directory, 'server.csr'), '-CA', caCert, '-CAkey', caKey, '-set_serial', '1', '-out', serverCert, '-days', '1', '-extfile', join(directory, 'server.ext')]);
const ca = await readFile(caCert);
const administrator = await createConnection(databaseUrl);
const database = `tunex_test_${randomUUID().replaceAll('-', '')}`;
await administrator.query(`CREATE DATABASE \`${database}\``);
const url = new URL(databaseUrl);
url.pathname = `/${database}`;
let server: Awaited<ReturnType<typeof startControl>> | undefined;
let agent: ReturnType<typeof spawn> | undefined;
let target: ReturnType<typeof spawn> | undefined;
const checks: string[] = [];
const check = (message: string) => { checks.push(message); console.log(`PASS ${message}`); };
const scope = 'scope-test', actor = 'owner-test', token = newToken();
async function call(method: string, path: string, payload?: unknown, extra: Record<string, string> = {}, machine?: {
    cert: Buffer;
    key: Buffer;
}): Promise<{
    status: number;
    body: any;
}> {
    const raw = payload === undefined ? undefined : JSON.stringify(payload);
    return new Promise((resolve, reject) => {
        const request = httpsRequest({ hostname: '127.0.0.1', port: server!.port, path, method, ca, ...machine, headers: { 'content-type': 'application/json', ...(raw ? { 'content-length': String(Buffer.byteLength(raw)) } : {}), ...(machine ? {} : { authorization: `Bearer ${token}` }), ...extra } }, response => {
            const chunks: Buffer[] = [];
            response.on('data', value => chunks.push(value));
            response.on('end', () => { try {
                resolve({ status: response.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()) });
            }
            catch (error) {
                reject(error);
            } });
        });
        request.on('error', reject);
        request.end(raw);
    });
}
async function eventually(action: () => Promise<boolean>, timeout = 45000): Promise<void> { const start = Date.now(); while (Date.now() - start < timeout) {
    if (await action())
        return;
    await new Promise(resolve => setTimeout(resolve, 100));
} throw new Error('Acceptance condition timed out'); }
async function freePort(): Promise<number> { const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening'); const port = (socket.address() as {
    port: number;
}).port; await new Promise<void>(resolve => socket.close(() => resolve())); return port; }
const agentPath = resolve('.artifacts', process.platform === 'win32' ? 'tunex-agent.exe' : 'tunex-agent');
try {
    server = await startControl({ databaseUrl: url.toString(), caCert, caKey, serverKey, serverCert, openssl, stateDirectory: join(directory, 'control'), initializeAuthority:true, port: 0, worker: false });
    await server.control.identity.bootstrap(scope, actor, token);
    target = spawn(process.execPath, ['scripts/phase1/echo-target.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const targetLine = await new Promise<string>((resolve, reject) => { target!.stdout!.once('data', chunk => resolve(chunk.toString())); target!.once('error', reject); });
    const targetPort = JSON.parse(targetLine).port as number, port = await freePort(), port2 = await freePort(), port3 = await freePort();
    const policy = { allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [port, port2, port3], egressPolicyRevision: 1, allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false };
    const provision = await call('POST', `/api/v1/scopes/${scope}/nodes`, policy);
    assert.equal(provision.status, 201);
    const { nodeId, enrollmentToken } = provision.body;
    const state = join(directory, 'agent'), protection = join(directory, 'secrets', 'journal.key');
    const args = ['--control', `https://127.0.0.1:${server.port}`, '--node', nodeId, '--ca', caCert, '--state', state, '--journal-key', protection,...timeProofArguments()];
    await exec(agentPath, [...args, '--enroll'], { env: { ...process.env, TUNEX_ENROLLMENT_TOKEN: enrollmentToken } });
    check('SEC-05: trusted enrollment binds one Node certificate');
    agent = spawn(agentPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let agentLog = '';
    agent.stderr!.on('data', chunk => { agentLog += chunk.toString(); });
    await eventually(async () => ((await rows<{
        session_epoch: number;
    }>(server!.db.pool, 'SELECT session_epoch FROM runtime_nodes WHERE node_id=?', [nodeId]))[0]!.session_epoch) > 0);
    const machine = { cert: await readFile(join(state, 'node.pem')), key: await readFile(join(state, 'private.pem')) };
    const csr = await readFile(join(state, 'enrollment.csr'), 'utf8');
    const enrollmentReplay = await call('POST', '/enrollment/v1', { nodeId, token: enrollmentToken, csr });
    assert.equal(enrollmentReplay.status, 200);
    assert.equal(enrollmentReplay.body.certificate, machine.cert.toString());
    const enrollmentReuse = await call('POST', '/enrollment/v1', { nodeId, token: enrollmentToken, csr: csr + '\n' });
    assert.equal(enrollmentReuse.status, 409);
    check('SEC-05: identical enrollment retries reuse one certificate; changed CSR cannot reuse token');
    const spec: ForwardSpec = { enabled: true, protocols: ['tcp'], ingress: { nodeId, listen: { address: '127.0.0.1', port } }, target: { host: '127.0.0.1', port: targetPort } };
    const accepted = await call('POST', `/api/v1/scopes/${scope}/forwards`, spec, { 'idempotency-key': 'create-one' });
    assert.equal(accepted.status, 202, JSON.stringify(accepted.body));
    const replay = await call('POST', `/api/v1/scopes/${scope}/forwards`, spec, { 'idempotency-key': 'create-one' });
    assert.deepEqual(replay, accepted);
    check('API-01: lost-response retry returns identical persistent resource/operation IDs');
    const conflict = await call('POST', `/api/v1/scopes/${scope}/forwards`, { ...spec, target: { ...spec.target, port: targetPort + 1 } }, { 'idempotency-key': 'create-one' });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.code, 'IDEMPOTENCY_CONFLICT');
    const parallel = await Promise.all([call('POST', `/api/v1/scopes/${scope}/forwards`, spec, { 'idempotency-key': 'create-one' }), call('POST', `/api/v1/scopes/${scope}/forwards`, spec, { 'idempotency-key': 'create-one' })]);
    assert.deepEqual(parallel, [accepted, accepted]);
    check('API-02: same-key concurrency replays; changed input conflicts');
    const occupied = await call('POST', `/api/v1/scopes/${scope}/forwards`, spec, { 'idempotency-key': 'port-conflict' });
    assert.equal(occupied.status, 409);
    assert.equal(occupied.body.code, 'PORT_RESERVED');
    const counts = await rows<{
        n: number;
    }>(server.db.pool, 'SELECT COUNT(*) n FROM forwards');
    assert.equal(counts[0]!.n, 1);
    const idempotency = await rows<{
        n: number;
    }>(server.db.pool, "SELECT COUNT(*) n FROM idempotency WHERE request_key='port-conflict'");
    assert.equal(idempotency[0]!.n, 0);
    check('FWD-08/API-05: conflicting acceptance rolls back intent, slots, Operation and key');
    const crashedClaim = await server.db.transaction(tx => server!.control.ledger.claim(tx));
    assert.equal(crashedClaim?.id, accepted.body.operationId);
    await server.db.transaction(tx => write(tx, 'UPDATE operations SET claim_until=? WHERE id=?', [Date.now() - 1, accepted.body.operationId]));
    const recovered = await server.db.transaction(tx => server!.control.ledger.claim(tx));
    assert.equal(recovered?.id, accepted.body.operationId);
    assert.notEqual(recovered?.claim_token, crashedClaim?.claim_token);
    await server.db.transaction(tx => write(tx, 'UPDATE operations SET claim_until=? WHERE id=?', [Date.now() - 1, accepted.body.operationId]));
    await server.runtime.tick();
    check('OPS-01: persistent scanner rediscovers committed work and fences an expired Worker claim');
    await eventually(async () => { const result = await call('GET', `/api/v1/scopes/${scope}/operations/${accepted.body.operationId}`); return result.body.status === 'succeeded'; });
    const resource = await call('GET', `/api/v1/scopes/${scope}/forwards/${accepted.body.forwardId}`);
    assert.equal(resource.body.health.condition, 'ready');
    assert.equal(resource.body.desired.revision, 1);
    check('ADP-11: persistent matching report advances current Operation to succeeded');
    const payload = Buffer.from('TuneX Phase 1 bidirectional TCP\n' + randomUUID());
    await new Promise<void>((resolve, reject) => { const socket = connect(port, '127.0.0.1'); const chunks: Buffer[] = []; socket.setTimeout(5000, () => socket.destroy(new Error('TCP timeout'))); socket.on('error', reject); socket.on('connect', () => socket.end(payload)); socket.on('data', value => chunks.push(value)); socket.on('end', () => { try {
        assert.deepEqual(Buffer.concat(chunks), payload);
        resolve();
    }
    catch (error) {
        reject(error);
    }
    finally {
        socket.destroy();
    } }); });
    check('FWD-01: independent Agent/target processes echo exact payload with TCP half-close');
    const resourcePath = `/api/v1/scopes/${scope}/forwards/${accepted.body.forwardId}`;
    async function opStatus(id: string): Promise<string> { return (await call('GET', `/api/v1/scopes/${scope}/operations/${id}`)).body.status; }
    async function awaitSuccess(id: string): Promise<void> { await server!.runtime.tick(); await eventually(async () => await opStatus(id) === 'succeeded'); }
    async function exchange(socket: ReturnType<typeof connect>, text: string): Promise<string> { return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('stream exchange timed out')), 5000); socket.once('error', reject); socket.once('data', chunk => { clearTimeout(timer); resolve(chunk.toString()); }); socket.write(text); }); }
    const persistent = connect(port, '127.0.0.1');
    persistent.on('error', () => { });
    await once(persistent, 'connect');
    assert.equal(await exchange(persistent, 'old-first'), 'old-first');
    const newTarget = spawn(process.execPath, ['scripts/phase1/echo-target.mjs', 'new:'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const newTargetPort = JSON.parse(await new Promise<string>(resolve => newTarget.stdout!.once('data', chunk => resolve(chunk.toString())))).port as number;
    try {
        const revisedSpec: ForwardSpec = { ...spec, target: { host: '127.0.0.1', port: newTargetPort } };
        const changed = await call('PUT', resourcePath, { expectedRevision: 1, spec: revisedSpec }, { 'idempotency-key': 'replace-target' });
        assert.equal(changed.status, 202, JSON.stringify(changed.body));
        assert.deepEqual(await call('PUT', resourcePath, { expectedRevision: 1, spec: revisedSpec }, { 'idempotency-key': 'replace-target' }), changed);
        await server!.runtime.tick();
        await eventually(async () => { const row = await call('GET', resourcePath); return row.body.applied.some((o: any) => o.condition === 'ready' && o.deploymentGeneration === 2); });
        assert.equal(await exchange(persistent, 'old-after'), 'old-after');
        const fresh = connect(port, '127.0.0.1');
        fresh.on('error', () => { });
        await once(fresh, 'connect');
        assert.equal(await exchange(fresh, 'fresh'), 'new:fresh');
        fresh.destroy();
        assert.equal(await opStatus(changed.body.operationId), 'running');
        persistent.destroy();
        await eventually(async () => await opStatus(changed.body.operationId) === 'succeeded');
        check('FWD-11: target update transfers listener, preserves old streams and awaits drain before success');
        const noop = await call('PUT', resourcePath, { expectedRevision: 2, spec: revisedSpec }, { 'idempotency-key': 'canonical-noop' });
        assert.equal(noop.status, 200);
        assert.equal(noop.body.revision, 2);
        assert.equal(noop.body.operationId, null);
        const stale = await call('PUT', resourcePath, { expectedRevision: 1, spec: revisedSpec }, { 'idempotency-key': 'stale-cas' });
        assert.equal(stale.status, 409);
        assert.equal(stale.body.code, 'REVISION_CONFLICT');
        check('API-03: no-op preserves revision and CAS precedes no-op');
        const nextPort = await freePort();
        await server!.db.transaction(async (tx) => { const facts = (await rows<{
            facts: any;
        }>(tx, 'SELECT facts FROM nodes WHERE id=?', [nodeId]))[0]!.facts; const decoded = typeof facts === 'string' ? JSON.parse(facts) : facts; decoded.allowedPorts.push(nextPort); await write(tx, 'UPDATE nodes SET facts=? WHERE id=?', [JSON.stringify(decoded), nodeId]); });
        const portSpec: ForwardSpec = { ...revisedSpec, ingress: { nodeId, listen: { address: '127.0.0.1', port: nextPort } } };
        const moved = await call('PUT', resourcePath, { expectedRevision: 2, spec: portSpec }, { 'idempotency-key': 'replace-port' });
        assert.equal(moved.status, 202);
        await awaitSuccess(moved.body.operationId);
        const movedClient = connect(nextPort, '127.0.0.1');
        movedClient.on('error', () => { });
        await once(movedClient, 'connect');
        assert.equal(await exchange(movedClient, 'moved'), 'new:moved');
        movedClient.destroy();
        assert.equal((await rows<{
            n: number;
        }>(server!.db.pool, 'SELECT COUNT(*) n FROM port_slots WHERE owner_id=? AND port=?', [accepted.body.forwardId, port]))[0]!.n, 0);
        check('FWD-12: port update binds successor and safely releases obsolete reservation');
        const held = connect(nextPort, '127.0.0.1');
        held.on('error', () => { });
        await once(held, 'connect');
        assert.equal(await exchange(held, 'before-disable'), 'new:before-disable');
        const disabledSpec = { ...portSpec, enabled: false };
        const disable = await call('PUT', resourcePath, { expectedRevision: 3, spec: disabledSpec }, { 'idempotency-key': 'disable' });
        assert.equal(disable.status, 202);
        await server!.runtime.tick();
        await eventually(async () => { const state = (await rows<{
            last_report: unknown;
        }>(server!.db.pool, 'SELECT last_report FROM runtime_nodes WHERE node_id=?', [nodeId]))[0]!.last_report; const report = typeof state === 'string' ? JSON.parse(state) : state; return report?.drains?.some((d: any) => d.condition === 'draining'); });
        assert.equal(await exchange(held, 'during-drain'), 'new:during-drain');
        assert.equal(await opStatus(disable.body.operationId), 'running');
        held.destroy();
        await eventually(async () => await opStatus(disable.body.operationId) === 'succeeded');
        assert.equal((await rows<{
            n: number;
        }>(server!.db.pool, 'SELECT COUNT(*) n FROM port_slots WHERE owner_id=?', [accepted.body.forwardId]))[0]!.n, 1);
        check('FWD-09: disable drains old streams and retains logical reservation');
        const enable = await call('PUT', resourcePath, { expectedRevision: 4, spec: portSpec }, { 'idempotency-key': 'enable' });
        assert.equal(enable.status, 202);
        await awaitSuccess(enable.body.operationId);
        check('FWD-09: re-enable uses a fresh execution generation and fence');
        const deleted = await call('DELETE', resourcePath, { expectedRevision: 5 }, { 'idempotency-key': 'delete' });
        assert.equal(deleted.status, 202);
        const deletionClaim = await server!.db.transaction(tx => server!.control.ledger.claim(tx));
        assert.equal(deletionClaim?.id, deleted.body.operationId);
        const beforePublication = (await rows<{
            last_report: any;
            session_epoch: number;
        }>(server!.db.pool, 'SELECT last_report,session_epoch FROM runtime_nodes WHERE node_id=?', [nodeId]))[0]!;
        const lateReady = typeof beforePublication.last_report === 'string' ? JSON.parse(beforePublication.last_report) : beforePublication.last_report;
        // A current-session old snapshot report cannot complete deletion until removal is published.
        const early = await call('POST', '/agent/v2/report', { ...lateReady, reportSequence: lateReady.reportSequence + 100 }, { 'x-tunex-session-epoch': String(beforePublication.session_epoch) }, machine);
        assert.equal(early.status, 200);
        assert.equal(await opStatus(deleted.body.operationId), 'running');
        assert.equal((await rows<{
            n: number;
        }>(server!.db.pool, 'SELECT COUNT(*) n FROM port_slots WHERE owner_id=?', [accepted.body.forwardId]))[0]!.n, 1);
        // Clear the synthetic report high-water so the real Agent can continue its independent sequence.
        await write(server!.db.pool, 'DELETE FROM reports WHERE node_id=? AND session_epoch=? AND sequence=?', [nodeId, beforePublication.session_epoch, lateReady.reportSequence + 100]);
        await write(server!.db.pool, 'UPDATE runtime_nodes SET last_report_sequence=? WHERE node_id=?', [lateReady.reportSequence, nodeId]);
        await write(server!.db.pool, 'UPDATE operations SET claim_until=? WHERE id=?', [Date.now() - 1, deleted.body.operationId]);
        await awaitSuccess(deleted.body.operationId);
        check('API-03: ready report before delete publication cannot release an authorized listener');
        assert.equal((await call('GET', resourcePath)).status, 404);
        assert.equal((await rows<{
            n: number;
        }>(server!.db.pool, 'SELECT COUNT(*) n FROM port_slots WHERE owner_id=?', [accepted.body.forwardId]))[0]!.n, 0);
        assert.deepEqual(await call('DELETE', resourcePath, { expectedRevision: 5 }, { 'idempotency-key': 'delete' }), deleted);
        assert.equal((await call('PUT', resourcePath, { expectedRevision: 6, spec: portSpec }, { 'idempotency-key': 'resurrect' })).status, 404);
        check('FWD-10: deleted identity stays tombstoned and duplicate DELETE does not revive execution');
        const replacement = await call('POST', `/api/v1/scopes/${scope}/forwards`, portSpec, { 'idempotency-key': 'new-owner' });
        assert.equal(replacement.status, 202);
        await awaitSuccess(replacement.body.operationId);
        assert.notEqual(replacement.body.forwardId, accepted.body.forwardId);
        check('SEC-03: safely deleted port can be reused with a higher fence');
        const udpPort = await freePort();
        await server!.db.transaction(async (tx) => { const node = (await rows<{
            facts: any;
        }>(tx, 'SELECT facts FROM nodes WHERE id=?', [nodeId]))[0]!; const facts = typeof node.facts === 'string' ? JSON.parse(node.facts) : node.facts; facts.allowedPorts.push(udpPort); await write(tx, 'UPDATE nodes SET facts=? WHERE id=?', [JSON.stringify(facts), nodeId]); });
        const dualTarget = spawn(process.execPath, ['scripts/phase2/dual-target.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
        const dualPort = JSON.parse(await new Promise<string>(resolve => dualTarget.stdout!.once('data', chunk => resolve(chunk.toString())))).port as number;
        const obstruction = createSocket('udp4');
        obstruction.bind(udpPort, '127.0.0.1');
        await once(obstruction, 'listening');
        try {
            const bothSpec: ForwardSpec = { ...spec, protocols: ['tcp', 'udp'], ingress: { nodeId, listen: { address: '127.0.0.1', port: udpPort } }, target: { host: '127.0.0.1', port: dualPort } };
            const both = await call('POST', `/api/v1/scopes/${scope}/forwards`, bothSpec, { 'idempotency-key': 'both-partial' });
            assert.equal(both.status, 202, JSON.stringify(both.body));
            await server!.runtime.tick();
            const bothPath = `/api/v1/scopes/${scope}/forwards/${both.body.forwardId}`;
            await eventually(async () => { const row = await call('GET', bothPath); return row.body.health.condition === 'degraded' && row.body.applied.some((o: any) => o.condition === 'error') && row.body.applied.some((o: any) => o.condition === 'ready'); });
            assert.equal(await opStatus(both.body.operationId), 'running');
            assert.equal((await rows<{
                n: number;
            }>(server!.db.pool, 'SELECT COUNT(*) n FROM port_slots WHERE owner_id=?', [both.body.forwardId]))[0]!.n, 2);
            const partial = connect(udpPort, '127.0.0.1');
            partial.on('error', () => { });
            await once(partial, 'connect');
            assert.equal(await exchange(partial, 'tcp-partial'), 'tcp-partial');
            partial.destroy();
            check('FWD-13: atomic TCP+UDP reservations with partial bind preserve TCP and show degraded');
            obstruction.close();
            await eventually(async () => await opStatus(both.body.operationId) === 'succeeded');
            const clients = [createSocket('udp4'), createSocket('udp4')];
            try {
                await Promise.all(clients.map((client, index) => new Promise<void>((resolve, reject) => { const text = `udp-client-${index}`; const timer = setTimeout(() => reject(new Error('UDP reply timed out')), 4000); client.once('message', message => { clearTimeout(timer); try {
                    assert.equal(message.toString(), text);
                    resolve();
                }
                catch (error) {
                    reject(error);
                } }); client.send(Buffer.from(text), udpPort, '127.0.0.1', error => { if (error)
                    reject(error); }); })));
                check('FWD-02/FWD-14: independent UDP clients receive their own exact replies');
            }
            finally {
                for (const client of clients)
                    client.close();
            }
            await write(server!.db.pool, 'UPDATE operations SET status=\'failed\',cleanup_pending=TRUE WHERE id=?', [both.body.operationId]);
            await server!.runtime.snapshot(nodeId, (await rows<{
                session_epoch: number;
            }>(server!.db.pool, 'SELECT session_epoch FROM runtime_nodes WHERE node_id=?', [nodeId]))[0]!.session_epoch);
            const retry = await call('POST', `/api/v1/scopes/${scope}/operations/${both.body.operationId}/retry`, { expectedRevision: 1 }, { 'idempotency-key': 'both-retry' });
            assert.equal(retry.status, 202);
            assert.notEqual(retry.body.operationId, both.body.operationId);
            await awaitSuccess(retry.body.operationId);
            assert.equal((await call('GET', bothPath)).body.desired.revision, 1);
            check('API-04: failed direct retry creates a new Operation without changing Forward revision');
            const deleteBoth = await call('DELETE', bothPath, { expectedRevision: 1 }, { 'idempotency-key': 'delete-both' });
            assert.equal(deleteBoth.status, 202);
            await awaitSuccess(deleteBoth.body.operationId);
            assert.equal((await rows<{
                n: number;
            }>(server!.db.pool, 'SELECT COUNT(*) n FROM port_slots WHERE owner_id=?', [both.body.forwardId]))[0]!.n, 0);
            check('FWD-03/FWD-10: both protocol deletion drains and releases both reservations');
        }
        finally {
            try {
                obstruction.close();
            }
            catch { }
            dualTarget.kill();
            await once(dualTarget, 'exit').catch(() => { });
        }
        const currentEpoch = (await rows<{
            session_epoch: number;
        }>(server!.db.pool, 'SELECT session_epoch FROM runtime_nodes WHERE node_id=?', [nodeId]))[0]!.session_epoch;
        // Isolated DB fixture models an unexpired lease from a detached, older holder.
        await write(server!.db.pool, 'INSERT INTO execution_leases(forward_id,node_id,assignment_id,deployment_generation,binding_fence,session_epoch,valid_until) SELECT forward_id,node_id,assignment_id,deployment_generation,binding_fence,?,valid_until FROM execution_leases WHERE forward_id=? AND session_epoch=?', [currentEpoch + 100, replacement.body.forwardId, currentEpoch]);
        const historicalDelete = await call('DELETE', `/api/v1/scopes/${scope}/forwards/${replacement.body.forwardId}`, { expectedRevision: 1 }, { 'idempotency-key': 'history-delete' });
        assert.equal(historicalDelete.status, 202);
        await server!.runtime.tick();
        await eventually(async () => Boolean((await rows<{
            removed_epoch: number | null;
        }>(server!.db.pool, 'SELECT removed_epoch FROM retirements WHERE forward_id=?', [replacement.body.forwardId]))[0]?.removed_epoch));
        assert.equal(await opStatus(historicalDelete.body.operationId), 'running');
        assert.equal((await rows<{
            n: number;
        }>(server!.db.pool, 'SELECT COUNT(*) n FROM port_slots WHERE owner_id=?', [replacement.body.forwardId]))[0]!.n, 1);
        await write(server!.db.pool, 'UPDATE execution_leases SET valid_until=? WHERE forward_id=? AND session_epoch=?', [Date.now() - 6000, replacement.body.forwardId, currentEpoch + 100]);
        await server!.runtime.tick();
        assert.equal(await opStatus(historicalDelete.body.operationId), 'succeeded');
        check('OPS-09: current-session removed ACK cannot release a detached holder before its historical lease expires');
        const offlineFailure=await call('POST',`/api/v1/scopes/${scope}/forwards`,portSpec,{'idempotency-key':'offline-failure'});assert.equal(offlineFailure.status,202);await awaitSuccess(offlineFailure.body.operationId);
        if(agent){agent.kill();await once(agent,'exit');agent=undefined;}
        await write(server!.db.pool,"UPDATE operations SET status='running',execution_deadline=?,claim_until=NULL WHERE id=?",[Date.now()-1,offlineFailure.body.operationId]);
        await server!.runtime.tick();await server!.runtime.tick();
        assert.ok((await rows<{n:number}>(server!.db.pool,'SELECT COUNT(*) n FROM retirements WHERE forward_id=?',[offlineFailure.body.forwardId]))[0]!.n>0);
        await write(server!.db.pool,'UPDATE execution_leases SET valid_until=? WHERE forward_id=?',[Date.now()-6000,offlineFailure.body.forwardId]);await server!.runtime.tick();
        const offlineOperation=await call('GET',`/api/v1/scopes/${scope}/operations/${offlineFailure.body.operationId}`);assert.equal(offlineOperation.body.status,'failed');assert.equal(offlineOperation.body.cleanupPending,false);
        check('OPS-01/API-04: scanner withdraws and cleans expired failed work while Agent is offline');
        const fixture = await rows<{
            body: unknown;
        }>(server!.db.pool, 'SELECT body FROM snapshots WHERE node_id=? ORDER BY generation DESC LIMIT 1', [nodeId]);
        const body = typeof fixture[0]!.body === 'string' ? JSON.parse(fixture[0]!.body) : fixture[0]!.body;
        assert.ok(body.tombstones.length >= 3);
        const commit = (await exec('git', ['rev-parse', 'HEAD'])).stdout.trim();
        const workingTreeDirty=Boolean((await exec('git',['status','--porcelain'])).stdout.trim());
        await writeFile(join(directory, 'evidence.json'), JSON.stringify({ commit, workingTreeDirty, checks, command: 'npm run test:phase2', environment: { platform: platform(), kernel: release(), arch: arch(), mysql: '8.4.9' }, agentSHA: createHash('sha256').update(await readFile(agentPath)).digest('hex') }, null, 2));
        console.log(`Phase 2 direct lifecycle passed: ${checks.length} checks. Evidence ${directory}`);
    }
    finally {
        persistent.destroy();
        newTarget.kill();
        await once(newTarget, 'exit').catch(() => { });
    }
}
finally {
    if (agent) {
        agent.kill();
        await once(agent, 'exit').catch(() => { });
    }
    if (target) {
        target.kill();
        await once(target, 'exit').catch(() => { });
    }
    await server?.close();
    await administrator.query(`DROP DATABASE \`${database}\``);
    await administrator.end();
}
