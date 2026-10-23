import { initAdminResourceConsole, personalPortUsageView } from '../admin-resource-console.js';
import { initResourceLimitConsole, personalPayloadLimitView } from '../resource-limit-console.js';
import { readIdentityContext, scopeGovernance } from '../account-context.js';
import { initLineBuilder } from '../line-builder.js';
import { summarizeForwardRecord } from '../forward-status.js';
import { explainNodePreflight, summarizePreflight } from '../forward-preflight.js';

export function mountControlConsole({
  validScope, parsePorts, parseCidrs, directCapable, allowedProtocols, directSpec, stateTone, pageCount, listResource, candidateChoices,
  createRequests, initRelayConsole, initProbeConsole, initProbeRuns, initProbePlans, initTransportConsole, initRuleConsole,
  initTunnelConsole, initTelemetryConsole, initForwardTelemetryConsole, initHostTelemetryConsole, initProbeTelemetryConsole,
  initTelemetryAggregateConsole, initPathTemplates, initPathSwitch, initPathGroups, initPathPublications, initIngressGroups,
  initIngressMigrations, initForwardDiagnostics, initAuditConsole, initStationAlerts, initNotificationEndpoints,
  initNotificationDeliveries, initObservationServices,
}) {
const byId = id => document.getElementById(id);
const auth = { scope: '', token: '' };
let account = null, accountPage = null, accountEpoch = 0, accountController = null;
let nodeOwnership = 'mine';
const governanceViews = new Set(['resources','audit','alerts','notifications','observation-services']);
const selectedScope = () => account?.scopes.find(item => item.scopeId === auth.scope);
const governance = () => scopeGovernance(selectedScope());
const page = { nodes: 1, forwards: 1, operations: 1 };
const store = { nodes: [], forwards: [], operations: [] };
const candidates = { direct: [], relay: [] };
const candidatePages = { direct: 1, relay: 1 };
const filters = { nodes: {}, forwards: {}, operations: {} };
const readVersions = {};
const totals = { nodes: 0, forwards: 0, operations: 0 };
const forwardStatusCache = new Map();
const forwardStatusCells = new Map();
let forwardStatusEpoch = 0;
const consoleRequests = createRequests({ scope: () => auth.scope, token: () => auth.token, version: () => connectionVersion });
const { connected, request, mutate } = consoleRequests;
let currentView = 'overview';
let editing = null;
let currentSecret = null;
let overview = null, connectionVersion = 0;
let privateProvisioning=false,privateProvisionUnknown=false;

function element(tag, value, className) {
  const item = document.createElement(tag);
  if (value !== undefined && value !== null) item.textContent = String(value);
  if (className) item.className = className;
  return item;
}
function cell(tr, ...children) {
  const td = element('td');
  for (const child of children) td.append(child);
  tr.append(td);
  return td;
}
function label(value, variant) {
  const node = element('span', value ?? '未知', 'pill ' + (variant ?? stateTone(value)));
  return node;
}
function button(value, action, id, extra) {
  const el = element('button', value);
  el.type = 'button';
  el.dataset.action = action;
  if (id) el.dataset.id = id;
  if (extra) el.className = extra;
  return el;
}
function shortId(id) {
  return String(id ?? '').length > 16 ? String(id).slice(0, 13) + '…' : String(id ?? '—');
}
function date(value) {
  if (!value) return '无记录';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '未知时间' : d.toLocaleString('zh-CN');
}
function notify(message, failure = false) {
  const box = byId('notice');
  box.textContent = message;
  box.className = 'notice' + (failure ? ' error' : '');
  box.hidden = false;
}
function display(view) {
  if(governanceViews.has(view)&&!governance())return;
  if(view==='nodes'||view==='available'){
    nodeOwnership=view==='available'?'available':'mine';
    filters.nodes.ownership=nodeOwnership;page.nodes=1;
    byId('nodes-filter').elements.namedItem('ownership').value=nodeOwnership;
    byId('nodes-title').textContent=view==='available'?'可用资源':'我的机器';
    byId('nodes-description').textContent=view==='available'?'按当前账号授权列出私有机器与管理员共享资源；用途限制不授予整机管理权限。':'管理归属于我的私有机器与接入凭据。';
    byId('show-node-form').hidden=view==='available';
  }
  currentView = view;
  const labels = { overview: '运行概览', nodes: '我的机器', available: '可用资源', forwards: '我的转发', relay: '我的线路', resources:'共享资源管理', probes: '受限 TCP 探测', operations: '执行记录', audit: '管理审计 · 只读查询', alerts: '站内事件 · 固定告警政策', notifications: '通知端点 · 受保护配置' };
  byId('page-title').textContent = view === 'observation-services' ? '观测服务 · 仅声明与公有信任' : labels[view] || labels.overview;
  document.querySelectorAll('.view').forEach(node => { node.hidden = node.id !== 'view-' + (view==='available'?'nodes':view); });
  document.querySelectorAll('.nav').forEach(node => { node.classList.toggle('active', node.dataset.view === view); });
}
async function load(kind) {
  const version = readVersions[kind] = (readVersions[kind] ?? 0) + 1;
  const result = await request('GET', listResource(kind, page[kind], filters[kind]));
  if (version !== readVersions[kind]) return;
  store[kind] = result.items;
  totals[kind] = result.total;
  if (kind === 'nodes') { renderNodes(); renderForwardPreflight(); renderOps(); }
  if (kind === 'forwards') renderForwards();
  if (kind === 'operations') { renderOperations(); renderOps(); }
  pagination(kind, result);
}
async function loadOverview() {
  const version = readVersions.overview = (readVersions.overview ?? 0) + 1;
  const result = await request('GET', 'overview');
  if (version !== readVersions.overview) return;
  overview = result;
  updateOverview();
}
async function loadCandidates(mode, pinnedIds = [], pinnedRoles = {}) {
  const key = 'candidates-' + mode, version = readVersions[key] = (readVersions[key] ?? 0) + 1;
  const prefix = byId(mode + '-candidate-prefix').value.trim();
  const selected = [...new Set(pinnedIds.filter(Boolean))];
  const role=mode==='direct'?'ingress':byId('relay-candidate-role').value||'ingress';
  if (selected.length > 9) throw new Error('最多保留 9 个已选节点');
  const [result, ...pinned] = await Promise.all([
    request('GET', listResource('nodes/candidates', candidatePages[mode], { mode, role, idPrefix: prefix })),
    ...selected.map(nodeId => request('GET', listResource('nodes/candidates', 1, { mode, role:pinnedRoles[nodeId]??role, nodeId }))),
  ]);
  if (version !== readVersions[key]) return false;
  candidates[mode] = candidateChoices(result.items, selected, pinned.flatMap(p => p.items));
  byId(mode + '-candidate-page').textContent = '第 ' + result.page + ' / ' + pageCount(result.total, result.limit) + ' 页 · 匹配 ' + result.total + ' 个；保留仍有权限的已选节点';
  byId(mode + '-candidate-prev').disabled = result.page <= 1;
  byId(mode + '-candidate-next').disabled = result.page >= Math.min(10000, pageCount(result.total, result.limit));
  return true;
}
async function refresh() {
  try {
    connected();
    await Promise.all([...['nodes', 'forwards', 'operations'].map(load), loadOverview()]);
    byId('connection-indicator').textContent = '已认证 · ' + auth.scope;
    notify('数据已从 Control 更新；列表中的 Operation 状态不代表独立探测成功。');
  } catch (error) {
    notify(error.message || '加载失败', true);
  }
}
function updateOverview() {
  for (const [id, key] of [['nodes', 'nodes'], ['forwards', 'forwards'], ['running', 'activeOperations'], ['failed', 'failedOperations']])
    byId('metric-' + id).textContent = overview ? String(overview[key]) : '—';
  renderOps();
}
function renderOps() {
  const status = byId('ops-status'), failedBox = byId('ops-failed-operations'), staleBox = byId('ops-stale-nodes');
  if (!status || !failedBox || !staleBox) return;
  const failed = store.operations.filter(item => item.status === 'failed').slice(0, 5);
  const now = Date.now();
  const stale = store.nodes.filter(node => node.readDetail==='full').filter(node => node.revoked || !node.lastReportAt ||
    !Number.isFinite(Date.parse(node.lastReportAt)) || now - Date.parse(node.lastReportAt) > 90000).slice(0, 5);
  status.textContent = '当前可见失败 Operation ' + (overview ? overview.failedOperations : '—') +
    ' · 当前页失败 ' + failed.length + ' · 当前页报告过期/撤销 ' + stale.length;
  failedBox.replaceChildren();
  if (!failed.length) failedBox.append(element('span', '当前页无失败 Operation；缺失不等于成功。', 'subline'));
  for (const item of failed) {
    const row = element('div', undefined, 'cell-actions');
    row.append(element('span', shortId(item.id) + ' · r' + item.targetRevision + ' · ' + date(item.updatedAt), 'subline'),
      button('查看', 'operation-detail', item.id, 'secondary'));
    failedBox.append(row);
  }
  staleBox.replaceChildren();
  if (!stale.length) staleBox.append(element('span', '当前页无过期或已撤销节点；报告新鲜不代表业务健康。', 'subline'));
  for (const node of stale) {
    const row = element('div', undefined, 'cell-actions');
    row.append(element('span', shortId(node.id) + ' · ' + (node.revoked ? '已撤销' : '报告 ' + date(node.lastReportAt)), 'subline'),
      button('诊断', 'node-diagnostics', node.id, 'secondary'));
    staleBox.append(row);
  }
}
function pagination(kind, result) {
  const container = byId(kind + '-pagination');
  container.replaceChildren();
  const previous = button('上一页', 'prev-' + kind);
  previous.className = 'secondary';
  previous.disabled = result.page <= 1;
  const next = button('下一页', 'next-' + kind);
  next.className = 'secondary';
  next.disabled = result.page >= Math.min(10000, pageCount(result.total, result.limit));
  container.append(previous, element('span', '第 ' + result.page + ' / ' + pageCount(result.total, result.limit) + ' 页 · 共 ' + result.total + ' 条'), next);
}
function renderNodes() {
  const tbody = byId('node-rows');
  tbody.replaceChildren();
  if (!store.nodes.length) { const tr = element('tr'); const t = cell(tr, element('span', '暂无节点', 'empty')); t.colSpan = 5; tbody.append(tr); }
  for (const node of store.nodes) {
    const tr = element('tr');
    const first = cell(tr, element('span', shortId(node.id), 'mono cell-title'));
    first.append(element('div', node.id, 'subline'));
    first.append(label(node.resourceSource==='private'?'私有机器':node.resourceSource==='admin-shared'?'管理员共享':'历史待分类'));
    first.append(element('div', node.canUse?'可用用途：'+(node.allowedRoles===null?'入口 / 中继 / 出口':node.allowedRoles.map(role=>({ingress:'入口',transit:'中继',egress:'出口'})[role]).join(' / ')):'当前无执行使用权', 'subline'));
    const expired = node.credentialUntil ? new Date(node.credentialUntil).getTime() <= Date.now() : true;
    cell(tr, node.revoked ? label('已撤销', 'bad') : expired ? label('未注册 / 凭据失效', 'progress') : label('凭据有效', 'good'));
    const recent = node.lastReportAt && Date.now() - Date.parse(node.lastReportAt) < 60000;
    const report = cell(tr, label(node.readDetail==='shared'?'报告不可见':recent ? '报告较新' : '未知 / 过期', recent ? 'good' : ''));
    report.append(element('div', node.readDetail==='shared'?'共享用途授权不包含主机报告':date(node.lastReportAt), 'subline'));
    cell(tr, element('span', (node.policy?.capabilities ?? []).join(', ') || '等待 Agent 上报', 'mono'));
    const actionCell=cell(tr);
    const actionGroup=element('div',undefined,'cell-actions');
    if(node.readDetail==='full')actionGroup.append(button('详情','node-detail',node.id,'secondary'),button('诊断','node-diagnostics',node.id,'secondary'),button('TLS Tunnel','node-tunnel',node.id,'secondary'),button('进程指标','node-telemetry',node.id,'secondary'),button('OS 资源','node-host-telemetry',node.id,'secondary'),button('聚合历史','node-telemetry-aggregate',node.id,'secondary'));
    if(node.canUse)actionGroup.append(button('我的端口用量','node-port-usage',node.id,'secondary'));
    if(node.canUse&&node.resourceSource==='admin-shared')actionGroup.append(button('我的带宽与流量配置','node-payload-limits',node.id,'secondary'));
    if(node.resourceSource==='private')actionGroup.append(element('span','私有机器不扣共享带宽与流量额度','subline'));
    if(node.readDetail==='shared')actionGroup.append(element('span','用于组线；主机详情由所有者管理','subline'));
    actionCell.append(actionGroup);
    tbody.append(tr);
  }
}
function paintForwardStatus(target, summary) {
  target.replaceChildren();
  target.append(label(summary.label, summary.tone));
  target.append(element('div', summary.detail, 'subline'));
  if (summary.operation) target.append(element('div', 'Operation ' + summary.operation.status +
    (summary.operation.cleanupPending ? ' · 旧资源清理中' : ''), 'subline'));
  if (summary.receivedAt) target.append(element('div', '报告 ' + date(summary.receivedAt), 'subline'));
}
function renderForwardStatus(item, target) {
  const key = item.id + ':' + item.revision;
  const cached = forwardStatusCache.get(key);
  if (cached) { paintForwardStatus(target, cached); return; }
  const epoch = forwardStatusEpoch;
  target.append(element('span', '读取中…', 'subline'));
  request('GET', 'forwards/' + encodeURIComponent(item.id)).then(record => {
    if (epoch !== forwardStatusEpoch) return;
    const summary = summarizeForwardRecord(record);
    forwardStatusCache.set(key, summary);
    if (forwardStatusCells.get(item.id) === target) paintForwardStatus(target, summary);
  }).catch(() => {
    if (epoch !== forwardStatusEpoch) return;
    if (forwardStatusCells.get(item.id) === target)
      target.replaceChildren(element('span', '状态不可用 · 不推导成功', 'subline'));
  });
}
function renderForwards() {
  ruleConsole.page();
  forwardStatusEpoch++;
  forwardStatusCells.clear();
  const keepStatuses = new Set();
  const tbody = byId('forward-rows');
  tbody.replaceChildren();
  if (!store.forwards.length) { const tr = element('tr'); const t = cell(tr, element('span', '暂无 Forward', 'empty')); t.colSpan = 7; tbody.append(tr); }
  for (const item of store.forwards) {
    const tr = element('tr');
    const a = item.spec;
    const entry = cell(tr, element('div', a.ingress.nodeId.slice(0, 13), 'mono cell-title'));
    const select = element('label', undefined, 'check'); select.append(ruleConsole.checkbox(item), element('span', '选择'));
    entry.append(select);
    entry.append(element('div', a.ingress.listen.address + ':' + a.ingress.listen.port, 'subline'));
    const target = cell(tr, element('div', a.target.host + ':' + a.target.port, 'cell-title'));
    target.append(element('div', 'r' + item.revision + (a.path ? ' · '+(a.path.via.length+1)+' 节点链路' : ' · Direct'), 'subline'));
    cell(tr, label(a.protocols.join(' + ').toUpperCase(), ''));
    cell(tr, label(item.recoverySuspended ? '恢复挂起' : a.enabled ? '希望启用' : '希望停用', item.recoverySuspended ? 'progress' : ''));
    const status = cell(tr);
    forwardStatusCells.set(item.id, status);
    keepStatuses.add(item.id + ':' + item.revision);
    renderForwardStatus(item, status);
    const operation = cell(tr, item.lastOperation ? label(item.lastOperation.status) : label('无操作记录'));
    if (item.lastOperation) operation.append(button('查看', 'operation-detail', item.lastOperation.id, 'secondary'));
    const action = cell(tr);
    const group = element('div', undefined, 'cell-actions');
    group.append(button('详情', 'forward-detail', item.id, 'secondary'));
    group.append(button('分层诊断', 'forward-diagnostics', item.id, 'secondary'));
    group.append(button('编辑', 'forward-edit', item.id, 'secondary'));
    group.append(button('复制配置', 'forward-copy', item.id, 'secondary'));
    group.append(button('入口流量观察', 'forward-telemetry', item.id, 'secondary'));
    group.append(button('Probe 计数', 'probe-telemetry', item.id, 'secondary'));
    group.append(button('聚合历史', 'forward-telemetry-aggregate', item.id, 'secondary'));
    group.append(button('探测支持','forward-probe-capabilities',item.id,'secondary'));
    if(!a.path && a.protocols.includes('tcp'))group.append(button('TCP 探测', 'forward-probe', item.id, 'secondary'));
    if(a.path)group.append(button('部署进度', 'forward-deployment', item.id, 'secondary'));
    group.append(button(a.enabled ? '停用' : '启用', 'forward-toggle', item.id, 'secondary'), button('删除', 'forward-delete', item.id, 'secondary'));
    action.append(group);
    tbody.append(tr);
  }
  for (const key of forwardStatusCache.keys()) if (!keepStatuses.has(key)) forwardStatusCache.delete(key);
}
function renderOperations() {
  const tbody = byId('operation-rows');
  tbody.replaceChildren();
  if (!store.operations.length) { const tr = element('tr'); const t = cell(tr, element('span', '暂无操作记录', 'empty')); t.colSpan = 6; tbody.append(tr); }
  for (const item of store.operations) {
    const tr = element('tr');
    const title = cell(tr, element('span', shortId(item.id), 'mono cell-title'));
    title.append(element('div', shortId(item.forwardId), 'subline'));
    cell(tr, element('span', 'r' + item.targetRevision, 'mono'));
    cell(tr, element('span', item.kind));
    cell(tr, label(item.status));
    cell(tr, element('span', date(item.updatedAt)));
    const last = cell(tr);
    last.append(button(item.lastError ? '查看错误' : '详情', 'operation-detail', item.id, 'secondary'));
    if (item.status === 'failed' && !item.recoveryInvalidated) last.append(button('显式重试', 'operation-retry', item.id, 'secondary'));
    tbody.append(tr);
  }
}
function addOptions(select, options, selected) {
  select.replaceChildren();
  for (const option of options) {
    const el = element('option', option.label ?? option.value);
    el.value = String(option.value);
    if (selected !== undefined && String(selected) === el.value) el.selected = true;
    select.append(el);
  }
  select.disabled = !options.length;
}
function fillNodes(preferred) {
  const choices = candidates.direct.filter(node=>directCapable(node)&&(node.allowedRoles===null||node.allowedRoles?.includes('ingress')));
  const select = byId('forward-node');
  addOptions(select, choices.map(n => ({ value: n.id, label: shortId(n.id) + ' · ' + n.policy.capabilities.filter(x => x === 'tcp' || x === 'udp').join('/') })), preferred);
  fillCapabilities();
}
function renderForwardPreflight() {
  const tbody = byId('forward-preflight-rows'), summary = byId('forward-preflight-summary');
  if (!tbody || !summary) return;
  tbody.replaceChildren();
  const protocol = byId('forward-protocol').value;
  const rows = store.nodes.map(node => explainNodePreflight(node, { protocol, role:'ingress' }));
  const counts = summarizePreflight(rows);
  summary.textContent = '已加载节点 ' + counts.total + ' · 可选 ' + counts.supported + ' · 不可选 ' + counts.unsupported + ' · 未知 ' + counts.unknown;
  if (!rows.length) {
    const tr = element('tr'), td = cell(tr, element('span', '节点列表尚未加载；请先在连接后刷新节点。', 'empty'));
    td.colSpan = 4; tbody.append(tr); return;
  }
  for (const row of rows) {
    const tr = element('tr');
    cell(tr, element('span', shortId(row.nodeId), 'mono'));
    cell(tr, label(row.label, row.tone));
    const dimensions = '平台 ' + row.dimensions.platform + ' / 角色 ' + row.dimensions.roles + ' / flag ' + row.dimensions.flags;
    cell(tr, element('span', (row.reasons.length ? row.reasons.map(value => value.message).join('；') : '声明满足') + ' · ' + dimensions, 'subline'));
    cell(tr, element('span', row.facts.status === 'hidden' ? '报告不可见' : row.facts.status === 'fresh' ? '报告新鲜' : row.facts.status === 'stale' ? '报告过期' : '无报告', 'subline'));
    tbody.append(tr);
  }
}
function fillCapabilities(preferred) {
  const node = candidates.direct.find(n => n.id === byId('forward-node').value);
  const protocols = node ? allowedProtocols(node) : [];
  addOptions(byId('forward-protocol'), protocols.map(p => ({ value: p, label: p === 'both' ? 'TCP + UDP' : p.toUpperCase() })), preferred?.protocol);
  addOptions(byId('forward-address'), (node?.policy?.allowedListenerAddresses ?? []).map(a => ({ value: a })), preferred?.address);
  addOptions(byId('forward-port'), (node?.policy?.allowedPorts ?? []).map(p => ({ value: p })), preferred?.port);
  byId('forward-capabilities').textContent = node ? '可用监听地址和端口由当前 Node Policy 决定，服务端会再次检查授权、目标 CIDR 与资源独占。' : '没有具备 ADP/3 Direct 能力和有效凭据的节点；请先接入 Agent。';
  byId('save-forward').disabled = !node;
  renderForwardPreflight();
}
async function editor(item, copy = false) {
  byId('forward-form').hidden = true;
  editing = null;
  candidatePages.direct = 1;
  byId('direct-candidate-prefix').value = '';
  if (!await loadCandidates('direct', item ? [item.spec.ingress.nodeId] : [])) return;
  if (item && !candidates.direct.some(n => n.id === item.spec.ingress.nodeId)) throw new Error('当前入口节点不再具备候选资格，请检查授权、凭据和能力');
  editing = copy ? null : item ?? null;
  const form = byId('forward-form');
  form.reset();
  byId('forward-form-title').textContent = item ? (copy ? '复制为新 Direct Forward（停用）· 来源 r' : '编辑 Direct Forward · r') + item.revision : '创建 Direct Forward';
  form.hidden = false;
  byId('forward-node').disabled = false;
  if (item) {
    if (item.spec.path) throw new Error('Relay 编辑需要完整的 Transport Profile，当前表单仅支持 Direct');
    fillNodes(item.spec.ingress.nodeId);
    fillCapabilities({ protocol: item.spec.protocols.length === 2 ? 'both' : item.spec.protocols[0], address: item.spec.ingress.listen.address, port: item.spec.ingress.listen.port });
    byId('forward-node').disabled = !copy;
    if (copy) byId('forward-port').value = '';
    form.elements.namedItem('targetHost').value = item.spec.target.host;
    form.elements.namedItem('targetPort').value = String(item.spec.target.port);
    form.elements.namedItem('enabled').checked = copy ? false : item.spec.enabled;
  } else fillNodes();
  display('forwards');
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
async function saveForward(event) {
  event.preventDefault();
  try {
    const form = byId('forward-form');
    const nodeId = editing ? editing.spec.ingress.nodeId : form.elements.namedItem('node').value;
    const node = candidates.direct.find(n => n.id === nodeId);
    const spec = directSpec({
      protocol: form.elements.namedItem('protocol').value,
      listenAddress: form.elements.namedItem('listenAddress').value,
      listenPort: form.elements.namedItem('listenPort').value,
      targetHost: form.elements.namedItem('targetHost').value,
      targetPort: form.elements.namedItem('targetPort').value,
      enabled: form.elements.namedItem('enabled').checked,
    }, node);
    const result = editing
      ? await mutate('PUT', 'forwards/' + encodeURIComponent(editing.id), { expectedRevision: editing.revision, spec })
      : await mutate('POST', 'forwards', spec);
    form.hidden = true;
    editing = null;
    await Promise.all([load('forwards'), load('operations'), loadOverview()]);
    notify('部署请求已接受：Operation ' + (result.operationId ?? '无变更') + '，请查看执行状态。');
  } catch (error) { notify(error.message, true); }
}
function detail(title, data, secret) {
  currentSecret = secret ?? null;
  byId('detail-title').textContent = title;
  byId('detail-content').textContent = JSON.stringify(data, null, 2);
  byId('detail-secret').hidden = !secret;
  byId('detail-dialog').showModal();
}
async function action(kind, id) {
  try {
    if (kind === 'node-payload-limits') {
      const version=connectionVersion,identity={nodeId:id,scopeId:auth.scope,actorId:account?.actorId};
      const result=await request('GET','nodes/'+encodeURIComponent(id)+'/payload-limits/'+encodeURIComponent(identity.actorId));
      if(version!==connectionVersion)return;
      return detail('当前账号 · 共享带宽与流量配置（只读）',personalPayloadLimitView(result,identity));
    }
    if (kind === 'node-port-usage') {
      const version=connectionVersion,identity={nodeId:id,scopeId:auth.scope,actorId:account?.actorId};
      const result=await request('GET','nodes/'+encodeURIComponent(id)+'/port-usage');
      if(version!==connectionVersion)return;
      return detail('当前账号 · 个人物理端口用量（只读）',personalPortUsageView(result,identity));
    }
    if (kind === 'node-detail') return detail('Node · ' + shortId(id), await request('GET', 'nodes/' + encodeURIComponent(id)));
    if (kind === 'node-diagnostics') return detail('Node · 运行与租约诊断（非链路探测）', await request('GET', 'nodes/' + encodeURIComponent(id) + '/diagnostics'));
    if (kind === 'forward-diagnostics') return forwardDiagnostics.open(id);
    if (kind === 'node-tunnel') return tunnelConsole.open(id);
    if (kind === 'node-telemetry') return telemetryConsole.open(id);
    if (kind === 'forward-telemetry') return forwardTelemetryConsole.open(id);
    if (kind === 'node-host-telemetry') return hostTelemetryConsole.open(id);
    if (kind === 'probe-telemetry') return probeTelemetryConsole.open(id);
    if (kind === 'node-telemetry-aggregate') return telemetryAggregateConsole.openNode(id);
    if (kind === 'forward-telemetry-aggregate') return telemetryAggregateConsole.openForward(id);
    if (kind === 'forward-detail') {
      const record = await request('GET', 'forwards/' + encodeURIComponent(id));
      return detail('Forward · 期望 / 应用 / 健康', record);
    }
    if (kind === 'operation-detail') return detail('Operation · ' + shortId(id), await request('GET', 'operations/' + encodeURIComponent(id)));
    if (kind === 'operation-retry') return await ruleConsole.retry(id);
    const forward = store.forwards.find(f => f.id === id);
    if (!forward) throw new Error('Forward 列表已更新，请刷新');
    if (kind === 'forward-edit') return forward.spec.path?await relayConsole.edit(forward):await editor(forward);
    if (kind === 'forward-copy') return forward.spec.path?await relayConsole.copy(forward):await editor(forward, true);
    if (kind === 'forward-probe') return await probeConsole.open(forward);
    if (kind === 'forward-probe-capabilities') return await probeConsole.openCapabilities(forward);
    if (kind === 'forward-deployment') return await relayConsole.deployment(id);
    if (kind === 'forward-toggle') {
      const result = await mutate('PUT', 'forwards/' + encodeURIComponent(id), { expectedRevision: forward.revision, spec: { ...forward.spec, enabled: !forward.spec.enabled } });
      await Promise.all([load('forwards'), load('operations'), loadOverview()]);
      return notify('已接受状态变更，Operation ' + (result.operationId ?? '无变更'));
    }
    if (kind === 'forward-delete') {
      if (!confirm('确认删除此 Forward？旧执行资源将按安全流程退役，不会立即无条件释放。')) return;
      const result = await mutate('DELETE', 'forwards/' + encodeURIComponent(id), { expectedRevision: forward.revision });
      await Promise.all([load('forwards'), load('operations'), loadOverview()]);
      return notify('已接受删除请求，Operation ' + result.operationId);
    }
  } catch (error) { notify(error.message, true); }
}
async function createNode(event) {
  event.preventDefault();if(privateProvisioning||privateProvisionUnknown)return;
  const version=connectionVersion,form=byId('node-form');
  try {
    connected();
    const policy = {
      allowedListenerAddresses: [form.elements.namedItem('address').value],
      allowedPorts: parsePorts(form.elements.namedItem('ports').value),
      allowedDestinationCidrs: parseCidrs(form.elements.namedItem('cidrs').value),
      allowMetadataTargets: form.elements.namedItem('metadata').checked,
      egressPolicyRevision: 1,
    };
    privateProvisioning=true;byId('node-provision-submit').disabled=true;
    byId('node-provision-state').textContent='正在接入个人私有机器……';
    const result = await request('POST', 'nodes', policy);
    if(version!==connectionVersion)return;
    if(!validScope(result.nodeId)||!/^[A-Za-z0-9_-]{32,128}$/.test(result.enrollmentToken)||!Number.isFinite(Date.parse(result.expiresAt)))throw Error('接入回执无效，原结果仍不确定。');
    form.hidden = true;
    detail('我的私有机器 · 一次性接入凭据', { nodeId: result.nodeId, enrollmentToken: result.enrollmentToken, expiresAt: result.expiresAt }, result.enrollmentToken);
    byId('node-provision-state').textContent='个人私有机器已创建。';
    notify('私有机器已创建；请使用受信任的 Agent 安装流程完成接入。');
    await Promise.all([load('nodes'), loadOverview()]).catch(error=>notify('机器已创建，但列表刷新失败：'+error.message,true));
  } catch (error) {
    if(version===connectionVersion){
      privateProvisionUnknown=privateProvisioning&&![400,401,403,404,409,413,422,429].includes(error.httpStatus);
      byId('node-provision-state').textContent=privateProvisionUnknown?'接入结果不确定，请先核对“我的机器”列表。接入接口没有幂等重放，页面不会自动再创建。':'接入未完成，请检查输入和当前权限。';
      byId('node-provision-reset').hidden=!privateProvisionUnknown;notify(error.message,true);
    }
  }finally{if(version===connectionVersion){privateProvisioning=false;byId('node-provision-submit').disabled=privateProvisionUnknown;}}
}
const relayConsole=initRelayConsole({request,mutate,notify,byId,candidates,load,loadOverview,loadCandidates,detail,display,
  inspectProfile:profile=>transportConsole.open(profile),loadCatalog:()=>transportConsole.catalog(),inspectTunnel:id=>tunnelConsole.open(id)});
const probeConsole=initProbeConsole({request,notify,byId,display,getScope:()=>auth.scope});
const probeRuns=initProbeRuns({request,notify,byId,getScope:()=>auth.scope});
const probePlans=initProbePlans({request,notify,byId,getScope:()=>auth.scope});
const transportConsole=initTransportConsole({request,notify,byId,detail,edit:item=>relayConsole.edit(item),prepareProfileBatch:proposal=>ruleConsole.profileBatch(proposal)});
const ruleConsole=initRuleConsole({request,notify,byId,refresh:()=>Promise.all([load('forwards'),load('operations'),loadOverview()])});
const tunnelConsole=initTunnelConsole({request,notify,byId,deployment:id=>relayConsole.deployment(id)});
const telemetryConsole=initTelemetryConsole({request,notify,byId});
const forwardTelemetryConsole=initForwardTelemetryConsole({request,notify,byId});
const hostTelemetryConsole=initHostTelemetryConsole({request,notify,byId});
const probeTelemetryConsole=initProbeTelemetryConsole({request,notify,byId});
const telemetryAggregateConsole=initTelemetryAggregateConsole({request,notify,byId,getScope:()=>auth.scope});
const pathSwitch=initPathSwitch({request,notify,byId,tunnelManagement:true,preparePathBatch:proposal=>ruleConsole.pathBatch(proposal)});
const pathTemplates=initPathTemplates({request,notify,byId,tunnelManagement:true,onSelectDefinition:value=>{
  if(pathSwitch.selectDefinition(value))byId('path-switch-title').scrollIntoView({block:'start',behavior:'smooth'});
}});
const adminResources=initAdminResourceConsole({request,notify,byId,detail,parsePorts,parseCidrs,canGovern:governance,
  onChanged:()=>Promise.all([load('nodes'),load('operations'),loadOverview(),adminResources.refresh()])});
const resourceLimits=initResourceLimitConsole({request,notify,byId,canGovern:governance,identity:()=>({scopeId:auth.scope})});
const lineBuilder=initLineBuilder({request,notify,byId,loadDraft:value=>pathTemplates.loadDraft(value),useDraft:value=>relayConsole.loadPathDraft(value)});
const pathGroups=initPathGroups({request,notify,byId});
const pathPublications=initPathPublications({request,notify,byId,getScope:()=>auth.scope});
const ingressGroups=initIngressGroups({request,notify,byId,getScope:()=>auth.scope});
const ingressMigrations=initIngressMigrations({request,notify,byId,getScope:()=>auth.scope});
const forwardDiagnostics=initForwardDiagnostics({request,notify,byId,getScope:()=>auth.scope});
const auditConsole=initAuditConsole({request,notify,byId,getScope:()=>auth.scope});
const stationAlerts=initStationAlerts({request,notify,byId,getScope:()=>auth.scope});
const notificationEndpoints=initNotificationEndpoints({request,notify,byId,getScope:()=>auth.scope});
const notificationDeliveries=initNotificationDeliveries({request,notify,byId,getScope:()=>auth.scope});
const observationServices=initObservationServices({request,notify,byId,getScope:()=>auth.scope});
byId('relay-reload').addEventListener('click',()=>pathTemplates.list().catch(error=>notify(error.message,true)));
function clearConnectionData() {
  connectionVersion++;
  for (const key of Object.keys(readVersions)) readVersions[key]++;
  privateProvisioning=false;privateProvisionUnknown=false;byId('node-provision-submit').disabled=false;byId('node-provision-reset').hidden=true;byId('node-provision-state').textContent='';
  currentSecret = null; editing = null; overview = null; forwardStatusCache.clear(); consoleRequests.clearPending();
  candidates.direct = []; candidates.relay = [];
  candidatePages.direct = candidatePages.relay = 1;
  for (const kind of ['nodes', 'forwards', 'operations']) {
    page[kind] = 1; store[kind] = []; totals[kind] = 0; filters[kind] = {};
    byId(kind + '-filter').reset();
    if(kind==='nodes'||kind==='forwards')filters[kind].ownership='mine';
    pagination(kind, { page: 1, limit: 25, total: 0 });
  }
  byId('detail-dialog').close(); byId('detail-content').textContent = '';
  byId('deployment-dialog').close();
  forwardDiagnostics.clear();
  auditConsole.clear();
  probeRuns.clear();
  probePlans.clear();
  stationAlerts.clear();
  notificationEndpoints.clear();
  notificationDeliveries.clear();
  observationServices.clear();
  byId('forward-form').hidden = true; byId('node-form').hidden = true;
  byId('direct-candidate-prefix').value = ''; byId('relay-candidate-prefix').value = '';
  byId('relay-candidate-role').value = 'ingress';
  for (const mode of ['direct', 'relay']) {
    byId(mode + '-candidate-page').textContent = '尚未查询候选';
    byId(mode + '-candidate-prev').disabled = byId(mode + '-candidate-next').disabled = true;
  }
  adminResources.clear();resourceLimits.clear();lineBuilder.clear();
  relayConsole.clear(); probeConsole.clear(); transportConsole.clear(); ruleConsole.clear(); tunnelConsole.clear(); telemetryConsole.clear(); forwardTelemetryConsole.clear(); hostTelemetryConsole.clear(); probeTelemetryConsole.clear(); telemetryAggregateConsole.clear(); pathTemplates.clear(); pathSwitch.clear(); pathGroups.clear(); pathPublications.clear(); ingressGroups.clear(); ingressMigrations.clear(); fillNodes();
  renderNodes(); renderForwards(); renderOperations(); renderForwardPreflight(); updateOverview();
}
async function refreshDirectCandidates() {
  const nodeId = editing?.spec.ingress.nodeId ?? byId('forward-node').value;
  const preferred = { protocol: byId('forward-protocol').value, address: byId('forward-address').value, port: byId('forward-port').value };
  if (!await loadCandidates('direct', [nodeId])) return;
  fillNodes(nodeId);
  if (byId('forward-node').value === nodeId) fillCapabilities(preferred);
  if (editing) byId('forward-node').disabled = true;
  if (nodeId && !candidates.direct.some(n => n.id === nodeId)) {
    byId('forward-node').value = '';
    fillCapabilities();
    throw new Error('当前入口节点的权限、凭据或能力已失效，请重新选择');
  }
}
for (const kind of ['nodes', 'forwards', 'operations']) {
  byId(kind + '-filter').addEventListener('submit', event => {
    event.preventDefault();
    filters[kind] = Object.fromEntries([...new FormData(event.currentTarget)].map(([key, value]) => [key, String(value).trim()]));
    page[kind] = 1;
    if(kind==='nodes')nodeOwnership=filters.nodes.ownership;
    load(kind).catch(error => notify(error.message, true));
  });
}
for (const mode of ['direct', 'relay']) {
  const reload = () => (mode === 'direct' ? refreshDirectCandidates() : relayConsole.refreshCandidates()).catch(error => notify(error.message, true));
  byId(mode + '-candidate-search').addEventListener('click', () => { candidatePages[mode] = 1; reload(); });
  if(mode==='relay')byId('relay-candidate-role').addEventListener('change',()=>{candidatePages.relay=1;reload();});
  for (const [suffix, direction] of [['prev', -1], ['next', 1]])
    byId(mode + '-candidate-' + suffix).addEventListener('click', () => { candidatePages[mode] += direction; reload(); });
  byId(mode + '-candidate-prefix').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); candidatePages[mode] = 1; reload(); }
  });
}
document.querySelectorAll('.nav').forEach(node => node.addEventListener('click', () => {
  if(node.hidden)return;
  if (node.dataset.view !== 'notifications') notificationEndpoints.leave();
  display(node.dataset.view);
  if(node.dataset.view==='resources'&&auth.scope)adminResources.refresh();
  if(['nodes','available'].includes(node.dataset.view)&&auth.scope)load('nodes').catch(e=>notify(e.message,true));
  if(node.dataset.view==='relay' && auth.scope) Promise.all([relayConsole.refresh(),pathTemplates.list()]).catch(e=>notify(e.message,true));
}));
for (const [id, view] of [['ops-audit', 'audit'], ['ops-alerts', 'alerts'], ['ops-notifications', 'notifications'],
  ['ops-operations', 'operations'], ['ops-forwards', 'forwards']])
  byId(id).addEventListener('click', () => { if (view !== 'notifications') notificationEndpoints.leave(); display(view); });
