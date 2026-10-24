import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { digest } from '../packages/contracts/src/digest.ts';
const fixture = JSON.parse(readFileSync(new URL('../packages/contracts/fixtures/adp-v2-direct.json', import.meta.url), 'utf8'));
const base = name => structuredClone(fixture.valid.find(item => item.name === name).payload);
const cases = [];
function add(name, schema, payload, structural = true, semantic = true) {
  if (schema === 'Snapshot') { delete payload.snapshotDigest; payload.snapshotDigest = digest(payload); }
  cases.push({ name, schema, raw: JSON.stringify(payload), structural, semantic });
}
function mutate(name, schema, baseline, action, structural = true, semantic = false) { const payload = base(baseline); action(payload); add(name, schema, payload, structural, semantic); }
const helloRaw = JSON.stringify(base('hello'));
for (const [name, raw] of [
  ['duplicate-key', helloRaw.replace('"protocolVersion":2', '"protocolVersion":2,"protocolVersion":2')],
  ['escaped-duplicate-key', helloRaw.replace('"protocolVersion":2', String.raw`"protocolVersion":2,"\u0070rotocolVersion":2`)],
  ['rounding-unsafe-integer', helloRaw.replace('"lastStoredSnapshotGeneration":0', '"lastStoredSnapshotGeneration":9007199254740991.1')],
  ['unsafe-exponent-integer', helloRaw.replace('"lastStoredSnapshotGeneration":0', '"lastStoredSnapshotGeneration":9007199254740992e0')],
  ['rounded-tiny-noninteger', helloRaw.replace('"lastStoredSnapshotGeneration":0', '"lastStoredSnapshotGeneration":1e-999')],
  ['lone-surrogate', helloRaw.replace('"vnext-dev"', String.raw`"\ud800"`)],
  ['trailing-data', `${helloRaw}{}`],
]) cases.push({ name, schema: 'HelloRequest', raw, structural: false, semantic: false });
cases.push({ name: 'exact-integer-exponent', schema: 'HelloRequest', raw: helloRaw.replace('"protocolVersion":2', '"protocolVersion":2e0'), structural: true, semantic: true });
cases.push({ name: 'exact-integer-decimal', schema: 'HelloRequest', raw: helloRaw.replace('"protocolVersion":2', '"protocolVersion":2.0'), structural: true, semantic: true });
mutate('id-trailing-newline', 'HelloRequest', 'hello', payload => { payload.nodeId += '\n'; }, false);
mutate('unknown-nested-field', 'Snapshot', 'direct-snapshot', payload => { payload.assignments[0].driver.config.arbitraryCommand = 'denied'; }, false);
mutate('logical-slot-duplicate', 'Snapshot', 'direct-snapshot', payload => { const extra = structuredClone(payload.assignments[0]); extra.assignmentId += '-2'; extra.listener.port++; payload.assignments.push(extra); });
mutate('physical-slot-duplicate', 'Snapshot', 'direct-snapshot', payload => { const extra = structuredClone(payload.assignments[0]); extra.assignmentId += '-2'; extra.forwardId += '-2'; payload.assignments.push(extra); });
mutate('config-digest-mismatch', 'Snapshot', 'direct-snapshot', payload => { payload.assignments[0].driver.config.target.port++; });
mutate('noncanonical-host', 'Snapshot', 'direct-snapshot', payload => { const a = payload.assignments[0]; a.driver.config.target.host = 'TARGET.example.'; a.driver.configDigest = digest(a.driver.config); });
mutate('host-trailing-newline', 'Snapshot', 'direct-snapshot', payload => { const a = payload.assignments[0]; a.driver.config.target.host = 'target.example\n'; a.driver.configDigest = digest(a.driver.config); }, false);
mutate('cidr-host-bits', 'Snapshot', 'direct-snapshot', payload => { const a = payload.assignments[0]; a.driver.config.allowedDestinationCidrs = ['10.0.0.1/24']; a.driver.configDigest = digest(a.driver.config); });
mutate('cidr-empty', 'Snapshot', 'direct-snapshot', payload => { const a = payload.assignments[0]; a.driver.config.allowedDestinationCidrs = []; a.driver.configDigest = digest(a.driver.config); }, false);
mutate('leap-second-issued', 'Snapshot', 'direct-snapshot', payload => { payload.issuedAt = '2025-12-31T23:59:60Z'; payload.validUntil = '2026-01-01T00:05:00Z'; });
mutate('fractional-valid-window', 'Snapshot', 'direct-snapshot', payload => { payload.issuedAt = '2026-10-12T08:00:00.000000001Z'; payload.validUntil = '2026-10-12T08:00:00.000000002Z'; }, true, true);
mutate('fractional-reversed-window', 'Snapshot', 'direct-snapshot', payload => { payload.issuedAt = '2026-10-12T08:00:00.000000002Z'; payload.validUntil = '2026-10-12T08:00:00.000000001Z'; });
mutate('unsupported-null', 'Snapshot', 'direct-snapshot', payload => { payload.assignments = null; }, false);
mutate('generation-overflow', 'Snapshot', 'direct-snapshot', payload => { payload.snapshotGeneration = 9007199254740992; }, false);
mutate('future-retirement', 'Snapshot', 'direct-snapshot', payload => { const a = payload.assignments[0]; payload.tombstones = [{ assignmentId: a.assignmentId, forwardId: a.forwardId, protocol: 'tcp', port: a.listener.port+1, bindingFence: 1, retirementGeneration: 2 }]; });
mutate('retired-fence-resurrection', 'Snapshot', 'direct-snapshot', payload => { const a = payload.assignments[0]; payload.tombstones = [{ assignmentId: a.assignmentId, forwardId: a.forwardId, protocol: 'tcp', port: a.listener.port, bindingFence: 1, retirementGeneration: 1 }]; });
mutate('successor-over-retired-fence', 'Snapshot', 'direct-snapshot', payload => { const a = payload.assignments[0]; a.bindingFence = 2; payload.tombstones = [{ assignmentId: a.assignmentId, forwardId: a.forwardId, protocol: 'tcp', port: a.listener.port, bindingFence: 1, retirementGeneration: 1 }]; }, true, true);
mutate('max-forward-id', 'Snapshot', 'direct-snapshot', payload => { payload.assignments[0].forwardId = 'f'.repeat(128); }, true, true);
mutate('invalid-ready-phase', 'ReportRequest', 'report', payload => { payload.observations[0].phase = 'prepared'; });
mutate('observation-without-accepted-snapshot', 'ReportRequest', 'report', payload => { payload.acceptedSnapshotGeneration = 0; });
mutate('duplicate-observation', 'ReportRequest', 'report', payload => { payload.observations.push(structuredClone(payload.observations[0])); });
mutate('report-leap-second', 'ReportRequest', 'report', payload => { payload.observedAt = '2025-12-31T23:59:60Z'; });
const drain = { assignmentId: 'asg-forward-1001-tcp-hk', deploymentGeneration: 1, bindingFence: 1, startedAt: '2026-10-12T08:00:00Z', deadline: '2026-10-12T08:00:30Z', remainingConnections: 1, condition: 'draining' };
mutate('duplicate-drain', 'ReportRequest', 'report', payload => { payload.drains = [drain, { ...drain, condition: 'removed', remainingConnections: 0 }]; });
mutate('removed-drain-has-connections', 'ReportRequest', 'report', payload => { payload.drains = [{ ...drain, condition: 'removed' }]; });
mutate('invalid-renewal-policy', 'HelloResponse', 'hello-response', payload => { payload.policy.renewalLeadSeconds = payload.policy.leaseSeconds; });
mutate('leap-second-server-time', 'HelloResponse', 'hello-response', payload => { payload.serverTime = '2025-12-31T23:59:60Z'; });
const target = new URL('../packages/contracts/test/fixtures/conformance.json', import.meta.url);
const contents = `${JSON.stringify({ description: 'Shared TS/Go stateless conformance vectors. No runtime authorization, session or network evidence.', cases }, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8').replaceAll('\r\n', '\n') !== contents) throw new Error('Conformance fixtures are out of date');
} else { mkdirSync(new URL('.', target), { recursive: true }); writeFileSync(target, contents); }
console.log(`${cases.length} shared stateless conformance vectors.`);
