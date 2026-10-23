const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const roles = Object.freeze({ owner: '工作空间所有者', manager: '成员管理者', viewer: '只读成员', removed: '已移除' });
const clone = value => JSON.parse(JSON.stringify(value));

export function memberListView(value) {
  if (!value || !Array.isArray(value.members) || value.members.length > 10000 ||
      new Set(value.members.map(member => member?.actorId)).size !== value.members.length ||
      value.members.some(member => !member || !id(member.actorId) || !positive(member.revision) ||
        typeof member.active !== 'boolean' || !Object.hasOwn(roles, member.role) || member.active !== (member.role !== 'removed')))
    throw Error('成员列表响应无效或超过本页可处理范围，请联系管理员核对。');
  return value.members.map(member => ({ actorId: member.actorId, revision: member.revision, role: member.role, active: member.active }));
}

export function memberCommand(input, members) {
  const subject = input.actorId?.trim();
  if (!id(subject) || !['manager', 'viewer', 'removed'].includes(input.role) || !['existing', 'new'].includes(input.accountMode))
    throw Error('填写有效账号标识、成员角色和账号来源。');
  const current = members.find(member => member.actorId === subject);
  if (current?.role === 'owner') throw Error('所有者由原系统保护，不能在成员页修改或移除。');
  if (!current && input.role === 'removed') throw Error('先读取已有成员，再准备移除。');
  if (current && input.accountMode === 'new') throw Error('已有成员不能重新设置初始账号 Token。');
  const body = { expectedRevision: current?.revision ?? 0, role: input.role };
  if (input.accountMode === 'new') {
    if (input.role === 'removed' || !/^[A-Za-z0-9_-]{32,128}$/.test(input.token ?? '') || input.tokenSaved !== true)
      throw Error('新账号需要有效初始 Token，并确认已在安全位置保存。');
    body.token = input.token;
  }
  return { actorId: subject, method: 'PUT', path: 'members/' + encodeURIComponent(subject), body };
}

export function memberReceipt(command, value) {
  if (!value || value.actorId !== command.actorId ||
      ![command.body.expectedRevision, command.body.expectedRevision + 1].includes(value.revision) || !positive(value.revision) ||
      value.role !== command.body.role || value.active !== (command.body.role !== 'removed') ||
      !Array.isArray(value.operationIds) || !value.operationIds.every(id) ||
      value.latestAuthorizationUntil !== null && (typeof value.latestAuthorizationUntil !== 'string' || !Number.isFinite(Date.parse(value.latestAuthorizationUntil))))
    throw Error('成员命令回执不完整，结果仍需按原命令核对。');
  return { actorId: value.actorId, revision: value.revision, role: value.role, active: value.active,
    operationIds: [...value.operationIds], latestAuthorizationUntil: value.latestAuthorizationUntil };
}

