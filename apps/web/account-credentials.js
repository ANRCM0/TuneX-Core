const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const tokenValid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value);
const closed = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');

export function accountCredentialView(value, actorId, rotation = false) {
  const keys = ['credentialVersion', 'actorId', 'kind', 'scope', 'history', 'agentCredentialsChanged', ...(rotation ? ['changed'] : [])];
  if (!id(actorId) || !closed(value, keys) || value.credentialVersion !== 1 || value.actorId !== actorId ||
      value.kind !== 'bearer' || value.scope !== 'account-global' || value.agentCredentialsChanged !== false ||
      rotation && typeof value.changed !== 'boolean' ||
      !closed(value.history, ['source', 'retained', 'limit', 'lastSelfRotatedAt']) ||
      value.history.source !== 'self-service-rotation' || value.history.limit !== 1024 ||
      !Number.isSafeInteger(value.history.retained) || value.history.retained < 0 || value.history.retained > 1024 ||
      (value.history.retained === 0) !== (value.history.lastSelfRotatedAt === null) ||
      value.history.lastSelfRotatedAt !== null && (!Number.isSafeInteger(value.history.lastSelfRotatedAt) || value.history.lastSelfRotatedAt < 0 || value.history.lastSelfRotatedAt > 253402300799999))
    throw Error('账号凭据响应无效，不能据此确认新 Token 已生效。');
  return { ...value, history: { ...value.history } };
}

export async function requestAccountCredentials(token, input, { signal, send = globalThis.fetch } = {}) {
  if (!tokenValid(token)) throw Error('当前账号 Token 不可用，请重新登录。');
  const response = await send('/api/v1/me/credentials', {
    method: input === undefined ? 'GET' : 'PUT', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', ...(input === undefined ? {} : { 'Content-Type': 'application/json' }) },
    signal: AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])]),
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  let value;
  try { value = await response.json(); } catch { throw Error('账号凭据响应无法读取，变更结果仍需核对。'); }
  if (!response.ok) {
    const error = Error(String(value.code ?? 'HTTP_' + response.status) + '：' + String(value.message ?? '账号凭据请求未完成'));
    error.httpStatus = response.status; throw error;
  }
  return value;
}

