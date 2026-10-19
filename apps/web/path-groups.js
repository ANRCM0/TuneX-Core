const id = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) && !/\s/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => integer(value) && value > 0;
const revision = value => positive(value) && value <= 64;
const hash = value => typeof value === 'string' && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value);
const object = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const clone = value => JSON.parse(JSON.stringify(value));
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ?
  '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const equal = (a, b) => canonical(a) === canonical(b);
const selectionValid = value => object(value, ['templateId','revision','configDigest']) && id(value.templateId) && revision(value.revision) && hash(value.configDigest);
const reject = error => [400,401,403,404,409,413,422,429].includes(error.httpStatus);
async function digest(value) {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return 'sha256:' + Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
function configView(value) {
  if (!object(value, ['schemaVersion','kind','candidates']) || value.schemaVersion !== 1 || !['egress-candidates','backup-paths'].includes(value.kind) ||
      !Array.isArray(value.candidates) || !value.candidates.length || value.candidates.length > 8 ||
      value.candidates.some(candidate => !object(candidate, ['candidateId','template']) || !id(candidate.candidateId) || !selectionValid(candidate.template)) ||
      new Set(value.candidates.map(candidate => candidate.candidateId)).size !== value.candidates.length ||
      new Set(value.candidates.map(candidate => candidate.template.configDigest)).size !== value.candidates.length)
    throw Error('组配置无效：需要一至八个有序候选，候选 ID 与完整路径摘要均不得重复。');
  return clone(value);
}
function templateConfig(value) {
  if (!object(value, ['version','nodes','protocols','endpoints','transport']) || value.version !== 1 || !Array.isArray(value.nodes) ||
      value.nodes.length < 2 || value.nodes.length > 8 || value.nodes.some(node => !id(node)) || new Set(value.nodes).size !== value.nodes.length ||
      !Array.isArray(value.protocols) || !value.protocols.length || value.protocols.length > 2 || value.protocols.some(protocol => !['tcp','udp'].includes(protocol)) ||
      new Set(value.protocols).size !== value.protocols.length || !Array.isArray(value.endpoints) || value.endpoints.length !== value.nodes.length - 1 ||
      value.endpoints.some((endpoint, index) => !object(endpoint, ['nodeId','revision']) || endpoint.nodeId !== value.nodes[index + 1] || !positive(endpoint.revision)) ||
      !object(value.transport, ['profileId','configRevision']) || !id(value.transport.profileId) || !positive(value.transport.configRevision))
    throw Error('精确路径配置无效。');
  return clone(value);
}

export function initPathGroups({ request, byId, notify, document = globalThis.document, confirm = globalThis.confirm, randomUUID = () => crypto.randomUUID() }) {
  const el = name => byId('path-group-' + name), fields = ['id','expected','read-revision','kind','candidates','candidate','forward','forward-expected','reference-revision'];
  let epoch = 0, page = 1, total = 0, inspected = null, proposal = null, pending = null, sending = false;
  let referencePage = 1, referenceTotal = 0, referencesReady = false;
  const controllers = new Set();
  const resource = groupId => 'path-groups/' + encodeURIComponent(groupId);
  const state = text => { el('state').textContent = text; };
  function controls() {
    for (const name of fields) el(name).disabled = Boolean(pending) || sending;
    el('prefix').disabled = Boolean(pending) || sending;
    el('close').disabled = sending;
    for (const name of ['inspect','prepare','query','publish','archive','references','binding']) el(name).disabled = sending || Boolean(pending) && !['publish','archive'].includes(name);
    el('publish').disabled = sending || Boolean(pending) && !(pending.kind === 'metadata' && pending.method === 'PUT');
    el('archive').disabled = sending || Boolean(pending) && !(pending.kind === 'metadata' && pending.method === 'DELETE');
    el('publish').textContent = pending?.kind === 'metadata' && pending.method === 'PUT' ? '仅重放原发布命令' : '发布不可变组修订';
    el('archive').textContent = pending?.kind === 'metadata' && pending.method === 'DELETE' ? '仅重放原归档命令' : '归档组';
    el('apply').disabled = sending || !(pending?.kind === 'apply' || !pending && proposal);
    el('apply').textContent = pending?.kind === 'apply' ? '仅重放原切换命令' : '确认应用本次候选路径';
    el('discard').disabled = sending || !pending;
    el('cancel-read').disabled = sending || controllers.size === 0;
    el('prev').disabled = sending || Boolean(pending) || page <= 1;
    el('next').disabled = sending || Boolean(pending) || page >= Math.min(10000, Math.max(1, Math.ceil(total / 25)));
    el('references-prev').disabled = sending || Boolean(pending) || !referencesReady || referencePage <= 1;
    el('references-next').disabled = sending || Boolean(pending) || !referencesReady || referencePage >= Math.min(10000, Math.max(1, Math.ceil(referenceTotal / 25)));
    for (const button of el('rows').querySelectorAll('button')) button.disabled = sending || Boolean(pending) || button.dataset.epoch !== String(epoch);
    for (const button of el('reference-rows').querySelectorAll('button')) button.disabled = sending || Boolean(pending) || button.dataset.epoch !== String(epoch) || button.dataset.unavailable === 'true';
  }
  async function call(method, path, body, key) {
    const controller = new AbortController(); controllers.add(controller); controls();
    const timer = setTimeout(() => controller.abort(), 5000);
    try { return await request(method, path, body, key, { signal: controller.signal, timeoutMs: 5000 }); }
    finally { clearTimeout(timer); controllers.delete(controller); controls(); }
  }
  function invalidate(dropInspection = false) {
    epoch++; for (const controller of controllers) controller.abort(); controllers.clear();
    proposal = null; el('proposal').textContent = ''; el('record').textContent = '';
    referencesReady = false; referencePage = 1; referenceTotal = 0;
    el('reference-rows').replaceChildren(); el('references-meta').textContent = ''; el('binding-record').textContent = '';
    if (dropInspection) { inspected = null; el('topology').replaceChildren(); el('candidate').replaceChildren(); const option = document.createElement('option'); option.value = ''; option.textContent = '先读取精确组修订，再明确选择'; el('candidate').append(option); }
    controls();
  }
  function draft() {
    const lines = el('candidates').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const candidates = lines.map(line => {
      const values = line.split(/\s+/);
      if (values.length !== 4 || !/^[1-9][0-9]*$/.test(values[2])) throw Error('每行格式：候选ID TemplateID 精确修订 sha256:摘要。');
      return { candidateId: values[0], template: { templateId: values[1], revision: Number(values[2]), configDigest: values[3] } };
    });
    return configView({ schemaVersion: 1, kind: el('kind').value, candidates });
  }
  function groupSelection() {
    const candidateId = el('candidate').value;
    if (!inspected || inspected.archived || !inspected.config.candidates.some(candidate => candidate.candidateId === candidateId))
      throw Error('请先读取未归档的精确组修订，并明确选择一个候选；不会自动选择第一优先级。');
    return { groupId: inspected.groupId, revision: inspected.revision, configDigest: inspected.configDigest, candidateId };
  }
  const readFlags = data => data.source === 'persisted-control-state' && data.reserved === false && data.executionAuthorized === false &&
    data.fullPlanAuthorization === false && data.health === 'unknown' && data.automaticSelection === false && data.referenceAuthorization === 'not-rechecked-by-this-query';
  const bindingValid = (binding, forwardRevision) => binding && id(binding.groupId) && revision(binding.revision) && hash(binding.configDigest) && id(binding.candidateId) &&
    revision(binding.sequence) && revision(binding.pathBindingSequence) && positive(binding.forwardRevision) && binding.forwardRevision <= forwardRevision;
  function specValid(spec) {
    return object(spec, ['enabled','protocols','ingress','target','path','transport']) && typeof spec.enabled === 'boolean' && Array.isArray(spec.protocols) &&
      spec.protocols.length > 0 && spec.protocols.length <= 2 && spec.protocols.every(protocol => ['tcp','udp'].includes(protocol)) && new Set(spec.protocols).size === spec.protocols.length &&
      object(spec.ingress, ['nodeId','listen']) && id(spec.ingress.nodeId) && object(spec.ingress.listen, ['address','port']) && typeof spec.ingress.listen.address === 'string' &&
      positive(spec.ingress.listen.port) && spec.ingress.listen.port <= 65535 && object(spec.target, ['host','port']) && typeof spec.target.host === 'string' &&
      positive(spec.target.port) && spec.target.port <= 65535 && object(spec.path, ['via']) && Array.isArray(spec.path.via) && spec.path.via.length > 0 && spec.path.via.length <= 7 &&
      spec.path.via.every(id) && new Set([spec.ingress.nodeId,...spec.path.via]).size === spec.path.via.length + 1 &&
      object(spec.transport, ['profileId','configRevision']) && id(spec.transport.profileId) && positive(spec.transport.configRevision);
  }
  async function references(requestedPage = 1) {
    if (pending || sending) return;
    invalidate(); const token = epoch; referencePage = requestedPage;
    try {
      if (!inspected) throw Error('请先读取精确组修订，再手动查询该组当前引用。');
      const groupId = inspected.groupId, source = el('reference-revision').value;
      if (source !== '' && (!/^[1-9][0-9]*$/.test(source) || !revision(Number(source)))) throw Error('引用来源修订必须是一至六十四，或留空查询全部来源修订。');
      const filter = source === '' ? null : Number(source);
      const data = await call('GET', resource(groupId) + '/references?page=' + requestedPage + '&limit=25' + (filter === null ? '' : '&revision=' + filter));
      if (token !== epoch) return;
      if (!readFlags(data) || data.groupId !== groupId || !revision(data.currentRevision) || data.currentRevision < inspected.revision || typeof data.archived !== 'boolean' ||
          data.page !== requestedPage || data.limit !== 25 || data.referenceRevision !== filter || !integer(data.total) || data.consistency !== 'read-committed-page-not-global-snapshot' ||
          !Array.isArray(data.items) || data.items.length > 25 || new Set(data.items.map(item => item.forwardId)).size !== data.items.length ||
          data.items.some(item => !object(item, ['forwardId','expectedRevision','binding','spec','recoverySuspended']) || !id(item.forwardId) || !positive(item.expectedRevision) ||
            typeof item.recoverySuspended !== 'boolean' || !object(item.binding, ['groupId','revision','configDigest','candidateId','sequence','pathBindingSequence','forwardRevision']) ||
            !bindingValid(item.binding, item.expectedRevision) || item.binding.groupId !== groupId || item.binding.revision > data.currentRevision || filter !== null && item.binding.revision !== filter || !specValid(item.spec)))
        throw Error('有界组引用响应、来源修订或只读标记无效。');
      referenceTotal = data.total; referencesReady = true;
      for (const item of data.items) {
        const row = document.createElement('tr');
        for (const text of [item.forwardId + ' / CAS r' + item.expectedRevision,
          item.binding.groupId + ' r' + item.binding.revision + '\n' + item.binding.configDigest + '\ncandidate=' + item.binding.candidateId,
          'group sequence=' + item.binding.sequence + '\npathBindingSequence=' + item.binding.pathBindingSequence + '\nforwardRevision=' + item.binding.forwardRevision,
          'enabled=' + item.spec.enabled + '\nrecoverySuspended=' + item.recoverySuspended + '\n健康 unknown']) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }
        const cell = document.createElement('td'), button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = '仅载入此 Forward / CAS';
        button.dataset.epoch = String(token); button.dataset.unavailable = String(item.recoverySuspended || data.archived || inspected.archived);
        button.addEventListener('click', () => {
          if (token !== epoch || pending || sending || button.disabled) return;
          invalidate(); el('forward').value = item.forwardId; el('forward-expected').value = String(item.expectedRevision);
          state('已载入 Forward / CAS，保留已明确选择的候选；尚未预览或提交。请手动准备本次提案。');
        }); cell.append(button); row.append(cell); el('reference-rows').append(row);
      }
      if (!data.items.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 5; cell.textContent = '没有可见当前引用，不证明可删除组、节点或路径。'; row.append(cell); el('reference-rows').append(row); }
      el('references-meta').textContent = '组 ' + groupId + ' / 第 ' + requestedPage + ' 页 / 共 ' + data.total + ' 条 / 来源修订 ' + (filter ?? '全部') +
        ' / archived=' + data.archived + '。仅当前期望引用，包含停用与恢复挂起规则，不含删除中规则；不是全库快照、删除证明或当前授权复核。'; controls();
    } catch (error) { if (token === epoch) { invalidate(); el('references-meta').textContent = '组引用不可用，旧结果与载入操作已清除。'; notify(error.message, true); } }
  }
  async function binding() {
    if (pending || sending) return;
    invalidate(); const token = epoch;
    try {
      const forwardId = el('forward').value.trim();
      if (!id(forwardId)) throw Error('需要现有 Forward ID 才能读取组绑定历史。');
      const data = await call('GET', 'forwards/' + encodeURIComponent(forwardId) + '/path-group-binding');
      if (token !== epoch) return;
      if (!readFlags(data) || data.forwardId !== forwardId || !positive(data.revision) || typeof data.deleting !== 'boolean' || typeof data.recoverySuspended !== 'boolean' ||
          data.consistency !== 'read-committed-not-global-snapshot' || !Array.isArray(data.history) || data.history.length > 64 ||
          data.history.some((item, index) => !object(item, ['groupId','revision','configDigest','candidateId','sequence','pathBindingSequence','forwardRevision','expandedSpec','specDigest','actorId','createdAt','current']) ||
            !bindingValid(item, data.revision) || item.sequence !== index + 1 || typeof item.current !== 'boolean' || !specValid(item.expandedSpec) || !hash(item.specDigest) || !id(item.actorId) ||
            typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) || new Date(item.createdAt).toISOString() !== item.createdAt) ||
          data.history.filter(item => item.current).length !== (data.binding === null ? 0 : 1) ||
          (data.binding !== null && !data.history.some(item => item.current && equal(item, data.binding)))) throw Error('当前组绑定或有界历史响应无效。');
      for (const item of data.history) if (await digest(item.expandedSpec) !== item.specDigest) throw Error('历史展开配置摘要不匹配。');
      if (token !== epoch) return;
      el('binding-record').textContent = 'Forward ' + forwardId + ' / 当前 CAS r' + data.revision + '\ndeleting=' + data.deleting + ' / recoverySuspended=' + data.recoverySuspended +
        '\nsource=persisted-control-state / health=unknown / executionAuthorized=false\n只读来源历史，不重新核对当前 Node/Profile Grant，也不代表部署成功；不自动载入 CAS 或准备切换。\n' + JSON.stringify(data, null, 2);
      state('当前绑定与最多六十四条不可变历史已读取；精确组/候选、原路径序号、展开配置、摘要和 actor/时间仅作来源观察。');
    } catch (error) { if (token === epoch) { invalidate(); el('binding-record').textContent = '组绑定历史不可用，旧结果已清除。'; notify(error.message, true); } }
  }
  async function list() {
    if (pending || sending) return;
    invalidate(); const token = epoch, requested = page;
    el('rows').replaceChildren(); el('page').textContent = '';
    try {
      const prefix = el('prefix').value.trim();
      if (prefix !== '' && !id(prefix)) throw Error('组 ID 前缀无效。');
      const data = await call('GET', 'path-groups?page=' + requested + '&limit=25' + (prefix ? '&prefix=' + encodeURIComponent(prefix) : ''));
      if (token !== epoch) return;
      if (data.page !== requested || data.limit !== 25 || !integer(data.total) || data.total > 64 || data.source !== 'persisted-control-state' || data.executionAuthorized !== false ||
          data.reserved !== false || data.fullPlanAuthorization !== false || data.health !== 'unknown' || data.automaticSelection !== false ||
          !Array.isArray(data.items) || data.items.length > 25 || new Set(data.items.map(item => item.groupId)).size !== data.items.length ||
          data.items.some(item => !id(item.groupId) || !revision(item.currentRevision) || typeof item.archived !== 'boolean')) throw Error('有界组列表响应无效。');
      total = data.total;
      for (const item of data.items) {
        const row = document.createElement('tr');
        for (const text of [item.groupId, 'r' + item.currentRevision, item.archived ? '已归档，保留历史' : '元数据已发布；健康 unknown']) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }
        const cell = document.createElement('td'), button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = '读取当前修订'; button.dataset.epoch = String(token);
        button.addEventListener('click', () => { if (token === epoch && !pending && !sending) return inspect(item.groupId, ''); }); cell.append(button); row.append(cell); el('rows').append(row);
      }
      if (!data.items.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 4; cell.textContent = '没有匹配的组元数据，不代表没有路径或健康。'; row.append(cell); el('rows').append(row); }
      el('page').textContent = '第 ' + requested + ' 页，共 ' + total + ' 组（含归档）；不是全库快照。'; controls();
    } catch (error) { if (token === epoch) { total = 0; el('page').textContent = '组列表不可用，旧列表已清除。'; controls(); notify(error.message, true); } }
  }
  async function inspect(groupId = el('id').value.trim(), requested = el('read-revision').value) {
    if (pending || sending) return;
    invalidate(true); const token = epoch;
    try {
      if (!id(groupId) || requested !== '' && !/^[1-9][0-9]*$/.test(requested) || requested !== '' && !revision(Number(requested))) throw Error('需要有效组 ID 与一至六十四的精确修订；留空读取当前修订。');
      const data = await call('GET', resource(groupId) + (requested ? '?revision=' + requested : ''));
      if (token !== epoch) return;
      const config = configView(data.config), topology = data.topology;
      if (data.groupId !== groupId || !revision(data.currentRevision) || !revision(data.revision) || data.revision > data.currentRevision ||
          data.revision !== (requested ? Number(requested) : data.currentRevision) || typeof data.archived !== 'boolean' || !hash(data.configDigest) ||
          data.source !== 'persisted-control-state' || data.reserved !== false || data.executionAuthorized !== false || data.fullPlanAuthorization !== false ||
          data.automaticSelection !== false || data.bindingCreated !== false || data.referenceAuthorization !== 'not-rechecked-by-this-query' ||
          !id(data.createdBy) || typeof data.createdAt !== 'string' || !Number.isFinite(Date.parse(data.createdAt)) || new Date(data.createdAt).toISOString() !== data.createdAt ||
          topology?.operator !== 'OR' || topology.health !== 'unknown' || !Array.isArray(topology.branches) || topology.branches.length !== config.candidates.length ||
          topology.branches.some((branch, index) => branch.candidateId !== config.candidates[index].candidateId || branch.priority !== index + 1 ||
            !equal(branch.template, config.candidates[index].template) || branch.operator !== 'AND' || branch.health !== 'unknown' ||
            !Array.isArray(branch.nodes) || branch.nodes.length < 2 || branch.nodes.length > 8 || branch.nodes.some(node => !id(node)) || new Set(branch.nodes).size !== branch.nodes.length))
        throw Error('精确组修订、固定优先级或 AND/OR 拓扑响应无效。');
      if (await digest(config) !== data.configDigest) throw Error('组配置摘要不匹配。');
      if (token !== epoch) return;
      inspected = clone({ ...data, config }); el('id').value = groupId; el('expected').value = String(data.currentRevision); el('read-revision').value = String(data.revision); el('kind').value = config.kind;
      el('candidates').value = config.candidates.map(candidate => [candidate.candidateId,candidate.template.templateId,candidate.template.revision,candidate.template.configDigest].join(' ')).join('\n');
      el('candidate').replaceChildren(); const empty = document.createElement('option'); empty.value = ''; empty.textContent = '明确选择一个候选（不自动选路）'; el('candidate').append(empty);
      for (const branch of topology.branches) {
        const option = document.createElement('option'); option.value = branch.candidateId; option.textContent = '优先级 ' + branch.priority + ' / ' + branch.candidateId; option.disabled = data.archived; el('candidate').append(option);
        const item = document.createElement('li'); item.textContent = 'OR 可选分支 · 固定优先级 ' + branch.priority + ' · ' + branch.candidateId + ' · AND 必经顺序: ' + branch.nodes.join(' → ') +
          ' · Template ' + branch.template.templateId + ' r' + branch.template.revision + ' · health=unknown'; el('topology').append(item);
      }
      el('record').textContent = JSON.stringify(data, null, 2); controls();
      state('读取组 r' + data.revision + ' / 当前 r' + data.currentRevision + (data.archived ? '，已归档。' : '。') + '只读历史元数据；当前 Node/Profile 授权未重新核对，未预留资源或切换。');
    } catch (error) { if (token === epoch) { invalidate(true); state('组读取失败，旧选择已清除。'); notify(error.message, true); } }
  }
  async function metadata(method) {
    if (sending || pending && !(pending.kind === 'metadata' && pending.method === method)) return;
    const replay = Boolean(pending); let token = epoch;
    try {
      if (!replay) {
        const groupId = el('id').value.trim(), expected = el('expected').value;
        if (!id(groupId) || !/^(0|[1-9][0-9]*)$/.test(expected) || Number(expected) > 64 || method === 'DELETE' && Number(expected) < 1) throw Error('需要组 ID 和显式当前 CAS；新建发布使用 0。');
        const body = { expectedRevision: Number(expected), ...(method === 'PUT' ? { config: draft() } : {}) };
        if (!confirm(method === 'PUT' ? '仅发布不可变组元数据？不会绑定 Forward、切换、预留资源或自动跟随最新路径。' : '永久归档此组标识？历史保留；不停止或改变已展开的规则。')) return;
        invalidate(true); token = epoch;
        pending = { kind: 'metadata', method, resource: resource(groupId), body: clone(body), groupId, key: randomUUID() };
      } else if (!confirm('仅重放原键、原 body 的元数据命令？当前拒绝不能证明原命令未提交。')) return;
      sending = true; controls(); state('正在发送原组元数据命令……');
      const original = pending, data = await call(original.method, original.resource, clone(original.body), original.key);
      if (token !== epoch || pending !== original) return;
      if (data.groupId !== original.groupId || !revision(data.revision) || !hash(data.configDigest) || data.archived !== (original.method === 'DELETE') || typeof data.changed !== 'boolean' ||
          data.revision !== original.body.expectedRevision + (original.method === 'PUT' && data.changed ? 1 : 0) ||
          original.method === 'PUT' && await digest(original.body.config) !== data.configDigest) throw Error('组元数据回执无效，原结果仍不确定。');
      if (token !== epoch || pending !== original) return;
      pending = null; sending = false; el('expected').value = String(data.revision); el('record').textContent = JSON.stringify(data, null, 2); controls();
      state('组元数据已' + (data.archived ? '归档' : '发布') + '，r' + data.revision + '。未创建部署、切换或执行授权；请手动重读。');
    } catch (error) {
      if (token === epoch) { sending = false; if (pending && !replay && reject(error)) pending = null; state(pending ? '结果不确定：原命令可能已提交，仅可显式原键/原 body 重放。' : '未获得已接受结果；请显式检查后重新准备。'); controls(); notify(error.message, true); }
    }
  }
  async function prepare() {
    if (pending || sending) return;
    invalidate(); const token = epoch;
    try {
      const group = groupSelection(), candidate = inspected.config.candidates.find(item => item.candidateId === group.candidateId), template = clone(candidate.template);
      const forwardId = el('forward').value.trim(), expected = el('forward-expected').value;
      if (!id(forwardId) || !/^[1-9][0-9]*$/.test(expected) || !positive(Number(expected))) throw Error('需要现有 Forward ID 和显式当前 Forward CAS。');
      state('手动读取所选精确 Template，再请求非预留组提案；不会发送切换命令。');
      const record = await call('GET', 'path-templates/' + encodeURIComponent(template.templateId) + '?revision=' + template.revision);
      if (token !== epoch) return;
      const config = templateConfig(record.config), branch = inspected.topology.branches.find(item => item.candidateId === group.candidateId);
      if (record.templateId !== template.templateId || record.revision !== template.revision || !revision(record.currentRevision) || record.currentRevision < template.revision ||
          record.configDigest !== template.configDigest || !hash(record.profileDigest) || record.archived !== false || record.reserved !== false || record.executionAuthorized !== false ||
          record.source !== 'persisted-control-state' || record.referenceAuthorization !== 'not-rechecked-by-this-query' || record.bindingCreated !== false ||
          !equal(config.nodes, branch.nodes) || await digest({ config, profileDigest: record.profileDigest }) !== template.configDigest) throw Error('所选精确 Template 配置、Profile 摘要或分支不匹配。');
      if (token !== epoch) return;
      const body = { expectedRevision: Number(expected), group }, data = await call('POST', 'forwards/' + encodeURIComponent(forwardId) + '/path-group-preview', body);
      if (token !== epoch) return;
      const spec = data.spec, proposedSpec = { ...clone(spec), path: { via: [...config.nodes.slice(1)] }, transport: clone(config.transport) };
      if (data.forwardId !== forwardId || data.expectedRevision !== body.expectedRevision || !equal(data.group, group) || data.priority !== branch.priority ||
          data.automaticSelection !== false || data.health !== 'unknown' || !equal(data.template, template) || data.source !== 'persisted-control-state' ||
          data.reserved !== false || data.executionAuthorized !== false || data.fullPlanAuthorization !== false || data.previewOnly !== true ||
          spec?.ingress?.nodeId !== config.nodes[0] || !equal([...(spec.protocols ?? [])].sort(), [...config.protocols].sort()) ||
          !positive(spec.ingress.listen?.port) || spec.ingress.listen.port > 65535 || typeof spec.ingress.listen.address !== 'string' ||
          typeof spec.target?.host !== 'string' || !positive(spec.target.port) || spec.target.port > 65535 || typeof spec.enabled !== 'boolean' ||
          !equal(data.proposedSpec, proposedSpec) || data.changed !== !equal(spec, proposedSpec) ||
          data.interruption !== 'possible-same-listener-replacement' || data.tcp !== 'bounded-drain-or-authorization-deadline' || data.udp !== 'associations-may-reset-and-lose-datagrams')
        throw Error('组提案与固定候选、CAS、原配置或中断边界不匹配。');
      proposal = clone({ forwardId, body, template, config, profileDigest: record.profileDigest, proposedSpec, changed: data.changed });
      el('proposal').textContent = JSON.stringify(data, null, 2); controls();
      state('提案已准备，未预留或授权执行。确认后先做原 Relay 计划，再独立提交原 Forward CAS；可能中断，TCP 有界排空，UDP 关联/数据报可能丢失。');
    } catch (error) { if (token === epoch) { proposal = null; el('proposal').textContent = ''; controls(); state('预览失败，未发送切换意图；请手动重新准备。'); notify(error.message, true); } }
  }
  function accepted(original, data) {
    const expected = original.body.expectedRevision + (original.changed ? 1 : 0), path = data.pathBinding, group = data.pathGroupBinding, selected = original.body.group;
    if (data.forwardId !== original.forwardId || data.revision !== expected || (original.changed ? !id(data.operationId) : data.operationId !== null) ||
        !path || !equal({ templateId: path.templateId, revision: path.revision, configDigest: path.configDigest }, original.template) ||
        !revision(path.sequence) || !positive(path.forwardRevision) || path.forwardRevision > expected || typeof path.changed !== 'boolean' ||
        !group || !equal({ groupId: group.groupId, revision: group.revision, configDigest: group.configDigest, candidateId: group.candidateId }, selected) ||
        !revision(group.sequence) || group.pathBindingSequence !== path.sequence || !positive(group.forwardRevision) || group.forwardRevision > expected || typeof group.changed !== 'boolean')
      throw Error('组切换回执无效，原命令可能已提交；仅能重放原命令。');
    return data;
  }
  async function apply() {
    if (sending || pending && pending.kind !== 'apply' || !pending && !proposal) return;
    const replay = Boolean(pending), token = epoch;
    try {
      if (!confirm(replay ? '仅重放原组切换键/body，不重新预览、不换 CAS 或候选？当前拒绝不能证明原提交不存在。' : '确认只切换这一条 Forward 到所选固定候选？同监听可能中断，TCP 排空受授权期限限制，UDP 可能丢包；不自动回滚。')) return;
      if (!pending) pending = { kind: 'apply', ...clone(proposal), key: randomUUID(), sent: false };
      const original = pending; sending = true; controls();
      if (!replay) {
        state('正在重新检查原 Relay 计划；尚未发送组切换命令。');
        const plan = await call('POST', 'relay-plan', clone(original.proposedSpec));
        if (token !== epoch || pending !== original) return;
        if (plan.reserved !== false || plan.executionSupported !== false || plan.runtimeEnabled !== true ||
            plan.profile?.profileId !== original.config.transport.profileId || plan.profile.revision !== original.config.transport.configRevision || plan.profile.configDigest !== original.profileDigest)
          throw Error('原 Relay 计划与锁定 Profile 或运行开关不匹配；没有发送切换命令。');
      }
      original.sent = true; state('正在提交原 Forward/组绑定命令；结果不确定时不会更换请求。');
      const data = await call('PUT', 'forwards/' + encodeURIComponent(original.forwardId) + '/path-group-binding', clone(original.body), original.key);
      if (token !== epoch || pending !== original) return;
      accepted(original, data); pending = null; proposal = null; sending = false; el('forward-expected').value = String(data.revision); el('proposal').textContent = ''; el('record').textContent = JSON.stringify(data, null, 2); controls();
      state(data.operationId ? '已持久接受原 Operation ' + data.operationId + '；不代表已应用、健康或无损切换。' : '已接受组/路径来源，展开后的执行配置不变，没有创建 Operation。');
    } catch (error) {
      if (token === epoch) {
        sending = false;
        if (pending && !pending.sent) { pending = null; state('预检未完成，未发送组切换意图；请显式重新准备。'); }
        else if (pending && !replay && reject(error)) { pending = null; state('初次切换请求被拒绝；请重新检查，不自动换 CAS。'); }
        else state('结果不确定：命令可能已提交；仅能原键/body 重放，不重新预检或替换候选。');
        proposal = null; el('proposal').textContent = ''; controls(); notify(error.message, true);
      }
    }
  }
  function clear() {
    epoch++; for (const controller of controllers) controller.abort(); controllers.clear(); pending = null; proposal = null; inspected = null; sending = false; page = 1; total = 0;
    referencePage = 1; referenceTotal = 0; referencesReady = false;
    for (const name of fields) el(name).value = name === 'expected' ? '0' : name === 'kind' ? 'backup-paths' : '';
    el('prefix').value = ''; el('rows').replaceChildren(); el('topology').replaceChildren(); el('candidate').replaceChildren(); el('record').textContent = ''; el('proposal').textContent = ''; el('page').textContent = '';
    el('reference-rows').replaceChildren(); el('references-meta').textContent = ''; el('binding-record').textContent = '';
    controls(); state('仅组元数据和显式单规则候选切换；不会自动选路或创建物理共享连接。');
  }
  for (const name of fields) for (const event of ['input','change']) el(name).addEventListener(event, () => {
    if (pending || sending) return;
    invalidate(['id','expected','read-revision','kind','candidates'].includes(name)); state('输入已改变，旧提案已清除；请显式重读或重新准备。');
  });
  el('query').addEventListener('click', () => { page = 1; return list(); });
  for (const event of ['input','change']) el('prefix').addEventListener(event, () => {
    if (pending || sending) return;
    invalidate(); page = 1; total = 0; el('rows').replaceChildren(); el('page').textContent = ''; controls();
    state('组前缀已改变，旧列表、翻页与载入操作已清除；请手动查询。');
  });
  el('inspect').addEventListener('click', () => inspect());
  el('publish').addEventListener('click', () => metadata('PUT'));
  el('archive').addEventListener('click', () => metadata('DELETE'));
  el('prepare').addEventListener('click', prepare); el('apply').addEventListener('click', apply);
  el('references').addEventListener('click', () => references()); el('binding').addEventListener('click', binding);
  for (const [name, direction] of [['references-prev',-1],['references-next',1]]) el(name).addEventListener('click', () => {
    if (!el(name).disabled) return references(referencePage + direction);
  });
  for (const [name, direction] of [['prev',-1],['next',1]]) el(name).addEventListener('click', () => { if (!el(name).disabled) { page += direction; return list(); } });
  el('cancel-read').addEventListener('click', () => { if (!sending && !pending) { invalidate(true); state('已取消本地读取，旧提案已清除；不会取消远程操作。'); } });
  el('discard').addEventListener('click', () => { if (!sending && pending && confirm('放弃本页面保留的原命令信息？这不会取消、回滚或撤销远程提交；未知结果仍可能已生效。')) clear(); });
  el('close').addEventListener('click', () => { if (!sending && (!pending || confirm('清除本地面板与原命令信息？不会取消或回滚任何远程提交，未知结果仍可能已生效。'))) clear(); });
  clear(); return { clear, list };
}
