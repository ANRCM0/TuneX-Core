import { isId } from '@tunex/core';
import { ControlError, invalid } from '../framework/public.ts';
import type { NotificationOutboxRecord, NotificationAttemptRecord, NotificationOutboxHeader, NotificationOutboxLoss, NotificationOutboxLosses,
    NotificationOutboxQuery, NotificationOutboxValues, NotificationOutboxStorage } from '../framework/public.ts';
import { json, rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

type Row = Record<string,unknown>;
const maximum = 9007199254740991;
const terminal = "('delivered','dead-letter','cancelled')", pending = "('queued','retry-wait','claimed')";
const deliveryFields = 'id,scope_id,event_id,policy_id,endpoint_id,policy_config_revision,endpoint_revision,credential_revision,policy_managed_by,endpoint_managed_by,authority_digest,payload,payload_digest,revision,status,attempt_count,fence,claimed_at,claim_until,created_at,updated_at,next_attempt_at,expires_at,last_code,last_outcome,last_status_code,recovery_suspended';
const attemptFields = 'id,delivery_id,ordinal,fence,started_at,finished_at,outcome,code,status_code';
const losses = { queueRejected: 'queue_rejected', routingRejected: 'routing_rejected', silenceSuppressed: 'silence_suppressed',
    disabledSuppressed: 'disabled_suppressed', rowsExpired: 'rows_expired', rowsEvicted: 'rows_evicted', attemptsEvicted: 'attempts_evicted' } as const;
function corrupt(): never { throw new ControlError('INTEGRITY_FAILURE',409,'Invalid notification delivery storage'); }
function integer(value: unknown, positive = false): number {
    const n = typeof value === 'string' && /^(0|[1-9][0-9]{0,15})$(?![\s\S])/.test(value) ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < (positive?1:0)) corrupt();
    return n;
}
const nullable = (value: unknown) => value === null ? null : integer(value);
function flag(value: unknown): boolean {
    if (value === 1 || value === true) return true;
    if (value === 0 || value === false) return false;
    return corrupt();
}
function identity(value: unknown): string { if (!isId(value)) corrupt(); return value; }
function parsed<T>(parse: (value: unknown)=>T, value: unknown): T { try { return parse(value); } catch { return corrupt(); } }
function payload(value: unknown): unknown {
    try {
        const result = json<unknown>(value), encoded = JSON.stringify(result);
        if (!encoded || Buffer.byteLength(encoded,'utf8')>4096) corrupt();
        return result;
    } catch { return corrupt(); }
}
function delivery<Delivery extends NotificationOutboxRecord,Attempt>(row:Row,values:NotificationOutboxValues<Delivery,Attempt>):Delivery {
    const value = parsed(values.delivery,{ id: row.id, eventId: row.event_id, policyId: row.policy_id, endpointId: row.endpoint_id,
        policyConfigRevision: integer(row.policy_config_revision,true), endpointRevision: integer(row.endpoint_revision,true),
        credentialRevision: integer(row.credential_revision,true), policyManagedBy: row.policy_managed_by, endpointManagedBy: row.endpoint_managed_by,
        authorityDigest: row.authority_digest, payload: payload(row.payload), payloadDigest: row.payload_digest,
        revision: integer(row.revision,true), status: row.status, attemptCount: integer(row.attempt_count), fence: integer(row.fence),
        claimedAt: nullable(row.claimed_at), claimUntil: nullable(row.claim_until), createdAt: integer(row.created_at), updatedAt: integer(row.updated_at),
        nextAttemptAt: integer(row.next_attempt_at), expiresAt: integer(row.expires_at), lastCode: row.last_code, lastOutcome: row.last_outcome,
        lastStatusCode: nullable(row.last_status_code), recoverySuspended: flag(row.recovery_suspended) });
    if (value.payload.scopeId !== identity(row.scope_id)) corrupt();
    return value;
}
function attempt<Delivery,Attempt>(row:Row,values:NotificationOutboxValues<Delivery,Attempt>):Attempt {
    return parsed(values.attempt,{ id: row.id, deliveryId: row.delivery_id, ordinal: integer(row.ordinal,true), fence: integer(row.fence,true),
        startedAt: integer(row.started_at), finishedAt: nullable(row.finished_at), outcome: row.outcome, code: row.code, statusCode: nullable(row.status_code) });
}
function immutable(value: NotificationOutboxRecord): string {
    return JSON.stringify({ id: value.id, eventId: value.eventId, policyId: value.policyId, endpointId: value.endpointId,
        policyConfigRevision: value.policyConfigRevision, endpointRevision: value.endpointRevision, credentialRevision: value.credentialRevision,
        policyManagedBy: value.policyManagedBy, endpointManagedBy: value.endpointManagedBy, authorityDigest: value.authorityDigest,
        payload: value.payload, payloadDigest: value.payloadDigest, createdAt: value.createdAt, expiresAt: value.expiresAt });
}

