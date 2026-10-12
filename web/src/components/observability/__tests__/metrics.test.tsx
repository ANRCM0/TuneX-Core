import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultMetricWindow, errorLabel, metricError, metricValue, validMetricWindow } from "../metric-display";
import { ForwardDetail, MetricCard, SnapshotView } from "../snapshot-view";
import { MonitorPanel } from "../monitor-panel";
import { metricFixture } from "./metric-fixture";

const now = new Date("2026-10-12T00:00:00Z"), window = defaultMetricWindow(now), snapshot = metricFixture(5, window, now);
test("Shanghai window is inclusive, date-valid and limited without treating UTC today as Shanghai today", () => {
  expect(defaultMetricWindow(new Date("2026-10-11T17:00:00Z"))).toEqual(window);
  expect(validMetricWindow({ ...window, start_date: "2026-09-12" }, now)).toBe(true);
  for (const start_date of ["2026-09-11", "2026-10-13", "2026-02-30", "0999-10-01", ""]) expect(validMetricWindow({ ...window, start_date }, now)).toBe(false);
  expect(validMetricWindow({ ...window, end_date: "2026-10-13" }, now)).toBe(false);
});
test("exact large decimal counters, reported zero and missing metrics remain distinct", () => {
  expect(metricValue(snapshot.workspace.usage.tst_ingress.bytes_in, "en")).toBe("9,007,199,254,740,993 B");
  expect(metricValue(snapshot.forwards[0].usage.archive.bytes, "en")).toBe("0 B");
  expect(metricValue(snapshot.workspace.active_connections, "en")).toBe("No valid data");
  expect(snapshot.workspace.usage.archive.bytes.value).toBe("1234"); // includes a deleted resource
});
test("both locales explain source, date totals, missing collection and snapshot-time freshness", () => {
  for (const locale of ["zh", "en"]) {
    const html = renderToStaticMarkup(<SnapshotView snapshot={snapshot} locale={locale} />);
    expect(html).toContain("9,007,199,254,740,993 B");
    expect(html).toContain("workspace_archive"); expect(html).toContain("tst_ingress_checkpoint");
    expect(html).toContain(locale === "en" ? "not active connections" : "不代表当前活跃连接");
    expect(html).toContain(locale === "en" ? "No valid data" : "无有效数据");
    expect(html).not.toContain("private-");
    expect(html).toContain("Inspect Forward #59".replace("Inspect", locale === "en" ? "Inspect" : "查看"));
    expect(html).not.toContain(locale === "en" ? "Inspect Forward #60" : "查看 Forward #60"); // paginated
  }
});
test("stale target success is a dated sample, config presence and deployment pending are separate", () => {
  const html = renderToStaticMarkup(<ForwardDetail forward={snapshot.forwards[0]} snapshot={snapshot} locale="en" />);
  expect(html).toContain("active / pending"); expect(html).toContain("3 / ?");
  expect(html).toContain("reported"); expect(html).toContain("TCP connect succeeded"); expect(html).toContain("Stale");
  expect(html).toContain("0 ms"); expect(html).toContain("Sample result");
  expect(html).toContain("do not establish business health"); expect(html).toContain("not end-to-end latency");
});
test("stale measured values persist with stale label; missing telemetry is never a fabricated zero", () => {
  const html = renderToStaticMarkup(<MetricCard title="Errors" metric={snapshot.nodes[1].error_count} locale="en" />);
  expect(html).toContain("7 errors"); expect(html).toContain("Stale"); expect(html).toContain("Node process report");
});
test("read permission denial renders without initiating metric reads", () => {
  expect(renderToStaticMarkup(<MonitorPanel workspaceId={5} canRead={false} locale="en" />)).toContain("Forward read and Node read permissions");
});
test("HTTP errors have bounded messages and never echo backend payload or diagnostics", () => {
  expect(metricError({ status: 404, data: { code: "private-credential-sentinel" } })).toBe("permission_denied");
  expect(metricError(new Error("private-error-sentinel"))).toBe("metrics_unavailable");
  for (const locale of ["zh", "en"]) expect(errorLabel("private-error-sentinel", locale)).not.toContain("private-");
});
