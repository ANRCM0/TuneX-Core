export const canvasRoleNames = { ingress: '入口', transit: '中继', egress: '出口', target: '业务目标' };
export const canvasNodeSize = { width: 230, height: 152 };

export function emptyCanvas() { return { nodes: [], edges: [] }; }
export function copyCanvas(value) { return JSON.parse(JSON.stringify(value)); }

export function canvasMagnet(graph, from, point, zoom, radius = 30) {
  let closest = null, distance = radius;
  for (const node of graph.nodes) {
    if (node.key === from || node.role === 'ingress') continue;
    const input = { x: node.x, y: node.y + canvasNodeSize.height / 2 };
    const delta = Math.hypot(input.x - point.x, input.y - point.y) * zoom;
    if (delta <= distance) {
      distance = delta; closest = { key: node.key, point: input, error: canvasConnectionError(graph, from, node.key) };
    }
  }
  return closest;
}

export function canvasZoomAt(view, factor, point) {
  const zoom = Math.max(.2, Math.min(1.8, view.zoom * factor));
  const ratio = zoom / view.zoom;
  return { x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio, zoom };
}

export function canvasInsertionPoint(graph, center, preferredKey) {
  const preferred = graph.nodes.find(node => node.key === preferredKey);
  const { width, height } = canvasNodeSize;
  let x = preferred ? preferred.x + width + 95 : center.x - width / 2;
  let y = preferred ? preferred.y : center.y - height / 2;
  for (let index = 0; index < 20 && graph.nodes.some(node => Math.abs(node.x - x) < width + 24 && Math.abs(node.y - y) < height + 24); index++) {
    y += height + 45;
  }
  return { x: Math.round(x), y: Math.round(y) };
}

export function addCanvasNode(graph, node) {
  if (!Object.hasOwn(canvasRoleNames, node.role) || !node.key || graph.nodes.some(item => item.key === node.key))
    throw Error('节点类型或画布标识无效');
  if (node.role !== 'target' && (!node.nodeId || graph.nodes.some(item => item.nodeId === node.nodeId)))
    throw Error('同一台机器只能在线路中使用一次');
  if (node.role !== 'transit' && graph.nodes.some(item => item.role === node.role))
    throw Error('已有' + canvasRoleNames[node.role] + '，请先移除再替换');
  if (node.role === 'transit' && graph.nodes.filter(item => item.role === 'transit').length >= 6 ||
      node.role !== 'target' && graph.nodes.filter(item => item.role !== 'target').length >= 8)
    throw Error('每条线路最多 8 台不同机器，其中中继最多 6 台');
  const next = copyCanvas(graph); next.nodes.push({ ...node }); return next;
}

export function replaceCanvasNode(graph, key, resource) {
  const current = graph.nodes.find(node => node.key === key);
  if (!current || current.role === 'target' || !resource?.id) throw Error('请选择要更换的机器');
  if (graph.nodes.some(node => node.key !== key && node.nodeId === resource.id)) throw Error('同一台机器只能在线路中使用一次');
  const next = copyCanvas(graph), node = next.nodes.find(item => item.key === key);
  node.nodeId = resource.id;
  if (node.role === 'ingress') {
    // Retain valid choices, but require an explicit choice when the new policy differs.
    if (!resource.policy?.allowedListenerAddresses?.includes(node.listenAddress)) node.listenAddress = '';
    if (!resource.policy?.allowedPorts?.includes(Number(node.listenPort))) node.listenPort = '';
  }
  return next;
}

export function canvasConnectionError(graph, from, to) {
  const source = graph.nodes.find(node => node.key === from), target = graph.nodes.find(node => node.key === to);
  if (!source || !target || from === to) return '请连接两个不同的节点';
  if (source.role === 'target' || target.role === 'ingress') return '业务目标是终点，入口只能作为起点';
  if (source.role === 'egress' && target.role !== 'target' || source.role !== 'egress' && target.role === 'target')
    return '出口连接业务目标；入口和中继连接下一台机器';
  if (graph.edges.some(edge => edge.from === from && edge.to === to)) return '这两个节点已经连接';
  if (graph.edges.some(edge => edge.from === from)) return '这个节点已有下一跳，请先断开原连接';
  if (graph.edges.some(edge => edge.to === to)) return '这个节点已有上一跳，请先断开原连接';
  const visited = new Set(); let cursor = to;
  while (cursor && !visited.has(cursor)) {
    if (cursor === from) return '不能形成循环转发';
    visited.add(cursor); cursor = graph.edges.find(edge => edge.from === cursor)?.to;
  }
  return '';
}

export function connectCanvasNodes(graph, from, to) {
  const error = canvasConnectionError(graph, from, to); if (error) throw Error(error);
  const next = copyCanvas(graph); next.edges.push({ from, to }); return next;
}

export function removeCanvasSelection(graph, selection) {
  const next = copyCanvas(graph);
  if (selection?.kind === 'node') {
    next.nodes = next.nodes.filter(node => node.key !== selection.key);
    next.edges = next.edges.filter(edge => edge.from !== selection.key && edge.to !== selection.key);
  } else if (selection?.kind === 'edge') {
    next.edges = next.edges.filter(edge => edge.from !== selection.from || edge.to !== selection.to);
  }
  return next;
}

