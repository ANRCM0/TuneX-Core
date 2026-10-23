import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createConnection } from 'mysql2/promise';
import { MySqlUnitOfWork, rows, write } from '../src/infrastructure/mysql.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { MySqlAccountCredentialStore } from '../src/infrastructure/mysql-account-credentials.ts';
import { nativeNodeSecrets } from '../src/infrastructure/identity-secrets.ts';
import { nativeIdentityCodec } from '../src/compatibility/public.ts';
import { Identity } from '../src/modules/identity.ts';
import { IdentityCredentials } from '../src/modules/identity-owner/public.ts';

const databaseURL = process.env.TUNEX_TEST_DATABASE_URL;
const first = 'a'.repeat(64), second = 'b'.repeat(64), third = 'c'.repeat(64), fourth = 'd'.repeat(64), foreign = 'z'.repeat(64);
const bearer = (token: string) => 'Bearer ' + token;
const input = (newToken: string) => ({ credentialVersion: 1, newToken });
const code = (value: string) => (error: unknown) => (error as { code?: string }).code === value;

test('FR0034 native MySQL serializes self rotation, preserves original accounts, and rolls token plus audit back together',
    { skip: !databaseURL }, async () => {
    const admin = await createConnection(databaseURL!), database = 'tunex_credentials_' + randomUUID().replaceAll('-', '');
    const url = new URL(databaseURL!); url.pathname = '/' + database;
    const db = new MySqlUnitOfWork(url.toString()); let created = false;
    try {
        await admin.query(`CREATE DATABASE \`${database}\``); created = true; await db.migrate();
        await db.transaction(async tx => {
            await write(tx, 'INSERT INTO accounts(id,token_hash) VALUES(?,?),(?,?)',
                ['account-a', nativeNodeSecrets.tokenHash(first), 'foreign-account', nativeNodeSecrets.tokenHash(foreign)]);
        });
        const identity = new Identity(db);
        const create = (store = new MySqlAccountCredentialStore()) => new IdentityCredentials({ db, identity, store,
            codec: nativeIdentityCodec, secrets: nativeNodeSecrets, now: () => 1790000000000 });
        const service = create();
        assert.equal((await service.get(bearer(first))).history.retained, 0);
        assert.equal((await service.rotate(bearer(first), input(second))).changed, true);
        assert.equal((await service.rotate(bearer(second), input(second))).changed, false);
        assert.equal((await rows<{ n: number }>(db.pool, 'SELECT COUNT(*) n FROM account_credential_events'))[0]!.n, 1);
        await assert.rejects(service.get(bearer(first)), code('UNAUTHENTICATED'));
        const competing = await Promise.allSettled([service.rotate(bearer(second), input(third)), service.rotate(bearer(second), input(fourth))]);
        assert.equal(competing.filter(result => result.status === 'fulfilled').length, 1);
        const current = competing[0]!.status === 'fulfilled' ? third : fourth;
        const before = await rows(db.pool, 'SELECT * FROM account_credential_events ORDER BY id');
        class FailingAudit extends MySqlAccountCredentialStore {
            override async rotated(tx: Transaction, eventId: string, actorId: string, at: number): Promise<void> {
                await super.rotated(tx, eventId, actorId, at); throw Error('injected post-audit failure');
            }
        }
        await assert.rejects(create(new FailingAudit()).rotate(bearer(current), input('e'.repeat(64))), /injected post-audit failure/);
        assert.deepEqual(await rows(db.pool, 'SELECT * FROM account_credential_events ORDER BY id'), before);
        assert.equal((await service.get(bearer(current))).history.retained, 2);
        await assert.rejects(service.rotate(bearer(current), input(foreign)), code('ACCOUNT_CREDENTIAL_CONFLICT'));
        assert.equal((await service.get(bearer(current))).history.retained, 2);
        assert.equal((await identity.authenticate(bearer(foreign))), 'foreign-account');
        const accountRows = await rows<{ id: string; token_hash: string }>(db.pool, 'SELECT id,token_hash FROM accounts ORDER BY id');
        assert.deepEqual(accountRows.map(record => ({ id: record.id, token_hash: record.token_hash })), [{ id: 'account-a', token_hash: nativeNodeSecrets.tokenHash(current) },
            { id: 'foreign-account', token_hash: nativeNodeSecrets.tokenHash(foreign) }]);
    } finally {
        try { await db.close(); if (created) await admin.query(`DROP DATABASE \`${database}\``); }
        finally { await admin.end(); }
    }
});
