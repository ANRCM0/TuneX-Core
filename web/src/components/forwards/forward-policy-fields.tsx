"use client";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FORWARD_POLICY_FIELDS, FORWARD_POLICY_MAX, TST_POLICY_MAX_CONCURRENCY, forwardPolicyDraftErrors, type ForwardPolicyDraft } from "@/lib/forward-policy";

export function ForwardPolicyFields({ draft, onChange, locale, transport = "native_plain" }: {
  draft: ForwardPolicyDraft; onChange: (patch: ForwardPolicyDraft) => void; locale: string; transport?: string;
}) {
  const chinese = locale.startsWith("zh");
  const labels = chinese ? ["上传速率（bytes/sec）", "下载速率（bytes/sec）", "总并发上限", "每来源 IP 并发上限"]
    : ["Upload (bytes/sec)", "Download (bytes/sec)", "Total concurrency", "Concurrency per source IP"];
  const errors = forwardPolicyDraftErrors(draft);
  if (transport === "tst_v1") for (const key of ["max_connections", "max_connections_per_ip"] as const) {
    if (Number(draft[key] ?? 0) > TST_POLICY_MAX_CONCURRENCY) errors[key] = `0–${TST_POLICY_MAX_CONCURRENCY}`;
  }
  return <div className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-2">
    <p className="col-span-full text-xs text-muted-foreground">{chinese
      ? `策略作用于此转发的业务入口；TCP 计连接，UDP 计活跃映射。${transport === "tst_v1" ? "TST" : "原生"} both 是一条规则，TCP 流与 UDP 映射共享总并发、每来源 IP 并发和双向速率预算，不是两套额度。0 表示不限，仍受 workspace 上限约束。速率最大 2147483647 bytes/sec（约 2 GiB/s）。`
      : `Applies at this Forward's client entrance: TCP connections, UDP active mappings. ${transport === "tst_v1" ? "TST" : "Native"} both is one rule: TCP streams and UDP mappings share total/per-source-IP concurrency and directional rate budgets, not two allowances. 0 means unlimited, subject to workspace ceilings. Maximum rate: 2147483647 bytes/sec (about 2 GiB/s).`}</p>
    {transport === "tst_v1" ? <p className="col-span-full text-xs text-muted-foreground">{chinese ? `TST/1 的 TCP 流与 UDP 映射最多共用 ${TST_POLICY_MAX_CONCURRENCY} 个会话；0 仍受此运行时容量限制。` : `TST/1 supports up to ${TST_POLICY_MAX_CONCURRENCY} shared TCP streams and UDP mappings. A value of 0 remains subject to this runtime capacity.`}</p> : null}
    {FORWARD_POLICY_FIELDS.map((key, index) => <Field key={key} label={labels[index]!} error={errors[key]}>
      <Input aria-label={labels[index]} inputMode="numeric" min={0} max={transport === "tst_v1" && index > 1 ? TST_POLICY_MAX_CONCURRENCY : FORWARD_POLICY_MAX} value={draft[key] ?? "0"}
        aria-invalid={!!errors[key]} data-testid={`forward-${key}`} onChange={(event) => onChange({ [key]: event.target.value })} />
    </Field>)}
  </div>;
}
