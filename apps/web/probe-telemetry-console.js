const cumulative = ['attempted','succeeded','failed','unknown'];
const counters = [...cumulative,'inFlight'];
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
function identityValid(identity, forwardId) {
  if (!object(identity, ['binding','instanceId','instanceGeneration']) || typeof identity.instanceId !== 'string' ||
      identity.instanceId.length !== 64 || !/^[a-f0-9]{64}$/.test(identity.instanceId) || !positive(identity.instanceGeneration)) return false;
  const b = identity.binding;
  return object(b, ['nodeId','bootId','sessionEpoch','snapshotGeneration','assignmentId','forwardId','forwardRevision','deploymentGeneration','bindingFence','configDigest','egressPolicyRevision']) &&
    id(b.nodeId) && id(b.bootId) && id(b.assignmentId) && b.forwardId === forwardId &&
    [b.sessionEpoch,b.snapshotGeneration,b.forwardRevision,b.deploymentGeneration,b.bindingFence,b.egressPolicyRevision].every(positive) &&
    typeof b.configDigest === 'string' && b.configDigest.length === 71 && /^sha256:[a-f0-9]{64}$/.test(b.configDigest);
}
function pointValid(point, forwardId) {
  if (!object(point, ['identity','state','capturedAt','endedAt','availability','counterEpoch','counters','overflowed']) ||
      !identityValid(point.identity, forwardId) || !['current','terminal'].includes(point.state) || !time(point.capturedAt) ||
      (point.state === 'terminal' ? point.endedAt !== point.capturedAt : point.endedAt !== null)) return false;
  if (point.availability === 'unavailable') return point.counterEpoch === null && point.counters === null && point.overflowed === null && size(point) <= 4096;
  if (point.availability !== 'available' || !epoch(point.counterEpoch) || !bool(point.overflowed) || !object(point.counters, counters) ||
      !counters.every(key => decimal(point.counters[key])) || size(point) > 4096) return false;
  return point.overflowed || BigInt(point.counters.attempted) === BigInt(point.counters.succeeded) + BigInt(point.counters.failed) +
    BigInt(point.counters.unknown) + BigInt(point.counters.inFlight);
}
function coverageValid(value) {
  if (!object(value, ['limit','snapshotLimit','available','returned','omitted','truncated','offset','nextOffset','unavailableSources','retiringSourceLimit','retiringSources',
      'tailLimit','tailRetentionSeconds','tailsEvicted','tailsExpired','historyComplete'])) return false;
  return value.limit === 32 && value.snapshotLimit === 2 && uint(value.available) && value.available <= 2432 && positive(value.returned) &&
    value.returned <= Math.min(32, value.available) && value.omitted === value.available - value.returned && value.truncated === (value.omitted > 0) &&
    uint(value.offset) && uint(value.nextOffset) && value.offset < value.available &&
    value.nextOffset === (value.truncated ? (value.offset + Math.max(1, value.returned)) % value.available : 0) &&
    uint(value.unavailableSources) && value.unavailableSources <= 1 && value.retiringSourceLimit === 8 && uint(value.retiringSources) && value.retiringSources <= 8 &&
    value.available <= 384 + value.retiringSources * 256 && value.tailLimit === 128 && value.tailRetentionSeconds === 600 &&
    decimal(value.tailsEvicted) && decimal(value.tailsExpired) && value.historyComplete === false;
}
function identityKey(view) {
  const i = view.point.identity, b = i.binding;
  return JSON.stringify([b.nodeId,b.bootId,b.sessionEpoch,b.snapshotGeneration,b.assignmentId,b.forwardId,b.forwardRevision,b.deploymentGeneration,
    b.bindingFence,b.configDigest,b.egressPolicyRevision,i.instanceId,i.instanceGeneration,view.point.counterEpoch]);
}
const viewKey = value => JSON.stringify([identityKey(value),value.exporter.sampleEpoch,value.exporter.sequence]);
const asciiOrder = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function viewOrder(a, b) {
  return Date.parse(a.receivedAt) - Date.parse(b.receivedAt) || asciiOrder(a.point.identity.binding.nodeId, b.point.identity.binding.nodeId) ||
    asciiOrder(a.exporter.sampleEpoch, b.exporter.sampleEpoch) || a.exporter.sequence - b.exporter.sequence;
}
function viewValid(view, data) {
  if (!object(view, ['point','exporter','receivedAt','mapping','recoverySuspended','currentSession','nodeRevoked','credentialWindowOpen','sessionCurrent','freshness','delta']) ||
      !pointValid(view.point, data.forwardId) || !canonicalTime(view.receivedAt) || !bool(view.recoverySuspended) || !bool(view.nodeRevoked) ||
      !bool(view.credentialWindowOpen) || !bool(view.sessionCurrent)) return false;
  const e = view.exporter, p = view.point, b = p.identity.binding, m = view.mapping, d = view.delta;
  if (!object(e, ['sampleEpoch','sequence','capturedAt','uptimeMs','droppedSamples','coverage']) || !epoch(e.sampleEpoch) || !positive(e.sequence) ||
      !time(e.capturedAt) || !uint(e.uptimeMs) || !decimal(e.droppedSamples) || !coverageValid(e.coverage) || size(e) > 2048 || instant(p.capturedAt) > instant(e.capturedAt) ||
      !object(m, ['source','publishedUntil','currentBinding','probeInstance','instanceUntil']) || m.source !== 'published-snapshot' ||
      !canonicalTime(m.publishedUntil) || m.currentBinding !== 'not-rechecked' ||
      !(m.probeInstance === 'current-registered' ? canonicalTime(m.instanceUntil) && Date.parse(m.instanceUntil) > Date.parse(view.receivedAt) : m.probeInstance === 'not-rechecked' && m.instanceUntil === null) ||
      !(view.currentSession === null || object(view.currentSession, ['bootId','sessionEpoch']) && id(view.currentSession.bootId) && positive(view.currentSession.sessionEpoch)) ||
      !object(d, ['status','elapsedMs',...cumulative,'inFlightBefore']) ||
      !['baseline','continuous','gap','counter-reset','historical','unavailable','overflowed','terminal'].includes(d.status)) return false;
  const eligible = data.enabled && !data.forward.deleting && !data.forward.recoverySuspended && !view.recoverySuspended && !view.nodeRevoked &&
    view.credentialWindowOpen && view.currentSession !== null && view.currentSession.bootId === b.bootId && view.currentSession.sessionEpoch === b.sessionEpoch;
  if (view.sessionCurrent !== eligible) return false;
  const age = Date.parse(data.observedAt) - Date.parse(view.receivedAt);
  if (view.freshness !== (!view.sessionCurrent ? 'historical' : age >= 0 && age <= 30000 ? 'fresh' : 'stale')) return false;
  const precedence = !view.sessionCurrent ? 'historical' : p.availability === 'unavailable' ? 'unavailable' : p.overflowed ? 'overflowed' : p.state === 'terminal' ? 'terminal' : null;
  if (precedence !== null ? d.status !== precedence : !['baseline','continuous','gap','counter-reset'].includes(d.status)) return false;
  if (d.status !== 'continuous') return d.elapsedMs === null && [...cumulative,'inFlightBefore'].every(key => d[key] === null);
  return positive(d.elapsedMs) && !e.coverage.truncated && [...cumulative,'inFlightBefore'].every(key => decimal(d[key]));
}
function continuousValid(current, previous) {
  if (!previous || identityKey(current) !== identityKey(previous) || !previous.sessionCurrent || previous.recoverySuspended ||
      previous.point.availability !== 'available' || previous.point.overflowed || previous.point.state === 'terminal' || previous.exporter.coverage.truncated ||
      previous.exporter.sampleEpoch !== current.exporter.sampleEpoch || current.exporter.sequence - previous.exporter.sequence !== 1 ||
      current.exporter.uptimeMs <= previous.exporter.uptimeMs || current.delta.elapsedMs !== current.exporter.uptimeMs - previous.exporter.uptimeMs ||
      Date.parse(previous.receivedAt) > Date.parse(current.receivedAt) || previous.exporter.droppedSamples !== current.exporter.droppedSamples ||
      previous.exporter.coverage.tailsEvicted !== current.exporter.coverage.tailsEvicted || previous.exporter.coverage.tailsExpired !== current.exporter.coverage.tailsExpired ||
      current.delta.inFlightBefore !== previous.point.counters.inFlight) return false;
  return cumulative.every(key => BigInt(current.point.counters[key]) >= BigInt(previous.point.counters[key]) &&
    BigInt(current.delta[key]) === BigInt(current.point.counters[key]) - BigInt(previous.point.counters[key]));
}
function previousFor(latest, items) {
  for (let index = items.length - 1; index >= 0; index--) {
    const value = items[index];
    if (identityKey(value) === identityKey(latest) && value.exporter.sampleEpoch === latest.exporter.sampleEpoch && latest.exporter.sequence - value.exporter.sequence === 1) return value;
  }
  return null;
}
function responseValid(data, forwardId, from, to, limit) {
  if (!object(data, ['probeTelemetryVersion','forwardId','enabled','source','health','executionAuthorized','observedAt','forward','window','retention','latest','items']) ||
      data.probeTelemetryVersion !== 1 || data.forwardId !== forwardId || !bool(data.enabled) || data.source !== 'agent-reported' || data.health !== 'unknown' ||
      data.executionAuthorized !== false || !canonicalTime(data.observedAt) || !object(data.forward, ['revision','deleting','recoverySuspended']) ||
      !positive(data.forward.revision) || !bool(data.forward.deleting) || !bool(data.forward.recoverySuspended) ||
      !object(data.window, ['from','to','limit','truncated']) || data.window.from !== from || data.window.to !== to || data.window.limit !== limit || !bool(data.window.truncated) ||
      !object(data.retention, ['rawSeconds','maxPointsPerNode','maxPointBytes','maxMetadataBytes','historyComplete']) || data.retention.rawSeconds !== 86400 ||
      data.retention.maxPointsPerNode !== 4096 || data.retention.maxPointBytes !== 4096 || data.retention.maxMetadataBytes !== 2048 || data.retention.historyComplete !== false ||
      !Array.isArray(data.items) || data.items.length > limit || data.latest !== null && !viewValid(data.latest, data)) return false;
  const seen = new Set(), previous = new Map(), generations = new Map();
  for (let index = 0; index < data.items.length; index++) {
    const item = data.items[index];
    if (!viewValid(item, data) || Date.parse(item.receivedAt) < Date.parse(from) || Date.parse(item.receivedAt) > Date.parse(to) ||
        index > 0 && viewOrder(data.items[index - 1], item) > 0) return false;
    const key = viewKey(item), identity = identityKey(item), b = item.point.identity.binding;
    if (seen.has(key) || item.delta.status === 'continuous' && !continuousValid(item, previous.get(identity))) return false;
    const batch = JSON.stringify([b.nodeId,b.bootId,b.sessionEpoch,item.exporter.sampleEpoch,item.exporter.sequence]);
    if (!generations.has(batch)) generations.set(batch, new Set());
    generations.get(batch).add(b.snapshotGeneration);
    if (generations.get(batch).size > 2) return false;
    seen.add(key); previous.set(identity, item);
  }
  if (data.latest?.delta.status === 'continuous') {
    const previous = previousFor(data.latest, data.items);
    if (previous !== null && !continuousValid(data.latest, previous)) return false;
  }
  return true;
}
function ratio(failed, succeeded) {
  const denominator = BigInt(failed) + BigInt(succeeded);
  if (denominator === 0n) return '有效结果为 0，不可计算';
  const hundredths = BigInt(failed) * 10000n / denominator;
  return (hundredths / 100n).toString() + '.' + (hundredths % 100n).toString().padStart(2, '0') + '%（有效结果 ' + denominator + '）';
}
function subsetRatio(point) {
  return point.availability !== 'available' ? '不可用，不是零' : point.overflowed ? '已溢出，不计算比例' : ratio(point.counters.failed, point.counters.succeeded);
}
function intervalRatio(view) {
  const delta = view.delta;
  if (delta.status !== 'continuous') return '不可计算 · ' + delta.status;
  if (delta.inFlightBefore !== '0' || view.point.counters.inFlight !== '0' || delta.unknown !== '0') return '不计算：区间有未知结果或前后在途任务';
  return ratio(delta.failed, delta.succeeded);
}
const stamp = value => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) + ' · ' + value;
const shown = value => value === null ? '不可用' : String(value);