export function canvasChain(graph) {
  const chain = [], seen = new Set(); let current = graph.nodes.find(node => node.role === 'ingress');
  while (current && !seen.has(current.key)) {
    chain.push(current); seen.add(current.key);
    const edge = graph.edges.find(item => item.from === current.key);
    current = edge ? graph.nodes.find(node => node.key === edge.to) : null;
  }
  return chain;
}

export function canvasIssues(graph, { requireTarget = true, candidate = () => true } = {}) {
  const problems = [], counts = role => graph.nodes.filter(node => node.role === role).length;
  const add = (id, message, location = {}) => problems.push({ id, message, ...location });
  for (const role of ['ingress', 'egress', ...(requireTarget ? ['target'] : [])])
    if (counts(role) !== 1) add('missing-' + role, '请添加一个' + canvasRoleNames[role], { role });
  if (graph.nodes.length > 9 || counts('transit') > 6 || graph.nodes.filter(node => node.role !== 'target').length > 8)
    add('capacity', '每条线路最多 8 台机器和 1 个业务目标');
  const ids = graph.nodes.filter(node => node.role !== 'target').map(node => node.nodeId);
  if (new Set(ids).size !== ids.length) add('duplicate', '线路中不能重复使用同一台机器');
  const used = new Set();
  for (const edge of graph.edges) {
    const otherEdges = graph.edges.filter(item => item !== edge);
    const error = canvasConnectionError({ nodes: graph.nodes, edges: otherEdges }, edge.from, edge.to);
    if (error || used.has(edge.from + '\n' + edge.to)) { add('connection', '请检查重复、分叉或循环连接', { key: edge.from, edge: { ...edge } }); break; }
    used.add(edge.from + '\n' + edge.to);
  }
  const chain = canvasChain(graph), machineChain = chain.filter(node => node.role !== 'target');
  if (chain.length !== graph.nodes.length || graph.edges.length !== Math.max(0, graph.nodes.length - 1) ||
      machineChain.length < 2 || machineChain[0]?.role !== 'ingress' || machineChain.at(-1)?.role !== 'egress' ||
      machineChain.slice(1, -1).some(node => node.role !== 'transit') ||
      counts('target') && chain.at(-1)?.role !== 'target')
    add('chain', '把所有节点连成“入口 → 中继（可选）→ 出口 → 业务目标”的单条链',
      { key: (chain.at(-1)?.role !== 'target' ? chain.at(-1) : graph.nodes.find(node => !chain.includes(node)))?.key });
  for (const node of graph.nodes.filter(node => node.role !== 'target'))
    if (!candidate(node)) add('access-' + node.key, node.nodeId + ' 的' + canvasRoleNames[node.role] + '用途需重新读取或授权', { key: node.key, field: 'resource' });
  if (requireTarget) {
    const ingress = graph.nodes.find(node => node.role === 'ingress'), target = graph.nodes.find(node => node.role === 'target');
    const port = value => /^[1-9][0-9]{0,4}$/.test(String(value)) && Number(value) <= 65535;
    if (ingress && (!ingress.listenAddress || !port(ingress.listenPort))) add('listener', '请选择已授权的入口监听地址与端口',
      { key: ingress.key, field: !ingress.listenAddress ? 'listenAddress' : 'listenPort' });
    const currentIngress = ingress && candidate(ingress);
    if (currentIngress?.policy && (!currentIngress.policy.allowedListenerAddresses?.includes(ingress.listenAddress) ||
        !currentIngress.policy.allowedPorts?.includes(Number(ingress.listenPort))))
      add('listener-policy', '入口监听已不在当前授权中，请重新选择监听地址与端口',
        { key: ingress.key, field: !currentIngress.policy.allowedListenerAddresses?.includes(ingress.listenAddress) ? 'listenAddress' : 'listenPort' });
    if (target && (!target.targetHost?.trim() || target.targetHost.trim().length > 253 || !port(target.targetPort)))
      add('target', '请填写业务目标主机与 1–65535 的端口',
        { key: target.key, field: !target.targetHost?.trim() || target.targetHost.trim().length > 253 ? 'targetHost' : 'targetPort' });
  }
  return problems;
}

export function canvasProblems(graph, options) {
  return [...new Set(canvasIssues(graph, options).map(issue => issue.message))];
}

export function canvasDraft(graph, settings, options = {}) {
  const problems = canvasProblems(graph, options); if (problems.length) throw Error(problems.join('；'));
  const chain = canvasChain(graph), ingress = chain[0], target = chain.find(node => node.role === 'target');
  const draft = { ...settings, nodes: chain.filter(node => node.role !== 'target').map(node => node.nodeId) };
  if (options.requireTarget !== false) Object.assign(draft, {
    listenAddress: ingress.listenAddress, listenPort: Number(ingress.listenPort),
    targetHost: target.targetHost.trim(), targetPort: Number(target.targetPort),
  });
  return draft;
}
