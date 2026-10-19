const validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const closed = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const echoKind=kind=>kind==='tcp-ingress-echo'||kind==='udp-ingress-echo';
const serviceKind=kind=>kind==='tcp-ingress-tls'||echoKind(kind);
const descriptor = ingress => echoKind(ingress)?{measurement:ingress+'-v1',taskKind:ingress,point:'agent-local-direct-ingress',capability:'probe.'+ingress+'.v1',businessProtocol:ingress.startsWith('udp')?'udp':'tcp'}:ingress === 'tcp-ingress-tls' ? { measurement:'tcp-ingress-tls-v1',taskKind:'tcp-ingress-tls',
  point:'agent-local-direct-ingress',capability:'probe.tcp-ingress-tls.v1' } : ingress ? { measurement:'tcp-ingress-connect-v1',taskKind:'tcp-ingress-connect',
  point:'agent-local-direct-ingress',capability:'probe.tcp-ingress-connect.v1' } :
  { measurement:'tcp-connect-v1',taskKind:'tcp-connect',point:'agent-direct-egress',capability:'probe.tcp-connect.v1' };
const sameDescriptor = (value, ingress) => Object.entries(descriptor(ingress)).every(([key,item]) => value?.[key] === item);
const serviceId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const hash = value => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value) && value.length === 71;
const serviceReference = value => closed(value,['serviceId','revision','configRevision','configDigest']) && serviceId(value.serviceId) &&
  positive(value.revision) && positive(value.configRevision) && value.configRevision <=64 && value.revision >=value.configRevision && hash(value.configDigest);
const serviceSelection = value => closed(value,['scopeId','serviceId','revision','configRevision','configDigest','contextDigest']) && validId(value.scopeId) &&
  serviceReference(Object.fromEntries(['serviceId','revision','configRevision','configDigest'].map(key => [key,value[key]]))) && hash(value.contextDigest);
const matchesService = (selection, reference, scope) => serviceSelection(selection) && selection.scopeId === scope &&
  Object.keys(reference).every(key => selection[key] === reference[key]);
const tlsEvidence = value => closed(value,['version','alpn','leafFingerprint','verified']) && value.version === 'TLSv1.3' &&
  value.alpn === 'tunex-observation/1' && hash(value.leafFingerprint) && value.verified === true;
const acceptanceKeys = ['probeId','forwardId','issuedAt','expiresAt','dispatch','executionEnabled'];
const rawBase64=(value,length)=>{try{return typeof value==='string'&&atob(value).length===length&&btoa(atob(value))===value;}catch{return false;}};
const challenge=value=>closed(value,['nonce','invocationDigest'])&&rawBase64(value.nonce,32)&&hash(value.invocationDigest);
const echoEvidence=value=>closed(value,['algorithm','requestDigest','signature','verified'])&&value.algorithm==='Ed25519'&&hash(value.requestDigest)&&rawBase64(value.signature,64)&&value.verified===true;
function validAcceptance(value, kind, forward, service, scope) {
  const tls = kind === 'tcp-ingress-tls', echo=echoKind(kind), ingress = kind !== 'tcp-connect', classification = serviceKind(kind) ? kind : ingress;
  return closed(value,[...acceptanceKeys,...(ingress ? ['probeVersion',...Object.keys(descriptor(classification))] : []),...(serviceKind(kind) ? ['service'] : []),...(echo?['challenge']:[])]) &&
    (!ingress || value.probeVersion === (echo?4:tls ? 3 : 2) && sameDescriptor(value,classification)) && (!serviceKind(kind) || matchesService(value.service,service,scope)) && (!echo||challenge(value.challenge)) &&
    validId(value.probeId) && value.forwardId === forward &&
    value.executionEnabled === false && value.dispatch === 'agent-poll' && validTime(value.issuedAt) && validTime(value.expiresAt) &&
    Date.parse(value.expiresAt) > Date.parse(value.issuedAt) && Date.parse(value.expiresAt) - Date.parse(value.issuedAt) <= 2000;
}

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
}

