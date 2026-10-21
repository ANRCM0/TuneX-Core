const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const roles = ['ingress','transit','egress'];
const roleNames = { ingress:'入口',transit:'中继',egress:'出口' };
const sourceNames = { private:'私有机器','admin-shared':'管理员共享','legacy-unclassified':'历史待分类' };
const kinds = ['nodes','forwards','path-templates','path-groups','ingress-groups'];
const clone = value => JSON.parse(JSON.stringify(value));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validRoles = value => value === null || Array.isArray(value) && value.length > 0 && value.length <= 3 &&
  new Set(value).size === value.length && value.every(role => roles.includes(role));

export function grantPortLimitsView(value) {
  if(value === null)return null;
  if(!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'allowedPorts,maxBindings' ||
      value.allowedPorts !== null && (!Array.isArray(value.allowedPorts) || !value.allowedPorts.length || value.allowedPorts.length > 65535 ||
        new Set(value.allowedPorts).size !== value.allowedPorts.length || value.allowedPorts.some(port=>!Number.isSafeInteger(port)||port<1||port>65535)) ||
      value.maxBindings !== null && (!Number.isSafeInteger(value.maxBindings) || value.maxBindings < 0))
    throw Error('共享端口限制响应无效');
  return { allowedPorts:value.allowedPorts === null ? null : [...value.allowedPorts].sort((a,b)=>a-b),maxBindings:value.maxBindings };
}

export function grantPortPatch({ mode, ports = '', maxBindings = '' }, parsePorts) {
  if(mode === 'keep')return {};
  if(mode === 'clear')return { portLimits:null };
  if(mode !== 'replace')throw Error('明确选择保留、替换或清空端口限制。');
  const raw = String(maxBindings).trim();
  if(raw && (!/^(0|[1-9][0-9]*)$/.test(raw) || !Number.isSafeInteger(Number(raw))))
    throw Error('物理绑定上限必须为空白或非负安全整数。');
  return { portLimits:grantPortLimitsView({ allowedPorts:String(ports).trim() ? parsePorts(ports) : null,maxBindings:raw === '' ? null : Number(raw) }) };
}

export function personalPortUsageView(value, identity) {
  const keys=['nodeId','scopeId','actorId','resourceSource','portLimits','occupiedBindings','remainingBindings','overLimit',
    'outOfRangeBindings','limitApplicability','counting','source','executionAuthorized','observedAt'];
  const count=item=>Number.isSafeInteger(item)&&item>=0;
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys.sort().join(',')||
      !['nodeId','scopeId','actorId'].every(key=>id(identity?.[key])&&value[key]===identity[key])||
      !['private','admin-shared'].includes(value.resourceSource)||!count(value.occupiedBindings)||!count(value.outOfRangeBindings)||
      value.outOfRangeBindings>value.occupiedBindings||typeof value.overLimit!=='boolean'||
      value.source!=='runtime-port-slots'||value.executionAuthorized!==false||!validTime(value.observedAt)||
      !value.counting||Object.keys(value.counting).sort().join(',')!=='includesDraining,includesInternal,tcpUdp,unit'||
      value.counting.unit!=='protocol+port'||value.counting.tcpUdp!=='separate'||
      value.counting.includesInternal!==true||value.counting.includesDraining!==true)
    throw Error('个人端口用量响应无效，未展示旧用量或推断可使用权限。');
  const limits=grantPortLimitsView(value.portLimits),maximum=limits?.maxBindings??null,privateNode=value.resourceSource==='private';
  if(value.limitApplicability!==(privateNode?'not-applicable':'shared-grant')||privateNode&&limits!==null||
      value.remainingBindings!==(maximum===null?null:Math.max(0,maximum-value.occupiedBindings))||
      value.overLimit!==(maximum!==null&&value.occupiedBindings>maximum)||!limits?.allowedPorts&&value.outOfRangeBindings!==0)
    throw Error('个人端口限制与用量不一致，请重新读取。');
  return {
    '机器':value.nodeId,'资源来源':sourceNames[value.resourceSource],'当前账号':value.actorId,
    '已占用物理端口':value.occupiedBindings,
    '个人绑定上限':privateNode?'私有机器不适用共享额度':maximum===null?'共享授权未设置数量上限':maximum,
    '剩余绑定数':privateNode?'不适用':value.remainingBindings===null?'未设置数量上限':value.remainingBindings,
    '数量是否超限':value.overLimit?'是':'否','超出允许端口范围的占用':value.outOfRangeBindings,
    '授权端口范围':privateNode?'不适用':limits?.allowedPorts?.join(', ')??'未额外限制，仍须满足机器政策',
    '计数口径':'TCP 与 UDP 分别计数；包含内部监听和原 owner 尚未释放的退役占用。',
    '读取时间':value.observedAt,'执行资格':'本次仅观察个人用量；实际操作仍须独立核验用途、权限、能力和机器政策。',
  };
}

