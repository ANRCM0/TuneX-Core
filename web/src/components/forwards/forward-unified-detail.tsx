"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { unifiedForwardApi, type ForwardHistoryEntry } from "@/lib/api/forward-unified";
import { accessAddress, forwardPath, forwardState, forwardTrafficEvidence, forwardTransport, safeForwardError, type ForwardAction } from "@/lib/forward-unified";
import { unifiedForwardText } from "@/lib/forward-unified-i18n";
import { formatBytes } from "@/lib/utils";
import type { DiagnoseReport, PortForward, TrafficPoint } from "@/lib/types";
import { ForwardRoutingCard } from "./forward-routing-card";

type Tab = "overview" | "config" | "traffic" | "diagnosis" | "history" | "routing";
const detailTabs: Tab[] = ["overview", "config", "traffic", "diagnosis", "history", "routing"];
export function ForwardStateBadge({ forward, locale }: { forward: PortForward; locale: string }) {
  const state = forwardState(forward);
  return <Badge data-testid="forward-runtime-state" variant={state === "ready" ? "success" : state === "error" ? "destructive" : "outline"}>{unifiedForwardText(locale, state)}</Badge>;
}

export function ForwardUnifiedDetail({ forward, workspaceId, locale, initialTab = "overview", onClose, onEdit, onCopy, onAction, canUpdate, canDelete, canCopy = true, busy, drawer = true }: {
  forward: PortForward; workspaceId: number; locale: string; initialTab?: Tab; onClose: () => void;
  onEdit: () => void; onCopy: () => void; onAction: (action: ForwardAction) => void;
  canUpdate: boolean; canDelete: boolean; canCopy?: boolean; busy: boolean; drawer?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [traffic, setTraffic] = useState<TrafficPoint[] | null>(null);
  const [history, setHistory] = useState<ForwardHistoryEntry[] | null>(null);
  const [report, setReport] = useState<DiagnoseReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const diagnosisAbort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const T = (key: string) => unifiedForwardText(locale, key);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; diagnosisAbort.current?.abort(); }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (tab !== "traffic" && tab !== "history") return;
    setLoading(true); setError(null);
    const client = unifiedForwardApi(workspaceId, controller.signal);
    const run = tab === "traffic" ? client.traffic(forward.id).then(setTraffic) : client.history(forward.id).then(setHistory);
    void run.catch((failure) => { if (!controller.signal.aborted) setError(tab === "history" ? T("historyUnavailable") : `${T("failed")} (${safeForwardError(failure)})`); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab, workspaceId, forward.id, locale]);
  async function diagnose() {
    diagnosisAbort.current?.abort();
    const controller = new AbortController(); diagnosisAbort.current = controller;
    setLoading(true); setError(null); setReport(null);
    try { const value = await unifiedForwardApi(workspaceId, controller.signal).diagnose(forward.id); if (mounted.current && !controller.signal.aborted) setReport(value); }
    catch (failure) { if (mounted.current && !controller.signal.aborted) setError(`${T("failed")} (${safeForwardError(failure)})`); }
    finally { if (mounted.current && !controller.signal.aborted) setLoading(false); }
  }
  const address = accessAddress(forward);
  const observedTraffic = forwardTrafficEvidence(forward);
  const head = <><DialogHeader><DialogTitle>{forward.name}</DialogTitle><DialogDescription>{T(forwardPath(forward))} · {T(forwardTransport(forward))} · {String(forward.protocol).toUpperCase()}</DialogDescription></DialogHeader></>;
  const content = <>
    <div className="flex flex-wrap items-center gap-2"><ForwardStateBadge forward={forward} locale={locale} />
      <Button size="sm" variant="outline" title={!canUpdate ? T("permissionUpdate") : undefined} disabled={!canUpdate || busy} onClick={onEdit}>{T("edit")}</Button>
      <Button size="sm" variant="outline" title={!canUpdate ? T("permissionUpdate") : undefined} disabled={!canUpdate || busy} onClick={() => onAction(forwardState(forward) === "suspended" ? "resume" : "suspend")}>{T(forwardState(forward) === "suspended" ? "resume" : "suspend")}</Button>
      <Button size="sm" variant="outline" title={!canUpdate ? T("permissionUpdate") : undefined} disabled={!canUpdate || busy} onClick={() => onAction("retry")}>{T("retry")}</Button>
      <Button size="sm" variant="outline" title={!canCopy ? T("permissionCreate") : undefined} disabled={!canCopy || busy} onClick={onCopy}>{T("copy")}</Button>
      <Button size="sm" variant="destructive" title={!canDelete ? T("permissionDelete") : undefined} disabled={!canDelete || busy} onClick={() => onAction("delete")}>{T("delete")}</Button>
    </div>
    {!canUpdate || !canCopy || !canDelete ? <p className="text-xs text-[var(--muted-foreground)]">{T("permissionHint")}</p> : null}
    <div role="tablist" aria-label={T("details")} className="flex gap-1 overflow-x-auto border-b border-[var(--border)] pb-2">
      {detailTabs.map((value) => <button key={value} id={`forward-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`forward-panel-${value}`}
        tabIndex={tab === value ? 0 : -1} onClick={() => { setTab(value); setError(null); }} onKeyDown={(event) => {
          const tabs = detailTabs;
          if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
          event.preventDefault(); const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[tabs.length - 1] : tabs[(tabs.indexOf(value) + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
          setTab(next); document.getElementById(`forward-tab-${next}`)?.focus();
        }} className={`shrink-0 rounded-md px-3 py-2 text-sm ${tab === value ? "bg-[var(--muted)] font-medium" : "text-[var(--muted-foreground)]"}`}>{value === "routing" ? locale === "en" ? "Advanced routing" : "高级路由" : T(value)}</button>)}
    </div>
    <div role="tabpanel" id={`forward-panel-${tab}`} aria-labelledby={`forward-tab-${tab}`} className="min-h-44 space-y-4">
      {error ? <p role="alert" className="text-sm text-[var(--destructive)]">{error}</p> : null}
      {loading ? <p role="status" className="text-sm">{T("loading")}</p> : null}
      {tab === "overview" ? <><Facts entries={[[T("address"), address ?? T("unknown")], [T("target"), `${forward.target_host ?? T("unknown")}:${forward.target_port ?? "?"}`], [T("targetHealth"), T(`health_${forward.lifecycle?.target_health ?? "unknown"}`)], [T("desired"), T(forward.lifecycle?.desired ?? forward.desired_status ?? "unknown")], [T("runtime"), T(forwardState(forward))], [T("expectedRevision"), forward.config_revision ?? T("unknown")], [T("appliedRevision"), forward.applied_revision ?? T("unknown")], [T("lastApplied"), forward.last_applied_at ? new Date(forward.last_applied_at).toLocaleString(locale === "en" ? "en-US" : "zh-CN") : T("unknown")]]} />
        <p className="text-xs text-[var(--muted-foreground)]">{T("observation")}</p>
        {address ? <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(address).catch(() => setError(T("failed")))}>{T("copyAddress")}</Button> : null}
        {forward.apply_error_code ? <p role="alert" className="text-sm text-[var(--destructive)]">{forward.apply_error_code}</p> : null}
      </> : null}
      {tab === "config" ? <><Facts entries={[[T("path"), T(forwardPath(forward))], [T("transport"), T(forwardTransport(forward))], [T("protocol"), String(forward.protocol).toUpperCase()], [T("ingress"), forward.ingress_node?.node_id ?? String(forward.ingress_node_id)], [T("egress"), forwardPath(forward) === "relay" ? forward.egress_node?.node_id ?? String(forward.egress_node_id ?? "?") : "—"], [T("listen"), forward.listen_port ?? T("autoPort")], [T("targetHost"), forward.target_host ?? T("unknown")], [T("targetPort"), forward.target_port ?? T("unknown")], [locale === "en" ? "Upload bytes/sec" : "上传 bytes/sec", forward.bytes_per_second_in ?? 0], [locale === "en" ? "Download bytes/sec" : "下载 bytes/sec", forward.bytes_per_second_out ?? 0], [locale === "en" ? "Concurrent connections" : "总并发上限", forward.max_connections ?? 0], [locale === "en" ? "Concurrency per IP" : "每 IP 并发上限", forward.max_connections_per_ip ?? 0]]} />
        <p className="text-sm">{T("sessionModel")}: {T(forward.protocol === "udp" ? "udpModel" : forward.protocol === "both" ? "bothModel" : "tcpModel")}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{T(forwardTransport(forward) === "tst_v1" ? "tstNote" : "nativeNote")}</p></> : null}
      {tab === "traffic" ? <section className="space-y-3"><h3 className="text-sm font-medium">{T("observedTraffic")}</h3>{observedTraffic ? <Facts entries={[[T("uploadPayload"), formatBytes(Number(observedTraffic.bytesIn))], [T("downloadPayload"), formatBytes(Number(observedTraffic.bytesOut))], [T("observedConnections"), observedTraffic.connections], [T("lastStats"), observedTraffic.lastReceivedAt ? new Date(observedTraffic.lastReceivedAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN") : T("unknown")]]} /> : <p className="text-sm text-[var(--muted-foreground)]">{T("noObservedTraffic")}</p>}</section> : null}
      {tab === "traffic" && traffic ? <><p className="text-xs text-[var(--muted-foreground)]">{T("trafficHint")}</p>
        {traffic.length ? <div className="space-y-2">{traffic.map((point) => <div key={point.date} className="flex items-center justify-between gap-4 text-sm"><span>{point.date}</span><span>{formatBytes(point.traffic)}</span></div>)}</div> : <p>{T("noTraffic")}</p>}</> : null}
      {tab === "diagnosis" ? <><Button variant="outline" disabled={loading} onClick={() => void diagnose()}>{T("runDiagnosis")}</Button>
        {!report && !loading ? <p className="text-sm text-[var(--muted-foreground)]">{T("noDiagnosis")}</p> : null}
        {report?.segments.map((segment, index) => <section key={index} className="space-y-2 rounded-md border border-[var(--border)] p-3"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{segment.node_key}</span>
          <Badge variant={segment.verified && segment.outcome === "ok" ? "success" : "outline"}>{segment.verified ? T("verified") : T("unverifiedSegment")}</Badge><span className="text-xs">{segment.outcome} · {segment.method}</span></div>
          {segment.results.map((result, resultIndex) => <p key={resultIndex} className="text-sm">{result.status} · {result.elapsed_ms} ms</p>)}
          {segment.method === "tcp_probe" && ["udp", "both"].includes(String(report.protocol ?? forward.protocol)) ? <p className="text-xs text-[var(--muted-foreground)]">{T("udpUnverified")}</p> : null}
          {segment.error_code ? <p className="text-xs text-[var(--destructive)]">{segment.error_code}</p> : null}</section>)}
        {report?.next_step ? <p className="text-sm"><strong>{T("next")}: </strong>{report.next_step}</p> : null}</> : null}
      {tab === "history" && history ? history.length ? <div className="space-y-3">{history.map((entry) => <div key={`${entry.revision}-${entry.created_at}`} className="rounded-md border border-[var(--border)] p-3 text-sm"><div>{T("expectedRevision")} {entry.revision} · {T(entry.desired_status)}</div><time dateTime={entry.created_at} className="text-xs text-[var(--muted-foreground)]">{new Date(entry.created_at).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}</time></div>)}</div> : <p>{T("noHistory")}</p> : null}
      {tab === "routing" ? <ForwardRoutingCard key={`${workspaceId}-${forward.id}`} forwardId={forward.id} workspaceId={workspaceId} locale={locale} canUpdate={canUpdate} /> : null}
    </div>
  </>;
  if (!drawer) return <div className="space-y-4">{content}</div>;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="inset-y-0 left-auto right-0 top-0 h-dvh max-h-dvh w-full max-w-2xl content-start translate-x-0 translate-y-0 rounded-none p-5 sm:p-6" data-testid="forward-detail-drawer">{head}{content}</DialogContent></Dialog>;
}
function Facts({ entries }: { entries: [string, string | number][] }) {
  return <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{entries.map(([label, value], index) => <div key={index} className="min-w-0"><dt className="text-xs text-[var(--muted-foreground)]">{label}</dt><dd className="mt-1 break-all text-sm">{value}</dd></div>)}</dl>;
}
