import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomBytes, randomUUID, X509Certificate } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, request as httpsRequest } from 'node:https';
import type { Server } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { getRequestListener } from '@hono/node-server';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { checkProbeNegotiation, parseProbeNegotiation, checkProbeInstance, parseProbeInstance, checkProbeClaim, parseProbeClaim } from '@tunex/contracts';
import type { ProbeInstanceRequest, ProbeClaimRequest } from '@tunex/contracts';
import { checkProbePoll, checkProbeStatus, parseProbeDelivery } from '@tunex/contracts';
import type { ProbePollRequest, ProbeStatusRequest } from '@tunex/contracts';
import { checkProbeResult, parseProbeResult } from '@tunex/contracts';
import type { ProbeResultRequest } from '@tunex/contracts';
import { MySqlProbePermits } from '../src/infrastructure/mysql-probe-permits.ts';
import type { Forward } from '@tunex/core';
import type { ProbeNegotiationRequest } from '@tunex/contracts';
import { createApp } from '../src/api/app.ts';
import { ControlApplication } from '../src/application/control.ts';
import { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';
import type { AuthorityStore } from '../src/infrastructure/authority.ts';
import { NodeCertificateAuthority } from '../src/infrastructure/pki.ts';
import { Identity } from '../src/modules/identity.ts';
import { Nodes } from '../src/modules/nodes.ts';
import type { RuntimeController } from '../src/modules/runtime/controller.ts';
import { compileDirect, compileSnapshot } from '../src/modules/runtime/planner.ts';
import type { AuthorizedNodeFacts } from '../src/modules/node-management-ports.ts';
const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL, execute = promisify(execFile);
const command: ProbeNegotiationRequest = { protocolVersion: 3, probeVersion: 1, kind: 'probe-hello', nodeId: 'node-a',
    bootId: 'boot-a', sessionEpoch: 2, instanceId: 'a'.repeat(64), capability: 'probe.tcp-connect.v1',
    point: 'agent-direct-egress', maxTimeoutMs: 2000, maxAttempts: 1, applicationPayloadBytes: 0 };
async function digest(db: Connection, excludeInstances = false, excludePermits = false, excludeResults = false) {
    const [tables] = await db.query<RowDataPacket[]>(
        'SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
    const inventory = [];
    for (const table of tables) {
        assert.match(table.name, /^[a-z0-9_]+$/);
        if (excludeInstances && table.name === 'probe_instances') continue;
        if (excludePermits && ['probe_permits', 'probe_permit_budget', 'probe_permit_withdrawals'].includes(table.name)) continue;
        if (excludeResults && ['probe_results', 'probe_permit_budget'].includes(table.name)) continue;
        const [records] = await db.query<RowDataPacket[]>(`SELECT * FROM \`${table.name}\``);
        inventory.push([table.name, records.map(record => JSON.stringify(record)).sort()]);
    }
    return createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
}
async function fixture(writeInstances = false, writePermits = false, lockPermits = false, writeResults = false) {
    const suffix = randomUUID().replaceAll('-', ''), name = 'tunex_probe_hello_' + suffix;
    const username = 'ph_' + suffix.slice(0, 16), password = randomBytes(24).toString('hex');
    const directory = await mkdtemp(join(tmpdir(), 'tunex-probe-hello-'));
    const admin = await createConnection(databaseUrl!), url = new URL(databaseUrl!);
    url.pathname = '/' + name;
    const writer = new MySqlUnitOfWork(url.toString());
    let created = false, userCreated = false, reader: MySqlUnitOfWork | undefined, db: Connection | undefined, server: Server | undefined;
    const close = async () => {
        if (server?.listening) {
            server.closeAllConnections();
            await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
        }
        await reader?.close(); await db?.end(); await writer.close();
        try {
            if (userCreated) await admin.query("DROP USER ?@'%'", [username]);
            if (created) await admin.query(`DROP DATABASE \`${name}\``);
        } finally { await admin.end(); await rm(directory, { recursive: true, force: true }); }
    };
    try {
        await admin.query(`CREATE DATABASE \`${name}\``); created = true; await writer.migrate();
        db = await createConnection(url.toString());
        const openssl = async (...args: string[]) => execute('openssl', args, { cwd: directory, timeout: 10000 });
        await openssl('req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
            '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '1', '-subj', '/CN=probe-test-ca',
            '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign');
        await openssl('req', '-new', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
            '-keyout', 'server.key', '-out', 'server.csr', '-subj', '/CN=localhost');
        await writeFile(join(directory, 'server.ext'), 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n');
        await openssl('x509', '-req', '-in', 'server.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key',
            '-set_serial', '1', '-days', '1', '-out', 'server.pem', '-extfile', 'server.ext');
        const ca = new NodeCertificateAuthority('openssl', join(directory, 'ca.pem'), join(directory, 'ca.key'), directory);
        const credentials: { cert: string; key: Buffer; fingerprint: string }[] = [];
        for (const node of ['node-a', 'unregistered-node']) {
            await openssl('req', '-new', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
                '-keyout', node + '.key', '-out', node + '.csr', '-subj', '/CN=' + node);
            const signed = await ca.sign(node, await readFile(join(directory, node + '.csr'), 'utf8'));
            credentials.push({ cert: signed.certificate, key: await readFile(join(directory, node + '.key')), fingerprint: signed.fingerprint });
        }
        const now = Date.now(), fingerprint = credentials[0]!.fingerprint;
        assert.equal(new X509Certificate(credentials[0]!.cert).fingerprint256.replaceAll(':', '').toLowerCase(), fingerprint);
        await db.execute('INSERT INTO accounts(id,token_hash) VALUES(?,?)', ['owner', createHash('sha256').update('fake-token').digest('hex')]);
        await db.execute('INSERT INTO scopes(id,owner_id) VALUES(?,?)', ['scope-a', 'owner']);
        await db.execute(`INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts)
            VALUES(?,?,?,0,?,?)`, ['node-a', 'scope-a', 'a'.repeat(64), now + 120000,
            JSON.stringify({ capabilities: ['adp.3', 'native.direct.v1', 'tcp'] })]);
        await db.execute('INSERT INTO runtime_nodes(node_id,session_epoch,boot_id) VALUES(?,2,?)', ['node-a', 'boot-a']);
        await db.execute('INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until) VALUES(?,?,?,?)',
            [fingerprint, 'node-a', now, now + 90000]);
        await admin.query("CREATE USER ?@'%' IDENTIFIED BY ?", [username, password]); userCreated = true;
        await admin.query(`GRANT SELECT ON \`${name}\`.* TO ?@'%'`, [username]);
        // FOR UPDATE needs a locking privilege even when these endpoints perform no DML.
        if (lockPermits) await admin.query(`GRANT LOCK TABLES ON \`${name}\`.* TO ?@'%'`, [username]);
        if (writeInstances) await admin.query(`GRANT INSERT,UPDATE ON \`${name}\`.probe_instances TO ?@'%'`, [username]);
        if (writePermits) {
            await admin.query(`GRANT INSERT,UPDATE,DELETE ON \`${name}\`.probe_permits TO ?@'%'`, [username]);
            await admin.query(`GRANT UPDATE ON \`${name}\`.probe_permit_budget TO ?@'%'`, [username]);
            await admin.query(`GRANT INSERT,DELETE ON \`${name}\`.probe_permit_withdrawals TO ?@'%'`, [username]);
        }
        if (writeResults) {
            await admin.query(`GRANT INSERT ON \`${name}\`.probe_results TO ?@'%'`, [username]);
            await admin.query(`GRANT UPDATE ON \`${name}\`.probe_permit_budget TO ?@'%'`, [username]);
        }
        const readUrl = new URL(url); readUrl.username = username; readUrl.password = password;
        reader = new MySqlUnitOfWork(readUrl.toString());
        await assert.rejects(reader.pool.query('UPDATE nodes SET revoked=TRUE'));
        const identity = new Identity(reader), control = new ControlApplication(reader, identity, new Nodes(reader, identity, ca));
        const app = createApp(control, {} as RuntimeController, { allow: async () => undefined } as unknown as AuthorityStore);
        server = createServer({ cert: await readFile(join(directory, 'server.pem')), key: await readFile(join(directory, 'server.key')),
            ca: await readFile(join(directory, 'ca.pem')), requestCert: true, rejectUnauthorized: false, minVersion: 'TLSv1.3' },
        getRequestListener(app.fetch));
        await new Promise<void>((resolve, reject) => {
            server!.once('error', reject); server!.listen(0, '127.0.0.1', resolve);
        });
        const port = (server.address() as { port: number }).port, caPem = await readFile(join(directory, 'ca.pem'));
        const request = async (options: { credential?: number | null; input?: unknown; raw?: string; epoch?: string;
            status?: number | readonly number[]; path?: string } = {}) => {
            const credential = options.credential === null ? undefined : credentials[options.credential ?? 0]!;
            const raw = options.raw ?? JSON.stringify(options.input ?? command);
            const result = await new Promise<{ status: number; text: string; cache: string | undefined }>((resolve, reject) => {
                const request = httpsRequest({ hostname: '127.0.0.1', port, path: options.path ?? '/agent/v3/probe/hello', method: 'POST',
                    agent: false, ca: caPem, ...(credential ? { key: credential.key, cert: credential.cert } : {}),
                    minVersion: 'TLSv1.3', rejectUnauthorized: true,
                    headers: { 'Content-Type': 'application/json', 'X-TuneX-Session-Epoch': options.epoch ?? '2' },
                }, response => {
                    const chunks: Buffer[] = [];
                    response.on('data', chunk => chunks.push(Buffer.from(chunk)));
                    response.once('error', reject);
                    response.once('end', () => resolve({ status: response.statusCode!, text: Buffer.concat(chunks).toString('utf8'),
                        cache: response.headers['cache-control'] }));
                });
                request.setTimeout(3000, () => request.destroy(new Error('TLS probe negotiation timed out')));
                request.once('error', reject); request.end(raw);
            });
            if (Array.isArray(options.status)) assert.ok(options.status.includes(result.status), result.text);
            else assert.equal(result.status, options.status ?? 200, result.text);
            assert.equal(result.cache, 'no-store'); assert.ok(Buffer.byteLength(result.text) <= 4096);
            assert.ok(!result.text.includes(password)); assert.ok(!result.text.includes('PRIVATE KEY'));
            return result.text;
        };
        const setupIdentity = new Identity(writer);
        const setup = new ControlApplication(writer, setupIdentity, new Nodes(writer, setupIdentity, ca));
        const prepareProbe = async () => {
            const now = Date.now();
            const forward: Forward = { id: 'forward-a', scopeId: 'scope-a', revision: 1, spec: { enabled: true,
                protocols: ['tcp'], ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 22001 } },
                target: { host: '127.0.0.1', port: 80 } } };
            const facts: AuthorizedNodeFacts = { nodeId: 'node-a', scopeId: 'scope-a', capabilities: ['adp.3', 'native.direct.v1', 'tcp'],
                allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [22001], egressPolicyRevision: 1,
                allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false };
            await db!.execute("INSERT INTO scope_members(scope_id,actor_id,can_manage) VALUES('scope-a','owner',TRUE)");
            await db!.execute("INSERT INTO node_grants(node_id,actor_id) VALUES('node-a','owner')");
            await db!.execute("UPDATE nodes SET facts=? WHERE id='node-a'", [JSON.stringify(facts)]);
            await db!.execute("INSERT INTO forwards(id,scope_id,revision,spec,authorization_actor) VALUES('forward-a','scope-a',1,?,'owner')",
                [JSON.stringify(forward.spec)]);
            await db!.execute("UPDATE runtime_nodes SET snapshot_generation=3 WHERE node_id='node-a'");
            const snapshot = compileSnapshot({ nodeId: 'node-a', sessionEpoch: 2, snapshotGeneration: 3,
                issuedAt: new Date(now).toISOString(), validUntil: new Date(now + 60000).toISOString(), tombstones: [],
                assignments: compileDirect(forward, facts, [{ nodeId: 'node-a', forwardId: 'forward-a', protocol: 'tcp',
                    port: 22001, bindingFence: 4, deploymentGeneration: 5 }]) });
            await db!.execute("INSERT INTO snapshots(node_id,generation,session_epoch,valid_until,body) VALUES('node-a',3,2,?,?)",
                [now + 60000, JSON.stringify(snapshot)]);
            await setup.probeInstances.register('node-a', fingerprint, 2, { bootId: 'boot-a', instanceId: 'c'.repeat(64), expectedGeneration: 0 });
        };
        const issuePermit = () => control.probePermits.issue('owner', 'scope-a', 'forward-a', { version: 1, kind: 'tcp-connect',
            expectedRevision: 1, instanceId: 'c'.repeat(64), instanceGeneration: 1 });
        return { db, fingerprint, alternateFingerprint: credentials[1]!.fingerprint,
            request, close, control, reader, setup, prepareProbe, issuePermit };
    } catch (error) { await close(); throw error; }
}

const resultPath = '/agent/v3/probe/result';
async function resultCommand(f: Awaited<ReturnType<typeof fixture>>): Promise<ProbeResultRequest> {
    await f.prepareProbe();
    const permit = await f.setup.probePermits.issue('owner', 'scope-a', 'forward-a', {
        version: 1, kind: 'tcp-connect', expectedRevision: 1, instanceId: 'c'.repeat(64), instanceGeneration: 1 });
    const receipt = await f.setup.probePermits.consume('node-a', f.fingerprint, 2, {
        permitId: permit.id, bootId: 'boot-a', instanceId: 'c'.repeat(64), instanceGeneration: 1 });
    return { protocolVersion: 3, probeVersion: 1, kind: 'probe-result', nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2,
        instanceId: receipt.instanceId, instanceGeneration: receipt.instanceGeneration, permitId: receipt.id,
        requestId: randomBytes(32).toString('hex'), binding: { ...receipt.binding }, timeoutMs: receipt.timeoutMs,
        issuedAt: new Date(receipt.issuedAt).toISOString(), expiresAt: new Date(receipt.expiresAt).toISOString(),
        consumedAt: new Date(receipt.closedAt!).toISOString(), measuredAt: new Date().toISOString(), validUntil: new Date(receipt.expiresAt).toISOString(),
        elapsedMs: 0, point: 'agent-direct-egress', status: 'connected', code: 'tcp-connected',
        applicationHealth: 'unknown', source: 'agent-reported', applicationPayloadBytes: 0 };
}

test('real mTLS result ingestion has INSERT-only result privileges, durable duplicate receipts and no execution writes',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture(false, false, true, true);
        try {
            const input = { ...await resultCommand(f), code: 'tcp-connected' as const }, before = await digest(f.db, false, false, true);
            const inputs = [input, { ...input, requestId: randomBytes(32).toString('hex') }];
            const acks = await Promise.all(inputs.map(async input => {
                const ack = parseProbeResult('Response', await f.request({ path: resultPath, input })); checkProbeResult(input, ack); return ack;
            }));
            assert.equal(acks.filter(a => !a.duplicate).length, 1); assert.equal(acks[0]!.acceptedAt, acks[1]!.acceptedAt);
            assert.equal(acks[0]!.health, 'unknown'); assert.equal(acks[0]!.executionEnabled, false);
            const [saved] = await f.db.query<RowDataPacket[]>('SELECT * FROM probe_results');
            assert.equal(saved.length, 1); assert.equal(saved[0]!.permit_id, input.permitId);
            assert.equal(await digest(f.db, false, false, true), before);
            const stable = await digest(f.db), replay = { ...input, requestId: randomBytes(32).toString('hex') };
            const ack = parseProbeResult('Response', await f.request({ path: resultPath, input: replay }));
            assert.equal(ack.duplicate, true); assert.equal(await digest(f.db), stable);
            for (const sql of ['UPDATE probe_results SET accepted_at=0', 'DELETE FROM probe_results',
                "UPDATE probe_permits SET state='issued',closed_at=NULL", 'UPDATE snapshots SET generation=generation'])
                await assert.rejects(f.reader.pool.query(sql));
        } finally { await f.close(); }
    });

