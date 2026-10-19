const limits = { plansPerScope:32, decisionsPerPlan:16, maxLifetimeMs:3600000, retentionMs:604800000,
  minIntervalSeconds:30, maxIntervalSeconds:3600, defaultPageSize:25, maxPageSize:50,
  maxPlanBytes:4096, maxDecisionBytes:2048, maxResponseBytes:262144 };
const states = ['active','completed','cancelled','expired','suspended'];
const rejections = ['PROBE_DISABLED','PROBE_UNAVAILABLE','PROBE_PERMIT_UNAVAILABLE','PROBE_PERMIT_LIMIT',
  'AUTHORIZATION_DENIED','NOT_FOUND','REVISION_CONFLICT','UNSUPPORTED_CAPABILITY','SESSION_SUPERSEDED'];
const transient = ['PROBE_UNAVAILABLE','PROBE_PERMIT_UNAVAILABLE','PROBE_PERMIT_LIMIT','SESSION_SUPERSEDED'];
const codes = ['PERMIT_ACCEPTED','PLAN_CANCELLED','PLAN_EXPIRED','AUTHORIZATION_REVOKED','RECOVERY_SUSPENDED',...rejections];
const uint = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => uint(value) && value > 0;
const time = value => uint(value) && value <= 253402300799999;
const instant = value => typeof value === 'string' && time(Date.parse(value)) && new Date(value).toISOString() === value;
const id = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) && !/\s/.test(value);
const hash = value => typeof value === 'string' && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value);
const bool = value => typeof value === 'boolean';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const one = (...values) => value => values.includes(value);
const nullable = check => value => value === null || check(value);
const shape = fields => value => object(value) && Object.keys(value).length === Object.keys(fields).length &&
  Object.entries(fields).every(([key, check]) => Object.hasOwn(value, key) && check(value[key]));
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : object(value) ?
  '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const equal = (a, b) => canonical(a) === canonical(b);
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const clone = value => JSON.parse(JSON.stringify(value));
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
async function digest(value) {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return 'sha256:' + Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
}
const binding = shape({ nodeId:id, bootId:id, sessionEpoch:positive, snapshotGeneration:positive, assignmentId:id,
  forwardId:id, forwardRevision:positive, deploymentGeneration:positive, bindingFence:positive,
  configDigest:hash, egressPolicyRevision:positive });
const serviceId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
const serviceFields = {serviceId,revision:positive,configRevision:value => positive(value) && value <=64,configDigest:hash};
const serviceRef = value => shape(serviceFields)(value) && value.revision >=value.configRevision;
const selectionShape = value => shape({...serviceFields,scopeId:id,contextDigest:hash})(value) && value.revision >=value.configRevision;
const matchesReference = (selection,reference) => selectionShape(selection) && Object.keys(reference).every(key => selection[key] === reference[key]);
const configFields = { version:one(1), kind:one('tcp-connect','tcp-ingress-connect'), forwardId:id, expectedForwardRevision:positive,
  timeoutMs:value => positive(value) && value >= 100 && value <= 2000, mode:one('manual','scheduled'),
  intervalSeconds:nullable(positive), maxRuns:value => positive(value) && value <= 16, expiresAt:time };
const configShape = value => shape(configFields)(value) || shape({...configFields,kind:one('tcp-ingress-tls'),service:serviceRef})(value);
const configValid = value => configShape(value) && (value.mode === 'manual' ? value.intervalSeconds === null :
  value.intervalSeconds >= 30 && value.intervalSeconds <= 3600);
const headFields = { id, scopeId:id, createdBy:id, createdAt:time, config:configValid, configDigest:hash, originBinding:binding,
  revision:positive, state:one(...states), decisionCount:uint, acceptedCount:uint, nextRunAt:time, updatedAt:time,
  cancelledBy:nullable(id), cancelledAt:nullable(time), lastCode:nullable(one(...codes)), recoverySuspended:bool };
const headKeys = Object.keys(headFields);
const publicShape = shape({ ...headFields, expired:bool, remainingRuns:uint, health:one('unknown'), executionAuthorized:one(false),
  originBindingCurrent:one('not-evaluated'), configStoredOnly:one(true), contentDigest:hash });
