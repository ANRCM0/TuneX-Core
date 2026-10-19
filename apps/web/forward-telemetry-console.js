const counterKeys = ['payloadSentBytes','payloadReceivedBytes','tcpAccepted','tcpConnected','tcpClosed',
  'udpAssociationsCreated','udpAssociationsClosed','udpDatagramsSent','udpDatagramsReceived'];
const tcpKeys = ['tcpAccepted','tcpConnected','tcpClosed'];
const udpKeys = ['udpAssociationsCreated','udpAssociationsClosed','udpDatagramsSent','udpDatagramsReceived'];
const object = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const uint = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => uint(value) && value > 0;
const id = value => typeof value === 'string' && value.length <= 128 && !/\s/.test(value) && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
const epoch = value => typeof value === 'string' && value.length === 32 && /^[a-f0-9]{32}$/.test(value);
const decimal = value => typeof value === 'string' && !/\s/.test(value) && /^(0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value) <= 18446744073709551615n;
const bool = value => typeof value === 'boolean';
const size = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
function instant(value) {
  if (typeof value !== 'string' || /\s/.test(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0 || new Date(milliseconds).toISOString().slice(0, 19) !== value.slice(0, 19)) return null;
  const fraction = value.includes('.') ? value.slice(20, -1) : '';
  return BigInt(Date.parse(value.slice(0, 19) + 'Z')) * 1000000n + BigInt(fraction.padEnd(9, '0'));
}
const time = value => instant(value) !== null;
const canonicalTime = value => time(value) && new Date(value).toISOString() === value;
function ipv4(value) {
  const pieces = value.split('.');
  return pieces.length === 4 && pieces.every(piece => /^(0|[1-9][0-9]{0,2})$/.test(piece) && Number(piece) <= 255);
}
function address(value) {
  if (typeof value !== 'string' || !value.length || value.length > 127 || /\s/.test(value)) return false;
  if (ipv4(value)) return true;
  if (!value.includes(':') || /[^0-9a-fA-F:.]/.test(value)) return false;
  let input = value;
  if (input.includes('.')) {
    const boundary = input.lastIndexOf(':'), tail = input.slice(boundary + 1);
    if (!ipv4(tail)) return false;
    const octets = tail.split('.').map(Number);
    input = input.slice(0, boundary) + ':' + ((octets[0] << 8) | octets[1]).toString(16) + ':' + ((octets[2] << 8) | octets[3]).toString(16);
  }
  const halves = input.split('::');
  if (halves.length > 2) return false;
  const groups = [...(halves[0] ? halves[0].split(':') : []), ...(halves[1] ? halves[1].split(':') : [])];
  return (halves.length === 1 ? groups.length === 8 : groups.length < 8) && groups.every(group => /^[a-fA-F0-9]{1,4}$/.test(group));
}
function identityValid(value, forwardId) {
  if (!object(value, ['nodeId','bootId','sessionEpoch','assignmentId','forwardId','forwardRevision','deploymentGeneration','bindingFence',
    'role','protocol','driverId','driverSchemaVersion','configDigest','resource'])) return false;
  const driver = { direct: 'native.direct.v1', 'relay-ingress': 'native.relay.v1', 'multihop-ingress': 'native.multihop.v1' };
  return id(value.nodeId) && id(value.bootId) && positive(value.sessionEpoch) && id(value.assignmentId) && value.forwardId === forwardId &&
    positive(value.forwardRevision) && positive(value.deploymentGeneration) && positive(value.bindingFence) && Object.hasOwn(driver, value.role) &&
    value.driverId === driver[value.role] && value.driverSchemaVersion === 1 && ['tcp','udp'].includes(value.protocol) &&
    typeof value.configDigest === 'string' && value.configDigest.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value.configDigest) &&
    object(value.resource, ['protocol','address','port']) && value.resource.protocol === value.protocol && address(value.resource.address) &&
    Number.isInteger(value.resource.port) && value.resource.port >= 1 && value.resource.port <= 65535;
}
function pointValid(point, forwardId) {
  if (!object(point, ['identity','state','phase','capturedAt','endedAt','availability','counterEpoch','counters','overflowed']) ||
      !identityValid(point.identity, forwardId) || !['current','draining','terminal'].includes(point.state) ||
      !['prepared','active','draining'].includes(point.phase) || point.identity.role === 'direct' && point.phase !== 'active' ||
      !time(point.capturedAt) || (point.state === 'terminal' ? point.endedAt !== point.capturedAt : point.endedAt !== null)) return false;
  if (point.availability === 'unavailable') return point.counterEpoch === null && point.counters === null && point.overflowed === null && size(point) <= 4096;
  return point.availability === 'available' && epoch(point.counterEpoch) && bool(point.overflowed) && object(point.counters, counterKeys) &&
    counterKeys.every(key => decimal(point.counters[key])) &&
    (point.identity.protocol === 'tcp' ? udpKeys : tcpKeys).every(key => point.counters[key] === '0') && size(point) <= 4096;
}
function coverageValid(coverage) {
  if (!object(coverage, ['limit','available','returned','omitted','truncated','offset','nextOffset','unavailableSources','tailLimit',
    'tailRetentionSeconds','tailsEvicted','tailsExpired','historyComplete'])) return false;
  return coverage.limit === 32 && uint(coverage.available) && coverage.returned === Math.min(32, coverage.available) &&
    coverage.returned > 0 && coverage.omitted === coverage.available - coverage.returned && coverage.truncated === (coverage.omitted > 0) &&
    uint(coverage.offset) && uint(coverage.nextOffset) && uint(coverage.unavailableSources) && coverage.unavailableSources <= coverage.available &&
    (coverage.available <= 32 ? coverage.offset === 0 && coverage.nextOffset === 0 : coverage.offset < coverage.available &&
      coverage.nextOffset === Number((BigInt(coverage.offset) + BigInt(coverage.returned)) % BigInt(coverage.available))) &&
    coverage.tailLimit === 128 && coverage.tailRetentionSeconds === 600 && decimal(coverage.tailsEvicted) && decimal(coverage.tailsExpired) && coverage.historyComplete === false;
}
function identityKey(value) {
  const i = value.point.identity;
  return JSON.stringify([i.nodeId,i.bootId,i.sessionEpoch,i.assignmentId,i.forwardId,i.forwardRevision,i.deploymentGeneration,i.bindingFence,
    i.role,i.protocol,i.driverId,i.driverSchemaVersion,i.configDigest,i.resource.protocol,i.resource.address,i.resource.port,value.point.counterEpoch]);
}
const viewKey = value => JSON.stringify([identityKey(value),value.exporter.sampleEpoch,value.exporter.sequence]);
const asciiOrder = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function viewOrder(a, b) {
  return Date.parse(a.receivedAt) - Date.parse(b.receivedAt) || asciiOrder(a.point.identity.nodeId, b.point.identity.nodeId) ||
    asciiOrder(a.exporter.sampleEpoch, b.exporter.sampleEpoch) || a.exporter.sequence - b.exporter.sequence;
}
function viewValid(view, data) {
  if (!object(view, ['point','exporter','receivedAt','mapping','recoverySuspended','currentSession','nodeRevoked','credentialWindowOpen',
      'sessionCurrent','freshness','delta']) || !pointValid(view.point, data.forwardId) || !canonicalTime(view.receivedAt) ||
      !bool(view.recoverySuspended) || !bool(view.nodeRevoked) || !bool(view.credentialWindowOpen) || !bool(view.sessionCurrent)) return false;
  const exporter = view.exporter, delta = view.delta, point = view.point;
  if (!object(exporter, ['sampleEpoch','sequence','capturedAt','uptimeMs','snapshotGeneration','droppedSamples','coverage']) ||
      !epoch(exporter.sampleEpoch) || !positive(exporter.sequence) || !time(exporter.capturedAt) || !uint(exporter.uptimeMs) ||
      !uint(exporter.snapshotGeneration) || !decimal(exporter.droppedSamples) || !coverageValid(exporter.coverage) || size(exporter) > 2048 ||
      instant(point.capturedAt) > instant(exporter.capturedAt) ||
      !object(view.mapping, ['source','publishedUntil','currentBinding']) || !['current-published','retired-published'].includes(view.mapping.source) ||
      !canonicalTime(view.mapping.publishedUntil) || view.mapping.currentBinding !== 'not-rechecked' ||
      !(view.currentSession === null || object(view.currentSession, ['bootId','sessionEpoch']) && id(view.currentSession.bootId) && positive(view.currentSession.sessionEpoch)) ||
      !object(delta, ['status','elapsedMs',...counterKeys]) ||
      !['baseline','continuous','gap','counter-reset','historical','unavailable','overflowed','terminal'].includes(delta.status)) return false;
  const currentEligible = data.enabled && !data.forward.deleting && !data.forward.recoverySuspended && !view.recoverySuspended &&
    !view.nodeRevoked && view.credentialWindowOpen && view.currentSession !== null &&
    view.currentSession.bootId === point.identity.bootId && view.currentSession.sessionEpoch === point.identity.sessionEpoch;
  if (view.sessionCurrent !== currentEligible) return false;
  const age = Date.parse(data.observedAt) - Date.parse(view.receivedAt);
  const freshness = !view.sessionCurrent ? 'historical' : age >= 0 && age <= 30000 ? 'fresh' : 'stale';
  if (view.freshness !== freshness) return false;
  const precedence = !view.sessionCurrent ? 'historical' : point.availability === 'unavailable' ? 'unavailable' : point.overflowed ? 'overflowed' : point.state === 'terminal' ? 'terminal' : null;
  if (precedence !== null ? delta.status !== precedence : !['baseline','continuous','gap','counter-reset'].includes(delta.status)) return false;
  if (delta.status !== 'continuous') return delta.elapsedMs === null && counterKeys.every(key => delta[key] === null);
  return positive(delta.elapsedMs) && !exporter.coverage.truncated && counterKeys.every(key => decimal(delta[key])) &&
    (point.identity.protocol === 'tcp' ? udpKeys : tcpKeys).every(key => delta[key] === '0');
}
function continuousValid(current, previous) {
  if (!previous || identityKey(previous) !== identityKey(current) || !previous.sessionCurrent ||
      previous.point.availability !== 'available' || previous.point.overflowed || previous.point.state === 'terminal' || previous.exporter.coverage.truncated ||
      previous.exporter.sampleEpoch !== current.exporter.sampleEpoch || current.exporter.sequence - previous.exporter.sequence !== 1 ||
      Date.parse(previous.receivedAt) > Date.parse(current.receivedAt) ||
      current.exporter.uptimeMs <= previous.exporter.uptimeMs || current.delta.elapsedMs !== current.exporter.uptimeMs - previous.exporter.uptimeMs ||
      previous.exporter.droppedSamples !== current.exporter.droppedSamples || previous.exporter.coverage.tailsEvicted !== current.exporter.coverage.tailsEvicted ||
      previous.exporter.coverage.tailsExpired !== current.exporter.coverage.tailsExpired) return false;
  return counterKeys.every(key => {
    const before = BigInt(previous.point.counters[key]), after = BigInt(current.point.counters[key]);
    return after >= before && BigInt(current.delta[key]) === after - before;
  });
}
function previousFor(latest, items) {
  for (let index = items.length - 1; index >= 0; index--) {
    const candidate = items[index];
    if (identityKey(candidate) === identityKey(latest) && candidate.exporter.sampleEpoch === latest.exporter.sampleEpoch &&
        latest.exporter.sequence - candidate.exporter.sequence === 1) return candidate;
  }
  return null;
}
function responseValid(data, forwardId, from, to, limit) {
  if (!object(data, ['forwardTelemetryVersion','forwardId','enabled','source','health','executionAuthorized','observedAt','forward','window','retention','latest','items']) ||
      data.forwardTelemetryVersion !== 1 || data.forwardId !== forwardId || !bool(data.enabled) || data.source !== 'agent-reported' || data.health !== 'unknown' ||
      data.executionAuthorized !== false || !canonicalTime(data.observedAt) || !object(data.forward, ['revision','deleting','recoverySuspended']) ||
      !positive(data.forward.revision) || !bool(data.forward.deleting) || !bool(data.forward.recoverySuspended) ||
      !object(data.window, ['from','to','limit','truncated']) || data.window.from !== from || data.window.to !== to || data.window.limit !== limit || !bool(data.window.truncated) ||
      !object(data.retention, ['rawSeconds','maxPointsPerNode','maxPointBytes','maxMetadataBytes','historyComplete']) || data.retention.rawSeconds !== 86400 ||
      data.retention.maxPointsPerNode !== 4096 || data.retention.maxPointBytes !== 4096 || data.retention.maxMetadataBytes !== 2048 || data.retention.historyComplete !== false ||
      !Array.isArray(data.items) || data.items.length > limit || data.latest !== null && !viewValid(data.latest, data)) return false;
  const seen = new Set(), previous = new Map();
  for (let index = 0; index < data.items.length; index++) {
    const item = data.items[index];
    if (!viewValid(item, data) || Date.parse(item.receivedAt) < Date.parse(from) || Date.parse(item.receivedAt) > Date.parse(to) ||
        index > 0 && viewOrder(data.items[index - 1], item) > 0) return false;
    const key = viewKey(item), instance = identityKey(item);
    if (seen.has(key) || item.delta.status === 'continuous' && !continuousValid(item, previous.get(instance))) return false;
    seen.add(key); previous.set(instance, item);
  }
  if (data.latest?.delta.status === 'continuous') {
    const predecessor = previousFor(data.latest, data.items);
    if (predecessor !== null && !continuousValid(data.latest, predecessor)) return false;
  }
  return true;
}
function rate(value, elapsedMs) {
  if (value === null || !positive(elapsedMs)) return '不可计算';
  const thousandths = BigInt(value) * 1000000n / BigInt(elapsedMs);
  return (thousandths / 1000n).toString() + '.' + (thousandths % 1000n).toString().padStart(3, '0') + ' B/s';
}
const stamp = value => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) + ' · ' + value;
const count = value => value === null ? '不支持 / 未提供' : value;

