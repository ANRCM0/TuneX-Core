import type { Prisma } from "@prisma/client";
import { LinkEndpointConfigSchema } from "../domain/link/link-maintenance.ts";
import { capabilityFactsFromStoredV2, type CapabilityManifestRow } from "./capability-manifest.ts";
import { admitOnNode } from "./runtime-admission.ts";
import { CONNECTION_ONLINE_WINDOW_MS, deriveConnection } from "./node-lifecycle.ts";
import { RoutingError, ROUTING_LIMITS, topologyDigest, unmeasuredHealth,
  type RoutingNode, type RoutingEdge, type RoutingForward, type RoutingTopology, type RoutingProtocol } from "../domain/routing/model.ts";

export function routingEnabled(): boolean { return process.env.TUNEX_ROUTING_ENABLED === "true"; }

export interface RoutingFacts {
  nodes: { id: number; node_id: string; node_group: { workspace_id: number }; role: string | null;
    lifecycle: string; status: string; last_seen_at: Date | null; node_credential_hash: string | null;
    credential_revoked: boolean; credential_rotated_at: Date | null; state_report: CapabilityManifestRow | null }[];
  bindings: { id: number; ingress_node_id: number; egress_node_id: number }[];
  links: { id: number; workspace_id: number; carrier: string; status: string; desired_version: number;
    versions: { version: number; config: unknown }[] }[];
  forwards: { id: number; workspace_id: number | null; config_revision: number | null; tunnel_mode: string | null;
    forward_protocol: string | null; ingress_node_id: number | null; egress_node_id: number | null;
    middle_node_id: number | null; federated_egress_peer: string | null; link_resource_id: number | null;
    remote_host: string | null; remote_port: number | null;
    egress_pool: { node_id: number; status: string; targets: { host: string; port: number }[] } | null;
    desired_status: string | null; apply_status: string | null }[];
}

function capabilities(row: RoutingFacts["nodes"][number], now: Date): RoutingNode["capabilities"] {
  const report = row.state_report;
  const stamp = report?.reported_at ? new Date(report.reported_at).getTime() : NaN;
  const reported_at = Number.isFinite(stamp) ? new Date(stamp).toISOString() : null;
  const empty = (state: RoutingNode["capabilities"]["state"]): RoutingNode["capabilities"] =>
    ({ state, native_plain: [], tst_v1: [], reported_at });
  if (!report || !reported_at) return empty("unknown");
  if (stamp > now.getTime() || now.getTime() - stamp > CONNECTION_ONLINE_WINDOW_MS ||
    row.credential_rotated_at && stamp <= row.credential_rotated_at.getTime()) return empty("stale");
  const facts = capabilityFactsFromStoredV2({ ...report, credential_rotated_at: row.credential_rotated_at });
  if (!facts) return empty("stale");
  if (facts.capabilitiesMalformed || facts.manifestMalformed) return empty("invalid");
  const protocols: RoutingProtocol[] = ["tcp", "udp", "both"];
  return { state: facts.manifest || facts.capabilities ? "current" : "unknown", reported_at,
    native_plain: !facts.manifest || !facts.capabilities ? [] : protocols.filter((protocol) =>
      admitOnNode({ nodeId: row.id, role: "ingress", facts }, { action: "apply_tunnel", protocol }).ok),
    tst_v1: facts.capabilities?.includes("forward.link.tst.v1") ? [...protocols] : [] };
}

