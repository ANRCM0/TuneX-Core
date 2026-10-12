import { beforeEach, expect, test } from "bun:test";
import { handleMock } from "../handler";
import { getStore, resetStore } from "../state";

beforeEach(resetStore);
const call = (path: string, workspaceId = 1, cookie = "tunex_session=u1", method = "GET") => handleMock(method, path, { query: {}, workspaceId, cookie });
test("demo discovers a disabled collector and does not fabricate snapshots", async () => {
  const response = await call("observability/capabilities");
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ enabled: false, schema_versions: [1], features: { workspace_snapshot: false, active_connections: false }, limits: { window_days: 31 } });
  expect((await call("observability/snapshot")).status).toBe(409);
  expect((await call("observability/snapshot", 1, "tunex_session=u1", "POST")).status).toBe(409);
});
test("mock discovery keeps auth, membership and both effective read permissions", async () => {
  expect((await call("observability/capabilities", 1, "")).status).toBe(401);
  expect((await call("observability/capabilities", 999999)).status).toBe(404);
  const db = getStore(), membership = db.workspaceMembers.find((member) => member.user_id === 1 && member.workspace_id === 1)!;
  membership.role = "admin"; membership.role_id = 999999; // missing custom role must not fall back to admin grants
  expect((await call("observability/capabilities")).status).toBe(403);
  membership.role = "viewer"; membership.role_id = null;
  expect((await call("observability/capabilities")).status).toBe(200);
});
