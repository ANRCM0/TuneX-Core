import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const request = { protocolVersion: 3, probeVersion: 1, kind: 'probe-instance', action: 'register',
  nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, instanceId: 'a'.repeat(64), expectedGeneration: 0 };
const response = { ...request, kind: 'probe-instance-ack', generation: 1, state: 'registered',
  currentInstanceId: request.instanceId, registeredAt: '2026-10-17T00:00:00.000Z', expiresAt: '2026-10-17T00:00:30.000Z',
  serverTime: '2026-10-17T00:00:00.010Z', executionEnabled: false };
const cases = [];
function vector(name, message, value, valid = false) {
  cases.push({ name, message, raw: typeof value === 'string' ? value : JSON.stringify(value), valid });
}
vector('valid-register', 'Request', request, true);
vector('valid-registered', 'Response', response, true);
vector('valid-inspect', 'Request', { ...request, action: 'inspect' }, true);
vector('valid-absent', 'Response', { ...response, action: 'inspect', state: 'absent', generation: 0,
  currentInstanceId: null, registeredAt: null, expiresAt: null }, true);
vector('valid-stale-inspection', 'Response', { ...response, action: 'inspect', state: 'stale' }, true);
vector('valid-revoked', 'Response', { ...response, action: 'revoke', state: 'revoked', expectedGeneration: 1 }, true);
vector('valid-quarantine', 'Response', { ...response, action: 'revoke', state: 'quarantined', expectedGeneration: 1 }, true);
vector('valid-exponent', 'Request', JSON.stringify(request).replace('"sessionEpoch":2', '"sessionEpoch":2e0'), true);
vector('valid-max-generation', 'Request', { ...request, expectedGeneration: 9007199254740991 }, true);
for (const [name, patch] of [
  ['old-version', { probeVersion: 0 }], ['wrong-adp', { protocolVersion: 2 }], ['unknown-action', { action: 'renew' }],
  ['caller-target', { target: '169.254.169.254' }], ['permit', { permitId: 'forged' }],
  ['nonce-short', { instanceId: 'a' }], ['newline-id', { bootId: 'boot-a\n' }], ['zero-epoch', { sessionEpoch: 0 }],
  ['unsafe-generation', { expectedGeneration: 9007199254740992 }], ['negative-generation', { expectedGeneration: -1 }],
  ['string-generation', { expectedGeneration: '0' }], ['inspect-nonzero', { action: 'inspect', expectedGeneration: 1 }],
]) vector(name, 'Request', { ...request, ...patch });
for (const [name, patch] of [
  ['enabled', { executionEnabled: true }], ['bad-register-state', { state: 'stale' }], ['wrong-generation', { generation: 2 }],
  ['foreign-current', { currentInstanceId: 'b'.repeat(64) }], ['null-expiry', { expiresAt: null }],
  ['overlong-registration', { expiresAt: '2026-10-17T00:00:30.001Z' }],
  ['reversed-registration', { expiresAt: '2026-10-17T00:00:00.000Z' }],
  ['invalid-calendar', { serverTime: '2026-02-30T00:00:00.000Z' }], ['ack-permit', { permit: 'fake' }],
  ['absent-with-history', { action: 'inspect', state: 'absent' }],
  ['revoke-live', { action: 'revoke', expectedGeneration: 1 }],
]) vector(name, 'Response', { ...response, ...patch });
vector('duplicate', 'Request', JSON.stringify(request).replace('"probeVersion":1', '"probeVersion":1,"probeVersion":1'));
vector('trailing', 'Request', JSON.stringify(request) + '{}');
vector('surrogate', 'Request', JSON.stringify(request).replace('"node-a"', '"\\ud800"'));
vector('oversize', 'Request', ' '.repeat(4097));
vector('null', 'Response', 'null');
const path = new URL('docs/protocol/fixtures/probe-instance-v1.json', root);
const output = JSON.stringify({ description: 'Non-executable ownership; no permit authority', cases }, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== output) throw new Error('Probe instance fixtures out of date');
} else writeFileSync(path, output);
console.log(`${cases.length} Probe instance fixture definitions synchronized.`);