test('real mTLS concurrent conflicting results select one immutable winner without reconsumption or quota refunds',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture(false, false, true, true);
        try {
            const input = { ...await resultCommand(f), code: 'tcp-connected' as const };
            const results = await Promise.all([input, { ...input, status: 'unreachable', code: 'tcp-connect-failed', requestId: randomBytes(32).toString('hex') }]
                .map(input => f.request({ path: resultPath, input, status: [200, 409] })));
            const values = results.map(raw => JSON.parse(raw) as Record<string, unknown>);
            assert.equal(values.filter(v => v.kind === 'probe-result-ack').length, 1);
            assert.equal(values.filter(v => v.code === 'PROBE_RESULT_CONFLICT').length, 1);
            const [saved] = await f.db.query<RowDataPacket[]>('SELECT * FROM probe_results'); assert.equal(saved.length, 1);
            const [permits] = await f.db.query<RowDataPacket[]>('SELECT state,closed_at FROM probe_permits');
            assert.equal(permits[0]!.state, 'consumed'); assert.equal(permits[0]!.closed_at, Date.parse(input.consumedAt));
            await assert.rejects(f.issuePermit(), { code: 'PROBE_PERMIT_LIMIT' });
        } finally { await f.close(); }
    });

test('real mTLS results reject forged credentials, malformed content and stale original authority without writes',
    { skip: !databaseUrl, timeout: 180000 }, async () => {
        for (const mode of ['request', 'grant', 'member', 'forward', 'instance', 'credential', 'withdrawal']) {
            const f = await fixture(false, false, true, true);
            try {
                const input = { ...await resultCommand(f), code: 'tcp-connected' as const };
                if (mode === 'request') {
                    const before = await digest(f.db);
                    await f.request({ path: resultPath, input, credential: null, status: 401 });
                    await f.request({ path: resultPath, input, credential: 1, status: 403 });
                    await f.request({ path: resultPath, input, epoch: '3', status: 409 });
                    for (const patch of [{ actorId: 'owner' }, { target: '169.254.169.254' }, { applicationHealth: 'healthy' },
                        { status: 'timeout' }, { code: 'tcp-connect-failed' }, { requestId: 'x' }])
                        await f.request({ path: resultPath, input: { ...input, ...patch }, status: 422 });
                    await f.request({ path: resultPath, raw: '{"probeVersion":1,"probeVersion":1}', status: 409 });
                    await f.request({ path: resultPath, raw: ' '.repeat(4097), status: 413 });
                    assert.equal(await digest(f.db), before); continue;
                }
                const sql: Record<string, string> = { grant: "DELETE FROM node_grants WHERE node_id='node-a'",
                    member: "UPDATE scope_members SET can_manage=FALSE WHERE actor_id='owner'", forward: 'UPDATE forwards SET revision=2',
                    instance: 'UPDATE probe_instances SET generation=2', credential: 'UPDATE node_credentials SET revoked=TRUE' };
                if (mode === 'withdrawal') await f.setup.probePermits.revoke('owner', 'scope-a', input.permitId);
                else await f.db.query(sql[mode]!);
                const before = await digest(f.db);
                await f.request({ path: resultPath, input, status: [403, 404, 409] }); assert.equal(await digest(f.db), before);
            } finally { await f.close(); }
        }
    });

