import { beforeAll, afterAll, test, expect, mock } from "bun:test";
import { randomUUID } from "node:crypto";
import { db } from "../src/db.ts";
import { provisionTstFixture } from "./tst-real-fixture.ts";
import type { TstPlacementConfig } from "../src/domain/link/tst-compiler.ts";
import type { WorkspaceAccess } from "../src/services/workspace.ts";

const enabled = process.env.TUNEX_DB_TEST === "1";
let fixture: Awaited<ReturnType<typeof provisionTstFixture>>;
let access: WorkspaceAccess;
let failIngress = false;
let beforeAck: ((config: TstPlacementConfig) => Promise<void>) | null = null;
const sent: { id: string; role: string; generation: number; remove: boolean; bindings: number[] }[] = [];
mock.module("../src/services/link-transport.ts", () => ({ sendLinkPlacement: async (config: TstPlacementConfig, remove = false) => {
  sent.push({ id: config.id, role: config.role, generation: config.generation, remove,
    bindings: config.transport_config.bindings.map((binding) => binding.forward_id) });
  if (failIngress && config.role === "ingress") throw new Error("link_apply_unconfirmed");
  await beforeAck?.(config);
  await db.nodeStateReport.update({ where: { node_id: config.node_id }, data: { reported_at: new Date(),
    link_placements: [{ id: config.id, link_id: config.link_id, workspace_id: config.workspace_id, node_id: config.node_id,
      role: config.role, generation: config.generation, observed_generation: remove ? 0 : config.generation,
      config_digest: config.config_digest, desired_config_digest: config.config_digest, ready: !remove &&
        (config.role !== "ingress" || config.transport_config.bindings.length > 0),
      state: remove ? "removed" : config.role === "ingress" && !config.transport_config.bindings.length ? "passive" : "ready",
      lease_expires_at: config.lease_expires_at, ports: remove ? [] : config.ports, runtime_ids: remove ? [] : config.runtime_ids }] } });
} }));
const application = await import("../src/services/forward-application.ts");
const resources = await import("../src/services/link-resource.ts");
const forwards = await import("../src/services/forward-service.ts");
const run = enabled ? test : test.skip;
beforeAll(async () => {
  if (!enabled) return;
  if (new URL(process.env.DATABASE_URL!).pathname !== "/tunex_v2_test") throw new Error("isolated_v2_database_required");
  process.env.TUNEX_TST_ENABLED = "true";
  process.env.TUNEX_LINK_SEAL_KEY = "7f".repeat(32);
  fixture = await provisionTstFixture();
  access = { id: fixture.workspace_id, role: "member", actorId: fixture.member.id, customRoleId: null, kind: "team",
    personalWorkspaceId: (await db.workspace.findUniqueOrThrow({ where: { personal_user_id: fixture.member.id } })).id };
  for (const node of [fixture.ingress, fixture.egress]) await db.nodeStateReport.create({ data: {
    node_id: node.id, version: "2.0.0", role: node.id === fixture.ingress.id ? "ingress" : "egress", reported_at: new Date(Date.now() + 1),
    control_protocol_version: 1, capabilities: ["apply_link", "remove_link", "forward.link.tst.v1", "apply_tunnel", "remove_tunnel", "suspend_tunnel"],
    capability_manifest: { version: 1, protocols: ["tcp", "udp"], transports: ["stream", "datagram"], runtime: [] }, tunnels: [], link_placements: [] } });
});
afterAll(async () => { await db.$disconnect(); });
const request = (edit: Record<string, unknown> = {}) => ({ idempotency_key: randomUUID(), name: "test forward", path: "relay", transport: "tst_v1",
  protocol: "tcp", ingress_node_id: fixture.ingress.id, egress_node_id: fixture.egress.id,
  target_host: "127.0.0.1", target_port: 34567, ...edit });
