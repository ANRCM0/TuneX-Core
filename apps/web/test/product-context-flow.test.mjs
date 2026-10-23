import test from 'node:test';
import assert from 'node:assert/strict';
import { identityContextView, readIdentityContext, roleAllowed, scopeGovernance } from '../account-context.js';
import { resolveTemplateLines } from '../template-reference.js';
import { createConsoleModel } from '../console-model-owner/public.js';
import { explainNodePreflight } from '../forward-preflight.js';
import { grantPortPatch, grantPortLimitsView, personalPortUsageView } from '../admin-resource-console.js';

const scope = { scopeId:'scope-a',role:'manager',membership:'active',membershipRevision:3,canEnter:true,canManage:true };
const context = { actorId:'actor-a',limit:100,scopes:[scope],truncated:false,nextAfter:null };
const digest = 'sha256:'+'a'.repeat(64);

test('account lookup uses the authenticated unscoped context endpoint', async () => {
  const calls=[];
  const result=await readIdentityContext('secret',{send:async(path,options)=>{
    calls.push({path,options});return {ok:true,json:async()=>context};
  }});
  assert.equal(result.actorId,'actor-a');
  assert.equal(calls[0].path,'/api/v1/me/context?limit=100');
  assert.equal(calls[0].options.headers.Authorization,'Bearer secret');
  assert.equal(calls[0].options.credentials,'omit');
  assert.equal(scopeGovernance(result.scopes[0]),false);
});

test('inactive owner identity is displayable but never opens governance',()=>{
  const inactive={...scope,role:'owner',membership:'inactive',canEnter:false,canManage:false};
  assert.equal(identityContextView({...context,scopes:[inactive]}).scopes[0].canEnter,false);
  assert.equal(scopeGovernance(inactive),false);
  assert.equal(scopeGovernance({...scope,role:'owner'}),true);
  assert.throws(()=>identityContextView({...context,scopes:[{...inactive,canEnter:true}]}));
});

test('context cursors cannot repeat an earlier scope or disagree with the page',()=>{
  assert.throws(()=>identityContextView({...context,truncated:true,nextAfter:'scope-b'}));
  assert.throws(()=>identityContextView(context,'scope-a'));
  assert.equal(identityContextView({...context,truncated:true,nextAfter:'scope-a'}).nextAfter,'scope-a');
});

test('shared purpose grants never imply an ingress role or whole-host report',()=>{
  const node={id:'shared-a',canUse:true,allowedRoles:['egress'],readDetail:'shared',revoked:false,
    credentialUntil:'2099-01-01T00:00:00Z',lastReportAt:null,
    policy:{capabilities:['adp.3','native.direct.v1','tcp'],allowedListenerAddresses:['127.0.0.1'],allowedPorts:[25565]}};
  assert.equal(roleAllowed(node,'ingress'),false);
  assert.equal(roleAllowed(node,'egress'),true);
  assert.equal(roleAllowed({...node,canUse:false},'egress'),false);
  const model=createConsoleModel({credentialActive:()=>true});
  assert.throws(()=>model.directSpec({protocol:'tcp',listenAddress:'127.0.0.1',listenPort:25565,targetHost:'127.0.0.1',targetPort:25565},node));
  assert.equal(model.directCapable({...node,canUse:undefined}),false);
  const preflight=explainNodePreflight(node,{role:'egress',protocol:'tcp'});
  assert.equal(preflight.facts.status,'hidden');
  assert.equal(preflight.reasons.some(reason=>reason.code==='REPORT_MISSING'),false);
});

test('candidate members resolve the requested immutable revision without a supplied digest',async()=>{
  const calls=[];
  const members=await resolveTemplateLines('primary line-a 2',async(method,path)=>{
    calls.push({method,path});
    return {templateId:'line-a',revision:2,archived:false,configDigest:digest,executionAuthorized:false,reserved:false};
  },'candidateId');
  assert.deepEqual(calls,[{method:'GET',path:'path-templates/line-a?revision=2'}]);
  assert.deepEqual(members,[{candidateId:'primary',template:{templateId:'line-a',revision:2,configDigest:digest}}]);
});

test('mismatched revisions and access denial never create a resolved member',async()=>{
  await assert.rejects(resolveTemplateLines('primary line-a 2',async()=>({templateId:'line-a',revision:3}), 'memberId'));
  await assert.rejects(resolveTemplateLines('primary line-a 2',async()=>{throw Error('NOT_FOUND');}, 'memberId'),/NOT_FOUND/);
});

test('editing grant purposes preserves stored limits by omitting the portLimits field',()=>{
  const patch=grantPortPatch({mode:'keep',ports:'invalid-stale-input',maxBindings:'invalid'},()=>assert.fail('preserve must not parse replacement fields'));
  assert.equal(Object.hasOwn(patch,'portLimits'),false);
  assert.deepEqual(grantPortPatch({mode:'clear'},()=>assert.fail('clear must not parse old fields')),{portLimits:null});
});

test('explicit replacement preserves zero binding allowance and validates a physical port subset',()=>{
  const patch=grantPortPatch({mode:'replace',ports:'25566,25565',maxBindings:'0'},value=>value.split(',').map(Number));
  assert.deepEqual(patch,{portLimits:{allowedPorts:[25565,25566],maxBindings:0}});
  assert.deepEqual(grantPortPatch({mode:'replace'},()=>assert.fail('blank means no extra subset')),{portLimits:{allowedPorts:null,maxBindings:null}});
  assert.throws(()=>grantPortPatch({mode:'replace',maxBindings:'-1'},()=>[]));
  assert.throws(()=>grantPortLimitsView({allowedPorts:[25565,25565],maxBindings:null}));
  assert.throws(()=>grantPortLimitsView({allowedPorts:[65536],maxBindings:null}));
  assert.throws(()=>grantPortLimitsView({allowedPorts:null,maxBindings:0,unexpected:true}));
});

test('personal usage labels zero, unlimited and private separately without granting execution',()=>{
  const identity={nodeId:'node-a',scopeId:'scope-a',actorId:'actor-a'};
  const value={...identity,resourceSource:'admin-shared',portLimits:{allowedPorts:[25565],maxBindings:0},
    occupiedBindings:2,remainingBindings:0,overLimit:true,outOfRangeBindings:1,limitApplicability:'shared-grant',
    counting:{unit:'protocol+port',tcpUdp:'separate',includesInternal:true,includesDraining:true},
    source:'runtime-port-slots',executionAuthorized:false,observedAt:'2026-10-21T00:00:00.000Z'};
  const view=personalPortUsageView(value,identity);
  assert.equal(view['个人绑定上限'],0);assert.equal(view['剩余绑定数'],0);assert.equal(view['数量是否超限'],'是');
  const unlimited={...value,portLimits:null,remainingBindings:null,overLimit:false,outOfRangeBindings:0};
  assert.equal(personalPortUsageView(unlimited,identity)['剩余绑定数'],'未设置数量上限');
  assert.equal(personalPortUsageView({...unlimited,resourceSource:'private',limitApplicability:'not-applicable'},identity)['剩余绑定数'],'不适用');
  assert.throws(()=>personalPortUsageView({...value,actorId:'actor-b'},identity));
  assert.throws(()=>personalPortUsageView({...value,remainingBindings:1},identity));
  assert.throws(()=>personalPortUsageView({...value,executionAuthorized:true},identity));
});
