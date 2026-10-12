import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { newTstCredentials, sealTstCredentials, unsealTstCredentials, validateTstCredentials, tstUri } from "../domain/link/tst-credentials.ts";
import { RoutingError } from "../domain/routing/model.ts";
import { canonicalConfigDigest } from "../domain/link/core-contract.ts";
import { loadNodeCapabilityFacts } from "./runtime-admission.ts";
import type { AgentTunnelConfig } from "./orchestrator.ts";

export const ROUTING_HOP_CAPABILITY = "forward.routing.hop.mtls.v1";
const PathSchema = z.array(z.number().int().positive().max(2_147_483_647)).min(2).max(3)
  .refine((p) => new Set(p).size === p.length, "routing_loop");
export type RouteHopIdentity = { certificate_pem: string; private_key_pem: string; ca_pem: string; peer_uri: string; own_uri: string };
export interface RouteHopConfig {
  version: 1; workspace_id: number; forward_id: number; revision: number; node_ids: number[]; hop_index: number;
  incoming?: RouteHopIdentity; outgoing?: RouteHopIdentity;
}
export function routingSealKey() {
  const key = process.env.TUNEX_LINK_SEAL_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new RoutingError("routing_seal_key_required", 503);
  return key;
}
export function routingHopAuthEnabled() {
  return process.env.TUNEX_ROUTING_HOP_AUTH_ENABLED === "true" && /^[a-f0-9]{64}$/i.test(process.env.TUNEX_LINK_SEAL_KEY ?? "");
}
export function routingExecutionEnabled() {
  return routingHopAuthEnabled() && ["TUNEX_ROUTING_ENABLED", "TUNEX_ROUTING_PROBES_ENABLED", "TUNEX_ROUTING_POLICIES_ENABLED", "TUNEX_ROUTING_EXECUTION_ENABLED"]
    .every((flag) => process.env[flag] === "true");
}

export async function assertRoutingHopCapabilities(path: number[], load = loadNodeCapabilityFacts) {
  PathSchema.parse(path);
  for (const id of path) {
    const facts = await load(id);
    if (!facts?.advertisementCurrent || facts.capabilitiesMalformed || facts.manifestMalformed ||
        !facts.capabilities?.includes(ROUTING_HOP_CAPABILITY)) throw new RoutingError("routing_hop_upgrade_required", 409);
  }
}

/** Only sealed credentials are stored. Each edge has its own private CA and exact node identities. */
export async function prepareRoutingRuntime(workspace: number, forward: number, revision: number, rawPath: number[], now = new Date()) {
  const path = PathSchema.parse(rawPath), key = routingSealKey();
  const pairs = await Promise.all(path.slice(1).map((peer, i) => newTstCredentials(workspace, forward, path[i]!, peer, now)));
  return { workspace_id: workspace, forward_id: forward, revision, path: path as Prisma.InputJsonValue,
    sealed_credentials: pairs.map((pair) => sealTstCredentials(pair, key, workspace, forward, revision)) as Prisma.InputJsonValue,
    expires_at: new Date(Math.min(...pairs.map((p) => Date.parse(p.expires_at)))) };
}

export function projectRoutingHop(row: { workspace_id: number; forward_id: number; revision: number; path: unknown;
  sealed_credentials: unknown; expires_at: Date }, node: number, key = routingSealKey(), now = new Date()): RouteHopConfig {
  const path = PathSchema.parse(row.path), index = path.indexOf(node);
  if (index < 0 || row.expires_at <= now) throw new RoutingError("routing_identity_unavailable", 409);
  const sealed = z.array(z.string()).length(path.length - 1).parse(row.sealed_credentials);
  const identity = (edge: number, role: "ingress" | "egress") => {
    const pair = unsealTstCredentials(sealed[edge]!, key, row.workspace_id, row.forward_id, row.revision);
    validateTstCredentials(pair, { workspace: row.workspace_id, link: row.forward_id, ingressNode: path[edge]!, egressNode: path[edge+1]! });
    if (Date.parse(pair.expires_at) !== row.expires_at.getTime() && Date.parse(pair.expires_at) < row.expires_at.getTime())
      throw new RoutingError("routing_identity_unavailable", 409);
    return { ...pair[role], own_uri: tstUri(row.workspace_id, row.forward_id, node, role) };
  };
  return { version: 1, workspace_id: row.workspace_id, forward_id: row.forward_id, revision: row.revision,
    node_ids: path, hop_index: index,
    ...(index > 0 ? { incoming: identity(index-1, "egress") } : {}),
    ...(index < path.length-1 ? { outgoing: identity(index, "ingress") } : {}) };
}

