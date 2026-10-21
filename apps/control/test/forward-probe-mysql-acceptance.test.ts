import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import type { Forward } from '@tunex/core';
import { createApp } from '../src/api/app.ts';
import { ControlApplication } from '../src/application/control.ts';
import { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';
import type { AuthorityStore } from '../src/infrastructure/authority.ts';
import type { NodeCertificateAuthority } from '../src/infrastructure/pki.ts';
import { Identity, tokenHash } from '../src/modules/identity.ts';
import { Nodes } from '../src/modules/nodes.ts';
import { compileDirect, compileSnapshot } from '../src/modules/runtime/planner.ts';
import type { RuntimeController } from '../src/modules/runtime/controller.ts';
import type { AuthorizedNodeFacts } from '../src/modules/node-management-ports.ts';
import type { ForwardProbePlan } from '../src/modules/probe-ports.ts';

const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL;
const command = { version: 1, kind: 'tcp-connect', expectedRevision: 1 };
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
    const suffix = randomUUID().replaceAll('-', ''), name = 'tunex_probe_' + suffix;
    const username = 'probe_' + suffix.slice(0, 16), password = randomBytes(24).toString('hex');
    const url = new URL(databaseUrl!); url.pathname = '/' + name;
    const admin = await createConnection(databaseUrl!), writer = new MySqlUnitOfWork(url.toString());
    let created = false, userCreated = false, connection: Connection | undefined, reader: MySqlUnitOfWork | undefined;
    const close = async () => {
        await reader?.close(); await connection?.end(); await writer.close();
        try {
            if (userCreated) await admin.query("DROP USER ?@'%'", [username]);
            if (created) await admin.query(`DROP DATABASE \`${name}\``);
        } finally { await admin.end(); }
    };
    try {
        await admin.query(`CREATE DATABASE \`${name}\``); created = true;
        await writer.migrate(); connection = await createConnection(url.toString());
        const identity = new Identity(writer), tokens: Record<string, string> = {};
        for (const actor of ['owner', 'viewer', 'outsider']) tokens[actor] = randomBytes(32).toString('base64url');
        await identity.bootstrap('scope-a', 'owner', tokens.owner!);
        await identity.bootstrap('scope-b', 'outsider', tokens.outsider!);
        await connection.execute('INSERT INTO accounts(id,token_hash) VALUES(?,?)', ['viewer', tokenHash(tokens.viewer!)]);
        await connection.execute('INSERT INTO scope_members(scope_id,actor_id,can_manage) VALUES(?,?,FALSE)', ['scope-a', 'viewer']);
        const forward: Forward = { id: 'forward-a', scopeId: 'scope-a', revision: 1,
            spec: { enabled: true, protocols: ['tcp'], ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 22001 } },
                target: { host: '127.0.0.1', port: 80 } } };
        const facts: AuthorizedNodeFacts = { nodeId: 'node-a', scopeId: 'scope-a',
            capabilities: ['adp.3', 'native.direct.v1', 'tcp'], allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [22001],
            egressPolicyRevision: 1, allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false };
        await connection.execute(`INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,revoked,facts,resource_source,owner_actor_id,resource_revision)
            VALUES(?,?,?,0,?,FALSE,?,'admin-shared',NULL,1)`, ['node-a', 'scope-a', createHash('sha256').update('node-a').digest('hex'),
            Date.now() + 120000, JSON.stringify(facts)]);
        await connection.execute('INSERT INTO node_grants(node_id,actor_id,allowed_roles,port_limits) VALUES(?,?,?,?)', ['node-a', 'owner', JSON.stringify(['ingress']), JSON.stringify({allowedPorts:[22001],maxBindings:1})]);
        await connection.execute('INSERT INTO forwards(id,scope_id,revision,spec,authorization_actor,owner_actor_id) VALUES(?,?,1,?,?,?)',
            ['forward-a', 'scope-a', JSON.stringify(forward.spec), 'owner', 'owner']);
        await connection.execute('INSERT INTO forwards(id,scope_id,revision,spec,authorization_actor,owner_actor_id) VALUES(?,?,1,?,?,?)',
            ['foreign-forward', 'scope-b', JSON.stringify(forward.spec), 'outsider', 'outsider']);
        await connection.execute('INSERT INTO runtime_nodes(node_id,session_epoch,boot_id,snapshot_generation) VALUES(?,2,?,3)',
            ['node-a', 'boot-a']);
        const snapshot = () => {
            const now = Date.now();
            return compileSnapshot({ nodeId: 'node-a', sessionEpoch: 2, snapshotGeneration: 3,
                issuedAt: new Date(now).toISOString(), validUntil: new Date(now + 60000).toISOString(), tombstones: [],
                assignments: compileDirect(forward, facts, [{ nodeId: 'node-a', forwardId: 'forward-a', protocol: 'tcp',
                    port: 22001, bindingFence: 4, deploymentGeneration: 5 }]) });
        };
        const body = snapshot();
        await connection.execute('INSERT INTO snapshots(node_id,generation,session_epoch,valid_until,body) VALUES(?,3,2,?,?)',
            ['node-a', Date.parse(body.validUntil), JSON.stringify(body)]);
        await admin.query("CREATE USER ?@'%' IDENTIFIED BY ?", [username, password]); userCreated = true;
        await admin.query(`GRANT SELECT ON \`${name}\`.* TO ?@'%'`, [username]);
        const readUrl = new URL(url); readUrl.username = username; readUrl.password = password;
        reader = new MySqlUnitOfWork(readUrl.toString());
        await assert.rejects(reader.pool.query('UPDATE nodes SET revoked=TRUE'));
        const readIdentity = new Identity(reader);
        const control = new ControlApplication(reader, readIdentity, new Nodes(reader, readIdentity, {} as NodeCertificateAuthority));
        const app = createApp(control, {} as RuntimeController, { allow: async () => undefined } as unknown as AuthorityStore);
        const request = async (options: { actor?: string; id?: string; input?: unknown; raw?: string; status?: number } = {}) => {
            const response = await app.request('/api/v1/scopes/scope-a/forwards/' + (options.id ?? 'forward-a') + '/probe-plan', {
                method: 'POST', headers: { Authorization: 'Bearer ' + tokens[options.actor ?? 'owner'], 'Content-Type': 'application/json' },
                body: options.raw ?? JSON.stringify(options.input ?? command),
            });
            const text = await response.text();
            assert.equal(response.status, options.status ?? 200, text);
            assert.equal(response.headers.get('cache-control'), 'no-store');
            assert.ok(Buffer.byteLength(text) <= 4096);
            for (const secret of [password, ...Object.values(tokens)]) assert.ok(!text.includes(secret));
            return JSON.parse(text) as ForwardProbePlan & { code?: string };
        };
        return { connection, request, close, snapshot, app };
    } catch (error) { await close(); throw error; }
}

