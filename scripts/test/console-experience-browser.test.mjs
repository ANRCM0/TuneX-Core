import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

// Exercise the complete production console; HTTP responses are controlled fixtures.
async function consoleFixture(t, viewport) {
  const root = new URL('../../apps/web/', import.meta.url);
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url, 'http://fixture').pathname;
      const name = path === '/' ? 'index.html' : path.replace(/^\/console\//, '');
      if (!/^[\w./-]+$/.test(name) || name.includes('..')) { response.writeHead(404).end(); return; }
      const body = await readFile(new URL(name, root));
      response.setHeader('content-type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(name)] ?? 'text/plain');
      response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport, hasTouch: true });
  page.setDefaultTimeout(10000);
  const errors = [], reads = [], writes = [], plans = [], unexpected = [];
  page.on('pageerror', error => errors.push(error.message));
  const state = { failForwards: false, writeGate: null, nodeGate: null, relayEnabled: false, planGate: null };
  const node = {
    id: 'machine-a', canUse: true, allowedRoles: null, readDetail: 'full', resourceSource: 'private', revoked: false,
    credentialUntil: '2099-01-01T00:00:00Z', lastReportAt: new Date().toISOString(),
    policy: { allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [25565, 25566],
      capabilities: ['adp.3', 'native.direct.v1', 'tcp', 'udp'] },
  };
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const resource = url.pathname.replace(/^\/api\/v1\/scopes\/[^/]+\//, '');
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (method === 'POST' && resource === 'relay-plan') {
      plans.push(request.postDataJSON()); state.onPlan?.();
      if (state.planGate) await state.planGate;
      return reply({ reserved: false, executionSupported: true, profile: { profileId: 'profile-a', revision: 2 }, resources: [] });
    }
    if (method !== 'GET') {
      writes.push({ method, resource, body: request.postDataJSON() });
      state.onWrite?.();
      if (method === 'POST' && resource === 'forwards') {
        if (state.writeGate) await state.writeGate;
        return reply({ forwardId: 'forward-new', revision: 1, operationId: 'operation-new' }, 202);
      }
      unexpected.push(method + ' ' + resource); return reply({ code: 'UNEXPECTED_WRITE' }, 400);
    }
    reads.push({ scope: url.pathname.split('/')[4], resource, query: url.search });
    if (url.pathname === '/api/v1/me/context') return reply({ actorId: 'actor-a', limit: 100, truncated: false, nextAfter: null,
      scopes: ['scope-a', 'scope-b'].map(scopeId => ({ scopeId, role: 'owner', membership: 'active', membershipRevision: 1, canEnter: true, canManage: true })) });
    if (resource === 'overview') return reply({ nodes: 1, forwards: 0, activeOperations: 0, failedOperations: 0 });
    if (resource === 'transport-profiles') return reply({ profiles: state.relayEnabled ? [{ profileId: 'profile-a', currentRevision: 2 }] : [] });
    if (resource === 'execution-capabilities') return reply({ multihopEnabled: false });
    if (resource === 'native-drivers') return reply({ version: 1, source: 'declared-native-implementation', authorized: false, reserved: false,
      drivers: ['direct', 'relay', 'multihop'].map(kind => ({ id: 'native.' + kind + '.v1', descriptorRevision: 1, controlEnabled: true,
        agentFlags: kind === 'direct' ? [] : ['--relay'], carrierByProtocol: { tcp: 'tcp', udp: kind === 'direct' ? 'udp' : 'tcp' } })) });
    if (resource === 'transport-profiles/profile-a') return reply({ profileId: 'profile-a', revision: 2, config: { protocols: ['tcp', 'udp'] } });
    if (resource === 'nodes/machine-b/relay-endpoint') return reply({ revision: 1, config: { advertisedHost: 'relay.example.test', listenAddress: '127.0.0.1', allowedTcpPorts: [34001] } });
    if (['nodes', 'nodes/candidates', 'forwards', 'operations', 'path-templates', 'tunnels'].includes(resource)) {
      if (resource === 'nodes' && state.nodeGate) await state.nodeGate;
      if (resource === 'forwards' && state.failForwards) return reply({ code: 'READ_UNAVAILABLE', message: 'Fixture read failed' }, 503);
      const number = Number(url.searchParams.get('page') ?? 1), limit = Number(url.searchParams.get('limit') ?? 25);
      const relayNodes = ['machine-a', 'machine-b'].map(id => ({ ...node, id,
        policy: { ...node.policy, capabilities: [...node.policy.capabilities, 'native.relay.v1', 'relay.wire.1', 'adp.execution.1'] } }));
      const nodes = state.relayEnabled ? relayNodes : [node];
      return reply({ page: number, limit, total: resource.startsWith('nodes') ? nodes.length : 0,
        ...(resource === 'tunnels' ? { management: { version: 1, kind: 'native-logical-tunnel', backingResource: 'path-template',
          configurationReuse: true, physicalConnectionSharing: false, allocationOwner: 'forward-runtime', health: 'not-assessed' } } : {}),
        items: resource.startsWith('nodes') ? nodes : [] });
    }
    unexpected.push(method + ' ' + resource); return reply({ code: 'UNEXPECTED_READ' }, 404);
  });
  const directory = process.env.TUNEX_EXPERIENCE_ARTIFACT_DIR ?? process.env.TUNEX_CANVAS_ARTIFACT_DIR ?? join(tmpdir(), 'tunex-console-experience');
  await mkdir(directory, { recursive: true });
  t.after(async () => {
    try {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: join(directory, viewport.width + '-last-state.png'), fullPage: true });
      assert.deepEqual(errors, [], 'production page throws no browser exceptions');
      assert.deepEqual(unexpected, [], 'every API request has an explicit fixture contract');
    } finally { await browser.close(); }
  });
  await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
  const login = async () => {
    await page.locator('#token').fill('a'.repeat(40));
    await page.locator('#connect').click();
    await page.waitForFunction(() => document.querySelector('#connection-indicator').textContent.includes('scope-a') &&
      document.querySelector('#connect').disabled === false);
  };
  return { page, state, reads, writes, plans, directory, login };
}