test('real mTLS result insertion rolls back at the commit guard and corrupt saved observations cannot be overwritten',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture(false, false, true, true);
        try {
            const input = { ...await resultCommand(f), code: 'tcp-connected' as const }, before = await digest(f.db); let guards = 0;
            f.reader.guard = async () => { if (++guards === 2) throw new Error('maintenance before result commit'); };
            try { await f.request({ path: resultPath, input, status: 503 }); assert.equal(guards, 2); }
            finally { f.reader.guard = undefined; }
            assert.equal(await digest(f.db), before);
            const ack = parseProbeResult('Response', await f.request({ path: resultPath, input })); assert.equal(ack.duplicate, false);
            await f.db.execute('UPDATE probe_results SET result_digest=?', ['sha256:' + '0'.repeat(64)]);
            const corrupt = await digest(f.db); await f.request({ path: resultPath, input, status: 503 });
            assert.equal(await digest(f.db), corrupt);
        } finally { await f.close(); }
    });

test('real MySQL recovery preserves reported results as non-authorizing history and bounded permit pruning cascades their deletion',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture(false, false, true, true);
        try {
            const input = { ...await resultCommand(f), code: 'tcp-connected' as const };
            await f.request({ path: resultPath, input });
            const [before] = await f.db.query<RowDataPacket[]>('SELECT * FROM probe_results');
            await f.setup.db.transaction(tx => MySqlProbePermits.quarantineRecovery(tx));
            const [after] = await f.db.query<RowDataPacket[]>('SELECT * FROM probe_results'); assert.deepEqual(after, before);
            await f.request({ path: resultPath, input, status: 409 });
            const [permits] = await f.db.query<RowDataPacket[]>('SELECT state,closed_at FROM probe_permits');
            assert.equal(permits[0]!.state, 'consumed'); assert.equal(permits[0]!.closed_at, Date.parse(input.consumedAt));
            await f.db.execute('DELETE FROM probe_permits WHERE id=?', [input.permitId]);
            const [pruned] = await f.db.query<RowDataPacket[]>('SELECT * FROM probe_results'); assert.equal(pruned.length, 0);
            await f.request({ path: resultPath, input, status: 409 });
        } finally { await f.close(); }
    });

