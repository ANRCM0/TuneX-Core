import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { canonicalConfigDigest } from "../domain/link/core-contract.ts";
import { LinkEndpointConfigSchema } from "../domain/link/link-maintenance.ts";
import { RoutingError } from "../domain/routing/model.ts";
import { ROUTING_PROBE_LIMITS } from "../domain/routing/probe.ts";
import { capabilityFactsFromStoredV2 } from "./capability-manifest.ts";
import { CONNECTION_ONLINE_WINDOW_MS, deriveConnection } from "./node-lifecycle.ts";
import { firstConnectIp } from "./forward-contract.ts";
import { admitAction } from "./runtime-admission.ts";
import { routingProbesEnabled, type RoutingProbeStore } from "./routing-probe.ts";
import type { AgentDiagnoseResult } from "./agent-command-bus.ts";

export const RoutingEdgeProbeInputSchema = z.object({ schema_version: z.literal(1),
  edge_id: z.string().regex(/^(binding|link):[1-9][0-9]{0,9}$/) }).strict();
export const RoutingEdgeObservationSchema = z.object({ schema_version: z.literal(1), observation_id: z.string().uuid(),
  workspace_id: z.number().int().positive(), edge_id: RoutingEdgeProbeInputSchema.shape.edge_id,
  source_node_id: z.number().int().positive(), peer_node_id: z.number().int().positive(), transport: z.enum(["native_plain", "tst_v1"]),
  method: z.literal("icmp_echo"), scope: z.literal("node_to_node_icmp"), started_at: z.string().datetime(),
  observed_at: z.string().datetime(), expires_at: z.string().datetime(), state: z.enum(["reachable", "unreachable", "unknown"]),
  packets_sent: z.union([z.literal(0), z.literal(5)]), packets_received: z.number().int().min(0).max(5),
  rtt_ms: z.number().min(0).max(2000).nullable(), loss_percent: z.number().min(0).max(100).nullable(),
  handshake_success_rate: z.null(), end_to_end_verified: z.literal(false),
}).strict().superRefine((v, ctx) => {
  const measured = v.packets_sent === 5;
  if (v.packets_received > v.packets_sent || (v.packets_received === 0) !== (v.rtt_ms === null) ||
    v.loss_percent !== (measured ? (5 - v.packets_received) * 20 : null) ||
    v.state !== (!measured ? "unknown" : v.packets_received ? "reachable" : "unreachable"))
    ctx.addIssue({ code: "custom", message: "invalid_icmp_summary" });
});
export type RoutingEdgeObservation = z.infer<typeof RoutingEdgeObservationSchema>;
export const ROUTING_EDGE_FRESHNESS_MS = 90_000;
const StoredSchema = z.object({ identity_digest: z.string().regex(/^[a-f0-9]{64}$/), observation: RoutingEdgeObservationSchema }).strict();
export interface RoutingEdgeProbePlan {
  workspaceId: number; edgeId: string; nodeId: number; peerId: number;
  peerAddress: string; transport: "native_plain" | "tst_v1"; identityDigest: string;
}
export interface RoutingEdgeProbeDeps {
  load(workspace: number, edgeId: string): Promise<RoutingEdgeProbePlan>;
  issue(plan: RoutingEdgeProbePlan): Promise<{ ok: boolean; results?: AgentDiagnoseResult[] | null }>;
  store: RoutingProbeStore; now?: () => Date; enabled?: () => boolean;
}

