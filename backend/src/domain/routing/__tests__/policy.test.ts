import { expect, test } from "bun:test";
import { RoutingPolicyInputSchema, decideRoutingPolicy, initialRoutingPolicyState, type CandidateEvidence } from "../policy.ts";
const base = new Date("2026-10-11T10:00:00Z");
function policy() { return RoutingPolicyInputSchema.parse({ schema_version: 1, expected_policy_version: 0,
  intent: { schema_version: 1, forward_id: 4, expected_revision: 1, topology_digest: "a".repeat(64), strategy: "priority", hop_limit: 3,
    candidates: [{ id: "a", edge_ids: ["binding:1"], priority: 0, weight: 1 },
      { id: "b", edge_ids: ["binding:2", "binding:3"], priority: 1, weight: 3 }] },
  enabled: true, auto_failover: true, auto_failback: true, failure_threshold: 2, recovery_threshold: 2,
  cooldown_ms: 30_000, max_rtt_ms: 100, max_loss_percent: 20, min_handshake_success_rate: 0.8 }); }
function evidence(round = 1, unhealthy = ""): CandidateEvidence[] { return ["a", "b"].map((id) => ({ id, valid: true, blockers: [],
  observation_id: `${id}-${round}`, observed_at: new Date(base.getTime() + round * 1000).toISOString(),
  expires_at: new Date(base.getTime() + 60_000).toISOString(), state: id === unhealthy ? "unhealthy" : "healthy",
  rtt_ms: 10, loss_percent: id === unhealthy ? 100 : 0, handshake_success_rate: id === unhealthy ? 0 : 1 })); }
const time = (round: number) => new Date(base.getTime() + round * 1000);
test("selection needs independent fresh samples and exposes hysteresis reasons", () => {
  const p = policy(), state = initialRoutingPolicyState("a");
  const first = decideRoutingPolicy(p, state, evidence(1, "a"), time(1), 0);
  expect(first.changed).toBe(false); expect(first.reason).toBe("failure_threshold_pending");
  const replay = decideRoutingPolicy(p, first.next_state, evidence(1, "a"), time(2), 0);
  expect(replay.candidates[0]!.failure_checks).toBe(1); expect(replay.candidates[1]!.healthy_checks).toBe(1);
  const second = decideRoutingPolicy(p, replay.next_state, evidence(2, "a"), time(2), 0);
  expect(second.selected_candidate_id).toBe("b"); expect(second.reason).toBe("current_path_failed");
  expect(second.execution_enabled).toBe(false); expect(second.next_state.current_candidate_id).toBe("a");
});
test("unmeasured, stale, future, invalid and out-of-order samples cannot qualify", () => {
  for (const patch of [{ rtt_ms: null }, { loss_percent: null }, { handshake_success_rate: null }, { valid: false },
    { state: "unknown" as const }, { observed_at: time(5).toISOString() }, { expires_at: time(1).toISOString() }]) {
    const facts = evidence(1).map((f) => ({ ...f, ...patch }));
    const p = policy(); p.recovery_threshold = 1;
    expect(decideRoutingPolicy(p, initialRoutingPolicyState(), facts, time(2), 0).selected_candidate_id).toBeNull();
  }
  const first = decideRoutingPolicy(policy(), initialRoutingPolicyState(), evidence(2), time(2), 0);
  const old = decideRoutingPolicy(policy(), first.next_state, evidence(1), time(3), 0);
  expect(old.candidates.every((c) => c.healthy_checks === 1)).toBe(true);
});
test("weighted choice honors priority and positive weights without changing healthy connections", () => {
  const p = policy(); p.recovery_threshold = 1; p.intent.strategy = "weighted"; p.intent.candidates[1]!.priority = 0;
  const winners = [0, 1, 2, 3].map((ticket) => decideRoutingPolicy(p, initialRoutingPolicyState(), evidence(), time(1), ticket).selected_candidate_id);
  expect(winners).toEqual(["a", "b", "b", "b"]);
  expect(decideRoutingPolicy(p, initialRoutingPolicyState("b"), evidence(), time(1), 0).selected_candidate_id).toBe("b");
  p.intent.candidates[1]!.priority = 1;
  expect(decideRoutingPolicy(p, initialRoutingPolicyState(), evidence(), time(1), 3).selected_candidate_id).toBe("a");
});
test("cooldown and opt-out prevent moves; failed alternatives never become fallback health", () => {
  const p = policy(); p.failure_threshold = 1; p.recovery_threshold = 1;
  for (const switchKind of ["policy", "failover", "cooldown"] as const) {
    const q = structuredClone(p), s = initialRoutingPolicyState("a");
    if (switchKind === "policy") q.enabled = false;
    if (switchKind === "failover") q.auto_failover = false;
    if (switchKind === "cooldown") s.last_switch_at = base.toISOString();
    const result = decideRoutingPolicy(q, s, evidence(1, "a"), time(1), 0);
    expect(result.changed).toBe(false);
    expect(result.reason).toBe({ policy: "policy_disabled", failover: "auto_failover_disabled", cooldown: "cooldown_active" }[switchKind]);
  }
  const facts = evidence().map((f) => ({ ...f, state: "unhealthy" as const, loss_percent: 100 }));
  expect(decideRoutingPolicy(p, initialRoutingPolicyState("a"), facts, time(1), 0).reason).toBe("no_qualified_path");
});
