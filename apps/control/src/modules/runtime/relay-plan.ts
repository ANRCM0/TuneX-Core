import { deepFreeze, isCounter, parseForward } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { digest, parseRelayAssignment, parseRelayMessage, validateTime } from '@tunex/contracts';
import type { RelayBinding, RelayConfig, RuntimeAssignment } from '@tunex/contracts';
import type { ResolvedProfile } from '../transport.ts';
import type { ResolvedEndpoint } from '../relay-endpoints.ts';
import type { AuthorizedNodeFacts } from './planner.ts';
import { compileRelayResources } from './relay-planner.ts';
import { requireTwoNodeRelayTopology } from './path-topology.ts';
import type { RelayResource } from './relay-planner.ts';

export interface RelayNodeExecutionFacts {
  facts: AuthorizedNodeFacts;
  sessionEpoch: number;
  credentialUntil: number;
  peers: readonly { fingerprint: string; validUntil: number }[];
}
export interface ReservedRelayResource extends RelayResource {
  forwardId: string;
  deploymentGeneration: number;
  bindingFence: number;
}
export interface RelayPreparedPlan {
  path?: string[];
  endpointRevisions?: Record<string,number>;
  forwardId: string;
  forwardRevision: number;
  deploymentGeneration: number;
  endpointRevision: number;
  authorizationUntil: number;
  nodes: { nodeId: string; sessionEpoch: number; assignments: RuntimeAssignment[] }[];
  planDigest: string;
}

