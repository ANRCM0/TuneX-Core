import { deepFreeze, parseForward } from '@tunex/core';
import type { Forward, NetworkProtocol } from '@tunex/core';

/**
 * Topology is an immutable, role-neutral *plan*, not an ADP/3 Assignment.
 * It grants no peer authority, reserves no port and does not activate sockets.
 * A Node identity has no permanent ingress/transit/egress role: each Forward
 * independently assigns its own roles to the ordered path.
 */
export const MAX_PLANNED_PATH_NODES = 8;

export type PathRole = 'direct' | 'ingress' | 'transit' | 'egress';

export interface PathNode {
  readonly nodeId: string;
  readonly index: number;
  readonly role: PathRole;
  readonly upstreamNodeId?: string;
  readonly downstreamNodeId?: string;
}

export interface PathHop {
  readonly index: number;
  readonly upstreamNodeId: string;
  readonly downstreamNodeId: string;
}

export interface PathTopology {
  readonly forwardId: string;
  readonly scopeId: string;
  readonly forwardRevision: number;
  readonly protocols: readonly NetworkProtocol[];
  /** Intent order; used for user display, NOT safe activation order. */
  readonly nodes: readonly PathNode[];
  readonly hops: readonly PathHop[];
  /** Downstream-first: egress -> transit(s) -> ingress. */
  readonly activationOrder: readonly string[];
}

/**
 * Compile a *proposed* route using only the validated Forward intent.
 * Identity, current credentials, all grants/capabilities, endpoint reachability,
 * peer pins, physical reservations and current sessions are checked by Runtime
 * before accepting or activating a deployment, not by this pure function.
 */
export function compilePathTopology(input: Forward): PathTopology {
  const parsed = parseForward(input);
  if (!parsed.ok) throw new Error('INVALID_CONFIG: Invalid Forward path');

  const { id, revision, scopeId, spec } = parsed.value;
  const sequence = [spec.ingress.nodeId, ...(spec.path?.via ?? [])];
  if (sequence.length > MAX_PLANNED_PATH_NODES) {
    throw new Error('RESOURCE_LIMIT: Forward path exceeds the bounded Node count');
  }
  // Parser enforces this too; keep the security-critical graph precondition
  // explicit in the planner in case the domain representation changes.
  if (new Set(sequence).size !== sequence.length) {
    throw new Error('INVALID_CONFIG: Repeated or cyclic Node in Forward path');
  }
  const nodes: PathNode[] = sequence.map((nodeId, index) => {
    const role: PathRole = sequence.length === 1 ? 'direct'
      : index === 0 ? 'ingress'
      : index === sequence.length - 1 ? 'egress' : 'transit';
    return {
      nodeId, index, role,
      ...(index > 0 ? { upstreamNodeId: sequence[index - 1]! } : {}),
      ...(index < sequence.length - 1 ? { downstreamNodeId: sequence[index + 1]! } : {}),
    };
  });
  const hops: PathHop[] = sequence.slice(1).map((downstreamNodeId, index) => ({
    index, upstreamNodeId: sequence[index]!, downstreamNodeId,
  }));
  return deepFreeze({
    forwardId: id, scopeId, forwardRevision: revision,
    protocols: [...spec.protocols], nodes, hops,
    activationOrder: [...sequence].reverse(),
  });
}

/**
 * Fail closed at the current native.relay.v1 runtime boundary: the topology
 * builder can describe N hops, but ADP/3 Relay execution still supports only
 * exactly two nodes and MUST NOT accept transit assignments.
 */
export function requireTwoNodeRelayTopology(input: Forward): PathTopology {
  const plan = compilePathTopology(input);
  if (plan.nodes.length !== 2
    || plan.nodes[0]?.role !== 'ingress'
    || plan.nodes[1]?.role !== 'egress') {
    throw new Error('UNSUPPORTED_CAPABILITY: Current native Relay supports exactly two Nodes; Transit is not executable');
  }
  return plan;
}
