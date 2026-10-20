import test from 'node:test';
import assert from 'node:assert/strict';
import * as legacy from '../relay-model.js';
import { initRelayConsole } from '../relay.js';
import { createNativeRelayForms, createNativeRelayConsole } from '../browser-native/public.js';

const names = ['relayCapable','multihopCapable','multihopSpec','relayProfile','relayEndpoint','relaySpec'];
const node = id => ({ id, revoked:false, credentialUntil:'2099-01-01T00:00:00Z', policy:{
  capabilities:['adp.3','native.direct.v1','native.relay.v1','relay.wire.1','adp.execution.1','native.multihop.v1','multihop.wire.1','tcp','udp'],
  allowedListenerAddresses:['127.0.0.1'], allowedPorts:[25565] } });
const profile = { profileId:'profile-a',revision:2,config:{protocols:['tcp','udp']} };
const form = {protocol:'both',listenAddress:'127.0.0.1',listenPort:'25565',targetPort:'80',targetHost:' example.com ',enabled:true};
const profileForm = {protocol:'both',maxFrameBytes:'64',maxUdpDatagramBytes:'1',handshakeTimeoutSeconds:'1',idleTimeoutSeconds:'1',maxConnectionsPerNode:'1'};

test('Relay six helper legacy exports and factory retain names arities mutable results and lazy base capability', () => {
  const calls=[]; const forms=createNativeRelayForms({directCapable:n=>{calls.push(n);return n?.base===true;},parsePorts:()=>[]});
  assert.deepEqual(Object.keys(legacy).sort(), [...names].sort());
  assert.deepEqual(Object.keys(forms), names);
  for(const [i,arity] of [1,1,4,1,1,4].entries()) {
    assert.equal(forms[names[i]].name,names[i]);assert.equal(forms[names[i]].length,arity);
    assert.equal(legacy[names[i]].name,names[i]);assert.equal(legacy[names[i]].length,arity);
  }
  assert.deepEqual(calls,[]); const rejected={get policy(){throw Error('must short circuit');}};
  assert.equal(forms.relayCapable(rejected),false);assert.equal(calls[0],rejected);
  const n={base:true,policy:node('a').policy};assert.equal(forms.multihopCapable(n),true);
  assert.deepEqual(calls,[rejected,n]);
  const a=legacy.relaySpec(form,node('a'),node('b'),profile),b=legacy.relaySpec(form,node('a'),node('b'),profile);
  assert.deepEqual(a,b);assert.notEqual(a,b);a.path.via.push('changed');a.protocols.push('mutable');
  assert.deepEqual(b.path.via,['b']);assert.deepEqual(b.protocols,['tcp','udp']);assert.equal(Object.isFrozen(a),false);
});