test('console journey: recover reads, validate Direct fields, fence duplicate writes and switch accounts', { timeout: 90000 }, async t => {
  const { page, state, writes, directory, login } = await consoleFixture(t, { width: 1440, height: 1000 });
  await login();
  assert.equal(await page.locator('#token').inputValue(), '');
  await page.locator('.nav[data-view="forwards"]').click();
  await page.locator('#show-forward-form').click();
  await page.locator('#forward-form').waitFor({ state: 'visible' });
  await page.locator('#forward-node').selectOption('machine-a');
  await page.locator('#forward-port').selectOption('25565');
  await page.locator('#forward-form [name="targetHost"]').fill('   ');
  await page.locator('#forward-form [name="targetPort"]').fill('443');
  await page.locator('#save-forward').click();
  assert.equal(writes.length, 0, 'invalid draft never reaches command acceptance');
  await page.waitForFunction(() => document.activeElement?.getAttribute('name') === 'targetHost');
  await page.locator('#forward-form [name="targetHost"]').fill('example.test');
  let completeWrite;
  state.writeGate = new Promise(resolve => { completeWrite = resolve; });
  const writeSeen = new Promise(resolve => { state.onWrite = resolve; });
  await page.locator('#save-forward').click();
  await writeSeen;
  await page.waitForFunction(() => document.querySelector('#save-forward').disabled);
  await page.locator('#forward-form').dispatchEvent('submit');
  assert.equal(writes.length, 1, 'one command while the first receipt is pending');
  completeWrite();
  await page.waitForFunction(() => document.querySelector('#forward-write-result').dataset.state === 'accepted' &&
    document.querySelector('#forward-write-dismiss').disabled === false);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].body.target.host, 'example.test');
  state.failForwards = true;
  await page.locator('#refresh').click();
  await page.waitForFunction(() => document.querySelector('#forwards-query-status').textContent.includes('失败'));
  assert.equal(await page.locator('#forward-write-result').getAttribute('data-state'), 'accepted');
  state.failForwards = false;
  await page.locator('#refresh').click();
  await page.waitForFunction(() => document.querySelector('#forwards-query-status').textContent.includes('匹配'));
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: join(directory, 'desktop-recovered-receipt.png'), fullPage: true });
  await page.locator('#scope').selectOption('scope-b');
  await page.waitForFunction(() => document.querySelector('#connection-indicator').textContent.includes('scope-b'));
  assert.equal(await page.locator('#forward-write-result').isVisible(), false);
  assert.equal(await page.locator('#forward-form').isVisible(), false);
  await page.locator('#disconnect').click();
  assert.equal(await page.locator('#token').inputValue(), '');
  assert.equal(await page.locator('#account-context').isVisible(), false);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0, 'no token or draft persistence');
});

