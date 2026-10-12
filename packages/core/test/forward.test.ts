import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decideForwardChange, MAX_COUNTER, normalizeIp, parseForward, parseForwardSpec, parseNode, validateForwardSpec } from '../src/index.ts';
import type { Forward, ForwardChange, ForwardSpec, Result } from '../src/index.ts';

function intent() {
  return {
    enabled: true,
    protocols: ['tcp', 'udp'] as Array<'tcp' | 'udp'>,
    ingress: { nodeId: 'node-a', listen: { address: '0.0.0.0', port: 25565 } },
    target: { host: 'game.example', port: 25565 },
  };
}
function value<T>(result: Result<T>): T {
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) throw new Error('Expected successful parse');
  return result.value;
}
function rejection<T>(result: Result<T>, code = 'INVALID_CONFIG', path?: string): void {
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error('Expected rejected input');
  assert.ok(result.errors.some(error => error.code === code && (path === undefined || error.path === path)), JSON.stringify(result.errors));
}
function forward(revision = 1): Forward {
  return { id: 'forward-a', scopeId: 'scope-a', revision, spec: intent() };
}

test('canonical intent normalizes protocol order, hostnames, IPv6 and empty direct paths', () => {
  const input = intent();
  input.protocols.reverse();
  input.target.host = 'GAME.Example.';
  input.ingress.listen.address = '2001:0DB8:0:0:0:0:0:0001';
  const spec = value(parseForwardSpec({ ...input, path: { via: [] } }));
  assert.deepEqual(spec.protocols, ['tcp', 'udp']);
  assert.equal(spec.target.host, 'game.example');
  assert.equal(spec.ingress.listen.address, '2001:db8::1');
  assert.equal(Object.hasOwn(spec, 'path'), false);
  assert.deepEqual(value(validateForwardSpec(spec)), spec);
  assert.equal(normalizeIp('::FFFF:C000:0201'), '::ffff:192.0.2.1');
  assert.equal(normalizeIp('0:0:1:0:0:2:3:4'), '::1:0:0:2:3:4');
});

test('parser returns deeply immutable values detached from caller-owned objects', () => {
  const input = { ...intent(), path: { via: ['node-b'] }, transport: { profileId: 'profile-a', configRevision: 2 } };
  const spec = value(parseForwardSpec(input));
  input.protocols.pop();
  input.ingress.listen.port = 1;
  input.target.host = 'changed.example';
  input.path.via[0] = 'node-c';
  input.transport.configRevision = 3;
  assert.deepEqual(spec.protocols, ['tcp', 'udp']);
  assert.equal(spec.ingress.listen.port, 25565);
  assert.equal(spec.target.host, 'game.example');
  assert.deepEqual(spec.path?.via, ['node-b']);
  assert.equal(spec.transport?.configRevision, 2);
  for (const object of [spec, spec.protocols, spec.ingress, spec.ingress.listen, spec.target, spec.path, spec.path?.via, spec.transport]) {
    assert.ok(Object.isFrozen(object));
  }
  assert.equal(Object.isFrozen(input.target), false);
  assert.equal(Reflect.set(spec.target, 'port', 1), false);
});

test('path and locked Transport reference form one valid relay intent', () => {
  const transport = { profileId: 'profile-a', configRevision: 1 };
  assert.deepEqual(value(parseForwardSpec({ ...intent(), path: { via: ['node-b', 'node-c'] }, transport })).path?.via, ['node-b', 'node-c']);
  for (const via of [['node-a'], ['node-b', 'node-b'], ['node-b', 'node-a']]) {
    rejection(parseForwardSpec({ ...intent(), path: { via }, transport }), 'INVALID_CONFIG', 'spec.path.via');
  }
  rejection(parseForwardSpec({ ...intent(), path: { via: ['node-b'] } }), 'INVALID_CONFIG', 'spec.transport');
  rejection(parseForwardSpec({ ...intent(), transport }), 'INVALID_CONFIG', 'spec.transport');
  rejection(parseForwardSpec({ ...intent(), path: { via: [] }, transport }), 'INVALID_CONFIG', 'spec.transport');
  for (const configRevision of [0, -1, 1.5, MAX_COUNTER + 1]) {
    rejection(parseForwardSpec({ ...intent(), path: { via: ['node-b'] }, transport: { ...transport, configRevision } }));
  }
});

