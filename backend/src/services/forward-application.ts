import { randomUUID } from "node:crypto";
import { Prisma, type ForwardOperation } from "@prisma/client";
import { z } from "zod";
import { db } from "../db.ts";
import { canonicalConfigDigest } from "../domain/link/core-contract.ts";
import { TST_MAX_CONNECTIONS } from "../domain/link/tst-compiler.ts";
import { canWorkspaceResourceAction, type WorkspaceAccess } from "./workspace.ts";
import { LinkResourceError } from "./link-errors.ts";
import { assertLinkFeature, createLinkForward, deployLink, updateLinkForward, actionLinkForward,
  LinkBindingSchema, LinkConfigSchema } from "./link-resource.ts";
import { createForward, getForward, patchForward, applySavedForward, runForwardAction, deleteForward } from "./forward-service.ts";
import { acquirePort, type PortPoolDb, type PortPoolTransaction } from "./portPool.ts";
import { loadNodeCapabilityFacts, admitRuntime } from "./runtime-admission.ts";
import { deriveConnection } from "./node-lifecycle.ts";
import { forwardNativeBothEnabled } from "./forward-native-both.ts";
import { lockForwardOperation } from "./forward-operation-fence.ts";

const id = z.number().int().positive().max(2_147_483_647);
export const ForwardOperationSchema = z.object({
  idempotency_key: z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(255), path: z.enum(["direct", "relay"]),
  transport: z.enum(["native_plain", "tst_v1"]), protocol: z.enum(["tcp", "udp", "both"]),
  ingress_node_id: id, egress_node_id: id.nullable().optional(), listen_port: id.max(65535).nullable().optional(),
  listen_host: z.enum(["", "0.0.0.0", "127.0.0.1", "::1"]).default(""),
  target_host: z.string().trim().min(1).max(255).refine((h) => !/[\s/\x00]/.test(h)), target_port: id.max(65535),
  bytes_per_second_in: z.number().int().min(0).max(2_147_483_647).default(0),
  bytes_per_second_out: z.number().int().min(0).max(2_147_483_647).default(0),
  max_connections: z.number().int().min(0).max(1_000_000).default(0),
  max_connections_per_ip: z.number().int().min(0).max(1_000_000).default(0),
  transport_options: z.object({ selection: z.enum(["auto", "specified"]).default("auto"), link_id: id.optional() }).strict()
    .default({ selection: "auto" }),
}).strict().superRefine((input, ctx) => {
  if (input.path === "relay" && (!input.egress_node_id || input.egress_node_id === input.ingress_node_id))
    ctx.addIssue({ code: "custom", message: "relay_requires_distinct_nodes", path: ["egress_node_id"] });
  if (input.path === "direct" && (input.transport !== "native_plain" || input.egress_node_id))
    ctx.addIssue({ code: "custom", message: "unsupported_combination", path: ["transport"] });
  if (input.transport_options.selection === "specified" && !input.transport_options.link_id)
    ctx.addIssue({ code: "custom", message: "link_id_required", path: ["transport_options"] });
  if (input.transport === "native_plain" && input.transport_options.selection !== "auto")
    ctx.addIssue({ code: "custom", message: "unsupported_combination", path: ["transport_options"] });
  if (input.transport === "native_plain" && input.listen_host !== "" && input.listen_host !== "0.0.0.0")
    ctx.addIssue({ code: "custom", message: "native_listen_scope_unsupported", path: ["listen_host"] });
  if (input.transport === "tst_v1") for (const field of ["max_connections", "max_connections_per_ip"] as const) {
    if (input[field] > TST_MAX_CONNECTIONS)
      ctx.addIssue({ code: "custom", message: "tst_connection_limit_exceeded", path: [field] });
  }
});
export type ForwardOperationInput = z.infer<typeof ForwardOperationSchema>;
export function operationReceipt(row: ForwardOperation, replayed = false) {
  return { operation_id: row.id, forward_id: row.forward_id, state: row.state, stage: row.stage,
    error_code: row.error_code, replayed, created_at: row.created_at, updated_at: row.updated_at };
}
const publicError = (error: unknown) => error instanceof LinkResourceError ? error.code
  : error instanceof Error && /^[a-z_]{1,64}$/.test(error.message) ? error.message : "forward_operation_failed";

