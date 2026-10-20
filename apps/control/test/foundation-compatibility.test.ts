import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as framework from '../src/framework/public.ts';
import * as legacyErrors from '../src/application/errors.ts';
import { RequestLifecycle as LegacyLifecycle } from '../src/application/request-lifecycle.ts';
import { DEFAULT_POLICY as rootPolicy } from '@tunex/contracts';
import { DEFAULT_POLICY as sharedPolicy } from '@tunex/contracts/shared';
import { DEFAULT_POLICY as legacyPolicy } from '@tunex/contracts/legacy/adp2';
import { runControlBootstrap } from '../src/modules/control-bootstrap-command-owner/public.ts';

test('legacy and public errors, request lifecycle and native policy retain exact object identity', () => {
  assert.equal(legacyErrors.ControlError, framework.ControlError);
  assert.equal(legacyErrors.invalid, framework.invalid);
  assert.equal(legacyErrors.notFound, framework.notFound);
  assert.equal(LegacyLifecycle, framework.RequestLifecycle);
  assert.equal(rootPolicy, sharedPolicy); assert.equal(rootPolicy, legacyPolicy);
  assert.ok(Object.isFrozen(rootPolicy));
  assert.equal(Object.keys(rootPolicy).length, 13);
});

test('public request lifecycle drains after a rejected application action and preserves its error identity', async () => {
  const requests = new framework.RequestLifecycle();
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  const failure = new framework.ControlError('INVALID_CONFIG', 400, 'application failed');
  const pending = requests.run(async () => { await gate; throw failure; });
  const rejected = assert.rejects(pending, error => error === failure);
  let drained = false;
  const closing = requests.drain().then(() => { drained = true; });
  await Promise.resolve(); assert.equal(drained, false);
  finish(); await rejected; await closing; assert.equal(drained, true);
  await assert.rejects(requests.run(async () => undefined), error => error instanceof framework.ControlError && error.code === 'CONTROL_STOPPING');
});

test('bootstrap reads both environment values before validation and closes only an opened database', async () => {
  for (const failure of ['required', 'open', 'migrate', 'bootstrap', 'log', 'close', 'none']) {
    const calls: unknown[][] = [], error = new Error(failure);
    const db = {
      migrate: async () => { calls.push(['migrate']); if (failure === 'migrate') throw error; },
      close: async () => { calls.push(['close']); if (failure === 'close') throw error; },
    };
    const task = runControlBootstrap({
      arguments: () => ['', 'actor', 'ignored'].map((value, i) => failure === 'required' ? value : i === 0 ? 'scope' : value),
      env: name => { calls.push(['env', name]); return name === 'DATABASE_URL' ? 'mysql://db' : 'secret'; },
      openDatabase: url => { calls.push(['open', url]); if (failure === 'open') throw error; return db; },
      bootstrap: async (database, scope, actor, token) => { assert.equal(database, db); calls.push(['bootstrap', scope, actor, token]); if (failure === 'bootstrap') throw error; },
      log: message => { calls.push(['log', message]); if (failure === 'log') throw error; },
    });
    if (failure === 'none') await task;
    else if (failure === 'required') await assert.rejects(task, /DATABASE_URL, TUNEX_OWNER_TOKEN and scope\/actor arguments required/);
    else await assert.rejects(task, value => value === error);
    assert.deepEqual(calls.slice(0, 2), [['env', 'DATABASE_URL'], ['env', 'TUNEX_OWNER_TOKEN']]);
    assert.equal(calls.filter(call => call[0] === 'close').length, ['required', 'open'].includes(failure) ? 0 : 1);
    if (failure === 'none') assert.deepEqual(calls.slice(2), [['open', 'mysql://db'], ['migrate'], ['bootstrap', 'scope', 'actor', 'secret'], ['log', 'Created owner actor in scope scope'], ['close']]);
    if (failure === 'migrate') assert.deepEqual(calls.slice(2), [['open', 'mysql://db'], ['migrate'], ['close']]);
  }
});

test('bootstrap awaits cleanup and a cleanup failure retains finally error precedence', async () => {
  const failure = new Error('close');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let settled = false;
  const pending = runControlBootstrap({ arguments: () => ['scope', 'actor'], env: () => 'value',
    openDatabase: () => ({ migrate: async () => { throw new Error('migrate'); }, close: async () => { await gate; throw failure; } }),
    bootstrap: async () => assert.fail('failed migration cannot bootstrap'), log: () => assert.fail('failed migration cannot log'),
  });
  const rejected = assert.rejects(pending, error => error === failure).then(() => { settled = true; });
  await Promise.resolve(); assert.equal(settled, false);
  release(); await rejected; assert.equal(settled, true);
});
