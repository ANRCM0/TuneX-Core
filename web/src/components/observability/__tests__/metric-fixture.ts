import { projectObservability, type ObservabilityFacts } from "../../../../../backend/src/domain/observability/model";
import type { MetricCapabilities, MetricSnapshot, MetricWindow } from "@/lib/api/observability";

export const metricCapabilities: MetricCapabilities = { enabled: true, schema_versions: [1], stage: "experimental",
  features: { workspace_snapshot: true, archived_usage: true, tst_ingress_usage: true, node_telemetry: true, target_tcp_observations: true,
    active_connections: false, live_throughput: false, end_to_end_latency: false, error_rates: false, alerts: false, repair: false },
  limits: { nodes: 256, links: 512, forwards: 2048, usage_groups: 4096, targets: 4096, targets_per_forward: 32, window_days: 31 } };

/** Server projection of controlled facts, not evidence of a live collector. */
export function metricFixture(workspace: number, window: MetricWindow, now = new Date()): MetricSnapshot {
  const old = new Date(now.getTime() - 180_000);
  const facts: ObservabilityFacts = { nodes: [], links: [], forwards: [], archives: [], checkpoints: [], targets: [] };
  if (workspace !== 5) return projectObservability(workspace, facts, window, now);
  facts.nodes = [1, 2].map((id) => ({ id, node_group: { workspace_id: workspace }, lifecycle: "active", status: "active", last_seen_at: id === 1 ? now : old,
    node_credential_hash: "private-credential-sentinel", credential_revoked: false, credential_rotated_at: null,
    state_report: { reported_at: id === 1 ? now : old, runtime_counts: { total: 0 }, error_count: id === 1 ? 0 : 7, agent_started_at: null,
      tunnels: [{ id: "tunex-40-direct", revision: 3 }], link_placements: [] } }));
  facts.forwards = Array.from({ length: 23 }, (_, index) => ({ id: 40 + index, workspace_id: workspace, link_resource_id: index === 1 ? 10 : null,
    ingress_node_id: 1, middle_node_id: null, egress_node_id: index === 1 ? 2 : null, tunnel_mode: index === 1 ? "relay" : "direct", forward_protocol: "tcp",
    desired_status: "active", apply_status: "pending", config_revision: 3, applied_revision: null }));
  facts.links = [{ id: 10, workspace_id: workspace, carrier: "tst_v1", status: "degraded", generation: 2,
    deployments: [{ generation: 2, status: "degraded", version: 1, placements: [1, 2].map((node_id) => ({ node_id, role: node_id === 1 ? "ingress" : "egress",
      runtime_id: "private-runtime-sentinel", config_digest: "private-digest-sentinel", generation: 2, applied_generation: null })) }] }];
  facts.archives = [40, 999].map((tunnel_id) => ({ tunnel_id, _sum: { traffic: tunnel_id === 40 ? 0 : 1234, traffic_cost: 0 },
    _max: { date: new Date(window.end_date) }, _count: { _all: 1 } }));
  facts.checkpoints = [{ forward_id: 41, link_id: 10, node_id: 1,
    _sum: { bytes_in: 9007199254740993n, bytes_out: 3n, connections: 12n }, _max: { updated_at: now }, _count: { _all: 1 } }];
  facts.targets = [{ forward_id: 40, target_index: 0, node_id: 1, observation: { reachable: true, latency_ms: 0, observed_at: old, reported_at: old, observation_source: "tcp_connect" } },
    { forward_id: 40, target_index: 1, node_id: 1, observation: null }];
  return projectObservability(workspace, facts, window, now);
}
