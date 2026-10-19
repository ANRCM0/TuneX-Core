import { ControlError } from '../framework/public.ts';
import { parseProbeResult, probeResultBody, probeResultDigest, parseProbeTypes, probeTypesResultBody,
    probeTypesResultDigest, parseProbeServices, probeServicesResultBody, probeServicesResultDigest,
    parseProbeEcho, probeEchoResultBody, probeEchoResultDigest } from './native-observability-codecs.ts';
import { nativeJsonEncode, nativeIsoTime } from './native-module-values.ts';
import type { ProbeResultBody, ProbeTypesResultBody, ProbeServicesResultBody } from '@tunex/contracts/probe';
import type { ProbeEchoResultBody } from '@tunex/contracts/staged/probe-echo';
import { checkProbeResult, checkProbeTypes, checkProbeServices } from './native-observability-codecs.ts';
import type { ProbeResultRequest, ProbeResultResponse, ProbeTypesResultRequest, ProbeTypesResultResponse,
    ProbeServicesResultRequest, ProbeServicesResultResponse } from '@tunex/contracts/probe';

export interface NativeStoredProbeResult {
    readonly body:ProbeResultBody|ProbeTypesResultBody|ProbeServicesResultBody|ProbeEchoResultBody;
    readonly resultDigest:string;
}

export function nativeProbeResultRequest(input:unknown) {
    if(input!==null&&typeof input==='object'&&'probeVersion'in input&&input.probeVersion===4) {
        const request=parseProbeEcho('ResultRequest',nativeJsonEncode(input));
        return {request,measurement:request.measurement,body:probeEchoResultBody(request),resultDigest:probeEchoResultDigest(request)};
    }
    if(input!==null&&typeof input==='object'&&'probeVersion' in input&&input.probeVersion===3) {
        const request=parseProbeServices('ResultRequest',nativeJsonEncode(input));
        return {request,measurement:request.measurement,body:probeServicesResultBody(request),resultDigest:probeServicesResultDigest(request)};
    }
    if(input!==null&&typeof input==='object'&&'probeVersion' in input&&input.probeVersion===2) {
        const request=parseProbeTypes('ResultRequest',nativeJsonEncode(input));
        return {request,measurement:request.measurement,body:probeTypesResultBody(request),resultDigest:probeTypesResultDigest(request)};
    }
    const request=parseProbeResult('Request',nativeJsonEncode(input));
    return {request,measurement:'tcp-connect-v1' as const,body:probeResultBody(request),resultDigest:probeResultDigest(request)};
}

export function nativeStoredProbeResultCheck(record:NativeStoredProbeResult):void {
    if(record.body?.probeVersion===4){
        try{
            if(Object.hasOwn(record.body,'requestId'))throw new Error('body');
            const request=parseProbeEcho('ResultRequest',nativeJsonEncode({...record.body,requestId:'0'.repeat(64)}));
            if(probeEchoResultDigest(request)!==record.resultDigest)throw new Error('digest');
        }catch{throw new ControlError('INTEGRITY_FAILURE',409,'Invalid stored Probe echo result');}
        return;
    }
    if(record.body?.probeVersion!==3)return;
    try{
        if(Object.hasOwn(record.body,'requestId'))throw new Error('body');
        const request=parseProbeServices('ResultRequest',nativeJsonEncode({...record.body,requestId:'0'.repeat(64)}));
        if(probeServicesResultDigest(request)!==record.resultDigest)throw new Error('digest');
    }catch{throw new ControlError('INTEGRITY_FAILURE',409,'Invalid stored Probe services result');}
}
export type NativeProbeResultEnvelope=ReturnType<typeof nativeProbeResultRequest>;

export interface NativeProbeResultReceipt {
    readonly resultDigest:string;readonly acceptedAt:number;readonly duplicate:boolean;
}
export interface NativeProbeMeasurementProjection {
    readonly measurement:string;readonly taskKind:string;readonly point:string;readonly capability:string;
}

/** Formatting only: the caller has already committed and checked receipt freshness. */
export function nativeProbeResultAck(request:ProbeResultRequest,result:NativeProbeResultReceipt,now:number):ProbeResultResponse {
    const response = parseProbeResult('Response', nativeJsonEncode({ protocolVersion: 3, probeVersion: 1, kind: 'probe-result-ack',
        nodeId: request.nodeId, bootId: request.bootId, sessionEpoch: request.sessionEpoch, instanceId: request.instanceId,
        instanceGeneration: request.instanceGeneration, permitId: request.permitId, requestId: request.requestId,
        resultDigest: result.resultDigest, acceptedAt: nativeIsoTime(result.acceptedAt), serverTime: nativeIsoTime(now),
        duplicate: result.duplicate, health: 'unknown', executionEnabled: false }));
    checkProbeResult(request, response);
    return response;
}
export function nativeProbeTypesResultAck(request:ProbeTypesResultRequest,result:NativeProbeResultReceipt,now:number,
    description:NativeProbeMeasurementProjection):ProbeTypesResultResponse {
    const response=parseProbeTypes('ResultResponse',nativeJsonEncode({...description,protocolVersion:3,probeVersion:2,kind:'probe-types-result-ack',
        nodeId:request.nodeId,bootId:request.bootId,sessionEpoch:request.sessionEpoch,instanceId:request.instanceId,instanceGeneration:request.instanceGeneration,
        requestId:request.requestId,permitId:request.permitId,resultDigest:result.resultDigest,acceptedAt:nativeIsoTime(result.acceptedAt),
        serverTime:nativeIsoTime(now),duplicate:result.duplicate,health:'unknown',executionEnabled:false}));
    checkProbeTypes('Result',request,response);return response;
}
export function nativeProbeServicesResultAck(request:ProbeServicesResultRequest,result:NativeProbeResultReceipt,now:number,
    description:NativeProbeMeasurementProjection):ProbeServicesResultResponse {
    const response=parseProbeServices('ResultResponse',nativeJsonEncode({...description,protocolVersion:3,probeVersion:3,kind:'probe-services-result-ack',
        nodeId:request.nodeId,bootId:request.bootId,sessionEpoch:request.sessionEpoch,instanceId:request.instanceId,instanceGeneration:request.instanceGeneration,
        requestId:request.requestId,permitId:request.permitId,service:request.service,resultDigest:result.resultDigest,acceptedAt:nativeIsoTime(result.acceptedAt),
        serverTime:nativeIsoTime(now),duplicate:result.duplicate,health:'unknown',executionEnabled:false}));
    checkProbeServices('Result',request,response);return response;
}