/** Project only whitelisted facts; never serialize a Prisma row or raw report/config. */
export function projectRoutingTopology(workspace: number, facts: RoutingFacts, now = new Date()): RoutingTopology {
  for (const key of Object.keys(ROUTING_LIMITS) as (keyof typeof ROUTING_LIMITS)[])
    if (facts[key].length > ROUTING_LIMITS[key]) throw new RoutingError("topology_limit_exceeded", 422);
  if (facts.nodes.some((n) => n.node_group.workspace_id !== workspace) || facts.links.some((l) => l.workspace_id !== workspace) ||
    facts.forwards.some((f) => f.workspace_id !== workspace)) throw new RoutingError("topology_scope_invalid", 503);
  const nodes = facts.nodes.map((row): RoutingNode => ({ id: row.id, workspace_id: workspace, node_key: row.node_id,
    role: row.role === "ingress" || row.role === "egress" || row.role === "both" ? row.role : null,
    lifecycle: row.lifecycle,
    connection: row.last_seen_at && row.last_seen_at.getTime() > now.getTime() ? "offline" : deriveConnection({
      status: row.status, last_seen_at: row.last_seen_at, has_credential: !!row.node_credential_hash,
      credential_revoked: row.credential_revoked, now }), capabilities: capabilities(row, now), health: unmeasuredHealth() }))
    .sort((a, b) => a.id - b.id);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: RoutingEdge[] = [];
  const addEdge = (id: string, from: number, to: number, transport: RoutingEdge["transport"],
    source: RoutingEdge["source"], status: string) => {
    if (!nodeIds.has(from) || !nodeIds.has(to)) throw new RoutingError("topology_scope_invalid", 503);
    if (from === to) throw new RoutingError("topology_scope_invalid", 503);
    edges.push({ id, workspace_id: workspace, from_node_id: from, to_node_id: to, transport, source, status,
      cost: { value: null, basis: "unconfigured" },
      quality: { rtt_ms: null, loss_percent: null, handshake_success_rate: null, observed_at: null }, health: unmeasuredHealth() });
  };
  for (const b of facts.bindings) addEdge(`binding:${b.id}`, b.ingress_node_id, b.egress_node_id,
    "native_plain", { kind: "node_binding", id: b.id, version: null }, "authorized");
  const notices: RoutingTopology["notices"] = [];
  for (const link of facts.links) {
    const version = link.versions.find((v) => v.version === link.desired_version);
    const parsed = LinkEndpointConfigSchema.safeParse(version?.config);
    if (link.carrier !== "tst_v1" || !parsed.success || !nodeIds.has(parsed.data.ingress_node_id) || !nodeIds.has(parsed.data.egress_node_id)) {
      notices.push({ source: "link_resource", id: link.id,
        code: link.carrier !== "tst_v1" ? "unsupported_carrier" : "link_endpoints_unavailable" });
      continue;
    }
    addEdge(`link:${link.id}`, parsed.data.ingress_node_id, parsed.data.egress_node_id, "tst_v1",
      { kind: "link_resource", id: link.id, version: link.desired_version }, link.status);
  }
  edges.sort((a, b) => a.id.localeCompare(b.id, "en"));
  const forwards = facts.forwards.map((row): RoutingForward => {
    const issues: string[] = [];
    const path = row.tunnel_mode === "direct" || row.tunnel_mode === "relay" ? row.tunnel_mode : null;
    const protocol = row.forward_protocol === "tcp" || row.forward_protocol === "udp" || row.forward_protocol === "both" ? row.forward_protocol : null;
    const transport = row.link_resource_id === null ? "native_plain"
      : edges.some((e) => e.id === `link:${row.link_resource_id}`) ? "tst_v1" : null;
    const ingress = row.ingress_node_id && nodeIds.has(row.ingress_node_id) ? row.ingress_node_id : null;
    const exitId = path === "direct" ? row.ingress_node_id : row.egress_node_id;
    const target = exitId && nodeIds.has(exitId) ? exitId : null;
    if (!path || !protocol || !transport) issues.push("unsupported_forward_contract");
    if (!ingress || !target) issues.push("endpoint_unavailable");
    if (row.middle_node_id !== null || row.federated_egress_peer || path === "direct" && (row.link_resource_id !== null || row.egress_node_id !== null))
      issues.push("unsupported_forward_topology");
    if (!row.config_revision || row.config_revision < 1) issues.push("revision_unavailable");
    const targetAddress = path === "relay" && transport === "native_plain" ? row.egress_pool?.targets[0]
      : { host: row.remote_host, port: row.remote_port };
    if (!targetAddress?.host || /[\s/\x00]/.test(targetAddress.host) || !targetAddress.port || targetAddress.port < 1 || targetAddress.port > 65535)
      issues.push("target_unconfigured");
    if (path === "relay" && transport === "native_plain" &&
      (!row.egress_pool || row.egress_pool.node_id !== target || row.egress_pool.status !== "active")) issues.push("target_authority_invalid");
    const edge = path === "relay" ? edges.find((e) => e.transport === transport && e.from_node_id === ingress && e.to_node_id === target &&
      (row.link_resource_id === null || e.id === `link:${row.link_resource_id}`)) : undefined;
    if (path === "relay" && !edge) issues.push("carrier_edge_unavailable");
    return { id: row.id, workspace_id: workspace, revision: row.config_revision, path, protocol, transport,
      ingress_node_id: ingress, target_node_id: target, current_edge_ids: edge ? [edge.id] : [],
      desired_status: row.desired_status, apply_status: row.apply_status, issues: issues.sort() };
  }).sort((a, b) => a.id - b.id);
  notices.sort((a, b) => a.id - b.id);
  const graph = { schema_version: 1 as const, workspace_id: workspace, nodes, edges, forwards, notices, execution_enabled: false as const };
  return { ...graph, digest: topologyDigest(graph), generated_at: now.toISOString() };
}

