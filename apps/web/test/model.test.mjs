import test from 'node:test';
import assert from 'node:assert/strict';
import { validScope, parsePorts, parseCidrs, directCapable, allowedProtocols, directSpec, stateTone, pageCount } from '../model.js';

const node = {
  id: 'node-a', revoked: false, credentialUntil: '2099-01-01T00:00:00Z',
  policy: {
    allowedListenerAddresses: ['127.0.0.1', '0.0.0.0'], allowedPorts: [25565, 25566],
    capabilities: ['adp.3', 'native.direct.v1', 'tcp', 'udp']
  }
};
test('scope IDs, ports and CIDRs reject invalid local form inputs', () => {
  assert.equal(validScope('scope.a-1'), true);
  assert.equal(validScope('../escape'), false);
  assert.deepEqual(parsePorts('25565,25566'), [25565, 25566]);
  assert.throws(() => parsePorts('25565,25565'));
  assert.throws(() => parsePorts('0'));
  assert.throws(() => parsePorts('65536'));
  assert.deepEqual(parseCidrs('10.0.0.0/8,192.168.0.0/16'), ['10.0.0.0/8','192.168.0.0/16']);
  assert.throws(() => parseCidrs('10.0.0.0/8,10.0.0.0/8'));
});
test('Direct form only offers authenticated capabilities and authorized listener slots', () => {
  assert.equal(directCapable(node), true);
  assert.deepEqual(allowedProtocols(node), ['tcp','udp','both']);
  assert.deepEqual(directSpec({protocol:'both',listenAddress:'127.0.0.1',listenPort:'25565',targetHost:'10.0.0.20',targetPort:'25565',enabled:true},node), {
    enabled:true,protocols:['tcp','udp'],ingress:{nodeId:'node-a',listen:{address:'127.0.0.1',port:25565}},target:{host:'10.0.0.20',port:25565}
  });
  assert.throws(() => directSpec({protocol:'tcp',listenAddress:'127.0.0.1',listenPort:'80',targetHost:'10.0.0.20',targetPort:'80',enabled:true},node));
  assert.throws(() => directSpec({protocol:'quic',listenAddress:'127.0.0.1',listenPort:'25565',targetHost:'10.0.0.20',targetPort:'80',enabled:true},node));
  assert.equal(directCapable({...node,revoked:true}), false);
  assert.equal(directCapable({...node,credentialUntil:'2020-01-01T00:00:00Z'}), false);
  assert.equal(directCapable({...node,policy:{...node.policy,capabilities:['adp.3','tcp']}}), false);
});
test('Operation state never derives healthy from accepted deployment', () => {
  assert.equal(stateTone('accepted'),'progress');
  assert.equal(stateTone('running'),'progress');
  assert.equal(stateTone('failed'),'bad');
  assert.equal(stateTone('succeeded'),'good');
  assert.equal(stateTone('unknown'),'');
  assert.equal(pageCount(0,25),1);
  assert.equal(pageCount(76,25),4);
});
