import { MAX_COUNTER } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { DEFAULT_POLICY, digest } from '@tunex/contracts';
import type { MultihopConfig, Observation, Policy, RelayConfig, RuntimeAssignment, RuntimeMessages, RuntimeSnapshot } from '@tunex/contracts';
import { ControlError } from '../../application/errors.ts';
import { json, rows, write } from '../../infrastructure/mysql.ts';
import type { Transaction } from '../../infrastructure/mysql.ts';
import type { Nodes } from '../nodes.ts';
import type { Forwarding } from '../forwarding.ts';
import type { Transport } from '../transport.ts';
import type { RelayEndpoints } from '../relay-endpoints.ts';
import { compileRelayResources } from './relay-planner.ts';
import { compileRelayPlan, relayPeerPinsChanged } from './relay-plan.ts';
import type { RelayNodeExecutionFacts, RelayPreparedPlan } from './relay-plan.ts';
import type { RuntimeLedger, Operation } from './ledger.ts';
import { compileMultihopPlan, compileMultihopResources } from './multihop-plan.ts';
import type { MultihopPlanInput } from './multihop-plan.ts';

interface Deployment {
  forward_id: string; generation: number; target_revision: number;
  ingress_node_id: string; egress_node_id: string;
  stage: 'preparing'|'egress_active'|'ingress_active'|'active'|'withdrawn'; body: unknown;
  path_nodes?: unknown; prepared_count: number; activated_count: number;
}
type Report = RuntimeMessages['ReportRequest'];
interface RuntimeView { node_id:string; session_epoch:number; snapshot_generation:number; last_report:unknown; received_at:number|null }

