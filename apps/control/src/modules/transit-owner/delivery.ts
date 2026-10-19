import { isCounter } from '@tunex/core';
import { ControlError } from '../../framework/public.ts';
import type { TransactionBoundary, TransitDeliveryStorage, TransitDeliveryOutboxRow } from '../../framework/public.ts';
import { nativeValueDigest as digest, readStoredValue as json, nativeWallClockNow as nowTime, nativeParseTime,
    TRANSIT_NEGOTIATION_CAPABILITIES, nativeTransitDeliveryCommand, nativeTransitPreviewCommand, nativeTransitDeliveryAck } from '../../compatibility/public.ts';
import type { TransitPreviewCommand, TransitDeliveryReport, TransitDeliveryAck } from '../../compatibility/public.ts';
import type { TransitDeliveryApi } from './contracts.ts';
import type { TransitPreviewPlanner, TransitCoordinationPhase } from './coordination-contracts.ts';
import { offlineTransitStep } from './coordination-step.ts';
import { verifyTransitStage } from './stage-values.ts';

function reject(code:string,message:string):never { throw new ControlError(code,409,message); }
async function requireMachine<Tx>(store:TransitDeliveryStorage<Tx>,tx:Tx,node:string,fingerprint:string,epoch:number,boot:string):Promise<void> {
    if(!/^[0-9a-f]{64}$/.test(fingerprint)||!isCounter(epoch))
        throw new ControlError('AUTHORIZATION_DENIED',403,'Valid mTLS identity and Session required');
    const machine=await store.machine(tx,node,fingerprint);
    if(!machine||machine.session_epoch!==epoch||machine.boot_id!==boot)
        reject('SESSION_SUPERSEDED','Transit preview requires current ADP/3 Hello boot');
    const now=nowTime();
    if(machine.node_revoked||machine.credential_revoked!==0||
        !machine.credential_until||machine.credential_until<=now||
        !machine.valid_until||machine.valid_until<=now||
        (machine.retire_after!==null&&machine.retire_after<=now))
        throw new ControlError('AUTHORIZATION_DENIED',403,'Current machine credential required');
    const capabilities=json<{capabilities?:unknown}>(machine.facts)?.capabilities;
    if(!Array.isArray(capabilities)||TRANSIT_NEGOTIATION_CAPABILITIES.some(c=>!capabilities.includes(c)))
        reject('UNSUPPORTED_CAPABILITY','Transit contract was not advertised by current Boot');
}
function decode(row:TransitDeliveryOutboxRow):TransitPreviewCommand {
    const command=nativeTransitDeliveryCommand(row.body);
    if(command.envelopeDigest!==row.envelope_digest||command.nodeId!==row.node_id||
        command.sessionEpoch!==row.session_epoch||command.forwardId!==row.forward_id||
        command.deploymentGeneration!==row.generation||command.coordinationRevision!==row.coordination_revision||
        command.commandDigest!==row.command_digest)
        reject('INTEGRITY_FAILURE','Transit preview storage identity differs');
    return command;
}

