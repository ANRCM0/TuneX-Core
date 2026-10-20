import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeForwardRecord, summarizeDiagnosticRecord } from '../forward-status.js';

const direct = (overrides = {}) => ({
  desired: { revision: 3, spec: { protocols: ['tcp', 'udp'] }, deleting: false, recoverySuspended: false },
  applied: [{ assignmentId: 'a', nodeId: 'node-1', condition: 'ready' }, { assignmentId: 'b', nodeId: 'node-1', condition: 'ready' }],
  health: { condition: 'ready', receivedAt: '2026-10-20T01:00:00.000Z', freshUntil: '2026-10-20T01:01:00.000Z' },
  lastOperation: { id: 'op-1', kind: 'update', status: 'succeeded', cleanupPending: false, recoveryInvalidated: false },
  ...overrides,
});

test('forward record without evidence stays unknown', () => {
  const summary = summarizeForwardRecord(null);
  assert.equal(summary.state, 'unknown');
  assert.equal(summary.tone, '');
  assert.deepEqual(summary.reasons, ['missing-evidence']);
});

test('ready direct record reports applied protocol count', () => {
  const summary = summarizeForwardRecord(direct(), Date.parse('2026-10-20T01:00:30.000Z'));
  assert.equal(summary.state, 'ready');
  assert.equal(summary.tone, 'good');
  assert.equal(summary.appliedCount, 2);
  assert.equal(summary.expectedCount, 2);
  assert.match(summary.detail, /应用观测 2 \/ 期望协议 2/);
});

test('degraded record is partial and keeps cleanup pending visible', () => {
  const summary = summarizeForwardRecord(direct({
    health: { condition: 'degraded', receivedAt: '2026-10-20T01:00:00.000Z', freshUntil: '2026-10-20T01:01:00.000Z' },
    lastOperation: { id: 'op-2', kind: 'update', status: 'failed', cleanupPending: true, recoveryInvalidated: true },
  }), Date.parse('2026-10-20T01:00:30.000Z'));
  assert.equal(summary.state, 'partial');
  assert.equal(summary.tone, 'progress');
  assert.equal(summary.operation.cleanupPending, true);
  assert.match(summary.detail, /旧资源清理中/);
  assert.match(summary.detail, /恢复已失效/);
});

test('ready condition with missing applied evidence is not reported as fully applied', () => {
  const summary = summarizeForwardRecord(direct({ applied: [{ assignmentId: 'a', nodeId: 'node-1' }] }),
    Date.parse('2026-10-20T01:00:30.000Z'));
  assert.equal(summary.state, 'partial');
  assert.match(summary.detail, /应用观测 1 \/ 期望协议 2/);
});

test('expired freshness is surfaced without converting it to success', () => {
  const summary = summarizeForwardRecord(direct(), Date.parse('2026-10-20T01:02:00.000Z'));
  assert.equal(summary.state, 'unknown');
  assert.match(summary.label, /报告已过期/);
  assert.match(summary.detail, /报告已过期/);
});

test('multi-node record does not use protocol count as a node denominator', () => {
  const summary = summarizeForwardRecord(direct({
    desired: { revision: 4, spec: { protocols: ['tcp'], path: { via: ['node-2'] } }, deleting: false, recoverySuspended: false },
  }), Date.parse('2026-10-20T01:00:30.000Z'));
  assert.equal(summary.expectedCount, null);
  assert.match(summary.detail, /多节点/);
});

test('diagnostic summary keeps operation, listener and probe counts separate', () => {
  const summary = summarizeDiagnosticRecord({
    capturedAt: '2026-10-20T01:00:00.000Z', source: 'persisted-control-and-agent-state',
    consistency: 'read-committed-not-global-snapshot', health: 'unknown',
    intent: { protocols: ['tcp'], path: ['node-1'] },
    operations: { truncated: false, items: [
      { status: 'succeeded', cleanupPending: false, recoveryInvalidated: false },
      { status: 'failed', cleanupPending: true, recoveryInvalidated: false },
    ] },
    deployment: null,
    nodes: [
      { evidence: { revoked: false, sessionCurrent: true, snapshotCurrent: true, observation: { status: 'fresh' } } },
      { evidence: null },
    ],
    listeners: { truncated: false, items: [
      { relation: 'current-intent', reportFresh: true, nodeEvidenceMatches: true, observation: { condition: 'ready' } },
      { relation: 'historical-intent', reportFresh: false, nodeEvidenceMatches: false, observation: { condition: 'error' } },
    ] },
    probe: { truncated: false, historyComplete: false, items: [{ result: { windowOpen: true } }, { result: null }] },
    cleanup: { complete: false, slots: { truncated: false, items: [{}] }, retirements: { truncated: false, items: [] }, leases: { truncated: false, items: [] } },
  });
  assert.equal(summary.operations.failed, 1);
  assert.equal(summary.operations.cleanupPending, 1);
  assert.equal(summary.listeners.current, 1);
  assert.equal(summary.listeners.historical, 1);
  assert.equal(summary.listeners.ready, 1);
  assert.equal(summary.listeners.error, 1);
  assert.equal(summary.probe.withResult, 1);
  assert.equal(summary.probe.windowOpen, 1);
  assert.equal(summary.nodes.fresh, 1);
  assert.equal(summary.nodes.missing, 1);
  assert.equal(summary.partial, true);
  assert.equal(summary.stale, false, 'historical listener freshness is not current-intent staleness');
  assert.equal(summary.unknown, true);
});
