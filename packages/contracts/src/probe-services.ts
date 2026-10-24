import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isIP } from 'node:net';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { deepFreeze, isId } from '@tunex/core';
import { parseJson } from './json.ts';
import { digest } from './digest.ts';
import type { ProbeClaimBinding } from './probe-claim.ts';

export interface ProbeServiceSelection {
    readonly scopeId:string;readonly serviceId:string;readonly revision:number;readonly configRevision:number;
    readonly configDigest:string;readonly contextDigest:string;
}
export interface ProbeServiceConfig {
    readonly version:1;readonly purpose:'direct-ingress-tls-handshake';readonly endpoint:{readonly address:string;readonly port:number};
    readonly trust:{readonly mode:'pinned-leaf-v1';readonly serverName:string;readonly certificateDer:string};
    readonly validFrom:number;readonly validUntil:number;
}
export interface ProbeServiceContext extends ProbeServiceSelection {readonly config:ProbeServiceConfig}
export type ProbeServicesMeasurementDescriptor =
    {readonly measurement:'tcp-connect-v1';readonly taskKind:'tcp-connect';readonly point:'agent-direct-egress';readonly capability:'probe.tcp-connect.v1'} |
    {readonly measurement:'tcp-ingress-connect-v1';readonly taskKind:'tcp-ingress-connect';readonly point:'agent-local-direct-ingress';readonly capability:'probe.tcp-ingress-connect.v1'} |
    {readonly measurement:'tcp-ingress-tls-v1';readonly taskKind:'tcp-ingress-tls';readonly point:'agent-local-direct-ingress';readonly capability:'probe.tcp-ingress-tls.v1'};
export interface ProbeServicesIdentity {
    readonly protocolVersion:3;readonly probeVersion:3;readonly nodeId:string;readonly bootId:string;readonly sessionEpoch:number;
    readonly instanceId:string;readonly instanceGeneration:number;readonly requestId:string;
}
type Measurements=readonly ['tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1'];
type Typed=ProbeServicesIdentity&ProbeServicesMeasurementDescriptor;
export interface ProbeServicesQualificationRequest extends ProbeServicesIdentity {
    readonly kind:'probe-services-instance';readonly action:'inspect'|'register'|'revoke';readonly measurements:Measurements;
}
export interface ProbeServicesQualificationResponse extends Omit<ProbeServicesQualificationRequest,'kind'> {
    readonly kind:'probe-services-instance-ack';readonly qualified:boolean;readonly qualifiedAt:string|null;readonly expiresAt:string|null;
    readonly serverTime:string;readonly executionEnabled:false;
}
export interface ProbeServicesPollRequest extends ProbeServicesIdentity {readonly kind:'probe-services-poll';readonly measurements:Measurements}
export type ProbeServicesOffer=ProbeServicesMeasurementDescriptor&{
    readonly permitId:string;readonly binding:ProbeClaimBinding;readonly timeoutMs:number;readonly issuedAt:string;readonly expiresAt:string;
    readonly serviceContext:ProbeServiceContext|null;
};
export interface ProbeServicesPollResponse extends Omit<ProbeServicesPollRequest,'kind'> {
    readonly kind:'probe-services-poll-ack';readonly observedAt:string;readonly serverTime:string;readonly executionEnabled:false;
    readonly offer:ProbeServicesOffer|null;
}
export type ProbeServicesClaimRequest=Typed&{readonly kind:'probe-services-claim';readonly permitId:string;readonly service:ProbeServiceSelection|null};
type Consumed={readonly permitId:string;readonly service:ProbeServiceSelection|null;readonly binding:ProbeClaimBinding;readonly timeoutMs:number;
    readonly issuedAt:string;readonly expiresAt:string;readonly consumedAt:string;readonly serverTime:string;readonly state:'consumed';readonly executionEnabled:false};
