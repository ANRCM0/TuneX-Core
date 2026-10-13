import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { request } from 'node:https';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createConnection } from 'mysql2/promise';
import { startControl } from '../../apps/control/src/server.ts';
import { newToken } from '../../apps/control/src/modules/identity.ts';
import { DEFAULT_POLICY } from '@tunex/contracts';
import { verifyAccessMigration } from './access-migration.ts';
const viaWsl = process.platform === 'win32';
const execute = promisify(execFile), distro = process.env.TUNEX_WSL_DISTRO ?? 'TXBoard-Baseline', host = viaWsl ? process.env.TUNEX_WSL_HOST : '127.0.0.1';
if (!host || viaWsl && !/^172\.(?:[0-9]{1,3}\.){2}[0-9]{1,3}$/.test(host))
    throw new Error('TUNEX_WSL_HOST must identify the inspected private WSL host interface');
const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL;
if (!databaseUrl)
    throw new Error('Disposable MySQL URL required');
const openssl = process.env.TUNEX_OPENSSL ?? 'openssl';
function linuxPath(value: string) {
    const absolute = resolve(value);
    if (!viaWsl)
        return absolute;
    if (!/^[A-Za-z]:\\/.test(absolute))
        throw new Error('Windows mounted workspace required');
    return `/mnt/${absolute[0]!.toLowerCase()}${absolute.slice(2).replaceAll('\\', '/')}`;
}
const wslArguments = ['--distribution', distro, '--exec'];
async function linux(command: string, args: string[] = [], environment?: NodeJS.ProcessEnv) { return viaWsl ? execute('wsl.exe', [...wslArguments, command, ...args], { ...(environment ? { env: environment } : {}) }) : execute(command, args, { ...(environment ? { env: environment } : {}) }); }
function launch(command: string, args: string[]) { return viaWsl ? spawn('wsl.exe', [...wslArguments, command, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }) : spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] }); }
await mkdir('.artifacts/access', { recursive: true });
const directory = await mkdtemp(resolve('.artifacts/access/run-'));
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
const token = newToken(), scope = 'access-scope', owner = 'access-owner', ca = await readFile(caCert), checks: string[] = [];
const binaryPath = viaWsl ? '.artifacts/tunex-agent-linux' : '.artifacts/tunex-agent';
const binary = linuxPath(binaryPath), fixture = linuxPath(viaWsl ? '.artifacts/network-fixture-linux' : '.artifacts/network-fixture'), collector = linuxPath(viaWsl ? '.artifacts/time-proof-linux' : '.artifacts/time-proof');
const nativeRoot = `/tmp/tunex-linux-${randomUUID()}`;
const runtimePolicy = { ...DEFAULT_POLICY, pollIntervalSeconds: 1, leaseSeconds: 18, renewalLeadSeconds: 8 };
const serverOptions = { databaseUrl: dbUrl.toString(), caCert, caKey, serverKey, serverCert, openssl, stateDirectory: join(directory, 'control'), initializeAuthority:true, port: 0, host, policy: runtimePolicy };
async function call(method: string, path: string, input?: unknown, bearer = token, requestKey: string = randomUUID()) {
    const body = input === undefined ? undefined : JSON.stringify(input);
    return new Promise<{
        status: number;
        body: any;
    }>((resolve, reject) => {
        const req = request({ hostname: host, port: control!.port, path, method, ca, agent: false, timeout: 10000, headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json', 'idempotency-key': requestKey, ...(body ? { 'content-length': String(Buffer.byteLength(body)) } : {}) } }, res => {
            const chunks: Buffer[] = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()) });
                }
                catch (error) {
                    reject(error);
                }
            });
        });
        req.on('timeout', () => req.destroy(new Error('Control timeout')));
        req.on('error', reject);
        req.end(body);
    });
}
async function until(action: () => Promise<boolean>) {
    const start = Date.now();
    while (Date.now() - start < 45000) {
        if (await action())
            return;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Linux Agent acceptance timed out');
}
function passed(text: string) { checks.push(text); console.log(`PASS ${text}`); }
try {
    const observed = JSON.parse((await linux(collector)).stdout);
    assert.equal(observed.source, 'linux-adjtimex');
    assert.equal(observed.synchronized, true);
    assert.ok(observed.maxErrorNanos < 5e9);
    passed('Linux OS time: synchronized kernel state and bounded error obtained without changing time');
    control = await startControl(serverOptions);
    await control.control.identity.bootstrap(scope, owner, token);
    target = launch(fixture, ['--mode', 'target', '--run-id', nativeRoot]);
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
        await linux('/usr/bin/env', [`TUNEX_ENROLLMENT_TOKEN=${provision.body.enrollmentToken}`, binary, ...args, '--enroll']);
    }
    catch {
        throw new Error('Linux enrollment rejected or Control interface unreachable; token is redacted');
    }
    agent = launch(binary, args);
    let errors = '';
    agent.stderr!.on('data', data => { errors += data.toString(); });
    await until(async () => { const [records] = await control!.db.pool.query<any[]>('SELECT session_epoch FROM runtime_nodes WHERE node_id=?', [nodeId]); return records[0].session_epoch > 0; });
    const spec = { enabled: true, protocols: ['tcp', 'udp'], ingress: { nodeId, listen: { address: '127.0.0.1', port: portStatus.port } }, target: { host: '127.0.0.1', port: targetStatus.port } };
    const member = 'access-member', memberToken = newToken();
    const memberPath = `/api/v1/scopes/${scope}/members/${member}`;
    const newMember = { expectedRevision: 0, role: 'viewer', token: memberToken };
    const added = await call('PUT', memberPath, newMember, token, 'add-member');
    assert.equal(added.status, 202, JSON.stringify(added.body));
    assert.deepEqual(await call('PUT', memberPath, newMember, token, 'add-member'), added);
    const concurrent = await Promise.all([call('PUT', `/api/v1/scopes/${scope}/members/cas-member`, { expectedRevision: 0, role: 'viewer', token: newToken() }, token, 'cas-first'), call('PUT', `/api/v1/scopes/${scope}/members/cas-member`, { expectedRevision: 0, role: 'viewer', token: newToken() }, token, 'cas-second')]);
    assert.deepEqual(concurrent.map(result => result.status).sort(), [202, 409]);
    const firstAccount = await call('PUT', `/api/v1/scopes/${scope}/members/secret-check`, { expectedRevision: 0, role: 'viewer', token: newToken() }, token, 'secret-first');
    assert.equal(firstAccount.status, 202);
    const replacedAccount = await call('PUT', `/api/v1/scopes/${scope}/members/secret-check`, { expectedRevision: 1, role: 'viewer', token: newToken() }, token, 'secret-replace');
    assert.equal(replacedAccount.status, 409);
    assert.equal(replacedAccount.body.code, 'ACCOUNT_CONFLICT');
    assert.ok(!JSON.stringify(added.body).includes(memberToken));
    const rejected = (await call('POST', `/api/v1/scopes/${scope}/forwards`, spec, memberToken, 'viewer-create'));
    assert.equal(rejected.status, 403);
    assert.equal((await call('GET', `/api/v1/scopes/${scope}/nodes/${nodeId}`, undefined, memberToken)).status, 200);
    passed('Membership: viewer can query its scope but cannot accept Forward intent; retries do not expose bearer secrets');
    passed('Membership CAS: concurrent account acceptance has one winner and existing bearer credentials cannot be replaced');
    await control.db.pool.query("CREATE TRIGGER access_failure BEFORE INSERT ON access_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected access acceptance failure'");
    const rollbackToken = newToken();
    const rejectedMember = await call('PUT', `/api/v1/scopes/${scope}/members/rollback-member`, { expectedRevision: 0, role: 'viewer', token: rollbackToken }, token, 'rollback-member');
    assert.equal(rejectedMember.status, 503);
    const [orphanAccount] = await control.db.pool.query<any[]>('SELECT COUNT(*) n FROM accounts WHERE id=?', ['rollback-member']);
    assert.equal(orphanAccount[0].n, 0);
    const [orphanReplay] = await control.db.pool.query<any[]>('SELECT COUNT(*) n FROM idempotency WHERE request_key=?', ['rollback-member']);
    assert.equal(orphanReplay[0].n, 0);
    await control.db.pool.query('DROP TRIGGER access_failure');
    assert.equal((await call('PUT', `/api/v1/scopes/${scope}/members/rollback-member`, { expectedRevision: 0, role: 'viewer', token: rollbackToken }, token, 'rollback-member')).status, 202);
    passed('Access transaction: post-member audit failure rolls back account, membership and replay record together');
    const protectedOwner = await call('PUT', `/api/v1/scopes/${scope}/members/${owner}`, { expectedRevision: 1, role: 'removed' });
    assert.equal(protectedOwner.status, 409);
    assert.equal(protectedOwner.body.code, 'OWNER_PROTECTED');
    const promoted = await call('PUT', memberPath, { expectedRevision: 1, role: 'manager' }, token, 'promote-member');
    assert.equal(promoted.status, 202);
    const stale = await call('PUT', memberPath, { expectedRevision: 1, role: 'viewer' }, token, 'stale-member');
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, 'REVISION_CONFLICT');
    const noGrant = await call('POST', `/api/v1/scopes/${scope}/forwards`, spec, memberToken, 'without-node-grant');
    assert.equal(noGrant.status, 404);
    const selfEscalation = await call('PUT', `/api/v1/scopes/${scope}/nodes/${nodeId}/grants/${member}`, { expectedRevision: 1, allowed: true }, memberToken, 'self-escalation');
    assert.equal(selfEscalation.status, 403);
    const foreignScope = 'foreign-access-scope', foreignActor = 'foreign-access-owner', foreignToken = newToken();
    await control.control.identity.bootstrap(foreignScope, foreignActor, foreignToken);
    assert.equal((await call('GET', `/api/v1/scopes/${scope}/members`, undefined, foreignToken)).status, 404);
    assert.equal((await call('GET', `/api/v1/scopes/${scope}/nodes/${nodeId}/grants`, undefined, foreignToken)).status, 404);
    assert.equal((await call('PUT',`/api/v1/scopes/${scope}/nodes/${nodeId}/grants/${foreignActor}`,{expectedRevision:1,allowed:true},token,'foreign-subject')).status,404);
    passed('Access isolation: scope owner remains protected; manager cannot self-grant Node use or bypass grant checks');
    const grantPath = `/api/v1/scopes/${scope}/nodes/${nodeId}/grants/${member}`;
    const grant = await call('PUT', grantPath, { expectedRevision: 1, allowed: true }, token, 'grant-node');
    assert.equal(grant.status, 202);
    assert.equal(grant.body.revision, 2);
    assert.deepEqual(await call('PUT', grantPath, { expectedRevision: 1, allowed: true }, token, 'grant-node'), grant);
    const altered = await call('PUT', grantPath, { expectedRevision: 1, allowed: false }, token, 'grant-node');
    assert.equal(altered.status, 409);
    assert.equal(altered.body.code, 'IDEMPOTENCY_CONFLICT');
    assert.equal((await call('PUT',grantPath,{expectedRevision:1,allowed:false},token,'stale-grant')).body.code,'REVISION_CONFLICT');
    const created = await call('POST', `/api/v1/scopes/${scope}/forwards`, spec, memberToken, 'member-create');
    assert.equal(created.status, 202, JSON.stringify(created.body));
    const forwardId = created.body.forwardId as string;
    const resourcePath = `/api/v1/scopes/${scope}/forwards/${forwardId}`;
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${created.body.operationId}`)).body.status === 'succeeded');
    const probe = JSON.parse((await linux(fixture, ['--mode', 'probe', '--port', String(portStatus.port)])).stdout);
    assert.equal(probe.tcp, true);
    assert.equal(probe.udp, true);
    const [records] = await control.db.pool.query<any[]>('SELECT authorization_actor FROM forwards WHERE id=?', [forwardId]);
    assert.equal(records[0].authorization_actor, member);
    passed('Node grant: explicitly authorized member creates persistent intent and exact Linux TCP/UDP traffic');
    const rollbackProof = new Error('Rollback authorizer fault fixture');
    let missingAuthorizerRefused = false;
    try {
        await control.db.transaction(async (tx) => { await control!.control.ledger.lockNode(tx, nodeId); const damaged = { id: randomUUID(), scopeId: scope, revision: 1, spec: { ...spec, protocols: ['tcp', 'udp'] as const } }; await control!.control.forwarding.insert(tx, damaged, member); await control!.control.ledger.accept(tx, damaged, { scopeId: scope, actorId: member, key: 'missing-authorizer-fixture', digest: 'sha256:' + '0'.repeat(64) }); await tx.execute('UPDATE forwards SET authorization_actor=NULL WHERE id=?', [damaged.id]); const facts = await control!.control.nodes.facts(tx, nodeId); const compiled = await control!.control.ledger.assignments(tx, control!.control.forwarding, facts.facts, true); assert.ok(!compiled.some(a => a.forwardId === damaged.id)); missingAuthorizerRefused = true; throw rollbackProof; });
    }
    catch (error) {
        if (error !== rollbackProof)
            throw error;
    }
    assert.equal(missingAuthorizerRefused, true);
    passed('Execution authority: missing persisted authorizer is refused instead of falling back to Operation requester');
    const ownerPort = JSON.parse((await linux(fixture, ['--mode', 'port'])).stdout).port as number;
    const expandedPolicy = { allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [portStatus.port, ownerPort], egressPolicyRevision: 2, allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false };
    const expanded = await call('PUT', `/api/v1/scopes/${scope}/nodes/${nodeId}/policy`, { expectedRevision: 1, policy: expandedPolicy }, token, 'expand-policy');
    assert.equal(expanded.status, 202);
    for (const operationId of expanded.body.operationIds)
        await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${operationId}`)).body.status === 'succeeded');
    const ownerCreated = await call('POST', `/api/v1/scopes/${scope}/forwards`, { ...spec, ingress: { nodeId, listen: { address: '127.0.0.1', port: ownerPort } } }, token, 'owner-forward');
    assert.equal(ownerCreated.status, 202);
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${ownerCreated.body.operationId}`)).body.status === 'succeeded');
    const withdrawn = await call('PUT', grantPath, { expectedRevision: 2, allowed: false }, token, 'withdraw-node');
    assert.equal(withdrawn.status, 202);
    assert.equal(withdrawn.body.operationIds.length, 1);
    assert.ok(withdrawn.body.latestAuthorizationUntil);
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${withdrawn.body.operationIds[0]}`)).body.status === 'succeeded');
    let stopped = false;
    try {
        await linux(fixture, ['--mode', 'probe', '--port', String(portStatus.port)]);
    }
    catch {
        stopped = true;
    }
    ;
    assert.equal(stopped, true);
    assert.equal((await call('POST', `/api/v1/scopes/${scope}/forwards`, spec, memberToken, 'after-node-withdraw')).status, 404);
    const policyChange = await call('PUT', `/api/v1/scopes/${scope}/nodes/${nodeId}/policy`, { expectedRevision: 2, policy: { ...expandedPolicy, egressPolicyRevision: 3, allowedDestinationCidrs: ['127.0.0.0/9'] } }, token, 'owner-policy');
    assert.equal(policyChange.status, 202);
    await until(async () => { const [rows] = await control!.db.pool.query<any[]>('SELECT body FROM snapshots WHERE node_id=? ORDER BY generation DESC LIMIT 1', [nodeId]); return !rows[0].body.assignments.some((a: any) => a.forwardId === forwardId) && rows[0].body.assignments.some((a: any) => a.forwardId === ownerCreated.body.forwardId); });
    const ownerProbe = JSON.parse((await linux(fixture, ['--mode', 'probe', '--port', String(ownerPort)])).stdout);
    assert.equal(ownerProbe.tcp, true);
    assert.equal(ownerProbe.udp, true);
    assert.equal((await call('GET', resourcePath)).body.desired.revision, 1);
    passed('Grant withdrawal: old execution is removed; owner policy Operation cannot silently take over member authority');
    passed('Shared Node isolation: withdrawing one actor preserves another explicitly authorized Forward and both protocols');
    const restoredGrant = await call('PUT', grantPath, { expectedRevision: 3, allowed: true }, token, 'restore-node');
    assert.equal(restoredGrant.status, 202);
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${restoredGrant.body.operationIds[0]}`)).body.status === 'succeeded');
    const again = JSON.parse((await linux(fixture, ['--mode', 'probe', '--port', String(portStatus.port)])).stdout);
    assert.equal(again.tcp, true);
    assert.equal(again.udp, true);
    const demoted = await call('PUT', memberPath, { expectedRevision: 2, role: 'viewer' }, token, 'demote-member');
    assert.equal(demoted.status, 202);
    assert.equal(demoted.body.operationIds.length, 1);
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${demoted.body.operationIds[0]}`)).body.status === 'succeeded');
    assert.equal((await call('POST', `/api/v1/scopes/${scope}/forwards`, spec, memberToken, 'demoted-write')).status, 403);
    const restoredMember = await call('PUT', memberPath, { expectedRevision: 3, role: 'manager' }, token, 'restore-member');
    assert.equal(restoredMember.status, 202);
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${restoredMember.body.operationIds[0]}`)).body.status === 'succeeded');
    passed('Membership change: demotion withdraws execution and explicit restoration uses fresh generation/fence');
    const removed = await call('PUT', memberPath, { expectedRevision: 4, role: 'removed' }, token, 'remove-member');
    assert.equal(removed.status, 202);
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${removed.body.operationIds[0]}`)).body.status === 'succeeded');
    assert.equal((await call('GET', resourcePath, undefined, memberToken)).status, 404);
    assert.equal((await call('POST', `/api/v1/scopes/${scope}/forwards`, spec, memberToken, 'member-create')).status, 404);
    const cleanup = await call('DELETE', resourcePath, { expectedRevision: 1 }, token, 'owner-cleanup');
    assert.equal(cleanup.status, 202);
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${cleanup.body.operationId}`)).body.status === 'succeeded');
    const disabledOwner = await call('PUT', `/api/v1/scopes/${scope}/forwards/${ownerCreated.body.forwardId}`, { expectedRevision: 1, spec: { ...spec, enabled: false } }, token, 'owner-disable-port-change');
    assert.equal(disabledOwner.status, 202);
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${disabledOwner.body.operationId}`)).body.status === 'succeeded');
    const [heldSlots] = await control.db.pool.query<any[]>('SELECT port FROM port_slots WHERE owner_id=?', [ownerCreated.body.forwardId]);
    assert.equal(heldSlots.length, 2);
    assert.ok(heldSlots.every(row => row.port === portStatus.port));
    passed('Safe cleanup: simultaneous disable/port change retains only desired reservations after old authority is retired');
    const ownerCleanup = await call('DELETE', `/api/v1/scopes/${scope}/forwards/${ownerCreated.body.forwardId}`, { expectedRevision: 2 }, token, 'owner-own-cleanup');
    assert.equal(ownerCleanup.status, 202);
    await until(async () => (await call('GET', `/api/v1/scopes/${scope}/operations/${ownerCleanup.body.operationId}`)).body.status === 'succeeded');
    passed('Member removal: no cross-scope leak or accepted-write replay after permission loss; owner retains cleanup access');
    const members = await call('GET', `/api/v1/scopes/${scope}/members`);
    assert.equal(members.body.members.find((m: any) => m.actorId === member).role, 'removed');
    await writeFile(join(directory, 'member.json'), JSON.stringify({ expectedRevision: 5, role: 'removed' }));
    const cliEnvironment = { ...process.env, TUNEX_CONTROL_URL: `https://${host}:${control.port}`, TUNEX_CA_CERT: caCert, TUNEX_OWNER_TOKEN: token };
    const cliMembers = await execute(process.execPath, ['apps/control/src/client.ts', 'members', scope], { env: cliEnvironment });
    assert.equal(JSON.parse(cliMembers.stdout).members.find((m: any) => m.actorId === member).role, 'removed');
    const cliNoop = await execute(process.execPath, ['apps/control/src/client.ts', 'member', scope, member, join(directory, 'member.json'), 'cli-member-noop'], { env: cliEnvironment });
    assert.equal(JSON.parse(cliNoop.stdout).revision, 5);
    const grants = await execute(process.execPath, ['apps/control/src/client.ts', 'node-grants', scope, nodeId], { env: cliEnvironment });
    assert.equal(JSON.parse(grants.stdout).revision, 4);
    await writeFile(join(directory, 'grant.json'), JSON.stringify({ expectedRevision: 4, allowed: false }));
    const cliGrant = await execute(process.execPath, ['apps/control/src/client.ts', 'node-grant', scope, nodeId, member, join(directory, 'grant.json'), 'cli-grant-withdraw'], { env: cliEnvironment });
    assert.equal(JSON.parse(cliGrant.stdout).revision, 5);
    passed('Access CLI: member list/no-op and Node grant query/withdraw use trusted HTTPS and stable request keys');
    const [audit] = await control.db.pool.query<any[]>('SELECT details FROM access_events WHERE scope_id=?', [scope]);
    const [replays] = await control.db.pool.query<any[]>('SELECT response FROM idempotency WHERE scope_id=?', [scope]);
    assert.ok(!JSON.stringify(audit).includes(memberToken) && !JSON.stringify(replays).includes(memberToken));
    await verifyAccessMigration(databaseUrl);
    passed('VNext migration: system policy requester never replaces explicit user authority and unresolved history stays closed');
    const commit = (await execute('git', ['rev-parse', 'HEAD'])).stdout.trim();
    await writeFile(join(directory, 'evidence.json'), JSON.stringify({ commit, workingTreeDirty: Boolean((await execute('git', ['status', '--porcelain'])).stdout.trim()), command: 'npm run test:access', checks, synchronization: observed, agentSHA: createHash('sha256').update(await readFile(binaryPath)).digest('hex'), kernel: (await linux('/bin/uname', ['-a'])).stdout.trim(), topology: viaWsl ? 'Windows locked Node/MySQL Control with native Linux Agent/client/target' : 'Native Linux Control/MySQL/Agent/client/target', ownerProtected: true, accountSecretsExcluded: true }, null, 2));
    console.log(`Access management passed: ${checks.length} checks. Evidence ${directory}`);
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
