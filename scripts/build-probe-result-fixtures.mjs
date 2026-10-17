import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const canonicalize = createRequire(import.meta.url)('canonicalize');
const root = new URL('../', import.meta.url);
const machine = { protocolVersion: 3, probeVersion: 1, nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2,
  instanceId: 'a'.repeat(64), instanceGeneration: 1, permitId: 'permit-a', requestId: 'c'.repeat(64) };
const binding = { nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, snapshotGeneration: 3, assignmentId: 'assignment-a',
  forwardId: 'forward-a', forwardRevision: 1, deploymentGeneration: 4, bindingFence: 5,
  configDigest: 'sha256:' + 'b'.repeat(64), egressPolicyRevision: 1 };
const request = { ...machine, kind: 'probe-result', binding, timeoutMs: 1000, issuedAt: '2026-10-17T00:00:00.000Z',
  expiresAt: '2026-10-17T00:00:02.000Z', consumedAt: '2026-10-17T00:00:00.050Z', measuredAt: '2026-10-17T00:00:00.100Z',
  validUntil: '2026-10-17T00:00:02.000Z', elapsedMs: 10, point: 'agent-direct-egress', status: 'connected', code: 'tcp-connected',
  applicationHealth: 'unknown', source: 'agent-reported', applicationPayloadBytes: 0 };
const hash = input => { const { requestId: _, ...body } = input; return 'sha256:' + createHash('sha256').update(canonicalize(body)).digest('hex'); };
const response = { ...machine, kind: 'probe-result-ack', resultDigest: hash(request), acceptedAt: '2026-10-17T00:00:00.110Z',
  serverTime: '2026-10-17T00:00:00.120Z', duplicate: false, health: 'unknown', executionEnabled: false };
const cases = [];
const vector = (name, message, value, valid = false) => cases.push({ name, message, raw: typeof value === 'string' ? value : JSON.stringify(value), valid });
vector('connected', 'Request', request, true);
vector('accepted', 'Response', response, true);
vector('unreachable', 'Request', { ...request, status: 'unreachable', code: 'tcp-connect-failed' }, true);
vector('duplicate', 'Response', { ...response, duplicate: true }, true);
vector('zero-elapsed', 'Request', { ...request, elapsedMs: 0 }, true);
vector('integer-exponent', 'Request', JSON.stringify(request).replace('"sessionEpoch":2', '"sessionEpoch":2e0'), true);
for (const [message, value] of Object.entries({ Request: request, Response: response })) {
  for (const key of Object.keys(value)) { const changed = { ...value }; delete changed[key]; vector(`${message}-missing-${key}`, message, changed); }
  for (const [name, patch] of [
    ['old', { probeVersion: 0 }], ['adp', { protocolVersion: 2 }], ['kind', { kind: 'probe-status' }],
    ['actor', { actorId: 'owner' }], ['target', { target: '169.254.169.254' }], ['fingerprint', { fingerprint: 'f'.repeat(64) }],
    ['newline-id', { nodeId: 'node-a\n' }], ['zero', { sessionEpoch: 0 }], ['unsafe', { sessionEpoch: 9007199254740992 }],
    ['string', { instanceGeneration: '1' }], ['token', { instanceId: 'a' }], ['correlation', { requestId: 'C'.repeat(64) }],
  ]) vector(`${message}-${name}`, message, { ...value, ...patch });
  vector(`${message}-duplicate`, message, JSON.stringify(value).replace('"probeVersion":1', '"probeVersion":1,"probeVersion":1'));
  vector(`${message}-rounded`, message, JSON.stringify(value).replace('"sessionEpoch":2', '"sessionEpoch":2.0000000000000001'));
  vector(`${message}-null`, message, 'null'); vector(`${message}-array`, message, '[]');
  vector(`${message}-trailing`, message, JSON.stringify(value) + '{}'); vector(`${message}-oversize`, message, ' '.repeat(4097));
}
for (const [name, patch] of [
  ['before-epoch', { issuedAt: '1969-12-31T23:59:59.999Z' }], ['before-issued', { consumedAt: '1969-12-31T23:59:59.999Z' }],
  ['before-consume', { measuredAt: '2026-10-17T00:00:00.049Z' }], ['empty-validity', { validUntil: request.measuredAt }],
  ['extends-permit', { validUntil: '2026-10-17T00:00:02.001Z' }], ['long-permit', { expiresAt: '2026-10-17T00:00:02.001Z' }],
  ['elapsed-over-timeout', { elapsedMs: 1001 }], ['negative', { elapsedMs: -1 }], ['fraction', { elapsedMs: 1.1 }],
  ['elapsed-string', { elapsedMs: '1' }], ['status-code', { code: 'tcp-connect-failed' }], ['unknown-status', { status: 'timeout' }],
  ['healthy', { applicationHealth: 'healthy' }], ['independent', { independentProbe: true }], ['source', { source: 'control-verified' }],
  ['point', { point: 'ingress' }], ['payload', { applicationPayloadBytes: 1 }], ['small-timeout', { timeoutMs: 99 }],
  ['large-timeout', { timeoutMs: 2001 }], ['utc-offset', { measuredAt: '2026-10-17T00:00:00.100+00:00' }],
  ['calendar', { measuredAt: '2026-02-30T00:00:00.000Z' }], ['nano', { measuredAt: '2026-10-17T00:00:00.1001Z' }],
]) vector(name, 'Request', { ...request, ...patch });
for (const key of Object.keys(binding)) {
  const changed = { ...binding }; delete changed[key]; vector(`missing-binding-${key}`, 'Request', { ...request, binding: changed });
}
for (const [name, patch] of [['node', { nodeId: 'foreign' }], ['boot', { bootId: 'foreign' }], ['epoch', { sessionEpoch: 3 }],
  ['assignment', { assignmentId: 'bad\n' }], ['fence', { bindingFence: 0 }], ['digest', { configDigest: 'sha256:' + 'a'.repeat(63) }],
  ['unknown', { target: '127.0.0.1' }]]) vector('binding-' + name, 'Request', { ...request, binding: { ...binding, ...patch } });
for (const [name, patch] of [['enabled', { executionEnabled: true }], ['health', { health: 'healthy' }], ['digest', { resultDigest: 'x' }],
  ['time', { serverTime: '2026-10-17T00:00:00.109Z' }], ['pre-epoch', { acceptedAt: '1969-12-31T23:59:59.999Z' }]])
  vector('ack-' + name, 'Response', { ...response, ...patch });
const contents = JSON.stringify({ version: 1, request, response, resultDigest: hash(request), cases }, null, 2) + '\n';
const path = new URL('docs/protocol/fixtures/probe-result-v1.json', root);
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8').replaceAll('\r\n','\n') !== contents) throw new Error('Probe result fixtures are out of date');
} else writeFileSync(path, contents);
console.log(`${cases.length} Probe result fixture definitions synchronized.`);
