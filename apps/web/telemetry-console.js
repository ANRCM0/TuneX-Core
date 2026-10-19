const object = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const uint = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => uint(value) && value > 0;
const id = value => typeof value === 'string' && !/\s/.test(value) && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const decimal = value => typeof value === 'string' && !/\s/.test(value) && /^(0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value) <= 18446744073709551615n;
const nullable = (value, predicate) => value === null || predicate(value);
const time = value => {
  if (typeof value !== 'string' || /\s/.test(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value) || !Number.isFinite(Date.parse(value)) || Date.parse(value) < 0) return false;
  const seconds = value.slice(0, 19), fraction = value.includes('.') ? value.slice(20, -1) : '';
  return new Date(value).toISOString() === seconds + '.' + fraction.slice(0, 3).padEnd(3, '0') + 'Z';
};
const canonicalTime = value => time(value) && new Date(value).toISOString() === value;
const bool = value => typeof value === 'boolean';
const platforms = new Set(['linux','windows','darwin','freebsd','openbsd','netbsd','dragonfly','solaris','aix','illumos','android','ios','js','wasip1','plan9']);

function sampleValid(sample, nodeId) {
  if (!object(sample, ['telemetryVersion','kind','nodeId','bootId','sessionEpoch','sampleEpoch','sequence','capturedAt','uptimeMs','platform','process','runtime','droppedSamples'])) return false;
  const process = sample.process, runtime = sample.runtime;
  return sample.telemetryVersion === 1 && sample.kind === 'telemetry-sample' && sample.nodeId === nodeId && id(sample.bootId) &&
    positive(sample.sessionEpoch) && typeof sample.sampleEpoch === 'string' && sample.sampleEpoch.length === 32 && /^[a-f0-9]{32}$/.test(sample.sampleEpoch) && positive(sample.sequence) &&
    time(sample.capturedAt) && uint(sample.uptimeMs) && platforms.has(sample.platform) && decimal(sample.droppedSamples) &&
    object(process, ['goroutines','heapAllocBytes','runtimeBytes','cpuTimeNanos','maxRssBytes','openFileDescriptors']) &&
    uint(process.goroutines) && process.goroutines <= 10000000 && decimal(process.heapAllocBytes) && decimal(process.runtimeBytes) && nullable(process.cpuTimeNanos, decimal) &&
    nullable(process.maxRssBytes, decimal) && nullable(process.openFileDescriptors, value => uint(value) && value <= 1000000000) &&
    object(runtime, ['snapshotGeneration','authorizationActive','tcpStreams','udpAssociations','drainingInstances']) &&
    uint(runtime.snapshotGeneration) && bool(runtime.authorizationActive) && decimal(runtime.tcpStreams) && decimal(runtime.udpAssociations) && uint(runtime.drainingInstances) && runtime.drainingInstances <= 1000000;
}
function pointValid(point, nodeId) {
  if (!object(point, ['sample','receivedAt','recoverySuspended','sessionCurrent','freshness','delta'])) return false;
  const delta = point.delta;
  return sampleValid(point.sample, nodeId) && canonicalTime(point.receivedAt) && bool(point.recoverySuspended) && bool(point.sessionCurrent) &&
    ['fresh','stale','historical'].includes(point.freshness) &&
    object(delta, ['status','elapsedMs','cpuTimeNanos','exportDroppedSamples']) &&
    ['baseline','continuous','gap','counter-reset','historical'].includes(delta.status) && nullable(delta.elapsedMs, positive) &&
    nullable(delta.cpuTimeNanos, decimal) && nullable(delta.exportDroppedSamples, decimal) &&
    (delta.status === 'continuous' ? positive(delta.elapsedMs) : delta.elapsedMs === null && delta.cpuTimeNanos === null) &&
    (!['baseline','historical'].includes(delta.status) || delta.exportDroppedSamples === null) &&
    (point.sessionCurrent ? point.freshness !== 'historical' && delta.status !== 'historical' : point.freshness === 'historical' && delta.status === 'historical');
}
function pointContextValid(point, data) {
  if (point.sessionCurrent && (!data.enabled || data.nodeRevoked || point.recoverySuspended || data.currentSession === null ||
      point.sample.bootId !== data.currentSession.bootId || point.sample.sessionEpoch !== data.currentSession.sessionEpoch)) return false;
  const age = Date.parse(data.observedAt) - Date.parse(point.receivedAt);
  return point.freshness === 'historical' || (point.freshness === 'fresh' ? age >= 0 && age <= 30000 : age < 0 || age > 30000);
}
function responseValid(data, nodeId, from, to, limit) {
  return object(data, ['telemetryVersion','nodeId','enabled','source','health','executionAuthorized','observedAt','currentSession','nodeRevoked','window','retention','latest','items']) &&
    data.telemetryVersion === 1 && data.nodeId === nodeId && bool(data.enabled) && data.source === 'agent-reported' && data.health === 'unknown' &&
    data.executionAuthorized === false && canonicalTime(data.observedAt) && bool(data.nodeRevoked) &&
    (data.currentSession === null || object(data.currentSession, ['sessionEpoch','bootId']) && positive(data.currentSession.sessionEpoch) && id(data.currentSession.bootId)) &&
    object(data.window, ['from','to','limit','truncated']) && data.window.from === from && data.window.to === to && data.window.limit === limit && bool(data.window.truncated) &&
    object(data.retention, ['rawSeconds','maxPointsPerNode']) && data.retention.rawSeconds === 86400 && data.retention.maxPointsPerNode === 8640 &&
    nullable(data.latest, point => pointValid(point, nodeId)) && Array.isArray(data.items) && data.items.length <= limit &&
    data.items.every(point => pointValid(point, nodeId) && Date.parse(point.receivedAt) >= Date.parse(from) && Date.parse(point.receivedAt) <= Date.parse(to)) &&
    (data.latest === null || pointContextValid(data.latest, data)) &&
    data.items.every((point, index) => pointContextValid(point, data) && (index === 0 || Date.parse(data.items[index - 1].receivedAt) <= Date.parse(point.receivedAt))) &&
    new Set(data.items.map(point => point.sample.sampleEpoch + ':' + point.sample.sequence)).size === data.items.length;
}
function bytes(value) {
  if (value === null) return '不支持 / 未提供';
  const n = BigInt(value), unit = 1048576n;
  return (n / unit).toString() + '.' + ((n % unit) * 100n / unit).toString().padStart(2, '0') + ' MiB (' + value + ' B)';
}
function cpu(point) {
  const delta = point.delta;
  if (delta.status !== 'continuous' || delta.cpuTimeNanos === null || !positive(delta.elapsedMs)) return '不可计算';
  const hundredths = BigInt(delta.cpuTimeNanos) * 10000n / (BigInt(delta.elapsedMs) * 1000000n);
  return (hundredths / 100n).toString() + '.' + (hundredths % 100n).toString().padStart(2, '0') + '%';
}
const shown = value => value === null ? '不支持 / 未提供' : String(value);
const stamp = value => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) + ' · ' + value;

