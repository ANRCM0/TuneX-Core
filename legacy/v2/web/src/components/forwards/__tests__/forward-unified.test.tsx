import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { forwardState, forwardCombinationBlock, forwardTrafficEvidence, safeForwardError, type UnifiedForwardCapabilities } from "@/lib/forward-unified";
import { unifiedForwardText } from "@/lib/forward-unified-i18n";
import { projectLinkList } from "@/lib/links-types";
import { unifiedFormDraft, unifiedFormInput } from "../forward-unified-form";
import { ForwardStateBadge } from "../forward-unified-detail";
import { handleMock } from "@/mocks/handler";
import { getStore, resetStore } from "@/mocks/state";
import type { PortForward, UserNode } from "@/lib/types";

const originalFlag = process.env.TUNEX_TST_ENABLED;
beforeEach(() => {
  resetStore(); delete process.env.TUNEX_TST_ENABLED;
  for (const node of getStore().nodes) { node.has_credential = true; node.credential_revoked = false; node.lifecycle = "active"; }
});
afterEach(() => { if (originalFlag === undefined) delete process.env.TUNEX_TST_ENABLED; else process.env.TUNEX_TST_ENABLED = originalFlag; });
const call = (method: string, path: string, body?: unknown, workspaceId = 1, actorId = 1) => handleMock(method, path, { body, cookie: `tunex_session=u${actorId}`, workspaceId });
const request = (key = "unified-idempotency-001") => ({ idempotency_key: key, name: "Business", path: "direct", transport: "native_plain", protocol: "tcp",
  ingress_node_id: 1, listen_port: null, target_host: "127.0.0.1", target_port: 9000, transport_options: { selection: "auto" } });
