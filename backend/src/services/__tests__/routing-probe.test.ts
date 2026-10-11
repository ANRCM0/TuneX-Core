import { expect, test } from "bun:test";
import { collectRoutingProbe, readRoutingProbe, loadRoutingProbePlan, routingProbesEnabled,
  type RoutingProbeDeps, type RoutingProbePlan } from "../routing-probe.ts";
import { ROUTING_PROBE_LIMITS, RoutingProbeInputSchema, summarizeRoutingProbe } from "../../domain/routing/probe.ts";

const stamp = new Date("2026-10-11T12:00:00Z");
const liveStamp = new Date();
const uuid = "e9369631-e0cd-4ba9-8d04-9a5f12c8a2aa";
const input = { schema_version: 1, forward_id: 4, expected_revision: 1 };
function fixture() {
  const plan: RoutingProbePlan = { workspaceId: 7, forwardId: 4, revision: 1, nodeId: 1,
    resourceId: "tunex-4-direct", targets: [{ host: "private.example.test", port: 8443 }], identityDigest: "a".repeat(64) };
  const calls: string[] = []; let raw: string | null = null; let time = new Date(stamp); let allowed = true;
  const deps: RoutingProbeDeps = { enabled: () => true, load: async () => { calls.push("load"); return structuredClone(plan); },
    now: () => time, uuid: () => uuid,
    issue: async () => { calls.push("issue"); return { ok: true, results: [{ ...plan.targets[0]!, status: "reachable", elapsed_ms: 12 }] }; },
    store: { acquire: async () => { calls.push("acquire"); return allowed; }, release: async () => { calls.push("release"); },
      read: async () => raw, write: async (_ws, _f, value) => { calls.push("write"); raw = value; return true; } } };
  return { plan, deps, calls, setRaw: (s: string | null) => { raw = s; }, raw: () => raw,
    time: (ms: number) => { time = new Date(stamp.getTime() + ms); }, deny: () => { allowed = false; } };
}
test("TCP measurements disclose only bounded target slots and preserve unmeasured dimensions", async () => {
  const f = fixture(); const result = await collectRoutingProbe(7, input, f.deps);
  expect(result.state).toBe("reachable"); expect(result.tcp_connect_success_rate).toBe(1);
  expect(result.samples).toEqual([{ target_index: 0, status: "reachable", connect_elapsed_ms: 12 }]);
  expect(result.rtt_ms).toBeNull(); expect(result.loss_percent).toBeNull(); expect(result.tls_handshake_success_rate).toBeNull();
  expect(result.end_to_end_verified).toBe(false); expect(result.udp_verified).toBe(false);
  expect(result.timing_basis).toBe("dns_and_tcp_connect");
  expect(JSON.stringify(result)).not.toContain("private.example"); expect(f.raw()).not.toContain("8443");
  expect(f.calls).toEqual(["load", "acquire", "load", "issue", "load", "write", "release"]);
});
test("disabled, invalid input, revision and scope mismatches do not spend budget or dispatch", async () => {
  for (const kind of ["disabled", "input", "revision", "scope"]) {
    const f = fixture(); let body: unknown = input;
    if (kind === "disabled") f.deps.enabled = () => false;
    if (kind === "input") body = { ...input, host: "127.0.0.1", port: 80 };
    if (kind === "revision") f.plan.revision = 2;
    if (kind === "scope") f.plan.workspaceId = 9;
    await expect(collectRoutingProbe(7, body, f.deps)).rejects.toThrow();
    expect(f.calls).not.toContain("acquire"); expect(f.calls).not.toContain("issue");
  }
  for (const body of [{ ...input, samples: 100 }, { ...input, timeout_ms: 60_000 }, { ...input, expected_revision: 0 }])
    expect(RoutingProbeInputSchema.safeParse(body).success).toBe(false);
});
test("exhausted budgets return a retryable denial without a command", async () => {
  const f = fixture(); f.deny(); await expect(collectRoutingProbe(7, input, f.deps)).rejects.toThrow("probe_budget_exhausted");
  expect(f.calls).toEqual(["load", "acquire"]);
});
test("changed targets before dispatch or after ACK cannot be accepted under an old identity", async () => {
  for (const changeAt of [2, 3]) {
    const f = fixture(); let reads = 0;
    f.deps.load = async () => ({ ...f.plan, identityDigest: ++reads >= changeAt ? "b".repeat(64) : f.plan.identityDigest });
    await expect(collectRoutingProbe(7, input, f.deps)).rejects.toThrow("probe_identity_changed");
    expect(f.calls).not.toContain("write"); expect(f.calls.at(-1)).toBe("release");
    if (changeAt === 2) expect(f.calls).not.toContain("issue");
  }
});
test("timeouts, invalid result sets and feature disable release reservation without recording a network fault", async () => {
  for (const kind of ["failed", "exception", "late", "foreign", "disabled", "expired"]) {
    const f = fixture();
    f.deps.issue = async () => {
      if (kind === "exception") throw new Error("credential-password-detail");
      if (kind === "failed") return { ok: false };
      if (kind === "late") f.time(25_000);
      if (kind === "disabled") f.deps.enabled = () => false;
      return { ok: true, results: [{ host: kind === "foreign" ? "other.test" : f.plan.targets[0]!.host,
        port: 8443, elapsed_ms: 12, status: "reachable" }] };
    };
    if (kind === "expired") f.deps.store.write = async () => false;
    await expect(collectRoutingProbe(7, input, f.deps)).rejects.toThrow();
    expect(f.raw()).toBeNull(); expect(f.calls.at(-1)).toBe("release");
  }
});
test("cached observations become stale, absent or invalid rather than healthy", async () => {
  const f = fixture(); expect((await readRoutingProbe(7, 4, f.deps)).reason).toBe("probe_not_recorded");
  await collectRoutingProbe(7, input, f.deps);
  expect((await readRoutingProbe(7, 4, f.deps)).state).toBe("reachable");
  f.time(ROUTING_PROBE_LIMITS.freshness_ms); expect((await readRoutingProbe(7, 4, f.deps)).state).toBe("stale");
  f.plan.identityDigest = "b".repeat(64); expect((await readRoutingProbe(7, 4, f.deps)).observation).toBeNull();
  f.plan.identityDigest = "a".repeat(64);
  const original = f.raw()!;
  for (const raw of ["{", "x".repeat(17000), JSON.stringify({ ...JSON.parse(original), password: "not-allowed" }),
    original.replace('"workspace_id":7', '"workspace_id":9'),
    original.replace('"state":"reachable"', '"state":"unreachable"'),
    original.replace('"observed_at":"2026-10-11T12:00:00.000Z"', '"observed_at":"2026-10-11T13:00:00.000Z"')]) {
    f.setRaw(raw); expect((await readRoutingProbe(7, 4, f.deps)).observation).toBeNull();
  }
});
test("a delayed Redis reservation cannot dispatch after its safety window", async () => {
  const f = fixture(); f.deps.store.acquire = async () => { f.time(12_000); return true; };
  await expect(collectRoutingProbe(7, input, f.deps)).rejects.toThrow("probe_reservation_expired");
  expect(f.calls).not.toContain("issue"); expect(f.calls.at(-1)).toBe("release");
});
test("unknown and unattempted targets cannot be summed into zero loss or full reachability", () => {
  const make = (statuses: string[], details: (string | undefined)[] = []) => summarizeRoutingProbe({ observationId: uuid,
    workspaceId: 7, forwardId: 4, revision: 1, nodeId: 1, startedAt: stamp, observedAt: stamp,
    targets: statuses.map((_s, i) => ({ host: `target-${i}.test`, port: 443 })),
    results: statuses.map((status, i) => ({ host: `target-${i}.test`, port: 443, status, elapsed_ms: 1, detail: details[i] })) });
  expect(make(["reachable", "refused"]).state).toBe("mixed");
  expect(make(["refused", "timeout"]).state).toBe("unreachable");
  expect(make(["dns_error"]).tcp_connect_success_rate).toBeNull();
  const partial = make(["reachable", "timeout"], [undefined, "probe budget exhausted before this target"]);
  expect(partial.state).toBe("unknown"); expect(partial.samples[1]!.connect_elapsed_ms).toBeNull();
  expect(make(["error"]).state).toBe("unknown");
  expect(() => make(["unsupported"])).toThrow("probe_result_invalid");
});

