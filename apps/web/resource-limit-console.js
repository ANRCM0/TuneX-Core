const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const closed = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const canonicalTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && Date.parse(value) >= 0 && new Date(value).toISOString() === value;
const decimal = value => typeof value === 'string' && /^(0|[1-9][0-9]{0,15})$/.test(value) && BigInt(value) <= 9007199254740991n;

function consumptionView(value, policy, revision) {
  if (closed(value,['status','source','usedBytes','remainingBytes']) && value.status === 'unavailable' &&
      value.source === 'agent-protected-journal' && value.usedBytes === null && value.remainingBytes === null) return;
  if (!policy || !closed(value,['status','source','accounting','usedBytes','remainingBytes','remainingMeaning','receivedAt',
      'policyRevision','sessionEpoch','reportSequence','periodStatus']) ||
      !['unknown','stale','policy-outdated','fresh'].includes(value.status) || value.source !== 'agent-protected-journal' ||
      value.accounting !== 'conservative-precharge' || value.remainingMeaning !== 'upper-bound-at-sample' ||
      !['future','active','ended'].includes(value.periodStatus)) throw Error('额度用量来源或格式无效。');
  if (value.status === 'unknown') {
    if (['usedBytes','remainingBytes','receivedAt','policyRevision','sessionEpoch','reportSequence'].some(key => value[key] !== null))
      throw Error('未知用量不得显示余额。');
    return;
  }
  if (!decimal(value.usedBytes) || !canonicalTime(value.receivedAt) || !count(value.policyRevision) || value.policyRevision < 1 ||
      value.policyRevision > revision || !count(value.sessionEpoch) || value.sessionEpoch < 1 ||
      !count(value.reportSequence) || value.reportSequence < 1 ||
      (value.status === 'policy-outdated') !== (value.policyRevision < revision)) throw Error('额度用量修订或报告无效。');
  const expected = policy.byteLimit === null ? null : (BigInt(policy.byteLimit) > BigInt(value.usedBytes) ?
    BigInt(policy.byteLimit) - BigInt(value.usedBytes) : 0n).toString();
  if (value.remainingBytes !== (value.status === 'fresh' ? expected : null)) throw Error('额度用量余额口径无效。');
}

export function payloadLimitView(value, identity) {
  if (!(closed(value, ['nodeId','scopeId','actorId','revision','policy','consumption']) ||
        closed(value, ['nodeId','scopeId','actorId','revision','policy','consumption','activePeriod'])) ||
      !['nodeId','scopeId','actorId'].every(key => id(identity?.[key]) && value[key] === identity[key]) || !count(value.revision))
    throw Error('共享带宽与流量配置响应无效，请重新读取。');
  const policy = value.policy;
  if (policy === null) {
    if (value.revision !== 0) throw Error('未配置额度的修订不一致。');
  } else if (!closed(policy, ['bucketId','startsAt','endsAt','bytesPerSecond','burstBytes','byteLimit']) || !id(policy.bucketId) ||
      value.revision < 1 || !canonicalTime(policy.startsAt) || !canonicalTime(policy.endsAt) || policy.startsAt >= policy.endsAt ||
      ![policy.bytesPerSecond,policy.byteLimit].every(limit => limit === null || count(limit)) ||
      policy.bytesPerSecond === null && policy.byteLimit === null ||
      !Number.isSafeInteger(policy.burstBytes) || policy.burstBytes < 1 || policy.burstBytes > 65536)
    throw Error('共享带宽与流量周期或限制无效。');
  consumptionView(value.consumption,policy,value.revision);
  if (value.activePeriod !== undefined && value.activePeriod !== null) {
    if (!closed(value.activePeriod,['revision','policy','consumption']) || value.activePeriod.revision > value.revision)
      throw Error('当前周期响应无效。');
    payloadLimitView({nodeId:value.nodeId,scopeId:value.scopeId,actorId:value.actorId,...value.activePeriod},identity);
    if (value.activePeriod.consumption.periodStatus !== 'active') throw Error('当前周期报告无效。');
  }
  return { ...value, policy:policy && { ...policy }, consumption:{ ...value.consumption } };
}

