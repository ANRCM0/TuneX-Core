import { relayCapable, relayProfile, relayEndpoint, relaySpec } from './relay-model.js';

export function initRelayConsole({ request, mutate, notify, byId, store, load, detail, display }) {
  const knownProfiles = new Map();
  let profileList = [];
  let previewed = null;
  const el = byId;
  const formValue = (form, name) => form.elements.namedItem(name).value;
  const check = (form, name) => form.elements.namedItem(name).checked;
  const shortId = value => String(value).length > 21 ? String(value).slice(0,18) + '…' : String(value);

  function options(id, items, preferred) {
    const select = el(id), prior = preferred ?? select.value;
    select.replaceChildren();
    for (const item of items) {
      const opt = document.createElement('option');
      opt.value = String(item.value);
      opt.textContent = String(item.label ?? item.value);
      if (String(item.value) === String(prior)) opt.selected = true;
      select.append(opt);
    }
    select.disabled = !items.length;
  }
  function invalidate() {
    previewed = null;
    el('relay-submit').disabled = true;
    el('relay-preview-output').hidden = true;
  }
  function eligibleNodes() {
    return store.nodes.filter(relayCapable);
  }
  function nodeOptions() {
    return eligibleNodes().map(n => ({ value:n.id, label:shortId(n.id) + ' · ' + n.policy.capabilities.filter(c=>c==='tcp'||c==='udp').join('/') }));
  }
  function populateNodes() {
    const choices = nodeOptions();
    const ingressOld = el('relay-ingress').value;
    const egressOld = el('relay-egress').value;
    options('relay-ingress', choices, ingressOld);
    options('relay-egress', choices, egressOld);
    if (choices.length > 1 && el('relay-ingress').value === el('relay-egress').value) el('relay-egress').value = choices.find(c=>c.value!==el('relay-ingress').value).value;
    options('relay-endpoint-node', choices);
    populateIngress();
    populateEndpointListen();
    updateHint();
  }
  function populateEndpointListen() {
    const node = store.nodes.find(n=>n.id===el('relay-endpoint-node').value);
    options('relay-endpoint-listen', (node?.policy?.allowedListenerAddresses??[]).map(address=>({value:address})));
  }
  function populateIngress() {
    const node = store.nodes.find(n=>n.id===el('relay-ingress').value);
    options('relay-listen-address', (node?.policy?.allowedListenerAddresses??[]).map(address=>({value:address})));
    options('relay-listen-port', (node?.policy?.allowedPorts??[]).map(port=>({value:port})));
  }
  function updateHint() {
    const nodes=eligibleNodes();
    el('relay-readiness').textContent=nodes.length<2?
      '至少需要两台能力包含 adp.3、native.direct.v1、native.relay.v1、relay.wire.1 的有效节点；当前候选数量：'+nodes.length :
      '节点能力已识别。验证计划时仍要检查两端 Peer 凭据、实时 Session、Profile Grant、Endpoint 和目标 CIDR。';
    invalidate();
  }
  async function refreshProfiles() {
    const data = await request('GET','transport-profiles');
    profileList = Array.isArray(data.profiles)?data.profiles:[];
    knownProfiles.clear();
    const body = el('relay-profile-rows');
    body.replaceChildren();
    if (!profileList.length) {
      const tr=document.createElement('tr'),td=document.createElement('td');
      td.colSpan=3;td.className='empty';td.textContent='暂无 Transport Profile，先发布一个';tr.append(td);body.append(tr);
    }
    for (const p of profileList) {
      const row=document.createElement('tr');
      for (const item of [p.profileId,'r'+p.currentRevision]) {
        const cell=document.createElement('td');cell.textContent=item;row.append(cell);
      }
      const action=document.createElement('td'),button=document.createElement('button');
      button.type='button';button.className='secondary';button.textContent='详情';button.addEventListener('click',async ()=>{
        try { detail('Transport Profile · '+p.profileId,await loadProfile(p.profileId)); }
        catch(e) { notify(e.message,true); }
      });
      action.append(button);row.append(action);body.append(row);
    }
    options('relay-profile-select',profileList.map(p=>({value:p.profileId,label:p.profileId+' · r'+p.currentRevision})));
    invalidate();
  }
  async function loadProfile(profileId) {
    if(knownProfiles.has(profileId)) return knownProfiles.get(profileId);
    const response=await request('GET','transport-profiles/'+encodeURIComponent(profileId));
    knownProfiles.set(profileId,response);
    return response;
  }
  async function publishProfile(event) {
    event.preventDefault();
    try {
      const form=el('relay-profile-form'),profileId=formValue(form,'profileId').trim();
      if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(profileId))throw Error('Profile ID 不合法');
      const config=relayProfile({
        protocol:formValue(form,'protocol'),
        handshakeTimeoutSeconds:formValue(form,'handshakeTimeoutSeconds'),
        idleTimeoutSeconds:formValue(form,'idleTimeoutSeconds'),
        maxFrameBytes:formValue(form,'maxFrameBytes'),
        maxUdpDatagramBytes:formValue(form,'maxUdpDatagramBytes'),
        maxConnectionsPerNode:formValue(form,'maxConnectionsPerNode')
      });
      const existing=profileList.find(p=>p.profileId===profileId);
      const expectedRevision=existing?.currentRevision??0;
      if(existing && !confirm('同名 Profile 将基于 r'+expectedRevision+' 发布新 revision，不会自动切换正在运行的 Forward。继续？'))return;
      const response=await mutate('PUT','transport-profiles/'+encodeURIComponent(profileId),{expectedRevision,config});
      await refreshProfiles();
      options('relay-profile-select',profileList.map(p=>({value:p.profileId,label:p.profileId+' · r'+p.currentRevision})),profileId);
      notify('Profile 已提交：'+profileId+' · r'+response.revision+'；使用权限仍由 Control Profile Grant 决定。');
    } catch(e) { notify(e.message,true); }
  }
  async function viewEndpoint() {
    try{
      const id=el('relay-endpoint-node').value;
      if(!id)throw Error('请选择出口节点');
      const response=await request('GET','nodes/'+encodeURIComponent(id)+'/relay-endpoint');
      detail('Relay Endpoint · '+shortId(id),response);
    }catch(e){notify(e.message,true);}
  }
  async function saveEndpoint(event) {
    event.preventDefault();
    try {
      const form=el('relay-endpoint-form'),nodeId=formValue(form,'nodeId');
      const config=relayEndpoint({
        listenAddress:formValue(form,'listenAddress'),
        advertisedHost:formValue(form,'advertisedHost'),
        ports:formValue(form,'ports')
      });
      let expectedRevision=0;
      try { const existing=await request('GET','nodes/'+encodeURIComponent(nodeId)+'/relay-endpoint');expectedRevision=existing.revision; }
      catch(e) {if(!e.message.startsWith('NOT_FOUND：'))throw e;}
      if(expectedRevision>0&&!confirm('已有 Endpoint r'+expectedRevision+'，改动可能影响现有 Relay，请确认继续。'))return;
      const response=await mutate('PUT','nodes/'+encodeURIComponent(nodeId)+'/relay-endpoint',{expectedRevision,config});
      invalidate();
      notify('Relay Endpoint 已提交 · revision '+response.revision+'；当前不代表端口已成功绑定。');
    }catch(e){notify(e.message,true);}
  }
  async function buildSpec() {
    const form=el('relay-forward-form');
    const ingress=store.nodes.find(n=>n.id===formValue(form,'ingressId'));
    const egress=store.nodes.find(n=>n.id===formValue(form,'egressId'));
    const profile=await loadProfile(formValue(form,'profileId'));
    return relaySpec({
      protocol:formValue(form,'protocol'),listenAddress:formValue(form,'listenAddress'),
      listenPort:formValue(form,'listenPort'),targetHost:formValue(form,'targetHost'),
      targetPort:formValue(form,'targetPort'),enabled:check(form,'enabled')
    },ingress,egress,profile);
  }
  async function preview() {
    invalidate();
    try {
      const spec=await buildSpec();
      const egressId=spec.path.via[0];
      // Presence is necessary, not sufficient; the server preview checks use grants and policy.
      await request('GET','nodes/'+encodeURIComponent(egressId)+'/relay-endpoint');
      const response=await request('POST','relay-plan',spec);
      previewed=JSON.stringify(spec);
      el('relay-preview-output').hidden=false;
      el('relay-preview-output').textContent=JSON.stringify({
        verifiedAt:new Date().toISOString(),source:'Control Relay compiler',
        reserved:response.reserved,executionSupported:response.executionSupported,
        profile:response.profile,endpointRevision:response.endpointRevision,
        physicalResources:response.resources,
        note:'预览只做能力/授权/物理资源计划检查，不预留任何端口，不保证未来部署成功或网络可达。'
      },null,2);
      el('relay-submit').disabled=false;
      notify('Relay 计划检查通过；尚未部署、授权续期或进行实际链路探测。');
    }catch(e){notify(e.message,true);}
  }
  async function submit(event) {
    event.preventDefault();
    try {
      const spec=await buildSpec();
      if(!previewed||JSON.stringify(spec)!==previewed)throw Error('表单已变化，请重新执行计划预览');
      el('relay-submit').disabled=true;
      const result=await mutate('POST','forwards',spec);
      previewed=null;
      await Promise.all([load('forwards'),load('operations')]);
      display('operations');
      notify('Relay Forward 已接受，Operation '+result.operationId+'；请观察两个 Agent 的应用状态。');
    }catch(e){notify(e.message,true);}
  }
  el('relay-profile-form').addEventListener('submit',publishProfile);
  el('relay-endpoint-form').addEventListener('submit',saveEndpoint);
  el('relay-endpoint-view').addEventListener('click',viewEndpoint);
  el('relay-endpoint-node').addEventListener('change',populateEndpointListen);
  el('relay-ingress').addEventListener('change',()=>{populateIngress();invalidate();});
  el('relay-egress').addEventListener('change',invalidate);
  el('relay-profile-select').addEventListener('change',invalidate);
  el('relay-forward-form').addEventListener('input',invalidate);
  el('relay-forward-form').addEventListener('change',invalidate);
  el('relay-forward-form').addEventListener('submit',submit);
  el('relay-preview').addEventListener('click',preview);
  el('relay-reload').addEventListener('click',()=>refresh().catch(e=>notify(e.message,true)));
  async function refresh(){
    populateNodes();
    await refreshProfiles();
  }
  function clear() {
    profileList=[];
    knownProfiles.clear();
    invalidate();
    options('relay-profile-select',[]);
    const tbody=el('relay-profile-rows');
    tbody.replaceChildren();
    const row=document.createElement('tr'),cell=document.createElement('td');
    cell.colSpan=3;cell.className='empty';cell.textContent='连接后加载 Profile';
    row.append(cell);tbody.append(row);
    populateNodes();
  }
  return {refresh,populateNodes,clear};
}