test('Relay native forms retain coercion order bounds first errors and detached endpoint/path values', () => {
  const trace=[]; const traced=(input)=>Object.fromEntries(Object.entries(input).map(([key,value])=>[key,{toString(){trace.push(key);return value;}}]));
  const forms=createNativeRelayForms({directCapable:()=>true,parsePorts:value=>{trace.push(['ports',value]);return [1,2];}});
  const p=forms.relayProfile(traced(profileForm));
  assert.deepEqual(trace,['protocol','maxFrameBytes','maxUdpDatagramBytes','handshakeTimeoutSeconds','idleTimeoutSeconds','maxConnectionsPerNode']);
  assert.deepEqual(Object.keys(p),['driver','wireVersion','security','protocols','handshakeTimeoutSeconds','idleTimeoutSeconds','maxFrameBytes','maxUdpDatagramBytes','maxConnectionsPerNode']);
  assert.deepEqual(p,{driver:'native.relay.v1',wireVersion:1,security:'mutual-tls13',protocols:['tcp','udp'],handshakeTimeoutSeconds:1,idleTimeoutSeconds:1,maxFrameBytes:64,maxUdpDatagramBytes:1,maxConnectionsPerNode:1});
  for(const [field,min,max] of [['maxFrameBytes',64,65536],['maxUdpDatagramBytes',1,16384],['handshakeTimeoutSeconds',1,10],['idleTimeoutSeconds',1,300],['maxConnectionsPerNode',1,4096]]) {
    const valid={...profileForm,maxFrameBytes:'65536'};
    for(const value of [min,max])assert.equal(forms.relayProfile({...valid,[field]:String(value)})[field],value);
    for(const value of [String(min-1),String(max+1),'01','1.0',' 1',''])assert.throws(()=>forms.relayProfile({...valid,[field]:value}));
  }
  trace.length=0;assert.throws(()=>forms.relayProfile(traced({...profileForm,protocol:'bad'})),{message:'Relay Profile 协议不受支持'});assert.deepEqual(trace,['protocol']);
  trace.length=0;assert.throws(()=>forms.relayProfile(traced({...profileForm,maxUdpDatagramBytes:'65'})),{message:'UDP 上限不能大于帧大小'});
  assert.deepEqual(trace,['protocol','maxFrameBytes','maxUdpDatagramBytes']);
  trace.length=0;const ports={}; const endpoint=forms.relayEndpoint({...traced({advertisedHost:' host ',listenAddress:' addr '}),ports});
  assert.deepEqual(trace,['advertisedHost','listenAddress',['ports',ports]]);assert.deepEqual(endpoint,{listenAddress:'addr',advertisedHost:'host',allowedTcpPorts:[1,2]});
  trace.length=0;assert.throws(()=>forms.relayEndpoint({...traced({advertisedHost:'',listenAddress:'addr'}),ports}),{message:'请填写实际可达的 Endpoint 地址'});assert.deepEqual(trace,['advertisedHost','listenAddress']);
  assert.throws(()=>createNativeRelayForms({directCapable:()=>true,parsePorts:()=>Array(257).fill(1)}).relayEndpoint({advertisedHost:'a',listenAddress:'b'}),{message:'Relay 内部 TCP 端口不能多于 256 个'});
  trace.length=0; const fields={...form,listenAddress:{toString(){trace.push('address');return '127.0.0.1';}},listenPort:{valueOf(){trace.push('listen');return 25565;}},targetPort:{valueOf(){trace.push('targetPort');return 80;}},targetHost:{toString(){trace.push('host');return ' h ';}}};
  assert.equal(forms.relaySpec(fields,node('a'),node('b'),profile).target.host,'h');assert.deepEqual(trace,['address','listen','targetPort','host']);
  assert.throws(()=>forms.relaySpec({get protocol(){throw Error('late');}},node('a'),node('a'),null),{message:'Relay 要求两台不同且支持 Relay 的有效节点'});
  assert.throws(()=>forms.relaySpec({get protocol(){throw Error('late');}},node('a'),node('b'),null),{message:'请选择有效的不可变 Transport Profile revision'});
  assert.throws(()=>forms.multihopSpec(null,null,null,false),{message:'Control 尚未开启多跳执行'});
  for(const path of [[],[node('a'),node('b')],Array.from({length:9},(_,i)=>node(String(i))),[node('a'),node('b'),node('a')]])assert.throws(()=>forms.multihopSpec(form,path,profile,true),{message:'多跳路径要求 3–8 个不同且支持多跳执行的有效节点'});
  const path=[node('a'),node('b'),node('c')];const result=forms.multihopSpec(form,path,profile,true);assert.deepEqual(result.path.via,['b','c']);path[1].id='changed';assert.deepEqual(result.path.via,['b','c']);
});

