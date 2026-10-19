import type { StationFactValues, StationStorageValues, StationPolicyRecord, StationPolicyAuditRecord, StationEventRecord } from '../../framework/public.ts';
import { AUDIT_ERROR_CODES } from '../audit-owner/public.ts';
import type { StationAlertEvent, StationAlertPolicy, StationAlertPolicyAudit } from './contracts.ts';

// Original storage asserted these shapes; the application's full validators run later.
export const stationAlertStorageValues:StationStorageValues<StationAlertPolicy,StationAlertPolicyAudit,StationAlertEvent>=Object.freeze({
    policy:(input:StationPolicyRecord)=>input as StationAlertPolicy,
    audit:(input:StationPolicyAuditRecord)=>input as StationAlertPolicyAudit,
    event:(input:StationEventRecord)=>input as StationAlertEvent,
});

const codes=new Set<string>(AUDIT_ERROR_CODES);
export const stationAlertFactValues:StationFactValues=Object.freeze({
    errorCode:(value:unknown)=>value===null?null:typeof value==='string'&&codes.has(value)?value:'OTHER_ERROR',
});
