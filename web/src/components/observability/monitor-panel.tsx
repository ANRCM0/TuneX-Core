"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { observabilityApi, type MetricCapabilities, type MetricSnapshot, type MetricWindow } from "@/lib/api/observability";
import { defaultMetricWindow, errorLabel, metricError, metricText, shanghaiToday, validMetricWindow } from "./metric-display";
import { SnapshotView } from "./snapshot-view";

type Result = { key: string; state: "loading" | "disabled" | "error" | "ready"; error?: string; snapshot?: MetricSnapshot; caps?: MetricCapabilities };
export function MonitorPanel({ workspaceId, canRead, locale }: { workspaceId: number; canRead: boolean; locale: string }) {
  const [draft, setDraft] = useState(defaultMetricWindow), [window, setWindow] = useState(draft), [generation, setGeneration] = useState(0);
  const [result, setResult] = useState<Result | null>(null), [dateError, setDateError] = useState(false);
  const t = (zh: string, en: string) => metricText(locale, zh, en);
  const key = `${workspaceId}:${canRead}:${window.start_date}:${window.end_date}:${generation}`;
  // Mask old results during render, before effect cleanup, including permission revocation.
  const visible = canRead && result?.key === key ? result : null;
  useEffect(() => {
    // A later permission grant must discover and read anew, never reuse the revoked result.
    if (!canRead) { setResult(null); return; }
    const controller = new AbortController(), api = observabilityApi(workspaceId, controller.signal);
    setResult({ key, state: "loading" });
    void (async () => {
      const caps = await api.capabilities();
      if (controller.signal.aborted) return;
      if (caps.enabled !== true || caps.features?.workspace_snapshot !== true) { setResult({ key, state: "disabled", caps }); return; }
      if (!caps.schema_versions?.includes(1)) throw new Error("unsupported_metric_schema");
      const snapshot = await api.snapshot(window);
      if (!controller.signal.aborted) setResult({ key, state: "ready", caps, snapshot });
    })().catch((failure) => { if (!controller.signal.aborted) setResult({ key, state: "error", error: metricError(failure) }); });
    return () => controller.abort();
  }, [key, workspaceId, canRead, window]);

  function reload() {
    if (!validMetricWindow(draft, new Date(), visible?.caps?.limits.window_days ?? 31)) { setDateError(true); return; }
    setDateError(false); setWindow({ ...draft }); setGeneration((value) => value + 1);
  }
  if (!canRead) return <p role="status">{errorLabel("permission_denied", locale)}</p>;
  const busy = !visible || visible.state === "loading";
  return <section className="space-y-5" data-testid="monitor-panel" aria-busy={busy}>
    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); reload(); }}>
      <label className="block min-w-0 space-y-1 text-sm"><span>{t("起始日期（上海）", "Start date (Shanghai)")}</span><Input type="date" min="1000-01-01" max={shanghaiToday()} required value={draft.start_date} onChange={(event) => { setDraft({ ...draft, start_date: event.target.value }); setDateError(false); }} /></label>
      <label className="block min-w-0 space-y-1 text-sm"><span>{t("结束日期（上海）", "End date (Shanghai)")}</span><Input type="date" min="1000-01-01" max={shanghaiToday()} required value={draft.end_date} onChange={(event) => { setDraft({ ...draft, end_date: event.target.value }); setDateError(false); }} /></label>
      <Button type="submit" size="sm" disabled={busy}>{t("查询 / 刷新", "Query / refresh")}</Button>
    </form>
    <p className="text-xs text-[var(--muted-foreground)]">{t("最多 31 天，首尾包含。查询仅读取已有记录，不发起探测。", "At most 31 inclusive days. Queries read existing records without starting probes.")}</p>
    {dateError ? <p role="alert">{errorLabel("invalid_metric_window", locale)}</p> : null}
    {busy ? <p role="status">{t("正在读取当前空间指标…", "Loading metrics for this workspace…")}</p> : null}
    {visible?.state === "error" ? <p role="alert">{errorLabel(visible.error ?? "metrics_unavailable", locale)}</p> : null}
    {visible?.state === "disabled" ? <p role="status">{errorLabel("observability_disabled", locale)}</p> : null}
    {visible?.snapshot ? <>
      <p className="text-sm">{t("当前快照日期：", "Snapshot dates: ")}{visible.snapshot.window.start_date} → {visible.snapshot.window.end_date} (Asia/Shanghai)</p>
      <SnapshotView key={key} snapshot={visible.snapshot} locale={locale} historyEnabled={visible.caps?.features.daily_usage_history === true} />
    </> : null}
  </section>;
}
