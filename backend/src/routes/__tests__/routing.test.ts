import { expect, test } from "bun:test";
import { Hono } from "hono";
import type { AppVariables } from "../../middlewares/auth.ts";
import { createRoutingRoutes } from "../routing.ts";
import { canWorkspaceResourceAction, workspacePermissionDenied, type WorkspaceAccess } from "../../services/workspace.ts";
import type { RoutingTopology } from "../../domain/routing/model.ts";

function setup(patch: Partial<WorkspaceAccess> = {}, enabled = true) {
  const access: WorkspaceAccess = { id: 7, role: "owner", kind: "personal", personalWorkspaceId: 7, customRoleId: null, ...patch };
  const calls: string[] = [];
  const graph: RoutingTopology = { schema_version: 1, workspace_id: 7, generated_at: new Date().toISOString(), digest: "a".repeat(64),
    nodes: [{ id: 1, workspace_id: 7, node_key: "a", role: "ingress", lifecycle: "active", connection: "online",
      capabilities: { state: "current", reported_at: null, native_plain: ["tcp"], tst_v1: [] },
      health: { state: "unknown", reason: "probe_not_recorded", observed_at: null } }], edges: [], notices: [], execution_enabled: false,
    forwards: [{ id: 4, workspace_id: 7, revision: 1, path: "direct", transport: "native_plain", protocol: "tcp", ingress_node_id: 1,
      target_node_id: 1, current_edge_ids: [], issues: [], desired_status: "active", apply_status: "active" }] };
  let failLoad = false;
  const app = new Hono<{ Variables: AppVariables }>();
  app.route("/api/routing", createRoutingRoutes({ enabled: () => enabled,
    access: async (_c, action, resource = "tunnel") => {
      calls.push(`${resource}:${action}`);
      if (!canWorkspaceResourceAction(access, action, resource)) throw workspacePermissionDenied();
      return access;
    }, load: async (workspace) => {
      calls.push(`load:${workspace}`);
      if (failLoad) throw new Error("private-db-detail-password");
      return graph;
    } }));
  const input = { schema_version: 1, forward_id: 4, expected_revision: 1, topology_digest: graph.digest, strategy: "priority",
    hop_limit: 1, candidates: [{ id: "direct", edge_ids: [], priority: 0, weight: 1 }] };
  const request = (body: unknown = input) => app.request("/api/routing/preview", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { app, access, calls, graph, input, request, fail: () => { failLoad = true; } };
}

test("mounted real router serves topology and preview with no-store and read authorization", async () => {
  const s = setup();
  const graph = await s.app.request("/api/routing/topology");
  expect(graph.status).toBe(200); expect(graph.headers.get("cache-control")).toBe("no-store");
  expect(s.calls).toEqual(["forward:read", "load:7"]);
  const preview = await s.request();
  expect(preview.status).toBe(200);
  expect((await preview.json() as { data: RoutingTopology }).data.execution_enabled).toBe(false);
  expect(preview.headers.get("cache-control")).toBe("no-store");
});
test("disabled flag and role denials cannot reach the graph loader", async () => {
  const s = setup({}, false);
  const res = await s.app.request("/api/routing/topology");
  expect(res.status).toBe(409); expect((await res.json() as { code: string }).code).toBe("routing_disabled");
  expect(s.calls).toEqual(["forward:read"]);
  const capability = await s.app.request("/api/routing/capabilities");
  expect(capability.status).toBe(200);
  const discovered = await capability.json() as { data: { enabled: boolean; features: { path_selection: boolean } } };
  expect(discovered.data.enabled).toBe(false); expect(discovered.data.features.path_selection).toBe(false);
  expect(s.calls).toEqual(["forward:read", "forward:read"]);
  for (const permissions of [{ "node:read": true }, { "forward:read": true }]) {
    const denied = setup({ role: "member", customRoleId: 1, customPermissions: permissions });
    const response = await denied.app.request("/api/routing/topology");
    expect(response.status).toBe(403); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(denied.calls).toEqual(["forward:read"]);
  }
});
test("viewer can read topology but needs node:use to preview a new route intent", async () => {
  const s = setup({ role: "viewer" });
  expect((await s.app.request("/api/routing/topology")).status).toBe(200);
  s.calls.length = 0;
  expect((await s.request()).status).toBe(403);
  expect(s.calls).toEqual(["forward:read"]);
  const custom = setup({ role: "viewer", customRoleId: 1,
    customPermissions: { "forward:read": true, "node:read": true, "node:use": true } });
  expect((await custom.request()).status).toBe(200);
});
test("invalid JSON, oversized bodies and excessive candidates fail before any DB read", async () => {
  const s = setup();
  expect((await s.request({ ...s.input, candidates: Array(17).fill(s.input.candidates[0]) })).status).toBe(400);
  expect((await s.request({ ...s.input, secret: "x".repeat(40_000) })).status).toBe(413);
  const underreported = await s.app.request("/api/routing/preview", { method: "POST", headers: { "content-length": "1" }, body: "x".repeat(40_000) });
  expect(underreported.status).toBe(413);
  const malformed = await s.app.request("/api/routing/preview", { method: "POST", body: "{" });
  expect(malformed.status).toBe(400);
  expect(s.calls.every((c) => c === "forward:read")).toBe(true);
});
test("stale revision and foreign resource errors remain distinct, DB failures remain redacted", async () => {
  const s = setup();
  const conflict = await s.request({ ...s.input, expected_revision: 2 });
  expect(conflict.status).toBe(409); expect((await conflict.json() as { code: string }).code).toBe("revision_conflict");
  const foreign = await s.request({ ...s.input, forward_id: 99 });
  expect(foreign.status).toBe(404); expect((await foreign.json() as { code: string }).code).toBe("forward_not_found");
  s.fail();
  const failed = await s.app.request("/api/routing/topology");
  expect(failed.status).toBe(503); expect(await failed.text()).not.toContain("private-db");
});
