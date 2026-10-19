import { isCounter, isId } from '@tunex/core';
import { parseProbeServiceContext, parseProbeEchoServiceContext, parseProbeEchoChallenge,
    nativeProbeEchoInvocation, probeEchoInvocationDigest } from '../../compatibility/public.ts';
import type { NativeProbeEchoInvocationSource } from '../../compatibility/public.ts';
import type { ProbeBinding } from './plan-contracts.ts';
import type { ProbePermitRecord } from './permit-contracts.ts';

const bindingKeys = ['nodeId', 'bootId', 'sessionEpoch', 'snapshotGeneration', 'assignmentId', 'forwardId',
    'forwardRevision', 'deploymentGeneration', 'bindingFence', 'configDigest', 'egressPolicyRevision'].sort().join(',');
function object(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function validProbeBinding(value: unknown): value is ProbeBinding {
    if (!object(value) || Object.keys(value).sort().join(',') !== bindingKeys) return false;
    return ['nodeId', 'bootId', 'assignmentId', 'forwardId'].every(k => isId(value[k])) &&
        ['sessionEpoch', 'snapshotGeneration', 'forwardRevision', 'deploymentGeneration', 'bindingFence', 'egressPolicyRevision']
            .every(k => isCounter(value[k])) && typeof value.configDigest === 'string' &&
        /^sha256:[a-f0-9]{64}$/.test(value.configDigest) && value.configDigest.length === 71;
}
export function sameProbeBinding(a: ProbeBinding, b: ProbeBinding): boolean {
    return validProbeBinding(a) && validProbeBinding(b) &&
        Object.keys(a).every(k => a[k as keyof ProbeBinding] === b[k as keyof ProbeBinding]);
}
export function validProbePermit(value: unknown): value is ProbePermitRecord {
    if (!object(value)) return false;
    const keys=Object.keys(value).sort().join(','),legacy='actorId,binding,closedAt,expiresAt,fingerprint,id,instanceGeneration,instanceId,issuedAt,scopeId,state,timeoutMs';
    const ingress='actorId,binding,closedAt,expiresAt,fingerprint,id,instanceGeneration,instanceId,issuedAt,measurement,scopeId,state,timeoutMs';
    const tls='actorId,binding,closedAt,expiresAt,fingerprint,id,instanceGeneration,instanceId,issuedAt,measurement,scopeId,serviceContext,state,timeoutMs';
    const echo='actorId,binding,closedAt,echoChallenge,expiresAt,fingerprint,id,instanceGeneration,instanceId,issuedAt,measurement,scopeId,serviceContext,state,timeoutMs';
    const isEcho=value.measurement==='tcp-ingress-echo-v1'||value.measurement==='udp-ingress-echo-v1';
    if(keys!==legacy&&(keys!==ingress||value.measurement!=='tcp-ingress-connect-v1')&&
        (keys!==tls||value.measurement!=='tcp-ingress-tls-v1')&&(keys!==echo||!isEcho))return false;
    if(isEcho) {
        try {
            const context=parseProbeEchoServiceContext(value.serviceContext),challenge=parseProbeEchoChallenge(value.echoChallenge);
            if(context.scopeId!==value.scopeId||context.config.version!==2||
                !context.config.endpoint.protocols.some(p=>p===(value.measurement==='udp-ingress-echo-v1'?'udp':'tcp'))||
                typeof value.issuedAt!=='number'||typeof value.expiresAt!=='number'||context.config.validFrom>value.issuedAt||context.config.validUntil<value.expiresAt||
                probeEchoInvocationDigest(nativeProbeEchoInvocation(value as unknown as NativeProbeEchoInvocationSource,
                    ()=>context,()=>challenge.nonce))!==challenge.invocationDigest)return false;
        }catch{return false;}
    }
    if(value.measurement==='tcp-ingress-tls-v1') {
        try {
            const context=parseProbeServiceContext(value.serviceContext);
            if(context.scopeId!==value.scopeId||typeof value.issuedAt!=='number'||typeof value.expiresAt!=='number'||
                context.config.validFrom>value.issuedAt||context.config.validUntil<value.expiresAt)return false;
        } catch { return false; }
    }
    return [value.id, value.actorId, value.scopeId].every(isId) && validProbeBinding(value.binding) &&
        typeof value.instanceId === 'string' && value.instanceId.length === 64 && /^[a-f0-9]{64}$/.test(value.instanceId) &&
        typeof value.fingerprint === 'string' && value.fingerprint.length === 64 && /^[a-f0-9]{64}$/.test(value.fingerprint) &&
        isCounter(value.instanceGeneration) && Number.isSafeInteger(value.timeoutMs) &&
        (value.timeoutMs as number) >= 100 && (value.timeoutMs as number) <= 2000 &&
        Number.isSafeInteger(value.issuedAt) && (value.issuedAt as number) >= 0 &&
        Number.isSafeInteger(value.expiresAt) && (value.expiresAt as number) > (value.issuedAt as number) &&
        (value.expiresAt as number) - (value.issuedAt as number) <= 2000 &&
        ['issued', 'consumed', 'revoked', 'quarantined'].includes(value.state as string) &&
        (value.state === 'issued' ? value.closedAt === null : Number.isSafeInteger(value.closedAt) && (value.closedAt as number) >= 0);
}