test('real HTTPS mTLS Probe negotiation uses SELECT-only production assembly and cannot enable execution or mutate state',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            const before = await digest(f.db), raw = await f.request(), ack = parseProbeNegotiation('Response', raw);
            checkProbeNegotiation(command, ack); assert.equal(ack.executionEnabled, false);
            assert.equal(ack.state, 'contract-only'); assert.equal(ack.instanceId, command.instanceId);
            await f.request({ credential: null, status: 401 });
            await f.request({ credential: 1, status: 403 });
            await f.request({ epoch: '3', status: 409 });
            await f.request({ epoch: '0', status: 409 });
            await f.request({ input: { ...command, nodeId: 'node-b' }, status: 409 });
            await f.request({ input: { ...command, bootId: 'retired-boot' }, status: 409 });
            await f.request({ input: { ...command, probeVersion: 2 }, status: 422 });
            await f.request({ input: { ...command, target: { host: '169.254.169.254' } }, status: 422 });
            await f.request({ raw: '{"probeVersion":1,"probeVersion":1}', status: 409 });
            await f.request({ raw: ' '.repeat(4097), status: 413 });
            assert.equal(await digest(f.db), before);
        } finally { await f.close(); }
    });

const instanceRequest: ProbeInstanceRequest = { protocolVersion: 3, probeVersion: 1, kind: 'probe-instance', action: 'register',
    nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, instanceId: 'c'.repeat(64), expectedGeneration: 0 };
