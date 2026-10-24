const limits = { policiesPerScope: 64, eventsPerScope: 1024, auditPerScope: 256, auditPage: 16, eventPage: 50,
  eventRetentionMs: 2592000000, evaluationIntervalMs: 30000, silenceMaxMs: 604800000, responseBytes: 262144,
  activeRequests: 2, actorKeys: 128, cooldownMs: 1000 };
const rules = ['forward-operation-failed','node-report-stale','node-credential-expiring','shared-usage-high','shared-period-ending','recent-path-probe-degraded'];
const reasons = ['operation-failed','deployment-succeeded','deployment-succeeded-after-failure','operation-in-progress','administrative-state','target-unavailable',
  'recovery-suspended','evidence-unavailable','evidence-invalid','clock-regression','clock-uncertain','report-stale','report-fresh',
  'fresh-baseline-required','instance-changed','credential-expiring','credential-expired','credential-valid','credential-renewed','recovery-not-proven',
  'usage-high','usage-below-threshold','usage-unknown','period-ending','period-ended','period-valid','period-changed','path-sample-failed','path-sample-slow','path-sample-within-threshold','path-sample-stale','path-binding-changed'];
const errors = ['AUTHORIZATION_DENIED','EXECUTION_DEADLINE','INTEGRITY_FAILURE','INVALID_CONFIG','UNSUPPORTED_CAPABILITY','RESOURCE_CONFLICT',
  'RESOURCE_LIMIT','PORT_RESERVED','FENCING_REJECTED','LEASE_EXPIRED','SESSION_SUPERSEDED','LISTEN_FAILED','BIND_FAILED','TARGET_DENIED',
  'CONNECT_FAILED','DIAL_FAILED','PEER_UNAVAILABLE','TLS_FAILED','RELAY_HANDSHAKE_FAILED','DRAIN_TIMEOUT','INTERNAL_ERROR','CLOCK_UNCERTAIN',
  'CONFIG_DIGEST_MISMATCH','AUTHENTICATION_FAILED','TARGET_REJECTED','DOWNSTREAM_NOT_ACTIVE','DOWNSTREAM_UNAVAILABLE','TARGET_UNAVAILABLE',
  'PORT_IN_USE','REVISION_CONFLICT','GROUP_ARCHIVED','TEMPLATE_ARCHIVED','REVISION_EXHAUSTED','PUBLICATION_STATE_CHANGED','NOT_FOUND','OTHER_ERROR'];
const uint = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => uint(value) && value > 0;
const time = value => uint(value) && value <= 253402300799999;
const bool = value => typeof value === 'boolean';
const id = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) && !/\s/.test(value);
const hash = value => typeof value === 'string' && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value);
const instant = value => typeof value === 'string' && time(Date.parse(value)) && new Date(value).toISOString() === value;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const one = (...values) => value => values.includes(value);
const nullable = check => value => value === null || check(value);
const array = (check, max) => value => Array.isArray(value) && value.length <= max && value.every(check);
const shape = fields => value => record(value) && Object.keys(value).length === Object.keys(fields).length &&
  Object.entries(fields).every(([key, check]) => Object.hasOwn(value, key) && check(value[key]));
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : record(value) ?
  '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const equal = (a, b) => canonical(a) === canonical(b);
async function digest(value) {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return 'sha256:' + Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
}
const configShape = shape({ schemaVersion: one(1), rule: one(...rules.slice(0,3)), target: shape({ kind: one('forward','node'), id }), enabled: bool, thresholdSeconds: uint });
const resourceConfigShape = shape({schemaVersion:one(2),rule:one('shared-usage-high','shared-period-ending'),target:shape({kind:one('node'),id}),
  enabled:bool,thresholdSeconds:uint,subjectActorId:id,thresholdPercent:nullable(positive)});
const pathConfigShape=shape({schemaVersion:one(3),rule:one('recent-path-probe-degraded'),target:shape({kind:one('forward'),id}),enabled:bool,thresholdSeconds:one(0),
  measurement:one('tcp-path-echo-v1','udp-path-echo-v1'),maxSampleAgeSeconds:positive,maxElapsedMs:positive});