export class RelayCoordinator {
  private readonly nodes:Nodes; private readonly forwarding:Forwarding; private readonly transport:Transport;
  private readonly endpoints:RelayEndpoints; private readonly ledger:RuntimeLedger; private readonly policy:Policy;
  readonly multihopEnabled:boolean;
  constructor(nodes:Nodes,forwarding:Forwarding,transport:Transport,endpoints:RelayEndpoints,ledger:RuntimeLedger,policy:Policy={...DEFAULT_POLICY},multihopEnabled=false){
    this.nodes=nodes;this.forwarding=forwarding;this.transport=transport;this.endpoints=endpoints;this.ledger=ledger;this.policy={...policy};this.multihopEnabled=multihopEnabled;
  }
  static async quarantineRecovery(tx:Transaction):Promise<void>{await write(tx,"UPDATE relay_deployments SET stage='withdrawn',updated_at=?",[Date.now()]);}
  private async latest(tx:Transaction,forwardId:string,lock=false):Promise<Deployment|undefined>{return (await rows<Deployment>(tx,`SELECT * FROM relay_deployments WHERE forward_id=? ORDER BY generation DESC LIMIT 1${lock?' FOR UPDATE':''}`,[forwardId]))[0];}
  private plan(record:Deployment):RelayPreparedPlan{
    const plan=json<RelayPreparedPlan>(record.body),{planDigest,...body}=plan;
    if(digest(body)!==planDigest||plan.forwardId!==record.forward_id||plan.forwardRevision!==record.target_revision||plan.deploymentGeneration!==record.generation)throw new ControlError('INTEGRITY_FAILURE',409,'Relay plan integrity differs');
    return plan;
  }
  async nodeIDs(tx:Transaction,forward:Forward):Promise<string[]>{
    const ids=new Set([forward.spec.ingress.nodeId,...forward.spec.path?.via??[]]);
    for(const record of await rows<Deployment>(tx,'SELECT * FROM relay_deployments WHERE forward_id=?',[forward.id]))for(const node of this.plan(record).nodes)ids.add(node.nodeId);
    return [...ids].sort();
  }
  async relatedNodeIDs(tx:Transaction,nodeId:string):Promise<string[]>{
    const links=(await rows<Deployment>(tx,'SELECT * FROM relay_deployments')).map(record=>this.plan(record).nodes.map(node=>node.nodeId));
    const ids=new Set([nodeId]);let changed=true;while(changed){changed=false;for(const link of links)if(link.some(id=>ids.has(id))){const previous=ids.size;for(const id of link)ids.add(id);changed ||= previous!==ids.size;}}
    return [...ids].sort();
  }
  async lockNodes(tx:Transaction,forward:Forward):Promise<void>{for(const nodeId of await this.nodeIDs(tx,forward))await this.ledger.lockNode(tx,nodeId);}
  private async facts(tx:Transaction,actor:string,forward:Forward):Promise<RelayNodeExecutionFacts[]>{
    if(!forward.spec.path||!forward.spec.transport||forward.spec.path.via.length>1&&!this.multihopEnabled)throw new ControlError('UNSUPPORTED_CAPABILITY',422,'Multi-hop execution is disabled or a locked Profile is missing');
    const result:RelayNodeExecutionFacts[]=[];
    for(const nodeId of [forward.spec.ingress.nodeId,...forward.spec.path.via].sort()){
      const facts=await this.nodes.authorizedRelayNode(tx,actor,forward.scopeId,nodeId);
      const state=await this.nodes.facts(tx,nodeId);
      const runtime=(await rows<{session_epoch:number}>(tx,'SELECT session_epoch FROM runtime_nodes WHERE node_id=?',[nodeId]))[0];
      if(!runtime?.session_epoch)throw new ControlError('SESSION_SUPERSEDED',409,'Every path Node requires an online session');
      const peers=await this.nodes.relayCredentialFacts(tx,nodeId,true);
      result.push({facts,sessionEpoch:runtime.session_epoch,credentialUntil:state.credentialUntil,peers});
    }
    return result;
  }
  async preview(tx:Transaction,actor:string,forward:Forward){
    if((forward.spec.path?.via.length??0)>1){
      const input=await this.multihopInput(tx,actor,forward);
      return {profile:{profileId:input.profile.profileId,revision:input.profile.revision,configDigest:input.profile.configDigest},endpointRevisions:Object.fromEntries(input.endpoints.map(e=>[e.nodeId,e.revision])),
        path:[forward.spec.ingress.nodeId,...forward.spec.path!.via],resources:compileMultihopResources(input),executionSupported:false,runtimeEnabled:this.multihopEnabled,reserved:false};
    }
    const facts=await this.facts(tx,actor,forward),profile=await this.transport.resolve(tx,actor,forward.scopeId,forward.spec.transport!.profileId,forward.spec.transport!.configRevision),endpoint=await this.endpoints.resolve(tx,forward.spec.path!.via[0]!);
    return {profile:{profileId:profile.profileId,revision:profile.revision,configDigest:profile.configDigest},endpointRevision:endpoint.revision,
      resources:compileRelayResources(forward,facts.map(n=>n.facts),profile,endpoint,{tcp:endpoint.config.allowedTcpPorts[0]!,udp:endpoint.config.allowedTcpPorts[forward.spec.protocols.length===2?1:0]!}),executionSupported:false,runtimeEnabled:true,reserved:false};
  }
  async status(tx:Transaction,forward:Forward){
    const record=await this.latest(tx,forward.id);if(!record)return null;const plan=this.plan(record);
    const renewalAllowed=await this.publishablePlan(tx,record,plan),operation=await this.ledger.latest(tx,forward.id);
    const nodes=[];
    for(const node of plan.nodes){
      const runtime=(await rows<RuntimeView>(tx,'SELECT * FROM runtime_nodes WHERE node_id=?',[node.nodeId]))[0];
      const published=runtime?.snapshot_generation?(await rows<{body:unknown}>(tx,'SELECT body FROM snapshots WHERE node_id=? AND generation=? AND session_epoch=?',[node.nodeId,runtime.snapshot_generation,runtime.session_epoch]))[0]:undefined;
      const snapshot=published?json<RuntimeSnapshot>(published.body):undefined,report=runtime?.last_report?json<Report>(runtime.last_report):undefined;
      const matches=runtime?.session_epoch===node.sessionEpoch&&report?.acceptedSnapshotGeneration===snapshot?.snapshotGeneration;
      const reportFresh=Boolean(matches&&runtime?.received_at!==null&&runtime?.received_at!==undefined&&
        runtime.received_at+this.policy.observationFreshnessSeconds*1000>Date.now()&&snapshot&&
        Date.parse(snapshot.validUntil)>Date.now()+this.policy.maxClockSkewSeconds*1000);
      nodes.push({nodeId:node.nodeId,sessionEpoch:node.sessionEpoch,currentSessionEpoch:runtime?.session_epoch??null,
        role:node.assignments[0]!.role,physicalResources:node.assignments.map(a=>a.resource),
        reportFresh,observations:reportFresh?report!.observations.filter(obs=>node.assignments.some(a=>a.assignmentId===obs.assignmentId&&a.deploymentGeneration===obs.deploymentGeneration&&a.bindingFence===obs.bindingFence&&
          snapshot!.assignments.some(current=>current.assignmentId===a.assignmentId&&current.deploymentGeneration===a.deploymentGeneration&&current.bindingFence===a.bindingFence&&current.driver.configDigest===a.driver.configDigest&&(obs.phase===current.phase||obs.phase==='absent')))):[],
        receivedAt:runtime?.received_at?new Date(runtime.received_at).toISOString():null,validUntil:snapshot?.validUntil??null,
        prepared:renewalAllowed&&await this.observed(tx,node,'prepared'),ready:renewalAllowed&&await this.observed(tx,node,'active')});
    }
    const isolation=await rows<{node_id:string;assignment_id:string;binding_fence:number;removed_epoch:number|null}>(tx,'SELECT node_id,assignment_id,binding_fence,removed_epoch FROM retirements WHERE forward_id=? AND safe=FALSE ORDER BY node_id,assignment_id',[forward.id]);
    return {generation:plan.deploymentGeneration,forwardRevision:plan.forwardRevision,stage:record.stage,
      preparedCount:plan.path?record.prepared_count:null,activatedCount:plan.path?record.activated_count:null,
      renewalAllowed,operation:operation?{id:operation.id,status:operation.status,sourceOperationId:operation.source_operation_id,lastError:json<unknown>(operation.last_error)}:null,
      activationOrder:[...plan.nodes].reverse().map(n=>n.nodeId),authorizationUntil:new Date(plan.authorizationUntil).toISOString(),nodes,isolation,trafficVerified:false};
  }
  async canExecute(tx:Transaction,actor:string,forward:Forward):Promise<boolean>{
    try{
      if((forward.spec.path?.via.length??0)>1){compileMultihopResources(await this.multihopInput(tx,actor,forward));return true;}
      const facts=await this.facts(tx,actor,forward),profile=await this.transport.resolve(tx,actor,forward.scopeId,forward.spec.transport!.profileId,forward.spec.transport!.configRevision),endpoint=await this.endpoints.resolve(tx,forward.spec.path!.via[0]!);
      const ports=endpoint.config.allowedTcpPorts;
      compileRelayResources({id:forward.id,scopeId:forward.scopeId,revision:forward.revision,spec:{...forward.spec,enabled:true}},facts.map(node=>node.facts),profile,endpoint,{tcp:ports[0]!,udp:ports[forward.spec.protocols.length===2?1:0]!});return true;
    }catch(error){if(error instanceof ControlError&&[403,404,409,422].includes(error.status))return false;if(error instanceof Error&&/^(UNSUPPORTED_CAPABILITY|AUTHORIZATION_DENIED|RESOURCE_CONFLICT):/.test(error.message))return false;throw error;}
  }
  async acceptPlan(tx:Transaction,actor:string,forward:Forward):Promise<RelayPreparedPlan>{
    await this.lockNodes(tx,forward);
    const previous=await this.latest(tx,forward.id,true),generation=Math.max(forward.revision,(previous?.generation??0)+1);
    if(generation>MAX_COUNTER)throw new ControlError('RESOURCE_LIMIT',429,'Relay generation exhausted');
    if((forward.spec.path?.via.length??0)>1){
      const input=await this.multihopInput(tx,actor,forward,previous?this.plan(previous):undefined,true);
      const reservations=await this.ledger.reserveRelay(tx,forward,compileMultihopResources(input),generation);
      const plan=compileMultihopPlan({...input,reservations,issuedAt:new Date().toISOString(),drainTimeoutSeconds:this.policy.drainTimeoutSeconds});
      await write(tx,'INSERT INTO relay_deployments(forward_id,generation,target_revision,ingress_node_id,egress_node_id,path_nodes,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
        [forward.id,generation,forward.revision,plan.path![0]!,plan.path!.at(-1)!,JSON.stringify(plan.path),JSON.stringify(plan),Date.now(),Date.now()]);
      return plan;
    }
    const facts=await this.facts(tx,actor,forward),profile=await this.transport.resolve(tx,actor,forward.scopeId,forward.spec.transport!.profileId,forward.spec.transport!.configRevision),endpoint=await this.endpoints.resolve(tx,forward.spec.path!.via[0]!);
    const old=previous?this.plan(previous):undefined,ports={} as Record<'tcp'|'udp',number>,used=new Set<number>();
    for(const protocol of forward.spec.protocols){
      const preferred=old?.nodes.find(node=>node.nodeId===endpoint.nodeId)?.assignments.find(a=>a.protocol===protocol&&a.role==='relay-egress')?.resource.port;
      const candidates=[...new Set([...(preferred&&endpoint.config.allowedTcpPorts.includes(preferred)?[preferred]:[]),...endpoint.config.allowedTcpPorts])];
      for(const port of candidates){if(used.has(port))continue;const slot=(await rows<{owner_id:string|null}>(tx,'SELECT owner_id FROM port_slots WHERE node_id=? AND protocol=\'tcp\' AND port=?',[endpoint.nodeId,port]))[0];if(!slot||slot.owner_id===null||slot.owner_id===forward.id){ports[protocol]=port;used.add(port);break;}}
      if(!ports[protocol])throw new ControlError('PORT_RESERVED',409,'No authorized exclusive internal TLS port is available');
    }
    const enabled={id:forward.id,scopeId:forward.scopeId,revision:forward.revision,spec:{...forward.spec,enabled:true}};
    const resources=compileRelayResources(enabled,facts.map(node=>node.facts),profile,endpoint,ports);
    const reservations=await this.ledger.reserveRelay(tx,forward,resources,generation);
    const plan=compileRelayPlan({forward:enabled,nodes:facts,profile,endpoint,reservations,issuedAt:new Date().toISOString(),drainTimeoutSeconds:this.policy.drainTimeoutSeconds});
    await write(tx,'INSERT INTO relay_deployments(forward_id,generation,target_revision,ingress_node_id,egress_node_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',[forward.id,generation,forward.revision,forward.spec.ingress.nodeId,forward.spec.path!.via[0]!,JSON.stringify(plan),Date.now(),Date.now()]);
    return plan;
  }
  private async multihopInput(tx:Transaction,actor:string,forward:Forward,previous?:RelayPreparedPlan,reserve=false):Promise<MultihopPlanInput>{
    const nodes=await this.facts(tx,actor,forward),profile=await this.transport.resolve(tx,actor,forward.scopeId,forward.spec.transport!.profileId,forward.spec.transport!.configRevision);
    const endpoints=[] as MultihopPlanInput['endpoints'][number][],ports:Record<string,Partial<Record<'tcp'|'udp',number>>>={};
    for(const id of [...forward.spec.path!.via].sort()){
      const endpoint=await this.endpoints.resolve(tx,id);endpoints.push(endpoint);ports[id]={};const used=new Set<number>();
      for(const protocol of forward.spec.protocols){
        const preferred=previous?.nodes.find(n=>n.nodeId===id)?.assignments.find(a=>a.protocol===protocol)?.resource.port;
        const candidates=[...new Set([...(preferred&&endpoint.config.allowedTcpPorts.includes(preferred)?[preferred]:[]),...endpoint.config.allowedTcpPorts])];
        for(const port of candidates){
          if(used.has(port))continue;
          const slot=reserve?(await rows<{owner_id:string|null}>(tx,"SELECT owner_id FROM port_slots WHERE node_id=? AND protocol='tcp' AND port=?",[id,port]))[0]:undefined;
          if(!slot||slot.owner_id===null||slot.owner_id===forward.id){ports[id]![protocol]=port;used.add(port);break;}
        }
        if(!ports[id]![protocol])throw new ControlError('PORT_RESERVED',409,'No exclusive multi-hop TLS resource is available');
      }
    }
    return {forward:{...forward,spec:{...forward.spec,enabled:true}},nodes,profile,endpoints,ports};
  }
  private pinsChanged(plan:RelayPreparedPlan,facts:readonly RelayNodeExecutionFacts[]):boolean{
    if(!plan.path)return relayPeerPinsChanged(plan,facts);
    return plan.nodes.some(node=>node.assignments.some(a=>(a.driver.config as MultihopConfig).hop.path.some(peer=>{
      const current=facts.find(n=>n.facts.nodeId===peer.nodeId);
      return !current||!current.peers.some(p=>p.fingerprint===peer.peerFingerprint&&p.validUntil>Date.now()+this.policy.maxClockSkewSeconds*1000);
    })));
  }
  private async authorized(tx:Transaction,forward:Forward,plan:RelayPreparedPlan):Promise<boolean>{
    const actor=await this.forwarding.authorizer(tx,forward.id);if(!actor)return false;
    if(!await this.canExecute(tx,actor,forward))return false;
    if(plan.path){
      if(!this.multihopEnabled||digest(plan.path)!==digest([forward.spec.ingress.nodeId,...forward.spec.path!.via])||plan.authorizationUntil<=Date.now()+2*this.policy.maxClockSkewSeconds*1000)return false;
      const input=await this.multihopInput(tx,actor,forward);
      if(input.endpoints.some(e=>e.revision!==plan.endpointRevisions?.[e.nodeId])||this.pinsChanged(plan,input.nodes))return false;
      return plan.nodes.every(node=>{
        const current=input.nodes.find(n=>n.facts.nodeId===node.nodeId);
        return current?.sessionEpoch===node.sessionEpoch&&node.assignments.every(a=>{
          const h=(a.driver.config as MultihopConfig).hop;
          return current.facts.egressPolicyRevision===h.egressPolicyRevision&&current.facts.allowMetadataTargets===h.allowMetadataTargets&&digest([...new Set(current.facts.allowedDestinationCidrs)].sort())===digest(h.allowedDestinationCidrs);
        });
      });
    }
    const facts=await this.facts(tx,actor,forward),endpoint=await this.endpoints.resolve(tx,forward.spec.path!.via[0]!);
    if(endpoint.revision!==plan.endpointRevision||plan.authorizationUntil<=Date.now()+2*this.policy.maxClockSkewSeconds*1000)return false;
    for(const node of plan.nodes){const current=facts.find(item=>item.facts.nodeId===node.nodeId);if(!current||current.sessionEpoch!==node.sessionEpoch)return false;
      for(const a of node.assignments){const config=a.driver.config as RelayConfig,peer=facts.find(item=>item.facts.nodeId===(a.role==='relay-ingress'?config.binding.egressNodeId:config.binding.ingressNodeId));
        if(current.facts.egressPolicyRevision!==config.egressPolicyRevision||current.facts.allowMetadataTargets!==config.allowMetadataTargets||digest([...new Set(current.facts.allowedDestinationCidrs)].sort())!==digest(config.allowedDestinationCidrs)||!peer||config.peerFingerprints.some(pin=>!peer.peers.some(credential=>credential.fingerprint===pin&&credential.validUntil>Date.now()+this.policy.maxClockSkewSeconds*1000)))return false;
      }
    }
    return true;
  }
  private async publishablePlan(tx:Transaction,record:Deployment,plan:RelayPreparedPlan,includeAccepted=false):Promise<boolean>{
    const op=await this.ledger.latest(tx,record.forward_id);
    if(!op||op.recovery_invalidated||op.kind==='revoke'||!['running','succeeded',...(includeAccepted?['accepted']:[])].includes(op.status)||op.status!=='succeeded'&&op.execution_deadline<=Date.now())return false;
    const forward=await this.forwarding.record(tx,op.scope_id,record.forward_id);
    return !forward.deleting&&!forward.recoverySuspended&&forward.spec.enabled&&forward.revision===record.target_revision&&record.stage!=='withdrawn'&&await this.authorized(tx,forward,plan);
  }
  async assignments(tx:Transaction,nodeId:string,includeAccepted=false):Promise<RuntimeAssignment[]>{
    const records=await rows<Deployment>(tx,'SELECT d.* FROM relay_deployments d WHERE (d.ingress_node_id=? OR d.egress_node_id=? OR JSON_CONTAINS(d.path_nodes,JSON_QUOTE(?))) AND d.generation=(SELECT MAX(generation) FROM relay_deployments WHERE forward_id=d.forward_id) ORDER BY d.forward_id',[nodeId,nodeId,nodeId]);
    const result:RuntimeAssignment[]=[];
    for(const record of records){const plan=this.plan(record);if(!await this.publishablePlan(tx,record,plan,includeAccepted))continue;
      const node=plan.nodes.find(node=>node.nodeId===nodeId);if(!node)throw new Error('Missing Relay node plan');
      if(plan.path){
        if(!includeAccepted&&!await this.ledger.sessionAuthoritySafe(tx,nodeId,node.sessionEpoch))continue;
        const index=plan.path.indexOf(nodeId),count=plan.path.length;
        if(!includeAccepted&&record.stage==='preparing'&&index<count-Math.min(count,record.prepared_count+1))continue;
        const active=record.stage==='active'||record.stage!=='preparing'&&index>=count-record.activated_count;
        for(const assignment of node.assignments)result.push({...assignment,phase:active?'active':'prepared'});
        continue;
      }
      for(const assignment of node.assignments){const active=record.stage==='ingress_active'||record.stage==='active'||record.stage==='egress_active'&&assignment.role==='relay-egress';result.push({...assignment,phase:active?'active':'prepared'});}
    }
    return result;
  }
  async authorizationBound(tx:Transaction,assignments:readonly RuntimeAssignment[]):Promise<number>{
    let bound=Number.MAX_SAFE_INTEGER;
    for(const id of new Set(assignments.filter(a=>a.role!=='direct').map(a=>a.forwardId))){
      const record=await this.latest(tx,id);if(!record)throw new Error('Missing Relay authority');
      const plan=this.plan(record);bound=Math.min(bound,plan.authorizationUntil);
      for(const node of plan.nodes){
        const current=await this.nodes.facts(tx,node.nodeId),peers=await this.nodes.relayCredentialFacts(tx,node.nodeId);
        const pinned=new Set(plan.nodes.flatMap(part=>part.assignments.flatMap(a=>{
          if(plan.path)return (a.driver.config as MultihopConfig).hop.path.filter(peer=>peer.nodeId===node.nodeId).map(peer=>peer.peerFingerprint);
          const config=a.driver.config as RelayConfig;
          const peerId=a.role==='relay-ingress'?config.binding.egressNodeId:config.binding.ingressNodeId;
          return peerId===node.nodeId?config.peerFingerprints:[];
        })));
        const credentials=peers.filter(peer=>pinned.has(peer.fingerprint));
        if(credentials.length!==pinned.size)throw new ControlError('AUTHORIZATION_DENIED',403,'Pinned Relay authority expired');
        bound=Math.min(bound,current.credentialUntil,...credentials.map(peer=>peer.validUntil));
      }
    }
    return bound;
  }
  private async observed(tx:Transaction,node:RelayPreparedPlan['nodes'][number],phase:'prepared'|'active'):Promise<boolean>{
    const runtime=(await rows<RuntimeView>(tx,'SELECT * FROM runtime_nodes WHERE node_id=?',[node.nodeId]))[0];
    if(!runtime||runtime.session_epoch!==node.sessionEpoch||!runtime.last_report||runtime.received_at===null||runtime.received_at+this.policy.observationFreshnessSeconds*1000<=Date.now())return false;
    const report=json<Report>(runtime.last_report);
    if(report.sessionEpoch!==node.sessionEpoch||report.acceptedSnapshotGeneration!==runtime.snapshot_generation)return false;
    const published=(await rows<{body:unknown}>(tx,'SELECT body FROM snapshots WHERE node_id=? AND generation=? AND session_epoch=?',[node.nodeId,runtime.snapshot_generation,node.sessionEpoch]))[0];
    if(!published)return false;const snapshot=json<RuntimeSnapshot>(published.body);
    if(Date.parse(snapshot.validUntil)<=Date.now()+this.policy.maxClockSkewSeconds*1000)return false;
    return node.assignments.every(a=>snapshot.assignments.some(current=>current.assignmentId===a.assignmentId&&current.deploymentGeneration===a.deploymentGeneration&&current.bindingFence===a.bindingFence&&current.driver.configDigest===a.driver.configDigest&&current.phase===phase)&&report.observations.some(obs=>obs.assignmentId===a.assignmentId&&obs.deploymentGeneration===a.deploymentGeneration&&obs.bindingFence===a.bindingFence&&obs.phase===phase&&obs.condition===(phase==='prepared'?'prepared':'ready')));
  }
  async executionError(tx:Transaction,snapshot:RuntimeSnapshot,assignment:RuntimeAssignment,observation:Observation):Promise<void>{
    if(observation.condition!=='error'||!assignment.role.startsWith('multihop-')||observation.assignmentId!==assignment.assignmentId||observation.deploymentGeneration!==assignment.deploymentGeneration||observation.bindingFence!==assignment.bindingFence)return;
    const record=await this.latest(tx,assignment.forwardId,true);if(!record)return;
    const plan=this.plan(record),node=plan.nodes.find(n=>n.nodeId===snapshot.nodeId&&n.sessionEpoch===snapshot.sessionEpoch);
    // An old but still published Snapshot must not fail its accepted successor.
    if(!plan.path||record.stage==='withdrawn'||!node||!node.assignments.some(a=>a.assignmentId===assignment.assignmentId&&a.deploymentGeneration===assignment.deploymentGeneration&&a.bindingFence===assignment.bindingFence&&a.driver.configDigest===assignment.driver.configDigest))return;
    const op=await this.ledger.latest(tx,assignment.forwardId);
    if(!op||op.recovery_invalidated||op.target_revision!==record.target_revision||op.kind==='revoke'||!['running','succeeded'].includes(op.status))return;
    const forward=await this.forwarding.record(tx,op.scope_id,op.forward_id);
    if(forward.deleting||forward.recoverySuspended||!forward.spec.enabled||forward.revision!==plan.forwardRevision)return;
    const error={code:observation.errorCode,retryable:observation.retryable,nodeId:snapshot.nodeId,sessionEpoch:snapshot.sessionEpoch,
      assignmentId:assignment.assignmentId,deploymentGeneration:assignment.deploymentGeneration,bindingFence:assignment.bindingFence};
    if(observation.retryable){
      if(op.status==='running')await write(tx,'UPDATE operations SET last_error=?,updated_at=? WHERE id=?',[JSON.stringify(error),Date.now(),op.id]);
      return;
    }
    // Preserve successful deployment history; a subsequent failure is a new,
    // explicitly failed operation that can be retried through fresh authority.
    const id=op.status==='succeeded'?await this.ledger.accept(tx,forward,{
      actorId:op.requested_by,scopeId:op.scope_id,key:`multihop-error:${record.generation}`,
      digest:digest({sourceOperationId:op.id,...error}),
    },'policy',forward.spec,op.id):op.id;
    await write(tx,"UPDATE operations SET status='failed',last_error=?,cleanup_pending=TRUE,claim_token=NULL,claim_until=NULL,updated_at=? WHERE id=?",[JSON.stringify(error),Date.now(),id]);
    await write(tx,"UPDATE relay_deployments SET stage='withdrawn',updated_at=? WHERE forward_id=? AND generation=?",[Date.now(),record.forward_id,record.generation]);
  }
  async advance(tx:Transaction,forwardId:string):Promise<void>{
    const record=await this.latest(tx,forwardId,true),op=await this.ledger.latest(tx,forwardId);if(!record||!op||op.recovery_invalidated)return;
    await write(tx,'UPDATE relay_deployments SET updated_at=? WHERE forward_id=? AND generation=?',[Date.now(),forwardId,record.generation]);
    const forward=await this.forwarding.record(tx,op.scope_id,forwardId),plan=this.plan(record);
    if(op.status!=='running'&&op.status!=='succeeded'&&!(op.status==='failed'&&op.cleanup_pending))return;
    if(!forward.spec.path){await write(tx,"UPDATE relay_deployments SET stage='withdrawn',updated_at=? WHERE forward_id=? AND generation=?",[Date.now(),forwardId,record.generation]);return;}
    if(op.status!=='failed'&&!forward.deleting&&forward.spec.enabled&&op.kind!=='revoke'&&!forward.recoverySuspended&&forward.revision===plan.forwardRevision){
      const staleSession=(await Promise.all(plan.nodes.map(async node=>(await rows<{session_epoch:number}>(tx,'SELECT session_epoch FROM runtime_nodes WHERE node_id=?',[node.nodeId]))[0]?.session_epoch!==node.sessionEpoch))).some(Boolean);
      const actor=await this.forwarding.authorizer(tx,forward.id);
      if(actor&&await this.canExecute(tx,actor,forward)){
        const current=await this.facts(tx,actor,forward);
        const changedPins=this.pinsChanged(plan,current);
        const currentBound=Math.min(...current.map(n=>Math.min(n.credentialUntil,...n.peers.map(p=>p.validUntil))));
        const renewedAuthority=plan.authorizationUntil<=Date.now()+this.policy.renewalLeadSeconds*1000&&currentBound>plan.authorizationUntil;
        if(staleSession||changedPins||renewedAuthority){
          const reason=staleSession?'new-session':changedPins?'peer-credential':'credential-renewal';
          await this.acceptPlan(tx,actor,forward);
          await this.ledger.accept(tx,forward,{actorId:op.requested_by,scopeId:forward.scopeId,key:`relay-refresh:${record.generation}`,digest:digest({forwardId,generation:record.generation,reason})},'policy',forward.spec,op.id);
          for(const nodeId of await this.nodeIDs(tx,forward))await this.ledger.assertCapacity(tx,this.forwarding,await this.nodes.cleanupFacts(tx,nodeId,forward.scopeId));
          return;
        }
      }
    }
    const stopped=forward.deleting||!forward.spec.enabled||op.kind==='revoke'||op.status==='failed'||forward.recoverySuspended||!await this.authorized(tx,forward,plan);
    if(stopped){await write(tx,"UPDATE relay_deployments SET stage='withdrawn',updated_at=? WHERE forward_id=? AND generation=?",[Date.now(),forwardId,record.generation]);await this.complete(tx,{...record,stage:'withdrawn'},forward,op,plan);return;}
    if(plan.path){await this.advanceMultihop(tx,record,forward,op,plan);return;}
    const ingress=plan.nodes.find(node=>node.nodeId===record.ingress_node_id)!,egress=plan.nodes.find(node=>node.nodeId===record.egress_node_id)!;
    let next=record.stage;
    if(record.stage==='preparing'&&await this.observed(tx,ingress,'prepared')&&await this.observed(tx,egress,'prepared'))next='egress_active';
    else if(record.stage==='egress_active'&&await this.observed(tx,egress,'active')&&await this.observed(tx,ingress,'prepared'))next='ingress_active';
    else if(record.stage==='ingress_active'&&await this.observed(tx,ingress,'active')&&await this.observed(tx,egress,'active'))next='active';
    if(next!==record.stage)await write(tx,'UPDATE relay_deployments SET stage=?,updated_at=? WHERE forward_id=? AND generation=?',[next,Date.now(),forwardId,record.generation]);
    if(next==='active')await this.complete(tx,{...record,stage:next},forward,op,plan);
  }
  private async advanceMultihop(tx:Transaction,record:Deployment,forward:Forward&{deleting:boolean},op:Operation,plan:RelayPreparedPlan):Promise<void>{
    const count=plan.nodes.length;
    if(record.stage==='preparing'){
      // Only the next downstream node is admitted; receipt alone cannot advance this cursor.
      const expected=plan.nodes.slice(Math.max(0,count-record.prepared_count-1));
      if(!(await Promise.all(expected.map(n=>this.observed(tx,n,'prepared')))).every(Boolean))return;
      const prepared=record.prepared_count+1;
      await write(tx,'UPDATE relay_deployments SET prepared_count=?,stage=?,activated_count=?,updated_at=? WHERE forward_id=? AND generation=?',
        [prepared,prepared===count?'egress_active':'preparing',prepared===count?1:0,Date.now(),forward.id,record.generation]);
      return;
    }
    if(record.stage==='egress_active'){
      if(!(await Promise.all(plan.nodes.map((n,index)=>this.observed(tx,n,index>=count-record.activated_count?'active':'prepared')))).every(Boolean))return;
      if(record.activated_count<count){await write(tx,'UPDATE relay_deployments SET activated_count=activated_count+1,updated_at=? WHERE forward_id=? AND generation=?',[Date.now(),forward.id,record.generation]);return;}
      await write(tx,"UPDATE relay_deployments SET stage='active',updated_at=? WHERE forward_id=? AND generation=?",[Date.now(),forward.id,record.generation]);
      record={...record,stage:'active'};
    }
    if(record.stage==='active')await this.complete(tx,record,forward,op,plan);
  }
  private async complete(tx:Transaction,record:Deployment,forward:Forward&{deleting:boolean},op:Operation,plan:RelayPreparedPlan):Promise<void>{
    const pending=(await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM retirements WHERE forward_id=? AND safe=FALSE',[forward.id]))[0]!.n;if(pending)return;
    const stopped=forward.deleting||!forward.spec.enabled||op.kind==='revoke'||record.stage==='withdrawn';
    if(stopped){
      for(const nodeId of await this.nodeIDs(tx,forward)){const published=(await rows<{body:unknown;valid_until:number}>(tx,'SELECT body,valid_until FROM snapshots WHERE node_id=? ORDER BY generation DESC LIMIT 1',[nodeId]))[0];if(published&&published.valid_until+this.policy.maxClockSkewSeconds*1000>Date.now()&&json<RuntimeSnapshot>(published.body).assignments.some(a=>a.forwardId===forward.id))return;}
      const unsafe=(await rows<{n:number}>(tx,'SELECT COUNT(*) n FROM execution_leases l LEFT JOIN retirements r ON r.node_id=l.node_id AND r.assignment_id=l.assignment_id AND r.deployment_generation=l.deployment_generation AND r.binding_fence=l.binding_fence WHERE l.forward_id=? AND (r.safe IS NULL OR r.safe=FALSE)',[forward.id]))[0]!.n;if(unsafe)return;
      if(forward.deleting)await this.ledger.releaseForwardSlots(tx,forward.id);
    }else{
      if(record.stage!=='active'||!(await Promise.all(plan.nodes.map(node=>this.observed(tx,node,'active')))).every(Boolean))return;
      if(!await this.ledger.previousLeasesSafe(tx,forward.id,plan.nodes))return;
      const desired=new Set(plan.nodes.flatMap(node=>node.assignments.map(a=>`${node.nodeId}/${a.resource.protocol}/${a.resource.port}`)));
      for(const slot of await rows<{node_id:string;protocol:string;port:number}>(tx,'SELECT node_id,protocol,port FROM port_slots WHERE owner_id=?',[forward.id]))if(!desired.has(`${slot.node_id}/${slot.protocol}/${slot.port}`))await write(tx,'UPDATE port_slots SET owner_id=NULL WHERE node_id=? AND protocol=? AND port=? AND owner_id=?',[slot.node_id,slot.protocol,slot.port,forward.id]);
    }
    if(op.status==='running'&&op.execution_deadline>Date.now()&&(stopped&&forward.deleting||stopped&&!forward.spec.enabled||stopped&&op.kind==='revoke'||!stopped))await write(tx,"UPDATE operations SET status='succeeded',cleanup_pending=FALSE,claim_token=NULL,claim_until=NULL,updated_at=? WHERE id=? AND status='running' AND execution_deadline>?",[Date.now(),op.id,Date.now()]);
    if(op.status==='succeeded'||stopped)await write(tx,"UPDATE operations SET cleanup_pending=FALSE,updated_at=? WHERE forward_id=? AND status IN ('succeeded','failed','superseded')",[Date.now(),forward.id]);
  }
  async advanceForNode(tx:Transaction,nodeId:string):Promise<void>{for(const record of await rows<{forward_id:string}>(tx,'SELECT DISTINCT forward_id FROM relay_deployments WHERE ingress_node_id=? OR egress_node_id=? OR JSON_CONTAINS(path_nodes,JSON_QUOTE(?)) ORDER BY forward_id',[nodeId,nodeId,nodeId]))await this.advance(tx,record.forward_id);}
  async pendingNodeIDs(tx:Transaction):Promise<string[]>{
    const ids=new Set<string>(),ingresses=new Set<string>();
    for(const record of await rows<Deployment>(tx,"SELECT d.* FROM relay_deployments d WHERE d.generation=(SELECT MAX(generation) FROM relay_deployments WHERE forward_id=d.forward_id) AND (d.stage<>'withdrawn' OR EXISTS(SELECT 1 FROM operations o WHERE o.forward_id=d.forward_id AND o.recovery_invalidated=FALSE AND (o.status IN ('accepted','running') OR o.cleanup_pending=TRUE))) ORDER BY d.updated_at,d.forward_id LIMIT 100")){
      ingresses.add(record.ingress_node_id);
      for(const node of this.plan(record).nodes)ids.add(node.nodeId);
      for(const lease of await rows<{node_id:string}>(tx,'SELECT DISTINCT node_id FROM execution_leases WHERE forward_id=?',[record.forward_id]))ids.add(lease.node_id);
    }
    return [...ids].sort((a,b)=>Number(ingresses.has(b))-Number(ingresses.has(a))||(a<b?-1:a>b?1:0));
  }
}
