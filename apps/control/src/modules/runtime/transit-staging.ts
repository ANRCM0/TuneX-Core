import { deepFreeze, isCounter, MAX_COUNTER } from '@tunex/core';
import { digest } from '@tunex/contracts';
import type { MySqlUnitOfWork } from '../../infrastructure/mysql.ts';
import { json, rows, write } from '../../infrastructure/mysql.ts';
import { ControlError } from '../../application/errors.ts';
import type { Nodes } from '../nodes.ts';
import type { Forwarding } from '../forwarding.ts';
import type { Transport } from '../transport.ts';
import type { RelayEndpoints, ResolvedEndpoint } from '../relay-endpoints.ts';
import type { RelayNodeExecutionFacts } from './relay-plan.ts';
import { compilePathTopology } from './path-topology.ts';
import { compileTransitResources, compileTransitPreparation } from './transit-preparation.ts';
import type { TransitPreparation } from './transit-preparation.ts';
import { reserveTransitResources } from './transit-reservations.ts';

export interface TransitStageRow {
  forward_id: string; generation: number; target_revision: number;
  scope_id: string; created_by: string; state: 'reserved' | 'aborted';
  expires_at: number; plan_digest: string; body: unknown;
  created_at: number; updated_at: number;
}
function integrity(message: string): never {
  throw new ControlError('INTEGRITY_FAILURE',409,message);
}
export function verifyTransitStage(row: TransitStageRow): TransitPreparation {
  let plan:TransitPreparation;
  try { plan=json<TransitPreparation>(row.body); }
  catch { integrity('Malformed retained Transit JSON'); }
  if (!plan || typeof plan!=='object' || plan.executable!==false ||
      !Array.isArray(plan.assignments) || !Array.isArray(plan.intents) ||
      !Array.isArray(plan.activationOrder) || !isCounter(row.generation) ||
      !isCounter(row.target_revision) || !Number.isSafeInteger(row.expires_at) || row.expires_at<=row.created_at ||
      !['reserved','aborted'].includes(row.state) ||
      !Number.isSafeInteger(plan.authorizationUntil))
    integrity('Invalid retained Transit plan');
  const {planDigest,...body}=plan;
  if (planDigest!==row.plan_digest || digest(body)!==row.plan_digest ||
      plan.forwardId!==row.forward_id || plan.scopeId!==row.scope_id ||
      plan.forwardRevision!==row.target_revision || plan.deploymentGeneration!==row.generation ||
      row.expires_at>plan.authorizationUntil) integrity('Transit journal digest or identity differs');
  const ids=new Set(plan.assignments.map(a=>a.nodeId));
  const uniqueResources=new Set(plan.assignments.map(a=>a.nodeId+'/'+a.resource.physicalProtocol+'/'+a.resource.port));
  const logical=new Set(plan.assignments.map(a=>a.nodeId+'/'+a.protocol));
  if (ids.size<3 || ids.size>8 || uniqueResources.size!==plan.assignments.length ||
      logical.size!==plan.assignments.length || plan.activationOrder.length!==ids.size ||
      new Set(plan.activationOrder).size!==ids.size ||
      plan.activationOrder.some(id=>!ids.has(id)) ||
      plan.assignments.some(a=>!isCounter(a.bindingFence) || !isCounter(a.sessionEpoch) ||
        a.resource.nodeId!==a.nodeId || a.resource.role!==a.role ||
        a.resource.forwardProtocol!==a.protocol ||
        (a.role==='ingress' ? a.resource.physicalProtocol!==a.protocol : a.resource.physicalProtocol!=='tcp')))
    integrity('Transit journal topology or physical Fence differs');
  return deepFreeze(plan);
}