async function validPlan(value, scope, now) {
  if (!publicShape(value) || value.scopeId !== scope || value.updatedAt < value.createdAt || value.config.expiresAt <= value.createdAt ||
      value.config.expiresAt - value.createdAt > limits.maxLifetimeMs || value.originBinding.forwardId !== value.config.forwardId ||
      value.originBinding.forwardRevision !== value.config.expectedForwardRevision || value.decisionCount > value.config.maxRuns || value.acceptedCount > value.decisionCount ||
      (value.cancelledBy === null) !== (value.cancelledAt === null) || value.cancelledAt !== null && (value.cancelledAt < value.createdAt || value.cancelledAt > value.updatedAt) ||
      (value.state === 'cancelled') !== (value.cancelledAt !== null) || value.state === 'cancelled' && value.lastCode !== 'PLAN_CANCELLED' ||
      value.state === 'active' && (value.recoverySuspended || value.decisionCount >= value.config.maxRuns) ||
      (value.state === 'active' && value.config.mode === 'scheduled' ? value.nextRunAt <= 0 : value.nextRunAt !== 0) ||
      value.state === 'completed' && value.decisionCount !== value.config.maxRuns || value.state === 'expired' && value.updatedAt < value.config.expiresAt ||
      value.expired !== (now >= value.config.expiresAt) || value.remainingRuns !== value.config.maxRuns - value.decisionCount) return false;
  const stored = Object.fromEntries(headKeys.map(key => [key,value[key]]));
  return bytes(stored) <= limits.maxPlanBytes && await digest(value.config) === value.configDigest && await digest(stored) === value.contentDigest;
}
const ingressDescriptor = { probeVersion:one(2), measurement:one('tcp-ingress-connect-v1'), taskKind:one('tcp-ingress-connect'),
  point:one('agent-local-direct-ingress'), capability:one('probe.tcp-ingress-connect.v1') };
const tlsDescriptor = {probeVersion:one(3),measurement:one('tcp-ingress-tls-v1'),taskKind:one('tcp-ingress-tls'),
  point:one('agent-local-direct-ingress'),capability:one('probe.tcp-ingress-tls.v1')};
const permitBodyFields = { probeId:id, forwardId:id, issuedAt:instant, expiresAt:instant, dispatch:one('agent-poll'), executionEnabled:one(false) };
const permitShape = value => shape({ status:one(202), body:shape(permitBodyFields) })(value) ||
  shape({ status:one(202), body:shape({ ...permitBodyFields, ...ingressDescriptor }) })(value) ||
  shape({status:one(202),body:shape({...permitBodyFields,...tlsDescriptor,service:selectionShape})})(value);
function permitValid(value, config, at, scope) {
  if (!permitShape(value) || (config.kind === 'tcp-connect' ? Object.hasOwn(value.body,'probeVersion') : value.body.taskKind !== config.kind) ||
      config.kind === 'tcp-ingress-tls' && (!matchesReference(value.body.service,config.service) || scope !== undefined && value.body.service.scopeId !==scope)) return false;
  const b = value.body, start = Date.parse(b.issuedAt), end = Date.parse(b.expiresAt);
  return b.forwardId === config.forwardId && end > start && end - start <= 2000 && end <= config.expiresAt && start <= at;
}
const decisionShape = shape({ position:value => positive(value) && value <= 16, actorId:id, source:one('manual','scheduled'), decidedAt:time,
  outcome:value => shape({ accepted:one(true), receipt:permitShape })(value) ||
    shape({ accepted:one(false), error:shape({ code:one(...rejections), status:one(403,404,409,422,429) }) })(value) });
const decisionValid = (value, config, scope) => decisionShape(value) && bytes(value) <= limits.maxDecisionBytes &&
  value.position <= config.maxRuns && value.source === config.mode && (!value.outcome.accepted || permitValid(value.outcome.receipt,config,value.decidedAt,scope));
const losses = shape({ rowsExpired:uint, rowsEvicted:uint, decisionsEvicted:uint });
const envelope = (fields, scope) => value => shape({ probePlansVersion:one(1), scopeId:one(scope), capturedAt:time,
  source:one('persisted-probe-plans'), readOnly:one(true), executionAuthorized:one(false), health:one('unknown'),
  networkCheck:one('not-performed-by-read'), consistency:one('read-committed-not-global-snapshot'), historyComplete:one(false),
  executionEnabled:bool, ingressExecutionEnabled:bool, servicesExecutionEnabled:bool, scheduleEnabled:bool, workerState:one('configured-not-liveness-proof','disabled'),
  limits:item => equal(item,limits), ...fields })(value) && (!value.scheduleEnabled || value.executionEnabled) && (!value.ingressExecutionEnabled || value.executionEnabled) &&
  (!value.servicesExecutionEnabled || value.ingressExecutionEnabled) &&
  value.workerState === (value.scheduleEnabled ? 'configured-not-liveness-proof' : 'disabled') && bytes(value) <= limits.maxResponseBytes;
const preflightFields = { version:one(1), kind:one('tcp-connect'), executable:one(false), dispatch:one('not-implemented'),
  point:one('agent-direct-egress'), independentProbe:one(false), health:one('unknown'), scopeId:id, binding,
  timeoutMs:value => positive(value) && value >= 100 && value <= 2000, maxAttempts:one(1), applicationPayloadBytes:one(0), plannedAt:instant, expiresAt:instant };