export type ProbeServicesClaimResponse=Typed&Consumed&{readonly kind:'probe-services-claim-ack'};
export type ProbeServicesStatusRequest=Typed&{readonly kind:'probe-services-status';readonly permitId:string;readonly service:ProbeServiceSelection|null};
export type ProbeServicesStatusResponse=Typed&Consumed&{readonly kind:'probe-services-status-ack';readonly checkedAt:string};
export interface ProbeServicesTLSResult {
    readonly version:'TLSv1.3';readonly alpn:'tunex-observation/1';readonly leafFingerprint:string;readonly verified:true;
}
export type ProbeServicesResultRequest=Typed&{
    readonly kind:'probe-services-result';readonly permitId:string;readonly service:ProbeServiceSelection|null;readonly tls:ProbeServicesTLSResult|null;
    readonly binding:ProbeClaimBinding;readonly timeoutMs:number;readonly issuedAt:string;readonly expiresAt:string;readonly consumedAt:string;
    readonly measuredAt:string;readonly validUntil:string;readonly elapsedMs:number;readonly status:'connected'|'unreachable'|'verified'|'unverified';
    readonly code:'tcp-connected'|'tcp-connect-failed'|'tls-handshake-verified'|'tls-handshake-failed';
    readonly applicationHealth:'unknown';readonly source:'agent-reported';readonly applicationPayloadBytes:0;
};
export type ProbeServicesResultBody=Omit<ProbeServicesResultRequest,'requestId'>;
export type ProbeServicesResultResponse=Typed&{
    readonly kind:'probe-services-result-ack';readonly permitId:string;readonly service:ProbeServiceSelection|null;readonly resultDigest:string;
    readonly acceptedAt:string;readonly serverTime:string;readonly duplicate:boolean;readonly health:'unknown';readonly executionEnabled:false;
};
interface Messages {
    QualificationRequest:ProbeServicesQualificationRequest;QualificationResponse:ProbeServicesQualificationResponse;
    PollRequest:ProbeServicesPollRequest;PollResponse:ProbeServicesPollResponse;ClaimRequest:ProbeServicesClaimRequest;ClaimResponse:ProbeServicesClaimResponse;
    StatusRequest:ProbeServicesStatusRequest;StatusResponse:ProbeServicesStatusResponse;ResultRequest:ProbeServicesResultRequest;ResultResponse:ProbeServicesResultResponse;
}
const schema=JSON.parse(readFileSync(new URL('../../../packages/contracts/schemas/probe-services-v3.schema.json',import.meta.url),'utf8')) as {$id:string};
const ajv=new Ajv2020({strict:true,allErrors:true});
const addFormats:(instance:Ajv2020)=>void=createRequire(import.meta.url)('ajv-formats');addFormats(ajv);ajv.addSchema(schema);
const validators=Object.fromEntries(['ServiceSelection','ServiceContext','QualificationRequest','QualificationResponse','PollRequest','PollResponse',
    'ClaimRequest','ClaimResponse','StatusRequest','StatusResponse','ResultRequest','ResultResponse'].map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const time=(value:string)=>Date.parse(value);
const tlsMeasurement='tcp-ingress-tls-v1';
const validId=(value:unknown):value is string=>typeof value==='string'&&isId(value)&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$(?![\s\S])/.test(value);
function invalid():never {throw new Error('INVALID_CONFIG: Unsupported service-bound Probe v3 contract');}
function serviceId(value:string):boolean {return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$(?![\s\S])/.test(value);}
function plain(input:unknown):void {
    if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))invalid();
}
function checkedSelection(value:ProbeServiceSelection):void {
    if(!validId(value.scopeId)||!serviceId(value.serviceId)||value.revision<value.configRevision)invalid();
}
export function parseProbeServiceSelection(input:unknown):ProbeServiceSelection {
    plain(input);if(!validators.ServiceSelection?.(input))invalid();
    const value=parseJson(JSON.stringify(input),4096) as ProbeServiceSelection;checkedSelection(value);return deepFreeze(value);
}
function address(value:string):boolean {
    const family=isIP(value);
    if(family===4) {const parts=value.split('.').map(Number);return parts[0]!==0&&parts[0]!<224&&!(parts[0]===169&&parts[1]===254)&&value!=='100.100.100.200';}
    if(family!==6||value.includes('%'))return false;
    let canonical:string;try{canonical=new URL(`http://[${value}]/`).hostname.slice(1,-1);}catch{return false;}
    return canonical===value&&value!=='::'&&!value.startsWith('::ffff:')&&!value.startsWith('ff')&&!/^fe[89ab]/.test(value)&&value!=='fd00:ec2::254';
}
/** Structural and digest validation only: never resolves, reads authority or validates a peer certificate. */
export function parseProbeServiceContext(input:unknown):ProbeServiceContext {
    plain(input);if(!validators.ServiceContext?.(input))invalid();
    const value=parseJson(JSON.stringify(input),16384) as ProbeServiceContext;checkedSelection(value);
    const config=value.config,name=config.trust.serverName,encoded=config.trust.certificateDer,raw=Buffer.from(encoded,'base64');
    if(!address(config.endpoint.address)||!name.includes('.')||isIP(name)||name.split('.').some(label=>!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$(?![\s\S])/.test(label))||
        !raw.length||raw.length>8192||raw.toString('base64')!==encoded||config.validUntil<=config.validFrom||config.validUntil-config.validFrom>604800000||
        digest(config)!==value.configDigest||digest({scopeId:value.scopeId,serviceId:value.serviceId,revision:value.revision,configRevision:value.configRevision,
            configDigest:value.configDigest,config})!==value.contextDigest)invalid();
    return deepFreeze(value);
}
export function probeServiceSelection(input:ProbeServiceContext):ProbeServiceSelection {
    const value=parseProbeServiceContext(input);
    return deepFreeze({scopeId:value.scopeId,serviceId:value.serviceId,revision:value.revision,configRevision:value.configRevision,
        configDigest:value.configDigest,contextDigest:value.contextDigest});
}
function binding(machine:ProbeServicesIdentity,offer:{binding:ProbeClaimBinding;permitId:string;issuedAt:string;expiresAt:string}):void {
    const b=offer.binding,issued=time(offer.issuedAt),expires=time(offer.expiresAt);
    if(![offer.permitId,b.nodeId,b.bootId,b.assignmentId,b.forwardId].every(validId)||b.nodeId!==machine.nodeId||b.bootId!==machine.bootId||b.sessionEpoch!==machine.sessionEpoch||
        issued<0||expires<=issued||expires-issued>2000)invalid();
}
function service(measurement:string,value:ProbeServiceSelection|null):void {
    if((measurement===tlsMeasurement)!==(value!==null))invalid();if(value!==null)parseProbeServiceSelection(value);
}
export function parseProbeServices<K extends keyof Messages>(name:K,raw:string):Messages[K] {
    const value=parseJson(raw,name==='PollResponse'?32768:4096) as Messages[K];
    if(!validators[name]?.(value)||!validId(value.nodeId)||!validId(value.bootId))invalid();
    if('permitId'in value&&!validId(value.permitId))invalid();
    if('service'in value)service(value.measurement,value.service);
    if(value.kind==='probe-services-instance-ack') {
        if(value.qualified!==(value.qualifiedAt!==null)||value.qualified!==(value.expiresAt!==null))invalid();
        if(value.qualified) {const start=time(value.qualifiedAt!),end=time(value.expiresAt!),server=time(value.serverTime);
            if(start<0||end<=start||end-start>30000||server<start||server>=end)invalid();}
    } else if(value.kind==='probe-services-poll-ack') {
        const observed=time(value.observedAt),server=time(value.serverTime);if(observed<0||server<observed||server-observed>250)invalid();
        if(value.offer) {
            const offer=value.offer;binding(value,offer);if(time(offer.issuedAt)>observed||server>=time(offer.expiresAt)||(offer.measurement===tlsMeasurement)!==(offer.serviceContext!==null))invalid();
            if(offer.serviceContext!==null) {const context=parseProbeServiceContext(offer.serviceContext);
                if(time(offer.issuedAt)<context.config.validFrom||time(offer.expiresAt)>context.config.validUntil)invalid();}
        }
    } else if(value.kind==='probe-services-claim-ack'||value.kind==='probe-services-status-ack') {
        binding(value,value);const consumed=time(value.consumedAt),server=time(value.serverTime);
        if(consumed<time(value.issuedAt)||consumed>server||server>=time(value.expiresAt))invalid();
        if(value.kind==='probe-services-status-ack') {const checked=time(value.checkedAt);if(checked<consumed||server<checked||server-checked>250)invalid();}
    } else if(value.kind==='probe-services-result') {
        binding(value,value);const consumed=time(value.consumedAt),measured=time(value.measuredAt),until=time(value.validUntil);
        if(consumed<time(value.issuedAt)||measured<consumed||until<=measured||until>time(value.expiresAt)||value.elapsedMs>value.timeoutMs)invalid();
        if(value.measurement===tlsMeasurement) {
            if(!(value.status==='verified'&&value.code==='tls-handshake-verified'&&value.tls!==null||
                value.status==='unreachable'&&value.code==='tcp-connect-failed'&&value.tls===null||
                value.status==='unverified'&&value.code==='tls-handshake-failed'&&value.tls===null))invalid();
        } else if(value.tls!==null||!(value.status==='connected'&&value.code==='tcp-connected'||value.status==='unreachable'&&value.code==='tcp-connect-failed'))invalid();
    } else if(value.kind==='probe-services-result-ack') {if(time(value.acceptedAt)<0||time(value.serverTime)<time(value.acceptedAt))invalid();}
    return deepFreeze(value);
}
type Pairs={Qualification:[ProbeServicesQualificationRequest,ProbeServicesQualificationResponse];Poll:[ProbeServicesPollRequest,ProbeServicesPollResponse];
    Claim:[ProbeServicesClaimRequest,ProbeServicesClaimResponse];Status:[ProbeServicesStatusRequest,ProbeServicesStatusResponse];Result:[ProbeServicesResultRequest,ProbeServicesResultResponse]};
