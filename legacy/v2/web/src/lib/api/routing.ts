import { request } from "./core";

export interface RouteCandidate { id: string; edge_ids: string[]; priority: number; weight: number }
export interface RouteIntent {
  schema_version: 1; forward_id: number; expected_revision: number; topology_digest: string;
  strategy: "priority" | "weighted"; hop_limit: number; candidates: RouteCandidate[];
}
export interface RoutePolicyInput {
  schema_version: 1; expected_policy_version: number; intent: RouteIntent; enabled: boolean;
  auto_failover: boolean; auto_failback: boolean; failure_threshold: number; recovery_threshold: number;
  cooldown_ms: number; max_rtt_ms: number; max_loss_percent: number; min_handshake_success_rate: number;
}
export interface RouteReceipt {
  decision_id: string; candidate_id: string | null; node_ids: number[]; state: string; reason: string;
  expected_revision: number; desired_revision: number | null; applied_revision: number | null;
  created_at: string; confirmed_at: string | null;
}
export interface RoutePolicy {
  version: number; forward_revision: number; policy: RoutePolicyInput; last_decision: RouteReceipt | null;
  execution_enabled: boolean; authority_current?: boolean; revision_current?: boolean;
}
export interface RouteGraph {
  digest: string;
  nodes: { id: number; node_key: string; role: string | null; connection: string; lifecycle: string }[];
  edges: { id: string; from_node_id: number; to_node_id: number; transport: string }[];
  forwards: { id: number; revision: number | null; ingress_node_id: number | null; target_node_id: number | null;
    transport: string | null; path: string | null; current_edge_ids: string[]; issues: string[] }[];
}
export interface RoutePreview {
  valid: boolean; candidates: (RouteCandidate & { node_ids: number[]; valid: boolean; reasons: string[]; admission_issues: string[] })[];
}
export interface RouteDecision {
  selected_candidate_id: string | null; current_candidate_id: string | null; reason: string; cooldown_remaining_ms: number;
  candidates: (RouteCandidate & { qualified: boolean; blockers: string[]; healthy_checks: number; failure_checks: number })[];
}
export interface RouteCapabilities {
  enabled: boolean; features: { policy_storage: boolean; policy_preview: boolean; active_probes: boolean;
    path_selection: boolean; multi_hop_execution: boolean };
}
export function routingApi(workspaceId: number, signal?: AbortSignal) {
  const options = { workspaceId, signal };
  return {
    capabilities: () => request<RouteCapabilities>("/routing/capabilities", options),
    topology: () => request<RouteGraph>("/routing/topology", options),
    policy: (id: number) => request<RoutePolicy | null>(`/routing/policies/${id}`, options),
    history: (id: number) => request<RouteReceipt[]>(`/routing/policies/${id}/history`, options),
    decision: (id: number) => request<RouteDecision>(`/routing/policies/${id}/decision`, options),
    preview: (intent: RouteIntent) => request<RoutePreview>("/routing/preview", { ...options, method: "POST", body: intent }),
    save: (id: number, body: RoutePolicyInput) => request<RoutePolicy>(`/routing/policies/${id}`, { ...options, method: "PUT", body }),
    probe: (id: number, revision: number) => request("/routing/probes", { ...options, method: "POST", body: { schema_version: 1, forward_id: id, expected_revision: revision } }),
  };
}
