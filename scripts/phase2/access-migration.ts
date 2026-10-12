import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createConnection } from 'mysql2/promise';
import { MySqlUnitOfWork } from '../../apps/control/src/infrastructure/mysql.ts';
import { newToken, tokenHash } from '../../apps/control/src/modules/identity.ts';
/** Upgrade a disposable pre-access VNext database with actual user/system history. */
export async function verifyAccessMigration(databaseUrl: string): Promise<void> {
    const admin = await createConnection(databaseUrl);
    const name = `tunex_access_migration_${randomUUID().replaceAll('-', '')}`;
    await admin.query(`CREATE DATABASE \`${name}\``);
    const url = new URL(databaseUrl);
    url.pathname = `/${name}`;
    const database = new MySqlUnitOfWork(url.toString());
    try {
        await database.pool.query('CREATE TABLE vnext_migrations(name VARCHAR(128) PRIMARY KEY,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        for (const migration of ['0001-phase1.sql', '0002-lifecycle.sql', '0003-node-security.sql']) {
            const text = await readFile(resolve('apps/control/migrations', migration), 'utf8');
            for (const statement of text.split(';').map(value => value.trim()).filter(Boolean))
                await database.pool.query(statement);
            await database.pool.execute('INSERT INTO vnext_migrations(name) VALUES(?)', [migration]);
        }
        const owner = 'migration-owner', member = 'migration-member', scope = 'migration-scope';
        await database.pool.execute('INSERT INTO accounts(id,token_hash) VALUES(?,?),(?,?)', [owner, tokenHash(newToken()), member, tokenHash(newToken())]);
        await database.pool.execute('INSERT INTO scopes(id,owner_id) VALUES(?,?)', [scope, owner]);
        await database.pool.execute('INSERT INTO scope_members(scope_id,actor_id,can_manage) VALUES(?,?,TRUE),(?,?,TRUE)', [scope, owner, scope, member]);
        const spec = { enabled: true, protocols: ['tcp'], ingress: { nodeId: 'migration-node', listen: { address: '127.0.0.1', port: 25565 } }, target: { host: '127.0.0.1', port: 443 } };
        await database.pool.execute('INSERT INTO forwards(id,scope_id,revision,spec) VALUES(?,?,1,?),(?,?,1,?)', ['migration-user', scope, JSON.stringify(spec), 'migration-unknown', scope, JSON.stringify(spec)]);
        const insert = "INSERT INTO operations(id,scope_id,forward_id,target_revision,kind,status,requested_by,idempotency_key,request_digest,created_at,updated_at,execution_deadline) VALUES(?,?,?,1,?,'succeeded',?,?,?,?,?,?)";
        const fixtures = [['migration-create', 'migration-user', 'create', member], ['migration-policy', 'migration-user', 'policy', owner], ['migration-unknown-policy', 'migration-unknown', 'policy', owner]];
        for (const [index, row] of fixtures.entries())
            await database.pool.execute(insert, [row[0], scope, row[1], row[2], row[3], row[0], 'sha256:' + '0'.repeat(64), index + 1, index + 1, Date.now() + 600000]);
        await Promise.all([database.migrate(),database.migrate()]);
        const [records] = await database.pool.query<any[]>('SELECT id,authorization_actor FROM forwards ORDER BY id');
        assert.equal(records.find(row => row.id === 'migration-user').authorization_actor, member);
        assert.equal(records.find(row => row.id === 'migration-unknown').authorization_actor, null);
        await database.migrate();
    }
    finally {
        await database.close();
        await admin.query(`DROP DATABASE \`${name}\``);
        await admin.end();
    }
}
