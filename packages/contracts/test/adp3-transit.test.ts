import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { digest } from '../src/digest.ts';
import { parseRuntimeMessage } from '../src/adp3.ts';
import { parseTransitAdpAssignment, parseTransitAdpSnapshot, requireTransitAdpCapabilities } from '../src/adp3-transit.ts';
import type { TransitAdpAssignment, TransitAdpSnapshot } from '../src/adp3-transit.ts';
import { parseTransitIntent } from '../src/transit.ts';

const fixture = JSON.parse(readFileSync(new URL('../../../docs/protocol/fixtures/transit-v1.json', import.meta.url), 'utf8')) as {
 cases: {name: string; raw: string; valid: boolean}[];
};
const intent = parseTransitIntent(fixture.cases.find(c => c.name === 'valid-three-node-transit-udp')!.raw);
function makeAssignment(): TransitAdpAssignment {
 const config = {intent};
 return {
  protocolVersion: 3, extensionVersion: 1, nodeId: intent.nodeId,
  sessionEpoch: intent.sessionEpoch, assignmentId: intent.assignmentId,
  forwardId: intent.forwardId, forwardRevision: intent.forwardRevision,
  deploymentGeneration: intent.deploymentGeneration, bindingFence: intent.bindingFence,
  role: 'relay-transit', protocol: intent.protocol, phase: 'prepared',
  resource: {address: intent.listener.address, port: intent.listener.port, protocol: 'tcp'},
  driver: {id: 'native.transit.v1', schemaVersion: 1, configDigest: digest(config), config},
  drainTimeoutSeconds: 30,
 };
}
function makeSnapshot(assignments: TransitAdpAssignment[] = [makeAssignment()]): TransitAdpSnapshot {
 const body = {
  protocolVersion: 3 as const, extensionVersion: 1 as const, kind: 'transit-snapshot' as const,
  requiredCapabilities: ['adp.multihop.1', 'transit.wire.1', 'native.transit.v1'] as const,
  nodeId: intent.nodeId, sessionEpoch: intent.sessionEpoch, snapshotGeneration: 10,
  complete: true as const, issuedAt: intent.issuedAt, validUntil: '2026-10-15T00:04:00Z',
  assignments, tombstones: [],
 };
 return {...body, snapshotDigest: digest(body)};
}
function rehash(snapshot: TransitAdpSnapshot): TransitAdpSnapshot {
 const {snapshotDigest: _old, ...body} = snapshot;
 void _old;
 return {...body, snapshotDigest: digest(body)};
}
function mutation<T>(item: T): T { return structuredClone(item); }

test('Transit ADP/3 extension round-trips with a full role, peer, port and version binding', () => {
 const assignment = parseTransitAdpAssignment(JSON.stringify(makeAssignment()));
 assert.equal(assignment.resource.protocol, 'tcp'); // UDP association occupies a physical TLS/TCP socket
 assert.equal(assignment.protocol, 'udp');
 assert.ok(Object.isFrozen(assignment.driver.config.intent));
 const snapshot = parseTransitAdpSnapshot(JSON.stringify(makeSnapshot()));
 assert.equal(snapshot.assignments[0]?.bindingFence, intent.bindingFence);
 assert.ok(Object.isFrozen(snapshot.assignments[0]));
 assert.doesNotThrow(() => requireTransitAdpCapabilities([...snapshot.requiredCapabilities]));
});

test('extension must never pass the deployed ADP/3 Runtime parser or silently downgrade', () => {
 assert.throws(() => parseRuntimeMessage('Snapshot', JSON.stringify(makeSnapshot())));
 assert.throws(() => requireTransitAdpCapabilities(['adp.multihop.1', 'transit.wire.1']), /UNSUPPORTED_CAPABILITY/);
 assert.throws(() => requireTransitAdpCapabilities(['native.relay.v1']), /UNSUPPORTED_CAPABILITY/);
});

test('version, nested Contract and physical bindings reject tampering even with a new snapshot digest', () => {
 const mutate = (fn: (a: any) => void) => {
  const snap = mutation(makeSnapshot()) as any;
  fn(snap.assignments[0]);
  assert.throws(() => parseTransitAdpSnapshot(JSON.stringify(rehash(snap))));
 };
 mutate(a => { a.extensionVersion = 2; });
 mutate(a => { a.role = 'relay-egress'; });
 mutate(a => { a.resource.protocol = 'udp'; });
 mutate(a => { a.resource.port++; });
 mutate(a => { a.sessionEpoch++; });
 mutate(a => { a.bindingFence++; });
 mutate(a => { a.driver.configDigest = 'sha256:' + 'a'.repeat(64); });
 mutate(a => { a.driver.config.intent.downstream.nodeId = a.driver.config.intent.nodeId; });
 mutate(a => { a.driver.config.intent.unexpectedAuthority = true; });
 const version = mutation(makeSnapshot()) as any;
 version.extensionVersion = 2;
 assert.throws(() => parseTransitAdpSnapshot(JSON.stringify(rehash(version))));
 const capabilities = mutation(makeSnapshot()) as any;
 capabilities.requiredCapabilities = ['native.relay.v1'];
 assert.throws(() => parseTransitAdpSnapshot(JSON.stringify(rehash(capabilities))));
});

test('snapshot detects corruption, session swaps, expired authorizations and physical conflicts', () => {
 const original = makeSnapshot();
 const corrupted = mutation(original) as any;
 corrupted.assignments[0].bindingFence++;
 assert.throws(() => parseTransitAdpSnapshot(JSON.stringify(corrupted)), /INTEGRITY_FAILURE/);
 const session = mutation(original) as any;
 session.sessionEpoch++;
 assert.throws(() => parseTransitAdpSnapshot(JSON.stringify(rehash(session))), /AUTHORIZATION_DENIED/);
 const lease = mutation(original) as any;
 lease.validUntil = '2026-10-15T00:06:00Z';
 assert.throws(() => parseTransitAdpSnapshot(JSON.stringify(rehash(lease))), /AUTHORIZATION_DENIED/);
 const duplicate = mutation(original) as any;
 duplicate.assignments.push(structuredClone(duplicate.assignments[0]));
 assert.throws(() => parseTransitAdpSnapshot(JSON.stringify(rehash(duplicate))), /RESOURCE_CONFLICT/);
 const retirement = mutation(original) as any;
 retirement.tombstones.push({assignmentId:'past',forwardId:intent.forwardId,role:'relay-transit',
  protocol:'udp',physicalProtocol:'tcp',port:intent.listener.port,
  bindingFence:intent.bindingFence,retirementGeneration:9});
 assert.throws(() => parseTransitAdpSnapshot(JSON.stringify(rehash(retirement))), /FENCING_REJECTED/);
});