function echoReceiptView(value, id, scope) {
  const kind = value.taskKind, description = descriptor(kind);
  const { businessProtocol, ...receiptDescription } = description;
  const keys = ['probeId','forwardId','state','expired','issuedAt','expiresAt','withdrawnAt','executionEnabled','health','result',...Object.keys(receiptDescription),'service'];
  if (!closed(value, keys) || !Object.entries(receiptDescription).every(([key, item]) => value[key] === item) ||
      value.probeId !== id || !validId(value.forwardId) || value.executionEnabled !== false || value.health !== 'unknown' ||
      !['issued','consumed','revoked','quarantined'].includes(value.state) || typeof value.expired !== 'boolean' ||
      !validTime(value.issuedAt) || !validTime(value.expiresAt) || Date.parse(value.expiresAt) <= Date.parse(value.issuedAt) ||
      Date.parse(value.expiresAt) - Date.parse(value.issuedAt) > 2000 || !(value.withdrawnAt === null || validTime(value.withdrawnAt)) ||
      !serviceSelection(value.service) || value.service.scopeId !== scope) throw Error('Invalid historical Echo receipt; result remains unknown.');
  let report = null;
  if (value.result !== null) {
    const result = value.result, body = result?.body;
    const bodyKeys = ['protocolVersion','probeVersion','kind','nodeId','bootId','sessionEpoch','instanceId','instanceGeneration','permitId','binding',
      'timeoutMs','issuedAt','expiresAt','consumedAt','measuredAt','validUntil','elapsedMs','point','status','code','applicationHealth','source',
      'applicationPayloadBytes','measurement','taskKind','capability','service','tls','businessProtocol','challenge','echo','requestBytes','responseBytes'];
    const bindingKeys = ['nodeId','bootId','sessionEpoch','snapshotGeneration','assignmentId','forwardId','forwardRevision','deploymentGeneration','bindingFence','configDigest','egressPolicyRevision'];
    if (!closed(result, ['body','resultDigest','acceptedAt','historical','expired']) || !hash(result.resultDigest) || result.historical !== true ||
        typeof result.expired !== 'boolean' || !closed(body, bodyKeys) || body.protocolVersion !== 3 || body.probeVersion !== 4 || body.kind !== 'probe-echo-result' ||
        !sameDescriptor(body, kind) || body.businessProtocol !== businessProtocol || body.permitId !== id || value.state !== 'consumed' ||
        !validId(body.nodeId) || !validId(body.bootId) || !positive(body.sessionEpoch) || typeof body.instanceId !== 'string' || !/^[a-f0-9]{64}$/.test(body.instanceId) || !positive(body.instanceGeneration) ||
        !closed(body.binding, bindingKeys) || !['nodeId','bootId','assignmentId','forwardId'].every(key => validId(body.binding[key])) ||
        !['sessionEpoch','snapshotGeneration','forwardRevision','deploymentGeneration','bindingFence','egressPolicyRevision'].every(key => positive(body.binding[key])) ||
        !hash(body.binding.configDigest) || body.binding.forwardId !== value.forwardId || body.binding.nodeId !== body.nodeId || body.binding.bootId !== body.bootId ||
        body.binding.sessionEpoch !== body.sessionEpoch || !serviceSelection(body.service) || Object.keys(value.service).some(key => body.service[key] !== value.service[key]) ||
        !challenge(body.challenge) || body.tls !== null || body.source !== 'agent-reported' || body.applicationHealth !== 'unknown' ||
        body.issuedAt !== value.issuedAt || body.expiresAt !== value.expiresAt || !validTime(body.consumedAt) || !validTime(body.measuredAt) || !validTime(body.validUntil) ||
        Date.parse(body.consumedAt) < Date.parse(body.issuedAt) || Date.parse(body.consumedAt) >= Date.parse(body.expiresAt) ||
        Date.parse(body.measuredAt) < Date.parse(body.consumedAt) || Date.parse(body.validUntil) <= Date.parse(body.measuredAt) || Date.parse(body.validUntil) > Date.parse(body.expiresAt) ||
        !Number.isSafeInteger(body.timeoutMs) || body.timeoutMs < 100 || body.timeoutMs > 2000 || !Number.isSafeInteger(body.elapsedMs) || body.elapsedMs < 0 || body.elapsedMs > body.timeoutMs ||
        !Number.isSafeInteger(result.acceptedAt) || result.acceptedAt < Date.parse(body.measuredAt) || result.acceptedAt >= Date.parse(body.validUntil) ||
        value.withdrawnAt !== null && result.acceptedAt > Date.parse(value.withdrawnAt) ||
        ![body.requestBytes,body.responseBytes].every(count => Number.isSafeInteger(count) && count >= 0 && count <= 256) ||
        body.applicationPayloadBytes !== body.requestBytes + body.responseBytes ||
        !(body.status === 'echoed' && body.code === 'nonce-echo-verified' && echoEvidence(body.echo) && body.requestBytes === 256 && body.responseBytes === 256 ||
          body.status === 'unverified' && body.code === 'nonce-echo-rejected' && body.echo === null && body.requestBytes === 256 ||
          businessProtocol === 'tcp' && body.status === 'unreachable' && body.code === 'tcp-connect-failed' && body.echo === null && body.requestBytes === 0 && body.responseBytes === 0))
      throw Error('Invalid historical Echo report; result remains unknown.');
    report = { source: 'agent-reported', historical: true, expired: result.expired, ...description,
      status: body.status, code: body.code, elapsedMs: body.elapsedMs, measuredAt: body.measuredAt, validUntil: body.validUntil,
      acceptedAt: new Date(result.acceptedAt).toISOString(), service: body.service, challenge: body.challenge, echo: body.echo,
      requestBytes: body.requestBytes, responseBytes: body.responseBytes, applicationPayloadBytes: body.applicationPayloadBytes, applicationHealth: 'unknown',
      proofVerification: 'stored-evidence-not-reverified-by-browser' };
  }
  return { probeId: id, forwardId: value.forwardId, state: value.state, expired: value.expired,
    issuedAt: value.issuedAt, expiresAt: value.expiresAt, withdrawnAt: value.withdrawnAt,
    health: 'unknown', executionEnabled: false, report, ...description, service: value.service };
}

