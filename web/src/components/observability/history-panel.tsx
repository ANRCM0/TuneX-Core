"use client";

import { useEffect, useState } from "react";
import { observabilityApi, type HistorySelection, type MetricHistory, type MetricWindow, type UnifiedMetric } from "@/lib/api/observability";
import { errorLabel, freshnessLabel, freshnessReason, metricError, metricText, metricValue } from "./metric-display";
import { historyHeights } from "./history-scale";

const choices = [
  ["archive_bytes", "归档流量", "Archived traffic"], ["archive_cost", "归档计费流量", "Archived billable traffic"],
  ["tst_in", "TST 入口接收字节", "TST ingress bytes received"], ["tst_out", "TST 入口发送字节", "TST ingress bytes sent"],
  ["tst_connections", "TST 累计连接次数", "TST cumulative connections"],
] as const;
type Choice = typeof choices[number][0];
const read = (usage: MetricHistory["totals"], choice: Choice): UnifiedMetric => choice === "archive_bytes" ? usage.archive.bytes
  : choice === "archive_cost" ? usage.archive.cost_bytes : choice === "tst_in" ? usage.tst_ingress.bytes_in
    : choice === "tst_out" ? usage.tst_ingress.bytes_out : usage.tst_ingress.connections;

export function HistoryChart({ history, locale }: { history: MetricHistory; locale: string }) {
  const [choice, setChoice] = useState<Choice>(() => history.archive_scope === "not_attributed" ? "tst_in" : "archive_bytes");
  const t = (zh: string, en: string) => metricText(locale, zh, en);
  const metrics = history.days.map((d) => read(d.usage, choice)), heights = historyHeights(metrics.map((m) => m.value));
  const title = choices.find((c) => c[0] === choice)!;
  const step = 600 / history.days.length;
  return <section className="space-y-3 rounded-md border border-[var(--border)] p-4" data-testid="metric-history">
    <h3 className="font-medium">{t("按日历史用量", "Daily usage history")} · {history.selection.scope} {history.selection.id === null ? "" : `#${history.selection.id}`}</h3>
    <label className="block space-y-1 text-sm"><span>{t("历史指标", "History metric")}</span>
      <select className="block w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--background)] p-2" value={choice} onChange={(e) => setChoice(e.target.value as Choice)}>
        {choices.map(([id, zh, en]) => <option key={id} value={id}>{t(zh, en)}</option>)}
      </select>
    </label>
    <p className="text-sm text-[var(--muted-foreground)]">{history.window.start_date} → {history.window.end_date} · Asia/Shanghai · {t("每日累计，柱高相对本指标最大值；精确值见表格。虚线表示缺失，圆点表示实测零。", "Daily totals. Bar heights are relative to this metric's maximum; see exact values below. Dashed marks mean missing data; dots mean measured zero.")}</p>
    <svg viewBox="0 0 620 168" className="w-full" role="img" aria-label={t(title[1], title[2])} data-testid="history-chart">
      <line x1="10" x2="610" y1="146" y2="146" stroke="currentColor" opacity="0.3" />
      {history.days.map((d, i) => {
        const x = 10 + i * step + step * .15, width = step * .7, height = heights[i];
        const display = height === null ? 0 : metrics[i].value !== "0" && height < 1 ? 1 : height;
        return <g key={d.date} data-history-date={d.date} data-history-value={metrics[i].value ?? "missing"}>
          <title>{`${d.date}: ${metricValue(metrics[i], locale)} · ${freshnessLabel(metrics[i].freshness, locale)}`}</title>
          {height === null ? <line x1={x} x2={x + width} y1="138" y2="138" stroke="currentColor" strokeDasharray="2 3" />
            : metrics[i].value !== null && /^0(?:\.0+)?(?:e[+-]?\d+)?$/i.test(metrics[i].value!) ? <circle cx={x + width / 2} cy="146" r="2" fill="currentColor" />
              : <rect x={x} y={146 - display * 1.25} width={width} height={display * 1.25} rx="2" fill="var(--primary)" opacity={metrics[i].freshness.state === "stale" ? .5 : .9} />}
        </g>;
      })}
      <text x="10" y="163" fontSize="10" fill="currentColor">{history.window.start_date}</text>
      <text x="610" y="163" textAnchor="end" fontSize="10" fill="currentColor">{history.window.end_date}</text>
    </svg>
    <p className="text-sm text-[var(--muted-foreground)]">{t("仅展示已有记录，两种来源不相加；缺失日期不补零、不插值。累计连接不是活跃连接，最新回执不保证完整覆盖。新鲜度以本次历史查询生成时间为准。", "Recorded rows only. Sources are never added; missing days are not filled or interpolated. Cumulative connections are not active connections. Latest receipt does not establish full coverage. Freshness refers to this history query's generation time.")}</p>
    {history.archive_scope === "not_attributed" ? <p className="text-sm">{t("归档账本未记录 Link / Node 归属，该来源不可用。", "The archive ledger does not attribute usage to Link / Node. This source is unavailable.")}</p> : null}
    <p className="text-xs">{t("生成时间：", "Generated: ")}{history.generated_at}</p>
    <div className="max-h-80 overflow-auto" tabIndex={0} aria-label={t("每日精确值表格", "Exact daily values table")}>
      <table className="w-full text-left text-sm"><caption className="sr-only">{t(title[1], title[2])} · Asia/Shanghai</caption>
        <thead><tr><th className="p-2">{t("日期", "Date")}</th><th className="p-2">{t("精确累计值", "Exact total")}</th><th className="p-2">{t("记录 / 新鲜度", "Rows / freshness")}</th></tr></thead>
        <tbody>{history.days.map((day, i) => <tr key={day.date} className="border-t border-[var(--border)]"><th scope="row" className="whitespace-nowrap p-2 font-normal">{day.date}</th>
          <td className="break-all p-2 tabular-nums">{metricValue(metrics[i], locale)}</td>
          <td className="p-2">{choice.startsWith("archive") ? day.usage.archive.rows : day.usage.tst_ingress.rows} · {freshnessLabel(metrics[i].freshness, locale)}
            <p className="text-xs text-[var(--muted-foreground)]">{freshnessReason(metrics[i].freshness.reason, locale)}</p>
            {metrics[i].freshness.received_at ? <time className="block text-xs" dateTime={metrics[i].freshness.received_at!}>{metrics[i].freshness.received_at}</time> : null}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

export function HistoryPanel({ workspaceId, window, scope = "workspace", resourceId = null, locale }: {
  workspaceId: number; window: MetricWindow; scope?: HistorySelection["scope"]; resourceId?: number | null; locale: string;
}) {
  const key = `${workspaceId}:${scope}:${resourceId}:${window.start_date}:${window.end_date}`;
  const [result, setResult] = useState<{ key: string; history?: MetricHistory; error?: string } | null>(null);
  const visible = result?.key === key ? result : null;
  useEffect(() => {
    const controller = new AbortController();
    void observabilityApi(workspaceId, controller.signal).history(window, { scope, id: resourceId }).then((history) => {
      if (!controller.signal.aborted) setResult({ key, history });
    }).catch((error) => { if (!controller.signal.aborted) setResult({ key, error: metricError(error) }); });
    return () => controller.abort();
  }, [key, workspaceId, scope, resourceId, window]);
  if (visible?.error) return <p role="alert" data-testid="history-error">{errorLabel(visible.error, locale)}</p>;
  return visible?.history ? <HistoryChart history={visible.history} locale={locale} />
    : <p role="status">{metricText(locale, "正在读取按日历史…", "Loading daily history…")}</p>;
}
