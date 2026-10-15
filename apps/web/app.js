import { validScope, parsePorts, parseCidrs, directCapable, allowedProtocols, directSpec, stateTone, pageCount } from './model.js';
import { initRelayConsole } from './relay.js';

const byId = id => document.getElementById(id);
const auth = { scope: '', token: '' };
const page = { nodes: 1, forwards: 1, operations: 1 };
const store = { nodes: [], forwards: [], operations: [] };
const totals = { nodes: 0, forwards: 0, operations: 0 };
const pendingKeys = new Map();
let currentView = 'overview';
let editing = null;
let currentSecret = null;

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
function connected() {
  if (!auth.scope || !auth.token) throw new Error('请先连接 Control');
}
function endpoint(resource) {
  return '/api/v1/scopes/' + encodeURIComponent(auth.scope) + '/' + resource;
}
async function request(method, resource, input, stableKey) {
  connected();
  const headers = { Authorization: 'Bearer ' + auth.token, Accept: 'application/json' };
  if (input !== undefined) headers['Content-Type'] = 'application/json';
  if (stableKey) headers['Idempotency-Key'] = stableKey;
  const response = await fetch(endpoint(resource), {
    method, headers, credentials: 'omit', cache: 'no-store', redirect: 'error',
    referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(15000),
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  let result;
  try { result = await response.json(); } catch { throw new Error('Control 返回了非 JSON 响应'); }
  if (!response.ok) throw new Error(String(result.code ?? 'HTTP_' + response.status) + '：' + String(result.message ?? '请求失败'));
  return result;
}
async function mutate(method, resource, input) {
  const signature = JSON.stringify([method, resource, input]);
  if (!pendingKeys.has(signature)) pendingKeys.set(signature, crypto.randomUUID());
  const result = await request(method, resource, input, pendingKeys.get(signature));
  pendingKeys.delete(signature);
  return result;
}
function display(view) {
  currentView = view;
  const labels = { overview: '运行概览', nodes: '节点管理', forwards: '转发管理', relay: 'Relay 链路', operations: '执行记录' };
  byId('page-title').textContent = labels[view] || labels.overview;
  document.querySelectorAll('.view').forEach(node => { node.hidden = node.id !== 'view-' + view; });
  document.querySelectorAll('.nav').forEach(node => { node.classList.toggle('active', node.dataset.view === view); });
}
async function load(kind) {
  const result = await request('GET', kind + '?page=' + page[kind] + '&limit=25');
  store[kind] = result.items;
  totals[kind] = result.total;
  if (kind === 'nodes') { renderNodes(); relayConsole.populateNodes(); }
  if (kind === 'forwards') renderForwards();
  if (kind === 'operations') renderOperations();
  pagination(kind, result);
  updateOverview();
}
async function refresh() {
  try {
    connected();
    await Promise.all(['nodes', 'forwards', 'operations'].map(load));
    byId('connection-indicator').textContent = '已认证 · ' + auth.scope;
    notify('数据已从 Control 更新；列表中的 Operation 状态不代表独立探测成功。');
  } catch (error) {
    notify(error.message || '加载失败', true);
  }
}
function updateOverview() {
  byId('metric-nodes').textContent = String(totals.nodes);
  byId('metric-forwards').textContent = String(totals.forwards);
  byId('metric-running').textContent = String(store.operations.filter(o => ['running', 'accepted'].includes(o.status)).length);
  byId('metric-failed').textContent = String(store.operations.filter(o => o.status === 'failed').length);
}
function pagination(kind, result) {
  const container = byId(kind + '-pagination');
  container.replaceChildren();
  const previous = button('上一页', 'prev-' + kind);
  previous.className = 'secondary';
  previous.disabled = result.page <= 1;
  const next = button('下一页', 'next-' + kind);
  next.className = 'secondary';
  next.disabled = result.page >= pageCount(result.total, result.limit);
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
    const expired = node.credentialUntil ? new Date(node.credentialUntil).getTime() <= Date.now() : true;
    cell(tr, node.revoked ? label('已撤销', 'bad') : expired ? label('未注册 / 凭据失效', 'progress') : label('凭据有效', 'good'));
    const recent = node.lastReportAt && Date.now() - Date.parse(node.lastReportAt) < 60000;
    const report = cell(tr, label(recent ? '报告较新' : '未知 / 过期', recent ? 'good' : ''));
    report.append(element('div', date(node.lastReportAt), 'subline'));
    cell(tr, element('span', (node.policy?.capabilities ?? []).join(', ') || '等待 Agent 上报', 'mono'));
    const actionCell=cell(tr);
    const actionGroup=element('div',undefined,'cell-actions');
    actionGroup.append(button('详情','node-detail',node.id,'secondary'),button('诊断','node-diagnostics',node.id,'secondary'));
    actionCell.append(actionGroup);
    tbody.append(tr);
  }
  fillNodes();
}
function renderForwards() {
  const tbody = byId('forward-rows');
  tbody.replaceChildren();
  if (!store.forwards.length) { const tr = element('tr'); const t = cell(tr, element('span', '暂无 Forward', 'empty')); t.colSpan = 6; tbody.append(tr); }
  for (const item of store.forwards) {
    const tr = element('tr');
    const a = item.spec;
    const entry = cell(tr, element('div', a.ingress.nodeId.slice(0, 13), 'mono cell-title'));
    entry.append(element('div', a.ingress.listen.address + ':' + a.ingress.listen.port, 'subline'));
    const target = cell(tr, element('div', a.target.host + ':' + a.target.port, 'cell-title'));
    target.append(element('div', 'r' + item.revision + (a.path ? ' · '+(a.path.via.length+1)+' 节点链路' : ' · Direct'), 'subline'));
    cell(tr, label(a.protocols.join(' + ').toUpperCase(), ''));
    cell(tr, label(item.recoverySuspended ? '恢复挂起' : a.enabled ? '希望启用' : '希望停用', item.recoverySuspended ? 'progress' : ''));
    const operation = cell(tr, item.lastOperation ? label(item.lastOperation.status) : label('无操作记录'));
    if (item.lastOperation) operation.append(button('查看', 'operation-detail', item.lastOperation.id, 'secondary'));
    const action = cell(tr);
    const group = element('div', undefined, 'cell-actions');
    group.append(button('详情', 'forward-detail', item.id, 'secondary'));
    group.append(button('编辑', 'forward-edit', item.id, 'secondary'));
    if(a.path)group.append(button('部署进度', 'forward-deployment', item.id, 'secondary'));
    group.append(button(a.enabled ? '停用' : '启用', 'forward-toggle', item.id, 'secondary'), button('删除', 'forward-delete', item.id, 'secondary'));
    action.append(group);
    tbody.append(tr);
  }
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
  const choices = store.nodes.filter(directCapable);
  const select = byId('forward-node');
  addOptions(select, choices.map(n => ({ value: n.id, label: shortId(n.id) + ' · ' + n.policy.capabilities.filter(x => x === 'tcp' || x === 'udp').join('/') })), preferred);
  fillCapabilities();
}
function fillCapabilities(preferred) {
  const node = store.nodes.find(n => n.id === byId('forward-node').value);
  const protocols = node ? allowedProtocols(node) : [];
  addOptions(byId('forward-protocol'), protocols.map(p => ({ value: p, label: p === 'both' ? 'TCP + UDP' : p.toUpperCase() })), preferred?.protocol);
  addOptions(byId('forward-address'), (node?.policy?.allowedListenerAddresses ?? []).map(a => ({ value: a })), preferred?.address);
  addOptions(byId('forward-port'), (node?.policy?.allowedPorts ?? []).map(p => ({ value: p })), preferred?.port);
  byId('forward-capabilities').textContent = node ? '可用监听地址和端口由当前 Node Policy 决定，服务端会再次检查授权、目标 CIDR 与资源独占。' : '没有具备 ADP/3 Direct 能力和有效凭据的节点；请先接入 Agent。';
  byId('save-forward').disabled = !node;
}
function editor(item) {
  editing = item ?? null;
  const form = byId('forward-form');
  form.reset();
  byId('forward-form-title').textContent = item ? '编辑 Direct Forward · r' + item.revision : '创建 Direct Forward';
  form.hidden = false;
  byId('forward-node').disabled = false;
  if (item) {
    if (item.spec.path) throw new Error('Relay 编辑需要完整的 Transport Profile，当前表单仅支持 Direct');
    fillNodes(item.spec.ingress.nodeId);
    fillCapabilities({ protocol: item.spec.protocols.length === 2 ? 'both' : item.spec.protocols[0], address: item.spec.ingress.listen.address, port: item.spec.ingress.listen.port });
    byId('forward-node').disabled = true;
    form.elements.namedItem('targetHost').value = item.spec.target.host;
    form.elements.namedItem('targetPort').value = String(item.spec.target.port);
    form.elements.namedItem('enabled').checked = item.spec.enabled;
  } else fillNodes();
  display('forwards');
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
async function saveForward(event) {
  event.preventDefault();
  try {
    const form = byId('forward-form');
    const nodeId = editing ? editing.spec.ingress.nodeId : form.elements.namedItem('node').value;
    const node = store.nodes.find(n => n.id === nodeId);
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
    await Promise.all([load('forwards'), load('operations')]);
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
    if (kind === 'node-detail') return detail('Node · ' + shortId(id), await request('GET', 'nodes/' + encodeURIComponent(id)));
    if (kind === 'node-diagnostics') return detail('Node · 运行与租约诊断（非链路探测）', await request('GET', 'nodes/' + encodeURIComponent(id) + '/diagnostics'));
    if (kind === 'forward-detail') {
      const record = await request('GET', 'forwards/' + encodeURIComponent(id));
      return detail('Forward · 期望 / 应用 / 健康', record);
    }
    if (kind === 'operation-detail') return detail('Operation · ' + shortId(id), await request('GET', 'operations/' + encodeURIComponent(id)));
    const forward = store.forwards.find(f => f.id === id);
    if (!forward) throw new Error('Forward 列表已更新，请刷新');
    if (kind === 'forward-edit') return forward.spec.path?await relayConsole.edit(forward):editor(forward);
    if (kind === 'forward-deployment') return await relayConsole.deployment(id);
    if (kind === 'forward-toggle') {
      const result = await mutate('PUT', 'forwards/' + encodeURIComponent(id), { expectedRevision: forward.revision, spec: { ...forward.spec, enabled: !forward.spec.enabled } });
      await Promise.all([load('forwards'), load('operations')]);
      return notify('已接受状态变更，Operation ' + (result.operationId ?? '无变更'));
    }
    if (kind === 'forward-delete') {
      if (!confirm('确认删除此 Forward？旧执行资源将按安全流程退役，不会立即无条件释放。')) return;
      const result = await mutate('DELETE', 'forwards/' + encodeURIComponent(id), { expectedRevision: forward.revision });
      await Promise.all([load('forwards'), load('operations')]);
      return notify('已接受删除请求，Operation ' + result.operationId);
    }
  } catch (error) { notify(error.message, true); }
}
async function createNode(event) {
  event.preventDefault();
  try {
    const form = byId('node-form');
    const policy = {
      allowedListenerAddresses: [form.elements.namedItem('address').value],
      allowedPorts: parsePorts(form.elements.namedItem('ports').value),
      allowedDestinationCidrs: parseCidrs(form.elements.namedItem('cidrs').value),
      allowMetadataTargets: form.elements.namedItem('metadata').checked,
      egressPolicyRevision: 1,
    };
    const result = await mutate('POST', 'nodes', policy);
    form.hidden = true;
    await load('nodes');
    detail('Node · 一次性注册凭据', { nodeId: result.nodeId, enrollmentToken: result.enrollmentToken, expiresAt: result.expiresAt }, result.enrollmentToken);
    notify('节点已创建；请使用受信任的 Agent 安装流程完成 Enrollment。');
  } catch (error) { notify(error.message, true); }
}
const relayConsole=initRelayConsole({request,mutate,notify,byId,store,load,detail,display});
document.querySelectorAll('.nav').forEach(node => node.addEventListener('click', () => {
  display(node.dataset.view);
  if(node.dataset.view==='relay' && auth.scope) relayConsole.refresh().catch(e=>notify(e.message,true));
}));
byId('connection-form').addEventListener('submit', async event => {
  event.preventDefault();
  const scope = byId('scope').value.trim();
  const token = byId('token').value.trim();
  if (!validScope(scope) || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) return notify('Scope 或 Token 格式不正确', true);
  auth.scope = scope;
  auth.token = token;
  byId('token').value = '';
  byId('refresh').disabled = false;
  byId('disconnect').disabled = false;
  page.nodes = page.forwards = page.operations = 1;
  await refresh();
});
byId('disconnect').addEventListener('click', () => {
  auth.scope = ''; auth.token = ''; currentSecret = null; pendingKeys.clear();
  store.nodes = []; store.forwards = []; store.operations = [];
  totals.nodes = totals.forwards = totals.operations = 0;
  byId('scope').value = ''; byId('token').value = '';
  byId('refresh').disabled = true; byId('disconnect').disabled = true;
  byId('connection-indicator').textContent = '未连接';
  byId('detail-dialog').close(); byId('detail-content').textContent = '';
  byId('forward-form').hidden = true; byId('node-form').hidden = true;
  relayConsole.clear();
  renderNodes(); renderForwards(); renderOperations(); updateOverview();
  notify('已断开连接；当前标签页中的 Bearer Token 已清除。');
});
byId('refresh').addEventListener('click', refresh);
byId('show-node-form').addEventListener('click', () => { byId('node-form').hidden = false; });
byId('cancel-node').addEventListener('click', () => { byId('node-form').hidden = true; });
byId('node-form').addEventListener('submit', createNode);
byId('show-forward-form').addEventListener('click', () => { try { editor(null); } catch (e) { notify(e.message, true); } });
byId('cancel-forward').addEventListener('click', () => { editing = null; byId('forward-form').hidden = true; });
byId('forward-node').addEventListener('change', () => fillCapabilities());
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
display('overview');
