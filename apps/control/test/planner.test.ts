import assert from 'node:assert/strict';
import { test } from 'node:test';
import { digest, DEFAULT_POLICY, parseMessage } from '@tunex/contracts';
import type { Assignment, Tombstone } from '@tunex/contracts';
import type { Forward } from '@tunex/core';
import { compileDirect, compileSnapshot } from '../src/modules/runtime/planner.ts';
import type { AuthorizedNodeFacts, ReservedSlot, SnapshotInput } from '../src/modules/runtime/planner.ts';

function forward(id = 'forward-a', port = 25565): Forward {
  return { id, scopeId: 'scope-a', revision: 3, spec: {
    enabled: true, protocols: ['tcp', 'udp'],
    ingress: { nodeId: 'node-a', listen: { address: '0.0.0.0', port } },
    target: { host: 'game.example', port: 443 },
  } };
}
function facts(): AuthorizedNodeFacts {
  return {
    nodeId: 'node-a', scopeId: 'scope-a', capabilities: ['native.direct.v1', 'tcp', 'udp'],
    allowedListenerAddresses: ['0.0.0.0'], allowedPorts: [25565, 25566],
    egressPolicyRevision: 7, allowedDestinationCidrs: ['192.0.2.0/24', '10.0.0.0/8'], allowMetadataTargets: false,
  };
}
function reservations(id = 'forward-a', port = 25565): ReservedSlot[] {
  return ['tcp', 'udp'].map(protocol => ({ nodeId: 'node-a', forwardId: id, protocol: protocol as 'tcp' | 'udp', port, bindingFence: 4, deploymentGeneration: 2 }));
}
function assignments(): readonly Assignment[] { return compileDirect(forward(), facts(), reservations()); }
function snapshot(overrides: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    nodeId: 'node-a', sessionEpoch: 5, snapshotGeneration: 10,
    issuedAt: '2026-10-12T10:00:00Z', validUntil: '2026-10-12T10:05:00Z',
    assignments: assignments(), tombstones: [], ...overrides,
  };
}

test('direct plan carries authorized facts and separate per-protocol reservations', () => {
  const plan = assignments();
  assert.deepEqual(plan.map(assignment => assignment.protocol).sort(), ['tcp', 'udp']);
  assert.deepEqual(plan.map(assignment => assignment.assignmentId), plan.map(assignment => assignment.assignmentId).sort());
  for (const assignment of plan) {
    assert.equal(assignment.role, 'direct');
    assert.equal(assignment.phase, 'active');
    assert.equal(assignment.forwardRevision, 3);
    assert.equal(assignment.deploymentGeneration, 2);
    assert.equal(assignment.bindingFence, 4);
    assert.equal(assignment.driver.id, 'native.direct.v1');
    assert.equal(assignment.driver.config.egressPolicyRevision, 7);
    assert.equal(assignment.driver.config.allowMetadataTargets, false);
    assert.equal(assignment.driver.configDigest, digest(assignment.driver.config));
    assert.equal(assignment.drainTimeoutSeconds, 30);
  }
  assert.notEqual(plan[0]?.assignmentId, plan[1]?.assignmentId);
  assert.deepEqual(compileDirect(forward(), facts(), reservations()), plan);
});

test('compiler rejects unauthorized scope, node, listener address and port', () => {
  for (const change of [
    { scopeId: 'scope-b' }, { nodeId: 'node-b' },
    { allowedListenerAddresses: ['127.0.0.1'] }, { allowedPorts: [443] },
  ]) assert.throws(() => compileDirect(forward(), { ...facts(), ...change }, reservations()), /AUTHORIZATION_DENIED/);
});

