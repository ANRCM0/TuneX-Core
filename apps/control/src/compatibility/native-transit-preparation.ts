import type { Forward } from '@tunex/core';
import { validCidr, validateTime } from '@tunex/contracts/shared';
import { parseRelayMessage } from '@tunex/contracts/runtime';
import { parseTransitIntent } from '@tunex/contracts/experimental/transit';
import type { TransitIntent } from '@tunex/contracts/experimental/transit';
import type { RuntimeRelayEndpoint, RuntimeRelayNodeFacts } from '../framework/public.ts';
import type { NativeRuntimeRelayProfile as RuntimeRelayProfile } from './native-runtime-family.ts';

export { validCidr as nativeTransitValidCidr, validateTime as nativeTransitValidateTime };

export function nativeTransitProfileConfig(input:unknown) {
    return parseRelayMessage('ProfileConfig',JSON.stringify(input));
}

export interface NativeTransitIntentBinding {
    readonly nodeId:string; readonly assignmentId:string;
    readonly sessionEpoch:number; readonly bindingFence:number;
    readonly resource:{readonly address:string;readonly port:number};
}
export interface NativeTransitPreparationIntentSource {
    forward:Forward; generation:number; pathDigest:string; protocol:'tcp'|'udp';
    input:{profile:RuntimeRelayProfile;peerPins:Readonly<Record<string,string>>;issuedAt:string;maxConnections:number};
    hop:{index:number}; route:{nodes:readonly unknown[]};
    local:NativeTransitIntentBinding; up:NativeTransitIntentBinding; down:NativeTransitIntentBinding;
    endpoint:RuntimeRelayEndpoint; node:RuntimeRelayNodeFacts; until:number;
}

/** Project already-checked values only; no admission, clock or resource authority. */
export function nativeTransitPreparationIntent(source:NativeTransitPreparationIntentSource):TransitIntent {
    const {forward,generation,input,pathDigest,hop,route,local,up,down,endpoint,node,until,protocol}=source;
    const intent = {
      contractVersion: 1, role: 'relay-transit', driver: 'native.transit.v1',
      security: 'mutual-tls13', scopeId: forward.scopeId, forwardId: forward.id,
      forwardRevision: forward.revision, deploymentGeneration: generation,
      profileId: input.profile.profileId, profileRevision: input.profile.revision,
      profileDigest: input.profile.configDigest, pathDigest,
      nodeId: local.nodeId, assignmentId: local.assignmentId,
      sessionEpoch: local.sessionEpoch, bindingFence: local.bindingFence,
      protocol, hopIndex: hop.index, hopCount: route.nodes.length,
      listener: { address: local.resource.address, port: local.resource.port, protocol: 'tcp' },
      upstream: { nodeId: up.nodeId, assignmentId: up.assignmentId,
        sessionEpoch: up.sessionEpoch, bindingFence: up.bindingFence,
        peerFingerprint: input.peerPins[up.nodeId] },
      downstream: { nodeId: down.nodeId, assignmentId: down.assignmentId,
        sessionEpoch: down.sessionEpoch, bindingFence: down.bindingFence,
        peerFingerprint: input.peerPins[down.nodeId],
        endpoint: { host: endpoint.config.advertisedHost, port: down.resource.port } },
      issuedAt: input.issuedAt, authorizationUntil: new Date(until).toISOString(),
      egressPolicyRevision: node.facts.egressPolicyRevision,
      allowedDestinationCidrs: [...new Set(node.facts.allowedDestinationCidrs)].sort(),
      allowMetadataTargets: node.facts.allowMetadataTargets, maxConnections: input.maxConnections,
    };
    return parseTransitIntent(JSON.stringify(intent));
}
