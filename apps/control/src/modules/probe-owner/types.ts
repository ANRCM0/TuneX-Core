import { parseProbeTypes, nativeProbeTypesPollAck, nativeProbeTypesClaimAck, nativeProbeTypesStatusAck, nativeProbeTypesResultAck, probeTypesResultDigest, nativeJsonEncode, nativeParseTime, nativeWallClockSource } from '../../compatibility/public.ts';
import type { ProbeMeasurementDescriptor, ProbeTypesPollRequest, ProbeTypesPollResponse, ProbeTypesClaimRequest, ProbeTypesClaimResponse, ProbeTypesStatusRequest, ProbeTypesStatusResponse, ProbeTypesResultRequest, ProbeTypesResultResponse } from '../../compatibility/public.ts';
import { ControlError } from '../../framework/public.ts';
import type { ProbePermitOwner } from './owner-contracts.ts';
import type { ProbeTypesApi } from './machine-api.ts';
import { PROBE_EGRESS_MEASUREMENT, probeMeasurement } from './measurements.ts';
import type { ProbeMeasurement } from './measurement-contracts.ts';

const unavailable=():never=>{throw new ControlError('PROBE_PERMIT_UNAVAILABLE',409,'Typed Probe observation differs or expired');};
/** Typed wire projection only. The original permit owner still owns every decision and budget. */
export class ProbeTypes<Tx> implements ProbeTypesApi {
    private readonly permits:Pick<ProbePermitOwner<Tx>,'offer'|'consume'|'check'|'receiveResult'>;
    private readonly clock:()=>number;
    constructor(permits:Pick<ProbePermitOwner<Tx>,'offer'|'consume'|'check'|'receiveResult'>,clock:()=>number=nativeWallClockSource()) {this.permits=permits;this.clock=clock;}
    private identity(node:string,epoch:number,request:{nodeId:string;sessionEpoch:number}) {
        if(request.nodeId!==node||request.sessionEpoch!==epoch)throw new ControlError('SESSION_SUPERSEDED',409,'Typed Probe Node/session differs');
    }
    private now(observed:number):number {
        const now=this.clock();if(!Number.isSafeInteger(now)||!Number.isSafeInteger(observed)||observed<0||now<observed||now-observed>250)unavailable();return now;
    }
    async poll(node:string,fingerprint:string,epoch:number,input:ProbeTypesPollRequest):Promise<ProbeTypesPollResponse> {
        const request=parseProbeTypes('PollRequest',nativeJsonEncode(input));this.identity(node,epoch,request);
        const result=await this.permits.offer(node,fingerprint,epoch,{bootId:request.bootId,instanceId:request.instanceId,instanceGeneration:request.instanceGeneration},true);
        const now=this.now(result.observedAt),offer=result.offer;
        const typedOffer=offer as (NonNullable<typeof offer>&Partial<ProbeMeasurementDescriptor>)|null;
        if(typedOffer&&(!['tcp-connect-v1','tcp-ingress-connect-v1'].includes(typedOffer.measurement as string)||
            typedOffer.instanceId!==request.instanceId||typedOffer.instanceGeneration!==request.instanceGeneration||typedOffer.expiresAt<=now))unavailable();
        return nativeProbeTypesPollAck(request,result.observedAt,now,typedOffer,()=>probeMeasurement(typedOffer!.measurement as ProbeMeasurement));
    }
    async claim(node:string,fingerprint:string,epoch:number,input:ProbeTypesClaimRequest):Promise<ProbeTypesClaimResponse> {
        const request=parseProbeTypes('ClaimRequest',nativeJsonEncode(input));this.identity(node,epoch,request);
        const result=await this.permits.consume(node,fingerprint,epoch,{permitId:request.permitId,bootId:request.bootId,
            instanceId:request.instanceId,instanceGeneration:request.instanceGeneration},request.measurement,true);
        const now=this.now(result.closedAt??-1);
        if(result.id!==request.permitId||(result.measurement??PROBE_EGRESS_MEASUREMENT)!==request.measurement||result.instanceId!==request.instanceId||
            result.instanceGeneration!==request.instanceGeneration||result.state!=='consumed'||result.closedAt===null||now>=result.expiresAt)unavailable();
        return nativeProbeTypesClaimAck(request,result,now);
    }
    async status(node:string,fingerprint:string,epoch:number,input:ProbeTypesStatusRequest):Promise<ProbeTypesStatusResponse> {
        const request=parseProbeTypes('StatusRequest',nativeJsonEncode(input));this.identity(node,epoch,request);
        const result=await this.permits.check(node,fingerprint,epoch,{permitId:request.permitId,bootId:request.bootId,
            instanceId:request.instanceId,instanceGeneration:request.instanceGeneration},request.measurement,true),now=this.now(result.checkedAt);
        if(result.id!==request.permitId||(result.measurement??PROBE_EGRESS_MEASUREMENT)!==request.measurement||result.instanceId!==request.instanceId||
            result.instanceGeneration!==request.instanceGeneration||result.state!=='consumed'||result.closedAt===null||now>=result.expiresAt)unavailable();
        return nativeProbeTypesStatusAck(request,result,now);
    }
    async result(node:string,fingerprint:string,epoch:number,input:ProbeTypesResultRequest):Promise<ProbeTypesResultResponse> {
        const request=parseProbeTypes('ResultRequest',nativeJsonEncode(input));this.identity(node,epoch,request);
        const result=await this.permits.receiveResult(node,fingerprint,epoch,request),now=this.now(result.checkedAt);
        if(!Number.isSafeInteger(result.acceptedAt)||result.acceptedAt<0||result.acceptedAt>result.checkedAt||now>=nativeParseTime(request.validUntil)||
            result.resultDigest!==probeTypesResultDigest(request)||typeof result.duplicate!=='boolean')unavailable();
        return nativeProbeTypesResultAck(request,result,now,probeMeasurement(request.measurement));
    }
}
