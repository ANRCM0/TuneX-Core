import { request } from "./core";
import { assertMetricHistory } from "./observability-history-contract";

export interface MetricWindow { start_date: string; end_date: string; timezone: "Asia/Shanghai" }
export interface MetricFreshness {
  state: "current" | "stale" | "unknown" | "historical";
  reason: string; observed_at: string | null; received_at: string | null; age_seconds: number | null;
}
export interface UnifiedMetric {
  value: string | null; unit: "bytes" | "connections" | "runtimes" | "errors" | "milliseconds";
  kind: "gauge" | "cumulative" | "window_total" | "unavailable";
  source: "workspace_archive" | "tst_ingress_checkpoint" | "node_report" | "target_tcp_connect" | "not_collected";
  freshness: MetricFreshness;
}
export interface MetricUsage {
  archive: { bytes: UnifiedMetric; cost_bytes: UnifiedMetric; latest_day: string | null; rows: number; coverage: "recorded_rows_only" };
  tst_ingress: { bytes_in: UnifiedMetric; bytes_out: UnifiedMetric; connections: UnifiedMetric; rows: number; coverage: "recorded_producer_days_only" };
}
export interface MetricForward {
  id: number; link_id: number | null; node_ids: number[]; protocol: string | null;
  desired_status: string | null; deployment_status: string | null; desired_revision: number | null; applied_revision: number | null;
  runtime_coverage: "native_reported_configuration" | "not_projected";
  runtimes: { node_id: number; role: string; state: string; freshness: MetricFreshness }[];
  target_observations: { target_index: number; node_id: number; reachable: boolean | null; freshness: MetricFreshness; latency_ms: UnifiedMetric }[];
  usage: MetricUsage; active_connections: UnifiedMetric; error_count: UnifiedMetric;
}
export interface MetricLink {
  id: number; carrier: string; desired_status: string; generation: number;
  deployment: { generation: number; version: number | null; status?: string } | null;
  placements: { node_id: number; role: string; applied_generation: number | null; state: string; ready: boolean | null; freshness: MetricFreshness }[];
  usage: MetricUsage; active_connections: UnifiedMetric; latency_ms: UnifiedMetric; error_count: UnifiedMetric;
}
export interface MetricNode {
  id: number; lifecycle: string; connection: string; report: MetricFreshness; metrics_scope: "node_process";
  agent_started_at: string | null; runtime_count: UnifiedMetric; error_count: UnifiedMetric;
  usage: MetricUsage; active_connections: UnifiedMetric; latency_ms: UnifiedMetric;
}
export interface MetricSnapshot {
  schema_version: 1; workspace_id: number; generated_at: string; window: MetricWindow;
  workspace: { usage: MetricUsage; archive_scope: "immutable_workspace_ledger";
    resources: { forwards: number; links: number; nodes: number };
    active_connections: UnifiedMetric; latency_ms: UnifiedMetric; error_count: UnifiedMetric };
  forwards: MetricForward[]; links: MetricLink[]; nodes: MetricNode[];
}
export interface MetricCapabilities {
  enabled: boolean; schema_versions: number[]; stage: string;
  features: { workspace_snapshot: boolean; daily_usage_history?: boolean; archived_usage: boolean; tst_ingress_usage: boolean; node_telemetry: boolean;
    target_tcp_observations: boolean; active_connections: boolean; live_throughput: boolean; end_to_end_latency: boolean;
    error_rates: boolean; alerts: boolean; repair: boolean };
  limits: { nodes: number; links: number; forwards: number; usage_groups: number; targets: number; targets_per_forward: number; window_days: number };
}
export interface HistorySelection { scope: "workspace" | "forward" | "link" | "node"; id: number | null }
export interface MetricHistory {
  schema_version: 1; workspace_id: number; selection: HistorySelection; generated_at: string; window: MetricWindow;
  grain: "day"; archive_scope: "immutable_workspace_ledger" | "immutable_forward_ledger" | "not_attributed";
  totals: MetricUsage; days: { date: string; usage: MetricUsage }[];
}

/** Explicit scope is captured once, even if the global workspace changes mid-flight. */
export function observabilityApi(workspaceId: number, signal?: AbortSignal) {
  if (!Number.isSafeInteger(workspaceId) || workspaceId < 1) throw new Error("invalid_metric_scope");
  const options = { workspaceId, signal, cache: "no-store" as const };
  return {
    history: async (window: MetricWindow, selection: HistorySelection = { scope: "workspace", id: null }) => {
      if (selection.scope === "workspace" ? selection.id !== null : !Number.isSafeInteger(selection.id) || selection.id! < 1)
        throw new Error("invalid_metric_scope");
      const result = await request<MetricHistory>("/observability/history", { ...options,
        query: { start_date: window.start_date, end_date: window.end_date, scope: selection.scope,
          ...(selection.id === null ? {} : { id: selection.id }) } });
      assertMetricHistory(result, workspaceId, window, selection);
      return result;
    },
    capabilities: async () => {
      const result = await request<MetricCapabilities>("/observability/capabilities", options);
      if (typeof result?.enabled !== "boolean" || !Array.isArray(result.schema_versions)
        || typeof result.features?.workspace_snapshot !== "boolean" || !Number.isSafeInteger(result.limits?.window_days)
        || result.limits.window_days < 1) throw new Error("invalid_metric_response");
      return result;
    },
    snapshot: async (window: MetricWindow) => {
      const result = await request<MetricSnapshot>("/observability/snapshot", {
        ...options, query: { start_date: window.start_date, end_date: window.end_date },
      });
      // Fail closed on mismatched scope/version/window rather than rendering a foreign response.
      if (result?.schema_version !== 1 || result.workspace_id !== workspaceId || result.window?.timezone !== "Asia/Shanghai"
        || result.window.start_date !== window.start_date || result.window.end_date !== window.end_date
        || !Number.isFinite(Date.parse(result.generated_at)) || !Array.isArray(result.forwards)
        || !Array.isArray(result.links) || !Array.isArray(result.nodes)
        || result.workspace?.resources?.forwards !== result.forwards.length
        || result.workspace.resources.links !== result.links.length || result.workspace.resources.nodes !== result.nodes.length)
        throw new Error("invalid_metric_response");
      return result;
    },
  };
}
