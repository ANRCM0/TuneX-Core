const id = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) && !/\s/.test(value);
const uint = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => uint(value) && value > 0;
const revision = value => positive(value) && value <= 64;
const batchRevision = value => positive(value) && value <= 20;
const port = value => positive(value) && value <= 65535;
const bool = value => typeof value === 'boolean';
const hash = value => typeof value === 'string' && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value);
const instant = value => typeof value === 'string' && Number.isSafeInteger(Date.parse(value)) && Date.parse(value) >= 0 && new Date(value).toISOString() === value;
const object = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(name => Object.hasOwn(value, name));
const clone = value => JSON.parse(JSON.stringify(value));
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ?
  '{' + Object.keys(value).sort().map(name => JSON.stringify(name) + ':' + canonical(value[name])).join(',') + '}' : JSON.stringify(value);
const equal = (a, b) => canonical(a) === canonical(b);
const limits = { groupsPerScope: 64, revisionsPerGroup: 64, membersPerGroup: 8, batchesPerScope: 64, itemsPerBatch: 8, attemptsPerItem: 2, maxPlanBytes: 131072, maxBatchRevision: 20 };
const rejections = ['REVISION_CONFLICT','AUTHORIZATION_DENIED','GROUP_ARCHIVED','TEMPLATE_ARCHIVED','RESOURCE_LIMIT','PORT_RESERVED',
  'UNSUPPORTED_CAPABILITY','REVISION_EXHAUSTED','PUBLICATION_STATE_CHANGED','NOT_FOUND','RESOURCE_CONFLICT'];
const initialRejection = error => [400,401,403,404,409,413,422,429].includes(error.httpStatus);
const metadataFlags = data => data.source === 'persisted-control-state' && data.reserved === false && data.executionAuthorized === false &&
  data.fullPlanAuthorization === false && data.health === 'unknown' && data.physicalConnectionSharing === false &&
  (!Object.hasOwn(data, 'automaticExecution') || data.automaticExecution === false) && (!Object.hasOwn(data, 'atomicAcrossForwards') || data.atomicAcrossForwards === false);
