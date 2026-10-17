import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/api/app.ts';
import { TunnelQueries } from '../src/application/tunnel-queries.ts';
import type { ControlApplication } from '../src/application/control.ts';
import { MySqlTunnelReader } from '../src/infrastructure/mysql-tunnel-read.ts';
import { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';
import type { AuthorityStore } from '../src/infrastructure/authority.ts';
import { Identity, tokenHash } from '../src/modules/identity.ts';
import type { RuntimeController } from '../src/modules/runtime/controller.ts';

const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL;
async function inventory(connection: Connection) {
    const [tables] = await connection.query<RowDataPacket[]>('SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
    const result = [];
    for (const table of tables) {
        assert.match(table.name, /^[a-z0-9_]+$/);
        const [data] = await connection.query<RowDataPacket[]>(`SELECT * FROM \`${table.name}\``);
        result.push([table.name, data.map(value => JSON.stringify(value)).sort()]);
    }
    return createHash('sha256').update(JSON.stringify(result)).digest('hex');
}

test('tunnel API uses real prepared SELECT-only MySQL: bounded windows, scoped exact adjacency, pagination and no persisted mutations',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const suffix = randomUUID().replaceAll('-', ''), name = 'tunex_tunnel_query_' + suffix;
        const user = 'tq_' + suffix.slice(0, 20), password = randomBytes(24).toString('hex'), now = 1800000000000;
        const url = new URL(databaseUrl!); url.pathname = '/' + name;
        const admin = await createConnection(databaseUrl!), writer = new MySqlUnitOfWork(url.toString());
        let created = false, userCreated = false, reader: MySqlUnitOfWork | undefined, connection: Connection | undefined;
        try {
            await admin.query(`CREATE DATABASE \`${name}\``); created = true; await writer.migrate();
            connection = await createConnection(url.toString());
            const tokens = { owner: randomBytes(32).toString('base64url'), viewer: randomBytes(32).toString('base64url'), outsider: randomBytes(32).toString('base64url') };
            const identity = new Identity(writer); await identity.bootstrap('scope-a', 'owner', tokens.owner); await identity.bootstrap('scope-b', 'outsider', tokens.outsider);
            await connection.execute('INSERT INTO accounts(id,token_hash) VALUES(?,?)', ['viewer', tokenHash(tokens.viewer)]);
            await connection.execute('INSERT INTO scope_members(scope_id,actor_id,can_manage) VALUES(?,?,FALSE)', ['scope-a', 'viewer']);
            for (const id of ['node-a', 'node-A', 'node-b', 'node-c', 'foreign']) {
                await connection.execute('INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts) VALUES(?,?,?,?,?,?)',
                    [id, id === 'foreign' ? 'scope-b' : 'scope-a', createHash('sha256').update(id).digest('hex'), now, now + 10000, JSON.stringify({ capabilities: ['adp.3', 'native.relay.v1'] })]);
            }
            await connection.execute('INSERT INTO runtime_nodes(node_id,session_epoch,snapshot_generation,received_at,last_report) VALUES(?,2,3,?,?)', ['node-a', now - 1000, JSON.stringify({ secretMarker: 'raw-report-must-not-escape' })]);
            await connection.execute('INSERT INTO node_relay_endpoints(node_id,revision,config,created_by,updated_at) VALUES(?,2,?,?,?)',
                ['node-a', JSON.stringify({ listenAddress: '127.0.0.1', advertisedHost: '127.0.0.1', allowedTcpPorts: [32002, 32001] }), 'owner', now]);
            for (let i = 0; i < 8; i++) {
                await connection.execute('INSERT INTO node_relay_credentials(fingerprint,node_id,issued_at,valid_until,retire_after,revoked,certificate) VALUES(?,?,?,?,?,?,?)',
                    [String(i).repeat(64), 'node-a', now - 10000 + i, i < 2 ? now + 20000 : i === 2 ? now + 10000 : now - 1,
                        i === 1 ? now + 5000 : i === 3 ? now - 1 : null, i === 2, 'PEM-SECRET-MARKER']);
            }
            for (let i = 0; i < 33; i++) {
                const spec: any = { enabled: i !== 0, protocols: ['tcp', 'udp'], ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 32001 } },
                    target: { host: 'private-target.invalid', port: 80 }, path: { via: ['node-b'] }, transport: { profileId: 'locked-profile', configRevision: 7 } };
                if (i === 1) { spec.ingress.nodeId = 'node-b'; spec.path.via = ['node-a', 'node-c']; }
                if (i === 2) { spec.ingress.nodeId = 'node-b'; spec.path.via = ['node-c', 'node-a']; }
                if (i === 29) spec.ingress.nodeId = 'node-A';
                if (i === 30) { delete spec.path; delete spec.transport; }
                if (i === 32) { spec.ingress.nodeId = 'node-b'; spec.path.via = ['node-A']; }
                await connection.execute('INSERT INTO forwards(id,scope_id,revision,spec,deleting,recovery_suspended) VALUES(?,?,5,?,?,?)',
                    ['forward-' + String(i).padStart(2, '0'), i === 28 ? 'scope-b' : 'scope-a', JSON.stringify(spec), i === 31, i === 1]);
            }
            await admin.query("CREATE USER ?@'%' IDENTIFIED BY ?", [user, password]); userCreated = true;
            await admin.query(`GRANT SELECT ON \`${name}\`.* TO ?@'%'`, [user]);
            const readUrl = new URL(url); readUrl.username = user; readUrl.password = password;
            reader = new MySqlUnitOfWork(readUrl.toString()); const readIdentity = new Identity(reader);
            await assert.rejects(reader.pool.query('UPDATE nodes SET revoked=TRUE'));
            const control = { db: reader, identity: readIdentity, tunnelQueries: new TunnelQueries(reader, readIdentity, new MySqlTunnelReader(), () => now) } as unknown as ControlApplication;
            const app = createApp(control, {} as RuntimeController, { allow: async () => undefined } as unknown as AuthorityStore);
            async function get(path: string, status = 200, actor: keyof typeof tokens = 'viewer') {
                const response = await app.request('/api/v1/scopes/scope-a/nodes/' + path, { headers: { Authorization: 'Bearer ' + tokens[actor] } });
                const result = await response.json() as any; assert.equal(response.status, status, JSON.stringify(result)); return result;
            }
            const before = await inventory(connection);
            const metadata = await get('node-a/tunnel');
            assert.equal(metadata.health, 'unknown'); assert.equal(metadata.executionAuthorized, false); assert.equal(metadata.reserved, false);
            assert.equal(metadata.peerCredentials.total, 8); assert.equal(metadata.peerCredentials.recordedWindowCount, 2);
            assert.equal(metadata.peerCredentials.items.length, 4); assert.equal(metadata.peerCredentials.truncated, true);
            assert.equal(metadata.peerCredentials.items.filter((peer: any) => peer.recordedWindowOpen).length, 2);
            assert.equal(metadata.peerCredentials.items[0].fingerprint, 'sha256:' + '1'.repeat(64));
            assert.equal(metadata.peerCredentials.items[0].effectiveUntil, new Date(now + 5000).toISOString());
            assert.equal(metadata.node.sessionEpoch, 2); assert.equal(metadata.node.snapshotGeneration, 3);
            assert.deepEqual(metadata.endpoint.config.allowedTcpPorts, [32001, 32002]);
            const first = await get('node-a/tunnel/references'); assert.equal(first.total, 28); assert.equal(first.items.length, 25);
            assert.deepEqual(first.items.slice(0, 3).map((row: any) => [row.role, row.previousNodeId, row.nextNodeId]),
                [['ingress', null, 'node-b'], ['transit', 'node-b', 'node-c'], ['egress', 'node-c', null]]);
            assert.equal(first.items[0].enabled, false); assert.equal(first.items[1].recoverySuspended, true);
            const second = await get('node-a/tunnel/references?page=2&limit=25'); assert.equal(second.items.length, 3);
            assert.deepEqual(second.items.map((row: any) => row.forwardId), ['forward-25', 'forward-26', 'forward-27']);
            assert.equal((await get('node-a/tunnel/references?page=10000')).items.length, 0);
            assert.equal((await get('node-c/tunnel')).endpoint, null);
            for (const path of ['node-a/tunnel?issue=1', 'node-a/tunnel?revision=1', ...['page=01', 'page=1&page=2', 'limit=101', 'limit=1%20OR%201=1', 'node=foreign', 'revision=1'].map(query => 'node-a/tunnel/references?' + query)])
                await get(path, 422);
            for (const path of ['foreign/tunnel', 'foreign/tunnel/references', 'missing/tunnel', 'missing/tunnel/references']) await get(path, 404);
            await get('node-a/tunnel', 404, 'outsider'); await get('node-a/tunnel/references', 404, 'outsider');
            assert.doesNotMatch(JSON.stringify([metadata, first, second]), /PEM-SECRET|raw-report-must-not-escape|private-target|enrollment|privateKey/);
            assert.equal(await inventory(connection), before, 'Tunnel reads changed persisted tables');
            await connection.execute('UPDATE nodes SET revoked=TRUE WHERE id=?', ['node-a']);
            const revokedBefore = await inventory(connection), revoked = await get('node-a/tunnel');
            assert.equal(revoked.peerCredentials.recordedWindowCount, 0);
            assert.ok(revoked.peerCredentials.items.every((peer: any) => peer.recordedWindowOpen === false));
            assert.equal(await inventory(connection), revokedBefore);
        } finally {
            await reader?.close(); await connection?.end(); await writer.close();
            if (created) await admin.query(`DROP DATABASE \`${name}\``);
            if (userCreated) await admin.query("DROP USER ?@'%'", [user]);
            await admin.end();
        }
    });
