const limits = { retentionMs: 604800000, maxRunsPerScope: 1024, pruneBatch: 16,
  defaultPageSize: 25, maxPageSize: 50, maxRecordBytes: 4096, maxResponseBytes: 262144 };
const states = ['issued','consumed','revoked','quarantined'];
const uint = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => uint(value) && value > 0;
const time = value => uint(value) && value <= 253402300799999;
const instant = value => typeof value === 'string' && time(Date.parse(value)) && new Date(value).toISOString() === value;
const id = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) && !/\s/.test(value);
const hash = value => typeof value === 'string' && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value);
const hex = value => typeof value === 'string' && value.length === 64 && /^[a-f0-9]{64}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const one = (...values) => value => values.includes(value);
const nullable = check => value => value === null || check(value);
const shape = fields => value => object(value) && Object.keys(value).length === Object.keys(fields).length &&
  Object.entries(fields).every(([key, check]) => Object.hasOwn(value, key) && check(value[key]));
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : object(value) ?
  '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const equal = (a, b) => canonical(a) === canonical(b);
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
async function digest(value) {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return 'sha256:' + Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
}
const binding = shape({ nodeId: id, bootId: id, sessionEpoch: positive, snapshotGeneration: positive, assignmentId: id,
  forwardId: id, forwardRevision: positive, deploymentGeneration: positive, bindingFence: positive,
  configDigest: hash, egressPolicyRevision: positive });
const result = shape({ status: one('connected','unreachable'), code: one('tcp-connected','tcp-connect-failed'),
  elapsedMs: uint, measuredAt: time, validUntil: time, acceptedAt: time, resultDigest: hash });
const serviceSelection = shape({ scopeId:id,serviceId:id,revision:positive,configRevision:value => positive(value) && value <=64,configDigest:hash,contextDigest:hash });
const tlsEvidence = shape({version:one('TLSv1.3'),alpn:one('tunex-observation/1'),leafFingerprint:hash,verified:one(true)});
const tlsResult = shape({status:one('verified','unverified','unreachable'),code:one('tls-handshake-verified','tls-handshake-failed','tcp-connect-failed'),
  elapsedMs:uint,measuredAt:time,validUntil:time,acceptedAt:time,resultDigest:hash,tls:nullable(tlsEvidence)});
const echoMeasurement = value => ['tcp-ingress-echo-v1','udp-ingress-echo-v1','tcp-path-echo-v1','udp-path-echo-v1'].includes(value);
const rawBase64 = (value, length) => { try { return typeof value === 'string' && atob(value).length === length && btoa(atob(value)) === value; } catch { return false; } };
const echoChallenge = shape({ nonce: value => rawBase64(value, 32), invocationDigest: hash });
const echoProof = shape({ algorithm: one('Ed25519'), requestDigest: hash, signature: value => rawBase64(value, 64), verified: one(true) });
const echoResult = shape({ status: one('echoed','unverified','unreachable'), code: one('nonce-echo-verified','nonce-echo-rejected','tcp-connect-failed'),
  elapsedMs:uint,measuredAt:time,validUntil:time,acceptedAt:time,resultDigest:hash,echo:nullable(echoProof),
  requestBytes:value => uint(value) && value <= 256,responseBytes:value => uint(value) && value <= 256 });
const recordKeys = ['probeId','scopeId','actorId','binding','instanceId','instanceGeneration','timeoutMs','issuedAt','expiresAt',
  'state','closedAt','revision','updatedAt','withdrawnAt','result','recoverySuspended'];
const legacyRunShape = shape({ probeId: id, scopeId: id, actorId: id, binding, instanceId: hex, instanceGeneration: positive,
  timeoutMs: value => positive(value) && value >= 100 && value <= 2000, issuedAt: time, expiresAt: time,
  state: one(...states), closedAt: nullable(time), revision: positive, updatedAt: time, withdrawnAt: nullable(time),
  result: nullable(result), recoverySuspended: value => typeof value === 'boolean', kind: one('tcp-connect'), businessProtocol: one('tcp'),
  point: one('agent-direct-egress'), independentProbe: one(false), applicationPayloadBytes: one(0), health: one('unknown'),
  executionAuthorized: one(false), historical: one(true), permitExpired: value => typeof value === 'boolean',
  resultExpired: nullable(value => typeof value === 'boolean'), resultSource: one('not-received','agent-reported'),
  bindingMatchCurrent: one('not-evaluated'), resultDigestVerification: one('captured-from-original-owner-not-recomputed'), contentDigest: hash });
