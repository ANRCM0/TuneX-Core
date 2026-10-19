import type { Forward } from '@tunex/core';
import type { RuntimeRelayNodeFacts } from '../../framework/public.ts';
import type { ResolvedProfile } from '../transport-owner/public.ts';
import type { ResolvedEndpoint } from '../relay-endpoint-owner/public.ts';
import type { TransitIntent } from '../../compatibility/public.ts';

export type HopRole = 'ingress' | 'transit' | 'egress';
export interface TransitResource {
  readonly nodeId: string; readonly role: HopRole;
  readonly forwardProtocol: 'tcp' | 'udp'; readonly physicalProtocol: 'tcp' | 'udp';
  readonly address: string; readonly port: number;
}
export interface ReservedTransitResource extends TransitResource {
  readonly forwardId: string; readonly deploymentGeneration: number; readonly bindingFence: number;
}
export interface HopBinding {
  readonly assignmentId: string; readonly nodeId: string; readonly role: HopRole;
  readonly protocol: 'tcp' | 'udp'; readonly sessionEpoch: number;
  readonly bindingFence: number; readonly resource: TransitResource;
  readonly upstreamNodeId?: string; readonly downstreamNodeId?: string;
}
export interface TransitPreparation {
  readonly executable: false; readonly scopeId: string; readonly forwardId: string;
  readonly forwardRevision: number; readonly deploymentGeneration: number;
  readonly profileDigest: string; readonly pathDigest: string;
  readonly authorizationUntil: number; readonly activationOrder: readonly string[];
  readonly assignments: readonly HopBinding[]; readonly intents: readonly TransitIntent[];
  readonly planDigest: string;
}

export interface TransitInput {
  forward: Forward; profile: ResolvedProfile;
  nodes: readonly RuntimeRelayNodeFacts[];
  endpoints: readonly ResolvedEndpoint[];
  ports: Readonly<Record<string, Partial<Record<'tcp' | 'udp', number>>>>;
}
export type TransitPreparationInput = Omit<TransitInput, 'ports'> & {
  reservations: readonly ReservedTransitResource[];
  issuedAt: string; peerPins: Readonly<Record<string, string>>;
  maxConnections: number;
};
