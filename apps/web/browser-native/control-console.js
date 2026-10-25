import { initAdminResourceConsole, personalPortUsageView } from '../admin-resource-console.js';
import { initResourceLimitConsole, personalPayloadLimitView } from '../resource-limit-console.js';
import { initMemberConsole } from '../member-console.js';
import { initAccountCredentials } from '../account-credentials.js';
import { workflowSteps, createBoundedPageReads } from '../task-workflow.js';
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
const governanceViews = new Set(['resources','members','audit','alerts','notifications','observation-services']);
let memberConsole = null;
let accountCredentials = null;
let boundedReads = null;
let boundedReading = false, pageRefresh = null, loginAttempt = null;
const coreViews = new Set(['overview','nodes','available','forwards','operations']);
const pageGuides = {
  overview: { title:'运行概览', detail:'先看下一步建议，再按需要检查执行进度和转发状态。数量与历史失败不代表当前业务健康。', refresh:'刷新概览与核心列表' },
  nodes: { title:'我的机器', detail:'接入自己的机器，保存一次性接入凭据，再确认 Agent 报告和使用权限。', refresh:'刷新我的机器' },
  available: { title:'可用资源', detail:'查看自己可使用的私有机器与共享资源。用途授权不包含共享机器的主机管理权限。', refresh:'刷新可用资源' },
  forwards: { title:'我的转发', detail:'先筛选规则，再检查状态、编辑或批量操作。提交回执与实际生效结果分开确认。', refresh:'刷新转发列表' },
  operations: { title:'执行记录', detail:'按规则与状态查询执行进度，遇到异常可回到对应转发的诊断。历史失败不代表当前故障。', refresh:'刷新执行记录' },
  relay: { title:'我的线路', detail:'用画布添加节点并连接转发链，再载入原表单验证计划。线路发布、切换和迁移可通过本页分区前往。', refresh:'读取线路列表' },
  probes: { title:'受限探测', detail:'先在转发列表选择规则和探测方式。一次性任务、历史回执与计划分别操作，读取历史不会新建探测。' },
  resources: { title:'共享资源管理', detail:'先读取资源，再选择机器和成员配置用途或额度。共享接入、授权、限额和命令回执分区管理。', refresh:'读取共享资源' },
  members: { title:'工作空间成员', detail:'先读取成员，再加入或修改账号。成员身份与共享资源授权分别管理；新账号凭据须安全保存。', refresh:'读取成员列表' },
  audit: { title:'管理审计', detail:'设置时间窗口和目标后手动查询。下一页沿用原窗口，查询审计不会改变规则或执行状态。' },
  alerts: { title:'站内事件', detail:'先区分政策配置与事件历史。确认事件、静默通知和修改政策是不同操作。' },
  notifications: { title:'通知配置与投递', detail:'端点配置与投递历史分开查看。保存端点不会发送测试通知；离开本页会清除秘密草稿。' },
  'observation-services': { title:'观测服务声明', detail:'先读取声明，再准备公有配置并确认发布。声明可用不代表服务在线，也不会自动授予探测许可。' },
};
const pageSections = {
  overview: [['下一步','workflow-guide-title'],['运行检查','ops-title'],['拓扑入口','topology-entry-title']],
  nodes: [['机器列表','nodes-title'],['接入说明','node-enrollment-guide']],
  relay: [['转发链画布','line-builder-title'],['线路列表','tunnel-definition-title'],['创建转发','relay-forward-title'],['候选组','path-group-title'],
    ['组发布','path-publication-title'],['入口组','ingress-title'],['入口迁移','ingress-migration-title'],['规则切换','path-switch-title'],['底层配置','transport-profile-title']],
  probes: [['一次性任务','probe-command-title'],['任务回执','probe-receipt-title'],['探测历史','probe-run-title'],['有限计划','probe-plan-title']],
  resources: [['共享接入','resource-provision-title'],['资源列表','resource-list-title'],['用途授权','resource-grant-title'],['带宽与流量','payload-title'],['命令回执','resource-command-title']],
  members: [['成员列表','member-list-title'],['加入或修改','member-form-title']],
  audit: [['查询条件','audit-form'],['审计结果','audit-result-title']],
  notifications: [['端点配置','notification-endpoint-title'],['投递历史','notification-delivery-title']],
  alerts: [['政策配置','station-alert-policy-title'],['事件历史','station-alert-history-title']],
  'observation-services': [['读取声明','observation-service-query-title'],['准备与发布','observation-service-config-title']],
};
const selectedScope = () => account?.scopes.find(item => item.scopeId === auth.scope);
const governance = () => scopeGovernance(selectedScope());
const page = { nodes: 1, forwards: 1, operations: 1 };
const store = { nodes: [], forwards: [], operations: [] };
const candidates = { direct: [], relay: [] };
const candidatePages = { direct: 1, relay: 1 };
const filters = { nodes: {}, forwards: {}, operations: {} };
const nodeViewState = new Map();
const listPresets = {
  'forwards-all': ['forwards', { enabled: '', recoverySuspended: '' }],
  'forwards-disabled': ['forwards', { enabled: 'false', recoverySuspended: '' }],
  'forwards-suspended': ['forwards', { enabled: '', recoverySuspended: 'true' }],
  'operations-all': ['operations', { status: '' }],
  'operations-accepted': ['operations', { status: 'accepted' }],
  'operations-running': ['operations', { status: 'running' }],
  'operations-failed': ['operations', { status: 'failed' }],
};
const operationLabels = { accepted: '已接收', running: '执行中', succeeded: '执行完成', failed: '执行失败', superseded: '已被替代' };
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
let forwardWrite = null;
const forwardWriteButtons = new Set();

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
function updatePageControls() {
  const guide = pageGuides[currentView], signedIn = !!auth.scope && !!auth.token;
  const busy = pageRefresh?.view === currentView && pageRefresh.version === connectionVersion;
  byId('page-guidance').textContent = signedIn ? guide.detail : '先登录账号并选择可进入的工作空间，再使用本页功能。';
  byId('refresh').textContent = busy ? '正在读取…' : guide.refresh ?? '使用页内读取';
  byId('refresh').disabled = !signedIn || !guide.refresh || busy;
  byId('refresh').setAttribute('aria-busy', String(busy));
  document.querySelectorAll('.view').forEach(node => node.setAttribute('aria-busy', String(busy && node.id === 'view-' + (currentView === 'available' ? 'nodes' : currentView))));
  byId('refresh').title = guide.refresh ? '只读取本按钮标明的内容，不提交配置变更。' : '本页有多个独立查询区，请使用对应分区内的读取按钮。';
  byId('read-session-start').disabled = !signedIn || !coreViews.has(currentView) || boundedReading;
  byId('read-session-start').title = !coreViews.has(currentView) ? '本页请使用相应分区内的读取按钮。' : '每 10 秒读取当前页，最多 6 次；不会提交变更。';
}
async function refreshCurrentPage() {
  if (!pageGuides[currentView].refresh) return;
  const view = currentView, version = connectionVersion;
  if (pageRefresh?.view === view && pageRefresh.version === version) return;
  const reading = { view, version }; pageRefresh = reading; updatePageControls();
  byId('page-read-state').textContent = '正在读取本页数据…';
  try {
    connected();
    if (view === 'overview') { if (!await refresh()) throw Error('部分数据读取失败，请查看提示并重新刷新；当前结果可能不完整。'); }
    else if (['nodes','available','forwards','operations'].includes(view)) {
      const loaded = await load(view === 'available' ? 'nodes' : view);
      if (!loaded) {
        if (version === connectionVersion && currentView === view) byId('page-read-state').textContent = '本次读取已被新的筛选或翻页替代，请查看列表查询状态。';
        return;
      }
    }
    else if (view === 'relay') await pathTemplates.list();
    else if (view === 'resources') await adminResources.refresh();
    else if (view === 'members') await memberConsole.read();
    if (version === connectionVersion && currentView === view)
      byId('page-read-state').textContent = '本页读取完成 · ' + new Date().toLocaleTimeString('zh-CN') + '。结果对应本次读取，后续变化需重新刷新。';
  } catch (error) { if (version === connectionVersion && currentView === view) {
    byId('page-read-state').textContent = '本次读取未完成；可再次点击刷新。已显示的数据可能来自上次读取。';
    notify(error.message, true);
  } }
  finally { if (pageRefresh === reading) { pageRefresh = null; updatePageControls(); } }
}
function forwardWriteLocked() { return forwardWrite?.active === true || forwardWrite?.state === 'unknown'; }
function forwardWriteButton(value, kind, id, extra = 'secondary') {
  const control = button(value, kind, id, extra); control.disabled = forwardWriteLocked();
  forwardWriteButtons.add(control); return control;
}
function renderForwardWrite() {
  const command = forwardWrite, locked = forwardWriteLocked();
  for (const control of forwardWriteButtons) control.disabled = locked;
  byId('show-forward-form').disabled = locked;
  byId('save-forward').disabled = locked || !candidates.direct.some(node => node.id === byId('forward-node').value);
  byId('save-forward').textContent = command?.active ? '提交中…' : command?.state === 'unknown' ? '先核对上次结果' : '提交操作';
  const panel = byId('forward-write-result'); panel.hidden = !command; panel.dataset.state = command?.state ?? '';
  if (!command) {
    byId('forward-write-message').textContent = ''; byId('forward-write-detail').textContent = '';
    byId('forward-write-records').disabled = true; byId('forward-write-dismiss').disabled = true; return;
  }
  const text = command.state === 'sending' ? command.label + '请求提交中，请勿重复操作。' :
    command.state === 'accepted' ? command.result.operationId === null ? '配置无需变更，没有产生新的部署操作。' :
      command.label + '请求已接收。操作 ' + command.result.operationId + '，仍需确认部署与实际转发结果。' :
    command.state === 'rejected' ? '请求被拒绝，请查看原因并核对当前权限和规则版本。' :
      '提交结果未知，可能已经被接收。先核对转发和执行记录；当前暂停新的单条提交。';
  byId('forward-write-message').textContent = text + (command.refreshFailed ? ' 列表刷新失败，原回执已保留；可手动刷新，不必再次提交。' :
    command.state === 'accepted' && command.active ? ' 正在更新列表。' : '');
  byId('forward-write-detail').textContent = JSON.stringify({ method: command.method, resource: command.resource, input: command.input,
    result: command.result ?? null, error: command.error ?? null }, null, 2);
  byId('forward-write-records').disabled = command.state === 'sending' || !command.forwardId;
  byId('forward-write-dismiss').disabled = command.active;
  byId('forward-write-dismiss').textContent = command.state === 'unknown' ? '已核对，准备新操作' : '收起回执';
}
async function submitForwardWrite(label, method, resource, input, forwardId, onAccepted) {
  connected();
  if (forwardWriteLocked()) { notify('请先等待当前提交结束，或核对上次未知结果。', true); return; }
  const command = { label, method, resource, input: JSON.parse(JSON.stringify(input)), forwardId,
    version: connectionVersion, active: true, state: 'sending' };
  forwardWrite = command; renderForwardWrite();
  byId('forward-write-result').scrollIntoView({ block: 'nearest' });
  const current = () => forwardWrite === command && connectionVersion === command.version;
  try {
    try { command.result = await mutate(method, resource, command.input); }
    catch (error) {
      if (!current()) return;
      command.state = [400,401,403,404,409,413,422,429].includes(error.httpStatus) ? 'rejected' : 'unknown';
      command.error = String(error.message ?? '未取得提交回执').slice(0, 500); return;
    }
    if (!current()) return;
    const result = command.result, validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
    if (!result || !validId(result.forwardId) || (forwardId && result.forwardId !== forwardId) ||
        !Number.isSafeInteger(result.revision) || result.revision < 1 || !(result.operationId === null || validId(result.operationId)) ||
        result.revision !== (method === 'POST' ? 1 : command.input.expectedRevision + (result.operationId === null ? 0 : 1)) ||
        (method !== 'PUT' && result.operationId === null)) {
      command.state = 'unknown'; command.error = '回执与原请求不匹配，请核对原操作，不要据此重复创建或替换命令。'; return;
    }
    command.forwardId = result.forwardId; command.state = 'accepted'; onAccepted?.(); renderForwardWrite();
    try { await Promise.all([load('forwards'), load('operations'), loadOverview()]); }
    catch { if (current()) command.refreshFailed = true; }
  } finally { if (current()) { command.active = false; renderForwardWrite(); } }
}
function display(view, focus = false) {
  if (!Object.hasOwn(pageGuides, view)) return;
  if(governanceViews.has(view)&&!governance())return;
  const changed = currentView !== view;
  if (changed) byId('page-read-state').textContent = '';
  if (changed && ['nodes','available'].includes(currentView))
    nodeViewState.set(currentView, { filters: { ...filters.nodes }, page: page.nodes });
  if(currentView!==view)boundedReads?.stop('page-changed');
  if(currentView==='members'&&view!=='members')memberConsole?.leave();
  if(view==='nodes'||view==='available'){
    nodeOwnership=view==='available'?'available':'mine';
    if (changed) {
      const saved = nodeViewState.get(view);
      filters.nodes = saved ? { ...saved.filters } : { ownership: nodeOwnership };
      page.nodes = saved?.page ?? 1;
      readVersions.nodes = (readVersions.nodes ?? 0) + 1;
      store.nodes = []; totals.nodes = 0;
      const form = byId('nodes-filter'); form.reset();
      for (const [name, value] of Object.entries(filters.nodes)) form.elements.namedItem(name).value = value;
      byId('nodes-query-status').textContent = '尚未读取本页筛选结果；请使用刷新或应用筛选。';
      pagination('nodes', { page: page.nodes, limit: 25, total: 0 });
    }
    nodeOwnership = filters.nodes.ownership ?? nodeOwnership;
    byId('nodes-filter').elements.namedItem('ownership').value=nodeOwnership;
    byId('nodes-title').textContent=view==='available'?'可用资源':'我的机器';
    byId('nodes-description').textContent=view==='available'?'按当前账号授权列出私有机器与管理员共享资源；用途限制不授予整机管理权限。':'管理归属于我的私有机器与接入凭据。';
    byId('show-node-form').hidden=view==='available';
  }
  currentView = view;
  if (changed && ['nodes','available'].includes(view)) renderNodes();
  byId('page-title').textContent = pageGuides[view].title;
  document.querySelectorAll('.view').forEach(node => { node.hidden = node.id !== 'view-' + (view==='available'?'nodes':view); });
  document.querySelectorAll('.nav').forEach(node => {
    node.classList.toggle('active', node.dataset.view === view);
    node.ariaCurrent = node.dataset.view === view ? 'page' : null;
  });
  const sections = byId('page-sections'); sections.replaceChildren();
  for (const [name, anchor] of pageSections[view] ?? []) sections.append(button(name, 'page-section', anchor, 'secondary'));
  sections.hidden = sections.children.length === 0; updatePageControls();
  if (!coreViews.has(view)) byId('read-session-state').textContent = '本页不支持临时自动刷新，请使用对应分区内的读取按钮；定位分区不会发起探测或提交变更。';
  if (focus) { byId('page-title').focus({ preventScroll: true }); byId('page-title').scrollIntoView({ block: 'start' }); }
}
async function load(kind,guard) {
  if(!guard||typeof guard.isCurrent!=='function')guard=undefined;
  const version = readVersions[kind] = (readVersions[kind] ?? 0) + 1;
  const status = byId(kind + '-query-status');
  const context = kind === 'operations' && filters.operations.forwardId ? '规则 ' + filters.operations.forwardId + ' 的执行记录；' : '';
  status.textContent = context + '正在读取当前条件；下方暂保留上次结果。';
  try {
    const result = await request('GET', listResource(kind, page[kind], filters[kind]),undefined,undefined,
      guard?{signal:guard.signal,timeoutMs:10000}:undefined);
    if (version !== readVersions[kind] || guard && !guard.isCurrent()) return false;
    store[kind] = result.items;
    totals[kind] = result.total;
    if (kind === 'nodes') { renderNodes(); renderForwardPreflight(); renderOps(); }
    if (kind === 'forwards') renderForwards();
    if (kind === 'operations') { renderOperations(); renderOps(); }
    pagination(kind, result);
    status.textContent = context + '当前条件匹配 ' + result.total + ' 条，本页显示 ' + result.items.length + ' 条。';
    return true;
  } catch (error) {
    if (version !== readVersions[kind] || guard && !guard.isCurrent()) return false;
    status.textContent = context + '本次读取失败；下方保留上次结果，不代表当前筛选结果。请重新读取。';
    throw error;
  }
}
function setListFilters(kind, next) {
  filters[kind] = next; page[kind] = 1;
  const form = byId(kind + '-filter'); form.reset();
  for (const [name, value] of Object.entries(next)) {
    const field = form.elements.namedItem(name); if (field) field.value = value;
  }
}
async function loadOverview(guard) {
  if(!guard||typeof guard.isCurrent!=='function')guard=undefined;
  const version = readVersions.overview = (readVersions.overview ?? 0) + 1;
  const result = await request('GET', 'overview',undefined,undefined,guard?{signal:guard.signal,timeoutMs:10000}:undefined);
  if (version !== readVersions.overview || guard && !guard.isCurrent()) return;
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
  const version = connectionVersion, command = forwardWrite;
  try {
    connected();
    await Promise.all([...['nodes', 'forwards', 'operations'].map(load), loadOverview()]);
    if (version !== connectionVersion) return;
    if (forwardWrite === command && command?.state === 'accepted' && !command.active) {
      command.refreshFailed = false; renderForwardWrite();
    }
    byId('connection-indicator').textContent = '已认证 · ' + auth.scope;
    notify('数据已从 Control 更新；列表中的 Operation 状态不代表独立探测成功。');
    return true;
  } catch (error) {
    if (version === connectionVersion) notify(error.message || '加载失败', true);
    return false;
  }
}
function updateOverview() {
  for (const [id, key] of [['nodes', 'nodes'], ['forwards', 'forwards'], ['running', 'activeOperations'], ['failed', 'failedOperations']])
    byId('metric-' + id).textContent = overview ? String(overview[key]) : '—';
  renderOps();
  const guide=byId('workflow-guide');
  if(guide){
    guide.replaceChildren();
    for(const step of workflowSteps({connected:!!auth.scope&&!!auth.token,overview})){
      const item=element('li',undefined,step.primary?'is-next':''),title=element('h3',step.title),description=element('p',step.detail,'hint'),go=button(step.label,step.action,step.view,step.primary?'':'secondary');
      if(step.primary)item.append(element('span','建议下一步','workflow-recommendation'));
      go.disabled=!step.enabled;item.append(title,description,go);guide.append(item);
    }
  }
}
function emptyList(tbody,columns,resource) {
  const connected=!!auth.scope&&!!auth.token;
  const filtered=Object.entries(filters[resource]).some(([key,value])=>key!=='ownership'&&value!==''&&value!==undefined&&value!==null);
  const tr=element('tr'),content=element('div',undefined,'list-empty');
  let title,description,actions;
  if(!connected){title='登录后查看记录';description='先登录账号并选择工作空间。';actions=[];}
  else if(filtered||page[resource]>1){
    title=filtered?'没有符合筛选条件的记录':'当前页没有记录';
    description='这不代表工作空间没有数据。可以清除筛选并回到第一页重新查看。';
    actions=[['清除筛选，查看第一页','workflow-reset-filter',resource]];
  }else if(resource==='nodes'){
    title=currentView==='available'?'当前授权范围没有资源记录':filters.nodes.ownership===''?'当前范围没有机器记录':'还没有自己的机器';
    description=currentView==='available'?'可以接入自己的机器，或联系管理员授予共享资源使用权限。':'接入自己的 Agent，或先查看已授权的共享资源。';
    actions=[['接入自己的机器','workflow-node-create','nodes']];
    if(currentView!=='available')actions.push(['查看可用资源','workflow-page','available']);
  }else if(resource==='forwards'){
    title=filters.forwards.ownership===''?'当前范围没有转发记录':'创建你的第一条转发';description='选择已接入或获授权的机器，设置监听端口与目标地址。';
    actions=[['新建转发','workflow-forward-create','forwards'],['先查看可用资源','workflow-page','available']];
  }else{
    title='当前范围还没有执行记录';description='创建或修改转发后，可在这里查看部署进度；记录完成后仍需验证实际业务。';
    actions=[['查看我的转发','workflow-page','forwards']];
  }
  content.append(element('h3',title),element('p',description,'hint'));
  const controls=element('div',undefined,'actions');
  for(const [text,kind,id]of actions)controls.append(button(text,kind,id,'secondary'));
  content.append(controls);const td=cell(tr,content);td.colSpan=columns;tbody.append(tr);
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
  if (!store.nodes.length) emptyList(tbody,5,'nodes');
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
  if (summary.operation) target.append(element('div', '操作：' + (operationLabels[summary.operation.status] ?? summary.operation.status) +
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
  forwardWriteButtons.clear();
  ruleConsole.page();
  forwardStatusEpoch++;
  forwardStatusCells.clear();
  const keepStatuses = new Set();
  const tbody = byId('forward-rows');
  tbody.replaceChildren();
  if (!store.forwards.length) emptyList(tbody,7,'forwards');
  for (const item of store.forwards) {
    const tr = element('tr');
    const a = item.spec;
    const entry = cell(tr, element('div', a.ingress.nodeId.slice(0, 13), 'mono cell-title'));
    const identity = element('div', '规则 ' + shortId(item.id), 'subline'); identity.title = item.id; entry.append(identity);
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
    const operation = cell(tr, item.lastOperation ? label(operationLabels[item.lastOperation.status] ?? item.lastOperation.status, stateTone(item.lastOperation.status)) : label('无操作记录'));
    if (item.lastOperation) operation.append(button('查看', 'operation-detail', item.lastOperation.id, 'secondary'));
    operation.append(button('执行记录', 'forward-operations', item.id, 'secondary'));
    const action = cell(tr);
    const group = element('div', undefined, 'cell-actions');
    group.append(button('分层诊断', 'forward-diagnostics', item.id, 'secondary'));
    group.append(forwardWriteButton('编辑', 'forward-edit', item.id));
    group.append(forwardWriteButton(a.enabled ? '停用' : '启用', 'forward-toggle', item.id));
    const more = element('details', undefined, 'row-more'), secondary = element('div', undefined, 'cell-actions');
    more.append(element('summary', '更多操作'));
    secondary.append(button('详情', 'forward-detail', item.id, 'secondary'), forwardWriteButton('复制配置', 'forward-copy', item.id));
    secondary.append(button('入口流量观察', 'forward-telemetry', item.id, 'secondary'));
    secondary.append(button('探测计数', 'probe-telemetry', item.id, 'secondary'));
    secondary.append(button('聚合历史', 'forward-telemetry-aggregate', item.id, 'secondary'));
    secondary.append(button('探测支持','forward-probe-capabilities',item.id,'secondary'));
    if(a.protocols.some(protocol=>protocol==='tcp'||protocol==='udp'))secondary.append(button('受控探测', 'forward-probe', item.id, 'secondary'));
    if(a.path)secondary.append(button('部署进度', 'forward-deployment', item.id, 'secondary'));
    secondary.append(forwardWriteButton('删除转发', 'forward-delete', item.id, 'secondary danger-action'));
    more.append(secondary); action.append(group, more);
    tbody.append(tr);
  }
  for (const key of forwardStatusCache.keys()) if (!keepStatuses.has(key)) forwardStatusCache.delete(key);
}
function renderOperations() {
  const tbody = byId('operation-rows');
  tbody.replaceChildren();
  if (!store.operations.length) emptyList(tbody,6,'operations');
  for (const item of store.operations) {
    const tr = element('tr');
    const title = cell(tr, element('span', shortId(item.id), 'mono cell-title'));
    title.append(element('div', '转发 ' + item.forwardId, 'subline'));
    cell(tr, element('span', 'r' + item.targetRevision, 'mono'));
    cell(tr, element('span', item.kind));
    cell(tr, label(operationLabels[item.status] ?? item.status, stateTone(item.status)));
    cell(tr, element('span', date(item.updatedAt)));
    const last = cell(tr);
    last.append(button(item.lastError ? '查看错误' : '详情', 'operation-detail', item.id, 'secondary'));
    last.append(button('转发诊断', 'forward-diagnostics', item.forwardId, 'secondary'));
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
  for (const [id, value, choices] of [
    ['forward-protocol', preferred?.protocol, protocols],
    ['forward-address', preferred?.address, node?.policy?.allowedListenerAddresses ?? []],
    ['forward-port', preferred?.port, node?.policy?.allowedPorts ?? []],
  ]) if (value !== undefined && !choices.some(choice => String(choice) === String(value))) byId(id).value = '';
  byId('forward-capabilities').textContent = node ? '可用监听地址和端口由当前 Node Policy 决定，服务端会再次检查授权、目标 CIDR 与资源独占。' : '没有具备 ADP/3 Direct 能力和有效凭据的节点；请先接入 Agent。';
  byId('save-forward').disabled = !node || forwardWriteLocked();
  renderForwardPreflight();
}
async function editor(item, copy = false) {
  if (forwardWriteLocked()) { notify('请先核对当前提交结果，再编辑或创建转发。', true); return; }
  byId('forward-form').hidden = true;
  editing = null;
  candidatePages.direct = 1;
  byId('direct-candidate-prefix').value = '';
  if (!await loadCandidates('direct', item ? [item.spec.ingress.nodeId] : [])) return;
  if (item && !candidates.direct.some(n => n.id === item.spec.ingress.nodeId)) throw new Error('当前入口节点不再具备候选资格，请检查授权、凭据和能力');
  editing = copy ? null : item ?? null;
  const form = byId('forward-form');
  form.reset();
  clearDirectErrors();
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
  (item ? form.elements.namedItem('targetHost') : byId('forward-node')).focus({ preventScroll: true });
}
function clearDirectErrors() {
  byId('direct-form-state').textContent = '';
  for (const name of ['node','protocol','listenAddress','listenPort','targetHost','targetPort'])
    byId('forward-form').elements.namedItem(name).setAttribute('aria-invalid', 'false');
}
function directFieldError(name, message) {
  const field = byId('forward-form').elements.namedItem(name);
  field.setAttribute('aria-invalid', 'true');
  byId('direct-form-state').textContent = message;
  const target = field.disabled ? byId('direct-candidate-search') : field;
  target.scrollIntoView({ block: 'nearest' }); target.focus({ preventScroll: true });
  return false;
}
function validateDirectFields(form, node) {
  clearDirectErrors();
  const value = name => form.elements.namedItem(name).value;
  if (!directCapable(node) || !(node.allowedRoles === null || node.allowedRoles?.includes('ingress')))
    return directFieldError('node', '当前入口机器不可用，请重新查询候选并核对授权。');
  if (!allowedProtocols(node).includes(value('protocol'))) return directFieldError('protocol', '请选择当前机器支持的协议。');
  if (!node.policy.allowedListenerAddresses.includes(value('listenAddress'))) return directFieldError('listenAddress', '原监听地址已不可用，请从当前授权中重新选择。');
  if (!value('listenPort') || !node.policy.allowedPorts.includes(Number(value('listenPort')))) return directFieldError('listenPort', '请选择当前授权的入口端口；复制和授权变化后需要重新确认。');
  const host = value('targetHost').trim(), port = Number(value('targetPort'));
  if (!host || host.length > 253 || /\s/.test(host)) return directFieldError('targetHost', '请填写有效的目标 IP 或域名，不能留空或含空白字符。');
  if (!Number.isInteger(port) || port < 1 || port > 65535) return directFieldError('targetPort', '请填写 1 到 65535 之间的整数目标端口。');
  form.elements.namedItem('targetHost').value = host;
  return true;
}
async function saveForward(event) {
  event.preventDefault();
  const version = connectionVersion;
  try {
    if (forwardWriteLocked()) { notify('请先等待当前提交结束，或核对上次未知结果。', true); return; }
    const form = byId('forward-form');
    const nodeId = editing ? editing.spec.ingress.nodeId : form.elements.namedItem('node').value;
    const node = candidates.direct.find(n => n.id === nodeId);
    if (!validateDirectFields(form, node)) return;
    const spec = directSpec({
      protocol: form.elements.namedItem('protocol').value,
      listenAddress: form.elements.namedItem('listenAddress').value,
      listenPort: form.elements.namedItem('listenPort').value,
      targetHost: form.elements.namedItem('targetHost').value,
      targetPort: form.elements.namedItem('targetPort').value,
      enabled: form.elements.namedItem('enabled').checked,
    }, node);
    const source = editing;
    await submitForwardWrite(source ? '保存转发' : '创建转发', source ? 'PUT' : 'POST', source ? 'forwards/' + encodeURIComponent(source.id) : 'forwards',
      source ? { expectedRevision: source.revision, spec } : spec, source?.id ?? null, () => { form.hidden = true; editing = null; });
  } catch (error) { if (version === connectionVersion) notify(error.message, true); }
}
function detail(title, data, secret) {
  currentSecret = secret ?? null;
  byId('detail-title').textContent = title;
  byId('detail-content').textContent = JSON.stringify(data, null, 2);
  byId('detail-secret').hidden = !secret;
  byId('detail-dialog').showModal();
}
async function action(kind, id) {
  const version = connectionVersion;
  try {
    if (kind === 'page-section') {
      if (!(pageSections[currentView] ?? []).some(([, anchor]) => anchor === id)) return;
      const target = byId(id); if (id === 'node-enrollment-guide') target.open = true;
      target.tabIndex = -1; target.scrollIntoView({ block: 'start' }); target.focus({ preventScroll: true }); return;
    }
    if(kind==='list-preset'){
      if(!Object.hasOwn(listPresets,id))return;
      connected();const [resource,values]=listPresets[id];
      setListFilters(resource,{...filters[resource],...values});
      await load(resource);return;
    }
    if(kind==='forward-operations'){
      connected();
      if(!store.forwards.some(item=>item.id===id))throw Error('转发列表已更新，请重新读取后查看执行记录。');
      setListFilters('operations',{forwardId:id});display('operations',true);
      await load('operations');return;
    }
    if(kind==='workflow-node-create'){
      connected();display('nodes');byId('node-form').hidden=false;byId('node-form').scrollIntoView({block:'start'});return;
    }
    if(kind==='workflow-forward-create'){
      connected();display('forwards');await editor(null);return;
    }
    if(kind==='workflow-reset-filter'){
      if(!['nodes','forwards','operations'].includes(id))return;
      connected();page[id]=1;filters[id]={};byId(id+'-filter').reset();
      if(id==='nodes'){
        filters.nodes.ownership=currentView==='available'?'available':'mine';
        nodeOwnership=filters.nodes.ownership;
        byId('nodes-filter').elements.namedItem('ownership').value=filters.nodes.ownership;
      }
      await load(id);return;
    }
    if(kind==='workflow-page'){
      if(!['nodes','available','forwards','operations'].includes(id))return;
      connected();display(id,true);await load(id==='available'?'nodes':id);return;
    }
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
    if (['forward-edit','forward-copy'].includes(kind) && forwardWriteLocked()) return notify('请先核对当前提交结果，再编辑或创建转发。', true);
    if (kind === 'forward-edit') return forward.spec.path?await relayConsole.edit(forward):await editor(forward);
    if (kind === 'forward-copy') return forward.spec.path?await relayConsole.copy(forward):await editor(forward, true);
    if (kind === 'forward-probe') return await probeConsole.open(forward);
    if (kind === 'forward-probe-capabilities') return await probeConsole.openCapabilities(forward);
    if (kind === 'forward-deployment') return await relayConsole.deployment(id);
    if (kind === 'forward-toggle') {
      return await submitForwardWrite(forward.spec.enabled ? '停用转发' : '启用转发', 'PUT', 'forwards/' + encodeURIComponent(id),
        { expectedRevision: forward.revision, spec: { ...forward.spec, enabled: !forward.spec.enabled } }, id);
    }
    if (kind === 'forward-delete') {
      if (forwardWriteLocked()) return notify('请先核对当前提交结果。', true);
      if (!confirm('确认删除此 Forward？旧执行资源将按安全流程退役，不会立即无条件释放。')) return;
      return await submitForwardWrite('删除转发', 'DELETE', 'forwards/' + encodeURIComponent(id), { expectedRevision: forward.revision }, id);
    }
  } catch (error) { if (version === connectionVersion) notify(error.message, true); }
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
memberConsole=initMemberConsole({request,notify,byId,canGovern:governance});
accountCredentials=initAccountCredentials({byId,notify,getIdentity:()=>({actorId:account?.actorId,token:auth.token}),
  onRotated:async(next,actorId)=>{
    if(account?.actorId!==actorId)throw Error('账号已变化，请使用已保存的新 Token 重新登录。');
    clearConnectionData();auth.token=next;byId('connection-indicator').textContent='账号凭据已更新';
    display('overview');if(auth.scope)await refresh();
  }});
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
  boundedReads?.stop('account-changed');
  connectionVersion++;
  pageRefresh = null;
  byId('page-read-state').textContent = '';
  nodeViewState.clear();
  forwardWrite = null; forwardWriteButtons.clear(); renderForwardWrite();
  for (const key of Object.keys(readVersions)) readVersions[key]++;
  privateProvisioning=false;privateProvisionUnknown=false;byId('node-provision-submit').disabled=false;byId('node-provision-reset').hidden=true;byId('node-provision-state').textContent='';
  currentSecret = null; editing = null; overview = null; forwardStatusCache.clear(); consoleRequests.clearPending();
  candidates.direct = []; candidates.relay = [];
  candidatePages.direct = candidatePages.relay = 1;
  for (const kind of ['nodes', 'forwards', 'operations']) {
    page[kind] = 1; store[kind] = []; totals[kind] = 0; filters[kind] = {};
    byId(kind + '-filter').reset();
    byId(kind + '-query-status').textContent = '尚未读取当前工作空间的记录。';
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
  clearDirectErrors();
  byId('direct-candidate-prefix').value = ''; byId('relay-candidate-prefix').value = '';
  byId('relay-candidate-role').value = 'ingress';
  for (const mode of ['direct', 'relay']) {
    byId(mode + '-candidate-page').textContent = '尚未查询候选';
    byId(mode + '-candidate-prev').disabled = byId(mode + '-candidate-next').disabled = true;
  }
  adminResources.clear();resourceLimits.clear();lineBuilder.clear();memberConsole.clear();accountCredentials.clear();
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
document.querySelectorAll('.nav').forEach(node => {
  node.setAttribute('aria-controls', 'view-' + (node.dataset.view === 'available' ? 'nodes' : node.dataset.view));
  node.addEventListener('keydown', event => {
    if (!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const controls = [...document.querySelectorAll('.nav')].filter(control => !control.hidden && !control.disabled);
    const index = controls.indexOf(node); if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 :
      (index + (['ArrowDown','ArrowRight'].includes(event.key) ? 1 : -1) + controls.length) % controls.length;
    controls[next]?.focus();
  });
  node.addEventListener('click', () => {
  if(node.hidden)return;
  if (node.dataset.view !== 'notifications') notificationEndpoints.leave();
  display(node.dataset.view,true);
  if(node.dataset.view==='resources'&&auth.scope)adminResources.refresh();
  if(['nodes','available'].includes(node.dataset.view)&&auth.scope)load('nodes').catch(e=>notify(e.message,true));
  if(node.dataset.view==='relay' && auth.scope) Promise.all([relayConsole.refresh(),pathTemplates.list()]).catch(e=>notify(e.message,true));
  });
});
for (const [id, view] of [['ops-audit', 'audit'], ['ops-alerts', 'alerts'], ['ops-notifications', 'notifications'],
  ['ops-operations', 'operations'], ['ops-forwards', 'forwards']])
  byId(id).addEventListener('click', () => { if (view !== 'notifications') notificationEndpoints.leave(); display(view,true); });
for (const [id, anchor] of [['topology-templates', 'tunnel-definition-title'], ['topology-groups', 'path-group-title'],
  ['topology-publications', 'path-publication-title'], ['topology-ingress', 'ingress-migration-title']])
  byId(id).addEventListener('click', () => {
    [...document.querySelectorAll('.nav')].find(node => node.dataset.view === 'relay')?.click();
    byId(anchor).scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
function updateAccountNavigation() {
  for(const id of Object.keys(listPresets))byId(id).disabled=!auth.scope||!auth.token;
  document.querySelectorAll('[data-governance]').forEach(node=>{node.hidden=!governance();});
  const scope=selectedScope();
  updatePageControls();
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
  byId('refresh').disabled=!scope;updateAccountNavigation();display('overview',true);
  byId('connection-indicator').textContent = scope ? '已认证 · ' + auth.scope + ' · 正在读取' : '账号已认证，选择工作空间';
  if(scope) {
    const version = connectionVersion;
    await refreshCurrentPage();
    if (version === connectionVersion) byId('connection-indicator').textContent = '已认证 · ' + auth.scope;
  }
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
  if(loginAttempt)return;
  const token=byId('token').value.trim();
  if(!/^[A-Za-z0-9_-]{32,128}$/.test(token)){notify('Bearer Token 格式不正确：请使用 32–128 位字母、数字、下划线或短横线。',true);byId('token').focus();return;}
  const attempt={};loginAttempt=attempt;byId('connect').disabled=true;byId('connect').textContent='正在登录…';byId('token').disabled=true;byId('token-reveal').disabled=true;
  byId('token').type='password';byId('token-reveal').textContent='显示 Token';byId('token-reveal').ariaPressed='false';
  auth.scope='';auth.token='';account=null;accountPage=null;clearConnectionData();updateAccountNavigation();
  byId('account-context').hidden=true;byId('refresh').disabled=true;byId('disconnect').disabled=false;
  byId('connection-indicator').textContent='正在读取账号';byId('token').value='';
  const loginEpoch=accountEpoch+1;
  try {
    if(!await accountPageRead(token))return;
    auth.token=token;accountCredentials.clear();byId('connection-indicator').textContent='账号已认证，选择工作空间';
    const first=account.scopes.find(scope=>scope.canEnter);
    if(first){byId('scope').value=first.scopeId;await enterScope(first.scopeId);}
  }catch(error){if(loginEpoch===accountEpoch){notify(error.message,true);byId('connection-indicator').textContent='登录未完成';}}
  finally{if(loginAttempt===attempt){loginAttempt=null;byId('connect').disabled=false;byId('connect').textContent='登录账号';byId('token').disabled=false;byId('token-reveal').disabled=false;if(!auth.token)byId('token').focus();}}
});
byId('token-reveal').addEventListener('click',()=>{
  if(loginAttempt)return;
  const reveal=byId('token').type==='password';byId('token').type=reveal?'text':'password';
  byId('token-reveal').textContent=reveal?'隐藏 Token':'显示 Token';byId('token-reveal').ariaPressed=String(reveal);
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
  loginAttempt=null;byId('connect').disabled=false;byId('connect').textContent='登录账号';byId('token').disabled=false;byId('token-reveal').disabled=false;
  byId('token').type='password';byId('token-reveal').textContent='显示 Token';byId('token-reveal').ariaPressed='false';
  accountEpoch++;accountController?.abort();account=null;accountPage=null;auth.scope='';auth.token='';clearConnectionData();updateAccountNavigation();
  byId('scope').replaceChildren();byId('token').value='';byId('account-context').hidden=true;
  byId('refresh').disabled=true;byId('disconnect').disabled=true;byId('connection-indicator').textContent='未连接';display('overview');
  notify('已断开连接；当前标签页中的 Bearer Token 已清除。');
  byId('token').focus();
});
byId('resource-operations').addEventListener('click',()=>{display('operations',true);load('operations').catch(error=>notify(error.message,true));});
byId('refresh').addEventListener('click', refreshCurrentPage);
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
  clearDirectErrors(); byId('show-forward-form').focus();
});
for (const name of ['input','change']) byId('forward-form').addEventListener(name, clearDirectErrors);
byId('forward-node').addEventListener('change', () => fillCapabilities());
byId('forward-protocol').addEventListener('change', () => renderForwardPreflight());
byId('forward-form').addEventListener('submit', saveForward);
byId('forward-write-records').addEventListener('click', () => {
  if (!forwardWrite?.forwardId || forwardWrite.state === 'sending') return;
  setListFilters('operations', { forwardId: forwardWrite.forwardId }); display('operations',true);
  const version = connectionVersion;
  load('operations').catch(error => { if (version === connectionVersion) notify(error.message, true); });
});
byId('forward-write-dismiss').addEventListener('click', () => {
  if (!forwardWrite || forwardWrite.active) return;
  if (forwardWrite.state === 'unknown' && !confirm('我已核对原规则和执行记录，明确准备新的操作。原请求可能已经被接收；清除本地提示不会取消或回滚远程操作。是否继续？')) return;
  forwardWrite = null; renderForwardWrite();
});
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
boundedReads=createBoundedPageReads({identity:()=>auth.scope&&auth.token?connectionVersion+':'+auth.scope:null,
  page:()=>currentView,visible:()=>!document.hidden,
  read:(view,guard)=>view==='overview'?loadOverview(guard):load(view==='available'?'nodes':view,guard),
  state:value=>{
    boundedReading=value.active;updatePageControls();
    byId('read-session-stop').disabled=!value.active;
    byId('read-session-state').textContent=value.active?'只读刷新 '+value.completed+'/6；仅当前页，十秒间隔。':
      value.reason==='complete'?'六轮读取已结束。':value.reason==='failed'?'读取失败，已停止；数据仍需重新核对。':
        value.reason==='unsupported'?'请先连接，并进入概览、机器、转发或执行记录页。':'自动读取已停止。';
  }});
byId('read-session-start').addEventListener('click',()=>boundedReads.start());
byId('read-session-stop').addEventListener('click',()=>boundedReads.stop());
document.addEventListener('visibilitychange',()=>{if(document.hidden)boundedReads.stop('hidden');});
document.querySelectorAll('.table-wrap').forEach(region => {
  region.tabIndex = 0; region.setAttribute('role', 'region');
  const columns = [...region.querySelectorAll('th')].slice(0, 3).map(heading => heading.textContent.trim()).join('、');
  region.setAttribute('aria-label', (columns ? columns + '表格。' : '表格区域。') + '可横向滚动查看完整内容。');
});
updateOverview();
display('overview');

}
