import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, parseProbeServiceSelection, probeEchoInvocationDigest, probeEchoRequestFrame,
    nativeCanonicalBase64Bytes, nativeBytesFingerprint, nativeProbeHistoryEchoInvocation as invocation, jsonUtf8Bytes } from '../../compatibility/public.ts';
import type { ProbeEchoChallenge } from '../../compatibility/public.ts';
import { invalid } from '../../framework/public.ts';
import { validProbeBinding } from '../probe-owner/public.ts';
import type { ProbeRunLosses, ProbeRunPermit, ProbeRunRecord, ProbeRunResult } from './contracts.ts';
import { probeMeasurement } from '../probe-owner/public.ts';

import { PROBE_RUN_LIMITS } from './policy.ts';
export { PROBE_RUN_LIMITS } from './policy.ts';
export const PROBE_RUN_STATES = ['issued','consumed','revoked','quarantined'] as const;
export const probeRunTime = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 253402300799999;
const hash = (value: unknown): value is string => typeof value === 'string' && /^sha256:[a-f0-9]{64}$(?![\s\S])/.test(value);
const hex = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$(?![\s\S])/.test(value);
const echoMeasurement = (value: unknown) => ['tcp-ingress-echo-v1','udp-ingress-echo-v1','tcp-path-echo-v1','udp-path-echo-v1'].includes(value as string);
const serviceMeasurement = (value: unknown) => value === 'tcp-ingress-tls-v1' || echoMeasurement(value);
const base64Bytes=nativeCanonicalBase64Bytes;
function challenge(input:unknown):ProbeEchoChallenge {
    const value=probeRunObject(input,['nonce','invocationDigest']);
    if(!base64Bytes(value.nonce,32)||!hash(value.invocationDigest))invalid('Invalid Probe echo history challenge');
    return value as unknown as ProbeEchoChallenge;
}
export function probeRunObject(input: unknown, keys: readonly string[]): Record<string,unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype,null].includes(Object.getPrototypeOf(input)) ||
        Object.keys(input).sort().join(',') !== [...keys].sort().join(',')) invalid('Closed Probe history value required');
    return input as Record<string,unknown>;
}
const permitKeys = ['probeId','scopeId','actorId','binding','instanceId','instanceGeneration','timeoutMs','issuedAt','expiresAt','state','closedAt'];
function permit(value: Record<string,unknown>): ProbeRunPermit {
    if (![value.probeId,value.scopeId,value.actorId].every(isId) || !validProbeBinding(value.binding) || !hex(value.instanceId) ||
        !isCounter(value.instanceGeneration) || !isCounter(value.timeoutMs) || value.timeoutMs < 100 || value.timeoutMs > 2000 ||
        !probeRunTime(value.issuedAt) || !probeRunTime(value.expiresAt) || value.expiresAt <= value.issuedAt || value.expiresAt-value.issuedAt>2000 ||
        !PROBE_RUN_STATES.includes(value.state as ProbeRunPermit['state']) ||
        (value.state==='issued' ? value.closedAt!==null : !probeRunTime(value.closedAt) || value.closedAt<value.issuedAt) ||
        value.state==='consumed'&&typeof value.closedAt==='number'&&value.closedAt>=value.expiresAt)
        invalid('Invalid Probe history permit summary');
    if(Object.hasOwn(value,'measurement')&&!['tcp-ingress-connect-v1','tcp-ingress-tls-v1','tcp-ingress-echo-v1','udp-ingress-echo-v1','tcp-path-echo-v1','udp-path-echo-v1'].includes(value.measurement as string))invalid('Invalid Probe history measurement');
    const service=serviceMeasurement(value.measurement)?parseProbeServiceSelection(value.service):null;
    if(service!==null&&service.scopeId!==value.scopeId)invalid('Probe history service Scope differs');
    const echo=echoMeasurement(value.measurement)?challenge(value.echoChallenge):null;
    const result:ProbeRunPermit={ ...(echo!==null?{measurement:value.measurement as 'tcp-ingress-echo-v1'|'udp-ingress-echo-v1'|'tcp-path-echo-v1'|'udp-path-echo-v1',service:service!,echoChallenge:echo}:value.measurement==='tcp-ingress-tls-v1'?{measurement:'tcp-ingress-tls-v1' as const,service:service!}:
        value.measurement==='tcp-ingress-connect-v1'?{measurement:'tcp-ingress-connect-v1' as const}:{}), probeId:value.probeId as string,scopeId:value.scopeId as string,actorId:value.actorId as string,binding:{...value.binding},
        instanceId:value.instanceId,instanceGeneration:value.instanceGeneration,timeoutMs:value.timeoutMs,
        issuedAt:value.issuedAt,expiresAt:value.expiresAt,state:value.state as ProbeRunPermit['state'],closedAt:value.closedAt as number|null };
    if(echo!==null&&probeEchoInvocationDigest(invocation(result))!==echo.invocationDigest)invalid('Probe echo history invocation differs');
    return result;
}
function measurementKeys(input:unknown,keys:readonly string[]):readonly string[] {
    if(input===null||typeof input!=='object'||!Object.hasOwn(input,'measurement'))return keys;
    const measurement=(input as {measurement:unknown}).measurement;
    return [...keys,'measurement',...(serviceMeasurement(measurement)?['service']:[]),...(echoMeasurement(measurement)?['echoChallenge']:[])];
}
export function parseProbeRunPermit(input: unknown): ProbeRunPermit { return deepFreeze(permit(probeRunObject(input,measurementKeys(input,permitKeys)))); }
export function parseProbeRunResult(input: unknown, owner: ProbeRunPermit): ProbeRunResult {
    const tlsOwner=owner.measurement==='tcp-ingress-tls-v1',echoOwner=echoMeasurement(owner.measurement);
    const value=probeRunObject(input,['status','code','elapsedMs','measuredAt','validUntil','acceptedAt','resultDigest',...(tlsOwner?['tls']:[]),...(echoOwner?['echo','requestBytes','responseBytes']:[])]);
    const expectedCode=value.status==='echoed'?'nonce-echo-verified':value.status==='verified'?'tls-handshake-verified':value.status==='unverified'?(echoOwner?'nonce-echo-rejected':'tls-handshake-failed'):value.status==='connected'?'tcp-connected':'tcp-connect-failed';
    const statuses=echoOwner?((owner.measurement==='udp-ingress-echo-v1'||owner.measurement==='udp-path-echo-v1')?['echoed','unverified']:['echoed','unverified','unreachable']):tlsOwner?['verified','unverified','unreachable']:['connected','unreachable'];
    if (!statuses.includes(value.status as string) || value.code!==expectedCode ||
        !isCounter(value.elapsedMs,true) || value.elapsedMs>owner.timeoutMs || !probeRunTime(value.measuredAt) || !probeRunTime(value.validUntil) ||
        !probeRunTime(value.acceptedAt) || !hash(value.resultDigest) || owner.state!=='consumed' || owner.closedAt===null ||
        value.measuredAt<owner.closedAt || value.validUntil<=value.measuredAt || value.validUntil>owner.expiresAt ||
        value.acceptedAt<value.measuredAt || value.acceptedAt>=value.validUntil) invalid('Invalid Probe history result summary');
    if(tlsOwner){
        if(value.status==='verified'){
            const proof=probeRunObject(value.tls,['version','alpn','leafFingerprint','verified']);
            if(proof.version!=='TLSv1.3'||proof.alpn!=='tunex-observation/1'||!hash(proof.leafFingerprint)||proof.verified!==true)invalid('Invalid Probe TLS history evidence');
        }else if(value.tls!==null)invalid('Unverified Probe TLS history must not carry evidence');
    }
    if(echoOwner){
        if(!isCounter(value.requestBytes,true)||value.requestBytes>256||!isCounter(value.responseBytes,true)||value.responseBytes>256)
            invalid('Invalid Probe echo history byte counters');
        if(value.status==='echoed'){
            const proof=probeRunObject(value.echo,['algorithm','requestDigest','signature','verified']);
            if(proof.algorithm!=='Ed25519'||!hash(proof.requestDigest)||!base64Bytes(proof.signature,64)||proof.verified!==true||value.requestBytes!==256||value.responseBytes!==256)
                invalid('Invalid Probe echo history evidence');
            if(proof.requestDigest!==nativeBytesFingerprint(probeEchoRequestFrame(invocation(owner),owner.echoChallenge!)))
                invalid('Probe echo history request evidence differs');
        }else if(value.echo!==null||value.status==='unreachable'&&(value.requestBytes!==0||value.responseBytes!==0)||value.status==='unverified'&&value.requestBytes!==256)
            invalid('Invalid rejected Probe echo history evidence');
    }
    return deepFreeze(value as unknown as ProbeRunResult);
}
export function parseProbeRunRecord(input: unknown): ProbeRunRecord {
    const value=probeRunObject(input,measurementKeys(input,[...permitKeys,'revision','updatedAt','withdrawnAt','result','recoverySuspended'])),owner=permit(value);
    if (!isCounter(value.revision) || !probeRunTime(value.updatedAt) || value.updatedAt<owner.issuedAt ||
        owner.closedAt!==null&&owner.closedAt>value.updatedAt || typeof value.recoverySuspended!=='boolean' ||
        value.withdrawnAt!==null&&(!probeRunTime(value.withdrawnAt)||owner.state!=='consumed'||owner.closedAt===null||value.withdrawnAt<owner.closedAt||value.withdrawnAt>value.updatedAt))
        invalid('Invalid Probe history lifecycle');
    const result=value.result===null?null:parseProbeRunResult(value.result,owner);
    if (result && (result.acceptedAt>value.updatedAt || value.withdrawnAt!==null&&result.acceptedAt>value.withdrawnAt))
        invalid('Invalid Probe history result ordering');
    const record={...owner,revision:value.revision,updatedAt:value.updatedAt,withdrawnAt:value.withdrawnAt as number|null,result,recoverySuspended:value.recoverySuspended};
    if (jsonUtf8Bytes(record)>PROBE_RUN_LIMITS.maxRecordBytes) invalid('Bounded Probe history record required');
    return deepFreeze(record);
}
export function parseProbeRunLosses(input: unknown): ProbeRunLosses {
    const value=probeRunObject(input,['rowsExpired','rowsEvicted','updatesWithoutHead']);
    if (Object.values(value).some(v=>!isCounter(v,true))) invalid('Invalid Probe history loss counters');
    return deepFreeze(value as unknown as ProbeRunLosses);
}
export function probeRunImmutable(value: ProbeRunPermit): string {
    return digest({...(value.measurement===undefined?{}:{measurement:value.measurement}),...(serviceMeasurement(value.measurement)?{service:value.service}:{}),...(echoMeasurement(value.measurement)?{echoChallenge:value.echoChallenge}:{}),probeId:value.probeId,scopeId:value.scopeId,actorId:value.actorId,binding:value.binding,
        instanceId:value.instanceId,instanceGeneration:value.instanceGeneration,timeoutMs:value.timeoutMs,issuedAt:value.issuedAt,expiresAt:value.expiresAt});
}
export function publicProbeRun(value: ProbeRunRecord, capturedAt: number) {
    const descriptor=probeMeasurement(value.measurement??'tcp-connect-v1');
    return deepFreeze({...value,kind:descriptor.taskKind,businessProtocol:(value.measurement==='udp-ingress-echo-v1'||value.measurement==='udp-path-echo-v1')?'udp':'tcp',point:descriptor.point,independentProbe:false,
        applicationPayloadBytes:echoMeasurement(value.measurement)&&value.result!==null?(value.result.requestBytes??0)+(value.result.responseBytes??0):0,health:'unknown',executionAuthorized:false,historical:true,
        permitExpired:value.expiresAt<=capturedAt,resultExpired:value.result===null?null:value.result.validUntil<=capturedAt,
        resultSource:value.result===null?'not-received':'agent-reported',bindingMatchCurrent:'not-evaluated',
        resultDigestVerification:'captured-from-original-owner-not-recomputed',contentDigest:digest(value)});
}