test('mobile console: navigate with keyboard, preserve filter drafts and recover focus without overflow', { timeout: 90000 }, async t => {
  const { page, reads, writes, directory, login } = await consoleFixture(t, { width: 390, height: 844 });
  await login();
  const nodeNav = page.locator('.nav[data-view="nodes"]');
  await nodeNav.click();
  await page.waitForFunction(() => document.querySelector('#nodes-query-status').textContent.includes('匹配'));
  await page.locator('#nodes-filter [name="idPrefix"]').fill('my-machine');
  await page.locator('#nodes-filter button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#nodes-query-status').textContent.includes('匹配'));
  await page.locator('.nav[data-view="available"]').click();
  assert.equal(await page.locator('#nodes-filter [name="idPrefix"]').inputValue(), '');
  await nodeNav.click();
  assert.equal(await page.locator('#nodes-filter [name="idPrefix"]').inputValue(), 'my-machine');
  await nodeNav.focus();
  const count = reads.length;
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.view), 'available');
  assert.equal(reads.length, count, 'arrow navigation focuses without firing reads');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#page-title').textContent === '可用资源');
  await page.locator('.nav[data-view="forwards"]').click();
  await page.locator('#show-forward-form').click();
  await page.locator('#forward-form').waitFor({ state: 'visible' });
  await page.locator('#cancel-forward').click();
  assert.equal(await page.locator('#show-forward-form').evaluate(node => node === document.activeElement), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '390px page stays inside viewport');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: join(directory, 'mobile-direct-return.png'), fullPage: true });
  await page.locator('#disconnect').click();
  assert.equal(writes.length, 0, 'navigation and drafts issue no write requests');
});

test('Relay form: one preview and one write per explicit action while browser controls are busy', { timeout: 90000 }, async t => {
  const { page, state, writes, plans, directory, login } = await consoleFixture(t, { width: 1440, height: 1000 });
  state.relayEnabled = true;
  await login();
  await page.locator('.nav[data-view="relay"]').click();
  await page.waitForFunction(() => document.querySelector('#relay-egress').value === 'machine-b' &&
    document.querySelector('#relay-profile-select').value === 'profile-a');
  assert.equal(await page.locator('#notice').evaluate(node => node.classList.contains('error')), false);
  await page.locator('#relay-forward-form [name="targetHost"]').fill('example.test');
  await page.locator('#relay-forward-form [name="targetPort"]').fill('443');
  let finishPlan;
  state.planGate = new Promise(resolve => { finishPlan = resolve; });
  const planSeen = new Promise(resolve => { state.onPlan = resolve; });
  await page.locator('#relay-preview').click();
  await planSeen;
  await page.locator('#relay-preview').dispatchEvent('click');
  assert.equal(plans.length, 1, 'preview has one in-flight read session');
  assert.equal(await page.locator('#relay-forward-form').getAttribute('aria-busy'), 'true');
  finishPlan();
  await page.waitForFunction(() => !document.querySelector('#relay-submit').disabled &&
    document.querySelector('#relay-forward-form').getAttribute('aria-busy') === 'false');
  let finishWrite;
  state.writeGate = new Promise(resolve => { finishWrite = resolve; });
  const writeSeen = new Promise(resolve => { state.onWrite = resolve; });
  await page.locator('#relay-submit').click();
  await writeSeen;
  await page.locator('#relay-forward-form').dispatchEvent('submit');
  assert.equal(writes.length, 1, 'double submit retains a single original command');
  assert.equal(await page.locator('#relay-forward-form [name="targetHost"]').isDisabled(), true);
  finishWrite();
  await page.waitForFunction(() => document.querySelector('#page-title').textContent === '执行记录' &&
    document.querySelector('#relay-forward-form').getAttribute('aria-busy') === 'false');
  assert.equal(await page.locator('#relay-ingress').isDisabled(), false, 'successful create releases its temporary ingress lock');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].body.transport.configRevision, 2);
  assert.equal(writes[0].body.path.via[0], 'machine-b');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: join(directory, 'relay-single-command.png'), fullPage: true });
});
