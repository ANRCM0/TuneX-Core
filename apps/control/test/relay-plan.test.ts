import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import { digest } from '@tunex/contracts';
import type { RelayConfig } from '@tunex/contracts';
import { compileRelayPlan } from '../src/modules/runtime/relay-plan.ts';
import type { RelayNodeExecutionFacts, ReservedRelayResource } from '../src/modules/runtime/relay-plan.ts';
import { compileRelayResources } from '../src/modules/runtime/relay-planner.ts';
import { compileSnapshot } from '../src/modules/runtime/planner.ts';

function fixture() {
  const forward: Forward = { id: 'forward-a', scopeId: 'scope-a', revision: 1, spec: { enabled: true, protocols: ['tcp', 'udp'], ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 32001 } }, target: { host: '127.0.0.1', port: 32002 }, path: { via: ['node-b'] }, transport: { profileId: 'profile-a', configRevision: 1 } } };
  const profile = { profileId: 'profile-a', revision: 1, configDigest: '', config: { driver: 'native.relay.v1' as const, wireVersion: 1 as const, security: 'mutual-tls13' as const, protocols: ['tcp', 'udp'] as ('tcp'|'udp')[], handshakeTimeoutSeconds: 5, idleTimeoutSeconds: 60, maxFrameBytes: 65536, maxUdpDatagramBytes: 16384, maxConnectionsPerNode: 4096 } }; profile.configDigest = digest(profile.config);
  const nodes: RelayNodeExecutionFacts[] = ['node-a', 'node-b'].map((nodeId, index) => ({ facts: { nodeId, scopeId: 'scope-a', capabilities: ['adp.3', 'native.relay.v1', 'relay.wire.1', 'tcp', 'udp'], allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [32001], egressPolicyRevision: 1, allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false }, sessionEpoch: index+2, credentialUntil: Date.parse('2026-10-13T01:00:00Z'), peers: [{ fingerprint: `sha256:${String(index+1).repeat(64)}`, validUntil: Date.parse('2026-10-13T00:30:00Z') }] }));
  const endpoint = { nodeId: 'node-b', revision: 1, config: { listenAddress: '127.0.0.1', advertisedHost: '127.0.0.1', allowedTcpPorts: [32003, 32004] } };
  const resources = compileRelayResources(forward, nodes.map(node => node.facts), profile, endpoint, { tcp: 32003, udp: 32004 });
  const reservations: ReservedRelayResource[] = resources.map((resource, index) => ({ ...resource, forwardId: forward.id, deploymentGeneration: 7, bindingFence: index+4 }));
  return { forward, nodes, profile, endpoint, reservations, issuedAt: '2026-10-13T00:00:00Z', drainTimeoutSeconds: 30 };
}

test('Control Relay plan binds both sessions and physical reservations in strict prepared assignments', () => {
  const input = fixture(), plan = compileRelayPlan(input);
  assert.equal(plan.nodes.length, 2); assert.equal(plan.deploymentGeneration, 7);
  assert.equal(plan.authorizationUntil, Date.parse('2026-10-13T00:30:00Z'));
  for (const node of plan.nodes) {
    assert.equal(node.assignments.length, 2);
    for (const assignment of node.assignments) {
      const config = assignment.driver.config as RelayConfig;
      assert.equal(assignment.phase, 'prepared'); assert.equal(config.binding.ingressSessionEpoch, 2); assert.equal(config.binding.egressSessionEpoch, 3);
      assert.equal(config.binding.profileDigest, input.profile.configDigest);
      assert.equal(config.binding.deploymentGeneration, 7);
      if (assignment.role === 'relay-egress') assert.equal(assignment.resource.protocol, 'tcp');
    }
    assert.doesNotThrow(() => compileSnapshot({ nodeId: node.nodeId, sessionEpoch: node.sessionEpoch, snapshotGeneration: 1, issuedAt: input.issuedAt, validUntil: '2026-10-13T00:05:00Z', assignments: node.assignments, tombstones: [] }));
  }
  assert.ok(Object.isFrozen(plan.nodes[0]!.assignments[0]!.driver.config)); assert.equal(Object.isFrozen(input.nodes[0]!.facts), false);
});
test('Relay plan is order stable and never mutates owner facts or reserved slots', () => {
  const input = fixture(), original = JSON.stringify(input), plan = compileRelayPlan(input);
  const reordered = { ...input, nodes: [...input.nodes].reverse(), reservations: [...input.reservations].reverse() };
  assert.equal(compileRelayPlan(reordered).planDigest, plan.planDigest); assert.equal(JSON.stringify(input), original);
});
test('Relay compiler rejects missing, foreign, mixed-generation and unfenced reservations', () => {
  for (const mutate of [
    (input: ReturnType<typeof fixture>) => { input.reservations.pop(); },
    (input: ReturnType<typeof fixture>) => { input.reservations[0]!.forwardId = 'foreign'; },
    (input: ReturnType<typeof fixture>) => { input.reservations[0]!.deploymentGeneration++; },
    (input: ReturnType<typeof fixture>) => { input.reservations[0]!.bindingFence = 0; },
    (input: ReturnType<typeof fixture>) => { input.reservations[1]!.physicalProtocol = 'udp'; },
  ]) { const input = fixture(); mutate(input); assert.throws(() => compileRelayPlan(input)); }
});
test('Relay compiler refuses expired or duplicated peer facts and bounds both Node credentials', () => {
  const input = fixture(); input.nodes[0]!.credentialUntil = Date.parse('2026-10-13T00:10:00Z'); assert.equal(compileRelayPlan(input).authorizationUntil, input.nodes[0]!.credentialUntil);
  input.nodes[1]!.peers = [...input.nodes[1]!.peers, ...input.nodes[1]!.peers]; assert.throws(() => compileRelayPlan(input), /unique peer/);
  const expired = fixture(); expired.nodes[1]!.peers = [{ fingerprint: 'sha256:'+'2'.repeat(64), validUntil: Date.parse(expired.issuedAt) }]; assert.throws(() => compileRelayPlan(expired), /unique peer/);
  const noSession = fixture(); noSession.nodes[0]!.sessionEpoch = 0; assert.throws(() => compileRelayPlan(noSession), /Current session/);
});
