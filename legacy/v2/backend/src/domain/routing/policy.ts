import { z } from "zod";
import { RoutingPreviewSchema } from "./model.ts";

export const RoutingPolicyInputSchema = z.object({
  schema_version: z.literal(1), expected_policy_version: z.number().int().min(0).max(2_147_483_646),
  intent: RoutingPreviewSchema, enabled: z.boolean(),
  auto_failover: z.boolean(), auto_failback: z.boolean(),
  failure_threshold: z.number().int().min(1).max(10), recovery_threshold: z.number().int().min(1).max(10),
  cooldown_ms: z.number().int().min(30_000).max(3_600_000),
  max_rtt_ms: z.number().min(1).max(5000), max_loss_percent: z.number().min(0).max(100),
  min_handshake_success_rate: z.number().min(0).max(1),
}).strict();
export type RoutingPolicyInput = z.infer<typeof RoutingPolicyInputSchema>;
export interface CandidateEvidence {
  id: string; valid: boolean; blockers: string[];
  observation_id: string | null; observed_at: string | null; expires_at: string | null;
  state: "healthy" | "unhealthy" | "unknown";
  rtt_ms: number | null; loss_percent: number | null; handshake_success_rate: number | null;
}
const memory = z.object({ observation_id: z.string().nullable(), observed_at: z.string().datetime().nullable(),
  healthy_checks: z.number().int().min(0).max(10), failure_checks: z.number().int().min(0).max(10),
  state: z.enum(["healthy", "unhealthy", "unknown"]) }).strict();
export const RoutingPolicyStateSchema = z.object({
  schema_version: z.literal(1), current_candidate_id: z.string().nullable(), last_switch_at: z.string().datetime().nullable(),
  sequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), candidates: z.record(z.string(), memory),
}).strict();
export type RoutingPolicyState = z.infer<typeof RoutingPolicyStateSchema>;
export const RoutingDecisionReceiptSchema = z.object({ schema_version: z.literal(1), decision_id: z.string().uuid(),
  workspace_id: z.number().int().positive(), forward_id: z.number().int().positive(), policy_version: z.number().int().positive(),
  expected_revision: z.number().int().positive(), applied_revision: z.number().int().positive().nullable(),
  desired_revision: z.number().int().positive().nullable(),
  candidate_id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).nullable(),
  edge_ids: z.array(z.string().regex(/^(binding|link):[1-9][0-9]{0,9}$/)).max(2), node_ids: z.array(z.number().int().positive()).max(3),
  state: z.enum(["held", "pending", "confirmed", "rejected", "failed", "superseded"]), reason: z.string().regex(/^[a-z0-9_]{1,64}$/),
  created_at: z.string().datetime(), confirmed_at: z.string().datetime().nullable(),
}).strict();
export const initialRoutingPolicyState = (current: string | null = null): RoutingPolicyState => ({
  schema_version: 1, current_candidate_id: current, last_switch_at: null, sequence: 0, candidates: {},
});

/** Evidence must come from authorized probes, never from a control-plane Ready.
 * Replaying a sample cannot advance hysteresis. Lower priority numbers win;
 * weighted selection operates only within the best healthy priority tier. */
