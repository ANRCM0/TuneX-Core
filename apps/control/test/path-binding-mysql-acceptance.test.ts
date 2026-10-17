import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { digest } from '@tunex/contracts';
import { createApp } from '../src/api/app.ts';
import { ControlApplication } from '../src/application/control.ts';
import { PathBindings } from '../src/application/path-bindings.ts';
import { MySqlPathBindings } from '../src/infrastructure/mysql-path-bindings.ts';
import { MySqlPathTemplates } from '../src/infrastructure/mysql-path-templates.ts';
import { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';
import type { NodeCertificateAuthority } from '../src/infrastructure/pki.ts';
import type { AuthorityStore } from '../src/infrastructure/authority.ts';
import { Identity, tokenHash } from '../src/modules/identity.ts';
import { Nodes } from '../src/modules/nodes.ts';
import { NativePathReferences } from '../src/modules/native-path-references.ts';
import { parsePathTemplate, pathRequirements } from '../src/modules/path-template-contract.ts';
import type { RuntimeController } from '../src/modules/runtime/controller.ts';

const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL;
async function inventory(connection: Connection) {
    const [tables] = await connection.query<RowDataPacket[]>('SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
    const all = [];
    for (const table of tables) {
        assert.match(table.name, /^[a-z0-9_]+$/);
        const [records] = await connection.query<RowDataPacket[]>(`SELECT * FROM \`${table.name}\``);
        all.push([table.name, records.map(record => JSON.stringify(record)).sort()]);
    }
    return createHash('sha256').update(JSON.stringify(all)).digest('hex');
}

test('path binding uses real original owner transactions: immutable expanded provenance, concurrent CAS, rollback, cap, archival and SELECT-only impact/history',
    { skip: !databaseUrl, timeout: 90000 }, async () => {
        const suffix = randomUUID().replaceAll('-', ''), name = 'tunex_bindings_' + suffix;
        const user = 'pb_' + suffix.slice(0, 20), password = randomBytes(24).toString('hex'), now = Date.now();
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
            // No Agent or PKI claim here: disabled intents exercise the original owner/ledger; real active switches use the Actions browser fixture.
            const nodes = new Nodes(db, identity, {} as NodeCertificateAuthority), control = new ControlApplication(db, identity, nodes, undefined, true);
            const app = createApp(control, {} as RuntimeController, { allow: async () => undefined } as unknown as AuthorityStore);
            const config = { version: 1, protocols: ['tcp', 'udp'], nodes: ['ingress', 'middle', 'egress'],
                endpoints: [{ nodeId: 'middle', revision: 1 }, { nodeId: 'egress', revision: 1 }], transport: { profileId: 'profile', configRevision: 1 } };
            for (const id of config.nodes) {
                const facts = { nodeId: id, scopeId: 'scope-a', capabilities: pathRequirements(parsePathTemplate(config)), allowedPorts: [32001],
                    allowedListenerAddresses: ['127.0.0.1'], egressPolicyRevision: 1, allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false };
                await connection.execute('INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts) VALUES(?,?,?,?,?,?)',
                    [id, 'scope-a', createHash('sha256').update(id).digest('hex'), now, now + 3600000, JSON.stringify(facts)]);
                await connection.execute('INSERT INTO runtime_nodes(node_id) VALUES(?)', [id]);
                for (const actor of ['owner', 'manager']) await connection.execute('INSERT INTO node_grants(node_id,actor_id) VALUES(?,?)', [id, actor]);
                if (id !== 'ingress') await connection.execute('INSERT INTO node_relay_endpoints(node_id,revision,config,created_by,updated_at) VALUES(?,1,?,?,?)',
                    [id, JSON.stringify({ listenAddress: '127.0.0.1', advertisedHost: '127.0.0.1', allowedTcpPorts: [32002, 32003] }), 'owner', now]);
            }
            const profile = { driver: 'native.relay.v1', wireVersion: 1, security: 'mutual-tls13', protocols: ['tcp', 'udp'],
                handshakeTimeoutSeconds: 5, idleTimeoutSeconds: 60, maxFrameBytes: 1024, maxUdpDatagramBytes: 1024, maxConnectionsPerNode: 8 };
            await control.transport.publish('owner', 'scope-a', 'profile', 'profile-create', 0, profile);
            await connection.execute('INSERT INTO transport_profile_grants(profile_id,actor_id) VALUES(?,?)', ['profile', 'manager']);
            const first = await control.pathTemplates.publish('manager', 'scope-a', 'saved', 'template-1', 0, config);
            const secondConfig = { ...config, nodes: ['ingress', 'egress'], endpoints: [config.endpoints[1]!] };
            const second = await control.pathTemplates.publish('manager', 'scope-a', 'saved', 'template-2', 1, secondConfig);
            const selections = [first, second].map((value, index) => ({ templateId: 'saved', revision: index + 1, configDigest: value.body.configDigest }));
            const spec = { enabled: false, protocols: ['tcp', 'udp'], ingress: { nodeId: 'ingress', listen: { address: '127.0.0.1', port: 32001 } },
                target: { host: '127.0.0.1', port: 9000 }, path: { via: ['middle', 'egress'] }, transport: config.transport };
            for (const id of ['main', 'race', 'quota']) {
                await connection.execute('INSERT INTO forwards(id,scope_id,revision,spec,authorization_actor) VALUES(?,?,1,?,?)', [id, 'scope-a', JSON.stringify(spec), 'manager']);
                await connection.execute('INSERT INTO forward_revisions(forward_id,revision,spec) VALUES(?,1,?)', [id, JSON.stringify(spec)]);
            }
            async function call(method: string, path: string, input?: unknown, status = 200, actor = 'manager', key: string = randomUUID()) {
                const response = await app.request('/api/v1/scopes/scope-a/' + path, { method,
                    headers: { authorization: 'Bearer ' + tokens[actor], 'content-type': 'application/json', 'idempotency-key': key },
                    ...(input === undefined ? {} : { body: typeof input === 'string' ? input : JSON.stringify(input) }) });
                const body = await response.json() as any; assert.equal(response.status, status, JSON.stringify(body)); return body;
            }
            const input = (revision: number, target: number) => ({ expectedRevision: revision, template: selections[target - 1]! });
            const attached = await call('PUT', 'forwards/main/path-binding', input(1, 1), 200, 'manager', 'attach');
            assert.equal(attached.revision, 1); assert.equal(attached.operationId, null); assert.equal(attached.pathBinding.sequence, 1);
            assert.equal((await call('PUT', 'forwards/main/path-binding', input(1, 1))).pathBinding.changed, false);
            let before = await inventory(connection);
            const preview = await call('POST', 'forwards/main/path-preview', input(1, 2)); assert.deepEqual(preview.proposedSpec.path.via, ['egress']); assert.equal(preview.reserved, false);
            assert.equal(await inventory(connection), before);
            const switched = await call('PUT', 'forwards/main/path-binding', input(1, 2), 202, 'manager', 'switch');
            assert.equal(switched.revision, 2); assert.ok(switched.operationId); assert.equal(switched.pathBinding.sequence, 2);
            const metadata = await call('GET', 'forwards/main/path-binding'); assert.equal(metadata.binding.revision, 2); assert.equal(metadata.history.length, 2);
            assert.deepEqual(metadata.history[0].expandedSpec, spec); assert.deepEqual(metadata.history[1].expandedSpec.path.via, ['egress']);
            assert.equal(metadata.history[1].specDigest, digest(metadata.history[1].expandedSpec));
            await call('PUT', 'forwards/main/path-binding', input(1, 1), 409);
            await call('PUT', 'forwards/main/path-binding?latest=true', input(2, 1), 400);
            await call('PUT', 'forwards/main/path-binding', { ...input(2, 1), extra: true }, 400);
            await call('PUT', 'forwards/main/path-binding', '{"expectedRevision":2,"expectedRevision":3,"template":{}}', 400);
            await call('PUT', 'forwards/main/path-binding', input(2, 1), 403, 'viewer');
            await call('PUT', 'forwards/main/path-binding', input(2, 1), 404, 'outsider');

            await connection.execute('DELETE FROM node_grants WHERE node_id=? AND actor_id=?', ['middle', 'manager']);
            before = await inventory(connection); await call('PUT', 'forwards/main/path-binding', input(2, 1), 404); assert.equal(await inventory(connection), before);
            assert.deepEqual(await call('PUT', 'forwards/main/path-binding', input(1, 2), 202, 'manager', 'switch'), switched);
            await connection.execute('INSERT INTO node_grants(node_id,actor_id) VALUES(?,?)', ['middle', 'manager']);
            await connection.execute('UPDATE node_relay_endpoints SET revision=2 WHERE node_id=?', ['middle']);
            before = await inventory(connection); await call('PUT', 'forwards/main/path-binding', input(2, 1), 409); assert.equal(await inventory(connection), before);
            await connection.execute('UPDATE node_relay_endpoints SET revision=1 WHERE node_id=?', ['middle']);
            await connection.execute('UPDATE forwards SET recovery_suspended=TRUE WHERE id=?', ['main']);
            await call('PUT', 'forwards/main/path-binding', input(2, 1), 409);
            assert.equal((await call('GET', 'path-templates/saved/references?targetRevision=1')).items[0].recoverySuspended, true);
            await connection.execute('UPDATE forwards SET recovery_suspended=FALSE WHERE id=?', ['main']);

            // Failure after original revision/Operation acceptance must roll back both owners and the claimed key.
            const append = control.pathBindings.accept.bind(control.pathBindings);
            control.pathBindings.accept = async () => { throw Error('deliberate binding append failure'); };
            before = await inventory(connection); await call('PUT', 'forwards/main/path-binding', input(2, 1), 500); assert.equal(await inventory(connection), before);
            control.pathBindings.accept = append;
            async function race(target: number) {
                return app.request('/api/v1/scopes/scope-a/forwards/race/path-binding', { method: 'PUT', headers: { authorization: 'Bearer ' + tokens.manager,
                    'content-type': 'application/json', 'idempotency-key': 'race-' + target }, body: JSON.stringify(input(2, target)) });
            }
            // Both contenders replace a different path, so only one can consume the original Forward CAS.
            await control.transport.publish('owner', 'scope-a', 'profile', 'profile-2', 1, { ...profile, idleTimeoutSeconds: 61 });
            await call('PUT', 'forwards/race', { expectedRevision: 1, spec: { ...spec, transport: { profileId: 'profile', configRevision: 2 } } }, 202);
            const raced = await Promise.all([race(1), race(2)]); assert.deepEqual(raced.map(r => r.status).sort(), [202, 409]);
            const raceHistory = await call('GET', 'forwards/race/path-binding'); assert.equal(raceHistory.history.length, 1); assert.equal(raceHistory.revision, 3);

            await call('PUT', 'forwards/quota/path-binding', input(1, 1));
            for (let sequence = 2; sequence <= 64; sequence++) await connection.execute(
                'INSERT INTO forward_path_bindings SELECT forward_id,?,scope_id,template_id,template_revision,config_digest,forward_revision,expanded_spec,spec_digest,actor_id,created_at FROM forward_path_bindings WHERE forward_id=? AND sequence=1', [sequence, 'quota']);
            await connection.execute('UPDATE current_path_bindings SET sequence=64 WHERE forward_id=?', ['quota']);
            before = await inventory(connection); await call('PUT', 'forwards/quota/path-binding', input(1, 2), 429); assert.equal(await inventory(connection), before);
            await call('PUT', 'forwards/quota', { expectedRevision: 1, spec: { ...spec, target: { host: '127.0.0.1', port: 9001 } } }, 202);
            assert.equal((await call('GET', 'forwards/quota/path-binding')).history.length, 64);
            const ordinary = { ...spec, path: { via: ['egress'] } };
            await call('PUT', 'forwards/quota', { expectedRevision: 2, spec: ordinary }, 202);
            assert.equal((await call('GET', 'forwards/quota/path-binding')).binding, null);
            assert.equal((await call('GET', 'forwards/quota/path-binding')).history.length, 64);

            await control.pathTemplates.archive('manager', 'scope-a', 'saved', 'archive', 2);
            await call('PUT', 'forwards/main/path-binding', input(2, 1), 409);
            assert.deepEqual(await call('PUT', 'forwards/main/path-binding', input(1, 2), 202, 'manager', 'switch'), switched);
            assert.equal((await call('GET', 'forwards/main/path-binding')).history.length, 2);
            const report = await call('GET', 'path-templates/saved/references?targetRevision=1');
            assert.equal(report.archived, true); assert.ok(report.items.every((item: any) => item.unavailableReason === 'TEMPLATE_ARCHIVED'));

            await admin.query("CREATE USER ?@'%' IDENTIFIED BY ?", [user, password]); userCreated = true;
            await admin.query(`GRANT SELECT ON \`${name}\`.* TO ?@'%'`, [user]);
            const readUrl = new URL(url); readUrl.username = user; readUrl.password = password; reader = new MySqlUnitOfWork(readUrl.toString());
            await assert.rejects(reader.pool.query('DELETE FROM current_path_bindings'));
            const readIdentity = new Identity(reader), readNodes = new Nodes(reader, readIdentity, {} as NodeCertificateAuthority);
            const readStore = new MySqlPathBindings(), pathStore = new MySqlPathTemplates();
            const readPaths = new PathBindings(reader, readIdentity, pathStore, new NativePathReferences(readNodes, control.transport, control.relayEndpoints), readStore, control.forwarding);
            const readApp = createApp({ identity: readIdentity, pathBindings: readPaths } as unknown as ControlApplication,
                {} as RuntimeController, { allow: async () => undefined } as unknown as AuthorityStore);
            async function read(path: string, status = 200, actor = 'viewer') {
                const response = await readApp.request('/api/v1/scopes/scope-a/' + path, { headers: { authorization: 'Bearer ' + tokens[actor] } });
                const body = await response.json() as any; assert.equal(response.status, status, JSON.stringify(body)); return body;
            }
            before = await inventory(connection);
            assert.equal((await read('forwards/main/path-binding')).history.length, 2);
            const page = await read('path-templates/saved/references?page=1&limit=1'); assert.equal(page.items.length, 1); assert.equal(page.total, 2);
            const next = await read('path-templates/saved/references?page=2&limit=1'); assert.notEqual(page.items[0].forwardId, next.items[0].forwardId);
            await read('path-templates/saved/references?targetRevision=1', 403); await read('path-templates/saved/references?revision=01', 400);
            await read('path-templates/saved/references?limit=1&limit=2', 400); await read('forwards/main/path-binding?revision=1', 400);
            await read('forwards/main/path-binding', 404, 'outsider'); await read('path-templates/Saved/references', 404);
            assert.equal(await inventory(connection), before);
            for (const table of ['port_slots', 'snapshots', 'execution_leases', 'relay_deployments']) {
                const result = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) n FROM ${table}`);
                const counts: RowDataPacket[] = result[0]; assert.equal(counts[0]!.n, 0);
            }
        } finally {
            await reader?.close(); await connection?.end(); await db.close();
            if (userCreated) await admin.query("DROP USER ?@'%'", [user]);
            if (created) await admin.query(`DROP DATABASE \`${name}\``); await admin.end();
        }
    });
