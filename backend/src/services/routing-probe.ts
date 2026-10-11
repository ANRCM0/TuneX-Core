import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { canonicalConfigDigest } from "../domain/link/core-contract.ts";
import { RoutingError } from "../domain/routing/model.ts";
import { ROUTING_PROBE_LIMITS, RoutingProbeInputSchema, StoredRoutingProbeSchema, summarizeRoutingProbe,
  type RoutingProbeInput, type RoutingProbeObservation, type RoutingProbeResult, type RoutingProbeTarget } from "../domain/routing/probe.ts";
import { CONNECTION_ONLINE_WINDOW_MS, deriveConnection } from "./node-lifecycle.ts";
import { capabilityFactsFromStoredV2 } from "./capability-manifest.ts";
import { admitAction } from "./runtime-admission.ts";
import { routingEnabled } from "./routing-topology.ts";
import { TstLinkInputSchema } from "../domain/link/tst-compiler.ts";

export function routingProbesEnabled(): boolean {
  return routingEnabled() && process.env.TUNEX_ROUTING_PROBES_ENABLED === "true";
}
export interface RoutingProbePlan {
  workspaceId: number; forwardId: number; revision: number; nodeId: number; resourceId: string;
  targets: RoutingProbeTarget[]; identityDigest: string;
  transport?: "native_plain" | "tst_v1"; generation?: number;
}
export interface RoutingProbeStore {
  acquire(workspaceId: number, nodeId: number, token: string): Promise<boolean>;
  release(workspaceId: number, token: string): Promise<void>;
  read(workspaceId: number, forwardId: number | string): Promise<string | null>;
  write(workspaceId: number, forwardId: number | string, value: string, token: string): Promise<boolean>;
}
export interface RoutingProbeDeps {
  load(workspaceId: number, forwardId: number): Promise<RoutingProbePlan>;
  issue(plan: RoutingProbePlan): Promise<{ ok: true; results: RoutingProbeResult[] } | { ok: false }>;
  store: RoutingProbeStore; enabled?: () => boolean; now?: () => Date; uuid?: () => string;
}