test('real mTLS registry persists only its owner table, serializes replacement and keeps read-only negotiation unchanged',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture(true), path = '/agent/v3/probe/instance';
        try {
            const before = await digest(f.db, true), inspect = { ...instanceRequest, action: 'inspect' as const };
            const empty = await digest(f.db);
            const absent = parseProbeInstance('Response', await f.request({ path, input: inspect }));
            assert.equal(absent.state, 'absent'); assert.equal(absent.generation, 0);
            assert.equal(await digest(f.db), empty);
            const first = parseProbeInstance('Response', await f.request({ path, input: instanceRequest }));
            checkProbeInstance(instanceRequest, first); assert.equal(first.executionEnabled, false);
            const persisted = await digest(f.db);
            const replay = parseProbeInstance('Response', await f.request({ path, input: instanceRequest }));
            assert.equal(replay.registeredAt, first.registeredAt); assert.equal(replay.expiresAt, first.expiresAt);
            assert.equal(await digest(f.db), persisted);
            const races = await Promise.all(['d', 'e'].map(hex => f.request({ path, status: [200, 409],
                input: { ...instanceRequest, instanceId: hex.repeat(64), expectedGeneration: 1 } })));
            assert.equal(races.map(raw => JSON.parse(raw)).filter(v => v.kind === 'probe-instance-ack').length, 1);
            const current = parseProbeInstance('Response', await f.request({ path, input: inspect }));
            assert.equal(current.generation, 2);
            await f.request({ path, input: instanceRequest, status: 409 });
            await f.request({ path, input: { ...instanceRequest, action: 'revoke', expectedGeneration: 1 }, status: 409 });
            const immutable = await digest(f.db);
            await f.request();
            assert.equal(await digest(f.db), immutable);
            assert.equal(await digest(f.db, true), before);
        } finally { await f.close(); }
    });
test('real mTLS registry rejects spoofed identity, invalid contracts and withdrawn evidence; explicit revoke is sticky',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture(true), path = '/agent/v3/probe/instance';
        try {
            const before = await digest(f.db);
            await f.request({ path, input: instanceRequest, credential: null, status: 401 });
            await f.request({ path, input: instanceRequest, credential: 1, status: 403 });
            await f.request({ path, input: { ...instanceRequest, nodeId: 'foreign-node' }, status: 409 });
            await f.request({ path, input: instanceRequest, epoch: '3', status: 409 });
            await f.request({ path, input: { ...instanceRequest, target: '169.254.169.254' }, status: 422 });
            await f.request({ path, input: { ...instanceRequest, action: 'renew' }, status: 422 });
            await f.request({ path, raw: '{"probeVersion":1,"probeVersion":1}', status: 409 });
            await f.request({ path, raw: ' '.repeat(4097), status: 413 });
            assert.equal(await digest(f.db), before);
            await f.request({ path, input: instanceRequest });
            await f.db.execute('UPDATE node_credentials SET revoked=TRUE WHERE fingerprint=?', [f.fingerprint]);
            const denied = await digest(f.db);
            await f.request({ path, input: instanceRequest, status: 403 });
            assert.equal(await digest(f.db), denied);
            await f.db.execute('UPDATE node_credentials SET revoked=FALSE WHERE fingerprint=?', [f.fingerprint]);
            await f.db.execute("UPDATE nodes SET facts=JSON_OBJECT('capabilities',JSON_ARRAY('adp.3')) WHERE id='node-a'");
            await f.request({ path, input: instanceRequest, status: 409 });
            const revoke = { ...instanceRequest, action: 'revoke' as const, expectedGeneration: 1 };
            const ack = parseProbeInstance('Response', await f.request({ path, input: revoke }));
            checkProbeInstance(revoke, ack); assert.equal(ack.state, 'revoked');
            const revoked = await digest(f.db);
            await f.request({ path, input: revoke });
            assert.equal(await digest(f.db), revoked);
            await f.db.execute("UPDATE nodes SET facts=? WHERE id='node-a'",
                [JSON.stringify({ capabilities: ['adp.3', 'native.direct.v1', 'tcp'] })]);
            await f.request({ path, input: instanceRequest, status: 409 });
        } finally { await f.close(); }
    });

test('current Node credential revocation, overlap retirement, expiry and session/capability withdrawal reject negotiation without writes',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        const rejected = async (status: number) => {
            const before = await digest(f.db); await f.request({ status }); assert.equal(await digest(f.db), before);
        };
        try {
            await f.db.execute('UPDATE node_credentials SET revoked=TRUE WHERE fingerprint=?', [f.fingerprint]);
            await rejected(403);
            await f.db.execute('UPDATE node_credentials SET revoked=FALSE,retire_after=? WHERE fingerprint=?', [Date.now(), f.fingerprint]);
            await rejected(403);
            await f.db.execute('UPDATE node_credentials SET retire_after=NULL,valid_until=? WHERE fingerprint=?', [Date.now(), f.fingerprint]);
            await rejected(403);
            await f.db.execute('UPDATE node_credentials SET valid_until=? WHERE fingerprint=?', [Date.now() + 90000, f.fingerprint]);
            await f.db.execute("UPDATE nodes SET credential_until=? WHERE id='node-a'", [Date.now()]);
            await rejected(403);
            await f.db.execute("UPDATE nodes SET credential_until=?,revoked=TRUE WHERE id='node-a'", [Date.now() + 120000]);
            await rejected(403);
            await f.db.execute("UPDATE nodes SET revoked=FALSE,facts=? WHERE id='node-a'", [JSON.stringify({ capabilities: ['adp.3'] })]);
            await rejected(409);
            await f.db.execute("UPDATE nodes SET facts=? WHERE id='node-a'",
                [JSON.stringify({ capabilities: ['adp.3', 'native.direct.v1', 'tcp'] })]);
            await f.db.execute("UPDATE runtime_nodes SET session_epoch=3 WHERE node_id='node-a'");
            await rejected(409);
        } finally { await f.close(); }
    });

