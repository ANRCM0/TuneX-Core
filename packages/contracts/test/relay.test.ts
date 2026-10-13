import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import type { RelayMessages } from '../src/relay.ts';
import { parseRelayMessage,parseRelayAssignment } from '../src/relay.ts';
const binding={scopeId:'scope-a',forwardId:'forward-a',forwardRevision:1,deploymentGeneration:1,ingressNodeId:'node-a',egressNodeId:'node-b',ingressAssignmentId:'assignment-a',egressAssignmentId:'assignment-b',ingressSessionEpoch:2,egressSessionEpoch:3,ingressFence:4,egressFence:5,profileId:'profile-a',profileRevision:1,profileDigest:'sha256:'+'1'.repeat(64)};
const profile={driver:'native.relay.v1',wireVersion:1,security:'mutual-tls13',protocols:['tcp','udp'],handshakeTimeoutSeconds:5,idleTimeoutSeconds:60,maxFrameBytes:65536,maxUdpDatagramBytes:16384,maxConnectionsPerNode:4096};
test('relay profile and open are strict, bounded and immutable values',()=>{const value=parseRelayMessage('ProfileConfig',JSON.stringify(profile));assert.equal(JSON.stringify(value),JSON.stringify(profile));assert.ok(Object.isFrozen(value));const open=parseRelayMessage('Open',JSON.stringify({wireVersion:1,type:'open',action:'probe',requestId:'request-a',binding}));assert.equal(open.binding.egressNodeId,'node-b');});
test('relay rejects downgrade, malformed limits and same endpoint identities',()=>{assert.throws(()=>parseRelayMessage('ProfileConfig',JSON.stringify({...profile,security:'plaintext'})),/rejected/);assert.throws(()=>parseRelayMessage('ProfileConfig',JSON.stringify({...profile,maxUdpDatagramBytes:65537})),/rejected/);assert.throws(()=>parseRelayMessage('Open',JSON.stringify({wireVersion:1,type:'open',action:'tcp',requestId:'request-a',binding:{...binding,egressNodeId:'node-a'}})),/Distinct Relay/);});
test('relay rejects duplicate keys and unknown control fields',()=>{assert.throws(()=>parseRelayMessage('Open',`{"wireVersion":1,"type":"open","action":"probe","requestId":"request-a","binding":${JSON.stringify(binding)},"extra":true}`),/rejected/);assert.throws(()=>parseRelayMessage('Open','{"wireVersion":1,"wireVersion":1,"type":"open","action":"probe","requestId":"request-a","binding":'+JSON.stringify(binding)+'}'),/Duplicate JSON key/);});

const fixture=JSON.parse(readFileSync(new URL('../../../docs/protocol/fixtures/native-relay-v1.json',import.meta.url),'utf8')) as {cases:{name:string;schema:keyof RelayMessages;raw:string;valid:boolean}[]};
for(const item of fixture.cases)test(`shared Relay contract: ${item.name}`,()=>{if(item.valid)assert.doesNotThrow(()=>parseRelayMessage(item.schema,item.raw));else assert.throws(()=>parseRelayMessage(item.schema,item.raw));});

const adp3=JSON.parse(readFileSync(new URL('../../../docs/protocol/fixtures/adp-v3-relay.json',import.meta.url),'utf8')) as {cases:{name:string;schema:'Assignment'|'Tombstone';raw:string;valid:boolean}[]};
for(const item of adp3.cases)test(`shared ADP/3 resource: ${item.name}`,()=>{if(item.valid)assert.doesNotThrow(()=>parseRelayAssignment(item.schema,item.raw));else assert.throws(()=>parseRelayAssignment(item.schema,item.raw));});
