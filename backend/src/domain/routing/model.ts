import { z } from "zod";
import { canonicalConfigDigest } from "../link/core-contract.ts";

export const ROUTING_SCHEMA_VERSION = 1;
export const ROUTING_MAX_HOPS = 3;
export const ROUTING_MAX_CANDIDATES = 16;
export const ROUTING_MAX_REQUEST_BYTES = 32 * 1024;
export const ROUTING_LIMITS = { nodes: 256, bindings: 512, links: 256, forwards: 500 } as const;
export type RoutingProtocol = "tcp" | "udp" | "both";
export type RoutingTransport = "native_plain" | "tst_v1";
export type RoutingHealth = { state: "unknown"; reason: "probe_not_recorded"; observed_at: null };
export const unmeasuredHealth = (): RoutingHealth => ({ state: "unknown", reason: "probe_not_recorded", observed_at: null });

/** Business reachability is independent of enrollment, heartbeat and apply ACK. */
export interface RoutingNode {
  id: number; workspace_id: number; node_key: string;
  role: "ingress" | "egress" | "both" | null;
  lifecycle: string; connection: "waiting" | "online" | "offline";
  capabilities: {
    state: "current" | "unknown" | "stale" | "invalid";
    native_plain: RoutingProtocol[]; tst_v1: RoutingProtocol[];
    reported_at: string | null;
  };
  health: RoutingHealth;
}
export interface RoutingEdge {
  id: string; workspace_id: number; from_node_id: number; to_node_id: number;
  transport: RoutingTransport;
  source: { kind: "node_binding" | "link_resource"; id: number; version: number | null };
  status: string;
  cost: { value: null; basis: "unconfigured" };
  quality: { rtt_ms: null; loss_percent: null; handshake_success_rate: null; observed_at: null };
  health: RoutingHealth;
}
export interface RoutingForward {
  id: number; workspace_id: number; revision: number | null;
  path: "direct" | "relay" | null; transport: RoutingTransport | null; protocol: RoutingProtocol | null;
  ingress_node_id: number | null;
  /** The node authorized to dial this Forward's target; never inferred from Ready. */
  target_node_id: number | null;
  current_edge_ids: string[];
  desired_status: string | null; apply_status: string | null;
  issues: string[];
}
export interface RoutingTopology {
  schema_version: 1; workspace_id: number; generated_at: string; digest: string;
  nodes: RoutingNode[]; edges: RoutingEdge[]; forwards: RoutingForward[];
  notices: { source: "link_resource"; id: number; code: string }[];
  execution_enabled: false;
}

/** Clocks are observational metadata, so an unchanged graph has an unchanged identity. */
export function topologyDigest(graph: Omit<RoutingTopology, "digest" | "generated_at">): string {
  return canonicalConfigDigest(graph);
}

const id = z.number().int().positive().max(2_147_483_647);
export const RoutingPreviewSchema = z.object({
  schema_version: z.literal(ROUTING_SCHEMA_VERSION),
  forward_id: id, expected_revision: id,
  topology_digest: z.string().regex(/^[a-f0-9]{64}$/),
  strategy: z.enum(["priority", "weighted"]),
  hop_limit: id.max(ROUTING_MAX_HOPS),
  candidates: z.array(z.object({
    id: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
    edge_ids: z.array(z.string().regex(/^(?:binding|link):[1-9][0-9]{0,9}$/)).max(ROUTING_MAX_HOPS - 1),
    priority: z.number().int().min(0).max(65535), weight: id.max(1000),
  }).strict()).min(1).max(ROUTING_MAX_CANDIDATES),
}).strict().superRefine((v, ctx) => {
  if (new Set(v.candidates.map((c) => c.id)).size !== v.candidates.length)
    ctx.addIssue({ code: "custom", path: ["candidates"], message: "duplicate_candidate_id" });
  if (new Set(v.candidates.map((c) => JSON.stringify(c.edge_ids))).size !== v.candidates.length)
    ctx.addIssue({ code: "custom", path: ["candidates"], message: "duplicate_candidate_path" });
});
export type RoutingPreviewInput = z.infer<typeof RoutingPreviewSchema>;