test('compiler requires the exact driver and every requested protocol capability', () => {
  for (const capabilities of [['tcp', 'udp'], ['native.direct.v1', 'tcp'], ['native.direct.v1', 'udp'], ['native.direct.v2', 'tcp', 'udp']]) {
    assert.throws(() => compileDirect(forward(), { ...facts(), capabilities }, reservations()), /UNSUPPORTED_CAPABILITY/);
  }
  const tcp = { ...forward(), spec: { ...forward().spec, protocols: ['tcp'] as const } };
  assert.equal(compileDirect(tcp, { ...facts(), capabilities: ['native.direct.v1', 'tcp'] }, reservations()).length, 1);
  const relay = { ...forward(), spec: { ...forward().spec, path: { via: ['node-b'] }, transport: { profileId: 'profile-a', configRevision: 1 } } };
  assert.throws(() => compileDirect(relay, facts(), reservations()), /UNSUPPORTED_CAPABILITY/);
});

test('TCP and UDP need distinct, unambiguous reservations before a plan is returned', () => {
  const slots = reservations();
  assert.throws(() => compileDirect(forward(), facts(), slots.slice(0, 1)), /RESOURCE_CONFLICT/);
  assert.throws(() => compileDirect(forward(), facts(), [...slots, { ...slots[0]! }]), /RESOURCE_CONFLICT/);
  for (const change of [{ nodeId: 'other' }, { forwardId: 'other' }, { port: 25566 }, { bindingFence: 0 }, { deploymentGeneration: 0 }]) {
    assert.throws(() => compileDirect(forward(), facts(), [{ ...slots[0]!, ...change }, slots[1]!]), /RESOURCE_CONFLICT/);
  }
  assert.deepEqual(compileDirect(forward(), facts(), [...slots].reverse()), assignments());
});

test('valid maximum-length Forward IDs compile into bounded stable assignment identities', () => {
  const id = 'f'.repeat(128);
  const planned = compileDirect(forward(id), facts(), reservations(id));
  assert.equal(planned.length, 2);
  assert.ok(planned.every(assignment => assignment.assignmentId.length <= 128));
  assert.notEqual(planned[0]?.assignmentId, planned[1]?.assignmentId);
  assert.deepEqual(compileDirect(forward(id), facts(), reservations(id)), planned);
  const different = compileDirect(forward('g'.repeat(128)), facts(), reservations('g'.repeat(128)));
  assert.notEqual(planned[0]?.assignmentId, different[0]?.assignmentId);
});

test('reservation high-water counters accept the safe maximum and reject exhaustion or fractions', () => {
  const maximum = reservations().map(slot => ({ ...slot, bindingFence: Number.MAX_SAFE_INTEGER, deploymentGeneration: Number.MAX_SAFE_INTEGER }));
  assert.equal(compileDirect(forward(), facts(), maximum)[0]?.bindingFence, Number.MAX_SAFE_INTEGER);
  for (const counter of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
    for (const field of ['bindingFence', 'deploymentGeneration']) {
      const slots = reservations().map(slot => ({ ...slot, [field]: counter }));
      assert.throws(() => compileDirect(forward(), facts(), slots), /RESOURCE_CONFLICT/);
    }
  }
});

test('driver digest covers the target and every versioned destination policy fact', () => {
  const original = assignments()[0]?.driver.configDigest;
  const targetChange = { ...forward(), spec: { ...forward().spec, target: { host: 'other.example', port: 443 } } };
  assert.notEqual(compileDirect(targetChange, facts(), reservations())[0]?.driver.configDigest, original);
  for (const change of [{ egressPolicyRevision: 8 }, { allowMetadataTargets: true }, { allowedDestinationCidrs: ['10.0.0.0/8'] }]) {
    assert.notEqual(compileDirect(forward(), { ...facts(), ...change }, reservations())[0]?.driver.configDigest, original);
  }
});

test('compiler rejects unknown execution phases and unbounded drain durations', () => {
  for (const duration of [0, 300]) {
    assert.ok(compileDirect(forward(), facts(), reservations(), 'draining', duration).every(assignment => assignment.drainTimeoutSeconds === duration));
  }
  for (const duration of [-1, 301, 1.5, NaN, Infinity]) {
    assert.throws(() => compileDirect(forward(), facts(), reservations(), 'active', duration), /INVALID_CONFIG/);
  }
  assert.throws(() => compileDirect(forward(), facts(), reservations(), 'ready' as Assignment['phase']), /INVALID_CONFIG/);
});

