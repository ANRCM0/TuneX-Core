import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runControlBootstrap, CONTROL_BOOTSTRAP_COMMAND_INTERFACE_VERSION } from '../src/modules/control-bootstrap-command-owner/public.ts';
import type { ControlBootstrapCommandEffects, ControlBootstrapDatabase } from '../src/modules/control-bootstrap-command-owner/public.ts';
import { nativeControlBootstrapEffects, CONTROL_BOOTSTRAP_NATIVE_INTERFACE_VERSION } from '../src/compatibility/native-control-bootstrap-command.ts';
import type { NativeControlBootstrapDatabase } from '../src/compatibility/public.ts';
import { Identity, tokenHash } from '../src/modules/identity.ts';
import type { MySqlUnitOfWork, Transaction } from '../src/infrastructure/mysql.ts';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const nativeType: Equal<NativeControlBootstrapDatabase, MySqlUnitOfWork> = true;

test('bootstrap retains exact public/native surfaces and original argv/env lookup defaults', t => {
  assert.equal(nativeType, true); assert.equal(CONTROL_BOOTSTRAP_COMMAND_INTERFACE_VERSION, 1);
  assert.equal(CONTROL_BOOTSTRAP_NATIVE_INTERFACE_VERSION, 1); assert.equal(runControlBootstrap.length, 1);
  assert.deepEqual(Object.keys(nativeControlBootstrapEffects), ['arguments', 'env', 'openDatabase', 'log']);
  t.mock.property(process, 'argv', ['node', 'bootstrap.ts', 'scope-a', 'actor-a', 'ignored']);
  assert.deepEqual(nativeControlBootstrapEffects.arguments(), ['scope-a', 'actor-a', 'ignored']);
  const values = nativeControlBootstrapEffects.arguments(); values[0] = 'changed';
  assert.equal(process.argv[2], 'scope-a');
  t.mock.property(process, 'env', { DATABASE_URL: 'original-url', TUNEX_OWNER_TOKEN: 'original-token' });
  assert.equal(nativeControlBootstrapEffects.env('DATABASE_URL'), 'original-url');
  process.env.DATABASE_URL = 'later-url'; assert.equal(nativeControlBootstrapEffects.env('DATABASE_URL'), 'later-url');
  assert.equal(nativeControlBootstrapEffects.env('MISSING'), undefined);
  const logs: unknown[] = []; t.mock.method(console, 'log', (value: unknown) => logs.push(value));
  nativeControlBootstrapEffects.log('original message'); assert.deepEqual(logs, ['original message']);
});

test('bootstrap destructuring ignores extra values and keeps arguments/env/provider receiver and exact refusal order', async () => {
  for (const missing of ['scope', 'actor', 'url', 'token']) {
    const calls: string[] = [];
    const effects: ControlBootstrapCommandEffects<ControlBootstrapDatabase> = {
      arguments() { assert.equal(this, effects); calls.push('arguments'); return [missing === 'scope' ? '' : 'scope', missing === 'actor' ? '' : 'actor', 'unused']; },
      env(name) { assert.equal(this, effects); calls.push(name); return name === 'DATABASE_URL' ? (missing === 'url' ? '' : 'url') : (missing === 'token' ? '' : 'token'); },
      openDatabase() { assert.fail('required refusal must precede opening'); }, bootstrap: async () => assert.fail(), log: () => assert.fail(),
    };
    await assert.rejects(runControlBootstrap(effects), { name: 'Error', message: 'DATABASE_URL, TUNEX_OWNER_TOKEN and scope/actor arguments required' });
    assert.deepEqual(calls, ['arguments', 'DATABASE_URL', 'TUNEX_OWNER_TOKEN']);
  }
  for (const failing of ['arguments', 'DATABASE_URL', 'TUNEX_OWNER_TOKEN', 'open']) {
    const calls: string[] = [], failure = new Error(failing);
    const invoke = (name: string) => { calls.push(name); if (name === failing) throw failure; };
    const pending = runControlBootstrap({ arguments: () => { invoke('arguments'); return ['scope', 'actor']; }, env: name => { invoke(name); return 'value'; },
      openDatabase: () => { invoke('open'); return { migrate: async () => assert.fail(), close: async () => assert.fail() }; }, bootstrap: async () => assert.fail(), log: () => assert.fail() });
    await assert.rejects(pending, error => error === failure);
    assert.deepEqual(calls, ['arguments', 'DATABASE_URL', 'TUNEX_OWNER_TOKEN', 'open'].slice(0, ['arguments', 'DATABASE_URL', 'TUNEX_OWNER_TOKEN', 'open'].indexOf(failing) + 1));
  }
});