const preflightShape = value => shape(preflightFields)(value) || shape({ ...preflightFields, kind:one('tcp-ingress-connect'),
  point:one('agent-local-direct-ingress'), measurement:one('tcp-ingress-connect-v1'), capability:one('probe.tcp-ingress-connect.v1') })(value) ||
  shape({...preflightFields,kind:one('tcp-ingress-tls'),point:one('agent-local-direct-ingress'),measurement:one('tcp-ingress-tls-v1'),
    capability:one('probe.tcp-ingress-tls.v1'),serviceContext:contextShape})(value);
function numericAddress(value) {
  if(typeof value !== 'string' || value.length >45 || /[^a-f0-9:.]/.test(value)) return false;
  if(!value.includes(':')) {
    const parts=value.split('.');return parts.length===4 && parts.every(part => /^(0|[1-9][0-9]{0,2})$/.test(part) && Number(part)<=255) &&
      Number(parts[0])>0 && Number(parts[0])<224 && !(Number(parts[0])===169 && Number(parts[1])===254) && value!=='100.100.100.200';
  }
  try{return new URL('http://['+value+']/').hostname.slice(1,-1)===value && value!=='::' && !value.startsWith('::ffff:') &&
    !value.startsWith('ff') && !/^fe[89ab]/.test(value) && value!=='fd00:ec2::254';}catch{return false;}
}
function publicCertificate(value) {
  if(typeof value !== 'string' || value.length>10924 || value.length%4!==0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))return false;
  try{const decoded=atob(value);return decoded.length>0 && decoded.length<=8192 && btoa(decoded)===value;}catch{return false;}
}
const serviceConfigShape = shape({version:one(1),purpose:one('direct-ingress-tls-handshake'),endpoint:shape({address:numericAddress,port:value => positive(value) && value<=65535}),
  trust:shape({mode:one('pinned-leaf-v1'),serverName:value => typeof value==='string' && value.length<=253 && value.includes('.') && !/^[0-9.]+$/.test(value) &&
    value.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)),certificateDer:publicCertificate}),validFrom:time,validUntil:time});