/** Supplied-transaction outbox ownership; never writes source events, endpoints or Runtime. */
export class MySqlNotificationOutboxStore<Delivery extends NotificationOutboxRecord,Attempt extends NotificationAttemptRecord> implements NotificationOutboxStorage<Transaction,Delivery,Attempt> {
    private readonly values:NotificationOutboxValues<Delivery,Attempt>;
    constructor(values:NotificationOutboxValues<Delivery,Attempt>) {this.values=values;}
    async lockScope(tx: Transaction, scope: string): Promise<void> {
        identity(scope);
        await write(tx,'INSERT INTO notification_delivery_scopes(scope_id) VALUES(?) ON DUPLICATE KEY UPDATE scope_id=VALUES(scope_id)',[scope]);
        await rows(tx,'SELECT scope_id FROM notification_delivery_scopes WHERE scope_id=? FOR UPDATE',[scope]);
    }
    async losses(tx: Transaction, scope: string): Promise<NotificationOutboxLosses> {
        const [r] = await rows<Row>(tx,`SELECT ${Object.values(losses).join(',')} FROM notification_delivery_scopes WHERE scope_id=?`,[scope]);
        return { queueRejected: r?integer(r.queue_rejected):0, routingRejected: r?integer(r.routing_rejected):0,
            silenceSuppressed: r?integer(r.silence_suppressed):0, disabledSuppressed: r?integer(r.disabled_suppressed):0,
            rowsExpired: r?integer(r.rows_expired):0, rowsEvicted: r?integer(r.rows_evicted):0, attemptsEvicted: r?integer(r.attempts_evicted):0 };
    }
    private async addLoss(tx: Transaction, scope: string, kind: keyof NotificationOutboxLosses, count: number): Promise<void> {
        integer(count); if (count===0) return;
        const column = losses[kind]; if (!column) corrupt();
        if (await write(tx,`UPDATE notification_delivery_scopes SET ${column}=${column}+? WHERE scope_id=? AND ${column}<=?`,[count,scope,maximum-count])!==1) corrupt();
    }
    async loss(tx: Transaction, scope: string, kind: NotificationOutboxLoss, count: number): Promise<void> {
        if (!['routingRejected','silenceSuppressed','disabledSuppressed'].includes(kind)) corrupt();
        await this.addLoss(tx,scope,kind,count);
    }
    private async removeTerminal(tx: Transaction, scope: string, ids: string[], kind: 'rowsExpired' | 'rowsEvicted'): Promise<void> {
        if (ids.length===0) return;
        if (ids.length>16 || ids.some(value=>!isId(value))) corrupt();
        const placeholders = ids.map(()=>'?').join(','), args = [scope,...ids];
        const removedAttempts = await write(tx,`DELETE FROM notification_delivery_attempts WHERE scope_id=? AND delivery_id IN (${placeholders})`,args);
        const removedRows = await write(tx,`DELETE FROM notification_deliveries WHERE scope_id=? AND id IN (${placeholders}) AND status IN ${terminal}`,args);
        if (removedRows!==ids.length) corrupt();
        await this.addLoss(tx,scope,'attemptsEvicted',removedAttempts);
        await this.addLoss(tx,scope,kind,removedRows);
    }
    async insert(tx: Transaction, scope: string, value: Delivery, now: number): Promise<'inserted'|'duplicate'|'full'> {
        const v = parsed(this.values.delivery,value); integer(now);
        if (v.payload.scopeId!==scope) corrupt();
        const existing = await rows<Row>(tx,`SELECT ${deliveryFields} FROM notification_deliveries WHERE scope_id=? AND (id=? OR (event_id=? AND endpoint_id=?)) LIMIT 2`,[scope,v.id,v.eventId,v.endpointId]);
        if (existing.length) {
            if (existing.length!==1 || immutable(delivery(existing[0]!,this.values))!==immutable(v)) corrupt();
            return 'duplicate';
        }
        const expired = await rows<Row>(tx,`SELECT id FROM notification_deliveries WHERE scope_id=? AND status IN ${terminal} AND created_at<? ORDER BY created_at,id LIMIT 16`,[scope,Math.max(0,now-604800000)]);
        await this.removeTerminal(tx,scope,expired.map(r=>identity(r.id)),'rowsExpired');
        const [countRow] = await rows<Row>(tx,'SELECT COUNT(*) n FROM notification_deliveries WHERE scope_id=?',[scope]);
        const count = integer(countRow?.n); if (count>1024) corrupt();
        if (count===1024) {
            const oldest = await rows<Row>(tx,`SELECT id FROM notification_deliveries WHERE scope_id=? AND status IN ${terminal} ORDER BY created_at,id LIMIT 1`,[scope]);
            if (!oldest.length) { await this.addLoss(tx,scope,'queueRejected',1); return 'full'; }
            await this.removeTerminal(tx,scope,[identity(oldest[0]!.id)],'rowsEvicted');
        }
        await write(tx,`INSERT INTO notification_deliveries(${deliveryFields}) VALUES(${Array.from({length:27},()=>'?').join(',')})`,
            [v.id,scope,v.eventId,v.policyId,v.endpointId,v.policyConfigRevision,v.endpointRevision,v.credentialRevision,v.policyManagedBy,v.endpointManagedBy,
                v.authorityDigest,JSON.stringify(v.payload),v.payloadDigest,v.revision,v.status,v.attemptCount,v.fence,v.claimedAt,v.claimUntil,
                v.createdAt,v.updatedAt,v.nextAttemptAt,v.expiresAt,v.lastCode,v.lastOutcome,v.lastStatusCode,v.recoverySuspended]);
        return 'inserted';
    }
    async due(tx: Transaction, now: number): Promise<NotificationOutboxHeader|null> {
        integer(now);
        const [r] = await rows<Row>(tx,`SELECT scope_id,id,revision FROM notification_deliveries WHERE status IN ${pending} AND next_attempt_at<=? ORDER BY next_attempt_at,id LIMIT 1`,[now]);
        return r?{ scopeId: identity(r.scope_id), id: identity(r.id), revision: integer(r.revision,true) }:null;
    }
    async defer(tx: Transaction, header: NotificationOutboxHeader, cutoff: number, retryAt: number): Promise<void> {
        identity(header.scopeId); identity(header.id); integer(header.revision,true); integer(cutoff); integer(retryAt);
        if (retryAt<=cutoff) invalid('Bounded notification delivery deferral required');
        await write(tx,`UPDATE notification_deliveries SET next_attempt_at=? WHERE scope_id=? AND id=? AND revision=? AND next_attempt_at<=? AND status IN ${pending}`,
            [retryAt,header.scopeId,header.id,header.revision,cutoff]);
    }
    async get(tx: Transaction, scope: string, id: string, lock: boolean|'share' = false): Promise<Delivery|null> {
        const [r] = await rows<Row>(tx,`SELECT ${deliveryFields} FROM notification_deliveries WHERE scope_id=? AND id=?${lock==='share'?' FOR SHARE':lock?' FOR UPDATE':''}`,[scope,id]);
        return r?delivery(r,this.values):null;
    }
    async put(tx: Transaction, scope: string, value: Delivery): Promise<void> {
        return this.putUsingCurrent(tx,scope,value,(tx,scope,id)=>this.get(tx,scope,id));
    }
    /** Keep the old public get override point inside the original supplied transaction. */
    async putUsingCurrent(tx:Transaction,scope:string,value:Delivery,get:(tx:Transaction,scope:string,id:string)=>Promise<Delivery|null>):Promise<void> {
        const v = parsed(this.values.delivery,value), previous = await get(tx,scope,v.id);
        if (!previous || immutable(previous)!==immutable(v) || v.revision!==previous.revision+1) corrupt();
        if (await write(tx,`UPDATE notification_deliveries SET revision=?,status=?,attempt_count=?,fence=?,claimed_at=?,claim_until=?,updated_at=?,next_attempt_at=?,last_code=?,last_outcome=?,last_status_code=?,recovery_suspended=?
            WHERE scope_id=? AND id=? AND revision=?`,
            [v.revision,v.status,v.attemptCount,v.fence,v.claimedAt,v.claimUntil,v.updatedAt,v.nextAttemptAt,v.lastCode,v.lastOutcome,v.lastStatusCode,v.recoverySuspended,scope,v.id,previous.revision])!==1)
            throw new ControlError('REVISION_CONFLICT',409,'Notification delivery changed');
    }
    async activeCount(tx: Transaction, scope: string, now: number): Promise<number> {
        integer(now);
        const [r] = await rows<Row>(tx,"SELECT COUNT(*) n FROM notification_deliveries WHERE scope_id=? AND status='claimed' AND claim_until>?",[scope,now]);
        return integer(r?.n);
    }
    async reserveRate(tx: Transaction, scope: string, endpointId: string, now: number, intervalMs: number): Promise<number> {
        identity(scope); identity(endpointId); integer(now); integer(intervalMs,true);
        if (!Number.isSafeInteger(now+intervalMs)) corrupt();
        const [r] = await rows<Row>(tx,'SELECT next_allowed_at FROM notification_delivery_rates WHERE scope_id=? AND endpoint_id=?',[scope,endpointId]);
        if (r && integer(r.next_allowed_at)>now) return integer(r.next_allowed_at);
        if (!r) {
            const [count] = await rows<Row>(tx,'SELECT COUNT(*) n FROM notification_delivery_rates WHERE scope_id=?',[scope]);
            if (integer(count?.n)>=16) corrupt();
        }
        await write(tx,'INSERT INTO notification_delivery_rates(scope_id,endpoint_id,next_allowed_at) VALUES(?,?,?) ON DUPLICATE KEY UPDATE next_allowed_at=VALUES(next_allowed_at)',[scope,endpointId,now+intervalMs]);
        return now;
    }
    async appendAttempt(tx: Transaction, scope: string, value: Attempt): Promise<void> {
        const v = parsed(this.values.attempt,value);
        const [r] = await rows<Row>(tx,'SELECT COUNT(*) n FROM notification_delivery_attempts WHERE scope_id=?',[scope]);
        const count = integer(r?.n); if (count>256) corrupt();
        if (count===256) {
            const removed = await write(tx,'DELETE FROM notification_delivery_attempts WHERE scope_id=? ORDER BY started_at,id LIMIT 1',[scope]);
            if (removed!==1) corrupt(); await this.addLoss(tx,scope,'attemptsEvicted',removed);
        }
        await write(tx,'INSERT INTO notification_delivery_attempts(id,scope_id,delivery_id,ordinal,fence,started_at,finished_at,outcome,code,status_code) VALUES(?,?,?,?,?,?,?,?,?,?)',
            [v.id,scope,v.deliveryId,v.ordinal,v.fence,v.startedAt,v.finishedAt,v.outcome,v.code,v.statusCode]);
    }
    async finishAttempt(tx: Transaction, scope: string, deliveryId: string, value: Attempt): Promise<void> {
        const v = parsed(this.values.attempt,value);
        if (v.deliveryId!==deliveryId || v.outcome==='pending') corrupt();
        // Zero affected rows means the bounded detail was evicted, not permission to recreate history.
        await write(tx,"UPDATE notification_delivery_attempts SET finished_at=?,outcome=?,code=?,status_code=? WHERE scope_id=? AND id=? AND delivery_id=? AND ordinal=? AND fence=? AND started_at=? AND outcome='pending'",
            [v.finishedAt,v.outcome,v.code,v.statusCode,scope,v.id,deliveryId,v.ordinal,v.fence,v.startedAt]);
    }
    async attempts(tx: Transaction, scope: string, id: string): Promise<Attempt[]> {
        return (await rows<Row>(tx,`SELECT ${attemptFields} FROM notification_delivery_attempts WHERE scope_id=? AND delivery_id=? ORDER BY ordinal DESC,id DESC LIMIT 17`,[scope,id])).map(row=>attempt(row,this.values));
    }
    async history(tx: Transaction, scope: string, query: NotificationOutboxQuery<Delivery['status']>): Promise<Delivery[]> {
        if (!Number.isSafeInteger(query.limit) || query.limit<1 || query.limit>50) invalid('Bounded notification delivery history required');
        const filters = ['scope_id=?','created_at>=?','created_at<?'], args: unknown[] = [scope,query.from,query.to];
        for (const [key,column] of [['endpointId','endpoint_id'],['eventId','event_id'],['status','status']] as const)
            if (query[key]!==undefined) { filters.push(`${column}=?`); args.push(query[key]); }
        if (query.before) { filters.push('(created_at<? OR (created_at=? AND id<?))'); args.push(query.before.createdAt,query.before.createdAt,query.before.id); }
        return (await rows<Row>(tx,`SELECT ${deliveryFields} FROM notification_deliveries WHERE ${filters.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT ${query.limit+1}`,args)).map(row=>delivery(row,this.values));
    }
}