/** Consistent, bounded, private authorized target snapshot. No arbitrary request target. */
export async function loadRoutingProbePlan(workspaceId: number, forwardId: number,
  client?: Pick<Prisma.TransactionClient, "tunnel" | "nodeBinding"> & Partial<Pick<Prisma.TransactionClient, "linkResource" | "linkDeployment">>, now = new Date()): Promise<RoutingProbePlan> {
  if (!client) {
    const { db } = await import("../db.ts");
    return db.$transaction((tx) => loadRoutingProbePlan(workspaceId, forwardId, tx, now), { isolationLevel: "RepeatableRead" });
  }
  const nodeSelect = { id: true, node_id: true, lifecycle: true, status: true, role: true, last_seen_at: true,
    node_credential_hash: true, credential_revoked: true, credential_rotated_at: true,
    node_group: { select: { workspace_id: true } }, state_report: { select: { reported_at: true,
      control_protocol_version: true, capabilities: true, capability_manifest: true } } } as const;
  const row = await client.tunnel.findFirst({ where: { id: forwardId, workspace_id: workspaceId, category: "port_forward" },
    select: { id: true, workspace_id: true, tunnel_mode: true, forward_protocol: true, config_revision: true,
      applied_revision: true, desired_status: true, apply_status: true, link_resource_id: true,
      middle_node_id: true, federated_egress_peer: true, remote_host: true, remote_port: true,
      ingress_node: { select: nodeSelect }, egress_node: { select: nodeSelect }, middle_node: { select: nodeSelect },
      egress_pool: { select: { id: true, node_id: true, status: true,
        targets: { where: { status: "active", weight: { gt: 0 } }, orderBy: [{ order_by: "asc" }, { id: "asc" }],
          take: ROUTING_PROBE_LIMITS.targets + 1, select: { id: true, host: true, port: true } } } } } });
  if (!row) throw new RoutingError("forward_not_found", 404);
  const tst = row.link_resource_id !== null;
  if (row.forward_protocol !== "tcp" && row.forward_protocol !== "both") throw new RoutingError("probe_protocol_unsupported", 422);
  if (row.middle_node_id !== null && (tst || row.forward_protocol !== "tcp" || row.tunnel_mode !== "relay") ||
    row.federated_egress_peer || !["direct", "relay"].includes(row.tunnel_mode ?? ""))
    throw new RoutingError("probe_topology_unsupported", 422);
  // A previously ACKed generation may now report a runtime error. Its configured
  // target authority still exists; diagnosing that target does not promote Ready.
  if (!row.config_revision || row.desired_status !== "active" || !["active", "error"].includes(row.apply_status ?? "") || row.applied_revision !== row.config_revision)
    throw new RoutingError("probe_forward_unconfirmed", 409);
  const node = row.tunnel_mode === "direct" ? row.ingress_node : row.egress_node;
  const role = row.tunnel_mode === "direct" ? "ingress" : "egress";
  if (!row.ingress_node || row.ingress_node.node_group.workspace_id !== workspaceId || !node || node.node_group.workspace_id !== workspaceId ||
    row.tunnel_mode === "direct" && row.egress_node !== null || node.role !== role && node.role !== "both")
    throw new RoutingError("probe_target_authority_invalid", 409);
  if (node.lifecycle !== "active" || node.last_seen_at && node.last_seen_at > now || deriveConnection({ status: node.status,
    last_seen_at: node.last_seen_at, has_credential: !!node.node_credential_hash, credential_revoked: node.credential_revoked, now }) !== "online")
    throw new RoutingError("probe_node_unavailable", 409);
  const report = node.state_report;
  const age = report ? now.getTime() - report.reported_at.getTime() : Infinity;
  const facts = report && capabilityFactsFromStoredV2({ ...report, credential_rotated_at: node.credential_rotated_at });
  if (age < 0 || age > CONNECTION_ONLINE_WINDOW_MS || !facts?.advertisementCurrent || facts.capabilitiesMalformed || facts.manifestMalformed ||
    !admitAction({ nodeId: node.id, role, facts }, tst ? "diagnose_link_forward" : "diagnose_tunnel").ok)
    throw new RoutingError("probe_capability_unavailable", 409);
  if (tst) {
    if (row.tunnel_mode !== "relay" || !client.linkResource || !client.linkDeployment)
      throw new RoutingError("probe_topology_unsupported", 422);
    const link = await client.linkResource.findFirst({ where: { id: row.link_resource_id!, workspace_id: workspaceId },
      select: { id: true, carrier: true, generation: true, desired_version: true, status: true } });
    if (!link || link.carrier !== "tst_v1" || link.status !== "active")
      throw new RoutingError("probe_link_unconfirmed", 409);
    const deployment = await client.linkDeployment.findUnique({ where: { link_id_generation: { link_id: link.id, generation: link.generation } },
      select: { id: true, generation: true, version: true, status: true, lease_expires_at: true, binding_snapshot: true,
        placements: { select: { node_id: true, role: true, runtime_id: true, generation: true, applied_generation: true, config_digest: true, status: true } } } });
    const parsed = TstLinkInputSchema.safeParse((deployment?.binding_snapshot as { spec?: unknown } | null)?.spec);
    const spec = parsed.success ? parsed.data : null;
    const binding = spec?.bindings.find((b) => b.forward_id === row.id && b.revision === row.config_revision);
    const outgoing = deployment?.placements.find((p) => p.role === "egress");
    if (!deployment || deployment.status !== "active" || deployment.version !== link.desired_version || deployment.lease_expires_at <= now ||
      !spec || spec.workspace_id !== workspaceId || spec.link_id !== link.id || spec.generation !== link.generation || spec.version !== link.desired_version ||
      spec.ingress.id !== row.ingress_node.id || spec.egress.id !== node.id ||
      spec.ingress.workspace_id !== workspaceId || spec.egress.workspace_id !== workspaceId ||
      deployment.placements.length !== 2 || !["ingress", "egress"].every((r) => deployment.placements.some((p) => p.role === r &&
        p.node_id === (r === "ingress" ? row.ingress_node!.id : node.id) && p.generation === link.generation &&
        p.applied_generation === link.generation && ["running", "passive"].includes(p.status))) ||
      !outgoing || outgoing.runtime_id !== `tunex-tst-${link.id}-egress` || !binding || binding.protocol !== row.forward_protocol ||
      binding.target_host !== row.remote_host || binding.target_port !== row.remote_port)
      throw new RoutingError("probe_link_unconfirmed", 409);
    const targets = [{ host: binding.target_host, port: binding.target_port }];
    return { workspaceId, forwardId: row.id, revision: row.config_revision, nodeId: node.id,
      resourceId: outgoing.runtime_id, transport: "tst_v1", generation: link.generation, targets,
      identityDigest: canonicalConfigDigest({ workspaceId, forwardId: row.id, revision: row.config_revision,
        link: link.id, generation: link.generation, version: link.desired_version, protocol: row.forward_protocol,
        ingress: row.ingress_node.id, node: node.id, node_key: node.node_id, credential: node.node_credential_hash,
        rotated_at: node.credential_rotated_at?.toISOString() ?? null,
        placements: deployment.placements.map((p) => ({ node: p.node_id, role: p.role, runtime: p.runtime_id, digest: p.config_digest })).sort((a,b) => a.role.localeCompare(b.role)), targets }) };
  }
  const targets = row.tunnel_mode === "direct" ? [{ host: row.remote_host ?? "", port: row.remote_port ?? 0 }]
    : row.egress_pool?.targets.map(({ host, port }) => ({ host, port })) ?? [];
  if (row.tunnel_mode === "relay" && (row.egress_pool?.node_id !== node.id || row.egress_pool.status !== "active"))
    throw new RoutingError("probe_target_authority_invalid", 409);
  if (row.middle_node_id !== null && (!row.middle_node || row.middle_node.node_group.workspace_id !== workspaceId || row.middle_node.role !== "both" ||
    row.middle_node.id === row.ingress_node.id || row.middle_node.id === node.id)) throw new RoutingError("probe_target_authority_invalid", 409);
  const binding = row.tunnel_mode === "relay" ? await client.nodeBinding.findFirst({
    where: { ingress_node_id: row.middle_node_id ?? row.ingress_node.id, egress_node_id: node.id }, select: { id: true } }) : null;
  const firstBinding = row.middle_node_id === null ? null : await client.nodeBinding.findFirst({
    where: { ingress_node_id: row.ingress_node.id, egress_node_id: row.middle_node_id }, select: { id: true } });
  if (row.tunnel_mode === "relay" && !binding) throw new RoutingError("probe_target_authority_invalid", 409);
  if (row.middle_node_id !== null && !firstBinding) throw new RoutingError("probe_target_authority_invalid", 409);
  if (targets.length > ROUTING_PROBE_LIMITS.targets) throw new RoutingError("probe_target_limit_exceeded", 422);
  if (!targets.length || targets.some((t) => !t.host || t.host.length > 255 || /[\s/\x00]/.test(t.host) || t.port < 1 || t.port > 65535) ||
    new Set(targets.map((t) => JSON.stringify([t.host.toLowerCase(), t.port]))).size !== targets.length)
    throw new RoutingError("probe_targets_invalid", 409);
  return { workspaceId, forwardId: row.id, revision: row.config_revision, nodeId: node.id,
    resourceId: `tunex-${row.id}-${row.tunnel_mode === "direct" ? "direct" : "egress"}`, transport: "native_plain", targets,
    identityDigest: canonicalConfigDigest({ workspaceId, forwardId: row.id, revision: row.config_revision,
      mode: row.tunnel_mode, protocol: row.forward_protocol, ingress: row.ingress_node.id, node: node.id,
      node_key: node.node_id, credential: node.node_credential_hash, rotated_at: node.credential_rotated_at?.toISOString() ?? null,
      binding_id: binding?.id ?? null, first_binding: firstBinding?.id ?? null, middle: row.middle_node_id,
      pool_id: row.egress_pool?.id ?? null, targets }) };
}