test('rejects empty, duplicate or unsupported protocol sets and malformed object shapes', () => {
  for (const protocols of [[], ['tcp', 'tcp'], ['TCP'], ['sctp'], ['tcp', 'udp', 'tcp'], 'tcp', null]) {
    rejection(parseForwardSpec({ ...intent(), protocols }), 'INVALID_CONFIG', 'spec.protocols');
  }
  for (const input of [null, undefined, [], 'forward', {}, { ...intent(), enabled: 'true' }, { ...intent(), path: null }]) {
    rejection(parseForwardSpec(input));
  }
});

test('validates endpoint ports at boundaries and rejects coercion or ranges', () => {
  for (const port of [1, 65535]) {
    assert.equal(value(parseForwardSpec({ ...intent(), target: { host: '127.0.0.1', port } })).target.port, port);
    assert.equal(value(parseForwardSpec({ ...intent(), ingress: { nodeId: 'node-a', listen: { address: '::', port } } })).ingress.listen.port, port);
  }
  for (const port of [0, -1, 65536, 1.5, NaN, Infinity, '80', '80-90', [80, 90], null]) {
    rejection(parseForwardSpec({ ...intent(), target: { host: 'game.example', port } }), 'INVALID_CONFIG', 'spec.target.port');
    rejection(parseForwardSpec({ ...intent(), ingress: { nodeId: 'node-a', listen: { address: '0.0.0.0', port } } }), 'INVALID_CONFIG', 'spec.ingress.listen.port');
  }
});

test('target hostname and IP validation leaves network access policy to outer modules', () => {
  for (const host of ['127.0.0.1', '10.0.0.1', '::1', 'XN--BCHER-KVA.EXAMPLE.', 'localhost']) {
    assert.equal(parseForwardSpec({ ...intent(), target: { host, port: 80 } }).ok, true, host);
  }
  for (const host of ['', '0.0.0.0', '::', '::ffff:0.0.0.0', '[::1]', 'fe80::1%eth0', 'example..com', '.example.com', '-bad.example', 'bad-.example', 'bücher.example', 'a'.repeat(64) + '.example', '999.1.1.1', '01.2.3.4', 'https://example.com', ' example.com', 'example.com..']) {
    rejection(parseForwardSpec({ ...intent(), target: { host, port: 80 } }), 'INVALID_CONFIG', 'spec.target.host');
  }
  for (const address of ['localhost', '[::1]', 'fe80::1%eth0', '256.0.0.1', '1::2::3', '1:2:3:4:5:6:7:8::']) {
    rejection(parseForwardSpec({ ...intent(), ingress: { nodeId: 'node-a', listen: { address, port: 80 } } }), 'INVALID_CONFIG', 'spec.ingress.listen.address');
  }
});

test('non-ASCII hostname input is rejected before case folding can convert Unicode into ASCII', () => {
  for (const host of ['K.example', 'EXAMPLE.KOM', 'bücher.example', 'ｅxample.com']) {
    rejection(parseForwardSpec({ ...intent(), target: { host, port: 80 } }), 'INVALID_CONFIG', 'spec.target.host');
  }
});

test('rejects unmanaged fields at every intent boundary', () => {
  for (const input of [
    { ...intent(), revision: 9 },
    { ...intent(), target: { ...intent().target, url: 'http://example.com' } },
    { ...intent(), ingress: { ...intent().ingress, scopeId: 'other' } },
    { ...intent(), ingress: { ...intent().ingress, listen: { ...intent().ingress.listen, endPort: 25600 } } },
    { ...intent(), path: { via: [], resolved: true } },
  ]) rejection(parseForwardSpec(input));
});