const deploymentFlags = data => metadataFlags(data) && data.automaticExecution === false && data.atomicAcrossForwards === false;
const pathValid = path => object(path, ['templateId','revision','configDigest']) && id(path.templateId) && revision(path.revision) && hash(path.configDigest);
const groupValid = group => object(group, ['groupId','revision','configDigest']) && id(group.groupId) && revision(group.revision) && hash(group.configDigest);
async function digest(value) {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return 'sha256:' + Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
function ipv4(value) {
  const fields = value.split('.');
  return fields.length === 4 && fields.every(field => /^(0|[1-9][0-9]{0,2})$/.test(field) && Number(field) <= 255) ? fields.map(Number) : null;
}
function normalizeIp(value) {
  if (typeof value !== 'string') return null;
  const direct = ipv4(value); if (direct) return direct.join('.');
  if (!value.includes(':') || /[^0-9a-fA-F:.]/.test(value)) return null;
  let input = value;
  if (input.includes('.')) {
    const index = input.lastIndexOf(':'), bytes = ipv4(input.slice(index + 1)); if (!bytes) return null;
    input = input.slice(0, index) + ':' + ((bytes[0] << 8) | bytes[1]).toString(16) + ':' + ((bytes[2] << 8) | bytes[3]).toString(16);
  }
  const halves = input.split('::'); if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [], right = halves[1] ? halves[1].split(':') : [], count = left.length + right.length;
  if ((halves.length === 1 ? count !== 8 : count >= 8) || [...left,...right].some(word => !/^[a-fA-F0-9]{1,4}$/.test(word))) return null;
  const words = [...left,...Array(8 - count).fill('0'),...right].map(word => parseInt(word, 16));
  if (words.slice(0, 5).every(word => word === 0) && words[5] === 65535) return '::ffff:' + [words[6] >> 8,words[6] & 255,words[7] >> 8,words[7] & 255].join('.');
  let best = -1, length = 1;
  for (let index = 0; index < 8;) {
    if (words[index] !== 0) { index++; continue; }
    const start = index; while (index < 8 && words[index] === 0) index++;
    if (index - start > length) { best = start; length = index - start; }
  }
  const strings = words.map(word => word.toString(16));
  return best < 0 ? strings.join(':') : strings.slice(0, best).join(':') + '::' + strings.slice(best + length).join(':');
}
function normalizeHost(value) {
  if (typeof value !== 'string' || !value.length || /[^A-Za-z0-9.:-]/.test(value)) return null;
  const ip = normalizeIp(value);
  if (ip) return ['0.0.0.0','::','::ffff:0.0.0.0'].includes(ip) ? null : ip;
  const host = value.toLowerCase().replace(/\.$/, '');
  return host.length <= 253 && !/^[0-9.]+$/.test(host) && host.split('.').every(label => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) ? host : null;
}
function templateConfig(config) {
  return object(config, ['version','nodes','protocols','endpoints','transport']) && config.version === 1 && Array.isArray(config.nodes) && config.nodes.length >= 2 && config.nodes.length <= 8 &&
    config.nodes.every(id) && new Set(config.nodes).size === config.nodes.length && Array.isArray(config.protocols) && config.protocols.length > 0 && config.protocols.length <= 2 &&
    config.protocols.every(protocol => ['tcp','udp'].includes(protocol)) && equal(config.protocols, ['tcp','udp'].filter(protocol => config.protocols.includes(protocol))) &&
    Array.isArray(config.endpoints) && config.endpoints.length === config.nodes.length - 1 && config.endpoints.every((endpoint, index) => object(endpoint, ['nodeId','revision']) && endpoint.nodeId === config.nodes[index + 1] && positive(endpoint.revision)) &&
    object(config.transport, ['profileId','configRevision']) && id(config.transport.profileId) && positive(config.transport.configRevision);
}
function configValid(config) {
  return object(config, ['schemaVersion','members']) && config.schemaVersion === 1 && Array.isArray(config.members) && config.members.length > 0 && config.members.length <= 8 &&
    config.members.every(member => object(member, ['memberId','template']) && id(member.memberId) && pathValid(member.template)) &&
    new Set(config.members.map(member => member.memberId)).size === config.members.length && new Set(config.members.map(member => member.template.configDigest)).size === config.members.length;
}
function specValid(spec) {
  return object(spec, ['enabled','protocols','ingress','target','path','transport']) && bool(spec.enabled) && Array.isArray(spec.protocols) && spec.protocols.length > 0 &&
    spec.protocols.length <= 2 && spec.protocols.every(protocol => ['tcp','udp'].includes(protocol)) && equal(spec.protocols, ['tcp','udp'].filter(protocol => spec.protocols.includes(protocol))) &&
    object(spec.ingress, ['nodeId','listen']) && id(spec.ingress.nodeId) && object(spec.ingress.listen, ['address','port']) && typeof spec.ingress.listen.address === 'string' && normalizeIp(spec.ingress.listen.address) === spec.ingress.listen.address && port(spec.ingress.listen.port) &&
    object(spec.target, ['host','port']) && typeof spec.target.host === 'string' && normalizeHost(spec.target.host) === spec.target.host && port(spec.target.port) &&
    object(spec.path, ['via']) && Array.isArray(spec.path.via) && spec.path.via.length > 0 && spec.path.via.length <= 7 && spec.path.via.every(id) &&
    new Set([spec.ingress.nodeId,...spec.path.via]).size === spec.path.via.length + 1 && object(spec.transport, ['profileId','configRevision']) && id(spec.transport.profileId) && positive(spec.transport.configRevision);
}
async function planValid(plan, input, members) {
  if (!object(plan, ['schemaVersion','group','items']) || plan.schemaVersion !== 1 || !groupValid(plan.group) || !Array.isArray(plan.items) || !plan.items.length || plan.items.length > 8 ||
      new TextEncoder().encode(JSON.stringify(plan)).byteLength > limits.maxPlanBytes || new Set(plan.items.map(item => item.memberId)).size !== plan.items.length ||
      new Set(plan.items.map(item => item.spec?.ingress?.nodeId)).size !== plan.items.length || input && (!equal(plan.group, input.group) || plan.items.length !== input.items.length)) return false;
  for (const [index, item] of plan.items.entries()) {
    if (!object(item, ['position','memberId','template','spec','specDigest']) || item.position !== index + 1 || !id(item.memberId) || !pathValid(item.template) || !specValid(item.spec) ||
        !hash(item.specDigest) || await digest(item.spec) !== item.specDigest || index > 0 && (item.spec.enabled !== plan.items[0].spec.enabled ||
          !equal(item.spec.target, plan.items[0].spec.target) || !equal(item.spec.protocols, plan.items[0].spec.protocols))) return false;
    if (input) {
      const requested = input.items[index], member = members.find(entry => entry.memberId === requested.memberId);
      if (!member || item.memberId !== requested.memberId || !equal(item.template, member.template) || !equal(item.spec, {
        enabled: input.enabled, protocols: member.config.protocols, ingress: { nodeId: member.config.nodes[0], listen: requested.listen }, target: input.target,
        path: { via: member.config.nodes.slice(1) }, transport: member.config.transport,
      })) return false;
    }
  }
  return true;
}
async function forwardStateValid(state) {
  if (!object(state, ['forwardId','revision','spec','specDigest','path','group']) || !id(state.forwardId) || !positive(state.revision) || !specValid(state.spec) || !hash(state.specDigest) || state.group !== null ||
      !object(state.path, ['templateId','revision','configDigest','sequence','forwardRevision']) || !pathValid({ templateId: state.path.templateId, revision: state.path.revision, configDigest: state.path.configDigest }) ||
      !revision(state.path.sequence) || !positive(state.path.forwardRevision) || state.path.forwardRevision > state.revision) return false;
  return await digest(state.spec) === state.specDigest;
}
async function attemptValid(attempt, plan, createdState = null, createdOperationId = null) {
  if (!object(attempt, ['position','kind','actorId','createdAt','requestKey','requestDigest','outcome']) || !positive(attempt.position) || attempt.position > plan.items.length ||
      !['create','compensate'].includes(attempt.kind) || !id(attempt.actorId) || !instant(attempt.createdAt) || typeof attempt.requestKey !== 'string' || !attempt.requestKey.length ||
      attempt.requestKey.length > 128 || /[^\x21-\x7e]/.test(attempt.requestKey) || !hash(attempt.requestDigest)) return false;
  const outcome = attempt.outcome;
  if (object(outcome, ['accepted','error']) && outcome.accepted === false) return object(outcome.error, ['code','status']) && rejections.includes(outcome.error.code) && [403,404,409,422,429].includes(outcome.error.status);
  if (!object(outcome, ['accepted','result']) || outcome.accepted !== true || !object(outcome.result, attempt.kind === 'create' ? ['accepted','state'] : ['accepted','state','deleting'])) return false;
  const result = outcome.result, accepted = result.accepted, state = result.state;
  if (!object(accepted, ['status','body']) || accepted.status !== 202 || !await forwardStateValid(state) ||
      !object(accepted.body, attempt.kind === 'create' ? ['forwardId','revision','operationId','pathBinding'] : ['forwardId','revision','operationId']) ||
      accepted.body.forwardId !== state.forwardId || accepted.body.revision !== state.revision || !id(accepted.body.operationId)) return false;
  if (attempt.kind === 'create') {
    const item = plan.items[attempt.position - 1], receipt = accepted.body.pathBinding;
    return state.revision === 1 && state.path.sequence === 1 && state.path.forwardRevision === 1 && equal(state.spec, item.spec) && state.specDigest === item.specDigest &&
      equal({ templateId: state.path.templateId, revision: state.path.revision, configDigest: state.path.configDigest }, item.template) && receipt && receipt.changed === true && equal(receipt, { ...state.path, changed: true });
  }
  return result.deleting === true && createdState !== null && id(createdOperationId) && accepted.body.operationId !== createdOperationId &&
    state.revision === createdState.revision + 1 && equal(state, { ...createdState, revision: createdState.revision + 1 });
}
const headValid = head => id(head.batchId) && batchRevision(head.revision) && id(head.createdBy) && instant(head.createdAt) && hash(head.planDigest) && bool(head.cancelled) && bool(head.recoveryInvalidated);
async function batchValid(data) {
  if (!deploymentFlags(data) || !headValid(data) || data.consistency !== 'read-committed-not-global-snapshot' || !await planValid(data.plan) || await digest(data.plan) !== data.planDigest ||
      !Array.isArray(data.attempts) || data.attempts.length > data.plan.items.length * 2 || !Array.isArray(data.items) || data.items.length !== data.plan.items.length ||
      data.revision !== 1 + data.attempts.length + Number(data.cancelled) + Number(data.recoveryInvalidated) || !Array.isArray(data.operations) || data.operations.length > data.attempts.length ||
      new Set(data.attempts.map(attempt => attempt.position + ':' + attempt.kind)).size !== data.attempts.length || new Set(data.operations.map(operation => operation.operationId)).size !== data.operations.length) return false;
  const createdIds = new Set();
  for (const [index, item] of data.items.entries()) {
    if (!object(item, ['position','state','create','compensation']) || item.position !== index + 1) return false;
    const create = data.attempts.find(attempt => attempt.position === item.position && attempt.kind === 'create') ?? null;
    const compensation = data.attempts.find(attempt => attempt.position === item.position && attempt.kind === 'compensate') ?? null;
    if (!equal(item.create, create) || !equal(item.compensation, compensation) || compensation && create?.outcome.accepted !== true ||
        item.state !== (create ? create.outcome.accepted ? 'accepted' : 'rejected' : data.recoveryInvalidated ? 'suspended' : data.cancelled ? 'cancelled' : 'pending')) return false;
    if (create && (!await attemptValid(create, data.plan) || create.actorId !== data.createdBy)) return false;
    const created = create?.outcome.accepted === true ? create.outcome.result.state : null;
    if (created) { if (createdIds.has(created.forwardId)) return false; createdIds.add(created.forwardId); }
    if (compensation && (!await attemptValid(compensation, data.plan, created, create.outcome.result.accepted.body.operationId) || compensation.actorId !== data.createdBy)) return false;
  }
  return data.attempts.every(attempt => positive(attempt.position) && attempt.position <= data.items.length && ['create','compensate'].includes(attempt.kind)) &&
    data.operations.every(operation => object(operation, ['operationId','forwardId','targetRevision','status','cleanupPending','recoveryInvalidated']) &&
      ['accepted','running','succeeded','failed','superseded'].includes(operation.status) && bool(operation.cleanupPending) && bool(operation.recoveryInvalidated) &&
      data.attempts.some(attempt => attempt.outcome.accepted && attempt.outcome.result.accepted.body.operationId === operation.operationId &&
        attempt.outcome.result.accepted.body.forwardId === operation.forwardId && attempt.outcome.result.accepted.body.revision === operation.targetRevision));
}

export function initIngressGroups({ request, byId, notify, getScope, document = globalThis.document, confirm = globalThis.confirm, randomUUID = () => crypto.randomUUID() }) {
  const el = name => byId('ingress-' + name), fields = ['group','expected','read-revision','members','prefix','listeners','target','target-port','enabled','batch','batch-group'];
  let epoch = 0, groupPage = 1, groupTotal = 0, batchPage = 1, batchTotal = 0, inspected = null, preview = null, loaded = null, pending = null, sending = false;
  const controllers = new Set();
  const state = text => { el('state').textContent = text; };
  function controls() {
    for (const name of fields) el(name).disabled = Boolean(pending) || sending;
    for (const name of ['inspect','query','preview','read','list']) el(name).disabled = Boolean(pending) || sending;
    el('publish').disabled = sending || Boolean(pending);
    el('archive').disabled = sending || Boolean(pending);
    el('plan-create').disabled = Boolean(pending) || sending || !preview;
    el('cancel').disabled = Boolean(pending) || sending || !loaded || loaded.cancelled || loaded.recoveryInvalidated || !loaded.items.some(item => item.state === 'pending');
    el('replay').disabled = !pending || sending; el('clear').disabled = sending;
    el('cancel-read').disabled = Boolean(pending) || sending || controllers.size === 0;
    for (const [name, page, total] of [['group',groupPage,groupTotal],['batch',batchPage,batchTotal]]) {
      el(name + '-prev').disabled = Boolean(pending) || sending || page <= 1;
      el(name + '-next').disabled = Boolean(pending) || sending || page >= Math.min(10000, Math.max(1, Math.ceil(total / 25)));
    }
    for (const area of ['group-rows','batch-rows','item-rows']) for (const button of el(area).querySelectorAll('button'))
      button.disabled = Boolean(pending) || sending || button.dataset.epoch !== String(epoch) || button.dataset.unavailable === 'true';
  }
  async function call(method, resource, body, requestKey) {
    const controller = new AbortController(); controllers.add(controller); controls(); const timer = setTimeout(() => controller.abort(), 5000);
    try { return await request(method, resource, body, requestKey, { signal: controller.signal, timeoutMs: 5000 }); }
    finally { clearTimeout(timer); controllers.delete(controller); controls(); }
  }
  function invalidate(dropInspection = false) {
    epoch++; for (const controller of controllers) controller.abort(); controllers.clear(); preview = null; loaded = null;
    el('preview-output').textContent = ''; el('batch-record').textContent = ''; el('item-rows').replaceChildren();
    if (dropInspection) { inspected = null; el('metadata-record').textContent = ''; el('topology').replaceChildren(); el('plan-group').textContent = '尚未读取精确入口定义'; }
    controls();
  }
  function button(cell, text, unavailable, action, token) {
    const item = document.createElement('button'); item.type = 'button'; item.className = 'secondary'; item.textContent = text; item.dataset.epoch = String(token); item.dataset.unavailable = String(unavailable);
    item.addEventListener('click', () => { if (token === epoch && !pending && !sending && !item.disabled) return action(); }); cell.append(item);
  }
  function metadataDraft() {
    const members = el('members').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const values = line.split(/\s+/); if (values.length !== 4 || !/^[1-9][0-9]*$/.test(values[2])) throw Error('每行需要 memberID TemplateID 精确修订 sha256:摘要。');
      return { memberId: values[0], template: { templateId: values[1], revision: Number(values[2]), configDigest: values[3] } };
    });
    const config = { schemaVersion: 1, members };
    if (!configValid(config)) throw Error('需要一至八个有序成员；成员 ID 与完整路径摘要必须不同。');
    return config;
  }
  async function inspect(groupId = el('group').value.trim(), selected = el('read-revision').value) {
    if (pending || sending) return;
    invalidate(true); const token = epoch;
    try {
      if (!id(groupId) || selected !== '' && (!/^[1-9][0-9]*$/.test(selected) || !revision(Number(selected)))) throw Error('需要入口定义 ID 和一至六十四的精确修订；空白读取当前修订。');
      const data = await call('GET', 'ingress-groups/' + encodeURIComponent(groupId) + (selected ? '?revision=' + selected : ''));
      if (token !== epoch) return;
      if (!metadataFlags(data) || data.groupId !== groupId || !revision(data.currentRevision) || !revision(data.revision) || data.revision > data.currentRevision ||
          data.revision !== (selected ? Number(selected) : data.currentRevision) || !bool(data.archived) || !configValid(data.config) || !hash(data.configDigest) || !id(data.createdBy) ||
          !instant(data.createdAt) || data.referenceAuthorization !== 'not-rechecked-by-this-query' || !Array.isArray(data.members) || data.members.length !== data.config.members.length ||
          data.members.some((member, index) => !object(member, ['memberId','template','config']) || member.memberId !== data.config.members[index].memberId ||
            !equal(member.template, data.config.members[index].template) || !templateConfig(member.config)) ||
          new Set(data.members.map(member => member.config.nodes[0])).size !== data.members.length ||
          data.members.some(member => !equal(member.config.protocols, data.members[0].config.protocols)) || await digest(data.config) !== data.configDigest)
        throw Error('入口定义修订、摘要、独立入口或协议响应无效。');
      if (token !== epoch) return;
      inspected = clone(data); el('group').value = groupId; el('expected').value = String(data.currentRevision); el('read-revision').value = String(data.revision);
      el('members').value = data.config.members.map(member => [member.memberId,member.template.templateId,member.template.revision,member.template.configDigest].join(' ')).join('\n');
      el('plan-group').textContent = '固定定义 ' + groupId + ' / r' + data.revision + ' / ' + data.configDigest + (data.archived ? '（已归档，不可创建计划）' : '');
      for (const member of data.members) { const item = document.createElement('li'); item.textContent = member.memberId + ' · 独立入口 ' + member.config.nodes[0] + ' · 必经路径 ' + member.config.nodes.join(' → ') +
        ' · ' + member.config.protocols.join('+') + ' · Profile ' + member.config.transport.profileId + ' r' + member.config.transport.configRevision + ' · health=unknown'; el('topology').append(item); }
      el('metadata-record').textContent = JSON.stringify(data, null, 2); controls(); state('精确入口定义已读取；没有创建 Forward、预留监听或复核当前 Grant。请明确填写本次所选成员和各自监听。');
    } catch (error) { if (token === epoch) { invalidate(true); state('入口定义读取失败，旧选择已清除。'); notify(error.message, true); } }
  }
  async function groupList() {
    if (pending || sending) return;
    invalidate(); const token = epoch, requested = groupPage; el('group-rows').replaceChildren(); el('group-page').textContent = '';
    try {
      const prefix = el('prefix').value.trim(); if (prefix !== '' && !id(prefix)) throw Error('入口定义 ID 前缀无效。');
      const data = await call('GET', 'ingress-groups?page=' + requested + '&limit=25' + (prefix ? '&prefix=' + encodeURIComponent(prefix) : ''));
      if (token !== epoch) return;
      if (!metadataFlags(data) || data.referenceAuthorization !== 'not-rechecked-by-this-query' || data.page !== requested || data.limit !== 25 || !uint(data.total) || data.total > 64 || !Array.isArray(data.items) || data.items.length > 25 ||
          new Set(data.items.map(item => item.groupId)).size !== data.items.length || data.items.some(item => !id(item.groupId) || !item.groupId.startsWith(prefix) || !revision(item.currentRevision) || !bool(item.archived))) throw Error('有界入口定义列表无效。');
      groupTotal = data.total;
      for (const head of data.items) {
        const row = document.createElement('tr'); for (const text of [head.groupId,'r' + head.currentRevision,head.archived ? '已归档，历史保留' : '仅元数据，健康未知']) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }
        const cell = document.createElement('td'); button(cell, '手动读取当前修订', false, () => inspect(head.groupId, ''), token); row.append(cell); el('group-rows').append(row);
      }
      if (!data.items.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 4; cell.textContent = '无可见定义；不代表入口可用性或部署结果。'; row.append(cell); el('group-rows').append(row); }
      el('group-page').textContent = '第 ' + requested + ' 页，共 ' + data.total + ' 组（含归档）。'; controls();
    } catch (error) { if (token === epoch) { groupTotal = 0; el('group-rows').replaceChildren(); el('group-page').textContent = '定义列表不可用，旧结果已清除。'; controls(); notify(error.message, true); } }
  }
  function deploymentInput() {
    if (!inspected || inspected.archived) throw Error('请先读取未归档的精确入口定义。');
    const targetHost = normalizeHost(el('target').value.trim()), targetPort = Number(el('target-port').value), enabled = el('enabled').value;
    if (!targetHost || !/^[1-9][0-9]*$/.test(el('target-port').value) || !port(targetPort) || !['true','false'].includes(enabled)) throw Error('需要有效共享目标、端口和明确启用/停用意图。');
    const items = el('listeners').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const values = line.split(/\s+/), address = normalizeIp(values[1]);
      if (values.length !== 3 || !id(values[0]) || !address || !/^[1-9][0-9]*$/.test(values[2]) || !port(Number(values[2]))) throw Error('每行需要 memberID 明确监听IP 端口。IPv6 不加方括号。');
      return { memberId: values[0], listen: { address, port: Number(values[2]) } };
    });
    if (!items.length || items.length > 8 || new Set(items.map(item => item.memberId)).size !== items.length ||
        items.some(item => !inspected.members.some(member => member.memberId === item.memberId))) throw Error('请选择定义内一至八个不同成员，各出现一次；不会自动展开其他成员。');
    return { schemaVersion: 1, group: { groupId: inspected.groupId, revision: inspected.revision, configDigest: inspected.configDigest }, enabled: enabled === 'true', target: { host: targetHost, port: targetPort }, items };
  }
  async function prepare() {
    if (pending || sending) return;
    invalidate(); const token = epoch;
    try {
      const input = deploymentInput(), members = clone(inspected.members), data = await call('POST', 'ingress-deployments/preview', clone(input));
      if (token !== epoch) return;
      const plan = { schemaVersion: data.schemaVersion, group: data.group, items: data.items };
      if (!deploymentFlags(data) || !equal(data.limits, limits) || data.interruption !== 'independent-ingress-listeners' || !hash(data.previewDigest) ||
          !await planValid(plan, input, members) || await digest(plan) !== data.previewDigest) throw Error('入口部署预览的精确成员、监听、目标、配置或摘要无效。');
      if (token !== epoch) return;
      preview = clone({ input, plan, previewDigest: data.previewDigest }); el('preview-output').textContent = '预览与持久计划均没有预分配 Forward ID；UUID 仅在明确逐项创建被原所有者接受后产生。\n' + JSON.stringify(data, null, 2); controls();
      state('预览已固定，尚未预留或创建规则。创建计划只保存元数据，以后每次手动创建一个独立入口 Forward。');
    } catch (error) { if (token === epoch) { invalidate(); state('入口部署预览不可用，旧提案已清除；未创建规则。'); notify(error.message, true); } }
  }
  function renderBatch(data) {
    loaded = clone(data); const token = epoch;
    el('batch-record').textContent = '入口部署批次 ' + data.batchId + ' / CAS r' + data.revision + '\n创建者 ' + data.createdBy + ' / ' + data.createdAt + '\nplanDigest=' + data.planDigest +
      '\ncancelled=' + data.cancelled + ' / recoveryInvalidated=' + data.recoveryInvalidated + '\n批次/成员只是不可变历史归属，不建立新的当前组执行绑定。\n' + JSON.stringify({ group: data.plan.group, operations: data.operations }, null, 2);
    for (const item of data.items) {
      const frozen = data.plan.items[item.position - 1], row = document.createElement('tr');
      for (const text of [item.position + '. ' + frozen.memberId + '\n入口 ' + frozen.spec.ingress.nodeId + '\n' + frozen.spec.ingress.listen.address + ':' + frozen.spec.ingress.listen.port,
        item.state + '\ncreate=' + (item.create ? item.create.outcome.accepted ? '原 Forward 创建已接受' : '拒绝已持久记录' : '无创建尝试') +
          '\ncompensation=' + (item.compensation ? item.compensation.outcome.accepted ? '原 DELETE 已接受' : '补偿拒绝已记录' : '无'),
        JSON.stringify(frozen, null, 2), JSON.stringify({ create: item.create, compensation: item.compensation }, null, 2)]) {
        const cell = document.createElement('td'); cell.textContent = text; row.append(cell);
      }
      const cell = document.createElement('td');
      button(cell, '仅创建这个入口', data.cancelled || data.recoveryInvalidated || item.state !== 'pending' || item.create !== null, () => step(item.position, 'create'), token);
      button(cell, '条件清理这个新建规则', data.recoveryInvalidated || item.create?.outcome.accepted !== true || item.compensation !== null, () => step(item.position, 'compensate'), token);
      row.append(cell); el('item-rows').append(row);
    }
    controls(); state('已读取持久计划。每项各自创建 Forward/Operation；不会自动继续，写入后必须手动重读获取新批次 CAS。');
  }
  async function read() {
    if (pending || sending) return;
    invalidate(); const token = epoch;
    try {
      const batchId = el('batch').value.trim(); if (!id(batchId)) throw Error('需要入口部署批次 ID。');
      const data = await call('GET', 'ingress-deployments/' + encodeURIComponent(batchId)); if (token !== epoch) return;
      if (data.batchId !== batchId || !await batchValid(data)) throw Error('入口部署批次、计划、决策或原 Operation 映射无效。');
      if (token !== epoch) return; renderBatch(data);
    } catch (error) { if (token === epoch) { invalidate(); state('部署批次读取失败，旧状态与按钮已清除；缺少记录不证明未知创建未提交。'); notify(error.message, true); } }
  }
  async function batchList() {
    if (pending || sending) return;
    invalidate(); const token = epoch, requested = batchPage; el('batch-rows').replaceChildren(); el('batch-page').textContent = '';
    try {
      const groupId = el('batch-group').value.trim(); if (groupId !== '' && !id(groupId)) throw Error('批次组 ID 筛选无效。');
      const data = await call('GET', 'ingress-deployments?page=' + requested + '&limit=25' + (groupId ? '&groupId=' + encodeURIComponent(groupId) : ''));
      if (token !== epoch) return;
      if (!deploymentFlags(data) || data.page !== requested || data.limit !== 25 || !uint(data.total) || data.total > 64 || !Array.isArray(data.items) || data.items.length > 25 ||
          new Set(data.items.map(item => item.batchId)).size !== data.items.length || data.items.some(item => !headValid(item))) throw Error('有界入口部署列表无效。');
      batchTotal = data.total;
      for (const head of data.items) {
        const row = document.createElement('tr'); for (const text of [head.batchId + ' / r' + head.revision,head.createdBy + '\n' + head.createdAt,
          'cancelled=' + head.cancelled + '\nrecoveryInvalidated=' + head.recoveryInvalidated + '\n' + head.planDigest]) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }
        const cell = document.createElement('td'); button(cell, '仅载入批次 ID', false, () => { invalidate(); el('batch').value = head.batchId; state('ID 已载入，请手动读取；不会自动创建规则。'); }, token); row.append(cell); el('batch-rows').append(row);
      }
      if (!data.items.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 4; cell.textContent = '没有可见批次；不证明未知提交不存在。'; row.append(cell); el('batch-rows').append(row); }
      el('batch-page').textContent = '第 ' + requested + ' 页，共 ' + data.total + ' 个持久批次；不是全库快照。'; controls();
    } catch (error) { if (token === epoch) { batchTotal = 0; el('batch-rows').replaceChildren(); el('batch-page').textContent = '入口部署列表不可用，旧结果已清除。'; controls(); notify(error.message, true); } }
  }
  async function send(original, replay = false) {
    if (sending || pending !== original) return;
    const token = epoch; sending = true; controls(); state('正在提交唯一原命令，不会自动派发其他入口。');
    try {
      const data = await call(original.method, original.resource, clone(original.body), original.key); if (token !== epoch || pending !== original) return;
      if (original.kind === 'metadata') {
        if (!object(data, ['groupId','revision','configDigest','archived','changed']) || data.groupId !== original.groupId || !revision(data.revision) || !hash(data.configDigest) ||
            !bool(data.changed) || data.archived !== (original.method === 'DELETE') || data.revision !== original.body.expectedRevision + (original.method === 'PUT' && data.changed ? 1 : 0) ||
            original.method === 'PUT' && await digest(original.body.config) !== data.configDigest) throw Error('入口定义回执无效，原结果仍不确定。');
      } else if (original.kind === 'plan') {
        if (!object(data, ['batchId','revision','planDigest','changed','reserved','executionAuthorized']) || !id(data.batchId) || data.revision !== 1 || data.planDigest !== original.body.previewDigest ||
            data.changed !== true || data.reserved !== false || data.executionAuthorized !== false) throw Error('持久入口计划回执无效，原结果仍不确定。');
      } else if (original.kind === 'cancel') {
        if (!object(data, ['batchId','revision','cancelled','changed']) || data.batchId !== original.batchId || data.cancelled !== true || !bool(data.changed) ||
            data.revision !== original.body.expectedRevision + (data.changed ? 1 : 0)) throw Error('取消入口计划回执无效，原结果仍不确定。');
      } else {
        const requestDigest = await digest({ method: 'POST', path: '/api/v1/scopes/' + original.scope + '/ingress-deployments/' + original.batchId + '/items/' + original.position + '/' + original.kind, input: original.body });
        if (!object(data, ['batchId','revision','position','kind','attempt','atomicAcrossForwards']) || data.batchId !== original.batchId || data.revision !== original.body.expectedRevision + 1 ||
            data.position !== original.position || data.kind !== original.kind || data.atomicAcrossForwards !== false || !await attemptValid(data.attempt, original.plan, original.createdState, original.createdOperationId) ||
            data.attempt.position !== original.position || data.attempt.kind !== original.kind || data.attempt.actorId !== original.createdBy || data.attempt.requestKey !== original.key || data.attempt.requestDigest !== requestDigest)
          throw Error('入口逐项决策回执无效，原创建或清理可能已提交。');
      }
      if (token !== epoch || pending !== original) return;
      pending = null; sending = false; invalidate(original.kind === 'metadata');
      if (original.kind === 'metadata') { el('expected').value = String(data.revision); el('metadata-record').textContent = JSON.stringify(data, null, 2); state('入口定义元数据已' + (data.archived ? '归档' : '发布') + '。没有创建、删除或修改 Forward；请手动重读。'); }
      else {
        el('batch').value = data.batchId; el('batch-record').textContent = JSON.stringify(data, null, 2);
        state(original.kind === 'plan' ? '持久入口计划已创建，尚无 Forward ID 或监听预留。请手动读取后每次确认创建一项。' : original.kind === 'cancel' ?
          '已取消剩余未来创建；已经接受的 Forward/Operation 不受影响。条件清理仍须逐项确认与当前授权。' : data.attempt.outcome.accepted ?
            '该项原 Forward 命令已独立接受；创建 UUID/原 Operation 见回执，不代表已生效或可达。请手动重读，不会继续尾部。' :
            '该项拒绝已持久记录；HTTP 202 不代表 Forward 接受。请手动重读，不自动重试。');
      }
      controls();
    } catch (error) { if (token === epoch) { sending = false; if (!replay && initialRejection(error)) pending = null; controls(); state(pending ?
      '原结果不确定，只可明确重放原键/body。不能换候选、成员、监听或 CAS；重放时的拒绝也不能证明原提交不存在。' :
      '初次命令已明确拒绝；没有换 CAS、重试或继续尾部。请手动读取并重新准备。'); notify(error.message, true); } }
  }
  function metadata(method) {
    if (pending || sending) return;
    try {
      const groupId = el('group').value.trim(), expected = el('expected').value;
      if (!id(groupId) || !/^(0|[1-9][0-9]*)$/.test(expected) || Number(expected) > 64 || method === 'DELETE' && Number(expected) === 0) throw Error('需要定义 ID 和显式当前 CAS，新建发布填 0。');
      const body = { expectedRevision: Number(expected), ...(method === 'PUT' ? { config: metadataDraft() } : {}) };
      if (!confirm(method === 'PUT' ? '只发布不可变入口定义？不预留监听、不创建规则，也不自动部署成员。' : '永久归档入口定义？历史保留，不会停止已创建规则或取消既有计划。')) return;
      invalidate(true); pending = { kind: 'metadata', method, resource: 'ingress-groups/' + encodeURIComponent(groupId), groupId, body: clone(body), key: randomUUID(), scope: getScope() }; return send(pending);
    } catch (error) { notify(error.message, true); }
  }
  function createPlan() {
    if (pending || sending || !preview) return;
    if (!confirm('仅保存这一份固定入口部署计划？不会预分配 Forward UUID、预留资源或创建 Operation；之后手动逐项创建。')) return;
    const body = { ...clone(preview.input), previewDigest: preview.previewDigest }; invalidate();
    pending = { kind: 'plan', method: 'POST', resource: 'ingress-deployments', body, key: randomUUID(), scope: getScope() }; return send(pending);
  }
  function step(position, kind) {
    if (pending || sending || !loaded || loaded.recoveryInvalidated) return;
    const item = loaded.items.find(entry => entry.position === position);
    if (!item || (kind === 'create' ? loaded.cancelled || item.state !== 'pending' || item.create !== null : item.create?.outcome.accepted !== true || item.compensation !== null)) return;
    if (!confirm(kind === 'create' ? '仅通过原所有者创建这一个独立入口 Forward？UUID 在接受时产生，监听/授权/容量须重新检查；其他成员不会自动创建。' :
      '仅条件清理这一项已经创建的 Forward？须与本次接受的完整状态、原路径序号一致且当前仍获授权；人工修改或恢复可拒绝。原 DELETE 创建新 Operation，不保证立即停止连接或清理端口。')) return;
    const original = { kind, method: 'POST', batchId: loaded.batchId, position, plan: clone(loaded.plan), createdBy: loaded.createdBy,
      createdState: kind === 'compensate' ? clone(item.create.outcome.result.state) : null,
      createdOperationId: kind === 'compensate' ? item.create.outcome.result.accepted.body.operationId : null,
      resource: 'ingress-deployments/' + encodeURIComponent(loaded.batchId) + '/items/' + position + '/' + kind,
      body: { expectedRevision: loaded.revision }, key: randomUUID(), scope: getScope() }; invalidate(); pending = original; return send(pending);
  }
  function cancel() {
    if (pending || sending || !loaded || loaded.cancelled || loaded.recoveryInvalidated || !loaded.items.some(item => item.state === 'pending')) return;
    if (!confirm('仅取消未创建的未来项目？不会取消原 Operation、删除已创建 Forward 或终止现有连接；条件清理须另行逐项确认。')) return;
    const original = { kind: 'cancel', method: 'POST', batchId: loaded.batchId, resource: 'ingress-deployments/' + encodeURIComponent(loaded.batchId) + '/cancel',
      body: { expectedRevision: loaded.revision }, key: randomUUID(), scope: getScope() }; invalidate(); pending = original; return send(pending);
  }
  function clear() {
    pending = null; sending = false; invalidate(true); groupPage = 1; groupTotal = 0; batchPage = 1; batchTotal = 0;
    for (const name of fields) el(name).value = name === 'expected' ? '0' : '';
    for (const area of ['group-rows','batch-rows']) el(area).replaceChildren(); el('group-page').textContent = ''; el('batch-page').textContent = ''; controls();
    state('入口定义与受控多规则创建；无 VIP/DNS 切流、全局入口高可用、物理共享或自动执行。关闭/断开不取消远程计划。');
  }
  for (const name of fields) for (const event of ['input','change']) el(name).addEventListener(event, () => {
    if (pending || sending) return;
    invalidate(['group','expected','read-revision','members'].includes(name));
    if (name === 'prefix') { groupPage = 1; groupTotal = 0; el('group-rows').replaceChildren(); el('group-page').textContent = ''; }
    if (name === 'batch-group') { batchPage = 1; batchTotal = 0; el('batch-rows').replaceChildren(); el('batch-page').textContent = ''; }
    controls(); state('输入已变化，旧预览、批次状态和动作已清除；请手动读取或预览，不会自动发请求。');
  });
  el('inspect').addEventListener('click', () => inspect()); el('query').addEventListener('click', () => { groupPage = 1; return groupList(); });
  el('publish').addEventListener('click', () => metadata('PUT')); el('archive').addEventListener('click', () => metadata('DELETE'));
  el('preview').addEventListener('click', prepare); el('plan-create').addEventListener('click', createPlan); el('read').addEventListener('click', read); el('cancel').addEventListener('click', cancel);
  el('list').addEventListener('click', () => { batchPage = 1; return batchList(); });
  for (const [name, direction] of [['group-prev',-1],['group-next',1],['batch-prev',-1],['batch-next',1]]) el(name).addEventListener('click', () => {
    if (el(name).disabled) return;
    if (name.startsWith('group')) { groupPage += direction; return groupList(); }
    batchPage += direction; return batchList();
  });
  el('replay').addEventListener('click', () => { if (pending && !sending && confirm('只重放原键/body 的完整命令？不重新预览、不换 CAS、成员、监听或请求键，也不自动继续尾部。')) return send(pending, true); });
  el('cancel-read').addEventListener('click', () => { if (!pending && !sending) { invalidate(); state('本地读取已取消，不取消远程计划或已接受操作。'); } });
  el('clear').addEventListener('click', () => { if (!sending && (!pending || confirm('清除本地原命令记忆？原提交可能已经成功；这不会取消远程计划、删除规则或回滚 Operation。'))) clear(); });
  clear(); return { clear };
}
