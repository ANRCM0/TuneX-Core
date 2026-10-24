import { batchProgress } from './task-workflow.js';
const id = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) && !/\s/.test(value);
const uint = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => uint(value) && value > 0;
const bounded = (value, max = 8) => positive(value) && value <= max;
const port = value => bounded(value, 65535);
const bool = value => typeof value === 'boolean';
const hash = value => typeof value === 'string' && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value);
const instant = value => typeof value === 'string' && Number.isSafeInteger(Date.parse(value)) && Date.parse(value) >= 0 && new Date(value).toISOString() === value;
const object = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(name => Object.hasOwn(value, name));
const clone = value => JSON.parse(JSON.stringify(value));
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ?
  '{' + Object.keys(value).sort().map(name => JSON.stringify(name) + ':' + canonical(value[name])).join(',') + '}' : JSON.stringify(value);
const equal = (a, b) => canonical(a) === canonical(b);
const limits = { batchesPerScope: 64, itemsPerBatch: 8, sourcesPerBatch: 8, attemptsPerItem: 2, maxPlanBytes: 131072, maxBatchRevision: 20 };
const rejections = ['REVISION_CONFLICT','AUTHORIZATION_DENIED','GROUP_ARCHIVED','TEMPLATE_ARCHIVED','RESOURCE_LIMIT','PORT_RESERVED',
  'UNSUPPORTED_CAPABILITY','REVISION_EXHAUSTED','PUBLICATION_STATE_CHANGED','NOT_FOUND','RESOURCE_CONFLICT'];
const initialRejection = error => [400,401,403,404,409,413,422,429].includes(error.httpStatus);
const readFlags = data => data.source === 'persisted-control-state' && data.reserved === false && data.executionAuthorized === false &&
  data.fullPlanAuthorization === false && data.health === 'unknown' && data.automaticExecution === false && data.atomicAcrossForwards === false && data.physicalConnectionSharing === false;
