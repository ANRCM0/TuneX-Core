import { roleAllowed } from '../account-context.js';
export function createNativeRelayConsole({ relayCapable, multihopCapable, multihopSpec, relayProfile, relayEndpoint, relaySpec }) {
function initRelayConsole({ request, mutate, notify, byId, candidates, load, loadOverview, loadCandidates, detail, display, inspectProfile, loadCatalog, inspectTunnel }) {
  const knownProfiles = new Map();
  let profileList = [];
  let previewed = null;
  let planVersion = 0;
  let sessionVersion = 0;
  let multihopEnabled=false, intermediates=[],editing=null,pinnedProfileRevision=null,deploymentId=null,editVersion=0,deploymentVersion=0;
  const el = byId;
  const formValue = (form, name) => form.elements.namedItem(name).value;
  const check = (form, name) => form.elements.namedItem(name).checked;
  const shortId = value => String(value).length > 21 ? String(value).slice(0,18) + '…' : String(value);
  const tasks=new Map();
  function beginTask(name,formId,buttons=[],freeze=false){
    const form=el(formId);
    if(tasks.has(name)||[...tasks.values()].some(task=>task.form===form))return null;
    const controls=new Map(),task={name,version:sessionVersion,form,controls};
    const elements=freeze&&form.elements?.[Symbol.iterator]?[...form.elements]:[];
    for(const control of [...elements,...buttons.map(el)])if(!controls.has(control)){controls.set(control,control.disabled);control.disabled=true;}
    form.setAttribute('aria-busy','true');tasks.set(name,task);return task;
  }
  function finishTask(task){
    if(!task||tasks.get(task.name)!==task||task.version!==sessionVersion)return;
    tasks.delete(task.name);task.form.setAttribute('aria-busy','false');
    for(const [control,disabled] of task.controls)control.disabled=disabled;
  }

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
    select.disabled = !items.length || [...tasks.values()].some(task=>task.controls.has(select));
  }
  function invalidate() {
    planVersion++;
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
        button.disabled=tasks.has('draft')||tasks.has('submit')||move===-1&&index===0||move===1&&index===intermediates.length-1;
        button.setAttribute('aria-label',label+' '+id);
        button.addEventListener('click',()=>{if(!move)intermediates.splice(index,1);else [intermediates[index],intermediates[index+move]]=[intermediates[index+move],intermediates[index]];invalidate();});li.append(button);
      }
      el('multihop-path').append(li);
    });
    options('multihop-candidate',candidates.relay.filter(n=>multihopCapable(n)&&roleAllowed(n,'transit')&&!path.includes(n.id)).map(n=>({value:n.id})));
    el('multihop-add').disabled=tasks.has('draft')||tasks.has('submit')||!multihopEnabled||intermediates.length>=6||!el('multihop-candidate').value;
    el('multihop-controls').hidden=!multihopEnabled;
  }
  function eligibleNodes() {
    return candidates.relay.filter(relayCapable);
  }
  function nodeOptions(role) {
    return eligibleNodes().filter(node=>!role||roleAllowed(node,role)).map(n => ({ value:n.id, label:shortId(n.id) + ' · ' + n.policy.capabilities.filter(c=>c==='tcp'||c==='udp').join('/') }));
  }
  function populateNodes() {
    const choices = nodeOptions('egress');
    const ingressOld = el('relay-ingress').value;
    const egressOld = el('relay-egress').value;
    options('relay-ingress', nodeOptions('ingress'), ingressOld);
    options('relay-egress', choices, egressOld);
    if (choices.length > 1 && el('relay-ingress').value === el('relay-egress').value) el('relay-egress').value = choices.find(c=>c.value!==el('relay-ingress').value).value;
    options('relay-endpoint-node',eligibleNodes().filter(node=>node.readDetail==='full').map(node=>({value:node.id})));
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
    const version=sessionVersion;
    const data = await request('GET','transport-profiles');
    if(version!==sessionVersion)return false;
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
    const version=sessionVersion;
    const key=profileId+'/'+(revision??'current');
    if(knownProfiles.has(key)) return knownProfiles.get(key);
    const response=await request('GET','transport-profiles/'+encodeURIComponent(profileId)+(revision?'?revision='+revision:''));
    if(version!==sessionVersion)return;
    knownProfiles.set(key,response);
    return response;
  }
  async function publishProfile(event) {
    event.preventDefault();
    const task=beginTask('profile','relay-profile-form',[],true);if(!task)return;
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
      if(task.version!==sessionVersion)return;
      await refreshProfiles();
      if(task.version!==sessionVersion)return;
      options('relay-profile-select',profileList.map(p=>({value:p.profileId,label:p.profileId+' · r'+p.currentRevision})),profileId);
      notify('Profile 已提交：'+profileId+' · r'+response.revision+'；使用权限仍由 Control Profile Grant 决定。');
    } catch(e) { if(task.version===sessionVersion)notify(e.message,true); }
    finally{finishTask(task);}
  }
  async function viewEndpoint() {
    try{
      const id=el('relay-endpoint-node').value;
      if(!id)throw Error('请选择出口节点');
      await inspectTunnel(id);
    }catch(e){notify(e.message,true);}
  }
  async function saveEndpoint(event) {
    event.preventDefault();
    const task=beginTask('endpoint','relay-endpoint-form',[],true);if(!task)return;
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
      if(task.version!==sessionVersion)return;
      if(expectedRevision>0&&!confirm('已有 Endpoint r'+expectedRevision+'，改动可能影响现有 Relay，请确认继续。'))return;
      const response=await mutate('PUT','nodes/'+encodeURIComponent(nodeId)+'/relay-endpoint',{expectedRevision,config});
      if(task.version!==sessionVersion)return;
      invalidate();
      notify('Relay Endpoint 已提交 · revision '+response.revision+'；当前不代表端口已成功绑定。');
    }catch(e){if(task.version===sessionVersion)notify(e.message,true);}
    finally{finishTask(task);}
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
    if(tasks.has('submit'))return;
    const task=beginTask('preview','relay-forward-form',['relay-preview']);if(!task)return;
    invalidate();
    const version=planVersion;
    try {
      const spec=await buildSpec();
      if(version!==planVersion)return;
      // Presence is necessary, not sufficient; the server preview checks use grants and policy.
      for(const nodeId of spec.path.via){if(version!==planVersion)return;await request('GET','nodes/'+encodeURIComponent(nodeId)+'/relay-endpoint');}
      if(version!==planVersion)return;
      const response=await request('POST','relay-plan',spec);
      if(version!==planVersion)return;
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
    }catch(e){if(version===planVersion)notify(e.message,true);}
    finally{finishTask(task);}
  }
  async function submit(event) {
    event.preventDefault();
    if(tasks.has('preview'))return;
    const task=beginTask('submit','relay-forward-form',['relay-submit','relay-preview','relay-cancel-edit','relay-reload'],true);if(!task)return;
    const version=planVersion,selected=editing?{...editing}:null;
    try {
      const spec=await buildSpec();
      if(version!==planVersion)return;
      if(!previewed||JSON.stringify(spec)!==previewed)throw Error('表单已变化，请重新执行计划预览');
      el('relay-submit').disabled=true;
      const result=selected?await mutate('PUT','forwards/'+encodeURIComponent(selected.id),{expectedRevision:selected.revision,spec}):await mutate('POST','forwards',spec);
      if(task.version!==sessionVersion)return;
      cancelEdit();
      previewed=null;
      await Promise.all([load('forwards'),load('operations'),loadOverview()]);
      if(task.version!==sessionVersion)return;
      display('operations');
      notify('链路操作已接受，Operation '+(result.operationId??'无变更')+'；请观察路径中各节点的应用状态。');
    }catch(e){if(task.version===sessionVersion)notify(e.message,true);}
    finally{
      finishTask(task);
      if(task.version===sessionVersion){previewed=null;el('relay-submit').disabled=true;el('relay-ingress').disabled=Boolean(editing);renderPath();}
    }
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
  async function edit(item,copy=false){
    const version=++editVersion;
    if (!await refresh([item.spec.ingress.nodeId,...item.spec.path.via]) || version!==editVersion) return;
    if ([item.spec.ingress.nodeId,...item.spec.path.via].some(id=>!candidates.relay.some(n=>n.id===id))) throw Error('路径中存在不再具备候选资格的节点，请检查授权、凭据和能力');
    editing=copy?null:{id:item.id,revision:item.revision};pinnedProfileRevision=item.spec.transport.configRevision;
    const form=el('relay-forward-form'),s=item.spec;
    el('relay-ingress').value=s.ingress.nodeId;el('relay-egress').value=s.path.via.at(-1);populateIngress();
    el('relay-ingress').disabled=!copy;el('relay-profile-select').value=s.transport.profileId;
    form.elements.namedItem('protocol').value=s.protocols.length===2?'both':s.protocols[0];
    form.elements.namedItem('listenAddress').value=s.ingress.listen.address;form.elements.namedItem('listenPort').value=copy?'':String(s.ingress.listen.port);
    form.elements.namedItem('targetHost').value=s.target.host;form.elements.namedItem('targetPort').value=String(s.target.port);form.elements.namedItem('enabled').checked=copy?false:s.enabled;
    intermediates=s.path.via.slice(0,-1);el('relay-submit').textContent=copy?'复制为新链路（停用）':'更新链路 r'+item.revision;el('relay-cancel-edit').hidden=false;
    invalidate();display('relay');
  }
  async function loadPathDraft(draft) {
    const validId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
    if(!draft||!Array.isArray(draft.nodes)||draft.nodes.length<2||draft.nodes.length>8||
        draft.nodes.some(node=>!validId(node))||new Set(draft.nodes).size!==draft.nodes.length||
        !validId(draft.profileId)||!Number.isSafeInteger(draft.profileRevision)||draft.profileRevision<1||
        !['tcp','udp','both'].includes(draft.protocol))throw Error('组线路径与精确传输修订无效');
    const connectionFields=['listenAddress','listenPort','targetHost','targetPort'];
    const hasConnection=connectionFields.some(name=>Object.hasOwn(draft,name));
    const connection=hasConnection?Object.fromEntries(connectionFields.map(name=>[name,draft[name]])):null;
    if(connection&&(typeof connection.listenAddress!=='string'||!connection.listenAddress||connection.listenAddress.length>45||
        !Number.isInteger(connection.listenPort)||connection.listenPort<1||connection.listenPort>65535||
        typeof connection.targetHost!=='string'||!connection.targetHost.trim()||connection.targetHost.trim().length>253||
        !Number.isInteger(connection.targetPort)||connection.targetPort<1||connection.targetPort>65535))
      throw Error('画布监听与目标参数不完整或超出范围');
    if(!confirm('载入当前组合，准备一条新的停用转发？这会替换下方编辑内容；不会撤销或重放此前结果不确定的提交。'))return false;
    const task=beginTask('draft','relay-forward-form',['relay-submit','relay-preview','relay-cancel-edit','relay-reload'],true);
    if(!task)throw Error('当前表单正在检查、载入或提交，请等待完成后再载入画布草稿。');
    const prior={editing,pinnedProfileRevision,intermediates:[...intermediates],
      values:Object.fromEntries(['ingressId','egressId','profileId','listenAddress','listenPort','protocol','targetHost','targetPort'].map(name=>[name,formValue(el('relay-forward-form'),name)])),
      enabled:check(el('relay-forward-form'),'enabled'),title:el('relay-submit').textContent,cancelHidden:el('relay-cancel-edit').hidden};
    const version=++editVersion,nodes=[...draft.nodes];let loaded=false;
    const {profileId,profileRevision,protocol}=draft;
    try {
    if(!await refresh(nodes)||version!==editVersion)return false;
    const path=nodes.map(nodeId=>candidates.relay.find(node=>node.id===nodeId));
    if(path.some((node,index)=>!node||!roleAllowed(node,index===0?'ingress':index===path.length-1?'egress':'transit')||
        !(path.length>2?multihopCapable(node):relayCapable(node)))||path.length>2&&!multihopEnabled)
      throw Error('组合中的用途、凭据、多跳能力或原执行开关不满足要求，请重新选择。');
    const profile=await loadProfile(profileId,profileRevision);
    if(version!==editVersion)return false;
    const protocols=protocol==='both'?['tcp','udp']:[protocol];
    if(profile.profileId!==profileId||profile.revision!==profileRevision||
        protocols.some(protocol=>!profile.config?.protocols?.includes(protocol)||path.some(node=>!node.policy.capabilities.includes(protocol))))
      throw Error('路径或精确传输修订不支持选择的业务协议');
    if(connection&&(!path[0].policy.allowedListenerAddresses.includes(connection.listenAddress)||
        !path[0].policy.allowedPorts.includes(connection.listenPort)))
      throw Error('画布入口监听已不在当前授权中，请重新读取线路资源');
    cancelEdit();
    const form=el('relay-forward-form');form.reset();
    el('relay-ingress').value=nodes[0];el('relay-egress').value=nodes.at(-1);populateIngress();
    el('relay-profile-select').value=profileId;pinnedProfileRevision=profileRevision;
    intermediates=nodes.slice(1,-1);form.elements.namedItem('protocol').value=protocol;
    form.elements.namedItem('enabled').checked=false;
    form.elements.namedItem('targetHost').value='';form.elements.namedItem('targetPort').value='';
    if(connection){
      el('relay-listen-address').value=connection.listenAddress;el('relay-listen-port').value=String(connection.listenPort);
      form.elements.namedItem('targetHost').value=connection.targetHost.trim();form.elements.namedItem('targetPort').value=String(connection.targetPort);
    }
    el('relay-submit').textContent='创建转发（当前组合）';el('relay-cancel-edit').hidden=false;
    invalidate();loaded=true;display('relay');return true;
    } finally {
      if(!loaded&&version===editVersion){
        editing=prior.editing;pinnedProfileRevision=prior.pinnedProfileRevision;intermediates=prior.intermediates;
        const form=el('relay-forward-form');
        el('relay-ingress').value=prior.values.ingressId;el('relay-egress').value=prior.values.egressId;populateIngress();
        for(const [name,value] of Object.entries(prior.values))form.elements.namedItem(name).value=value;
        form.elements.namedItem('enabled').checked=prior.enabled;
        el('relay-ingress').disabled=Boolean(editing);el('relay-submit').textContent=prior.title;el('relay-cancel-edit').hidden=prior.cancelHidden;
        invalidate();
      }
      finishTask(task);
      if(task.version===sessionVersion){el('relay-submit').disabled=true;el('relay-ingress').disabled=Boolean(editing);renderPath();}
    }
  }
  el('deployment-close').addEventListener('click',()=>el('deployment-dialog').close());
  el('deployment-dialog').addEventListener('close',()=>{if(!el('deployment-dialog').open){deploymentVersion++;deploymentId=null;}});
  el('deployment-refresh').addEventListener('click',()=>deployment(deploymentId).catch(e=>notify(e.message,true)));
  async function deployment(id){
    const version=++deploymentVersion;
    deploymentId=id;const [response,forward,history]=await Promise.all([request('GET','forwards/'+encodeURIComponent(id)+'/deployment'),request('GET','forwards/'+encodeURIComponent(id)),request('GET','forwards/'+encodeURIComponent(id)+'/revisions')]);
    if(version!==deploymentVersion||deploymentId!==id)return;
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
        if(version!==deploymentVersion||deploymentId!==id)return;
        const selected=revisions.find(r=>String(r.revision)===select.value);if(!confirm('将 r'+selected.revision+' 的配置作为新 revision 部署，重新检查权限与端口。继续？'))return;
        button.disabled=true;const result=await mutate('PUT','forwards/'+encodeURIComponent(id),{expectedRevision:forward.desired.revision,spec:selected.spec});
        el('deployment-dialog').close();await Promise.all([load('forwards'),load('operations'),loadOverview()]);notify('历史配置已提交，Operation '+(result.operationId??'无变更'));
      }catch(e){notify(e.message,true);button.disabled=false;}});
      el('deployment-nodes').append(label,button);
    }
    if(!el('deployment-dialog').open)el('deployment-dialog').showModal();
  }
  async function refreshCandidates(pinnedIds){
    const version=sessionVersion;
    invalidate();
    el('relay-preview').disabled=true;
    const ingress=el('relay-ingress').value;
    const preferred={address:el('relay-listen-address').value,port:el('relay-listen-port').value};
    const ids=pinnedIds??[ingress,el('relay-egress').value,el('relay-endpoint-node').value,...intermediates];
    const purposes=pinnedIds?Object.fromEntries(pinnedIds.map((nodeId,index)=>[nodeId,index===0?'ingress':index===pinnedIds.length-1?'egress':'transit'])):
      {...Object.fromEntries(intermediates.map(nodeId=>[nodeId,'transit'])),[ingress]:'ingress',[el('relay-egress').value]:'egress'};
    if (!await loadCandidates('relay',ids,purposes)||version!==sessionVersion) return false;
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
    const version=sessionVersion;
    const features=await request('GET','execution-capabilities');
    if(version!==sessionVersion)return false;
    multihopEnabled=features.multihopEnabled===true;
    await Promise.all([loadCatalog(),refreshProfiles()]);
    if(version!==sessionVersion)return false;
    if (!await refreshCandidates(pinnedIds)) return false;
    return true;
  }
  function clear() {
    for(const task of [...tasks.values()])finishTask(task);
    sessionVersion++;
    multihopEnabled=false;deploymentVersion++;deploymentId=null;cancelEdit();
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
  return {refresh,populateNodes,refreshCandidates,clear,edit,copy:item=>edit(item,true),loadPathDraft,deployment};
}

return initRelayConsole;
}
