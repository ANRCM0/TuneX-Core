import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdir } from 'node:fs/promises';
import type { Pool } from 'mysql2/promise';
import { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';

type Effect = { name: string; args: unknown[] };
function fixture() {
    const effects: Effect[] = [];
    let respond: (name: string, args: unknown[]) => unknown = () => undefined;
    const effect = async (name: string, args: unknown[] = []) => {
        effects.push({ name, args });
        return respond(name, args);
    };
    const connection = {
        query: async (sql: string) => [await effect(sql) ?? []],
        execute: async (sql: string, args: unknown[]) => [await effect(sql, args) ?? { affectedRows: 1 }],
        beginTransaction: async () => { await effect('begin'); },
        commit: async () => { await effect('commit'); },
        rollback: async () => { await effect('rollback'); },
        release: () => { effects.push({ name: 'release', args: [] }); },
    };
    const pool = {
        getConnection: async () => { await effect('acquire'); return connection; },
        execute: async (sql: string, args: unknown[]) => [await effect(sql, args) ?? [{ n: 0 }]],
        end: async () => { await effect('end'); },
    };
    // Exercise the canonical methods with an observable native-provider substitute.
    const db = Object.create(MySqlUnitOfWork.prototype) as MySqlUnitOfWork;
    Object.defineProperty(db, 'pool', { value: pool as unknown as Pool });
    return { db, connection, effects, names: () => effects.map(item => item.name),
        respond: (callback: typeof respond) => { respond = callback; } };
}
const isolation = 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED';

test('UoW preserves transaction identity, guards, result identity and commit/release order', async () => {
    const f = fixture(), result = {};
    f.db.guard = async () => { f.effects.push({ name: 'guard', args: [] }); };
    assert.equal(await f.db.transaction(async tx => {
        assert.equal(tx, f.connection); f.effects.push({ name: 'action', args: [] }); return result;
    }), result);
    assert.deepEqual(f.names(), ['acquire', 'guard', isolation, 'begin', 'action', 'guard', 'commit', 'release']);
});

for (const failed of ['acquire', isolation, 'begin', 'action', 'commit', 'guard-before', 'guard-after']) {
    test(`UoW ${failed} failure preserves unknown error identity and exact cleanup`, async () => {
        const f = fixture(), failure = new Error(failed); let guards = 0;
        f.respond(name => { if (name === failed) throw failure; });
        f.db.guard = async () => {
            const name = ++guards === 1 ? 'guard-before' : 'guard-after';
            f.effects.push({ name, args: [] }); if (name === failed) throw failure;
        };
        await assert.rejects(f.db.transaction(async () => {
            f.effects.push({ name: 'action', args: [] }); if (failed === 'action') throw failure;
        }), error => error === failure);
        const full = ['acquire', 'guard-before', isolation, 'begin', 'action', 'guard-after', 'commit'];
        assert.deepEqual(f.names(), [...full.slice(0, full.indexOf(failed) + 1), ...(failed === 'acquire' ? [] : ['rollback', 'release'])]);
    });
}

for (const code of ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']) {
    test(`UoW ${code} retries twice using release before reacquire and stops on third failure`, async () => {
        const f = fixture(), failure = Object.assign(new Error(code), { code });
        await assert.rejects(f.db.transaction(async () => { f.effects.push({ name: 'action', args: [] }); throw failure; }), error => error === failure);
        assert.deepEqual(f.names(), Array.from({ length: 3 }, () => ['acquire', isolation, 'begin', 'action', 'rollback', 'release']).flat());
    });
}

test('UoW retry succeeds with only the final action value committed', async () => {
    const f = fixture(), value = {}; let attempts = 0;
    assert.equal(await f.db.transaction(async () => {
        f.effects.push({ name: 'action', args: [] });
        if (++attempts < 3) throw Object.assign(new Error('retry'), { code: 'ER_LOCK_DEADLOCK' });
        return value;
    }), value);
    assert.deepEqual(f.names(), [...Array.from({ length: 2 }, () => ['acquire', isolation, 'begin', 'action', 'rollback', 'release']).flat(), 'acquire', isolation, 'begin', 'action', 'commit', 'release']);
});

test('UoW rollback failure supersedes the original retryable error without retrying and still releases', async () => {
    const f = fixture(), rollback = new Error('rollback');
    f.respond(name => { if (name === 'rollback') throw rollback; });
    await assert.rejects(f.db.transaction(async () => { throw { code: 'ER_LOCK_DEADLOCK' }; }), error => error === rollback);
    assert.deepEqual(f.names(), ['acquire', isolation, 'begin', 'rollback', 'release']);
});

const lockPrefix = 'SELECT GET_LOCK(';
const unlockPrefix = 'SELECT RELEASE_LOCK(';
const mode = 'SELECT @@SESSION.sql_mode AS sql_mode';
const marker = 'INSERT INTO vnext_migrations(name) VALUES(?)';
const lookup = 'SELECT name FROM vnext_migrations WHERE name=?';
function migrationFixture() {
    const f = fixture();
    f.respond((name) => name.startsWith(lockPrefix) ? [{ acquired: 1 }] : name === mode ? [{ sql_mode: '' }] : name === lookup ? [{ name: 'applied' }] : undefined);
    return f;
}

test('migration refuses legacy schema before acquiring a session', async () => {
    const f = fixture(); f.respond(() => [{ n: 1 }]);
    await assert.rejects(f.db.migrate(), /VNext requires a fresh database/);
    assert.equal(f.effects.length, 1); assert.match(f.names()[0]!, /information_schema.tables/);
});

for (const failed of ['legacy-read', 'acquire', 'lock-query']) {
    test(`migration ${failed} fault has no unlock before lock ownership`, async () => {
        const f = fixture(), failure = new Error(failed);
        f.respond(name => {
            if (failed === 'legacy-read' && name.includes('information_schema.tables') ||
                failed === 'acquire' && name === 'acquire' || failed === 'lock-query' && name.startsWith(lockPrefix)) throw failure;
            return undefined;
        });
        await assert.rejects(f.db.migrate(), error => error === failure);
        assert.equal(f.names().some(name => name.startsWith(unlockPrefix)), false);
        assert.equal(f.names().filter(name => name === 'release').length, failed === 'lock-query' ? 1 : 0);
        assert.equal(f.effects.length, failed === 'legacy-read' ? 1 : failed === 'acquire' ? 2 : 4);
    });
}

test('migration unavailable session mode releases lock before session without creating marker table', async () => {
    const f = fixture();
    f.respond(name => name.startsWith(lockPrefix) ? [{ acquired: 1 }] : name === mode ? [{ sql_mode: null }] : undefined);
    await assert.rejects(f.db.migrate(), /Migration SQL mode unavailable/);
    assert.equal(f.names().some(name => name.startsWith('CREATE TABLE')), false);
    assert.match(f.names().at(-2)!, /^SELECT RELEASE_LOCK\(/); assert.equal(f.names().at(-1), 'release');
});

for (const acquired of [0, null, '1']) {
    test(`migration lock refusal (${String(acquired)}) releases without SQL mode, DDL or unlock`, async () => {
        const f = fixture(); f.respond(name => name.startsWith(lockPrefix) ? [{ acquired }] : undefined);
        await assert.rejects(f.db.migrate(), /Migration lock unavailable/);
        assert.equal(f.effects.length, 4);
        assert.equal(f.names()[1], 'acquire'); assert.match(f.names()[2]!, /^SELECT GET_LOCK\(/); assert.equal(f.names()[3], 'release');
    });
}

test('migration inspects sorted SQL names under the acquired lock and skips applied migrations', async () => {
    const f = migrationFixture(); await f.db.migrate();
    const names = (await readdir(new URL('../migrations/', import.meta.url))).filter(name => name.endsWith('.sql')).sort();
    assert.deepEqual(f.effects.filter(item => item.name === lookup).map(item => item.args), names.map(name => [name]));
    assert.equal(f.names()[3], mode);
    assert.match(f.names()[4]!, /^CREATE TABLE IF NOT EXISTS vnext_migrations/);
    assert.equal(f.effects.filter(item => item.name === marker).length, 0);
    assert.match(f.names().at(-2)!, /^SELECT RELEASE_LOCK\(/); assert.equal(f.names().at(-1), 'release');
});

for (const failed of ['mode', 'ddl', 'marker', 'unlock']) {
    test(`migration ${failed} failure preserves identity and releases after lock cleanup`, async () => {
        const f = migrationFixture(), failure = new Error(failed); let statements = 0;
        f.respond((name, args) => {
            if (name.startsWith(lockPrefix)) return [{ acquired: 1 }];
            if (name === mode) { if (failed === 'mode') throw failure; return [{ sql_mode: '' }]; }
            if (name === lookup) return args[0] === '0002-lifecycle.sql' ? [] : [{ name: 'applied' }];
            if (name.startsWith('ALTER TABLE operations')) { if (++statements === 2 && failed === 'ddl') throw failure; }
            if (name === marker && failed === 'marker' || name.startsWith(unlockPrefix) && failed === 'unlock') throw failure;
            if (name.startsWith('SELECT node_id,session_epoch')) return [];
            return undefined;
        });
        await assert.rejects(f.db.migrate(), error => error === failure);
        assert.match(f.names().at(-2)!, /^SELECT RELEASE_LOCK\(/); assert.equal(f.names().at(-1), 'release');
        assert.equal(f.names().includes('rollback'), false);
        if (failed === 'ddl') {
            assert.equal(statements, 2); assert.equal(f.names().includes(marker), false);
            assert.equal(f.names().some(name => name.startsWith('SELECT node_id,session_epoch')), false);
        }
        if (failed === 'mode') assert.equal(f.names().some(name => name.startsWith('CREATE TABLE')), false);
    });
}

test('migration lifecycle backfill retains every lease value and writes marker after leases', async () => {
    const f = migrationFixture();
    const assignments = [
        { forwardId: 'f1', assignmentId: 'a1', deploymentGeneration: 3, bindingFence: 4 },
        { forwardId: 'f2', assignmentId: 'a2', deploymentGeneration: 5, bindingFence: 6 },
    ];
    f.respond((name, args) => {
        if (name.startsWith(lockPrefix)) return [{ acquired: 1 }];
        if (name === mode) return [{ sql_mode: 'NO_BACKSLASH_ESCAPES, ANSI_QUOTES' }];
        if (name === lookup) return args[0] === '0002-lifecycle.sql' ? [] : [{ name: 'applied' }];
        if (name.startsWith('SELECT node_id,session_epoch')) return [{ node_id: 'node', session_epoch: 7, valid_until: 1234, body: JSON.stringify({ assignments }) }];
        return undefined;
    });
    await f.db.migrate();
    const leases = f.effects.filter(item => item.name.startsWith('INSERT INTO execution_leases'));
    assert.deepEqual(leases.map(item => item.args), [['f1', 'node', 'a1', 3, 4, 7, 1234], ['f2', 'node', 'a2', 5, 6, 7, 1234]]);
    assert.match(leases[0]!.name, /ON DUPLICATE KEY UPDATE valid_until=GREATEST\(valid_until,VALUES\(valid_until\)\)/);
    const marked = f.effects.findIndex(item => item.name === marker);
    assert.deepEqual(f.effects[marked]!.args, ['0002-lifecycle.sql']);
    assert.ok(marked > f.effects.indexOf(leases[1]!));
});

test('migration lease backfill failure prevents marker and later migration lookups', async () => {
    const f = migrationFixture(), failure = new Error('lease');
    f.respond((name, args) => {
        if (name.startsWith(lockPrefix)) return [{ acquired: 1 }];
        if (name === mode) return [{ sql_mode: '' }];
        if (name === lookup) return args[0] === '0002-lifecycle.sql' ? [] : [{ name: 'applied' }];
        if (name.startsWith('SELECT node_id,session_epoch')) return [{ node_id: 'node', session_epoch: 1, valid_until: 2,
            body: { assignments: [{ forwardId: 'f', assignmentId: 'a', deploymentGeneration: 3, bindingFence: 4 }] } }];
        if (name.startsWith('INSERT INTO execution_leases')) throw failure;
        return undefined;
    });
    await assert.rejects(f.db.migrate(), error => error === failure);
    assert.equal(f.names().includes(marker), false);
    assert.deepEqual(f.effects.filter(item => item.name === lookup).at(-1)!.args, ['0002-lifecycle.sql']);
    assert.match(f.names().at(-2)!, /^SELECT RELEASE_LOCK\(/); assert.equal(f.names().at(-1), 'release');
});

test('migration unlock failure supersedes earlier failure and connection still releases', async () => {
    const f = migrationFixture(), earlier = new Error('mode'), unlock = new Error('unlock');
    f.respond(name => {
        if (name.startsWith(lockPrefix)) return [{ acquired: 1 }];
        if (name === mode) throw earlier;
        if (name.startsWith(unlockPrefix)) throw unlock;
        return undefined;
    });
    await assert.rejects(f.db.migrate(), error => error === unlock);
    assert.match(f.names().at(-2)!, /^SELECT RELEASE_LOCK\(/); assert.equal(f.names().at(-1), 'release');
});

for (const failure of [undefined, new Error('end')]) {
    test(`close awaits native pool end${failure ? ' and preserves rejection identity' : ''}`, async () => {
        const f = fixture(); let finish!: () => void;
        const pending = new Promise<void>(resolve => { finish = resolve; });
        f.respond(async () => { await pending; if (failure) throw failure; });
        let settled = false;
        const closing = f.db.close().finally(() => { settled = true; });
        await Promise.resolve(); assert.equal(settled, false); assert.deepEqual(f.names(), ['end']);
        finish();
        if (failure) await assert.rejects(closing, error => error === failure); else await closing;
        assert.equal(settled, true); assert.deepEqual(f.names(), ['end']);
    });
}
