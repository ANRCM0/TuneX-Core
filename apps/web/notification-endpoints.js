const limits = { endpointsPerScope: 16, policiesPerEndpoint: 16, auditPerScope: 128, auditPage: 16,
  requestBytes: 8192, responseBytes: 131072, activeRequests: 2, actorKeys: 128, cooldownMs: 1000 };
const uint = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => uint(value) && value > 0;
const time = value => uint(value) && value <= 253402300799999;
const bool = value => typeof value === 'boolean';
const id = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) && !/\s/.test(value);
const hash = value => typeof value === 'string' && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const one = (...values) => value => values.includes(value);
const array = (check, max) => value => Array.isArray(value) && value.length <= max && value.every(check);
const shape = fields => value => record(value) && Object.keys(value).length === Object.keys(fields).length &&
  Object.entries(fields).every(([key, check]) => Object.hasOwn(value, key) && check(value[key]));
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : record(value) ?
  '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const equal = (a, b) => canonical(a) === canonical(b);
const size = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
async function digest(value) {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return 'sha256:' + Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
}
const ordered = (value, check, maximum) => array(check, maximum)(value) && value.length > 0 && value.every((item, index) => index === 0 || value[index - 1] < item);
const config = shape({ schemaVersion: one(1), enabled: bool, policyIds: value => ordered(value, id, 16),
  kinds: value => ordered(value, one('firing','invalidated','recovered'), 3), minimumIntervalSeconds: value => positive(value) && value >= 10 && value <= 3600 });
const endpointShape = shape({ endpointId: id, revision: positive, credentialRevision: positive, config, configDigest: hash, managedBy: id,
  createdAt: time, updatedAt: time, suspended: one('none','recovery'), credentials: shape({ configured: one(true), verification: one('not-read-on-get') }) });
const endpoint = value => endpointShape(value) && value.credentialRevision <= value.revision && value.updatedAt >= value.createdAt;
const audit = shape({ id, endpointId: id, revision: positive, kind: one('publish','disable'), actorId: id, createdAt: time });
const envelope = (fields, scope) => shape({ notificationEndpointsVersion: one(1), scopeId: one(scope), capturedAt: time, secretsConfigured: bool,
  deliveryAvailable: bool, source: one('persisted-notification-endpoints'), readOnly: one(true), executionAuthorized: one(false), health: one('unknown'),
  networkCheck: one('not-performed'), consistency: one('read-committed-not-global-snapshot'), limits: value => equal(value, limits), ...fields });
const stamp = value => new Date(value).toISOString() + '\nAsia/Shanghai: ' + new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const publicText = value => JSON.stringify(value, (key, item) => ['createdAt','updatedAt'].includes(key) && time(item) ? stamp(item) : item, 2);
const definiteInitialRejection = error => [400,401,403,404,409,413,422,429].includes(error.httpStatus);

