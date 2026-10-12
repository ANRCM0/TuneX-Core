import { expect, test } from "bun:test";
import { Hono } from "hono";
import type { AppVariables } from "../../middlewares/auth.ts";
import { createObservabilityRoutes } from "../observability.ts";
import { canWorkspaceResourceAction, workspacePermissionDenied, type WorkspaceAccess } from "../../services/workspace.ts";
import { projectObservability } from "../../domain/observability/model.ts";
import { observabilityEnabled } from "../../services/observability.ts";

function setup(patch: Partial<WorkspaceAccess> = {}, enabled = true) {
  const calls: string[] = [], access: WorkspaceAccess = { id: 7, role: "viewer", kind: "personal", personalWorkspaceId: 7, customRoleId: null, ...patch };
  let fail = false;
  const app = new Hono<{ Variables: AppVariables }>();
  app.route("/api/observability", createObservabilityRoutes({ enabled: () => enabled,
    access: async (_c, action, resource = "forward") => {
      calls.push(`${resource}:${action}`);
      if (!canWorkspaceResourceAction(access, action, resource)) throw workspacePermissionDenied();
      return access;
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
