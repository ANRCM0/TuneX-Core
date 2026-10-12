import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';

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
  const { loadRoutingProbePlan } = await import('../src/services/routing-probe.ts');
  const { routingProbeStore, routingProbeKeys } = await import('../src/services/routing-probe-store.ts');
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
    await t.test('persistent policy saves use optimistic versions, scoped write authorization and no business mutations', async () => {
      const body = { schema_version: 1, expected_policy_version: 0, intent: input(), enabled: false,
        auto_failover: true, auto_failback: false, failure_threshold: 2, recovery_threshold: 3, cooldown_ms: 30000,
        max_rtt_ms: 200, max_loss_percent: 20, min_handshake_success_rate: 0.8 };
      process.env.TUNEX_ROUTING_POLICIES_ENABLED = 'false';
      assert.equal((await request(`/policies/${native.id}`, 'PUT', owner, body)).status, 409);
      process.env.TUNEX_ROUTING_POLICIES_ENABLED = 'true';
      // A fresh equivalent Agent report between GET topology and PUT policy
      // must preserve the semantic graph identity and the original CAS intent.
      await db.nodeStateReport.updateMany({ where: { node_id: { in: nodeIds } }, data: { reported_at: new Date() } });
      const refreshed = (await (await request('/topology', 'GET', owner)).json()).data;
      assert.notEqual(refreshed.nodes[0].capabilities.reported_at, graph.nodes[0].capabilities.reported_at);
      assert.equal(refreshed.digest, graph.digest);
      const saved = await request(`/policies/${native.id}`, 'PUT', owner, body);
      assert.equal(saved.status, 200, JSON.stringify(await saved.clone().json()));
      assert.equal((await saved.json()).data.version, 1);
      const concurrent = await Promise.all([1, 2].map(() => request(`/policies/${native.id}`, 'PUT', owner, { ...body, expected_policy_version: 1 })));
      assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
      assert.equal((await request(`/policies/${native.id}`, 'GET', outside)).status, 404);
      assert.equal((await request(`/policies/${native.id}`, 'PUT', viewer, body, owner.workspace)).status, 403);
      const stored = (await (await request(`/policies/${native.id}`, 'GET', owner)).json()).data;
      assert.equal(stored.version, 2); assert.equal(stored.authority_current, true); assert.equal(stored.execution_enabled, false);
      const decision = await request(`/policies/${native.id}/decision`, 'GET', owner);
      assert.equal(decision.status, 200); assert.equal((await decision.json()).data.reason, 'policy_disabled');
      assert.deepEqual(await footprint(owner, forwardIds, nodeIds, linkIds), before);
      const { executeRoutingPolicy, routingDecisionHistory } = await import('../src/services/routing-controller.ts');
      const flags = ['TUNEX_ROUTING_EXECUTION_ENABLED','TUNEX_ROUTING_HOP_AUTH_ENABLED','TUNEX_ROUTING_PROBES_ENABLED'];
      const previous = Object.fromEntries(flags.map((flag)=>[flag,process.env[flag]]));
      const sealBefore=process.env.TUNEX_LINK_SEAL_KEY;
      process.env.TUNEX_LINK_SEAL_KEY=randomBytes(32).toString('hex'); flags.forEach((flag)=>process.env[flag]='true');
      try {
        const row=await db.routingPolicy.update({where:{forward_id:native.id},data:{enabled:true,intent:{...body,enabled:true,expected_policy_version:1}}});
        const concurrent=await Promise.allSettled([executeRoutingPolicy(row),executeRoutingPolicy(row)]);
        assert.equal(concurrent.filter((r)=>r.status==='fulfilled').length,1);
        assert.equal(concurrent.filter((r)=>r.status==='rejected'&&r.reason.code==='policy_version_conflict').length,1);
        const held=await db.routingPolicy.findUnique({where:{id:row.id}});
        assert.equal(held.last_decision.state,'held'); assert.equal(held.state_version,1);
        assert.deepEqual(await footprint(owner,forwardIds,nodeIds,linkIds),before);
        assert.equal((await routingDecisionHistory(owner.workspace,native.id))[0].state,'held');
        assert.equal((await request(`/policies/${native.id}/history`,'GET',outside)).status,404);
        await db.workspaceMember.update({where:{workspace_id_user_id:{workspace_id:owner.workspace,user_id:owner.id}},data:{active:false}});
        await assert.rejects(executeRoutingPolicy(held),(e)=>e.code==='routing_actor_revoked');
        await db.workspaceMember.update({where:{workspace_id_user_id:{workspace_id:owner.workspace,user_id:owner.id}},data:{active:true}});
        const pending={...held.last_decision,decision_id:randomUUID(),state:'pending',desired_revision:2,applied_revision:1,candidate_id:'primary'};
        const waiting=await db.routingPolicy.update({where:{id:row.id},data:{last_decision:pending}});
        await executeRoutingPolicy(waiting);
        assert.equal((await db.routingPolicy.findUnique({where:{id:row.id}})).last_decision.state,'superseded');
        // An exact desired generation without an Agent-confirmed apply must remain pending.
        await db.tunnel.update({where:{id:native.id},data:{config_revision:2,apply_status:'applying'}});
        const uncertain=await db.routingPolicy.update({where:{id:row.id},data:{last_decision:pending}});
        await executeRoutingPolicy(uncertain);
        assert.equal((await db.routingPolicy.findUnique({where:{id:row.id}})).last_decision.state,'pending');
        await db.tunnel.update({where:{id:native.id},data:{applied_revision:2,apply_status:'active'}});
        await executeRoutingPolicy(uncertain);
        const confirmed=await db.routingPolicy.findUnique({where:{id:row.id}});
        assert.equal(confirmed.last_decision.state,'confirmed'); assert.equal(confirmed.last_decision.applied_revision,2);
        assert.equal(confirmed.controller_state.current_candidate_id,'primary');
      } finally {
        await db.workspaceMember.update({where:{workspace_id_user_id:{workspace_id:owner.workspace,user_id:owner.id}},data:{active:true}});
        await db.tunnel.update({where:{id:native.id},data:{config_revision:1,applied_revision:1,apply_status:'active'}});
        for(const flag of flags) {if(previous[flag]===undefined)delete process.env[flag];else process.env[flag]=previous[flag];}
        if(sealBefore===undefined)delete process.env.TUNEX_LINK_SEAL_KEY;else process.env.TUNEX_LINK_SEAL_KEY=sealBefore;
      }
      await db.routingPolicy.deleteMany({ where: { workspace_id: owner.workspace } });
      process.env.TUNEX_ROUTING_POLICIES_ENABLED = 'false';
    });
    await t.test('routing probes have a separate default-off switch and no user supplied targets', async () => {
      const body = { schema_version: 1, forward_id: native.id, expected_revision: 1 };
      process.env.TUNEX_ROUTING_PROBES_ENABLED = 'false';
      assert.equal((await request('/probes', 'POST', owner, body)).status, 409);
      assert.equal((await request(`/probes/${native.id}`, 'GET', owner)).status, 409);
      process.env.TUNEX_ROUTING_PROBES_ENABLED = 'true';
      assert.equal((await request('/probes', 'POST', owner, { ...body, host: '127.0.0.1', port: 1 })).status, 400);
      assert.equal((await request('/probes', 'POST', viewer, body, owner.workspace)).status, 403);
      const unsupported = await request('/probes', 'POST', owner, { ...body, forward_id: tst.id });
      assert.equal(unsupported.status, 409); assert.equal((await unsupported.json()).code, 'probe_capability_unavailable');
      assert.equal((await request(`/probes/${native.id}`, 'GET', outside)).status, 404);
      const missingCap = await request('/probes', 'POST', owner, body);
      assert.equal(missingCap.status, 409); assert.equal((await missingCap.json()).code, 'probe_capability_unavailable');
    });
    await t.test('real native probe planner scopes active targets and returns unknown without a measurement', async () => {
      await db.nodeStateReport.update({ where: { node_id: egress.id }, data: { reported_at: new Date(),
        capabilities: ['apply_tunnel', 'diagnose_tunnel', 'forward.protocol.both.native.v1'],
        capability_manifest: { schema_version: 2, protocols: ['tcp', 'udp', 'both'], transports: ['stream', 'datagram', 'mixed'],
          runtime: [], diagnostics: ['tunnel_probe'] } } });
      const plan = await loadRoutingProbePlan(owner.workspace, native.id);
      assert.equal(plan.nodeId, egress.id); assert.deepEqual(plan.targets, [{ host: 'example.test', port: 443 }]);
      const absent = await request(`/probes/${native.id}`, 'GET', owner);
      assert.equal(absent.status, 200); assert.equal(absent.headers.get('cache-control'), 'no-store');
      assert.equal((await absent.json()).data.state, 'unknown');
      const stale = await request('/probes', 'POST', owner, { schema_version: 1, forward_id: native.id, expected_revision: 2 });
      assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'revision_conflict');
    });
    await t.test('real Redis atomically caps Workspace/node probes and fences an expired writer', async () => {
      const token = randomUUID();
      assert.equal(await routingProbeStore.acquire(owner.workspace, egress.id, token), true);
      assert.equal(await routingProbeStore.acquire(owner.workspace, ingress.id, randomUUID()), false);
      await routingProbeStore.release(owner.workspace, 'foreign-token');
      assert.equal(await redis.exists(routingProbeKeys.busy(owner.workspace)), 1);
      assert(await redis.pttl(routingProbeKeys.busy(owner.workspace)) > 0);
      assert(await redis.pttl(routingProbeKeys.cooldown(owner.workspace, egress.id)) > 0);
      const denied = await request('/probes', 'POST', owner, { schema_version: 1, forward_id: native.id, expected_revision: 1 });
      assert.equal(denied.status, 429); assert.equal(denied.headers.get('retry-after'), '60');
      assert.equal(await routingProbeStore.write(owner.workspace, native.id, '{}', 'foreign-token'), false);
      assert.equal(await routingProbeStore.read(owner.workspace, native.id), null);
      await routingProbeStore.release(owner.workspace, token);
      assert.equal(await redis.exists(routingProbeKeys.busy(owner.workspace)), 0);
      assert.equal(await routingProbeStore.acquire(owner.workspace, egress.id, randomUUID()), false);
      assert.deepEqual(await footprint(owner, forwardIds, nodeIds, linkIds), before);
      process.env.TUNEX_ROUTING_PROBES_ENABLED = 'false';
    });
    await t.test('protected compensation dispatches the immutable baseline at a new authenticated generation', async () => {
      const { attachRoutingHop } = await import('../src/services/routing-runtime.ts');
      const { Orchestrator } = await import('../src/services/orchestrator.ts');
      const { compensateRollout } = await import('../src/services/forward-rollout-exec.ts');
      const { defaultRolloutResumeDeps } = await import('../src/services/forward-rollout-recovery.ts');
      const { markStepCompleted, appendPrepared, readKeySet, readLedger } = await import('../src/services/forward-rollout-state.ts');
      const previousKey = process.env.TUNEX_LINK_SEAL_KEY;
      process.env.TUNEX_LINK_SEAL_KEY = randomBytes(32).toString('hex');
      try {
        for (const row of local.rows) await db.node.update({ where: { id: row.id }, data: { connect_ip: `127.0.0.${row.id}` } });
        await db.nodeStateReport.updateMany({ where: { node_id: { in: nodeIds } }, data: {
          reported_at: new Date(), capabilities: ['apply_tunnel', 'remove_tunnel', 'forward.routing.hop.mtls.v1'] } });
        await db.tunnel.update({ where: { id: native.id }, data: { routing_security_version: 1,
          config_revision: 4, applied_revision: 3, middle_node_id: middle.id, egress_port: 26200, apply_status: 'error' } });
        const baseline = { tunnel_id: native.id, revision: 3, name: native.name, desired_status: 'active',
          mode: 'relay', protocol: 'tcp', ingress_node_id: ingress.id, middle_node_id: null, egress_node_id: egress.id,
          listen_port: 26100, egress_pool_id: pool.id, egress_port: 26200,
          targets: [{ host: 'example.test', port: 443, weight: 3, order_by: 10 }] };
        await db.forwardRevision.create({ data: baseline });
        await db.forwardRevision.create({ data: { ...baseline, revision: 4, middle_node_id: middle.id } });
        const planned = { name: native.name, desired_status: 'active', mode: 'relay', protocol: 'tcp',
          ingress_node_id: ingress.id, middle_node_id: null, egress_node_id: egress.id, listen_ip: null,
          listen_port: 26100, target_host: null, target_port: null, egress_pool_id: pool.id, egress_port: 26200,
          egress_targets: baseline.targets };
        const rollout = await db.forwardRollout.create({ data: { tunnel_id: native.id, revision: 4, base_revision: 3,
          phase: 'compensating', cleaned: [], prepared: [], steps: { desired: { ...planned, middle_node_id: middle.id }, applied: planned } } });
        const completionKey = `protected-${native.id}-egress`;
        const attempts = await Promise.all(Array.from({ length: 4 }, () => markStepCompleted(rollout.id, completionKey, { db })));
        assert.equal(attempts.filter(Boolean).length, 1);
        await markStepCompleted(rollout.id, 'second-step', { db });
        const resource = { kind: 'egress_apply', node_id: egress.id, port: 26200, handle: null };
        await Promise.all([appendPrepared(rollout.id, resource, { db }), appendPrepared(rollout.id, { ...resource, node_id: middle.id }, { db })]);
        const ledger = await db.forwardRollout.findUniqueOrThrow({ where: { id: rollout.id } });
        assert.deepEqual(readKeySet(ledger.cleaned), [completionKey, 'second-step']);
        assert.equal(readLedger(ledger.prepared, []).length, 2);
        assert.deepEqual(new Set(ledger.prepared.map((entry) => entry.node_id)), new Set([egress.id, middle.id]));
        const config = { id: `tunex-${native.id}-relay`, revision: 5, mode: 'RELAY', protocol: 'tcp',
          ingress_port: 26100, egress_port: 0, remote_host: '', remote_port: 0, next_hop: '127.0.0.1:26200',
          targets: [], lb_strategy: 'round', speed_limit: 0 };
        const rejected = (value) => assert.rejects(attachRoutingHop(value, ingress.id),
          (error) => error.code === 'routing_generation_unavailable');
        await rejected(config); // Active compensation alone cannot authorize an absent snapshot.
        await db.forwardRevision.create({ data: { ...baseline, revision: 5,
          targets: [{ host: 'changed.example.test', port: 443, weight: 3, order_by: 10 }] } });
        await rejected(config); // Same path with changed targets is not the immutable baseline.
        await db.forwardRevision.deleteMany({ where: { tunnel_id: native.id, revision: 5 } });
        // Crash boundary: the immutable rollback snapshot exists, the process
        // cache and all confirmed rollback commands are still absent.
        const savedRollback = await db.forwardRevision.create({ data: { ...baseline, revision: 5 } });
        const recoveryDb = defaultRolloutResumeDeps().db;
        const atomicResource = { kind: 'egress_apply', node_id: egress.id, port: 26200, host: `127.0.0.${egress.id}`, handle: null };
        const atomicWrites = await Promise.all(Array.from({ length: 4 }, () =>
          markStepCompleted(rollout.id, 'atomic-resource-step', { db: recoveryDb }, atomicResource)));
        assert.equal(atomicWrites.filter(Boolean).length, 1);
        const atomicLedger = await db.forwardRollout.findUniqueOrThrow({ where: { id: rollout.id } });
        assert.equal(atomicLedger.prepared.filter((item) => item.host === atomicResource.host).length, 1);
        const configs = [], tombstones = new Map();
        const apply = async (node, value) => {
          assert(value.route_auth, 'protected_dispatch_must_not_fall_back_to_plaintext');
          assert(value.revision > (tombstones.get(`${node.id}:${value.id}`) ?? 0));
          configs.push({ node: node.id, value });
          return { ok: true, applied_revision: value.revision };
        };
        const orchestrator = new Orchestrator({ routingConfig: attachRoutingHop, healthSource: async () => [],
          transport: { applyEgress: apply, applyRelay: apply, applyDirect: apply,
            removeTunnel: async (node, id, envelope) => {
              tombstones.set(`${node.id}:${id}`, envelope.revision);
              return { ok: true, applied_revision: envelope.revision };
            } } });
        assert.deepEqual(await compensateRollout(rollout.id, { db: recoveryDb, orchestrator, runtimeUse: async () => null }), { ok: true });
        assert.equal((await db.forwardRevision.findFirstOrThrow({ where: { tunnel_id: native.id, revision: 5 } })).id, savedRollback.id);
        assert.deepEqual(configs.map((item) => item.node), [egress.id, ingress.id]);
        assert(configs.every((item) => item.value.revision === 5 && item.value.route_auth.revision === 5));
        assert.deepEqual(configs[0].value.route_auth.node_ids, [ingress.id, egress.id]);
        assert.equal(configs[0].value.route_auth.incoming.ca_pem, configs[1].value.route_auth.outgoing.ca_pem);
        const restored = await db.tunnel.findUniqueOrThrow({ where: { id: native.id } });
        assert.equal(restored.config_revision, 5); assert.equal(restored.applied_revision, 5);
        assert.equal(restored.middle_node_id, null); assert.equal(restored.routing_security_version, 1);
        assert.equal((await db.forwardRollout.findUniqueOrThrow({ where: { id: rollout.id } })).compensated, true);
        await db.forwardRollout.update({ where: { id: rollout.id }, data: { phase: 'compensating', compensated: false } });
        const beforeFinalization = configs.length;
        assert.deepEqual(await compensateRollout(rollout.id, { db: recoveryDb, orchestrator, runtimeUse: async () => null }), { ok: true });
        assert.equal(configs.length, beforeFinalization);
        assert.equal((await db.forwardRollout.findUniqueOrThrow({ where: { id: rollout.id } })).compensated, true);
        await rejected({ ...config, revision: 4 }); // Historical and future snapshots remain fenced.
        await rejected({ ...config, revision: 6 });
        await assert.rejects(attachRoutingHop(config, middle.id), (error) => error.code === 'routing_generation_unavailable');
        await db.nodeBinding.delete({ where: { id: binding.id } });
        await rejected(config); // Reusing sealed identities cannot bypass revoked adjacency.
      } finally {
        if (previousKey === undefined) delete process.env.TUNEX_LINK_SEAL_KEY;
        else process.env.TUNEX_LINK_SEAL_KEY = previousKey;
      }
    });
  });
}