test('probe preflight production API is SELECT-only, manager-plus-grant authorized and never creates commands or execution work',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            const before = await digest(f.connection), result = await f.request();
            assert.equal(result.executable, false); assert.equal(result.dispatch, 'not-implemented');
            assert.equal(result.independentProbe, false); assert.equal(result.health, 'unknown');
            assert.equal(result.binding.bindingFence, 4); assert.equal(result.binding.deploymentGeneration, 5);
            await f.request({ actor: 'viewer', status: 403 });
            await f.request({ actor: 'outsider', status: 404 });
            await f.request({ id: 'foreign-forward', status: 404 });
            await f.request({ id: 'missing-forward', status: 404 });
            await f.connection.execute("DELETE FROM node_grants WHERE node_id='node-a' AND actor_id='owner'");
            await f.request({ status: 404 });
            await f.connection.execute("INSERT INTO node_grants(node_id,actor_id,allowed_roles,port_limits) VALUES('node-a','owner',?,?)", [JSON.stringify(['ingress']), JSON.stringify({allowedPorts:[22001],maxBindings:1})]);
            await f.request({ input: { ...command, expectedRevision: 2 }, status: 409 });
            await f.request({ input: { ...command, target: '169.254.169.254' }, status: 422 });
            await f.request({ input: { ...command, timeoutMs: 2001 }, status: 422 });
            await f.request({ raw: '{"version":', status: 422 });
            await f.request({ raw: '{"version":1,"version":1}', status: 409 });
            await f.request({ input: { padding: 'x'.repeat(1100) }, status: 413 });
            const anonymous = await f.app.request('/api/v1/scopes/scope-a/forwards/forward-a/probe-plan',
                { method: 'POST', body: JSON.stringify(command) });
            assert.equal(anonymous.status, 401);
            assert.equal(await digest(f.connection), before);
        } finally { await f.close(); }
    });

test('probe preflight rejects current database/body mismatches, revoked nodes and quarantined intents without writes',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        const rejected = async (status = 409) => {
            const before = await digest(f.connection);
            await f.request({ status }); assert.equal(await digest(f.connection), before);
        };
        try {
            await f.connection.execute("UPDATE forwards SET recovery_suspended=TRUE WHERE id='forward-a'");
            await rejected();
            await f.connection.execute("UPDATE forwards SET recovery_suspended=FALSE,deleting=TRUE WHERE id='forward-a'");
            await rejected();
            await f.connection.execute("UPDATE forwards SET deleting=FALSE WHERE id='forward-a'");
            await f.connection.execute("UPDATE nodes SET revoked=TRUE WHERE id='node-a'");
            await rejected(403);
            await f.connection.execute("UPDATE nodes SET revoked=FALSE WHERE id='node-a'");
            await f.connection.execute("UPDATE runtime_nodes SET boot_id=NULL WHERE node_id='node-a'");
            await rejected();
            await f.connection.execute("UPDATE runtime_nodes SET boot_id='boot-a',session_epoch=3 WHERE node_id='node-a'");
            await rejected();
            await f.connection.execute("UPDATE runtime_nodes SET session_epoch=2 WHERE node_id='node-a'");
            await f.connection.execute("UPDATE snapshots SET valid_until=valid_until-1 WHERE node_id='node-a'");
            await rejected();
            const snapshot = f.snapshot(), different = compileSnapshot({ ...snapshot, snapshotGeneration: 4 });
            await f.connection.execute("UPDATE snapshots SET valid_until=?,body=? WHERE node_id='node-a'",
                [Date.parse(different.validUntil), JSON.stringify(different)]);
            await rejected();
            const expired = compileSnapshot({ ...snapshot, issuedAt: new Date(Date.now() - 120000).toISOString(),
                validUntil: new Date(Date.now() - 60001).toISOString() });
            await f.connection.execute("UPDATE snapshots SET valid_until=?,body=? WHERE node_id='node-a'",
                [Date.parse(expired.validUntil), JSON.stringify(expired)]);
            await rejected();
        } finally { await f.close(); }
    });
