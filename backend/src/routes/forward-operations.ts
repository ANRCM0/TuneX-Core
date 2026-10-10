import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppVariables } from "../middlewares/auth.ts";
import { resolveWorkspaceAccess } from "../services/workspace.ts";
import { LinkResourceError } from "../services/link-errors.ts";
import { submitForwardOperation, getForwardOperation } from "../services/forward-application.ts";
export const forwardOperationsRoutes = new Hono<{ Variables: AppVariables }>();
forwardOperationsRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.set("workspace", await resolveWorkspaceAccess(c, c.req.method === "POST" ? "create" : "read", "forward"));
  await next();
});
forwardOperationsRoutes.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse();
  if (error instanceof LinkResourceError) return c.json({ error: error.code, code: error.code }, error.status);
  if (error instanceof z.ZodError) return c.json({ error: "转发参数不合法", code: "invalid_input", reasons: error.issues.map((i) => i.message) }, 400);
  return c.json({ error: "转发操作未完成", code: "forward_operation_failed" }, 503);
});
forwardOperationsRoutes.post("/", async (c) => {
  const raw = await c.req.json().catch(() => { throw new LinkResourceError("invalid_input", 400); });
  const receipt = await submitForwardOperation(c.get("workspace")!, c.get("user")!.id, raw);
  return c.json({ data: receipt }, receipt.replayed ? 200 : 202);
});
forwardOperationsRoutes.get("/:id", async (c) => c.json({ data: await getForwardOperation(c.get("workspace")!.id,
  c.get("user")!.id, z.string().uuid().parse(c.req.param("id"))) }));
