import type { ReadPrincipal } from '../framework/public.ts';
import { isId } from '@tunex/core';
import { ControlError, invalid } from '../framework/public.ts';
import type { ProbeHistoryRecord, ProbeHistoryLosses, ProbeHistoryQuery, ProbeHistoryValues, ProbeHistoryStorage } from '../framework/public.ts';
import { json, rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

type Row = Record<string,unknown>;
const maximum = 9007199254740991;
const fields = 'scope_id,probe_id,actor_id,forward_id,node_id,binding,instance_id,instance_generation,timeout_ms,issued_at,expires_at,state,closed_at,revision,updated_at,withdrawn_at,result_status,result_code,result_elapsed_ms,result_measured_at,result_valid_until,result_accepted_at,result_digest,recovery_suspended,measurement,service_selection,result_tls,echo_challenge,result_echo,result_request_bytes,result_response_bytes';
const projection = fields.replace(',binding,',',IF(OCTET_LENGTH(binding)<=2048,binding,NULL) binding,')
    .replace(',service_selection,',",IF(service_selection IS NULL OR OCTET_LENGTH(service_selection)<=1024,service_selection,JSON_OBJECT('invalid','oversized')) service_selection,")
    .replace(',result_tls,',",IF(result_tls IS NULL OR OCTET_LENGTH(result_tls)<=512,result_tls,JSON_OBJECT('invalid','oversized')) result_tls,")
    .replace(',echo_challenge,',",IF(echo_challenge IS NULL OR OCTET_LENGTH(echo_challenge)<=512,echo_challenge,JSON_OBJECT('invalid','oversized')) echo_challenge,")
    .replace(',result_echo,',",IF(result_echo IS NULL OR OCTET_LENGTH(result_echo)<=512,result_echo,JSON_OBJECT('invalid','oversized')) result_echo,");
function corrupt(): never { throw new ControlError('INTEGRITY_FAILURE',409,'Invalid Probe run history storage'); }
function integer(value: unknown, positive = false): number {
    const n = typeof value==='string' && /^(0|[1-9][0-9]{0,15})$(?![\s\S])/.test(value) ? Number(value) : value;
    if (typeof n!=='number' || !Number.isSafeInteger(n) || n<(positive?1:0)) corrupt();
    return n;
}
const nullable = (value: unknown) => value===null?null:integer(value);
function flag(value: unknown): boolean {
    if (value===1 || value===true) return true;
    if (value===0 || value===false) return false;
    return corrupt();
}
function parsed<Record>(value:unknown,values:ProbeHistoryValues<Record>):Record {try{return values.read(value);}catch{return corrupt();}}
function binding(value: unknown): unknown {
    try {
        const body = json<unknown>(value), encoded = JSON.stringify(body);
        if (!encoded || Buffer.byteLength(encoded,'utf8')>2048) corrupt();
        return body;
    } catch { return corrupt(); }
}
function record<Record extends ProbeHistoryRecord>(row:Row,values:ProbeHistoryValues<Record>):Record {
    const echo=['tcp-ingress-echo-v1','udp-ingress-echo-v1','tcp-path-echo-v1','udp-path-echo-v1'].includes(row.measurement as string);
    if(!['tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1','tcp-ingress-echo-v1','udp-ingress-echo-v1','tcp-path-echo-v1','udp-path-echo-v1'].includes(row.measurement as string)||
        (row.measurement==='tcp-ingress-tls-v1'||echo)!==(row.service_selection!==null)||row.measurement!=='tcp-ingress-tls-v1'&&row.result_tls!==null||
        echo!==(row.echo_challenge!==null)||!echo&&[row.result_echo,row.result_request_bytes,row.result_response_bytes].some(value=>value!==null))corrupt();
    const hasResult = row.result_status!==null;
    if (!hasResult && [row.result_code,row.result_elapsed_ms,row.result_measured_at,row.result_valid_until,row.result_accepted_at,row.result_digest,row.result_tls,row.result_echo,row.result_request_bytes,row.result_response_bytes].some(value=>value!==null)) corrupt();
    const value = parsed({ ...(echo?{measurement:row.measurement,service:json(row.service_selection),echoChallenge:json(row.echo_challenge)}:row.measurement==='tcp-ingress-tls-v1'?{measurement:'tcp-ingress-tls-v1',service:json(row.service_selection)}:
        row.measurement==='tcp-ingress-connect-v1'?{measurement:'tcp-ingress-connect-v1'}:{}), scopeId: row.scope_id, probeId: row.probe_id, actorId: row.actor_id, binding: binding(row.binding),
        instanceId: row.instance_id, instanceGeneration: integer(row.instance_generation,true), timeoutMs: integer(row.timeout_ms,true),
        issuedAt: integer(row.issued_at), expiresAt: integer(row.expires_at), state: row.state, closedAt: nullable(row.closed_at),
        revision: integer(row.revision,true), updatedAt: integer(row.updated_at), withdrawnAt: nullable(row.withdrawn_at), recoverySuspended: flag(row.recovery_suspended),
        result: !hasResult?null:{ status: row.result_status, code: row.result_code, elapsedMs: integer(row.result_elapsed_ms),
            measuredAt: integer(row.result_measured_at), validUntil: integer(row.result_valid_until), acceptedAt: integer(row.result_accepted_at), resultDigest: row.result_digest,
            ...(row.measurement==='tcp-ingress-tls-v1'?{tls:row.result_tls===null?null:json(row.result_tls)}:{}),
            ...(echo?{echo:row.result_echo===null?null:json(row.result_echo),requestBytes:integer(row.result_request_bytes),responseBytes:integer(row.result_response_bytes)}:{}) } },values);
    if (value.binding.forwardId!==row.forward_id || value.binding.nodeId!==row.node_id) corrupt();
    return value;
}
function resultFields(value: ProbeHistoryRecord): unknown[] {
    const result = value.result;
    return result?[result.status,result.code,result.elapsedMs,result.measuredAt,result.validUntil,result.acceptedAt,result.resultDigest]:[null,null,null,null,null,null,null];
}

/** Only historical summaries and counters; never reads or mutates execution permits or Runtime. */
export class MySqlProbeHistoryStore<Record extends ProbeHistoryRecord> implements ProbeHistoryStorage<Transaction,Record> {
    private readonly values:ProbeHistoryValues<Record>;
    constructor(values:ProbeHistoryValues<Record>) {this.values=values;}
    async lockScope(tx: Transaction, scope: string): Promise<void> {
        if (!isId(scope)) corrupt();
        await write(tx,'INSERT INTO probe_run_scopes(scope_id) VALUES(?) ON DUPLICATE KEY UPDATE scope_id=VALUES(scope_id)',[scope]);
        await rows(tx,'SELECT scope_id FROM probe_run_scopes WHERE scope_id=? FOR UPDATE',[scope]);
    }
    async losses(tx: Transaction, scope: string): Promise<ProbeHistoryLosses> {
        const [r] = await rows<Row>(tx,'SELECT rows_expired,rows_evicted,updates_without_head FROM probe_run_scopes WHERE scope_id=?',[scope]);
        return r?{rowsExpired:integer(r.rows_expired),rowsEvicted:integer(r.rows_evicted),updatesWithoutHead:integer(r.updates_without_head)}:
            {rowsExpired:0,rowsEvicted:0,updatesWithoutHead:0};
    }
    private async loss(tx: Transaction, scope: string, column: 'rows_expired'|'rows_evicted'|'updates_without_head', count: number): Promise<void> {
        integer(count); if (count===0) return;
        if (await write(tx,`UPDATE probe_run_scopes SET ${column}=${column}+? WHERE scope_id=? AND ${column}<=?`,[count,scope,maximum-count])!==1) corrupt();
    }
    async missingUpdate(tx: Transaction, scope: string): Promise<void> { await this.loss(tx,scope,'updates_without_head',1); }
    async insert(tx: Transaction, input: Record, now: number): Promise<void> {
        return this.insertUsingCurrent(tx,input,now,(tx,scope,id)=>this.get(tx,scope,id));
    }
    /** Preserve the old public current-read override without changing the transaction. */
    async insertUsingCurrent(tx:Transaction,input:Record,now:number,get:(tx:Transaction,scope:string,id:string)=>Promise<Record|null>):Promise<void> {
        const value = parsed(input,this.values); integer(now);
        const existing = await get(tx,value.scopeId,value.probeId);
        if (existing) {
            if (this.values.immutable(existing)!==this.values.immutable(value)) corrupt();
            return;
        }
        const expired = await write(tx,'DELETE FROM probe_runs WHERE scope_id=? AND issued_at<? ORDER BY issued_at,probe_id LIMIT 16',
            [value.scopeId,Math.max(0,now-604800000)]);
        await this.loss(tx,value.scopeId,'rows_expired',expired);
        const [r] = await rows<Row>(tx,'SELECT COUNT(*) n FROM probe_runs WHERE scope_id=?',[value.scopeId]);
        const count = integer(r?.n); if (count>1024) corrupt();
        if (count===1024) {
            const removed = await write(tx,'DELETE FROM probe_runs WHERE scope_id=? ORDER BY issued_at,probe_id LIMIT 1',[value.scopeId]);
            if (removed!==1) corrupt(); await this.loss(tx,value.scopeId,'rows_evicted',removed);
        }
        await write(tx,`INSERT INTO probe_runs(${fields}) VALUES(${Array.from({length:31},()=>'?').join(',')})`,
            [value.scopeId,value.probeId,value.actorId,value.binding.forwardId,value.binding.nodeId,JSON.stringify(value.binding),value.instanceId,value.instanceGeneration,
                value.timeoutMs,value.issuedAt,value.expiresAt,value.state,value.closedAt,value.revision,value.updatedAt,value.withdrawnAt,...resultFields(value),value.recoverySuspended,value.measurement??'tcp-connect-v1',
                value.service===undefined?null:JSON.stringify(value.service),value.result?.tls==null?null:JSON.stringify(value.result.tls),
                value.echoChallenge===undefined?null:JSON.stringify(value.echoChallenge),value.result?.echo==null?null:JSON.stringify(value.result.echo),value.result?.requestBytes??null,value.result?.responseBytes??null]);
    }
    async get(tx: Transaction, scope: string, id: string, lock = false): Promise<Record|null> {
        const [r] = await rows<Row>(tx,`SELECT ${projection} FROM probe_runs WHERE scope_id=? AND probe_id=?${lock?' FOR UPDATE':''}`,[scope,id]);
        return r?record(r,this.values):null;
    }
    async put(tx: Transaction, input: Record): Promise<void> {
        return this.putUsingCurrent(tx,input,(tx,scope,id)=>this.get(tx,scope,id));
    }
    async putUsingCurrent(tx:Transaction,input:Record,get:(tx:Transaction,scope:string,id:string)=>Promise<Record|null>):Promise<void> {
        const value = parsed(input,this.values), old = await get(tx,value.scopeId,value.probeId);
        if (!old || this.values.immutable(old)!==this.values.immutable(value) || value.revision!==old.revision+1) corrupt();
        if (await write(tx,`UPDATE probe_runs SET state=?,closed_at=?,revision=?,updated_at=?,withdrawn_at=?,result_status=?,result_code=?,result_elapsed_ms=?,result_measured_at=?,result_valid_until=?,result_accepted_at=?,result_digest=?,recovery_suspended=?,result_tls=?,result_echo=?,result_request_bytes=?,result_response_bytes=?
            WHERE scope_id=? AND probe_id=? AND revision=?`,[value.state,value.closedAt,value.revision,value.updatedAt,value.withdrawnAt,...resultFields(value),
                value.recoverySuspended,value.result?.tls==null?null:JSON.stringify(value.result.tls),value.result?.echo==null?null:JSON.stringify(value.result.echo),value.result?.requestBytes??null,value.result?.responseBytes??null,value.scopeId,value.probeId,old.revision])!==1) throw new ControlError('REVISION_CONFLICT',409,'Probe run history changed');
    }
    async history(tx: Transaction, scope: string, principal: ReadPrincipal, query: ProbeHistoryQuery<Record['state'],NonNullable<Record['result']>['status']>): Promise<Record[]> {
        if (!Number.isSafeInteger(query.limit) || query.limit<1 || query.limit>50) invalid('Bounded Probe run history page required');
        const filters = ['scope_id=?','issued_at>=?','issued_at<?'], args: unknown[] = [scope,query.from,query.to];
        if (!principal.governance) { filters.push('actor_id=?'); args.push(principal.actorId); }
        for (const [key,column] of [['forwardId','forward_id'],['nodeId','node_id'],['probeId','probe_id'],['state','state']] as const)
            if (query[key]!==undefined) {filters.push(`CAST(${column} AS BINARY)=CAST(? AS BINARY)`);args.push(query[key]);}
        if (query.resultStatus==='missing') filters.push('result_status IS NULL');
        else if (query.resultStatus!==undefined) { filters.push('CAST(result_status AS BINARY)=CAST(? AS BINARY)');args.push(query.resultStatus); }
        if (query.before) {filters.push('(issued_at<? OR (issued_at=? AND CAST(probe_id AS BINARY)<CAST(? AS BINARY)))');args.push(query.before.issuedAt,query.before.issuedAt,query.before.probeId);}
        return (await rows<Row>(tx,`SELECT ${projection} FROM probe_runs WHERE ${filters.join(' AND ')} ORDER BY issued_at DESC,CAST(probe_id AS BINARY) DESC LIMIT ${query.limit+1}`,args)).map(row=>record(row,this.values));
    }
    static async quarantineRecovery(tx: Transaction): Promise<void> {
        // Sticky provenance only: never turn archived states into live or quarantined permits.
        await write(tx,'UPDATE probe_runs SET recovery_suspended=TRUE,revision=revision+1 WHERE recovery_suspended=FALSE');
    }
}
