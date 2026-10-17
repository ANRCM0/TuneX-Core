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

export function initPathTemplates({request,byId,notify,document=globalThis.document,confirm=globalThis.confirm,randomUUID=()=>crypto.randomUUID()}) {
  const el = name => byId('path-template-' + name), fields = ['id','expected','nodes','protocol','profile','profile-revision','read-revision'];
  let epoch=0,readVersion=0,listVersion=0,captureVersion=0,page=1,total=0,pending=null,sending=false,locks=null,stamp=null;
  const controllers=new Set();
  async function call(method,resource,body,key) {
    const controller=new AbortController();controllers.add(controller);
    try {return await request(method,resource,body,key,{signal:controller.signal,timeoutMs:5000});}
    finally {controllers.delete(controller);}
  }
  const resource = template => 'path-templates/' + encodeURIComponent(template);
  function state(message) {el('state').textContent=message;}
  function controls() {
    for(const name of fields)el(name).disabled=Boolean(pending);
    el('capture').disabled=Boolean(pending);el('inspect').disabled=Boolean(pending);
    el('publish').disabled=sending||pending?.method==='DELETE';el('archive').disabled=sending||pending?.method==='PUT';
    el('publish').textContent=pending?.method==='PUT'?'Replay Same Publish':'Publish Immutable Revision';
    el('archive').textContent=pending?.method==='DELETE'?'Replay Same Archive':'Archive Template';
    el('discard').disabled=!pending;
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
    captureVersion++;readVersion++;locks=null;stamp=null;el('endpoints').textContent='';el('record').textContent='';
    state('Metadata only. Capture current Endpoint revisions before publishing. No binding or execution authorization.');
  }
  async function capture() {
    if(pending)return;const version=++captureVersion,connection=epoch;
    readVersion++;el('record').textContent='';
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
    captureVersion++;locks=null;stamp=null;el('endpoints').textContent='';el('record').textContent='';
    try {
      if(!id(template)||requested!==''&&!number(requested))throw Error('Choose a template ID and an exact revision or blank for current.');
      const result=await call('GET',resource(template)+(requested?'?revision='+requested:''));
      if(connection!==epoch||version!==readVersion||pending)return;
      if(result.templateId!==template||!Number.isSafeInteger(result.currentRevision)||result.currentRevision<1||result.currentRevision>64||
          !Number.isSafeInteger(result.revision)||result.revision<1||result.revision>result.currentRevision||result.revision!==(requested?Number(requested):result.currentRevision)||
          typeof result.archived!=='boolean'||!hash(result.configDigest)||!hash(result.profileDigest)||result.executionAuthorized!==false||result.bindingCreated!==false||result.reserved!==false)
        throw Error('Invalid immutable PathTemplate response.');
      const config=configView(result.config);captureVersion++;
      el('id').value=template;el('expected').value=String(result.currentRevision);el('nodes').value=config.nodes.join('\n');
      el('profile').value=config.transport.profileId;el('profile-revision').value=String(config.transport.configRevision);
      el('protocol').value=config.protocols.length===2?'both':config.protocols[0];
      locks=config.endpoints;stamp=JSON.stringify(draft());el('endpoints').textContent=JSON.stringify(locks,null,2);
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
      const data=await call('GET','path-templates?page='+requestedPage+'&limit=25'+(prefix?'&prefix='+encodeURIComponent(prefix):''));
      if(connection!==epoch||version!==listVersion)return;
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
        readVersion++;captureVersion++;
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
    pending=null;sending=false;locks=null;stamp=null;page=1;total=0;
    for(const name of fields)el(name).value=name==='expected'?'0':name==='protocol'?'both':'';
    el('prefix').value='';el('rows').replaceChildren();el('record').textContent='';el('endpoints').textContent='';el('page').textContent='';
    el('prev').disabled=el('next').disabled=true;controls();state('Metadata only. No Forward bindings or manual switching in this slice.');
  }
  el('discard').addEventListener('click',()=>{if(pending&&confirm('Discard tab-memory command history? This cannot cancel or roll back a committed command.'))clear();});
  clear();return {list,inspect,capture,clear};
}