export function initAdminResourceConsole({ request, byId, notify, detail, parsePorts, parseCidrs, canGovern, onChanged,
  document = globalThis.document, confirm = globalThis.confirm, randomUUID = ()=>crypto.randomUUID() }) {
  const el = name => byId('resource-' + name);
  let epoch=0,listVersion=0,grantVersion=0,classifyVersion=0,page=1,total=0,members=[];
  let grants=null,classification=null,pending=null,sending=false,provisioning=false,provisionUnknown=false;
  const controllers=new Set();
  const state = text => { el('command-state').textContent=text; };
  const authorize = () => { if(!canGovern())throw Error('当前工作空间所有者才能管理共享资源。'); };
  function text(tag,value,className) {
    const item=document.createElement(tag);if(value!==undefined)item.textContent=String(value);if(className)item.className=className;return item;
  }
  function appendCell(row,value) {const cell=text('td',value);row.append(cell);return cell;}
  function action(cell,label,run,token=epoch) {
    const button=text('button',label,'secondary');button.type='button';
    button.addEventListener('click',()=>{if(token===epoch)Promise.resolve().then(run).catch(error=>notify(error.message,true));});cell.append(button);
  }
  async function call(method,path,body,key) {
    authorize();
    const controller=new AbortController();controllers.add(controller);
    try{return await request(method,path,body,key,{signal:controller.signal,timeoutMs:15000});}
    finally{controllers.delete(controller);}
  }
  function controls() {
    const locked=Boolean(pending)||sending;
    for(const name of ['grant-node','grant-read','grant-actor','grant-allowed','grant-role-mode','grant-limit-mode','grant-ports','grant-max-bindings',
      'classify-kind','classify-id','classify-read','classify-source','classify-owner','classify-legacy'])el(name).disabled=locked;
    const grantDisabled=locked||!grants;
    for(const name of ['grant-actor','grant-allowed','grant-role-mode','grant-limit-mode'])el(name).disabled=grantDisabled;
    el('grant-role-mode').disabled=grantDisabled||!el('grant-allowed').checked;
    el('grant-limit-mode').disabled=grantDisabled||!el('grant-allowed').checked;
    for(const name of ['grant-ports','grant-max-bindings'])el(name).disabled=grantDisabled||!el('grant-allowed').checked||el('grant-limit-mode').value!=='replace';
    for(const role of roles)el('grant-role-'+role).disabled=grantDisabled||!el('grant-allowed').checked||el('grant-role-mode').value!=='selected';
    el('grant-save').disabled=locked||!grants||!id(el('grant-actor').value);
    el('replay').disabled=sending||!pending;
    el('discard').disabled=sending||!pending;
    el('classify-save').disabled=locked||!classification;
    el('classify-source').disabled=locked||!classification||classification.kind!=='nodes';
    el('classify-owner').disabled=locked||!classification||classification.kind==='nodes'&&el('classify-source').value==='admin-shared';
    el('classify-legacy').disabled=locked||!classification||classification.kind!=='nodes';
    el('classify-legacy').querySelector('option[value="retain"]').disabled=el('classify-source').value==='private';
    el('provision-submit').disabled=provisioning||provisionUnknown;
    el('provision-reset').hidden=!provisionUnknown;
    for(const field of el('provision-form').elements)if(field.id!=='resource-provision-reset')field.disabled=provisioning||provisionUnknown;
    el('provision-reset').disabled=provisioning;
    el('prev').disabled=page<=1;el('next').disabled=page>=Math.max(1,Math.ceil(total/25));
  }
  function memberOptions(select,includeGrantActors=false) {
    const previous=select.value;select.replaceChildren();
    const empty=text('option','选择成员');empty.value='';select.append(empty);
    const values=new Map(members.map(member=>[member.actorId,member]));
    if(includeGrantActors)for(const grant of grants?.grants??[])if(!values.has(grant.actorId))values.set(grant.actorId,{actorId:grant.actorId,active:false,role:'unknown'});
    for(const member of values.values()){
      const option=text('option',member.actorId+' · '+({owner:'所有者',manager:'成员管理者',viewer:'只读成员',removed:'已移除',unknown:'现有授权，成员不可见'})[member.role]+(member.active?'':' · 非有效成员'));
      option.value=member.actorId;option.selected=previous===member.actorId;
      if(!includeGrantActors)option.disabled=!member.active||!['owner','manager'].includes(member.role);
      select.append(option);
    }
  }
  async function readMembers(token=epoch) {
    const data=await call('GET','members');
    if(token!==epoch)return false;
    if(!Array.isArray(data.members)||new Set(data.members.map(member=>member.actorId)).size!==data.members.length||
        data.members.some(member=>!id(member.actorId)||!positive(member.revision)||typeof member.active!=='boolean'||!['owner','manager','viewer','removed'].includes(member.role)))
      throw Error('成员列表响应无效');
    members=data.members;memberOptions(el('grant-actor'),true);memberOptions(el('classify-owner'));return true;
  }
  async function refresh() {
    const token=epoch,version=++listVersion,requestedPage=page,source=el('source').value;
    try{
      authorize();el('list-state').textContent='正在读取治理可见资源……';
      const data=await call('GET','nodes?page='+requestedPage+'&limit=25'+(source?'&resourceSource='+encodeURIComponent(source):''));
      if(token!==epoch||version!==listVersion)return;
      if(data.page!==requestedPage||data.limit!==25||!Number.isSafeInteger(data.total)||data.total<0||!Array.isArray(data.items)||data.items.length>25||
          data.items.some(node=>!id(node.id)||!Object.hasOwn(sourceNames,node.resourceSource)||source&&node.resourceSource!==source||
            (node.resourceSource==='private'?!id(node.ownerActorId):node.ownerActorId!==null)))throw Error('治理资源列表响应无效');
      total=data.total;el('rows').replaceChildren();
      for(const node of data.items){
        const row=text('tr');appendCell(row,node.id);appendCell(row,sourceNames[node.resourceSource]);appendCell(row,node.ownerActorId??'无私人所有者');
        const cell=appendCell(row);
        if(node.resourceSource==='admin-shared')action(cell,'管理共享授权',()=>openGrant(node.id),token);
        if(node.resourceSource==='legacy-unclassified')action(cell,'明确分类',()=>openClassification('nodes',node.id),token);
        el('rows').append(row);
      }
      if(!data.items.length){const row=text('tr'),cell=appendCell(row,'当前筛选无资源。共享接入后请为具体成员授权，分类不会自动授予执行权。');cell.colSpan=4;el('rows').append(row);}
      el('list-state').textContent='第 '+data.page+' 页，共 '+data.total+' 条；治理可见不代表当前账号有执行使用权。';controls();
    }catch(error){if(token===epoch&&version===listVersion){el('list-state').textContent='资源列表不可用。';notify(error.message,true);}}
  }
  function limitsText(value) {
    return value===null?'未设置额外端口或额度限制（仍受节点策略限制）':
      '允许端口：'+(value.allowedPorts===null?'沿用节点策略':value.allowedPorts.join(', '))+'；物理绑定上限：'+(value.maxBindings===null?'未额外限制':value.maxBindings);
  }
  function selectGrantActor() {
    const grant=grants?.grants.find(item=>item.actorId===el('grant-actor').value);
    el('grant-allowed').checked=true;el('grant-role-mode').value=grant?.allowedRoles===null||!grant?'all':'selected';
    for(const role of roles)el('grant-role-'+role).checked=grant?.allowedRoles?.includes(role)??false;
    el('grant-limit-mode').value='keep';el('grant-ports').value=grant?.portLimits?.allowedPorts?.join(',')??'';
    el('grant-max-bindings').value=grant?.portLimits?.maxBindings===null||!grant?.portLimits?'':String(grant.portLimits.maxBindings);
    el('grant-current').textContent=(grant?'当前有此授权。':'当前没有此授权。')+' '+limitsText(grant?.portLimits??null);
    controls();
  }
  async function openGrant(nodeId=el('grant-node').value.trim()) {
    if(pending||sending)return;
    const token=epoch,version=++grantVersion;grants=null;el('grant-revision').value='';el('grant-rows').replaceChildren();controls();
    try{
      authorize();if(!id(nodeId))throw Error('选择有效的共享节点。');el('grant-node').value=nodeId;
      const [data]=await Promise.all([call('GET','nodes/'+encodeURIComponent(nodeId)+'/grants'),readMembers(token)]);
      if(token!==epoch||version!==grantVersion)return;
      if(data.nodeId!==nodeId||!positive(data.revision)||!Array.isArray(data.grants)||!Array.isArray(data.actorIds)||
          data.actorIds.length!==data.grants.length||new Set(data.actorIds).size!==data.actorIds.length||new Set(data.grants.map(grant=>grant.actorId)).size!==data.grants.length||
          data.grants.some(grant=>!id(grant.actorId)||!data.actorIds.includes(grant.actorId)||!validRoles(grant.allowedRoles)||!Object.hasOwn(grant,'portLimits')))
        throw Error('共享授权响应无效，需要包含用途与端口限制的新契约。');
      grants={...data,grants:data.grants.map(grant=>({...grant,portLimits:grantPortLimitsView(grant.portLimits)}))};
      el('grant-revision').value=String(data.revision);memberOptions(el('grant-actor'),true);selectGrantActor();
      for(const grant of grants.grants){
        const row=text('tr');appendCell(row,grant.actorId);appendCell(row,grant.allowedRoles===null?'全部用途':grant.allowedRoles.map(role=>roleNames[role]).join(' / '));
        appendCell(row,limitsText(grant.portLimits));action(appendCell(row),'编辑',()=>{if(pending||sending)return;el('grant-actor').value=grant.actorId;selectGrantActor();},token);el('grant-rows').append(row);
      }
      state('已读取节点共享授权修订 r'+data.revision+'。更新用途默认保留端口限制，服务端在原事务内重新校验。');
      el('grant-panel').scrollIntoView({block:'start',behavior:'smooth'});controls();
    }catch(error){if(token===epoch&&version===grantVersion){state('共享授权读取失败，没有准备写命令。');notify(error.message,true);controls();}}
  }
  function receiptValid(command,value) {
    if(!value||typeof value!=='object')return false;
    if(command.kind==='grant')return value.nodeId===command.nodeId&&value.actorId===command.actorId&&
      positive(value.revision)&&[command.body.expectedRevision,command.body.expectedRevision+1].includes(value.revision)&&value.allowed===command.body.allowed&&
      validRoles(value.allowedRoles)&&same(value.allowedRoles,command.body.allowedRoles)&&same(grantPortLimitsView(value.portLimits),command.expectedPortLimits)&&
      Array.isArray(value.operationIds)&&value.operationIds.every(id)&&(value.latestAuthorizationUntil===null||validTime(value.latestAuthorizationUntil));
    if(command.resourceKind==='nodes')return value.nodeId===command.resourceId&&value.resourceRevision===command.body.expectedRevision+1&&
      positive(value.policyRevision)&&Array.isArray(value.operationIds)&&value.operationIds.every(id)&&
      (value.latestAuthorizationUntil===null||validTime(value.latestAuthorizationUntil));
    const key=command.resourceKind==='forwards'?'forwardId':command.resourceKind==='path-templates'?'templateId':'groupId';
    return value[key]===command.resourceId&&value.revision===command.body.expectedRevision&&value.ownerActorId===command.body.ownerActorId&&value.classified===true&&
      (command.resourceKind!=='forwards'||value.operationId===null);
  }
  async function sendPending(replay=false) {
    if(sending||!pending)return;
    const command=pending,token=epoch;
    try{
      authorize();
      if(replay&&!confirm('仅重放原命令键、原修订和原内容？当前权限拒绝不能证明原命令未提交。'))return;
      sending=true;controls();state('正在发送原子资源命令……');
      const result=await call(command.method,command.path,clone(command.body),command.key);
      if(token!==epoch||pending!==command)return;
      if(!receiptValid(command,result))throw Error('命令回执无效，原结果仍不确定。');
      el('command-result').textContent=JSON.stringify(result,null,2);pending=null;sending=false;grants=null;classification=null;
      el('grant-revision').value='';el('classify-revision').value='';
      state('资源命令已接收。原 Operation 可能仍需重协调或退役，回执不是即时生效证明；继续编辑前重新读取。');controls();
      await Promise.resolve().then(onChanged).catch(error=>notify('命令已接收，但列表刷新失败：'+error.message,true));
    }catch(error){if(token===epoch){
      sending=false;
      if(!replay&&[400,401,403,404,409,413,422,429].includes(error.httpStatus)){pending=null;grants=null;classification=null;}
      state(pending?'结果不确定：仅可明确重放原键、原内容；不要更改修订后重发。':'原命令被明确拒绝，请重新读取当前状态并准备。');
      controls();notify(error.message,true);
    }}
  }
  async function saveGrant() {
    if(pending||sending||!grants)return;
    try{
      authorize();const actorId=el('grant-actor').value,nodeId=grants.nodeId,allowed=el('grant-allowed').checked;
      if(!id(actorId))throw Error('选择授权成员。');
      const allowedRoles=!allowed||el('grant-role-mode').value==='all'?null:roles.filter(role=>el('grant-role-'+role).checked);
      if(!validRoles(allowedRoles))throw Error('至少选择一种用途，或明确允许全部用途。');
      const patch=allowed?grantPortPatch({mode:el('grant-limit-mode').value,ports:el('grant-ports').value,maxBindings:el('grant-max-bindings').value},parsePorts):{};
      const current=grants.grants.find(grant=>grant.actorId===actorId);
      const expectedPortLimits=allowed?(Object.hasOwn(patch,'portLimits')?patch.portLimits:current?.portLimits??null):null;
      const body={expectedRevision:grants.revision,allowed,allowedRoles,...patch};
      if(!confirm((allowed?'保存共享用途与限制？':'撤销该成员的共享用途？')+'端口或额度收紧可能触发原执行资源重协调。'))return;
      pending={kind:'grant',nodeId,actorId,expectedPortLimits,method:'PUT',path:'nodes/'+encodeURIComponent(nodeId)+'/grants/'+encodeURIComponent(actorId),body:clone(body),key:randomUUID()};
      await sendPending();
    }catch(error){notify(error.message,true);}
  }
  async function openClassification(kind=el('classify-kind').value,resourceId=el('classify-id').value.trim()) {
    if(pending||sending)return;
    const token=epoch,version=++classifyVersion;classification=null;el('classify-revision').value='';el('classify-preview').textContent='';controls();
    try{
      authorize();if(!kinds.includes(kind)||!id(resourceId))throw Error('选择资源类型与有效标识。');
      el('classify-kind').value=kind;el('classify-id').value=resourceId;
      const [data]=await Promise.all([call('GET',kind+'/'+encodeURIComponent(resourceId)),readMembers(token)]);
      if(token!==epoch||version!==classifyVersion)return;
      let revision,ownerActorId=null;
      if(kind==='nodes'){
        if(data.nodeId!==resourceId||data.detail!=='full'||data.resourceSource!=='legacy-unclassified'||data.ownerActorId!==null||!positive(data.resourceRevision))
          throw Error('只有历史待分类节点可进入此操作。');
        revision=data.resourceRevision;
      }else if(kind==='forwards'){
        if(!positive(data.desired?.revision))throw Error('Forward 当前修订不可用。');revision=data.desired.revision;
      }else{
        const key=kind==='path-templates'?'templateId':'groupId';
        if(data[key]!==resourceId||!positive(data.currentRevision)||data.ownerActorId!==null)throw Error('只有尚无所有者的原资源可分类。');
        revision=data.currentRevision;ownerActorId=data.ownerActorId;
      }
      classification={kind,resourceId,revision};el('classify-revision').value=String(revision);
      el('classify-source').value='';el('classify-legacy').value='';memberOptions(el('classify-owner'));el('classify-owner').value='';
      el('classify-preview').textContent=JSON.stringify({kind,id:resourceId,expectedRevision:revision,
        currentSource:kind==='nodes'?'legacy-unclassified':undefined,currentOwner:kind==='forwards'?'原查询未返回；服务端提交时核对':ownerActorId},null,2);
      el('classification-panel').open=true;el('classification-panel').scrollIntoView({block:'start',behavior:'smooth'});
      state('已读取分类所需的当前修订。明确选择所有者与旧授权处理方式；不会清除受保护历史。');controls();
    }catch(error){if(token===epoch&&version===classifyVersion){state('分类读取失败，没有准备写命令。');notify(error.message,true);controls();}}
  }
  async function classify() {
    if(pending||sending||!classification)return;
    try{
      authorize();const resource=classification,source=el('classify-source').value,ownerActorId=el('classify-owner').value;
      let body={expectedRevision:resource.revision,ownerActorId};
      if(resource.kind==='nodes'){
        const legacyGrants=el('classify-legacy').value;
        if(!['private','admin-shared'].includes(source)||!['discard','retain'].includes(legacyGrants)||source==='private'&&legacyGrants!=='discard')
          throw Error('明确选择节点归属与旧授权处理。私人节点必须移除旧委托。');
        body={...body,source,ownerActorId:source==='admin-shared'?null:ownerActorId,legacyGrants};
      }
      if(body.ownerActorId!==null&&!id(body.ownerActorId))throw Error('选择有效的私人资源所有者。');
      if(!confirm('按刚读取的精确修订分类此历史资源？这不是转移已归属资源，也不授予执行权；旧资源将由原服务重新核验。'))return;
      pending={kind:'classification',resourceKind:resource.kind,resourceId:resource.resourceId,method:'POST',
        path:resource.kind+'/'+encodeURIComponent(resource.resourceId)+(resource.kind==='nodes'?'/classify':'/classify-owner'),body:clone(body),key:randomUUID()};
      await sendPending();
    }catch(error){notify(error.message,true);}
  }
  async function provision(event) {
    event.preventDefault();if(provisioning||provisionUnknown)return;
    const token=epoch;
    try{
      authorize();const form=el('provision-form'),field=name=>form.elements.namedItem(name);
      const policy={allowedListenerAddresses:[field('address').value],allowedPorts:parsePorts(field('ports').value),
        allowedDestinationCidrs:parseCidrs(field('cidrs').value),allowMetadataTargets:field('metadata').checked,egressPolicyRevision:1};
      if(!confirm('为当前工作空间创建管理员共享节点并签发一次性接入凭据？它不会归为你的私人机器；成员使用前仍需明确共享授权。'))return;
      provisioning=true;controls();el('provision-state').textContent='正在创建共享节点……';
      const result=await call('POST','shared-nodes',policy);
      if(token!==epoch)return;
      if(!id(result.nodeId)||!/^[A-Za-z0-9_-]{32,128}$/.test(result.enrollmentToken)||!validTime(result.expiresAt))throw Error('接入回执无效，结果不确定。');
      el('provision-state').textContent='共享节点已创建：'+result.nodeId+'。请完成受信 Agent 接入，再在下方为具体成员授权。';
      detail('管理员共享节点 · 一次性接入凭据',{nodeId:result.nodeId,enrollmentToken:result.enrollmentToken,expiresAt:result.expiresAt},result.enrollmentToken);
      el('grant-node').value=result.nodeId;page=1;el('source').value='admin-shared';
      await refresh();
    }catch(error){if(token===epoch){
      provisionUnknown=provisioning&&![400,401,403,404,409,413,422,429].includes(error.httpStatus);
      el('provision-state').textContent=provisionUnknown?'接入结果不确定。请先刷新共享节点列表核对；此接入接口没有幂等重放，页面不会自动再创建。':'共享接入未完成，请检查输入和当前权限。';notify(error.message,true);
    }}finally{if(token===epoch){provisioning=false;controls();}}
  }
  function invalidateGrant() {if(pending||sending)return;grantVersion++;grants=null;el('grant-revision').value='';el('grant-rows').replaceChildren();el('grant-current').textContent='';controls();}
  function invalidateClassification() {if(pending||sending)return;classifyVersion++;classification=null;el('classify-revision').value='';el('classify-preview').textContent='';controls();}
  el('provision-form').addEventListener('submit',provision);
  el('provision-reset').addEventListener('click',()=>{
    if(provisioning||!provisionUnknown||!confirm('已核对共享节点列表和原接入结果，明确开始另一条接入？这不会撤销或重放原请求。'))return;
    provisionUnknown=false;el('provision-form').reset();el('provision-state').textContent='可准备新的共享接入。';controls();
  });
  el('refresh').addEventListener('click',refresh);el('source').addEventListener('change',()=>{page=1;return refresh();});
  for(const [name,direction] of [['prev',-1],['next',1]])el(name).addEventListener('click',()=>{if(el(name).disabled)return;page+=direction;return refresh();});
  el('grant-node').addEventListener('input',invalidateGrant);el('grant-read').addEventListener('click',()=>openGrant());
  el('grant-actor').addEventListener('change',()=>{if(!pending&&!sending)selectGrantActor();});
  for(const name of ['grant-allowed','grant-role-mode','grant-limit-mode'])el(name).addEventListener('change',controls);
  el('grant-save').addEventListener('click',saveGrant);
  el('classify-read').addEventListener('click',()=>openClassification());el('classify-save').addEventListener('click',classify);
  for(const name of ['classify-kind','classify-id'])el(name).addEventListener('input',invalidateClassification);
  el('classify-source').addEventListener('change',()=>{if(!pending&&!sending){el('classify-legacy').value='';controls();}});
  el('replay').addEventListener('click',()=>sendPending(true));
  el('discard').addEventListener('click',()=>{
    if(sending||!pending||!confirm('仅放弃当前页保存的命令键与内容？这不能撤销已提交的原命令。'))return;
    pending=null;grants=null;classification=null;state('本地命令已放弃，请重新读取服务器记录。');controls();
  });
  function clear() {
    epoch++;listVersion++;grantVersion++;classifyVersion++;for(const controller of controllers)controller.abort();controllers.clear();
    page=1;total=0;members=[];grants=null;classification=null;pending=null;sending=false;provisioning=false;provisionUnknown=false;
    el('provision-form').reset();el('provision-state').textContent='';el('source').value='admin-shared';el('rows').replaceChildren();el('list-state').textContent='进入资源管理后读取治理可见节点。';
    for(const name of ['grant-node','grant-revision','grant-current','classify-id','classify-revision'])el(name)[name.endsWith('current')?'textContent':'value']='';
    el('grant-rows').replaceChildren();el('grant-role-mode').value='all';el('grant-limit-mode').value='keep';el('grant-ports').value='';el('grant-max-bindings').value='';
    el('grant-allowed').checked=true;for(const role of roles)el('grant-role-'+role).checked=false;
    el('classify-kind').value='nodes';el('classify-source').value='';el('classify-legacy').value='';el('classify-preview').textContent='';el('classification-panel').open=false;
    memberOptions(el('grant-actor'),true);memberOptions(el('classify-owner'));el('command-result').textContent='';state('每次写操作使用原接口、原修订与独立命令键。');controls();
  }
  clear();return {refresh,clear,openGrant,openClassification};
}
