import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeRuleConsole, mountControlConsole } from '../browser-native/public.js';

class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.listeners = {}; this.dataset={};this.value='';this.checked = false; this.disabled = false; this.textContent = ''; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = [...items]; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  close() { this.open = false; }
  showModal() { this.open = true; }
  reset() {}
  querySelector(selector) {
    assert.equal(selector,'option[value="retain"]');
    return this.children.find(child=>child.tag==='option'&&child.value==='retain')??null;
  }
}
function harness(overrides = {}) {
  const elements = new Map(), events = [], calls = [], state = { selected: new Map(), active: false, plan: null }, captured = {};
  const commands = { state };
  for (const name of ['page', 'batch', 'profileBatch', 'pathBatch', 'retry', 'clear', 'stop', 'discard', 'select', 'dispatch'])
    commands[name] = function (...args) { calls.push({ name, args, receiver: this }); };
  const byId = id => { events.push(id); if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const request = () => assert.fail('native initialization cannot request'), notify = (...args) => calls.push({ name: 'notify', args }), refresh = () => assert.fail('native initialization cannot refresh');
  const document = { createElement: tag => new Element(tag) };
  const initialize = createNativeRuleConsole(dependencies => { events.push('createCommands'); captured.dependencies = dependencies; return commands; });
  const api = initialize({ request, notify, refresh, byId, document, confirm: () => true, newKey: () => 'explicit-key', ...overrides });
  return { api, state, commands, events, calls, dependencies: captured.dependencies, byId, document, request, notify, refresh };
}

test('native Rule factory is lazy and keeps initializer defaults destructuring return names and callback wiring', t => {
  const order = [], descriptors = new Map(), elements = new Map(); let captured;
  const install = (name, descriptor) => { descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { configurable: true, ...descriptor }); };
  t.after(() => { for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } });
  const document = { createElement: tag => new Element(tag) };
  install('document', { get() { order.push('default:document'); return document; } });
  install('confirm', { get() { order.push('default:confirm'); return function (message) { assert.equal(this, undefined); order.push(['confirm', message]); return true; }; } });
  t.mock.method(globalThis.crypto, 'randomUUID', function () { assert.equal(this, globalThis.crypto); order.push('uuid'); return 'native-uuid'; });
  t.mock.method(Date, 'now', () => assert.fail('lazy construction cannot sample time'));
  const commands = { state: { selected: new Map(), active: false, plan: null } };
  for (const name of ['page', 'batch', 'profileBatch', 'pathBatch', 'retry', 'clear', 'stop', 'discard', 'dispatch']) commands[name] = () => {};
  const factory = createNativeRuleConsole(dependencies => { order.push('createCommands'); captured = dependencies; return commands; });
  assert.deepEqual(order, []); assert.equal(factory.name, 'initRuleConsole'); assert.equal(factory.length, 1);
  const values = { request() {}, notify() {}, byId(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); }, refresh() {} };
  const input = {};
  for (const name of ['request', 'notify', 'byId', 'refresh', 'document', 'confirm', 'newKey']) Object.defineProperty(input, name, { get() { order.push('arg:' + name); return values[name]; } });
  const api = factory(input);
  assert.deepEqual(order, ['arg:request', 'arg:notify', 'arg:byId', 'arg:refresh', 'arg:document', 'default:document', 'arg:confirm', 'default:confirm', 'arg:newKey', 'createCommands']);
  assert.equal(captured.request, values.request); assert.equal(captured.notify, values.notify); assert.equal(captured.refresh, values.refresh);
  assert.deepEqual(Object.keys(api), ['page', 'checkbox', 'batch', 'profileBatch', 'pathBatch', 'retry', 'clear']);
  for (const name of ['page', 'batch', 'profileBatch', 'pathBatch', 'retry', 'clear']) assert.equal(api[name], commands[name], name);
  assert.deepEqual([api.checkbox.length, createNativeRuleConsole.length], [1, 1]);
  assert.equal(captured.effects.newKey(), 'native-uuid'); assert.equal(captured.effects.confirm('continue'), true);
  assert.deepEqual(order.slice(-2), ['uuid', ['confirm', 'continue']]);
});

