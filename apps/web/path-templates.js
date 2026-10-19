const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const number = (value, zero = false) => new RegExp(zero ? '^(0|[1-9][0-9]*)$' : '^[1-9][0-9]*$').test(value) && Number(value) <= 64;
const hash = value => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
function configView(value) {
  if (value?.version !== 1 || !Array.isArray(value.nodes) || value.nodes.length < 2 || value.nodes.length > 8 ||
      value.nodes.some(node => !id(node)) || new Set(value.nodes).size !== value.nodes.length ||
      !Array.isArray(value.protocols) || !value.protocols.length || value.protocols.length > 2 ||
      value.protocols.some(p => !['tcp','udp'].includes(p)) || new Set(value.protocols).size !== value.protocols.length ||
      !Array.isArray(value.endpoints) || value.endpoints.length !== value.nodes.length - 1 ||
      value.endpoints.some((item,index) => item.nodeId !== value.nodes[index + 1] || !Number.isSafeInteger(item.revision) || item.revision < 1) ||
      !id(value.transport?.profileId) || !Number.isSafeInteger(value.transport.configRevision) || value.transport.configRevision < 1)
    throw Error('Invalid native PathTemplate configuration.');
  return { version: 1, nodes: [...value.nodes], protocols: [...value.protocols], endpoints: value.endpoints.map(item => ({nodeId:item.nodeId,revision:item.revision})),
    transport: { profileId: value.transport.profileId, configRevision: value.transport.configRevision } };
}

function managementView(value) {
  const view=value?.management;
  if(view?.version!==1||view.kind!=='native-logical-tunnel'||view.backingResource!=='path-template'||
      view.configurationReuse!==true||view.physicalConnectionSharing!==false||view.allocationOwner!=='forward-runtime'||view.health!=='not-assessed')
    throw Error('Invalid logical tunnel management view.');
}