const pathValid = path => object(path, ['templateId','revision','configDigest']) && id(path.templateId) && bounded(path.revision, 64) && hash(path.configDigest);
const groupValid = group => object(group, ['groupId','revision','configDigest']) && id(group.groupId) && bounded(group.revision, 64) && hash(group.configDigest);
const originValid = ref => object(ref, ['kind','batchId','position','phase']) && ['deployment','migration'].includes(ref.kind) && id(ref.batchId) && bounded(ref.position) &&
  ['apply','compensate'].includes(ref.phase) && (ref.kind !== 'deployment' || ref.phase === 'apply');
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
  const ip = normalizeIp(value); if (ip) return ['0.0.0.0','::','::ffff:0.0.0.0'].includes(ip) ? null : ip;
  const host = value.toLowerCase().replace(/\.$/, '');
  return host.length <= 253 && !/^[0-9.]+$/.test(host) && host.split('.').every(label => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) ? host : null;
}
function specValid(spec) {
  return object(spec, ['enabled','protocols','ingress','target','path','transport']) && bool(spec.enabled) && Array.isArray(spec.protocols) && spec.protocols.length > 0 && spec.protocols.length <= 2 &&
    spec.protocols.every(protocol => ['tcp','udp'].includes(protocol)) && equal(spec.protocols, ['tcp','udp'].filter(protocol => spec.protocols.includes(protocol))) &&
    object(spec.ingress, ['nodeId','listen']) && id(spec.ingress.nodeId) && object(spec.ingress.listen, ['address','port']) && typeof spec.ingress.listen.address === 'string' &&
    normalizeIp(spec.ingress.listen.address) === spec.ingress.listen.address && port(spec.ingress.listen.port) && object(spec.target, ['host','port']) &&
    typeof spec.target.host === 'string' && normalizeHost(spec.target.host) === spec.target.host && port(spec.target.port) && object(spec.path, ['via']) && Array.isArray(spec.path.via) &&
    spec.path.via.length > 0 && spec.path.via.length <= 7 && spec.path.via.every(id) && new Set([spec.ingress.nodeId,...spec.path.via]).size === spec.path.via.length + 1 &&
    object(spec.transport, ['profileId','configRevision']) && id(spec.transport.profileId) && positive(spec.transport.configRevision);
}
function definitionValid(config) {
  return object(config, ['schemaVersion','members']) && config.schemaVersion === 1 && Array.isArray(config.members) && config.members.length > 0 && config.members.length <= 8 &&
    config.members.every(member => object(member, ['memberId','template']) && id(member.memberId) && pathValid(member.template)) &&
    new Set(config.members.map(member => member.memberId)).size === config.members.length && new Set(config.members.map(member => member.template.configDigest)).size === config.members.length;
}
const pathOf = state => ({ templateId: state.path.templateId, revision: state.path.revision, configDigest: state.path.configDigest });
const groupOf = state => ({ groupId: state.group.groupId, revision: state.group.revision, configDigest: state.group.configDigest, candidateId: state.group.candidateId });
async function stateValid(state) {
  if (!object(state, ['forwardId','revision','spec','specDigest','path','group']) || !id(state.forwardId) || !positive(state.revision) || !specValid(state.spec) || !hash(state.specDigest) ||
      !object(state.path, ['templateId','revision','configDigest','sequence','forwardRevision']) || !pathValid(pathOf(state)) || !bounded(state.path.sequence, 64) ||
      !positive(state.path.forwardRevision) || state.path.forwardRevision > state.revision) return false;
  if (state.group !== null && (!object(state.group, ['groupId','revision','configDigest','candidateId','sequence','pathBindingSequence','forwardRevision']) ||
      !id(state.group.groupId) || !bounded(state.group.revision, 64) || !hash(state.group.configDigest) || !id(state.group.candidateId) || !bounded(state.group.sequence, 64) ||
      state.group.pathBindingSequence !== state.path.sequence || !positive(state.group.forwardRevision) || state.group.forwardRevision > state.revision)) return false;
  return await digest(state.spec) === state.specDigest;
}
async function planValid(plan, input) {
  if (!object(plan, ['schemaVersion','sourceGroup','targetGroup','sourceDefinition','targetDefinition','sources','changes','items']) || plan.schemaVersion !== 1 ||
      !groupValid(plan.sourceGroup) || !groupValid(plan.targetGroup) || plan.sourceGroup.groupId !== plan.targetGroup.groupId || plan.sourceGroup.revision === plan.targetGroup.revision ||
      !definitionValid(plan.sourceDefinition) || !definitionValid(plan.targetDefinition) || await digest(plan.sourceDefinition) !== plan.sourceGroup.configDigest ||
      await digest(plan.targetDefinition) !== plan.targetGroup.configDigest || !Array.isArray(plan.sources) || !plan.sources.length || plan.sources.length > 8 ||
      !Array.isArray(plan.items) || !plan.items.length || plan.items.length > 8 || new TextEncoder().encode(JSON.stringify(plan)).byteLength > limits.maxPlanBytes ||
      input && (!equal(plan.sourceGroup, input.sourceGroup) || !equal(plan.targetGroup, input.targetGroup) || plan.sources.length !== input.sources.length || plan.items.length !== input.items.length)) return false;
  const members = [...new Set([...plan.sourceDefinition.members,...plan.targetDefinition.members].map(member => member.memberId))].sort();
  if (!Array.isArray(plan.changes) || plan.changes.length !== members.length || plan.changes.length > 16) return false;
  for (const [index, change] of plan.changes.entries()) {
    const before = plan.sourceDefinition.members.find(member => member.memberId === change.memberId), after = plan.targetDefinition.members.find(member => member.memberId === change.memberId);
    if (!object(change, ['memberId','kind','sourceTemplate','targetTemplate','sourceIngress','targetIngress']) || change.memberId !== members[index] ||
        !equal(change.sourceTemplate, before?.template ?? null) || !equal(change.targetTemplate, after?.template ?? null) ||
        (before ? !id(change.sourceIngress) : change.sourceIngress !== null) || (after ? !id(change.targetIngress) : change.targetIngress !== null)) return false;
    const kind = !before ? 'added' : !after ? 'removed' : change.sourceIngress !== change.targetIngress ? 'ingress-changed' : equal(before.template, after.template) ? 'unchanged' : 'reference-changed';
    if (change.kind !== kind || before && after && equal(before.template, after.template) && change.sourceIngress !== change.targetIngress) return false;
  }
  for (const field of ['sourceIngress','targetIngress']) { const values = plan.changes.map(change => change[field]).filter(value => value !== null); if (new Set(values).size !== values.length) return false; }
  const refs = new Set(), forwardIds = new Set(), sourceMembers = new Set();
  for (const [index, source] of plan.sources.entries()) {
    if (!object(source, ['ref','group','memberId','template','state']) || !originValid(source.ref) || !equal(source.group, plan.sourceGroup) || !id(source.memberId) || !pathValid(source.template) ||
        !await stateValid(source.state) || !equal(pathOf(source.state), source.template) || refs.has(canonical(source.ref)) || forwardIds.has(source.state.forwardId) || sourceMembers.has(source.memberId) ||
        !equal(plan.sourceDefinition.members.find(member => member.memberId === source.memberId)?.template, source.template) ||
        plan.changes.find(change => change.memberId === source.memberId)?.sourceIngress !== source.state.spec.ingress.nodeId ||
        index > 0 && !equal(source.state.spec.protocols, plan.sources[0].state.spec.protocols) || input && !equal(source.ref, input.sources[index])) return false;
    refs.add(canonical(source.ref)); forwardIds.add(source.state.forwardId); sourceMembers.add(source.memberId);
  }
  const usedSources = new Set(), targets = new Set(); let targetProtocols = null;
  for (const [index, row] of plan.items.entries()) {
    if (!object(row, ['position','kind','memberId','source','template','spec','specDigest']) || row.position !== index + 1 || !['add','update','remove'].includes(row.kind) || !id(row.memberId)) return false;
    const requested = input?.items[index];
    if (requested && requested.kind !== row.kind) return false;
    if (row.kind === 'add' ? row.source !== null : !bounded(row.source, plan.sources.length) || usedSources.has(row.source) || plan.sources[row.source - 1].memberId !== row.memberId) return false;
    if (row.kind !== 'add') { usedSources.add(row.source); if (requested && requested.source !== row.source) return false; }
    if (row.kind === 'remove') { if (row.template !== null || row.spec !== null || row.specDigest !== null) return false; continue; }
    if (targets.has(row.memberId) || !pathValid(row.template) || !specValid(row.spec) || !hash(row.specDigest) || await digest(row.spec) !== row.specDigest ||
        !equal(plan.targetDefinition.members.find(member => member.memberId === row.memberId)?.template, row.template) ||
        plan.changes.find(change => change.memberId === row.memberId)?.targetIngress !== row.spec.ingress.nodeId || requested && requested.memberId !== row.memberId ||
        targetProtocols !== null && !equal(row.spec.protocols, targetProtocols)) return false;
    targets.add(row.memberId); targetProtocols = row.spec.protocols;
    if (row.kind === 'update') {
      const before = plan.sources[row.source - 1].state.spec;
      if (!equal({ ...before, path: row.spec.path, transport: row.spec.transport }, row.spec)) return false;
    } else {
      if (requested && (row.spec.enabled !== requested.enabled || !equal(row.spec.ingress.listen, requested.listen) || !equal(row.spec.target, requested.target))) return false;
      const oldIndex = plan.sources.findIndex(source => source.memberId === row.memberId);
      if (oldIndex >= 0 && !plan.items.some(item => item.kind === 'remove' && item.source === oldIndex + 1)) return false;
    }
  }
  return true;
}
async function attemptValid(attempt, plan, applied = null) {
  if (!object(attempt, ['position','kind','actorId','createdAt','requestKey','requestDigest','outcome']) || !bounded(attempt.position, plan.items.length) ||
      !['apply','compensate'].includes(attempt.kind) || !id(attempt.actorId) || !instant(attempt.createdAt) || typeof attempt.requestKey !== 'string' || !attempt.requestKey.length ||
      attempt.requestKey.length > 128 || /[^\x21-\x7e]/.test(attempt.requestKey) || !hash(attempt.requestDigest)) return false;
  const row = plan.items[attempt.position - 1], outcome = attempt.outcome;
  if (attempt.kind === 'compensate' && (row.kind === 'remove' || applied?.outcome.accepted !== true)) return false;
  if (object(outcome, ['accepted','error']) && outcome.accepted === false) return object(outcome.error, ['code','status']) && rejections.includes(outcome.error.code) && [403,404,409,422,429].includes(outcome.error.status);
  const deleting = attempt.kind === 'apply' ? row.kind === 'remove' : row.kind === 'add';
  if (!object(outcome, ['accepted','result']) || outcome.accepted !== true || !object(outcome.result, deleting ? ['accepted','state','deleting'] : ['accepted','state'])) return false;
  const result = outcome.result, state = result.state, receipt = result.accepted, body = receipt?.body;
  if (!await stateValid(state) || !object(receipt, ['status','body']) || ![200,202].includes(receipt.status) || !body ||
      Object.keys(body).some(name => !['forwardId','revision','operationId','pathBinding','pathGroupBinding'].includes(name)) || body.forwardId !== state.forwardId || body.revision !== state.revision ||
      !(body.operationId === null || id(body.operationId)) || (receipt.status === 202) !== (body.operationId !== null)) return false;
  const source = row.source === null ? null : plan.sources[row.source - 1].state;
  const before = attempt.kind === 'compensate' ? applied.outcome.result.state : source;
  if (deleting) return object(body, ['forwardId','revision','operationId']) && receipt.status === 202 && result.deleting === true && before !== null &&
    equal(state, { ...before, revision: before.revision + 1 }) && (attempt.kind !== 'compensate' || body.operationId !== applied.outcome.result.accepted.body.operationId);
  if (attempt.kind === 'apply' && row.kind === 'add') {
    if (receipt.status !== 202 || state.revision !== 1 || state.path.sequence !== 1 || state.path.forwardRevision !== 1 || state.group !== null ||
        plan.sources.some(origin => origin.state.forwardId === state.forwardId)) return false;
  } else {
    const desired = attempt.kind === 'compensate' ? source.specDigest : row.specDigest, changed = before.specDigest !== desired;
    if (state.forwardId !== before.forwardId || state.revision !== before.revision + (changed ? 1 : 0) || receipt.status !== (changed ? 202 : 200)) return false;
  }
  for (const [bodyName, stateName] of [['pathBinding','path'],['pathGroupBinding','group']]) {
    if ((state[stateName] !== null) !== Object.hasOwn(body, bodyName)) return false;
    if (state[stateName] !== null && (!body[bodyName] || !bool(body[bodyName].changed) || !equal(body[bodyName], { ...state[stateName], changed: body[bodyName].changed }))) return false;
  }
  if (attempt.kind === 'apply') return state.group === null && equal(state.spec, row.spec) && equal(pathOf(state), row.template) &&
    (row.kind !== 'add' || body.pathBinding.changed === true);
  return equal(state.spec, source.spec) && equal(pathOf(state), pathOf(source)) && (state.group === null) === (source.group === null) &&
    (state.group === null || equal(groupOf(state), groupOf(source)));
}
const headValid = data => id(data.batchId) && bounded(data.revision, 20) && id(data.createdBy) && instant(data.createdAt) && hash(data.planDigest) && bool(data.cancelled) && bool(data.recoveryInvalidated);
async function batchValid(data) {
  if (!readFlags(data) || !headValid(data) || data.impactScope !== 'selected-origins-not-global-membership' || data.removeCompensation !== false ||
      data.consistency !== 'read-committed-not-global-snapshot' || !await planValid(data.plan) || await digest(data.plan) !== data.planDigest ||
      !Array.isArray(data.attempts) || data.attempts.length > data.plan.items.length * 2 || !Array.isArray(data.items) || data.items.length !== data.plan.items.length ||
      data.revision !== 1 + data.attempts.length + Number(data.cancelled) + Number(data.recoveryInvalidated) || !Array.isArray(data.operations) || data.operations.length > data.attempts.length ||
      new Set(data.attempts.map(attempt => attempt.position + ':' + attempt.kind)).size !== data.attempts.length || new Set(data.operations.map(operation => operation.operationId)).size !== data.operations.length) return false;
  const additions = new Set();
  for (const [index, item] of data.items.entries()) {
    const row = data.plan.items[index];
    if (!object(item, ['position','action','state','apply','compensation','compensatable']) || item.position !== index + 1 || item.action !== row.kind || item.compensatable !== (row.kind !== 'remove')) return false;
    const apply = data.attempts.find(attempt => attempt.position === item.position && attempt.kind === 'apply') ?? null;
    const compensation = data.attempts.find(attempt => attempt.position === item.position && attempt.kind === 'compensate') ?? null;
    if (!equal(item.apply, apply) || !equal(item.compensation, compensation) || compensation && (apply?.outcome.accepted !== true || row.kind === 'remove') ||
        item.state !== (apply ? apply.outcome.accepted ? 'accepted' : 'rejected' : data.recoveryInvalidated ? 'suspended' : data.cancelled ? 'cancelled' : 'pending')) return false;
    if (apply && (!await attemptValid(apply, data.plan) || apply.actorId !== data.createdBy)) return false;
    if (compensation && (!await attemptValid(compensation, data.plan, apply) || compensation.actorId !== data.createdBy)) return false;
    if (row.kind === 'add' && apply?.outcome.accepted) { const forward = apply.outcome.result.state.forwardId; if (additions.has(forward)) return false; additions.add(forward); }
  }
  return data.attempts.every(attempt => bounded(attempt.position, data.items.length) && ['apply','compensate'].includes(attempt.kind)) &&
    data.operations.every(operation => object(operation, ['operationId','forwardId','targetRevision','status','cleanupPending','recoveryInvalidated']) &&
      ['accepted','running','succeeded','failed','superseded'].includes(operation.status) && bool(operation.cleanupPending) && bool(operation.recoveryInvalidated) &&
      data.attempts.some(attempt => attempt.outcome.accepted && attempt.outcome.result.accepted.body.operationId === operation.operationId &&
        attempt.outcome.result.accepted.body.forwardId === operation.forwardId && attempt.outcome.result.accepted.body.revision === operation.targetRevision));
}

