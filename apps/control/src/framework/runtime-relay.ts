import { MAX_COUNTER } from '@tunex/core';
import type { Forward } from '@tunex/core';
import type { RuntimeValueFamily, RuntimeAssignmentFor as RuntimeAssignment, RuntimeSnapshotFor as RuntimeSnapshot, RuntimeReportRequestFor as Report } from '@tunex/contracts/execution-values';
import type { Observation } from '@tunex/contracts/execution-observation';
import type { Policy } from '@tunex/contracts/policy';
import { ControlError } from './errors.ts';
import type { RuntimeOperation as Operation, RuntimeLedgerForwards } from './runtime-ledger-ports.ts';
import type { RuntimeRelayNodes, RuntimeRelayTransport, RuntimeRelayEndpointResolver, RuntimeRelayLedger,
  RuntimeRelayStore, RuntimeRelayObservations, RuntimeRelayCompiler, RuntimeRelayOptions,
  RuntimeRelayDeployment as Deployment, RuntimeRelayNodeFacts as RelayNodeExecutionFacts,
  RuntimeRelayPlan as RelayPreparedPlan, RuntimeMultihopInput as MultihopPlanInput } from './runtime-relay-ports.ts';
import type { RelayAssignmentReader, RelayForwardAssignmentReader, SnapshotContribution } from './runtime-assignment-ports.ts';


