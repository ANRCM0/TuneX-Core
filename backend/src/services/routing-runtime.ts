import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { newTstCredentials, sealTstCredentials, unsealTstCredentials, validateTstCredentials, tstUri } from "../domain/link/tst-credentials.ts";
import { RoutingError } from "../domain/routing/model.ts";
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
export async function attachRoutingHop(config: AgentTunnelConfig, node: number): Promise<AgentTunnelConfig> {
  const forwardId = routingForwardId(config.id);
  if (forwardId === null) return config;
  const { db } = await import("../db.ts");
  const forward = await db.tunnel.findUnique({ where: { id: forwardId }, select: { id: true, workspace_id: true,
    routing_security_version: true, config_revision: true, ingress_node_id: true, middle_node_id: true, egress_node_id: true,
    tunnel_mode: true, forward_protocol: true, link_resource_id: true, federated_egress_peer: true } });
  if (!forward || forward.routing_security_version === 0) return config;
  if (forward.routing_security_version !== 1 || forward.config_revision !== config.revision || !forward.workspace_id ||
      forward.tunnel_mode !== "relay" || forward.forward_protocol !== "tcp" || forward.link_resource_id || forward.federated_egress_peer)
    throw new RoutingError("routing_generation_unavailable", 409);
  const path = PathSchema.parse([forward.ingress_node_id, ...(forward.middle_node_id ? [forward.middle_node_id] : []), forward.egress_node_id]);
  if (!path.includes(node)) throw new RoutingError("routing_generation_unavailable", 409);
  const owned = await db.node.count({ where: { id: { in: path }, node_group: { workspace_id: forward.workspace_id },
    credential_revoked: false, node_credential_hash: { not: null } } });
  if (owned !== path.length) throw new RoutingError("routing_generation_unavailable", 409);
  await assertRoutingHopCapabilities(path);
  let runtime = await db.routingRuntime.findFirst({ where: { forward_id: forward.id, revision: config.revision, workspace_id: forward.workspace_id } });
  // Normal edits and compensation also rotate identities, preserving the security floor.
  if (!runtime) {
    const prepared = await prepareRoutingRuntime(forward.workspace_id, forward.id, config.revision, path);
    runtime = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tunnel WHERE id = ${forward.id} FOR UPDATE`;
      const current = await tx.tunnel.findUnique({ where: { id: forward.id }, select: { workspace_id: true, config_revision: true,
        ingress_node_id: true, middle_node_id: true, egress_node_id: true, routing_security_version: true } });
      if (!current || current.workspace_id !== forward.workspace_id || current.config_revision !== config.revision ||
          current.routing_security_version !== 1 || JSON.stringify([current.ingress_node_id, ...(current.middle_node_id ? [current.middle_node_id] : []), current.egress_node_id]) !== JSON.stringify(path))
        throw new RoutingError("routing_generation_unavailable", 409);
      return tx.routingRuntime.upsert({ where: { forward_id_revision: { forward_id: forward.id, revision: config.revision } }, create: prepared, update: {} });
    });
  }
  if (JSON.stringify(runtime.path) !== JSON.stringify(path)) throw new RoutingError("routing_generation_unavailable", 409);
  return { ...config, route_auth: projectRoutingHop(runtime, node) };
}
