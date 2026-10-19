import { deepFreeze } from '@tunex/core';
import { parseProbeInstance, parseProbeClaim, parseProbeDelivery, parseProbeTypes, parseProbeServices,
    parseProbeServiceContext, checkProbeTypes, checkProbeServices } from './native-observability-codecs.ts';
import { nativeJsonEncode, nativeIsoTime } from './native-module-values.ts';
import type { NativeProbeMeasurementProjection } from './native-probe-result.ts';
import type { ProbeClaimBinding, ProbeNegotiationRequest, ProbeNegotiationResponse, ProbeInstanceRequest, ProbeInstanceResponse,
    ProbeClaimRequest, ProbeClaimResponse, ProbePollRequest, ProbePollResponse, ProbeStatusRequest, ProbeStatusResponse,
    ProbeTypesQualificationRequest, ProbeTypesQualificationResponse, ProbeServicesQualificationRequest, ProbeServicesQualificationResponse,
    ProbeTypesPollRequest, ProbeTypesPollResponse, ProbeTypesClaimRequest, ProbeTypesClaimResponse, ProbeTypesStatusRequest, ProbeTypesStatusResponse,
    ProbeServicesPollRequest, ProbeServicesPollResponse, ProbeServicesClaimRequest, ProbeServicesClaimResponse,
    ProbeServicesStatusRequest, ProbeServicesStatusResponse } from '@tunex/contracts/probe';
export type { ProbeClaimBinding, ProbeNegotiationRequest, ProbeNegotiationResponse, ProbeInstanceRequest, ProbeInstanceResponse,
    ProbeClaimRequest, ProbeClaimResponse, ProbePollRequest, ProbePollResponse, ProbeStatusRequest, ProbeStatusResponse,
    ProbeMeasurementDescriptor, ProbeServiceContext, ProbeTypesQualificationRequest, ProbeTypesQualificationResponse,
    ProbeServicesQualificationRequest, ProbeServicesQualificationResponse, ProbeTypesPollRequest, ProbeTypesPollResponse,
    ProbeTypesClaimRequest, ProbeTypesClaimResponse, ProbeTypesStatusRequest, ProbeTypesStatusResponse, ProbeTypesResultResponse,
    ProbeServicesPollRequest, ProbeServicesPollResponse, ProbeServicesClaimRequest, ProbeServicesClaimResponse,
    ProbeServicesStatusRequest, ProbeServicesStatusResponse, ProbeServicesResultResponse } from '@tunex/contracts/probe';

export interface NativeProbeInstanceReceipt {readonly generation:number;readonly state:string}
export interface NativeProbeInstanceProjection {readonly instanceId:string;readonly registeredAt:number;readonly expiresAt:number}
export interface NativeProbePermitProjection {
    readonly binding:ProbeClaimBinding;readonly timeoutMs:number;readonly issuedAt:number;readonly expiresAt:number;readonly closedAt:number|null;
}
export interface NativeProbeCheckedProjection extends NativeProbePermitProjection {readonly checkedAt:number}
export interface NativeProbeOfferProjection {
    readonly permitId:string;readonly binding:ProbeClaimBinding;readonly timeoutMs:number;readonly issuedAt:number;readonly expiresAt:number;
    readonly serviceContext?:unknown;
}
export interface NativeProbeQualificationProjection {readonly qualified:boolean;readonly qualifiedAt:number|null;readonly expiresAt:number|null}