export function initProbeTelemetryConsole({ request, notify, byId, document = globalThis.document }) {
  const el = name => byId('probe-telemetry-' + name);
  let forward = null, epochVersion = 0, controller = null;
  function invalidate() { epochVersion++; controller?.abort(); controller = null; }
  function erase() { el('latest').replaceChildren(); el('rows').replaceChildren(); el('meta').textContent = ''; }
  function reset() { invalidate(); forward = null; erase(); el('title').textContent = 'Probe 独立累计观察'; el('state').textContent = ''; }
  function clear() { reset(); el('dialog').close(); }
  function cell(row, value) { const item = document.createElement('td'); item.textContent = value; row.append(item); }
  function card(title, value) {
    const item = document.createElement('div'), heading = document.createElement('span'), output = document.createElement('strong');
    item.className = 'metric'; heading.textContent = title; output.textContent = value; item.append(heading, output); el('latest').append(item);
  }
  function render(data) {
    el('state').textContent = (data.enabled ? 'Control Probe 计数接收开关已启用，不保证 Agent 已开启' : 'Control Probe 计数接收关闭，已有记录仅作历史观察') +
      ' · source: agent-reported · health: unknown · 无执行授权 · Forward r' + data.forward.revision + ' / deleting=' + data.forward.deleting + ' / recoverySuspended=' + data.forward.recoverySuspended;
    el('meta').textContent = 'Forward ' + forward + ' · 观察 ' + stamp(data.observedAt) + '\n窗口 ' + stamp(data.window.from) + ' → ' + stamp(data.window.to) +
      ' · 返回 ' + data.items.length + '/' + data.window.limit + ' · ' + (data.window.truncated ? '查询已截断' : '查询未触及上限') +
      ' · 原始历史最多 24 小时/每 Node 4096 点，跨 Forward 共用；容量可提前淘汰，无完整历史承诺。';
    const latest = data.latest;
    if (latest) {
      const point = latest.point, count = point.counters;
      card('最近一个实例 · 累计尝试', count === null ? '不可用' : count.attempted);
      card('累计成功 / 失败 / 未知', count === null ? '不可用' : count.succeeded + ' / ' + count.failed + ' / ' + count.unknown);
      card('当前 inFlight（gauge）', count === null ? '不可用' : count.inFlight);
      card('累计有效结果子集失败占比', subsetRatio(point));
      const note = document.createElement('p'); note.className = 'hint';
      note.textContent = '仅最近一个完整绑定/Probe 实例/计数 epoch，不是 Forward 合计。' + latest.freshness + ' / ' + point.state +
        ' / ' + latest.delta.status + ' / overflowed=' + point.overflowed + ' · 接收 ' + stamp(latest.receivedAt) +
        '\n连续区间有效结果子集占比：' + intervalRatio(latest) + '。不是全部 attempt 的失败率、健康或网络丢包率。' +
        (latest.delta.status === 'continuous' && previousFor(latest, data.items) === null ? ' 服务端相邻区间前点不在当前窗口，页面未独立复核差值。' : '') +
        '\n发布映射/Probe 登记仅说明接收时来源，当前绑定与每个许可未重新核验。';
      el('latest').append(note);
    }
    for (const view of data.items) {
      const p = view.point, i = p.identity, b = i.binding, e = view.exporter, c = p.counters, d = view.delta, coverage = e.coverage, row = document.createElement('tr');
      cell(row, b.nodeId + ' / Boot ' + b.bootId + ' / Session ' + b.sessionEpoch + '\nSnapshot ' + b.snapshotGeneration + ' / Assignment ' + b.assignmentId +
        '\nForward r' + b.forwardRevision + ' / gen ' + b.deploymentGeneration + ' / fence ' + b.bindingFence + '\negress r' + b.egressPolicyRevision + '\n' + b.configDigest +
        '\nProbe instance ' + i.instanceId + ' / gen ' + i.instanceGeneration + '\nCounter epoch ' + shown(p.counterEpoch));
      cell(row, '采样 ' + stamp(p.capturedAt) + '\n导出 ' + stamp(e.capturedAt) + '\n接收 ' + stamp(view.receivedAt) + (p.endedAt === null ? '' : '\n终态 ' + stamp(p.endedAt)));
      cell(row, p.state + ' / ' + p.availability + ' / overflowed=' + p.overflowed + '\n' + view.freshness + ' / ' + (view.sessionCurrent ? '匹配当前机器会话' : '历史或隔离会话') +
        '\n恢复挂起 ' + view.recoverySuspended + ' / Node 撤销 ' + view.nodeRevoked + ' / 凭据窗口 ' + view.credentialWindowOpen);
      cell(row, c === null ? '不可用，不是零' : '累计 attempt ' + c.attempted + '\n累计 succeeded/failed/unknown ' + c.succeeded + '/' + c.failed + '/' + c.unknown +
        '\ninFlight gauge ' + c.inFlight + '\n有效结果子集 ' + subsetRatio(p));
      cell(row, d.status + (d.status === 'continuous' ? '\n区间 ' + d.elapsedMs + ' ms\nattempt +' + d.attempted + ' / succeeded +' + d.succeeded + ' / failed +' + d.failed + ' / unknown +' + d.unknown +
        '\n前点在途 gauge ' + d.inFlightBefore + '\n区间有效结果子集 ' + intervalRatio(view) : '\n无可用连续差值；不外推比例'));
      cell(row, 'Exporter ' + e.sampleEpoch + ' / seq ' + e.sequence + '\nuptime ' + e.uptimeMs + ' ms / 导出丢弃累计 ' + e.droppedSamples +
        '\n本轮 Node 来源 ' + coverage.returned + '/' + coverage.available + ' / omitted ' + coverage.omitted + ' / truncated=' + coverage.truncated +
        '\n轮转 ' + coverage.offset + ' → ' + coverage.nextOffset + ' / snapshot limit ' + coverage.snapshotLimit + '\n当前源不可用 ' + coverage.unavailableSources +
        '\n待冻结纯计数来源 ' + coverage.retiringSources + '/' + coverage.retiringSourceLimit + '（不是执行权）' +
        '\n终态淘汰 ' + coverage.tailsEvicted + ' / 到期 ' + coverage.tailsExpired + '\n历史始终不完整');
      cell(row, 'published-snapshot / 记录期限 ' + stamp(view.mapping.publishedUntil) + '\n当前绑定未重新核验\n接收时 Probe 来源 ' + view.mapping.probeInstance +
        '\n接收时实例期限 ' + (view.mapping.instanceUntil === null ? '未重新核验' : stamp(view.mapping.instanceUntil)) + '\n不是当前登记、许可或执行授权证明');
      el('rows').append(row);
    }
    if (!data.items.length) { const row = document.createElement('tr'); cell(row, '窗口内无可见 Probe 实例点；可能未启用、无尝试、未送达、映射/权限不符或已清理，不等于零失败或健康。'); row.firstChild.colSpan = 7; el('rows').append(row); }
  }
  async function reload() {
    if (!forward) return;
    invalidate(); erase();
    const version = epochVersion, requestedForward = forward, read = new AbortController(); controller = read;
    const timer = setTimeout(() => read.abort(), 5000);
    el('state').textContent = '正在读取有界 Probe 计数历史；最多等待 5 秒，无自动重试。';
    try {
      const duration = Number(el('range').value), limit = Number(el('limit').value);
      if (![900000,3600000,86400000].includes(duration) || ![128,256,512].includes(limit)) throw Error('Probe 计数查询范围无效');
      const now = Date.now(), from = new Date(now - duration).toISOString(), to = new Date(now).toISOString();
      const resource = 'forwards/' + encodeURIComponent(requestedForward) + '/probe-telemetry?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to) + '&limit=' + limit;
      const data = await request('GET', resource, undefined, undefined, { signal: read.signal, timeoutMs: 5000 });
      if (version !== epochVersion || forward !== requestedForward || read.signal.aborted) return;
      if (!responseValid(data, requestedForward, from, to, limit)) throw Error('Probe 计数响应格式、绑定或连续性无效；旧输出已清除');
      render(data);
    } catch (error) {
      if (version === epochVersion) { erase(); el('state').textContent = 'Probe 计数不可用；不推导零失败、健康或丢包。'; notify(read.signal.aborted ? 'Probe 计数请求已超时或取消' : error.message, true); }
    } finally { clearTimeout(timer); if (controller === read) controller = null; }
  }
  function open(forwardId) {
    invalidate(); erase();
    if (!id(forwardId)) throw Error('Forward ID 无效');
    forward = forwardId; el('title').textContent = 'Probe 独立累计观察 · ' + forwardId;
    if (!el('dialog').open) el('dialog').showModal();
    return reload();
  }
  el('reload').addEventListener('click', reload); el('close').addEventListener('click', clear);
  el('dialog').addEventListener('close', () => { if (!el('dialog').open) reset(); });
  for (const name of ['range','limit']) el(name).addEventListener('change', () => { invalidate(); erase(); el('state').textContent = '范围已改变，请手动读取；旧输出已清除。'; });
  return { open, clear };
}
