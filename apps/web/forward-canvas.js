import { canvasRoleNames, canvasNodeSize, canvasMagnet, canvasZoomAt, canvasInsertionPoint, emptyCanvas, copyCanvas, addCanvasNode, canvasConnectionError,
  connectCanvasNodes, replaceCanvasNode, removeCanvasSelection, canvasChain, canvasIssues, canvasProblems, canvasDraft } from './forward-canvas-model.js';

export function initForwardCanvas({ byId, notify, candidates, candidate, readSettings, onChange }) {
  const el = name => byId('line-canvas' + (name ? '-' + name : ''));
  const root = el('');
  if (!root?.tagName) return null;
  const { width, height } = canvasNodeSize, svgNS = 'http://www.w3.org/2000/svg';
  let graph = emptyCanvas(), selection = null, tab = 'node', pickerRole = 'ingress', serial = 0;
  let busy = false, session = 0, drag = null, wire = null, past = [], future = [];
  let view = { x: 0, y: 0, zoom: 1 };
  let paintFrame = null, paintFlags = {}, cameraFrame = null, cameraTarget = null, editGroup = null, pinch = null, spaceHeld = false;
  const nodeViews = new Map(), edgeViews = new Map(), touches = new Map(), progressViews = [];
  let pendingPath = null, lastViewport = null;
  let replacingKey = null, focused = false, focusReturn = null, inertElements = [];
  const defaultHint = '滚轮缩放 · Shift + 滚轮平移 · 双指缩放';
  const nodeByKey = key => graph.nodes.find(node => node.key === key);
  const available = node => candidate(node.role, node.nodeId);
  function element(tag, text, className) {
    const item = document.createElement(tag); if (text !== undefined) item.textContent = text;
    if (className) item.className = className; return item;
  }
  function button(text, action, className = 'secondary') {
    const item = element('button', text, className); item.type = 'button'; item.disabled = busy;
    item.addEventListener('click', action); return item;
  }
  function svg(tag, attributes) {
    const item = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attributes)) item.setAttribute(key, String(value)); return item;
  }
  function remember(before, selected = selection) {
    past.push({ graph: copyCanvas(before), selection: selected ? { ...selected } : null });
    if (past.length > 50) past.shift(); future = []; editGroup = null;
  }
  function paint() {
    const flags = paintFlags; paintFlags = {}; paintFrame = null;
    if (flags.nodes) renderNodes();
    else if (flags.positions) for (const node of graph.nodes) {
      const card = nodeViews.get(node.key)?.card; if (card) card.style.transform = `translate3d(${node.x}px,${node.y}px,0)`;
    }
    if (flags.edges) renderEdges(); if (flags.view) transform(); if (flags.status) renderStatus();
  }
  function schedulePaint(flags) {
    Object.assign(paintFlags, flags);
    if (paintFrame === null) {
      const version = session;
      paintFrame = requestAnimationFrame(() => { if (version === session) paint(); });
    }
  }
  function flushPaint() { if (paintFrame !== null) cancelAnimationFrame(paintFrame); paint(); }
  function stopCamera() { if (cameraFrame !== null) cancelAnimationFrame(cameraFrame); cameraFrame = null; cameraTarget = null; root.classList.remove('camera-moving'); }
  function moveCamera(target, animate = false) {
    stopCamera();
    if (!animate || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { view = target; schedulePaint({ view: true }); return; }
    const start = { ...view }, version = session; let started = null;
    cameraTarget = target;
    root.classList.add('camera-moving');
    const frame = now => {
      if (version !== session) return;
      started ??= now; const progress = Math.min(1, (now - started) / 180), ease = 1 - (1 - progress) ** 3;
      view = { x: start.x + (target.x - start.x) * ease, y: start.y + (target.y - start.y) * ease, zoom: start.zoom + (target.zoom - start.zoom) * ease };
      transform(); cameraFrame = progress < 1 ? requestAnimationFrame(frame) : null;
      if (progress === 1) { cameraTarget = null; root.classList.remove('camera-moving'); }
    };
    cameraFrame = requestAnimationFrame(frame);
  }
  function gestureHint(message = defaultHint) {
    if (el('gesture-status').textContent !== message) el('gesture-status').textContent = message;
  }
  function change(next, selected = selection) {
    if (busy) return;
    remember(graph); graph = next; selection = selected; render(); onChange();
  }
  function undo(redo = false) {
    if (busy) return; cancelGesture();
    const source = redo ? future : past, destination = redo ? past : future;
    if (!source.length) return;
    destination.push({ graph: copyCanvas(graph), selection: selection ? { ...selection } : null });
    const snapshot = source.pop(); graph = snapshot.graph; selection = snapshot.selection; editGroup = null;
    if (selection?.kind === 'node' && !nodeByKey(selection.key)) selection = null;
    render(); if (selection?.kind === 'node') reveal(nodeByKey(selection.key)); onChange();
  }
  function select(value, open = false) {
    commitField();
    editGroup = null; selection = value; tab = 'node'; renderSelection(); renderInspector();
    if (open) el('inspector').classList.add('open');
  }
  function renderSelection() {
    for (const card of el('nodes').children) card.classList.toggle('selected', selection?.kind === 'node' && card.dataset.canvasNode === selection.key);
    renderEdges();
  }
  function point(node, outgoing) { return { x: node.x + (outgoing ? width : 0), y: node.y + height / 2 }; }
  function curve(from, to) {
    const bend = Math.max(55, Math.abs(to.x - from.x) * .5);
    return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
  }
  function renderEdges() {
    const wires = el('wires'), retained = new Set();
    if (!pendingPath) {
      wires.setAttribute('viewBox', '-4000 -4000 8000 8000');
      const defs = svg('defs', {}), marker = svg('marker', { id: 'line-canvas-arrow', markerWidth: 9, markerHeight: 9, refX: 7, refY: 4.5, orient: 'auto' });
      marker.append(svg('path', { d: 'M 1 1 L 7 4.5 L 1 8', fill: 'none', stroke: '#8ba2c2', 'stroke-width': 1.4 }));
      defs.append(marker); pendingPath = svg('path', { class: 'fc-edge pending', visibility: 'hidden' }); wires.append(defs, pendingPath);
    }
    for (const edge of graph.edges) {
      const from = nodeByKey(edge.from), to = nodeByKey(edge.to); if (!from || !to) continue;
      const key = edge.from + ':' + edge.to; retained.add(key);
      let parts = edgeViews.get(key);
      if (!parts) {
        const group = svg('g', {}), hit = svg('path', { class: 'fc-edge-hit' });
        hit.dataset.canvasFrom = edge.from; hit.dataset.canvasTo = edge.to;
        const line = svg('path', { class: 'fc-edge', 'marker-end': 'url(#line-canvas-arrow)' });
        const text = svg('text', { 'text-anchor': 'middle', class: 'fc-edge-label' });
        group.append(hit, line, text); wires.insertBefore(group, pendingPath); parts = { group, hit, line, text }; edgeViews.set(key, parts);
      }
      const selected = selection?.kind === 'edge' && selection.from === edge.from && selection.to === edge.to;
      const path = curve(point(from, true), point(to, false));
      parts.hit.setAttribute('d', path); parts.line.setAttribute('d', path); parts.line.classList.toggle('selected', selected);
      parts.text.setAttribute('x', String((from.x + width + to.x) / 2)); parts.text.setAttribute('y', String((from.y + to.y + height) / 2 - 10));
      parts.text.textContent = to.role === 'target' ? '业务转发' : '节点间传输';
    }
    for (const [key, parts] of edgeViews) if (!retained.has(key)) { parts.group.remove(); edgeViews.delete(key); }
    const source = wire && nodeByKey(wire.from);
    pendingPath.setAttribute('visibility', source ? 'visible' : 'hidden');
    if (source) {
      pendingPath.setAttribute('d', curve(point(source, true), wire.point));
      pendingPath.classList.toggle('invalid', !!wire.error); pendingPath.classList.toggle('snapped', !!wire.to && !wire.error);
    }
    for (const [key, parts] of nodeViews) {
      const incoming = parts.incoming; if (!incoming) continue;
      incoming.classList.toggle('connectable', !!wire && key !== wire.from && !canvasConnectionError(graph, wire.from, key));
      incoming.classList.toggle('connection-target', wire?.to === key && !wire.error);
      incoming.classList.toggle('connection-blocked', wire?.to === key && !!wire.error);
    }
  }
  function renderNodes() {
    el('empty').hidden = graph.nodes.length > 0; const retained = new Set();
    const issues = canvasIssues(graph, { candidate: available });
    for (const node of graph.nodes) {
      retained.add(node.key); let parts = nodeViews.get(node.key);
      if (!parts) {
        const card = element('article', undefined, 'fc-node ' + node.role);
        card.dataset.canvasNode = node.key; card.tabIndex = 0;
        const top = element('div', undefined, 'fc-node-top'), source = element('span', '', 'fc-node-source');
        top.append(element('span', node.role === 'target' ? '◎' : '▣', 'fc-node-symbol'), source);
        const title = element('strong', '', 'fc-node-name'), detail = element('span', '', 'fc-node-detail');
        const footer = element('div', undefined, 'fc-node-footer'), status = element('span', ''); footer.append(element('span', canvasRoleNames[node.role]), status);
        card.append(top, title, detail, footer); parts = { card, source, title, detail, status };
        for (const outgoing of node.role === 'ingress' ? [true] : node.role === 'target' ? [false] : [false, true]) {
          const port = element('button', '', 'fc-port ' + (outgoing ? 'out' : 'in')); port.type = 'button';
          port.dataset[outgoing ? 'canvasOut' : 'canvasIn'] = node.key;
          port.title = outgoing ? '拖向下一节点，靠近左侧连接点时吸附；也可依次点击连接点' : '将上一跳连线拖到这里';
          card.append(port); parts[outgoing ? 'outgoing' : 'incoming'] = port;
        }
        nodeViews.set(node.key, parts); el('nodes').append(card);
      }
      const { card, title } = parts;
      card.setAttribute('aria-label', canvasRoleNames[node.role] + ' ' + (node.label || node.nodeId || '业务目标'));
      card.style.transform = `translate3d(${node.x}px,${node.y}px,0)`;
      card.classList.toggle('selected', selection?.kind === 'node' && selection.key === node.key);
      const issue = issues.find(item => item.key === node.key && item.field);
      card.classList.toggle('needs-attention', !!issue); card.title = issue?.message || '';
      const source = node.role === 'target' ? null : candidate(node.role, node.nodeId);
      parts.source.textContent = node.role === 'target' ? '业务地址' : source?.resourceSource === 'private' ? '我的机器' : source ? '共享资源' : '待重新核对';
      title.textContent = node.label || node.nodeId || '业务目标'; title.title = title.textContent;
      parts.detail.textContent = node.role === 'target' ? (node.targetHost || '点击填写目标地址') + (node.targetPort ? ':' + node.targetPort : '') : node.nodeId;
      parts.status.textContent = node.role === 'ingress' ? (node.listenPort ? '端口 ' + node.listenPort : '待选监听') : node.role === 'target' ? '终点' : source ? '候选资源' : '授权待核对';
      for (const outgoing of [true, false]) {
        const port = parts[outgoing ? 'outgoing' : 'incoming']; if (!port) continue; port.disabled = busy;
        port.setAttribute('aria-label', (outgoing ? '从此节点连接下一跳：' : '连接到此节点：') + title.textContent);
      }
    }
    for (const [key, parts] of nodeViews) if (!retained.has(key)) { parts.card.remove(); nodeViews.delete(key); }
  }
  function field(label, name, value, choices = null, attributes = {}) {
    const wrap = element('label', label), input = element(choices ? 'select' : 'input');
    input.dataset.canvasField = name; input.disabled = busy;
    if (choices) {
      const empty = element('option', '请选择'); empty.value = ''; input.append(empty);
      for (const choice of choices) { const option = element('option', String(choice)); option.value = String(choice); input.append(option); }
    }
    for (const [key, content] of Object.entries(attributes)) input.setAttribute(key, String(content));
    input.value = String(value ?? ''); wrap.append(input); return wrap;
  }
  function remove() {
    if (busy || !selection) return;
    change(removeCanvasSelection(graph, selection), null); cancelWire(); notify('已从草稿移除，可撤销恢复');
  }
  function renderInspector() {
    const panel = el('node-settings'); panel.replaceChildren();
    panel.hidden = tab !== 'node'; el('route-settings').hidden = tab !== 'route';
    el('tab-node').setAttribute('aria-pressed', String(tab === 'node')); el('tab-route').setAttribute('aria-pressed', String(tab === 'route'));
    if (tab !== 'node') return;
    if (!selection) {
      panel.append(element('h4', '选择节点或连线'), element('p', '点击节点配置参数，点击连线可以断开。位置只影响排版。', 'hint'));
      const steps = element('ol', undefined, 'fc-route-list');
      for (const node of canvasChain(graph)) { const row = element('li'); row.append(button(canvasRoleNames[node.role] + ' · ' + (node.label || node.nodeId || '业务目标'), () => select({ kind: 'node', key: node.key }, true))); steps.append(row); }
      panel.append(steps, element('p', '键盘：方向键移动节点，Delete 删除选中项，Ctrl+Z 撤销。', 'hint')); return;
    }
    if (selection.kind === 'edge') {
      const from = nodeByKey(selection.from), to = nodeByKey(selection.to);
      panel.append(element('h4', '连接设置'), element('p', (from?.label || from?.nodeId) + ' → ' + (to?.label || to?.nodeId || '业务目标'), 'fc-edge-description'),
        element('p', '这条箭头决定下一跳；断开后可重新拉线。', 'hint'), button('断开这条连接', remove, 'secondary fc-remove')); return;
    }
    const node = nodeByKey(selection.key); if (!node) return;
    panel.append(element('h4', canvasRoleNames[node.role] + '配置'), field('显示名称（仅画布）', 'label', node.label || '', null, { maxlength: 80, placeholder: node.nodeId || '业务目标' }));
    if (node.role !== 'target') {
      panel.append(element('p', node.nodeId, 'fc-resource-id'));
      const replace = button('更换这台机器', () => openPicker(node.role, node.key)); replace.dataset.canvasReplace = node.key;
      panel.append(replace, element('p', '保留名称、位置和连线；监听参数会重新核对新机器的授权。', 'hint'));
      if (!available(node)) panel.append(element('p', '当前用途尚未重新核对，请读取线路资源或更换机器。', 'fc-warning'));
    }
    if (node.role === 'ingress') {
      const policy = candidate(node.role, node.nodeId)?.policy;
      panel.append(field('入口监听地址', 'listenAddress', node.listenAddress, policy?.allowedListenerAddresses ?? []),
        field('入口监听端口', 'listenPort', node.listenPort, policy?.allowedPorts ?? []),
        element('p', '仅列出这台入口当前获准的监听地址和端口。', 'hint'));
    }
    if (node.role === 'target') panel.append(
      field('业务目标主机 / IP', 'targetHost', node.targetHost, null, { maxlength: 253, autocomplete: 'off', placeholder: '出口可达的目标地址' }),
      field('目标端口', 'targetPort', node.targetPort, null, { type: 'number', min: 1, max: 65535 }),
      element('p', '目标是业务地址，不是另一台 Agent。目标范围仍由部署预览核对。', 'hint'));
    if (node.role !== 'target') {
      const destinations = graph.nodes.filter(item => !canvasConnectionError(graph, node.key, item.key));
      const label = element('label', '连接到下一跳'), select = element('select'); select.disabled = busy || !destinations.length;
      const empty = element('option', destinations.length ? '选择画布上的节点' : '暂无可连接节点'); empty.value = ''; select.append(empty);
      for (const destination of destinations) { const option = element('option', canvasRoleNames[destination.role] + ' · ' + (destination.label || destination.nodeId || '业务目标')); option.value = destination.key; select.append(option); }
      const connectButton = button('连接下一跳', () => { if (select.value) connect(node.key, select.value); });
      connectButton.disabled = busy || !destinations.length;
      label.append(select); panel.append(label, connectButton);
    }
    panel.append(button('从画布移除', remove, 'secondary fc-remove'));
  }
  function renderStatus() {
    const problems = allIssues().map(issue => issue.message), ordered = canvasChain(graph);
    el('state').textContent = !graph.nodes.length ? '草稿为空' : problems.length ? '待完善 · ' + problems.length + ' 项' : '草稿结构完整';
    el('state').className = problems.length ? 'fc-status' : 'fc-status complete';
    el('state').title = problems.join('\n') || '仅表示草稿结构完整；实际部署需重新预览';
    el('chain').textContent = ordered.map(node => node.label || node.nodeId || '业务目标').join(' → ');
    el('undo').disabled = busy || !past.length; el('redo').disabled = busy || !future.length;
    el('clear').disabled = busy || !graph.nodes.length; el('layout').disabled = busy || !graph.nodes.length;
    el('issues').hidden = !problems.length; el('issues').disabled = busy;
    el('issues').textContent = '查看待完善项（' + problems.length + '）';
    if (!problems.length) { el('issue-list').hidden = true; el('issues').setAttribute('aria-expanded', 'false'); }
    renderIssues(el('issue-list'), allIssues());
    renderProgress();
  }
  function allIssues(requireTarget = true) {
    const issues = canvasIssues(graph, { candidate: available, requireTarget }), config = readSettings();
    if (!config.profileId || !Number.isSafeInteger(config.profileRevision) || config.profileRevision < 1 || !['tcp', 'udp', 'both'].includes(config.protocol))
      issues.push({ id: 'settings', message: '请在线路设置中选择传输配置与业务协议', field: 'settings' });
    return issues;
  }
  function locateIssue(issue) {
    if (busy) return; commitField(); cancelGesture();
    if (el('preview-dialog').open) el('preview-dialog').close();
    if (issue.role) { openPicker(issue.role); return; }
    if (issue.field === 'settings') { setupSteps()[3].action(); return; }
    const node = nodeByKey(issue.key);
    if (!node) { select(null, true); viewport.focus({ preventScroll: true }); return; }
    select(issue.edge ? { kind: 'edge', ...issue.edge } : { kind: 'node', key: node.key }, true); reveal(node);
    const control = issue.field === 'resource' ? el('node-settings').querySelector('[data-canvas-replace]') :
      issue.field ? el('node-settings').querySelector('[data-canvas-field="' + issue.field + '"]') : nodeViews.get(node.key)?.card;
    control?.focus({ preventScroll: true });
    if (issue.field && issue.field !== 'resource') control?.setAttribute('aria-invalid', 'true');
    gestureHint(issue.message);
  }
  function renderIssues(list, issues) {
    list.replaceChildren(...issues.map(issue => {
      const row = element('li'), control = button(issue.message + ' · 前往修正', () => locateIssue(issue), 'secondary fc-issue-link');
      control.dataset.canvasIssue = issue.id; row.append(control); return row;
    }));
  }
  function showSettings(field = 'profile') {
    commitField(); tab = 'route'; renderInspector(); el('inspector').classList.add('open');
    if (['profile', 'name', 'protocol'].includes(field)) byId('line-' + field).focus({ preventScroll: true });
  }
  function setupSteps() {
    const config = readSettings(), ingress = graph.nodes.find(node => node.role === 'ingress'), target = graph.nodes.find(node => node.role === 'target');
    const missing = ['ingress', 'egress', 'target'].find(role => !graph.nodes.some(node => node.role === role));
    const stale = graph.nodes.find(node => node.role !== 'target' && !available(node));
    const chain = canvasChain(graph), tail = chain.at(-1);
    const disconnected = graph.nodes.find(node => !chain.some(item => item.key === node.key));
    const continuation = stale || (tail?.role !== 'target' ? tail : null) || disconnected || ingress;
    const policy = ingress && available(ingress)?.policy;
    const listenerValid = !!ingress && !!policy?.allowedListenerAddresses?.includes(ingress.listenAddress) && !!policy?.allowedPorts?.includes(Number(ingress.listenPort));
    const targetValid = !!target?.targetHost?.trim() && target.targetHost.trim().length <= 253 && /^[1-9][0-9]{0,4}$/.test(String(target.targetPort)) && Number(target.targetPort) <= 65535;
    return [
      { label: '添加节点', complete: !missing, action: () => openPicker(missing || 'transit') },
      { label: '连成路径', complete: !canvasProblems(graph, { requireTarget: false, candidate: available }).length,
        action: () => { select(continuation ? { kind: 'node', key: continuation.key } : null, true); reveal(continuation); gestureHint(stale ? '当前用途待核对，请读取线路资源' : '从节点右侧连接点拖向下一节点左侧'); } },
      { label: '监听与目标', complete: listenerValid && targetValid,
        action: () => {
          const node = listenerValid ? target : ingress;
          if (!node) { openPicker(listenerValid ? 'target' : 'ingress'); return; }
          select({ kind: 'node', key: node.key }, true); reveal(node);
          el('node-settings').querySelector('[data-canvas-field="' + (listenerValid ? 'targetHost' : 'listenAddress') + '"]')?.focus({ preventScroll: true });
        } },
      { label: '线路设置', complete: !!config.profileId && Number.isSafeInteger(config.profileRevision) && config.profileRevision > 0 && ['tcp', 'udp', 'both'].includes(config.protocol),
        action: () => showSettings() },
    ];
  }
  function renderProgress() {
    const steps = setupSteps(), pending = steps.findIndex(step => !step.complete);
    steps.forEach((step, index) => {
      let parts = progressViews[index];
      if (!parts) {
        const item = element('li'), control = button('', () => setupSteps()[index].action());
        item.append(control); el('progress').append(item); parts = { item, control }; progressViews[index] = parts;
      }
      const { item, control } = parts;
      control.textContent = (step.complete ? '✓ ' : (index + 1) + ' ') + step.label; control.disabled = busy;
      control.setAttribute('aria-label', step.label + (step.complete ? '，已完善' : '，待完善'));
      if (index === pending) control.setAttribute('aria-current', 'step'); else control.removeAttribute('aria-current');
      item.className = step.complete ? 'complete' : '';
    });
    const next = el('next'); next.disabled = busy;
    next.textContent = pending < 0 ? '预览草稿' : pending === 0 ? '添加' + canvasRoleNames[['ingress', 'egress', 'target'].find(role => !graph.nodes.some(node => node.role === role))] : pending === 1 ? '继续连线' : pending === 2 ? '补全参数' : '设置线路';
  }
  function render() { renderNodes(); renderEdges(); renderInspector(); renderStatus(); }
  function transform() {
    el('world').style.transform = `translate3d(${view.x}px,${view.y}px,0) scale(${view.zoom})`;
    el('viewport').style.backgroundSize = (24 * view.zoom) + 'px ' + (24 * view.zoom) + 'px';
    el('viewport').style.backgroundPosition = view.x + 'px ' + view.y + 'px'; el('zoom').textContent = Math.round(view.zoom * 100) + '%';
  }
  function worldPoint(x, y) { const box = el('viewport').getBoundingClientRect(); return { x: (x - box.left - view.x) / view.zoom, y: (y - box.top - view.y) / view.zoom }; }
  function fit(animate = false) {
    const box = el('viewport').getBoundingClientRect(); if (!box.width || !box.height) return;
    if (!graph.nodes.length) { moveCamera({ x: 30, y: 30, zoom: 1 }, animate); return; }
    const x = Math.min(...graph.nodes.map(node => node.x)), y = Math.min(...graph.nodes.map(node => node.y));
    const w = Math.max(...graph.nodes.map(node => node.x)) + width - x, h = Math.max(...graph.nodes.map(node => node.y)) + height - y;
    const zoom = Math.max(.2, Math.min(1, (box.width - 70) / w, (box.height - 100) / h));
    moveCamera({ zoom, x: (box.width - w * zoom) / 2 - x * zoom, y: (box.height - h * zoom) / 2 - y * zoom }, animate);
  }
  function reveal(node) {
    if (!node) return;
    const box = el('viewport').getBoundingClientRect(), left = node.x * view.zoom + view.x, top = node.y * view.zoom + view.y;
    const right = left + width * view.zoom, bottom = top + height * view.zoom;
    if (left >= 35 && top >= 45 && right <= box.width - 35 && bottom <= box.height - 65) return;
    moveCamera({ ...view, x: box.width / 2 - (node.x + width / 2) * view.zoom, y: box.height / 2 - (node.y + height / 2) * view.zoom }, true);
  }
  function zoom(factor, x, y, animate = false) {
    const box = el('viewport').getBoundingClientRect(); x ??= box.left + box.width / 2; y ??= box.top + box.height / 2;
    moveCamera(canvasZoomAt(animate && cameraTarget ? cameraTarget : view, factor, { x: x - box.left, y: y - box.top }), animate);
  }
  function updateWire(x, y) {
    if (!wire) return;
    const point = worldPoint(x, y), target = canvasMagnet(graph, wire.from, point, view.zoom);
    wire.to = target?.key ?? null; wire.error = target?.error ?? ''; wire.point = target && !target.error ? target.point : point;
    gestureHint(target ? target.error || '松开即可连接到 ' + (nodeByKey(target.key).label || nodeByKey(target.key).nodeId || '业务目标') : '靠近下一节点左侧连接点即可吸附 · Esc 取消');
    schedulePaint({ edges: true });
  }
  function cancelWire() { wire = null; el('viewport').classList.remove('wiring'); gestureHint(); renderEdges(); }
  function cancelGesture() {
    stopCamera();
    const pointers = new Set([...touches.keys(), drag?.pointer, wire?.pointer]);
    if (drag?.kind === 'node') graph = drag.before;
    drag = null; pinch = null; touches.clear(); cancelWire(); el('viewport').classList.remove('dragging', 'pinching');
    for (const parts of nodeViews.values()) parts.card.classList.remove('dragged');
    schedulePaint({ positions: true, edges: true });
    for (const pointer of pointers) if (pointer !== undefined && pointer !== null && el('viewport').hasPointerCapture(pointer)) el('viewport').releasePointerCapture(pointer);
  }
  function connect(from, to) {
    if (busy) return; cancelWire();
    try { change(connectCanvasNodes(graph, from, to), { kind: 'edge', from, to }); notify('已连接下一跳'); }
    catch (error) { notify(error.message, true); }
  }
  function picker() {
    const replacing = nodeByKey(replacingKey);
    el('picker-title').textContent = replacing ? '更换' + canvasRoleNames[replacing.role] + '机器' : '添加到转发画布';
    el('picker-hint').textContent = replacing ? '选择相同用途的另一台机器，保留卡片位置、显示名称和连接。取消可保留原草稿。' : '这里只列出当前页中有权用于相应用途的机器。';
    for (const control of el('picker').querySelectorAll('[data-canvas-role]')) {
      control.setAttribute('aria-pressed', String(control.dataset.canvasRole === pickerRole)); control.disabled = busy || !!replacing;
    }
    for (const role of ['ingress', 'transit', 'egress']) byId('line-' + role + '-next').hidden = role !== pickerRole;
    el('search').disabled = busy || pickerRole === 'target';
    const query = el('search').value.trim().toLowerCase(), pool = pickerRole === 'target' ? [{ id: '', resourceSource: 'target' }] : candidates(pickerRole).filter(item => candidate(pickerRole, item.id));
    el('candidates').replaceChildren();
    for (const item of pool.filter(item => item.id.toLowerCase().includes(query))) {
      const exists = pickerRole === 'target' ? graph.nodes.some(node => node.role === 'target') : graph.nodes.some(node => node.nodeId === item.id);
      const roleTaken = !replacing && pickerRole !== 'transit' && graph.nodes.some(node => node.role === pickerRole);
      const full = replacing ? '' : pickerRole === 'transit' && graph.nodes.filter(node => node.role === 'transit').length >= 6 ? '中继已达 6 台上限' :
        pickerRole !== 'target' && graph.nodes.filter(node => node.role !== 'target').length >= 8 ? '机器已达 8 台上限' : '';
      const card = button('', () => add(item), 'secondary fc-candidate');
      card.disabled = busy || exists || roleTaken || !!full;
      card.append(element('strong', pickerRole === 'target' ? '自定义业务目标' : item.id), element('small', exists ? '已在画布中' : roleTaken ? '请先移除原' + canvasRoleNames[pickerRole] : full || (pickerRole === 'target' ? '填写目标主机与端口' : item.resourceSource === 'private' ? '我的机器 · 当前用途可选' : '共享资源 · 当前用途可选')));
      el('candidates').append(card);
    }
    if (!el('candidates').children.length) el('candidates').append(element('p', pool.length ? '当前页没有匹配项，可翻页或清除筛选。' : '当前页没有可选资源，请先读取线路资源，或确认该用途授权。', 'hint'));
    el('page').textContent = pickerRole === 'target' ? '每条链只需一个业务目标' : '只筛选当前候选页；翻页不会移除已添加的节点';
    el('picker-count').textContent = graph.nodes.filter(node => node.role !== 'target').length + ' / 8 台机器' + (graph.nodes.some(node => node.role === 'target') ? ' · 已有业务目标' : '');
    el('keep-adding').disabled = busy;
    el('keep-adding').closest('label').hidden = !!replacing;
    el('picker-close').textContent = replacing ? '取消更换' : el('keep-adding').checked ? '完成添加' : '关闭';
  }
  function openPicker(role, replaceKey = null) {
    if (busy) return; commitField(); cancelGesture(); editGroup = null; replacingKey = replaceKey; if (role) pickerRole = role;
    el('search').value = ''; picker(); if (!el('picker').open) el('picker').showModal();
  }
  function add(resource) {
    if (busy) return;
    if (pickerRole !== 'target' && !candidate(pickerRole, resource.id)) return notify('资源用途已变化，请重新读取', true);
    if (replacingKey) {
      try {
        const key = replacingKey, previous = nodeByKey(key);
        if (!previous || previous.role !== pickerRole) throw Error('更换位置已变化，请重新选择');
        change(replaceCanvasNode(graph, key, resource), { kind: 'node', key });
        replacingKey = null; el('picker').close(); el('inspector').classList.add('open');
        el('node-settings').querySelector('[data-canvas-replace]')?.focus({ preventScroll: true });
        notify('已更换机器并保留连线，可撤销恢复；部署前请重新预览');
      } catch (error) { notify(error.message, true); }
      return;
    }
    const box = el('viewport').getBoundingClientRect(), center = worldPoint(box.left + box.width / 2, box.top + box.height / 2);
    const { x, y } = canvasInsertionPoint(graph, center, selection?.kind === 'node' ? selection.key : null);
    const node = { key: 'canvas-' + ++serial, role: pickerRole, nodeId: pickerRole === 'target' ? null : resource.id, x, y, label: '' };
    if (pickerRole === 'ingress') { node.listenAddress = resource.policy?.allowedListenerAddresses?.[0] ?? ''; node.listenPort = String(resource.policy?.allowedPorts?.[0] ?? ''); }
    if (pickerRole === 'target') { node.targetHost = ''; node.targetPort = ''; }
    try {
      tab = 'node'; change(addCanvasNode(graph, node), { kind: 'node', key: node.key }); reveal(node);
      if (el('keep-adding').checked) {
        if (pickerRole === 'ingress') pickerRole = 'transit'; else if (pickerRole === 'egress') pickerRole = 'target';
        el('search').value = ''; picker();
        const done = pickerRole === 'target' && graph.nodes.some(item => item.role === 'target');
        (done ? el('picker-close') : el('picker').querySelector('[data-canvas-role="' + pickerRole + '"]'))?.focus();
      } else {
        el('picker').close(); el('inspector').classList.add('open');
        el('node-settings').querySelector('[data-canvas-field="' + (node.role === 'target' ? 'targetHost' : 'label') + '"]')?.focus({ preventScroll: true });
      }
    }
    catch (error) { notify(error.message, true); }
  }
  function preview() {
    if (busy) return; commitField(); cancelGesture();
    const problems = allIssues();
    const config = readSettings();
    el('preview-path').replaceChildren(...canvasChain(graph).map(node => element('li', canvasRoleNames[node.role] + ' · ' + (node.label || node.nodeId || '业务目标'))));
    renderIssues(el('problems'), problems);
    if (!problems.length) el('problems').append(element('li', '草稿结构完整，可载入转发表单继续验证部署计划。'));
    el('copy').disabled = problems.length > 0;
    el('preview-output').textContent = problems.length ? '完善连接和参数后，这里显示按连线生成的转发草稿。' : JSON.stringify(canvasDraft(graph, config, { candidate: available }), null, 2);
    if (!el('preview-dialog').open) el('preview-dialog').showModal();
  }
  const viewport = el('viewport');
  function beginPinch() {
    if (drag?.kind === 'node') graph = drag.before;
    drag = null; cancelWire();
    const [a, b] = [...touches.values()], x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    pinch = { zoom: view.zoom, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), anchor: worldPoint(x, y) };
    for (const parts of nodeViews.values()) parts.card.classList.remove('dragged');
    viewport.classList.remove('dragging'); viewport.classList.add('pinching');
    gestureHint('双指平移与缩放 · 松开后继续编辑'); schedulePaint({ positions: true, edges: true });
  }
  viewport.addEventListener('pointerdown', event => {
    if (busy || ![0, 1].includes(event.button) || event.target.closest('.fc-zoom,.fc-empty')) return;
    stopCamera(); flushPaint();
    if (event.pointerType === 'touch') {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      viewport.setPointerCapture(event.pointerId);
      if (touches.size >= 2) { event.preventDefault(); viewport.setPointerCapture(event.pointerId); beginPinch(); return; }
    }
    const pan = event.button === 1 || spaceHeld;
    const outgoing = event.target.closest('[data-canvas-out]'), incoming = event.target.closest('[data-canvas-in]');
    if (incoming && !pan) { if (wire) { event.preventDefault(); connect(wire.from, incoming.dataset.canvasIn); } return; }
    if (outgoing && !pan) {
      event.preventDefault(); const source = nodeByKey(outgoing.dataset.canvasOut);
      wire = { from: source.key, point: point(source, true), x: event.clientX, y: event.clientY, pointer: event.pointerId };
      viewport.classList.add('wiring'); viewport.setPointerCapture(event.pointerId); updateWire(event.clientX, event.clientY); return;
    }
    cancelWire();
    const edge = event.target.closest('[data-canvas-from]');
    if (edge && !pan) { select({ kind: 'edge', from: edge.dataset.canvasFrom, to: edge.dataset.canvasTo }, true); return; }
    const card = event.target.closest('[data-canvas-node]');
    event.preventDefault();
    if (card && !pan) {
      event.preventDefault(); const node = nodeByKey(card.dataset.canvasNode); select({ kind: 'node', key: node.key });
      drag = { kind: 'node', key: node.key, pointer: event.pointerId, start: { x: event.clientX, y: event.clientY }, x: node.x, y: node.y, before: copyCanvas(graph), moved: false };
      gestureHint('拖动调整位置 · 按住 Shift 对齐网格 · Esc 取消');
    } else drag = { kind: 'pan', pointer: event.pointerId, start: { x: event.clientX, y: event.clientY }, x: view.x, y: view.y, moved: false, preserveSelection: pan };
    viewport.focus({ preventScroll: true }); viewport.setPointerCapture(event.pointerId);
  });
  function movePointer(event) {
    if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && touches.size >= 2) {
      const [a, b] = [...touches.values()], box = viewport.getBoundingClientRect();
      const zoom = Math.max(.2, Math.min(1.8, pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance));
      view = { zoom, x: (a.x + b.x) / 2 - box.left - pinch.anchor.x * zoom, y: (a.y + b.y) / 2 - box.top - pinch.anchor.y * zoom };
      schedulePaint({ view: true }); return;
    }
    if (wire) { if (wire.pointer === null || wire.pointer === event.pointerId) updateWire(event.clientX, event.clientY); return; }
    if (!drag || drag.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.start.x, dy = event.clientY - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true; viewport.classList.add('dragging');
    if (drag.kind === 'node') {
      const node = nodeByKey(drag.key); if (!node) return;
      const grid = event.shiftKey ? 24 : .1;
      node.x = Math.round((drag.x + dx / view.zoom) / grid) * grid; node.y = Math.round((drag.y + dy / view.zoom) / grid) * grid;
      nodeViews.get(node.key)?.card.classList.add('dragged'); schedulePaint({ positions: true, edges: true });
    } else {
      view.x = drag.x + dx; view.y = drag.y + dy; schedulePaint({ view: true });
    }
  }
  viewport.addEventListener('pointermove', movePointer);
  function finishPointer(event, cancelled = false) {
    if (!cancelled) movePointer(event);
    touches.delete(event.pointerId);
    if (pinch) {
      if (touches.size >= 2) beginPinch(); else { pinch = null; viewport.classList.remove('pinching'); gestureHint(); }
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId); flushPaint(); return;
    }
    if (wire?.pointer === event.pointerId) {
      const source = wire.from;
      if (cancelled) cancelWire(); else if (wire.to && !wire.error) connect(source, wire.to);
      else if (Math.hypot(event.clientX - wire.x, event.clientY - wire.y) > 8) {
        const message = wire.error || '请把连线拖近下一节点左侧的连接点'; cancelWire(); gestureHint(message);
      }
      else { wire.pointer = null; notify('再点击下一节点左侧连接点；Esc 取消'); }
    }
    if (drag?.pointer === event.pointerId) {
      if (drag.kind === 'node') {
        if (cancelled) graph = drag.before;
        else if (drag.moved) { remember(drag.before); onChange(); }
        else el('inspector').classList.add('open');
        nodeViews.get(drag.key)?.card.classList.remove('dragged'); drag = null; renderNodes(); renderEdges(); renderStatus();
      } else { if (!drag.moved && !cancelled && !drag.preserveSelection) select(null); drag = null; }
      gestureHint();
    }
    viewport.classList.remove('dragging'); if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId); flushPaint();
  }
  viewport.addEventListener('pointerup', event => finishPointer(event));
  viewport.addEventListener('pointercancel', event => finishPointer(event, true));
  viewport.addEventListener('lostpointercapture', event => { if (drag?.pointer === event.pointerId || wire?.pointer === event.pointerId) { cancelGesture(); render(); } });
  viewport.addEventListener('wheel', event => {
    if (busy) return; event.preventDefault(); if (drag || pinch || wire) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
    if (event.shiftKey || event.deltaX && !event.ctrlKey && !event.metaKey) {
      stopCamera(); view.x -= (event.deltaX || event.deltaY) * unit; view.y -= event.shiftKey ? 0 : event.deltaY * unit; schedulePaint({ view: true });
    } else zoom(Math.exp(-Math.max(-1200, Math.min(1200, event.deltaY * unit)) * .0012), event.clientX, event.clientY);
  }, { passive: false });
  viewport.addEventListener('click', event => {
    if (busy || event.detail !== 0) return;
    stopCamera(); flushPaint();
    const outgoing = event.target.closest('[data-canvas-out]'), incoming = event.target.closest('[data-canvas-in]');
    if (outgoing) { const node = nodeByKey(outgoing.dataset.canvasOut); wire = { from: node.key, point: point(node, true), pointer: null }; viewport.classList.add('wiring'); renderEdges(); gestureHint('选择下一节点左侧连接点 · Esc 取消'); }
    if (incoming && wire) connect(wire.from, incoming.dataset.canvasIn);
  });
  viewport.addEventListener('focusin', event => {
    const card = event.target.closest('[data-canvas-node]');
    if (card && event.target === card) { select({ kind: 'node', key: card.dataset.canvasNode }); reveal(nodeByKey(card.dataset.canvasNode)); }
  });
  function updateField(event) {
    const name = event.target.dataset.canvasField;
    if (busy || event.isComposing || !name || selection?.kind !== 'node') return;
    const next = copyCanvas(graph), node = next.nodes.find(item => item.key === selection.key);
    if (node && node[name] !== event.target.value && ['label', 'listenAddress', 'listenPort', 'targetHost', 'targetPort'].includes(name)) {
      const group = node.key + ':' + name, first = editGroup !== group;
      if (first) { remember(graph); editGroup = group; }
      node[name] = event.target.value; graph = next;
      event.target.setAttribute('aria-invalid', String(canvasIssues(graph, { candidate: available }).some(issue => issue.key === node.key && issue.field === name)));
      // Preserve the focused field and the control receiving the blur click.
      schedulePaint({ nodes: true, edges: true, status: true }); if (first) onChange();
    }
  }
  el('node-settings').addEventListener('input', updateField);
  el('node-settings').addEventListener('change', updateField);
  el('node-settings').addEventListener('compositionend', updateField);
  el('node-settings').addEventListener('focusout', () => { editGroup = null; });
  function commitField() {
    const active = document.activeElement;
    if (active && el('node-settings').contains(active) && active.dataset.canvasField) updateField({ target: active });
  }
  function setFocused(value, restore = true) {
    if (focused === value) return;
    commitField(); cancelGesture(); focused = value;
    if (value) {
      focusReturn = document.activeElement; inertElements = [];
      for (let current = root; current.parentElement; current = current.parentElement) {
        for (const sibling of current.parentElement.children) {
          if (sibling !== current && sibling.tagName !== 'DIALOG' && !sibling.inert) { sibling.inert = true; inertElements.push(sibling); }
        }
      }
      document.body.classList.add('fc-editing'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    } else {
      for (const item of inertElements) item.inert = false; inertElements = [];
      document.body.classList.remove('fc-editing'); root.setAttribute('role', 'region'); root.removeAttribute('aria-modal');
    }
    root.classList.toggle('focused', value);
    el('focus').setAttribute('aria-pressed', String(value)); el('focus').textContent = value ? '返回页面 · Esc' : '专注编辑';
    if (value) el('focus').focus({ preventScroll: true });
    else if (restore) (focusReturn?.isConnected ? focusReturn : el('focus')).focus({ preventScroll: true });
  }
  root.addEventListener('keydown', event => {
    if (focused && event.key === 'Tab') {
      const controls = [...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(item => item.getClientRects().length && getComputedStyle(item).visibility !== 'hidden');
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    if (event.key === 'Escape') {
      if (drag || pinch || wire) { event.preventDefault(); cancelGesture(); render(); }
      else if (focused) { event.preventDefault(); setFocused(false); }
      return;
    }
    if (event.target.closest('input,select,textarea') || busy) return;
    if (event.code === 'Space') { if (event.target === viewport || event.target.matches('.fc-node')) { event.preventDefault(); spaceHeld = true; viewport.classList.add('space-pan'); } return; }
    if (event.key === 'Enter' && event.target.matches('.fc-node')) { event.preventDefault(); select({ kind: 'node', key: event.target.dataset.canvasNode }, true); el('node-settings').querySelector('input,select')?.focus({ preventScroll: true }); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(event.shiftKey); return; }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Delete' && selection) { event.preventDefault(); remove(); return; }
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); fit(true); return; }
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); openPicker(); return; }
    if (selection?.kind === 'node' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && (event.target === viewport || event.target.matches('.fc-node'))) {
      event.preventDefault(); const next = copyCanvas(graph), node = next.nodes.find(item => item.key === selection.key), distance = event.shiftKey ? 25 : 5;
      node.x += event.key === 'ArrowRight' ? distance : event.key === 'ArrowLeft' ? -distance : 0;
      node.y += event.key === 'ArrowDown' ? distance : event.key === 'ArrowUp' ? -distance : 0;
      change(next); viewport.focus({ preventScroll: true });
    }
  });
  function releaseSpace() { spaceHeld = false; viewport.classList.remove('space-pan'); }
  root.addEventListener('keyup', event => { if (event.code === 'Space') releaseSpace(); });
  root.addEventListener('focusout', event => { if (event.relatedTarget && !root.contains(event.relatedTarget)) releaseSpace(); });
  globalThis.addEventListener('blur', () => { releaseSpace(); if (drag || pinch || wire) { cancelGesture(); render(); } else stopCamera(); });
  el('add').addEventListener('click', () => openPicker()); el('start').addEventListener('click', () => openPicker('ingress'));
  el('focus').addEventListener('click', () => setFocused(!focused));
  el('reload').addEventListener('click', () => { if (!busy) byId('line-resources-refresh').click(); });
  el('continue').addEventListener('click', () => { if (!busy) { setFocused(false); byId('line-use').click(); } });
  el('issues').addEventListener('click', () => {
    el('issue-list').hidden = !el('issue-list').hidden;
    el('issues').setAttribute('aria-expanded', String(!el('issue-list').hidden));
  });
  el('picker').addEventListener('close', () => { replacingKey = null; });
  el('picker-close').addEventListener('click', () => el('picker').close()); el('search').addEventListener('input', picker);
  el('keep-adding').addEventListener('change', picker);
  el('picker').addEventListener('click', event => { const control = event.target.closest('[data-canvas-role]'); if (control && !busy && !replacingKey) { pickerRole = control.dataset.canvasRole; el('search').value = ''; picker(); } });
  el('undo').addEventListener('click', () => undo()); el('redo').addEventListener('click', () => undo(true));
  el('fit').addEventListener('click', () => { cancelGesture(); fit(true); }); el('zoom-in').addEventListener('click', () => zoom(1.15, undefined, undefined, true)); el('zoom-out').addEventListener('click', () => zoom(1 / 1.15, undefined, undefined, true));
  el('clear').addEventListener('click', () => { if (!busy) { cancelGesture(); change(emptyCanvas(), null); } });
  el('layout').addEventListener('click', () => {
    if (busy) return; cancelGesture();
    const next = copyCanvas(graph), chain = canvasChain(next), ordered = [...chain, ...next.nodes.filter(node => !chain.includes(node))];
    ordered.forEach((node, index) => { node.x = 55 + index % 3 * 325; node.y = 80 + Math.floor(index / 3) * 240; }); change(next); fit(true);
  });
  el('tab-node').addEventListener('click', () => { tab = 'node'; renderInspector(); });
  el('tab-route').addEventListener('click', () => { tab = 'route'; renderInspector(); });
  el('inspect').addEventListener('click', () => el('inspector').classList.add('open'));
  el('close').addEventListener('click', () => { el('inspector').classList.remove('open'); el('inspect').focus(); });
  el('next').addEventListener('click', () => { if (!busy) { cancelGesture(); const step = setupSteps().find(item => !item.complete); if (step) step.action(); else preview(); } });
  el('preview').addEventListener('click', preview); el('preview-close').addEventListener('click', () => el('preview-dialog').close());
  el('copy').addEventListener('click', async () => {
    const version = session;
    try {
      const config = readSettings();
      if (!config.profileId || !Number.isSafeInteger(config.profileRevision) || config.profileRevision < 1) throw Error('请先选择有效的传输配置');
      const value = canvasDraft(graph, config, { candidate: available });
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2)); if (version === session) notify('已复制转发草稿');
    } catch (error) { if (version === session) notify(error.message, true); }
  });
  function setBusy(value) {
    cancelGesture(); busy = value;
    for (const name of ['add', 'start', 'preview', 'zoom-in', 'zoom-out', 'fit', 'search', 'reload', 'continue']) el(name).disabled = value;
    render(); if (el('picker').open) picker();
  }
  function clear() {
    setFocused(false, false); replacingKey = null;
    cancelGesture(); if (paintFrame !== null) cancelAnimationFrame(paintFrame); paintFrame = null; paintFlags = {};
    session++; graph = emptyCanvas(); selection = null; past = []; future = []; editGroup = null; tab = 'node'; pickerRole = 'ingress'; busy = false; releaseSpace();
    for (const name of ['picker', 'preview-dialog']) if (el(name).open) el(name).close();
    el('candidates').replaceChildren(); el('preview-path').replaceChildren(); el('problems').replaceChildren(); el('preview-output').textContent = ''; el('search').value = ''; el('keep-adding').checked = false; el('picker-count').textContent = '';
    el('inspector').classList.remove('open'); setBusy(false); fit();
    el('issue-list').hidden = true; el('issues').setAttribute('aria-expanded', 'false');
  }
  render(); transform();
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => {
    const box = viewport.getBoundingClientRect(); if (!box.width || !box.height) return;
    if (lastViewport && (box.width !== lastViewport.width || box.height !== lastViewport.height)) {
      cancelGesture(); moveCamera({ ...view, x: view.x + (box.width - lastViewport.width) / 2, y: view.y + (box.height - lastViewport.height) / 2 });
    } else if (!lastViewport) fit();
    lastViewport = { width: box.width, height: box.height };
  }).observe(viewport);
  return {
    clear, setBusy, showSettings,
    selected: () => graph.nodes.filter(node => node.role !== 'target').map(({ nodeId, role }) => ({ nodeId, role })),
    getDraft: (settings, requireTarget = true) => {
      commitField();
      const issue = canvasIssues(graph, { requireTarget, candidate: available })[0]; if (issue) locateIssue(issue);
      return canvasDraft(graph, settings, { requireTarget, candidate: available });
    },
    locateProblem: (requireTarget = true, id) => {
      commitField(); const issues = allIssues(requireTarget), issue = issues.find(item => item.id === id) || issues[0]; if (issue) locateIssue(issue);
    },
    refresh: () => { cancelGesture(); render(); if (el('picker').open) picker(); },
  };
}
