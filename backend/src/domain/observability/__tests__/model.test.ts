import { expect, test } from "bun:test";
import { metricWindow, metricFreshness, projectObservability, OBSERVABILITY_LIMITS,
  type ObservabilityFacts } from "../model.ts";

const now = new Date("2026-10-12T10:00:00Z");
const window = metricWindow({}, now);
function facts(): ObservabilityFacts {
  return { nodes: [{ id: 1, node_group: { workspace_id: 7 }, lifecycle: "active", status: "active", last_seen_at: now,
    node_credential_hash: "private-credential", credential_revoked: false, credential_rotated_at: null,
    state_report: { reported_at: now, runtime_counts: { total: 0, secret: "private-runtime-count" }, error_count: 0,
      tunnels: [{ id: "tunex-2-direct", revision: 3, remote_host: "private-target", diag: { last_handshake_error: "private-error" } }], link_placements: null } }],
    links: [], forwards: [{ id: 2, workspace_id: 7, link_resource_id: null, ingress_node_id: 1, middle_node_id: null, egress_node_id: null,
      tunnel_mode: "direct", forward_protocol: "tcp", desired_status: "active", apply_status: "active", config_revision: 3, applied_revision: 3 }],
    archives: [], checkpoints: [], targets: [] };
}
const project = (input = facts()) => projectObservability(7, input, window, now);

