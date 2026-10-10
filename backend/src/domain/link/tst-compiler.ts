import { z } from "zod";
import { canonicalConfigDigest } from "./core-contract.ts";
import { validateTstCredentials, type TstCredentials, type TstIdentity } from "./tst-credentials.ts";
import { LinkTargetSetSchema } from "./target-set.ts";
import { LinkClientSourceSchema } from "./client-source.ts";
import { bindScopesOverlap, protocolsOverlap } from "./bind-scope.ts";
const id = z.number().int().positive().max(2_147_483_647);
export const TST_MAX_CONNECTIONS = 4096;
const host = z.string().min(1).max(255).refine((value) => !/[\s/\x00]/.test(value));
const endpoint = z.object({ id, workspace_id: id, connect_host: z.string(), version: z.string(), capabilities: z.array(z.string()) });
const binding = z.object({ forward_id: id, revision: id, protocol: z.enum(["tcp", "udp", "both"]),
  listen_host: z.string().default(""), listen_port: id.max(65535), target_host: host, target_port: id.max(65535),
  bytes_per_second_in: z.number().int().min(0).max(2 ** 40).default(0), bytes_per_second_out: z.number().int().min(0).max(2 ** 40).default(0),
  max_connections: z.number().int().min(0).max(TST_MAX_CONNECTIONS).default(0),
  max_connections_per_ip: z.number().int().min(0).max(TST_MAX_CONNECTIONS).default(0),
  // Retained storage is never interpreted as supported TST target/source policy.
  target_set: LinkTargetSetSchema.optional(), client_source: LinkClientSourceSchema.optional(),
});
export const TstLinkInputSchema = z.object({ link_id: id, workspace_id: id, version: id, generation: id,
  ingress: endpoint, egress: endpoint, carrier_port: id.max(65535), lease_expires_at: z.string().datetime(),
  bindings: z.array(binding).max(500) });
export interface TstTransportConfig { protocol: "tst/1"; role: "ingress" | "egress"; workspace_id: number; link_id: number;
  node_id: number; peer_node_id: number; carrier_host: string; carrier_port: number; identity: TstIdentity;
  bindings: Array<Omit<z.infer<typeof binding>, "target_set" | "client_source">> }
export interface TstPlacementConfig { id: string; link_id: number; workspace_id: number; node_id: number; role: "ingress" | "egress";
  generation: number; lease_expires_at: string; config_digest: string; runtime_ids: string[];
  ports: { protocol: "tcp" | "udp"; host: string; port: number }[]; transport_config: TstTransportConfig }
/** Independent TuneX configuration compiler. No external runner or protocol adapter. */
export function compileTstLink(raw: unknown, credentials?: TstCredentials): { ingress: TstPlacementConfig; egress: TstPlacementConfig } {
  const input = TstLinkInputSchema.parse(raw);
  if (input.ingress.id === input.egress.id) throw new Error("point_to_point_requires_distinct_nodes");
  for (const node of [input.ingress, input.egress]) {
    if (node.workspace_id !== input.workspace_id) throw new Error("link_workspace_mismatch");
    if (!node.capabilities.includes("forward.link.tst.v1")) throw new Error("agent_tst_capability_missing");
  }
  if (credentials) validateTstCredentials(credentials, { workspace: input.workspace_id, link: input.link_id,
    ingressNode: input.ingress.id, egressNode: input.egress.id });
  if (!input.egress.connect_host) throw new Error("hop_address_missing");
  if (new Set(input.bindings.map((b) => b.forward_id)).size !== input.bindings.length) throw new Error("duplicate_forward_binding");
  for (let i = 0; i < input.bindings.length; i++) for (let j = i + 1; j < input.bindings.length; j++) {
    const a = input.bindings[i]!, b = input.bindings[j]!;
    if (a.listen_port === b.listen_port && bindScopesOverlap(a.listen_host, b.listen_host) && protocolsOverlap(a.protocol, b.protocol))
      throw new Error("port_conflict");
  }
  if (input.bindings.some((b) => b.target_set != null || b.client_source != null)) throw new Error("tst_policy_unsupported");
  const make = (role: "ingress" | "egress"): TstPlacementConfig => {
    const node = input[role], peer = input[role === "ingress" ? "egress" : "ingress"];
    const transport_config: TstTransportConfig = { protocol: "tst/1", role, workspace_id: input.workspace_id, link_id: input.link_id,
      node_id: node.id, peer_node_id: peer.id, carrier_host: role === "ingress" ? input.egress.connect_host : "0.0.0.0",
      carrier_port: input.carrier_port, identity: credentials?.[role] ?? { certificate_pem: "", private_key_pem: "", ca_pem: "", peer_uri: "" },
      bindings: input.bindings.map(({ target_set: _target, client_source: _source, ...value }) => ({ ...value,
        ...(role === "ingress" ? { listen_host: value.listen_host || "0.0.0.0", target_host: "", target_port: 0 }
          : { listen_host: "", listen_port: 0 }) })) };
    const carrierProtocol = "tcp" as const;
    const ports = role === "egress" ? [{ protocol: carrierProtocol, host: "0.0.0.0", port: input.carrier_port }]
      : input.bindings.flatMap((b) => (b.protocol === "both" ? ["tcp", "udp"] as const : [b.protocol]).map((protocol) =>
        ({ protocol, host: b.listen_host || "0.0.0.0", port: b.listen_port })));
    return { id: `tunex-tst-${input.link_id}-${role}`, link_id: input.link_id, workspace_id: input.workspace_id, node_id: node.id,
      role, generation: input.generation, lease_expires_at: input.lease_expires_at,
      config_digest: canonicalConfigDigest(transport_config), runtime_ids: input.bindings.flatMap((b) =>
        (b.protocol === "both" ? ["tcp", "udp"] : [b.protocol]).map((p) => `tunex-tst-${input.link_id}-f${b.forward_id}-${role}-${p}`)),
      ports, transport_config };
  };
  const result = { ingress: make("ingress"), egress: make("egress") };
  if (JSON.stringify(result).length > 1_048_576) throw new Error("link_config_too_large");
  return result;
}
