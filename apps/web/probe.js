const validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
}

// This is a historical display projection, never a source of health or execution authority.
function receiptView(value, id) {
  if (value?.probeId !== id || !validId(value.forwardId) || value.executionEnabled !== false || value.health !== 'unknown' ||
      !['issued', 'consumed', 'revoked', 'quarantined'].includes(value.state) || typeof value.expired !== 'boolean' ||
      !validTime(value.issuedAt) || !validTime(value.expiresAt) || !(value.withdrawnAt === null || validTime(value.withdrawnAt)))
    throw Error('Invalid Probe receipt; result remains unknown.');
  const result = value.result;
  let report = null;
  if (result !== null) {
    const body = result?.body;
    if (value.state !== 'consumed' || result?.historical !== true || typeof result.expired !== 'boolean' || body?.source !== 'agent-reported' ||
        body.applicationHealth !== 'unknown' || body.applicationPayloadBytes !== 0 || body.permitId !== id ||
        body.binding?.forwardId !== value.forwardId || !['connected', 'unreachable'].includes(body.status) ||
        body.code !== (body.status === 'connected' ? 'tcp-connected' : 'tcp-connect-failed') ||
        body.point !== 'agent-direct-egress' || !validTime(body.measuredAt) || !validTime(body.validUntil) ||
        body.issuedAt !== value.issuedAt || body.expiresAt !== value.expiresAt ||
        !Number.isSafeInteger(body.timeoutMs) || body.timeoutMs < 100 || body.timeoutMs > 2000 ||
        !Number.isSafeInteger(body.elapsedMs) || body.elapsedMs < 0 || body.elapsedMs > body.timeoutMs ||
        !Number.isSafeInteger(result.acceptedAt) || result.acceptedAt < Date.parse(body.measuredAt) ||
        result.acceptedAt >= Date.parse(body.validUntil) || Date.parse(body.measuredAt) < Date.parse(value.issuedAt) ||
        Date.parse(body.validUntil) > Date.parse(value.expiresAt))
      throw Error('Invalid historical Probe report; result remains unknown.');
    report = { source: 'agent-reported', historical: true, expired: result.expired, point: body.point,
      status: body.status, code: body.code, elapsedMs: body.elapsedMs, measuredAt: body.measuredAt, validUntil: body.validUntil,
      acceptedAt: new Date(result.acceptedAt).toISOString(), applicationPayloadBytes: 0, applicationHealth: 'unknown' };
  }
  return { probeId: id, forwardId: value.forwardId, state: value.state, expired: value.expired,
    issuedAt: value.issuedAt, expiresAt: value.expiresAt, withdrawnAt: value.withdrawnAt,
    health: 'unknown', executionEnabled: false, report };
}

