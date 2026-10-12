import type { HistorySelection, MetricHistory, MetricUsage, MetricWindow, UnifiedMetric } from "./observability";

export function validHistoryDecimal(value: unknown): value is string {
  return typeof value === "string" && value.length <= 256 && /^\d+(?:\.\d+)?(?:e[+-]?\d{1,3})?$/i.test(value)
    && (!/[eE]/.test(value) || Math.abs(Number(value.split(/[eE]/)[1])) <= 308);
}
const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const rows = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function metric(m: UnifiedMetric, source: UnifiedMetric["source"], unit: UnifiedMetric["unit"]) {
  return m && m.source === source && m.unit === unit && m.kind === "window_total"
    && (m.value === null || validHistoryDecimal(m.value) && (unit !== "connections" || /^\d+$/.test(m.value)))
    && m.freshness && ["current", "stale", "unknown", "historical"].includes(m.freshness.state)
    && typeof m.freshness.reason === "string" && m.freshness.reason.length <= 128
    && (m.freshness.received_at === null || timestamp(m.freshness.received_at))
    && (m.freshness.observed_at === null || timestamp(m.freshness.observed_at))
    && (m.freshness.age_seconds === null || rows(m.freshness.age_seconds));
}
function usage(u: MetricUsage) {
  return u?.archive && u.tst_ingress && rows(u.archive.rows) && rows(u.tst_ingress.rows)
    && u.archive.coverage === "recorded_rows_only" && u.tst_ingress.coverage === "recorded_producer_days_only"
    && (u.archive.latest_day === null || /^\d{4}-\d{2}-\d{2}$/.test(u.archive.latest_day))
    && metric(u.archive.bytes, "workspace_archive", "bytes") && metric(u.archive.cost_bytes, "workspace_archive", "bytes")
    && metric(u.tst_ingress.bytes_in, "tst_ingress_checkpoint", "bytes") && metric(u.tst_ingress.bytes_out, "tst_ingress_checkpoint", "bytes")
    && metric(u.tst_ingress.connections, "tst_ingress_checkpoint", "connections");
}
/** Reject foreign, partial or malformed daily series before rendering any chart. */
export function assertMetricHistory(result: MetricHistory, workspace: number, window: MetricWindow, selection: HistorySelection) {
  const start = Date.parse(`${window.start_date}T00:00:00Z`), end = Date.parse(`${window.end_date}T00:00:00Z`);
  const count = (end - start) / 86400_000 + 1;
  const scope = selection.scope === "workspace" ? "immutable_workspace_ledger" : selection.scope === "forward" ? "immutable_forward_ledger" : "not_attributed";
  if (!result || result.schema_version !== 1 || result.workspace_id !== workspace || result.grain !== "day"
    || result.selection?.scope !== selection.scope || result.selection.id !== selection.id || result.archive_scope !== scope
    || result.window?.timezone !== "Asia/Shanghai" || result.window.start_date !== window.start_date || result.window.end_date !== window.end_date
    || !timestamp(result.generated_at) || !Number.isInteger(count) || count < 1 || count > 31
    || !Array.isArray(result.days) || result.days.length !== count || !usage(result.totals)
    || result.days.some((d, i) => !d || d.date !== new Date(start + i * 86400_000).toISOString().slice(0, 10) || !usage(d.usage)
      || d.usage.archive.rows === 0 && (d.usage.archive.bytes.value !== null || d.usage.archive.cost_bytes.value !== null)
      || d.usage.tst_ingress.rows === 0 && (d.usage.tst_ingress.bytes_in.value !== null || d.usage.tst_ingress.bytes_out.value !== null || d.usage.tst_ingress.connections.value !== null)
      || scope === "not_attributed" && (d.usage.archive.rows !== 0 || d.usage.archive.bytes.value !== null || d.usage.archive.cost_bytes.value !== null))
    || result.totals.archive.rows !== result.days.reduce((sum, d) => sum + d.usage.archive.rows, 0)
    || result.totals.tst_ingress.rows !== result.days.reduce((sum, d) => sum + d.usage.tst_ingress.rows, 0))
    throw new Error("invalid_metric_response");
}
