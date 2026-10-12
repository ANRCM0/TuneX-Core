import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppVariables } from "../middlewares/auth.ts";
import { resolveWorkspaceAccess, canWorkspaceResourceAction, workspacePermissionDenied } from "../services/workspace.ts";
import { loadObservability, observabilityEnabled } from "../services/observability.ts";
import { metricWindow, ObservabilityError, OBSERVABILITY_LIMITS } from "../domain/observability/model.ts";

export function createObservabilityRoutes(deps: {
  load?: typeof loadObservability; access?: typeof resolveWorkspaceAccess; enabled?: typeof observabilityEnabled;
} = {}) {
  const routes = new Hono<{ Variables: AppVariables }>();
  const enabled = deps.enabled ?? observabilityEnabled;
  routes.onError((error, c) => {
    c.header("Cache-Control", "no-store");
    if (error instanceof HTTPException) {
      const response = error.getResponse(), headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store");
      return new Response(response.body, { status: response.status, headers });
    }
    if (error instanceof z.ZodError) return c.json({ error: "指标参数不合法", code: "invalid_input" }, 400);
    if (error instanceof ObservabilityError) return c.json({ error: error.code, code: error.code }, error.status);
    return c.json({ error: "指标暂不可用", code: "metrics_unavailable" }, 503);
  });
  routes.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    const access = await (deps.access ?? resolveWorkspaceAccess)(c, "read", "forward");
    if (!canWorkspaceResourceAction(access, "read", "node")) throw workspacePermissionDenied();
    c.set("workspace", access);
    if (!enabled() && !(c.req.method === "GET" && /\/capabilities\/?$/.test(c.req.path)))
      return c.json({ error: "统一指标尚未启用", code: "observability_disabled" }, 409);
    await next();
  });
  routes.get("/capabilities", (c) => c.json({ data: { enabled: enabled(), schema_versions: [1], stage: "experimental",
    features: { workspace_snapshot: enabled(), archived_usage: enabled(), tst_ingress_usage: enabled(),
      node_telemetry: enabled(), target_tcp_observations: enabled(), active_connections: false, live_throughput: false,
      end_to_end_latency: false, error_rates: false, alerts: false, repair: false }, limits: OBSERVABILITY_LIMITS } }));
  routes.get("/snapshot", async (c) => {
    const query = new URL(c.req.url).searchParams;
    if (query.toString().length > 256 || [...query.keys()].some((key) => query.getAll(key).length !== 1))
      throw new ObservabilityError("invalid_metric_window", 400);
    const window = metricWindow(Object.fromEntries(query));
    return c.json({ data: await (deps.load ?? loadObservability)(c.get("workspace")!.id, window) });
  });
  return routes;
}
export const observabilityRoutes = createObservabilityRoutes();
