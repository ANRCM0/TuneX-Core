import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import { Forwarding } from '../src/modules/forwarding.ts';
import { Idempotency } from '../src/modules/idempotency.ts';
import { ForwardStateService } from '../src/modules/forward-owner/public.ts';
import { ControlError, IdempotencyHost } from '../src/framework/public.ts';
import type { RequestIdentity } from '../src/framework/public.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

type Call = { sql: string; args: unknown[] };
function transaction(results: unknown[], after: (call: Call, index: number) => void = () => {}) {
  const calls: Call[] = [];
  const target = { execute: async function (this: unknown, sql: string, args: unknown[]) {
    assert.equal(this, tx, 'native store must retain the supplied transaction receiver');
    const index = calls.length, call = { sql, args }; calls.push(call);
    assert.ok(index < results.length, 'unexpected extra SQL: ' + sql);
    after(call, index);
    const result = results[index]; if (result instanceof Error) throw result;
    return [result, []];
  } };
  const tx = new Proxy(target, { get(object, property, receiver) {
    if (property !== 'execute') assert.fail('legacy binding must not acquire a pool, transaction or extra native effect: ' + String(property));
    return Reflect.get(object, property, receiver);
  } }) as unknown as Transaction;
  return { tx, calls };
}
const forward = (): Forward => ({ id: 'forward-a', scopeId: 'scope-a', revision: 1,
  spec: { enabled: true, protocols: ['tcp'], ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 32001 } }, target: { host: '127.0.0.1', port: 80 } } });
const request = (): RequestIdentity => ({ scopeId: 'scope-a', actorId: 'actor-a', key: 'original-key', digest: 'digest-a' });
const row = (spec: unknown = JSON.stringify(forward().spec)) => ({ id: 'forward-a', scope_id: 'scope-a', revision: 1, spec, owner_actor_id: 'actor-a', deleting: 0, recovery_suspended: 1 });
const affected = { affectedRows: 1 };

test('zero-argument legacy bindings retain subclass identity and construct without sampling a clock', t => {
  t.mock.method(Date, 'now', () => assert.fail('constructing these stores must not sample a clock'));
  assert.equal(Forwarding.length, 0); assert.equal(Idempotency.length, 0);
  const forwards = new Forwarding(), requests = new Idempotency();
  assert.ok(forwards instanceof ForwardStateService); assert.ok(requests instanceof IdempotencyHost);
  assert.notEqual(Forwarding, ForwardStateService); assert.notEqual(Idempotency, IdempotencyHost);
});

