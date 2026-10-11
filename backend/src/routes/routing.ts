import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppVariables } from "../middlewares/auth.ts";
import { resolveWorkspaceAccess, canWorkspaceResourceAction, workspacePermissionDenied } from "../services/workspace.ts";
import { loadRoutingTopology, routingEnabled } from "../services/routing-topology.ts";
import { collectRoutingProbe, readRoutingProbe, defaultRoutingProbeDeps, routingProbesEnabled,
  type RoutingProbeDeps } from "../services/routing-probe.ts";
import { RoutingProbeInputSchema, ROUTING_PROBE_LIMITS } from "../domain/routing/probe.ts";
import { RoutingPolicyInputSchema } from "../domain/routing/policy.ts";
import { saveRoutingPolicy, readRoutingPolicy, defaultRoutingPolicyDeps, routingPoliciesEnabled, evaluateRoutingPolicy } from "../services/routing-policy.ts";
import { collectRoutingEdgeProbe, readRoutingEdgeProbe, defaultRoutingEdgeProbeDeps, RoutingEdgeProbeInputSchema } from "../services/routing-edge-probe.ts";
import { RoutingError, RoutingPreviewSchema, previewRoutingPolicy, ROUTING_LIMITS, ROUTING_SCHEMA_VERSION,
  ROUTING_MAX_CANDIDATES, ROUTING_MAX_HOPS, ROUTING_MAX_REQUEST_BYTES } from "../domain/routing/model.ts";

/** Bound actual bytes, including streaming requests and false Content-Length headers. */
async function readRoutingJson(request: Request): Promise<unknown> {
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
  probesEnabled?: typeof routingProbesEnabled; probeDeps?: () => Promise<RoutingProbeDeps>;
} = {}) {
  const load = deps.load ?? loadRoutingTopology;
  const resolveAccess = deps.access ?? resolveWorkspaceAccess;
  const enabled = deps.enabled ?? routingEnabled;
  const probesEnabled = () => enabled() && (deps.probesEnabled ?? routingProbesEnabled)();
  const probeDeps = async () => ({ ...await (deps.probeDeps ?? defaultRoutingProbeDeps)(), enabled: probesEnabled });
  const routingRoutes = new Hono<{ Variables: AppVariables }>();
  routingRoutes.onError((error, c) => {
    c.header("Cache-Control", "no-store");
    if (error instanceof HTTPException) {
      const response = error.getResponse();
      const headers = new Headers(response.headers); headers.set("Cache-Control", "no-store");
      return new Response(response.body, { status: response.status, headers });
    }
    if (error instanceof z.ZodError) return c.json({ error: "路由参数不合法", code: "invalid_input" }, 400);
    if (error instanceof RoutingError) {
      if (error.code === "probe_budget_exhausted") c.header("Retry-After", String(ROUTING_PROBE_LIMITS.reservation_ms / 1000));
      return c.json({ error: error.code, code: error.code }, error.status);
    }
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
    features: { workspace_topology: enabled(), policy_preview: enabled(), policy_storage: routingPoliciesEnabled(),
      active_probes: probesEnabled(), native_tcp_target_probes: probesEnabled(), tst_target_probes: probesEnabled(), node_icmp_edge_probes: probesEnabled(),
      path_selection: false, failover: false, multi_hop_execution: false },
    limits: { ...ROUTING_LIMITS, candidates: ROUTING_MAX_CANDIDATES, hops: ROUTING_MAX_HOPS,
      request_bytes: ROUTING_MAX_REQUEST_BYTES, probes: ROUTING_PROBE_LIMITS } } }));
  routingRoutes.get("/topology", async (c) => c.json({ data: await load(c.get("workspace")!.id) }));
  routingRoutes.post("/preview", async (c) => {
    const access = c.get("workspace")!;
    if (!canWorkspaceResourceAction(access, "use", "node")) throw workspacePermissionDenied();
    // Parse before querying; oversized/invalid candidate populations do not reach the DB.
    const input = RoutingPreviewSchema.parse(await readRoutingJson(c.req.raw));
    return c.json({ data: previewRoutingPolicy(await load(access.id), input) });
  });
  routingRoutes.post("/probes", async (c) => {
    const access = c.get("workspace")!;
    if (!canWorkspaceResourceAction(access, "use", "node")) throw workspacePermissionDenied();
    if (!probesEnabled()) throw new RoutingError("routing_probes_disabled", 409);
    const input = RoutingProbeInputSchema.parse(await readRoutingJson(c.req.raw));
    return c.json({ data: await collectRoutingProbe(access.id, input, await probeDeps()) });
  });
  routingRoutes.get("/probes/:forwardId", async (c) => {
    if (!probesEnabled()) throw new RoutingError("routing_probes_disabled", 409);
    const id = z.coerce.number().int().positive().max(2_147_483_647).parse(c.req.param("forwardId"));
    return c.json({ data: await readRoutingProbe(c.get("workspace")!.id, id, await probeDeps()) });
  });
  routingRoutes.put("/policies/:forwardId", async (c) => {
    const access = c.get("workspace")!, actor = c.get("user")!;
    if (!canWorkspaceResourceAction(access, "use", "node")) throw workspacePermissionDenied();
    if (!routingPoliciesEnabled()) throw new RoutingError("routing_policies_disabled", 409);
    const input = RoutingPolicyInputSchema.parse(await readRoutingJson(c.req.raw));
    if (String(input.intent.forward_id) !== c.req.param("forwardId")) throw new RoutingError("invalid_input", 400);
    const dependencies = await defaultRoutingPolicyDeps((creator) => {
      if (!canWorkspaceResourceAction(access, "update", "forward", creator === actor.id)) throw workspacePermissionDenied();
    });
    return c.json({ data: await saveRoutingPolicy(access.id, actor.id, input, dependencies) });
  });
  routingRoutes.post("/edge-probes", async (c) => {
    const access = c.get("workspace")!;
    if (!canWorkspaceResourceAction(access, "use", "node")) throw workspacePermissionDenied();
    if (!probesEnabled()) throw new RoutingError("routing_probes_disabled", 409);
    const input = RoutingEdgeProbeInputSchema.parse(await readRoutingJson(c.req.raw));
    return c.json({ data: await collectRoutingEdgeProbe(access.id, input, await defaultRoutingEdgeProbeDeps()) });
  });
  routingRoutes.get("/edge-probes/:edgeId", async (c) => {
    const input = RoutingEdgeProbeInputSchema.parse({ schema_version: 1, edge_id: c.req.param("edgeId") });
    if (!probesEnabled()) throw new RoutingError("routing_probes_disabled", 409);
    return c.json({ data: await readRoutingEdgeProbe(c.get("workspace")!.id, input.edge_id, await defaultRoutingEdgeProbeDeps()) });
  });
  routingRoutes.get("/policies/:forwardId", async (c) => {
    const id = z.coerce.number().int().positive().max(2_147_483_647).parse(c.req.param("forwardId"));
    return c.json({ data: await readRoutingPolicy(c.get("workspace")!.id, id) });
  });
  routingRoutes.get("/policies/:forwardId/decision", async (c) => {
    const id = z.coerce.number().int().positive().max(2_147_483_647).parse(c.req.param("forwardId"));
    return c.json({ data: await evaluateRoutingPolicy(c.get("workspace")!.id, id) });
  });
  return routingRoutes;
}
export const routingRoutes = createRoutingRoutes();
