import { digest } from '@tunex/contracts/shared';
import { parseRelayMessage } from '@tunex/contracts/runtime';
import { parseRelayEndpoint } from './native-relay-endpoint.ts';
import { deepFreeze,parseForward,isCounter,isPort } from '@tunex/core';
import type { Forward } from '@tunex/core';
import type { RuntimeRelayEndpoint as ResolvedEndpoint,
    AuthorizedNodeFacts, RelayResource } from '../framework/public.ts';
import type { NativeRuntimeRelayProfile as ResolvedProfile } from './native-runtime-family.ts';
import { targetAllowed } from './native-target-policy.ts';
import { requireTwoNodeRelayTopology } from './native-path-topology.ts';
export type { RelayResource } from '../framework/public.ts';
export function compileRelayResources(forward:Forward,nodes:readonly AuthorizedNodeFacts[],profile:ResolvedProfile,endpoint:ResolvedEndpoint,egressPorts:Readonly<Record<'tcp'|'udp',number>>):readonly RelayResource[]{
 const config=parseRelayMessage('ProfileConfig',JSON.stringify(profile.config));if(!isCounter(profile.revision)||digest(config)!==profile.configDigest)throw new Error('INTEGRITY_FAILURE: Locked Profile integrity differs');parseRelayEndpoint(endpoint.config);
 const parsed=parseForward(forward);if(!parsed.ok)throw new Error('INVALID_CONFIG: Forward is invalid');const spec=parsed.value.spec;
 const topology=requireTwoNodeRelayTopology(parsed.value);
 if(!spec.transport)throw new Error('UNSUPPORTED_CAPABILITY: Locked Relay Transport required');
 const ingress=nodes.find(n=>n.nodeId===topology.nodes[0]!.nodeId),egress=nodes.find(n=>n.nodeId===topology.nodes[1]!.nodeId);
 if(nodes.length!==2||!ingress||!egress||ingress.scopeId!==forward.scopeId||egress.scopeId!==forward.scopeId)throw new Error('AUTHORIZATION_DENIED: Exact same-scope Nodes required');
 if(profile.profileId!==spec.transport.profileId||profile.revision!==spec.transport.configRevision||endpoint.nodeId!==egress.nodeId||!isCounter(endpoint.revision))throw new Error('AUTHORIZATION_DENIED: Locked Profile and egress endpoint required');
 for(const node of nodes)if(!node.capabilities.includes('native.relay.v1')||!node.capabilities.includes('adp.3')||!node.capabilities.includes('relay.wire.1')||spec.protocols.some(p=>!node.capabilities.includes(p)))throw new Error('UNSUPPORTED_CAPABILITY: Exact ADP/Relay wire capability required');
 if(spec.protocols.some(p=>!config.protocols.includes(p))||!ingress.allowedListenerAddresses.includes(spec.ingress.listen.address)||!ingress.allowedPorts.includes(spec.ingress.listen.port)||!targetAllowed(spec.target.host,egress)||!targetAllowed(endpoint.config.advertisedHost,ingress))throw new Error('AUTHORIZATION_DENIED: Relay listener or dial policy denied');
 const resources:RelayResource[]=[];for(const protocol of spec.protocols){const port=egressPorts[protocol];if(!isPort(port)||!endpoint.config.allowedTcpPorts.includes(port))throw new Error('RESOURCE_CONFLICT: Authorized TLS port required');resources.push({nodeId:ingress.nodeId,role:'ingress',forwardProtocol:protocol,physicalProtocol:protocol,address:spec.ingress.listen.address,port:spec.ingress.listen.port},{nodeId:egress.nodeId,role:'egress',forwardProtocol:protocol,physicalProtocol:'tcp',address:endpoint.config.listenAddress,port});}
 if(new Set(resources.map(r=>`${r.nodeId}/${r.physicalProtocol}/${r.port}`)).size!==resources.length)throw new Error('RESOURCE_CONFLICT: Internal TLS sockets require distinct physical resources');
 return deepFreeze(resources);
}
