import { isCounter, MAX_COUNTER } from '@tunex/core';
import { ControlError } from '../../framework/public.ts';
import type { RuntimeRelayNodeFacts } from '../../framework/public.ts';
import { compilePathTopology, nativeWallClockNow, nativeIsoTime, nativeJsonEncode,
  readStoredValue as json } from '../../compatibility/public.ts';
import type { ResolvedEndpoint } from '../relay-endpoint-owner/public.ts';
import { compileTransitResources, compileTransitPreparation } from './preparation.ts';
import { verifyTransitStage } from './stage-values.ts';
import type { TransitPreparation } from './preparation-contracts.ts';
import type { TransitStagingApi, TransitStagingOptions } from './staging-contracts.ts';

function integrity(message:string):never {throw new ControlError('INTEGRITY_FAILURE',409,message);}

/** Original offline stage/abort decisions; providers join the same transaction. */
export class TransitStagingService<Tx> implements TransitStagingApi {
  private readonly options:TransitStagingOptions<Tx>;
  constructor(options:TransitStagingOptions<Tx>) {
    if(typeof options.payloadPolicy?.assertUnmetered!=='function')throw new Error('Offline payload policy is required');
    this.options=options;
  }

  async stage(actor:string,scopeId:string,forwardId:string,expectedRevision:number):Promise<TransitPreparation>{
    if(!isCounter(expectedRevision))
      throw new ControlError('INVALID_CONFIG',422,'Valid Forward revision required');
    return this.options.db.transaction(async tx=>{
      const forward=await this.options.forwarding.currentForUpdate(tx,scopeId,forwardId);
      if(forward.revision!==expectedRevision)
        throw new ControlError('REVISION_CONFLICT',409,'Forward revision differs');
      if(await this.options.forwarding.authorizer(tx,forwardId)!==actor)
        throw new ControlError('AUTHORIZATION_DENIED',403,'Only original Forward authorizer may stage Transit');
      const path=compilePathTopology(forward),ref=forward.spec.transport;
      if(!forward.spec.enabled || path.nodes.length<3 || !ref)
        throw new ControlError('UNSUPPORTED_CAPABILITY',422,'Locked three-Node Transport required');
      // The Forward lock serializes first-stage writers before an empty journal read.
      const old=await this.options.store.latest(tx,forwardId);
      if(old && old.target_revision>forward.revision)
        integrity('Transit journal revision exceeds locked Forward revision');
      if(old?.state==='reserved')
        throw new ControlError('RESOURCE_CONFLICT',409,'Abort old proposal before another staging attempt');
      const generation=Math.max(forward.revision,(old?.generation??0)+1);
      if(!isCounter(generation)||generation>=MAX_COUNTER)
        throw new ControlError('RESOURCE_LIMIT',429,'Transit generation exhausted');

      const sessions=new Map<string,number>();
      for(const id of path.nodes.map(n=>n.nodeId).sort()){
        const row=await this.options.store.session(tx,id);
        if(!row || !isCounter(row.session_epoch))
          throw new ControlError('SESSION_SUPERSEDED',409,'Current online session required');
        sessions.set(id,row.session_epoch);
      }
      await this.options.payloadPolicy.assertUnmetered(tx,forward,path.nodes.map(node=>node.nodeId));
      const profile=await this.options.transport.resolve(tx,actor,scopeId,ref.profileId,ref.configRevision);
      const facts:RuntimeRelayNodeFacts[]=[],pins:Record<string,string>={};
      const now=nativeWallClockNow();
      for(const id of path.nodes.map(n=>n.nodeId).sort()){
        const role=path.nodes.find(node=>node.nodeId===id)!.role;
        if(role==='direct')integrity('Transit staging requires explicit path roles');
        const allowed=await this.options.nodes.authorizedRelayNode(tx,actor,scopeId,id,role,forward);
        const state=await this.options.nodes.facts(tx,id);
        const peers=await this.options.nodes.relayCredentialFacts(tx,id,true);
        const selected=[...peers].sort((a,b)=>b.validUntil-a.validUntil||
          a.fingerprint.localeCompare(b.fingerprint))[0];
        if(!selected || selected.validUntil<=now+10000 || state.credentialUntil<=now+10000)
          throw new ControlError('AUTHORIZATION_DENIED',403,'Valid current peer credential required');
        pins[id]=selected.fingerprint;
        facts.push({facts:allowed,sessionEpoch:sessions.get(id)!,credentialUntil:state.credentialUntil,peers});
      }
      const endpoints:ResolvedEndpoint[]=[];
      for(const hop of path.nodes.slice(1))
        endpoints.push(await this.options.endpoints.resolve(tx,hop.nodeId));
      const ports:Record<string,Partial<Record<'tcp'|'udp',number>>>={};
      for(const endpoint of endpoints){
        ports[endpoint.nodeId]={};
        const seen=new Set<number>();
        for(const protocol of forward.spec.protocols){
          let picked:number|undefined;
          for(const port of await this.options.nodes.reservationPorts(tx,actor,scopeId,endpoint.nodeId,endpoint.config.allowedTcpPorts)){
            if(seen.has(port))continue;
            const previous=await this.options.store.candidateOwner(tx,endpoint.nodeId,port);
            if(!previous||previous.owner_id===null){picked=port;break;}
          }
          if(picked===undefined)throw new ControlError('PORT_RESERVED',409,'No exclusive TLS port available');
          seen.add(picked);ports[endpoint.nodeId]![protocol]=picked;
        }
      }
      const resources=compileTransitResources({forward,profile,nodes:facts,endpoints,ports});
      for(const resource of resources){
        const row=await this.options.store.physicalOwner(tx,resource.nodeId,resource.physicalProtocol,resource.port);
        if(row?.owner_id!==null && row?.owner_id!==undefined)
          throw new ControlError('PORT_RESERVED',409,'Live physical owner must first be retired');
      }
      const reservations=await this.options.reservations.reserve(tx,forward,resources,generation);
      const plan=compileTransitPreparation({forward,profile,nodes:facts,endpoints,reservations,
        issuedAt:nativeIsoTime(now),peerPins:pins,
        maxConnections:Math.min(profile.config.maxConnectionsPerNode,4096)});
      const expiry=Math.min(plan.authorizationUntil,now+300000);
      if(expiry<=now+10000)
        throw new ControlError('LEASE_EXPIRED',409,'Transit stage expiry too short');
      await this.options.store.insert(tx,{
        forward_id:forwardId,generation,target_revision:forward.revision,scope_id:scopeId,
        created_by:actor,state:'reserved',expires_at:expiry,plan_digest:plan.planDigest,
        body:nativeJsonEncode(plan),created_at:now,updated_at:now});
      return plan;
    });
  }

