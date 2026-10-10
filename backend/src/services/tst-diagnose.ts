import { randomUUID } from "node:crypto";
import { db } from "../db.ts";
import { TstLinkInputSchema } from "../domain/link/tst-compiler.ts";
import { getLink } from "./link-resource.ts";
import { enqueueAgentCommand, waitAgentCommandAck } from "./agent-command-bus.ts";
import { validatePayload, type CommandEnvelope } from "./control-protocol/index.ts";
import { loadNodeCapabilityFacts } from "./runtime-admission.ts";
import { nextStepFor, summarizeSegment, type DiagnoseReport, type DiagnoseSegment } from "./agent-diagnose.ts";
import { LinkResourceError } from "./link-errors.ts";
const TCP_PROBE_PROTOCOL = "tcp" as const;

/** No request-provided targets. The Agent resolves the exact binding locally;
 * the Panel retains its immutable expected target solely to validate the ACK. */
export async function diagnoseTstForward(id: number, workspaceId: number): Promise<DiagnoseReport> {
  const row = await db.tunnel.findFirst({ where: { id, workspace_id: workspaceId, category: "port_forward" } });
  if (!row?.link_resource_id) throw new LinkResourceError("forward_not_found", 404);
  const link = await getLink(workspaceId, row.link_resource_id);
  const placements = link.deployment?.placements ?? [];
  const incoming = placements.find((p) => p.role === "ingress"), outgoing = placements.find((p) => p.role === "egress");
  const carrier: DiagnoseSegment = { segment: "ingress_to_egress", method: "node_facts", verified: false,
    node_id: row.ingress_node_id!, node_key: String(row.ingress_node_id), targets: [], results: [],
    outcome: incoming?.observation.ready && outgoing?.observation.ready ? "ok" : "unknown",
    message: "根据两端最新上报核对 TST 运行状态，未进行端到端业务测试。" };
  const target: DiagnoseSegment = { segment: "egress_to_target", method: "tcp_probe", verified: false,
    protocol: TCP_PROBE_PROTOCOL, node_id: row.egress_node_id!, node_key: String(row.egress_node_id), targets: [], results: [],
    outcome: "unknown", error_code: "placement_unconfirmed", message: "当前部署尚未确认，目标可达性未验证。" };
  if (row.forward_protocol === "udp") {
    target.outcome = "unsupported"; target.error_code = "udp_probe_unsupported";
    target.message = "UDP 目标未进行应用协议探测，TCP 连接结果不能证明 UDP 可达。";
  } else if (outgoing?.observation.ready && row.config_revision != null && row.applied_revision === row.config_revision) {
    const deployment = await db.linkDeployment.findUniqueOrThrow({ where: { id: outgoing.deployment_id } });
    const snapshot = deployment.binding_snapshot as { spec?: unknown };
    const binding = TstLinkInputSchema.parse(snapshot.spec).bindings.find((b) => b.forward_id === id && b.revision === row.config_revision);
    const facts = await loadNodeCapabilityFacts(outgoing.node_id);
    if (binding && facts?.advertisementCurrent && facts.capabilities?.includes("diagnose_link_forward")) {
      const payload = { forward_id: id, revision: row.config_revision, timeout_ms: 5000 };
      const invalid = validatePayload("diagnose_link_forward", payload);
      if (invalid) throw new LinkResourceError("invalid_link_probe", 400);
      const expected = [{ host: binding.target_host, port: binding.target_port }];
      const envelope: CommandEnvelope = { command_id: randomUUID(), resource: "link", resource_id: outgoing.runtime_id,
        action: "diagnose_link_forward", revision: deployment.generation, payload,
        issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 20_000).toISOString() };
      const { scope } = await enqueueAgentCommand(outgoing.node_id, envelope, null, undefined, undefined, {}, undefined, undefined, payload, expected);
      try {
        const ack = await waitAgentCommandAck(scope, outgoing.node_id, envelope.command_id, 20_000);
        if (ack.ok) {
          target.targets = expected; target.results = (ack.results ?? []).map(({ detail: _detail, ...result }) => result);
          target.verified = true; target.outcome = summarizeSegment(target.results); delete target.error_code;
          target.message = row.forward_protocol === "both" ? "已验证目标 TCP 连接，UDP 未进行应用协议探测。" : "已进行目标 TCP 连接探测。";
        } else { target.outcome = "failed"; target.error_code = /^[a-z_]{1,64}$/.test(ack.error_code ?? "") ? ack.error_code! : "diagnose_failed"; }
      } catch { target.outcome = "unknown"; target.error_code = "diagnose_timeout"; }
    } else { target.outcome = "unsupported"; target.error_code = "diagnose_capability_missing"; target.message = "出口 Agent 尚未提供 TST 目标探测能力。"; }
  }
  const segments = [carrier, target];
  return { forward_id: id, mode: "relay", generated_at: new Date().toISOString(), segments, next_step: nextStepFor(segments, "relay") };
}