export function checkProbeServices<K extends keyof Pairs>(name:K,request:Pairs[K][0],response:Pairs[K][1]):void {
    const req=parseProbeServices(`${name}Request` as keyof Messages,JSON.stringify(request)),ack=parseProbeServices(`${name}Response` as keyof Messages,JSON.stringify(response));
    if(req.nodeId!==ack.nodeId||req.bootId!==ack.bootId||req.sessionEpoch!==ack.sessionEpoch||req.instanceId!==ack.instanceId||req.instanceGeneration!==ack.instanceGeneration||req.requestId!==ack.requestId)invalid();
    if('measurement'in req&&(!('measurement'in ack)||req.measurement!==ack.measurement||req.taskKind!==ack.taskKind||req.point!==ack.point||req.capability!==ack.capability))invalid();
    if('permitId'in req&&(!('permitId'in ack)||req.permitId!==ack.permitId))invalid();
    if('service'in req&&(!('service'in ack)||digest(req.service)!==digest(ack.service)))invalid();
    if(req.kind==='probe-services-instance'&&(ack.kind!=='probe-services-instance-ack'||req.action!==ack.action))invalid();
    if(req.kind==='probe-services-result'&&(ack.kind!=='probe-services-result-ack'||probeServicesResultDigest(req)!==ack.resultDigest||
        time(ack.acceptedAt)<time(req.measuredAt)||time(ack.acceptedAt)>=time(req.validUntil)||time(ack.serverTime)>=time(req.validUntil)))invalid();
}
export function probeServicesResultBody(input:ProbeServicesResultRequest):ProbeServicesResultBody {
    const {requestId:_,...body}=parseProbeServices('ResultRequest',JSON.stringify(input));return deepFreeze(body);
}
export function probeServicesResultDigest(input:ProbeServicesResultRequest):string {return digest(probeServicesResultBody(input));}
