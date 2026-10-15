import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import { compilePathTopology, MAX_PLANNED_PATH_NODES, requireTwoNodeRelayTopology } from '../src/modules/runtime/path-topology.ts';

function forward(ingress: string, via: readonly string[] = [], id = 'forward-1'): Forward {
  return {
    id, scopeId: 'scope-1', revision: 4,
    spec: {
      enabled: true, protocols: ['udp', 'tcp'],
      ingress: { nodeId: ingress, listen: { address: '127.0.0.1', port: 25001 } },
      target: { host: '127.0.0.1', port: 25002 },
      ...(via.length ? { path: { via }, transport: { profileId: 'relay-profile', configRevision: 1 } } : {}),
    },
  };
}

test('Direct path gives the same unique Agent identity a local direct role without a peer', () => {
  const plan = compilePathTopology(forward('node-a'));
  assert.deepEqual(plan.nodes, [{ nodeId: 'node-a', index: 0, role: 'direct' }]);
  assert.deepEqual(plan.hops, []);
  assert.deepEqual(plan.activationOrder, ['node-a']);
  assert.deepEqual(plan.protocols, ['tcp', 'udp']); // Core canonical order
  assert.equal(plan.forwardRevision, 4);
});

test('Current two-node Relay stays ingress then egress; activation remains downstream first', () => {
  const plan = requireTwoNodeRelayTopology(forward('node-a', ['node-b']));
  assert.deepEqual(plan.nodes, [
    { nodeId: 'node-a', index: 0, role: 'ingress', downstreamNodeId: 'node-b' },
    { nodeId: 'node-b', index: 1, role: 'egress', upstreamNodeId: 'node-a' },
  ]);
  assert.deepEqual(plan.hops, [{ index: 0, upstreamNodeId: 'node-a', downstreamNodeId: 'node-b' }]);
  assert.deepEqual(plan.activationOrder, ['node-b', 'node-a']);
});

test('Three- and four-Node paths derive transient transit roles and exact adjacent peers', () => {
  const plan = compilePathTopology(forward('node-a', ['node-b', 'node-c', 'node-d']));
  assert.deepEqual(plan.nodes.map(n => n.role), ['ingress', 'transit', 'transit', 'egress']);
  assert.deepEqual(plan.nodes.map(n => [n.upstreamNodeId, n.nodeId, n.downstreamNodeId]), [
    [undefined, 'node-a', 'node-b'],
    ['node-a', 'node-b', 'node-c'],
    ['node-b', 'node-c', 'node-d'],
    ['node-c', 'node-d', undefined],
  ]);
  assert.deepEqual(plan.hops.map(h => [h.upstreamNodeId, h.downstreamNodeId]), [
    ['node-a', 'node-b'], ['node-b', 'node-c'], ['node-c', 'node-d'],
  ]);
  assert.deepEqual(plan.activationOrder, ['node-d', 'node-c', 'node-b', 'node-a']);
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.nodes));
  assert.ok(Object.isFrozen(plan.nodes[1]));
  assert.ok(Object.isFrozen(plan.activationOrder));
});

test('Roles belong to each Forward; an Agent can be ingress, transit and egress simultaneously', () => {
  const ingress = compilePathTopology(forward('node-a', ['node-b', 'node-c'], 'forward-1'));
  const transit = compilePathTopology(forward('node-b', ['node-a', 'node-d'], 'forward-2'));
  const egress = compilePathTopology(forward('node-c', ['node-d', 'node-a'], 'forward-3'));
  assert.equal(ingress.nodes.find(n => n.nodeId === 'node-a')?.role, 'ingress');
  assert.equal(transit.nodes.find(n => n.nodeId === 'node-a')?.role, 'transit');
  assert.equal(egress.nodes.find(n => n.nodeId === 'node-a')?.role, 'egress');
  assert.equal(compilePathTopology(forward('node-a')).nodes[0]?.role, 'direct');
});

test('Bounded path allows exactly the maximum without arbitrary cycles', () => {
  const via = Array.from({ length: MAX_PLANNED_PATH_NODES - 1 }, (_, i) => 'node-' + String(i + 1));
  assert.equal(compilePathTopology(forward('node-0', via)).nodes.length, MAX_PLANNED_PATH_NODES);
  assert.throws(() => compilePathTopology(forward('node-0', [...via, 'node-extra'])), /RESOURCE_LIMIT/);
});

test('Invalid, repeated and missing Profile paths refuse planning', () => {
  assert.throws(() => compilePathTopology(forward('node-a', ['node-b', 'node-a'])), /INVALID_CONFIG/);
  assert.throws(() => compilePathTopology(forward('node-a', ['node-b', 'node-b'])), /INVALID_CONFIG/);
  assert.throws(() => compilePathTopology({ ...forward('node-a', ['node-b']), spec: {
    ...forward('node-a', ['node-b']).spec, transport: undefined,
  }}), /INVALID_CONFIG/);
});

test('Multi-hop planning does not bypass existing ADP/3 two-node execution boundary', () => {
  assert.throws(() => requireTwoNodeRelayTopology(forward('node-a')), /UNSUPPORTED_CAPABILITY/);
  assert.throws(() => requireTwoNodeRelayTopology(forward('node-a', ['node-b', 'node-c'])), /UNSUPPORTED_CAPABILITY/);
  assert.deepEqual(requireTwoNodeRelayTopology(forward('node-a', ['node-b'])).activationOrder, ['node-b', 'node-a']);
});

test('Topology compiler is detached, deterministic and never mutates the caller', () => {
  const input = forward('node-a', ['node-b', 'node-c']);
  const before = JSON.stringify(input);
  const first = compilePathTopology(input);
  const second = compilePathTopology(structuredClone(input));
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input), before);
  assert.equal(Object.isFrozen(input), false);
});
