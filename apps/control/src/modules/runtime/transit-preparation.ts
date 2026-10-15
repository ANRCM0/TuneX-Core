import { deepFreeze, isCounter, isPort, parseForward } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { digest, parseRelayMessage, parseTransitIntent, validCidr, validateTime } from '@tunex/contracts';
import type { TransitIntent } from '@tunex/contracts';
import { parseRelayEndpoint } from '../relay-endpoints.ts';
import type { ResolvedEndpoint } from '../relay-endpoints.ts';
import type { ResolvedProfile } from '../transport.ts';
import { targetAllowed } from '../target-policy.ts';
import type { RelayNodeExecutionFacts } from './relay-plan.ts';
import { compilePathTopology } from './path-topology.ts';

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
  nodes: readonly RelayNodeExecutionFacts[];
  endpoints: readonly ResolvedEndpoint[];
  ports: Readonly<Record<string, Partial<Record<'tcp' | 'udp', number>>>>;
}

function checkPath(input: TransitInput) {
  const parsed = parseForward(input.forward);
  if (!parsed.ok || !parsed.value.spec.enabled || !parsed.value.spec.transport)
    throw new Error('INVALID_CONFIG: Enabled multi-hop path and locked Profile required');
  const forward = parsed.value, route = compilePathTopology(forward);
  if (route.nodes.length < 3)
    throw new Error('UNSUPPORTED_CAPABILITY: Transit requires at least three Nodes');
  const ref = forward.spec.transport;
  if (input.profile.profileId !== ref.profileId || input.profile.revision !== ref.configRevision ||
      !isCounter(input.profile.revision))
    throw new Error('AUTHORIZATION_DENIED: Profile revision differs');
  const profile = parseRelayMessage('ProfileConfig', JSON.stringify(input.profile.config));
  if (digest(profile) !== input.profile.configDigest ||
      forward.spec.protocols.some(p => !profile.protocols.includes(p)))
    throw new Error('INTEGRITY_FAILURE: Profile config differs');
  if (input.nodes.length !== route.nodes.length || input.endpoints.length !== route.nodes.length - 1)
    throw new Error('AUTHORIZATION_DENIED: Complete Node/endpoint facts required');
  const known = new Set(route.nodes.map(n => n.nodeId));
  if (Object.keys(input.ports).some(id => !known.has(id) || id === route.nodes[0]!.nodeId))
    throw new Error('INVALID_CONFIG: Unexpected internal port owner');
  const nodeById = new Map(input.nodes.map(n => [n.facts.nodeId, n]));
  const endpoints = new Map(input.endpoints.map(e => [e.nodeId, e]));
  if (nodeById.size !== route.nodes.length || endpoints.size !== route.nodes.length - 1)
    throw new Error('AUTHORIZATION_DENIED: Duplicate Node or missing endpoint');
  for (const hop of route.nodes) {
    const node = nodeById.get(hop.nodeId);
    if (!node || node.facts.scopeId !== forward.scopeId ||
        !node.facts.capabilities.includes('adp.3') ||
        !node.facts.capabilities.includes('adp.multihop.1') ||
        forward.spec.protocols.some(p => !node.facts.capabilities.includes(p)))
      throw new Error('UNSUPPORTED_CAPABILITY: Scoped multi-hop capability required');
    const features = hop.role === 'transit'
      ? ['native.transit.v1', 'transit.wire.1'] : ['native.relay.v1', 'relay.wire.1'];
    if (features.some(x => !node.facts.capabilities.includes(x)))
      throw new Error('UNSUPPORTED_CAPABILITY: Role-specific wire support required');
    if (!isCounter(node.facts.egressPolicyRevision) ||
        !node.facts.allowedDestinationCidrs.length ||
        node.facts.allowedDestinationCidrs.some(c => !validCidr(c)))
      throw new Error('AUTHORIZATION_DENIED: Missing destination policy');
    if (hop.index === 0) {
      if (!node.facts.allowedListenerAddresses.includes(forward.spec.ingress.listen.address) ||
          !node.facts.allowedPorts.includes(forward.spec.ingress.listen.port))
        throw new Error('AUTHORIZATION_DENIED: Ingress listener denied');
    } else {
      const endpoint = endpoints.get(hop.nodeId);
      if (!endpoint) throw new Error('AUTHORIZATION_DENIED: Missing next hop endpoint');
      parseRelayEndpoint(endpoint.config);
      if (!node.facts.allowedListenerAddresses.includes(endpoint.config.listenAddress))
        throw new Error('AUTHORIZATION_DENIED: Internal bind address denied');
    }
    if (hop.downstreamNodeId) {
      const next = endpoints.get(hop.downstreamNodeId);
      if (!next || !targetAllowed(next.config.advertisedHost, node.facts))
        throw new Error('AUTHORIZATION_DENIED: Neighbor target denied');
    } else if (!targetAllowed(forward.spec.target.host, node.facts))
      throw new Error('AUTHORIZATION_DENIED: Egress destination denied');
  }
  return { forward, route, nodeById, endpoints };
}

