import { Prisma } from "@prisma/client";
import { randomInt, randomUUID } from "node:crypto";
import { db } from "../db.ts";
import { RoutingError, previewRoutingPolicy } from "../domain/routing/model.ts";
import { RoutingPolicyInputSchema, RoutingPolicyStateSchema, RoutingDecisionReceiptSchema, decideRoutingPolicy } from "../domain/routing/policy.ts";
import { routingAuthority, routingCandidateEvidence, routingPoliciesEnabled } from "./routing-policy.ts";
import { loadRoutingTopology } from "./routing-topology.ts";
import { routingProbesEnabled, collectRoutingProbe, readRoutingProbe, defaultRoutingProbeDeps } from "./routing-probe.ts";
import { collectRoutingEdgeProbe, readRoutingEdgeProbe, defaultRoutingEdgeProbeDeps } from "./routing-edge-probe.ts";
import { canWorkspaceResourceAction, resolveWorkspaceActorMembership } from "./workspace.ts";
import { ACTIVE_ROLLOUT_PHASES } from "./forward-rollout.ts";
import { assertRoutingHopCapabilities, prepareRoutingRuntime, routingExecutionEnabled } from "./routing-runtime.ts";
export { routingExecutionEnabled } from "./routing-runtime.ts";

export function routingMultiHopEnabled() { return routingExecutionEnabled() && process.env.TUNEX_ROUTING_MULTIHOP_ENABLED === "true"; }

async function authorizeActor(tx: Prisma.TransactionClient, workspace: number, actor: number, creator: number | null) {
  const user = await tx.user.findUnique({ where: { id: actor }, select: { status: true } });
  if (user?.status !== "active") throw new RoutingError("routing_actor_revoked", 403);
  let access;
  try { access = await resolveWorkspaceActorMembership(actor, workspace, tx); }
  catch { throw new RoutingError("routing_actor_revoked", 403); }
  if (!canWorkspaceResourceAction(access, "update", "forward", creator === actor) || !canWorkspaceResourceAction(access, "use", "node"))
    throw new RoutingError("routing_actor_revoked", 403);
}

type PolicyRow = Awaited<ReturnType<typeof db.routingPolicy.findUniqueOrThrow>>;
async function lockedPolicy(tx: Prisma.TransactionClient, row: PolicyRow, allowPending = false) {
  // Same lock order as policy save and desired Forward writes.
  await tx.$queryRaw`SELECT id FROM tunnel WHERE id = ${row.forward_id} AND workspace_id = ${row.workspace_id} FOR UPDATE`;
  const current = await tx.routingPolicy.findFirst({ where: { id: row.id, workspace_id: row.workspace_id, version: row.version, state_version: row.state_version } });
  if (!current || (!allowPending && !current.enabled)) throw new RoutingError("policy_version_conflict", 409);
  return current;
}
async function writeReceipt(tx: Prisma.TransactionClient, row: PolicyRow, receipt: unknown) {
  const parsed = RoutingDecisionReceiptSchema.parse(receipt);
  await tx.routingDecision.upsert({ where: { id: parsed.decision_id },
    create: { id: parsed.decision_id, policy_id: row.id, workspace_id: row.workspace_id, forward_id: row.forward_id,
      policy_version: row.version, receipt: parsed as unknown as Prisma.InputJsonValue }, update: { receipt: parsed as unknown as Prisma.InputJsonValue } });
  return parsed;
}

