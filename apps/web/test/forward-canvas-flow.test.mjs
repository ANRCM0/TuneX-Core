import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCanvas, copyCanvas, addCanvasNode, canvasConnectionError, connectCanvasNodes,
  replaceCanvasNode, removeCanvasSelection, canvasChain, canvasIssues, canvasProblems, canvasDraft, canvasMagnet, canvasZoomAt, canvasInsertionPoint } from '../forward-canvas-model.js';

const settings = { name: 'route-a', protocol: 'both', profileId: 'profile-a', profileRevision: 7 };
function chain(middle = true) {
  let graph = emptyCanvas();
  const nodes = [
    { key: 'entry', nodeId: 'a', role: 'ingress', x: 900, y: 450, listenAddress: '127.0.0.1', listenPort: '25565' },
    ...(middle ? [{ key: 'middle', nodeId: 'b', role: 'transit', x: 10, y: 50 }] : []),
    { key: 'exit', nodeId: 'c', role: 'egress', x: 430, y: 280 },
    { key: 'target', nodeId: null, role: 'target', x: 0, y: 0, targetHost: ' game.example ', targetPort: '25565' },
  ];
  for (const node of nodes) graph = addCanvasNode(graph, node);
  for (let i = 0; i < nodes.length - 1; i++) graph = connectCanvasNodes(graph, nodes[i].key, nodes[i + 1].key);
  return graph;
}

test('canvas translates arrow order into the existing path and never sends display coordinates or labels', () => {
  const graph = chain(); graph.nodes[0].label = 'Custom entry';
  const before = copyCanvas(graph), draft = canvasDraft(graph, settings);
  assert.deepEqual(draft, { ...settings, nodes: ['a', 'b', 'c'], listenAddress: '127.0.0.1', listenPort: 25565,
    targetHost: 'game.example', targetPort: 25565 });
  for (const node of graph.nodes) { node.x -= 1200; node.y += 700; }
  assert.deepEqual(canvasDraft(graph, settings), draft);
  assert.deepEqual(canvasChain(before).map(node => node.key), ['entry', 'middle', 'exit', 'target']);
});

test('canvas refuses branches duplicate edges self links and reversals of entry exit and target purposes', () => {
  const graph = chain();
  for (const [from, to] of [['entry', 'entry'], ['entry', 'exit'], ['entry', 'middle'], ['exit', 'middle'], ['middle', 'target'], ['target', 'entry']]) {
    assert.ok(canvasConnectionError(graph, from, to)); assert.throws(() => connectCanvasNodes(graph, from, to));
  }
  assert.equal(graph.edges.length, 3);
  const disconnected = removeCanvasSelection(graph, { kind: 'edge', from: 'entry', to: 'middle' });
  assert.throws(() => canvasDraft(disconnected, settings), /单条链/);
  assert.deepEqual(canvasDraft(connectCanvasNodes(disconnected, 'entry', 'middle'), settings).nodes, ['a', 'b', 'c']);
});

test('transit cycles and malformed externally supplied branching graphs cannot become transfer drafts', () => {
  let graph = addCanvasNode(emptyCanvas(), { key: 'm1', nodeId: 'n1', role: 'transit' });
  graph = addCanvasNode(graph, { key: 'm2', nodeId: 'n2', role: 'transit' });
  graph = connectCanvasNodes(graph, 'm1', 'm2');
  assert.throws(() => connectCanvasNodes(graph, 'm2', 'm1'), /循环/);
  const malformed = chain(); malformed.edges.push({ from: 'entry', to: 'exit' });
  assert.throws(() => canvasDraft(malformed, settings), /分叉/);
});

test('adding resources enforces unique machines and exactly bounded roles without modifying the original graph', () => {
  const graph = chain(), original = copyCanvas(graph);
  assert.throws(() => addCanvasNode(graph, { key: 'other', nodeId: 'a', role: 'transit' }), /同一台机器/);
  assert.throws(() => addCanvasNode(graph, { key: 'other', nodeId: 'other', role: 'ingress' }), /已有入口/);
  let full = graph;
  for (let i = 0; i < 5; i++) full = addCanvasNode(full, { key: 'extra-' + i, nodeId: 'extra-' + i, role: 'transit' });
  assert.equal(full.nodes.length, 9);
  assert.throws(() => addCanvasNode(full, { key: 'overflow', nodeId: 'overflow', role: 'transit' }), /最多/);
  assert.deepEqual(graph, original);
});

