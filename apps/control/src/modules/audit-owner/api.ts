import type { AuditFilters, AuditRecord, AuditSource } from './contracts.ts';
import type { AUDIT_COVERAGE, AUDIT_LIMITS } from './policy.ts';

export const AUDIT_API_INTERFACE_VERSION=2 as const;

export interface AuditHistory {
    auditVersion:number;scopeId:string;capturedAt:string;source:'persisted-owner-records';readOnly:true;
    executionAuthorized:false;health:'unknown';networkCheck:'not-performed';consistency:'read-committed-not-global-snapshot';
    window:{from:string;to:string};filters:AuditFilters;limit:number;
    items:(Omit<AuditRecord,'occurredAt'>&{occurredAt:string})[];nextCursor:string|null;hasMore:boolean;
    coverage:typeof AUDIT_COVERAGE&{sources:AuditSource[]};limits:typeof AUDIT_LIMITS;
}
export interface AuditEventsApi {
    admitReadRequest<T>(action:()=>Promise<T>):Promise<T>;
    query(actor:string,scope:string,input:Record<string,string|undefined>):Promise<AuditHistory>;
}