export async function collectRoutingProbe(workspaceId: number, raw: unknown, deps: RoutingProbeDeps): Promise<RoutingProbeObservation> {
  if (!(deps.enabled ?? routingProbesEnabled)()) throw new RoutingError("routing_probes_disabled", 409);
  const input = RoutingProbeInputSchema.parse(raw);
  const plan = await deps.load(workspaceId, input.forward_id);
  if (plan.workspaceId !== workspaceId || plan.forwardId !== input.forward_id) throw new RoutingError("probe_target_authority_invalid", 409);
  if (plan.revision !== input.expected_revision) throw new RoutingError("revision_conflict", 409);
  const now = deps.now ?? (() => new Date());
  const startedAt = now();
  const token = (deps.uuid ?? randomUUID)();
  if (!await deps.store.acquire(workspaceId, plan.nodeId, token)) throw new RoutingError("probe_budget_exhausted", 429);
  try {
    // Re-read after budget reservation; a waited/stale plan is never dispatch authority.
    const before = await deps.load(workspaceId, input.forward_id);
    if (before.identityDigest !== plan.identityDigest) throw new RoutingError("probe_identity_changed", 409);
    const waited = now().getTime() - startedAt.getTime();
    if (waited < 0 || waited > 10_000) throw new RoutingError("probe_reservation_expired", 409);
    if (!(deps.enabled ?? routingProbesEnabled)()) throw new RoutingError("routing_probes_disabled", 409);
    const issued = await deps.issue(before);
    if (!issued.ok) throw new RoutingError("probe_command_unconfirmed", 503);
    const observedAt = now();
    if (observedAt < startedAt || observedAt.getTime() - startedAt.getTime() > ROUTING_PROBE_LIMITS.command_timeout_ms + 1000)
      throw new RoutingError("probe_command_unconfirmed", 503);
    const after = await deps.load(workspaceId, input.forward_id);
    if (after.identityDigest !== plan.identityDigest) throw new RoutingError("probe_identity_changed", 409);
    if (!(deps.enabled ?? routingProbesEnabled)()) throw new RoutingError("routing_probes_disabled", 409);
    const observation = summarizeRoutingProbe({ observationId: token, workspaceId, forwardId: plan.forwardId,
      revision: plan.revision, nodeId: plan.nodeId, transport: plan.transport, targets: plan.targets, results: issued.results, startedAt, observedAt });
    if (!await deps.store.write(workspaceId, plan.forwardId, JSON.stringify({ identity_digest: plan.identityDigest, observation }), token))
      throw new RoutingError("probe_reservation_expired", 409);
    return observation;
  } finally { await deps.store.release(workspaceId, token); }
}

