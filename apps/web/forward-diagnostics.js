const limits = { nodes: 8, operations: 8, listeners: 16, slots: 16, retirements: 32, leases: 32, probes: 8,
  responseBytes: 131072, supportBytes: 65536, activeRequests: 2, actorKeys: 128, cooldownMs: 1000 };
const uint = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => uint(value) && value > 0;
const bool = value => typeof value === 'boolean';
const id = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) && !/\s/.test(value);
const hash = value => typeof value === 'string' && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value);
const instant = value => typeof value === 'string' && uint(Date.parse(value)) && new Date(value).toISOString() === value;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const shape = fields => value => record(value) && Object.keys(value).length === Object.keys(fields).length &&
  Object.entries(fields).every(([key, valid]) => Object.hasOwn(value, key) && valid(value[key]));
const one = (...values) => value => values.includes(value);
const nullable = valid => value => value === null || valid(value);
const array = (valid, max, min = 0) => value => Array.isArray(value) && value.length >= min && value.length <= max && value.every(valid);
const protocol = one('tcp','udp');
const protocols = value => array(protocol, 2, 1)(value) && new Set(value).size === value.length;
const alias = kind => value => typeof value === 'string' && new RegExp('^' + kind + '-[1-9][0-9]{0,3}$').test(value);
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : record(value) ?
  '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const equal = (a, b) => canonical(a) === canonical(b);
async function digest(value) {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return 'sha256:' + Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
}
const flags = { source: one('persisted-control-and-agent-state'), readOnly: one(true), networkCheck: one('not-performed'),
  executionAuthorized: one(false), health: one('unknown'), consistency: one('read-committed-not-global-snapshot'),
  snapshotDigestVerification: one('projected-not-recomputed') };
const codes = one('AUTHORIZATION_DENIED','EXECUTION_DEADLINE','INTEGRITY_FAILURE','INVALID_CONFIG','UNSUPPORTED_CAPABILITY',
  'RESOURCE_CONFLICT','RESOURCE_LIMIT','PORT_RESERVED','FENCING_REJECTED','LEASE_EXPIRED','SESSION_SUPERSEDED','LISTEN_FAILED',
  'BIND_FAILED','TARGET_DENIED','CONNECT_FAILED','DIAL_FAILED','PEER_UNAVAILABLE','TLS_FAILED','RELAY_HANDSHAKE_FAILED',
  'DRAIN_TIMEOUT','INTERNAL_ERROR','CLOCK_UNCERTAIN','CONFIG_DIGEST_MISMATCH','AUTHENTICATION_FAILED','TARGET_REJECTED',
  'DOWNSTREAM_NOT_ACTIVE','DOWNSTREAM_UNAVAILABLE','TARGET_UNAVAILABLE','PORT_IN_USE','OTHER_ERROR');
const reasons = one('recent-report','node-revoked','credential-expired','invalid-evidence','missing-snapshot','missing-report',
  'session-mismatch','snapshot-mismatch','clock-skew','snapshot-expired','report-expired');
const operationKinds = one('create','update','enable','disable','delete','retry','policy','revoke');
const operationStates = one('accepted','running','succeeded','failed','superseded');
const roles = one('direct','relay-ingress','relay-egress','multihop-ingress','multihop-transit','multihop-egress');
const phases = one('prepared','active','draining');
const relation = one('current-intent','historical-intent');
const reservation = one('not-present-in-bounded-owned-slots','owned-exact-tuple','owned-different-tuple');
const nextStep = one('review-current-permissions-and-lease','review-reservations-and-cleanup','review-config-and-protected-state',
  'inspect-operation-and-cleanup-before-explicit-retry','inspect-peer-and-target-with-explicit-probe','inspect-original-owner-diagnostics');
const reportContext = { observedAt: instant, receivedAt: instant, reportSequence: positive, sessionEpoch: positive, snapshotGeneration: positive, matchesNodeEvidence: bool };
const observationShape = shape({ phase: one('prepared','active','draining','absent'), condition: one('pending','prepared','ready','degraded','error','draining','removed'),
  errorCode: nullable(codes), retryable: bool, nextStep: nullable(nextStep), ...reportContext, phaseMatches: bool, source: one('agent-reported') });
