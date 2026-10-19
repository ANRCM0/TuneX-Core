import type { Forward } from '@tunex/core';
import type { Policy, RuntimeReportRequestValue, RuntimeSnapshotValue, RuntimeObservationReader,
    ForwardRuntimeStatus, RuntimeStatusStorageReader } from '../../framework/public.ts';
import type { RuntimeStatusCodec } from './contracts.ts';

/** Existing persisted status projection; this reader never publishes or reconciles execution. */
export class RuntimeStatusQueries<Tx> implements RuntimeObservationReader<Tx> {
    private readonly store:RuntimeStatusStorageReader<Tx>;
    private readonly codec:RuntimeStatusCodec;
    private readonly policy:Policy;
    constructor(store:RuntimeStatusStorageReader<Tx>,codec:RuntimeStatusCodec,policy:Policy) {
        this.store=store;this.codec=codec;this.policy={...policy};
    }
    async status(tx:Tx,forward:Forward):Promise<ForwardRuntimeStatus> {
        if(forward.spec.path) {
            const {path,...spec}=forward.spec,states=[];
            for(const nodeId of [forward.spec.ingress.nodeId,...path.via]) {
                const state=await this.status(tx,{id:forward.id,scopeId:forward.scopeId,revision:forward.revision,
                    spec:{...spec,ingress:{...spec.ingress,nodeId}}});
                states.push({nodeId,...state});
            }
            const applied=states.flatMap(state=>state.applied.map(observation=>({...observation,nodeId:state.nodeId})));
            const freshTimes=states.map(state=>state.health.freshUntil===null?null:this.codec.parseTime(state.health.freshUntil));
            const receivedTimes=states.map(state=>state.health.receivedAt===null?null:this.codec.parseTime(state.health.receivedAt));
            return {applied,health:{condition:states.some(state=>state.health.condition==='unknown')?'unknown':
                states.every(state=>state.health.condition==='ready')?'ready':'degraded',
                receivedAt:receivedTimes.some(value=>value===null)?null:this.codec.formatTime(Math.min(...receivedTimes as number[])),
                freshUntil:freshTimes.some(value=>value===null)?null:this.codec.formatTime(Math.min(...freshTimes as number[]))}};
        }
        const state=(await this.store.node(tx,forward.spec.ingress.nodeId))!;
        const report=state.last_report?this.codec.read<RuntimeReportRequestValue>(state.last_report):undefined;
        const current=state.snapshot_generation?await this.store.currentSnapshot(tx,state.node_id,state.snapshot_generation):undefined;
        const assignments=current?this.codec.read<RuntimeSnapshotValue>(current.body).assignments.filter(a=>a.forwardId===forward.id):[];
        const applied=report?.observations.flatMap(obs=>{
            const assignment=assignments.find(a=>a.assignmentId===obs.assignmentId&&a.deploymentGeneration===obs.deploymentGeneration&&a.bindingFence===obs.bindingFence);
            return assignment?[{...obs,nodeId:state.node_id,forwardRevision:assignment.forwardRevision,role:assignment.role}]:[];
        })??[];
        const reported=report?await this.store.reportedSnapshot(tx,state.node_id,report.acceptedSnapshotGeneration,report.sessionEpoch):undefined;
        const freshUntil=state.received_at!==null&&current&&reported?Math.min(
            state.received_at+this.policy.observationFreshnessSeconds*1000,
            this.codec.parseTime(this.codec.read<RuntimeSnapshotValue>(current.body).validUntil)-this.policy.maxClockSkewSeconds*1000,
            this.codec.parseTime(this.codec.read<RuntimeSnapshotValue>(reported.body).validUntil)-this.policy.maxClockSkewSeconds*1000):null;
        const fresh=freshUntil!==null&&freshUntil>this.codec.now()&&report?.sessionEpoch===state.session_epoch;
        return {applied,health:{condition:!fresh?'unknown':applied.length===forward.spec.protocols.length&&applied.every(obs=>obs.condition==='ready')?'ready':'degraded',
            receivedAt:state.received_at?this.codec.formatTime(state.received_at):null,freshUntil:freshUntil?this.codec.formatTime(freshUntil):null}};
    }
}