export function initProbeConsole({ request, notify, byId, display, delay = pause, confirm = globalThis.confirm }) {
  const el = name => byId('probe-' + name);
  let selected = null, attempt = null, receipt = null, enabled = false, busy = false;
  let epoch = 0, readVersion = 0, capVersion = 0, session = new AbortController(), watching = null;
  function message(text) { el('state').textContent = text; }
  function sync() {
    el('issue').disabled = busy || !selected || (!attempt && !enabled) || Boolean(attempt?.acceptance);
    el('issue').textContent = attempt && !attempt.acceptance ? 'Replay Same Acceptance' : 'Issue One Task';
    el('timeout').disabled = busy || Boolean(attempt);
    el('consent').disabled = busy || Boolean(attempt);
    el('prepare').disabled = busy || !selected;
    el('query').disabled = busy || Boolean(watching);
    el('wait').disabled = busy || Boolean(watching);
    el('stop').disabled = !watching;
    el('revoke').disabled = busy || !receipt || Boolean(receipt.withdrawnAt) || ['revoked', 'quarantined'].includes(receipt.state);
    el('id').disabled = busy;
  }
  function stop() {
    ++readVersion;
    if (watching) watching.abort();
    watching = null;
    sync();
  }
  function clear() {
    epoch++; capVersion++; readVersion++; session.abort(); session = new AbortController();
    stop(); selected = attempt = receipt = null; enabled = busy = false;
    el('selected').textContent = 'Select a Direct TCP Forward from the Forward list.';
    el('capability').textContent = 'Issuance policy: unknown / default off.';
    el('id').value = ''; el('timeout').value = '500'; el('consent').checked = false;
    el('acceptance').textContent = ''; el('receipt').textContent = '';
    message('No task selected. Application health: unknown.'); sync();
  }
  function abandon() {
    return !attempt || Boolean(attempt.acceptance) || confirm('The previous submission may have been accepted. Losing its local key does not cancel it. Start a different explicit task?');
  }
  async function capabilities() {
    const version = epoch, sequence = ++capVersion;
    enabled = false; sync();
    try {
      const result = await request('GET', 'execution-capabilities', undefined, undefined, { signal: session.signal, timeoutMs: 3000 });
      if (version !== epoch || sequence !== capVersion) return;
      enabled = result.probeIssuanceEnabled === true;
      el('capability').textContent = enabled ? 'Control issuance: enabled. Agent opt-in, current authorization and delivery are NOT guaranteed.' :
        'Control issuance: disabled. Existing receipt queries and revocation remain available.';
    } catch (error) { if (version === epoch && sequence === capVersion) { el('capability').textContent = 'Issuance policy: unknown; new tasks disabled.'; notify(error.message, true); } }
    if (version === epoch && sequence === capVersion) sync();
  }
  async function open(forward) {
    if (busy || !abandon()) return;
    if (!validId(forward?.id) || !Number.isSafeInteger(forward.revision) || forward.revision < 1 ||
        forward.spec?.path || !forward.spec?.protocols?.includes('tcp')) throw Error('Select a Direct TCP Forward.');
    clear(); selected = Object.freeze({ id: forward.id, revision: forward.revision });
    el('selected').textContent = 'Forward ' + selected.id + ' / selected revision ' + selected.revision + ' (server rechecks current authority).';
    display('probes'); await capabilities();
  }
  async function prepare() {
    if (busy || !selected || !abandon()) return;
    stop(); attempt = null; el('acceptance').textContent = ''; el('consent').checked = false;
    message('A new explicit command requires fresh consent. No automatic task is scheduled.');
    await capabilities();
  }
  function idInput() {
    const id = el('id').value.trim();
    if (!validId(id)) throw Error('Enter a valid retained Probe ID.');
    return id;
  }
  async function read(id, version, read, signal) {
    const value = await request('GET', 'probes/' + encodeURIComponent(id), undefined, undefined, { signal, timeoutMs: 1500 });
    if (version !== epoch || read !== readVersion) return null;
    receipt = receiptView(value, id);
    el('receipt').textContent = JSON.stringify(receipt, null, 2);
    message(receipt.report ? 'Historical Agent-reported TCP observation only. Current application health: unknown.' :
      'No result received. Pending, expired, denied, cancelled and lost reports all remain unknown.');
    sync(); return receipt;
  }
  async function query() {
    if (busy) return;
    stop(); const version = epoch, readNumber = ++readVersion;
    receipt = null; el('receipt').textContent = ''; sync();
    try { await read(idInput(), version, readNumber, session.signal); }
    catch (error) { if (version === epoch && readNumber === readVersion) { message('Receipt unavailable (including unknown, pruned or forbidden IDs). Health: unknown.'); notify(error.message, true); } }
  }
  async function issue(event) {
    event?.preventDefault();
    if (busy || !selected || attempt?.acceptance) return;
    const version = epoch;
    try {
      if (!attempt) {
        const raw = el('timeout').value;
        if (!enabled || !el('consent').checked || !/^[1-9][0-9]*$/.test(raw) || Number(raw) < 100 || Number(raw) > 2000)
          throw Error('Explicit consent, enabled Control policy and a 100..2000 ms integer timeout are required.');
        attempt = { key: crypto.randomUUID(), resource: 'forwards/' + encodeURIComponent(selected.id) + '/probes',
          body: Object.freeze({ version: 1, kind: 'tcp-connect', expectedRevision: selected.revision, timeoutMs: Number(raw) }), acceptance: null };
      }
      busy = true; stop(); sync();
      const value = await request('POST', attempt.resource, attempt.body, attempt.key, { signal: session.signal, timeoutMs: 3000 });
      if (version !== epoch) return;
      if (!validId(value?.probeId) || value.forwardId !== selected.id || value.executionEnabled !== false ||
          value.dispatch !== 'agent-poll' || !validTime(value.issuedAt) || !validTime(value.expiresAt))
        throw Error('Invalid acceptance; submission remains uncertain.');
      attempt.acceptance = value;
      el('acceptance').textContent = JSON.stringify(value, null, 2);
      el('id').value = value.probeId; receipt = null; ++readVersion; el('receipt').textContent = '';
      message('Durably accepted only; delivery and execution are not guaranteed. Query the receipt; no new task will be retried automatically.');
    } catch (error) {
      if (version === epoch) {
        message(attempt ? 'Submission may be uncertain. Explicit replay uses the SAME key and body, never a new task. No result means unknown.' : 'No task submitted.');
        notify(error.message, true);
      }
    } finally { if (version === epoch) { busy = false; sync(); } }
  }
  async function wait() {
    if (busy || watching) return;
    const version = epoch, readNumber = ++readVersion, watch = new AbortController();
    let timer;
    try {
      const id = idInput(); watching = watch; receipt = null; el('receipt').textContent = ''; sync();
      const signal = AbortSignal.any([session.signal, watch.signal]);
      timer = setTimeout(() => watch.abort(), 5000);
      for (let count = 0; count < 8 && !signal.aborted; count++) {
        const value = await read(id, version, readNumber, signal);
        if (!value || value.report || value.expired || value.withdrawnAt || ['revoked', 'quarantined'].includes(value.state)) return;
        if (count < 7) await delay(400, signal);
      }
      if (version === epoch && readNumber === readVersion) message('Bounded receipt wait ended. No result means unknown; no replacement task is created.');
    } catch (error) {
      if (version === epoch && readNumber === readVersion) {
        message('Receipt wait stopped or failed. Last displayed data is historical; current health remains unknown.');
        if (!watch.signal.aborted) notify(error.message, true);
      }
    } finally {
      clearTimeout(timer); watch.abort();
      if (watching === watch) { watching = null; sync(); }
    }
  }
  async function revoke() {
    if (busy || !receipt || el('id').value.trim() !== receipt.probeId) return;
    const id = receipt.probeId, version = epoch;
    if (!confirm('Withdraw Probe ' + id + '? This cannot undo an already transmitted TCP SYN.')) return;
    stop(); ++readVersion; busy = true; sync();
    try {
      await request('POST', 'probes/' + encodeURIComponent(id) + '/revoke', {}, undefined, { signal: session.signal, timeoutMs: 3000 });
      if (version !== epoch) return;
      message('Withdrawal accepted. This does not erase history or undo a sent packet.');
    } catch (error) { if (version === epoch) { message('Withdrawal outcome unknown. Query retained state before assuming cancellation.'); notify(error.message, true); } }
    finally { if (version === epoch) { busy = false; sync(); } }
    if (version === epoch) await query();
  }
  el('form').addEventListener('submit', issue);
  el('prepare').addEventListener('click', prepare);
  el('query').addEventListener('click', query);
  el('wait').addEventListener('click', wait);
  el('stop').addEventListener('click', () => { stop(); message('Receipt wait stopped locally. This does NOT revoke the task.'); });
  el('revoke').addEventListener('click', revoke);
  el('id').addEventListener('input', () => { ++readVersion; stop(); receipt = null; el('receipt').textContent = ''; sync(); });
  clear();
  return { open, clear, capabilities, issue, query, revoke, wait, prepare, stop };
}
