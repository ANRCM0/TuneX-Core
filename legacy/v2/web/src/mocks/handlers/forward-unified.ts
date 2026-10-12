import type { PortForward, UserNode } from "@/lib/types";
import type { ForwardOperation, ForwardTransport, UnifiedForwardCapabilities } from "@/lib/forward-unified";
import type { ForwardHistoryEntry } from "@/lib/api/forward-unified";
import { handleForwardsMock } from "./forwards";
import * as rt from "../runtime";

interface Metadata { workspaceId: number; transport: ForwardTransport; history: ForwardHistoryEntry[] }
interface OperationEntry { workspaceId: number; actorId: number; key: string; fingerprint: string; receipt: ForwardOperation }
const worlds = new WeakMap<rt.Store, { metadata: Map<number, Metadata>; operations: Map<string, OperationEntry> }>();
function world(db: rt.Store) { let value = worlds.get(db); if (!value) { value = { metadata: new Map(), operations: new Map() }; worlds.set(db, value); } return value; }
function workspaceOf(db: rt.Store, id: number) {
  const metadata = world(db).metadata.get(id); if (metadata) return metadata.workspaceId;
  const row = db.tunnels.find((tunnel) => tunnel.id === id);
  return db.workspaces.find((workspace) => workspace.personal_user_id === row?.user_id)?.id;
}
function view(db: rt.Store, row: PortForward): PortForward {
  const transport = world(db).metadata.get(row.id)?.transport ?? "native_plain";
  const state = row.apply_status;
  return { ...row, path: row.mode, transport, lifecycle: {
    desired: row.desired_status === "inactive" ? "suspended" : "active",
    deployment: state === "error" ? "failed" : state === "pending" ? "pending" : state === "applying" ? "applying" : row.applied_revision === row.config_revision ? "confirmed" : "unknown",
    // Mock acknowledgements prove no real listener or secure handshake.
    runtime: row.desired_status === "inactive" ? "stopped" : "unknown", transport, target_health: "unverified", traffic: null,
  } };
}
function capabilities(db: rt.Store, nodeUseAllowed: boolean): UnifiedForwardCapabilities {
  const nodes = db.nodes.map((node) => rt.mockUserNode(db, node));
  const fresh = (node: UserNode, capability: string) => {
    const state = db.nodeStates.get(node.id);
    return !!state?.reported_at && Date.now() - Date.parse(state.reported_at) <= 75_000 && state.capabilities?.includes(capability) === true;
  };
  const tst = process.env.TUNEX_TST_ENABLED === "true";
  const both = process.env.FORWARD_NATIVE_BOTH_ENABLED === "true";
  const combinations: UnifiedForwardCapabilities["combinations"] = [];
  for (const path of ["direct", "relay"] as const) for (const transport of ["native_plain", "tst_v1"] as const) for (const protocol of ["tcp", "udp", "both"] as const) {
    const eligible = nodes.filter((node) => node.accepts_new_business === true && (transport === "tst_v1" ? fresh(node, "forward.link.tst.v1") : protocol !== "both" || fresh(node, "forward.protocol.both.native.v1")));
    const ingress = eligible.filter((node) => node.role === "ingress" || node.role === "both").map((node) => node.id);
    const egress = eligible.filter((node) => node.role === "egress" || node.role === "both").map((node) => node.id);
    const reason = !nodeUseAllowed ? "permission_denied" : transport === "tst_v1" && path === "direct" ? "tst_relay_only" : transport === "tst_v1" && !tst ? "tst_not_enabled" : transport === "native_plain" && protocol === "both" && !both ? "native_both_not_enabled" : ingress.length === 0 ? "ingress_capability_missing" : path === "relay" && egress.length === 0 ? "egress_capability_missing" : null;
    combinations.push({ path, transport, protocol, available: reason === null, reason, ingress_node_ids: ingress, egress_node_ids: egress });
  }
  return { native_both_enabled: both, tst_enabled: tst, transports: tst ? ["native_plain", "tst_v1"] : ["native_plain"], combinations, node_use_allowed: nodeUseAllowed };
}