export function decideRoutingPolicy(policy: RoutingPolicyInput, prior: RoutingPolicyState, evidence: CandidateEvidence[], now: Date, ticket: number) {
  const state = RoutingPolicyStateSchema.parse(prior);
  state.candidates = Object.fromEntries(Object.entries(state.candidates).filter(([id]) => policy.intent.candidates.some((c) => c.id === id)));
  const facts = new Map(evidence.map((e) => [e.id, e]));
  const candidates = policy.intent.candidates.map((candidate) => {
    const fact = facts.get(candidate.id);
    const blockers = new Set(fact?.blockers ?? ["observation_missing"]);
    if (!fact?.valid) blockers.add("candidate_invalid");
    const observed = fact?.observed_at ? Date.parse(fact.observed_at) : NaN;
    const expires = fact?.expires_at ? Date.parse(fact.expires_at) : NaN;
    const fresh = !!fact?.observation_id && Number.isFinite(observed) && Number.isFinite(expires) &&
      observed <= now.getTime() && expires > now.getTime() && expires > observed;
    if (!fresh) blockers.add("observation_stale_or_missing");
    if (fact?.rtt_ms === null) blockers.add("rtt_unmeasured");
    else if (!Number.isFinite(fact?.rtt_ms) || fact!.rtt_ms! > policy.max_rtt_ms || fact!.rtt_ms! < 0) blockers.add("rtt_threshold");
    if (fact?.loss_percent === null) blockers.add("loss_unmeasured");
    else if (!Number.isFinite(fact?.loss_percent) || fact!.loss_percent! > policy.max_loss_percent || fact!.loss_percent! < 0) blockers.add("loss_threshold");
    if (fact?.handshake_success_rate === null) blockers.add("handshake_unmeasured");
    else if (!Number.isFinite(fact?.handshake_success_rate) || fact!.handshake_success_rate! < policy.min_handshake_success_rate || fact!.handshake_success_rate! > 1)
      blockers.add("handshake_threshold");
    const old = state.candidates[candidate.id] ?? { observation_id: null, observed_at: null, healthy_checks: 0, failure_checks: 0, state: "unknown" as const };
    const outOfOrder = old.observed_at !== null && observed < Date.parse(old.observed_at);
    if (outOfOrder) blockers.add("observation_out_of_order");
    const conclusive = fresh && fact?.valid && fact.state !== "unknown";
    const healthy = conclusive && fact?.state === "healthy" && blockers.size === 0;
    // Reject out-of-order evidence as well as repeated UUIDs.
    if (conclusive && fact!.observation_id !== old.observation_id && (old.observed_at === null || observed > Date.parse(old.observed_at))) {
      state.candidates[candidate.id] = { observation_id: fact!.observation_id, observed_at: fact!.observed_at,
        healthy_checks: healthy ? Math.min(10, old.healthy_checks + 1) : 0,
        failure_checks: healthy ? 0 : Math.min(10, old.failure_checks + 1), state: healthy ? "healthy" : "unhealthy" };
    } else if (!conclusive) {
      state.candidates[candidate.id] = { ...old, healthy_checks: 0, failure_checks: 0, state: "unknown" };
    }
    const checks = state.candidates[candidate.id] ?? old;
    return { ...candidate, eligible: !!healthy && !outOfOrder, qualified: !!healthy && !outOfOrder && checks.healthy_checks >= policy.recovery_threshold,
      failed: checks.failure_checks >= policy.failure_threshold && checks.state === "unhealthy",
      healthy_checks: checks.healthy_checks, failure_checks: checks.failure_checks, blockers: [...blockers].sort(),
      observation_id: fact?.observation_id ?? null };
  });
  const current = candidates.find((c) => c.id === state.current_candidate_id);
  let selected = current?.id ?? null;
  let reason = "current_path_held";
  const elapsed = state.last_switch_at ? now.getTime() - Date.parse(state.last_switch_at) : Infinity;
  const cooldown = elapsed < policy.cooldown_ms;
  if (!policy.enabled) reason = "policy_disabled";
  else if (cooldown) reason = "cooldown_active";
  else if (current && !current.eligible && !current.failed) reason = "failure_threshold_pending";
  else if (current && !current.eligible && !policy.auto_failover) reason = "auto_failover_disabled";
  else {
    const eligible = candidates.filter((c) => c.qualified);
    const priority = Math.min(...eligible.map((c) => c.priority));
    const tier = eligible.filter((c) => c.priority === priority).sort((a, b) => a.id.localeCompare(b.id));
    if (!tier.length) reason = "no_qualified_path";
    else if (current?.eligible && (!policy.auto_failback || current.priority <= priority)) reason = "healthy_path_retained";
    else {
      let chosen = tier[0]!;
      if (policy.intent.strategy === "weighted") {
        const total = tier.reduce((sum, c) => sum + c.weight, 0);
        if (!Number.isSafeInteger(ticket) || ticket < 0) throw new TypeError("invalid_routing_ticket");
        let slot = ticket % total;
        for (const c of tier) { if (slot < c.weight) { chosen = c; break; } slot -= c.weight; }
      }
      selected = chosen.id;
      reason = !current ? "initial_qualified_path" : current.eligible ? "preferred_path_recovered" : "current_path_failed";
    }
  }
  // Selection is a proposal; only the fenced executor may mark a switch applied.
  return { schema_version: 1 as const, selected_candidate_id: selected, current_candidate_id: state.current_candidate_id,
    changed: selected !== state.current_candidate_id, reason, cooldown_remaining_ms: cooldown ? Math.ceil(policy.cooldown_ms - elapsed) : 0,
    candidates, next_state: state, execution_enabled: false as const };
}
