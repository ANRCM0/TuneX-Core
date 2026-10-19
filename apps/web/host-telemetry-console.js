const object = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const uint = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => uint(value) && value > 0;
const id = value => typeof value === 'string' && value.length <= 128 && !/\s/.test(value) && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
const epoch = value => typeof value === 'string' && value.length === 32 && /^[a-f0-9]{32}$/.test(value);
const decimal = value => typeof value === 'string' && !/\s/.test(value) && /^(0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value) <= 18446744073709551615n;
const bool = value => typeof value === 'boolean';
const platforms = new Set(['aix','android','darwin','dragonfly','freebsd','illumos','ios','js','linux','netbsd','openbsd','plan9','solaris','wasip1','windows']);
const cpuDeltas = ['cpuTotalTicks','cpuIdleTicks','cpuIoWaitTicks'];
function time(value) {
  if (typeof value !== 'string' || /\s/.test(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)) return false;
  const at = Date.parse(value);
  return Number.isSafeInteger(at) && at >= 0 && new Date(at).toISOString().slice(0, 19) === value.slice(0, 19);
}
const canonicalTime = value => time(value) && new Date(value).toISOString() === value;
function source(value, measurements, predicate) {
  return ['available','unavailable','unsupported'].includes(value.availability) &&
    (value.availability === 'available' ? predicate() : measurements.every(key => value[key] === null));
}
function sampleValid(sample, nodeId) {
  if (!object(sample, ['hostTelemetryVersion','kind','nodeId','bootId','sessionEpoch','sampleEpoch','sequence','capturedAt','uptimeMs','platform','droppedSamples','host']) ||
      sample.hostTelemetryVersion !== 1 || sample.kind !== 'host-telemetry-sample' || sample.nodeId !== nodeId || !id(sample.bootId) ||
      !positive(sample.sessionEpoch) || !epoch(sample.sampleEpoch) || !positive(sample.sequence) || !time(sample.capturedAt) || !uint(sample.uptimeMs) ||
      !platforms.has(sample.platform) || !decimal(sample.droppedSamples) || !object(sample.host, ['scope','cpu','memory','load','filesystem','network']) || sample.host.scope !== 'agent-visible-os') return false;
  const { cpu, memory, load, filesystem, network } = sample.host;
  if (!object(cpu, ['availability','logicalProcessors','totalTicks','idleTicks','ioWaitTicks']) ||
      !source(cpu, ['logicalProcessors','totalTicks','idleTicks','ioWaitTicks'], () => positive(cpu.logicalProcessors) && cpu.logicalProcessors <= 65536 &&
        decimal(cpu.totalTicks) && decimal(cpu.idleTicks) && decimal(cpu.ioWaitTicks) && BigInt(cpu.idleTicks) + BigInt(cpu.ioWaitTicks) <= BigInt(cpu.totalTicks)) ||
      !object(memory, ['availability','totalBytes','availableBytes']) || !source(memory, ['totalBytes','availableBytes'], () =>
        decimal(memory.totalBytes) && decimal(memory.availableBytes) && BigInt(memory.availableBytes) <= BigInt(memory.totalBytes)) ||
      !object(load, ['availability','oneMilli','fiveMilli','fifteenMilli']) || !source(load, ['oneMilli','fiveMilli','fifteenMilli'], () =>
        decimal(load.oneMilli) && decimal(load.fiveMilli) && decimal(load.fifteenMilli)) ||
      !object(filesystem, ['availability','scope','totalBytes','availableBytes']) || filesystem.scope !== 'agent-root-filesystem' ||
      !source(filesystem, ['totalBytes','availableBytes'], () => decimal(filesystem.totalBytes) && decimal(filesystem.availableBytes) && BigInt(filesystem.availableBytes) <= BigInt(filesystem.totalBytes)) ||
      !object(network, ['availability','scope','limit','available','returned','omitted','truncated','interfaces']) ||
      !['available','unavailable','unsupported'].includes(network.availability) || network.scope !== 'agent-network-namespace' || network.limit !== 16 ||
      !uint(network.available) || network.available > 128 || !Array.isArray(network.interfaces) || network.interfaces.length > 16 ||
      network.returned !== network.interfaces.length || network.returned !== Math.min(network.available, 16) ||
      network.omitted !== network.available - network.returned || network.truncated !== (network.omitted > 0) ||
      network.availability !== 'available' && network.available !== 0) return false;
  if (!network.interfaces.every((item, index) => object(item, ['name','rxBytes','txBytes']) && typeof item.name === 'string' &&
      item.name.length >= 1 && item.name.length <= 63 && !/\s/.test(item.name) && /^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,62}$/.test(item.name) &&
      decimal(item.rxBytes) && decimal(item.txBytes) && (index === 0 || network.interfaces[index - 1].name < item.name))) return false;
  return (sample.platform === 'linux' || [cpu,memory,load,filesystem,network].every(item => item.availability === 'unsupported')) &&
    new TextEncoder().encode(JSON.stringify(sample)).byteLength <= 8192;
}
function pointValid(point, data) {
  if (!object(point, ['sample','receivedAt','recoverySuspended','sessionCurrent','freshness','delta']) || !sampleValid(point.sample, data.nodeId) ||
      !canonicalTime(point.receivedAt) || !bool(point.recoverySuspended) || !bool(point.sessionCurrent) ||
      !object(point.delta, ['status','elapsedMs',...cpuDeltas,'exportDroppedSamples'])) return false;
  const delta = point.delta;
  if (!['baseline','continuous','gap','counter-reset','historical'].includes(delta.status) || !(delta.exportDroppedSamples === null || decimal(delta.exportDroppedSamples))) return false;
  if (!point.sessionCurrent) {
    if (point.freshness !== 'historical' || delta.status !== 'historical') return false;
  } else {
    if (!data.enabled || data.nodeRevoked || point.recoverySuspended || data.currentSession === null ||
        data.currentSession.bootId !== point.sample.bootId || data.currentSession.sessionEpoch !== point.sample.sessionEpoch || delta.status === 'historical') return false;
    const age = Date.parse(data.observedAt) - Date.parse(point.receivedAt);
    if (point.freshness !== (age >= 0 && age <= 30000 ? 'fresh' : 'stale')) return false;
  }
  if (delta.status !== 'continuous') return delta.elapsedMs === null && cpuDeltas.every(key => delta[key] === null) &&
    (!['baseline','historical'].includes(delta.status) || delta.exportDroppedSamples === null);
  if (!positive(delta.elapsedMs) || delta.exportDroppedSamples !== '0') return false;
  if (cpuDeltas.every(key => delta[key] === null)) return true;
  return cpuDeltas.every(key => decimal(delta[key])) && point.sample.host.cpu.availability === 'available' && BigInt(delta.cpuTotalTicks) > 0n &&
    BigInt(delta.cpuIdleTicks) + BigInt(delta.cpuIoWaitTicks) <= BigInt(delta.cpuTotalTicks);
}
function continuousValid(point, previous) {
  if (!previous || !previous.sessionCurrent || previous.recoverySuspended || point.sample.bootId !== previous.sample.bootId ||
      point.sample.sessionEpoch !== previous.sample.sessionEpoch || point.sample.sampleEpoch !== previous.sample.sampleEpoch ||
      point.sample.sequence - previous.sample.sequence !== 1 || point.sample.uptimeMs <= previous.sample.uptimeMs ||
      point.delta.elapsedMs !== point.sample.uptimeMs - previous.sample.uptimeMs || point.sample.droppedSamples !== previous.sample.droppedSamples ||
      Date.parse(previous.receivedAt) > Date.parse(point.receivedAt)) return false;
  const current = point.sample.host.cpu, before = previous.sample.host.cpu;
  if (current.availability !== 'available' || before.availability !== 'available' || current.logicalProcessors !== before.logicalProcessors)
    return cpuDeltas.every(key => point.delta[key] === null);
  return [['cpuTotalTicks','totalTicks'],['cpuIdleTicks','idleTicks'],['cpuIoWaitTicks','ioWaitTicks']].every(([delta, field]) =>
    point.delta[delta] !== null && BigInt(current[field]) >= BigInt(before[field]) && BigInt(point.delta[delta]) === BigInt(current[field]) - BigInt(before[field]));
}
function previousFor(latest, items) {
  for (let index = items.length - 1; index >= 0; index--) {
    const previous = items[index];
    if (previous.sample.bootId === latest.sample.bootId && previous.sample.sessionEpoch === latest.sample.sessionEpoch &&
        previous.sample.sampleEpoch === latest.sample.sampleEpoch && latest.sample.sequence - previous.sample.sequence === 1) return previous;
  }
  return null;
}
function responseValid(data, nodeId, from, to, limit) {
  if (!object(data, ['hostTelemetryVersion','nodeId','enabled','source','health','executionAuthorized','observedAt','currentSession','nodeRevoked','window','retention','latest','items']) ||
      data.hostTelemetryVersion !== 1 || data.nodeId !== nodeId || !bool(data.enabled) || data.source !== 'agent-reported' || data.health !== 'unknown' ||
      data.executionAuthorized !== false || !canonicalTime(data.observedAt) || !bool(data.nodeRevoked) ||
      !(data.currentSession === null || object(data.currentSession, ['sessionEpoch','bootId']) && positive(data.currentSession.sessionEpoch) && id(data.currentSession.bootId)) ||
      !object(data.window, ['from','to','limit','truncated']) || data.window.from !== from || data.window.to !== to || data.window.limit !== limit || !bool(data.window.truncated) ||
      !object(data.retention, ['rawSeconds','maxPointsPerNode']) || data.retention.rawSeconds !== 86400 || data.retention.maxPointsPerNode !== 8640 ||
      !Array.isArray(data.items) || data.items.length > limit || data.latest !== null && !pointValid(data.latest, data)) return false;
  const seen = new Set();
  for (let index = 0; index < data.items.length; index++) {
    const point = data.items[index];
    if (!pointValid(point, data) || Date.parse(point.receivedAt) < Date.parse(from) || Date.parse(point.receivedAt) > Date.parse(to) ||
        index > 0 && Date.parse(data.items[index - 1].receivedAt) > Date.parse(point.receivedAt)) return false;
    const key = point.sample.sampleEpoch + ':' + point.sample.sequence;
    if (seen.has(key) || point.delta.status === 'continuous' && !continuousValid(point, data.items[index - 1])) return false;
    seen.add(key);
  }
  if (data.latest?.delta.status === 'continuous') {
    const previous = previousFor(data.latest, data.items);
    if (previous !== null && !continuousValid(data.latest, previous)) return false;
  }
  return true;
}
function bytes(value) {
  if (value === null) return '不支持 / 未提供';
  const number = BigInt(value), unit = 1048576n;
  return (number / unit).toString() + '.' + ((number % unit) * 100n / unit).toString().padStart(2, '0') + ' MiB (' + value + ' B)';
}
function milli(value) {
  if (value === null) return '不支持 / 未提供';
  const number = BigInt(value);
  return (number / 1000n).toString() + '.' + (number % 1000n).toString().padStart(3, '0');
}
function cpuUsage(point) {
  const delta = point.delta;
  if (delta.status !== 'continuous' || delta.cpuTotalTicks === null) return '不可计算 · ' + delta.status;
  const total = BigInt(delta.cpuTotalTicks), busy = total - BigInt(delta.cpuIdleTicks) - BigInt(delta.cpuIoWaitTicks), hundredths = busy * 10000n / total;
  return (hundredths / 100n).toString() + '.' + (hundredths % 100n).toString().padStart(2, '0') + '%';
}
const stamp = value => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) + ' · ' + value;
const shown = value => value === null ? '不支持 / 未提供' : String(value);

