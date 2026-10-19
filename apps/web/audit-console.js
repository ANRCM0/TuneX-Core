const sources = ['access','node-security','transport','path-template','path-binding','path-group','path-group-binding',
  'path-publication','path-publication-attempt','ingress-group','ingress-deployment','ingress-deployment-attempt',
  'ingress-migration','ingress-migration-attempt','operation'];
const limits = { defaultWindowMs: 86400000, maxWindowMs: 2678400000, maxPageSize: 50, maxResponseBytes: 131072,
  activeRequests: 2, actorKeys: 128, cooldownMs: 1000 };
const kinds = {
  access: ['member_change','node_grant_change'],
  'node-security': ['credential_rotation','policy_update','node_revocation','relay_endpoint_update','relay_credential_issue'],
  transport: ['grant-change'], 'path-template': ['publish','archive'], 'path-binding': ['bind'],
  'path-group': ['publish','archive'], 'path-group-binding': ['bind'],
  'path-publication': ['create','apply','compensate','cancel','recovery'], 'path-publication-attempt': ['apply','compensate'],
  'ingress-group': ['publish','archive'], 'ingress-deployment': ['create','compensate','cancel','recovery'],
  'ingress-deployment-attempt': ['create','compensate'], 'ingress-migration': ['create','apply','compensate','cancel','recovery'],
  'ingress-migration-attempt': ['apply','compensate'], operation: ['create','update','enable','disable','delete','retry','policy','revoke'],
};
const errorCodes = ['AUTHORIZATION_DENIED','EXECUTION_DEADLINE','INTEGRITY_FAILURE','INVALID_CONFIG','UNSUPPORTED_CAPABILITY',
  'RESOURCE_CONFLICT','RESOURCE_LIMIT','PORT_RESERVED','FENCING_REJECTED','LEASE_EXPIRED','SESSION_SUPERSEDED','LISTEN_FAILED',
  'BIND_FAILED','TARGET_DENIED','CONNECT_FAILED','DIAL_FAILED','PEER_UNAVAILABLE','TLS_FAILED','RELAY_HANDSHAKE_FAILED','DRAIN_TIMEOUT',
  'INTERNAL_ERROR','CLOCK_UNCERTAIN','CONFIG_DIGEST_MISMATCH','AUTHENTICATION_FAILED','TARGET_REJECTED','DOWNSTREAM_NOT_ACTIVE',
  'DOWNSTREAM_UNAVAILABLE','TARGET_UNAVAILABLE','PORT_IN_USE','REVISION_CONFLICT','GROUP_ARCHIVED','TEMPLATE_ARCHIVED',
  'REVISION_EXHAUSTED','PUBLICATION_STATE_CHANGED','NOT_FOUND','OTHER_ERROR'];
const uint = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => uint(value) && value > 0;
const bool = value => typeof value === 'boolean';
const id = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) && !/\s/.test(value);
const hash = value => typeof value === 'string' && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value);
const instant = value => typeof value === 'string' && uint(Date.parse(value)) && new Date(value).toISOString() === value;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const one = (...values) => value => values.includes(value);
const nullable = check => value => value === null || check(value);
const shape = fields => value => record(value) && Object.keys(value).length === Object.keys(fields).length &&
  Object.entries(fields).every(([key, check]) => Object.hasOwn(value, key) && check(value[key]));