export function initIngressMigrations({ request, byId, notify, getScope, document = globalThis.document, confirm = globalThis.confirm, randomUUID = () => crypto.randomUUID() }) {
  const el = name => byId('ingress-migration-' + name), fields = ['group','source-revision','source-digest','target-revision','target-digest','sources','actions','batch','list-group'];
  let epoch = 0, page = 1, total = 0, preview = null, loaded = null, pending = null, sending = false;
  const controllers = new Set();
  const state = text => { el('state').textContent = text; };
  function controls() {
    for (const name of fields) el(name).disabled = Boolean(pending) || sending;
    for (const name of ['preview','read','list']) el(name).disabled = Boolean(pending) || sending;
    el('create').disabled = Boolean(pending) || sending || !preview;
    el('cancel').disabled = Boolean(pending) || sending || !loaded || loaded.cancelled || loaded.recoveryInvalidated || !loaded.items.some(item => item.state === 'pending');
    el('replay').disabled = !pending || sending; el('clear').disabled = sending; el('cancel-read').disabled = Boolean(pending) || sending || controllers.size === 0;
    el('prev').disabled = Boolean(pending) || sending || page <= 1;
    el('next').disabled = Boolean(pending) || sending || page >= Math.min(10000, Math.max(1, Math.ceil(total / 25)));
    for (const area of ['rows','list-rows']) for (const button of el(area).querySelectorAll('button')) button.disabled = Boolean(pending) || sending || button.dataset.epoch !== String(epoch) || button.dataset.unavailable === 'true';
  }
  async function call(method, resource, body, requestKey) {
    const controller = new AbortController(); controllers.add(controller); controls(); const timer = setTimeout(() => controller.abort(), 5000);
    try { return await request(method, resource, body, requestKey, { signal: controller.signal, timeoutMs: 5000 }); }
    finally { clearTimeout(timer); controllers.delete(controller); controls(); }
  }
  function invalidate() {
    epoch++; for (const controller of controllers) controller.abort(); controllers.clear(); preview = null; loaded = null;
    el('preview-output').textContent = ''; el('record').textContent = ''; el('changes').replaceChildren(); el('rows').replaceChildren(); controls();
  }
  function button(cell, text, unavailable, action, token) {
    const item = document.createElement('button'); item.type = 'button'; item.className = 'secondary'; item.textContent = text; item.dataset.epoch = String(token); item.dataset.unavailable = String(unavailable);
    item.addEventListener('click', () => { if (token === epoch && !pending && !sending && !item.disabled) return action(); }); cell.append(item);
  }
  function input() {
    const groupId = el('group').value.trim(), sourceGroup = { groupId, revision: Number(el('source-revision').value), configDigest: el('source-digest').value.trim() },
      targetGroup = { groupId, revision: Number(el('target-revision').value), configDigest: el('target-digest').value.trim() };
    if (!/^[1-9][0-9]*$/.test(el('source-revision').value) || !/^[1-9][0-9]*$/.test(el('target-revision').value) || !groupValid(sourceGroup) || !groupValid(targetGroup) || sourceGroup.revision === targetGroup.revision)
      throw Error('需要同一入口组的两个不同精确修订和各自摘要，不使用 latest。');
    const sources = el('sources').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const values = line.split(/\s+/), ref = { kind: values[0], batchId: values[1], position: Number(values[2]), phase: values[3] };
      if (values.length !== 4 || !/^[1-9][0-9]*$/.test(values[2]) || !originValid(ref)) throw Error('来源每行：deployment|migration 批次ID 位置 apply|compensate；deployment 仅 apply。');
      return ref;
    });
    if (!sources.length || sources.length > 8 || new Set(sources.map(canonical)).size !== sources.length) throw Error('需要一至八个不同的精确历史来源。');
    const used = new Set(), members = new Set();
    const items = el('actions').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const values = line.split(/\s+/), kind = values[0];
      if (kind === 'add') {
        const address = normalizeIp(values[2]), host = normalizeHost(values[4]);
        if (values.length !== 7 || !id(values[1]) || members.has(values[1]) || !address || !/^[1-9][0-9]*$/.test(values[3]) || !port(Number(values[3])) ||
            !host || !/^[1-9][0-9]*$/.test(values[5]) || !port(Number(values[5])) || !['true','false'].includes(values[6])) throw Error('add 每行：add memberID 监听IP 端口 目标Host 端口 true|false；目标成员不能重复。');
        members.add(values[1]); return { kind, memberId: values[1], listen: { address, port: Number(values[3]) }, target: { host, port: Number(values[5]) }, enabled: values[6] === 'true' };
      }
      if (!['update','remove'].includes(kind) || values.length !== (kind === 'update' ? 3 : 2) || !/^[1-9][0-9]*$/.test(values[1]) || !bounded(Number(values[1]), sources.length) || used.has(Number(values[1])))
        throw Error('update 来源行号 memberID / remove 来源行号；每个来源最多使用一次。');
      const source = Number(values[1]); used.add(source);
      if (kind === 'remove') return { kind, source };
      if (!id(values[2]) || members.has(values[2])) throw Error('目标成员必须有效且不能重复。');
      members.add(values[2]); return { kind, source, memberId: values[2] };
    });
    if (!items.length || items.length > 8) throw Error('add/update/remove 合计只能一至八项，不自动展开差异。');
    return { schemaVersion: 1, sourceGroup, targetGroup, sources, items };
  }
  function renderChanges(plan) {
    el('changes').replaceChildren();
    for (const change of plan.changes) {
      const row = document.createElement('tr'); for (const text of [change.memberId,change.kind,JSON.stringify({ template: change.sourceTemplate, ingress: change.sourceIngress }, null, 2),
        JSON.stringify({ template: change.targetTemplate, ingress: change.targetIngress }, null, 2)]) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); } el('changes').append(row);
    }
  }
  async function prepare() {
    if (pending || sending) return;
    invalidate(); const token = epoch;
    try {
      const draft = input(), data = await call('POST', 'ingress-migrations/preview', clone(draft)); if (token !== epoch) return;
      const plan = { schemaVersion: data.schemaVersion, sourceGroup: data.sourceGroup, targetGroup: data.targetGroup, sourceDefinition: data.sourceDefinition,
        targetDefinition: data.targetDefinition, sources: data.sources, changes: data.changes, items: data.items };
      if (!readFlags(data) || !equal(data.limits, limits) || data.impactScope !== 'selected-origins-not-global-membership' || data.interruption !== 'explicit-independent-rule-actions' ||
          data.removeCompensation !== false || !hash(data.previewDigest) || !await planValid(plan, draft) || await digest(plan) !== data.previewDigest) throw Error('迁移预览的历史来源、当前基线、动作边界、差异或摘要无效。');
      if (token !== epoch) return;
      preview = clone({ input: draft, plan, previewDigest: data.previewDigest }); renderChanges(plan); el('preview-output').textContent = JSON.stringify(data, null, 2); controls();
      state('已确认所选历史来源与服务器检查时的基线并固定预览；不是当前成员全量，不预留资源。保存计划不会执行增改删。remove 不可补偿。');
    } catch (error) { if (token === epoch) { invalidate(); state('迁移预览不可用，旧结果已清除；没有发送增改删意图。'); notify(error.message, true); } }
  }
  function renderBatch(data) {
    loaded = clone(data); const token = epoch; renderChanges(data.plan);
    el('record').textContent = batchProgress(data).text + '\n\n入口迁移 ' + data.batchId + ' / CAS r' + data.revision + '\n创建者 ' + data.createdBy + ' / ' + data.createdAt + '\nplanDigest=' + data.planDigest +
      '\ncancelled=' + data.cancelled + ' / recoveryInvalidated=' + data.recoveryInvalidated + '\n历史来源与定义差异不是全局当前成员状态；接受也不是已生效或健康。\n' +
      JSON.stringify({ sourceGroup: data.plan.sourceGroup, targetGroup: data.plan.targetGroup, sources: data.plan.sources, operations: data.operations }, null, 2);
    for (const item of data.items) {
      const row = data.plan.items[item.position - 1], tableRow = document.createElement('tr');
      for (const text of [row.position + '. ' + row.kind + ' / ' + row.memberId + '\nsource=' + (row.source ?? '新建，无既有 Forward ID'),
        item.state + '\napply=' + (item.apply ? item.apply.outcome.accepted ? '原命令已独立接受' : '拒绝已持久记录' : '无尝试') + '\ncompensation=' +
          (row.kind === 'remove' ? '不可补偿，不复活' : item.compensation ? item.compensation.outcome.accepted ? '补偿接受' : '补偿拒绝' : '无'),
        JSON.stringify({ item: row, baseline: row.source === null ? null : data.plan.sources[row.source - 1] }, null, 2), JSON.stringify({ apply: item.apply, compensation: item.compensation }, null, 2)]) {
        const cell = document.createElement('td'); cell.textContent = text; tableRow.append(cell);
      }
      const cell = document.createElement('td'); button(cell, row.kind === 'remove' ? '明确删除这一项（不可补偿）' : '仅应用这一项 ' + row.kind,
        data.cancelled || data.recoveryInvalidated || item.state !== 'pending' || item.apply !== null, () => step(item.position, 'apply'), token);
      if (row.kind !== 'remove') button(cell, row.kind === 'add' ? '条件删除本项新建规则' : '条件恢复本项原配置',
        data.recoveryInvalidated || item.apply?.outcome.accepted !== true || item.compensation !== null, () => step(item.position, 'compensate'), token);
      tableRow.append(cell); el('rows').append(tableRow);
    }
    controls(); state('持久状态已读取；每次确认仅应用一项，写后必须手动重读新 CAS。没有 worker、轮询、自动恢复或尾部派发。');
  }
  async function read() {
    if (pending || sending) return;
    invalidate(); const token = epoch;
    try {
      const batchId = el('batch').value.trim(); if (!id(batchId)) throw Error('需要持久迁移批次 ID。');
      const data = await call('GET', 'ingress-migrations/' + encodeURIComponent(batchId)); if (token !== epoch) return;
      if (data.batchId !== batchId || !await batchValid(data)) throw Error('迁移计划、决策、来源或 Operation 映射无效。');
      if (token !== epoch) return; renderBatch(data);
    } catch (error) { if (token === epoch) { invalidate(); state('迁移读取失败，旧动作已清除；缺少记录不能证明未知写入未提交。'); notify(error.message, true); } }
  }
  async function list() {
    if (pending || sending) return;
    invalidate(); const token = epoch, requested = page; el('list-rows').replaceChildren(); el('page').textContent = '';
    try {
      const groupId = el('list-group').value.trim(); if (groupId !== '' && !id(groupId)) throw Error('迁移列表的组 ID 筛选无效。');
      const data = await call('GET', 'ingress-migrations?page=' + requested + '&limit=25' + (groupId ? '&groupId=' + encodeURIComponent(groupId) : ''));
      if (token !== epoch) return;
      if (!readFlags(data) || data.page !== requested || data.limit !== 25 || !uint(data.total) || data.total > 64 || !Array.isArray(data.items) || data.items.length > 25 ||
          new Set(data.items.map(item => item.batchId)).size !== data.items.length || data.items.some(item => !headValid(item))) throw Error('有界迁移列表无效。');
      total = data.total;
      for (const head of data.items) {
        const row = document.createElement('tr'); for (const text of [head.batchId + ' / r' + head.revision,head.createdBy + '\n' + head.createdAt,
          'cancelled=' + head.cancelled + '\nrecoveryInvalidated=' + head.recoveryInvalidated + '\n' + head.planDigest]) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }
        const cell = document.createElement('td'); button(cell, '仅载入迁移 ID', false, () => { invalidate(); el('batch').value = head.batchId; state('迁移 ID 已载入，请手动读取；不会自动继续。'); }, token); row.append(cell); el('list-rows').append(row);
      }
      if (!data.items.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 4; cell.textContent = '无可见迁移；不证明未知提交不存在。'; row.append(cell); el('list-rows').append(row); }
      el('page').textContent = '第 ' + requested + ' 页，共 ' + data.total + ' 个持久迁移；不是全库快照。'; controls();
    } catch (error) { if (token === epoch) { total = 0; el('list-rows').replaceChildren(); el('page').textContent = '迁移列表不可用，旧结果已清除。'; controls(); notify(error.message, true); } }
  }
  async function send(original, replay = false) {
    if (sending || pending !== original) return;
    const token = epoch; sending = true; controls(); state('正在提交唯一原迁移命令，不继续其他项目。');
    try {
      const data = await call('POST', original.resource, clone(original.body), original.key); if (token !== epoch || pending !== original) return;
      if (original.kind === 'plan') {
        if (!object(data, ['batchId','revision','planDigest','changed','reserved','executionAuthorized']) || !id(data.batchId) || data.revision !== 1 || data.planDigest !== original.body.previewDigest ||
            data.changed !== true || data.reserved !== false || data.executionAuthorized !== false) throw Error('迁移计划回执无效，原提交仍不确定。');
      } else if (original.kind === 'cancel') {
        if (!object(data, ['batchId','revision','cancelled','changed']) || data.batchId !== original.batchId || data.cancelled !== true || !bool(data.changed) ||
            data.revision !== original.body.expectedRevision + (data.changed ? 1 : 0)) throw Error('取消迁移回执无效，原提交仍不确定。');
      } else {
        const requestDigest = await digest({ method: 'POST', path: '/api/v1/scopes/' + original.scope + '/ingress-migrations/' + original.batchId + '/items/' + original.position + '/' + original.kind, input: original.body });
        if (!object(data, ['batchId','revision','position','kind','attempt','atomicAcrossForwards']) || data.batchId !== original.batchId || data.revision !== original.body.expectedRevision + 1 ||
            data.position !== original.position || data.kind !== original.kind || data.atomicAcrossForwards !== false || !await attemptValid(data.attempt, original.plan, original.applied) ||
            data.attempt.position !== original.position || data.attempt.kind !== original.kind || data.attempt.actorId !== original.createdBy || data.attempt.requestKey !== original.key || data.attempt.requestDigest !== requestDigest)
          throw Error('迁移逐项决策回执无效，原增改删可能已提交。');
      }
      if (token !== epoch || pending !== original) return;
      pending = null; sending = false; invalidate(); el('batch').value = data.batchId; el('record').textContent = JSON.stringify(data, null, 2); controls();
      state(original.kind === 'plan' ? '迁移计划已保存，没有执行增改删。请手动读取后一次确认一项。' : original.kind === 'cancel' ?
        '仅取消未来 apply；已接受 Operation 不受影响，remove 仍不可补偿。请手动重读。' : data.attempt.outcome.accepted ?
          '原所有者命令已独立接受，不代表部署成功或健康；请手动重读新 CAS，不自动继续。' : '该项拒绝已持久记录；HTTP 202 不代表 Forward 接受。请手动重读，不自动重试。');
    } catch (error) { if (token === epoch) { sending = false; if (!replay && initialRejection(error)) pending = null; controls(); state(pending ?
      '原结果不确定，仅允许原键/body 显式重放。不能换来源、动作、候选或 CAS；重放拒绝也不能证明原提交不存在。' :
      '初次命令已明确拒绝；没有换 CAS、重试或继续尾部。请手动重读或重新预览。'); notify(error.message, true); } }
  }
  function createPlan() {
    if (pending || sending || !preview) return;
    if (!confirm('仅保存这份固定迁移计划？不会执行增改删、分配新 Forward ID 或预留资源。remove 是不可补偿删除，后续仍须逐项确认。')) return;
    const body = { ...clone(preview.input), previewDigest: preview.previewDigest }; invalidate();
    pending = { kind: 'plan', resource: 'ingress-migrations', body, key: randomUUID(), scope: getScope() }; return send(pending);
  }
  function step(position, kind) {
    if (pending || sending || !loaded || loaded.recoveryInvalidated) return;
    const item = loaded.items.find(entry => entry.position === position), row = loaded.plan.items[position - 1];
    if (!item || !row || (kind === 'apply' ? loaded.cancelled || item.state !== 'pending' || item.apply !== null : row.kind === 'remove' || item.apply?.outcome.accepted !== true || item.compensation !== null)) return;
    const warning = kind === 'compensate' ? row.kind === 'add' ? '仅条件删除本项新建规则？须核对完整接受状态与来源序号、重新授权；不是无条件回滚。' :
      '仅条件恢复本项原业务配置与路径来源？必须重新授权旧引用并核对完整接受状态；归档、撤权或人工修改可拒绝。新 Operation/来源不得靠复用旧 Snapshot 获权。' :
      row.kind === 'remove' ? '明确删除这一项？这是不可补偿操作，不提供复活。服务器仍须核对精确来源当前基线和当前权限；原 DELETE 不保证立即释放端口或停止连接。' :
        '仅应用这一项 ' + row.kind + '？会重新核对原授权、状态和资源；可能中断、TCP 有界排空、UDP 丢包。其他项目不会继续。';
    if (!confirm(warning)) return;
    const original = { kind, batchId: loaded.batchId, position, plan: clone(loaded.plan), createdBy: loaded.createdBy,
      applied: kind === 'compensate' ? clone(item.apply) : null, resource: 'ingress-migrations/' + encodeURIComponent(loaded.batchId) + '/items/' + position + '/' + kind,
      body: { expectedRevision: loaded.revision }, key: randomUUID(), scope: getScope() }; invalidate(); pending = original; return send(pending);
  }
  function cancel() {
    if (pending || sending || !loaded || loaded.cancelled || loaded.recoveryInvalidated || !loaded.items.some(item => item.state === 'pending')) return;
    if (!confirm('仅取消剩余未来 apply？不取消远程 Operation、不回滚已接受增改删，也不让 remove 变得可补偿。')) return;
    const original = { kind: 'cancel', batchId: loaded.batchId, resource: 'ingress-migrations/' + encodeURIComponent(loaded.batchId) + '/cancel', body: { expectedRevision: loaded.revision }, key: randomUUID(), scope: getScope() };
    invalidate(); pending = original; return send(pending);
  }
  function clear() {
    pending = null; sending = false; invalidate(); page = 1; total = 0; for (const name of fields) el(name).value = '';
    el('list-rows').replaceChildren(); el('page').textContent = ''; controls(); state('明确历史来源、精确组修订和总计最多八个动作；只手动逐项迁移。历史回执不等于当前成员绑定。');
  }
  for (const name of fields) for (const event of ['input','change']) el(name).addEventListener(event, () => {
    if (pending || sending) return; invalidate();
    if (name === 'list-group') { page = 1; total = 0; el('list-rows').replaceChildren(); el('page').textContent = ''; }
    controls(); state('输入已改变，旧差异/预览/动作已清除；请手动读取或预览，不自动发请求。');
  });
  el('preview').addEventListener('click', prepare); el('create').addEventListener('click', createPlan); el('read').addEventListener('click', read); el('cancel').addEventListener('click', cancel);
  el('list').addEventListener('click', () => { page = 1; return list(); });
  for (const [name, direction] of [['prev',-1],['next',1]]) el(name).addEventListener('click', () => { if (!el(name).disabled) { page += direction; return list(); } });
  el('replay').addEventListener('click', () => { if (pending && !sending && confirm('只重放原键/body？不重新预览、不换 CAS 或动作、不继续尾部；当前拒绝不能否定原提交。')) return send(pending, true); });
  el('cancel-read').addEventListener('click', () => { if (!pending && !sending) { invalidate(); state('本地读取已取消，不取消远程迁移或已接受 Operation。'); } });
  el('clear').addEventListener('click', () => { if (!sending && (!pending || confirm('清除本地原命令记忆？原命令可能已提交，这不会取消远程计划、回滚规则或复活已删除项。'))) clear(); });
  clear(); return { clear };
}