export function initHostTelemetryConsole({ request, notify, byId, document = globalThis.document }) {
  const el = name => byId('host-telemetry-' + name);
  let node = null, version = 0, controller = null;
  function invalidate() { version++; controller?.abort(); controller = null; }
  function erase() { el('latest').replaceChildren(); el('rows').replaceChildren(); el('network-rows').replaceChildren(); el('meta').textContent = ''; el('network-meta').textContent = ''; }
  function reset() { invalidate(); node = null; erase(); el('title').textContent = 'Agent 可见 OS 资源'; el('state').textContent = ''; }
  function clear() { reset(); el('dialog').close(); }
  function cell(row, text) { const item = document.createElement('td'); item.textContent = text; row.append(item); }
  function card(title, value) {
    const item = document.createElement('div'), heading = document.createElement('span'), output = document.createElement('strong');
    item.className = 'metric'; heading.textContent = title; output.textContent = value; item.append(heading, output); el('latest').append(item);
  }
  function render(data) {
    el('state').textContent = (data.enabled ? 'Control 独立 Host 接收已启用，不保证 Agent 已开启' : 'Control Host 接收关闭，已有记录仅作历史观察') +
      ' · source: agent-reported · health: unknown · 无执行授权 · Node 撤销=' + data.nodeRevoked;
    el('meta').textContent = 'Node ' + node + ' · 观察 ' + stamp(data.observedAt) + '\n窗口 ' + stamp(data.window.from) + ' → ' + stamp(data.window.to) +
      ' · 返回 ' + data.items.length + '/' + data.window.limit + ' · 查询' + (data.window.truncated ? '已截断' : '未触及上限') +
      ' · 最多保留 24 小时/每 Node 8640 点，容量清理可更早删除，不保证完整覆盖。';
    const latest = data.latest;
    if (latest) {
      const host = latest.sample.host;
      card('OS CPU 连续区间（排除 idle / iowait）', cpuUsage(latest));
      card('OS 可用 / 总内存 · ' + host.memory.availability, bytes(host.memory.availableBytes) + ' / ' + bytes(host.memory.totalBytes));
      card('OS load 1 / 5 / 15 分钟 · ' + host.load.availability, milli(host.load.oneMilli) + ' / ' + milli(host.load.fiveMilli) + ' / ' + milli(host.load.fifteenMilli));
      card('Agent 根文件系统可用 / 总量 · ' + host.filesystem.availability, bytes(host.filesystem.availableBytes) + ' / ' + bytes(host.filesystem.totalBytes));
      const note = document.createElement('p'); note.className = 'hint';
      note.textContent = 'agent-visible-os · ' + latest.sample.platform + ' · ' + latest.freshness + ' / ' + (latest.sessionCurrent ? '记录匹配当前会话' : '历史会话') +
        ' · CPU 源 ' + host.cpu.availability + ' / logicalProcessors=' + shown(host.cpu.logicalProcessors) + '\n采集 ' + stamp(latest.sample.capturedAt) +
        ' · 接收 ' + stamp(latest.receivedAt) + ' · 不是进程 CPU 或已验证的物理宿主容量。' +
        (latest.delta.status === 'continuous' && previousFor(latest, data.items) === null ? ' 服务端连续区间的前置样本不在当前窗口，页面未独立复核差值。' : '');
      el('latest').append(note);
      const network = host.network;
      el('network-meta').textContent = '最近样本 · agent-network-namespace / ' + network.availability + ' · 显示 ' + network.returned + '/' + network.available +
        ' 个接口，上限 ' + network.limit + ' / omitted=' + network.omitted + ' / truncated=' + network.truncated + '；只显示累计字节，不按接口名推导吞吐。';
      for (const item of network.interfaces) { const row = document.createElement('tr'); cell(row, item.name); cell(row, item.rxBytes + ' B'); cell(row, item.txBytes + ' B'); el('network-rows').append(row); }
      if (!network.interfaces.length) { const row = document.createElement('tr'); cell(row, '无可用接口记录；不是零流量。'); row.firstChild.colSpan = 3; el('network-rows').append(row); }
    }
    for (const point of data.items) {
      const sample = point.sample, host = sample.host, delta = point.delta, row = document.createElement('tr');
      cell(row, '采集 ' + stamp(sample.capturedAt) + '\n接收 ' + stamp(point.receivedAt));
      cell(row, point.freshness + ' / ' + (point.sessionCurrent ? '当前机器会话' : '历史或隔离会话') + '\n恢复挂起 ' + point.recoverySuspended + '\nBoot ' + sample.bootId +
        ' / Session ' + sample.sessionEpoch + '\nExporter ' + sample.sampleEpoch + ' / seq ' + sample.sequence + '\nuptime ' + sample.uptimeMs + ' ms / ' + sample.platform);
      cell(row, host.cpu.availability + ' / CPU数 ' + shown(host.cpu.logicalProcessors) + '\n' + cpuUsage(point) + ' / ' + delta.status + '\n累计 total/idle/iowait ticks ' +
        shown(host.cpu.totalTicks) + '/' + shown(host.cpu.idleTicks) + '/' + shown(host.cpu.ioWaitTicks) + '\n区间 ' + shown(delta.elapsedMs) + ' ms / ticks ' +
        shown(delta.cpuTotalTicks) + '/' + shown(delta.cpuIdleTicks) + '/' + shown(delta.cpuIoWaitTicks) + '\n导出丢弃累计 ' + sample.droppedSamples + ' / 区间 ' + shown(delta.exportDroppedSamples));
      cell(row, 'OS 内存 ' + host.memory.availability + '\n可用 ' + bytes(host.memory.availableBytes) + '\n总量 ' + bytes(host.memory.totalBytes) +
        '\n根文件系统 ' + host.filesystem.availability + '\n可用 ' + bytes(host.filesystem.availableBytes) + '\n总量 ' + bytes(host.filesystem.totalBytes));
      cell(row, host.load.availability + '\n1m ' + milli(host.load.oneMilli) + '\n5m ' + milli(host.load.fiveMilli) + '\n15m ' + milli(host.load.fifteenMilli) + '\n不是 CPU 百分比');
      cell(row, 'agent-network-namespace / ' + host.network.availability + '\n接口 ' + host.network.returned + '/' + host.network.available + ' / omitted ' + host.network.omitted +
        ' / truncated=' + host.network.truncated + (host.network.interfaces.length ? '\n' + host.network.interfaces.map(item => item.name + ': RX ' + item.rxBytes + ' B / TX ' + item.txBytes + ' B').join('\n') : '\n缺测，不是零'));
      el('rows').append(row);
    }
    if (!data.items.length) { const row = document.createElement('tr'); cell(row, '所选窗口无可见 Host 样本；可能未开启、尚未上报或已清理，不等于资源为零。'); row.firstChild.colSpan = 6; el('rows').append(row); }
  }
  async function reload() {
    if (!node) return;
    invalidate(); erase();
    const currentVersion = version, requestedNode = node, read = new AbortController(); controller = read;
    const timer = setTimeout(() => read.abort(), 5000);
    el('state').textContent = '正在读取有界 OS 资源观察；最多等待 5 秒，不自动重试。';
    try {
      const duration = Number(el('range').value), limit = Number(el('limit').value);
      if (![900000,3600000,86400000].includes(duration) || ![128,256,512].includes(limit)) throw Error('Host 指标查询范围无效');
      const now = Date.now(), from = new Date(now - duration).toISOString(), to = new Date(now).toISOString();
      const resource = 'nodes/' + encodeURIComponent(requestedNode) + '/host-telemetry?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to) + '&limit=' + limit;
      const data = await request('GET', resource, undefined, undefined, { signal: read.signal, timeoutMs: 5000 });
      if (currentVersion !== version || node !== requestedNode || read.signal.aborted) return;
      if (!responseValid(data, requestedNode, from, to, limit)) throw Error('Host 指标响应格式、身份或连续性无效；旧输出已清除');
      render(data);
    } catch (error) {
      if (currentVersion === version) { erase(); el('state').textContent = 'Host 观察不可用；不推导资源为零、健康或容量。'; notify(read.signal.aborted ? 'Host 指标请求已超时或取消' : error.message, true); }
    } finally { clearTimeout(timer); if (controller === read) controller = null; }
  }
  function open(nodeId) {
    invalidate(); erase();
    if (!id(nodeId)) throw Error('Node ID 无效');
    node = nodeId; el('title').textContent = 'Agent 可见 OS 资源 · ' + nodeId;
    if (!el('dialog').open) el('dialog').showModal();
    return reload();
  }
  el('reload').addEventListener('click', reload); el('close').addEventListener('click', clear);
  el('dialog').addEventListener('close', () => { if (!el('dialog').open) reset(); });
  for (const name of ['range','limit']) el(name).addEventListener('change', () => { invalidate(); erase(); el('state').textContent = '范围已改变，请手动读取；旧输出已清除。'; });
  return { open, clear };
}
