const limits = { rowsPerScope: 1024, attemptsPerScope: 256, attemptsPage: 16, page: 50, retentionMs: 604800000,
  eventLifetimeMs: 3600000, claimMs: 30000, maximumAttempts: 6, activePerScope: 2, responseBytes: 262144,
  payloadBytes: 4096, activeRequests: 2, actorKeys: 128, cooldownMs: 1000 };
const statuses = ['queued','claimed','retry-wait','delivered','dead-letter','cancelled'];
const codes = ['HTTP_ACCEPTED','HTTP_REJECTED','DESTINATION_DENIED','DNS_DENIED','DNS_FAILED','DNS_TIMEOUT','CAPACITY_UNAVAILABLE',
  'REQUEST_INVALID','ABORTED','DEADLINE','RESPONSE_LIMIT','NETWORK_UNKNOWN','DISPATCH_DENIED','GUARD_FAILED','CREDENTIAL_UNAVAILABLE',
  'ATTEMPT_EXPIRED','EVENT_TOO_OLD','POLICY_CHANGED','ENDPOINT_CHANGED','AUTHORIZATION_REVOKED','CURRENT_SILENCE','RECOVERY_SUSPENDED','RATE_WAIT','CAPACITY_WAIT'];
const reasons = ['operation-failed','deployment-succeeded','deployment-succeeded-after-failure','operation-in-progress','administrative-state','target-unavailable',
  'recovery-suspended','evidence-unavailable','evidence-invalid','clock-regression','clock-uncertain','report-stale','report-fresh','fresh-baseline-required',
  'instance-changed','credential-expiring','credential-expired','credential-valid','credential-renewed','recovery-not-proven'];
const uint = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => uint(value) && value > 0;
const time = value => uint(value) && value <= 253402300799999;
const instant = value => typeof value === 'string' && time(Date.parse(value)) && new Date(value).toISOString() === value;
const bool = value => typeof value === 'boolean';
const id = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) && !/\s/.test(value);
const hash = value => typeof value === 'string' && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const one = (...values) => value => values.includes(value);
const nullable = check => value => value === null || check(value);
const array = (check, max) => value => Array.isArray(value) && value.length <= max && value.every(check);
const shape = fields => value => record(value) && Object.keys(value).length === Object.keys(fields).length &&
  Object.entries(fields).every(([key, check]) => Object.hasOwn(value, key) && check(value[key]));
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : record(value) ?
  '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const equal = (a, b) => canonical(a) === canonical(b);
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
async function digest(value) {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return 'sha256:' + Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
}
const statusCode = nullable(value => Number.isInteger(value) && value >= 100 && value <= 599);
const summary = shape({ kind: one('firing','recovered','invalidated'), rule: one('forward-operation-failed','node-report-stale','node-credential-expiring'),
  target: shape({ kind: one('forward','node'), id }), episode: positive, occurredAt: time, reason: one(...reasons) });
const deliveryShape = shape({ id, eventId: id, policyId: id, endpointId: id, policyConfigRevision: positive, endpointRevision: positive,
  credentialRevision: positive, payloadDigest: hash, revision: positive, status: one(...statuses), attemptCount: value => uint(value) && value <= 6,
  fence: uint, claimedAt: nullable(time), claimUntil: nullable(time), createdAt: time, updatedAt: time, nextAttemptAt: time, expiresAt: time,
  lastCode: nullable(one(...codes)), lastOutcome: one('none','delivered','rejected','unknown'), lastStatusCode: statusCode,
  recoverySuspended: bool, event: summary });
const delivery = value => deliveryShape(value) && value.fence === value.attemptCount && value.credentialRevision <= value.endpointRevision &&
  value.updatedAt >= value.createdAt && value.expiresAt === value.createdAt + limits.eventLifetimeMs && value.event.occurredAt === value.createdAt &&
  (value.event.rule === 'forward-operation-failed' ? value.event.target.kind === 'forward' : value.event.target.kind === 'node') &&
  (value.status === 'claimed' ? value.attemptCount >= 1 && value.claimedAt !== null && value.claimedAt >= value.createdAt &&
    value.claimUntil === value.claimedAt + limits.claimMs && value.nextAttemptAt >= value.claimUntil : value.claimedAt === null && value.claimUntil === null) &&
  (['delivered','dead-letter','cancelled'].includes(value.status) ? value.nextAttemptAt === 0 : value.nextAttemptAt >= value.createdAt) &&
  (value.status !== 'queued' || value.attemptCount === 0 && value.lastOutcome === 'none') && (value.status !== 'retry-wait' || value.attemptCount >= 1) &&
  (value.status !== 'delivered' || value.lastOutcome === 'delivered' && value.lastCode === 'HTTP_ACCEPTED' && value.lastStatusCode >= 200 && value.lastStatusCode < 300);