// This is a historical display projection, never a source of health or execution authority.
function receiptView(value, id, scope) {
  if(echoKind(value?.taskKind))return echoReceiptView(value,id,scope);
  const tls = value?.measurement === 'tcp-ingress-tls-v1', ingress = tls || value?.measurement === 'tcp-ingress-connect-v1';
  const classification = tls ? 'tcp-ingress-tls' : ingress;
  const receiptKeys = ['probeId','forwardId','state','expired','issuedAt','expiresAt','withdrawnAt','executionEnabled','health','result'];
  if (!closed(value,[...receiptKeys,...(ingress ? Object.keys(descriptor(classification)) : []),...(tls ? ['service'] : [])]) || ingress && !sameDescriptor(value,classification) ||
      tls && (!serviceSelection(value.service) || value.service.scopeId !== scope) ||
      value?.probeId !== id || !validId(value.forwardId) || value.executionEnabled !== false || value.health !== 'unknown' ||
      !['issued', 'consumed', 'revoked', 'quarantined'].includes(value.state) || typeof value.expired !== 'boolean' ||
      !validTime(value.issuedAt) || !validTime(value.expiresAt) || !(value.withdrawnAt === null || validTime(value.withdrawnAt)))
    throw Error('Invalid Probe receipt; result remains unknown.');
  const result = value.result;
  let report = null;
  if (result !== null) {
    const body = result?.body;
    const v4=body?.probeVersion===4, services = body?.probeVersion === 3||v4, typed = body?.probeVersion === 2 || services;
    if(v4){
      if(!closed(body,[...['protocolVersion','probeVersion','kind','nodeId','bootId','sessionEpoch','instanceId','instanceGeneration','permitId','binding','timeoutMs','issuedAt','expiresAt','consumedAt','measuredAt','validUntil','elapsedMs','point','status','code','applicationHealth','source','applicationPayloadBytes','measurement','taskKind','capability','service','tls'], 'businessProtocol','challenge','echo','requestBytes','responseBytes'])||body.businessProtocol!=='tcp'||body.challenge!==null||body.echo!==null||body.requestBytes!==0||body.responseBytes!==0)throw Error('Invalid v4 compatibility result.');
      const normalized={...body,probeVersion:3,kind:'probe-services-result'};for(const key of ['businessProtocol','challenge','echo','requestBytes','responseBytes'])delete normalized[key];
      return receiptView({...value,result:{...result,body:normalized}},id,scope);
    }
    const bodyKeys = ['protocolVersion','probeVersion','kind','nodeId','bootId','sessionEpoch','instanceId','instanceGeneration','permitId',
      'binding','timeoutMs','issuedAt','expiresAt','consumedAt','measuredAt','validUntil','elapsedMs','point','status','code','applicationHealth','source','applicationPayloadBytes'];
    if (!closed(result,['body','resultDigest','acceptedAt','historical','expired']) || !hash(result.resultDigest) ||
        !closed(body,[...bodyKeys,...(typed ? ['measurement','taskKind','capability'] : []),...(services ? ['service','tls'] : [])]) ||
        body.protocolVersion !== 3 || (typed ? body.kind !== (services ? 'probe-services-result' : 'probe-types-result') || !sameDescriptor(body,classification) || tls && !services :
          ingress || body.probeVersion !== 1 || body.kind !== 'probe-result' || body.point !== 'agent-direct-egress') ||
        value.state !== 'consumed' || result?.historical !== true || typeof result.expired !== 'boolean' || body?.source !== 'agent-reported' ||
        body.applicationHealth !== 'unknown' || body.applicationPayloadBytes !== 0 || body.permitId !== id ||
        body.binding?.forwardId !== value.forwardId || !(tls ? ['verified','unverified','unreachable'] : ['connected','unreachable']).includes(body.status) ||
        body.code !== (body.status === 'verified' ? 'tls-handshake-verified' : body.status === 'unverified' ? 'tls-handshake-failed' :
          body.status === 'connected' ? 'tcp-connected' : 'tcp-connect-failed') ||
        services && (tls ? !serviceSelection(body.service) || Object.keys(value.service).some(key => body.service[key] !== value.service[key]) ||
          (body.status === 'verified' ? !tlsEvidence(body.tls) : body.tls !== null) : body.service !== null || body.tls !== null) ||
        !validTime(body.measuredAt) || !validTime(body.validUntil) ||
        body.issuedAt !== value.issuedAt || body.expiresAt !== value.expiresAt ||
        !Number.isSafeInteger(body.timeoutMs) || body.timeoutMs < 100 || body.timeoutMs > 2000 ||
        !Number.isSafeInteger(body.elapsedMs) || body.elapsedMs < 0 || body.elapsedMs > body.timeoutMs ||
        !Number.isSafeInteger(result.acceptedAt) || result.acceptedAt < Date.parse(body.measuredAt) ||
        result.acceptedAt >= Date.parse(body.validUntil) || Date.parse(body.measuredAt) < Date.parse(value.issuedAt) ||
        Date.parse(body.validUntil) > Date.parse(value.expiresAt))
      throw Error('Invalid historical Probe report; result remains unknown.');
    report = { source: 'agent-reported', historical: true, expired: result.expired, point: body.point,
      status: body.status, code: body.code, elapsedMs: body.elapsedMs, measuredAt: body.measuredAt, validUntil: body.validUntil,
      acceptedAt: new Date(result.acceptedAt).toISOString(), applicationPayloadBytes: 0, applicationHealth: 'unknown',
      ...(typed ? descriptor(classification) : {}), ...(services ? {service:body.service,tls:body.tls} : {}) };
  }
  return { probeId: id, forwardId: value.forwardId, state: value.state, expired: value.expired,
    issuedAt: value.issuedAt, expiresAt: value.expiresAt, withdrawnAt: value.withdrawnAt,
    health: 'unknown', executionEnabled: false, report, ...(ingress ? descriptor(classification) : {}), ...(tls ? {service:value.service} : {}) };
}

