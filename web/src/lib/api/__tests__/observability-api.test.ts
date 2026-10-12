import { afterAll, beforeAll, expect, test } from "bun:test";
import { defaultMetricWindow } from "@/components/observability/metric-display";
import { metricFixture, metricCapabilities } from "@/components/observability/__tests__/metric-fixture";

process.env.NEXT_PUBLIC_API_MOCK = "0";
const calls: { url: string; init?: RequestInit }[] = [];
const originalFetch = globalThis.fetch;
const window = defaultMetricWindow();
let result: unknown;
beforeAll(() => {
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => { calls.push({ url: String(url), init }); return Response.json({ data: result }); }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; });
test("metric reads capture explicit scope, dates, cancellation and no-store using only GET", async () => {
  const { observabilityApi } = await import("../observability");
  const { setActiveWorkspace } = await import("../core");
  const controller = new AbortController(), api = observabilityApi(5, controller.signal);
  setActiveWorkspace(6);
  result = metricCapabilities; await api.capabilities();
  result = metricFixture(5, window); await api.snapshot(window);
  expect(calls[0].url).toEndWith("/api/observability/capabilities");
  expect(new URL(calls[1].url).searchParams.get("start_date")).toBe(window.start_date);
  expect(new URL(calls[1].url).searchParams.has("workspace_id")).toBe(false);
  for (const call of calls) {
    expect(call.init?.method).toBe("GET"); expect(call.init?.body).toBeUndefined();
    expect(new Headers(call.init?.headers).get("x-workspace-id")).toBe("5");
    expect(call.init?.cache).toBe("no-store"); expect(call.init?.signal).toBe(controller.signal);
  }
  setActiveWorkspace(null);
  controller.abort(); await expect(api.capabilities()).rejects.toThrow();
  expect(calls).toHaveLength(2);
});
test("response from another workspace, window or schema cannot enter the view", async () => {
  const { observabilityApi } = await import("../observability");
  for (const patch of [{ workspace_id: 6 }, { schema_version: 2 }, { window: { ...window, timezone: "UTC" } }, { window: { ...window, start_date: "2026-01-01" } }, { workspace: null }]) {
    result = { ...metricFixture(5, window), ...patch };
    await expect(observabilityApi(5).snapshot(window)).rejects.toThrow("invalid_metric_response");
  }
  expect(() => observabilityApi(0)).toThrow("invalid_metric_scope");
  result = {};
  await expect(observabilityApi(5).capabilities()).rejects.toThrow("invalid_metric_response");
});