export function payloadLimitInput(fields, expectedRevision) {
  const optional = (value, label) => {
    const raw = String(value).trim();
    if (raw === '') return null;
    if (!/^(0|[1-9][0-9]*)$/.test(raw) || !count(Number(raw))) throw Error(label + '须为空白或非负安全整数。');
    return Number(raw);
  };
  const startsAt = String(fields.startsAt).trim(), endsAt = String(fields.endsAt).trim();
  const bytesPerSecond = optional(fields.bytesPerSecond, '每秒字节数'), byteLimit = optional(fields.byteLimit, '周期流量');
  const burstBytes = optional(fields.burstBytes, '突发字节数');
  if (!count(expectedRevision) || expectedRevision >= Number.MAX_SAFE_INTEGER ||
      !canonicalTime(startsAt) || !canonicalTime(endsAt) || startsAt >= endsAt)
    throw Error('请先读取修订，并填写递增的 UTC 毫秒周期，例如 2026-11-01T00:00:00.000Z。');
  if (bytesPerSecond === null && byteLimit === null) throw Error('至少填写带宽或周期流量限制；0 表示禁止。');
  if (burstBytes === null || burstBytes < 1 || burstBytes > 65536) throw Error('突发字节数须为 1 至 65536。');
  return { expectedRevision,startsAt,endsAt,bytesPerSecond,burstBytes,byteLimit };
}

export function personalPayloadLimitView(value, identity) {
  const view = payloadLimitView(value, identity), policy = view.policy, usage = view.consumption;
  const status = {unavailable:'用量暂不可用：当前服务未提供用量视图',unknown:'此政策尚无报告；可能为旧 Agent 或尚未接收政策',
    stale:'报告已过期或会话已更换，余额未知','policy-outdated':'报告对应旧政策修订，余额未知',fresh:'已收到近期用量样本'}[usage.status];
  return {
    '机器':view.nodeId,'成员':view.actorId,'配置修订':view.revision,
    '每秒双向有效载荷上限':policy ? policy.bytesPerSecond === null ? '未额外限速' : policy.bytesPerSecond + ' B/s' : '未配置额外限制',
    '周期流量上限':policy ? policy.byteLimit === null ? '未额外限制' : policy.byteLimit + ' B' : '未配置额外限制',
    '突发上限':policy ? policy.burstBytes + ' B' : '不适用',
    '配置周期':policy ? policy.startsAt + ' 至 ' + policy.endsAt : '未配置',
    '当前周期':view.activePeriod ? view.activePeriod.policy.startsAt + ' 至 ' + view.activePeriod.policy.endsAt :
      view.activePeriod === null ? '当前没有配置中的有效周期' : '旧服务未提供当前周期',
    '当前周期已预扣':view.activePeriod?.consumption.usedBytes === undefined || view.activePeriod?.consumption.usedBytes === null ? '未知' : view.activePeriod.consumption.usedBytes + ' B',
    '当前周期样本剩余':view.activePeriod?.consumption.remainingBytes === undefined || view.activePeriod?.consumption.remainingBytes === null ? '未知或未额外设流量上限' :
      view.activePeriod.consumption.remainingBytes + ' B；当前可用量可能更少',
    '消费量与剩余量':status,
    '已持久预扣':usage.usedBytes === null ? '未知' : usage.usedBytes + ' B',
    '样本时剩余额度':usage.remainingBytes === null ? '未知或未额外设流量上限' : usage.remainingBytes + ' B；当前可用量可能更少',
    '报告接收时间':usage.receivedAt ?? '未知',
    '周期状态':{future:'尚未开始',active:'当前周期',ended:'已经结束'}[usage.periodStatus] ?? '未提供',
    '消费口径':'原 Journal 的双向有效载荷保守预扣，失败写入也可能已经预扣；不是精确送达量，样本余额不构成执行许可。',
    '计量方式':'按当前成员在此共享机器上经过的双向有效载荷汇总，包含多条转发；私有机器不扣此额度。',
    '生效说明':'此处显示最新配置，可能是下一周期；实际执行仍须符合用途授权、原租约及周期条件。',
  };
}

