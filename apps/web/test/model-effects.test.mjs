import test from 'node:test';
import assert from 'node:assert/strict';
import * as legacy from '../model.js';
import * as owner from '../console-model-owner/public.js';
import { browserConsoleModelEffects } from '../browser-native/public.js';

test('model aliases preserve function identity and factory initialization does not read native time or effects', t => {
  t.mock.method(Date, 'now', () => assert.fail('unexpected wall clock read'));
  for (const name of ['validScope', 'parsePorts', 'parseCidrs', 'allowedProtocols', 'stateTone', 'pageCount', 'candidateChoices'])
    assert.equal(legacy[name], owner[name], name);
  const calls = [];
  const model = owner.createConsoleModel({ credentialActive: read => { calls.push(read()); return true; }, listResource: (...args) => { calls.push(args); return 'query'; } });
  assert.deepEqual(calls, []);
  const node = { id: 'n', canUse:true, allowedRoles:null, readDetail:'full', resourceSource:'private', policy: { capabilities: ['adp.3', 'native.direct.v1'], allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [80] } };
  assert.equal(model.directCapable({ ...node, revoked: true }), false);
  assert.equal(model.directCapable(node), true); assert.deepEqual(calls, []);
  assert.equal(model.directCapable({ ...node, credentialUntil: 'expiry' }), true);
  assert.deepEqual(calls, ['expiry']);
  assert.throws(() => model.listResource('../escape', 1)); assert.deepEqual(calls, ['expiry']);
  const filters = { status: 'failed' };
  assert.equal(model.listResource('operations', 2, filters), 'query');
  assert.equal(calls[1][2], filters); assert.deepEqual(calls[1], ['operations', 2, filters]);
});

test('native model credential evaluation preserves getter and parser lookup order even for invalid dates', t => {
  const order = [];
  t.mock.method(Date, 'parse', value => { order.push(['parse', value]); return NaN; });
  t.mock.method(Date, 'now', () => { order.push(['now']); return 100; });
  const node = { canUse:true, allowedRoles:null, readDetail:'full', resourceSource:'private', policy: { capabilities: ['adp.3', 'native.direct.v1'], allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [80] },
    get credentialUntil() { order.push(['get']); return 'invalid'; } };
  assert.equal(owner.createConsoleModel(browserConsoleModelEffects).directCapable(node), false);
  assert.deepEqual(order, [['get'], ['get'], ['parse', 'invalid'], ['now']]);
});