const claimRequest = (permitId: string): ProbeClaimRequest => ({ protocolVersion: 3, probeVersion: 1, kind: 'probe-claim',
    nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, instanceId: 'c'.repeat(64), instanceGeneration: 1, permitId });
const claimPath = '/agent/v3/probe/claim';
test('real mTLS claim races commit one consumed receipt and mutate only permit-owned tables with restricted credentials',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture(false, true);
        try {
            await f.prepareProbe();
            await assert.rejects(f.reader.pool.query("UPDATE probe_instances SET state='revoked'"));
            const before = await digest(f.db, false, true), permit = await f.issuePermit(), input = claimRequest(permit.id);
            const responses = await Promise.all([f.request({ path: claimPath, input, status: [200, 409] }),
                f.request({ path: claimPath, input, status: [200, 409] })]);
            const receipts = responses.map(raw => JSON.parse(raw)).filter(v => v.kind === 'probe-claim-ack');
            assert.equal(receipts.length, 1);
            const ack = parseProbeClaim('Response', JSON.stringify(receipts[0])); checkProbeClaim(input, ack);
            assert.equal(ack.executionEnabled, false); assert.deepEqual({ ...ack.binding }, { ...permit.binding });
            assert.ok(!['actorId', 'scopeId', 'fingerprint', 'target', 'permit'].some(key => key in ack));
            const [rows] = await f.db.query<RowDataPacket[]>('SELECT state,closed_at FROM probe_permits WHERE id=?', [permit.id]);
            assert.equal(rows[0]!.state, 'consumed'); assert.ok(rows[0]!.closed_at > 0);
            await f.request({ path: claimPath, input, status: 409 });
            await assert.rejects(f.issuePermit(), { code: 'PROBE_PERMIT_LIMIT' });
            assert.equal(await digest(f.db, false, true), before);
        } finally { await f.close(); }
    });

test('real mTLS claim rejects impersonation, cross-protocol and injected authority before writes; foreign known IDs stay unavailable',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture(false, true), input = claimRequest('unknown-permit');
        try {
            await f.prepareProbe(); const before = await digest(f.db);
            await f.request({ path: claimPath, input, credential: null, status: 401 });
            await f.request({ path: claimPath, input, credential: 1, status: 403 });
            await f.request({ path: claimPath, input: { ...input, nodeId: 'foreign' }, status: 409 });
            await f.request({ path: claimPath, input, epoch: '3', status: 409 });
            await f.request({ path: claimPath, input, epoch: '0', status: 409 });
            for (const patch of [{ target: '169.254.169.254' }, { fingerprint: f.fingerprint }, { actorId: 'owner' },
                { timeoutMs: 2000 }, { binding: {} }, { instanceGeneration: 0 }])
                await f.request({ path: claimPath, input: { ...input, ...patch }, status: 422 });
            await f.request({ path: claimPath, input: instanceRequest, status: 422 });
            await f.request({ path: claimPath, raw: '{"probeVersion":1,"probeVersion":1}', status: 409 });
            await f.request({ path: claimPath, raw: ' '.repeat(4097), status: 413 });
            await f.request({ path: claimPath, input, status: 409 });
            assert.equal(await digest(f.db), before);
            // Another CA-verified credential recognized by the same Node still cannot claim the original fingerprint's permit.
            await f.db.execute("INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until) VALUES(?,'node-a',?,?)",
                [f.alternateFingerprint, Date.now(), Date.now() + 90000]);
            const permit = await f.issuePermit(), claim = claimRequest(permit.id), persisted = await digest(f.db);
            await f.request({ path: claimPath, input: claim, credential: 1, status: 409 });
            await f.request({ path: claimPath, input: { ...claim, bootId: 'foreign' }, status: 409 });
            await f.request({ path: claimPath, input: { ...claim, instanceId: 'd'.repeat(64) }, status: 409 });
            await f.request({ path: claimPath, input: { ...claim, instanceGeneration: 2 }, status: 409 });
            assert.equal(await digest(f.db), persisted);
        } finally { await f.close(); }
    });

test('real mTLS claim reauthorizes original Actor, Forward, instance and current machine without writing on denial',
    { skip: !databaseUrl, timeout: 120000 }, async () => {
        for (const [sql, status] of [
            ["DELETE FROM node_grants WHERE node_id='node-a'", 403],
            ["UPDATE scope_members SET can_manage=FALSE WHERE actor_id='owner'", 403],
            ["UPDATE forwards SET revision=2 WHERE id='forward-a'", 409],
            ["UPDATE probe_instances SET generation=2", 409],
            ["UPDATE runtime_nodes SET session_epoch=3 WHERE node_id='node-a'", 409],
            ["UPDATE node_credentials SET revoked=TRUE", 403],
        ] as const) {
            const f = await fixture(false, true);
            try {
                await f.prepareProbe(); const permit = await f.issuePermit();
                await f.db.execute(sql); const before = await digest(f.db);
                // Missing grants use the owner's opaque NOT_FOUND response rather than reveal a Forward.
                await f.request({ path: claimPath, input: claimRequest(permit.id), status: sql.startsWith('DELETE') ? 404 : status });
                assert.equal(await digest(f.db), before);
            } finally { await f.close(); }
        }
    });