function runShape(value) {
  if (!object(value)) return false;
  if (!Object.hasOwn(value,'measurement')) return legacyRunShape(value);
  if (echoMeasurement(value.measurement)) {
    if (value.kind !== value.measurement.slice(0, -3) || value.businessProtocol !== (value.measurement.startsWith('udp') ? 'udp' : 'tcp') ||
        value.point !== (value.measurement.includes('-path-')?'agent-local-forward-ingress':'agent-local-direct-ingress') || !serviceSelection(value.service) || value.service.scopeId !== value.scopeId || !echoChallenge(value.echoChallenge) ||
        value.result !== null && (!echoResult(value.result) ||
          !(value.result.status === 'echoed' && value.result.code === 'nonce-echo-verified' && value.result.echo !== null && value.result.requestBytes === 256 && value.result.responseBytes === 256 ||
            value.result.status === 'unverified' && value.result.code === 'nonce-echo-rejected' && value.result.echo === null && value.result.requestBytes === 256 ||
            value.measurement.startsWith('tcp') && value.result.status === 'unreachable' && value.result.code === 'tcp-connect-failed' && value.result.echo === null && value.result.requestBytes === 0 && value.result.responseBytes === 0)) ||
        value.applicationPayloadBytes !== (value.result === null ? 0 : value.result.requestBytes + value.result.responseBytes)) return false;
    const { measurement: _, service: __, echoChallenge: ___, ...rest } = value;
    const normalized = value.result === null ? null : Object.fromEntries(Object.entries(value.result).filter(([key]) => !['echo','requestBytes','responseBytes'].includes(key)));
    if (normalized) { normalized.status = 'connected'; normalized.code = 'tcp-connected'; }
    return legacyRunShape({ ...rest, kind: 'tcp-connect', businessProtocol: 'tcp', point: 'agent-direct-egress', applicationPayloadBytes: 0, result: normalized });
  }
  if (value.measurement === 'tcp-ingress-tls-v1') {
    if(value.kind !== 'tcp-ingress-tls' || value.point !== 'agent-local-direct-ingress' || !serviceSelection(value.service) || value.service.scopeId !== value.scopeId ||
        value.result !== null && (!tlsResult(value.result) || value.result.code !== (value.result.status === 'verified' ? 'tls-handshake-verified' :
          value.result.status === 'unverified' ? 'tls-handshake-failed' : 'tcp-connect-failed') ||
          (value.result.status === 'verified' ? value.result.tls === null : value.result.tls !== null))) return false;
    const { measurement: _, service: __, ...rest } = value;
    const normalized = value.result === null ? null : Object.fromEntries(Object.entries(value.result).filter(([key]) => key !== 'tls'));
    if (normalized) { normalized.status = 'connected'; normalized.code = 'tcp-connected'; }
    return legacyRunShape({...rest,kind:'tcp-connect',point:'agent-direct-egress',result:normalized});
  }
  if (value.measurement !== 'tcp-ingress-connect-v1' || value.kind !== 'tcp-ingress-connect' || value.point !== 'agent-local-direct-ingress') return false;
  const { measurement: _, ...rest } = value;
  return legacyRunShape({ ...rest, kind: 'tcp-connect', point: 'agent-direct-egress' });
}
async function validRun(run, scope, capturedAt) {
  if (!runShape(run) || run.scopeId !== scope || run.expiresAt <= run.issuedAt || run.expiresAt - run.issuedAt > 2000 ||
      run.updatedAt < run.issuedAt || (run.state === 'issued' ? run.closedAt !== null : run.closedAt === null || run.closedAt < run.issuedAt) ||
      run.closedAt !== null && run.closedAt > run.updatedAt || run.state === 'consumed' && run.closedAt >= run.expiresAt ||
      run.withdrawnAt !== null && (run.state !== 'consumed' || run.closedAt === null || run.withdrawnAt < run.closedAt || run.withdrawnAt > run.updatedAt) ||
      run.permitExpired !== (run.expiresAt <= capturedAt) || run.resultSource !== (run.result === null ? 'not-received' : 'agent-reported') ||
      run.resultExpired !== (run.result === null ? null : run.result.validUntil <= capturedAt)) return false;
  const r = run.result;
  if (r !== null && (run.state !== 'consumed' || run.closedAt === null || r.code !== (r.status === 'echoed' ? 'nonce-echo-verified' : r.status === 'verified' ? 'tls-handshake-verified' :
      r.status === 'unverified' ? echoMeasurement(run.measurement) ? 'nonce-echo-rejected' : 'tls-handshake-failed' : r.status === 'connected' ? 'tcp-connected' : 'tcp-connect-failed') ||
      r.elapsedMs > run.timeoutMs || r.measuredAt < run.closedAt || r.validUntil <= r.measuredAt || r.validUntil > run.expiresAt ||
      r.acceptedAt < r.measuredAt || r.acceptedAt >= r.validUntil || r.acceptedAt > run.updatedAt ||
      run.withdrawnAt !== null && r.acceptedAt > run.withdrawnAt)) return false;
  // Public flags are not part of the stored record digest; the original wire result digest is only preserved.
  const stored = Object.fromEntries(recordKeys.map(key => [key, run[key]]));
  if (Object.hasOwn(run,'measurement')) stored.measurement = run.measurement;
  if (run.measurement === 'tcp-ingress-tls-v1' || echoMeasurement(run.measurement)) stored.service = run.service;
  if (echoMeasurement(run.measurement)) {
    stored.echoChallenge = run.echoChallenge;
    const invocation = { domain:'tunex.probe.echo.invocation.v1',probeVersion:4,measurement:run.measurement,permitId:run.probeId,
      binding:run.binding,instanceId:run.instanceId,instanceGeneration:run.instanceGeneration,timeoutMs:run.timeoutMs,
      issuedAt:new Date(run.issuedAt).toISOString(),expiresAt:new Date(run.expiresAt).toISOString(),service:run.service,nonce:run.echoChallenge.nonce };
    if (await digest(invocation) !== run.echoChallenge.invocationDigest) return false;
  }
  return bytes(stored) <= limits.maxRecordBytes && await digest(stored) === run.contentDigest;
}
const losses = nullable(shape({ rowsExpired: uint, rowsEvicted: uint, updatesWithoutHead: uint }));
const envelope = (fields, scope) => shape({ probeRunsVersion: one(1), scopeId: one(scope), capturedAt: time,
  source: one('persisted-probe-run-history'), coverage: one('new-accepted-probes-since-history-enabled'), historyComplete: one(false),
  readOnly: one(true), executionAuthorized: one(false), health: one('unknown'), networkCheck: one('not-performed-by-read'),
  consistency: one('read-committed-not-global-snapshot'), limits: value => equal(value, limits), losses, ...fields });