function row() {
  const node = { id: 1, node_id: "agent-one", lifecycle: "active", status: "active", role: "both", last_seen_at: liveStamp,
    node_credential_hash: "private-credential-hash", credential_revoked: false, credential_rotated_at: null as Date | null,
    node_group: { workspace_id: 7 }, state_report: { reported_at: liveStamp, control_protocol_version: 2,
      capabilities: ["diagnose_tunnel"], capability_manifest: { schema_version: 2, protocols: ["tcp"], transports: ["stream"],
        runtime: [], diagnostics: ["tunnel_probe"] } } };
  return { id: 4, workspace_id: 7, tunnel_mode: "direct", forward_protocol: "tcp", config_revision: 1, applied_revision: 1,
    desired_status: "active", apply_status: "active", link_resource_id: null as number | null, middle_node_id: null as number | null,
    federated_egress_peer: null, remote_host: "target.test", remote_port: 443, ingress_node: node,
    egress_node: null as typeof node | null, egress_pool: null as { id: number; node_id: number; status: string;
      targets: { id: number; host: string; port: number }[] } | null };
}
async function load(r: ReturnType<typeof row> | null, binding = true) {
  const calls: unknown[] = [];
  const client = { tunnel: { findFirst: async (args: unknown) => { calls.push(args); return r; } },
    nodeBinding: { findFirst: async () => binding ? { id: 1 } : null } };
  const plan = await loadRoutingProbePlan(7, 4, client as never, liveStamp);
  return { plan, calls };
}
test("production planner uses scoped whitelisted reads and binds target/credential identities", async () => {
  const r = row(); const a = await load(r);
  expect(a.plan.targets).toEqual([{ host: "target.test", port: 443 }]);
  expect(a.calls[0]).toMatchObject({ where: { id: 4, workspace_id: 7, category: "port_forward" } });
  r.remote_port = 8443; expect((await load(r)).plan.identityDigest).not.toBe(a.plan.identityDigest);
  r.remote_port = 443; r.ingress_node.node_credential_hash = "rotated-private-hash";
  expect((await load(r)).plan.identityDigest).not.toBe(a.plan.identityDigest);
});
test("production planner fails closed for unsupported transport/protocol/topology, unconfirmed config and unauthorized nodes", async () => {
  const patches = [ { forward_protocol: "udp" }, { forward_protocol: "tls" }, { link_resource_id: 8 },
    { middle_node_id: 2 }, { tunnel_mode: "invalid" }, { applied_revision: 0 }, { desired_status: "suspended" } ];
  for (const patch of patches) await expect(load(Object.assign(row(), patch))).rejects.toThrow();
  await expect(load(null)).rejects.toThrow("forward_not_found");
  for (const patch of [{ lifecycle: "maintenance" }, { credential_revoked: true }, { last_seen_at: new Date(0) },
    { last_seen_at: new Date(liveStamp.getTime() + 1000) }, { role: "egress" }, { node_group: { workspace_id: 9 } },
    { credential_rotated_at: liveStamp }]) {
    const r = row(); Object.assign(r.ingress_node, patch); await expect(load(r)).rejects.toThrow();
  }
});
test("stale, future, absent and malformed capability reports cannot dispatch", async () => {
  for (const patch of [{ reported_at: new Date(0) }, { reported_at: new Date(liveStamp.getTime() + 1) },
    { capabilities: [] }, { capabilities: "bad-shape" }, { capability_manifest: { schema_version: 2, diagnostics: "bad-shape" } }]) {
    const r = row(); Object.assign(r.ingress_node.state_report, patch); await expect(load(r)).rejects.toThrow("probe_capability_unavailable");
  }
});
test("relay probes exactly the authorized active pool; refused bounds never truncate targets", async () => {
  const r = row(); r.tunnel_mode = "relay"; r.egress_node = { ...r.ingress_node, id: 2, node_id: "agent-two" };
  r.egress_pool = { id: 10, node_id: 2, status: "active", targets: [{ id: 1, host: "pool-target.test", port: 443 }] };
  const plan = (await load(r)).plan; expect(plan.nodeId).toBe(2); expect(plan.resourceId).toBe("tunex-4-egress");
  expect(plan.targets[0]!.host).toBe("pool-target.test"); await expect(load(r, false)).rejects.toThrow("probe_target_authority_invalid");
  r.egress_pool.node_id = 9; await expect(load(r)).rejects.toThrow("probe_target_authority_invalid");
  r.egress_pool.node_id = 2;
  r.egress_pool.targets = Array.from({ length: 4 }, (_v, i) => ({ id: i, host: `target-${i}.test`, port: 443 }));
  await expect(load(r)).rejects.toThrow("probe_target_limit_exceeded");
});
test("routing probes require both exact-value default-off switches", () => {
  const previous = [process.env.TUNEX_ROUTING_ENABLED, process.env.TUNEX_ROUTING_PROBES_ENABLED];
  try {
    for (const [routing, probes, expected] of [["false", "true", false], ["true", "false", false],
      ["true", "1", false], ["true", "true", true]] as const) {
      process.env.TUNEX_ROUTING_ENABLED = routing; process.env.TUNEX_ROUTING_PROBES_ENABLED = probes;
      expect(routingProbesEnabled()).toBe(expected);
    }
  } finally {
    for (const [i, key] of ["TUNEX_ROUTING_ENABLED", "TUNEX_ROUTING_PROBES_ENABLED"].entries())
      if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i];
  }
});
