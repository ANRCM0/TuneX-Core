"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routingApi, type RouteCandidate, type RouteCapabilities, type RouteDecision, type RouteGraph, type RoutePolicy, type RoutePolicyInput, type RoutePreview, type RouteReceipt } from "@/lib/api/routing";
import { ApiError } from "@/lib/api/core";
import { routePathLabel, routingChoices, routingDefaults, routingIntent } from "./forward-routing-model";

function errorCode(error: unknown) {
  const data = error instanceof ApiError ? error.data : null;
  const code = data && typeof data === "object" && "code" in data ? data.code : null;
  return typeof code === "string" && /^[a-z0-9_]{1,64}$/.test(code) ? code : "routing_unavailable";
}
type Snapshot = { caps: RouteCapabilities; graph: RouteGraph | null; policy: RoutePolicy | null; history: RouteReceipt[]; decision: RouteDecision | null; decisionError: string | null };

export function ForwardRoutingCard({ forwardId, workspaceId, locale, canUpdate }: {
  forwardId: number; workspaceId: number; locale: string; canUpdate: boolean;
}) {
  const en = locale === "en", t = (zh: string, english: string) => en ? english : zh;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<RoutePolicyInput | null>(null);
  const [preview, setPreview] = useState<RoutePreview | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const current = new AbortController(); controller.current = current;
    setSnapshot(null); setDraft(null); setPreview(null); setError(null); setNotice(null); setBusy(true);
    const api = routingApi(workspaceId, current.signal);
    void (async () => {
      const caps = await api.capabilities();
      let graph: RouteGraph | null = null, policy: RoutePolicy | null = null, history: RouteReceipt[] = [], decision: RouteDecision | null = null, decisionError: string | null = null;
      if (caps.enabled) {
        [graph, policy, history] = await Promise.all([api.topology(), caps.features.policy_storage ? api.policy(forwardId) : null, caps.features.policy_storage ? api.history(forwardId) : []]);
        if (policy) {
          try { decision = await api.decision(forwardId); } catch (failure) { decisionError = errorCode(failure); }
        }
      }
      if (current.signal.aborted) return;
      setSnapshot({ caps, graph, policy, history, decision, decisionError });
      if (policy) setDraft({ ...policy.policy, expected_policy_version: policy.version });
      else if (graph) {
        const choices = routingChoices(graph, forwardId);
        if (choices.length) setDraft(routingDefaults(routingIntent(graph, forwardId, "priority", [choices[0]])));
      }
    })().catch((failure) => { if (!current.signal.aborted) setError(errorCode(failure)); })
      .finally(() => { if (!current.signal.aborted) setBusy(false); });
    return () => current.abort();
  }, [forwardId, workspaceId, generation]);

  const graph = snapshot?.graph, choices = graph ? routingChoices(graph, forwardId) : [];
  const stale = snapshot?.policy && (!snapshot.policy.authority_current || !snapshot.policy.revision_current);
  function update(patch: Partial<RoutePolicyInput>) { setDraft((value) => value ? { ...value, ...patch } : value); setPreview(null); setNotice(null); }
  function candidateUpdate(id: string, patch: Partial<RouteCandidate>) {
    if (draft) update({ intent: { ...draft.intent, candidates: draft.intent.candidates.map((c) => c.id === id ? { ...c, ...patch } : c) } });
  }
  async function act(action: "preview" | "save" | "probe") {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted || !graph || !draft) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const api = routingApi(workspaceId, signal);
      const intent = routingIntent(graph, forwardId, draft.intent.strategy, draft.intent.candidates);
      if (action === "preview") { const value = await api.preview(intent); if (!signal.aborted) setPreview(value); }
      else if (action === "probe") {
        await api.probe(forwardId, intent.expected_revision);
        if (!signal.aborted) setNotice(t("目标探测已完成，刷新可查看最新策略解释。", "Target probe completed. Refresh to read the latest decision."));
      } else {
        // The preview is bound to the current draft; a failed preview never saves.
        if (!preview?.valid) throw new Error("preview_required");
        const value = await api.save(forwardId, { ...draft, intent });
        if (!signal.aborted) {
          setSnapshot((state) => state ? { ...state, policy: { ...value, authority_current: true, revision_current: true } } : state);
          setDraft({ ...value.policy, expected_policy_version: value.version }); setPreview(null);
          setNotice(t("策略已保存；节点确认实际版本后才算切换完成。", "Policy saved. A switch completes only after nodes confirm the actual revision."));
        }
      }
    } catch (failure) { if (!signal.aborted) setError(failure instanceof Error && failure.message === "routing_candidates_required" ? "routing_candidates_required" : errorCode(failure)); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  return <section className="space-y-4" data-testid="forward-routing-card">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{t("候选路径与自动切换", "Candidate paths and failover")}</h3>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setGeneration((value) => value + 1)}>{t("刷新", "Refresh")}</Button></div>
    {busy ? <p role="status">{t("正在读取或验证路由…", "Loading or validating routes…")}</p> : null}
    {error ? <p role="alert" className="break-all text-sm text-[var(--destructive)]">{t("路由请求失败：", "Routing request failed: ")}{error}</p> : null}
    {notice ? <p role="status" className="text-sm">{notice}</p> : null}
    {snapshot && !snapshot.caps.enabled ? <p>{t("平台尚未启用高级路由。", "Advanced routing is disabled by the platform.")}</p> : null}
    {snapshot?.caps.enabled ? <>
      <p className="text-xs text-[var(--muted-foreground)]">{snapshot.caps.features.path_selection
        ? t("自动执行支持本空间的原生 TCP 中转，两或三个节点。旧 TCP 连接中断后需重连；UDP 路径不自动迁移。", "Automatic execution supports Native TCP relay with two or three nodes in this workspace. Interrupted TCP sessions require reconnecting; UDP paths are not migrated.")
        : t("平台未开启自动执行。保存和预览策略不会切换业务路径。", "Automatic execution is disabled. Saving or previewing a policy does not switch the business path.")}</p>
      {stale ? <p role="alert" className="text-sm">{t("转发或目标授权已变化，请核对候选并重新预览保存。", "Forward or target authority changed. Review candidates, preview and save again.")}</p> : null}
      {draft && graph ? <>
        <fieldset disabled={busy || !canUpdate} className="space-y-3">
          <label className="block space-y-1 text-sm"><span>{t("选择方式", "Selection strategy")}</span><select className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2" value={draft.intent.strategy}
            onChange={(event) => update({ intent: { ...draft.intent, strategy: event.target.value as "priority" | "weighted" } })}>
            <option value="priority">{t("优先级", "Priority")}</option><option value="weighted">{t("同级候选加权", "Weighted candidates at the same priority")}</option></select></label>
          <p className="text-xs text-[var(--muted-foreground)]">{t("优先级数值越小越优先；权重用于选择同级健康候选。每条转发同时使用一条路径。", "Lower priorities win. Weights choose among healthy candidates at the same priority. Each Forward uses one path at a time.")}</p>
          {choices.map((choice) => {
            const selected = draft.intent.candidates.find((c) => c.edge_ids.join(",") === choice.edge_ids.join(","));
            return <div key={choice.id} className="space-y-2 rounded-md border border-[var(--border)] p-3">
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={!!selected} onChange={(event) => {
                const candidates = event.target.checked ? [...draft.intent.candidates, { ...choice, id: `candidate_${choice.id}` }]
                  : draft.intent.candidates.filter((c) => c.id !== selected?.id);
                update({ intent: { ...draft.intent, candidates } });
              }} /><span className="min-w-0 break-words">{routePathLabel(graph, choice)}</span></label>
              {selected ? <div className="grid grid-cols-2 gap-3">
                <NumberField label={t("优先级", "Priority")} value={selected.priority} min={0} max={65535} onChange={(priority) => candidateUpdate(selected.id, { priority })} />
                <NumberField label={t("权重", "Weight")} value={selected.weight} min={1} max={1000} onChange={(weight) => candidateUpdate(selected.id, { weight })} />
              </div> : null}
            </div>;
          })}
          {draft.intent.candidates.filter((c) => !choices.some((choice) => choice.edge_ids.join(",") === c.edge_ids.join(","))).map((c) => <div key={c.id} className="text-sm" role="alert">
            {t("已保存候选当前不可用：", "Saved candidate unavailable: ")}{c.id}
            <Button size="sm" variant="outline" onClick={() => update({ intent: { ...draft.intent, candidates: draft.intent.candidates.filter((candidate) => candidate.id !== c.id) } })}>{t("移除", "Remove")}</Button>
          </div>)}
          <div className="flex flex-wrap gap-4 text-sm">{(["enabled", "auto_failover", "auto_failback"] as const).map((key) => <label key={key} className="flex items-center gap-2">
            <input type="checkbox" checked={draft[key]} onChange={(event) => update({ [key]: event.target.checked })} />
            {key === "enabled" ? t("启用策略", "Enable policy") : key === "auto_failover" ? t("自动故障切换", "Automatic failover") : t("自动回切", "Automatic failback")}</label>)}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label={t("连续失败次数", "Consecutive failures")} value={draft.failure_threshold} min={1} max={10} onChange={(failure_threshold) => update({ failure_threshold })} />
            <NumberField label={t("连续恢复次数", "Consecutive recoveries")} value={draft.recovery_threshold} min={1} max={10} onChange={(recovery_threshold) => update({ recovery_threshold })} />
            <NumberField label={t("冷却时间（秒）", "Cooldown (seconds)")} value={draft.cooldown_ms / 1000} min={30} max={3600} onChange={(seconds) => update({ cooldown_ms: seconds * 1000 })} />
            <NumberField label={t("最大逐边 RTT 合计（ms）", "Maximum sum of edge RTT (ms)")} value={draft.max_rtt_ms} min={1} max={5000} onChange={(max_rtt_ms) => update({ max_rtt_ms })} />
            <NumberField label={t("最大逐边 ICMP 丢包（%）", "Maximum per-edge ICMP loss (%)")} value={draft.max_loss_percent} min={0} max={100} onChange={(max_loss_percent) => update({ max_loss_percent })} />
            <NumberField label={t("目标 TCP 建连成功率（%）", "Target TCP connection success (%)")} value={draft.min_handshake_success_rate * 100} min={0} max={100} onChange={(percent) => update({ min_handshake_success_rate: percent / 100 })} />
          </div>
        </fieldset>
        {!canUpdate ? <p className="text-sm">{t("当前角色只能查看路由。", "Your role can only view routing.")}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy || !canUpdate || !draft.intent.candidates.length} onClick={() => void act("preview")}>{t("预览候选", "Preview candidates")}</Button>
          <Button size="sm" disabled={busy || !canUpdate || !snapshot.caps.features.policy_storage || !preview?.valid} onClick={() => void act("save")}>{t("保存策略", "Save policy")}</Button>
          <Button size="sm" variant="outline" disabled={busy || !canUpdate || !snapshot.caps.features.active_probes} onClick={() => void act("probe")}>{t("探测授权目标", "Probe authorized target")}</Button>
        </div>
        {preview ? <div role="status" className="space-y-2 text-sm"><p>{preview.valid ? t("路径结构校验通过；健康和实际切换仍需确认。", "Path structure validated; health and actual switching still need confirmation.") : t("候选路径未通过校验。", "Candidate paths failed validation.")}</p>
          {preview.candidates.map((c) => <p key={c.id} className="break-words">{c.id}: {c.node_ids.join(" → ")} · {[...c.reasons, ...c.admission_issues].join(", ") || t("结构有效", "Valid structure")}</p>)}</div> : null}
      </> : <p>{t("当前没有可配置的已授权候选路径。", "No authorized candidate paths are available for this Forward.")}</p>}
      {snapshot.decisionError ? <p role="alert" className="text-sm">{t("当前选路解释不可用：", "Current decision unavailable: ")}{snapshot.decisionError}</p> : null}
      {snapshot.decision ? <div className="space-y-2 text-sm"><h4 className="font-medium">{t("当前策略解释", "Current policy explanation")}</h4>
        <p>{snapshot.decision.reason} · {t("冷却剩余", "Cooldown remaining")} {Math.ceil(snapshot.decision.cooldown_remaining_ms / 1000)}s</p>
        {snapshot.decision.candidates.map((c) => <p key={c.id} className="break-words">{c.id}: {c.qualified ? t("满足阈值", "Qualified") : c.blockers.join(", ")} · {c.healthy_checks}/{c.failure_checks}</p>)}</div> : null}
      <RouteHistory history={snapshot.history} locale={locale} />
    </> : null}
  </section>;
}
function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="block space-y-1 text-sm"><span>{label}</span><Input type="number" min={min} max={max} step={1} value={value} onChange={(event) => {
    const number = event.target.valueAsNumber; if (Number.isFinite(number)) onChange(number);
  }} /></label>;
}
export function RouteHistory({ history, locale }: { history: RouteReceipt[]; locale: string }) {
  const en = locale === "en";
  return <section className="space-y-2 text-sm" data-testid="routing-history"><h4 className="font-medium">{en ? "Actual route history" : "实际选路历史"}</h4>
    {!history.length ? <p>{en ? "No routing execution records. This does not confirm a route." : "暂无选路执行记录；这不代表路径已确认。"}</p> : history.map((row) => <div key={row.decision_id} className="space-y-1 rounded-md border border-[var(--border)] p-3">
      <p className="break-words">{row.candidate_id ?? "—"} · {row.state} · {row.reason}</p><p>{row.node_ids.join(" → ") || "—"}</p>
      <p>{en ? "Expected / desired / applied revision" : "预期 / 期望 / 实际版本"}: {row.expected_revision} / {row.desired_revision ?? "?"} / {row.applied_revision ?? "?"}</p>
      <time dateTime={row.confirmed_at ?? row.created_at}>{new Date(row.confirmed_at ?? row.created_at).toLocaleString(en ? "en-US" : "zh-CN")}</time>
    </div>)}
  </section>;
}
