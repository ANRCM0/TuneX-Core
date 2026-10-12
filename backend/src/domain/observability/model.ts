import { z } from "zod";
import { CONNECTION_ONLINE_WINDOW_MS, deriveConnection } from "../../services/node-lifecycle.ts";
import { LINK_OBSERVATION_FRESH_MS, linkObservation } from "../../services/link-observation.ts";
import { TARGET_HEALTH_THRESHOLDS } from "../../services/target-health-thresholds.ts";

export const OBSERVABILITY_LIMITS = { nodes: 256, links: 512, forwards: 2048, usage_groups: 4096, targets: 4096, targets_per_forward: 32, window_days: 31 } as const;
export class ObservabilityError extends Error {
  constructor(public code: string, public status: 400 | 422 | 503) { super(code); }
}
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const date = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() >= 1000 && date.toISOString().slice(0, 10) === s;
});
const WindowQuery = z.strictObject({ start_date: day.optional(), end_date: day.optional() });
export interface MetricWindow { start_date: string; end_date: string; timezone: "Asia/Shanghai" }
export function metricWindow(raw: unknown = {}, now = new Date()): MetricWindow {
  const input = WindowQuery.parse(raw);
  const today = new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
  const end = input.end_date ?? today;
  const start = input.start_date ?? new Date(Date.parse(`${end}T00:00:00Z`) - 6 * 86400_000).toISOString().slice(0, 10);
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400_000 + 1;
  if (days < 1 || days > OBSERVABILITY_LIMITS.window_days || end > today) throw new ObservabilityError("invalid_metric_window", 400);
  return { start_date: start, end_date: end, timezone: "Asia/Shanghai" };
}

export interface Freshness {
  state: "current" | "stale" | "unknown" | "historical";
  reason: string;
  observed_at: string | null;
  received_at: string | null;
  age_seconds: number | null;
}
export interface Metric {
  /** Decimal strings preserve BigInt precision. Null is never an invented zero. */
  value: string | null;
  unit: "bytes" | "connections" | "runtimes" | "errors" | "milliseconds";
  kind: "gauge" | "cumulative" | "window_total" | "unavailable";
  source: "workspace_archive" | "tst_ingress_checkpoint" | "node_report" | "target_tcp_connect" | "not_collected";
  freshness: Freshness;
}
const emptyFreshness = (reason: string): Freshness => ({ state: "unknown", reason, observed_at: null, received_at: null, age_seconds: null });
export const unavailableMetric = (unit: Metric["unit"], reason = "not_collected"): Metric =>
  ({ value: null, unit, kind: "unavailable", source: "not_collected", freshness: emptyFreshness(reason) });