export function initMemberConsole({ request, notify, byId, canGovern,
  confirm = message => globalThis.confirm(message), randomUUID = () => globalThis.crypto.randomUUID(),
  randomToken = () => {
    const bytes = new Uint8Array(32); globalThis.crypto.getRandomValues(bytes);
    return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  } }) {
  const el = suffix => byId('member-' + suffix);
  let epoch = 0, reading = false, readVersion = 0, controller = null;
  let members = [], loaded = false, pending = null, sending = false, page = 1;
  const pageSize = 25;
  const text = (tag, value) => { const node = document.createElement(tag); if (value !== undefined) node.textContent = String(value); return node; };
  const state = value => { el('state').textContent = value; };
  function authorize() { if (!canGovern()) throw Error('仅当前工作空间所有者可管理成员，服务端仍会再次核验。'); }
  function controls() {
    const locked = sending || pending !== null;
    const current = members.find(member => member.actorId === el('actor').value.trim());
    el('refresh').disabled = locked || reading;
    el('save').disabled = locked || !loaded || reading;
    el('actor').disabled = locked;
    el('role').disabled = locked || current?.role === 'owner';
    el('account-mode').disabled = locked || current !== undefined;
    const newAccount = el('account-mode').value === 'new' && current === undefined;
    for (const name of ['token', 'generate', 'token-saved', 'reveal']) el(name).disabled = locked || !newAccount;
    el('token-panel').hidden = !newAccount;
    el('replay').disabled = sending || pending === null;
    el('abandon').disabled = sending || pending === null;
    el('prev').disabled = locked || reading || !loaded || page <= 1;
    el('next').disabled = locked || reading || !loaded || page * pageSize >= members.length;
    el('page').textContent = loaded ? '第 ' + page + ' / ' + Math.max(1, Math.ceil(members.length / pageSize)) + ' 页（已载入成员的本地分页）' : '尚未读取';
    el('revision').textContent = current ? '已读取成员修订 r' + current.revision : loaded ? '当前成员列表中无此账号，将使用初始成员修订 0。' : '先读取当前工作空间成员。';
    el('summary').textContent = loaded ? '已载入 ' + members.length + ' 个成员；修改权限不会自动授予共享机器用途。' : '尚未读取成员；不会自动加载或推测账号是否存在。';
  }
  function render() {
    const rows = el('rows'); rows.replaceChildren();
    for (const member of members.slice((page - 1) * pageSize, page * pageSize)) {
      const row = text('tr');
      for (const value of [member.actorId, roles[member.role], 'r' + member.revision]) row.append(text('td', value));
      const cell = text('td');
      if (member.role === 'owner') cell.append(text('span', '所有者受保护'));
      else {
        const button = text('button', '编辑成员'); button.type = 'button'; button.className = 'secondary';
        button.disabled = sending || pending !== null;
        button.addEventListener('click', () => {
          if (sending || pending) return;
          el('actor').value = member.actorId; el('role').value = member.role === 'removed' ? 'viewer' : member.role;
          el('account-mode').value = 'existing'; el('token').value = ''; el('token-saved').checked = false;
          controls(); el('form').scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
        cell.append(button);
      }
      row.append(cell); rows.append(row);
    }
    if (!members.length) { const row = text('tr'), cell = text('td', '没有可展示的成员记录。'); cell.colSpan = 4; row.append(cell); rows.append(row); }
  }
  async function read() {
    if (pending || sending || reading) return;
    const token = epoch, version = ++readVersion;
    controller?.abort(); controller = new AbortController(); loaded = false; reading = true; controls();
    try {
      authorize(); state('正在读取原工作空间成员……');
      const result = await request('GET', 'members', undefined, undefined, { signal: controller.signal, timeoutMs: 10000 });
      if (token !== epoch || version !== readVersion) return;
      members = memberListView(result); loaded = true; page = 1; state('已读取成员。请选择已有成员，或明确加入已有账号／创建新账号。'); render();
    } catch (error) {
      if (token === epoch && version === readVersion) { members = []; render(); state('成员读取失败，没有准备写命令。'); notify(error.message, true); }
    } finally { if (token === epoch && version === readVersion) { reading = false; controls(); } }
  }
  async function send(replay = false) {
    if (!pending || sending) return;
    const command = pending, token = epoch;
    try {
      authorize();
      if (replay && !confirm('仅重放原成员命令、原修订和原请求键？当前拒绝不能证明原提交没有发生。')) return;
      sending = true; controls(); render(); state('正在提交原成员命令……');
      const value = await request(command.method, command.path, clone(command.body), command.key, { timeoutMs: 10000 });
      if (token !== epoch || pending !== command) return;
      const receipt = memberReceipt(command, value);
      el('receipt').textContent = JSON.stringify(receipt, null, 2);
      pending = null; loaded = false; sending = false; el('token').value = ''; el('token-saved').checked = false;
      state('成员命令已接收。撤权或降级可能仍需原 Operation／租约收敛；继续操作前重新读取成员。'); controls(); render();
    } catch (error) {
      if (token !== epoch) return;
      sending = false;
      if (!replay && [400, 401, 403, 404, 409, 413, 422, 429].includes(error.httpStatus)) { pending = null; loaded = false; }
      state(pending ? '结果不确定：只允许原键、原内容重放。初始 Token 仅留在当前标签页待处理命令中。' : '命令被明确拒绝，请重新读取成员。');
      controls(); render(); notify(error.message, true);
    }
  }
  async function save() {
    if (!loaded || reading || pending || sending) return;
    try {
      authorize();
      const command = memberCommand({ actorId: el('actor').value, role: el('role').value, accountMode: el('account-mode').value,
        token: el('token').value, tokenSaved: el('token-saved').checked }, members);
      if (!confirm('确认变更 ' + command.actorId + ' 的工作空间成员角色？成员管理者可自助管理资源，但不取得其他用户的私有资源。撤权按原执行期限收敛。')) return;
      pending = { ...command, body: clone(command.body), key: randomUUID() };
      el('token').value = ''; el('token-saved').checked = false;
      await send();
    } catch (error) { notify(error.message, true); }
  }
  function leave() {
    readVersion++; controller?.abort(); reading = false;
    el('token').value = ''; el('token').type = 'password'; el('reveal').textContent = '显示初始 Token'; el('token-saved').checked = false;
    controls();
  }
  function clear() {
    epoch++; readVersion++; controller?.abort(); members = []; loaded = false; pending = null; sending = false; reading = false; page = 1;
    el('form').reset(); el('token').value = ''; el('token').type = 'password'; el('reveal').textContent = '显示初始 Token';
    el('receipt').textContent = ''; state(''); render(); controls();
  }
  el('refresh').addEventListener('click', read);
  for (const [name, direction] of [['prev', -1], ['next', 1]]) el(name).addEventListener('click', () => {
    if (pending || sending || reading || !loaded) return;
    page = Math.max(1, Math.min(Math.max(1, Math.ceil(members.length / pageSize)), page + direction)); render(); controls();
  });
  el('form').addEventListener('submit', event => { event.preventDefault(); save(); });
  for (const name of ['actor', 'role', 'account-mode']) el(name).addEventListener('change', () => {
    if (pending || sending) return;
    if (members.some(member => member.actorId === el('actor').value.trim())) el('account-mode').value = 'existing';
    el('token').value = ''; el('token-saved').checked = false; controls();
  });
  el('generate').addEventListener('click', () => { if (!el('generate').disabled) { el('token').value = randomToken(); el('token-saved').checked = false; } });
  el('reveal').addEventListener('click', () => {
    if (el('reveal').disabled) return;
    el('token').type = el('token').type === 'password' ? 'text' : 'password';
    el('reveal').textContent = el('token').type === 'password' ? '显示初始 Token' : '隐藏初始 Token';
  });
  el('replay').addEventListener('click', () => send(true));
  el('abandon').addEventListener('click', () => {
    if (!pending || sending || !confirm('仅清除当前页记忆？这不会取消原成员变更。请先核对远端结果，再准备另一条命令。')) return;
    pending = null; loaded = false; leave(); state('已清除本地待处理信息；原变更是否提交仍需重新读取核对。'); render(); controls();
  });
  controls();
  return { read, leave, clear };
}
