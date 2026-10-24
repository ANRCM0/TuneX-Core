import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifySource, sourceReferences } from '../../../scripts/foundation-boundary-policy.mjs';
import { initTelemetryConsole } from '../telemetry-console.js';
import { initHostTelemetryConsole } from '../host-telemetry-console.js';
import { initForwardTelemetryConsole } from '../forward-telemetry-console.js';
import { initProbeTelemetryConsole } from '../probe-telemetry-console.js';
import { initPathTemplates } from '../path-templates.js';

const leaves = [
  ['probe.js', ['initProbeConsole']], ['probe-runs.js', ['initProbeRuns']], ['probe-plans.js', ['initProbePlans']],
  ['transport-console.js', ['initTransportConsole']], ['rule-console.js', ['initRuleConsole']], ['tunnel-console.js', ['initTunnelConsole']],
  ['observation-services.js', ['initObservationServices']], ['path-templates.js', ['initPathTemplates', 'initPathSwitch']],
  ['path-groups.js', ['initPathGroups']], ['path-publications.js', ['initPathPublications']], ['ingress-groups.js', ['initIngressGroups']],
  ['ingress-migrations.js', ['initIngressMigrations']], ['forward-diagnostics.js', ['initForwardDiagnostics']], ['audit-console.js', ['initAuditConsole']],
  ['station-alerts.js', ['initStationAlerts']], ['notification-endpoints.js', ['initNotificationEndpoints']], ['notification-deliveries.js', ['initNotificationDeliveries']],
  ['telemetry-console.js', ['initTelemetryConsole']], ['forward-telemetry-console.js', ['initForwardTelemetryConsole']],
  ['host-telemetry-console.js', ['initHostTelemetryConsole']], ['probe-telemetry-console.js', ['initProbeTelemetryConsole']],
  ['telemetry-aggregate-console.js', ['initTelemetryAggregateConsole']],
];

test('all twenty-two declared browser leaves retain exact old exports real consumers and explicit per-file roles', async () => {
  const inventory = JSON.parse(await readFile(new URL('../../../scripts/config/foundation-boundaries-v1.json', import.meta.url), 'utf8'));
  const declared = JSON.parse(await readFile(new URL('../../../scripts/config/entrypoint-inventory-v1.json', import.meta.url), 'utf8')).browser;
  assert.equal(declared.length, 22);
  const main = await readFile(new URL('../app.js', import.meta.url), 'utf8'), mainImports = sourceReferences('apps/web/app.js', main);
  assert.equal(leaves.length, 22); assert.equal(leaves.reduce((count, [, names]) => count + names.length, 0), 23);
  for (const [file, names] of leaves) {
    const path = 'apps/web/' + file, source = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    const module = await import(new URL('../' + file, import.meta.url).href);
    assert.deepEqual(Object.keys(module).sort(), [...names].sort(), path);
    assert.deepEqual(declared.find(entry => entry.file === file)?.exports, names, file);
    for (const name of names) assert.equal(module[name].length, 1, name);
    assert.ok(mainImports.includes('./' + file), file + ' actual composition consumer');
    const classification = classifySource(path, inventory);
    if (file === 'rule-console.js') {
      assert.equal(classification.binding, true);
      assert.deepEqual(sourceReferences(path, source), ['./rule-command-owner/public.js', './browser-native/public.js']);
    } else {
      assert.equal(classification.layer, 'L2', path); assert.equal(classification.scope, path, 'classification must name this native leaf');
      const representationImports={ 'path-groups.js':['./template-reference.js'],'ingress-groups.js':['./template-reference.js'],
        'path-publications.js':['./task-workflow.js'],'ingress-migrations.js':['./task-workflow.js'] };
      assert.deepEqual(sourceReferences(path, source), representationImports[file]??[], path + ' declared representation dependencies');
    }
  }
  for (const path of ['apps/web/rule-command-owner/public.js', 'apps/web/rule-command-owner/service.js'])
    assert.equal(classifySource(path, inventory).layer, 'L3');
  assert.equal(classifySource('apps/web/browser-native/rule-console.js', inventory).layer, 'L2');
  assert.equal(classifySource('apps/web/unclassified-native-leaf.js', inventory), undefined, 'no browser folder exemption');
});

