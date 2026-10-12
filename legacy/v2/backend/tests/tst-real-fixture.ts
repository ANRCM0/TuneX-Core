/** Isolated local acceptance fixture; never accepts an ambient production DB. */
import { randomUUID, createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { db } from "../src/db.ts";
import { hashPassword } from "../src/auth.ts";
import { ensurePersonalWorkspace } from "../src/services/workspace.ts";

export async function provisionTstFixture() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (url.protocol !== "mysql:" || !["127.0.0.1", "localhost"].includes(url.hostname)
    || !["/tunex_v2_e2e", "/tunex_v2_test"].includes(url.pathname)) throw new Error("isolated_v2_database_required");
  const suffix = randomUUID().slice(0, 8), password = "TuneX-V2-Local-Test!";
  const admin = await db.user.create({ data: { email: `v2-admin-${suffix}@tunex.invalid`, super_admin: true,
    email_verified_at: new Date(), credential: { create: { password: await hashPassword(password) } } } });
  const member = await db.user.create({ data: { email: `v2-member-${suffix}@tunex.invalid`,
    email_verified_at: new Date(), credential: { create: { password: await hashPassword(password) } } } });
  await ensurePersonalWorkspace(admin); await ensurePersonalWorkspace(member);
  const workspace = await db.workspace.create({ data: { slug: `v2-fixture-${suffix}`, name: "V2 local acceptance", kind: "team",
    created_by_id: admin.id, members: { create: [{ user_id: admin.id, role: "owner" }, { user_id: member.id, role: "member" }] } } });
  const policy = await db.capabilityPolicy.create({ data: { key: `v2-fixture-${suffix}`, name: "Local acceptance",
    source: "admin_grant", tunnel_types: ["tcp", "udp", "tls", "ws"], allow_custom_in_group: true,
    allow_custom_out_group: true, max_tunnels: 100, max_nodes: 100, max_members: 100 } });
  await db.workspacePolicyAssignment.create({ data: { workspace_id: workspace.id, policy_id: policy.id, source: "admin_grant" } });
  const provision = async (direction: "in" | "out", ip: string) => {
    const group = await db.nodeGroup.create({ data: { name: `V2 ${direction} ${suffix}`, node_type: direction,
      user_id: admin.id, workspace_id: workspace.id, port_range: "25000-25299", need_out_node_group: direction === "in" } });
    const credential = randomUUID();
    const node = await db.node.create({ data: { node_id: `v2-${direction}-${suffix}`, node_group_id: group.id,
      connect_ip: ip, role: direction === "in" ? "ingress" : "egress", port_range_min: 25000, port_range_max: 25299,
      node_credential_hash: createHash("sha256").update(credential).digest("hex"), credential_rotated_at: new Date(),
      last_seen_at: new Date() } });
    return { id: node.id, agent_id: node.agent_id, name: node.node_id, node_group_id: group.id,
      node_group_token: group.token, node_credential: credential, connect_ip: ip };
  };
  const ingress = await provision("in", "127.0.0.2"), egress = await provision("out", "127.0.0.3");
  // Administrator-prepared native path; the ordinary member only needs node-use
  // and forward-create permissions to reuse this relation in the acceptance run.
  await db.nodeBinding.create({ data: { ingress_node_id: ingress.id, egress_node_id: egress.id } });
  return { workspace_id: workspace.id, policy_id: policy.id, admin: { id: admin.id, email: admin.email, password },
    member: { id: member.id, email: member.email, password }, ingress, egress };
}
if (import.meta.main) {
  if (new URL(process.env.DATABASE_URL ?? "").pathname !== "/tunex_v2_e2e" || !process.env.TUNEX_V2_FIXTURE_FILE)
    throw new Error("isolated_e2e_database_and_private_fixture_path_required");
  try {
    const fixture = await provisionTstFixture();
    await writeFile(process.env.TUNEX_V2_FIXTURE_FILE, JSON.stringify(fixture), { mode: 0o600 });
    console.log(JSON.stringify({ workspace_id: fixture.workspace_id, ingress_id: fixture.ingress.id, egress_id: fixture.egress.id }));
  } finally { await db.$disconnect(); }
}
