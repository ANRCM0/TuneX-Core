const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isArray = value => Array.isArray(value);
const isTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item && item[key];
    if (typeof value === 'string') counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function operationSummary(operations) {
  const items = isArray(operations?.items) ? operations.items : [];
  const statuses = countBy(items, 'status');
  return {
    total: items.length,
    accepted: statuses.accepted ?? 0,
    running: statuses.running ?? 0,
    succeeded: statuses.succeeded ?? 0,
    failed: statuses.failed ?? 0,
    superseded: statuses.superseded ?? 0,
    cleanupPending: items.filter(item => item?.cleanupPending === true).length,
    recoveryInvalidated: items.filter(item => item?.recoveryInvalidated === true).length,
    truncated: operations?.truncated === true,
  };
}

export function summarizeForwardRecord(record, now = Date.now()) {
  if (!isObject(record) || !isObject(record.desired) || !isObject(record.health)) {
    return {
      state: 'unknown', tone: '', label: '未知 / 无记录', detail: '响应缺少期望或运行证据；不推导成功、零或健康。',
      appliedCount: 0, expectedCount: null, operation: null, receivedAt: null, freshUntil: null, reasons: ['missing-evidence'],
    };
  }
  const desired = record.desired;
  const spec = isObject(desired.spec) ? desired.spec : {};
  const protocols = isArray(spec.protocols) ? spec.protocols.filter(value => value === 'tcp' || value === 'udp') : [];
  const applied = isArray(record.applied) ? record.applied : [];
  const health = record.health;
  const operation = isObject(record.lastOperation) ? {
    status: typeof record.lastOperation.status === 'string' ? record.lastOperation.status : 'unknown',
    cleanupPending: record.lastOperation.cleanupPending === true,
    recoveryInvalidated: record.lastOperation.recoveryInvalidated === true,
  } : null;
  const reasons = [];
  if (desired.deleting === true) reasons.push('删除中');
  if (desired.recoverySuspended === true) reasons.push('恢复挂起');
  if (operation?.cleanupPending) reasons.push('旧资源清理中');
  if (operation?.recoveryInvalidated) reasons.push('恢复已失效');
  if (operation && (operation.status === 'failed' || operation.status === 'superseded')) reasons.push('Operation ' + operation.status);
  if (!isTime(health.receivedAt)) reasons.push('无报告时间');
  if (isTime(health.freshUntil) && Date.parse(health.freshUntil) <= now) reasons.push('报告已过期');

  const multiNode = isObject(spec.path) && isArray(spec.path.via);
  const expectedCount = multiNode ? null : protocols.length || null;
  const expired = isTime(health.freshUntil) && Date.parse(health.freshUntil) <= now;
  const reportStale = expired || !isTime(health.receivedAt);
  let state = 'unknown';
  let tone = '';
  let label = '未知 / 无新鲜证据';
  if (reportStale) {
    label = expired ? '未知 / 报告已过期' : '未知 / 无报告时间';
  } else if (health.condition === 'ready') {
    if (expectedCount !== null && applied.length < expectedCount) {
      state = 'partial'; tone = 'progress'; label = '部分证据 / 未覆盖全部协议';
    } else {
      state = 'ready'; tone = 'good'; label = '已应用 / 报告新鲜';
    }
  } else if (health.condition === 'degraded') {
    state = 'partial'; tone = 'progress'; label = '部分应用 / 有失败或缺口';
  } else if (health.condition === 'unknown') {
    label = '未知 / 无新鲜报告';
  } else {
    reasons.push('未知健康条件');
  }
  const evidence = expectedCount === null
    ? '应用观测 ' + applied.length + ' 条（多节点，不以单节点协议数作分母）'
    : '应用观测 ' + applied.length + ' / 期望协议 ' + expectedCount;
  return {
    state, tone, label,
    detail: evidence + (reasons.length ? ' · ' + reasons.join(' · ') : ''),
    appliedCount: applied.length, expectedCount, operation,
    receivedAt: isTime(health.receivedAt) ? health.receivedAt : null,
    freshUntil: isTime(health.freshUntil) ? health.freshUntil : null,
    reasons,
  };
}

