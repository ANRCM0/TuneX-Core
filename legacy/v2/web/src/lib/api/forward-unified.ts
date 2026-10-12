import { request } from "./core";
import type { DiagnoseReport, Paginated, PortForward, TrafficPoint, UserNode } from "../types";
import type { ForwardAction, ForwardOperation, UnifiedForwardCapabilities, UnifiedForwardInput, UnifiedForwardPatch } from "../forward-unified";

/** All requests capture the workspace explicitly; cancellation prevents late reads crossing scope. */
export function unifiedForwardApi(workspaceId: number, signal?: AbortSignal) {
  const options = { workspaceId, signal };
  return {
    list: (query: Record<string, string | number | undefined>) => request<Paginated<PortForward>>("/forwards", { ...options, query }),
    nodes: () => request<UserNode[]>("/nodes", options),
    capabilities: () => request<UnifiedForwardCapabilities>("/forwards/capabilities", options),
    detail: (id: number) => request<PortForward>(`/forwards/${id}`, options),
    create: (body: UnifiedForwardInput) => request<ForwardOperation>("/forward-operations", { ...options, method: "POST", body }),
    operation: (id: string) => request<ForwardOperation>(`/forward-operations/${encodeURIComponent(id)}`, options),
    update: (id: number, body: UnifiedForwardPatch) => request<PortForward>(`/forwards/${id}`, { ...options, method: "PATCH", body }),
    action: (id: number, action: ForwardAction) => request<PortForward | { ok: boolean; reconciliation_pending?: boolean }>(`/forwards/${id}/actions`, { ...options, method: "POST", body: { action } }),
    traffic: (id: number) => request<TrafficPoint[]>(`/forwards/${id}/traffic`, { ...options, query: { days: 14 } }),
    diagnose: (id: number) => request<DiagnoseReport>(`/forwards/${id}/diagnose`, { ...options, method: "POST", body: {} }),
    history: (id: number) => request<ForwardHistoryEntry[]>(`/forwards/${id}/history`, options),
  };
}
export interface ForwardHistoryEntry { revision: number; desired_status: string; created_at: string; created_by_id: number | null }