test('bootstrap async stage failures retain exact identity while awaited close can supersede each original failure', async () => {
  for (const failing of ['migrate', 'bootstrap', 'log', 'none']) for (const closeFails of [false, true]) {
    const trace: string[] = [], failure = new Error(failing), closeError = new Error('close');
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const db = {
      async migrate() { assert.equal(this, db); trace.push('migrate'); if (failing === 'migrate') throw failure; },
      async close() { assert.equal(this, db); trace.push('close'); await gate; if (closeFails) throw closeError; },
    };
    const effects: ControlBootstrapCommandEffects<typeof db> = {
      arguments: () => ['scope', 'actor', 'unused'], env: () => 'value',
      openDatabase(url) { assert.equal(this, effects); assert.equal(url, 'value'); trace.push('open'); return db; },
      async bootstrap(actual, scope, actor, token) { assert.equal(this, effects); assert.equal(actual, db); assert.deepEqual([scope, actor, token], ['scope', 'actor', 'value']); trace.push('bootstrap'); if (failing === 'bootstrap') throw failure; },
      log(message) { assert.equal(this, effects); trace.push('log'); assert.equal(message, 'Created owner actor in scope scope'); if (failing === 'log') throw failure; },
    };
    let settled = false;
    const outcome = runControlBootstrap(effects).then(() => { settled = true; return undefined; }, error => { settled = true; return error; });
    for (let i = 0; i < 8 && !trace.includes('close'); i++) await Promise.resolve();
    assert.equal(trace.at(-1), 'close'); assert.equal(settled, false);
    release(); assert.equal(await outcome, closeFails ? closeError : failing === 'none' ? undefined : failure);
    assert.deepEqual(trace, failing === 'migrate' ? ['open', 'migrate', 'close'] : failing === 'bootstrap' ? ['open', 'migrate', 'bootstrap', 'close'] : ['open', 'migrate', 'bootstrap', 'log', 'close']);
  }
});

test('original Identity bootstrap validates before transaction and inserts account scope and owner in the same supplied transaction', async () => {
  const token = 'A'.repeat(32), calls: Array<{ sql: string; args: unknown[] }> = [], trace: string[] = [];
  let failAt = -1; const failure = new Error('native write');
  const tx = { async execute(this: unknown, sql: string, args: unknown[]) {
    assert.equal(this, tx); calls.push({ sql, args }); if (calls.length - 1 === failAt) throw failure; return [{ affectedRows: 1 }, []];
  } } as unknown as Transaction;
  const db = { async transaction<T>(action: (tx: Transaction) => Promise<T>) { assert.equal(this, db); trace.push('begin');
    try { const value = await action(tx); trace.push('commit'); return value; } catch (error) { trace.push('rollback'); throw error; }
  } } as unknown as MySqlUnitOfWork;
  const identity = new Identity(db);
  for (const [scope, actor, bearer] of [['', 'actor', token], ['scope', '../actor', token], ['scope', 'actor', 'short']])
    await assert.rejects(identity.bootstrap(scope!, actor!, bearer!), /Bootstrap requires valid IDs and a random bearer token/);
  assert.deepEqual(trace, []); assert.deepEqual(calls, []);
  const expected = [
    { sql: 'INSERT INTO accounts(id,token_hash) VALUES(?,?)', args: ['actor', tokenHash(token)] },
    { sql: 'INSERT INTO scopes(id,owner_id) VALUES(?,?)', args: ['scope', 'actor'] },
    { sql: 'INSERT INTO scope_members(scope_id,actor_id,can_manage) VALUES(?,?,TRUE)', args: ['scope', 'actor'] },
  ];
  for (const index of [-1, 0, 1, 2]) {
    calls.length = 0; trace.length = 0; failAt = index;
    if (index < 0) await identity.bootstrap('scope', 'actor', token);
    else await assert.rejects(identity.bootstrap('scope', 'actor', token), error => error === failure);
    assert.deepEqual(calls, index < 0 ? expected : expected.slice(0, index + 1));
    assert.deepEqual(trace, ['begin', index < 0 ? 'commit' : 'rollback']);
  }
});

test('actual bootstrap entry keeps the native database alias and original Identity construction at callback invocation', async () => {
  const entry = await readFile(new URL('../src/bootstrap.ts', import.meta.url), 'utf8');
  assert.match(entry, /await runControlBootstrap\(\{\.\.\.nativeControlBootstrapEffects,/);
  assert.match(entry, /bootstrap:\(db:NativeControlBootstrapDatabase,scope:string,actor:string,token:string\)=>new Identity\(db\)\.bootstrap\(scope,actor,token\)/);
  const native = await readFile(new URL('../src/compatibility/native-control-bootstrap-command.ts', import.meta.url), 'utf8');
  assert.match(native, /openDatabase:\(url:string\)=>new MySqlUnitOfWork\(url\)/);
  assert.doesNotMatch(entry, /catch|process\.exit|newToken|setTimeout/);
});
