import {parseRelayEndpoint} from '../src/modules/relay-endpoints.ts';
import {digest} from '@tunex/contracts';
import assert from 'node:assert/strict';import {test} from 'node:test';
import type {Forward} from '@tunex/core';import type {AuthorizedNodeFacts} from '../src/modules/runtime/planner.ts';import type {ResolvedProfile} from '../src/modules/transport-ports.ts';import {compileRelayResources} from '../src/modules/runtime/relay-planner.ts';
const forward:Forward={id:'forward-a',scopeId:'scope-a',revision:1,spec:{enabled:true,protocols:['tcp','udp'],ingress:{nodeId:'node-a',listen:{address:'127.0.0.1',port:32001}},target:{host:'127.0.0.1',port:32002},path:{via:['node-b']},transport:{profileId:'profile-a',configRevision:1}}};
const facts=(id:string):AuthorizedNodeFacts=>({nodeId:id,scopeId:'scope-a',capabilities:['adp.3','tcp','udp','native.relay.v1','adp.3','relay.wire.1'],allowedListenerAddresses:['127.0.0.1'],allowedPorts:[32001],egressPolicyRevision:1,allowedDestinationCidrs:['127.0.0.0/8'],allowMetadataTargets:false});
const profile:ResolvedProfile={profileId:'profile-a',revision:1,configDigest:'sha256:'+'1'.repeat(64),config:{driver:'native.relay.v1',wireVersion:1,security:'mutual-tls13',protocols:['tcp','udp'],handshakeTimeoutSeconds:5,idleTimeoutSeconds:60,maxFrameBytes:65536,maxUdpDatagramBytes:16384,maxConnectionsPerNode:4096}};
profile.configDigest=digest(profile.config);
const endpoint={nodeId:'node-b',revision:1,config:{listenAddress:'127.0.0.1',advertisedHost:'127.0.0.1',allowedTcpPorts:[32003,32004]}};
test('relay resource plan distinguishes public UDP from independent internal TLS TCP socket',()=>{const plan=compileRelayResources(forward,[facts('node-a'),facts('node-b')],profile,endpoint,{tcp:32003,udp:32004});assert.equal(plan.length,4);assert.equal(plan[3]!.forwardProtocol,'udp');assert.equal(plan[3]!.physicalProtocol,'tcp');assert.ok(Object.isFrozen(plan));});
test('relay plan refuses missing exact capability, wrong Profile revision and TLS resource conflict',()=>{assert.throws(()=>compileRelayResources(forward,[{...facts('node-a'),capabilities:['adp.3','native.direct.v1','tcp','udp']},facts('node-b')],profile,endpoint,{tcp:32003,udp:32004}),/UNSUPPORTED_CAPABILITY/);assert.throws(()=>compileRelayResources(forward,[facts('node-a'),facts('node-b')],{...profile,revision:2},endpoint,{tcp:32003,udp:32004}),/Locked Profile/);assert.throws(()=>compileRelayResources(forward,[facts('node-a'),facts('node-b')],profile,endpoint,{tcp:32003,udp:32003}),/distinct physical/);});
test('relay plan applies final target policy at egress and peer endpoint policy at ingress',()=>{assert.throws(()=>compileRelayResources(forward,[{...facts('node-a'),allowedDestinationCidrs:['10.0.0.0/8']},facts('node-b')],profile,endpoint,{tcp:32003,udp:32004}),/dial policy/);assert.throws(()=>compileRelayResources(forward,[facts('node-a'),{...facts('node-b'),allowedDestinationCidrs:['10.0.0.0/8']}],profile,endpoint,{tcp:32003,udp:32004}),/dial policy/);});

test('Relay reachable endpoints reject wildcard/multicast/mapped wildcard and duplicate internal ports',()=>{for(const advertisedHost of ['0.0.0.0','::','::ffff:0.0.0.0','224.0.0.1','ff02::1'])assert.throws(()=>parseRelayEndpoint({...endpoint.config,advertisedHost}));assert.throws(()=>parseRelayEndpoint({...endpoint.config,allowedTcpPorts:[32003,32003]}));});

test('current Relay resource allocator fails closed on a proposed Transit hop',()=>{
 const multi:Forward={...forward,spec:{...forward.spec,path:{via:['node-mid','node-b']}}};
 assert.throws(()=>compileRelayResources(multi,[facts('node-a'),facts('node-mid'),facts('node-b')],profile,endpoint,{tcp:32003,udp:32004}),/UNSUPPORTED_CAPABILITY/);
});