export function initAccountCredentials({ byId, notify, getIdentity, onRotated,
  request = requestAccountCredentials, confirm = message => globalThis.confirm(message),
  randomToken = () => {
    const bytes = new Uint8Array(32); globalThis.crypto.getRandomValues(bytes);
    return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  } }) {
  const el = name => byId('credential-' + name);
  let epoch = 0, reading = false, readVersion = 0, controller = null, pending = null, sending = false;
  const state = value => { el('state').textContent = value; };
  function controls() {
    const identity = getIdentity(), authenticated = id(identity?.actorId) && tokenValid(identity?.token), locked = sending || pending !== null;
    for (const name of ['next', 'generate', 'reveal', 'saved', 'rotate']) el(name).disabled = !authenticated || locked;
    el('read').disabled = !authenticated || locked || reading;
    el('verify-new').disabled = sending || pending === null;
    el('replay-old').disabled = sending || pending === null;
    el('abandon').disabled = sending || pending === null;
  }
  function show(value) {
    const summary = value.history.lastSelfRotatedAt === null ? '暂无本人轮换记录' : new Date(value.history.lastSelfRotatedAt).toISOString();
    el('metadata').textContent = '账号：' + value.actorId + '；凭据作用于该账号的全部工作空间。上次本人轮换：' + summary +
      '；保留记录 ' + value.history.retained + ' / ' + value.history.limit + '。不包含运维恢复换发，也不修改 Agent 证书。';
  }
  async function read() {
    if (pending || sending || reading) return;
    const version = ++readVersion, token = epoch, identity = getIdentity();
    reading = true; controller?.abort(); controller = new AbortController(); controls();
    try {
      const value = await request(identity?.token, undefined, { signal: controller.signal });
      if (token !== epoch || version !== readVersion) return;
      show(accountCredentialView(value, identity.actorId)); state('已读取账号本人的凭据信息。');
    } catch (error) { if (token === epoch && version === readVersion) { state('账号凭据信息读取失败。'); notify(error.message, true); } }
    finally { if (token === epoch && version === readVersion) { reading = false; controls(); } }
  }
  async function send(useNew = false, first = false) {
    if (!pending || sending) return;
    const command = pending, token = epoch;
    if (getIdentity()?.actorId !== command.actorId) return;
    if (!first && !confirm(useNew ? '用已保存的新 Token 核对同一变更？成功只证明它目前有效，不会再产生一次相同轮换。' :
      '用原 Token 显式重放同一变更？如果已经失效会拒绝，拒绝不能证明先前没有提交。')) return;
    sending = true; controls(); state(useNew ? '正在用新 Token 核对原变更……' : '正在提交账号本人凭据变更……');
    try {
      const result = await request(useNew ? command.newToken : command.oldToken, { credentialVersion: 1, newToken: command.newToken });
      if (token !== epoch || pending !== command) return;
      const value = accountCredentialView(result, command.actorId, true);
      const next = command.newToken; pending = null; sending = false; el('next').value = ''; el('saved').checked = false;
      show(value); state('新 Token 已确认有效，旧 Token 已不能用于后续登录；请更新其他使用此账号的客户端。');
      try { await onRotated(next, command.actorId); }
      catch { notify('新 Token 已确认，但页面上下文刷新未完成；请用已保存的新 Token 重新登录。', true); }
      if (getIdentity()?.actorId === command.actorId) { show(value); state('新 Token 已确认有效。请保留安全副本并更新其他客户端；原 Agent 身份不变。'); controls(); }
    } catch (error) {
      if (token !== epoch) return;
      sending = false;
      if (first && [400, 403, 409, 413, 422, 429].includes(error.httpStatus)) pending = null;
      state(pending ? '结果未确认。保留已保存的原／新 Token，只能显式核对同一变更；不要生成另一条轮换。' : '本次变更被明确拒绝，原凭据状态请重新读取核对。');
      controls(); notify(error.message, true);
    }
  }
  async function rotate() {
    if (pending || sending || reading) return;
    const identity = getIdentity(), next = el('next').value;
    if (!id(identity?.actorId) || !tokenValid(identity?.token) || !tokenValid(next) || next === identity.token || !el('saved').checked)
      return notify('准备与当前不同的新 Token，并确认已安全保存后再轮换。', true);
    if (!confirm('确认轮换本人账号的全局 Token？这会影响此账号的全部工作空间登录，并清除当前页其他本地操作上下文；不会取消远端任务或修改 Agent 凭据。')) return;
    readVersion++; controller?.abort(); reading = false;
    pending = { actorId: identity.actorId, oldToken: identity.token, newToken: next };
    el('next').value = ''; el('saved').checked = false; await send(false, true);
  }
  function leave() {
    readVersion++; controller?.abort(); reading = false;
    el('next').value = ''; el('next').type = 'password'; el('saved').checked = false; el('reveal').textContent = '显示新 Token'; controls();
  }
  function clear() {
    epoch++; pending = null; sending = false; leave(); el('metadata').textContent = ''; state('');
  }
  el('read').addEventListener('click', read);
  el('rotate').addEventListener('click', rotate);
  el('generate').addEventListener('click', () => { if (!el('generate').disabled) { el('next').value = randomToken(); el('saved').checked = false; } });
  el('reveal').addEventListener('click', () => {
    if (el('reveal').disabled) return;
    el('next').type = el('next').type === 'password' ? 'text' : 'password';
    el('reveal').textContent = el('next').type === 'password' ? '显示新 Token' : '隐藏新 Token';
  });
  el('verify-new').addEventListener('click', () => send(true));
  el('replay-old').addEventListener('click', () => send(false));
  el('abandon').addEventListener('click', () => {
    if (!pending || sending || !confirm('只清除本地轮换记忆？远端可能已变更，请保留两个已保存的 Token 并核对登录结果。')) return;
    clear(); state('已清除本地记忆；远端变更未被取消，请核对已保存的凭据。');
  });
  el('panel').addEventListener('toggle', () => { if (!el('panel').open) leave(); });
  controls(); return { read, rotate, leave, clear };
}
