import test from 'node:test';
import assert from 'node:assert/strict';
import * as legacy from '../model.js';
import * as owner from '../console-model-owner/public.js';
import { browserConsoleModelEffects as native } from '../browser-native/public.js';

const node = () => ({ id: 'node-a', canUse:true, allowedRoles:null, readDetail:'full', resourceSource:'private', policy: { capabilities: ['adp.3', 'native.direct.v1', 'tcp', 'udp'],
  allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [80] } });
const form = () => ({ protocol: 'both', listenAddress: '127.0.0.1', listenPort: '80', targetHost: ' target.example ', targetPort: '443', enabled: true });

test('all ten legacy model exports retain signatures and pure alias identity without eager native clock reads', async t => {
  const names = ['allowedProtocols', 'candidateChoices', 'directCapable', 'directSpec', 'listResource', 'pageCount', 'parseCidrs', 'parsePorts', 'stateTone', 'validScope'];
  assert.deepEqual(Object.keys(legacy).sort(), names);
  for (const name of ['validScope', 'parsePorts', 'parseCidrs', 'allowedProtocols', 'stateTone', 'pageCount', 'candidateChoices'])
    assert.equal(legacy[name], owner[name], name);
  for (const [name, arity] of [['validScope', 1], ['parsePorts', 1], ['parseCidrs', 1], ['directCapable', 1], ['allowedProtocols', 1],
    ['directSpec', 2], ['stateTone', 1], ['pageCount', 2], ['listResource', 2], ['candidateChoices', 3]]) assert.equal(legacy[name].length, arity, name);
  t.mock.method(Date, 'parse', () => assert.fail('module initialization cannot parse time'));
  t.mock.method(Date, 'now', () => assert.fail('module initialization cannot sample time'));
  const fresh = await import('../model.js?native-model-complete-no-clock');
  assert.equal(fresh.directCapable(node()), true);
  assert.deepEqual(Object.keys(owner.createConsoleModel(new Proxy({}, { get() { assert.fail('factory initialization cannot read effects'); } }))),
    ['directCapable', 'directSpec', 'listResource']);
});

test('native credential expression captures Date.parse before the second getter even when that getter replaces it', t => {
  const order = [], descriptor = Object.getOwnPropertyDescriptor(Date, 'parse');
  t.after(() => Object.defineProperty(Date, 'parse', descriptor));
  Object.defineProperty(Date, 'parse', { configurable: true, get() {
    order.push('lookup:parse'); return value => { order.push(['captured:parse', value]); return 2000; };
  } });
  t.mock.method(Date, 'now', () => { order.push('now'); return 1000; });
  let reads = 0;
  const value = node(); Object.defineProperty(value, 'credentialUntil', { get() {
    order.push('credential:' + ++reads);
    if (reads === 2) Object.defineProperty(Date, 'parse', { configurable: true, value: () => assert.fail('replacement parse must not replace the captured call') });
    return 'expiry';
  } });
  assert.equal(owner.createConsoleModel(native).directCapable(value), true);
  assert.deepEqual(order, ['credential:1', 'lookup:parse', 'credential:2', ['captured:parse', 'expiry'], 'now']);
});

test('Direct capability requires explicit use permission and reads credentials only after every authorization fact', () => {
  const failure = new Error('credential getter failure'), model = owner.createConsoleModel({ credentialActive() { throw failure; } });
  const {canUse,...missingPermission}=node();
  const cases = [undefined, null, missingPermission, {...node(),canUse:false}, {...node(),canUse:'true'},
    { ...node(), revoked: true }, { canUse:true, policy: {} },
    { canUse:true, policy: { capabilities: ['adp.3'] } },
    { canUse:true, policy: { capabilities: ['adp.3', 'native.direct.v1'], allowedListenerAddresses: [] } },
    { canUse:true, policy: { capabilities: ['adp.3', 'native.direct.v1'], allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [] } }];
  for (const value of cases) {
    if (value) Object.defineProperty(value, 'credentialUntil', { get() { assert.fail('guard must short circuit credential'); } });
    assert.equal(model.directCapable(value), false);
  }
  assert.equal(model.directCapable(node()), true);
  assert.throws(() => model.directCapable({ ...node(), credentialUntil: 'expiry' }), error => error === failure);
  let reads = 0; const value = node();
  Object.defineProperty(value, 'credentialUntil', { get() { reads++; throw failure; } });
  assert.throws(() => model.directCapable(value), error => error === failure); assert.equal(reads, 1);
});

