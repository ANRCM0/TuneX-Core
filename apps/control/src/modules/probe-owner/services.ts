import { parseProbeServices, parseProbeServiceContext, nativeProbeServicesPollAck, nativeProbeServicesClaimAck, nativeProbeServicesStatusAck, nativeProbeServicesResultAck, probeServiceSelection, probeServicesResultDigest, nativeJsonEncode, nativeParseTime, nativeWallClockSource } from '../../compatibility/public.ts';
import { nativeValueDigest as digest } from '../../compatibility/public.ts';
import type { ProbeServiceContext, ProbeEchoServiceContext, ProbeServiceSelection, ProbeServicesPollRequest, ProbeServicesPollResponse, ProbeServicesClaimRequest, ProbeServicesClaimResponse, ProbeServicesStatusRequest, ProbeServicesStatusResponse, ProbeServicesResultRequest, ProbeServicesResultResponse } from '../../compatibility/public.ts';
import { ControlError } from '../../framework/public.ts';
import type { ProbePermitOwner } from './owner-contracts.ts';
import type { ProbeServicesApi } from './machine-api.ts';
import { PROBE_EGRESS_MEASUREMENT, PROBE_SERVICE_MEASUREMENTS, probeMeasurement } from './measurements.ts';

const unavailable=():never=>{throw new ControlError('PROBE_PERMIT_UNAVAILABLE',409,'Service Probe observation differs or expired');};
/** Closed wire projections only; original permit owner retains all authority, storage and budgets. */
export class ProbeServices<Tx> implements ProbeServicesApi {
    private readonly permits:Pick<ProbePermitOwner<Tx>,'offer'|'consume'|'check'|'receiveResult'>;
    private readonly clock:()=>number;
    constructor(permits:Pick<ProbePermitOwner<Tx>,'offer'|'consume'|'check'|'receiveResult'>,clock:()=>number=nativeWallClockSource()) {
        this.permits=permits;this.clock=clock;
    }
    private identity(node:string,epoch:number,request:{nodeId:string;sessionEpoch:number}) {
        if(request.nodeId!==node||request.sessionEpoch!==epoch)throw new ControlError('SESSION_SUPERSEDED',409,'Service Probe Node/session differs');
    }
    private now(observed:number):number {
        const now=this.clock();if(!Number.isSafeInteger(now)||now>253402300799999||!Number.isSafeInteger(observed)||observed<0||now<observed||now-observed>250)unavailable();return now;
    }
    private selection(value:{serviceContext?:ProbeServiceContext|ProbeEchoServiceContext},expected:ProbeServiceSelection|null) {
        const actual=value.serviceContext?probeServiceSelection(parseProbeServiceContext(value.serviceContext)):null;
        if(digest(actual)!==digest(expected))unavailable();
    }
    async poll(node:string,fingerprint:string,epoch:number,input:ProbeServicesPollRequest):Promise<ProbeServicesPollResponse> {
        const request=parseProbeServices('PollRequest',nativeJsonEncode(input));this.identity(node,epoch,request);
        const result=await this.permits.offer(node,fingerprint,epoch,{bootId:request.bootId,instanceId:request.instanceId,instanceGeneration:request.instanceGeneration},'services');
        const now=this.now(result.observedAt),offer=result.offer;
        if(offer&&(!PROBE_SERVICE_MEASUREMENTS.some(measurement=>measurement===offer.measurement)||offer.instanceId!==request.instanceId||
            offer.instanceGeneration!==request.instanceGeneration||offer.expiresAt<=now))unavailable();
        return nativeProbeServicesPollAck(request,result.observedAt,now,offer,()=>probeMeasurement(offer!.measurement!));
    }
    async claim(node:string,fingerprint:string,epoch:number,input:ProbeServicesClaimRequest):Promise<ProbeServicesClaimResponse> {
        const request=parseProbeServices('ClaimRequest',nativeJsonEncode(input));this.identity(node,epoch,request);
        const result=await this.permits.consume(node,fingerprint,epoch,{permitId:request.permitId,bootId:request.bootId,
            instanceId:request.instanceId,instanceGeneration:request.instanceGeneration},request.measurement,'services',request.service);
        const now=this.now(result.closedAt??-1);this.selection(result,request.service);
        if(result.id!==request.permitId||(result.measurement??PROBE_EGRESS_MEASUREMENT)!==request.measurement||result.instanceId!==request.instanceId||
            result.instanceGeneration!==request.instanceGeneration||result.state!=='consumed'||result.closedAt===null||now>=result.expiresAt)unavailable();
        return nativeProbeServicesClaimAck(request,result,now);
    }
    async status(node:string,fingerprint:string,epoch:number,input:ProbeServicesStatusRequest):Promise<ProbeServicesStatusResponse> {
        const request=parseProbeServices('StatusRequest',nativeJsonEncode(input));this.identity(node,epoch,request);
        const result=await this.permits.check(node,fingerprint,epoch,{permitId:request.permitId,bootId:request.bootId,
            instanceId:request.instanceId,instanceGeneration:request.instanceGeneration},request.measurement,'services',request.service),now=this.now(result.checkedAt);
        this.selection(result,request.service);
        if(result.id!==request.permitId||(result.measurement??PROBE_EGRESS_MEASUREMENT)!==request.measurement||result.instanceId!==request.instanceId||
            result.instanceGeneration!==request.instanceGeneration||result.state!=='consumed'||result.closedAt===null||now>=result.expiresAt)unavailable();
        return nativeProbeServicesStatusAck(request,result,now);
    }
    async result(node:string,fingerprint:string,epoch:number,input:ProbeServicesResultRequest):Promise<ProbeServicesResultResponse> {
        const request=parseProbeServices('ResultRequest',nativeJsonEncode(input));this.identity(node,epoch,request);
        const result=await this.permits.receiveResult(node,fingerprint,epoch,request),now=this.now(result.checkedAt);
        if(!Number.isSafeInteger(result.acceptedAt)||result.acceptedAt<0||result.acceptedAt>result.checkedAt||now>=nativeParseTime(request.validUntil)||
            result.resultDigest!==probeServicesResultDigest(request)||typeof result.duplicate!=='boolean')unavailable();
        return nativeProbeServicesResultAck(request,result,now,probeMeasurement(request.measurement));
    }
}
