import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { defaultMetricWindow } from "@/components/observability/metric-display";
import { metricFixture, metricCapabilities, historyFixture } from "@/components/observability/__tests__/metric-fixture";

process.env.NEXT_PUBLIC_API_MOCK = "0";
const calls: { url: string; init?: RequestInit }[] = [];
const originalFetch = globalThis.fetch;
const window = defaultMetricWindow();
let result: unknown;
beforeEach(() => { calls.length = 0; });
beforeAll(() => {
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => { calls.push({ url: String(url), init }); return Response.json({ data: result }); }) as typeof fetch;
});

test("history captures owned resource scope and rejects incomplete, foreign or fabricated daily data", async () => {
  const { observabilityApi } = await import("../observability");
  const selection = { scope: "forward" as const, id: 41 };
  result = historyFixture(5, window, selection);
  const history = await observabilityApi(5).history(window, selection);
  expect(history.totals.tst_ingress.bytes_in.value).toBe("9007199254740993");
  const query = new URL(calls.at(-1)!.url).searchParams;
  expect(query.get("scope")).toBe("forward"); expect(query.get("id")).toBe("41");
  expect(calls.at(-1)!.init?.cache).toBe("no-store");
  for (const mutate of [(h: any) => { h.workspace_id = 6; }, (h: any) => { h.selection.id = 40; },
    (h: any) => { h.days.pop(); }, (h: any) => { h.days[0].date = h.days[1].date; },
    (h: any) => { h.days[1].usage.tst_ingress.bytes_in.value = "0"; },
    (h: any) => { h.days[0].usage.tst_ingress.bytes_in.source = "workspace_archive"; },
    (h: any) => { h.days[0].usage.tst_ingress.bytes_in.value = "<script>"; },
    (h: any) => { h.totals.tst_ingress.rows = 999; }, (h: any) => { h.days[0].usage = null; }]) {
    const h = historyFixture(5, window, selection); mutate(h); result = h;
    await expect(observabilityApi(5).history(window, selection)).rejects.toThrow("invalid_metric_response");
  }
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