test('native Rule input Set preserves reset versus drop and callbacks retain original item and listener order', () => {
  const h = harness(), view = h.dependencies.view;
  assert.deepEqual(h.events, ['createCommands', 'rule-batch-enable', 'rule-batch-disable', 'rule-command-consent', 'rule-command-start',
    'rule-command-stop', 'rule-command-close', 'rule-command-dialog', 'rule-selection', 'rule-batch-enable', 'rule-batch-disable']);
  const item = { id: 'rule-a' }, input = h.api.checkbox(item), second = h.api.checkbox({ id: 'rule-b' });
  assert.equal(input.tag, 'input'); assert.equal(input.type, 'checkbox'); assert.equal(input['aria-label'], 'Select Forward rule-a');
  input.checked = true; input.listeners.change();
  const selected = h.calls.pop(); assert.equal(selected.name, 'select'); assert.equal(selected.receiver, h.commands);
  assert.equal(selected.args[0], item); assert.equal(selected.args[1], true); selected.args[2](); assert.equal(input.checked, false);
  input.checked = second.checked = true; view.resetInputs(false); assert.equal(input.checked, false); assert.equal(second.checked, false);
  input.checked = true; view.resetInputs(false); assert.equal(input.checked, false, 'retained inputs are still tracked');
  view.resetInputs(true); input.checked = true; view.resetInputs(false); assert.equal(input.checked, true, 'drop clears the tracked Set');
  const suspended = h.api.checkbox({ id: 'suspended', recoverySuspended: true }); suspended.checked = true;
  suspended.listeners.change(); assert.equal(suspended.checked, false); assert.equal(h.calls.length, 0);
  h.state.selected.set('rule-a', item); view.selectionState(); assert.equal(h.byId('rule-selection').textContent, '1 / 10 selected on this page');
  assert.equal(h.byId('rule-batch-enable').disabled, false); h.state.active = true; view.selectionState(); assert.equal(h.byId('rule-batch-enable').disabled, true);
  h.byId('rule-batch-enable').listeners.click(); h.byId('rule-batch-disable').listeners.click(); h.byId('rule-command-start').listeners.click();
  assert.deepEqual(h.calls.map(call => [call.name, call.args]), [['batch', [true]], ['batch', [false]], ['dispatch', []]]);
  assert.equal(h.byId('rule-command-stop').listeners.click, h.commands.stop);
  const failure = new Error('discard refused'); h.commands.discard = () => { throw failure; }; let prevented = 0;
  h.byId('rule-command-dialog').listeners.cancel({ preventDefault() { prevented++; } });
  assert.equal(prevented, 1); assert.deepEqual(h.calls.at(-1), { name: 'notify', args: ['discard refused', true] });
});

test('native Rule clone ordered and JSON remain separate evaluations with original getters and errors', () => {
  const { effects } = harness().dependencies, order = [], source = {};
  Object.defineProperty(source, 'z', { enumerable: true, get() { order.push('z'); return { z: 1, a: [2, { y: 3, b: 4 }] }; } });
  Object.defineProperty(source, 'a', { enumerable: true, get() { order.push('a'); return 0; } });
  const cloned = effects.clone(source); assert.deepEqual(order.splice(0), ['z', 'a']);
  const ordered = effects.ordered(source); assert.deepEqual(order.splice(0), ['a', 'z']);
  assert.deepEqual(Object.keys(ordered), ['a', 'z']); assert.deepEqual(Object.keys(ordered.z), ['a', 'z']); assert.deepEqual(Object.keys(ordered.z.a[1]), ['b', 'y']);
  assert.equal(effects.json(source), '{"z":{"z":1,"a":[2,{"y":3,"b":4}]},"a":0}'); assert.deepEqual(order, ['z', 'a']);
  cloned.z.a[0] = 9; assert.equal(ordered.z.a[0], 2); assert.equal(Object.isFrozen(cloned), false);
  const failure = new Error('native getter failure'), bad = { get value() { throw failure; } };
  for (const operation of [effects.clone, effects.ordered, effects.json]) assert.throws(() => operation(bad), error => error === failure);
  const cycle = {}; cycle.self = cycle; assert.throws(() => effects.clone(cycle), TypeError); assert.throws(() => effects.json(cycle), TypeError);
});