/** Preview transport and received receipts only; never advances execution coordination. */
export class TransitPreviewDelivery<Tx> implements TransitDeliveryApi {
    private readonly db:TransactionBoundary<Tx>;
    private readonly store:TransitDeliveryStorage<Tx>;
    private readonly coordination:TransitPreviewPlanner;
    constructor(db:TransactionBoundary<Tx>,store:TransitDeliveryStorage<Tx>,coordination:TransitPreviewPlanner) {
        this.db=db;this.store=store;this.coordination=coordination;
    }
    async enqueuePreview(actor:string,scope:string,forward:string,generation:number):Promise<TransitPreviewCommand> {
        const expected=await this.coordination.peek(actor,scope,forward,generation);
        if(!expected)reject('FENCING_REJECTED','No pending offline Transit preview step');
        return this.db.transaction(async tx=>{
            const stage=await this.store.stage(tx,scope,forward,generation);
            if(!stage||stage.created_by!==actor||stage.state!=='reserved')
                reject('AUTHORIZATION_DENIED','Transit staging actor or state differs');
            const plan=verifyTransitStage(stage);
            const position=await this.store.journal(tx,forward,generation);
            if(!position||position.revision!==expected.revision||position.plan_digest!==plan.planDigest)
                reject('FENCING_REJECTED','Transit coordination step already changed');
            const body={forwardId:forward,generation,planDigest:plan.planDigest,phase:position.phase as TransitCoordinationPhase,
                position:position.position,revision:position.revision,receiptHighwater:json<Record<string,number>>(position.receipt_highwater)};
            if(digest(body)!==position.journal_digest||offlineTransitStep(plan,body)?.commandDigest!==expected.commandDigest)
                reject('INTEGRITY_FAILURE','Transit current offline coordinator differs');
            const now=nowTime(),end=Math.min(stage.expires_at,plan.authorizationUntil,now+30000);
            if(end<=now+5000)reject('LEASE_EXPIRED','Transit offline preview validity exhausted');
            const bindings=plan.assignments.filter(a=>a.nodeId===expected.nodeId);
            if(!bindings.length)reject('INTEGRITY_FAILURE','Transit preview has no Node resources');
            const runtime=await this.store.runtime(tx,expected.nodeId);
            if(!runtime?.boot_id||bindings.some(a=>a.sessionEpoch!==runtime.session_epoch))
                reject('SESSION_SUPERSEDED','Transit preview Node session changed');
            for(const a of bindings){
                const slot=await this.store.slot(tx,a.nodeId,a.resource.physicalProtocol,a.resource.port);
                if(!slot||slot.owner_id!==forward||slot.fence!==a.bindingFence||slot.deployment_generation!==generation)
                    reject('FENCING_REJECTED','Transit preview physical reservation superseded');
            }
            const existing=await this.store.outbox(tx,forward,generation,expected.revision,expected.nodeId);
            if(existing){
                const command=decode(existing);
                if(command.bootId!==runtime.boot_id||command.sessionEpoch!==runtime.session_epoch)
                    reject('SESSION_SUPERSEDED','Previously queued Transit preview has retired Boot');
                return command;
            }
            const command=nativeTransitPreviewCommand({nodeId:expected.nodeId,bootId:runtime.boot_id,sessionEpoch:runtime.session_epoch,
                forwardId:forward,deploymentGeneration:generation,coordinationRevision:expected.revision,previewAction:expected.action,
                commandDigest:expected.commandDigest,issuedAt:now,validUntil:end});
            await this.store.insertOutbox(tx,{envelopeDigest:command.envelopeDigest,forward,generation,revision:expected.revision,
                node:expected.nodeId,epoch:runtime.session_epoch,commandDigest:expected.commandDigest,body:command,createdAt:now});
            return command;
        });
    }
    async poll(node:string,fingerprint:string,epoch:number,boot:string):Promise<TransitPreviewCommand|null> {
        return this.db.transaction(async tx=>{
            await requireMachine(this.store,tx,node,fingerprint,epoch,boot);
            const list=await this.store.pending(tx,node,epoch);
            for(const entry of list){
                const command=decode(entry),now=nowTime();
                if(command.bootId!==boot||nativeParseTime(command.validUntil)<=now||nativeParseTime(command.issuedAt)>now+5000)continue;
                const journal=await this.store.status(tx,entry.forward_id,entry.generation);
                if(!journal||journal.revision!==entry.coordination_revision||journal.phase==='quarantined'||journal.phase==='sealed')continue;
                return command;
            }
            return null;
        });
    }
    async report(node:string,fingerprint:string,epoch:number,report:TransitDeliveryReport):Promise<TransitDeliveryAck> {
        if(report.nodeId!==node||report.sessionEpoch!==epoch)
            reject('SESSION_SUPERSEDED','Transit delivery receipt Node/session mismatch');
        return this.db.transaction(async tx=>{
            await requireMachine(this.store,tx,node,fingerprint,epoch,report.bootId);
            const requestDigest=digest(report);
            const previous=await this.store.previousReceipt(tx,node,epoch,report.reportSequence);
            if(previous){
                if(previous.request_digest!==requestDigest)reject('INTEGRITY_FAILURE','Transit delivery receipt sequence reused with different body');
                return nativeTransitDeliveryAck(report,'duplicate');
            }
            const high=await this.store.highwater(tx,node,epoch);
            if(report.reportSequence<=(high?.last_sequence??0))reject('FENCING_REJECTED','Transit receipt sequence regressed');
            const row=await this.store.envelope(tx,report.envelopeDigest);
            if(!row||row.node_id!==node||row.session_epoch!==epoch||row.state!=='pending'||row.command_digest!==report.commandDigest)
                reject('FENCING_REJECTED','Transit receipt does not reference pending preview');
            const command=decode(row),now=nowTime(),observed=nativeParseTime(report.observedAt);
            if(command.bootId!==report.bootId||!Number.isFinite(observed)||Math.abs(now-observed)>30000||now>=nativeParseTime(command.validUntil))
                reject('LEASE_EXPIRED','Transit receipt boot or freshness differs');
            const journal=await this.store.status(tx,row.forward_id,row.generation,true);
            if(!journal||journal.revision!==row.coordination_revision||journal.phase==='quarantined'||journal.phase==='sealed')
                reject('FENCING_REJECTED','Transit coordinator advanced before delivery');
            await this.store.insertReceipt(tx,{node,epoch,sequence:report.reportSequence,envelopeDigest:report.envelopeDigest,requestDigest,receivedAt:now});
            const changed=await this.store.acknowledge(tx,report.envelopeDigest,now);
            if(changed!==1)reject('FENCING_REJECTED','Transit receipt was concurrently accepted');
            // A transport received ACK is not authenticated execution proof for confirm().
            return nativeTransitDeliveryAck(report,'accepted');
        });
    }
}
