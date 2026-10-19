import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RecoveryWorkflow } from '../src/modules/recovery-owner/public.ts';
import type { BackupDatabaseOptions, RestoreDatabaseOptions, RecoveryAuthority, RecoveryDatabase, RecoveryWorkflowNative } from '../src/modules/recovery-owner/public.ts';
import type { BackupEnvelope, NativeRecoveryAuthorityRecord } from '../src/compatibility/public.ts';

function fixture(failAt = '') {
    const events: string[] = [], tx = Object.freeze({ identity: Symbol('quarantine') }), failure = new Error('provider failure');
    const action = (name: string) => { events.push(name); if (name === failAt) throw failure; };
    const record: NativeRecoveryAuthorityRecord = { version: 1, sequence: 1, database: 'binding', trustDigest: 'old-trust', maintenance: true,
        latestValidUntil: 10000, maxLeaseSeconds: 300, maxClockSkewSeconds: 5, maintenanceSince: 0, recoveryId: null };
    const envelope: BackupEnvelope = { payload: { version: 1, id: 'backup', createdAt: 'time', database: 'source', authorityBinding: 'binding', trustDigest: 'old-trust',
        sqlFile: 'backup.sql', sqlSHA: 'hash', mysqlVersion: 'version', nodeCount: 1, forwardCount: 2, operationCount: 3 }, mac: 'mac' };
    const data = { lease: 10000 as number | null, now: 15000, skew: 0, authorityReads: 0, hash: 'hash', rebound: false, committed: false };
    const db: RecoveryDatabase<typeof tx> = { migrate: async () => { action('migrate'); }, close: async () => { action('close-db'); },
        transaction: async callback => { action('begin'); try { const result = await callback(tx); action('commit'); data.committed = true; return result; }
            catch (error) { action('rollback'); throw error; } } };
    const source = { recoveryId: 'recovery' };
    const authority: RecoveryAuthority = { keyPath: '/protected/key', read: async () => { action(`authority:${++data.authorityReads}`); return { ...record }; },
        signArtifact: async payload => { action('sign'); assert.equal((payload as { sqlSHA: string }).sqlSHA, 'hash'); return 'signature'; },
        verifyArtifact: async (payload, mac) => { action('verify'); assert.equal(payload, envelope.payload); assert.equal(mac, envelope.mac); },
        rebind: async (binding, trust, id) => { action('rebind'); assert.equal(data.committed, true); assert.equal(binding, 'new-binding'); assert.equal(trust, 'new-trust'); assert.equal(id, 'recovery'); data.rebound = true; return record; } };
    const native: RecoveryWorkflowNative<typeof db, typeof source> = {
        resolve: (...parts) => { action(`resolve:${parts.join('/')}`); return parts.join('/'); },
        outsideProtectedDirectory: () => { action('protected'); }, outsideNotificationDirectory: async () => { action('vault'); },
        makeDirectory: async () => { action('mkdir'); }, openDatabase: url => { action(`open:${url}`); return db; },
        backupMetadata: async supplied => { assert.equal(supplied, db); action('metadata'); return [{ name: 'source', binding: 'binding', version: 'version', nodes: 1, forwards: 2, operations: 3 }]; },
        leaseBound: async supplied => { assert.equal(supplied, db); action('leases'); return [{ until: data.lease }]; },
        databaseBinding: async supplied => { assert.equal(supplied, db); action('binding'); return [{ binding: 'new-binding' }]; },
        createEmptyDump: async () => { action('exclusive-file'); }, dump: async () => { action('dump'); }, syncDump: async () => { action('sync'); },
        fileSHA: async () => { action('hash'); return data.hash; }, durableFile: async (path, content) => { action(`durable:${path}`); assert.doesNotThrow(() => JSON.parse(content)); },
        readManifest: async () => { action('manifest'); return envelope; }, newId: () => { action('id'); return 'backup'; }, createdAt: () => { action('created'); return 'time'; },
        pretty: value => { action('pretty'); return JSON.stringify(value); }, validTargetDatabase: () => { action('target-valid'); return true; },
        validTrustDigest: () => { action('trust-valid'); return true; }, trustedTime: async () => { action('trusted-time'); return { now: data.now, maxSkewSeconds: data.skew }; },
        sqlPath: () => { action('sql-path'); return '/backup.sql'; }, beginRestore: async () => { action('source'); return source; },
        createRestoreTarget: async supplied => { action('target'); assert.equal(supplied, source); return 'new-db'; }, restoreDump: async () => { action('restore'); },
        closeRestoreSource: async supplied => { action('close-source'); assert.equal(supplied, source); },
    };
    const backup: BackupDatabaseOptions = { databaseUrl: 'source-db', authority, directory: '/backup', mysqldump: 'dump' };
    const restore: RestoreDatabaseOptions = { sourceDatabaseUrl: 'source-db', targetDatabase: 'new', manifest: '/backup.json', authority,
        newTrustDigest: 'new-trust', mysql: 'mysql', credentialsDirectory: '/credentials', issuersStopped: true, timeChecker: 'clock' };
    const host = new RecoveryWorkflow({ native, quarantine: async (supplied, current, context) => { action('quarantine'); assert.equal(supplied, db); assert.equal(current, tx);
        assert.equal(context.newTrustDigest, 'new-trust'); context.acceptCredentials([{ actorId: 'owner', token: 'rotated', owner: true }]); } });
    return { events, data, record, envelope, native, backup, restore, host, failure };
}

