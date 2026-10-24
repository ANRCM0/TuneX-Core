import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { deepFreeze, isId } from '@tunex/core';
import { parseJson } from './json.ts';
import { digest } from './digest.ts';
import type { ProbeClaimBinding } from './probe-claim.ts';

export type ProbeMeasurementDescriptor =
    { readonly measurement:'tcp-connect-v1';readonly taskKind:'tcp-connect';readonly point:'agent-direct-egress';readonly capability:'probe.tcp-connect.v1' } |
    { readonly measurement:'tcp-ingress-connect-v1';readonly taskKind:'tcp-ingress-connect';readonly point:'agent-local-direct-ingress';readonly capability:'probe.tcp-ingress-connect.v1' };
export interface ProbeTypedIdentity {
    readonly protocolVersion:3;readonly probeVersion:2;readonly nodeId:string;readonly bootId:string;readonly sessionEpoch:number;
    readonly instanceId:string;readonly instanceGeneration:number;readonly requestId:string;
}
type Measurements = readonly ['tcp-connect-v1','tcp-ingress-connect-v1'];
type Typed = ProbeTypedIdentity & ProbeMeasurementDescriptor;
export interface ProbeTypesQualificationRequest extends ProbeTypedIdentity {
    readonly kind:'probe-types-instance';readonly action:'inspect'|'register'|'revoke';readonly measurements:Measurements;
}
export interface ProbeTypesQualificationResponse extends Omit<ProbeTypesQualificationRequest,'kind'> {
    readonly kind:'probe-types-instance-ack';readonly qualified:boolean;readonly qualifiedAt:string|null;readonly expiresAt:string|null;
    readonly serverTime:string;readonly executionEnabled:false;
}
export interface ProbeTypesPollRequest extends ProbeTypedIdentity {readonly kind:'probe-types-poll';readonly measurements:Measurements}
export type ProbeTypedOffer = ProbeMeasurementDescriptor & {
    readonly permitId:string;readonly binding:ProbeClaimBinding;readonly timeoutMs:number;readonly issuedAt:string;readonly expiresAt:string;
};
export interface ProbeTypesPollResponse extends Omit<ProbeTypesPollRequest,'kind'> {
    readonly kind:'probe-types-poll-ack';readonly observedAt:string;readonly serverTime:string;readonly executionEnabled:false;readonly offer:ProbeTypedOffer|null;
}
export type ProbeTypesClaimRequest = Typed & {readonly kind:'probe-types-claim';readonly permitId:string};
type Consumed = {readonly permitId:string;readonly binding:ProbeClaimBinding;readonly timeoutMs:number;readonly issuedAt:string;
    readonly expiresAt:string;readonly consumedAt:string;readonly serverTime:string;readonly state:'consumed';readonly executionEnabled:false};
