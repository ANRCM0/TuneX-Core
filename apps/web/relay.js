import { relayCapable, multihopCapable, multihopSpec, relayProfile, relayEndpoint, relaySpec } from './relay-model.js';

export function initRelayConsole({ request, mutate, notify, byId, candidates, load, loadOverview, loadCandidates, detail, display, inspectProfile, loadCatalog }) {
  const knownProfiles = new Map();
  let profileList = [];
  let previewed = null;
  let multihopEnabled=false, intermediates=[],editing=null,pinnedProfileRevision=null,deploymentId=null,editVersion=0;
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
    renderPath();
  }
  function renderPath(){
    const path=[el('relay-ingress').value,...intermediates,el('relay-egress').value];
    el('relay-topology').replaceChildren();
    path.forEach((id,i)=>{const li=document.createElement('li');li.textContent=(i===0?'入口 ':i===path.length-1?'出口 ':'中继 ')+shortId(id||'待选择');el('relay-topology').append(li);});
    el('multihop-path').replaceChildren();
    intermediates.forEach((id,index)=>{
      const li=document.createElement('li'),name=document.createElement('span');name.textContent=shortId(id);li.append(name);
      for(const [label,move] of [['上移',-1],['下移',1],['移除',0]]){
        const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=label;
        button.disabled=move===-1&&index===0||move===1&&index===intermediates.length-1;
        button.setAttribute('aria-label',label+' '+id);
        button.addEventListener('click',()=>{if(!move)intermediates.splice(index,1);else [intermediates[index],intermediates[index+move]]=[intermediates[index+move],intermediates[index]];invalidate();});li.append(button);
      }
      el('multihop-path').append(li);
    });
    options('multihop-candidate',candidates.relay.filter(n=>multihopCapable(n)&&!path.includes(n.id)).map(n=>({value:n.id})));
    el('multihop-add').disabled=!multihopEnabled||intermediates.length>=6||!el('multihop-candidate').value;
    el('multihop-controls').hidden=!multihopEnabled;
  }
  function eligibleNodes() {
    return candidates.relay.filter(relayCapable);
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
    const node = candidates.relay.find(n=>n.id===el('relay-endpoint-node').value);
    options('relay-endpoint-listen', (node?.policy?.allowedListenerAddresses??[]).map(address=>({value:address})));
  }
  function populateIngress() {
    const node = candidates.relay.find(n=>n.id===el('relay-ingress').value);
    options('relay-listen-address', (node?.policy?.allowedListenerAddresses??[]).map(address=>({value:address})));
    options('relay-listen-port', (node?.policy?.allowedPorts??[]).map(port=>({value:port})));
  }
  function updateHint() {
    const nodes=eligibleNodes();
    el('relay-readiness').textContent=nodes.length<2?
      '当前候选页和已选节点不足两台；请搜索或翻页选择仍有授权和有效凭据的 Relay 节点。' :
      '当前页含已选节点；候选不等于完整授权。验证计划时仍要检查 Peer 凭据、实时 Session、Profile Grant、Endpoint 和目标 CIDR。';
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
      const references=document.createElement('button');references.type='button';references.className='secondary';references.textContent='引用 / 影响';
      references.addEventListener('click',()=>inspectProfile(p).catch(e=>notify(e.message,true)));action.append(references);
    }
    options('relay-profile-select',profileList.map(p=>({value:p.profileId,label:p.profileId+' · r'+p.currentRevision})));
    invalidate();
  }
  async function loadProfile(profileId,revision) {
    const key=profileId+'/'+(revision??'current');
    if(knownProfiles.has(key)) return knownProfiles.get(key);
    const response=await request('GET','transport-profiles/'+encodeURIComponent(profileId)+(revision?'?revision='+revision:''));
    knownProfiles.set(key,response);
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
    const ingress=candidates.relay.find(n=>n.id===formValue(form,'ingressId'));
    const egress=candidates.relay.find(n=>n.id===formValue(form,'egressId'));
    const profile=await loadProfile(formValue(form,'profileId'),pinnedProfileRevision);
    const fields={
      protocol:formValue(form,'protocol'),listenAddress:formValue(form,'listenAddress'),
      listenPort:formValue(form,'listenPort'),targetHost:formValue(form,'targetHost'),
      targetPort:formValue(form,'targetPort'),enabled:check(form,'enabled')
    };
    return intermediates.length?multihopSpec(fields,[ingress,...intermediates.map(id=>candidates.relay.find(n=>n.id===id)),egress],profile,multihopEnabled):relaySpec(fields,ingress,egress,profile);
  }
  async function preview() {
    invalidate();
    try {
      const spec=await buildSpec();
      // Presence is necessary, not sufficient; the server preview checks use grants and policy.
      for(const nodeId of spec.path.via)await request('GET','nodes/'+encodeURIComponent(nodeId)+'/relay-endpoint');
      const response=await request('POST','relay-plan',spec);
      previewed=JSON.stringify(spec);
      el('relay-preview-output').hidden=false;
      el('relay-preview-output').textContent=JSON.stringify({
        verifiedAt:new Date().toISOString(),source:'Control Relay compiler',
        reserved:response.reserved,executionSupported:response.executionSupported,
        profile:response.profile,endpointRevision:response.endpointRevision,endpointRevisions:response.endpointRevisions,path:response.path,
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
      const result=editing?await mutate('PUT','forwards/'+encodeURIComponent(editing.id),{expectedRevision:editing.revision,spec}):await mutate('POST','forwards',spec);
      cancelEdit();
      previewed=null;
      await Promise.all([load('forwards'),load('operations'),loadOverview()]);
      display('operations');
      notify('链路操作已接受，Operation '+(result.operationId??'无变更')+'；请观察路径中各节点的应用状态。');
    }catch(e){notify(e.message,true);}
  }
  el('relay-profile-form').addEventListener('submit',publishProfile);
  el('relay-endpoint-form').addEventListener('submit',saveEndpoint);
  el('relay-endpoint-view').addEventListener('click',viewEndpoint);
  el('relay-endpoint-node').addEventListener('change',populateEndpointListen);
  el('relay-ingress').addEventListener('change',()=>{populateIngress();invalidate();});
  el('relay-egress').addEventListener('change',invalidate);
  el('relay-profile-select').addEventListener('change',()=>{pinnedProfileRevision=null;invalidate();});
  el('relay-forward-form').addEventListener('input',invalidate);
  el('relay-forward-form').addEventListener('change',invalidate);
  el('relay-forward-form').addEventListener('submit',submit);
  el('relay-preview').addEventListener('click',preview);
  el('relay-reload').addEventListener('click',()=>refresh().catch(e=>notify(e.message,true)));
  el('multihop-add').addEventListener('click',()=>{const id=el('multihop-candidate').value;if(id&&multihopEnabled&&intermediates.length<6&&!intermediates.includes(id)){intermediates.push(id);invalidate();}});
  el('relay-cancel-edit').addEventListener('click',cancelEdit);
  function cancelEdit(){editVersion++;editing=null;pinnedProfileRevision=null;intermediates=[];el('relay-cancel-edit').hidden=true;el('relay-submit').textContent='创建链路';el('relay-ingress').disabled=false;invalidate();}
  async function edit(item){
    const version=++editVersion;
    if (!await refresh([item.spec.ingress.nodeId,...item.spec.path.via]) || version!==editVersion) return;
    if ([item.spec.ingress.nodeId,...item.spec.path.via].some(id=>!candidates.relay.some(n=>n.id===id))) throw Error('路径中存在不再具备候选资格的节点，请检查授权、凭据和能力');
    editing={id:item.id,revision:item.revision};pinnedProfileRevision=item.spec.transport.configRevision;
    const form=el('relay-forward-form'),s=item.spec;
    el('relay-ingress').value=s.ingress.nodeId;el('relay-egress').value=s.path.via.at(-1);populateIngress();
    el('relay-ingress').disabled=true;el('relay-profile-select').value=s.transport.profileId;
    form.elements.namedItem('protocol').value=s.protocols.length===2?'both':s.protocols[0];
    form.elements.namedItem('listenAddress').value=s.ingress.listen.address;form.elements.namedItem('listenPort').value=String(s.ingress.listen.port);
    form.elements.namedItem('targetHost').value=s.target.host;form.elements.namedItem('targetPort').value=String(s.target.port);form.elements.namedItem('enabled').checked=s.enabled;
    intermediates=s.path.via.slice(0,-1);el('relay-submit').textContent='更新链路 r'+item.revision;el('relay-cancel-edit').hidden=false;
    invalidate();display('relay');
  }
  el('deployment-close').addEventListener('click',()=>el('deployment-dialog').close());
  el('deployment-refresh').addEventListener('click',()=>deployment(deploymentId).catch(e=>notify(e.message,true)));
  async function deployment(id){
    deploymentId=id;const [response,forward,history]=await Promise.all([request('GET','forwards/'+encodeURIComponent(id)+'/deployment'),request('GET','forwards/'+encodeURIComponent(id)),request('GET','forwards/'+encodeURIComponent(id)+'/revisions')]);
    const d=response.deployment;if(!d)throw Error('尚无持久化部署计划');
    el('deployment-state').textContent='部署 g'+d.generation+' / '+d.stage+'；Control 续租：'+(d.renewalAllowed?'允许':'已停止或尚未授权')+'；已准备 '+(d.preparedCount??'—')+'，已请求激活 '+(d.activatedCount??'—')+'；隔离资源 '+d.isolation.length+'。流量验收尚无证据。';
    el('deployment-topology').replaceChildren();el('deployment-nodes').replaceChildren();
    if(d.operation?.lastError){
      const error=document.createElement('p');error.className='hint';error.textContent='最近操作 '+d.operation.id+' / '+d.operation.status+' / '+JSON.stringify(d.operation.lastError);el('deployment-nodes').append(error);
    }
    for(const node of d.nodes){
      const li=document.createElement('li');li.textContent=shortId(node.nodeId)+' · '+(node.ready?'就绪':node.prepared?'已准备':'等待或异常');li.className=node.ready?'ready':'';el('deployment-topology').append(li);
      const p=document.createElement('p');p.className='hint';p.textContent=node.nodeId+' / '+node.role+' / Session '+node.currentSessionEpoch+' / 最近快照截止 '+(node.validUntil??'未下发')+' / '+(node.reportFresh?node.observations.map(o=>o.errorCode||o.condition).join(', ')||'暂无当前执行实例报告':'暂无新鲜报告');el('deployment-nodes').append(p);
    }
    const revisions=history.revisions.filter(r=>r.revision<forward.desired.revision);
    if(revisions.length){
      const label=document.createElement('label'),select=document.createElement('select');label.textContent='恢复历史配置（重新授权和部署）';
      for(const r of revisions){const option=document.createElement('option');option.value=String(r.revision);option.textContent='r'+r.revision;select.append(option);}label.append(select);
      const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='部署所选配置';
      button.addEventListener('click',async()=>{try{
        const selected=revisions.find(r=>String(r.revision)===select.value);if(!confirm('将 r'+selected.revision+' 的配置作为新 revision 部署，重新检查权限与端口。继续？'))return;
        button.disabled=true;const result=await mutate('PUT','forwards/'+encodeURIComponent(id),{expectedRevision:forward.desired.revision,spec:selected.spec});
        el('deployment-dialog').close();await Promise.all([load('forwards'),load('operations'),loadOverview()]);notify('历史配置已提交，Operation '+(result.operationId??'无变更'));
      }catch(e){notify(e.message,true);button.disabled=false;}});
      el('deployment-nodes').append(label,button);
    }
    if(!el('deployment-dialog').open)el('deployment-dialog').showModal();
  }
  async function refreshCandidates(pinnedIds){
    invalidate();
    el('relay-preview').disabled=true;
    const ingress=el('relay-ingress').value;
    const preferred={address:el('relay-listen-address').value,port:el('relay-listen-port').value};
    const ids=pinnedIds??[ingress,el('relay-egress').value,el('relay-endpoint-node').value,...intermediates];
    if (!await loadCandidates('relay',ids)) return false;
    populateNodes();
    if(el('relay-ingress').value===ingress){
      el('relay-listen-address').value=preferred.address;el('relay-listen-port').value=preferred.port;
    }
    if(editing)el('relay-ingress').disabled=true;
    if(ids.filter(Boolean).some(id=>!candidates.relay.some(n=>n.id===id)))throw Error('部分已选节点的授权、凭据或能力已失效，请重新检查路径');
    el('relay-preview').disabled=false;
    return true;
  }
  async function refresh(pinnedIds){
    const features=await request('GET','execution-capabilities');multihopEnabled=features.multihopEnabled===true;
    await Promise.all([loadCatalog(),refreshProfiles()]);
    if (!await refreshCandidates(pinnedIds)) return false;
    return true;
  }
  function clear() {
    multihopEnabled=false;deploymentId=null;cancelEdit();
    el('deployment-nodes').replaceChildren();el('deployment-topology').replaceChildren();el('deployment-state').textContent='';
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
  return {refresh,populateNodes,refreshCandidates,clear,edit,deployment};
}