/** Restart-safe: only exact applied revision + active apply state confirms a route. */
async function settlePending(row: PolicyRow) {
  const pending = RoutingDecisionReceiptSchema.safeParse(row.last_decision).data;
  if (pending?.state !== "pending" || !pending.desired_revision) return false;
  await db.$transaction(async (tx) => {
    const current = await lockedPolicy(tx, row, true);
    const forward = await tx.tunnel.findFirst({ where: { id: row.forward_id, workspace_id: row.workspace_id },
      select: { config_revision: true, applied_revision: true, apply_status: true, desired_status: true } });
    if (!forward) return;
    const confirmed = forward.config_revision === pending.desired_revision && forward.applied_revision === pending.desired_revision &&
      forward.apply_status === "active" && forward.desired_status === "active";
    const superseded = forward.config_revision !== pending.desired_revision;
    const failed = forward.apply_status === "error";
    if (!confirmed && !superseded && !failed) return;
    const now = new Date().toISOString(), state = RoutingPolicyStateSchema.parse(current.controller_state);
    if (confirmed) { state.current_candidate_id = pending.candidate_id; state.last_switch_at = now; }
    state.sequence++;
    const receipt = await writeReceipt(tx, row, { ...pending, state: confirmed ? "confirmed" : superseded ? "superseded" : "failed",
      reason: confirmed ? "agent_revision_confirmed" : superseded ? "desired_revision_superseded" : "rollout_failed",
      applied_revision: forward.applied_revision, confirmed_at: confirmed ? now : null });
    await tx.routingPolicy.update({ where: { id: row.id }, data: { controller_state: state as unknown as Prisma.InputJsonValue,
      state_version: { increment: 1 }, last_decision: receipt as unknown as Prisma.InputJsonValue } });
  }, { isolationLevel: "ReadCommitted" });
  return true;
}