test('P native presentation additions have explicit scopes exports and composition consumers',async()=>{
  const inventory=JSON.parse(await readFile(new URL('../../../scripts/config/foundation-boundaries-v1.json',import.meta.url),'utf8'));
  const source=await readFile(new URL('../browser-native/control-console.js',import.meta.url),'utf8');
  for(const [file,names] of [
    ['member-console.js',['initMemberConsole','memberCommand','memberListView','memberReceipt']],
    ['account-credentials.js',['accountCredentialView','initAccountCredentials','requestAccountCredentials']],
    ['task-workflow.js',['batchProgress','createBoundedPageReads','workflowSteps']],
  ]) {
    const module=await import(new URL('../'+file,import.meta.url).href);
    assert.deepEqual(Object.keys(module).sort(),names.sort());assert.ok(source.includes('../'+file));
    const classification=classifySource('apps/web/'+file,inventory);assert.equal(classification.layer,'L2');assert.equal(classification.scope,'apps/web/'+file);
  }
});

class Element {
  constructor() { this.children = []; this.listeners = {}; this.value = ''; this.textContent = ''; this.open = false; this.disabled = false; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = [...items]; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  showModal() { this.open = true; }
  close() { if (this.open) { this.open = false; this.listeners.close?.(); } }
}
function dom() {
  const elements = new Map();
  return { byId(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); }, document: { createElement: () => new Element() } };
}

test('four telemetry opens really reload bounded histories while initialization edits and clear perform no requests', async t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-10-19T12:00:00Z'));
  for (const [initialize, prefix, target, resource] of [
    [initTelemetryConsole, 'telemetry', 'node-a', 'nodes/node-a/telemetry'],
    [initHostTelemetryConsole, 'host-telemetry', 'node-a', 'nodes/node-a/host-telemetry'],
    [initForwardTelemetryConsole, 'forward-telemetry', 'forward-a', 'forwards/forward-a/telemetry'],
    [initProbeTelemetryConsole, 'probe-telemetry', 'forward-a', 'forwards/forward-a/probe-telemetry'],
  ]) {
    const h = dom(), calls = [], completions = [], notices = [];
    const api = initialize({ ...h, notify: (...args) => notices.push(args), request: (...args) => {
      calls.push(args); return new Promise(resolve => completions.push(resolve));
    } });
    const element = name => h.byId(prefix + '-' + name);
    element('range').value = '900000'; element('limit').value = '128';
    assert.equal(calls.length, 0, prefix + ' initialize');
    const opening = api.open(target);
    assert.equal(calls.length, 1, prefix + ' open reloads before returning');
    const [method, path, input, key, options] = calls[0], query = new URLSearchParams(path.split('?')[1]);
    assert.equal(method, 'GET'); assert.equal(path.split('?')[0], resource);
    assert.deepEqual([...query], [['from', '2026-10-19T11:45:00.000Z'], ['to', '2026-10-19T12:00:00.000Z'], ['limit', '128']]);
    assert.equal(input, undefined); assert.equal(key, undefined); assert.equal(options.timeoutMs, 5000); assert.equal(options.signal.aborted, false);
    element('range').listeners.change(); assert.equal(options.signal.aborted, true);
    assert.equal(calls.length, 1, prefix + ' edits require a manual reload');
    completions[0]({ malformed: true }); await opening;
    assert.equal(notices.length, 0, prefix + ' stale response cannot render or report an error');
    api.clear(); assert.equal(calls.length, 1); assert.equal(element('dialog').open, false);
  }
});

test('accepted template metadata publication really refreshes its bounded list after the original command', async () => {
  const h = dom(), calls = [], notices = [], digest = 'sha256:' + 'a'.repeat(64);
  const api = initPathTemplates({ ...h, confirm: () => true, randomUUID: () => 'original-key', notify: (...args) => notices.push(args),
    request: async (...args) => {
      calls.push(args); const [method, resource] = args;
      if (resource.endsWith('/relay-endpoint')) return { nodeId: resource.split('/')[1], revision: 1 };
      if (method === 'PUT') return { templateId: 'path-a', revision: 1, configDigest: digest, archived: false, changed: true };
      assert.equal(resource, 'path-templates?page=1&limit=25'); return { page: 1, limit: 25, total: 0, items: [] };
    } });
  const element = name => h.byId('path-template-' + name);
  assert.equal(calls.length, 0);
  element('id').value = 'path-a'; element('nodes').value = 'ingress\negress'; element('profile').value = 'profile-a'; element('profile-revision').value = '1';
  await api.capture(); await element('publish').listeners.click();
  assert.deepEqual(calls.map(args => args.slice(0, 2)), [['GET', 'nodes/egress/relay-endpoint'], ['PUT', 'path-templates/path-a'], ['GET', 'path-templates?page=1&limit=25']]);
  assert.equal(calls[1][3], 'original-key'); assert.equal(calls[1][2].expectedRevision, 0);
  assert.match(element('state').textContent, /No Forward binding or execution/); assert.equal(notices.length, 0);
});