export type ProbeTypesClaimResponse = Typed & Consumed & {readonly kind:'probe-types-claim-ack'};
export type ProbeTypesStatusRequest = Typed & {readonly kind:'probe-types-status';readonly permitId:string};
export type ProbeTypesStatusResponse = Typed & Consumed & {readonly kind:'probe-types-status-ack';readonly checkedAt:string};
export type ProbeTypesResultRequest = Typed & {
    readonly kind:'probe-types-result';readonly permitId:string;readonly binding:ProbeClaimBinding;readonly timeoutMs:number;
    readonly issuedAt:string;readonly expiresAt:string;readonly consumedAt:string;readonly measuredAt:string;readonly validUntil:string;
    readonly elapsedMs:number;readonly status:'connected'|'unreachable';readonly code:'tcp-connected'|'tcp-connect-failed';
    readonly applicationHealth:'unknown';readonly source:'agent-reported';readonly applicationPayloadBytes:0;
};
export type ProbeTypesResultBody = Omit<ProbeTypesResultRequest,'requestId'>;
export type ProbeTypesResultResponse = Typed & {
    readonly kind:'probe-types-result-ack';readonly permitId:string;readonly resultDigest:string;readonly acceptedAt:string;
    readonly serverTime:string;readonly duplicate:boolean;readonly health:'unknown';readonly executionEnabled:false;
};
interface Messages {
    QualificationRequest:ProbeTypesQualificationRequest;QualificationResponse:ProbeTypesQualificationResponse;
    PollRequest:ProbeTypesPollRequest;PollResponse:ProbeTypesPollResponse;ClaimRequest:ProbeTypesClaimRequest;ClaimResponse:ProbeTypesClaimResponse;
    StatusRequest:ProbeTypesStatusRequest;StatusResponse:ProbeTypesStatusResponse;ResultRequest:ProbeTypesResultRequest;ResultResponse:ProbeTypesResultResponse;
}
const schema=JSON.parse(readFileSync(new URL('../../../packages/contracts/schemas/probe-types-v2.schema.json',import.meta.url),'utf8')) as {$id:string};
const ajv=new Ajv2020({strict:true,allErrors:true});
const addFormats:(instance:Ajv2020)=>void=createRequire(import.meta.url)('ajv-formats');addFormats(ajv);ajv.addSchema(schema);
const validators=Object.fromEntries(['QualificationRequest','QualificationResponse','PollRequest','PollResponse','ClaimRequest','ClaimResponse',
    'StatusRequest','StatusResponse','ResultRequest','ResultResponse'].map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const time=(value:string)=>Date.parse(value);
function invalid():never {throw new Error('INVALID_CONFIG: Unsupported typed Probe v2 contract');}
function binding(machine:ProbeTypedIdentity,offer:{binding:ProbeClaimBinding;permitId:string;issuedAt:string;expiresAt:string}):void {
    const b=offer.binding,issued=time(offer.issuedAt),expires=time(offer.expiresAt);
    if(![offer.permitId,b.nodeId,b.bootId,b.assignmentId,b.forwardId].every(isId)||b.nodeId!==machine.nodeId||b.bootId!==machine.bootId||
        b.sessionEpoch!==machine.sessionEpoch||issued<0||expires<=issued||expires-issued>2000)invalid();
}
export function parseProbeTypes<K extends keyof Messages>(name:K,raw:string):Messages[K] {
    const value=parseJson(raw,4096) as Messages[K];
    if(!validators[name]?.(value)||!isId(value.nodeId)||!isId(value.bootId))invalid();
    if('permitId'in value&&!isId(value.permitId))invalid();
    if(value.kind==='probe-types-instance-ack') {
        if(value.qualified!==(value.qualifiedAt!==null)||value.qualified!==(value.expiresAt!==null))invalid();
        if(value.qualified) {
            const start=time(value.qualifiedAt!),end=time(value.expiresAt!),server=time(value.serverTime);
            if(start<0||end<=start||end-start>30000||server<start||server>=end)invalid();
        }
    } else if(value.kind==='probe-types-poll-ack') {
        const observed=time(value.observedAt),server=time(value.serverTime);
        if(observed<0||server<observed||server-observed>250)invalid();
        if(value.offer) {binding(value,value.offer);if(time(value.offer.issuedAt)>observed||server>=time(value.offer.expiresAt))invalid();}
    } else if(value.kind==='probe-types-claim-ack'||value.kind==='probe-types-status-ack') {
        binding(value,value);const issued=time(value.issuedAt),expires=time(value.expiresAt),consumed=time(value.consumedAt),server=time(value.serverTime);
        if(consumed<issued||consumed>server||server>=expires)invalid();
        if(value.kind==='probe-types-status-ack') {const checked=time(value.checkedAt);if(checked<consumed||server<checked||server-checked>250)invalid();}
    } else if(value.kind==='probe-types-result') {
        binding(value,value);const consumed=time(value.consumedAt),measured=time(value.measuredAt),until=time(value.validUntil);
        if(consumed<time(value.issuedAt)||measured<consumed||until<=measured||until>time(value.expiresAt)||value.elapsedMs>value.timeoutMs||
            (value.status==='connected')!==(value.code==='tcp-connected'))invalid();
    } else if(value.kind==='probe-types-result-ack') {if(time(value.acceptedAt)<0||time(value.serverTime)<time(value.acceptedAt))invalid();}
    return deepFreeze(value);
}
type Pairs={Qualification:[ProbeTypesQualificationRequest,ProbeTypesQualificationResponse];Poll:[ProbeTypesPollRequest,ProbeTypesPollResponse];
    Claim:[ProbeTypesClaimRequest,ProbeTypesClaimResponse];Status:[ProbeTypesStatusRequest,ProbeTypesStatusResponse];Result:[ProbeTypesResultRequest,ProbeTypesResultResponse]};
export function checkProbeTypes<K extends keyof Pairs>(name:K,request:Pairs[K][0],response:Pairs[K][1]):void {
    const req=parseProbeTypes(`${name}Request` as keyof Messages,JSON.stringify(request));
    const ack=parseProbeTypes(`${name}Response` as keyof Messages,JSON.stringify(response));
    if(req.nodeId!==ack.nodeId||req.bootId!==ack.bootId||req.sessionEpoch!==ack.sessionEpoch||req.instanceId!==ack.instanceId||
        req.instanceGeneration!==ack.instanceGeneration||req.requestId!==ack.requestId)invalid();
    if('measurement'in req&&(!('measurement'in ack)||req.measurement!==ack.measurement||req.taskKind!==ack.taskKind||req.point!==ack.point||req.capability!==ack.capability))invalid();
    if('permitId'in req&&(!('permitId'in ack)||req.permitId!==ack.permitId))invalid();
    if(req.kind==='probe-types-instance'&&(ack.kind!=='probe-types-instance-ack'||req.action!==ack.action))invalid();
    if(req.kind==='probe-types-result') {
        if(ack.kind!=='probe-types-result-ack'||probeTypesResultDigest(req)!==ack.resultDigest||time(ack.acceptedAt)<time(req.measuredAt)||
            time(ack.acceptedAt)>=time(req.validUntil)||time(ack.serverTime)>=time(req.validUntil))invalid();
    }
}
export function probeTypesResultBody(input:ProbeTypesResultRequest):ProbeTypesResultBody {
    const {requestId:_,...body}=parseProbeTypes('ResultRequest',JSON.stringify(input));return deepFreeze(body);
}
export function probeTypesResultDigest(input:ProbeTypesResultRequest):string {return digest(probeTypesResultBody(input));}
