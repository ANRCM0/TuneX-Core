import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import type { Forward } from '@tunex/core';
import { ControlApplication } from '../src/application/control.ts';
import { ForwardProbePlans } from '../src/application/forward-probe-plans.ts';
import { ProbePermits } from '../src/application/probe-permits.ts';
import { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';
import { MySqlProbeMachineReader } from '../src/infrastructure/mysql-probe-machine.ts';
import { MySqlProbeInstances } from '../src/infrastructure/mysql-probe-instances.ts';
import { MySqlProbePermits } from '../src/infrastructure/mysql-probe-permits.ts';
import { MySqlProbePermitIntents } from '../src/infrastructure/mysql-probe-permit-intents.ts';
import { MySqlProbeReader } from '../src/infrastructure/mysql-probe-read.ts';
import { Identity } from '../src/modules/identity.ts';
import { Nodes } from '../src/modules/nodes.ts';
import type { NodeCertificateAuthority } from '../src/infrastructure/pki.ts';
import { compileDirect, compileSnapshot } from '../src/modules/runtime/planner.ts';
import type { AuthorizedNodeFacts } from '../src/modules/node-management-ports.ts';

const databaseUrl = process.env.TUNEX_TEST_DATABASE_URL, fingerprint = 'a'.repeat(64), instanceId = 'b'.repeat(64);
const command = { version: 1, kind: 'tcp-connect', expectedRevision: 1, instanceId, instanceGeneration: 1 };
const claim = (permitId: string) => ({ permitId, bootId: 'boot-a', instanceId, instanceGeneration: 1 });
async function digest(db: Connection, excludeOwned = false) {
    const [tables] = await db.query<RowDataPacket[]>(
        'SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
    const inventory = [];
    for (const table of tables) {
        assert.match(table.name, /^[a-z0-9_]+$/);
        if (excludeOwned && ['probe_permits', 'probe_permit_budget', 'probe_permit_withdrawals'].includes(table.name)) continue;
        const [records] = await db.query<RowDataPacket[]>(`SELECT * FROM \`${table.name}\``);
        inventory.push([table.name, records.map(r => JSON.stringify(r)).sort()]);
    }
    return createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
}
async function fixture() {
    const suffix = randomUUID().replaceAll('-', ''), name = 'tunex_permits_' + suffix;
    const username = 'pp_' + suffix.slice(0, 16), password = randomBytes(24).toString('hex');
    const admin = await createConnection(databaseUrl!), url = new URL(databaseUrl!); url.pathname = '/' + name;
    const owner = new MySqlUnitOfWork(url.toString());
    let created = false, userCreated = false, writer: Connection | undefined;
    let db: MySqlUnitOfWork | undefined, peer: MySqlUnitOfWork | undefined;
    const close = async () => {
        await peer?.close(); await db?.close(); await writer?.end(); await owner.close();
        try {
            if (userCreated) await admin.query("DROP USER ?@'%'", [username]);
            if (created) await admin.query(`DROP DATABASE \`${name}\``);
        } finally { await admin.end(); }
    };
    try {
        await admin.query(`CREATE DATABASE \`${name}\``); created = true; await owner.migrate();
        writer = await createConnection(url.toString());
        const identity = new Identity(owner); await identity.bootstrap('scope-a', 'owner', randomBytes(32).toString('base64url'));
        const forward: Forward = { id: 'forward-a', scopeId: 'scope-a', revision: 1,
            spec: { enabled: true, protocols: ['tcp'], ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 22001 } },
                target: { host: '127.0.0.1', port: 80 } } };
        const facts: AuthorizedNodeFacts = { nodeId: 'node-a', scopeId: 'scope-a', capabilities: ['adp.3', 'native.direct.v1', 'tcp'],
            allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [22001], egressPolicyRevision: 1,
            allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false };
        const now = Date.now();
        await writer.execute(`INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,credential_until,facts)
            VALUES('node-a','scope-a',?,0,?,?)`, [randomBytes(32).toString('hex'), now + 120000, JSON.stringify(facts)]);
        await writer.execute("INSERT INTO node_grants(node_id,actor_id) VALUES('node-a','owner')");
        await writer.execute("INSERT INTO forwards(id,scope_id,revision,spec,authorization_actor) VALUES('forward-a','scope-a',1,?,'owner')",
            [JSON.stringify(forward.spec)]);
        await writer.execute("INSERT INTO runtime_nodes(node_id,session_epoch,boot_id,snapshot_generation) VALUES('node-a',2,'boot-a',3)");
        const snapshot = compileSnapshot({ nodeId: 'node-a', sessionEpoch: 2, snapshotGeneration: 3,
            issuedAt: new Date(now).toISOString(), validUntil: new Date(now + 60000).toISOString(), tombstones: [],
            assignments: compileDirect(forward, facts, [{ nodeId: 'node-a', forwardId: 'forward-a', protocol: 'tcp',
                port: 22001, bindingFence: 4, deploymentGeneration: 5 }]) });
        await writer.execute("INSERT INTO snapshots(node_id,generation,session_epoch,valid_until,body) VALUES('node-a',3,2,?,?)",
            [now + 60000, JSON.stringify(snapshot)]);
        await writer.execute("INSERT INTO node_credentials(fingerprint,node_id,issued_at,valid_until) VALUES(?,'node-a',?,?)",
            [fingerprint, now, now + 90000]);
        const setup = new ControlApplication(owner, identity, new Nodes(owner, identity, {} as NodeCertificateAuthority));
        await setup.probeInstances.register('node-a', fingerprint, 2, { bootId: 'boot-a', instanceId, expectedGeneration: 0 });
        await admin.query("CREATE USER ?@'%' IDENTIFIED BY ?", [username, password]); userCreated = true;
        await admin.query(`GRANT SELECT ON \`${name}\`.* TO ?@'%'`, [username]);
        await admin.query(`GRANT INSERT,UPDATE,DELETE ON \`${name}\`.probe_permits TO ?@'%'`, [username]);
        await admin.query(`GRANT UPDATE ON \`${name}\`.probe_permit_budget TO ?@'%'`, [username]);
        await admin.query(`GRANT INSERT,DELETE ON \`${name}\`.probe_permit_withdrawals TO ?@'%'`, [username]);
        const limited = new URL(url); limited.username = username; limited.password = password;
        db = new MySqlUnitOfWork(limited.toString()); peer = new MySqlUnitOfWork(limited.toString());
        await assert.rejects(db.pool.query('UPDATE nodes SET revoked=TRUE'));
        await assert.rejects(db.pool.query("UPDATE probe_instances SET state='revoked'"));
        const assemble = (uow: MySqlUnitOfWork) => {
            const identity = new Identity(uow);
            return new ControlApplication(uow, identity, new Nodes(uow, identity, {} as NodeCertificateAuthority));
        };
        const internal = (store: MySqlProbePermits) => {
            const identity = new Identity(db!);
            return new ProbePermits(db!, identity, new ForwardProbePlans(db!, identity, new MySqlProbePermitIntents(),
                new Nodes(db!, identity, {} as NodeCertificateAuthority), new MySqlProbeReader(true), 5000),
            new MySqlProbeMachineReader(), new MySqlProbeInstances(), store);
        };
        const host = assemble(db).probePermits, other = assemble(peer).probePermits;
        return { db, peer, writer, owner, close, host, other, internal,
            issue: () => host.issue('owner', 'scope-a', 'forward-a', command),
            offer: () => host.offer('node-a', fingerprint, 2, { bootId: 'boot-a', instanceId, instanceGeneration: 1 }),
            status: (id: string) => host.check('node-a', fingerprint, 2, claim(id)),
            consume: (id: string) => host.consume('node-a', fingerprint, 2, claim(id)) };
    } catch (error) { await close(); throw error; }
}