/** No caller endpoint, DNS resolution or business listener dial. */
export async function loadRoutingEdgeProbePlan(workspace: number, edgeId: string,
  client?: Pick<Prisma.TransactionClient, "nodeBinding" | "linkResource" | "node">, now = new Date()): Promise<RoutingEdgeProbePlan> {
  RoutingEdgeProbeInputSchema.parse({ schema_version: 1, edge_id: edgeId });
  if (!client) { const { db } = await import("../db.ts");
    return db.$transaction((tx) => loadRoutingEdgeProbePlan(workspace, edgeId, tx, now), { isolationLevel: "RepeatableRead" }); }
  const [kind, text] = edgeId.split(":"), id = Number(text);
  if (!Number.isSafeInteger(id) || id > 2_147_483_647) throw new RoutingError("invalid_input", 400);
  let source: number, peer: number, version: number | null = null;
  if (kind === "binding") {
    const edge = await client.nodeBinding.findFirst({ where: { id, ingress_node: { node_group: { workspace_id: workspace } },
      egress_node: { node_group: { workspace_id: workspace } } }, select: { ingress_node_id: true, egress_node_id: true } });
    if (!edge) throw new RoutingError("edge_not_found", 404);
    source = edge.ingress_node_id; peer = edge.egress_node_id;
  } else {
    const edge = await client.linkResource.findFirst({ where: { id, workspace_id: workspace, carrier: "tst_v1" },
      select: { desired_version: true, versions: { orderBy: { version: "desc" }, take: 1, select: { version: true, config: true } } } });
    const parsed = LinkEndpointConfigSchema.safeParse(edge?.versions[0]?.config);
    if (!edge || !parsed.success || edge.versions[0]?.version !== edge.desired_version) throw new RoutingError("edge_not_found", 404);
    source = parsed.data.ingress_node_id; peer = parsed.data.egress_node_id; version = edge.desired_version;
  }
  if (source === peer) throw new RoutingError("probe_target_authority_invalid", 409);
  const nodes = await client.node.findMany({ where: { id: { in: [source, peer] }, node_group: { workspace_id: workspace } },
    select: { id: true, node_id: true, connect_ip: true, role: true, status: true, lifecycle: true, last_seen_at: true,
      node_credential_hash: true, credential_revoked: true, credential_rotated_at: true,
      state_report: { select: { reported_at: true, capabilities: true, capability_manifest: true, control_protocol_version: true } } } });
  const local = nodes.find((n) => n.id === source), remote = nodes.find((n) => n.id === peer);
  if (!local || !remote || remote.credential_revoked || !remote.node_credential_hash) throw new RoutingError("probe_target_authority_invalid", 409);
  if (local.lifecycle !== "active" || local.last_seen_at && local.last_seen_at > now ||
    deriveConnection({ ...local, has_credential: !!local.node_credential_hash, now }) !== "online") throw new RoutingError("probe_node_unavailable", 409);
  const peerAddress = firstConnectIp(remote.connect_ip) ?? "";
  if (!isIP(peerAddress)) throw new RoutingError("probe_peer_literal_required", 422);
  const report = local.state_report, age = report ? now.getTime() - report.reported_at.getTime() : Infinity;
  const facts = report && capabilityFactsFromStoredV2({ ...report, credential_rotated_at: local.credential_rotated_at });
  if (age < 0 || age > CONNECTION_ONLINE_WINDOW_MS || !facts?.advertisementCurrent || facts.capabilitiesMalformed || facts.manifestMalformed ||
    !facts.capabilities?.includes(isIP(peerAddress) === 6 ? "looking_glass:ping6" : "looking_glass:ping") ||
    !admitAction({ nodeId: local.id, role: "ingress", facts }, "diagnose_route_edge").ok) throw new RoutingError("probe_capability_unavailable", 409);
  return { workspaceId: workspace, edgeId, nodeId: source, peerId: peer, peerAddress, transport: kind === "binding" ? "native_plain" : "tst_v1",
    identityDigest: canonicalConfigDigest({ workspace, edgeId, version, source, peer, peerAddress,
      nodes: nodes.map((n) => ({ id: n.id, key: n.node_id, credential: n.node_credential_hash, rotated: n.credential_rotated_at?.toISOString() ?? null })).sort((a,b) => a.id - b.id) }) };
}