export function summarizeDiagnosticRecord(data) {
  if (!isObject(data) || !isObject(data.intent)) {
    return {
      capturedAt: null, mode: 'unknown', partial: true, stale: true, unknown: true,
      operations: operationSummary(null), deployment: null, nodes: null, listeners: null,
      probe: null, cleanup: null,
      note: '诊断响应缺少意图；不推导成功、零或健康。',
    };
  }
  const mode = typeof data.intent.mode === 'string' ? data.intent.mode : 'unknown';
  const operations = operationSummary(data.operations);
  const deployment = isObject(data.deployment) ? {
    stage: typeof data.deployment.stage === 'string' ? data.deployment.stage : 'unknown',
    matchesIntent: data.deployment.matchesIntent === true,
    authorizationUntil: isTime(data.deployment.authorizationUntil) ? data.deployment.authorizationUntil : null,
  } : null;
  const nodes = isArray(data.nodes) ? data.nodes : [];
  const nodeEvidence = nodes.map(node => isObject(node?.evidence) ? node.evidence : null);
  const nodeObservations = nodeEvidence.map(evidence => evidence?.observation?.status ?? 'unknown');
  const nodeCounts = countBy(nodeObservations.map(status => ({ status })), 'status');
  const nodeSummary = {
    total: nodes.length,
    fresh: nodeCounts.fresh ?? 0,
    stale: nodeCounts.stale ?? 0,
    unknown: nodeCounts.unknown ?? 0,
    missing: nodeEvidence.filter(evidence => evidence === null).length,
    revoked: nodeEvidence.filter(evidence => evidence?.revoked === true).length,
    currentSession: nodeEvidence.filter(evidence => evidence?.sessionCurrent === true).length,
    currentSnapshot: nodeEvidence.filter(evidence => evidence?.snapshotCurrent === true).length,
  };
  const listeners = isArray(data.listeners?.items) ? data.listeners.items : [];
  const listenerCounts = countBy(listeners, 'relation');
  const conditions = countBy(listeners.map(row => ({ condition: row?.observation?.condition ?? 'unknown' })), 'condition');
  const listenerSummary = {
    total: listeners.length,
    current: listenerCounts['current-intent'] ?? 0,
    historical: listenerCounts['historical-intent'] ?? 0,
    reportFresh: listeners.filter(row => row?.reportFresh === true).length,
    currentReportFresh: listeners.filter(row => row?.relation === 'current-intent' && row?.reportFresh === true).length,
    nodeEvidenceMatches: listeners.filter(row => row?.nodeEvidenceMatches === true).length,
    ready: conditions.ready ?? 0,
    degraded: conditions.degraded ?? 0,
    error: conditions.error ?? 0,
    unknown: conditions.unknown ?? 0,
    truncated: data.listeners?.truncated === true,
  };
  const probes = isArray(data.probe?.items) ? data.probe.items : [];
  const probeSummary = {
    total: probes.length,
    withResult: probes.filter(row => row?.result !== null && row?.result !== undefined).length,
    windowOpen: probes.filter(row => row?.result?.windowOpen === true).length,
    truncated: data.probe?.truncated === true,
    historyComplete: data.probe?.historyComplete === true,
  };
  const cleanup = isObject(data.cleanup) ? {
    complete: data.cleanup.complete === true,
    slots: isArray(data.cleanup.slots?.items) ? data.cleanup.slots.items.length : 0,
    retirements: isArray(data.cleanup.retirements?.items) ? data.cleanup.retirements.items.length : 0,
    leases: isArray(data.cleanup.leases?.items) ? data.cleanup.leases.items.length : 0,
    slotsTruncated: data.cleanup.slots?.truncated === true,
    retirementsTruncated: data.cleanup.retirements?.truncated === true,
    leasesTruncated: data.cleanup.leases?.truncated === true,
  } : null;
  const partial = operations.truncated || operations.failed > 0 || operations.cleanupPending > 0 ||
    listenerSummary.truncated || listenerSummary.degraded + listenerSummary.error > 0 || probeSummary.truncated;
  const stale = nodeSummary.stale > 0 || listenerSummary.currentReportFresh < listenerSummary.current;
  const unknown = nodeSummary.unknown > 0 || nodeSummary.missing > 0 || listenerSummary.unknown > 0 ||
    (mode !== 'direct' && deployment === null);
  return {
    capturedAt: isTime(data.capturedAt) ? data.capturedAt : null,
    mode,
    source: typeof data.source === 'string' ? data.source : 'unknown',
    consistency: typeof data.consistency === 'string' ? data.consistency : 'unknown',
    health: typeof data.health === 'string' ? data.health : 'unknown',
    operations, deployment, nodes: nodeSummary, listeners: listenerSummary, probe: probeSummary, cleanup,
    partial, stale, unknown,
    note: '计数来自同次只读投影；Operation、Applied 证据、Listener 发布元组和 Probe 结果分别显示，任何一项都不能单独证明端到端健康。',
  };
}
