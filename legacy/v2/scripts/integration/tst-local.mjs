#!/usr/bin/env node
// Portable acceptance against isolated, migrated MySQL/Redis services.
// All Panel, Worker and Agent processes run actual production source.
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import dgram from 'node:dgram';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const database = new URL(process.env.DATABASE_URL ?? '');
assert(database.protocol === 'mysql:' && ['127.0.0.1', 'localhost'].includes(database.hostname)
  && database.pathname === '/tunex_v2_e2e', 'isolated_e2e_database_required');
const redis = new URL(process.env.REDIS_URL ?? '');
assert(redis.protocol === 'redis:' && ['127.0.0.1', 'localhost'].includes(redis.hostname), 'isolated_redis_required');
const work = await mkdtemp(resolve(tmpdir(), 'tunex-v2-network-'));
const privateFixture = resolve(work, 'fixture.json');
const bun = process.env.TUNEX_BUN ?? resolve(root, 'backend/node_modules/bun/bin', process.platform === 'win32' ? 'bun.exe' : 'bun');
const children = new Set();
const diagnostics = new WeakMap();
const connections = new Set();
const servers = [];
const rules = new Set();
const results = [];
const keep = process.argv.includes('--keep');
const keepFailure = process.argv.includes('--keep-on-failure');
let fixture, cookie, base, agentBin, environment;
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
function start(command, args, cwd, env = environment) {
  // Keep raw ORM/config/credential-bearing logs out of evidence and terminal.
  const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  function capture(chunk) { output = (output + chunk.toString()).slice(-65536); }
  child.stdout.on('data', capture); child.stderr.on('data', capture);
  diagnostics.set(child, () => [...new Set(output.match(/\b(?:P[0-9]{4}|PrismaClient\w*Error|TypeError|SyntaxError|Error|isolated_\w+_required)\b/g) ?? [])].join('_'));
  children.add(child);
  child.once('exit', () => children.delete(child));
  child.once('error', () => {});
  return child;
}
async function run(command, args, cwd, env = environment) {
  const child = start(command, args, cwd, env);
  await new Promise((done, reject) => {
    child.once('error', () => reject(new Error('tool_start_failed')));
    child.once('exit', (code) => code === 0 ? done() : reject(new Error(`tool_exit_${code}_${args[0].replace(/[^a-z_0-9]/gi, '_')}_${diagnostics.get(child)()}`)));
  });
}
async function freePort() {
  const server = net.createServer();
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}
async function until(fn, label, timeout = 90000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try { const value = await fn(); if (value) return value; } catch (error) { last = error; }
    await delay(250);
  }
  throw new Error(`${label}_timeout${last?.message?.match(/^[a-z_0-9]+$/) ? ':' + last.message : ''}`);
}
function check(condition, label) {
  assert(condition, label);
  results.push({ pass: true, label });
  console.log('PASS ' + label);
}
async function response(method, path, body, scope = fixture?.workspace_id, session = cookie) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json',
    'X-CSRF-Token': '1', ...(session ? { Cookie: session } : {}), ...(scope ? { 'x-workspace-id': String(scope) } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(40000) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  return { status: res.status, data: data.data ?? data, code: data.code, res };
}
async function api(method, path, body) {
  const r = await response(method, path, body);
  if (![200, 201, 202].includes(r.status)) {
    const endpoint = path.replace(/[^a-z_0-9]/gi, '_');
    throw new Error(`api_${method}_${endpoint}_${r.status}_${/^[a-z_0-9]+$/.test(r.code) ? r.code : 'failed'}`);
  }
  return r.data;
}
const body = (name, port, transport = 'tst_v1', path = 'relay', protocol = 'both') => ({
  idempotency_key: randomUUID(), name, path, transport, protocol, ingress_node_id: fixture.ingress.id,
  ...(path === 'relay' ? { egress_node_id: fixture.egress.id } : {}),
  listen_port: port, target_host: '127.0.0.1', target_port: servers[0].port, transport_options: { selection: 'auto' },
});
async function deployed(receipt) {
  let state;
  try { return await until(async () => {
    const operation = await api('GET', '/api/forward-operations/' + receipt.operation_id);
    state = { operation: operation.state, error: operation.error_code };
    if (operation.state === 'failed') throw new Error(operation.error_code ?? 'operation_failed');
    if (!operation.forward_id) return null;
    rules.add(operation.forward_id);
    const detail = await api('GET', '/api/forwards/' + operation.forward_id);
    state.deployment = detail.lifecycle?.deployment;
    state.apply = detail.apply_status;
    return operation.state === 'completed' && detail.lifecycle?.deployment === 'confirmed' ? detail : null;
  }, 'deployment'); } catch (error) {
    const codes = Object.values(state ?? {}).filter((value) => typeof value === 'string' && /^[a-z_0-9]+$/.test(value));
    throw new Error(`${error.message}_${codes.join('_')}`);
  }
}
function startAgent(node, role) {
  const env = { ...environment, TUNEX_AGENT_ID: node.agent_id, TUNEX_NODE_ID: node.name,
    TUNEX_NODE_CREDENTIAL: node.node_credential, TUNEX_LISTEN_IP: node.connect_ip, TUNEX_ROLE: role,
    TUNEX_PANEL_HTTP_URL: base, TUNEX_STATE_DIR: resolve(work, role), TUNEX_AGENT_ADMIN_PORT: '0',
    TUNEX_INGRESS_RANGE: '25000-25299', TUNEX_EGRESS_RANGE: '25000-25299' };
  return start(agentBin, [], root, env);
}
async function echo() {
  const tcp = net.createServer((socket) => {
    connections.add(socket); socket.once('close', () => connections.delete(socket));
    socket.on('error', () => {}); socket.pipe(socket);
  });
  await new Promise((done) => tcp.listen(0, '127.0.0.1', done));
  const port = tcp.address().port;
  const udp = dgram.createSocket('udp4');
  udp.on('message', (data, remote) => udp.send(data, remote.port, remote.address));
  await new Promise((done) => udp.bind(port, '127.0.0.1', done));
  const server = { tcp, udp, port }; servers.push(server); return server;
}
async function connect(port, host = '127.0.0.2') {
  return new Promise((done, reject) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(5000, () => socket.destroy(new Error('socket_timeout')));
    socket.once('error', reject);
    socket.once('connect', () => {
      socket.setTimeout(0); socket.on('error', () => {});
      connections.add(socket); socket.once('close', () => connections.delete(socket)); done(socket);
    });
  });
}
async function tcpPayload(socket, payload) {
  const expected = Buffer.from(payload);
  await new Promise((done, reject) => {
    let result = Buffer.alloc(0);
    const timer = setTimeout(() => { cleanup(); reject(new Error('payload_timeout')); }, 5000);
    function read(data) {
      result = Buffer.concat([result, data]);
      if (result.length >= expected.length) { cleanup(); result.equals(expected) ? done() : reject(new Error('payload_mismatch')); }
    }
    function error() { cleanup(); reject(new Error('payload_socket_closed')); }
    function cleanup() { clearTimeout(timer); socket.off('data', read); socket.off('error', error); socket.off('close', error); }
    socket.on('data', read); socket.once('error', error); socket.once('close', error); socket.write(expected);
  });
}
async function udpPayload(socket, port, payload) {
  await new Promise((done, reject) => {
    const timer = setTimeout(() => { socket.off('message', read); reject(new Error('udp_timeout')); }, 5000);
    function read(data) { clearTimeout(timer); data.equals(Buffer.from(payload)) ? done() : reject(new Error('udp_payload_mismatch')); }
    socket.once('message', read); socket.send(Buffer.from(payload), port, '127.0.0.2');
  });
}
async function closed(port, host) {
  try { const socket = await connect(port, host); socket.destroy(); return false; } catch { return true; }
}
async function udpReleased(port) {
  const socket = dgram.createSocket('udp4');
  try {
    await new Promise((done, reject) => { socket.once('error', reject); socket.bind(port, '127.0.0.2', done); });
    return true;
  } catch { return false; } finally { socket.close(); }
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  const ended = new Promise((done) => child.once('exit', done));
  child.kill(); await Promise.race([ended, delay(5000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
try {
  const port = process.env.TUNEX_TEST_PANEL_PORT ? Number(process.env.TUNEX_TEST_PANEL_PORT) : await freePort();
  assert(Number.isInteger(port) && port > 0 && port <= 65535, 'invalid_test_panel_port');
  base = `http://127.0.0.1:${port}`;
  environment = { ...process.env, NODE_ENV: 'development', PORT: String(port), SITE_URL: base,
    COOKIE_SECURE: 'false', RATE_LIMIT_ENABLED: 'false', AUDIT_LOG_ENABLED: 'false',
    AUTH_SECRET: randomBytes(32).toString('hex'), TUNEX_LINK_SEAL_KEY: randomBytes(32).toString('hex'), // secret-scan:allow -- generated private fixture values
    TUNEX_TST_ENABLED: 'true', FORWARD_NATIVE_BOTH_ENABLED: 'true', PAYMENTS_ENABLED: 'false',
    TUNEX_V2_FIXTURE_FILE: privateFixture };
  await run(bun, ['tests/tst-real-fixture.ts'], resolve(root, 'backend'));
  fixture = JSON.parse(await readFile(privateFixture, 'utf8'));
  await mkdir(resolve(work, 'INGRESS'), { mode: 0o700 }); await mkdir(resolve(work, 'EGRESS'), { mode: 0o700 });
  agentBin = resolve(work, process.platform === 'win32' ? 'tunex-agent.exe' : 'tunex-agent');
  await run('go', ['build', '-buildvcs=false', '-ldflags=-X main.version=2.0.0-local', '-o', agentBin, '.'],
    resolve(root, 'agent'), { ...environment, GOARCH: 'amd64', CGO_ENABLED: '0' });
  let panel = start(bun, ['src/index.ts'], resolve(root, 'backend'));
  start(bun, ['src/worker.ts'], resolve(root, 'backend'));
  await until(async () => (await fetch(base + '/readyz')).ok, 'panel');
  if (keep) console.log(`Local Panel: ${base}; private fixture: ${privateFixture}`);
  let ingress = startAgent(fixture.ingress, 'INGRESS'); startAgent(fixture.egress, 'EGRESS');
  await echo(); await echo();
  const login = await response('POST', '/api/auth/login', fixture.member, null, null);
  assert.equal(login.status, 200, 'fixture_login'); cookie = login.res.headers.get('set-cookie').split(';')[0];
  await until(async () => {
    const caps = await api('GET', '/api/forwards/capabilities');
    return caps.combinations?.find((c) => c.transport === 'tst_v1' && c.protocol === 'both')?.available;
  }, 'agent_capability');
  check(true, 'real_agents_advertise_tst_and_native_both');
  const manual = await response('POST', '/api/links', { name: 'forbidden manual resource',
    ingress_node_id: fixture.ingress.id, egress_node_id: fixture.egress.id, carrier_port: 25299 });
  check(manual.status === 403, 'ordinary_forward_member_needs_no_node_manage');
  const input = body('TST real A', 25080);
  const receipts = await Promise.all([api('POST', '/api/forward-operations', input), api('POST', '/api/forward-operations', input)]);
  check(receipts[0].operation_id === receipts[1].operation_id, 'concurrent_create_has_one_durable_operation');
  let a = await deployed(receipts[0]);
  const conflict = await response('POST', '/api/forward-operations', { ...input, name: 'different request' });
  check(conflict.status === 409 && conflict.code === 'idempotency_conflict', 'same_key_different_request_conflicts');
  const foreign = await response('GET', '/api/forwards/' + a.id, undefined, fixture.workspace_id + 100000);
  check([403, 404].includes(foreign.status), 'foreign_workspace_cannot_read_forward');
  const b = await deployed(await api('POST', '/api/forward-operations', body('TST real B', 25081)));
  check(a.link_resource_id != null && a.link_resource_id === b.link_resource_id, 'two_forwards_reuse_one_automatic_link');
  check(!/PRIVATE KEY|certificate_pem|private_key_pem|transport_config|key_ciphertext/.test(JSON.stringify([a, b, receipts])), 'public_dtos_exclude_transport_secrets');
  const held = await connect(25081); const mapping = dgram.createSocket('udp4');
  servers.push({ udp: mapping });
  await tcpPayload(held, 'held-B'); await udpPayload(mapping, 25081, 'UDP-B');
  const other = await connect(25080); await tcpPayload(other, 'A'); other.destroy();
  check(true, 'tcp_udp_both_payloads_cross_actual_mtls_carrier');
  await until(async () => (await api('GET', '/api/forwards/' + a.id)).lifecycle?.runtime === 'ready', 'fresh_runtime_report');
  const diagnosis = await api('POST', '/api/forwards/' + a.id + '/diagnose');
  if (!diagnosis.segments?.some((s) => s.segment === 'egress_to_target' && s.verified && s.outcome === 'ok')) {
    const target = diagnosis.segments?.find((s) => s.segment === 'egress_to_target');
    const code = [target?.outcome, target?.error_code].filter((v) => typeof v === 'string' && /^[a-z_0-9]+$/.test(v)).join('_');
    throw new Error(`diagnosis_${code || 'unknown'}`);
  }
  check(diagnosis.segments?.some((s) => s.segment === 'egress_to_target' && s.verified && s.outcome === 'ok')
    && diagnosis.segments?.some((s) => s.segment === 'ingress_to_egress' && !s.verified), 'diagnosis_uses_authorized_target_and_distinguishes_carrier_facts');
  await until(async () => {
    const traffic = (await api('GET', '/api/forwards/' + b.id)).lifecycle?.traffic;
    return traffic && BigInt(traffic.bytes_in) > 0n && BigInt(traffic.bytes_out) > 0n;
  }, 'traffic');
  check(true, 'actual_agent_usage_is_acknowledged_and_visible_per_forward');
  await api('PATCH', '/api/forwards/' + a.id, { expected_revision: a.config_revision, target_port: servers[1].port });
  await tcpPayload(held, 'B-after-edit'); await udpPayload(mapping, 25081, 'B-mapping-after-edit');
  check(true, 'editing_A_preserves_B_tcp_and_udp_mapping');
  const stale = await response('PATCH', '/api/forwards/' + a.id, { expected_revision: a.config_revision, target_port: servers[0].port });
  check(stale.status === 409, 'stale_revision_edit_is_rejected');
  await api('POST', '/api/forwards/' + a.id + '/actions', { action: 'suspend' });
  await until(() => closed(25080), 'suspend'); await tcpPayload(held, 'B-after-suspend');
  check(true, 'suspension_closes_A_and_preserves_B');
  await api('POST', '/api/forwards/' + a.id + '/actions', { action: 'resume' });
  await until(async () => !(await closed(25080)), 'resume');
  await api('POST', '/api/forwards/' + a.id + '/actions', { action: 'delete' }); rules.delete(a.id);
  check(await closed(25080), 'deletion_confirms_A_listener_removed');
  await tcpPayload(held, 'B-after-delete'); check(true, 'deleting_A_preserves_held_B');
  held.destroy(); await stop(ingress); ingress = startAgent(fixture.ingress, 'INGRESS');
  await until(async () => !(await closed(25081)), 'agent_restart');
  const restored = await connect(25081); await tcpPayload(restored, 'B-restored'); restored.destroy();
  check(true, 'agent_restart_recovers_authorized_forward');
  await stop(panel); panel = start(bun, ['src/index.ts'], resolve(root, 'backend'));
  await until(async () => (await fetch(base + '/readyz')).ok, 'panel_restart');
  const replay = await api('POST', '/api/forward-operations', input);
  check(replay.operation_id === receipts[0].operation_id && replay.replayed, 'panel_restart_preserves_idempotency_receipt');
  await api('POST', '/api/forwards/' + b.id + '/actions', { action: 'delete' }); rules.delete(b.id);
  check(await closed(25081), 'last_reference_listener_removed');
  for (const [index, [path, protocol]] of ['direct', 'relay'].flatMap((path) => ['tcp', 'udp', 'both'].map((protocol) => [path, protocol])).entries()) {
    const listen = 25090 + index;
    const forward = await deployed(await api('POST', '/api/forward-operations', body(`native ${path} ${protocol}`, listen, 'native_plain', path, protocol)));
    if (protocol !== 'udp') { const socket = await connect(listen); await tcpPayload(socket, 'native-TCP'); socket.destroy(); }
    if (protocol !== 'tcp') { const socket = dgram.createSocket('udp4'); await udpPayload(socket, listen, 'native-UDP'); socket.close(); }
    await api('POST', '/api/forwards/' + forward.id + '/actions', { action: 'delete' }); rules.delete(forward.id);
    check(await closed(listen) && (protocol === 'tcp' || await udpReleased(listen)), `native_${path}_${protocol}_payload_and_cleanup`);
  }
  let lastLink = b.link_resource_id;
  for (const [index, protocol] of ['tcp', 'udp'].entries()) {
    const listen = 25100 + index;
    const forward = await deployed(await api('POST', '/api/forward-operations', body(`TST ${protocol}`, listen, 'tst_v1', 'relay', protocol)));
    lastLink = forward.link_resource_id;
    if (protocol === 'tcp') { const socket = await connect(listen); await tcpPayload(socket, 'standalone-TST-TCP'); socket.destroy(); }
    else { const socket = dgram.createSocket('udp4'); await udpPayload(socket, listen, 'standalone-TST-UDP'); socket.close(); }
    await api('POST', '/api/forwards/' + forward.id + '/actions', { action: 'delete' }); rules.delete(forward.id);
    check(await closed(listen) && (protocol === 'tcp' || await udpReleased(listen)), `tst_${protocol}_payload_and_cleanup`);
  }
  const adminLogin = await response('POST', '/api/auth/login', fixture.admin, null, null);
  assert.equal(adminLogin.status, 200, 'fixture_admin_login');
  const adminSession = adminLogin.res.headers.get('set-cookie').split(';')[0];
  const resource = (await response('GET', '/api/links/' + lastLink, undefined, fixture.workspace_id, adminSession)).data;
  assert(Number.isInteger(resource.config?.carrier_port), 'public_carrier_port_present');
  console.log('Waiting for real five-minute automatic Link retirement grace');
  await until(async () => {
    const link = await response('GET', '/api/links/' + lastLink, undefined, fixture.workspace_id, adminSession);
    return link.status === 200 && link.data.status === 'retired';
  }, 'automatic_link_retirement', 360000);
  check(await closed(resource.config.carrier_port, '127.0.0.3'), 'real_grace_retirement_closes_last_carrier_listener');
  await writeFile(resolve(work, 'runtime.json'), JSON.stringify({ base, fixture_file: privateFixture, workspace_id: fixture.workspace_id,
    processes: [...children].map((child) => child.pid) }), { mode: 0o600 });
  if (keep) console.log(`Browser acceptance environment: ${base}; private fixture: ${privateFixture}`);
} catch (error) {
  const code = /^[a-zA-Z_0-9 :]+$/.test(error.message) ? error.message : error.name;
  results.push({ pass: false, label: code }); console.error('FAIL ' + code); process.exitCode = 1;
} finally {
  const evidence = resolve(root, 'scripts/integration/evidence'); await mkdir(evidence, { recursive: true });
  await writeFile(resolve(evidence, 'tst-local-result.json'), JSON.stringify({ platform: process.platform, architecture: process.arch,
    scope: 'real local Panel + Worker + two Agent processes; loopback TCP/UDP; not Linux deployment', results }, null, 2) + '\n');
  if ((keep && !process.exitCode) || (keepFailure && process.exitCode)) {
    if (process.exitCode) console.log(`Private failed-run environment retained: ${base}; ${privateFixture}`);
    await new Promise((done) => { process.once('SIGINT', done); process.once('SIGTERM', done); });
  }
  for (const id of rules) { try { await api('POST', '/api/forwards/' + id + '/actions', { action: 'delete' }); } catch { process.exitCode = 1; } }
  for (const socket of connections) socket.destroy();
  for (const server of servers) { server.tcp?.close(); server.udp?.close(); }
  await Promise.all([...children].map(stop));
}
