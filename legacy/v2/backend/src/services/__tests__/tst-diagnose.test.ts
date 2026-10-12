import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

// Service mocks run in a child to keep control-plane singleton imports out of
// other route tests. The authorized Agent target is verified by its own suite.
test("TST diagnosis uses deployed rule identities and reports TCP/UDP verification honestly", () => {
  const modulePath = (relative: string) => JSON.stringify(fileURLToPath(new URL(relative, import.meta.url)));
  const scenario = `
    import { mock } from "bun:test";
    import assert from "node:assert/strict";
    const row = { id: 91, link_resource_id: 3, ingress_node_id: 11, egress_node_id: 12,
      forward_protocol: "both", config_revision: 5, applied_revision: 5 };
    const spec = { link_id: 3, workspace_id: 4, version: 1, generation: 2, carrier_port: 23001,
      lease_expires_at: new Date(Date.now() + 180000).toISOString(),
      ingress: { id: 11, workspace_id: 4, connect_host: "192.0.2.11", version: "2.0.0", capabilities: ["forward.link.tst.v1"] },
      egress: { id: 12, workspace_id: 4, connect_host: "192.0.2.12", version: "2.0.0", capabilities: ["forward.link.tst.v1"] },
      bindings: [{ forward_id: 91, revision: 5, protocol: "both", listen_port: 23002,
        target_host: "authorized.internal", target_port: 9443 }] };
    const outgoing = { role: "egress", node_id: 12, deployment_id: 20,
      runtime_id: "tunex-tst-3-egress", observation: { ready: true } };
    const link = { deployment: { placements: [{ role: "ingress", observation: { ready: true } }, outgoing] } };
    let available = true, ack = { ok: true, results: [{ host: "authorized.internal", port: 9443,
      status: "reachable", elapsed_ms: 2, detail: "private probe output" }] };
    const commands = [];
    mock.module(${modulePath("../../db.ts")}, () => ({ db: {
      tunnel: { findFirst: async ({ where }) => where.workspace_id === 4 ? row : null },
      linkDeployment: { findUniqueOrThrow: async () => ({ generation: 2, binding_snapshot: { spec } }) }
    } }));
    mock.module(${modulePath("../link-resource.ts")}, () => ({ getLink: async () => link }));
    mock.module(${modulePath("../runtime-admission.ts")}, () => ({ loadNodeCapabilityFacts: async () => ({
      advertisementCurrent: available, capabilities: ["diagnose_link_forward"]
    }) }));
    mock.module(${modulePath("../agent-command-bus.ts")}, () => ({
      enqueueAgentCommand: async (...args) => { commands.push(args); return { scope: "test" }; },
      waitAgentCommandAck: async () => ack
    }));
    const { diagnoseTstForward } = await import(${modulePath("../tst-diagnose.ts")});
    await assert.rejects(() => diagnoseTstForward(91, 9), e => e.code === "forward_not_found");
    assert.equal(commands.length, 0);
    const report = await diagnoseTstForward(91, 4);
    assert.equal(report.segments[0].method, "node_facts");
    assert.equal(report.segments[0].verified, false, "carrier readiness cannot imply business reachability");
    assert.equal(report.segments[1].verified, true);
    assert.equal(report.segments[1].protocol, "tcp");
    assert.equal(report.segments[1].outcome, "ok");
    assert.match(report.segments[1].message, /UDP/);
    assert.equal(JSON.stringify(report).includes("private probe output"), false);
    assert.equal(commands.length, 1);
    const [nodeId, command] = commands[0];
    assert.equal(nodeId, 12); assert.equal(command.resource_id, "tunex-tst-3-egress");
    assert.equal(command.action, "diagnose_link_forward"); assert.equal(command.revision, 2);
    assert.deepEqual(command.payload, { forward_id: 91, revision: 5, timeout_ms: 5000 });
    assert.equal(JSON.stringify(command).includes("authorized.internal"), false,
      "commands must never supply a caller-controlled target");
    assert.deepEqual(commands[0][9], [{ host: "authorized.internal", port: 9443 }]);
    row.forward_protocol = "udp";
    const udp = await diagnoseTstForward(91, 4);
    assert.equal(udp.segments[1].verified, false); assert.equal(udp.segments[1].outcome, "unsupported");
    assert.equal(udp.segments[1].error_code, "udp_probe_unsupported"); assert.equal(commands.length, 1);
    row.forward_protocol = "tcp"; row.applied_revision = 4;
    const pending = await diagnoseTstForward(91, 4);
    assert.equal(pending.segments[1].verified, false); assert.equal(pending.segments[1].outcome, "unknown");
    assert.equal(commands.length, 1);
    row.applied_revision = 5; available = false;
    const stale = await diagnoseTstForward(91, 4);
    assert.equal(stale.segments[1].error_code, "diagnose_capability_missing"); assert.equal(commands.length, 1);
    available = true; ack = { ok: false, error_code: "PRIVATE KEY / sensitive error" };
    const rejected = await diagnoseTstForward(91, 4);
    assert.equal(rejected.segments[1].verified, false); assert.equal(rejected.segments[1].error_code, "diagnose_failed");
    assert.equal(JSON.stringify(rejected).includes("PRIVATE KEY"), false);
    console.log("tst-diagnose-boundary-ok");
  `;
  const child = Bun.spawnSync([process.execPath, "--no-env-file", "--eval", scenario], { stdout: "pipe", stderr: "pipe" });
  expect(child.exitCode, new TextDecoder().decode(child.stderr)).toBe(0);
  expect(new TextDecoder().decode(child.stdout)).toContain("tst-diagnose-boundary-ok");
});