export async function executeRoutingPolicy(row: PolicyRow) {
  if (await settlePending(row)) return "pending_settled";
  if (!routingExecutionEnabled() || !row.enabled) return "execution_disabled";
  const input = RoutingPolicyInputSchema.parse(row.intent), prior = RoutingPolicyStateSchema.parse(row.controller_state);
  const graph = await loadRoutingTopology(row.workspace_id), forward = graph.forwards.find((f) => f.id === row.forward_id);
  if (!forward || forward.revision !== row.forward_revision) return "policy_revision_changed";
  const preview = previewRoutingPolicy(graph, { ...input.intent, topology_digest: graph.digest, expected_revision: row.forward_revision });
  const decision = decideRoutingPolicy(input, prior, await routingCandidateEvidence(row.workspace_id, input, graph), new Date(), randomInt(16000));
  const selected = preview.candidates.find((c) => c.id === decision.selected_candidate_id);
  const tunnel = await db.tunnel.findFirst({ where: { id: row.forward_id, workspace_id: row.workspace_id },
    select: { applied_revision: true, config_revision: true, apply_status: true, desired_status: true, routing_security_version: true } });
  if (!tunnel || tunnel.config_revision !== row.forward_revision || tunnel.applied_revision !== row.forward_revision ||
      !["active", "error"].includes(tunnel.apply_status ?? "") || tunnel.desired_status !== "active") return "forward_not_confirmed";
  const runtime = await db.routingRuntime.findFirst({ where: { forward_id: row.forward_id, revision: row.forward_revision }, select: { expires_at: true } });
  const protectionRequired = tunnel.routing_security_version !== 1 || !runtime || runtime.expires_at.getTime() - Date.now() < 86_400_000;
  let reason = decision.reason;
  const supported = forward.transport === "native_plain" && forward.protocol === "tcp" && forward.path === "relay";
  const qualified = selected && decision.candidates.find((c) => c.id === selected.id)?.qualified;
  const wantsApply = (decision.changed || protectionRequired) && qualified;
  if (wantsApply && (!supported || !selected || selected.node_ids.length === 3 && !routingMultiHopEnabled()))
    reason = "routing_execution_scope_unsupported";
  const canApply = wantsApply && supported && selected && (selected.node_ids.length === 2 || routingMultiHopEnabled());
  const receipt = RoutingDecisionReceiptSchema.parse({ schema_version: 1, decision_id: randomUUID(), workspace_id: row.workspace_id,
    forward_id: row.forward_id, policy_version: row.version, expected_revision: row.forward_revision, desired_revision: null, applied_revision: tunnel.applied_revision,
    candidate_id: selected?.id ?? null, edge_ids: selected?.edge_ids ?? [], node_ids: selected?.node_ids ?? [],
    state: canApply ? "pending" : "held", reason, created_at: new Date().toISOString(), confirmed_at: null });
  const check = async (tx: Prisma.TransactionClient) => {
    if (!routingExecutionEnabled()) throw new RoutingError("routing_execution_disabled", 409);
    await lockedPolicy(tx, row);
    const currentForward = await tx.tunnel.findUnique({ where: { id: row.forward_id },
      select: { config_revision: true, applied_revision: true, desired_status: true, apply_status: true } });
    if (!currentForward || currentForward.config_revision !== row.forward_revision ||
        currentForward.applied_revision !== row.forward_revision || currentForward.desired_status !== "active" ||
        !["active", "error"].includes(currentForward.apply_status ?? ""))
      throw new RoutingError("forward_not_confirmed", 409);
    if (await tx.forwardRollout.findFirst({ where: { tunnel_id: row.forward_id, phase: { in: [...ACTIVE_ROLLOUT_PHASES] } }, select: { id: true } }))
      throw new RoutingError("routing_rollout_in_progress", 409);
    const authority = await routingAuthority(row.workspace_id, row.forward_id, tx);
    if (authority.digest !== row.authority_digest || authority.revision !== row.forward_revision) throw new RoutingError("policy_authority_changed", 409);
    await authorizeActor(tx, row.workspace_id, row.created_by_id, authority.creatorId);
    const fresh = await loadRoutingTopology(row.workspace_id, tx);
    const checked = previewRoutingPolicy(fresh, { ...input.intent, topology_digest: fresh.digest, expected_revision: row.forward_revision });
    if (canApply && selected) {
      const candidate = checked.candidates.find((c) => c.id === selected.id);
      if (!candidate?.valid || candidate.admission_issues.some((i) => i !== "multi_hop_execution_unavailable") ||
          JSON.stringify(candidate.node_ids) !== JSON.stringify(selected.node_ids) || selected.node_ids.length === 3 && !routingMultiHopEnabled())
        throw new RoutingError("routing_admission_changed", 409);
      const facts = await routingCandidateEvidence(row.workspace_id, input, fresh);
      const rechecked = decideRoutingPolicy(input, prior, facts, new Date(), 0).candidates.find((c) => c.id === selected.id);
      if (!rechecked?.qualified) throw new RoutingError("routing_observation_expired", 409);
      await assertRoutingHopCapabilities(selected.node_ids);
    }
  };
  if (!canApply || !selected) {
    await db.$transaction(async (tx) => {
      await check(tx); decision.next_state.sequence++;
      const previous = RoutingDecisionReceiptSchema.safeParse(row.last_decision).data;
      // Keep the last actual execution trace visible. Read-only /decision gives
      // current hold reasons; repeated idle scans must not erase a confirmed route.
      const stored = previous && (previous.state !== "held" || previous.reason === receipt.reason)
        ? previous : await writeReceipt(tx, row, receipt);
      await tx.routingPolicy.update({ where: { id: row.id }, data: { state_version: { increment: 1 },
        controller_state: decision.next_state as unknown as Prisma.InputJsonValue, last_decision: stored as unknown as Prisma.InputJsonValue } });
    }, { isolationLevel: "ReadCommitted" });
    return reason;
  }
  const prepared = await prepareRoutingRuntime(row.workspace_id, row.forward_id, row.forward_revision + 1, selected.node_ids);
  const { patchForward } = await import("./forward-service.ts");
  const result = await patchForward(row.forward_id, row.workspace_id, { expected_revision: row.forward_revision,
    middle_node_id: selected.node_ids.length === 3 ? selected.node_ids[1] : null }, row.created_by_id, { routing: { check,
    record: async (tx, revision) => {
      if (revision !== prepared.revision) throw new RoutingError("revision_conflict", 409);
      await tx.routingRuntime.create({ data: prepared });
      await tx.tunnel.update({ where: { id: row.forward_id }, data: { routing_security_version: 1 } });
      decision.next_state.sequence++;
      const stored = await writeReceipt(tx, row, { ...receipt, desired_revision: revision });
      await tx.routingPolicy.update({ where: { id: row.id }, data: { forward_revision: revision, state_version: { increment: 1 },
        controller_state: decision.next_state as unknown as Prisma.InputJsonValue, last_decision: stored as unknown as Prisma.InputJsonValue } });
    } } });
  const fresh = await db.routingPolicy.findUnique({ where: { id: row.id } });
  if (fresh) await settlePending(fresh);
  return result.ok ? "route_rollout_registered" : result.code;
}

