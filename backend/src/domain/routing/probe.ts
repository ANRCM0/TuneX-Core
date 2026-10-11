import { z } from "zod";
import { RoutingError } from "./model.ts";

/** One bounded TCP connect per configured target; no payload or business listener traffic. */
export const ROUTING_PROBE_LIMITS = {
  targets: 3, command_timeout_ms: 20_000, workspace_concurrency: 1,
  node_cooldown_ms: 30_000, reservation_ms: 60_000, freshness_ms: 60_000, retention_ms: 120_000,
} as const;
const id = z.number().int().positive().max(2_147_483_647);
export const RoutingProbeInputSchema = z.object({
  schema_version: z.literal(1), forward_id: id, expected_revision: id,
}).strict();
export type RoutingProbeInput = z.infer<typeof RoutingProbeInputSchema>;

const SampleSchema = z.object({
  target_index: z.number().int().min(0).max(ROUTING_PROBE_LIMITS.targets - 1),
  status: z.enum(["reachable", "refused", "timeout", "dns_error", "error", "unmeasured"]),
  connect_elapsed_ms: z.number().int().min(0).max(6000).nullable(),
}).strict();
export const RoutingProbeObservationSchema = z.object({
  schema_version: z.literal(1), observation_id: z.string().uuid(), workspace_id: id,
  forward_id: id, revision: id, node_id: id, method: z.literal("tcp_connect"),
  transport: z.enum(["native_plain", "tst_v1"]), evidence_protocol: z.literal("tcp"),
  timing_basis: z.literal("dns_and_tcp_connect"),
  scope: z.literal("node_to_configured_targets"), started_at: z.string().datetime(),
  observed_at: z.string().datetime(), expires_at: z.string().datetime(),
  state: z.enum(["reachable", "unreachable", "mixed", "unknown"]),
  samples: z.array(SampleSchema).min(1).max(ROUTING_PROBE_LIMITS.targets),
  tcp_connect_success_rate: z.number().min(0).max(1).nullable(),
  rtt_ms: z.null(), loss_percent: z.null(), tls_handshake_success_rate: z.null(),
  end_to_end_verified: z.literal(false), udp_verified: z.literal(false),
}).strict().superRefine((v, ctx) => {
  if (v.samples.some((s, index) => s.target_index !== index || (s.status === "unmeasured") !== (s.connect_elapsed_ms === null)))
    ctx.addIssue({ code: "custom", message: "invalid_sample_slots" });
  const success = v.samples.filter((s) => s.status === "reachable").length;
  const conclusive = v.samples.filter((s) => ["reachable", "refused", "timeout", "dns_error"].includes(s.status)).length;
  const connects = v.samples.filter((s) => ["reachable", "refused", "timeout"].includes(s.status)).length;
  const state = conclusive !== v.samples.length ? "unknown" : success === v.samples.length ? "reachable"
    : success === 0 ? "unreachable" : "mixed";
  if (v.state !== state || v.tcp_connect_success_rate !== (connects ? success / connects : null))
    ctx.addIssue({ code: "custom", message: "invalid_sample_summary" });
});
export type RoutingProbeObservation = z.infer<typeof RoutingProbeObservationSchema>;
export const StoredRoutingProbeSchema = z.object({
  identity_digest: z.string().regex(/^[a-f0-9]{64}$/), observation: RoutingProbeObservationSchema,
}).strict();

export interface RoutingProbeTarget { host: string; port: number }
export interface RoutingProbeResult extends RoutingProbeTarget {
  status: string; elapsed_ms: number; detail?: string;
}

/** Closed projection: targets, resolved addresses, raw ACKs and error prose stay private. */
export function summarizeRoutingProbe(input: {
  observationId: string; workspaceId: number; forwardId: number; revision: number; nodeId: number;
  targets: RoutingProbeTarget[]; results: RoutingProbeResult[]; startedAt: Date; observedAt: Date;
  transport?: "native_plain" | "tst_v1";
}): RoutingProbeObservation {
  if (!input.targets.length || input.targets.length > ROUTING_PROBE_LIMITS.targets || input.results.length !== input.targets.length)
    throw new RoutingError("probe_result_invalid", 503);
  const key = (t: RoutingProbeTarget) => JSON.stringify([t.host.toLowerCase(), t.port]);
  const results = new Map(input.results.map((r) => [key(r), r]));
  if (results.size !== input.results.length || new Set(input.targets.map(key)).size !== input.targets.length)
    throw new RoutingError("probe_result_invalid", 503);
  const samples = input.targets.map((t, target_index) => {
    const r = results.get(key(t));
    if (!r || !["reachable", "refused", "timeout", "dns_error", "error"].includes(r.status) ||
      !Number.isInteger(r.elapsed_ms) || r.elapsed_ms < 0 || r.elapsed_ms > 6000)
      throw new RoutingError("probe_result_invalid", 503);
    // A target that was never attempted is absence of evidence, not packet loss.
    const unmeasured = r.detail === "probe budget exhausted before this target";
    return { target_index, status: unmeasured ? "unmeasured" as const : r.status as "reachable" | "refused" | "timeout" | "dns_error" | "error",
      connect_elapsed_ms: unmeasured ? null : r.elapsed_ms };
  });
  const successful = samples.filter((s) => s.status === "reachable").length;
  const conclusive = samples.filter((s) => ["reachable", "refused", "timeout", "dns_error"].includes(s.status)).length;
  const connects = samples.filter((s) => ["reachable", "refused", "timeout"].includes(s.status));
  const state = conclusive !== samples.length ? "unknown" : successful === samples.length ? "reachable"
    : successful === 0 ? "unreachable" : "mixed";
  return RoutingProbeObservationSchema.parse({ schema_version: 1, observation_id: input.observationId,
    workspace_id: input.workspaceId, forward_id: input.forwardId, revision: input.revision, node_id: input.nodeId,
    method: "tcp_connect", transport: input.transport ?? "native_plain", evidence_protocol: "tcp", timing_basis: "dns_and_tcp_connect", scope: "node_to_configured_targets",
    started_at: input.startedAt.toISOString(), observed_at: input.observedAt.toISOString(),
    expires_at: new Date(input.startedAt.getTime() + ROUTING_PROBE_LIMITS.freshness_ms).toISOString(), state, samples,
    tcp_connect_success_rate: connects.length ? successful / connects.length : null,
    rtt_ms: null, loss_percent: null, tls_handshake_success_rate: null, end_to_end_verified: false, udp_verified: false });
}