test('removing a node removes its incident edges while a copied undo snapshot retains the complete path', () => {
  const graph = chain(), undo = copyCanvas(graph), removed = removeCanvasSelection(graph, { kind: 'node', key: 'middle' });
  assert.deepEqual(removed.edges, [{ from: 'exit', to: 'target' }]);
  assert.throws(() => canvasDraft(removed, settings), /单条链/);
  assert.deepEqual(canvasDraft(undo, settings).nodes, ['a', 'b', 'c']); assert.deepEqual(graph, undo);
});

test('reusable path drafts exclude target and listener parameters and can be saved without a target node', () => {
  let graph = chain(false); graph = removeCanvasSelection(graph, { kind: 'node', key: 'target' });
  delete graph.nodes[0].listenAddress; delete graph.nodes[0].listenPort;
  assert.deepEqual(canvasDraft(graph, settings, { requireTarget: false }), { ...settings, nodes: ['a', 'c'] });
  assert.throws(() => canvasDraft(graph, settings), /业务目标/);
});

test('disconnected nodes stale purpose authorization and changed listener policy prevent a transfer draft', () => {
  const graph = chain();
  assert.throws(() => canvasDraft(graph, settings, { candidate: node => node.nodeId !== 'b' }), /b 的中继用途/);
  assert.throws(() => canvasDraft(graph, settings, { candidate: () => ({ policy: { allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [80] } }) }), /入口监听/);
  const extra = addCanvasNode(graph, { key: 'detached', nodeId: 'd', role: 'transit' });
  assert.throws(() => canvasDraft(extra, settings), /单条链/);
  assert.equal(canvasProblems(graph).length, 0);
});

test('unfinished invalid and out-of-range target or listener values remain untransferable', () => {
  for (const [key, field, value] of [['target', 'targetHost', ' '], ['target', 'targetPort', '65536'], ['target', 'targetPort', '1.5'],
    ['entry', 'listenPort', '0'], ['entry', 'listenAddress', '']]) {
    const graph = chain(); graph.nodes.find(node => node.key === key)[field] = value;
    assert.throws(() => canvasDraft(graph, settings));
  }
});

test('connection magnet uses a screen-space radius at different zoom levels and never silently selects a distant input', () => {
  const graph = removeCanvasSelection(chain(), { kind: 'edge', from: 'entry', to: 'middle' });
  const middle = graph.nodes.find(node => node.key === 'middle');
  for (const zoom of [.2, .6, 1, 1.8]) {
    const hit = canvasMagnet(graph, 'entry', { x: middle.x + 24 / zoom, y: middle.y + 76 }, zoom);
    assert.equal(hit.key, 'middle'); assert.equal(hit.error, '');
    assert.deepEqual(hit.point, { x: middle.x, y: middle.y + 76 });
    assert.equal(canvasMagnet(graph, 'entry', { x: middle.x - 45 / zoom, y: middle.y + 76 }, zoom), null);
  }
});

test('connection magnet reports an invalid purpose without modifying the draft or connecting it', () => {
  const graph = chain(), before = copyCanvas(graph), target = graph.nodes.find(node => node.key === 'target');
  const hit = canvasMagnet(graph, 'middle', { x: target.x, y: target.y + 76 }, 1);
  assert.equal(hit.key, 'target'); assert.match(hit.error, /出口连接业务目标/);
  assert.deepEqual(graph, before);
});

test('zoom preserves the world point beneath the pointer including at its bounded limits', () => {
  const view = { x: -250, y: 120, zoom: .7 }, pointer = { x: 320, y: 240 };
  const original = { x: (pointer.x - view.x) / view.zoom, y: (pointer.y - view.y) / view.zoom };
  for (const factor of [.01, .8, 1.15, 50]) {
    const next = canvasZoomAt(view, factor, pointer);
    assert.ok(next.zoom >= .2 && next.zoom <= 1.8);
    assert.ok(Math.abs((pointer.x - next.x) / next.zoom - original.x) < 1e-8);
    assert.ok(Math.abs((pointer.y - next.y) / next.zoom - original.y) < 1e-8);
  }
  assert.deepEqual(view, { x: -250, y: 120, zoom: .7 });
});

