import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import type { ForwardOperation, UnifiedForwardCapabilities } from "@/lib/forward-unified";
import type { PortForward, UserNode } from "@/lib/types";
const bundle = await Bun.build({ entrypoints: [resolve(import.meta.dir, "browser-unified-entry.tsx")], target: "browser",
  define: { "process.env.NEXT_PUBLIC_API_MOCK": '"0"', "process.env.SERVER_API_BASE": '""', "process.env.NODE_ENV": '"development"' } });
if (!bundle.success) throw new Error(String(bundle.logs));
const js = await bundle.outputs[0].text();
const cssDirectory = resolve(import.meta.dir, "../../../../.next/static/chunks");
const productionCss = readdirSync(cssDirectory).filter((name) => name.endsWith(".css"));
if (!productionCss.length) throw new Error("Run the web production build before the browser fixture.");
let tst = false, delay = false, nextId = 42;
const calls: { path: string; method: string; workspaceId: number; body: unknown }[] = [];
const node = (id: number, role: "ingress" | "egress") => ({ id, node_id: `fixture-${id}`, role, connect_ip: "127.0.0.1", accepts_new_business: true } as UserNode);
const nodes = [node(11, "ingress"), node(12, "egress")];
const rows = new Map<number, PortForward[]>(); const operations = new Map<string, ForwardOperation>();
const operationForwards = new Map<string, number>();
function rule(id: number, transport: "native_plain" | "tst_v1" = "native_plain"): PortForward {
  return { id, name: transport === "tst_v1" ? "Secure fixture" : "Native fixture", path: "relay", transport, protocol: "tcp", mode: "relay", ingress_node_id: 11, egress_node_id: 12,
    ingress_node: nodes[0], egress_node: nodes[1], target_host: "127.0.0.1", target_port: 9000, listen_port: 25000 + id, config_revision: 1, applied_revision: 1, latest_revision: 1,
    desired_status: "active", apply_status: "active", created_at: "2026-10-11T00:00:00Z", updated_at: "2026-10-11T00:00:00Z",
    lifecycle: { desired: "active", deployment: "confirmed", runtime: "ready", transport, target_health: "unverified", traffic: null } } as PortForward;
}
rows.set(5, [rule(40), rule(41, "tst_v1")]); rows.set(6, []);
const response = (data: unknown, status = 200) => Response.json({ data }, { status });
const fail = (code: string, status = 409) => Response.json({ code, error: code }, { status });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unified Forward fixture</title><link rel="stylesheet" href="/production.css"></head><body class="bg-[var(--background)] text-[var(--foreground)]"><div id="root"></div><script src="/bundle.js"></script></body></html>`;
Bun.serve({ hostname: "127.0.0.1", port: 41975, async fetch(req) {
  const url = new URL(req.url), path = url.pathname;
  if (path === "/") return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  if (path === "/bundle.js") return new Response(js, { headers: { "Content-Type": "text/javascript" } });
  if (path === "/production.css") return new Response((await Promise.all(productionCss.map((name) => readFile(resolve(cssDirectory, name), "utf8")))).join("\n"), { headers: { "Content-Type": "text/css" } });
  if (path === "/favicon.ico") return new Response(null, { status: 204 });
  if (path === "/__test/state") return response({ calls });
  if (path === "/__test/reset" && req.method === "POST") { tst = false; delay = false; nextId = 42; calls.length = 0; operations.clear(); operationForwards.clear(); rows.set(5, [rule(40), rule(41, "tst_v1")]); rows.set(6, []); return response({ ok: true }); }
  if (path === "/__test/complete" && req.method === "POST") {
    for (const [id, operation] of operations) {
      operations.set(id, { ...operation, state: "completed", stage: "completed" });
      const row = [...rows.values()].flat().find((entry) => entry.id === operationForwards.get(id));
      if (row) { row.applied_revision = row.config_revision; row.apply_status = "active"; row.lifecycle = { ...row.lifecycle!, deployment: "confirmed", runtime: "ready" }; }
    }
    return response({ ok: true });
  }
  if (path === "/__test/scenario") { const input = await req.json() as Record<string, boolean>; tst = input.tst ?? tst; delay = input.delay ?? delay; return response({ tst, delay }); }
  const workspaceId = Number(req.headers.get("x-workspace-id")); if (![5, 6].includes(workspaceId)) return fail("workspace_denied", 403);
  if (req.method !== "GET" && req.headers.get("X-CSRF-Token") !== "1") return fail("csrf_failed", 403);
  const body = req.method === "GET" ? null : await req.json() as Record<string, unknown>; calls.push({ path, method: req.method, workspaceId, body });
  if (delay) await Bun.sleep(1_500);
  const scoped = rows.get(workspaceId)!;
  if (path === "/api/nodes") return response(nodes);
  if (path.endsWith("/diagnostics")) return response({ node_id: Number(path.split("/")[3]), reachability: "online", panel: { reported: { capabilities: ["forward.link.tst.v1", "forward.protocol.both.native.v1"] } } });
  if (path === "/api/forwards/capabilities") {
    const combinations: UnifiedForwardCapabilities["combinations"] = [];
    for (const route of ["direct", "relay"] as const) for (const transport of ["native_plain", "tst_v1"] as const) for (const protocol of ["tcp", "udp", "both"] as const) {
      const available = transport === "native_plain" || route === "relay" && tst;
      combinations.push({ path: route, transport, protocol, available, reason: available ? null : "feature_disabled", ingress_node_ids: [11], egress_node_ids: [12] });
    }
    return response({ native_both_enabled: true, tst_enabled: tst, transports: tst ? ["native_plain", "tst_v1"] : ["native_plain"], combinations, node_use_allowed: true });
  }
  if (path === "/api/forwards") {
    let filtered = scoped;
    if (url.searchParams.has("path")) filtered = filtered.filter((entry) => entry.path === url.searchParams.get("path"));
    if (url.searchParams.has("transport")) filtered = filtered.filter((entry) => entry.transport === url.searchParams.get("transport"));
    return response({ data: filtered, total: filtered.length, page: 1, page_size: 20 });
  }
  if (path === "/api/forward-operations" && req.method === "POST" && body) {
    if (body.transport === "tst_v1" && !tst) return fail("feature_disabled");
    const created = { ...rule(nextId++, body.transport as "native_plain" | "tst_v1"), ...body, mode: body.path, latest_revision: 1,
      ingress_node: nodes[0], egress_node: body.path === "relay" ? nodes[1] : null, apply_status: "pending", applied_revision: null,
      lifecycle: { desired: "active", deployment: "pending", runtime: "unknown", transport: body.transport, target_health: "unverified", traffic: null } } as PortForward;
    scoped.push(created); const receipt = { operation_id: crypto.randomUUID(), forward_id: null, state: "accepted", stage: "accepted", error_code: null };
    operations.set(receipt.operation_id, receipt); operationForwards.set(receipt.operation_id, created.id); return response(receipt, 202);
  }
  if (path.startsWith("/api/forward-operations/")) {
    const id = path.split("/")[3], receipt = operations.get(id);
    if (!receipt) return fail("operation_not_found", 404);
    const settled = { ...receipt, forward_id: operationForwards.get(id) ?? null,
      state: receipt.state === "accepted" ? "pending_apply" : receipt.state };
    operations.set(id, settled); return response(settled);
  }
  const match = /^\/api\/forwards\/(\d+)(?:\/(.*))?$/.exec(path); if (!match) return fail("not_found", 404);
  const id = Number(match[1]), row = scoped.find((entry) => entry.id === id); if (!row) return fail("not_found", 404);
  if (match[2] === "actions") {
    if (body?.action === "delete") { scoped.splice(scoped.indexOf(row), 1); return response({ ok: true }); }
    row.desired_status = body?.action === "suspend" ? "inactive" : "active"; row.apply_status = body?.action === "suspend" ? "suspended" : "pending";
    row.lifecycle = { ...row.lifecycle!, desired: body?.action === "suspend" ? "suspended" : "active", deployment: "pending", runtime: "unknown" }; return response(row);
  }
  if (match[2] === "history") return response([{ revision: 1, desired_status: "active", created_at: row.created_at, created_by_id: 1 }]);
  if (match[2] === "traffic") return response([]);
  if (match[2] === "diagnose") return response({ forward_id: id, mode: row.mode, protocol: row.protocol, generated_at: row.created_at, next_step: "Review the unverified inter-node segment.", segments: [
    { segment: "ingress_to_egress", method: "node_facts", verified: false, node_id: 11, node_key: "fixture-11", outcome: "ok", targets: [], results: [] }] });
  if (req.method === "PATCH") {
    const allowedPatch = new Set(["expected_revision", "name", "protocol", "ingress_node_id", "egress_node_id", "listen_port", "target_host", "target_port", "bytes_per_second_in", "bytes_per_second_out", "max_connections", "max_connections_per_ip"]);
    if (Object.keys(body ?? {}).some((key) => !allowedPatch.has(key))) return fail("invalid_input", 400);
    Object.assign(row, body); row.config_revision = (row.config_revision ?? 1) + 1; row.latest_revision = row.config_revision; row.lifecycle = { ...row.lifecycle!, deployment: "pending", runtime: "unknown" };
  }
  return response(row);
} });
console.log("Unified Forward HTTP fixture: http://127.0.0.1:41975");
