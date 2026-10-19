import { isCounter, isId } from '@tunex/core';
import { ControlError, freezeModuleValue } from '../../framework/public.ts';
import type { ProbeQualificationStoredRecord, ProbeQualificationStorageValues } from '../../framework/public.ts';
import type { ProbeTypeQualification } from './measurement-contracts.ts';

const hex=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$(?![\s\S])/.test(value);
function read(value:ProbeQualificationStoredRecord):ProbeTypeQualification {
    if(![value.nodeId,value.bootId].every(isId)||!isCounter(value.sessionEpoch)||!isCounter(value.instanceGeneration)||
        !hex(value.fingerprint)||!hex(value.instanceId)||!['qualified','revoked','quarantined'].includes(value.state)||
        !Number.isSafeInteger(value.qualifiedAt)||value.qualifiedAt<0||!Number.isSafeInteger(value.expiresAt)||
        value.expiresAt<=value.qualifiedAt||value.expiresAt-value.qualifiedAt>30000||value.expiresAt>253402300799999||
        Object.hasOwn(value,'servicesVersion')&&value.servicesVersion!==1||
        Object.hasOwn(value,'echoVersion')&&(value.echoVersion!==1||value.servicesVersion!==1))
        throw new ControlError('INTEGRITY_FAILURE',409,'Invalid Probe type qualification');
    return value as ProbeTypeQualification;
}
export const probeQualificationStorageValues:ProbeQualificationStorageValues<ProbeTypeQualification>=freezeModuleValue({read});
