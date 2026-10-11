import type { Prisma } from "@prisma/client";
import { canonicalConfigDigest } from "../domain/link/core-contract.ts";
import { RoutingError, previewRoutingPolicy } from "../domain/routing/model.ts";
import { RoutingPolicyInputSchema, RoutingPolicyStateSchema, RoutingDecisionReceiptSchema, decideRoutingPolicy, initialRoutingPolicyState, type RoutingPolicyInput,
  type CandidateEvidence, type RoutingPolicyState } from "../domain/routing/policy.ts";
import type { RoutingTopology } from "../domain/routing/model.ts";
import { readRoutingProbe, defaultRoutingProbeDeps } from "./routing-probe.ts";
import { readRoutingEdgeProbe, defaultRoutingEdgeProbeDeps } from "./routing-edge-probe.ts";
import { randomInt } from "node:crypto";
import { loadRoutingTopology, routingEnabled } from "./routing-topology.ts";
import { routingExecutionEnabled } from "./routing-runtime.ts";

export function routingPoliciesEnabled() { return routingEnabled() && process.env.TUNEX_ROUTING_POLICIES_ENABLED === "true"; }

/** Binds policy to the immutable target authority, not to observation clocks or path health. */
export async function routingAuthority(workspace: number, forward: number, client: Pick<Prisma.TransactionClient, "tunnel">) {
  const row = await client.tunnel.findFirst({ where: { id: forward, workspace_id: workspace, category: "port_forward" },
    select: { id: true, config_revision: true, user_id: true, ingress_node_id: true, egress_node_id: true,
      tunnel_mode: true, forward_protocol: true, link_resource_id: true, federated_egress_peer: true,
      remote_host: true, remote_port: true, egress_pool_id: true,
      egress_pool: { select: { node_id: true, status: true, targets: { orderBy: { id: "asc" }, take: 129,
        select: { id: true, host: true, port: true, weight: true, status: true } } } } } });
  if (!row) throw new RoutingError("forward_not_found", 404);
  if ((row.egress_pool?.targets.length ?? 0) > 128) throw new RoutingError("probe_target_limit_exceeded", 422);
  const { config_revision: revision, user_id: creatorId, ...authority } = row;
  return { revision, creatorId, digest: canonicalConfigDigest({ workspace, ...authority }) };
}

export interface RoutingPolicyDeps {
  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
  authorize(creatorId: number | null): void;
  enabled?: () => boolean;
}

/** Saving intent does not advance Forward revisions, allocate ports, or issue commands. */
export async function saveRoutingPolicy(workspace: number, actor: number, raw: unknown, deps: RoutingPolicyDeps) {
  if (!(deps.enabled ?? routingPoliciesEnabled)()) throw new RoutingError("routing_policies_disabled", 409);
  const input = RoutingPolicyInputSchema.parse(raw);
  return deps.transaction(async (tx) => {
    // Serialize with business edits/deletion before validating graph and authority.
    await tx.$queryRaw`SELECT id FROM tunnel WHERE id = ${input.intent.forward_id} AND workspace_id = ${workspace} FOR UPDATE`;
    const authority = await routingAuthority(workspace, input.intent.forward_id, tx);
    deps.authorize(authority.creatorId);
    if (authority.revision !== input.intent.expected_revision) throw new RoutingError("revision_conflict", 409);
    const graph = await loadRoutingTopology(workspace, tx);
    const preview = previewRoutingPolicy(graph, input.intent);
    if (!preview.valid) throw new RoutingError("policy_candidates_invalid", 422);
    const previous = await tx.routingPolicy.findFirst({ where: { workspace_id: workspace, forward_id: input.intent.forward_id } });
    if ((previous?.version ?? 0) !== input.expected_policy_version) throw new RoutingError("policy_version_conflict", 409);
    const current = preview.candidates.find((c) => JSON.stringify(c.edge_ids) === JSON.stringify(graph.forwards.find((f) => f.id === input.intent.forward_id)!.current_edge_ids));
    const data = { created_by_id: actor, forward_revision: authority.revision!, authority_digest: authority.digest,
      enabled: input.enabled, intent: input as unknown as Prisma.InputJsonValue,
      controller_state: initialRoutingPolicyState(current?.id ?? null) as unknown as Prisma.InputJsonValue,
      last_decision: (await import("@prisma/client")).Prisma.DbNull, state_version: 0 };
    const saved = previous ? await tx.routingPolicy.update({ where: { id: previous.id }, data: { ...data, version: { increment: 1 } } })
      : await tx.routingPolicy.create({ data: { ...data, workspace_id: workspace, forward_id: input.intent.forward_id } });
    return policyView(saved);
  });
}

export function policyView(row: { version: number; forward_revision: number; intent: unknown; controller_state: unknown; last_decision: unknown }) {
  const intent: RoutingPolicyInput = RoutingPolicyInputSchema.parse(row.intent);
  return { schema_version: 1, version: row.version, forward_revision: row.forward_revision,
    policy: intent, controller_state: RoutingPolicyStateSchema.parse(row.controller_state),
    last_decision: RoutingDecisionReceiptSchema.safeParse(row.last_decision).data ?? null, execution_enabled: routingExecutionEnabled() };
}