test("missing usage and active connections remain unknown while reported zero telemetry is a fact", () => {
  const view = project();
  expect(view.nodes[0]!.runtime_count.value).toBe("0");
  expect(view.nodes[0]!.error_count.value).toBe("0");
  expect(view.workspace.usage.archive.bytes.value).toBeNull();
  expect(view.workspace.usage.tst_ingress.connections.value).toBeNull();
  expect(view.forwards[0]!.active_connections.value).toBeNull();
  expect(view.forwards[0]!.runtimes[0]!.state).toBe("reported");
  expect(view.forwards[0]!.target_observations).toEqual([]);
});
test("deleted resource archive stays in Workspace totals, separate from precise TST ingress counters", () => {
  const f = facts();
  f.archives = [2, 999].map((tunnel_id) => ({ tunnel_id, _sum: { traffic: 100, traffic_cost: 200 }, _max: { date: new Date("2026-10-11") }, _count: { _all: 1 } }));
  const big = 9007199254740993n;
  f.checkpoints = [{ forward_id: 2, link_id: 10, node_id: 1, _sum: { bytes_in: big, bytes_out: 3n, connections: 0n },
    _max: { updated_at: now }, _count: { _all: 1 } }];
  const view = project(f);
  expect(view.workspace.usage.archive.bytes.value).toBe("200");
  expect(view.forwards[0]!.usage.archive.bytes.value).toBe("100");
  expect(view.workspace.usage.archive.bytes.freshness.state).toBe("historical");
  expect(view.workspace.usage.archive.bytes.freshness.received_at).toBeNull();
  expect(view.workspace.usage.tst_ingress.bytes_in.value).toBe(String(big));
  expect(view.workspace.usage.tst_ingress.connections.value).toBe("0");
  expect(view.nodes[0]!.usage.archive.bytes.value).toBeNull();
  expect(JSON.stringify(view)).not.toContain("9007199254740992");
});
test("latest receipt freshness does not turn cumulative connections into an active gauge", () => {
  const f = facts();
  f.checkpoints = [{ forward_id: 2, link_id: 10, node_id: 1, _sum: { bytes_in: 1n, bytes_out: 2n, connections: 12n },
    _max: { updated_at: new Date(now.getTime() - 60001) }, _count: { _all: 1 } }];
  const view = project(f);
  expect(view.workspace.usage.tst_ingress.connections).toMatchObject({ value: "12", kind: "window_total", freshness: { state: "stale", observed_at: null } });
  expect(view.workspace.active_connections.value).toBeNull();
});
test("timestamps have explicit inclusive TTL, future, missing and credential epoch semantics", () => {
  expect(metricFreshness(new Date(now.getTime() - 90000), null, now, 90000).state).toBe("current");
  expect(metricFreshness(new Date(now.getTime() - 90001), null, now, 90000).state).toBe("stale");
  expect(metricFreshness(new Date(now.getTime() + 1), null, now, 90000).reason).toBe("future_timestamp");
  expect(metricFreshness(null, null, now, 90000).state).toBe("unknown");
  expect(metricFreshness(now, null, now, 90000, now).reason).toBe("credential_epoch_changed");
  expect(metricFreshness(now, null, now, 90000, null, true).reason).toBe("credential_revoked");
});
test("stale node telemetry retains measured values and cannot promote runtime presence", () => {
  const f = facts(); f.nodes[0]!.credential_rotated_at = now;
  const view = project(f);
  expect(view.nodes[0]!.runtime_count.value).toBe("0");
  expect(view.nodes[0]!.runtime_count.freshness.reason).toBe("credential_epoch_changed");
  expect(view.forwards[0]!.runtimes[0]!.state).toBe("stale");
});
test("native runtime absence, revision mismatch and duplicate identities do not fabricate readiness", () => {
  for (const [tunnels, state] of [[[], "absent"], [[{ id: "tunex-2-direct", revision: 4 }], "mismatch"],
    [[{ id: "tunex-2-direct", revision: 3 }, { id: "tunex-2-direct", revision: 3 }], "unknown"]] as const) {
    const f = facts(); f.nodes[0]!.state_report!.tunnels = tunnels;
    expect(project(f).forwards[0]!.runtimes[0]!.state).toBe(state);
  }
});
test("target TCP latency preserves node/source/time and unreachable null, with no whole-path aggregation", () => {
  const f = facts();
  f.targets = [{ forward_id: 2, target_index: 0, node_id: 1, observation: { reachable: true, latency_ms: 0, observed_at: now, reported_at: now, observation_source: "private-node/tcp_connect" } }];
  expect(project(f).forwards[0]!.target_observations[0]!.latency_ms.value).toBe("0");
  f.targets[0]!.observation!.reachable = false;
  const target = project(f).forwards[0]!.target_observations[0]!;
  expect(target.reachable).toBe(false); expect(target.latency_ms.value).toBeNull(); expect(target.freshness.state).toBe("current");
  f.targets[0]!.observation!.observation_source = "icmp_ping";
  expect(project(f).forwards[0]!.target_observations[0]!.reachable).toBeNull();
  expect(project(f).workspace.latency_ms.value).toBeNull();
});
test("unknown and stale Link observations remain separate from deployment status", () => {
  const f = facts();
  f.links.push({ id: 10, workspace_id: 7, carrier: "tst_v1", status: "active", generation: 2,
    deployments: [{ generation: 2, placements: [{ node_id: 1, role: "ingress", runtime_id: "private-runtime-id", generation: 2, config_digest: "ab".repeat(32) }] }] });
  expect(project(f).links[0]!.placements[0]).toMatchObject({ state: "unknown", ready: null });
  f.nodes[0]!.state_report!.reported_at = new Date(now.getTime() - 60001);
  expect(project(f).links[0]!.placements[0]).toMatchObject({ state: "stale", ready: null });
});
test("old placement generation cannot establish Ready for the Link's current generation", () => {
  const f = facts(), digest = "ab".repeat(32);
  f.links.push({ id: 10, workspace_id: 7, carrier: "tst_v1", status: "active", generation: 2,
    deployments: [{ generation: 2, placements: [{ node_id: 1, role: "ingress", runtime_id: "tunex-tst-10-ingress", generation: 1, config_digest: digest }] }] });
  f.nodes[0]!.state_report!.link_placements = [{ id: "tunex-tst-10-ingress", link_id: 10, workspace_id: 7, node_id: 1, role: "ingress",
    generation: 1, observed_generation: 1, config_digest: digest, desired_config_digest: digest,
    state: "ready", ready: true, lease_expires_at: new Date(now.getTime() + 60000).toISOString(), ports: [], runtime_ids: [] }];
  expect(project(f).links[0]!.placements[0]).toMatchObject({ state: "mismatch", ready: false });
});
test("scope-corrupt resource associations and exceeded populations fail instead of returning a partial success", () => {
  for (const mutate of [(f: ObservabilityFacts) => { f.nodes[0]!.node_group.workspace_id = 8; },
    (f: ObservabilityFacts) => { f.forwards[0]!.workspace_id = 8; },
    (f: ObservabilityFacts) => { f.forwards[0]!.egress_node_id = 123; },
    (f: ObservabilityFacts) => { f.forwards[0]!.link_resource_id = 123; }]) {
    const f = facts(); mutate(f); expect(() => project(f)).toThrow("metrics_scope_invalid");
  }
  const f = facts(); f.nodes = Array(OBSERVABILITY_LIMITS.nodes + 1).fill(f.nodes[0]);
  expect(() => project(f)).toThrow("metrics_limit_exceeded");
});
test("closed projection excludes raw reports, secrets, addresses, runtime ids and diagnostic text", () => {
  const view = JSON.stringify(project());
  expect(view).not.toContain("private-");
  for (const field of ["node_credential_hash", "tunnels", "config_digest", "remote_host", "last_handshake_error", "runtime_id"]) expect(view).not.toContain(field);
});
test("Shanghai day defaults and bounded historical query reject invalid dates, reversed/future and extra keys", () => {
  expect(metricWindow({}, new Date("2026-10-11T16:01:00Z"))).toEqual({ start_date: "2026-10-06", end_date: "2026-10-12", timezone: "Asia/Shanghai" });
  expect(metricWindow({ start_date: "2026-09-12", end_date: "2026-10-12" }, now).start_date).toBe("2026-09-12");
  for (const query of [{ start_date: "2026-09-11", end_date: "2026-10-12" }, { start_date: "2026-10-13" },
    { end_date: "2026-10-13" }, { start_date: "0000-01-01" }, { start_date: "2026-02-30" }, { end_date: "2026-13-01" }, { workspace_id: "8" }])
    expect(() => metricWindow(query, now)).toThrow();
});