test('legacy Forward reads bind actual native SQL on the supplied transaction and decode only projected values', async () => {
  const owner = new Forwarding();
  const cases = [
    { action: (tx: Transaction) => owner.get(tx, 'scope-a', 'forward-a'), sql: 'SELECT * FROM forwards WHERE id=? AND scope_id=? AND deleting=FALSE', args: ['forward-a','scope-a'], result: { ...forward(), ownerActorId: 'actor-a' } },
    { action: (tx: Transaction) => owner.currentForUpdate(tx, 'scope-a', 'forward-a'), sql: 'SELECT * FROM forwards WHERE id=? AND scope_id=? AND deleting=FALSE FOR UPDATE', args: ['forward-a','scope-a'], result: forward() },
    { action: (tx: Transaction) => owner.record(tx, 'scope-a', 'forward-a'), sql: 'SELECT * FROM forwards WHERE id=? AND scope_id=?', args: ['forward-a','scope-a'], result: { ...forward(), ownerActorId: 'actor-a', deleting: false, recoverySuspended: true } },
    { action: (tx: Transaction) => owner.forNode(tx, 'node-a'), sql: "SELECT * FROM forwards WHERE deleting=FALSE AND recovery_suspended=FALSE AND JSON_UNQUOTE(JSON_EXTRACT(spec,'$.ingress.nodeId'))=? ORDER BY id", args: ['node-a'], result: [forward()] },
    { action: (tx: Transaction) => owner.forReferencedNode(tx, 'node-a'), sql: "SELECT * FROM forwards WHERE deleting=FALSE AND recovery_suspended=FALSE AND (JSON_UNQUOTE(JSON_EXTRACT(spec,'$.ingress.nodeId'))=? OR JSON_CONTAINS(JSON_EXTRACT(spec,'$.path.via'),JSON_QUOTE(?))) ORDER BY id", args: ['node-a','node-a'], result: [forward()] },
    { action: (tx: Transaction) => owner.forProfileActor(tx, 'profile-a', 'actor-a'), sql: "SELECT * FROM forwards WHERE authorization_actor=? AND deleting=FALSE AND recovery_suspended=FALSE AND JSON_UNQUOTE(JSON_EXTRACT(spec,'$.transport.profileId'))=? ORDER BY id", args: ['actor-a','profile-a'], result: [forward()] },
    { action: (tx: Transaction) => owner.forActor(tx, 'scope-a', 'actor-a'), sql: 'SELECT * FROM forwards WHERE scope_id=? AND authorization_actor=? AND deleting=FALSE ORDER BY id', args: ['scope-a','actor-a'], result: [forward()] },
  ];
  for (const current of cases) {
    const f = transaction([[row()]]); assert.deepEqual(await current.action(f.tx), current.result);
    assert.deepEqual(f.calls, [{ sql: current.sql, args: current.args }]);
    const failure = new Error('native read failed'), failed = transaction([failure]);
    await assert.rejects(current.action(failed.tx), error => error === failure); assert.equal(failed.calls.length, 1);
  }
  const stored = forward().spec, f = transaction([[row(stored)]]);
  assert.equal((await owner.get(f.tx, 'scope-a', 'forward-a')).spec, stored, 'native non-string JSON preserves object identity');
  const history = [{ revision: 1, spec: '{ deliberately not decoded' }], revisions = transaction([history]);
  assert.equal(await owner.revisions(revisions.tx, 'forward-a'), history);
  assert.deepEqual(revisions.calls, [{ sql: 'SELECT revision,spec FROM forward_revisions WHERE forward_id=? ORDER BY revision DESC LIMIT 25', args: ['forward-a'] }]);
  for (const action of [owner.get.bind(owner), owner.currentForUpdate.bind(owner), owner.record.bind(owner)]) {
    const missing = transaction([[]]); await assert.rejects(action(missing.tx, 'scope-a', 'missing'), error => error instanceof ControlError && error.code === 'NOT_FOUND');
    const corrupt = transaction([[row('{ invalid')]]); await assert.rejects(action(corrupt.tx, 'scope-a', 'forward-a'), SyntaxError);
  }
});

test('legacy Forward references preserve explicit selector precedence, null authorizers and owner-only quarantine', async () => {
  const owner = new Forwarding();
  for (const records of [[], [{ id: 'forward-a' }]]) {
    const profile = transaction([records]); assert.equal(await owner.hasLiveRelay(profile.tx, 'profile-a', 'node-ignored'), records.length > 0);
    assert.match(profile.calls[0]!.sql, /FOR SHARE$/); assert.deepEqual(profile.calls[0]!.args, ['profile-a']);
    const node = transaction([records]); assert.equal(await owner.hasLiveRelay(node.tx, undefined, 'node-a'), records.length > 0);
    assert.match(node.calls[0]!.sql, /JSON_CONTAINS.*transport.*FOR SHARE$/); assert.deepEqual(node.calls[0]!.args, ['node-a','node-a']);
  }
  const absent = transaction([]); await assert.rejects(owner.hasLiveRelay(absent.tx), /Explicit Relay reference required/); assert.equal(absent.calls.length, 0);
  for (const [records, expected] of [[[], null], [[{ authorization_actor: null }], null], [[{ authorization_actor: 'actor-a' }], 'actor-a']] as const) {
    const f = transaction([records]); assert.equal(await owner.authorizer(f.tx, 'forward-a'), expected);
    assert.deepEqual(f.calls[0]!.args, ['forward-a']);
  }
  const write = transaction([affected, affected]);
  await owner.setAuthorizer(write.tx, 'forward-a', 'actor-b'); await owner.quarantineRecovery(write.tx);
  assert.deepEqual(write.calls, [{ sql: 'UPDATE forwards SET authorization_actor=? WHERE id=?', args: ['actor-b','forward-a'] },
    { sql: 'UPDATE forwards SET recovery_suspended=TRUE', args: [] }]);
  const failure = new Error('owner write failed');
  await assert.rejects(owner.setAuthorizer(transaction([failure]).tx, 'forward-a', 'actor-b'), error => error === failure);
  await assert.rejects(owner.quarantineRecovery(transaction([failure]).tx), error => error === failure);
});

