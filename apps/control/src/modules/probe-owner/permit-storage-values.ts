import { ControlError, freezeModuleValue } from '../../framework/public.ts';
import type { ProbePermitStorageValues, ProbePermitStoredInput, ProbePermitResultInput } from '../../framework/public.ts';
import { nativeStoredProbeResultCheck as checkResult } from '../../compatibility/public.ts';
import type { ProbePermitRecord } from './permit-contracts.ts';
import type { ProbeResultRecord } from './result-contracts.ts';
import { validProbePermit } from './permit-state.ts';

function readPermit(row:ProbePermitStoredInput,decode:(value:unknown)=>unknown):ProbePermitRecord {
    const echo=['tcp-ingress-echo-v1','udp-ingress-echo-v1','tcp-path-echo-v1','udp-path-echo-v1'].includes(row.measurement);
    if(!['tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1','tcp-ingress-echo-v1','udp-ingress-echo-v1','tcp-path-echo-v1','udp-path-echo-v1'].includes(row.measurement)||
        (row.measurement==='tcp-ingress-tls-v1'||echo)!==(row.tlsContext!==null)||echo!==(row.echoChallenge!==null))throw new ControlError('PROBE_PERMIT_CORRUPT',503,'Invalid persisted Probe measurement/context');
    const value = { ...(echo?{measurement:row.measurement as 'tcp-ingress-echo-v1'|'udp-ingress-echo-v1'|'tcp-path-echo-v1'|'udp-path-echo-v1',serviceContext:decode(row.tlsContext),echoChallenge:decode(row.echoChallenge)}:row.measurement==='tcp-ingress-tls-v1'?{measurement:'tcp-ingress-tls-v1' as const,serviceContext:decode(row.tlsContext)}:
        row.measurement==='tcp-ingress-connect-v1'?{measurement:'tcp-ingress-connect-v1' as const}:{}), id: row.id, actorId: row.actorId, scopeId: row.scopeId, binding: decode(row.binding),
        instanceId: row.instanceId, instanceGeneration: row.instanceGeneration, fingerprint: row.fingerprint,
        timeoutMs: row.timeoutMs, issuedAt: row.issuedAt, expiresAt: row.expiresAt, state: row.state, closedAt: row.closedAt };
    if (!validProbePermit(value)) throw new ControlError('PROBE_PERMIT_CORRUPT', 503, 'Invalid persisted Probe permit');
    return freezeModuleValue(value);
}
function readResult(value:ProbePermitResultInput):ProbeResultRecord {
    const record=value as ProbeResultRecord;
    checkResult(record);return record;
}
export const probePermitStorageValues:ProbePermitStorageValues<ProbePermitRecord,ProbeResultRecord>=
    freezeModuleValue({readPermit,validPermit:validProbePermit,readResult,checkResult});