/** Pure, non-authorizing resource topology. Transit/egress UDP needs TCP sockets. */
export function compileTransitResources(input: TransitInput): readonly TransitResource[] {
  const { forward, route, endpoints } = checkPath(input);
  const out: TransitResource[] = [];
  for (const hop of route.nodes) for (const protocol of forward.spec.protocols) {
    const endpoint = hop.index > 0 ? endpoints.get(hop.nodeId)! : undefined;
    const port = endpoint ? input.ports[hop.nodeId]?.[protocol] : forward.spec.ingress.listen.port;
    if (!isPort(port)) throw new Error('RESOURCE_CONFLICT: Missing internal TLS port');
    if (endpoint && !endpoint.config.allowedTcpPorts.includes(port))
      throw new Error('AUTHORIZATION_DENIED: Internal TLS port denied');
    out.push({ nodeId: hop.nodeId, role: hop.role as HopRole, forwardProtocol: protocol,
      physicalProtocol: endpoint ? 'tcp' : protocol,
      address: endpoint ? endpoint.config.listenAddress : forward.spec.ingress.listen.address, port });
  }
  const keys = out.map(r => r.nodeId + '/' + r.physicalProtocol + '/' + r.port);
  if (keys.length !== new Set(keys).size)
    throw new Error('RESOURCE_CONFLICT: Physical TCP/UDP port collision');
  return deepFreeze(out);
}