const cursorShape = value => typeof value === 'string' && value.length > 0 && value.length <= 1024 && /^[A-Za-z0-9_-]+$/.test(value);
const position = run => ({ issuedAt: run.issuedAt, probeId: run.probeId });
const follows = (run, before) => !before || run.issuedAt < before.issuedAt || run.issuedAt === before.issuedAt && run.probeId < before.probeId;
async function validCursor(value, query, scope, last) {
  if (!cursorShape(value) || !last) return false;
  const expected = { version: 1, queryDigest: await digest({ scope, from: Date.parse(query.from), to: Date.parse(query.to),
    limit: query.limit, filters: query.filters }), position: position(last) };
  return value === btoa(JSON.stringify(expected)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/, '');
}
async function validPage(data, query, scope, before) {
  if (!envelope({ window: shape({ from: one(Date.parse(query.from)), to: one(Date.parse(query.to)) }), filters: value => equal(value, query.filters),
    limit: one(query.limit), items: value => Array.isArray(value) && value.length <= query.limit, hasMore: value => typeof value === 'boolean',
    nextCursor: nullable(cursorShape) }, scope)(data) || bytes(data) > limits.maxResponseBytes ||
      data.hasMore !== (data.nextCursor !== null) || data.hasMore && data.items.length !== query.limit) return false;
  const seen = new Set(); let previous = before;
  for (const run of data.items) {
    if (!await validRun(run, scope, data.capturedAt) || seen.has(run.probeId) || !follows(run, previous) ||
        run.issuedAt < data.window.from || run.issuedAt >= data.window.to ||
        ['forwardId','nodeId'].some(key => query.filters[key] !== null && run.binding[key] !== query.filters[key]) ||
        query.filters.probeId !== null && run.probeId !== query.filters.probeId ||
        query.filters.state !== null && run.state !== query.filters.state ||
        query.filters.resultStatus !== null && (query.filters.resultStatus === 'missing' ? run.result !== null : run.result?.status !== query.filters.resultStatus)) return false;
    seen.add(run.probeId); previous = position(run);
  }
  return data.nextCursor === null || await validCursor(data.nextCursor, query, scope, data.items.at(-1));
}
const stamp = value => value === null ? 'Not recorded / unknown' : new Date(value).toISOString() + '\nAsia/Shanghai: ' +
  new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });

