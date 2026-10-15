import {normalizeIp, normalizeTargetHost} from '@tunex/core';
import {digest} from './digest.ts';
import {parseRelayMessage} from './relay.ts';
import type {RelayProfileConfig} from './relay.ts';
import {validCidr} from './validate.ts';

export const MULTIHOP_CAPABILITY = 'adp.execution.1';
export interface HopNode {
  nodeId: string; assignmentId: string; sessionEpoch: number; bindingFence: number;
  peerFingerprint: string; listenAddress: string; host: string; port: number;
}
export interface HopConfig {
  scopeId: string; forwardId: string; forwardRevision: number; deploymentGeneration: number;
  profileId: string; profileRevision: number; profileDigest: string; pathDigest: string;
  protocol: 'tcp'|'udp'; hopIndex: number; path: HopNode[]; profile: RelayProfileConfig;
  target: {host: string; port: number}; egressPolicyRevision: number;
  allowedDestinationCidrs: string[]; allowMetadataTargets: boolean;
}
export interface MultihopConfig {hop: HopConfig}
export function hopPathDigest(hop: Omit<HopConfig, 'pathDigest'> | HopConfig): string {
  return digest({scopeId: hop.scopeId, forwardId: hop.forwardId, forwardRevision: hop.forwardRevision,
    deploymentGeneration: hop.deploymentGeneration, profileId: hop.profileId,
    profileRevision: hop.profileRevision, profileDigest: hop.profileDigest,
    protocol: hop.protocol, path: hop.path, target: hop.target});
}
export function validateHopConfig(hop: HopConfig): void {
  parseRelayMessage('ProfileConfig', JSON.stringify(hop.profile));
  if (hop.path.length < 3 || hop.path.length > 8 || hop.hopIndex >= hop.path.length ||
      new Set(hop.path.map(n => n.nodeId)).size !== hop.path.length ||
      new Set(hop.path.map(n => n.assignmentId)).size !== hop.path.length ||
      new Set(hop.path.map(n => n.peerFingerprint)).size !== hop.path.length ||
      digest(hop.profile) !== hop.profileDigest || !hop.profile.protocols.includes(hop.protocol) ||
      hopPathDigest(hop) !== hop.pathDigest)
    throw new Error('INTEGRITY_FAILURE: Multi-hop path/Profile binding differs');
  if (normalizeTargetHost(hop.target.host) !== hop.target.host || hop.path.some(n =>
      normalizeIp(n.listenAddress) !== n.listenAddress || normalizeTargetHost(n.host) !== n.host) ||
      hop.allowedDestinationCidrs.some((cidr, i) => !validCidr(cidr) || i > 0 && hop.allowedDestinationCidrs[i-1]! >= cidr))
    throw new Error('INVALID_CONFIG: Canonical multi-hop endpoints/policy required');
}