/** Strict offline compiler. Never return an executable ADP/3 assignment. */
export function compileTransitPreparation(input: Omit<TransitInput, 'ports'> & {
  reservations: readonly ReservedTransitResource[];
  issuedAt: string; peerPins: Readonly<Record<string, string>>;
  maxConnections: number;
}): TransitPreparation {
  validateTime(input.issuedAt);
  const issuedAt = Date.parse(input.issuedAt);
  if (!Number.isSafeInteger(issuedAt) || !Number.isInteger(input.maxConnections) ||
      input.maxConnections < 1 || input.maxConnections > 4096)
    throw new Error('INVALID_CONFIG: Invalid time or connection limit');
  const ports: Record<string, Partial<Record<'tcp' | 'udp', number>>> = {};
  for (const r of input.reservations) {
    if (r.role === 'ingress') continue;
    if (!ports[r.nodeId]) ports[r.nodeId] = {};
    ports[r.nodeId]![r.forwardProtocol] = r.port;
  }
  const { forward, route, nodeById, endpoints } = checkPath({ ...input, ports });
  const expected = compileTransitResources({ ...input, ports });
  if (input.reservations.length !== expected.length ||
      Object.keys(input.peerPins).length !== route.nodes.length)
    throw new Error('RESOURCE_CONFLICT: Exact reservations and peer identities required');
  const assignments: HopBinding[] = [];
  const usedPins = new Set<string>();
  let generation: number | undefined, until = Number.MAX_SAFE_INTEGER;
  for (const hop of route.nodes) {
    const node = nodeById.get(hop.nodeId)!;
    const pin = input.peerPins[hop.nodeId];
    const selected = node.peers.filter(p => p.fingerprint === pin && p.validUntil > issuedAt);
    if (!pin || !/^sha256:[a-f0-9]{64}$/.test(pin) || usedPins.has(pin) ||
        selected.length !== 1 || !isCounter(node.sessionEpoch) ||
        !Number.isSafeInteger(node.credentialUntil) || node.credentialUntil <= issuedAt)
      throw new Error('AUTHORIZATION_DENIED: Active distinct Node identity/session required');
    usedPins.add(pin);
    until = Math.min(until, node.credentialUntil, selected[0]!.validUntil);
    for (const protocol of forward.spec.protocols) {
      const resource = expected.find(r => r.nodeId === hop.nodeId && r.forwardProtocol === protocol)!;
      const matches = input.reservations.filter(r => r.nodeId === resource.nodeId &&
        r.role === resource.role && r.forwardProtocol === resource.forwardProtocol &&
        r.physicalProtocol === resource.physicalProtocol && r.address === resource.address &&
        r.port === resource.port && r.forwardId === forward.id);
      const slot = matches[0];
      if (matches.length !== 1 || !slot || !isCounter(slot.deploymentGeneration) ||
          !isCounter(slot.bindingFence))
        throw new Error('RESOURCE_CONFLICT: Missing or foreign fenced reservation');
      generation ??= slot.deploymentGeneration;
      if (slot.deploymentGeneration !== generation)
        throw new Error('INTEGRITY_FAILURE: Mixed deployment generation');
      const role = hop.role as HopRole;
      assignments.push({ assignmentId: 'a:' + digest({ nodeId: hop.nodeId, forwardId: forward.id, protocol, role }).slice(7),
        nodeId: hop.nodeId, role, protocol, sessionEpoch: node.sessionEpoch,
        bindingFence: slot.bindingFence, resource,
        ...(hop.upstreamNodeId ? { upstreamNodeId: hop.upstreamNodeId } : {}),
        ...(hop.downstreamNodeId ? { downstreamNodeId: hop.downstreamNodeId } : {}) });
    }
  }
  if (!generation || until <= issuedAt) throw new Error('LEASE_EXPIRED: Transit identity expired');
  const pathDigest = digest({ forwardId: forward.id, revision: forward.revision, scopeId: forward.scopeId,
    generation, profileId: input.profile.profileId, profileRevision: input.profile.revision,
    profileDigest: input.profile.configDigest, nodes: route.nodes, assignments });
  const intents: TransitIntent[] = [];
  for (const hop of route.nodes.filter(h => h.role === 'transit')) for (const protocol of forward.spec.protocols) {
    const local = assignments.find(a => a.nodeId === hop.nodeId && a.protocol === protocol)!;
    const up = assignments.find(a => a.nodeId === hop.upstreamNodeId && a.protocol === protocol)!;
    const down = assignments.find(a => a.nodeId === hop.downstreamNodeId && a.protocol === protocol)!;
    const endpoint = endpoints.get(down.nodeId)!;
    const node = nodeById.get(hop.nodeId)!;
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
    intents.push(parseTransitIntent(JSON.stringify(intent)));
  }
  const body = { executable: false as const, scopeId: forward.scopeId, forwardId: forward.id,
    forwardRevision: forward.revision, deploymentGeneration: generation,
    profileDigest: input.profile.configDigest, pathDigest, authorizationUntil: until,
    activationOrder: [...route.activationOrder], assignments, intents };
  return deepFreeze({ ...body, planDigest: digest(body) });
}
