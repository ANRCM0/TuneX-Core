import test from 'node:test';
import assert from 'node:assert/strict';
import { explainNodePreflight, summarizePreflight } from '../forward-preflight.js';

const now = Date.parse('2026-10-20T01:00:00.000Z');
const node = (overrides = {}) => ({
  id: 'node-1', revoked: false, credentialUntil: '2026-10-21T00:00:00.000Z',
  lastReportAt: '2026-10-20T00:59:30.000Z',
  policy: { capabilities: ['adp.3', 'native.direct.v1', 'tcp', 'udp'], allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [8080] },
  ...overrides,
});

test('declared capabilities plus fresh report are selectable but still advisory', () => {
  const result = explainNodePreflight(node(), { protocol: 'both', now });
  assert.equal(result.status, 'supported');
  assert.equal(result.tone, 'good');
  assert.deepEqual(result.reasons, []);
  assert.equal(result.dimensions.platform, 'unknown');
  assert.equal(result.dimensions.roles, 'unknown');
  assert.equal(result.facts.status, 'fresh');
});

test('missing protocol capability is unsupported with an explicit reason', () => {
  const value = node(); value.policy = { ...value.policy, capabilities: ['adp.3', 'native.direct.v1', 'tcp'] };
  const result = explainNodePreflight(value, { protocol: 'both', now });
  assert.equal(result.status, 'unsupported');
  assert.ok(result.reasons.some(reason => reason.code === 'CAPABILITY_MISSING' && reason.message.includes('udp')));
});

test('revoked and expired credentials are unsupported before capability checks', () => {
  assert.equal(explainNodePreflight(node({ revoked: true }), { protocol: 'tcp', now }).status, 'unsupported');
  const expired = explainNodePreflight(node({ credentialUntil: '2026-10-19T00:00:00.000Z' }), { protocol: 'tcp', now });
  assert.equal(expired.status, 'unsupported');
  assert.ok(expired.reasons.some(reason => reason.code === 'CREDENTIAL_EXPIRED'));
});

test('stale or missing report is unknown rather than selectable', () => {
  const stale = explainNodePreflight(node({ lastReportAt: '2026-10-20T00:00:00.000Z' }), { protocol: 'tcp', now });
  assert.equal(stale.status, 'unknown');
  assert.equal(stale.facts.status, 'stale');
  assert.ok(stale.reasons.some(reason => reason.code === 'REPORT_STALE'));
  const missing = explainNodePreflight(node({ lastReportAt: null }), { protocol: 'tcp', now });
  assert.equal(missing.status, 'unknown');
  assert.ok(missing.reasons.some(reason => reason.code === 'REPORT_MISSING'));
});

test('missing policy stays unknown and does not invent capabilities', () => {
  const result = explainNodePreflight(node({ policy: null }), { protocol: 'tcp', now });
  assert.equal(result.status, 'unknown');
  assert.deepEqual(result.capabilities, []);
  assert.ok(result.reasons.some(reason => reason.code === 'POLICY_MISSING'));
});

test('summary counts remain separate', () => {
  const rows = [
    explainNodePreflight(node(), { protocol: 'tcp', now }),
    explainNodePreflight(node({ id: 'node-2', revoked: true }), { protocol: 'tcp', now }),
    explainNodePreflight(node({ id: 'node-3', lastReportAt: null }), { protocol: 'tcp', now }),
  ];
  assert.deepEqual(summarizePreflight(rows), { total: 3, supported: 1, unsupported: 1, unknown: 1 });
});