const observation = value => observationShape(value) && (value.errorCode === null) === (value.nextStep === null);
const drain = shape({ startedAt: instant, deadline: instant, remainingConnections: uint, condition: one('draining','removed'), ...reportContext, source: one('agent-reported') });
const freshness = shape({ status: one('fresh','stale','unknown'), reason: reasons, expiresAt: nullable(instant), reportAgeMs: nullable(uint) });
const measurement = one('tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1');
const point = one('agent-direct-egress','agent-local-direct-ingress');
const tlsProof = { version: one('TLSv1.3'), alpn: one('tunex-observation/1'), verified: one(true) };
const resultFields = { status: one('connected','unreachable','verified','unverified'),
  code: one('tcp-connected','tcp-connect-failed','tls-handshake-verified','tls-handshake-failed'), measuredAt: instant, validUntil: instant,
  acceptedAt: instant, elapsedMs: uint, point, source: one('agent-reported'), applicationHealth: one('unknown'),
  applicationPayloadBytes: one(0), windowOpen: bool };
const result = shape({ ...resultFields, tls: nullable(shape(tlsProof)) });
const rawResult = shape({ ...resultFields, tls: nullable(shape({ ...tlsProof, leafFingerprint: hash })) });
const compactService = shape({ scopeId: id, serviceId: value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value),
  revision: positive, configRevision: value => positive(value) && value <= 64, configDigest: hash, contextDigest: hash });
function probeConsistent(row, raw = false) {
  const ingressTLS = row.measurement === 'tcp-ingress-tls-v1';
  if (row.point !== (row.measurement === 'tcp-connect-v1' ? 'agent-direct-egress' : 'agent-local-direct-ingress') ||
      raw && ingressTLS !== (row.service !== null)) return false;
  const value = row.result;
  if (value === null) return true;
  return value.point === row.point && (ingressTLS ?
    value.status === 'verified' && value.code === 'tls-handshake-verified' && value.tls !== null ||
    value.status === 'unverified' && value.code === 'tls-handshake-failed' && value.tls === null ||
    value.status === 'unreachable' && value.code === 'tcp-connect-failed' && value.tls === null :
    value.tls === null && (value.status === 'connected' && value.code === 'tcp-connected' || value.status === 'unreachable' && value.code === 'tcp-connect-failed'));
}
function safeProbeResult(value) {
  if (value === null) return null;
  return { ...Object.fromEntries(Object.keys(resultFields).map(key => [key, value[key]])),
    tls: value.tls === null ? null : { version: value.tls.version, alpn: value.tls.alpn, verified: value.tls.verified } };
}
const binding = { node: alias('node'), assignment: alias('assignment'), deploymentGeneration: positive, bindingFence: positive };
const page = (valid, limit) => shape({ limit: one(limit), truncated: bool, items: array(valid, limit) });
const error = nullable(shape({ code: codes, retryable: nullable(bool), nextStep }));
const exclusions = ['original-identifiers','network-addresses-and-ports','targets-and-endpoints','profiles-and-config-digests','policies',
  'raw-wire-and-audit-bodies','free-text-errors','actors-and-request-keys','credentials','protected-state','observation-identifiers-and-trust-pins'];
