import { AuditReadModels, auditStoragePolicy } from '../modules/audit-owner/public.ts';
import { MySqlAuditReadStore } from './mysql-audit-read-store.ts';
import type { AuditReadPort, AuditReadQuery, AuditRecord, AuditSource } from '../modules/audit-owner/public.ts';
import type { Transaction } from './mysql.ts';

const reader=new AuditReadModels(new MySqlAuditReadStore(auditStoragePolicy));

/** Existing stateless zero-argument/prototype seam; production binds lower SQL and owner projection explicitly. */
export class MySqlAuditEvents implements AuditReadPort<Transaction> {
    async source(tx:Transaction,scope:string,source:AuditSource,query:AuditReadQuery):Promise<AuditRecord[]> {return reader.source(tx,scope,source,query);}
}
