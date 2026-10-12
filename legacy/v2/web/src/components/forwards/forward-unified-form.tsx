"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { ForwardPolicyFields } from "./forward-policy-fields";
import { forwardPolicyDraft, forwardPolicyDraftErrors, forwardPolicyDraftValues, TST_POLICY_MAX_CONCURRENCY, type ForwardPolicyDraft } from "@/lib/forward-policy";
import { forwardCombinationBlock, forwardPath, forwardTransport, type BusinessProtocol, type ForwardPath, type ForwardTransport, type UnifiedForwardCapabilities, type UnifiedForwardInput } from "@/lib/forward-unified";
import { unifiedForwardText } from "@/lib/forward-unified-i18n";
import type { PortForward, UserNode } from "@/lib/types";

export interface UnifiedFormDraft extends ForwardPolicyDraft {
  name: string; path: ForwardPath; transport: ForwardTransport; protocol: BusinessProtocol;
  ingress: string; egress: string; listen: string; host: string; port: string; selection: "auto" | "specified"; link: string;
}
export function unifiedFormDraft(forward?: PortForward, copy = false, suffix = "copy"): UnifiedFormDraft {
  return { ...forwardPolicyDraft(forward), name: forward ? `${forward.name}${copy ? ` ${suffix}` : ""}` : "",
    path: forward ? forwardPath(forward) : "direct", transport: forward ? forwardTransport(forward) as ForwardTransport : "native_plain",
    protocol: (forward?.protocol ?? "tcp") as BusinessProtocol, ingress: forward ? String(forward.ingress_node_id) : "",
    egress: forward?.egress_node_id ? String(forward.egress_node_id) : "", listen: !copy && forward?.listen_port ? String(forward.listen_port) : "",
    host: forward?.target_host ?? "", port: forward?.target_port ? String(forward.target_port) : "", selection: "auto", link: "" };
}

export function unifiedFormInput(draft: UnifiedFormDraft, key: string): UnifiedForwardInput {
  const port = (value: string) => /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 65535;
  if (!draft.name.trim() || !draft.host.trim() || /[\s/@\\]/.test(draft.host) || !port(draft.port)
    || !/^\d+$/.test(draft.ingress) || Number(draft.ingress) <= 0
    || (draft.path === "relay" && (!/^\d+$/.test(draft.egress) || Number(draft.egress) <= 0 || draft.egress === draft.ingress))
    || (draft.listen !== "" && !port(draft.listen)) || !["tcp", "udp", "both"].includes(draft.protocol)
    || (draft.transport === "tst_v1" && draft.path !== "relay")
    || (draft.transport === "tst_v1" && draft.selection === "specified" && (!/^\d+$/.test(draft.link) || Number(draft.link) <= 0))
    || Number(draft.max_connections ?? 0) > (draft.transport === "tst_v1" ? TST_POLICY_MAX_CONCURRENCY : 1_000_000)
    || Number(draft.max_connections_per_ip ?? 0) > (draft.transport === "tst_v1" ? TST_POLICY_MAX_CONCURRENCY : 1_000_000)
    || Object.keys(forwardPolicyDraftErrors(draft)).length) throw new Error("invalid_forward_input");
  return { idempotency_key: key, name: draft.name.trim(), path: draft.path, transport: draft.transport, protocol: draft.protocol,
    ingress_node_id: Number(draft.ingress), egress_node_id: draft.path === "relay" ? Number(draft.egress) : null,
    listen_port: draft.listen === "" ? null : Number(draft.listen), target_host: draft.host.trim(), target_port: Number(draft.port),
    transport_options: draft.transport === "tst_v1" && draft.selection === "specified" ? { selection: "specified", link_id: Number(draft.link) } : { selection: "auto" },
    ...forwardPolicyDraftValues(draft) };
}

