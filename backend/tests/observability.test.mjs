import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';

if (process.env.TUNEX_DB_TEST !== '1') {
  test('V2.4 unified metrics HTTP/DB acceptance requires TUNEX_DB_TEST=1', { skip: true }, () => {});
} else {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert(url.protocol === 'mysql:' && ['127.0.0.1', 'localhost'].includes(url.hostname)
    && ['/tunex_ci', '/tunex_v23_test'].includes(url.pathname), 'isolated_metrics_database_required');
  process.env.PAYMENTS_ENABLED = 'false';
  const { app } = await import('../src/app.ts');
  const { db } = await import('../src/db.ts');
  const { redis } = await import('../src/redis.ts');
  const { signAccessToken } = await import('../src/auth.ts');
  const { metricWindow } = await import('../src/domain/observability/model.ts');
  const nonce = randomUUID(), created = { users: [], workspaces: [], groups: [], nodes: [], forwards: [], links: [], roles: [] };
  let ip = 0;
  async function actor(label) {
    const user = await db.user.create({ data: { email: `metrics-${label}-${nonce}@example.test`, status: 'active' } });
    created.users.push(user.id);
    const ws = await db.workspace.create({ data: { slug: `metrics-${nonce}-${label}`, name: 'metrics fixture', kind: 'personal',
      personal_user_id: user.id, created_by_id: user.id, members: { create: { user_id: user.id, role: 'owner' } } } });
    created.workspaces.push(ws.id);
    return { id: user.id, workspace: ws.id, cookie: `access=${await signAccessToken({ userId: user.id, email: user.email, superAdmin: false })}` };
  }
  async function groupAndNodes(owner, count) {
    const group = await db.nodeGroup.create({ data: { name: `metrics-${nonce}-${owner.id}`, node_type: 'in', user_id: owner.id, workspace_id: owner.workspace } });
    created.groups.push(group.id);
    const nodes = [];
    for (let index = 0; index < count; index++) {
      const node = await db.node.create({ data: { node_id: `private-node-${nonce}-${owner.id}-${index}`, node_group_id: group.id,
        role: 'both', lifecycle: 'active', status: 'active', last_seen_at: new Date(),
        node_credential_hash: createHash('sha256').update(randomUUID()).digest('hex'),
        state_report: { create: { reported_at: new Date(), runtime_counts: { total: 0 }, error_count: 0, tunnels: [] } } } });
      created.nodes.push(node.id); nodes.push(node);
    }
    return { group, nodes };
  }
  async function forward(owner, group, node, extra = {}) {
    const row = await db.tunnel.create({ data: { workspace_id: owner.workspace, user_id: owner.id, name: `metrics-${nonce}-${created.forwards.length}`,
      in_node_group_id: group.id, out_node_group_id: group.id, category: 'port_forward', tunnel_type: 'tcp', forward_protocol: 'tcp',
      tunnel_mode: 'direct', ingress_node_id: node.id, listen_port: 25001 + created.forwards.length,
      remote_host: 'private-target.example.test', remote_port: 443, forward_addresses: ['private-target.example.test:443'], load_balance_type: 'round',
      config_revision: 3, applied_revision: 3, apply_status: 'active', desired_status: 'active', traffic: 999999, ...extra } });
    created.forwards.push(row.id); return row;
  }
  const request = (path, who, workspace = who?.workspace, method = 'GET') => app.request(`http://localhost/api/observability${path}`, {
    method, headers: { 'x-forwarded-for': `198.51.100.${++ip}`, ...(who ? { cookie: who.cookie } : {}),
      ...(workspace ? { 'x-workspace-id': String(workspace) } : {}) } });
  after(async () => {
    try {
      await db.targetObservation.deleteMany({ where: { node_id: { in: created.nodes } } });
      await db.linkTrafficCheckpoint.deleteMany({ where: { workspace_id: { in: created.workspaces } } });
      await db.tunnelTraffic.deleteMany({ where: { workspace_id: { in: created.workspaces } } });
      await db.tunnel.deleteMany({ where: { id: { in: created.forwards } } });
      await db.linkPlacement.deleteMany({ where: { deployment: { link_id: { in: created.links } } } });
      await db.linkDeployment.deleteMany({ where: { link_id: { in: created.links } } });
      await db.linkResource.deleteMany({ where: { id: { in: created.links } } });
      await db.node.deleteMany({ where: { id: { in: created.nodes } } });
      await db.nodeGroup.deleteMany({ where: { id: { in: created.groups } } });
      await db.workspaceMember.deleteMany({ where: { workspace_id: { in: created.workspaces } } });
      await db.workspaceCustomRole.deleteMany({ where: { id: { in: created.roles } } });
      await db.workspace.deleteMany({ where: { id: { in: created.workspaces } } });
      await db.user.deleteMany({ where: { id: { in: created.users } } });
    } finally { redis.disconnect(); await db.$disconnect(); }
  });

  test('V2.4 metrics use real authentication, scoped durable ledgers and a read-only projection', async (t) => {
    const owner = await actor('owner'), foreign = await actor('foreign'), viewer = await actor('viewer');
    const local = await groupAndNodes(owner, 2), outside = await groupAndNodes(foreign, 1);
    await db.workspaceMember.create({ data: { workspace_id: owner.workspace, user_id: viewer.id, role: 'viewer' } });
    const native = await forward(owner, local.group, local.nodes[0]);
    const historical = await forward(owner, local.group, local.nodes[0]);
    const foreignForward = await forward(foreign, outside.group, outside.nodes[0]);
    const link = await db.linkResource.create({ data: { workspace_id: owner.workspace, name: `metrics-${nonce}`, created_by: owner.id,
      carrier: 'tst_v1', status: 'active', generation: 1 } });
    created.links.push(link.id);
    const tst = await forward(owner, local.group, local.nodes[0], { tunnel_mode: 'relay', egress_node_id: local.nodes[1].id, link_resource_id: link.id });
    const lease = new Date(Date.now() + 600000), digest = 'ab'.repeat(32);
    await db.linkDeployment.create({ data: { link_id: link.id, generation: 1, version: 1, status: 'active', binding_snapshot: {}, lease_expires_at: lease,
      placements: { create: local.nodes.map((node, index) => ({ node_id: node.id, role: index === 0 ? 'ingress' : 'egress', generation: 1,
        runtime_id: `tunex-tst-${link.id}-${index === 0 ? 'ingress' : 'egress'}`, config_digest: digest })) } } });
    for (const [index, node] of local.nodes.entries()) {
      const role = index === 0 ? 'ingress' : 'egress';
      await db.nodeStateReport.update({ where: { node_id: node.id }, data: { reported_at: new Date(),
        last_error: 'private-error-token', hostname: 'private-hostname',
        tunnels: index === 0 ? [{ id: `tunex-${native.id}-direct`, revision: 3, remote_host: 'private-target.example.test', diag: { last_handshake_error: 'private-diag-secret' } }] : [],
        link_placements: [{ id: `tunex-tst-${link.id}-${role}`, link_id: link.id, workspace_id: owner.workspace, node_id: node.id, role,
          generation: 1, observed_generation: 1, config_digest: digest, desired_config_digest: digest, ready: true, state: 'ready',
          lease_expires_at: lease.toISOString(), ports: [], runtime_ids: [] }] } });
    }
    const day = metricWindow().end_date, date = new Date(`${day}T00:00:00Z`);
    await db.tunnelTraffic.createMany({ data: [
      { tunnel_id: native.id, workspace_id: owner.workspace, date, traffic: 100, traffic_cost: 150 },
      { tunnel_id: historical.id, workspace_id: owner.workspace, date, traffic: 400, traffic_cost: 600 },
      { tunnel_id: foreignForward.id, workspace_id: foreign.workspace, date, traffic: 10000, traffic_cost: 10000 },
      { tunnel_id: native.id, workspace_id: owner.workspace, date: new Date('2020-01-01'), traffic: 10000, traffic_cost: 10000 },
    ] });
    await db.tunnel.delete({ where: { id: historical.id } });
    const big = 9007199254740993n;
    await db.linkTrafficCheckpoint.createMany({ data: [1, 2].map((n) => ({ node_id: local.nodes[0].id, producer_id: String(n).padStart(32, '0'),
      forward_id: tst.id, date, link_id: link.id, workspace_id: owner.workspace, generation: 1, config_digest: digest,
      bytes_in: big, bytes_out: 20n, connections: 3n })) });
    await db.targetObservation.create({ data: { node_id: local.nodes[0].id, target_key: 'private-target.example.test:443',
      host: 'private-target.example.test', port: 443, reachable: true, latency_ms: 12,
      observed_at: new Date(), reported_at: new Date(), observation_source: 'private-node/tcp_connect' } });
    await db.targetObservation.create({ data: { node_id: local.nodes[0].id, target_key: 'private-unbound.example.test:443',
      host: 'private-unbound.example.test', port: 443, reachable: true, latency_ms: 999,
      observed_at: new Date(), reported_at: new Date(), observation_source: 'private-node/tcp_connect' } });

    await t.test('authentication and default-off discovery', async () => {
      const anonymous = await request('/snapshot');
      assert.equal(anonymous.status, 401); assert.equal(anonymous.headers.get('cache-control'), 'no-store');
      assert.equal((await request('/history')).status, 401);
      process.env.TUNEX_OBSERVABILITY_ENABLED = 'false';
      const blocked = await request('/snapshot', owner); assert.equal(blocked.status, 409);
      assert.equal((await request('/history', owner)).status, 409);
      assert.equal(blocked.headers.get('cache-control'), 'no-store');
      assert.equal((await (await request('/capabilities', owner)).json()).data.enabled, false);
      process.env.TUNEX_OBSERVABILITY_ENABLED = 'true';
    });
    let view;
    await t.test('daily durable history preserves dates, gaps, zero, exact ingress counters and immutable resource identity', async () => {
      const start = new Date(date.getTime() - 2 * 86400000).toISOString().slice(0, 10);
      const period = `start_date=${start}&end_date=${day}`;
      await db.tunnelTraffic.create({ data: { tunnel_id: native.id, workspace_id: owner.workspace, date: new Date(start), traffic: 0, traffic_cost: 0 } });
      const read = async (selection = '') => {
        const response = await request(`/history?${period}${selection}`, viewer, owner.workspace);
        assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
        assert.equal(response.headers.get('cache-control'), 'no-store');
        return (await response.json()).data;
      };
      const history = await read();
      assert.equal(history.days.length, 3);
      assert.equal(history.days[0].usage.archive.bytes.value, '0');
      assert.equal(history.days[1].usage.archive.bytes.value, null);
      assert.equal(history.days[2].usage.archive.bytes.value, '500');
      assert.equal(history.days[2].usage.tst_ingress.bytes_in.value, String(big * 2n));
      assert.equal(history.totals.archive.bytes.value, '500');
      assert.equal(history.totals.archive.rows, 3);
      assert.equal((await read(`&scope=forward&id=${native.id}`)).totals.archive.bytes.value, '100');
      assert.equal((await read(`&scope=forward&id=${tst.id}`)).totals.tst_ingress.bytes_in.value, String(big * 2n));
      for (const scope of [`&scope=link&id=${link.id}`, `&scope=node&id=${local.nodes[0].id}`]) {
        const result = await read(scope);
        assert.equal(result.archive_scope, 'not_attributed');
        assert.equal(result.days[2].usage.archive.bytes.value, null);
        assert.equal(result.days[2].usage.archive.bytes.freshness.reason, 'archive_not_attributed');
        assert.equal(result.totals.tst_ingress.bytes_in.value, String(big * 2n));
      }
      assert.equal((await read(`&scope=node&id=${local.nodes[1].id}`)).totals.tst_ingress.bytes_in.value, null);
      for (const id of [foreignForward.id, historical.id, 2147483647])
        assert.equal((await request(`/history?${period}&scope=forward&id=${id}`, owner)).status, 404);
      assert.equal((await request(`/history?${period}&scope=node&id=${outside.nodes[0].id}`, owner)).status, 404);
      assert.equal((await request(`/history?${period}&scope=link&id=2147483647`, owner)).status, 404);
      await db.tunnel.update({ where: { id: tst.id }, data: { ingress_node_id: local.nodes[1].id } });
      try {
        assert.equal((await read(`&scope=node&id=${local.nodes[0].id}`)).totals.tst_ingress.bytes_in.value, String(big * 2n));
        assert.equal((await read(`&scope=node&id=${local.nodes[1].id}`)).totals.tst_ingress.bytes_in.value, null);
      } finally { await db.tunnel.update({ where: { id: tst.id }, data: { ingress_node_id: local.nodes[0].id } }); }
      assert(!JSON.stringify(history).includes('private-')); assert(!JSON.stringify(history).includes('config_digest'));
    });
    await t.test('four dimensions, immutable archive attribution, precise ingress-only counts and authorized target latency', async () => {
      const response = await request('/snapshot', viewer, owner.workspace);
      assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
      assert.equal(response.headers.get('cache-control'), 'no-store');
      view = (await response.json()).data;
      assert.equal(view.workspace_id, owner.workspace); assert.equal(view.nodes.length, 2); assert.equal(view.forwards.length, 2);
      assert.equal(view.workspace.usage.archive.bytes.value, '500');
      assert.equal(view.workspace.usage.archive.cost_bytes.value, '750');
      assert.equal(view.workspace.usage.archive.bytes.freshness.state, 'historical');
      assert.equal(view.workspace.usage.tst_ingress.bytes_in.value, String(2n * big));
      assert.equal(view.links[0].usage.tst_ingress.connections.value, '6');
      assert.equal(view.nodes.find((n) => n.id === local.nodes[0].id).usage.tst_ingress.bytes_out.value, '40');
      assert.equal(view.nodes.find((n) => n.id === local.nodes[1].id).usage.tst_ingress.bytes_out.value, null);
      assert(view.links[0].placements.every((p) => p.ready === true));
      const f = view.forwards.find((f) => f.id === native.id);
      assert.equal(f.usage.archive.bytes.value, '100'); assert.equal(f.runtimes[0].state, 'reported');
      assert.equal(f.target_observations.length, 1); assert.equal(f.target_observations[0].latency_ms.value, '12');
      assert.equal(view.workspace.active_connections.value, null);
      assert(!JSON.stringify(view).includes('private-')); assert(!JSON.stringify(view).includes('config_digest'));
      assert(!view.forwards.some((f) => f.id === historical.id || f.id === foreignForward.id));
    });
    await t.test('foreign Workspace membership and custom role denials', async () => {
      assert.equal((await request('/snapshot', foreign, owner.workspace)).status, 404);
      assert.equal((await request('/history', foreign, owner.workspace)).status, 404);
      const role = await db.workspaceCustomRole.create({ data: { workspace_id: owner.workspace, created_by_id: owner.id,
        name: `metrics-${nonce}`, permissions: { 'forward:read': true } } }); created.roles.push(role.id);
      await db.workspaceMember.update({ where: { workspace_id_user_id: { workspace_id: owner.workspace, user_id: viewer.id } }, data: { role: 'admin', role_id: role.id } });
      assert.equal((await request('/snapshot', viewer, owner.workspace)).status, 403);
      assert.equal((await request('/history', viewer, owner.workspace)).status, 403);
      await db.workspaceCustomRole.update({ where: { id: role.id }, data: { permissions: { 'node:read': true } } });
      assert.equal((await request('/capabilities', viewer, owner.workspace)).status, 403);
      await db.workspaceCustomRole.update({ where: { id: role.id }, data: { permissions: { 'node:read': true, 'forward:read': true } } });
      assert.equal((await request('/snapshot', viewer, owner.workspace)).status, 200);
      assert.equal((await request('/history', viewer, owner.workspace)).status, 200);
    });
    await t.test('invalid query, period boundary and unsupported methods', async () => {
      for (const query of ['workspace_id=999', 'start_date=2026-02-30', 'start_date=2026-01-01&end_date=2026-02-01', 'end_date=2026-01-01&end_date=2026-01-02'])
        assert.equal((await request(`/snapshot?${query}`, owner)).status, 400);
      const empty = await request('/snapshot?start_date=2020-01-02&end_date=2020-01-02', owner);
      for (const query of ['scope=forward', 'scope=workspace&id=1', 'scope=node&id=1&id=2', 'scope=link&id=0', 'workspace_id=999'])
        assert.equal((await request(`/history?${query}`, owner)).status, 400);
      assert.equal(empty.status, 200); assert.equal((await empty.json()).data.workspace.usage.archive.bytes.value, null);
      assert.equal((await request('/snapshot', owner, owner.workspace, 'PUT')).status, 403); // Global CSRF blocks cookie writes first.
    });
    await t.test('credential rotation and old reports invalidate runtime facts without discarding historical counters', async () => {
      await db.node.update({ where: { id: local.nodes[0].id }, data: { credential_rotated_at: new Date() } });
      const result = (await (await request('/snapshot', owner)).json()).data;
      assert.equal(result.nodes[0].report.reason, 'credential_epoch_changed');
      assert.equal(result.forwards.find((f) => f.id === native.id).runtimes[0].state, 'stale');
      assert.equal(result.links[0].placements.find((p) => p.node_id === local.nodes[0].id).ready, null);
      assert.equal(result.forwards.find((f) => f.id === native.id).target_observations[0].freshness.state, 'stale');
      assert.equal(result.workspace.usage.tst_ingress.bytes_in.value, String(big * 2n));
    });
    await t.test('repeated reads leave desired state, reports, ledgers, leases and commands unchanged', async () => {
      const footprint = async () => ({
        forwards: await db.tunnel.findMany({ where: { id: { in: created.forwards } }, orderBy: { id: 'asc' }, select: { id: true, updated_at: true, config_revision: true } }),
        reports: await db.nodeStateReport.findMany({ where: { node_id: { in: created.nodes } }, orderBy: { node_id: 'asc' }, select: { node_id: true, updated_at: true, reported_at: true } }),
        usage: await db.linkTrafficCheckpoint.findMany({ where: { workspace_id: owner.workspace }, orderBy: { id: 'asc' } }),
        archives: await db.tunnelTraffic.findMany({ where: { workspace_id: owner.workspace }, orderBy: { id: 'asc' } }),
        leases: await db.nodePortLease.count({ where: { node_id: { in: created.nodes } } }),
        operations: await db.forwardOperation.count({ where: { workspace_id: owner.workspace } }),
        deployments: await db.linkDeployment.findMany({ where: { link_id: link.id }, select: { id: true, updated_at: true, generation: true, lease_expires_at: true } }),
      });
      const before = await footprint();
      for (let i = 0; i < 3; i++) {
        assert.equal((await request('/snapshot', owner)).status, 200);
        assert.equal((await request('/history', owner)).status, 200);
      }
      assert.deepEqual(await footprint(), before);
    });
  });
}