test('real MySQL shares issuance/consumption budgets across application instances and writes only permit-owned state',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            const before = await digest(f.writer, true);
            const issuance = await Promise.allSettled([f.issue(), f.other.issue('owner', 'scope-a', 'forward-a', command)]);
            assert.equal(issuance.filter(r => r.status === 'fulfilled').length, 1);
            const winner = issuance.find(r => r.status === 'fulfilled'); assert.ok(winner?.status === 'fulfilled');
            assert.equal(winner.value.executionEnabled, false);
            const result = await Promise.allSettled([f.consume(winner.value.id), f.other.consume('node-a', fingerprint, 2, claim(winner.value.id))]);
            assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
            const [rows] = await f.writer.query<RowDataPacket[]>('SELECT state,closed_at FROM probe_permits');
            assert.equal(rows.length, 1); assert.equal(rows[0]!.state, 'consumed'); assert.ok(rows[0]!.closed_at > 0);
            await assert.rejects(f.consume(winner.value.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
            await assert.rejects(f.issue(), { code: 'PROBE_PERMIT_LIMIT' });
            assert.equal(await digest(f.writer, true), before);
        } finally { await f.close(); }
    });

test('real MySQL rechecks actor grants, topology, credentials, instance and expiry at consumption',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const changes = [
            "DELETE FROM node_grants WHERE node_id='node-a'",
            "UPDATE scope_members SET can_manage=FALSE WHERE actor_id='owner'",
            "UPDATE forwards SET revision=2 WHERE id='forward-a'",
            "UPDATE runtime_nodes SET session_epoch=3 WHERE node_id='node-a'",
            "UPDATE node_credentials SET revoked=TRUE",
            "UPDATE probe_instances SET generation=2",
            "UPDATE probe_instances SET state='quarantined',revoked_at=1",
            "UPDATE probe_permits SET issued_at=issued_at-3000,expires_at=expires_at-3000",
        ];
        for (const sql of changes) {
            const f = await fixture();
            try {
                const permit = await f.issue(); await f.writer.query(sql);
                const before = await digest(f.writer);
                await assert.rejects(f.consume(permit.id));
                assert.equal(await digest(f.writer), before);
                const [rows] = await f.writer.query<RowDataPacket[]>('SELECT state FROM probe_permits');
                assert.equal(rows[0]!.state, 'issued');
            } finally { await f.close(); }
        }
    });

