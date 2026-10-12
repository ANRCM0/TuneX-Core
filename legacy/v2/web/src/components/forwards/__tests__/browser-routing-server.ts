import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import type { RouteGraph, RoutePolicy, RoutePolicyInput } from "@/lib/api/routing";
const bundle = await Bun.build({ entrypoints: [resolve(import.meta.dir, "browser-routing-entry.tsx")], target: "browser",
  define: { "process.env.NEXT_PUBLIC_API_MOCK": '"0"', "process.env.SERVER_API_BASE": '""', "process.env.NODE_ENV": '"development"' } });
if (!bundle.success) throw new Error(String(bundle.logs));
const js = await bundle.outputs[0].text(), cssDir = resolve(import.meta.dir, "../../../../.next/static/chunks");
const css = (await Promise.all(readdirSync(cssDir).filter((name) => name.endsWith(".css")).map((name) => readFile(resolve(cssDir, name), "utf8")))).join("\n");
if (!css) throw new Error("Build production CSS before browser acceptance.");
let enabled = true, conflict = false, delay = false, policy: RoutePolicy | null = null;
const calls: { path: string; method: string; workspaceId: number; body: unknown }[] = [];
const data = (value: unknown) => Response.json({ data: value });
const fail = (code: string, status: number) => Response.json({ code }, { status });
const graph: RouteGraph = { digest: "a".repeat(64), nodes: [1, 2, 3].map((id) => ({ id, node_key: `Fixture node ${id}`, role: "both", connection: "online", lifecycle: "active" })),
  edges: [{ id: "binding:1", from_node_id: 1, to_node_id: 3, transport: "native_plain" }, { id: "binding:2", from_node_id: 1, to_node_id: 2, transport: "native_plain" }, { id: "binding:3", from_node_id: 2, to_node_id: 3, transport: "native_plain" }],
  forwards: [{ id: 40, revision: 5, ingress_node_id: 1, target_node_id: 3, transport: "native_plain", path: "relay", current_edge_ids: ["binding:1"], issues: [] }] };
Bun.serve({ hostname: "127.0.0.1", port: 41976, async fetch(req) {
  const path = new URL(req.url).pathname;
  if (path === "/") return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/production.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>', { headers: { "Content-Type": "text/html; charset=utf-8" } });
  if (path === "/bundle.js") return new Response(js, { headers: { "Content-Type": "text/javascript" } });
  if (path === "/production.css") return new Response(css, { headers: { "Content-Type": "text/css" } });
  if (path === "/favicon.ico") return new Response(null, { status: 204 });
  if (path === "/__test/state") return data({ calls });
  if (path === "/__test/reset") { enabled = true; conflict = false; delay = false; policy = null; calls.length = 0; return data(true); }
  if (path === "/__test/scenario") { const body = await req.json(); enabled = body.enabled ?? enabled; conflict = body.conflict ?? conflict; delay = body.delay ?? delay; return data(true); }
  const workspaceId = Number(req.headers.get("x-workspace-id"));
  if (![5, 6].includes(workspaceId)) return fail("workspace_denied", 403);
  if (req.method !== "GET" && req.headers.get("X-CSRF-Token") !== "1") return fail("csrf_failed", 403);
  const body = req.method === "GET" ? null : await req.json(); calls.push({ path, method: req.method, workspaceId, body });
  if (delay) await Bun.sleep(1200);
  if (path === "/api/routing/capabilities") return data({ enabled, features: { policy_storage: enabled, policy_preview: enabled, active_probes: enabled, path_selection: false, multi_hop_execution: false } });
  if (path === "/api/routing/topology") return data(workspaceId === 5 ? graph : { ...graph, forwards: [], nodes: [], edges: [] });
  if (workspaceId !== 5) return fail("forward_not_found", 404);
  if (path === "/api/routing/policies/40/history") return data(policy ? [{ decision_id: "fixture-receipt", candidate_id: "primary", node_ids: [1, 2, 3], state: "pending", reason: "initial_qualified_path", expected_revision: 5, desired_revision: 6, applied_revision: null, created_at: "2026-10-11T00:00:00Z", confirmed_at: null }] : []);
  if (path === "/api/routing/policies/40/decision") return data({ selected_candidate_id: null, current_candidate_id: null, reason: "no_qualified_path", cooldown_remaining_ms: 0,
    candidates: policy?.policy.intent.candidates.map((c) => ({ ...c, qualified: false, blockers: ["observation_missing"], healthy_checks: 0, failure_checks: 0 })) ?? [] });
  if (path === "/api/routing/policies/40" && req.method === "GET") return data(policy);
  if (path === "/api/routing/policies/40" && req.method === "PUT") {
    if (conflict || body.expected_policy_version !== (policy?.version ?? 0)) return fail("policy_version_conflict", 409);
    policy = { version: (policy?.version ?? 0) + 1, forward_revision: 5, policy: body as RoutePolicyInput, last_decision: null, execution_enabled: false, authority_current: true, revision_current: true };
    return data(policy);
  }
  if (path === "/api/routing/preview") return data({ valid: true, candidates: body.candidates.map((c: { edge_ids: string[] }) => ({ ...c, node_ids: c.edge_ids.length === 1 ? [1, 3] : [1, 2, 3], valid: true, reasons: [], admission_issues: c.edge_ids.length === 2 ? ["multi_hop_execution_unavailable"] : [] })) });
  if (path === "/api/routing/probes") return data({ state: "reachable" });
  return fail("not_found", 404);
} });