function authorizeCreate(access: WorkspaceAccess) {
  if (!canWorkspaceResourceAction(access, "create", "forward")) throw new LinkResourceError("forward_create_forbidden", 403);
  if (!canWorkspaceResourceAction(access, "use", "node")) throw new LinkResourceError("node_use_forbidden", 403);
}
async function actorAccess(workspace: number, actor: number): Promise<WorkspaceAccess> {
  const [member, personal] = await Promise.all([
    db.workspaceMember.findUnique({ where: { workspace_id_user_id: { workspace_id: workspace, user_id: actor } },
      include: { workspace: true, custom_role: true } }),
    db.workspace.findUnique({ where: { personal_user_id: actor }, select: { id: true } }),
  ]);
  if (!member?.active || !personal) throw new LinkResourceError("workspace_access_revoked", 403);
  if (member.role_id != null && (!member.custom_role || member.custom_role.workspace_id !== workspace))
    throw new LinkResourceError("workspace_access_revoked", 403);
  return { id: workspace, actorId: actor, role: member.role, kind: member.workspace.kind,
    personalWorkspaceId: personal.id, customRoleId: member.role_id, customPermissions: member.custom_role?.permissions };
}
async function authorizedNodes(input: ForwardOperationInput, workspace: number) {
  const nodes = await db.node.findMany({ where: { id: { in: [input.ingress_node_id, ...(input.egress_node_id ? [input.egress_node_id] : [])] },
    node_group: { workspace_id: workspace }, lifecycle: "active" }, include: { node_group: true } });
  const ingress = nodes.find((n) => n.id === input.ingress_node_id), egress = nodes.find((n) => n.id === input.egress_node_id);
  if (!ingress || input.path === "relay" && !egress) throw new LinkResourceError("node_use_not_authorized", 403);
  if (!["ingress", "both"].includes(ingress.role ?? "") || egress && !["egress", "both"].includes(egress.role ?? ""))
    throw new LinkResourceError("link_node_role_mismatch");
  if (input.transport === "tst_v1") {
    assertLinkFeature();
    for (const node of nodes) {
      const facts = await loadNodeCapabilityFacts(node.id);
      if (!facts?.advertisementCurrent) throw new LinkResourceError("agent_tst_capability_stale");
      if (!facts.capabilities?.includes("forward.link.tst.v1")) throw new LinkResourceError("agent_tst_capability_missing");
    }
    if (!egress?.connect_ip) throw new LinkResourceError("hop_address_missing");
  }
  return { ingress, egress };
}

/** A unique key is scoped to actor and workspace; a timeout never authorizes a new write. */
export async function submitForwardOperation(access: WorkspaceAccess, actor: number, raw: unknown) {
  authorizeCreate(access);
  const input = ForwardOperationSchema.parse(raw);
  const { idempotency_key, ...request } = input;
  const hash = canonicalConfigDigest(request);
  const identity = { workspace_id: access.id, actor_id: actor, idempotency_key };
  let existing = await db.forwardOperation.findUnique({ where: { workspace_id_actor_id_idempotency_key: identity } });
  if (existing) {
    if (existing.request_hash !== hash) throw new LinkResourceError("idempotency_conflict");
    return operationReceipt(existing, true);
  }
  await authorizedNodes(input, access.id);
  try {
    existing = await db.forwardOperation.create({ data: { id: randomUUID(), ...identity,
      request_hash: hash, request: input as Prisma.InputJsonValue } });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    existing = await db.forwardOperation.findUniqueOrThrow({ where: { workspace_id_actor_id_idempotency_key: identity } });
    if (existing.request_hash !== hash) throw new LinkResourceError("idempotency_conflict");
    return operationReceipt(existing, true);
  }
  // Work begins after the durable receipt. The worker can recover even if HTTP dies here.
  void executeForwardOperation(existing.id).catch(() => {});
  return operationReceipt(existing);
}