test('adding near the selected node finds a free position without reordering or changing existing nodes', () => {
  const graph = addCanvasNode(chain(), { key: 'occupied', nodeId: 'd', role: 'transit', x: 1225, y: 450 });
  const before = copyCanvas(graph), position = canvasInsertionPoint(graph, { x: 0, y: 0 }, 'entry');
  for (const node of graph.nodes) assert.ok(Math.abs(position.x - node.x) >= 254 || Math.abs(position.y - node.y) >= 176);
  assert.deepEqual(graph, before);
  assert.deepEqual(canvasInsertionPoint(emptyCanvas(), { x: 300, y: 200 }), { x: 185, y: 124 });
});

test('replacing a machine preserves the node identity layout labels edges and original undo snapshot', () => {
  const graph = chain(); graph.nodes[1].label = 'Preferred relay';
  const before = copyCanvas(graph), replaced = replaceCanvasNode(graph, 'middle', { id: 'replacement' });
  assert.deepEqual(replaced.nodes[1], { ...graph.nodes[1], nodeId: 'replacement' });
  assert.deepEqual(replaced.edges, graph.edges);
  assert.deepEqual(canvasDraft(replaced, settings).nodes, ['a', 'replacement', 'c']);
  assert.deepEqual(graph, before);
  assert.throws(() => replaceCanvasNode(graph, 'middle', { id: 'a' }), /同一台机器/);
  assert.throws(() => replaceCanvasNode(graph, 'target', { id: 'd' }), /更换的机器/);
  assert.throws(() => replaceCanvasNode(graph, 'missing', { id: 'd' }), /更换的机器/);
});

test('replacement keeps authorized listener fields individually and clears revoked choices without selecting a new port', () => {
  const graph = chain(), before = copyCanvas(graph);
  for (const [addresses, ports, address, port] of [
    [['127.0.0.1'], [25565], '127.0.0.1', '25565'],
    [['127.0.0.1'], [443], '127.0.0.1', ''],
    [['0.0.0.0'], [25565], '', '25565'],
    [[], [], '', ''],
  ]) {
    const replacement = replaceCanvasNode(graph, 'entry', { id: 'd', policy: { allowedListenerAddresses: addresses, allowedPorts: ports } });
    assert.equal(replacement.nodes[0].listenAddress, address); assert.equal(replacement.nodes[0].listenPort, port);
    assert.deepEqual(replacement.edges, graph.edges);
    if (!address || !port) assert.throws(() => canvasDraft(replacement, settings), /入口监听/);
  }
  assert.deepEqual(graph, before);
});

test('structured issues point to missing roles stale machines and the exact invalid listener or target field', () => {
  assert.equal(canvasIssues(emptyCanvas()).find(issue => issue.id === 'missing-ingress').role, 'ingress');
  const graph = chain(); graph.nodes[0].listenPort = '0'; graph.nodes.at(-1).targetPort = '65536';
  const issues = canvasIssues(graph, { candidate: node => node.nodeId !== 'b' });
  assert.deepEqual(issues.find(issue => issue.id === 'listener'), { id: 'listener', message: '请选择已授权的入口监听地址与端口', key: 'entry', field: 'listenPort' });
  assert.equal(issues.find(issue => issue.id === 'target').field, 'targetPort');
  assert.equal(issues.find(issue => issue.id === 'target').key, 'target');
  assert.equal(issues.find(issue => issue.id === 'access-middle').field, 'resource');
  assert.deepEqual(canvasProblems(graph, { candidate: node => node.nodeId !== 'b' }), issues.map(issue => issue.message));
  assert.equal(canvasIssues(graph, { requireTarget: false }).some(issue => ['listener', 'target'].includes(issue.id)), false);
  const disconnected = removeCanvasSelection(chain(), { kind: 'edge', from: 'entry', to: 'middle' });
  assert.equal(canvasIssues(disconnected).find(issue => issue.id === 'chain').key, 'entry');
});
