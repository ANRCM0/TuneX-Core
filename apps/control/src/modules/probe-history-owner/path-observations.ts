import { isId, isCounter, deepFreeze } from '@tunex/core';
import { ControlError } from '../../framework/public.ts';
import type { ScopeAuthorization, ResourceReadAccess } from '../../framework/public.ts';
import { nativeValueDigest, nativeProbeHistoryEchoInvocation, probeEchoServiceSelection, verifyProbeEchoProof } from '../../compatibility/public.ts';
import type { ProbePermitPlans } from '../probe-owner/public.ts';
import type { ProbeRunStore, ProbeRunRecord } from './contracts.ts';
import { parseProbeRunRecord } from './values.ts';

export interface ProbePathObservation {
    targetId:string;forwardRevision:number;bindingDigest:string;probeId:string;measurement:'tcp-path-echo-v1'|'udp-path-echo-v1';
    status:'echoed'|'unverified'|'unreachable';elapsedMs:number;measuredAt:number;acceptedAt:number;validUntil:number;
}
export interface ProbePathObservationReader<Tx> {
    readIn(tx:Tx,actor:string,scope:string,forward:string,measurement:ProbePathObservation['measurement'],at:number,maxAgeSeconds:number):Promise<ProbePathObservation|null>;
}
const corrupt=():never=>{throw new ControlError('INTEGRITY_FAILURE',409,'Invalid controlled path history observation');};

/** Recent historical outcome only; no issuance, network work or nested transaction. */
export class ProbePathObservations<Tx> implements ProbePathObservationReader<Tx> {
    private readonly auth:ScopeAuthorization<Tx>;
    private readonly access:ResourceReadAccess<Tx>;
    private readonly store:ProbeRunStore<Tx>;
    private readonly plans:ProbePermitPlans<Tx>;
    constructor(auth:ScopeAuthorization<Tx>,access:ResourceReadAccess<Tx>,
        store:ProbeRunStore<Tx>,plans:ProbePermitPlans<Tx>) {
        this.auth=auth;this.access=access;this.store=store;this.plans=plans;
    }
    async readIn(tx:Tx,actor:string,scope:string,forward:string,measurement:ProbePathObservation['measurement'],at:number,maxAgeSeconds:number) {
        if(![actor,scope,forward].every(isId)||!['tcp-path-echo-v1','udp-path-echo-v1'].includes(measurement)||
            !Number.isSafeInteger(at)||at<0||at>=253402300799999||!isCounter(maxAgeSeconds)||maxAgeSeconds<30||maxAgeSeconds>300)corrupt();
        await this.auth.scope(tx,actor,scope,true);await this.access.forward(tx,actor,scope,forward);
        const principal=await this.access.principal(tx,actor,scope),from=Math.max(0,at-maxAgeSeconds*1000-2000);
        const rows=await this.store.history(tx,scope,principal,{forwardId:forward,from,to:at+1,limit:25,before:null});
        if(!Array.isArray(rows)||rows.length>26)corrupt();
        const values=rows.map(raw=>{let value:ProbeRunRecord;try{value=parseProbeRunRecord(raw);}catch{corrupt();}
            if(value.scopeId!==scope||value.binding.forwardId!==forward||value.issuedAt<from||value.issuedAt>at)corrupt();return value;});
        if(new Set(values.map(value=>value.probeId)).size!==values.length)corrupt();
        const record=values.slice(0,25).sort((a,b)=>b.issuedAt-a.issuedAt||(a.probeId<b.probeId?1:a.probeId>b.probeId?-1:0))
            .find(value=>value.measurement===measurement);
        if(!record||record.state!=='consumed'||record.withdrawnAt!==null||record.recoverySuspended||!record.result||!record.service||!record.echoChallenge)return null;
        const sample=record.result;
        if(sample.measuredAt>at||sample.acceptedAt>at||at-sample.measuredAt>maxAgeSeconds*1000)return null;
        let plan;
        try { plan=await this.plans.authorize(tx,record.actorId,scope,forward,{version:1,
            kind:measurement==='tcp-path-echo-v1'?'tcp-path-echo':'udp-path-echo',expectedRevision:record.binding.forwardRevision,
            timeoutMs:record.timeoutMs,service:{serviceId:record.service.serviceId,revision:record.service.revision,
                configRevision:record.service.configRevision,configDigest:record.service.configDigest}}); }
        catch(error) {
            if(error instanceof ControlError&&['AUTHORIZATION_DENIED','NOT_FOUND','REVISION_CONFLICT','PROBE_UNAVAILABLE','UNSUPPORTED_CAPABILITY','OBSERVATION_SERVICE_UNAVAILABLE'].includes(error.code))return null;
            throw error;
        }
        if(plan.kind!=='tcp-path-echo'&&plan.kind!=='udp-path-echo')return null;
        if(plan.measurement!==measurement||
            nativeValueDigest(plan.binding)!==nativeValueDigest(record.binding)||
            nativeValueDigest(probeEchoServiceSelection(plan.serviceContext))!==nativeValueDigest(record.service))return null;
        if(!['echoed','unverified','unreachable'].includes(sample.status))corrupt();
        if(sample.status==='echoed'&&(!sample.echo||!verifyProbeEchoProof(plan.serviceContext,
            nativeProbeHistoryEchoInvocation(record),record.echoChallenge,sample.echo)))corrupt();
        return deepFreeze({targetId:forward,forwardRevision:record.binding.forwardRevision,bindingDigest:nativeValueDigest(record.binding),
            probeId:record.probeId,measurement,status:sample.status as ProbePathObservation['status'],elapsedMs:sample.elapsedMs,
            measuredAt:sample.measuredAt,acceptedAt:sample.acceptedAt,validUntil:sample.validUntil});
    }
}
