import type { ForwardPolicyInput } from "./forward-policy";
import type { PortForward, UserNode } from "./types";

export type ForwardPath = "direct" | "relay";
export type ForwardTransport = "native_plain" | "tst_v1";
export type BusinessProtocol = "tcp" | "udp" | "both";
export type ForwardAction = "suspend" | "resume" | "retry" | "delete";
export type ForwardState = "accepted" | "pending" | "applying" | "ready" | "stale" | "unverified" | "suspended" | "error" | "deleted";
export interface ForwardOperation {
  operation_id: string; forward_id: number | null; state: string; stage: string;
  error_code: string | null; replayed?: boolean;
}
export interface UnifiedForwardInput extends ForwardPolicyInput {
  idempotency_key: string; name: string; path: ForwardPath; transport: ForwardTransport;
  protocol: BusinessProtocol; ingress_node_id: number; egress_node_id?: number | null;
  listen_port?: number | null; target_host: string; target_port: number;
  transport_options: { selection: "auto" | "specified"; link_id?: number };
}
export interface UnifiedForwardPatch {
  expected_revision: number;
  name?: string;
  protocol?: BusinessProtocol;
  ingress_node_id?: number;
  egress_node_id?: number | null;
  listen_port?: number | null;
  target_host?: string;
  target_port?: number;
  bytes_per_second_in?: number;
  bytes_per_second_out?: number;
  max_connections?: number;
  max_connections_per_ip?: number;
}
export interface ForwardCombination {
  path: ForwardPath; transport: ForwardTransport; protocol: BusinessProtocol; available: boolean; reason: string | null;
  ingress_node_ids: number[]; egress_node_ids: number[];
}
export interface UnifiedForwardCapabilities {
  native_both_enabled: boolean; tst_enabled: boolean;
  transports: string[]; combinations: ForwardCombination[]; node_use_allowed: boolean;
}

export function forwardPath(forward: PortForward): ForwardPath { return forward.path ?? forward.mode; }
export function forwardTransport(forward: PortForward): ForwardTransport | "legacy_unsupported" { return forward.transport ?? "native_plain"; }
export function forwardState(forward: PortForward): ForwardState {
  const lifecycle = forward.lifecycle;
  if (lifecycle) {
    if (lifecycle.desired === "suspended") return "suspended";
    if (lifecycle.deployment === "failed") return "error";
    if (lifecycle.deployment === "pending" || lifecycle.deployment === "applying") return lifecycle.deployment;
    if (lifecycle.runtime === "stale") return "stale";
    if (lifecycle.deployment === "confirmed" && lifecycle.runtime === "ready") return "ready";
    return "unverified";
  }
  if (forward.desired_status === "inactive" || forward.apply_status === "suspended") return "suspended";
  if (forward.apply_status === "error") return "error";
  if (forward.apply_status === "pending" || forward.apply_status === "applying") return forward.apply_status;
  if (forward.applied_revision !== forward.config_revision) return "pending";
  return "unverified";
}

/** No report or expired report is never positive runtime capability evidence. */
export function forwardCombinationBlock(capabilities: UnifiedForwardCapabilities | null, path: ForwardPath,
  transport: ForwardTransport, protocol: string, ingress?: UserNode, egress?: UserNode,
  existing?: PortForward): string | null {
  if (transport === "tst_v1" && path !== "relay") return "tst_relay_only";
  const unchanged = existing && forwardPath(existing) === path && forwardTransport(existing) === transport
    && existing.protocol === protocol && existing.ingress_node_id === ingress?.id
    && (path === "direct" || existing.egress_node_id === egress?.id);
  if (unchanged) return null;
  if (!capabilities) return "capabilities_unavailable";
  const combination = capabilities.combinations.find((row) => row.path === path && row.transport === transport && row.protocol === protocol);
  if (!combination) return "protocol_not_supported";
  if (!combination.available) return combination.reason ?? "combination_not_enabled";
  if (ingress && !combination.ingress_node_ids.includes(ingress.id)) return "ingress_capability_missing";
  if (egress && path === "relay" && !combination.egress_node_ids.includes(egress.id)) return "egress_capability_missing";
  if (transport === "tst_v1") {
    if (!capabilities.tst_enabled) return "tst_not_enabled";
    for (const node of [ingress, egress]) {
      if (!node || node.capabilities_fresh !== true || !node.capabilities?.includes("forward.link.tst.v1")) return "tst_capability_missing";
    }
  } else if (protocol === "both") {
    if (!capabilities.native_both_enabled) return "native_both_not_enabled";
    for (const node of path === "direct" ? [ingress] : [ingress, egress]) {
      if (!node || node.capabilities_fresh !== true || !node.capabilities?.includes("forward.protocol.both.native.v1")) return "native_both_capability_missing";
    }
  }
  return null;
}

/** Cumulative payload counters are separate from readiness and archived accounting. */
export function forwardTrafficEvidence(forward: PortForward): { bytesIn: string; bytesOut: string; connections: string; lastReceivedAt: string | null } | null {
  const traffic = forward.lifecycle?.traffic;
  if (!traffic || typeof traffic !== "object" || Array.isArray(traffic)) return null;
  const fact = traffic as Record<string, unknown>;
  const counter = (value: unknown): value is string => typeof value === "string" && /^(0|[1-9]\d{0,23})$/.test(value);
  if (!counter(fact.bytes_in) || !counter(fact.bytes_out) || !counter(fact.connections)) return null;
  return { bytesIn: fact.bytes_in, bytesOut: fact.bytes_out, connections: fact.connections,
    lastReceivedAt: typeof fact.last_received_at === "string" && Number.isFinite(Date.parse(fact.last_received_at)) ? fact.last_received_at : null };
}

/** Backend prose can contain internal configuration; only bounded machine codes enter errors. */
export function safeForwardError(error: unknown): string {
  const data = error && typeof error === "object" && "data" in error ? error.data : null;
  const code = data && typeof data === "object" && "code" in data ? data.code : null;
  return typeof code === "string" && /^[a-z][a-z0-9_]{0,95}$/.test(code) ? code : "forward_request_failed";
}

export function accessAddress(forward: PortForward): string | null {
  const host = forward.ingress_node?.connect_ip ?? forward.listen_ip;
  if (!host || !forward.listen_port) return null;
  return `${host.includes(":") ? `[${host}]` : host}:${forward.listen_port}`;
}