test('legacy Forward writes bind native JSON at each await and preserve CAS and exact failure identities', async () => {
  const owner = new Forwarding();
  for (const operation of ['insert','replace','delete'] as const) {
    const current = forward(), next = { ...forward(), revision: 2 };
    const value = operation === 'replace' ? next : current;
    const f = transaction([affected, affected], (_call, index) => { if (index === 0) (value.spec.target as { port: number }).port = 81; });
    if (operation === 'insert') await owner.insert(f.tx, current, 'actor-a');
    else if (operation === 'replace') await owner.replace(f.tx, current, next);
    else await owner.markDeleting(f.tx, current, 2);
    assert.equal(f.calls.length, 2); assert.match(f.calls[1]!.sql, /^INSERT INTO forward_revisions/);
    assert.equal(JSON.parse(f.calls[1]!.args[2] as string).target.port, 81);
    if (operation === 'insert') {
      assert.deepEqual(f.calls[0]!.args, ['forward-a','scope-a',1,JSON.stringify(forward().spec),'actor-a','actor-a']);
      assert.deepEqual(f.calls[1]!.args.slice(0, 2), ['forward-a',1]);
    } else {
      assert.deepEqual(f.calls[0]!.args.slice(-2), ['forward-a',1]);
      assert.deepEqual(f.calls[1]!.args.slice(0, 2), ['forward-a',2]);
    }
    for (const failedIndex of [0, 1]) {
      const failure = new Error('write-' + failedIndex), failed = transaction(failedIndex === 0 ? [failure] : [affected, failure]);
      const action = operation === 'insert' ? owner.insert(failed.tx, current, 'actor-a') : operation === 'replace' ? owner.replace(failed.tx, current, next) : owner.markDeleting(failed.tx, current, 2);
      await assert.rejects(action, error => error === failure); assert.equal(failed.calls.length, failedIndex + 1);
    }
  }
  for (const count of [0, 2]) for (const operation of ['replace','delete']) {
    const f = transaction([{ affectedRows: count }]);
    await assert.rejects(operation === 'replace' ? owner.replace(f.tx, forward(), { ...forward(), revision: 2 }) : owner.markDeleting(f.tx, forward(), 2),
      error => error instanceof ControlError && error.code === 'REVISION_CONFLICT');
    assert.equal(f.calls.length, 1);
  }
  const cyclic = forward(); (cyclic.spec.target as unknown as { self: unknown }).self = cyclic.spec;
  const noSql = transaction([]); await assert.rejects(owner.insert(noSql.tx, cyclic, 'actor-a'), TypeError);
  assert.equal(noSql.calls.length, 0, 'native encoding failure must precede the current-row write');
});