async function selectLink(operation: ForwardOperation, input: ForwardOperationInput, token: string) {
  const key = canonicalConfigDigest({ workspace_id: operation.workspace_id, ingress: input.ingress_node_id,
    egress: input.egress_node_id, transport: "tst_v1", security_profile: "mtls-link-ca-v1" });
  return db.$transaction(async (tx) => {
    // Serializes auto reuse/port selection across independent controller processes.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM workspace WHERE id=${operation.workspace_id} FOR UPDATE`);
    await lockForwardOperation(tx, operation.id, token, operation.workspace_id, operation.actor_id);
    let link = input.transport_options.selection === "specified"
      ? await tx.linkResource.findFirst({ where: { id: input.transport_options.link_id, workspace_id: operation.workspace_id } })
      : await tx.linkResource.findUnique({ where: { reuse_key: key } });
    if (link) {
      if (link.workspace_id !== operation.workspace_id || link.carrier !== "tst_v1" || ["retired", "retiring", "legacy_unsupported"].includes(link.status))
        throw new LinkResourceError("link_not_reusable");
      if (input.transport_options.selection === "auto" && link.managed_by !== "auto_forward") throw new LinkResourceError("link_not_reusable");
      const version = await tx.linkVersion.findUniqueOrThrow({ where: { link_id_version: { link_id: link.id, version: link.desired_version } } });
      const config = LinkConfigSchema.parse(version.config);
      if (config.ingress_node_id !== input.ingress_node_id || config.egress_node_id !== input.egress_node_id) throw new LinkResourceError("link_endpoint_mismatch");
      if (await tx.linkMaintenanceMigration.findFirst({ where: { active_link_id: link.id } })) throw new LinkResourceError("link_maintenance_in_progress");
      if (await tx.tunnel.count({ where: { link_resource_id: link.id } }) >= 500) throw new LinkResourceError("link_reference_limit");
    } else {
      if (input.transport_options.selection === "specified") throw new LinkResourceError("link_not_found", 404);
      link = await tx.linkResource.create({ data: { workspace_id: operation.workspace_id, created_by: operation.actor_id,
        name: `auto-tst-${randomUUID()}`, carrier: "tst_v1", managed_by: "auto_forward", reuse_key: key } });
      const leaseDb = { node: tx.node, tunnel: tx.tunnel, nodePortLease: tx.nodePortLease,
        $transaction: async <T>(run: (client: PortPoolTransaction) => Promise<T>) => run(tx as unknown as PortPoolTransaction) } as unknown as PortPoolDb;
      const carrierProtocol = "tcp" as const;
      const allocation = await acquirePort({ nodeId: input.egress_node_id!, leaseType: "egress", linkId: link.id,
        protocol: carrierProtocol, bindScope: "0.0.0.0", expiresAt: null, deps: { db: leaseDb } });
      if (!allocation.ok) throw new LinkResourceError(allocation.code);
      const config = { ingress_node_id: input.ingress_node_id, egress_node_id: input.egress_node_id!, carrier_port: allocation.result.port };
      await tx.linkVersion.create({ data: { link_id: link.id, version: 1, config, config_digest: canonicalConfigDigest(config) } });
    }
    await tx.forwardOperation.update({ where: { id: operation.id }, data: { link_id: link.id, stage: "link_selected" } });
    await tx.linkResource.update({ where: { id: link.id }, data: { last_unreferenced_at: null } });
    return link.id;
  });
}