const configValid = value => pathConfigShape(value)?value.maxSampleAgeSeconds>=30&&value.maxSampleAgeSeconds<=300&&value.maxElapsedMs<=2000:
  resourceConfigShape(value) ? value.rule === 'shared-usage-high' ? value.thresholdSeconds === 0 &&
  positive(value.thresholdPercent) && value.thresholdPercent <= 100 : value.thresholdPercent === null && value.thresholdSeconds >= 60 && value.thresholdSeconds <= 604800 :
  configShape(value) && (value.rule === 'forward-operation-failed' ? value.target.kind === 'forward' && value.thresholdSeconds === 0 :
  value.target.kind === 'node' && (value.rule === 'node-report-stale' ? value.thresholdSeconds >= 30 && value.thresholdSeconds <= 3600 :
    value.thresholdSeconds >= 60 && value.thresholdSeconds <= 604800));
const operationShape = shape({ kind: one('operation'), targetId: id, forwardRevision: positive, operationId: id, targetRevision: positive,
  operationKind: one('create','update','enable','disable','delete','retry','policy','revoke'), status: one('accepted','running','succeeded','failed','superseded'),
  sourceOperationId: nullable(id), createdAt: time, updatedAt: time, errorCode: nullable(one(...errors)), recoveryInvalidated: bool });
const operation = value => operationShape(value) && value.updatedAt >= value.createdAt;
const report = shape({ kind: one('node-report'), targetId: id, bootId: id, sessionEpoch: positive, reportSequence: positive, snapshotGeneration: positive,
  observedAt: time, receivedAt: time, credentialUntil: time });
const credential = shape({ kind: one('node-credential'), targetId: id, credentialUntil: time });
const decimal = value => typeof value === 'string' && /^(0|[1-9][0-9]{0,15})$/.test(value) && BigInt(value) <= 9007199254740991n;
const resourceEvidenceShape = shape({kind:one('resource-limit'),targetId:id,actorId:id,bucketId:id,policyRevision:positive,
  startsAt:time,endsAt:time,byteLimit:nullable(decimal),usedBytes:nullable(decimal),receivedAt:nullable(time),usageStatus:one('fresh','stale','unknown','policy-outdated')});
const resourceEvidence = value => resourceEvidenceShape(value) && value.startsAt < value.endsAt &&
  (value.usageStatus !== 'fresh' || value.usedBytes !== null && value.receivedAt !== null) &&
  (value.usageStatus !== 'unknown' || value.usedBytes === null && value.receivedAt === null);
const pathEvidenceShape=shape({kind:one('path-probe'),targetId:id,forwardRevision:positive,bindingDigest:hash,probeId:id,
  measurement:one('tcp-path-echo-v1','udp-path-echo-v1'),status:one('echoed','unverified','unreachable'),elapsedMs:uint,measuredAt:time,acceptedAt:time,validUntil:time});
const pathEvidence=value=>pathEvidenceShape(value)&&value.elapsedMs<=2000&&value.measuredAt<=value.acceptedAt&&value.acceptedAt<value.validUntil&&
  !(value.measurement==='udp-path-echo-v1'&&value.status==='unreachable');
const evidence = value => operation(value) || report(value) || credential(value) || resourceEvidence(value) || pathEvidence(value) || shape({ kind: one('unavailable'), targetId: id })(value);
const evaluation = shape({ status: one('clear','firing','unknown'), reason: one(...reasons), instanceKey: nullable(hash), evidence });
const stateShape = shape({ condition: one('unknown','clear','firing'), episode: uint, instanceKey: nullable(hash), armed: bool,
  openedAt: nullable(time), opening: nullable(evidence), lastFiring: nullable(evidence), last: nullable(evaluation), evaluatedAt: nullable(time) });
