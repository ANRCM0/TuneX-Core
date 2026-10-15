import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import { digest } from '@tunex/contracts';
import { compileTransitResources, compileTransitPreparation } from '../src/modules/runtime/transit-preparation.ts';
import type { ReservedTransitResource } from '../src/modules/runtime/transit-preparation.ts';

function fixture() {
  const forward: Forward = { id: 'forward-a', scopeId: 'scope-a', revision: 4,
    spec: { enabled: true, protocols: ['tcp', 'udp'],
      ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 32001 } },
      target: { host: '127.0.0.1', port: 32002 },
      path: { via: ['node-b', 'node-c'] },
      transport: { profileId: 'profile-a', configRevision: 1 } } };
  const profile = { profileId: 'profile-a', revision: 1, configDigest: '',
    config: { driver: 'native.relay.v1' as const, wireVersion: 1 as const,
      security: 'mutual-tls13' as const, protocols: ['tcp','udp'] as ('tcp'|'udp')[],
      handshakeTimeoutSeconds: 5, idleTimeoutSeconds: 60,
      maxFrameBytes: 65536, maxUdpDatagramBytes: 16384, maxConnectionsPerNode: 4096 } };
  profile.configDigest = digest(profile.config);
  const issuedAt = '2026-10-15T00:00:00Z';
  const nodes = ['node-a','node-b','node-c'].map((nodeId, index) => ({
    facts: { nodeId, scopeId: 'scope-a',
      capabilities: ['adp.3','adp.multihop.1','native.transit.v1','transit.wire.1',
        'native.relay.v1','relay.wire.1','tcp','udp'],
      allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [32001],
      egressPolicyRevision: 1, allowedDestinationCidrs: ['127.0.0.0/8'],
      allowMetadataTargets: false },
    sessionEpoch: index + 2, credentialUntil: Date.parse('2026-10-15T00:40:00Z'),
    peers: [{ fingerprint: 'sha256:' + String(index+1).repeat(64),
      validUntil: Date.parse('2026-10-15T00:30:00Z') }] }));
  const endpoints = ['node-b','node-c'].map((nodeId,index) => ({
    nodeId, revision: 1,
    config: { listenAddress:'127.0.0.1', advertisedHost:'127.0.0.1',
      allowedTcpPorts:[32101+index*2,32102+index*2] } }));
  const ports = { 'node-b': { tcp:32101,udp:32102 }, 'node-c': { tcp:32103,udp:32104 } };
  const resources = compileTransitResources({forward,nodes,profile,endpoints,ports});
  const reservations: ReservedTransitResource[] = resources.map((item,index) => ({
    ...item,forwardId:forward.id,deploymentGeneration:7,bindingFence:index+4 }));
  const peerPins = Object.fromEntries(nodes.map(n => [n.facts.nodeId,n.peers[0]!.fingerprint]));
  return {forward,nodes,profile,endpoints,reservations,issuedAt,peerPins,maxConnections:64};
}

test('Transit v1 preparation binds 3 Nodes, both protocols, sessions, pins, fences and tail-first activation',()=>{
  const input=fixture(),plan=compileTransitPreparation(input);
  assert.equal(plan.executable,false);
  assert.equal(plan.assignments.length,6);
  assert.equal(plan.intents.length,2);
  assert.deepEqual(plan.activationOrder,['node-c','node-b','node-a']);
  assert.equal(plan.authorizationUntil,Date.parse('2026-10-15T00:30:00Z'));
  for(const intent of plan.intents){
    assert.equal(intent.nodeId,'node-b');
    assert.equal(intent.upstream.nodeId,'node-a');
    assert.equal(intent.downstream.nodeId,'node-c');
    assert.equal(intent.pathDigest,plan.pathDigest);
    assert.equal(intent.deploymentGeneration,7);
    assert.equal(intent.downstream.bindingFence,plan.assignments.find(a=>a.nodeId==='node-c'&&a.protocol===intent.protocol)!.bindingFence);
    assert.equal(intent.listener.protocol,'tcp');
  }
  assert.equal(new Set(plan.assignments.filter(a=>a.role==='transit').map(a=>a.resource.port)).size,2);
  assert.equal(Object.isFrozen(plan.intents[0]),true);
  assert.equal(Object.isFrozen(plan.assignments[0]),true);
  assert.equal(Object.isFrozen(input.nodes[0]),false);
  const {planDigest,...body}=plan;
  assert.equal(digest(body),planDigest);
});

test('Multi-hop plan is deterministic across resource/facts order and does not mutate inputs',()=>{
  const input=fixture(),old=JSON.stringify(input);
  const a=compileTransitPreparation(input);
  const b=compileTransitPreparation({...input,nodes:[...input.nodes].reverse(),
    endpoints:[...input.endpoints].reverse(),reservations:[...input.reservations].reverse()});
  assert.equal(a.planDigest,b.planDigest);
  assert.equal(JSON.stringify(input),old);
});

test('Transit preparation refuses missing, foreign, mixed-generation, colliding and unfenced slots',()=>{
  for(const change of [
    (i:ReturnType<typeof fixture>)=>{i.reservations.pop();},
    (i:ReturnType<typeof fixture>)=>{Reflect.set(i.reservations[0]!, 'forwardId', 'foreign');},
    (i:ReturnType<typeof fixture>)=>{Reflect.set(i.reservations[0]!, 'bindingFence', 0);},
    (i:ReturnType<typeof fixture>)=>{Reflect.set(i.reservations[1]!, 'deploymentGeneration', i.reservations[1]!.deploymentGeneration + 1);},
    (i:ReturnType<typeof fixture>)=>{Reflect.set(i.reservations[3]!, 'port', i.reservations[2]!.port);},
    (i:ReturnType<typeof fixture>)=>{i.reservations.push({...i.reservations[0]!});},
  ]){const i=fixture();change(i);assert.throws(()=>compileTransitPreparation(i));}
});

test('Transit preparation rejects expired credentials, wrong peer, unadvertised versions, scope mismatch and bad adjacent target',()=>{
  const pin=fixture();pin.peerPins['node-c']='sha256:'+'f'.repeat(64);
  assert.throws(()=>compileTransitPreparation(pin),/AUTHORIZATION_DENIED/);
  const expired=fixture();expired.nodes[1]!.credentialUntil=Date.parse(expired.issuedAt);
  assert.throws(()=>compileTransitPreparation(expired),/AUTHORIZATION_DENIED/);
  const noVersion=fixture();noVersion.nodes[1]!.facts.capabilities.splice(1,1);
  assert.throws(()=>compileTransitPreparation(noVersion),/UNSUPPORTED_CAPABILITY/);
  const wrongScope=fixture();wrongScope.nodes[2]!.facts.scopeId='foreign';
  assert.throws(()=>compileTransitPreparation(wrongScope),/UNSUPPORTED_CAPABILITY/);
  const neighbor=fixture();neighbor.endpoints[0]!.config.advertisedHost='8.8.8.8';
  assert.throws(()=>compileTransitPreparation(neighbor),/AUTHORIZATION_DENIED/);
});

test('Multi-hop logical planning still refuses one- and two-Node current paths',()=>{
  const i=fixture();Reflect.set(i.forward.spec.path!, 'via', ['node-b']);
  assert.throws(()=>compileTransitPreparation(i),/UNSUPPORTED_CAPABILITY|AUTHORIZATION_DENIED/);
});
