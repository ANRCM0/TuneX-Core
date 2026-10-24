import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const request = { protocolVersion: 3, probeVersion: 1, kind: 'probe-hello', nodeId: 'node-a', bootId: 'boot-a',
  sessionEpoch: 2, instanceId: 'a'.repeat(64), capability: 'probe.tcp-connect.v1', point: 'agent-direct-egress',
  maxTimeoutMs: 2000, maxAttempts: 1, applicationPayloadBytes: 0 };
const response = { ...request, kind: 'probe-hello-ack', serverTime: '2026-10-17T00:00:00.000Z',
  state: 'contract-only', executionEnabled: false };
const cases = [];
function vector(name, message, value, valid = false) {
  cases.push({ name, message, raw: typeof value === 'string' ? value : JSON.stringify(value), valid });
}
vector('valid-request', 'Request', request, true);
vector('valid-response', 'Response', response, true);
vector('valid-exact-integer-exponent', 'Request', JSON.stringify(request).replace('"sessionEpoch":2', '"sessionEpoch":2e0'), true);
vector('valid-maximum-counter', 'Request', { ...request, sessionEpoch: 9007199254740991 }, true);
for (const [name, patch] of [
  ['downgrade', { probeVersion: 0 }], ['future-version', { probeVersion: 2 }], ['wrong-adp', { protocolVersion: 2 }],
  ['foreign-capability', { capability: 'native.direct.v1' }], ['payload', { applicationPayloadBytes: 1 }],
  ['retry', { maxAttempts: 2 }], ['unbounded-timeout', { maxTimeoutMs: 2001 }], ['nonce-too-short', { instanceId: 'a' }],
  ['nonce-uppercase', { instanceId: 'A'.repeat(64) }], ['newline-id', { nodeId: 'node-a\n' }],
  ['zero-epoch', { sessionEpoch: 0 }], ['unsafe-epoch', { sessionEpoch: 9007199254740992 }],
  ['epoch-string', { sessionEpoch: '2' }], ['arbitrary-target', { host: '169.254.169.254' }],
  ['grant-in-request', { permit: { executable: true } }],
]) vector(name, 'Request', { ...request, ...patch });
for (const [name, patch] of [
  ['enabled-ack', { executionEnabled: true }], ['active-ack', { state: 'active' }],
  ['lease-in-ack', { until: '2099-01-01T00:00:00.000Z' }], ['timezone-offset', { serverTime: '2026-10-17T00:00:00.000+00:00' }],
  ['invalid-calendar', { serverTime: '2026-02-30T00:00:00.000Z' }], ['submillisecond-time', { serverTime: '2026-10-17T00:00:00.0001Z' }],
]) vector(name, 'Response', { ...response, ...patch });
vector('duplicate-field', 'Request', JSON.stringify(request).replace('"probeVersion":1', '"probeVersion":1,"probeVersion":1'));
vector('trailing-data', 'Request', JSON.stringify(request) + '{}');
vector('lone-surrogate', 'Request', JSON.stringify(request).replace('"node-a"', '"\\ud800"'));
vector('null-message', 'Request', 'null');
vector('oversized-message', 'Request', ' '.repeat(4097) + JSON.stringify(request));
const output = JSON.stringify({ description: 'Parser recognition only, never Probe authorization', cases }, null, 2) + '\n';
const path = new URL('packages/contracts/fixtures/probe-negotiation-v1.json', root);
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== output) throw new Error('Probe negotiation fixtures out of date');
} else writeFileSync(path, output);
console.log(`${cases.length} Probe negotiation fixture definitions synchronized.`);
