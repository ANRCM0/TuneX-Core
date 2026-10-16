// Pure browser/Node helpers. They intentionally contain no credential persistence.
export function validScope(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}
export function parsePorts(value) {
  const values = String(value).split(',').map(v => v.trim()).filter(Boolean);
  if (!values.length || values.length > 65535) throw new Error('请填写一个或多个有效端口');
  const ports = values.map(v => {
    if (!/^[1-9][0-9]*$/.test(v) || Number(v) > 65535) throw new Error('端口必须为 1–65535 的整数');
    return Number(v);
  });
  if (new Set(ports).size !== ports.length) throw new Error('端口不能重复');
  return ports;
}
export function parseCidrs(value) {
  const values = String(value).split(',').map(v => v.trim()).filter(Boolean);
  if (!values.length || values.length > 256 || new Set(values).size !== values.length) throw new Error('请填写不重复的目标 CIDR');
  // Control validates canonical CIDR and prohibited policies. No local acceptance bypass.
  return values;
}
export function directCapable(node) {
  const capabilities = node?.policy?.capabilities;
  return !node?.revoked && Array.isArray(capabilities) && ['adp.3', 'native.direct.v1'].every(c => capabilities.includes(c)) &&
    Array.isArray(node.policy.allowedListenerAddresses) && node.policy.allowedListenerAddresses.length > 0 &&
    Array.isArray(node.policy.allowedPorts) && node.policy.allowedPorts.length > 0 &&
    (node.credentialUntil === undefined || Date.parse(node.credentialUntil) > Date.now());
}
export function allowedProtocols(node) {
  const supported = Array.isArray(node?.policy?.capabilities) ? node.policy.capabilities : [];
  return ['tcp', 'udp', 'both'].filter(p => p === 'both' ? supported.includes('tcp') && supported.includes('udp') : supported.includes(p));
}
export function directSpec(form, node) {
  if (!directCapable(node)) throw new Error('所选节点不满足 Direct 执行能力或授权要求');
  const protocol = String(form.protocol);
  if (!allowedProtocols(node).includes(protocol)) throw new Error('节点不支持所选协议');
  const listen = String(form.listenAddress);
  const listenPort = Number(form.listenPort);
  const targetPort = Number(form.targetPort);
  const host = String(form.targetHost).trim();
  if (!node.policy.allowedListenerAddresses.includes(listen) || !node.policy.allowedPorts.includes(listenPort)) throw new Error('监听地址或端口未获节点授权');
  if (!Number.isInteger(targetPort) || targetPort < 1 || targetPort > 65535 || !host || host.length > 253) throw new Error('请填写有效的目标主机和端口');
  return {
    enabled: Boolean(form.enabled),
    protocols: protocol === 'both' ? ['tcp', 'udp'] : [protocol],
    ingress: { nodeId: node.id, listen: { address: listen, port: listenPort } },
    target: { host, port: targetPort }
  };
}
export function stateTone(value) {
  const status = String(value ?? '').toLowerCase();
  if (['succeeded', 'ready'].includes(status)) return 'good';
  if (['failed', 'error', 'superseded', 'revoked'].includes(status)) return 'bad';
  if (['running', 'accepted', 'pending', 'degraded', 'draining'].includes(status)) return 'progress';
  return '';
}
export function pageCount(total, limit) { return Math.max(1, Math.ceil(total / limit)); }
export function listResource(kind, page, filters = {}) {
  if (!['nodes', 'forwards', 'operations', 'nodes/candidates'].includes(kind) || !Number.isSafeInteger(page) || page < 1 || page > 10000)
    throw new Error('查询页码超出允许范围');
  const query = new URLSearchParams({ page: String(page), limit: '25' });
  for (const [key, value] of Object.entries(filters)) if (value !== '') query.set(key, String(value));
  return kind + '?' + query;
}
/** Keep only this page and revalidated selections, never accumulate every visited page. */
export function candidateChoices(items, selectedIds, selectedItems) {
  if (items.length > 25 || selectedIds.length > 9) throw new Error('节点候选超过查询上限');
  const pinned = new Set(selectedIds), result = new Map();
  for (const node of items) if (!pinned.has(node.id)) result.set(node.id, node);
  for (const node of selectedItems) if (pinned.has(node.id)) result.set(node.id, node);
  return [...result.values()];
}
