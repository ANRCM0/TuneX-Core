import { isCounter, isId } from '@tunex/core';
import { ControlError } from '../../framework/public.ts';
import type { ProbeInstanceRecord } from './instance-contracts.ts';
import type { ProbeTypeQualification } from './measurement-contracts.ts';

export const probeQualificationUnavailable:()=>never=()=>{throw new ControlError('PROBE_PERMIT_UNAVAILABLE',409,'Current typed Probe qualification required');};
export const sameProbeQualificationInstance=(value:ProbeTypeQualification,slot:ProbeInstanceRecord)=>value.nodeId===slot.nodeId&&value.bootId===slot.bootId&&
    value.sessionEpoch===slot.sessionEpoch&&value.fingerprint===slot.fingerprint&&value.instanceId===slot.instanceId&&value.instanceGeneration===slot.generation;
export function parseProbeQualification(value:ProbeTypeQualification|null):ProbeTypeQualification|null {
    if(value===null)return null;
    const keys=['bootId','expiresAt','fingerprint','instanceGeneration','instanceId','nodeId','qualifiedAt','sessionEpoch','state'];
    if(Object.hasOwn(value,'servicesVersion'))keys.push('servicesVersion');
    if(Object.hasOwn(value,'echoVersion'))keys.push('echoVersion');
    if(Object.keys(value).sort().join(',')!==keys.sort().join(',')||Object.hasOwn(value,'servicesVersion')&&value.servicesVersion!==1||
        Object.hasOwn(value,'echoVersion')&&(value.echoVersion!==1||value.servicesVersion!==1)||
        ![value.nodeId,value.bootId].every(isId)||!isCounter(value.sessionEpoch)||!isCounter(value.instanceGeneration)||
        !/^[a-f0-9]{64}$(?![\s\S])/.test(value.fingerprint)||!/^[a-f0-9]{64}$(?![\s\S])/.test(value.instanceId)||
        !['qualified','revoked','quarantined'].includes(value.state)||!Number.isSafeInteger(value.qualifiedAt)||value.qualifiedAt<0||
        !Number.isSafeInteger(value.expiresAt)||value.expiresAt<=value.qualifiedAt||value.expiresAt-value.qualifiedAt>30000)
        throw new ControlError('INTEGRITY_FAILURE',409,'Invalid typed Probe qualification');
    return value;
}

export function requireProbeTypeQualification(input:ProbeTypeQualification|null,slot:ProbeInstanceRecord,now:number):ProbeTypeQualification {
    const value=parseProbeQualification(input);
    if(!value||!sameProbeQualificationInstance(value,slot)||value.state!=='qualified'||slot.state!=='registered'||
        value.qualifiedAt<slot.registeredAt||value.qualifiedAt>now||value.expiresAt>slot.expiresAt||value.expiresAt<=now)probeQualificationUnavailable();
    return value;
}