test('native Rule show consent and clear callbacks preserve the original view operation order', () => {
  const h = harness(), { view } = h.dependencies;
  h.byId('rule-command-consent').checked = true; h.events.length = 0;
  view.show('Original proposal');
  assert.deepEqual(h.events, ['rule-command-title', 'rule-command-consent', 'rule-selection', 'rule-batch-enable', 'rule-batch-disable', 'rule-command-dialog']);
  assert.equal(h.byId('rule-command-title').textContent, 'Original proposal'); assert.equal(view.consented(), false);
  assert.equal(h.byId('rule-command-dialog').open, true); h.byId('rule-command-consent').checked = true;
  assert.equal(view.consented(), true); view.clearConsent(); assert.equal(view.consented(), false);
  h.events.length = 0; view.clear();
  assert.deepEqual(h.events, ['rule-command-dialog', 'rule-command-rows', 'rule-command-title', 'rule-command-state', 'rule-command-consent',
    'rule-command-consent', 'rule-command-start', 'rule-command-stop', 'rule-command-close']);
  assert.equal(h.byId('rule-command-dialog').open, false); assert.deepEqual(h.byId('rule-command-rows').children, []);
  assert.equal(h.byId('rule-command-start').disabled, true); assert.equal(h.byId('rule-command-stop').disabled, true);
  assert.equal(h.byId('rule-command-close').disabled, false);
});

test('native Rule effects preserve encoding UTC UUID confirm binding cancellation options and bounded error representation', t => {
  const { effects } = harness({ confirm: function (message) { assert.equal(this, undefined); return message === 'yes'; },
    newKey: function () { assert.equal(this, undefined); return 'explicit'; } }).dependencies;
  assert.equal(effects.newKey(), 'explicit'); assert.equal(effects.confirm('yes'), true);
  assert.equal(effects.encode('a /:中'), 'a%20%2F%3A%E4%B8%AD'); assert.throws(() => effects.encode('\ud800'), URIError);
  const OriginalDate = Date;
  Object.defineProperty(globalThis, 'Date', { configurable: true, writable: true, value: class extends OriginalDate {
    constructor(...args) { assert.deepEqual(args, []); super('2026-10-19T12:34:56.789Z'); }
  } });
  t.after(() => Object.defineProperty(globalThis, 'Date', { configurable: true, writable: true, value: OriginalDate }));
  assert.equal(effects.checkedAt(), '2026-10-19T12:34:56.789Z');
  const controller = effects.newAbort(), options = effects.options(controller), reason = { cancelled: true };
  assert.equal(controller instanceof AbortController, true); assert.deepEqual(options, { signal: controller.signal, timeoutMs: 5000 });
  assert.notEqual(effects.options(controller), options); assert.equal(effects.aborted(controller), false); assert.equal(effects.aborted(undefined), undefined);
  controller.abort(reason); assert.equal(effects.aborted(controller), true); assert.throws(() => effects.throwIfAborted(controller), error => error === reason);
  assert.equal(effects.abort(undefined), undefined); const another = effects.newAbort(); effects.abort(another); assert.equal(another.signal.aborted, true);
  assert.equal(effects.errorText({}), 'Request outcome unknown'); assert.equal(effects.errorText({ message: '' }), '');
  assert.equal(effects.errorText({ message: 'a'.repeat(300) }), 'a'.repeat(260));
  const failure = new Error('message getter failed'); assert.throws(() => effects.errorText({ get message() { throw failure; } }), error => error === failure);
  for (const status of [400, 401, 403, 404, 409, 413, 422, 429]) assert.equal(effects.completeRejection({ httpStatus: status }), true);
  for (const status of [200, 408, 500, undefined, '400']) assert.equal(effects.completeRejection({ httpStatus: status }), false);
  assert.equal(effects.id('a'.repeat(128)), true); assert.equal(effects.id('a'.repeat(129)), false);
  assert.equal(effects.revision(Number.MAX_SAFE_INTEGER), true); assert.equal(effects.revision(0), false); assert.equal(effects.revision('1'), false);
  assert.equal(effects.hash('sha256:' + 'a'.repeat(64)), true); assert.equal(effects.hash('sha256:' + 'A'.repeat(64)), false);
});

