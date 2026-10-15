import {isCounter} from '@tunex/core';
import {digest,parseTransitDelivery,TRANSIT_NEGOTIATION_CAPABILITIES} from '@tunex/contracts';
import type {TransitPreviewCommand,TransitDeliveryReport,TransitDeliveryAck} from '@tunex/contracts';
import {ControlError} from '../../application/errors.ts';
import type {MySqlUnitOfWork,Transaction} from '../../infrastructure/mysql.ts';
import {json,rows,write} from '../../infrastructure/mysql.ts';
import {TransitCoordinationJournal,offlineTransitStep} from './transit-coordination.ts';
import type {OfflineTransitCommand,TransitCoordinationPhase} from './transit-coordination.ts';
import {verifyTransitStage} from './transit-staging.ts';
import type {TransitStageRow} from './transit-staging.ts';

interface OutboxRow {
 envelope_digest:string;forward_id:string;generation:number;coordination_revision:number;
 node_id:string;session_epoch:number;command_digest:string;body:unknown;
 state:'pending'|'acknowledged';created_at:number;acknowledged_at:number|null;
}
interface CoordinationRow{
 revision:number;phase:TransitCoordinationPhase;position:number;plan_digest:string;
 receipt_highwater:unknown;journal_digest:string;
}
interface MachineRow{
 session_epoch:number;boot_id:string|null;node_revoked:number;
 credential_revoked:number|null;valid_until:number|null;retire_after:number|null;
 credential_until:number|null;facts:unknown;
}
function reject(code:string,message:string):never {
 throw new ControlError(code,409,message);
}
/** Call only INSIDE a transaction. The API already verified the peer TLS certificate
 * and mapped its fingerprint to an authorized Node, but this repeats the lock-bound
 * identity, current Hello, credential and capability checks to rule out races.
 */
async function requireMachine(
 tx:Transaction,node:string,fingerprint:string,epoch:number,boot:string,
):Promise<void>{
 if(!/^[0-9a-f]{64}$/.test(fingerprint)||!isCounter(epoch))
  throw new ControlError('AUTHORIZATION_DENIED',403,'Valid mTLS identity and Session required');
 const machine=(await rows<MachineRow>(tx,
   `SELECT r.session_epoch,r.boot_id,n.revoked node_revoked,n.credential_until,n.facts,
     c.revoked credential_revoked,c.valid_until,c.retire_after
    FROM runtime_nodes r JOIN nodes n ON n.id=r.node_id
    LEFT JOIN node_credentials c ON c.node_id=r.node_id AND c.fingerprint=?
    WHERE r.node_id=? FOR UPDATE`,[fingerprint,node]))[0];
 if(!machine||machine.session_epoch!==epoch||machine.boot_id!==boot)
  reject('SESSION_SUPERSEDED','Transit preview requires current ADP/3 Hello boot');
 const now=Date.now();
 if(machine.node_revoked||machine.credential_revoked!==0||
    !machine.credential_until||machine.credential_until<=now||
    !machine.valid_until||machine.valid_until<=now||
    (machine.retire_after!==null&&machine.retire_after<=now))
  throw new ControlError('AUTHORIZATION_DENIED',403,'Current machine credential required');
 const capabilities=json<{capabilities?:unknown}>(machine.facts)?.capabilities;
 if(!Array.isArray(capabilities)||
    TRANSIT_NEGOTIATION_CAPABILITIES.some(c=>!capabilities.includes(c)))
  reject('UNSUPPORTED_CAPABILITY','Transit contract was not advertised by current Boot');
}
function decode(row:OutboxRow):TransitPreviewCommand{
 const command=parseTransitDelivery('Command',JSON.stringify(json(row.body)));
 if(command.envelopeDigest!==row.envelope_digest||command.nodeId!==row.node_id||
    command.sessionEpoch!==row.session_epoch||command.forwardId!==row.forward_id||
    command.deploymentGeneration!==row.generation||
    command.coordinationRevision!==row.coordination_revision||
    command.commandDigest!==row.command_digest)
  reject('INTEGRITY_FAILURE','Transit preview storage identity differs');
 return command;
}
function acknowledge(report:TransitDeliveryReport,status:'accepted'|'duplicate'):TransitDeliveryAck{
 return parseTransitDelivery('Ack',JSON.stringify({
  protocolVersion:3,extensionVersion:1,kind:'transit-delivery-ack-v1',
  executionEnabled:false,nodeId:report.nodeId,bootId:report.bootId,
  sessionEpoch:report.sessionEpoch,commandDigest:report.commandDigest,
  envelopeDigest:report.envelopeDigest,reportSequence:report.reportSequence,status,
 }));
}