// These callbacks are synchronous field projections at their original evaluation points.
// They neither receive nor retain a transaction or execution authority.
export function nativeProbeNegotiationAck(request:ProbeNegotiationRequest,now:number):ProbeNegotiationResponse {
    return deepFreeze({ ...request, kind: 'probe-hello-ack', serverTime: nativeIsoTime(now),
        state: 'contract-only', executionEnabled: false });
}
export function nativeProbeInstanceAck(request:ProbeInstanceRequest,result:NativeProbeInstanceReceipt,
    current:NativeProbeInstanceProjection|null,serverTime:()=>number):ProbeInstanceResponse {
    return parseProbeInstance('Response', nativeJsonEncode({ ...request, kind: 'probe-instance-ack',
        generation: result.generation, state: result.state, currentInstanceId: current?.instanceId ?? null,
        registeredAt: current ? nativeIsoTime(current.registeredAt) : null,
        expiresAt: current ? nativeIsoTime(current.expiresAt) : null,
        serverTime: nativeIsoTime(serverTime()), executionEnabled: false }));
}
export function nativeProbeClaimAck(request:ProbeClaimRequest,result:NativeProbePermitProjection,now:number):ProbeClaimResponse {
    return parseProbeClaim('Response', nativeJsonEncode({ ...request, kind: 'probe-claim-ack',
        binding: result.binding, timeoutMs: result.timeoutMs, issuedAt: nativeIsoTime(result.issuedAt),
        expiresAt: nativeIsoTime(result.expiresAt), consumedAt: nativeIsoTime(result.closedAt!),
        serverTime: nativeIsoTime(now), state: 'consumed', executionEnabled: false }));
}
export function nativeProbePollAck(request:ProbePollRequest,observedAt:number,now:number,offer:NativeProbeOfferProjection|null):ProbePollResponse {
    return parseProbeDelivery('PollResponse', nativeJsonEncode({ ...request, kind: 'probe-poll-ack',
        observedAt: nativeIsoTime(observedAt), serverTime: nativeIsoTime(now), executionEnabled: false,
        offer: offer ? { permitId: offer.permitId, binding: offer.binding, timeoutMs: offer.timeoutMs,
            issuedAt: nativeIsoTime(offer.issuedAt), expiresAt: nativeIsoTime(offer.expiresAt) } : null }));
}
export function nativeProbeStatusAck(request:ProbeStatusRequest,result:NativeProbeCheckedProjection,now:number):ProbeStatusResponse {
    return parseProbeDelivery('StatusResponse', nativeJsonEncode({ ...request, kind: 'probe-status-ack', binding: result.binding,
        timeoutMs: result.timeoutMs, issuedAt: nativeIsoTime(result.issuedAt), expiresAt: nativeIsoTime(result.expiresAt),
        consumedAt: nativeIsoTime(result.closedAt!), checkedAt: nativeIsoTime(result.checkedAt),
        serverTime: nativeIsoTime(now), state: 'consumed', executionEnabled: false }));
}
export function nativeProbeTypesQualificationAck(request:ProbeTypesQualificationRequest,result:NativeProbeQualificationProjection,now:number):ProbeTypesQualificationResponse {
    return parseProbeTypes('QualificationResponse',nativeJsonEncode({...request,kind:'probe-types-instance-ack',qualified:result.qualified,
        qualifiedAt:result.qualifiedAt===null?null:nativeIsoTime(result.qualifiedAt),expiresAt:result.expiresAt===null?null:nativeIsoTime(result.expiresAt),
        serverTime:nativeIsoTime(now),executionEnabled:false}));
}
export function nativeProbeServicesQualificationAck(request:ProbeServicesQualificationRequest,result:NativeProbeQualificationProjection,serverTime:()=>number):ProbeServicesQualificationResponse {
    return parseProbeServices('QualificationResponse',nativeJsonEncode({...request,kind:'probe-services-instance-ack',qualified:result.qualified,
        qualifiedAt:result.qualifiedAt===null?null:nativeIsoTime(result.qualifiedAt),expiresAt:result.expiresAt===null?null:nativeIsoTime(result.expiresAt),
        serverTime:nativeIsoTime(serverTime()),executionEnabled:false}));
}
export function nativeProbeTypesPollAck(request:ProbeTypesPollRequest,observedAt:number,now:number,offer:NativeProbeOfferProjection|null,
    describe:()=>NativeProbeMeasurementProjection):ProbeTypesPollResponse {
    const response=parseProbeTypes('PollResponse',nativeJsonEncode({...request,kind:'probe-types-poll-ack',observedAt:nativeIsoTime(observedAt),
        serverTime:nativeIsoTime(now),executionEnabled:false,offer:offer?{...describe(),
            permitId:offer.permitId,binding:offer.binding,timeoutMs:offer.timeoutMs,issuedAt:nativeIsoTime(offer.issuedAt),
            expiresAt:nativeIsoTime(offer.expiresAt)}:null}));
    checkProbeTypes('Poll',request,response);return response;
}
export function nativeProbeTypesClaimAck(request:ProbeTypesClaimRequest,result:NativeProbePermitProjection,now:number):ProbeTypesClaimResponse {
    const response=parseProbeTypes('ClaimResponse',nativeJsonEncode({...request,kind:'probe-types-claim-ack',binding:result.binding,timeoutMs:result.timeoutMs,
        issuedAt:nativeIsoTime(result.issuedAt),expiresAt:nativeIsoTime(result.expiresAt),consumedAt:nativeIsoTime(result.closedAt!),
        serverTime:nativeIsoTime(now),state:'consumed',executionEnabled:false}));
    checkProbeTypes('Claim',request,response);return response;
}
export function nativeProbeTypesStatusAck(request:ProbeTypesStatusRequest,result:NativeProbeCheckedProjection,now:number):ProbeTypesStatusResponse {
    const response=parseProbeTypes('StatusResponse',nativeJsonEncode({...request,kind:'probe-types-status-ack',binding:result.binding,timeoutMs:result.timeoutMs,
        issuedAt:nativeIsoTime(result.issuedAt),expiresAt:nativeIsoTime(result.expiresAt),consumedAt:nativeIsoTime(result.closedAt!),
        checkedAt:nativeIsoTime(result.checkedAt),serverTime:nativeIsoTime(now),state:'consumed',executionEnabled:false}));
    checkProbeTypes('Status',request,response);return response;
}
export function nativeProbeServicesPollAck(request:ProbeServicesPollRequest,observedAt:number,now:number,offer:NativeProbeOfferProjection|null,
    describe:()=>NativeProbeMeasurementProjection):ProbeServicesPollResponse {
    const response=parseProbeServices('PollResponse',nativeJsonEncode({...request,kind:'probe-services-poll-ack',observedAt:nativeIsoTime(observedAt),
        serverTime:nativeIsoTime(now),executionEnabled:false,offer:offer?{...describe(),permitId:offer.permitId,
            binding:offer.binding,timeoutMs:offer.timeoutMs,issuedAt:nativeIsoTime(offer.issuedAt),expiresAt:nativeIsoTime(offer.expiresAt),
            serviceContext:offer.serviceContext?parseProbeServiceContext(offer.serviceContext):null}:null}));
    checkProbeServices('Poll',request,response);return response;
}
export function nativeProbeServicesClaimAck(request:ProbeServicesClaimRequest,result:NativeProbePermitProjection,now:number):ProbeServicesClaimResponse {
    const response=parseProbeServices('ClaimResponse',nativeJsonEncode({...request,kind:'probe-services-claim-ack',binding:result.binding,timeoutMs:result.timeoutMs,
        issuedAt:nativeIsoTime(result.issuedAt),expiresAt:nativeIsoTime(result.expiresAt),consumedAt:nativeIsoTime(result.closedAt!),
        serverTime:nativeIsoTime(now),state:'consumed',executionEnabled:false}));
    checkProbeServices('Claim',request,response);return response;
}
export function nativeProbeServicesStatusAck(request:ProbeServicesStatusRequest,result:NativeProbeCheckedProjection,now:number):ProbeServicesStatusResponse {
    const response=parseProbeServices('StatusResponse',nativeJsonEncode({...request,kind:'probe-services-status-ack',binding:result.binding,timeoutMs:result.timeoutMs,
        issuedAt:nativeIsoTime(result.issuedAt),expiresAt:nativeIsoTime(result.expiresAt),consumedAt:nativeIsoTime(result.closedAt!),
        checkedAt:nativeIsoTime(result.checkedAt),serverTime:nativeIsoTime(now),state:'consumed',executionEnabled:false}));
    checkProbeServices('Status',request,response);return response;
}
