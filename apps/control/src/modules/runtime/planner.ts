import { deepFreeze, isCounter, isPort, parseForward } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { DEFAULT_POLICY, digest, parseRuntimeMessage, validCidr, withinLease } from '@tunex/contracts';
import type { RuntimeAssignment as Assignment, DirectConfig, Policy, RuntimeSnapshot as Snapshot } from '@tunex/contracts';

export interface AuthorizedNodeFacts {
  readonly nodeId: string; readonly scopeId: string; readonly capabilities: readonly string[];
  readonly allowedListenerAddresses: readonly string[]; readonly allowedPorts: readonly number[];
  readonly egressPolicyRevision: number; readonly allowedDestinationCidrs: readonly string[];
  readonly allowMetadataTargets: boolean;
}
export interface ReservedSlot {
  readonly nodeId: string; readonly forwardId: string; readonly protocol: 'tcp' | 'udp';
  readonly port: number; readonly bindingFence: number; readonly deploymentGeneration: number;
}
/** Deterministic compiler for an authorized, already-reserved direct intent. It does not grant authority or reserve resources. */
export function compileDirect(forward: Forward, facts: AuthorizedNodeFacts, reservations: readonly ReservedSlot[], phase: Assignment['phase'] = 'active', drainTimeoutSeconds = DEFAULT_POLICY.drainTimeoutSeconds): readonly Assignment[] {
  if (!['prepared', 'active', 'draining'].includes(phase) || !Number.isInteger(drainTimeoutSeconds) || drainTimeoutSeconds < 0 || drainTimeoutSeconds > 300) throw new Error('INVALID_CONFIG: Invalid execution phase/drain timeout');
  const parsed = parseForward(forward);
  if (!parsed.ok) throw new Error('INVALID_CONFIG: Invalid Forward');
  const { spec } = parsed.value;
  if (spec.path?.via.length || spec.transport) throw new Error('UNSUPPORTED_CAPABILITY: Relay is not implemented');
  if (facts.nodeId !== spec.ingress.nodeId || facts.scopeId !== forward.scopeId) throw new Error('AUTHORIZATION_DENIED: Node scope mismatch');
  if (!facts.allowedListenerAddresses.includes(spec.ingress.listen.address) || !facts.allowedPorts.includes(spec.ingress.listen.port)) throw new Error('AUTHORIZATION_DENIED: Listener is not allowed');
  if (!facts.capabilities.includes('adp.3')||!facts.capabilities.includes('native.direct.v1') || spec.protocols.some(p => !facts.capabilities.includes(p))) throw new Error('UNSUPPORTED_CAPABILITY: Unsupported driver or protocol');
  if (!isCounter(facts.egressPolicyRevision) || facts.allowedDestinationCidrs.length === 0 || facts.allowedDestinationCidrs.some(cidr => !validCidr(cidr))) throw new Error('AUTHORIZATION_DENIED: Invalid destination policy');
  if (!spec.enabled) throw new Error('INVALID_CONFIG: Disabled intent has no new active deployment');
  const config: DirectConfig = {
    target: spec.target, egressPolicyRevision: facts.egressPolicyRevision,
    allowedDestinationCidrs: [...new Set(facts.allowedDestinationCidrs)].sort(), allowMetadataTargets: facts.allowMetadataTargets,
  };
  const assignments = spec.protocols.map(protocol => {
    const slots = reservations.filter(slot => slot.nodeId === facts.nodeId && slot.forwardId === forward.id && slot.protocol === protocol && slot.port === spec.ingress.listen.port);
    const slot = slots[0];
    if (slots.length !== 1 || !slot || !isCounter(slot.bindingFence) || !isCounter(slot.deploymentGeneration) || !isPort(slot.port)) throw new Error('RESOURCE_CONFLICT: Missing or ambiguous reservation');
    const assignmentId = `a:${digest({ nodeId: facts.nodeId, forwardId: forward.id, protocol, role: 'direct' }).slice(7)}`;
    const assignment: Assignment = {
      assignmentId, forwardId: forward.id, forwardRevision: forward.revision,
      deploymentGeneration: slot.deploymentGeneration, bindingFence: slot.bindingFence,
      role: 'direct', protocol, phase, resource:{...spec.ingress.listen,protocol},
      driver: { id: 'native.direct.v1', schemaVersion: 1, configDigest: digest(config), config }, drainTimeoutSeconds,
    };
    return assignment;
  });
  return deepFreeze(assignments.sort((a, b) => a.assignmentId < b.assignmentId ? -1 : 1));
}
export interface SnapshotInput {
  nodeId: string; sessionEpoch: number; snapshotGeneration: number;
  issuedAt: string; validUntil: string; assignments: readonly Assignment[];
  tombstones: Snapshot['tombstones']; policy?: Policy;
}
/** Assemble a complete immutable node snapshot. Generations/time and the entire node set come from a durable Runtime transaction. */
export function compileSnapshot(input: SnapshotInput): Snapshot {
  const policy = input.policy ?? DEFAULT_POLICY;
  parseRuntimeMessage('HelloResponse', JSON.stringify({ protocolVersion: 3, nodeId: input.nodeId, bootId: 'policy-validation', sessionEpoch: input.sessionEpoch, serverTime: input.issuedAt, policy }));
  if (!withinLease(input.issuedAt, input.validUntil, policy.leaseSeconds)) throw new Error('INVALID_CONFIG: Lease exceeds policy');
  if (input.assignments.length > policy.maxAssignmentsPerNode) throw new Error('RESOURCE_LIMIT: Assignment limit exceeded');
  const assignments = [...input.assignments].sort((a, b) => a.assignmentId < b.assignmentId ? -1 : a.assignmentId > b.assignmentId ? 1 : 0);
  const tombstones = [...input.tombstones].sort((a, b) => (a.physicalProtocol < b.physicalProtocol ? -1 : a.physicalProtocol > b.physicalProtocol ? 1 : 0) || a.port - b.port || a.retirementGeneration - b.retirementGeneration || (a.assignmentId < b.assignmentId ? -1 : a.assignmentId > b.assignmentId ? 1 : 0));
  const body = {
    protocolVersion: 3 as const, nodeId: input.nodeId, sessionEpoch: input.sessionEpoch,
    snapshotGeneration: input.snapshotGeneration, complete: true as const,
    issuedAt: input.issuedAt, validUntil: input.validUntil, assignments, tombstones,
  };
  const raw = JSON.stringify({ ...body, snapshotDigest: digest(body) });
  if (Buffer.byteLength(raw) > policy.maxSnapshotBytes) throw new Error('RESOURCE_LIMIT: Complete snapshot too large');
  return parseRuntimeMessage('Snapshot', raw);
}