test('real mTLS claim rolls back consumption and budget on pre-commit maintenance failure, without synthesizing an acknowledgement',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture(false, true);
        try {
            await f.prepareProbe(); const permit = await f.issuePermit(), before = await digest(f.db);
            let guards = 0;
            f.reader.guard = async () => { if (++guards === 2) throw new Error('maintenance before claim commit'); };
            await f.request({ path: claimPath, input: claimRequest(permit.id), status: 503 });
            assert.equal(guards, 2); f.reader.guard = undefined;
            assert.equal(await digest(f.db), before);
            const ack = parseProbeClaim('Response', await f.request({ path: claimPath, input: claimRequest(permit.id) }));
            assert.equal(ack.state, 'consumed');
        } finally { await f.close(); }
    });

const pollPath = '/agent/v3/probe/poll', statusPath = '/agent/v3/probe/status';
const pollRequest = (): ProbePollRequest => ({ protocolVersion: 3, probeVersion: 1, kind: 'probe-poll',
    nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, instanceId: 'c'.repeat(64), instanceGeneration: 1,
    requestId: randomBytes(32).toString('hex') });
const statusRequest = (permitId: string): ProbeStatusRequest => ({ ...pollRequest(), kind: 'probe-status', permitId });
const permitCommand = { version: 1, kind: 'tcp-connect', expectedRevision: 1, instanceId: 'c'.repeat(64), instanceGeneration: 1 };
const ownerMachineCommand = (permitId: string) => ({ permitId, bootId: 'boot-a', instanceId: 'c'.repeat(64), instanceGeneration: 1 });

test('real mTLS poll/status use SELECT plus locking-only privileges and preserve every table for empty, offered and consumed observations',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture(false, false, true);
        try {
            await f.prepareProbe();
            for (const table of ['probe_permits', 'probe_permit_withdrawals', 'probe_permit_budget'])
                await assert.rejects(f.reader.pool.query(`DELETE FROM ${table}`));
            await assert.rejects(f.reader.pool.query('UPDATE probe_instances SET generation=generation'));
            const emptyBefore = await digest(f.db), emptyRequest = pollRequest();
            const empty = parseProbeDelivery('PollResponse', await f.request({ path: pollPath, input: emptyRequest }));
            checkProbePoll(emptyRequest, empty); assert.equal(empty.offer, null); assert.equal(empty.executionEnabled, false);
            assert.equal(await digest(f.db), emptyBefore);
            // Setup/consumption is performed by a different writer, never by the read-only HTTP principal.
            const permit = await f.setup.probePermits.issue('owner', 'scope-a', 'forward-a', permitCommand);
            const offeredBefore = await digest(f.db), input = pollRequest();
            const offer = parseProbeDelivery('PollResponse', await f.request({ path: pollPath, input }));
            checkProbePoll(input, offer); assert.equal(offer.offer!.permitId, permit.id);
            assert.deepEqual({ ...offer.offer!.binding }, { ...permit.binding });
            assert.equal(offer.offer!.expiresAt, new Date(permit.expiresAt).toISOString());
            await f.request({ path: statusPath, input: statusRequest(permit.id), status: 409 });
            assert.equal(await digest(f.db), offeredBefore);
            await f.setup.probePermits.consume('node-a', f.fingerprint, 2, ownerMachineCommand(permit.id));
            const consumedBefore = await digest(f.db), check = statusRequest(permit.id);
            const ack = parseProbeDelivery('StatusResponse', await f.request({ path: statusPath, input: check }));
            checkProbeStatus(check, ack); assert.equal(ack.state, 'consumed'); assert.equal(ack.executionEnabled, false);
            const replay = parseProbeDelivery('StatusResponse', await f.request({ path: statusPath, input: statusRequest(permit.id) }));
            assert.equal(replay.consumedAt, ack.consumedAt); assert.equal(replay.expiresAt, ack.expiresAt);
            const absent = parseProbeDelivery('PollResponse', await f.request({ path: pollPath, input: pollRequest() }));
            assert.equal(absent.offer, null); assert.equal(await digest(f.db), consumedBefore);
            for (const value of [offer, offer.offer!, ack])
                assert.ok(!['actorId', 'scopeId', 'fingerprint', 'target', 'dispatch', 'permit'].some(k => k in value));
        } finally { await f.close(); }
    });

test('real mTLS discovery/claim/status stays one-use and sticky withdrawal cannot be undone by restoring a grant or replaying a request',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture(false, true);
        try {
            await f.prepareProbe(); const protectedBefore = await digest(f.db, false, true), permit = await f.issuePermit();
            const poll = pollRequest(), before = await digest(f.db);
            const offer = parseProbeDelivery('PollResponse', await f.request({ path: pollPath, input: poll }));
            const repeated = parseProbeDelivery('PollResponse', await f.request({ path: pollPath, input: poll }));
            checkProbePoll(poll, offer); assert.equal(repeated.offer!.permitId, offer.offer!.permitId);
            assert.equal(await digest(f.db), before);
            const claim = claimRequest(offer.offer!.permitId);
            const receipt = parseProbeClaim('Response', await f.request({ path: claimPath, input: claim }));
            const check = statusRequest(permit.id), ack = parseProbeDelivery('StatusResponse', await f.request({ path: statusPath, input: check }));
            checkProbeStatus(check, ack); assert.equal(ack.consumedAt, receipt.consumedAt);
            assert.deepEqual({ ...ack.binding }, { ...receipt.binding });
            assert.equal(await digest(f.db, false, true), protectedBefore);
            await f.request({ path: claimPath, input: claim, status: 409 });
            await f.db.execute("DELETE FROM node_grants WHERE node_id='node-a'");
            const withdrawn = await f.control.probePermits.revoke('owner', 'scope-a', permit.id);
            assert.equal(withdrawn.state, 'consumed'); assert.equal(withdrawn.closedAt, Date.parse(receipt.consumedAt));
            await f.db.execute("INSERT INTO node_grants(node_id,actor_id) VALUES('node-a','owner')");
            const after = await digest(f.db);
            await f.request({ path: statusPath, input: check, status: 409 });
            const noOffer = parseProbeDelivery('PollResponse', await f.request({ path: pollPath, input: pollRequest() }));
            assert.equal(noOffer.offer, null); assert.equal(await digest(f.db), after);
            await assert.rejects(f.issuePermit(), { code: 'PROBE_PERMIT_LIMIT' });
        } finally { await f.close(); }
    });