export async function collectRoutingEdgeProbe(workspace: number, raw: unknown, deps: RoutingEdgeProbeDeps) {
  const enabled = deps.enabled ?? routingProbesEnabled;
  if (!enabled()) throw new RoutingError("routing_probes_disabled", 409);
  const input = RoutingEdgeProbeInputSchema.parse(raw), plan = await deps.load(workspace, input.edge_id);
  if (plan.workspaceId !== workspace || plan.edgeId !== input.edge_id) throw new RoutingError("probe_target_authority_invalid", 409);
  const now = deps.now ?? (() => new Date()), start = now(), token = randomUUID();
  if (!await deps.store.acquire(workspace, plan.nodeId, token)) throw new RoutingError("probe_budget_exhausted", 429);
  try {
    const before = await deps.load(workspace, plan.edgeId);
    if (before.identityDigest !== plan.identityDigest) throw new RoutingError("probe_identity_changed", 409);
    const waited = now().getTime() - start.getTime();
    if (waited < 0 || waited > 10_000 || !enabled()) throw new RoutingError("probe_reservation_expired", 409);
    const issued = await deps.issue(before), observed = now();
    if (!issued.ok || observed < start || observed.getTime() - start.getTime() > 21_000) throw new RoutingError("probe_command_unconfirmed", 503);
    const after = await deps.load(workspace, plan.edgeId);
    if (after.identityDigest !== plan.identityDigest || !enabled()) throw new RoutingError("probe_identity_changed", 409);
    const result = issued.results?.[0], quality = result?.route_quality;
    if (issued.results?.length !== 1 || result?.host !== plan.peerAddress || result?.port !== 1 ||
      !["reachable", "timeout", "unsupported", "error"].includes(result.status)) throw new RoutingError("probe_result_invalid", 503);
    if (quality && (quality.packets_sent !== 5 || result.status !== (quality.packets_received ? "reachable" : "timeout")))
      throw new RoutingError("probe_result_invalid", 503);
    if (!quality && result.status !== "unsupported" && result.status !== "error") throw new RoutingError("probe_result_invalid", 503);
    const observation = RoutingEdgeObservationSchema.parse({ schema_version: 1, observation_id: token,
      workspace_id: workspace, edge_id: plan.edgeId, source_node_id: plan.nodeId, peer_node_id: plan.peerId, transport: plan.transport,
      method: "icmp_echo", scope: "node_to_node_icmp", started_at: start.toISOString(), observed_at: observed.toISOString(),
      expires_at: new Date(start.getTime() + ROUTING_EDGE_FRESHNESS_MS).toISOString(),
      state: !quality ? "unknown" : quality.packets_received ? "reachable" : "unreachable", packets_sent: quality?.packets_sent ?? 0,
      packets_received: quality?.packets_received ?? 0, rtt_ms: quality?.rtt_ms ?? null,
      loss_percent: quality ? (5 - quality.packets_received) * 20 : null, handshake_success_rate: null, end_to_end_verified: false });
    if (!await deps.store.write(workspace, `edge:${plan.edgeId}`, JSON.stringify({ identity_digest: plan.identityDigest, observation }), token))
      throw new RoutingError("probe_reservation_expired", 409);
    return observation;
  } finally { await deps.store.release(workspace, token); }
}

export async function readRoutingEdgeProbe(workspace: number, edgeId: string, deps: RoutingEdgeProbeDeps) {
  if (!(deps.enabled ?? routingProbesEnabled)()) throw new RoutingError("routing_probes_disabled", 409);
  const plan = await deps.load(workspace, edgeId), raw = await deps.store.read(workspace, `edge:${edgeId}`);
  const absent = { state: "unknown" as const, observation: null };
  if (!raw || raw.length > 8192) return absent;
  let parsed: ReturnType<typeof StoredSchema.safeParse>;
  try { parsed = StoredSchema.safeParse(JSON.parse(raw)); } catch { return absent; }
  if (!parsed.success) return absent;
  const o = parsed.data.observation, now = (deps.now ?? (() => new Date()))().getTime();
  if (parsed.data.identity_digest !== plan.identityDigest || o.workspace_id !== workspace || o.edge_id !== edgeId ||
    o.source_node_id !== plan.nodeId || o.peer_node_id !== plan.peerId || o.transport !== plan.transport ||
    Date.parse(o.started_at) > now || Date.parse(o.observed_at) > now || Date.parse(o.observed_at) < Date.parse(o.started_at) ||
    Date.parse(o.observed_at) - Date.parse(o.started_at) > 21_000 || Date.parse(o.expires_at) !== Date.parse(o.started_at) + ROUTING_EDGE_FRESHNESS_MS)
    return absent;
  return { state: now >= Date.parse(o.expires_at) ? "stale" as const : o.state, observation: o };
}

export async function defaultRoutingEdgeProbeDeps(): Promise<RoutingEdgeProbeDeps> {
  const { routingProbeStore } = await import("./routing-probe-store.ts");
  const { enqueueAgentCommand, waitAgentCommandAck } = await import("./agent-command-bus.ts");
  return { load: loadRoutingEdgeProbePlan, store: routingProbeStore, issue: async (plan) => {
    const payload = { peer_address: plan.peerAddress }, commandId = randomUUID();
    const { scope } = await enqueueAgentCommand(plan.nodeId, { command_id: commandId, resource: "node", resource_id: `node-${plan.nodeId}`,
      action: "diagnose_route_edge", revision: 0, payload, issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 20_000).toISOString() },
      null, undefined, undefined, {}, undefined, undefined, undefined, [{ host: plan.peerAddress, port: 1 }], payload);
    return await waitAgentCommandAck(scope, plan.nodeId, commandId, 20_000);
  } };
}
