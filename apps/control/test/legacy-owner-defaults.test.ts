import assert from 'node:assert/strict';
import { test } from 'node:test';
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { Identity, tokenHash } from '../src/modules/identity.ts';
import { Nodes } from '../src/modules/nodes.ts';
import { Transport } from '../src/modules/transport.ts';
import { RelayEndpoints } from '../src/modules/relay-endpoints.ts';
import { IdentityService } from '../src/modules/identity-owner/public.ts';
import { NodeService } from '../src/modules/node-owner/public.ts';
import { TransportService } from '../src/modules/transport-owner/public.ts';
import { RelayEndpointService } from '../src/modules/relay-endpoint-owner/public.ts';
import type { MySqlUnitOfWork, Transaction } from '../src/infrastructure/mysql.ts';
import type { NodeCertificateAuthority } from '../src/infrastructure/pki.ts';
import type { NodeScopeAuthority, RuntimeNodeResources } from '../src/framework/public.ts';

type NativeCall = { sql: string; args: unknown[] };
function native(results: unknown[]) {
  const calls: NativeCall[] = [], trace: string[] = [];
  const target = { async execute(this: unknown, sql: string, args: unknown[]) {
    assert.equal(this, tx); const index = calls.length; calls.push({ sql, args });
    assert.ok(index < results.length, 'unexpected native SQL: ' + sql);
    const result = results[index]; if (result instanceof Error) throw result;
    return [result, []];
  } };
  const tx = new Proxy(target, { get(object, property, receiver) {
    assert.equal(property, 'execute', 'native binding must only use the original supplied executor');
    return Reflect.get(object, property, receiver);
  } }) as unknown as Transaction;
  const db = { pool: tx, async transaction<T>(action: (tx: Transaction) => Promise<T>) {
    assert.equal(this, db); trace.push('begin');
    try { const result = await action(tx); trace.push('commit'); return result; }
    catch (error) { trace.push('rollback'); throw error; }
  } } as unknown as MySqlUnitOfWork;
  return { tx, db, calls, trace };
}
const changed = { affectedRows: 1 };
const signer = new Proxy({}, { get() { assert.fail('these operations must not use certificate signing'); } }) as NodeCertificateAuthority;

test('all six top-level legacy construction entries retain their exact runtime export names and erased type leaves', async () => {
  const entries = [
    ['identity', ['Identity', 'newToken', 'tokenHash', 'validBearerToken']],
    ['nodes', ['Nodes', 'validatePolicy']], ['transport', ['Transport']],
    ['relay-endpoints', ['RelayEndpoints', 'parseRelayEndpoint']],
    ['forwarding', ['Forwarding']], ['idempotency', ['Idempotency']],
  ] as const;
  for (const [name, expected] of entries) {
    const actual = await import('../src/modules/' + name + '.ts');
    assert.deepEqual(Object.keys(actual).sort(), [...expected].sort());
  }
});

test('legacy owner constructors retain distinct classes, public method inheritance and native initialization without clock sampling', t => {
  t.mock.method(Date, 'now', () => assert.fail('constructors must not sample a clock'));
  const f = native([]), authority = {} as NodeScopeAuthority<Transaction>;
  const owners = [
    [new Identity(f.db), Identity, IdentityService, 1],
    [new Nodes(f.db, authority, signer), Nodes, NodeService, 3],
    [new Transport(f.db, {} as never, {} as never, {} as never), Transport, TransportService, 4],
    [new RelayEndpoints(f.db, {} as never, {} as never, {} as never, {} as never), RelayEndpoints, RelayEndpointService, 5],
  ] as const;
  for (const [owner, legacy, canonical, arity] of owners) {
    assert.ok(owner instanceof legacy); assert.ok(owner instanceof canonical);
    assert.notEqual(legacy, canonical); assert.equal(legacy.length, arity);
    assert.equal(Object.getPrototypeOf(legacy.prototype), canonical.prototype);
    assert.deepEqual(Object.getOwnPropertyNames(legacy.prototype), ['constructor']);
  }
  assert.deepEqual(f.calls, []); assert.deepEqual(f.trace, []);
});

test('Identity audit resolves Date.now at each call and native account lookup keeps pool versus supplied-Tx ownership', async t => {
  const f = native([changed, changed, [{ id: 'actor-b' }]]), pool = native([[{ id: 'actor-a' }]]);
  Reflect.set(f.db, 'pool', pool.tx);
  const owner = new Identity(f.db);
  t.mock.method(Date, 'now', () => 111);
  await owner.audit(f.tx, 'scope-a', 'actor-a', 'subject-a', 'member_change', 2, { role: 'viewer' });
  t.mock.method(Date, 'now', () => 222);
  await owner.audit(f.tx, 'scope-a', 'actor-a', 'subject-a', 'member_change', 3, { role: 'removed' });
  assert.equal(f.calls[0]!.args[7], 111); assert.equal(f.calls[1]!.args[7], 222);
  for (const call of f.calls) {
    assert.equal(call.sql, 'INSERT INTO access_events(id,scope_id,actor_id,subject_id,kind,revision,created_at,details) VALUES(?,?,?,?,?,?,?,?)');
    assert.match(call.args[0] as string, /^[0-9a-f-]{36}$/);
  }
  const token = 'A'.repeat(32);
  assert.equal(await owner.authenticate('Bearer ' + token), 'actor-a');
  assert.equal(await owner.authenticateIn(f.tx, 'Bearer ' + token), 'actor-b');
  const lookup = { sql: 'SELECT id FROM accounts WHERE token_hash=?', args: [tokenHash(token)] };
  assert.deepEqual(pool.calls, [lookup]); assert.deepEqual(f.calls.slice(2), [lookup]);
  assert.deepEqual(f.trace, [], 'lookup and audit must not create another transaction');
});