const equal = (a, b) => record(a) && record(b) && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key] === b[key]);
const position = row => ({ occurredAt: Date.parse(row.occurredAt), source: row.source, key: row.key });
const ascii = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const descending = (a, b) => b.occurredAt - a.occurredAt || ascii(b.source, a.source) || ascii(b.key, a.key);
const cursor = value => value === null || typeof value === 'string' && value.length > 0 && value.length <= 1024 && /^[A-Za-z0-9_-]+$/.test(value);
const rowValid = shape({ occurredAt: instant, source: one(...sources), key: hash,
  kind: value => typeof value === 'string' && value.length <= 64 && /^[a-z][a-z0-9_-]*$/.test(value),
  recordType: one('owner-event','immutable-provenance','owner-attempt','latest-operation-state'),
  timeMeaning: one('recorded-at','latest-operation-update'), actorId: nullable(id),
  actorAttribution: one('initiator','unattributed','unattributed-recovery','requester-not-status-actor'), subjectId: nullable(id),
  entityKind: one('scope-access','node','transport-profile','path-template','forward','path-group','path-publication','ingress-group','ingress-deployment','ingress-migration'),
  entityId: id, revision: nullable(positive), revisionKind: nullable(one('access','grant','config','forward','batch')), sequence: nullable(positive), position: nullable(positive),
  nodeId: nullable(id), nodeAssociation: one('explicit-node','immutable-forward-spec','immutable-template-config','immutable-group-definition','none'),
  forwardId: nullable(id), operationId: nullable(id), outcome: one('recorded','accepted','rejected','running','succeeded','failed','superseded'),
  errorCode: nullable(one(...errorCodes)), retryable: nullable(bool), recoveryInvalidated: nullable(bool) });
const coverageValid = shape({ sources: value => Array.isArray(value) && value.length > 0 && value.length <= sources.length &&
  value.every(source => sources.includes(source)) && new Set(value).size === value.length,
  completeness: one('existing-owner-records-only'), retention: one('source-owned-no-common-retention'),
  operationHistory: one('latest-state-not-transition-log'), relatedRows: one('not-independent-command-count'),
  nodeFilter: one('explicit-node-or-immutable-owned-config'), associations: one('explicit-single-value-only-not-exhaustive-relations'),
  globalRecovery: one('excluded-no-scope-attribution'), ordering: one('occurredAt-desc-source-desc-key-desc'),
  queryCost: one('bounded-output-not-verified-sql-cost') });
const stamp = value => value + '\nAsia/Shanghai: ' + new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const shown = value => value === null ? '未归因 / 无字段（不补猜）' : String(value);

