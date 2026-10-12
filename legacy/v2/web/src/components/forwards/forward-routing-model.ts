import type { RouteCandidate, RouteGraph, RouteIntent, RoutePolicyInput } from "@/lib/api/routing";

/** Enumerate only existing authorized edges between the Forward's fixed endpoints. */
export function routingChoices(graph: RouteGraph, forwardId: number): RouteCandidate[] {
  const forward = graph.forwards.find((f) => f.id === forwardId);
  if (!forward || forward.issues.length || forward.path !== "relay" || !forward.ingress_node_id || !forward.target_node_id) return [];
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const edges = graph.edges.filter((e) => e.transport === forward.transport);
  const paths: string[][] = [];
  for (const first of edges.filter((e) => e.from_node_id === forward.ingress_node_id)) {
    if (first.to_node_id === forward.target_node_id) paths.push([first.id]);
    else if (first.to_node_id !== forward.ingress_node_id && nodes.get(first.to_node_id)?.role === "both") {
      for (const second of edges.filter((e) => e.from_node_id === first.to_node_id && e.to_node_id === forward.target_node_id))
        paths.push([first.id, second.id]);
    }
  }
  return paths.sort((a, b) => a.join(",").localeCompare(b.join(","))).slice(0, 16)
    .map((edge_ids, index) => ({ id: `path_${index + 1}`, edge_ids, priority: index, weight: 1 }));
}
export function routingIntent(graph: RouteGraph, forwardId: number, strategy: RouteIntent["strategy"], candidates: RouteCandidate[]): RouteIntent {
  const forward = graph.forwards.find((f) => f.id === forwardId);
  if (!forward?.revision || !candidates.length || candidates.length > 16) throw new Error("routing_candidates_required");
  return { schema_version: 1, forward_id: forwardId, expected_revision: forward.revision, topology_digest: graph.digest,
    hop_limit: 3, strategy, candidates: candidates.map((c) => ({ ...c, edge_ids: [...c.edge_ids] })) };
}
export function routingDefaults(intent: RouteIntent, version = 0): RoutePolicyInput {
  return { schema_version: 1, expected_policy_version: version, intent, enabled: false, auto_failover: false, auto_failback: false,
    failure_threshold: 2, recovery_threshold: 2, cooldown_ms: 60000, max_rtt_ms: 1000, max_loss_percent: 10, min_handshake_success_rate: 1 };
}
export function routePathLabel(graph: RouteGraph, candidate: RouteCandidate) {
  const first = graph.edges.find((e) => e.id === candidate.edge_ids[0]);
  const ids = first ? [first.from_node_id, ...candidate.edge_ids.map((id) => graph.edges.find((e) => e.id === id)?.to_node_id)] : [];
  return ids.map((id) => graph.nodes.find((node) => node.id === id)?.node_key ?? `#${id ?? "?"}`).join(" → ");
}
