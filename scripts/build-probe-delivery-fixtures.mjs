import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const machine = { protocolVersion: 3, probeVersion: 1, nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2,
  instanceId: 'a'.repeat(64), instanceGeneration: 1, requestId: 'c'.repeat(64) };
const binding = { nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, snapshotGeneration: 3, assignmentId: 'assignment-a',
  forwardId: 'forward-a', forwardRevision: 1, deploymentGeneration: 4, bindingFence: 5,
  configDigest: 'sha256:' + 'b'.repeat(64), egressPolicyRevision: 1 };
const offer = { permitId: 'permit-a', binding, timeoutMs: 1000, issuedAt: '2026-10-17T00:00:00.000Z', expiresAt: '2026-10-17T00:00:02.000Z' };
const poll = { ...machine, kind: 'probe-poll' };
const pollAck = { ...machine, kind: 'probe-poll-ack', observedAt: '2026-10-17T00:00:00.100Z',
  serverTime: '2026-10-17T00:00:00.110Z', executionEnabled: false, offer };
const status = { ...machine, kind: 'probe-status', permitId: offer.permitId };
const statusAck = { ...machine, kind: 'probe-status-ack', ...offer, consumedAt: '2026-10-17T00:00:00.050Z',
  checkedAt: pollAck.observedAt, serverTime: pollAck.serverTime, state: 'consumed', executionEnabled: false };
