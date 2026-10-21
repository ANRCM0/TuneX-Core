import { roleAllowed } from './account-context.js';

export function initLineBuilder({ request, byId, notify, loadDraft, useDraft }) {
  const roles = ['ingress','transit','egress'];
  const pages = Object.fromEntries(roles.map(role => [role, 1]));
  let epoch = 0, transits = [], profiles = [], reading = false;
  const el = name => byId('line-' + name);
  const state = text => { el('builder-status').textContent = text; };
  function options(select, items, selected = select.value) {
    select.replaceChildren();
    const empty = document.createElement('option'); empty.value = ''; empty.textContent = '请选择'; select.append(empty);
    for (const item of items) {
      const option = document.createElement('option'); option.value = item.id; option.textContent = item.label;
      option.selected = item.id === selected; select.append(option);
    }
  }
  async function resources(role, token = epoch) {
    const page = pages[role];
    const data = await request('GET', 'nodes/candidates?mode=relay&role=' + role + '&page=' + page + '&limit=25');
    if (token !== epoch || pages[role] !== page) return;
    if (data.page !== page || data.limit !== 25 || !Array.isArray(data.items) || data.items.length > 25 ||
        !Number.isSafeInteger(data.total) || data.total < 0 || data.items.some(node => !roleAllowed(node, role)))
      throw Error('用途候选响应无效，请重新读取资源');
    options(el(role), data.items.map(node => ({ id: node.id, label: node.id + ' · ' + (node.resourceSource === 'private' ? '我的机器' : '管理员共享') })));
    const next = el(role + '-next'); next.disabled = data.total <= page * 25 && page === 1;
    next.textContent = data.total > page * 25 ? '下一页' : '返回第一页';
    next.dataset.last = String(data.total <= page * 25);
  }
  function renderTransits() {
    el('transits').replaceChildren();
    for (const [index, id] of transits.entries()) {
      const item = document.createElement('li'), text = document.createElement('span'), remove = document.createElement('button');
      text.textContent = '中继 ' + (index + 1) + ' · ' + id; remove.type = 'button'; remove.className = 'secondary'; remove.textContent = '移除';
      remove.addEventListener('click', () => { if (!reading) { transits.splice(index, 1); renderTransits(); } });
      item.append(text, remove); el('transits').append(item);
    }
  }
  function controls(busy) {
    for(const name of ['name','profile','protocol','ingress','transit','egress','prepare','use','resources-refresh','add-transit'])el(name).disabled=busy;
  }
  async function refresh() {
    if(reading)return;
    const token = ++epoch; transits = []; renderTransits(); profiles = [];
    options(el('profile'), []); roles.forEach(role => { pages[role] = 1; options(el(role), []); el(role + '-next').disabled = true; });
    state('正在按用途读取资源……');
    try {
      const [catalog] = await Promise.all([request('GET', 'transport-profiles'), ...roles.map(role => resources(role, token))]);
      if (token !== epoch) return;
      if (!Array.isArray(catalog.profiles) || catalog.profiles.some(profile => typeof profile.profileId !== 'string' || !Number.isSafeInteger(profile.currentRevision) || profile.currentRevision < 1))
        throw Error('传输配置目录无效');
      profiles = catalog.profiles;
      options(el('profile'), profiles.map(profile => ({ id: profile.profileId, label: profile.profileId + ' · r' + profile.currentRevision })));
      state(profiles.length ? '选择节点与传输配置后读取精确修订。资源用途、凭据与完整路径仍须服务端核验。' : '尚无可用传输配置，请联系管理员发布并授权。');
    } catch (error) { if (token === epoch) { state('资源读取未完成，请重试。'); notify(error.message, true); } }
  }
  el('resources-refresh').addEventListener('click', refresh);
  for (const role of roles) el(role + '-next').addEventListener('click', async () => {
    if(reading)return;
    pages[role] = el(role + '-next').dataset.last === 'true' ? 1 : pages[role] + 1;
    try { await resources(role); } catch (error) { notify(error.message, true); }
  });
  el('add-transit').addEventListener('click', () => {
    const id = el('transit').value;
    if (reading || !id) return;
    if (transits.length >= 6 || transits.includes(id) || [el('ingress').value, el('egress').value].includes(id)) return notify('中继须与其他节点不同，最多 6 个。', true);
    transits.push(id); renderTransits();
  });
  async function prepare(save) {
    if (reading) return;
    const token = epoch;
    try {
      const nodes = [el('ingress').value, ...transits, el('egress').value], profile = profiles.find(item => item.profileId === el('profile').value);
      const name = el('name').value.trim(), protocol = el('protocol').value;
      if (save&&!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(name) || nodes.some(id => !id) || new Set(nodes).size !== nodes.length || !profile)
        throw Error(save?'填写线路名称，选择不同的入口、出口与传输配置。':'选择不同的入口、出口与传输配置。直接使用无需线路名称。');
      reading = true; controls(true); state('正在读取精确传输配置和节点修订……');
      const revision = await request('GET', 'transport-profiles/' + encodeURIComponent(profile.profileId) + '?revision=' + profile.currentRevision);
      if (token !== epoch) return;
      if (revision.profileId !== profile.profileId || revision.revision !== profile.currentRevision) throw Error('传输配置修订不匹配，请重新读取。');
      const draft={ name, nodes, protocol, profileId: profile.profileId, profileRevision: revision.revision };
      const loaded=await (save?loadDraft(draft):useDraft(draft));
      if (token !== epoch) return;
      if(loaded===false){state('未替换当前编辑内容。');return;}
      if(!save){
        state('组合已载入下方转发表单。请填写监听与目标，明确预览后提交；没有发布可复用线路。');
        byId('relay-forward-form').scrollIntoView({block:'start',behavior:'smooth'});return;
      }
      state('线路草稿已载入。请检查下方精确修订，再明确发布；发布完成后才可绑定转发。');
      byId('path-template-form').scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (error) { if (token === epoch) { state('草稿准备未完成；请检查授权、资源与精确修订。'); notify(error.message, true); } }
    finally { if (token === epoch) { reading = false; controls(false); } }
  }
  el('prepare').addEventListener('click',()=>prepare(true));
  el('use').addEventListener('click',()=>prepare(false));
  function clear() {
    epoch++; reading = false; transits = []; profiles = []; controls(false);renderTransits();
    for (const role of roles) { pages[role] = 1; options(el(role), []); el(role + '-next').disabled = true; }
    options(el('profile'), []); el('name').value = ''; el('prepare').disabled = false;
    state('读取资源后选择入口与出口；每条线路最多 8 个不同节点。');
  }
  clear(); return { refresh, clear };
}