for (const [id, anchor] of [['topology-templates', 'tunnel-definition-title'], ['topology-groups', 'path-group-title'],
  ['topology-publications', 'path-publication-title'], ['topology-ingress', 'ingress-migration-title']])
  byId(id).addEventListener('click', () => {
    [...document.querySelectorAll('.nav')].find(node => node.dataset.view === 'relay')?.click();
    byId(anchor).scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
function updateAccountNavigation() {
  document.querySelectorAll('[data-governance]').forEach(node=>{node.hidden=!governance();});
  const scope=selectedScope();
  byId('scope-status').textContent=scope?('角色：'+({owner:'所有者',manager:'成员管理者',viewer:'只读成员'})[scope.role]+'；成员状态：'+scope.membership+'；'+(scope.canEnter?'可以进入':'当前不可进入')):'选择一个可进入的工作空间。';
}
function scopeOptions(values) {
  const select=byId('scope');select.replaceChildren();
  const empty=element('option','选择工作空间');empty.value='';select.append(empty);
  for(const scope of values){
    const option=element('option',scope.scopeId+' · '+({owner:'所有者',manager:'成员管理者',viewer:'只读成员'})[scope.role]+' · '+scope.membership+(scope.canEnter?'':' · 不可进入'));
    option.value=scope.scopeId;option.disabled=!scope.canEnter;select.append(option);
  }
  select.value=auth.scope;select.disabled=!values.some(scope=>scope.canEnter);
}
async function enterScope(scopeId) {
  const scope=account?.scopes.find(item=>item.scopeId===scopeId&&item.canEnter);
  clearConnectionData();auth.scope=scope?.scopeId??'';
  byId('refresh').disabled=!scope;updateAccountNavigation();display('overview');
  if(scope)await refresh();
}
async function accountPageRead(token,after=null) {
  const version=++accountEpoch;
  accountController?.abort();accountController=new AbortController();
  const value=await readIdentityContext(token,{after,signal:accountController.signal});
  if(version!==accountEpoch)return false;
  if(after&&account?.actorId!==value.actorId)throw Error('账号已变化，请重新登录');
  const retained=after?account.scopes.find(scope=>scope.scopeId===auth.scope):null;
  account={...value,scopes:retained&&!value.scopes.some(scope=>scope.scopeId===retained.scopeId)?[retained,...value.scopes]:value.scopes};
  accountPage=value;byId('account-context').hidden=false;byId('account-actor').textContent='当前账号：'+value.actorId;
  scopeOptions(account.scopes);byId('scope-more').hidden=!value.truncated;
  if(!account.scopes.some(scope=>scope.canEnter))byId('scope-status').textContent='当前页没有可进入的工作空间。可读取下一页，或联系所有者恢复成员资格。';
  return true;
}
byId('connection-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const token=byId('token').value.trim();
  if(!/^[A-Za-z0-9_-]{32,128}$/.test(token))return notify('Bearer Token 格式不正确',true);
  auth.scope='';auth.token='';account=null;accountPage=null;clearConnectionData();updateAccountNavigation();
  byId('account-context').hidden=true;byId('refresh').disabled=true;byId('disconnect').disabled=false;
  byId('connection-indicator').textContent='正在读取账号';byId('token').value='';
  const loginEpoch=accountEpoch+1;
  try {
    if(!await accountPageRead(token))return;
    auth.token=token;byId('connection-indicator').textContent='账号已认证，选择工作空间';
    const first=account.scopes.find(scope=>scope.canEnter);
    if(first){byId('scope').value=first.scopeId;await enterScope(first.scopeId);}
  }catch(error){if(loginEpoch===accountEpoch){notify(error.message,true);byId('connection-indicator').textContent='登录未完成';}}
});
byId('scope').addEventListener('change',()=>enterScope(byId('scope').value));
byId('scope-more').addEventListener('click',async()=>{
  if(!auth.token||!accountPage?.nextAfter)return;
  const version=accountEpoch+1;
  byId('scope-more').disabled=true;
  try{await accountPageRead(auth.token,accountPage.nextAfter);}catch(error){if(version===accountEpoch)notify(error.message,true);}
  finally{byId('scope-more').disabled=false;}
});
byId('disconnect').addEventListener('click',()=>{
  accountEpoch++;accountController?.abort();account=null;accountPage=null;auth.scope='';auth.token='';clearConnectionData();updateAccountNavigation();
  byId('scope').replaceChildren();byId('token').value='';byId('account-context').hidden=true;
  byId('refresh').disabled=true;byId('disconnect').disabled=true;byId('connection-indicator').textContent='未连接';display('overview');
  notify('已断开连接；当前标签页中的 Bearer Token 已清除。');
});
byId('resource-operations').addEventListener('click',()=>{display('operations');load('operations').catch(error=>notify(error.message,true));});
byId('refresh').addEventListener('click', refresh);
byId('show-node-form').addEventListener('click', () => { byId('node-form').hidden = false; });
byId('node-provision-reset').addEventListener('click',()=>{
  if(privateProvisioning||!privateProvisionUnknown||!confirm('已核对个人机器列表和原接入结果，明确准备另一条接入？这不会撤销或重放原请求。'))return;
  privateProvisionUnknown=false;byId('node-provision-submit').disabled=false;byId('node-provision-reset').hidden=true;byId('node-provision-state').textContent='可准备新的个人接入。';
});
byId('cancel-node').addEventListener('click', () => { byId('node-form').hidden = true; });
byId('node-form').addEventListener('submit', createNode);
byId('show-forward-form').addEventListener('click', () => editor(null).catch(e => notify(e.message, true)));
byId('cancel-forward').addEventListener('click', () => {
  readVersions['candidates-direct'] = (readVersions['candidates-direct'] ?? 0) + 1;
  editing = null; byId('forward-form').hidden = true;
});
byId('forward-node').addEventListener('change', () => fillCapabilities());
byId('forward-protocol').addEventListener('change', () => renderForwardPreflight());
byId('forward-form').addEventListener('submit', saveForward);
byId('close-detail').addEventListener('click', () => byId('detail-dialog').close());
byId('detail-dialog').addEventListener('close', () => { currentSecret = null; byId('detail-content').textContent = ''; });
byId('copy-secret').addEventListener('click', async () => {
  if (!currentSecret) return;
  try { await navigator.clipboard.writeText(currentSecret); notify('一次性 Token 已复制。'); }
  catch { notify('复制失败，请手动复制后妥善保管。', true); }
});
document.addEventListener('click', event => {
  const target = event.target.closest('button[data-action]');
  if (!target) return;
  const kind = target.dataset.action;
  if (kind.startsWith('prev-') || kind.startsWith('next-')) {
    const direction = kind.startsWith('prev-') ? -1 : 1;
    const resource = kind.substring(5);
    if (!Object.hasOwn(page, resource)) return;
    page[resource] += direction;
    load(resource).catch(error => notify(error.message, true));
  } else action(kind, target.dataset.id);
});
updateAccountNavigation();
display('overview');

}