export class RuntimeRelayHost<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> implements RelayAssignmentReader<Tx,F>, RelayForwardAssignmentReader<Tx,F> {
  private readonly nodes:RuntimeRelayNodes<Tx>; private readonly forwarding:RuntimeLedgerForwards<Tx>; private readonly transport:RuntimeRelayTransport<Tx,F>;
  private readonly endpoints:RuntimeRelayEndpointResolver<Tx>; private readonly ledger:RuntimeRelayLedger<Tx,F>; private readonly policy:Policy;
  private readonly store:RuntimeRelayStore<Tx,F>; private readonly observations:RuntimeRelayObservations<Tx>;
  private readonly compiler:RuntimeRelayCompiler<F>; private readonly now:()=>number;
  readonly multihopEnabled:boolean;
  constructor(options:RuntimeRelayOptions<Tx,F>){
    if(typeof options.compiler?.parseTime!=='function'||typeof options.compiler?.formatTime!=='function')
      throw new Error('Runtime relay time codec is required');
    if(typeof options.compiler?.relayAssignmentPolicy!=='function'||typeof options.compiler?.multihopAssignmentPolicy!=='function')
      throw new Error('Runtime relay assignment projections are required');
    this.nodes=options.nodes;this.forwarding=options.forwards;this.transport=options.transport;this.endpoints=options.endpoints;
    this.ledger=options.ledger;this.policy={...options.policy};this.multihopEnabled=options.multihopEnabled;
    this.store=options.store;this.observations=options.observations;this.compiler=options.compiler;this.now=options.now;
  }
  quarantineRecovery(tx:Tx):Promise<void>{return this.store.quarantine(tx,this.now());}
  private latest(tx:Tx,forwardId:string,lock=false):Promise<Deployment|undefined>{return this.store.latest(tx,forwardId,lock);}
  private plan(record:Deployment):RelayPreparedPlan<F>{
    const plan=this.compiler.readValue<RelayPreparedPlan<F>>(record.body),{planDigest,...body}=plan;
    if(this.compiler.digest(body)!==planDigest||plan.forwardId!==record.forward_id||plan.forwardRevision!==record.target_revision||plan.deploymentGeneration!==record.generation)throw new ControlError('INTEGRITY_FAILURE',409,'Relay plan integrity differs');
    return plan;
  }
  async nodeIDs(tx:Tx,forward:Forward):Promise<string[]>{
    const ids=new Set([forward.spec.ingress.nodeId,...forward.spec.path?.via??[]]);
    for(const record of await this.store.forForward(tx,forward.id))for(const node of this.plan(record).nodes)ids.add(node.nodeId);
    return [...ids].sort();
  }
  async relatedNodeIDs(tx:Tx,nodeId:string):Promise<string[]>{
    const links=(await this.store.allDeployments(tx)).map(record=>this.plan(record).nodes.map(node=>node.nodeId));
    const ids=new Set([nodeId]);let changed=true;while(changed){changed=false;for(const link of links)if(link.some(id=>ids.has(id))){const previous=ids.size;for(const id of link)ids.add(id);changed ||= previous!==ids.size;}}
    return [...ids].sort();
  }
  async lockNodes(tx:Tx,forward:Forward):Promise<void>{for(const nodeId of await this.nodeIDs(tx,forward))await this.ledger.lockNode(tx,nodeId);}
  private async facts(tx:Tx,actor:string,forward:Forward):Promise<RelayNodeExecutionFacts[]>{
    if(!forward.spec.path||!forward.spec.transport||forward.spec.path.via.length>1&&!this.multihopEnabled)throw new ControlError('UNSUPPORTED_CAPABILITY',422,'Multi-hop execution is disabled or a locked Profile is missing');
    const result:RelayNodeExecutionFacts[]=[];
    const path=[forward.spec.ingress.nodeId,...forward.spec.path.via];
    const roles=new Map(path.map((nodeId,index)=>[nodeId,index===0?'ingress' as const:index===path.length-1?'egress' as const:'transit' as const]));
    for(const nodeId of [...path].sort()){
      const facts=await this.nodes.authorizedRelayNode(tx,actor,forward.scopeId,nodeId,roles.get(nodeId)!,forward);
      const state=await this.nodes.facts(tx,nodeId);
      const runtime=await this.observations.nodeSession(tx,nodeId);
      if(!runtime?.session_epoch)throw new ControlError('SESSION_SUPERSEDED',409,'Every path Node requires an online session');
      const peers=await this.nodes.relayCredentialFacts(tx,nodeId,true);
      result.push({facts,sessionEpoch:runtime.session_epoch,credentialUntil:state.credentialUntil,peers});
    }
    return result;
  }
  async preview(tx:Tx,actor:string,forward:Forward){
    if((forward.spec.path?.via.length??0)>1){
      const input=await this.multihopInput(tx,actor,forward);
      return {profile:{profileId:input.profile.profileId,revision:input.profile.revision,configDigest:input.profile.configDigest},endpointRevisions:Object.fromEntries(input.endpoints.map(e=>[e.nodeId,e.revision])),
        path:[forward.spec.ingress.nodeId,...forward.spec.path!.via],resources:this.compiler.multihopResources(input),executionSupported:false,runtimeEnabled:this.multihopEnabled,reserved:false};
    }
    const facts=await this.facts(tx,actor,forward),profile=await this.transport.resolve(tx,actor,forward.scopeId,forward.spec.transport!.profileId,forward.spec.transport!.configRevision),endpoint=await this.endpoints.resolve(tx,forward.spec.path!.via[0]!);
    const ports=await this.nodes.reservationPorts(tx,actor,forward.scopeId,endpoint.nodeId,endpoint.config.allowedTcpPorts);
    return {profile:{profileId:profile.profileId,revision:profile.revision,configDigest:profile.configDigest},endpointRevision:endpoint.revision,
      resources:this.compiler.relayResources(forward,facts.map(n=>n.facts),profile,endpoint,{tcp:ports[0]!,udp:ports[forward.spec.protocols.length===2?1:0]!}),executionSupported:false,runtimeEnabled:true,reserved:false};
  }
  async status(tx:Tx,forward:Forward){
    const record=await this.latest(tx,forward.id);if(!record)return null;const plan=this.plan(record);
    const renewalAllowed=await this.publishablePlan(tx,record,plan),operation=await this.ledger.latest(tx,forward.id);
    const nodes=[];
    for(const node of plan.nodes){
      const runtime=await this.observations.runtimeNode(tx,node.nodeId);
      const published=runtime?.snapshot_generation?await this.observations.snapshot(tx,node.nodeId,runtime.snapshot_generation,runtime.session_epoch):undefined;
      const snapshot=published?this.compiler.readValue<RuntimeSnapshot<F>>(published.body):undefined,report=runtime?.last_report?this.compiler.readValue<Report<F>>(runtime.last_report):undefined;
      const matches=runtime?.session_epoch===node.sessionEpoch&&report?.acceptedSnapshotGeneration===snapshot?.snapshotGeneration;
      const reportFresh=Boolean(matches&&runtime?.received_at!==null&&runtime?.received_at!==undefined&&
        runtime.received_at+this.policy.observationFreshnessSeconds*1000>this.now()&&snapshot&&
        this.compiler.parseTime(snapshot.validUntil)>this.now()+this.policy.maxClockSkewSeconds*1000);
      nodes.push({nodeId:node.nodeId,sessionEpoch:node.sessionEpoch,currentSessionEpoch:runtime?.session_epoch??null,
        role:node.assignments[0]!.role,physicalResources:node.assignments.map(a=>a.resource),
        reportFresh,observations:reportFresh?report!.observations.filter(obs=>node.assignments.some(a=>a.assignmentId===obs.assignmentId&&a.deploymentGeneration===obs.deploymentGeneration&&a.bindingFence===obs.bindingFence&&
          snapshot!.assignments.some(current=>current.assignmentId===a.assignmentId&&current.deploymentGeneration===a.deploymentGeneration&&current.bindingFence===a.bindingFence&&current.driver.configDigest===a.driver.configDigest&&(obs.phase===current.phase||obs.phase==='absent')))):[],
        receivedAt:runtime?.received_at?this.compiler.formatTime(runtime.received_at):null,validUntil:snapshot?.validUntil??null,
        prepared:renewalAllowed&&await this.observed(tx,node,'prepared'),ready:renewalAllowed&&await this.observed(tx,node,'active')});
    }
    const isolation=await this.observations.isolation(tx,forward.id);
    return {generation:plan.deploymentGeneration,forwardRevision:plan.forwardRevision,stage:record.stage,
      preparedCount:plan.path?record.prepared_count:null,activatedCount:plan.path?record.activated_count:null,
      renewalAllowed,operation:operation?{id:operation.id,status:operation.status,sourceOperationId:operation.source_operation_id,lastError:this.compiler.readValue<unknown>(operation.last_error)}:null,
      activationOrder:[...plan.nodes].reverse().map(n=>n.nodeId),authorizationUntil:this.compiler.formatTime(plan.authorizationUntil),nodes,isolation,trafficVerified:false};
  }
  async canExecute(tx:Tx,actor:string,forward:Forward):Promise<boolean>{
    try{
      if((forward.spec.path?.via.length??0)>1){this.compiler.multihopResources(await this.multihopInput(tx,actor,forward));return true;}
      const facts=await this.facts(tx,actor,forward),profile=await this.transport.resolve(tx,actor,forward.scopeId,forward.spec.transport!.profileId,forward.spec.transport!.configRevision),endpoint=await this.endpoints.resolve(tx,forward.spec.path!.via[0]!);
      const ports=await this.nodes.reservationPorts(tx,actor,forward.scopeId,endpoint.nodeId,endpoint.config.allowedTcpPorts);
      this.compiler.relayResources({id:forward.id,scopeId:forward.scopeId,revision:forward.revision,spec:{...forward.spec,enabled:true}},facts.map(node=>node.facts),profile,endpoint,{tcp:ports[0]!,udp:ports[forward.spec.protocols.length===2?1:0]!});return true;
    }catch(error){if(this.executionRefused(error))return false;throw error;}
  }
  private executionRefused(error:unknown):boolean{
    return error instanceof ControlError&&[403,404,409,422,429].includes(error.status)||
      error instanceof Error&&/^(UNSUPPORTED_CAPABILITY|AUTHORIZATION_DENIED|RESOURCE_CONFLICT):/.test(error.message);
  }
  async acceptPlan(tx:Tx,actor:string,forward:Forward):Promise<RelayPreparedPlan<F>>{
    await this.lockNodes(tx,forward);
    const previous=await this.latest(tx,forward.id,true),generation=Math.max(forward.revision,(previous?.generation??0)+1);
    if(generation>MAX_COUNTER)throw new ControlError('RESOURCE_LIMIT',429,'Relay generation exhausted');
    if((forward.spec.path?.via.length??0)>1){
      const input=await this.multihopInput(tx,actor,forward,previous?this.plan(previous):undefined,true);
      const reservations=await this.ledger.reserveRelay(tx,forward,this.compiler.multihopResources(input),generation,actor);
      const plan=this.compiler.multihopPlan({...input,reservations,issuedAt:this.compiler.formatTime(this.now()),drainTimeoutSeconds:this.policy.drainTimeoutSeconds});
      await this.store.insertMultihop(tx,forward,generation,plan,this.now(),this.now());
      return plan;
    }
    const facts=await this.facts(tx,actor,forward),profile=await this.transport.resolve(tx,actor,forward.scopeId,forward.spec.transport!.profileId,forward.spec.transport!.configRevision),endpoint=await this.endpoints.resolve(tx,forward.spec.path!.via[0]!);
    const old=previous?this.plan(previous):undefined,ports={} as Record<'tcp'|'udp',number>,used=new Set<number>();
    for(const protocol of forward.spec.protocols){
      const preferred=old?.nodes.find(node=>node.nodeId===endpoint.nodeId)?.assignments.find(a=>a.protocol===protocol&&a.role==='relay-egress')?.resource.port;
      const allowed=await this.nodes.reservationPorts(tx,actor,forward.scopeId,endpoint.nodeId,endpoint.config.allowedTcpPorts);
      const candidates=[...new Set([...(preferred&&allowed.includes(preferred)?[preferred]:[]),...allowed])];
      for(const port of candidates){if(used.has(port))continue;const slot=await this.observations.portOwner(tx,endpoint.nodeId,port);if(!slot||slot.owner_id===null||slot.owner_id===forward.id){ports[protocol]=port;used.add(port);break;}}
      if(!ports[protocol])throw new ControlError('PORT_RESERVED',409,'No authorized exclusive internal TLS port is available');
    }
    const enabled={id:forward.id,scopeId:forward.scopeId,revision:forward.revision,spec:{...forward.spec,enabled:true}};
    const resources=this.compiler.relayResources(enabled,facts.map(node=>node.facts),profile,endpoint,ports);
    const reservations=await this.ledger.reserveRelay(tx,forward,resources,generation,actor);
    const plan=this.compiler.relayPlan({forward:enabled,nodes:facts,profile,endpoint,reservations,issuedAt:this.compiler.formatTime(this.now()),drainTimeoutSeconds:this.policy.drainTimeoutSeconds});
    await this.store.insertRelay(tx,forward,generation,plan,this.now(),this.now());
    return plan;
  }
  private async multihopInput(tx:Tx,actor:string,forward:Forward,previous?:RelayPreparedPlan<F>,reserve=false):Promise<MultihopPlanInput<F>>{
    const nodes=await this.facts(tx,actor,forward),profile=await this.transport.resolve(tx,actor,forward.scopeId,forward.spec.transport!.profileId,forward.spec.transport!.configRevision);
    const endpoints=[] as MultihopPlanInput<F>['endpoints'][number][],ports:Record<string,Partial<Record<'tcp'|'udp',number>>>={};
    for(const id of [...forward.spec.path!.via].sort()){
      const endpoint=await this.endpoints.resolve(tx,id);endpoints.push(endpoint);ports[id]={};const used=new Set<number>();
      for(const protocol of forward.spec.protocols){
        const preferred=previous?.nodes.find(n=>n.nodeId===id)?.assignments.find(a=>a.protocol===protocol)?.resource.port;
        const allowed=await this.nodes.reservationPorts(tx,actor,forward.scopeId,endpoint.nodeId,endpoint.config.allowedTcpPorts);
        const candidates=[...new Set([...(preferred&&allowed.includes(preferred)?[preferred]:[]),...allowed])];
        for(const port of candidates){
          if(used.has(port))continue;
          const slot=reserve?await this.observations.portOwner(tx,id,port):undefined;
          if(!slot||slot.owner_id===null||slot.owner_id===forward.id){ports[id]![protocol]=port;used.add(port);break;}
        }
        if(!ports[id]![protocol])throw new ControlError('PORT_RESERVED',409,'No exclusive multi-hop TLS resource is available');
      }
    }
    // Stored Forward records also carry lifecycle metadata, not domain intent.
    return {forward:{id:forward.id,scopeId:forward.scopeId,revision:forward.revision,spec:{...forward.spec,enabled:true}},nodes,profile,endpoints,ports};
  }
  private pinsChanged(plan:RelayPreparedPlan<F>,facts:readonly RelayNodeExecutionFacts[]):boolean{
    if(!plan.path)return this.compiler.peerPinsChanged(plan,facts);
    return plan.nodes.some(node=>node.assignments.some(a=>this.compiler.multihopAssignmentPolicy(a).path.some(peer=>{
      const current=facts.find(n=>n.facts.nodeId===peer.nodeId);
      return !current||!current.peers.some(p=>p.fingerprint===peer.peerFingerprint&&p.validUntil>this.now()+this.policy.maxClockSkewSeconds*1000);
    })));
  }
  private async authorized(tx:Tx,forward:Forward,plan:RelayPreparedPlan<F>,singleInput=false):Promise<boolean>{
    const actor=await this.forwarding.authorizer(tx,forward.id);if(!actor)return false;
    let currentInput:MultihopPlanInput<F>|undefined;
    if(singleInput&&plan.path){
      try{currentInput=await this.multihopInput(tx,actor,forward);this.compiler.multihopResources(currentInput);}
      catch(error){if(this.executionRefused(error))return false;throw error;}
    }else if(!await this.canExecute(tx,actor,forward))return false;
    if(plan.path){
      if(!this.multihopEnabled||this.compiler.digest(plan.path)!==this.compiler.digest([forward.spec.ingress.nodeId,...forward.spec.path!.via])||plan.authorizationUntil<=this.now()+2*this.policy.maxClockSkewSeconds*1000)return false;
      const input=currentInput??await this.multihopInput(tx,actor,forward);
      if(input.endpoints.some(e=>e.revision!==plan.endpointRevisions?.[e.nodeId])||this.pinsChanged(plan,input.nodes))return false;
      return plan.nodes.every(node=>{
        const current=input.nodes.find(n=>n.facts.nodeId===node.nodeId);
        return current?.sessionEpoch===node.sessionEpoch&&node.assignments.every(a=>{
          const h=this.compiler.multihopAssignmentPolicy(a);
          return current.facts.egressPolicyRevision===h.egressPolicyRevision&&current.facts.allowMetadataTargets===h.allowMetadataTargets&&this.compiler.digest([...new Set(current.facts.allowedDestinationCidrs)].sort())===this.compiler.digest(h.allowedDestinationCidrs);
        });
      });
    }
    const facts=await this.facts(tx,actor,forward),endpoint=await this.endpoints.resolve(tx,forward.spec.path!.via[0]!);
    if(endpoint.revision!==plan.endpointRevision||plan.authorizationUntil<=this.now()+2*this.policy.maxClockSkewSeconds*1000)return false;
    for(const node of plan.nodes){const current=facts.find(item=>item.facts.nodeId===node.nodeId);if(!current||current.sessionEpoch!==node.sessionEpoch)return false;
      for(const a of node.assignments){const config=this.compiler.relayAssignmentPolicy(a),peer=facts.find(item=>item.facts.nodeId===(a.role==='relay-ingress'?config.binding.egressNodeId:config.binding.ingressNodeId));
        if(current.facts.egressPolicyRevision!==config.egressPolicyRevision||current.facts.allowMetadataTargets!==config.allowMetadataTargets||this.compiler.digest([...new Set(current.facts.allowedDestinationCidrs)].sort())!==this.compiler.digest(config.allowedDestinationCidrs)||!peer||config.peerFingerprints.some(pin=>!peer.peers.some(credential=>credential.fingerprint===pin&&credential.validUntil>this.now()+this.policy.maxClockSkewSeconds*1000)))return false;
      }
    }
    return true;
  }
  private async publishablePlan(tx:Tx,record:Deployment,plan:RelayPreparedPlan<F>,includeAccepted=false,singleInput=false):Promise<boolean>{
    const op=await this.ledger.latest(tx,record.forward_id);
    if(!op||op.recovery_invalidated||op.kind==='revoke'||!['running','succeeded',...(includeAccepted?['accepted']:[])].includes(op.status)||op.status!=='succeeded'&&op.execution_deadline<=this.now())return false;
    const forward=await this.forwarding.record(tx,op.scope_id,record.forward_id);
    return !forward.deleting&&!forward.recoverySuspended&&forward.spec.enabled&&forward.revision===record.target_revision&&record.stage!=='withdrawn'&&await this.authorized(tx,forward,plan,singleInput);
  }
  async assignments(tx:Tx,nodeId:string,includeAccepted=false):Promise<RuntimeAssignment<F>[]>{
    const records=await this.store.forNode(tx,nodeId);
    const result:RuntimeAssignment<F>[]=[];
    for(const record of records){const plan=this.plan(record);if(!await this.publishablePlan(tx,record,plan,includeAccepted))continue;
      result.push(...await this.nodeAssignments(tx,nodeId,record,plan,includeAccepted));
    }
    return result;
  }
  async assignmentsForForward(tx:Tx,forwardId:string):Promise<readonly SnapshotContribution<F>[]>{
    const record=await this.latest(tx,forwardId);
    if(!record)return [];
    if(record.forward_id!==forwardId)throw new ControlError('INTEGRITY_FAILURE',409,'Relay Forward read differs');
    const plan=this.plan(record);
    if(!await this.publishablePlan(tx,record,plan,false,true))return [];
    const result:SnapshotContribution<F>[]=[];
    for(const node of plan.nodes)result.push({nodeId:node.nodeId,assignments:await this.nodeAssignments(tx,node.nodeId,record,plan,false)});
    return result;
  }
  private async nodeAssignments(tx:Tx,nodeId:string,record:Deployment,plan:RelayPreparedPlan<F>,includeAccepted:boolean):Promise<RuntimeAssignment<F>[]>{
    const node=plan.nodes.find(node=>node.nodeId===nodeId);if(!node)throw new Error('Missing Relay node plan');
    if(plan.path){
      if(!includeAccepted&&!await this.ledger.sessionAuthoritySafe(tx,nodeId,node.sessionEpoch))return [];
      const index=plan.path.indexOf(nodeId),count=plan.path.length;
      if(!includeAccepted&&record.stage==='preparing'&&index<count-Math.min(count,record.prepared_count+1))return [];
      const active=record.stage==='active'||record.stage!=='preparing'&&index>=count-record.activated_count;
      return node.assignments.map(assignment=>({...assignment,phase:active?'active' as const:'prepared' as const}));
    }
    return node.assignments.map(assignment=>{const active=record.stage==='ingress_active'||record.stage==='active'||record.stage==='egress_active'&&assignment.role==='relay-egress';return {...assignment,phase:active?'active' as const:'prepared' as const};});
  }
  async authorizationBound(tx:Tx,assignments:readonly RuntimeAssignment<F>[]):Promise<number>{
    let bound=Number.MAX_SAFE_INTEGER;
    for(const id of new Set(assignments.filter(a=>a.role!=='direct').map(a=>a.forwardId))){
      const record=await this.latest(tx,id);if(!record)throw new Error('Missing Relay authority');
      const plan=this.plan(record);bound=Math.min(bound,plan.authorizationUntil);
      for(const node of plan.nodes){
        const current=await this.nodes.facts(tx,node.nodeId),peers=await this.nodes.relayCredentialFacts(tx,node.nodeId);
        const pinned=new Set(plan.nodes.flatMap(part=>part.assignments.flatMap(a=>{
          if(plan.path)return this.compiler.multihopAssignmentPolicy(a).path.filter(peer=>peer.nodeId===node.nodeId).map(peer=>peer.peerFingerprint);
          const config=this.compiler.relayAssignmentPolicy(a);
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
  private async observed(tx:Tx,node:RelayPreparedPlan<F>['nodes'][number],phase:'prepared'|'active'):Promise<boolean>{
    const runtime=await this.observations.runtimeNode(tx,node.nodeId);
    if(!runtime||runtime.session_epoch!==node.sessionEpoch||!runtime.last_report||runtime.received_at===null||runtime.received_at+this.policy.observationFreshnessSeconds*1000<=this.now())return false;
    const report=this.compiler.readValue<Report<F>>(runtime.last_report);
    if(report.sessionEpoch!==node.sessionEpoch||report.acceptedSnapshotGeneration!==runtime.snapshot_generation)return false;
    const published=await this.observations.snapshot(tx,node.nodeId,runtime.snapshot_generation,node.sessionEpoch);
    if(!published)return false;const snapshot=this.compiler.readValue<RuntimeSnapshot<F>>(published.body);
    if(this.compiler.parseTime(snapshot.validUntil)<=this.now()+this.policy.maxClockSkewSeconds*1000)return false;
    return node.assignments.every(a=>snapshot.assignments.some(current=>current.assignmentId===a.assignmentId&&current.deploymentGeneration===a.deploymentGeneration&&current.bindingFence===a.bindingFence&&current.driver.configDigest===a.driver.configDigest&&current.phase===phase)&&report.observations.some(obs=>obs.assignmentId===a.assignmentId&&obs.deploymentGeneration===a.deploymentGeneration&&obs.bindingFence===a.bindingFence&&obs.phase===phase&&obs.condition===(phase==='prepared'?'prepared':'ready')));
  }
  async executionError(tx:Tx,snapshot:RuntimeSnapshot<F>,assignment:RuntimeAssignment<F>,observation:Observation):Promise<void>{
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
      if(op.status==='running')await this.ledger.recordRelayError(tx,op.id,error);
      return;
    }
    // Preserve successful deployment history; a subsequent failure is a new,
    // explicitly failed operation that can be retried through fresh authority.
    const id=op.status==='succeeded'?await this.ledger.accept(tx,forward,{
      actorId:op.requested_by,scopeId:op.scope_id,key:`multihop-error:${record.generation}`,
      digest:this.compiler.digest({sourceOperationId:op.id,...error}),
    },'policy',forward.spec,op.id):op.id;
    await this.ledger.failRelayOperation(tx,id,error);
    await this.store.withdraw(tx,record.forward_id,record.generation,this.now());
  }
  async advance(tx:Tx,forwardId:string):Promise<void>{
    const record=await this.latest(tx,forwardId,true),op=await this.ledger.latest(tx,forwardId);if(!record||!op||op.recovery_invalidated)return;
    await this.store.touch(tx,forwardId,record.generation,this.now());
    const forward=await this.forwarding.record(tx,op.scope_id,forwardId),plan=this.plan(record);
    if(op.status!=='running'&&op.status!=='succeeded'&&!(op.status==='failed'&&op.cleanup_pending))return;
    if(!forward.spec.path){await this.store.withdraw(tx,forwardId,record.generation,this.now());return;}
    if(op.status!=='failed'&&!forward.deleting&&forward.spec.enabled&&op.kind!=='revoke'&&!forward.recoverySuspended&&forward.revision===plan.forwardRevision){
      const staleSession=(await Promise.all(plan.nodes.map(async node=>(await this.observations.nodeSession(tx,node.nodeId))?.session_epoch!==node.sessionEpoch))).some(Boolean);
      const actor=await this.forwarding.authorizer(tx,forward.id);
      if(actor&&await this.canExecute(tx,actor,forward)){
        const current=await this.facts(tx,actor,forward);
        const changedPins=this.pinsChanged(plan,current);
        const currentBound=Math.min(...current.map(n=>Math.min(n.credentialUntil,...n.peers.map(p=>p.validUntil))));
        const renewedAuthority=plan.authorizationUntil<=this.now()+this.policy.renewalLeadSeconds*1000&&currentBound>plan.authorizationUntil;
        if(staleSession||changedPins||renewedAuthority){
          const reason=staleSession?'new-session':changedPins?'peer-credential':'credential-renewal';
          await this.acceptPlan(tx,actor,forward);
          await this.ledger.accept(tx,forward,{actorId:op.requested_by,scopeId:forward.scopeId,key:`relay-refresh:${record.generation}`,digest:this.compiler.digest({forwardId,generation:record.generation,reason})},'policy',forward.spec,op.id);
          for(const nodeId of await this.nodeIDs(tx,forward))await this.ledger.assertCapacity(tx,this.forwarding,await this.nodes.cleanupFacts(tx,nodeId,forward.scopeId));
          return;
        }
      }
    }
    const stopped=forward.deleting||!forward.spec.enabled||op.kind==='revoke'||op.status==='failed'||forward.recoverySuspended||!await this.authorized(tx,forward,plan);
    if(stopped){await this.store.withdraw(tx,forwardId,record.generation,this.now());await this.complete(tx,{...record,stage:'withdrawn'},forward,op,plan);return;}
    if(plan.path){await this.advanceMultihop(tx,record,forward,op,plan);return;}
    const ingress=plan.nodes.find(node=>node.nodeId===record.ingress_node_id)!,egress=plan.nodes.find(node=>node.nodeId===record.egress_node_id)!;
    let next=record.stage;
    if(record.stage==='preparing'&&await this.observed(tx,ingress,'prepared')&&await this.observed(tx,egress,'prepared'))next='egress_active';
    else if(record.stage==='egress_active'&&await this.observed(tx,egress,'active')&&await this.observed(tx,ingress,'prepared'))next='ingress_active';
    else if(record.stage==='ingress_active'&&await this.observed(tx,ingress,'active')&&await this.observed(tx,egress,'active'))next='active';
    if(next!==record.stage)await this.store.setStage(tx,forwardId,record.generation,next,this.now());
    if(next==='active')await this.complete(tx,{...record,stage:next},forward,op,plan);
  }
  private async advanceMultihop(tx:Tx,record:Deployment,forward:Forward&{deleting:boolean},op:Operation,plan:RelayPreparedPlan<F>):Promise<void>{
    const count=plan.nodes.length;
    if(record.stage==='preparing'){
      // Only the next downstream node is admitted; receipt alone cannot advance this cursor.
      const expected=plan.nodes.slice(Math.max(0,count-record.prepared_count-1));
      if(!(await Promise.all(expected.map(n=>this.observed(tx,n,'prepared')))).every(Boolean))return;
      const prepared=record.prepared_count+1;
      await this.store.setPreparation(tx,forward.id,record.generation,prepared,prepared===count?'egress_active':'preparing',prepared===count?1:0,this.now());
      return;
    }
    if(record.stage==='egress_active'){
      if(!(await Promise.all(plan.nodes.map((n,index)=>this.observed(tx,n,index>=count-record.activated_count?'active':'prepared')))).every(Boolean))return;
      if(record.activated_count<count){await this.store.incrementActivation(tx,forward.id,record.generation,this.now());return;}
      await this.store.activate(tx,forward.id,record.generation,this.now());
      record={...record,stage:'active'};
    }
    if(record.stage==='active')await this.complete(tx,record,forward,op,plan);
  }
  private async complete(tx:Tx,record:Deployment,forward:Forward&{deleting:boolean},op:Operation,plan:RelayPreparedPlan<F>):Promise<void>{
    const pending=await this.observations.pendingRetirementCount(tx,forward.id);if(pending)return;
    const stopped=forward.deleting||!forward.spec.enabled||op.kind==='revoke'||record.stage==='withdrawn';
    if(stopped){
      for(const nodeId of await this.nodeIDs(tx,forward)){const published=await this.observations.latestSnapshot(tx,nodeId);if(published&&published.valid_until+this.policy.maxClockSkewSeconds*1000>this.now()&&this.compiler.readValue<RuntimeSnapshot<F>>(published.body).assignments.some(a=>a.forwardId===forward.id))return;}
      const unsafe=await this.observations.unsafeLeaseCount(tx,forward.id);if(unsafe)return;
      if(forward.deleting)await this.ledger.releaseForwardSlots(tx,forward.id);
    }else{
      if(record.stage!=='active'||!(await Promise.all(plan.nodes.map(node=>this.observed(tx,node,'active')))).every(Boolean))return;
      if(!await this.ledger.previousLeasesSafe(tx,forward.id,plan.nodes))return;
      await this.ledger.retainSlots(tx,forward.id,plan.nodes.flatMap(node=>node.assignments.map(a=>({nodeId:node.nodeId,protocol:a.resource.protocol,port:a.resource.port}))));
    }
    if(op.status==='running'&&op.execution_deadline>this.now()&&(stopped&&forward.deleting||stopped&&!forward.spec.enabled||stopped&&op.kind==='revoke'||!stopped))await this.ledger.succeedRelayOperation(tx,op.id);
    if(op.status==='succeeded'||stopped)await this.ledger.clearTerminalRelayCleanup(tx,forward.id);
  }
  async advanceForNode(tx:Tx,nodeId:string):Promise<void>{for(const record of await this.store.forwardIDsForNode(tx,nodeId))await this.advance(tx,record.forward_id);}
  async pendingNodeIDs(tx:Tx):Promise<string[]>{
    const ids=new Set<string>(),ingresses=new Set<string>();
    for(const record of await this.store.pendingDeployments(tx)){
      ingresses.add(record.ingress_node_id);
      for(const node of this.plan(record).nodes)ids.add(node.nodeId);
      for(const lease of await this.observations.leaseNodes(tx,record.forward_id))ids.add(lease.node_id);
    }
    return [...ids].sort((a,b)=>Number(ingresses.has(b))-Number(ingresses.has(a))||(a<b?-1:a>b?1:0));
  }
}