async function settled(id: string) {
  for (let i = 0; i < 200; i++) {
    const receipt = await application.getForwardOperation(access.id, fixture.member.id, id);
    const operation = await db.forwardOperation.findUniqueOrThrow({ where: { id } });
    if (!["accepted", "applying"].includes(operation.state) && !operation.executor_token)
      return application.getForwardOperation(access.id, fixture.member.id, id);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("operation_did_not_settle");
}
run("concurrent same-key creates exactly one durable business row and replays across lost responses", async () => {
  const input = request();
  const receipts = await Promise.all(Array.from({ length: 6 }, () => application.submitForwardOperation(access, fixture.member.id, input)));
  expect(new Set(receipts.map((r) => r.operation_id)).size).toBe(1);
  const receipt = await settled(receipts[0]!.operation_id);
  expect(receipt.state, JSON.stringify({ state: receipt.state, stage: receipt.stage, error_code: receipt.error_code })).toBe("completed");
  expect(receipt.forward_id).not.toBeNull();
  expect(await db.forwardOperation.count({ where: { workspace_id: access.id, idempotency_key: input.idempotency_key } })).toBe(1);
  expect(await db.tunnel.count({ where: { workspace_id: access.id } })).toBe(1);
  const replay = await application.submitForwardOperation(access, fixture.member.id, input);
  expect(replay.replayed).toBe(true); expect(replay.forward_id).toBe(receipt.forward_id);
  await expect(application.submitForwardOperation(access, fixture.member.id, { ...input, target_port: 1 })).rejects.toMatchObject({ code: "idempotency_conflict" });
  await expect(application.getForwardOperation(access.id + 1, fixture.member.id, receipt.operation_id)).rejects.toMatchObject({ code: "operation_not_found" });
  await expect(application.getForwardOperation(access.id, fixture.admin.id, receipt.operation_id)).rejects.toMatchObject({ code: "operation_not_found" });
});
run("ordinary node-use member creates multiple auto rules using one Link and distinct automatic ports", async () => {
  const receipts = await Promise.all(["tcp", "udp", "both"].map((protocol) => application.submitForwardOperation(access, fixture.member.id, request({ protocol }))));
  for (const receipt of receipts) await settled(receipt.operation_id);
  for (const receipt of receipts) await application.executeForwardOperation(receipt.operation_id);
  const rows = await db.tunnel.findMany({ where: { workspace_id: access.id }, orderBy: { id: "asc" } });
  expect(rows).toHaveLength(4); expect(new Set(rows.map((r) => r.link_resource_id)).size).toBe(1);
  const list = await forwards.listForwards(access.id);
  expect(list.every((row) => row.lifecycle.runtime === "ready")).toBe(true);
  expect(list.every((row) => row.lifecycle.traffic === null)).toBe(true);
  const page = await forwards.listForwardsPage(access.id, {}, { skip: 0, take: 10, orderBy: [{ id: "asc" }] });
  expect(page.data.map((row) => row.lifecycle.runtime)).toEqual(list.map((row) => row.lifecycle.runtime));
  expect(new Set(rows.filter((r) => r.forward_protocol !== "udp").map((r) => r.listen_port)).size).toBe(3);
  expect(await db.linkResource.count({ where: { workspace_id: access.id, managed_by: "auto_forward" } })).toBe(1);
  const carrier = await db.linkVersion.findFirstOrThrow({ where: { link_id: rows[0]!.link_resource_id! } });
  const port = resources.LinkConfigSchema.parse(carrier.config).carrier_port;
  expect(await db.nodePortLease.count({ where: { link_id: rows[0]!.link_resource_id, node_id: fixture.egress.id, port, status: "active" } })).toBe(1);
});
run("snapshot renewal overtaking queued ACKs cannot regress the durable deployment lease", async () => {
  const link = await db.linkResource.findFirstOrThrow({ where: { workspace_id: access.id, managed_by: "auto_forward" } });
  let grantedLease = 0;
  beforeAck = async (config) => {
    if (config.link_id !== link.id || config.role !== "ingress") return;
    beforeAck = null;
    // A reconnect snapshot can renew the same generation while the older
    // placement command is awaiting ACK. Its later expiry is authoritative.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const snapshot = await resources.desiredNodeLinks(fixture.egress.id);
    const renewed = snapshot.find((placement) => placement.link_id === link.id)!;
    grantedLease = Date.parse(renewed.lease_expires_at);
    expect(grantedLease).toBeGreaterThan(Date.parse(config.lease_expires_at));
  };
  try { await resources.reconcileLinks(); } finally { beforeAck = null; }
  expect(grantedLease).toBeGreaterThan(0);
  const deployment = await db.linkDeployment.findUniqueOrThrow({ where: { link_id_generation: {
    link_id: link.id, generation: link.generation } } });
  expect(deployment.lease_expires_at.getTime()).toBeGreaterThanOrEqual(grantedLease);
});
run("capabilities and submission deny missing node-use, stale Agent and foreign node scope", async () => {
  const custom = { ...access, customRoleId: 10, customPermissions: { "forward:create": true, "forward:read": true } };
  await expect(application.submitForwardOperation(custom, fixture.member.id, request())).rejects.toMatchObject({ code: "node_use_forbidden" });
  await expect(application.submitForwardOperation({ ...access, role: "viewer" }, fixture.member.id, request())).rejects.toMatchObject({ code: "forward_create_forbidden" });
  await expect(application.submitForwardOperation(access, fixture.member.id, request({ egress_node_id: 2147483647 }))).rejects.toMatchObject({ code: "node_use_not_authorized" });
  await db.nodeStateReport.update({ where: { node_id: fixture.egress.id }, data: { reported_at: new Date(Date.now() - 121000) } });
  const capabilities = await application.unifiedForwardCapabilities(access);
  expect(capabilities.combinations.filter((c) => c.transport === "tst_v1").every((c) => !c.available)).toBe(true);
  await expect(application.submitForwardOperation(access, fixture.member.id, request())).rejects.toMatchObject({ code: "agent_tst_capability_stale" });
  await db.nodeStateReport.update({ where: { node_id: fixture.egress.id }, data: { reported_at: new Date() } });
});
run("failure retains encrypted Forward, restart recovery preserves identity and confirmed deletion preserves siblings", async () => {
  failIngress = true;
  const submitted = await application.submitForwardOperation(access, fixture.member.id, request({ name: "recover me", listen_port: 25290 }));
  const failed = await settled(submitted.operation_id);
  expect(failed.state).toBe("pending_apply"); expect(failed.error_code).toBe("link_apply_unconfirmed");
  const row = await db.tunnel.findUniqueOrThrow({ where: { id: failed.forward_id! } });
  expect(row.link_resource_id).not.toBeNull(); expect(row.listen_port).toBe(25290);
  failIngress = false;
  await application.recoverForwardOperations();
  const recovered = await application.getForwardOperation(access.id, fixture.member.id, failed.operation_id);
  expect(recovered.state).toBe("completed"); expect(recovered.forward_id).toBe(row.id);
  const view = await forwards.getForward(row.id, access.id);
  expect(view?.transport).toBe("tst_v1"); expect(view?.lifecycle.runtime).toBe("ready");
  expect(view?.lifecycle.target_health).toBe("unverified"); expect(view?.lifecycle.traffic).toBeNull();
  const old = await db.tunnel.findFirstOrThrow({ where: { workspace_id: access.id, id: { not: row.id } } });
  const updated = await application.unifiedPatchForward(row.id, access.id, fixture.member.id, { expected_revision: row.config_revision, target_port: 34568 });
  expect(updated.ok).toBe(true);
  await expect(application.unifiedPatchForward(row.id, access.id, fixture.member.id, { expected_revision: row.config_revision, target_port: 34569 })).rejects.toMatchObject({ code: "revision_conflict" });
  expect((await db.tunnel.findUniqueOrThrow({ where: { id: old.id } })).config_revision).toBe(old.config_revision);
  failIngress = true;
  await expect(application.unifiedActionForward(row.id, access.id, fixture.member.id, "delete")).rejects.toMatchObject({ code: "link_apply_unconfirmed" });
  const deleting = await db.tunnel.findUniqueOrThrow({ where: { id: row.id } });
  expect(deleting.forward_delete_requested_at).not.toBeNull();
  expect(await db.nodePortLease.count({ where: { link_id: row.link_resource_id, port: 25290, status: "active" } })).toBe(1);
  failIngress = false;
  await resources.reconcileLinks();
  expect(await db.tunnel.findUnique({ where: { id: row.id } })).toBeNull();
  expect(await db.tunnel.findUnique({ where: { id: old.id } })).not.toBeNull();
  expect(await db.nodePortLease.count({ where: { link_id: row.link_resource_id, port: 25290, status: "active" } })).toBe(0);
});
run("suspending retains references; last deletion requires confirmed carrier stop before lease release", async () => {
  const rows = await db.tunnel.findMany({ where: { workspace_id: access.id } });
  for (const row of rows) {
    await application.unifiedActionForward(row.id, access.id, fixture.member.id, "suspend");
    expect(await db.tunnel.findUnique({ where: { id: row.id } })).not.toBeNull();
  }
  const link = await db.linkResource.findFirstOrThrow({ where: { workspace_id: access.id, managed_by: "auto_forward" } });
  expect(link.last_unreferenced_at).toBeNull();
  for (const row of rows) await application.unifiedActionForward(row.id, access.id, fixture.member.id, "delete");
  expect(await db.tunnel.count({ where: { link_resource_id: link.id } })).toBe(0);
  await db.linkResource.update({ where: { id: link.id }, data: { last_unreferenced_at: new Date(Date.now() - 301000) } });
  const start = sent.length;
  await resources.reconcileLinks();
  expect((await db.linkResource.findUniqueOrThrow({ where: { id: link.id } })).status).toBe("retired");
  expect(await db.nodePortLease.count({ where: { link_id: link.id, status: "active" } })).toBe(0);
  expect(sent.slice(start).filter((s) => s.remove && s.id.startsWith(`tunex-tst-${link.id}-`)).map((s) => s.role)).toEqual(["ingress", "egress"]);
});
run("TST connection bounds reject before durable operations while native retains its own limits", async () => {
  const count = await db.forwardOperation.count({ where: { workspace_id: access.id } });
  for (const field of ["max_connections", "max_connections_per_ip"] as const) {
    await expect(application.submitForwardOperation(access, fixture.member.id, request({ [field]: 4097 }))).rejects.toMatchObject({ name: "ZodError" });
    expect(application.ForwardOperationSchema.safeParse(request({ [field]: 4096 })).success).toBe(true);
    expect(application.ForwardOperationSchema.safeParse(request({ transport: "native_plain", [field]: 1_000_000 })).success).toBe(true);
  }
  expect(await db.forwardOperation.count({ where: { workspace_id: access.id } })).toBe(count);
  // A workspace ceiling above the runtime's bound must still permit a requested
  // zero/default policy, using the stricter physical limit in deployed config.
  await db.capabilityPolicy.update({ where: { id: fixture.policy_id }, data: { client_limit: 5000 } });
  const receipt = await settled((await application.submitForwardOperation(access, fixture.member.id, request())).operation_id);
  expect(receipt.state).toBe("completed");
  const row = await db.tunnel.findUniqueOrThrow({ where: { id: receipt.forward_id! } });
  const link = await db.linkResource.findUniqueOrThrow({ where: { id: row.link_resource_id! } });
  const deployment = await db.linkDeployment.findUniqueOrThrow({ where: { link_id_generation: { link_id: link.id, generation: link.generation } } });
  const binding = (deployment.binding_snapshot as { spec: { bindings: { forward_id: number; max_connections: number }[] } }).spec.bindings.find((b) => b.forward_id === row.id);
  expect(binding?.max_connections).toBeGreaterThan(0);
  expect(binding?.max_connections).toBeLessThanOrEqual(4096);
  expect(row.max_connections).toBe(0);
  await application.unifiedActionForward(row.id, access.id, fixture.member.id, "delete");
});
run("durable native creates apply pending rows through the scheduler and completed replay preserves revision", async () => {
  const { Orchestrator } = await import("../src/services/orchestrator.ts");
  const { setOrchestrator, resetOrchestrator } = await import("../src/services/relay-wiring.ts");
  const calls: { id: string; revision: number; protocol: string; mode: string }[] = [];
  const applied = async (_node: unknown, config: { id: string; revision: number; protocol: string; mode: string }) => {
    calls.push(config); return { ok: true, revision: config.revision, hop_local_addr: "127.0.0.2:25300" };
  };
  setOrchestrator(new Orchestrator({ transport: { applyDirect: applied, applyEgress: applied,
    applyRelay: applied, removeTunnel: async () => ({ ok: true }) }, probeReachable: false }));
  for (const node of [fixture.ingress, fixture.egress]) {
    await db.node.update({ where: { id: node.id }, data: { last_seen_at: new Date() } });
    await db.nodeStateReport.update({ where: { node_id: node.id }, data: { reported_at: new Date(),
      control_protocol_version: 2, capabilities: ["apply_link", "remove_link", "forward.link.tst.v1",
        "apply_tunnel", "remove_tunnel", "suspend_tunnel", "forward.policy.runtime.v1", "forward.protocol.both.native.v1"],
      capability_manifest: { schema_version: 2, protocols: ["tcp", "udp", "both"], transports: ["stream", "datagram"],
        runtime: ["hot_reload", "graceful_drain", "lkg_restore"], diagnostics: [] } } });
  }
  try {
    const input = request({ path: "direct", transport: "native_plain", egress_node_id: null, listen_port: 25291 });
    const receipt = await settled((await application.submitForwardOperation(access, fixture.member.id, input)).operation_id);
    expect(receipt.state, JSON.stringify({ state: receipt.state, error_code: receipt.error_code })).toBe("completed");
    const row = await db.tunnel.findUniqueOrThrow({ where: { id: receipt.forward_id! } });
    expect(row.config_revision).toBe(1); expect(row.applied_revision).toBe(1);
    expect(row.desired_status).toBe("active"); expect(row.apply_status).toBe("active");
    expect(calls.filter((call) => call.mode === "DIRECT")).toHaveLength(1);
    expect(await db.forwardRevision.count({ where: { tunnel_id: row.id } })).toBe(1);
    await application.executeForwardOperation(receipt.operation_id);
    expect((await application.submitForwardOperation(access, fixture.member.id, input)).forward_id).toBe(row.id);
    expect((await db.tunnel.findUniqueOrThrow({ where: { id: row.id } })).config_revision).toBe(1);
    await application.unifiedActionForward(row.id, access.id, fixture.member.id, "delete");
  } finally { resetOrchestrator(); }
});
