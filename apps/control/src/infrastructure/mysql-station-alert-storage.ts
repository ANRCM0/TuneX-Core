import { isId } from '@tunex/core';
import { ControlError, invalid } from '../framework/public.ts';
import type { StationPolicyRecord, StationPolicyAuditRecord, StationEventRecord, StationStorageLosses,
    StationStorageEventQuery, StationStorageValues, StationAlertStorage } from '../framework/public.ts';
import { rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';
import { max, corrupt, counter, flag, id, text, nullableCounter, nullableId, stored, encoded } from './station-alert-storage-native.ts';
import type { Row } from './station-alert-storage-native.ts';

const policyFields = 'policy_id,revision,config_revision,config_digest,config,managed_by,created_at,updated_at,silenced_until,suspended,next_evaluate_at,state';
function policy(row: Row): StationPolicyRecord {
    return { policyId: id(row.policy_id), revision: counter(row.revision,true), configRevision: counter(row.config_revision,true),
        config: stored(row.config,1024), configDigest: text(row.config_digest,71), managedBy: id(row.managed_by),
        createdAt: counter(row.created_at), updatedAt: counter(row.updated_at), silencedUntil: nullableCounter(row.silenced_until),
        suspended: text(row.suspended) as StationPolicyRecord['suspended'], nextEvaluateAt: counter(row.next_evaluate_at), state: stored(row.state,8192) };
}
const auditFields = 'id,policy_id,revision,config_revision,config_digest,kind,actor_id,created_at,event_id';
function audit(row: Row): StationPolicyAuditRecord {
    return { id: id(row.id), policyId: id(row.policy_id), revision: counter(row.revision,true), configRevision: counter(row.config_revision,true),
        configDigest: text(row.config_digest,71), kind: text(row.kind) as StationPolicyAuditRecord['kind'], actorId: id(row.actor_id),
        createdAt: counter(row.created_at), eventId: nullableId(row.event_id) };
}
const eventFields = 'id,policy_id,occurred_at,rule,target_id,kind,episode,config_revision,body,revision,acknowledged_at,recovery_suspended';
function event(row: Row): StationEventRecord {
    const body = stored<StationEventRecord>(row.body,4096);
    if (!body.config || !body.config.target || body.config.rule !== row.rule || body.config.target.id !== row.target_id) corrupt();
    // The immutable event body never authorizes mutable acknowledgement or restore state.
    return { ...body, id: id(row.id), policyId: id(row.policy_id), occurredAt: counter(row.occurred_at),
        kind: text(row.kind) as StationEventRecord['kind'], episode: counter(row.episode,true), configRevision: counter(row.config_revision,true),
        revision: counter(row.revision,true), acknowledgedAt: nullableCounter(row.acknowledged_at), recoverySuspended: flag(row.recovery_suspended) };
}

/** All mutations are confined to this module's four tables on the caller's transaction. */
export class MySqlStationAlertStorage<Policy extends StationPolicyRecord,Audit extends StationPolicyAuditRecord,Event extends StationEventRecord> implements StationAlertStorage<Transaction,Policy,Audit,Event> {
    private readonly values:StationStorageValues<Policy,Audit,Event>;
    constructor(values:StationStorageValues<Policy,Audit,Event>) {this.values=values;}
    async lockScope(tx: Transaction, scope: string): Promise<void> {
        await write(tx,'INSERT INTO station_alert_scopes(scope_id) VALUES(?) ON DUPLICATE KEY UPDATE scope_id=VALUES(scope_id)',[scope]);
        await rows(tx,'SELECT scope_id FROM station_alert_scopes WHERE scope_id=? FOR UPDATE',[scope]);
    }
    async losses(tx: Transaction, scope: string): Promise<StationStorageLosses> {
        const [r] = await rows<Row>(tx,'SELECT events_evicted,events_expired,audit_evicted FROM station_alert_scopes WHERE scope_id=?',[scope]);
        return r ? { eventsEvicted: counter(r.events_evicted), eventsExpired: counter(r.events_expired), auditEvicted: counter(r.audit_evicted) } :
            { eventsEvicted: 0, eventsExpired: 0, auditEvicted: 0 };
    }
    async policyCount(tx: Transaction, scope: string): Promise<number> {
        const [r] = await rows<Row>(tx,'SELECT COUNT(*) n FROM station_alert_policies WHERE scope_id=?',[scope]);
        return counter(r?.n);
    }
    async policies(tx: Transaction, scope: string): Promise<Policy[]> {
        const result = await rows<Row>(tx,`SELECT ${policyFields} FROM station_alert_policies WHERE scope_id=? ORDER BY policy_id LIMIT 65`,[scope]);
        if (result.length > 64) corrupt();
        return result.map(row => this.values.policy(policy(row)));
    }
    async policy(tx: Transaction, scope: string, value: string, lock = false): Promise<Policy | null> {
        const [r] = await rows<Row>(tx,`SELECT ${policyFields} FROM station_alert_policies WHERE scope_id=? AND policy_id=?` + (lock ? ' FOR UPDATE' : ''),[scope,value]);
        return r ? this.values.policy(policy(r)) : null;
    }
    async putPolicy(tx: Transaction, scope: string, value: Policy): Promise<void> {
        return this.putPolicyUsingCount(tx,scope,value,(tx,scope)=>this.policyCount(tx,scope));
    }
    async putPolicyUsingCount(tx:Transaction,scope:string,value:Policy,count:(tx:Transaction,scope:string)=>Promise<number>):Promise<void> {
        const [existing] = await rows<Row>(tx,'SELECT policy_id FROM station_alert_policies WHERE scope_id=? AND policy_id=?',[scope,value.policyId]);
        if (!existing && await count(tx,scope) >= 64) throw new ControlError('RESOURCE_LIMIT',429,'Station alert policy limit reached');
        await write(tx,`INSERT INTO station_alert_policies(scope_id,policy_id,revision,config_revision,config_digest,config,enabled,managed_by,created_at,updated_at,silenced_until,suspended,next_evaluate_at,state)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE revision=VALUES(revision),config_revision=VALUES(config_revision),config_digest=VALUES(config_digest),
            config=VALUES(config),enabled=VALUES(enabled),managed_by=VALUES(managed_by),updated_at=VALUES(updated_at),silenced_until=VALUES(silenced_until),
            suspended=VALUES(suspended),next_evaluate_at=VALUES(next_evaluate_at),state=VALUES(state)`,
            [scope,value.policyId,value.revision,value.configRevision,value.configDigest,encoded(value.config,1024),value.config.enabled,value.managedBy,
                value.createdAt,value.updatedAt,value.silencedUntil,value.suspended,value.nextEvaluateAt,encoded(value.state,8192)]);
    }
    async audit(tx: Transaction, scope: string, value: Audit): Promise<void> {
        const [r] = await rows<Row>(tx,'SELECT COUNT(*) n FROM station_alert_policy_events WHERE scope_id=?',[scope]);
        const count = counter(r?.n); if (count > 256) corrupt();
        if (count === 256) {
            const removed = await write(tx,'DELETE FROM station_alert_policy_events WHERE scope_id=? ORDER BY created_at,id LIMIT 1',[scope]);
            await this.loss(tx,scope,'audit_evicted',removed);
        }
        await write(tx,'INSERT INTO station_alert_policy_events(id,scope_id,policy_id,revision,config_revision,config_digest,kind,actor_id,created_at,event_id) VALUES(?,?,?,?,?,?,?,?,?,?)',
            [value.id,scope,value.policyId,value.revision,value.configRevision,value.configDigest,value.kind,value.actorId,value.createdAt,value.eventId]);
    }
    async audits(tx: Transaction, scope: string, value: string): Promise<Audit[]> {
        return (await rows<Row>(tx,`SELECT ${auditFields} FROM station_alert_policy_events WHERE scope_id=? AND policy_id=? ORDER BY created_at DESC,id DESC LIMIT 17`,[scope,value])).map(row => this.values.audit(audit(row)));
    }
    async due(tx: Transaction, now: number): Promise<{ scopeId: string; policyId: string; revision: number } | null> {
        const [r] = await rows<Row>(tx,"SELECT scope_id,policy_id,revision FROM station_alert_policies WHERE enabled=TRUE AND suspended='none' AND next_evaluate_at<=? ORDER BY next_evaluate_at,scope_id,policy_id LIMIT 1",[now]);
        return r ? { scopeId: id(r.scope_id), policyId: id(r.policy_id), revision: counter(r.revision,true) } : null;
    }
    async defer(tx: Transaction, scope: string, value: string, expectedRevision: number, cutoff: number, retryAt: number): Promise<void> {
        if (!isId(scope) || !isId(value) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1 ||
            !Number.isSafeInteger(cutoff) || cutoff < 0 || !Number.isSafeInteger(retryAt) || retryAt <= cutoff)
            invalid('Bounded conditional station alert deferral required');
        // A failed observation must not monopolize due work or overwrite a newer policy.
        await write(tx,"UPDATE station_alert_policies SET next_evaluate_at=? WHERE scope_id=? AND policy_id=? AND revision=? AND next_evaluate_at<=? AND enabled=TRUE AND suspended='none'",
            [retryAt,scope,value,expectedRevision,cutoff]);
    }
    async event(tx: Transaction, scope: string, value: string, lock = false): Promise<Event | null> {
        const [r] = await rows<Row>(tx,`SELECT ${eventFields} FROM station_alert_events WHERE scope_id=? AND id=?` + (lock ? ' FOR UPDATE' : ''),[scope,value]);
        return r ? this.values.event(event(r)) : null;
    }
    async events(tx: Transaction, scope: string, query: StationStorageEventQuery): Promise<Event[]> {
        if (!Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 50) invalid('Bounded station event page required');
        const clauses = ['scope_id=?','occurred_at>=?','occurred_at<?'], args: unknown[] = [scope,query.from,query.to];
        for (const [key,column] of [['policyId','policy_id'],['targetId','target_id'],['rule','rule'],['kind','kind']] as const) {
            if (query[key] !== undefined) { clauses.push(`${column}=?`); args.push(query[key]); }
        }
        if (query.acknowledged !== undefined) clauses.push('acknowledged_at IS ' + (query.acknowledged ? 'NOT NULL' : 'NULL'));
        if (query.before) { clauses.push('(occurred_at<? OR (occurred_at=? AND id<?))'); args.push(query.before.occurredAt,query.before.occurredAt,query.before.id); }
        return (await rows<Row>(tx,`SELECT ${eventFields} FROM station_alert_events WHERE ${clauses.join(' AND ')} ORDER BY occurred_at DESC,id DESC LIMIT ${query.limit + 1}`,args)).map(row => this.values.event(event(row)));
    }
    private async loss(tx: Transaction, scope: string, column: 'events_expired' | 'events_evicted' | 'audit_evicted', amount: number): Promise<void> {
        if (amount === 0) return;
        if (await write(tx,`UPDATE station_alert_scopes SET ${column}=${column}+? WHERE scope_id=? AND ${column}<=?`,[amount,scope,max-amount]) !== 1) corrupt();
    }
    async appendEvent(tx: Transaction, scope: string, value: Event, now: number): Promise<void> {
        const expired = await write(tx,'DELETE FROM station_alert_events WHERE scope_id=? AND occurred_at<? ORDER BY occurred_at,id LIMIT 16',[scope,Math.max(0,now-2592000000)]);
        await this.loss(tx,scope,'events_expired',expired);
        const [r] = await rows<Row>(tx,'SELECT COUNT(*) n FROM station_alert_events WHERE scope_id=?',[scope]);
        const count = counter(r?.n); if (count > 1024) corrupt();
        if (count === 1024) {
            const removed = await write(tx,'DELETE FROM station_alert_events WHERE scope_id=? ORDER BY occurred_at,id LIMIT 1',[scope]);
            await this.loss(tx,scope,'events_evicted',removed);
        }
        await write(tx,'INSERT INTO station_alert_events(id,scope_id,policy_id,occurred_at,rule,target_id,kind,episode,config_revision,body,revision,acknowledged_at,recovery_suspended) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [value.id,scope,value.policyId,value.occurredAt,value.config.rule,value.config.target.id,value.kind,value.episode,value.configRevision,
                encoded(value,4096),value.revision,value.acknowledgedAt,value.recoverySuspended]);
    }
    async acknowledge(tx: Transaction, scope: string, value: string, expectedRevision: number, at: number): Promise<void> {
        if (await write(tx,'UPDATE station_alert_events SET acknowledged_at=?,revision=revision+1 WHERE scope_id=? AND id=? AND revision=? AND revision<? AND acknowledged_at IS NULL',
            [at,scope,value,expectedRevision,max]) !== 1) throw new ControlError('REVISION_CONFLICT',409,'Station alert event changed');
    }
}
