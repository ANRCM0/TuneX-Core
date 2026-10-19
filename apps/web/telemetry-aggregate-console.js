const limits = Object.freeze({ minuteSeconds: 604800, hourSeconds: 2592000,
  maxMinuteRowsPerNodeFamily: 10081, maxHourRowsPerNodeFamily: 721, maxCursorRowsPerNodeFamily: 512,
  maxMinuteRowsPerScope: 500000, maxHourRowsPerScope: 50000, maxCursorRowsPerScope: 16384,
  maxNodeFamiliesPerScope: 4096, maxBucketBytes: 8192, maxCursorBytes: 8192, maxQueryPoints: 512, cursorSeconds: 86400 });
const gauges = {
  process: ['goroutines','heapAllocBytes','runtimeBytes','maxRssBytes','openFileDescriptors','tcpStreams','udpAssociations','drainingInstances','authorizationActive'],
  host: ['logicalProcessors','memoryTotalBytes','memoryAvailableBytes','filesystemTotalBytes','filesystemAvailableBytes','loadOneMilli','loadFiveMilli','loadFifteenMilli','networkAvailableInterfaces','networkReturnedInterfaces'],
  forward: [], probe: ['inFlight'],
};
const counters = { process: ['cpuTimeNanos'], host: ['totalTicks','idleTicks','ioWaitTicks'],
  forward: ['payloadSentBytes','payloadReceivedBytes','tcpAccepted','tcpConnected','tcpClosed','udpAssociationsCreated','udpAssociationsClosed','udpDatagramsSent','udpDatagramsReceived'],
  probe: ['attempted','succeeded','failed','unknown'] };