const cases = [];
function vector(name, message, value, valid = false) {
  cases.push({ name, message, raw: typeof value === 'string' ? value : JSON.stringify(value), valid });
}
vector('valid-poll', 'PollRequest', poll, true);
vector('valid-offer', 'PollResponse', pollAck, true);
vector('valid-status', 'StatusRequest', status, true);
vector('valid-observation', 'StatusResponse', statusAck, true);
vector('valid-empty', 'PollResponse', { ...pollAck, offer: null }, true);
vector('valid-freshness-boundary', 'StatusResponse', { ...statusAck, serverTime: '2026-10-17T00:00:00.350Z' }, true);
vector('valid-exponent', 'PollRequest', JSON.stringify(poll).replace('"sessionEpoch":2', '"sessionEpoch":2e0'), true);
vector('valid-safe-maximum', 'StatusRequest', { ...status, instanceGeneration: 9007199254740991 }, true);
for (const [message, value] of Object.entries({ PollRequest: poll, PollResponse: pollAck, StatusRequest: status, StatusResponse: statusAck })) {
  for (const key of Object.keys(value)) {
    const changed = { ...value }; delete changed[key]; vector(`${message}-missing-${key}`, message, changed);
  }
  for (const [name, patch] of [
    ['old-version', { probeVersion: 0 }], ['wrong-adp', { protocolVersion: 2 }], ['wrong-kind', { kind: 'probe-claim' }],
    ['target', { target: '169.254.169.254' }], ['actor', { actorId: 'owner' }], ['fingerprint', { fingerprint: 'f'.repeat(64) }],
    ['short-instance', { instanceId: 'a' }], ['zero-generation', { instanceGeneration: 0 }],
    ['unsafe-counter', { sessionEpoch: 9007199254740992 }], ['newline-node', { nodeId: 'node-a\n' }],
    ['string-epoch', { sessionEpoch: '2' }], ['zero-epoch', { sessionEpoch: 0 }], ['bad-request-id', { requestId: 'A'.repeat(64) }],
  ]) vector(`${message}-${name}`, message, { ...value, ...patch });
  vector(`${message}-duplicate`, message, JSON.stringify(value).replace('"probeVersion":1', '"probeVersion":1,"probeVersion":1'));
  vector(`${message}-rounded-number`, message, JSON.stringify(value).replace('"sessionEpoch":2', '"sessionEpoch":2.0000000000000001'));
  vector(`${message}-null`, message, 'null');
  vector(`${message}-trailing`, message, JSON.stringify(value) + '{}');
  vector(`${message}-oversize`, message, ' '.repeat(4097));
}
for (const [name, patch] of [
  ['caller-permit', { permitId: 'permit-a' }], ['caller-binding', { binding }], ['caller-timeout', { timeoutMs: 1000 }],
]) vector(name, 'PollRequest', { ...poll, ...patch });
vector('status-caller-binding', 'StatusRequest', { ...status, binding });
for (const [message, value, observation] of [['PollResponse', pollAck, 'observedAt'], ['StatusResponse', statusAck, 'checkedAt']]) {
  for (const [name, patch] of [
    ['enabled', { executionEnabled: true }], ['future-observation', { [observation]: '2026-10-17T00:00:00.111Z' }],
    ['stale', { serverTime: '2026-10-17T00:00:00.351Z' }], ['expired', { serverTime: offer.expiresAt }],
    ['calendar', { serverTime: '2026-02-30T00:00:00.000Z' }], ['fractional-time', { serverTime: '2026-10-17T00:00:00.1101Z' }],
  ]) vector(`${message}-${name}`, message, { ...value, ...patch });
}
for (const [name, changed] of [
  ['long-window', { ...offer, expiresAt: '2026-10-17T00:00:02.001Z' }],
  ['empty-window', { ...offer, expiresAt: offer.issuedAt }],
  ['pre-issue-observation', { ...offer, issuedAt: '2026-10-17T00:00:00.101Z' }],
  ['expired-observation', { ...offer, expiresAt: pollAck.observedAt }],
  ['small-timeout', { ...offer, timeoutMs: 99 }], ['large-timeout', { ...offer, timeoutMs: 2001 }],
  ['foreign-node', { ...offer, binding: { ...binding, nodeId: 'foreign' } }],
  ['foreign-boot', { ...offer, binding: { ...binding, bootId: 'foreign' } }],
  ['foreign-epoch', { ...offer, binding: { ...binding, sessionEpoch: 3 } }],
  ['zero-fence', { ...offer, binding: { ...binding, bindingFence: 0 } }],
  ['newline-assignment', { ...offer, binding: { ...binding, assignmentId: 'assignment-a\n' } }],
  ['unsafe-binding', { ...offer, binding: { ...binding, deploymentGeneration: 9007199254740992 } }],
  ['unknown-binding', { ...offer, binding: { ...binding, target: '127.0.0.1' } }],
  ['bad-digest', { ...offer, binding: { ...binding, configDigest: 'sha256:' + 'b'.repeat(63) } }],
]) {
  vector(`offer-${name}`, 'PollResponse', { ...pollAck, offer: changed });
  vector(`status-${name}`, 'StatusResponse', { ...statusAck, ...changed });
}
vector('more-than-one-offer', 'PollResponse', { ...pollAck, offer: [offer, offer] });
vector('unknown-offer-field', 'PollResponse', { ...pollAck, offer: { ...offer, scopeId: 'scope-a' } });
vector('empty-offer-object', 'PollResponse', { ...pollAck, offer: {} });
vector('empty-pre-epoch', 'PollResponse', { ...pollAck, offer: null, observedAt: '1969-12-31T23:59:59.999Z', serverTime: '1970-01-01T00:00:00.000Z' });
vector('pre-issue-consumed', 'StatusResponse', { ...statusAck, consumedAt: '2026-10-16T23:59:59.999Z' });
vector('future-consumed', 'StatusResponse', { ...statusAck, consumedAt: '2026-10-17T00:00:00.101Z' });
vector('not-consumed', 'StatusResponse', { ...statusAck, state: 'issued' });
vector('duplicate-offer-binding', 'PollResponse', JSON.stringify(pollAck).replace('"bindingFence":5', '"bindingFence":5,"bindingFence":5'));
vector('surrogate', 'PollRequest', JSON.stringify(poll).replace('"node-a"', '"\\ud800"'));
const path = new URL('packages/contracts/fixtures/probe-delivery-v1.json', root);
const output = JSON.stringify({ description: 'Bounded non-executable discovery and point-in-time current authority observations', cases }, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== output) throw new Error('Probe delivery fixtures out of date');
} else writeFileSync(path, output);
console.log(`${cases.length} Probe delivery fixture definitions synchronized.`);
