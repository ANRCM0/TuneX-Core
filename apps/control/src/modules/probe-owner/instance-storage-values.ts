import { isCounter, isId } from '@tunex/core';
import { ControlError, freezeModuleValue } from '../../framework/public.ts';
import type { ProbeInstanceStoredRecord, ProbeInstanceStorageValues } from '../../framework/public.ts';
import type { ProbeInstanceRecord } from './instance-contracts.ts';

function read(value:ProbeInstanceStoredRecord,nodeId:string):ProbeInstanceRecord {
    if (value.nodeId !== nodeId || !isId(value.nodeId) || !isId(value.bootId) ||
        !isCounter(value.sessionEpoch) || !isCounter(value.generation) ||
        typeof value.fingerprint !== 'string' || value.fingerprint.length !== 64 || !/^[0-9a-f]{64}$/.test(value.fingerprint) ||
        typeof value.instanceId !== 'string' || value.instanceId.length !== 64 || !/^[0-9a-f]{64}$/.test(value.instanceId) ||
        !['registered', 'revoked', 'quarantined'].includes(value.state) ||
        !Number.isSafeInteger(value.registeredAt) || value.registeredAt < 0 ||
        !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= value.registeredAt ||
        value.expiresAt - value.registeredAt > 30000 ||
        (value.state === 'registered' ? value.revokedAt !== null : !Number.isSafeInteger(value.revokedAt) || value.revokedAt! < 0))
        throw new ControlError('PROBE_INSTANCE_CORRUPT', 503, 'Invalid persisted Probe instance; operator review required');
    return value as ProbeInstanceRecord;
}
function closing(expectedGeneration:number,next:ProbeInstanceRecord):boolean {
    const closing = next.generation === expectedGeneration && next.state === 'revoked';
    if (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 0 ||
        !(closing || next.generation === expectedGeneration + 1 && next.state === 'registered'))
        throw new ControlError('PROBE_INSTANCE_CONFLICT', 409, 'Invalid Probe ownership transition');
    return closing;
}
export const probeInstanceStorageValues:ProbeInstanceStorageValues<ProbeInstanceRecord>=freezeModuleValue({read,closing});
