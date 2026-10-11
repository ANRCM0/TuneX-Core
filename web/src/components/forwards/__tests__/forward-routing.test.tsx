import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { routingChoices, routingDefaults, routingIntent } from "../forward-routing-model";
import { RouteHistory } from "../forward-routing-card";
import type { RouteGraph, RouteReceipt } from "@/lib/api/routing";

export const routingGraphFixture: RouteGraph = {
  digest: "a".repeat(64), nodes: [1, 2, 3, 4].map((id) => ({ id, node_key: `node-${id}`, role: "both", connection: "online", lifecycle: "active" })),
  edges: [
    { id: "binding:1", from_node_id: 1, to_node_id: 3, transport: "native_plain" },
    { id: "binding:2", from_node_id: 1, to_node_id: 2, transport: "native_plain" },
    { id: "binding:3", from_node_id: 2, to_node_id: 3, transport: "native_plain" },
    { id: "binding:4", from_node_id: 1, to_node_id: 4, transport: "native_plain" },
    { id: "link:1", from_node_id: 1, to_node_id: 3, transport: "tst_v1" },
    { id: "binding:5", from_node_id: 2, to_node_id: 1, transport: "native_plain" },
  ],
  forwards: [{ id: 40, revision: 5, ingress_node_id: 1, target_node_id: 3, transport: "native_plain", path: "relay", current_edge_ids: ["binding:1"], issues: [] }],
};
test("candidate picker keeps fixed target authority and carrier, rejects loops and unsupported middle roles", () => {
  const choices = routingChoices(routingGraphFixture, 40);
  expect(choices.map((c) => c.edge_ids)).toEqual([["binding:1"], ["binding:2", "binding:3"]]);
  const wrongRole = structuredClone(routingGraphFixture); wrongRole.nodes[1].role = "ingress";
  expect(routingChoices(wrongRole, 40)).toHaveLength(1);
  expect(routingChoices(routingGraphFixture, 999)).toEqual([]);
});
test("intent is bound to current graph and business revision, automation defaults off", () => {
  const intent = routingIntent(routingGraphFixture, 40, "weighted", routingChoices(routingGraphFixture, 40));
  expect(intent).toMatchObject({ topology_digest: "a".repeat(64), expected_revision: 5, strategy: "weighted" });
  expect(routingDefaults(intent)).toMatchObject({ enabled: false, auto_failover: false, auto_failback: false, expected_policy_version: 0 });
  expect(() => routingIntent(routingGraphFixture, 40, "priority", [])).toThrow();
});
test("receipt UI preserves unknown ACK and shows pending separately from actually confirmed", () => {
  const row: RouteReceipt = { decision_id: "one", candidate_id: "primary", node_ids: [1, 2, 3], state: "pending", reason: "initial_qualified_path",
    expected_revision: 5, desired_revision: 6, applied_revision: null, created_at: "2026-10-11T00:00:00Z", confirmed_at: null };
  for (const locale of ["zh", "en"]) {
    const html = renderToStaticMarkup(<RouteHistory history={[row]} locale={locale} />);
    expect(html).toContain("pending"); expect(html).toContain("5 / 6 / ?"); expect(html).not.toContain("PRIVATE KEY");
    expect(renderToStaticMarkup(<RouteHistory history={[]} locale={locale} />)).not.toContain(">0<");
  }
});
