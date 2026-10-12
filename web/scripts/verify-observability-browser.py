"""Real Chromium acceptance of HTTP fixtures projected by the backend model.

Run after a production web build, with browser-metrics-server.ts listening.
Requires playwright==1.58.0 and its Chromium (or TUNEX_BROWSER_EXECUTABLE).
"""
import json
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = os.environ.get("TUNEX_METRIC_BROWSER_URL", "http://127.0.0.1:41978")
output = Path(os.environ.get("TUNEX_METRIC_BROWSER_OUTPUT", "test-artifacts/v2.4-o2-browser"))
output.mkdir(parents=True, exist_ok=True)
evidence = []

with sync_playwright() as p:
    opts = {"headless": True}
    if os.environ.get("TUNEX_BROWSER_EXECUTABLE"):
        opts["executable_path"] = os.environ["TUNEX_BROWSER_EXECUTABLE"]
    browser = p.chromium.launch(**opts)
    page = browser.new_page()
    page.request.post(base + "/__test/reset")
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    def scenario(**kwargs):
        page.request.post(base + "/__test/scenario", data=kwargs)

    def loaded():
        expect(page.get_by_test_id("metric-snapshot")).to_be_visible()
        page.wait_for_load_state("networkidle")

    for locale in ("en", "zh"):
        for width in (360, 390, 768, 1024, 1280, 1536):
            page.set_viewport_size({"width": width, "height": 1000})
            page.goto(base + "/?locale=" + locale)
            loaded()
            inspect = "Inspect" if locale == "en" else "\u67e5\u770b"
            page.get_by_role("button", name=inspect + " Forward #40", exact=True).click()
            detail = page.get_by_test_id("metric-resource-detail")
            expect(detail).to_contain_text("0 ms")
            expect(detail).to_contain_text("Stale" if locale == "en" else "\u5df2\u9648\u65e7")
            expect(detail.get_by_test_id("metric-history")).to_be_visible()
            expect(detail.get_by_test_id("metric-history").locator("table tbody tr")).to_have_count(7)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (locale, width)
            page.screenshot(path=str(output / f"forward-{locale}-{width}.png"), full_page=True)
            evidence.append(f"{locale}/{width}: rendered source/freshness and topology without horizontal overflow")

    page.goto(base + "/?locale=en")
    loaded()
    expect(page.get_by_test_id("metric-snapshot")).to_contain_text("9,007,199,254,740,993 B")
    expect(page.get_by_test_id("metric-snapshot")).to_contain_text("No valid data")
    assert page.get_by_role("button", name="Inspect Forward #60", exact=True).count() == 0
    page.get_by_role("button", name="Next", exact=True).click()
    expect(page.get_by_role("button", name="Inspect Forward #60", exact=True)).to_be_visible()
    page.get_by_label("Filter by resource ID").fill("40")
    expect(page.get_by_role("button", name="Inspect Forward #40", exact=True)).to_be_visible()
    page.get_by_role("button", name="Inspect Forward #40", exact=True).click()
    detail = page.get_by_test_id("metric-resource-detail")
    expect(detail).to_contain_text("active / pending")
    expect(detail).to_contain_text("3 / ?")
    expect(detail).to_contain_text("do not establish business health")
    expect(detail).to_contain_text("TCP connect succeeded")
    expect(detail).to_contain_text("Stale")
    expect(detail).to_contain_text("0 ms")
    assert page.evaluate("document.activeElement.id") == "metric-resource-detail"
    evidence.append("pagination/filter and Forward detail retain pending deployment, unknown ACK and stale TCP samples")

    for kind in ("Link", "Node"):
        page.get_by_role("button", name=kind, exact=True).click()
        page.get_by_role("button", name="Inspect " + kind + (" #10" if kind == "Link" else " #2"), exact=True).click()
        expect(detail).to_contain_text("Stale")
        expect(detail).to_contain_text("degraded / degraded" if kind == "Link" else "7 errors")
        expect(detail).to_contain_text("Ready" if kind == "Link" else "not active connections")
        evidence.append(kind + " detail preserves source scope and stale measurements")

    history = page.get_by_test_id("metric-history").first
    expect(history.locator("table tbody tr")).to_have_count(7)
    expect(history.locator('[data-history-value="0"]')).to_have_count(1)
    expect(history.locator('[data-history-value="missing"]')).to_have_count(5)
    before = len(page.request.get(base + "/__test/state").json()["data"]["calls"])
    history.get_by_label("History metric").select_option("tst_in")
    expect(history).to_contain_text("9,007,199,254,740,993 B")
    expect(history).to_contain_text("Stale")
    expect(history.locator('[data-history-value="0"]')).to_have_count(1)
    expect(history.locator('[data-history-value="missing"]')).to_have_count(5)
    assert len(page.request.get(base + "/__test/state").json()["data"]["calls"]) == before
    history.screenshot(path=str(output / "daily-tst-exact-values.png"))
    history.get_by_label("History metric").select_option("tst_connections")
    expect(history).to_contain_text("12 connections")
    expect(history).to_contain_text("not active connections")
    evidence.append("daily source selection preserves exact BigInt, measured zero, gaps and stale receipts without extra requests")

    page.get_by_role("button", name="Link", exact=True).click()
    page.get_by_role("button", name="Inspect Link #10", exact=True).click()
    scoped = detail.get_by_test_id("metric-history")
    expect(scoped).to_contain_text("9,007,199,254,740,993 B")
    scoped.get_by_label("History metric").select_option("archive_bytes")
    expect(scoped).to_contain_text("does not attribute usage to Link / Node")
    expect(scoped.locator('[data-history-value="missing"]')).to_have_count(7)
    scoped.screenshot(path=str(output / "daily-link-unattributed-archive.png"))
    evidence.append("Link history uses ingress counters; unattributed archive stays unavailable on all seven days")

    scenario(historyFailure=503)
    page.get_by_role("button", name="Reload fixture").click()
    loaded()
    expect(page.get_by_test_id("history-error")).to_contain_text("Metrics are unavailable")
    expect(page.get_by_test_id("metric-history")).to_have_count(0)
    expect(page.get_by_test_id("metric-snapshot")).to_be_visible()
    assert "private-history-error-sentinel" not in page.locator("body").inner_text()
    evidence.append("history failure clears its series, redacts diagnostics and preserves the separately valid snapshot")
    scenario(historyFailure=0, historyMismatch=True)
    page.get_by_role("button", name="Reload fixture").click()
    loaded()
    expect(page.get_by_test_id("history-error")).to_contain_text("does not match this workspace")
    expect(page.get_by_test_id("metric-history")).to_have_count(0)
    evidence.append("foreign resource history is rejected before chart rendering")

    scenario(historyMismatch=False, historyEnabled=False)
    page.request.post(base + "/__test/reset")
    scenario(historyEnabled=False)
    page.get_by_role("button", name="Reload fixture").click()
    loaded()
    assert not any(c["path"].endswith("/history") for c in page.request.get(base + "/__test/state").json()["data"]["calls"])
    evidence.append("server without daily-history capability continues snapshot support without history requests")

    page.request.post(base + "/__test/reset")
    scenario(historyDelay=True)
    page.get_by_role("button", name="Reload fixture").click()
    expect(page.get_by_role("button", name="Inspect Forward #41", exact=True)).to_be_visible()
    page.get_by_role("button", name="Inspect Forward #41", exact=True).click()
    page.wait_for_function("fetch('/__test/state').then(r=>r.json()).then(r=>r.data.calls.some(c=>c.path.endsWith('/history') && c.query.includes('id=41')))")
    page.get_by_role("button", name="Inspect Forward #40", exact=True).click()
    expect(detail.get_by_test_id("metric-history")).to_contain_text("forward #40")
    expect(detail.get_by_test_id("metric-history")).not_to_contain_text("9,007,199,254,740,993")
    evidence.append("late history for a previous resource cannot replace the current resource series")

    page.request.post(base + "/__test/reset")
    scenario(historyDelay=True)
    page.get_by_role("button", name="Query / refresh").click()
    page.wait_for_function("fetch('/__test/state').then(r=>r.json()).then(r=>r.data.calls.some(c=>c.path.endsWith('/history') && c.workspaceId===5))")
    page.get_by_role("button", name="Switch workspace").click()
    loaded()
    expect(page.get_by_test_id("metric-snapshot")).to_contain_text("Workspace #6")
    expect(page.get_by_test_id("metric-history").locator('[data-history-value="missing"]')).to_have_count(7)
    page.wait_for_timeout(1600)
    assert "9,007,199,254,740,993" not in page.locator("body").inner_text()
    evidence.append("late daily history cannot repopulate a different Workspace")
    scenario(historyDelay=False)
    page.get_by_role("button", name="Switch workspace").click()
    loaded()

    # Change only the date range while an older history is still in flight.
    page.request.post(base + "/__test/reset")
    scenario(historyDelay=True)
    page.get_by_role("button", name="Query / refresh").click()
    page.wait_for_function("fetch('/__test/state').then(r=>r.json()).then(r=>r.data.calls.some(c=>c.path.endsWith('/history')))")
    end_day = page.get_by_label("End date (Shanghai)").input_value()
    page.get_by_label("Start date (Shanghai)").fill(end_day)
    page.get_by_role("button", name="Query / refresh").click()
    loaded()
    expect(page.get_by_test_id("metric-history").locator("table tbody tr")).to_have_count(1)
    page.wait_for_timeout(1600)
    expect(page.get_by_test_id("metric-history").locator("table tbody tr")).to_have_count(1)
    evidence.append("late old-window history cannot replace the current single-day series")
    page.goto(base + "/?locale=en")
    loaded()
    scenario(historyDelay=False)

    page.request.post(base + "/__test/reset")
    scenario(historyDelay=True)
    page.get_by_role("button", name="Query / refresh").click()
    page.wait_for_function("fetch('/__test/state').then(r=>r.json()).then(r=>r.data.calls.some(c=>c.path.endsWith('/history')))")
    page.get_by_role("button", name="Toggle permissions").click()
    page.wait_for_timeout(1600)
    expect(page.get_by_test_id("metric-history")).to_have_count(0)
    expect(page.get_by_test_id("metric-snapshot")).to_have_count(0)
    evidence.append("late daily history cannot restore data after permission revocation")
    scenario(historyDelay=False)
    page.get_by_role("button", name="Toggle permissions").click()
    loaded()

    # Invalid date range does not request or replace the current snapshot.
    initial_start = page.get_by_label("Start date (Shanghai)").input_value()
    calls_before = len(page.request.get(base + "/__test/state").json()["data"]["calls"])
    page.get_by_label("Start date (Shanghai)").fill("2026-01-01")
    page.get_by_role("button", name="Query / refresh").click()
    expect(page.get_by_role("alert")).to_contain_text("at most 31 inclusive days")
    assert len(page.request.get(base + "/__test/state").json()["data"]["calls"]) == calls_before
    evidence.append("invalid date range issues no read and preserves identified previous snapshot")
    page.get_by_label("Start date (Shanghai)").fill(initial_start)

    page.get_by_role("button", name="Toggle permissions").click()
    expect(page.get_by_text("Forward read and Node read permissions are required in this workspace.")).to_be_visible()
    expect(page.get_by_test_id("metric-snapshot")).to_have_count(0)
    page.request.post(base + "/__test/reset")
    scenario(delay=True)
    page.get_by_role("button", name="Toggle permissions").click()
    page.wait_for_function("fetch('/__test/state').then(r=>r.json()).then(r=>r.data.calls.some(c=>c.path.endsWith('/snapshot')))")
    expect(page.get_by_test_id("metric-snapshot")).to_have_count(0)
    calls = page.request.get(base + "/__test/state").json()["data"]["calls"]
    assert not any(c["path"].endswith("/history") for c in calls)
    loaded()
    scenario(delay=False)
    evidence.append("permission revocation clears saved results; regrant waits for a fresh snapshot before any history read")

    page.request.post(base + "/__test/reset")
    scenario(delay=True)
    page.get_by_role("button", name="Query / refresh").click()
    page.wait_for_function("fetch('/__test/state').then(r=>r.json()).then(r=>r.data.calls.some(c=>c.path.endsWith('/snapshot') && c.workspaceId===5))")
    page.get_by_role("button", name="Switch workspace").click()
    loaded()
    expect(page.get_by_test_id("metric-snapshot")).to_contain_text("Workspace #6")
    page.wait_for_timeout(1600)
    assert "9,007,199,254,740,993" not in page.locator("body").inner_text()
    assert page.get_by_role("button", name="Inspect Forward #40", exact=True).count() == 0
    evidence.append("late old-workspace snapshot cannot repopulate workspace #6")
    scenario(delay=False)
    page.get_by_role("button", name="Switch workspace").click()
    loaded()

    page.request.post(base + "/__test/reset")
    scenario(delay=True)
    page.get_by_role("button", name="Query / refresh").click()
    page.wait_for_function("fetch('/__test/state').then(r=>r.json()).then(r=>r.data.calls.some(c=>c.path.endsWith('/snapshot')))")
    page.get_by_role("button", name="Toggle permissions").click()
    page.wait_for_timeout(1600)
    expect(page.get_by_test_id("metric-snapshot")).to_have_count(0)
    expect(page.get_by_text("Forward read and Node read permissions are required in this workspace.")).to_be_visible()
    scenario(delay=False)
    page.get_by_role("button", name="Toggle permissions").click()
    loaded()
    evidence.append("late in-flight response after permission revocation cannot restore metric data")

    for status, expected in ((422, "Snapshot limit exceeded"), (403, "Forward read and Node read"), (503, "Metrics are unavailable")):
        scenario(failure=status)
        page.get_by_role("button", name="Reload fixture").click()
        expect(page.get_by_role("alert")).to_contain_text(expected)
        expect(page.get_by_test_id("metric-snapshot")).to_have_count(0)
        assert "private-error-sentinel" not in page.locator("body").inner_text()
        evidence.append(f"HTTP {status}: no partial/old results or raw diagnostics")

    scenario(failure=0, mismatch=True)
    page.get_by_role("button", name="Reload fixture").click()
    expect(page.get_by_role("alert")).to_contain_text("does not match this workspace")
    expect(page.get_by_test_id("metric-snapshot")).to_have_count(0)
    evidence.append("foreign response is rejected before rendering")
    scenario(mismatch=False, enabled=False)
    before = len(page.request.get(base + "/__test/state").json()["data"]["calls"])
    page.get_by_role("button", name="Reload fixture").click()
    expect(page.get_by_text("Unified monitoring is disabled by the platform.")).to_be_visible()
    calls = page.request.get(base + "/__test/state").json()["data"]["calls"]
    assert len(calls) == before + 1 and calls[-1]["path"].endswith("/capabilities")
    assert all(call["method"] == "GET" for call in calls)
    assert not errors, errors
    evidence.append("default-off makes only capability reads; all metric API calls are GET; no runtime errors")

    # Optional full Next.js route smoke uses the declared demo default-off contract.
    web_url = os.environ.get("TUNEX_METRIC_WEB_URL")
    if web_url:
        context = browser.new_context()
        shell_page = context.new_page()
        shell_page.on("pageerror", lambda error: errors.append(str(error)))
        shell_page.goto(web_url + "/monitor")
        expect(shell_page).to_have_url(re.compile(r"/login"))
        context.add_cookies([{"name": "tunex_session", "value": "u1", "url": web_url}, {"name": "tunex_workspace", "value": "w1", "url": web_url}])
        for locale in ("en", "zh"):
            context.add_cookies([{"name": "tunex_locale", "value": locale, "url": web_url}])
            shell_page.set_viewport_size({"width": 1280, "height": 1000})
            shell_page.goto(web_url + "/monitor")
            expect(shell_page.get_by_text("Unified monitoring is disabled by the platform." if locale == "en" else "\u5e73\u53f0\u5c1a\u672a\u542f\u7528\u7edf\u4e00\u76d1\u63a7\u3002", exact=True)).to_be_visible()
            expect(shell_page.locator('[data-nav-href="/monitor"]')).to_have_attribute("aria-current", "page")
            assert shell_page.get_by_test_id("metric-snapshot").count() == 0
            assert shell_page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            shell_page.screenshot(path=str(output / f"next-route-{locale}.png"), full_page=True)
        assert not errors, errors
        evidence.append("actual Next.js /monitor en/zh: auth redirect, Workspace permissions, active navigation and default-off state")
        context.close()
    browser.close()

report = {"method": "real_isolated_chromium_http_projected_fixture", "pass": len(evidence), "evidence": evidence}
(output / "evidence.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
