import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { MAX_COUNTER } from '@tunex/core';
import { ControlApplication } from '../src/application/control.ts';
import { ProbeInstances } from '../src/application/probe-instances.ts';
import { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { MySqlProbeMachineReader } from '../src/infrastructure/mysql-probe-machine.ts';
import { MySqlProbeInstances } from '../src/infrastructure/mysql-probe-instances.ts';
import { Identity } from '../src/modules/identity.ts';
import { Nodes } from '../src/modules/nodes.ts';
import type { NodeCertificateAuthority } from '../src/infrastructure/pki.ts';
import { upgradeSchemaCatalog } from '../../../scripts/ops/upgrade-inspect.ts';
import { inspectSchema } from '../../../scripts/ops/upgrade.ts';

const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL, fingerprint = 'a'.repeat(64);
const instanceA = '1'.repeat(64), instanceB = '2'.repeat(64), instanceC = '3'.repeat(64);
const initial = { bootId: 'boot-a', instanceId: instanceA, expectedGeneration: 0 };
async function digest(db: Connection, excludeInstances = false) {
    const [tables] = await db.query<RowDataPacket[]>(
        'SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
    const data = [];
    for (const table of tables) {
        assert.match(table.name, /^[a-z0-9_]+$/);
        if (excludeInstances && table.name === 'probe_instances') continue;
        const [records] = await db.query<RowDataPacket[]>(`SELECT * FROM \`${table.name}\``);
        data.push([table.name, records.map(r => JSON.stringify(r)).sort()]);
    }
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
async function fixture() {
    const name = 'tunex_instances_' + randomUUID().replaceAll('-', '');
    const admin = await createConnection(databaseUrl!), url = new URL(databaseUrl!);
    url.pathname = '/' + name;
    const db = new MySqlUnitOfWork(url.toString()), peer = new MySqlUnitOfWork(url.toString());
    let created = false, writer: Connection | undefined;
    const close = async () => {
        try { await writer?.end(); await peer.close(); await db.close(); }
        finally { try { if (created) await admin.query(`DROP DATABASE \`${name}\``); } finally { await admin.end(); } }
    };
    const assemble = (uow: MySqlUnitOfWork) => {
        const identity = new Identity(uow);
        return new ControlApplication(uow, identity, new Nodes(uow, identity, {} as NodeCertificateAuthority));
    };
    try {
        await admin.query(`CREATE DATABASE \`${name}\``); created = true;
        await db.migrate(); writer = await createConnection(url.toString());
        await writer.execute("INSERT INTO accounts(id,token_hash) VALUES('owner',?)", [randomBytes(32).toString('hex')]);
        await writer.execute("INSERT INTO scopes(id,owner_id) VALUES('scope','owner')");
        await writer.execute(`INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts)
            VALUES('node-a','scope',?,0,?,?)`, [randomBytes(32).toString('hex'), Date.now() + 600000,
            JSON.stringify({ capabilities: ['adp.3', 'native.direct.v1', 'tcp'] })]);
        await writer.execute("INSERT INTO runtime_nodes(node_id,boot_id,session_epoch) VALUES('node-a','boot-a',2)");
        await writer.execute("INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until) VALUES(?,'node-a',?,?)",
            [fingerprint, Date.now(), Date.now() + 600000]);
        return { db, peer, writer, close, assemble, host: assemble(db).probeInstances,
            independent: assemble(peer).probeInstances };
    } catch (error) { await close(); throw error; }
}
test('real MySQL serializes absent-slot races, replacement and repeated registration across independent application instances',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            const before = await digest(f.writer, true);
            const inputs = [initial, { ...initial, instanceId: instanceB }];
            const first = await Promise.allSettled([
                f.host.register('node-a', fingerprint, 2, inputs[0]!),
                f.independent.register('node-a', fingerprint, 2, inputs[1]!),
            ]);
            assert.equal(first.filter(r => r.status === 'fulfilled').length, 1);
            const loser = first.find(r => r.status === 'rejected');
            assert.equal(loser?.status === 'rejected' && loser.reason.code, 'PROBE_INSTANCE_CONFLICT');
            const winner = first.find(r => r.status === 'fulfilled');
            assert.ok(winner?.status === 'fulfilled'); assert.equal(winner.value.generation, 1);
            assert.equal(winner.value.executionEnabled, false);
            const winnerInput = inputs.find(i => i.instanceId === winner.value.instanceId)!;
            const persisted = await digest(f.writer);
            assert.deepEqual(await f.assemble(f.peer).probeInstances.register('node-a', fingerprint, 2, winnerInput), winner.value);
            assert.equal(await digest(f.writer), persisted);
            const candidates = ['4'.repeat(64), '5'.repeat(64)];
            const second = await Promise.allSettled(candidates.map((instanceId, i) =>
                (i ? f.independent : f.host).register('node-a', fingerprint, 2, { ...initial, instanceId, expectedGeneration: 1 })));
            assert.equal(second.filter(r => r.status === 'fulfilled').length, 1);
            assert.equal((await f.host.inspect('node-a', fingerprint, 2, 'boot-a')).generation, 2);
            await assert.rejects(f.host.revoke('node-a', fingerprint, 2, { ...winnerInput, expectedGeneration: 1 }),
                { code: 'PROBE_INSTANCE_CONFLICT' });
            const repeated = { ...initial, instanceId: instanceC, expectedGeneration: 2 };
            const third = await Promise.all([f.host.register('node-a', fingerprint, 2, repeated),
                f.independent.register('node-a', fingerprint, 2, repeated)]);
            assert.deepEqual(third[0], third[1]); assert.equal(third[0]!.generation, 3);
            assert.equal(await digest(f.writer, true), before);
        } finally { await f.close(); }
    });
test('real MySQL rolls back first-slot seeds and replacement on downstream or maintenance failure; expired retries cannot renew',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            const store = new MySqlProbeInstances();
            const failure = new ProbeInstances(f.db, new MySqlProbeMachineReader(), {
                read: (tx, node) => store.read(tx, node), lock: (tx, node) => store.lock(tx, node),
                replace: async (tx: Transaction, expected, next) => {
                    await store.replace(tx, expected, next); throw new Error('after owner write');
                },
            });
            const before = await digest(f.writer);
            await assert.rejects(failure.register('node-a', fingerprint, 2, initial), /after owner write/);
            assert.equal(await digest(f.writer), before);
            let guards = 0;
            f.db.guard = async () => { if (++guards === 2) throw new Error('maintenance before commit'); };
            await assert.rejects(f.host.register('node-a', fingerprint, 2, initial), /maintenance before commit/);
            assert.equal(await digest(f.writer), before); f.db.guard = undefined;
            await f.host.register('node-a', fingerprint, 2, initial);
            const accepted = await digest(f.writer);
            await assert.rejects(failure.register('node-a', fingerprint, 2,
                { ...initial, instanceId: instanceB, expectedGeneration: 1 }), /after owner write/);
            assert.equal(await digest(f.writer), accepted);
            const now = Date.now();
            await f.writer.execute("UPDATE probe_instances SET registered_at=?,expires_at=? WHERE node_id='node-a'",
                [now - 31000, now - 1000]);
            const expired = await digest(f.writer);
            await assert.rejects(f.host.register('node-a', fingerprint, 2, initial), { code: 'PROBE_INSTANCE_EXPIRED' });
            assert.equal(await digest(f.writer), expired);
            assert.equal((await f.host.inspect('node-a', fingerprint, 2, 'boot-a')).state, 'stale');
            assert.equal((await f.host.register('node-a', fingerprint, 2,
                { ...initial, instanceId: instanceB, expectedGeneration: 1 })).generation, 2);
        } finally { await f.close(); }
    });
