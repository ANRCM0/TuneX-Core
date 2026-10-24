import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { isIP } from 'node:net';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { deepFreeze } from '@tunex/core';
import { parseJson } from './json.ts';
import { digest } from './digest.ts';
import { parseProbeServiceContext, parseProbeServiceSelection } from './probe-services.ts';
import type { ProbeServiceConfig, ProbeServiceContext, ProbeServiceSelection, ProbeServicesMeasurementDescriptor, ProbeServicesTLSResult } from './probe-services.ts';
import type { ProbeClaimBinding } from './probe-claim.ts';

export interface ProbeEchoServiceConfig {
    readonly version:2;readonly purpose:'controlled-nonce-echo';
    readonly endpoint:{readonly address:string;readonly port:number;readonly protocols:readonly ['tcp']|readonly ['udp']|readonly ['tcp','udp']};
    readonly trust:{readonly mode:'ed25519-echo-v1';readonly publicKey:string};readonly validFrom:number;readonly validUntil:number;
}
export type ProbeEchoServiceContext=Omit<ProbeServiceContext,'config'>&{readonly config:ProbeServiceConfig|ProbeEchoServiceConfig};
export interface ProbeEchoChallenge {readonly nonce:string;readonly invocationDigest:string}
export interface ProbeEchoProof {readonly algorithm:'Ed25519';readonly requestDigest:string;readonly signature:string;readonly verified:true}
export interface ProbeEchoInvocation {
    readonly domain:'tunex.probe.echo.invocation.v1';readonly probeVersion:4;
    readonly measurement:'tcp-ingress-echo-v1'|'udp-ingress-echo-v1'|'tcp-path-echo-v1'|'udp-path-echo-v1';readonly permitId:string;readonly binding:ProbeClaimBinding;
    readonly instanceId:string;readonly instanceGeneration:number;readonly timeoutMs:number;readonly issuedAt:string;readonly expiresAt:string;
    readonly service:ProbeServiceSelection;readonly nonce:string;
}
export type ProbeEchoMeasurementDescriptor=(ProbeServicesMeasurementDescriptor&{readonly businessProtocol:'tcp'})|
    {readonly measurement:'tcp-ingress-echo-v1';readonly taskKind:'tcp-ingress-echo';readonly point:'agent-local-direct-ingress';readonly capability:'probe.tcp-ingress-echo.v1';readonly businessProtocol:'tcp'}|
    {readonly measurement:'udp-ingress-echo-v1';readonly taskKind:'udp-ingress-echo';readonly point:'agent-local-direct-ingress';readonly capability:'probe.udp-ingress-echo.v1';readonly businessProtocol:'udp'}|
    {readonly measurement:'tcp-path-echo-v1';readonly taskKind:'tcp-path-echo';readonly point:'agent-local-forward-ingress';readonly capability:'probe.tcp-path-echo.v1';readonly businessProtocol:'tcp'}|
    {readonly measurement:'udp-path-echo-v1';readonly taskKind:'udp-path-echo';readonly point:'agent-local-forward-ingress';readonly capability:'probe.udp-path-echo.v1';readonly businessProtocol:'udp'};
