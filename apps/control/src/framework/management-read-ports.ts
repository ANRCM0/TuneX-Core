import type { StoredValues } from './intent-store-ports.ts';

export const MANAGEMENT_READ_INTERFACE_VERSION=1 as const;

export interface ReadPageWindow {page:number;limit:number;offset:number}
export type ReadFilters=Readonly<Record<string,string>>;
export type ManagementReadKind='nodes'|'forwards'|'operations'|'candidates';
export interface ManagementReadEffects {
    readonly now:()=>number;
    readonly validateFilters:(kind:ManagementReadKind,filters:ReadFilters)=>void;
}
/** Formatting/observation effects only, never an execution clock or authority source. */
export interface ReadProjectionValues extends Pick<StoredValues,'read'> {
    now():number;
    iso(at:number):string;
    currentIso():string;
}
export interface ReadCount {n:number}
export interface ReadRows<Row> {count:ReadCount|undefined;records:Row[]}
export interface ReadNodeRow {
    id:string;revoked:number;credential_until:number|null;facts:unknown;
    session_epoch:number|null;snapshot_generation:number|null;received_at:number|null;
}
export interface ReadForwardRow {
    id:string;revision:number;spec:unknown;recovery_suspended:number;
    operation_id:string|null;operation_kind:string|null;operation_status:string|null;
}
export interface ReadOperationRow {
    id:string;forward_id:string;kind:string;status:string;target_revision:number;
    created_at:number;updated_at:number;last_error:unknown;recovery_invalidated:number;cleanup_pending:number;
}
export interface ReadOverviewRow {nodes:number;forwards:number;active:number;failed:number}
export interface ReadDiagnosticsRow {
    id:string;revoked:number;credential_until:number|null;session_epoch:number|null;
    snapshot_generation:number|null;last_report_sequence:number|null;received_at:number|null;
    last_report:unknown;valid_until:number|null;
}
export interface ReadForwardReferenceRow {id:string;revision:number;spec:unknown;recovery_suspended:number}
export interface ReadTunnelNodeRow {
    id:string;revoked:number;credential_until:number|null;capabilities:unknown;
    session_epoch:number|null;snapshot_generation:number|null;received_at:number|null;
}
export interface ReadTunnelEndpointRow {revision:number;config:unknown}
export interface ReadTunnelPeerRow {fingerprint:string;issued_at:number;valid_until:number;retire_after:number|null;revoked:number}
export interface ReadTunnelPeers {count:{total:number;window_count:number}|undefined;records:ReadTunnelPeerRow[]}

/** SELECT-only on the supplied transaction. Invoke project once, synchronously
 * after the final read and before returning; do not await, retry or retain it.
 * This preserves projection/decoding failure order without importing an outer DTO.
 */
export interface ManagementReadStore<Tx> {
    nodes<R>(tx:Tx,scope:string,paging:ReadPageWindow,filters:ReadFilters,project:(page:ReadRows<ReadNodeRow>)=>R):Promise<R>;
    forwards<R>(tx:Tx,scope:string,paging:ReadPageWindow,filters:ReadFilters,project:(page:ReadRows<ReadForwardRow>)=>R):Promise<R>;
    operations<R>(tx:Tx,scope:string,paging:ReadPageWindow,filters:ReadFilters,project:(page:ReadRows<ReadOperationRow>)=>R):Promise<R>;
    candidates<R>(tx:Tx,actor:string,scope:string,paging:ReadPageWindow,filters:ReadFilters,capabilities:string[],project:(page:ReadRows<ReadNodeRow>)=>R):Promise<R>;
    overview<R>(tx:Tx,scope:string,project:(record:ReadOverviewRow|undefined)=>R):Promise<R>;
    diagnostics<R>(tx:Tx,scope:string,nodeId:string,project:(record:ReadDiagnosticsRow|undefined)=>R):Promise<R>;
}
export interface ProfileReferenceReadStore<Tx> {
    profile<R>(tx:Tx,scope:string,profile:string,project:(record:{current_revision:number}|undefined)=>R):Promise<R>;
    references<R>(tx:Tx,scope:string,profile:string,paging:ReadPageWindow,revision:number|undefined,project:(page:ReadRows<ReadForwardReferenceRow>)=>R):Promise<R>;
}
export interface TunnelMetadataReadStore<Tx> {
    node<R>(tx:Tx,scope:string,node:string,project:(record:ReadTunnelNodeRow|undefined)=>R):Promise<R>;
    endpoint<R>(tx:Tx,node:string,project:(record:ReadTunnelEndpointRow|undefined)=>R):Promise<R>;
    peers<R>(tx:Tx,node:string,now:number,project:(page:ReadTunnelPeers)=>R):Promise<R>;
    references<R>(tx:Tx,scope:string,node:string,paging:ReadPageWindow,project:(page:ReadRows<ReadForwardReferenceRow>)=>R):Promise<R>;
}
