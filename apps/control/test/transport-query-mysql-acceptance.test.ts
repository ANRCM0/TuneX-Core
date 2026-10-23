import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { digest } from '@tunex/contracts';
import { createApp } from '../src/api/app.ts';
import { NativeDrivers } from '../src/application/native-drivers.ts';
import { TransportQueries } from '../src/application/transport-queries.ts';
import type { ControlApplication } from '../src/application/control.ts';
import { ResourceAccess } from '../src/modules/resource-access-owner/public.ts';
import { MySqlResourceAccessStore } from '../src/infrastructure/mysql-resource-access.ts';
import { MySqlTransportReader } from '../src/infrastructure/mysql-transport-read.ts';
import { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';
import type { AuthorityStore } from '../src/infrastructure/authority.ts';
import { Identity, tokenHash } from '../src/modules/identity.ts';
import { Idempotency } from '../src/modules/idempotency.ts';
import { Transport } from '../src/modules/transport.ts';
import type { RuntimeController } from '../src/modules/runtime/controller.ts';

const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL;
async function databaseDigest(connection: Connection) {
    const [tables] = await connection.query<RowDataPacket[]>('SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
    const inventory = [];
    for (const table of tables) {
        assert.match(table.name, /^[a-z0-9_]+$/);
        const [data] = await connection.query<RowDataPacket[]>(`SELECT * FROM \`${table.name}\``);
        inventory.push([table.name, data.map(value => JSON.stringify(value)).sort()]);
    }
    return createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
}
test('native catalog and Profile references/impact use real prepared MySQL, scoped SELECT-only access and exact target grants',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const suffix = randomUUID().replaceAll('-', ''), name = 'tunex_profile_query_' + suffix, user = 'pq_' + suffix.slice(0, 20), password = randomBytes(24).toString('hex');
        const url = new URL(databaseUrl!); url.pathname = '/' + name;
        const admin = await createConnection(databaseUrl!), writer = new MySqlUnitOfWork(url.toString());
        let created = false, userCreated = false, reader: MySqlUnitOfWork | undefined, connection: Connection | undefined;
        try {
            await admin.query(`CREATE DATABASE \`${name}\``); created = true; await writer.migrate();
            connection = await createConnection(url.toString());
            const tokens = Object.fromEntries(['owner', 'manager', 'viewer', 'outsider'].map(actor => [actor, randomBytes(32).toString('base64url')]));
            const identity = new Identity(writer); await identity.bootstrap('scope-a', 'owner', tokens.owner!); await identity.bootstrap('scope-b', 'outsider', tokens.outsider!);
            for (const actor of ['manager', 'viewer']) {
                await connection.execute('INSERT INTO accounts(id,token_hash) VALUES(?,?)', [actor, tokenHash(tokens[actor]!)]);
                await connection.execute('INSERT INTO scope_members(scope_id,actor_id,can_manage) VALUES(?,?,?)', ['scope-a', actor, actor === 'manager']);
            }
            const config = { driver: 'native.relay.v1', wireVersion: 1, security: 'mutual-tls13', protocols: ['tcp', 'udp'],
                handshakeTimeoutSeconds: 5, idleTimeoutSeconds: 60, maxFrameBytes: 65536, maxUdpDatagramBytes: 16384, maxConnectionsPerNode: 4096 };
            for (const profile of ['profile-a', 'profile-b']) {
                await connection.execute('INSERT INTO transport_profiles(id,scope_id,current_revision) VALUES(?,?,2)', [profile, profile === 'profile-a' ? 'scope-a' : 'scope-b']);
                for (const revision of [1, 2]) await connection.execute('INSERT INTO transport_profile_revisions(profile_id,revision,config,config_digest,created_by,created_at) VALUES(?,?,?,?,?,?)',
                    [profile, revision, JSON.stringify(config), digest(config), 'owner', Date.now()]);
            }
            await connection.execute('INSERT INTO transport_profile_grants(profile_id,actor_id) VALUES(?,?)', ['profile-a', 'manager']);
            for (let i = 0; i < 33; i++) {
                const scope = i === 30 ? 'scope-b' : 'scope-a';
                const spec = { enabled: i !== 0, protocols: ['tcp'], ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 32001 } },
                    target: { host: '127.0.0.1', port: 80 }, path: { via: ['node-b'] }, transport: { profileId: 'profile-a', configRevision: i % 2 + 1 } };
                await connection.execute('INSERT INTO forwards(id,scope_id,owner_actor_id,revision,spec,deleting,recovery_suspended) VALUES(?,?,?,7,?,?,?)',
                    ['forward-' + String(i).padStart(2, '0'), scope, i === 30 ? 'outsider' : i === 31 ? 'viewer' : i === 32 ? null : 'manager', JSON.stringify(spec), i === 29, i === 1]);
            }
            await admin.query("CREATE USER ?@'%' IDENTIFIED BY ?", [user, password]); userCreated = true;
            await admin.query(`GRANT SELECT ON \`${name}\`.* TO ?@'%'`, [user]);
            const readUrl = new URL(url); readUrl.username = user; readUrl.password = password;
            reader = new MySqlUnitOfWork(readUrl.toString());
            const readIdentity = new Identity(reader), transport = new Transport(reader, readIdentity, new Idempotency(), { hasLiveRelay: async () => { throw Error('No mutations allowed'); } });
            const control = { identity: readIdentity, db: reader, nativeDrivers: new NativeDrivers(reader, readIdentity),
                transportQueries: new TransportQueries(reader, readIdentity, new MySqlTransportReader(), transport, new ResourceAccess(readIdentity, new MySqlResourceAccessStore())) } as unknown as ControlApplication;
            const app = createApp(control, {} as RuntimeController, { allow: async () => undefined } as unknown as AuthorityStore);
            async function get(path: string, actor = 'manager', status = 200, scope = 'scope-a') {
                const response = await app.request('/api/v1/scopes/' + scope + '/' + path, { headers: { Authorization: 'Bearer ' + tokens[actor] } });
                const result = await response.json() as any;
                assert.equal(response.status, status, path + ': ' + JSON.stringify(result)); assert.equal(response.headers.get('cache-control'), 'no-store');
                return result;
            }
            const before = await databaseDigest(connection);
            await assert.rejects(reader.pool.query('UPDATE forwards SET deleting=TRUE'));
            const catalog = await get('native-drivers', 'viewer');
            assert.equal(catalog.drivers.length, 3); assert.equal(catalog.authorized, false); assert.equal(catalog.drivers[2].controlEnabled, false);
            const personal = await get('transport-profiles/profile-a/references', 'viewer');
            assert.equal(personal.total, 1); assert.deepEqual(personal.items.map((item: any) => item.forwardId), ['forward-31']);
            assert.equal((await get('transport-profiles/profile-a/references?page=2&limit=1', 'viewer')).items.length, 0);
            const governed = await get('transport-profiles/profile-a/references', 'owner');
            assert.equal(governed.total, 31);
            const references = await get('transport-profiles/profile-a/references', 'manager');
            assert.equal(references.total, 29); assert.equal(references.items.length, 25); assert.equal(references.target, null);
            assert.equal(references.items[0].spec.enabled, false); assert.equal(references.items[1].recoverySuspended, true);
            const second = await get('transport-profiles/profile-a/references?page=2&targetRevision=2');
            assert.equal(second.total, 29); assert.equal(second.items.length, 4);
            assert.ok(second.items.every((item: any) => item.proposedSpec.transport.configRevision === 2 && item.expectedRevision === 7));
            assert.equal(second.fullPlanAuthorization, false); assert.equal(second.reserved, false);
            const filtered = await get('transport-profiles/profile-a/references?revision=1&targetRevision=2&limit=1');
            assert.equal(filtered.total, 15); assert.equal(filtered.items.length, 1); assert.equal(filtered.items[0].configRevision, 1);
            assert.equal((await get('transport-profiles/profile-a/references?page=100')).items.length, 0);
            for (const raw of ['revision=0', 'revision=1&revision=2', 'targetRevision=01', 'page=10001', 'limit=101', 'target=any'])
                await get('transport-profiles/profile-a/references?' + raw, 'manager', 422);
            await get('native-drivers?node=any', 'viewer', 422);
            await get('transport-profiles/profile-a/references?targetRevision=2', 'viewer', 403);
            await get('transport-profiles/profile-a/references?targetRevision=2', 'owner', 404);
            await get('transport-profiles/profile-a/references?targetRevision=3', 'manager', 404);
            await get('transport-profiles/profile-b/references', 'manager', 404);
            await get('transport-profiles/profile-a/references', 'outsider', 404);
            await get('native-drivers', 'outsider', 404);
            assert.equal(await databaseDigest(connection), before, 'Catalog, reference and impact reads changed persisted state');
        } finally {
            await reader?.close(); await connection?.end(); await writer.close();
            if (created) await admin.query(`DROP DATABASE \`${name}\``);
            if (userCreated) await admin.query("DROP USER ?@'%'", [user]);
            await admin.end();
        }
    });
