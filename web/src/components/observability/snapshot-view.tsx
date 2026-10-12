"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { MetricForward, MetricFreshness, MetricLink, MetricNode, MetricSnapshot, MetricUsage, UnifiedMetric } from "@/lib/api/observability";
import { freshnessLabel, freshnessReason, metricText, metricValue, sourceLabel } from "./metric-display";

const muted = "text-sm text-[var(--muted-foreground)]";
export function MetricTime({ value, locale }: { value: string | null; locale: string }) {
  if (!value) return <span>{metricText(locale, "未知", "Unknown")}</span>;
  return <time dateTime={value}>{new Date(value).toLocaleString(locale === "en" ? "en-GB" : "zh-CN", { timeZone: "Asia/Shanghai", hour12: false })} (UTC+8)</time>;
}
export function Freshness({ value, locale }: { value: MetricFreshness; locale: string }) {
  const t = (zh: string, en: string) => metricText(locale, zh, en);
  const reason = freshnessReason(value.reason, locale);
  return <div className="space-y-1 text-xs">
    <Badge variant={value.state === "stale" ? "destructive" : "outline"}>{freshnessLabel(value, locale)}</Badge>
    {reason ? <p>{reason}</p> : null}
    {value.received_at ? <p>{t("面板接收：", "Panel receipt: ")}<MetricTime value={value.received_at} locale={locale} /></p> : null}
    {value.observed_at ? <p>{t("节点观测：", "Node observation: ")}<MetricTime value={value.observed_at} locale={locale} /></p> : null}
    {value.age_seconds !== null ? <p>{t("快照时样本年龄：", "Sample age at snapshot: ")}{value.age_seconds}s</p> : null}
  </div>;
}
export function MetricCard({ title, metric, locale }: { title: string; metric: UnifiedMetric; locale: string }) {
  const kinds = { gauge: ["采样值", "Sampled gauge"], cumulative: ["进程累计", "Process cumulative"], window_total: ["所选日期累计", "Selected date total"], unavailable: ["尚未采集", "Not collected"] };
  return <Card className="space-y-2 p-4" data-metric-source={metric.source}>
    <h4 className="text-sm font-medium">{title}</h4>
    <p className="break-all text-lg font-semibold tabular-nums" data-testid="metric-value">{metricValue(metric, locale)}</p>
    <p className="text-xs text-[var(--muted-foreground)]">{sourceLabel(metric.source, locale)} · {metricText(locale, ...kinds[metric.kind] as [string, string])}</p>
    <Freshness value={metric.freshness} locale={locale} />
  </Card>;
}
export function UsageView({ usage, locale }: { usage: MetricUsage; locale: string }) {
  const t = (zh: string, en: string) => metricText(locale, zh, en);
  return <section className="space-y-3">
    <h3 className="font-medium">{t("所选日期的记录用量", "Recorded usage in selected dates")}</h3>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard title={t("归档流量", "Archived traffic")} metric={usage.archive.bytes} locale={locale} />
      <MetricCard title={t("归档计费流量", "Archived billable traffic")} metric={usage.archive.cost_bytes} locale={locale} />
      <MetricCard title={t("TST 入口接收字节", "TST ingress bytes received")} metric={usage.tst_ingress.bytes_in} locale={locale} />
      <MetricCard title={t("TST 入口发送字节", "TST ingress bytes sent")} metric={usage.tst_ingress.bytes_out} locale={locale} />
      <MetricCard title={t("TST 累计连接次数", "TST cumulative connections")} metric={usage.tst_ingress.connections} locale={locale} />
    </div>
    <p className={muted}>{t("归档仅含已有记录；TST 仅含已收到的生产者日累计回执。两种来源分别展示，不相加。累计连接次数不代表当前活跃连接，最新回执不保证采集完整。", "Archive covers recorded rows; TST covers received producer/day checkpoints. Sources are shown separately without addition. Cumulative connections are not active connections. Latest receipt does not establish complete coverage.")}</p>
    <p className="text-xs text-[var(--muted-foreground)]">{t("归档记录行：", "Archive rows: ")}{usage.archive.rows} · {t("最近归档日：", "Latest archive day: ")}{usage.archive.latest_day ?? t("未知", "Unknown")} · {t("TST 回执行：", "TST checkpoint rows: ")}{usage.tst_ingress.rows}</p>
  </section>;
}