const attemptShape = shape({ id, deliveryId: id, ordinal: value => positive(value) && value <= 6, fence: positive, startedAt: time,
  finishedAt: nullable(time), outcome: one('pending','delivered','rejected','unknown'), code: nullable(one(...codes)), statusCode });
const attempt = value => attemptShape(value) && value.fence === value.ordinal && (value.outcome === 'pending' ? value.finishedAt === null &&
  value.code === null && value.statusCode === null : value.finishedAt !== null && value.finishedAt >= value.startedAt && value.code !== null) &&
  (value.outcome !== 'delivered' || value.code === 'HTTP_ACCEPTED' && value.statusCode >= 200 && value.statusCode < 300);
const losses = shape({ queueRejected: uint, routingRejected: uint, silenceSuppressed: uint, disabledSuppressed: uint,
  rowsExpired: uint, rowsEvicted: uint, attemptsEvicted: uint });
const cursor = value => value === null || typeof value === 'string' && value.length > 0 && value.length <= 1024 && /^[A-Za-z0-9_-]+$/.test(value);
const envelope = (fields, scope) => value => shape({ notificationDeliveriesVersion: one(1), scopeId: one(scope), capturedAt: time, deliveryEnabled: bool,
  workerState: one('configured-not-liveness-proof','disabled'), source: one('persisted-notification-deliveries'), readOnly: one(true), executionAuthorized: one(false),
  health: one('unknown'), networkCheck: one('not-performed-by-read'), consistency: one('read-committed-not-global-snapshot'),
  limits: item => equal(item, limits), ...fields })(value) && (value.deliveryEnabled ? value.workerState === 'configured-not-liveness-proof' : value.workerState === 'disabled');
const stamp = value => value === null ? '未知 / 无记录' : new Date(value).toISOString() + '\nAsia/Shanghai: ' + new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const summaryText = value => '原事件 ' + value.kind + ' / ' + value.rule + '\n' + value.target.kind + ' / ' + value.target.id + '\nepisode=' + value.episode +
  '\nreason=' + value.reason + '\n' + stamp(value.occurredAt);
async function associations(value, scope) {
  const expectedId = 'notify-' + (await digest({ scopeId: scope, eventId: value.eventId, endpointId: value.endpointId })).slice(7);
  const payload = { notificationVersion: 1, deliveryId: value.id, scopeId: scope, event: { id: value.eventId, policyId: value.policyId,
    configRevision: value.policyConfigRevision, episode: value.event.episode, kind: value.event.kind, rule: value.event.rule,
    target: value.event.target, reason: value.event.reason, occurredAt: value.event.occurredAt } };
  return value.id === expectedId && bytes(payload) <= limits.payloadBytes && await digest(payload) === value.payloadDigest;
}