test('destination policy must be explicit and CIDR networks valid', () => {
  for (const change of [
    { egressPolicyRevision: 0 }, { egressPolicyRevision: Number.MAX_SAFE_INTEGER + 1 },
    { allowedDestinationCidrs: [] }, { allowedDestinationCidrs: ['10.0.0.1/8'] },
    { allowedDestinationCidrs: ['0.0.0.0/33'] }, { allowedDestinationCidrs: ['not-a-cidr'] },
  ]) assert.throws(() => compileDirect(forward(), { ...facts(), ...change }, reservations()), /AUTHORIZATION_DENIED/);
  assert.throws(() => compileDirect({ ...forward(), spec: { ...forward().spec, enabled: false } }, facts(), reservations()), /INVALID_CONFIG/);
});

test('planner normalizes policy order, preserves caller objects and freezes the compiled plan', () => {
  const input = forward();
  const authorized = { ...facts(), allowedDestinationCidrs: ['192.0.2.0/24', '10.0.0.0/8', '192.0.2.0/24'] };
  const slots = reservations();
  const plan = compileDirect(input, authorized, slots);
  authorized.allowedDestinationCidrs[0] = '0.0.0.0/0';
  slots[0] = { ...slots[0]!, bindingFence: 99 };
  assert.deepEqual(plan[0]?.driver.config.allowedDestinationCidrs, ['10.0.0.0/8', '192.0.2.0/24']);
  assert.equal(plan[0]?.bindingFence, 4);
  assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(authorized), false);
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan[0]?.driver.config));
  assert.ok(Object.isFrozen(plan[0]?.listener));
  assert.ok(Object.isFrozen(plan[0]?.driver.config.allowedDestinationCidrs));
  assert.equal(plan[0]?.driver.configDigest, assignments()[0]?.driver.configDigest);
});

test('phase changes and lease renewal preserve assignment identity, generation, fence and driver digest', () => {
  const active = assignments();
  const prepared = compileDirect(forward(), facts(), reservations(), 'prepared');
  for (let i = 0; i < active.length; i++) {
    assert.deepEqual({ ...prepared[i]!, phase: 'active' }, active[i]);
  }
  const oldSnapshot = compileSnapshot(snapshot());
  const renewed = compileSnapshot(snapshot({ snapshotGeneration: 11, issuedAt: '2026-10-12T10:02:00Z', validUntil: '2026-10-12T10:07:00Z' }));
  assert.deepEqual(renewed.assignments, oldSnapshot.assignments);
  assert.notEqual(renewed.snapshotDigest, oldSnapshot.snapshotDigest);
  assert.equal(renewed.sessionEpoch, oldSnapshot.sessionEpoch);
});

test('complete snapshot sorts caller-owned assignments and tombstones before hashing', () => {
  const planned = [...assignments()].reverse();
  const inputAssignmentIds = planned.map(assignment => assignment.assignmentId);
  const retired: Tombstone[] = [
    { assignmentId: 'retired-b', forwardId: 'old-b', protocol: 'udp', port: 25567, bindingFence: 1, retirementGeneration: 7 },
    { assignmentId: 'retired-a', forwardId: 'old-a', protocol: 'tcp', port: 25568, bindingFence: 2, retirementGeneration: 8 },
    { assignmentId: 'retired-c', forwardId: 'old-c', protocol: 'tcp', port: 25567, bindingFence: 3, retirementGeneration: 9 },
  ];
  const result = compileSnapshot(snapshot({ assignments: planned, tombstones: retired }));
  assert.equal(result.complete, true);
  assert.deepEqual(result.assignments.map(assignment => assignment.protocol).sort(), ['tcp', 'udp']);
  assert.deepEqual(result.assignments.map(assignment => assignment.assignmentId), [...inputAssignmentIds].sort());
  assert.deepEqual(result.tombstones.map(tombstone => tombstone.assignmentId), ['retired-c', 'retired-a', 'retired-b']);
  assert.deepEqual(planned.map(assignment => assignment.assignmentId), inputAssignmentIds);
  assert.equal(retired[0]?.assignmentId, 'retired-b');
  const { snapshotDigest, ...body } = result;
  assert.equal(snapshotDigest, digest(body));
  assert.deepEqual(parseMessage('Snapshot', JSON.stringify(result)), result);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.assignments));
  assert.ok(Object.isFrozen(result.tombstones[0]));
  assert.equal(compileSnapshot(snapshot({ assignments: [...planned].reverse(), tombstones: [...retired].reverse() })).snapshotDigest, result.snapshotDigest);
});

