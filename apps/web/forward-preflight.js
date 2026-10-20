const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isArray = value => Array.isArray(value);
const isTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const REPORT_FRESH_MS = 5 * 60 * 1000;
const BASE_CAPABILITIES = ['adp.3', 'native.direct.v1'];

function normalizeProtocol(value) {
  return value === 'tcp' || value === 'udp' ? [value] : value === 'both' ? ['tcp', 'udp'] : [];
}

function reason(code, message) {
  return { code, message };
}

export function explainNodePreflight(node, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const protocols = normalizeProtocol(options.protocol);
  const required = [...BASE_CAPABILITIES, ...protocols];
  const nodeId = typeof node?.id === 'string' ? node.id : 'unknown';
  const policy = isObject(node?.policy) ? node.policy : null;
  const capabilities = isArray(policy?.capabilities) ? policy.capabilities.filter(value => typeof value === 'string') : null;
  const reasons = [];
  let status = 'supported';
  const fail = (code, message) => { reasons.push(reason(code, message)); status = 'unsupported'; };
  const unknown = (code, message) => { reasons.push(reason(code, message)); if (status === 'supported') status = 'unknown'; };

  if (node?.revoked === true) fail('NODE_REVOKED', '节点已撤销');
  if (!node?.credentialUntil) unknown('CREDENTIAL_MISSING', '无有效凭据记录');
  else if (!isTime(node.credentialUntil)) unknown('CREDENTIAL_INVALID', '凭据时间格式无效');
  else if (Date.parse(node.credentialUntil) <= now) fail('CREDENTIAL_EXPIRED', '凭据已过期');

  let facts = { status: 'unknown', reportAgeMs: null, lastReportAt: null };
  if (!node?.lastReportAt) {
    unknown('REPORT_MISSING', '无 Agent 报告时间');
  } else if (!isTime(node.lastReportAt)) {
    unknown('REPORT_INVALID', 'Agent 报告时间格式无效');
  } else {
    const age = Math.max(0, now - Date.parse(node.lastReportAt));
    const fresh = age <= REPORT_FRESH_MS;
    facts = { status: fresh ? 'fresh' : 'stale', reportAgeMs: age, lastReportAt: node.lastReportAt };
    if (!fresh) unknown('REPORT_STALE', 'Agent 报告超过 5 分钟');
  }

  if (!policy) {
    unknown('POLICY_MISSING', '缺少 Node Policy 能力声明');
  } else if (capabilities === null) {
    unknown('CAPABILITIES_MISSING', 'Node Policy 未包含能力数组');
  } else {
    for (const capability of required) {
      if (!capabilities.includes(capability)) fail('CAPABILITY_MISSING', '缺少能力 ' + capability);
    }
  }

  const declared = capabilities ?? [];
  return {
    nodeId,
    status,
    tone: status === 'supported' ? 'good' : status === 'unsupported' ? 'bad' : 'progress',
    label: status === 'supported' ? '可选（声明满足）' : status === 'unsupported' ? '不可选' : '未知 / 需人工确认',
    reasons,
    required,
    capabilities: declared,
    dimensions: {
      platform: 'unknown',
      roles: 'unknown',
      flags: 'unknown',
      facts: facts.status,
    },
    facts,
  };
}

export function summarizePreflight(rows) {
  const items = isArray(rows) ? rows : [];
  return {
    total: items.length,
    supported: items.filter(row => row.status === 'supported').length,
    unsupported: items.filter(row => row.status === 'unsupported').length,
    unknown: items.filter(row => row.status === 'unknown').length,
  };
}
