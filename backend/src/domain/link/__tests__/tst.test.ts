import { describe, expect, test } from "bun:test";
import { X509Certificate, createPublicKey } from "node:crypto";
import { newTstCredentials, sealTstCredentials, unsealTstCredentials, tstUri } from "../tst-credentials.ts";
import { compileTstLink } from "../tst-compiler.ts";
import { canonicalConfigDigest } from "../core-contract.ts";

const input = {
  link_id: 3, workspace_id: 4, version: 1, generation: 2, carrier_port: 23001,
  lease_expires_at: new Date(Date.now() + 180000).toISOString(),
  ingress: { id: 11, workspace_id: 4, connect_host: "192.0.2.11", version: "2.0.0", capabilities: ["forward.link.tst.v1"] },
  egress: { id: 12, workspace_id: 4, connect_host: "192.0.2.12", version: "2.0.0", capabilities: ["forward.link.tst.v1"] },
  bindings: [{ forward_id: 91, revision: 5, protocol: "both", listen_port: 23002, listen_host: "127.0.0.1",
    target_host: "localhost", target_port: 9443, bytes_per_second_in: 1024, bytes_per_second_out: 2048,
    max_connections: 10, max_connections_per_ip: 2 }],
};
describe("independent TST configuration and scoped credentials", () => {
  test("ECDSA issued certificates verify against the private Link CA and exact identity", async () => {
    const credentials = await newTstCredentials(4, 3, 11, 12);
    const ca = new X509Certificate(credentials.ca_pem);
    expect(ca.ca).toBe(true);
    expect(ca.verify(ca.publicKey)).toBe(true);
    for (const [role, node, peer] of [["ingress", 11, 12], ["egress", 12, 11]] as const) {
      const identity = credentials[role], cert = new X509Certificate(identity.certificate_pem);
      expect(cert.ca).toBe(false);
      expect(cert.verify(ca.publicKey)).toBe(true);
      expect(cert.subjectAltName).toContain(tstUri(4, 3, node, role));
      expect(cert.checkHost(`tst-node-${node}.tunex.invalid`)).toBeDefined();
      expect(cert.publicKey.export({ type: "spki", format: "pem" })).toEqual(createPublicKey(identity.private_key_pem).export({ type: "spki", format: "pem" }));
      expect(identity.peer_uri).toBe(tstUri(4, 3, peer, role === "ingress" ? "egress" : "ingress"));
    }
    const stranger = new X509Certificate((await newTstCredentials(5, 3, 11, 12)).ca_pem);
    expect(new X509Certificate(credentials.ingress.certificate_pem).verify(stranger.publicKey)).toBe(false);
  });
  test("sealed identity bundle rejects cross workspace, Link, generation and ciphertext corruption", async () => {
    const credentials = await newTstCredentials(4, 3, 11, 12), key = "23".repeat(32);
    const sealed = sealTstCredentials(credentials, key, 4, 3, 2);
    expect(sealed).not.toContain("PRIVATE KEY");
    expect(unsealTstCredentials(sealed, key, 4, 3, 2)).toEqual(credentials);
    for (const identity of [[5, 3, 2], [4, 5, 2], [4, 3, 3]])
      expect(() => unsealTstCredentials(sealed, key, identity[0]!, identity[1]!, identity[2]!)).toThrow();
    expect(() => unsealTstCredentials(sealed, "24".repeat(32), 4, 3, 2)).toThrow();
    expect(() => unsealTstCredentials(sealed.slice(0, -2) + "zz", key, 4, 3, 2)).toThrow();
  });
  test("binding revisions, QoS, carrier claims and identities reach only the correct Agent", async () => {
    const credentials = await newTstCredentials(4, 3, 11, 12);
    const result = compileTstLink(input, credentials);
    expect(result.ingress.ports).toEqual([{ protocol: "tcp", host: "127.0.0.1", port: 23002 }, { protocol: "udp", host: "127.0.0.1", port: 23002 }]);
    expect(result.egress.ports).toEqual([{ protocol: "tcp", host: "0.0.0.0", port: 23001 }]);
    expect(result.ingress.transport_config.identity).toEqual(credentials.ingress);
    expect(result.egress.transport_config.identity).toEqual(credentials.egress);
    expect(JSON.stringify(result.ingress)).not.toContain(credentials.ca_key_pem);
    expect(JSON.stringify(result.ingress)).not.toContain(credentials.egress.private_key_pem);
    expect(result.egress.transport_config.bindings[0]?.revision).toBe(5);
    expect(result.ingress.config_digest).toBe(canonicalConfigDigest(result.ingress.transport_config));
    const renewed = compileTstLink({ ...input, lease_expires_at: new Date(Date.now() + 200000).toISOString() }, credentials);
    expect(renewed.ingress.config_digest).toBe(result.ingress.config_digest);
    const update = compileTstLink({ ...input, bindings: [{ ...input.bindings[0], revision: 6 }] }, credentials);
    expect(update.egress.config_digest).not.toBe(result.egress.config_digest);
  });
  test("missing capability, cross workspace, duplicates and unsupported policies fail closed", () => {
    expect(() => compileTstLink({ ...input, ingress: { ...input.ingress, workspace_id: 9 } })).toThrow("link_workspace_mismatch");
    expect(() => compileTstLink({ ...input, egress: { ...input.egress, capabilities: [] } })).toThrow("agent_tst_capability_missing");
    expect(() => compileTstLink({ ...input, bindings: [input.bindings[0], input.bindings[0]] })).toThrow("duplicate_forward_binding");
    expect(() => compileTstLink({ ...input, egress: { ...input.egress, connect_host: "" } })).toThrow("hop_address_missing");
  });
  test("empty ingress remains a leased passive placement with transport identity and no listeners", async () => {
    const result = compileTstLink({ ...input, bindings: [] }, await newTstCredentials(4, 3, 11, 12));
    expect(result.ingress.ports).toEqual([]);
    expect(result.ingress.transport_config.protocol).toBe("tst/1");
    expect(result.egress.ports).toHaveLength(1);
  });
  test("wildcard binding and frozen listener claim describe the same socket scope", () => {
    const result = compileTstLink({ ...input, bindings: [{ ...input.bindings[0], listen_host: "" }] });
    expect(result.ingress.transport_config.bindings[0]?.listen_host).toBe("0.0.0.0");
    expect(result.ingress.ports.every((p) => p.host === result.ingress.transport_config.bindings[0]?.listen_host)).toBe(true);
    expect(result.egress.transport_config.bindings[0]?.listen_host).toBe("");
    expect(() => compileTstLink({ ...input, bindings: [{ ...input.bindings[0], revision: 0 }] })).toThrow();
  });
  test("compiler enforces the Agent's connection and rate bounds before placement persistence", () => {
    const bounded = { ...input.bindings[0], max_connections: 4096, max_connections_per_ip: 4096,
      bytes_per_second_in: 2 ** 40, bytes_per_second_out: 2 ** 40 };
    const compiled = compileTstLink({ ...input, bindings: [bounded] });
    expect(compiled.ingress.transport_config.bindings[0]?.max_connections).toBe(4096);
    for (const field of ["max_connections", "max_connections_per_ip", "bytes_per_second_in", "bytes_per_second_out"] as const) {
      expect(() => compileTstLink({ ...input, bindings: [{ ...bounded, [field]: bounded[field] + 1 }] })).toThrow();
    }
  });
});