export function initPathTemplates({request,byId,notify,tunnelManagement=false,onSelectDefinition,document=globalThis.document,confirm=globalThis.confirm,randomUUID=()=>crypto.randomUUID()}) {
  const el = name => byId('path-template-' + name), fields = ['id','expected','nodes','protocol','profile','profile-revision','read-revision'];
  const collection=tunnelManagement?'tunnels':'path-templates';
  let epoch=0,readVersion=0,listVersion=0,captureVersion=0,page=1,total=0,pending=null,sending=false,locks=null,stamp=null,inspected=null;
  const controllers=new Set();
  async function call(method,resource,body,key) {
    const controller=new AbortController();controllers.add(controller);
    try {return await request(method,resource,body,key,{signal:controller.signal,timeoutMs:5000});}
    finally {controllers.delete(controller);}
  }
  const resource = template => collection+'/' + encodeURIComponent(template);
  function definition(value=null) {
    inspected=value;
    if(!tunnelManagement)return;
    const topology=byId('tunnel-definition-topology'),summary=byId('tunnel-definition-summary');
    topology.replaceChildren();
    if(value){
      const config=value.config;
      for(const [index,nodeId] of config.nodes.entries()){
        const item=document.createElement('li'),role=index===0?'Ingress':index===config.nodes.length-1?'Egress':'Transit';
        item.textContent=role+' / '+nodeId+(index?' / Endpoint r'+config.endpoints[index-1].revision:'');topology.append(item);
      }
      summary.textContent=value.templateId+' / r'+value.revision+' (current r'+value.currentRevision+') / '+(value.archived?'archived':'published')+
        ' / '+config.protocols.join('+').toUpperCase()+' / Profile '+config.transport.profileId+' @ '+config.transport.configRevision+
        '. Reusable configuration only; each Forward owns independent runtime resources. Health not assessed.';
    }else summary.textContent='Inspect a published logical tunnel to see its locked path. Draft changes are not a deployed tunnel.';
    byId('path-template-use').disabled=!value||value.archived||Boolean(pending)||typeof onSelectDefinition!=='function';
  }
  function state(message) {el('state').textContent=message;}
  function controls() {
    for(const name of fields)el(name).disabled=Boolean(pending);
    el('capture').disabled=Boolean(pending);el('inspect').disabled=Boolean(pending);
    el('publish').disabled=sending||pending?.method==='DELETE';el('archive').disabled=sending||pending?.method==='PUT';
    el('publish').textContent=pending?.method==='PUT'?'Replay Same Publish':'Publish Immutable Revision';
    el('archive').textContent=pending?.method==='DELETE'?'Replay Same Archive':tunnelManagement?'Archive Tunnel':'Archive Template';
    el('discard').disabled=!pending;
    if(tunnelManagement)byId('path-template-use').disabled=Boolean(pending)||!inspected||inspected.archived||typeof onSelectDefinition!=='function';
  }
  function draft() {
    const nodes=el('nodes').value.split(/[\r\n,]+/).map(value=>value.trim()).filter(Boolean);
    const protocol=el('protocol').value,profileId=el('profile').value.trim(),revision=el('profile-revision').value;
    if(nodes.length<2||nodes.length>8||nodes.some(node=>!id(node))||new Set(nodes).size!==nodes.length||
        !['both','tcp','udp'].includes(protocol)||!id(profileId)||!/^[1-9][0-9]*$/.test(revision)||!Number.isSafeInteger(Number(revision)))
      throw Error('Choose 2-8 ordered distinct Nodes, business protocols and an exact Profile revision.');
    return {version:1,nodes,protocols:protocol==='both'?['tcp','udp']:[protocol],transport:{profileId,configRevision:Number(revision)}};
  }
  function invalidate() {
    if(pending)return;
    captureVersion++;readVersion++;locks=null;stamp=null;definition();el('endpoints').textContent='';el('record').textContent='';
    state('Metadata only. Capture current Endpoint revisions before publishing. No binding or execution authorization.');
  }
  async function capture() {
    if(pending)return;const version=++captureVersion,connection=epoch;
    readVersion++;definition();el('record').textContent='';
    try {
      const proposal=draft(),signature=JSON.stringify(proposal),endpoints=[];
      locks=null;stamp=null;el('endpoints').textContent='';state('Reading bounded current Endpoint metadata...');
      for(const nodeId of proposal.nodes.slice(1)) {
        const endpoint=await call('GET','nodes/'+encodeURIComponent(nodeId)+'/relay-endpoint');
        if(connection!==epoch||version!==captureVersion||pending)return;
        if(endpoint.nodeId!==nodeId||!Number.isSafeInteger(endpoint.revision)||endpoint.revision<1)throw Error('Invalid Endpoint revision response.');
        endpoints.push({nodeId,revision:endpoint.revision});
      }
      if(signature!==JSON.stringify(draft()))return;
      locks=endpoints;stamp=signature;el('endpoints').textContent=JSON.stringify(endpoints,null,2);
      state('Endpoint revisions captured, not reserved or authorized. Publish rechecks explicit Node/Profile grants and exact references.');
    }catch(error){if(connection===epoch&&version===captureVersion){state('Endpoint capture failed; no template write.');notify(error.message,true);}}
  }
  async function inspect(template=el('id').value.trim(),requested=el('read-revision').value) {
    if(pending)return;const connection=epoch,version=++readVersion;
    captureVersion++;locks=null;stamp=null;definition();el('endpoints').textContent='';el('record').textContent='';
    try {
      if(!id(template)||requested!==''&&!number(requested))throw Error('Choose a template ID and an exact revision or blank for current.');
      const result=await call('GET',resource(template)+(requested?'?revision='+requested:''));
      if(connection!==epoch||version!==readVersion||pending)return;
      if(tunnelManagement){managementView(result);if(result.tunnelId!==template)throw Error('Tunnel backing identity mismatch.');}
      if(result.templateId!==template||!Number.isSafeInteger(result.currentRevision)||result.currentRevision<1||result.currentRevision>64||
          !Number.isSafeInteger(result.revision)||result.revision<1||result.revision>result.currentRevision||result.revision!==(requested?Number(requested):result.currentRevision)||
          typeof result.archived!=='boolean'||!hash(result.configDigest)||!hash(result.profileDigest)||result.executionAuthorized!==false||result.bindingCreated!==false||result.reserved!==false)
        throw Error('Invalid immutable PathTemplate response.');
      const config=configView(result.config);captureVersion++;
      el('id').value=template;el('expected').value=String(result.currentRevision);el('nodes').value=config.nodes.join('\n');
      el('profile').value=config.transport.profileId;el('profile-revision').value=String(config.transport.configRevision);
      el('protocol').value=config.protocols.length===2?'both':config.protocols[0];
      locks=config.endpoints;stamp=JSON.stringify(draft());el('endpoints').textContent=JSON.stringify(locks,null,2);
      definition({...result,config});
      el('record').textContent=JSON.stringify({templateId:template,revision:result.revision,currentRevision:result.currentRevision,archived:result.archived,
        config,configDigest:result.configDigest,profileDigest:result.profileDigest,executionAuthorized:false,bindingCreated:false,reserved:false},null,2);
      state('Inspecting r'+result.revision+' / current r'+result.currentRevision+(result.archived?' / archived':'')+'. Historical config never updates a Forward or grants execution.');
    }catch(error){if(connection===epoch&&version===readVersion){el('record').textContent='';notify(error.message,true);}}
  }
  async function list() {
    const connection=epoch,version=++listVersion,requestedPage=page;
    el('rows').replaceChildren();el('prev').disabled=el('next').disabled=true;el('page').textContent='Reading bounded template metadata...';
    try {
      const prefix=el('prefix').value.trim();if(prefix&&!id(prefix))throw Error('Invalid template prefix.');
      const data=await call('GET',collection+'?page='+requestedPage+'&limit=25'+(prefix?'&prefix='+encodeURIComponent(prefix):''));
      if(connection!==epoch||version!==listVersion)return;
      if(tunnelManagement){managementView(data);if(!Array.isArray(data.items)||data.items.some(item=>item.tunnelId!==item.templateId))throw Error('Tunnel list backing identity mismatch.');}
      if(data.page!==requestedPage||data.limit!==25||!Number.isSafeInteger(data.total)||data.total<0||data.total>128||
          !Array.isArray(data.items)||data.items.length>25||new Set(data.items.map(item=>item.templateId)).size!==data.items.length||
          data.items.some(item=>!id(item.templateId)||!item.templateId.startsWith(prefix)||!Number.isSafeInteger(item.currentRevision)||item.currentRevision<1||item.currentRevision>64||typeof item.archived!=='boolean'))
        throw Error('Invalid bounded template list.');
      total=data.total;el('rows').replaceChildren();
      for(const item of data.items) {
        const row=document.createElement('tr');
        for(const text of [item.templateId,'r'+item.currentRevision+(item.archived?' / archived':'')]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}
        const cell=document.createElement('td'),button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Inspect Current';
        button.addEventListener('click',()=>{if(connection===epoch&&version===listVersion&&!pending)return inspect(item.templateId,'');});cell.append(button);row.append(cell);el('rows').append(row);
      }
      el('page').textContent='Page '+page+' / total '+total+'. Metadata only, not current authorization.';
      el('prev').disabled=page<=1;el('next').disabled=page>=Math.max(1,Math.ceil(total/25));
    }catch(error){if(connection===epoch&&version===listVersion){el('page').textContent='Template list unavailable.';notify(error.message,true);}}
  }
  async function command(method) {
    if(sending)return;const connection=epoch,replay=Boolean(pending);
    try {
      if(pending) {
        if(pending.method!==method)return;
        if(!confirm('Replay only the exact original key/body. A current denial does not prove that the original was uncommitted. Continue?'))return;
      }else{
        const template=el('id').value.trim(),expected=el('expected').value;
        if(!id(template)||!number(expected,method==='PUT'))throw Error('A valid template ID and explicit current CAS revision are required.');
        let body={expectedRevision:Number(expected)};
        if(method==='PUT'){
          const proposal=draft();if(!locks||stamp!==JSON.stringify(proposal))throw Error('Capture or inspect exact Endpoint revisions for this unchanged proposal first.');
          body={...body,config:configView({...proposal,endpoints:locks})};
        }
        if(!confirm(method==='PUT'?'Publish metadata only? No Forward binding, switch, reservation or execution will be created.':'Archive this identifier permanently? History remains; running expanded rules are not changed.'))return;
        pending={method,template,resource:resource(template),body:JSON.parse(JSON.stringify(body)),key:randomUUID()};
        readVersion++;captureVersion++;definition();
      }
      sending=true;controls();state('Sending original metadata command...');
      const original=pending,result=await call(original.method,original.resource,original.body,original.key);
      if(connection!==epoch||pending!==original)return;
      if(result.templateId!==original.template||!Number.isSafeInteger(result.revision)||result.revision<1||result.revision>64||
          !hash(result.configDigest)||result.archived!==(original.method==='DELETE')||typeof result.changed!=='boolean'||
          result.revision!==original.body.expectedRevision+(original.method==='PUT'&&result.changed?1:0))throw Error('Invalid metadata acceptance; original outcome remains uncertain.');
      pending=null;sending=false;el('expected').value=String(result.revision);controls();
      state((result.archived?'Archived':'Published')+' r'+result.revision+'. No Forward binding or execution was created.');
      await list();
    }catch(error){if(connection===epoch){
      sending=false;
      if(pending&&!replay&&[400,401,403,404,409,413,422,429].includes(error.httpStatus)){pending=null;state('Rejected; no accepted metadata outcome returned.');}
      else if(pending)state('uncertain: original command may have committed. Only explicit same-key/body replay is available.');
      controls();notify(error.message,true);
    }}
  }
  el('capture').addEventListener('click',capture);el('inspect').addEventListener('click',()=>inspect());
  el('publish').addEventListener('click',()=>command('PUT'));el('archive').addEventListener('click',()=>command('DELETE'));
  el('form').addEventListener('input',invalidate);el('form').addEventListener('change',invalidate);
  el('query').addEventListener('click',()=>{page=1;return list();});
  for(const [name,direction] of [['prev',-1],['next',1]])el(name).addEventListener('click',()=>{
    if(el(name).disabled)return;page=Math.max(1,Math.min(Math.max(1,Math.ceil(total/25)),page+direction));return list();
  });
  function clear() {
    epoch++;readVersion++;listVersion++;captureVersion++;for(const controller of controllers)controller.abort();controllers.clear();
    pending=null;sending=false;locks=null;stamp=null;page=1;total=0;definition();
    for(const name of fields)el(name).value=name==='expected'?'0':name==='protocol'?'both':'';
    el('prefix').value='';el('rows').replaceChildren();el('record').textContent='';el('endpoints').textContent='';el('page').textContent='';
    el('prev').disabled=el('next').disabled=true;controls();state('Metadata authoring only. Use the separate explicit path panel for Forward bindings or switching.');
  }
  el('discard').addEventListener('click',()=>{if(pending&&confirm('Discard tab-memory command history? This cannot cancel or roll back a committed command.'))clear();});
  if(tunnelManagement)byId('path-template-use').addEventListener('click',()=>{
    if(!pending&&inspected&&!inspected.archived&&typeof onSelectDefinition==='function'){
      try {onSelectDefinition(JSON.parse(JSON.stringify(inspected)));}catch(error){notify(error.message,true);}
    }
  });
  clear();return {list,inspect,capture,clear};
}