test('Nodes captures Date.now once, preserves separate machine samples and default resource initialization in the original transaction', async t => {
  let captured = 100, capturedCalls = 0;
  t.mock.method(Date, 'now', () => { capturedCalls++; return captured++; });
  const f = native([[{ node_id: 'node-a' }], changed, changed, changed]);
  const identity = { async scope(tx: Transaction, actor: string, scope: string, manage: boolean) {
    assert.equal(tx, f.tx); assert.deepEqual([actor, scope, manage], ['actor-a', 'scope-a', true]);
    f.trace.push('scope');
  } } as NodeScopeAuthority<Transaction>;
  const owner = new Nodes(f.db, identity, signer);
  t.mock.method(Date, 'now', () => assert.fail('Nodes must keep its construction-time function'));
  assert.equal(await owner.machine('fingerprint-a'), 'node-a');
  assert.deepEqual(f.calls[0], { sql: 'SELECT c.node_id FROM node_credentials c JOIN nodes n ON n.id=c.node_id WHERE c.fingerprint=? AND c.revoked=FALSE AND n.revoked=FALSE AND c.valid_until>? AND (c.retire_after IS NULL OR c.retire_after>?)', args: ['fingerprint-a', 100, 101] });
  const policy = { allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [32001], egressPolicyRevision: 1,
    allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false };
  const response = await owner.provision('actor-a', 'scope-a', policy);
  assert.equal(response.expiresAt, new Date(600102).toISOString()); assert.equal(capturedCalls, 3);
  assert.match(response.nodeId, /^[0-9a-f-]{36}$/); assert.match(response.enrollmentToken, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(f.calls[1]!.args.includes(response.nodeId)); assert.ok(f.calls[1]!.args.includes(tokenHash(response.enrollmentToken)));
  assert.ok(f.calls[1]!.args.includes(600102));
  assert.deepEqual(f.calls[2], { sql: 'INSERT INTO node_grants(node_id,actor_id) VALUES(?,?)', args: [response.nodeId, 'actor-a'] });
  assert.deepEqual(f.calls[3], { sql: 'INSERT INTO runtime_nodes(node_id) VALUES(?)', args: [response.nodeId] });
  assert.deepEqual(f.trace, ['begin', 'scope', 'commit']);
});

test('Nodes retains omitted versus supplied resources, credential defaults and original constructor refusal order', async () => {
  const f = native([]), identity = {} as NodeScopeAuthority<Transaction>;
  const owner = new Nodes(f.db, identity, signer);
  assert.equal(Reflect.get(owner, 'overlapSeconds'), 120); assert.equal(Reflect.get(owner, 'relayCredentialSeconds'), 86400);
  const resourceCalls: unknown[][] = [];
  const resources = { initializeNode: async (...args: unknown[]) => { resourceCalls.push(args); } } as unknown as RuntimeNodeResources<Transaction>;
  const explicit = new Nodes(f.db, identity, signer, 1, 60, resources);
  assert.equal(Reflect.get(explicit, 'runtime'), resources);
  assert.equal(Reflect.get(explicit, 'overlapSeconds'), 1); assert.equal(Reflect.get(explicit, 'relayCredentialSeconds'), 60);
  const other = new Nodes(f.db, identity, signer);
  assert.notEqual(Reflect.get(owner, 'runtime'), Reflect.get(other, 'runtime'));
  for (const value of [0, 301, NaN, Infinity, 1.5]) assert.throws(() => new Nodes(f.db, identity, signer, value, 0), /Credential overlap must be 1\.\.300 seconds/);
  for (const value of [0, 59, 86401, NaN, Infinity, 1.5]) assert.throws(() => new Nodes(f.db, identity, signer, 120, value), /Relay credential authority must be 60\.\.86400 seconds/);
  assert.deepEqual(resourceCalls, []); assert.deepEqual(f.calls, []);
});

test('Transport keeps native UUID captured at construction and dynamic time while grant callbacks and SQL share the original transaction', async t => {
  const f = native([[{ grant_revision: 1 }], [], changed, changed, changed]);
  const identity = { async owner(tx: Transaction) { assert.equal(tx, f.tx); f.trace.push('owner'); }, async scope(tx: Transaction) { assert.equal(tx, f.tx); f.trace.push('scope'); } };
  const forwarding = { async hasLiveRelay(tx: Transaction, profile: string) { assert.equal(tx, f.tx); assert.equal(profile, 'profile-a'); f.trace.push('live'); return false; } };
  const firstID = '11111111-1111-4111-8111-111111111111', secondID = '22222222-2222-4222-8222-222222222222';
  const originalUUID = crypto.randomUUID;
  crypto.randomUUID = () => firstID as `${string}-${string}-${string}-${string}-${string}`;
  syncBuiltinESMExports();
  t.after(() => { crypto.randomUUID = originalUUID; syncBuiltinESMExports(); });
  const owner = new Transport(f.db, identity as never, {} as never, forwarding as never);
  // Replace the exported function itself so the earlier constructor reference remains distinguishable.
  crypto.randomUUID = () => secondID as `${string}-${string}-${string}-${string}-${string}`; syncBuiltinESMExports();
  t.mock.method(Date, 'now', () => 987);
  const result = await owner.applyGrant(f.tx, { actorId: 'actor-a', scopeId: 'scope-a', profileId: 'profile-a', subject: 'subject-a', expectedRevision: 1, allowed: true });
  assert.deepEqual(result, { profileId: 'profile-a', actorId: 'subject-a', revision: 2, allowed: true, changed: true });
  assert.deepEqual(f.trace, ['owner', 'scope', 'live']);
  assert.deepEqual(f.calls.map(c => c.sql), [
    'SELECT grant_revision FROM transport_profiles WHERE id=? AND scope_id=? FOR UPDATE',
    'SELECT actor_id FROM transport_profile_grants WHERE profile_id=? AND actor_id=?',
    'INSERT INTO transport_profile_grants(profile_id,actor_id) VALUES(?,?)',
    'UPDATE transport_profiles SET grant_revision=? WHERE id=?',
    'INSERT INTO transport_events(id,profile_id,actor_id,subject_id,revision,created_at,details) VALUES(?,?,?,?,?,?,?)',
  ]);
  assert.deepEqual(f.calls[4]!.args, [firstID, 'profile-a', 'actor-a', 'subject-a', 2, 987, '{"allowed":true}']);
});

test('RelayEndpoints dynamic clock, native store and original owner callbacks preserve request identity and transaction order', async t => {
  const f = native([[], changed]), failure = new Error('receipt failed');
  let request: unknown;
  const identity = { async owner(tx: Transaction) { assert.equal(tx, f.tx); f.trace.push('owner'); } };
  const nodes = {
    async management(tx: Transaction) { assert.equal(tx, f.tx); f.trace.push('management'); return { revoked: false }; },
    async audit(tx: Transaction, node: string, actor: string, kind: string) { assert.equal(tx, f.tx); assert.deepEqual([node, actor, kind], ['node-a', 'actor-a', 'relay_endpoint_update']); f.trace.push('audit'); },
  };
  const requests = {
    async claim(tx: Transaction, value: unknown) { assert.equal(tx, f.tx); request = value; f.trace.push('claim'); },
    async respond(tx: Transaction, value: unknown) { assert.equal(tx, f.tx); assert.equal(value, request); f.trace.push('respond'); throw failure; },
  };
  const forwarding = { async hasLiveRelay(tx: Transaction, profile: unknown, node: string) { assert.equal(tx, f.tx); assert.equal(profile, undefined); assert.equal(node, 'node-a'); f.trace.push('live'); return false; } };
  const owner = new RelayEndpoints(f.db, identity as never, nodes as never, requests as never, forwarding as never);
  t.mock.method(Date, 'now', () => 456);
  await assert.rejects(owner.change('actor-a', 'scope-a', 'node-a', 'key-a', 0, { listenAddress: '127.0.0.1', advertisedHost: 'relay.example', allowedTcpPorts: [32002, 32001] }), error => error === failure);
  assert.deepEqual(f.trace, ['begin', 'owner', 'claim', 'management', 'live', 'audit', 'respond', 'rollback']);
  assert.deepEqual(f.calls[0], { sql: 'SELECT revision,config FROM node_relay_endpoints WHERE node_id=? FOR UPDATE', args: ['node-a'] });
  assert.deepEqual(f.calls[1]!.args, ['node-a', 1, '{"listenAddress":"127.0.0.1","advertisedHost":"relay.example","allowedTcpPorts":[32001,32002]}', 'actor-a', 456]);
});

test('legacy static recovery stores use the exact supplied executor and retain original failure identity and order', async () => {
  const f = native([changed, changed, changed, changed]);
  await Transport.quarantineRecovery(f.tx); await Nodes.quarantineRecovery(f.tx);
  assert.deepEqual(f.calls.map(c => c.sql), ['DELETE FROM transport_profile_grants', 'UPDATE nodes SET revoked=TRUE', 'UPDATE node_credentials SET revoked=TRUE', 'UPDATE node_relay_credentials SET revoked=TRUE']);
  assert.deepEqual(f.trace, []);
  const failure = new Error('quarantine SQL'), failed = native([failure]);
  await assert.rejects(Nodes.quarantineRecovery(failed.tx), error => error === failure);
  assert.equal(failed.calls.length, 1);
});