  async abort(actor:string,scopeId:string,forwardId:string,generation:number):Promise<boolean>{
    if(!isCounter(generation))throw new ControlError('INVALID_CONFIG',422,'Valid Transit generation required');
    return this.options.db.transaction(async tx=>{
      const record=await this.options.store.stage(tx,scopeId,forwardId,generation);
      if(!record)throw new ControlError('NOT_FOUND',404,'Transit stage not found');
      if(actor!==record.created_by)
        throw new ControlError('AUTHORIZATION_DENIED',403,'Only original staging actor may abort');
      const plan=verifyTransitStage(record);
      if(record.state==='aborted')return false;
      // Even a terminal offline journal retains its physical Fence for later cleanup.
      const coordination=await this.options.store.coordination(tx,forwardId,generation);
      if(coordination.length)
        throw new ControlError('FENCING_REJECTED',409,
          'Coordinated Transit reservations require explicit verified cleanup');
      const nodeIds=[...new Set(plan.assignments.map(a=>a.nodeId))].sort();
      for(const nodeId of nodeIds){
        const found=await this.options.store.lockedNodes(tx,nodeId);
        if(found.length!==1)integrity('Staged runtime Node disappeared');
      }
      const now=nativeWallClockNow();
      const lease=await this.options.store.maximumLease(tx,forwardId);
      if(lease?.until!==null && lease?.until!==undefined && lease.until+5000>now)
        throw new ControlError('FENCING_REJECTED',409,'Live execution lease prevents release');
      for(const nodeId of nodeIds){
        const records=await this.options.store.snapshots(tx,nodeId,now-5000);
        for(const record of records){
          const snapshot=json<{assignments:{forwardId:string}[]}>(record.body);
          if(!Array.isArray(snapshot?.assignments) ||
              snapshot.assignments.some(a=>a.forwardId===forwardId))
            throw new ControlError('FENCING_REJECTED',409,'Possibly live Snapshot prevents release');
        }
      }
      await this.options.release.release(tx,forwardId,generation,plan.assignments);
      const update=await this.options.store.abort(tx,forwardId,generation,now);
      if(update!==1)integrity('Transit stage state race');
      return true;
    });
  }
}