test('real MySQL rechecks credential, session and capabilities before replay, while revocation remains possible after TCP withdrawal',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        const rejected = async (code: string) => {
            const before = await digest(f.writer);
            await assert.rejects(f.host.register('node-a', fingerprint, 2, initial), { code });
            assert.equal(await digest(f.writer), before);
        };
        try {
            await f.host.register('node-a', fingerprint, 2, initial);
            await f.writer.execute("UPDATE nodes SET revoked=TRUE WHERE id='node-a'");
            await rejected('AUTHORIZATION_DENIED');
            await f.writer.execute("UPDATE nodes SET revoked=FALSE WHERE id='node-a'");
            await f.writer.execute('UPDATE node_credentials SET revoked=TRUE WHERE fingerprint=?', [fingerprint]);
            await rejected('AUTHORIZATION_DENIED');
            await f.writer.execute('UPDATE node_credentials SET revoked=FALSE,retire_after=? WHERE fingerprint=?', [Date.now() - 1, fingerprint]);
            await rejected('AUTHORIZATION_DENIED');
            await f.writer.execute('UPDATE node_credentials SET retire_after=NULL WHERE fingerprint=?', [fingerprint]);
            await f.writer.execute("UPDATE runtime_nodes SET boot_id='boot-b',session_epoch=3 WHERE node_id='node-a'");
            await rejected('SESSION_SUPERSEDED');
            assert.equal((await f.host.inspect('node-a', fingerprint, 3, 'boot-b')).state, 'stale');
            await f.writer.execute("UPDATE runtime_nodes SET boot_id='boot-a',session_epoch=2 WHERE node_id='node-a'");
            await f.writer.execute("UPDATE nodes SET facts=JSON_OBJECT('capabilities',JSON_ARRAY('adp.3')) WHERE id='node-a'");
            await rejected('UNSUPPORTED_CAPABILITY');
            const revoked = await f.host.revoke('node-a', fingerprint, 2, { ...initial, expectedGeneration: 1 });
            assert.equal(revoked.state, 'revoked'); assert.equal(revoked.generation, 1);
            assert.deepEqual(await f.host.revoke('node-a', fingerprint, 2, { ...initial, expectedGeneration: 1 }), revoked);
            await f.writer.execute("UPDATE nodes SET facts=? WHERE id='node-a'",
                [JSON.stringify({ capabilities: ['adp.3', 'native.direct.v1', 'tcp'] })]);
            await rejected('PROBE_INSTANCE_CONFLICT');
            const until = Date.now() + 15000;
            await f.writer.execute('UPDATE node_credentials SET retire_after=? WHERE fingerprint=?', [until, fingerprint]);
            const fresh = await f.host.register('node-a', fingerprint, 2, { ...initial, instanceId: instanceB, expectedGeneration: 1 });
            assert.equal(fresh.expiresAt, until);
            const nextFingerprint = 'b'.repeat(64), beforeMissing = await digest(f.writer);
            await assert.rejects(f.host.register('node-a', nextFingerprint, 2, initial), { code: 'AUTHORIZATION_DENIED' });
            assert.equal(await digest(f.writer), beforeMissing);
            await f.writer.execute("INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until) VALUES(?,'node-a',?,?)",
                [nextFingerprint, Date.now(), Date.now() + 120000]);
            assert.equal((await f.host.inspect('node-a', nextFingerprint, 2, 'boot-a')).state, 'stale');
            await assert.rejects(f.host.register('node-a', nextFingerprint, 2,
                { ...initial, instanceId: instanceB, expectedGeneration: 1 }), { code: 'PROBE_INSTANCE_CONFLICT' });
            const rebound = await f.host.register('node-a', nextFingerprint, 2,
                { ...initial, instanceId: instanceC, expectedGeneration: 2 });
            assert.equal(rebound.generation, 3); assert.equal(rebound.fingerprint, nextFingerprint);
            assert.equal((await f.host.inspect('node-a', fingerprint, 2, 'boot-a')).state, 'stale');
        } finally { await f.close(); }
    });
