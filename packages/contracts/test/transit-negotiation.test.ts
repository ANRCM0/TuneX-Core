import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseRuntimeMessage} from '../src/adp3.ts';
import {checkTransitNegotiation,parseTransitNegotiation,TRANSIT_NEGOTIATION_CAPABILITIES} from '../src/transit-negotiation.ts';

function request(){
 return {protocolVersion:3,extensionVersion:1,nodeId:'node-b',bootId:'boot-b',
  sessionEpoch:8,requiredCapabilities:[...TRANSIT_NEGOTIATION_CAPABILITIES],
  lastStoredTransitGeneration:0};
}
function response(){
 return {protocolVersion:3,extensionVersion:1,nodeId:'node-b',bootId:'boot-b',
  sessionEpoch:8,requiredCapabilities:[...TRANSIT_NEGOTIATION_CAPABILITIES],
  serverTime:'2026-10-15T12:00:00Z',state:'contract-only',executionEnabled:false};
}
test('read-only Transit negotiation validates strictly and never implies an execution grant',()=>{
 const req=parseTransitNegotiation('Request',JSON.stringify(request()));
 const ack=parseTransitNegotiation('Response',JSON.stringify(response()));
 assert.doesNotThrow(()=>checkTransitNegotiation(req,ack));
 assert.ok(Object.isFrozen(req.requiredCapabilities));
 assert.equal(ack.executionEnabled,false);
 assert.equal(ack.state,'contract-only');
 assert.throws(()=>parseRuntimeMessage('HelloResponse',JSON.stringify(ack)),
  /INVALID_CONFIG/); // Legacy ADP/3 Hello is not the extension
});
test('Transit negotiation refuses downgrade, unknown authority, Node/session and grant tampering',()=>{
 const r=request(),a=response();
 for (const mutate of [
  (x:any)=>{x.extensionVersion=2;},
  (x:any)=>{x.requiredCapabilities=['native.relay.v1'];},
  (x:any)=>{x.requiredCapabilities.reverse();},
  (x:any)=>{x.extra={grant:true};},
  (x:any)=>{x.lastStoredTransitGeneration=-1;},
  (x:any)=>{x.sessionEpoch=0;},
 ]){
  const copy=structuredClone(r);mutate(copy);
  assert.throws(()=>parseTransitNegotiation('Request',JSON.stringify(copy)));
 }
 for (const mutate of [
  (x:any)=>{x.executionEnabled=true;},
  (x:any)=>{x.state='active';},
  (x:any)=>{x.requiredCapabilities=['adp.multihop.1'];},
  (x:any)=>{x.leaseUntil='2099-01-01T00:00:00Z';},
 ]){
  const copy=structuredClone(a);mutate(copy);
  assert.throws(()=>parseTransitNegotiation('Response',JSON.stringify(copy)));
 }
 for (const mutate of [
  (x:any)=>{x.bootId='older-boot';},
  (x:any)=>{x.nodeId='other-node';},
  (x:any)=>{x.sessionEpoch=9;},
 ]){
  const copy=structuredClone(a);mutate(copy);
  assert.throws(()=>checkTransitNegotiation(
   parseTransitNegotiation('Request',JSON.stringify(r)),
   parseTransitNegotiation('Response',JSON.stringify(copy))));
 }
});