test('backup protects output, rechecks authority after synchronized dump and publishes signed manifest last', async () => {
    const f = fixture(); assert.equal(await f.host.backupDatabase(f.backup), '/backup/backup.json');
    assert.deepEqual(f.events, ['resolve:/backup', 'protected', 'vault', 'mkdir', 'vault', 'open:source-db', 'metadata', 'authority:1', 'id',
        'resolve:/backup/backup.sql', 'exclusive-file', 'dump', 'sync', 'authority:2', 'leases', 'created', 'hash', 'resolve:/backup/backup.json', 'sign', 'pretty', 'durable:/backup/backup.json', 'close-db']);
});

test('backup partial failures close the database and never publish a manifest after failed dump or authority recheck', async () => {
    for (const stage of ['metadata', 'authority:1', 'exclusive-file', 'dump', 'sync', 'authority:2', 'leases', 'hash', 'sign']) {
        const f = fixture(stage); await assert.rejects(f.host.backupDatabase(f.backup), error => error === f.failure);
        assert.equal(f.events.at(-1), 'close-db', stage); assert.equal(f.events.some(event => event.startsWith('durable:')), false, stage);
    }
    const f = fixture(); f.data.lease = 10001;
    await assert.rejects(f.host.backupDatabase(f.backup), /Database authorization exceeds/); assert.equal(f.events.includes('sign'), false);
});

test('restore refuses issuers, SQL tamper and unexhausted authority before creating a fresh target', async () => {
    const f = fixture(); f.restore.issuersStopped = false;
    await assert.rejects(f.host.restoreDatabase(f.restore), /All signing services/); assert.deepEqual(f.events, []);
    for (const mode of ['hash', 'lease'] as const) {
        const current = fixture();
        if (mode === 'hash') current.data.hash = 'tampered'; else current.data.now = 14999;
        await assert.rejects(current.host.restoreDatabase(current.restore), mode === 'hash' ? /integrity failure/ : /RECOVERY_NOT_READY/);
        assert.equal(current.events.includes('source'), false); assert.equal(current.events.includes('mkdir'), false);
    }
});

test('restore commits quarantine before credentials and authority rebind then closes target before source', async () => {
    const f = fixture(), result = await f.host.restoreDatabase(f.restore);
    assert.deepEqual(result, { recoveryId: 'recovery', databaseUrl: 'new-db', ownerCredentials: '/credentials/recovery-credentials.json' });
    assert.deepEqual(f.events.slice(f.events.indexOf('migrate')), ['migrate', 'leases', 'begin', 'quarantine', 'commit', 'binding',
        'resolve:/credentials/recovery-credentials.json', 'pretty', 'durable:/credentials/recovery-credentials.json', 'rebind', 'close-db', 'close-source']);
    assert.equal(f.data.rebound, true);
});

test('restore distinguishes pre-commit rollback from credential/rebind failure after committed quarantine', async () => {
    for (const stage of ['quarantine', 'durable:/credentials/recovery-credentials.json', 'rebind']) {
        const f = fixture(stage); await assert.rejects(f.host.restoreDatabase(f.restore), error => error === f.failure);
        assert.equal(f.data.committed, stage !== 'quarantine', stage); assert.equal(f.events.includes('rollback'), stage === 'quarantine', stage);
        assert.deepEqual(f.events.slice(-2), ['close-db', 'close-source']); assert.equal(f.data.rebound, false);
        if (stage !== 'rebind') assert.equal(f.events.includes('rebind'), false);
    }
});

test('restore preserves partial-target and migrate failures without fabricating rollback or deleting history', async () => {
    for (const stage of ['target', 'restore', 'migrate', 'leases']) {
        const f = fixture(stage); await assert.rejects(f.host.restoreDatabase(f.restore), error => error === f.failure);
        assert.equal(f.events.at(-1), 'close-source'); assert.equal(f.events.includes('rollback'), false);
        assert.equal(f.events.includes('rebind'), false); assert.equal(f.data.committed, false);
        assert.equal(f.events.includes('close-db'), stage === 'migrate' || stage === 'leases');
    }
});