test('Node and Forward identities and revisions obey the shared primitive bounds', () => {
  assert.equal(value(parseNode({ id: 'A'.repeat(128), scopeId: 'scope:1', revision: MAX_COUNTER })).revision, MAX_COUNTER);
  for (const id of ['', 'a'.repeat(129), '-node', 'node with space', '节点']) {
    rejection(parseNode({ id, scopeId: 'scope-a', revision: 1 }));
    rejection(parseForward({ ...forward(), id }));
    rejection(parseForward({ ...forward(), scopeId: id }));
  }
  for (const revision of [0, -1, 1.5, MAX_COUNTER + 1, '1']) {
    rejection(parseNode({ id: 'node-a', scopeId: 'scope-a', revision }));
    rejection(parseForward({ ...forward(), revision }));
  }
  rejection(parseNode({ id: 'node-a', scopeId: 'scope-a', revision: 1, health: 'ready' }));
  rejection(parseForward({ ...forward(), applied: true }));
});

test('CAS decisions advance changed intent, preserve identity and leave the current object intact', () => {
  const current = forward(7);
  const next = value(decideForwardChange(current, 7, { kind: 'set-enabled', enabled: false }));
  assert.equal(next.revision, 8);
  assert.equal(next.spec.enabled, false);
  assert.equal(next.id, current.id);
  assert.equal(next.scopeId, current.scopeId);
  assert.equal(current.spec.enabled, true);
  assert.equal(current.revision, 7);
  assert.ok(Object.isFrozen(next));
  assert.ok(Object.isFrozen(next.spec.target));
  for (const expected of [6, 8, 0, NaN, MAX_COUNTER + 1]) {
    rejection(decideForwardChange(current, expected, { kind: 'set-enabled', enabled: true }), 'REVISION_CONFLICT');
  }
});

test('canonical no-op preserves revision, including at counter exhaustion', () => {
  const current = forward(MAX_COUNTER);
  const equivalent = { ...intent(), protocols: ['udp', 'tcp'], target: { host: 'GAME.Example.', port: 25565 }, path: { via: [] } };
  assert.equal(value(decideForwardChange(current, MAX_COUNTER, { kind: 'replace', spec: equivalent })).revision, MAX_COUNTER);
  assert.equal(value(decideForwardChange(current, MAX_COUNTER, { kind: 'set-enabled', enabled: true })).revision, MAX_COUNTER);
  rejection(decideForwardChange(current, MAX_COUNTER, { kind: 'set-enabled', enabled: false }), 'REVISION_EXHAUSTED');
});

test('controlled change rejects server-managed fields and invalid replacements', () => {
  for (const field of ['id', 'scopeId', 'revision']) {
    const change = { kind: 'set-enabled', enabled: false, [field]: field === 'revision' ? 100 : 'other' } as ForwardChange;
    rejection(decideForwardChange(forward(), 1, change), 'INVALID_CONFIG', `change.${field}`);
    const replace = { kind: 'replace', spec: intent(), [field]: 'other' } as ForwardChange;
    rejection(decideForwardChange(forward(), 1, replace));
  }
  rejection(decideForwardChange(forward(), 1, { kind: 'replace', spec: { ...intent(), id: 'other' } }));
  rejection(decideForwardChange(forward(), 1, { kind: 'replace', spec: { ...intent(), protocols: [] } }));
  rejection(decideForwardChange(forward(), 1, { kind: 'delete' } as unknown as ForwardChange));
  rejection(decideForwardChange(forward(), 1, { kind: 'set-enabled', enabled: 'false' } as unknown as ForwardChange));
});

test('replacing intent parses and detaches the new spec before returning a decision', () => {
  const replacement = intent();
  replacement.target.port = 8443;
  const next = value(decideForwardChange(forward(), 1, { kind: 'replace', spec: replacement }));
  replacement.target.port = 1;
  assert.equal(next.spec.target.port, 8443);
  assert.equal(next.revision, 2);
  assert.equal(validateForwardSpec(next.spec as ForwardSpec).ok, true);
});
