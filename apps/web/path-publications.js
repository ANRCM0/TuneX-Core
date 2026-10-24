import { batchProgress } from './task-workflow.js';
const id = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) && !/\s/.test(value);
const uint = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => uint(value) && value > 0;
const revision = value => positive(value) && value <= 64;
const batchRevision = value => positive(value) && value <= 24;
const hash = value => typeof value === 'string' && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value);
const bool = value => typeof value === 'boolean';
const time = value => typeof value === 'string' && Number.isSafeInteger(Date.parse(value)) && Date.parse(value) >= 0 && new Date(value).toISOString() === value;
const key = value => typeof value === 'string' && value.length > 0 && value.length <= 128 && !/[^\x21-\x7e]/.test(value);
const object = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(name => Object.hasOwn(value, name));
const clone = value => JSON.parse(JSON.stringify(value));
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ?
  '{' + Object.keys(value).sort().map(name => JSON.stringify(name) + ':' + canonical(value[name])).join(',') + '}' : JSON.stringify(value);
const equal = (a, b) => canonical(a) === canonical(b);
const size = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const limits = { batchesPerScope: 64, itemsPerBatch: 10, attemptsPerItem: 2, maxPlanBytes: 131072, maxBatchRevision: 24 };
const rejections = ['REVISION_CONFLICT','AUTHORIZATION_DENIED','GROUP_ARCHIVED','TEMPLATE_ARCHIVED','RESOURCE_LIMIT','PORT_RESERVED',
  'UNSUPPORTED_CAPABILITY','REVISION_EXHAUSTED','PUBLICATION_STATE_CHANGED','NOT_FOUND','RESOURCE_CONFLICT'];
const initialRejection = error => [400,401,403,404,409,413,422,429].includes(error.httpStatus);
const readFlags = data => data.source === 'persisted-control-state' && data.reserved === false && data.executionAuthorized === false &&
  data.fullPlanAuthorization === false && data.health === 'unknown' && data.automaticExecution === false && data.atomicAcrossForwards === false;
