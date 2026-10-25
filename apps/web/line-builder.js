import { roleAllowed } from './account-context.js';
import { initForwardCanvas } from './forward-canvas.js';

export function initLineBuilder({ request, byId, notify, loadDraft, useDraft }) {
  const roles = ['ingress', 'transit', 'egress'];
  const pages = Object.fromEntries(roles.map(role => [role, 1]));
  const visible = Object.fromEntries(roles.map(role => [role, []]));
  const facts = Object.fromEntries(roles.map(role => [role, new Map()]));
  let epoch = 0, profiles = [], reading = false, canvas = null;
  const el = name => byId('line-' + name);
  const state = text => { el('builder-status').textContent = text; };
  const candidate = (role, id) => {
    const value = facts[role]?.get(id); return roleAllowed(value, role) ? value : null;
  };
  function options(select, items, preferred = select.value) {
    select.replaceChildren();
    const empty = document.createElement('option'); empty.value = ''; empty.textContent = '请选择'; select.append(empty);
    for (const item of items) {
      const option = document.createElement('option'); option.value = item.id; option.textContent = item.label;
      option.selected = item.id === preferred; select.append(option);
    }
  }
  function settings() {
    const profile = profiles.find(item => item.profileId === el('profile').value);
    return { name: el('name').value.trim(), protocol: el('protocol').value,
      profileId: profile?.profileId ?? '', profileRevision: profile?.currentRevision ?? null };
  }
  function pruneCandidates() {
    const selected = canvas?.selected() ?? [];
    for (const role of roles) {
      const retained = new Set([...visible[role].map(node => node.id), ...selected.filter(node => node.role === role).map(node => node.nodeId)]);
      for (const id of facts[role].keys()) if (!retained.has(id)) facts[role].delete(id);
    }
  }
  canvas = initForwardCanvas({ byId, notify, candidate, candidates: role => visible[role], readSettings: settings,
    onChange: () => { pruneCandidates(); state('画布草稿已修改。结构与参数完善后，可载入原转发表单继续预览；没有提交任何变更。'); } });
  function controls(busy) {
    for (const name of ['name', 'profile', 'protocol', 'prepare', 'use', 'resources-refresh']) el(name).disabled = busy;
    for (const role of roles) el(role + '-next').disabled = busy || el(role + '-next').dataset.available !== 'true';
    canvas?.setBusy(busy);
  }
  async function readPage(role, page, nodeId) {
    const data = await request('GET', 'nodes/candidates?mode=relay&role=' + role + '&page=' + page + '&limit=25' +
      (nodeId ? '&nodeId=' + encodeURIComponent(nodeId) : ''));
    if (data.page !== page || data.limit !== 25 || !Array.isArray(data.items) || data.items.length > 25 ||
        !Number.isSafeInteger(data.total) || data.total < 0 || data.items.some(node =>
          !roleAllowed(node, role) || typeof node.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(node.id) || nodeId && node.id !== nodeId) ||
        new Set(data.items.map(node => node.id)).size !== data.items.length)
      throw Error('用途候选响应无效，请重新读取资源');
    return data;
  }
  function applyPage(role, page, data) {
    pages[role] = page; visible[role] = data.items;
    for (const node of data.items) facts[role].set(node.id, node);
    const next = el(role + '-next'), last = data.total <= page * 25 || page >= 10000;
    next.dataset.available = String(!(last && page === 1)); next.dataset.last = String(last);
    next.textContent = last ? '返回第一页' : '下一页'; next.disabled = reading || next.dataset.available !== 'true';
  }
  async function refresh() {
    if (reading) return;
    reading = true; controls(true);
    const token = ++epoch, preferred = el('profile').value, selected = canvas?.selected() ?? [];
    profiles = []; options(el('profile'), []);
    for (const role of roles) { visible[role] = []; facts[role].clear(); pages[role] = 1; el(role + '-next').dataset.available = 'false'; }
    canvas?.refresh(); state('正在按用途读取资源，并重新核对画布中的已选节点……');
    try {
      const [catalog, ...results] = await Promise.all([request('GET', 'transport-profiles'),
        ...roles.map(role => readPage(role, 1)), ...selected.map(({ role, nodeId }) => readPage(role, 1, nodeId))]);
      if (token !== epoch) return;
      if (!Array.isArray(catalog.profiles) || catalog.profiles.some(profile => typeof profile.profileId !== 'string' ||
          !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(profile.profileId) || !Number.isSafeInteger(profile.currentRevision) || profile.currentRevision < 1))
        throw Error('传输配置目录无效');
      profiles = catalog.profiles;
      roles.forEach((role, index) => applyPage(role, 1, results[index]));
      selected.forEach(({ role, nodeId }, index) => {
        const current = results[roles.length + index].items.find(node => node.id === nodeId);
        // The exact selection read supersedes the page read, including revoked use.
        if (current) facts[role].set(nodeId, current); else facts[role].delete(nodeId);
      });
      options(el('profile'), profiles.map(profile => ({ id: profile.profileId, label: profile.profileId + ' · r' + profile.currentRevision })), preferred);
      canvas?.refresh();
      state(profiles.length ? '资源已读取。添加节点、连接下一跳，再配置监听与目标；原部署预览仍会重新核验授权与能力。' : '尚无可用传输配置，请联系管理员发布并授权。');
    } catch (error) {
      if (token === epoch) {
        for (const role of roles) { visible[role] = []; facts[role].clear(); }
        state('资源读取未完成，已选布局与参数仍保留，请重试。'); canvas?.refresh(); notify(error.message, true);
      }
    } finally { if (token === epoch) { reading = false; controls(false); } }
  }
  el('resources-refresh').addEventListener('click', refresh);
  for (const role of roles) el(role + '-next').addEventListener('click', async () => {
    if (reading || el(role + '-next').dataset.available !== 'true') return;
    const token = epoch, next = el(role + '-next').dataset.last === 'true' ? 1 : pages[role] + 1;
    reading = true; controls(true);
    try {
      const data = await readPage(role, next); if (token !== epoch) return;
      applyPage(role, next, data); pruneCandidates(); canvas?.refresh();
    } catch (error) { if (token === epoch) notify(error.message, true); }
    finally { if (token === epoch) { reading = false; controls(false); } }
  });
  for (const name of ['name', 'profile', 'protocol']) el(name).addEventListener('change', () => {
    canvas?.refresh(); state('线路设置已修改，请重新载入草稿并验证部署计划。');
  });
  async function prepare(save) {
    if (reading) return;
    const token = epoch;
    try {
      if (!canvas) throw Error('画布尚未挂载，请重新打开控制台');
      const config = settings();
      if (!config.profileId || !['tcp', 'udp', 'both'].includes(config.protocol)) {
        canvas.locateProblem(!save, 'settings');
        throw Error('请在线路设置中选择传输配置与业务协议。');
      }
      if (save && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(config.name)) {
        canvas.showSettings('name');
        throw Error('可复用线路名称须以字母或数字开头，只含字母、数字、点、下划线、冒号或连字符，最多 128 字符。');
      }
      const draft = canvas.getDraft(config, !save);
      reading = true; controls(true); state('正在读取精确传输配置和节点修订……');
      const revision = await request('GET', 'transport-profiles/' + encodeURIComponent(config.profileId) + '?revision=' + config.profileRevision);
      if (token !== epoch) return;
      if (revision.profileId !== config.profileId || revision.revision !== config.profileRevision) throw Error('传输配置修订不匹配，请重新读取。');
      const loaded = await (save ? loadDraft(draft) : useDraft(draft));
      if (token !== epoch) return;
      if (loaded === false) { state('未替换当前编辑内容。'); return; }
      if (!save) {
        state('画布路径、监听和目标已载入下方转发表单，默认为停用。请验证部署计划后明确提交；画布后续修改不会自动覆盖已载入表单。');
        byId('relay-forward-form').scrollIntoView({ block: 'start', behavior: 'smooth' });
      } else {
        state('节点顺序与传输配置已载入线路草稿，不包含监听和业务目标。检查精确修订后再明确发布。');
        byId('path-template-form').scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    } catch (error) { if (token === epoch) { state('草稿准备未完成；请检查连线、参数、授权与精确修订。'); notify(error.message, true); } }
    finally { if (token === epoch && reading) { reading = false; controls(false); } }
  }
  el('prepare').addEventListener('click', () => prepare(true));
  el('use').addEventListener('click', () => prepare(false));
  function clear() {
    epoch++; reading = false; profiles = []; canvas?.clear();
    for (const role of roles) {
      pages[role] = 1; visible[role] = []; facts[role].clear();
      el(role + '-next').dataset.available = 'false'; el(role + '-next').disabled = true;
    }
    options(el('profile'), []); el('name').value = ''; el('protocol').value = 'both'; controls(false);
    state('先读取线路资源，再添加有权使用的机器。草稿仅保存在当前页面，切换工作空间会清空。');
  }
  clear(); return { refresh, clear };
}
