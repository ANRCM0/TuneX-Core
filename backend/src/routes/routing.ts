import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppVariables } from "../middlewares/auth.ts";
import { resolveWorkspaceAccess, canWorkspaceResourceAction, workspacePermissionDenied } from "../services/workspace.ts";
import { loadRoutingTopology, routingEnabled } from "../services/routing-topology.ts";
import { RoutingError, RoutingPreviewSchema, previewRoutingPolicy, ROUTING_LIMITS, ROUTING_SCHEMA_VERSION,
  ROUTING_MAX_CANDIDATES, ROUTING_MAX_HOPS, ROUTING_MAX_REQUEST_BYTES } from "../domain/routing/model.ts";

/** Bound actual bytes, including streaming requests and false Content-Length headers. */
async function readPreviewJson(request: Request): Promise<unknown> {
  if (!request.body) throw new RoutingError("invalid_input", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > ROUTING_MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => {});
        throw new RoutingError("request_too_large", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof RoutingError) throw error;
    throw new RoutingError("invalid_input", 400);
  } finally { reader.releaseLock(); }
}

/** Injectable read boundary keeps HTTP tests independent of process-wide module mocks. */
export function createRoutingRoutes(deps: {
  load?: typeof loadRoutingTopology; access?: typeof resolveWorkspaceAccess; enabled?: typeof routingEnabled;
} = {}) {
  const load = deps.load ?? loadRoutingTopology;
  const resolveAccess = deps.access ?? resolveWorkspaceAccess;
  const enabled = deps.enabled ?? routingEnabled;
  const routingRoutes = new Hono<{ Variables: AppVariables }>();
  routingRoutes.onError((error, c) => {
    c.header("Cache-Control", "no-store");
    if (error instanceof HTTPException) {
      const response = error.getResponse();
      const headers = new Headers(response.headers); headers.set("Cache-Control", "no-store");
      return new Response(response.body, { status: response.status, headers });
    }
    if (error instanceof z.ZodError) return c.json({ error: "路由参数不合法", code: "invalid_input" }, 400);
    if (error instanceof RoutingError) return c.json({ error: error.code, code: error.code }, error.status);
    return c.json({ error: "路由拓扑暂不可用", code: "routing_unavailable" }, 503);
  });
  routingRoutes.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    const access = await resolveAccess(c, "read", "forward");
    if (!canWorkspaceResourceAction(access, "read", "node")) throw workspacePermissionDenied();
    c.set("workspace", access);
    const discovery = c.req.method === "GET" && /\/capabilities\/?$/.test(c.req.path);
    if (!enabled() && !discovery) return c.json({ error: "路由预览尚未启用", code: "routing_disabled" }, 409);
    await next();
  });
  routingRoutes.get("/capabilities", (c) => c.json({ data: { schema_versions: [ROUTING_SCHEMA_VERSION], enabled: enabled(), stage: "experimental",
    features: { workspace_topology: enabled(), policy_preview: enabled(), policy_storage: false,
      active_probes: false, path_selection: false, failover: false, multi_hop_execution: false },
    limits: { ...ROUTING_LIMITS, candidates: ROUTING_MAX_CANDIDATES, hops: ROUTING_MAX_HOPS, request_bytes: ROUTING_MAX_REQUEST_BYTES } } }));
  routingRoutes.get("/topology", async (c) => c.json({ data: await load(c.get("workspace")!.id) }));
  routingRoutes.post("/preview", async (c) => {
    const access = c.get("workspace")!;
    if (!canWorkspaceResourceAction(access, "use", "node")) throw workspacePermissionDenied();
    // Parse before querying; oversized/invalid candidate populations do not reach the DB.
    const input = RoutingPreviewSchema.parse(await readPreviewJson(c.req.raw));
    return c.json({ data: previewRoutingPolicy(await load(access.id), input) });
  });
  return routingRoutes;
}
export const routingRoutes = createRoutingRoutes();