function contextShape(value) {
  return shape({...serviceFields,scopeId:id,contextDigest:hash,config:serviceConfigShape})(value) && value.revision>=value.configRevision &&
    value.config.validUntil>value.config.validFrom && value.config.validUntil-value.config.validFrom<=604800000 && bytes(value)<=16384;
}
async function validContext(value,reference,scope,now) {
  if(!contextShape(value) || value.scopeId!==scope || !Object.keys(reference).every(key => value[key]===reference[key]) ||
      now<value.config.validFrom || now>=value.config.validUntil || await digest(value.config)!==value.configDigest) return false;
  const {contextDigest,...content}=value;return await digest(content)===contextDigest;
}
async function validPreview(value, input, scope) {
  const config = { ...input, expiresAt:Date.parse(input.expiresAt) };
  return envelope({ config:configValid, preflight:preflightShape, previewDigest:hash, configStoredOnly:one(true) },scope)(value) &&
    equal(value.config,config) && value.config.expiresAt > value.capturedAt + 1000 && value.config.expiresAt - value.capturedAt <= limits.maxLifetimeMs &&
    (config.mode !== 'scheduled' || value.capturedAt + config.intervalSeconds * 1000 < config.expiresAt) &&
    value.preflight.kind === config.kind && (config.kind !== 'tcp-ingress-tls' || await validContext(value.preflight.serviceContext,config.service,scope,value.capturedAt) &&
      Date.parse(value.preflight.expiresAt)<=value.preflight.serviceContext.config.validUntil) &&
    value.preflight.scopeId === scope && value.preflight.binding.forwardId === config.forwardId &&
    value.preflight.binding.forwardRevision === config.expectedForwardRevision && value.preflight.timeoutMs === config.timeoutMs &&
    Date.parse(value.preflight.expiresAt) > Date.parse(value.preflight.plannedAt) &&
    await digest({ config, originDriverDigest:value.preflight.binding.configDigest }) === value.previewDigest;
}
const cursorShape = value => typeof value === 'string' && value.length > 0 && value.length <= 1024 && /^[A-Za-z0-9_-]+$/.test(value);
const position = plan => ({ createdAt:plan.createdAt, id:plan.id });
const follows = (value,before) => !before || value.createdAt < before.createdAt || value.createdAt === before.createdAt && value.id < before.id;
async function validPage(data,query,scope,before) {
  if (!envelope({ window:shape({ from:one(Date.parse(query.from)), to:one(Date.parse(query.to)) }), filters:value => equal(value,query.filters),
    limit:one(query.limit), items:value => Array.isArray(value) && value.length <= query.limit, hasMore:bool, nextCursor:nullable(cursorShape), losses },scope)(data) ||
      data.hasMore !== (data.nextCursor !== null) || data.hasMore && data.items.length !== query.limit) return false;
  let previous = before; const seen = new Set();
  for (const value of data.items) {
    if (!await validPlan(value,scope,data.capturedAt) || !follows(value,previous) || seen.has(value.id) ||
        value.createdAt < data.window.from || value.createdAt >= data.window.to ||
        query.filters.forwardId !== null && value.config.forwardId !== query.filters.forwardId ||
        query.filters.mode !== null && value.config.mode !== query.filters.mode || query.filters.state !== null && value.state !== query.filters.state) return false;
    previous = position(value); seen.add(value.id);
  }
  if (data.nextCursor === null) return true;
  const expected = { version:1, queryDigest:await digest({ scope, from:Date.parse(query.from), to:Date.parse(query.to), limit:query.limit, filters:query.filters }),
    position:position(data.items.at(-1)) };
  return data.nextCursor === btoa(JSON.stringify(expected)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/, '');
}
async function validDetail(data,scope,selectedId) {
  if (!envelope({ plan:publicShape, decisions:value => Array.isArray(value) && value.length <= 16, losses },scope)(data) ||
      data.plan.id !== selectedId || !await validPlan(data.plan,scope,data.capturedAt) ||
      data.plan.createdAt < Math.max(0,data.capturedAt - limits.retentionMs) || data.decisions.length !== data.plan.decisionCount) return false;
  let accepted = 0, previous = data.plan.createdAt; const probes = new Set();
  for (const [index,value] of data.decisions.entries()) {
    if (!decisionValid(value,data.plan.config,scope) || value.position !== index + 1 || value.decidedAt < previous || value.decidedAt > data.plan.updatedAt ||
        value.source === 'scheduled' && value.actorId !== data.plan.createdBy) return false;
    if (value.outcome.accepted) { const id = value.outcome.receipt.body.probeId; if (probes.has(id)) return false; probes.add(id); accepted++; }
    previous = value.decidedAt;
  }
  return accepted === data.plan.acceptedCount;
}
const receiptShape = shape({ planId:id, revision:positive, state:one(...states), changed:bool, decision:nullable(decisionShape) });
function validReceipt(value,original) {
  if (!receiptShape(value) || bytes(value) > limits.maxResponseBytes) return false;
  if (original.kind === 'create') return value.revision === 1 && value.state === 'active' && value.changed === true && value.decision === null;
  const head = original.plan;
  if (value.planId !== head.id || value.revision !== original.body.expectedRevision + Number(value.changed)) return false;
  if (original.kind === 'cancel') return value.decision === null && (value.changed ? head.state === 'active' && value.state === 'cancelled' : value.state === head.state);
  const decision = value.decision;
  if (value.changed !== true || decision === null || !decisionValid(decision,head.config,original.scope) || decision.source !== 'manual' ||
      decision.position !== head.decisionCount + 1 || decision.decidedAt < head.updatedAt) return false;
  const permanent = !decision.outcome.accepted && !transient.includes(decision.outcome.error.code);
  return value.state === (decision.position === head.config.maxRuns ? 'completed' : permanent ? 'suspended' :
    decision.decidedAt >= head.config.expiresAt ? 'expired' : 'active');
}
const stamp = value => value === null ? 'Not recorded / unknown' : new Date(value).toISOString() + '\nAsia/Shanghai: ' +
  new Date(value).toLocaleString('zh-CN', { timeZone:'Asia/Shanghai', hour12:false });
const timeKeys = new Set(['createdAt','updatedAt','cancelledAt','nextRunAt','decidedAt','capturedAt','issuedAt','expiresAt','plannedAt']);
const show = value => JSON.stringify(value,(key,item) => timeKeys.has(key) && (time(item) || instant(item)) ?
  key === 'nextRunAt' && item === 0 ? '0 / no future slot' :
    { epochMs:typeof item === 'string' ? Date.parse(item) : item, display:stamp(typeof item === 'string' ? Date.parse(item) : item) } : item,2);