export interface ProbeEchoIdentity {
    readonly protocolVersion:3;readonly probeVersion:4;readonly nodeId:string;readonly bootId:string;readonly sessionEpoch:number;
    readonly instanceId:string;readonly instanceGeneration:number;readonly requestId:string;
}
type LegacyMeasurements=readonly ['tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1','tcp-ingress-echo-v1','udp-ingress-echo-v1'];
type Measurements=LegacyMeasurements|readonly [...LegacyMeasurements,'tcp-path-echo-v1','udp-path-echo-v1'];
type Typed=ProbeEchoIdentity&ProbeEchoMeasurementDescriptor;
type SelectionChallenge={readonly service:ProbeServiceSelection|null;readonly challenge:ProbeEchoChallenge|null};
type Permit={readonly permitId:string;readonly binding:ProbeClaimBinding;readonly timeoutMs:number;readonly issuedAt:string;readonly expiresAt:string};
export interface ProbeEchoQualificationRequest extends ProbeEchoIdentity {readonly kind:'probe-echo-instance';readonly action:'inspect'|'register'|'revoke';readonly measurements:Measurements}
export interface ProbeEchoQualificationResponse extends Omit<ProbeEchoQualificationRequest,'kind'> {
    readonly kind:'probe-echo-instance-ack';readonly qualified:boolean;readonly qualifiedAt:string|null;readonly expiresAt:string|null;
    readonly serverTime:string;readonly executionEnabled:false;
}
export interface ProbeEchoPollRequest extends ProbeEchoIdentity {readonly kind:'probe-echo-poll';readonly measurements:Measurements}
export type ProbeEchoOffer=ProbeEchoMeasurementDescriptor&Permit&{readonly serviceContext:ProbeEchoServiceContext|null;readonly challenge:ProbeEchoChallenge|null};
export interface ProbeEchoPollResponse extends Omit<ProbeEchoPollRequest,'kind'> {
    readonly kind:'probe-echo-poll-ack';readonly observedAt:string;readonly serverTime:string;readonly executionEnabled:false;readonly offer:ProbeEchoOffer|null;
}
export type ProbeEchoClaimRequest=Typed&SelectionChallenge&{readonly kind:'probe-echo-claim';readonly permitId:string};
type Consumed=Permit&SelectionChallenge&{readonly consumedAt:string;readonly serverTime:string;readonly state:'consumed';readonly executionEnabled:false};
export type ProbeEchoClaimResponse=Typed&Consumed&{readonly kind:'probe-echo-claim-ack'};
export type ProbeEchoStatusRequest=Typed&SelectionChallenge&{readonly kind:'probe-echo-status';readonly permitId:string};
export type ProbeEchoStatusResponse=Typed&Consumed&{readonly kind:'probe-echo-status-ack';readonly checkedAt:string};
export type ProbeEchoResultRequest=Typed&Permit&SelectionChallenge&{
    readonly kind:'probe-echo-result';readonly tls:ProbeServicesTLSResult|null;readonly echo:ProbeEchoProof|null;
    readonly consumedAt:string;readonly measuredAt:string;readonly validUntil:string;readonly elapsedMs:number;
    readonly status:'connected'|'unreachable'|'verified'|'unverified'|'echoed';
    readonly code:'tcp-connected'|'tcp-connect-failed'|'tls-handshake-verified'|'tls-handshake-failed'|'nonce-echo-verified'|'nonce-echo-rejected';
    readonly requestBytes:number;readonly responseBytes:number;readonly applicationPayloadBytes:number;
    readonly applicationHealth:'unknown';readonly source:'agent-reported';
};
export type ProbeEchoResultBody=Omit<ProbeEchoResultRequest,'requestId'>;
export type ProbeEchoResultResponse=Typed&SelectionChallenge&{readonly kind:'probe-echo-result-ack';readonly permitId:string;readonly resultDigest:string;
    readonly acceptedAt:string;readonly serverTime:string;readonly duplicate:boolean;readonly health:'unknown';readonly executionEnabled:false};
