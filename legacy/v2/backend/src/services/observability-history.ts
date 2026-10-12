import type { Prisma } from "@prisma/client";
import { ObservabilityError, metricWindow, type MetricWindow } from "../domain/observability/model.ts";
import { historyQuery, projectHistory, type HistorySelection, type ObservabilityHistory } from "../domain/observability/history.ts";

type ReadClient = Pick<Prisma.TransactionClient, "node" | "linkResource" | "tunnel" | "tunnelTraffic" | "linkTrafficCheckpoint">;
/** Ownership and immutable ledger groups share one bounded repeatable read. */
export async function loadObservabilityHistory(workspace: number, window: MetricWindow, selection: HistorySelection,
  client?: ReadClient, now = new Date()): Promise<ObservabilityHistory> {
  window = metricWindow({ start_date: window.start_date, end_date: window.end_date }, now);
  selection = historyQuery({ scope: selection.scope, ...(selection.id === null ? {} : { id: String(selection.id) }) }, now).selection;
  if (!client) {
    const { db } = await import("../db.ts");
    return db.$transaction((tx) => loadObservabilityHistory(workspace, window, selection, tx, now),
      { isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 15000 });
  }
  if (selection.scope !== "workspace") {
    const id = selection.id!;
    const resource = selection.scope === "forward"
      ? await client.tunnel.findFirst({ where: { id, workspace_id: workspace, category: "port_forward" }, select: { id: true } })
      : selection.scope === "link"
        ? await client.linkResource.findFirst({ where: { id, workspace_id: workspace }, select: { id: true } })
        : await client.node.findFirst({ where: { id, node_group: { workspace_id: workspace } }, select: { id: true } });
    if (!resource) throw new ObservabilityError("metrics_resource_not_found", 404);
  }
  const date = { gte: new Date(`${window.start_date}T00:00:00Z`), lt: new Date(Date.parse(`${window.end_date}T00:00:00Z`) + 86400_000) };
  const [archives, checkpoints] = await Promise.all([
    selection.scope === "workspace" || selection.scope === "forward" ? client.tunnelTraffic.groupBy({ by: ["date"],
      where: { workspace_id: workspace, date, ...(selection.scope === "forward" ? { tunnel_id: selection.id! } : {}) },
      orderBy: { date: "asc" }, take: 32, _sum: { traffic: true, traffic_cost: true }, _count: { _all: true } }) : [],
    client.linkTrafficCheckpoint.groupBy({ by: ["date"], where: { workspace_id: workspace, date,
      ...(selection.scope === "forward" ? { forward_id: selection.id! } : selection.scope === "link" ? { link_id: selection.id! }
        : selection.scope === "node" ? { node_id: selection.id! } : {}) },
      orderBy: { date: "asc" }, take: 32, _sum: { bytes_in: true, bytes_out: true, connections: true },
      _max: { updated_at: true }, _count: { _all: true } }),
  ]);
  return projectHistory(workspace, selection, window, archives, checkpoints, now);
}