// This closed schema rejects unknown fields and arbitrary strings before support data can leave the panel.
const supportValid = shape({ supportVersion: one(1), redacted: one(true), scope: one('scope-1'), forward: one('forward-1'), capturedAt: instant, ...flags,
  exclusions: value => equal(value, exclusions),
  intent: shape({ revision: positive, enabled: bool, deleting: bool, recoverySuspended: bool, mode: one('direct','relay','multihop'), protocols,
    nodes: array(alias('node'), 8, 1) }),
  operations: page(shape({ operation: alias('operation'), sourceOperation: nullable(alias('operation')), targetRevision: positive, kind: operationKinds,
    status: operationStates, createdAt: instant, updatedAt: instant, executionDeadline: instant, cleanupPending: bool, recoveryInvalidated: bool, error }), 8),
  deployment: nullable(shape({ generation: positive, targetRevision: positive, stage: one('preparing','egress_active','ingress_active','active','withdrawn'),
    matchesIntent: bool, createdAt: instant, updatedAt: instant, authorizationUntil: instant, trafficVerified: one(false) })),
  nodes: array(shape({ node: alias('node'), position: positive, role: one('direct','ingress','egress','transit'), evidence: nullable(shape({ revoked: bool,
    credentialWindowOpen: bool, sessionEpoch: uint, snapshotGeneration: uint, reportSequence: uint, receivedAt: nullable(instant), observation: freshness,
    sessionCurrent: bool, snapshotCurrent: bool })) }), 8, 1),
  listeners: page(shape({ ...binding, sessionEpoch: positive, snapshotGeneration: positive, forwardRevision: positive, role: roles, protocol,
    physicalProtocol: protocol, phase: phases, driverId: one('native.direct.v1','native.relay.v1','native.multihop.v1'), relation, nodeEvidenceMatches: bool, reportFresh: bool,
    observation: nullable(observation), drain: nullable(drain), reservation, listeningSocket: one('not-independently-verified') }), 16),
  adjacentSegments: array(shape({ position: positive, fromNode: alias('node'), toNode: alias('node'), carrier: one('tcp-tls'), connectivity: one('unknown'),
    protocols: array(shape({ protocol, identityCorrelated: bool }), 2, 1) }), 7),
  target: shape({ node: alias('node'), protocols, connectivity: one('unknown'), applicationHealth: one('unknown'),
    configurations: array(shape({ assignment: alias('assignment'), protocol, forwardRevision: positive, matchesIntent: bool }), 16) }),
  probe: shape({ support: one('direct-tcp-ip-shape','unsupported-shape'), limit: one(8), truncated: bool, historyComplete: one(false),
    items: array(shape({ permit: alias('permit'), ...binding, sessionEpoch: positive, snapshotGeneration: positive, forwardRevision: positive,
      state: one('issued','consumed','revoked','quarantined'), issuedAt: instant, expiresAt: instant, closedAt: nullable(instant), withdrawnAt: nullable(instant),
      measurement, point, bindingMatchesCurrent: bool, result: nullable(result), health: one('unknown'), executionAuthorized: one(false) }), 8) }),
  cleanup: shape({ complete: one(false), slots: page(shape({ node: alias('node'), protocol, fence: positive, deploymentGeneration: positive }), 16),
    retirements: page(shape({ ...binding, operation: alias('operation'), removedEpoch: nullable(uint), retirementGeneration: nullable(positive), safe: bool }), 32),
    leases: page(shape({ ...binding, sessionEpoch: positive, validUntil: instant, windowOpen: bool, source: one('historical-issued-lease'),
      currentAuthorization: one('not-rechecked') }), 32) }) });
const endpoint = shape({ host: value => typeof value === 'string' && value.length > 0 && value.length <= 253 && !/\s/.test(value),
  port: value => positive(value) && value <= 65535 });
const rawTuple = { nodeId: id, assignmentId: id, deploymentGeneration: positive, bindingFence: positive };
const listener = shape({ ...rawTuple, sessionEpoch: positive, snapshotGeneration: positive, forwardRevision: positive, role: roles, protocol, phase: phases,
  driverId: one('native.direct.v1','native.relay.v1','native.multihop.v1'), configDigest: hash,
  resource: shape({ address: value => typeof value === 'string' && value.length <= 127 && !/\s/.test(value), port: value => positive(value) && value <= 65535, protocol }),
  target: nullable(endpoint), peerEndpoint: nullable(endpoint), linkKind: one('none','relay-binding','hop-path'), linkDigest: nullable(hash), relation, nodeEvidenceMatches: bool, reportFresh: bool,
  observation: nullable(observation), drain: nullable(drain), reservation, listeningSocket: one('not-independently-verified'), health: one('unknown') });
const nodeEvidence = shape({ nodeId: id, revoked: bool, credentialUntil: nullable(instant), credentialWindowOpen: bool, bootId: nullable(id),
  sessionEpoch: uint, snapshotGeneration: uint, reportSequence: uint, receivedAt: nullable(instant),
  snapshot: nullable(shape({ nodeId: id, sessionEpoch: positive, generation: positive, issuedAt: instant, validUntil: instant, digest: hash })),
  report: nullable(shape({ nodeId: id, bootId: id, sessionEpoch: positive, sequence: positive, snapshotGeneration: uint, observedAt: instant })),
  observation: freshness, sessionCurrent: bool, snapshotCurrent: bool, source: one('persisted-node-and-agent-report'), health: one('unknown') });
const operation = shape({ id, forwardId: id, targetRevision: positive, kind: operationKinds, status: operationStates, createdAt: instant, updatedAt: instant,
  executionDeadline: instant, cleanupPending: bool, recoveryInvalidated: bool, sourceOperationId: nullable(id), error });
const deployment = nullable(shape({ generation: positive, targetRevision: positive, stage: one('preparing','egress_active','ingress_active','active','withdrawn'),
  createdAt: instant, updatedAt: instant, authorizationUntil: instant, planDigest: hash, matchesIntent: bool,
  source: one('persisted-relay-deployment'), trafficVerified: one(false) }));
