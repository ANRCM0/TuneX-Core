import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { digest, parseRuntimeMessage } from '@tunex/contracts';
import { AuthorityStore, trustDigest } from '../src/infrastructure/authority.ts';
import { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';
import { runUpgradeAssessment } from '../../../scripts/ops/upgrade-inspect.ts';
import { parseUpgradePlan } from '../../../scripts/ops/upgrade.ts';
import type { JournalInspection } from '../../../scripts/ops/upgrade.ts';

const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL;
const execute = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
async function fileInventory(path: string): Promise<unknown> {
    const values = [];
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        const p = join(path, entry.name);
        values.push([entry.name, entry.isDirectory() ? await fileInventory(p) :
            createHash('sha256').update(await readFile(p)).digest('hex')]);
    }
    return values;
}
async function databaseDigest(db: Connection): Promise<string> {
    const [tables] = await db.query<RowDataPacket[]>('SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
    const state = [];
    for (const table of tables) {
        assert.match(table.name, /^[a-z0-9_]+$/);
        const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM \`${table.name}\``);
        state.push([table.name, rows.map(r => JSON.stringify(r)).sort()]);
    }
    return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}

// Fixtures mutate a disposable database. The assessed connection has SELECT only.
// This is compatibility/read-only evidence, not a real backup or forwarding acceptance.
test('upgrade assessment preserves MySQL, authenticated journals and Authority; rejects unsafe restores and interrupted DDL',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const id = randomUUID().replaceAll('-', ''), name = 'tunex_upgrade_' + id;
        const username = 'upgrade_' + id.slice(0, 16), password = randomBytes(24).toString('hex');
        const url = new URL(databaseUrl!); url.pathname = '/' + name;
        const admin = await createConnection(databaseUrl!);
        const directory = await mkdtemp(join(tmpdir(), 'tunex-upgrade-'));
        let created = false, userCreated = false;
        const db = new MySqlUnitOfWork(url.toString());
        let writer: Connection | undefined;
        try {
            await admin.query(`CREATE DATABASE \`${name}\``); created = true;
            await db.migrate();
            writer = await createConnection(url.toString());
            await admin.query("CREATE USER ?@'%' IDENTIFIED BY ?", [username, password]); userCreated = true;
            await admin.query(`GRANT SELECT ON \`${name}\`.* TO ?@'%'`, [username]);
            const readerUrl = new URL(url); readerUrl.username = username; readerUrl.password = password;
            const reader = await createConnection(readerUrl.toString());
            try { await assert.rejects(reader.query('CREATE TABLE forbidden_write(id INT)')); }
            finally { await reader.end(); }
            const caPath = join(directory, 'ca.pem');
            await execute('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256',
                '-nodes', '-keyout', join(directory, 'ca.key'), '-out', caPath, '-days', '1', '-subj', '/CN=upgrade-test'], { timeout: 10000 });
            const [binding] = await writer.query<RowDataPacket[]>("SELECT CONCAT(@@server_uuid,':',DATABASE()) binding");
            const stateDirectory = join(directory, 'control');
            const authority = new AuthorityStore(stateDirectory);
            await authority.initialize(binding[0]!.binding, trustDigest(await readFile(caPath)), true);
            const vectors = JSON.parse(await readFile(new URL('../../../docs/protocol/fixtures/adp-v3-runtime.json', import.meta.url), 'utf8'));
            const snapshot = parseRuntimeMessage('Snapshot', vectors.cases.find((v: { name: string }) => v.name === 'relay-egress-udp').raw);
            const node = snapshot.nodeId, generation = snapshot.snapshotGeneration;
            await writer.query("INSERT INTO accounts(id,token_hash) VALUES('owner',?)", ['a'.repeat(64)]);
            await writer.query("INSERT INTO scopes(id,owner_id) VALUES('scope','owner')");
            await writer.query("INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts) VALUES(?,'scope',?,0,JSON_OBJECT())", [node, 'b'.repeat(64)]);
            await writer.query('INSERT INTO runtime_nodes(node_id,session_epoch,snapshot_generation) VALUES(?,?,?)', [node, snapshot.sessionEpoch, generation]);
            await writer.query('INSERT INTO snapshots(node_id,generation,session_epoch,valid_until,body) VALUES(?,?,?,?,?)',
                [node, generation, snapshot.sessionEpoch, Date.parse(snapshot.validUntil), JSON.stringify(snapshot)]);
            const record = { ...await authority.read(), latestValidUntil: Date.parse(snapshot.validUntil),
                maxLeaseSeconds: 300, maxClockSkewSeconds: 5 };
            await writeFile(authority.path, JSON.stringify({ payload: record, mac: await authority.signArtifact(record) }));
            const agentState = join(directory, 'agent'), keyPath = join(directory, 'agent-key');
            await mkdir(agentState);
            const key = randomBytes(32); await writeFile(keyPath, key);
            const fences = Object.fromEntries(snapshot.assignments.map(a => [`${a.resource.protocol}/${a.resource.port}`, a.bindingFence]));
            const journal = { snapshot, generation, digest: snapshot.snapshotDigest, fences, retired: {} };
            const payload = JSON.stringify({ ...journal, snapshot: { protocolVersion: 3, nodeId: node, journal } });
            await writeFile(join(agentState, 'journal.json'),
                `{"payload":${payload},"mac":"${createHmac('sha256', key).update(payload).digest('hex')}"}`);
            const binary = join(root, '.artifacts', 'tunex-agent');
            const inspectionArgs = ['--inspect-journal', '--node', node, '--state', agentState, '--journal-key', keyPath];
            const beforeInspect = await fileInventory(directory);
            const output = await execute(binary, inspectionArgs, { cwd: root, timeout: 10000 });
            const summary = JSON.parse(output.stdout) as JournalInspection;
            assert.equal(summary.generation, generation);
            assert.equal(summary.executionExtension, 0);
            assert.equal(summary.snapshotDigest, snapshot.snapshotDigest);
            assert.deepEqual(await fileInventory(directory), beforeInspect);
            const build = { revision: 'a'.repeat(40), imageDigest: 'sha256:' + 'b'.repeat(64), profile: 'adp3-multihop-v1' };
            const controlBuild = { ...build, profile: 'adp3-probe-results-v1' };
            const plan = parseUpgradePlan(JSON.stringify({
                version: 1, operation: 'upgrade', source: { control: controlBuild, agent: build },
                target: { control: controlBuild, agent: build }, controlMultihop: false, agentMultihop: false, journals: [summary],
            }));
            const planPath = join(directory, 'plan.json');
            await writeFile(planPath, JSON.stringify(plan));
            const options = { planPath, databaseUrl: readerUrl.toString(), stateDirectory, caPath };
            async function unchangedAssessment() {
                const beforeDb = await databaseDigest(writer!), beforeFiles = await fileInventory(directory);
                const report = await runUpgradeAssessment(options);
                assert.equal(await databaseDigest(writer!), beforeDb);
                assert.deepEqual(await fileInventory(directory), beforeFiles);
                return report;
            }
            assert.equal((await unchangedAssessment()).decision, 'compatible');
            const cliArgs = ['scripts/ops/cli.ts', 'assess-upgrade', planPath];
            const env = { ...process.env, DATABASE_URL: readerUrl.toString(), TUNEX_CONTROL_STATE: stateDirectory, TUNEX_CA_CERT: caPath };
            const beforeCli = await fileInventory(directory), beforeDb = await databaseDigest(writer);
            const cli = await execute(process.execPath, cliArgs, { cwd: root, env, timeout: 10000 });
            assert.equal(JSON.parse(cli.stdout).decision, 'compatible');
            assert.ok(!cli.stdout.includes(password)); assert.equal(cli.stderr, '');
            assert.equal(await databaseDigest(writer), beforeDb);
            assert.deepEqual(await fileInventory(directory), beforeCli);
            // A genuine exported Agent high-water must not be reset to match an older DB.
            const older = { ...snapshot, snapshotGeneration: generation - 1 };
            const { snapshotDigest: _oldDigest, ...body } = older;
            older.snapshotDigest = digest(body);
            await writer.query('INSERT INTO snapshots(node_id,generation,session_epoch,valid_until,body) VALUES(?,?,?,?,?)',
                [node, older.snapshotGeneration, older.sessionEpoch, Date.parse(older.validUntil), JSON.stringify(older)]);
            await writer.query('UPDATE runtime_nodes SET snapshot_generation=? WHERE node_id=?', [older.snapshotGeneration, node]);
            const stale = await unchangedAssessment();
            assert.equal(stale.decision, 'blocked');
            assert.ok(stale.checks.some(c => c.code === 'CONTROL_HISTORY_NOT_BEHIND_AGENT' && c.status === 'block'));
            await writer.query('UPDATE runtime_nodes SET snapshot_generation=? WHERE node_id=?', [generation, node]);
            const maintained = await authority.maintain();
            plan.operation = 'recover'; await writeFile(planPath, JSON.stringify(plan));
            const recovery = await unchangedAssessment();
            assert.equal(recovery.decision, 'review-required');
            assert.equal((await authority.read()).sequence, maintained.sequence);
            assert.ok(recovery.unchecked.includes('trusted-clock-and-lease-exhaustion'));
            // Known multi-statement DDL interrupted before its ledger row is recorded.
            await writer.query("DELETE FROM vnext_migrations WHERE name='0013-multihop-execution.sql'");
            await writer.query('ALTER TABLE relay_deployments DROP CHECK multihop_activated_count');
            await writer.query('ALTER TABLE relay_deployments DROP COLUMN activated_count');
            const partial = await unchangedAssessment();
            assert.equal(partial.decision, 'blocked');
            assert.ok(partial.database.schemaIssues.includes('0013-multihop-execution.sql'));
            const failure = await execute(process.execPath, cliArgs, {
                cwd: root, timeout: 10000, env: { ...env, DATABASE_URL: 'mysql://must-not-leak:SECRET@127.0.0.1:1/db' },
            }).then(() => assert.fail('unsafe input accepted'), error => error);
            assert.equal(JSON.parse(failure.stdout).decision, 'blocked');
            assert.ok(!String(failure.stdout + failure.stderr).includes('SECRET'));
            await assert.rejects(execute(binary, [...inspectionArgs, '--multihop'], { timeout: 10000 }));
        } finally {
            try {
                await writer?.end(); await db.close();
                if (userCreated) await admin.query("DROP USER ?@'%'", [username]);
                if (created) await admin.query(`DROP DATABASE \`${name}\``);
            } finally { await admin.end(); await rm(directory, { recursive: true, force: true }); }
        }
    });