export function SnapshotView({ snapshot, locale }: { snapshot: MetricSnapshot; locale: string }) {
  const t = (zh: string, en: string) => metricText(locale, zh, en);
  return <div className="space-y-6" data-testid="metric-snapshot">
    <p className={muted}>{t("工作空间", "Workspace")} #{snapshot.workspace_id} · {t("生成时间：", "Generated: ")}<MetricTime value={snapshot.generated_at} locale={locale} /></p>
    <p className={muted}>{t("新鲜度与状态均以快照生成时间为准；刷新后查看最新事实。归档包含本空间已删除资源及其他归档业务。", "Freshness and status refer to snapshot time. Refresh for the latest facts. The workspace archive includes deleted resources and other archived business.")}</p>
    <div className="grid grid-cols-3 gap-3">{(["forwards", "links", "nodes"] as const).map((kind) => <Card key={kind} className="p-3"><p className={muted}>{kind === "forwards" ? "Forward" : kind === "links" ? "Link" : "Node"}</p><p className="text-2xl font-semibold tabular-nums">{snapshot.workspace.resources[kind]}</p></Card>)}</div>
    <UsageView usage={snapshot.workspace.usage} locale={locale} />
    <section className="space-y-3"><h3 className="font-medium">{t("采集待补充", "Collection pending")}</h3>
      <div className="grid gap-3 sm:grid-cols-3"><MetricCard title={t("活跃连接", "Active connections")} metric={snapshot.workspace.active_connections} locale={locale} />
        <MetricCard title={t("端到端延迟", "End-to-end latency")} metric={snapshot.workspace.latency_ms} locale={locale} />
        <MetricCard title={t("业务错误", "Business errors")} metric={snapshot.workspace.error_count} locale={locale} /></div>
      <p className={muted}>{t("实时速率、质量趋势和异常时间线尚无统一采集数据。", "Unified live throughput, quality trends and an anomaly timeline are not collected yet.")}</p>
    </section>
    <ResourceExplorer snapshot={snapshot} locale={locale} />
  </div>;
}

type ResourceKind = "forwards" | "links" | "nodes";
const pageSize = 20;
function ResourceExplorer({ snapshot, locale }: { snapshot: MetricSnapshot; locale: string }) {
  const [kind, setKind] = useState<ResourceKind>("forwards"), [search, setSearch] = useState(""), [page, setPage] = useState(0), [selected, setSelected] = useState<number | null>(null);
  const detailRef = useRef<HTMLDivElement>(null), listRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected !== null) detailRef.current?.focus();
  }, [selected, kind]);
  const t = (zh: string, en: string) => metricText(locale, zh, en);
  const title = kind === "forwards" ? "Forward" : kind === "links" ? "Link" : "Node";
  const rows = snapshot[kind].filter((row) => String(row.id).includes(search.trim()));
  const pages = Math.max(1, Math.ceil(rows.length / pageSize)), safePage = Math.min(page, pages - 1);
  const shown = rows.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const current = selected === null ? null : snapshot[kind].find((row) => row.id === selected);
  return <section ref={listRef} tabIndex={-1} className="space-y-4" data-testid="metric-resources">
    <h3 className="font-medium">{t("资源与关联拓扑", "Resources and topology")}</h3>
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("资源维度", "Resource dimension")}>{(["forwards", "links", "nodes"] as const).map((value) => <Button key={value} size="sm" variant={kind === value ? "default" : "outline"} aria-pressed={kind === value} onClick={() => { setKind(value); setSelected(null); setPage(0); setSearch(""); }}>{value === "forwards" ? "Forward" : value === "links" ? "Link" : "Node"}</Button>)}</div>
    <label className="block max-w-sm space-y-1 text-sm"><span>{t("按资源 ID 筛选", "Filter by resource ID")}</span><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></label>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{shown.map((row) => <Card key={row.id} className="space-y-2 p-4">
      <h4 className="font-medium">{title} #{row.id}</h4>
      {kind === "forwards" ? <p className="break-words text-sm">{t("期望 / 部署：", "Desired / deployment: ")}{(row as MetricForward).desired_status} / {(row as MetricForward).deployment_status}</p>
        : kind === "links" ? <p className="break-words text-sm">{(row as MetricLink).carrier} · {(row as MetricLink).desired_status} / {(row as MetricLink).deployment?.status ?? "unknown"}</p>
        : <p className="break-words text-sm">{t("生命周期 / 连接：", "Lifecycle / connection: ")}{(row as MetricNode).lifecycle} / {(row as MetricNode).connection}</p>}
      <Button size="sm" variant="outline" aria-expanded={selected === row.id} aria-controls="metric-resource-detail" onClick={() => { setSelected(row.id); if (selected === row.id) detailRef.current?.focus(); }}>{t("查看", "Inspect")} {title} #{row.id}</Button>
    </Card>)}</div>
    {!rows.length ? <p role="status">{search ? t("没有匹配资源。", "No matching resources.") : t("当前空间没有此类资源。", "No resources of this kind in this workspace.")}</p> : null}
    <div className="flex flex-wrap items-center gap-3 text-sm"><Button size="sm" variant="outline" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>{t("上一页", "Previous")}</Button>
      <span>{safePage + 1} / {pages} · {rows.length} {t("项", "resources")}</span><Button size="sm" variant="outline" disabled={safePage + 1 >= pages} onClick={() => setPage(safePage + 1)}>{t("下一页", "Next")}</Button></div>
    <div id="metric-resource-detail" ref={detailRef} tabIndex={-1} aria-label={t("资源详情", "Resource detail")}>{current ? <Card className="space-y-5 p-4" data-testid="metric-resource-detail">
      <h3 className="font-medium">{title} #{current.id}</h3>
      <Button size="sm" variant="outline" onClick={() => { setSelected(null); listRef.current?.focus(); }}>{t("返回资源列表", "Back to resources")}</Button>
      {kind === "forwards" ? <ForwardDetail forward={current as MetricForward} snapshot={snapshot} locale={locale} />
        : kind === "links" ? <LinkDetail link={current as MetricLink} locale={locale} /> : <NodeDetail node={current as MetricNode} locale={locale} />}
      <UsageView usage={current.usage} locale={locale} />
    </Card> : null}</div>
  </section>;
}