export function initProbePlans({ request, notify, byId, getScope, document = globalThis.document,
  confirm = globalThis.confirm, randomUUID = () => crypto.randomUUID() }) {
  const el = name => byId('probe-plan-' + name);
  const serviceInputs = ['service-id','service-revision','service-config-revision','service-digest'];
  const configInputs = ['kind','forward','forward-revision','timeout','mode','interval','max-runs','expires','delegation',...serviceInputs];
  const historyInputs = ['from','to','limit','filter-forward','filter-mode','filter-state'];
  const inputs = [...configInputs,...historyInputs,'id'];
  let epoch = 0, controller = null, preview = null, loaded = null, pending = null, sending = false, frozen = null, nextCursor = null, tail = null;
  const message = text => { el('message').textContent = text; };
  function controls() {
    const locked = Boolean(pending) || sending, busy = locked || Boolean(controller);
    for (const name of inputs) el(name).disabled = locked;
    el('interval').disabled = locked || el('mode').value !== 'scheduled';
    el('delegation').disabled = locked || el('mode').value !== 'scheduled';
    for(const name of serviceInputs)el(name).disabled = locked || el('kind').value !== 'tcp-ingress-tls';
    for (const name of ['preview','list','read']) el(name).disabled = busy;
    el('create').disabled = busy || !preview;
    el('run').disabled = busy || !loaded || loaded.config.mode !== 'manual' || loaded.state !== 'active' || loaded.expired || loaded.recoverySuspended;
    el('cancel').disabled = busy || !loaded || loaded.state !== 'active' || loaded.recoverySuspended;
    el('next').disabled = busy || !frozen || nextCursor === null || frozen.scope !== getScope();
    el('cancel-read').disabled = locked || !controller; el('replay').disabled = !pending || sending; el('clear').disabled = sending;
    for (const button of el('rows').querySelectorAll('button')) button.disabled = busy || button.dataset.epoch !== String(epoch);
  }
  function erase() {
    el('preview-output').textContent = el('record').textContent = el('receipt').textContent = el('meta').textContent = el('losses').textContent = '';
    el('rows').replaceChildren(); el('decisions').replaceChildren();
  }
  function invalidate() { epoch++; controller?.abort(); controller = null; preview = loaded = frozen = null; nextCursor = tail = null; erase(); controls(); }
  function clear() {
    pending = null; sending = false; invalidate(); const now = Date.now();
    el('forward').value = el('forward-revision').value = el('id').value = '';
    el('kind').value = 'tcp-connect'; el('timeout').value = '500'; el('mode').value = 'manual'; el('interval').value = '30'; el('max-runs').value = '1';
    el('expires').value = new Date(now + 1800000).toISOString(); el('delegation').checked = false;
    for(const name of serviceInputs)el(name).value='';
    el('from').value = new Date(Math.max(0,now - 86400000)).toISOString(); el('to').value = new Date(now).toISOString(); el('limit').value = '25';
    for (const name of ['filter-forward','filter-mode','filter-state']) el(name).value = '';
    controls(); message('Finite Probe plans: explicit preview, save, read and one manual decision. No automatic request or browser scheduling.');
  }
  function number(name,min,max) {
    const raw = el(name).value; if (!/^[1-9][0-9]*$/.test(raw) || !positive(Number(raw)) || Number(raw) < min || Number(raw) > max)
      throw Error(name + ' must be an integer from ' + min + ' to ' + max + '.'); return Number(raw);
  }
  function configInput() {
    const mode = el('mode').value, expiresAt = el('expires').value.trim();
    const kind = el('kind').value;
    const service = kind === 'tcp-ingress-tls' ? {serviceId:el('service-id').value.trim(),revision:number('service-revision',1,Number.MAX_SAFE_INTEGER),
      configRevision:number('service-config-revision',1,64),configDigest:el('service-digest').value.trim()} : undefined;
    const input = { version:1, kind, forwardId:el('forward').value.trim(), expectedForwardRevision:number('forward-revision',1,Number.MAX_SAFE_INTEGER),
      timeoutMs:number('timeout',100,2000), mode, intervalSeconds:mode === 'scheduled' ? number('interval',30,3600) : null,
      maxRuns:number('max-runs',1,16), expiresAt, ...(service ? {service} : {}) };
    const now = Date.now();
    if (!instant(expiresAt) || !configValid({ ...input, expiresAt:Date.parse(expiresAt) }) || Date.parse(expiresAt) <= now + 1000 ||
        Date.parse(expiresAt) - now > limits.maxLifetimeMs || mode === 'scheduled' && now + input.intervalSeconds * 1000 >= Date.parse(expiresAt))
      throw Error('Use an existing Direct TCP Forward/CAS and canonical UTC expiry more than one second ahead, within one hour; scheduled needs a future interval.');
    if (mode === 'scheduled' && !el('delegation').checked) throw Error('Explicit finite scheduled delegation consent is required.');
    return input;
  }
  function queryInput() {
    const from = el('from').value.trim(), to = el('to').value.trim();
    if (!instant(from) || !instant(to) || Date.parse(from) < Math.max(0,Date.now() - limits.retentionMs) ||
        Date.parse(to) <= Date.parse(from) || Date.parse(to) - Date.parse(from) > limits.retentionMs)
      throw Error('Use a canonical UTC fixed window within the last seven days; server validates its own clock.');
    const filters = { forwardId:el('filter-forward').value.trim() || null, mode:el('filter-mode').value || null, state:el('filter-state').value || null };
    if (filters.forwardId !== null && !id(filters.forwardId) || filters.mode !== null && !['manual','scheduled'].includes(filters.mode) || filters.state !== null && !states.includes(filters.state))
      throw Error('Invalid exact Probe plan history filter.');
    return freeze({ from,to,limit:number('limit',1,50),filters });
  }
  function metadata(value) {
    el('meta').textContent = 'Scope=' + value.scopeId + '\nCaptured: ' + stamp(value.capturedAt) + '\nexecutionEnabled=' + value.executionEnabled +
      '; ingressExecutionEnabled=' + value.ingressExecutionEnabled + '; servicesExecutionEnabled=' + value.servicesExecutionEnabled +
      '; scheduleEnabled=' + value.scheduleEnabled + '; workerState=' + value.workerState + '\nConfiguration is not worker liveness or network execution proof.\n' +
      value.source + '; read-committed-not-global-snapshot; historyComplete=false; health=unknown; executionAuthorized=false.';
    if (value.losses) el('losses').textContent = 'Scope-wide cumulative loss counters, not this query or completeness proof:\n' + JSON.stringify(value.losses,null,2);
  }
  function listRows(data) {
    metadata(data); const token = epoch;
    for (const value of data.items) {
      const tr = document.createElement('tr');
      for (const text of [value.id + '\nCAS=' + value.revision + '\ncreator=' + value.createdBy,
        JSON.stringify(value.config,null,2) + '\nexpiry: ' + stamp(value.config.expiresAt),
        value.state + '\nexpired=' + value.expired + '\nrecoverySuspended=' + value.recoverySuspended + '\nlastCode=' + value.lastCode,
        'decisions=' + value.decisionCount + '; permits accepted=' + value.acceptedCount + '; remaining=' + value.remainingRuns + '\nNot network attempts or successes.',
        'created: ' + stamp(value.createdAt) + '\nupdated: ' + stamp(value.updatedAt) + '\nnext slot: ' + (value.nextRunAt === 0 ? 'none' : stamp(value.nextRunAt)),
        'originBinding (not current):\n' + JSON.stringify(value.originBinding,null,2) + '\nconfigDigest=' + value.configDigest + '\nverified head contentDigest=' + value.contentDigest]) {
        const td = document.createElement('td'); td.textContent = text; tr.append(td);
      }
      const td = document.createElement('td'), button = document.createElement('button'); button.type = 'button'; button.className = 'secondary';
      button.textContent = 'Load plan ID only'; button.dataset.epoch = String(token);
      button.addEventListener('click', () => { if (token !== epoch || pending || controller || sending) return;
        invalidate(); el('id').value = value.id; message('Plan ID loaded only. Explicit detail read required before any command.'); });
      td.append(button); tr.append(td); el('rows').append(tr);
    }
    if (!data.items.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 7;
      td.textContent = 'No visible retained plans in this exact window/filter. This does not resolve an unknown write or prove complete history.'; tr.append(td); el('rows').append(tr); }
    el('meta').textContent += '\nFixed window: ' + stamp(data.window.from) + ' to (exclusive) ' + stamp(data.window.to) +
      '\nReturned=' + data.items.length + '; hasMore=' + data.hasMore + '; no total count or total pages.';
  }
  function detailRows(data) {
    loaded = freeze(clone(data.plan)); metadata(data);
    el('record').textContent = show({ ...data.plan, configExpiryDisplay:stamp(data.plan.config.expiresAt) });
    for (const value of data.decisions) {
      const tr = document.createElement('tr'), outcome = value.outcome;
      const texts = [value.position + ' / ' + value.source + '\nactor=' + value.actorId + '\n' + stamp(value.decidedAt),
        outcome.accepted ? 'Original permit accepted ONLY. Dispatch, network attempt and result are unknown.' :
          'Persisted rejection consumes one decision budget.\n' + outcome.error.code + ' / HTTP ' + outcome.error.status,
        outcome.accepted ? 'Probe ID=' + outcome.receipt.body.probeId + '\nForward=' + outcome.receipt.body.forwardId +
          '\nissued: ' + stamp(Date.parse(outcome.receipt.body.issuedAt)) + '\nexpires: ' + stamp(Date.parse(outcome.receipt.body.expiresAt)) +
          '\nmeasurement=' + (outcome.receipt.body.measurement ?? 'tcp-connect-v1') + '\npoint=' + (outcome.receipt.body.point ?? 'agent-direct-egress') +
          (outcome.receipt.body.service ? '\nservice selection='+JSON.stringify(outcome.receipt.body.service) : '') +
          '\nagent-poll; executionEnabled=false; use independent history panel manually.' : 'No accepted permit in this decision; no network result inferred.'];
      for (const text of texts) { const td = document.createElement('td'); td.textContent = text; tr.append(td); } el('decisions').append(tr);
    }
    if (!data.decisions.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 3;
      td.textContent = 'No recorded decisions. A stored plan is not a Probe result or execution proof.'; tr.append(td); el('decisions').append(tr); }
  }
  async function read(kind) {
    if (pending || sending || controller) return;
    if (kind === 'next' && (!frozen || nextCursor === null)) return;
    let input,query,selectedId,scope,incoming = null,before = null;
    try {
      scope = getScope(); if (!id(scope)) throw Error('Connect a valid Scope first.');
      if (kind === 'preview') input = freeze(configInput());
      else if (kind === 'detail') { selectedId = el('id').value.trim(); if (!id(selectedId)) throw Error('Enter an exact plan ID.'); }
      else if (kind === 'next') {
        if (frozen.scope !== scope || !equal(queryInput(),frozen.query)) throw Error('Scope or fixed query changed; read a new window explicitly.');
        query = frozen.query; incoming = nextCursor; before = tail;
      } else query = queryInput();
    } catch (error) { invalidate(); message('No request sent. Old preview, history and CAS cleared.'); notify(error.message,true); return; }
    invalidate(); const token = epoch, active = new AbortController(); controller = active; controls();
    const current = () => epoch === token && controller === active && !active.signal.aborted && getScope() === scope;
    let resource = kind === 'preview' ? 'probe-plans/preview' : 'probe-plans/' + encodeURIComponent(selectedId);
    if (query) { const params = new URLSearchParams({ from:query.from,to:query.to,limit:String(query.limit) });
      for (const [key,value] of Object.entries(query.filters)) if (value !== null) params.set(key,value);
      if (incoming !== null) params.set('cursor',incoming); resource = 'probe-plans?' + params.toString(); }
    const timer = setTimeout(() => active.abort(),5000); message('Manual read / preview, maximum five seconds. No issuance, automatic scheduling, retry or pagination by this browser.');
    try {
      const data = await request(kind === 'preview' ? 'POST' : 'GET',resource,input,undefined,{ signal:active.signal,timeoutMs:5000 });
      if (!current()) { if (token === epoch) invalidate(); return; }
      if (kind === 'preview') {
        if (!await validPreview(data,input,scope)) throw Error('Invalid closed plan preview, original binding, fixed config or digest.');
        if (!current()) { if (token === epoch) invalidate(); return; }
        preview = freeze({ input,previewDigest:data.previewDigest,scope }); metadata(data);
        el('preview-output').textContent = show({ ...data, configExpiryDisplay:stamp(data.config.expiresAt) });
        message('Fixed preview only. No permit or plan saved; create saves finite intent only. Scheduled creation explicitly delegates possible future decisions, subject to flags and current authorization.');
      } else if (kind === 'detail') {
        if (!await validDetail(data,scope,selectedId)) throw Error('Invalid closed plan, config/head digests, lifecycle, decisions or permit association.');
        if (!current()) { if (token === epoch) invalidate(); return; }
        detailRows(data); message('Persisted plan and decisions loaded. Commands use this exact CAS; no automatic run, refresh, catch-up, resume or recovery.');
      } else {
        if (!await validPage(data,query,scope,before) || incoming !== null && data.nextCursor === incoming) throw Error('Invalid closed plan page, query binding, ordering, digests or cursor.');
        if (!current()) { if (token === epoch) invalidate(); return; }
        frozen = { query,scope }; nextCursor = data.nextCursor; tail = data.items.length ? position(data.items.at(-1)) : null;
        listRows(data); message('Only this fixed page loaded. Next page and detail require separate explicit actions.');
      }
    } catch (error) { if (token === epoch) { invalidate(); message('Read / preview failed, cancelled or timed out. Old preview, rows, detail, CAS and cursor cleared; no execution or health conclusion.');
      notify(active.signal.aborted ? 'Plan read / preview cancelled or timed out.' : error.message,true); } }
    finally { clearTimeout(timer); if (controller === active) { controller = null; controls(); } }
  }
  async function send(original,replay = false) {
    if (sending || controller || pending !== original) return;
    const token = epoch; sending = true; const active = new AbortController(); controller = active; controls();
    const timer = setTimeout(() => active.abort(),5000);
    message('Sending the frozen original command once. Timeout does not prove rejection. No automatic retry or replacement key.');
    try {
      if (getScope() !== original.scope) throw Error('Scope changed; original command cannot be sent under another Scope.');
      const value = await request(original.method,original.resource,clone(original.body),original.key,{ signal:active.signal,timeoutMs:5000 });
      if (token !== epoch || pending !== original) return;
      if (active.signal.aborted || getScope() !== original.scope) throw Error('Command outcome remains uncertain after timeout or Scope change.');
      if (!validReceipt(value,original)) throw Error('Invalid closed command receipt or decision association; original outcome remains uncertain.');
      pending = null; sending = false; invalidate(); el('id').value = value.planId; el('receipt').textContent = show(value);
      message(original.kind === 'create' ? 'Finite plan saved only. No permit issued by create. Scheduled intent may later issue through the explicitly enabled worker; flags do not prove liveness. Read manually.' :
        original.kind === 'cancel' ? 'Future plan decisions cancelled / already inactive. Existing permits, reports and already sent TCP SYNs were NOT revoked or erased. Read manually.' :
          value.decision.outcome.accepted ? 'One original short-lived permit accepted, not a network attempt or result. Copy its Probe ID to independent history and query manually; no next decision or polling.' :
            'One rejection persisted and budget consumed. This is not a network failure result. No automatic retry, next decision or CAS replacement. Read manually.');
    } catch (error) {
      if (token === epoch && pending === original) {
        // A refusal during replay cannot resolve an earlier uncertain commit.
        if (!replay && [400,401,403,404,409,413,422,429].includes(error.httpStatus)) pending = null;
        message(pending ? 'Original write outcome uncertain. Inputs and reads locked. Only explicit replay of the identical method/path/body/key/Scope or explicit local abandonment; even replay 4xx does not prove the original never committed.' :
          'First command explicitly refused. No replacement CAS/key or automatic retry. Read and prepare manually.');
        notify(active.signal.aborted ? 'Plan command timed out; it may already have committed.' : error.message,true);
      }
    } finally { clearTimeout(timer); if (token === epoch) { sending = false; if (controller === active) controller = null; controls(); } }
  }
  function command(kind) {
    if (pending || sending || controller) return;
    try {
      const scope = getScope(); if (!id(scope)) throw Error('Connect a valid Scope first.');
      let body,resource,plan = null;
      if (kind === 'create') {
        if (!preview || preview.scope !== scope || !equal(configInput(),preview.input)) throw Error('A fresh fixed preview and unchanged config/consent are required.');
        if (!confirm(preview.input.mode === 'scheduled' ? 'Save this finite scheduled delegation? A separately enabled worker may later request at most this decision budget against the original Forward/CAS. No worker liveness, permit delivery, network attempt or success is guaranteed.' :
          'Save this finite manual plan only? No Probe is issued by create; each later decision requires a separate explicit run.')) return;
        body = { config:clone(preview.input),previewDigest:preview.previewDigest }; resource = 'probe-plans';
      } else {
        if (!loaded || loaded.scopeId !== scope || loaded.id !== el('id').value.trim() || loaded.recoverySuspended || loaded.state !== 'active') throw Error('Read an active, non-recovery-suspended plan and its exact CAS first.');
        if (kind === 'run' && (loaded.config.mode !== 'manual' || loaded.expired || Date.now() >= loaded.config.expiresAt)) throw Error('Only an unexpired active manual plan can be stepped.');
        if (!confirm(kind === 'run' ? 'Make exactly one decision at this plan CAS? A saved rejection also consumes one of maxRuns; acceptance only permits a zero-application-payload TCP connect to the original Direct TCP target, not delivery or success.' :
          'Cancel only future decisions? This does NOT revoke an existing short-lived permit, cancel a previously sent packet, erase results, resume recovery or restore budget.')) return;
        plan = clone(loaded); body = { expectedRevision:loaded.revision }; resource = 'probe-plans/' + encodeURIComponent(loaded.id) + '/' + kind;
      }
      const original = freeze({ kind,method:'POST',resource,body,key:randomUUID(),scope,plan }); invalidate(); pending = original; controls(); return send(original);
    } catch (error) { invalidate(); message('No command sent. Old preview and CAS cleared; no automatic rebase or retry.'); notify(error.message,true); }
  }
  for (const name of inputs) for (const event of ['input','change']) el(name).addEventListener(event, () => {
    if (pending || sending) return;
    invalidate(); if (name === 'mode' && el('mode').value !== 'scheduled') el('delegation').checked = false;
    controls(); message('Input changed. Preview, loaded CAS, page and cursor cleared. Explicit fresh read / preview required.');
  });
  for (const [name,kind] of [['preview','preview'],['list','list'],['read','detail'],['next','next']]) el(name).addEventListener('click', () => read(kind));
  for (const name of ['create','run','cancel']) el(name).addEventListener('click', () => command(name));
  el('replay').addEventListener('click', () => { if (pending && !sending && confirm('Replay only the identical frozen original command and key? No new key, CAS, configuration, queue item or automatic continuation. A refusal cannot establish that an earlier uncertain write did not commit.')) return send(pending,true); });
  el('cancel-read').addEventListener('click', () => { if (!pending && !sending) { invalidate(); message('Only this local read / preview cancelled. Remote plan, permits and execution are unchanged.'); } });
  el('clear').addEventListener('click', () => { if (!sending && (!pending || confirm('Abandon the local original command/key? It may already have committed. This does not cancel the remote plan or prevent scheduled decisions; use an explicit later cancellation only after manual inspection.'))) clear(); });
  clear(); return { clear };
}