const uint = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => uint(value) && value > 0;
const timestamp = value => uint(value) && value <= 253402300799999;
const id = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) && !/\s/.test(value);
const epoch = value => typeof value === 'string' && value.length === 32 && /^[a-f0-9]{32}$/.test(value);
const hash = value => typeof value === 'string' && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value);
const decimal = value => typeof value === 'string' && !/\s/.test(value) && /^(0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value) <= 18446744073709551615n;
const wide = value => typeof value === 'string' && !/\s/.test(value) && /^(0|[1-9][0-9]{0,38})$/.test(value) && BigInt(value) <= 340282366920938463463374607431768211455n;
const bool = value => typeof value === 'boolean';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const object = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const canonicalTime = value => typeof value === 'string' && timestamp(Date.parse(value)) && new Date(value).toISOString() === value;
const cursor = value => value === null || typeof value === 'string' && value.length > 0 && value.length <= 512 && /^[A-Za-z0-9_-]+$/.test(value);
const size = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const sameLimits = value => object(value, Object.keys(limits)) && Object.keys(limits).every(key => value[key] === limits[key]);
const ascii = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const order = (a, b) => a.start - b.start || ascii(a.nodeId, b.nodeId) || ascii(a.seriesKey, b.seriesKey);
const rowKey = body => ({ start: body.start, nodeId: body.nodeId, seriesKey: body.seriesKey });
const encodeKey = body => btoa(JSON.stringify(rowKey(body))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const stamp = value => new Date(value).toISOString() + '\nAsia/Shanghai: ' + new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
function ipv4(value) {
  const parts = value.split('.');
  return parts.length === 4 && parts.every(part => /^(0|[1-9][0-9]{0,2})$/.test(part) && Number(part) <= 255);
}
function address(value) {
  if (typeof value !== 'string' || !value.length || value.length > 127 || /\s/.test(value)) return false;
  if (ipv4(value)) return true;
  if (!value.includes(':') || /[^0-9a-fA-F:.]/.test(value)) return false;
  let input = value;
  if (input.includes('.')) {
    const boundary = input.lastIndexOf(':'), tail = input.slice(boundary + 1);
    if (!ipv4(tail)) return false;
    const bytes = tail.split('.').map(Number);
    input = input.slice(0, boundary) + ':' + ((bytes[0] << 8) | bytes[1]).toString(16) + ':' + ((bytes[2] << 8) | bytes[3]).toString(16);
  }
  const halves = input.split('::');
  if (halves.length > 2) return false;
  const groups = [...(halves[0] ? halves[0].split(':') : []), ...(halves[1] ? halves[1].split(':') : [])];
  return (halves.length === 1 ? groups.length === 8 : groups.length < 8) && groups.every(group => /^[a-fA-F0-9]{1,4}$/.test(group));
}
function executionValid(value, family) {
  if (family === 'probe') {
    if (!object(value, ['binding','instanceId','instanceGeneration'])) return false;
    const b = value.binding;
    return object(b, ['nodeId','bootId','sessionEpoch','snapshotGeneration','assignmentId','forwardId','forwardRevision','deploymentGeneration','bindingFence','configDigest','egressPolicyRevision']) &&
      [b.nodeId,b.bootId,b.assignmentId,b.forwardId].every(id) &&
      [b.sessionEpoch,b.snapshotGeneration,b.forwardRevision,b.deploymentGeneration,b.bindingFence,b.egressPolicyRevision].every(positive) && hash(b.configDigest) &&
      typeof value.instanceId === 'string' && value.instanceId.length === 64 && /^[a-f0-9]{64}$/.test(value.instanceId) && positive(value.instanceGeneration);
  }
  if (!object(value, ['nodeId','bootId','sessionEpoch','assignmentId','forwardId','forwardRevision','deploymentGeneration','bindingFence','role','protocol','driverId','driverSchemaVersion','configDigest','resource'])) return false;
  const drivers = { direct: 'native.direct.v1', 'relay-ingress': 'native.relay.v1', 'multihop-ingress': 'native.multihop.v1' };
  return [value.nodeId,value.bootId,value.assignmentId,value.forwardId].every(id) &&
    [value.sessionEpoch,value.forwardRevision,value.deploymentGeneration,value.bindingFence].every(positive) && Object.hasOwn(drivers, value.role) &&
    value.driverId === drivers[value.role] && value.driverSchemaVersion === 1 && ['tcp','udp'].includes(value.protocol) && hash(value.configDigest) &&
    object(value.resource, ['protocol','address','port']) && value.resource.protocol === value.protocol && address(value.resource.address) &&
    positive(value.resource.port) && value.resource.port <= 65535;
}
function seriesValid(series, body) {
  if (!object(series, ['family','nodeId','bootId','sessionEpoch','sampleEpoch','counterEpoch','execution']) ||
      series.family !== body.family || series.nodeId !== body.nodeId || !id(series.nodeId) || !id(series.bootId) || !positive(series.sessionEpoch) ||
      !epoch(series.sampleEpoch) || !(series.counterEpoch === null || epoch(series.counterEpoch))) return false;
  if (['process','host'].includes(body.family)) return series.execution === null && series.counterEpoch === null && body.forwardId === null;
  if (!executionValid(series.execution, body.family)) return false;
  const binding = body.family === 'probe' ? series.execution.binding : series.execution;
  return binding.nodeId === series.nodeId && binding.bootId === series.bootId && binding.sessionEpoch === series.sessionEpoch && binding.forwardId === body.forwardId;
}
// Series fields are closed ASCII JSON with safe integers; sorted keys implement their JCS encoding.
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
async function seriesDigest(series) {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(series)));
  return 'sha256:' + Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