const rawProbe = shape({ permitId: id, binding: shape({ nodeId: id, bootId: id, sessionEpoch: positive, snapshotGeneration: positive, assignmentId: id,
  forwardRevision: positive, deploymentGeneration: positive, bindingFence: positive, configDigest: hash, egressPolicyRevision: positive }),
  state: one('issued','consumed','revoked','quarantined'), issuedAt: instant, expiresAt: instant, closedAt: nullable(instant), withdrawnAt: nullable(instant),
  measurement, point, service: nullable(compactService), bindingMatchesCurrent: bool, result: nullable(rawResult), health: one('unknown'), executionAuthorized: one(false) });
const rawCleanup = shape({ complete: one(false), source: one('bounded-original-runtime-records'),
  slots: page(shape({ nodeId: id, protocol, port: value => positive(value) && value <= 65535, fence: positive, deploymentGeneration: positive }), 16),
  retirements: page(shape({ ...rawTuple, operationId: id, removedEpoch: nullable(uint), retirementGeneration: nullable(positive), safe: bool }), 32),
  leases: page(shape({ ...rawTuple, sessionEpoch: positive, validUntil: instant, windowOpen: bool, source: one('historical-issued-lease'),
    currentAuthorization: one('not-rechecked') }), 32) });
function sameReadProjection(data) {
  const aliases = new Map();
  const name = (kind, value) => {
    if (value === null) return null;
    const key = kind + '\0' + value;
    if (!aliases.has(key)) aliases.set(key, kind + '-' + (1 + [...aliases.keys()].filter(item => item.startsWith(kind + '\0')).length));
    return aliases.get(key);
  };
  const tuple = row => ({ node: name('node', row.nodeId), assignment: name('assignment', row.assignmentId), deploymentGeneration: row.deploymentGeneration, bindingFence: row.bindingFence });
  const pick = (row, keys) => Object.fromEntries(keys.split(' ').map(key => [key, row[key]]));
  const mapped = (value, project) => ({ limit: value.limit, truncated: value.truncated, items: value.items.map(project) });
  return { supportVersion: 1, redacted: true, scope: 'scope-1', forward: 'forward-1', capturedAt: data.capturedAt,
    ...pick(data, Object.keys(flags).join(' ')), exclusions,
    intent: { ...pick(data.intent, 'revision enabled deleting recoverySuspended mode protocols'), nodes: data.intent.path.map(value => name('node', value)) },
    operations: mapped(data.operations, row => ({ operation: name('operation', row.id), sourceOperation: name('operation', row.sourceOperationId),
      ...pick(row, 'targetRevision kind status createdAt updatedAt executionDeadline cleanupPending recoveryInvalidated error') })),
    deployment: data.deployment === null ? null : pick(data.deployment, 'generation targetRevision stage matchesIntent createdAt updatedAt authorizationUntil trafficVerified'),
    nodes: data.nodes.map(row => ({ node: name('node', row.nodeId), position: row.position, role: row.role,
      evidence: row.evidence === null ? null : pick(row.evidence, 'revoked credentialWindowOpen sessionEpoch snapshotGeneration reportSequence receivedAt observation sessionCurrent snapshotCurrent') })),
    listeners: mapped(data.listeners, row => ({ ...tuple(row), ...pick(row, 'sessionEpoch snapshotGeneration forwardRevision role protocol'), physicalProtocol: row.resource.protocol,
      ...pick(row, 'phase driverId relation nodeEvidenceMatches reportFresh observation drain reservation listeningSocket') })),
    adjacentSegments: data.adjacentSegments.map(row => ({ position: row.position, fromNode: name('node', row.fromNodeId), toNode: name('node', row.toNodeId),
      carrier: row.carrier, connectivity: 'unknown', protocols: row.protocols.map(value => pick(value, 'protocol identityCorrelated')) })),
    target: { node: name('node', data.target.nodeId), protocols: data.target.protocols, connectivity: 'unknown', applicationHealth: 'unknown',
      configurations: data.target.configurations.map(row => ({ assignment: name('assignment', row.assignmentId), ...pick(row, 'protocol forwardRevision matchesIntent') })) },
    probe: { support: data.probe.support, limit: data.probe.limit, truncated: data.probe.truncated, historyComplete: false,
      items: data.probe.items.map(row => ({ permit: name('permit', row.permitId), ...tuple(row.binding), ...pick(row.binding, 'sessionEpoch snapshotGeneration forwardRevision'),
        ...pick(row, 'state issuedAt expiresAt closedAt withdrawnAt measurement point bindingMatchesCurrent health executionAuthorized'), result: safeProbeResult(row.result) })) },
    cleanup: { complete: false,
      slots: mapped(data.cleanup.slots, row => ({ node: name('node', row.nodeId), ...pick(row, 'protocol fence deploymentGeneration') })),
      retirements: mapped(data.cleanup.retirements, row => ({ ...tuple(row), operation: name('operation', row.operationId), ...pick(row, 'removedEpoch retirementGeneration safe') })),
      leases: mapped(data.cleanup.leases, row => ({ ...tuple(row), ...pick(row, 'sessionEpoch validUntil windowOpen source currentAuthorization') })) } };
}
async function valid(data, forward, scope) {
  const keys = ['diagnosticVersion','scopeId','capturedAt',...Object.keys(flags),'limits','intent','operations','deployment','nodes','listeners','adjacentSegments','target','probe','cleanup','support'];
  if (!record(data) || Object.keys(data).length !== keys.length || !keys.every(key => Object.hasOwn(data, key)) || bytes(data) > limits.responseBytes ||
      data.diagnosticVersion !== 1 || data.scopeId !== scope || !instant(data.capturedAt) ||
      !Object.entries(flags).every(([key, check]) => check(data[key])) || !equal(data.limits, limits) ||
      !shape({ forwardId: one(forward), revision: positive, specDigest: hash, enabled: bool, deleting: bool, recoverySuspended: bool, protocols,
        mode: one('direct','relay','multihop'), path: array(id, 8, 1), listen: shape({ address: value => typeof value === 'string' && value.length <= 127,
          port: value => positive(value) && value <= 65535 }), transport: nullable(shape({ profileId: id, configRevision: positive })) })(data.intent) ||
      !page(listener, 16)(data.listeners) || !Array.isArray(data.nodes) || data.nodes.length !== data.intent.path.length ||
      !Array.isArray(data.adjacentSegments) || data.adjacentSegments.length !== data.intent.path.length - 1 ||
      !record(data.support) || !shape({ redacted: one(true), sameRead: one(true), bytes: positive, digest: hash, bundle: supportValid })(data.support)) return false;
  const support = data.support, bundle = support.bundle;
  if (support.bytes > limits.supportBytes || bytes(bundle) !== support.bytes || await digest(bundle) !== support.digest || bundle.capturedAt !== data.capturedAt ||
      bundle.intent.revision !== data.intent.revision || bundle.intent.enabled !== data.intent.enabled || bundle.intent.deleting !== data.intent.deleting ||
      bundle.intent.recoverySuspended !== data.intent.recoverySuspended || bundle.intent.mode !== data.intent.mode || !equal(bundle.intent.protocols, data.intent.protocols) ||
      bundle.nodes.length !== data.nodes.length || bundle.listeners.items.length !== data.listeners.items.length ||
      bundle.listeners.truncated !== data.listeners.truncated || bundle.adjacentSegments.length !== data.adjacentSegments.length) return false;
  return page(operation, 8)(data.operations) && data.operations.items.every(row => row.forwardId === forward) && deployment(data.deployment) &&
    shape({ support: one('direct-tcp-ip-shape','unsupported-shape'), source: one('retained-original-permits-and-agent-results'), historyComplete: one(false),
      retention: one('ephemeral-original-permits'), limit: one(8), truncated: bool, items: array(rawProbe, 8) })(data.probe) &&
    data.probe.items.every(row => probeConsistent(row,true) && (row.service === null || row.service.scopeId === scope && row.service.revision >= row.service.configRevision)) &&
    bundle.probe.items.every(row => probeConsistent(row)) && rawCleanup(data.cleanup) &&
    shape({ nodeId: id, endpoint, protocols, source: one('desired-target-and-published-config'), connectivity: one('unknown'), applicationHealth: one('unknown'),
      configurations: array(shape({ assignmentId: id, protocol, forwardRevision: positive, matchesIntent: bool }), 16) })(data.target) &&
    data.target.nodeId === data.intent.path.at(-1) && data.nodes.every((node, index) =>
      shape({ position: positive, role: one('direct','ingress','egress','transit'), nodeId: id, evidence: nullable(nodeEvidence) })(node) &&
      node.nodeId === data.intent.path[index] && node.position === index + 1 && (node.evidence === null || node.evidence.nodeId === node.nodeId)) &&
    data.adjacentSegments.every((segment, index) => shape({ position: positive, fromNodeId: id, toNodeId: id, carrier: one('tcp-tls'),
      source: one('configured-native-path'), connectivity: one('unknown'), protocols: array(shape({ protocol, fromAssignmentId: nullable(id),
        toAssignmentId: nullable(id), identityCorrelated: bool, peerEndpoint: nullable(endpoint) }), 2, 1) })(segment) && segment.position === index + 1 &&
      segment.fromNodeId === data.intent.path[index] && segment.toNodeId === data.intent.path[index + 1]) && equal(bundle, sameReadProjection(data));
}
const stamp = value => value === null ? '未知 / 无记录（不是零）' : value + '\nAsia/Shanghai: ' + new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const show = value => value === null || value === undefined ? '未知 / 无记录（不是零）' : typeof value === 'object' ?
  JSON.stringify(value, (_, item) => instant(item) ? stamp(item) : item, 2) : instant(value) ? stamp(value) : String(value);

