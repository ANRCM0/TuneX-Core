import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/api/app.ts';
import { ControlApplication } from '../src/application/control.ts';
import { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';
import type { AuthorityStore } from '../src/infrastructure/authority.ts';
import type { NodeCertificateAuthority } from '../src/infrastructure/pki.ts';
import { Identity, tokenHash } from '../src/modules/identity.ts';
import { Nodes } from '../src/modules/nodes.ts';
import type { RuntimeController } from '../src/modules/runtime/controller.ts';
import type { NodeReportObservation } from '../src/modules/observation-ports.ts';

const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL;
const command = { source: 'persisted-agent-report', version: 1 };

async function digest(db: Connection) {
    const [tables] = await db.query<RowDataPacket[]>(
        'SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
    const inventory = [];
    for (const table of tables) {
        assert.match(table.name, /^[a-z0-9_]+$/);
        const [records] = await db.query<RowDataPacket[]>(`SELECT * FROM \`${table.name}\``);
        inventory.push([table.name, records.map(record => JSON.stringify(record)).sort()]);
    }
    return createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
}

async function fixture() {
    const suffix = randomUUID().replaceAll('-', ''), name = 'tunex_observe_' + suffix;
    const username = 'observe_' + suffix.slice(0, 16), password = randomBytes(24).toString('hex');
    const url = new URL(databaseUrl!); url.pathname = '/' + name;
    const admin = await createConnection(databaseUrl!), writer = new MySqlUnitOfWork(url.toString());
    let created = false, userCreated = false, connection: Connection | undefined, reader: MySqlUnitOfWork | undefined;
    const close = async () => {
        await reader?.pool.end(); await connection?.end(); await writer.pool.end();
        try {
            if (userCreated) await admin.query("DROP USER ?@'%'", [username]);
            if (created) await admin.query(`DROP DATABASE \`${name}\``);
        } finally { await admin.end(); }
    };
    try {
        await admin.query(`CREATE DATABASE \`${name}\``); created = true;
        await writer.migrate(); connection = await createConnection(url.toString());
        const identity = new Identity(writer), tokens: Record<string, string> = {};
        for (const actor of ['owner', 'outsider', 'inactive', ...Array.from({ length: 24 }, (_, i) => 'viewer-' + i)])
            tokens[actor] = randomBytes(32).toString('base64url');
        await identity.bootstrap('scope-a', 'owner', tokens.owner!);
        await identity.bootstrap('scope-b', 'outsider', tokens.outsider!);
        for (const actor of ['inactive', ...Array.from({ length: 24 }, (_, i) => 'viewer-' + i)]) {
            await connection.execute('INSERT INTO accounts(id,token_hash) VALUES(?,?)', [actor, tokenHash(tokens[actor]!)]);
            await connection.execute('INSERT INTO scope_members(scope_id,actor_id,can_manage,active) VALUES(?,?,FALSE,?)',
                ['scope-a', actor, actor !== 'inactive']);
        }
        for (const [node, scope] of [['node-a', 'scope-a'], ['foreign-node', 'scope-b']]) {
            await connection.execute(`INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,
                revoked,facts,enrollment_response,resource_source,owner_actor_id,resource_revision) VALUES(?,?,?,0,?,FALSE,?,?,?,?,1)`, [node, scope,
                createHash('sha256').update(node!).digest('hex'), Date.now() + 120000,
                JSON.stringify({ secret: 'MUST_NOT_LEAK' }), JSON.stringify({ credential: 'MUST_NOT_LEAK' }),
                'private', node === 'node-a' ? 'viewer-1' : 'outsider']);
        }
        await connection.execute('INSERT INTO runtime_nodes(node_id,session_epoch,boot_id,snapshot_generation) VALUES(?,2,?,3)',
            ['node-a', 'boot-a']);
        await connection.execute('INSERT INTO snapshots(node_id,generation,session_epoch,valid_until,body) VALUES(?,3,2,?,?)',
            ['node-a', Date.now() + 120000, JSON.stringify({ secret: 'MUST_NOT_LEAK' })]);
        const seed = async (patch: Record<string, unknown> = {}, ageMs = 0) => {
            const now = Date.now();
            const report = { protocolVersion: 3, nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, reportSequence: 4,
                acceptedSnapshotGeneration: 3, observedAt: new Date(now - ageMs).toISOString(),
                observations: [{ condition: 'ready', secret: 'MUST_NOT_LEAK' }], ...patch };
            await connection!.execute(`UPDATE runtime_nodes SET session_epoch=2,boot_id='boot-a',snapshot_generation=3,
                last_report_sequence=4,last_report=?,received_at=? WHERE node_id='node-a'`,
                [JSON.stringify(report), now - ageMs]);
            await connection!.execute('UPDATE nodes SET revoked=FALSE,credential_until=? WHERE id=?', [now + 120000, 'node-a']);
            await connection!.execute('UPDATE snapshots SET valid_until=? WHERE node_id=?', [now + 120000, 'node-a']);
        };
        await seed();
        await admin.query("CREATE USER ?@'%' IDENTIFIED BY ?", [username, password]); userCreated = true;
        await admin.query(`GRANT SELECT ON \`${name}\`.* TO ?@'%'`, [username]);
        const readUrl = new URL(url); readUrl.username = username; readUrl.password = password;
        reader = new MySqlUnitOfWork(readUrl.toString());
        await assert.rejects(reader.pool.query('UPDATE nodes SET revoked=TRUE'));
        const readIdentity = new Identity(reader);
        const control = new ControlApplication(reader, readIdentity,
            new Nodes(reader, readIdentity, {} as NodeCertificateAuthority));
        const app = createApp(control, {} as RuntimeController, { allow: async () => undefined } as unknown as AuthorityStore);
        const lastRequest = new Map<string,number>();
        const request = async (options: {
            actor?: string; scope?: string; node?: string; input?: unknown; raw?: string; status?: number;
        } = {}) => {
            const actor = options.actor ?? 'owner';
            const elapsed = Date.now() - (lastRequest.get(actor) ?? 0);
            if (options.status !== 429 && elapsed < 1100) await delay(1100 - elapsed);
            const response = await app.request('/api/v1/scopes/' + (options.scope ?? 'scope-a') + '/nodes/' +
                (options.node ?? 'node-a') + '/observations', {
                method: 'POST', headers: { Authorization: 'Bearer ' + tokens[actor], 'Content-Type': 'application/json' },
                body: options.raw ?? JSON.stringify(options.input ?? command),
            });
            const text = await response.text();
            lastRequest.set(actor, Date.now());
            assert.equal(response.status, options.status ?? 200, text);
            assert.equal(response.headers.get('cache-control'), 'no-store');
            assert.ok(new TextEncoder().encode(text).length <= 4096);
            for (const secret of ['MUST_NOT_LEAK', password, ...Object.values(tokens)])
                assert.ok(!text.includes(secret), 'observation must not expose credentials or raw evidence');
            return JSON.parse(text) as NodeReportObservation & { code?: string };
        };
        return { connection, reader, control, app, seed, request, tokens, close };
    } catch (error) {
        await close(); throw error;
    }
}

test('observation production assembly uses SELECT-only MySQL and preserves scope authorization and database contents',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            const before = await digest(f.connection);
            const result = await f.request();
            assert.equal(result.status, 'observed'); assert.equal(result.reason, 'recent-report');
            assert.equal(result.independentProbe, false); assert.equal(result.health, 'unknown');
            assert.equal(result.provenance?.reportSequence, 4); assert.equal(result.provenance?.assignmentCount, 1);
            assert.equal(result.scopeId, 'scope-a'); assert.equal(result.nodeId, 'node-a');
            // Scope governance and the explicit private Node owner can read persisted reports without execution grants.
            assert.equal((await f.request({ actor: 'owner', status: 429 })).code, 'OBSERVATION_BUSY');
            assert.equal((await f.request({ actor: 'viewer-1' })).status, 'observed');
            await f.request({ actor: 'viewer-0', status: 404 });
            await f.request({ actor: 'outsider', status: 404 });
            await f.request({ actor: 'inactive', status: 404 });
            await f.request({ node: 'foreign-node', status: 404 });
            await f.request({ node: 'missing-node', status: 404 });
            const unauthenticated = await f.app.request('/api/v1/scopes/scope-a/nodes/node-a/observations', {
                method: 'POST', body: JSON.stringify(command),
            });
            assert.equal(unauthenticated.status, 401);
            for (const input of [{ ...command, target: '169.254.169.254' }, { ...command, version: 2 },
                { ...command, source: 'tcp-probe' }, { ...command, timeoutMs: '100' }, { ...command, timeoutMs: 2001 }])
                await f.request({ input, status: 422 });
            await f.request({ raw: '{"source":', status: 422 });
            await f.request({ raw: '{"source":"persisted-agent-report","version":1,"version":1}', status: 409 });
            await f.request({ input: { padding: 'x'.repeat(1100) }, status: 413 });
            assert.equal(await digest(f.connection), before, 'observation API must not mutate any persisted state');
        } finally { await f.close(); }
    });