function metricMapValid(map, allowed, kind, body) {
  if (!record(map) || Object.keys(map).some(key => !allowed.includes(key))) return false;
  for (const [key, stat] of Object.entries(map)) {
    const cumulative = kind === 'cumulative';
    if (!object(stat, cumulative ? ['count','first','last','min','max'] : ['count','sum','min','max','elapsedMs']) ||
        !positive(stat.count) || stat.count > body.sampleCount || !decimal(stat.min) || !decimal(stat.max) || BigInt(stat.min) > BigInt(stat.max)) return false;
    if (cumulative) {
      if (![stat.first,stat.last].every(value => decimal(value) && BigInt(value) >= BigInt(stat.min) && BigInt(value) <= BigInt(stat.max))) return false;
    } else {
      if (!wide(stat.sum) || !uint(stat.elapsedMs) || BigInt(stat.sum) < BigInt(stat.min) * BigInt(stat.count) || BigInt(stat.sum) > BigInt(stat.max) * BigInt(stat.count)) return false;
      if (kind === 'gauges' ? stat.elapsedMs !== 0 : stat.elapsedMs === 0 || stat.elapsedMs > body.coverage.elapsedMs || stat.count > body.coverage.intervalCount || !Object.hasOwn(body.cumulative, key)) return false;
    }
  }
  return true;
}
function bucketValid(body, query, scope) {
  const width = query.resolution === 'minute' ? 60000 : 3600000;
  if (!object(body, ['telemetryAggregateVersion','scopeId','nodeId','forwardId','family','seriesKey','series','resolution','start','end','sampleCount','receivedFrom','receivedTo','capturedFrom','capturedTo','quality','coverage','gauges','cumulative','increments']) ||
      body.telemetryAggregateVersion !== 1 || body.scopeId !== scope || !id(body.nodeId) || body.family !== query.family || body.resolution !== query.resolution ||
      !hash(body.seriesKey) || query.seriesKey !== null && body.seriesKey !== query.seriesKey || !seriesValid(body.series, body) ||
      (query.kind === 'node' ? body.nodeId !== query.id : body.forwardId !== query.id) || !timestamp(body.start) || body.start % width !== 0 ||
      body.start < Date.parse(query.from) || body.start >= Date.parse(query.to) || body.end !== body.start + width || !timestamp(body.end) ||
      !positive(body.sampleCount) || body.sampleCount > 1000000 || !timestamp(body.receivedFrom) || !timestamp(body.receivedTo) ||
      body.receivedFrom < body.start || body.receivedFrom > body.receivedTo || body.receivedTo >= body.end ||
      !timestamp(body.capturedFrom) || !timestamp(body.capturedTo) || body.capturedFrom > body.capturedTo || size(body) > limits.maxBucketBytes) return false;
  const q = body.quality, c = body.coverage, primary = ['baseline','continuous','gap','counterReset','unavailable','overflowed','terminal'];
  if (!object(q, [...primary,'truncated','exporterDropsMax','tailsEvictedMax','tailsExpiredMax','historyComplete']) ||
      [...primary,'truncated'].some(key => !uint(q[key]) || q[key] > body.sampleCount) || primary.reduce((sum, key) => sum + q[key], 0) !== body.sampleCount ||
      ![q.exporterDropsMax,q.tailsEvictedMax,q.tailsExpiredMax].every(decimal) || q.historyComplete !== false ||
      !object(c, ['intervalCount','elapsedMs','from','to','boundaryIntervals','attribution']) || !uint(c.intervalCount) || c.intervalCount > q.continuous ||
      !uint(c.elapsedMs) || !uint(c.boundaryIntervals) || c.boundaryIntervals > c.intervalCount || c.attribution !== 'receipt-interval-end' ||
      (c.intervalCount === 0 ? c.from !== null || c.to !== null || c.elapsedMs !== 0 : c.elapsedMs === 0 || !timestamp(c.from) || !timestamp(c.to) || c.from > c.to || c.to < body.receivedFrom || c.to > body.receivedTo)) return false;
  return metricMapValid(body.gauges, gauges[body.family], 'gauges', body) && metricMapValid(body.cumulative, counters[body.family], 'cumulative', body) &&
    metricMapValid(body.increments, counters[body.family], 'increments', body);
}
async function responseValid(data, query, scope) {
  if (!object(data, ['telemetryAggregateVersion','target','family','enabled','source','health','executionAuthorized','observedAt','window','retention','losses','items']) ||
      data.telemetryAggregateVersion !== 1 || !object(data.target, ['kind','id']) || data.target.kind !== query.kind || data.target.id !== query.id ||
      data.family !== query.family || !bool(data.enabled) || data.source !== 'agent-reported' || data.health !== 'unknown' || data.executionAuthorized !== false ||
      !canonicalTime(data.observedAt) || !sameLimits(data.retention) || !object(data.window, ['from','to','resolution','limit','seriesKey','after','nextAfter','truncated'])) return false;
  const w = data.window, losses = data.losses;
  if (['from','to','resolution','limit','seriesKey','after'].some(key => w[key] !== query[key]) || !cursor(w.nextAfter) || !bool(w.truncated) ||
      !object(losses, ['scope','minuteEvicted','hourEvicted','cursorEvicted','cursorExpired']) || losses.scope !== (query.kind === 'node' ? 'node-family' : 'scope-family') ||
      ![losses.minuteEvicted,losses.hourEvicted,losses.cursorEvicted,losses.cursorExpired].every(wide) || !Array.isArray(data.items) || data.items.length > query.limit ||
      (w.truncated ? data.items.length !== query.limit || w.nextAfter === null : w.nextAfter !== null)) return false;
  let previous = query.after === null ? null : JSON.parse(atob(query.after.replace(/-/g, '+').replace(/_/g, '/')));
  const digests = new Map();
  for (const row of data.items) {
    if (!object(row, ['body','recoverySuspended']) || !bool(row.recoverySuspended) || !bucketValid(row.body, query, scope) || previous && order(previous, row.body) >= 0) return false;
    previous = row.body;
    const identity = canonical(row.body.series);
    if (digests.has(identity) ? digests.get(identity) !== row.body.seriesKey : await seriesDigest(row.body.series) !== row.body.seriesKey) return false;
    digests.set(identity, row.body.seriesKey);
  }
  return !w.truncated || w.nextAfter === encodeKey(data.items[data.items.length - 1].body);
}
function capacityValid(data) {
  if (!object(data, ['telemetryAggregateVersion','enabled','source','executionAuthorized','observedAt','policy','observed','logicalBudget']) ||
      data.telemetryAggregateVersion !== 1 || !bool(data.enabled) || data.source !== 'observation-read-model' || data.executionAuthorized !== false ||
      !canonicalTime(data.observedAt) || !sameLimits(data.policy) || !object(data.observed, ['minuteRows','hourRows','cursorRows','nodeFamilies']) ||
      !Object.values(data.observed).every(uint)) return false;
  const expected = {
    maxBucketJsonBytesPerNode: (BigInt(limits.maxMinuteRowsPerNodeFamily + limits.maxHourRowsPerNodeFamily) * 4n * BigInt(limits.maxBucketBytes)).toString(),
    maxCursorJsonBytesPerNode: (BigInt(limits.maxCursorRowsPerNodeFamily) * 4n * BigInt(limits.maxCursorBytes)).toString(),
    maxBucketJsonBytesPerScope: (BigInt(limits.maxMinuteRowsPerScope + limits.maxHourRowsPerScope) * BigInt(limits.maxBucketBytes)).toString(),
    maxCursorJsonBytesPerScope: (BigInt(limits.maxCursorRowsPerScope) * BigInt(limits.maxCursorBytes)).toString(),
    rawMaxJsonBytesPerNode: (2n * 8640n * 8192n + 2n * 4096n * 6144n).toString(), scopeRawHardCap: false, physicalBytesMeasured: false,
  };
  return object(data.logicalBudget, Object.keys(expected)) && Object.keys(expected).every(key => data.logicalBudget[key] === expected[key]);
}
function fraction(numerator, denominator, scale = 1n) {
  if (denominator <= 0n) return '不可计算（不是零）';
  const value = numerator * scale * 1000n / denominator;
  return (value / 1000n).toString() + '.' + (value % 1000n).toString().padStart(3, '0');
}