export function initAuditConsole({ request, notify, byId, getScope, document = globalThis.document }) {
  const el = name => byId('audit-' + name), filterNames = ['actorId','nodeId','forwardId','operationId','errorCode','source'];
  const inputs = ['from','to','limit',...filterNames];
  let epoch = 0, controller = null, frozen = null, nextCursor = null, previousPosition = null, scope = null;
  function controls() {
    el('read').disabled = Boolean(controller); el('cancel').disabled = !controller;
    el('next').disabled = Boolean(controller) || !frozen || nextCursor === null;
  }
  function erase() { el('rows').replaceChildren(); el('meta').textContent = ''; el('coverage').textContent = ''; }
  function invalidate() { epoch++; controller?.abort(); controller = null; frozen = null; nextCursor = null; previousPosition = null; erase(); controls(); }
  function clear() {
    invalidate(); scope = null;
    const now = Date.now(); el('from').value = new Date(now - 86400000).toISOString(); el('to').value = new Date(now).toISOString(); el('limit').value = '25';
    for (const name of filterNames) el(name).value = '';
    el('state').textContent = '仅当前 Scope owner/manager 可手动读取，每次由服务器重新核验；进入页面不自动查询。';
  }
  function input() {
    const from = el('from').value.trim(), to = el('to').value.trim(), rawLimit = el('limit').value;
    if (!instant(from) || !instant(to) || Date.parse(from) >= Date.parse(to) || Date.parse(to) - Date.parse(from) > 2678400000)
      throw Error('需要规范 UTC ISO 起止时间（含毫秒并以 Z 结尾），from < to，窗口最多 31 天。');
    if (!/^[1-9][0-9]*$/.test(rawLimit) || !positive(Number(rawLimit)) || Number(rawLimit) > 50) throw Error('单页条数必须是 1 至 50 的整数。');
    const filters = {};
    for (const name of filterNames) {
      const value = el(name).value.trim(); if (!value) continue;
      if (name === 'source' ? !sources.includes(value) : name === 'errorCode' ? !errorCodes.includes(value) : !id(value)) throw Error('精确审计筛选无效：' + name);
      filters[name] = value;
    }
    return Object.freeze({ from, to, limit: Number(rawLimit), filters: Object.freeze(filters) });
  }
  function valid(data, query, selectedScope, before) {
    const keys = ['auditVersion','scopeId','capturedAt','window','filters','limit','items','nextCursor','hasMore','coverage','limits',
      'source','readOnly','executionAuthorized','health','networkCheck','consistency'];
    if (!record(data) || Object.keys(data).length !== keys.length || !keys.every(key => Object.hasOwn(data, key)) ||
        new TextEncoder().encode(JSON.stringify(data)).byteLength > limits.maxResponseBytes || !equal(data.limits, limits) ||
        data.auditVersion !== 1 || data.scopeId !== selectedScope || !instant(data.capturedAt) ||
        data.source !== 'persisted-owner-records' || data.readOnly !== true || data.executionAuthorized !== false || data.health !== 'unknown' ||
        data.networkCheck !== 'not-performed' || data.consistency !== 'read-committed-not-global-snapshot' || !equal(data.window, { from: query.from, to: query.to }) ||
        !equal(data.filters, query.filters) || data.limit !== query.limit || !Array.isArray(data.items) || data.items.length > query.limit || !bool(data.hasMore) || !cursor(data.nextCursor) ||
        data.hasMore !== (data.nextCursor !== null) || data.hasMore && data.items.length !== query.limit || !coverageValid(data.coverage) ||
        JSON.stringify(data.coverage.sources) !== JSON.stringify(query.filters.source ? [query.filters.source] : sources)) return false;
    const seen = new Set();
    for (const [index, row] of data.items.entries()) {
      if (!rowValid(row) || !kinds[row.source].includes(row.kind) || Date.parse(row.occurredAt) < Date.parse(query.from) || Date.parse(row.occurredAt) >= Date.parse(query.to) ||
          Object.entries(query.filters).some(([key, value]) => key !== 'nodeId' && row[key] !== value) ||
          query.filters.nodeId && (row.nodeAssociation === 'none' || row.nodeAssociation === 'explicit-node' && row.nodeId !== query.filters.nodeId) ||
          seen.has(row.source + '/' + row.key) ||
          index > 0 && descending(position(data.items[index - 1]), position(row)) >= 0 || before && descending(before, position(row)) >= 0) return false;
      seen.add(row.source + '/' + row.key);
      if ((row.source === 'operation') !== (row.recordType === 'latest-operation-state') ||
          (row.source === 'operation') !== (row.timeMeaning === 'latest-operation-update') ||
          (row.source === 'operation') !== (row.actorAttribution === 'requester-not-status-actor') ||
          (row.nodeAssociation === 'explicit-node') !== (row.nodeId !== null) ||
          ['unattributed','unattributed-recovery'].includes(row.actorAttribution) && row.actorId !== null ||
          row.actorAttribution === 'initiator' && row.actorId === null || (row.revision === null) !== (row.revisionKind === null) ||
          ['path-publication','ingress-deployment','ingress-migration'].includes(row.source) &&
            (row.forwardId !== null || row.operationId !== null || row.position !== null)) return false;
    }
    return true;
  }
  function render(data, pageNumber) {
    erase();
    for (const row of data.items) {
      const tr = document.createElement('tr');
      for (const text of [stamp(row.occurredAt) + '\n' + row.timeMeaning,
        row.source + '\n' + row.kind + '\n' + row.recordType + '\nkey=' + row.key,
        'actor=' + shown(row.actorId) + '\n' + row.actorAttribution + '\nsubject=' + shown(row.subjectId),
        row.entityKind + ' / ' + row.entityId + '\nrevision=' + shown(row.revision) + ' / ' + shown(row.revisionKind) + '\nsequence=' + shown(row.sequence) + ' / position=' + shown(row.position),
        'node=' + shown(row.nodeId) + '\n' + row.nodeAssociation + '\nforward=' + shown(row.forwardId) + '\noperation=' + shown(row.operationId),
        row.outcome + '\nerror=' + shown(row.errorCode) + '\nretryable=' + shown(row.retryable) + '\nrecoveryInvalidated(current-owner-at-read)=' + shown(row.recoveryInvalidated)]) {
        const cell = document.createElement('td'); cell.textContent = text; tr.append(cell);
      }
      el('rows').append(tr);
    }
    if (!data.items.length) { const tr = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 6;
      cell.textContent = '固定窗口与精确筛选内无可见记录；不证明从未发生、没有错误或历史完整。'; tr.append(cell); el('rows').append(tr); }
    el('meta').textContent = '当前 Scope ' + data.scopeId + '\n固定窗口 ' + stamp(data.window.from) + ' → ' + stamp(data.window.to) +
      '\n读取时间 ' + stamp(data.capturedAt) + '\n第 ' + pageNumber + ' 个手动 keyset 窗口，返回 ' + data.items.length + ' / ' + frozen.query.limit +
      '；hasMore=' + data.hasMore + '，不计算总数/总页。\n' + data.source + ' / ' + data.consistency + ' / health=unknown / executionAuthorized=false';
    el('coverage').textContent = JSON.stringify(data.coverage, null, 2);
    el('state').textContent = '只读原所有者记录已载入；没有创建审计事件、命令、Probe 或导出。Operation 是最新可变状态，不是每次状态转换。';
  }
  async function read(next = false) {
    if (controller) return;
    if (next && (!frozen || nextCursor === null)) return;
    let query, incoming, before, pageNumber;
    try {
      if (!id(getScope())) throw Error('请先连接有效 Scope。');
      query = next ? frozen.query : input(); incoming = next ? nextCursor : null; before = next ? previousPosition : null;
      pageNumber = next ? frozen.pageNumber + 1 : 1;
    } catch (error) { invalidate(); el('state').textContent = '没有发送审计查询；旧结果已清除。'; notify(error.message, true); return; }
    const selectedScope = getScope(); invalidate(); scope = selectedScope; frozen = { query, pageNumber };
    const token = epoch, readController = new AbortController(); controller = readController; controls();
    const params = new URLSearchParams({ from: query.from, to: query.to, limit: String(query.limit), ...query.filters });
    if (incoming !== null) params.set('cursor', incoming);
    const timer = setTimeout(() => readController.abort(), 5000); el('state').textContent = '正在手动读取 owner/manager 审计记录，最多五秒；没有自动重试。';
    try {
      const data = await request('GET', 'audit-events?' + params.toString(), undefined, undefined, { signal: readController.signal, timeoutMs: 5000 });
      if (token !== epoch || readController.signal.aborted || scope !== selectedScope || getScope() !== selectedScope) return;
      if (!valid(data, query, selectedScope, before)) throw Error('审计响应的来源、窗口、精确筛选、顺序或字段格式无效。');
      if (data.nextCursor !== null && data.nextCursor === incoming) throw Error('服务器返回重复游标，禁止继续读取。');
      nextCursor = data.nextCursor; previousPosition = data.items.length ? position(data.items.at(-1)) : null; render(data, pageNumber);
    } catch (error) { if (token === epoch) { frozen = null; nextCursor = null; previousPosition = null; erase();
      el('state').textContent = error.httpStatus === 403 ? '需要当前 Scope 管理权限；旧安全时间线已清除。' : '审计读取失败或取消，旧结果和游标已清除；不推导无事件或完整性。';
      notify(readController.signal.aborted ? '审计读取已取消或超时' : error.message, true); } }
    finally { clearTimeout(timer); if (controller === readController) { controller = null; controls(); } }
  }
  for (const [name, values] of [['source', sources], ['errorCode', errorCodes]]) for (const value of values) {
    const option = document.createElement('option'); option.value = value; option.textContent = value; el(name).append(option);
  }
  for (const name of inputs) for (const event of ['input','change']) el(name).addEventListener(event, () => { invalidate();
    el('state').textContent = '输入已改变，旧页与游标已清除；须手动重新查询，不能混用旧时间窗。'; });
  el('form').addEventListener('submit', event => { event.preventDefault(); return read(); });
  el('next').addEventListener('click', () => read(true));
  el('cancel').addEventListener('click', () => { invalidate(); el('state').textContent = '本地读取已取消，不影响任何原事件或远程 Operation。'; });
  el('clear').addEventListener('click', clear);
  clear(); return { clear };
}
