import type { Forward } from '@tunex/core';
import { digest } from '@tunex/contracts';
import type { RelayNodeExecutionFacts, ReservedRelayResource } from '../../src/modules/runtime/relay-plan.ts';
import { compileMultihopResources } from '../../src/modules/runtime/multihop-plan.ts';

export function multihopFixture(count=3) {
  const ids=Array.from({length:count},(_,i)=>`node-${i+1}`);
  const forward:Forward={id:'multihop-forward',scopeId:'scope-a',revision:1,spec:{enabled:true,protocols:['tcp','udp'],
    ingress:{nodeId:ids[0]!,listen:{address:'0.0.0.0',port:32001}},target:{host:'127.0.0.1',port:32002},
    path:{via:ids.slice(1)},transport:{profileId:'profile-a',configRevision:1}}};
  const config={driver:'native.relay.v1' as const,wireVersion:1 as const,security:'mutual-tls13' as const,protocols:['tcp','udp'] as ('tcp'|'udp')[],
    handshakeTimeoutSeconds:5,idleTimeoutSeconds:60,maxFrameBytes:65536,maxUdpDatagramBytes:16384,maxConnectionsPerNode:128};
  const profile={profileId:'profile-a',revision:1,config,configDigest:digest(config)};
  const nodes:RelayNodeExecutionFacts[]=ids.map((nodeId,i)=>({facts:{nodeId,scopeId:'scope-a',
    capabilities:['adp.3','native.direct.v1','native.relay.v1','relay.wire.1','adp.execution.1','native.multihop.v1','multihop.wire.1','tcp','udp'],
    allowedListenerAddresses:['0.0.0.0','127.0.0.1'],allowedPorts:[32001],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false},
    sessionEpoch:i+1,credentialUntil:Date.parse('2026-10-16T12:00:00Z'),peers:[{fingerprint:`sha256:${String(i+1).repeat(64)}`,validUntil:Date.parse('2026-10-16T11:00:00Z')}]}));
  const endpoints=ids.slice(1).map((nodeId,i)=>({nodeId,revision:1,config:{listenAddress:'127.0.0.1',advertisedHost:'127.0.0.1',allowedTcpPorts:[33000+2*i,33001+2*i]}}));
  const ports=Object.fromEntries(endpoints.map(e=>[e.nodeId,{tcp:e.config.allowedTcpPorts[0]!,udp:e.config.allowedTcpPorts[1]!}]));
  const input={forward,nodes,profile,endpoints,ports};
  const reservations:ReservedRelayResource[]=compileMultihopResources(input).map((r,i)=>({...r,forwardId:forward.id,deploymentGeneration:9,bindingFence:i+1}));
  return {...input,reservations,issuedAt:'2026-10-16T10:00:00Z',drainTimeoutSeconds:30};
}