export function initNotificationDeliveries({ request, notify, byId, getScope, document = globalThis.document }) {
  const el = name => byId('notification-delivery-' + name), inputs = ['from','to','endpoint','event','status','limit','id'];
  let epoch = 0, controller = null, frozen = null, nextCursor = null, tail = null;
  function controls() { el('read').disabled = Boolean(controller); el('detail-read').disabled = Boolean(controller);
    el('next').disabled = Boolean(controller) || !frozen || nextCursor === null; el('cancel').disabled = !controller;
    for (const button of el('rows').querySelectorAll('button')) button.disabled = Boolean(controller) || button.dataset.epoch !== String(epoch); }
  function erase() { frozen = null; nextCursor = null; tail = null; el('rows').replaceChildren(); el('attempts').replaceChildren(); el('detail').textContent = ''; el('meta').textContent = ''; el('losses').textContent = ''; controls(); }
  function invalidate() { epoch++; controller?.abort(); controller = null; erase(); }
  function message(text) { el('state').textContent = text; }
  function clear() { invalidate(); const now = Date.now(); for (const name of inputs) el(name).value = '';
    el('from').value = new Date(now - 86400000).toISOString(); el('to').value = new Date(now).toISOString(); el('limit').value = '25';
    message('manager 独立只读投递历史；不操作端点秘密待重放状态，不发起发送、测试、重试或 redrive。'); }
  function query() {
    const from = el('from').value.trim(), to = el('to').value.trim(), raw = el('limit').value;
    if (!instant(from) || !instant(to) || Date.parse(from) >= Date.parse(to) || Date.parse(to) - Date.parse(from) > limits.retentionMs ||
        Date.parse(from) < Date.now() - limits.retentionMs || !/^[1-9][0-9]*$/.test(raw) || Number(raw) > 50) return null;
    const filters = { endpointId: el('endpoint').value.trim() || null, eventId: el('event').value.trim() || null, status: el('status').value || null };
    if (filters.endpointId !== null && !id(filters.endpointId) || filters.eventId !== null && !id(filters.eventId) || filters.status !== null && !statuses.includes(filters.status)) return null;
    return Object.freeze({ from, to, limit: Number(raw), filters: Object.freeze(filters) });
  }
  function validHistory(data, q, scope, before) {
    if (!envelope({ window: shape({ from: time, to: time }), filters: value => equal(value, q.filters), limit: one(q.limit), items: array(delivery, q.limit),
      hasMore: bool, nextCursor: cursor, losses }, scope)(data) || data.window.from !== Date.parse(q.from) || data.window.to !== Date.parse(q.to) ||
      data.hasMore !== (data.nextCursor !== null) || data.hasMore && data.items.length !== q.limit || new Set(data.items.map(item => item.id)).size !== data.items.length) return false;
    let previous = before;
    for (const item of data.items) {
      if (item.createdAt < data.window.from || item.createdAt >= data.window.to || Object.entries(q.filters).some(([key, value]) => value !== null && item[key] !== value) ||
          previous && (item.createdAt > previous.createdAt || item.createdAt === previous.createdAt && item.id >= previous.id)) return false;
      previous = { createdAt: item.createdAt, id: item.id };
    }
    return true;
  }
  function cell(row, text) { const item = document.createElement('td'); item.textContent = text; row.append(item); }
  function rowFields(item) { return [item.id + '\n端点 ' + item.endpointId + '\n事件 ' + item.eventId + '\n政策 ' + item.policyId,
    summaryText(item.event), item.status + '\nCAS r' + item.revision + '\nattemptCount=' + item.attemptCount + ' / fence=' + item.fence +
      '\nlastOutcome=' + item.lastOutcome + '\nlastCode=' + (item.lastCode ?? '无') + '\nHTTP=' + (item.lastStatusCode ?? '无') + '\nrecoverySuspended=' + item.recoverySuspended,
    'policyConfig r' + item.policyConfigRevision + '\nendpoint r' + item.endpointRevision + '\ncredential r' + item.credentialRevision +
      '\n公开内容摘要（非秘密指纹/来源认证）\n' + item.payloadDigest,
    '创建 ' + stamp(item.createdAt) + '\n更新 ' + stamp(item.updatedAt) + '\nclaim ' + stamp(item.claimedAt) + '\nclaimUntil ' + stamp(item.claimUntil) +
      '\nnext ' + (item.nextAttemptAt === 0 ? '无后续调度（0）' : stamp(item.nextAttemptAt)) + '\nexpires ' + stamp(item.expiresAt)]; }
  function metadata(data) {
    el('meta').textContent = 'Scope ' + data.scopeId + '\n读取 ' + stamp(data.capturedAt) + '\ndeliveryEnabled=' + data.deliveryEnabled + ' / workerState=' + data.workerState +
      '\n' + data.source + ' / ' + data.consistency + '\nhealth=unknown / executionAuthorized=false / networkCheck=not-performed-by-read\n启用配置不是 worker 存活证明，GET 不创建或推进投递。';
    el('losses').textContent = 'Scope 累计计数，不是所选窗口的缺失量或完整性证明\n' + JSON.stringify(data.losses, null, 2);
  }
  async function read(detail = false, next = false) {
    if (controller || next && (!frozen || nextCursor === null)) return;
    const scope = getScope(), selectedId = el('id').value.trim(), q = detail ? null : next ? frozen.query : query();
    const incoming = next ? nextCursor : null, before = next ? tail : null, page = next ? frozen.page + 1 : 1;
    invalidate(); const token = epoch;
    if (!id(scope) || (detail ? !id(selectedId) : !q)) { message('输入或固定 UTC 窗口无效；未发送读取。窗口最多七天且起点仍须在保留期内。'); return; }
    let resource = 'notification-deliveries';
    if (detail) resource += '/' + encodeURIComponent(selectedId);
    else {
      const params = new URLSearchParams({ from: q.from, to: q.to, limit: String(q.limit) });
      for (const [key, value] of Object.entries(q.filters)) if (value !== null) params.set(key, value);
      if (incoming !== null) params.set('cursor', incoming); resource += '?' + params.toString();
    }
    const active = new AbortController(); controller = active; controls(); const timer = setTimeout(() => active.abort(), 5000);
    message('正在手动读取封闭投递投影，最多五秒；没有外发、测试或自动续页。');
    try {
      const data = await request('GET', resource, undefined, undefined, { signal: active.signal, timeoutMs: 5000 });
      if (token !== epoch || active.signal.aborted || scope !== getScope()) return;
      if (bytes(data) > limits.responseBytes) throw new Error();
      if (detail) {
        if (!envelope({ delivery, attempts: shape({ items: array(attempt, 16), truncated: bool }), losses }, scope)(data) || data.delivery.id !== selectedId ||
            !await associations(data.delivery, scope) || new Set(data.attempts.items.map(item => item.id)).size !== data.attempts.items.length) throw new Error();
        for (const [index, item] of data.attempts.items.entries()) if (item.deliveryId !== selectedId || index > 0 && item.ordinal >= data.attempts.items[index - 1].ordinal ||
            item.id !== 'attempt-' + (await digest({ deliveryId: item.deliveryId, fence: item.fence })).slice(7)) throw new Error();
        if (token !== epoch || active.signal.aborted || scope !== getScope()) return;
        el('detail').textContent = rowFields(data.delivery).join('\n\n') + '\n\nattempts.truncated=' + data.attempts.truncated +
          '\n最多十六项尝试投影；缺少行不代表没有发生，头部与尝试集合不是跨表全局快照。';
        for (const item of data.attempts.items) { const row = document.createElement('tr');
          for (const text of [item.id + '\nordinal=' + item.ordinal + ' / fence=' + item.fence, stamp(item.startedAt) + '\n结束 ' + stamp(item.finishedAt),
            item.outcome + '\ncode=' + (item.code ?? 'pending，无结果') + '\nHTTP=' + (item.statusCode ?? '无')]) cell(row, text); el('attempts').append(row); }
        if (!data.attempts.items.length) { const row = document.createElement('tr'); cell(row, '无可见尝试；可能尚未执行或已淘汰，不等于未发送'); el('attempts').append(row); }
      } else {
        if (!validHistory(data, q, scope, before) || data.nextCursor !== null && data.nextCursor === incoming ||
            !(await Promise.all(data.items.map(item => associations(item, scope)))).every(Boolean)) throw new Error();
        if (token !== epoch || active.signal.aborted || scope !== getScope()) return;
        frozen = { query: q, page }; nextCursor = data.nextCursor; tail = data.items.length ? { createdAt: data.items.at(-1).createdAt, id: data.items.at(-1).id } : null;
        for (const item of data.items) { const row = document.createElement('tr'); for (const text of rowFields(item)) cell(row, text);
          const area = document.createElement('td'), button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = '仅载入详情 ID'; button.dataset.epoch = String(token);
          button.addEventListener('click', () => { if (token !== epoch || controller) return; invalidate(); el('id').value = item.id; message('仅载入 ID；请明确手动读取详情，不发送或重试。'); }); area.append(button); row.append(area); el('rows').append(row); }
        if (!data.items.length) { const row = document.createElement('tr'); cell(row, '固定窗口无可见投递；不证明无事件、无抑制或无历史请求'); el('rows').append(row); }
        el('detail').textContent = '固定窗口 ' + stamp(data.window.from) + ' → ' + stamp(data.window.to) + '\n第 ' + page + ' 个手动 keyset 窗口 / 返回 ' + data.items.length +
          ' / hasMore=' + data.hasMore + '\n排序 createdAt/id 降序，没有总页数、自动续页或跨页快照承诺。';
      }
      metadata(data); message('投递历史仅供检查；dead-letter 或 unknown 不保证未送达，重复发送可能造成重复效果。HTTP 2xx 只表示接收端 HTTP 接受，不证明业务处理成功。');
    } catch { if (token === epoch) { erase(); message('读取失败、取消或无当前管理权限；旧页/游标已清除，没有显示服务器自由文本。'); notify('通知投递历史读取未完成，请核对权限或固定查询后手动重读。', true); } }
    finally { clearTimeout(timer); if (controller === active) { controller = null; controls(); } }
  }
  for (const status of statuses) { const option = document.createElement('option'); option.value = status; option.textContent = status; el('status').append(option); }
  for (const name of inputs) for (const event of ['input','change']) el(name).addEventListener(event, () => { invalidate(); message('本区输入已改变，旧页与游标清除；不影响端点秘密原命令或任何远程投递。'); });
  el('read').addEventListener('click', () => read()); el('next').addEventListener('click', () => read(false, true)); el('detail-read').addEventListener('click', () => read(true));
  el('cancel').addEventListener('click', () => { invalidate(); message('只取消本区读取，不取消 worker、投递或端点原敏感命令。'); }); el('clear').addEventListener('click', clear);
  clear(); return { clear };
}