interface Messages {
    QualificationRequest:ProbeEchoQualificationRequest;QualificationResponse:ProbeEchoQualificationResponse;
    PollRequest:ProbeEchoPollRequest;PollResponse:ProbeEchoPollResponse;ClaimRequest:ProbeEchoClaimRequest;ClaimResponse:ProbeEchoClaimResponse;
    StatusRequest:ProbeEchoStatusRequest;StatusResponse:ProbeEchoStatusResponse;ResultRequest:ProbeEchoResultRequest;ResultResponse:ProbeEchoResultResponse;
}
const schema=JSON.parse(readFileSync(new URL('../../../docs/protocol/schemas/probe-echo-v4.schema.json',import.meta.url),'utf8')) as {$id:string};
const ajv=new Ajv2020({strict:true,allErrors:true});
const addFormats:(instance:Ajv2020)=>void=createRequire(import.meta.url)('ajv-formats');addFormats(ajv);ajv.addSchema(schema);
const validators=Object.fromEntries(['ServiceConfig','ServiceContext','Challenge','EchoProof','Invocation','QualificationRequest','QualificationResponse',
    'PollRequest','PollResponse','ClaimRequest','ClaimResponse','StatusRequest','StatusResponse','ResultRequest','ResultResponse']
    .map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const time=(value:string)=>Date.parse(value);
const isEcho=(value:string)=>['tcp-ingress-echo-v1','udp-ingress-echo-v1','tcp-path-echo-v1','udp-path-echo-v1'].includes(value);
function invalid():never {throw new Error('INVALID_CONFIG: Controlled echo Probe v4 contract rejected');}
function checked<T>(name:string,input:unknown,maximum:number):T {
    if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))invalid();
    const value=parseJson(JSON.stringify(input),maximum) as T;if(!validators[name]?.(value))invalid();return value;
}
function rawBase64(value:string,size:number):Buffer {
    const raw=Buffer.from(value,'base64');if(raw.length!==size||raw.toString('base64')!==value)invalid();return raw;
}
function address(value:string):boolean {
    const family=isIP(value);
    if(family===4){const p=value.split('.').map(Number);return p[0]!==0&&p[0]!<224&&!(p[0]===169&&p[1]===254)&&value!=='100.100.100.200';}
    if(family!==6||value.includes('%')||value==='::'||value.startsWith('::ffff:')||value.startsWith('ff')||/^fe[89ab]/.test(value)||value==='fd00:ec2::254')return false;
    try{return new URL(`http://[${value}]/`).hostname.slice(1,-1)===value;}catch{return false;}
}
/** Public structure only. Registry currentness and permitted use remain owner checks. */
export function parseProbeEchoServiceConfig(input:unknown):ProbeEchoServiceConfig {
    const value=checked<ProbeEchoServiceConfig>('ServiceConfig',input,16384);
    if(!address(value.endpoint.address)||value.validUntil<=value.validFrom||value.validUntil-value.validFrom>604800000)invalid();
    rawBase64(value.trust.publicKey,32);return deepFreeze(value);
}
export function parseProbeEchoServiceContext(input:unknown):ProbeEchoServiceContext {
    const value=checked<ProbeEchoServiceContext>('ServiceContext',input,16384);
    if(value.config.version===1)return parseProbeServiceContext(value);
    const config=parseProbeEchoServiceConfig(value.config);parseProbeServiceSelection(probeSelection(value));
    if(digest(config)!==value.configDigest||digest({scopeId:value.scopeId,serviceId:value.serviceId,revision:value.revision,
        configRevision:value.configRevision,configDigest:value.configDigest,config})!==value.contextDigest)invalid();
    return deepFreeze(value);
}
function probeSelection(value:ProbeEchoServiceContext):ProbeServiceSelection {
    return {scopeId:value.scopeId,serviceId:value.serviceId,revision:value.revision,configRevision:value.configRevision,configDigest:value.configDigest,contextDigest:value.contextDigest};
}
export function probeEchoServiceSelection(input:ProbeEchoServiceContext):ProbeServiceSelection {
    return deepFreeze(probeSelection(parseProbeEchoServiceContext(input)));
}
export function parseProbeEchoChallenge(input:unknown):ProbeEchoChallenge {
    const value=checked<ProbeEchoChallenge>('Challenge',input,512);rawBase64(value.nonce,32);return deepFreeze(value);
}
export function probeEchoInvocationDigest(input:ProbeEchoInvocation):string {
    const value=checked<ProbeEchoInvocation>('Invocation',input,4096);rawBase64(value.nonce,32);parseProbeServiceSelection(value.service);
    const issued=time(value.issuedAt),expires=time(value.expiresAt);
    if(issued<0||new Date(issued).toISOString()!==value.issuedAt||new Date(expires).toISOString()!==value.expiresAt||expires<=issued||expires-issued>2000)invalid();
    return digest(value);
}
export function probeEchoRequestFrame(input:ProbeEchoInvocation,challenge:ProbeEchoChallenge):Buffer {
    const value=parseProbeEchoChallenge(challenge);
    if(input.nonce!==value.nonce||probeEchoInvocationDigest(input)!==value.invocationDigest)invalid();
    const frame=Buffer.alloc(256);frame.write('TNXECHOQ',0,'ascii');frame[8]=1;frame[9]=(input.measurement==='tcp-ingress-echo-v1'||input.measurement==='tcp-path-echo-v1')?1:2;
    frame.writeBigUInt64BE(BigInt(time(input.expiresAt)),16);rawBase64(value.nonce,32).copy(frame,24);
    Buffer.from(input.service.contextDigest.slice(7),'hex').copy(frame,56);Buffer.from(value.invocationDigest.slice(7),'hex').copy(frame,88);
    return frame;
}
/** Reconstructs the signed fixed response; never trusts the peer's verified flag. */
export function verifyProbeEchoProof(context:ProbeEchoServiceContext,input:ProbeEchoInvocation,challenge:ProbeEchoChallenge,proof:ProbeEchoProof):boolean {
    try {
        const current=parseProbeEchoServiceContext(context),value=checked<ProbeEchoProof>('EchoProof',proof,512),config=current.config;
        if(config.version!==2||digest(probeSelection(current))!==digest(input.service)||
            !config.endpoint.protocols.some(protocol=>protocol===((input.measurement==='tcp-ingress-echo-v1'||input.measurement==='tcp-path-echo-v1')?'tcp':'udp'))||
            time(input.issuedAt)<config.validFrom||time(input.expiresAt)>config.validUntil)return false;
        const request=probeEchoRequestFrame(input,challenge),hash=createHash('sha256').update(request).digest();
        if(value.requestDigest!==`sha256:${hash.toString('hex')}`)return false;
        const response=Buffer.alloc(192);request.copy(response,0,0,120);response.write('TNXECHOR',0,'ascii');hash.copy(response,120);
        const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),rawBase64(config.trust.publicKey,32)]),format:'der',type:'spki'});
        return verify(null,Buffer.concat([Buffer.from('tunex.echo.response.v1\0','ascii'),response]),key,rawBase64(value.signature,64));
    }catch{return false;}
}
function binding(machine:ProbeEchoIdentity,offer:Permit):void {
    const b=offer.binding,issued=time(offer.issuedAt),expires=time(offer.expiresAt);
    if(b.nodeId!==machine.nodeId||b.bootId!==machine.bootId||b.sessionEpoch!==machine.sessionEpoch||issued<0||expires<=issued||expires-issued>2000)invalid();
}
function service(measurement:string,selection:ProbeServiceSelection|null,challenge:ProbeEchoChallenge|null):void {
    if((measurement==='tcp-ingress-tls-v1'||isEcho(measurement))!==(selection!==null)||isEcho(measurement)!==(challenge!==null))invalid();
    if(selection!==null)parseProbeServiceSelection(selection);if(challenge!==null)parseProbeEchoChallenge(challenge);
}
function invocation(value:ProbeEchoIdentity&Permit&ProbeEchoMeasurementDescriptor,selection:ProbeServiceSelection,challenge:ProbeEchoChallenge):ProbeEchoInvocation {
    if(!isEcho(value.measurement))invalid();
    return {domain:'tunex.probe.echo.invocation.v1',probeVersion:4,measurement:value.measurement as ProbeEchoInvocation['measurement'],permitId:value.permitId,
        binding:value.binding,instanceId:value.instanceId,instanceGeneration:value.instanceGeneration,timeoutMs:value.timeoutMs,
        issuedAt:value.issuedAt,expiresAt:value.expiresAt,service:selection,nonce:challenge.nonce};
}
function challengeMatches(value:ProbeEchoIdentity&Permit&ProbeEchoMeasurementDescriptor&SelectionChallenge):void {
    if(value.challenge!==null&&value.service!==null&&probeEchoInvocationDigest(invocation(value,value.service,value.challenge))!==value.challenge.invocationDigest)invalid();
}
export function parseProbeEcho<K extends keyof Messages>(name:K,raw:string):Messages[K] {
    const value=checked<Messages[K]>(name,parseJson(raw,name==='PollResponse'?32768:4096),name==='PollResponse'?32768:4096);
    if('service'in value)service(value.measurement,value.service,value.challenge);
    if(value.kind==='probe-echo-instance-ack'){
        if(value.qualified!==(value.qualifiedAt!==null)||value.qualified!==(value.expiresAt!==null))invalid();
        if(value.qualified){const start=time(value.qualifiedAt!),end=time(value.expiresAt!),server=time(value.serverTime);
            if(start<0||end<=start||end-start>30000||server<start||server>=end)invalid();}
    }else if(value.kind==='probe-echo-poll-ack'){
        const observed=time(value.observedAt),server=time(value.serverTime);if(observed<0||server<observed||server-observed>250)invalid();
        if(value.offer){const offer=value.offer; if(offer&&!value.measurements.some(measurement=>measurement===offer.measurement))invalid();binding(value,offer);
            const selection=offer.serviceContext===null?null:probeEchoServiceSelection(offer.serviceContext);service(offer.measurement,selection,offer.challenge);
            if(time(offer.issuedAt)>observed||server>=time(offer.expiresAt))invalid();
            if(offer.serviceContext!==null){const config=offer.serviceContext.config;
                if((offer.measurement==='tcp-ingress-tls-v1')!==(config.version===1)||time(offer.issuedAt)<config.validFrom||time(offer.expiresAt)>config.validUntil||
                    config.version===2&&!config.endpoint.protocols.some(protocol=>protocol===offer.businessProtocol))invalid();}
            challengeMatches({...value,...offer,service:selection});
        }
    }else if(value.kind==='probe-echo-claim-ack'||value.kind==='probe-echo-status-ack'){
        binding(value,value);challengeMatches(value);const consumed=time(value.consumedAt),server=time(value.serverTime);
        if(consumed<time(value.issuedAt)||consumed>server||server>=time(value.expiresAt))invalid();
        if(value.kind==='probe-echo-status-ack'){const checkedAt=time(value.checkedAt);if(checkedAt<consumed||server<checkedAt||server-checkedAt>250)invalid();}
    }else if(value.kind==='probe-echo-result'){
        binding(value,value);challengeMatches(value);const consumed=time(value.consumedAt),measured=time(value.measuredAt),until=time(value.validUntil);
        if(consumed<time(value.issuedAt)||measured<consumed||until<=measured||until>time(value.expiresAt)||value.elapsedMs>value.timeoutMs||
            value.applicationPayloadBytes!==value.requestBytes+value.responseBytes)invalid();
        if(isEcho(value.measurement)){
            if(value.tls!==null||!(value.status==='echoed'&&value.code==='nonce-echo-verified'&&value.echo!==null&&value.requestBytes===256&&value.responseBytes===256||
                value.status==='unverified'&&value.code==='nonce-echo-rejected'&&value.echo===null&&value.requestBytes===256||
                (value.measurement==='tcp-ingress-echo-v1'||value.measurement==='tcp-path-echo-v1')&&value.status==='unreachable'&&value.code==='tcp-connect-failed'&&value.echo===null&&value.requestBytes===0&&value.responseBytes===0))invalid();
            if(value.echo!==null){rawBase64(value.echo.signature,64);const request=probeEchoRequestFrame(invocation(value,value.service!,value.challenge!),value.challenge!);
                if(value.echo.requestDigest!==`sha256:${createHash('sha256').update(request).digest('hex')}`)invalid();}
        }else{
            if(value.echo!==null||value.requestBytes!==0||value.responseBytes!==0)invalid();
            if(value.measurement==='tcp-ingress-tls-v1'){
                if(!(value.status==='verified'&&value.code==='tls-handshake-verified'&&value.tls!==null||value.status==='unreachable'&&value.code==='tcp-connect-failed'&&value.tls===null||
                    value.status==='unverified'&&value.code==='tls-handshake-failed'&&value.tls===null))invalid();
            }else if(value.tls!==null||!(value.status==='connected'&&value.code==='tcp-connected'||value.status==='unreachable'&&value.code==='tcp-connect-failed'))invalid();
        }
    }else if(value.kind==='probe-echo-result-ack'){if(time(value.acceptedAt)<0||time(value.serverTime)<time(value.acceptedAt))invalid();}
    return deepFreeze(value);
}
type Pairs={Qualification:[ProbeEchoQualificationRequest,ProbeEchoQualificationResponse];Poll:[ProbeEchoPollRequest,ProbeEchoPollResponse];
    Claim:[ProbeEchoClaimRequest,ProbeEchoClaimResponse];Status:[ProbeEchoStatusRequest,ProbeEchoStatusResponse];Result:[ProbeEchoResultRequest,ProbeEchoResultResponse]};