test('persisted report provenance and expiry never become independent health or applied-state claims',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            await f.seed({}, 31000);
            assert.equal((await f.request()).reason, 'report-expired');
            await f.seed({ observedAt: new Date(Date.now() - 40000).toISOString() });
            assert.equal((await f.request()).status, 'stale');
            await f.seed({ bootId: 'previous-boot' });
            assert.equal((await f.request()).reason, 'session-mismatch');
            await f.seed({ nodeId: 'foreign-node' });
            assert.equal((await f.request()).reason, 'session-mismatch');
            await f.seed({ acceptedSnapshotGeneration: 2 });
            assert.equal((await f.request()).reason, 'snapshot-mismatch');
            await f.seed({ reportSequence: 3 });
            assert.equal((await f.request()).reason, 'invalid-report');
            await f.seed({ sessionEpoch: '2' });
            assert.equal((await f.request()).reason, 'invalid-report');
            await f.seed({ observedAt: new Date(Date.now() + 60000).toISOString() });
            assert.equal((await f.request()).reason, 'clock-skew');
            await f.seed({ observations: 'not-an-array' });
            assert.equal((await f.request()).reason, 'invalid-report');
            await f.seed();
            await f.connection.execute('UPDATE nodes SET revoked=TRUE WHERE id=?', ['node-a']);
            assert.equal((await f.request()).reason, 'node-revoked');
            await f.seed();
            await f.connection.execute('UPDATE snapshots SET valid_until=? WHERE node_id=?', [Date.now(), 'node-a']);
            assert.equal((await f.request()).reason, 'snapshot-expired');
            await f.seed();
            await f.connection.execute('UPDATE nodes SET credential_until=? WHERE id=?', [Date.now(), 'node-a']);
            assert.equal((await f.request()).reason, 'credential-expired');
            await f.seed();
            await f.connection.execute('UPDATE runtime_nodes SET last_report=NULL,received_at=NULL WHERE node_id=?', ['node-a']);
            const missing = await f.request();
            assert.equal(missing.reason, 'missing-report'); assert.equal(missing.provenance, null);
        } finally { await f.close(); }
    });

test('a real MySQL authorization lock is stopped by the observation deadline without changing grants or execution state',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            const before = await digest(f.connection);
            await f.connection.beginTransaction();
            await f.connection.execute("UPDATE scope_members SET can_manage=can_manage WHERE scope_id='scope-a' AND actor_id='owner'");
            try {
                const result = await f.request({ actor: 'owner', input: { ...command, timeoutMs: 100 }, status: 503 });
                assert.equal(result.code, 'OBSERVATION_TIMEOUT');
                // The original authorization lock is still held. A closed source must release local admission,
                // rather than leave mysql2's in-flight promise pending until this writer rolls back.
                await delay(50);
                assert.equal((await f.request({ actor: 'viewer-1' })).status, 'observed');
            } finally { await f.connection.rollback(); }
            assert.equal(await digest(f.connection), before);
            const [rows] = await f.reader.pool.query<RowDataPacket[]>('SELECT 1 alive');
            assert.equal(rows[0]?.alive, 1);
        } finally { await f.close(); }
    });