export async function executeForwardOperation(operationId: string) {
  const token = randomUUID(), now = new Date();
  const claim = await db.forwardOperation.updateMany({ where: { id: operationId, state: { in: ["accepted", "pending_apply", "applying"] },
    OR: [{ executor_expires_at: null }, { executor_expires_at: { lte: now } }] }, data: {
      executor_token: token, executor_expires_at: new Date(now.getTime() + 300_000), state: "applying", attempts: { increment: 1 } } });
  if (!claim.count) return;
  try {
    let operation = await db.forwardOperation.findUniqueOrThrow({ where: { id: operationId } });
    const input = ForwardOperationSchema.parse(operation.request);
    const access = await actorAccess(operation.workspace_id, operation.actor_id);
    authorizeCreate(access); await authorizedNodes(input, access.id);
    if (!operation.forward_id) {
      if (input.transport === "tst_v1") {
        const linkId = operation.link_id ?? await selectLink(operation, input, token);
        const { idempotency_key: _key, path: _path, transport: _transport, ingress_node_id: _in, egress_node_id: _out,
          transport_options: _options, ...binding } = input;
        await createLinkForward(operation.workspace_id, linkId, operation.actor_id,
          { ...binding, listen_host: input.listen_host === "0.0.0.0" ? "" : input.listen_host }, { deploy: false, operationId, operationToken: token });
      } else {
        const result = await createForward(operation.actor_id, operation.workspace_id, { ...input, mode: input.path }, {
          canManageNodes: canWorkspaceResourceAction(access, "manage", "node"), operationId, operationToken: token, deferApply: true });
        if (!result.ok) throw new LinkResourceError(result.code, result.status === 502 ? 503 : result.status);
      }
      operation = await db.forwardOperation.findUniqueOrThrow({ where: { id: operationId } });
    }
    if (input.transport === "tst_v1") await deployLink(operation.workspace_id, operation.link_id!);
    else {
      const row = await db.tunnel.findFirst({ where: { id: operation.forward_id!, workspace_id: operation.workspace_id } });
      if (!row) throw new LinkResourceError("forward_not_found", 404);
      // A saved create is pending, not a suspended/error user action. Re-enter
      // the same scheduler used by synchronous create and recover lost ACKs.
      const result = await applySavedForward(row.id, operation.workspace_id);
      if (!result.ok) throw new LinkResourceError(result.code, result.status === 502 ? 503 : result.status);
    }
    const row = await db.tunnel.findFirst({ where: { id: operation.forward_id!, workspace_id: operation.workspace_id } });
    const confirmed = row?.apply_status === "active" && row.applied_revision === row.config_revision;
    await db.forwardOperation.updateMany({ where: { id: operationId, executor_token: token }, data: {
      state: confirmed ? "completed" : "pending_apply", stage: confirmed ? "deployed" : "pending_apply", error_code: null,
      executor_token: null, executor_expires_at: null } });
  } catch (error) {
    const operation = await db.forwardOperation.findUnique({ where: { id: operationId } });
    const retryable = operation?.forward_id != null && !(error instanceof LinkResourceError &&
      (error.status === 403 || error.code === "forward_not_found"));
    const changed = await db.forwardOperation.updateMany({ where: { id: operationId, executor_token: token }, data: {
      state: retryable ? "pending_apply" : "failed", stage: retryable ? "pending_apply" : "failed", error_code: publicError(error),
      executor_token: null, executor_expires_at: null } });
    if (changed.count && !retryable && operation?.link_id) await db.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM workspace WHERE id=${operation.workspace_id} FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM link_resource WHERE id=${operation.link_id} FOR UPDATE`);
      if (await tx.tunnel.count({ where: { link_resource_id: operation.link_id } }) ||
        await tx.forwardOperation.count({ where: { link_id: operation.link_id, state: { in: ["accepted", "applying", "pending_apply"] } } })) return;
      await tx.linkResource.updateMany({ where: { id: operation.link_id!, managed_by: "auto_forward" },
        data: { last_unreferenced_at: new Date() } });
    });
  }
}
export async function recoverForwardOperations() {
  const rows = await db.forwardOperation.findMany({ where: { state: { in: ["accepted", "applying", "pending_apply"] },
    OR: [{ executor_expires_at: null }, { executor_expires_at: { lte: new Date() } }] }, orderBy: { created_at: "asc" }, take: 100 });
  for (const row of rows) await executeForwardOperation(row.id);
  return { scanned: rows.length };
}
export async function getForwardOperation(workspace: number, actor: number, id: string) {
  const row = await db.forwardOperation.findFirst({ where: { id, workspace_id: workspace, actor_id: actor } });
  if (!row) throw new LinkResourceError("operation_not_found", 404);
  return operationReceipt(row);
}

export async function unifiedPatchForward(id: number, workspace: number, actor: number, patch: Record<string, unknown>) {
  const row = await db.tunnel.findFirst({ where: { id, workspace_id: workspace, category: "port_forward" } });
  if (!row) throw new LinkResourceError("forward_not_found", 404);
  if (patch.path != null && patch.path !== row.tunnel_mode || patch.transport != null && patch.transport !== (row.link_resource_id ? "tst_v1" : "native_plain"))
    throw new LinkResourceError("transport_change_requires_new_forward");
  const { path: _path, transport: _transport, ...fields } = patch;
  if (!row.link_resource_id) return patchForward(id, workspace, fields, actor);
  const allowed = new Set(["expected_revision", "name", "protocol", "listen_port", "listen_host", "target_host", "target_port",
    "ingress_node_id", "egress_node_id", "bytes_per_second_in", "bytes_per_second_out", "max_connections", "max_connections_per_ip"]);
  if (Object.keys(fields).some((key) => !allowed.has(key))) throw new LinkResourceError("invalid_input", 400);
  if (fields.ingress_node_id != null && fields.ingress_node_id !== row.ingress_node_id || fields.egress_node_id != null && fields.egress_node_id !== row.egress_node_id)
    throw new LinkResourceError("node_change_requires_new_forward");
  const expected = z.number().int().min(0).parse(fields.expected_revision);
  const { expected_revision: _revision, ingress_node_id: _in, egress_node_id: _out, ...edit } = fields;
  const binding = LinkBindingSchema.parse({ name: row.name, protocol: row.forward_protocol, listen_port: row.listen_port,
    listen_host: row.listen_ip === "127.0.0.1" || row.listen_ip === "::1" ? row.listen_ip : "", target_host: row.remote_host,
    target_port: row.remote_port, bytes_per_second_in: row.bytes_per_second_in ?? 0, bytes_per_second_out: row.bytes_per_second_out ?? 0,
    max_connections: row.max_connections ?? 0, max_connections_per_ip: row.max_connections_per_ip ?? 0, ...edit });
  await updateLinkForward(workspace, row.link_resource_id, id, actor, expected, binding);
  return { ok: true as const, data: (await getForward(id, workspace))! };
}
export async function unifiedActionForward(id: number, workspace: number, actor: number, action: "suspend" | "resume" | "retry" | "delete") {
  const row = await db.tunnel.findFirst({ where: { id, workspace_id: workspace, category: "port_forward" } });
  if (!row) throw new LinkResourceError("forward_not_found", 404);
  if (!row.link_resource_id) return action === "delete" ? deleteForward(id, workspace) : runForwardAction(id, action, workspace);
  await actionLinkForward(workspace, row.link_resource_id, id, action, actor);
  if (action === "delete") {
    if (!await db.tunnel.count({ where: { link_resource_id: row.link_resource_id } })) await db.linkResource.updateMany({
      where: { id: row.link_resource_id, managed_by: "auto_forward" }, data: { last_unreferenced_at: new Date() } });
    return { ok: true as const, data: { ok: true, reconciliation_pending: false } };
  }
  return { ok: true as const, data: (await getForward(id, workspace))! };
}

export async function unifiedForwardCapabilities(access: WorkspaceAccess) {
  const nativeBoth = forwardNativeBothEnabled(), tstEnabled = process.env.TUNEX_TST_ENABLED === "true";
  const nodeUse = canWorkspaceResourceAction(access, "use", "node");
  const nodes = (await db.node.findMany({ where: { node_group: { workspace_id: access.id }, lifecycle: "active" }, take: 512 }))
    .filter((node) => deriveConnection({ ...node, has_credential: !!node.node_credential_hash }) === "online");
  const ingress = nodes.filter((n) => ["ingress", "both"].includes(n.role ?? "")).map((n) => n.id);
  const egress = nodes.filter((n) => ["egress", "both"].includes(n.role ?? "") && n.connect_ip).map((n) => n.id);
  const advertisements = new Map(await Promise.all(nodes.map(async (node) => [node.id, await loadNodeCapabilityFacts(node.id)] as const)));
  const combinations = (["tcp", "udp", "both"] as const).flatMap((protocol) => ([
    { path: "direct", transport: "native_plain", enabled: protocol !== "both" || nativeBoth },
    { path: "relay", transport: "native_plain", enabled: protocol !== "both" || nativeBoth },
    { path: "relay", transport: "tst_v1", enabled: tstEnabled },
  ] as const).map((entry) => {
    const capable = (id: number, role: "ingress" | "egress") => {
      const facts = advertisements.get(id);
      if (!facts?.advertisementCurrent) return false;
      return entry.transport === "tst_v1"
        ? facts.capabilities?.includes("forward.link.tst.v1") && facts.capabilities.includes("apply_link") && facts.capabilities.includes("remove_link")
        : admitRuntime([{ nodeId: id, role, facts }], { action: "apply_tunnel", protocol }).ok;
    };
    const incoming = ingress.filter((id) => capable(id, "ingress"));
    const outgoing = entry.path === "direct" ? [] : egress.filter((id) => capable(id, "egress"));
    const available = nodeUse && entry.enabled && incoming.length > 0 && (entry.path === "direct" || incoming.some((i) => outgoing.some((e) => i !== e)));
    return { path: entry.path, transport: entry.transport, protocol, available,
      reason: available ? null : !nodeUse ? "node_use_forbidden" : !entry.enabled ? "feature_disabled" : "capable_nodes_missing",
      ingress_node_ids: incoming, egress_node_ids: outgoing };
  }));
  return { native_both_enabled: nativeBoth, tst_enabled: tstEnabled, node_use_allowed: nodeUse,
    transports: ["native_plain", ...(tstEnabled ? ["tst_v1"] : [])], combinations };
}
