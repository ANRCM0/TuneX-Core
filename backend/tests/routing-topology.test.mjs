import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';

if (process.env.TUNEX_DB_TEST !== '1') {
  test('V2.3 routing HTTP/DB acceptance requires TUNEX_DB_TEST=1', { skip: true }, () => {});
} else {
  // This suite only inserts nonce-owned fixtures into an explicit isolated test DB.
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert(url.protocol === 'mysql:' && ['127.0.0.1', 'localhost'].includes(url.hostname)
    && ['/tunex_ci', '/tunex_v23_test'].includes(url.pathname), 'isolated_routing_database_required');
  process.env.TUNEX_ROUTING_ENABLED = 'true';
  process.env.PAYMENTS_ENABLED = 'false';
  process.env.ALLOW_REGISTER_FALLBACK = 'true';
  const { app } = await import('../src/app.ts');
  const { db } = await import('../src/db.ts');
  const { redis } = await import('../src/redis.ts');
  const { canonicalConfigDigest } = await import('../src/domain/link/core-contract.ts');
  after(async () => { redis.disconnect(); await db.$disconnect(); });
  const nonce = randomUUID();
  let ip = 0;
  async function request(path, method = 'GET', actor, body, workspace = actor?.workspace) {
    return app.request(`http://localhost/api/routing${path}`, { method,
      headers: { 'x-forwarded-for': `198.51.100.${++ip}`, ...(actor ? { cookie: actor.cookie, 'x-csrf-token': '1' } : {}),
        ...(workspace ? { 'x-workspace-id': String(workspace) } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  }
  async function register(label) {
    const email = `routing-${label}-${nonce}@example.test`;
    const body = { email, password: 'test-only-routing-password-12' };
    const created = await app.request('http://localhost/api/auth/register', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${++ip}` }, body: JSON.stringify(body) });
    assert.equal(created.status, 201, JSON.stringify(await created.json()));
    const login = await app.request('http://localhost/api/auth/login', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${++ip}` }, body: JSON.stringify(body) });
    assert.equal(login.status, 200);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const workspace = await db.workspace.findUniqueOrThrow({ where: { personal_user_id: user.id } });
    return { id: user.id, workspace: workspace.id, cookie: login.headers.get('set-cookie').split(';')[0] };
  }
  async function nodes(actor, count) {
    const group = await db.nodeGroup.create({ data: { name: `routing-${nonce}-${actor.id}`, token: randomUUID(),
      workspace_id: actor.workspace, user_id: actor.id, node_type: 'in' } });
    const rows = [];
    for (let index = 0; index < count; index++) {
      rows.push(await db.node.create({ data: { node_id: `routing-${actor.id}-${index}-${nonce}`, node_group_id: group.id,
        role: 'both', lifecycle: 'active', status: 'active', last_seen_at: new Date(),
        node_credential_hash: createHash('sha256').update(randomUUID()).digest('hex'),
        state_report: { create: { reported_at: new Date(), control_protocol_version: 2,
          capabilities: ['apply_tunnel', 'forward.link.tst.v1', 'forward.protocol.both.native.v1'],
          capability_manifest: { schema_version: 2, protocols: ['tcp', 'udp', 'both'], transports: ['stream', 'datagram', 'mixed'],
            runtime: [], diagnostics: [] } } } } }));
    }
    return { group, rows };
  }
  async function footprint(actor, forwardIds, nodeIds, linkIds) {
    return {
      forwards: await db.tunnel.findMany({ where: { id: { in: forwardIds } }, orderBy: { id: 'asc' },
        select: { id: true, config_revision: true, applied_revision: true, ingress_node_id: true, egress_node_id: true, apply_status: true } }),
      revisions: await db.forwardRevision.count({ where: { tunnel_id: { in: forwardIds } } }),
      leases: await db.nodePortLease.count({ where: { node_id: { in: nodeIds } } }),
      operations: await db.forwardOperation.count({ where: { workspace_id: actor.workspace } }),
      deployments: await db.linkDeployment.count({ where: { link_id: { in: linkIds } } }),
    };
  }

  test('V2.3 routing uses real authentication, Workspace membership and Prisma projection', async (t) => {
    const owner = await register('owner'), outside = await register('outside'), viewer = await register('viewer');
    const local = await nodes(owner, 3), foreign = await nodes(outside, 1);
    const [ingress, middle, egress] = local.rows;
    const binding = await db.nodeBinding.create({ data: { ingress_node_id: ingress.id, egress_node_id: egress.id } });
    const hopA = await db.nodeBinding.create({ data: { ingress_node_id: ingress.id, egress_node_id: middle.id } });
    const hopB = await db.nodeBinding.create({ data: { ingress_node_id: middle.id, egress_node_id: egress.id } });
    const foreignBinding = await db.nodeBinding.create({ data: { ingress_node_id: ingress.id, egress_node_id: foreign.rows[0].id } });
    const config = { ingress_node_id: ingress.id, egress_node_id: egress.id, carrier_port: 26000 };
    const link = await db.linkResource.create({ data: { workspace_id: owner.workspace, name: `routing-${nonce}`,
      carrier: 'tst_v1', status: 'active', desired_version: 1, created_by: owner.id,
      versions: { create: { version: 1, config, config_digest: canonicalConfigDigest(config) } } } });
    const pool = await db.egressPool.create({ data: { node_id: egress.id, name: `routing-${nonce}`, lb_strategy: 'round',
      targets: { create: { host: 'example.test', port: 443, weight: 1, status: 'active' } } } });
    const native = await db.tunnel.create({ data: { workspace_id: owner.workspace, user_id: owner.id, name: `native-${nonce}`,
      in_node_group_id: local.group.id, out_node_group_id: local.group.id, tunnel_type: 'tcp', forward_protocol: 'tcp',
      category: 'port_forward', tunnel_mode: 'relay', ingress_node_id: ingress.id, egress_node_id: egress.id,
      egress_pool_id: pool.id, listen_port: 26100, forward_addresses: ['example.test:443'], load_balance_type: 'round',
      config_revision: 1, applied_revision: 1, desired_status: 'active', apply_status: 'active' } });
    const tst = await db.tunnel.create({ data: { workspace_id: owner.workspace, user_id: owner.id, name: `tst-${nonce}`,
      in_node_group_id: local.group.id, out_node_group_id: local.group.id, tunnel_type: 'tcp', forward_protocol: 'both',
      category: 'port_forward', tunnel_mode: 'relay', ingress_node_id: ingress.id, egress_node_id: egress.id,
      link_resource_id: link.id, remote_host: 'example.test', remote_port: 443,
      listen_port: 26101, forward_addresses: ['example.test:443'], load_balance_type: 'round',
      config_revision: 1, applied_revision: 1, desired_status: 'active', apply_status: 'active' } });
    await db.workspaceMember.create({ data: { workspace_id: owner.workspace, user_id: viewer.id, role: 'viewer', active: true } });
    const forwardIds = [native.id, tst.id], nodeIds = local.rows.map((n) => n.id), linkIds = [link.id];
    const before = await footprint(owner, forwardIds, nodeIds, linkIds);
    let graph;
    const input = (edgeIds = [`binding:${binding.id}`], forwardId = native.id) => ({ schema_version: 1,
      forward_id: forwardId, expected_revision: 1, topology_digest: graph.digest, strategy: 'priority', hop_limit: 3,
      candidates: [{ id: 'primary', edge_ids: edgeIds, priority: 0, weight: 1 }] });
    await t.test('authentication/default-off, scoped nodes, parallel carriers and unknown business health', async () => {
      assert.equal((await request('/topology')).status, 401);
      process.env.TUNEX_ROUTING_ENABLED = 'false';
      assert.equal((await request('/topology', 'GET', owner)).status, 409);
      const disabledCapabilities = await request('/capabilities', 'GET', owner);
      assert.equal(disabledCapabilities.status, 200); assert.equal((await disabledCapabilities.json()).data.enabled, false);
      process.env.TUNEX_ROUTING_ENABLED = 'true';
      const response = await request('/topology', 'GET', owner);
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      graph = (await response.json()).data;
      assert.equal(graph.workspace_id, owner.workspace); assert.equal(graph.nodes.length, 3); assert.equal(graph.edges.length, 4);
      assert(graph.nodes.every((n) => n.health.state === 'unknown'));
      assert(!graph.edges.some((e) => e.id === `binding:${foreignBinding.id}`));
      assert.deepEqual(graph.forwards.find((f) => f.id === tst.id).current_edge_ids, [`link:${link.id}`]);
      assert.equal(graph.execution_enabled, false);
      const text = JSON.stringify(graph);
      for (const field of ['node_credential_hash', 'config_digest', 'carrier_port', 'private_key']) assert(!text.includes(field));
    });
    await t.test('foreign Workspace resources/headers and viewer use are denied', async () => {
      const foreignGraph = (await (await request('/topology', 'GET', outside)).json()).data;
      assert(!foreignGraph.forwards.some((f) => forwardIds.includes(f.id)));
      assert.equal((await request('/topology', 'GET', outside, undefined, owner.workspace)).status, 404);
      assert.equal((await request('/topology', 'GET', viewer, undefined, owner.workspace)).status, 200);
      assert.equal((await request('/preview', 'POST', viewer, input(), owner.workspace)).status, 403);
      const foreignId = await request('/preview', 'POST', outside, { ...input(), topology_digest: foreignGraph.digest });
      assert.equal(foreignId.status, 404); assert.equal((await foreignId.json()).code, 'forward_not_found');
    });
    await t.test('valid native/TST intents, alternate model path, and unauthorized carrier rejection', async () => {
      for (const body of [input(), input([`link:${link.id}`], tst.id), input([`binding:${hopA.id}`, `binding:${hopB.id}`])]) {
        const response = await request('/preview', 'POST', owner, body);
        assert.equal(response.status, 200);
        const result = (await response.json()).data;
        assert.equal(result.valid, true); assert.equal(result.execution_enabled, false);
        assert.equal(result.candidates[0].health.state, 'unknown');
      }
      const unauthorized = (await (await request('/preview', 'POST', owner, input([`binding:${foreignBinding.id}`]))).json()).data;
      assert.equal(unauthorized.valid, false); assert(unauthorized.candidates[0].reasons.includes('edge_unavailable'));
    });
    await t.test('revision/topology conflicts and malformed input never silently rebase', async () => {
      const stale = await request('/preview', 'POST', owner, { ...input(), expected_revision: 2 });
      assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'revision_conflict');
      const staleGraph = await request('/preview', 'POST', owner, { ...input(), topology_digest: '0'.repeat(64) });
      assert.equal(staleGraph.status, 409); assert.equal((await staleGraph.json()).code, 'topology_conflict');
      assert.equal((await request('/preview', 'POST', owner, { ...input(), workspace_id: outside.workspace })).status, 400);
      assert.equal((await request('/preview', 'POST', owner, { ...input(), padding: 'x'.repeat(40_000) })).status, 413);
    });
    await t.test('bound custom roles do not regain denied node read/use via their base role', async () => {
      const custom = await db.workspaceCustomRole.create({ data: { workspace_id: owner.workspace, created_by_id: owner.id,
        name: `routing-role-${nonce}`, permissions: { 'forward:read': true } } });
      await db.workspaceMember.update({ where: { workspace_id_user_id: { workspace_id: owner.workspace, user_id: viewer.id } },
        data: { role: 'admin', role_id: custom.id } });
      assert.equal((await request('/topology', 'GET', viewer, undefined, owner.workspace)).status, 403);
      await db.workspaceCustomRole.update({ where: { id: custom.id }, data: { permissions: { 'forward:read': true, 'node:read': true } } });
      assert.equal((await request('/topology', 'GET', viewer, undefined, owner.workspace)).status, 200);
      assert.equal((await request('/preview', 'POST', viewer, input(), owner.workspace)).status, 403);
    });
    await t.test('reads and previews leave business revisions, leases, operations and deployments unchanged', async () => {
      assert.deepEqual(await footprint(owner, forwardIds, nodeIds, linkIds), before);
    });
  });
}
