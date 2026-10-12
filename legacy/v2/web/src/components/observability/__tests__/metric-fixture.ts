import { projectObservability, type ObservabilityFacts } from "../../../../../backend/src/domain/observability/model";
import type { MetricCapabilities, MetricSnapshot, MetricWindow } from "@/lib/api/observability";
import { projectHistory, type HistorySelection } from "../../../../../backend/src/domain/observability/history";

export const metricCapabilities: MetricCapabilities = { enabled: true, schema_versions: [1], stage: "experimental",
  features: { workspace_snapshot: true, daily_usage_history: true, archived_usage: true, tst_ingress_usage: true, node_telemetry: true, target_tcp_observations: true,
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
    _max: { date: new Date(window.end_date) }, _count: { _all: tunnel_id === 40 && window.start_date !== window.end_date ? 2 : 1 } }));
  facts.checkpoints = [{ forward_id: 41, link_id: 10, node_id: 1,
    _sum: { bytes_in: 9007199254740993n, bytes_out: 3n, connections: 12n }, _max: { updated_at: now }, _count: { _all: window.start_date !== window.end_date ? 2 : 1 } }];
  facts.targets = [{ forward_id: 40, target_index: 0, node_id: 1, observation: { reachable: true, latency_ms: 0, observed_at: old, reported_at: old, observation_source: "tcp_connect" } },
    { forward_id: 40, target_index: 1, node_id: 1, observation: null }];
  return projectObservability(workspace, facts, window, now);
}

export function historyFixture(workspace: number, window: MetricWindow, selection: HistorySelection = { scope: "workspace", id: null }, now = new Date()) {
  const archived = workspace === 5 && (selection.scope === "workspace" || selection.scope === "forward" && selection.id === 40);
  const measured = workspace === 5 && (selection.scope === "workspace" || selection.scope === "forward" && selection.id === 41
    || selection.scope === "link" && selection.id === 10 || selection.scope === "node" && selection.id === 1);
  const archives = archived ? [{ date: new Date(window.end_date), _sum: { traffic: selection.scope === "workspace" ? 1234 : 0, traffic_cost: 0 }, _count: { _all: selection.scope === "workspace" ? 2 : 1 } }] : [];
  const checkpoints = measured ? [{ date: new Date(window.end_date), _sum: { bytes_in: 9007199254740993n, bytes_out: 3n, connections: 12n }, _max: { updated_at: now }, _count: { _all: 1 } }] : [];
  if (window.start_date !== window.end_date) {
    if (archived) archives.unshift({ date: new Date(window.start_date), _sum: { traffic: 0, traffic_cost: 0 }, _count: { _all: 1 } });
    if (measured) checkpoints.unshift({ date: new Date(window.start_date), _sum: { bytes_in: 0n, bytes_out: 0n, connections: 0n }, _max: { updated_at: new Date(now.getTime() - 180_000) }, _count: { _all: 1 } });
  }
  return projectHistory(workspace, { ...selection }, window, archives, checkpoints, now);
}
