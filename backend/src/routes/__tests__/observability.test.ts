import { expect, test } from "bun:test";
import { Hono } from "hono";
import type { AppVariables } from "../../middlewares/auth.ts";
import { createObservabilityRoutes } from "../observability.ts";
import { canWorkspaceResourceAction, workspacePermissionDenied, type WorkspaceAccess } from "../../services/workspace.ts";
import { projectObservability } from "../../domain/observability/model.ts";
import { observabilityEnabled } from "../../services/observability.ts";
import { projectHistory } from "../../domain/observability/history.ts";

function setup(patch: Partial<WorkspaceAccess> = {}, enabled = true) {
  const calls: string[] = [], access: WorkspaceAccess = { id: 7, role: "viewer", kind: "personal", personalWorkspaceId: 7, customRoleId: null, ...patch };
  let fail = false;
  const app = new Hono<{ Variables: AppVariables }>();
  app.route("/api/observability", createObservabilityRoutes({ enabled: () => enabled,
    access: async (_c, action, resource = "forward") => {
      calls.push(`${resource}:${action}`);
      if (!canWorkspaceResourceAction(access, action, resource)) throw workspacePermissionDenied();
      return access;
    }, history: async (workspace, window, selection) => {
      calls.push(`history:${workspace}:${selection.scope}:${selection.id}`);
      if (fail) throw new Error("private-password-and-sql");
      return projectHistory(workspace, selection, window, [], []);
    }, load: async (workspace, window) => {
      calls.push(`load:${workspace}:${window.start_date}`);
      if (fail) throw new Error("private-password-and-sql");
      return projectObservability(workspace, { nodes: [], links: [], forwards: [], archives: [], checkpoints: [], targets: [] }, window);
    } }));
  return { calls, app, fail: () => { fail = true; } };
}
test("default off is exact opt-in; authenticated discovery never reads the metrics store", async () => {
  const previous = process.env.TUNEX_OBSERVABILITY_ENABLED;
  try {
    for (const value of [undefined, "false", "TRUE", "1", "true"]) {
      if (value === undefined) delete process.env.TUNEX_OBSERVABILITY_ENABLED; else process.env.TUNEX_OBSERVABILITY_ENABLED = value;
      expect(observabilityEnabled()).toBe(value === "true");
    }
  } finally { if (previous === undefined) delete process.env.TUNEX_OBSERVABILITY_ENABLED; else process.env.TUNEX_OBSERVABILITY_ENABLED = previous; }
  const s = setup({}, false);
  const blocked = await s.app.request("/api/observability/snapshot");
  expect(blocked.status).toBe(409); expect(blocked.headers.get("cache-control")).toBe("no-store");
  const discovery = await s.app.request("/api/observability/capabilities");
  expect(discovery.status).toBe(200); expect((await discovery.json() as { data: { enabled: boolean } }).data.enabled).toBe(false);
  expect(s.calls).toEqual(["forward:read", "forward:read"]);
});

test("history has the same flag, effective permissions, strict query and redacted failure gates", async () => {
  expect((await setup({}, false).app.request("/api/observability/history")).status).toBe(409);
  expect((await setup({ customRoleId: 1, customPermissions: { "forward:read": true } }).app.request("/api/observability/history")).status).toBe(403);
  const s = setup();
  for (const query of ["scope=forward", "scope=workspace&id=1", "scope=node&id=1&id=2", "scope=node&id=-1", "workspace_id=8", "scope=target", "padding=" + "a".repeat(257)])
    expect((await s.app.request(`/api/observability/history?${query}`)).status).toBe(400);
  expect(s.calls.some((c) => c.startsWith("history:"))).toBe(false);
  const response = await s.app.request("/api/observability/history?scope=link&id=3&start_date=2020-01-01&end_date=2020-01-02");
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
  expect((await response.json() as any).data.selection).toEqual({ scope: "link", id: 3 });
  expect(s.calls.at(-1)).toBe("history:7:link:3");
  s.fail();
  const failed = await s.app.request("/api/observability/history");
  expect(failed.status).toBe(503); expect(await failed.json()).toEqual({ error: "指标暂不可用", code: "metrics_unavailable" });
});
test("viewer snapshot uses resolved Workspace and returns no-store", async () => {
  const s = setup();
  const response = await s.app.request("/api/observability/snapshot?start_date=2020-01-01&end_date=2020-01-02");
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(s.calls).toEqual(["forward:read", "load:7:2020-01-01"]);
  expect((await response.json() as { data: { workspace_id: number } }).data.workspace_id).toBe(7);
});
test("custom roles require both Forward and Node read without a base-role fallback", async () => {
  for (const permissions of [{ "node:read": true }, { "forward:read": true }, {}]) {
    const s = setup({ role: "admin", customRoleId: 1, customPermissions: permissions });
    const response = await s.app.request("/api/observability/snapshot");
    expect(response.status).toBe(403); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(s.calls.some((c) => c.startsWith("load:"))).toBe(false);
  }
});
test("invalid or duplicate query parameters fail before DB access; writes have no handler", async () => {
  const s = setup();
  for (const query of ["start_date=invalid", "workspace_id=8", "end_date=2026-01-01&end_date=2026-01-02", `padding=${"a".repeat(257)}`])
    expect((await s.app.request(`/api/observability/snapshot?${query}`)).status).toBe(400);
  expect((await s.app.request("/api/observability/snapshot", { method: "POST" })).status).toBe(404);
  expect(s.calls.some((c) => c.startsWith("load:"))).toBe(false);
});
test("storage failures remain redacted and no-store", async () => {
  const s = setup(); s.fail();
  const response = await s.app.request("/api/observability/snapshot");
  expect(response.status).toBe(503); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: "指标暂不可用", code: "metrics_unavailable" });
});