test('real MySQL owner/post-acceptance failures roll back permit insertion, claims and budget clock',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            class FailingInsert extends MySqlProbePermits {
                override async insert(...args: Parameters<MySqlProbePermits['insert']>) { await super.insert(...args); throw new Error('after insert'); }
            }
            const before = await digest(f.writer);
            await assert.rejects(f.internal(new FailingInsert()).issue('owner', 'scope-a', 'forward-a', command));
            assert.equal(await digest(f.writer), before);
            let calls = 0; f.db.guard = async () => { if (++calls === 2) throw new Error('maintenance'); };
            await assert.rejects(f.issue()); f.db.guard = undefined;
            assert.equal(await digest(f.writer), before);
            const permit = await f.issue(), issued = await digest(f.writer);
            calls = 0; f.db.guard = async () => { if (++calls === 2) throw new Error('maintenance'); };
            await assert.rejects(f.consume(permit.id)); f.db.guard = undefined;
            assert.equal(await digest(f.writer), issued);
            assert.equal((await f.consume(permit.id)).state, 'consumed');
        } finally { f.db.guard = undefined; await f.close(); }
    });

test('real MySQL keeps intent and instance read locks through durable claim commit',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture(); let release!: () => void, entered!: () => void;
        const ready = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
        let pending: Promise<unknown> | undefined;
        try {
            class BlockingClose extends MySqlProbePermits {
                override async close(...args: Parameters<MySqlProbePermits['close']>) {
                    await super.close(...args); entered(); await gate;
                }
            }
            const permit = await f.issue();
            pending = f.internal(new BlockingClose()).consume('node-a', fingerprint, 2, claim(permit.id));
            await Promise.race([ready, pending.then(() => { throw new Error('claim finished before lock checkpoint'); })]);
            await f.writer.beginTransaction();
            await assert.rejects(f.writer.query("SELECT id FROM forwards WHERE id='forward-a' FOR UPDATE NOWAIT"));
            await assert.rejects(f.writer.query("SELECT node_id FROM probe_instances WHERE node_id='node-a' FOR UPDATE NOWAIT"));
            await f.writer.rollback(); release(); await pending;
            await f.writer.beginTransaction();
            await f.writer.query("SELECT id FROM forwards WHERE id='forward-a' FOR UPDATE NOWAIT");
            await f.writer.query("SELECT node_id FROM probe_instances WHERE node_id='node-a' FOR UPDATE NOWAIT");
            await f.writer.rollback();
        } finally { release(); await pending?.catch(() => undefined); await f.writer.rollback(); await f.close(); }
    });

