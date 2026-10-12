import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { metricCapabilities, metricFixture, historyFixture } from "./metric-fixture";
import { historyQuery } from "../../../../../backend/src/domain/observability/history";
import { defaultMetricWindow } from "../metric-display";

const bundle = await Bun.build({ entrypoints: [resolve(import.meta.dir, "browser-metrics-entry.tsx")], target: "browser",
  define: { "process.env.NEXT_PUBLIC_API_MOCK": '"0"', "process.env.SERVER_API_BASE": '""', "process.env.NODE_ENV": '"development"' } });
if (!bundle.success) throw new Error(String(bundle.logs));
const js = await bundle.outputs[0].text(), cssDir = resolve(import.meta.dir, "../../../../.next/static/chunks");
const css = (await Promise.all(readdirSync(cssDir).filter((name) => name.endsWith(".css")).map((name) => readFile(resolve(cssDir, name), "utf8")))).join("\n");
if (!css) throw new Error("Build production CSS before browser acceptance.");
let enabled = true, failure = 0, delay = false, mismatch = false, historyFailure = 0, historyDelay = false, historyMismatch = false, historyEnabled = true;
const calls: { path: string; method: string; workspaceId: number; query: string }[] = [];
const data = (value: unknown) => Response.json({ data: value }, { headers: { "Cache-Control": "no-store" } });
Bun.serve({ hostname: "127.0.0.1", port: Number(process.env.TUNEX_METRIC_BROWSER_PORT ?? 41978), async fetch(req) {
  const url = new URL(req.url), path = url.pathname;
  if (path === "/") return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/production.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>', { headers: { "Content-Type": "text/html; charset=utf-8" } });
  if (path === "/bundle.js") return new Response(js, { headers: { "Content-Type": "text/javascript" } });
  if (path === "/production.css") return new Response(css, { headers: { "Content-Type": "text/css" } });
  if (path === "/favicon.ico") return new Response(null, { status: 204 });
  if (path === "/__test/state") return data({ calls });
  if (path === "/__test/reset") { enabled = true; failure = 0; delay = false; mismatch = false; historyFailure = 0; historyDelay = false; historyMismatch = false; historyEnabled = true; calls.length = 0; return data(true); }
  if (path === "/__test/scenario") { const body = await req.json(); enabled = body.enabled ?? enabled; failure = body.failure ?? failure; delay = body.delay ?? delay; mismatch = body.mismatch ?? mismatch; historyFailure = body.historyFailure ?? historyFailure; historyDelay = body.historyDelay ?? historyDelay; historyMismatch = body.historyMismatch ?? historyMismatch; historyEnabled = body.historyEnabled ?? historyEnabled; return data(true); }
  const workspaceId = Number(req.headers.get("x-workspace-id"));
  if (![5, 6].includes(workspaceId)) return Response.json({ code: "permission_denied" }, { status: 403 });
  calls.push({ path, method: req.method, workspaceId, query: url.search });
  if (req.method !== "GET") return new Response(null, { status: 405 });
  if (path === "/api/observability/capabilities") return data({ ...metricCapabilities, enabled, features: { ...metricCapabilities.features, workspace_snapshot: enabled, daily_usage_history: enabled && historyEnabled } });
  if (path === "/api/observability/history") {
    const { window, selection } = historyQuery(Object.fromEntries(url.searchParams));
    const history = historyFixture(workspaceId, window, selection);
    if (historyMismatch) history.selection = { scope: "node", id: 999999 };
    if (historyDelay && workspaceId === 5) await Bun.sleep(1400);
    if (historyFailure) return Response.json({ code: historyFailure === 404 ? "metrics_resource_not_found" : "metrics_unavailable", error: "private-history-error-sentinel" }, { status: historyFailure });
    return data(history);
  }
  if (path === "/api/observability/snapshot") {
    const window = { ...defaultMetricWindow(), start_date: url.searchParams.get("start_date")!, end_date: url.searchParams.get("end_date")! };
    const snapshot = metricFixture(workspaceId, window);
    if (mismatch) snapshot.workspace_id = 999999;
    if (delay && workspaceId === 5) await Bun.sleep(1400);
    if (failure) return Response.json({ code: failure === 422 ? "metrics_limit_exceeded" : failure === 403 ? "permission_denied" : "metrics_unavailable", error: "private-error-sentinel" }, { status: failure });
    return data(snapshot);
  }
  return new Response(null, { status: 404 });
} });