// Only syntactic validation happens here. The browser never resolves or visits the destination.
function destinationUrl(value) {
  if (typeof value !== 'string' || new TextEncoder().encode(value).byteLength > 2048 || /[^\x21-\x7e]|[\\?#]/.test(value) || !value.startsWith('https://')) return null;
  let parsed;
  try { parsed = new URL(value); } catch { return null; }
  const hostname = parsed.hostname;
  if (parsed.protocol !== 'https:' || parsed.port !== '' && parsed.port !== '443' || parsed.username || parsed.password ||
      value.slice(8).split('/')[0].includes('@') || parsed.search || parsed.hash || hostname.length > 253 || !hostname.includes('.') || hostname.endsWith('.') ||
      hostname.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
      !/^[a-z]/.test(hostname.split('.').at(-1)) || /(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|example|onion|arpa)$/.test(hostname) ||
      new TextEncoder().encode(parsed.href).byteLength > 2048) return null;
  return parsed.href;
}

export function initNotificationEndpoints({ request, notify, byId, getScope, document = globalThis.document, confirm = globalThis.confirm, randomUUID = () => crypto.randomUUID() }) {
  const el = name => byId('notification-endpoint-' + name);
  const configInputs = ['enabled','policies','firing','invalidated','recovered','interval'];
  const inputs = ['id','expected',...configInputs,'url','signing-key'];
  let epoch = 0, controller = null, loaded = null, pending = null, sending = false;
  function message(text) { el('state').textContent = text; }
  function wipeSecrets() { for (const name of ['url','signing-key']) { el(name).value = ''; el(name).defaultValue = ''; } }
  function wipeDraft() {
    wipeSecrets();
    for (const name of configInputs) if (el(name).type === 'checkbox') el(name).checked = false; else el(name).value = '';
  }
  function controls() {
    const locked = Boolean(pending) || sending, busy = locked || Boolean(controller);
    for (const name of inputs) el(name).disabled = locked;
    for (const name of ['list','read','publish']) el(name).disabled = busy;
    el('disable').disabled = busy || !loaded || el('id').value.trim() !== loaded.endpointId || el('expected').value !== String(loaded.revision);
    el('cancel').disabled = locked || !controller; el('replay').disabled = !pending || sending; el('clear').disabled = sending;
    for (const button of el('rows').querySelectorAll('button')) button.disabled = busy || button.dataset.epoch !== String(epoch);
  }
  function erase() { loaded = null; el('rows').replaceChildren(); el('record').textContent = ''; el('meta').textContent = ''; el('receipt').textContent = ''; controls(); }
  function invalidate() { epoch++; controller?.abort(); controller = null; erase(); }
  function clear() {
    pending = null; sending = false; invalidate(); wipeDraft(); el('id').value = ''; el('expected').value = '0'; el('interval').value = '60';
    controls(); message('仅 manager 手动管理通知意图；端点命令不发送或测试。独立 worker 默认关闭，状态须手动读取投递历史；URL 与签名密钥不从 GET 回显。');
  }
  async function call(method, resource, body, key) {
    const active = new AbortController(); controller = active; controls(); const timer = setTimeout(() => active.abort(), 5000);
    try { return await request(method, resource, body, key, { signal: active.signal, timeoutMs: 5000 }); }
    finally { clearTimeout(timer); if (controller === active) { controller = null; controls(); } }
  }
  function metadata(data) { el('meta').textContent = 'Scope ' + data.scopeId + '\n读取 ' + stamp(data.capturedAt) + '\n' + data.source + ' / ' + data.consistency +
    '\nsecretsConfigured=' + data.secretsConfigured + ' 仅表示服务器配置了秘密适配器，不表示逐条秘密已验证。\ndeliveryAvailable=' + data.deliveryAvailable +
    ' 仅表示运行配置标志，不证明 worker 存活或接收端已处理。\nnetworkCheck=not-performed / health=unknown\n审计累计淘汰 ' + data.auditEvicted + '；不是当前页损失量或完整性证明。'; }
  async function read(list = false) {
    if (pending || sending || controller) return;
    const scope = getScope(), selectedId = el('id').value.trim();
    wipeSecrets(); invalidate(); const token = epoch;
    if (!id(scope) || !list && !id(selectedId)) { message('需要已连接 Scope 和精确端点 ID；未发送请求。'); return; }
    message('正在读取脱敏管理元数据，最多五秒；不读取秘密、不访问目的地址。');
    try {
      const data = await call('GET', 'notification-endpoints' + (list ? '' : '/' + encodeURIComponent(selectedId)));
      if (token !== epoch || scope !== getScope()) return;
      if (size(data) > limits.responseBytes) throw new Error();
      if (list) {
        if (!envelope({ items: array(endpoint, 16), auditEvicted: uint }, scope)(data) ||
            new Set(data.items.map(item => item.endpointId)).size !== data.items.length ||
            !(await Promise.all(data.items.map(async item => await digest(item.config) === item.configDigest))).every(Boolean)) throw new Error();
        if (token !== epoch || scope !== getScope()) return;
        for (const item of data.items) {
          const row = document.createElement('tr');
          for (const text of [item.endpointId + '\nCAS r' + item.revision + ' / credential r' + item.credentialRevision,
            publicText(item.config), 'managedBy=' + item.managedBy + '\nsuspended=' + item.suspended + '\ncreated=' + stamp(item.createdAt) + '\nupdated=' + stamp(item.updatedAt),
            'configured=true\nverification=not-read-on-get\n不是秘密可读、可投递或已验证']) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }
          const cell = document.createElement('td'), button = document.createElement('button'); button.type = 'button'; button.className = 'secondary';
          button.textContent = '仅载入 ID'; button.dataset.epoch = String(token); button.addEventListener('click', () => {
            if (token !== epoch || pending || sending || controller) return;
            invalidate(); wipeDraft(); el('id').value = item.endpointId; el('expected').value = ''; message('ID 已载入；请手动读取新 CAS，不自动读取或发布。'); controls();
          }); cell.append(button); row.append(cell); el('rows').append(row);
        }
        if (!data.items.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 5; cell.textContent = '无可见端点；不证明秘密未配置或外发已经停止。'; row.append(cell); el('rows').append(row); }
      } else {
        if (!envelope({ endpoint, audit: shape({ items: array(audit, 16), truncated: bool }), auditEvicted: uint }, scope)(data) ||
            data.endpoint.endpointId !== selectedId || data.audit.items.some(item => item.endpointId !== selectedId) ||
            new Set(data.audit.items.map(item => item.id)).size !== data.audit.items.length || await digest(data.endpoint.config) !== data.endpoint.configDigest) throw new Error();
        if (token !== epoch || scope !== getScope()) return;
        loaded = data.endpoint; el('id').value = selectedId; el('expected').value = String(loaded.revision);
        el('enabled').checked = loaded.config.enabled; el('policies').value = loaded.config.policyIds.join('\n'); el('interval').value = String(loaded.config.minimumIntervalSeconds);
        for (const kind of ['firing','invalidated','recovered']) el(kind).checked = loaded.config.kinds.includes(kind);
        el('record').textContent = publicText({ endpoint: data.endpoint, audit: data.audit });
      }
      metadata(data); controls(); message('仅脱敏元数据已载入；更新需重新输入完整目的 URL 和新签名密钥，接受的 PUT 总会轮换凭据修订。');
    } catch { if (token === epoch) { erase(); wipeSecrets(); message('读取失败、取消或无管理权限；旧资格已清除。未显示服务器自由文本。'); notify('通知端点读取未完成，请核对当前管理权限后手动重读。', true); } }
  }
  function freezePublish() {
    const endpointId = el('id').value.trim(), rawRevision = el('expected').value, rawInterval = el('interval').value;
    if (!id(getScope()) || !id(endpointId) || !/^(0|[1-9][0-9]*)$/.test(rawRevision) || !uint(Number(rawRevision))) return null;
    const expectedRevision = Number(rawRevision);
    if (expectedRevision === 0 ? loaded?.endpointId === endpointId : !loaded || loaded.endpointId !== endpointId || loaded.revision !== expectedRevision) return null;
    const policyIds = el('policies').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    const value = { schemaVersion: 1, enabled: el('enabled').checked, policyIds,
      kinds: ['firing','invalidated','recovered'].filter(kind => el(kind).checked), minimumIntervalSeconds: Number(rawInterval) };
    const url = destinationUrl(el('url').value), signingKey = el('signing-key').value;
    if (!/^[1-9][0-9]*$/.test(rawInterval) || !config(value) || url === null || signingKey.length !== 64 || !/^[a-f0-9]{64}$/.test(signingKey)) return null;
    const body = { expectedRevision, config: Object.freeze({ ...value, policyIds: Object.freeze(policyIds), kinds: Object.freeze(value.kinds) }), destination: Object.freeze({ url, signingKey }) };
    if (size(body) > limits.requestBytes) return null;
    return Object.freeze({ method: 'PUT', resource: 'notification-endpoints/' + encodeURIComponent(endpointId), body: Object.freeze(body), id: endpointId, key: randomUUID(), scope: getScope(), kind: 'publish' });
  }
  async function send(original, replay = false) {
    if (sending || pending !== original || original.scope !== getScope()) return;
    const token = epoch; sending = true; controls(); message('正在提交唯一原端点命令；不发送测试、不访问通知目的地址。');
    try {
      const data = await call(original.method, original.resource, original.body, original.key);
      if (token !== epoch || pending !== original || original.scope !== getScope()) return;
      if (!shape({ endpointId: one(original.id), revision: positive, changed: bool })(data) || data.revision !== original.body.expectedRevision + Number(data.changed) ||
          original.kind === 'publish' && data.changed !== true) throw new Error();
      pending = null; sending = false; invalidate(); wipeDraft(); el('receipt').textContent = publicText(data);
      message('端点命令明确返回，敏感待重放载荷已释放引用；请手动重读新 CAS。保存不代表可投递，停用不撤回任何已发生请求。'); controls();
    } catch (error) {
      if (token !== epoch) return;
      sending = false; wipeDraft();
      if (!replay && definiteInitialRejection(error)) pending = null;
      controls(); message(pending ? '结果不确定，仅原方法/URL路径/body/key 可明确重放；敏感输入已清空，唯一原载荷仅留本模块内存，其他读写锁定。当前重放拒绝不证明原提交不存在。' :
        '初次请求明确拒绝；敏感输入与原载荷引用已清除。没有换 CAS、自动重试或显示服务器自由文本，请手动重读。');
      notify('通知端点管理请求未明确完成；请根据面板的原命令状态处理。', true);
    }
  }
  function publish() {
    if (pending || sending || controller) return;
    if (!confirm('明确提交完整通知配置并轮换目的 URL/签名密钥？每次接受的 PUT 都增加凭据与端点修订，包括配置相同。端点命令本身不测试/发送；独立 worker 若已启用，后续事件可能外发。确认后输入立即清空，未知结果仅保留内存原载荷供相同重放。')) return;
    let original;
    try { original = freezePublish(); } catch { original = null; }
    wipeDraft();
    if (!original) { message('输入格式、已读取 CAS 或排序选择无效；秘密输入已清空，未发送请求。'); notify('请核对精确端点/CAS、升序政策 ID、固定事件类型、HTTPS 目的和 64 位小写十六进制密钥。', true); return; }
    invalidate(); pending = original; return send(original);
  }
  function disable() {
    if (pending || sending || controller || !loaded || !id(getScope()) || el('id').value.trim() !== loaded.endpointId || el('expected').value !== String(loaded.revision)) return;
    if (!confirm('仅按刚读取的精确 CAS 停用？不需要目的 URL、签名密钥或秘密存储，不撤销过去请求；已停用为 no-op。')) return;
    const original = Object.freeze({ method: 'POST', resource: 'notification-endpoints/' + encodeURIComponent(loaded.endpointId) + '/disable',
      body: Object.freeze({ expectedRevision: loaded.revision }), id: loaded.endpointId, key: randomUUID(), scope: getScope(), kind: 'disable' });
    wipeDraft(); invalidate(); pending = original; return send(original);
  }
  for (const name of ['id','expected']) for (const event of ['input','change']) el(name).addEventListener(event, () => {
    if (pending || sending) return; wipeSecrets(); invalidate(); message('端点 ID/CAS 已改变，旧读取资格与秘密草稿已清除；更新或停用须精确重读。');
  });
  for (const name of configInputs) for (const event of ['input','change']) el(name).addEventListener(event, () => {
    if (pending || sending) return;
    if (controller) { const baseline = loaded; invalidate(); loaded = baseline; }
    controls(); message('公开配置草稿已改变；保留的已读 CAS 仍须原 ID 完全匹配，接受发布会轮换新凭据。');
  });
  el('list').addEventListener('click', () => read(true)); el('read').addEventListener('click', () => read());
  el('publish').addEventListener('click', publish); el('disable').addEventListener('click', disable);
  el('cancel').addEventListener('click', () => { if (!pending && !sending) { wipeSecrets(); invalidate(); message('仅取消本地管理读取；不停止或回滚远程端点。'); } });
  el('replay').addEventListener('click', () => { if (pending && !sending && confirm('仅重放本模块内存中的原敏感载荷及原键？不换端点、CAS、URL或密钥，不测试目的地址。')) return send(pending, true); });
  el('clear').addEventListener('click', () => { if (!sending && (!pending || confirm('明确放弃内存原载荷？远程可能已接受；丢弃不是撤销，之后无法靠新键安全替代原重放。'))) clear(); });
  clear(); return { clear, leave: wipeSecrets };
}
