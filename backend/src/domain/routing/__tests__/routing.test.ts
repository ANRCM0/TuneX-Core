import { describe, expect, test } from "bun:test";
import { RoutingPreviewSchema, previewRoutingPolicy, ROUTING_LIMITS } from "../model.ts";
import { loadRoutingTopology, projectRoutingTopology, routingEnabled, type RoutingFacts } from "../../../services/routing-topology.ts";
import type { Prisma } from "@prisma/client";

function fixture(now = new Date()): RoutingFacts {
  return {
    nodes: [1, 2, 3].map((id) => ({ id, node_id: `node-${id}`, node_group: { workspace_id: 7 }, role: "both",
      lifecycle: "active", status: "active", last_seen_at: now, node_credential_hash: "private-credential-do-not-expose",
      credential_revoked: false, credential_rotated_at: null,
      state_report: { reported_at: now, control_protocol_version: 2,
        capabilities: ["apply_tunnel", "forward.link.tst.v1", "forward.protocol.both.native.v1"],
        capability_manifest: { schema_version: 2, protocols: ["tcp", "udp", "both"], transports: ["stream", "datagram", "mixed"],
          runtime: [], diagnostics: [] } } })),
    bindings: [{ id: 10, ingress_node_id: 1, egress_node_id: 3 }, { id: 11, ingress_node_id: 1, egress_node_id: 2 },
      { id: 12, ingress_node_id: 2, egress_node_id: 3 }],
    links: [{ id: 20, workspace_id: 7, carrier: "tst_v1", status: "active", desired_version: 1,
      versions: [{ version: 1, config: { ingress_node_id: 1, egress_node_id: 3, carrier_port: 24000 } }] }],
    forwards: [
      { id: 40, workspace_id: 7, config_revision: 4, tunnel_mode: "relay", forward_protocol: "tcp",
        ingress_node_id: 1, egress_node_id: 3, middle_node_id: null, federated_egress_peer: null, link_resource_id: null,
        remote_host: "example.test", remote_port: 443, egress_pool: { node_id: 3, status: "active", targets: [{ host: "example.test", port: 443 }] },
        desired_status: "active", apply_status: "active" },
      { id: 41, workspace_id: 7, config_revision: 1, tunnel_mode: "relay", forward_protocol: "both",
        ingress_node_id: 1, egress_node_id: 3, middle_node_id: null, federated_egress_peer: null, link_resource_id: 20,
        remote_host: "example.test", remote_port: 443, egress_pool: null,
        desired_status: "active", apply_status: "active" },
    ],
  };
}
function draft(graph: ReturnType<typeof projectRoutingTopology>) {
  return { schema_version: 1, forward_id: 40, expected_revision: 4, topology_digest: graph.digest,
    strategy: "priority", hop_limit: 3, candidates: [{ id: "primary", edge_ids: ["binding:10"], priority: 0, weight: 1 }] };
}