// Compiles already-authorized facts and exclusive reservations. It grants no permission, publishes no Snapshot and opens no socket.
export function compileRelayPlan(input: {
  forward: Forward;
  nodes: readonly RelayNodeExecutionFacts[];
  profile: ResolvedProfile;
  endpoint: ResolvedEndpoint;
  reservations: readonly ReservedRelayResource[];
  issuedAt: string;
  drainTimeoutSeconds: number;
}): RelayPreparedPlan {
  const parsed = parseForward(input.forward);
  if (!parsed.ok) throw new Error('INVALID_CONFIG: Invalid Forward');
  const forward = parsed.value;
  const topology = requireTwoNodeRelayTopology(forward);
  if (!forward.spec.enabled || !forward.spec.transport) throw new Error('UNSUPPORTED_CAPABILITY: Enabled two-Node Relay intent required');
  validateTime(input.issuedAt);
  const now = Date.parse(input.issuedAt);
  if (!Number.isInteger(input.drainTimeoutSeconds) || input.drainTimeoutSeconds < 0 || input.drainTimeoutSeconds > 300) throw new Error('INVALID_CONFIG: Bounded drain timeout required');
  const ingress = input.nodes.find(node => node.facts.nodeId === topology.nodes[0]!.nodeId);
  const egress = input.nodes.find(node => node.facts.nodeId === topology.nodes[1]!.nodeId);
  if (input.nodes.length !== 2 || !ingress || !egress || ingress === egress) throw new Error('AUTHORIZATION_DENIED: Exact two Node facts required');
  let authorizationUntil = Number.MAX_SAFE_INTEGER;
  for (const node of [ingress, egress]) {
    if (!isCounter(node.sessionEpoch) || !Number.isSafeInteger(node.credentialUntil) || node.credentialUntil <= now || node.peers.length < 1 || node.peers.length > 2) throw new Error('AUTHORIZATION_DENIED: Current session and bounded peer authority required');
    if (new Set(node.peers.map(peer => peer.fingerprint)).size !== node.peers.length || node.peers.some(peer => !/^sha256:[0-9a-f]{64}$/.test(peer.fingerprint) || !Number.isSafeInteger(peer.validUntil) || peer.validUntil <= now)) throw new Error('AUTHORIZATION_DENIED: Valid unique peer credentials required');
    authorizationUntil = Math.min(authorizationUntil, node.credentialUntil, ...node.peers.map(peer => peer.validUntil));
  }
  const profile = parseRelayMessage('ProfileConfig', JSON.stringify(input.profile.config));
  const ports = {} as Record<'tcp' | 'udp', number>;
  for (const protocol of forward.spec.protocols) {
    const slots = input.reservations.filter(slot => slot.role === 'egress' && slot.forwardProtocol === protocol);
    if (slots.length !== 1) throw new Error('RESOURCE_CONFLICT: Missing or ambiguous internal TLS resource');
    ports[protocol] = slots[0]!.port;
  }
  const resources = compileRelayResources(forward, input.nodes.map(node => node.facts), input.profile, input.endpoint, ports);
  if (input.reservations.length !== resources.length) throw new Error('RESOURCE_CONFLICT: Exact reserved Relay resource set required');
  let generation: number | undefined;
  const reservations = resources.map(resource => {
    const slots = input.reservations.filter(slot => slot.nodeId === resource.nodeId && slot.role === resource.role && slot.forwardProtocol === resource.forwardProtocol && slot.physicalProtocol === resource.physicalProtocol && slot.address === resource.address && slot.port === resource.port && slot.forwardId === forward.id);
    const slot = slots[0];
    if (slots.length !== 1 || !slot || !isCounter(slot.bindingFence) || !isCounter(slot.deploymentGeneration)) throw new Error('RESOURCE_CONFLICT: Valid exclusive Relay reservation required');
    generation ??= slot.deploymentGeneration;
    if (slot.deploymentGeneration !== generation) throw new Error('INTEGRITY_FAILURE: Relay deployment generation differs across Nodes');
    return { ...slot };
  });
  const assignmentID = (nodeId: string, protocol: string, role: string) => `a:${digest({ nodeId, forwardId: forward.id, protocol, role }).slice(7)}`;
  const plans = [ingress, egress].map(node => ({ nodeId: node.facts.nodeId, sessionEpoch: node.sessionEpoch, assignments: [] as RuntimeAssignment[] }));
  for (const protocol of forward.spec.protocols) {
    const ingressSlot = reservations.find(slot => slot.role === 'ingress' && slot.forwardProtocol === protocol)!;
    const egressSlot = reservations.find(slot => slot.role === 'egress' && slot.forwardProtocol === protocol)!;
    const binding: RelayBinding = {
      scopeId: forward.scopeId, forwardId: forward.id, forwardRevision: forward.revision, deploymentGeneration: generation!,
      ingressNodeId: ingress.facts.nodeId, egressNodeId: egress.facts.nodeId,
      ingressAssignmentId: assignmentID(ingress.facts.nodeId, protocol, 'relay-ingress'), egressAssignmentId: assignmentID(egress.facts.nodeId, protocol, 'relay-egress'),
      ingressSessionEpoch: ingress.sessionEpoch, egressSessionEpoch: egress.sessionEpoch, ingressFence: ingressSlot.bindingFence, egressFence: egressSlot.bindingFence,
      profileId: input.profile.profileId, profileRevision: input.profile.revision, profileDigest: input.profile.configDigest,
    };
    for (const [node, peer, slot] of [[ingress, egress, ingressSlot], [egress, ingress, egressSlot]] as const) {
      const role = slot.role === 'ingress' ? 'relay-ingress' : 'relay-egress';
      const config: RelayConfig = {
        role, binding, profile, peerFingerprints: peer.peers.map(peer => peer.fingerprint).sort(),
        egressPolicyRevision: node.facts.egressPolicyRevision, allowedDestinationCidrs: [...new Set(node.facts.allowedDestinationCidrs)].sort(), allowMetadataTargets: node.facts.allowMetadataTargets,
        ...(role === 'relay-ingress' ? { peerEndpoint: { host: input.endpoint.config.advertisedHost, port: egressSlot.port } } : { target: forward.spec.target }),
      };
      const assignment: RuntimeAssignment = {
        assignmentId: role === 'relay-ingress' ? binding.ingressAssignmentId : binding.egressAssignmentId,
        forwardId: forward.id, forwardRevision: forward.revision, deploymentGeneration: generation!, bindingFence: slot.bindingFence,
        role, protocol, phase: 'prepared', resource: { address: slot.address, port: slot.port, protocol: slot.physicalProtocol },
        driver: { id: 'native.relay.v1', schemaVersion: 1, configDigest: digest(config), config }, drainTimeoutSeconds: input.drainTimeoutSeconds,
      };
      parseRelayAssignment('Assignment', JSON.stringify({ ...assignment, protocolVersion: 3, nodeId: node.facts.nodeId, sessionEpoch: node.sessionEpoch }));
      plans.find(plan => plan.nodeId === node.facts.nodeId)!.assignments.push(assignment);
    }
  }
  for (const node of plans) node.assignments.sort((a, b) => a.assignmentId < b.assignmentId ? -1 : a.assignmentId > b.assignmentId ? 1 : 0);
  plans.sort((a, b) => a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0);
  const body = { forwardId: forward.id, forwardRevision: forward.revision, deploymentGeneration: generation!, endpointRevision: input.endpoint.revision, authorizationUntil, nodes: plans };
  return deepFreeze({ ...body, planDigest: digest(body) });
}

// Compare exact current peer pins; retiring leaves remain historical authority but
// must not shorten or invalidate a replacement plan after their overlap ends.
export function relayPeerPinsChanged(plan: RelayPreparedPlan, facts: readonly RelayNodeExecutionFacts[]): boolean {
  return plan.nodes.some(node => node.assignments.some(assignment => {
    const config = assignment.driver.config as RelayConfig;
    const peerId = assignment.role === 'relay-ingress' ? config.binding.egressNodeId : config.binding.ingressNodeId;
    const peer = facts.find(part => part.facts.nodeId === peerId);
    return !peer || digest(config.peerFingerprints) !== digest(peer.peers.map(credential => credential.fingerprint).sort());
  }));
}
