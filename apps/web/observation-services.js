const limits = { servicesPerScope: 32, revisionsPerService: 64, auditPerScope: 256, auditPage: 16,
  certificateBytes: 8192, configBytes: 16384, responseBytes: 131072, validityMs: 604800000 };
const uint = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => uint(value) && value > 0;
const time = value => uint(value) && value <= 253402300799999;
const bool = value => typeof value === 'boolean';
const id = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) && !/\s/.test(value);
const serviceId = value => typeof value === 'string' && value.length <= 64 && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) && !/\s/.test(value);
const hash = value => typeof value === 'string' && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const one = (...values) => value => values.includes(value);
const array = (check, maximum) => value => Array.isArray(value) && value.length <= maximum && value.every(check);
const shape = fields => value => record(value) && Object.keys(value).length === Object.keys(fields).length &&
  Object.entries(fields).every(([key, check]) => Object.hasOwn(value, key) && check(value[key]));
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : record(value) ?
  '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const equal = (a, b) => canonical(a) === canonical(b);
const clone = value => JSON.parse(JSON.stringify(value));
const size = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
async function bytesDigest(value) {
  const result = await crypto.subtle.digest('SHA-256', value);
  return 'sha256:' + Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
}
const digest = value => bytesDigest(new TextEncoder().encode(canonical(value)));
const revision = value => positive(value) && value <= limits.revisionsPerService;
const ipv4 = value => value.split('.').length === 4 && value.split('.').every(part => /^(0|[1-9][0-9]{0,2})$/.test(part) && Number(part) <= 255);
const serverName = value => typeof value === 'string' && value.length <= 253 && value.includes('.') && !ipv4(value) && !/\s/.test(value) &&
  value.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
