import type { Prisma } from "@prisma/client";
import { ObservabilityError, OBSERVABILITY_LIMITS, projectObservability, metricWindow,
  type MetricWindow, type ObservabilitySnapshot, type TargetFact } from "../domain/observability/model.ts";
import { targetKeyOf } from "./node-state.ts";

export function observabilityEnabled(): boolean { return process.env.TUNEX_OBSERVABILITY_ENABLED === "true"; }

type ReadClient = Pick<Prisma.TransactionClient, "node" | "linkResource" | "tunnel" | "tunnelTraffic" | "linkTrafficCheckpoint" | "targetObservation">;

/** Bounded repeatable read. No command, probe, key unseal, lease renewal, or metrics cache. */
export async function loadObservability(workspace: number, window: MetricWindow, client?: ReadClient, now = new Date()): Promise<ObservabilitySnapshot> {
  window = metricWindow({ start_date: window.start_date, end_date: window.end_date }, now);
  if (!client) {
    const { db } = await import("../db.ts");
    return db.$transaction((tx) => loadObservability(workspace, window, tx, now),
      { isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 15000 });
  }
  const date = { gte: new Date(`${window.start_date}T00:00:00Z`),
    lt: new Date(Date.parse(`${window.end_date}T00:00:00Z`) + 86400_000) };
  const [nodes, links, forwards, archives, checkpoints] = await Promise.all([
    client.node.findMany({ where: { node_group: { workspace_id: workspace } }, orderBy: { id: "asc" }, take: OBSERVABILITY_LIMITS.nodes + 1,
      select: { id: true, node_group: { select: { workspace_id: true } }, lifecycle: true, status: true, last_seen_at: true,
        node_credential_hash: true, credential_revoked: true, credential_rotated_at: true,
        state_report: { select: { reported_at: true, agent_started_at: true, runtime_counts: true, error_count: true, tunnels: true, link_placements: true } } } }),
    client.linkResource.findMany({ where: { workspace_id: workspace }, orderBy: { id: "asc" }, take: OBSERVABILITY_LIMITS.links + 1,
      select: { id: true, workspace_id: true, carrier: true, status: true, generation: true,
        deployments: { orderBy: { generation: "desc" }, take: 1,
          select: { generation: true, status: true, version: true, placements: { take: 3, orderBy: { id: "asc" },
            select: { node_id: true, role: true, runtime_id: true, generation: true, config_digest: true, applied_generation: true } } } } } }),
    client.tunnel.findMany({ where: { workspace_id: workspace, category: "port_forward" }, orderBy: { id: "asc" }, take: OBSERVABILITY_LIMITS.forwards + 1,
      select: { id: true, workspace_id: true, link_resource_id: true, ingress_node_id: true, middle_node_id: true, egress_node_id: true,
        tunnel_mode: true, forward_protocol: true, desired_status: true, apply_status: true, config_revision: true, applied_revision: true,
        // These private fields authorize target observations; none are copied into the DTO.
        remote_host: true, remote_port: true, link_target_config: true, federated_egress_peer: true,
        egress_pool: { select: { node_id: true, status: true, targets: { where: { status: "active", weight: { gt: 0 } },
          orderBy: [{ order_by: "asc" }, { id: "asc" }], take: OBSERVABILITY_LIMITS.targets_per_forward + 1,
          select: { host: true, port: true } } } } } }),
    client.tunnelTraffic.groupBy({ by: ["tunnel_id"], where: { workspace_id: workspace, date },
      orderBy: { tunnel_id: "asc" }, take: OBSERVABILITY_LIMITS.usage_groups + 1,
      _sum: { traffic: true, traffic_cost: true }, _max: { date: true }, _count: { _all: true } }),
    client.linkTrafficCheckpoint.groupBy({ by: ["forward_id", "link_id", "node_id"], where: { workspace_id: workspace, date },
      orderBy: [{ forward_id: "asc" }, { link_id: "asc" }, { node_id: "asc" }], take: OBSERVABILITY_LIMITS.usage_groups + 1,
      _sum: { bytes_in: true, bytes_out: true, connections: true }, _max: { updated_at: true }, _count: { _all: true } }),
  ]);
  // Validate limits and resource ownership BEFORE consulting any target observation.
  const facts = { nodes, links, forwards, archives, checkpoints, targets: [] as TargetFact[] };
  projectObservability(workspace, facts, window, now);
  const targets: { forward_id: number; target_index: number; node_id: number; key: string }[] = [];
  for (const forward of forwards) {
    // No claim about UDP/TLS application health or unimplemented TST target pool attribution.
    if (!["tcp", "both"].includes(forward.forward_protocol ?? "") || forward.federated_egress_peer ||
      forward.link_resource_id !== null && forward.link_target_config !== null) continue;
    const nodeId = forward.tunnel_mode === "direct" ? forward.ingress_node_id : forward.egress_node_id;
    if (!nodeId) continue;
    let candidates: { host: string; port: number }[] = [];
    if (forward.tunnel_mode === "relay" && forward.link_resource_id === null) {
      if (forward.egress_pool?.node_id !== nodeId || forward.egress_pool.status !== "active") continue;
      candidates = forward.egress_pool.targets;
    } else if (forward.tunnel_mode === "direct" || forward.link_resource_id !== null) {
      if (forward.remote_host && forward.remote_port) candidates = [{ host: forward.remote_host, port: forward.remote_port }];
    }
    if (candidates.length > OBSERVABILITY_LIMITS.targets_per_forward) throw new ObservabilityError("metrics_limit_exceeded", 422);
    candidates.forEach((target, index) => {
      const key = targetKeyOf(target.host, target.port);
      if (key) targets.push({ forward_id: forward.id, target_index: index, node_id: nodeId, key });
    });
    if (targets.length > OBSERVABILITY_LIMITS.targets) throw new ObservabilityError("metrics_limit_exceeded", 422);
  }
  const identities = new Map(targets.map((t) => [JSON.stringify([t.node_id, t.key]), { node_id: t.node_id, target_key: t.key }]));
  const observations = identities.size ? await client.targetObservation.findMany({
    where: { node: { node_group: { workspace_id: workspace } }, OR: [...identities.values()] }, take: OBSERVABILITY_LIMITS.targets + 1,
    select: { node_id: true, target_key: true, reachable: true, latency_ms: true, observed_at: true, reported_at: true, observation_source: true },
  }) : [];
  if (observations.length > OBSERVABILITY_LIMITS.targets) throw new ObservabilityError("metrics_limit_exceeded", 422);
  const byTarget = new Map(observations.map((o) => [JSON.stringify([o.node_id, o.target_key]), o]));
  facts.targets = targets.map((t) => ({ forward_id: t.forward_id, target_index: t.target_index, node_id: t.node_id,
    observation: byTarget.get(JSON.stringify([t.node_id, t.key])) ?? null }));
  return projectObservability(workspace, facts, window, now);
}