/** A coherent bounded read transaction: no allocation, command, probe or migration. */
export async function loadRoutingTopology(workspace: number, client?: Pick<Prisma.TransactionClient, "node" | "nodeBinding" | "linkResource" | "tunnel">): Promise<RoutingTopology> {
  if (!client) {
    const { db } = await import("../db.ts");
    return db.$transaction((tx) => loadRoutingTopology(workspace, tx), { isolationLevel: "RepeatableRead" });
  }
  const [nodes, bindings, links, forwards] = await Promise.all([
    client.node.findMany({ where: { node_group: { workspace_id: workspace } }, orderBy: { id: "asc" }, take: ROUTING_LIMITS.nodes + 1,
      select: { id: true, node_id: true, role: true, lifecycle: true, status: true, last_seen_at: true,
        node_credential_hash: true, credential_revoked: true, credential_rotated_at: true, node_group: { select: { workspace_id: true } },
        state_report: { select: { reported_at: true, capabilities: true, capability_manifest: true, control_protocol_version: true } } } }),
    client.nodeBinding.findMany({ where: { ingress_node: { node_group: { workspace_id: workspace } },
      egress_node: { node_group: { workspace_id: workspace } } }, orderBy: { id: "asc" }, take: ROUTING_LIMITS.bindings + 1,
      select: { id: true, ingress_node_id: true, egress_node_id: true } }),
    client.linkResource.findMany({ where: { workspace_id: workspace }, orderBy: { id: "asc" }, take: ROUTING_LIMITS.links + 1,
      select: { id: true, workspace_id: true, carrier: true, status: true, desired_version: true,
        versions: { orderBy: { version: "desc" }, take: 1, select: { version: true, config: true } } } }),
    client.tunnel.findMany({ where: { workspace_id: workspace, category: "port_forward" }, orderBy: { id: "asc" }, take: ROUTING_LIMITS.forwards + 1,
      select: { id: true, workspace_id: true, config_revision: true, tunnel_mode: true, forward_protocol: true,
        ingress_node_id: true, egress_node_id: true, middle_node_id: true, federated_egress_peer: true, link_resource_id: true,
        remote_host: true, remote_port: true,
        egress_pool: { select: { node_id: true, status: true, targets: { where: { status: "active", weight: { gt: 0 } }, orderBy: [{ order_by: "asc" }, { id: "asc" }],
          take: 1, select: { host: true, port: true } } } },
        desired_status: true, apply_status: true } }),
  ]);
  return projectRoutingTopology(workspace, { nodes, bindings, links, forwards });
}