export class RoutingError extends Error {
  constructor(public readonly code: string, public readonly status: 400 | 403 | 404 | 409 | 413 | 422 | 503) {
    super(code);
  }
}

/** Validate an intent against a scoped snapshot; this result is never dispatch authority. */
export function previewRoutingPolicy(graph: RoutingTopology, raw: unknown) {
  const input = RoutingPreviewSchema.parse(raw);
  if (input.topology_digest !== graph.digest) throw new RoutingError("topology_conflict", 409);
  const forward = graph.forwards.find((f) => f.id === input.forward_id && f.workspace_id === graph.workspace_id);
  if (!forward) throw new RoutingError("forward_not_found", 404);
  if (input.expected_revision !== forward.revision) throw new RoutingError("revision_conflict", 409);
  if (forward.issues.length || !forward.ingress_node_id || !forward.target_node_id || !forward.protocol || !forward.transport)
    throw new RoutingError("forward_topology_unavailable", 409);
  const nodes = new Map(graph.nodes.filter((n) => n.workspace_id === graph.workspace_id).map((n) => [n.id, n]));
  const edges = new Map(graph.edges.filter((e) => e.workspace_id === graph.workspace_id).map((e) => [e.id, e]));
  const candidates = input.candidates.map((candidate) => {
    const reasons = new Set<string>();
    const admission = new Set<string>();
    const path = [forward.ingress_node_id!];
    if (forward.path === "direct" && candidate.edge_ids.length) reasons.add("direct_has_carrier_edges");
    if (forward.path === "relay" && !candidate.edge_ids.length) reasons.add("relay_requires_carrier_edge");
    for (const edgeId of candidate.edge_ids) {
      const edge = edges.get(edgeId);
      if (!edge) { reasons.add("edge_unavailable"); continue; }
      if (edge.from_node_id !== path.at(-1)) reasons.add("path_disconnected");
      if (edge.transport !== forward.transport) reasons.add("transport_mismatch");
      if (path.includes(edge.to_node_id)) reasons.add("routing_loop");
      path.push(edge.to_node_id);
      if (edge.source.kind === "link_resource" && !["draft", "active"].includes(edge.status))
        admission.add("link_unavailable");
    }
    if (path.length > input.hop_limit) reasons.add("hop_limit_exceeded");
    // Moving the target to another exit needs a new admission/authorization, not a preview.
    if (path.at(-1) !== forward.target_node_id) reasons.add("target_authority_mismatch");
    for (let index = 0; index < path.length; index++) {
      const node = nodes.get(path[index]!);
      if (!node) { reasons.add("node_unavailable"); continue; }
      const roles = path.length === 1 || index === 0 ? ["ingress", "both"]
        : index === path.length - 1 ? ["egress", "both"] : ["both"];
      if (!roles.includes(node.role ?? "")) reasons.add("node_role_mismatch");
      if (node.lifecycle !== "active" || node.connection !== "online") admission.add("node_not_accepting_business");
      if (!node.capabilities[forward.transport!].includes(forward.protocol!)) admission.add("capability_unavailable");
    }
    if (candidate.edge_ids.length > 1) admission.add("multi_hop_execution_unavailable");
    return { ...candidate, node_ids: path, valid: reasons.size === 0, reasons: [...reasons].sort(),
      admission_issues: [...admission].sort(), health: unmeasuredHealth() };
  });
  return { schema_version: ROUTING_SCHEMA_VERSION, workspace_id: graph.workspace_id, topology_digest: graph.digest,
    forward_id: forward.id, revision: forward.revision, strategy: input.strategy, hop_limit: input.hop_limit,
    valid: candidates.every((c) => c.valid), candidates, execution_enabled: false as const };
}