test('real MySQL revocation and restored quarantine cannot reopen a permit or refund its budget',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            const permit = await f.issue();
            await f.writer.query("DELETE FROM node_grants WHERE node_id='node-a'");
            const revoked = await f.host.revoke('owner', 'scope-a', permit.id);
            assert.equal(revoked.state, 'revoked');
            assert.deepEqual(await f.host.revoke('owner', 'scope-a', permit.id), revoked);
            await assert.rejects(f.consume(permit.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
            const [clock] = await f.writer.query<RowDataPacket[]>('SELECT observed_at FROM probe_permit_budget');
            await f.owner.transaction(tx => MySqlProbePermits.quarantineRecovery(tx));
            const [closed] = await f.writer.query<RowDataPacket[]>('SELECT state FROM probe_permits');
            assert.equal(closed[0]!.state, 'revoked');
            await f.writer.query("UPDATE probe_permits SET state='issued',closed_at=NULL");
            await f.owner.transaction(tx => MySqlProbePermits.quarantineRecovery(tx));
            const [restored] = await f.writer.query<RowDataPacket[]>('SELECT id,state FROM probe_permits');
            assert.equal(restored[0]!.id, permit.id); assert.equal(restored[0]!.state, 'quarantined');
            const [after] = await f.writer.query<RowDataPacket[]>('SELECT observed_at FROM probe_permit_budget');
            assert.equal(after[0]!.observed_at, clock[0]!.observed_at);
            await assert.rejects(f.consume(permit.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
        } finally { await f.close(); }
    });

test('real MySQL rejects backward budget clocks and oversized/corrupt stored bindings without modifying them',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            const permit = await f.issue();
            await f.writer.query('UPDATE probe_permit_budget SET observed_at=?', [Date.now() + 60000]);
            const future = await digest(f.writer);
            await assert.rejects(f.consume(permit.id), { code: 'CLOCK_UNCERTAIN' }); assert.equal(await digest(f.writer), future);
            await f.writer.query('UPDATE probe_permit_budget SET observed_at=0');
            await f.writer.query('UPDATE probe_permits SET binding=?', [JSON.stringify({ bad: 'x'.repeat(4096) })]);
            const corrupt = await digest(f.writer);
            await assert.rejects(f.consume(permit.id), { code: 'PROBE_PERMIT_CORRUPT' }); assert.equal(await digest(f.writer), corrupt);
        } finally { await f.close(); }
    });