/** Future timestamps and previous credential epochs cannot establish a current observation. */
export function metricFreshness(received: Date | null, observed: Date | null, now: Date, ttl: number,
  rotated: Date | null = null, revoked = false): Freshness {
  if (!received || !Number.isFinite(received.getTime()) || observed && !Number.isFinite(observed.getTime())) return emptyFreshness("missing_timestamp");
  const stamp = observed ?? received;
  const age = now.getTime() - stamp.getTime();
  const reason = revoked ? "credential_revoked" : rotated && received <= rotated ? "credential_epoch_changed"
    : received > now || stamp > now ? "future_timestamp" : age > ttl || now.getTime() - received.getTime() > ttl ? "expired" : "within_window";
  return { state: reason === "within_window" ? "current" : "stale", reason,
    observed_at: observed?.toISOString() ?? null, received_at: received.toISOString(), age_seconds: age < 0 ? null : Math.floor(age / 1000) };
}
export interface ReportFact {
  reported_at: Date; runtime_counts: unknown; error_count: number | null;
  agent_started_at?: Date | null;
  tunnels: unknown; link_placements: unknown;
}
export interface NodeFact {
  id: number; node_group: { workspace_id: number }; lifecycle: string; status: string;
  last_seen_at: Date | null; node_credential_hash: string | null; credential_revoked: boolean;
  credential_rotated_at: Date | null; state_report: ReportFact | null;
}
export interface ForwardFact {
  id: number; workspace_id: number | null; link_resource_id: number | null;
  ingress_node_id: number | null; middle_node_id: number | null; egress_node_id: number | null;
  tunnel_mode: string | null; forward_protocol: string | null;
  desired_status: string | null; apply_status: string | null; config_revision: number | null; applied_revision: number | null;
}
export interface PlacementFact {
  node_id: number; role: string; runtime_id: string; generation: number; config_digest: string;
  applied_generation?: number | null;
}
export interface LinkFact {
  id: number; workspace_id: number; carrier: string; status: string; generation: number;
  deployments: { generation: number; status?: string; version?: number; placements: PlacementFact[] }[];
}
export interface ArchiveFact {
  tunnel_id: number; _sum: { traffic: number | null; traffic_cost: number | null }; _max: { date: Date | null }; _count: { _all: number };
}
export interface CheckpointFact {
  forward_id: number; link_id: number; node_id: number;
  _sum: { bytes_in: bigint | null; bytes_out: bigint | null; connections: bigint | null };
  _max: { updated_at: Date | null }; _count: { _all: number };
}
export interface TargetFact {
  forward_id: number; target_index: number; node_id: number;
  observation: { reachable: boolean; latency_ms: number | null; observed_at: Date; reported_at: Date; observation_source: string } | null;
}
export interface ObservabilityFacts {
  nodes: NodeFact[]; links: LinkFact[]; forwards: ForwardFact[]; archives: ArchiveFact[]; checkpoints: CheckpointFact[]; targets: TargetFact[];
}
function numberMetric(value: unknown, unit: Metric["unit"], kind: Metric["kind"], source: Metric["source"], freshness: Freshness): Metric {
  const valid = typeof value === "bigint" ? value >= 0n : typeof value === "number" && Number.isFinite(value) && value >= 0;
  return { value: valid ? String(value) : null, unit, kind, source,
    freshness: valid ? freshness : { ...freshness, state: freshness.state === "stale" ? "stale" : "unknown",
      reason: freshness.state === "stale" ? freshness.reason : "missing_or_invalid_value" } };
}
function usage(archives: ArchiveFact[], checkpoints: CheckpointFact[], now: Date) {
  const lastDay = archives.reduce<Date | null>((max, r) => r._max.date && (!max || r._max.date > max) ? r._max.date : max, null);
  const receipt = checkpoints.reduce<Date | null>((max, r) => r._max.updated_at && (!max || r._max.updated_at > max) ? r._max.updated_at : max, null);
  const archiveFresh: Freshness = { ...emptyFreshness("archived_accounting_not_live"), state: "historical" };
  const archived = (field: "traffic" | "traffic_cost") => archives.length && archives.every((r) => r._sum[field] !== null && Number.isFinite(r._sum[field]) && r._sum[field]! >= 0)
    ? numberMetric(archives.reduce((sum, r) => sum + r._sum[field]!, 0), "bytes", "window_total", "workspace_archive", archiveFresh)
    : { ...unavailableMetric("bytes", "no_archive_rows"), source: "workspace_archive" as const, kind: "window_total" as const };
  // Freshness describes the latest Panel receipt ONLY, not sampling coverage or an active connection gauge.
  const checkpointFresh = metricFreshness(receipt, null, now, LINK_OBSERVATION_FRESH_MS);
  const measured = (field: "bytes_in" | "bytes_out" | "connections") => numberMetric(checkpoints.length && checkpoints.every((r) => r._sum[field] !== null && r._sum[field]! >= 0n)
    ? checkpoints.reduce((sum, r) => sum + r._sum[field]!, 0n) : null,
    field === "connections" ? "connections" : "bytes", "window_total", "tst_ingress_checkpoint", checkpointFresh);
  return { archive: { bytes: archived("traffic"), cost_bytes: archived("traffic_cost"), latest_day: lastDay?.toISOString().slice(0, 10) ?? null,
    rows: archives.reduce((sum, r) => sum + r._count._all, 0), coverage: "recorded_rows_only" as const },
    tst_ingress: { bytes_in: measured("bytes_in"), bytes_out: measured("bytes_out"), connections: measured("connections"),
      rows: checkpoints.reduce((sum, r) => sum + r._count._all, 0), coverage: "recorded_producer_days_only" as const } };
}
function reportFreshness(node: NodeFact, now: Date, ttl = CONNECTION_ONLINE_WINDOW_MS) {
  return metricFreshness(node.state_report?.reported_at ?? null, null, now, ttl, node.credential_rotated_at,
    node.credential_revoked || !node.node_credential_hash);
}
function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function runtimeObservation(node: NodeFact, id: string, revision: number | null, now: Date) {
  const freshness = reportFreshness(node, now);
  if (freshness.state !== "current") return { state: freshness.state, freshness };
  const tunnels = node.state_report?.tunnels;
  if (!Array.isArray(tunnels) || !revision) return { state: "unknown", freshness: emptyFreshness("runtime_report_unavailable") };
  const found = tunnels.map(object).filter((r) => r?.id === id);
  return { state: found.length > 1 ? "unknown" : found.length === 0 ? "absent" : found[0]!.revision === revision ? "reported" : "mismatch", freshness };
}