export function initResourceLimitConsole({ request, byId, notify, canGovern, identity,
  confirm = globalThis.confirm, randomUUID = () => crypto.randomUUID() }) {
  const el = name => byId('payload-' + name);
  const fields = ['node','actor','starts','ends','rate','burst','bytes'];
  let epoch = 0, reading = 0, loaded = null, pending = null, sending = false;
  const controllers = new Set();
  const state = value => { el('state').textContent = value; };
  const subject = () => ({ ...identity(),nodeId:el('node').value.trim(),actorId:el('actor').value.trim() });
  const same = (left, right) => left && right && ['scopeId','nodeId','actorId'].every(key => left[key] === right[key]);
  const path = value => 'nodes/' + encodeURIComponent(value.nodeId) + '/payload-limits/' + encodeURIComponent(value.actorId);
  function controls() {
    const locked = sending || Boolean(pending);
    for (const field of fields) el(field).disabled = locked;
    el('read').disabled = locked;
    el('save').disabled = locked || !loaded || !same(subject(), loaded);
    el('replay').disabled = sending || !pending;
    el('discard').disabled = sending || !pending;
  }
  function authorize() {
    if (!canGovern()) throw Error('当前工作空间所有者才能设置共享机器额度。');
    const value = subject();
    if (!['scopeId','nodeId','actorId'].every(key => id(value[key]))) throw Error('请填写共享节点和成员标识。');
    return value;
  }
  async function call(method, resource, body, key) {
    const controller = new AbortController();controllers.add(controller);
    try { return await request(method, resource, body, key, { signal:controller.signal,timeoutMs:15000 }); }
    finally { controllers.delete(controller); }
  }
  function render(view) {
    el('revision').value = String(view.revision);
    for (const [field, key] of [['starts','startsAt'],['ends','endsAt'],['rate','bytesPerSecond'],['burst','burstBytes'],['bytes','byteLimit']])
      el(field).value = String(view.policy?.[key] ?? (field === 'burst' ? 65536 : ''));
    el('result').textContent = JSON.stringify(personalPayloadLimitView(view,view),null,2);
  }
  async function read() {
    const token = epoch, version = ++reading, value = authorize();
    loaded = null;el('revision').value = '';el('result').textContent = '';controls();state('正在读取此成员的共享额度……');
    const result = await call('GET',path(value));
    if (token !== epoch || version !== reading || !same(subject(),value)) return;
    const view = payloadLimitView(result,value);loaded = { ...value,revision:view.revision };render(view);controls();
    state('已读取最新配置。相同周期更新保留已扣额度；新周期须与历史周期不重叠。');
  }
  async function submit() {
    if (sending || !pending) return;
    const value = authorize(), command = pending, token = epoch;
    if (!same(value,command.identity)) throw Error('连接或资源已变化，请重新读取。');
    sending = true;controls();state('正在提交；结果未知时仅能重放原命令。');
    try {
      const result = await call('PUT',path(command.identity),command.body,command.key);
      if (token !== epoch) return;
      const view = payloadLimitView(result,command.identity);
      if (view.revision !== command.body.expectedRevision + 1) throw Error('额度命令回执修订不一致，请核对原命令。');
      pending = null;loaded = { ...command.identity,revision:view.revision };render(view);
      state('已保存配置。执行生效取决于原 Snapshot 发布和 Agent 接收；请重新读取获取最新用量样本。');
    } catch (error) {
      if (token === epoch) {
        state('提交结果尚未确认，保留原内容与命令标识；核对后可重放同一命令。');notify(error.message,true);
      }
    } finally {
      if (token === epoch) { sending = false;controls(); }
    }
  }
  async function save() {
    if (pending || sending) return;
    const value = authorize();
    if (!loaded || !same(value,loaded)) throw Error('请先读取此机器、此成员的当前修订。');
    const body = payloadLimitInput({startsAt:el('starts').value,endsAt:el('ends').value,
      bytesPerSecond:el('rate').value,burstBytes:el('burst').value,byteLimit:el('bytes').value},loaded.revision);
    if (!confirm('保存此成员在共享机器上的双向带宽与流量限制？收紧后可能停止相关转发。')) return;
    pending = { identity:{...value},body:Object.freeze(body),key:randomUUID() };controls();await submit();
  }
  for (const [name, run] of [['read',read],['save',save],['replay',submit]])
    el(name).addEventListener('click',() => Promise.resolve().then(run).catch(error => notify(error.message,true)));
  el('discard').addEventListener('click',() => {
    if (sending || !pending || !confirm('本地丢弃不会撤销已经到达服务端的配置。已核对结果并准备重新读取？')) return;
    pending = null;loaded = null;el('revision').value = '';state('请重新读取实际配置后再编辑。');controls();
  });
  for (const name of ['node','actor']) el(name).addEventListener('input',() => {
    loaded = null;reading++;el('revision').value = '';el('result').textContent = '';controls();
  });
  controls();
  return { clear() {
    epoch++;reading++;for (const controller of controllers) controller.abort();controllers.clear();
    pending = null;loaded = null;sending = false;
    for (const name of fields) el(name).value = name === 'burst' ? '65536' : '';
    el('revision').value = '';el('result').textContent = '';state('');controls();
  } };
}