test('actual main composition keeps Profile and Path handoffs lazy until the initialized Rule consumer exists', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document'), elements = new Map(), captured = {}, order = [], received = [];
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    createElement: tag => new Element(tag), querySelectorAll: () => [], addEventListener() {},
  };
  document.getElementById('resource-provision-form').elements=[];
  const retain=new Element('option');retain.value='retain';document.getElementById('resource-classify-legacy').append(retain);
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'document', descriptor); else delete globalThis.document; });
  const initializers = ['initRelayConsole', 'initProbeConsole', 'initProbeRuns', 'initProbePlans', 'initTransportConsole', 'initRuleConsole',
    'initTunnelConsole', 'initTelemetryConsole', 'initForwardTelemetryConsole', 'initHostTelemetryConsole', 'initProbeTelemetryConsole',
    'initTelemetryAggregateConsole', 'initPathSwitch', 'initPathTemplates', 'initPathGroups', 'initPathPublications', 'initIngressGroups',
    'initIngressMigrations', 'initForwardDiagnostics', 'initAuditConsole', 'initStationAlerts', 'initNotificationEndpoints',
    'initNotificationDeliveries', 'initObservationServices'];
  const rule = {
    profileBatch(value) { assert.equal(this, rule); received.push(['profile', value]); return 'profile-result'; },
    pathBatch(value) { assert.equal(this, rule); received.push(['path', value]); return 'path-result'; },
  };
  const dependencies = {};
  for (const name of ['validScope', 'parsePorts', 'parseCidrs', 'directCapable', 'allowedProtocols', 'directSpec', 'stateTone', 'pageCount', 'listResource', 'candidateChoices'])
    dependencies[name] = () => assert.fail('mount must not invoke model helper ' + name);
  let state;
  dependencies.createRequests = value => { state = value; order.push('createRequests'); return {
    connected: () => assert.fail('mount must not connect'), request: () => assert.fail('mount must not request'), mutate: () => assert.fail('mount must not mutate'),
  }; };
  for (const name of initializers) dependencies[name] = value => { order.push(name); captured[name] = value; return name === 'initRuleConsole' ? rule : {}; };
  assert.equal(mountControlConsole(dependencies), undefined);
  assert.deepEqual(order, ['createRequests', ...initializers]); assert.deepEqual(received, []);
  assert.equal(state.scope(), ''); assert.equal(state.token(), ''); assert.equal(state.version(), 0, 'version is sampled only after its later initialization');
  const profile = {}, path = {};
  assert.equal(captured.initTransportConsole.prepareProfileBatch(profile), 'profile-result');
  assert.equal(captured.initPathSwitch.preparePathBatch(path), 'path-result');
  assert.deepEqual(received, [['profile', profile], ['path', path]]);
  assert.equal(captured.initPathSwitch.tunnelManagement, true); assert.equal(captured.initPathTemplates.tunnelManagement, true);
});