export function ForwardUnifiedForm({ draft: initial, existing, title, nodes, capabilities, locale, busy, error, onClose, onSubmit }: {
  draft: UnifiedFormDraft; existing?: PortForward; title: string; nodes: UserNode[]; capabilities: UnifiedForwardCapabilities | null;
  locale: string; busy: boolean; error: string | null; onClose: () => void; onSubmit: (draft: UnifiedFormDraft) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const T = (key: string) => unifiedForwardText(locale, key);
  const patch = (values: Partial<UnifiedFormDraft>) => setDraft((current) => ({ ...current, ...values }));
  const currentNodes = [...nodes];
  if (existing) {
    for (const [id, fact, role] of [[existing.ingress_node_id, existing.ingress_node, "ingress"], [existing.egress_node_id, existing.egress_node, "egress"]] as const) {
      if (id && !currentNodes.some((node) => node.id === id)) currentNodes.push({ id, node_id: fact?.node_id ?? `#${id}`, role } as UserNode);
    }
  }
  const ingress = currentNodes.find((node) => String(node.id) === draft.ingress);
  const egress = currentNodes.find((node) => String(node.id) === draft.egress);
  const block = forwardCombinationBlock(capabilities, draft.path, draft.transport, draft.protocol, ingress, egress, existing);
  const ingressNodes = currentNodes.filter((node) => node.role === "ingress" || node.role === "both");
  const egressNodes = currentNodes.filter((node) => (node.role === "egress" || node.role === "both") && String(node.id) !== draft.ingress);
  return <Dialog open onOpenChange={(value) => { if (!value && !busy) onClose(); }}><DialogContent className="max-w-2xl" aria-busy={busy}>
    <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{existing ? T("interruption") : T("formHint")}</DialogDescription></DialogHeader>
    <form onSubmit={(event) => { event.preventDefault(); if (!busy && !block) onSubmit(draft); }} className="grid gap-4 sm:grid-cols-2">
      <div className="col-span-full"><Field label={T("name")}><Input aria-label={T("name")} required maxLength={128} value={draft.name} onChange={(event) => patch({ name: event.target.value })} /></Field></div>
      <Field label={T("path")}><NativeSelect label={T("path")} value={draft.path} onChange={(value) => patch({ path: value as ForwardPath, ...(value === "direct" ? { egress: "", transport: "native_plain" as const } : {}) })}>
        <option value="direct">{T("direct")}</option><option value="relay">{T("relay")}</option>
      </NativeSelect></Field>
      <Field label={T("transport")}><NativeSelect label={T("transport")} value={draft.transport} onChange={(value) => patch({ transport: value as ForwardTransport })}>
        <option value="native_plain">{T("native_plain")}</option><option value="tst_v1" disabled={draft.path !== "relay" || (capabilities?.tst_enabled !== true && existing?.transport !== "tst_v1")}>{T("tst_v1")}</option>
      </NativeSelect></Field>
      <p className="col-span-full text-xs text-[var(--muted-foreground)]">{draft.transport === "tst_v1" ? T("tstNote") : T("nativeNote")}</p>
      {draft.path === "relay" && capabilities?.tst_enabled !== true ? <p className="col-span-full text-xs text-[var(--muted-foreground)]">{T("tst_not_enabled")}</p> : null}
      <Field label={T("protocol")}><NativeSelect label={T("protocol")} value={draft.protocol} onChange={(value) => patch({ protocol: value as BusinessProtocol })}>
        <option value="tcp">TCP</option><option value="udp">UDP</option><option value="both">TCP + UDP</option>
      </NativeSelect></Field>
      <Field label={T("listen")}><Input aria-label={T("listen")} type="number" min={1} max={65535} placeholder={T("autoPort")} value={draft.listen} onChange={(event) => patch({ listen: event.target.value })} /></Field>
      <Field label={T("ingress")}><NativeSelect label={T("ingress")} required value={draft.ingress} onChange={(value) => patch({ ingress: value, egress: "" })}>
        <option value="">{T("choose")}</option>{ingressNodes.map((node) => <option key={node.id} value={String(node.id)}>{node.node_id}</option>)}
      </NativeSelect></Field>
      {draft.path === "relay" ? <Field label={T("egress")}><NativeSelect label={T("egress")} required value={draft.egress} onChange={(value) => patch({ egress: value })}>
        <option value="">{T("choose")}</option>{egressNodes.map((node) => <option key={node.id} value={String(node.id)}>{node.node_id}</option>)}
      </NativeSelect></Field> : null}
      <Field label={T("targetHost")}><Input aria-label={T("targetHost")} required maxLength={253} value={draft.host} onChange={(event) => patch({ host: event.target.value })} /></Field>
      <Field label={T("targetPort")}><Input aria-label={T("targetPort")} required type="number" min={1} max={65535} value={draft.port} onChange={(event) => patch({ port: event.target.value })} /></Field>
      <section aria-label={T("preview")} className="col-span-full rounded-md border border-[var(--border)] bg-[var(--muted)]/30 p-3">
        <p className="mb-2 text-xs font-medium">{T("preview")}</p><ol className="flex flex-wrap items-center gap-2 text-xs">
          {[T("client"), ingress?.node_id ?? T("ingress"), ...(draft.path === "relay" ? [T(draft.transport), egress?.node_id ?? T("egress")] : []), draft.host ? `${draft.host}:${draft.port || "?"}` : T("target")].map((label, index) => <li key={index} className="flex min-w-0 items-center gap-2">{index ? <span aria-hidden="true">→</span> : null}<span className="max-w-48 break-all rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1">{label}</span></li>)}
        </ol>
      </section>
      <ForwardPolicyFields draft={draft} onChange={patch} locale={locale} transport={draft.transport} />
      {block ? <p role="alert" className="col-span-full text-sm text-[var(--destructive)]">{T(block)}</p> : null}
      {error ? <p role="alert" className="col-span-full text-sm text-[var(--destructive)]">{error}</p> : null}
      <DialogFooter className="col-span-full"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{T("cancel")}</Button><Button type="submit" disabled={busy || !!block}>{busy ? T("loading") : existing ? T("save") : T("create")}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
export function NativeSelect({ label, value, onChange, children, required = false, testId }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode; required?: boolean; testId?: string }) {
  return <select data-testid={testId} aria-label={label} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="flex h-9 w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--ring)]">{children}</select>;
}