test('real MySQL bounded offers and consumed checks are current read-only projections across independent hosts',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            assert.equal((await f.offer()).offer, null);
            const protectedBefore = await digest(f.writer, true), permit = await f.issue();
            const offered = await f.offer(); assert.equal(offered.offer?.permitId, permit.id);
            assert.equal(offered.executionEnabled, false);
            const before = await digest(f.writer); assert.equal((await f.offer()).offer?.permitId, permit.id);
            assert.equal(await digest(f.writer), before);
            await f.consume(permit.id);
            const status = await f.other.check('node-a', fingerprint, 2, claim(permit.id));
            assert.equal(status.state, 'consumed'); assert.equal(status.executionEnabled, false);
            assert.equal(status.expiresAt, permit.expiresAt); assert.ok(status.checkedAt >= permit.issuedAt);
            assert.equal((await f.offer()).offer, null);
            await f.writer.query("DELETE FROM node_grants WHERE node_id='node-a'");
            const withdrawnGrant = await digest(f.writer);
            await assert.rejects(f.status(permit.id)); assert.equal(await digest(f.writer), withdrawnGrant);
            await f.writer.query("INSERT INTO node_grants(node_id,actor_id) VALUES('node-a','owner')");
            assert.equal(await digest(f.writer, true), protectedBefore);
        } finally { await f.close(); }
    });

test('real MySQL consumed withdrawal is sticky, scoped, atomic and preserves the original one-use fact and budget',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            const permit = await f.issue(), consumed = await f.consume(permit.id);
            class FailingWithdrawal extends MySqlProbePermits {
                override async withdraw(...args: Parameters<MySqlProbePermits['withdraw']>) {
                    await super.withdraw(...args); throw new Error('after withdrawal');
                }
            }
            const before = await digest(f.writer);
            await assert.rejects(f.internal(new FailingWithdrawal()).revoke('owner', 'scope-a', permit.id), /after withdrawal/);
            assert.equal(await digest(f.writer), before);
            let guards = 0; f.db.guard = async () => { if (++guards === 2) throw new Error('maintenance'); };
            await assert.rejects(f.host.revoke('owner', 'scope-a', permit.id)); f.db.guard = undefined;
            assert.equal(await digest(f.writer), before);
            await f.writer.query("DELETE FROM node_grants WHERE node_id='node-a'");
            const revoked = await f.host.revoke('owner', 'scope-a', permit.id);
            assert.equal(revoked.state, 'consumed'); assert.equal(revoked.closedAt, consumed.closedAt);
            assert.ok('withdrawnAt' in revoked && typeof revoked.withdrawnAt === 'number' && revoked.withdrawnAt >= consumed.closedAt!);
            const sticky = await digest(f.writer);
            assert.deepEqual(await f.other.revoke('owner', 'scope-a', permit.id), revoked);
            assert.equal(await digest(f.writer), sticky);
            await f.writer.query("INSERT INTO node_grants(node_id,actor_id) VALUES('node-a','owner')");
            await assert.rejects(f.other.check('node-a', fingerprint, 2, claim(permit.id)), { code: 'PROBE_PERMIT_UNAVAILABLE' });
            await assert.rejects(f.issue(), { code: 'PROBE_PERMIT_LIMIT' });
            const [rows] = await f.writer.query<RowDataPacket[]>('SELECT state,closed_at FROM probe_permits WHERE id=?', [permit.id]);
            assert.equal(rows[0]!.state, 'consumed'); assert.equal(rows[0]!.closed_at, consumed.closedAt);
        } finally { f.db.guard = undefined; await f.close(); }
    });

