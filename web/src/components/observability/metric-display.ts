import type { MetricFreshness, MetricWindow, UnifiedMetric } from "@/lib/api/observability";

export const metricText = (locale: string, zh: string, en: string) => locale === "en" ? en : zh;
export function shanghaiToday(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}
export function defaultMetricWindow(now = new Date()): MetricWindow {
  const end_date = shanghaiToday(now);
  return { start_date: new Date(Date.parse(`${end_date}T00:00:00Z`) - 6 * 86400_000).toISOString().slice(0, 10), end_date, timezone: "Asia/Shanghai" };
}
export function validMetricWindow(window: MetricWindow, now = new Date(), limit = 31): boolean {
  const validDay = (day: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number(day.slice(0, 4)) < 1000) return false;
    const stamp = Date.parse(`${day}T00:00:00Z`);
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === day;
  };
  if (!validDay(window.start_date) || !validDay(window.end_date)) return false;
  const days = (Date.parse(`${window.end_date}T00:00:00Z`) - Date.parse(`${window.start_date}T00:00:00Z`)) / 86400_000 + 1;
  return days >= 1 && days <= Math.min(31, limit) && window.end_date <= shanghaiToday(now);
}

/** Display the exact decimal string: never coerce BigInt-sized counts to Number. */
export function metricValue(metric: UnifiedMetric, locale: string): string {
  if (metric.value === null) return metricText(locale, "无有效数据", "No valid data");
  const [whole, fraction] = metric.value.split(".");
  const value = /^\d+(\.\d+)?$/.test(metric.value) ? `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction === undefined ? "" : `.${fraction}`}` : metric.value;
  const units = { bytes: "B", connections: metricText(locale, "次", "connections"), runtimes: metricText(locale, "个", "runtimes"), errors: metricText(locale, "次", "errors"), milliseconds: "ms" };
  return `${value} ${units[metric.unit]}`;
}
export function freshnessLabel(fresh: MetricFreshness, locale: string): string {
  const labels = { current: ["快照时有效", "Current at snapshot"], stale: ["已陈旧", "Stale"], unknown: ["未知", "Unknown"], historical: ["历史归档", "Historical archive"] };
  const label = labels[fresh.state];
  return metricText(locale, label?.[0] ?? "未知", label?.[1] ?? "Unknown");
}
export function sourceLabel(source: UnifiedMetric["source"], locale: string): string {
  const labels = { workspace_archive: ["空间归档账本", "Workspace archive"], tst_ingress_checkpoint: ["TST 入口累计回执", "TST ingress checkpoints"], node_report: ["节点进程报告", "Node process report"], target_tcp_connect: ["目标 TCP 建连观测", "Target TCP connect observation"], not_collected: ["尚未采集", "Not collected"] };
  return metricText(locale, ...labels[source] as [string, string]);
}
export function freshnessReason(reason: string, locale: string): string | null {
  const labels: Record<string, [string, string]> = {
    expired: ["样本超过有效时间窗口。", "Sample exceeded the freshness window."],
    credential_revoked: ["节点凭据已失效。", "Node credential is invalid."],
    credential_epoch_changed: ["样本早于当前凭据世代。", "Sample predates the current credential epoch."],
    future_timestamp: ["样本时间在未来，已拒绝视为有效。", "Future sample timestamp cannot establish freshness."],
    missing_timestamp: ["缺少有效样本时间。", "Valid sample timestamp is missing."],
    missing_or_invalid_value: ["缺少有效测量值。", "Valid measurement is missing."],
    no_archive_rows: ["所选日期无归档记录。", "No archive rows in selected dates."],
    archive_not_attributed: ["归档未记录此维度归属。", "Archive does not attribute this dimension."],
    target_observation_unavailable: ["没有当前授权目标的有效观测。", "No valid observation for the currently authorized target."],
    runtime_report_unavailable: ["缺少可匹配的运行配置报告。", "No matching runtime configuration report."],
  };
  return labels[reason] ? metricText(locale, ...labels[reason]) : null;
}
export function metricError(failure: unknown): string {
  if (failure instanceof Error && ["invalid_metric_response", "unsupported_metric_schema"].includes(failure.message)) return failure.message;
  if (failure && typeof failure === "object") {
    const error = failure as { status?: number; data?: { code?: string } };
    const code = error.data?.code;
    if (code && ["observability_disabled", "invalid_metric_window", "invalid_input", "metrics_limit_exceeded", "metrics_scope_invalid", "metrics_resource_not_found", "metrics_history_invalid", "metrics_unavailable", "permission_denied"].includes(code)) return code;
    if (error.status === 401) return "session_expired";
    if (error.status === 403 || error.status === 404) return "permission_denied";
    if (error.status === 429) return "rate_limited";
  }
  return "metrics_unavailable";
}
export function errorLabel(code: string, locale: string): string {
  const labels: Record<string, [string, string]> = {
    observability_disabled: ["平台尚未启用统一监控。", "Unified monitoring is disabled by the platform."],
    invalid_metric_window: ["日期须有效、不得晚于上海今日，且首尾包含最多 31 天。", "Use valid dates through today in Shanghai, at most 31 inclusive days."],
    invalid_input: ["查询参数无效，请重新选择日期。", "Invalid query. Choose the dates again."],
    metrics_limit_exceeded: ["数据超过快照上限；未展示部分结果，请缩短日期范围或联系管理员。", "Snapshot limit exceeded. No partial results are displayed. Shorten the date range or contact an administrator."],
    metrics_scope_invalid: ["部分资源的空间归属暂不可确认，请联系管理员。", "Some resource ownership cannot be confirmed. Contact an administrator."],
    permission_denied: ["需要本空间的转发读取和节点读取权限。", "Forward read and Node read permissions are required in this workspace."],
    session_expired: ["登录已失效，请重新登录。", "Your session expired. Sign in again."],
    rate_limited: ["请求过于频繁，请稍后重试。", "Too many requests. Retry later."],
    invalid_metric_response: ["指标响应与当前空间、日期或版本不一致，已停止展示。", "Metric response does not match this workspace, date range or version. Display stopped."],
    unsupported_metric_schema: ["当前平台指标版本暂不受支持。", "The platform metric version is not supported."],
    metrics_unavailable: ["指标暂不可用，请重试。", "Metrics are unavailable. Retry."],
    metrics_resource_not_found: ["此资源不可用或已删除，请刷新资源列表。", "This resource is unavailable or deleted. Refresh the resource list."],
    metrics_history_invalid: ["历史记录不一致，已停止展示，请联系管理员。", "Historical records are inconsistent. Display stopped. Contact an administrator."],
  };
  return metricText(locale, ...(labels[code] ?? labels.metrics_unavailable));
}