test('snapshot rejects duplicate ownership even when listen IP differs', () => {
  const competitor = compileDirect(forward('forward-b'), facts(), reservations('forward-b'));
  const otherAddress = { ...competitor[0]!, listener: { address: '127.0.0.1', port: 25565 } };
  assert.throws(() => compileSnapshot(snapshot({ assignments: [...assignments(), otherAddress] })), /RESOURCE_CONFLICT/);
  assert.throws(() => compileSnapshot(snapshot({ assignments: [...assignments(), assignments()[0]!] })), /RESOURCE_CONFLICT/);
});

test('retirement fences prevent stale assignment resurrection and future tombstones', () => {
  const assignment = assignments()[0]!;
  const retired: Tombstone = { assignmentId: assignment.assignmentId, forwardId: assignment.forwardId, protocol: assignment.protocol, port: assignment.listener.port, bindingFence: assignment.bindingFence, retirementGeneration: 9 };
  assert.throws(() => compileSnapshot(snapshot({ tombstones: [retired] })), /FENCING_REJECTED/);
  assert.throws(() => compileSnapshot(snapshot({ assignments: [], tombstones: [{ ...retired, retirementGeneration: 11 }] })), /INVALID_CONFIG/);
  const safe = compileSnapshot(snapshot({ tombstones: [{ ...retired, bindingFence: 3 }] }));
  assert.equal(safe.tombstones.length, 1);
});

test('snapshot enforces assignment and byte capacity, valid policy timing and lease bounds', () => {
  assert.throws(() => compileSnapshot(snapshot({ policy: { ...DEFAULT_POLICY, maxAssignmentsPerNode: 1 } })), /RESOURCE_LIMIT/);
  assert.throws(() => compileSnapshot(snapshot({ policy: { ...DEFAULT_POLICY, maxSnapshotBytes: 100 } })), /RESOURCE_LIMIT/);
  assert.throws(() => compileSnapshot(snapshot({ policy: { ...DEFAULT_POLICY, renewalLeadSeconds: 10 } })), /INVALID_CONFIG/);
  for (const validUntil of ['2026-10-12T10:00:00Z', '2026-10-12T09:59:00Z', '2026-10-12T10:05:01Z', 'invalid']) {
    assert.throws(() => compileSnapshot(snapshot({ validUntil })), /INVALID_CONFIG/);
  }
  const empty = compileSnapshot(snapshot({ assignments: [], tombstones: [] }));
  assert.deepEqual(empty.assignments, []);
  assert.deepEqual(empty.tombstones, []);
});

test('unrepresentable leap-second timestamps cannot bypass the authorization lease limit', () => {
  for (const times of [
    { issuedAt: '2026-10-12T23:59:60Z', validUntil: '2026-10-13T00:10:00Z' },
    { issuedAt: '2026-10-12T23:50:00Z', validUntil: '2026-10-12T23:59:60Z' },
    { issuedAt: '2026-10-12T23:59:60Z', validUntil: '2026-10-13T23:59:60Z' },
  ]) assert.throws(() => compileSnapshot(snapshot(times)), /INVALID_CONFIG/);
});