export async function readRoutingProbe(workspaceId: number, forwardId: number, deps: RoutingProbeDeps) {
  if (!(deps.enabled ?? routingProbesEnabled)()) throw new RoutingError("routing_probes_disabled", 409);
  const plan = await deps.load(workspaceId, forwardId);
  const raw = await deps.store.read(workspaceId, forwardId);
  const absent = (reason: string) => ({ state: "unknown" as const, reason, observation: null });
  if (!raw) return absent("probe_not_recorded");
  if (raw.length > 16384) return absent("probe_record_invalid");
  let parsed: ReturnType<typeof StoredRoutingProbeSchema.safeParse>;
  try { parsed = StoredRoutingProbeSchema.safeParse(JSON.parse(raw)); } catch { return absent("probe_record_invalid"); }
  if (!parsed.success) return absent("probe_record_invalid");
  const { observation, identity_digest } = parsed.data;
  if (identity_digest !== plan.identityDigest || observation.workspace_id !== workspaceId || observation.forward_id !== forwardId ||
    observation.revision !== plan.revision || observation.node_id !== plan.nodeId || observation.transport !== (plan.transport ?? "native_plain") ||
    observation.samples.length !== plan.targets.length)
    return absent("probe_identity_changed");
  const now = (deps.now ?? (() => new Date()))().getTime();
  const started = Date.parse(observation.started_at), observed = Date.parse(observation.observed_at), expires = Date.parse(observation.expires_at);
  if (started > now || observed < started || observed > now || observed - started > ROUTING_PROBE_LIMITS.command_timeout_ms + 1000 ||
    expires !== started + ROUTING_PROBE_LIMITS.freshness_ms) return absent("probe_record_invalid");
  if (now >= expires) return { state: "stale" as const, reason: "probe_expired", observation };
  return { state: observation.state, reason: "tcp_connect_observation", observation };
}

export async function defaultRoutingProbeDeps(): Promise<RoutingProbeDeps> {
  const { routingProbeStore } = await import("./routing-probe-store.ts");
  const { issueAgentDiagnose } = await import("./agent-command-bus.ts");
  return { load: loadRoutingProbePlan, store: routingProbeStore,
    issue: (plan) => plan.transport === "tst_v1" ? issueRoutingTstProbe(plan) : issueAgentDiagnose({ nodeId: plan.nodeId, resourceId: plan.resourceId,
      targets: plan.targets, timeoutMs: ROUTING_PROBE_LIMITS.command_timeout_ms }) };
}

async function issueRoutingTstProbe(plan: RoutingProbePlan) {
  const { enqueueAgentCommand, waitAgentCommandAck } = await import("./agent-command-bus.ts");
  const payload = { forward_id: plan.forwardId, revision: plan.revision, timeout_ms: 5000 };
  const commandId = randomUUID();
  const { scope } = await enqueueAgentCommand(plan.nodeId, { command_id: commandId, resource: "link", resource_id: plan.resourceId,
    action: "diagnose_link_forward", revision: plan.generation!, payload,
    issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + ROUTING_PROBE_LIMITS.command_timeout_ms).toISOString() },
    null, undefined, undefined, {}, undefined, undefined, payload, plan.targets);
  const ack = await waitAgentCommandAck(scope, plan.nodeId, commandId, ROUTING_PROBE_LIMITS.command_timeout_ms);
  return ack.ok ? { ok: true as const, results: ack.results ?? [] } : { ok: false as const };
}