export function initProbeRuns({ request, notify, byId, getScope, document = globalThis.document }) {
  const el = name => byId('probe-run-' + name), filterNames = ['forwardId','nodeId','probeId','state','resultStatus'];
  let epoch = 0, controller = null, frozen = null, nextCursor = null, before = null;
  function controls() {
    el('list').disabled = el('read').disabled = Boolean(controller);
    el('next').disabled = Boolean(controller) || !frozen || nextCursor === null || frozen.scope !== getScope();
    el('cancel').disabled = !controller;
  }
  function erase() { el('rows').replaceChildren(); el('detail').textContent = ''; el('meta').textContent = ''; el('losses').textContent = ''; }
  function invalidate() {
    epoch++; controller?.abort(); controller = null; frozen = null; nextCursor = before = null; erase(); controls();
  }
  function clear() {
    invalidate(); const now = Date.now(); el('from').value = new Date(Math.max(0, now - 86400000)).toISOString();
    el('to').value = new Date(now).toISOString(); el('limit').value = '25'; el('id').value = '';
    for (const key of filterNames) el(key).value = '';
    el('message').textContent = 'Manual manager-only history reads. No automatic request, network Probe or command.';
  }
  function input() {
    const from = el('from').value.trim(), to = el('to').value.trim(), raw = el('limit').value;
    if (!instant(from) || !instant(to) || Date.parse(from) < Math.max(0, Date.now() - limits.retentionMs) ||
        Date.parse(to) <= Date.parse(from) || Date.parse(to) - Date.parse(from) > limits.retentionMs)
      throw Error('Use canonical UTC ISO timestamps within the last seven days; from < to. Server validates its own clock.');
    if (!/^[1-9][0-9]*$/.test(raw) || !positive(Number(raw)) || Number(raw) > 50) throw Error('Page limit must be an integer from 1 to 50.');
    const filters = {};
    for (const key of filterNames) {
      const value = el(key).value.trim();
      if (value && !(key === 'state' ? states.includes(value) : key === 'resultStatus' ? ['connected','unreachable','verified','unverified','echoed','missing'].includes(value) : id(value)))
        throw Error('Invalid exact history filter: ' + key);
      filters[key] = value || null;
    }
    return Object.freeze({ from, to, limit: Number(raw), filters: Object.freeze(filters) });
  }
  function metadata(data) {
    el('meta').textContent = 'Scope: ' + data.scopeId + '\nCaptured: ' + stamp(data.capturedAt) + '\n' + data.source + '\n' +
      data.coverage + '\nhistoryComplete=false; read-committed, not a global snapshot; health=unknown; executionAuthorized=false.';
    el('losses').textContent = data.losses===null?'当前账号不可见工作空间累计淘汰统计；不表示零损失。':'Scope-wide cumulative loss counters (not this query or complete coverage):\n' + JSON.stringify(data.losses, null, 2);
  }
  function render(data) {
    metadata(data);
    for (const run of data.items) {
      const tr = document.createElement('tr');
      const texts = [run.probeId + '\nactor=' + run.actorId + '\nrevision=' + run.revision,
        Object.entries(run.binding).map(([key,value]) => key + '=' + value).join('\n') + '\ninstanceId=' + run.instanceId + '\ninstanceGeneration=' + run.instanceGeneration,
        run.state + '\npermitExpired=' + run.permitExpired + '\nrecoverySuspended=' + run.recoverySuspended + '\ntimeoutMs=' + run.timeoutMs,
        'issuedAt: ' + stamp(run.issuedAt) + '\nexpiresAt: ' + stamp(run.expiresAt) + '\nclosedAt: ' + stamp(run.closedAt) + '\nupdatedAt: ' + stamp(run.updatedAt) + '\nwithdrawnAt: ' + stamp(run.withdrawnAt),
        run.result === null ? 'not-received / unknown; not a failure or proof of no network attempt.' :
          'agent-reported historical ' + run.result.status + '\n' + run.result.code + '\nelapsedMs=' + run.result.elapsedMs + '\nresultExpired=' + run.resultExpired +
          '\nmeasuredAt: ' + stamp(run.result.measuredAt) + '\nvalidUntil: ' + stamp(run.result.validUntil) + '\nacceptedAt: ' + stamp(run.result.acceptedAt) + '\noriginal resultDigest=' + run.result.resultDigest,
        run.kind + ' / ' + run.businessProtocol + ' / ' + run.point + '\nmeasurement=' + (run.measurement ?? 'tcp-connect-v1') +
          (run.service ? '\nservice selection (no certificate): ' + JSON.stringify(run.service) + (echoMeasurement(run.measurement) ?
            '\nRecorded Echo evidence (not independently reverified): ' + JSON.stringify(run.result?.echo ?? null) +
            '\ncontrolled requestBytes/responseBytes=' + (run.result?.requestBytes ?? 0) + '/' + (run.result?.responseBytes ?? 0) : '\nTLS evidence: ' + JSON.stringify(run.result?.tls ?? null)) : '') +
          '\nindependentProbe=false; applicationPayloadBytes=' + run.applicationPayloadBytes + '; health=unknown\ncurrent binding: not-evaluated\ncontentDigest verified over full stored summary only:\n' + run.contentDigest];
      for (const text of texts) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
      const td = document.createElement('td'), button = document.createElement('button'); button.type = 'button'; button.className = 'secondary';
      button.textContent = 'Load ID only'; button.addEventListener('click', () => {
        invalidate(); el('id').value = run.probeId; el('message').textContent = 'ID loaded only. Press the separate history detail button; no command or receipt wait was started.';
      }); td.append(button); tr.append(td); el('rows').append(tr);
    }
    if (!data.items.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 7;
      td.textContent = 'No visible retained rows in this exact window/filter. This is not complete history or proof that nothing happened.'; tr.append(td); el('rows').append(tr); }
    el('meta').textContent += '\nFixed window: ' + stamp(data.window.from) + ' to (exclusive) ' + stamp(data.window.to) +
      '\nReturned=' + data.items.length + '; hasMore=' + data.hasMore + '; no total count or total pages.';
  }
  async function read(kind) {
    if (controller) return;
    if (kind === 'next' && (!frozen || nextCursor === null)) return;
    let query, incoming = null, previous = null, selectedId = null, scope;
    try {
      scope = getScope(); if (!id(scope)) throw Error('Connect a valid Scope first.');
      if (kind === 'detail') { selectedId = el('id').value.trim(); if (!id(selectedId)) throw Error('Enter an exact retained Probe ID.'); }
      else if (kind === 'next') {
        if (frozen.scope !== scope || !equal(input(), frozen.query)) throw Error('Scope or query changed. Read a fresh fixed window explicitly.');
        query = frozen.query; incoming = nextCursor; previous = before;
      } else query = input();
    } catch (error) { invalidate(); el('message').textContent = 'No request sent. Old history and cursor cleared.'; notify(error.message, true); return; }
    invalidate(); const token = epoch, active = new AbortController(); controller = active; controls();
    let resource = 'probe-runs/' + encodeURIComponent(selectedId);
    if (kind !== 'detail') {
      const params = new URLSearchParams({ from: query.from, to: query.to, limit: String(query.limit) });
      for (const [key,value] of Object.entries(query.filters)) if (value !== null) params.set(key,value);
      if (incoming !== null) params.set('cursor', incoming); resource = 'probe-runs?' + params.toString();
    }
    const timer = setTimeout(() => active.abort(), 5000);
    const current = () => token === epoch && controller === active && !active.signal.aborted && getScope() === scope;
    el('message').textContent = 'Manual history read, maximum five seconds. No automatic retry, pagination or network check.';
    try {
      const data = await request('GET', resource, undefined, undefined, { signal: active.signal, timeoutMs: 5000 });
      if (!current()) { if (token === epoch) invalidate(); return; }
      if (kind === 'detail') {
        if (!envelope({ run: runShape }, scope)(data) || bytes(data) > limits.maxResponseBytes || data.run.probeId !== selectedId ||
            data.run.issuedAt < Math.max(0,data.capturedAt - limits.retentionMs) || !await validRun(data.run, scope, data.capturedAt))
          throw Error('Invalid closed history detail, lifecycle, binding or summary digest.');
        if (!current()) { if (token === epoch) invalidate(); return; }
        metadata(data);
        const times = Object.fromEntries(['issuedAt','expiresAt','closedAt','updatedAt','withdrawnAt'].map(key => [key,stamp(data.run[key])]));
        if (data.run.result) for (const key of ['measuredAt','validUntil','acceptedAt']) times['result.' + key] = stamp(data.run.result[key]);
        el('detail').textContent = JSON.stringify({ run: data.run, displayedTimes: times }, null, 2);
      } else {
        if (!await validPage(data,query,scope,previous) || incoming !== null && data.nextCursor === incoming)
          throw Error('Invalid closed history page, query binding, order, lifecycle, cursor or summary digest.');
        if (!current()) { if (token === epoch) invalidate(); return; }
        frozen = { query, scope }; nextCursor = data.nextCursor; before = data.items.length ? position(data.items.at(-1)) : null; render(data);
      }
      el('message').textContent = 'Historical summary loaded only. Missing result means not-received / unknown; consumed does not prove a network attempt; issued expiry does not prove no dial.';
    } catch (error) {
      if (token === epoch) { invalidate(); el('message').textContent = error.httpStatus === 403 ? 'Current Scope manager permission required. Old history cleared.' :
        'History read failed, cancelled or timed out. Old rows, detail and cursor cleared; health and missing results remain unknown.';
        notify(active.signal.aborted ? 'History read cancelled or timed out.' : error.message, true); }
    } finally { clearTimeout(timer); if (controller === active) { controller = null; controls(); } }
  }
  for (const name of ['from','to','limit',...filterNames,'id']) for (const event of ['input','change']) el(name).addEventListener(event, () => {
    invalidate(); el('message').textContent = 'Inputs changed. Old rows, detail and cursor cleared; explicit read required.';
  });
  el('list').addEventListener('click', () => read('list')); el('next').addEventListener('click', () => read('next'));
  el('read').addEventListener('click', () => read('detail'));
  el('cancel').addEventListener('click', () => { invalidate(); el('message').textContent = 'Only this local read cancelled. No Probe, permit or remote execution was changed.'; });
  el('clear').addEventListener('click', clear); clear(); return { clear };
}