export function ForwardDetail({ forward, snapshot, locale }: { forward: MetricForward; snapshot: MetricSnapshot; locale: string }) {
  const t = (zh: string, en: string) => metricText(locale, zh, en);
  const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const link = snapshot.links.find((row) => row.id === forward.link_id);
  return <>
    <p className="break-words text-sm">{forward.protocol} · {t("期望 / 部署：", "Desired / deployment: ")}{forward.desired_status} / {forward.deployment_status}</p>
    <p className="text-sm">{t("期望 / 已应用配置版本：", "Desired / applied configuration revision: ")}{forward.desired_revision ?? "?"} / {forward.applied_revision ?? "?"}</p>
    <section className="space-y-3"><h4 className="font-medium">{t("配置关联拓扑", "Configured topology")}</h4>
      <ol className="grid gap-3 md:grid-cols-3" aria-label={t("配置节点顺序", "Configured node order")}>{forward.node_ids.map((id, index) => <li key={`${id}-${index}`} className="min-w-0 space-y-2 rounded-md border border-[var(--border)] p-3">
        <p>{index + 1}. Node #{id}</p><p className="break-words text-sm">{nodes.get(id)?.connection ?? "unknown"} · {nodes.get(id)?.lifecycle ?? "unknown"}</p>
        {nodes.get(id) ? <Freshness value={nodes.get(id)!.report} locale={locale} /> : null}
      </li>)}</ol>
      {!forward.node_ids.length ? <p>{t("未记录节点关联。", "No node relationships recorded.")}</p> : null}
      <p className="text-sm">{forward.link_id === null ? t("载体：原生转发", "Carrier: Native forwarding") : `Link #${forward.link_id} · ${link?.carrier ?? "unknown"}`}</p>
      <p className={muted}>{t("此图表示配置关联。部署已应用、节点在线、配置存在或 Ready 都不能证明业务健康。", "This topology shows configuration relationships. Applied deployment, online nodes, configuration presence and Ready do not establish business health.")}</p>
    </section>
    <section className="space-y-2"><h4 className="font-medium">{t("节点配置报告", "Node configuration reports")}</h4>
      {forward.runtime_coverage === "not_projected" ? <p className={muted}>{t("此拓扑尚未投影运行配置报告。", "Runtime configuration reports are not projected for this topology.")}</p> : forward.runtimes.map((runtime) => <div key={`${runtime.node_id}-${runtime.role}`} className="space-y-1 text-sm"><p>Node #{runtime.node_id} · {runtime.role} · {runtime.state}</p><Freshness value={runtime.freshness} locale={locale} /></div>)}
    </section>
    <section className="space-y-3"><h4 className="font-medium">{t("授权目标 TCP 观测", "Authorized target TCP observations")}</h4>
      {!forward.target_observations.length ? <p className={muted}>{t("没有可投影的目标观测，结果未知。", "No target observations can be projected. Result unknown.")}</p> : forward.target_observations.map((target) => <div key={`${target.node_id}-${target.target_index}`} className="space-y-2 rounded-md border border-[var(--border)] p-3">
        <p className="text-sm">{t("目标", "Target")} #{target.target_index + 1} · Node #{target.node_id} · {t("样本结果：", "Sample result: ")}{target.reachable === null ? t("未知", "Unknown") : target.reachable ? t("TCP 建连成功", "TCP connect succeeded") : t("TCP 建连失败", "TCP connect failed")}</p>
        <MetricCard title={t("TCP 建连耗时", "TCP connect latency")} metric={target.latency_ms} locale={locale} />
        <Freshness value={target.freshness} locale={locale} />
      </div>)}
      <p className={muted}>{t("观测属于对应节点与目标的 TCP 建连；不代表端到端延迟或应用可用性。陈旧样本仅保留历史结果。", "Each sample describes a TCP connection from its node to its target, not end-to-end latency or application availability. Stale samples retain only historical results.")}</p>
    </section>
  </>;
}
function LinkDetail({ link, locale }: { link: MetricLink; locale: string }) {
  const t = (zh: string, en: string) => metricText(locale, zh, en);
  return <>
    <p className="break-words text-sm">{link.carrier} · {t("期望 / 部署：", "Desired / deployment: ")}{link.desired_status} / {link.deployment?.status ?? "unknown"}</p>
    <p className="text-sm">{t("期望 / 部署世代：", "Desired / deployment generation: ")}{link.generation} / {link.deployment?.generation ?? "?"}</p>
    <h4 className="font-medium">{t("载体节点报告", "Carrier placement reports")}</h4>
    {!link.placements.length ? <p>{t("无当前部署的节点报告，结果未知。", "No placement reports for the current deployment. Result unknown.")}</p> : link.placements.map((placement) => <div key={`${placement.node_id}-${placement.role}`} className="space-y-2 rounded-md border border-[var(--border)] p-3">
      <p className="break-words text-sm">Node #{placement.node_id} · {placement.role} · {placement.state}</p>
      <p className="text-sm">{t("已应用世代：", "Applied generation: ")}{placement.applied_generation ?? "?"} · Ready: {placement.ready === null ? "?" : String(placement.ready)}</p><Freshness value={placement.freshness} locale={locale} />
    </div>)}
    <p className={muted}>{t("Ready 只表示载体报告，不是业务健康结论；TST 字节只在入口计量一次。", "Ready is a carrier report, not a business health conclusion. TST bytes are counted once at ingress.")}</p>
  </>;
}
function NodeDetail({ node, locale }: { node: MetricNode; locale: string }) {
  const t = (zh: string, en: string) => metricText(locale, zh, en);
  return <>
    <p className="break-words text-sm">{t("生命周期 / 连接：", "Lifecycle / connection: ")}{node.lifecycle} / {node.connection}</p><Freshness value={node.report} locale={locale} />
    <p className="text-sm">{t("进程启动时间：", "Process started: ")}<MetricTime value={node.agent_started_at} locale={locale} /></p>
    <div className="grid gap-3 sm:grid-cols-2"><MetricCard title={t("节点进程运行配置数", "Node process runtime count")} metric={node.runtime_count} locale={locale} />
      <MetricCard title={t("节点进程累计配置 / 运行错误", "Node process cumulative apply/runtime errors")} metric={node.error_count} locale={locale} /></div>
    <p className={muted}>{t("节点进程数据可能覆盖其他业务；运行配置数不是活跃连接数，累计错误不是当前空间业务错误率。", "Node process data may cover other business. Runtime count is not active connections; cumulative errors are not this workspace's business error rate.")}</p>
  </>;
}