test('real MySQL recovery withdraws consumed permits without changing consumption, existing flags, or the budget floor',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            const permit = await f.issue(), consumed = await f.consume(permit.id);
            const [clock] = await f.writer.query<RowDataPacket[]>('SELECT observed_at FROM probe_permit_budget');
            const protectedBefore = await digest(f.writer, true);
            await f.owner.transaction(tx => MySqlProbePermits.quarantineRecovery(tx));
            const [rows] = await f.writer.query<RowDataPacket[]>('SELECT state,closed_at FROM probe_permits WHERE id=?', [permit.id]);
            const [flags] = await f.writer.query<RowDataPacket[]>('SELECT withdrawn_at FROM probe_permit_withdrawals WHERE permit_id=?', [permit.id]);
            assert.equal(rows[0]!.state, 'consumed'); assert.equal(rows[0]!.closed_at, consumed.closedAt);
            assert.equal(flags.length, 1); assert.ok(flags[0]!.withdrawn_at >= consumed.closedAt!);
            const first = await digest(f.writer);
            await f.owner.transaction(tx => MySqlProbePermits.quarantineRecovery(tx));
            assert.equal(await digest(f.writer), first);
            const [after] = await f.writer.query<RowDataPacket[]>('SELECT observed_at FROM probe_permit_budget');
            assert.equal(after[0]!.observed_at, clock[0]!.observed_at); assert.equal(await digest(f.writer, true), protectedBefore);
            await assert.rejects(f.status(permit.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
        } finally { await f.close(); }
    });

test('real MySQL 0016 upgrade backfill denies old consumed receipts and cascading cleanup cannot resurrect IDs',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture();
        try {
            const permit = await f.issue(), consumed = await f.consume(permit.id);
            // Recreate the actual 0015 shape, then run the production migrator rather than manually replaying SQL.
            await f.writer.query("DELETE FROM vnext_migrations WHERE name='0016-probe-permit-withdrawals.sql'");
            await f.writer.query('DROP TABLE probe_permit_withdrawals');
            await f.owner.migrate();
            const [flags] = await f.writer.query<RowDataPacket[]>('SELECT permit_id,withdrawn_at FROM probe_permit_withdrawals');
            assert.equal(flags.length, 1); assert.equal(flags[0]!.permit_id, permit.id); assert.equal(flags[0]!.withdrawn_at, consumed.closedAt);
            await assert.rejects(f.status(permit.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
            await f.owner.transaction(tx => new MySqlProbePermits().prune(tx, permit.expiresAt));
            const [empty] = await f.writer.query<RowDataPacket[]>('SELECT permit_id FROM probe_permit_withdrawals');
            assert.equal(empty.length, 0);
            await assert.rejects(f.status(permit.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
            await assert.rejects(f.consume(permit.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
        } finally { await f.close(); }
    });

test('real MySQL consumed status holds original authorization and budget locks through commit before withdrawal can win',
    { skip: !databaseUrl, timeout: 60000 }, async () => {
        const f = await fixture(); let release!: () => void, entered!: () => void, pending: Promise<unknown> | undefined;
        const ready = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
        try {
            const permit = await f.issue(); await f.consume(permit.id); let guards = 0;
            f.db.guard = async () => { if (++guards === 2) { entered(); await gate; } };
            pending = f.status(permit.id);
            await Promise.race([ready, pending.then(() => { throw new Error('check finished before commit checkpoint'); })]);
            await f.writer.beginTransaction();
            for (const sql of ["SELECT id FROM probe_permit_budget WHERE id=1 FOR UPDATE NOWAIT",
                "SELECT id FROM forwards WHERE id='forward-a' FOR UPDATE NOWAIT",
                "SELECT node_id FROM probe_instances WHERE node_id='node-a' FOR UPDATE NOWAIT"])
                await assert.rejects(f.writer.query(sql));
            await f.writer.rollback(); release(); await pending; f.db.guard = undefined;
            await f.other.revoke('owner', 'scope-a', permit.id);
            await assert.rejects(f.status(permit.id), { code: 'PROBE_PERMIT_UNAVAILABLE' });
            await f.writer.beginTransaction();
            await f.writer.query('SELECT id FROM probe_permit_budget WHERE id=1 FOR UPDATE NOWAIT');
            await f.writer.rollback();
        } finally { release(); await pending?.catch(() => undefined); f.db.guard = undefined; await f.writer.rollback(); await f.close(); }
    });