// URL is used only to parse an IPv6 literal; no lookup, navigation or connection occurs.
function numericAddress(value) {
  if (typeof value !== 'string' || value.length > 45 || /[^a-fA-F0-9:.]/.test(value)) return false;
  if (!value.includes(':')) {
    const parts = value.split('.');
    return ipv4(value) &&
      Number(parts[0]) > 0 && Number(parts[0]) < 224 && !(Number(parts[0]) === 169 && Number(parts[1]) === 254) && value !== '100.100.100.200';
  }
  try { const parsed = new URL('http://[' + value + ']/'); return parsed.hostname.slice(1, -1) === value && value !== '::' &&
      !value.startsWith('::ffff:') && !value.startsWith('ff') && !/^fe[89ab]/.test(value) && value !== 'fd00:ec2::254'; }
  catch { return false; }
}
function certificate(value) {
  if (typeof value !== 'string' || value.length > 10924 || value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return null;
  try {
    const raw = atob(value);
    if (!raw.length || raw.length > limits.certificateBytes || btoa(raw) !== value) return null;
    return Uint8Array.from(raw, char => char.charCodeAt(0));
  } catch { return null; }
}
const configShape = shape({ version: one(1), purpose: one('direct-ingress-tls-handshake'),
  endpoint: shape({ address: numericAddress, port: value => positive(value) && value <= 65535 }),
  trust: shape({ mode: one('pinned-leaf-v1'), serverName, certificateDer: value => certificate(value) !== null }), validFrom: time, validUntil: time });
const publicKey = value => { const raw=certificate(value);return raw!==null&&raw.length===32; };
const echoConfigShape=shape({version:one(2),purpose:one('controlled-nonce-echo'),endpoint:shape({address:numericAddress,port:value=>positive(value)&&value<=65535,
  protocols:value=>equal(value,['tcp'])||equal(value,['udp'])||equal(value,['tcp','udp'])}),trust:shape({mode:one('ed25519-echo-v1'),publicKey}),validFrom:time,validUntil:time});
const config = value => (configShape(value)||echoConfigShape(value)) && value.validUntil > value.validFrom && value.validUntil - value.validFrom <= limits.validityMs && size(value) <= limits.configBytes;
const headShape = shape({ serviceId, revision: positive, configRevision: revision, archived: bool, recoverySuspended: bool });
const head = value => headShape(value) && value.revision >= value.configRevision;
const storedRevision = shape({ configRevision: revision, config, configDigest: hash, createdBy: id, createdAt: time });
const auditShape = shape({ id, serviceId, revision: positive, configRevision: revision, kind: one('publish','archive'), actorId: id, createdAt: time });
const audit = value => auditShape(value) && value.revision >= value.configRevision;
const tlsTrust = shape({ mode: one('pinned-leaf-v1'), fingerprint: hash, serverName,
  serviceIdentity: value => typeof value === 'string' && value.length <= 768,
  alpn: one('tunex-observation/1'), certificateNotBefore: time, certificateNotAfter: time, chainValidation: one('not-used-exact-leaf-pin') });
const trust=value=>tlsTrust(value)||shape({mode:one('ed25519-echo-v1'),algorithm:one('Ed25519'),fingerprint:hash,keyUsage:one('fixed-nonce-echo-only')})(value);
const envelope = (fields, scope) => shape({ observationServicesVersion: one(1), scopeId: one(scope), capturedAt: time,
  source: one('manager-declared-observation-services'), readOnly: one(true), executionAuthorized: one(false), health: one('unknown'),
  ownership: one('not-verified'), networkCheck: one('not-performed'), measurementAvailable: bool, echoAvailable:bool,
  consistency: one('read-committed-not-global-snapshot'), limits: value => equal(value, limits), ...fields });
const stamp = value => new Date(value).toISOString() + ' / Asia/Shanghai ' + new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const text = value => JSON.stringify(value, null, 2);
const definiteInitialRejection = error => [400,401,403,404,409,413,422,429].includes(error?.httpStatus);

export function initObservationServices({ request, notify, byId, getScope, document = globalThis.document, confirm = globalThis.confirm, randomUUID = () => crypto.randomUUID() }) {
  const el = name => byId('observation-service-' + name);
  let epoch = 0, controller = null, loaded = null, prepared = null, pending = null, sending = false;
  const fields = ['id','expected','read-revision','config'];
  const resource = selected => 'observation-services/' + encodeURIComponent(selected);
  const message = value => { el('state').textContent = value; };
  function controls() {
    const locked = Boolean(pending) || sending, busy = locked || Boolean(controller);
    for (const name of fields) el(name).disabled = locked;
    for (const name of ['list','read','prepare']) el(name).disabled = busy;
    el('publish').disabled = busy || !prepared;
    el('archive').disabled = busy || !loaded || loaded.scope !== getScope() || loaded.head.serviceId !== el('id').value.trim() || String(loaded.head.revision) !== el('expected').value;
    el('cancel').disabled = sending || Boolean(pending) || !controller;
    el('replay').disabled = sending || !pending;
    el('clear').disabled = sending;
    for (const button of el('rows').querySelectorAll('button')) button.disabled = busy;
  }
  function outputs() {
    for (const name of ['meta','record','prepared','receipt']) el(name).textContent = '';
    el('rows').replaceChildren();
  }
  function invalidate({ keepLoaded = false } = {}) {
    epoch++; if (controller) controller.abort(); controller = null;
    if (!keepLoaded) loaded = null;
    prepared = null; el('prepared').textContent = ''; controls();
  }
  function wipeDraft() { el('config').value = ''; el('config').defaultValue = ''; }
  function clear() {
    invalidate(); pending = null; sending = false; loaded = null; prepared = null;
    for (const name of fields) el(name).value = '';
    outputs(); message('尚未读取。仅 manager 声明注册表；不联网、不签发、不证明所有权。TLS 测量需原 Probe owner 的独立显式命令。'); controls();
  }
  async function call(method, path, body, key) {
    const active = new AbortController(); controller = active; controls(); const timer = setTimeout(() => active.abort(), 5000);
    try { return await request(method, path, body, key, { signal: active.signal, timeoutMs: 5000 }); }
    finally { clearTimeout(timer); if (controller === active) { controller = null; controls(); } }
  }
  function metadata(data) {
    el('meta').textContent = 'Scope ' + data.scopeId + '\n读取 ' + stamp(data.capturedAt) + '\n' + data.source + ' / ' + data.consistency +
      '\nhealth=unknown / ownership=not-verified / networkCheck=not-performed / measurementAvailable=' + data.measurementAvailable + ' / echoAvailable=' +data.echoAvailable +
      '\nmeasurementAvailable 仅为 Control TLS issuance 配置，不证明 Agent/网络活性。注册表仍不签发或测试；到 Probe 面板显式填写精确四字段引用。\n声明和公有证书 pin 不证明目的地址归属、证书正在提供、网络可达或测量健康。\nScope 审计累计淘汰 ' + data.auditEvicted + '；不是完整历史保证。';
  }
  async function read(list = false) {
    if (pending || sending || controller) return;
    const scope = getScope(), selected = el('id').value.trim(), rawRevision = el('read-revision').value;
    invalidate(); outputs(); wipeDraft(); const token = epoch;
    if (!id(scope) || !list && (!serviceId(selected) || rawRevision !== '' && (!/^[1-9][0-9]*$/.test(rawRevision) || !revision(Number(rawRevision))))) {
      message('需要当前 Scope、安全服务 ID，以及可选 1..64 精确配置修订；未请求。'); return;
    }
    message('手动读取 manager 声明元数据，最多五秒；不验证证书链、不访问服务地址。');
    try {
      const data = await call('GET', list ? 'observation-services' : resource(selected) + (rawRevision === '' ? '' : '?revision=' + rawRevision));
      if (token !== epoch || scope !== getScope()) return;
      if (size(data) > limits.responseBytes) throw Error();
      if (list) {
        if (!envelope({ items: array(head, limits.servicesPerScope), auditEvicted: uint }, scope)(data) ||
            new Set(data.items.map(item => item.serviceId)).size !== data.items.length) throw Error();
        for (const item of data.items) {
          const row = document.createElement('tr');
          for (const value of [item.serviceId, 'metadata CAS r' + item.revision + '\ncurrent config r' + item.configRevision,
            'archived=' + item.archived + '\nrecoverySuspended=' + item.recoverySuspended,
            'manager-declared only\nhealth=unknown\nownership=not-verified']) {
            const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
          }
          const cell = document.createElement('td'), button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = '仅载入 ID';
          button.addEventListener('click', () => {
            if (token !== epoch || pending || sending || controller || scope !== getScope()) return;
            invalidate(); outputs(); wipeDraft(); el('id').value = item.serviceId; el('expected').value = ''; el('read-revision').value = '';
            message('仅 ID 已载入；请手动读取当前 metadata CAS，不自动读取、发布或连接。'); controls();
          }); cell.append(button); row.append(cell); el('rows').append(row);
        }
        if (!data.items.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 5; cell.textContent = '无声明；不证明网络中没有服务。'; row.append(cell); el('rows').append(row); }
      } else {
        if (!envelope({ head, revision: storedRevision, trust, lifecycle: one('archived','recovery-suspended','not-yet-valid','expired','declared'),
          audit: shape({ items: array(audit, limits.auditPage), truncated: bool }), auditEvicted: uint }, scope)(data) || data.head.serviceId !== selected ||
          data.revision.configRevision > data.head.configRevision || rawRevision !== '' && data.revision.configRevision !== Number(rawRevision) ||
          rawRevision === '' && data.revision.configRevision !== data.head.configRevision || data.audit.items.some(item => item.serviceId !== selected) ||
          new Set(data.audit.items.map(item => item.id)).size !== data.audit.items.length ||
          data.lifecycle !== (data.head.archived ? 'archived' : data.head.recoverySuspended ? 'recovery-suspended' : data.capturedAt < data.revision.config.validFrom ? 'not-yet-valid' :
            data.capturedAt >= data.revision.config.validUntil ? 'expired' : 'declared') ||
          await digest(data.revision.config) !== data.revision.configDigest) throw Error();
        if(data.revision.config.version===1 ? !tlsTrust(data.trust)||data.trust.serverName!==data.revision.config.trust.serverName||
          data.trust.serviceIdentity!=='urn:tunex:observation-service:'+encodeURIComponent(scope)+':'+selected||data.trust.certificateNotAfter<=data.trust.certificateNotBefore||
          data.revision.config.validFrom<data.trust.certificateNotBefore||data.revision.config.validUntil>data.trust.certificateNotAfter||
          await bytesDigest(certificate(data.revision.config.trust.certificateDer))!==data.trust.fingerprint :
          data.trust.mode!=='ed25519-echo-v1'||await bytesDigest(certificate(data.revision.config.trust.publicKey))!==data.trust.fingerprint)throw Error();
        if (token !== epoch || scope !== getScope()) return;
        loaded = { scope, head: clone(data.head), selectedRevision: data.revision.configRevision };
        el('expected').value = String(data.head.revision); el('config').value = text(data.revision.config);
        el('record').textContent = text({ head: data.head, selectedConfigRevision: data.revision.configRevision, revision: data.revision,
          trust: data.trust, lifecycle: data.lifecycle, audit: data.audit });
      }
      metadata(data); controls(); message(list ? '仅声明列表已读取（最多 32 个含归档 head）；不自动读取任何详情。' :
        '仅声明详情已读取，configDigest 与公有证书/签名公钥指纹已核对；未进行证书链、签名或网络测量。metadata CAS 与所选 config revision 分开，不可互换。');
    } catch {
      if (token !== epoch || scope !== getScope()) return;
      invalidate(); outputs(); wipeDraft(); message('读取失败、取消、无管理权限或响应不符合闭合契约；旧详情和证书已清除。不显示服务器自由文本。');
      notify('观测服务声明读取未完成；请手动核对 Scope/权限后重读。', true);
    }
  }
  function snapshot() {
    const scope = getScope(), selected = el('id').value.trim(), raw = el('expected').value;
    if (!id(scope) || !serviceId(selected) || !/^(0|[1-9][0-9]*)$/.test(raw) || !uint(Number(raw))) return null;
    const expectedRevision = Number(raw);
    if (expectedRevision !== 0 && (!loaded || loaded.scope !== scope || loaded.head.serviceId !== selected || loaded.head.revision !== expectedRevision || loaded.head.archived)) return null;
    if (expectedRevision === 0 && loaded?.head.serviceId === selected) return null;
    const value = JSON.parse(el('config').value);
    if (!config(value) || size({ expectedRevision, config: value }) > limits.configBytes + 1024) return null;
    return { scope, id: selected, expectedRevision, config: clone(value), configText: el('config').value, readRevision: el('read-revision').value };
  }
  async function prepare() {
    if (pending || sending || controller) return;
    prepared = null; el('prepared').textContent = ''; const token = epoch;
    let value; try { value = snapshot(); } catch { value = null; }
    if (!value) { controls(); message('需要安全 ID、新建 CAS 0 或已读取当前非归档 head CAS，以及闭合公有配置。未发送请求；证书真实性由服务器解析，不在浏览器猜测。'); return; }
    try {
      const configDigest = await digest(value.config);
      if (token !== epoch || value.scope !== getScope() || value.configText !== el('config').value || value.readRevision !== el('read-revision').value || value.id !== el('id').value.trim() || String(value.expectedRevision) !== el('expected').value) return;
      prepared = { ...value, configDigest }; el('prepared').textContent = text({ serviceId: value.id, expectedMetadataRevision: value.expectedRevision,
        selectedReadConfigRevision: value.readRevision || 'current', configDigest, config: value.config,
        meaning: 'manager declaration only; ownership not verified; no network; public leaf pin, not private key' });
      message('本地配置摘要已准备；尚未发布、未导入/生成私钥或访问地址。任何输入、读取选择或 Scope 改变均使本准备失效。'); controls();
    } catch { prepared = null; controls(); message('本地摘要准备失败；没有发布。'); }
  }
  async function send(original, replay = false) {
    if (sending || pending !== original || original.scope !== getScope()) return;
    sending = true; const token = epoch; controls(); message('提交唯一原声明命令；不部署 responder、不验证地址、不签发 Probe。');
    try {
      const data = await call(original.method, original.resource, original.body, original.key);
      if (token !== epoch || pending !== original || original.scope !== getScope()) return;
      if (!shape({ serviceId: one(original.id), revision: positive, configRevision: revision, configDigest: hash, archived: bool, recoverySuspended: bool, changed: bool })(data) ||
          data.revision < data.configRevision || data.revision !== original.body.expectedRevision + Number(data.changed) || original.method === 'PUT' && (data.archived || data.recoverySuspended || data.configDigest !== original.configDigest) ||
          original.method === 'DELETE' && !data.archived) throw Error();
      pending = null; sending = false; invalidate(); outputs(); wipeDraft(); el('receipt').textContent = text(data);
      message('声明命令明确返回；请手动重读当前 metadata CAS。保存不是 ownership/证书提供/网络健康证明，归档不是撤销已发生的网络行为。'); controls();
    } catch (error) {
      if (token !== epoch || original.scope !== getScope()) return;
      sending = false; wipeDraft(); loaded = null; prepared = null; el('record').textContent = ''; el('prepared').textContent = '';
      if (!replay && definiteInitialRejection(error)) pending = null;
      message(pending ? '提交结果不确定。仅保留模块内存中的原方法/路径/body/key，其他读写锁定；必须显式原样重放，不换 CAS 或新键。重放拒绝不能证明最初未提交。' :
        '初次命令明确拒绝，原载荷已释放；请手动重读。没有自动重试、换键或将查询当原回执。'); controls();
      notify('观测服务声明写入未明确完成，请按面板原命令状态处理。', true);
    }
  }
  function publish() {
    if (pending || sending || controller || !prepared) return;
    let current; try { current = snapshot(); } catch { current = null; }
    if (!current || current.scope !== prepared.scope || current.id !== prepared.id || current.expectedRevision !== prepared.expectedRevision ||
        current.configText !== prepared.configText || current.readRevision !== prepared.readRevision || !equal(current.config, prepared.config)) {
      prepared = null; el('prepared').textContent = ''; controls(); message('准备已过期；重新准备后才能确认发布。'); return;
    }
    if (!confirm('仅发布这份 manager 声明与公有叶证书 pin？服务器验证封闭证书用途/身份与有效期，但不会联系地址或证明 ownership。不会部署服务、导入私钥、签发 Probe 或测健康。未知提交仅保留原内存载荷供显式重放。')) return;
    const immutableConfig = Object.freeze({ ...current.config, endpoint: Object.freeze({ ...current.config.endpoint }), trust: Object.freeze({ ...current.config.trust }) });
    const original = Object.freeze({ method: 'PUT', resource: resource(current.id), body: Object.freeze({ expectedRevision: current.expectedRevision, config: immutableConfig }),
      scope: current.scope, id: current.id, configDigest: prepared.configDigest, key: randomUUID() });
    invalidate(); outputs(); wipeDraft(); pending = original; return send(original);
  }
  function archive() {
    if (pending || sending || controller || !loaded || loaded.scope !== getScope() || loaded.head.serviceId !== el('id').value.trim() || String(loaded.head.revision) !== el('expected').value) return;
    if (!confirm('仅按当前 metadata CAS 归档此 ID？保留历史，归档 ID 不可重新发布/复用，不联系 endpoint、不撤销已经发生的动作。')) return;
    const original = Object.freeze({ method: 'DELETE', resource: resource(loaded.head.serviceId), body: Object.freeze({ expectedRevision: loaded.head.revision }),
      scope: loaded.scope, id: loaded.head.serviceId, key: randomUUID() });
    invalidate(); outputs(); wipeDraft(); pending = original; return send(original);
  }
  for (const name of fields) for (const event of ['input','change']) el(name).addEventListener(event, () => {
    if (pending || sending) return;
    const preserve = name === 'config'; invalidate({ keepLoaded: preserve });
    if (!preserve) { el('record').textContent = ''; wipeDraft(); }
    message('输入或读取选择已改变，旧准备已失效；不会自动读取/发布。变更 ID/CAS/修订选择后须重读当前 head，或以 CAS 0 明确新建。'); controls();
  });
  el('list').addEventListener('click', () => read(true)); el('read').addEventListener('click', () => read());
  el('prepare').addEventListener('click', prepare); el('publish').addEventListener('click', publish); el('archive').addEventListener('click', archive);
  el('cancel').addEventListener('click', () => { if (!sending && !pending) { invalidate(); outputs(); wipeDraft(); message('仅取消本地读取并清除详情；不撤销远程声明。'); } });
  el('replay').addEventListener('click', () => { if (pending && !sending && confirm('仅重放模块内存中相同方法/路径/body/key？不改变 Scope/CAS/配置，不生成新命令。')) return send(pending, true); });
  el('clear').addEventListener('click', () => { if (!sending && (!pending || confirm('明确放弃内存原命令？远程可能已提交，清除不等于撤销，之后不能靠新键安全替代原重放。'))) clear(); });
  clear(); return { clear };
}
