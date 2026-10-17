import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { digest } from '@tunex/contracts';
import { createApp } from '../src/api/app.ts';
import { ControlApplication } from '../src/application/control.ts';
import { PathTemplateQueries } from '../src/application/path-templates.ts';
import { MySqlPathTemplates } from '../src/infrastructure/mysql-path-templates.ts';
import { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';
import type { NodeCertificateAuthority } from '../src/infrastructure/pki.ts';
import type { AuthorityStore } from '../src/infrastructure/authority.ts';
import { Identity, tokenHash } from '../src/modules/identity.ts';
import { Nodes } from '../src/modules/nodes.ts';
import { pathRequirements, parsePathTemplate } from '../src/modules/path-template-contract.ts';
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
test('path templates use real native reference authorization, transactional CAS/quotas, immutable history, archival and SELECT-only scoped queries',
    { skip: !databaseUrl, timeout: 90000 }, async () => {
        const suffix = randomUUID().replaceAll('-', ''), name = 'tunex_paths_' + suffix;
        const user = 'pt_' + suffix.slice(0, 20), password = randomBytes(24).toString('hex'), now = Date.now();
        const url = new URL(databaseUrl!); url.pathname = '/' + name;
        const admin = await createConnection(databaseUrl!), db = new MySqlUnitOfWork(url.toString());
        let created = false, userCreated = false, connection: Connection | undefined, reader: MySqlUnitOfWork | undefined;
        try {
            await admin.query(`CREATE DATABASE \`${name}\``); created = true; await db.migrate(); connection = await createConnection(url.toString());
            const tokens = Object.fromEntries(['owner', 'manager', 'viewer', 'outsider'].map(actor => [actor, randomBytes(32).toString('base64url')]));
            const identity = new Identity(db); await identity.bootstrap('scope-a', 'owner', tokens.owner!); await identity.bootstrap('scope-b', 'outsider', tokens.outsider!);
            for (const actor of ['manager', 'viewer']) {
                await connection.execute('INSERT INTO accounts(id,token_hash) VALUES(?,?)', [actor, tokenHash(tokens[actor]!)]);
                await connection.execute('INSERT INTO scope_members(scope_id,actor_id,can_manage) VALUES(?,?,?)', ['scope-a', actor, actor === 'manager']);
            }
            // Metadata-only acceptance never invokes PKI or machine execution. Browser acceptance uses actual enrolled Agents separately.
            const nodes = new Nodes(db, identity, {} as NodeCertificateAuthority), control = new ControlApplication(db, identity, nodes);
            const app = createApp(control, {} as RuntimeController, { allow: async () => undefined } as unknown as AuthorityStore);
            const config = { version: 1, protocols: ['tcp', 'udp'], nodes: ['ingress', 'middle', 'egress'],
                endpoints: [{ nodeId: 'middle', revision: 1 }, { nodeId: 'egress', revision: 1 }], transport: { profileId: 'profile', configRevision: 1 } };
            for (const id of config.nodes) {
                const facts = { nodeId: id, scopeId: 'scope-a', capabilities: pathRequirements(parsePathTemplate(config)), allowedPorts: [32001],
                    allowedListenerAddresses: ['127.0.0.1'], egressPolicyRevision: 1, allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false };
                await connection.execute('INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts) VALUES(?,?,?,?,?,?)',
                    [id, 'scope-a', createHash('sha256').update(id).digest('hex'), now, now + 3600000, JSON.stringify(facts)]);
                for (const actor of ['owner', 'manager']) await connection.execute('INSERT INTO node_grants(node_id,actor_id) VALUES(?,?)', [id, actor]);
                if (id !== 'ingress') await connection.execute('INSERT INTO node_relay_endpoints(node_id,revision,config,created_by,updated_at) VALUES(?,1,?,?,?)',
                    [id, JSON.stringify({ listenAddress: '127.0.0.1', advertisedHost: '127.0.0.1', allowedTcpPorts: [32002, 32003] }), 'owner', now]);
            }
            const profile = { driver: 'native.relay.v1', wireVersion: 1, security: 'mutual-tls13', protocols: ['tcp', 'udp'],
                handshakeTimeoutSeconds: 5, idleTimeoutSeconds: 60, maxFrameBytes: 1024, maxUdpDatagramBytes: 1024, maxConnectionsPerNode: 8 };
            await control.transport.publish('owner', 'scope-a', 'profile', 'profile-create', 0, profile);
            await connection.execute('INSERT INTO transport_profile_grants(profile_id,actor_id) VALUES(?,?)', ['profile', 'manager']);
            const spec = { enabled: false, protocols: ['tcp'], ingress: { nodeId: 'ingress', listen: { address: '127.0.0.1', port: 32001 } },
                target: { host: 'private-target.invalid', port: 80 }, path: { via: ['middle', 'egress'] }, transport: config.transport };
            await connection.execute('INSERT INTO forwards(id,scope_id,revision,spec) VALUES(?,?,1,?)', ['unbound-source', 'scope-a', JSON.stringify(spec)]);
            async function call(method: string, path: string, input?: unknown, expected = 200, actor = 'manager', key: string = randomUUID()) {
                const response = await app.request('/api/v1/scopes/scope-a/path-templates' + path, { method,
                    headers: { authorization: 'Bearer ' + tokens[actor], 'content-type': 'application/json', 'idempotency-key': key },
                    ...(input === undefined ? {} : { body: typeof input === 'string' ? input : JSON.stringify(input) }) });
                const body = await response.json() as any; assert.equal(response.status, expected, JSON.stringify(body)); return body;
            }
            const input = { expectedRevision: 0, config }, accepted = await call('PUT', '/saved', input, 202, 'manager', 'create');
            assert.equal(accepted.revision, 1); assert.equal(accepted.configDigest, digest({ config, profileDigest: digest(profile) }));
            assert.deepEqual(await call('PUT', '/saved', input, 202, 'manager', 'create'), accepted);
            await call('PUT', '/saved', input, 409); await call('PUT', '/saved', input, 403, 'viewer');
            await call('PUT', '/saved', { expectedRevision: 1, config: { ...config, protocols: ['tcp'] } }, 409, 'manager', 'create');
            assert.equal((await call('PUT', '/saved', { expectedRevision: 1, config }, 200)).changed, false);
            const two = await call('PUT', '/saved', { expectedRevision: 1, config: { ...config, protocols: ['tcp'] } }, 202);
            assert.equal(two.revision, 2); assert.deepEqual((await call('GET', '/saved?revision=1')).config.protocols, ['tcp', 'udp']);

            await connection.execute('DELETE FROM node_grants WHERE node_id=? AND actor_id=?', ['middle', 'owner']);
            const beforeOwner = await inventory(connection); await call('PUT', '/owner-no-implicit-grant', input, 404, 'owner');
            assert.equal(await inventory(connection), beforeOwner);
            await connection.execute('INSERT INTO node_grants(node_id,actor_id) VALUES(?,?)', ['middle', 'owner']);
            await connection.execute('UPDATE node_relay_endpoints SET revision=2 WHERE node_id=?', ['middle']);
            const beforeStale = await inventory(connection); await call('PUT', '/stale-endpoint', input, 409);
            assert.equal(await inventory(connection), beforeStale);
            await connection.execute('UPDATE node_relay_endpoints SET revision=1 WHERE node_id=?', ['middle']);
            await connection.execute('DELETE FROM transport_profile_grants WHERE profile_id=? AND actor_id=?', ['profile', 'manager']);
            await call('PUT', '/no-profile-grant', input, 404);
            await connection.execute('INSERT INTO transport_profile_grants(profile_id,actor_id) VALUES(?,?)', ['profile', 'manager']);
            const [storedFacts] = await connection.query<RowDataPacket[]>('SELECT facts FROM nodes WHERE id=?', ['middle']);
            const oldFacts = typeof storedFacts[0]!.facts === 'string' ? JSON.parse(storedFacts[0]!.facts) : storedFacts[0]!.facts;
            await connection.execute('UPDATE nodes SET facts=? WHERE id=?', [JSON.stringify({ ...oldFacts, capabilities: ['adp.3', 'tcp', 'udp'] }), 'middle']);
            const beforeCapabilities = await inventory(connection); await call('PUT', '/missing-native-capability', input, 422);
            assert.equal(await inventory(connection), beforeCapabilities);
            await connection.execute('UPDATE nodes SET facts=? WHERE id=?', [JSON.stringify(oldFacts), 'middle']);
            await connection.execute('UPDATE nodes SET revoked=TRUE WHERE id=?', ['middle']);
            const beforeRevoked = await inventory(connection); await call('PUT', '/revoked-node', input, 403);
            assert.equal(await inventory(connection), beforeRevoked);
            await connection.execute('UPDATE nodes SET revoked=FALSE WHERE id=?', ['middle']);
            await call('PUT', '/bad', { ...input, extra: true }, 422);
            await call('PUT', '/bad?latest=1', input, 422);
            await call('PUT', '/bad', '{"expectedRevision":0,"expectedRevision":1,"config":{}}', 409);
            await call('PUT', '/bad', { ...input, config: { ...config, transport: { ...config.transport, latest: true } } }, 422);

            await call('PUT', '/race', input, 202);
            async function race(protocol: string) {
                const result = await app.request('/api/v1/scopes/scope-a/path-templates/race', { method: 'PUT',
                    headers: { authorization: 'Bearer ' + tokens.manager, 'content-type': 'application/json', 'idempotency-key': 'race-' + protocol },
                    body: JSON.stringify({ expectedRevision: 1, config: { ...config, protocols: [protocol] } }) });
                return { status: result.status, body: await result.json() as any };
            }
            const raced = await Promise.all([race('tcp'), race('udp')]); assert.deepEqual(raced.map(r => r.status).sort(), [202, 409]);
            assert.equal((await call('GET', '/race')).revision, 2);
            const archive = await call('DELETE', '/saved', { expectedRevision: 2 }, 202, 'manager', 'archive'); assert.equal(archive.archived, true);
            assert.deepEqual(await call('DELETE', '/saved', { expectedRevision: 2 }, 202, 'manager', 'archive'), archive);
            assert.equal((await call('GET', '/saved?revision=1', undefined, 200, 'viewer')).archived, true);
            await call('PUT', '/saved', { expectedRevision: 2, config }, 409);

            // Fill to 127 metadata identifiers, then exercise the final quota slot with actual concurrent transactions.
            for (let i = 0; i < 125; i++) {
                const id = 'page-' + String(i).padStart(3, '0');
                await connection.execute('INSERT INTO path_templates(scope_id,template_id,current_revision) VALUES(?,?,1)', ['scope-a', id]);
                await connection.execute('INSERT INTO path_template_revisions(scope_id,template_id,revision,config,profile_digest,config_digest,created_by,created_at) SELECT scope_id,?,revision,config,profile_digest,config_digest,created_by,created_at FROM path_template_revisions WHERE scope_id=? AND template_id=? AND revision=1', [id, 'scope-a', 'saved']);
            }
            async function quota(id: string) {
                return app.request('/api/v1/scopes/scope-a/path-templates/' + id, { method: 'PUT',
                    headers: { authorization: 'Bearer ' + tokens.manager, 'content-type': 'application/json', 'idempotency-key': id }, body: JSON.stringify(input) });
            }
            const quotaRace = await Promise.all([quota('quota-a'), quota('quota-b')]); assert.deepEqual(quotaRace.map(r => r.status).sort(), [202, 429]);
            const [history] = await connection.query<RowDataPacket[]>('SELECT COUNT(*) n FROM path_template_revisions WHERE scope_id=? AND template_id=?', ['scope-a', 'race']);
            assert.equal(history[0]!.n, 2);
            const [unchanged] = await connection.query<RowDataPacket[]>('SELECT spec,revision FROM forwards WHERE id=?', ['unbound-source']);
            assert.equal(unchanged[0]!.revision, 1); assert.deepEqual(typeof unchanged[0]!.spec === 'string' ? JSON.parse(unchanged[0]!.spec) : unchanged[0]!.spec, spec);
            for (const table of ['operations', 'port_slots', 'snapshots', 'execution_leases', 'relay_deployments']) {
                const result = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) n FROM ${table}`);
                const counts: RowDataPacket[] = result[0]; assert.equal(counts[0]!.n, 0);
            }

            await admin.query("CREATE USER ?@'%' IDENTIFIED BY ?", [user, password]); userCreated = true;
            await admin.query(`GRANT SELECT ON \`${name}\`.* TO ?@'%'`, [user]);
            const readUrl = new URL(url); readUrl.username = user; readUrl.password = password; reader = new MySqlUnitOfWork(readUrl.toString());
            await assert.rejects(reader.pool.query('UPDATE path_templates SET archived=TRUE'));
            const readIdentity = new Identity(reader), readApp = createApp({ identity: readIdentity,
                pathTemplateQueries: new PathTemplateQueries(reader, readIdentity, new MySqlPathTemplates()) } as unknown as ControlApplication,
                {} as RuntimeController, { allow: async () => undefined } as unknown as AuthorityStore);
            async function get(path: string, status = 200, actor = 'viewer') {
                const response = await readApp.request('/api/v1/scopes/scope-a/path-templates' + path, { headers: { authorization: 'Bearer ' + tokens[actor] } });
                const data = await response.json() as any; assert.equal(response.status, status, JSON.stringify(data)); return data;
            }
            const beforeRead = await inventory(connection), firstPage = await get('?page=1&limit=25');
            assert.equal(firstPage.total, 128); assert.equal(firstPage.items.length, 25);
            assert.equal((await get('?page=6&limit=25')).items.length, 3);
            const prefix = await get('?prefix=page-00&limit=100'); assert.equal(prefix.total, 10);
            assert.ok(prefix.items.every((item: any) => item.templateId.startsWith('page-00')));
            const old = await get('/saved?revision=1'); assert.equal(old.currentRevision, 2); assert.equal(old.bindingCreated, false); assert.equal(old.executionAuthorized, false);
            await get('/saved?revision=1&revision=2', 422); await get('?limit=25&limit=100', 422); await get('?prefix=%25', 422); await get('?page=01', 422);
            await get('/saved?revision=1', 404, 'outsider'); await get('/saved?revision=999', 404); await get('/Saved', 404);
            assert.equal(await inventory(connection), beforeRead);
        } finally {
            await reader?.close(); await connection?.end(); await db.close();
            if (userCreated) await admin.query("DROP USER ?@'%'", [user]);
            if (created) await admin.query(`DROP DATABASE \`${name}\``); await admin.end();
        }
    });