const groupValid = group => object(group, ['groupId','revision','configDigest','candidateId']) && id(group.groupId) && revision(group.revision) && hash(group.configDigest) && id(group.candidateId);
const pathValid = path => object(path, ['templateId','revision','configDigest']) && id(path.templateId) && revision(path.revision) && hash(path.configDigest);
async function digest(value) {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return 'sha256:' + Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
function specValid(spec, native = false) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec) || Object.keys(spec).some(name => !['enabled','protocols','ingress','target','path','transport'].includes(name)) ||
      !bool(spec.enabled) || !Array.isArray(spec.protocols) || !spec.protocols.length || spec.protocols.length > 2 || spec.protocols.some(protocol => !['tcp','udp'].includes(protocol)) ||
      new Set(spec.protocols).size !== spec.protocols.length || !object(spec.ingress, ['nodeId','listen']) || !id(spec.ingress.nodeId) ||
      !object(spec.ingress.listen, ['address','port']) || typeof spec.ingress.listen.address !== 'string' || !spec.ingress.listen.address.length || spec.ingress.listen.address.length > 253 ||
      !positive(spec.ingress.listen.port) || spec.ingress.listen.port > 65535 || !object(spec.target, ['host','port']) || typeof spec.target.host !== 'string' ||
      !spec.target.host.length || spec.target.host.length > 253 || !positive(spec.target.port) || spec.target.port > 65535) return false;
  const hasPath = Object.hasOwn(spec, 'path'), hasTransport = Object.hasOwn(spec, 'transport');
  if (hasPath !== hasTransport || native && !hasPath) return false;
  return !hasPath || object(spec.path, ['via']) && Array.isArray(spec.path.via) && spec.path.via.length > 0 && spec.path.via.length <= 7 && spec.path.via.every(id) &&
    new Set([spec.ingress.nodeId,...spec.path.via]).size === spec.path.via.length + 1 && object(spec.transport, ['profileId','configRevision']) && id(spec.transport.profileId) && positive(spec.transport.configRevision);
}
async function stateValid(state) {
  if (!object(state, ['forwardId','revision','spec','specDigest','path','group']) || !id(state.forwardId) || !positive(state.revision) || !specValid(state.spec) || !hash(state.specDigest)) return false;
  const path = state.path, group = state.group;
  if (path !== null && (!object(path, ['templateId','revision','configDigest','sequence','forwardRevision']) ||
      !pathValid({ templateId: path.templateId, revision: path.revision, configDigest: path.configDigest }) || !revision(path.sequence) ||
      !positive(path.forwardRevision) || path.forwardRevision > state.revision || !state.spec.path)) return false;
  if (group !== null && (!object(group, ['groupId','revision','configDigest','candidateId','sequence','pathBindingSequence','forwardRevision']) ||
      !groupValid({ groupId: group.groupId, revision: group.revision, configDigest: group.configDigest, candidateId: group.candidateId }) ||
      !revision(group.sequence) || !path || group.pathBindingSequence !== path.sequence || !positive(group.forwardRevision) || group.forwardRevision > state.revision)) return false;
  return await digest(state.spec) === state.specDigest;
}
async function planValid(plan, input) {
  if (!object(plan, ['schemaVersion','group','items']) || plan.schemaVersion !== 1 || !groupValid(plan.group) || !Array.isArray(plan.items) ||
      !plan.items.length || plan.items.length > limits.itemsPerBatch || size(plan) > limits.maxPlanBytes ||
      new Set(plan.items.map(item => item.source?.forwardId)).size !== plan.items.length || input && (!equal(plan.group, input.group) || plan.items.length !== input.items.length)) return false;
  for (const [index, row] of plan.items.entries()) {
    if (!object(row, ['position','source','template','proposedSpec','proposedDigest']) || row.position !== index + 1 || !await stateValid(row.source) ||
        !pathValid(row.template) || !specValid(row.proposedSpec, true) || !hash(row.proposedDigest) || await digest(row.proposedSpec) !== row.proposedDigest ||
        !equal({ ...row.source.spec, path: row.proposedSpec.path, transport: row.proposedSpec.transport }, row.proposedSpec) ||
        index > 0 && (!equal(row.template, plan.items[0].template) || !equal(row.proposedSpec.path, plan.items[0].proposedSpec.path) || !equal(row.proposedSpec.transport, plan.items[0].proposedSpec.transport)) ||
        input && (row.source.forwardId !== input.items[index].forwardId || row.source.revision !== input.items[index].expectedRevision)) return false;
  }
  return true;
}
async function attemptValid(attempt, plan) {
  if (!object(attempt, ['position','kind','actorId','createdAt','requestKey','requestDigest','outcome']) || !positive(attempt.position) || attempt.position > plan.items.length ||
      !['apply','compensate'].includes(attempt.kind) || !id(attempt.actorId) || !time(attempt.createdAt) || !key(attempt.requestKey) || !hash(attempt.requestDigest)) return false;
  const outcome = attempt.outcome;
  if (object(outcome, ['accepted','error']) && outcome.accepted === false) return object(outcome.error, ['code','status']) && rejections.includes(outcome.error.code) && [403,404,409,422,429].includes(outcome.error.status);
  if (!object(outcome, ['accepted','result']) || outcome.accepted !== true || !object(outcome.result, ['accepted','state']) || !await stateValid(outcome.result.state)) return false;
  const receipt = outcome.result.accepted, state = outcome.result.state, body = receipt?.body;
  if (!object(receipt, ['status','body']) || ![200,202].includes(receipt.status) || !body || Object.keys(body).some(name => !['forwardId','revision','operationId','pathBinding','pathGroupBinding'].includes(name)) ||
      body.forwardId !== plan.items[attempt.position - 1].source.forwardId || body.forwardId !== state.forwardId || body.revision !== state.revision ||
      !(body.operationId === null || id(body.operationId)) || (receipt.status === 202) !== (body.operationId !== null)) return false;
  for (const [receiptName, stateName] of [['pathBinding','path'],['pathGroupBinding','group']]) {
    if ((state[stateName] !== null) !== Object.hasOwn(body, receiptName)) return false;
    if (Object.hasOwn(body, receiptName)) {
      const binding = body[receiptName];
      if (!binding || !bool(binding.changed) || state[stateName] === null || !equal(binding, { ...state[stateName], changed: binding.changed })) return false;
    }
  }
  if (attempt.kind === 'apply') return equal(state.spec, plan.items[attempt.position - 1].proposedSpec) && state.group !== null && state.path !== null &&
    equal({ templateId: state.path.templateId, revision: state.path.revision, configDigest: state.path.configDigest }, plan.items[attempt.position - 1].template) &&
    equal({ groupId: state.group.groupId, revision: state.group.revision, configDigest: state.group.configDigest, candidateId: state.group.candidateId }, plan.group);
  const source = plan.items[attempt.position - 1].source;
  return equal(state.spec, source.spec) && (state.path === null) === (source.path === null) && (state.group === null) === (source.group === null) &&
    (!state.path || equal({ templateId: state.path.templateId, revision: state.path.revision, configDigest: state.path.configDigest },
      { templateId: source.path.templateId, revision: source.path.revision, configDigest: source.path.configDigest })) &&
    (!state.group || equal({ groupId: state.group.groupId, revision: state.group.revision, configDigest: state.group.configDigest, candidateId: state.group.candidateId },
      { groupId: source.group.groupId, revision: source.group.revision, configDigest: source.group.configDigest, candidateId: source.group.candidateId }));
}
const headValid = head => id(head.batchId) && batchRevision(head.revision) && id(head.createdBy) && time(head.createdAt) && hash(head.planDigest) && bool(head.cancelled) && bool(head.recoveryInvalidated);
async function batchValid(data) {
  if (!readFlags(data) || !headValid(data) || data.consistency !== 'read-committed-not-global-snapshot' || !await planValid(data.plan) ||
      await digest(data.plan) !== data.planDigest || !Array.isArray(data.attempts) || data.attempts.length > data.plan.items.length * 2 ||
      !Array.isArray(data.items) || data.items.length !== data.plan.items.length || !Array.isArray(data.operations) || data.operations.length > data.attempts.length ||
      new Set(data.attempts.map(attempt => attempt.position + ':' + attempt.kind)).size !== data.attempts.length ||
      new Set(data.operations.map(operation => operation.operationId)).size !== data.operations.length ||
      data.revision !== 1 + data.attempts.length + Number(data.cancelled) + Number(data.recoveryInvalidated)) return false;
  for (const attempt of data.attempts) if (!await attemptValid(attempt, data.plan)) return false;
  for (const [index, item] of data.items.entries()) {
    if (!object(item, ['position','state','apply','compensation']) || item.position !== index + 1 || !['pending','accepted','rejected','cancelled','suspended'].includes(item.state)) return false;
    const apply = data.attempts.find(attempt => attempt.position === item.position && attempt.kind === 'apply') ?? null;
    const compensation = data.attempts.find(attempt => attempt.position === item.position && attempt.kind === 'compensate') ?? null;
    if (!equal(item.apply, apply) || !equal(item.compensation, compensation) || compensation !== null && apply?.outcome.accepted !== true ||
        apply !== null && item.state !== (apply.outcome.accepted ? 'accepted' : 'rejected') ||
        apply === null && item.state !== (data.recoveryInvalidated ? 'suspended' : data.cancelled ? 'cancelled' : 'pending')) return false;
    for (const attempt of [apply,compensation]) if (attempt !== null) {
      if (attempt.actorId !== data.createdBy) return false;
      if (attempt.outcome.accepted) {
        const before = attempt.kind === 'apply' ? data.plan.items[index].source : apply.outcome.result.state;
        const desired = attempt.kind === 'apply' ? data.plan.items[index].proposedDigest : data.plan.items[index].source.specDigest;
        const changed = before.specDigest !== desired;
        if (attempt.outcome.result.state.revision !== before.revision + (changed ? 1 : 0) || attempt.outcome.result.accepted.status !== (changed ? 202 : 200)) return false;
      }
    }
  }
  const ids = new Set(data.attempts.flatMap(attempt => attempt.outcome.accepted && attempt.outcome.result.accepted.body.operationId !== null ? [attempt.outcome.result.accepted.body.operationId] : []));
  return data.operations.every(operation => object(operation, ['operationId','forwardId','targetRevision','status','cleanupPending','recoveryInvalidated']) && ids.has(operation.operationId) &&
    data.attempts.some(attempt => attempt.outcome.accepted && attempt.outcome.result.accepted.body.operationId === operation.operationId &&
      attempt.outcome.result.accepted.body.forwardId === operation.forwardId && attempt.outcome.result.accepted.body.revision === operation.targetRevision) &&
    id(operation.forwardId) && positive(operation.targetRevision) && ['accepted','running','succeeded','failed','superseded'].includes(operation.status) && bool(operation.cleanupPending) && bool(operation.recoveryInvalidated));
}

