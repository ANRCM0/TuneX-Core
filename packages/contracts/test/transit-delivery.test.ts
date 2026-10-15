import assert from 'node:assert/strict';
import {test} from 'node:test';
import {digest} from '../src/digest.ts';
import {parseTransitDelivery} from '../src/transit-delivery.ts';
import {parseRuntimeMessage} from '../src/adp3.ts';
function command(){
 const body={
  protocolVersion:3,extensionVersion:1,kind:'transit-command-preview-v1',
  executionEnabled:false,nodeId:'node-b',bootId:'boot-b',sessionEpoch:8,
  forwardId:'forward-1',deploymentGeneration:4,coordinationRevision:1,
  previewAction:'prepare',commandDigest:'sha256:'+'a'.repeat(64),
  issuedAt:'2026-10-15T00:00:00Z',validUntil:'2026-10-15T00:01:00Z',
 };
 return {...body,envelopeDigest:digest(body)};
}
function report(){
 const c=command();
 return {protocolVersion:3,extensionVersion:1,kind:'transit-delivery-report-v1',
  nodeId:c.nodeId,bootId:c.bootId,sessionEpoch:c.sessionEpoch,
  commandDigest:c.commandDigest,envelopeDigest:c.envelopeDigest,
  reportSequence:1,observedAt:'2026-10-15T00:00:25Z',condition:'received'};
}
test('non-executable ADP/3 preview and receipt round-trip, never Runtime Snapshot/Report',()=>{
 const c=parseTransitDelivery('Command',JSON.stringify(command()));
 const r=parseTransitDelivery('Report',JSON.stringify(report()));
 const a=parseTransitDelivery('Ack',JSON.stringify({
  protocolVersion:3,extensionVersion:1,kind:'transit-delivery-ack-v1',
  executionEnabled:false,nodeId:r.nodeId,bootId:r.bootId,sessionEpoch:r.sessionEpoch,
  commandDigest:r.commandDigest,envelopeDigest:r.envelopeDigest,
  reportSequence:r.reportSequence,status:'accepted',
 }));
 assert.equal(a.executionEnabled,false);
 assert.equal(r.condition,'received');
 assert.equal(c.previewAction,'prepare');
 assert.ok(Object.isFrozen(c));
 assert.throws(()=>parseRuntimeMessage('Snapshot',JSON.stringify(c)));
 assert.throws(()=>parseRuntimeMessage('ReportRequest',JSON.stringify(r)));
});
test('reject forged authority, wrong version, digest, report readiness and unsafe ACK',()=>{
 for(const mutate of [
  (c:any)=>{c.executionEnabled=true;},
  (c:any)=>{c.kind='transit-command-v1';},
  (c:any)=>{c.extensionVersion=2;},
  (c:any)=>{c.config={listener:{port:8080}};},
  (c:any)=>{c.previewAction='execute';},
  (c:any)=>{c.commandDigest='sha256:'+'b'.repeat(64);},
  (c:any)=>{c.envelopeDigest='sha256:'+'f'.repeat(64);},
  (c:any)=>{c.sessionEpoch=0;},
  (c:any)=>{c.validUntil=c.issuedAt;},
 ]){
  const c=command();mutate(c);
  assert.throws(()=>parseTransitDelivery('Command',JSON.stringify(c)));
 }
 for(const mutate of [
  (r:any)=>{r.condition='ready';},
  (r:any)=>{r.status='active';},
  (r:any)=>{r.reportSequence=0;},
  (r:any)=>{r.executionEnabled=true;},
 ]){
  const r=report();mutate(r);
  assert.throws(()=>parseTransitDelivery('Report',JSON.stringify(r)));
 }
 assert.throws(()=>parseTransitDelivery('Ack',JSON.stringify({
  protocolVersion:3,extensionVersion:1,kind:'transit-delivery-ack-v1',
  executionEnabled:true,nodeId:'node-b',bootId:'boot-b',sessionEpoch:8,
  commandDigest:'sha256:'+'a'.repeat(64),envelopeDigest:'sha256:'+'f'.repeat(64),
  reportSequence:1,status:'accepted',
 })));
});