/** All writes are confined to one transaction; nothing enters the live ADP/3 Runner. */
export class TransitStagingCoordinator {
  private readonly db: MySqlUnitOfWork;
  private readonly nodes: Nodes;
  private readonly forwarding: Forwarding;
  private readonly transport: Transport;
  private readonly endpoints: RelayEndpoints;
  constructor(db: MySqlUnitOfWork,nodes: Nodes,forwarding: Forwarding,
    transport: Transport,endpoints: RelayEndpoints) {
    this.db=db;this.nodes=nodes;this.forwarding=forwarding;
    this.transport=transport;this.endpoints=endpoints;
  }
  async stage(actor:string,scopeId:string,forwardId:string,expectedRevision:number):Promise<TransitPreparation>{
    if(!isCounter(expectedRevision))
      throw new ControlError('INVALID_CONFIG',422,'Valid Forward revision required');
    return this.db.transaction(async tx=>{
      const forward=await this.forwarding.currentForUpdate(tx,scopeId,forwardId);
      if(forward.revision!==expectedRevision)
        throw new ControlError('REVISION_CONFLICT',409,'Forward revision differs');
      if(await this.forwarding.authorizer(tx,forwardId)!==actor)
        throw new ControlError('AUTHORIZATION_DENIED',403,'Only original Forward authorizer may stage Transit');
      const path=compilePathTopology(forward),ref=forward.spec.transport;
      if(!forward.spec.enabled || path.nodes.length<3 || !ref)
        throw new ControlError('UNSUPPORTED_CAPABILITY',422,'Locked three-Node Transport required');
      const old=(await rows<TransitStageRow>(tx,
        'SELECT * FROM transit_deployments WHERE forward_id=? ORDER BY generation DESC LIMIT 1 FOR UPDATE',[forwardId]))[0];
      if(old?.state==='reserved')
        throw new ControlError('RESOURCE_CONFLICT',409,'Abort old proposal before another staging attempt');
      const generation=Math.max(forward.revision,(old?.generation??0)+1);
      if(!isCounter(generation)||generation>=MAX_COUNTER)
        throw new ControlError('RESOURCE_LIMIT',429,'Transit generation exhausted');

      const sessions=new Map<string,number>();
      for(const id of path.nodes.map(n=>n.nodeId).sort()){
        const row=(await rows<{session_epoch:number}>(tx,
          'SELECT session_epoch FROM runtime_nodes WHERE node_id=? FOR UPDATE',[id]))[0];
        if(!row || !isCounter(row.session_epoch))
          throw new ControlError('SESSION_SUPERSEDED',409,'Current online session required');
        sessions.set(id,row.session_epoch);
      }
      const profile=await this.transport.resolve(tx,actor,scopeId,ref.profileId,ref.configRevision);
      const facts:RelayNodeExecutionFacts[]=[],pins:Record<string,string>={};
      const now=Date.now();
      for(const id of path.nodes.map(n=>n.nodeId).sort()){
        const allowed=await this.nodes.authorizedRelayNode(tx,actor,scopeId,id);
        const state=await this.nodes.facts(tx,id);
        const peers=await this.nodes.relayCredentialFacts(tx,id,true);
        const selected=[...peers].sort((a,b)=>b.validUntil-a.validUntil||
          a.fingerprint.localeCompare(b.fingerprint))[0];
        if(!selected || selected.validUntil<=now+10000 || state.credentialUntil<=now+10000)
          throw new ControlError('AUTHORIZATION_DENIED',403,'Valid current peer credential required');
        pins[id]=selected.fingerprint;
        facts.push({facts:allowed,sessionEpoch:sessions.get(id)!,credentialUntil:state.credentialUntil,peers});
      }
      const endpoints:ResolvedEndpoint[]=[];
      for(const hop of path.nodes.slice(1))
        endpoints.push(await this.endpoints.resolve(tx,hop.nodeId));
      const ports:Record<string,Partial<Record<'tcp'|'udp',number>>>={};
      for(const endpoint of endpoints){
        ports[endpoint.nodeId]={};
        const seen=new Set<number>();
        for(const protocol of forward.spec.protocols){
          let picked:number|undefined;
          for(const port of endpoint.config.allowedTcpPorts){
            if(seen.has(port))continue;
            const previous=(await rows<{owner_id:string|null}>(tx,
              "SELECT owner_id FROM port_slots WHERE node_id=? AND protocol='tcp' AND port=?",
              [endpoint.nodeId,port]))[0];
            if(!previous||previous.owner_id===null){picked=port;break;}
          }
          if(picked===undefined)throw new ControlError('PORT_RESERVED',409,'No exclusive TLS port available');
          seen.add(picked);ports[endpoint.nodeId]![protocol]=picked;
        }
      }
      const resources=compileTransitResources({forward,profile,nodes:facts,endpoints,ports});
      for(const resource of resources){
        const row=(await rows<{owner_id:string|null}>(tx,
          'SELECT owner_id FROM port_slots WHERE node_id=? AND protocol=? AND port=?',
          [resource.nodeId,resource.physicalProtocol,resource.port]))[0];
        if(row?.owner_id!==null && row?.owner_id!==undefined)
          throw new ControlError('PORT_RESERVED',409,'Live physical owner must first be retired');
      }
      const reservations=await reserveTransitResources(tx,forward,resources,generation);
      const plan=compileTransitPreparation({forward,profile,nodes:facts,endpoints,reservations,
        issuedAt:new Date(now).toISOString(),peerPins:pins,
        maxConnections:Math.min(profile.config.maxConnectionsPerNode,4096)});
      const expiry=Math.min(plan.authorizationUntil,now+300000);
      if(expiry<=now+10000)
        throw new ControlError('LEASE_EXPIRED',409,'Transit stage expiry too short');
      await write(tx,
        'INSERT INTO transit_deployments(forward_id,generation,target_revision,scope_id,created_by,state,expires_at,plan_digest,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        [forwardId,generation,forward.revision,scopeId,actor,'reserved',expiry,plan.planDigest,JSON.stringify(plan),now,now]);
      return plan;
    });
  }

  /** An unexecuted stage may be aborted only when no old lease or Snapshot is possibly live. */
  async abort(actor:string,scopeId:string,forwardId:string,generation:number):Promise<boolean>{
    if(!isCounter(generation))throw new ControlError('INVALID_CONFIG',422,'Valid Transit generation required');
    return this.db.transaction(async tx=>{
      const record=(await rows<TransitStageRow>(tx,
        'SELECT * FROM transit_deployments WHERE forward_id=? AND generation=? AND scope_id=? FOR UPDATE',
        [forwardId,generation,scopeId]))[0];
      if(!record)throw new ControlError('NOT_FOUND',404,'Transit stage not found');
      if(actor!==record.created_by)
        throw new ControlError('AUTHORIZATION_DENIED',403,'Only original staging actor may abort');
      const plan=verifyTransitStage(record);
      if(record.state==='aborted')return false;
      const nodeIds=[...new Set(plan.assignments.map(a=>a.nodeId))].sort();
      for(const nodeId of nodeIds){
        const found=await rows(tx,'SELECT node_id FROM runtime_nodes WHERE node_id=? FOR UPDATE',[nodeId]);
        if(found.length!==1)integrity('Staged runtime Node disappeared');
      }
      const now=Date.now();
      const lease=(await rows<{until:number|null}>(tx,
        'SELECT MAX(valid_until) until FROM execution_leases WHERE forward_id=?',[forwardId]))[0];
      if(lease?.until!==null && lease?.until!==undefined && lease.until+5000>now)
        throw new ControlError('FENCING_REJECTED',409,'Live execution lease prevents release');
      for(const nodeId of nodeIds){
        const records=await rows<{body:unknown}>(tx,
          'SELECT body FROM snapshots WHERE node_id=? AND valid_until>?',[nodeId,now-5000]);
        for(const record of records){
          const snapshot=json<{assignments:{forwardId:string}[]}>(record.body);
          if(!Array.isArray(snapshot?.assignments) ||
              snapshot.assignments.some(a=>a.forwardId===forwardId))
            throw new ControlError('FENCING_REJECTED',409,'Possibly live Snapshot prevents release');
        }
      }
      for(const a of plan.assignments){
        const slot=(await rows<{owner_id:string|null;fence:number;deployment_generation:number}>(tx,
          'SELECT owner_id,fence,deployment_generation FROM port_slots WHERE node_id=? AND protocol=? AND port=? FOR UPDATE',
          [a.nodeId,a.resource.physicalProtocol,a.resource.port]))[0];
        if(!slot || slot.owner_id!==forwardId || slot.fence!==a.bindingFence ||
            slot.deployment_generation!==generation)integrity('Reservation ownership or Fence changed');
      }
      for(const a of plan.assignments){
        const updated=await write(tx,
          'UPDATE port_slots SET owner_id=NULL WHERE node_id=? AND protocol=? AND port=? AND owner_id=? AND fence=? AND deployment_generation=?',
          [a.nodeId,a.resource.physicalProtocol,a.resource.port,forwardId,a.bindingFence,generation]);
        if(updated!==1)integrity('Reservation release race');
      }
      const update=await write(tx,
        "UPDATE transit_deployments SET state='aborted',updated_at=? WHERE forward_id=? AND generation=? AND state='reserved'",
        [now,forwardId,generation]);
      if(update!==1)integrity('Transit stage state race');
      return true;
    });
  }
}
