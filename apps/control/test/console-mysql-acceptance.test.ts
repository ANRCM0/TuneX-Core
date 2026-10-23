import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/api/app.ts';
import type { ControlApplication } from '../src/application/control.ts';
import type { AuthorityStore } from '../src/infrastructure/authority.ts';
import { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';
import { Identity, tokenHash } from '../src/modules/identity.ts';
import type { RuntimeController } from '../src/modules/runtime/controller.ts';
import { ConsoleQueries } from '../src/application/console-queries.ts';
import { ResourceAccess } from '../src/modules/resource-access-owner/public.ts';
import { MySqlResourceAccessStore } from '../src/infrastructure/mysql-resource-access.ts';
import { MySqlConsoleReadModels } from '../src/infrastructure/mysql-console-read.ts';

const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL;
async function databaseDigest(db: Connection): Promise<string> {
    const [tables] = await db.query<RowDataPacket[]>('SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
    const inventory = [];
    for (const table of tables) {
        assert.match(table.name, /^[a-z0-9_]+$/);
        const [records] = await db.query<RowDataPacket[]>(`SELECT * FROM \`${table.name}\``);
        inventory.push([table.name, records.map(r => JSON.stringify(r)).sort()]);
    }
    return createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
}
type Page = { page: number; limit: number; total: number; items: { id: string; status?: string; lastOperation?: { id: string } }[] };
type Overview = { nodes: number; forwards: number; activeOperations: number; failedOperations: number; independentProbe: boolean };

// Real migrations, mysql2 prepared SQL, Hono routing and bearer/scope authorization.
// Fixtures alone write; API connections have SELECT only. Not browser or physical-host evidence.
test('console queries preserve bounded pages, independent candidates, full-scope totals and read-only authorization',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const suffix = randomUUID().replaceAll('-', ''), name = 'tunex_console_' + suffix;
        const user = 'console_' + suffix.slice(0, 16), password = randomBytes(24).toString('hex');
        const url = new URL(databaseUrl!); url.pathname = '/' + name;
        const admin = await createConnection(databaseUrl!);
        const writer = new MySqlUnitOfWork(url.toString());
        let created = false, userCreated = false, connection: Connection | undefined, reader: MySqlUnitOfWork | undefined;
        try {
            await admin.query(`CREATE DATABASE \`${name}\``); created = true;
            await writer.migrate();
            connection = await createConnection(url.toString());
            const tokens = Object.fromEntries(['owner', 'manager', 'viewer', 'inactive', 'outsider'].map(id => [id, randomBytes(32).toString('base64url')]));
            const identity = new Identity(writer);
            await identity.bootstrap('scope-a', 'owner', tokens.owner!);
            await identity.bootstrap('scope-b', 'outsider', tokens.outsider!);
            for (const id of ['manager', 'viewer', 'inactive']) {
                await connection.execute('INSERT INTO accounts(id,token_hash) VALUES(?,?)', [id, tokenHash(tokens[id]!)]);
                await connection.execute('INSERT INTO scope_members(scope_id,actor_id,can_manage,active) VALUES(?,?,?,?)', ['scope-a', id, id !== 'viewer', id !== 'inactive']);
            }
            const now = Date.now(), goodCaps = ['adp.3', 'native.direct.v1', 'tcp', 'udp', 'native.relay.v1', 'relay.wire.1', 'adp.execution.1', 'native.multihop.v1', 'multihop.wire.1'];
            const nodeId = (i: number) => i === 38 ? 'node_lit' : i === 39 ? 'nodexlit' : 'node-' + String(i).padStart(2, '0');
            for (let i = 0; i < 41; i++) {
                const id = i === 40 ? 'foreign-node' : nodeId(i), scope = i === 40 ? 'scope-b' : 'scope-a';
                const caps = goodCaps.filter(c => i === 4 ? !['tcp', 'udp'].includes(c) : i === 5 ? !['native.relay.v1', 'relay.wire.1'].includes(c) :
                    i === 6 ? !['udp', 'native.multihop.v1'].includes(c) : i === 9 ? c !== 'adp.3' : i === 10 ? c !== 'native.direct.v1' : true);
                const facts = { allowedListenerAddresses: i === 8 ? [] : ['127.0.0.1'], allowedPorts: i === 7 ? [] : [25565], capabilities: caps,
                    allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false, egressPolicyRevision: 1 };
                await connection.execute('INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,revoked,facts,enrollment_response,resource_source,owner_actor_id,resource_revision) VALUES(?,?,?,0,?,?,?,?,?,?,1)',
                    [id, scope, createHash('sha256').update(id).digest('hex'), i === 2 ? null : i === 1 ? now - 1 : now + 3600000, i === 0, JSON.stringify(facts), JSON.stringify({ secret: 'MUST_NOT_LEAK' }), 'private', scope==='scope-a'?'manager':'outsider']);
                if (i !== 3) await connection.execute('INSERT INTO node_grants(node_id,actor_id) VALUES(?,?)', [id, 'manager']);
            }
            for (let i = 0; i < 41; i++) {
                const id = 'forward-' + String(i).padStart(2, '0'), scope = i === 40 ? 'scope-b' : 'scope-a';
                const spec = { enabled: i % 2 === 0, protocols: i % 2 === 0 ? ['tcp', 'udp'] : ['tcp'],
                    ingress: { nodeId: 'node-20', listen: { address: '127.0.0.1', port: 25565 } }, target: { host: '127.0.0.1', port: 80 } };
                await connection.execute('INSERT INTO forwards(id,scope_id,revision,spec,deleting,recovery_suspended,owner_actor_id) VALUES(?,?,1,?,?,?,?)',
                    [id, scope, JSON.stringify(spec), i === 39, i === 38, scope==='scope-a'?'manager':'outsider']);
            }
            for (let i = 0; i < 46; i++) {
                const id = 'op-' + String(i).padStart(2, '0'), scope = i === 45 ? 'scope-b' : 'scope-a';
                const status = i === 0 || i === 3 || i === 45 ? 'failed' : i === 1 ? 'running' : i === 2 ? 'accepted' : 'succeeded';
                await connection.execute(`INSERT INTO operations(id,scope_id,forward_id,target_revision,kind,status,requested_by,idempotency_key,request_digest,created_at,updated_at,execution_deadline)
                    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, [id, scope, 'forward-' + String(i === 45 ? 40 : i % 40).padStart(2, '0'), i < 40 ? 1 : 2, i === 0 ? 'update' : 'create',
                    status, 'owner', id, 'sha256:' + 'a'.repeat(64), i < 4 ? 1000 : 2000, 2000, now + 3600000]);
            }
            await admin.query("CREATE USER ?@'%' IDENTIFIED BY ?", [user, password]); userCreated = true;
            await admin.query(`GRANT SELECT ON \`${name}\`.* TO ?@'%'`, [user]);
            const readUrl = new URL(url); readUrl.username = user; readUrl.password = password;
            reader = new MySqlUnitOfWork(readUrl.toString());
            await assert.rejects(reader.pool.query("UPDATE nodes SET revoked=TRUE"));
            const readIdentity = new Identity(reader);
            const control = { db: reader, identity: readIdentity, queries: new ConsoleQueries(reader, readIdentity, new MySqlConsoleReadModels(), new ResourceAccess(readIdentity,new MySqlResourceAccessStore())) } as unknown as ControlApplication;
            const authority = { allow: async () => undefined } as unknown as AuthorityStore;
            const app = createApp(control, {} as RuntimeController, authority);
            async function get<T>(resource: string, actor = 'manager', expected = 200, scope = 'scope-a'): Promise<T> {
                const response = await app.request('/api/v1/scopes/' + scope + '/' + resource, { headers: { Authorization: 'Bearer ' + tokens[actor] } });
                const text = await response.text();
                assert.equal(response.status, expected, resource + ': ' + text);
                assert.equal(response.headers.get('cache-control'), 'no-store');
                for (const secret of ['MUST_NOT_LEAK', 'enrollment_hash', 'enrollment_response', password, ...Object.values(tokens)]) assert.ok(!text.includes(secret), secret);
                return JSON.parse(text) as T;
            }
            const before = await databaseDigest(connection);
            const nodes = await get<Page>('nodes');
            assert.equal(nodes.total, 40); assert.equal(nodes.items.length, 25);
            const second = await get<Page>('nodes?page=2');
            assert.equal(second.items.length, 15);
            assert.ok(nodes.items.every(n => !second.items.some(other => n.id === other.id)));
            assert.equal((await get<Page>('nodes?page=9999')).total, 40);
            assert.deepEqual((await get<Page>('nodes?page=9999')).items, []);
            assert.equal((await get<Page>('nodes?credential=valid')).total, 37);
            for (const credential of ['revoked', 'expired', 'unenrolled']) assert.equal((await get<Page>('nodes?credential=' + credential)).total, 1);
            assert.deepEqual((await get<Page>('nodes?idPrefix=node_')).items.map(n => n.id), ['node_lit']);
            const candidates = await get<Page>('nodes/candidates');
            assert.equal(candidates.total, 31); assert.equal(candidates.items.length, 25);
            assert.equal((await get<Page>('nodes/candidates?page=2')).items.length, 6);
            assert.ok(!nodes.items.some(n => n.id === 'node_lit'));
            assert.deepEqual((await get<Page>('nodes/candidates?nodeId=node_lit')).items.map(n => n.id), ['node_lit']);
            assert.equal((await get<Page>('nodes/candidates?nodeId=foreign-node')).total, 0);
            assert.equal((await get<Page>('nodes/candidates', 'owner')).total, 0, 'Owner must not bypass explicit Node Grant');
            assert.equal((await get<Page>('nodes/candidates?mode=relay')).total, 30);
            assert.equal((await get<Page>('nodes/candidates?mode=multihop')).total, 29);
            assert.equal((await get<Page>('nodes/candidates?protocol=both')).total, 30);
            for (let i = 0; i <= 10; i++) {
                if (i === 5 || i === 6) continue;
                assert.equal((await get<Page>('nodes/candidates?nodeId=' + nodeId(i))).total, 0, nodeId(i));
            }
            assert.equal((await get<Page>('forwards')).total, 39);
            assert.equal((await get<Page>('forwards?enabled=true&protocol=both')).total, 20);
            assert.equal((await get<Page>('forwards?enabled=false&protocol=udp')).total, 0);
            assert.deepEqual((await get<Page>('forwards?recoverySuspended=true')).items.map(f => f.id), ['forward-38']);
            assert.equal((await get<Page>('forwards?idPrefix=forward-00')).items[0]?.lastOperation?.id, 'op-40');
            const operations = await get<Page>('operations');
            assert.equal(operations.total, 45); assert.equal(operations.items.length, 25);
            assert.ok(operations.items.every(o => o.status === 'succeeded'));
            const operations2 = await get<Page>('operations?page=2');
            assert.ok(operations.items.every(o => !operations2.items.some(other => o.id === other.id)));
            assert.deepEqual((await get<Page>('operations?status=failed&kind=update&forwardId=forward-00')).items.map(o => o.id), ['op-00']);
            for(const resource of ['nodes','forwards','operations']){const personal=await get<Page>(resource,'viewer');assert.equal(personal.total,0);assert.deepEqual(personal.items,[]);}
            const governed=await get<Overview>('overview','owner');assert.deepEqual([governed.nodes,governed.forwards,governed.activeOperations,governed.failedOperations],[40,39,2,2]);
            const overview = await get<Overview>('overview', 'viewer');
            assert.deepEqual([overview.nodes, overview.forwards, overview.activeOperations, overview.failedOperations], [0, 0, 0, 0]);
            assert.equal(overview.independentProbe, false);
            await get('operations?page=2&status=failed');
            const afterPage = await get<Overview>('overview');
            assert.deepEqual([afterPage.nodes, afterPage.forwards, afterPage.activeOperations, afterPage.failedOperations], [40, 39, 2, 2]);
            for (const resource of ['nodes', 'forwards', 'operations', 'overview', 'nodes/candidates']) {
                await get(resource, 'outsider', 404); await get(resource, 'inactive', 404);
                await get(resource, 'manager', 404, 'scope-b');
                if (resource !== 'nodes/candidates') await get(resource, 'viewer');
            }
            await get('nodes/candidates', 'viewer', 403);
            for (const resource of ['overview?page=1', 'nodes?page=1&page=2', 'nodes?limit=101', 'nodes?idPrefix=node%25',
                'forwards?enabled=1', 'operations?status=failed%27%20OR%201=1', 'nodes/candidates?actor=owner', 'nodes/candidates?mode=unknown'])
                await get(resource, 'manager', 422);
            for (const table of ['nodes', 'forwards', 'operations']) {
                const [indexes] = await connection.query<RowDataPacket[]>(`SHOW INDEX FROM ${table}`);
                assert.ok(indexes.some(index => index.Column_name === 'scope_id' && Number(index.Seq_in_index) === 1), table + ' scope index');
                const [plan] = await connection.execute<RowDataPacket[]>(`EXPLAIN SELECT id FROM ${table} WHERE scope_id=? ORDER BY id LIMIT 25`, ['scope-a']);
                assert.ok(plan.some(row => row.possible_keys), table + ' scoped lookup must have index candidates');
            }
            assert.equal(await databaseDigest(connection), before, 'read API must preserve every table, including leases, audit and runtime');
            // Mutations below are test fixtures, not performed by the read API.
            await connection.execute("DELETE FROM node_grants WHERE actor_id='manager' AND node_id='node_lit'");
            let unchanged = await databaseDigest(connection);
            assert.equal((await get<Page>('nodes/candidates?nodeId=node_lit')).total, 0);
            assert.equal(await databaseDigest(connection), unchanged);
            await connection.execute("UPDATE nodes SET credential_until=? WHERE id='node-37'", [Date.now() - 1]);
            await connection.execute("UPDATE nodes SET revoked=TRUE WHERE id='node-36'");
            await connection.execute("UPDATE operations SET status='failed' WHERE id='op-02'");
            unchanged = await databaseDigest(connection);
            assert.equal((await get<Page>('nodes/candidates?nodeId=node-37')).total, 0);
            assert.equal((await get<Page>('nodes/candidates?nodeId=node-36')).total, 0);
            const updated = await get<Overview>('overview');
            assert.deepEqual([updated.activeOperations, updated.failedOperations], [1, 3]);
            assert.equal(await databaseDigest(connection), unchanged);
            await connection.execute("UPDATE scope_members SET can_manage=FALSE WHERE actor_id='manager' AND scope_id='scope-a'");
            unchanged = await databaseDigest(connection);
            await get('nodes/candidates', 'manager', 403); await get('overview');
            assert.equal(await databaseDigest(connection), unchanged);
            await connection.execute("UPDATE scope_members SET active=FALSE WHERE actor_id='manager' AND scope_id='scope-a'");
            unchanged = await databaseDigest(connection);
            await get('overview', 'manager', 404); await get('nodes/candidates', 'manager', 404);
            assert.equal(await databaseDigest(connection), unchanged);
        } finally {
            await reader?.close(); await connection?.end(); await writer.close();
            try { if (userCreated) await admin.query("DROP USER ?@'%'", [user]); }
            finally { try { if (created) await admin.query(`DROP DATABASE \`${name}\``); } finally { await admin.end(); } }
        }
    });