/** Uses the same authorized, fenced probe budget as manual probes. Unknown never becomes loss. */
async function refreshProbes(row: PolicyRow) {
  const policy = RoutingPolicyInputSchema.parse(row.intent), targetDeps = await defaultRoutingProbeDeps(), edgeDeps = await defaultRoutingEdgeProbeDeps();
  const target = await readRoutingProbe(row.workspace_id, row.forward_id, targetDeps).catch(() => null);
  if (!target?.observation || Date.parse(target.observation.expires_at) - Date.now() < 30_000) {
    await collectRoutingProbe(row.workspace_id, { schema_version: 1, forward_id: row.forward_id, expected_revision: row.forward_revision }, targetDeps).catch(() => {});
  }
  const edges = await Promise.all([...new Set(policy.intent.candidates.flatMap((c) => c.edge_ids))].map(async (id) => {
    const sample = await readRoutingEdgeProbe(row.workspace_id, id, edgeDeps).catch(() => null);
    return { id, expiry: sample?.observation ? Date.parse(sample.observation.expires_at) : 0 };
  }));
  for (const edge of edges.sort((a,b) => a.expiry-b.expiry || a.id.localeCompare(b.id))) {
    if (edge.expiry - Date.now() < 45_000) await collectRoutingEdgeProbe(row.workspace_id, { schema_version: 1, edge_id: edge.id }, edgeDeps).catch(() => {});
  }
}

export async function runRoutingSweep() {
  if (!routingExecutionEnabled()) return { evaluated: 0, execution_enabled: false };
  const rows = await db.routingPolicy.findMany({ where: { enabled: true }, orderBy: { updated_at: "asc" }, take: 33 });
  const results: { forward_id: number; outcome: string }[] = [];
  for (const row of rows.slice(0,32)) {
    try {
      // Revoke authorization before any probe command as well as before desired mutation.
      await db.$transaction(async (tx) => { const authority = await routingAuthority(row.workspace_id,row.forward_id,tx);
        await authorizeActor(tx,row.workspace_id,row.created_by_id,authority.creatorId);
        if (authority.digest !== row.authority_digest) throw new RoutingError("policy_authority_changed",409); });
      if (RoutingDecisionReceiptSchema.safeParse(row.last_decision).data?.state !== "pending") await refreshProbes(row);
      results.push({ forward_id: row.forward_id, outcome: await executeRoutingPolicy(row) });
    } catch (error) {
      results.push({ forward_id: row.forward_id, outcome: error instanceof RoutingError ? error.code : "routing_evaluation_failed" });
    }
  }
  return { evaluated: results.length, execution_enabled: true, truncated: rows.length > 32, results };
}

export async function routingDecisionHistory(workspace: number, forward: number) {
  if (!routingPoliciesEnabled()) throw new RoutingError("routing_policies_disabled",409);
  await routingAuthority(workspace,forward,db);
  const rows = await db.routingDecision.findMany({ where: { workspace_id: workspace, forward_id: forward }, orderBy: { created_at: "desc" }, take: 100 });
  return rows.flatMap((row) => { const receipt = RoutingDecisionReceiptSchema.safeParse(row.receipt).data; return receipt ? [receipt] : []; });
}