export async function handleUnifiedForwardsMock(ctx: rt.MockAuthedRouteContext): Promise<rt.MockResponse | null> {
  const { db, method, seg, req, user, scopeId, q } = ctx;
  const relevant = seg[0] === "forward-operations" || seg[0] === "forwards" || seg[0] === "links";
  if (!relevant) return null;
  const membership = db.workspaceMembers.find((entry) => entry.workspace_id === scopeId && entry.user_id === user.id && entry.active);
  if (!membership || scopeId === undefined) return rt.notFound("工作空间不存在");
  const grants = rt.mockEffectivePermissions(db, membership);
  const data = world(db);
  if (seg[0] === "links" && method === "GET" && seg.length === 1) {
    if (!grants.permissions["node:read"]) return rt.fail(403, "permission_denied", "permission_denied");
    // The mock does not fabricate certificate provisioning or internal connection resources.
    return rt.ok([]);
  }
  if (seg[0] === "forward-operations") {
    if (method === "GET" && seg[1]) {
      if (!grants.permissions["forward:read"]) return rt.fail(403, "permission_denied", "permission_denied");
      const entry = data.operations.get(seg[1]);
      if (!entry || entry.workspaceId !== scopeId) return rt.notFound("操作不存在");
      return rt.ok(entry.receipt);
    }
    if (method !== "POST" || seg.length !== 1) return rt.notFound("接口不存在");
    if (!grants.permissions["forward:create"]) return rt.fail(403, "permission_denied", "permission_denied");
    const body = rt.asRecord(req.body); const key = rt.reqStr(body.idempotency_key);
    if (!key || key.length > 128) return rt.badRequest("invalid_idempotency_key", "invalid_idempotency_key");
    const fingerprint = JSON.stringify(body);
    const replay = [...data.operations.values()].find((entry) => entry.workspaceId === scopeId && entry.actorId === user.id && entry.key === key);
    if (replay) return replay.fingerprint === fingerprint ? rt.ok({ ...replay.receipt, replayed: true }) : rt.fail(409, "idempotency_conflict", "idempotency_conflict");
    const path = body.path; const transport = body.transport;
    if (!["direct", "relay"].includes(String(path)) || !["native_plain", "tst_v1"].includes(String(transport)) || !["tcp", "udp", "both"].includes(String(body.protocol))) return rt.badRequest("invalid_forward_input", "invalid_forward_input");
    const cap = capabilities(db, grants.permissions["node:read"]);
    const combo = cap.combinations.find((entry) => entry.path === path && entry.transport === transport && entry.protocol === body.protocol);
    if (!combo?.available) return rt.fail(409, combo?.reason ?? "combination_not_enabled", combo?.reason ?? "combination_not_enabled");
    if (!combo.ingress_node_ids.includes(Number(body.ingress_node_id)) || (path === "relay" && !combo.egress_node_ids.includes(Number(body.egress_node_id)))) return rt.fail(409, "node_capability_missing", "node_capability_missing");
    const delegated = await handleForwardsMock({ ...ctx, clean: "forwards", seg: ["forwards"], req: { ...req, body: { ...body, mode: path } } });
    if (!delegated || delegated.status >= 400) return delegated;
    const row = delegated.body as PortForward;
    data.metadata.set(row.id, { workspaceId: scopeId, transport: transport as ForwardTransport,
      history: [{ revision: row.config_revision ?? 1, desired_status: row.desired_status ?? "active", created_at: row.created_at, created_by_id: user.id }] });
    const receipt: ForwardOperation = { operation_id: crypto.randomUUID(), forward_id: row.id, state: "unverified", stage: "configuration_persisted", error_code: null, replayed: false };
    if (transport === "tst_v1") {
      const tunnel = db.tunnels.find((entry) => entry.id === row.id)!; tunnel.apply_status = "pending"; tunnel.applied_revision = 0; tunnel.online = false;
      receipt.state = "pending"; receipt.stage = "awaiting_runtime";
    }
    data.operations.set(receipt.operation_id, { workspaceId: scopeId, actorId: user.id, key, fingerprint, receipt });
    return rt.ok(receipt);
  }
  if (seg[0] !== "forwards") return null;
  if (method === "GET" && seg[1] === "capabilities") return rt.ok(capabilities(db, grants.permissions["node:read"]));
  if (method === "GET" && seg.length === 1) {
    let rows = db.tunnels.filter((row) => row.category === "port_forward" && workspaceOf(db, row.id) === scopeId).map((row) => view(db, rt.mockForwardView(db, row)));
    if (q?.path) rows = rows.filter((row) => row.path === q.path);
    if (q?.mode && ["direct", "relay"].includes(String(q.mode))) rows = rows.filter((row) => row.mode === q.mode);
    if (q?.transport) rows = rows.filter((row) => row.transport === q.transport);
    if (q?.apply_status) rows = rows.filter((row) => row.apply_status === q.apply_status);
    if (Number(q?.ingress_node_id) > 0) rows = rows.filter((row) => row.ingress_node_id === Number(q?.ingress_node_id));
    if (Number(q?.egress_node_id) > 0) rows = rows.filter((row) => row.egress_node_id === Number(q?.egress_node_id));
    if (q?.keyword) { const search = String(q.keyword).toLowerCase(); rows = rows.filter((row) => [row.name, row.target_host, row.ingress_node?.connect_ip].some((value) => value?.toLowerCase().includes(search))); }
    const sorted = rt.sortMockForwards(rows, rt.reqStr(q?.sort), rt.reqStr(q?.order));
    return rt.ok(q?.page !== undefined || q?.page_size !== undefined || q?.sort !== undefined || q?.order !== undefined ? rt.paginate(sorted, q) : sorted);
  }
  const id = rt.parseId(seg[1]); if (id === null) return null;
  if (workspaceOf(db, id) !== scopeId) return rt.notFound("转发不存在");
  const tunnel = db.tunnels.find((row) => row.id === id); if (!tunnel) return rt.notFound("转发不存在");
  if (method === "GET" && seg[2] === "history") {
    return rt.ok(data.metadata.get(id)?.history ?? [{ revision: tunnel.config_revision ?? 1, desired_status: tunnel.desired_status ?? "active", created_at: tunnel.updated_at, created_by_id: tunnel.user_id }]);
  }
  if (method === "GET" && seg.length === 2) return rt.ok(view(db, rt.mockForwardView(db, tunnel)));
  if (method === "POST" && seg[2] === "actions") {
    const action = rt.asRecord(req.body).action;
    if (!["suspend", "resume", "retry", "delete"].includes(String(action))) return rt.badRequest("invalid_action", "invalid_action");
    if (!grants.permissions[action === "delete" ? "forward:delete" : "forward:update"] || grants.forward_mutations === "own" && tunnel.user_id !== user.id) return rt.fail(403, "permission_denied", "permission_denied");
    const delegated = await handleForwardsMock({ ...ctx, method: action === "delete" ? "DELETE" : "POST", seg: action === "delete" ? ["forwards", String(id)] : ["forwards", String(id), String(action)] });
    if (!delegated || delegated.status >= 400 || action === "delete") return delegated;
    data.metadata.get(id)?.history.push({ revision: tunnel.config_revision ?? 1, desired_status: tunnel.desired_status ?? "active", created_at: rt.nowIso(), created_by_id: user.id });
    return rt.ok(view(db, delegated.body as PortForward));
  }
  if (method === "PATCH" && seg.length === 2) {
    const body = rt.asRecord(req.body); const currentTransport = data.metadata.get(id)?.transport ?? "native_plain";
    if (body.transport !== undefined && body.transport !== currentTransport) return rt.fail(409, "transport_change_requires_recreate", "transport_change_requires_recreate");
    const delegated = await handleForwardsMock({ ...ctx, req: { ...req, body: { ...body, ...(body.path ? { mode: body.path } : {}) } } });
    if (!delegated || delegated.status >= 400) return delegated;
    if (!data.metadata.has(id)) data.metadata.set(id, { workspaceId: scopeId, transport: currentTransport, history: [] });
    data.metadata.get(id)!.history.push({ revision: tunnel.config_revision ?? 1, desired_status: tunnel.desired_status ?? "active", created_at: rt.nowIso(), created_by_id: user.id });
    return rt.ok(view(db, delegated.body as PortForward));
  }
  return null;
}