describe("V2.3 scoped graph facts", () => {
  test("parallel native/TST edges, current Forward references and no fabricated reachability", () => {
    const graph = projectRoutingTopology(7, fixture());
    expect(graph.edges).toHaveLength(4);
    expect(graph.forwards.map((f) => f.current_edge_ids)).toEqual([["binding:10"], ["link:20"]]);
    expect(graph.forwards.every((f) => f.issues.length === 0)).toBe(true);
    expect(graph.nodes[0]!.capabilities.native_plain).toEqual(["tcp", "udp", "both"]);
    expect(graph.nodes[0]!.capabilities.tst_v1).toEqual(["tcp", "udp", "both"]);
    expect(graph.nodes.every((n) => n.health.state === "unknown")).toBe(true);
    expect(graph.edges.every((e) => e.health.state === "unknown" && e.cost.value === null && e.quality.rtt_ms === null)).toBe(true);
    expect(JSON.stringify(graph)).not.toContain("private-credential");
    expect(JSON.stringify(graph)).not.toContain("carrier_port");
    expect(graph.execution_enabled).toBe(false);
  });
  test("reject foreign Workspace rows and dangling bindings without returning foreign IDs", () => {
    for (const key of ["nodes", "links", "forwards"] as const) {
      const facts = fixture();
      if (key === "nodes") facts.nodes[0]!.node_group.workspace_id = 8;
      else facts[key][0]!.workspace_id = 8;
      expect(() => projectRoutingTopology(7, facts)).toThrow("topology_scope_invalid");
    }
    const facts = fixture();
    facts.bindings[0]!.egress_node_id = 99;
    expect(() => projectRoutingTopology(7, facts)).toThrow("topology_scope_invalid");
  });
  test("broken or historical Link config never creates a usable TST edge", () => {
    for (const config of [null, { ingress_node_id: 1, egress_node_id: 99, carrier_port: 24000 },
      { ingress_node_id: 1, egress_node_id: 3, carrier_port: 24000, private_key: "private-secret" }]) {
      const facts = fixture(); facts.links[0]!.versions[0]!.config = config;
      const graph = projectRoutingTopology(7, facts);
      expect(graph.edges.some((e) => e.id === "link:20")).toBe(false);
      expect(graph.forwards[1]!.issues).toContain("unsupported_forward_contract");
      expect(JSON.stringify(graph)).not.toContain("private-secret");
    }
    const facts = fixture(); facts.links[0]!.carrier = "legacy_unsupported";
    expect(projectRoutingTopology(7, facts).notices[0]!.code).toBe("unsupported_carrier");
  });
  test("missing current version or mismatched Forward endpoints cannot borrow another Link", () => {
    const facts = fixture(); facts.links[0]!.desired_version = 2;
    expect(projectRoutingTopology(7, facts).edges).toHaveLength(3);
    facts.links[0]!.desired_version = 1;
    facts.forwards[1]!.egress_node_id = 2;
    expect(projectRoutingTopology(7, facts).forwards[1]!.issues).toContain("carrier_edge_unavailable");
  });
  test("unknown protocols, federation, invalid middle placement and missing revisions fail closed", () => {
    for (const patch of [{ forward_protocol: "quic" }, { forward_protocol: null }, { tunnel_mode: null },
      { middle_node_id: 1 }, { middle_node_id: 99 }, { federated_egress_peer: "external" }, { config_revision: null }, { egress_pool: null }]) {
      const facts = fixture(); Object.assign(facts.forwards[0]!, patch);
      const graph = projectRoutingTopology(7, facts);
      expect(() => previewRoutingPolicy(graph, draft(graph))).toThrow();
    }
  });
  test("confirmed Native TCP middle placement projects both authorized adjacency edges", () => {
    const facts = fixture(); facts.forwards[0]!.middle_node_id = 2;
    const graph = projectRoutingTopology(7, facts);
    expect(graph.forwards[0]!.issues).toEqual([]);
    expect(graph.forwards[0]!.current_edge_ids).toEqual(["binding:11", "binding:12"]);
    facts.bindings = facts.bindings.filter((b) => b.id !== 12);
    expect(projectRoutingTopology(7, facts).forwards[0]!.issues).toContain("carrier_edge_unavailable");
    facts.forwards[0]!.forward_protocol = "both";
    expect(projectRoutingTopology(7, facts).forwards[0]!.issues).toContain("unsupported_forward_topology");
  });
  test("a foreign endpoint is suppressed from the public Forward projection", () => {
    const facts = fixture(); facts.forwards[0]!.egress_node_id = 999;
    const forward = projectRoutingTopology(7, facts).forwards[0]!;
    expect(forward.target_node_id).toBeNull(); expect(forward.issues).toContain("endpoint_unavailable");
  });
  test("Native target pool must belong to the Forward's authorized exit and remain active", () => {
    for (const patch of [{ node_id: 99 }, { status: "inactive" }, { targets: [] }]) {
      const facts = fixture(); Object.assign(facts.forwards[0]!.egress_pool!, patch);
      const graph = projectRoutingTopology(7, facts);
      expect(() => previewRoutingPolicy(graph, draft(graph))).toThrow("forward_topology_unavailable");
    }
  });
  test("stable ordering and graph identity, while capability changes invalidate the identity", () => {
    const now = new Date(); const facts = fixture(now);
    const graph = projectRoutingTopology(7, facts, now);
    facts.nodes.reverse(); facts.bindings.reverse(); facts.forwards.reverse();
    expect(projectRoutingTopology(7, facts, new Date(now.getTime() + 1)).digest).toBe(graph.digest);
    facts.nodes[0]!.state_report!.capabilities = [];
    expect(projectRoutingTopology(7, facts, now).digest).not.toBe(graph.digest);
  });
  test("all graph populations are bounded rather than silently truncated", () => {
    for (const key of Object.keys(ROUTING_LIMITS) as (keyof typeof ROUTING_LIMITS)[]) {
      const facts = fixture();
      facts[key] = Array(ROUTING_LIMITS[key] + 1).fill(facts[key][0]) as never;
      expect(() => projectRoutingTopology(7, facts)).toThrow("topology_limit_exceeded");
    }
  });
  test("default off uses exact true", () => {
    const before = process.env.TUNEX_ROUTING_ENABLED;
    try {
      for (const value of [undefined, "false", "1", "TRUE", " true ", "true"]) {
        if (value === undefined) delete process.env.TUNEX_ROUTING_ENABLED;
        else process.env.TUNEX_ROUTING_ENABLED = value;
        expect(routingEnabled()).toBe(value === "true");
      }
    } finally {
      if (before === undefined) delete process.env.TUNEX_ROUTING_ENABLED;
      else process.env.TUNEX_ROUTING_ENABLED = before;
    }
  });
  test("production reader scopes and bounds each query, selects no credentials/placements in reports", async () => {
    const facts = fixture(); const calls: { key: string; args: any }[] = [];
    const client = Object.fromEntries([["node", "nodes"], ["nodeBinding", "bindings"], ["linkResource", "links"], ["tunnel", "forwards"]]
      .map(([key, kind]) => [key, { findMany: async (args: unknown) => {
        calls.push({ key: key!, args }); return facts[kind as keyof RoutingFacts];
      } }])) as unknown as Pick<Prisma.TransactionClient, "node" | "nodeBinding" | "linkResource" | "tunnel">;
    expect((await loadRoutingTopology(7, client)).forwards).toHaveLength(2);
    expect(calls.map((c) => c.args.take).sort((a, b) => a - b)).toEqual([257, 257, 501, 513]);
    expect(calls.find((c) => c.key === "node")!.args.where).toEqual({ node_group: { workspace_id: 7 } });
    expect(calls.find((c) => c.key === "nodeBinding")!.args.where).toEqual({
      ingress_node: { node_group: { workspace_id: 7 } }, egress_node: { node_group: { workspace_id: 7 } } });
    expect(calls.find((c) => c.key === "tunnel")!.args.where).toEqual({ workspace_id: 7, category: "port_forward" });
    expect(JSON.stringify(calls.find((c) => c.key === "node")!.args.select.state_report)).not.toContain("link_placements");
  });
});

