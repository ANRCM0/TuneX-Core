import { MAX_COUNTER, isCounter } from '@tunex/core';
import type { Forward } from '@tunex/core';
import type { Policy } from '@tunex/contracts/policy';
import type { RuntimeValueFamily, RuntimeMessagesFor, RuntimeSnapshotFor } from '@tunex/contracts/execution-values';
import { holdPublishedSnapshot, reusePublishedSnapshot, publicationDeadline } from '../kernel/public.ts';
import { ControlError } from './errors.ts';
import type { ForwardRuntimeStatus, RuntimeMachinePort } from './runtime-contracts.ts';
import type { RuntimeHostOptions, RuntimeNodeState } from './runtime-host-ports.ts';

/** Runtime orchestration uses transaction-aware ports; physical storage stays outside. */
export class RuntimeHost<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> implements RuntimeMachinePort<F> {
    private readonly ports:RuntimeHostOptions<Tx,F>;
    private readonly policy:Policy;
    private readonly now:()=>number;
    constructor(ports:RuntimeHostOptions<Tx,F>) {
        this.ports={...ports};
        const now=ports.now;
        if(typeof now!=='function'||typeof ports.codec?.parseTime!=='function'||typeof ports.codec?.formatTime!=='function')
            throw new Error('Runtime clock and time codec are required');
        if(typeof ports.codec.checkHelloProtocol!=='function'||typeof ports.codec.checkHelloCapabilities!=='function'||
            typeof ports.codec.helloResponse!=='function'||typeof ports.codec.reportAck!=='function')
            throw new Error('Runtime machine codec is required');
        this.now=now;
        this.policy={...ports.codec.validatePolicy(ports.policy??{...ports.codec.defaultPolicy},this.now())};
        if(this.policy.leaseSeconds>300||this.policy.maxClockSkewSeconds>5)
            throw new Error('Runtime policy cannot weaken the 300-second/5-second authorization baseline');
    }
    private async locked(tx:Tx,nodeId:string,epoch?:number):Promise<RuntimeNodeState> {
        const related=this.ports.relay?await this.ports.relay.relatedNodeIDs(tx,nodeId):[nodeId];
        let state:RuntimeNodeState|undefined;
        for(const id of related) {
            const current=await this.ports.store.lockNode(tx,id);if(id===nodeId)state=current;
        }
        if(!state||epoch!==undefined&&(!isCounter(epoch)||state.session_epoch!==epoch))
            throw new ControlError('SESSION_SUPERSEDED',409,'Current Node session required');
        return state;
    }
    async hello(nodeId:string,input:RuntimeMessagesFor<F>['HelloRequest'],fingerprint?:string):Promise<RuntimeMessagesFor<F>['HelloResponse']> {
        this.ports.codec.checkHelloProtocol(input);
        if(input.nodeId!==nodeId)throw new ControlError('AUTHORIZATION_DENIED',403,'Foreign Node identity');
        this.ports.codec.checkHelloCapabilities(input);
        return this.ports.db.transaction(async tx=>{
            const current=await this.locked(tx,nodeId);
            if(fingerprint)await this.ports.nodes.credential(tx,nodeId,fingerprint);
            const authorized=await this.ports.nodes.facts(tx,nodeId);
            if(input.lastStoredSnapshotGeneration>current.snapshot_generation)
                throw new ControlError('INTEGRITY_FAILURE',409,'Control history is older than Node state');
            let epoch=current.session_epoch;
            const boot=await this.ports.store.boot(tx,nodeId,input.bootId);
            if(boot&&(boot.session_epoch!==epoch||input.bootId!==current.boot_id))
                throw new ControlError('SESSION_SUPERSEDED',409,'Boot already retired');
            if(boot&&this.ports.codec.digest([...authorized.facts.capabilities].sort())!==this.ports.codec.digest([...input.capabilities].sort()))
                throw new ControlError('INTEGRITY_FAILURE',409,'Current boot capabilities cannot change');
            if(!boot) {
                if(epoch>=MAX_COUNTER)throw new ControlError('RESOURCE_LIMIT',429,'Session counter exhausted');
                epoch++;
                await this.ports.store.beginBoot(tx,nodeId,input.bootId,epoch);
                await this.ports.nodes.capabilities(tx,nodeId,input.capabilities);
            }
            return this.ports.codec.helloResponse(nodeId,input.bootId,epoch,this.ports.codec.formatTime(this.now()),{...this.policy});
        });
    }
    private async publish(tx:Tx,state:RuntimeNodeState,claim?:{id:string;token:string;until:number},fingerprint?:string):Promise<RuntimeSnapshotFor<F>> {
        const node=await this.ports.nodes.state(tx,state.node_id),{facts}=node;
        const credentialUntil=fingerprint?await this.ports.nodes.credential(tx,state.node_id,fingerprint):node.credentialUntil;
        const withdrawn=node.revoked||credentialUntil<=this.now();
        const previous=await this.ports.store.snapshot(tx,state.node_id,state.snapshot_generation),now=this.now();
        const awaitingClaim=await this.ports.store.awaitingClaim(tx,state.node_id);
        if(this.ports.relay)await this.ports.relay.advanceForNode(tx,state.node_id);
        const assignments=(withdrawn?[]:await this.ports.ledger.assignments(tx,facts)).map(a=>({...a,drainTimeoutSeconds:this.policy.drainTimeoutSeconds}));
        const multihopPreserved=previous?.assignments.every(old=>!old.role.startsWith('multihop-')||assignments.some(a=>
            a.assignmentId===old.assignmentId&&a.deploymentGeneration===old.deploymentGeneration&&a.bindingFence===old.bindingFence&&
            a.phase===old.phase&&a.driver.configDigest===old.driver.configDigest))??false;
        const published=previous?{sessionEpoch:previous.sessionEpoch,validUntil:this.ports.codec.parseTime(previous.validUntil)}:undefined;
        // Queued work cannot defer renewal until the Agent's skew-adjusted cutoff.
        // Keep the original hold predicate and also honor ordinary renewal lead.
        if(previous&&published&&published.validUntil-now>this.policy.renewalLeadSeconds*1000&&
            holdPublishedSnapshot(published,{sessionEpoch:state.session_epoch,now,credentialUntil,withdrawn,awaitingClaim,multihopPreserved}))return previous;
        const relayUntil=this.ports.relay?await this.ports.relay.authorizationBound(tx,assignments):Number.MAX_SAFE_INTEGER;
        if(previous&&reusePublishedSnapshot(published,{sessionEpoch:state.session_epoch,now,credentialUntil,relayUntil,
            renewalLeadSeconds:this.policy.renewalLeadSeconds,assignmentsUnchanged:previous.sessionEpoch===state.session_epoch&&
                this.ports.codec.digest(previous.assignments)===this.ports.codec.digest(assignments)}))return previous;
        if(!state.session_epoch)throw new ControlError('SESSION_SUPERSEDED',409,'Hello required before snapshot');
        if(state.snapshot_generation>=MAX_COUNTER)throw new ControlError('RESOURCE_LIMIT',429,'Snapshot counter exhausted');
        await this.ports.ledger.retireChanged(tx,state.node_id,previous,assignments,state.snapshot_generation+1);
        const tombstones=await this.ports.ledger.tombstones(tx,state.node_id,state.snapshot_generation+1);
        const validUntil=publicationDeadline({now,leaseSeconds:this.policy.leaseSeconds,credentialUntil,relayUntil,withdrawn});
        const snapshot=this.ports.codec.compileSnapshot({nodeId:state.node_id,sessionEpoch:state.session_epoch,snapshotGeneration:state.snapshot_generation+1,
            issuedAt:this.ports.codec.formatTime(now),validUntil:this.ports.codec.formatTime(validUntil),assignments,tombstones,policy:this.policy});
        await this.ports.ledger.verifyPublishable(tx,assignments);
        if(claim) {
            const current=await this.ports.store.operation(tx,claim.id);
            if(!current||current.status!=='running'||current.claim_token!==claim.token||claim.until<=this.now()||current.execution_deadline<=this.now())
                throw new ControlError('STALE_CLAIM',409,'Worker claim expired before publication');
        }
        if(!this.ports.authority)throw new Error('Protected authority recorder required before publication');
        await this.ports.authority.issue(this.ports.codec.parseTime(snapshot.validUntil),this.policy.leaseSeconds,this.policy.maxClockSkewSeconds);
        await this.ports.store.saveSnapshot(tx,snapshot);
        await this.ports.ledger.recordLeases(tx,snapshot);
        return snapshot;
    }
    async snapshot(nodeId:string,epoch:number,fingerprint?:string):Promise<RuntimeSnapshotFor<F>> {
        return this.ports.db.transaction(async tx=>{
            const snapshot=await this.publish(tx,await this.locked(tx,nodeId,epoch),undefined,fingerprint);
            await this.ports.ledger.complete(tx,nodeId);return snapshot;
        });
    }
    async tick():Promise<void> {
        const cleanup=await this.ports.store.cleanupNodeIDs();
        const relay=this.ports.relay;
        const relayNodes=relay?await this.ports.db.transaction(tx=>relay.pendingNodeIDs(tx)):[];
        for(const nodeId of new Set([...relayNodes,...cleanup]))
            await this.ports.db.transaction(async tx=>{
                const state=await this.locked(tx,nodeId);
                if(state.session_epoch)await this.publish(tx,state);
                await this.ports.ledger.complete(tx,nodeId);
                if(relay)await relay.advanceForNode(tx,nodeId);
            });
        const claim=await this.ports.db.transaction(tx=>this.ports.ledger.claim(tx));
        if(!claim)return;
        await this.ports.db.transaction(async tx=>{
            const stored=await this.ports.forwards.record(tx,claim.scope_id,claim.forward_id);
            const forward:Forward={id:stored.id,scopeId:stored.scopeId,revision:stored.revision,spec:stored.spec};
            const state=await this.locked(tx,forward.spec.ingress.nodeId);
            const current=await this.ports.ledger.get(tx,claim.scope_id,claim.id);
            if(current.status!=='running'||current.claim_token!==claim.claim_token||!current.claim_until||current.claim_until<=this.now()||current.target_revision!==forward.revision)return;
            if(state.session_epoch)await this.publish(tx,state,{id:claim.id,token:claim.claim_token!,until:claim.claim_until!});
        });
    }
    async report(nodeId:string,epoch:number,report:RuntimeMessagesFor<F>['ReportRequest'],fingerprint?:string):Promise<RuntimeMessagesFor<F>['ReportAck']> {
        if(report.nodeId!==nodeId||report.sessionEpoch!==epoch)throw new ControlError('AUTHORIZATION_DENIED',403,'Report identity mismatch');
        return this.ports.db.transaction(async tx=>{
            const state=await this.locked(tx,nodeId,epoch);
            if(fingerprint)await this.ports.nodes.credential(tx,nodeId,fingerprint);
            await this.ports.nodes.facts(tx,nodeId);
            if(report.bootId!==state.boot_id)throw new ControlError('SESSION_SUPERSEDED',409,'Boot identity mismatch');
            const requestDigest=this.ports.codec.digest(report),prior=await this.ports.store.reportDigest(tx,nodeId,epoch,report.reportSequence);
            const ack=this.ports.codec.reportAck(nodeId,report.bootId,epoch,report.reportSequence,prior!==undefined?'duplicate':'accepted');
            if(prior!==undefined) {
                if(prior!==requestDigest)throw new ControlError('INTEGRITY_FAILURE',409,'Report sequence body changed');
                return ack;
            }
            if(report.reportSequence<=state.last_report_sequence)throw new ControlError('STALE_GENERATION',409,'Report sequence regressed');
            const snapshot=report.acceptedSnapshotGeneration?await this.ports.store.snapshot(tx,nodeId,report.acceptedSnapshotGeneration,epoch):undefined;
            if(report.acceptedSnapshotGeneration&&!snapshot)throw new ControlError('STALE_GENERATION',409,'Unpublished snapshot reported');
            for(const obs of report.observations)
                if(!snapshot?.assignments.some(a=>a.assignmentId===obs.assignmentId&&a.deploymentGeneration===obs.deploymentGeneration&&
                    a.bindingFence===obs.bindingFence&&(obs.phase===a.phase||obs.phase==='absent')))
                    throw new ControlError('FENCING_REJECTED',409,'Observation does not belong to published instance/phase');
            await this.ports.ledger.observeDrains(tx,nodeId,epoch,report);
            const now=this.now();
            await this.ports.store.saveReport(tx,report,requestDigest,now);
            if(snapshot&&snapshot.snapshotGeneration===state.snapshot_generation&&this.ports.codec.parseTime(snapshot.validUntil)>now+this.policy.maxClockSkewSeconds*1000)
                for(const assignment of snapshot.assignments) {
                    const obs=report.observations.find(o=>o.assignmentId===assignment.assignmentId);
                    if(obs?.condition==='error') {
                        if(assignment.role.startsWith('multihop-'))await this.ports.relay?.executionError(tx,snapshot,assignment,obs);
                        else await this.ports.store.failExecution(tx,assignment,obs,now);
                    }
                }
            if(snapshot&&snapshot.snapshotGeneration===state.snapshot_generation)
                await this.ports.ledger.complete(tx,nodeId,report,snapshot);
            if(this.ports.relay)await this.ports.relay.advanceForNode(tx,nodeId);
            return ack;
        });
    }
    async status(tx:Tx,forward:Forward):Promise<ForwardRuntimeStatus> {
        return this.ports.observations.status(tx,forward);
    }
}
