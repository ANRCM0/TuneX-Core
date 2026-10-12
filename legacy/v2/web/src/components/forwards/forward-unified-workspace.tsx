"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/providers";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { request } from "@/lib/api/core";
import { unifiedForwardApi } from "@/lib/api/forward-unified";
import { accessAddress, forwardPath, forwardState, forwardTrafficEvidence, forwardTransport, safeForwardError, type ForwardAction, type ForwardOperation, type UnifiedForwardCapabilities } from "@/lib/forward-unified";
import { unifiedForwardText } from "@/lib/forward-unified-i18n";
import type { NodeDiagnosticsReport, PortForward, UserNode } from "@/lib/types";
import { ForwardUnifiedForm, NativeSelect, unifiedFormDraft, unifiedFormInput, type UnifiedFormDraft } from "./forward-unified-form";
import { ForwardStateBadge, ForwardUnifiedDetail } from "./forward-unified-detail";
import { ForwardListControls } from "./forward-list-controls";
import { forwardListText, type ForwardSortKey, type ForwardSortOrder, type ForwardListTextKey } from "./forward-list-model";

/** Workspace and permission changes unmount pending work and abort its requests. */
export function ForwardWorkspace({ initialSelectedId }: { initialSelectedId?: number } = {}) {
  const workspace = useWorkspace();
  const { locale } = useI18n();
  const T = (key: string) => unifiedForwardText(locale, key);
  if (workspace.loading || workspace.permissionsLoading) return <p role="status">{T("loading")}</p>;
  if (workspace.currentId === null) return <p>{T("workspace")}</p>;
  if (!workspace.can("forward:read")) return <p role="alert">{T("denied")}</p>;
  return <ScopedForwardWorkspace key={JSON.stringify([workspace.currentId, workspace.permissions])} workspaceId={workspace.currentId} locale={locale}
    canCreate={workspace.can("forward:create")} canReadNodes={workspace.can("node:read")} canUpdate={(row) => workspace.canForward(row, "update")}
    canDelete={(row) => workspace.canForward(row, "delete")} initialSelectedId={initialSelectedId} />;
}
type Editor = { draft: UnifiedFormDraft; existing?: PortForward; copy?: boolean };
function ScopedForwardWorkspace({ workspaceId, locale, canCreate, canReadNodes, canUpdate, canDelete, initialSelectedId }: {
  workspaceId: number; locale: string; canCreate: boolean; canReadNodes: boolean; canUpdate: (forward: PortForward) => boolean;
  canDelete: (forward: PortForward) => boolean; initialSelectedId?: number;
}) {
  const T = useCallback((key: string) => unifiedForwardText(locale, key), [locale]);
  const { t } = useI18n();
  const L = (key: ForwardListTextKey, params?: Record<string, string | number>) => forwardListText(t, locale as "zh" | "en", key, params);
  const [rows, setRows] = useState<PortForward[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<ForwardSortKey>("order_by");
  const [order, setOrder] = useState<ForwardSortOrder>("asc");
  const [ingressFilter, setIngressFilter] = useState("all");
  const [egressFilter, setEgressFilter] = useState("all");
  const [path, setPath] = useState("all");
  const [transport, setTransport] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [nodes, setNodes] = useState<UserNode[]>([]);
  const [capabilities, setCapabilities] = useState<UnifiedForwardCapabilities | null>(null);
  const [selected, setSelected] = useState<PortForward | null>(null);
  const [selectedTab, setSelectedTab] = useState<"overview" | "diagnosis">("overview");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [confirmation, setConfirmation] = useState<PortForward | null>(null);
  const [operation, setOperation] = useState<ForwardOperation | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const scopeAbort = useRef(new AbortController());
  const inFlight = useRef(false);
  const submission = useRef<{ fingerprint: string; key: string } | null>(null);
  const pendingCreationDetail = useRef<string | null>(null);
  const alive = () => !scopeAbort.current.signal.aborted;
  const client = () => unifiedForwardApi(workspaceId, scopeAbort.current.signal);
  useEffect(() => { const controller = new AbortController(); scopeAbort.current = controller; return () => controller.abort(); }, []);
  useEffect(() => { const timer = window.setTimeout(() => { setKeyword(search.trim()); setPage(1); }, 300); return () => window.clearTimeout(timer); }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const api = unifiedForwardApi(workspaceId, controller.signal);
    void Promise.allSettled([api.capabilities(), canReadNodes ? api.nodes() : Promise.resolve([])]).then(async ([capabilityResult, nodeResult]) => {
      if (controller.signal.aborted) return;
      if (capabilityResult.status === "fulfilled") setCapabilities(capabilityResult.value);
      if (nodeResult.status === "fulfilled") {
        setNodes(nodeResult.value.map((node) => ({ ...node, capabilities: null, capabilities_fresh: false })));
        const enriched = await Promise.all(nodeResult.value.map(async (node) => {
          try { const report = await request<NodeDiagnosticsReport>(`/nodes/${node.id}/diagnostics`, { workspaceId, signal: controller.signal });
            return { ...node, capabilities: report.panel.reported?.capabilities ?? null, capabilities_fresh: report.node_id === node.id && report.reachability === "online" };
          } catch { return { ...node, capabilities: null, capabilities_fresh: false }; }
        }));
        if (!controller.signal.aborted) setNodes(enriched);
      }
    });
    return () => controller.abort();
  }, [workspaceId, canReadNodes, reloadToken]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    void unifiedForwardApi(workspaceId, controller.signal).list({ page, page_size: pageSize, sort, order, keyword,
      path: path === "all" ? undefined : path, transport: transport === "all" ? undefined : transport,
      ingress_node_id: ingressFilter === "all" ? undefined : ingressFilter, egress_node_id: egressFilter === "all" ? undefined : egressFilter,
      apply_status: status === "all" ? undefined : status }).then((result) => {
      if (controller.signal.aborted) return;
      const lastPage = Math.max(1, Math.ceil(result.total / pageSize));
      if (page > lastPage) { setPage(lastPage); return; }
      setRows(result.data); setTotal(result.total);
    }).catch((failure) => { if (!controller.signal.aborted) { setRows([]); setError(`${T("failed")} (${safeForwardError(failure)})`); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [workspaceId, page, pageSize, sort, order, ingressFilter, egressFilter, path, transport, status, keyword, reloadToken, T]);

  useEffect(() => {
    if (!initialSelectedId) return;
    const controller = new AbortController();
    void unifiedForwardApi(workspaceId, controller.signal).detail(initialSelectedId).then((row) => { if (!controller.signal.aborted) setSelected(row); })
      .catch((failure) => { if (!controller.signal.aborted) setError(`${T("failed")} (${safeForwardError(failure)})`); });
    return () => controller.abort();
  }, [initialSelectedId, workspaceId, T]);

  const refresh = useCallback(() => setReloadToken((value) => value + 1), []);
  useEffect(() => {
    if (!operation || ["completed", "ready", "failed", "error", "deleted", "suspended", "unverified"].includes(operation.state)) return;
    const controller = new AbortController(); let polling = false;
    const timer = window.setInterval(() => {
      if (polling) return; polling = true;
      const api = unifiedForwardApi(workspaceId, controller.signal);
      void api.operation(operation.operation_id).then(async (receipt) => {
        if (controller.signal.aborted) return;
        if (receipt.forward_id !== null) {
          try {
            const row = await api.detail(receipt.forward_id);
            if (!controller.signal.aborted) {
              const openCreatedDetail = pendingCreationDetail.current === receipt.operation_id;
              if (openCreatedDetail) pendingCreationDetail.current = null;
              setSelected((current) => current?.id === row.id || openCreatedDetail && current == null ? row : current);
            }
          } catch { /* Preserve the durable receipt if its resource read is temporarily unavailable. */ }
        }
        // Updating the terminal state cleans up this effect and aborts its controller.
        // Finish the resource read before publishing it so the final runtime facts arrive.
        if (!controller.signal.aborted) { refresh(); setOperation(receipt); }
      }).catch(() => {}).finally(() => { polling = false; });
    }, 5_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [operation?.operation_id, operation?.state, workspaceId, refresh]);

  function openEditor(forward?: PortForward, copy = false) {
    if ((forward && !copy && !canUpdate(forward)) || ((!forward || copy) && !canCreate)) return;
    const draft = unifiedFormDraft(forward, copy, locale === "en" ? "copy" : "副本");
    if (!forward && typeof window !== "undefined") {
      const ingress = new URLSearchParams(window.location.search).get("ingress_node_id");
      if (ingress && /^\d+$/.test(ingress)) draft.ingress = ingress;
    }
    pendingCreationDetail.current = null;
    setSelected(null); setFormError(null); submission.current = null;
    setEditor({ draft, existing: copy ? undefined : forward, copy });
  }
  async function submit(draft: UnifiedFormDraft) {
    if (!editor || inFlight.current) return;
    let input;
    try {
      const fingerprint = JSON.stringify(draft);
      if (submission.current?.fingerprint !== fingerprint) submission.current = { fingerprint, key: crypto.randomUUID() };
      input = unifiedFormInput(draft, submission.current.key);
    } catch { setFormError(T("validation")); return; }
    inFlight.current = true; setBusy(true); setFormError(null);
    try {
      if (editor.existing) {
        const patch = {
          name: input.name,
          protocol: input.protocol,
          ingress_node_id: input.ingress_node_id,
          egress_node_id: input.egress_node_id ?? null,
          listen_port: input.listen_port,
          target_host: input.target_host,
          target_port: input.target_port,
          bytes_per_second_in: input.bytes_per_second_in ?? 0,
          bytes_per_second_out: input.bytes_per_second_out ?? 0,
          max_connections: input.max_connections ?? 0,
          max_connections_per_ip: input.max_connections_per_ip ?? 0,
          expected_revision: editor.existing.latest_revision ?? editor.existing.config_revision ?? 0,
        };
        const row = await client().update(editor.existing.id, patch);
        if (!alive()) return; setSelected(row); toast.message(T("updated"));
      } else {
        const receipt = await client().create(input);
        if (!alive()) return;
        pendingCreationDetail.current = receipt.operation_id;
        setOperation(receipt); toast.message(T("submitted"));
        setEditor(null); refresh();
        if (receipt.forward_id !== null) {
          try { const row = await client().detail(receipt.forward_id); if (alive()) { pendingCreationDetail.current = null; setSelected(row); } } catch { /* The receipt remains visible when its follow-up read fails. */ }
        }
      }
      if (alive()) { setEditor(null); refresh(); }
    } catch (failure) {
      if (!alive()) return;
      const code = safeForwardError(failure);
      setFormError(code.includes("revision") || code.includes("conflict") ? T("conflict") : `${T("failed")} (${code})`);
    } finally { if (alive()) { inFlight.current = false; setBusy(false); } }
  }
  async function action(forward: PortForward, value: ForwardAction) {
    if (inFlight.current || (value === "delete" ? !canDelete(forward) : !canUpdate(forward))) return;
    if (value === "delete" && confirmation?.id !== forward.id) { setSelected(null); setConfirmation(forward); return; }
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const result = await client().action(forward.id, value);
      if (!alive()) return;
      if (value === "delete") { setSelected(null); setConfirmation(null); }
      else if ("id" in result) setSelected((current) => current?.id === result.id ? result : current);
      toast.message(T(value === "delete" ? "deleted" : "updated")); refresh();
    } catch (failure) { if (alive()) { setError(`${T("failed")} (${safeForwardError(failure)})`); setConfirmation(null); } }
    finally { if (alive()) { inFlight.current = false; setBusy(false); } }
  }
  async function select(row: PortForward, diagnosis = false) {
    pendingCreationDetail.current = null;
    setSelectedTab(diagnosis ? "diagnosis" : "overview"); setSelected(row);
    try { const latest = await client().detail(row.id); if (alive()) setSelected((current) => current?.id === row.id ? latest : current); }
    catch (failure) { if (alive()) setError(`${T("failed")} (${safeForwardError(failure)})`); }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-[var(--muted-foreground)]">{total} {T("total")}</span><div className="flex gap-2"><Button variant="outline" onClick={refresh}><RefreshCw className="size-4" />{T("refresh")}</Button><Button title={!canCreate ? T("permissionCreate") : !canReadNodes ? T("permissionNodes") : undefined} disabled={!canCreate || !canReadNodes} onClick={() => openEditor()}><Plus className="size-4" />{T("create")}</Button></div></div>
    {!canCreate || !canReadNodes ? <p className="text-xs text-[var(--muted-foreground)]">{T(!canCreate ? "permissionCreate" : "permissionNodes")}</p> : null}
    {rows.some((row) => !canUpdate(row) || !canDelete(row)) ? <p className="text-xs text-[var(--muted-foreground)]">{T("permissionHint")}</p> : null}
    {operation ? <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] p-3 text-sm"><strong>{T("operation")} #{operation.operation_id}</strong><Badge variant="outline">{T(operation.state)}</Badge><span>{T("stage")}: {operation.stage}</span>{operation.error_code ? <span className="text-[var(--destructive)]">{operation.error_code}</span> : null}</div> : null}
    {error ? <p role="alert" className="rounded-md border border-[var(--destructive)] p-3 text-sm text-[var(--destructive)]">{error}</p> : null}
    <Card><CardHeader><CardTitle>{T("forwards")}</CardTitle></CardHeader><CardContent>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Input data-testid="forward-keyword" aria-label={T("search")} placeholder={T("search")} value={search} onChange={(event) => setSearch(event.target.value)} />
        <NativeSelect label={T("path")} value={path} onChange={(value) => { setPath(value); setPage(1); }}><option value="all">{T("path")}: {T("all")}</option><option value="direct">{T("direct")}</option><option value="relay">{T("relay")}</option></NativeSelect>
        <NativeSelect label={T("transport")} value={transport} onChange={(value) => { setTransport(value); setPage(1); }}><option value="all">{T("transport")}: {T("all")}</option><option value="native_plain">{T("native_plain")}</option><option value="tst_v1">{T("tst_v1")}</option></NativeSelect>
        <NativeSelect label={T("status")} value={status} onChange={(value) => { setStatus(value); setPage(1); }}><option value="all">{T("status")}: {T("all")}</option>{["pending", "applying", "active", "suspended", "error"].map((value) => <option key={value} value={value}>{T(value === "active" ? "confirmed" : value)}</option>)}</NativeSelect>
        <NativeSelect testId="forward-ingress-filter" label={T("ingress")} value={ingressFilter} onChange={(value) => { setIngressFilter(value); setPage(1); }}><option value="all">{T("ingress")}: {T("all")}</option>{nodes.filter((node) => node.role === "ingress" || node.role === "both").map((node) => <option key={node.id} value={String(node.id)}>{node.node_id}</option>)}</NativeSelect>
        <NativeSelect testId="forward-egress-filter" label={T("egress")} value={egressFilter} onChange={(value) => { setEgressFilter(value); setPage(1); }}><option value="all">{L("forward.allEgress")}</option>{nodes.filter((node) => node.role === "egress" || node.role === "both").map((node) => <option key={node.id} value={String(node.id)}>{node.node_id}</option>)}</NativeSelect>
      </div>
      <ForwardListControls loading={loading} total={total} page={page} pageCount={Math.max(1, Math.ceil(total / pageSize))} pageSize={pageSize} sort={sort} order={order} t={t} text={L} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} onSortChange={(value) => { setSort(value); setPage(1); }} onOrderChange={(value) => { setOrder(value); setPage(1); }} />
      <Table><TableHeader><TableRow>{["name", "path", "transport", "protocol", "address", "target", "status", "created_at", "actions"].map((key) => {
        const column = ({ name: "name", path: "mode", address: "listen_port", status: "status", created_at: "created_at" } as Record<string, ForwardSortKey>)[key];
        return <TableHead key={key}>{column ? <button data-testid={`forward-sort-${column}`} onClick={() => { if (sort === column) setOrder(order === "asc" ? "desc" : "asc"); else setSort(column); setPage(1); }}>{key === "created_at" ? t("common.createdAt") : T(key)}{sort === column ? order === "asc" ? " ↑" : " ↓" : ""}</button> : T(key)}</TableHead>;
      })}</TableRow></TableHeader>
        <TableBody>{loading ? <TableEmpty colSpan={9} text={T("loading")} /> : !rows.length ? <TableEmpty colSpan={9} text={T("empty")} /> : rows.map((row) => <TableRow key={row.id}>
          <TableCell><button className="font-medium text-[var(--primary)] hover:underline" onClick={() => void select(row)}>{row.name}</button></TableCell><TableCell><div>{T(forwardPath(row))}</div><div className="mt-1 max-w-44 break-all text-xs text-[var(--muted-foreground)]">{row.ingress_node?.node_id ?? `#${row.ingress_node_id}`}{forwardPath(row) === "relay" ? ` → ${row.egress_node?.node_id ?? `#${row.egress_node_id}`}` : ""}</div></TableCell><TableCell><Badge variant="outline">{T(forwardTransport(row))}</Badge></TableCell><TableCell>{String(row.protocol).toUpperCase()}</TableCell>
          <TableCell className="whitespace-nowrap font-mono text-xs">{accessAddress(row) ?? "—"}</TableCell><TableCell className="max-w-60 break-all">{row.target_host}:{row.target_port}</TableCell><TableCell><ForwardStateBadge forward={row} locale={locale} /><p className="mt-1 text-xs text-[var(--muted-foreground)]">{T("desired")}: {T(row.lifecycle?.desired ?? row.desired_status ?? "unknown")}</p><ForwardRecentStats forward={row} locale={locale} /></TableCell>
          <TableCell className="whitespace-nowrap text-xs">{new Date(row.created_at).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN")}</TableCell>
          <TableCell><div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => void select(row)}>{T("details")}</Button><Button size="sm" variant="outline" title={!canUpdate(row) ? T("permissionUpdate") : undefined} disabled={!canUpdate(row) || busy} onClick={() => openEditor(row)}>{T("edit")}</Button><Button size="sm" variant="outline" title={!canCreate ? T("permissionCreate") : !canReadNodes ? T("permissionNodes") : undefined} disabled={!canCreate || !canReadNodes} onClick={() => openEditor(row, true)}>{T("copy")}</Button><Button size="sm" variant="outline" onClick={() => void select(row, true)}>{T("diagnose")}</Button><Button size="sm" variant="outline" title={!canUpdate(row) ? T("permissionUpdate") : undefined} disabled={!canUpdate(row) || busy} onClick={() => void action(row, forwardState(row) === "suspended" ? "resume" : "suspend")}>{T(forwardState(row) === "suspended" ? "resume" : "suspend")}</Button><Button size="sm" variant="outline" title={!canUpdate(row) ? T("permissionUpdate") : undefined} disabled={!canUpdate(row) || busy} onClick={() => void action(row, "retry")}>{T("retry")}</Button><Button size="sm" variant="destructive" title={!canDelete(row) ? T("permissionDelete") : undefined} disabled={!canDelete(row) || busy} onClick={() => void action(row, "delete")}>{T("delete")}</Button></div></TableCell>
        </TableRow>)}</TableBody></Table>
    </CardContent></Card>
    {editor ? <ForwardUnifiedForm key={`${editor.existing?.id ?? "new"}-${editor.copy}`} draft={editor.draft} existing={editor.existing} title={T(editor.copy ? "copy" : editor.existing ? "edit" : "create")} nodes={nodes} capabilities={capabilities} locale={locale} busy={busy} error={formError} onClose={() => setEditor(null)} onSubmit={(draft) => void submit(draft)} /> : null}
    {selected ? <ForwardUnifiedDetail key={`${selected.id}-${selectedTab}`} forward={selected} workspaceId={workspaceId} locale={locale} initialTab={selectedTab} busy={busy} canUpdate={canUpdate(selected)} canDelete={canDelete(selected)} canCopy={canCreate && canReadNodes} onClose={() => setSelected(null)} onEdit={() => openEditor(selected)} onCopy={() => openEditor(selected, true)} onAction={(value) => void action(selected, value)} /> : null}
    {confirmation ? <Dialog open onOpenChange={(value) => { if (!value && !busy) setConfirmation(null); }}><DialogContent><DialogHeader><DialogTitle>{T("deleteTitle")}: {confirmation.name}</DialogTitle><DialogDescription>{T("deleteHint")}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>{T("cancel")}</Button><Button variant="destructive" disabled={busy} onClick={() => void action(confirmation, "delete")}>{T("confirmDelete")}</Button></DialogFooter></DialogContent></Dialog> : null}
  </div>;
}

function ForwardRecentStats({ forward, locale }: { forward: PortForward; locale: string }) {
  const time = forwardTrafficEvidence(forward)?.lastReceivedAt;
  return <p className="mt-1 text-xs text-[var(--muted-foreground)]">{unifiedForwardText(locale, "lastStats")}: {time ? <time dateTime={time}>{new Date(time).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}</time> : unifiedForwardText(locale, "unknown")}</p>;
}
