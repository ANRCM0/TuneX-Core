import type { AuditStorage, AuditStoragePolicy, AuditStorageRow } from '../../framework/public.ts';
import { AUDIT_SOURCES, AUDIT_ERROR_CODES } from './contracts.ts';
import type { AuditReadPort, AuditReadQuery, AuditRecord, AuditSource } from './contracts.ts';

// Keep the original array identities/mutability and per-query SQL interpretation.
export const auditStoragePolicy:AuditStoragePolicy=Object.freeze({sources:AUDIT_SOURCES,errorCodes:AUDIT_ERROR_CODES});

// The old native implementation asserted this view; actual closed validation
// still runs in AuditEvents.row at its original point, not in this projection.
const projectAuditRecord=(row:AuditStorageRow)=>row as unknown as AuditRecord;

export class AuditReadModels<Tx> implements AuditReadPort<Tx> {
    private readonly store:AuditStorage<Tx>;
    constructor(store:AuditStorage<Tx>) {this.store=store;}
    async source(tx:Tx,scope:string,source:AuditSource,query:AuditReadQuery):Promise<AuditRecord[]> {
        return this.store.source(tx,scope,source,query,projectAuditRecord);
    }
}
