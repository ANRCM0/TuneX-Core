import { expect, test } from "bun:test";
import { historyQuery, projectHistory, type DailyArchive, type DailyCheckpoint } from "../history.ts";
import { loadObservabilityHistory } from "../../../services/observability-history.ts";

const now = new Date("2026-10-12T10:00:00Z"), window = historyQuery({ start_date: "2026-10-10", end_date: "2026-10-12" }, now).window;
const archive: DailyArchive = { date: new Date("2026-10-10"), _sum: { traffic: 0, traffic_cost: 3 }, _count: { _all: 1 } };
const checkpoint: DailyCheckpoint = { date: new Date("2026-10-12"), _sum: { bytes_in: 9007199254740993n, bytes_out: 0n, connections: 0n }, _max: { updated_at: now }, _count: { _all: 2 } };
test("daily history keeps null gaps, measured zero, exact large counters, source freshness and same-read totals", () => {
  const result = projectHistory(7, { scope: "workspace", id: null }, window, [archive], [checkpoint], now);
  expect(result.days.map((d) => d.date)).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
  expect(result.days[0]!.usage.archive.bytes.value).toBe("0");
  expect(result.days[1]!.usage.archive.bytes.value).toBeNull();
  expect(result.days[1]!.usage.tst_ingress.connections.value).toBeNull();
  expect(result.days[2]!.usage.tst_ingress.bytes_in.value).toBe("9007199254740993");
  expect(result.days[2]!.usage.tst_ingress.bytes_out.value).toBe("0");
  expect(result.totals.tst_ingress.bytes_in.value).toBe("9007199254740993");
  expect(result.totals.archive.rows).toBe(1);
  expect(result.days[0]!.usage.archive.bytes.freshness.state).toBe("historical");
  expect(result.days[2]!.usage.tst_ingress.bytes_in.freshness.state).toBe("current");
  expect(projectHistory(7, { scope: "node", id: 1 }, window, [], [], now).days[0]!.usage.archive.bytes.freshness.reason).toBe("archive_not_attributed");
});
test("history rejects malformed scope, IDs, duplicate/invalid dates and overflowing groups", () => {
  for (const query of [{ scope: "workspace", id: "1" }, { scope: "forward" }, { scope: "node", id: "0" },
    { scope: "link", id: "9007199254740992" }, { scope: "node", id: "1e2" }, { scope: "other" }, { workspace_id: "8" }])
    expect(() => historyQuery(query, now)).toThrow();
  expect(() => projectHistory(7, { scope: "workspace", id: null }, window, [archive, archive], [], now)).toThrow("metrics_history_invalid");
  for (const date of [new Date("invalid"), new Date("2026-10-09"), new Date("2026-10-10T08:00:00Z")])
    expect(() => projectHistory(7, { scope: "workspace", id: null }, window, [{ ...archive, date }], [], now)).toThrow("metrics_history_invalid");
  expect(() => projectHistory(7, { scope: "workspace", id: null }, window, Array(4).fill(archive), [], now)).toThrow("metrics_limit_exceeded");
  expect(() => projectHistory(7, { scope: "link", id: 1 }, window, [archive], [], now)).toThrow("metrics_history_invalid");
});
test("history loader verifies current ownership before ledger access and filters immutable identities", async () => {
  const calls: { name: string; query: any }[] = [];
  let owned = true;
  const method = (name: string, result: () => unknown) => async (query: unknown) => { calls.push({ name, query }); return result(); };
  const client = { tunnel: { findFirst: method("forward", () => owned ? { id: 2 } : null) },
    node: { findFirst: method("node", () => ({ id: 1 })) }, linkResource: { findFirst: method("link", () => ({ id: 3 })) },
    tunnelTraffic: { groupBy: method("archive", () => [archive]) }, linkTrafficCheckpoint: { groupBy: method("checkpoint", () => [checkpoint]) } } as unknown as NonNullable<Parameters<typeof loadObservabilityHistory>[3]>;
  for (const [scope, field] of [["forward", "forward_id"], ["link", "link_id"], ["node", "node_id"]] as const) {
    calls.length = 0;
    await loadObservabilityHistory(7, window, { scope, id: 2 }, client, now);
    expect(calls[0]!.name).toBe(scope);
    expect(calls[0]!.query.where).toEqual(scope === "node" ? { id: 2, node_group: { workspace_id: 7 } }
      : scope === "forward" ? { id: 2, workspace_id: 7, category: "port_forward" } : { id: 2, workspace_id: 7 });
    const q = calls.find((c) => c.name === "checkpoint")!.query;
    expect(q.by).toEqual(["date"]); expect(q.take).toBe(32); expect(q.where.workspace_id).toBe(7); expect(q.where[field]).toBe(2);
    expect(q.where.date).toEqual({ gte: new Date("2026-10-10"), lt: new Date("2026-10-13") });
    expect(calls.filter((c) => c.name === "archive").length).toBe(scope === "forward" ? 1 : 0);
  }
  calls.length = 0; owned = false;
  await expect(loadObservabilityHistory(7, window, { scope: "forward", id: 2 }, client, now)).rejects.toThrow("metrics_resource_not_found");
  expect(calls.map((c) => c.name)).toEqual(["forward"]);
});