test('real mTLS delivery rejects forged association and injected authority on empty mailboxes too, without writes',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture(false, false, true);
        try {
            await f.prepareProbe(); const before = await digest(f.db);
            for (const [path, input] of [[pollPath, pollRequest()], [statusPath, statusRequest('unknown')]] as const) {
                await f.request({ path, input, credential: null, status: 401 });
                await f.request({ path, input, credential: 1, status: 403 });
                await f.request({ path, input: { ...input, nodeId: 'foreign' }, status: 409 });
                await f.request({ path, input, epoch: '3', status: 409 });
                await f.request({ path, input, epoch: '0', status: 409 });
                for (const patch of [{ target: '169.254.169.254' }, { fingerprint: f.fingerprint }, { actorId: 'owner' },
                    { timeoutMs: 2000 }, { binding: {} }, { instanceGeneration: 0 }, { requestId: 'a' }])
                    await f.request({ path, input: { ...input, ...patch }, status: 422 });
                await f.request({ path, input: claimRequest('unknown'), status: 422 });
                await f.request({ path, raw: '{"probeVersion":1,"probeVersion":1}', status: 409 });
                await f.request({ path, raw: ' '.repeat(4097), status: 413 });
            }
            assert.equal(await digest(f.db), before);
            await f.db.execute("INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until) VALUES(?,'node-a',?,?)",
                [f.alternateFingerprint, Date.now(), Date.now() + 90000]);
            const current = await digest(f.db);
            for (const patch of [{ bootId: 'foreign' }, { instanceId: 'd'.repeat(64) }, { instanceGeneration: 2 }])
                await f.request({ path: pollPath, input: { ...pollRequest(), ...patch }, status: 409 });
            await f.request({ path: pollPath, input: pollRequest(), credential: 1, status: 409 });
            await f.request({ path: statusPath, input: statusRequest('unknown'), status: 409 });
            assert.equal(await digest(f.db), current);
            const permit = await f.setup.probePermits.issue('owner', 'scope-a', 'forward-a', permitCommand);
            await f.setup.probePermits.consume('node-a', f.fingerprint, 2, ownerMachineCommand(permit.id));
            const consumed = await digest(f.db), check = statusRequest(permit.id);
            await f.request({ path: statusPath, input: check, credential: 1, status: 409 });
            for (const patch of [{ bootId: 'foreign' }, { instanceId: 'd'.repeat(64) }, { instanceGeneration: 2 }])
                await f.request({ path: statusPath, input: { ...check, ...patch }, status: 409 });
            assert.equal(await digest(f.db), consumed);
        } finally { await f.close(); }
    });

test('real mTLS offer and consumed status reauthorize original grants, full Forward revision, instance and current credential',
    { skip: !databaseUrl, timeout: 180000 }, async () => {
        for (const consumed of [false, true]) for (const [sql, status] of [
            ["DELETE FROM node_grants WHERE node_id='node-a'", 404],
            ["UPDATE forwards SET revision=2 WHERE id='forward-a'", 409],
            ["UPDATE probe_instances SET generation=2", 409],
            ["UPDATE runtime_nodes SET session_epoch=3 WHERE node_id='node-a'", 409],
            ["UPDATE node_credentials SET revoked=TRUE", 403],
        ] as const) {
            const f = await fixture(false, false, true);
            try {
                await f.prepareProbe(); const permit = await f.setup.probePermits.issue('owner', 'scope-a', 'forward-a', permitCommand);
                if (consumed) await f.setup.probePermits.consume('node-a', f.fingerprint, 2, ownerMachineCommand(permit.id));
                await f.db.execute(sql); const before = await digest(f.db);
                await f.request({ path: consumed ? statusPath : pollPath, input: consumed ? statusRequest(permit.id) : pollRequest(), status });
                assert.equal(await digest(f.db), before);
            } finally { await f.close(); }
        }
    });

test('real mTLS delivery withholds acknowledgements when the owner post-action maintenance guard fails before commit',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture(false, false, true);
        try {
            await f.prepareProbe(); const permit = await f.setup.probePermits.issue('owner', 'scope-a', 'forward-a', permitCommand);
            const exercise = async (path: string, input: ProbePollRequest | ProbeStatusRequest) => {
                const before = await digest(f.db); let guards = 0;
                f.reader.guard = async () => { if (++guards === 2) throw new Error('maintenance before observation commit'); };
                try { await f.request({ path, input, status: 503 }); assert.equal(guards, 2); }
                finally { f.reader.guard = undefined; }
                assert.equal(await digest(f.db), before);
                await f.request({ path, input });
            };
            await exercise(pollPath, pollRequest());
            await f.setup.probePermits.consume('node-a', f.fingerprint, 2, ownerMachineCommand(permit.id));
            await exercise(statusPath, statusRequest(permit.id));
        } finally { await f.close(); }
    });
