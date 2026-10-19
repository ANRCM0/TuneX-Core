import { isId } from '@tunex/core';
import { ControlError, invalid } from '../framework/public.ts';
import type { ReadPageWindow, PathPublicationStoredHead, PathPublicationStoredAttempt, PathPublicationStoredRecord,
    PathPublicationStoredOperation, PathPublicationStorage, PathPublicationStorageValues, PathPublicationStorageHooks } from '../framework/public.ts';
import { consolePageSql } from './mysql-read-pagination.ts';
import { json, rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

interface StoredHead {
    batch_id: string; revision: number; created_by: string; created_at: number; plan_digest: string; cancelled: number; recovery_invalidated: number;
}
interface StoredAttempt {
    position: number; kind: PathPublicationStoredAttempt['kind']; actor_id: string; created_at: number;
    request_key: string; request_digest: string; outcome: unknown;
}
const head = (record: StoredHead): PathPublicationStoredHead => ({ batchId: record.batch_id, revision: record.revision, createdBy: record.created_by,
    createdAt: record.created_at, planDigest: record.plan_digest, cancelled: Boolean(record.cancelled), recoveryInvalidated: Boolean(record.recovery_invalidated) });
const attempt = <Outcome>(record: StoredAttempt): PathPublicationStoredAttempt<Outcome> => ({ position: record.position, kind: record.kind, actorId: record.actor_id,
    createdAt: record.created_at, requestKey: record.request_key, requestDigest: record.request_digest, outcome: json<Outcome>(record.outcome) });

/** Caller owns the transaction and batch lock; this adapter never accepts Runtime work itself. */
export class MySqlPathPublicationStore<Plan,Outcome,Failure> implements PathPublicationStorage<Transaction,Plan,Outcome,Failure> {
    private readonly values: PathPublicationStorageValues<Failure>;
    constructor(values: PathPublicationStorageValues<Failure>) { this.values=values; }
    async lockScope(tx: Transaction, scope: string) { await rows(tx, 'SELECT id FROM scopes WHERE id=? FOR UPDATE', [scope]); }
    async count(tx: Transaction, scope: string) {
        return (await rows<{ n: number }>(tx, 'SELECT COUNT(*) n FROM path_publications WHERE scope_id=?', [scope]))[0]!.n;
    }
    async list(tx: Transaction, scope: string, paging: ReadPageWindow, hooks: PathPublicationStorageHooks<Transaction> = {}) {
        const total = await (hooks.count ? hooks.count(tx, scope) : this.count(tx, scope));
        const records = await rows<StoredHead>(tx,
            'SELECT batch_id,revision,created_by,created_at,plan_digest,cancelled,recovery_invalidated FROM path_publications WHERE scope_id=? ORDER BY batch_id ' + consolePageSql(paging), [scope]);
        return { total, items: records.map(head) };
    }
    async read(tx: Transaction, scope: string, id: string, lock = false): Promise<PathPublicationStoredRecord<Plan,Outcome> | null> {
        const record = (await rows<StoredHead & { plan: unknown }>(tx,
            'SELECT batch_id,revision,created_by,created_at,plan_digest,cancelled,recovery_invalidated,plan FROM path_publications WHERE scope_id=? AND batch_id=?' + (lock ? ' FOR UPDATE' : ' FOR SHARE'), [scope, id]))[0];
        if (!record) return null;
        // Keep the head stable until its immutable attempts are projected on this same transaction.
        const attempts = await rows<StoredAttempt>(tx,
            'SELECT position,kind,actor_id,created_at,request_key,request_digest,outcome FROM path_publication_attempts WHERE scope_id=? AND batch_id=? ORDER BY position,kind LIMIT 20', [scope, id]);
        return { head: head(record), plan: json<Plan>(record.plan), attempts: attempts.map(record => attempt<Outcome>(record)) };
    }
    /** Trusted legacy hooks retain the original lazy count/event dispatch; they never replace locks. */
    async create(tx: Transaction, scope: string, record: PathPublicationStoredHead, plan: Plan, hooks: PathPublicationStorageHooks<Transaction> = {}) {
        if (await (hooks.count ? hooks.count(tx, scope) : this.count(tx, scope)) >= 64) throw new ControlError('RESOURCE_LIMIT', 429, 'Scope durable path publication limit reached');
        await write(tx, 'INSERT INTO path_publications(scope_id,batch_id,revision,created_by,created_at,plan_digest,cancelled,recovery_invalidated,plan) VALUES(?,?,?,?,?,?,?,?,?)',
            [scope, record.batchId, record.revision, record.createdBy, record.createdAt, record.planDigest, record.cancelled, record.recoveryInvalidated, JSON.stringify(plan)]);
        await (hooks.event ? hooks.event(tx, scope, record.batchId, record.revision, 'create', record.createdBy, record.createdAt) :
            this.event(tx, scope, record.batchId, record.revision, 'create', record.createdBy, record.createdAt));
    }
    async append(tx: Transaction, scope: string, id: string, expectedRevision: number, record: PathPublicationStoredAttempt<Outcome>, hooks: PathPublicationStorageHooks<Transaction> = {}) {
        const changed = await write(tx,
            'UPDATE path_publications SET revision=revision+1 WHERE scope_id=? AND batch_id=? AND revision=? AND revision<24 AND recovery_invalidated=FALSE' + (record.kind === 'apply' ? ' AND cancelled=FALSE' : ''),
            [scope, id, expectedRevision]);
        if (changed !== 1) throw new ControlError('REVISION_CONFLICT', 409, 'Path publication changed, cancelled or recovery invalidated');
        await write(tx, 'INSERT INTO path_publication_attempts(scope_id,batch_id,position,kind,actor_id,created_at,request_key,request_digest,outcome) VALUES(?,?,?,?,?,?,?,?,?)',
            [scope, id, record.position, record.kind, record.actorId, record.createdAt, record.requestKey, record.requestDigest, JSON.stringify(record.outcome)]);
        await (hooks.event ? hooks.event(tx, scope, id, expectedRevision + 1, record.kind, record.actorId, record.createdAt) :
            this.event(tx, scope, id, expectedRevision + 1, record.kind, record.actorId, record.createdAt));
    }
    async cancel(tx: Transaction, scope: string, id: string, expectedRevision: number, actor: string, at: number, hooks: PathPublicationStorageHooks<Transaction> = {}) {
        const changed = await write(tx,
            'UPDATE path_publications SET cancelled=TRUE,revision=revision+1 WHERE scope_id=? AND batch_id=? AND revision=? AND revision<24 AND cancelled=FALSE AND recovery_invalidated=FALSE',
            [scope, id, expectedRevision]);
        if (changed !== 1) throw new ControlError('REVISION_CONFLICT', 409, 'Path publication changed, cancelled or recovery invalidated');
        await (hooks.event ? hooks.event(tx, scope, id, expectedRevision + 1, 'cancel', actor, at) :
            this.event(tx, scope, id, expectedRevision + 1, 'cancel', actor, at));
    }
    async event(tx: Transaction, scope: string, id: string, revision: number, kind: 'create' | 'apply' | 'compensate' | 'cancel', actor: string, at: number) {
        await write(tx, 'INSERT INTO path_publication_events(scope_id,batch_id,revision,kind,actor_id,created_at) VALUES(?,?,?,?,?,?)', [scope, id, revision, kind, actor, at]);
    }
    async isolate<T>(tx: Transaction, action: () => Promise<T>): Promise<{ accepted: true; value: T } | { accepted: false; error: Failure }> {
        // The outer publication request has already claimed its original idempotency row.
        await tx.query('SAVEPOINT path_publication_forward');
        let value: T;
        try { value = await action(); }
        catch (error) {
            if (!this.values.isRefusal(error)) throw error;
            // Savepoint failures and all unknown database errors must escape to the outer UnitOfWork.
            await tx.query('ROLLBACK TO SAVEPOINT path_publication_forward');
            await tx.query('RELEASE SAVEPOINT path_publication_forward');
            return { accepted: false, error: this.values.refusal(error) };
        }
        await tx.query('RELEASE SAVEPOINT path_publication_forward');
        return { accepted: true, value };
    }
    async operations(tx: Transaction, scope: string, ids: string[]): Promise<PathPublicationStoredOperation[]> {
        if (!Array.isArray(ids) || ids.length > 20 || ids.some(id => !isId(id)) || new Set(ids).size !== ids.length)
            invalid('At most twenty distinct exact Operation IDs required');
        if (!ids.length) return [];
        const records = await rows<{ id: string; forward_id: string; target_revision: number; status: PathPublicationStoredOperation['status']; cleanup_pending: number; recovery_invalidated: number }>(tx,
            'SELECT id,forward_id,target_revision,status,cleanup_pending,recovery_invalidated FROM operations WHERE scope_id=? AND id IN (' + ids.map(() => '?').join(',') + ') ORDER BY id LIMIT 20', [scope, ...ids]);
        return records.map(record => ({ operationId: record.id, forwardId: record.forward_id, targetRevision: record.target_revision, status: record.status,
            cleanupPending: Boolean(record.cleanup_pending), recoveryInvalidated: Boolean(record.recovery_invalidated) }));
    }
}