/** Real mTLS HTTP transport, deliberately without any command executor. Only
 * internal offline staging tests can enqueue a preview. Production request
 * handlers expose read-only poll and "received" ACK only.
 */
export class TransitDeliveryService{
 private readonly db:MySqlUnitOfWork;
 private readonly coordination:TransitCoordinationJournal;
 constructor(db:MySqlUnitOfWork){
  this.db=db;this.coordination=new TransitCoordinationJournal(db);
 }
 /** No public HTTP route calls this. Require an existing exact immutable,
  * still-owned staged coordinator step; a "received" ACK cannot advance it.
  */
 async enqueuePreview(actor:string,scope:string,forward:string,generation:number)
  :Promise<TransitPreviewCommand>{
  const expected=await this.coordination.peek(actor,scope,forward,generation);
  if(!expected)reject('FENCING_REJECTED','No pending offline Transit preview step');
  return this.db.transaction(async tx=>{
   const stage=(await rows<TransitStageRow>(tx,
    'SELECT * FROM transit_deployments WHERE forward_id=? AND generation=? AND scope_id=? FOR UPDATE',
    [forward,generation,scope]))[0];
   if(!stage||stage.created_by!==actor||stage.state!=='reserved')
    reject('AUTHORIZATION_DENIED','Transit staging actor or state differs');
   const plan=verifyTransitStage(stage);
   const position=(await rows<CoordinationRow>(tx,
    'SELECT revision,phase,position,plan_digest,receipt_highwater,journal_digest FROM transit_coordination WHERE forward_id=? AND generation=? FOR UPDATE',
    [forward,generation]))[0];
   if(!position||position.revision!==expected.revision||position.plan_digest!==plan.planDigest)
    reject('FENCING_REJECTED','Transit coordination step already changed');
   const body={forwardId:forward,generation,planDigest:plan.planDigest,phase:position.phase,
    position:position.position,revision:position.revision,
    receiptHighwater:json(position.receipt_highwater)};
   if(digest(body)!==position.journal_digest||
      offlineTransitStep(plan,body)?.commandDigest!==expected.commandDigest)
    reject('INTEGRITY_FAILURE','Transit current offline coordinator differs');
   const now=Date.now(),end=Math.min(stage.expires_at,plan.authorizationUntil,now+30000);
   if(end<=now+5000)
    reject('LEASE_EXPIRED','Transit offline preview validity exhausted');
   const bindings=plan.assignments.filter(a=>a.nodeId===expected.nodeId);
   if(!bindings.length)reject('INTEGRITY_FAILURE','Transit preview has no Node resources');
   const runtime=(await rows<{session_epoch:number;boot_id:string|null}>(tx,
    'SELECT session_epoch,boot_id FROM runtime_nodes WHERE node_id=? FOR UPDATE',
    [expected.nodeId]))[0];
   if(!runtime?.boot_id||bindings.some(a=>a.sessionEpoch!==runtime.session_epoch))
    reject('SESSION_SUPERSEDED','Transit preview Node session changed');
   for(const a of bindings){
    const slot=(await rows<{owner_id:string|null;fence:number;deployment_generation:number}>(tx,
     'SELECT owner_id,fence,deployment_generation FROM port_slots WHERE node_id=? AND protocol=? AND port=? FOR UPDATE',
     [a.nodeId,a.resource.physicalProtocol,a.resource.port]))[0];
    if(!slot||slot.owner_id!==forward||slot.fence!==a.bindingFence||
      slot.deployment_generation!==generation)
     reject('FENCING_REJECTED','Transit preview physical reservation superseded');
   }
   const existing=(await rows<OutboxRow>(tx,
    'SELECT * FROM transit_delivery_outbox WHERE forward_id=? AND generation=? AND coordination_revision=? AND node_id=? FOR UPDATE',
    [forward,generation,expected.revision,expected.nodeId]))[0];
   if(existing){
    const command=decode(existing);
    if(command.bootId!==runtime.boot_id||command.sessionEpoch!==runtime.session_epoch)
     reject('SESSION_SUPERSEDED','Previously queued Transit preview has retired Boot');
    return command;
   }
   const envelope={
    protocolVersion:3 as const,extensionVersion:1 as const,
    kind:'transit-command-preview-v1' as const,executionEnabled:false as const,
    nodeId:expected.nodeId,bootId:runtime.boot_id,sessionEpoch:runtime.session_epoch,
    forwardId:forward,deploymentGeneration:generation,
    coordinationRevision:expected.revision,previewAction:expected.action,
    commandDigest:expected.commandDigest,
    issuedAt:new Date(now).toISOString(),validUntil:new Date(end).toISOString(),
   };
   const command=parseTransitDelivery('Command',
    JSON.stringify({...envelope,envelopeDigest:digest(envelope)}));
   await write(tx,
    'INSERT INTO transit_delivery_outbox(envelope_digest,forward_id,generation,coordination_revision,node_id,session_epoch,command_digest,body,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
    [command.envelopeDigest,forward,generation,expected.revision,expected.nodeId,
     runtime.session_epoch,expected.commandDigest,JSON.stringify(command),'pending',now]);
   return command;
  });
 }
 async poll(node:string,fingerprint:string,epoch:number,boot:string)
  :Promise<TransitPreviewCommand|null>{
  return this.db.transaction(async tx=>{
   await requireMachine(tx,node,fingerprint,epoch,boot);
   const list=await rows<OutboxRow>(tx,
    "SELECT * FROM transit_delivery_outbox WHERE node_id=? AND session_epoch=? AND state='pending' ORDER BY created_at,envelope_digest LIMIT 16 FOR UPDATE",
    [node,epoch]);
   for(const entry of list){
    const command=decode(entry),now=Date.now();
    if(command.bootId!==boot||Date.parse(command.validUntil)<=now||
       Date.parse(command.issuedAt)>now+5000)continue;
    const journal=(await rows<{revision:number;phase:string}>(tx,
     'SELECT revision,phase FROM transit_coordination WHERE forward_id=? AND generation=?',
     [entry.forward_id,entry.generation]))[0];
    if(!journal||journal.revision!==entry.coordination_revision||
       journal.phase==='quarantined'||journal.phase==='sealed')continue;
    return command;
   }
   return null;
  });
 }
 async report(node:string,fingerprint:string,epoch:number,report:TransitDeliveryReport)
  :Promise<TransitDeliveryAck>{
  if(report.nodeId!==node||report.sessionEpoch!==epoch)
   reject('SESSION_SUPERSEDED','Transit delivery receipt Node/session mismatch');
  return this.db.transaction(async tx=>{
   await requireMachine(tx,node,fingerprint,epoch,report.bootId);
   const requestDigest=digest(report);
   const previous=(await rows<{request_digest:string}>(tx,
    'SELECT request_digest FROM transit_delivery_receipts WHERE node_id=? AND session_epoch=? AND report_sequence=?',
    [node,epoch,report.reportSequence]))[0];
   if(previous){
    if(previous.request_digest!==requestDigest)
     reject('INTEGRITY_FAILURE','Transit delivery receipt sequence reused with different body');
    return acknowledge(report,'duplicate');
   }
   const high=(await rows<{last_sequence:number|null}>(tx,
    'SELECT MAX(report_sequence) last_sequence FROM transit_delivery_receipts WHERE node_id=? AND session_epoch=?',
    [node,epoch]))[0];
   if(report.reportSequence<=(high?.last_sequence??0))
    reject('FENCING_REJECTED','Transit receipt sequence regressed');
   const row=(await rows<OutboxRow>(tx,
    'SELECT * FROM transit_delivery_outbox WHERE envelope_digest=? FOR UPDATE',
    [report.envelopeDigest]))[0];
   if(!row||row.node_id!==node||row.session_epoch!==epoch||
      row.state!=='pending'||row.command_digest!==report.commandDigest)
    reject('FENCING_REJECTED','Transit receipt does not reference pending preview');
   const command=decode(row),now=Date.now(),observed=Date.parse(report.observedAt);
   if(command.bootId!==report.bootId||!Number.isFinite(observed)||
      Math.abs(now-observed)>30000||now>=Date.parse(command.validUntil))
    reject('LEASE_EXPIRED','Transit receipt boot or freshness differs');
   const journal=(await rows<{revision:number;phase:string}>(tx,
    'SELECT revision,phase FROM transit_coordination WHERE forward_id=? AND generation=? FOR UPDATE',
    [row.forward_id,row.generation]))[0];
   if(!journal||journal.revision!==row.coordination_revision||
      journal.phase==='quarantined'||journal.phase==='sealed')
    reject('FENCING_REJECTED','Transit coordinator advanced before delivery');
   await write(tx,
    'INSERT INTO transit_delivery_receipts(node_id,session_epoch,report_sequence,envelope_digest,request_digest,received_at) VALUES(?,?,?,?,?,?)',
    [node,epoch,report.reportSequence,report.envelopeDigest,requestDigest,now]);
   const changed=await write(tx,
    "UPDATE transit_delivery_outbox SET state='acknowledged',acknowledged_at=? WHERE envelope_digest=? AND state='pending'",
    [now,report.envelopeDigest]);
   if(changed!==1)reject('FENCING_REJECTED','Transit receipt was concurrently accepted');
   // Deliberately NO call to TransitCoordinationJournal.confirm: transport
   // 'received' is not an authenticated Agent Ready/removed execution report.
   return acknowledge(report,'accepted');
  });
 }
}