export function initTelemetryConsole({ request, notify, byId, document = globalThis.document }) {
  const el = name => byId('telemetry-' + name);
  let node = null, epoch = 0, controller = null;
  function invalidate() { epoch++; controller?.abort(); controller = null; }
  function erase() { el('latest').replaceChildren(); el('rows').replaceChildren(); el('meta').textContent = ''; }
  function clear() {
    invalidate(); node = null; erase(); el('title').textContent = 'Agent 进程指标'; el('state').textContent = ''; el('dialog').close();
  }
  function cell(row, text) { const item = document.createElement('td'); item.textContent = text; row.append(item); }
  function card(title, value) {
    const item = document.createElement('div'); item.className = 'metric';
    const heading = document.createElement('span'), output = document.createElement('strong');
    heading.textContent = title; output.textContent = value; item.append(heading, output); el('latest').append(item);
  }
  function render(data) {
    const latest = data.latest;
    el('state').textContent = (data.enabled ? 'Control 接收开关已启用（不保证 Agent 已开启）' : 'Control 指标接收关闭；如有历史数据仅作历史观察') +
      ' · source: agent-reported · health: unknown · 无执行授权 · 节点' + (data.nodeRevoked ? '已撤销' : '未撤销');
    el('meta').textContent = 'Node: ' + node + ' · 查询观察时间: ' + stamp(data.observedAt) + ' · 窗口: ' + stamp(data.window.from) + ' → ' + stamp(data.window.to) +
      ' · 返回 ' + data.items.length + ' / 上限 ' + data.window.limit + ' 点 · ' + (data.window.truncated ? '已截断，不代表完整覆盖' : '未触及返回上限，仍不保证完整覆盖') +
      ' · 当前记录会话: ' + (data.currentSession ? data.currentSession.sessionEpoch + ' / ' + shown(data.currentSession.bootId) : '无');
    if (latest) {
      const process = latest.sample.process, runtime = latest.sample.runtime;
      card('最近记录 Heap', bytes(process.heapAllocBytes)); card('最近记录 Go Runtime', bytes(process.runtimeBytes));
      card('进程峰值 RSS（非主机内存）', bytes(process.maxRssBytes)); card('最近连续区间 CPU（非主机）', cpu(latest));
      const note = document.createElement('p'); note.className = 'hint';
      note.textContent = '最近记录（可在所选窗口外）: ' + stamp(latest.sample.capturedAt) + ' · 接收: ' + stamp(latest.receivedAt) +
        ' · ' + latest.freshness + ' · ' + (latest.sessionCurrent ? '当前会话' : '历史会话') + ' · recoverySuspended=' + latest.recoverySuspended +
        ' · Agent 自报 authorizationActive=' + runtime.authorizationActive + '（不是当前授权裁决）';
      el('latest').append(note);
    }
    for (const point of data.items) {
      const sample = point.sample, process = sample.process, runtime = sample.runtime, row = document.createElement('tr');
      cell(row, '采集 ' + stamp(sample.capturedAt) + '\n接收 ' + stamp(point.receivedAt));
      cell(row, point.freshness + ' / ' + (point.sessionCurrent ? '当前会话' : '历史会话') + '\n' + point.delta.status +
        ' / session ' + sample.sessionEpoch + ' / seq ' + sample.sequence + '\nboot ' + sample.bootId + ' / sample ' + sample.sampleEpoch +
        '\nuptime ' + sample.uptimeMs + ' ms / ' + sample.platform + '\n恢复挂起 ' + point.recoverySuspended);
      cell(row, bytes(process.heapAllocBytes) + ' / ' + bytes(process.runtimeBytes) + ' / ' + bytes(process.maxRssBytes));
      cell(row, process.goroutines + ' / ' + shown(process.openFileDescriptors));
      cell(row, runtime.tcpStreams + ' / ' + runtime.udpAssociations + ' / ' + runtime.drainingInstances + '\nSnapshot ' + runtime.snapshotGeneration + ' / 自报授权 ' + runtime.authorizationActive);
      cell(row, cpu(point) + ' / 区间 ' + shown(point.delta.elapsedMs) + ' ms\n累计 CPU ' + shown(process.cpuTimeNanos) + ' ns\n丢弃累计 ' + sample.droppedSamples + ' / 区间 ' + shown(point.delta.exportDroppedSamples));
      el('rows').append(row);
    }
    if (!data.items.length) { const row = document.createElement('tr'); cell(row, '所选窗口无可见样本；可能未启用、尚未上报、已重启或已清理，不等于零。'); row.firstChild.colSpan = 6; el('rows').append(row); }
  }
  async function reload() {
    if (!node) return;
    invalidate(); erase();
    const version = epoch, requestedNode = node, read = new AbortController(); controller = read;
    el('state').textContent = '正在读取有界历史；最多等待 5 秒，不自动重试。';
    const timer = setTimeout(() => read.abort(), 5000);
    try {
      const duration = Number(el('range').value), limit = Number(el('limit').value);
      if (![900000,3600000,86400000].includes(duration) || ![128,256,512].includes(limit)) throw Error('指标查询范围无效');
      const now = Date.now(), from = new Date(now - duration).toISOString(), to = new Date(now).toISOString();
      const resource = 'nodes/' + encodeURIComponent(requestedNode) + '/telemetry?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to) + '&limit=' + limit;
      const data = await request('GET', resource, undefined, undefined, { signal: read.signal, timeoutMs: 5000 });
      if (epoch !== version || node !== requestedNode || read.signal.aborted) return;
      if (!responseValid(data, requestedNode, from, to, limit)) throw Error('指标响应格式或边界无效；已清除旧数据，健康仍未知');
      render(data);
    } catch (error) {
      if (epoch === version) { erase(); el('state').textContent = '指标不可用；无健康或零值结论。'; notify(read.signal.aborted ? '指标请求已超时或取消' : error.message, true); }
    } finally { clearTimeout(timer); if (controller === read) controller = null; }
  }
  function open(nodeId) {
    invalidate(); erase();
    if (!id(nodeId)) throw Error('Node ID 无效');
    node = nodeId; el('title').textContent = 'Agent 进程指标 · ' + nodeId;
    if (!el('dialog').open) el('dialog').showModal();
    return reload();
  }
  el('reload').addEventListener('click', reload);
  for (const name of ['range','limit']) el(name).addEventListener('change', () => { invalidate(); erase(); el('state').textContent = '范围已改变，请手动读取；旧数据已清除。'; });
  el('close').addEventListener('click', clear);
  el('dialog').addEventListener('close', () => { if (!el('dialog').open) { invalidate(); node = null; erase(); el('title').textContent = 'Agent 进程指标'; el('state').textContent = ''; } });
  return { open, clear };
}