export async function readRoutingPolicy(workspace: number, forward: number) {
  if (!routingPoliciesEnabled()) throw new RoutingError("routing_policies_disabled", 409);
  const { db } = await import("../db.ts");
  return db.$transaction(async (tx) => {
    const authority = await routingAuthority(workspace, forward, tx);
    const row = await tx.routingPolicy.findFirst({ where: { workspace_id: workspace, forward_id: forward } });
    return row ? { ...policyView(row), authority_current: row.authority_digest === authority.digest,
      revision_current: row.forward_revision === authority.revision } : null;
  }, { isolationLevel: "RepeatableRead" });
}

export async function defaultRoutingPolicyDeps(authorize: RoutingPolicyDeps["authorize"]): Promise<RoutingPolicyDeps> {
  const { db } = await import("../db.ts");
  return { authorize, transaction: (work) => db.$transaction(work, { isolationLevel: "RepeatableRead" }) };
}

export async function routingCandidateEvidence(workspace: number, policy: RoutingPolicyInput, graph: RoutingTopology, now = new Date()): Promise<CandidateEvidence[]> {
  const forward = graph.forwards.find((f) => f.id === policy.intent.forward_id);
  if (!forward?.revision) throw new RoutingError("forward_topology_unavailable", 409);
  const preview = previewRoutingPolicy(graph, { ...policy.intent, expected_revision: forward.revision, topology_digest: graph.digest });
  const probeDeps = await defaultRoutingProbeDeps(), edgeDeps = await defaultRoutingEdgeProbeDeps();
  const target = await readRoutingProbe(workspace, forward.id, probeDeps).catch(() => ({ state: "unknown", observation: null }));
  const edges = new Map<string, Awaited<ReturnType<typeof readRoutingEdgeProbe>>>();
  for (const edgeId of new Set(policy.intent.candidates.flatMap((c) => c.edge_ids))) {
    edges.set(edgeId, await readRoutingEdgeProbe(workspace, edgeId, edgeDeps).catch(() => ({ state: "unknown", observation: null })));
  }
  return preview.candidates.map((candidate): CandidateEvidence => {
    const blockers = [...candidate.reasons, ...candidate.admission_issues.filter((i) => i !== "multi_hop_execution_unavailable")];
    if (target.state !== "reachable") blockers.push(`target_${target.state}`);
    const samples = candidate.edge_ids.map((id) => edges.get(id)!);
    if (!samples.length) blockers.push("carrier_quality_unmeasured");
    if (samples.some((s) => s.state === "unknown" || s.state === "stale")) blockers.push("carrier_observation_missing");
    // A measured failed edge proves path failure even if a later node cannot probe.
    // Unknown edges alone never prove failure.
    const measuredFailure = samples.some((s) => s.state === "unreachable");
    const measured = measuredFailure || samples.length > 0 && samples.every((s) => s.state === "reachable" || s.state === "unreachable");
    const observations = samples.flatMap((s) => (s.state === "reachable" || s.state === "unreachable") && s.observation ? [s.observation] : []);
    const starts = observations.map((o) => Date.parse(o.started_at)), expiry = observations.map((o) => Date.parse(o.expires_at));
    if (target.observation) expiry.push(Date.parse(target.observation.expires_at));
    const rate = target.state === "reachable" ? target.observation?.tcp_connect_success_rate ?? null : null;
    return { id: candidate.id, valid: candidate.valid, blockers,
      observation_id: measured && target.observation ? canonicalConfigDigest(observations.map((o) => o.observation_id)) : null,
      observed_at: measured ? new Date(Math.min(...starts)).toISOString() : null,
      expires_at: measured ? new Date(Math.min(...expiry)).toISOString() : null,
      state: !measured || target.state !== "reachable" ? "unknown" : !measuredFailure && samples.every((s) => s.state === "reachable") && !blockers.length ? "healthy" : "unhealthy",
      rtt_ms: measured && observations.every((o) => o.rtt_ms !== null) ? observations.reduce((sum, o) => sum + o.rtt_ms!, 0) : null,
      loss_percent: measured ? Math.max(...observations.map((o) => o.loss_percent!)) : null, handshake_success_rate: rate };
  });
}

/** Read-only proposal. Controller memory is written exclusively by the worker. */
export async function evaluateRoutingPolicy(workspace: number, forward: number) {
  if (!routingPoliciesEnabled()) throw new RoutingError("routing_policies_disabled", 409);
  const { db } = await import("../db.ts");
  const row = await db.routingPolicy.findFirst({ where: { workspace_id: workspace, forward_id: forward } });
  const authority = await routingAuthority(workspace, forward, db);
  if (!row) throw new RoutingError("policy_not_found", 404);
  if (row.authority_digest !== authority.digest || row.forward_revision !== authority.revision) throw new RoutingError("policy_authority_changed", 409);
  const policy = RoutingPolicyInputSchema.parse(row.intent), graph = await loadRoutingTopology(workspace);
  const state = RoutingPolicyStateSchema.parse(row.controller_state);
  return { ...decideRoutingPolicy(policy, state, await routingCandidateEvidence(workspace, policy, graph), new Date(), randomInt(16000)),
    policy_version: row.version, forward_revision: row.forward_revision,
    metric_basis: { rtt: "sum_of_per_edge_icmp_rtt", loss: "worst_per_edge_icmp_response_loss", handshake: "configured_target_tcp_connect" } };
}
