import {deepFreeze, isCounter, normalizeTargetHost, parseForward} from '@tunex/core';
import { digest } from '@tunex/contracts/shared';
import { hopPathDigest, MULTIHOP_CAPABILITY, parseRelayMessage, validateHopConfig } from '@tunex/contracts/runtime';
import type { HopConfig, HopNode, RuntimeAssignment } from '@tunex/contracts/runtime';
import type { RelayResource, ReservedRelayResource } from '../framework/public.ts';
import type { NativeRuntimeRelayPlan as RelayPreparedPlan, NativeRuntimeMultihopInput as MultihopPlanInput } from './native-runtime-family.ts';
import {parseRelayEndpoint} from './native-relay-endpoint.ts';
import {compilePathTopology} from './native-path-topology.ts';
import {targetAllowed} from './native-target-policy.ts';
export type { NativeRuntimeMultihopInput as MultihopPlanInput } from './native-runtime-family.ts';
export function compileMultihopResources(input: MultihopPlanInput): readonly RelayResource[] {
  const parsed = parseForward(input.forward);
  if (!parsed.ok || !parsed.value.spec.transport) throw new Error('INVALID_CONFIG: Locked multi-hop Forward required');
  const f = parsed.value, topology = compilePathTopology(f), profile = parseRelayMessage('ProfileConfig', JSON.stringify(input.profile.config));
  if (topology.nodes.length < 3 || input.nodes.length !== topology.nodes.length || input.endpoints.length !== topology.nodes.length-1 ||
      new Set(input.nodes.map(n=>n.facts.nodeId)).size!==topology.nodes.length || new Set(input.endpoints.map(e=>e.nodeId)).size!==topology.nodes.length-1)
    throw new Error('AUTHORIZATION_DENIED: Exact multi-hop Node and endpoint facts required');
  if (input.profile.profileId!==f.spec.transport!.profileId || input.profile.revision!==f.spec.transport!.configRevision || digest(profile)!==input.profile.configDigest || f.spec.protocols.some(p=>!profile.protocols.includes(p)))
    throw new Error('INTEGRITY_FAILURE: Locked multi-hop Profile differs');
  const resources: RelayResource[]=[];
  for (const hop of topology.nodes) {
    const node=input.nodes.find(n=>n.facts.nodeId===hop.nodeId), endpoint=input.endpoints.find(e=>e.nodeId===hop.nodeId);
    if (!node || node.facts.scopeId!==f.scopeId || !isCounter(node.sessionEpoch) ||
        ['adp.3',MULTIHOP_CAPABILITY,'native.multihop.v1','multihop.wire.1',...f.spec.protocols].some(c=>!node.facts.capabilities.includes(c)))
      throw new Error('UNSUPPORTED_CAPABILITY: Every Node must explicitly support multi-hop execution');
    if (hop.index===0 && (!node.facts.allowedListenerAddresses.includes(f.spec.ingress.listen.address)||!node.facts.allowedPorts.includes(f.spec.ingress.listen.port)))
      throw new Error('AUTHORIZATION_DENIED: Multi-hop ingress listener denied');
    const next=topology.nodes[hop.index+1], nextEndpoint=next&&input.endpoints.find(e=>e.nodeId===next.nodeId);
    if (next ? !nextEndpoint||!targetAllowed(nextEndpoint.config.advertisedHost,node.facts) : !targetAllowed(f.spec.target.host,node.facts))
      throw new Error('AUTHORIZATION_DENIED: Multi-hop destination policy denied');
    if (hop.index>0) {if (!endpoint) throw new Error('INVALID_CONFIG: Missing multi-hop endpoint');parseRelayEndpoint(endpoint.config);}
    for (const protocol of f.spec.protocols) {
      const port=hop.index===0?f.spec.ingress.listen.port:input.ports[hop.nodeId]?.[protocol];
      if (!port || hop.index>0&&!endpoint!.config.allowedTcpPorts.includes(port)) throw new Error('RESOURCE_CONFLICT: Authorized multi-hop physical port required');
      resources.push({nodeId:hop.nodeId,role:hop.role as RelayResource['role'],forwardProtocol:protocol,
        physicalProtocol:hop.index===0?protocol:'tcp',address:hop.index===0?f.spec.ingress.listen.address:endpoint!.config.listenAddress,port});
    }
  }
  if(new Set(resources.map(r=>`${r.nodeId}/${r.physicalProtocol}/${r.port}`)).size!==resources.length)throw new Error('RESOURCE_CONFLICT: Multi-hop physical resource collision');
  return deepFreeze(resources);
}
export function compileMultihopPlan(input: MultihopPlanInput & {reservations: readonly ReservedRelayResource[]; drainTimeoutSeconds:number; issuedAt:string}): RelayPreparedPlan {
  const resources=compileMultihopResources(input), f=structuredClone(input.forward), topology=compilePathTopology(f), now=Date.parse(input.issuedAt);
  const profile=parseRelayMessage('ProfileConfig',JSON.stringify(input.profile.config));
  if (!Number.isSafeInteger(now)||!Number.isInteger(input.drainTimeoutSeconds)||input.drainTimeoutSeconds<0||input.drainTimeoutSeconds>300||input.reservations.length!==resources.length)
    throw new Error('INVALID_CONFIG: Complete multi-hop reservations and bounded lifetime required');
  let generation=0,authorizationUntil=Number.MAX_SAFE_INTEGER;
  const pins=new Map<string,string>();
  for(const node of input.nodes){
    const peer=[...node.peers].filter(p=>p.validUntil>now).sort((a,b)=>b.validUntil-a.validUntil||(a.fingerprint<b.fingerprint?-1:a.fingerprint>b.fingerprint?1:0))[0];
    if(!peer||!Number.isSafeInteger(node.credentialUntil)||node.credentialUntil<=now||node.peers.length>2||new Set(node.peers.map(p=>p.fingerprint)).size!==node.peers.length||node.peers.some(p=>!/^sha256:[a-f0-9]{64}$/.test(p.fingerprint)||!Number.isSafeInteger(p.validUntil)))throw new Error('AUTHORIZATION_DENIED: Current bounded multi-hop credentials required');
    pins.set(node.facts.nodeId,peer.fingerprint);authorizationUntil=Math.min(authorizationUntil,node.credentialUntil,peer.validUntil);
  }
  const plans=topology.nodes.map(n=>({nodeId:n.nodeId,sessionEpoch:input.nodes.find(p=>p.facts.nodeId===n.nodeId)!.sessionEpoch,assignments:[] as RuntimeAssignment[]}));
  for(const protocol of f.spec.protocols){
    const path:HopNode[]=topology.nodes.map(hop=>{
      const r=resources.find(r=>r.nodeId===hop.nodeId&&r.forwardProtocol===protocol)!,e=input.endpoints.find(e=>e.nodeId===hop.nodeId);
      const matches=input.reservations.filter(s=>s.nodeId===r.nodeId&&s.role===r.role&&s.forwardProtocol===r.forwardProtocol&&s.physicalProtocol===r.physicalProtocol&&s.address===r.address&&s.port===r.port&&s.forwardId===f.id);
      const slot=matches[0];if(matches.length!==1||!slot||!isCounter(slot.bindingFence)||!isCounter(slot.deploymentGeneration))throw new Error('RESOURCE_CONFLICT: Exact fenced multi-hop resource required');
      generation ||= slot.deploymentGeneration;if(generation!==slot.deploymentGeneration)throw new Error('INTEGRITY_FAILURE: Mixed multi-hop deployment generations');
      return {nodeId:hop.nodeId,assignmentId:`a:${digest({nodeId:hop.nodeId,forwardId:f.id,protocol,role:`multihop-${hop.role}`}).slice(7)}`,
        sessionEpoch:plans[hop.index]!.sessionEpoch,bindingFence:slot.bindingFence,peerFingerprint:pins.get(hop.nodeId)!,listenAddress:r.address,host:e?.config.advertisedHost??normalizeTargetHost(r.address)??'localhost',port:r.port};
    });
    for(const hop of topology.nodes){
      const node=input.nodes.find(n=>n.facts.nodeId===hop.nodeId)!,local=path[hop.index]!;
      const base:HopConfig={scopeId:f.scopeId,forwardId:f.id,forwardRevision:f.revision,deploymentGeneration:generation,
        profileId:input.profile.profileId,profileRevision:input.profile.revision,profileDigest:input.profile.configDigest,pathDigest:'',
        protocol,hopIndex:hop.index,path,profile,target:f.spec.target,
        egressPolicyRevision:node.facts.egressPolicyRevision,allowedDestinationCidrs:[...new Set(node.facts.allowedDestinationCidrs)].sort(),allowMetadataTargets:node.facts.allowMetadataTargets};
      const h={...base,pathDigest:hopPathDigest(base)};validateHopConfig(h);const config={hop:h};
      plans[hop.index]!.assignments.push({assignmentId:local.assignmentId,forwardId:f.id,forwardRevision:f.revision,deploymentGeneration:generation,bindingFence:local.bindingFence,
        role:`multihop-${hop.role}` as RuntimeAssignment['role'],protocol,phase:'prepared',resource:{address:local.listenAddress,port:local.port,protocol:hop.index===0?protocol:'tcp'},
        driver:{id:'native.multihop.v1',schemaVersion:1,configDigest:digest(config),config},drainTimeoutSeconds:input.drainTimeoutSeconds});
    }
  }
  for(const n of plans)n.assignments.sort((a,b)=>a.assignmentId<b.assignmentId?-1:a.assignmentId>b.assignmentId?1:0);
  const body={forwardId:f.id,forwardRevision:f.revision,deploymentGeneration:generation,endpointRevision:0,
    endpointRevisions:Object.fromEntries(input.endpoints.map(e=>[e.nodeId,e.revision])),path:topology.nodes.map(n=>n.nodeId),authorizationUntil,nodes:plans};
  return deepFreeze({...body,planDigest:digest(body)});
}