describe("Unified Forward lifecycle and single business submission", () => {
  test("payload counters require explicit node facts and never use archived or missing values as zero", () => {
    const row = { traffic: 9000, lifecycle: { traffic: null } } as PortForward;
    expect(forwardTrafficEvidence(row)).toBeNull();
    const fact = { bytes_in: "1024", bytes_out: "2048", connections: "3", last_received_at: "2026-10-11T00:00:00Z" };
    expect(forwardTrafficEvidence({ ...row, lifecycle: { ...row.lifecycle!, traffic: fact } })).toEqual({ bytesIn: "1024", bytesOut: "2048", connections: "3", lastReceivedAt: fact.last_received_at });
    for (const value of [-1, undefined, "", "-1", "secret", "01"]) expect(forwardTrafficEvidence({ ...row, lifecycle: { ...row.lifecycle!, traffic: { ...fact, bytes_in: value } } })).toBeNull();
    expect(forwardTrafficEvidence({ ...row, lifecycle: { ...row.lifecycle!, traffic: { ...fact, last_received_at: null } } })?.lastReceivedAt).toBeNull();
  });
  test("a matching revision or accepted request cannot fabricate runtime readiness", () => {
    const row = { apply_status: "active", config_revision: 4, applied_revision: 4 } as PortForward;
    expect(forwardState(row)).toBe("unverified");
    const lifecycle = { desired: "active", deployment: "confirmed", runtime: "unknown", transport: "native_plain", target_health: "unverified", traffic: null } as NonNullable<PortForward["lifecycle"]>;
    expect(forwardState({ ...row, lifecycle })).toBe("unverified");
    expect(forwardState({ ...row, lifecycle: { ...lifecycle, runtime: "ready" } })).toBe("ready");
    expect(forwardState({ ...row, lifecycle: { ...lifecycle, runtime: "stale" } })).toBe("stale");
    expect(forwardState({ ...row, lifecycle: { ...lifecycle, deployment: "pending", runtime: "ready" } })).toBe("pending");
    expect(forwardState({ ...row, lifecycle: { ...lifecycle, deployment: "failed" } })).toBe("error");
    expect(forwardState({ ...row, lifecycle: { ...lifecycle, desired: "suspended", runtime: "stopped" } })).toBe("suspended");
  });
  test("runtime state labels remain distinct in both languages", () => {
    for (const locale of ["zh", "en"]) {
      const labels = ["accepted", "pending", "ready", "stale", "unverified"].map((state) => unifiedForwardText(locale, state));
      expect(new Set(labels).size).toBe(labels.length);
      const html = renderToStaticMarkup(<ForwardStateBadge forward={{ apply_status: "active", applied_revision: 2, config_revision: 2 } as PortForward} locale={locale} />);
      expect(html).toContain(unifiedForwardText(locale, "unverified"));
    }
  });
  test("copy preserves business transport and budgets while requesting a fresh port", () => {
    const original = { id: 8, name: "Source", mode: "relay", path: "relay", transport: "tst_v1", protocol: "both", ingress_node_id: 1, egress_node_id: 4,
      listen_port: 22000, target_host: "127.0.0.1", target_port: 9000, bytes_per_second_in: 800, bytes_per_second_out: 900, max_connections: 5, max_connections_per_ip: 2,
      link_resource_id: 99, traffic: 1000 } as PortForward;
    const input = unifiedFormInput(unifiedFormDraft(original, true), "copy-idempotency-001");
    expect(input).toMatchObject({ path: "relay", transport: "tst_v1", protocol: "both", listen_port: null, bytes_per_second_in: 800, max_connections: 5, transport_options: { selection: "auto" } });
    for (const field of ["id", "link_resource_id", "traffic", "applied_revision", "secret"]) expect(input).not.toHaveProperty(field);
  });
  test("TST concurrent streams and mappings stay within the actual shared runtime capacity", () => {
    const draft = { ...unifiedFormDraft(), name: "Bounded", path: "relay" as const, transport: "tst_v1" as const, ingress: "1", egress: "4", host: "127.0.0.1", port: "9000", max_connections: "4096", max_connections_per_ip: "4096" };
    expect(unifiedFormInput(draft, "bounded-concurrency-001").max_connections).toBe(4096);
    expect(() => unifiedFormInput({ ...draft, max_connections: "4097" }, "bounded-concurrency-002")).toThrow();
    expect(() => unifiedFormInput({ ...draft, max_connections_per_ip: "4097" }, "bounded-concurrency-003")).toThrow();
    expect(unifiedFormInput({ ...draft, max_connections: "0", max_connections_per_ip: "0" }, "bounded-concurrency-004").max_connections).toBe(0);
  });
  test("one idempotency key creates one Forward and conflicting reuse makes no second write", async () => {
    const before = getStore().tunnels.length;
    const accepted = await call("POST", "/forward-operations", request());
    expect(accepted.status).toBe(200);
    const receipt = accepted.body as { operation_id: string; forward_id: number };
    expect(receipt.operation_id).toMatch(/^[a-f0-9-]{36}$/);
    const repeated = await call("POST", "/forward-operations", request());
    expect(repeated.body).toMatchObject({ ...receipt, replayed: true });
    expect(getStore().tunnels.length).toBe(before + 1);
    expect((await call("POST", "/forward-operations", { ...request(), target_port: 9001 })).status).toBe(409);
    expect(getStore().tunnels.length).toBe(before + 1);
    const detail = await call("GET", `/forwards/${receipt.forward_id}`);
    expect(detail.body).toMatchObject({ path: "direct", transport: "native_plain", lifecycle: { runtime: "unknown", target_health: "unverified" } });
    expect((await call("GET", `/forward-operations/${receipt.operation_id}`, undefined, 999)).status).toBe(404);
    expect((await call("GET", `/forwards/${receipt.forward_id}`, undefined, 999)).status).toBe(404);
  });
  test("TST defaults off, has a readable reason and never creates a plaintext substitute", async () => {
    const before = getStore().tunnels.length;
    const caps = (await call("GET", "/forwards/capabilities")).body as UnifiedForwardCapabilities;
    expect(caps.tst_enabled).toBe(false);
    expect(caps.combinations.find((entry) => entry.path === "relay" && entry.transport === "tst_v1" && entry.protocol === "tcp")).toMatchObject({ available: false, reason: "tst_not_enabled" });
    const denied = await call("POST", "/forward-operations", { ...request(), path: "relay", transport: "tst_v1", egress_node_id: 4 });
    expect(denied.status).toBe(409); expect(getStore().tunnels.length).toBe(before);
    expect(unifiedForwardText("en", "tst_not_enabled")).toContain("release gates");
  });
  test("Forward actions, edit and history stay on the ordinary scoped resource", async () => {
    const created = await call("POST", "/forward-operations", request()); const id = (created.body as { forward_id: number }).forward_id;
    expect((await call("POST", `/forwards/${id}/actions`, { action: "suspend" })).body).toMatchObject({ lifecycle: { desired: "suspended" } });
    expect((await call("POST", `/forwards/${id}/actions`, { action: "resume" })).status).toBe(200);
    const current = (await call("GET", `/forwards/${id}`)).body as PortForward;
    const patched = await call("PATCH", `/forwards/${id}`, { name: "Changed", expected_revision: current.latest_revision });
    expect(patched.body).toMatchObject({ name: "Changed" });
    expect((await call("GET", `/forwards/${id}/history`)).body).toBeArray();
    expect((await call("POST", `/forwards/${id}/actions`, { action: "delete" })).status).toBe(200);
    expect((await call("GET", `/forwards/${id}`)).status).toBe(404);
  });
  test("TST requires fresh actual capability evidence, independently of native protocol capability", () => {
    const caps = { tst_enabled: true, native_both_enabled: false, transports: ["native_plain", "tst_v1"], node_use_allowed: true,
      combinations: [{ path: "relay", transport: "tst_v1", protocol: "tcp", available: true, reason: null, ingress_node_ids: [1], egress_node_ids: [4] }] } as UnifiedForwardCapabilities;
    const ingress = { id: 1, capabilities: ["forward.link.tst.v1"], capabilities_fresh: false } as UserNode;
    const egress = { id: 4, capabilities: ["forward.link.tst.v1"], capabilities_fresh: true } as UserNode;
    expect(forwardCombinationBlock(caps, "relay", "tst_v1", "tcp", ingress, egress)).toBe("tst_capability_missing");
    expect(forwardCombinationBlock(caps, "relay", "tst_v1", "tcp", { ...ingress, capabilities_fresh: true }, egress)).toBeNull();
    expect(forwardCombinationBlock(caps, "direct", "tst_v1", "tcp", ingress)).toBe("tst_relay_only");
  });
  test("advanced resource projection strips secrets and rejects another workspace", () => {
    const raw = { id: 1, workspace_id: 1, name: "Internal", carrier: "tst_v1", status: "active", desired_version: 2, generation: 3, ref_count: 1, private_key: "DO_NOT_RETAIN", config: { target: "DO_NOT_RETAIN" } };
    expect(JSON.stringify(projectLinkList([raw], 1))).not.toContain("DO_NOT_RETAIN");
    expect(() => projectLinkList([raw], 2)).toThrow("invalid_link_response");
    expect(safeForwardError({ message: "secret material", data: { code: "node_capability_missing" } })).toBe("node_capability_missing");
    expect(safeForwardError({ data: { code: "secret material" } })).toBe("forward_request_failed");
  });
});