export function initPathSwitch({request,byId,notify,preparePathBatch,tunnelManagement=false,document=globalThis.document,confirm=globalThis.confirm,randomUUID=()=>crypto.randomUUID()}) {
  const el=name=>byId('path-switch-'+name),fields=['forward','expected','template','revision'];
  const counter=value=>/^[1-9][0-9]*$/.test(value)&&Number.isSafeInteger(Number(value));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const canonical=value=>JSON.stringify(value&&typeof value==='object'?(Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):
    Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))]))):value);
  const equal=(a,b)=>canonical(a)===canonical(b);
  let epoch=0,version=0,listVersion=0,page=1,total=0,locked=null,proposal=null,pending=null,sending=false;
  const selected=new Map(),checkboxes=new Set();let batchTarget=null;
  const controllers=new Set();
  async function call(method,path,body,key) {
    const controller=new AbortController();controllers.add(controller);
    try{return await request(method,path,body,key,{signal:controller.signal,timeoutMs:5000});}finally{controllers.delete(controller);}
  }
  const state=message=>{el('state').textContent=message;};
  const resource=forward=>'forwards/'+encodeURIComponent(forward);
  const collection=tunnelManagement?'tunnels':'path-templates',bindingResource=tunnelManagement?'tunnel-binding':'path-binding',previewResource=tunnelManagement?'tunnel-preview':'path-preview';
  function selectionState(){
    el('batch-selection').textContent=selected.size+' / 10 selected from this path impact page';
    el('batch-prepare').disabled=Boolean(pending)||!selected.size||!batchTarget||typeof preparePathBatch!=='function';
  }
  function clearSelection(){selected.clear();for(const box of checkboxes)box.checked=false;selectionState();}
  function controls() {
    for(const name of fields)el(name).disabled=Boolean(pending);
    for(const name of ['lock','current','prepare','references'])el(name).disabled=Boolean(pending);
    el('submit').disabled=sending||(!proposal&&!pending);el('discard').disabled=!pending;
    el('submit').textContent=pending?'Replay Same Path Command':'Apply Explicit Path';
    selectionState();
  }
  function clearRows() {listVersion++;batchTarget=null;clearSelection();checkboxes.clear();el('rows').replaceChildren();el('page').textContent='';el('prev').disabled=el('next').disabled=true;}
  function invalidate(target=false) {
    if(pending)return;version++;proposal=null;clearSelection();el('proposal').textContent='';el('record').textContent='';
    if(target){locked=null;el('digest').value='';clearRows();}
    state('Prepare an exact, non-reserving path proposal. No automatic publication or switch.');controls();
  }
  function selection() {
    const templateId=el('template').value.trim(),revision=el('revision').value;
    if(!locked||locked.templateId!==templateId||!number(revision)||locked.revision!==Number(revision))throw Error('Inspect the exact target template revision first.');
    return {templateId,revision:Number(revision),configDigest:locked.configDigest};
  }
  function lockValue(value,template,revision) {
    if(tunnelManagement){managementView(value);if(value.tunnelId!==template)throw Error('Tunnel backing identity mismatch.');}
    if(!id(template)||value.templateId!==template||!Number.isSafeInteger(value.revision)||value.revision!==revision||!Number.isSafeInteger(value.currentRevision)||
        revision<1||revision>64||value.currentRevision<revision||value.currentRevision>64||value.archived!==false||!hash(value.configDigest)||
        !hash(value.profileDigest)||value.executionAuthorized!==false||value.reserved!==false||value.bindingCreated!==false)
      throw Error('Invalid or archived exact template.');
    return {templateId:template,revision,configDigest:value.configDigest,profileDigest:value.profileDigest,config:configView(value.config)};
  }
  function selectDefinition(value) {
    if(pending)throw Error('Resolve or explicitly discard the original uncertain path command before choosing another tunnel.');
    const next=lockValue(value,value.templateId,value.revision);
    invalidate(true);el('template').value=next.templateId;el('revision').value=String(next.revision);locked=next;
    el('digest').value=next.configDigest;state('Exact tunnel revision selected. Inspect the Forward CAS, then prepare and explicitly confirm its binding. No command sent.');
    return true;
  }
  async function lock() {
    if(pending)return;invalidate(true);const connection=epoch,current=++version;
    try {
      const template=el('template').value.trim(),revision=el('revision').value;
      if(!id(template)||!number(revision))throw Error('Exact template ID and revision (1-64) required; no latest alias.');
      const value=await call('GET',collection+'/'+encodeURIComponent(template)+'?revision='+revision);
      if(connection!==epoch||current!==version||pending)return;
      locked=lockValue(value,template,Number(revision));
      el('digest').value=locked.configDigest;state('Exact immutable template inspected. Current grants, Endpoints, CAS and resources are not reserved.');
    }catch(error){if(connection===epoch&&current===version)notify(error.message,true);}
  }
  async function current() {
    if(pending)return;invalidate();const connection=epoch,token=++version;
    try {
      const forward=el('forward').value.trim();if(!id(forward))throw Error('Choose a Forward ID.');
      const value=await call('GET',resource(forward)+'/'+bindingResource);
      if(connection!==epoch||token!==version||pending)return;
      if(value.forwardId!==forward||!Number.isSafeInteger(value.revision)||value.revision<1||value.executionAuthorized!==false||
          value.reserved!==false||typeof value.recoverySuspended!=='boolean'||typeof value.deleting!=='boolean')throw Error('Invalid current provenance response.');
      el('expected').value=String(value.revision);el('record').textContent=JSON.stringify(value,null,2);
      state('Current CAS inspected. Provenance is historical, not current execution authority'+(value.recoverySuspended?' / recovery suspended':'')+'.');
    }catch(error){if(connection===epoch&&token===version)notify(error.message,true);}
  }
  async function prepare() {
    if(pending)return;invalidate();const connection=epoch,token=++version;
    try {
      const forward=el('forward').value.trim(),expected=el('expected').value,target=selection(),config=clone(locked.config);
      if(!id(forward)||!counter(expected))throw Error('Exact current Forward ID and CAS revision required.');
      const body={expectedRevision:Number(expected),template:target};
      const value=await call('POST',resource(forward)+'/'+previewResource,body);
      if(connection!==epoch||token!==version||pending)return;
      const spec=value.spec;
      if(value.forwardId!==forward||value.expectedRevision!==body.expectedRevision||!equal(value.template,target)||value.reserved!==false||
          value.executionAuthorized!==false||value.fullPlanAuthorization!==false||value.previewOnly!==true||
          spec?.ingress?.nodeId!==config.nodes[0]||!id(spec.ingress.nodeId)||!Number.isSafeInteger(spec.ingress.listen?.port)||spec.ingress.listen.port<1||spec.ingress.listen.port>65535||
          typeof spec.ingress.listen.address!=='string'||typeof spec.target?.host!=='string'||!Number.isSafeInteger(spec.target.port)||spec.target.port<1||spec.target.port>65535||
          typeof spec.enabled!=='boolean'||!Array.isArray(spec.protocols)||!equal([...spec.protocols].sort(),[...config.protocols].sort()))
        throw Error('Invalid non-reserving path preview.');
      const proposedSpec={...spec,path:{via:config.nodes.slice(1)},transport:{...config.transport}};
      if(!equal(value.proposedSpec,proposedSpec)||value.changed!==!equal(spec,proposedSpec))throw Error('Preview changes more than the exact path/Profile binding.');
      proposal={forward,body:clone(body),proposedSpec:clone(proposedSpec),profileDigest:locked.profileDigest,changed:value.changed};
      el('proposal').textContent=JSON.stringify({forwardId:forward,...body,spec,proposedSpec,reserved:false,executionAuthorized:false,
        interruption:'possible-same-listener-replacement',tcp:'bounded-drain-or-authorization-deadline',udp:'associations-may-reset-and-lose-datagrams'},null,2);
      state('Proposal prepared only. Apply performs a fresh original Relay plan, then independently authorized original Forward acceptance.');controls();
    }catch(error){if(connection===epoch&&token===version){proposal=null;controls();notify(error.message,true);}}
  }
  async function submit() {
    if(sending||(!pending&&!proposal))return;const connection=epoch,replay=Boolean(pending);
    try {
      if(!confirm(replay?'Replay only the original path key/body, without replacing CAS, template or plan? A current denial cannot disprove the original commit.':
        'Apply this exact template through the original Forward update? Interruption is possible, TCP drain is bounded, UDP may lose associations/datagrams. No automatic rollback.'))return;
      if(!pending){pending={...clone(proposal),key:randomUUID(),sent:false};version++;clearRows();}
      const original=pending;sending=true;controls();
      if(!replay){
        state('Checking the fresh original Relay plan; no path command sent yet.');
        const plan=await call('POST','relay-plan',original.proposedSpec);
        if(connection!==epoch||pending!==original)return;
        if(plan.reserved!==false||plan.executionSupported!==false||plan.runtimeEnabled!==true||
            plan.profile?.profileId!==original.proposedSpec.transport.profileId||plan.profile.revision!==original.proposedSpec.transport.configRevision||
            plan.profile.configDigest!==original.profileDigest)throw Error('Fresh Relay plan does not match the exact locked Profile or runtime gate.');
      }
      original.sent=true;state('Sending the original same-transaction Forward/path command...');
      const value=await call('PUT',resource(original.forward)+'/'+bindingResource,original.body,original.key);
      if(connection!==epoch||pending!==original)return;
      const binding=value.pathBinding,target=original.body.template,expected=original.body.expectedRevision+(original.changed?1:0);
      if(value.forwardId!==original.forward||value.revision!==expected||
          (original.changed?!id(value.operationId):value.operationId!==null)||!binding||binding.templateId!==target.templateId||
          binding.revision!==target.revision||binding.configDigest!==target.configDigest||!Number.isSafeInteger(binding.sequence)||binding.sequence<1||binding.sequence>64||
          !Number.isSafeInteger(binding.forwardRevision)||binding.forwardRevision<1||binding.forwardRevision>value.revision||typeof binding.changed!=='boolean')
        throw Error('Invalid path acceptance; original outcome remains uncertain.');
      pending=null;proposal=null;sending=false;el('expected').value=String(value.revision);el('record').textContent=JSON.stringify(value,null,2);controls();
      state(value.operationId?'Accepted original Operation '+value.operationId+'. Deployment/traffic are separate checks.':
        'Path provenance accepted without a deployment Operation: expanded ForwardSpec is unchanged.');
    }catch(error){if(connection===epoch){
      sending=false;
      if(pending&&!pending.sent){pending=null;state('Preflight failed: no path command sent. Prepare and explicitly confirm a new check.');}
      else if(pending&&!replay&&[400,401,403,404,409,413,422,429].includes(error.httpStatus)){pending=null;state('Path command rejected. Prepare a new explicit proposal; no CAS replacement.');}
      else if(pending)state('uncertain: original path command may have committed. Only explicit same-key/body replay remains.');
      proposal=null;controls();notify(error.message,true);
    }}
  }
  async function references() {
    if(pending)return;clearRows();const connection=epoch,token=listVersion,requestedPage=page;
    try {
      const target=selection(),value=await call('GET',collection+'/'+encodeURIComponent(target.templateId)+'/references?page='+page+'&limit=25&targetRevision='+target.revision);
      if(connection!==epoch||token!==listVersion||pending)return;
      if(value.templateId!==target.templateId||value.page!==requestedPage||value.limit!==25||value.reserved!==false||value.executionAuthorized!==false||
          value.fullPlanAuthorization!==false||!Number.isSafeInteger(value.total)||value.total<0||!Array.isArray(value.items)||value.items.length>25||
          value.previewOnly!==true||typeof value.archived!=='boolean'||!equal(value.target?.config,locked.config)||
          !equal({templateId:value.target?.templateId,revision:value.target?.revision,configDigest:value.target?.configDigest},target)||
          new Set(value.items.map(item=>item.forwardId)).size!==value.items.length||value.items.some(item=>!id(item.forwardId)||
            !Number.isSafeInteger(item.expectedRevision)||item.expectedRevision<1||typeof item.recoverySuspended!=='boolean'||
            !number(String(item.binding?.revision))||item.binding.templateId!==target.templateId||!hash(item.binding.configDigest)))throw Error('Invalid bounded current reference page.');
      total=value.total;batchTarget=value.archived?null:{...target,targetRevision:target.revision,profileDigest:locked.profileDigest,config:clone(locked.config)};el('rows').replaceChildren();
      for(const item of value.items){
        const row=document.createElement('tr');
        for(const text of [item.forwardId+' @ '+item.expectedRevision,'template r'+item.binding.revision,
          item.unavailableReason??(item.changed?'explicit change available':'unchanged path/provenance')]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}
        const box=document.createElement('input');box.type='checkbox';
        box.setAttribute('aria-label','Select Path Impact Forward '+item.forwardId);
        box.disabled=!batchTarget||item.changed!==true||item.recoverySuspended!==false||item.unavailableReason!==null||!item.proposedSpec;
        box.addEventListener('change',()=>{
          if(connection!==epoch||token!==listVersion||pending||box.disabled){box.checked=false;return;}
          if(!box.checked)selected.delete(item.forwardId);
          else if(selected.size>=10){box.checked=false;notify('Select at most 10 changes from this current path impact page.',true);}
          else selected.set(item.forwardId,clone(item));
          selectionState();
        });checkboxes.add(box);row.children[0].append(box);
        const cell=document.createElement('td'),button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Select Current CAS';
        button.disabled=Boolean(item.unavailableReason)||item.recoverySuspended||!item.proposedSpec;
        button.addEventListener('click',()=>{if(connection!==epoch||token!==listVersion||pending||button.disabled)return;
          invalidate();el('forward').value=item.forwardId;el('expected').value=String(item.expectedRevision);});
        cell.append(button);row.append(cell);el('rows').append(row);
      }
      el('page').textContent='Page '+page+' / total '+total+'. Current desired references only; not history or global snapshot.';
      el('prev').disabled=page<=1;el('next').disabled=page>=Math.min(10000,Math.max(1,Math.ceil(total/25)));
      selectionState();
    }catch(error){if(connection===epoch&&token===listVersion){el('page').textContent='References unavailable.';notify(error.message,true);}}
  }
  async function prepareBatch(){
    if(pending||!batchTarget||!selected.size||typeof preparePathBatch!=='function')return;
    const connection=epoch,token=listVersion;
    try{
      const prepared=await preparePathBatch(clone({...batchTarget,items:[...selected.values()]}));
      if(prepared&&connection===epoch&&token===listVersion){clearRows();invalidate();}
    }catch(error){if(connection===epoch&&token===listVersion)notify(error.message,true);}
  }
  for(const name of fields)for(const event of ['input','change'])el(name).addEventListener(event,()=>invalidate(['template','revision'].includes(name)));
  for(const [name,action] of [['lock',lock],['current',current],['prepare',prepare],['submit',submit],['references',()=>{page=1;return references();}]])el(name).addEventListener('click',action);
  for(const [name,direction] of [['prev',-1],['next',1]])el(name).addEventListener('click',()=>{if(!el(name).disabled&&!pending){page+=direction;return references();}});
  function clear(){
    epoch++;version++;for(const controller of controllers)controller.abort();controllers.clear();locked=null;proposal=null;pending=null;sending=false;page=1;total=0;
    for(const name of fields)el(name).value='';el('digest').value='';el('proposal').textContent='';el('record').textContent='';clearRows();controls();
    state('Explicit single-rule path switch. Same ingress/protocols; target, listener and enabled intent remain unchanged.');
  }
  el('discard').addEventListener('click',()=>{if(pending&&confirm('Discard local path-command memory? This cannot cancel or roll back a committed switch.'))clear();});
  el('batch-prepare').addEventListener('click',prepareBatch);
  clear();return {lock,current,prepare,submit,references,prepareBatch,selectDefinition,clear};
}