export function checkProbeEcho<K extends keyof Pairs>(name:K,request:Pairs[K][0],response:Pairs[K][1]):void {
    const req=parseProbeEcho(`${name}Request` as keyof Messages,JSON.stringify(request)),ack=parseProbeEcho(`${name}Response` as keyof Messages,JSON.stringify(response));
    if(req.nodeId!==ack.nodeId||req.bootId!==ack.bootId||req.sessionEpoch!==ack.sessionEpoch||req.instanceId!==ack.instanceId||
        req.instanceGeneration!==ack.instanceGeneration||req.requestId!==ack.requestId)invalid();
    if('measurement'in req&&(!('measurement'in ack)||req.measurement!==ack.measurement||req.taskKind!==ack.taskKind||req.point!==ack.point||req.capability!==ack.capability||
        req.businessProtocol!==ack.businessProtocol||digest(req.service)!==digest(ack.service)||digest(req.challenge)!==digest(ack.challenge)))invalid();
    if('permitId'in req&&(!('permitId'in ack)||req.permitId!==ack.permitId))invalid();
    if('measurements'in req&&(!('measurements'in ack)||digest(req.measurements)!==digest(ack.measurements)))invalid();
    if(req.kind==='probe-echo-instance'&&(ack.kind!=='probe-echo-instance-ack'||req.action!==ack.action))invalid();
    if(req.kind==='probe-echo-result'&&(ack.kind!=='probe-echo-result-ack'||probeEchoResultDigest(req)!==ack.resultDigest||
        time(ack.acceptedAt)<time(req.measuredAt)||time(ack.acceptedAt)>=time(req.validUntil)||time(ack.serverTime)>=time(req.validUntil)))invalid();
}
export function probeEchoResultBody(input:ProbeEchoResultRequest):ProbeEchoResultBody {
    const {requestId:_,...body}=parseProbeEcho('ResultRequest',JSON.stringify(input));return deepFreeze(body);
}
export function probeEchoResultDigest(input:ProbeEchoResultRequest):string{return digest(probeEchoResultBody(input));}