test('legacy Idempotency zero-argument binding keeps native ensure-lock JSON replay and refusal priority', async () => {
  const owner = new Idempotency();
  for (const mode of ['pending','string','object','invalid-json','conflict','recovery','ensure-failure','lock-failure']) {
    const body = { forwardId: 'forward-a', revision: 2, operationId: null };
    const record = { request_digest: mode === 'conflict' || mode === 'recovery' ? 'different' : 'digest-a', http_status: mode === 'pending' ? null : 202,
      response: mode === 'object' ? body : mode === 'pending' || mode === 'invalid-json' || mode === 'recovery' ? '{ invalid' : JSON.stringify(body), recovery_invalidated: mode === 'recovery' ? 1 : 0 };
    const failure = new Error(mode), f = transaction(mode === 'ensure-failure' ? [failure] : mode === 'lock-failure' ? [affected, failure] : [affected, [record]]);
    const action = owner.claim(f.tx, request());
    if (mode.endsWith('failure')) await assert.rejects(action, error => error === failure);
    else if (mode === 'recovery' || mode === 'conflict') await assert.rejects(action, error => error instanceof ControlError && error.code ===
      (mode === 'recovery' ? 'RECOVERY_REPLAY_REQUIRES_REVIEW' : 'IDEMPOTENCY_CONFLICT'));
    else if (mode === 'invalid-json') await assert.rejects(action, SyntaxError);
    else if (mode === 'pending') assert.equal(await action, undefined);
    else { const replay = await action; assert.deepEqual(replay, { status: 202, body }); if (mode === 'object') assert.equal(replay!.body, body); }
    assert.deepEqual(f.calls[0], { sql: 'INSERT INTO idempotency(scope_id,actor_id,request_key,request_digest) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE request_key=request_key', args: ['scope-a','actor-a','original-key','digest-a'] });
    if (f.calls.length === 2) assert.deepEqual(f.calls[1], { sql: 'SELECT * FROM idempotency WHERE scope_id=? AND actor_id=? AND request_key=? FOR UPDATE', args: ['scope-a','actor-a','original-key'] });
  }
});

test('legacy Idempotency snapshots keys across native SQL awaits but compares the live digest', async () => {
  const identity = request(), f = transaction([affected, [{ request_digest: 'later-digest', http_status: null, response: '{ invalid', recovery_invalidated: 0 }]],
    (_call, index) => { if (index === 0) { identity.scopeId = 'changed'; identity.actorId = 'changed'; identity.key = 'changed'; } else identity.digest = 'later-digest'; });
  assert.equal(await new Idempotency().claim(f.tx, identity), undefined);
  assert.deepEqual(f.calls[0]!.args, ['scope-a','actor-a','original-key','digest-a']);
  assert.deepEqual(f.calls[1]!.args, ['scope-a','actor-a','original-key']);
});

test('legacy Idempotency response serializes before key reads and propagates encode, SQL and quarantine failures', async () => {
  const owner = new Idempotency(), events: string[] = [], identity = {
    get scopeId() { events.push('scope'); return 'scope-a'; }, get actorId() { events.push('actor'); return 'actor-a'; },
    get key() { events.push('key'); return 'original-key'; }, digest: 'digest-a',
  };
  const f = transaction([affected], () => { events.push('sql'); });
  await owner.respond(f.tx, identity, { get status() { events.push('status'); return 202 as const; }, body: { toJSON() { events.push('json'); return { ok: true }; } } });
  assert.deepEqual(events, ['status','json','scope','actor','key','sql']);
  assert.deepEqual(f.calls[0], { sql: 'UPDATE idempotency SET http_status=?,response=? WHERE scope_id=? AND actor_id=? AND request_key=?', args: [202,'{"ok":true}','scope-a','actor-a','original-key'] });
  const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
  const noSql = transaction([]); await assert.rejects(owner.respond(noSql.tx, request(), { status: 202, body: cyclic }), TypeError); assert.equal(noSql.calls.length, 0);
  const failure = new Error('respond'); await assert.rejects(owner.respond(transaction([failure]).tx, request(), { status: 202, body: {} }), error => error === failure);
  const quarantine = transaction([affected]); await owner.quarantineRecovery(quarantine.tx);
  assert.deepEqual(quarantine.calls, [{ sql: 'UPDATE idempotency SET recovery_invalidated=TRUE', args: [] }]);
  await assert.rejects(owner.quarantineRecovery(transaction([failure]).tx), error => error === failure);
});