/** Shared by live dispatch and reconnect snapshots. A sticky protected Forward never emits a plain config. */
export function routingForwardId(runtimeId: string): number | null {
  const match = /^tunex-([1-9][0-9]*)-(?:relay|ingress|egress|middle|direct)$/.exec(runtimeId);
  const id = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647 ? id : null;
}

/** A compensation is a new generation with the complete immutable baseline.
 * Only the active failed rollout may authorize it, never an arbitrary snapshot. */
async function compensationPath(tx: Prisma.TransactionClient, forward: {
  id: number; config_revision: number | null; applied_revision: number | null;
}, revision: number): Promise<number[]> {
  if (forward.config_revision === null || revision !== forward.config_revision + 1 || !forward.applied_revision)
    throw new RoutingError("routing_generation_unavailable", 409);
  const rollouts = await tx.forwardRollout.findMany({ where: { tunnel_id: forward.id,
    revision: forward.config_revision, base_revision: forward.applied_revision, phase: "compensating" },
    take: 2, select: { id: true } });
  if (rollouts.length !== 1) throw new RoutingError("routing_generation_unavailable", 409);
  const snapshots = await tx.forwardRevision.findMany({ where: { tunnel_id: forward.id,
    revision: { in: [forward.applied_revision, revision] } } });
  const baseline = snapshots.find((s) => s.revision === forward.applied_revision);
  const rollback = snapshots.find((s) => s.revision === revision);
  if (!baseline || !rollback || rollback.mode !== "relay" || rollback.protocol !== "tcp" ||
      rollback.link_resource_id || rollback.federated_egress_peer)
    throw new RoutingError("routing_generation_unavailable", 409);
  const content = ({ id: _id, revision: _revision, created_at: _time, ...fields }: typeof rollback) => fields;
  if (canonicalConfigDigest(content(baseline)) !== canonicalConfigDigest(content(rollback)))
    throw new RoutingError("routing_generation_unavailable", 409);
  return PathSchema.parse([rollback.ingress_node_id, ...(rollback.middle_node_id ? [rollback.middle_node_id] : []), rollback.egress_node_id]);
}

export async function attachRoutingHop(config: AgentTunnelConfig, node: number): Promise<AgentTunnelConfig> {
  const forwardId = routingForwardId(config.id);
  if (forwardId === null) return config;
  const { db } = await import("../db.ts");
  return db.$transaction(async (tx) => {
    // Generation, rollback authority and identity creation share the Forward lock.
    await tx.$queryRaw`SELECT id FROM tunnel WHERE id = ${forwardId} FOR UPDATE`;
    const forward = await tx.tunnel.findUnique({ where: { id: forwardId }, select: { id: true, workspace_id: true,
      routing_security_version: true, config_revision: true, applied_revision: true, ingress_node_id: true,
      middle_node_id: true, egress_node_id: true, tunnel_mode: true, forward_protocol: true,
      link_resource_id: true, federated_egress_peer: true } });
    if (!forward) throw new RoutingError("routing_generation_unavailable", 409);
    if (forward.routing_security_version === 0) return config;
    if (forward.routing_security_version !== 1 || !forward.workspace_id || forward.tunnel_mode !== "relay" ||
        forward.forward_protocol !== "tcp" || forward.link_resource_id || forward.federated_egress_peer)
      throw new RoutingError("routing_generation_unavailable", 409);
    const path = forward.config_revision === config.revision
      ? PathSchema.parse([forward.ingress_node_id, ...(forward.middle_node_id ? [forward.middle_node_id] : []), forward.egress_node_id])
      : await compensationPath(tx, forward, config.revision);
    if (!path.includes(node)) throw new RoutingError("routing_generation_unavailable", 409);
    const owned = await tx.node.count({ where: { id: { in: path }, node_group: { workspace_id: forward.workspace_id },
      lifecycle: "active", credential_revoked: false, node_credential_hash: { not: null } } });
    const bindings = await tx.nodeBinding.count({ where: { OR: path.slice(1).map((peer, i) => ({
      ingress_node_id: path[i]!, egress_node_id: peer })) } });
    if (owned !== path.length || bindings !== path.length - 1) throw new RoutingError("routing_generation_unavailable", 409);
    await assertRoutingHopCapabilities(path, (id) => loadNodeCapabilityFacts(id, tx));
    let runtime = await tx.routingRuntime.findFirst({ where: { forward_id: forward.id, revision: config.revision, workspace_id: forward.workspace_id } });
    if (!runtime) runtime = await tx.routingRuntime.create({ data:
      await prepareRoutingRuntime(forward.workspace_id, forward.id, config.revision, path) });
    if (JSON.stringify(runtime.path) !== JSON.stringify(path)) throw new RoutingError("routing_generation_unavailable", 409);
    return { ...config, route_auth: projectRoutingHop(runtime, node) };
  }, { timeout: 10_000 });
}
