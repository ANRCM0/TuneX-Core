import { expect, test } from "bun:test";
import { collectRoutingEdgeProbe, readRoutingEdgeProbe, loadRoutingEdgeProbePlan, type RoutingEdgeProbeDeps } from "../routing-edge-probe.ts";
const now = new Date();
function fixture() {
  const plan = { workspaceId: 7, edgeId: "binding:1", nodeId: 1, peerId: 2, peerAddress: "10.20.0.2", transport: "native_plain" as const, identityDigest: "a".repeat(64) };
  let raw: string | null = null, time = now; const calls: string[] = [];
  const deps: RoutingEdgeProbeDeps = { load: async () => plan, enabled: () => true, now: () => time,
    issue: async () => { calls.push("issue"); return { ok: true, results: [{ host: plan.peerAddress, port: 1, status: "reachable", elapsed_ms: 10,
      route_quality: { packets_sent: 5, packets_received: 4, rtt_ms: 2 } }] }; },
    store: { acquire: async () => { calls.push("reserve"); return true; }, release: async () => { calls.push("release"); },
      read: async () => raw, write: async (_ws, _key, value) => { calls.push("write"); raw = value; return true; } } };
  return { plan, deps, calls, raw: () => raw, time: (ms: number) => { time = new Date(now.getTime() + ms); } };
}
test("ICMP observations preserve exact sample counts, RTT basis and closed redaction", async () => {
  const f = fixture(); const o = await collectRoutingEdgeProbe(7, { schema_version: 1, edge_id: "binding:1" }, f.deps);
  expect(o.state).toBe("reachable"); expect(o.rtt_ms).toBe(2); expect(o.loss_percent).toBe(20);
  expect(o.handshake_success_rate).toBeNull(); expect(o.end_to_end_verified).toBe(false);
  expect(JSON.stringify(o)).not.toContain("10.20.0.2"); expect((await readRoutingEdgeProbe(7, "binding:1", f.deps)).state).toBe("reachable");
  f.time(90_000); expect((await readRoutingEdgeProbe(7, "binding:1", f.deps)).state).toBe("stale");
  f.plan.identityDigest = "b".repeat(64); expect((await readRoutingEdgeProbe(7, "binding:1", f.deps)).observation).toBeNull();
});
test("unsupported or local failures remain unknown; malformed ACKs never enter the cache", async () => {
  for (const status of ["unsupported", "error"]) {
    const f = fixture(); f.deps.issue = async () => ({ ok: true, results: [{ host: f.plan.peerAddress, port: 1, status, elapsed_ms: 0 }] });
    const o = await collectRoutingEdgeProbe(7, { schema_version: 1, edge_id: f.plan.edgeId }, f.deps);
    expect(o.state).toBe("unknown"); expect(o.loss_percent).toBeNull(); expect(o.packets_sent).toBe(0);
  }
  for (const patch of [{ packets_sent: 4 }, { packets_received: 6 }, { rtt_ms: -1 }, { packets_received: 0, rtt_ms: 1 }]) {
    const f = fixture(); f.deps.issue = async () => ({ ok: true, results: [{ host: f.plan.peerAddress, port: 1, status: "reachable", elapsed_ms: 1,
      route_quality: { packets_sent: 5, packets_received: 4, rtt_ms: 2, ...patch } }] });
    await expect(collectRoutingEdgeProbe(7, { schema_version: 1, edge_id: f.plan.edgeId }, f.deps)).rejects.toThrow();
    expect(f.raw()).toBeNull(); expect(f.calls.at(-1)).toBe("release");
  }
});
test("scope, snapshot changes, flags and shared node budgets deny before network or cache effects", async () => {
  for (const kind of ["scope", "changed", "budget", "disabled", "late"]) {
    const f = fixture();
    if (kind === "scope") f.plan.workspaceId = 9;
    if (kind === "disabled") f.deps.enabled = () => false;
    if (kind === "budget") f.deps.store.acquire = async () => false;
    if (kind === "changed") { let reads = 0; f.deps.load = async () => ({ ...f.plan, identityDigest: ++reads > 1 ? "b".repeat(64) : f.plan.identityDigest }); }
    if (kind === "late") f.deps.store.acquire = async () => { f.time(11_000); return true; };
    await expect(collectRoutingEdgeProbe(7, { schema_version: 1, edge_id: f.plan.edgeId }, f.deps)).rejects.toThrow();
    expect(f.calls).not.toContain("issue"); expect(f.raw()).toBeNull();
  }
});
test("private peer planner scopes adjacency and rejects stale source capabilities and caller addresses", async () => {
  const rows = [1, 2].map((id) => ({ id, node_id: `node-${id}`, connect_ip: `10.20.0.${id}`, role: "both", status: "active", lifecycle: "active",
    last_seen_at: now, node_credential_hash: "private-hash", credential_revoked: false, credential_rotated_at: null,
    state_report: { reported_at: now, control_protocol_version: 2, capabilities: ["diagnose_route_edge", "looking_glass:ping"],
      capability_manifest: { schema_version: 2, protocols: ["tcp"], transports: ["stream"], runtime: [], diagnostics: [] } } }));
  const calls: any[] = [];
  const client = { nodeBinding: { findFirst: async (arg: unknown) => { calls.push(arg); return { ingress_node_id: 1, egress_node_id: 2 }; } },
    node: { findMany: async (arg: unknown) => { calls.push(arg); return rows; } } };
  const plan = await loadRoutingEdgeProbePlan(7, "binding:1", client as never, now);
  expect(plan.peerAddress).toBe("10.20.0.2");
  expect(calls[0].where).toEqual({ id: 1, ingress_node: { node_group: { workspace_id: 7 } }, egress_node: { node_group: { workspace_id: 7 } } });
  expect(calls[1].where).toEqual({ id: { in: [1, 2] }, node_group: { workspace_id: 7 } });
  rows[0]!.state_report.reported_at = new Date(0);
  await expect(loadRoutingEdgeProbePlan(7, "binding:1", client as never, now)).rejects.toThrow("probe_capability_unavailable");
});