class Element {
  constructor(){this.value='';this.checked=false;this.children=[];this.listeners={};this.hidden=false;this.disabled=false;this.open=false;}
  replaceChildren(...items){this.children=[];this.value='';this.append(...items);}
  append(...items){for(const item of items){this.children.push(item);if(item.selected||this.children.length===1)this.value=item.value??this.value;}}
  addEventListener(type,fn){this.listeners[type]=fn;}
  setAttribute(){} showModal(){this.open=true;}close(){this.open=false;this.listeners.close?.();}
}
function consoleHarness(handler=()=>{},overrides={}) {
  const elements=new Map(),requests=[],mutations=[],effects=[];
  const el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  for(const [name,id] of Object.entries({ingressId:'relay-ingress',egressId:'relay-egress',profileId:'relay-profile-select',listenAddress:'relay-listen-address',listenPort:'relay-listen-port',protocol:'protocol',targetHost:'targetHost',targetPort:'targetPort',enabled:'enabled'})) {
    el('relay-forward-form').elements??={namedItem:key=>el('field-'+key)};
    if(id.startsWith('relay-')){const target=el(id);const original=el('relay-forward-form').elements.namedItem;el('relay-forward-form').elements.namedItem=key=>key===name?target:original(key);}
    else {el('field-'+name).value=form[name]??'';el('field-'+name).checked=form[name]===true;}
  }
  const callbacks={request:async(...args)=>{requests.push(args);return handler(...args)??({});},mutate:async(...args)=>{mutations.push(args);return overrides.mutate?overrides.mutate(...args):{operationId:null};},
    notify:(...args)=>effects.push(['notify',...args]),byId:el,candidates:{relay:[node('a'),node('b')]},load:async kind=>effects.push(['load',kind]),loadOverview:async()=>effects.push(['overview']),
    loadCandidates:async()=>true,detail:()=>{},display:kind=>effects.push(['display',kind]),inspectProfile:async()=>{},loadCatalog:async()=>effects.push(['catalog']),inspectTunnel:()=>{}};
  const api=initRelayConsole(callbacks);
  return {api,el,requests,mutations,effects,callbacks};
}

test('Relay legacy init retains signature listener surface fresh per-init profile caches pinned edit preview equality and clear',async t=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>new Element()}});
  t.after(()=>original?Object.defineProperty(globalThis,'document',original):delete globalThis.document);
  const data=(method,path)=>path==='execution-capabilities'?{multihopEnabled:true}:path==='transport-profiles'?{profiles:[{profileId:'profile-a',currentRevision:3}]}:path.startsWith('transport-profiles/')?profile:path==='relay-plan'?{reserved:false,executionSupported:false}:{};
  const a=consoleHarness(data),b=consoleHarness(data);
  assert.equal(initRelayConsole.name,'initRelayConsole');assert.equal(initRelayConsole.length,1);
  const native=createNativeRelayConsole(Object.fromEntries(names.map(name=>[name,legacy[name]])));
  assert.equal(native.name,initRelayConsole.name);assert.equal(native.length,1);
  assert.deepEqual(Object.keys(a.api),['refresh','populateNodes','refreshCandidates','clear','edit','copy','deployment']);
  assert.deepEqual(a.requests,[]);assert.deepEqual(b.requests,[]);
  const item={id:'forward-a',revision:7,spec:legacy.relaySpec(form,node('a'),node('b'),profile)};
  await a.api.edit(item); assert.equal(a.el('relay-ingress').disabled,true);assert.equal(a.el('relay-submit').textContent,'更新链路 r7');
  await a.el('relay-preview').listeners.click();await a.el('relay-preview').listeners.click();
  assert.equal(a.requests.filter(x=>x[1]==='transport-profiles/profile-a?revision=2').length,1);
  assert.equal(a.el('relay-submit').disabled,false);
  await b.api.edit(item);await b.el('relay-preview').listeners.click();assert.equal(b.requests.filter(x=>x[1]==='transport-profiles/profile-a?revision=2').length,1);
  a.el('field-targetHost').value='changed.example';await a.el('relay-forward-form').listeners.submit({preventDefault(){}});
  assert.equal(a.mutations.length,0);assert.match(a.effects.at(-1)[1],/表单已变化/);
  await a.el('relay-preview').listeners.click();await a.el('relay-forward-form').listeners.submit({preventDefault(){}});
  assert.equal(a.mutations.length,1);assert.deepEqual(a.mutations[0].slice(0,2),['PUT','forwards/forward-a']);assert.equal(a.mutations[0][2].expectedRevision,7);
  assert.deepEqual(a.effects.filter(x=>x[0]==='load'||x[0]==='overview'||x[0]==='display').slice(-4),[['load','forwards'],['load','operations'],['overview'],['display','operations']]);
  a.api.clear();assert.equal(a.el('relay-submit').disabled,true);assert.equal(a.el('relay-cancel-edit').hidden,true);assert.equal(a.el('relay-profile-select').disabled,true);
  await a.api.edit(item);await a.el('relay-preview').listeners.click();assert.equal(a.requests.filter(x=>x[1]==='transport-profiles/profile-a?revision=2').length,2);
  assert.equal(b.el('relay-ingress').disabled,true);assert.equal(b.el('relay-submit').disabled,false);
});

