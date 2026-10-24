import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const request = { protocolVersion: 3, probeVersion: 1, kind: 'probe-claim', nodeId: 'node-a', bootId: 'boot-a',
  sessionEpoch: 2, instanceId: 'a'.repeat(64), instanceGeneration: 1, permitId: 'permit-a' };
const binding = { nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, snapshotGeneration: 3, assignmentId: 'assignment-a',
  forwardId: 'forward-a', forwardRevision: 1, deploymentGeneration: 4, bindingFence: 5,
  configDigest: 'sha256:' + 'b'.repeat(64), egressPolicyRevision: 1 };
const response = { ...request, kind: 'probe-claim-ack', binding, timeoutMs: 1000,
  issuedAt: '2026-10-17T00:00:00.000Z', expiresAt: '2026-10-17T00:00:02.000Z',
  consumedAt: '2026-10-17T00:00:00.100Z', serverTime: '2026-10-17T00:00:00.110Z',
  state: 'consumed', executionEnabled: false };
const cases = [];
function vector(name, message, value, valid = false) {
  cases.push({ name, message, raw: typeof value === 'string' ? value : JSON.stringify(value), valid });
}
vector('valid-claim', 'Request', request, true);
vector('valid-receipt', 'Response', response, true);
vector('valid-exponent', 'Request', JSON.stringify(request).replace('"sessionEpoch":2', '"sessionEpoch":2e0'), true);
vector('valid-safe-maximum', 'Request', { ...request, instanceGeneration: 9007199254740991 }, true);
vector('valid-short-window', 'Response', { ...response, expiresAt: '2026-10-17T00:00:00.111Z' }, true);
for (const [name, patch] of [
  ['old-version', { probeVersion: 0 }], ['wrong-adp', { protocolVersion: 2 }], ['wrong-kind', { kind: 'probe-instance' }],
  ['caller-target', { target: '169.254.169.254' }], ['caller-binding', { binding }], ['caller-fingerprint', { fingerprint: 'a'.repeat(64) }],
  ['caller-actor', { actorId: 'owner' }], ['caller-timeout', { timeoutMs: 2000 }], ['short-instance', { instanceId: 'a' }],
  ['zero-generation', { instanceGeneration: 0 }], ['unsafe-generation', { instanceGeneration: 9007199254740992 }],
  ['string-epoch', { sessionEpoch: '2' }], ['newline-permit', { permitId: 'permit-a\n' }], ['zero-epoch', { sessionEpoch: 0 }],
]) vector(name, 'Request', { ...request, ...patch });
for (const [name, patch] of [
  ['enabled', { executionEnabled: true }], ['unspent', { state: 'issued' }], ['response-target', { target: '127.0.0.1' }],
  ['foreign-node', { binding: { ...binding, nodeId: 'foreign' } }], ['foreign-boot', { binding: { ...binding, bootId: 'foreign' } }],
  ['foreign-epoch', { binding: { ...binding, sessionEpoch: 3 } }], ['unknown-binding-field', { binding: { ...binding, host: '127.0.0.1' } }],
  ['newline-assignment', { binding: { ...binding, assignmentId: 'assignment-a\n' } }],
  ['bad-digest', { binding: { ...binding, configDigest: binding.configDigest + '\n' } }],
  ['zero-fence', { binding: { ...binding, bindingFence: 0 } }], ['unsafe-snapshot', { binding: { ...binding, snapshotGeneration: 9007199254740992 } }],
  ['long-window', { expiresAt: '2026-10-17T00:00:02.001Z' }], ['empty-window', { expiresAt: response.issuedAt }],
  ['pre-issue-consumption', { consumedAt: '2026-10-16T23:59:59.999Z' }],
  ['future-consumption', { consumedAt: '2026-10-17T00:00:00.111Z' }],
  ['expired-receipt', { serverTime: response.expiresAt }], ['invalid-calendar', { serverTime: '2026-02-30T00:00:00.000Z' }],
  ['pre-epoch-issue', { issuedAt: '1969-12-31T23:59:59.000Z', expiresAt: '1970-01-01T00:00:00.500Z',
    consumedAt: '1970-01-01T00:00:00.000Z', serverTime: '1970-01-01T00:00:00.100Z' }],
  ['small-timeout', { timeoutMs: 99 }], ['large-timeout', { timeoutMs: 2001 }],
]) vector(name, 'Response', { ...response, ...patch });
for (const key of Object.keys(request)) {
  const value = { ...request }; delete value[key]; vector('missing-' + key, 'Request', value);
}
vector('missing-binding', 'Response', Object.fromEntries(Object.entries(response).filter(([key]) => key !== 'binding')));
vector('duplicate-root', 'Request', JSON.stringify(request).replace('"probeVersion":1', '"probeVersion":1,"probeVersion":1'));
vector('duplicate-binding', 'Response', JSON.stringify(response).replace('"bindingFence":5', '"bindingFence":5,"bindingFence":5'));
vector('trailing', 'Request', JSON.stringify(request) + '{}');
vector('surrogate', 'Request', JSON.stringify(request).replace('"node-a"', '"\\ud800"'));
vector('oversize', 'Response', ' '.repeat(4097));
vector('null', 'Response', 'null');
const path = new URL('packages/contracts/fixtures/probe-claim-v1.json', root);
const output = JSON.stringify({ description: 'Single-use consumed receipt; never an executable grant', cases }, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== output) throw new Error('Probe claim fixtures out of date');
} else writeFileSync(path, output);
console.log(`${cases.length} Probe claim fixture definitions synchronized.`);