/** Closed tenant DTO: no raw report/config, addresses, runtime identifiers or error text. */
export function projectObservability(workspace: number, facts: ObservabilityFacts, window: MetricWindow, now = new Date()) {
  for (const key of ["nodes", "links", "forwards"] as const)
    if (facts[key].length > OBSERVABILITY_LIMITS[key]) throw new ObservabilityError("metrics_limit_exceeded", 422);
  if (facts.archives.length > OBSERVABILITY_LIMITS.usage_groups || facts.checkpoints.length > OBSERVABILITY_LIMITS.usage_groups || facts.targets.length > OBSERVABILITY_LIMITS.targets)
    throw new ObservabilityError("metrics_limit_exceeded", 422);
  if (facts.nodes.some((r) => r.node_group.workspace_id !== workspace) || facts.links.some((r) => r.workspace_id !== workspace)
    || facts.forwards.some((r) => r.workspace_id !== workspace)) throw new ObservabilityError("metrics_scope_invalid", 503);
  const nodeMap = new Map(facts.nodes.map((r) => [r.id, r]));
  const linkMap = new Map(facts.links.map((r) => [r.id, r]));
  const nodes = facts.nodes.map((node) => {
    const freshness = reportFreshness(node, now);
    const counts = object(node.state_report?.runtime_counts);
    return { id: node.id, lifecycle: node.lifecycle,
      connection: node.last_seen_at && node.last_seen_at > now ? "offline" : deriveConnection({ ...node, has_credential: !!node.node_credential_hash, now }),
      report: freshness, metrics_scope: "node_process" as const,
      agent_started_at: node.state_report?.agent_started_at?.toISOString() ?? null,
      runtime_count: numberMetric(counts?.total, "runtimes", "gauge", "node_report", freshness),
      error_count: numberMetric(node.state_report?.error_count, "errors", "cumulative", "node_report", freshness),
      // No source attributes native hop bytes to a Node. Only historical TST ingress receipts have that identity.
      usage: usage([], facts.checkpoints.filter((r) => r.node_id === node.id), now),
      active_connections: unavailableMetric("connections"), latency_ms: unavailableMetric("milliseconds") };
  }).sort((a, b) => a.id - b.id);
  const links = facts.links.map((link) => {
    const deployment = link.deployments.find((d) => d.generation === link.generation);
    const placements = (deployment?.placements ?? []).map((placement) => {
      const node = nodeMap.get(placement.node_id);
      if (!node) throw new ObservabilityError("metrics_scope_invalid", 503);
      const freshness = reportFreshness(node, now, LINK_OBSERVATION_FRESH_MS);
      const observation = freshness.state === "current" && link.carrier === "tst_v1"
        ? linkObservation({ ...placement, generation: link.generation }, workspace, link.id, node.state_report, now) : null;
      return { node_id: node.id, role: placement.role === "ingress" || placement.role === "egress" ? placement.role : "unknown",
        applied_generation: placement.applied_generation ?? null,
        state: observation?.state ?? (freshness.state === "current" ? "unknown" : freshness.state), ready: observation?.ready ?? null, freshness };
    });
    if (placements.length > 2) throw new ObservabilityError("metrics_limit_exceeded", 422);
    return { id: link.id, carrier: link.carrier === "tst_v1" ? "tst_v1" : "unsupported",
      desired_status: ["draft", "pending", "active", "suspended", "error", "retired"].includes(link.status) ? link.status : "unknown", generation: link.generation,
      deployment: deployment ? { generation: deployment.generation, version: deployment.version ?? null,
        status: ["pending", "applying", "active", "suspended", "error", "retired"].includes(deployment.status ?? "") ? deployment.status : "unknown" } : null,
      placements, usage: usage([], facts.checkpoints.filter((r) => r.link_id === link.id), now),
      active_connections: unavailableMetric("connections"), latency_ms: unavailableMetric("milliseconds"), error_count: unavailableMetric("errors") };
  }).sort((a, b) => a.id - b.id);
  const forwards = facts.forwards.map((forward) => {
    if (forward.link_resource_id !== null && !linkMap.has(forward.link_resource_id)) throw new ObservabilityError("metrics_scope_invalid", 503);
    const endpoints = [forward.ingress_node_id, forward.middle_node_id, forward.egress_node_id].filter((id): id is number => id !== null);
    if (endpoints.some((id) => !nodeMap.has(id))) throw new ObservabilityError("metrics_scope_invalid", 503);
    // Native presence means a matching reported configuration, never listener/target health.
    const native = forward.link_resource_id === null && forward.forward_protocol !== "both" &&
      (forward.tunnel_mode === "direct" || forward.tunnel_mode === "relay") && !forward.middle_node_id;
    const runtimes = native ? endpoints.map((id, index) => ({ node_id: id, role: index === 0 ? "ingress" : "egress",
      ...runtimeObservation(nodeMap.get(id)!, `tunex-${forward.id}-${forward.tunnel_mode === "direct" ? "direct" : index === 0 ? "relay" : "egress"}`, forward.config_revision, now) })) : [];
    const targets = facts.targets.filter((t) => t.forward_id === forward.id).map((target) => {
      const node = nodeMap.get(target.node_id);
      if (!node) throw new ObservabilityError("metrics_scope_invalid", 503);
      const observation = target.observation;
      const sourceValid = observation?.observation_source === "tcp_connect" || observation?.observation_source.endsWith("/tcp_connect");
      const freshness = observation && sourceValid ? metricFreshness(observation.reported_at, observation.observed_at, now,
        TARGET_HEALTH_THRESHOLDS.STALE_AFTER_MS, node.credential_rotated_at, node.credential_revoked || !node.node_credential_hash) : emptyFreshness("target_observation_unavailable");
      return { target_index: target.target_index, node_id: target.node_id, freshness,
        reachable: sourceValid ? observation?.reachable ?? null : null,
        latency_ms: numberMetric(sourceValid && observation?.reachable ? observation.latency_ms : null, "milliseconds", "gauge", "target_tcp_connect", freshness) };
    });
    return { id: forward.id, link_id: forward.link_resource_id, node_ids: endpoints,
      protocol: ["tcp", "udp", "both", "tls", "ws"].includes(forward.forward_protocol ?? "") ? forward.forward_protocol : "unsupported",
      desired_status: ["active", "inactive"].includes(forward.desired_status ?? "") ? forward.desired_status : "unknown",
      deployment_status: ["pending", "applying", "active", "suspended", "error"].includes(forward.apply_status ?? "") ? forward.apply_status : "unknown",
      desired_revision: forward.config_revision, applied_revision: forward.applied_revision,
      runtime_coverage: native ? "native_reported_configuration" : "not_projected", runtimes, target_observations: targets, usage: usage(facts.archives.filter((r) => r.tunnel_id === forward.id),
        facts.checkpoints.filter((r) => r.forward_id === forward.id), now),
      active_connections: unavailableMetric("connections"), error_count: unavailableMetric("errors") };
  }).sort((a, b) => a.id - b.id);
  return { schema_version: 1 as const, workspace_id: workspace, generated_at: now.toISOString(), window,
    workspace: { usage: usage(facts.archives, facts.checkpoints, now), archive_scope: "immutable_workspace_ledger" as const,
      resources: { forwards: forwards.length, links: links.length, nodes: nodes.length },
      active_connections: unavailableMetric("connections"), latency_ms: unavailableMetric("milliseconds"), error_count: unavailableMetric("errors") },
    forwards, links, nodes };
}
export type ObservabilitySnapshot = ReturnType<typeof projectObservability>;