export function initProbeConsole({ request, notify, byId, display, getScope = () => '', delay = pause, confirm = globalThis.confirm }) {
  const el = name => byId('probe-' + name);
  const serviceInputs = ['service-id','service-revision','service-config-revision','service-digest'];
  let selected = null, attempt = null, receipt = null, enabled = false, ingressEnabled = false, servicesEnabled = false, busy = false;
  const issuanceEnabled = () => el('kind').value === 'tcp-ingress-tls' ? servicesEnabled : el('kind').value === 'tcp-ingress-connect' ? ingressEnabled : enabled;
  let epoch = 0, readVersion = 0, capVersion = 0, session = new AbortController(), watching = null;
  function message(text) { el('state').textContent = text; }
  function sync() {
    el('issue').disabled = busy || !selected || (!attempt && !issuanceEnabled()) || Boolean(attempt?.acceptance);
    el('issue').textContent = attempt && !attempt.acceptance ? 'Replay Same Acceptance' : 'Issue One Task';
    el('timeout').disabled = busy || Boolean(attempt);
    el('kind').disabled = busy || Boolean(attempt);
    for (const name of serviceInputs) el(name).disabled = busy || Boolean(attempt) || el('kind').value !== 'tcp-ingress-tls';
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
    stop(); selected = attempt = receipt = null; enabled = ingressEnabled = servicesEnabled = busy = false;
    el('selected').textContent = 'Select a Direct TCP Forward from the Forward list.';
    el('capability').textContent = 'Issuance policy: unknown / default off.';
    el('id').value = ''; el('kind').value = 'tcp-connect'; el('timeout').value = '500'; el('consent').checked = false;
    for (const name of serviceInputs) el(name).value = '';
    el('acceptance').textContent = ''; el('receipt').textContent = '';
    message('No task selected. Application health: unknown.'); sync();
  }
  function abandon() {
    return !attempt || Boolean(attempt.acceptance) || confirm('The previous submission may have been accepted. Losing its local key does not cancel it. Start a different explicit task?');
  }
  async function capabilities() {
    const version = epoch, sequence = ++capVersion;
    enabled = ingressEnabled = servicesEnabled = false; sync();
    try {
      const result = await request('GET', 'execution-capabilities', undefined, undefined, { signal: session.signal, timeoutMs: 3000 });
      if (version !== epoch || sequence !== capVersion) return;
      enabled = result.probeIssuanceEnabled === true;
      ingressEnabled = enabled && result.probeIngressIssuanceEnabled === true;
      servicesEnabled = ingressEnabled && result.probeServicesIssuanceEnabled === true;
      el('capability').textContent = 'Control egress issuance=' + enabled + '; local-ingress issuance=' + ingressEnabled +
        '; controlled TLS issuance=' + servicesEnabled + '. Configuration is not Agent opt-in, trust, delivery or liveness proof. Receipt reads and revocation remain separate.';
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
    receipt = receiptView(value, id, getScope());
    el('receipt').textContent = JSON.stringify(receipt, null, 2);
    message(receipt.report ? echoKind(receipt.taskKind) ? 'Historical Agent-reported ' + receipt.businessProtocol.toUpperCase() + ' echo observation only. Current application health: unknown.' : 'Historical Agent-reported TCP observation only. Current application health: unknown.' :
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
        if (!issuanceEnabled() || !['tcp-connect','tcp-ingress-connect','tcp-ingress-tls'].includes(el('kind').value) || !el('consent').checked || !/^[1-9][0-9]*$/.test(raw) || Number(raw) < 100 || Number(raw) > 2000)
          throw Error('Explicit consent, enabled Control policy and a 100..2000 ms integer timeout are required.');
        let service;
        if (el('kind').value === 'tcp-ingress-tls') {
          const revision = el('service-revision').value, configRevision = el('service-config-revision').value;
          service = Object.freeze({serviceId:el('service-id').value.trim(),revision:Number(revision),configRevision:Number(configRevision),configDigest:el('service-digest').value.trim()});
          if (!/^[1-9][0-9]*$/.test(revision) || !/^[1-9][0-9]*$/.test(configRevision) || !serviceReference(service) || !validId(getScope()))
            throw Error('TLS needs the exact current service ID, metadata CAS, config revision and digest from the manager registry; no latest lookup or certificate input.');
        }
        attempt = { key: crypto.randomUUID(), resource: 'forwards/' + encodeURIComponent(selected.id) + '/probes',
          scope:getScope(), body: Object.freeze({ version: 1, kind: el('kind').value, expectedRevision: selected.revision, timeoutMs: Number(raw),...(service ? {service} : {}) }), acceptance: null };
      }
      if (attempt.scope !== getScope()) throw Error('Scope changed; the original command cannot be sent under another Scope.');
      busy = true; stop(); sync();
      const value = await request('POST', attempt.resource, attempt.body, attempt.key, { signal: session.signal, timeoutMs: 3000 });
      if (version !== epoch) return;
      if (!validAcceptance(value,attempt.body.kind,selected.id,attempt.body.service,attempt.scope))
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
  el('kind').addEventListener('change', () => { if (attempt) return; el('consent').checked = false; stop();
    message('Observation kind changed. Fresh explicit consent required; local ingress is not external reachability or application health.'); sync(); });
  for (const name of serviceInputs) el(name).addEventListener('input', () => { if (!attempt) { el('consent').checked = false; sync(); } });
  el('prepare').addEventListener('click', prepare);
  el('query').addEventListener('click', query);
  el('wait').addEventListener('click', wait);
  el('stop').addEventListener('click', () => { stop(); message('Receipt wait stopped locally. This does NOT revoke the task.'); });
  el('revoke').addEventListener('click', revoke);
  el('id').addEventListener('input', () => { ++readVersion; stop(); receipt = null; el('receipt').textContent = ''; sync(); });
  clear();
  return { open, clear, capabilities, issue, query, revoke, wait, prepare, stop };
}