export function initTelemetryAggregateConsole({ request, notify, byId, getScope, document = globalThis.document }) {
  const el = name => byId('telemetry-aggregate-' + name);
  let target = null, epochVersion = 0, controller = null, frozen = null, nextAfter = null;
  function invalidate() { epochVersion++; controller?.abort(); controller = null; }
  function erase() { el('rows').replaceChildren(); el('meta').textContent = ''; el('capacity-output').textContent = ''; nextAfter = null; el('next').disabled = true; }
  function reset() { invalidate(); target = null; frozen = null; erase(); el('state').textContent = ''; el('title').textContent = '聚合历史'; }
  function clear() { reset(); el('dialog').close(); }
  function changed() { invalidate(); frozen = null; erase(); el('state').textContent = '筛选已改变，旧输出已清除；请手动读取。'; }
  function cell(row, value) { const item = document.createElement('td'); item.textContent = value; row.append(item); }
  function appendMetrics(lines, title, allowed, map, kind) {
    if (!allowed.length) return;
    lines.push(title);
    for (const key of allowed) {
      const stat = map[key];
      if (!stat) { lines.push(key + ': 不可用 / 无合格观察（不是零）'); continue; }
      if (kind === 'cumulative') lines.push(key + ': first=' + stat.first + ' last=' + stat.last + ' min=' + stat.min + ' max=' + stat.max + ' n=' + stat.count + ' (not summed)');
      else if (kind === 'gauges') lines.push(key + ': observation mean=' + fraction(BigInt(stat.sum), BigInt(stat.count)) + ' min=' + stat.min + ' max=' + stat.max + ' n=' + stat.count + ' observation sum=' + stat.sum + ' (not time-weighted)');
      else lines.push(key + ': delta sum=' + stat.sum + ' min=' + stat.min + ' max=' + stat.max + ' intervals=' + stat.count + ' eligible=' + stat.elapsedMs + ' ms');
    }
  }
  function render(data, query) {
    el('state').textContent = (data.enabled ? 'Control 接收已开启，不保证 Agent 已开启采集。' : 'Control 接收关闭，已存历史仍可读取。') + ' source=agent-reported; health=unknown; executionAuthorized=false。';
    const losses = data.losses;
    el('meta').textContent = query.kind + ': ' + query.id + ' / ' + query.family + ' / ' + query.resolution + '\n查询观察时间: ' + stamp(data.observedAt) +
      '\n固定窗口 [from,to):\n' + stamp(query.from) + '\n' + stamp(query.to) + '\nSeries 筛选: ' + (query.seriesKey ?? '全部精确 series，逐行分开，不合并') +
      '\n桶数: ' + data.items.length + '/' + query.limit + '; truncated=' + data.window.truncated + '\n淘汰统计范围=' + losses.scope +
      '; minute evicted=' + losses.minuteEvicted + '; hour evicted=' + losses.hourEvicted + '; cursors evicted=' + losses.cursorEvicted + '; cursors expired=' + losses.cursorExpired +
      '\nKeyset 分页不是全库快照；并发更新或清理可能改变剩余结果，不保证完整历史。';
    for (const { body: b, recoverySuspended } of data.items) {
      const row = document.createElement('tr'), gaugeLines = [], counterLines = [], deltaLines = [], q = b.quality, c = b.coverage;
      const identity = document.createElement('td'), label = document.createElement('p'), detail = document.createElement('pre'), select = document.createElement('button');
      label.textContent = b.seriesKey; detail.textContent = JSON.stringify(b.series, null, 2); select.type = 'button'; select.className = 'secondary'; select.textContent = '仅筛选此精确 Series';
      select.addEventListener('click', () => { el('series').value = b.seriesKey; changed(); });
      identity.append(label, select, detail); row.append(identity);
      cell(row, 'UTC 桶 [start,end):\n' + stamp(b.start) + '\n' + stamp(b.end) + (b.end > Date.parse(data.observedAt) ? '\n当前桶尚未关闭，内容不完整' : '') +
        '\n接收时间边界:\n' + stamp(b.receivedFrom) + '\n' + stamp(b.receivedTo) + '\n采集时间边界（Agent 时钟）:\n' + stamp(b.capturedFrom) + '\n' + stamp(b.capturedTo));
      appendMetrics(gaugeLines, 'Gauge 采样统计', gauges[b.family], b.gauges, 'gauges');
      cell(row, gaugeLines.join('\n') || '该家族无 Gauge 指标。');
      appendMetrics(counterLines, '原始累计观察（不求和）', counters[b.family], b.cumulative, 'cumulative');
      cell(row, counterLines.join('\n'));
      appendMetrics(deltaLines, '合格连续区间增量', counters[b.family], b.increments, 'increments');
      if (b.family === 'forward') for (const key of ['payloadSentBytes','payloadReceivedBytes']) {
        const stat = b.increments[key];
        deltaLines.push(key + ' 合格区间速率: ' + (stat ? fraction(BigInt(stat.sum), BigInt(stat.elapsedMs), 1000n) + ' B/s' : '不可计算（不是零）'));
      }
      if (b.family === 'process') {
        const stat = b.increments.cpuTimeNanos;
        deltaLines.push('进程 CPU / 合格 elapsed: ' + (stat ? fraction(BigInt(stat.sum), BigInt(stat.elapsedMs) * 1000000n, 100n) + '%' : '不可计算（不是零）'));
      }
      if (b.family === 'probe') {
        const succeeded = b.increments.succeeded, failed = b.increments.failed;
        const compatible = succeeded && failed && succeeded.count === failed.count && succeeded.elapsedMs === failed.elapsedMs;
        const completed = compatible ? BigInt(succeeded.sum) + BigInt(failed.sum) : 0n;
        deltaLines.push('已完成有效结果子集失败占比 failed/(succeeded+failed): ' +
          (completed > 0n ? fraction(BigInt(failed.sum), completed, 100n) + '%' : '不可计算（不是零）') +
          '\n仅当两项 count / 合格 elapsed 相同且分母大于零时计算；排除 unknown 和 inFlight。前期在途工作可在本期完成，不是本桶 attempted 的失败率、健康或网络丢包率；inFlight 是 gauge。');
      }
      if (b.family === 'host') {
        const total = b.increments.totalTicks, idle = b.increments.idleTicks, wait = b.increments.ioWaitTicks;
        const compatible = total && idle && wait && total.count === idle.count && total.count === wait.count &&
          total.elapsedMs === idle.elapsedMs && total.elapsedMs === wait.elapsedMs;
        const denominator = compatible ? BigInt(total.sum) : 0n;
        const excluded = compatible ? BigInt(idle.sum) + BigInt(wait.sum) : 0n;
        deltaLines.push('OS CPU 合格 ticks 加权忙碌比例（排除 iowait）: ' +
          (denominator > 0n && excluded <= denominator ? fraction(denominator - excluded, denominator, 100n) + '%' : '不可计算（不是零）') +
          '\n仅在 total/idle/iowait 的 count 和合格 elapsed 全部匹配时计算；不是各样本百分比的平均值，也不代表物理宿主或健康。' +
          '\n不提供网卡字节增量或速率；network gauge 只表示接口覆盖。');
      }
      cell(row, deltaLines.join('\n'));
      cell(row, 'samples=' + b.sampleCount + '\nbaseline=' + q.baseline + ' continuous=' + q.continuous + ' gap=' + q.gap + ' counterReset=' + q.counterReset +
        '\nunavailable=' + q.unavailable + ' overflowed=' + q.overflowed + ' terminal=' + q.terminal + ' truncated=' + q.truncated +
        '\nExporter dropped max=' + q.exporterDropsMax + '\nTails evicted max=' + q.tailsEvictedMax + ' expired max=' + q.tailsExpiredMax +
        '\nRecovery suspended=' + recoverySuspended + '\nHistory complete=false');
      cell(row, 'attribution=' + c.attribution + '\nintervals=' + c.intervalCount + ' eligible elapsed=' + c.elapsedMs + ' ms\nboundary intervals=' + c.boundaryIntervals +
        '\nCoverage start: ' + (c.from === null ? 'unavailable' : stamp(c.from)) + '\nCoverage end: ' + (c.to === null ? 'unavailable' : stamp(c.to)) +
        '\nEntire increment belongs to receipt END bucket; coverage may start before bucket. Not exact event-time traffic or uniform distribution.');
      el('rows').append(row);
    }
    if (!data.items.length) { const row = document.createElement('tr'); cell(row, '所选窗口无可见聚合桶；缺测、不可用、淘汰或未启用均不是零，也不代表健康。'); row.firstChild.colSpan = 7; el('rows').append(row); }
    nextAfter = data.window.nextAfter; el('next').disabled = nextAfter === null;
  }
  function selection() {
    const family = el('family').value, resolution = el('resolution').value, duration = Number(el('range').value), limit = Number(el('limit').value), seriesKey = el('series').value;
    const families = target.kind === 'node' ? ['process','host'] : ['forward','probe'];
    if (!families.includes(family) || !['minute','hour'].includes(resolution) || ![128,256,512].includes(limit) ||
        !(resolution === 'minute' ? [3600000,86400000,604800000] : [3600000,86400000,604800000,2592000000]).includes(duration) ||
        seriesKey !== '' && !hash(seriesKey)) throw Error('聚合筛选无效；请使用精确的 sha256 Series Key，或留空。');
    const width = resolution === 'minute' ? 60000 : 3600000, to = Math.floor(Date.now() / width) * width + width;
    return Object.freeze({ kind: target.kind, id: target.id, scope: getScope(), family, resolution, from: new Date(to - duration).toISOString(), to: new Date(to).toISOString(), limit, seriesKey: seriesKey || null, after: null });
  }
  async function read(next = false) {
    if (!target) return;
    let query;
    try {
      if (next && (!frozen || nextAfter === null)) return;
      query = next ? Object.freeze({ ...frozen, after: nextAfter }) : selection();
    } catch (error) { changed(); notify(error.message, true); return; }
    invalidate(); erase(); frozen = query;
    const version = epochVersion, readController = new AbortController(); controller = readController;
    const timer = setTimeout(() => readController.abort(), 5000);
    el('state').textContent = '正在读取聚合历史；最多等待五秒，不自动重试。';
    try {
      const params = new URLSearchParams({ family: query.family, resolution: query.resolution, from: query.from, to: query.to, limit: String(query.limit) });
      if (query.seriesKey !== null) params.set('seriesKey', query.seriesKey);
      if (query.after !== null) params.set('after', query.after);
      const resource = (query.kind === 'node' ? 'nodes/' : 'forwards/') + encodeURIComponent(query.id) + '/telemetry/aggregates?' + params;
      const data = await request('GET', resource, undefined, undefined, { signal: readController.signal, timeoutMs: 5000 });
      if (version !== epochVersion || query.scope !== getScope()) return;
      readController.signal.throwIfAborted();
      if (!await responseValid(data, query, query.scope)) throw Error('聚合响应的身份、算术或窗口无效，输出已清除。');
      if (version !== epochVersion || query.scope !== getScope()) return;
      readController.signal.throwIfAborted();
      render(data, query);
    } catch (error) {
      if (version === epochVersion) { erase(); frozen = null; el('state').textContent = '聚合不可用，不推导零值或健康。'; notify(readController.signal.aborted ? '聚合读取已超时或取消。' : error.message, true); }
    } finally { clearTimeout(timer); if (controller === readController) controller = null; }
  }
  async function capacity() {
    if (!target) return;
    invalidate(); erase(); frozen = null;
    const version = epochVersion, scope = getScope(), readController = new AbortController(); controller = readController;
    const timer = setTimeout(() => readController.abort(), 5000);
    el('state').textContent = '正在手动读取整个 Scope 的容量；共享读者冷却限制生效，不自动重试。';
    try {
      const data = await request('GET', 'telemetry/capacity', undefined, undefined, { signal: readController.signal, timeoutMs: 5000 });
      if (version !== epochVersion || scope !== getScope()) return;
      readController.signal.throwIfAborted();
      if (!capacityValid(data)) throw Error('容量响应无效，输出已清除。');
      el('state').textContent = '整个 Scope 的观察读模型，不是当前 Node/Forward 的用量，也不是物理磁盘测量。';
      el('capacity-output').textContent = 'Scope: ' + scope + '\n查询观察时间: ' + stamp(data.observedAt) + '\n接收开关 enabled=' + data.enabled + '; executionAuthorized=false\n' +
        '该 Scope 全部指标家族的行数（恢复后的计数可能超过预算）:\n' + JSON.stringify(data.observed, null, 2) +
        '\n有界 JSON 逻辑预算（字节；不含 MySQL 索引、数据页和额外开销）:\n' + JSON.stringify(data.logicalBudget, null, 2) +
        '\n保留与容量策略（容量可能提前淘汰，物理清理分批进行）:\n' + JSON.stringify(data.policy, null, 2) +
        '\nRaw Scope 硬总量上限=false；物理占用已测量=false。不作物理空间保证。';
    } catch (error) {
      if (version === epochVersion) { erase(); el('state').textContent = '容量不可用，不推导容量或零值结论。'; notify(readController.signal.aborted ? '容量读取已超时或取消。' : error.message, true); }
    } finally { clearTimeout(timer); if (controller === readController) controller = null; }
  }
  function open(kind, targetId) {
    reset();
    if (!['node','forward'].includes(kind) || !id(targetId)) throw Error('聚合查询目标无效。');
    target = { kind, id: targetId };
    el('title').textContent = '聚合历史 / ' + kind + ' / ' + targetId;
    el('family').replaceChildren();
    for (const family of kind === 'node' ? ['process','host'] : ['forward','probe']) { const option = document.createElement('option'); option.value = family; option.textContent = family; el('family').append(option); }
    el('series').value = ''; el('resolution').value = 'minute'; el('range').value = '3600000';
    el('range').querySelector('option[value="2592000000"]').disabled = true;
    el('state').textContent = '选择指标家族和有界时间窗后手动读取，不自动轮询。历史与容量读取之间请至少间隔一秒。';
    if (!el('dialog').open) el('dialog').showModal();
  }
  for (const name of ['family','resolution','range','limit']) el(name).addEventListener('change', () => {
    if (name === 'resolution') {
      const minute = el('resolution').value === 'minute'; el('range').querySelector('option[value="2592000000"]').disabled = minute;
      if (minute && el('range').value === '2592000000') el('range').value = '604800000';
    }
    changed();
  });
  el('series').addEventListener('input', changed);
  el('reload').addEventListener('click', () => read());
  el('next').addEventListener('click', () => read(true));
  el('capacity').addEventListener('click', capacity);
  el('close').addEventListener('click', clear);
  el('dialog').addEventListener('close', () => { if (!el('dialog').open) reset(); });
  return { openNode: nodeId => open('node', nodeId), openForward: forwardId => open('forward', forwardId), clear };
}