export function initForwardDiagnostics({ request, byId, notify, getScope, summarizeDiagnosticRecord, document = globalThis.document, confirm = globalThis.confirm }) {
  const el = name => byId('forward-diagnostic-' + name);
  let forward = null, scope = null, epoch = 0, controller = null, displayed = null;
  function controls() { el('reload').disabled = !forward || Boolean(controller); el('cancel').disabled = !controller;
    el('support').disabled = Boolean(controller) || !displayed; }
  function erase() { displayed = null; el('layers').replaceChildren(); el('meta').textContent = ''; el('support-output').value = ''; el('support-area').hidden = true; controls(); }
  function invalidate() { epoch++; controller?.abort(); controller = null; erase(); }
  function clear() { invalidate(); forward = null; scope = null; el('title').textContent = 'Forward 分层诊断'; el('state').textContent = ''; controls(); el('dialog').close(); }
  function section(title, columns, rows, note) {
    const area = document.createElement('section'), heading = document.createElement('h3'), hint = document.createElement('p');
    heading.textContent = title; hint.className = 'hint'; hint.textContent = note; area.append(heading, hint);
    const wrap = document.createElement('div'), table = document.createElement('table'), head = document.createElement('thead'), headings = document.createElement('tr'), body = document.createElement('tbody');
    wrap.className = 'table-wrap inner-table';
    for (const name of columns) { const cell = document.createElement('th'); cell.textContent = name; headings.append(cell); }
    head.append(headings);
    for (const values of rows.length ? rows : [['无可见记录；缺失不等于成功、零或已清理']]) {
      const row = document.createElement('tr'); for (const value of values) { const cell = document.createElement('td'); cell.textContent = show(value); row.append(cell); } body.append(row);
    }
    table.append(head, body); wrap.append(table); area.append(wrap); el('layers').append(area);
  }
  function statusOverview(data) {
    const s = summarizeDiagnosticRecord(data), op = s.operations;
    const deployment = s.deployment ? { stage: s.deployment.stage, matchesIntent: s.deployment.matchesIntent, authorizationUntil: s.deployment.authorizationUntil } : '无 Relay 部署记录（Direct 为预期）';
    const cleanup = s.cleanup ? { complete: s.cleanup.complete, slots: s.cleanup.slots, retirements: s.cleanup.retirements,
      leases: s.cleanup.leases, truncated: s.cleanup.slotsTruncated || s.cleanup.retirementsTruncated || s.cleanup.leasesTruncated } : '无清理投影';
    const nodes = s.nodes ? { expected: s.nodes.total, fresh: s.nodes.fresh, stale: s.nodes.stale, unknown: s.nodes.unknown,
      missingEvidence: s.nodes.missing, revoked: s.nodes.revoked, currentSession: s.nodes.currentSession, currentSnapshot: s.nodes.currentSnapshot } : '无节点投影';
    const listeners = s.listeners ? { current: s.listeners.current, historical: s.listeners.historical, reportFresh: s.listeners.reportFresh,
      nodeEvidenceMatches: s.listeners.nodeEvidenceMatches, ready: s.listeners.ready, degraded: s.listeners.degraded, error: s.listeners.error,
      unknown: s.listeners.unknown, truncated: s.listeners.truncated } : '无监听投影';
    const probe = s.probe ? { records: s.probe.total, withResult: s.probe.withResult, windowOpen: s.probe.windowOpen,
      truncated: s.probe.truncated, historyComplete: s.probe.historyComplete } : '无 Probe 投影';
    section('0 · 状态解释总览', ['Operation / 部署 / 清理','节点 / 监听 / Probe','来源与偏差'], [
      [{ total: op.total, accepted: op.accepted, running: op.running, succeeded: op.succeeded, failed: op.failed,
        superseded: op.superseded, cleanupPending: op.cleanupPending, truncated: op.truncated }, deployment, cleanup],
      [nodes, listeners, probe],
      [{ capturedAt: s.capturedAt, source: s.source, consistency: s.consistency, health: s.health },
        { partial: s.partial, stale: s.stale, unknown: s.unknown }, s.note],
    ], '这些是同一只读投影的计数与偏差标记，不是健康结论。Accepted/Operation、Applied 证据、Listener 发布元组、Probe 结果分别显示；truncated=true 表示当前页被截断，不表示零或已清理。');
  }
  function render(data) {
    const i = data.intent, b = data.support.bundle;
    el('meta').textContent = '采集 ' + stamp(data.capturedAt) + '\n' + data.source + ' / ' + data.consistency + '\nnetworkCheck=not-performed / health=unknown / executionAuthorized=false\nSnapshot digest 仅投影，未重算；不是全库快照或完整历史。';
    statusOverview(data);
    section('1 · 意图', ['Forward / 修订 / 模式','期望与隔离','路径 / 监听 / Transport'], [[i.forwardId + ' / r' + i.revision + ' / ' + i.mode,
      { enabled: i.enabled, deleting: i.deleting, recoverySuspended: i.recoverySuspended, protocols: i.protocols }, { path: i.path, listen: i.listen, transport: i.transport }]],
    '期望启用、停用、删除或恢复挂起均不是运行健康。此处不执行任何命令。');
    section('2 · 部署与最近 Operation', ['部署','原 Operation / 状态 / 清理','修订与期限'], [[data.deployment,
      data.operations.items.map(row => ({ operationId: row.id, sourceOperationId: row.sourceOperationId, kind: row.kind, status: row.status, cleanupPending: row.cleanupPending, recoveryInvalidated: row.recoveryInvalidated, error: row.error })),
      data.operations.items.map(row => ({ targetRevision: row.targetRevision, createdAt: stamp(row.createdAt), updatedAt: stamp(row.updatedAt), deadline: stamp(row.executionDeadline) }))]],
    (i.mode === 'direct' ? 'Direct 无 Relay 部署记录是预期情形。' : '部署阶段或接受回执不是端到端验收。') + ' Operation 最多 8 条，truncated=' + data.operations.truncated + '；历史修订不混作当前部署。nextStep 仅是固定排查建议，不是执行授权，不会自动重试。');
    section('3 · 节点与报告', ['位置 / Node / 角色','会话与报告证据','新鲜度 / 时间'], data.nodes.map((row, index) => [row.position + ' / ' + row.nodeId + ' / ' + row.role,
      b.nodes[index].evidence===null?'主机证据不可见或无记录':b.nodes[index].evidence, row.evidence === null ? '主机证据不可见或无记录；不推断离线' : { observation: row.evidence.observation, receivedAt: stamp(row.evidence.receivedAt), snapshot: row.evidence.snapshot, report: row.evidence.report }]),
    '最多八节点；共享用途授权不包含整机证据，空白不推断离线。本人规则的监听报告独立保留。fresh 仅表示这份 Agent 报告满足时间与身份条件，不代表网络、应用健康或执行授权。');
    section('4 · 物理监听 / 发布元组', ['Node / Assignment / 代际 / Fence','业务协议 / 实际监听 / Driver','报告 / drain / reservation'], data.listeners.items.map(row => [
      { node: row.nodeId, assignment: row.assignmentId, generation: row.deploymentGeneration, fence: row.bindingFence, revision: row.forwardRevision, relation: row.relation },
      { role: row.role, protocol: row.protocol, resource: row.resource, driver: row.driverId, phase: row.phase },
      { nodeEvidenceMatches: row.nodeEvidenceMatches, reportFresh: row.reportFresh, observation: row.observation, drain: row.drain, reservation: row.reservation, listeningSocket: row.listeningSocket }]),
    '最多 16 个发布元组，truncated=' + data.listeners.truncated + '；物理 socket 未独立核验。端口 reservation 不代表进程正在监听，TCP drain 不保证已清空。nextStep 只建议人工核对权限/租约、占用/清理、配置或原所有者证据；显式 Probe 仍须另行授权和同意。');
    section('5 · 相邻段', ['顺序 / 来源 → 目的','TCP-TLS 载体 / 各业务协议身份关联'], data.adjacentSegments.map(row => [
      row.position + ' / ' + row.fromNodeId + ' → ' + row.toNodeId, { carrier: row.carrier, protocols: row.protocols, connectivity: row.connectivity }]),
    '只展示配置路径和部分 link identity 关联；identityCorrelated 不是 TCP/TLS 连通、应用探测或 UDP 物理连接证明。');
    section('6 · 目标', ['出口 Node / 目标','发布配置是否匹配期望','连通 / 应用'], [[data.target.nodeId + ' / ' + data.target.endpoint.host + ':' + data.target.endpoint.port,
      data.target.configurations, { connectivity: data.target.connectivity, applicationHealth: data.target.applicationHealth }]],
    '目标地址仅用于本地诊断显示，不进入 support JSON。配置匹配不证明 DNS、端口、业务可用或端到端验收。');
    section('7 · Probe 原始回执观察', ['支持范围 / 生命周期','精确历史来源 / 时窗','Agent 结果'], data.probe.items.map(row => [
      { support: data.probe.support, measurement: row.measurement, point: row.point, service: row.service,
        state: row.state, permitId: row.permitId, closedAt: row.closedAt, withdrawnAt: row.withdrawnAt },
      { binding: row.binding, bindingMatchesCurrent: row.bindingMatchesCurrent, issuedAt: stamp(row.issuedAt), expiresAt: stamp(row.expiresAt) }, row.result]),
    '只读既有短期原 permit/结果，最多八项，truncated=' + data.probe.truncated + '；historyComplete=false。此处不签发 Probe。无结果不是零失败，历史 connected 也不是当前应用健康。');
    section('清理与历史租约（各自独立上限）', ['端口占用 ≤16','retirement ≤32','历史租约 ≤32'], [[data.cleanup.slots, data.cleanup.retirements, data.cleanup.leases]],
    'complete=false；各页截断分别显示。safe 或租约窗口仅是对应持久记录，不证明全局清理、当前授权或连接已经终止。');
    displayed = data; controls(); el('state').textContent = '七层只读观察已载入；请手动刷新，不轮询、不重试、不回滚、不触发 Probe。';
  }
  async function reload() {
    if (!forward || controller) return;
    invalidate(); const token = epoch, selected = forward, selectedScope = scope, read = new AbortController(); controller = read; controls();
    const timer = setTimeout(() => read.abort(), 5000); el('state').textContent = '正在读取有界诊断，最多等待五秒。';
    try {
      const data = await request('GET', 'forwards/' + encodeURIComponent(selected) + '/diagnostics', undefined, undefined, { signal: read.signal, timeoutMs: 5000 });
      if (token !== epoch || read.signal.aborted || selectedScope !== getScope()) return;
      if (!await valid(data, selected, selectedScope)) throw Error('诊断响应或严格脱敏 support 的格式、摘要、大小无效；不允许导出。');
      if (token !== epoch || read.signal.aborted || selectedScope !== getScope()) return;
      render(data);
    } catch (error) { if (token === epoch) { erase(); el('state').textContent = '诊断不可用；旧结果与 support 已清除，不推导成功、零或健康。'; notify(read.signal.aborted ? '诊断读取已取消或超时' : error.message, true); } }
    finally { clearTimeout(timer); if (controller === read) { controller = null; controls(); } }
  }
  function open(forwardId) {
    if (!id(forwardId) || !id(getScope())) throw Error('诊断 Forward 或 Scope 无效');
    invalidate(); forward = forwardId; scope = getScope(); el('title').textContent = 'Forward 分层诊断 · ' + forwardId;
    el('state').textContent = '手动读取后显示七层诊断；打开面板不会发送网络探测或写命令。';
    if (!el('dialog').open) el('dialog').showModal(); controls();
  }
  el('reload').addEventListener('click', reload); el('close').addEventListener('click', clear);
  el('cancel').addEventListener('click', () => { invalidate(); el('state').textContent = '本地读取已取消；没有取消任何远程 Operation 或 Probe。'; });
  el('dialog').addEventListener('close', () => { if (!el('dialog').open) { invalidate(); forward = null; scope = null; controls(); } });
  el('support').addEventListener('click', async () => {
    if (!displayed || controller || scope !== getScope()) return;
    const token = epoch, data = displayed;
    if (!confirm('仅准备当前显示结果的严格脱敏 support JSON？已删除原标识、地址/端口/目标、策略/配置摘要、自由文本和凭据；请仍人工审阅后再分享。不会导出原始详情。')) return;
    try {
      if (!await valid(data, forward, scope)) throw Error('support 验证失败，禁止导出');
      if (token !== epoch || displayed !== data || scope !== getScope()) return;
      el('support-output').value = JSON.stringify(data.support.bundle); el('support-area').hidden = false;
      el('support-output').focus(); el('support-output').select();
      el('state').textContent = '已准备同次读取的脱敏 support（原始 UTF-8 ' + data.support.bytes + ' bytes / ' + data.support.digest + '）。可手动复制，仍须人工审阅。';
    } catch (error) { if (token === epoch) { el('support-output').value = ''; el('support-area').hidden = true; notify(error.message, true); } }
  });
  clear(); return { open, clear };
}