test('Direct form preserves property and String Number coercion order before listener then target authorization', () => {
  const model = owner.createConsoleModel(native), order = [], values = form(), traced = {};
  for (const name of ['protocol', 'listenAddress', 'listenPort', 'targetPort', 'targetHost']) Object.defineProperty(traced, name, { get() {
    order.push('get:' + name); return { [Symbol.toPrimitive](hint) { order.push(name + ':' + hint); return values[name]; } };
  } });
  Object.defineProperty(traced, 'enabled', { get() { order.push('get:enabled'); return 1; } });
  const spec = model.directSpec(traced, node());
  assert.deepEqual(order, ['get:protocol', 'protocol:string', 'get:listenAddress', 'listenAddress:string', 'get:listenPort', 'listenPort:number',
    'get:targetPort', 'targetPort:number', 'get:targetHost', 'targetHost:string', 'get:enabled']);
  assert.deepEqual(spec, { enabled: true, protocols: ['tcp', 'udp'], ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 80 } },
    target: { host: 'target.example', port: 443 } });
  assert.equal(Object.isFrozen(spec), false); spec.protocols.push('changed'); spec.ingress.listen.port = 81;
  assert.deepEqual(model.directSpec(form(), node()).protocols, ['tcp', 'udp']); assert.equal(node().policy.allowedPorts[0], 80);
  const failure = new Error('form getter failure');
  for(const allowedRoles of [undefined,[],['transit'],['egress']])
    assert.throws(()=>model.directSpec(new Proxy({}, {get(){throw failure;}}),{...node(),allowedRoles}),
      {message:'所选节点不满足 Direct 执行能力或授权要求'});
  assert.throws(() => model.directSpec(new Proxy({}, { get() { throw failure; } }), { ...node(), revoked: true }),
    { message: '所选节点不满足 Direct 执行能力或授权要求' });
  assert.throws(() => model.directSpec({ protocol: 'quic', get listenAddress() { throw failure; } }, node()), { message: '节点不支持所选协议' });
  assert.throws(() => model.directSpec({ ...form(), listenAddress: 'denied', get targetHost() { throw failure; } }, node()), error => error === failure);
  assert.throws(() => model.directSpec({ ...form(), listenPort: 81, targetPort: 0, targetHost: '' }, node()), { message: '监听地址或端口未获节点授权' });
  for (const targetPort of [0, 65536, 1.5, NaN, Infinity]) assert.throws(() => model.directSpec({ ...form(), targetPort }, node()), { message: '请填写有效的目标主机和端口' });
  for (const targetHost of ['', '   ', 'a'.repeat(254)]) assert.throws(() => model.directSpec({ ...form(), targetHost }, node()), { message: '请填写有效的目标主机和端口' });
  assert.equal(model.directSpec({ ...form(), targetPort: 1, targetHost: 'a'.repeat(253), enabled: 0 }, node()).enabled, false);
  assert.equal(model.directSpec({ ...form(), targetPort: 65535 }, node()).target.port, 65535);
});

test('native query preserves URLSearchParams defaults Object.entries getter and String coercion ordering', () => {
  const order = [], filters = {};
  for (const [key, value] of [['skip', ''], ['label', { [Symbol.toPrimitive](hint) { order.push('label:' + hint); return 'a b&/'; } }],
    ['nil', null], ['missing', undefined], ['false', false], ['zero', 0]]) Object.defineProperty(filters, key, { enumerable: true, get() { order.push('get:' + key); return value; } });
  assert.equal(legacy.listResource('nodes/candidates', 2, filters),
    'nodes/candidates?page=2&limit=25&label=a+b%26%2F&nil=null&missing=undefined&false=false&zero=0');
  assert.deepEqual(order, ['get:skip', 'get:label', 'get:nil', 'get:missing', 'get:false', 'get:zero', 'label:string']);
  assert.equal(legacy.listResource('nodes', 1), 'nodes?page=1&limit=25');
  assert.equal(legacy.listResource('operations', 10000, { page: 7, limit: 3 }), 'operations?page=7&limit=3');
  const failure = new Error('query coercion failed'), poison = new Proxy({}, { ownKeys() { throw failure; } });
  for (const [kind, page] of [['../escape', 1], ['nodes', 0], ['nodes', 10001], ['nodes', '1'], ['nodes', NaN]])
    assert.throws(() => legacy.listResource(kind, page, poison), { message: '查询页码超出允许范围' });
  assert.throws(() => legacy.listResource('nodes', 1, poison), error => error === failure);
  assert.throws(() => legacy.listResource('nodes', 1, null), TypeError);
  assert.throws(() => legacy.listResource('nodes', 1, { value: { toString() { throw failure; } } }), error => error === failure);
  assert.equal(legacy.listResource('nodes', 1, 'ab'), 'nodes?page=1&limit=25&0=a&1=b');
});

test('pure model helpers retain bounded ports CIDRs protocol ordering candidate replacement tones and pagination', () => {
  for (const value of ['', '../bad', 'a'.repeat(129), null, 1]) assert.equal(legacy.validScope(value), false);
  assert.equal(legacy.validScope('a'.repeat(128)), true);
  assert.deepEqual(legacy.parsePorts(' 1, ,65535 '), [1, 65535]);
  for (const value of ['', '01', '-1', '1.5', '1,1']) assert.throws(() => legacy.parsePorts(value));
  const cidrs = Array.from({ length: 256 }, (_, i) => 'recorded-' + i);
  assert.deepEqual(legacy.parseCidrs(cidrs.join(',')), cidrs);
  assert.throws(() => legacy.parseCidrs([...cidrs, 'overflow'].join(',')), { message: '请填写不重复的目标 CIDR' });
  assert.deepEqual(legacy.allowedProtocols({ policy: { capabilities: ['udp', 'tcp', 'udp'] } }), ['tcp', 'udp', 'both']);
  assert.deepEqual(legacy.allowedProtocols({ policy: { capabilities: ['udp'] } }), ['udp']);
  assert.deepEqual(legacy.allowedProtocols(null), []);
  const first = { id: 'a', value: 1 }, replacement = { id: 'a', value: 2 }, pinned = { id: 'pin' };
  assert.deepEqual(legacy.candidateChoices([first, replacement, pinned], ['pin'], [pinned]), [replacement, pinned]);
  assert.equal(legacy.candidateChoices([first], [], [pinned])[0], first);
  for (const status of ['succeeded', 'ready']) assert.equal(legacy.stateTone(status.toUpperCase()), 'good');
  for (const status of ['failed', 'error', 'superseded', 'revoked']) assert.equal(legacy.stateTone(status), 'bad');
  for (const status of ['running', 'accepted', 'pending', 'degraded', 'draining']) assert.equal(legacy.stateTone(status), 'progress');
  assert.equal(legacy.stateTone(null), ''); assert.equal(legacy.pageCount(25, 25), 1); assert.equal(legacy.pageCount(26, 25), 2);
});