const state = value => stateShape(value) && (value.last === null) === (value.evaluatedAt === null) &&
  (value.condition === 'firing' ? value.episode > 0 && value.opening !== null && value.opening.kind !== 'unavailable' && value.lastFiring !== null &&
    value.lastFiring.kind === value.opening.kind && value.lastFiring.targetId === value.opening.targetId && value.openedAt !== null :
    value.opening === null && value.lastFiring === null && value.openedAt === null) &&
  (value.openedAt === null || value.evaluatedAt === null || value.openedAt <= value.evaluatedAt);
const policyFields = { policyId: id, revision: positive, configRevision: positive, config: configValid, configDigest: hash, managedBy: id,
  createdAt: time, updatedAt: time, silencedUntil: nullable(time), suspended: one('none','recovery','actor-not-authorized'), nextEvaluateAt: time };
const boundEvidence = (config, value) => value.targetId === config.target.id && (value.kind === 'unavailable' || value.kind ===
  (config.schemaVersion===3?'path-probe':config.schemaVersion === 2 ? 'resource-limit' : config.rule === 'forward-operation-failed' ? 'operation' : config.rule === 'node-report-stale' ? 'node-report' : 'node-credential') &&
  (config.schemaVersion !== 2 || value.actorId === config.subjectActorId)&&(config.schemaVersion!==3||value.measurement===config.measurement));
const policyShape = shape({ ...policyFields, state });
const policy = value => policyShape(value) && value.updatedAt >= value.createdAt &&
  [value.state.opening,value.state.lastFiring,value.state.last?.evidence].every(item => !item || boundEvidence(value.config, item));
const headShape = shape({ ...policyFields, condition: one('unknown','clear','firing'), evaluatedAt: nullable(time), lastReason: nullable(one(...reasons)) });
const head = value => headShape(value) && value.updatedAt >= value.createdAt && (value.evaluatedAt === null) === (value.lastReason === null);
const auditShape = shape({ id, policyId: id, revision: positive, configRevision: positive, configDigest: hash, kind: one('publish','silence','acknowledge'),
  actorId: id, createdAt: time, eventId: nullable(id) });
const audit = value => auditShape(value) && (value.kind === 'acknowledge') === (value.eventId !== null);
const eventShape = shape({ id, policyId: id, policyRevision: positive, configRevision: positive, config: configValid, configDigest: hash, episode: positive,
  kind: one('firing','recovered','invalidated'), reason: one(...reasons), occurredAt: time, evidence, opening: nullable(evidence), silenced: bool,
  silencedUntil: nullable(time), revision: positive, acknowledgedAt: nullable(time), recoverySuspended: bool });
const event = value => eventShape(value) && value.evidence.kind !== 'unavailable' && value.opening !== null && value.opening.kind !== 'unavailable' &&
  boundEvidence(value.config, value.evidence) && boundEvidence(value.config, value.opening) &&
  (value.acknowledgedAt === null || value.acknowledgedAt >= value.occurredAt);
const cursor = value => value === null || typeof value === 'string' && value.length > 0 && value.length <= 1024 && /^[A-Za-z0-9_-]+$/.test(value);
const losses = shape({ eventsEvicted: uint, eventsExpired: uint, auditEvicted: uint });
const envelope = (extra, scope) => shape({ stationAlertsVersion: one(1), scopeId: one(scope), capturedAt: time, observerEnabled: bool,
  source: one('persisted-station-alerts'), readOnly: one(true), executionAuthorized: one(false), health: one('unknown'), networkCheck: one('not-performed'),
  consistency: one('read-committed-not-global-snapshot'), limits: value => equal(value, limits), ...extra });
const bounded = value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= limits.responseBytes;
const explicitRejection = error => [400,401,403,404,409,413,422,429].includes(error.httpStatus);
const stamp = value => value === null ? '未知 / 无记录（不是零）' : new Date(value).toISOString() + '\nAsia/Shanghai: ' +
  new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const timeKeys = new Set(['createdAt','updatedAt','silencedUntil','nextEvaluateAt','evaluatedAt','openedAt','observedAt','receivedAt','credentialUntil','occurredAt','acknowledgedAt','measuredAt','acceptedAt','validUntil']);