test('real MySQL quarantine preserves the stored generation, rejects resurrection and keeps non-instance state unchanged',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            const first = await f.host.register('node-a', fingerprint, 2, initial);
            const before = await digest(f.writer, true);
            await f.db.transaction(tx => MySqlProbeInstances.quarantineRecovery(tx));
            const current = await f.host.inspect('node-a', fingerprint, 2, 'boot-a');
            assert.equal(current.state, 'quarantined'); assert.equal(current.generation, 1);
            assert.equal(current.instance!.instanceId, first.instanceId);
            await assert.rejects(f.host.register('node-a', fingerprint, 2, initial), { code: 'PROBE_INSTANCE_CONFLICT' });
            const successor = await f.host.register('node-a', fingerprint, 2, { ...initial, instanceId: instanceB, expectedGeneration: 1 });
            assert.equal(successor.generation, 2);
            await f.writer.execute("UPDATE probe_instances SET generation=? WHERE node_id='node-a'", [MAX_COUNTER]);
            await assert.rejects(f.host.register('node-a', fingerprint, 2,
                { ...initial, instanceId: instanceC, expectedGeneration: MAX_COUNTER }), { code: 'COUNTER_EXHAUSTED' });
            assert.equal((await f.host.revoke('node-a', fingerprint, 2,
                { ...initial, instanceId: instanceB, expectedGeneration: MAX_COUNTER })).state, 'revoked');
            await f.db.transaction(tx => MySqlProbeInstances.quarantineRecovery(tx));
            assert.equal((await f.host.inspect('node-a', fingerprint, 2, 'boot-a')).generation, MAX_COUNTER);
            assert.equal(await digest(f.writer, true), before);
            const catalog = await upgradeSchemaCatalog();
            const [columns] = await f.writer.query<RowDataPacket[]>(
                'SELECT TABLE_NAME AS `table`,COLUMN_NAME AS `column`,COLUMN_TYPE AS `type` FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()');
            const [applied] = await f.writer.query<RowDataPacket[]>('SELECT name FROM vnext_migrations ORDER BY name');
            assert.deepEqual(inspectSchema(applied.map(r => r.name), catalog.markers, columns as never), []);
            await f.writer.execute("DELETE FROM vnext_migrations WHERE name='0014-probe-instances.sql'");
            assert.deepEqual(inspectSchema(applied.filter(r => r.name !== '0014-probe-instances.sql').map(r => r.name),
                catalog.markers, columns as never), ['0014-probe-instances.sql']);
        } finally { await f.close(); }
    });