describe("capability observations remain separate from business health", () => {
  test("old/future/rotated reports are stale, missing reports unknown, malformed reports invalid", () => {
    const now = new Date();
    for (const stamp of [new Date(now.getTime() - 300_000), new Date(now.getTime() + 1_000)]) {
      const facts = fixture(now); facts.nodes[0]!.state_report!.reported_at = stamp;
      expect(projectRoutingTopology(7, facts, now).nodes[0]!.capabilities.state).toBe("stale");
    }
    const facts = fixture(now); facts.nodes[0]!.credential_rotated_at = now;
    expect(projectRoutingTopology(7, facts, now).nodes[0]!.capabilities.native_plain).toEqual([]);
    facts.nodes[0]!.credential_rotated_at = null; facts.nodes[0]!.state_report = null;
    expect(projectRoutingTopology(7, facts, now).nodes[0]!.capabilities.state).toBe("unknown");
    facts.nodes[0]!.state_report = { reported_at: now, capabilities: "bad" };
    expect(projectRoutingTopology(7, facts, now).nodes[0]!.capabilities.state).toBe("invalid");
  });
  test("explicitly empty or unreadable manifests never gain baseline protocol capabilities", () => {
    const facts = fixture(); facts.nodes[0]!.state_report!.capability_manifest = null;
    expect(projectRoutingTopology(7, facts).nodes[0]!.capabilities.native_plain).toEqual([]);
    facts.nodes[0]!.state_report!.capabilities = [];
    expect(projectRoutingTopology(7, facts).nodes[0]!.capabilities.tst_v1).toEqual([]);
    facts.nodes[0]!.state_report!.capability_manifest = { schema_version: 99 };
    expect(projectRoutingTopology(7, facts).nodes[0]!.capabilities.native_plain).toEqual([]);
  });
});