export function initPathPublications({ request, byId, notify, getScope, document = globalThis.document, confirm = globalThis.confirm, randomUUID = () => crypto.randomUUID() }) {
  const el = name => byId('path-publication-' + name), fields = ['group','group-revision','digest','candidate','items','batch'];
  let epoch = 0, page = 1, total = 0, preview = null, loaded = null, pending = null, sending = false;
  const controllers = new Set();
  const state = text => { el('state').textContent = text; };
  function controls() {
    for (const name of fields) el(name).disabled = Boolean(pending) || sending;
    for (const name of ['preview','read','list']) el(name).disabled = Boolean(pending) || sending;
    el('create').disabled = Boolean(pending) || sending || !preview;
    el('cancel').disabled = Boolean(pending) || sending || !loaded || loaded.cancelled || loaded.recoveryInvalidated || !loaded.items.some(item => item.state === 'pending');
    el('replay').disabled = !pending || sending;
    el('discard').disabled = sending;
    el('cancel-read').disabled = Boolean(pending) || sending || controllers.size === 0;
    el('prev').disabled = Boolean(pending) || sending || page <= 1;
    el('next').disabled = Boolean(pending) || sending || page >= Math.min(10000, Math.max(1, Math.ceil(total / 25)));
    for (const area of ['rows','list-rows']) for (const button of el(area).querySelectorAll('button')) button.disabled = Boolean(pending) || sending || button.dataset.epoch !== String(epoch) || button.dataset.unavailable === 'true';
  }
  async function call(method, resource, body, requestKey) {
    const controller = new AbortController(); controllers.add(controller); controls();
    const timer = setTimeout(() => controller.abort(), 5000);
    try { return await request(method, resource, body, requestKey, { signal: controller.signal, timeoutMs: 5000 }); }
    finally { clearTimeout(timer); controllers.delete(controller); controls(); }
  }
  function invalidate() {
    epoch++; for (const controller of controllers) controller.abort(); controllers.clear(); preview = null; loaded = null;
    el('preview-output').textContent = ''; el('record').textContent = ''; el('rows').replaceChildren(); controls();
  }
  function input() {
    const group = { groupId: el('group').value.trim(), revision: Number(el('group-revision').value), configDigest: el('digest').value.trim(), candidateId: el('candidate').value.trim() };
    if (!/^[1-9][0-9]*$/.test(el('group-revision').value) || !groupValid(group)) throw Error('请填入精确组 ID、修订、完整摘要和明确候选 ID；不使用 latest 或自动候选。');
    const items = el('items').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const values = line.split(/\s+/);
      if (values.length !== 2 || !id(values[0]) || !/^[1-9][0-9]*$/.test(values[1]) || !positive(Number(values[1]))) throw Error('每行需要 ForwardID 和当前 CAS 修订。');
      return { forwardId: values[0], expectedRevision: Number(values[1]) };
    });
    if (!items.length || items.length > 10 || new Set(items.map(item => item.forwardId)).size !== items.length) throw Error('一次明确选择一至十条不同 Forward，不自动展开全组。');
    return { schemaVersion: 1, group, items };
  }
  async function prepare() {
    if (pending || sending) return;
    invalidate(); const token = epoch;
    try {
      const draft = input(), data = await call('POST', 'path-publications/preview', clone(draft));
      if (token !== epoch) return;
      const plan = { schemaVersion: data.schemaVersion, group: data.group, items: data.items };
      if (!readFlags(data) || !equal(data.limits, limits) || !hash(data.previewDigest) || !await planValid(plan, draft) || await digest(plan) !== data.previewDigest ||
          data.interruption !== 'possible-same-listener-replacement' || data.tcp !== 'bounded-drain-or-authorization-deadline' || data.udp !== 'associations-may-reset-and-lose-datagrams') throw Error('持久发布预览的来源、精确选择、配置、摘要或安全边界无效。');
      if (token !== epoch) return;
      preview = clone({ input: draft, plan, previewDigest: data.previewDigest }); el('preview-output').textContent = JSON.stringify(data, null, 2); controls();
      state('服务器预览已固定，未预留资源或创建 Forward Operation。创建仅保存持久计划；以后每次手动推进一项。');
    } catch (error) { if (token === epoch) { invalidate(); state('预览不可用，旧提案已清除；未发送发布或切换命令。'); notify(error.message, true); } }
  }
  function button(cell, text, unavailable, callback, token) {
    const item = document.createElement('button'); item.type = 'button'; item.className = 'secondary'; item.textContent = text;
    item.dataset.epoch = String(token); item.dataset.unavailable = String(unavailable);
    item.addEventListener('click', () => { if (token === epoch && !pending && !sending && !item.disabled) return callback(); }); cell.append(item);
  }
  function renderBatch(data) {
    loaded = clone(data); const token = epoch;
    el('record').textContent = batchProgress(data).text + '\n\n持久批次 ' + data.batchId + ' / CAS r' + data.revision + '\ncreator=' + data.createdBy + ' / ' + data.createdAt +
      '\nplanDigest=' + data.planDigest + '\ncancelled=' + data.cancelled + ' / recoveryInvalidated=' + data.recoveryInvalidated +
      '\n每条 Forward 独立接受；Operation 接受不代表成功、健康或零停机。当前读不是全库快照。\n' + JSON.stringify({ group: data.plan.group, operations: data.operations }, null, 2);
    for (const item of data.items) {
      const frozen = data.plan.items[item.position - 1], row = document.createElement('tr');
      for (const text of [item.position + '. ' + frozen.source.forwardId + ' / 原 CAS r' + frozen.source.revision,
        item.state + '\napply=' + (item.apply ? item.apply.outcome.accepted ? '独立接受（不是已部署）' : '已持久记录拒绝' : '尚无尝试') + '\ncompensation=' + (item.compensation ? item.compensation.outcome.accepted ? '补偿已接受' : '补偿已拒绝' : '无'),
        JSON.stringify({ template: frozen.template, source: frozen.source, proposedSpec: frozen.proposedSpec, proposedDigest: frozen.proposedDigest }, null, 2),
        JSON.stringify({ apply: item.apply, compensation: item.compensation }, null, 2)]) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }
      const action = document.createElement('td');
      button(action, '仅推进这一项', data.recoveryInvalidated || data.cancelled || item.state !== 'pending' || item.apply !== null, () => step(item.position, 'apply'), token);
      button(action, '条件补偿这一项', data.recoveryInvalidated || item.apply?.outcome.accepted !== true || item.compensation !== null, () => step(item.position, 'compensate'), token);
      row.append(action); el('rows').append(row);
    }
    controls(); state('已读取持久状态；不会自动继续、重试或轮询。每个按钮只提交一个项目，提交后必须手动重读获得新 CAS。');
  }
  async function read() {
    if (pending || sending) return;
    invalidate(); const token = epoch;
    try {
      const batchId = el('batch').value.trim(); if (!id(batchId)) throw Error('需要持久批次 ID。');
      const data = await call('GET', 'path-publications/' + encodeURIComponent(batchId));
      if (token !== epoch) return;
      if (data.batchId !== batchId || !await batchValid(data)) throw Error('持久批次状态、回执、计划或摘要无效。');
      if (token !== epoch) return;
      renderBatch(data);
    } catch (error) { if (token === epoch) { invalidate(); state('批次读取失败，旧状态与操作已清除。未发现记录不证明先前写入未提交。'); notify(error.message, true); } }
  }
  async function list() {
    if (pending || sending) return;
    invalidate(); const token = epoch, requested = page; el('list-rows').replaceChildren(); el('page').textContent = '';
    try {
      const data = await call('GET', 'path-publications?page=' + requested + '&limit=25');
      if (token !== epoch) return;
      if (!readFlags(data) || data.page !== requested || data.limit !== 25 || !uint(data.total) || data.total > 64 || !Array.isArray(data.items) || data.items.length > 25 ||
          new Set(data.items.map(item => item.batchId)).size !== data.items.length || data.items.some(item => !headValid(item))) throw Error('有界持久批次列表无效。');
      total = data.total;
      for (const item of data.items) {
        const row = document.createElement('tr');
        for (const text of [item.batchId + ' / r' + item.revision, item.createdBy + '\n' + item.createdAt,
          'cancelled=' + item.cancelled + '\nrecoveryInvalidated=' + item.recoveryInvalidated + '\n' + item.planDigest]) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }
        const action = document.createElement('td'); button(action, '仅载入批次 ID', false, () => { invalidate(); el('batch').value = item.batchId; state('批次 ID 已载入；请手动读取，不会自动推进。'); }, token); row.append(action); el('list-rows').append(row);
      }
      if (!data.items.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 4; cell.textContent = '没有可见持久批次；不证明未知提交不存在。'; row.append(cell); el('list-rows').append(row); }
      el('page').textContent = '第 ' + requested + ' 页，共 ' + data.total + ' 个持久批次；不是全库快照。'; controls();
    } catch (error) { if (token === epoch) { total = 0; el('list-rows').replaceChildren(); el('page').textContent = '批次列表不可用，旧结果已清除。'; controls(); notify(error.message, true); } }
  }
  async function send(original, replay = false) {
    const token = epoch;
    if (sending || pending !== original) return;
    sending = true; controls(); state('正在发送唯一原命令；不会派发其他项目或自动重试。');
    try {
      const data = await call('POST', original.resource, clone(original.body), original.key);
      if (token !== epoch || pending !== original) return;
      if (original.kind === 'create') {
        if (!object(data, ['batchId','revision','planDigest','changed','reserved','executionAuthorized']) || !id(data.batchId) || data.revision !== 1 || data.planDigest !== original.body.previewDigest ||
            data.changed !== true || data.reserved !== false || data.executionAuthorized !== false) throw Error('创建回执无效；原命令可能已提交。');
      } else if (original.kind === 'cancel') {
        if (!object(data, ['batchId','revision','cancelled','changed']) || data.batchId !== original.batchId || !bool(data.changed) || data.cancelled !== true ||
            data.revision !== original.body.expectedRevision + (data.changed ? 1 : 0)) throw Error('取消回执无效；原命令可能已提交。');
      } else {
        const requestDigest = await digest({ method: 'POST', path: '/api/v1/scopes/' + original.scope + '/path-publications/' + original.batchId + '/items/' + original.position + '/' + original.kind, input: original.body });
        if (!object(data, ['batchId','revision','position','kind','attempt','atomicAcrossForwards']) || data.batchId !== original.batchId || data.revision !== original.body.expectedRevision + 1 ||
            data.position !== original.position || data.kind !== original.kind || data.atomicAcrossForwards !== false || !await attemptValid(data.attempt, original.plan) ||
            data.attempt.position !== original.position || data.attempt.kind !== original.kind || data.attempt.actorId !== original.createdBy ||
            data.attempt.requestKey !== original.key || data.attempt.requestDigest !== requestDigest)
          throw Error('逐项持久决策回执无效；原结果仍不确定。');
        if (data.attempt.outcome.accepted) {
          const desired = original.kind === 'apply' ? original.plan.items[original.position - 1].proposedDigest : original.plan.items[original.position - 1].source.specDigest;
          const changed = original.before.specDigest !== desired, result = data.attempt.outcome.result;
          if (result.state.revision !== original.before.revision + (changed ? 1 : 0) || result.accepted.status !== (changed ? 202 : 200))
            throw Error('原 Forward 接受的修订或 Operation 与固定状态不符，结果仍不确定。');
        }
      }
      if (token !== epoch || pending !== original) return;
      pending = null; sending = false; invalidate(); el('batch').value = data.batchId; el('record').textContent = JSON.stringify(data, null, 2); controls();
      state(original.kind === 'create' ? '持久计划已创建，尚未切换任何 Forward。请手动读取后逐项确认推进。' :
        original.kind === 'cancel' ? '已取消剩余未来 apply；已经接受的远程 Operation 不受影响。请手动重读；条件补偿仍须独立确认和授权。' :
          data.attempt.outcome.accepted ? '该项原 Forward 命令已独立接受，不是已部署或健康；请手动重读获取新 CAS，不会继续尾部。' :
            '该项拒绝已持久记录（HTTP 202 不代表 Forward 接受）。请查看 error 并手动重读；不会自动重试或继续尾部。');
    } catch (error) {
      if (token === epoch) { sending = false; if (!replay && initialRejection(error)) pending = null; controls(); state(pending ?
        '原结果不确定：仅可显式重放原键/body；不读取、不换 CAS、不重新预览。重放时的拒绝也不能证明原提交不存在。' :
        '初次命令被明确拒绝。未替换 CAS 或重试；请手动读取并重新准备。'); notify(error.message, true); }
    }
  }
  function create() {
    if (pending || sending || !preview) return;
    if (!confirm('仅创建这一份固定持久计划？不会提交 Forward、预留资源或自动派发。后续每项单独手动确认。')) return;
    const body = { ...clone(preview.input), previewDigest: preview.previewDigest }; invalidate();
    pending = { kind: 'create', resource: 'path-publications', body, key: randomUUID(), scope: getScope() }; return send(pending);
  }
  function step(position, kind) {
    if (pending || sending || !loaded || loaded.recoveryInvalidated) return;
    const item = loaded.items.find(entry => entry.position === position);
    if (!item || (kind === 'apply' ? loaded.cancelled || item.state !== 'pending' || item.apply !== null : item.apply?.outcome.accepted !== true || item.compensation !== null)) return;
    if (!confirm(kind === 'apply' ? '仅推进这一项？会重新授权并通过原 Forward CAS 接受；可能中断，TCP 有界排空，UDP 可能丢包。其他项不会自动继续。' :
      '仅条件补偿这一项？服务器必须重新授权旧路径，并核对精确接受后的完整 Forward 状态及组/原路径绑定序号。归档、撤权或人工修改可拒绝；补偿是新变更，不是回放 Snapshot 或无条件回滚。')) return;
    const original = { kind, batchId: loaded.batchId, position, plan: clone(loaded.plan), createdBy: loaded.createdBy,
      before: clone(kind === 'apply' ? loaded.plan.items[position - 1].source : item.apply.outcome.result.state),
      resource: 'path-publications/' + encodeURIComponent(loaded.batchId) + '/items/' + position + '/' + kind,
      body: { expectedRevision: loaded.revision }, key: randomUUID(), scope: getScope() }; invalidate(); pending = original; return send(pending);
  }
  function cancel() {
    if (pending || sending || !loaded || loaded.cancelled || loaded.recoveryInvalidated || !loaded.items.some(item => item.state === 'pending')) return;
    if (!confirm('仅取消该持久计划尚未提交的项目？不会终止已接受 Operation、现有连接或撤销远程执行；补偿须另行明确确认。')) return;
    const original = { kind: 'cancel', batchId: loaded.batchId, resource: 'path-publications/' + encodeURIComponent(loaded.batchId) + '/cancel',
      body: { expectedRevision: loaded.revision }, key: randomUUID(), scope: getScope() }; invalidate(); pending = original; return send(pending);
  }
  function clear() {
    pending = null; sending = false; invalidate(); page = 1; total = 0;
    for (const name of fields) el(name).value = '';
    el('list-rows').replaceChildren(); el('page').textContent = ''; controls();
    state('持久组发布：手动预览、创建计划、读取、一次推进一项。关闭或断开不取消远程计划，不自动恢复或重试。');
  }
  for (const name of fields) for (const event of ['input','change']) el(name).addEventListener(event, () => { if (!pending && !sending) { invalidate(); state('输入已改变，旧提案和执行按钮已清除；请手动预览或读取。'); } });
  el('preview').addEventListener('click', prepare); el('create').addEventListener('click', create); el('read').addEventListener('click', read); el('cancel').addEventListener('click', cancel);
  el('list').addEventListener('click', () => { page = 1; return list(); });
  for (const [name, direction] of [['prev',-1],['next',1]]) el(name).addEventListener('click', () => { if (!el(name).disabled) { page += direction; return list(); } });
  el('replay').addEventListener('click', () => { if (pending && !sending && confirm('仅重放完整原键/body 命令？不会换 CAS、重新预览、继续尾部或因当前拒绝推断原命令未提交。')) return send(pending, true); });
  el('cancel-read').addEventListener('click', () => { if (!pending && !sending) { invalidate(); state('已停止本地读取，不取消远程持久计划。'); } });
  el('discard').addEventListener('click', () => { if (!sending && (!pending || confirm('清除本地原键/body 记忆？原命令可能已提交，这不会取消远程计划或 Operation；清除后不会自动重发。'))) clear(); });
  clear(); return { clear };
}