export function initForwardTelemetryConsole({ request, notify, byId, document = globalThis.document }) {
  const el = name => byId('forward-telemetry-' + name);
  let forward = null, epochVersion = 0, controller = null;
  function invalidate() { epochVersion++; controller?.abort(); controller = null; }
  function erase() { el('latest').replaceChildren(); el('rows').replaceChildren(); el('meta').textContent = ''; }
  function reset() { invalidate(); forward = null; erase(); el('title').textContent = 'Forward 入口 payload 观察'; el('state').textContent = ''; }
  function clear() { reset(); el('dialog').close(); }
  function cell(row, value) { const item = document.createElement('td'); item.textContent = value; row.append(item); }
  function card(title, value) {
    const item = document.createElement('div'), heading = document.createElement('span'), output = document.createElement('strong');
    item.className = 'metric'; heading.textContent = title; output.textContent = value; item.append(heading, output); el('latest').append(item);
  }
  function render(data) {
    el('state').textContent = (data.enabled ? 'Control 接收开关已启用，不保证 Agent 已开启' : 'Control 接收关闭，已有记录仅作历史观察') +
      ' · source: agent-reported · health: unknown · 无执行授权 · 当前 Forward r' + data.forward.revision +
      ' / deleting=' + data.forward.deleting + ' / recoverySuspended=' + data.forward.recoverySuspended;
    el('meta').textContent = 'Forward: ' + forward + ' · 观察时间: ' + stamp(data.observedAt) + '\n窗口: ' + stamp(data.window.from) + ' → ' + stamp(data.window.to) +
      ' · 返回 ' + data.items.length + ' / 上限 ' + data.window.limit + ' · ' + (data.window.truncated ? '查询已截断，不是完整历史' : '未触及查询上限，仍不保证覆盖完整') +
      ' · 原始历史最多保留 24 小时 / 每 Node 最多 4096 点，跨 Forward 共用；容量淘汰可能更早删除，不保证完整 24 小时历史。';
    const latest = data.latest;
    if (latest) {
      const counters = latest.point.counters, delta = latest.delta;
      card('最近一个实例 · 向目标累计 payload', counters === null ? '不支持 / 未提供' : counters.payloadSentBytes + ' B');
      card('最近一个实例 · 返回客户端累计 payload', counters === null ? '不支持 / 未提供' : counters.payloadReceivedBytes + ' B');
      card('该实例连续区间 · 向目标速率', delta.status === 'continuous' ? rate(delta.payloadSentBytes, delta.elapsedMs) : '不可计算 · ' + delta.status);
      card('该实例连续区间 · 返回客户端速率', delta.status === 'continuous' ? rate(delta.payloadReceivedBytes, delta.elapsedMs) : '不可计算 · ' + delta.status);
      const note = document.createElement('p'); note.className = 'hint';
      note.textContent = '仅最近一条实例观察，不是整条 Forward 累计/合计，不跨 TCP/UDP、代次、节点或 epoch 相加。Node ' + latest.point.identity.nodeId +
        ' / ' + latest.point.identity.protocol + ' / ' + latest.point.identity.role + ' · ' + latest.point.state + ' / ' + latest.freshness +
        ' · 接收 ' + stamp(latest.receivedAt) + ' · ' + latest.mapping.source + '（当前绑定未重新核对）' +
        (delta.status === 'continuous' ? previousFor(latest, data.items) === null ? ' · 服务端相邻区间；前置样本不在当前返回窗口，页面未独立复核差值。' : ' · 已按当前返回的前置样本复核连续差值。' : ' · 不跨缺口、重置、终态或溢出推算速率。');
      el('latest').append(note);
    }
    for (const view of data.items) {
      const point = view.point, identity = point.identity, counters = point.counters, delta = view.delta, exporter = view.exporter, coverage = exporter.coverage;
      const row = document.createElement('tr');
      cell(row, identity.nodeId + '\n' + identity.protocol + ' / ' + identity.role + '\nForward r' + identity.forwardRevision + ' / gen ' + identity.deploymentGeneration + ' / fence ' + identity.bindingFence +
        '\nAssignment ' + identity.assignmentId + '\nBoot ' + identity.bootId + ' / Session ' + identity.sessionEpoch + '\nCounter epoch ' + count(point.counterEpoch) +
        '\n' + identity.driverId + ' / schema ' + identity.driverSchemaVersion + '\n' + identity.configDigest + '\n' + identity.resource.address + ':' + identity.resource.port);
      cell(row, '实例采样 ' + stamp(point.capturedAt) + '\n导出采样 ' + stamp(exporter.capturedAt) + '\nControl 接收 ' + stamp(view.receivedAt) +
        (point.endedAt === null ? '' : '\n冻结终态 ' + stamp(point.endedAt)));
      cell(row, point.state + ' / phase ' + point.phase + '\n' + point.availability + ' / overflowed=' + point.overflowed + '\n' + view.freshness +
        ' / ' + (view.sessionCurrent ? '记录匹配当前机器会话' : '历史或隔离会话') + '\n恢复挂起 ' + view.recoverySuspended + ' / Node 撤销 ' + view.nodeRevoked +
        '\n凭据窗口 ' + view.credentialWindowOpen);
      cell(row, counters === null ? '不可用，不是零' : '向目标 ' + counters.payloadSentBytes + ' B\n返回客户端 ' + counters.payloadReceivedBytes + ' B\nTCP accepted/connected/closed ' +
        counters.tcpAccepted + '/' + counters.tcpConnected + '/' + counters.tcpClosed + '\nUDP association created/closed ' + counters.udpAssociationsCreated + '/' + counters.udpAssociationsClosed +
        '\nUDP datagram sent/received ' + counters.udpDatagramsSent + '/' + counters.udpDatagramsReceived);
      cell(row, delta.status + (delta.status === 'continuous' ? '\n区间 ' + delta.elapsedMs + ' ms\n向目标 +' + delta.payloadSentBytes + ' B / ' + rate(delta.payloadSentBytes, delta.elapsedMs) +
        '\n返回客户端 +' + delta.payloadReceivedBytes + ' B / ' + rate(delta.payloadReceivedBytes, delta.elapsedMs) + '\nTCP +' + delta.tcpAccepted + '/+' + delta.tcpConnected + '/+' + delta.tcpClosed +
        '\nUDP association +' + delta.udpAssociationsCreated + '/+' + delta.udpAssociationsClosed + '\nUDP datagram +' + delta.udpDatagramsSent + '/+' + delta.udpDatagramsReceived : '\n无可用连续区间，不推算速率'));
      cell(row, 'Exporter ' + exporter.sampleEpoch + ' / seq ' + exporter.sequence + '\nuptime ' + exporter.uptimeMs + ' ms / Snapshot ' + exporter.snapshotGeneration +
        '\n导出丢弃累计 ' + exporter.droppedSamples + '\n本轮全 Node 来源 ' + coverage.returned + '/' + coverage.available + ' / omitted ' + coverage.omitted +
        '\n轮转 ' + coverage.offset + ' → ' + coverage.nextOffset + ' / truncated=' + coverage.truncated + '\n不可用来源 ' + coverage.unavailableSources +
        '\n终态淘汰 ' + coverage.tailsEvicted + ' / 到期 ' + coverage.tailsExpired + '\n历史始终不完整');
      cell(row, view.mapping.source + '\n发布记录期限 ' + stamp(view.mapping.publishedUntil) + '\n当前绑定未重新核对\n历史发布映射不证明当前拓扑、租约、规则已生效或健康');
      el('rows').append(row);
    }
    if (!data.items.length) { const row = document.createElement('tr'); cell(row, '所选窗口无可见实例点；可能未启用、未上报、无可信映射、无权限或已清理，不等于零。'); row.firstChild.colSpan = 7; el('rows').append(row); }
  }
  async function reload() {
    if (!forward) return;
    invalidate(); erase();
    const version = epochVersion, requestedForward = forward, read = new AbortController(); controller = read;
    const timer = setTimeout(() => read.abort(), 5000);
    el('state').textContent = '正在读取有界入口观察，最多等待 5 秒，无自动重试。';
    try {
      const duration = Number(el('range').value), limit = Number(el('limit').value);
      if (![900000,3600000,86400000].includes(duration) || ![128,256,512].includes(limit)) throw Error('Forward 指标查询范围无效');
      const now = Date.now(), from = new Date(now - duration).toISOString(), to = new Date(now).toISOString();
      const resource = 'forwards/' + encodeURIComponent(requestedForward) + '/telemetry?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to) + '&limit=' + limit;
      const data = await request('GET', resource, undefined, undefined, { signal: read.signal, timeoutMs: 5000 });
      if (version !== epochVersion || forward !== requestedForward || read.signal.aborted) return;
      if (!responseValid(data, requestedForward, from, to, limit)) throw Error('Forward 指标响应格式、身份或连续性无效；旧输出已清除');
      render(data);
    } catch (error) {
      if (version === epochVersion) { erase(); el('state').textContent = '入口观察不可用；不推导零流量或健康。'; notify(read.signal.aborted ? 'Forward 指标请求已超时或取消' : error.message, true); }
    } finally { clearTimeout(timer); if (controller === read) controller = null; }
  }
  function open(forwardId) {
    invalidate(); erase();
    if (!id(forwardId)) throw Error('Forward ID 无效');
    forward = forwardId; el('title').textContent = 'Forward 入口 payload 观察 · ' + forwardId;
    if (!el('dialog').open) el('dialog').showModal();
    return reload();
  }
  el('reload').addEventListener('click', reload);
  el('close').addEventListener('click', clear);
  el('dialog').addEventListener('close', () => { if (!el('dialog').open) reset(); });
  for (const name of ['range','limit']) el(name).addEventListener('change', () => { invalidate(); erase(); el('state').textContent = '范围已改变，请手动读取；旧输出已清除。'; });
  return { open, clear };
}