describe("candidate intent validation without dispatch", () => {
  test("valid primary and alternate retain weights but do not select or execute", () => {
    const graph = projectRoutingTopology(7, fixture()); const input = draft(graph);
    input.candidates.push({ id: "alternate", edge_ids: ["binding:11", "binding:12"], priority: 10, weight: 2 });
    const preview = previewRoutingPolicy(graph, input);
    expect(preview.valid).toBe(true); expect(preview.execution_enabled).toBe(false);
    expect(preview.candidates[1]!.node_ids).toEqual([1, 2, 3]);
    expect(preview.candidates[1]!.admission_issues).toContain("multi_hop_execution_unavailable");
    expect(preview.candidates[0]!.health.state).toBe("unknown");
  });
  test("unknown edges, disconnection, wrong exit and transport mismatch have distinct reasons", () => {
    const graph = projectRoutingTopology(7, fixture());
    for (const [edge_ids, reason] of [
      [["binding:99"], "edge_unavailable"], [["binding:12"], "path_disconnected"],
      [["binding:11"], "target_authority_mismatch"], [["link:20"], "transport_mismatch"],
    ] as const) {
      const input = draft(graph); input.candidates[0]!.edge_ids = [...edge_ids];
      expect(previewRoutingPolicy(graph, input).candidates[0]!.reasons).toContain(reason);
    }
  });
  test("loop and hop bound reject the candidate", () => {
    const facts = fixture(); facts.bindings.push({ id: 13, ingress_node_id: 2, egress_node_id: 1 });
    const graph = projectRoutingTopology(7, facts); const input = draft(graph);
    input.candidates[0]!.edge_ids = ["binding:11", "binding:13"];
    expect(previewRoutingPolicy(graph, input).candidates[0]!.reasons).toContain("routing_loop");
    input.candidates[0]!.edge_ids = ["binding:11", "binding:12"]; input.hop_limit = 2;
    expect(previewRoutingPolicy(graph, input).candidates[0]!.reasons).toContain("hop_limit_exceeded");
  });
  test("role/capability/lifecycle restrictions and unavailable Link status remain explicit", () => {
    const facts = fixture(); facts.nodes[1]!.role = "egress"; facts.nodes[2]!.lifecycle = "maintenance";
    facts.nodes[2]!.state_report!.capabilities = [];
    const graph = projectRoutingTopology(7, facts); const input = draft(graph);
    input.candidates[0]!.edge_ids = ["binding:11", "binding:12"];
    const candidate = previewRoutingPolicy(graph, input).candidates[0]!;
    expect(candidate.reasons).toContain("node_role_mismatch");
    expect(candidate.admission_issues).toContain("capability_unavailable");
    expect(candidate.admission_issues).toContain("node_not_accepting_business");
    facts.links[0]!.status = "retired";
    const tstGraph = projectRoutingTopology(7, facts);
    const tstInput = { ...draft(tstGraph), forward_id: 41, expected_revision: 1,
      candidates: [{ id: "tst", edge_ids: ["link:20"], priority: 0, weight: 1 }] };
    expect(previewRoutingPolicy(tstGraph, tstInput).candidates[0]!.admission_issues).toContain("link_unavailable");
  });
  test("direct is one physical node with no carrier, relay cannot silently become direct", () => {
    const facts = fixture(); Object.assign(facts.forwards[0]!, { tunnel_mode: "direct", egress_node_id: null });
    const graph = projectRoutingTopology(7, facts); const input = draft(graph); input.candidates[0]!.edge_ids = [];
    expect(previewRoutingPolicy(graph, input).candidates[0]!.node_ids).toEqual([1]);
    expect(previewRoutingPolicy(graph, input).valid).toBe(true);
    const relayGraph = projectRoutingTopology(7, fixture()); input.topology_digest = relayGraph.digest;
    expect(previewRoutingPolicy(relayGraph, input).candidates[0]!.reasons).toContain("relay_requires_carrier_edge");
  });
  test("foreign graphs cannot be referenced and stale snapshot/revision fail closed", () => {
    const graph = projectRoutingTopology(7, fixture());
    expect(() => previewRoutingPolicy(graph, { ...draft(graph), forward_id: 99 })).toThrow("forward_not_found");
    expect(() => previewRoutingPolicy(graph, { ...draft(graph), expected_revision: 3 })).toThrow("revision_conflict");
    expect(() => previewRoutingPolicy(graph, { ...draft(graph), topology_digest: "a".repeat(64) })).toThrow("topology_conflict");
    graph.edges[0]!.workspace_id = 8;
    expect(previewRoutingPolicy(graph, draft(graph)).candidates[0]!.reasons).toContain("edge_unavailable");
  });
  test("closed input rejects unknown fields, strategy, zero/invalid weights and duplicate paths", () => {
    const graph = projectRoutingTopology(7, fixture()); const input = draft(graph);
    for (const patch of [{ schema_version: 2 }, { strategy: "automatic" }, { hop_limit: 4 }, { workspace_id: 8 },
      { candidates: [] }, { candidates: [input.candidates[0], input.candidates[0]] },
      { candidates: [{ ...input.candidates[0], weight: 0 }] },
      { candidates: [{ ...input.candidates[0], edge_ids: ["https://evil"] }] }])
      expect(RoutingPreviewSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
});