test('Relay init isolates unknown write outcomes stale plans and deployment history restore CAS across clear',async t=>{
  const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),originalConfirm=Object.getOwnPropertyDescriptor(globalThis,'confirm');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>new Element()}});
  const confirmations=[];Object.defineProperty(globalThis,'confirm',{configurable:true,value:message=>{confirmations.push(message);return true;}});
  t.after(()=>{for(const [key,value] of [['document',originalDocument],['confirm',originalConfirm]])if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];});
  const saved=legacy.relaySpec(form,node('a'),node('b'),profile),item={id:'forward-a',revision:7,spec:saved};
  let releasePlan,releaseDeployment,delayedPlan=false,delayedDeployment=false;
  const planGate=new Promise(resolve=>{releasePlan=resolve;}),deploymentGate=new Promise(resolve=>{releaseDeployment=resolve;});
  const data=(method,path)=>{
    if(path==='execution-capabilities')return {multihopEnabled:true};
    if(path==='transport-profiles')return {profiles:[{profileId:'profile-a',currentRevision:3}]};
    if(path.startsWith('transport-profiles/'))return profile;
    if(path==='relay-plan')return delayedPlan?planGate:{reserved:false,executionSupported:false};
    if(path.endsWith('/deployment'))return delayedDeployment?deploymentGate:{deployment:{generation:2,stage:'preparing',renewalAllowed:false,isolation:[],nodes:[]}};
    if(path.endsWith('/revisions'))return {revisions:[{revision:3,spec:saved},{revision:7,spec:saved}]};
    if(path==='forwards/forward-a')return {desired:{revision:7}};
    return {};
  };
  let unknown=true;const a=consoleHarness(data,{mutate:async()=>{if(unknown)throw Error('unknown outcome');return {operationId:'op-restored'};}});
  await a.api.edit(item);await a.el('relay-preview').listeners.click();
  await a.el('relay-forward-form').listeners.submit({preventDefault(){}});
  assert.equal(a.mutations.length,1);assert.equal(a.el('relay-submit').disabled,true);assert.equal(a.el('relay-submit').textContent,'更新链路 r7');
  assert.equal(a.effects.some(x=>x[0]==='load'),false);assert.deepEqual(a.effects.at(-1),['notify','unknown outcome',true]);
  delayedPlan=true;const pending=a.el('relay-preview').listeners.click();await new Promise(resolve=>setImmediate(resolve));
  a.el('relay-forward-form').listeners.input();releasePlan({reserved:false,executionSupported:false});await pending;
  assert.equal(a.el('relay-submit').disabled,true);assert.equal(a.el('relay-preview-output').hidden,true);assert.equal(a.mutations.length,1);
  unknown=false;await a.api.deployment('forward-a');assert.equal(a.el('deployment-dialog').open,true);
  const button=a.el('deployment-nodes').children.find(child=>child.textContent==='部署所选配置');assert.ok(button);
  await button.listeners.click();assert.equal(confirmations.length,1);assert.deepEqual(a.mutations[1],['PUT','forwards/forward-a',{expectedRevision:7,spec:saved}]);
  assert.equal(a.el('deployment-dialog').open,false);assert.match(a.effects.at(-1)[1],/op-restored/);
  delayedDeployment=true;const pendingDeployment=a.api.deployment('forward-a');a.api.clear();releaseDeployment({deployment:{generation:9,stage:'stale',renewalAllowed:true,isolation:[],nodes:[]}});await pendingDeployment;
  assert.equal(a.el('deployment-dialog').open,false);assert.equal(a.el('deployment-state').textContent,'');assert.equal(a.el('deployment-nodes').children.length,0);
  await button.listeners.click();assert.equal(a.mutations.length,2);assert.equal(confirmations.length,1);
});
