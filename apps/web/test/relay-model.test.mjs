import test from 'node:test';
import assert from 'node:assert/strict';
import { relayCapable,relayProfile,relayEndpoint,relaySpec } from '../relay-model.js';
const node=(id)=>({
  id,revoked:false,credentialUntil:'2099-01-01T00:00:00Z',
  policy:{allowedListenerAddresses:['127.0.0.1','0.0.0.0'],allowedPorts:[25565,25566],
    capabilities:['adp.3','native.direct.v1','native.relay.v1','relay.wire.1','tcp','udp']}
});
const form={
  protocol:'both',listenAddress:'127.0.0.1',listenPort:'25565',targetHost:'10.0.0.12',targetPort:'25565',enabled:true
};
const profile={
  profileId:'relay-default',revision:1,config:{
    driver:'native.relay.v1',wireVersion:1,security:'mutual-tls13',protocols:['tcp','udp'],
    handshakeTimeoutSeconds:5,idleTimeoutSeconds:60,maxFrameBytes:16384,maxUdpDatagramBytes:1200,maxConnectionsPerNode:256
  }
};
test('Relay Profile builder follows bounded native-relay contract',()=>{
  assert.deepEqual(relayProfile({protocol:'both',handshakeTimeoutSeconds:'5',idleTimeoutSeconds:'60',maxFrameBytes:'16384',maxUdpDatagramBytes:'1200',maxConnectionsPerNode:'256'}),profile.config);
  assert.throws(()=>relayProfile({protocol:'both',handshakeTimeoutSeconds:'11',idleTimeoutSeconds:'60',maxFrameBytes:'16384',maxUdpDatagramBytes:'1200',maxConnectionsPerNode:'256'}));
  assert.throws(()=>relayProfile({protocol:'udp',handshakeTimeoutSeconds:'5',idleTimeoutSeconds:'60',maxFrameBytes:'64',maxUdpDatagramBytes:'1200',maxConnectionsPerNode:'256'}));
  assert.throws(()=>relayProfile({protocol:'ftp',handshakeTimeoutSeconds:'5',idleTimeoutSeconds:'60',maxFrameBytes:'16384',maxUdpDatagramBytes:'1200',maxConnectionsPerNode:'256'}));
});
test('Relay Endpoint accepts distinct TLS/TCP ports and bounded peer host facts',()=>{
  assert.deepEqual(relayEndpoint({listenAddress:'0.0.0.0',advertisedHost:'10.0.0.2',ports:'34001,34002'}),
    {listenAddress:'0.0.0.0',advertisedHost:'10.0.0.2',allowedTcpPorts:[34001,34002]});
  assert.throws(()=>relayEndpoint({listenAddress:'0.0.0.0',advertisedHost:'10.0.0.2',ports:'34001,34001'}));
  assert.throws(()=>relayEndpoint({listenAddress:'',advertisedHost:'',ports:'34001'}));
});
test('Relay spec binds two distinct authorized nodes and immutable Profile revision',()=>{
  const spec=relaySpec(form,node('node-a'),node('node-b'),profile);
  assert.deepEqual(spec,{
    enabled:true,protocols:['tcp','udp'],ingress:{nodeId:'node-a',listen:{address:'127.0.0.1',port:25565}},
    target:{host:'10.0.0.12',port:25565},path:{via:['node-b']},
    transport:{profileId:'relay-default',configRevision:1}
  });
  assert.throws(()=>relaySpec(form,node('node-a'),node('node-a'),profile));
  assert.throws(()=>relaySpec({...form,listenPort:'12345'},node('node-a'),node('node-b'),profile));
  assert.throws(()=>relaySpec(form,node('node-a'),node('node-b'),{...profile,revision:0}));
  assert.throws(()=>relaySpec(form,{...node('node-a'),revoked:true},node('node-b'),profile));
  assert.throws(()=>relaySpec(form,node('node-a'),{...node('node-b'),policy:{...node('node-b').policy,capabilities:['adp.3','native.direct.v1','tcp']}},profile));
  assert.equal(relayCapable(node('node-a')),true);
});