const show = value => JSON.stringify(value, (key, item) => timeKeys.has(key) && time(item) ? stamp(item) : item, 2);

export function initStationAlerts({ request, notify, byId, getScope, document = globalThis.document, confirm = globalThis.confirm, randomUUID = () => crypto.randomUUID() }) {
  const el = name => byId('station-alert-' + name);
  const policyInputs = ['policy-id','expected','rule','target-id','enabled','threshold','subject','percent','path-measurement','sample-age','sample-elapsed','silence-until'];
  const historyInputs = ['from','to','limit','filter-policy','filter-target','filter-rule','filter-kind','filter-ack'];
  const inputs = [...policyInputs,...historyInputs,'event-id'];
  const reads = ['policies-read','policy-read','events-read','event-read'];
  let epoch = 0, controller = null, loadedPolicy = null, loadedEvent = null, frozen = null, nextCursor = null, tail = null, pending = null, sending = false;
  function controls() {
    const locked = Boolean(pending) || sending, busy = locked || Boolean(controller);
    for (const name of inputs) el(name).disabled = locked;
    for (const name of reads) el(name).disabled = busy;
    el('publish').disabled = busy; el('silence').disabled = busy || !loadedPolicy; el('unsilence').disabled = busy || !loadedPolicy;
    el('acknowledge').disabled = busy || !loadedEvent || loadedEvent.acknowledgedAt !== null;
    el('next').disabled = busy || !frozen || nextCursor === null;
    el('replay').disabled = !pending || sending; el('cancel-read').disabled = locked || !controller; el('clear').disabled = sending;
    for (const area of ['policies','events']) for (const button of el(area).querySelectorAll('button')) button.disabled = busy || button.dataset.epoch !== String(epoch);
  }
  function erase() {
    loadedPolicy = null; loadedEvent = null; frozen = null; nextCursor = null; tail = null;
    for (const name of ['policies','events']) el(name).replaceChildren();
    for (const name of ['policy-output','event-output','meta','receipt']) el(name).textContent = ''; controls();
  }
  function invalidate() { epoch++; controller?.abort(); controller = null; erase(); }
  function message(text) { el('state').textContent = text; }
  function clear() {
    pending = null; sending = false; invalidate();
    for (const name of inputs) if (el(name).type === 'checkbox') el(name).checked = false; else el(name).value = '';
    const now = Date.now(); el('expected').value = '0'; el('rule').value = 'forward-operation-failed'; el('threshold').value = '0';el('percent').value='80';el('path-measurement').value='tcp-path-echo-v1';el('sample-age').value='120';el('sample-elapsed').value='250';
    el('from').value = new Date(now - 86400000).toISOString(); el('to').value = new Date(now).toISOString(); el('limit').value = '25';
    controls(); message('本片仅站内事件/固定政策。Viewer 手动读事件；manager 每次由后端核验写权限。没有自动读取、网络探测或外发。');
  }
  async function call(method, resource, body, key) {
    const read = new AbortController(); controller = read; controls(); const timer = setTimeout(() => read.abort(), 5000);
    try { return await request(method, resource, body, key, { signal: read.signal, timeoutMs: 5000 }); }
    finally { clearTimeout(timer); if (controller === read) { controller = null; controls(); } }
  }
  function cell(row, text) { const item = document.createElement('td'); item.textContent = text; row.append(item); }
  function selectButton(row, value, kind, token) {
    const area = document.createElement('td'), button = document.createElement('button'); button.type = 'button'; button.className = 'secondary';
    button.textContent = '仅载入 ID，须手动读取'; button.dataset.epoch = String(token);
    button.addEventListener('click', () => { if (token !== epoch || pending || sending || controller) return;
      invalidate(); el(kind + '-id').value = value; message('仅载入 ' + kind + ' ID；请手动读取，不自动执行管理操作。'); }); area.append(button); row.append(area);
  }
  function metadata(data) { el('meta').textContent = 'Scope ' + data.scopeId + '\n读取 ' + stamp(data.capturedAt) + '\nobserverEnabled=' + data.observerEnabled +
    '\n' + data.source + ' / ' + data.consistency + '\nhealth=unknown / executionAuthorized=false / networkCheck=not-performed\nGET 不评价政策、补抓历史或创建事件。'; }
  async function hashes(values) { return (await Promise.all(values.map(async value => await digest(value.config) === value.configDigest))).every(Boolean); }
  async function read(kind, next = false) {
    if (pending || sending || controller || next && (!frozen || nextCursor === null)) return;
    let resource, query = null, incoming = null, before = null, page = 1, selectedId = null;
    try {
      if (!id(getScope())) throw Error('请先连接有效 Scope');
      if (kind === 'policies') resource = 'alert-policies';
      else if (kind === 'policy' || kind === 'event') {
        selectedId = el(kind + '-id').value.trim(); if (!id(selectedId)) throw Error('需要精确 ' + kind + ' ID');
        resource = (kind === 'policy' ? 'alert-policies/' : 'station-events/') + encodeURIComponent(selectedId);
      } else {
        query = next ? frozen.query : historyQuery(); incoming = next ? nextCursor : null; before = next ? tail : null; page = next ? frozen.page + 1 : 1;
        const params = new URLSearchParams({ from: query.from, to: query.to, limit: String(query.limit) });
        for (const [key, value] of Object.entries(query.filters)) params.set(key, String(value));
        if (incoming !== null) params.set('cursor', incoming); resource = 'station-events?' + params.toString();
      }
    } catch (error) { invalidate(); message('未发送读取；旧结果已清除。'); notify(error.message, true); return; }
    invalidate(); const token = epoch, scope = getScope(); message('正在手动读取有界站内状态，最多五秒；没有自动评价或重试。');
    try {
      const data = await call('GET', resource); if (token !== epoch || scope !== getScope()) return;
      if (!bounded(data)) throw Error('站内响应超过有界大小');
      if (kind === 'policies') {
        if (!envelope({ items: array(head, 64) }, scope)(data) || new Set(data.items.map(value => value.policyId)).size !== data.items.length || !await hashes(data.items)) throw Error('政策列表格式或配置摘要无效');
        if (token !== epoch || scope !== getScope()) return;
        for (const item of data.items) {
          const row = document.createElement('tr'); cell(row, item.policyId + '\nCAS r' + item.revision + ' / config r' + item.configRevision);
          cell(row, show(item.config)); cell(row, item.condition + '\nreason=' + (item.lastReason ?? '无评价') + '\nevaluated=' + stamp(item.evaluatedAt));
          cell(row, 'managedBy=' + item.managedBy + '\nsuspended=' + item.suspended + '\nsilencedUntil=' + stamp(item.silencedUntil) + '\nnext=' + stamp(item.nextEvaluateAt));
          selectButton(row, item.policyId, 'policy', token); el('policies').append(row);
        }
        if (!data.items.length) { const row = document.createElement('tr'); cell(row, '无可见政策；不表示目标健康或历史完整'); el('policies').append(row); }
      } else if (kind === 'policy') {
        if (!envelope({ policy, audit: shape({ items: array(audit, 16), truncated: bool }) }, scope)(data) || data.policy.policyId !== selectedId ||
            data.audit.items.some(item => item.policyId !== selectedId) || !await hashes([data.policy])) throw Error('政策详情、审计或摘要无效');
        if (token !== epoch || scope !== getScope()) return;
        loadedPolicy = JSON.parse(JSON.stringify(data.policy)); const config = data.policy.config;
        el('expected').value = String(data.policy.revision); el('rule').value = config.rule; el('target-id').value = config.target.id;
        el('enabled').checked = config.enabled; el('threshold').value = String(config.thresholdSeconds);
        el('subject').value = config.subjectActorId ?? ''; el('percent').value = String(config.thresholdPercent ?? 80);el('path-measurement').value=config.measurement??'tcp-path-echo-v1';el('sample-age').value=String(config.maxSampleAgeSeconds??120);el('sample-elapsed').value=String(config.maxElapsedMs??250);
        el('policy-output').textContent = show({ policy: data.policy, audit: data.audit });
      } else if (kind === 'event') {
        if (!envelope({ event }, scope)(data) || data.event.id !== selectedId || !await hashes([data.event])) throw Error('站内事件或摘要无效');
        if (token !== epoch || scope !== getScope()) return;
        loadedEvent = JSON.parse(JSON.stringify(data.event)); el('event-output').textContent = show(data.event);
      } else {
        if (!validHistory(data, query, scope, before) || !await hashes(data.items) || data.nextCursor !== null && data.nextCursor === incoming) throw Error('站内历史、固定窗口、筛选、顺序或摘要无效');
        if (token !== epoch || scope !== getScope()) return;
        frozen = { query, page }; nextCursor = data.nextCursor; tail = data.items.length ? { occurredAt: data.items.at(-1).occurredAt, id: data.items.at(-1).id } : null;
        for (const item of data.items) {
          const row = document.createElement('tr'); cell(row, stamp(item.occurredAt) + '\n' + item.id); cell(row, item.policyId + '\n政策 r' + item.policyRevision + ' / config r' + item.configRevision + '\nepisode=' + item.episode);
          cell(row, item.kind + '\n' + item.reason + '\n' + item.config.rule + '\n' + item.config.target.kind + ' / ' + item.config.target.id);
          cell(row, show({ evidence: item.evidence, opening: item.opening })); cell(row, 'silenced=' + item.silenced + '\nuntil=' + stamp(item.silencedUntil) +
            '\nack=' + stamp(item.acknowledgedAt) + '\nCAS r' + item.revision + '\nrecoverySuspended=' + item.recoverySuspended);
          selectButton(row, item.id, 'event', token); el('events').append(row);
        }
        if (!data.items.length) { const row = document.createElement('tr'); cell(row, '窗口无可见站内事件；不等于没有异常或目标健康'); el('events').append(row); }
        el('receipt').textContent = '固定窗口 ' + stamp(data.window.from) + ' → ' + stamp(data.window.to) + '\n第 ' + page + ' 次手动 keyset 页 / ' + data.items.length +
          ' 条 / hasMore=' + data.hasMore + '\n累计丢失计数（非本窗口丢失量，也不保证完整）\n' + show(data.losses);
      }
      metadata(data); controls(); message('只读持久状态已载入。clear/recovered/ack/silence 均不是目标健康或命令执行授权；写入后须手动重读。');
    } catch (error) { if (token === epoch) { erase(); message('读取失败或取消，旧资格与游标已清除；权限拒绝不推导无事件。'); notify(error.message, true); } }
  }
  function historyQuery() {
    const from = el('from').value.trim(), to = el('to').value.trim(), raw = el('limit').value;
    if (!instant(from) || !instant(to) || Date.parse(from) >= Date.parse(to) || Date.parse(to) - Date.parse(from) > limits.eventRetentionMs ||
        Date.parse(from) < Date.now() - limits.eventRetentionMs) throw Error('需要规范 UTC 固定窗口，最多 30 天且起点仍在最近 30 天内；不会自动滑动');
    if (!/^[1-9][0-9]*$/.test(raw) || Number(raw) > 50) throw Error('事件页上限需要 1 至 50');
    const filters = {};
    for (const [name, key] of [['filter-policy','policyId'],['filter-target','targetId'],['filter-rule','rule'],['filter-kind','kind'],['filter-ack','acknowledged']]) {
      const value = el(name).value.trim(); if (!value) continue;
      if (key === 'rule' ? !rules.includes(value) : key === 'kind' ? !['firing','recovered','invalidated'].includes(value) : key === 'acknowledged' ? !['true','false'].includes(value) : !id(value)) throw Error('精确事件筛选无效');
      filters[key] = key === 'acknowledged' ? value === 'true' : value;
    }
    return Object.freeze({ from, to, limit: Number(raw), filters: Object.freeze(filters) });
  }
  function validHistory(data, query, scope, before) {
    if (!envelope({ window: shape({ from: time, to: time }), filters: value => equal(value, query.filters), limit: one(query.limit),
      items: array(event, query.limit), hasMore: bool, nextCursor: cursor, losses }, scope)(data) || data.window.from !== Date.parse(query.from) ||
      data.window.to !== Date.parse(query.to) || data.hasMore !== (data.nextCursor !== null) || data.hasMore && data.items.length !== query.limit ||
      new Set(data.items.map(item => item.id)).size !== data.items.length) return false;
    let previous = before;
    for (const item of data.items) {
      if (item.occurredAt < data.window.from || item.occurredAt >= data.window.to || previous &&
          (item.occurredAt > previous.occurredAt || item.occurredAt === previous.occurredAt && item.id >= previous.id) ||
          Object.entries(query.filters).some(([key, value]) => key === 'targetId' ? item.config.target.id !== value : key === 'rule' ? item.config.rule !== value :
            key === 'acknowledged' ? (item.acknowledgedAt !== null) !== value : item[key] !== value)) return false;
      previous = { occurredAt: item.occurredAt, id: item.id };
    }
    return true;
  }
  function draft() {
    const path=el('rule').value==='recent-path-probe-degraded',resource = ['shared-usage-high','shared-period-ending'].includes(el('rule').value);
    const config = { schemaVersion: path?3:resource ? 2 : 1, rule: el('rule').value, target: { kind: path||el('rule').value === 'forward-operation-failed' ? 'forward' : 'node', id: el('target-id').value.trim() },
      ...(resource ? {subjectActorId:el('subject').value.trim(),thresholdPercent:el('rule').value === 'shared-usage-high' ? Number(el('percent').value) : null} : {}),
      ...(path?{measurement:el('path-measurement').value,maxSampleAgeSeconds:Number(el('sample-age').value),maxElapsedMs:Number(el('sample-elapsed').value)}:{}),
      enabled: el('enabled').checked, thresholdSeconds: Number(el('threshold').value) };
    if(path&&![el('sample-age').value,el('sample-elapsed').value].every(value=>/^[1-9][0-9]*$/.test(value)))throw Error('样本年龄与耗时阈值必须是明确整数。');
    if (!/^(0|[1-9][0-9]*)$/.test(el('threshold').value) || !configValid(config)) throw Error('固定规则目标/阈值无效；Forward 失败阈值 0，Node 过期报告 30–3600 秒，凭据到期 60–604800 秒');
    const policyId = el('policy-id').value.trim(), revision = el('expected').value;
    if (!id(policyId) || !/^(0|[1-9][0-9]*)$/.test(revision) || !uint(Number(revision))) throw Error('需要政策 ID 与明确 CAS，创建填 0');
    return { policyId, expectedRevision: Number(revision), config };
  }
  async function send(original, replay = false) {
    if (sending || pending !== original || original.scope !== getScope()) return;
    const token = epoch; sending = true; controls(); message('正在提交唯一原管理命令；不自动评价目标、执行 Operation 或外发。');
    try {
      const data = await call(original.method, original.resource, JSON.parse(JSON.stringify(original.body)), original.key);
      if (token !== epoch || pending !== original || original.scope !== getScope()) return;
      const key = original.kind === 'acknowledge' ? 'eventId' : 'policyId';
      if (!shape({ [key]: one(original.id), revision: positive, changed: bool })(data) || data.revision !== original.body.expectedRevision + Number(data.changed)) throw Error('管理回执无效，提交仍可能已经接受');
      pending = null; sending = false; invalidate(); el('receipt').textContent = show(data); controls();
      message('管理命令已明确返回。请手动重读获取新 CAS；同配置/同管理者且未挂起的发布是 no-op。静默、确认及条件基线重置都不表示健康或恢复。');
    } catch (error) { if (token === epoch) { sending = false; if (!replay && explicitRejection(error)) pending = null; controls(); message(pending ?
      '原结果不确定：只能明确重放原 URL/body/key；其他读写已锁定。重放被拒绝也不能证明原提交不存在。' :
      '初次管理请求明确拒绝；未换 CAS 或自动重试。须手动重读后决定。'); notify(error.message, true); } }
  }
  function command(kind) {
    if (pending || sending || controller) return;
    try {
      if (!id(getScope())) throw Error('请先连接有效 Scope，再明确提交管理命令');
      let method = 'POST', resource, body, selectedId;
      if (kind === 'publish') {
        const value = draft(); selectedId = value.policyId; method = 'PUT'; resource = 'alert-policies/' + encodeURIComponent(selectedId);
        body = { expectedRevision: value.expectedRevision, config: value.config };
      } else if (kind === 'acknowledge') {
        if (!loadedEvent || loadedEvent.acknowledgedAt !== null) return;
        selectedId = loadedEvent.id; resource = 'station-events/' + encodeURIComponent(selectedId) + '/acknowledge'; body = { expectedRevision: loadedEvent.revision };
      } else {
        if (!loadedPolicy) return;
        let until = null;
        if (kind === 'silence') { const value = el('silence-until').value.trim();
          if (!instant(value) || Date.parse(value) <= Date.now() || Date.parse(value) > Date.now() + limits.silenceMaxMs) throw Error('静默截止需明确未来 UTC，最多七天'); until = Date.parse(value); }
        selectedId = loadedPolicy.policyId; resource = 'alert-policies/' + encodeURIComponent(selectedId) + '/silence'; body = { expectedRevision: loadedPolicy.revision, until };
      }
      const warning = kind === 'publish' ? '明确发布/接管/恢复挂起政策？仅配置变更、接管或挂起后重新发布才增加 configRevision 并清除基线；完全相同且未挂起则 no-op。目标授权仍须核验，不会立即评价或表示恢复。' :
        kind === 'acknowledge' ? '仅确认看过这一条站内事件？不改变异常条件、不恢复目标、不取消或重试任何 Operation。' :
          '仅修改这项政策的静默窗口？静默期间事件仍保存并标记，不会事后补发；不改变条件、不恢复目标。';
      if (!confirm(warning)) return;
      invalidate(); pending = { kind, method, resource, body, id: selectedId, key: randomUUID(), scope: getScope() }; return send(pending);
    } catch (error) { notify(error.message, true); }
  }
  for (const name of inputs) for (const action of ['input','change']) el(name).addEventListener(action, () => {
    if (pending || sending) return;
    if (name === 'silence-until') return;
    invalidate(); message('输入已改变，旧资格/历史/游标已清除；请手动重读或明确提交，不自动执行。');
  });
  el('rule').addEventListener('change', () => { if (!pending && !sending) el('threshold').value = ['forward-operation-failed','shared-usage-high','recent-path-probe-degraded'].includes(el('rule').value) ? '0' : el('rule').value === 'node-report-stale' ? '300' : '86400'; });
  for (const [name, kind] of [['policies-read','policies'],['policy-read','policy'],['events-read','events'],['event-read','event']]) el(name).addEventListener('click', () => read(kind));
  el('next').addEventListener('click', () => read('events', true));
  for (const kind of ['publish','silence','unsilence','acknowledge']) el(kind).addEventListener('click', () => command(kind));
  el('replay').addEventListener('click', () => { if (pending && !sending && confirm('仅重放原键/body/URL？不换 CAS、不换目标、不评价或继续其他命令。')) return send(pending, true); });
  el('cancel-read').addEventListener('click', () => { if (!pending && !sending) { invalidate(); message('只取消本地读取；原事件、静默和 Operation 不受影响。'); } });
  el('clear').addEventListener('click', () => { if (!sending && (!pending || confirm('放弃本地原命令记忆？原请求可能已提交，这不会取消或回滚任何远程变更。'))) clear(); });
  clear(); return { clear };
}
